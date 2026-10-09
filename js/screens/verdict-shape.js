/**
 * Centinela — Forma propia de cada veredicto (Tanda 5b).
 *
 * El veredicto NUNCA se comunica solo con color: cada estado lleva además una
 * FORMA con silueta distinta (marca de visto, triángulo, octágono, signo de
 * interrogación). Así los tres estados siguen distinguiéndose en escala de
 * grises y con daltonismo. El color lo pone el contenedor; aquí solo se dibuja
 * la forma (SVG en línea, sin recursos externos).
 *
 * Es presentación pura: no clasifica nada. La clasificación vive en
 * core/verdict.js y no se toca.
 */

export const SHAPE_NAMES = Object.freeze({
  safe: 'check',
  warning: 'triangle',
  danger: 'octagon',
  unchecked: 'question',
});

/** Nombre de la forma de un veredicto (con reserva prudente). */
export function verdictShape(status) {
  return SHAPE_NAMES[status] || 'triangle';
}

const MARKS = {
  // Marca de visto: trazo grueso, sin relleno.
  check: '<path d="M18 33l10 10 19-22" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
  // Triángulo de aviso con exclamación del color del veredicto (recorte).
  triangle:
    '<path d="M32 8L58 54H6Z" fill="currentColor" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>' +
    '<rect x="29" y="23" width="6" height="17" rx="3" fill="var(--color-warning)"/>' +
    '<circle cx="32" cy="47" r="3.4" fill="var(--color-warning)"/>',
  // Octágono de peligro (forma de señal de STOP) con exclamación.
  octagon:
    '<path d="M20 4h24l16 16v24L44 60H20L4 44V20Z" fill="currentColor"/>' +
    '<rect x="29" y="18" width="6" height="19" rx="3" fill="var(--color-danger)"/>' +
    '<circle cx="32" cy="47" r="3.4" fill="var(--color-danger)"/>',
  // Interrogación: no sabemos.
  question:
    '<path d="M24 24a8 8 0 0116 0c0 6-8 7-8 12" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>' +
    '<circle cx="32" cy="50" r="4" fill="currentColor"/>',
};

/**
 * Devuelve el SVG (en línea) de la forma de un veredicto.
 * @param {'safe'|'warning'|'danger'|'unchecked'} status
 * @param {{size?: number}} [opts]
 */
export function verdictShapeSvg(status, opts = {}) {
  const size = opts.size || 46;
  const mark = MARKS[verdictShape(status)];
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${mark}</svg>`;
}