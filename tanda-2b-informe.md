# Tanda 2b — Cerrar el agujero del test de contrato (H-1) + coherencia (H-2, H-3)

Rama `feat/v2-rebuild`. Sin tocar `main`, sin push. Commits atómicos sobre la rama.

## 1. Resumen

El agujero que encontró la revisión cruzada (Claude Sonnet 5.5) era real: el test
anti-divergencia de HU-02 no protegía el cableado de `app.js`, y las mutaciones M1/M2/M3
pasaban en verde. Esta tanda lo cierra, y **demuestra por mutación** que ahora falla.

- **H-1 (MAYOR)** — resuelto con la vía **(a)**: se extrae el cableado a una función
  exportable y testeable; el test de contrato la ejercita de verdad (ya no replica el
  cableado a mano). Además se añade una guarda que cubre el punto de unión en `app.js`.
- **H-2 (MENOR)** — resuelto: historial y estadísticas cuentan lo mismo.
- **H-3 (MENOR)** — resuelto: `classify()` sanea contadores negativos.

Estado final: `npm test` **41 pass / 0 fail (exit 0)**, `npm run build` **exit 0**.

## 2. H-1 — Vía elegida y por qué

Se descartó la vía (b) (cargar `app.js` con DOM y `fetch` simulados). Razones:

- `app.js` construye ~30 referencias de DOM a nivel de módulo y arranca `init()` si el
  DOM está listo; para importarlo habría que montar un DOM completo y silenciar el arranque.
- El flujo real (`analyzeCurrentUrl`) depende de `analyzeUrl` (red), `navigate` (router →
  montaje de pantallas) y `validateUrl`. El runner es un harness ESM propio, sin framework
  de mocks; simular todo eso es frágil y acopla el test a la plomería de UI, que es
  justamente lo que el brief pide no testear.
- La vía (b) testearía mucho ruido de UI para cubrir una línea de negocio.

**Vía (a) implementada:** nuevo módulo `js/core/scan-record.js` con `recordScanOutcome(url, result)`.
Es el **único** punto donde se encadena `classify` → `addToHistory` → `recordScan`. `app.js`
ahora solo lo llama:

```js
const verdict = recordScanOutcome(currentUrl, result);
```

Y `verdict.test.js` importa `recordScanOutcome` y lo **ejercita directamente**, comparando el
veredicto devuelto con el guardado en historial, el contado en estadísticas y el pintado en
pantalla. Se eliminaron de `app.js` los imports de `classify`, `addToHistory` y `recordScan`.

### Residual cubierto: el punto de unión en `app.js`

Con solo la vía (a), una mutación en el *call-site* de `app.js`
(`recordScanOutcome(currentUrl, { ...result, suspicious: 0 })`) seguiría en verde, porque el
test llama a la función directamente. Para cerrar ese único camino que el test directo no
ejercita, se añade una **guarda de arquitectura** que lee `js/app.js` y exige:

1. que contenga exactamente `recordScanOutcome(currentUrl, result)` con el resultado crudo; y
2. que **no** vuelva a llamar a `classify(`, `addToHistory(` ni `recordScan(` por su cuenta.

Es una *fitness function* estática, determinista y barata. Con ella, el camino real de
`app.js` (clasificar → historial → estadísticas) queda protegido de punta a punta: el
cableado por dentro y el punto de unión por fuera.

## 3. H-1 — Evidencia de mutación (salidas reales)

Baseline antes de esta tanda: `38 pass / 0 fail`. Estado final: `41 pass / 0 fail (exit 0)`.

Cada mutación se aplicó sobre el código commiteado, se ejecutó `npm test`, y se revirtió con
`git checkout -- <fichero>`. Se pega la línea real del runner.

### M2 — historial persiste con `suspicious: 0` (reintroduce F-4)

Aplicada en `js/core/scan-record.js` (donde vive ahora el cableado; en `app.js` ya no existe
esa línea):

```
-  const entry = addToHistory(url, result);
+  const entry = addToHistory(url, { ...result, suspicious: 0 });
```

Resultado real:

```
EXIT=1
  "pass": 31,
  "fail": 1
✗ js/verdict.test.js — HU-02 CONTRATO: el cableado real mantiene pantalla, historial y
  estadísticas en el mismo veredicto: Error: historial: safe != warning para
  {"malicious":0,"suspicious":2,"total":70}
```

**FALLA.** ✅

### M3 — clasificación alternativa en el cableado

Aplicada en `js/core/scan-record.js`:

```
-  const verdict = classify(result);
+  const verdict = result.positives === 0 ? 'safe' : classify(result);
```

Resultado real:

```
EXIT=1
  "pass": 31,
  "fail": 1
✗ js/verdict.test.js — HU-02 CONTRATO: ...: Error: cableado:
  {"malicious":0,"suspicious":2,"total":70} → safe, esperado warning
```

**FALLA.** ✅

### M2-app — mutación en el *call-site* de `app.js` (la que antes pasaba en verde)

