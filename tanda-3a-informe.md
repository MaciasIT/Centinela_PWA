# Tanda 3a — Informe: Worker de seguridad sostenible

> **Fase 4 · Tanda 3a** — `t_e2f6512d` · Rol `dev` · Rama `feat/v2-rebuild`
> **Fecha:** 2026-10-09 · **Skills:** `app-dev-pipeline`, `tdd-workflow`, `ci-cd-quality-gates`
> **Alcance cerrado:** wrangler 4 + gate de bindings en CI + DO `QuotaGuard` + freno por IP + CORS real + validación/normalización + solo VirusTotal + secretos.
> **Sin tocar `main`. Sin push. Sin secretos ni datos de Michel modificados.**

---

## 1. Resumen

El Worker pasa de «proxy multi-fuente con CORS `*`, sin rate limiting y con un
control que se descarta en silencio» a un servicio con **una sola fuente
declarada (VirusTotal)**, **CORS de lista blanca**, **validación y normalización
antes de gastar cuota**, **freno de inundación por IP** y —lo importante— un
**contador global exacto de cuota** en un Durable Object, verificado bloqueando
en un despliegue real.

Estado final en `feat/v2-rebuild`:

| Comprobación | Resultado |
|---|---|
| `npm test` | **103 pass / 0 fail** (exit 0) |
| `npm run build` | **exit 0** |
| `worker/scripts/check-bindings.mjs` (gate de CI) | **exit 0** |
| Despliegue real (cuenta temporal) | 5ª petición → **`503 QUOTA_EXCEEDED`** |
| `git status` | limpio |

---

## 2. Qué se implementó

### 2.1 wrangler 3 → 4

`worker/package.json` declara ahora `wrangler: ^4.0.0` y se ha generado
`worker/package-lock.json`. El `wrangler.toml` documenta **por qué** (con wrangler
3 el binding se descarta en silencio). Versión usada en toda la evidencia
empírica: **4.149.0**.

### 2.2 Gate de CI que FALLA (no avisa) si el binding no llega

`worker/scripts/check-bindings.mjs` ejecuta `wrangler deploy --dry-run`, **lee la
salida** y aborta con exit 1 si no aparecen el binding de rate limiting y la
clase del DO. `.github/workflows/ci.yml` gana el job `worker`, que además
comprueba que no hay ningún `.env` versionado (NFR-S6).

### 2.3 Durable Object `QuotaGuard` — contador global exacto

`worker/src/quota-guard.js`. Instancia única `vt-quota`, token bucket con ventana
de minuto y de día: **4/min · 500/día agregados**. La atomicidad del
read-modify-write se apoya en los *input gates* de los Durable Objects (mientras
hay una operación de storage en curso, no se entrega otro evento al objeto).
Sin cuota → `503 QUOTA_EXCEEDED` con `Retry-After`, **antes** de llamar a
VirusTotal.

### 2.4 Freno de inundación por IP (binding `[[ratelimits]]`)

**30/60 s** con clave `cf-connecting-ip`, → `429 RATE_LIMITED` antes de VT. El
código lleva escrito, en `worker/src/index.js` y en `wrangler.toml`, que **este
binding NO garantiza el techo de cuota** y que su única función es evitar que un
único actor acapare.

### 2.5 CORS real

Lista blanca explícita (`ALLOWED_ORIGINS` en `[vars]`, con origen de producción
y locales por defecto) + un único patrón **anclado y estricto** para los
*preview deployments* (`https://<hash>.centinela-pwa.pages.dev`). Sin comodín,
sin regex laxa. Origen no permitido → `403 FORBIDDEN_ORIGIN` antes de VT, y sin
cabeceras CORS. Se documenta en el código que CORS **no es autenticación**.

### 2.6 Validación y normalización

`worker/src/validation.js`:
- esquema `http`/`https` solamente; longitud ≤ 2048; host con punto; rechazo de
  IP literal (v4/v6), `localhost` y rangos internos;
