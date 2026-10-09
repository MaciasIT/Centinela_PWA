/**
 * Tests de HU-09 (estados de carga didácticos con progreso real).
 * El criterio literal: si VirusTotal no ha respondido tras 8 s, aviso honesto
 * y botón de reintento manual, SIN reintentos automáticos en segundo plano.
 */
import {
  evaluate, stepIndexForElapsed, isStalled, formatElapsed,
  STEPS, STALL_AFTER_MS, STALL_MESSAGE, RETRY_LABEL,
} from '../../js/screens/loading.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

ok('HU-09: el umbral del aviso honesto es exactamente 8000 ms', () => {
  if (STALL_AFTER_MS !== 8000) throw new Error(`STALL_AFTER_MS=${STALL_AFTER_MS}`);
  if (isStalled(7999)) throw new Error('no debería avisar a 7,999 s');
  if (!isStalled(8000)) throw new Error('debería avisar a 8,000 s');
});

ok('HU-09: a los 8 s se muestra el aviso + reintento manual y no antes', () => {
  const early = evaluate(5000);
  if (early.stalled || early.retryVisible) throw new Error('no debe avisar antes de 8 s');
  const late = evaluate(8000);
  if (!late.stalled) throw new Error('debe marcar aviso a 8 s');
  if (!late.retryVisible) throw new Error('debe habilitar reintento a 8 s');
});

ok('HU-09: la carga avanza por pasos reales, no por decoración', () => {
  if (STEPS.length !== 3) throw new Error('deberían ser 3 pasos');
  if (stepIndexForElapsed(0) !== 0) throw new Error('paso inicial incorrecto');
  if (STEPS[stepIndexForElapsed(2000)] !== 'Consultando a VirusTotal') throw new Error('paso 1 incorrecto');
  if (stepIndexForElapsed(9000) !== 2) throw new Error('paso final incorrecto');
});

ok('HU-09: mensaje del aviso y etiqueta de reintento en llano', () => {
  if (!/tardando más de lo habitual/i.test(STALL_MESSAGE)) throw new Error('mensaje del aviso inesperado');
  if (RETRY_LABEL !== 'Reintentar') throw new Error('etiqueta de reintento inesperada');
  if (formatElapsed(0) !== '0 s' || formatElapsed(8000) !== '8 s') throw new Error('formatElapsed incorrecto');
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}