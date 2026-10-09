/**
 * T3a — Tests de integración del Worker (seguridad sostenible).
 *
 * Ejercita el `fetch` real del Worker con un VirusTotal mockeado y con el
 * Durable Object `QuotaGuard` REAL (no una lógica simulada), para que lo que
 * se prueba sea el contador que se despliega.
 */
import worker, { QuotaGuard } from '../../worker/src/index.js';
import pkg from '../../package.json' with { type: 'json' };

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

const asyncTests = [];
function okAsync(name, fn) {
  asyncTests.push(async () => {
    try { await fn(); results.push({ ok: true, name }); }
    catch (e) { results.push({ ok: false, name, error: String(e) }); }
  });
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const ALLOWED = 'https://centinela-pwa.pages.dev';
const DENIED = 'https://sitio-ajeno.example';
const API = 'https://centinela-api.michelmacias-it.workers.dev';

const VT_FIXTURE = {
  data: {
    id: 'abc123',
    type: 'url',
    attributes: {
      last_analysis_stats: { malicious: 0, suspicious: 2, harmless: 60, undetected: 8, timeout: 0 },
      last_analysis_results: { AlgunAV: { category: 'suspicious', result: 'phishing' } },
      last_analysis_date: 1790000000,
      title: 'Ejemplo',
    },
    links: { self: 'https://www.virustotal.com/api/v3/urls/abc123' },
  },
};

function makeRequest(method, path, body, origin = ALLOWED) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

/** Durable Object real sobre un storage en memoria (contador exacto de verdad). */
function makeQuotaNamespace() {
  const store = new Map();
  const ctx = { storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); } } };
  const guard = new QuotaGuard(ctx, {});
  const seen = { fetches: 0, name: null };
  return {
    namespace: {
      idFromName: (n) => { seen.name = n; return n; },
      get: () => ({ fetch: async (req) => { seen.fetches += 1; return guard.fetch(req); } }),
    },
    seen,
  };
}

function makeLimiter(max) {
  const state = { calls: 0 };
  return {
    binding: { limit: async () => { state.calls += 1; return { success: state.calls <= max }; } },
    state,
  };
}

function makeEnv(over = {}) {
  const quota = makeQuotaNamespace();
  const limiter = makeLimiter(1000);
  return {
    env: {
      VIRUSTOTAL_API_KEY: 'clave-de-prueba',
      ALLOWED_ORIGINS: ALLOWED,
      QUOTA_GUARD: quota.namespace,
      SCAN_RATE_LIMITER: limiter.binding,
      ...over,
    },
    quota,
    limiter,
  };
}

