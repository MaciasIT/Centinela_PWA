/**
 * Centinela — Pantalla Historial
 * Lee el historial actual desde el módulo de historial y muestra:
 * - filtros: Todos / Seguros / Sospechosos / Peligrosos
 * - tarjetas de escaneo con fecha relativa, dominio y estado
 * - acción de borrado completo
 */

import { getHistory, clearHistory as removeHistory, extractDomain } from '../history.js';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'safe', label: 'Seguros' },
  { key: 'warning', label: 'Dudosos' },
  { key: 'danger', label: 'Peligrosos' },
];

export function mount(container) {
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

  const clearBtn = container.querySelector('#btn-clear-history');
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
  // nada que limpiar todavía; cuando haya listeners complejos se cierran aquí
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
        <button id="btn-clear-history" class="btn btn-secondary btn-full" type="button">Borrar historial</button>
      </div>
    </div>
  `;
}

function renderList(listEl, filter) {
  const items = getHistory();
  const filtered = items.filter((entry) => {
    if (filter === 'all') return true;
    return entry.status === filter;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<p class="history-empty">No hay escaneos que mostrar.</p>`;
    return;
  }

  listEl.innerHTML = filtered.map((entry) => historyCard(entry)).join('');
}

function historyCard(entry) {
  const domain = extractDomain(entry.url);
  const label = statusLabel(entry.status);
  const timeAgo = new Date(entry.date).toLocaleString('es-ES');
  const safePreview = entry.url.length > 120 ? entry.url.slice(0, 120) + '...' : entry.url;

  return `
    <div class="history-card" role="listitem">
      <div class="history-card-row history-card-top">
        <span class="history-domain" title="${domain}">${domain}</span>
        <span class="history-badge ${entry.status}">${label}</span>
      </div>
      <div class="history-card-row history-card-meta">
        <span class="history-url" title="${entry.url}">${safePreview}</span>
        <span class="history-time">${timeAgo}</span>
      </div>
    </div>
  `;
}

function statusLabel(status) {
  if (status === 'safe') return 'Seguro';
  if (status === 'warning') return 'Dudoso';
  if (status === 'danger') return 'Peligroso';
  return 'Desconocido';
}