```
-  const verdict = recordScanOutcome(currentUrl, result);
+  const verdict = recordScanOutcome(currentUrl, { ...result, suspicious: 0 });
```

Resultado real:

```
EXIT=1
  "pass": 31,
  "fail": 1
✗ js/verdict.test.js — HU-02 CONTRATO: app.js delega el punto de unión en el cableado único
  (guarda anti-F-4): Error: app.js no llama a recordScanOutcome(currentUrl, result) con el
  resultado crudo
```

**FALLA.** ✅

### F-4-app — reintroducir el cableado antiguo (F-4) en `app.js`

Se sustituyó la llamada única por el bloque original de tres líneas con clasificación
alternativa + `suspicious: 0` (exactamente el fallo F-4 de la v1):

```
-  const verdict = recordScanOutcome(currentUrl, result);
+  const verdict = result.positives === 0 ? 'safe' : classify(result);
+  addToHistory(currentUrl, { ...result, suspicious: 0 });
+  recordScan(currentUrl, verdict);
```

Resultado real:

```
EXIT=1
  "pass": 31,
  "fail": 1
✗ js/verdict.test.js — HU-02 CONTRATO: app.js delega el punto de unión en el cableado único
  (guarda anti-F-4): Error: app.js no llama a recordScanOutcome(currentUrl, result) con el
  resultado crudo
```

**FALLA.** ✅

Las cuatro mutaciones, revertidas; `git status` limpio tras cada reversión.

## 4. H-2 — Historial y estadísticas cuentan lo mismo

**Vía elegida (la más simple):** `addToHistory` devuelve `null` cuando descarta un reescaneo
duplicado (< 5 min, `isDuplicate`). `recordScanOutcome` solo llama a `recordScan` si la
entrada se guardó de verdad:

```js
const verdict = classify(result);
const entry = addToHistory(url, result);
if (entry) recordScan(url, verdict);   // stats sigue al historial, no a un recuento paralelo
return verdict;
```

Antes: `app.js` llamaba a `recordScan` **siempre**, así que un reescaneo descartado por el
historial sí inflaba las estadísticas (contadores ≠ historial). Ahora los contadores derivan
del veredicto realmente guardado, como pide la arquitectura §5.1.

Contrato de `addToHistory` actualizado: `@returns {object|null}` (entrada guardada, o `null`
si fue duplicado). Los llamadores existentes (`result.test.js`) no usan el valor devuelto,
así que no se rompe nada.

Test: `HU-02/H-2: historial y estadísticas cuentan lo mismo` — dos `recordScanOutcome` de la
misma URL → historial 1 entrada, estadísticas 1, sin desincronía.

## 5. H-3 — `classify()` sanea contadores negativos

`toNumber` (clamp silencioso a 0) se sustituye por `toCount`:

- ausente (`undefined`/`null`/`''`) → `0` (sin señal);
- negativo o no numérico → `null` (**dato inválido**).

`classify` trata cualquier contador inválido como **no fiable → `warning`** (precaución),
nunca `safe`. Así `{ malicious: -1, suspicious: 0, total: 5 }` deja de leerse como «limpio».

Test: `HU-02/H-3: un contador negativo no se lee como «limpio»` con tres casos
(`malicious<0`, `suspicious<0`, `total<0`) → los tres `warning`.

Nota: los casos válidos existentes (incluidos `total=0 → warning`, `malicious>3 → danger`,
alias `positives`, string `"4"`) se mantienen; los fija el test canónico de la tabla.

## 6. Ficheros

- `js/core/scan-record.js` — **nuevo**: cableado único `recordScanOutcome(url, result)`.
- `js/app.js` — usa `recordScanOutcome`; retira imports de `classify`/`addToHistory`/`recordScan`.
- `js/history.js` — `addToHistory` devuelve `null` en duplicado (H-2).
- `js/core/verdict.js` — `toCount` + saneo → `warning` para dato inválido (H-3).
- `tests/js/verdict.test.js` — contrato que ejercita el cableado real + guarda del call-site +
  tests de H-2 y H-3.

## 7. Commits

```
992fc73 test: T2b — guarda el punto de unión de app.js contra F-4 (H-1)
48aae55 feat: T2b — cableado único testable (H-1) + contrato que lo ejercita
9a4abfe fix: T2b — historial y estadísticas cuentan lo mismo (H-2)
b461c79 fix: T2b — classify sanea contadores negativos (H-3)
```

## 8. Verificación final

```
$ npm test        → 41 pass / 0 fail (exit 0)
$ npm run build   → exit 0 (PWA v0.19.8, injectManifest, 9 precache entries)
$ git status      → limpio
```

Sin tocar `main`, sin merge, sin push.

## 9. Handoff

Listo para **Tanda 3 (E7 — seguridad sostenible)**. La red anti-F-4 (HU-02) queda cerrada por
mutación: pantalla, historial y estadísticas no pueden divergir en silencio, ni por dentro del
cableado ni por el punto de unión de `app.js`.
