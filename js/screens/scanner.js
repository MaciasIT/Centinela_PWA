/**
 * Centinela — Scanner Screen
 * Wrapper sobre js/scanner.js para el sistema de screens.
 *
 * Además del escáner de cámara, gestiona el estado «cámara no disponible»
 * (HU-11 AC-02): cuando no hay permiso, no hay cámara o la cámara está ocupada,
 * se sustituye la vista por un mensaje llano con dos salidas —subir una imagen
 * y pegar el enlace a mano— sin dejar al usuario en un marco negro vacío.
 */
import { startScanner, stopScanner } from '../scanner.js';

let _onScan = null;
let _data = {};
let _bound = false;

const $ = (id) => document.getElementById(id);

/**
 * Muestra el estado «cámara no disponible» con el mensaje dado.
 * @param {string} message
 * @param {Document} [doc]
 */
export function showCameraUnavailable(message, doc = document) {
    const box = doc.getElementById('scanner-unavailable');
    const msg = doc.getElementById('scanner-unavailable-msg');
    const reader = doc.getElementById('qr-reader');
    if (msg) msg.textContent = message;
    if (box) box.classList.remove('hidden');
    if (reader) reader.classList.add('hidden');
}

/**
 * Vuelve a la vista normal del escáner (cámara disponible).
 * @param {Document} [doc]
 */
export function resetScannerView(doc = document) {
    const box = doc.getElementById('scanner-unavailable');
    const reader = doc.getElementById('qr-reader');
    if (box) box.classList.add('hidden');
    if (reader) reader.classList.remove('hidden');
}

function bindActions() {
    if (_bound) return;
    _bound = true;
    $('btn-scanner-upload')?.addEventListener('click', () => { if (_data.onUpload) _data.onUpload(); });
    $('btn-scanner-paste')?.addEventListener('click', () => { if (_data.onPaste) _data.onPaste(); });
}

/**
 * Mount: iniciar escáner QR en el elemento #qr-reader.
 * @param {HTMLElement} container
 * @param {{onScan: Function, onUpload?: Function, onPaste?: Function}} data
 * @param {Function} [startImpl] arrancador inyectable (tests); por defecto el real
 */
export function mount(container, data, startImpl = startScanner) {
    _data = data || {};
    _onScan = _data.onScan || (() => {});

    resetScannerView();
    bindActions();

    startImpl('qr-reader', _onScan, (errorMsg) => {
        // AC-02: mensaje llano (ya viene de core/entry.cameraUnavailableMessage).
        showCameraUnavailable(errorMsg);
    });
}

export function unmount() {
    stopScanner();
    _onScan = null;
    _data = {};
}
