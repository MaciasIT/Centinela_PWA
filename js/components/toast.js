/**
 * Centinela — Toast component
 * Non-blocking temporary message
 */

let toastTimer = null;

export function showToast(message, duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }

  const msg = document.createElement('span');
  msg.id = 'toast-message';
  msg.textContent = message;
  toast.textContent = '';
  toast.appendChild(msg);
  toast.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}
