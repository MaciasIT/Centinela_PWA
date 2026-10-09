# Tanda 3b — Frontend: CSP estricta y cabeceras de seguridad

**Rol:** `dev` · **Rama:** `feat/v2-rebuild` · **Estado:** cerrada (sin tocar `main`, sin push)
**Entradas:** `arquitectura-centinela-v2.md` (§5.2, §5.3, §8.6), `seguridad-centinela-v2.md`, `diseno-centinela-v2.md`.

---

## 1. Qué se ha hecho

1. **Fuera los `onclick` en línea.** Retirados los 2 manejadores inline de
   `index.html` (`#preview-dialog` y `#btn-close-preview`). El cableado ya
   existía por `addEventListener` en `js/app.js` (líneas 248-259), así que **no
   se duplicó** ni se perdió funcionalidad: cerrar el diálogo por botón y por
   clic en el fondo sigue igual.
2. **Estilos inline fuera del HTML.** Además de los `onclick`, el HTML tenía
   **7 atributos `style=`** en `index.html` y **un bloque `<style>`** en
   `manual.html` que también obligan a `'unsafe-inline'` (en `style-src`). Se
   han migrado a CSS: clases `.is-hidden`, `.info-footer`, `.manual-link`,
   `.btn-retry` en `css/styles.css`, y el nuevo `css/manual.css`. Sin esto la
   CSP estricta de §8.6 **rompía la interfaz** (los avisos de marca/X-Ray/trust
   y el botón SOS se habrían mostrado siempre).
3. **CSP estricta de Pages** en `public/_headers` (§8.6, literal, sin
   `'unsafe-inline'` en `script-src` ni `style-src`), más
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y HSTS.
4. **Worker:** ya llevaba `camera=()`; se ha dejado igual y **bloqueado con
   test** que nunca pase a `camera=(self)` (RC-01).
5. **Tests** (`tests/security/headers.test.js`, 16 aserciones): guarda de
   `on*=` y de estilos inline en todo el HTML, directivas esperadas de la CSP
   de Pages, y `camera=()` (nunca `(self)`) en el Worker.

**No se ha debilitado la CSP** en ningún punto para que algo pase.

---

## 2. La CSP resultante (literal)

`public/_headers`:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: https://s.wordpress.com; connect-src 'self' https://centinela-api.michelmacias-it.workers.dev; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), microphone=(), camera=(self)
  Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Cabeceras del Worker (`worker/src/index.js`, `SECURITY_HEADERS`, sin cambios):

```
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Cache-Control: no-store
```

**⚠ RC-01 respetado al pie de la letra:** Pages lleva `camera=(self)` (escáner
QR, HU-11) y el Worker lleva `camera=()` (solo sirve JSON). La diferencia está
comentada junto a ambas directivas y hay un test que falla si el Worker pasa a
`camera=(self)`.

---

## 3. Recursos externos (pendientes para la Tanda 5)

Lista exacta de lo que hoy carga el frontend fuera de su propio origen:

| # | Origen | Dónde | Estado |
|---|--------|-------|--------|
| 1 | `https://fonts.googleapis.com` | `index.html:20` (`<link rel=preconnect>`) y `:22` (hoja de Inter) | **Deuda T5** (RC-02) |
| 2 | `https://fonts.gstatic.com` | `index.html:21` (`<link rel=preconnect crossorigin>`) | **Deuda T5** (RC-02) |
| 3 | `https://s.wordpress.com` | `js/screens/preview.js:41` (mshots de la vista previa) | **Intencional**, ya declarado en `img-src` |
| 4 | `https://centinela-api.michelmacias-it.workers.dev` | `js/api.js:8` | **Intencional**, declarado en `connect-src` |

Notas:

- Con la CSP estricta, **el navegador bloquea la hoja de Google Fonts**
  (`style-src`/`font-src` = `'self'`). Hasta la Tanda 5 la app se renderiza con
  la **fuente de reserva del sistema**. Es el estado transitorio que la propia
  arquitectura prevé (RC-02 exige autoalojar Atkinson Hyperlegible antes de que
  la tipografía funcione bajo CSP).
- Además, los dos `<link rel=preconnect>` **no están cubiertos por CSP** (son
  *resource hints*): siguen abriendo conexión a Google y filtrando la IP del
  usuario, justo lo que RC-02 quiere eliminar. **No se han tocado** porque la
  tipografía es alcance de la Tanda 5, y **no se ha abierto la CSP** para
  taparlo.
