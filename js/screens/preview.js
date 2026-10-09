/**
 * Centinela — Preview Screen
 * Vista previa segura de la URL analizada
 */
import { hapticFeedback } from '../share.js';

let _onClose = null;

export function mount(container) {
  _onClose = container;
}

export function unmount() {
  _onClose = null;
}

export function closePreviewDialog(els) {
  if (!els?.previewDialog) return;
  els.previewDialog.classList.add('hidden');
  if (els.previewImg) {
    els.previewImg.src = '';
  }
  if (els.btnPreview) els.btnPreview.disabled = false;
}

export function openPreview(currentUrl, els) {
  if (!currentUrl || !els) return;
  if (els.previewTimeout) {
    clearTimeout(els.previewTimeout);
    els.previewTimeout = null;
  }

  els.previewImg.src = '';
  els.previewImg.classList.add('hidden');
  els.previewLoading.classList.remove('hidden');
  els.previewDialog.classList.remove('hidden');
  els.previewLoading.innerHTML = '<div class="spinner"></div> Generando imagen segura...';
  els.btnPreview.disabled = true;

  const encodedUrl = encodeURIComponent(currentUrl);
  const mshotsUrl = `https://s.wordpress.com/mshots/v1/${encodedUrl}?w=1200`;

  let loaded = false;

  const finish = (success) => {
    if (loaded) return;
    loaded = true;
    if (els.previewTimeout) {
      clearTimeout(els.previewTimeout);
      els.previewTimeout = null;
    }
    els.btnPreview.disabled = false;
    if (success) {
      els.previewLoading.classList.add('hidden');
      els.previewImg.classList.remove('hidden');
    } else {
      els.previewLoading.innerHTML = `❌ No se pudo cargar la vista previa.<br><small style="color:var(--text-muted)">El sitio podría estar protegido o no ser accesible.</small>`;
    }
  };

  els.previewImg.onload = () => {
    if (els.previewImg.naturalWidth < 50 || els.previewImg.naturalHeight < 50) {
      finish(false);
      return;
    }
    finish(true);
  };
  els.previewImg.onerror = () => finish(false);

  els.previewTimeout = setTimeout(() => {
    if (!loaded) {
      els.previewImg.src = '';
      finish(false);
    }
  }, 15000);
  els.previewImg.src = mshotsUrl;
  hapticFeedback('light');
}
