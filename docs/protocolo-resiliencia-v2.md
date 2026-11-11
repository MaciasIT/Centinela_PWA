# Protocolo de resiliencia v2

**Proyecto:** Centinela PWA<br>
**Versión documentada:** `2.3.0` (fuente: `package.json`)<br>
**Ámbito:** cliente PWA, Service Worker y Cloudflare Worker<br>
**Última certificación:** 2026-11-11

## 1. Objetivo y límites

Este documento describe el comportamiento verificable del sistema cuando la red, el
servicio de análisis o sus límites de cuota no están disponibles. La resiliencia no
convierte una evaluación local en un análisis antivirus: cuando no hay respuesta de
VirusTotal, el usuario debe recibir una indicación de precaución y nunca un veredicto
falso de seguridad.

Fuentes de implementación consultadas:

- `js/core/reputation-offline.js`: motor heurístico síncrono, sin red.
- `js/api.js`: orquestación de reputación local, caché del navegador y `/api/scan`.
- `sw.js`: precaché de recursos estáticos de la PWA y estrategia de red para navegación.
- `worker/src/index.js`: endpoints, validación, Cloudflare KV, cuota, rate limiting y
  traducción de errores.
- `worker/src/quota-guard.js`: contador exacto de cuota.
- `tests/runner.js` y `tests/**/*.test.js`: suite determinista de 275 tests.

## 2. Modo offline y motor heurístico local

### 2.1 Disponibilidad

`evaluateOfflineReputation(rawUrl)` se ejecuta en el cliente antes de cualquier
llamada de red. Si la URL no se puede parsear, devuelve `danger` con la razón
`URL con sintaxis inválida`. Para una URL válida, parte de una puntuación de `85`,
la limita al intervalo `[0, 100]` y clasifica así:

- `safe`: puntuación `>= 75`.
- `warning`: puntuación `>= 50` y `< 75`.
- `danger`: puntuación `< 50`.

El resultado siempre incluye `isOfflineAnalysis: true` y una lista de razones.

### 2.2 Señales locales

El motor aplica las siguientes penalizaciones, acumulables:

| Señal | Penalización |
| --- | ---: |
| Credenciales incrustadas (`usuario:contraseña@host`) | -40 |
| Host como dirección IP literal | -30 |
| TLD de alto riesgo (`.tk`, `.ml`, `.xyz`, `.top`, `.click`, `.zip`, `.mov`, entre otros) | -25 |
| Punycode u homógrafo (`xn--`) | -30 |
| Más de cuatro partes de hostname, por subdominios anidados | -20 |
| Entropía de Shannon `> 4.2` con nombre de más de 10 caracteres | -20 |
| Nombre de dominio de más de 35 caracteres | -10 |

La puntuación se satura en cero y cien. Las señales son indicios preventivos; no
prueban por sí mismas que un sitio sea legítimo o malicioso.

### 2.3 Degradación del endpoint local

`checkLocalReputation(url)` calcula primero la heurística y después intenta
`POST /api/local-check`. Si el endpoint responde con un estado no OK o la llamada
falla, devuelve el resultado local calculado previamente. Por tanto, un `429` en
`/api/local-check`, un corte de red o la caída del Worker local no eliminan esta
señal de precaución.

El endpoint remoto local es una mejora opcional: aplica RDAP para la edad del dominio
cuando está disponible, pero no sustituye al motor local. El Worker no consume la
cuota de VirusTotal para `/api/local-check`.

### 2.4 Service Worker

`sw.js` mantiene disponible el shell estático de la PWA mediante precaché. Para
navegaciones usa `NetworkFirst` con caché de respaldo y para recursos estáticos usa
`StaleWhileRevalidate`. Esto permite abrir la interfaz previamente visitada sin red,
pero no fabrica respuestas de `/api/scan` ni sustituye el análisis de VirusTotal.

