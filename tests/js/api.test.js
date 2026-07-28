import { validateUrl, normalizeUrl } from '../../js/api.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
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
  if (r2.valid) throw new Error('privada no debería ser válida');
  if (r3.valid) throw new Error('URL sin host no debería ser válida');
});

ok('normalizeUrl añade https si falta', () => {
  const r = normalizeUrl('example.com');
  if (r !== 'https://example.com') throw new Error(`esperado https://example.com, obtuve ${r}`);
});

ok('normalizeUrl respeta http explícito', () => {
  const r = normalizeUrl('http://example.com');
  if (r !== 'http://example.com') throw new Error(`esperado http://example.com, obtuve ${r}`);
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, failed };
}
