/**
 * Tests para el Motor de Reputación Heurística Offline (Centinela PWA)
 */
import {
  calculateShannonEntropy,
  evaluateOfflineReputation,
  HIGH_RISK_TLDS,
} from '../../js/core/reputation-offline.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

ok('reputation-offline: dominio confiable y limpio obtiene veredicto safe', () => {
  const res = evaluateOfflineReputation('https://banco.santander.es/cuentas');
  if (res.classification !== 'safe') throw new Error(`Esperado safe, obtenido ${res.classification}`);
  if (res.score < 75) throw new Error(`Score esperado >= 75, obtenido ${res.score}`);
  if (res.reasons.length !== 0) throw new Error(`No debería tener razones de sospecha: ${JSON.stringify(res.reasons)}`);
});

ok('reputation-offline: detecta TLD de alto riesgo y penaliza el score', () => {
  const res = evaluateOfflineReputation('https://promocion-gratis.xyz/reclamar');
  if (res.classification === 'safe') throw new Error('TLD de alto riesgo .xyz no debe ser safe');
  if (!res.reasons.some((r) => r.includes('.xyz'))) {
    throw new Error('Falta razón de TLD de alto riesgo');
  }
});

ok('reputation-offline: detecta caracteres Punycode / Homógrafo (xn--)', () => {
  const res = evaluateOfflineReputation('https://xn--pple-43a.com');
  if (res.classification === 'safe') throw new Error('Punycode homograph no debe ser safe');
  if (!res.reasons.some((r) => r.includes('Punycode'))) {
    throw new Error('Falta razón de Punycode');
  }
});

ok('reputation-offline: detecta credenciales incrustadas (user:pass@host)', () => {
  const res = evaluateOfflineReputation('https://admin:secreto123@sitio-trampa.com/login');
  if (res.classification !== 'danger') throw new Error(`Esperado danger por credenciales, obtenido ${res.classification}`);
  if (!res.reasons.some((r) => r.includes('credenciales'))) {
    throw new Error('Falta advertencia de credenciales incrustadas');
  }
});

ok('reputation-offline: detecta IP literal como host y clasifica warning/danger', () => {
  const res = evaluateOfflineReputation('http://192.168.1.100/banco');
  if (res.classification === 'safe') throw new Error('IP directa no debe ser safe');
  if (!res.reasons.some((r) => r.includes('IP directa'))) {
    throw new Error('Falta razón de IP directa');
  }
});

ok('reputation-offline: detecta exceso de subdominios anidados', () => {
  const res = evaluateOfflineReputation('https://seguridad.verificar.cuenta.cliente.bancoprueba.com');
  if (!res.reasons.some((r) => r.includes('subdominios'))) {
    throw new Error('Falta advertencia de subdominios excesivos');
  }
});

ok('reputation-offline: calcula entropía de Shannon correctamente', () => {
  const zeroEntropy = calculateShannonEntropy('aaaaa');
  if (zeroEntropy !== 0) throw new Error(`Entropía esperada 0 para aaaaa, obtenida ${zeroEntropy}`);
  const highEntropy = calculateShannonEntropy('xq9w7z2k4p8m1');
  if (highEntropy < 3.0) throw new Error(`Entropía esperada alta, obtenida ${highEntropy}`);
});

export async function run() {
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    tests: results.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}
