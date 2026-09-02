function _togFotoBloque(tipo) {
  const bloques = ['diarias','redline','sketch'];
  bloques.forEach(b => {
    const body = document.getElementById('foto-body-'+b);
    const chev = document.getElementById('foto-chev-'+b);
    if (b === tipo) {
      const isOpen = body && body.style.display !== 'none';
      if (body) body.style.display = isOpen ? 'none' : '';
      if (chev) chev.textContent = isOpen ? '▶' : '▼';
    } else {
      if (body) body.style.display = 'none';
      if (chev) chev.textContent = '▶';
    }
  });
}

// ==================== REGISTRO FOTOGRÁFICO ====================
const POWER_AUTOMATE_FOTOS_URL = 'https://default01d952a2601948aa80282d9a49e865.6f.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/03/workflows/2a1230eb1f674732bf3b59251156e839/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=DNpo8bFGcKVl1M0Eolyl3ov8KcayvYkmiDFe_vyd-oM';

// Cada tipo de foto tiene su propia selección y su propia categoría/nombrado de archivo.
const FOTO_TIPOS = {
  diarias:      { categoria: 'Fotos RDC', label: 'Fotos diarias' },
  redline:      { categoria: 'Redlines',  label: 'Redline' },
  sketch:       { categoria: 'Sketch',    label: 'Sketch de avance' },
  sketch_perf:  { categoria: 'Sketch',    label: 'Sketch - Perforación' },
  sketch_iny:   { categoria: 'Sketch',    label: 'Sketch - Inyección' },
  sketch_malla: { categoria: 'Sketch',    label: 'Sketch - Malla' }
};

let fotosSeleccionadas = { diarias: [], redline: [], sketch_perf: [], sketch_iny: [], sketch_malla: [] };
let fotosSeleccionadasId = 0;

function _hoyISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function _initPantallaFotos() {
  // Fecha por defecto si no tiene valor
  const elFecha = document.getElementById('foto-fecha');
  if (elFecha && !elFecha.value) elFecha.value = _hoyISO();
  _actualizarContadoresFotos();
}

// Rol y Nombre reutilizan las mismas listas SUPERVISORES/CAPATACES que ya usa el RDC.
function onCambioFotoRol() {
  const rol = document.getElementById('foto-rol').value;
  const sel = document.getElementById('foto-nombre');
  const lista = rol === 'Supervisor' ? SUPERVISORES : rol === 'Capataz' ? CAPATACES : [];
  sel.innerHTML = lista.length
    ? '<option value="">— Seleccionar —</option>' + lista.map(n => `<option>${n}</option>`).join('')
    : '<option value="">— Selecciona primero el Rol —</option>';

  // El Capataz solo registra Fotos diarias. Redline y Sketch quedan solo para el Supervisor.
  const tipoWrap = document.getElementById('foto-tipo-wrap');
  const selTipo = document.getElementById('foto-tipo');
  if (rol === 'Capataz') {
    selTipo.value = 'diarias';
    onCambioTipoFoto();
    if (tipoWrap) tipoWrap.style.display = 'none';
  } else {
    if (tipoWrap) tipoWrap.style.display = '';
  }
  _actualizarContadoresFotos();
}

function onCambioTipoFoto() {
  const tipoFoto = document.getElementById('foto-tipo').value;
  Object.keys(FOTO_TIPOS).forEach(t => {
    const panel = document.getElementById('panel-foto-' + t);
    if (panel) panel.style.display = (t === tipoFoto) ? '' : 'none';
  });
}

function onFotosSeleccionadas(tipoFoto, event) {
  const files = Array.from(event.target.files || []);
  files.forEach(file => {
    if (!file.type || !file.type.startsWith('image/')) return;
    const id = fotosSeleccionadasId++;
    const previewUrl = URL.createObjectURL(file);
    fotosSeleccionadas[tipoFoto].push({ id, file, previewUrl });
  });
  event.target.value = '';
  renderFotoThumbs(tipoFoto);
}

function quitarFoto(tipoFoto, id) {
  const arr = fotosSeleccionadas[tipoFoto];
  const f = arr.find(x => x.id === id);
  if (f) URL.revokeObjectURL(f.previewUrl);
  fotosSeleccionadas[tipoFoto] = arr.filter(x => x.id !== id);
  renderFotoThumbs(tipoFoto);
}

