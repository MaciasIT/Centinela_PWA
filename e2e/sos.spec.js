import { test, expect } from '@playwright/test';

test.describe('Flujo E2E: Modo Guardián SOS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('navega al Modo SOS desde el botón del header y permite volver', async ({ page }) => {
    const btnSos = page.locator('#btn-sos');
    await expect(btnSos).toBeVisible();
    await btnSos.click();

    const screenSos = page.locator('#screen-sos');
    await expect(screenSos).toHaveClass(/active/);

    // Botón de regreso a inicio
    const btnVolver = page.locator('#btn-volver-sos');
    await expect(btnVolver).toBeVisible();
    await btnVolver.click();

    await expect(page.locator('#screen-home')).toHaveClass(/active/);
  });

  test('guarda la configuración de contacto y canal en almacenamiento local', async ({ page }) => {
    await page.click('#btn-sos');
    await expect(page.locator('#screen-sos')).toHaveClass(/active/);

    await page.fill('#sos-phone', '+34600112233');
    await page.selectOption('#sos-channel', 'telegram');
    await page.click('#btn-guardar-sos');

    // Comprobar persistencia en localStorage
    const saved = await page.evaluate(() => ({
      phone: localStorage.getItem('centinela_sos_phone'),
      channel: localStorage.getItem('centinela_sos_channel'),
    }));

    expect(saved.phone).toBe('+34600112233');
    expect(saved.channel).toBe('telegram');
  });
});
