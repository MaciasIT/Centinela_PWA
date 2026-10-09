/**
 * T3a — Tests del contador global EXACTO de cuota (Durable Object `QuotaGuard`).
 *
 * Por qué existe: el binding `[[ratelimits]]` de Cloudflare es *permissive* y de
 * consistencia eventual (verificado: 17 peticiones sobre un límite de 4 → 0
 * bloqueos, `verificacion-binding-ratelimits.md`). NO cuenta. El techo de la
 * cuota de VirusTotal (4/min · 500/día agregados) lo impone este contador.
 */
import { QuotaGuard, takeToken, emptyState, PER_MINUTE_LIMIT, PER_DAY_LIMIT } from '../../worker/src/quota-guard.js';

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

const T0 = Date.UTC(2026, 9, 9, 12, 0, 0); // minuto fijo

/* ── límites declarados ──────────────────────────────────────────── */

ok('los límites son 4/min y 500/día (cuota pública de VirusTotal)', () => {
  assert(PER_MINUTE_LIMIT === 4, `PER_MINUTE_LIMIT=${PER_MINUTE_LIMIT}`);
  assert(PER_DAY_LIMIT === 500, `PER_DAY_LIMIT=${PER_DAY_LIMIT}`);
});

/* ── exactitud del contador por minuto ───────────────────────────── */

ok('takeToken permite EXACTAMENTE 4 en el mismo minuto y deniega el 5º', () => {
  let state = emptyState();
  const allowed = [];
  for (let i = 0; i < 5; i++) {
    const r = takeToken(state, T0 + i * 1000);
    allowed.push(r.allowed);
    state = r.state;
  }
  assert(
    JSON.stringify(allowed) === JSON.stringify([true, true, true, true, false]),
    `secuencia inesperada: ${JSON.stringify(allowed)}`
  );
});

ok('el 5º lleva motivo «minute» y un Retry-After hacia el siguiente minuto', () => {
  let state = emptyState();
  for (let i = 0; i < 4; i++) state = takeToken(state, T0).state;
  const denied = takeToken(state, T0 + 1000);
  assert(!denied.allowed, 'el 5º debería denegarse');
  assert(denied.reason === 'minute', `motivo ${denied.reason}`);
  assert(denied.retryAfter > 0 && denied.retryAfter <= 60, `retryAfter ${denied.retryAfter}`);
});

ok('al cambiar de minuto la ventana se reinicia (no arrastra el contador)', () => {
  let state = emptyState();
  for (let i = 0; i < 4; i++) state = takeToken(state, T0).state;
  const next = takeToken(state, T0 + 60_000);
  assert(next.allowed, 'en el minuto siguiente debe volver a haber cuota');
  assert(next.state.minuteCount === 1, `minuteCount ${next.state.minuteCount}`);
});

ok('el contador NO es permisivo: 17 peticiones seguidas → 13 bloqueos (el binding dio 0)', () => {
  let state = emptyState();
  let blocked = 0;
  for (let i = 0; i < 17; i++) {
    const r = takeToken(state, T0 + i);
    state = r.state;
    if (!r.allowed) blocked += 1;
  }
  assert(blocked === 13, `bloqueos ${blocked}, esperados 13`);
});

/* ── techo diario ────────────────────────────────────────────────── */

ok('takeToken deniega al alcanzar el techo diario con motivo «day»', () => {
  const state = { dayStart: Math.floor(T0 / 86_400_000), dayCount: PER_DAY_LIMIT, minuteStart: Math.floor(T0 / 60_000), minuteCount: 0 };
  const r = takeToken(state, T0);
  assert(!r.allowed, 'debería denegarse por día');
  assert(r.reason === 'day', `motivo ${r.reason}`);
});

ok('el contador diario se acumula entre minutos distintos', () => {
  let state = emptyState();
  state = takeToken(state, T0).state;
  state = takeToken(state, T0 + 60_000).state;
  state = takeToken(state, T0 + 120_000).state;
  assert(state.dayCount === 3, `dayCount ${state.dayCount}, esperado 3`);
});

ok('al cambiar de día el contador diario se reinicia', () => {
  let state = emptyState();
  for (let i = 0; i < 4; i++) state = takeToken(state, T0).state;
  const nextDay = T0 + 86_400_000;
  const r = takeToken(state, nextDay);
  assert(r.allowed, 'el día siguiente debe volver a haber cuota');
  assert(r.state.dayCount === 1, `dayCount ${r.state.dayCount}`);
});

/* ── Durable Object real (no mockeado): persistencia entre peticiones ── */

function fakeCtx() {
  const store = new Map();
  return {
    storage: {
      get: async (k) => store.get(k),
      put: async (k, v) => { store.set(k, v); },
    },
    _store: store,
  };
}

okAsync('el DO QuotaGuard persiste el contador y bloquea la 5ª petición', async () => {
  const ctx = fakeCtx();
  const guard = new QuotaGuard(ctx, {});
  const out = [];
  for (let i = 0; i < 5; i++) {
    const res = await guard.fetch(new Request('https://quota-guard/acquire'));
    out.push(await res.json());
  }
  assert(out[0].allowed && out[3].allowed, 'las 4 primeras deben permitirse');
  assert(!out[4].allowed && out[4].reason === 'minute', `la 5ª debe bloquearse: ${JSON.stringify(out[4])}`);
  assert(ctx._store.get('vt-quota').dayCount === 4, 'el estado debe quedar persistido en el storage del DO');
});

okAsync('el DO responde JSON con allowed/reason/retryAfter', async () => {
  const guard = new QuotaGuard(fakeCtx(), {});
  const res = await guard.fetch(new Request('https://quota-guard/acquire'));
  assert(res.status === 200, `status ${res.status}`);
  const data = await res.json();
  for (const k of ['allowed', 'reason', 'retryAfter']) {
    assert(k in data, `falta la clave ${k} en la respuesta del DO`);
  }
});

export async function run() {
  for (const t of asyncTests) await t();
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0,
    tests: results.length,
    error: failed.map((r) => `${r.name}: ${r.error}`).join(' | ') || null,
  };
}
