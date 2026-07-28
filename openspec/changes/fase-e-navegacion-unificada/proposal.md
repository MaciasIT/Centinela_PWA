# Proposal — Navegación unificada en CentinelaPWA

## Contexto
La app tiene navegación fragmentada: rutas HTML fijas, router, scroll manual y enlaces internos dispersos.

## Objetivo
Unificar la navegación principal por router/screens y eliminar caminos redundantes sin rehacer la UI.

## Alcance
- Usar solo `router.navigate()` para cambiar entre `main`, `stats`, `result`, `scanner`.
- Mantener los botones de la barra inferior y los eventos actuales.
- No agregar rutas externas ni deep links nuevos.

## Criterios de cierre
- No quedan saltos directos a `#screen-*` desde JS ni HTML.
- Las pantallas se activan exclusivamente por router/screen activo.
- `npm test` verde y `npm run build` verde.
- Validación OpenSpec del change verde.