/** Sustituye el fetch global por un VirusTotal mockeado; devuelve lo observado. */
async function withVtMock(fn, { status = 200, body = VT_FIXTURE, throwNetwork = false } = {}) {
  const originalFetch = globalThis.fetch;
  const seen = { urls: [] };
  globalThis.fetch = async (input, init) => {
    const u = String(input);
    seen.urls.push(u);
    if (!u.startsWith('https://www.virustotal.com')) throw new Error(`fetch inesperado: ${u}`);
    if (throwNetwork) throw new Error('socket roto en el proveedor');
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  try {
    return await fn(seen);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function decodeB64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}

/* ── CORS real (HU-30, NFR-S4) ───────────────────────────────────── */

okAsync('OPTIONS desde origen permitido → 204 con ACAO exacto y Vary: Origin', async () => {
  const { env } = makeEnv();
  const res = await worker.fetch(makeRequest('OPTIONS', '/api/scan'), env, {});
  assert(res.status === 204, `status ${res.status}`);
  assert(res.headers.get('Access-Control-Allow-Origin') === ALLOWED, 'ACAO incorrecto');
  assert((res.headers.get('Vary') || '').includes('Origin'), 'falta Vary: Origin');
});

okAsync('OPTIONS desde origen NO permitido → 403 y sin cabeceras CORS', async () => {
  const { env } = makeEnv();
  const res = await worker.fetch(makeRequest('OPTIONS', '/api/scan', undefined, DENIED), env, {});
  assert(res.status === 403, `status ${res.status}`);
  assert(!res.headers.get('Access-Control-Allow-Origin'), 'no debe haber ACAO');
});

okAsync('POST /api/scan desde origen NO permitido → 403 FORBIDDEN_ORIGIN sin llamar a VT', async () => {
  const { env } = makeEnv();
  await withVtMock(async (seen) => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com' }, DENIED), env, {});
    assert(res.status === 403, `status ${res.status}`);
    const data = await res.json();
    assert(data.error.code === 'FORBIDDEN_ORIGIN', `código ${data.error.code}`);
    assert(seen.urls.length === 0, 'no debe llamarse a VirusTotal');
  });
});

okAsync('el CORS no es «*»: no se emite ACAO comodín en ninguna respuesta', async () => {
  const { env } = makeEnv();
  const res = await worker.fetch(makeRequest('GET', '/health'), env, {});
  assert(res.headers.get('Access-Control-Allow-Origin') !== '*', 'ACAO comodín prohibido');
  assert(res.headers.get('Access-Control-Allow-Origin') === ALLOWED, 'ACAO debería ser el origen exacto');
});

/* ── Cabeceras de seguridad (HU-32, NFR-S7) ──────────────────────── */

okAsync('todas las respuestas llevan las cabeceras de seguridad del Worker', async () => {
  const { env } = makeEnv();
  const res = await worker.fetch(makeRequest('GET', '/health'), env, {});
  assert(res.headers.get('X-Content-Type-Options') === 'nosniff', 'falta nosniff');
  assert(res.headers.get('Referrer-Policy') === 'no-referrer', 'falta Referrer-Policy');
  assert(res.headers.get('Permissions-Policy') === 'geolocation=(), microphone=(), camera=()', 'Permissions-Policy incorrecta');
  assert(res.headers.get('Cache-Control') === 'no-store', 'falta Cache-Control: no-store');
});

/* ── /health ─────────────────────────────────────────────────────── */

okAsync('GET /health → 200 con la versión única de package.json', async () => {
  const { env } = makeEnv();
  const res = await worker.fetch(makeRequest('GET', '/health'), env, {});
  assert(res.status === 200, `status ${res.status}`);
  const data = await res.json();
  assert(data.status === 'ok', 'status no es ok');
  assert(data.version === pkg.version, `versión ${data.version} vs ${pkg.version}`);
});

/* ── Validación antes de gastar cuota (HU-31, NFR-S1) ────────────── */

okAsync('Content-Type no JSON → 415 sin llamar a VT', async () => {
  const { env } = makeEnv();
  await withVtMock(async (seen) => {
    const req = new Request(`${API}/api/scan`, {
      method: 'POST',
      headers: { Origin: ALLOWED, 'Content-Type': 'text/plain' },
      body: 'hola',
    });
    const res = await worker.fetch(req, env, {});
    assert(res.status === 415, `status ${res.status}`);
    assert(seen.urls.length === 0, 'no debe llamarse a VT');
  });
});

okAsync('cuerpo > 8 KB → 413 sin llamar a VT', async () => {
  const { env } = makeEnv();
  await withVtMock(async (seen) => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com', relleno: 'x'.repeat(9000) }), env, {});
    assert(res.status === 413, `status ${res.status}`);
    assert(seen.urls.length === 0, 'no debe llamarse a VT');
  });
});

okAsync('JSON inválido → 400 INVALID_JSON sin llamar a VT', async () => {
  const { env } = makeEnv();
  await withVtMock(async (seen) => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', '{no es json'), env, {});
    assert(res.status === 400, `status ${res.status}`);
    const data = await res.json();
    assert(data.error.code === 'INVALID_JSON', `código ${data.error.code}`);
    assert(seen.urls.length === 0, 'no debe llamarse a VT');
  });
});

okAsync('esquema no http(s) → 400 INVALID_URL sin llamar a VT', async () => {
  const { env } = makeEnv();
  await withVtMock(async (seen) => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'ftp://ejemplo.com/x' }), env, {});
    assert(res.status === 400, `status ${res.status}`);
    const data = await res.json();
    assert(data.error.code === 'INVALID_URL', `código ${data.error.code}`);
    assert(seen.urls.length === 0, 'no debe llamarse a VT');
  });
});

