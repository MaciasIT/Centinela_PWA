import { parseHTML } from 'linkedom';
import * as resultScreen from '../../js/screens/result.js';
import * as historyScreen from '../../js/screens/history.js';
import { addToHistory, clearHistory } from '../../js/history.js';
import { saveGuardianPhone, clearGuardianPhone } from '../../js/screens/guardian.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

let document;
function bootDom() {
  const html = `<!DOCTYPE html><html><body>
    <div id="screen-result" class="screen">
      <div class="result-container" aria-live="polite">
        <div id="result-icon" class="result-traffic-light"></div>
        <h2 id="result-title" class="result-title">—</h2>
        <p id="result-message" class="result-message">—</p>
        <div id="result-brand" class="result-brand" style="display: none;">
          <div class="brand-badge">
            <span id="brand-icon">🛡️</span>
            <span id="brand-msg">Identidad Verificada</span>
          </div>
          <p id="brand-detail" class="brand-detail"></p>
        </div>
        <div id="result-trust" class="result-trust" style="display: none;">
          <div class="trust-badge">
            <span id="trust-icon">🕰️</span>
            <span id="trust-msg">Sitio Establecido</span>
          </div>
        </div>
        <div id="result-url-card" class="result-url-card">
          <span class="result-url-label">Enlace analizado:</span>
          <p id="result-url" class="result-url">—</p>
        </div>
        <div id="result-xray" class="result-xray" style="display: none;">
          <div class="xray-header">
            <span class="xray-tag">🕵️ EFECTO RAYOS X</span>
            <span class="xray-title-text">Destino real detectado:</span>
          </div>
          <p id="result-final-url" class="result-final-url">—</p>
          <p id="result-page-title" class="result-page-title">—</p>
        </div>
        <details id="result-details" class="result-details">
          <summary class="result-details-toggle">Informe técnico detallado</summary>
          <div id="result-details-content" class="result-details-body"></div>
        </details>
        <div class="result-actions">
          <button id="btn-preview" class="btn btn-secondary">Vista Previa</button>
          <button id="btn-sos" class="btn btn-warning" style="display: none;">Preguntar</button>
          <button id="btn-open-url" class="btn btn-outline">Abrir web</button>
          <button id="btn-share" class="btn btn-primary">Compartir</button>
        </div>
        <button id="btn-new-check" class="btn btn-secondary btn-xl btn-full">Comprobar otro enlace</button>
      </div>
    </div>
    <div id="screen-history" class="screen"></div>
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

ok('resultScreen preserva todos los botones y elementos del DOM', () => {
  bootDom();
  const container = document.getElementById('screen-result');
  const result = {
    positives: 0,
    total: 75,
    suspicious: 0,
    harmless: 75,
    undetected: 0,
    scanDate: Math.floor(Date.now() / 1000),
    firstSubmissionDate: Math.floor((Date.now() - 365 * 24 * 3600 * 1000) / 1000),
    url: 'https://google.com',
  };

  resultScreen.mount(container, { result, url: 'https://google.com' });

  // Verificar que los botones esenciales siguen en el DOM
  if (!document.getElementById('btn-preview')) throw new Error('btn-preview desapareció');
  if (!document.getElementById('btn-open-url')) throw new Error('btn-open-url desapareció');
  if (!document.getElementById('btn-share')) throw new Error('btn-share desapareció');
  if (!document.getElementById('btn-new-check')) throw new Error('btn-new-check desapareció');
  if (!document.getElementById('btn-sos')) throw new Error('btn-sos desapareció');

  // Verificar veredicto seguro (título canónico de core/verdict.js)
  const title = document.getElementById('result-title').textContent;
  if (!title.includes('tranquilidad')) throw new Error(`Título no es el canónico de seguro: ${title}`);
  if (document.getElementById('btn-open-url').style.display === 'none') throw new Error('btn-open-url oculto en resultado seguro');

  tearDownDom();
});

ok('resultScreen maneja enlaces peligrosos ocultando btn-open-url y mostrando alerta', () => {
  bootDom();
  const container = document.getElementById('screen-result');
  const result = {
    positives: 8,
    total: 75,
    suspicious: 2,
    harmless: 65,
    undetected: 0,
    scanDate: Math.floor(Date.now() / 1000),
    url: 'https://phishing-site-fake.com',
  };

  resultScreen.mount(container, { result, url: 'https://phishing-site-fake.com' });

  const title = document.getElementById('result-title').textContent;
  if (!title.includes('No abras')) throw new Error(`Título no es peligroso: ${title}`);
  if (document.getElementById('btn-open-url').style.display !== 'none') throw new Error('btn-open-url visible en peligro');

  tearDownDom();
});

ok('resultScreen activa SOS cuando hay guardian configurado y resultado es dudoso/peligroso', () => {
  bootDom();
  saveGuardianPhone('34600112233');

  const container = document.getElementById('screen-result');
  const dangerResult = {
    positives: 5,
    total: 70,
    url: 'https://peligro.com',
  };

  resultScreen.mount(container, { result: dangerResult, url: 'https://peligro.com' });
  const btnSos = document.getElementById('btn-sos');
  if (btnSos.style.display === 'none') throw new Error('btn-sos debería mostrarse con guardian y peligro');

  clearGuardianPhone();
  tearDownDom();
});

ok('historyScreen renderiza listado y filtros correctamente', () => {
  bootDom();
  clearHistory();
  addToHistory('https://example.com', { positives: 0, total: 70 });
  addToHistory('https://malicious.com', { positives: 10, total: 70 });

  const container = document.getElementById('screen-history');
  historyScreen.mount(container);

  const cards = container.querySelectorAll('.history-card');
  if (cards.length !== 2) throw new Error(`Se esperaban 2 tarjetas de historial, pero hay ${cards.length}`);

  clearHistory();
  tearDownDom();
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
