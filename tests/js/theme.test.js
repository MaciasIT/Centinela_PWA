/**
 * Tanda 5a — Lógica del tema (Claro / Oscuro / Sistema).
 *
 * Prueba la parte pura y determinista de `js/core/theme.js`: resolución de la
 * preferencia, normalización, persistencia en localStorage y aplicación al DOM
 * (data-theme + <meta name="theme-color">). Sin navegador.
 */
import {
  THEME_STORAGE_KEY,
  THEME_COLORS,
  normalizePreference,
  resolveTheme,
  getStoredPreference,
  setStoredPreference,
  applyTheme,
} from '../../js/core/theme.js';

function makeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
}

function makeEnv({ preference, systemDark = false } = {}) {
  const attrs = {};
  const meta = { content: null, setAttribute(name, value) { if (name === 'content') this.content = value; } };
  const root = { setAttribute(name, value) { attrs[name] = value; } };
  const doc = {
    documentElement: root,
    querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? meta : null),
  };
  const win = { matchMedia: () => ({ matches: systemDark }) };
  return { env: { document: doc, window: win, storage: makeStorage(preference ? { [THEME_STORAGE_KEY]: preference } : {}) }, attrs, meta };
}

const results = [];
const ok = (name, fn) => {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
};

ok('normalizePreference acepta light/dark/system y cae a system', () => {
  if (normalizePreference('light') !== 'light') throw new Error('light');
  if (normalizePreference('dark') !== 'dark') throw new Error('dark');
  if (normalizePreference('system') !== 'system') throw new Error('system');
  if (normalizePreference('naranja') !== 'system') throw new Error('debe caer a system');
  if (normalizePreference(null) !== 'system') throw new Error('null debe caer a system');
});

ok('resolveTheme respeta la preferencia explícita', () => {
  if (resolveTheme('light', true) !== 'light') throw new Error('light debe ganar al sistema');
  if (resolveTheme('dark', false) !== 'dark') throw new Error('dark debe ganar al sistema');
});

ok('resolveTheme sigue al sistema cuando la preferencia es «system»', () => {
  if (resolveTheme('system', true) !== 'dark') throw new Error('system+oscuro => dark');
  if (resolveTheme('system', false) !== 'light') throw new Error('system+claro => light');
});

ok('getStoredPreference por defecto es «system»', () => {
  if (getStoredPreference(makeStorage()) !== 'system') throw new Error('por defecto debe ser system');
});

ok('getStoredPreference lee el valor guardado', () => {
  if (getStoredPreference(makeStorage({ [THEME_STORAGE_KEY]: 'dark' })) !== 'dark') throw new Error('debe leer dark');
});

ok('setStoredPreference persiste la preferencia', () => {
  const s = makeStorage();
  setStoredPreference('dark', s);
  if (s.getItem(THEME_STORAGE_KEY) !== 'dark') throw new Error('no persistió dark');
});

ok('applyTheme escribe data-theme y el theme-color en tema claro', () => {
  const { env, attrs, meta } = makeEnv({ preference: 'light' });
  const resolved = applyTheme('light', env);
  if (resolved !== 'light') throw new Error('resolved ' + resolved);
  if (attrs['data-theme'] !== 'light') throw new Error('data-theme ' + attrs['data-theme']);
  if (meta.content !== THEME_COLORS.light) throw new Error('theme-color ' + meta.content);
});

ok('applyTheme escribe data-theme y el theme-color en tema oscuro', () => {
  const { env, attrs, meta } = makeEnv({ preference: 'dark' });
  applyTheme('dark', env);
  if (attrs['data-theme'] !== 'dark') throw new Error('data-theme ' + attrs['data-theme']);
  if (meta.content !== THEME_COLORS.dark) throw new Error('theme-color ' + meta.content);
});

ok('applyTheme con «system» sigue al sistema operativo', () => {
  const { env, attrs } = makeEnv({ systemDark: true });
  applyTheme('system', env);
  if (attrs['data-theme'] !== 'dark') throw new Error('system oscuro => dark, fue ' + attrs['data-theme']);
});

ok('THEME_COLORS.light y .dark son colores hex distintos', () => {
  if (!/^#[0-9a-fA-F]{6}$/.test(THEME_COLORS.light)) throw new Error('light no es hex');
  if (!/^#[0-9a-fA-F]{6}$/.test(THEME_COLORS.dark)) throw new Error('dark no es hex');
  if (THEME_COLORS.light === THEME_COLORS.dark) throw new Error('deben ser distintos');
});

export async function run() {
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    tests: results.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}
