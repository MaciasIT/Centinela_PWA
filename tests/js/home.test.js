/**
 * Tests de HU-01 (comprobar un enlace con un solo botón).
 * El botón "Comprobar enlace" está deshabilitado mientras el campo no tiene texto.
 */
import { parseHTML } from 'linkedom';
import * as homeScreen from '../../js/screens/home.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

let document;
function bootDom() {
  const html = `<!DOCTYPE html><html><body>
    <div id="screen-main">
      <textarea id="url-input"></textarea>
      <button id="btn-check" disabled></button>
      <button id="btn-paste"></button>
      <button id="btn-scan-qr"></button>
      <button id="btn-upload-image"></button>
      <input id="file-input">
      <p id="tip-text"></p>
      <div id="history-list"></div>
      <p id="history-empty" class="hidden"></p>
      <section id="history-section"></section>
      <button id="btn-clear-history"></button>
    </div>
  </body></html>`;
  const { document: doc } = parseHTML(html);
  document = doc;
  globalThis.document = document;
  globalThis.window = { document };
}

function tearDownDom() {
  delete globalThis.document;
  delete globalThis.window;
}

ok('HU-01: el botón Comprobar está deshabilitado sin texto y se habilita con texto', () => {
  bootDom();
  homeScreen.mount(document.getElementById('screen-main'));
  const btn = document.getElementById('btn-check');
  const input = document.getElementById('url-input');

  input.value = '';
  homeScreen.updateCheckButton();
  if (!btn.disabled) throw new Error('debería estar deshabilitado sin texto');

  input.value = '   ';
  homeScreen.updateCheckButton();
  if (!btn.disabled) throw new Error('debería estar deshabilitado con solo espacios');

  input.value = 'www.tu-banco.es';
  homeScreen.updateCheckButton();
  if (btn.disabled) throw new Error('debería habilitarse al haber texto');

  homeScreen.unmount();
  tearDownDom();
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}