function renderFotoThumbs(tipoFoto) {
  const cont = document.getElementById('foto-thumbs-' + tipoFoto);
  if (cont) {
    const arr = fotosSeleccionadas[tipoFoto];
    cont.innerHTML = !arr.length ? '' : arr.map(f => `
      <div style="position:relative;border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;aspect-ratio:1/1;background:var(--surface2)">
        <img src="${f.previewUrl}" style="width:100%;height:100%;object-fit:cover;display:block">
        <button onclick="quitarFoto('${tipoFoto}',${f.id})" aria-label="Quitar" style="position:absolute;top:4px;right:4px;background:rgba(17,24,39,.65);color:#fff;border:none;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0">
          <i class="ti ti-x" style="font-size:14px"></i>
        </button>
      </div>
    `).join('');
  }
  _actualizarContadoresFotos();
}

// Contador por tipo (dentro de cada panel) + resumen combinado antes de enviar.
function _actualizarContadoresFotos() {
  // Badges acordeón bloques diarias y redline
  ['diarias', 'redline'].forEach(t => {
    const n = fotosSeleccionadas[t].length;
    const badge = document.getElementById('foto-badge-'+t);
    if (badge) { badge.textContent = n; badge.style.display = n > 0 ? '' : 'none'; }
  });
  // Sketch subtypes badges
  let sketchTotal = 0;
  ['sketch_perf', 'sketch_iny', 'sketch_malla'].forEach(t => {
    const n = fotosSeleccionadas[t].length;
    sketchTotal += n;
    const badge = document.getElementById('badge-' + t);
    const btn = document.getElementById('btn-' + t);
    if (badge) { badge.textContent = n + (n === 1 ? ' foto' : ' fotos'); badge.style.display = n > 0 ? '' : 'none'; }
    if (btn) {
      btn.style.borderColor = n > 0 ? 'var(--green)' : 'var(--border)';
      btn.style.background  = n > 0 ? 'var(--green-bg)' : 'var(--surface)';
      btn.style.color       = n > 0 ? 'var(--green-text)' : 'var(--text2)';
    }
  });
  const skBadge = document.getElementById('foto-badge-sketch');
  if (skBadge) { skBadge.textContent = sketchTotal; skBadge.style.display = sketchTotal > 0 ? '' : 'none'; }
}

// Redimensiona a un ancho máximo y recodifica en JPEG con calidad reducida.
function _comprimirImagen(file, maxAncho, calidad) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxAncho) { h = Math.round(h * (maxAncho / w)); w = maxAncho; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('No se pudo comprimir la imagen')); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo leer la imagen comprimida'));
        reader.readAsDataURL(blob);
      }, 'image/jpeg', calidad);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

function _mostrarEstadoFotos(tipo, mensajeHtml) {
  const box = document.getElementById('foto-status');
  if (!box) return;
  const clasePorTipo = { cargando: 'alert-blue', exito: 'alert-green', error: 'alert-red' };
  box.className = 'alert ' + (clasePorTipo[tipo] || 'alert-blue');
  box.style.display = 'flex';
  box.innerHTML = mensajeHtml;
}


function _nombreArchivoFoto(tipoFoto, idx, ctx) {
  const { rol, nombreSinEspacios, frente, fecha } = ctx;
  if (tipoFoto === 'redline')      return `Redline_${frente}_${fecha}.jpg`;
  if (tipoFoto === 'sketch_perf')  return `Sketch_${frente}_${fecha}_PERF_${idx + 1}.jpg`;
  if (tipoFoto === 'sketch_iny')   return `Sketch_${frente}_${fecha}_INY_${idx + 1}.jpg`;
  if (tipoFoto === 'sketch_malla') return `Sketch_${frente}_${fecha}_MALLA_${idx + 1}.jpg`;
  return `${rol}_${nombreSinEspacios}_${idx + 1}.jpg`; // diarias
}

