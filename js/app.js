/**
 * Centinela — App Principal
 * Orquestador de toda la aplicación
 */

import { analyzeUrl, validateUrl } from './api.js';
import { startScanner, stopScanner, scanFromImage } from './scanner.js';
import { getHistory, addToHistory, clearHistory, formatDate, extractDomain } from './history.js';
import { getRandomTip } from './tips.js';
import { shareResult, copyToClipboard, checkSharedUrl, hapticFeedback } from './share.js';

/* ============================================
   DOM References
   ============================================ */
const $ = (id) => document.getElementById(id);

const screens = {
    main: $('screen-main'),
    scanner: $('screen-scanner'),
    loading: $('screen-loading'),
    result: $('screen-result'),
};

const els = {
    // Onboarding
    onboarding: $('onboarding'),
    onboardingNext: $('onboarding-next'),
    onboardingSkip: $('onboarding-skip'),

    // Main screen
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

    // Scanner screen
    btnCloseScanner: $('btn-close-scanner'),

    // Result screen
    resultIcon: $('result-icon'),
    resultTitle: $('result-title'),
    resultMessage: $('result-message'),
    resultUrl: $('result-url'),
    resultUrlCard: $('result-url-card'),
    resultDetails: $('result-details'),
    resultDetailsContent: $('result-details-content'),
    btnOpenUrl: $('btn-open-url'),
    btnShare: $('btn-share'),
    btnNewCheck: $('btn-new-check'),

    // Dialogs
    btnInfo: $('btn-info'),
    infoDialog: $('info-dialog'),
    btnCloseInfo: $('btn-close-info'),
    errorDialog: $('error-dialog'),
    errorMessage: $('error-message'),
    btnCloseError: $('btn-close-error'),
    btnErrorRetry: $('btn-error-retry'),

    // Toast
    toast: $('toast'),
    toastMessage: $('toast-message'),
};

/* ============================================
   State
   ============================================ */
let currentUrl = '';
let currentResult = null;
let toastTimeout = null;
let lastRetryAction = null;

/* ============================================
   Screen Management
   ============================================ */
function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
        if (key === name) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

/* ============================================
   Toast
   ============================================ */
function showToast(message, duration = 3000) {
    els.toastMessage.textContent = message;
    els.toast.classList.remove('hidden');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        els.toast.classList.add('hidden');
    }, duration);
}

/* ============================================
   Error Dialog
   ============================================ */
function showError(message, retryAction = null) {
    els.errorMessage.textContent = message;
    els.errorDialog.classList.remove('hidden');
    lastRetryAction = retryAction;
    els.btnErrorRetry.style.display = retryAction ? 'inline-flex' : 'none';
}

function closeError() {
    els.errorDialog.classList.add('hidden');
}

/* ============================================
   Onboarding
   ============================================ */
let currentSlide = 0;
const ONBOARDING_KEY = 'centinela_onboarded';

function initOnboarding() {
    try {
        if (localStorage.getItem(ONBOARDING_KEY)) return;
    } catch { return; }

    els.onboarding.classList.remove('hidden');

    els.onboardingNext.addEventListener('click', () => {
        currentSlide++;
        if (currentSlide >= 3) {
            completeOnboarding();
        } else {
            updateSlide();
            if (currentSlide === 2) {
                els.onboardingNext.textContent = '¡Empezar!';
            }
        }
    });

    els.onboardingSkip.addEventListener('click', completeOnboarding);
}

