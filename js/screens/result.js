/**
 * Centinela — Result Screen
 * Renderiza el veredicto del análisis: semáforo, detalles, X-Ray, marca, confianza
 */
import { extractDomain } from '../history.js';
import { checkBrandIdentity } from '../brands.js';
import { shareResult } from '../share.js';
import { renderResultCard, createLoadingResultCard } from '../components/result-card.js';

const $ = (id) => document.getElementById(id);
const GUARDIAN_KEY = 'centinela_guardian';

let _els = {};
let _currentUrl = '';

export function mount(container, data) {
  _els = {
    resultIcon: $('result-icon'),
    resultTitle: $('result-title'),
    resultMessage: $('result-message'),
    resultUrl: $('result-url'),
    resultUrlCard: $('result-url-card'),
    resultXray: $('result-xray'),
    resultFinalUrl: $('result-final-url'),
    resultPageTitle: $('result-page-title'),
    resultDetails: $('result-details'),
    resultBrand: $('result-brand'),
    brandIcon: $('brand-icon'),
    brandMsg: $('brand-msg'),
    brandDetail: $('brand-detail'),
    resultTrust: $('result-trust'),
    trustMsg: $('trust-msg'),
    trustIcon: $('trust-icon'),
    resultDetailsContent: $('result-details-content'),
    btnOpenUrl: $('btn-open-url'),
    btnSos: $('btn-sos'),
    btnPreview: $('btn-preview'),
    previewDialog: $('preview-dialog'),
    previewImg: $('preview-img'),
    previewLoading: $('preview-loading'),
  };

  if (data && data.result) {
    render(data.result, data.url);
  }
}

export function unmount() {
  _els = {};
  _currentUrl = '';
}

export function render(result, currentUrl) {
  _currentUrl = currentUrl;
  const positives = result.positives || 0;
  const total = result.total || 0;
  const suspicious = result.suspicious || 0;

  const card = renderResultCard({
    url: currentUrl,
    result,
    onOpen: () => { if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer'); },
    onShare: async () => shareCurrentResult(currentUrl, result),
    onPreview: () => openCurrentPreview(currentUrl),
  });

  const container = document.querySelector('#screen-result .result-container');
  if (container) {
    container.innerHTML = '';
    container.appendChild(card);
  }

  updateSosButton(currentUrl, positives, total);
  renderTrustLevel(result);
  renderTechnicalDetails(result, statusFromResult(result));

  return { status: statusFromResult(result), positives, total };
}

function statusFromResult(result) {
  const positives = result.positives || 0;
  const total = result.total || 0;
  const suspicious = result.suspicious || 0;
  if (total === 0) return 'warning';
  if (positives === 0 && suspicious === 0) return 'safe';
  if (positives > 3) return 'danger';
  return 'warning';
}

function updateSosButton(currentUrl, positives, total) {
  const status = statusFromResult({ positives, total });
  const phone = localStorage.getItem(GUARDIAN_KEY);
  const btnSos = document.getElementById('btn-sos');
  if (btnSos) btnSos.style.display = (phone && status !== 'safe') ? 'inline-flex' : 'none';
}

function renderTrustLevel(result) {
  const resultTrust = document.getElementById('result-trust');
  const trustMsg = document.getElementById('trust-msg');
  const trustIcon = document.getElementById('trust-icon');
  if (!resultTrust || !trustMsg || !trustIcon) return;

  if (!result.firstSubmissionDate) {
    resultTrust.style.display = 'none';
    return;
  }

  const firstSeen = new Date(result.firstSubmissionDate * 1000);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  resultTrust.style.display = 'flex';
  resultTrust.className = 'result-trust';

  if (firstSeen > sixMonthsAgo) {
    resultTrust.classList.add('new');
    trustMsg.textContent = 'Sitio Muy Reciente';
    trustIcon.textContent = '⏳';
  } else {
    resultTrust.classList.add('old');
    trustMsg.textContent = 'Sitio Establecido';
    trustIcon.textContent = '🕰️';
  }
}

function renderTechnicalDetails(result, status) {
  const positives = result.positives || 0;
  const total = result.total || 0;
  const harmless = result.harmless || 0;
  const undetected = result.undetected || 0;
  const suspicious = result.suspicious || 0;

  const resultDetailsContent = document.getElementById('result-details-content');
  const resultDetails = document.getElementById('result-details');
  if (!resultDetailsContent || !resultDetails) return;

  let html = `<div class="detail-grid">
    <div class="detail-row"><span class="detail-label">Motores que lo analizaron</span><span class="detail-value">${total}</span></div>
    <div class="detail-row"><span class="detail-label">Detectado como peligroso</span><span class="detail-value ${positives > 0 ? 'danger' : 'safe'}">${positives}</span></div>
    <div class="detail-row"><span class="detail-label">Marcado como sospechoso</span><span class="detail-value ${suspicious > 0 ? 'warning' : ''}">${suspicious}</span></div>
    <div class="detail-row"><span class="detail-label">Sin problemas detectados</span><span class="detail-value safe">${harmless}</span></div>
    <div class="detail-row"><span class="detail-label">Sin analizar</span><span class="detail-value">${undetected}</span></div>`;

  if (result.scanDate) {
    const scanDate = new Date(result.scanDate * 1000 || result.scanDate);
    html += `<div class="detail-row"><span class="detail-label">Último análisis</span><span class="detail-value">${scanDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>`;
  }
  if (result.fromCache) {
    html += `<div class="detail-row"><span class="detail-label">Fuente</span><span class="detail-value" style="color:var(--color-info)">Caché local</span></div>`;
  }
  html += `</div>`;

  const engines = result.engines;
  if (engines && Object.keys(engines).length > 0) {
    html += `<div class="detail-engines"><div class="detail-engines-title">Motores que alertaron:</div><div class="engine-list">${Object.entries(engines).map(([name]) => `<span class="engine-tag malicious">${name}</span>`).join('')}</div></div>`;
  }

  resultDetailsContent.innerHTML = html;

  if (status === 'danger') {
    resultDetails.setAttribute('open', '');
  } else {
    resultDetails.removeAttribute('open');
  }
}
