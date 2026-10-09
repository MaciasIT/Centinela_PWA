/**
 * Centinela — Durable Object `QuotaGuard`
 *
 * Contador GLOBAL EXACTO de la cuota de VirusTotal (4/min · 500/día agregados).
 *
 * ── POR QUÉ EXISTE (y por qué NO lo protege el binding) ──────────────
 * El binding nativo `[[ratelimits]]` de Cloudflare es **permissive y de
 * consistencia eventual**: la documentación oficial dice que está diseñado
 * «intentionally […] not to be used as an accurate accounting system». Se
 * verificó contra la cuenta real: con un límite de 4/60 s, **17 peticiones →
 * 0 bloqueos** (`verificacion-binding-ratelimits.md`).
 *
 * Por tanto:
 *   - El binding `SCAN_RATE_LIMITER` es SOLO un freno de inundación por IP
 *     (evita que un único actor acapare). NO garantiza el techo de cuota.
 *   - El techo de cuota lo garantiza ESTE contador, que sí cuenta.
 *
 * ── DISEÑO ───────────────────────────────────────────────────────────
 * Instancia única nombrada `vt-quota` (serialización ⇒ atomicidad sin locks).
 * Token bucket: una ventana de minuto y una ventana de día.
 *
 * Atomicidad del read-modify-write: los Durable Objects garantizan que
 * mientras una operación de storage está en curso no se entrega ningún otro
 * evento al objeto (input gates), así que el par get→put de un mismo `fetch`
 * no puede intercalarse con el de otra petición de la misma instancia.
 */

export const PER_MINUTE_LIMIT = 4;
export const PER_DAY_LIMIT = 500;

export const QUOTA_STATE_KEY = 'vt-quota';
export const QUOTA_INSTANCE_NAME = 'vt-quota';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Estado inicial del contador. */
export function emptyState() {
  return { dayStart: 0, dayCount: 0, minuteStart: 0, minuteCount: 0 };
}

/**
 * Consume un token si queda cuota. Función PURA (testeable sin runtime de DO).
 *
 * @param {object|undefined} state estado previo
 * @param {number} nowMs instante actual
 * @returns {{allowed: boolean, reason: 'minute'|'day'|null, retryAfter: number, state: object}}
 */
export function takeToken(state, nowMs) {
  const s = { ...emptyState(), ...(state || {}) };
  const minute = Math.floor(nowMs / MS_PER_MINUTE);
  const day = Math.floor(nowMs / MS_PER_DAY);

  if (s.minuteStart !== minute) { s.minuteStart = minute; s.minuteCount = 0; }
  if (s.dayStart !== day) { s.dayStart = day; s.dayCount = 0; }

  if (s.dayCount >= PER_DAY_LIMIT) {
    return {
      allowed: false,
      reason: 'day',
      retryAfter: Math.max(1, Math.ceil(((day + 1) * MS_PER_DAY - nowMs) / 1000)),
      state: s,
    };
  }

  if (s.minuteCount >= PER_MINUTE_LIMIT) {
    return {
      allowed: false,
      reason: 'minute',
      retryAfter: Math.max(1, Math.ceil(((minute + 1) * MS_PER_MINUTE - nowMs) / 1000)),
      state: s,
    };
  }

  s.minuteCount += 1;
  s.dayCount += 1;
  return { allowed: true, reason: null, retryAfter: 0, state: s };
}

/**
 * Durable Object. Una instancia global (`idFromName('vt-quota')`) es la que
 * lleva la cuenta de toda la cuenta de Cloudflare.
 */
export class QuotaGuard {
  /**
   * @param {DurableObjectState} ctx
   * @param {object} env
   */
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch() {
    const state = await this.ctx.storage.get(QUOTA_STATE_KEY);
    const result = takeToken(state, Date.now());
    await this.ctx.storage.put(QUOTA_STATE_KEY, result.state);

    return new Response(
      JSON.stringify({
        allowed: result.allowed,
        reason: result.reason,
        retryAfter: result.retryAfter,
        minuteCount: result.state.minuteCount,
        dayCount: result.state.dayCount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