function updateSlide() {
    document.querySelectorAll('.onboarding-slide').forEach((slide, i) => {
        slide.classList.toggle('active', i === currentSlide);
    });
    document.querySelectorAll('.onboarding-dots .dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
}

function completeOnboarding() {
    els.onboarding.classList.add('hidden');
    try {
        localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
}

/* ============================================
   Tips
   ============================================ */
function loadTip() {
    els.tipText.textContent = getRandomTip();
}

/* ============================================
   History Rendering
   ============================================ */
function renderHistory() {
    const history = getHistory();

    if (history.length === 0) {
        els.historyList.innerHTML = '';
        els.historyEmpty.classList.remove('hidden');
        els.historySection.style.display = 'block';
        return;
    }

    els.historyEmpty.classList.add('hidden');

    // Mostrar los últimos 5
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
            </div>
        `;
    }).join('');

    // Event listeners para items del historial
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

/* ============================================
   URL Analysis Flow
   ============================================ */
async function analyzeCurrentUrl() {
    const text = els.urlInput.value.trim();
    if (!text) return;

    const validation = validateUrl(text);
    if (!validation.valid) {
        showError(validation.reason || 'Eso no parece un enlace web válido.');
        return;
    }

    currentUrl = validation.url;
    hapticFeedback('medium');

    // Mostrar pantalla de carga
    showScreen('loading');

    try {
        const result = await analyzeUrl(currentUrl);
        currentResult = result;
        addToHistory(currentUrl, result);
        renderResult(result);
        showScreen('result');

        // Feedback háptico según resultado
        if (result.positives === 0) {
            hapticFeedback('success');
        } else if (result.positives > 3) {
            hapticFeedback('danger');
        } else {
            hapticFeedback('warning');
        }
    } catch (err) {
        showScreen('main');
        showError(
            err.message || 'No se pudo comprobar el enlace. Inténtalo de nuevo.',
            () => analyzeCurrentUrl()
        );
    }
}

/* ============================================
   Result Rendering
   ============================================ */
function renderResult(result) {
    const positives = result.positives || 0;
    const total = result.total || 0;
    const suspicious = result.suspicious || 0;

    let status, icon, title, message;

    if (positives === 0 && suspicious === 0) {
        status = 'safe';
        icon = '✅';
        title = 'Este enlace es seguro';
        message = `${total} motores de seguridad lo han analizado y ninguno ha encontrado problemas. Puedes abrirlo con tranquilidad.`;
    } else if (positives > 3) {
        status = 'danger';
        icon = '🚨';
        title = '¡No abras este enlace!';
        message = `${positives} de ${total} motores de seguridad lo han marcado como peligroso. Podría ser una estafa, phishing o contener malware.`;
    } else {
        status = 'warning';
        icon = '⚠️';
        title = 'Ten cuidado con este enlace';
        message = `${positives + suspicious} de ${total} motores han encontrado algo sospechoso. Te recomendamos no introducir datos personales en esta web.`;
    }

    // Semáforo
    els.resultIcon.className = `result-traffic-light ${status}`;
    els.resultIcon.innerHTML = `<span>${icon}</span>`;

    // Textos
    els.resultTitle.textContent = title;
    els.resultTitle.className = `result-title ${status}`;
    els.resultMessage.textContent = message;

    // URL
    els.resultUrl.textContent = currentUrl;

    // Botón abrir (solo si es seguro)
    els.btnOpenUrl.style.display = status === 'danger' ? 'none' : 'inline-flex';

    // Detalles técnicos
    renderTechnicalDetails(result, status);
}

function renderTechnicalDetails(result, status) {
    const positives = result.positives || 0;
    const total = result.total || 0;
    const harmless = result.harmless || 0;
    const undetected = result.undetected || 0;
    const suspicious = result.suspicious || 0;

    let detailsHtml = `
        <div class="detail-grid">
            <div class="detail-row">
                <span class="detail-label">Motores que lo analizaron</span>
                <span class="detail-value">${total}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Detectado como peligroso</span>
                <span class="detail-value ${positives > 0 ? 'danger' : 'safe'}">${positives}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Marcado como sospechoso</span>
                <span class="detail-value ${suspicious > 0 ? 'warning' : ''}">${suspicious}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Sin problemas detectados</span>
                <span class="detail-value safe">${harmless}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Sin analizar</span>
                <span class="detail-value">${undetected}</span>
            </div>
    `;

    if (result.scanDate) {
        const scanDate = new Date(result.scanDate * 1000 || result.scanDate);
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Último análisis</span>
                <span class="detail-value">${scanDate.toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'short', year: 'numeric'
                })}</span>
            </div>
        `;
    }

    if (result.fromCache) {
        detailsHtml += `
            <div class="detail-row">
                <span class="detail-label">Fuente</span>
                <span class="detail-value" style="color:var(--color-info)">Caché local</span>
            </div>
        `;
    }

    detailsHtml += `</div>`;

    // Engines que detectaron amenaza
    const engines = result.engines;
    if (engines && Object.keys(engines).length > 0) {
        detailsHtml += `
            <div class="detail-engines">
                <div class="detail-engines-title">Motores que alertaron:</div>
                <div class="engine-list">
                    ${Object.entries(engines).map(([name, info]) => `
                        <span class="engine-tag malicious">${name}</span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    els.resultDetailsContent.innerHTML = detailsHtml;

    // Si es peligroso, abrir detalles automáticamente
    if (status === 'danger') {
        els.resultDetails.setAttribute('open', '');
    } else {
        els.resultDetails.removeAttribute('open');
    }
}

/* ============================================
   Input Handling
   ============================================ */
function updateCheckButton() {
    const hasText = els.urlInput.value.trim().length > 0;
    els.btnCheck.disabled = !hasText;
}

/* ============================================
   QR Scanner Flow
   ============================================ */
async function openScanner() {
    showScreen('scanner');

    await startScanner(
        'qr-reader',
        (decodedText) => {
            // QR detectado
            hapticFeedback('success');
            stopScanner();
            showScreen('main');
            els.urlInput.value = decodedText;
            updateCheckButton();

            // Auto-analizar si parece una URL
            const validation = validateUrl(decodedText);
            if (validation.valid) {
                setTimeout(() => analyzeCurrentUrl(), 300);
            } else {
                showToast('QR leído. Comprueba si el contenido es un enlace web.');
            }
        },
        (errorMsg) => {
            // Error al iniciar escáner
            showScreen('main');
            showError(errorMsg);
        }
    );
}

async function closeScanner() {
    await stopScanner();
    showScreen('main');
}

/* ============================================
   Image Upload
   ============================================ */
async function handleImageUpload(file) {
    if (!file) return;

    showToast('Buscando código QR en la imagen...');

    try {
        const result = await scanFromImage(file);
        els.urlInput.value = result;
        updateCheckButton();
        hapticFeedback('success');
        showToast('¡Código QR encontrado!');

        // Auto-analizar
        const validation = validateUrl(result);
        if (validation.valid) {
            setTimeout(() => analyzeCurrentUrl(), 500);
        }
    } catch (err) {
        showError(err.message || 'No se pudo leer el código QR de la imagen.');
    }
}

/* ============================================
   Event Listeners
   ============================================ */
function initEventListeners() {
    // --- Main Screen ---

    // Input de URL
    els.urlInput.addEventListener('input', updateCheckButton);
    els.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (els.urlInput.value.trim()) {
                analyzeCurrentUrl();
            }
        }
    });

    // Botón pegar
    els.btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                els.urlInput.value = text;
                updateCheckButton();
                hapticFeedback('light');
                showToast('Pegado del portapapeles');
            }
        } catch {
            showToast('No se pudo acceder al portapapeles');
        }
    });

    // Botón comprobar
    els.btnCheck.addEventListener('click', analyzeCurrentUrl);

    // Botón escanear QR
    els.btnScanQr.addEventListener('click', openScanner);

    // Botón subir imagen
    els.btnUploadImage.addEventListener('click', () => {
        els.fileInput.click();
    });
    els.fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleImageUpload(file);
        els.fileInput.value = ''; // Reset para permitir resubir mismo archivo
    });

    // Borrar historial
    els.btnClearHistory.addEventListener('click', () => {
        clearHistory();
        renderHistory();
        hapticFeedback('light');
        showToast('Historial borrado');
    });

    // --- Scanner Screen ---
    els.btnCloseScanner.addEventListener('click', closeScanner);

    // --- Result Screen ---
    els.btnOpenUrl.addEventListener('click', () => {
        if (currentUrl) {
            window.open(currentUrl, '_blank', 'noopener,noreferrer');
        }
    });

    els.btnShare.addEventListener('click', async () => {
        if (currentUrl && currentResult) {
            const result = await shareResult(currentUrl, currentResult);
            if (result.method === 'clipboard' || result.method === 'clipboard-legacy') {
                showToast('Resultado copiado al portapapeles');
            }
        }
    });

    els.btnNewCheck.addEventListener('click', () => {
        currentUrl = '';
        currentResult = null;
        els.urlInput.value = '';
        updateCheckButton();
        showScreen('main');
        loadTip();
        renderHistory();
    });

    // --- Info Dialog ---
    els.btnInfo.addEventListener('click', () => {
        els.infoDialog.classList.remove('hidden');
    });
    els.btnCloseInfo.addEventListener('click', () => {
        els.infoDialog.classList.add('hidden');
    });
    els.infoDialog.addEventListener('click', (e) => {
        if (e.target === els.infoDialog) {
            els.infoDialog.classList.add('hidden');
        }
    });

    // --- Error Dialog ---
    els.btnCloseError.addEventListener('click', closeError);
    els.btnErrorRetry.addEventListener('click', () => {
        closeError();
        if (lastRetryAction) lastRetryAction();
    });
    els.errorDialog.addEventListener('click', (e) => {
        if (e.target === els.errorDialog) closeError();
    });

    // --- Keyboard: Escape cierra diálogos ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!els.infoDialog.classList.contains('hidden')) {
                els.infoDialog.classList.add('hidden');
            }
            if (!els.errorDialog.classList.contains('hidden')) {
                closeError();
            }
            if (screens.scanner.classList.contains('active')) {
                closeScanner();
            }
        }
    });
}

