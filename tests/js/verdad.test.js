/**
 * Tests de contrato de "verdad del producto" (E4/E8 · Tanda 1).
 * Fijan que los textos y rutas retiradas no reaparezcan en el código fuente.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(js|html|css)$/.test(name)) acc.push(p);
  }
  return acc;
}

// Fuentes de producto: la app y el worker (excluye tests/, dist/, node_modules/).
function productSources() {
  const files = [
    join(root, 'index.html'),
    join(root, 'manual.html'),
    join(root, 'js', 'screens', 'settings.js'),
  ];
  walk(join(root, 'js'), files);
  walk(join(root, 'worker', 'src'), files);
  return files;
}

function read(p) {
  return readFileSync(p, 'utf8');
}

ok('HU-38: ningún texto afirma «más de 70 motores» ni equivalente', () => {
  const offenders = productSources().filter((p) => /70 motores|más de 70/i.test(read(p)));
  if (offenders.length) throw new Error(`Aparece en: ${offenders.map((p) => p.replace(root + '/', '')).join(', ')}`);
});

ok('HU-39: no queda la ruta de vista previa sin clave (thumbnail.ws)', () => {
  const offenders = productSources().filter((p) => /thumbnail\.ws/.test(read(p)));
  if (offenders.length) throw new Error(`Aparece en: ${offenders.map((p) => p.replace(root + '/', '')).join(', ')}`);
});

ok('HU-37: no queda ALLOWED_ORIGIN_REGEX en el worker', () => {
  const workerFiles = walk(join(root, 'worker', 'src'));
  const offenders = workerFiles.filter((p) => /ALLOWED_ORIGIN_REGEX/.test(read(p)));
  if (offenders.length) throw new Error(`Aparece en: ${offenders.map((p) => p.replace(root + '/', '')).join(', ')}`);
});

ok('HU-37: no queda el onboarding huérfano en el shell', () => {
  const html = read(join(root, 'index.html'));
  if (/id="onboarding"|onboarding-slide|onboarding-next/.test(html)) throw new Error('El marcado de onboarding sigue en index.html');
});

ok('HU-23: la versión visible se inyecta desde package.json (sin literales divergentes)', () => {
  const pkg = JSON.parse(read(join(root, 'package.json')));
  const html = read(join(root, 'index.html'));
  // El HTML debe usar el placeholder; no un número fijo de versión.
  if (!html.includes('__APP_VERSION__')) throw new Error('index.html no usa el placeholder de versión');
  if (/Versión \d+\.\d+\.\d+/.test(html)) throw new Error('index.html tiene una versión literal');
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('package.json no tiene una versión semántica');
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
