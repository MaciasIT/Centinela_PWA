/**
 * Centinela — Motor de Reputación Local
 * Puntuación 0-100 basada en:
 * - edad del dominio por RDAP
 * - entropía del hostname
 * - TLDs de alto riesgo
 * - lista negra local
 *
 * Resultado: { score, classification, reasons }
 */

const HIGH_RISK_TLDS = new Set([
  '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.download', '.link', '.work'
]);

const BLACKLISTED_DOMAINS = new Set([
  // puede crecer; se consulta por hostname exacto
]);

function shannonEntropy(str) {
  let sum = 0;
  const freq = {};
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    freq[c] = (freq[c] || 0) + 1;
    sum++;
  }
  let entropy = 0;
  for (const c in freq) {
    const p = freq[c] / sum;
    entropy += -p * Math.log2(p);
  }
  return entropy;
}

async function domainAgeDays(domain) {
  try {
    const url = `https://rdap.org/domain/${domain}`;
    const resp = await fetch(url, { headers: { accept: 'application/rdap+json' } });
    if (!resp || !resp.ok) return null;
    const data = await resp.json();
    const events = data.events || [];
    const reg = events.find(e => (e.eventAction || '').toLowerCase() === 'registration');
    if (!reg?.eventDate) return null;
    const regDate = new Date(reg.eventDate);
    const ms = Date.now() - regDate.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function classifyByScore(score) {
  if (score >= 75) return 'safe';
  if (score >= 45) return 'warning';
  return 'danger';
}

export async function checkLocalReputation(targetUrl) {
  let hostname = '';
  try { hostname = new URL(targetUrl).hostname; } catch { return { score: 0, classification: 'danger', reasons: ['URL no válida'] }; }
  const cleanHost = hostname.replace(/^www\./, '');

  const reasons = [];
  let score = 80;

  // Lista negra exacta
  if (BLACKLISTED_DOMAINS.has(cleanHost)) {
    return { score: 0, classification: 'danger', reasons: ['Dominio en lista negra local'] };
  }

  // TLD
  const parts = cleanHost.split('.');
  const tld = '.' + (parts[parts.length - 1] || '');
  if (HIGH_RISK_TLDS.has(tld)) {
    score -= 25;
    reasons.push(`TLD de alto riesgo: ${tld}`);
  }

  // Entropía alta
  const ent = shannonEntropy(cleanHost);
  if (ent > 4.2) {
    score -= 15;
    reasons.push('Nombre de dominio con entropía alta');
  }

  // Longitud sospechosa
  if (cleanHost.length > 40) {
    score -= 10;
    reasons.push('Dominio muy largo');
  }

  // Edad del dominio
  const ageDays = domainAgeDays(cleanHost);
  if (ageDays === 0) {
    score -= 20;
    reasons.push('Dominio muy reciente');
  } else if (ageDays !== null && ageDays < 180) {
    score -= 12;
    reasons.push('Dominio menor de 6 meses');
  }

  score = Math.max(0, Math.min(100, score));
  return { score, classification: classifyByScore(score), reasons, ageDays };
}