- `normalizeUrl()` implementa **RC-04** al pie de la letra (esquema forzado a
  `https`, host en minúsculas sin `www.`, path sin barra final sobrante,
  fragmento fuera, `utm_*`/`fbclid`/`gclid`/`msclkid`/… fuera, resto ordenado).

### 2.7 Solo VirusTotal (decisión 1A)

Retirados **Google Safe Browsing** y **URLScan.io** del Worker: código, ramas y
funciones. El Worker queda con una sola fuente declarada
(`worker/src/virustotal.js`). En el cliente se han retirado `gsbSafe`,
`gsbThreats`, `urlscanUuid`, `urlscanPending`, `urlscanResultUrl` y
`sourceErrors`; `sources` queda siempre `['virustotal']`. La UI ya declaraba
VirusTotal como única fuente (`js/screens/result.js:203`, `index.html`), así que
ahora **el código y lo que la UI dice coinciden**.

### 2.8 Secretos

Cero claves en el repositorio: ni en `wrangler.toml` (solo comentarios), ni en
`worker/.env`. `.gitignore` cubre ahora `.env`, `.env.*` y `.dev.vars`, y
**`worker/.env` se ha desversionado** (`git rm --cached`; su contenido era solo
comentarios, verificado).

---

## 3. Evidencia real

### 3.1 El binding llega al despliegue (dry-run, wrangler 4.149.0)

```
Total Upload: 18.15 KiB / gzip: 5.79 KiB
Your Worker has access to the following bindings:
Binding                                                           Resource
env.QUOTA_GUARD (QuotaGuard)                                      Durable Object
env.SCAN_RATE_LIMITER (30 requests/60s)                           Rate Limit
env.ALLOWED_ORIGINS ("https://centinela-pwa.pages.dev,http:...")  Environment Variable
--dry-run: exiting now.
```

### 3.2 **Prueba por mutación del gate de CI** (el rojo exigido)

**M-A — se quita `[[ratelimits]]` de `wrangler.toml`:**

```
env.QUOTA_GUARD (QuotaGuard)                    Durable Object
env.ALLOWED_ORIGINS (...)                       Environment Variable
✗ GATE DE BINDINGS: no aparece «binding de rate limiting» en la salida del
  despliegue en seco (patrón exigido: /SCAN_RATE_LIMITER/). …
EXIT=1
```

**M-B — se quita el binding + migración del DO `QuotaGuard`:**

```
env.SCAN_RATE_LIMITER (30 requests/60s)         Rate Limit
✗ GATE DE BINDINGS: no aparece «Durable Object QuotaGuard» … (patrón /QUOTA_GUARD/)
EXIT=1
```

Ambas mutaciones **revertidas**; el gate vuelve a **exit 0**.

### 3.3 Despliegue REAL y bloqueo efectivo del `QuotaGuard`

Desplegado en una **cuenta temporal de Cloudflare** (`wrangler deploy --temporary`;
no toca la cuenta ni los datos de Michel). URL efímera del probe:
`https://centinela-api.unleashed-anatosaurus.workers.dev`. **Probe borrado al
terminar** (`wrangler delete`). La cuenta temporal caduca sola.

```
GET /health
{"status":"ok","timestamp":"2026-10-09T17:02:57.256Z","version":"2.3.0"}  [200]

7 POST /api/scan seguidos (en la cuenta temporal NO hay clave de VirusTotal):
peticion 1 -> HTTP 502  {"error":{"code":"UPSTREAM_UNAVAILABLE",…}}
peticion 2 -> HTTP 502  {"error":{"code":"UPSTREAM_UNAVAILABLE",…}}
peticion 3 -> HTTP 502  {"error":{"code":"UPSTREAM_UNAVAILABLE",…}}
peticion 4 -> HTTP 502  {"error":{"code":"UPSTREAM_UNAVAILABLE",…}}
peticion 5 -> HTTP 503  {"error":{"code":"QUOTA_EXCEEDED",…}}   ← el DO BLOQUEA
peticion 6 -> HTTP 503  {"error":{"code":"QUOTA_EXCEEDED",…}}
peticion 7 -> HTTP 503  {"error":{"code":"QUOTA_EXCEEDED",…}}

Preflight desde origen NO permitido:  OPTIONS https://sitio-ajeno.example -> 403
POST desde origen NO permitido:       -> 403 {"error":{"code":"FORBIDDEN_ORIGIN",…}}
POST con esquema no http(s) (ftp://)  -> 400 {"error":{"code":"INVALID_URL",…}}
```

