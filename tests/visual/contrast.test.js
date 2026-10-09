/**
 * Tanda 5a — Contraste del veredicto (WCAG 2.1 AA).
 *
 * Mide el contraste de cada color de veredicto (verde/ámbar/rojo) contra el
 * fondo de la página y contra su propio fondo teñido, en el tema claro y en el
 * oscuro. Falla si alguno baja de 4,5:1 (texto AA). Los valores se leen del
 * propio `css/styles.css`, no se repiten a mano: si alguien cambia un token por
 * uno de bajo contraste, este test lo caza.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = here.replace(/tests[/\\]visual[/\\]$/, '');
const css = readFileSync(ROOT + 'css/styles.css', 'utf-8');

/** Extrae las declaraciones de un bloque CSS cuya cabecera casa con `re`. */
function readBlock(re) {
  const m = css.match(re);
  if (!m) throw new Error('no se encontró el bloque CSS: ' + re);
  const start = m.index + m[0].length;
  const end = css.indexOf('}', start);
  const body = css.slice(start, end);
  const out = {};
  for (const decl of body.split(';')) {
    const mm = decl.match(/(--[a-z0-9-]+)\s*:\s*(.+)/i);
    if (mm) out[mm[1]] = mm[2].trim();
  }
  return out;
}

const light = readBlock(/:root\s*\{/);
const dark = readBlock(/:root\[data-theme="dark"\]\s*\{/);

const toRgb = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const chan = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
};
const contrast = (a, b) => {
  const la = luminance(a); const lb = luminance(b);
  const hi = Math.max(la, lb); const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
};

const VERDICTS = [
  ['safe', '--color-safe', '--color-safe-bg'],
  ['warning', '--color-warning', '--color-warning-bg'],
  ['danger', '--color-danger', '--color-danger-bg'],
];

const results = [];
const ok = (name, fn) => {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
};

for (const [themeName, tokens] of [['claro', light], ['oscuro', dark]]) {
  for (const [verdict, fg, bg] of VERDICTS) {
    ok(`contraste ${themeName}: ${verdict} sobre el fondo de página (>= 4.5:1)`, () => {
      if (!tokens[fg] || !tokens['--bg-primary']) throw new Error(`faltan tokens (${fg} o --bg-primary)`);
      const r = contrast(tokens[fg], tokens['--bg-primary']);
      if (r < 4.5) throw new Error(`${tokens[fg]} sobre ${tokens['--bg-primary']} = ${r.toFixed(2)}:1 (mínimo 4.5:1)`);
    });
    ok(`contraste ${themeName}: ${verdict} sobre su fondo teñido (>= 4.5:1)`, () => {
      if (!tokens[fg] || !tokens[bg]) throw new Error(`faltan tokens (${fg} o ${bg})`);
      const r = contrast(tokens[fg], tokens[bg]);
      if (r < 4.5) throw new Error(`${tokens[fg]} sobre ${tokens[bg]} = ${r.toFixed(2)}:1 (mínimo 4.5:1)`);
    });
  }
}

export async function run() {
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    tests: results.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}
