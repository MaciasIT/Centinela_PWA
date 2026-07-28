## ADDED Requirements

### Requirement: Formalizar OpenSpec desde Fase D

El sistema SHALL registrar en `openspec/changes/fase-e-openspec-formal/` al menos un proposal, una spec y un plan de tasks para continuar con una mejora estructurada post-D.

#### Scenario: Change validado
Dado que existe el change en disco
Cuando el usuario ejecuta `npx -y @fission-ai/openspec validate fase-e-openspec-formal --strict`
Entonces la validación devuelve un resultado válido o lista de errores accionables para corregir.

#### Scenario: Tasks ejecutables
Dado que existe `tasks.md`
Cuando el usuario revise las tareas
Entonces SHALL haber pasos atomizados, verificables y sin saltos de implementación.
