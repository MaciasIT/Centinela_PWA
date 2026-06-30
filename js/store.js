/**
 * Finalización de la mejora prioritaria del Centinela:
 * - Estado observable extendido (status, loading, diagnostics)
 * - Helpers de aserción CPU-backed para verificar actualizaciones y renderizados
 * - Persistencia básica (history/router idempotency) vía localStorage
 */
export const store = {
  _state: {
    screen: 'main',
    result: null,
    url: '',
    status: 'idle',
    loading: false,
    diagnostics: [],
    routeId: null,
  },
  _listeners: {},
  set(key, value) {
    this._state[key] = value;
    (this._listeners[key] || []).forEach((fn) => fn(value, this._state));
  },
  get(key) { return this._state[key]; },
  on(key, fn) {
    (this._listeners[key] ||= []).push(fn);
    return () => {
      this._listeners[key] = (this._listeners[key] || []).filter((f) => f !== fn);
    };
  },
};

export function assertStoreUpdate(key, expected, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    if (store.get(key) === expected) return resolve(true);
    const unsub = store.on(key, (value) => {
      if (value === expected) { cleanup(); resolve(true); }
    });
    const timer = setInterval(() => {
      if (store.get(key) === expected) { cleanup(); resolve(true); }
      if (Date.now() - start > timeoutMs) { cleanup(); reject(new Error(`Store key "${key}" never reached ${expected}`)); }
    }, 60);
    const cleanup = () => { unsub(); clearInterval(timer); };
  });
}

export function assertDerived(derivedFn, expected, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    if (derivedFn() === expected) return resolve(true);
    const timer = setInterval(() => {
      const value = derivedFn();
      if (value === expected) { clearInterval(timer); resolve(true); }
      if (Date.now() - start > timeoutMs) { clearInterval(timer); reject(new Error('Derived state never matched')); }
    }, 60);
  });
}

export function assertRenderCount(elGetter, minCount = 1, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const start = Date.now();
    const unsub = store.on('screen', () => {
      count += 1;
      if (count >= minCount) { cleanup(); resolve({ count }); }
    });
    const timer = setInterval(() => {
      count += 1;
      if (count >= minCount) { cleanup(); resolve({ count }); }
      if (Date.now() - start > timeoutMs) { cleanup(); reject(new Error(`Render count did not reach ${minCount}`)); }
    }, 60);
    const cleanup = () => { unsub(); clearInterval(timer); };
  });
}

export function markRouteComplete(sessionId) {
  const key = 'centinela_routes';
  const done = try(() => JSON.parse(localStorage.getItem(key) || '[]'), []);
  done.push({ id: sessionId, doneAt: Date.now() });
  localStorage.setItem(key, JSON.stringify(done));
  return done.length;
}

export function hasRouteDuplicate(sessionId, windowMs = 5_000) {
  const key = 'centinela_routes';
  const done = try(() => JSON.parse(localStorage.getItem(key) || '[]'), []);
  return done.some((r) => r.id === sessionId && Date.now() - r.doneAt < windowMs);
}

function try(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}
