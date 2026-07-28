# accesibilidad Specification

## Purpose
TBD - created by archiving change fase-e-accesibilidad. Update Purpose after archive.
## Requirements
### Requirement: Accesibilidad controlada sin dependencias nuevas

El sistema SHALL eliminar salidas sordas, extender cierre por Escape a pantalla scanner y declarar `aria-live` en acciones principales sin agregar librerías externas.

#### Scenario: No hay alert() ni salidas sordas en producción
Dado el código productivo de `js/`, `index.html` y `css/`
Cuando se busquen usos de `alert(` u otros manejadores sordos
Entonces se encuentra `0` coincidencias en `js/`, `index.html` y `css/`.

#### Scenario: Escape cierra scanner y diálogos, o no hace nada sin diálogo
Dado que el usuario está en la pantalla scanner o con un diálogo abierto
Cuando presiona Escape
Entonces la app navega a `main` si estaba escaneando, o cierra el diálogo correspondiente si había uno abierto; si no hay scanner ni diálogo, no cambia de pantalla ni muestra error.

#### Scenario: aria-live cubre acciones principales
Dado el flujo principal o un error de usuario
Cuando se muestra toast, error, carga, resultado o historial actualizado
Entonces el usuario recibe anuncio accesible desde `aria-live`; si había foco, este no salta sin control o queda apuntando a un elemento con `aria-live`.

