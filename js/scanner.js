import { Html5Qrcode } from 'html5-qrcode';
import { cameraUnavailableMessage } from './core/entry.js';

/**
 * Centinela — QR Scanner Module
 * Integración con html5-qrcode para escaneo de cámara e imagen.
 *
 * La librería se empaqueta localmente (Vite): no hay recursos externos, así que
 * la CSP estricta (`script-src 'self'`) no se rompe.
 */

let scanner = null;
let isRunning = false;

/**
 * Inicia el escáner de cámara QR
 * @param {string} containerId - ID del elemento contenedor
 * @param {function} onSuccess - Callback cuando detecta un QR (recibe decodedText)
 * @param {function} onError - Callback en caso de error fatal
 * @param {typeof Html5Qrcode} [Impl] - implementación inyectable (tests)
 * @returns {Promise<void>}
 */
export async function startScanner(containerId, onSuccess, onError, Impl = Html5Qrcode) {
    if (isRunning) return;

    try {
        scanner = new Impl(containerId, { verbose: false });

        const cameras = await Impl.getCameras();

        if (!cameras || cameras.length === 0) {
            throw new Error('No se ha encontrado ninguna cámara en el dispositivo.');
        }

        const config = {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
                const size = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.floor(size * 0.7);
                return { width: qrboxSize, height: qrboxSize };
            },
            aspectRatio: 1.0,
            disableFlip: false,
        };

        // Estrategia de inicio: intentar facingMode: "environment" primero (ideal para móviles, evita bug de iOS label)
        // Si falla (ej. en laptops que no tienen cámara trasera), usar la primera cámara disponible.
        try {
            await scanner.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => {
                    if (isRunning) {
                        onSuccess(decodedText);
                    }
                },
                () => { /* errores de frames ignorados */ }
            );
        } catch (startErr) {
            const cameraId = cameras[0].id;
            await scanner.start(
                cameraId,
                config,
                (decodedText) => {
                    if (isRunning) {
                        onSuccess(decodedText);
                    }
                },
                () => { /* errores de frames ignorados */ }
            );
        }

        isRunning = true;
    } catch (err) {
        // Mensaje llano que SIEMPRE ofrece subir una imagen (HU-11 AC-02).
        // Se pasa el error ENTERO (no solo `err.message`): el `name`
        // (NotFoundError / NotReadableError) es lo que distingue el mensaje
        // específico del genérico en el camino real (D-2).
        if (onError) onError(cameraUnavailableMessage(err));
    }
}

/**
 * Detiene el escáner de cámara
 */
export async function stopScanner() {
    if (scanner && isRunning) {
        try {
            await scanner.stop();
            scanner.clear();
        } catch (e) {
        }
        isRunning = false;
        scanner = null;
    }
}

/**
 * Escanea un QR desde un archivo de imagen.
 *
 * Cada intento es **aislado** (HU-15 AC-03): crea su propio contenedor temporal
 * con un id único, lo limpia pase lo que pase y no reutiliza estado del intento
 * anterior. Además se corrige el fallo que impedía que la subida funcionara: el
 * `Html5Qrcode` se construía apuntando a un elemento que aún no existía.
 *
 * @param {File|Blob} imageFile archivo de imagen
 * @param {typeof Html5Qrcode} [Impl] implementación inyectable (tests)
 * @returns {Promise<string>} texto decodificado del QR
 */
export async function scanFromImage(imageFile, Impl = Html5Qrcode) {
    if (typeof Impl === 'undefined' || !Impl) {
        throw new Error('La librería del escáner no se ha cargado.');
    }

    // Contenedor temporal único por intento: sin residuos del anterior.
    const elementId = `centinela-qr-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const container = document.createElement('div');
    container.id = elementId;
    container.className = 'hidden';
    document.body.appendChild(container);

    let tempScanner = null;
    try {
        tempScanner = new Impl(elementId, { verbose: false });
        return await tempScanner.scanFile(imageFile, true);
    } catch {
        throw new Error('No he encontrado ningún código QR en esta imagen.');
    } finally {
        try { if (tempScanner && typeof tempScanner.clear === 'function') tempScanner.clear(); } catch { /* limpieza best-effort */ }
        try { container.parentNode ? container.parentNode.removeChild(container) : container.remove(); } catch { /* limpieza best-effort */ }
    }
}

/**
 * Devuelve si el escáner está activo
 * @returns {boolean}
 */
export function isScannerRunning() {
    return isRunning;
}