Lectura: las 4 primeras no obtienen veredicto (no hay clave de VT en la cuenta
temporal) y **degradan honestamente** con `502`; la **5ª se bloquea con `503`**.
Eso demuestra el contador exacto **en ejecución real**, no solo en test unitario,
y demuestra también que **sin datos nunca se inventa un veredicto**.

### 3.4 El freno por IP NO bloquea en la práctica (hallazgo honesto)

Ráfaga de **60 peticiones** con el binding configurado a 30/60 s:

```
     4 502
    56 503     ← 0 × 429
```

**Cero bloqueos por IP** con el doble del límite declarado. Confirma la
verificación previa (`verificacion-binding-ratelimits.md`): el binding es
*permissive* y de consistencia eventual. **No se reporta como control de cantidad;
se reporta como lo que es: un freno best-effort.** El techo de cuota lo da el DO.

### 3.5 Mutaciones del código (rojo → verde)

| Mutación | Rojo observado |
|---|---|
| **M-C** desactivar el control de minuto en `takeToken` | `fail: 2` — `secuencia inesperada: [true,true,true,true,true]`; `bloqueos 0, esperados 13` |
| **M-D** desactivar el filtro de parámetros de tracking en `normalizeUrl` | `fail: 2` — `URL enviada a VT: https://ejemplo.com/a?a=1&b=2&utm_source=x` |

Ambas revertidas → **103 pass / 0 fail**.

---

## 4. Consumo del DO (estimación y observación)

- **Peticiones al DO:** 1 por intento de `/api/scan` (incluida la denegada). Con
  el techo de VT a 500/día, el orden de magnitud es **≤ ~600 peticiones/día**
  (alguna más si hay reintentos del usuario). Plan gratuito: **100.000/día**.
- **Escrituras de storage:** 1 por intento → mismo orden (≤ ~600/día). Plan
  gratuito: **100.000 filas/día**.
- **Observado en el probe:** el contador persistió correctamente entre peticiones
  y sobrevivió al bloqueo; no hubo errores de storage.
- **Coste monetario:** 0 €/mes en el tramo gratuito (nota de la arquitectura:
  el almacenamiento SQLite de DO empieza a facturarse paulatinamente a partir de
  enero de 2026; con este volumen seguiría gratis).
- ⚠ **Hallazgo F-2:** el token se consume **antes** de llamar a VT (así lo fija la
  arquitectura §5.3.3). Por tanto **un fallo de VT gasta cuota del minuto sin
  producir veredictos**. Se deja tal cual por fidelidad al diseño; queda anotado
  como posible ajuste (devolver el token si VT falla antes de agotar la ventana).

---

## 5. Decisiones tomadas (y por qué)

| # | Decisión | Motivo |
|---|---|---|
| D-1 | `normalizeUrl` del Worker implementa RC-04 **exacto** (incluido forzar `https`) | Es la especificación citada por el ticket (§6 → §5.3.2) y su test de contrato |
| D-2 | La URL **normalizada** es la que se envía a VT | El ticket pide «normalizar antes de consultar… para que el mismo destino no consuma cuota dos veces» |
| D-3 | `/api/local-check` se **mantiene** (no se retira) | Fuera de alcance por ticket; la arquitectura §5.2 deja la retirada «revisable por el Orchestrator». Se arregló el **bug real** (import ausente) y se le aplicó CORS/validación/sobre de error |
| D-4 | Respuesta de `/api/scan` conserva la forma `{results:[…]}` | Minimiza el cambio de contrato con el cliente; solo se eliminan las fuentes retiradas |
| D-5 | Se retira el `Map` en memoria **no** (queda solo para `local-check`) | Fuera de alcance; la caché del MVP es la del cliente (1 h) |
| D-6 | El Worker **no falla en cerrado** si falta el binding del DO | Para no dejar la app muerta en runtime; el fallo silencioso lo impide el **gate de CI** |
| D-7 | `Health.test.js` se reescribe con `okAsync` | Tenía tests `async` dentro del helper síncrono: el rechazo escapaba al runner y **mataba el proceso** (lo detectó esta tanda) |

