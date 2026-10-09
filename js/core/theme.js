/**
 * Centinela — Tema (Claro / Oscuro / Sistema).
 *
 * Lógica pura y testeable de la preferencia de tema. La parte de efecto
 * secundario (escribir en el DOM y en localStorage) es inyectable para poder
 * probarla sin navegador.
 *
 * El tema claro es el de por defecto. Cuando el usuario no ha elegido nada, se
 * respeta `prefers-color-scheme` del sistema.
 */

export const THEME_STORAGE_KEY = 'centinela-theme';

/** Color de la barra del navegador por tema (coincide con --bg-primary). */
export const THEME_COLORS = {
  light: '#FFF6EC',
  dark: '#16110C',
};

const VALID = ['light', 'dark', 'system'];

/** Devuelve una preferencia válida; cualquier cosa rara cae a «system». */
export function normalizePreference(value) {
  return VALID.includes(value) ? value : 'system';
}

/** Resuelve la preferencia efectiva a un tema concreto (light|dark). */
export function resolveTheme(preference, systemPrefersDark) {
  const pref = normalizePreference(preference);
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

/** Lee la preferencia guardada; por defecto «system». */
export function getStoredPreference(storage = globalThis.localStorage) {
  try {
    return normalizePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

/** Persiste la preferencia (tolerante a fallos de almacenamiento). */
export function setStoredPreference(preference, storage = globalThis.localStorage) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, normalizePreference(preference));
  } catch {
    /* almacenamiento no disponible (modo privado, etc.): se ignora */
  }
}

/** ¿Prefiere el sistema el modo oscuro ahora mismo? */
export function systemPrefersDark(win = globalThis.window) {
  try {
    return !!win?.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  } catch {
    return false;
  }
}

/**
 * Aplica el tema al documento: fija `data-theme` en <html> y actualiza el
 * <meta name="theme-color"> para que la barra del navegador siga al tema.
 * Devuelve el tema resuelto.
 */
export function applyTheme(preference, env = {}) {
  const doc = env.document ?? globalThis.document;
  const win = env.window ?? globalThis.window;
  const resolved = resolveTheme(preference, systemPrefersDark(win));
  try {
    doc?.documentElement?.setAttribute('data-theme', resolved);
    const meta = doc?.querySelector?.('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
  } catch {
    /* sin DOM: no hay nada que aplicar */
  }
  return resolved;
}

/** Arranque: lee la preferencia guardada y la aplica. */
export function initTheme(env = {}) {
  const storage = env.storage ?? globalThis.localStorage;
  const win = env.window ?? globalThis.window;
  const preference = getStoredPreference(storage);
  const resolved = applyTheme(preference, env);
  // Si el usuario sigue al sistema, reacciona a sus cambios en vivo.
  try {
    win?.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
      if (getStoredPreference(storage) === 'system') applyTheme('system', env);
    });
  } catch {
    /* sin matchMedia: no hay nada que escuchar */
  }
  return { preference, resolved };
}
