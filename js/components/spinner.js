/**
 * Centinela — Spinner component
 */

export function createSpinner() {
  const el = document.createElement('div');
  el.className = 'spinner';
  el.setAttribute('aria-hidden', 'true');
  return el;
}
