/**
 * Tanda 5a — Tipografía autoalojada y CSP estricta (cierre de RC-02).
 *
 * Verifica que:
 *  1. `index.html` no carga NINGÚN recurso externo de fuentes (nada de
 *     fonts.googleapis.com ni fonts.gstatic.com, ni preconnect a terceros).
 *  2. La CSP de `public/_headers` deja `style-src` y `font-src` en `'self'`,
 *     sin mencionar Google.
 *  3. Las fuentes autoalojadas existen en disco (woff2 + su licencia OFL).
 */
import { readFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = here.replace(/tests[/\\]visual[/\\]$/, '');
const read = (rel) => readFileSync(ROOT + rel, 'utf-8');

const indexHtml = read('index.html');
const headers = read('public/_headers');
const sw = read('sw.js');

function cspDirectives(csp) {
  const out = {};
  for (const part of csp.split(';')) {
    const bits = part.trim().split(/\s+/).filter(Boolean);
    if (!bits.length) continue;
    out[bits[0].toLowerCase()] = bits.slice(1);
  }
  return out;
}
const pagesCsp = (() => {
  const m = headers.match(/^\s*Content-Security-Policy\s*:\s*(.+)$/m);
  return m ? m[1] : '';
})();

const results = [];
const ok = (name, fn) => {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
};

/* 1. index.html sin recursos externos de fuentes */
ok('index.html no menciona fonts.googleapis.com ni fonts.gstatic.com', () => {
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(indexHtml)) {
    throw new Error('index.html todavía carga fuentes de Google');
  }
});
ok('index.html no tiene <link rel="preconnect"> a terceros', () => {
  const bad = [...indexHtml.matchAll(/<link[^>]*rel=["']preconnect["'][^>]*>/gi)].map((m) => m[0]);
  if (bad.length) throw new Error('preconnect a terceros: ' + bad.join(' | '));
});
ok('index.html no carga ningún <link rel="stylesheet"> externo (http)', () => {
  const bad = [...indexHtml.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']https?:/gi)].map((m) => m[0]);
  if (bad.length) throw new Error('hoja de estilos externa: ' + bad.join(' | '));
});

/* 2. CSP de Pages */
ok("Pages: `style-src` es exactamente 'self' (sin Google)", () => {
  const d = cspDirectives(pagesCsp);
  if ((d['style-src'] || []).join(' ') !== "'self'") {
    throw new Error("style-src debe ser 'self', es: " + (d['style-src'] || []).join(' '));
  }
});
ok("Pages: `font-src` es exactamente 'self' (sin Google)", () => {
  const d = cspDirectives(pagesCsp);
  if ((d['font-src'] || []).join(' ') !== "'self'") {
    throw new Error("font-src debe ser 'self', es: " + (d['font-src'] || []).join(' '));
  }
});
ok('Pages: la CSP no menciona Google', () => {
  if (/googleapis|gstatic|google/i.test(pagesCsp)) throw new Error('la CSP menciona Google: ' + pagesCsp);
});

/* 3. sw.js no cachea fuentes de Google */
ok('sw.js no enruta fuentes de Google', () => {
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com|google-fonts/i.test(sw)) {
    throw new Error('sw.js todavía referencia las fuentes de Google');
  }
});

/* 4. Fuentes en disco */
const FONT_FILES = [
  'assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  'assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'assets/fonts/nunito-latin-700-normal.woff2',
  'assets/fonts/nunito-latin-800-normal.woff2',
  'assets/fonts/atkinson-hyperlegible-OFL.txt',
  'assets/fonts/nunito-OFL.txt',
];
for (const rel of FONT_FILES) {
  ok(`existe la fuente ${rel}`, () => {
    if (!existsSync(ROOT + rel)) throw new Error('falta ' + rel);
    if (statSync(ROOT + rel).size === 0) throw new Error('vacío: ' + rel);
  });
}

export async function run() {
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    tests: results.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}
