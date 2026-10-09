/**
 * Centinela — Cableado único del resultado de un escaneo (HU-02)
 *
 * Este módulo es el ÚNICO punto donde se encadena:
 *   clasificar (core/verdict.js) → guardar en historial → registrar en estadísticas.
 *
 * `app.js` lo usa en `analyzeCurrentUrl()` y el test de contrato lo ejercita
 * directamente. Así una divergencia en el cableado real (el fallo F-4: pantalla
 * dice «Dudoso» pero historial/estadísticas dicen «Seguro») hace fallar la suite
 * en vez de pasar en verde, y ningún refactor futuro puede reabrirla en silencio.
 */
import { classify } from './verdict.js';
import { addToHistory } from '../history.js';
import { recordScan } from '../stats.js';

/**
 * Clasifica un resultado, lo guarda en el historial y lo cuenta en estadísticas
 * con el MISMO veredicto en los tres sitios (HU-02, cierra F-4).
 *
 * Historial y estadísticas cuentan lo mismo (H-2): `addToHistory` descarta un
 * reescaneo duplicado de la misma URL en menos de 5 min (devuelve `null`), y en
 * ese caso las estadísticas tampoco lo cuentan. Los contadores derivan siempre
 * del veredicto guardado, nunca de un recuento paralelo.
 *
 * @param {string} url - URL normalizada que se está comprobando.
 * @param {{positives?:number, malicious?:number, suspicious?:number, total?:number}} result
 * @returns {'safe'|'warning'|'danger'} el veredicto único.
 */
export function recordScanOutcome(url, result) {
  const verdict = classify(result);
  const entry = addToHistory(url, result);
  if (entry) recordScan(url, verdict);
  return verdict;
}
