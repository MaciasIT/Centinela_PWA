/**
 * Centinela — Puntos de entrada de la épica E2 (HU-11, HU-12)
 *
 * Lógica **pura y testeable** de los caminos de entrada: qué hacer con lo que
 * lee un QR, cómo sacar el primer enlace válido de un texto compartido
 * (WhatsApp) y qué mensaje mostrar cuando la cámara no está disponible.
 *
 * No toca el DOM, ni la cámara, ni el portapapeles: por eso cada criterio de
 * aceptación de HU-11/HU-12 se puede verificar con `npm test` sin dispositivo.
 * El cableado (cámara real, subida de imagen, navegación) vive en
 * `js/scanner.js`, `js/screens/scanner.js`, `js/share.js` y `js/app.js`, que
 * usan estas funciones como única fuente de verdad.
 */
import { validateUrl } from '../api.js';

/** HU-11 AC-03 — aviso llano cuando el QR no contiene un enlace. */
export const QR_NO_LINK_MESSAGE = 'He leído el código, pero no contiene un enlace web.';

/** HU-12 AC-03 — aviso llano cuando el texto compartido no trae ninguna dirección. */
export const SHARE_NO_LINK_MESSAGE = 'He recibido un mensaje, pero no he encontrado ningún enlace dentro.';

/** Puntuación que suele quedar pegada al final de un enlace dentro de un texto. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>'"]+$/;

/** Candidatos a enlace: http(s)://… hasta el siguiente espacio o delimitador. */
const URL_CANDIDATE = /https?:\/\/[^\s<>"']+/gi;

/**
 * Resuelve el contenido leído de un código QR (HU-11 AC-01 / AC-03).
 *
 * @param {string} text texto decodificado del QR
 * @param {(raw: string) => {valid: boolean, url: string}} [validate] validador de URL (inyectable en tests)
 * @returns {{status: 'ok', url: string} | {status: 'no-link', message: string}}
 */
export function resolveQrText(text, validate = validateUrl) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (raw === '') return { status: 'no-link', message: QR_NO_LINK_MESSAGE };

  // El QR suele contener solo la URL, pero si trae texto alrededor se busca
  // igualmente la primera dirección válida dentro del contenido.
  const direct = validate(raw);
  if (direct && direct.valid) return { status: 'ok', url: direct.url };

  const embedded = extractFirstValidUrl(raw, validate);
  if (embedded) return { status: 'ok', url: embedded };

  return { status: 'no-link', message: QR_NO_LINK_MESSAGE };
}

/**
 * Extrae la **primera dirección válida** de un texto compartido (HU-12 AC-02).
 *
 * Se recorren los candidatos en orden de aparición y se devuelve el primero que
 * pasa la validación; así un texto con varias direcciones se resuelve con la
 * primera que realmente se puede comprobar (no con la primera que "parece" un
 * enlace pero apunta a algo no comprobable, como `localhost`).
 *
 * @param {string} text
 * @param {(raw: string) => {valid: boolean, url: string}} [validate]
 * @returns {string|null} URL canónica o null si no hay ninguna válida
 */
export function extractFirstValidUrl(text, validate = validateUrl) {
  const source = typeof text === 'string' ? text : '';
  const candidates = source.match(URL_CANDIDATE) || [];

  for (const candidate of candidates) {
    const cleaned = candidate.replace(TRAILING_PUNCTUATION, '');
    const check = validate(cleaned);
    if (check && check.valid) return check.url;
  }

  return null;
}

/**
 * Mensaje llano cuando la cámara no está disponible (HU-11 AC-02).
 *
 * Cubre los tres casos del diseño (permiso denegado, sin cámara, cámara
 * ocupada) y **siempre** ofrece subir una imagen, que es la salida que exige el
 * criterio de aceptación.
 *
 * @param {string} [errMessage] mensaje técnico original (getUserMedia / librería)
 * @returns {string}
 */
export function cameraUnavailableMessage(errMessage) {
  const msg = String(errMessage || '');

  let lead;
  if (/permission|notallowed|denied|permiso/i.test(msg)) {
    lead = 'No nos has dado permiso para usar la cámara.';
  } else if (/notfound|no se ha encontrado|no hemos encontrado|no.*cámara|no camera|sin cámara/i.test(msg)) {
    lead = 'No hemos encontrado ninguna cámara en este dispositivo.';
  } else if (/notreadable|trackstart|usada por otra|in use/i.test(msg)) {
    lead = 'La cámara está siendo usada por otra aplicación.';
  } else {
    lead = 'No hemos podido usar la cámara.';
  }

  return `${lead} Puedes subir una imagen del código QR en su lugar.`;
}
