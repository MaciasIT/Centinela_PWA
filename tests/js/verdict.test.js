/**
 * Tests de contrato de HU-02 (veredicto único y coherente) + HU-03/HU-04 (textos).
 *
 * El test de contrato anti-divergencia es el entregable clave de la Tanda 2:
 * un mismo resultado normalizado DEBE producir idéntico veredicto en pantalla,
 * historial y estadísticas. Es la red que impide que vuelva el fallo F-4
 * (positives=0 & suspicious=2 → se veía amarillo pero se guardaba como "Seguro").
 */
import { parseHTML } from 'linkedom';
import { classify, verdictInfo, verdictSteps } from '../../js/core/verdict.js';
import { recordScanOutcome } from '../../js/core/scan-record.js';
import * as resultScreen from '../../js/screens/result.js';
import { getHistory, clearHistory } from '../../js/history.js';
import { getStats } from '../../js/stats.js';
import { buildShareText } from '../../js/share.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

// Fixtures: forma canónica {malicious,suspicious,total}. Se prueban también
// como alias `positives` (forma normalizada que usa el resto de la app).
const FIXTURES = [
  { input: { malicious: 0, suspicious: 2, total: 70 }, expected: 'warning', why: 'F-4: 0 alertas y 2 sospechosos NUNCA es seguro' },
  { input: { malicious: 0, suspicious: 0, total: 70 }, expected: 'safe' },
  { input: { malicious: 5, suspicious: 1, total: 70 }, expected: 'danger' },
  { input: { malicious: 4, suspicious: 0, total: 70 }, expected: 'danger', why: 'malicious > 3 → rojo' },
  { input: { malicious: 3, suspicious: 0, total: 70 }, expected: 'warning', why: 'malicious > 3 es estricto' },
  { input: { malicious: 1, suspicious: 0, total: 70 }, expected: 'warning' },
  { input: { malicious: 0, suspicious: 0, total: 0 }, expected: 'warning', why: 'sin datos = precaución, nunca seguro' },
];

ok('HU-02: la tabla única clasifica todos los casos canónicos', () => {
  for (const f of FIXTURES) {
    const got = classify(f.input);
    if (got !== f.expected) throw new Error(`${JSON.stringify(f.input)} → ${got}, esperado ${f.expected}`);
  }
});

ok('HU-02: classify acepta el alias positives del resultado normalizado', () => {
  const a = classify({ positives: 0, suspicious: 2, total: 70 });
  if (a !== 'warning') throw new Error(`positives=0,suspicious=2 → ${a}, esperado warning`);
  const b = classify({ positives: 5, total: 70 });
  if (b !== 'danger') throw new Error(`positives=5 → ${b}, esperado danger`);
  const c = classify({});
  if (c !== 'warning') throw new Error(`vacío → ${c}, esperado warning`);
});

ok('HU-03: cada veredicto tiene título y explicación en llano no vacíos', () => {
  for (const v of ['safe', 'warning', 'danger']) {
    const info = verdictInfo(v);
    if (!info.title || !info.explanation) throw new Error(`${v} no tiene título/explicación`);
  }
  if (!verdictInfo('safe').title.includes('tranquilidad')) throw new Error('título de verde no es el esperado');
  if (!verdictInfo('danger').title.includes('No abras')) throw new Error('título de rojo no es el esperado');
});

ok('HU-04: cada veredicto tiene exactamente 3 pasos; el rojo cita 017, banco y operador', () => {
  for (const v of ['safe', 'warning', 'danger']) {
    const steps = verdictSteps(v);
    if (!Array.isArray(steps) || steps.length !== 3) throw new Error(`${v} no tiene 3 pasos`);
    if (steps.some((s) => !s || s.length < 10)) throw new Error(`${v} tiene un paso vacío o trivial`);
  }
  const red = verdictSteps('danger').join(' ');
  for (const ref of ['017', 'banco', 'operador']) {
    if (!red.toLowerCase().includes(ref)) throw new Error(`el rojo no cita "${ref}": ${red}`);
  }
});

