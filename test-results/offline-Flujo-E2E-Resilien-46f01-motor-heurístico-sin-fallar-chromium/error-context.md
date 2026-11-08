# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: offline.spec.js >> Flujo E2E: Resiliencia Offline y Motor Heurístico >> analiza enlace offline activando el motor heurístico sin fallar
- Location: e2e/offline.spec.js:4:3

# Error details

```
Error: expect(locator).toHaveClass(expected) failed

Locator: locator('#screen-home')
Expected pattern: /active/
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveClass" locator('#screen-home') with timeout 5000ms
  - waiting for locator('#screen-home')

```

```yaml
- banner:
  - heading "Centinela" [level=1]
  - button "Información sobre la app":
    - img
- main:
  - img
  - text: Pega aquí el enlace sospechoso
  - textbox "Pega aquí el enlace sospechoso":
    - /placeholder: https://ejemplo.com/algo-sospechoso...
  - button "Pegar del portapapeles":
    - img
  - button "Comprobar enlace" [disabled]:
    - img
    - text: Comprobar enlace
  - text: o también puedes
  - button "Escanear QR":
    - img
    - text: Escanear QR
  - button "Subir imagen QR":
    - img
    - text: Subir imagen QR
  - text: 💡 ¿Sabías que...?
  - paragraph: Si alguien te escribe por WhatsApp diciendo que es un familiar y necesita dinero urgente, llámale por teléfono para confirmarlo.
  - heading "Últimas comprobaciones" [level=2]:
    - img
    - text: Últimas comprobaciones
  - button "Borrar historial": Borrar
  - paragraph: Aún no has comprobado ningún enlace.
- navigation "Navegación principal":
  - button "Inicio":
    - img
    - text: Inicio
  - button "Estadísticas":
    - img
    - text: Estadísticas
  - button "Historial":
    - img
    - text: Historial
  - button "Configuración":
    - img
    - text: Ajustes
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Flujo E2E: Resiliencia Offline y Motor Heurístico', () => {
  4  |   test('analiza enlace offline activando el motor heurístico sin fallar', async ({ page, context }) => {
  5  |     await page.goto('/');
> 6  |     await expect(page.locator('#screen-home')).toHaveClass(/active/);
     |                                                ^ Error: expect(locator).toHaveClass(expected) failed
  7  | 
  8  |     // Desconectar navegador (simular corte total de red)
  9  |     await context.setOffline(true);
  10 | 
  11 |     // Introducir URL sospechosa conocida por la heurística offline
  12 |     await page.fill('#input-url', 'http://192.168.1.1/banco-login/verificar-cuenta');
  13 |     await page.click('#btn-analizar');
  14 | 
  15 |     // La PWA debe navegar a resultado evaluado por motor offline
  16 |     const screenResult = page.locator('#screen-result');
  17 |     await expect(screenResult).toHaveClass(/active/, { timeout: 10000 });
  18 | 
  19 |     const resultBadge = page.locator('#result-badge');
  20 |     await expect(resultBadge).toBeVisible();
  21 | 
  22 |     // Verificar que el veredicto contiene información evaluada
  23 |     const resultVeredicto = page.locator('#result-veredicto');
  24 |     await expect(resultVeredicto).toBeVisible();
  25 |     const textoVeredicto = await resultVeredicto.textContent();
  26 |     expect(textoVeredicto.length).toBeGreaterThan(5);
  27 | 
  28 |     // Restaurar conexión para limpieza
  29 |     await context.setOffline(false);
  30 |   });
  31 | 
  32 |   test('registra y mantiene el Service Worker activo', async ({ page }) => {
  33 |     await page.goto('/');
  34 |     // Esperar registro de SW
  35 |     const hasSW = await page.evaluate(async () => {
  36 |       if (!('serviceWorker' in navigator)) return false;
  37 |       const reg = await navigator.serviceWorker.getRegistration();
  38 |       return reg !== undefined;
  39 |     });
  40 |     // En modo preview de producción el sw de vite-plugin-pwa se inicializa
  41 |     expect(typeof hasSW).toBe('boolean');
  42 |   });
  43 | });
  44 | 
```