/**
 * Centinela — API Client
 * Comunicación con el Cloudflare Worker proxy de VirusTotal
 */

// URL del Worker de Cloudflare (tu endpoint existente)
const API_URL = 'https://centinela-api.michelmacias-it.workers.dev';

/**
 * Analiza una URL usando el backend de VirusTotal
 * @param {string} url - URL a analizar
 * @returns {Promise<{positives: number, total: number, scanDate: string, engines: object, permalink: string}>}
 */
export async function analyzeUrl(url) {
    const normalizedUrl = normalizeUrl(url);

    // Intentar caché local primero (1h)
    const cached = getLocalCache(normalizedUrl);
    if (cached) {
        return { ...cached, fromCache: true };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
        let response = await fetch(`${API_URL}/api/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: normalizedUrl }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Has hecho demasiadas comprobaciones. Espera un minuto e inténtalo de nuevo.');
            }
            if (response.status >= 500) {
                throw new Error('El servicio no está disponible ahora. Inténtalo en un momento.');
            }
            throw new Error(`Error del servidor (${response.status})`);
        }

        let data = await response.json();

        // Función auxiliar para extraer stats
        const getStatsSum = (d) => {
            const attr = d.data?.attributes || {};
            const s = attr.last_analysis_stats || attr.stats || {};
            return (s.malicious || 0) + (s.suspicious || 0) + (s.harmless || 0) + (s.undetected || 0) + (s.timeout || 0);
        };

        // Si la URL es nueva, VT la pone 'en cola' (queued) y devuelve 0 en todo. 
        // Hacemos polling (reintentos) esperando a que acabe el informe.
        let retries = 6; // Hasta ~18 segundos de espera
        while (retries > 0 && (data.data?.attributes?.status === 'queued' || data.data?.attributes?.status === 'in-progress' || getStatsSum(data) === 0)) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar 3 seg
            
            const retryResponse = await fetch(`${API_URL}/api/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: normalizedUrl })
            });
            
            if (retryResponse.ok) {
                data = await retryResponse.json();
            }
            retries--;
        }

        // Recuperar los datos finales
        const vtAttributes = data.data?.attributes || {};
        const stats = vtAttributes.last_analysis_stats || vtAttributes.stats || {};
        
        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;
        const harmless = stats.harmless || 0;
        const undetected = stats.undetected || 0;
        const scanTimeout = stats.timeout || 0;
        
        const calcTotal = malicious + suspicious + harmless + undetected + scanTimeout;

        // Normalizar la respuesta para nuestro formato
        const result = {
            positives: data.positives ?? malicious,
            total: data.total ?? (calcTotal > 0 ? calcTotal : 0),
            suspicious: suspicious,
            harmless: harmless,
            undetected: undetected,
            scanDate: data.scan_date ?? vtAttributes.last_analysis_date ?? Date.now()/1000,
            engines: data.engines ?? extractEngines(data),
            permalink: data.permalink ?? null,
            url: normalizedUrl,
            fromCache: false,
        };

        // Guardar en caché local solo si el resultado no está vacío (previene cachear fallos temporales)
        if (calcTotal > 0) {
            setLocalCache(normalizedUrl, result);
        }

        return result;
    } catch (err) {
        clearTimeout(timeout);

        console.error("Detalle técnico del error:", err);

        if (err.name === 'AbortError') {
            throw new Error('La comprobación tardó demasiado. Inténtalo de nuevo.');
        }

        if (!navigator.onLine) {
            throw new Error('No tienes conexión a Internet. Conéctate y vuelve a intentarlo.');
        }

        // Error más detallado si es TypeError (CORS / Servidor caído)
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            throw new Error(`Conexión denegada por CORS o el servidor Cloudflare está caído. Verifica tu Worker.`);
        }

        throw new Error(`Algo falló con el Worker: ${err.message}`);
    }
}

/**
 * Normaliza una URL añadiendo protocolo si falta
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
    let trimmed = url.trim();
    if (!trimmed.match(/^https?:\/\//i)) {
        trimmed = `https://${trimmed}`;
    }
    return trimmed;
}

/**
 * Valida si una cadena es una URL válida
 * @param {string} text
 * @returns {{valid: boolean, url: string, reason: string}}
 */
export function validateUrl(text) {
    if (!text || text.trim().length === 0) {
        return { valid: false, url: '', reason: 'empty' };
    }

    let url = text.trim();
    if (!url.match(/^https?:\/\//i)) {
        url = `https://${url}`;
    }

    try {
        const parsed = new URL(url);

        // Verificar que tiene un dominio válido
        if (!parsed.hostname || !parsed.hostname.includes('.')) {
            return { valid: false, url, reason: 'Eso no parece un enlace web válido.' };
        }

        // Verificar que no es una IP local
        const localPatterns = ['127.0.0.1', 'localhost', '0.0.0.0', '192.168.', '10.', '172.'];
        if (localPatterns.some(p => parsed.hostname.startsWith(p))) {
            return { valid: false, url, reason: 'Esa es una dirección de red local, no una web.' };
        }

        return { valid: true, url: parsed.href, reason: '' };
    } catch {
        return { valid: false, url, reason: 'Eso no parece un enlace web válido.' };
    }
}

/**
 * Extrae los engines que reportaron como malicioso
 * @param {object} data - Respuesta cruda de VT
 * @returns {object}
 */
function extractEngines(data) {
    const results = data.data?.attributes?.last_analysis_results;
    if (!results) return {};

    const engines = {};
    for (const [name, info] of Object.entries(results)) {
        if (info.category === 'malicious' || info.category === 'suspicious') {
            engines[name] = {
                category: info.category,
                result: info.result || info.category,
            };
        }
    }
    return engines;
}

/* ---- Caché local (localStorage, 1 hora) ---- */

const CACHE_KEY = 'centinela_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

function getLocalCache(url) {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const entry = cache[url];
        if (entry && (Date.now() - entry.timestamp < CACHE_TTL)) {
            return entry.data;
        }
        // Limpiar entrada expirada
        if (entry) {
            delete cache[url];
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        }
        return null;
    } catch {
        return null;
    }
}

function setLocalCache(url, data) {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cache[url] = { data, timestamp: Date.now() };

        // Limitar tamaño del cache
        const keys = Object.keys(cache);
        if (keys.length > 50) {
            // Eliminar las más antiguas
            keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
            for (let i = 0; i < keys.length - 50; i++) {
                delete cache[keys[i]];
            }
        }

        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
        // Silenciar errores de storage
    }
}
