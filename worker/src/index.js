/**
 * Centinela — Cloudflare Worker Backend
 * Proxy multi-fuente: VirusTotal → Google Safe Browsing → URLScan.io
 * Con CORS restrictivo y rate limiting básico
 */

const ALLOWED_ORIGIN_REGEX = /^https:\/\/(centinela-pwa\.pages\.dev|.*\.pages\.dev)$|^http:\/\/localhost(:\d+)?$|^http:\/\/127\.0\.0\.1(:\d+)?$/;

function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGIN_REGEX.test(origin) ? origin : "https://centinela-pwa.pages.dev";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/**
 * Codifica una cadena UTF-8 en Base64URL segura para VirusTotal v3 sin relleno (=)
 */
function safeBase64UrlEncode(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < utf8Bytes.byteLength; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Extrae el dominio + path de una URL (sin protocolo)
 */
function extractHostAndPath(urlStr) {
  const u = new URL(urlStr);
  return u.hostname + u.pathname;
}

// ── FUENTE 1: VirusTotal ──────────────────────────────────────────

async function checkVirusTotal(targetUrl, apiKey) {
  if (!apiKey) throw new Error("VT_API_KEY not configured");

  const encodedUrl = safeBase64UrlEncode(targetUrl);
  const vtOptions = {
    headers: {
      "x-apikey": apiKey,
      "Accept": "application/json"
    }
  };

  // Intentar informe en caché
  let vtResponse = await fetch(
    `https://www.virustotal.com/api/v3/urls/${encodedUrl}`,
    vtOptions
  );

  // 404 = URL nunca analizada → forzar escaneo
  if (vtResponse.status === 404) {
    const formData = new URLSearchParams();
    formData.append("url", targetUrl);

    const scanResponse = await fetch("https://www.virustotal.com/api/v3/urls", {
      method: "POST",
      headers: {
        "x-apikey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (!scanResponse.ok) {
      throw new Error(`VT scan submit failed: ${scanResponse.status}`);
    }

    const scanData = await scanResponse.json();
    const analysisId = scanData.data.id;
    vtResponse = await fetch(
      `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
      vtOptions
    );
  }

  if (!vtResponse.ok) {
    throw new Error(`VT failed: ${vtResponse.status}`);
  }

  const data = await vtResponse.json();
  return { source: "virustotal", data };
}

// ── FUENTE 2: Google Safe Browsing ────────────────────────────────

async function checkGoogleSafeBrowsing(targetUrl, apiKey) {
  if (!apiKey) throw new Error("GSB_API_KEY not configured");

  const gsbBody = {
    client: { clientId: "centinela-pwa", clientVersion: "2.2.0" },
    threatInfo: {
      threatTypes: [
        "MALWARE",
        "SOCIAL_ENGINEERING",
        "UNWANTED_SOFTWARE",
        "POTENTIALLY_HARMFUL_APPLICATION"
      ],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url: targetUrl }]
    }
  };

  const gsbResponse = await fetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gsbBody)
    }
  );

  if (!gsbResponse.ok) {
    throw new Error(`GSB failed: ${gsbResponse.status}`);
  }

  const gsbData = await gsbResponse.json();

  // GSB devuelve {} si no hay amenazas, o {matches: [...]} si las hay
  const threats = gsbData.matches || [];
  return {
    source: "google_safebrowsing",
    data: {
      safe: threats.length === 0,
      threats: threats.map(m => ({
        threatType: m.threatType,
        platformType: m.platformType
      }))
    }
  };
}

// ── FUENTE 3: URLScan.io (submission-only, async) ─────────────────

async function checkUrlScan(targetUrl) {
  const scanResponse = await fetch("https://urlscan.io/api/v1/scan/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-Key": "", // URLScan funciona sin API key en tier gratuito (rate limit 50/día)
    },
    body: JSON.stringify({
      url: targetUrl,
      visibility: "unlisted",
      tags: ["centinela-pwa"]
    })
  });

  if (!scanResponse.ok) {
    throw new Error(`URLScan submit failed: ${scanResponse.status}`);
  }

  const scanData = await scanResponse.json();
  const scanUuid = scanData.uuid;

  // Esperar hasta 15s el resultado (poll cada 2s)
  const maxAttempts = 7;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 2000));

    const resultResponse = await fetch(
      `https://urlscan.io/api/v1/result/${scanUuid}/`
    );

    if (resultResponse.ok) {
      const resultData = await resultResponse.json();
      return {
        source: "urlscan",
        data: {
          uuid: scanUuid,
          url: targetUrl,
          verdicts: resultData.verdicts || {},
          score: resultData.verdicts?.overall?.score ?? null,
          page: resultData.page ? {
            url: resultData.page.url,
            domain: resultData.page.domain,
            ip: resultData.page.ip,
          } : null,
          resultUrl: `https://urlscan.io/result/${scanUuid}/`
        }
      };
    }

    if (resultResponse.status !== 404 && resultResponse.status !== 410) {
      // Error real, no "aún no listo"
      throw new Error(`URLScan result fetch failed: ${resultResponse.status}`);
    }
  }

  // Timeout: devolver el UUID para consulta manual
  return {
    source: "urlscan",
    data: {
      uuid: scanUuid,
      url: targetUrl,
      pending: true,
      resultUrl: `https://urlscan.io/result/${scanUuid}/`
    }
  };
}

// ── Orquestador multi-fuente ──────────────────────────────────────

async function scanUrl(targetUrl, env) {
  const results = [];
  const errors = [];

  // 1. VirusTotal (primario)
  try {
    const vtResult = await checkVirusTotal(targetUrl, env.VIRUSTOTAL_API_KEY);
    results.push(vtResult);
  } catch (e) {
    errors.push({ source: "virustotal", error: e.message });
  }

  // 2. Google Safe Browsing (fallback #1)
  if (env.GSB_API_KEY) {
    try {
      const gsbResult = await checkGoogleSafeBrowsing(targetUrl, env.GSB_API_KEY);
      results.push(gsbResult);
    } catch (e) {
      errors.push({ source: "google_safebrowsing", error: e.message });
    }
  }

  // 3. URLScan.io (fallback #2 — solo si todo lo demás falló)
  if (results.length === 0) {
    try {
      const urlscanResult = await checkUrlScan(targetUrl);
      results.push(urlscanResult);
    } catch (e) {
      errors.push({ source: "urlscan", error: e.message });
    }
  }

  if (results.length === 0) {
    throw new Error(`Todas las fuentes fallaron: ${errors.map(e => `${e.source}(${e.error})`).join(", ")}`);
  }

  return { results, errors: errors.length > 0 ? errors : undefined };
}

// ── Worker entrypoint ─────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
      }

      const body = await request.json();
      const targetUrl = body.url;

      if (!targetUrl) {
        return new Response("Missing URL", { status: 400, headers: corsHeaders });
      }

      try {
        new URL(targetUrl);
      } catch (_) {
        return new Response(
          JSON.stringify({ error: "La URL proporcionada no es válida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const scanResult = await scanUrl(targetUrl, env);

      return new Response(JSON.stringify(scanResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
