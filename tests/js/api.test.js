import { validateUrl, normalizeUrl, analyzeUrl } from '../../js/api.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

const asyncTests = [];
function okAsync(name, fn) {
  asyncTests.push((async () => {
    try { await fn(); results.push({ ok: true, name }); }
    catch (e) { results.push({ ok: false, name, error: String(e) }); }
  })());
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

ok('normalizeUrl añade https si falta', () => {
  const r = normalizeUrl('example.com');
  if (r !== 'https://example.com') throw new Error(`esperado https://example.com, obtuve ${r}`);
});

ok('normalizeUrl respeta http explícito', () => {
  const r = normalizeUrl('http://example.com');
  if (r !== 'http://example.com') throw new Error(`esperado http://example.com, obtuve ${r}`);
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

export async function run() {
  await Promise.all(asyncTests);
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}