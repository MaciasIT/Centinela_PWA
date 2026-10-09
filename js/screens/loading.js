/**
 * Centinela — Loading Screen (HU-09)
 *
 * Progreso honesto: pasos que el sistema SÍ conoce + contador de tiempo.
 * A los 8 s sin respuesta, aviso honesto y botón de reintento MANUAL.
 * No hay reintentos automáticos en segundo plano (el núcleo no reconsulta solo).
 */

export const STEPS = Object.freeze([
  'Preparando el enlace',
  'Consultando a VirusTotal',
  'Recogiendo el resultado',
]);

export const STALL_AFTER_MS = 8000;
export const STALL_MESSAGE = 'La comprobación está tardando más de lo habitual.';
export const RETRY_LABEL = 'Reintentar';

const STEP_THRESHOLDS_MS = [1500, 4000]; // límites de paso 0→1 y 1→2

/**
 * Índice de paso según el tiempo transcurrido (progreso real, no decorativo).
 * @param {number} elapsedMs
 */
export function stepIndexForElapsed(elapsedMs) {
  if (elapsedMs >= STEP_THRESHOLDS_MS[1]) return 2;
  if (elapsedMs >= STEP_THRESHOLDS_MS[0]) return 1;
  return 0;
}

/** ¿Ha superado el umbral de aviso honesto? */
export function isStalled(elapsedMs) {
  return elapsedMs >= STALL_AFTER_MS;
}

/** Contador de segundos visible. */
export function formatElapsed(elapsedMs) {
  return `${Math.floor(elapsedMs / 1000)} s`;
}

/**
 * Estado observable de la pantalla de carga para un tiempo dado.
 * @param {number} elapsedMs
 */
export function evaluate(elapsedMs) {
  const stepIndex = stepIndexForElapsed(elapsedMs);
  const stalled = isStalled(elapsedMs);
  return {
    stepIndex,
    stepLabel: STEPS[stepIndex],
    elapsedMs,
    elapsedLabel: formatElapsed(elapsedMs),
    stalled,
    retryVisible: stalled,
  };
}

let timer = null;
let startedAt = 0;
let onRetry = null;

const $ = (id) => document.getElementById(id);

/** Pinta el estado en los elementos del DOM (tolerante a elementos ausentes). */
function paint() {
  const state = evaluate(Date.now() - startedAt);
  const stepNodes = document.querySelectorAll('#loading-steps .loading-step');
  stepNodes.forEach((node, i) => {
    node.classList.toggle('active', i === state.stepIndex);
    node.classList.toggle('done', i < state.stepIndex);
  });
  const stepText = $('loading-step-text');
  if (stepText) stepText.textContent = state.stepLabel;
  const timerEl = $('loading-timer');
  if (timerEl) timerEl.textContent = state.elapsedLabel;
  const warning = $('loading-warning');
  if (warning) warning.hidden = !state.stalled;
}

/**
 * @param {HTMLElement} _container
 * @param {{ onRetry?: () => void }} [data]
 */
export function mount(_container, data) {
  onRetry = data && typeof data.onRetry === 'function' ? data.onRetry : null;
  startedAt = Date.now();
  const retryBtn = $('loading-retry');
  if (retryBtn) {
    retryBtn.textContent = RETRY_LABEL;
    retryBtn.onclick = () => { if (onRetry) onRetry(); };
  }
  const warning = $('loading-warning');
  if (warning) warning.hidden = true;
  paint();
  if (timer) clearInterval(timer);
  timer = setInterval(paint, 1000);
}

export function unmount() {
  if (timer) clearInterval(timer);
  timer = null;
  onRetry = null;
}