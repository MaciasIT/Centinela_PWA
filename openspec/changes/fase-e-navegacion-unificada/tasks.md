## Tasks

- [ ] 1. Buscar saltos directos a vistas por `location.hash`, `#screen-*` y `showScreen(` en `js/` e `index.html`; fijar lista de hallazgos y confirmar `0` coincidencias objetivo.
- [ ] 2. Reemplazar rutas directas restantes por `router.navigate()` manteniendo flujo actual.
- [ ] 3. Centralizar el regreso desde `result` y `scanner` por router sin duplicar listeners; medir con búsqueda de `navigate(` en `js/app.js` y confirmar una única ruta por acción de regreso.
- [ ] 4. Ejecutar `npm test` y `npm run build`.
- [ ] 5. Validar OpenSpec con `npx -y @fission-ai/openspec validate fase-e-navegacion-unificada --strict`.
- [ ] 6. Commit atómico con mensaje `feat(nav): unificar navegación por router/screens` y tag de change.
