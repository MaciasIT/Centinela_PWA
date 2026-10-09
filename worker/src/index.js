/**
 * Centinela — Cloudflare Worker (v2)
 *
 * Proxy de veredicto con UNA sola fuente declarada: **VirusTotal** (decisión 1A).
 * Google Safe Browsing y URLScan.io se han retirado por completo (eran ramas
 * muertas en producción: la clave de GSB nunca estuvo configurada).
 *
 * ── Orden de comprobación de `POST /api/scan` (arquitectura §5.3.1) ──
 *   CORS → Content-Type → freno de inundación por IP (binding) → tamaño del
 *   cuerpo → lectura/parseo → validación → cuota global exacta (DO `QuotaGuard`)
 *   → VirusTotal
 *
 * El freno por IP y el rechazo por tamaño van ANTES de leer el cuerpo (hallazgo
 * H-3 de la revisión de seguridad de la Tanda 3a): ningún camino de lectura o
 * parseo queda sin pasar por un control.
 *
 * ── AVISO IMPORTANTE SOBRE EL RATE LIMITING ─────────────────────────
 * El binding `SCAN_RATE_LIMITER` ([[ratelimits]], 30/60 s por IP) **NO es un
 * contador exacto**: es *permissive* y de consistencia eventual (verificado:
 * 17 peticiones sobre un límite de 4 → 0 bloqueos). **NO garantiza el techo de
 * cuota de VirusTotal.** Su ÚNICA función es evitar que un único actor acapare
 * (freno de inundación). El techo de cuota (4/min · 500/día) lo garantiza el
 * Durable Object `QuotaGuard`, que sí cuenta. Que nadie vuelva a creer que el
 * binding protege la cuota.
 *
 * Además, con wrangler 3 el binding se descarta EN SILENCIO en el despliegue.
 * Por eso existe `worker/scripts/check-bindings.mjs`, que hace FALLAR el
 * pipeline si el binding no llega (ver `.github/workflows/ci.yml`).
 */

import pkg from '../../package.json' with { type: 'json' };
import { validateUrl, normalizeUrl, MAX_BODY_BYTES, ERROR_MESSAGES } from './validation.js';
import { checkVirusTotal, UpstreamError, SOURCE } from './virustotal.js';
import { QuotaGuard, QUOTA_INSTANCE_NAME } from './quota-guard.js';
import { checkLocalReputation } from './reputation.js';

// El Durable Object debe estar exportado desde el módulo principal del Worker.
export { QuotaGuard };

const APP_VERSION = pkg.version;

/* ── CORS real: lista blanca explícita, sin comodín ni regex laxa ─── */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://centinela-pwa.pages.dev',
  'http://localhost:5173',
  'http://localhost:8787',
];

/**
 * Único patrón admitido más allá de la lista: los *preview deployments* de
 * Cloudflare Pages, cuyo subdominio es un hash. Anclado y estricto a propósito
 * (nada de `.*`): `https://<hash>.centinela-pwa.pages.dev`.
 */
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9][a-z0-9-]*\.centinela-pwa\.pages\.dev$/;

/** Lista blanca efectiva: `ALLOWED_ORIGINS` (env) o la de producción/dev por defecto. */
export function allowedOrigins(env) {
  const raw = env && typeof env.ALLOWED_ORIGINS === 'string' ? env.ALLOWED_ORIGINS : '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ALLOWED_ORIGINS;
}

export function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (allowedOrigins(env).includes(origin)) return true;
  return PREVIEW_ORIGIN.test(origin);
}

/* ── Cabeceras ───────────────────────────────────────────────────── */

/** Cabeceras de seguridad presentes en TODA respuesta del Worker (§5.2, HU-32). */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  // camera=() es correcto AQUÍ: el Worker solo sirve JSON. El sitio de Pages
  // lleva camera=(self) porque sí usa la cámara para el escáner QR (RC-01).
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(status, body, origin, extraHeaders) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS };
  if (origin) Object.assign(headers, corsHeaders(origin));
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(status, code, origin, extraHeaders) {
  return jsonResponse(
    status,
    { error: { code, message: ERROR_MESSAGES[code] || ERROR_MESSAGES.INTERNAL } },
    origin,
    extraHeaders
  );
}

