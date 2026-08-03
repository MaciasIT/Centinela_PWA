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

export function bindInfoDialog(els) {
  if (!els) return;
  els.btnInfo?.addEventListener('click', () => els.infoDialog.classList.remove('hidden'));
  els.btnCloseInfo?.addEventListener('click', () => els.infoDialog.classList.add('hidden'));
  els.infoDialog?.addEventListener('click', (e) => {
    if (e.target === els.infoDialog) els.infoDialog.classList.add('hidden');
  });
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
}
