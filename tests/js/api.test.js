import { validateUrl, analyzeUrl } from '../../js/api.js';
import { normalizeUrl, withDefaultScheme } from '../../js/core/validation.js';
import { classify } from '../../js/core/verdict.js';

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

ok('validateUrl acepta http y https válidos', () => {
  const a = validateUrl('http://example.com');
  const b = validateUrl('https://example.com/path');
  if (!a.valid) throw new Error('http debería ser válido');
  if (!b.valid) throw new Error('https debería ser válido');
});

ok('validateUrl añade https cuando falta el esquema', () => {
  const r = validateUrl('example.com');
  if (!r.valid) throw new Error('debería aceptar host con https implícito');
  if (!r.url.startsWith('https://')) throw new Error('debería normalizar a https');
});

ok('validateUrl rechaza vacío', () => {
  const r = validateUrl('   ');
  if (r.valid) throw new Error('vacío no debería ser válido');
});

ok('validateUrl rechaza host sin dominio y localhost', () => {
  const r1 = validateUrl('http://localhost');
  const r2 = validateUrl('http://192.168.1.1');
  const r3 = validateUrl('notaurl');
  if (r1.valid) throw new Error('localhost no debería ser válido');
  if (r2.valid) throw new Error('privada no debería ser válido');
  if (r3.valid) throw new Error('URL sin host no debería ser válido');
});

ok('T3c: la entrada sin esquema se prepara a https y se canoniza (normalizador único)', () => {
  const prepared = withDefaultScheme('example.com');
  if (prepared !== 'https://example.com') throw new Error(`withDefaultScheme devolvió ${prepared}`);
  const r = normalizeUrl(prepared);
  if (r !== 'https://example.com/') throw new Error(`esperado https://example.com/, obtuve ${r}`);
});

ok('T3c/C-1: normalizeUrl PRESERVA el esquema explícito (no lo fuerza a https)', () => {
  const http = normalizeUrl('http://example.com');
  const https = normalizeUrl('https://example.com');
  if (http !== 'http://example.com/') throw new Error(`esperado http://example.com/, obtuve ${http}`);
  if (https !== 'https://example.com/') throw new Error(`esperado https://example.com/, obtuve ${https}`);
  if (http === https) throw new Error('http y https NO deben compartir clave: son recursos distintos');
});

/* ── HU-01: mensajes de validación en lenguaje llano ── */

ok('HU-01: campo vacío → "Pega primero un enlace"', () => {
  const r = validateUrl('   ');
  if (r.valid) throw new Error('no debería ser válido');
  if (!/pega primero un enlace/i.test(r.reason)) throw new Error(`reason: ${r.reason}`);
});

ok('HU-01: texto que no es un enlace → aviso llano con ejemplo', () => {
  const r = validateUrl('notaurl');
  if (r.valid) throw new Error('no debería ser válido');
  if (!/no parece un enlace web/i.test(r.reason)) throw new Error(`reason: ${r.reason}`);
  if (!/tu-banco\.es/.test(r.reason)) throw new Error('debería incluir un ejemplo de enlace válido');
});

ok('HU-01: dirección interna/privada → mensaje comprensible', () => {
  const r = validateUrl('http://localhost');
  if (r.valid) throw new Error('no debería ser válido');
  if (!/tu casa|tu propio ordenador/i.test(r.reason)) throw new Error(`reason: ${r.reason}`);
});

/* ── HU-09: sin reintentos automáticos en segundo plano ── */

