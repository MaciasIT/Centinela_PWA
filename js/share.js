/**
 * Centinela — Share Module
 * Compartir resultados y recibir enlaces compartidos (Web Share Target).
 * El veredicto que se comparte lo calcula core/verdict.js (misma tabla; sin reglas duplicadas, HU-02).
 */
import { classify, verdictInfo } from './core/verdict.js';
import { extractFirstValidUrl } from './core/entry.js';

/**
 * Construye el texto llano del veredicto para compartir (función pura, testeable).
 * @param {string} url
 * @param {object} result
 * @returns {string}
 */
export function buildShareText(url, result) {
    const info = verdictInfo(classify(result));
    const emoji = info.icon;
    const statusText = info.label.toUpperCase();
    return `${emoji} He comprobado este enlace con Centinela y es ${statusText}:\n\n${url}\n\n${result.positives || 0}/${result.total || 0} analizadores de VirusTotal lo marcan como peligroso.\n\n🛡️ Comprueba tus enlaces en: centinela-pwa.pages.dev`;
}

/**
 * Comparte el resultado del análisis vía Web Share API o portapapeles
 * @param {string} url - URL analizada
 * @param {object} result - Resultado del análisis
 */
export async function shareResult(url, result) {
    const statusText = verdictInfo(classify(result)).label.toUpperCase();
    const shareText = buildShareText(url, result);

    // Intentar Web Share API (nativo en móvil)
    if (navigator.share) {
        try {
            await navigator.share({
                title: `Centinela: Enlace ${statusText}`,
                text: shareText,
            });
            return { shared: true, method: 'native' };
        } catch (err) {
            // Usuario canceló el share, silenciar
            if (err.name === 'AbortError') {
                return { shared: false, method: 'cancelled' };
            }
        }
    }

    // Fallback: copiar al portapapeles
    return copyToClipboard(shareText);
}

/**
 * Copia texto al portapapeles
 * @param {string} text
 * @returns {{shared: boolean, method: string}}
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return { shared: true, method: 'clipboard' };
    } catch {
        // Fallback para navegadores antiguos
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return { shared: true, method: 'clipboard-legacy' };
        } catch {
            return { shared: false, method: 'failed' };
        }
    }
}

/**
 * Confirma al usuario el resultado de compartir (HU-13 AC-02).
 * Solo hay confirmación visible cuando se copió al portapapeles (el share nativo
 * ya muestra su propia interfaz del sistema).
 * @param {string} method
 * @returns {string|null}
 */
export function shareConfirmation(method) {
    if (method === 'clipboard' || method === 'clipboard-legacy') {
        return 'Copiado. Ya puedes pegarlo en WhatsApp';
    }
    return null;
}

/**
 * Interpreta los parámetros del Web Share Target (HU-12).
 *
 * Función PURA (no lee `window`): recibe la cadena de query y devuelve si había
 * contenido compartido y cuál es el primer enlace válido. Es la que hace posible
 * probar AC-01/AC-02/AC-03 sin abrir WhatsApp.
 *
 * @param {string} search cadena de query (p. ej. `?text=...`)
 * @returns {{present: boolean, url: string|null, raw: string}}
 */
export function parseShareParams(search) {
    const params = new URLSearchParams(search || '');
    const raw = params.get('url') || params.get('text') || params.get('title') || '';

    if (!raw) return { present: false, url: null, raw: '' };

    return { present: true, url: extractFirstValidUrl(raw), raw };
}

/**
 * Consume el Web Share Target al abrir la app: lee los parámetros, limpia la
 * URL para no reprocesarlos y devuelve el enlace encontrado (si lo hay).
 *
 * @param {Window} [win] ventana (inyectable en tests)
 * @returns {{present: boolean, url: string|null, raw: string}}
 */
export function consumeSharedTarget(win = (typeof window !== 'undefined' ? window : undefined)) {
    if (!win) return { present: false, url: null, raw: '' };

    const payload = parseShareParams(win.location && win.location.search);

    if (payload.present) {
        try { win.history.replaceState({}, '', win.location.pathname); } catch { /* sin historial */ }
    }

    return payload;
}

/**
 * Comprueba si la app se abrió mediante Web Share Target y devuelve la URL
 * compartida (compatibilidad: solo el enlace, o null).
 * @returns {string|null}
 */
export function checkSharedUrl() {
    return consumeSharedTarget().url;
}

/**
 * Vibración háptica sutil
 */
export function hapticFeedback(pattern = 'light') {
    try {
        if (!navigator.vibrate) return;

        switch (pattern) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(30);
                break;
            case 'success':
                navigator.vibrate([15, 50, 15]);
                break;
            case 'danger':
                navigator.vibrate([50, 30, 50, 30, 100]);
                break;
            case 'warning':
                navigator.vibrate([30, 50, 30]);
                break;
        }
    } catch {
        // Silenciar en navegadores sin soporte
    }
}
