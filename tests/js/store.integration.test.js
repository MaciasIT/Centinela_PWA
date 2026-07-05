import { assertStoreUpdate, assertDerived, assertRenderCount, markRouteComplete, hasRouteDuplicate, store } from '../../js/store.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

ok('Store inicializa estado por defecto', () => {
  if (store.get('screen') !== 'main') throw new Error('screen inicial incorrecta');
  if (store.get('url') !== '') throw new Error('url inicial incorrecta');
});

ok('assertStoreUpdate pasa al alcanzar el valor esperado', async () => {
  store.set('status', 'idle');
  const next = assertStoreUpdate('status', 'loading', 1000);
  setTimeout(() => store.set('status', 'loading'), 20);
  await next;
});

ok('markRouteComplete y hasRouteDuplicate detectan duplicados cercanos', async () => {
  const before = await hasRouteDuplicate('abc', 5000);
  markRouteComplete('abc');
  const after = await hasRouteDuplicate('abc', 5000);
  if (before) throw new Error('no debería ser duplicado antes de marcar');
  if (!after) throw new Error('debería marcar duplicado reciente');
  if (await hasRouteDuplicate('not-exists', 5000)) throw new Error('no debería marcar inexistente');
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, failed };
}
