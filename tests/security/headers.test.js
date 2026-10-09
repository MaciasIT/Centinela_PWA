/**
 * T3b — Guardas de la CSP estricta y de las cabeceras de seguridad (HU-32).
 *
 * Cubre tres cosas:
 *  1. Que NINGÚN fichero HTML lleve manejadores `on*=` inline ni estilos
 *     inline (`style="…"` o `<style>`), porque ambos obligarían a
 *     `'unsafe-inline'` y anularían la CSP. Los detectores se prueban a sí
 *     mismos contra HTML mutado (prueba por mutación en el propio test).
 *  2. Que las cabeceras de Cloudflare Pages (`public/_headers`) lleven la CSP
 *     estricta de la arquitectura §8.6 (sin `'unsafe-inline'` en `script-src`)
 *     y el resto de cabeceras.
 *  3. Que el Worker lleve `camera=()` — NUNCA `camera=(self)` (RC-01): copiar
 *     la política de Pages al Worker es el error que la arquitectura advierte.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { parseHTML } from 'linkedom';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = here.replace(/tests[/\\]security[/\\]$/, '');
const read = (rel) => readFileSync(ROOT + rel, 'utf-8');

/* ── Detectores (exportados para reutilizarlos y para la prueba por mutación) ── */

/** Devuelve los atributos manejador inline (`onclick`, `onerror`, …) de un HTML. */
export function findInlineHandlers(html) {
  const { document } = parseHTML(html);
  const bad = [];
  for (const el of document.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes || [])) {
      if (/^on[a-z]+$/i.test(attr.name)) bad.push(`${el.localName}[${attr.name}]`);
    }
  }
  return bad;
}

/** Devuelve los estilos inline (atributos `style=` y elementos `<style>`) de un HTML. */
export function findInlineStyles(html) {
  const { document } = parseHTML(html);
  const bad = [];
  for (const el of document.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes || [])) {
      if (attr.name === 'style') bad.push(`${el.localName}[style]`);
    }
  }
  for (let i = 0; i < document.querySelectorAll('style').length; i++) bad.push('<style>');
  return bad;
}

/** Lee `public/_headers` como mapa nombre→valor (minúsculas). */
function readPagesHeaders() {
  const text = read('public/_headers');
  const map = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.+?)\s*$/);
    if (m) map[m[1].toLowerCase()] = m[2];
  }
  return map;
}

/** Trocea una CSP en directivas { nombre: [fuentes…] }. */
function cspDirectives(csp) {
  const out = {};
  for (const part of csp.split(';')) {
    const bits = part.trim().split(/\s+/).filter(Boolean);
    if (!bits.length) continue;
    out[bits[0].toLowerCase()] = bits.slice(1);
  }
  return out;
}

const results = [];
const asyncTests = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}
function okAsync(name, fn) {
  asyncTests.push(async () => {
    try { await fn(); results.push({ ok: true, name }); }
    catch (e) { results.push({ ok: false, name, error: String(e) }); }
  });
}

/* ── 1. Prueba por mutación de los propios detectores ──────────────────── */

ok('mutación: el detector de `on*=` SÍ ve un handler reintroducido', () => {
  const mutated = '<button id="x" onclick="pwn()">A</button><img onerror="pwn()">';
  const found = findInlineHandlers(mutated);
  if (found.length < 2) throw new Error('debería detectar onclick y onerror, detectó: ' + JSON.stringify(found));
});

ok('mutación: el detector de estilos inline SÍ ve `style=` y `<style>`', () => {
  const mutated = '<div style="display:none"></div><style>.a{color:red}</style>';
  const found = findInlineStyles(mutated);
  if (found.length < 2) throw new Error('debería detectar style= y <style>, detectó: ' + JSON.stringify(found));
});

/* ── 2. Los HTML del producto no contienen lo que rompe la CSP ─────────── */

for (const file of ['index.html', 'manual.html']) {
  ok(`${file}: sin manejadores on*= inline`, () => {
    const bad = findInlineHandlers(read(file));
    if (bad.length) throw new Error('atributos on*= que obligarían a \'unsafe-inline\': ' + bad.join(', '));
  });

  ok(`${file}: sin estilos inline (atributo style= ni <style>)`, () => {
    const bad = findInlineStyles(read(file));
    if (bad.length) throw new Error('estilos inline que obligarían a \'unsafe-inline\' en style-src: ' + bad.join(', '));
  });
}

/* ── 3. CSP estricta de Cloudflare Pages (`public/_headers`) ───────────── */

ok('Pages: public/_headers existe y declara Content-Security-Policy', () => {
  const h = readPagesHeaders();
  if (!h['content-security-policy']) throw new Error('falta la cabecera Content-Security-Policy');
});

const EXPECTED_DIRECTIVES = [
  'default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'connect-src',
  'worker-src', 'manifest-src', 'base-uri', 'form-action', 'frame-ancestors',
  'object-src', 'upgrade-insecure-requests',
];

