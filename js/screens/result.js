/**
 * Centinela — Result Screen
 * Renderiza el veredicto del análisis: semáforo, detalles, X-Ray, marca, confianza
 */
import { extractDomain } from '../history.js';
import { checkBrandIdentity } from '../brands.js';

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

  let status, icon, title, message;

  if (total === 0) {
    status = 'warning'; icon = '⚠️';
    title = 'Análisis no disponible';
    message = 'Ningún motor de seguridad ha podido analizar este enlace todavía. Puede que sea demasiado nuevo o no esté indexado por VirusTotal.';
  } else if (positives === 0 && suspicious === 0) {
    status = 'safe'; icon = '✅';
    title = 'Este enlace es seguro';
    message = `${total} motores de seguridad lo han analizado y ninguno ha encontrado problemas. Puedes abrirlo con tranquilidad.`;
  } else if (positives > 3) {
    status = 'danger'; icon = '🚨';
    title = '¡No abras este enlace!';
    message = `${positives} de ${total} motores de seguridad lo han marcado como peligroso. Podría ser una estafa, phishing o contener malware.`;
  } else {
    status = 'warning'; icon = '⚠️';
    title = 'Ten cuidado con este enlace';
    message = `${positives + suspicious} de ${total} motores han encontrado algo sospechoso. Te recomendamos no introducir datos personales en esta web.`;
  }

  _els.resultIcon.className = `result-traffic-light ${status}`;
  _els.resultIcon.innerHTML = `<span>${icon}</span>`;
  _els.resultTitle.textContent = title;
  _els.resultTitle.className = `result-title ${status}`;
  _els.resultMessage.textContent = message;
  _els.resultUrl.textContent = currentUrl;

  // Identidad de marca
  const domain = extractDomain(currentUrl);
  const finalDomain = result.finalUrl ? extractDomain(result.finalUrl) : null;
  const brandInfo = checkBrandIdentity(domain) || (finalDomain ? checkBrandIdentity(finalDomain) : null);

  if (brandInfo) {
    _els.resultBrand.style.display = 'flex';
    _els.resultBrand.className = 'result-brand ' + (brandInfo.isOfficial ? 'official' : 'suspicious');
    _els.brandIcon.textContent = brandInfo.isOfficial ? '✅' : '⚠️';
    _els.brandMsg.textContent = brandInfo.isOfficial ? 'Identidad Oficial: ' + brandInfo.brandName : '¡Posible Suplantación!';
    _els.brandDetail.textContent = brandInfo.isOfficial
      ? `Este es un dominio oficial confirmado de ${brandInfo.brandName}.`
      : `Esta web utiliza el nombre de ${brandInfo.brandName} pero NO parece ser su sitio oficial. Ten mucho cuidado si te piden datos.`;
  } else {
    _els.resultBrand.style.display = 'none';
  }

  // X-Ray
  if (result.finalUrl && result.finalUrl !== currentUrl && !result.finalUrl.endsWith(currentUrl) && !currentUrl.endsWith(result.finalUrl)) {
    _els.resultFinalUrl.textContent = result.finalUrl;
    _els.resultPageTitle.textContent = result.title || '';
    _els.resultXray.style.display = 'block';
  } else {
    _els.resultXray.style.display = 'none';
  }

  _els.btnOpenUrl.style.display = status === 'danger' ? 'none' : 'inline-flex';

  renderTrustLevel(result);
  updateSosButton(status);
  renderTechnicalDetails(result, status);

  return { status, positives, total };
}

function updateSosButton(status) {
  const phone = localStorage.getItem(GUARDIAN_KEY);
  _els.btnSos.style.display = (phone && status !== 'safe') ? 'inline-flex' : 'none';
}

function renderTrustLevel(result) {
  if (!result.firstSubmissionDate) {
    _els.resultTrust.style.display = 'none';
    return;
  }
  const firstSeen = new Date(result.firstSubmissionDate * 1000);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  _els.resultTrust.style.display = 'flex';
  _els.resultTrust.className = 'result-trust';

  if (firstSeen > sixMonthsAgo) {
    _els.resultTrust.classList.add('new');
    _els.trustMsg.textContent = 'Sitio Muy Reciente';
    _els.trustIcon.textContent = '⏳';
  } else {
    _els.resultTrust.classList.add('old');
    _els.trustMsg.textContent = 'Sitio Establecido';
    _els.trustIcon.textContent = '🕰️';
  }
}

function renderTechnicalDetails(result, status) {
  const positives = result.positives || 0;
  const total = result.total || 0;
  const harmless = result.harmless || 0;
  const undetected = result.undetected || 0;
  const suspicious = result.suspicious || 0;

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

  _els.resultDetailsContent.innerHTML = html;

  if (status === 'danger') {
    _els.resultDetails.setAttribute('open', '');
  } else {
    _els.resultDetails.removeAttribute('open');
  }
}
