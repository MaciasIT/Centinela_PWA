# Brief: CentinelaPWA
## Perfiles

### Perfil primario — Usuario no técnico familiar
- **Nombre hipotético:** Ana, 42 años, madre de familia y responsable de pagos y enlaces del hogar.
- **Rol:** Usuario final sin conocimientos de ciberseguridad; usa WhatsApp, comparte enlaces y prefiere acciones simples.
- **Puntos de dolor:** recibe enlaces por WhatsApp, no sabe si son seguros, no entiende informes técnicos, quiere una acción rápida sin configuración compleja.
- **Objetivo principal:** saber en segundos si un enlace o QR es seguro y evitar estafas sin aprender terminología.
- **Anti-objetivo:** no convertirse en analista de seguridad ni leer reportes extensos.

### Perfil secundario — Usuario joven / primer acercamiento
- **Nombre hipotético:** Marcos, 19 años, estudiante; recibe enlaces de descargas, sorteos y trabajos.
- **Rol:** Usuario móvil nativo; comparte mediante el menú “Compartir” y valora velocidad sobre control manual.
- **Puntos de dolor:** enlaces acortados sospechosos, pantallas que piden datos innecesarios, escaneadores que requieren registro.
- **Objetivo principal:** verificar con menor fricción posible antes de abrir.
- **Anti-objetivo:** no quiere registro, ni publicidad intrusiva, ni proceso mayor a 3 pasos.

## Historias

### HIS-01 — Escaneo rápido de enlaces
**Como** usuario no técnico,
**quiero** pegar o compartir un enlace en Centinela,
**para** obtener una clasificación clara sin leer un informe técnico.

- **Criterios de aceptación:**
  - Entrada soportada desde pegado y “Compartir” del sistema.
  - Salida muestra semáforo: 🟢 seguro, 🟡 sospechoso, 🔴 peligroso.
  - Tiempo de respuesta visual < 5 segundos para enlaces comunes.
  - Estado vacío explicado en lenguaje sencillo.

### HIS-02 — Interpretación semáforo
**Como** usuario final,
**quiero** entender por qué un resultado está en 🟡 o 🔴,
**para** decidir si entro o no sin pedir ayuda externa.

- **Criterios de aceptación:**
  - Cada estado incluye una explicación breve, accionable y sin jerga.
  - En 🔴 se muestra advertencia destacada y comportamiento por defecto conservador.
  - En 🟡 se muestran motivos principales, no lista exhaustiva.

### HIS-03 — Vista previa sin interacción
**Como** usuario escéptico,
**quiero** ver una captura real del destino antes de confiar,
**para** confirmar si la página coincide con lo que espero.

- **Criterios de aceptación:**
  - La vista previa se presenta aislada, sin ejecutar scripts de destino.
  - Se muestra estado de carga y fallo explícito.
  - El flujo es optativo, no obligatorio para obtener el veredicto principal.

### HIS-04 — Atención a marca sospechosa
**Como** usuario expuesto a phishing bancario o de marketplace,
**quiero** que Centinela indique cuando el sitio imita una marca conocida,
**para** evitar suplantaciones aunque el dominio no sea exacto.

- **Criterios de aceptación:**
  - Detección de identidad declarada en UI como alerta diferenciada.
  - No se revelan datos confidenciales del usuario en este flujo.
  - El resultado se integra con el semáforo, no reemplaza el veredicto principal.

### HIS-05 — Detección de dominio reciente
**Como** usuario que recibe ofertas nuevas o urgentes,
**quiero** que Centinela marque dominios muy nuevos,
**para** recibir una alerta adicional ante estafas de nueva creación.

- **Criterios de aceptación:**
  - Dominios < 6 meses se marcan con indicador de confianza reducida.
  - El criterio se explica brevemente y no se oculta.
  - No bloquea automáticamente; guía la decisión.

### HIS-06 — Contacto de confianza desde la app
**Como** usuario con dudas ante un enlace extraño,
**quiero** solicitar ayuda rápida a un contacto de confianza desde Centinela,
**para** validar con alguien conocido sin abandonar la app.