ok('HU-02: los tres estados declaran color semántico', () => {
  for (const v of ['safe', 'warning', 'danger']) {
    const info = verdictInfo(v);
    if (!/^#[0-9A-Fa-f]{6}$/.test(info.color || '')) throw new Error(`${v} sin color válido`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(info.bg || '')) throw new Error(`${v} sin tinte válido`);
  }
});

ok('HU-02: el texto que se comparte usa el mismo veredicto (0 alertas y 2 sospechosos → DUDOSO)', () => {
  const text = buildShareText('https://ejemplo.example', { positives: 0, suspicious: 2, total: 70 });
  if (!/DUDOSO/.test(text)) throw new Error(`el texto compartido no refleja el veredicto dudoso: ${text}`);
  if (/SEGURO/.test(text)) throw new Error('el texto compartido vuelve a decir SEGURO en un caso dudoso');
});

/* ── Test de contrato anti-divergencia (el entregable clave) ── */

let document;
function bootDom() {
  const html = `<!DOCTYPE html><html><body>
    <div id="screen-result" class="screen">
      <div id="result-icon" class="result-traffic-light"></div>
      <h2 id="result-title" class="result-title">—</h2>
      <p id="result-message" class="result-message">—</p>
      <button id="btn-what-now" aria-expanded="false" disabled></button>
      <ol id="result-what-now-steps"></ol>
      <div id="result-url-card"><p id="result-url">—</p></div>
      <div id="result-details"><div id="result-details-content"></div></div>
      <div id="result-trust" style="display:none"></div>
      <div id="result-brand" style="display:none">
        <span id="brand-icon"></span><span id="brand-msg"></span><p id="brand-detail"></p>
      </div>
      <div id="result-xray" style="display:none"><p id="result-final-url"></p><p id="result-page-title"></p></div>
      <button id="btn-open-url"></button><button id="btn-sos"></button><button id="btn-preview"></button>
      <button id="btn-share"></button><button id="btn-new-check"></button>
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

ok('HU-02 CONTRATO: el cableado real mantiene pantalla, historial y estadísticas en el mismo veredicto', () => {
  for (const f of FIXTURES) {
    clearHistory();
    localStorage.removeItem('centinela_stats');

    const result = {
      positives: f.input.malicious ?? 0,
      suspicious: f.input.suspicious ?? 0,
      total: f.input.total ?? 0,
      url: 'https://contrato.example',
    };
    // URL única por caso para no chocar con el dedupe de 5 min del historial.
    const url = `https://contrato.example/${Math.random()}`;

    // 1) CABLEADO REAL: la MISMA función que usa app.js en producción
    //    (clasificar → guardar en historial → registrar en estadísticas).
    //    Ya NO se replica a mano el cableado: se ejercita el de verdad.
    const verdict = recordScanOutcome(url, result);
    if (verdict !== f.expected) {
      throw new Error(`cableado: ${JSON.stringify(f.input)} → ${verdict}, esperado ${f.expected}`);
    }

    // 2) HISTORIAL: el veredicto guardado es exactamente el que devolvió el cableado.
    const entry = getHistory()[0];
    if (!entry || entry.status !== verdict) {
      throw new Error(`historial: ${entry && entry.status} != ${verdict} para ${JSON.stringify(f.input)}`);
    }

    // 3) ESTADÍSTICAS: cuentan el mismo veredicto.
    const stats = getStats();
    const bucket = { safe: stats.safeCount, warning: stats.warningCount, danger: stats.dangerCount }[verdict];
    if (bucket !== 1) throw new Error(`estadísticas: bucket ${verdict}=${bucket}, esperado 1`);

    // 4) PANTALLA: mismo veredicto y mismo título que el guardado.
    bootDom();
    resultScreen.mount(document.getElementById('screen-result'), { result, url });
    const iconClass = document.getElementById('result-icon').className;
    if (!iconClass.split(/\s+/).includes(verdict)) {
      throw new Error(`pantalla: clase "${iconClass}" no incluye ${verdict} para ${JSON.stringify(f.input)}`);
    }
    const title = document.getElementById('result-title').textContent;
    if (title !== verdictInfo(verdict).title) {
      throw new Error(`pantalla: título "${title}" != "${verdictInfo(verdict).title}"`);
    }
    tearDownDom();
  }
  clearHistory();
});

ok('HU-02/H-2: historial y estadísticas cuentan lo mismo (un reescaneo duplicado no infla las estadísticas)', () => {
  clearHistory();
  localStorage.removeItem('centinela_stats');

  const url = 'https://duplicado.example';
  const result = { positives: 0, suspicious: 0, total: 70 };

  recordScanOutcome(url, result); // 1ª vez: entra en historial y cuenta
  recordScanOutcome(url, result); // reescaneo < 5 min: el historial lo descarta

  const histCount = getHistory().length;
  const stats = getStats();
  const statsCount = stats.safeCount + stats.warningCount + stats.dangerCount;

  if (histCount !== 1) throw new Error(`historial: ${histCount} entradas, esperado 1 (dedupe de 5 min)`);
  if (statsCount !== histCount) {
    throw new Error(`desincronizados: historial=${histCount}, estadísticas=${statsCount}`);
  }

  clearHistory();
  localStorage.removeItem('centinela_stats');
});

ok('HU-02/H-3: un contador negativo no se lee como «limpio»', () => {
  const inconsistentes = [
    { malicious: -1, suspicious: 0, total: 5 },
    { malicious: 0, suspicious: -2, total: 5 },
    { malicious: 0, suspicious: 0, total: -5 },
  ];
  for (const c of inconsistentes) {
    const got = classify(c);
    if (got === 'safe') throw new Error(`dato inconsistente ${JSON.stringify(c)} leído como seguro`);
    if (got !== 'warning') throw new Error(`${JSON.stringify(c)} → ${got}, esperado warning`);
  }
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}