- `sw.js:41` aún tiene reglas de *runtime caching* para los dos orígenes de
  Google; quedarán obsoletas cuando T5 los retire.

**No se ha añadido ningún origen externo a la CSP.** La hoja de Google NO se ha
permitido en `style-src` (sería el "agujero para taparlo" que el ticket prohíbe).

---

## 4. Contradicciones encontradas

- **C-1 (arquitectura subestima el obstáculo).** §8.6 afirma que los 2
  `onclick=` inline son "el único obstáculo real" a la CSP sin `'unsafe-inline'`.
  Es **inexacto**: los **7 atributos `style=`** de `index.html` y el **bloque
  `<style>`** de `manual.html` también obligan a `'unsafe-inline'` (en
  `style-src`, que desde CSP2 gobierna también los atributos `style`). §8.6
  añade "style-src no necesita 'unsafe-inline' si no se inyectan estilos por JS
  (Vite emite `<link>`)" — falso para el HTML actual. Resuelto sacando los
  estilos inline a CSS (no debilitando la CSP).
- **C-2 (placeholder inválido en `connect-src`).** §8.6 escribe la URL de
  staging como `https://centinela-api-staging.<subdominio>.workers.dev`. Ese
  token **no es un host-source válido**; un token malformado en una directiva
  puede hacer que el navegador descarte la fuente (y, según implementación, la
  directiva), lo que dejaría al frontend **sin poder llamar al Worker**.
  **Decisión:** se OMITE el marcador y se deja solo la URL real de producción;
  al conocerse el subdominio de staging (HU-35) debe añadirse su origen. Queda
  para el Orchestrator confirmar el criterio.
- **C-3 (variable CSS inexistente).** El `style="margin-top:var(--space-lg)"`
  histórico usaba `--space-lg`, que **no está definida** (existe `--sp-lg`): el
  margen nunca se aplicaba. En T3b se conserva el valor literal (margen 0) para
  no cambiar el layout; es un typo a corregir en T5.
- **C-4 (`.hidden` con `!important`).** El proyecto usa `.hidden{display:none
  !important}`, que **gana al estilo en línea del JS** y no vale para ocultados
  que el JS vuelve a mostrar. Por eso los estados iniciales usan `.is-hidden`
  (sin `!important`). Anotado para que nadie "arregle" poniendo `hidden` en esos
  elementos.

---

## 5. Evidencia real

- `npm test` → **119 pass / 0 fail** (los 103 previos + 16 de la nueva suite
  `security/headers.test.js`).
- `npm run build` → **OK** (`✓ built in 1.06s`); `dist/_headers` se copia;
  `dist/index.html` y `dist/manual.html` **sin** `<script>` ni `<style>` inline.
- **Prueba por mutación** (rojo y revertida):
  - M-A: reintroducir `onclick=` en `index.html` → suite de seguridad **falla**
    (`div[onclick]`).
  - M-B: reintroducir `style=` en `index.html` → **falla** (`button[style]`).
  - M-C: añadir `'unsafe-inline'` a `script-src` → **falla**
    (`script-src contiene 'unsafe-inline'`).
  - M-D: cambiar el Worker a `camera=(self)` → **falla** (`el Worker NO debe
    llevar camera=(self)`).
  - Todos revertidos; `git status` limpio tras el commit.
- Los propios detectores se testean a sí mismos contra HTML mutado dentro de
  `headers.test.js` (prueba por mutación codificada).

## 6. Archivos tocados

- `index.html` (sin `on*`, sin `style=`, clases nuevas)
- `manual.html` (`<style>` → `css/manual.css`)
- `css/styles.css` (`.is-hidden`, `.info-footer`, `.manual-link`, `.btn-retry`)
- `css/manual.css` (nuevo)
- `public/_headers` (nuevo)
- `tests/security/headers.test.js` (nuevo)
- `tanda-3b-informe.md` (este fichero)

`worker/src/index.js` **sin cambios** (ya cumplía §5.2 con `camera=()`).

## 7. Handoff

Listo para la **revisión cruzada de seguridad** (modelo distinto) sobre el
Worker y las cabeceras. Pendiente para Tanda 5: autoalojar la tipografía
(RC-02) y limpiar las referencias a Google Fonts en `index.html` y `sw.js`.
