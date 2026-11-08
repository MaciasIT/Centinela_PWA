# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sos.spec.js >> Flujo E2E: Modo Guardián SOS >> navega al Modo SOS desde el botón del header y permite volver
- Location: e2e/sos.spec.js:8:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#btn-sos')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" locator('#btn-sos') with timeout 5000ms
  - waiting for locator('#btn-sos')
    14 × locator resolved to <button id="btn-sos" class="btn btn-warning is-hidden">…</button>
       - unexpected value "hidden"

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
  3  | test.describe('Flujo E2E: Modo Guardián SOS', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/');
  6  |   });
  7  | 
  8  |   test('navega al Modo SOS desde el botón del header y permite volver', async ({ page }) => {
  9  |     const btnSos = page.locator('#btn-sos');
> 10 |     await expect(btnSos).toBeVisible();
     |                          ^ Error: expect(locator).toBeVisible() failed
  11 |     await btnSos.click();
  12 | 
  13 |     const screenSos = page.locator('#screen-sos');
  14 |     await expect(screenSos).toHaveClass(/active/);
  15 | 
  16 |     // Botón de regreso a inicio
  17 |     const btnVolver = page.locator('#btn-volver-sos');
  18 |     await expect(btnVolver).toBeVisible();
  19 |     await btnVolver.click();
  20 | 
  21 |     await expect(page.locator('#screen-home')).toHaveClass(/active/);
  22 |   });
  23 | 
  24 |   test('guarda la configuración de contacto y canal en almacenamiento local', async ({ page }) => {
  25 |     await page.click('#btn-sos');
  26 |     await expect(page.locator('#screen-sos')).toHaveClass(/active/);
  27 | 
  28 |     await page.fill('#sos-phone', '+34600112233');
  29 |     await page.selectOption('#sos-channel', 'telegram');
  30 |     await page.click('#btn-guardar-sos');
  31 | 
  32 |     // Comprobar persistencia en localStorage
  33 |     const saved = await page.evaluate(() => ({
  34 |       phone: localStorage.getItem('centinela_sos_phone'),
  35 |       channel: localStorage.getItem('centinela_sos_channel'),
  36 |     }));
  37 | 
  38 |     expect(saved.phone).toBe('+34600112233');
  39 |     expect(saved.channel).toBe('telegram');
  40 |   });
  41 | });
  42 | 
```