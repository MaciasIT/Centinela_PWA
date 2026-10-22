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
const GUARDIAN_CHANNEL_KEY = 'centinela_guardian_channel';
const CHANNEL_WHATSAPP = 'whatsapp';
const CHANNEL_TELEGRAM = 'telegram';
const CHANNEL_SMS = 'sms';

const CHANNEL_LABELS = {
  [CHANNEL_WHATSAPP]: 'WhatsApp',
  [CHANNEL_TELEGRAM]: 'Telegram',
  [CHANNEL_SMS]: 'SMS',
};

function channelLabel(channel) {
  return CHANNEL_LABELS[channel] || CHANNEL_LABELS[CHANNEL_WHATSAPP];
}

/** Texto del mensaje SOS con el enlace y el veredicto. */
export function buildSosMessage(currentUrl, resultTitle, brandMsg, brandVisible, channel = CHANNEL_WHATSAPP) {
  const brandInfo = brandVisible ? `\n🔍 Identidad: ${brandMsg}` : '';
  const prefix = channel === CHANNEL_TELEGRAM ? '🛡️ *CENTINELA SOS* 👼' : '🛡️ CENTINELA SOS 👼';
  return `${prefix}\n\nHe analizado este enlace y la app me da un aviso. ¿Me puedes decir si es seguro entrar?\n\n🔗 Enlace: ${currentUrl}${brandInfo}\n⚠️ Veredicto: ${resultTitle}\n\n¡Gracias experto!`;
}

/** Abre el contacto por el canal elegido. */
export function openSosByChannel(phone, message, channel = CHANNEL_WHATSAPP) {
  if (!phone) return;
  if (channel === CHANNEL_TELEGRAM) {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(message)}`, '_blank');
  } else if (channel === CHANNEL_SMS) {
    window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank');
  } else {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  }
}

/** Guarda el contacto (clave única). */
export function saveGuardianPhone(phone) {
  try {
    localStorage.setItem(GUARDIAN_KEY, String(phone ?? '').trim());
  } catch {}
}

/** Guarda el canal preferido. */
export function saveGuardianChannel(channel) {
  try {
    localStorage.setItem(GUARDIAN_CHANNEL_KEY, String(channel ?? CHANNEL_WHATSAPP).trim());
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

/** Lee el canal guardado. */
export function loadGuardianChannel() {
  try {
    const v = localStorage.getItem(GUARDIAN_CHANNEL_KEY);
    return v === CHANNEL_TELEGRAM || v === CHANNEL_SMS ? v : CHANNEL_WHATSAPP;
  } catch {
    return CHANNEL_WHATSAPP;
  }
}

/** Elimina el contacto. */
export function clearGuardianPhone() {
  try {
    localStorage.removeItem(GUARDIAN_KEY);
  } catch {}
}

/** Elimina el canal guardado. */
export function clearGuardianChannel() {
  try {
    localStorage.removeItem(GUARDIAN_CHANNEL_KEY);
  } catch {}
}

/**
 * ÚNICO cableado del botón «Preguntar». app.js lo llama una sola vez.
 * Devuelve una función de limpieza (quitar listener).
 */
export function bindSosButton(els, deps = {}) {
  const btn = els && els.btnSos;
  if (!btn) return () => {};

  const handler = () => {
    const phone = loadGuardianPhone();
    if (!phone) return;
    const channel = deps.getChannel?.() || loadGuardianChannel();
    const message = buildSosMessage(
      deps.getUrl?.() || '',
      deps.getResultTitle?.() || '',
      deps.getBrandMsg?.() || '',
      deps.getBrandVisible?.() || false,
      channel
    );
    const ok = typeof confirm === 'function' ? confirm(`Enviar consulta por ${channelLabel(channel)}?\n\n${message}`) : true;
    if (!ok) return;
    openSosByChannel(phone, message, channel);
  };

  btn.addEventListener('click', handler);
  return () => btn.removeEventListener('click', handler);
}

/** Ciclo de vida de pantalla (router). No registra NINGÚN listener. */
export function mount() {}
export function unmount() {}
