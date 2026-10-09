/**
 * Tanda 4a — Escáner de QR (HU-11, HU-15 como apoyo de AC-02).
 *
 * Cubre la salida «subir una imagen» que AC-02 exige cuando no hay cámara, y el
 * aislamiento de cada intento de lectura (HU-15 AC-03). No usa cámara real: la
 * lectura de imagen se prueba con una implementación de Html5Qrcode inyectada.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { parseHTML, Event } from 'linkedom';
import { scanFromImage, startScanner } from '../../js/scanner.js';
import * as scannerScreen from '../../js/screens/scanner.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = here.replace(/tests[/\\]js[/\\]$/, '');

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

/* ── DOM del escáner ── */
function bootDom() {
  const html = `<!DOCTYPE html><html><body>
    <div id="screen-scanner" class="screen active">
      <div id="qr-reader" class="qr-reader-container"></div>
      <div id="scanner-unavailable" class="scanner-unavailable hidden">
        <p id="scanner-unavailable-msg"></p>
        <button id="btn-scanner-upload">Subir una imagen</button>
        <button id="btn-scanner-paste">O pega el enlace a mano</button>
      </div>
    </div>
  </body></html>`;
  const { document } = parseHTML(html);
  globalThis.document = document;
  globalThis.window = { document };
  return document;
}
function tearDownDom() {
  delete globalThis.document;
  delete globalThis.window;
}

/** Html5Qrcode falso que registra los contenedores y puede fallar a voluntad. */
function makeFakeImpl() {
  const state = { ids: [], cleared: 0, fail: false };
  class FakeQr {
    constructor(id) { this.id = id; state.ids.push(id); }
    async scanFile() {
      if (state.fail) throw new Error('sin QR');
      return 'https://qr.example.com/promo';
    }
    clear() { state.cleared += 1; }
  }
  return { FakeQr, state };
}

/* ── HU-11 AC-02: subir una imagen funciona y es una salida real ── */

okAsync('HU-11 AC-02: subir una imagen con QR devuelve el enlace leído', async () => {
  bootDom();
  const { FakeQr } = makeFakeImpl();
  const text = await scanFromImage({ name: 'foto.png' }, FakeQr);
  if (text !== 'https://qr.example.com/promo') throw new Error(`lectura inesperada: ${text}`);
  tearDownDom();
});

okAsync('HU-11 AC-02: si la imagen no tiene QR legible, el mensaje es llano', async () => {
  bootDom();
  const { FakeQr, state } = makeFakeImpl();
  state.fail = true;
  let msg = '';
  try { await scanFromImage({ name: 'sin-qr.png' }, FakeQr); }
  catch (e) { msg = e.message; }
  if (!/no he encontrado ningún código qr/i.test(msg)) throw new Error(`mensaje no llano: ${msg}`);
  tearDownDom();
});

okAsync('HU-11 AC-02: sin librería de escáner el error es explícito', async () => {
  bootDom();
  let msg = '';
  try { await scanFromImage({ name: 'x.png' }, null); }
  catch (e) { msg = e.message; }
  if (!/librería/i.test(msg)) throw new Error(`mensaje inesperado: ${msg}`);
  tearDownDom();
});

/* ── HU-15 AC-03 (apoyo de AC-02): cada intento aislado, sin residuos ── */

okAsync('HU-15 AC-03: cada intento usa un contenedor nuevo y lo limpia', async () => {
  bootDom();
  const { FakeQr, state } = makeFakeImpl();

  await scanFromImage({ name: 'a.png' }, FakeQr);
  if (document.querySelectorAll('[id^="centinela-qr-tmp"]').length !== 0) {
    throw new Error('quedó residuo del primer intento');
  }
  await scanFromImage({ name: 'b.png' }, FakeQr);
  if (document.querySelectorAll('[id^="centinela-qr-tmp"]').length !== 0) {
    throw new Error('quedó residuo del segundo intento');
  }
  if (state.ids.length !== 2) throw new Error(`se esperaban 2 intentos, hubo ${state.ids.length}`);
  if (state.ids[0] === state.ids[1]) throw new Error('los dos intentos compartieron contenedor (no aislados)');
  if (state.cleared !== 2) throw new Error('cada intento debe limpiarse (clear)');
  tearDownDom();
});

/* ── D-2: el CAMINO REAL de `startScanner` con el error tal cual lo entrega la
   librería (no una cadena fabricada). Si el cableado vuelve a pasar solo
   `err.message`, estos tests se ponen en rojo. ── */

