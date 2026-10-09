/**
 * Tanda 4a — Compartir (HU-13) y enlace compartido (HU-12).
 *
 * Prueba `js/share.js`: el texto llano del veredicto, el share nativo, el
 * respaldo por portapapeles con confirmación visible y la lectura del Web Share
 * Target. Sin navegador real: se inyecta un `navigator` y una `window` falsos.
 */
import {
  buildShareText,
  shareResult,
  shareConfirmation,
  parseShareParams,
  consumeSharedTarget,
} from '../../js/share.js';

const results = [];
const asyncTests = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}
function okAsync(name, fn) {
  asyncTests.push(async () => {
    try { await fn(); results.push({ ok: true, name }); }
    catch (e) { results.push({ ok: false, name, error: String(e) }); }
  });
}

/** Ejecuta `fn` con un `navigator` falso y restaura el original. */
async function withNavigator(nav, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  try { return await fn(); }
  finally {
    if (had) Object.defineProperty(globalThis, 'navigator', had);
    else delete globalThis.navigator;
  }
}

const dangerResult = { positives: 5, total: 70, suspicious: 1, harmless: 64, undetected: 0, url: 'https://peligro.com' };

/* ── HU-13 AC-01: el veredicto se comparte en texto llano ── */

ok('HU-13 AC-01: el texto de compartir lleva el veredicto en llano y la URL', () => {
  const text = buildShareText('https://peligro.com', dangerResult);
  if (!/PELIGROSO/i.test(text)) throw new Error(`falta el veredicto en llano: ${text}`);
  if (!text.includes('https://peligro.com')) throw new Error(`falta la URL: ${text}`);
  if (/[<>]/.test(text)) throw new Error('el texto no debe contener HTML');
});

okAsync('HU-13 AC-01: con Web Share disponible se abre el menú del móvil', async () => {
  let sharedPayload = null;
  await withNavigator({ share: async (data) => { sharedPayload = data; } }, async () => {
    const res = await shareResult('https://peligro.com', dangerResult);
    if (res.shared !== true || res.method !== 'native') throw new Error(`método inesperado: ${JSON.stringify(res)}`);
    if (!sharedPayload || !/PELIGROSO/i.test(sharedPayload.text || '')) throw new Error('no se compartió el veredicto');
  });
});

okAsync('HU-13 AC-01: si el usuario cancela el share nativo, no se copia nada', async () => {
  const abort = Object.assign(new Error('cancelado'), { name: 'AbortError' });
  await withNavigator({ share: async () => { throw abort; } }, async () => {
    const res = await shareResult('https://peligro.com', dangerResult);
    if (res.method !== 'cancelled') throw new Error(`se esperaba cancelled: ${JSON.stringify(res)}`);
  });
});

/* ── HU-13 AC-02: sin share nativo → portapapeles + confirmación visible ── */

okAsync('HU-13 AC-02: sin Web Share se copia al portapapeles', async () => {
  let copied = null;
  await withNavigator({ clipboard: { writeText: async (t) => { copied = t; } } }, async () => {
    const res = await shareResult('https://peligro.com', dangerResult);
    if (res.shared !== true || res.method !== 'clipboard') throw new Error(`método inesperado: ${JSON.stringify(res)}`);
    if (!copied || !/PELIGROSO/i.test(copied)) throw new Error('no se copió el veredicto');
  });
});

ok('HU-13 AC-02: la confirmación visible existe solo al copiar', () => {
  const msg = shareConfirmation('clipboard');
  if (!msg) throw new Error('debe haber confirmación al copiar');
  if (shareConfirmation('native') !== null) throw new Error('el share nativo no necesita confirmación propia');
  if (shareConfirmation('cancelled') !== null) throw new Error('cancelar no debe confirmar');
});

/* ── HU-12 AC-01/AC-02/AC-03: lectura del Web Share Target ── */

ok('HU-12 AC-01: los parámetros del share_target contienen el enlace compartido', () => {
  const p = parseShareParams('?url=https%3A%2F%2Fejemplo.com%2Fx');
  if (!p.present) throw new Error('debe detectar contenido compartido');
  if (p.url !== 'https://ejemplo.com/x') throw new Error(`URL inesperada: ${p.url}`);
});

ok('HU-12 AC-01: el enlace también se extrae del campo `text`', () => {
  const p = parseShareParams('?text=Mirar%20esto%20https%3A%2F%2Fwhatsapp-enviado.com%2Foferta');
  if (p.url !== 'https://whatsapp-enviado.com/oferta') throw new Error(`URL inesperada: ${p.url}`);
});

ok('HU-12 AC-02: con varias direcciones en el texto toma la primera válida', () => {
  const p = parseShareParams('?text=https%3A%2F%2Fprimera.com%2Fa%20y%20https%3A%2F%2Fsegunda.com%2Fb');
  if (p.url !== 'https://primera.com/a') throw new Error(`debe tomar la primera: ${p.url}`);
});

ok('HU-12 AC-03: contenido compartido sin enlace → present=true y url=null', () => {
  const p = parseShareParams('?text=Buenos%20d%C3%ADas%2C%20quedamos%20ma%C3%B1ana');
  if (!p.present) throw new Error('debe detectar que había contenido');
  if (p.url !== null) throw new Error(`no debía haber URL: ${p.url}`);
});

ok('HU-12 AC-03: sin parámetros de share → present=false', () => {
  const p = parseShareParams('');
  if (p.present) throw new Error('sin query no hay contenido compartido');
  if (p.url !== null) throw new Error('sin query no hay URL');
});

ok('HU-12 AC-01: consumeSharedTarget limpia la URL tras leerla (no reprocesa)', () => {
  let replaced = null;
  const fakeWindow = {
    location: { search: '?text=https%3A%2F%2Fejemplo.com%2Fz', pathname: '/' },
    history: { replaceState: (_s, _t, url) => { replaced = url; } },
  };
  const payload = consumeSharedTarget(fakeWindow);
  if (payload.url !== 'https://ejemplo.com/z') throw new Error(`URL inesperada: ${payload.url}`);
  if (replaced !== '/') throw new Error('debe limpiar la query con replaceState');
});

ok('consumeSharedTarget sin window devuelve un payload vacío (no revienta)', () => {
  const p = consumeSharedTarget(undefined);
  if (p.present || p.url) throw new Error('debe devolver payload vacío');
});

export async function run() {
  for (const t of asyncTests) await t();
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
