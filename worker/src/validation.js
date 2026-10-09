/**
 * Centinela — Validación de URL del Worker (HU-31 · RC-04)
 *
 * `validateUrl()` es la comprobación de esquema/longitud/host que se hace ANTES
 * de gastar cuota de VirusTotal (arquitectura §5.2, orden 3→7).
 *
 * `normalizeUrl()` NO se implementa aquí: es el **normalizador único compartido**
 * de `js/core/validation.js` (RC-04), el mismo que usa el cliente. Este módulo lo
 * reexporta para que el Worker siga teniendo un único punto de import (C-1/C-3,
 * Tanda 3c). No hay dos versiones ni dos contratos.
 */

import {
  MAX_URL_LENGTH,
  isBlockedHost,
  isTrackingParam,
  normalizeUrl,
} from '../../js/core/validation.js';

export { MAX_URL_LENGTH, isTrackingParam, normalizeUrl };

/** Tamaño máximo del cuerpo de `POST /api/scan` (8 KB). */
export const MAX_BODY_BYTES = 8 * 1024;

/** Códigos de error internos permitidos por el contrato (§5.2, principio 4). */
export const ERROR_MESSAGES = Object.freeze({
  INVALID_JSON: 'No se ha podido leer la petición.',
  INVALID_URL: 'Esto no parece un enlace web que se pueda comprobar.',
  URL_TOO_LONG: 'El enlace es demasiado largo para comprobarlo.',
  FORBIDDEN_ORIGIN: 'Este sitio no tiene permiso para usar el servicio.',
  RATE_LIMITED: 'Has hecho muchas comprobaciones seguidas. Espera un minuto e inténtalo otra vez.',
  QUOTA_EXCEEDED: 'El servicio está muy solicitado ahora mismo, así que no se ha podido comprobar este enlace. Inténtalo dentro de un minuto.',
  UPSTREAM_UNAVAILABLE: 'No se ha podido contactar con el servicio de comprobación. Inténtalo de nuevo en un momento.',
  INTERNAL: 'Algo ha fallado por nuestra parte. Inténtalo de nuevo.',
});

function fail(code, message) {
  return { ok: false, code, message: message || ERROR_MESSAGES[code] };
}

/**
 * Valida una URL antes de gastar cuota (arquitectura §5.2, orden 3→7).
 *
 * El host se comprueba con el filtro compartido `isBlockedHost` (IP literal,
 * localhost —incluida la forma raíz `localhost.`, H-5— y nombres sin punto).
 *
 * @param {unknown} raw
 * @returns {{ok: true, url: string} | {ok: false, code: string, message: string}}
 */
export function validateUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return fail('INVALID_URL');

  const candidate = raw.trim();
  if (candidate.length > MAX_URL_LENGTH) return fail('URL_TOO_LONG');

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return fail('INVALID_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('INVALID_URL');

  if (isBlockedHost(parsed.hostname)) return fail('INVALID_URL');

  return { ok: true, url: candidate };
}