- **Criterios de aceptación:**
  - El contacto se configura en app sin pasos administrativos complejos.
  - La acción usa canales nativos disponibles; fallback si no hay app destino.
  - No inicia llamadas ni comparte historial completo sin confirmación.

## Backlog

### MUST — MVP actual y próximo cierre
- Escaneo de URL/QR a través de los motores actuales.
- Semáforo 🟢🟡🔴 con explicación breve.
- Compartir enlace a Centinela desde sistema operativo.
- Soporte PWA instalable y accesos directos.
- Tamaño estimado: `M 2-4h` por item de cierre/bloqueo.

### SHOULD — Mejora esperada
- Vista previa aislada del destino final.
- Detección de suplantación de marca cuando aplique.
- Indicador de dominio reciente.
- Tamaño estimado: `M 2-4h`.

### COULD — Avanzado si hay margen
- Contacto de confianza accesible desde la app.
- Sugerencias contextuales por estado.
- Tamaño estimado: `S 1-2h` a `M 2-4h`.

### WON'T — Fuera de alcance declarado
- Registro de usuario obligatorio.
- Curaduría manual de dominios como fuente principal.
- Informe técnico extenso como flujo principal.
- Tamaño estimado: no aplica.

## MVP
### Incluido
- Entrada por pegado o share target.
- Veredicto semáforo con explicación sencilla.
- Vista previa aislada.
- Detección de identidad y antigüedad como guía adicional.
- Experiencia instalable como PWA.

### Excluido
- Cuenta personal y sincronización.
- Historial avanzado como almacenamiento obligatorio.
- Modelo marketplace o pagos integrados.

### Supuestos validados
- El público objetivo prefiere simplicidad a detalle técnico.
- La vulnerabilidad principal es phishing por enlaces compartidos.

### Supuestos por validar
- El usuario móvil entiende el semáforo sin capacitación.
- La preview y los indicadores adicionales no ralentizan la percepción de valor.

### Riesgos de producto
- Motores externos pueden cambiar disponibilidad o formato.
- Demora en preview reduce retención en flujo de primer uso.
- Mitigación inicial: estado de carga explícito y fallback a veredicto principal.

## Métricas
- **Norte:** Tasa de finalización de escaneo sin pasos extra. `Fórmula: escaneos cerrados / escaneos iniciados`. `Umbral: >= 92%`. `Periodicidad: semanal`.
- **Secundaria 1:** Tiempo hasta veredicto visual. `Fórmula: tiempo desde entrada hasta mostrado el semáforo`. `Umbral: p90 < 4s`. `Periodicidad: por release`.
- **Secundaria 2:** Uso de vista previa. `Fórmula: vistas previas iniciadas / escaneos iniciados`. `Umbral: >= 25%`. `Periodicidad: semanal`.
- **Secundaria 3:** Tasa de share target activo. `Fórmula: escaneos desde share / escaneos totales`. `Umbral: >= 30%`. `Periodicidad: mensual`.

## Resumen ejecutivo
- **Elevator pitch:** Centinela es un escáner de enlaces en formato semáforo para usuarios no técnicos, enfocado en evitar phishing sin leer informes técnicos.
- **Problema central:** la mayoría de estafas entran por WhatsApp/enlaces compartidos y las herramientas actuales exigen conocimiento previo.
- **Público objetivo:** usuarios familiares y móviles que necesitan una decisión rápida, no un análisis forense.
- **Diferenciación:** lenguaje sencillo, preview aislada, indicadores de marca y antigüedad, sin fricción de registro.

## Handoff
- **Entrada para:** `ux-engineer` para definir tokens, flujos y pantallas; `systems-architect` puede iniciarse en paralelo cuando el alcance está cerrado.
- **Pendiente:**
  - Confirmar limitaciones reales de preview y tasa de uso por capacidad del backend.
  - Definir si contacto de confianza entra antes del siguiente ciclo o queda como `COULD`.
- **Decisiones:**
  - Se asume público móvil-first sin cuenta obligatoria.
  - Se prioriza claridad sobre funcionalidades avanzadas.
  - Si los motores externos limitan SLA, se acepta degradar `SHOULD` a `COULD` previa validación técnica.
