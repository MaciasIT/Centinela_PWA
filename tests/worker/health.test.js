const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
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

ok('GET /health responde 200 y JSON status ok', async () => {
  const worker = await loadWorker();
  const req = makeReq('GET', '/health');
  const res = await worker.fetch(req, {}, {});
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error('status no es ok');
});

ok('GET / rutas desconocidas responde 404', async () => {
  const worker = await loadWorker();
  const req = makeReq('GET', '/unknown');
  const res = await worker.fetch(req, {}, {});
  if (res.status !== 404) throw new Error(`status ${res.status}`);
});

ok('POST /api/local-check vacío todavía tiene cuerpo parseable en JSON', async () => {
  const worker = await loadWorker();
  const body = JSON.stringify({});
  const req = makeReq('POST', '/api/local-check', body);
  const res = await worker.fetch(req, {}, {});
  const text = await res.text();
  if (!text.includes('Missing URL')) throw new Error(text || 'sin respuesta útil');
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
