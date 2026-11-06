/**
 * Centinela — Motor Heurístico de Reputación Local (Offline)
 * Evaluación instantánea en cliente sin llamadas de red.
 *
 * Analiza:
 * 1. TLDs de alto riesgo (.xyz, .top, .click, .download, .link, .zip, .mov, etc.)
 * 2. Entropía de Shannon del nombre de dominio (detección de DGA / dominios aleatorios)
 * 3. Caracteres punycode y homógrafos (prefijo xn--)
 * 4. Subdominios anidados excesivos (> 3 niveles)
 * 5. Credenciales incrustadas en URL (user:pass@host)
 * 6. IP literal en URL
 */

import { isIpLiteral, withDefaultScheme } from './validation.js';

export const HIGH_RISK_TLDS = Object.freeze(new Set([
  '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click',
  '.download', '.link', '.work', '.zip', '.mov', '.surf', '.monster',
  '.bid', '.party', '.trade', '.racing'
]));

/**
 * Calcula la entropía de Shannon de una cadena de texto.
 * @param {string} str
 * @returns {number}
 */
export function calculateShannonEntropy(str) {
  if (!str) return 0;
  const freq = {};
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    freq[c] = (freq[c] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const c in freq) {
    const p = freq[c] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Evalúa heurísticamente una URL de forma 100% offline.
 * @param {string} rawUrl
 * @returns {{ score: number, classification: 'safe' | 'warning' | 'danger', reasons: string[], isOfflineAnalysis: true }}
 */
export function evaluateOfflineReputation(rawUrl) {
  const prepared = withDefaultScheme(rawUrl);
  let parsed;
  try {
    parsed = new URL(prepared);
  } catch {
    return {
      score: 0,
      classification: 'danger',
      reasons: ['URL con sintaxis inválida'],
      isOfflineAnalysis: true,
    };
  }

  const reasons = [];
  let score = 85; // Base inicial neutra/favorable

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

  // 1. Detección de credenciales incrustadas (patrón clásico de phishing)
  if (parsed.username || parsed.password) {
    score -= 40;
    reasons.push('Contiene credenciales de usuario incrustadas en la URL');
  }

  // 2. Host como dirección IP literal
  if (isIpLiteral(hostname)) {
    score -= 30;
    reasons.push('El enlace apunta a una dirección IP directa en vez de un dominio');
  }

  // 3. TLDs de alto riesgo
  const parts = hostname.split('.');
  const tld = '.' + (parts[parts.length - 1] || '');
  if (HIGH_RISK_TLDS.has(tld)) {
    score -= 25;
    reasons.push(`Dominio con extensión de alto riesgo (${tld})`);
  }

  // 4. Ataques Homográficos y Punycode
  if (hostname.includes('xn--')) {
    score -= 30;
    reasons.push('Usa caracteres internacionales o Punycode (posible suplantación visual)');
  }

  // 5. Profundidad excesiva de subdominios (ej. login.banco.seguro.verificar.attacker.com)
  if (parts.length > 4) {
    score -= 20;
    reasons.push(`Estructura sospechosa con demasiados subdominios (${parts.length - 2} niveles)`);
  }

  // 6. Entropía de Shannon (nombres generados por algoritmo DGA)
  const nameWithoutTld = parts.slice(0, -1).join('');
  const entropy = calculateShannonEntropy(nameWithoutTld);
  if (entropy > 4.2 && nameWithoutTld.length > 10) {
    score -= 20;
    reasons.push('Nombre de dominio con alta aleatoriedad (posible dominio DGA)');
  }

  // 7. Longitud de nombre excesiva
  if (nameWithoutTld.length > 35) {
    score -= 10;
    reasons.push('Longitud del dominio inusualmente larga');
  }

  score = Math.max(0, Math.min(100, score));

  let classification = 'safe';
  if (score < 50) {
    classification = 'danger';
  } else if (score < 75) {
    classification = 'warning';
  }

  return {
    score,
    classification,
    reasons,
    isOfflineAnalysis: true,
  };
}
