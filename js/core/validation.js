/**
 * Centinela — Validación y normalización de URL (HU-31 · RC-04) — MÓDULO ÚNICO
 *
 * ÚNICA implementación de `normalizeUrl` en toda la aplicación (RC-04,
 * arquitectura §5.3.2): la usa el cliente (clave de caché local + dedupe) y la
 * reutiliza el Worker (`worker/src/validation.js` la reexporta). No hay dos
 * versiones ni dos contratos.
 *
 * ── C-1 (Tanda 3c): el esquema NO se toca ────────────────────────────
 * La normalización descarta los parámetros de seguimiento, ordena la query y
 * quita el fragmento (mismo recurso → misma clave), pero **NO cambia el
 * esquema que escribió el usuario**. Forzar `https` haría analizar una variante
 * distinta de un sitio solo-`http`, que puede no existir o ser otra cosa: eso
 * sería un **veredicto sobre un recurso distinto**, inaceptable aquí. La URL
 * que se envía a VirusTotal conserva su `http`/`https` original.
 *
 * Por el mismo motivo se conserva el **puerto explícito** (`https://host:8443/x`
 * no es el mismo recurso que `https://host/x`). El parser de WHATWG ya omite el
 * puerto cuando es el de por defecto.
 */

/** HU-31 AC-02: longitud máxima de la URL aceptada. */
export const MAX_URL_LENGTH = 2048;

/* ── Parámetros de seguimiento (RC-04, paso 6) ───────────────────── */

const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_eid', 'mc_cid', 'igshid', 'si',
  'srsltid', '_ga', '_gl', 'ref', 'ref_src', 'ref_url', 'yclid', 'twclid', 'mkt_tok',
  'oly_anon_id', 'oly_enc_id', 'vero_id', 'wickedid', '__s',
]);

const TRACKING_PREFIXES = ['utm_'];

/** ¿Es un parámetro de seguimiento que debe descartarse antes de consultar/cachear? */
export function isTrackingParam(name) {
  const n = String(name).toLowerCase();
  return TRACKING_PARAMS.has(n) || TRACKING_PREFIXES.some((p) => n.startsWith(p));
}

/* ── Host: qué NO se debe comprobar ──────────────────────────────── */

const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;

/** ¿El host es una IP literal (v4 o v6)? Las IPs literales no se comprueban. */
export function isIpLiteral(hostname) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '');
  if (IPV4_LITERAL.test(host)) return true;
  if (host.includes(':')) return true; // IPv6
  return false;
}

/**
 * ¿El host está fuera del alcance del producto (IP literal, localhost, dominio
 * interno o nombre sin punto)? Se normaliza el punto final del FQDN raíz antes
 * de comparar, de modo que `localhost.` y `foo.localhost.` también se rechazan
 * (hallazgo H-5 de la revisión de seguridad de la Tanda 3a).
 *
 * @param {string} hostname host tal como lo devuelve `new URL().hostname`
 * @returns {boolean} true si el host NO debe comprobarse
 */
export function isBlockedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.+$/, '');
  if (host === '') return true;
  if (!host.includes('.')) return true;              // sin punto → no es dominio público
  if (isIpLiteral(host)) return true;                // IP literal v4/v6
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  return false;
}

/* ── Entrada del usuario ─────────────────────────────────────────── */

/**
 * Prepara la entrada de un usuario para poder parsearla: si NO trae esquema, se
 * asume `https`. No pisa un esquema explícito (`http://` se respeta — C-1).
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function withDefaultScheme(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === '') return s;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/* ── Normalización canónica (RC-04) ──────────────────────────────── */

/**
 * Clave canónica de una URL (arquitectura §5.3.2, RC-04).
 *
 * Transformación exacta, en este orden:
 *   1. parsear (si falla → null: la validación previa ya lo rechaza)
 *   2. esquema: **se conserva** el que escribió el usuario (`http`/`https`) — C-1
 *   3. host en minúsculas, sin `www.` inicial y **conservando el puerto** explícito
 *   4. path: se colapsa el vacío a `/` y se quita la barra final sobrante
 *      (los segmentos `.`/`..` los resuelve `URL`); el resto se conserva tal cual,
 *      porque el path SÍ distingue mayúsculas
 *   5. fragmento `#…` descartado
 *   6. parámetros de seguimiento descartados
 *   7. resto ordenado alfabéticamente por nombre y, a igual nombre, por valor
 *   8. `esquema//host + path + (?query)`, sin fragmento
 *
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;

  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const scheme = parsed.protocol; // 'http:' | 'https:' — se PRESERVA (C-1)
  const host = parsed.host.toLowerCase().replace(/^www\./, '');

  let path = parsed.pathname || '/';
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (path === '') path = '/';

  const pairs = [];
  for (const [name, value] of parsed.searchParams.entries()) {
    if (isTrackingParam(name)) continue;
    pairs.push([name, value]);
  }
  pairs.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
    return 0;
  });

  const query = new URLSearchParams(pairs).toString();
  return `${scheme}//${host}${path}${query ? `?${query}` : ''}`;
}
