#!/usr/bin/env node
/**
 * Centinela — Gate de CI: los bindings DEBEN llegar al despliegue.
 *
 * Por qué existe (hallazgo RC-05 / A1):
 *   Con wrangler 3, el binding `[[ratelimits]]` se descarta EN SILENCIO: el
 *   deploy termina «bien» con un simple aviso («Unexpected fields found in
 *   top-level field: "ratelimits"» · «No bindings found») y el Worker queda
 *   SIN rate limiting. Es el mismo patrón de fallo de la v1: un control que
 *   parece configurado y no existe.
 *
 * Qué hace:
 *   Ejecuta `wrangler deploy --dry-run` (no despliega nada) y LEE LA SALIDA.
 *   Si el binding de rate limiting o la clase del Durable Object `QuotaGuard`
 *   no aparecen declarados, el proceso sale con código 1 y el pipeline FALLA.
 *
 * Prueba por mutación: quita [[ratelimits]] de wrangler.toml, ejecuta este
 * script y observa el rojo. Reviértelo después.
 *
 * Uso: node scripts/check-bindings.mjs
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const workerDir = join(here, '..');

/** Bindings/recursos que deben aparecer en la salida de wrangler. */
const REQUIRED = [
  { label: 'binding de rate limiting', patterns: [/SCAN_RATE_LIMITER/, /Rate Limit/] },
  { label: 'Durable Object QuotaGuard', patterns: [/QUOTA_GUARD/, /QuotaGuard/] },
];

function fail(message) {
  console.error(`\n✗ GATE DE BINDINGS: ${message}\n`);
  process.exit(1);
}

console.log('· Ejecutando `wrangler deploy --dry-run` (no despliega nada)…');

const result = spawnSync('npx', ['wrangler', 'deploy', '--dry-run'], {
  cwd: workerDir,
  encoding: 'utf8',
  env: { ...process.env, CI: '1' },
});

const output = `${result.stdout || ''}\n${result.stderr || ''}`;

if (result.error) fail(`no se pudo ejecutar wrangler: ${result.error.message}`);
if (result.status !== 0) {
  console.error(output);
  fail(`el despliegue en seco falló (código ${result.status})`);
}

console.log(output.trimEnd());

for (const { label, patterns } of REQUIRED) {
  for (const pattern of patterns) {
    if (!pattern.test(output)) {
      fail(
        `no aparece «${label}» en la salida del despliegue en seco ` +
        `(patrón exigido: ${pattern}). ` +
        `Un deploy sin este control es un control inexistente: revisa ` +
        `wrangler.toml y que wrangler sea >= 4.`
      );
    }
  }
}

console.log('\n✓ GATE DE BINDINGS: el binding de rate limiting y el Durable Object QuotaGuard llegan al despliegue.\n');
process.exit(0);