---

## 6. Contradicciones con los documentos

- **C-1 (reconciliar):** arquitectura **§5.3.2, nota** dice que la URL que se envía
  a VT es la **original** y que la normalizada solo decide *si hay respuesta
  guardada*. El ticket §6 pide normalizar **antes de consultar**. → Se siguió el
  **ticket**. Riesgo honesto: al forzar `https` (RC-04), un sitio solo-`http`
  se analizaría como su variante `https`, que podría no existir → **veredicto
  sobre un recurso distinto**. Pendiente de reconciliar (Tanda 5 o revisión).
- **C-2:** arquitectura §5.2 ordena «retirar el endpoint roto `/api/local-check`
  y `worker/src/reputation.js`»; el ticket lo deja **fuera de alcance** (motor de
  reputación local / E1). → Se mantiene, con el import arreglado. **Requiere
  decisión del Orchestrator.**
- **C-3:** RC-04 pide **un único** `normalizeUrl` compartido por cliente y Worker
  (`core/validation.js`). El cliente tiene el suyo en `js/api.js` con **otro
  contrato** (no fuerza `https`; lo usa para deduplicar historial) y con tests
  propios que lo fijan. No se unificó (fuera de alcance). El Worker implementa la
  versión RC-04; la unificación queda pendiente.
- **C-4:** `worker/src/reputation.js` tiene un **bug latente**:
  `domainAgeDays()` se llama **sin `await`** (`const ageDays = domainAgeDays(cleanHost)`),
  así que la señal de antigüedad del dominio **nunca se aplica**. No corregido
  (fuera de alcance). Reportado.
- **C-5:** `wrangler.toml` usa `namespace_id = "1001"` (el mismo del probe ya
  borrado). El `namespace_id` debe ser único en la cuenta: si el `deploy` real se
  queja por conflicto, basta cambiarlo.

---

## 7. Ficheros

**Nuevos**
- `worker/src/validation.js` — validación + `normalizeUrl` (RC-04)
- `worker/src/quota-guard.js` — DO `QuotaGuard` (contador exacto)
- `worker/src/virustotal.js` — única fuente, con timeout 8 s y códigos de error
- `worker/scripts/check-bindings.mjs` — gate de CI
- `worker/package-lock.json`
- `tests/worker/validation.test.js`, `tests/worker/quota-guard.test.js`, `tests/worker/scan.test.js`

**Modificados**
- `worker/src/index.js` — reescrito (CORS, cabeceras, validación, orden de control, sobre de error)
- `worker/wrangler.toml` — `[[ratelimits]]` 30/60 s + DO + migración
- `worker/package.json` — wrangler ^4 + scripts
- `js/api.js` — una sola fuente; mensajes de error llanos (503/429/403) sin fuga
- `tests/worker/health.test.js` — patrón async corregido
- `tests/js/api.test.js`, `tests/js/verdad.test.js` — contratos T3a
- `.gitignore` — `.env`, `.env.*`, `.dev.vars`
- `.github/workflows/ci.yml` — job `worker` (gate + NFR-S6)
- `worker/.env` — **desversionado**

---

## 8. Fuera de alcance (recordatorio)

- CSP y los `onclick` en línea de `index.html` → **Tanda 3b**.
- Identidad visual y tipografía → Tanda 5.
- Motor de reputación local (E1) y la decisión C-2.
- KV de caché compartida (HU-33, Should).

## 9. Handoff

- Sigue: **Tanda 3b** (frontend: CSP y cabeceras).
- Después: **revisión cruzada de seguridad** sobre el Worker.
- Para el **deploy real de producción** hace falta autorización de Michel y el
  secreto ya configurado (`wrangler secret put VIRUSTOTAL_API_KEY`); esta tanda
  **no ha tocado** ni la cuenta ni los secretos de producción.