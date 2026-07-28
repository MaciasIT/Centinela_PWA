/**
 * Centinela — App Principal
 * Orquestador de toda la aplicación
 */

import { analyzeUrl, validateUrl } from './api.js';
import { scanFromImage } from './scanner.js';
import { addToHistory, getHistory, clearHistory, formatDate, extractDomain } from './history.js';
import { getRandomTip } from './tips.js';
import { shareResult, copyToClipboard, checkSharedUrl, hapticFeedback } from './share.js';
import { recordScan, renderStatsScreen } from './stats.js';
import { register, navigate, bindNav } from './router.js';
import * as homeScreen from './screens/home.js';
import * as resultScreen from './screens/result.js';
import * as scannerScreen from './screens/scanner.js';

/* ============================================
   DOM Helpers
   ============================================ */
const $ = (id) => document.getElementById(id);

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
    btnShare: $('btn-share'),
    btnNewCheck: $('btn-new-check'),
    btnPreview: $('btn-preview'),
    btnSos: $('btn-sos'),
    // Dialogs
    btnInfo: $('btn-info'),
    infoDialog: $('info-dialog'),
    btnCloseInfo: $('btn-close-info'),
    guardianPhone: $('guardian-phone'),
    btnSaveGuardian: $('btn-save-guardian'),
    guardianStatus: $('guardian-status'),
    previewDialog: $('preview-dialog'),
    previewImg: $('preview-img'),
    previewLoading: $('preview-loading'),
    btnClosePreview: $('btn-close-preview'),
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
const GUARDIAN_KEY = 'centinela_guardian_phone';

/* ============================================
   Screen Management
   ============================================ */
function showScreen(name) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`screen-${name}`);
    if (el) el.classList.add('active');
}

/* ============================================
   Toast
   ============================================ */
function showToast(message, duration = 3000) {
    els.toastMessage.textContent = message;
    els.toast.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => els.toast.classList.add('hidden'), duration);
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
   Safe Preview Logic
   ============================================ */
let previewTimeout = null;

function openPreview() {
    if (!currentUrl) return;
    if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
    els.previewImg.src = '';
    els.previewImg.classList.add('hidden');
    els.previewLoading.classList.remove('hidden');
    els.previewDialog.classList.remove('hidden');
    els.previewLoading.innerHTML = '<div class="spinner"></div> Generando imagen segura...';
    els.btnPreview.disabled = true;

    const encodedUrl = encodeURIComponent(currentUrl);
    const mshotsUrl = `https://s.wordpress.com/mshots/v1/${encodedUrl}?w=1200`;
    const thumbWsUrl = `https://api.thumbnail.ws/api/${encodedUrl}?width=1200`;
    let loaded = false;
    let triedFallback = false;

    const finish = (success) => {
        if (loaded) return;
        loaded = true;
        if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
        els.btnPreview.disabled = false;
        if (success) {
            els.previewLoading.classList.add('hidden');
            els.previewImg.classList.remove('hidden');
        } else {
            els.previewLoading.innerHTML = `❌ No se pudo cargar la vista previa.<br><small style="color:var(--text-muted)">El sitio podría estar protegido o no ser accesible.</small>`;
        }
    };

    const tryLoad = (url, isFallback = false) => {
        els.previewImg.onload = () => {
            if (els.previewImg.naturalWidth < 50 || els.previewImg.naturalHeight < 50) {
                if (!triedFallback && !isFallback) {
                    triedFallback = true;
                    els.previewLoading.innerHTML = '<div class="spinner"></div> Reintentando con fuente alternativa...';
                    tryLoad(thumbWsUrl, true);
                } else { finish(false); }
                return;
            }
            finish(true);
        };
        els.previewImg.onerror = () => {
            if (!triedFallback && !isFallback) {
                triedFallback = true;
                els.previewLoading.innerHTML = '<div class="spinner"></div> Reintentando con fuente alternativa...';
                tryLoad(thumbWsUrl, true);
            } else { finish(false); }
        };
        els.previewImg.src = url;
    };

    previewTimeout = setTimeout(() => {
        if (!loaded) { els.previewImg.src = ''; finish(false); }
    }, 15000);
    tryLoad(mshotsUrl);
    hapticFeedback('light');
}

function closePreview() {
    els.previewDialog.classList.add('hidden');
    els.previewImg.src = '';
    els.btnPreview.disabled = false;
}

