/**
 * Centinela — App Principal
 * Orquestador de toda la aplicación
 */

import { analyzeUrl, validateUrl } from './api.js';
import { scanFromImage } from './scanner.js';
import { clearHistory } from './history.js';
import { getRandomTip } from './tips.js';
import { shareResult, consumeSharedTarget, shareConfirmation, hapticFeedback } from './share.js';
import { resolveQrText, SHARE_NO_LINK_MESSAGE } from './core/entry.js';
import { renderStatsScreen } from './stats.js';
import { recordScanOutcome } from './core/scan-record.js';
import { register, navigate, bindNav } from './router.js';
import * as homeScreen from './screens/home.js';
import * as resultScreen from './screens/result.js';
import * as loadingScreen from './screens/loading.js';
import * as scannerScreen from './screens/scanner.js';
import * as previewScreen from './screens/preview.js';
import * as dialogScreen from './screens/dialog.js';
import * as guardianScreen from './screens/guardian.js';
import * as historyScreen from './screens/history.js';
import * as settingsScreen from './screens/settings.js';

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
    btnSos: $('btn-sos'),
    // Dialogs & Overlays
    btnClosePreview: $('btn-close-preview'),
    previewDialog: $('preview-dialog'),
    previewImg: $('preview-img'),
    previewLoading: $('preview-loading'),
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
   Toast
   ============================================ */
function showToast(message, duration = 3000) {
    if (!els.toast || !els.toastMessage) return;
    els.toastMessage.textContent = message;
    els.toast.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => els.toast?.classList.add('hidden'), duration);
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
    const text = els.urlInput?.value.trim();
    if (!text) { showToast('Pega primero un enlace'); return; }

    const validation = validateUrl(text);
    if (!validation.valid) { showError(validation.reason || 'Esto no parece un enlace web.'); return; }

    currentUrl = validation.url;
    hapticFeedback('medium');
    navigate('loading', { onRetry: () => analyzeCurrentUrl() });

    try {
        const result = await analyzeUrl(currentUrl);
        currentResult = result;

        // ÚNICO cableado (HU-02): clasificar → historial → estadísticas, con el
        // mismo veredicto en los tres sitios. Vive en core/scan-record.js para
        // que el test de contrato lo ejercite de verdad (no una réplica a mano).
        const verdict = recordScanOutcome(currentUrl, result);

        navigate('result', { result, url: currentUrl, local: result.local });
        if (verdict === 'safe') hapticFeedback('success');
        else if (verdict === 'danger') hapticFeedback('danger');
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
            // HU-11 AC-01/AC-03: resolver el QR. Si trae enlace → comprobar;
            // si no → aviso llano y NINGUNA consulta.
            const resolved = resolveQrText(decodedText);
            if (resolved.status !== 'ok') {
                showToast(resolved.message);
                return;
            }
            hapticFeedback('success');
            navigate('main');
            if (els.urlInput) els.urlInput.value = resolved.url;
            updateCheckButton();
            setTimeout(() => analyzeCurrentUrl(), 300);
        },
        // AC-02: salidas del estado «cámara no disponible».
        onUpload: () => els.fileInput?.click(),
        onPaste: () => {
            navigate('main');
            setTimeout(() => els.urlInput?.focus(), 0);
        },
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
        const resolved = resolveQrText(result);
        if (resolved.status !== 'ok') {
            showError(resolved.message);
            return;
        }
        if (els.urlInput) els.urlInput.value = resolved.url;
        updateCheckButton();
        hapticFeedback('success');
        showToast('¡Código QR encontrado!');
        setTimeout(() => analyzeCurrentUrl(), 500);
    } catch (err) {
        showError(err.message || 'No se pudo leer el código QR de la imagen.');
    }
}

/* ============================================
   Event Listeners
   ============================================ */
