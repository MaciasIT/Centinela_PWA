/**
 * Centinela — Scanner Screen
 * Wrapper sobre js/scanner.js para el sistema de screens
 */
import { startScanner, stopScanner } from '../scanner.js';

let _onScan = null;
let _onError = null;

/**
 * Mount: iniciar escáner QR en el elemento #qr-reader
 * @param {HTMLElement} container
 * @param {{onScan: Function, onError: Function}} data
 */
export function mount(container, data) {
  _onScan = data?.onScan || (() => {});
  _onError = data?.onError || (() => {});

  startScanner('qr-reader', _onScan, _onError);
}

export function unmount() {
  stopScanner();
  _onScan = null;
  _onError = null;
}
