/**
 * Tanda 5a — Un sistema único de tokens.
 *
 * Criterio de terminado del brief: ningún `var(--token)` apunta a un token que
 * no exista. Este test recoge todos los tokens definidos en los CSS del
 * proyecto y todos los referenciados, y falla si alguno referenciado no está
 * definido. También fija la escala tipográfica (cuerpo 20 px, interlineado
 * 1,5–1,75).
 */
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = here.replace(/tests[/\\]visual[/\\]$/, '');

const cssDir = ROOT + 'css';
const cssFiles = readdirSync(cssDir).filter((f) => f.endsWith('.css'));
const css = cssFiles.map((f) => readFileSync(`${cssDir}/${f}`, 'utf-8')).join('\n');
const styles = readFileSync(ROOT + 'css/styles.css', 'utf-8');

const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
const referenced = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]));

const results = [];
const ok = (name, fn) => {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
};

ok('todo `var(--token)` referenciado está definido en algún CSS', () => {
  const missing = [...referenced].filter((t) => !defined.has(t));
  if (missing.length) throw new Error('tokens no definidos: ' + missing.join(', '));
});

ok('no quedan los tokens del sistema antiguo/duplicado', () => {
  const legacy = ['--space-md', '--space-sm', '--space-lg', '--space-xl', '--space-xs', '--surface', '--surface-hover', '--border', '--primary', '--primary-rgb', '--primary-10', '--success', '--danger', '--warning', '--radius', '--text', '--text-tertiary', '--color-line', '--accent'];
  const still = legacy.filter((t) => referenced.has(t));
  if (still.length) throw new Error('tokens del sistema antiguo aún en uso: ' + still.join(', '));
});

const light = (() => {
  const m = styles.match(/:root\s*\{/);
  const start = m.index + m[0].length;
  const body = styles.slice(start, styles.indexOf('}', start));
  const out = {};
  for (const d of body.split(';')) { const mm = d.match(/(--[a-z0-9-]+)\s*:\s*(.+)/i); if (mm) out[mm[1]] = mm[2].trim(); }
  return out;
})();

ok('el cuerpo de texto mide 20 px (--fs-base)', () => {
  if (light['--fs-base'] !== '1.25rem') throw new Error('--fs-base debe ser 1.25rem (20px), es ' + light['--fs-base']);
});

ok('el interlineado base está entre 1,5 y 1,75', () => {
  const lh = parseFloat(light['--lh-normal']);
  if (!(lh >= 1.5 && lh <= 1.75)) throw new Error('--lh-normal fuera de rango: ' + light['--lh-normal']);
});

ok('--font-family apunta a Atkinson Hyperlegible con pila de reserva', () => {
  const f = light['--font-family'] || '';
  if (!/Atkinson Hyperlegible/.test(f)) throw new Error('--font-family no incluye Atkinson Hyperlegible: ' + f);
  if (!/system-ui/.test(f)) throw new Error('--font-family no tiene pila de reserva del sistema: ' + f);
});

export async function run() {
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    tests: results.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}
