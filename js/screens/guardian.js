/**
 * Centinela — Ángel de la Guarda (HU-27)
 *
 * Un ÚNICO cableado del botón «Preguntar» (`bindSosButton`), invocado una sola
 * vez desde app.js. Cierra F-5: antes había dos listeners sobre `#btn-sos`
 * (uno en app.js y otro en el antiguo `bindGuardianActions`) y el segundo leía
 * un objeto global que no existe, de modo que se abrían DOS conversaciones
 * de WhatsApp, una de ellas sin enlace. Aquí no se registra ningún listener
 * salvo por `bindSosButton`.
 *
 * El contacto vive en UN solo campo (Ajustes) y UNA sola clave de storage
 * (HU-27 AC-02, cierra F-6).
 */

const GUARDIAN_KEY = 'centinela_guardian_phone';

/**
 * Texto del mensaje SOS con el enlace y el veredicto.
 * @param {string} currentUrl
 * @param {string} resultTitle
 * @param {string} brandMsg
 * @param {boolean} brandVisible
 */
export function buildSosMessage(currentUrl, resultTitle, brandMsg, brandVisible) {
  const brandInfo = brandVisible ? `\n🔍 Identidad: ${brandMsg}` : '';
  return `🛡️ *CENTINELA SOS* 👼\n\nHe analizado este enlace y la app me da un aviso. ¿Me puedes decir si es seguro entrar?\n\n🔗 *Enlace:* ${currentUrl}${brandInfo}\n⚠️ *Veredicto:* ${resultTitle}\n\n¡Gracias experto!`;
}

/** Guarda el contacto (clave única). */
export function saveGuardianPhone(phone) {
  try {
    localStorage.setItem(GUARDIAN_KEY, String(phone ?? '').trim());
  } catch {}
}

/** Lee el contacto; única fuente es la clave canónica. */
export function loadGuardianPhone() {
  try {
    return localStorage.getItem(GUARDIAN_KEY) || '';
  } catch {
    return '';
  }
}

/** Elimina el contacto. */
export function clearGuardianPhone() {
  try {
    localStorage.removeItem(GUARDIAN_KEY);
  } catch {}
}

/** Abre WhatsApp con el mensaje. Punto único de apertura (fácil de contar en tests). */
export function openSosWhatsApp(phone, message) {
  if (!phone) return;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

/**
 * ÚNICO cableado del botón «Preguntar». app.js lo llama una sola vez.
 * Devuelve una función de limpieza (quitar listener).
 *
 * @param {{ btnSos?: HTMLElement }} els
 * @param {{
 *   getUrl?: () => string,
 *   getResultTitle?: () => string,
 *   getBrandMsg?: () => string,
 *   getBrandVisible?: () => boolean,
 * }} [deps]
 */
export function bindSosButton(els, deps = {}) {
  const btn = els && els.btnSos;
  if (!btn) return () => {};

  const handler = () => {
    const phone = loadGuardianPhone();
    if (!phone) return;
    const message = buildSosMessage(
      deps.getUrl?.() || '',
      deps.getResultTitle?.() || '',
      deps.getBrandMsg?.() || '',
      deps.getBrandVisible?.() || false
    );
    openSosWhatsApp(phone, message);
  };

  btn.addEventListener('click', handler);
  return () => btn.removeEventListener('click', handler);
}

/**
 * Ciclo de vida de pantalla (router). No registra NINGÚN listener: el botón SOS
 * se cablea una sola vez con `bindSosButton` (F-5). Se mantiene para conservar
 * la firma que espera el router si algún día se registra como pantalla.
 */
export function mount() {}

export function unmount() {}
