// ==================== INICIALIZACIÓN DE LA APP ====================
// ==================== INIT ====================
renderHitos();
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
  _initEquiposDatalist();
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
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