/* ── Cuota global exacta (DO `QuotaGuard`) ───────────────────────── */

/**
 * Pide un token de cuota al DO global. Si el binding no estuviera declarado,
 * NO se bloquea la app (fail-open): el fallo silencioso lo hace imposible el
 * gate de CI (`scripts/check-bindings.mjs`), no el runtime.
 */
async function acquireQuota(env) {
  const ns = env && env.QUOTA_GUARD;
  if (!ns || typeof ns.idFromName !== 'function' || typeof ns.get !== 'function') {
    return { allowed: true, retryAfter: 0, enforced: false };
  }
  const id = ns.idFromName(QUOTA_INSTANCE_NAME);
  const stub = ns.get(id);
  const res = await stub.fetch(`https://quota-guard/${QUOTA_INSTANCE_NAME}`);
  const data = await res.json();
  return { allowed: !!data.allowed, retryAfter: data.retryAfter || 0, enforced: true };
}

/* ── Freno de inundación por IP (binding, best-effort) ───────────── */

async function ipFloodBrake(request, env) {
  const limiter = env && env.SCAN_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== 'function') return true;
  const key = request.headers.get('cf-connecting-ip') || 'desconocida';
  const { success } = await limiter.limit({ key });
  return success !== false;
}

/* ── Tamaño del cuerpo ───────────────────────────────────────────── */

/**
 * ¿El `Content-Length` DECLARADO supera el máximo? Permite rechazar por la
 * cabecera ANTES de bufferizar el cuerpo (hallazgo H-3). Si el cliente miente o
 * usa chunked sin longitud, queda el backstop de `rawBody.length` tras leer.
 */
function declaredBodyTooLarge(request) {
  const raw = request.headers.get('Content-Length');
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > MAX_BODY_BYTES;
}

/* ── Entrypoint ──────────────────────────────────────────────────── */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const originOk = isAllowedOrigin(origin, env);
    const corsOrigin = originOk ? origin : null;

    // 1. Preflight. Origen no permitido → 403 sin cabeceras CORS.
    if (request.method === 'OPTIONS') {
      if (!originOk) {
        return new Response(null, { status: 403, headers: { Vary: 'Origin' } });
      }
      return new Response(null, {
        status: 204,
        headers: { ...SECURITY_HEADERS, ...corsHeaders(origin) },
      });
    }

    // 2. Origen no permitido en una petición real → 403 antes de gastar cuota.
    //    Nota honesta: CORS es un control del NAVEGADOR, no autenticación; un
    //    cliente no-navegador puede falsificar `Origin`. La protección real
    //    contra abuso es la validación + el rate limiting + la cuota.
    if (origin && !originOk && url.pathname.startsWith('/api/')) {
      return errorResponse(403, 'FORBIDDEN_ORIGIN', null);
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(
        200,
        { status: 'ok', timestamp: new Date().toISOString(), version: APP_VERSION },
        corsOrigin
      );
    }

    if (request.method === 'POST' && url.pathname === '/api/scan') {
      return handleScan(request, env, corsOrigin);
    }

    if (request.method === 'POST' && url.pathname === '/api/local-check') {
      return handleLocalCheck(request, env, corsOrigin);
    }

    return new Response('Not found', { status: 404, headers: { ...SECURITY_HEADERS } });
  },
};

/* ── POST /api/scan ──────────────────────────────────────────────── */

