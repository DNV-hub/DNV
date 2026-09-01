// Service Worker del Reporte Diario de Campo — cache de archivos estáticos para uso offline.
// No intercepta nada relacionado a guardado de datos ni exportaciones: el formulario guarda
// en localStorage y los exports (.xlsx/.csv/.json) se generan como Blob en el propio navegador,
// ninguno de los dos pasa por una petición de red que este Service Worker pueda tocar.

const CACHE_NAME = 'rdc-cache-v1';
const APP_SHELL = [
  './Reporte_Diario_Campo.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // si algún recurso falla (ej. sin conexión en la primera carga), no bloquea la instalación
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Solo lectura (GET). Nunca tocar otros métodos — este app no envía nada por red de todas formas.
  if (req.method !== 'GET') return;

  // Documento principal: red primero, para que quien tenga conexión siempre reciba la última
  // versión del formulario; si no hay conexión, se sirve la última copia guardada en caché.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./Reporte_Diario_Campo.html')))
    );
    return;
  }

  // Recursos estáticos (íconos, manifest, fuentes, librería de Excel, etc.): caché primero
  // para velocidad y para que funcionen offline, actualizando la copia en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const enRed = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          }
          return res;
        })
        .catch(() => cached);
      return cached || enRed;
    })
  );
});