/* ============================================
   Guardian Angel
   ============================================ */
function initGuardian() {
    const saved = localStorage.getItem(GUARDIAN_KEY);
    if (saved) els.guardianPhone.value = saved;
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
        if (currentSlide >= 3) { completeOnboarding(); }
        else { updateSlide(); if (currentSlide === 2) els.onboardingNext.textContent = '¡Empezar!'; }
    });
    els.onboardingSkip.addEventListener('click', completeOnboarding);
}

function updateSlide() {
    document.querySelectorAll('.onboarding-slide').forEach((slide, i) => slide.classList.toggle('active', i === currentSlide));
    document.querySelectorAll('.onboarding-dots .dot').forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
}

function completeOnboarding() {
    els.onboarding.classList.add('hidden');
    try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch {}
}

/* ============================================
   Tips
   ============================================ */
function loadTip() { els.tipText.textContent = getRandomTip(); }

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
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
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
    if (!validation.valid) { showError(validation.reason || 'Eso no parece un enlace web válido.'); return; }

    currentUrl = validation.url;
    hapticFeedback('medium');
    navigate('loading');

    try {
        const result = await analyzeUrl(currentUrl);
        currentResult = result;
        addToHistory(currentUrl, result);
        recordScan(currentUrl, result.positives === 0 ? 'safe' : result.positives > 3 ? 'dangerous' : 'suspicious');
        navigate('result', { result, url: currentUrl });
        if (result.positives === 0) hapticFeedback('success');
        else if (result.positives > 3) hapticFeedback('danger');
        else hapticFeedback('warning');
    } catch (err) {
        navigate('main');
        showError(err.message || 'No se pudo comprobar el enlace. Inténtalo de nuevo.', () => analyzeCurrentUrl());
    }
}

/* ============================================
   Input Handling
   ============================================ */
function updateCheckButton() {
    els.btnCheck.disabled = els.urlInput.value.trim().length === 0;
}

/* ============================================
   QR Scanner Flow
   ============================================ */
async function openScanner() {
    navigate('scanner', {
        onScan: (decodedText) => {
            hapticFeedback('success');
            navigate('main');
            els.urlInput.value = decodedText;
            updateCheckButton();
            const validation = validateUrl(decodedText);
            if (validation.valid) setTimeout(() => analyzeCurrentUrl(), 300);
            else showToast('QR leído. Comprueba si el contenido es un enlace web.');
        },
        onError: (errorMsg) => { navigate('main'); showError(errorMsg); }
    });
}

async function closeScanner() { navigate('main'); }

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
        const validation = validateUrl(result);
        if (validation.valid) setTimeout(() => analyzeCurrentUrl(), 500);
    } catch (err) {
        showError(err.message || 'No se pudo leer el código QR de la imagen.');
    }
}

/* ============================================
   Event Listeners
   ============================================ */
