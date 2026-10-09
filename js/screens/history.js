/**
 * Centinela — Pantalla Historial
 * Lee el historial actual desde el módulo de historial y muestra:
 * - filtros: Todos / Seguros / Sospechosos / Peligrosos
 * - tarjetas de escaneo con fecha relativa, dominio y estado
 * - acción de borrado completo
 */

import { getHistory, clearHistory as removeHistory, extractDomain } from '../history.js';
import { verdictInfo } from '../core/verdict.js';
import { groupHistoryByDay } from '../core/history-group.js';
import { verdictShapeSvg } from './verdict-shape.js';

/**
 * Acción de «volver a comprobar» (HU-25 AC-03). La pantalla no reimplementa el
 * análisis: solo avisa a quien la montó (app.js) con la URL pulsada.
 * @type {((url: string) => void) | null}
 */
let recheckHandler = null;

/** Registra el manejador único de re-comprobación (lo cablea app.js). */
export function setRecheckHandler(fn) {
  recheckHandler = typeof fn === 'function' ? fn : null;
}

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'safe', label: verdictInfo('safe').plural },
  { key: 'warning', label: verdictInfo('warning').plural },
  { key: 'danger', label: verdictInfo('danger').plural },
  { key: 'unchecked', label: verdictInfo('unchecked').plural },
];

export function mount(container) {
  if (!container) return;
  container.innerHTML = historyMarkup();

  const list = container.querySelector('.history-list');
  const activeFilter = container.querySelector('.history-filter.active')?.dataset.filter || 'all';
  renderList(list, activeFilter);

  container.querySelectorAll('.history-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.history-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      renderList(list, filter);
    });
  });

  const clearBtn = container.querySelector('#btn-clear-history-screen');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const ok = typeof confirm === 'function' ? confirm('¿Borrar todo el historial?') : true;
      if (!ok) return;
      removeHistory();
      renderList(list, 'all');
      container.querySelectorAll('.history-filter').forEach((b) => b.classList.remove('active'));
      const allBtn = container.querySelector('.history-filter[data-filter="all"]');
      if (allBtn) allBtn.classList.add('active');
    });
  }
}

export function unmount() {
  // no-op
}

function historyMarkup() {
  return `
    <div class="history-screen">
      <div class="history-header">
        <h2>Historial</h2>
        <div class="history-filters">
          ${FILTERS.map((f) => `<button class="history-filter${f.key === 'all' ? ' active' : ''}" data-filter="${f.key}" type="button">${f.label}</button>`).join('')}
        </div>
      </div>
      <div class="history-list" role="list"></div>
      <div class="history-footer">
        <button id="btn-clear-history-screen" class="btn btn-secondary btn-full" type="button">Borrar historial</button>
      </div>
    </div>
  `;
}

function renderList(listEl, filter) {
  if (!listEl) return;
  const items = getHistory();
  const filtered = items.filter((entry) => {
    if (filter === 'all') return true;
    return entry.status === filter;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<p class="history-empty">No hay escaneos que mostrar.</p>`;
    return;
  }

  // HU-25 AC-01: agrupadas por día en lenguaje natural («Hoy», «Ayer», «Hace 3 días»).
  const groups = groupHistoryByDay(filtered);
  listEl.innerHTML = groups
    .map(
      (group) => `
    <div class="history-group">
      <h3 class="history-group-title">${group.label}</h3>
      ${group.items.map((entry) => historyCard(entry)).join('')}
    </div>`
    )
    .join('');

  bindRecheck(listEl);
}

/** HU-25 AC-03: cada entrada permite volver a comprobar su enlace. */
function bindRecheck(listEl) {
  listEl.querySelectorAll('.history-card').forEach((card) => {
    const run = () => {
      if (!recheckHandler) return;
      const url = decodeURIComponent(card.dataset.url || '');
      if (url) recheckHandler(url);
    };
    card.addEventListener('click', run);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        run();
      }
    });
  });
}

function historyCard(entry) {
  const domain = extractDomain(entry.url);
  const label = statusLabel(entry.status);
  const timeAgo = new Date(entry.date).toLocaleString('es-ES');
  const safePreview = entry.url.length > 120 ? entry.url.slice(0, 120) + '...' : entry.url;

  return `
    <div class="history-card" role="button" tabindex="0" data-url="${encodeURIComponent(entry.url)}" title="Volver a comprobar">
      <div class="history-card-row history-card-top">
        <span class="history-domain" title="${domain}">${domain}</span>
        <span class="history-badge ${entry.status}">${verdictShapeSvg(entry.status, { size: 18 })}<span class="history-badge-text">${label}</span></span>
      </div>
      <div class="history-card-row history-card-meta">
        <span class="history-url" title="${entry.url}">${safePreview}</span>
        <span class="history-time">${timeAgo}</span>
      </div>
    </div>
  `;
}

function statusLabel(status) {
  return verdictInfo(status).label;
}
