/**
 * Centinela — Home Screen
 * Pantalla principal: input URL, historial, tips, onboarding
 */
import { getHistory, extractDomain, formatDate } from '../history.js';
import { getRandomTip } from '../tips.js';
import { hapticFeedback } from '../share.js';

const $ = (id) => document.getElementById(id);

let els = {};
let tipInterval = null;

export function mount(container) {
  els = {
    urlInput: $('url-input'),
    btnPaste: $('btn-paste'),
    btnCheck: $('btn-check'),
    btnScanQr: $('btn-scan-qr'),
    btnUploadImage: $('btn-upload-image'),
    fileInput: $('file-input'),
    tipText: $('tip-text'),
    historyList: $('history-list'),
    historyEmpty: $('history-empty'),
    historySection: $('history-section'),
    btnClearHistory: $('btn-clear-history'),
  };

  loadTip();
  renderHistory();
  tipInterval = setInterval(loadTip, 30000);
}

export function unmount() {
  if (tipInterval) {
    clearInterval(tipInterval);
    tipInterval = null;
  }
}

function loadTip() {
  if (els.tipText) els.tipText.textContent = getRandomTip();
}

export function renderHistory() {
  const history = getHistory();
  if (!els.historyList) return;

  if (history.length === 0) {
    els.historyList.innerHTML = '';
    els.historyEmpty.classList.remove('hidden');
    els.historySection.style.display = 'block';
    return;
  }

  els.historyEmpty.classList.add('hidden');

  const recent = history.slice(0, 5);
  els.historyList.innerHTML = recent.map(item => {
    const statusEmoji = item.status === 'safe' ? '✅' : item.status === 'danger' ? '🚨' : '⚠️';
    const domain = extractDomain(item.url);
    const date = formatDate(item.date);
    return `
      <div class="history-item" data-url="${encodeURIComponent(item.url)}" role="button" tabindex="0">
        <span class="history-status">${statusEmoji}</span>
        <div class="history-info">
          <div class="history-url">${domain}</div>
          <div class="history-date">${date}</div>
        </div>
      </div>`;
  }).join('');

  els.historyList.querySelectorAll('.history-item').forEach(item => {
    const handler = () => {
      const url = decodeURIComponent(item.dataset.url);
      els.urlInput.value = url;
      updateCheckButton();
      hapticFeedback('light');
    };
    item.addEventListener('click', handler);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}

export function updateCheckButton() {
  if (els.btnCheck && els.urlInput) {
    const hasText = els.urlInput.value.trim().length > 0;
    els.btnCheck.disabled = !hasText;
  }
}

export { els };
