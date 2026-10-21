/**
 * Centinela — Dialog Screen
 * Gestión de diálogos informativos, errores y cierre por click-outside
 */
const $ = (id) => document.getElementById(id);

export function mount(container) {
  bindInfoDialog();
  bindErrorDialog();
}

export function unmount() {
  // no-op
}

/**
 * Atrapa la navegación con tabulación dentro del diálogo modal (WCAG 2.1 AA §2.1.2)
 */
export function trapFocus(dialogEl, e) {
  if (!dialogEl || e.key !== 'Tab') return;
  const focusables = Array.from(
    dialogEl.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.classList.contains('hidden') && el.style.display !== 'none');

  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

export function bindInfoDialog(els) {
  if (!els) return;
  els.btnInfo?.addEventListener('click', () => {
    els.infoDialog?.classList.remove('hidden');
    els.btnCloseInfo?.focus?.();
  });
  els.btnCloseInfo?.addEventListener('click', () => {
    els.infoDialog?.classList.add('hidden');
    els.btnInfo?.focus?.();
  });
  els.infoDialog?.addEventListener('click', (e) => {
    if (e.target === els.infoDialog) {
      els.infoDialog.classList.add('hidden');
      els.btnInfo?.focus?.();
    }
  });
  els.infoDialog?.addEventListener('keydown', (e) => trapFocus(els.infoDialog, e));
}

export function showError(message, retryAction = null, els) {
  if (!els) return;
  els.errorMessage.textContent = message;
  els.errorDialog.classList.remove('hidden');
  els.lastRetryAction = retryAction;
  els.btnErrorRetry.style.display = retryAction ? 'inline-flex' : 'none';
}

export function closeErrorDialog(els) {
  if (!els?.errorDialog) return;
  els.errorDialog.classList.add('hidden');
  els.lastRetryAction = null;
  els.btnErrorRetry.style.display = 'none';
}

function bindErrorDialog() {
  const els = {
    btnCloseError: $('btn-close-error'),
    btnErrorRetry: $('btn-error-retry'),
    errorDialog: $('error-dialog'),
  };

  if (!els.errorDialog) return;

  els.btnCloseError?.addEventListener('click', () => closeErrorDialog(els));
  els.btnErrorRetry?.addEventListener('click', () => {
    closeErrorDialog(els);
    els.lastRetryAction?.();
  });
  els.errorDialog.addEventListener('click', (e) => {
    if (e.target === els.errorDialog) closeErrorDialog(els);
  });
  els.errorDialog.addEventListener('keydown', (e) => trapFocus(els.errorDialog, e));
}
