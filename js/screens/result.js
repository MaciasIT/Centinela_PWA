/**
 * Centinela — Result Screen
 * Renderiza el veredicto del análisis: semáforo, explicación siempre visible (HU-03),
 * «¿Qué hago ahora?» (HU-04), marca, X-Ray y acciones.
 *
 * La clasificación y los textos los aporta SIEMPRE core/verdict.js (HU-02/HU-03/HU-04):
 * esta pantalla no replica ninguna regla de clasificación.
 */
import { extractDomain } from '../history.js';
import { checkBrandIdentity } from '../brands.js';
import { loadGuardianPhone } from './guardian.js';
import { classify, verdictInfo, verdictSteps } from '../core/verdict.js';

const $ = (id) => document.getElementById(id);

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
    btnShare: $('btn-share'),
    btnNewCheck: $('btn-new-check'),
    btnWhatNow: $('btn-what-now'),
    resultWhatNow: $('result-what-now'),
    resultWhatNowSteps: $('result-what-now-steps'),
    previewDialog: $('preview-dialog'),
    previewImg: $('preview-img'),
    previewLoading: $('preview-loading'),
  };

  if (data && data.result) {
    render(data.result, data.url, data.local);
  }
}

export function unmount() {
  _els = {};
  _currentUrl = '';
}

export function render(result, currentUrl, local) {
  _currentUrl = currentUrl;
  const positives = result.positives || 0;
  const total = result.total || 0;
  const suspicious = result.suspicious || 0;

  // ÚNICA clasificación (core/verdict.js): pantalla, historial y estadísticas coinciden.
  const status = classify(result);
  const info = verdictInfo(status);
  const icon = info.icon;
  const title = info.title;
  let message = info.explanation;

  // Refuerzo local (matiz, nunca cambia el veredicto por sí solo).
  const effectiveLocal = local || result.local;
  if (effectiveLocal && effectiveLocal.reasons && effectiveLocal.reasons.length > 0 && status !== 'safe') {
    message += ` (${effectiveLocal.reasons.join('. ')})`;
  }

  if (_els.resultIcon) {
    _els.resultIcon.className = `result-traffic-light ${status}`;
    _els.resultIcon.innerHTML = `<span>${icon}</span>`;
  }
  if (_els.resultTitle) {
    _els.resultTitle.textContent = title;
    _els.resultTitle.className = `result-title ${status}`;
  }
  if (_els.resultMessage) {
    _els.resultMessage.textContent = message;
  }
  if (_els.resultUrl) {
    _els.resultUrl.textContent = currentUrl;
  }

  // Identidad de marca
  const domain = extractDomain(currentUrl);
  const finalDomain = result.finalUrl ? extractDomain(result.finalUrl) : null;
  const brandInfo = checkBrandIdentity(domain) || (finalDomain ? checkBrandIdentity(finalDomain) : null);

  if (_els.resultBrand) {
    if (brandInfo) {
      _els.resultBrand.style.display = 'flex';
      _els.resultBrand.className = 'result-brand ' + (brandInfo.isOfficial ? 'official' : 'suspicious');
      if (_els.brandIcon) _els.brandIcon.textContent = brandInfo.isOfficial ? '✅' : '⚠️';
      if (_els.brandMsg) _els.brandMsg.textContent = brandInfo.isOfficial ? 'Identidad Oficial: ' + brandInfo.brandName : '¡Posible Suplantación!';
      if (_els.brandDetail) {
        _els.brandDetail.textContent = brandInfo.isOfficial
          ? `Este es un dominio oficial confirmado de ${brandInfo.brandName}.`
          : `Esta web utiliza el nombre de ${brandInfo.brandName} pero NO parece ser su sitio oficial. Ten mucho cuidado si te piden datos.`;
      }
    } else {
      _els.resultBrand.style.display = 'none';
    }
  }

  // X-Ray / Redirección
  if (_els.resultXray) {
    if (result.finalUrl && result.finalUrl !== currentUrl && !result.finalUrl.endsWith(currentUrl) && !currentUrl.endsWith(result.finalUrl)) {
      if (_els.resultFinalUrl) _els.resultFinalUrl.textContent = result.finalUrl;
      if (_els.resultPageTitle) _els.resultPageTitle.textContent = result.title || '';
      _els.resultXray.style.display = 'block';
    } else {
      _els.resultXray.style.display = 'none';
    }
  }

  if (_els.btnOpenUrl) {
    // No se invita a abrir un enlace que no se ha podido comprobar (T2c).
    _els.btnOpenUrl.style.display = (status === 'danger' || status === 'unchecked') ? 'none' : 'inline-flex';
  }

  renderWhatNow(status);
  renderTrustLevel(result);
  updateSosButton(status);
  renderTechnicalDetails(result, status);

  return { status, positives, total };
}

/**
 * HU-04 — Botón «¿Qué hago ahora?»: 3 pasos concretos según el veredicto.
 * La explicación (HU-03) ya es visible encima, sin desplegar nada.
 */
function renderWhatNow(status) {
  const steps = verdictSteps(status);

  if (_els.btnWhatNow) {
    _els.btnWhatNow.setAttribute('aria-expanded', 'false');
    _els.btnWhatNow.onclick = () => {
      const panel = _els.resultWhatNow;
      if (!panel) return;
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      _els.btnWhatNow.setAttribute('aria-expanded', String(willOpen));
    };
  }
  if (_els.resultWhatNow) _els.resultWhatNow.hidden = true;
  if (_els.resultWhatNowSteps) {
    _els.resultWhatNowSteps.innerHTML = steps.map((s) => `<li>${s}</li>`).join('');
  }
}

function updateSosButton(status) {
  const phone = loadGuardianPhone();
  if (_els.btnSos) {
    _els.btnSos.style.display = (phone && status !== 'safe') ? 'inline-flex' : 'none';
  }
}

function renderTrustLevel(result) {
  if (!_els.resultTrust) return;
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
    if (_els.trustMsg) _els.trustMsg.textContent = 'Sitio Muy Reciente';
    if (_els.trustIcon) _els.trustIcon.textContent = '⏳';
  } else {
    _els.resultTrust.classList.add('old');
    if (_els.trustMsg) _els.trustMsg.textContent = 'Sitio Establecido';
    if (_els.trustIcon) _els.trustIcon.textContent = '🕰️';
  }
}

function renderTechnicalDetails(result, status) {
  const positives = result.positives || 0;
  const total = result.total || 0;
  const harmless = result.harmless || 0;
  const undetected = result.undetected || 0;
  const suspicious = result.suspicious || 0;

  if (!_els.resultDetailsContent || !_els.resultDetails) return;

  let html = `<div class="detail-grid">
    <div class="detail-row"><span class="detail-label">Fuente</span><span class="detail-value">VirusTotal</span></div>
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
    html += `<div class="detail-row"><span class="detail-label">Respuesta</span><span class="detail-value" style="color:var(--color-info)">Caché local</span></div>`;
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