# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sos.spec.js >> Flujo E2E: Modo Guardián SOS >> guarda la configuración de contacto y canal en almacenamiento local
- Location: e2e/sos.spec.js:24:3

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e4]:
      - generic [aria-hidden] [ref=e5]: 🛡️
      - heading "Centinela" [level=1] [ref=e6]
    - button "Información sobre la app" [ref=e7] [cursor=pointer]
  - main [ref=e10]:
    - generic [ref=e11]:
      - generic [ref=e12]: Pega aquí el enlace sospechoso
      - generic [ref=e16]:
        - textbox "Pega aquí el enlace sospechoso" [ref=e17]:
          - /placeholder: https://ejemplo.com/algo-sospechoso...
        - button "Pegar del portapapeles" [ref=e18] [cursor=pointer]
      - button "Comprobar enlace" [disabled] [ref=e22]
    - generic [ref=e26]: o también puedes
    - generic [ref=e28]:
      - button "Escanear QR" [ref=e29] [cursor=pointer]
      - button "Subir imagen QR" [ref=e35] [cursor=pointer]
    - generic [ref=e40]:
      - generic [ref=e41]: 💡
      - generic [ref=e42]:
        - generic [ref=e43]: ¿Sabías que...?
        - paragraph [ref=e44]: Si un amigo te envía un enlace raro sin contexto, pregúntale antes de abrirlo. Puede que le hayan hackeado.
    - generic [ref=e45]:
      - generic [ref=e46]:
        - heading "Últimas comprobaciones" [level=2] [ref=e47]
        - button "Borrar historial" [ref=e51] [cursor=pointer]: Borrar
      - paragraph [ref=e53]: Aún no has comprobado ningún enlace.
  - navigation "Navegación principal" [ref=e54]:
    - button "Inicio" [ref=e55] [cursor=pointer]
    - button "Estadísticas" [ref=e60] [cursor=pointer]
    - button "Historial" [ref=e63] [cursor=pointer]
    - button "Configuración" [ref=e68] [cursor=pointer]:
      - generic [ref=e72]: Ajustes
```