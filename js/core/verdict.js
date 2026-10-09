/**
 * Centinela — Clasificación única del veredicto (HU-02, HU-03, HU-04)
 *
 * ÚNICA fuente de verdad, en tres sentidos:
 *   1. La tabla de clasificación `classify()` → 'safe' | 'warning' | 'danger'.
 *   2. Los textos en llano: título (HU-03), explicación (HU-03) y los 3 pasos
 *      de «¿Qué hago ahora?» (HU-04).
 *   3. El color semántico del veredicto (nunca solo color: siempre con forma
 *      y texto). Los tokens visuales completos los aplica la identidad v2.
 *
 * Regla dura: NINGÚN otro módulo replica esta tabla. Pantalla de resultado,
 * historial y estadísticas importan SIEMPRE desde aquí. Es la red que cierra
 * el fallo F-4 (0 alertas y 2 sospechosos visto como amarillo pero guardado
 * como «Seguro»).
 *
 * @typedef {{ malicious?: number, positives?: number, suspicious?: number, total?: number }} VerdictInput
 *   `positives` es el alias del resultado normalizado de la app (equivale a `malicious`).
 */

export const VERDICT = Object.freeze({ SAFE: 'safe', WARNING: 'warning', DANGER: 'danger' });

const INFO = Object.freeze({
  safe: Object.freeze({
    key: 'safe',
    title: 'Puedes abrirlo con tranquilidad',
    explanation: 'No hemos visto nada raro en este enlace.',
    label: 'Seguro',
    plural: 'Seguros',
    icon: '✅',
    color: '#1E7A46',
    bg: '#E7F4EC',
  }),
  warning: Object.freeze({
    key: 'warning',
    title: 'Ve con cuidado',
    explanation: 'No es claramente peligroso, pero mejor no dejes tus datos aquí.',
    label: 'Dudoso',
    plural: 'Dudosos',
    icon: '⚠️',
    color: '#8A4E00',
    bg: '#FDF1DE',
  }),
  danger: Object.freeze({
    key: 'danger',
    title: '¡No abras este enlace!',
    explanation: 'Puede robarte datos o dinero. No pasa nada: mira qué hacer.',
    label: 'Peligroso',
    plural: 'Peligrosos',
    icon: '🚨',
    color: '#C0362C',
    bg: '#FCEAE7',
  }),
});

const STEPS = Object.freeze({
  safe: Object.freeze([
    'Puedes abrirlo.',
    'Si te pide datos raros, aun así no los des.',
    'Si algo te chirría, vuelve a comprobarlo.',
  ]),
  warning: Object.freeze([
    'No escribas datos (ni contraseñas ni tarjetas).',
    'Si tienes que entrar, hazlo escribiendo la dirección a mano en el navegador.',
    'Si algo te pide prisa o premios, desconfía.',
  ]),
  danger: Object.freeze([
    'No lo abras. Ni el enlace ni ningún botón del mensaje.',
    'Bórralo de tu WhatsApp.',
    'Avisa a quien te lo mandó y dile que es falso. Si diste tus datos, llama al 017 (INCIBE) y avisa a tu banco o a tu operador.',
  ]),
});

/**
 * Tabla canónica de clasificación (evaluada en este orden).
 *
 * | # | Condición                                   | Veredicto |
 * |---|---------------------------------------------|-----------|
 * | 0 | contador negativo o no numérico (inválido)  | warning   |
 * | 1 | total === 0                                 | warning   |
 * | 2 | malicious > 3                               | danger    |
 * | 3 | malicious >= 1 || suspicious >= 1           | warning   |
 * | 4 | en otro caso                                | safe      |
 *
 * @param {VerdictInput} input
 * @returns {'safe'|'warning'|'danger'}
 */
export function classify(input) {
  const malicious = toCount(input?.malicious ?? input?.positives);
  const suspicious = toCount(input?.suspicious);
  const total = toCount(input?.total);

  // Dato inconsistente (contador negativo o no numérico) → no es fiable.
  // Precaución, nunca «limpio» (H-3): un valor negativo no puede leerse como seguro.
  if (malicious === null || suspicious === null || total === null) return VERDICT.WARNING;

  if (total === 0) return VERDICT.WARNING;
  if (malicious > 3) return VERDICT.DANGER;
  if (malicious >= 1 || suspicious >= 1) return VERDICT.WARNING;
  return VERDICT.SAFE;
}

/**
 * Textos y color de un veredicto. Siempre devuelve una entrada válida.
 * @param {'safe'|'warning'|'danger'} verdict
 */
export function verdictInfo(verdict) {
  return INFO[verdict] || INFO.warning;
}

/**
 * Los 3 pasos de «¿Qué hago ahora?» para un veredicto (HU-04).
 * @param {'safe'|'warning'|'danger'} verdict
 * @returns {readonly string[]}
 */
export function verdictSteps(verdict) {
  return STEPS[verdict] || STEPS.warning;
}

/**
 * Sanea un contador de la tabla de clasificación.
 * - Ausente (`undefined`/`null`/`''`) → 0 (sin señal).
 * - Negativo o no numérico → `null` (dato inválido: la clasificación lo trata
 *   como no fiable y devuelve precaución, nunca «limpio»).
 */
function toCount(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}