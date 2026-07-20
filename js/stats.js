/**
 * Centinela — Módulo de Estadísticas
 * Contadores locales: total de escaneos, seguro/peligroso/sospechoso, dominios top
 */

const STATS_KEY = 'centinela_stats';

const defaults = {
  totalScans: 0,
  safeCount: 0,
  dangerousCount: 0,
  suspiciousCount: 0,
  domains: {},       // { "example.com": 5, "test.com": 2 }
  lastScanDate: null
};

function load() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* corrupt data, start fresh */ }
  return { ...defaults };
}

function save(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

/**
 * Registrar un escaneo completado.
 * @param {string} url - URL escaneada
 * @param {string} verdict - 'safe' | 'dangerous' | 'suspicious'
 * @param {string} domain - dominio extraído (opcional, se extrae si no se pasa)
 */
export function recordScan(url, verdict, domain) {
  const stats = load();
  stats.totalScans += 1;
  stats.lastScanDate = new Date().toISOString();

  if (verdict === 'safe') stats.safeCount += 1;
  else if (verdict === 'dangerous') stats.dangerousCount += 1;
  else if (verdict === 'suspicious') stats.suspiciousCount += 1;

  // Contar dominio
  let dom = domain;
  if (!dom && url) {
    try { dom = new URL(url).hostname.replace(/^www\./, ''); } catch { dom = url; }
  }
  if (dom) {
    stats.domains[dom] = (stats.domains[dom] || 0) + 1;
  }

  save(stats);
  return stats;
}

/**
 * Obtener estadísticas actuales.
 */
export function getStats() {
  return load();
}

/**
 * Obtener top N dominios más escaneados.
 */
export function getTopDomains(n = 5) {
  const stats = load();
  return Object.entries(stats.domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/**
 * Obtener porcentajes para gráfico.
 */
export function getPercentages() {
  const stats = load();
  const total = stats.safeCount + stats.dangerousCount + stats.suspiciousCount;
  if (total === 0) return { safe: 0, dangerous: 0, suspicious: 0 };
  return {
    safe: Math.round((stats.safeCount / total) * 100),
    dangerous: Math.round((stats.dangerousCount / total) * 100),
    suspicious: Math.round((stats.suspiciousCount / total) * 100)
  };
}

/**
 * Renderizar pantalla de estadísticas en un contenedor.
 * @param {HTMLElement} container
 */
export function renderStatsScreen(container) {
  const stats = getStats();
  const pct = getPercentages();
  const top = getTopDomains(5);

  const safePct = pct.safe || 0;
  const dangPct = pct.dangerous || 0;
  const suspPct = pct.suspicious || 0;

  container.innerHTML = `
    <div class="stats-screen">
      <h2 class="stats-title">📊 Tus estadísticas</h2>

      <div class="stats-cards">
        <div class="stat-card">
          <span class="stat-number">${stats.totalScans}</span>
          <span class="stat-label">Total escaneos</span>
        </div>
        <div class="stat-card stat-safe">
          <span class="stat-number">${stats.safeCount}</span>
          <span class="stat-label">Seguros</span>
        </div>
        <div class="stat-card stat-danger">
          <span class="stat-number">${stats.dangerousCount}</span>
          <span class="stat-label">Peligrosos</span>
        </div>
      </div>

      <div class="stats-bar-container">
        <h3>Distribución</h3>
        <div class="stats-bar">
          <div class="stats-bar-segment stats-bar-safe" style="width:${safePct}%" title="Seguro: ${safePct}%"></div>
          <div class="stats-bar-segment stats-bar-suspicious" style="width:${suspPct}%" title="Sospechoso: ${suspPct}%"></div>
          <div class="stats-bar-segment stats-bar-danger" style="width:${dangPct}%" title="Peligroso: ${dangPct}%"></div>
        </div>
        <div class="stats-bar-legend">
          <span>🟢 ${safePct}% seguro</span>
          <span>🟡 ${suspPct}% dudoso</span>
          <span>🔴 ${dangPct}% peligroso</span>
        </div>
      </div>

      <div class="stats-domains">
        <h3>Dominios más escaneados</h3>
        ${top.length === 0
          ? '<p class="stats-empty">Aún no has escaneado ningún enlace.</p>'
          : `<ol class="stats-domain-list">
              ${top.map(([domain, count]) =>
                `<li><span class="domain-name">${domain}</span> <span class="domain-count">${count}</span></li>`
              ).join('')}
            </ol>`
        }
      </div>

      <p class="stats-footer">
        ${stats.lastScanDate
          ? `Último escaneo: ${new Date(stats.lastScanDate).toLocaleString('es-ES')}`
          : 'No hay escaneos registrados.'}
      </p>
    </div>
  `;
}
