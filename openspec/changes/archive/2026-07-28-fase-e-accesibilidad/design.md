# Design — Accesibilidad controlada en CentinelaPWA

## Decisiones
- No agregar librerías de a11y ni refactorizar el DOM entero.
- Usar atributos nativos HTML y listeners existentes.
- Aprovechar `els.*` y helpers actuales para no dispersar la lógica.

## Consideraciones
- Escape ya cierra algunos overlays; se extiende a scanner y se limpia código muerto.
- Se añade `aria-live` VITAL en toast, error, preview, scanner y historial.
- Se conservan los textos actuales y solo se añaden atributos descriptivos.