> **Límite importante:** el motor heurístico local sí está disponible sin conexión.
> El flujo completo de `analyzeUrl()` calcula esa reputación, pero actualmente sigue
> intentando `/api/scan`; si la petición falla con `navigator.onLine === false`,
> devuelve el mensaje de conexión y la UI vuelve a la pantalla principal. La
> evaluación local no debe presentarse como análisis cloud completado. Si el producto
> requiere mostrar el resultado local en la pantalla de resultado sin red, ese cambio
> debe implementarse y cubrirse con una prueba antes de modificar este contrato.

## 3. Orden de decisión en el cliente

Para `analyzeUrl(url)` el orden es determinista:

1. Normaliza la URL canónica.
2. Ejecuta `checkLocalReputation()` y conserva `local` como contexto preventivo.
3. Consulta `localStorage` mediante la caché local del cliente; una entrada válida se
   devuelve con `fromCache: true` sin llamar al Worker de análisis.
4. Si no hay caché, llama a `POST /api/scan` con un timeout de 30 segundos.
5. Guarda en caché solo resultados utilizables: debe existir al menos una señal real
   entre `malicious`, `suspicious`, `harmless` o `undetected`; un resultado compuesto
   únicamente por timeouts no se reutiliza.

La clasificación final se realiza con `js/core/verdict.js`. `total === 0` es
`warning` y un resultado con todos los motores en timeout es `unchecked`; ninguno se
interpreta como `safe`.

## 4. Worker: caché compartida y límites

Antes de consumir cuota, `POST /api/scan` valida el tipo de contenido, el tamaño del
cuerpo, el JSON, la URL y el origen CORS. Después normaliza la URL y consulta
Cloudflare KV (`CENTINELA_CACHE`) con la clave `vt:url:<sha256(url)>`.

- **KV hit:** responde `200` con `cached: true`, `CF-Cache-Status: HIT` y
  `Cache-Control: public, max-age=86400`. No solicita un token de cuota.
- **KV miss:** continúa hacia el contador de cuota y VirusTotal.
- **Escritura:** un resultado de VirusTotal se guarda con `expirationTtl: 86400`.
  Un fallo de KV es fail-open: no rompe la respuesta del análisis.

El rate limiting tiene dos capas independientes:

1. `SCAN_RATE_LIMITER`, cuando está configurado, frena inundaciones por IP a
   `30;w=60`.
2. El Durable Object `QuotaGuard` impone exactamente `4` solicitudes por minuto y
   `500` por día de forma agregada para la cuota de VirusTotal. El binding ausente
   deja pasar la petición (`enforced: false`), mientras que el gate de bindings debe
   detectar la configuración incorrecta antes del despliegue.

## 5. Estrategia ante HTTP 429 y agotamiento de cuota

### 5.1 HTTP 429 del Cloudflare Worker

El Worker devuelve `429` con `error.code: "RATE_LIMITED"` cuando falla el freno por
IP, tanto en `/api/scan` como en `/api/local-check`. La respuesta incluye:

- `RateLimit-Limit: 30`.
- `RateLimit-Remaining: 0`.
- `RateLimit-Reset: 60`.
- `Retry-After: 60`.
- `RateLimit-Policy: 30;w=60`.

El cliente no expone `429`, `RATE_LIMITED`, Cloudflare ni detalles del proveedor.
`buildErrorMessage()` traduce el estado a:

> Has hecho demasiadas comprobaciones. Espera un minuto e inténtalo de nuevo.

La reputación local ya calculada se conserva como respaldo cuando el `429` afecta a
`/api/local-check`. Si el `429` afecta al análisis `/api/scan`, el intento termina
con el mensaje anterior y se ofrece reintentar manualmente; no se simula un resultado
AV ni se cachea un resultado inexistente.

### 5.2 Agotamiento del contador global o de VirusTotal

El agotamiento de `QuotaGuard` no es un `429` de IP: el Worker responde `503` con
`error.code: "QUOTA_EXCEEDED"`. Incluye las cabeceras `RateLimit-*` del contador y
`Retry-After` con el tiempo de espera calculado (por defecto, 60 segundos). Si
VirusTotal comunica agotamiento, el Worker aplica el mismo contrato `503` sin filtrar
el mensaje del proveedor.

