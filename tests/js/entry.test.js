/**
 * Tanda 4a — Entrada (E2): lectura de QR (HU-11) y enlace compartido (HU-12).
 *
 * Prueba la lógica pura de `js/core/entry.js`: qué se hace con lo que lee un QR,
 * cómo se saca el primer enlace válido de un texto y qué mensaje se da cuando no
 * hay cámara. Cada bloque cita el criterio de aceptación que cubre.
 */
import {
  resolveQrText,
  extractFirstValidUrl,
  cameraUnavailableMessage,
  QR_NO_LINK_MESSAGE,
} from '../../js/core/entry.js';
import { validateUrl } from '../../js/api.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

/* ── HU-11 AC-01: al apuntar a un QR se lee el enlace y se lanza la comprobación ── */

ok('HU-11 AC-01: un QR con una URL devuelve estado «ok» y un enlace https', () => {
  const r = resolveQrText('https://www.ejemplo.com/promo?utm_source=qr');
  if (r.status !== 'ok') throw new Error(`se esperaba ok, llegó ${r.status}`);
  // La canonicalización fina (quitar www/utm) la hace api.js al analizar; aquí
  // basta con que sea un enlace https válido.
  if (!/^https:\/\//.test(r.url) || !r.url.includes('ejemplo.com/promo')) {
    throw new Error(`URL inesperada: ${r.url}`);
  }
});

ok('HU-11 AC-01: un QR con un dominio sin esquema se acepta (se asume https)', () => {
  const r = resolveQrText('www.tu-banco.es');
  if (r.status !== 'ok') throw new Error(`se esperaba ok, llegó ${r.status}`);
  if (r.url !== 'https://www.tu-banco.es/') throw new Error(`URL inesperada: ${r.url}`);
});

ok('HU-11 AC-01: si el QR trae texto alrededor, se extrae el enlace válido', () => {
  const r = resolveQrText('Oferta imperdible -> https://tienda-ejemplo.com/rebajas');
  if (r.status !== 'ok') throw new Error(`se esperaba ok, llegó ${r.status}`);
  if (r.url !== 'https://tienda-ejemplo.com/rebajas') throw new Error(`URL inesperada: ${r.url}`);
});

/* ── HU-11 AC-03: si el QR no contiene un enlace → aviso llano y NINGUNA consulta ── */

ok('HU-11 AC-03: un QR con texto sin enlace devuelve estado «no-link» con aviso llano', () => {
  const r = resolveQrText('Hola, buenos días');
  if (r.status !== 'no-link') throw new Error(`se esperaba no-link, llegó ${r.status}`);
  if (r.message !== QR_NO_LINK_MESSAGE) throw new Error(`mensaje inesperado: ${r.message}`);
  if (!/no contiene un enlace/i.test(r.message)) throw new Error('el aviso debe decir que no hay enlace');
});

ok('HU-11 AC-03: un QR vacío tampoco lanza consulta', () => {
  const r = resolveQrText('   ');
  if (r.status !== 'no-link') throw new Error(`se esperaba no-link, llegó ${r.status}`);
});

ok('HU-11 AC-03: una IP local NO se considera enlace comprobable', () => {
  const r = resolveQrText('http://192.168.1.10/router');
  if (r.status !== 'no-link') throw new Error(`una IP local no debe comprobarse, llegó ${r.status}`);
});

/* ── HU-11 AC-02: sin cámara / sin permiso → mensaje que ofrece subir una imagen ── */

ok('HU-11 AC-02: permiso denegado ofrece subir una imagen', () => {
  const msg = cameraUnavailableMessage('NotAllowedError: Permission denied');
  if (!/permiso/i.test(msg)) throw new Error(`debe hablar de permiso: ${msg}`);
  if (!/subir una imagen/i.test(msg)) throw new Error(`debe ofrecer subir una imagen: ${msg}`);
});

ok('HU-11 AC-02: sin cámara ofrece subir una imagen', () => {
  const msg = cameraUnavailableMessage('NotFoundError: no se ha encontrado ninguna cámara');
  if (!/cámara/i.test(msg)) throw new Error(`debe hablar de cámara: ${msg}`);
  if (!/subir una imagen/i.test(msg)) throw new Error(`debe ofrecer subir una imagen: ${msg}`);
});

ok('HU-11 AC-02: cámara ocupada ofrece subir una imagen', () => {
  const msg = cameraUnavailableMessage('NotReadableError: TrackStartError');
  if (!/subir una imagen/i.test(msg)) throw new Error(`debe ofrecer subir una imagen: ${msg}`);
});

ok('HU-11 AC-02: cualquier error desconocido también ofrece subir una imagen', () => {
  const msg = cameraUnavailableMessage('');
  if (!/subir una imagen/i.test(msg)) throw new Error(`debe ofrecer subir una imagen: ${msg}`);
});

/* ── HU-12 AC-02: varias direcciones → se comprueba la PRIMERA válida ── */

ok('HU-12 AC-02: de un texto con varias direcciones devuelve la primera válida', () => {
  const url = extractFirstValidUrl('Mira esto https://primera.com/a y también https://segunda.com/b');
  if (url !== 'https://primera.com/a') throw new Error(`se esperaba la primera: ${url}`);
});

ok('HU-12 AC-02: si la primera no es comprobable, usa la siguiente válida', () => {
  const url = extractFirstValidUrl('http://localhost:3000/x luego https://real.com/y');
  if (url !== 'https://real.com/y') throw new Error(`debe saltar la no comprobable: ${url}`);
});

ok('HU-12 AC-02: limpia la puntuación pegada al final del enlace', () => {
  const url = extractFirstValidUrl('Enlace: https://ejemplo.com/pagina.');
  if (url !== 'https://ejemplo.com/pagina') throw new Error(`puntuación no limpiada: ${url}`);
});

/* ── HU-12 AC-03: sin ninguna dirección → no hay URL (la app dará aviso llano) ── */

ok('HU-12 AC-03: un texto sin direcciones devuelve null', () => {
  const url = extractFirstValidUrl('¿Quedamos mañana? Sin enlaces aquí');
  if (url !== null) throw new Error(`se esperaba null, llegó ${url}`);
});

ok('HU-12 AC-03: un texto vacío devuelve null', () => {
  if (extractFirstValidUrl('') !== null) throw new Error('texto vacío debe devolver null');
  if (extractFirstValidUrl(undefined) !== null) throw new Error('undefined debe devolver null');
});

/* ── Guarda: el validador inyectado se usa (contrato de testabilidad) ── */

ok('el validador inyectado se respeta (no se ignora el parámetro)', () => {
  const alwaysValid = (raw) => ({ valid: true, url: `X:${raw}` });
  const r = resolveQrText('lo que sea', alwaysValid);
  if (r.status !== 'ok' || r.url !== 'X:lo que sea') throw new Error('no se usó el validador inyectado');
  // El validador real sigue siendo el de por defecto.
  if (validateUrl('https://ejemplo.com').valid !== true) throw new Error('validateUrl real roto');
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
