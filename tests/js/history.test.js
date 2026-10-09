/**
 * Tests de HU-25 (historial en lenguaje natural).
 *  - AC-01: entradas agrupadas por día («Hoy», «Ayer», «Hace 3 días»).
 *  - AC-02: el veredicto mostrado coincide con el guardado (core/verdict.js).
 *  - AC-03: pulsar una entrada permite volver a comprobar ese enlace.
 */
import { parseHTML } from 'linkedom';
import * as historyScreen from '../../js/screens/history.js';
import { relativeDayLabel, groupHistoryByDay } from '../../js/core/history-group.js';
import { verdictInfo } from '../../js/core/verdict.js';
import { getHistory } from '../../js/history.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

let document;
function bootDom() {
  const html = `<!DOCTYPE html><html><body>
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

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-09T12:00:00');

/** Siembra el historial con entradas de fechas controladas. */
function seedHistory(entries) {
  globalThis.localStorage.setItem('centinela_history', JSON.stringify(entries));
}

ok('HU-25 AC-01: relativeDayLabel dice «Hoy», «Ayer» y «Hace N días»', () => {
  if (relativeDayLabel(NOW, NOW) !== 'Hoy') throw new Error('hoy mal');
  if (relativeDayLabel(new Date(NOW.getTime() - DAY), NOW) !== 'Ayer') throw new Error('ayer mal');
  if (relativeDayLabel(new Date(NOW.getTime() - 3 * DAY), NOW) !== 'Hace 3 días') throw new Error('hace 3 días mal');
  const old = relativeDayLabel(new Date(NOW.getTime() - 10 * DAY), NOW);
  if (!/\d/.test(old)) throw new Error('fecha antigua sin fecha: ' + old);
});

ok('HU-25 AC-01: groupHistoryByDay agrupa por día natural y mantiene el orden', () => {
  const entries = [
    { url: 'https://a.com', date: new Date(NOW.getTime() - 1 * 3600 * 1000).toISOString() },
    { url: 'https://b.com', date: new Date(NOW.getTime() - 1 * DAY).toISOString() },
    { url: 'https://c.com', date: new Date(NOW.getTime() - 3 * DAY).toISOString() },
  ];
  const groups = groupHistoryByDay(entries, NOW);
  const labels = groups.map((g) => g.label);
  if (labels.join('|') !== 'Hoy|Ayer|Hace 3 días') throw new Error('grupos: ' + labels.join('|'));
  if (groups[0].items.length !== 1) throw new Error('grupo Hoy debería tener 1');
});

ok('HU-25 AC-01: la pantalla pinta los títulos de grupo por día', () => {
  bootDom();
  seedHistory([
    { id: 1, url: 'https://hoy.com', status: 'safe', date: new Date().toISOString() },
    { id: 2, url: 'https://ayer.com', status: 'danger', date: new Date(Date.now() - DAY).toISOString() },
  ]);
  const container = document.getElementById('screen-history');
  historyScreen.mount(container);

  const titles = [...container.querySelectorAll('.history-group-title')].map((t) => t.textContent);
  if (!titles.includes('Hoy')) throw new Error('falta grupo Hoy: ' + titles.join(','));
  if (!titles.includes('Ayer')) throw new Error('falta grupo Ayer: ' + titles.join(','));

  tearDownDom();
});

ok('HU-25 AC-02: el veredicto mostrado coincide con el guardado (core/verdict.js)', () => {
  bootDom();
  seedHistory([
    { id: 1, url: 'https://seguro.com', status: 'safe', date: new Date().toISOString() },
    { id: 2, url: 'https://dudoso.com', status: 'warning', date: new Date().toISOString() },
    { id: 3, url: 'https://peligro.com', status: 'danger', date: new Date().toISOString() },
  ]);
  const container = document.getElementById('screen-history');
  historyScreen.mount(container);

  const badges = [...container.querySelectorAll('.history-badge')].map((b) => b.textContent);
  for (const status of ['safe', 'warning', 'danger']) {
    if (!badges.includes(verdictInfo(status).label)) {
      throw new Error(`falta la etiqueta canónica de ${status}: ${verdictInfo(status).label}`);
    }
  }

  tearDownDom();
});

ok('HU-25 AC-03: pulsar una entrada pide volver a comprobar su enlace', () => {
  bootDom();
  seedHistory([{ id: 1, url: 'https://example.com/path', status: 'warning', date: new Date().toISOString() }]);

  let asked = null;
  historyScreen.setRecheckHandler((url) => { asked = url; });

  const container = document.getElementById('screen-history');
  historyScreen.mount(container);

  const card = container.querySelector('.history-card');
  if (!card) throw new Error('no se renderizó ninguna tarjeta');
  card.click();

  if (asked !== 'https://example.com/path') throw new Error(`URL de re-comprobación incorrecta: ${asked}`);

  historyScreen.setRecheckHandler(null);
  tearDownDom();
});

ok('HU-25: el historial sigue leyéndose desde el módulo de historial', () => {
  seedHistory([]);
  const hist = getHistory();
  if (!Array.isArray(hist)) throw new Error('getHistory no devuelve array');
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
