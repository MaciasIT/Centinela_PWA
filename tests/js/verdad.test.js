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

ok('HU-22/T3a: el Worker declara UNA sola fuente y no queda ninguna rama multi-fuente', () => {
  const workerFiles = walk(join(root, 'worker', 'src'));
  // Se buscan identificadores de código (no prosa de comentarios).
  const forbidden = [
    /checkGoogleSafeBrowsing/,
    /checkUrlScan/,
    /google_safebrowsing/,
    /GSB_API_KEY/,
    /urlscan\.io/,
    /safebrowsing\.googleapis\.com/,
  ];
  const offenders = [];
  for (const p of workerFiles) {
    const text = read(p);
    for (const re of forbidden) {
      if (re.test(text)) offenders.push(`${p.replace(root + '/', '')} (${re})`);
    }
  }
  if (offenders.length) throw new Error(`Fuente no declarada en: ${offenders.join(', ')}`);
});

ok('T3a: el CORS del Worker no es comodín («*») y usa lista explícita', () => {
  const index = read(join(root, 'worker', 'src', 'index.js'));
  if (/Access-Control-Allow-Origin'\s*:\s*'\*'/.test(index)) throw new Error("ACAO comodín en el Worker");
  if (!/DEFAULT_ALLOWED_ORIGINS/.test(index)) throw new Error('no hay lista blanca de orígenes');
  if (!/isAllowedOrigin/.test(index)) throw new Error('no hay comprobación de origen permitido');
});

ok('T3a: el Worker no filtra err.message del proveedor al cliente', () => {
  const index = read(join(root, 'worker', 'src', 'index.js'));
  if (/error:\s*err\.message/.test(index)) throw new Error('se devuelve err.message crudo');
  if (!/ERROR_MESSAGES/.test(index)) throw new Error('no se usa el catálogo de mensajes llanos');
});

ok('T3a: wrangler.toml declara el binding de rate limiting (30/60 s) y el Durable Object QuotaGuard', () => {
  const toml = read(join(root, 'worker', 'wrangler.toml'));
  if (!/\[\[ratelimits\]\]/.test(toml)) throw new Error('falta [[ratelimits]]');
  if (!/SCAN_RATE_LIMITER/.test(toml)) throw new Error('falta el binding SCAN_RATE_LIMITER');
  if (!/limit\s*=\s*30/.test(toml) || !/period\s*=\s*60/.test(toml)) throw new Error('el freno por IP debe ser 30/60 s');
  if (!/\[\[durable_objects\.bindings\]\]/.test(toml)) throw new Error('falta el binding del DO');
  if (!/class_name\s*=\s*"QuotaGuard"/.test(toml)) throw new Error('falta la clase QuotaGuard');
  if (!/new_sqlite_classes/.test(toml)) throw new Error('falta la migración SQLite del DO');
});

ok('T3a: no hay claves ni secretos versionados en el repositorio', () => {
  const workerToml = read(join(root, 'worker', 'wrangler.toml'))
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  if (/VIRUSTOTAL_API_KEY\s*=/.test(workerToml)) throw new Error('clave VT en wrangler.toml');
  const gitignore = read(join(root, '.gitignore'));
  for (const rule of ['.env', '.env.*', '.dev.vars']) {
    if (!gitignore.includes(rule)) throw new Error(`.gitignore no cubre ${rule}`);
  }
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