async function handleScan(request, env, corsOrigin) {
  // Validación de la petición ANTES de gastar cuota (HU-31, NFR-S1).
  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return errorResponse(415, 'INVALID_JSON', corsOrigin);
  }

  // Freno de inundación por IP (binding). NO protege la cuota: ver cabecera.
  // Va ANTES de leer el cuerpo (H-3): un actor en inundación se corta sin que
  // lleguemos a bufferizar y parsear su petición.
  if (!(await ipFloodBrake(request, env))) {
    return errorResponse(429, 'RATE_LIMITED', corsOrigin);
  }

  // Tamaño declarado: se rechaza por cabecera, sin leer el cuerpo (H-3).
  if (declaredBodyTooLarge(request)) {
    return errorResponse(413, 'INVALID_JSON', corsOrigin);
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse(400, 'INVALID_JSON', corsOrigin);
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return errorResponse(413, 'INVALID_JSON', corsOrigin);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, 'INVALID_JSON', corsOrigin);
  }

  const checked = validateUrl(body && body.url);
  if (!checked.ok) {
    return errorResponse(checked.code === 'URL_TOO_LONG' ? 414 : 400, checked.code, corsOrigin);
  }

  // Normalización canónica (RC-04): el mismo destino no consume cuota dos veces.
  // Conserva el esquema original del usuario (C-1): no se analiza otra variante.
  const targetUrl = normalizeUrl(checked.url) || checked.url;

  // Techo global EXACTO de cuota (DO `QuotaGuard`).
  const quota = await acquireQuota(env);
  if (!quota.allowed) {
    return errorResponse(503, 'QUOTA_EXCEEDED', corsOrigin, {
      'Retry-After': String(quota.retryAfter || 60),
    });
  }

  try {
    const result = await checkVirusTotal(targetUrl, env && env.VIRUSTOTAL_API_KEY);
    return jsonResponse(200, { results: [result], source: SOURCE, version: APP_VERSION }, corsOrigin);
  } catch (err) {
    if (err instanceof UpstreamError && err.code === 'QUOTA_EXCEEDED') {
      return errorResponse(503, 'QUOTA_EXCEEDED', corsOrigin, { 'Retry-After': '60' });
    }
    // El mensaje del proveedor NUNCA se filtra (NFR-S2).
    return errorResponse(502, 'UPSTREAM_UNAVAILABLE', corsOrigin);
  }
}

/* ── POST /api/local-check ───────────────────────────────────────── */

/**
 * NOTA DE ALCANCE (T3a/T3c): la arquitectura §5.2 recomienda retirar este
 * endpoint y mover las señales puras al cliente (`core/reputation.js`, fase
 * Should), pero también deja la decisión «revisable por el Orchestrator».
 *
 * DECISIÓN DEL ORCHESTRATOR (Tanda 3c, C-2): **se MANTIENE**, porque el cliente
 * lo usa de verdad (`js/api.js`) y hoy funciona. Al mantenerse, se le aplica la
 * mitigación que pedía la revisión de seguridad (hallazgo H-2): el MISMO freno
 * de inundación por IP y el mismo rechazo por tamaño declarado que a
 * `/api/scan`, antes de leer el cuerpo y antes de hacer ningún `fetch` saliente
 * (RDAP). No consume cuota del DO: no llama a VirusTotal.
 * Ver `tanda-3a-informe.md` (C-2) y `revision-seguridad-worker.md` (H-2/H-3).
 */
async function handleLocalCheck(request, env, corsOrigin) {
  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return errorResponse(415, 'INVALID_JSON', corsOrigin);
  }

  // Mismo freno de inundación por IP que /api/scan (H-2), antes de leer el cuerpo.
  if (!(await ipFloodBrake(request, env))) {
    return errorResponse(429, 'RATE_LIMITED', corsOrigin);
  }

  if (declaredBodyTooLarge(request)) {
    return errorResponse(413, 'INVALID_JSON', corsOrigin);
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse(400, 'INVALID_JSON', corsOrigin);
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return errorResponse(413, 'INVALID_JSON', corsOrigin);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, 'INVALID_JSON', corsOrigin);
  }

  const checked = validateUrl(body && body.url);
  if (!checked.ok) {
    return errorResponse(checked.code === 'URL_TOO_LONG' ? 414 : 400, checked.code, corsOrigin);
  }

  try {
    const result = await checkLocalReputation(checked.url, env);
    return jsonResponse(200, { ...result, source: 'local', version: APP_VERSION }, corsOrigin);
  } catch {
    return errorResponse(500, 'INTERNAL', corsOrigin);
  }
}
