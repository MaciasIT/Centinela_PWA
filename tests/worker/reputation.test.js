/**
 * T3c (C-4) — Motor de reputación local del Worker.
 *
 * Fija que la señal de ANTIGÜEDAD del dominio (RDAP) llega de verdad al
 * veredicto. El bug de la Tanda 3a era un `await` que faltaba:
 * `domainAgeDays()` devolvía una promesa y `ageDays` nunca se aplicaba
 * (`ageDays:{}` en la respuesta real de `/api/local-check`).
 *
 * Prueba por mutación: si se quita el `await`, el primer test cae en rojo
 * porque `ageDays` deja de ser un número.
 */
import { checkLocalReputation } from '../../worker/src/reputation.js';

const results = [];
function ok(name, fn) {
  try { fn(); results.push({ ok: true, name }); }
  catch (e) { results.push({ ok: false, name, error: String(e) }); }
}

const asyncTests = [];
function okAsync(name, fn) {
  asyncTests.push(async () => {
    try { await fn(); results.push({ ok: true, name }); }
    catch (e) { results.push({ ok: false, name, error: String(e) }); }
  });
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** Sustituye `fetch` por un RDAP simulado y devuelve las URLs consultadas. */
async function withRdap(fn, { eventDate = null, status = 200 } = {}) {
  const originalFetch = globalThis.fetch;
  const seen = { urls: [] };
  globalThis.fetch = async (input) => {
    const u = String(input);
    seen.urls.push(u);
    if (!u.startsWith('https://rdap.org/domain/')) throw new Error(`fetch inesperado: ${u}`);
    const body = { events: eventDate ? [{ eventAction: 'registration', eventDate }] : [] };
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/rdap+json' } });
  };
  try {
    return await fn(seen);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

okAsync('C-4: la antigüedad del dominio SE APLICA — dominio registrado hoy', async () => {
  await withRdap(async (seen) => {
    const r = await checkLocalReputation('https://ejemplo.com');
    assert(seen.urls.length === 1, `debe consultar RDAP una vez, fue ${seen.urls.length}`);
    assert(typeof r.ageDays === 'number', `ageDays debe ser un número (señal sin await), es ${typeof r.ageDays}`);
    assert(r.ageDays === 0, `ageDays ${r.ageDays}, esperado 0`);
    assert(r.score === 60, `score ${r.score}, esperado 60 (80 - 20 por dominio muy reciente)`);
    assert(r.reasons.some((x) => /muy reciente/i.test(x)), `falta la razón de dominio reciente: ${JSON.stringify(r.reasons)}`);
  }, { eventDate: new Date().toISOString() });
});

okAsync('C-4: dominio de 10 días → penalización «menor de 6 meses»', async () => {
  await withRdap(async () => {
    const r = await checkLocalReputation('https://ejemplo.com');
    assert(r.ageDays === 10, `ageDays ${r.ageDays}, esperado 10`);
    assert(r.score === 68, `score ${r.score}, esperado 68 (80 - 12)`);
    assert(r.reasons.some((x) => /menor de 6 meses/i.test(x)), `falta la razón: ${JSON.stringify(r.reasons)}`);
  }, { eventDate: new Date(Date.now() - 10 * 86400000).toISOString() });
});

okAsync('C-4: si RDAP no responde, NO se inventa antigüedad (ageDays null, sin penalización)', async () => {
  await withRdap(async () => {
    const r = await checkLocalReputation('https://ejemplo.com');
    assert(r.ageDays === null, `ageDays ${r.ageDays}, esperado null`);
    assert(r.score === 80, `score ${r.score}, esperado 80 (sin señal de antigüedad)`);
  }, { status: 500 });
});

export async function run() {
  for (const t of asyncTests) await t();
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, tests: results.length, error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null };
}