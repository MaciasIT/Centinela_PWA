/**
 * Centinela — Historial de Comprobaciones
 * Gestión del historial en localStorage
 */

const STORAGE_KEY = 'centinela_history';
const MAX_ITEMS = 30;

/**
 * Lee el historial desde localStorage
 * @returns {Array}
 */
export function getHistory() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.warn('Error leyendo historial:', e);
        return [];
    }
}

/**
 * Guarda una entrada en el historial
 * @param {string} url
 * @param {object} result - Resultado del análisis { positives, total, status }
 */
export function addToHistory(url, result) {
    try {
        const history = getHistory();
        const entry = {
            id: Date.now(),
            url: url,
            status: result.positives > 3 ? 'danger' : result.positives > 0 ? 'warning' : 'safe',
            positives: result.positives,
            total: result.total,
            date: new Date().toISOString(),
        };

        // Evitar duplicados recientes (mismo URL en los últimos 5 min)
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        const isDuplicate = history.some(
            h => h.url === url && new Date(h.date).getTime() > fiveMinAgo
        );

        if (!isDuplicate) {
            history.unshift(entry);
            if (history.length > MAX_ITEMS) {
                history.length = MAX_ITEMS;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        }

        return entry;
    } catch (e) {
        console.warn('Error guardando historial:', e);
        return null;
    }
}

/**
 * Borra todo el historial
 */
export function clearHistory() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn('Error borrando historial:', e);
    }
}

/**
 * Formatea una fecha ISO a texto legible
 * @param {string} isoDate
 * @returns {string}
 */
export function formatDate(isoDate) {
    try {
        const date = new Date(isoDate);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Ahora mismo';
        if (diffMin < 60) return `Hace ${diffMin} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;

        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
        });
    } catch {
        return '';
    }
}

/**
 * Extrae el dominio de una URL para mostrar
 * @param {string} url
 * @returns {string}
 */
export function extractDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        return url.substring(0, 40);
    }
}