El cliente traduce `503`/`QUOTA_EXCEEDED` a:

> Ahora mismo no se ha podido comprobar este enlace: el servicio está muy solicitado. Inténtalo dentro de un minuto.

Los fallos upstream distintos de cuota se traducen a `502` en el Worker y a un
mensaje genérico de indisponibilidad en el cliente. Un timeout de cliente después de
30 segundos produce un mensaje de comprobación tardía y no un reintento automático.

### 5.3 Reglas que no se pueden romper

- No reintentar automáticamente en segundo plano; el reintento es explícito del
  usuario.
- No gastar cuota en una entrada KV ya disponible.
- No revelar tokens, claves, URLs internas de VirusTotal ni mensajes técnicos del
  proveedor.
- No presentar heurística local como análisis de motores antivirus.
- No convertir una respuesta sin datos o con todos los motores en timeout en `safe`.
- Mantener `Retry-After` y `RateLimit-*` coherentes con la causa del rechazo.

La documentación histórica `docs/contrato-rate-limiting-cache-worker.md` contiene un
borrador de degradación `200` con `X-Centinela-Degraded`. Ese formato no es el
contrato vigente de `worker/src/index.js`: el comportamiento implementado y probado
es `429` para el freno por IP, `503` para cuota y fallback heurístico del endpoint
local. No debe implementarse el borrador histórico sin una decisión arquitectónica,
código y pruebas nuevas.

## 6. Mantenimiento de la suite de 275 tests

La suite se ejecuta con el runner del repositorio:

```bash
npm test -- --run
```

`package.json` delega en `tests/runner.js`, que descubre los archivos
`tests/**/*.test.js`, ejecuta sus exportaciones `run()` y suma el campo `tests` de
cada módulo. El criterio de aceptación de este protocolo es:

- `pass: 275`.
- `fail: 0`.
- Exit code `0`.
- No modificar ni relajar tests preexistentes para obtener ese resultado.

El gate completo obligatorio es:

```bash
~/.hermes/scripts/factory-gate.sh --dir /home/m1txel/02_Proyectos/Michel_Macias_Repos/Centinela_PWA
```

El gate es fail-fast y comprueba, cuando están configurados, tipos, lint, la suite
Node y el build. La certificación de un cambio documental solo es válida si ambos
comandos anteriores terminan con exit code `0`; la salida real de la ejecución debe
quedar asociada al cambio, no sustituirse por la cifra declarada en esta página.

## 7. Matriz de verificación

| Escenario | Resultado esperado | Evidencia |
| --- | --- | --- |
| Sin red durante la reputación local | Resultado heurístico con `isOfflineAnalysis: true` | `js/core/reputation-offline.js`, `tests/js/reputation-offline.test.js` |
| `/api/local-check` responde `429` | Se conserva el resultado heurístico local | `js/api.js`, `tests/js/api.test.js` |
| `/api/scan` responde `429` | Error traducido, espera de un minuto, sin detalles técnicos | `js/api.js`, `tests/js/api.test.js` |
| Rate limit por IP | `429` + `Retry-After: 60` + `RateLimit-*` | `worker/src/index.js`, `tests/worker/scan.test.js` |
| Cuota global agotada | `503` + `QUOTA_EXCEEDED` + cabeceras de espera | `worker/src/index.js`, `tests/worker/quota-guard.test.js` |
| Resultado KV disponible | `200`, `cached: true`, sin consumir cuota | `worker/src/index.js`, pruebas de Worker |
| Cambio del protocolo | `npm test -- --run` y `factory-gate.sh` en verde | CI/local, sin tocar tests |

## 8. Criterio de cierre

Este protocolo se considera mantenido cuando el comportamiento descrito coincide con
el código desplegable, la suite conserva `275/275` sin cambios en tests, el quality
gate termina en exit code `0` y cualquier cambio de contrato (por ejemplo, convertir
la degradación de `503` en una respuesta `200` heurística) se acompaña de una decisión
arquitectónica explícita, implementación, pruebas y actualización de esta matriz.
