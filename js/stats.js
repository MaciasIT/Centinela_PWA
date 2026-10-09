/**
 * Centinela — Módulo de Estadísticas
 * Contadores locales alimentados por el veredicto ÚNICO (core/verdict.js).
 * Estadísticas nunca recalcula la clasificación: cuenta el veredicto recibido,
 * que es el mismo que pinta la pantalla de resultado y guarda el historial (HU-02).
 */
import { verdictInfo } from './core/verdict.js';
import { verdictShapeSvg } from './screens/verdict-shape.js';

const STATS_KEY = 'centinela_stats';

const defaults = {
  totalScans: 0,
  safeCount: 0,
  warningCount: 0,
  dangerCount: 0,
  uncheckedCount: 0,  // T2c: resultados sin datos utilizables (todas las detecciones timeout)
  domains: {},       // { "example.com": 5, "test.com": 2 }
  lastScanDate: null,
};

function load() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = { ...defaults, ...JSON.parse(raw) };
      // Migración desde los alias de la v1 (dangerous/suspicious → danger/warning).
      if (parsed.warningCount === 0 && parsed.suspiciousCount) parsed.warningCount = parsed.suspiciousCount;
      if (parsed.dangerCount === 0 && parsed.dangerousCount) parsed.dangerCount = parsed.dangerousCount;
      return parsed;
    }
  } catch { /* datos corruptos: empezar de cero */ }
  return { ...defaults };
}

function save(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

/**
 * Registrar un escaneo completado con el veredicto ÚNICO.
 * @param {string} url - URL escaneada
 * @param {'safe'|'warning'|'danger'|'unchecked'} verdict - veredicto de core/verdict.js
 * @param {string} [domain] - dominio extraído (opcional)
 */
export function recordScan(url, verdict, domain) {
  const stats = load();
  stats.totalScans += 1;
  stats.lastScanDate = new Date().toISOString();

  if (verdict === 'safe') stats.safeCount += 1;
  else if (verdict === 'danger') stats.dangerCount += 1;
  else if (verdict === 'warning') stats.warningCount += 1;
  else if (verdict === 'unchecked') stats.uncheckedCount += 1;

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

/** Obtener estadísticas actuales. */
export function getStats() {
  return load();
}

/**
 * Reiniciar las estadísticas locales (HU-26 AC-02). Usa la clave canónica del
 * módulo: ningún otro sitio manipula `centinela_stats` a mano.
 */
export function resetStats() {
  try {
    localStorage.removeItem(STATS_KEY);
  } catch {}
}

/** Obtener top N dominios más escaneados. */
export function getTopDomains(n = 5) {
  const stats = load();
  return Object.entries(stats.domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/** Porcentajes por veredicto (misma clasificación, incluye «sin comprobar»). */
export function getPercentages() {
  const stats = load();
  const total = stats.safeCount + stats.warningCount + stats.dangerCount + (stats.uncheckedCount || 0);
  if (total === 0) return { safe: 0, warning: 0, danger: 0, unchecked: 0 };
  return {
    safe: Math.round((stats.safeCount / total) * 100),
    warning: Math.round((stats.warningCount / total) * 100),
    danger: Math.round((stats.dangerCount / total) * 100),
    unchecked: Math.round(((stats.uncheckedCount || 0) / total) * 100),
  };
}

/**
 * Renderizar pantalla de estadísticas en un contenedor.
 * @param {HTMLElement} container
 */
export function renderStatsScreen(container) {
  if (!container) return;
  const stats = getStats();
  const pct = getPercentages();
  const top = getTopDomains(5);

  const safe = verdictInfo('safe');
  const warning = verdictInfo('warning');
  const danger = verdictInfo('danger');
  const unchecked = verdictInfo('unchecked');

  container.innerHTML = `
    <div class="stats-screen">
      <h2 class="stats-title">📊 Tus estadísticas</h2>

      <div class="stats-cards">
        <div class="stat-card stat-safe">
          <span class="stat-number">${stats.safeCount}</span>
          <span class="stat-label"><span class="stat-icon stat-icon-safe" aria-hidden="true">${verdictShapeSvg('safe', { size: 20 })}</span>${safe.label}</span>
        </div>
        <div class="stat-card stat-warning">
          <span class="stat-number">${stats.warningCount}</span>
          <span class="stat-label"><span class="stat-icon stat-icon-warning" aria-hidden="true">${verdictShapeSvg('warning', { size: 20 })}</span>${warning.label}</span>
        </div>
        <div class="stat-card stat-danger">
          <span class="stat-number">${stats.dangerCount}</span>
          <span class="stat-label"><span class="stat-icon stat-icon-danger" aria-hidden="true">${verdictShapeSvg('danger', { size: 20 })}</span>${danger.label}</span>
        </div>
        <div class="stat-card stat-unchecked">
          <span class="stat-number">${stats.uncheckedCount || 0}</span>
          <span class="stat-label"><span class="stat-icon stat-icon-unchecked" aria-hidden="true">${verdictShapeSvg('unchecked', { size: 20 })}</span>${unchecked.label}</span>
        </div>
      </div>

      <div class="stats-bar-container">
        <h3>Distribución</h3>
        <div class="stats-bar">
          <div class="stats-bar-segment stats-bar-safe" style="width:${pct.safe}%" title="${safe.label}: ${pct.safe}%"></div>
          <div class="stats-bar-segment stats-bar-suspicious" style="width:${pct.warning}%" title="${warning.label}: ${pct.warning}%"></div>
          <div class="stats-bar-segment stats-bar-danger" style="width:${pct.danger}%" title="${danger.label}: ${pct.danger}%"></div>
          <div class="stats-bar-segment stats-bar-unchecked" style="width:${pct.unchecked}%" title="${unchecked.label}: ${pct.unchecked}%"></div>
        </div>
        <div class="stats-bar-legend">
          <span><span class="stat-icon stat-icon-safe" aria-hidden="true">${verdictShapeSvg('safe', { size: 18 })}</span>${pct.safe}% ${safe.label.toLowerCase()}</span>
          <span><span class="stat-icon stat-icon-warning" aria-hidden="true">${verdictShapeSvg('warning', { size: 18 })}</span>${pct.warning}% ${warning.label.toLowerCase()}</span>
          <span><span class="stat-icon stat-icon-danger" aria-hidden="true">${verdictShapeSvg('danger', { size: 18 })}</span>${pct.danger}% ${danger.label.toLowerCase()}</span>
          <span><span class="stat-icon stat-icon-unchecked" aria-hidden="true">${verdictShapeSvg('unchecked', { size: 18 })}</span>${pct.unchecked}% ${unchecked.label.toLowerCase()}</span>
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
        ${stats.totalScans} comprobaciones en total.
        ${stats.lastScanDate
          ? `Último escaneo: ${new Date(stats.lastScanDate).toLocaleString('es-ES')}`
          : 'No hay escaneos registrados.'}
      </p>
    </div>
  `;
}