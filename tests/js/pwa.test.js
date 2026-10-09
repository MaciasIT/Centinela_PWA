/**
 * Tanda 4a — Instalar como PWA (HU-14) y soporte del share_target (HU-12).
 *
 * Verifica el manifiesto, que es la fuente de verdad de ambos criterios: el
 * icono/a pantalla completa (AC-01), el acceso directo «Escanear QR» (AC-02) y
 * la declaración del Web Share Target en la que se apoya HU-12.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = here.replace(/tests[/\\]js[/\\]$/, '');
const manifest = JSON.parse(readFileSync(ROOT + 'manifest.json', 'utf-8'));
const indexHtml = readFileSync(ROOT + 'index.html', 'utf-8');

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

/* ── HU-14 AC-01: icono en la pantalla de inicio y a pantalla completa ── */

ok('HU-14 AC-01: el manifiesto abre a pantalla completa (display: standalone)', () => {
  if (manifest.display !== 'standalone') throw new Error(`display debe ser standalone, es ${manifest.display}`);
});

ok('HU-14 AC-01: hay iconos de 192x192 y 512x512', () => {
  const sizes = (manifest.icons || []).map((i) => i.sizes);
  if (!sizes.includes('192x192') || !sizes.includes('512x512')) {
    throw new Error(`faltan iconos: ${JSON.stringify(sizes)}`);
  }
});

ok('HU-14 AC-01: el manifiesto declara start_url y scope', () => {
  if (!manifest.start_url) throw new Error('falta start_url');
  if (!manifest.scope) throw new Error('falta scope');
});

ok('HU-14 AC-01: index.html enlaza el manifiesto y el icono de inicio', () => {
  if (!/rel="manifest"/.test(indexHtml)) throw new Error('index.html no enlaza el manifiesto');
  if (!/rel="apple-touch-icon"/.test(indexHtml)) throw new Error('falta el icono para iOS');
});

/* ── HU-14 AC-02: mantener pulsado el icono → acceso directo «Escanear QR» ── */

ok('HU-14 AC-02: existe el acceso directo «Escanear QR»', () => {
  const shortcuts = manifest.shortcuts || [];
  const scan = shortcuts.find((s) => s.name === 'Escanear QR');
  if (!scan) throw new Error(`no hay acceso directo «Escanear QR»: ${JSON.stringify(shortcuts.map((s) => s.name))}`);
  if (!/action=scan/.test(scan.url || '')) throw new Error(`el acceso directo no apunta al escáner: ${scan.url}`);
});

/* ── HU-12 (apoyo): el manifiesto declara el share_target ── */

ok('HU-12: el manifiesto declara share_target para recibir enlaces compartidos', () => {
  const st = manifest.share_target;
  if (!st) throw new Error('falta share_target');
  if (st.action !== '/share-target') throw new Error(`action inesperada: ${st.action}`);
  if (!st.params || !st.params.text || !st.params.url) throw new Error('faltan los parámetros text/url');
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}