okAsync('URL > 2048 → 414 URL_TOO_LONG sin llamar a VT', async () => {
  const { env } = makeEnv();
  await withVtMock(async (seen) => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com/' + 'a'.repeat(2100) }), env, {});
    assert(res.status === 414, `status ${res.status}`);
    const data = await res.json();
    assert(data.error.code === 'URL_TOO_LONG', `código ${data.error.code}`);
    assert(seen.urls.length === 0, 'no debe llamarse a VT');
  });
});

okAsync('IP privada / localhost → 400 INVALID_URL sin llamar a VT', async () => {
  const { env } = makeEnv();
  await withVtMock(async (seen) => {
    for (const u of ['http://localhost:5173', 'http://192.168.1.5', 'http://127.0.0.1']) {
      const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: u }), env, {});
      assert(res.status === 400, `${u}: status ${res.status}`);
    }
    assert(seen.urls.length === 0, 'no debe llamarse a VT');
  });
});

/* ── Una sola fuente: VirusTotal (decisión 1A) ───────────────────── */

okAsync('la respuesta declara una sola fuente y NO contiene ramas multi-fuente', async () => {
  const { env } = makeEnv();
  await withVtMock(async () => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com/x' }), env, {});
    assert(res.status === 200, `status ${res.status}`);
    const raw = await res.text();
    for (const forbidden of ['google_safebrowsing', 'gsb', 'urlscan', 'URLScan', 'Safe Browsing']) {
      assert(!raw.includes(forbidden), `la respuesta no debe mencionar «${forbidden}»`);
    }
    const data = JSON.parse(raw);
    assert(Array.isArray(data.results), 'results debe ser un array');
    assert(data.results.length === 1, `results debe tener 1 fuente, tiene ${data.results.length}`);
    assert(data.results[0].source === 'virustotal', `fuente ${data.results[0].source}`);
    assert(data.source === 'virustotal', 'campo source superior');
  });
});

okAsync('la URL se normaliza antes de consultar (RC-04: sin parámetros de seguimiento)', async () => {
  const { env } = makeEnv();
  await withVtMock(async (seen) => {
    const res = await worker.fetch(
      makeRequest('POST', '/api/scan', { url: 'https://www.ejemplo.com/a/?utm_source=x&b=2&a=1#frag' }),
      env,
      {}
    );
    assert(res.status === 200, `status ${res.status}`);
    const encoded = seen.urls[0].split('/urls/')[1];
    const sent = decodeB64Url(encoded);
    assert(sent === 'https://ejemplo.com/a?a=1&b=2', `URL enviada a VT: ${sent}`);
  });
});

/* ── Freno de inundación por IP (binding) → 429 ──────────────────── */

okAsync('binding por IP excedido → 429 RATE_LIMITED antes de llamar a VT', async () => {
  const quota = makeQuotaNamespace();
  const limiter = makeLimiter(0);
  const env = {
    VIRUSTOTAL_API_KEY: 'k', ALLOWED_ORIGINS: ALLOWED,
    QUOTA_GUARD: quota.namespace, SCAN_RATE_LIMITER: limiter.binding,
  };
  await withVtMock(async (seen) => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com' }), env, {});
    assert(res.status === 429, `status ${res.status}`);
    const data = await res.json();
    assert(data.error.code === 'RATE_LIMITED', `código ${data.error.code}`);
    assert(seen.urls.length === 0, 'no debe llamarse a VT');
    assert(quota.seen.fetches === 0, 'no debe consumirse token de cuota si el freno por IP ya cortó');
  });
});

/* ── Techo global exacto (DO QuotaGuard) → 503 ───────────────────── */

okAsync('5ª petición en el mismo minuto → 503 QUOTA_EXCEEDED con Retry-After, sin llamar a VT', async () => {
  const { env, quota } = makeEnv();
  await withVtMock(async (seen) => {
    const statuses = [];
    for (let i = 0; i < 5; i++) {
      const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: `https://ejemplo.com/${i}` }), env, {});
      statuses.push(res.status);
      if (i === 4) {
        const data = await res.json();
        assert(data.error.code === 'QUOTA_EXCEEDED', `código ${data.error.code}`);
        assert(res.headers.get('Retry-After'), 'falta Retry-After');
      }
    }
    assert(JSON.stringify(statuses) === JSON.stringify([200, 200, 200, 200, 503]), `statuses ${JSON.stringify(statuses)}`);
    assert(seen.urls.length === 4, `VT debe llamarse 4 veces, se llamó ${seen.urls.length}`);
    assert(quota.seen.fetches === 5, 'el DO debe contar las 5 peticiones (la 5ª denegada)');
  });
});

