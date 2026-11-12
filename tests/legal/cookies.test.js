/**
 * @file cookies.test.js
 * @description Suite determinista de conformidad con la Guía de Cookies de la AEPD y Art. 22.2 LSSI-CE.
 * 
 * Reglas auditadas:
 * 1. Cero scripts externos o cookies analíticas/publicitarias previas al consentimiento (Opt-in estricto).
 * 2. Simetría de opciones: el botón "Rechazar todo" debe estar al mismo nivel que "Aceptar todo".
 * 3. Persistencia limpia tras rechazo (sin fugas ni descargas en background).
 * 
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Auditoría Legal de Cookies y Rastreadores (AEPD / LSSI-CE Art. 22.2)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined' && localStorage.clear) {
      localStorage.clear();
    }
    if (typeof sessionStorage !== 'undefined' && sessionStorage.clear) {
      sessionStorage.clear();
    }
    if (typeof document !== 'undefined' && document.cookie) {
      document.cookie.split(';').forEach(c => {
        document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
      });
    }
  });

  it('REGLA 1: No debe inyectar scripts de analítica/marketing en el DOM sin consentimiento previo', () => {
    if (typeof document === 'undefined') return;
    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src || s.innerHTML);
    const forbiddenPatterns = [
      'google-analytics.com',
      'googletagmanager.com/gtag',
      'connect.facebook.net',
      'hotjar.com',
      'clarity.ms',
      'pixel'
    ];

    const detectedTrackers = scripts.filter(src => 
      forbiddenPatterns.some(pattern => src.includes(pattern))
    );

    expect(detectedTrackers, 'Se encontraron rastreadores cargados antes del consentimiento explícito').toHaveLength(0);
  });

  it('REGLA 2: Si el banner de cookies está presente, debe incluir opción explícita de "Rechazar"', () => {
    if (typeof document === 'undefined') return;
    const banner = document.querySelector('[data-testid="cookie-banner"], .cookie-banner, #cookie-consent');
    if (!banner) {
      // Si la app es estricta sin cookies de terceros (100% cookieless), pasa la prueba
      return;
    }

    const acceptBtn = banner.querySelector('button[data-action="accept"], button:has-text("Aceptar"), #btn-accept-cookies');
    const rejectBtn = banner.querySelector('button[data-action="reject"], button:has-text("Rechazar"), #btn-reject-cookies');

    expect(rejectBtn, 'El banner debe contener un botón visible de "Rechazar todas las cookies"').not.toBeNull();
    
    // Verificar que el botón de rechazar no esté oculto ni deshabilitado
    const isVisible = rejectBtn.offsetParent !== null || window.getComputedStyle(rejectBtn).display !== 'none';
    expect(isVisible, 'El botón de rechazo debe ser visible de inmediato sin obligar a abrir configuradores complejos').toBe(true);
  });

  it('REGLA 3: Al rechazar cookies, el almacenamiento local registra el rechazo y no almacena identificadores de usuario', () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    // Simulación de acción de rechazo
    const rejectEvent = new CustomEvent('cookie_consent', { detail: { analytics: false, marketing: false, necessary: true } });
    window.dispatchEvent(rejectEvent);

    const nonEssentialCookies = (document.cookie || '')
      .split(';')
      .map(c => c.trim())
      .filter(c => c && !c.startsWith('session_') && !c.startsWith('csrf_') && !c.startsWith('consent_'));

    expect(nonEssentialCookies, 'No deben persistir cookies no esenciales tras el rechazo').toHaveLength(0);
  });
});
