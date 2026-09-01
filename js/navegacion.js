// ==================== BOTTOM NAV + SWIPE ====================
const _BNAV_MAP = {datos:'bnav-datos',jornada:'bnav-jornada',metrados:'bnav-metrados',obs:'bnav-obs',resumen:'bnav-resumen'};
const _MAS_TABS = new Set([]);
const _TAB_ORDER = ['datos','jornada','metrados','obs','resumen'];
let _currentTab = 'datos';
let _swX = 0, _swY = 0;
document.addEventListener('touchstart', e => { _swX = e.touches[0].clientX; _swY = e.touches[0].clientY; }, {passive:true});
document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - _swX;
  const dy = e.changedTouches[0].clientY - _swY;
  if (Math.abs(dx) < 55 || Math.abs(dy) > Math.abs(dx) * 0.75) return;
  const idx = _TAB_ORDER.indexOf(_currentTab);
  if (dx < 0 && idx < _TAB_ORDER.length - 1) showTab(_TAB_ORDER[idx + 1]);
  else if (dx > 0 && idx > 0) showTab(_TAB_ORDER[idx - 1]);
}, {passive:true});
function _bnavSync(tab) {
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  const bId = _BNAV_MAP[tab];
  if (bId) { const el = document.getElementById(bId); if (el) el.classList.add('active'); }
}
function _togMas() { /* panel Más eliminado */ }
function _closeMas() { /* panel Más eliminado */ }
function _showTabFromMas(tab) {
  _closeMas();
  showTab(tab);
}

function showTab(tab) {
  if (tab === 'datos' && (reporteEnviado || reporteFinalizadoSinEnvio)) { _softReset(); }
  const _now = new Date();
  if (_teleTab && _teleTi) { _tele.tabs.push({tab:_teleTab, entrada:_teleTi.toTimeString().slice(0,8), salida:_now.toTimeString().slice(0,8), seg:Math.round((_now-_teleTi)/1000)}); }
  _teleTab = tab; _teleTi = _now; _currentTab = tab;
  if (!_tele.inicio) _tele.inicio = _now;
  const tabs = ['datos','jornada','metrados','obs','resumen'];
  tabs.forEach(t => { const el = document.getElementById('tab-'+t); if (el) el.classList.toggle('visible', t===tab); });
  document.querySelectorAll('.tab-bar .tab').forEach((btn,i) => btn.classList.toggle('active', tabs[i] === tab));
  _bnavSync(tab);
  if (tab === 'resumen') { buildResumen(); }
  if (tab === 'prog') renderProgRows();
  if (tab === 'metrados') { renderMetradosPartidas(); renderMetradosManuales(); }
  if (tab === 'jornada') {
    const frenteEl = document.getElementById('f-frente');
    const fa = document.getElementById('frente-actual');
    if (frenteEl && fa) fa.textContent = frenteEl.value || 'selecciona un frente en "Datos"';
    _renderBitacora();
  }
  window.scrollTo({top:0, behavior:'smooth'});
}

// ==================== PANTALLA DE INICIO / NAVEGACIÓN RAÍZ ====================
function mostrarPantallaRaiz(nombre) {
  document.getElementById('pantalla-inicio').style.display = nombre === 'inicio' ? '' : 'none';
  document.getElementById('pantalla-rdc').style.display = nombre === 'rdc' ? '' : 'none';
  document.getElementById('pantalla-fotos').style.display = nombre === 'fotos' ? '' : 'none';
  if (nombre === 'fotos') _initFotosDatos();
  if (nombre === 'inicio') _initSketchesInicio();
}
function _initSketchesInicio() {
  const card = document.getElementById('sketches-inicio-card');
  if (!card) return;
  // Build frente selector options
  const sel = document.getElementById('sketch-frente-sel');
  if (sel && sel.options.length <= 1) {
    const frentes = Object.keys(PARTIDAS || {});
    frentes.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; sel.appendChild(o); });
  }
  // Default frente from RDC
  const frenteRDC = (document.getElementById('f-frente')||{}).value || '';
  if (frenteRDC) {
    _sketchFrenteActual = frenteRDC;
    const lbl = document.getElementById('sketch-frente-lbl');
    if (lbl) lbl.textContent = frenteRDC;
    if (sel) sel.value = frenteRDC;
  }
  if (_sketchFrenteActual) {
    card.style.display = '';
    _cargarSketchesAnteriores(_sketchFrenteActual);
  }
}
let _sketchFrenteActual = '';
function _togSketchFrenteEdit() {
  const ed = document.getElementById('sketch-frente-edit');
  if (ed) ed.style.display = ed.style.display === 'none' ? '' : 'none';
}
function _onSketchFrenteChange() {
  const sel = document.getElementById('sketch-frente-sel');
  if (!sel) return;
  _sketchFrenteActual = sel.value;
  const lbl = document.getElementById('sketch-frente-lbl');
  if (lbl) lbl.textContent = sel.value;
  document.getElementById('sketch-frente-edit').style.display = 'none';
  if (sel.value) _cargarSketchesAnteriores(sel.value);
}
function _initFotosDatos() {
  // Auto-rellena supervisor desde localStorage
  const sup = localStorage.getItem(SUPERVISOR_KEY) || '';
  const supEl = document.getElementById('foto-sup-nombre');
  if (supEl) supEl.textContent = sup || '—';
  // Auto-rellena frente desde el módulo RDC
  const frenteEl = document.getElementById('f-frente');
  const frente = frenteEl ? (frenteEl.options[frenteEl.selectedIndex] || {}).text || frenteEl.value || '—' : '—';
  const frenteLblEl = document.getElementById('foto-frente-lbl');
  if (frenteLblEl) frenteLblEl.textContent = frente;
  // Auto-rellena fecha desde RDC o usa hoy
  const rdcFecha = (document.getElementById('f-fecha') || {}).value || '';
  const fotoFechaEl = document.getElementById('foto-fecha');
  if (fotoFechaEl && !fotoFechaEl.value) {
    fotoFechaEl.value = rdcFecha || new Date().toISOString().slice(0, 10);
  }
}
