// ==================== FUNCIONES ADMIN ====================
const ADMIN_PASSWORD = 'admin123'; // Cambia esto por una contraseña más segura
// La contraseña vive en este archivo JS, visible para cualquiera que abra las herramientas
// de desarrollador — es solo un candado suave contra toques accidentales, no seguridad real.
// Por eso "recordar en este dispositivo" (localStorage) no reduce la seguridad: no había
// seguridad real que proteger.
const ADMIN_AUTH_KEY = 'rdc_admin_auth_v1';

// ==================== FUNCIONES ADMIN (Global Scope) ====================
function abrirPanelAdmin() {
  if (localStorage.getItem(ADMIN_AUTH_KEY) === 'true') {
    _mostrarPanelAdmin();
    return;
  }
  const modal = document.getElementById('admin-login-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('admin-password').focus();
  }
}

function cerrarPanelAdmin() {
  document.getElementById('admin-login-modal').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('admin-password').value = '';
}

function _mostrarPanelAdmin() {
  document.getElementById('admin-login-modal').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  cargarListasAdmin();
}

function autenticarAdmin() {
  const password = document.getElementById('admin-password').value;
  if (password === ADMIN_PASSWORD) {
    if (document.getElementById('admin-recordar').checked) {
      localStorage.setItem(ADMIN_AUTH_KEY, 'true');
    }
    _mostrarPanelAdmin();
  } else {
    alert('❌ Contraseña incorrecta');
    document.getElementById('admin-password').value = '';
  }
}

function cerrarSesionAdmin() {
  if (!confirm('¿Cerrar sesión de administrador en este dispositivo?\n\nLa próxima vez que entres, va a pedir la contraseña de nuevo.')) return;
  localStorage.removeItem(ADMIN_AUTH_KEY);
  cerrarPanelAdmin();
}

// ==================== ACORDEÓN DEL PANEL ADMIN ====================
let _adminAccordionAbierto = null;

function _toggleAdminAccordion(key) {
  _adminAccordionAbierto = (_adminAccordionAbierto === key) ? null : key;
  _aplicarAdminAccordion();
}

function _aplicarAdminAccordion() {
  ['sup', 'cap', 'sect'].forEach(k => {
    const body = document.getElementById('admin-acc-body-' + k);
    const chev = document.getElementById('admin-acc-chev-' + k);
    if (!body) return;
    const abrir = _adminAccordionAbierto === k;
    body.style.display = abrir ? 'block' : 'none';
    if (chev) chev.style.transform = abrir ? 'rotate(180deg)' : 'rotate(0deg)';
  });
}

// Eliminar deja el registro en la tabla con estado:false (borrado lógico), así que
// "agregar" un nombre que ya existió antes choca con la restricción UNIQUE de la
// columna nombre. Este helper reactiva el registro inactivo en vez de insertar uno nuevo.
async function _upsertActivo(tabla, nombre) {
  const { data: existentes, error: errSel } = await window.supabase.from(tabla).select('id, estado').eq('nombre', nombre);
  if (errSel) return { error: errSel };
  const existente = (existentes || [])[0];
  const { data: todos } = await window.supabase.from(tabla).select('orden');
  const nuevoOrden = (todos || []).reduce((m, r) => Math.max(m, r.orden || 0), 0) + 1;
  if (existente) {
    if (existente.estado) return { error: { message: `Ya existe "${nombre}" en la lista.` } };
    return await window.supabase.from(tabla).update({ estado: true, orden: nuevoOrden }).eq('id', existente.id);
  }
  return await window.supabase.from(tabla).insert([{ nombre, estado: true, orden: nuevoOrden }]);
}

