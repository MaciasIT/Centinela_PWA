/**
 * D-4 — ids duplicados entre el shell y la pantalla de Ajustes.
 *
 * El shell (`index.html`) tiene un botón «Borrar historial» con id
 * `btn-clear-history`. La pantalla de Ajustes renderizaba OTRO botón con el
 * MISMO id, de modo que al abrir Ajustes el documento quedaba con dos elementos
 * con el mismo id (fallo de accesibilidad: `#btn-clear-history` deja de ser
 * único). Aquí se comprueba que los ids del shell y de Ajustes son disjuntos.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = here.replace(/tests[/\\]js[/\\]$/, '');

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

function idsIn(text) {
  return [...text.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
}

ok('D-4: los ids del shell (index.html) y de Ajustes no se solapan', () => {
  const shellIds = new Set(idsIn(readFileSync(ROOT + 'index.html', 'utf-8')));
  const settingsIds = idsIn(readFileSync(ROOT + 'js/screens/settings.js', 'utf-8'));
  const collision = settingsIds.filter((id) => shellIds.has(id));
  if (collision.length) throw new Error(`ids duplicados shell/Ajustes: ${collision.join(', ')}`);
});

ok('D-4: Ajustes usa un id propio para «Borrar historial»', () => {
  const src = readFileSync(ROOT + 'js/screens/settings.js', 'utf-8');
  if (!/id="btn-clear-history-settings"/.test(src)) {
    throw new Error('Ajustes no usa un id propio (btn-clear-history-settings) para borrar historial');
  }
  if (/#btn-clear-history'\)/.test(src)) {
    throw new Error('Ajustes sigue consultando el id del shell (#btn-clear-history)');
  }
});

export function run() {
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}
