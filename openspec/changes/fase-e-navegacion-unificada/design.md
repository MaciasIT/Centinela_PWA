# Design — Navegación unificada en CentinelaPWA

## Decisiones
- Mantener `router.js` como entrada única de navegación.
- Declarar `showScreen()` como helper de compatibilidad, no deprecated ni eliminado.
- No modificar la estructura de `index.html` salvo para eliminar enlaces redundantes.

## Consideraciones
- El flujo de QR, historial y estadísticas ya usa router/screens; se limpian los caminos restantes.
- Se prioriza estabilidad sobre reescritura.
