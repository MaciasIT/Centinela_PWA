# Tanda 2c — Veracidad del veredicto cuando no hay datos (O-2)

Rama `feat/v2-rebuild`. Sin tocar `main`, sin merge, sin push. Commits atómicos.

## 1. Resumen

Michel decidió: **«No fingimos veredicto.»** Hasta ahora, un resultado 100 % timeout
(`{malicious:0, suspicious:0, total:70}` con las 70 detecciones en timeout) caía en la
regla 4 de §5.1 (`total > 0` y nada negativo) y se leía como **«Seguro»**. Esta tanda
introduce un estado propio, **`unchecked` («no comprobado»)**, que `classify()` devuelve
cuando **no hay ninguna detección real**, y lo presenta de forma honesta (ámbar, texto
«No hemos podido comprobar este enlace», pasos propios) de forma **coherente** en pantalla,
historial y estadísticas.

Estado final: `npm test` **48 pass / 0 fail (exit 0)**, `npm run build` **exit 0**.

## 2. El caso exacto que activa «no comprobado»

`classify()` evalúa, en este orden:

| # | Condición | Veredicto |
|---|-----------|-----------|
| 0 | contador negativo o no numérico | `warning` |
| 1 | `total === 0` | `warning` (**sin cambios**, §5.1) |
| 2 | **`total > 0 && timeout >= total`** | **`unchecked`** ← nuevo (T2c) |
| 3 | `malicious > 3` | `danger` |
| 4 | `malicious >= 1 \|\| suspicious >= 1` | `warning` |
| 5 | en otro caso | `safe` |

**Valor devuelto por el módulo:** `'unchecked'` (nuevo valor del enum `VERDICT`).

**Por qué `timeout >= total` y no «no hay detección real» como disparador literal:**
en la forma normalizada `total = malicious + suspicious + harmless + undetected + timeout`,
`timeout === total` **equivale** a «ninguna detección real» (las cuatro categorías reales a 0).
Pero los *fixtures* de contrato representan el caso legítimo de §5.1 como
`{malicious:0, suspicious:0, total:70}` **sin** `harmless`/`undetected` explícitos. Un
disparador basado en «las cuatro categorías a 0» convertiría ese caso legítimo
(«VirusTotal respondió y no vio nada») en `unchecked`, rompiendo §5.1. Por eso se usa el
**recuento `timeout`** como discriminador explícito y no el silencio de las categorías.

**`timeout` no lo exponía el resultado normalizado** (solo se usaba para calcular `total`).
Se añadió `timeout` en los dos normalizadores de `js/api.js` (`normalizeMultiSource` y
`normalizeLegacyVT`) para que la corrección funcione en el camino real, no solo en los tests.

## 3. Cómo se presenta

- **Color:** el **ámbar** del sistema (`#8A4E00` / `#FDF1DE`), el de precaución. **Sin
  cuarto color.** El estado reutiliza los tokens del amarillo.
- **Texto honesto, nunca afirmativo:** título «No hemos podido comprobar este enlace»,
  explicación «La comprobación no ha llegado a completarse, así que no sabemos si es
  seguro. No te fíes todavía.»
- **HU-04:** 3 pasos propios del «no comprobado» («Vuelve a intentarlo en un momento» …),
  **nunca los pasos del verde** (lo fija un test).
- **No se invita a abrir:** en la pantalla de resultado, `btn-open-url` se oculta también
  para `unchecked` (no solo para `danger`).
- **Volver a intentarlo:** el paso 1 lo indica y sigue disponible «Comprobar otro enlace».
  Además, se corrigió un impedimento real (ver §4): un resultado sin datos **ya no se
  cachea**, para que reintentar vuelva a consultar la fuente en vez de devolver el
  «no comprobado» viejo durante 1 h.

## 4. Coherencia pantalla / historial / estadísticas

Se usó la red de la Tanda 2b (`recordScanOutcome` → `classify` + `addToHistory` + `recordScan`).
Un mismo resultado 100 % timeout produce el mismo `unchecked` en:

- **Pantalla:** `result-traffic-light unchecked` + título «No hemos podido comprobar este enlace».
- **Historial:** la entrada se guarda con `status: 'unchecked'` (filtro «Sin comprobar»).
- **Estadísticas:** nuevo contador `uncheckedCount` (tarjeta y segmento ámbar propios).

Test de contrato: `T2c CONTRATO: un resultado no comprobado se presenta igual en pantalla,
historial y estadísticas`, y el *fixture* `unchecked` añadido a la lista canónica se
propaga por el contrato anti-divergencia existente.

**Hallazgo propio (corregido):** `analyzeUrl` cacheaba *cualquier* resultado con
`total > 0`, incluido el 100 % timeout. Reintentar devolvía el mismo «no comprobado» durante
1 h. Se sustituyó la condición por `hasUsableData(result)` (`total > 0` **y** alguna
detección real > 0). Test: «un resultado sin datos no se cachea, para que volver a
intentarlo reconsulte».

## 5. Contradicciones encontradas (repórtalas, no las oculté)

### C-1 — El ticket y el documento de diseño §Estados 2 se contradicen en la taxonomía

El ticket (Tanda 2c) pide: usar **ámbar** y que **pantalla, historial y estadísticas digan
lo mismo** para «no comprobado» (implica persistirlo).

`diseno-centinela-v2.md` dice lo contrario, y es explícito:

- §1.4 (línea 123): «Solo hay tres veredictos… Lo no comprobado **no es una categoría**: es
  un estado transitorio de error (§Estados 2) que **nunca se persiste**.»
