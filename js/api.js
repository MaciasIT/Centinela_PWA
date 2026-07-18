/**
 * Centinela — API Client v2
 * Cliente multi-fuente: VirusTotal + Google Safe Browsing + URLScan.io
 */

const API_URL = 'https://centinela-api.michelmacias-it.workers.dev';

/**
 * Analiza una URL usando el backend multi-fuente
 * @param {string} url - URL a analizar
 * @returns {Promise<object>}
 */
export async function analyzeUrl(url) {
    const normalizedUrl = normalizeUrl(url);

    // Intentar caché local primero (1h)
    const cached = getLocalCache(normalizedUrl);
    if (cached) {
        return { ...cached, fromCache: true };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        let response = await fetch(`${API_URL}/api/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

        let payload = await response.json();

        // ── Formato multi-fuente (v2) ──
        if (payload.results && Array.isArray(payload.results)) {
            const result = normalizeMultiSource(normalizedUrl, payload);
            if (result.total > 0) {
                setLocalCache(normalizedUrl, result);
            }
            return result;
        }

        // ── Formato legacy (VT directo, v1) ──
        let data = payload;
        let retries = 6;
        while (retries > 0 && isQueuedOrEmpty(data)) {
            await new Promise(resolve => setTimeout(resolve, 3000));
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

        const result = normalizeLegacyVT(normalizedUrl, data);
        if (result.total > 0) {
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
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            throw new Error('Conexión denegada por CORS o el servidor Cloudflare está caído.');
        }
        throw new Error(`Algo falló con el Worker: ${err.message}`);
    }
}

// ── Normalizadores ────────────────────────────────────────────────

/**
 * Normaliza respuesta multi-fuente (worker v2) al formato que espera la UI
 */
function normalizeMultiSource(url, payload) {
    const vtResult = payload.results.find(r => r.source === 'virustotal');
    const gsbResult = payload.results.find(r => r.source === 'google_safebrowsing');
    const urlscanResult = payload.results.find(r => r.source === 'urlscan');

    const result = { url, fromCache: false, sources: [] };

    if (vtResult) {
        const attr = vtResult.data.data?.attributes || {};
        const stats = attr.last_analysis_stats || attr.stats || {};
        Object.assign(result, {
            positives: stats.malicious || 0,
            suspicious: stats.suspicious || 0,
            harmless: stats.harmless || 0,
            undetected: stats.undetected || 0,
            total: (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0) + (stats.timeout || 0),
            scanDate: attr.last_analysis_date || Date.now() / 1000,
            engines: extractEngines(vtResult.data),
            permalink: vtResult.data.data?.links?.self ? 
                `https://www.virustotal.com/gui/url/${vtResult.data.data.id}/detection` : null,
            finalUrl: attr.last_final_url || null,
            title: attr.title || null,
            vtId: vtResult.data.data?.id || null,
        });
        result.sources.push('virustotal');
    }

    if (gsbResult) {
        result.gsbSafe = gsbResult.data.safe;
        result.gsbThreats = gsbResult.data.threats;
        result.sources.push('google_safebrowsing');
    }

    if (urlscanResult) {
        result.urlscanUuid = urlscanResult.data.uuid;
        result.urlscanPending = urlscanResult.data.pending || false;
        result.urlscanResultUrl = urlscanResult.data.resultUrl;
        result.sources.push('urlscan');
    }

    // Conservar errores para depuración
    if (payload.errors && payload.errors.length > 0) {
        result.sourceErrors = payload.errors;
    }

    return result;
}

/**
 * Normaliza respuesta legacy de VT directo (worker v1)
 */
function normalizeLegacyVT(url, data) {
    const attr = data.data?.attributes || {};
    const stats = attr.last_analysis_stats || attr.stats || {};

    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const harmless = stats.harmless || 0;
    const undetected = stats.undetected || 0;
    const calcTotal = malicious + suspicious + harmless + undetected + (stats.timeout || 0);

    return {
        positives: malicious,
        total: calcTotal,
        suspicious,
        harmless,
        undetected,
        scanDate: attr.last_analysis_date || Date.now() / 1000,
        engines: extractEngines(data),
        permalink: data.data?.links?.self ?
            `https://www.virustotal.com/gui/url/${data.data.id}/detection` : null,
        url,
        finalUrl: attr.last_final_url || null,
        title: attr.title || null,
        fromCache: false,
        sources: ['virustotal'],
    };
}

function isQueuedOrEmpty(data) {
    if (!data || !data.data) return false;
    const attr = data.data.attributes || {};
    const stats = attr.last_analysis_stats || attr.stats || {};
    const total = (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0) + (stats.timeout || 0);
    return attr.status === 'queued' || attr.status === 'in-progress' || total === 0;
}

// ── Utilidades ────────────────────────────────────────────────────

function normalizeUrl(url) {
    let trimmed = url.trim();
    if (!trimmed.match(/^https?:\/\//i)) {
        trimmed = `https://${trimmed}`;
    }
    return trimmed;
}

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

        if (!parsed.hostname || !parsed.hostname.includes('.')) {
            return { valid: false, url, reason: 'Eso no parece un enlace web válido.' };
        }

        const localPatterns = ['127.0.0.1', 'localhost', '0.0.0.0', '192.168.', '10.', '172.'];
        if (localPatterns.some(p => parsed.hostname.startsWith(p))) {
            return { valid: false, url, reason: 'Esa es una dirección de red local, no una web.' };
        }

        return { valid: true, url: parsed.href, reason: '' };
    } catch {
        return { valid: false, url, reason: 'Eso no parece un enlace web válido.' };
    }
}

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

// ── Caché local ───────────────────────────────────────────────────

const CACHE_KEY = 'centinela_cache';
const CACHE_TTL = 60 * 60 * 1000;

function getLocalCache(url) {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const entry = cache[url];
        if (entry && (Date.now() - entry.timestamp < CACHE_TTL)) {
            return entry.data;
        }
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

        const keys = Object.keys(cache);
        if (keys.length > 50) {
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