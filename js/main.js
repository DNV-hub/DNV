// ==================== INICIALIZACIÓN DE LA APP ====================
// ==================== INIT ====================
renderPersonalPresente();
renderHitos();
_renderFormNuevoRegistro();
renderRows();
_renderEquiposLista();
renderMetradosPartidas();
renderMetradosManuales();
renderStandbyRows();

async function inicializarApp() {
  await cargarDatosSupabase();
  initSelects();
  loadDraft();
  renderProgRows();
  renderProgAdicRows();
  _renderBitacora();
  _initSupervisor();
  _actualizarBotonNuevo();
  _actualizarIndicadorPendientes();
  _reintentarColaPendientes(true);
}

// Iniciar la app
inicializarApp().catch(e => console.error('Error inicializando app:', e));

_initPantallaFotos();
_initSketchesInicio();

// Registro del Service Worker (PWA). No hace nada obligatorio: si el navegador no lo soporta,
// o la página se abre como archivo local (file://), esto simplemente falla en silencio y la
// app sigue funcionando exactamente igual que siempre.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    // Si ya había un Service Worker controlando esta página (navigator.serviceWorker.controller),
    // significa que no es la primera instalación — es alguien que ya tenía la app y llegó una
    // versión nueva. En ese caso, cuando esa versión termine de activarse, avisamos con un banner
    // en vez de recargar solo (para no interrumpir a mitad de un formulario; los datos igual están
    // a salvo en el borrador local, pero mejor dejar que la persona decida cuándo actualizar).
    const eraInstalacionPrevia = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      if (!reg) return;
      if (eraInstalacionPrevia) {
        reg.addEventListener('updatefound', () => {
          const nuevoWorker = reg.installing;
          if (!nuevoWorker) return;
          nuevoWorker.addEventListener('statechange', () => {
            if (nuevoWorker.state === 'activated') _mostrarBannerActualizacion();
          });
        });
      }
      // El chequeo automático del navegador en cada carga puede demorar o no dispararse a
      // tiempo — se fuerza aquí para que la detección de versión nueva sea inmediata y confiable.
      reg.update().catch(() => {});
    }).catch(() => {});
  });
}
function _mostrarBannerActualizacion() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.style.display = 'flex';
}
