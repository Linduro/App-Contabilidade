const exact = new Map();
const prefixes = [];

export function register(path, handler) {
  exact.set(path, handler);
}

export function registerPrefix(prefix, handler) {
  prefixes.push({ prefix, handler });
  prefixes.sort((a, b) => b.prefix.length - a.prefix.length);
}

export function resolve(path) {
  if (exact.has(path)) return exact.get(path);
  for (const { prefix, handler } of prefixes) {
    if (path === prefix || path.startsWith(prefix)) return handler;
  }
  return exact.get('/apps');
}

export function parseHash() {
  const raw = (location.hash || '#/apps').replace(/^#/, '') || '/apps';
  const pathPart = raw.split('?')[0];
  const path = pathPart.startsWith('/') ? pathPart : '/' + pathPart;
  return { path };
}

export function isLegacyRoute(path) {
  return path === '/legacy' || path.startsWith('/legacy/');
}

export async function dispatch(mountEl) {
  const { path } = parseHash();
  const handler = resolve(path) || (async () => {});
  if (isLegacyRoute(path)) {
    if (handler) await handler({ path, mount: mountEl });
    return path;
  }
  if (mountEl) {
    mountEl.innerHTML = '<div class="route-loading">Carregando…</div>';
    await handler({ path, mount: mountEl });
  }
  return path;
}

export function start(onRoute) {
  async function go() {
    const mountEl = document.getElementById('l2-content');
    const path = await dispatch(mountEl);
    onRoute?.(path);
    return path;
  }
  window.addEventListener('hashchange', go);
  return go;
}

export function navigate(path) {
  location.hash = '#' + (path.startsWith('/') ? path : '/' + path);
}

window.AFSRouter = { register, registerPrefix, navigate, isLegacyRoute, parseHash };
