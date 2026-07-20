/**
 * Centinela — Screen Router
 * Gestiona navegación entre pantallas y ciclo de vida mount/unmount
 */

/** @type {Map<string, {mount: Function, unmount?: Function}>} */
const screens = new Map();

/** @type {string|null} */
let currentScreen = null;

/**
 * Registrar una pantalla.
 * @param {string} name
 * @param {{mount: (container: HTMLElement) => void, unmount?: () => void}} screen
 */
export function register(name, screen) {
  screens.set(name, screen);
}

/**
 * Navegar a una pantalla.
 * @param {string} name
 * @param {*} [data] - datos opcionales a pasar como atributo del DOM
 */
export function navigate(name, data) {
  // Unmount anterior
  if (currentScreen && screens.has(currentScreen)) {
    const prev = screens.get(currentScreen);
    if (prev.unmount) prev.unmount();
  }

  // Ocultar todas
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));

  // Mostrar destino
  const container = document.getElementById(`screen-${name}`);
  if (!container) {
    console.warn(`Screen "${name}" not found in DOM`);
    return;
  }

  container.classList.add('active');

  // Montar nueva
  const screen = screens.get(name);
  if (screen) {
    screen.mount(container, data);
  }

  // Sincronizar nav
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === name);
  });

  currentScreen = name;
}

/**
 * Pantalla actual.
 */
export function current() {
  return currentScreen;
}

/**
 * Helper: crear listener de clic para navegación.
 * @param {string} selector - selector CSS de los botones
 * @param {string} screenName - nombre de la pantalla destino
 * @param {Function} [beforeNavigate] - hook antes de navegar
 */
export function bindNav(selector, screenName, beforeNavigate) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.addEventListener('click', async () => {
      if (beforeNavigate) await beforeNavigate();
      navigate(screenName);
    });
  });
}
