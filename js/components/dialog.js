/**
 * Centinela — Dialog component
 * Generic overlay + dialog box
 */

export function openDialog({ title = '', body = '', actions = [] } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'dialog-title');

  const dialog = document.createElement('div');
  dialog.className = 'dialog';

  const header = document.createElement('div');
  header.className = 'dialog-header';

  const titleEl = document.createElement('h2');
  titleEl.id = 'dialog-title';
  titleEl.className = 'dialog-title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-icon';
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'dialog-body';
  if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  } else {
    bodyEl.appendChild(body);
  }

  dialog.appendChild(header);
  dialog.appendChild(bodyEl);

  if (actions.length) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'dialog-actions';
    actions.forEach(({ text, onClick, variant = 'primary' }) => {
      const btn = document.createElement('button');
      btn.className = `btn btn-${variant} btn-full`;
      btn.type = 'button';
      btn.textContent = text;
      btn.addEventListener('click', onClick);
      actionsEl.appendChild(btn);
    });
    dialog.appendChild(actionsEl);
  }

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return { overlay, close };
}
