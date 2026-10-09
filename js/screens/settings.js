/**
 * Centinela — Pantalla Configuración
 * Ajustes locales sin backend:
 * - contacto de confianza (guardian phone)
 * - borrado de historial y estadísticas
 * - información de versión / licenses
 */

import { saveGuardianPhone, loadGuardianPhone, clearGuardianPhone } from '../screens/guardian.js';
import { clearHistory as removeHistory } from '../history.js';

// Versión única (HU-23): inyectada por Vite desde package.json (define).
/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';

export function mount(container) {
  container.innerHTML = settingsMarkup();
  bindSettings(container);
}

export function unmount() {
  // sin listeners persistentes por ahora
}

function settingsMarkup() {
  const guardianValue = loadGuardianPhone() || '';
  return `
    <div class="settings-screen">
      <h2>Configuración</h2>

      <div class="settings-section">
        <h3>👼 Modo Ángel de la Guarda</h3>
        <p class="settings-hint">Guarda un contacto para consultarle con un toque cuando algo no esté claro.</p>
        <div class="settings-row">
          <input id="setting-guardian-phone" type="tel" class="input-tiny" placeholder="Ej: 34600112233" value="${guardianValue}">
          <button id="btn-save-guardian" class="btn btn-primary btn-xs" type="button">Guardar</button>
        </div>
        <p id="guardian-status" class="guardian-status"></p>
        <button id="btn-clear-guardian" class="btn btn-secondary btn-xs" type="button">Quitar contacto</button>
      </div>

      <div class="settings-section">
        <h3>🗑️ Tus datos locales</h3>
        <p class="settings-hint">El historial y las estadísticas solo se guardan en este dispositivo.</p>
        <div class="settings-actions">
          <button id="btn-clear-history" class="btn btn-secondary btn-full" type="button">Borrar historial</button>
          <button id="btn-reset-stats" class="btn btn-secondary btn-full" type="button">Reiniciar estadísticas</button>
        </div>
      </div>

      <div class="settings-section">
        <h3>ℹ️ Acerca de</h3>
        <p class="settings-hint">Centinela PWA · versión ${APP_VERSION}<br>Desarrollado por <strong>Macias IT</strong>.<br>Análisis con VirusTotal y vista previa aislada.</p>
      </div>
    </div>
  `;
}

function bindSettings(container) {
  const guardianInput = container.querySelector('#setting-guardian-phone');
  const saveGuardianBtn = container.querySelector('#btn-save-guardian');
  const clearGuardianBtn = container.querySelector('#btn-clear-guardian');
  const guardianStatus = container.querySelector('#guardian-status');
  const clearHistoryBtn = container.querySelector('#btn-clear-history');
  const resetStatsBtn = container.querySelector('#btn-reset-stats');

  if (saveGuardianBtn && guardianInput && guardianStatus) {
    saveGuardianBtn.addEventListener('click', async () => {
      const value = guardianInput.value.trim();
      if (!value) {
        guardianStatus.textContent = 'Escribe un número válido.';
        guardianStatus.className = 'guardian-status guardian-status-error';
        return;
      }
      await saveGuardianPhone(value);
      guardianStatus.textContent = 'Contacto guardado.';
      guardianStatus.className = 'guardian-status guardian-status-ok';
    });
  }

  if (clearGuardianBtn) {
    clearGuardianBtn.addEventListener('click', async () => {
      await clearGuardianPhone();
      if (guardianInput) guardianInput.value = '';
      if (guardianStatus) {
        guardianStatus.textContent = 'Contacto eliminado.';
        guardianStatus.className = 'guardian-status guardian-status-ok';
      }
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      const ok = typeof confirm === 'function' ? confirm('¿Borrar todo el historial?') : true;
      if (!ok) return;
      removeHistory();
    });
  }

  if (resetStatsBtn) {
    resetStatsBtn.addEventListener('click', () => {
      const ok = typeof confirm === 'function' ? confirm('¿Reiniciar estadísticas?') : true;
      if (!ok) return;
      try { localStorage.removeItem('centinela_stats'); } catch {}
      guardianStatus.textContent = 'Estadísticas reiniciadas.';
      guardianStatus.className = 'guardian-status guardian-status-ok';
    });
  }
}
