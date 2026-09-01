// ==================== FUNCIONES ADMIN ====================
const ADMIN_PASSWORD = 'admin123'; // Cambia esto por una contraseña más segura

// ==================== FUNCIONES ADMIN (Global Scope) ====================
function abrirPanelAdmin() {
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

function autenticarAdmin() {
  const password = document.getElementById('admin-password').value;
  if (password === ADMIN_PASSWORD) {
    document.getElementById('admin-login-modal').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    cargarListasAdmin();
  } else {
    alert('❌ Contraseña incorrecta');
    document.getElementById('admin-password').value = '';
  }
}

async function agregarSupervisor() {
  const nombre = document.getElementById('admin-sup-nombre').value.trim();
  if (!nombre) { alert('Ingresa un nombre'); return; }
  try {
    const { error } = await window.supabase.from('supervisores').insert([{ nombre, estado: true }]);
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
    const { error } = await window.supabase.from('capataces').insert([{ nombre, estado: true }]);
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
    const { error } = await window.supabase.from('sectores').insert([{ nombre, estado: true }]);
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

async function cargarListasAdmin() {
  try {
    const { data: sups } = await window.supabase.from('supervisores').select('id, nombre').eq('estado', true);
    document.getElementById('admin-sup-lista').innerHTML = (sups||[]).map(s =>
      `<div style="padding:6px;background:var(--surface2);border-radius:4px;margin-bottom:4px;display:flex;justify-content:space-between"><span>${s.nombre}</span><button onclick="eliminarSupervisor(${s.id})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px">✕</button></div>`
    ).join('');
    const { data: caps } = await window.supabase.from('capataces').select('id, nombre').eq('estado', true);
    document.getElementById('admin-cap-lista').innerHTML = (caps||[]).map(c =>
      `<div style="padding:6px;background:var(--surface2);border-radius:4px;margin-bottom:4px;display:flex;justify-content:space-between"><span>${c.nombre}</span><button onclick="eliminarCapataz(${c.id})" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:12px">✕</button></div>`
    ).join('');
    const { data: sects } = await window.supabase.from('sectores').select('id, nombre').eq('estado', true);
    let sectHtml = '';
    for (const sect of (sects||[])) {
      const { data: frentes } = await window.supabase.from('frentes').select('id, nombre').eq('sector_id', sect.id).eq('estado', true);
      sectHtml += `<div style="margin-bottom:12px;padding:12px;background:var(--surface2);border-radius:4px"><div style="font-weight:600;margin-bottom:8px;display:flex;justify-content:space-between"><span>${sect.nombre}</span><button onclick="agregarFrenteSector(${sect.id})" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:12px">+ Frente</button></div>`;
      (frentes||[]).forEach(f => {
        sectHtml += `<div style="font-size:11px;padding:4px 8px;margin:4px 0;background:var(--surface);border-radius:2px;display:flex;justify-content:space-between"><span>${f.nombre}</span><button onclick="eliminarFrente(${f.id})" style="background:none;border:none;color:#dc2626;cursor:pointer">✕</button></div>`;
      });
      sectHtml += '</div>';
    }
    document.getElementById('admin-sect-lista').innerHTML = sectHtml;
  } catch (e) {
    console.error('Error cargando listas:', e);
  }
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
    const { error } = await window.supabase.from('frentes').insert([{ nombre, sector_id: sectorId, estado: true }]);
    if (error) throw error;
    cargarListasAdmin();
    await cargarDatosSupabase();
    _refrescarFrenteSelect();
    showToast('✅ Frente agregado');
  } catch (e) {
    alert('Error: ' + e.message);
  }
}
