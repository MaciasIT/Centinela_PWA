import { parseHTML } from 'linkedom';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
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

  guardianScreen.mount();
  guardianScreen.bindSosButton(
    { btnSos: document.getElementById('btn-sos') },
    {
      getUrl: () => 'https://peligroso.example',
      getResultTitle: () => document.getElementById('result-title').textContent,
      getBrandMsg: () => document.getElementById('brand-msg').textContent,
      getBrandVisible: () => document.getElementById('result-brand').style.display !== 'none',
      getChannel: () => guardianScreen.loadGuardianChannel(),
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

  if (globalThis.localStorage.getItem('centinela_guardian') !== null) {
    throw new Error('se sigue escribiendo la clave alias duplicada');
  }
  guardianScreen.clearGuardianPhone();
});

ok('Fase 6 AC-01: buildSosMessage adapta el prefijo para Telegram', () => {
  const text = guardianScreen.buildSosMessage('https://x.test', 'PELIGROSO', '', false, 'telegram');
  if (!text.startsWith('🛡️ *CENTINELA SOS* 👼')) throw new Error('prefijo Telegram inesperado: ' + text);
});

ok('Fase 6 AC-02: openSosByChannel abre Telegram por enlace compartido', () => {
  bootDom();
  guardianScreen.openSosByChannel('34600112233', 'mensaje', 'telegram');
  if (opened.length !== 1) throw new Error('no se abrió Telegram');
  if (!opened[0].startsWith('https://t.me/share/url?url=')) throw new Error('URL Telegram inesperada: ' + opened[0]);
  tearDownDom();
});

ok('Fase 6 AC-02: openSosByChannel abre SMS con body', () => {
  bootDom();
  guardianScreen.openSosByChannel('34600112233', 'mensaje', 'sms');
  if (opened.length !== 1) throw new Error('no se abrió SMS');
  if (!opened[0].startsWith('sms:34600112233?body=')) throw new Error('URL SMS inesperada: ' + opened[0]);
  tearDownDom();
});

ok('Fase 6 AC-02: openSosByChannel por defecto abre WhatsApp', () => {
  bootDom();
  guardianScreen.openSosByChannel('34600112233', 'mensaje');
  if (opened.length !== 1) throw new Error('no se abrió WhatsApp');
  if (!opened[0].startsWith('https://wa.me/34600112233?text=')) throw new Error('URL WhatsApp inesperada: ' + opened[0]);
  tearDownDom();
});

ok('Fase 6 AC-03: el canal se persiste en localStorage', () => {
  guardianScreen.clearGuardianChannel();
  guardianScreen.saveGuardianChannel('telegram');
  if (guardianScreen.loadGuardianChannel() !== 'telegram') throw new Error('no se leyó el canal guardado');
  guardianScreen.saveGuardianChannel('sms');
  if (guardianScreen.loadGuardianChannel() !== 'sms') throw new Error('no se leyó SMS');
  guardianScreen.saveGuardianChannel('');
  if (guardianScreen.loadGuardianChannel() !== 'whatsapp') throw new Error('el canal vacío debe volver a WhatsApp');
  guardianScreen.clearGuardianChannel();
});

ok('Fase 6 AC-03: clearGuardianPhone no deja rastro del teléfono', () => {
  guardianScreen.saveGuardianPhone('34600112233');
  guardianScreen.clearGuardianPhone();
  if (guardianScreen.loadGuardianPhone()) throw new Error('teléfono no se borró');
});

ok('F-5: guardian.js no usa window.__centinela', () => {
  const src = readFileSync(join(root, 'js', 'screens', 'guardian.js'), 'utf8');
  if (/__centinela/.test(src)) throw new Error('sigue existiendo window.__centinela en guardian.js');
});

ok('F-5: app.js no registra un segundo listener sobre #btn-sos', () => {
  const src = readFileSync(join(root, 'js', 'app.js'), 'utf8');
  if (/btnSos\\??\\.addEventListener/.test(src)) throw new Error('app.js vuelve a cablear btn-sos a mano (doble listener)');
  if (!/bindSosButton/.test(src)) throw new Error('app.js no usa el cableado único bindSosButton');
});

ok('F-6: index.html no tiene IDs duplicados ni el contacto duplicado', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\\bid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  const dups = new Set();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  if (dups.size) throw new Error('IDs duplicados: ' + [...dups].join(', '));

  for (const forbidden of ['id="guardian-phone"', 'id="btn-save-guardian"', 'id="guardian-status"']) {
    if (html.includes(forbidden)) throw new Error(`index.html conserva el contacto duplicado: ${forbidden}`);
  }
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
