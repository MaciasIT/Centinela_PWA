/**
 * T3a — Tests de integración del Worker (salud, rutas y contrato de error).
 *
 * T3a: se corrigió el patrón `ok(async …)` de este fichero (el lanzamiento
 * asíncrono escapaba al runner y mataba el proceso) y se actualizó la
 * expectativa de `/api/local-check` al sobre de error uniforme.
 */
import pkg from '../../package.json' with { type: 'json' };

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

async function loadWorker() {
  const mod = await import('../../worker/src/index.js');
  if (!mod || !mod.default || typeof mod.default.fetch !== 'function') {
    throw new Error('Worker export no exporta default.fetch');
  }
  return mod.default;
}

function makeReq(method, path, body) {
  const url = `https://centinela-api.michelmacias-it.workers.dev${path}`;
  const headers = { Origin: 'https://centinela-pwa.pages.dev' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(url, { method, headers, body });
}

okAsync('GET /health responde 200 y JSON status ok', async () => {
  const worker = await loadWorker();
  const res = await worker.fetch(makeReq('GET', '/health'), {}, {});
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error('status no es ok');
});

okAsync('HU-23: /health devuelve la misma versión que package.json', async () => {
  const worker = await loadWorker();
  const res = await worker.fetch(makeReq('GET', '/health'), {}, {});
  const data = await res.json();
  if (data.version !== pkg.version) throw new Error(`worker=${data.version} vs package.json=${pkg.version}`);
});

okAsync('GET / rutas desconocidas responde 404', async () => {
  const worker = await loadWorker();
  const res = await worker.fetch(makeReq('GET', '/unknown'), {}, {});
  if (res.status !== 404) throw new Error(`status ${res.status}`);
});

okAsync('POST /api/local-check sin url → 400 con sobre de error uniforme, sin fuga interna', async () => {
  const worker = await loadWorker();
  const res = await worker.fetch(makeReq('POST', '/api/local-check', JSON.stringify({})), {}, {});
  if (res.status !== 400) throw new Error(`status ${res.status}`);
  const data = await res.json();
  if (!data.error || data.error.code !== 'INVALID_URL') throw new Error(JSON.stringify(data));
  if (/is not defined|Missing URL/.test(JSON.stringify(data))) throw new Error('el error debe ser llano, sin detalle interno');
});

ok('el fichero de test no mezcla async en el helper síncrono `ok`', () => {
  if (asyncTests.length === 0) throw new Error('los tests async deben registrarse con okAsync');
});

export async function run() {
  for (const t of asyncTests) await t();
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}