- §1.4/§4 (líneas 133/275-276): «El gris “No lo he podido comprobar” **NO es un cuarto
  veredicto**… comparte una presentación neutra (`state.neutral #565049`, tinte `#EFEAE2`,
  círculo con “?”)… vive **fuera** de la taxonomía persistente.»
- §6/§7 (líneas 596, 723): «un intento no comprobado **no suma** en ninguna categoría»;
  «**no se guarda** en el historial ni **suma** en las estadísticas».
- Línea 963: aclara que esta taxonomía ya se fijó en una ronda de revisión cruzada, y que el
  token es `state.neutral` («ya **no** `verdict.unknown`»).

**Decisión tomada:** seguí el **ticket** (estado `unchecked` presentado en ámbar y
**persistido** coherentemente en historial y estadísticas), porque es la instrucción viva de
esta tanda y porque el ticket difiere explícitamente «terminología y colores definitivos» a
la **Tanda 5**. Consecuencia: **el «no comprobado» es hoy un cuarto estado persistente**
(tarjeta y filtro propios), lo que contradice §Estados 2. **Requiere reconciliación** en
Tanda 5 / por el Orchestrator. Si la decisión de diseño (neutral + no persistir) prevalece,
el cambio a revertir es acotado: `uncheckedCount` en `stats.js`, el filtro en
`screens/history.js` y los tokens en `verdict.js`.

### C-2 — §5.1 no distingue «VT respondió y no vio nada» de «no tenemos datos»

La tabla de §5.1 solo exige `total > 0` para el caso verde, y **no contempla** el estado
«no comprobado». Además, el resultado normalizado **no exponía** ninguna señal de «sin
datos». No se inventó: se añadió `timeout` a la normalización y una regla nueva (§5.1 no
cambia en sus 5 reglas existentes; el estado nuevo se antepone al rojo).

### C-3 — El segundo disparador del ticket (`total = 0` por ausencia de datos) no es distinguible

El ticket pide que «ningún motor devolvió nada (`total = 0` por ausencia de datos)» active
«no comprobado», **y a la vez** que `total === 0` legítimo siga siendo lo que fija §5.1
(`warning`). Con el resultado normalizado actual **ambos casos son indistinguibles**: no hay
campo que separe «VT respondió con 0 detecciones» de «no tuvimos datos». §5.1 solo define
`total === 0 → warning`. **No se implementó**: inventar un discriminador (p. ej. un flag
`noData`) sería justo lo que el ticket prohíbe. Se reporta para que se decida (probablemente
en Tanda 3, donde vive el contrato del Worker). Hoy `total === 0` sigue siendo `warning`.

### C-4 — Retry: el manual de HU-09 vive en la pantalla de carga, no en el resultado

El ticket sugiere «reutiliza el reintento manual de HU-09 si encaja». El reintento de HU-09
(`loading.js`, `onRetry`) solo aplica mientras se espera; el «no comprobado» se conoce
**después** de la respuesta. No se añadió un botón «Reintentar» dedicado en la pantalla de
resultado (la oferta queda en el paso 1 y en «Comprobar otro enlace»). Se dejó como estaba
para no abrir UI nueva fuera de alcance; el impedimento real del retry (la caché) sí se
corrigió (§4). Candidato para Tanda 5 si se quiere un botón visible.

## 6. Ficheros

- `js/core/verdict.js` — `VERDICT.UNCHECKED`, `INFO.unchecked`, `STEPS.unchecked`, regla
  `timeout >= total` en `classify()`.
- `js/api.js` — `timeout` en los dos normalizadores; `hasUsableData()` (no cachear sin datos).
- `js/core/scan-record.js` — JSDoc del enum.
- `js/history.js` — guarda `timeout` en la entrada.
- `js/stats.js` — `uncheckedCount`, `getPercentages()` con `unchecked`, tarjeta y segmento.
- `js/screens/result.js` — oculta «Abrir web» en `unchecked`.
- `js/screens/history.js` — filtro «Sin comprobar».
- `css/styles.css` — `unchecked` reutiliza los tokens ámbar (pantalla, tarjeta, barra).
- `tests/js/verdict.test.js`, `tests/js/api.test.js` — contrato T2c.

## 7. Verificación (salidas reales)

```
$ npm test        → 48 pass / 0 fail (exit 0)
$ npm run build   → exit 0 (PWA v0.19.8, injectManifest, 9 precache entries)
$ git status      → limpio tras los commits
```

**Evidencia de mutación** (aplicada, ejecutada y revertida):

- **M-A** — quitar la regla `timeout >= total` de `classify` → **exit 1**:
  `{"malicious":0,"suspicious":0,"timeout":70,"total":70} → safe, esperado unchecked`
  (+ fallan el contrato de cableado y el test de `api.js`).
- **M-B** — `api.js` deja de propagar `timeout` → **exit 1**:
  `T2c: analyzeUrl propaga el timeout...: timeout esperado 5, obtuve undefined`.
- **M-C** — el cableado finge veredicto (`classify(result)==='unchecked' ? 'safe' : …`) →
  **exit 1**: `cableado: safe, esperado unchecked` (contrato de las tres vistas).

## 8. Handoff

Listo para **Tanda 3a (seguridad sostenible)**. Queda pendiente de reconciliación lo de §5
(C-1, sobre todo): el «no comprobado» persistente en ámbar contradice §Estados 2 del
documento de diseño, que lo quiere **neutral y no persistido**. Se implementó según el
ticket y a la espera de decisión del Orchestrator / Tanda 5.