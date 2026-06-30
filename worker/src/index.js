/**
 * Centinela — Cloudflare Worker Backend
 * Proxy seguro para VirusTotal API v3 con CORS restrictivo
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
 * Evita fallos con caracteres especiales, emojis o dominios internacionales (IDN)
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

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request);

    // 1. Manejar el handshake CORS (peticiones OPTIONS de seguridad)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { 
          status: 405, 
          headers: corsHeaders 
        });
      }

      const body = await request.json();
      const targetUrl = body.url;

      if (!targetUrl) {
        return new Response("Missing URL", { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      // Validar formato de URL básico
      try {
        new URL(targetUrl);
      } catch (_) {
        return new Response(JSON.stringify({ error: "La URL proporcionada no es válida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!env.VIRUSTOTAL_API_KEY) {
        return new Response("API KEY not configured", { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      // Codificación segura Base64URL para UTF-8 / Emojis / IDN
      const encodedUrl = safeBase64UrlEncode(targetUrl);

      // 2. Intentar sacar el informe "en caché" (último análisis de VT)
      const vtGetUrl = `https://www.virustotal.com/api/v3/urls/${encodedUrl}`;
      const vtOptions = {
        method: "GET",
        headers: {
          "x-apikey": env.VIRUSTOTAL_API_KEY,
          "Accept": "application/json"
        }
      };

      let vtResponse = await fetch(vtGetUrl, vtOptions);
      
      // Si recibimos un 404 de VirusTotal, significa que esta URL NUNCA se ha analizado.
      // Así que tenemos que forzar un análisis nuevo haciendo un POST.
      if (vtResponse.status === 404) {
        const formData = new URLSearchParams();
        formData.append("url", targetUrl);

        const scanResponse = await fetch("https://www.virustotal.com/api/v3/urls", {
          method: "POST",
          headers: {
            "x-apikey": env.VIRUSTOTAL_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        });

        if (!scanResponse.ok) {
            return new Response(JSON.stringify({ error: "No se pudo solicitar análisis nuevo en VirusTotal" }), {
              status: scanResponse.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
        
        // VirusTotal nos devuelve un 'id' de análisis, tenemos que consultarlo para ver resultados
        const scanData = await scanResponse.json();
        const analysisId = scanData.data.id;
        
        // Obtenemos los resultados preliminares
        vtResponse = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, vtOptions);
      }

      if (!vtResponse.ok) {
        return new Response(await vtResponse.text(), { 
          status: vtResponse.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const reportData = await vtResponse.json();

      // Devolver resultados a la PWA con cabeceras CORS dinámicas y seguras
      return new Response(JSON.stringify(reportData), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  }
};