okAsync('D-2 camino real: startScanner propaga un NotFoundError como mensaje de «sin cámara»', async () => {
  const realErr = Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' });
  class FakeLib { constructor() {} static async getCameras() { throw realErr; } }

  let msg = '';
  await startScanner('qr-reader', () => {}, (m) => { msg = m; }, FakeLib);
  if (!/no hemos encontrado ninguna cámara/i.test(msg)) {
    throw new Error(`el cableado perdió el nombre del error y cayó en el genérico: ${msg}`);
  }
});

okAsync('D-2 camino real: startScanner propaga un NotReadableError como mensaje de «cámara ocupada»', async () => {
  const realErr = Object.assign(new Error('Could not start video source'), { name: 'NotReadableError' });
  class FakeLib {
    constructor() {}
    static async getCameras() { return [{ id: 'cam-1' }]; }
    start() { return Promise.reject(realErr); }
    stop() {}
    clear() {}
  }

  let msg = '';
  await startScanner('qr-reader', () => {}, (m) => { msg = m; }, FakeLib);
  if (!/usada por otra aplicación/i.test(msg)) {
    throw new Error(`el cableado perdió el nombre del error y cayó en el genérico: ${msg}`);
  }
});

/* ── HU-11 AC-02: la pantalla muestra el estado y sus dos salidas ── */

ok('HU-11 AC-02: el estado «cámara no disponible» muestra mensaje y oculta la cámara', () => {
  const document = bootDom();
  scannerScreen.showCameraUnavailable('No hemos encontrado ninguna cámara. Puedes subir una imagen.', document);

  const box = document.getElementById('scanner-unavailable');
  const msg = document.getElementById('scanner-unavailable-msg');
  const reader = document.getElementById('qr-reader');
  if (box.classList.contains('hidden')) throw new Error('el mensaje sigue oculto');
  if (!/subir una imagen/i.test(msg.textContent)) throw new Error('el mensaje debe ofrecer subir una imagen');
  if (!reader.classList.contains('hidden')) throw new Error('la vista de cámara debe ocultarse');
  tearDownDom();
});

ok('HU-11 AC-02: resetear la vista vuelve a mostrar la cámara', () => {
  const document = bootDom();
  scannerScreen.showCameraUnavailable('x', document);
  scannerScreen.resetScannerView(document);
  if (!document.getElementById('scanner-unavailable').classList.contains('hidden')) throw new Error('el mensaje debe ocultarse');
  if (document.getElementById('qr-reader').classList.contains('hidden')) throw new Error('la cámara debe volver a verse');
  tearDownDom();
});

ok('HU-11 AC-02: mount cablea «Subir una imagen» y «pegar a mano»', () => {
  const document = bootDom();
  let uploaded = 0;
  let pasted = 0;
  let onError = null;
  const fakeStart = (_id, _onScan, errCb) => { onError = errCb; };

  scannerScreen.mount(
    document.getElementById('screen-scanner'),
    { onScan: () => {}, onUpload: () => { uploaded += 1; }, onPaste: () => { pasted += 1; } },
    fakeStart
  );

  // La cámara falla → se muestra el estado de indisponibilidad.
  onError('No hemos podido usar la cámara.');
  if (document.getElementById('scanner-unavailable').classList.contains('hidden')) {
    throw new Error('el error de cámara no mostró el estado');
  }

  document.getElementById('btn-scanner-upload').dispatchEvent(new Event('click'));
  document.getElementById('btn-scanner-paste').dispatchEvent(new Event('click'));
  if (uploaded !== 1) throw new Error(`«Subir una imagen» no disparó su acción (${uploaded})`);
  if (pasted !== 1) throw new Error(`«pegar a mano» no disparó su acción (${pasted})`);

  scannerScreen.unmount();
  tearDownDom();
});

/* ── Guarda de marcado: las salidas de AC-02 existen en index.html ── */

ok('HU-11 AC-02: index.html contiene el bloque «cámara no disponible» y sus dos botones', () => {
  const html = readFileSync(ROOT + 'index.html', 'utf-8');
  for (const id of ['scanner-unavailable', 'scanner-unavailable-msg', 'btn-scanner-upload', 'btn-scanner-paste']) {
    if (!html.includes(`id="${id}"`)) throw new Error(`falta el elemento #${id} en index.html`);
  }
});

export async function run() {
  for (const t of asyncTests) await t();
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}