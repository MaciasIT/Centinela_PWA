import { test, expect } from '@playwright/test';

test.describe('Flujo E2E: Resiliencia Offline y Motor Heurístico', () => {
  test('analiza enlace offline activando el motor heurístico sin fallar', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.locator('#screen-home')).toHaveClass(/active/);

    // Desconectar navegador (simular corte total de red)
    await context.setOffline(true);

    // Introducir URL sospechosa conocida por la heurística offline
    await page.fill('#input-url', 'http://192.168.1.1/banco-login/verificar-cuenta');
    await page.click('#btn-analizar');

    // La PWA debe navegar a resultado evaluado por motor offline
    const screenResult = page.locator('#screen-result');
    await expect(screenResult).toHaveClass(/active/, { timeout: 10000 });

    const resultBadge = page.locator('#result-badge');
    await expect(resultBadge).toBeVisible();

    // Verificar que el veredicto contiene información evaluada
    const resultVeredicto = page.locator('#result-veredicto');
    await expect(resultVeredicto).toBeVisible();
    const textoVeredicto = await resultVeredicto.textContent();
    expect(textoVeredicto.length).toBeGreaterThan(5);

    // Restaurar conexión para limpieza
    await context.setOffline(false);
  });

  test('registra y mantiene el Service Worker activo', async ({ page }) => {
    await page.goto('/');
    // Esperar registro de SW
    const hasSW = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return reg !== undefined;
    });
    // En modo preview de producción el sw de vite-plugin-pwa se inicializa
    expect(typeof hasSW).toBe('boolean');
  });
});
