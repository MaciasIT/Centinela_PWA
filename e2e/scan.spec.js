import { test, expect } from '@playwright/test';

test.describe('Flujo E2E: Análisis de Enlaces y Veredicto', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('muestra la pantalla inicial con elementos accesibles', async ({ page }) => {
    await expect(page).toHaveTitle(/Centinela/i);
    const main = page.locator('#main-content');
    await expect(main).toBeVisible();

    const inputUrl = page.locator('#input-url');
    await expect(inputUrl).toBeVisible();
    await expect(inputUrl).toHaveAttribute('placeholder', /pega o escribe/i);

    const btnAnalizar = page.locator('#btn-analizar');
    await expect(btnAnalizar).toBeVisible();
  });

  test('analiza una URL segura y muestra el veredicto correspondiente', async ({ page }) => {
    // Mock de la llamada al Worker para análisis seguro
    await page.route('**/scan', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://example.org',
          domain: 'example.org',
          veredicto: 'seguro',
          score: 0,
          stats: { malicious: 0, suspicious: 0, harmless: 90, undetected: 5 },
          cached: false,
        }),
      });
    });

    await page.fill('#input-url', 'https://example.org');
    await page.click('#btn-analizar');

    // Debe navegar a pantalla de resultado
    const screenResult = page.locator('#screen-result');
    await expect(screenResult).toHaveClass(/active/, { timeout: 10000 });

    const resultBadge = page.locator('#result-badge');
    await expect(resultBadge).toBeVisible();
    await expect(resultBadge).toContainText(/SEGURO/i);

    // Botón para volver a inicio
    await page.click('#btn-volver-result');
    const screenHome = page.locator('#screen-home');
    await expect(screenHome).toHaveClass(/active/);
  });

  test('analiza una URL maliciosa y muestra advertencia de peligro', async ({ page }) => {
    await page.route('**/scan', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'http://malicious-phishing-site.test',
          domain: 'malicious-phishing-site.test',
          veredicto: 'peligro',
          score: 85,
          stats: { malicious: 15, suspicious: 5, harmless: 0, undetected: 10 },
          cached: false,
        }),
      });
    });

    await page.fill('#input-url', 'http://malicious-phishing-site.test');
    await page.click('#btn-analizar');

    const screenResult = page.locator('#screen-result');
    await expect(screenResult).toHaveClass(/active/, { timeout: 10000 });

    const resultBadge = page.locator('#result-badge');
    await expect(resultBadge).toContainText(/PELIGRO/i);
  });
});
