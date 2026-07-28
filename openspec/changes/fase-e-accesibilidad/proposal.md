# Proposal — Accesibilidad controlada en CentinelaPWA

## Contexto
La app funciona en producción, pero todavía hay mejora de accesibilidad sin reescribir la UI.

## Objetivo
Resolver accesibilidad con cambios pequeños, medibles y sin features nuevas.

## Alcance
- Eliminar cualquier `alert()` o salto sordo.
- Asegurar cierre de diálogos por Escape y anti-click-outside ya existentes.
- Añadir `aria-live` en acciones principales y estados de error/carga.
- Validar con suite actual; no introducir ramas de diseño ni dependencias.

## Criterios de cierre
- No queda `alert()` en producción.
- Escape cierra info/preview/error; fuera de diálogo también limpia estado.
- `aria-live` cubre acciones principales: escaneo, error, carga, historial.
- `npm test` verde y `npm run build` verde.
- Validación OpenSpec del change verde.
