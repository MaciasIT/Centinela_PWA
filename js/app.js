/**
 * Centinela — App Principal
 * Orquestador de toda la aplicación
 */

import { analyzeUrl, validateUrl } from './api.js';
import { scanFromImage } from './scanner.js';
import { clearHistory } from './history.js';
import { getRandomTip } from './tips.js';
import { shareResult, checkSharedUrl, hapticFeedback } from './share.js';
import { recordScan } from './stats.js';
import { register, navigate, bindNav } from './router.js';
import * as homeScreen from './screens/home.js';
import * as resultScreen from './screens/result.js';
import * as scannerScreen from './screens/scanner.js';
import * as previewScreen from './screens/preview.js';
import * as dialogScreen from './screens/dialog.js';
import * as guardianScreen from './screens/guardian.js';

/* ============================================
   DOM Helpers
   ============================================ */
const $ = (id) => document.getElementById(id);

const els = {
    // Main screen
    urlInput: $('url-input'),
    btnPaste: $('btn-paste'),
    btnCheck: $('btn-check'),
    btnScanQr: $('btn-scan-qr'),
    btnUploadImage: $('btn-upload-image'),
    fileInput: $('file-input'),
    btnClearHistory: $('btn-clear-history'),
    // Scanner
    btnCloseScanner: $('btn-close-scanner'),
    // Result
    btnOpenUrl: $('btn-open-url'),
    btnShare: $('btn-share'),
    btnNewCheck: $('btn-new-check'),
    btnPreview: $('btn-preview'),
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
    dialogScreen.showError(message, retryAction, {
        errorDialog: $('error-dialog'),
        errorMessage: $('error-message'),
        btnErrorRetry: $('btn-error-retry'),
        lastRetryAction,
    });
    lastRetryAction = retryAction;
}

function closeError() {
    dialogScreen.closeErrorDialog({
        errorDialog: $('error-dialog'),
        lastRetryAction,
        btnErrorRetry: $('btn-error-retry'),
    });
    lastRetryAction = null;
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
    homeScreen.updateCheckButton();
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
    els.btnClearHistory.addEventListener('click', () => { clearHistory(); homeScreen.renderHistory(); hapticFeedback('light'); showToast('Historial borrado'); });

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
        navigate('main'); homeScreen.renderHistory();
    });
    els.btnPreview.addEventListener('click', () => previewScreen.openPreview(currentUrl, {
        previewDialog: $('preview-dialog'),
        previewImg: $('preview-img'),
        previewLoading: $('preview-loading'),
        btnPreview: els.btnPreview,
        previewTimeout: null,
    }));

    // --- Dialogs ---
    dialogScreen.bindInfoDialog({
        btnInfo: $('btn-info'),
        infoDialog: $('info-dialog'),
        btnCloseInfo: $('btn-close-info'),
    });

    els.btnClosePreview.addEventListener('click', () => previewScreen.closePreviewDialog({
        previewDialog: $('preview-dialog'),
        previewImg: $('preview-img'),
        btnPreview: els.btnPreview,
    }));
    $('preview-dialog')?.addEventListener('click', (e) => {
        if (e.target.id === 'preview-dialog') previewScreen.closePreviewDialog({
            previewDialog: $('preview-dialog'),
            previewImg: $('preview-img'),
            btnPreview: els.btnPreview,
        });
    });

    // --- Guardian ---
    guardianScreen.initGuardian({
        guardianPhone: $('guardian-phone'),
    });
    guardianScreen.mount();

    // --- Error Dialog ---
    els.btnCloseError.addEventListener('click', closeError);
    els.btnErrorRetry.addEventListener('click', () => { closeError(); if (lastRetryAction) lastRetryAction(); });
    $('error-dialog')?.addEventListener('click', (e) => { if (e.target.id === 'error-dialog') closeError(); });

    // --- Keyboard: Escape cierra diálogos/scanner o no hace nada ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!$('info-dialog')?.classList.contains('hidden')) { $('info-dialog').classList.add('hidden'); return; }
            if (!$('error-dialog')?.classList.contains('hidden')) { closeError(); return; }
            if (!$('preview-dialog')?.classList.contains('hidden')) { previewScreen.closePreviewDialog({ previewDialog: $('preview-dialog'), previewImg: $('preview-img'), btnPreview: els.btnPreview }); return; }
            if (document.getElementById('screen-scanner')?.classList.contains('active')) { navigate('main'); return; }
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
    register('main', { mount: homeScreen.mount, unmount: homeScreen.unmount });
    register('stats', { mount: (container) => renderStatsScreen($('stats-container')) });
    register('result', { mount: resultScreen.mount, unmount: resultScreen.unmount });
    register('scanner', { mount: scannerScreen.mount, unmount: scannerScreen.unmount });

    bindNav('.nav-btn[data-screen="main"]', 'main');
    bindNav('.nav-btn[data-screen="stats"]', 'stats');

    registerServiceWorker();

    homeScreen.mount();
    getRandomTip();
    homeScreen.renderHistory();
    initEventListeners();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'scan') { openScanner(); }
    const sharedUrl = checkSharedUrl();
    if (sharedUrl) {
        els.urlInput.value = sharedUrl;
        updateCheckButton();
        setTimeout(() => analyzeCurrentUrl(), 500);
    }
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
