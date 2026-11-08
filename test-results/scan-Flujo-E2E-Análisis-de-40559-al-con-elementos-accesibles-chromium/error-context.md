# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scan.spec.js >> Flujo E2E: Análisis de Enlaces y Veredicto >> muestra la pantalla inicial con elementos accesibles
- Location: e2e/scan.spec.js:8:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#main-content')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('#main-content') with timeout 5000ms
  - waiting for locator('#main-content')

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
  - paragraph: Cambia tus contraseñas de vez en cuando y no uses la misma para todo.
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
  3  | test.describe('Flujo E2E: Análisis de Enlaces y Veredicto', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/');
  6  |   });
  7  | 
  8  |   test('muestra la pantalla inicial con elementos accesibles', async ({ page }) => {
  9  |     await expect(page).toHaveTitle(/Centinela/i);
  10 |     const main = page.locator('#main-content');
> 11 |     await expect(main).toBeVisible();
     |                        ^ Error: expect(locator).toBeVisible() failed
  12 | 
  13 |     const inputUrl = page.locator('#input-url');
  14 |     await expect(inputUrl).toBeVisible();
  15 |     await expect(inputUrl).toHaveAttribute('placeholder', /pega o escribe/i);
  16 | 
  17 |     const btnAnalizar = page.locator('#btn-analizar');
  18 |     await expect(btnAnalizar).toBeVisible();
  19 |   });
  20 | 
  21 |   test('analiza una URL segura y muestra el veredicto correspondiente', async ({ page }) => {
  22 |     // Mock de la llamada al Worker para análisis seguro
  23 |     await page.route('**/scan', async (route) => {
  24 |       await route.fulfill({
  25 |         status: 200,
  26 |         contentType: 'application/json',
  27 |         body: JSON.stringify({
  28 |           url: 'https://example.org',
  29 |           domain: 'example.org',
  30 |           veredicto: 'seguro',
  31 |           score: 0,
  32 |           stats: { malicious: 0, suspicious: 0, harmless: 90, undetected: 5 },
  33 |           cached: false,
  34 |         }),
  35 |       });
  36 |     });
  37 | 
  38 |     await page.fill('#input-url', 'https://example.org');
  39 |     await page.click('#btn-analizar');
  40 | 
  41 |     // Debe navegar a pantalla de resultado
  42 |     const screenResult = page.locator('#screen-result');
  43 |     await expect(screenResult).toHaveClass(/active/, { timeout: 10000 });
  44 | 
  45 |     const resultBadge = page.locator('#result-badge');
  46 |     await expect(resultBadge).toBeVisible();
  47 |     await expect(resultBadge).toContainText(/SEGURO/i);
  48 | 
  49 |     // Botón para volver a inicio
  50 |     await page.click('#btn-volver-result');
  51 |     const screenHome = page.locator('#screen-home');
  52 |     await expect(screenHome).toHaveClass(/active/);
  53 |   });
  54 | 
  55 |   test('analiza una URL maliciosa y muestra advertencia de peligro', async ({ page }) => {
  56 |     await page.route('**/scan', async (route) => {
  57 |       await route.fulfill({
  58 |         status: 200,
  59 |         contentType: 'application/json',
  60 |         body: JSON.stringify({
  61 |           url: 'http://malicious-phishing-site.test',
  62 |           domain: 'malicious-phishing-site.test',
  63 |           veredicto: 'peligro',
  64 |           score: 85,
  65 |           stats: { malicious: 15, suspicious: 5, harmless: 0, undetected: 10 },
  66 |           cached: false,
  67 |         }),
  68 |       });
  69 |     });
  70 | 
  71 |     await page.fill('#input-url', 'http://malicious-phishing-site.test');
  72 |     await page.click('#btn-analizar');
  73 | 
  74 |     const screenResult = page.locator('#screen-result');
  75 |     await expect(screenResult).toHaveClass(/active/, { timeout: 10000 });
  76 | 
  77 |     const resultBadge = page.locator('#result-badge');
  78 |     await expect(resultBadge).toContainText(/PELIGRO/i);
  79 |   });
  80 | });
  81 | 
```