/* ============================================
   Service Worker Registration
   ============================================ */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'activated') {
                        showToast('✨ Centinela se ha actualizado');
                    }
                });
            });
        } catch (err) {
            console.warn('Service Worker registration failed:', err);
        }
    }
}

/* ============================================
   Init
   ============================================ */
function init() {
    // 1. Registrar Service Worker
    registerServiceWorker();

    // 2. Mostrar onboarding si primera vez
    initOnboarding();

    // 3. Cargar tip del día
    loadTip();

    // 4. Renderizar historial
    renderHistory();

    // 5. Conectar event listeners
    initEventListeners();

    // 6. Comprobar si se abrió vía Web Share Target o Shortcut
    const urlParams = new URLSearchParams(window.location.search);
    
    // Acceso directo: Escanear
    if (urlParams.get('action') === 'scan') {
        openScanner();
    }

    const sharedUrl = checkSharedUrl();
    if (sharedUrl) {
        els.urlInput.value = sharedUrl;
        updateCheckButton();
        // Auto-analizar después de un breve delay para que la UI cargue
        setTimeout(() => analyzeCurrentUrl(), 500);
    }

    // 7. Rotar tip cada 30 segundos
    setInterval(loadTip, 30000);

    console.log('🛡️ Centinela v2.0.0 — Tu guardián digital');
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
