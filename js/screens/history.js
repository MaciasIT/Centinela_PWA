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
    </div>
  `;
}
