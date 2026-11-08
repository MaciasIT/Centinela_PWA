# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scan.spec.js >> Flujo E2E: Análisis de Enlaces y Veredicto >> analiza una URL maliciosa y muestra advertencia de peligro
- Location: e2e/scan.spec.js:55:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#input-url')

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
        - paragraph [ref=e44]: Los códigos QR también pueden llevar a sitios peligrosos. Siempre compruébalos.
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
  11 |     await expect(main).toBeVisible();
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
> 71 |     await page.fill('#input-url', 'http://malicious-phishing-site.test');
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
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