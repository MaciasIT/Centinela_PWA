/**
 * T3a — Tests de contrato de validación y normalización de URL (HU-31, RC-04).
 *
 * RED primero: este fichero se escribió antes que worker/src/validation.js.
 * Fija la tabla canónica de la arquitectura §5.3.2 (normalizeUrl) y §5.2
 * (validación antes de gastar cuota de VirusTotal).
 */
import {
  validateUrl,
  normalizeUrl,
  isTrackingParam,
  MAX_URL_LENGTH,
  MAX_BODY_BYTES,
} from '../../worker/src/validation.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* ── validateUrl ─────────────────────────────────────────────────── */

ok('validateUrl acepta http y https', () => {
  assert(validateUrl('http://ejemplo.com').ok, 'http debería ser válido');
  assert(validateUrl('https://ejemplo.com/x?y=1').ok, 'https debería ser válido');
});

ok('validateUrl rechaza vacío / no-string', () => {
  assert(!validateUrl('').ok, 'cadena vacía no debería ser válida');
  assert(!validateUrl('   ').ok, 'espacios no debería ser válido');
  assert(!validateUrl(undefined).ok, 'undefined no debería ser válido');
  assert(!validateUrl(null).ok, 'null no debería ser válido');
  assert(!validateUrl({ url: 'x' }).ok, 'objeto no debería ser válido');
  assert(validateUrl('').code === 'INVALID_URL', 'código esperado INVALID_URL');
});

ok('validateUrl rechaza esquemas distintos de http/https', () => {
  for (const bad of ['ftp://ejemplo.com', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x']) {
    const r = validateUrl(bad);
    assert(!r.ok, `${bad} no debería ser válido`);
    assert(r.code === 'INVALID_URL', `${bad}: código ${r.code}, esperado INVALID_URL`);
  }
});

ok('validateUrl rechaza longitud > MAX_URL_LENGTH con URL_TOO_LONG', () => {
  const long = 'https://ejemplo.com/' + 'a'.repeat(MAX_URL_LENGTH);
  const r = validateUrl(long);
  assert(!r.ok, 'URL larguísima no debería ser válida');
  assert(r.code === 'URL_TOO_LONG', `código ${r.code}, esperado URL_TOO_LONG`);
  assert(MAX_URL_LENGTH === 2048, 'el límite debe ser 2048 (HU-31 AC-02)');
});

ok('validateUrl rechaza host sin punto, localhost y direcciones internas', () => {
  const bad = [
    'http://localhost',
    'http://localhost:8787/api',
    'http://127.0.0.1',
    'http://0.0.0.0',
    'http://10.0.0.5',
    'http://192.168.1.10',
    'http://172.16.4.4',
    'http://[::1]/',
    'http://sinpunto',
  ];
  for (const u of bad) {
    const r = validateUrl(u);
    assert(!r.ok, `${u} no debería ser válido`);
    assert(r.code === 'INVALID_URL', `${u}: código ${r.code}`);
  }
});

ok('validateUrl devuelve la URL tal cual (sin reescribir el esquema)', () => {
  const r = validateUrl('http://ejemplo.com/a');
  assert(r.ok, 'debería ser válida');
  assert(r.url === 'http://ejemplo.com/a', `url devuelta ${r.url}`);
});

/* ── normalizeUrl (RC-04) ────────────────────────────────────────── */

ok('RC-04: pares equivalentes producen la MISMA clave', () => {
  const a = normalizeUrl('https://WWW.Ejemplo.com/a/?utm_source=x&b=2&a=1#frag');
  const b = normalizeUrl('https://ejemplo.com/a?a=1&b=2');
  assert(a === 'https://ejemplo.com/a?a=1&b=2', `normalizado ${a}`);
  assert(a === b, `no coinciden: ${a} vs ${b}`);
});

ok('RC-04: http y https equivalentes comparten clave (esquema forzado)', () => {
  assert(
    normalizeUrl('http://ejemplo.com') === normalizeUrl('https://ejemplo.com'),
    'http y https deben normalizar al mismo valor'
  );
});

ok('RC-04: se descartan los parámetros de seguimiento', () => {
  for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_eid', 'mc_cid', 'igshid', 'si',
    'srsltid', '_ga', '_gl', 'ref', 'yclid', 'twclid', 'mkt_tok']) {
    assert(isTrackingParam(p), `${p} debería ser considerado tracking`);
  }
  const n = normalizeUrl('https://ejemplo.com/x?fbclid=1&gclid=2&msclkid=3&utm_source=z&real=1');
  assert(n === 'https://ejemplo.com/x?real=1', `normalizado ${n}`);
});

ok('RC-04: pares distintos producen claves distintas', () => {
  assert(normalizeUrl('https://ejemplo.com/a') !== normalizeUrl('https://ejemplo.com/A'), '/a vs /A deben diferir');
  assert(normalizeUrl('https://ejemplo.com/?a=1') !== normalizeUrl('https://ejemplo.com/?a=2'), '?a=1 vs ?a=2 deben diferir');
  assert(normalizeUrl('https://ejemplo.com/a') !== normalizeUrl('https://ejemplo.com/b'), '/a vs /b deben diferir');
});

ok('RC-04: se descarta el fragmento y la barra final sobrante', () => {
  assert(normalizeUrl('https://ejemplo.com/a/#x') === 'https://ejemplo.com/a', 'fragmento y barra final');
  assert(normalizeUrl('https://ejemplo.com/') === 'https://ejemplo.com/', 'la raíz conserva su barra');
  assert(normalizeUrl('https://ejemplo.com') === 'https://ejemplo.com/', 'host sin path → raíz');
});

ok('RC-04: normalizeUrl devuelve null si la URL no es parseable o no es http(s)', () => {
  assert(normalizeUrl('no-es-una-url') === null, 'texto suelto → null');
  assert(normalizeUrl('ftp://ejemplo.com') === null, 'ftp → null');
  assert(normalizeUrl('') === null, 'vacío → null');
});

ok('RC-04: el orden de los parámetros no altera la clave', () => {
  assert(
    normalizeUrl('https://ejemplo.com/?b=2&a=1') === normalizeUrl('https://ejemplo.com/?a=1&b=2'),
    'el orden no debe alterar la clave'
  );
});

/* ── constantes de cuerpo ────────────────────────────────────────── */

ok('el límite de cuerpo del POST /api/scan es 8 KB', () => {
  assert(MAX_BODY_BYTES === 8 * 1024, `MAX_BODY_BYTES=${MAX_BODY_BYTES}`);
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    tests: results.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}
