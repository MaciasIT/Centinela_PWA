/**
 * Tanda 5b — Contrato duro de la identidad «Amable» aplicada a las pantallas.
 *
 * Recoge, en forma de aserciones, las reglas NO negociables del brief que se
 * pueden comprobar sin navegador:
 *  1. Cero guion largo (—) en el texto visible de las pantallas HTML.
 *  2. Cero «cristal esmerilado» (backdrop-filter) en los estilos.
 *  3. Ningún texto esencial por debajo de 18 px: --fs-sm >= 1.125rem.
 *  4. Objetivos táctiles: acciones principales a 72 px, todo botón a 44 px.
 *  5. Los tres veredictos se comunican con FORMA propia (visto / triángulo /
 *     octágono), no solo color: el módulo verdict-shape debe dar una forma
 *     DISTINTA para cada estado, de modo que en escala de grises no se
 *     confundan.
 *  6. Los tres pasos de «¿Qué hago ahora?» están a la vista (la sección no
 *     nace oculta en el HTML).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { parseHTML } from 'linkedom';
import { verdictShapeSvg, verdictShape } from '../../js/screens/verdict-shape.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = here.replace(/tests[/\\]visual[/\\]$/, '');
const read = (rel) => readFileSync(ROOT + rel, 'utf-8');

const indexHtml = read('index.html');
const manualHtml = read('manual.html');
const styles = read('css/styles.css');

const results = [];
const ok = (name, fn) => {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
};

/* 1. Cero guion largo en texto visible. */
for (const [name, html] of [['index.html', indexHtml], ['manual.html', manualHtml]]) {
  ok(`${name}: cero guion largo (—) en el texto visible`, () => {
    if (html.includes('\u2014')) throw new Error('contiene guion largo (—): ' + name);
  });
}

/* 2. Cero cristal esmerilado. */
ok('css/styles.css: sin backdrop-filter (nada de cristal esmerilado)', () => {
  if (/backdrop-filter/i.test(styles)) throw new Error('todavía usa backdrop-filter');
});

/* 3. Texto esencial >= 18 px. */
const fsSm = (() => {
  const m = styles.match(/--fs-sm\s*:\s*([0-9.]+)rem/);
  return m ? parseFloat(m[1]) : NaN;
})();
ok('--fs-sm >= 1.125rem (18 px): ningún texto esencial por debajo', () => {
  if (!(fsSm >= 1.125)) throw new Error(`--fs-sm es ${fsSm}rem, debe ser >= 1.125rem (18px)`);
});

/* 4. Objetivos táctiles. */
ok('.btn-xl declara 72 px de alto (acciones principales)', () => {
  const m = styles.match(/\.btn-xl\s*\{[^}]*min-height\s*:\s*72px/s);
  if (!m) throw new Error('.btn-xl no fija min-height: 72px');
});
ok('.btn declara 44 px de alto (mínimo táctil)', () => {
  const m = styles.match(/\.btn\s*\{[^}]*min-height\s*:\s*44px/s);
  if (!m) throw new Error('.btn no fija min-height: 44px');
});

/* 5. Forma propia por veredicto. */
ok('verdict-shape: cada veredicto tiene una forma DISTINTA (no solo color)', () => {
  const keys = ['safe', 'warning', 'danger', 'unchecked'];
  const shapes = keys.map((k) => verdictShape(k));
  const unique = new Set(shapes);
  if (unique.size < 4) throw new Error('hay veredictos que comparten forma: ' + JSON.stringify(shapes));
});
ok('verdict-shape: el SVG dibuja geometría distinta por veredicto', () => {
  const safe = verdictShapeSvg('safe');
  const warn = verdictShapeSvg('warning');
  const danger = verdictShapeSvg('danger');
  if (!/<svg/i.test(safe) || !/<svg/i.test(warn) || !/<svg/i.test(danger)) throw new Error('algún veredicto no devuelve SVG');
  if (safe === warn || warn === danger || safe === danger) throw new Error('los SVG no se distinguen entre sí');
});

/* 6. Los pasos del «qué hago ahora» están a la vista. */
ok('index.html: la sección de pasos (#result-what-now) no nace oculta', () => {
  const { document } = parseHTML(indexHtml);
  const section = document.getElementById('result-what-now');
  if (!section) throw new Error('falta #result-what-now');
  if (section.hasAttribute('hidden')) throw new Error('#result-what-now nace con hidden: los pasos deben estar a la vista');
  if (!document.getElementById('result-what-now-steps')) throw new Error('falta #result-what-now-steps');
});

export async function run() {
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    tests: results.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}