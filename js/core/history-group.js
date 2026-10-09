/**
 * Centinela — Agrupación del historial por día en lenguaje natural (HU-25 AC-01)
 *
 * Funciones PURAS: reciben `now` como parámetro para poder testarlas sin
 * depender del reloj real. La pantalla de Historial solo pinta lo que aquí se
 * decide; ninguna regla de fechas vive en el marcado.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Inicio del día natural (00:00 local) de una fecha. */
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Clave local YYYY-M-D (no UTC, para no descolocar grupos cerca de medianoche). */
function dayKey(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Etiqueta en lenguaje natural para una fecha respecto a «ahora»:
 * «Hoy», «Ayer», «Hace N días» (2..6) y, a partir de 7 días, la fecha corta.
 *
 * @param {string|number|Date} date
 * @param {Date} [now]
 * @returns {string}
 */
export function relativeDayLabel(date, now = new Date()) {
  const target = startOfDay(date);
  const today = startOfDay(now);
  const diffDays = Math.round((today.getTime() - target.getTime()) / DAY_MS);

  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Agrupa entradas (con campo `date`) por día natural, conservando el orden de
 * entrada. Las entradas nuevas van primero (unshift), así que el grupo más
 * reciente («Hoy») sale arriba.
 *
 * @param {Array<{date: string}>} items
 * @param {Date} [now]
 * @returns {Array<{key: string, label: string, items: Array}>}
 */
export function groupHistoryByDay(items, now = new Date()) {
  const groups = [];
  const index = new Map();

  for (const item of items || []) {
    const key = dayKey(item.date);
    let group = index.get(key);
    if (!group) {
      group = { key, label: relativeDayLabel(item.date, now), items: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}
