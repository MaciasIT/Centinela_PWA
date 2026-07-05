import { readdirSync, realpathSync } from 'fs';
import { pathToFileURL } from 'url';

// Polyfill localStorage para Node.js (requerido por store.js)
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
  };
}

const __filename = realpathSync(process.argv[1] || new URL(import.meta.url).pathname);
const dir = __filename.replace(/\/[^/]+$/, '');

const files = readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.test.js'));

const run = async (file) => {
  const mod = await import(pathToFileURL(`${dir}/${file}`).href);
  if (!mod || typeof mod.run !== 'function') return { ok: false, error: 'missing run()', tests: 0 };
  return mod.run();
};

const summary = { pass: 0, fail: 0, details: [] };
for (const file of files) {
  const start = Date.now();
  const res = await run(file);
  const duration = Date.now() - start;
  if (res.ok) {
    summary.pass += res.tests || 0;
    summary.details.push({ file, status: 'pass', tests: res.tests || 0, duration });
  } else {
    summary.fail += 1;
    summary.details.push({ file, status: 'fail', error: res.error, duration });
  }
}

console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail }, null, 2));
for (const d of summary.details) {
  console.log(`${d.status === 'pass' ? '✓' : '✗'} ${d.file} (${d.duration}ms)` + (d.error ? ` — ${d.error}` : ''));
}
if (summary.fail > 0) process.exit(1);