okAsync('HU-09: analyzeUrl hace UNA sola consulta a /api/scan (sin reintentos silenciosos)', async () => {
  const originalFetch = globalThis.fetch;
  let scanCalls = 0;
  const queuedPayload = {
    data: { attributes: { status: 'queued', last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 } } },
  };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/local-check')) return { ok: true, json: async () => ({}) };
    if (u.includes('/api/scan')) { scanCalls += 1; return { ok: true, json: async () => queuedPayload }; }
    throw new Error(`fetch inesperado: ${u}`);
  };
  try {
    if (globalThis.localStorage) globalThis.localStorage.removeItem('centinela_cache');
    const result = await analyzeUrl(`https://sin-reintentos.example/${Date.now()}`);
    if (scanCalls !== 1) throw new Error(`esperaba 1 llamada a /api/scan, hubo ${scanCalls}`);
    // Sin datos (total 0) NO se degrada a "seguro": sigue siendo precaución.
    if (result.total !== 0) throw new Error(`total esperado 0, obtuve ${result.total}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/* ── T2c: el cliente propaga el recuento de timeout (veracidad del veredicto) ── */

okAsync('T2c: analyzeUrl propaga el timeout para no fingir veredicto cuando no hay datos', async () => {
  const originalFetch = globalThis.fetch;
  const payload = {
    data: { attributes: { status: 'completed', last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0, timeout: 5 } } },
  };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/local-check')) return { ok: true, json: async () => ({}) };
    if (u.includes('/api/scan')) return { ok: true, json: async () => payload };
    throw new Error(`fetch inesperado: ${u}`);
  };
  try {
    if (globalThis.localStorage) globalThis.localStorage.removeItem('centinela_cache');
    const result = await analyzeUrl(`https://todo-timeout.example/${Date.now()}`);
    if (result.timeout !== 5) throw new Error(`timeout esperado 5, obtuve ${result.timeout}`);
    if (result.total !== 5) throw new Error(`total esperado 5, obtuve ${result.total}`);
    const verdict = classify(result);
    if (verdict !== 'unchecked') throw new Error(`clasificación ${verdict}, esperado unchecked (no safe)`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

okAsync('T2c: un resultado sin datos (todo timeout) no se cachea, para que «volver a intentarlo» reconsulte', async () => {
  const originalFetch = globalThis.fetch;
  let scanCalls = 0;
  const payload = { data: { attributes: { status: 'completed', last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 0, undetected: 0, timeout: 5 } } } };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/local-check')) return { ok: true, json: async () => ({}) };
    if (u.includes('/api/scan')) { scanCalls += 1; return { ok: true, json: async () => payload }; }
    throw new Error(`fetch inesperado: ${u}`);
  };
  try {
    if (globalThis.localStorage) globalThis.localStorage.removeItem('centinela_cache');
    const url = `https://sin-cache.example/${Date.now()}`;
    await analyzeUrl(url);
    await analyzeUrl(url);
    if (scanCalls !== 2) throw new Error(`esperaba 2 consultas (no se cachea un resultado sin datos), hubo ${scanCalls}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/* ── T3a: una sola fuente y degradación honesta ── */

okAsync('T3a: la respuesta multi-fuente solo conserva VirusTotal (retiradas GSB y URLScan)', async () => {
  const originalFetch = globalThis.fetch;
  const payload = {
    results: [
      { source: 'virustotal', data: { data: { id: 'abc', attributes: { last_analysis_stats: { malicious: 0, suspicious: 2, harmless: 60, undetected: 8 }, last_analysis_date: 1790000000 } } } },
      { source: 'google_safebrowsing', data: { safe: false, threats: [{ threatType: 'MALWARE' }] } },
      { source: 'urlscan', data: { uuid: 'u-1', pending: true, resultUrl: 'https://urlscan.io/result/u-1/' } },
    ],
  };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/local-check')) return { ok: true, json: async () => ({}) };
    if (u.includes('/api/scan')) return { ok: true, status: 200, json: async () => payload };
    throw new Error(`fetch inesperado: ${u}`);
  };
  try {
    if (globalThis.localStorage) globalThis.localStorage.removeItem('centinela_cache');
    const result = await analyzeUrl(`https://una-fuente.example/${Date.now()}`);
    if (result.gsbSafe !== undefined || result.gsbThreats !== undefined) throw new Error('gsbSafe/gsbThreats deben haber desaparecido');
    if (result.urlscanUuid !== undefined || result.urlscanResultUrl !== undefined) throw new Error('los campos de URLScan deben haber desaparecido');
    if (JSON.stringify(result.sources) !== JSON.stringify(['virustotal'])) throw new Error(`sources=${JSON.stringify(result.sources)}`);
    if (result.suspicious !== 2) throw new Error(`suspicious esperado 2, obtuve ${result.suspicious}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

okAsync('T3a: 503 QUOTA_EXCEEDED se declara honestamente («no se ha podido comprobar»), sin detalle interno', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/local-check')) return { ok: true, json: async () => ({}) };
    if (u.includes('/api/scan')) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: { code: 'QUOTA_EXCEEDED', message: 'El servicio está muy solicitado ahora mismo, así que no se ha podido comprobar este enlace. Inténtalo dentro de un minuto.' } }),
      };
    }
    throw new Error(`fetch inesperado: ${u}`);
  };
  try {
    if (globalThis.localStorage) globalThis.localStorage.removeItem('centinela_cache');
    let captured = null;
    try {
      await analyzeUrl(`https://sin-cuota.example/${Date.now()}`);
    } catch (e) {
      captured = e.message;
    }
    if (!captured) throw new Error('debería lanzar error');
    if (!/no se ha podido comprobar/i.test(captured)) throw new Error(`mensaje poco honesto: ${captured}`);
    if (/QUOTA_EXCEEDED|503/.test(captured)) throw new Error(`fuga de detalle técnico: ${captured}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/* ── T3c: el cliente usa el normalizador ÚNICO compartido ── */

okAsync('T3c/C-3: analyzeUrl envía al Worker la URL canónica del normalizador compartido', async () => {
  const originalFetch = globalThis.fetch;
  const payload = {
    results: [
      { source: 'virustotal', data: { data: { id: 'x', attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 5, undetected: 0 }, last_analysis_date: 1790000000 } } } },
    ],
  };
  let scanBody = null;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/api/local-check')) return { ok: true, json: async () => ({}) };
    if (u.includes('/api/scan')) {
      scanBody = JSON.parse(init.body).url;
      return { ok: true, status: 200, json: async () => payload };
    }
    throw new Error(`fetch inesperado: ${u}`);
  };
  try {
    if (globalThis.localStorage) globalThis.localStorage.removeItem('centinela_cache');
    await analyzeUrl('https://WWW.Ejemplo.com/a/?utm_source=x&b=2&a=1#frag');
    if (scanBody !== 'https://ejemplo.com/a?a=1&b=2') throw new Error(`URL enviada: ${scanBody}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

export async function run() {
  for (const t of asyncTests) await t();
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}