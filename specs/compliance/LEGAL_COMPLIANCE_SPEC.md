# ESPECIFICACIÓN CANÓNICA DE CUMPLIMIENTO LEGAL Y NORMATIVO (UE / ESPAÑA)
**Estándar de Fábrica para Software Comercial: RGPD, LOPD-GDD, LSSI-CE y EU AI Act**
*Ubicación canónica: ~/.hive_factory/specs/compliance/LEGAL_COMPLIANCE_SPEC.md*

---

## 1. Principio Rector de Ingeniería Legal

> **«La ley no se cumple con buenas intenciones en el prompt ni asunciones del LLM; se cumple convirtiendo los artículos normativos en especificaciones técnicas formales y tests de código deterministas que bloquean el despliegue si se incumplen.»**

Todo producto o servicio software desarrollado en la Factoría que recopile datos, almacene cookies, preste servicios de la sociedad de la información o emplee modelos de IA debe cumplir obligatoriamente esta especificación antes de superar el Quality Gate en modo `STRICT`.

---

## 2. Marco Normativo y Requisitos Técnicos Obligatorios

### BLOQUE 1: RGPD (Reglamento UE 2016/679) y LOPD-GDD (Ley Orgánica 3/2018)

1. **Minimización de Datos (Art. 5.1.c RGPD):**
   - Recopilar únicamente los campos estrictamente necesarios para prestar la funcionalidad contratada.
   - Prohibido solicitar DNI, teléfono o datos sensibles (Art. 9) salvo que sea un imperativo legal directo del negocio.
2. **Base de Legitimación y Registro de Tratamiento (RAT) (Art. 6 y 30 RGPD):**
   - Todo tratamiento debe sustentarse en: consentimiento explícito, ejecución de contrato o interés legítimo ponderado.
   - Cada proyecto debe mantener un inventario estructurado (`compliance/rat.json` o sección en la documentación) detallando finalidad, categoría de datos, colectivo y plazo de conservación.
3. **Casillas de Consentimiento Activo (Opt-In Puro) (Art. 7 RGPD):**
   - Formularios de registro o contacto: los checkboxes de aceptación de Política de Privacidad deben presentarse **desmarcados por defecto**.
   - Prohibido el consentimiento tácito o fórmulas como "al continuar navegando aceptas...".
4. **Protocolo Técnico de Derechos ARCO-POL (Art. 15-22 RGPD):**
   - **Derecho de Acceso y Portabilidad (Art. 20):** La aplicación debe proveer un mecanismo técnico (endpoint `/api/user/export` o botón de exportación) que devuelva toda la información del usuario en formato JSON estructurado, comúnmente utilizado y legible por máquina.
   - **Derecho de Supresión / Olvido (Art. 17):** Función automatizada (`/api/user/delete-account`) que anonimice irrevocablemente o elimine de bases de datos operativas y cachés todos los identificadores personales del usuario.
5. **Subencargados y Transferencias Internacionales (Art. 28 y 44-49 RGPD):**
   - Todos los proveedores de infraestructura (hosting, base de datos, envío de correos, analítica) deben tener servidores en la Unión Europea / EEE o estar certificados bajo el **EU-US Data Privacy Framework (DPF)** con Cláusulas Contractuales Tipo (SCC) firmadas.
6. **Seguridad y Cero Fugas de PII (Art. 32 RGPD):**
   - Ningún log de servidor, consola del navegador, traza de depuración o respuesta de error (4xx/5xx) puede registrar correos electrónicos, contraseñas, tokens de autenticación o DNI/NIE en texto claro.

---

### BLOQUE 2: LSSI-CE (Ley 34/2002) y Guía de Cookies de la AEPD