function initEventListeners() {
    // --- Main Screen ---
    els.urlInput?.addEventListener('input', updateCheckButton);
    els.urlInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (els.urlInput.value.trim()) analyzeCurrentUrl(); }
    });
    els.btnPaste?.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && els.urlInput) { els.urlInput.value = text; updateCheckButton(); hapticFeedback('light'); showToast('Pegado del portapapeles'); }
        } catch { showToast('No se pudo acceder al portapapeles'); }
    });
    els.btnCheck?.addEventListener('click', analyzeCurrentUrl);
    els.btnScanQr?.addEventListener('click', openScanner);
    els.btnUploadImage?.addEventListener('click', () => els.fileInput?.click());
    els.fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleImageUpload(file);
        if (els.fileInput) els.fileInput.value = '';
    });
    els.btnClearHistory?.addEventListener('click', () => { clearHistory(); homeScreen.renderHistory(); hapticFeedback('light'); showToast('Historial borrado'); });

    // --- Scanner Screen ---
    els.btnCloseScanner?.addEventListener('click', closeScanner);

    // --- Result Screen ---
    els.btnOpenUrl?.addEventListener('click', () => { if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer'); });
    els.btnShare?.addEventListener('click', async () => {
        if (currentUrl && currentResult) {
            const result = await shareResult(currentUrl, currentResult);
            const confirmation = shareConfirmation(result.method);
            if (confirmation) showToast(confirmation);
        }
    });
    els.btnNewCheck?.addEventListener('click', () => {
        currentUrl = ''; currentResult = null; if (els.urlInput) els.urlInput.value = ''; updateCheckButton();
        navigate('main'); homeScreen.renderHistory();
    });
    els.btnPreview?.addEventListener('click', () => previewScreen.openPreview(currentUrl, {
        previewDialog: $('preview-dialog'),
        previewImg: $('preview-img'),
        previewLoading: $('preview-loading'),
        btnPreview: els.btnPreview,
        previewTimeout: null,
    }));
    els.btnSos?.addEventListener('click', () => {
        const phone = guardianScreen.loadGuardianPhone();
        if (!phone) return;
        const brandVisible = $('result-brand')?.style.display !== 'none';
        const brandMsg = $('brand-msg')?.textContent || '';
        const resultTitle = $('result-title')?.textContent || '';
        const message = guardianScreen.buildSosMessage(currentUrl, resultTitle, brandMsg, brandVisible);
        guardianScreen.openSosWhatsApp(phone, message);
        hapticFeedback('medium');
    });

    // --- Dialogs ---
    dialogScreen.bindInfoDialog({
        btnInfo: $('btn-info'),
        infoDialog: $('info-dialog'),
        btnCloseInfo: $('btn-close-info'),
    });

    els.btnClosePreview?.addEventListener('click', () => previewScreen.closePreviewDialog({
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
    els.btnCloseError?.addEventListener('click', closeError);
    els.btnErrorRetry?.addEventListener('click', () => { closeError(); if (lastRetryAction) lastRetryAction(); });
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
    register('history', { mount: historyScreen.mount, unmount: historyScreen.unmount });
    register('settings', { mount: settingsScreen.mount, unmount: settingsScreen.unmount });
    register('stats', { mount: (container) => renderStatsScreen($('stats-container')) });
    register('result', { mount: resultScreen.mount, unmount: resultScreen.unmount });
    register('loading', { mount: loadingScreen.mount, unmount: loadingScreen.unmount });
    register('scanner', { mount: scannerScreen.mount, unmount: scannerScreen.unmount });

    bindNav('.nav-btn[data-screen="main"]', 'main');
    bindNav('.nav-btn[data-screen="stats"]', 'stats');
    bindNav('.nav-btn[data-screen="history"]', 'history');
    bindNav('.nav-btn[data-screen="settings"]', 'settings');

    registerServiceWorker();

    homeScreen.mount();
    getRandomTip();
    homeScreen.renderHistory();
    initEventListeners();

    // HU-12 — Web Share Target: si venimos de compartir desde WhatsApp, la
    // comprobación arranca sola (AC-01/AC-02); si había texto sin enlace, aviso
    // llano en la portada (AC-03). Si no, atendemos el acceso directo «Escanear QR».
    const shared = consumeSharedTarget();
    if (shared.url) {
        els.urlInput.value = shared.url;
        updateCheckButton();
        setTimeout(() => analyzeCurrentUrl(), 300);
    } else if (shared.present) {
        showToast(SHARE_NO_LINK_MESSAGE);
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'scan') { openScanner(); }
    }
}

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
