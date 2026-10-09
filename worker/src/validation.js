/**
 * Centinela — Validación y normalización de URL (HU-31 · RC-04)
 *
 * Única implementación server-side de:
 *   - validateUrl(): esquema, longitud y host, ANTES de gastar cuota de VirusTotal.
 *   - normalizeUrl(): clave canónica de caché/dedupe (arquitectura §5.3.2, RC-04).
 *
 * La normalización existe para que dos enlaces que llevan al MISMO destino
 * (mismo host+path+query, distinto orden de parámetros o con `utm_*`/`fbclid`)
 * no consuman cuota de VirusTotal dos veces.
 *
 * La versión cliente de `normalizeUrl` vive en `js/api.js` y tiene otro contrato
 * (no fuerza https, porque lo usa para deduplicar el historial del usuario).
 * Unificarlas es trabajo pendiente: ver `tanda-3a-informe.md` (contradicción C-3).
 */

/** HU-31 AC-02: longitud máxima de la URL aceptada. */
export const MAX_URL_LENGTH = 2048;

/** Tamaño máximo del cuerpo de `POST /api/scan` (8 KB). */
export const MAX_BODY_BYTES = 8 * 1024;

/** Códigos de error internos permitidos por el contrato (§5.2, principio 4). */
export const ERROR_MESSAGES = Object.freeze({
  INVALID_JSON: 'No se ha podido leer la petición.',
  INVALID_URL: 'Esto no parece un enlace web que se pueda comprobar.',
  URL_TOO_LONG: 'El enlace es demasiado largo para comprobarlo.',
  FORBIDDEN_ORIGIN: 'Este sitio no tiene permiso para usar el servicio.',
  RATE_LIMITED: 'Has hecho muchas comprobaciones seguidas. Espera un minuto e inténtalo otra vez.',
  QUOTA_EXCEEDED: 'El servicio está muy solicitado ahora mismo, así que no se ha podido comprobar este enlace. Inténtalo dentro de un minuto.',
  UPSTREAM_UNAVAILABLE: 'No se ha podido contactar con el servicio de comprobación. Inténtalo de nuevo en un momento.',
  INTERNAL: 'Algo ha fallado por nuestra parte. Inténtalo de nuevo.',
});

/* ── Parámetros de seguimiento (RC-04, paso 6) ───────────────────── */

const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_eid', 'mc_cid', 'igshid', 'si',
  'srsltid', '_ga', '_gl', 'ref', 'ref_src', 'ref_url', 'yclid', 'twclid', 'mkt_tok',
  'oly_anon_id', 'oly_enc_id', 'vero_id', 'wickedid', '__s',
]);

const TRACKING_PREFIXES = ['utm_'];

/** ¿Es un parámetro de seguimiento que debe descartarse antes de consultar/cachear? */
export function isTrackingParam(name) {
  const n = String(name).toLowerCase();
  return TRACKING_PARAMS.has(n) || TRACKING_PREFIXES.some((p) => n.startsWith(p));
}

/* ── Validación ──────────────────────────────────────────────────── */

const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;

/** ¿El host es una IP literal (v4 o v6)? Las IPs literales no se comprueban. */
function isIpLiteral(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (IPV4_LITERAL.test(host)) return true;
  if (host.includes(':')) return true; // IPv6
  return false;
}

function fail(code, message) {
  return { ok: false, code, message: message || ERROR_MESSAGES[code] };
}

/**
 * Valida una URL antes de gastar cuota (arquitectura §5.2, orden 3→7).
 * @param {unknown} raw
 * @returns {{ok: true, url: string} | {ok: false, code: string, message: string}}
 */
export function validateUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return fail('INVALID_URL');

  const candidate = raw.trim();
  if (candidate.length > MAX_URL_LENGTH) return fail('URL_TOO_LONG');

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return fail('INVALID_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('INVALID_URL');

  const host = parsed.hostname.toLowerCase();
  if (!host || !host.includes('.') || isIpLiteral(host)) return fail('INVALID_URL');
  if (host === 'localhost' || host.endsWith('.localhost')) return fail('INVALID_URL');

  return { ok: true, url: candidate };
}

/* ── Normalización canónica (RC-04) ──────────────────────────────── */

/**
 * Clave canónica de una URL (arquitectura §5.3.2, RC-04).
 *
 * Transformación exacta, en este orden:
 *   1. parsear (si falla → null: la validación previa ya lo rechaza)
 *   2. esquema forzado a `https:` (http/https equivalentes comparten clave)
 *   3. host en minúsculas, sin `www.` inicial
 *   4. path: se colapsa el vacío a `/` y se quita la barra final sobrante
 *      (los segmentos `.`/`..` los resuelve `URL`); el resto se conserva tal cual,
 *      porque el path SÍ distingue mayúsculas
 *   5. fragmento `#…` descartado
 *   6. parámetros de seguimiento descartados
 *   7. resto ordenado alfabéticamente por nombre y, a igual nombre, por valor
 *   8. `https://host + path + (?query)`, sin fragmento
 *
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;

  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

  let path = parsed.pathname || '/';
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (path === '') path = '/';

  const pairs = [];
  for (const [name, value] of parsed.searchParams.entries()) {
    if (isTrackingParam(name)) continue;
    pairs.push([name, value]);
  }
  pairs.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
    return 0;
  });

  const query = new URLSearchParams(pairs).toString();
  return `https://${host}${path}${query ? `?${query}` : ''}`;
}