function initEventListeners() {
    // --- Main Screen ---
    els.urlInput.addEventListener('input', updateCheckButton);
    els.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (els.urlInput.value.trim()) analyzeCurrentUrl(); }
    });
    els.btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) { els.urlInput.value = text; updateCheckButton(); hapticFeedback('light'); showToast('Pegado del portapapeles'); }
        } catch { showToast('No se pudo acceder al portapapeles'); }
    });
    els.btnCheck.addEventListener('click', analyzeCurrentUrl);
    els.btnScanQr.addEventListener('click', openScanner);
    els.btnUploadImage.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleImageUpload(file);
        els.fileInput.value = '';
    });
    els.btnClearHistory.addEventListener('click', () => { clearHistory(); renderHistory(); hapticFeedback('light'); showToast('Historial borrado'); });

    // --- Scanner Screen ---
    els.btnCloseScanner.addEventListener('click', closeScanner);

    // --- Result Screen ---
    els.btnOpenUrl.addEventListener('click', () => { if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer'); });
    els.btnShare.addEventListener('click', async () => {
        if (currentUrl && currentResult) {
            const result = await shareResult(currentUrl, currentResult);
            if (result.method === 'clipboard' || result.method === 'clipboard-legacy') showToast('Resultado copiado al portapapeles');
        }
    });
    els.btnNewCheck.addEventListener('click', () => {
        currentUrl = ''; currentResult = null; els.urlInput.value = ''; updateCheckButton();
        navigate('main'); loadTip(); renderHistory();
    });
    els.btnPreview.addEventListener('click', openPreview);

    // --- Info Dialog ---
    els.btnInfo.addEventListener('click', () => els.infoDialog.classList.remove('hidden'));
    els.btnCloseInfo.addEventListener('click', () => els.infoDialog.classList.add('hidden'));
    els.infoDialog.addEventListener('click', (e) => { if (e.target === els.infoDialog) els.infoDialog.classList.add('hidden'); });

    // --- Preview Dialog ---
    els.btnClosePreview.addEventListener('click', closePreview);
    els.previewDialog.addEventListener('click', (e) => { if (e.target === els.previewDialog) closePreview(); });

    // --- Guardian Angel ---
    els.btnSaveGuardian.addEventListener('click', () => {
        const phone = els.guardianPhone.value.trim().replace(/\D/g, '');
        if (phone) {
            localStorage.setItem(GUARDIAN_KEY, phone);
            els.guardianStatus.textContent = '✅ Experto guardado';
            hapticFeedback('success');
            setTimeout(() => els.guardianStatus.textContent = '', 3000);
        } else { showToast('Introduce un número válido'); }
    });

    // --- SOS ---
    els.btnSos.addEventListener('click', () => {
        const phone = localStorage.getItem(GUARDIAN_KEY);
        if (!phone) return;
        const brandInfo = els.resultBrand.style.display !== 'none' ? `\n🔍 Identidad: ${els.brandMsg.textContent}` : '';
        const message = `🛡️ *CENTINELA SOS* 👼\n\nHe analizado este enlace y la app me da un aviso. ¿Me puedes decir si es seguro entrar?\n\n🔗 *Enlace:* ${currentUrl}${brandInfo}\n⚠️ *Veredicto:* ${els.resultTitle.textContent}\n\n¡Gracias experto!`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        hapticFeedback('medium');
    });

    // --- Error Dialog ---
    els.btnCloseError.addEventListener('click', closeError);
    els.btnErrorRetry.addEventListener('click', () => { closeError(); if (lastRetryAction) lastRetryAction(); });
    els.errorDialog.addEventListener('click', (e) => { if (e.target === els.errorDialog) closeError(); });

    // --- Keyboard: Escape cierra diálogos/scanner o no hace nada ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!els.infoDialog.classList.contains('hidden')) {
                els.infoDialog.classList.add('hidden');
                return;
            }
            if (!els.errorDialog.classList.contains('hidden')) {
                closeError();
                return;
            }
            if (!els.previewDialog.classList.contains('hidden')) {
                closePreview();
                return;
            }
            if (document.getElementById('screen-scanner')?.classList.contains('active')) {
                navigate('main');
                return;
            }
        }
    });
}

/* ============================================
   Service Worker Registration
   ============================================ */
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const swUrl = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : './sw.js';
        const swOptions = import.meta.env.DEV ? { type: 'module' } : {};
        const registration = await navigator.serviceWorker.register(swUrl, swOptions);
        if (registration.waiting) { registration.waiting.postMessage({ type: 'SKIP_WAITING' }); window.location.reload(); return; }
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
                }
            });
        });
        setInterval(() => registration.update(), 60 * 60 * 1000);
    } catch (_) {}
}

/* ============================================
   Init
   ============================================ */
function init() {
    // 0. Registrar screens en el router
    register('main', { mount: homeScreen.mount, unmount: homeScreen.unmount });
    register('stats', { mount: (container) => renderStatsScreen($('stats-container')) });
    register('result', { mount: resultScreen.mount, unmount: resultScreen.unmount });
    register('scanner', { mount: scannerScreen.mount, unmount: scannerScreen.unmount });

    // 0b. Navegación inferior vinculada al router
    bindNav('.nav-btn[data-screen="main"]', 'main');
    bindNav('.nav-btn[data-screen="stats"]', 'stats');

    // 0c. Cargar Ángel de la Guarda
    initGuardian();

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
    if (urlParams.get('action') === 'scan') { openScanner(); }
    const sharedUrl = checkSharedUrl();
    if (sharedUrl) {
        els.urlInput.value = sharedUrl;
        updateCheckButton();
        setTimeout(() => analyzeCurrentUrl(), 500);
    }

    // 7. Rotar tip cada 30 segundos
    setInterval(loadTip, 30000);
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
