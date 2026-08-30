/**
 * Centinela — Guardian Screen
 * Gestión del contacto de confianza y botón SOS
 */
const $ = (id) => document.getElementById(id);
const GUARDIAN_KEY = 'centinela_guardian_phone';

export function mount(container) {
  initGuardian();
  bindGuardianActions();
}

export function unmount() {
  // no-op
}

export function initGuardian(els) {
  const target = els || {
    guardianPhone: $('guardian-phone'),
  };
  try {
    const saved = localStorage.getItem(GUARDIAN_KEY);
    if (saved && target.guardianPhone) target.guardianPhone.value = saved;
  } catch {
    // ignorar storage restringido
  }
}

export function buildSosMessage(currentUrl, resultTitle, brandMsg, brandVisible) {
  const brandInfo = brandVisible ? `\n🔍 Identidad: ${brandMsg}` : '';
  return `🛡️ *CENTINELA SOS* 👼\n\nHe analizado este enlace y la app me da un aviso. ¿Me puedes decir si es seguro entrar?\n\n🔗 *Enlace:* ${currentUrl}${brandInfo}\n⚠️ *Veredicto:* ${resultTitle}\n\n¡Gracias experto!`;
}

export function saveGuardianPhone(phone) {
  localStorage.setItem(GUARDIAN_KEY, phone);
}

export function loadGuardianPhone() {
  try { return localStorage.getItem(GUARDIAN_KEY) || ''; } catch { return ''; }
}

export function clearGuardianPhone() {
  try { localStorage.removeItem(GUARDIAN_KEY); } catch {}
}

export function openSosWhatsApp(phone, message) {
  if (!phone) return;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

function bindGuardianActions() {
  const els = {
    btnSaveGuardian: $('btn-save-guardian'),
    guardianPhone: $('guardian-phone'),
    guardianStatus: $('guardian-status'),
    btnSos: $('btn-sos'),
    resultBrand: $('result-brand'),
    brandMsg: $('brand-msg'),
    resultTitle: $('result-title'),
  };

  if (els.btnSaveGuardian) {
    els.btnSaveGuardian.addEventListener('click', () => {
      const phone = els.guardianPhone.value.trim().replace(/\D/g, '');
      if (phone) {
        localStorage.setItem(GUARDIAN_KEY, phone);
        els.guardianStatus.textContent = '✅ Experto guardado';
        setTimeout(() => (els.guardianStatus.textContent = ''), 3000);
      } else {
        els.guardianStatus.textContent = 'Introduce un número válido';
      }
    });
  }

  if (els.btnSos) {
    els.btnSos.addEventListener('click', () => {
      const phone = localStorage.getItem(GUARDIAN_KEY);
      if (!phone) return;
      const message = buildSosMessage(
        window.__centinela?.currentUrl || '',
        els.resultTitle?.textContent || '',
        els.brandMsg?.textContent || '',
        els.resultBrand?.style.display !== 'none'
      );
      openSosWhatsApp(phone, message);
    });
  }
}
