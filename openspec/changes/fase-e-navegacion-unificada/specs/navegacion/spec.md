## ADDED Requirements

### Requirement: Navegación unificada por router/screens

El sistema SHALL usar `router.navigate()` o helpers derivados para toda transición entre pantallas visibles, evitando saltos directos a vistas por ID desde eventos o enlaces internos.

#### Scenario: No hay saltos directos a pantallas desde JS ni HTML
Dado el código productivo de `js/` e `index.html`
Cuando se busquen usos de `location.hash`, `window.location` con `#screen-` o llamadas directas a `showScreen` fuera de helpers oficiales
Entonces se encuentra `0` coincidencias en producción.

#### Scenario: Navegación desde UI mantiene comportamiento actual
Dado el usuario en `main`
Cuando pulsa Escanear QR, Estadísticas, Abrir web, Compartir o Nuevo chequeo
Entonces la pantalla activa cambia solo por router/screen y el historial no presenta saltos dobles.

#### Scenario: Regreso desde resultado y scanner es estable
Dado el usuario en `result` o `scanner`
Cuando presiona Volver, cierra o Escape
Entonces regresa a `main` sin pantallas fantasma ni left listeners duplicados.
