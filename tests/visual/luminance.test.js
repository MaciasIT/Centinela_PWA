/**
 * Tanda 5a — Separación de luminosidad entre los tres veredictos.
 *
 * El color por sí solo no basta (daltonismo, escala de grises). Los tres
 * veredictos deben separarse TAMBIÉN por luminosidad. El fallo histórico era
 * que el verde y el ámbar convertían a un gris casi idéntico (72 frente a 73
 * sobre 255). Este test falla si vuelven a acercarse.
 *
 * Umbrales: cualquier par >= 0,03 de luminancia relativa (WCAG) y, en concreto,
 * verde frente a ámbar >= 0,08, que es la pareja que el brief señala.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = here.replace(/tests[/\\]visual[/\\]$/, '');
const css = readFileSync(ROOT + 'css/styles.css', 'utf-8');

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

const toRgb = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const chan = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => { const [r, g, b] = toRgb(hex); return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b); };

const light = readBlock(/:root\s*\{/);
const dark = readBlock(/:root\[data-theme="dark"\]\s*\{/);

const results = [];
const ok = (name, fn) => {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
};

for (const [themeName, t] of [['claro', light], ['oscuro', dark]]) {
  ok(`${themeName}: verde y ámbar separados por luminosidad (>= 0.08)`, () => {
    const d = Math.abs(luminance(t['--color-safe']) - luminance(t['--color-warning']));
    if (d < 0.08) throw new Error(`verde ${t['--color-safe']} y ámbar ${t['--color-warning']} difieren solo ${d.toFixed(3)} (mínimo 0.08)`);
  });
  ok(`${themeName}: los tres veredictos se separan por luminosidad (todos los pares >= 0.03)`, () => {
    const vals = { verde: luminance(t['--color-safe']), ámbar: luminance(t['--color-warning']), rojo: luminance(t['--color-danger']) };
    const pairs = [['verde', 'ámbar'], ['verde', 'rojo'], ['ámbar', 'rojo']];
    for (const [a, b] of pairs) {
      const d = Math.abs(vals[a] - vals[b]);
      if (d < 0.03) throw new Error(`${a} y ${b} difieren solo ${d.toFixed(3)} (mínimo 0.03)`);
    }
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
