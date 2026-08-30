# 🛡️ Centinela PWA — Plan de Mejoras v2.4

**Fecha:** 2026-08-30
**Repo:** MaciasIT/Centinela_PWA
**Estado actual:** Fases 1-4 completadas, main en producción

---

## ✅ COMPLETADO (no tocar)

| # | Acción | Commit/Referencia |
|---|--------|-------------------|
| C1 | Fusión evolution2.0 → main (Vite + PWA) | e0cfa53 |
| C2 | B1: brandDetail en DOM | 35ff07c |
| C3 | B2: store.js + tests | eb56e7c |
| C4 | B4: test runner recursivo | 21fe428 |
| C5 | SRI en Google Fonts | eb48723 |
| C6 | API multi-fuente (VT + GSB + URLScan) | 82a1705 |
| C7 | Bug vista previa (timeout + Escape + anti-doble-click) | 77f277f |
| C8 | CI GitHub Actions (test + build) | 9907133 |
| C9 | CD Cloudflare Git integration | — |
| C10 | Tests 15/15 OK | — |
| F2 | Monitorización worker + Dashboard stats | 8d5ce8f |
| F3 | Refactor UI a componentes + screens | cc5f6ae |
| F4 | Motor reputación local + `/api/local-check` | f009b38 |

---

## 🟡 FASE 5 — ACCESIBILIDAD (A11Y)
**Objetivo:** WCAG 2.1 AA
**Estimado:** 4-6h

1. Skip link al contenido principal
2. Foco visible en todos los elementos interactivos (`:focus-visible`)
3. Todos los diálogos: `aria-modal`, trampa de foco, cierre con Escape
4. Imágenes: `alt` descriptivos en iconos y logos
5. Resultados: texto alternativo al semáforo de colores (no solo color)
6. Navegación por teclado completa (Tab/Shift+Tab/Enter/Escape)
7. Contraste mínimo AA verificado (4.5:1 texto normal, 3:1 texto grande)
8. `aria-live` para anunciar cambios de estado (carga, resultado, error)
9. Reducir animaciones si `prefers-reduced-motion`

**Archivos a tocar:** `index.html`, `css/styles.css`, `js/components/*`, `js/screens/*`
**Agente:** Dev
**Dependencia:** F4 completada ✅

---

## 🔴 FASE 6 — MODO ÁNGEL Y COMPARTIR
**Objetivo:** Mejorar la función SOS existente y añadir historial compartido.
**Estimado:** 6-8h

1. **Historial compartido con experto:**
   - Opción "Compartir con mi experto" en cada resultado
   - Token único para ver solo ese análisis
   - No requiere cuenta, solo WhatsApp/email
2. **Notificaciones push:**
   - Aviso cuando un enlace compartido por la familia es peligroso
   - Recordatorio semanal "¿Has analizado tus enlaces esta semana?"
3. **Widget "Centinela familiar":**
   - Dashboard que muestra actividad de miembros de la familia (opt-in)
   - Solo metadatos (no URLs), enfoque en seguridad

**Archivos a tocar:** `js/share.js`, `js/store.js`, `worker/src/index.js` (nuevo endpoint share), `sw.js`
**Agente:** Dev
**Dependencia:** F5 completada

---

## ⚪ EXTRAS (evaluar después de Fase 6)

| # | Idea | Esfuerzo |
|---|------|----------|
| E1 | Bot de Telegram (@CentinelaBot) | 4-6h |
| E2 | Extensión Chrome/Firefox | 8-12h |
| E3 | Empaquetar app nativa (Tauri/Capacitor) | 6-8h |
| E4 | Escaneo de email (pegar .eml y extraer enlaces) | 3-4h |
| E5 | Modo offline: heurísticas sin backend | 2-3h |
| E6 | "Modo Abuela": UI simplificada con voz | 8-12h |
| E7 | Mapa del fraude en tiempo real | 12-16h |
| E8 | Freemium + API pública | 20-30h |

---

## 📋 ORDEN DE EJECUCIÓN RECOMENDADO

```
F5 (accesibilidad)               → 4-6h
F6 (modo ángel + compartir)      → 6-8h
```

**Total estimado restante:** 10-14 horas de trabajo

---

## 🚦 Reglas para el Dev

1. Cada fase en su propia rama: `feature/f5-accesibilidad`, `feature/f6-modo-angel`
2. PR contra `main` con el plan de la fase en la descripción
3. Tests deben pasar antes de merge
4. Deploy automático al hacer merge a `main`
5. Si una fase dura >2h, commit intermedio con checkpoint

---

*Plan generado por Orchestrator (Hermes Agent) — 2026-08-30*
