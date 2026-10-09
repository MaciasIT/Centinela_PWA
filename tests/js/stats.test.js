/**
 * Tests de HU-26 (estadísticas locales coherentes).
 *  - AC-01: los contadores usan la MISMA clasificación que pantalla e historial
 *           (core/verdict.js) y la pantalla de estadísticas pinta las etiquetas
 *           canónicas.
 *  - AC-02: borrar historial / reiniciar estadísticas se confirma y el estado
 *           queda consistente.
 *  - Invariante H-2 (Tanda 2b): historial y estadísticas no se descuadran
 *           (un reescaneo duplicado no cuenta en ninguno de los dos).
 */
import { parseHTML } from 'linkedom';
import { recordScanOutcome } from '../../js/core/scan-record.js';
import { classify, verdictInfo } from '../../js/core/verdict.js';
import { getStats, resetStats, renderStatsScreen } from '../../js/stats.js';
import { getHistory, clearHistory } from '../../js/history.js';
import * as settingsScreen from '../../js/screens/settings.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

function reset() {
  resetStats();
  clearHistory();
}

ok('HU-26 AC-01: cada veredicto cuenta en el contador que dicta core/verdict.js', () => {
  reset();

  const cases = [
    [{ positives: 0, total: 75 }, 'safe', 'safeCount'],
    [{ positives: 0, suspicious: 2, total: 75 }, 'warning', 'warningCount'],
    [{ positives: 9, total: 75 }, 'danger', 'dangerCount'],
    [{ positives: 0, total: 75, timeout: 75 }, 'unchecked', 'uncheckedCount'],
  ];

  for (const [result, expected, counter] of cases) {
    const url = `https://caso-${expected}.example`;
    const verdict = recordScanOutcome(url, result);
    if (verdict !== classify(result)) throw new Error(`verdict ${verdict} != classify ${classify(result)}`);
    if (verdict !== expected) throw new Error(`se esperaba ${expected}, salió ${verdict}`);
    const stats = getStats();
    if (stats[counter] !== 1) throw new Error(`contador ${counter} = ${stats[counter]}, se esperaba 1`);
  }

  if (getStats().totalScans !== 4) throw new Error('totalScans no es 4');
});

ok('HU-26 AC-01: la pantalla de estadísticas usa las etiquetas canónicas', () => {
  reset();
  recordScanOutcome('https://seguro.example', { positives: 0, total: 75 });

  const { document } = parseHTML('<!DOCTYPE html><html><body><div id="stats-container"></div></body></html>');
  globalThis.document = document;
  globalThis.window = { document };

  renderStatsScreen(document.getElementById('stats-container'));
  const text = document.getElementById('stats-container').textContent;
  for (const status of ['safe', 'warning', 'danger']) {
    if (!text.includes(verdictInfo(status).label)) throw new Error(`falta la etiqueta ${verdictInfo(status).label}`);
  }

  delete globalThis.document;
  delete globalThis.window;
});

ok('H-2: un reescaneo duplicado no cuenta ni en historial ni en estadísticas', () => {
  reset();
  const url = 'https://duplicado.example';
  const result = { positives: 0, total: 75 };

  recordScanOutcome(url, result);
  const statsAfterFirst = getStats().totalScans;
  const histAfterFirst = getHistory().length;

  // Mismo URL en menos de 5 min → addToHistory lo descarta (null) y no cuenta.
  recordScanOutcome(url, result);
  const statsAfterSecond = getStats().totalScans;
  const histAfterSecond = getHistory().length;

  if (statsAfterSecond !== statsAfterFirst) throw new Error('las estadísticas contaron el duplicado');
  if (histAfterSecond !== histAfterFirst) throw new Error('el historial contó el duplicado');
  if (statsAfterSecond !== histAfterSecond) throw new Error('historial y estadísticas descuadrados');
});

ok('HU-26 AC-02: resetStats deja las estadísticas a cero y consistentes', () => {
  reset();
  recordScanOutcome('https://algo.example', { positives: 5, total: 75 });
  if (getStats().totalScans !== 1) throw new Error('precondición: no se registró el escaneo');

  resetStats();
  const stats = getStats();
  if (stats.totalScans !== 0 || stats.safeCount !== 0 || stats.warningCount !== 0 || stats.dangerCount !== 0 || stats.uncheckedCount !== 0) {
    throw new Error('las estadísticas no quedaron a cero');
  }
});

ok('HU-26 AC-02: reiniciar estadísticas pide confirmación y respeta la cancelación', () => {
  reset();
  recordScanOutcome('https://algo.example', { positives: 5, total: 75 });

  const { document } = parseHTML('<!DOCTYPE html><html><body><div id="screen-settings"></div></body></html>');
  globalThis.document = document;
  globalThis.window = { document };

  settingsScreen.mount(document.getElementById('screen-settings'));
  const btn = document.getElementById('btn-reset-stats');
  if (!btn) throw new Error('no existe el botón de reiniciar estadísticas');

  let asked = false;
  globalThis.confirm = () => { asked = true; return false; };
  btn.click();
  if (!asked) throw new Error('no se pidió confirmación');
  if (getStats().totalScans !== 1) throw new Error('se reinició pese a cancelar');

  globalThis.confirm = () => { asked = true; return true; };
  btn.click();
  if (getStats().totalScans !== 0) throw new Error('no se reinició tras confirmar');

  delete globalThis.confirm;
  delete globalThis.document;
  delete globalThis.window;
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
