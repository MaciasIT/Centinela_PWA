/**
 * Centinela — QR Scanner Module
 * Integración con html5-qrcode para escaneo de cámara e imagen
 */

let scanner = null;
let isRunning = false;

/**
 * Inicia el escáner de cámara QR
 * @param {string} containerId - ID del elemento contenedor
 * @param {function} onSuccess - Callback cuando detecta un QR (recibe decodedText)
 * @param {function} onError - Callback en caso de error fatal
 * @returns {Promise<void>}
 */
export async function startScanner(containerId, onSuccess, onError) {
    if (isRunning) return;

    try {
        // Verificar que la librería está cargada
        if (typeof Html5Qrcode === 'undefined') {
            throw new Error('La librería del escáner no se ha cargado. Comprueba tu conexión a Internet.');
        }

        scanner = new Html5Qrcode(containerId, { verbose: false });

        const cameras = await Html5Qrcode.getCameras();

        if (!cameras || cameras.length === 0) {
            throw new Error('No se ha encontrado ninguna cámara en el dispositivo.');
        }

        // Preferir cámara trasera
        let cameraId = cameras[0].id;
        const backCamera = cameras.find(c =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('trasera') ||
            c.label.toLowerCase().includes('rear') ||
            c.label.toLowerCase().includes('environment')
        );
        if (backCamera) {
            cameraId = backCamera.id;
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

        isRunning = true;
    } catch (err) {
        console.error('Error iniciando escáner:', err);

        let friendlyMessage;
        const msg = err.message || '';

        if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
            friendlyMessage = 'Necesitamos acceso a tu cámara para escanear QR. Por favor, permite el acceso en los ajustes de tu navegador.';
        } else if (msg.includes('NotFoundError') || msg.includes('cámara')) {
            friendlyMessage = 'No se ha encontrado una cámara. Puedes subir una imagen del código QR en su lugar.';
        } else if (msg.includes('NotReadableError') || msg.includes('TrackStartError')) {
            friendlyMessage = 'La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.';
        } else {
            friendlyMessage = msg || 'No se pudo iniciar el escáner de QR.';
        }

        if (onError) onError(friendlyMessage);
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
            console.warn('Error deteniendo escáner:', e);
        }
        isRunning = false;
        scanner = null;
    }
}

/**
 * Escanea un QR desde un archivo de imagen
 * @param {File} imageFile - Archivo de imagen
 * @returns {Promise<string>} - Texto decodificado del QR
 */
export async function scanFromImage(imageFile) {
    try {
        if (typeof Html5Qrcode === 'undefined') {
            throw new Error('La librería del escáner no se ha cargado.');
        }

        const tempScanner = new Html5Qrcode('temp-scanner-' + Date.now(), { verbose: false });

        // Crear un contenedor temporal
        const container = document.createElement('div');
        container.id = tempScanner._elementId || 'temp-qr-container';
        container.style.display = 'none';
        document.body.appendChild(container);

        try {
            const result = await tempScanner.scanFile(imageFile, true);
            document.body.removeChild(container);
            return result;
        } catch {
            document.body.removeChild(container);
            throw new Error('No se encontró ningún código QR en la imagen. Asegúrate de que el código sea visible y esté bien enfocado.');
        }
    } catch (err) {
        throw err;
    }
}

/**
 * Devuelve si el escáner está activo
 * @returns {boolean}
 */
export function isScannerRunning() {
    return isRunning;
}
