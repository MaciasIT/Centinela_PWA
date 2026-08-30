/**
 * Centinela — Result Card component
 * Renderiza la tarjeta de resultado con semáforo, explicación y acciones
 */

import { createSpinner } from './spinner.js';
import { showToast } from './toast.js';

const STATUS_TEXT = {
  safe: 'Este enlace parece seguro.',
  warning: 'Motivos de precaución: señales sospechosas.',
  danger: 'No entres: motores detectaron malware o phishing.',
};

function reasonsHtml(reasons) {
  if (!Array.isArray(reasons) || reasons.length === 0) return '';
  return `<ul class="result-reasons"><li>${reasons.join('</li><li>')}</li></ul>`;
}

export function renderResultCard({ url, result, local, onOpen, onShare, onPreview }) {
  const card = document.createElement('div');
  card.className = 'result-card';

  const effective = local && local.classification ? local : { classification: status };
  const emoji = effective.classification === 'safe' ? '🟢' : effective.classification === 'danger' ? '🔴' : '🟡';
  const label = effective.classification === 'safe' ? 'Seguro' : effective.classification === 'danger' ? 'Peligroso' : 'Sospechoso';

  card.innerHTML = `
    <div class="result-status-row">
      <span class="result-emoji" aria-hidden="true">${emoji}</span>
      <span class="result-label ${effective.classification}">${label}</span>
    </div>
    <p class="result-text">${STATUS_TEXT[effective.classification] || STATUS_TEXT[status] || ''}</p>
    ${reasonsHtml(effective.reasons)}
    <div class="result-actions"></div>
  `;

  const actions = card.querySelector('.result-actions');
  if (onOpen) actions.appendChild(createActionButton('Abrir enlace', 'primary', onOpen));
  if (onShare) actions.appendChild(createActionButton('Compartir', 'secondary', onShare));
  if (onPreview) actions.appendChild(createActionButton('Vista previa', 'secondary', onPreview));

  return card;
}

function createActionButton(text, variant, onClick) {
  const btn = document.createElement('button');
  btn.className = `btn btn-${variant} btn-full`;
  btn.type = 'button';
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

export function createLoadingResultCard() {
  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <div class="result-status-row">
      <span class="result-label">Analizando...</span>
    </div>
    <div class="result-loading">
      ${createSpinner().outerHTML}
    </div>
  `;
  return card;
}