1. **Aviso Legal e Información General Obligatoria (Art. 10 LSSI-CE):**
   - Accesible de forma directa, permanente, fácil y gratuita desde cualquier pantalla del software (enlace visible en footer o menú principal):
     * Nombre comercial y denominación social / nombre del titular.
     * NIF / CIF válido.
     * Domicilio físico postal de la actividad.
     * Correo electrónico de contacto directo y rápido (no solo formulario).
     * Datos de inscripción registral mercantil o colegial (si aplica).
2. **Gestión de Cookies y Tecnologías de Seguimiento (Art. 22.2 LSSI-CE):**
   - Conforme a la Guía de Cookies actualizada de la AEPD:
     * **Primera Capa (Banner):** Debe ofrecer botones con idéntico impacto visual (mismo color, contraste, tamaño y accesibilidad):
       - `[Aceptar todas]`
       - `[Rechazar todas]`
       - `[Configurar cookies]`
     * **Bloqueo Técnico Previo:** Prohibido cargar scripts de Google Analytics, Tag Manager, Hotjar, Facebook Pixel o cualquier tracker externo **antes** de que el usuario pulse `[Aceptar]`.
     * Las cookies técnicas esenciales (autenticación de sesión, cesta de compra, preferencia de idioma o consentimiento previo) están exentas de bloqueo previo, pero deben declararse.
     * Duración máxima del consentimiento guardado: 24 meses.

---

### BLOQUE 3: EU AI Act (Reglamento UE 2024/1689)

1. **Obligaciones de Transparencia de Sistemas de IA (Art. 50 EU AI Act):**
   - **Interacción con personas:** Todo agente conversacional, chatbot o asistente automatizado debe avisar de forma inmediata, ostensible y clara al usuario de que está interactuando con un sistema de Inteligencia Artificial.
   - **Contenido Generado / Sintético:** Los textos, resúmenes, código o imágenes generados por IA destinados al usuario final deben incluir una indicación visual ("Generado con asistencia de IA") y metadatos legibles por máquina que declaren su origen automatizado.
2. **Supervisión Humana (Human-in-the-Loop) (Art. 14 EU AI Act):**
   - En cualquier proceso automatizado con impacto comercial, contractual o legal sobre el usuario, la aplicación debe garantizar que un operador humano pueda revisar, corregir o invalidar la decisión emitida por la IA.
3. **Prácticas Prohibidas (Art. 5 EU AI Act):**
   - Prohibido el uso de técnicas subliminales no perceptibles para distorsionar sustancialmente el comportamiento del usuario, el aprovechamiento de vulnerabilidades psicológicas o cualquier mecanismo de puntuación social no autorizado.

---

## 3. Matriz de Batería de Pruebas Legales Obligatorias (`tests/legal/`)

Todo repositorio que preste servicios comerciales o gestione datos debe incluir las siguientes suites ejecutables en su CI / Gatekeeper:

| Archivo de Prueba | Objeto de la Prueba | Criterio de Aprobación (Assert) |
| :--- | :--- | :--- |
| `cookies.test.js` | Cumplimiento AEPD / Art. 22.2 LSSI | 0 scripts externos inyectados en DOM en carga inicial; botones Rechazar/Aceptar visualmente simétricos; bloqueo estricto si no hay opt-in. |
| `lssi_notice.test.js` | Cumplimiento Art. 10 LSSI-CE | Selector visible a Aviso Legal presente en footer; campos NIF, domicilio y email presentes en el texto del aviso. |
| `data_sanitization.test.js` | Cumplimiento Art. 32 RGPD | Inyección de payloads erróneos en API/formularios no replica emails, contraseñas ni tokens en logs ni en respuestas HTTP. |
| `data_rights.test.js` | Cumplimiento Art. 17 y 20 RGPD | Rutas de exportación (JSON válido) y borrado/anonimización devuelven status 200 y eliminan PII de la persistencia. |
| `ai_transparency.test.js` | Cumplimiento Art. 50 EU AI Act | En interfaces con IA, existe aviso textual explícito informando de la naturaleza sintética/asistida del servicio. |

