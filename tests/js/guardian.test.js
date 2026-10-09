/**
 * Tests de HU-27 (Ángel de la Guarda sin defectos) y regresión de F-5/F-6.
 *  - AC-01: una sola conversación de WhatsApp con el enlace y el veredicto.
 *  - AC-02: un solo contacto (un campo, una clave de storage, sin IDs duplicados).
 *  - F-5: no hay doble listener ni `window.__centinela`.
 *  - F-6: index.html no tiene IDs duplicados.
 */
import { parseHTML } from 'linkedom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as guardianScreen from '../../js/screens/guardian.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

let document;
let opened = [];
function bootDom() {
  opened = [];
  const html = `<!DOCTYPE html><html><body>
    <div id="screen-result" class="screen">
      <h2 id="result-title">—</h2>
      <span id="brand-msg">Identidad Verificada</span>
      <div id="result-brand" style="display: none;"></div>
      <button id="btn-sos" style="display: none;">Preguntar</button>
    </div>
  </body></html>`;
  const { document: doc } = parseHTML(html);
  document = doc;
  globalThis.document = document;
  globalThis.window = {
    document,
    open: (url) => { opened.push(url); },
  };
}

function tearDownDom() {
  delete globalThis.document;
  delete globalThis.window;
}

ok('HU-27 AC-01 / F-5: con contacto y veredicto no verde, UNA sola conversación de WhatsApp', () => {
  bootDom();
  guardianScreen.clearGuardianPhone();
  guardianScreen.saveGuardianPhone('34600112233');

  document.getElementById('result-title').textContent = '¡No abras este enlace!';

  // Cableado real: mount() NO debe registrar nada; el único listener lo pone
  // bindSosButton (una sola vez, como en app.js).
  guardianScreen.mount();
  guardianScreen.bindSosButton(
    { btnSos: document.getElementById('btn-sos') },
    {
      getUrl: () => 'https://peligroso.example',
      getResultTitle: () => document.getElementById('result-title').textContent,
      getBrandMsg: () => document.getElementById('brand-msg').textContent,
      getBrandVisible: () => document.getElementById('result-brand').style.display !== 'none',
    }
  );

  document.getElementById('btn-sos').click();

  if (opened.length !== 1) throw new Error(`se abrieron ${opened.length} conversaciones (debe ser 1)`);
  const url = opened[0];
  if (!url.startsWith('https://wa.me/34600112233?text=')) throw new Error('teléfono incorrecto: ' + url);
  const text = decodeURIComponent(url.split('text=')[1]);
  if (!text.includes('https://peligroso.example')) throw new Error('el mensaje no lleva el enlace');
  if (!text.includes('¡No abras este enlace!')) throw new Error('el mensaje no lleva el veredicto');

  guardianScreen.clearGuardianPhone();
  tearDownDom();
});

ok('HU-27 AC-01: sin contacto, pulsar «Preguntar» no abre nada', () => {
  bootDom();
  guardianScreen.clearGuardianPhone();
  guardianScreen.mount();
  guardianScreen.bindSosButton({ btnSos: document.getElementById('btn-sos') }, { getUrl: () => 'https://x.example' });
  document.getElementById('btn-sos').click();
  if (opened.length !== 0) throw new Error('se abrió WhatsApp sin contacto guardado');
  tearDownDom();
});

ok('HU-27 AC-02: el contacto vive en UNA sola clave de storage', () => {
  guardianScreen.clearGuardianPhone();
  guardianScreen.saveGuardianPhone('34600112233');

  if (guardianScreen.loadGuardianPhone() !== '34600112233') throw new Error('no se lee el contacto guardado');

  // La clave antigua alias ('centinela_guardian') no debe volver a escribirse.
  if (globalThis.localStorage.getItem('centinela_guardian') !== null) {
    throw new Error('se sigue escribiendo la clave alias duplicada');
  }
  guardianScreen.clearGuardianPhone();
});

ok('F-5: guardian.js no usa window.__centinela', () => {
  const src = readFileSync(join(root, 'js', 'screens', 'guardian.js'), 'utf8');
  if (/__centinela/.test(src)) throw new Error('sigue existiendo window.__centinela en guardian.js');
});

ok('F-5: app.js no registra un segundo listener sobre #btn-sos', () => {
  const src = readFileSync(join(root, 'js', 'app.js'), 'utf8');
  // El SOS debe cablearse solo con bindSosButton; ningún addEventListener directo.
  if (/btnSos\??\.addEventListener/.test(src)) throw new Error('app.js vuelve a cablear btn-sos a mano (doble listener)');
  if (!/bindSosButton/.test(src)) throw new Error('app.js no usa el cableado único bindSosButton');
});

ok('F-6: index.html no tiene IDs duplicados ni el contacto duplicado', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  const dups = new Set();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  if (dups.size) throw new Error('IDs duplicados: ' + [...dups].join(', '));

  // El contacto vive SOLO en Ajustes; no debe haber un segundo campo en el shell.
  for (const forbidden of ['id="guardian-phone"', 'id="btn-save-guardian"', 'id="guardian-status"']) {
    if (html.includes(forbidden)) throw new Error(`index.html conserva el contacto duplicado: ${forbidden}`);
  }
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
