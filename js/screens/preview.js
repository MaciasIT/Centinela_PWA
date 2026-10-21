/**
 * Centinela — Preview Screen
 * Vista previa segura de la URL analizada
 */
import { hapticFeedback } from '../share.js';
import { trapFocus } from './dialog.js';

let _onClose = null;

export function mount(container) {
  _onClose = container;
}

export function unmount() {
  _onClose = null;
}

/**
 * Genera la URL del servicio de captura para una URL objetivo.
 * Motor primario: Microlink API con screenshot embebido (soporta CORS y generación al vuelo).
 * Motor de reserva (fallback): WordPress mshots.
 */
export function buildPreviewUrl(targetUrl, engine = 'microlink') {
  if (!targetUrl) return '';
  const encoded = encodeURIComponent(targetUrl);
  if (engine === 'microlink') {
    return `https://api.microlink.io/?url=${encoded}&screenshot=true&embed=screenshot.url`;
  }
  return `https://s.wordpress.com/mshots/v1/${encoded}?w=1200`;
}

export function closePreviewDialog(els) {
  if (!els?.previewDialog) return;
  if (els.previewTimeout) {
    clearTimeout(els.previewTimeout);
    els.previewTimeout = null;
  }
  els.previewDialog.classList.add('hidden');
  if (els.previewImg) {
    els.previewImg.src = '';
    els.previewImg.classList.add('hidden');
  }
  const frame = els.previewFrame || (typeof document !== 'undefined' ? document.getElementById('preview-frame') : null);
  frame?.setAttribute('aria-busy', 'false');

  if (els.btnPreview) {
    els.btnPreview.disabled = false;
    els.btnPreview.focus?.();
  }
}

export function openPreview(currentUrl, els) {
  if (!currentUrl || !els) return;
  if (els.previewTimeout) {
    clearTimeout(els.previewTimeout);
    els.previewTimeout = null;
  }

  const frame = els.previewFrame || (typeof document !== 'undefined' ? document.getElementById('preview-frame') : null);
  frame?.setAttribute('aria-busy', 'true');

  els.previewImg.src = '';
  els.previewImg.classList.add('hidden');
  els.previewLoading.classList.remove('hidden');
  els.previewDialog.classList.remove('hidden');
  els.previewLoading.innerHTML = '<div class="spinner" aria-hidden="true"></div> <span>Generando imagen segura...</span>';
  els.btnPreview.disabled = true;

  // Manejo de foco accesible: situar el foco en el botón de cerrar del diálogo
  const btnClose = els.previewDialog.querySelector ? els.previewDialog.querySelector('#btn-close-preview') : null;
  btnClose?.focus?.();

  // Atrapado de foco en diálogo modal
  if (!els.previewDialog._hasTrap && els.previewDialog.addEventListener) {
    els.previewDialog.addEventListener('keydown', (e) => trapFocus(els.previewDialog, e));
    els.previewDialog._hasTrap = true;
  }

  let attempt = 1;
  let settled = false;

  const finish = (success) => {
    if (settled) return;
    settled = true;
    if (els.previewTimeout) {
      clearTimeout(els.previewTimeout);
      els.previewTimeout = null;
    }
    frame?.setAttribute('aria-busy', 'false');
    els.btnPreview.disabled = false;

    if (success) {
      els.previewLoading.classList.add('hidden');
      els.previewImg.classList.remove('hidden');
    } else {
      els.previewLoading.innerHTML = `
        <span style="font-size:1.5rem" aria-hidden="true">📸</span>
        <p style="font-weight:600;margin:4px 0;">No se pudo cargar la vista previa</p>
        <small style="color:var(--text-muted);line-height:1.4;">El sitio podría requerir autenticación o bloquear rastreadores automatizados.</small>
      `;
    }
  };

  const tryLoad = (engine) => {
    const url = buildPreviewUrl(currentUrl, engine);
    els.previewImg.onload = () => {
      if (els.previewImg.naturalWidth < 50 || els.previewImg.naturalHeight < 50) {
        handleFail();
        return;
      }
      finish(true);
    };
    els.previewImg.onerror = () => handleFail();

    if (els.previewTimeout) clearTimeout(els.previewTimeout);
    els.previewTimeout = setTimeout(() => {
      handleFail();
    }, engine === 'microlink' ? 9000 : 7000);

    els.previewImg.src = url;
  };

  const handleFail = () => {
    if (settled) return;
    if (attempt === 1) {
      attempt = 2;
      tryLoad('mshots');
    } else {
      finish(false);
    }
  };

  tryLoad('microlink');
  hapticFeedback('light');
}
