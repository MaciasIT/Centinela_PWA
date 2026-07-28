# Proposal — OpenSpec formal para CentinelaPWA

## Contexto
Fases A/B/C/D ya están cerradas en `main`. Ahora necesitamos un cambio reproducible para formalizar las próximas mejoras sin volver a pasos exploratorios.

## Objetivo
Definir el primer cambio formal con proposal + spec Gherkin + tasks, y validarlo con `openspec validate`.

## Alcance
- Registrar el proceso OpenSpec para CentinelaPWA.
- Seleccionar una mejora concreta como primer change real post-D.
- Establecer criterios mínimos de calidad para futuros changes.

## Criterios de cierre
- `openspec validate fase-e-openspec-formal --strict` pasa.
- `tasks.md` tiene todas las tareas atomizadas.
- El change queda listo para `apply` cuando quieras arrancar.
