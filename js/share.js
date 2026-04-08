/**
 * Centinela — Share Module
 * Compartir resultados y recibir enlaces compartidos (Web Share Target)
 */

/**
 * Comparte el resultado del análisis vía Web Share API o portapapeles
 * @param {string} url - URL analizada
 * @param {object} result - Resultado del análisis
 */
export async function shareResult(url, result) {
    const isSafe = result.positives === 0;
    const isDanger = result.positives > 3;
    const isWarning = result.positives > 0 && result.positives <= 3;

    let emoji, statusText;
    if (isSafe) {
        emoji = '✅';
        statusText = 'SEGURO';
    } else if (isDanger) {
        emoji = '🚨';
        statusText = 'PELIGROSO';
    } else {
        emoji = '⚠️';
        statusText = 'SOSPECHOSO';
    }

    const shareText = `${emoji} He comprobado este enlace con Centinela y es ${statusText}:\n\n${url}\n\n${result.positives}/${result.total} motores de seguridad lo han marcado como peligroso.\n\n🛡️ Comprueba tus enlaces en: centinela-pwa.pages.dev`;

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
 * Comprueba si la app se abrió mediante Web Share Target (compartir desde otra app)
 * @returns {string|null} - URL compartida o null
 */
export function checkSharedUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const sharedUrl = params.get('url') || params.get('text') || params.get('title') || null;

        if (sharedUrl) {
            // Limpiar los params de la URL para no procesarlos de nuevo
            window.history.replaceState({}, '', window.location.pathname);

            // Extraer URL del texto compartido (puede venir con texto alrededor)
            const urlMatch = sharedUrl.match(/https?:\/\/[^\s]+/);
            return urlMatch ? urlMatch[0] : sharedUrl.trim();
        }

        return null;
    } catch {
        return null;
    }
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
