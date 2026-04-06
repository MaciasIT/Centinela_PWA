/**
 * Centinela — Cloudflare Worker Backend
 * Proxy seguro para VirusTotal API v3
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env, ctx) {
    // 1. Manejar el handshake CORS (peticiones OPTIONS de seguridad)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { 
          status: 405, 
          headers: CORS_HEADERS 
        });
      }

      const body = await request.json();
      const targetUrl = body.url;

      if (!targetUrl) {
        return new Response("Missing URL", { 
          status: 400, 
          headers: CORS_HEADERS 
        });
      }

      if (!env.VIRUSTOTAL_API_KEY) {
        return new Response("API KEY not configured", { 
          status: 500, 
          headers: CORS_HEADERS 
        });
      }

      // Convertir la URL a Base64URL sin el relleno (=) según pide VirusTotal v3
      const encodedUrl = btoa(targetUrl).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

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
            return new Response(JSON.stringify({ error: "No se pudo solicitar análisis nuevo" }), {
              status: scanResponse.status,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
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
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" } 
        });
      }

      const reportData = await vtResponse.json();

      // Devolver lo que responda, a la PWA con CORS añadido
      return new Response(JSON.stringify(reportData), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json"
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json"
        }
      });
    }
  }
};