ok('Pages: la CSP declara todas las directivas de la arquitectura §8.6', () => {
  const d = cspDirectives(readPagesHeaders()['content-security-policy'] || '');
  const missing = EXPECTED_DIRECTIVES.filter((n) => !(n in d));
  if (missing.length) throw new Error('directivas ausentes: ' + missing.join(', '));
});

ok("Pages: `script-src` NO contiene 'unsafe-inline' ni 'unsafe-eval'", () => {
  const d = cspDirectives(readPagesHeaders()['content-security-policy'] || '');
  const scriptSrc = d['script-src'] || [];
  for (const bad of ["'unsafe-inline'", 'unsafe-inline', "'unsafe-eval'", 'unsafe-eval', '*']) {
    if (scriptSrc.includes(bad)) throw new Error(`script-src contiene ${bad}`);
  }
  if (!scriptSrc.includes("'self'")) throw new Error("script-src debe incluir 'self'");
});

ok("Pages: `style-src` NO contiene 'unsafe-inline'", () => {
  const d = cspDirectives(readPagesHeaders()['content-security-policy'] || '');
  if ((d['style-src'] || []).some((s) => s.toLowerCase().includes('unsafe-inline'))) {
    throw new Error("style-src contiene 'unsafe-inline'");
  }
});

ok("Pages: `frame-ancestors 'none'` y `object-src 'none'`", () => {
  const d = cspDirectives(readPagesHeaders()['content-security-policy'] || '');
  if ((d['frame-ancestors'] || []).join(' ') !== "'none'") throw new Error('frame-ancestors debe ser \'none\'');
  if ((d['object-src'] || []).join(' ') !== "'none'") throw new Error('object-src debe ser \'none\'');
});

ok('Pages: `connect-src` incluye el Worker y no usa comodín global', () => {
  const d = cspDirectives(readPagesHeaders()['content-security-policy'] || '');
  const connect = (d['connect-src'] || []).join(' ');
  if (!/https:\/\/centinela-api[^ ;]*\.workers\.dev/.test(connect)) {
    throw new Error('connect-src no incluye una URL del Worker: ' + connect);
  }
  if ((d['connect-src'] || []).includes('*')) throw new Error("connect-src usa '*'");
});

ok("Pages: `Permissions-Policy` → camera=(self), geolocation=(), microphone=()", () => {
  const pp = readPagesHeaders()['permissions-policy'] || '';
  if (!/camera=\(self\)/.test(pp)) throw new Error('Pages debe permitir camera=(self) para el escáner QR (RC-01)');
  if (!/geolocation=\(\)/.test(pp)) throw new Error('geolocation debe denegarse');
  if (!/microphone=\(\)/.test(pp)) throw new Error('microphone debe denegarse');
});

ok('Pages: X-Content-Type-Options nosniff y Referrer-Policy no-referrer', () => {
  const h = readPagesHeaders();
  if (h['x-content-type-options'] !== 'nosniff') throw new Error('falta X-Content-Type-Options: nosniff');
  if (h['referrer-policy'] !== 'no-referrer') throw new Error('falta Referrer-Policy: no-referrer');
});

/* ── 4. Cabeceras del Worker (camera=() — NUNCA camera=(self)) ─────────── */

async function loadWorker() {
  const mod = await import('../../worker/src/index.js');
  if (!mod?.default?.fetch) throw new Error('el Worker no exporta default.fetch');
  return mod.default;
}
function makeReq(path) {
  return new Request(`https://centinela-api.michelmacias-it.workers.dev${path}`, {
    headers: { Origin: 'https://centinela-pwa.pages.dev' },
  });
}

okAsync('Worker: /health lleva las cabeceras de seguridad de §5.2', async () => {
  const worker = await loadWorker();
  const res = await worker.fetch(makeReq('/health'), {}, {});
  const need = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
  };
  for (const [name, value] of Object.entries(need)) {
    if (res.headers.get(name) !== value) throw new Error(`${name} debe ser «${value}», es «${res.headers.get(name)}»`);
  }
  if (!res.headers.get('permissions-policy')) throw new Error('falta Permissions-Policy en el Worker');
});

okAsync('Worker: Permissions-Policy usa camera=() y NUNCA camera=(self) (RC-01)', async () => {
  const worker = await loadWorker();
  const res = await worker.fetch(makeReq('/health'), {}, {});
  const pp = res.headers.get('permissions-policy') || '';
  if (/camera=\(self\)/.test(pp)) throw new Error('el Worker NO debe llevar camera=(self): ' + pp);
  if (!/camera=\(\)/.test(pp)) throw new Error('el Worker debe llevar camera=(): ' + pp);
  if (!/geolocation=\(\)/.test(pp) || !/microphone=\(\)/.test(pp)) throw new Error('geolocation/microphone deben denegarse: ' + pp);
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