okAsync('el DO se usa con la instancia global única «vt-quota»', async () => {
  const { env, quota } = makeEnv();
  await withVtMock(async () => {
    await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com' }), env, {});
  });
  assert(quota.seen.name === 'vt-quota', `instancia ${quota.seen.name}, esperada vt-quota`);
});

/* ── Mapeo de errores del proveedor (NFR-R2, NFR-S2) ─────────────── */

okAsync('VirusTotal responde 429 → 503 QUOTA_EXCEEDED (no se filtra el error crudo)', async () => {
  const { env } = makeEnv();
  await withVtMock(async () => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com' }), env, {});
    assert(res.status === 503, `status ${res.status}`);
    const raw = await res.text();
    const data = JSON.parse(raw);
    assert(data.error.code === 'QUOTA_EXCEEDED', `código ${data.error.code}`);
    assert(!/429/.test(raw), 'no debe filtrarse el código del proveedor');
  }, { status: 429, body: { error: { code: 'QuotaExceededError', message: 'Quota exceeded' } } });
});

okAsync('VirusTotal caído (500) → 502 UPSTREAM_UNAVAILABLE con mensaje llano', async () => {
  const { env } = makeEnv();
  await withVtMock(async () => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com' }), env, {});
    assert(res.status === 502, `status ${res.status}`);
    const raw = await res.text();
    const data = JSON.parse(raw);
    assert(data.error.code === 'UPSTREAM_UNAVAILABLE', `código ${data.error.code}`);
    assert(!/VT failed|500|upstream body/i.test(raw), `se filtra detalle interno: ${raw}`);
  }, { status: 500, body: { error: 'boom' } });
});

okAsync('fallo de red hacia VirusTotal → 502 sin filtrar el mensaje interno', async () => {
  const { env } = makeEnv();
  await withVtMock(async () => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com' }), env, {});
    assert(res.status === 502, `status ${res.status}`);
    const raw = await res.text();
    assert(!raw.includes('socket roto'), `se filtra el error interno: ${raw}`);
  }, { throwNetwork: true });
});

okAsync('sin clave de VirusTotal → 502 UPSTREAM_UNAVAILABLE (nunca un veredicto falso)', async () => {
  const quota = makeQuotaNamespace();
  const env = { ALLOWED_ORIGINS: ALLOWED, QUOTA_GUARD: quota.namespace, SCAN_RATE_LIMITER: makeLimiter(10).binding };
  const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com' }), env, {});
  assert(res.status === 502, `status ${res.status}`);
  const data = await res.json();
  assert(data.error.code === 'UPSTREAM_UNAVAILABLE', `código ${data.error.code}`);
});

/* ── Rutas desconocidas ──────────────────────────────────────────── */

okAsync('ruta desconocida → 404', async () => {
  const { env } = makeEnv();
  const res = await worker.fetch(makeRequest('GET', '/unknown'), env, {});
  assert(res.status === 404, `status ${res.status}`);
});

/* ── Sin binding del DO: no se bloquea la app (el gate está en CI) ── */

okAsync('sin binding QUOTA_GUARD el Worker sigue sirviendo (gate en CI, no en runtime)', async () => {
  const env = { VIRUSTOTAL_API_KEY: 'k', ALLOWED_ORIGINS: ALLOWED, SCAN_RATE_LIMITER: makeLimiter(10).binding };
  await withVtMock(async () => {
    const res = await worker.fetch(makeRequest('POST', '/api/scan', { url: 'https://ejemplo.com' }), env, {});
    assert(res.status === 200, `status ${res.status}`);
  });
});

export async function run() {
  for (const t of asyncTests) await t();
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    tests: results.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}
