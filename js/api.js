/**
 * Centinela — API Client v2
 * Cliente de UNA sola fuente de veredicto: VirusTotal (decisión 1A).
 * Google Safe Browsing y URLScan.io se han retirado por completo.
 * + Reputación local instantánea
 */

const API_URL = 'https://centinela-api.michelmacias-it.workers.dev';

export async function checkLocalReputation(url) {
  try {
    const res = await fetch(`${API_URL}/api/local-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Analiza una URL consultando el Worker (una sola fuente: VirusTotal)
 * @param {string} url - URL a analizar
 * @returns {Promise<object>}
 */
export async function analyzeUrl(url) {
    const normalizedUrl = normalizeUrl(url);

    // Veredicto local instantáneo
    const local = await checkLocalReputation(normalizedUrl);

    // Intentar caché local primero (1h)
    const cached = getLocalCache(normalizedUrl);
    if (cached) {
        return { ...cached, fromCache: true, local };
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
            throw await buildErrorMessage(response);
        }

        let payload = await response.json();

        // ── Formato multi-fuente (v2) ──
        if (payload.results && Array.isArray(payload.results)) {
            const result = normalizeMultiSource(normalizedUrl, payload);
            if (hasUsableData(result)) {
                setLocalCache(normalizedUrl, result);
            }
            return result;
        }

        // ── Formato legacy (VT directo, v1) ──
        // Sin reintentos automáticos en segundo plano (HU-09): si el informe
        // aún no está listo, se devuelve tal cual (total 0 → precaución) y la
        // pantalla de carga ofrece un reintento MANUAL a los 8 s.
        const result = normalizeLegacyVT(normalizedUrl, payload);
        if (hasUsableData(result)) {
            setLocalCache(normalizedUrl, result);
        }
        return result;

    } catch (err) {
        clearTimeout(timeout);

        // Mensaje ya traducido por el Worker: se propaga tal cual (HU-24).
        if (err && err.userFacing) throw err;

        if (err.name === 'AbortError') {
            throw new Error('La comprobación tardó demasiado. Inténtalo de nuevo.');
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
 * Traduce la respuesta de error del Worker a un mensaje llano (HU-24).
 * Nunca expone el código interno ni el detalle del proveedor.
 * @param {Response} response
 * @returns {Promise<Error>}
 */
async function buildErrorMessage(response) {
    let code = null;
    try {
        const body = await response.json();
        code = body && body.error && body.error.code ? body.error.code : null;
    } catch {
        code = null;
    }

    const userFacing = (message) => {
        const err = new Error(message);
        // El mensaje ya está en lenguaje llano y viene del servidor: no debe
        // volver a envolverse ni sustituirse por el mensaje genérico de abajo.
        err.userFacing = true;
        return err;
    };

    if (code === 'QUOTA_EXCEEDED' || response.status === 503) {
        return userFacing('Ahora mismo no se ha podido comprobar este enlace: el servicio está muy solicitado. Inténtalo dentro de un minuto.');
    }
    if (code === 'RATE_LIMITED' || response.status === 429) {
        return userFacing('Has hecho demasiadas comprobaciones. Espera un minuto e inténtalo de nuevo.');
    }
    if (code === 'FORBIDDEN_ORIGIN' || response.status === 403) {
        return userFacing('La aplicación no tiene permiso para comprobar enlaces desde este sitio.');
    }
    if (response.status >= 500) {
        return userFacing('El servicio no está disponible ahora. Inténtalo en un momento.');
    }
    return userFacing('No se ha podido comprobar el enlace. Inténtalo de nuevo.');
}

/**
 * Normaliza la respuesta del Worker (una sola fuente: VirusTotal) al formato
 * que espera la UI. Cualquier fuente que no sea VirusTotal se ignora: el Worker
 * ya no tiene ramas multi-fuente (decisión 1A).
 */
function normalizeMultiSource(url, payload) {
    const vtResult = payload.results.find(r => r.source === 'virustotal');

    const result = { url, fromCache: false, sources: [] };

    if (vtResult) {
        const attr = vtResult.data.data?.attributes || {};
        const stats = attr.last_analysis_stats || attr.stats || {};
        Object.assign(result, {
            positives: stats.malicious || 0,
            suspicious: stats.suspicious || 0,
            harmless: stats.harmless || 0,
            undetected: stats.undetected || 0,
            timeout: stats.timeout || 0,
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
    const timeout = stats.timeout || 0;
    const calcTotal = malicious + suspicious + harmless + undetected + timeout;

    return {
        positives: malicious,
        total: calcTotal,
        suspicious,
        harmless,
        undetected,
        timeout,
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

// ── Utilidades ────────────────────────────────────────────────────

/**
 * ¿El resultado tiene datos utilizables? (T2c)
 * `total > 0` NO basta: un informe 100 % timeout tiene `total > 0` pero ninguna
 * detección real. Ese resultado NO se cachea, para que «volver a intentarlo»
 * vuelva a consultar la fuente en vez de devolver un «no comprobado» viejo.
 */
function hasUsableData(result) {
    const real = (result.positives || 0) + (result.suspicious || 0) + (result.harmless || 0) + (result.undetected || 0);
    return (result.total || 0) > 0 && real > 0;
}

export function normalizeUrl(url) {
    let trimmed = url.trim();
    if (!trimmed.match(/^https?:\/\//i)) {
        trimmed = `https://${trimmed}`;
    }
    return trimmed;
}

export function validateUrl(text) {
    if (!text || text.trim().length === 0) {
        return { valid: false, url: '', reason: 'Pega primero un enlace.' };
    }

    let url = text.trim();
    if (!url.match(/^https?:\/\//i)) {
        url = `https://${url}`;
    }

    try {
        const parsed = new URL(url);

        const localPatterns = ['127.0.0.1', 'localhost', '0.0.0.0', '192.168.', '10.', '172.'];
        if (localPatterns.some(p => parsed.hostname.startsWith(p))) {
            return { valid: false, url, reason: 'Esa dirección es de tu propio ordenador o de tu casa; no hace falta comprobarla.' };
        }

        if (!parsed.hostname || !parsed.hostname.includes('.')) {
            return { valid: false, url, reason: 'Esto no parece un enlace web. Por ejemplo: www.tu-banco.es' };
        }

        return { valid: true, url: parsed.href, reason: '' };
    } catch {
        return { valid: false, url, reason: 'Esto no parece un enlace web. Por ejemplo: www.tu-banco.es' };
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