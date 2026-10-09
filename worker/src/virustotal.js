/**
 * Centinela — Fuente ÚNICA de veredicto: VirusTotal (decisión 1A de Michel).
 *
 * Google Safe Browsing y URLScan.io se han retirado por completo del Worker:
 * eran ramas que en producción NUNCA corrían (la clave de GSB no está
 * configurada), así que la app "funcionaba por accidente". Aquí queda una sola
 * fuente declarada y explícita.
 */

export const VT_BASE = 'https://www.virustotal.com/api/v3';

/** Timeout de subpetición hacia VirusTotal (arquitectura §5.2). */
export const VT_TIMEOUT_MS = 8000;

export const SOURCE = 'virustotal';

/**
 * Error de la fuente externa con un código del contrato (§5.2, principio 4).
 * El mensaje NUNCA se devuelve al cliente tal cual.
 */
export class UpstreamError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'UpstreamError';
    this.code = code;
  }
}

/**
 * Codifica una cadena UTF-8 en Base64URL sin relleno, como exige VirusTotal v3.
 */
function safeBase64UrlEncode(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.byteLength; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function timeoutSignal() {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(VT_TIMEOUT_MS)
    : undefined;
}

/**
 * Consulta VirusTotal para una URL.
 *
 * Coste en cuota (RT-7): 1 llamada si VT ya tiene el informe; hasta 3 si la URL
 * es nueva (`GET /urls/{id}` → 404 → `POST /urls` → `GET /analyses/{id}`).
 *
 * @param {string} targetUrl URL ya normalizada
 * @param {string} apiKey
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{source: string, data: object}>}
 */
export async function checkVirusTotal(targetUrl, apiKey, fetchImpl) {
  const doFetch = fetchImpl || globalThis.fetch;

  if (!apiKey) {
    throw new UpstreamError('UPSTREAM_UNAVAILABLE', 'VirusTotal no está configurado');
  }

  const encodedUrl = safeBase64UrlEncode(targetUrl);
  const reportOptions = {
    headers: { 'x-apikey': apiKey, Accept: 'application/json' },
    signal: timeoutSignal(),
  };

  try {
    let response = await doFetch(`${VT_BASE}/urls/${encodedUrl}`, reportOptions);

    if (response.status === 429) {
      throw new UpstreamError('QUOTA_EXCEEDED', 'VirusTotal ha limitado las peticiones');
    }

    // 404 = URL nunca analizada por VT → forzar el escaneo.
    if (response.status === 404) {
      const formData = new URLSearchParams();
      formData.append('url', targetUrl);

      const scanResponse = await doFetch(`${VT_BASE}/urls`, {
        method: 'POST',
        headers: { 'x-apikey': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        signal: timeoutSignal(),
      });

      if (scanResponse.status === 429) {
        throw new UpstreamError('QUOTA_EXCEEDED', 'VirusTotal ha limitado las peticiones');
      }
      if (!scanResponse.ok) {
        throw new UpstreamError('UPSTREAM_UNAVAILABLE', `VT scan submit ${scanResponse.status}`);
      }

      const scanData = await scanResponse.json();
      response = await doFetch(`${VT_BASE}/analyses/${scanData.data.id}`, reportOptions);
    }

    if (response.status === 429) {
      throw new UpstreamError('QUOTA_EXCEEDED', 'VirusTotal ha limitado las peticiones');
    }
    if (!response.ok) {
      throw new UpstreamError('UPSTREAM_UNAVAILABLE', `VT ${response.status}`);
    }

    const data = await response.json();
    return { source: SOURCE, data };
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    // Timeout, DNS, socket roto…: se degrada con un código honesto, sin filtrar detalle.
    throw new UpstreamError('UPSTREAM_UNAVAILABLE', `VT inalcanzable: ${err && err.message}`);
  }
}