// Envía una categoría (diarias/redline/sketch). Devuelve true si tuvo éxito.
// Si tiene éxito limpia esa selección; si falla, la deja intacta para reintentar.
async function _enviarCategoriaFotos(tipoFoto, ctx, catIdx, catTotal) {
  const seleccion = fotosSeleccionadas[tipoFoto];
  const total = seleccion.length;
  const categoria = FOTO_TIPOS[tipoFoto].categoria;
  const etiqueta = FOTO_TIPOS[tipoFoto].label;
  const prefijo = catTotal > 1 ? `[${etiqueta} — ${catIdx}/${catTotal}] ` : '';
  const btn = document.getElementById('btn-enviar-fotos');

  try {
    const fotos = [];
    for (let idx = 0; idx < total; idx++) {
      const msg = `${prefijo}Enviando foto ${idx + 1} de ${total}...`;
      btn.innerHTML = `<i class="ti ti-loader-2"></i> ${msg}`;
      _mostrarEstadoFotos('cargando', `<i class="ti ti-loader-2" style="flex-shrink:0"></i><span>${msg}</span>`);
      const dataUrl = await _comprimirImagen(seleccion[idx].file, 1600, 0.7);
      const contenidoArchivo = dataUrl.split(',')[1];
      const nombreArchivo = _nombreArchivoFoto(tipoFoto, idx, ctx);
      fotos.push({ nombreArchivo, contenidoArchivo });
    }

    _mostrarEstadoFotos('cargando', `<i class="ti ti-loader-2" style="flex-shrink:0"></i><span>${prefijo}Enviando...</span>`);

    const respuesta = await fetch(POWER_AUTOMATE_FOTOS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: ctx.fecha, frente: ctx.frente, rol: ctx.rol, nombre: ctx.nombre, categoria, fotos })
    });

    if (respuesta.status !== 202) throw new Error('Respuesta inesperada: HTTP ' + respuesta.status);

    seleccion.forEach(f => URL.revokeObjectURL(f.previewUrl));
    fotosSeleccionadas[tipoFoto] = [];
    renderFotoThumbs(tipoFoto);
    return true;
  } catch (e) {
    _mostrarEstadoFotos('error', `<i class="ti ti-alert-triangle" style="flex-shrink:0"></i><span>❌ No se pudo enviar "${etiqueta}". Verifica tu conexión e intenta de nuevo — esas fotos siguen seleccionadas.</span>`);
    showToast(`Error al enviar "${etiqueta}" ❌`);
    return false;
  }
}

// Envía Fotos diarias (obligatorio) y, si el Rol es Supervisor y tienen fotos, también
// Redline y Sketch de avance — todo con un solo click, cada uno en su propio envío.
async function enviarFotos() {
  const nombre = (document.getElementById('foto-sup-nombre') || {}).textContent || localStorage.getItem(SUPERVISOR_KEY) || '';
  const frenteEl = document.getElementById('f-frente');
  const frente = frenteEl ? (frenteEl.options[frenteEl.selectedIndex] || {}).text || frenteEl.value || '' : '';
  const fecha = (document.getElementById('foto-fecha') || {}).value || '';
  const rol = 'Supervisor';

  if (!nombre || nombre === '—' || !fecha) {
    showToast('Falta nombre de supervisor o fecha ⚠️'); return;
  }
  if (!fotosSeleccionadas.diarias.length) {
    showToast('Las fotos diarias son obligatorias — selecciona al menos una ⚠️'); return;
  }
  const tiposAEnviar = ['diarias'];
  if (fotosSeleccionadas.redline.length)      tiposAEnviar.push('redline');
  if (fotosSeleccionadas.sketch_perf.length)  tiposAEnviar.push('sketch_perf');
  if (fotosSeleccionadas.sketch_iny.length)   tiposAEnviar.push('sketch_iny');
  if (fotosSeleccionadas.sketch_malla.length) tiposAEnviar.push('sketch_malla');

  const ctx = { rol, nombre, nombreSinEspacios: nombre.replace(/\s+/g, ''), frente, fecha };
  const btn = document.getElementById('btn-enviar-fotos');
  const textoOriginal = btn.innerHTML;
  btn.disabled = true;

  let huboError = false;
  for (let i = 0; i < tiposAEnviar.length; i++) {
    const ok = await _enviarCategoriaFotos(tiposAEnviar[i], ctx, i + 1, tiposAEnviar.length);
    if (!ok) { huboError = true; break; }
  }

  btn.disabled = false;
  btn.innerHTML = textoOriginal;

  if (!huboError) {
    _mostrarEstadoFotos('exito', '<i class="ti ti-circle-check" style="flex-shrink:0"></i><span>✅ Fotos enviadas correctamente.</span>');
    showToast('Fotos enviadas ✅');
  }
}
