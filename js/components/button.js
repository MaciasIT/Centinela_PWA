/**
 * Centinela — Button component
 * Variants: primary | secondary | danger | ghost
 */

export function createButton({ text, variant = 'primary', icon = '', full = false, disabled = false, type = 'button', ariaLabel } = {}) {
  const btn = document.createElement('button');
  btn.className = ['btn', `btn-${variant}`, full ? 'btn-full' : '', disabled ? 'btn-disabled' : ''].filter(Boolean).join(' ');
  btn.type = type;
  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);

  if (icon) {
    btn.innerHTML = `${icon}<span>${text}</span>`;
  } else {
    btn.textContent = text;
  }

  if (disabled) btn.disabled = true;
  return btn;
}
