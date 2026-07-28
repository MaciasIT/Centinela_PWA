import { parseHTML } from 'linkedom';
import { register, navigate, current, bindNav } from '../../js/router.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

let document;
function bootDom() {
  const { document: doc } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  document = doc;
  globalThis.document = document;
  globalThis.window = { document };
}

function tearDownDom() {
  delete globalThis.document;
  delete globalThis.window;
}

function mountScreens() {
  document.body.innerHTML = `
    <div id="screen-home" class="screen"></div>
    <div id="screen-scanner" class="screen"></div>
    <div id="screen-result" class="screen"></div>
    <button class="nav-btn" data-screen="scanner">Scanner</button>
  `;
}

ok('navigate monta la pantalla destino y hace unmount de la anterior', () => {
  bootDom();
  const order = [];
  mountScreens();

  register('home', {
    mount(c) { order.push('home-mount'); c.dataset.mounted = '1'; },
    unmount() { order.push('home-unmount'); },
  });
  register('scanner', {
    mount(c) { order.push('scanner-mount'); c.dataset.mounted = '1'; },
  });

  navigate('home');
  if (current() !== 'home') throw new Error('current no es home');
  if (document.getElementById('screen-home').dataset.mounted !== '1') throw new Error('home no montó');

  navigate('scanner');
  if (current() !== 'scanner') throw new Error('current no es scanner');
  if (!order.join(',').includes('home-unmount')) throw new Error('home no hizo unmount');
  if (!order.join(',').includes('scanner-mount')) throw new Error('scanner no montó');

  tearDownDom();
});

ok('navigate no falla si falta el contenedor en el DOM', () => {
  bootDom();
  mountScreens();
  register('missing', { mount() {} });
  navigate('missing');
  tearDownDom();
});

ok('bindNav navega al hacer click y pasa por beforeNavigate', async () => {
  bootDom();
  mountScreens();
  let beforeRan = false;
  register('scanner', { mount() {} });
  bindNav('.nav-btn', 'scanner', async () => { beforeRan = true; });
  document.querySelector('.nav-btn').click();
  await new Promise((r) => setTimeout(r, 0));
  if (current() !== 'scanner') throw new Error('no navegó');
  if (!beforeRan) throw new Error('beforeNavigate no se ejecutó');
  tearDownDom();
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