async function agregarSupervisor() {
  const nombre = document.getElementById('admin-sup-nombre').value.trim();
  if (!nombre) { alert('Ingresa un nombre'); return; }
  try {
    const { error } = await _upsertActivo('supervisores', nombre);
    if (error) throw error;
    document.getElementById('admin-sup-nombre').value = '';
    cargarListasAdmin();
    await cargarDatosSupabase();
    initSelects();
    showToast('✅ Supervisor agregado');
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function agregarCapataz() {
  const nombre = document.getElementById('admin-cap-nombre').value.trim();
  if (!nombre) { alert('Ingresa un nombre'); return; }
  try {
    const { error } = await _upsertActivo('capataces', nombre);
    if (error) throw error;
    document.getElementById('admin-cap-nombre').value = '';
    cargarListasAdmin();
    await cargarDatosSupabase();
    initSelects();
    showToast('✅ Capataz agregado');
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function agregarSector() {
  const nombre = document.getElementById('admin-sect-nombre').value.trim();
  if (!nombre) { alert('Ingresa un nombre'); return; }
  try {
    const { error } = await _upsertActivo('sectores', nombre);
    if (error) throw error;
    document.getElementById('admin-sect-nombre').value = '';
    cargarListasAdmin();
    await cargarDatosSupabase();
    initSelects();
    showToast('✅ Sector agregado');
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Fila arrastrable genérica para las listas del panel admin. sectorId solo aplica a frentes,
// para no mezclar el reordenamiento de un sector con el de otro.
function _filaArrastrable(tabla, id, nombre, botonesExtra, sectorId, estiloExtra) {
  const drag = `data-tabla="${tabla}" data-id="${id}" draggable="true" ondragstart="event.stopPropagation();_dragStart(event,'${tabla}',${id},${sectorId ?? 'null'})" ondragover="event.stopPropagation();event.preventDefault()" ondrop="event.stopPropagation();_dropRow(event,'${tabla}',${id},${sectorId ?? 'null'})"`;
  return `<div ${drag} style="padding:6px 8px;background:var(--surface2);border-radius:4px;margin-bottom:4px;display:flex;align-items:center;gap:8px;cursor:grab;${estiloExtra||''}"><span style="color:var(--text3)">☰</span><span style="flex:1">${nombre}</span>${botonesExtra}</div>`;
}

async function cargarListasAdmin() {
  try {
    const { data: sups } = await window.supabase.from('supervisores').select('id, nombre').eq('estado', true).order('orden');
    document.getElementById('admin-sup-lista').innerHTML = (sups||[]).map(s =>
      _filaArrastrable('supervisores', s.id, s.nombre, `<button onclick="eliminarSupervisor(${s.id})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px">✕</button>`)
    ).join('');
    const { data: caps } = await window.supabase.from('capataces').select('id, nombre').eq('estado', true).order('orden');
    document.getElementById('admin-cap-lista').innerHTML = (caps||[]).map(c =>
      _filaArrastrable('capataces', c.id, c.nombre, `<button onclick="eliminarCapataz(${c.id})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px">✕</button>`)
    ).join('');
    const { data: sects } = await window.supabase.from('sectores').select('id, nombre').eq('estado', true).order('orden');
    let sectHtml = '';
    for (const sect of (sects||[])) {
      const { data: frentes } = await window.supabase.from('frentes').select('id, nombre').eq('sector_id', sect.id).eq('estado', true).order('orden');
      const botonesSector = `<button onclick="agregarFrenteSector(${sect.id})" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:12px">+ Frente</button><button onclick="eliminarSector(${sect.id})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px">✕</button>`;
      // El sector completo (con sus frentes adentro) es la unidad que se arrastra, no solo su
      // encabezado — si solo el encabezado fuera arrastrable, container.parentElement apuntaría
      // a la tarjeta de ESTE sector nada más, y nunca vería a los demás sectores como hermanos.
      const dragSector = `data-tabla="sectores" data-id="${sect.id}" draggable="true" ondragstart="event.stopPropagation();_dragStart(event,'sectores',${sect.id},null)" ondragover="event.stopPropagation();event.preventDefault()" ondrop="event.stopPropagation();_dropRow(event,'sectores',${sect.id},null)"`;
      sectHtml += `<div ${dragSector} style="margin-bottom:12px;padding:12px;background:var(--surface2);border-radius:4px;cursor:grab">`;
      sectHtml += `<div style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:8px"><span style="color:var(--text3)">☰</span><span style="flex:1">${sect.nombre}</span>${botonesSector}</div>`;
      (frentes||[]).forEach(f => {
        sectHtml += _filaArrastrable('frentes', f.id, f.nombre, `<button onclick="eliminarFrente(${f.id})" style="background:none;border:none;color:#dc2626;cursor:pointer">✕</button>`, sect.id, 'background:var(--surface);font-size:11px;padding:4px 8px;');
      });
      sectHtml += '</div>';
    }
    document.getElementById('admin-sect-lista').innerHTML = sectHtml;
    _aplicarAdminAccordion();
  } catch (e) {
    console.error('Error cargando listas:', e);
  }
}

// ==================== ARRASTRAR PARA REORDENAR ====================
let _dragInfo = null;

function _dragStart(ev, tabla, id, sectorId) {
  _dragInfo = { tabla, id, sectorId };
  ev.dataTransfer.effectAllowed = 'move';
}

async function _dropRow(ev, tabla, targetId, sectorId) {
  ev.preventDefault();
  if (!_dragInfo || _dragInfo.tabla !== tabla || _dragInfo.id === targetId) return;
  if (tabla === 'frentes' && _dragInfo.sectorId !== sectorId) return;
  const draggedEl = document.querySelector(`[data-tabla="${tabla}"][data-id="${_dragInfo.id}"]`);
  const targetEl = ev.currentTarget;
  if (!draggedEl || !targetEl || draggedEl === targetEl) return;
  const container = targetEl.parentElement;
  const rect = targetEl.getBoundingClientRect();
  const antes = (ev.clientY - rect.top) < rect.height / 2;
  container.insertBefore(draggedEl, antes ? targetEl : targetEl.nextSibling);
  await _persistirOrden(tabla, container);
  _dragInfo = null;
}

async function _persistirOrden(tabla, container) {
  const filas = Array.from(container.querySelectorAll(`[data-tabla="${tabla}"]`));
  await Promise.all(filas.map((el, i) => window.supabase.from(tabla).update({ orden: i }).eq('id', Number(el.dataset.id))));
  await cargarDatosSupabase();
  if (tabla === 'frentes') _refrescarFrenteSelect(); else initSelects();
  cargarListasAdmin();
}

async function eliminarSupervisor(id) {
  if (!confirm('¿Eliminar supervisor?')) return;
  try {
    await window.supabase.from('supervisores').update({ estado: false }).eq('id', id);
    cargarListasAdmin();
    await cargarDatosSupabase();
    initSelects();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function eliminarCapataz(id) {
  if (!confirm('¿Eliminar capataz?')) return;
  try {
    await window.supabase.from('capataces').update({ estado: false }).eq('id', id);
    cargarListasAdmin();
    await cargarDatosSupabase();
    initSelects();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function eliminarSector(id) {
  if (!confirm('¿Eliminar sector? Sus frentes quedarán ocultos también.')) return;
  try {
    await window.supabase.from('sectores').update({ estado: false }).eq('id', id);
    cargarListasAdmin();
    await cargarDatosSupabase();
    initSelects();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function eliminarFrente(id) {
  if (!confirm('¿Eliminar frente?')) return;
  try {
    await window.supabase.from('frentes').update({ estado: false }).eq('id', id);
    cargarListasAdmin();
    await cargarDatosSupabase();
    _refrescarFrenteSelect();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function agregarFrenteSector(sectorId) {
  const nombre = prompt('Nombre del frente:');
  if (!nombre) return;
  try {
    const { data: existentes, error: errSel } = await window.supabase.from('frentes').select('id, estado').eq('sector_id', sectorId).eq('nombre', nombre);
    if (errSel) throw errSel;
    const existente = (existentes || [])[0];
    const { data: todos } = await window.supabase.from('frentes').select('orden').eq('sector_id', sectorId);
    const nuevoOrden = (todos || []).reduce((m, r) => Math.max(m, r.orden || 0), 0) + 1;
    let error;
    if (existente) {
      if (existente.estado) { alert(`Ya existe "${nombre}" en este sector.`); return; }
      ({ error } = await window.supabase.from('frentes').update({ estado: true, orden: nuevoOrden }).eq('id', existente.id));
    } else {
      ({ error } = await window.supabase.from('frentes').insert([{ nombre, sector_id: sectorId, estado: true, orden: nuevoOrden }]));
    }
    if (error) throw error;
    cargarListasAdmin();
    await cargarDatosSupabase();
    _refrescarFrenteSelect();
    showToast('✅ Frente agregado');
  } catch (e) {
    alert('Error: ' + e.message);
  }
}
