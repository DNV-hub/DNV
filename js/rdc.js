// ==================== ESTADO ====================
let rows = [];
let rowId = 0;
let partidaValores = {};
let cables = [];
let cableId = 0;
let controlItems = [];
let equiposPerforacionManual = [];
let equiposPerforacionManualId = 0;
let equiposSoporteManual = [];
let equiposSoporteManualId = 0;
let equiposLista = [];
let equiposListaId = 0;
let bitacoraActiv = [];
let bitacoraActivId = 0;
let controlId = 0;
let _controlId = 0;
let currentHitos = HITOS_BASE;
let suppressSave = false;
let redlineEstado = '';
let progRows = [];
let progRowId = 0;
let progAdicRows = [];
let progAdicId = 0;
let metradosManuales = [];
let metradosManualId = 0;
let standbyRows = [];
let standbyId = 0;
let reporteEnviado = false;
let reporteFinalizadoSinEnvio = false;
let blq1Valores = {};
let blq1Horarios = {};
let blq3Valores = {};
let blq3Horarios = {};



// ==================== MOTOR DE METRADOS ====================
// Estado: partidaValores[i] = { met: number|'', items: [] }
// items para partidas con control: { id, codigo, tipo, actividad, cantidad, unidad, ... }



// Telemetría
const _tele = { inicio: null, tabs: [] };
let _teleTab = null, _teleTi = null;


// Detecta partidas de instalación de accesorios (placas, tuercas, etc) por su nombre,
// ya que en el catálogo no vienen con columna 'c' propia.
function _esAccesorios(p) {
  const n = (p.n || '').toLowerCase();
  return n.indexOf('accesorio') !== -1;
}

function _cat(p) {
  // Determina la categoría de una partida SOLO basándose en la columna 'c' del Excel
  // Si no tiene 'c' definido → simple (solo campo numérico), salvo accesorios (disgregado)
  const c = (p.c || '').trim().toLowerCase();
  if (!c) return _esAccesorios(p) ? 'accesorios' : 'simple';
  if (c === 'perf-iny') return 'perf-iny';
  if (c === 'pull test' || c === 'Pull test' || c === 'PULL TEST') return 'pulltest';
  if (c === 'malla')     return 'm2';
  if (c === 'perforacion' || c === 'inyeccion' || c === 'cable') return 'ml';
  return 'simple';
}

function _tipoML(p) {
  // Para partidas de tipo 'ml', ¿qué subtipo es?
  const c = (p.c || '').trim().toLowerCase();
  if (c === 'cable')    return 'cable';
  if (c === 'inyeccion') return 'inyeccion';
  return 'perforacion'; // default
}

function _ensurePV(i) {
  if (!partidaValores[i] || typeof partidaValores[i] !== 'object') {
    partidaValores[i] = { met: '', items: [] };
  }
  if (!Array.isArray(partidaValores[i].items)) {
    partidaValores[i].items = [];
  }
}

function _recalc(i) {
  _ensurePV(i);
  const items = partidaValores[i].items;
  if (!items.length) { partidaValores[i].met = ''; return; }

  const frente = document.getElementById('f-frente') ? document.getElementById('f-frente').value : '';
  const lista  = PARTIDAS[frente] || [];
  const p      = lista[i];
  if (p && _cat(p) === 'accesorios') {
    const totalPlacas  = items.filter(it => it.tipo === 'Placa').reduce((s,it) => s + (Number(it.cantidad)||0), 0);
    const totalTuercas = items.filter(it => it.tipo === 'Tuerca').reduce((s,it) => s + (Number(it.cantidad)||0), 0);
    partidaValores[i].met = Math.min(totalPlacas, totalTuercas);
    return;
  }

  const isPullTest = items[0] && items[0].actividad === 'Pull Test';
  const total = isPullTest
    ? items.length
    : items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
  partidaValores[i].met = Math.round(total * 1000) / 1000;
}

function _umColor(um) {
  const map = { ML:'#DBEAFE:#1D4ED8', M2:'#DCFCE7:#15803D', M3:'#FEF3C7:#92400E',
    UND:'#F3F4F6:#374151', GLB:'#F5F3FF:#6D28D9', VIAJE:'#FFF7ED:#C2410C', DIAS:'#FFF7ED:#C2410C' };
  return (map[(um||'').toUpperCase()] || '#F3F4F6:#374151').split(':');
}

// ── Construir el formulario de ingreso de un item según categoría ─────────────
function _buildForm(p, i, cat, tipoML) {
  // Flatten tipos: split por '/' para soportar 'BAHE/Autoperforante'
  const tiposRaw = Array.isArray(p.t) && p.t.length ? p.t : [];
  const tipos = tiposRaw.length ? tiposRaw.flatMap(t => t.split('/').map(s => s.trim()).filter(Boolean)) : null;
  const tiposOpts = tipos ? tipos.map(t => '<option value="'+t+'">'+t+'<\/option>').join('') : '';

  if (cat === 'perf-iny') {
    const tipos = Array.isArray(p.t) && p.t.length ? p.t : null;
    const tiposOpts = tipos ? tipos.map(t => '<option value="'+t+'">'+t+'<\/option>').join('') : '';
    const tipoSelect = tiposOpts
      ? '<div class="field" style="min-width:130px"><label style="font-size:11px">Tipo perno<\/label>'
        +'<select id="pv-tipo-'+i+'">'+tiposOpts+'<\/select><\/div>'
      : '';
    let codigoInputsHTML = '';
    let extraBelowHTML = '';
    if (p.cod) {
      const _pfs = p.cod.split(',').map(s => s.trim()).filter(Boolean);
      const _pOpts = _pfs.map(pf => '<option value="' + pf + '">' + pf + '<\/option>').join('');
      const _prefCtrl = _pfs.length > 1
        ? '<div class="field" style="min-width:110px"><label style="font-size:11px">Prefijo<\/label><select id="pv-pref-' + i + '" onchange="_updatePernoInfo(' + i + ')">' + _pOpts + '<\/select><\/div>'
        : '<div class="field" style="min-width:120px"><label style="font-size:11px">Prefijo<\/label><div style="padding:0 8px;height:36px;display:flex;align-items:center;font-family:ui-monospace,monospace;font-size:13px;border:1px solid var(--border-md);border-radius:var(--r-md);background:var(--bg3)">' + _pfs[0] + '<\/div><input type="hidden" id="pv-pref-' + i + '" value="' + _pfs[0] + '"><\/div>';
      codigoInputsHTML = _prefCtrl
        + '<div class="field" style="max-width:75px"><label style="font-size:11px">N\u00b0 inicio<\/label>'
        + '<input type="number" min="1" step="1" id="pv-pnum-' + i + '" placeholder="1" oninput="_updatePernoInfo(' + i + ')" style="font-family:ui-monospace,monospace" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pv-pnum-fin-' + i + '\').focus()">'
        + '<\/div>'
        + '<div style="padding-bottom:8px;align-self:end;color:var(--text3);font-size:16px">\u2192<\/div>'
        + '<div class="field" style="max-width:75px"><label style="font-size:11px">N\u00b0 fin<\/label>'
        + '<input type="number" min="1" step="1" id="pv-pnum-fin-' + i + '" placeholder="(opc)" style="font-family:ui-monospace,monospace" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pv-ml-' + i + '\').focus()">'
        + '<\/div>';
      extraBelowHTML = '<div id="pv-pinfo-' + i + '" style="margin-top:6px;font-size:11px"><\/div>';
    } else {
      codigoInputsHTML = '<div class="field" style="min-width:80px"><label style="font-size:11px">C\u00f3digo inicio<\/label>'
        + '<input type="text" id="pv-cod-desde-' + i + '" placeholder="Ej: P01" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pv-cod-hasta-' + i + '\').focus()">'
        + '<\/div>'
        + '<div class="field" style="min-width:80px"><label style="font-size:11px">C\u00f3digo fin<\/label>'
        + '<input type="text" id="pv-cod-hasta-' + i + '" placeholder="Ej: P20 (opcional)" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pv-ml-' + i + '\').focus()">'
        + '<\/div>';
      extraBelowHTML = '<p class="note" style="margin-top:6px;font-size:11px">Si registras un rango (ej. inicio P01 \u2192 fin P20), se crea una fila por cada c\u00f3digo correlativo, todas con el mismo ML y ubicaci\u00f3n. Si solo llenas "C\u00f3digo inicio", se agrega un \u00fanico perno.<\/p>';
    }
    return `
      <div class="alert alert-blue" style="margin-bottom:10px;padding:8px 10px">
        <i class="ti ti-info-circle" style="flex-shrink:0"><\/i>
        <span>Selecciona si vas a registrar <strong>Perforaci\u00f3n</strong> o <strong>Inyecci\u00f3n</strong>. Puedes agregar ambas en la misma partida.<\/span>
      <\/div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="_setPerfInyMode(${i},'perforacion')" id="btn-perf-${i}"
          style="flex:1;padding:8px;border-radius:var(--r-md);border:2px solid var(--blue);background:var(--blue);color:#fff;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer">
          \uD83D\uDD29 Perforaci\u00f3n<\/button>
        <button onclick="_setPerfInyMode(${i},'inyeccion')" id="btn-iny-${i}"
          style="flex:1;padding:8px;border-radius:var(--r-md);border:2px solid var(--border-md);background:#fff;color:var(--text2);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer">
          \uD83D\uDC89 Inyecci\u00f3n<\/button>
      <\/div>
      <div id="perfiny-form-${i}">
        <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">
          ${tipoSelect}
          ${codigoInputsHTML}
          <div class="field" style="min-width:90px"><label style="font-size:11px" id="pv-ml-label-${i}">ML / perno<\/label>
            <input type="number" min="0" step="0.01" id="pv-ml-${i}" placeholder="0.00" onkeydown="if(event.key==='Enter')document.getElementById('pv-ubic-${i}').focus()">
          <\/div>
          <div class="field" style="min-width:110px"><label style="font-size:11px">Ubicaci\u00f3n<\/label>
            <select id="pv-ubic-${i}">${UBICACIONES_PERNO.map(u=>'<option>'+u+'<\/option>').join('')}<\/select>
          <\/div>
          <button onclick="_addItem(${i})" class="ctrl-add-btn" style="height:38px;align-self:end"><i class="ti ti-plus"><\/i><\/button>
        <\/div>
        ${extraBelowHTML}
      <\/div>
      ${_buildItemsTable((partidaValores[i]&&partidaValores[i].items?partidaValores[i].items:[]).map(it=>({...it,_partidaIdx:i})),p,'perf-iny','perforacion')}
    `;
  }

  if (cat === 'accesorios') {
    return `
      <div class="alert alert-blue" style="margin-bottom:10px;padding:8px 10px">
        <i class="ti ti-info-circle" style="flex-shrink:0"><\/i>
        <span>Registra por separado <strong>Placas<\/strong>, <strong>Tuercas<\/strong> y otros accesorios. El metrado (UND) se calcula automáticamente con los <strong>pares completos<\/strong> (Placa + Tuerca).<\/span>
      <\/div>
      <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">
        <div class="field" style="min-width:120px"><label style="font-size:11px">Tipo<\/label>
          <select id="pv-acc-tipo-${i}" onchange="_toggleAccDetalle(${i})">
            <option value="Placa">Placa<\/option>
            <option value="Tuerca">Tuerca<\/option>
            <option value="Otro">Otro accesorio<\/option>
          <\/select>
        <\/div>
        <div class="field" id="pv-acc-detalle-wrap-${i}" style="min-width:140px;display:none"><label style="font-size:11px">¿Cuál accesorio?<\/label>
          <input type="text" id="pv-acc-detalle-${i}" placeholder="Ej: Arandela">
        <\/div>
        <div class="field" style="min-width:90px"><label style="font-size:11px">Cantidad<\/label>
          <input type="number" min="0" step="1" id="pv-acc-cant-${i}" placeholder="0" onkeydown="if(event.key==='Enter')_addItem(${i})">
        <\/div>
        <button onclick="_addItem(${i})" class="ctrl-add-btn" style="height:38px;align-self:end"><i class="ti ti-plus"><\/i><\/button>
      <\/div>`;
  }

  if (cat === 'pulltest') {
    return `
      <div class="alert alert-blue" style="margin-bottom:8px;padding:8px 10px">
        <i class="ti ti-microscope" style="flex-shrink:0"><\/i>
        <span>Ingresa el código del perno ensayado. Cada código = 1 ensayo. El total se calcula automáticamente.<\/span>
      <\/div>
      <div style="display:flex;gap:8px;align-items:end">
        <div class="field" style="flex:1"><label>Código de perno ensayado<\/label>
          <input type="text" id="pv-pt-${i}" placeholder="Ej: P01" onkeydown="if(event.key==='Enter')_addItem(${i})">
        <\/div>
        <button onclick="_addItem(${i})" class="ctrl-add-btn" style="height:38px;flex-shrink:0"><i class="ti ti-plus"><\/i><\/button>
      <\/div>`;
  }

  if (cat === 'm2') {
    return `
      <div class="alert alert-blue" style="margin-bottom:8px;padding:8px 10px">
        <i class="ti ti-info-circle" style="flex-shrink:0"><\/i>
        <span>Ingresa el código según Sketch. El área M2 se calcula automáticamente con Ancho × Largo.<\/span>
      <\/div>
      <div style="display:grid;grid-template-columns:1fr 80px 80px 42px;gap:8px;align-items:end">
        <div class="field"><label>Código (Sketch)<\/label>
          <input type="text" id="pv-cod-${i}" placeholder="Ej: M01" onkeydown="if(event.key==='Enter')document.getElementById('pv-ancho-${i}').focus()">
        <\/div>
        <div class="field"><label>Ancho (m)<\/label>
          <input type="number" min="0" step="0.01" id="pv-ancho-${i}" placeholder="0.00" oninput="_previewArea(${i})" onkeydown="if(event.key==='Enter')document.getElementById('pv-largo-${i}').focus()">
        <\/div>
        <div class="field"><label>Largo (m)<\/label>
          <input type="number" min="0" step="0.01" id="pv-largo-${i}" placeholder="0.00" oninput="_previewArea(${i})" onkeydown="if(event.key==='Enter')_addItem(${i})">
        <\/div>
        <button onclick="_addItem(${i})" class="ctrl-add-btn" style="height:38px;align-self:end"><i class="ti ti-plus"><\/i><\/button>
      <\/div>
      <div id="pv-area-${i}" style="display:none;margin-top:6px;font-size:13px;font-weight:600;color:var(--green-text)">
        Área: <span id="pv-area-val-${i}">0.00<\/span> M2
      <\/div>`;
  }

  if (cat === 'ml' && tipoML === 'cable') {
    const tipoCol = tiposOpts ? `<div class="field" style="min-width:100px"><label>Tipo<\/label><select id="pv-tipo-${i}">${tiposOpts}<\/select><\/div>` : '';
    return `
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:end">
        ${tipoCol}
        <div class="field" style="min-width:80px"><label>Desde<\/label>
          <input type="text" id="pv-desde-${i}" placeholder="P10" onkeydown="if(event.key==='Enter')document.getElementById('pv-hasta-${i}').focus()">
        <\/div>
        <div style="padding-bottom:10px;font-size:18px;font-weight:700;color:var(--text3)">→<\/div>
        <div class="field" style="min-width:80px"><label>Hasta<\/label>
          <input type="text" id="pv-hasta-${i}" placeholder="P20" onkeydown="if(event.key==='Enter')document.getElementById('pv-ml-${i}').focus()">
        <\/div>
        <div class="field" style="min-width:80px"><label>ML cable<\/label>
          <input type="number" min="0" step="0.01" id="pv-ml-${i}" placeholder="0.00" onkeydown="if(event.key==='Enter')_addItem(${i})">
        <\/div>
        <button onclick="_addItem(${i})" class="ctrl-add-btn" style="height:38px;align-self:end"><i class="ti ti-plus"><\/i><\/button>
      <\/div>`;
  }

  if (cat === 'ml' && tipoML === 'inyeccion') {
    let _injCodigosHTML = '';
    let _injBelowHTML = '';
    if (p.cod) {
      const _pfs2 = p.cod.split(',').map(s => s.trim()).filter(Boolean);
      const _pOpts2 = _pfs2.map(pf => '<option value="' + pf + '">' + pf + '<\/option>').join('');
      const _prefCtrl2 = _pfs2.length > 1
        ? '<div class="field" style="min-width:110px"><label style="font-size:11px">Prefijo<\/label><select id="pv-pref-' + i + '" onchange="_updatePernoInfo(' + i + ')">' + _pOpts2 + '<\/select><\/div>'
        : '<div class="field" style="min-width:120px"><label style="font-size:11px">Prefijo<\/label><div style="padding:0 8px;height:36px;display:flex;align-items:center;font-family:ui-monospace,monospace;font-size:13px;border:1px solid var(--border-md);border-radius:var(--r-md);background:var(--bg3)">' + _pfs2[0] + '<\/div><input type="hidden" id="pv-pref-' + i + '" value="' + _pfs2[0] + '"><\/div>';
      _injCodigosHTML = _prefCtrl2
        + '<div class="field" style="max-width:75px"><label style="font-size:11px">N\u00b0 inicio<\/label>'
        + '<input type="number" min="1" step="1" id="pv-pnum-' + i + '" placeholder="1" oninput="_updatePernoInfo(' + i + ')" style="font-family:ui-monospace,monospace" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pv-pnum-fin-' + i + '\').focus()">'
        + '<\/div>'
        + '<div style="padding-bottom:8px;align-self:end;color:var(--text3);font-size:16px">\u2192<\/div>'
        + '<div class="field" style="max-width:75px"><label style="font-size:11px">N\u00b0 fin<\/label>'
        + '<input type="number" min="1" step="1" id="pv-pnum-fin-' + i + '" placeholder="(opc)" style="font-family:ui-monospace,monospace" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pv-ml-' + i + '\').focus()">'
        + '<\/div>';
      _injBelowHTML = '<div id="pv-pinfo-' + i + '" style="margin-top:6px;font-size:11px"><\/div>';
    } else {
      _injCodigosHTML = '<div class="field" style="min-width:80px"><label>C\u00f3digo inicio<\/label>'
        + '<input type="text" id="pv-cod-desde-' + i + '" placeholder="Ej: P01" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pv-cod-hasta-' + i + '\').focus()">'
        + '<\/div>'
        + '<div class="field" style="min-width:80px"><label>C\u00f3digo fin<\/label>'
        + '<input type="text" id="pv-cod-hasta-' + i + '" placeholder="Ej: P20 (opcional)" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pv-ml-' + i + '\').focus()">'
        + '<\/div>';
      _injBelowHTML = '<p class="note" style="margin-top:6px;font-size:11px">Rango opcional: inicio P01 \u2192 fin P20 genera una fila por cada perno correlativo.<\/p>';
    }
    return `
      <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">
        ${_injCodigosHTML}
        <div class="field" style="min-width:90px"><label>ML / perno<\/label>
          <input type="number" min="0" step="0.01" id="pv-ml-${i}" placeholder="0.00" onkeydown="if(event.key==='Enter')document.getElementById('pv-ubic-${i}').focus()">
        <\/div>
        <div class="field" style="min-width:110px"><label>Ubicaci\u00f3n<\/label>
          <select id="pv-ubic-${i}">${UBICACIONES_PERNO.map(u=>'<option>'+u+'<\/option>').join('')}<\/select>
        <\/div>
        <button onclick="_addItem(${i})" class="ctrl-add-btn" style="height:38px;align-self:end"><i class="ti ti-plus"><\/i><\/button>
      <\/div>
      ${_injBelowHTML}`;
  }

  // perforacion (default ML)
  const tipoSelect = tiposOpts
    ? `<div class="field" style="min-width:130px"><label>Tipo perno<\/label>
        <select id="pv-tipo-${i}">${tiposOpts}<\/select>
       <\/div>`
    : '';
  return `
    <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">
      ${tipoSelect}
      <div class="field" style="min-width:80px"><label>Código inicio<\/label>
        <input type="text" id="pv-cod-desde-${i}" placeholder="Ej: P01" onkeydown="if(event.key==='Enter')document.getElementById('pv-cod-hasta-${i}').focus()">
      <\/div>
      <div class="field" style="min-width:80px"><label>Código fin<\/label>
        <input type="text" id="pv-cod-hasta-${i}" placeholder="Ej: P20 (opcional)" onkeydown="if(event.key==='Enter')document.getElementById('pv-ml-${i}').focus()">
      <\/div>
      <div class="field" style="min-width:90px"><label>ML / perno<\/label>
        <input type="number" min="0" step="0.01" id="pv-ml-${i}" placeholder="0.00" onkeydown="if(event.key==='Enter')document.getElementById('pv-ubic-${i}').focus()">
      <\/div>
      <div class="field" style="min-width:110px"><label>Ubicación<\/label>
        <select id="pv-ubic-${i}">${UBICACIONES_PERNO.map(u=>'<option>'+u+'<\/option>').join('')}<\/select>
      <\/div>
      <button onclick="_addItem(${i})" class="ctrl-add-btn" style="height:38px;align-self:end"><i class="ti ti-plus"><\/i><\/button>
    <\/div>
    <p class="note" style="margin-top:6px;font-size:11px">Rango opcional: inicio P01 → fin P20 genera una fila por cada perno correlativo.<\/p>`;
}

// ── Construir tabla de items registrados ───────────────────────────────────
function _buildItemsTable(items, p, cat, tipoML) {
  if (!items.length) return '';

  if (cat === 'accesorios') {
    const totalPlacas  = items.filter(it => it.tipo === 'Placa').reduce((s,it) => s + (Number(it.cantidad)||0), 0);
    const totalTuercas = items.filter(it => it.tipo === 'Tuerca').reduce((s,it) => s + (Number(it.cantidad)||0), 0);
    const totalOtros   = items.filter(it => it.tipo === 'Otro').reduce((s,it) => s + (Number(it.cantidad)||0), 0);
    const pares = Math.min(totalPlacas, totalTuercas);
    let tbody2 = '';
    items.forEach(it => {
      tbody2 += `<tr><td>${it.tipo}${it.tipo==='Otro' && it.detalle ? ' — '+it.detalle : ''}<\/td>`
        + `<td style="text-align:right;font-weight:700">${it.cantidad}<\/td>`
        + `<td><button class="del-btn" onclick="_removeItem(${it._partidaIdx},${it.id})" style="font-size:13px"><i class="ti ti-x"><\/i><\/button><\/td><\/tr>`;
    });
    return `<table class="ctrl-table">
      <thead><tr><th>Tipo<\/th><th style="text-align:right">Cantidad<\/th><th style="width:28px"><\/th><\/tr><\/thead>
      <tbody>${tbody2}
        <tr><td colspan="2" style="font-size:12px;color:var(--text2)">Placas: ${totalPlacas} · Tuercas: ${totalTuercas}${totalOtros?(' · Otros: '+totalOtros):''}<\/td><td><\/td><\/tr>
        <tr class="total-row"><td colspan="2">PARES COMPLETOS (Placa+Tuerca)<\/td><td style="text-align:right;font-size:15px">${pares} UND<\/td><\/tr>
      <\/tbody><\/table>`;
  }

  const isPT = cat === 'pulltest';
  const isCable = tipoML === 'cable';
  const isMalla = cat === 'm2';
  const i = items[0]._partidaIdx;

  const hasPerno = !isPT && !isCable && !isMalla && items.some(it => it.codigoPerno);

  let thead = '<tr>';
  if (isPT) thead += '<th>Código perno<\/th><th style="text-align:right">UND<\/th>';
  else if (isCable) thead += '<th>Tipo<\/th><th>Tramo<\/th><th style="text-align:right">ML<\/th>';
  else if (isMalla) thead += '<th>Código<\/th><th>Ancho<\/th><th>Largo<\/th><th style="text-align:right">M2<\/th>';
  else if (hasPerno) thead += '<th>Tipo<\/th><th>Código<\/th><th>Perno<\/th><th>Ubic.<\/th><th style="text-align:right">ML<\/th>';
  else thead += '<th>Tipo<\/th><th>Código<\/th><th>Ubicación<\/th><th style="text-align:right">ML<\/th>';
  thead += '<th style="width:28px"><\/th><\/tr>';

  let tbody = '';
  items.forEach(it => {
    tbody += '<tr>';
    if (isPT) tbody += `<td style="font-family:ui-monospace,monospace;font-weight:600">${it.codigo}<\/td><td style="text-align:right">1<\/td>`;
    else if (isCable) tbody += `<td>${it.tipo||'—'}<\/td><td style="font-family:ui-monospace,monospace;font-weight:600">${it.codigo}<\/td><td style="text-align:right;font-weight:700">${it.cantidad}<\/td>`;
    else if (isMalla) tbody += `<td style="font-family:ui-monospace,monospace;font-weight:600">${it.codigo}<\/td><td>${it.ancho||'—'}<\/td><td>${it.largo||'—'}<\/td><td style="text-align:right;font-weight:700">${it.cantidad}<\/td>`;
    else if (hasPerno) tbody += `<td>${it.tipo||'—'}<\/td><td style="font-family:ui-monospace,monospace;font-weight:600">${it.codigo}<\/td><td style="font-family:ui-monospace,monospace;color:var(--blue);font-size:11px">${it.codigoPerno||'—'}<\/td><td>${it.ubicacion||'—'}<\/td><td style="text-align:right;font-weight:700">${it.cantidad}<\/td>`;
    else tbody += `<td>${it.tipo||'—'}<\/td><td style="font-family:ui-monospace,monospace;font-weight:600">${it.codigo}<\/td><td>${it.ubicacion||'—'}<\/td><td style="text-align:right;font-weight:700">${it.cantidad}<\/td>`;
    tbody += `<td><button class="del-btn" onclick="_removeItem(${it._partidaIdx},${it.id})" style="font-size:13px"><i class="ti ti-x"><\/i><\/button><\/td><\/tr>`;
  });

  const totalVal = isPT ? items.length : items.reduce((s,it)=>s+(Number(it.cantidad)||0),0);
  const totalFormatted = Math.round(totalVal*1000)/1000;
  const totalCols = isPT ? 1 : isCable ? 2 : isMalla ? 3 : hasPerno ? 4 : 3;
  const totalUM = isPT ? 'UND' : (isMalla ? 'M2' : 'ML');
  const totalRow = `<tr class="total-row">
    <td colspan="${totalCols}">TOTAL AUTOMÁTICO<\/td>
    <td style="text-align:right;font-size:15px">${totalFormatted} ${totalUM}<\/td>
    <td><\/td><\/tr>`;

  return `<table class="ctrl-table"><thead>${thead}<\/thead><tbody>${tbody}${totalRow}<\/tbody><\/table>`;
}

// ── Renderizar una tarjeta individual de partida ──────────────────────────
function _renderCard(p, i) {
  _ensurePV(i);
  const cat    = _cat(p);
  const tipoML = _tipoML(p);
  const items  = partidaValores[i].items;
  const met    = partidaValores[i].met;
  const [umBg, umTxt] = _umColor(p.u);
  const tieneValor = met !== '' && met !== null && met !== undefined;
  const tieneItems = items.length > 0;
  const isOpen = tieneValor || tieneItems;

  // GLB message
  const glbMsg = (p.u||'').toUpperCase() === 'GLB'
    ? `<div class="alert alert-amber" style="margin-bottom:8px;padding:8px 10px"><i class="ti ti-info-circle" style="flex-shrink:0"><\/i><span><strong>Partida porcentual (GLB):<\/strong> Ingresa <strong>1.00<\/strong> solo cuando la partida haya culminado completamente.<\/span><\/div>`
    : '';

  let bodyHTML = '';
  if (cat === 'simple') {
    bodyHTML = glbMsg + `
      <div style="display:flex;align-items:center;gap:10px">
        <input type="number" min="0" step="0.01"
          placeholder="${(p.u||'').toUpperCase()==='GLB'?'1.00 al culminar':'Cantidad ejecutada'}"
          value="${tieneValor ? met : ''}"
          id="simple-${i}"
          oninput="_simpleChange(${i},this.value)"
          style="flex:1;font-family:'Inter',inherit;font-size:14px;font-weight:400;padding:9px 11px;border:1.5px solid var(--border-md);border-radius:var(--r-md);color:var(--text)">
        <span style="font-size:14px;font-weight:700;color:var(--text2)">${p.u}<\/span>
      <\/div>`;
  } else {
    const form   = _buildForm(p, i, cat, tipoML);
    const table  = _buildItemsTable(items.map(it=>({...it,_partidaIdx:i})), p, cat, tipoML);
    bodyHTML = form + table;
  }

  return `
  <div class="partida-card${isOpen?' tiene-valor':''}${isOpen?' open':''}" id="pc-${i}">
    <div class="partida-header" onclick="_toggleCard(${i})">
      <span class="partida-nombre">${p.n}<\/span>
      <span class="partida-um" style="background:${umBg};color:${umTxt}">${p.u}<\/span>
      <span class="partida-valor" id="pv-${i}">${tieneValor ? met+' '+p.u : '— sin dato —'}<\/span>
      <i class="ti ti-chevron-${isOpen?'up':'down'}" id="chev-${i}" style="color:var(--text3);font-size:13px;flex-shrink:0"><\/i>
    <\/div>
    <div class="partida-body" id="pb-${i}">${bodyHTML}<\/div>
  <\/div>`;
}

// ==================== METRADOS — 3 BLOQUES ====================
function _zonasFrente(frente) {
  const rows = PREFIJOS.filter(r => r.f === frente);
  if (!rows.length) return [];
  return [...new Set(rows.map(r => r.z))];
}
function _sostsFrente(frente, zona) {
  const rows = PREFIJOS.filter(r => r.f === frente && r.z === zona);
  return [...new Set(rows.map(r => r.s))];
}
function _getPrefijosInfo(frente, zona, sost) {
  const row = PREFIJOS.find(r => r.f === frente && r.z === zona && r.s === sost);
  if (!row) return {prefijos:[], plano:'', isManual:false};
  if (row.s === 'Manual') return {prefijos:[], plano:'', isManual:true};
  const prefijos = row.p ? row.p.split(',').map(x => x.trim()).filter(Boolean) : [];
  return {prefijos, plano: row.pl || '', isManual:false};
}
function _getPlanoFromPrefijo(frente, zona, sost) {
  return _getPrefijosInfo(frente, zona, sost).plano || '';
}
function _buildCodigo(prefijo, numero) {
  if (!prefijo) return '';
  return prefijo + numero;
}
function _togglePartLibres() {
  const body = document.getElementById('partlibre-body');
  const chev = document.getElementById('chev-partlibre');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chev) chev.style.transform = open ? '' : 'rotate(180deg)';
}
function _toggleBloque(num) {
  const body = document.getElementById('blq'+num+'-body');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  // Cierra todos los bloques
  [1,2,3].forEach(n => {
    const b = document.getElementById('blq'+n+'-body');
    const c = document.getElementById('chev-blq'+n);
    if (b) b.style.display = 'none';
    if (c) c.className = 'ti ti-chevron-down';
  });
  // Abre el clickeado si estaba cerrado
  if (!isOpen) {
    body.style.display = '';
    const chev = document.getElementById('chev-blq'+num);
    if (chev) chev.className = 'ti ti-chevron-up';
  }
}
function _blqHoraOpts(sel) { return '<option value="">--</option>'+_MEDIAS_HORAS.map(h=>`<option${h===sel?' selected':''}>${h}</option>`).join(''); }
// Fila con tarjeta + stepper, compartida entre Bloque 1 (preliminares) y Bloque 3 (complementarias).
function _blqRowHTML(p, i, val, hor, prefix, accent) {
  const hasVal = val !== '';
  const tmpFn  = prefix === 'blq1' ? '_blq1Tmp' : '_blq3Tmp';
  const setFn  = prefix === 'blq1' ? '_setBlq1' : '_setBlq3';
  const horFn  = prefix === 'blq1' ? '_setBlq1Hor' : '_setBlq3Hor';
  return '<div class="blq-row' + (hasVal ? ' has-val' : '') + '" style="--row-accent:' + accent + '">'
    + '<div class="blq-row-top">'
    + '<span class="blq-row-title">' + p.n + '</span>'
    + '<span class="unit-pill">' + p.u + '</span>'
    + '</div>'
    + '<div class="blq-row-bottom">'
    + '<span class="blq-row-label">Cantidad ejecutada</span>'
    + '<div class="stepper">'
    + '<button type="button" class="stepper-btn" onclick="_blqStep(\'' + prefix + '\',' + i + ',-1)" aria-label="Restar">−</button>'
    + '<input type="number" min="0" step="0.01" inputmode="decimal" value="' + val + '" id="' + prefix + '-inp-' + i + '"'
    + ' class="stepper-input" oninput="' + tmpFn + '(' + i + ',this.value)" onblur="' + setFn + '(' + i + ',this.value)">'
    + '<button type="button" class="stepper-btn" onclick="_blqStep(\'' + prefix + '\',' + i + ',1)" aria-label="Sumar">+</button>'
    + '</div>'
    + '</div>'
    + (hasVal ? '<div class="blq-row-horarios">'
      + '<div class="field" style="margin:0"><label style="font-size:10px;color:var(--text3)">Inicio</label><select class="time-field" onchange="' + horFn + '(' + i + ',\'inicio\',this.value)" style="font-size:13px">' + _blqHoraOpts(hor.inicio||'') + '</select></div>'
      + '<div class="field" style="margin:0"><label style="font-size:10px;color:var(--text3)">Fin</label><select class="time-field" onchange="' + horFn + '(' + i + ',\'fin\',this.value)" style="font-size:13px">' + _blqHoraOpts(hor.fin||'') + '</select></div>'
      + '</div>' : '')
    + '</div>';
}
function renderBloque1() {
  const cont = document.getElementById('blq1-rows');
  if (!cont) return;
  let html = '';
  PARTIDAS_PRELIMINARES.forEach((p, i) => {
    const val = blq1Valores[i] !== undefined && blq1Valores[i] !== '' ? blq1Valores[i] : '';
    const hor = blq1Horarios[i] || {};
    html += _blqRowHTML(p, i, val, hor, 'blq1', 'var(--blue-text)');
  });
  cont.innerHTML = html;
}
function renderBloque3() {
  const cont = document.getElementById('blq3-rows');
  if (!cont) return;
  let html = '';
  PARTIDAS_COMPLEMENTARIAS.forEach((p, i) => {
    const val = blq3Valores[i] !== undefined && blq3Valores[i] !== '' ? blq3Valores[i] : '';
    const hor = blq3Horarios[i] || {};
    html += _blqRowHTML(p, i, val, hor, 'blq3', 'var(--green)');
  });
  cont.innerHTML = html;
}
// Botones +/- del stepper: ajustan el input visible y reusan el mismo commit que el blur manual.
function _blqStep(prefix, i, delta) {
  const inp = document.getElementById(prefix + '-inp-' + i);
  if (!inp) return;
  const next = Math.max(0, Math.round(((parseFloat(inp.value) || 0) + delta) * 100) / 100);
  inp.value = next;
  if (prefix === 'blq1') _setBlq1(i, String(next)); else _setBlq3(i, String(next));
}
function _blq1Tmp(i, val) { blq1Valores[i] = val !== '' ? val : ''; saveDraft(); }
function _blq3Tmp(i, val) { blq3Valores[i] = val !== '' ? val : ''; saveDraft(); }
function _setBlq1(i, val) { blq1Valores[i] = val !== '' ? Number(val) : ''; saveDraft(); renderBloque1(); }
function _setBlq3(i, val) { blq3Valores[i] = val !== '' ? Number(val) : ''; saveDraft(); renderBloque3(); }
function _setBlq1Hor(i, campo, val) { if (!blq1Horarios[i]) blq1Horarios[i] = {}; blq1Horarios[i][campo] = val; saveDraft(); }
function _setBlq3Hor(i, campo, val) { if (!blq3Horarios[i]) blq3Horarios[i] = {}; blq3Horarios[i][campo] = val; saveDraft(); }

function _htmlBloque2Form(tipo, frente) {
  const labels = {perf:'🔩 Perforaciones (ML)', iny:'💉 Inyecciones (ML)', malla:'🕸️ Mallas (M2)', cable:'🔗 Cable (ML)'};
  const zonas = _zonasFrente(frente);
  const firstZona = zonas.length ? zonas[0] : '';
  const firstSosts = _sostsFrente(frente, firstZona);
  const zonaOpts = zonas.map(z => '<option value="' + z + '">' + (z || '(general)') + '</option>').join('');
  const sostOpts = firstSosts.map(s => '<option value="' + s + '">' + s + '</option>').join('') || '<option value="Manual">Manual</option>';
  let f = '';
  // Zona + Sost
  f += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
    + '<div class="field"><label style="font-size:11px">Zona</label><select id="c2-' + tipo + '-zona" onchange="_onZonaCriticoChange(\'' + tipo + '\')">' + zonaOpts + '</select></div>'
    + '<div class="field"><label style="font-size:11px">Sostenimiento</label><select id="c2-' + tipo + '-sost" onchange="_updatePrefijoCritico(\'' + tipo + '\')">' + sostOpts + '</select></div>'
    + '</div>';
  // Prefijo display
  f += '<div id="c2-' + tipo + '-prow" style="background:var(--bg2);border-radius:8px;padding:7px 10px;margin-bottom:8px;font-size:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<span style="color:var(--text3)">Prefijo:</span>'
    + '<strong id="c2-' + tipo + '-prefijo" style="font-family:ui-monospace,monospace;color:var(--blue)">—</strong>'
    + '<span id="c2-' + tipo + '-psel-w" style="display:none"><select id="c2-' + tipo + '-psel" style="font-family:ui-monospace,monospace;font-size:12px;padding:2px 6px;border:1px solid var(--border-md);border-radius:4px;background:var(--bg1)"></select></span>'
    + '<span id="c2-' + tipo + '-pman-w" style="display:none"><input type="text" id="c2-' + tipo + '-pman" placeholder="Ej: VM07-" style="width:80px;font-family:ui-monospace,monospace;font-size:12px;padding:3px 6px;border:1px solid var(--border-md);border-radius:4px"></span>'
    + '<span style="color:var(--text3);margin-left:4px">Plano:</span>'
    + '<span id="c2-' + tipo + '-plano" style="color:var(--green-text)">—</span>'
    + '</div>';
  // Tipo/Diámetro (perf)
  if (tipo === 'perf') {
    f += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
      + '<div class="field"><label style="font-size:11px">Tipo</label><select id="c2-perf-tipo">'
      + TIPOS_PERNO_CRITICO.map(t => '<option>' + t + '</option>').join('') + '</select></div>'
      + '<div class="field"><label style="font-size:11px">Diámetro</label><select id="c2-perf-diam" onchange="_togDiamOtro()">'
      + DIAMETROS_PERNO_CRITICO.map(d => '<option>' + d + '</option>').join('')
      + '<option value="__otro__">Otro</option></select></div></div>'
      + '<div id="c2-perf-diam-otro-w" style="display:none;margin-bottom:8px"><div class="field"><label style="font-size:11px">Diámetro (mm)</label><input type="number" id="c2-perf-diam-otro" min="1" placeholder="41"></div></div>';
  }
  // Tipo malla + código
  if (tipo === 'malla') {
    f += '<div class="field" style="margin-bottom:8px"><label style="font-size:11px">Tipo de malla</label><select id="c2-malla-tipo">'
      + TIPOS_MALLA_STD.map(t => '<option>' + t + '</option>').join('') + '</select></div>'
      + '<div class="field" style="margin-bottom:8px"><label style="font-size:11px">Código</label><input type="text" id="c2-malla-codigo" placeholder="Ej: M1" style="font-family:ui-monospace,monospace;font-size:13px"></div>';
  }
  // Tipo cable
  if (tipo === 'cable') {
    f += '<div class="field" style="margin-bottom:8px"><label style="font-size:11px">Tipo</label><select id="c2-cable-tipo">'
      + TIPOS_CABLE_STD.map(t => '<option>' + t + '</option>').join('') + '</select></div>';
  }
  // Rango N°
  if (tipo !== 'malla') {
    f += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:end;margin-bottom:8px">'
      + '<div class="field"><label style="font-size:11px">N° inicio</label><input type="number" id="c2-' + tipo + '-n1" min="1" step="1" style="font-family:ui-monospace,monospace"></div>'
      + '<div style="padding-bottom:10px;color:var(--text3)">→</div>'
      + '<div class="field"><label style="font-size:11px">N° fin (opc)</label><input type="number" id="c2-' + tipo + '-n2" min="1" step="1" style="font-family:ui-monospace,monospace"></div></div>';
  }
  // Letra + Perforadora en la misma fila (perf); sólo Letra para iny
  if (tipo === 'perf') {
    f += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
      + '<div class="field"><label style="font-size:11px">Letra (opcional)</label><input type="text" id="c2-perf-letra" maxlength="3" placeholder="Ej: R" style="font-family:ui-monospace,monospace;text-transform:uppercase"></div>'
      + '<div class="field"><label style="font-size:11px">Perforadora</label>'
      + '<div style="display:flex;gap:8px;margin-top:6px;align-items:center">'
      + '<label id="lbl-toku" onclick="_perf_sel_radio(this)" style="display:inline-flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;padding:5px 14px;border-radius:20px;border:2px solid var(--blue);background:var(--blue);color:#fff;font-weight:600;transition:all .15s"><input type="radio" name="c2-perf-perforadora" value="Toku" id="c2-perf-toku" checked style="display:none"> Toku</label>'
      + '<label id="lbl-patin" onclick="_perf_sel_radio(this)" style="display:inline-flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;padding:5px 14px;border-radius:20px;border:2px solid var(--blue);background:transparent;color:var(--blue);font-weight:600;transition:all .15s"><input type="radio" name="c2-perf-perforadora" value="Patín" id="c2-perf-patin" style="display:none"> Patín</label>'
      + '</div></div>'
      + '</div>';
  } else if (tipo === 'iny') {
    f += '<div class="field" style="margin-bottom:8px">'
      + '<label style="font-size:11px">Letra (opcional) <span style="color:var(--text3);font-weight:400">— para códigos tipo R3, R5, etc.</span></label>'
      + '<input type="text" id="c2-iny-letra" maxlength="3" placeholder="Ej: R" style="font-family:ui-monospace,monospace;text-transform:uppercase;width:72px"></div>';
  }
  // ML / Ancho×Largo
  if (tipo === 'malla') {
    f += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:end;margin-bottom:8px">'
      + '<div class="field"><label style="font-size:11px">Ancho (m)</label><input type="number" id="c2-malla-ancho" min="0" step="0.01" oninput="_prevAreaC()"></div>'
      + '<div style="padding-bottom:10px;color:var(--text3)">×</div>'
      + '<div class="field"><label style="font-size:11px">Largo (m)</label><input type="number" id="c2-malla-largo" min="0" step="0.01" oninput="_prevAreaC()"></div></div>'
      + '<div id="c2-malla-area-prev" style="display:none;background:var(--bg2);border-radius:6px;padding:6px 10px;font-size:12px;margin-bottom:8px">= <strong id="c2-malla-area-val">0</strong> M2</div>';
  } else if (tipo === 'perf' || tipo === 'iny') {
    // Longitud + Ubicación en la misma fila
    f += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
      + '<div class="field"><label style="font-size:11px">Longitud (ML)</label><input type="number" id="c2-' + tipo + '-ml" min="0" step="0.01" placeholder="0.00"></div>'
      + '<div class="field"><label style="font-size:11px">Ubicación</label><select id="c2-' + tipo + '-ubic">'
      + UBICACIONES_CRITICAS.map(u => '<option>' + u + '</option>').join('') + '</select></div>'
      + '</div>';
  } else {
    // cable: sólo longitud
    f += '<div class="field" style="margin-bottom:8px"><label style="font-size:11px">Longitud (ML)</label><input type="number" id="c2-' + tipo + '-ml" min="0" step="0.01" placeholder="0.00"></div>';
  }
  // Hora de ejecución (hora exacta con input type=time)
  f += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'
    + '<div class="field"><label style="font-size:11px">Hora inicio</label><input type="time" id="c2-' + tipo + '-hinicio"></div>'
    + '<div class="field"><label style="font-size:11px">Hora fin</label><input type="time" id="c2-' + tipo + '-hfin"></div>'
    + '</div>';
  const addBtn = '<button onclick="_addCritico(\'' + tipo + '\')" style="width:100%;padding:9px;background:var(--blue);color:#fff;border:none;border-radius:var(--r-md);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:12px"><i class="ti ti-plus"></i> Agregar</button>';
  return '<div style="margin-bottom:8px;border:1px solid var(--border-md);border-radius:var(--r-md);overflow:hidden">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;background:var(--bg2);gap:8px" onclick="_togCritico(\'' + tipo + '\')">'
    + '<span style="font-size:13px;font-weight:700;color:var(--text1)">' + labels[tipo] + '</span>'
    + '<span style="display:flex;align-items:center;gap:8px">'
    + '<span id="c2-' + tipo + '-badge" style="font-size:11px;color:var(--green-text);background:var(--bg3);padding:2px 8px;border-radius:20px"></span>'
    + '<i class="ti ti-chevron-right" id="c2-' + tipo + '-chev" style="color:var(--text3);transition:transform .2s"></i>'
    + '</span>'
    + '</div>'
    + '<div id="c2-' + tipo + '-body" style="display:none;padding:12px">' + f + addBtn + '<div id="c2-' + tipo + '-items"></div></div>'
    + '</div>';
}

function _getCriticoResumen(tipo) {
  const items = controlItems.filter(c => {
    if (tipo === 'perf')  return c.elemento === 'Perno' && c.actividad === 'Perforación';
    if (tipo === 'iny')   return c.elemento === 'Perno' && c.actividad === 'Inyección';
    if (tipo === 'malla') return c.elemento === 'Malla';
    if (tipo === 'cable') return c.elemento === 'Cable';
    return false;
  });
  if (!items.length) return '';
  const total = items.reduce((s,c) => s + Number(c.cantidad||0), 0);
  const u = tipo === 'malla' ? 'M2' : 'ML';
  return items.length + ' reg · ' + Math.round(total*100)/100 + ' ' + u;
}

function _updateCriticoHeaders() {
  ['perf','iny','malla','cable'].forEach(t => {
    const badge = document.getElementById('c2-' + t + '-badge');
    if (badge) badge.textContent = _getCriticoResumen(t);
  });
}

function _togCritico(tipo) {
  const tipos = ['perf','iny','malla','cable'];
  const body = document.getElementById('c2-' + tipo + '-body');
  const chev = document.getElementById('c2-' + tipo + '-chev');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  // Cierra todos
  tipos.forEach(t => {
    const b = document.getElementById('c2-' + t + '-body');
    const c = document.getElementById('c2-' + t + '-chev');
    if (b) b.style.display = 'none';
    if (c) c.style.transform = '';
  });
  // Abre el clickeado si estaba cerrado
  if (!isOpen) {
    body.style.display = '';
    if (chev) chev.style.transform = 'rotate(90deg)';
    _updatePrefijoCritico(tipo);
  }
  _updateCriticoHeaders();
}

function renderBloque2() {
  const frente = (document.getElementById('f-frente') || {}).value || '';
  const cont = document.getElementById('blq2-rows');
  if (!cont) return;
  if (!frente) { cont.innerHTML = '<div class="empty-msg">Selecciona primero el frente en la pestaña Datos.</div>'; return; }
  cont.innerHTML = _htmlBloque2Form('perf',frente) + _htmlBloque2Form('iny',frente) + _htmlBloque2Form('malla',frente) + _htmlBloque2Form('cable',frente);
  _renderCriticaItems();
  ['perf','iny','malla','cable'].forEach(t => _updatePrefijoCritico(t));
}

function _onZonaCriticoChange(tipo) {
  const frente = (document.getElementById('f-frente') || {}).value || '';
  const zonaEl = document.getElementById('c2-' + tipo + '-zona');
  const sostEl = document.getElementById('c2-' + tipo + '-sost');
  if (!zonaEl || !sostEl) return;
  const sosts = _sostsFrente(frente, zonaEl.value);
  sostEl.innerHTML = sosts.map(s => '<option value="' + s + '">' + s + '</option>').join('') || '<option value="Manual">Manual</option>';
  _updatePrefijoCritico(tipo);
}

function _updatePrefijoCritico(tipo) {
  const frente = (document.getElementById('f-frente') || {}).value || '';
  const zonaEl = document.getElementById('c2-' + tipo + '-zona');
  const sostEl = document.getElementById('c2-' + tipo + '-sost');
  const pEl    = document.getElementById('c2-' + tipo + '-prefijo');
  const plEl   = document.getElementById('c2-' + tipo + '-plano');
  const pSelW  = document.getElementById('c2-' + tipo + '-psel-w');
  const pSelEl = document.getElementById('c2-' + tipo + '-psel');
  const pManW  = document.getElementById('c2-' + tipo + '-pman-w');
  if (!zonaEl || !sostEl || !pEl) return;
  const info = _getPrefijosInfo(frente, zonaEl.value, sostEl.value);
  if (info.isManual) {
    if (pEl) pEl.textContent = 'Manual';
    if (plEl) plEl.textContent = '—';
    if (pSelW) pSelW.style.display = 'none';
    if (pManW) pManW.style.display = '';
    return;
  }
  if (pManW) pManW.style.display = 'none';
  if (plEl) plEl.textContent = info.plano || '—';
  if (info.prefijos.length > 1) {
    if (pEl) pEl.textContent = '';
    if (pSelW) pSelW.style.display = '';
    if (pSelEl) pSelEl.innerHTML = info.prefijos.map(p => '<option value="' + p + '">' + p + '</option>').join('');
  } else {
    if (pSelW) pSelW.style.display = 'none';
    if (pEl) pEl.textContent = info.prefijos[0] || '—';
  }
}

function _getPrefijoActivoCritico(tipo) {
  const frente = (document.getElementById('f-frente') || {}).value || '';
  const zonaEl = document.getElementById('c2-' + tipo + '-zona');
  const sostEl = document.getElementById('c2-' + tipo + '-sost');
  if (!zonaEl || !sostEl) return {prefijo:'',zona:'',sost:'',plano:'',isManual:false};
  const zona = zonaEl.value; const sost = sostEl.value;
  const info = _getPrefijosInfo(frente, zona, sost);
  if (info.isManual) {
    const manual = (document.getElementById('c2-' + tipo + '-pman') || {}).value || '';
    return {prefijo:manual, zona, sost, plano:'', isManual:true};
  }
  let prefijo;
  if (info.prefijos.length > 1) {
    const selEl = document.getElementById('c2-' + tipo + '-psel');
    prefijo = selEl ? selEl.value : info.prefijos[0];
  } else {
    prefijo = info.prefijos[0] || '';
  }
  return {prefijo, zona, sost, plano:info.plano, isManual:false};
}

function _togDiamOtro() {
  const sel = document.getElementById('c2-perf-diam');
  const w   = document.getElementById('c2-perf-diam-otro-w');
  if (w) w.style.display = (sel && sel.value === '__otro__') ? '' : 'none';
}

function _prevAreaC() {
  const ancho = parseFloat((document.getElementById('c2-malla-ancho') || {}).value) || 0;
  const largo = parseFloat((document.getElementById('c2-malla-largo') || {}).value) || 0;
  const prev = document.getElementById('c2-malla-area-prev');
  const val  = document.getElementById('c2-malla-area-val');
  if (prev && val) {
    if (ancho > 0 && largo > 0) { prev.style.display = ''; val.textContent = (Math.round(ancho*largo*1000)/1000).toFixed(3); }
    else { prev.style.display = 'none'; }
  }
}

function _perf_sel_radio(lbl) {
  const input = lbl.querySelector('input[type=radio]');
  if (!input) return;
  input.checked = true;
  ['lbl-toku','lbl-patin'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const sel = el.querySelector('input[type=radio]').value === input.value;
    el.style.background = sel ? 'var(--blue)' : 'transparent';
    el.style.color = sel ? '#fff' : 'var(--blue)';
  });
}
function _addCritico(tipo) {
  const frente = (document.getElementById('f-frente') || {}).value || '';
  const meta   = getMeta();
  const {prefijo, zona, sost, plano} = _getPrefijoActivoCritico(tipo);
  const ubicEl = document.getElementById('c2-' + tipo + '-ubic');
  const ubicacion = ubicEl ? ubicEl.value : '';
  if (tipo === 'malla') {
    const tipoMalla = (document.getElementById('c2-malla-tipo') || {}).value || '';
    const ancho = parseFloat((document.getElementById('c2-malla-ancho') || {}).value) || 0;
    const largo = parseFloat((document.getElementById('c2-malla-largo') || {}).value) || 0;
    if (!ancho || !largo) { showToast('⚠️ Ingresa ancho y largo'); return; }
    const m2 = Math.round(ancho*largo*1000)/1000;
    const codigoManual = (document.getElementById('c2-malla-codigo') || {}).value || '';
    const codigo = codigoManual || (prefijo ? prefijo + (_controlId+1) : '');
    const mallaHIni = (document.getElementById('c2-malla-hinicio')||{}).value||'';
    const mallaHFin = (document.getElementById('c2-malla-hfin')||{}).value||'';
    controlItems.push({id:_controlId++, fecha:meta.fecha||'', frente, sistema:sost, zona, elemento:'Malla', tipo:tipoMalla, actividad:'Instalación', codigo, ubicacion:'', cantidad:m2, unidad:'M2', ancho, largo, diametro:'', plano, tipoPerforadora:'', horaInicio:mallaHIni, horaFin:mallaHFin, partidaCodigo:'2. Críticas', partidaNombre:'Instalación de mallas'});
    showToast('✅ Malla '+m2+' M2 agregada');
    const aEl=document.getElementById('c2-malla-ancho'); if(aEl)aEl.value='';
    const lEl=document.getElementById('c2-malla-largo'); if(lEl)lEl.value='';
    const cEl=document.getElementById('c2-malla-codigo'); if(cEl)cEl.value='';
    const pv=document.getElementById('c2-malla-area-prev'); if(pv)pv.style.display='none';
    const mhI=document.getElementById('c2-malla-hinicio'); if(mhI)mhI.value='';
    const mhF=document.getElementById('c2-malla-hfin'); if(mhF)mhF.value='';
  } else if (tipo === 'cable') {
    const tipoCable = (document.getElementById('c2-cable-tipo') || {}).value || '';
    const n1 = parseInt((document.getElementById('c2-cable-n1') || {}).value) || null;
    const n2 = parseInt((document.getElementById('c2-cable-n2') || {}).value) || null;
    const ml = parseFloat((document.getElementById('c2-cable-ml') || {}).value) || 0;
    if (!n1) { showToast('⚠️ Ingresa N° inicio'); return; }
    if (!ml)  { showToast('⚠️ Ingresa la longitud'); return; }
    const fin = (n2 && n2 >= n1) ? n2 : n1;
    const codInicio = prefijo ? _buildCodigo(prefijo, n1) : 'C-' + n1;
    const codFin    = fin > n1 ? (prefijo ? _buildCodigo(prefijo, fin) : 'C-' + fin) : '';
    const cod = codFin ? codInicio + ' → ' + codFin : codInicio;
    const cableHIni = (document.getElementById('c2-cable-hinicio')||{}).value||'';
    const cableHFin = (document.getElementById('c2-cable-hfin')||{}).value||'';
    controlItems.push({id:_controlId++, fecha:meta.fecha||'', frente, sistema:sost, zona, elemento:'Cable', tipo:tipoCable, actividad:'Instalación', codigo:cod, ubicacion:'', cantidad:ml, unidad:'ML', ancho:'', largo:'', diametro:'', plano, tipoPerforadora:'', horaInicio:cableHIni, horaFin:cableHFin, partidaCodigo:'2. Críticas', partidaNombre:'Instalación de cable'});
    showToast('✅ Cable ' + cod + ' ' + ml + ' ML');
    const e1=document.getElementById('c2-cable-n1'); if(e1)e1.value='';
    const e2=document.getElementById('c2-cable-n2'); if(e2)e2.value='';
    const em=document.getElementById('c2-cable-ml'); if(em)em.value='';
    const chI=document.getElementById('c2-cable-hinicio'); if(chI)chI.value='';
    const chF=document.getElementById('c2-cable-hfin'); if(chF)chF.value='';
  } else {
    const actLabel = tipo==='perf' ? 'Perforación' : 'Inyección';
    const tipoPerno = tipo==='perf' ? ((document.getElementById('c2-perf-tipo')||{}).value||'') : '';
    const perfRadio = tipo==='perf' ? (document.querySelector('input[name="c2-perf-perforadora"]:checked')||{}).value||'' : '';
    let diamPerno = '';
    if (tipo==='perf') { const dSel=document.getElementById('c2-perf-diam'); if(dSel) diamPerno=dSel.value==='__otro__'?((document.getElementById('c2-perf-diam-otro')||{}).value||'')+'mm':dSel.value; }
    const horaIni = (document.getElementById('c2-'+tipo+'-hinicio')||{}).value||'';
    const horaFin2 = (document.getElementById('c2-'+tipo+'-hfin')||{}).value||'';
    const letra = ((document.getElementById('c2-'+tipo+'-letra')||{}).value||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);
    const n1 = parseInt((document.getElementById('c2-'+tipo+'-n1')||{}).value)||null;
    const n2 = parseInt((document.getElementById('c2-'+tipo+'-n2')||{}).value)||null;
    const ml  = parseFloat((document.getElementById('c2-'+tipo+'-ml')||{}).value)||0;
    if (!n1) { showToast('⚠️ Ingresa N° inicio'); return; }
    if (!ml)  { showToast('⚠️ Ingresa la longitud'); return; }
    const fin = (n2&&n2>=n1)?n2:n1;
    if (fin-n1>200) { showToast('⚠️ Rango máximo 200'); return; }
    for (let n=n1; n<=fin; n++) { const cod=prefijo?(prefijo+letra+n):(letra?letra+n:''); controlItems.push({id:_controlId++, fecha:meta.fecha||'', frente, sistema:sost, zona, elemento:'Perno', tipo:tipoPerno, actividad:actLabel, codigo:cod, ubicacion, cantidad:ml, unidad:'ML', ancho:'', largo:'', diametro:diamPerno, plano, tipoPerforadora:perfRadio, horaInicio:horaIni, horaFin:horaFin2, partidaCodigo:'2. Críticas', partidaNombre:actLabel==='Perforación'?'Perforaciones':'Inyecciones'}); }
    const libCheck = prefijo?_lookupPerno(frente,_buildCodigo(prefijo,n1)):null;
    if (libCheck&&ml&&Math.abs(ml-libCheck.l)>0.001) showToast('⚠️ ML '+ml+' difiere de biblioteca');
    else showToast('✅ '+(fin-n1+1)+' '+actLabel.toLowerCase()+'(s)');
    const e1=document.getElementById('c2-'+tipo+'-n1'); if(e1)e1.value='';
    const e2=document.getElementById('c2-'+tipo+'-n2'); if(e2)e2.value='';
    const em=document.getElementById('c2-'+tipo+'-ml'); if(em)em.value='';
    const el=document.getElementById('c2-'+tipo+'-letra'); if(el)el.value='';
    const phI=document.getElementById('c2-'+tipo+'-hinicio'); if(phI)phI.value='';
    const phF=document.getElementById('c2-'+tipo+'-hfin'); if(phF)phF.value='';
  }
  _renderCriticaItems();
  saveDraft();
}

function _renderCriticaItems() {
  _updateCriticoHeaders();
  ['perf','iny','malla','cable'].forEach(tipo => {
    const cont = document.getElementById('c2-'+tipo+'-items');
    if (!cont) return;
    const items = controlItems.filter(c =>
      tipo==='perf'  ? (c.elemento==='Perno'&&c.actividad==='Perforación') :
      tipo==='iny'   ? (c.elemento==='Perno'&&c.actividad==='Inyección') :
      tipo==='malla' ? c.elemento==='Malla' : c.elemento==='Cable'
    );
    if (!items.length) { cont.innerHTML=''; return; }
    let html = '<div style="overflow-x:auto;margin-top:4px"><table style="width:100%;border-collapse:collapse;font-size:11px">'
      + '<tr style="background:var(--bg2)"><th style="padding:5px 6px;text-align:left;color:var(--text3)">Código</th>'
      + (tipo==='perf'?'<th style="padding:5px 6px;color:var(--text3)">Tipo/Ø</th>':'')
      + (tipo==='malla'?'<th style="padding:5px 6px;color:var(--text3)">Tipo malla</th>':'')
      + '<th style="padding:5px 6px;color:var(--text3)">Cant.</th>'
      + (tipo==='perf'||tipo==='iny'?'<th style="padding:5px 6px;color:var(--text3)">Ubic.</th>':'')
      + '<th style="padding:5px 2px;width:28px"></th></tr>';
    items.forEach(c => {
      html += '<tr style="border-bottom:1px solid var(--border-sm)">'
        + '<td style="padding:5px 6px;font-family:ui-monospace,monospace">'+(c.codigo||'—')+'</td>'
        + (tipo==='perf'?'<td style="padding:5px 6px;color:var(--text3)">'+ [c.tipo,c.diametro].filter(Boolean).join(' ')+'</td>':'')
        + (tipo==='malla'?'<td style="padding:5px 6px;color:var(--text3)">'+(c.tipo||'—')+'</td>':'')
        + '<td style="padding:5px 6px;text-align:right">'+c.cantidad+' '+c.unidad+'</td>'
        + (tipo==='perf'||tipo==='iny'?'<td style="padding:5px 6px;color:var(--text3)">'+(c.ubicacion||'')+'</td>':'')
        + '<td style="padding:5px 2px;text-align:center"><button onclick="_borrarCritico('+c.id+')" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:16px;font-weight:700;padding:2px 6px;line-height:1;border-radius:4px" aria-label="Eliminar">×</button></td></tr>';
    });
    html += '</table></div>';
    cont.innerHTML = html;
  });
}

function _borrarCritico(id) {
  controlItems = controlItems.filter(c => c.id !== id);
  _renderCriticaItems();
  saveDraft();
}

// ── Renderizar los 3 bloques de metrados ──────────────────────────────────
function renderMetradosPartidas() {
  renderBloque1();
  renderBloque2();
  renderBloque3();
}
// (función legacy — conservada para compatibilidad interna)
function _renderMetradosPartidasLegacy() {
  const frente    = document.getElementById('f-frente').value;
  const container = document.getElementById('metrados-rows');
  if (!container) return;
  const lista = frente ? (PARTIDAS[frente] || []) : [];
  if (!frente) {
    container.innerHTML = '<div class="empty-msg">Selecciona primero el sector y frente en la pestaña Datos.<\/div>';
    return;
  }
  if (!lista.length) {
    container.innerHTML = '<div class="empty-msg">Este frente no tiene partidas catalogadas. Usa la sección de partidas libres.<\/div>';
    return;
  }

  let html = '';
  let lastSub = null;
  lista.forEach((p, i) => {
    _ensurePV(i);
    if (p.s && p.s !== lastSub) {
      lastSub = p.s;
      html += `<div class="subtitulo-header">${p.s}<\/div>`;
    }
    html += _renderCard(p, i);
  });
  container.innerHTML = html;
}

// ── Acciones sobre las tarjetas ────────────────────────────────────────────
function _toggleCard(i) {
  const card = document.getElementById('pc-'+i);
  const body = document.getElementById('pb-'+i);
  const chev = document.getElementById('chev-'+i);
  if (!card||!body) return;
  const open = body.style.display !== 'none' && body.style.display !== '';
  // La clase open controla display via CSS
  if (card.classList.contains('open')) {
    card.classList.remove('open');
    if(chev) chev.className='ti ti-chevron-down';
  } else {
    card.classList.add('open');
    if(chev) chev.className='ti ti-chevron-up';
    // Focus first input
    setTimeout(() => {
      const inp = body.querySelector('input');
      if(inp) {inp.focus(); if(inp.select) inp.select();}
    }, 50);
  }
}

function _updateCardUI(i) {
  _ensurePV(i);
  const frente = document.getElementById('f-frente').value;
  const lista  = PARTIDAS[frente] || [];
  const p      = lista[i];
  if (!p) return;
  const met     = partidaValores[i].met;
  const tieneV  = met !== '' && met !== null && met !== undefined;
  const card    = document.getElementById('pc-'+i);
  const valEl   = document.getElementById('pv-'+i);
  if (card) {
    card.classList.toggle('tiene-valor', tieneV);
  }
  if (valEl) {
    valEl.textContent = tieneV ? met+' '+p.u : '— sin dato —';
  }
}

function _simpleChange(i, val) {
  _ensurePV(i);
  partidaValores[i].met = val !== '' ? Number(val) : '';
  _updateCardUI(i);
  saveDraft();
}

function _previewArea(i) {
  const ancho = parseFloat((document.getElementById('pv-ancho-'+i)||{}).value)||0;
  const largo = parseFloat((document.getElementById('pv-largo-'+i)||{}).value)||0;
  const prev  = document.getElementById('pv-area-'+i);
  const val   = document.getElementById('pv-area-val-'+i);
  if (prev && val) {
    if (ancho>0 && largo>0) {
      prev.style.display='block';
      val.textContent = (Math.round(ancho*largo*1000)/1000).toFixed(3);
    } else {
      prev.style.display='none';
    }
  }
}

const _perfInyMode = {}; // {partidaIdx: 'perforacion'|'inyeccion'}

function _buildCodigoPerno(prefijo, numero) {
  // L01/P1- uses 2-digit zero-padding; all other prefixes use plain number
  if (prefijo === 'L01/P1-') return prefijo + String(numero).padStart(2, '0');
  return prefijo + numero;
}
function _lookupPerno(frente, codigoPerno) {
  return BIBLIOTECA_PERNOS[frente + '|' + codigoPerno] || null;
}
function _updatePernoInfo(i) {
  const prefEl = document.getElementById('pv-pref-' + i);
  const numEl  = document.getElementById('pv-pnum-' + i);
  const infoEl = document.getElementById('pv-pinfo-' + i);
  if (!prefEl || !numEl) return;
  const prefijo = prefEl.value;
  const numero  = parseInt(numEl.value, 10);
  if (!prefijo || isNaN(numero) || numero < 1) {
    if (infoEl) infoEl.innerHTML = '';
    return;
  }
  const codigoPerno = _buildCodigoPerno(prefijo, numero);
  const frente = document.getElementById('f-frente') ? document.getElementById('f-frente').value : '';
  const lib = _lookupPerno(frente, codigoPerno);
  if (infoEl) {
    if (lib) {
      infoEl.innerHTML = '<span style="color:var(--green-text)">\u2713 <strong>' + codigoPerno + '</strong> \u00b7 ' + lib.z + ' \u00b7 ' + lib.s + ' \u00b7 L=' + lib.l + 'm \u00b7 \u00d8' + lib.d + 'mm \u00b7 ' + lib.a + (lib.p ? ' \u00b7 Plano: ' + lib.p : '') + '</span>';
    } else {
      infoEl.innerHTML = '<span style="color:var(--text3)"><strong>' + codigoPerno + '</strong> \u2014 no encontrado en biblioteca</span>';
    }
  }
}


// Expande un rango de códigos correlativos (ej. "P01" -> "P20") en la lista completa de códigos.
// Ambos códigos deben compartir el mismo prefijo y terminar en un número. Devuelve null si no
// se puede interpretar como rango válido. Conserva el ancho de ceros a la izquierda del código de inicio.
function _parsearRangoCodigos(desde, hasta) {
  const re = /^(.*?)(\d+)\s*$/;
  const mD = (desde||'').trim().match(re);
  const mH = (hasta||'').trim().match(re);
  if (!mD || !mH) return null;
  const [, prefD, numD] = mD;
  const [, prefH, numH] = mH;
  if (prefD !== prefH) return null;
  const n1 = parseInt(numD, 10);
  const n2 = parseInt(numH, 10);
  if (isNaN(n1) || isNaN(n2) || n2 < n1) return null;
  if ((n2 - n1) > 500) return null; // límite de seguridad ante errores de tipeo
  const ancho = numD.length;
  const codigos = [];
  for (let n = n1; n <= n2; n++) codigos.push(prefD + String(n).padStart(ancho, '0'));
  return codigos;
}
function _setPerfInyMode(i, mode) {
  _perfInyMode[i] = mode;
  const btnP = document.getElementById('btn-perf-'+i);
  const btnI = document.getElementById('btn-iny-'+i);
  const lbl  = document.getElementById('pv-ml-label-'+i);
  if (btnP) { btnP.style.background = mode==='perforacion'?'var(--blue)':'#fff'; btnP.style.color = mode==='perforacion'?'#fff':'var(--text2)'; btnP.style.borderColor = 'var(--blue)'; }
  if (btnI) { btnI.style.background = mode==='inyeccion'?'var(--blue)':'#fff'; btnI.style.color = mode==='inyeccion'?'#fff':'var(--text2)'; btnI.style.borderColor = mode==='inyeccion'?'var(--blue)':'var(--border-md)'; }
  if (lbl) lbl.textContent = mode==='perforacion'?'ML perforados':'ML inyectados';
  const codEl = document.getElementById('pv-cod-'+i);
  if (codEl) codEl.focus();
}

function _toggleAccDetalle(i) {
  const sel  = document.getElementById('pv-acc-tipo-'+i);
  const wrap = document.getElementById('pv-acc-detalle-wrap-'+i);
  if (!sel || !wrap) return;
  wrap.style.display = sel.value === 'Otro' ? '' : 'none';
}

function _addItem(i) {
  const frente = document.getElementById('f-frente').value;
  const lista  = PARTIDAS[frente] || [];
  const p      = lista[i];
  if (!p) return;
  const cat    = _cat(p);
  const tipoML = _tipoML(p);
  const meta   = getMeta();
  _ensurePV(i);

  const base = {
    fecha:  meta.fecha||'',
    frente: meta.frente||'',
    sistema: p.sis||'',
    zona:    p.zona||'',
    sub:     p.s||'',
    elemento:'', tipo:'', actividad:'',
    codigo:'', cantidad:0, unidad: p.u,
    ancho:'', largo:'', ubicacion:''
  };

  let itemsToAdd = [];

  if (cat === 'accesorios') {
    const selTipo = document.getElementById('pv-acc-tipo-'+i);
    const elDet   = document.getElementById('pv-acc-detalle-'+i);
    const elCant  = document.getElementById('pv-acc-cant-'+i);
    const tipoAcc = selTipo ? selTipo.value : 'Placa';
    const detalle = elDet ? elDet.value.trim() : '';
    const cant    = elCant ? Number(elCant.value) : 0;
    if (!cant || cant <= 0) { showToast('Ingresa una cantidad válida ⚠️'); return; }
    if (tipoAcc === 'Otro' && !detalle) { showToast('Indica qué accesorio es ⚠️'); return; }
    itemsToAdd = [{ ...base, id:_controlId++, _partidaIdx:i, elemento:'Accesorio', tipo:tipoAcc, detalle: tipoAcc==='Otro'?detalle:'', actividad:'Instalación de accesorio', cantidad:cant, unidad:'UND' }];
    if (elDet) elDet.value = '';
    if (elCant) { elCant.value=''; elCant.focus(); }
  }
  else if (cat === 'pulltest') {
    const el = document.getElementById('pv-pt-'+i);
    const cod = el ? el.value.trim() : '';
    if (!cod) { showToast('Ingresa el código del perno ⚠️'); return; }
    itemsToAdd = [{ ...base, id:_controlId++, _partidaIdx:i, elemento:'Perno', tipo:'Ensayo', actividad:'Pull Test', codigo:cod, cantidad:1, unidad:'UND' }];
    if(el) el.value='';
    if(el) el.focus();
  }
  else if (cat === 'm2') {
    const codEl   = document.getElementById('pv-cod-'+i);
    const anchoEl = document.getElementById('pv-ancho-'+i);
    const largoEl = document.getElementById('pv-largo-'+i);
    const cod   = codEl   ? codEl.value.trim() : '';
    const ancho = anchoEl ? parseFloat(anchoEl.value)||0 : 0;
    const largo = largoEl ? parseFloat(largoEl.value)||0 : 0;
    if (!cod)          { showToast('Ingresa el código de malla ⚠️'); return; }
    if (!ancho||!largo){ showToast('Ingresa ancho y largo ⚠️'); return; }
    const area = Math.round(ancho*largo*1000)/1000;
    itemsToAdd = [{ ...base, id:_controlId++, _partidaIdx:i, elemento:'Malla', tipo: p.t || 'Malla', actividad:'Instalación', codigo:cod, cantidad:area, unidad:'M2', ancho, largo }];
    if(codEl) codEl.value='';
    if(anchoEl) anchoEl.value='';
    if(largoEl) largoEl.value='';
    const prev = document.getElementById('pv-area-'+i);
    if(prev) prev.style.display='none';
    if(codEl) codEl.focus();
  }
  else if (cat === 'ml' && tipoML === 'cable') {
    const tipoEl  = document.getElementById('pv-tipo-'+i);
    const desdeEl = document.getElementById('pv-desde-'+i);
    const hastaEl = document.getElementById('pv-hasta-'+i);
    const mlEl    = document.getElementById('pv-ml-'+i);
    const desde = desdeEl ? desdeEl.value.trim() : '';
    const hasta = hastaEl ? hastaEl.value.trim() : '';
    const ml    = mlEl    ? parseFloat(mlEl.value)||0 : 0;
    const tipo  = tipoEl  ? tipoEl.value : '';
    if (!desde||!hasta){ showToast('Ingresa punto inicio y fin ⚠️'); return; }
    if (!ml)           { showToast('Ingresa los ML de cable ⚠️'); return; }
    itemsToAdd = [{ ...base, id:_controlId++, _partidaIdx:i, elemento:'Cable', tipo: tipo||'Cable Bolt', actividad:'Instalación', codigo: desde+' - '+hasta, cantidad:ml, unidad:'ML' }];
    if(desdeEl) desdeEl.value='';
    if(hastaEl) hastaEl.value='';
    if(mlEl)    mlEl.value='';
    if(desdeEl) desdeEl.focus();
  }
  else if (cat === 'ml' && tipoML === 'inyeccion') {
    const mlEl   = document.getElementById('pv-ml-'+i);
    const ubicEl = document.getElementById('pv-ubic-'+i);
    const ml     = mlEl ? parseFloat(mlEl.value)||0 : 0;
    const ubicacion = ubicEl ? ubicEl.value : '';
    if (!ml) { showToast('Ingresa los ML ⚠️'); return; }
    if (p.cod) {
      const prefEl    = document.getElementById('pv-pref-'+i);
      const pnumEl    = document.getElementById('pv-pnum-'+i);
      const pnumFinEl = document.getElementById('pv-pnum-fin-'+i);
      const prefijo   = prefEl ? prefEl.value : '';
      const pnum1     = parseInt(pnumEl ? pnumEl.value : '', 10);
      const pnum2Raw  = pnumFinEl ? parseInt(pnumFinEl.value, 10) : NaN;
      const pnum2     = isNaN(pnum2Raw) ? pnum1 : pnum2Raw;
      if (!prefijo)                   { showToast('Selecciona el prefijo ⚠️'); return; }
      if (isNaN(pnum1) || pnum1 < 1) { showToast('Ingresa el N° de perno ⚠️'); return; }
      if (pnum2 < pnum1)              { showToast('N° fin debe ser ≥ N° inicio ⚠️'); return; }
      if ((pnum2 - pnum1) > 200)      { showToast('Rango muy amplio (máx 200) ⚠️'); return; }
      let warnCod = null;
      const codigosP = [];
      for (let n = pnum1; n <= pnum2; n++) {
        const c = _buildCodigoPerno(prefijo, n);
        const lib = _lookupPerno(frente, c);
        if (lib && ml && Math.abs(ml - lib.l) > 0.001) warnCod = warnCod || c;
        codigosP.push(c);
      }
      if (warnCod) showToast('⚠️ ML ' + ml + ' difiere de biblioteca para ' + warnCod);
      itemsToAdd = codigosP.map(c => ({ ...base, id:_controlId++, _partidaIdx:i, elemento:'Perno', tipo:'Inyección', actividad:'Inyección', codigo:c, cantidad:ml, unidad:'ML', ubicacion }));
      if(pnumEl) pnumEl.value='';
      if(pnumFinEl) pnumFinEl.value='';
      if(mlEl)   mlEl.value='';
      if(pnumEl) pnumEl.focus();
    } else {
      const desdeEl = document.getElementById('pv-cod-desde-'+i);
      const hastaEl = document.getElementById('pv-cod-hasta-'+i);
      const desde = desdeEl ? desdeEl.value.trim() : '';
      const hasta = hastaEl ? hastaEl.value.trim() : '';
      if (!desde) { showToast('Ingresa el código de inicio ⚠️'); return; }
      const codigos = _parsearRangoCodigos(desde, hasta || desde);
      if (!codigos) { showToast('Revisa el rango de códigos (ej. P01 → P20) ⚠️'); return; }
      itemsToAdd = codigos.map(c => ({ ...base, id:_controlId++, _partidaIdx:i, elemento:'Perno', tipo:'Inyección', actividad:'Inyección', codigo:c, cantidad:ml, unidad:'ML', ubicacion }));
      if(desdeEl) desdeEl.value='';
      if(hastaEl) hastaEl.value='';
      if(mlEl)    mlEl.value='';
      if(desdeEl) desdeEl.focus();
    }
  }
  else if (cat === 'perf-iny') {
    const mode    = _perfInyMode[i] || 'perforacion';
    const tipoEl  = document.getElementById('pv-tipo-'+i);
    const mlEl    = document.getElementById('pv-ml-'+i);
    const ubicEl  = document.getElementById('pv-ubic-'+i);
    const tipo    = tipoEl ? tipoEl.value : 'BAHE';
    const ml      = mlEl   ? parseFloat(mlEl.value)||0 : 0;
    const ubicacion = ubicEl ? ubicEl.value : '';
    const esPerf  = mode === 'perforacion';
    if (!ml) { showToast('Ingresa los ML ⚠️'); return; }
    if (p.cod) {
      const prefEl    = document.getElementById('pv-pref-'+i);
      const pnumEl    = document.getElementById('pv-pnum-'+i);
      const pnumFinEl = document.getElementById('pv-pnum-fin-'+i);
      const prefijo   = prefEl ? prefEl.value : '';
      const pnum1     = parseInt(pnumEl ? pnumEl.value : '', 10);
      const pnum2Raw  = pnumFinEl ? parseInt(pnumFinEl.value, 10) : NaN;
      const pnum2     = isNaN(pnum2Raw) ? pnum1 : pnum2Raw;
      if (!prefijo)                   { showToast('Selecciona el prefijo ⚠️'); return; }
      if (isNaN(pnum1) || pnum1 < 1) { showToast('Ingresa el N° de perno ⚠️'); return; }
      if (pnum2 < pnum1)              { showToast('N° fin debe ser ≥ N° inicio ⚠️'); return; }
      if ((pnum2 - pnum1) > 200)      { showToast('Rango muy amplio (máx 200) ⚠️'); return; }
      let warnCod = null;
      const codigosP = [];
      for (let n = pnum1; n <= pnum2; n++) {
        const c = _buildCodigoPerno(prefijo, n);
        const lib = _lookupPerno(frente, c);
        if (lib && ml && Math.abs(ml - lib.l) > 0.001) warnCod = warnCod || c;
        codigosP.push(c);
      }
      if (warnCod) showToast('⚠️ ML ' + ml + ' difiere de biblioteca para ' + warnCod);
      itemsToAdd = codigosP.map(c => ({ ...base, id:_controlId++, _partidaIdx:i, elemento:'Perno', tipo: esPerf?tipo:'Inyección', actividad: esPerf?'Perforación':'Inyección', codigo:c, cantidad:ml, unidad:'ML', ubicacion }));
      if(pnumEl) pnumEl.value='';
      if(pnumFinEl) pnumFinEl.value='';
      if(mlEl)   mlEl.value='';
      if(pnumEl) pnumEl.focus();
    } else {
      const desdeEl = document.getElementById('pv-cod-desde-'+i);
      const hastaEl = document.getElementById('pv-cod-hasta-'+i);
      const desde   = desdeEl ? desdeEl.value.trim() : '';
      const hasta   = hastaEl ? hastaEl.value.trim() : '';
      if (!desde) { showToast('Ingresa el código de inicio ⚠️'); return; }
      const codigos = _parsearRangoCodigos(desde, hasta || desde);
      if (!codigos) { showToast('Revisa el rango de códigos (ej. P01 → P20) ⚠️'); return; }
      itemsToAdd = codigos.map(c => ({ ...base, id:_controlId++, _partidaIdx:i, elemento:'Perno', tipo: esPerf?tipo:'Inyección', actividad: esPerf?'Perforación':'Inyección', codigo:c, cantidad:ml, unidad:'ML', ubicacion }));
      if(desdeEl) desdeEl.value='';
      if(hastaEl) hastaEl.value='';
      if(mlEl)    mlEl.value='';
      if(desdeEl) desdeEl.focus();
    }
  }
  else { // perforacion (default ML)
    const tipoEl  = document.getElementById('pv-tipo-'+i);
    const desdeEl = document.getElementById('pv-cod-desde-'+i);
    const hastaEl = document.getElementById('pv-cod-hasta-'+i);
    const mlEl    = document.getElementById('pv-ml-'+i);
    const ubicEl  = document.getElementById('pv-ubic-'+i);
    const tipo    = tipoEl ? tipoEl.value : '';
    const desde   = desdeEl ? desdeEl.value.trim() : '';
    const hasta   = hastaEl ? hastaEl.value.trim() : '';
    const ml      = mlEl   ? parseFloat(mlEl.value)||0 : 0;
    const ubicacion = ubicEl ? ubicEl.value : '';
    if (!desde) { showToast('Ingresa el código de inicio ⚠️'); return; }
    if (!ml)    { showToast('Ingresa los ML perforados ⚠️'); return; }
    const codigos = _parsearRangoCodigos(desde, hasta || desde);
    if (!codigos) { showToast('Revisa el rango de códigos (ej. P01 → P20) ⚠️'); return; }
    itemsToAdd = codigos.map(cod => ({ ...base, id:_controlId++, _partidaIdx:i, elemento:'Perno', tipo: tipo||'BAHE', actividad:'Perforación', codigo:cod, cantidad:ml, unidad:'ML', ubicacion }));
    if(desdeEl) desdeEl.value='';
    if(hastaEl) hastaEl.value='';
    if(mlEl)    mlEl.value='';
    if(desdeEl) desdeEl.focus();
  }

  if (!itemsToAdd.length) return;
  partidaValores[i].items.push(...itemsToAdd);
  _recalc(i);
  saveDraft();

  // Rerenderizar solo el body de esta tarjeta
  const lista2 = PARTIDAS[document.getElementById('f-frente').value]||[];
  const p2 = lista2[i];
  if (p2) {
    const body = document.getElementById('pb-'+i);
    if (body) {
      // perf-iny: _buildForm already includes items table inside
      if (cat === 'perf-iny') {
        body.innerHTML = _buildForm(p2, i, cat, tipoML);
        // Restore current mode so buttons don't reset
        const _curMode = _perfInyMode[i] || 'perforacion';
        setTimeout(() => {
          _setPerfInyMode(i, _curMode);
          // Restore perno selector state if any
          const _ps = _pernoState[i];
          if (_ps) {
            const pfEl = document.getElementById('pv-pref-'+i);
            const pnEl = document.getElementById('pv-pnum-'+i);
            if (pfEl) pfEl.value = _ps.prefijo;
            if (pnEl) pnEl.value = _ps.numero;
            _updatePernoInfo(i);
          }
        }, 0);
      } else {
        body.innerHTML = _buildForm(p2,i,cat,tipoML) + _buildItemsTable(partidaValores[i].items.map(it=>({...it,_partidaIdx:i})),p2,cat,tipoML);
        // Restore perno selector state for non-perf-iny forms too
        setTimeout(() => { const _ps=_pernoState[i]; if(_ps){const pfEl=document.getElementById('pv-pref-'+i);const pnEl=document.getElementById('pv-pnum-'+i);if(pfEl)pfEl.value=_ps.prefijo;if(pnEl)pnEl.value=_ps.numero;_updatePernoInfo(i);} }, 0);
      }
    }
    _updateCardUI(i);
  }
  const primero = itemsToAdd[0], ultimo = itemsToAdd[itemsToAdd.length-1];
  if (cat === 'accesorios') {
    showToast(`${primero.tipo}${primero.detalle?' ('+primero.detalle+')':''}: ${primero.cantidad} agregado ✅`);
  } else {
    showToast(itemsToAdd.length > 1 ? `${itemsToAdd.length} pernos agregados (${primero.codigo}–${ultimo.codigo}) ✅` : (primero.codigo + ' agregado ✅'));
  }
}

function _removeItem(i, itemId) {
  _ensurePV(i);
  partidaValores[i].items = partidaValores[i].items.filter(it => it.id !== itemId);
  _recalc(i);
  saveDraft();
  const frente = document.getElementById('f-frente').value;
  const lista  = PARTIDAS[frente]||[];
  const p      = lista[i];
  if (p) {
    const cat    = _cat(p);
    const tipoML = _tipoML(p);
    const body   = document.getElementById('pb-'+i);
    if (body) {
      body.innerHTML = _buildForm(p,i,cat,tipoML) + _buildItemsTable(partidaValores[i].items.map(it=>({...it,_partidaIdx:i})),p,cat,tipoML);
    }
    _updateCardUI(i);
  }
}

// ── Reconstruir controlItems global desde los items de partidas (para exports) ──
function rebuildControlItems() {
  const meta   = getMeta();
  const frente = meta.frente||'';
  const lista  = PARTIDAS[frente]||[];
  const all    = [];
  lista.forEach((p, i) => {
    if (!partidaValores[i]||!partidaValores[i].items) return;
    if (_cat(p) === 'accesorios') return; // los pares de accesorios no aplican al esquema ML/M2 de este reporte
    partidaValores[i].items.forEach(it => {
      all.push({
        ...it,
        fecha:  it.fecha  || meta.fecha  || '',
        frente: it.frente || frente,
        partidaCodigo: p.e || '',
        partidaNombre: p.n || ''
      });
    });
  });
  controlItems = all;
}
// ==================== FIN MOTOR DE METRADOS ====================


// ==================== MÓDULO STAND BY ====================
// standbyRows[i] = { id, actividad, desde, hasta, causa }
function _sbMinutos(desde, hasta) {
  // Devuelve minutos entre desde y hasta (HH:MM), descontando el traslape con el horario
  // de almuerzo (si está registrado). Si hasta < desde asume cruce de medianoche.
  if (!desde || !hasta) return null;
  const [h1,m1] = desde.split(':').map(Number);
  const [h2,m2] = hasta.split(':').map(Number);
  if ([h1,m1,h2,m2].some(v=>isNaN(v))) return null;
  const inicio = h1*60+m1;
  let fin = h2*60+m2;
  if (fin < inicio) fin += 24*60;
  let diff = fin - inicio;

  // Descuenta el cruce con el refrigerio (almuerzo), si está registrado y no es 00:00
  const almSalidaEl = document.getElementById('f-almuerzo-salida');
  const almRetornoEl = document.getElementById('f-almuerzo-retorno');
  const almSalida = almSalidaEl ? almSalidaEl.value : '';
  const almRetorno = almRetornoEl ? almRetornoEl.value : '';
  if (almSalida && almRetorno && almSalida !== '00:00' && almRetorno !== '00:00') {
    const [ah1,am1] = almSalida.split(':').map(Number);
    const [ah2,am2] = almRetorno.split(':').map(Number);
    if (![ah1,am1,ah2,am2].some(v=>isNaN(v))) {
      const almIni = ah1*60+am1;
      let almFin = ah2*60+am2;
      if (almFin < almIni) almFin += 24*60;
      const solapeIni = Math.max(inicio, almIni);
      const solapeFin = Math.min(fin, almFin);
      const solape = Math.max(0, solapeFin - solapeIni);
      diff -= solape;
    }
  }

  return Math.max(0, diff);
}
function _sbMinutosFila(r) {
  if (r.causa === CAUSA_TIEMPO_TOTAL) {
    const h = parseFloat(r.totalHoras) || 0;
    const m = parseFloat(r.totalMinutos) || 0;
    const tot = Math.round(h * 60 + m);
    return tot > 0 ? tot : null;
  }
  return _sbMinutos(r.desde, r.hasta);
}
function _sbCausaEfectiva(r) {
  if (r.causa === 'OTRO') {
    const otro = (r.causaOtro||'').trim();
    return otro ? 'OTRO: ' + otro.toUpperCase() : 'OTRO';
  }
  return r.causa || '';
}
function _sbFmt(min) {
  // 95 → "1h 35m" / 95 → también "01:35" para exports
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min/60), m = min%60;
  return h + 'h ' + String(m).padStart(2,'0') + 'm';
}
function _sbFmtHHMM(min) {
  if (min === null || min === undefined) return '';
  const h = Math.floor(min/60), m = min%60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}
function _sbCausaEfectiva(r) {
  if (r.causa === 'OTRO') {
    const otro = (r.causaOtro||'').trim();
    return otro ? 'OTRO: ' + otro.toUpperCase() : 'OTRO';
  }
  return r.causa || '';
}
function getStandbyRegistrados() {
  return standbyRows
    .filter(r => (r.actividad && r.actividad.trim()) || r.causa || r.desde || r.hasta || (r.comentario && r.comentario.trim()))
    .map((r, idx) => ({
      item: idx + 1,
      actividad: (r.actividad||'').trim(),
      desde: r.desde || '',
      hasta: r.hasta || '',
      minutos: _sbMinutosFila(r),
      esTiempoTotal: r.causa === CAUSA_TIEMPO_TOTAL,
      causa: _sbCausaEfectiva(r),
      responsable: (r.responsable||'').trim(),
      comentario: (r.comentario||'').trim()
    }));
}
function getStandbyTotalMin() {
  return getStandbyRegistrados().reduce((s,r) => s + (r.minutos||0), 0);
}
function addStandbyRow() {
  standbyRows.push({ id: standbyId++, actividad:'', desde:'', hasta:'', causa:'', causaOtro:'', comentario:'', responsable:'', totalHoras:'', totalMinutos:'' });
  renderStandbyRows();
  saveDraft();
}
function removeStandbyRow(id) {
  standbyRows = standbyRows.filter(r => r.id !== id);
  renderStandbyRows();
  saveDraft();
}
function updateStandby(id, field, val) {
  const r = standbyRows.find(x => x.id === id);
  if (!r) return;
  r[field] = val;
  const min = _sbMinutosFila(r);
  [document.getElementById('sb-tot-'+id), document.getElementById('sb-tot-total-'+id)].forEach(totEl => {
    if (!totEl) return;
    totEl.textContent = _sbFmt(min);
    totEl.style.color = (min !== null && min > 0) ? 'var(--red-text)' : 'var(--text3)';
  });
  if (field === 'causa') {
    const otroEl = document.getElementById('sb-otro-'+id);
    if (otroEl) {
      otroEl.style.display = (val === 'OTRO') ? '' : 'none';
      if (val === 'OTRO') {
        const inp = otroEl.querySelector('input');
        if (inp) setTimeout(()=>inp.focus(), 50);
      } else {
        r.causaOtro = '';
        const inp = otroEl.querySelector('input');
        if (inp) inp.value = '';
      }
    }
    const normalEl = document.getElementById('sb-tiempo-normal-'+id);
    const totalEl  = document.getElementById('sb-tiempo-total-'+id);
    const esTotal = (val === CAUSA_TIEMPO_TOTAL);
    if (normalEl) normalEl.style.display = esTotal ? 'none' : '';
    if (totalEl)  totalEl.style.display  = esTotal ? '' : 'none';
  }
  _renderStandbyTotal();
  saveDraft();
}
function _renderStandbyTotal() {
  const box = document.getElementById('standby-total');
  if (!box) return;
  const regs = getStandbyRegistrados().filter(r => r.minutos !== null);
  const tot = getStandbyTotalMin();
  if (regs.length && tot > 0) {
    box.style.display = 'block';
    box.innerHTML = '<i class="ti ti-clock-x"></i> TOTAL STAND BY DE LA JORNADA: ' + _sbFmt(tot) + ' (' + regs.length + ' evento' + (regs.length>1?'s':'') + ')';
  } else {
    box.style.display = 'none';
  }
}
function renderStandbyRows() {
  const container = document.getElementById('standby-rows');
  if (!container) return;
  if (standbyRows.length === 0) {
    container.innerHTML = '<div class="empty-msg">Sin Stand By registrados. Presiona el botón para agregar.</div>';
    _renderStandbyTotal();
    return;
  }
  container.innerHTML = '';
  standbyRows.forEach((r, idx) => {
    const min = _sbMinutosFila(r);
    const esTiempoTotal = r.causa === CAUSA_TIEMPO_TOTAL;
    const causasOpts = CAUSAS_STANDBY.map(c => `<option ${r.causa===c?'selected':''}>${c}</option>`).join('');
    const div = document.createElement('div');
    div.style.cssText = 'padding:12px;border:1.5px solid var(--border);border-radius:var(--r-md);margin-bottom:10px;background:var(--surface2)';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:11px;font-weight:800;background:var(--red-bg);color:var(--red-text);border-radius:20px;padding:3px 10px">ITEM ${idx+1}</span>
        <span style="flex:1"></span>
        <button class="del-btn" onclick="removeStandbyRow(${r.id})" aria-label="Eliminar">×</button>
      </div>
      <div class="field" style="margin-bottom:8px">
        <label>Actividad afectada</label>
        <input type="text" placeholder="Ej: Perforación de pernos, instalación de malla..." value="${(r.actividad||'').replace(/"/g,'&quot;')}" onchange="updateStandby(${r.id},'actividad',this.value)">
      </div>
      <div id="sb-tiempo-normal-${r.id}" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;${esTiempoTotal?'display:none':''}">
        <div class="field"><label>Desde</label><input type="time" value="${r.desde||''}" onchange="updateStandby(${r.id},'desde',this.value)"></div>
        <div class="field"><label>Hasta</label><input type="time" value="${r.hasta||''}" onchange="updateStandby(${r.id},'hasta',this.value)"></div>
        <div class="field"><label>Total</label>
          <div id="sb-tot-${r.id}" style="display:flex;align-items:center;height:38px;padding:0 11px;border:1.5px dashed var(--border-md);border-radius:var(--r-md);font-size:14px;font-weight:700;color:${(min!==null&&min>0)?'var(--red-text)':'var(--text3)'}">${_sbFmt(min)}</div>
        </div>
      </div>
      <div id="sb-tiempo-total-${r.id}" style="margin-bottom:8px;${esTiempoTotal?'':'display:none'}">
        <p class="note" style="margin-bottom:8px">⏱️ Este tipo de Stand By se registra como <strong>tiempo total del día</strong>.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div class="field"><label>Horas</label><input type="number" min="0" step="1" placeholder="0" value="${r.totalHoras||''}" onchange="updateStandby(${r.id},'totalHoras',this.value)"></div>
          <div class="field"><label>Minutos</label><input type="number" min="0" max="59" step="1" placeholder="0" value="${r.totalMinutos||''}" onchange="updateStandby(${r.id},'totalMinutos',this.value)"></div>
          <div class="field"><label>Total</label>
            <div id="sb-tot-total-${r.id}" style="display:flex;align-items:center;height:38px;padding:0 11px;border:1.5px dashed var(--border-md);border-radius:var(--r-md);font-size:14px;font-weight:700;color:${(min!==null&&min>0)?'var(--red-text)':'var(--text3)'}">${_sbFmt(min)}</div>
          </div>
        </div>
      </div>
      <div class="field" style="margin-bottom:8px">
        <label>Causa</label>
        <select onchange="updateStandby(${r.id},'causa',this.value)">
          <option value="">— Seleccionar causa —</option>
          ${causasOpts}
          <option value="OTRO" ${r.causa==='OTRO'?'selected':''}>OTRO (especificar)</option>
        </select>
      </div>
      <div class="field" id="sb-otro-${r.id}" style="margin-bottom:8px;${r.causa==='OTRO'?'':'display:none'}">
        <label>Especificar otra causa</label>
        <input type="text" placeholder="Describe la causa..." value="${(r.causaOtro||'').replace(/"/g,'&quot;')}" onchange="updateStandby(${r.id},'causaOtro',this.value)">
      </div>
      <div class="field" style="margin-bottom:8px">
        <label>Responsable de la liberación</label>
        <input type="text" placeholder="Nombre (puede ser externo)" value="${(r.responsable||'').replace(/"/g,'&quot;')}" onchange="updateStandby(${r.id},'responsable',this.value)">
      </div>
      <div class="field">
        <label>Comentarios <span style="font-weight:400;color:var(--text3)">(opcional)</span></label>
        <textarea placeholder="Detalles adicionales del Stand By..." style="min-height:52px" onchange="updateStandby(${r.id},'comentario',this.value)">${(r.comentario||'').replace(/</g,'&lt;')}</textarea>
      </div>
    `;
    container.appendChild(div);
  });
  _renderStandbyTotal();
}
// ==================== FIN MÓDULO STAND BY ====================

function toggleRestriccion() {
  const checked = document.getElementById('f-truckshop').checked;
  document.getElementById('restriccion-detalle').style.display = checked ? 'block' : 'none';
}
function initSelects() {
  const secSel = document.getElementById('f-sector');
  const prevSec = secSel.value;
  secSel.innerHTML = '<option value="">— Seleccionar —<\/option>' + Object.keys(SECTORES).map(s=>`<option>${s}<\/option>`).join('');
  secSel.value = prevSec;

  const capSel = document.getElementById('f-capataz');
  const prevCap = capSel.value;
  capSel.innerHTML = '<option value="">— Seleccionar —<\/option>' + CAPATACES.map(c=>`<option>${c}<\/option>`).join('');
  capSel.value = prevCap;

  const supSel = document.getElementById('f-supervisor');
  const prevSup = supSel.value;
  supSel.innerHTML = '<option value="">— Seleccionar —<\/option>' + SUPERVISORES.map(s=>`<option>${s}<\/option>`).join('');
  supSel.value = prevSup;
}
// Reconstruye solo las opciones de "Frente" para el sector actualmente seleccionado,
// sin tocar partidaValores/metrados — a diferencia de onSectorChange(), no es un cambio real de sector.
function _refrescarFrenteSelect() {
  const sector = document.getElementById('f-sector').value;
  const frenteSel = document.getElementById('f-frente');
  const prevFrente = frenteSel.value;
  const opts = SECTORES[sector] || [];
  if (opts.length === 0) {
    frenteSel.innerHTML = '<option value="">— Sin frentes predefinidos —<\/option>';
    frenteSel.disabled = true;
  } else {
    frenteSel.disabled = false;
    frenteSel.innerHTML = '<option value="">— Seleccionar —<\/option>' + opts.map(f=>`<option>${f}<\/option>`).join('');
    frenteSel.value = prevFrente;
  }
}
function onSectorChange() {
  const _salaSec = document.getElementById("sala-electrica-section");
  if (_salaSec) _salaSec.style.display = (document.getElementById("f-sector").value === "A: 4000 - SALA ELECTRICA") ? "" : "none";

  _refrescarFrenteSelect();
  onFrenteChange();
}
function onFrenteChange() {
  partidaValores = {};
  blq1Valores = {};
  blq3Valores = {};
  renderMetradosPartidas();
  saveDraft();
  _cargarSketchesAnteriores();
}

// ==================== ÚLTIMOS SKETCHES DEL FRENTE (referencia visual) ====================
// Puramente informativo: nunca debe interferir con el formulario ni con el envío del reporte.
const SKETCH_PREVIEW_URL = 'https://default01d952a2601948aa80282d9a49e865.6f.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/14/workflows/9af000fdbea9477ea83a1c457775c624/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=f7iPM4eFYWGaPIGtiXLUijmzChr9iFCgXbz5lUwrOb0';
let _sketchesAnterioresReqId = 0;
let _sketchesAnterioresActuales = [];
let _paginaSketchActual = 0;

async function _cargarSketchesAnteriores(frenteOverride) {
  _paginaSketchActual = 0;
  _sketchesAnterioresActuales = [];

  const card = document.getElementById('sketches-inicio-card');
  const body = document.getElementById('sketches-anteriores-body');
  const verMasWrap = document.getElementById('sketches-ver-mas-wrap');
  if (!body) return;

  const frente = frenteOverride || _sketchFrenteActual || (document.getElementById('f-frente')||{}).value || '';
  if (frente) _sketchFrenteActual = frente;
  const solicitudId = ++_sketchesAnterioresReqId;

  if (!frente) {
    if (card) card.style.display = 'none';
    if (verMasWrap) verMasWrap.style.display = 'none';
    return;
  }

  if (card) card.style.display = '';
  if (verMasWrap) verMasWrap.style.display = 'none';
  body.innerHTML = '<div class="empty-msg"><i class="ti ti-loader-2"></i> Cargando sketches anteriores...</div>';

  _fetchSketchPagina(0, solicitudId, true);
}

async function _cargarMasSketchesAnteriores() {
  const btn = document.getElementById('sketches-ver-mas-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> Cargando...'; }
  _paginaSketchActual++;
  await _fetchSketchPagina(_paginaSketchActual, _sketchesAnterioresReqId, false);
}

async function _fetchSketchPagina(pagina, solicitudId, esRecarga) {
  const frente = _sketchFrenteActual || (document.getElementById('f-frente')||{}).value || '';
  const body = document.getElementById('sketches-anteriores-body');
  const card = document.getElementById('sketches-inicio-card');
  const verMasWrap = document.getElementById('sketches-ver-mas-wrap');
  const btn = document.getElementById('sketches-ver-mas-btn');

  try {
    const respuesta = await fetch(SKETCH_PREVIEW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frente, pagina })
    });
    if (solicitudId !== _sketchesAnterioresReqId) return;
    if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);

    const datos = await respuesta.json();
    const fotos = Array.isArray(datos.fotos) ? datos.fotos : [];
    const hayMas = !!datos.hayMas;

    const startIdx = esRecarga ? 0 : _sketchesAnterioresActuales.length;
    if (esRecarga) {
      _sketchesAnterioresActuales = fotos;
    } else {
      _sketchesAnterioresActuales = _sketchesAnterioresActuales.concat(fotos);
    }

    if (esRecarga) {
      if (!fotos.length) {
        body.innerHTML = '<div class="empty-msg">Aún no hay sketches registrados para este frente.</div>';
        if (verMasWrap) verMasWrap.style.display = 'none';
        return;
      }
      body.innerHTML = '<div id="sketches-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div>';
    }

    const grid = document.getElementById('sketches-grid');
    if (grid) {
      fotos.forEach((s, i) => {
        const idx = startIdx + i;
        const etiqueta = _etiquetaDesdeNombre(s.nombre);
        const wrap = document.createElement('div');
        wrap.innerHTML = `<div style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden;aspect-ratio:1/1;background:var(--surface2);cursor:pointer" onclick="_verSketchGrande(${idx})"><img src="data:image/jpeg;base64,${s.contenidoArchivo}" style="width:100%;height:100%;object-fit:cover;display:block" alt="${(s.nombre||'').replace(/"/g,'&quot;')}"></div>${etiqueta ? `<div style="font-size:10.5px;color:var(--text3);text-align:center;margin-top:4px;line-height:1.3">${etiqueta}</div>` : ''}`;
        grid.appendChild(wrap);
      });
    }

    if (verMasWrap && btn) {
      if (hayMas) {
        verMasWrap.style.display = '';
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-clock-down"></i> Ver más antiguos';
      } else {
        verMasWrap.style.display = 'none';
      }
    }
  } catch (e) {
    if (solicitudId !== _sketchesAnterioresReqId) return;
    if (esRecarga) card.style.display = 'none';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-clock-down"></i> Ver más antiguos'; }
  }
}

// Traduce la etiqueta PERF/INY/MALLA embebida en el nombre del archivo a texto legible.
// Si el nombre no trae una etiqueta reconocible (ej. sketches subidos antes de este cambio), no muestra nada.
function _etiquetaDesdeNombre(nombre) {
  if (!nombre) return '';
  const m = /_([A-Z]+(?:-[A-Z]+)*)_\d+\.jpe?g$/i.exec(nombre);
  if (!m) return '';
  const mapa = { PERF: 'Perforación', INY: 'Inyección', MALLA: 'Malla' };
  const partes = m[1].toUpperCase().split('-');
  const traducidas = partes.map(p => mapa[p]).filter(Boolean);
  if (traducidas.length !== partes.length) return ''; // alguna parte no reconocida: mejor no mostrar nada
  return traducidas.join(' + ');
}

let _sketchLightboxIdx = null;

function _verSketchGrande(idx) {
  const s = _sketchesAnterioresActuales[idx];
  if (!s) return;
  _sketchLightboxIdx = idx;
  document.getElementById('sketch-lightbox-img').src = `data:image/jpeg;base64,${s.contenidoArchivo}`;
  document.getElementById('sketch-lightbox-nombre').textContent = s.nombre || '';
  document.getElementById('sketch-lightbox').style.display = 'flex';
  _resetSketchZoom();
}

function _cerrarSketchLightbox() {
  document.getElementById('sketch-lightbox').style.display = 'none';
  _resetSketchZoom();
}

function _descargarSketchActual() {
  const s = _sketchesAnterioresActuales[_sketchLightboxIdx];
  if (!s) return;
  const a = document.createElement('a');
  a.href = `data:image/jpeg;base64,${s.contenidoArchivo}`;
  a.download = s.nombre || 'sketch.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Zoom + pan del lightbox: rueda / pellizco para zoom, arrastre para mover ──
let _sketchZoom = {
  scale: 1, panX: 0, panY: 0,
  pinchDist0: null, scale0: 1, panX0: 0, panY0: 0,
  isDragging: false, mouseX0: 0, mouseY0: 0,
  touchDragId: null, touchDragX0: 0, touchDragY0: 0
};

function _resetSketchZoom() {
  _sketchZoom.scale = 1; _sketchZoom.panX = 0; _sketchZoom.panY = 0;
  _sketchZoom.pinchDist0 = null; _sketchZoom.isDragging = false; _sketchZoom.touchDragId = null;
  const img = document.getElementById('sketch-lightbox-img');
  if (img) { img.style.transform = ''; img.style.cursor = 'zoom-in'; img.style.transition = 'transform .15s'; }
}

function _aplicarSketchZoom(scale, px, py) {
  const s = Math.min(5, Math.max(1, scale));
  const x = s <= 1 ? 0 : (px !== undefined ? px : _sketchZoom.panX);
  const y = s <= 1 ? 0 : (py !== undefined ? py : _sketchZoom.panY);
  _sketchZoom.scale = s; _sketchZoom.panX = x; _sketchZoom.panY = y;
  const img = document.getElementById('sketch-lightbox-img');
  if (img) {
    img.style.transform = s <= 1 ? '' : `translate(${x}px,${y}px) scale(${s})`;
    img.style.cursor = s > 1 ? (_sketchZoom.isDragging ? 'grabbing' : 'grab') : 'zoom-in';
  }
}

function _distanciaTouch(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function _initSketchLightboxZoom() {
  const img = document.getElementById('sketch-lightbox-img');
  if (!img) return;

  // Zoom con rueda del mouse
  img.addEventListener('wheel', (e) => {
    e.preventDefault();
    _aplicarSketchZoom(_sketchZoom.scale + (e.deltaY < 0 ? 0.3 : -0.3));
  }, { passive: false });

  // Doble clic / doble toque: toggle zoom ↔ reset
  img.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    _aplicarSketchZoom(_sketchZoom.scale > 1 ? 1 : 2.5, 0, 0);
  });

  // ── Pan con mouse (escritorio) ──
  img.addEventListener('mousedown', (e) => {
    if (_sketchZoom.scale <= 1) return;
    e.preventDefault();
    _sketchZoom.isDragging = true;
    _sketchZoom.mouseX0 = e.clientX - _sketchZoom.panX;
    _sketchZoom.mouseY0 = e.clientY - _sketchZoom.panY;
    img.style.cursor = 'grabbing';
    img.style.transition = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!_sketchZoom.isDragging) return;
    _aplicarSketchZoom(_sketchZoom.scale, e.clientX - _sketchZoom.mouseX0, e.clientY - _sketchZoom.mouseY0);
  });
  document.addEventListener('mouseup', () => {
    if (!_sketchZoom.isDragging) return;
    _sketchZoom.isDragging = false;
    const i = document.getElementById('sketch-lightbox-img');
    if (i) { i.style.cursor = _sketchZoom.scale > 1 ? 'grab' : 'zoom-in'; i.style.transition = 'transform .15s'; }
  });

  // ── Touch: pellizco = zoom, 1 dedo = pan ──
  img.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      _sketchZoom.pinchDist0 = _distanciaTouch(e.touches);
      _sketchZoom.scale0 = _sketchZoom.scale;
      _sketchZoom.panX0 = _sketchZoom.panX;
      _sketchZoom.panY0 = _sketchZoom.panY;
      _sketchZoom.touchDragId = null;
    } else if (e.touches.length === 1 && _sketchZoom.scale > 1) {
      _sketchZoom.touchDragId = e.touches[0].identifier;
      _sketchZoom.touchDragX0 = e.touches[0].clientX - _sketchZoom.panX;
      _sketchZoom.touchDragY0 = e.touches[0].clientY - _sketchZoom.panY;
      img.style.transition = 'none';
    }
  }, { passive: true });

  img.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && _sketchZoom.pinchDist0) {
      e.preventDefault();
      const factor = _distanciaTouch(e.touches) / _sketchZoom.pinchDist0;
      _aplicarSketchZoom(_sketchZoom.scale0 * factor, _sketchZoom.panX0, _sketchZoom.panY0);
    } else if (e.touches.length === 1 && _sketchZoom.touchDragId !== null && _sketchZoom.scale > 1) {
      e.preventDefault();
      const t = e.touches[0];
      _aplicarSketchZoom(_sketchZoom.scale, t.clientX - _sketchZoom.touchDragX0, t.clientY - _sketchZoom.touchDragY0);
    }
  }, { passive: false });

  img.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) _sketchZoom.pinchDist0 = null;
    if (e.touches.length === 0) {
      if (_sketchZoom.touchDragId !== null) img.style.transition = 'transform .15s';
      _sketchZoom.touchDragId = null;
    }
  });
}
_initSketchLightboxZoom();
// ==================== FIN ÚLTIMOS SKETCHES DEL FRENTE ====================
// ==================== PERSONAL PRESENTE — fila + stepper (solo enteros) ====================
const PERSONAL_PRESENTE_CAMPOS = [
  { id: 'f-capataces', label: 'Capataz', def: 1 },
  { id: 'f-operarios', label: 'Operarios', def: 0 },
  { id: 'f-oficiales', label: 'Oficiales', def: 0 },
  { id: 'f-peones', label: 'Peones', def: 0 },
  { id: 'f-vigias', label: 'Vigías', def: 0 },
];
const PERSONAL_SALA_ELECTRICA_CAMPOS = [
  { id: 'f-ing-residente', label: 'Ingeniero residente', def: 0 },
  { id: 'f-sup-campo', label: 'Supervisor de campo', def: 0 },
  { id: 'f-ing-seguridad', label: 'Ingenieros de seguridad', def: 0 },
  { id: 'f-ing-calidad', label: 'Ingeniero de calidad', def: 0 },
  { id: 'f-topografo', label: 'Topógrafo', def: 0 },
];
function _personRowHTML(campo) {
  return '<div class="person-row">'
    + '<span class="person-row-label">' + campo.label + '</span>'
    + '<div class="stepper">'
    + '<button type="button" class="stepper-btn" onclick="_personStep(\'' + campo.id + '\',-1)" aria-label="Restar">−</button>'
    + '<input type="number" min="0" step="1" inputmode="numeric" value="' + campo.def + '" id="' + campo.id + '" class="stepper-input"'
    + ' oninput="saveDraft()" onblur="this.value=Math.max(0,Math.round(parseFloat(this.value)||0));saveDraft()">'
    + '<button type="button" class="stepper-btn" onclick="_personStep(\'' + campo.id + '\',1)" aria-label="Sumar">+</button>'
    + '</div>'
    + '</div>';
}
function renderPersonalPresente() {
  const cont1 = document.getElementById('personal-presente-rows');
  if (cont1) cont1.innerHTML = PERSONAL_PRESENTE_CAMPOS.map(_personRowHTML).join('');
  const cont2 = document.getElementById('personal-sala-electrica-rows');
  if (cont2) cont2.innerHTML = PERSONAL_SALA_ELECTRICA_CAMPOS.map(_personRowHTML).join('');
}
// Personal cuenta personas: solo enteros, nunca negativo.
function _personStep(id, delta) {
  const inp = document.getElementById(id);
  if (!inp) return;
  const next = Math.max(0, Math.round((parseInt(inp.value, 10) || 0) + delta));
  inp.value = next;
  saveDraft();
}

function renderHitos(preserve) {
  const prevVals = {};
  if (preserve !== false) {
    currentHitos.forEach((h,i)=>{
      const el = document.getElementById('hito-'+i);
      if (el) prevVals[h] = el.value;
    });
  }
  currentHitos = HITOS_BASE;
  document.getElementById('hitos-rows').innerHTML = currentHitos.map((h,i)=>`
    <div class="hito-row">
      <span class="hito-label">${h}<\/span>
      <input type="time" id="hito-${i}" value="${prevVals[h]||''}" onchange="saveDraft()">
    <\/div>
  `).join('');
}
function addMetradoManual() {
  const nombre = document.getElementById('manual-nombre').value.trim();
  const um = document.getElementById('manual-um').value;
  const met = document.getElementById('manual-met').value;
  if (!nombre) { showToast('Ingresa el nombre de la partida ⚠️'); return; }
  if (!met)    { showToast('Ingresa el metrado ejecutado ⚠️'); return; }

  metradosManuales.push({ id: metradosManualId++, nombre, um, met: Number(met) });

  document.getElementById('manual-nombre').value = '';
  document.getElementById('manual-um').value = '';
  document.getElementById('manual-met').value = '';
  document.getElementById('manual-nombre').focus();

  renderMetradosManuales();
  saveDraft();
  showToast('Partida agregada ✅');
}
function removeMetradoManual(id) {
  metradosManuales = metradosManuales.filter(m => m.id !== id);
  renderMetradosManuales();
  saveDraft();
}
function renderMetradosManuales() {
  const container = document.getElementById('metrados-manuales-rows');
  if (!container) return;
  if (metradosManuales.length === 0) {
    container.innerHTML = '<div class="empty-msg">Sin partidas nuevas agregadas.<\/div>';
    return;
  }
  container.innerHTML = metradosManuales.map(m => `
    <div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--color-border)">
      <span style="flex:1;font-size:13px;line-height:1.4">${m.nombre}<\/span>
      <span style="font-size:14px;font-weight:800;color:var(--color-success-text);white-space:nowrap">${m.met}<\/span>
      <span style="font-size:11px;font-weight:700;background:var(--color-bg-secondary);border-radius:20px;padding:3px 8px;color:var(--color-text-secondary);white-space:nowrap">${m.um||'—'}<\/span>
      <button class="del-btn" onclick="removeMetradoManual(${m.id})" aria-label="Eliminar"><i class="ti ti-x"><\/i><\/button>
    <\/div>
  `).join('');
}
function renderEquiposFijos() {
  const contPerf = document.getElementById('equipos-perforacion-fijos');
  if (contPerf) {
    contPerf.innerHTML = EQUIPOS_PERFORACION_FIJOS.map((n,i) => `
      <div class="hito-row">
        <span class="hito-label">${n}<\/span>
        <input type="number" min="0" step="1" id="eqp-perf-${i}" placeholder="0" onchange="saveDraft()">
      <\/div>
    `).join('');
  }
  const contSop = document.getElementById('equipos-soporte-fijos');
  if (contSop) {
    contSop.innerHTML = EQUIPOS_SOPORTE_FIJOS.map((n,i) => `
      <div class="hito-row">
        <span class="hito-label">${n}<\/span>
        <input type="number" min="0" step="1" id="eqp-sop-${i}" placeholder="0" onchange="saveDraft()">
      <\/div>
    `).join('');
  }
}
// ─── Equipos unificados (nueva UI en tab Datos) ───
function _initEquiposDatalist() {
  const sel = document.getElementById('eq-nombre');
  if (!sel) return;
  let opts = '<option value="">— Seleccionar equipo —</option>';
  opts += '<optgroup label="Perforación">' + EQUIPOS_PERFORACION_FIJOS.map(n => `<option value="${n}">${n}</option>`).join('') + '</optgroup>';
  opts += '<optgroup label="Soporte operativo">' + EQUIPOS_SOPORTE_FIJOS.map(n => `<option value="${n}">${n}</option>`).join('') + '</optgroup>';
  opts += '<option value="__otro__">Otro…</option>';
  sel.innerHTML = opts;
}
function _onEquipoSelChange() {
  const sel = document.getElementById('eq-nombre');
  const otro = document.getElementById('eq-nombre-otro');
  if (!sel || !otro) return;
  otro.style.display = sel.value === '__otro__' ? '' : 'none';
  if (sel.value === '__otro__') otro.focus();
}
function _addEquipo() {
  const sel = document.getElementById('eq-nombre');
  const otro = document.getElementById('eq-nombre-otro');
  let nombre = '';
  if (sel && sel.value === '__otro__') {
    nombre = otro ? otro.value.trim() : '';
  } else {
    nombre = sel ? sel.value : '';
  }
  const cant = parseInt((document.getElementById('eq-cantidad') || {}).value) || 0;
  if (!nombre.trim()) { showToast('⚠️ Selecciona o describe el equipo'); return; }
  if (!cant) { showToast('⚠️ Ingresa la cantidad'); return; }
  equiposLista.push({ id: equiposListaId++, nombre: nombre.trim(), cantidad: cant });
  if (sel) { sel.value = ''; }
  if (otro) { otro.value = ''; otro.style.display = 'none'; }
  const ce = document.getElementById('eq-cantidad'); if (ce) ce.value = '';
  if (sel) sel.focus();
  _renderEquiposLista();
  saveDraft();
  showToast('✅ Equipo agregado');
}
const _MEDIAS_HORAS = Array.from({length:36}, (_,i) => { const h=Math.floor(i/2)+5, m=i%2===0?'00':'30'; return `${String(h).padStart(2,'0')}:${m}`; });
function _bitacoraHoraOpts(sel='') { return '<option value="">--:--</option>'+_MEDIAS_HORAS.map(h=>`<option${h===sel?' selected':''}>${h}</option>`).join(''); }
function _addBitacora(hora='', actividad='') {
  const id = bitacoraActivId++;
  bitacoraActiv.push({ id, hora, actividad });
  _renderBitacora();
  saveDraft();
}
function _delBitacora(id) {
  bitacoraActiv = bitacoraActiv.filter(r => r.id !== id);
  _renderBitacora();
  saveDraft();
}
function _updBitacora(id, campo, valor) {
  const r = bitacoraActiv.find(x => x.id === id);
  if (r) { r[campo] = valor; saveDraft(); }
}
function _renderBitacora() {
  const cont = document.getElementById('bitacora-rows');
  if (!cont) return;
  if (!bitacoraActiv.length) {
    cont.innerHTML = '<div class="empty-msg">Sin actividades. Presiona el botón para agregar.</div>';
    return;
  }
  cont.innerHTML = bitacoraActiv.map(r => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:100px 1fr 28px;gap:6px;align-items:end;margin-bottom:0">
        <div class="field" style="margin-bottom:0"><label style="font-size:11px">Hora</label><select class="time-field" onchange="_updBitacora(${r.id},'hora',this.value)" style="font-size:13px">${_bitacoraHoraOpts(r.hora||'')}</select></div>
        <input type="text" placeholder="Actividad realizada…" value="${(r.actividad||'').replace(/"/g,'&quot;')}" onchange="_updBitacora(${r.id},'actividad',this.value)" style="width:100%;font-size:13px;border:1.5px solid var(--border);border-radius:var(--r-sm);padding:7px 9px;background:var(--surface);align-self:end">
        <button class="del-btn" onclick="_delBitacora(${r.id})" style="align-self:end;margin-bottom:0" aria-label="Eliminar">×</button>
      </div>
    </div>`).join('');
}
function _removeEquipo(id) {
  equiposLista = equiposLista.filter(e => e.id !== id);
  _renderEquiposLista();
  saveDraft();
}
function _renderEquiposLista() {
  const cont = document.getElementById('equipos-lista-rows');
  if (!cont) return;
  if (!equiposLista.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = equiposLista.map(e =>
    `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:13px">${e.nombre}</span>
      <span style="font-size:14px;font-weight:700;color:var(--blue);min-width:24px;text-align:right">${e.cantidad}</span>
      <button class="del-btn" onclick="_removeEquipo(${e.id})" aria-label="Eliminar">×</button>
    </div>`
  ).join('');
}
function getEquiposRegistrados() {
  // Compatibilidad export: clasifica por nombre si está en lista soporte
  const soporte = new Set(EQUIPOS_SOPORTE_FIJOS.map(n => n.toLowerCase()));
  const perf = [], sop = [];
  equiposLista.forEach(e => {
    if (soporte.has(e.nombre.toLowerCase())) sop.push({ nombre: e.nombre, cantidad: e.cantidad });
    else perf.push({ nombre: e.nombre, cantidad: e.cantidad });
  });
  return { perforacion: perf, soporte: sop };
}
// ─── Acordeón hitos de inicio ───
function _togHitosAcordeon() {
  const body = document.getElementById('hitos-body');
  const chev = document.getElementById('chev-hitos');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (chev) chev.textContent = open ? '▶' : '▼';
}
function addEquipoManual(tipo) {
  const nombreId = tipo === 'perforacion' ? 'eqperf-manual-nombre' : 'eqsop-manual-nombre';
  const cantId = tipo === 'perforacion' ? 'eqperf-manual-cant' : 'eqsop-manual-cant';
  const nombre = document.getElementById(nombreId).value.trim();
  const cant = document.getElementById(cantId).value;
  if (!nombre) { showToast('Ingresa el nombre del equipo ⚠️'); return; }
  if (!cant)   { showToast('Ingresa la cantidad ⚠️'); return; }

  if (tipo === 'perforacion') {
    equiposPerforacionManual.push({ id: equiposPerforacionManualId++, nombre, cantidad: Number(cant) });
  } else {
    equiposSoporteManual.push({ id: equiposSoporteManualId++, nombre, cantidad: Number(cant) });
  }

  document.getElementById(nombreId).value = '';
  document.getElementById(cantId).value = '';
  document.getElementById(nombreId).focus();

  renderEquiposManuales();
  saveDraft();
  showToast('Equipo agregado ✅');
}
function removeEquipoManual(tipo, id) {
  if (tipo === 'perforacion') {
    equiposPerforacionManual = equiposPerforacionManual.filter(m => m.id !== id);
  } else {
    equiposSoporteManual = equiposSoporteManual.filter(m => m.id !== id);
  }
  renderEquiposManuales();
  saveDraft();
}
function renderEquiposManuales() {
  const contPerf = document.getElementById('equipos-perforacion-manual-rows');
  if (contPerf) {
    contPerf.innerHTML = equiposPerforacionManual.map(m => `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--color-border)">
        <span style="flex:1;font-size:13px;line-height:1.4">${m.nombre}<\/span>
        <span style="font-size:14px;font-weight:800;color:var(--color-success-text);white-space:nowrap">${m.cantidad}<\/span>
        <button class="del-btn" onclick="removeEquipoManual('perforacion',${m.id})" aria-label="Eliminar"><i class="ti ti-x"><\/i><\/button>
      <\/div>
    `).join('');
  }
  const contSop = document.getElementById('equipos-soporte-manual-rows');
  if (contSop) {
    contSop.innerHTML = equiposSoporteManual.map(m => `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--color-border)">
        <span style="flex:1;font-size:13px;line-height:1.4">${m.nombre}<\/span>
        <span style="font-size:14px;font-weight:800;color:var(--color-success-text);white-space:nowrap">${m.cantidad}<\/span>
        <button class="del-btn" onclick="removeEquipoManual('soporte',${m.id})" aria-label="Eliminar"><i class="ti ti-x"><\/i><\/button>
      <\/div>
    `).join('');
  }
}
function getPartidasEjecutadas() {
  const out = [];
  // Bloque 1 — Preliminares
  PARTIDAS_PRELIMINARES.forEach((p, i) => {
    const v = blq1Valores[i];
    if (v !== '' && v !== undefined && v !== null && Number(v) > 0) {
      out.push({nombre: p.n, met: Number(v), um: p.u, sub: '1. Preliminares', manual: false});
    }
  });
  // Bloque 2 — Críticas (totales)
  const _pPerf = controlItems.filter(c => c.elemento === 'Perno' && c.actividad === 'Perforación');
  const _pIny  = controlItems.filter(c => c.elemento === 'Perno' && c.actividad === 'Inyección');
  const _pMal  = controlItems.filter(c => c.elemento === 'Malla');
  const _pCab  = controlItems.filter(c => c.elemento === 'Cable');
  const tPerf = _pPerf.reduce((s,c) => s + Number(c.cantidad||0), 0);
  const tIny  = _pIny.reduce((s,c) => s + Number(c.cantidad||0), 0);
  const tMal  = _pMal.reduce((s,c) => s + Number(c.cantidad||0), 0);
  const tCab  = _pCab.reduce((s,c) => s + Number(c.cantidad||0), 0);
  if (tPerf > 0) out.push({nombre:'Perforaciones', met:Math.round(tPerf*100)/100, um:'ML', sub:'2. Críticas', manual:false});
  if (tIny  > 0) out.push({nombre:'Inyecciones',   met:Math.round(tIny*100)/100,  um:'ML', sub:'2. Críticas', manual:false});
  if (tMal  > 0) out.push({nombre:'Instalación de mallas', met:Math.round(tMal*100)/100, um:'M2', sub:'2. Críticas', manual:false});
  if (tCab  > 0) out.push({nombre:'Instalación de cable',  met:Math.round(tCab*100)/100, um:'ML', sub:'2. Críticas', manual:false});
  // Bloque 3 — Complementarias
  PARTIDAS_COMPLEMENTARIAS.forEach((p, i) => {
    const v = blq3Valores[i];
    if (v !== '' && v !== undefined && v !== null && Number(v) > 0) {
      out.push({nombre: p.n, met: Number(v), um: p.u, sub: '3. Complementarias', manual: false});
    }
  });
  // Metrados manuales
  metradosManuales.forEach(m => {
    if (m.partida && Number(m.met) > 0) out.push({nombre:m.partida, met:Number(m.met), um:m.um||'', sub:'', manual:true});
  });
  return out;
}
function addRow(hora='', desc='') {
  const id = rowId++;
  rows.push({id, hora, descs:['','','','']});
  renderRows();
  saveDraft();
}
function removeRow(id) {
  rows = rows.filter(r => r.id !== id);
  renderRows();
  saveDraft();
}
function quarterLabels(hora) {
  if (!hora) return ['','','',''];
  const hh = hora.split(':')[0];
  return [`${hh}:00`, `${hh}:15`, `${hh}:30`, `${hh}:45`];
}
function rowsActivityCount() {
  return rows.reduce((s,r)=> s + ((r.descs||[]).filter(d=>d && d.trim()!=='').length), 0);
}
function renderRows() {
  const container = document.getElementById('hora-rows');
  if (!container) return;
  if (rows.length === 0) {
    container.innerHTML = '<div class="empty-msg">Sin actividades registradas. Presiona el botón para agregar.<\/div>';
    return;
  }
  container.innerHTML = '';
  rows.forEach(r => {
    if (!r.descs) r.descs = ['','','',''];
    const div = document.createElement('div');
    div.style.cssText = 'padding:9px 0;border-bottom:1px solid var(--color-border)';
    const labels = quarterLabels(r.hora);
    let quartersHtml = '';
    if (r.hora) {
      quartersHtml = `<div style="margin-top:6px;border:1px solid var(--color-border);border-radius:var(--radius-md);overflow:hidden">` +
        [0,1,2,3].map(i => `
          <div style="display:grid;grid-template-columns:56px 1fr;align-items:center;${i<3?'border-bottom:1px solid var(--color-border);':''}">
            <div style="background:var(--color-bg-secondary);color:var(--color-text-tertiary);font-size:11px;text-align:center;padding:8px 2px">${labels[i]}<\/div>
            <input type="text" placeholder="Actividad..." value="${(r.descs[i]||'').replace(/"/g,'&quot;')}" onchange="updateRowQuarter(${r.id},${i},this.value)" style="border:none;background:transparent;font-size:13px;padding:8px 8px;width:100%">
          <\/div>`).join('') +
        `<\/div>`;
    }
    div.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 28px;gap:8px;align-items:center">
        <select onchange="updateRow(${r.id},'hora',this.value)" style="font-size:13px;padding:6px 8px">
          <option value="">--:--<\/option>
          ${HORAS.map(h=>`<option ${r.hora===h?'selected':''}>${h}<\/option>`).join('')}
        <\/select>
        <button class="del-btn" onclick="removeRow(${r.id})" aria-label="Eliminar"><i class="ti ti-x"><\/i><\/button>
      <\/div>
      ${quartersHtml}
    `;
    container.appendChild(div);
  });
}
function updateRow(id, field, val) {
  const r = rows.find(x => x.id === id);
  if (r) r[field] = val;
  renderRows();
  saveDraft();
}
function updateRowQuarter(id, idx, val) {
  const r = rows.find(x => x.id === id);
  if (r) {
    if (!r.descs) r.descs = ['','','',''];
    r.descs[idx] = val;
    saveDraft();
  }
}
function _softReset() {
  suppressSave = true;
  _guardarDatosSticky();
  localStorage[`remove${'Item'}`](STORAGE_KEY);

  rows = []; rowId = 0;
  partidaValores = {};
  blq1Valores = {}; blq3Valores = {};
  cables = []; cableId = 0;
  controlItems = []; controlId = 0; _controlId = 0;
  equiposPerforacionManual = []; equiposPerforacionManualId = 0;
  equiposSoporteManual = []; equiposSoporteManualId = 0;
  redlineEstado = '';
  progRows = []; progRowId = 0;
  progAdicRows = []; progAdicId = 0;
  metradosManuales = []; metradosManualId = 0;
  standbyRows = []; standbyId = 0;
  reporteEnviado = false;
  reporteFinalizadoSinEnvio = false;
  Object.keys(_perfInyMode).forEach(k => delete _perfInyMode[k]);

  document.getElementById('f-fecha').value = '';
  document.getElementById('f-truckshop').checked = false;
  toggleRestriccion();
  ['f-restriccion-desc','f-restriccion-inicio','f-restriccion-fin',
   'f-almuerzo-salida','f-almuerzo-retorno',
   'f-comentarios','f-requerimientos','f-restricciones','f-redline'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const _fRedSup = document.getElementById('f-redline-supervisor');
  if (_fRedSup) _fRedSup.value = '';
  const _fCap = document.getElementById('f-capataces'); if (_fCap) _fCap.value = 1;
  ['f-operarios','f-oficiales','f-peones','f-vigias',
   'f-ing-residente','f-sup-campo','f-ing-seguridad','f-ing-calidad','f-topografo'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = 0; });
  EQUIPOS_PERFORACION_FIJOS.forEach((_,idx) => { const el = document.getElementById('eqp-perf-'+idx); if (el) el.value = ''; });
  EQUIPOS_SOPORTE_FIJOS.forEach((_,idx) => { const el = document.getElementById('eqp-sop-'+idx); if (el) el.value = ''; });

  currentHitos = HITOS_BASE.slice();
  renderHitos();
  currentHitos.forEach((_,idx) => { const el = document.getElementById('hito-'+idx); if (el) el.value = ''; });

  const _btnEnv = document.getElementById('btn-enviar');
  if (_btnEnv) { _btnEnv.disabled = false; _btnEnv.innerHTML = '<i class="ti ti-send"><\/i>Terminado y Enviar'; }
  const _envBox = document.getElementById('envio-status');
  if (_envBox) _envBox.style.display = 'none';
  _actualizarBotonNuevo();

  renderRows();
  _renderEquiposLista();
  renderMetradosPartidas();
  renderMetradosManuales();
  renderStandbyRows();
  renderProgRows();
  renderProgAdicRows();

  _cargarDatosSticky();
  suppressSave = false;
}

function _standbyAccesoMin() {
  // Restricción de acceso al frente
  if (document.getElementById('f-truckshop') && document.getElementById('f-truckshop').checked) {
    const rD = document.getElementById('f-restriccion-inicio') ? document.getElementById('f-restriccion-inicio').value : '';
    const rH = document.getElementById('f-restriccion-fin') ? document.getElementById('f-restriccion-fin').value : '';
    return _sbMinutos(rD, rH) || 0;
  }
  return 0;
}

function _standbyTotalCompleto() {
  let total = 0;
  // 1. Restricción de acceso al frente
  total += _standbyAccesoMin();
  // 2. Registro documentario (hito 0 Llegada → hito 3 Término llenado docs)
  const h0 = document.getElementById('hito-0') ? document.getElementById('hito-0').value : '';
  const h3 = document.getElementById('hito-3') ? document.getElementById('hito-3').value : '';
  if (h0 && h3) total += _sbMinutos(h0, h3);
  // 3. Items manuales del módulo Stand By
  total += getStandbyTotalMin();
  return total;
}

function _tiempoEfectivoMin() {
  // Minutos entre Inicio de actividades en piso (hito 5) y Término de jornada (hito 7), menos el Stand By del módulo.
  const inicioEl  = document.getElementById('hito-5');
  const terminoEl = document.getElementById('hito-7');
  const inicio  = inicioEl  ? inicioEl.value  : '';
  const termino = terminoEl ? terminoEl.value : '';
  if (!inicio || !termino) return null;
  const [hi, mi] = inicio.split(':').map(Number);
  const [ht, mt] = termino.split(':').map(Number);
  const totalMin = (ht * 60 + mt) - (hi * 60 + mi);
  if (totalMin <= 0) return null;
  return Math.max(0, totalMin - getStandbyTotalMin());
}
function _tiempoEfectivo() {
  // Tiempo efectivo = Término de jornada (hito 6) − Inicio de actividades (hito 5) − Stand By del módulo.
  // La restricción de acceso NO se resta aquí: ocurre antes de "Inicio de actividades" (fuera de esta ventana),
  // así que restarla de nuevo duplicaba el descuento y podía dejar el resultado en 0.
  const efectMin = _tiempoEfectivoMin();
  if (efectMin === null) return '—';
  return _sbFmt(efectMin);
}

function _totalPersonal() {
  const ids = ['f-capataces','f-operarios','f-oficiales','f-peones','f-vigias'];
  return ids.reduce((s,id) => { const el=document.getElementById(id); return s+(el?parseInt(el.value)||0:0); }, 0);
}

function buildResumen() {
  _actualizarBotonNuevo();
  const meta = getMeta();
  const frente = document.getElementById('f-frente').value;
  const lista = PARTIDAS[frente] || [];
  const ejecutadas = getPartidasEjecutadas();

  const partidasConMetrado = ejecutadas.length;
  document.getElementById('metrics-area').innerHTML = `
    <div style="grid-column:1/-1;background:var(--blue-bg);border-radius:var(--r-md);padding:10px 14px;margin-bottom:4px;display:flex;flex-wrap:wrap;gap:6px 16px;align-items:baseline;justify-content:center;text-align:center">
      <span style="font-size:13px;font-weight:600;color:var(--blue-text)">${meta.fecha||'—'}</span>
      <span style="font-size:12px;color:var(--blue-text);opacity:.6">•</span>
      <span style="font-size:13.65px;font-weight:800;color:var(--blue-text)">${meta.frente||'—'}</span>
      <span style="font-size:12px;color:var(--blue-text);opacity:.6">•</span>
      <span style="font-size:13px;font-weight:600;color:var(--blue-text)">${meta.supervisor||'—'}</span>
    </div>
    <div class="metric"><div class="val">${_totalPersonal()}<\/div><div class="lbl">Personal<\/div><\/div>
    <div class="metric"><div class="val" style="color:var(--red-text);font-size:22px">${_sbFmt(getStandbyTotalMin())}<\/div><div class="lbl">Stand By total<\/div><\/div>
    <div class="metric"><div class="val" style="color:var(--green-text);font-size:22px">${_tiempoEfectivo()}<\/div><div class="lbl">Tiempo efectivo<\/div><\/div>
  `;

  // ── Tabla metrados nuevo sistema 3 bloques ───────────────────────────
  const _blqHdr = (label, color) => `<tr><td colspan="3" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${color};background:var(--bg2);padding:5px 10px">${label}<\/td><\/tr>`;
  const _blqRow = (nombre, met, u) => `<tr><td style="font-size:13px">${nombre}<\/td><td style="font-size:14px;font-weight:600">${met}<\/td><td style="font-size:13px;color:var(--text3)">${u}<\/td><\/tr>`;
  let bodyHtml = '';
  // Bloque 1
  const blq1Filas = PARTIDAS_PRELIMINARES.map((p,i)=>({n:p.n,u:p.u,v:blq1Valores[i]})).filter(x=>x.v!==undefined&&x.v!==''&&Number(x.v)>0);
  if (blq1Filas.length) {
    bodyHtml += _blqHdr('1. Preliminares','var(--blue-text)');
    blq1Filas.forEach(x => { bodyHtml += _blqRow(x.n, x.v, x.u); });
  }
  // Bloque 2 — totales
  const perfML  = controlItems.filter(c=>c.elemento==='Perno'&&c.actividad==='Perforación').reduce((s,c)=>s+Number(c.cantidad||0),0);
  const inyML   = controlItems.filter(c=>c.elemento==='Perno'&&c.actividad==='Inyección').reduce((s,c)=>s+Number(c.cantidad||0),0);
  const mallaM2 = controlItems.filter(c=>c.elemento==='Malla').reduce((s,c)=>s+Number(c.cantidad||0),0);
  const cableML = controlItems.filter(c=>c.elemento==='Cable').reduce((s,c)=>s+Number(c.cantidad||0),0);
  if (perfML||inyML||mallaM2||cableML) {
    bodyHtml += _blqHdr('2. Críticas','var(--amber)');
    if (perfML)  bodyHtml += _blqRow('Perforaciones', Math.round(perfML*100)/100, 'ML');
    if (inyML)   bodyHtml += _blqRow('Inyecciones', Math.round(inyML*100)/100, 'ML');
    if (mallaM2) bodyHtml += _blqRow('Mallas instaladas', Math.round(mallaM2*100)/100, 'M2');
    if (cableML) bodyHtml += _blqRow('Cable instalado', Math.round(cableML*100)/100, 'ML');
  }
  // Bloque 3
  const blq3Filas = PARTIDAS_COMPLEMENTARIAS.map((p,i)=>({n:p.n,u:p.u,v:blq3Valores[i]})).filter(x=>x.v!==undefined&&x.v!==''&&Number(x.v)>0);
  if (blq3Filas.length) {
    bodyHtml += _blqHdr('3. Complementarias','var(--green)');
    blq3Filas.forEach(x => { bodyHtml += _blqRow(x.n, x.v, x.u); });
  }
  // Partidas libres
  if (metradosManuales.length) {
    bodyHtml += _blqHdr('Partidas libres','var(--text2)');
    metradosManuales.forEach(m => { bodyHtml += _blqRow(m.nombre, m.met, m.um||'—'); });
  }
  document.getElementById('metrado-body').innerHTML = bodyHtml || '<tr><td colspan="3" style="color:var(--text3);text-align:center;padding:16px">Sin metrados ingresados aún — ve a la pestaña Metrados<\/td><\/tr>';

  // Control de Sostenimiento resumen — tabla por columnas
  const codSection = document.getElementById('ctrl-resumen-section');
  if (controlItems.length > 0) {
    codSection.style.display = '';
    const _ctrlHdr = (label, color) =>
      `<tr><td colspan="4" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${color};background:var(--bg2);padding:5px 8px">${label}<\/td><\/tr>`;
    const _ctrlRow = (cod, tipoDiam, ubic, medida) =>
      `<tr style="border-bottom:1px solid var(--border-sm)">
        <td style="padding:5px 6px;font-family:ui-monospace,monospace;font-size:12px">${cod||'—'}<\/td>
        <td style="padding:5px 6px;font-size:12px;color:var(--text3)">${tipoDiam||'—'}<\/td>
        <td style="padding:5px 6px;font-size:12px;color:var(--text3)">${ubic||'—'}<\/td>
        <td style="padding:5px 6px;font-size:12px;font-weight:600;text-align:right;white-space:nowrap">${medida||'—'}<\/td>
      <\/tr>`;
    let codHtml = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">'
      + '<tr style="background:var(--bg2)">'
      + '<th style="padding:5px 6px;font-size:11px;text-align:left;color:var(--text3)">Código<\/th>'
      + '<th style="padding:5px 6px;font-size:11px;color:var(--text3)">Tipo/Ø<\/th>'
      + '<th style="padding:5px 6px;font-size:11px;color:var(--text3)">Ubic.<\/th>'
      + '<th style="padding:5px 6px;font-size:11px;color:var(--text3);text-align:right">Long/Área<\/th><\/tr>';
    // Perforaciones
    const _cPerf = controlItems.filter(c => c.elemento === 'Perno' && c.actividad === 'Perforación');
    if (_cPerf.length) {
      codHtml += _ctrlHdr('Perforaciones','var(--amber)');
      _cPerf.forEach(c => codHtml += _ctrlRow(c.codigo, [c.tipo,c.diametro].filter(Boolean).join(' / '), c.ubicacion, c.cantidad+' ML'));
    }
    // Inyecciones
    const _cIny = controlItems.filter(c => c.elemento === 'Perno' && c.actividad === 'Inyección');
    if (_cIny.length) {
      codHtml += _ctrlHdr('Inyecciones','var(--blue-text)');
      _cIny.forEach(c => codHtml += _ctrlRow(c.codigo, [c.tipo,c.diametro].filter(Boolean).join(' / '), c.ubicacion, c.cantidad+' ML'));
    }
    // Mallas
    const _cMal = controlItems.filter(c => c.elemento === 'Malla');
    if (_cMal.length) {
      codHtml += _ctrlHdr('Mallas','var(--green)');
      _cMal.forEach(c => codHtml += _ctrlRow(c.codigo, c.tipo, '—', c.cantidad+' M²'));
    }
    // Cables
    const _cCab = controlItems.filter(c => c.elemento === 'Cable');
    if (_cCab.length) {
      codHtml += _ctrlHdr('Cables','var(--red)');
      _cCab.forEach(c => codHtml += _ctrlRow(c.codigo, c.tipo, '—', c.cantidad+' ML'));
    }
    codHtml += '</table></div>';
    codHtml += `<div style="font-size:11px;color:var(--text3);margin-top:6px;text-align:right">${controlItems.length} elemento(s) total<\/div>`;
    document.getElementById('ctrl-resumen-body').innerHTML = codHtml;
  } else {
    codSection.style.display = 'none';
  }

  // Alerta diferencias metrado vs control

  // Equipos y maquinaria
  const eqSection = document.getElementById('equipos-resumen-section');
  const equiposResumen = getEquiposRegistrados();
  if (equiposResumen.perforacion.length || equiposResumen.soporte.length) {
    if (eqSection) eqSection.style.display = '';
    let eqHtml = '';
    if (equiposResumen.perforacion.length) {
      eqHtml += '<div style="margin-bottom:8px"><strong>Perforación:</strong> ' + equiposResumen.perforacion.map(e=>`${e.nombre} (${e.cantidad})`).join(', ') + '</div>';
    }
    if (equiposResumen.soporte.length) {
      eqHtml += '<div><strong>Soporte operativo:</strong> ' + equiposResumen.soporte.map(e=>`${e.nombre} (${e.cantidad})`).join(', ') + '</div>';
    }
    const eqBody = document.getElementById('equipos-resumen-body');
    if (eqBody) eqBody.innerHTML = eqHtml;
  } else {
    if (eqSection) eqSection.style.display = 'none';
  }

  // Stand By
  const sbSection = document.getElementById('standby-resumen-section');
  const sbRegs = getStandbyRegistrados();
  if (sbRegs.length) {
    if (sbSection) sbSection.style.display = '';
    let sbHtml = '';
    sbRegs.forEach(r => {
      sbHtml += `<tr>
        <td style="font-weight:700">${r.item}</td>
        <td style="font-size:13px">${r.actividad||'—'}</td>
        <td style="font-size:13px">${r.desde||'—'}</td>
        <td style="font-size:13px">${r.hasta||'—'}</td>
        <td style="font-size:13px;font-weight:700;color:var(--red-text)">${_sbFmt(r.minutos)}</td>
        <td style="font-size:12px">${r.causa||'—'}${r.comentario ? '<div style="font-size:11px;color:var(--text3);margin-top:2px">💬 '+r.comentario+'</div>' : ''}</td>
      </tr>`;
    });
    const sbTot = getStandbyTotalMin();
    sbHtml += `<tr><td colspan="4" style="font-weight:700">TOTAL STAND BY</td><td style="font-weight:800;color:var(--red-text)">${_sbFmt(sbTot)}</td><td></td></tr>`;
    const sbBody = document.getElementById('standby-resumen-body');
    if (sbBody) sbBody.innerHTML = sbHtml;
  } else {
    if (sbSection) sbSection.style.display = 'none';
  }

  // Obs/Req/Restricciones
  const obsSection = document.getElementById('obs-resumen-section');
  const obsComentarios = document.getElementById('f-comentarios') ? document.getElementById('f-comentarios').value : '';
  const obsReq = document.getElementById('f-requerimientos') ? document.getElementById('f-requerimientos').value : '';
  const obsRest = document.getElementById('f-restricciones') ? document.getElementById('f-restricciones').value : '';
  if (obsComentarios || obsReq || obsRest) {
    if(obsSection) obsSection.style.display = '';
    let obsHtml = '';
    if (obsComentarios) obsHtml += `<div style="margin-bottom:8px"><strong>Observaciones:</strong> ${obsComentarios}<\/div>`;
    if (obsReq)         obsHtml += `<div style="margin-bottom:8px"><strong>Requerimientos:</strong> ${obsReq}<\/div>`;
    if (obsRest)        obsHtml += `<div><strong>Restricciones:</strong> ${obsRest}<\/div>`;
    const obsBody = document.getElementById('obs-resumen-body');
    if(obsBody) obsBody.innerHTML = obsHtml;
  } else {
    if(obsSection) obsSection.style.display = 'none';
  }

  buildTextoWsp();
}
function buildTextoWsp() {
  const meta = getMeta();
  const frente = meta.frente || '—';
  const lista = PARTIDAS[meta.frente] || [];
  const fechaFmt = meta.fecha ? meta.fecha.split('-').reverse().join('/') : '—';
  let t = '';

  t += `*REPORTE DIARIO DE CAMPO* 👷\n`;
  t += `Sostenimiento y mantenimiento de talud ⛰️\n`;
  t += `------------------------------\n`;
  t += `📅 Fecha: ${fechaFmt}\n`;
  t += `📍 Sector: ${meta.sector || '—'}\n`;
  t += `🚧 Frente: ${frente}\n`;
  t += `👷 Capataz: ${meta.capataz || '—'}\n`;
  t += `🦺 Supervisor: ${meta.supervisor || '—'}\n\n`;

  // Registro de jornada — solo 4 puntos clave
  const _HITOS_WSP = new Set(['Llegada a frente de trabajo','Inicio de actividades en piso']);
  const hitosJornada = currentHitos
    .map((h,i)=>({ h, v: (document.getElementById('hito-'+i)||{}).value||'' }))
    .filter(x => _HITOS_WSP.has(x.h) && x.v);
  const terminoJornadaV = (document.getElementById('hito-'+(currentHitos.length-1))||{}).value||'';
  const almSalidaV = (document.getElementById('f-almuerzo-salida')||{}).value||'';
  const almRetornoV = (document.getElementById('f-almuerzo-retorno')||{}).value||'';
  const tieneJornada = hitosJornada.length || terminoJornadaV || (almSalidaV && almSalidaV!=='00:00');
  if (tieneJornada) {
    t += `*REGISTRO DE JORNADA* 🕒\n`;
    hitosJornada.forEach(x => { t += `• ${x.h}: ${x.v}\n`; });
    if (terminoJornadaV) t += `• Término de jornada: ${terminoJornadaV}\n`;
    t += `\n`;
  }

  // Restricción para llegar al frente (Inicio de jornada)
  const tuvoRestriccionAcceso = document.getElementById('f-truckshop').checked;
  if (tuvoRestriccionAcceso) {
    const descAcceso = (document.getElementById('f-restriccion-desc').value || '').trim();
    const horaInicioAcceso = document.getElementById('f-restriccion-inicio').value || '';
    const horaFinAcceso = document.getElementById('f-restriccion-fin').value || '';
    t += `*RESTRICCIÓN PARA LLEGAR AL FRENTE* 🚧\n`;
    if (descAcceso) t += `• ${descAcceso}\n`;
    if (horaInicioAcceso || horaFinAcceso) t += `• Horario: ${horaInicioAcceso||'—'} a ${horaFinAcceso||'—'}\n`;
    t += `\n`;
  }

  t += `*AVANCE DE PARTIDAS* ✅\n`;
  const ejecutadasWsp = getPartidasEjecutadas();
  if (ejecutadasWsp.length) {
    let _lsw = null;
    ejecutadasWsp.forEach(p=>{
      if (p.sub && p.sub !== _lsw) { _lsw = p.sub; t += '_'+p.sub+'_\n'; }
      t += '• '+p.nombre+(p.manual?' (nueva)':'')+': *'+p.met+' '+p.um+'*\n';
    });
  } else {
    t += 'Sin metrados registrados.\n';
  }
  t += `\n`;

  // Equipos y maquinaria — eliminado del reporte WSP

  // Bitácora auto-generada desde metrados
  const _bitAll = _buildBitacoraEntradas();
  if (_bitAll.length) {
    t += `*BITÁCORA DE ACTIVIDADES* 📝\n`;
    _bitAll.forEach(e => {
      const horaTxt = e.hi ? (e.hf ? `${e.hi} - ${e.hf}` : e.hi) + ' — ' : '';
      t += `• ${horaTxt}${e.texto}\n`;
    });
    t += `\n`;
  }

  // Programación - solo partida y descripción (sin metrado)
  const progConDatos = progRows.filter(r => r.partidaIdx !== '' && r.partidaIdx !== undefined);
  const progAdicConDatos = progAdicRows.filter(r => r.desc && r.desc.trim() !== '');
  if (progConDatos.length || progAdicConDatos.length) {
    t += `*PROGRAMACIÓN MAÑANA* 📅\n`;
    progConDatos.forEach(r => {
      const p = lista[Number(r.partidaIdx)];
      if (p) t += `• ${p.n}${r.desc && r.desc.trim() ? ' — ' + r.desc.trim() : ''}\n`;
    });
    progAdicConDatos.forEach(r => {
      t += `• ${r.desc.trim()}${r.nota && r.nota.trim() ? ' — ' + r.nota.trim() : ''}\n`;
    });
    t += `\n`;
  }

  // Control de Sostenimiento en WhatsApp — nuevo formato
  if (controlItems.length > 0) {
    t += '*CONTROL DE SOSTENIMIENTO* 🔩\n';
    // Pernos, separados por actividad — antes se listaban todos juntos y no se podía
    // distinguir cuáles eran de perforación y cuáles de inyección.
    const gruposPerno = [
      { label: 'Perforación', items: controlItems.filter(c => c.elemento === 'Perno' && c.actividad === 'Perforación') },
      { label: 'Inyección',   items: controlItems.filter(c => c.elemento === 'Perno' && c.actividad === 'Inyección') },
      { label: 'Otros',       items: controlItems.filter(c => c.elemento === 'Perno' && c.actividad !== 'Perforación' && c.actividad !== 'Inyección') },
    ];
    gruposPerno.forEach(g => {
      if (!g.items.length) return;
      const totalG = g.items.reduce((s,c) => s + Number(c.cantidad||0), 0);
      t += `*Pernos — ${g.label}: ${g.items.length} un. (${Math.round(totalG*100)/100} ${g.items[0].unidad||'ML'})*\n`;
      g.items.forEach(c => {
        const cod = c.codigo || c.codigoPerno || '—';
        const long = c.cantidad ? c.cantidad + ' ' + (c.unidad||'ML') : '—';
        t += `  ${cod} — ${long}\n`;
      });
    });
    // Mallas
    const mallas = controlItems.filter(c => c.elemento === 'Malla');
    if (mallas.length) {
      const totalM2 = mallas.reduce((s,c) => s + Number(c.cantidad||0), 0);
      t += `*Mallas: ${Math.round(totalM2*100)/100} M²*\n`;
      mallas.forEach(c => {
        const cod = c.codigo || '—';
        const dim = (c.ancho && c.largo) ? c.ancho+'×'+c.largo+' m' : (c.cantidad ? c.cantidad+' M²' : '—');
        t += `  ${cod} — ${dim}\n`;
      });
    }
    // Cables
    const cables2 = controlItems.filter(c => c.elemento === 'Cable');
    if (cables2.length) {
      const totalML = cables2.reduce((s,c) => s + Number(c.cantidad||0), 0);
      t += `*Cables: ${Math.round(totalML*100)/100} ML*\n`;
      cables2.forEach(c => {
        const cod = c.codigo || '—';
        const long = c.cantidad ? c.cantidad + ' ML' : '—';
        t += `  ${cod} — ${long}\n`;
      });
    }
    t += `\n`;
  }

  // Stand By de la jornada
  const sbWsp = getStandbyRegistrados();
  if (sbWsp.length) {
    t += `*STAND BY DE LA JORNADA* ⏸️\n`;
    sbWsp.forEach(r => {
      t += `${r.item}. ${r.actividad||'—'}\n`;
      t += `   ⏱️ ${r.desde||'—'} a ${r.hasta||'—'} (*${_sbFmt(r.minutos)}*)\n`;
      if (r.causa) t += `   📌 Causa: ${r.causa}\n`;
      if (r.comentario) t += `   💬 ${r.comentario}\n`;
    });
    t += `⏰ *Total Stand By: ${_sbFmt(_standbyTotalCompleto())}*\n\n`;
  }

  // Alerta de diferencias Metrado vs Control

  const obsComentarios = document.getElementById('f-comentarios').value;
  const requerimientos = document.getElementById('f-requerimientos') ? document.getElementById('f-requerimientos').value : '';
  const restricciones = document.getElementById('f-restricciones').value;
  if (obsComentarios || requerimientos || restricciones) {
    t += `*OBSERVACIONES / REQUERIMIENTOS* ⚠️\n`;
    if (obsComentarios) t += `📋 Observaciones: ${obsComentarios}\n`;
    if (requerimientos) t += `🔧 Requerimientos: ${requerimientos}\n`;
    if (restricciones) t += `🚫 Restricciones: ${restricciones}\n`;
    t += `\n`;
  }

  document.getElementById('texto-wsp').value = t.trim();
}
function copiarTextoWsp() {
  const ta = document.getElementById('texto-wsp');
  ta.select();
  ta.setSelectionRange(0, 999999);
  try {
    navigator.clipboard.writeText(ta.value).then(()=>showToast('Texto copiado 📋✅'));
  } catch(e) {
    document.execCommand('copy');
    showToast('Texto copiado 📋✅');
  }
}
function compartirTextoWsp() {
  const texto = document.getElementById('texto-wsp').value;
  if (navigator.share) {
    navigator.share({text: texto}).catch(()=>{});
  } else {
    copiarTextoWsp();
  }
}
function toggleRedline(opcion) {
  redlineEstado = (redlineEstado === opcion) ? '' : opcion;
  document.getElementById('chip-redline-si').classList.toggle('on', redlineEstado === 'si');
  const noel = document.getElementById('chip-redline-no'); if(noel) noel.classList.toggle('on', redlineEstado === 'no');
  document.getElementById('redline-detalle').style.display = (redlineEstado === 'si') ? '' : 'none';
  saveDraft();
}
function _getActividadesEnMetrados() {
  const lista = [];
  // Bloque 1 — todas las partidas (independientemente de si tienen metrado)
  (PARTIDAS_PRELIMINARES||[]).forEach(p => lista.push(p.n + (p.u ? ' ('+p.u+')' : '')));
  // Bloque 2 — categorías disponibles
  lista.push('Perforaciones (ML)');
  lista.push('Inyecciones (ML)');
  lista.push('Instalación de mallas (M2)');
  lista.push('Instalación de cable (ML)');
  // Bloque 3 — todas las partidas
  (PARTIDAS_COMPLEMENTARIAS||[]).forEach(p => lista.push(p.n + (p.u ? ' ('+p.u+')' : '')));
  // Manuales (solo los que tienen nombre)
  (metradosManuales||[]).forEach(m => { if (m.partida) lista.push(m.partida); });
  return lista;
}
function addProgRow() {
  const lista = _getActividadesEnMetrados();
  if (lista.length === 0) { showToast('Primero registra actividades en Metrados 📋'); return; }
  const id = progRowId++;
  progRows.push({id, label:'', desc:''});
  renderProgRows();
  saveDraft();
}
function removeProgRow(id) {
  progRows = progRows.filter(r=>r.id!==id);
  renderProgRows();
  saveDraft();
}
function updateProg(id, field, val) {
  const r = progRows.find(x=>x.id===id);
  if (r) { r[field] = val; saveDraft(); }
}
function addProgAdicRow() {
  const id = progAdicId++;
  progAdicRows.push({id, desc:'', nota:''});
  renderProgAdicRows();
  saveDraft();
}
function removeProgAdicRow(id) {
  progAdicRows = progAdicRows.filter(r=>r.id!==id);
  renderProgAdicRows();
  saveDraft();
}
function updateProgAdic(id, field, val) {
  const r = progAdicRows.find(x=>x.id===id);
  if (r) { r[field] = val; saveDraft(); }
}
function buildPartidaOptions(lista, selectedIdx) {
  let html = '';
  let subtituloAbierto = null;
  lista.forEach((p, i) => {
    const sub = p.s || '';
    if (sub !== subtituloAbierto) {
      if (subtituloAbierto !== null) html += '<\/optgroup>';
      html += `<optgroup label="${sub}">`;
      subtituloAbierto = sub;
    }
    html += `<option value="${i}" ${selectedIdx===String(i)?'selected':''}>${p.n} (${p.u})<\/option>`;
  });
  if (subtituloAbierto !== null) html += '<\/optgroup>';
  return html;
}
function renderProgRows() {
  const lista = _getActividadesEnMetrados();
  const container = document.getElementById('prog-rows');
  if (!container) return;
  if (progRows.length === 0) {
    container.innerHTML = '<div class="empty-msg">Sin partidas programadas. Presiona el botón para agregar.</div>';
    return;
  }
  container.innerHTML = '';
  progRows.forEach(r => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--border)';
    const opts = '<option value="">— Seleccionar actividad —</option>' + lista.map(l => `<option${l===r.label?' selected':''}>${l}</option>`).join('');
    div.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 28px;gap:8px;align-items:center;margin-bottom:6px">
        <select onchange="updateProg(${r.id},'label',this.value)" style="font-size:13px;padding:7px 10px;border:1px solid var(--border-md);border-radius:var(--r-md);background:var(--surface);color:var(--text1);width:100%">${opts}</select>
        <button class="del-btn" onclick="removeProgRow(${r.id})">×</button>
      </div>
      <input type="text" placeholder="Descripción adicional (ej: zona norte, P15 a P25...)" value="${(r.desc||'').replace(/"/g,'&quot;')}" onchange="updateProg(${r.id},'desc',this.value)" style="font-size:12px;padding:6px 8px;width:100%;border:1px solid var(--border-md);border-radius:var(--r-md);color:var(--text2)">
    `;
    container.appendChild(div);
  });
}
function renderProgAdicRows() {
  const container = document.getElementById('prog-adic-rows');
  if (!container) return;
  if (progAdicRows.length === 0) {
    container.innerHTML = '<div class="empty-msg">Sin actividades adicionales programadas.<\/div>';
    return;
  }
  container.innerHTML = '';
  progAdicRows.forEach(r => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--color-border)';
    div.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 28px;gap:8px;align-items:center;margin-bottom:6px">
        <input type="text" placeholder="Descripción de la actividad" value="${(r.desc||'').replace(/"/g,'&quot;')}" onchange="updateProgAdic(${r.id},'desc',this.value)" style="font-size:13px;padding:6px">
        <button class="del-btn" onclick="removeProgAdicRow(${r.id})"><i class="ti ti-x"><\/i><\/button>
      <\/div>
      <input type="text" placeholder="Nota adicional (ej: sector sur, pernos cortos, etc.)" value="${(r.nota||'').replace(/"/g,'&quot;')}" onchange="updateProgAdic(${r.id},'nota',this.value)" style="font-size:12px;padding:6px 8px;width:100%;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);color:var(--color-text-secondary)">
    `;
    container.appendChild(div);
  });
}
function getMeta() {
  return {
    fecha: document.getElementById('f-fecha').value,
    sector: document.getElementById('f-sector').value,
    frente: document.getElementById('f-frente').value,
    cuadrilla: '',
    capataz: document.getElementById('f-capataz').value,
    supervisor: document.getElementById('f-supervisor').value,
        salaPersonal: {
      ing_residente: document.getElementById('f-ing-residente') ? parseInt(document.getElementById('f-ing-residente').value)||0 : 0,
      sup_campo: document.getElementById('f-sup-campo') ? parseInt(document.getElementById('f-sup-campo').value)||0 : 0,
      ing_seguridad: document.getElementById('f-ing-seguridad') ? parseInt(document.getElementById('f-ing-seguridad').value)||0 : 0,
      ing_calidad: document.getElementById('f-ing-calidad') ? parseInt(document.getElementById('f-ing-calidad').value)||0 : 0,
      topografo: document.getElementById('f-topografo') ? parseInt(document.getElementById('f-topografo').value)||0 : 0,
    },
  };
}

// ==================== HELPERS COMPARTIDOS DE EXPORT (Excel + CSV) ====================
// Fila única de la hoja/sección RDC: identificación, personal, hitos, partidas, observaciones.
// Convierte "YYYY-MM-DD" a Date local para que SheetJS lo exporte como celda de fecha
function _parseDate(fechaStr) {
  if (!fechaStr) return '';
  const parts = fechaStr.split('-');
  if (parts.length !== 3) return fechaStr;
  const [y, m, d] = parts;
  if (!y || !m || !d) return fechaStr;
  // Retorna texto DD/MM/YYYY — evita desfase de zona horaria en SheetJS
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
}

function _buildRdcRow() {
  const meta = getMeta();
  const personal = {
    capataz: document.getElementById('f-capataces').value || '0',
    operarios: document.getElementById('f-operarios').value || '0',
    oficiales: document.getElementById('f-oficiales').value || '0',
    peones: document.getElementById('f-peones').value || '0',
    vigias: document.getElementById('f-vigias').value || '0'
  };
  const almSalida = document.getElementById('f-almuerzo-salida').value;
  const almRetorno = document.getElementById('f-almuerzo-retorno').value;
  const hitosVals = currentHitos.map((h,i)=>{ const el=document.getElementById('hito-'+i); return el?el.value||'':''; });

  const partidasConAvance = getPartidasEjecutadas();

  const tuvoRestriccionAcceso = document.getElementById('f-truckshop').checked;
  const restriccionAccesoDesc = (document.getElementById('f-restriccion-desc').value || '').trim();
  const restriccionAccesoInicio = document.getElementById('f-restriccion-inicio').value || '';
  const restriccionAccesoFin = document.getElementById('f-restriccion-fin').value || '';

  const comentarios = document.getElementById('f-comentarios').value || '';
  const restricciones = document.getElementById('f-restricciones').value || '';

  const headers = [];
  const values = [];

  headers.push('Fecha','Sector','Frente','Capataz','Supervisor');
  values.push(_parseDate(meta.fecha||''), meta.sector||'', meta.frente||'', meta.capataz||'', meta.supervisor||'');

  headers.push('N° Capataz','N° Operarios','N° Oficiales','N° Peones','N° Vigías');
  values.push(Number(personal.capataz), Number(personal.operarios), Number(personal.oficiales), Number(personal.peones), Number(personal.vigias));

  headers.push('Restricción - Descripción','Restricción - Hora inicio','Restricción - Hora fin');
  values.push(tuvoRestriccionAcceso?restriccionAccesoDesc:'', tuvoRestriccionAcceso?restriccionAccesoInicio:'', tuvoRestriccionAcceso?restriccionAccesoFin:'');

  currentHitos.forEach((h,i)=>{ headers.push(h); values.push(hitosVals[i]||''); });

  headers.push('Salida refrigerio','Retorno refrigerio');
  values.push(almSalida||'', almRetorno||'');

  headers.push('N° de partidas con avance');
  values.push(partidasConAvance.length);

  const requerimientosExp = document.getElementById('f-requerimientos') ? document.getElementById('f-requerimientos').value || '' : '';
  const redlineSupFn = document.getElementById('f-redline-supervisor') ? document.getElementById('f-redline-supervisor').value || '' : '';
  const redlineTextoExp = document.getElementById('f-redline').value || '';
  headers.push('Observaciones','Requerimientos','Restricciones','Redline - Supervisor Hegatrux','Redline - Descripción');
  values.push(comentarios, requerimientosExp, restricciones, redlineSupFn, redlineTextoExp);

  // Personal Sala Eléctrica (solo si sector = A: 4000 - SALA ELECTRICA)
  if (meta.sector === "A: 4000 - SALA ELECTRICA") {
    headers.push('Ingeniero residente');
    values.push(document.getElementById('f-ing-residente') ? parseInt(document.getElementById('f-ing-residente').value)||0 : 0);
    headers.push('Supervisor de campo');
    values.push(document.getElementById('f-sup-campo') ? parseInt(document.getElementById('f-sup-campo').value)||0 : 0);
    headers.push('Ingenieros de seguridad');
    values.push(document.getElementById('f-ing-seguridad') ? parseInt(document.getElementById('f-ing-seguridad').value)||0 : 0);
    headers.push('Ingeniero de calidad');
    values.push(document.getElementById('f-ing-calidad') ? parseInt(document.getElementById('f-ing-calidad').value)||0 : 0);
    headers.push('Topógrafo');
    values.push(document.getElementById('f-topografo') ? parseInt(document.getElementById('f-topografo').value)||0 : 0);
  }

  return { headers, values };
}

// Hoja/sección METRADOS: 3 bloques estandarizados + partidas libres
function _buildMetradosRows() {
  const meta = getMeta();
  const f = _parseDate(meta.fecha || ''), fr = meta.frente || '';
  const headers = ['Fecha','Frente','Bloque','Partida','Unidad','Metrado','Hora Inicio','Hora Fin','Duración (h)','Rendimiento','N° Pernos','Pernos/h'];
  const rows = [];

  const _durH = (hi, hf) => {
    if (!hi || !hf) return '';
    const [hh1,mm1] = hi.split(':').map(Number);
    const [hh2,mm2] = hf.split(':').map(Number);
    const mins = (hh2*60+mm2) - (hh1*60+mm1);
    return mins > 0 ? Math.round(mins/60*100)/100 : '';
  };
  const _rend = (met, dur, u) => (dur && met) ? Math.round(met/dur*100)/100 + ' ' + u + '/h' : '';

  // Bloque 1
  PARTIDAS_PRELIMINARES.forEach((p, i) => {
    const v = blq1Valores[i];
    const met = (v !== undefined && v !== '' && v !== null) ? Number(v) : 0;
    const hor = blq1Horarios[i] || {};
    const dur = _durH(hor.inicio, hor.fin);
    rows.push([f, fr, '1. Preliminares', p.n, p.u, met, hor.inicio||'', hor.fin||'', dur, _rend(met,dur,p.u), '', '']);
  });

  // Bloque 2 — Críticas con rendimiento
  const _grp2 = (items, partida, u, conPernos) => {
    if (!items.length) return;
    const tot = Math.round(items.reduce((s,c)=>s+(Number(c.cantidad)||0),0)*100)/100;
    const hi = items.map(c=>c.horaInicio).filter(Boolean).sort()[0]||'';
    const hf = items.map(c=>c.horaFin).filter(Boolean).sort().reverse()[0]||'';
    const dur = _durH(hi, hf);
    const nPernos = conPernos ? items.length : '';
    const pernosH = (conPernos && dur && items.length) ? Math.round(items.length/dur*100)/100+' pernos/h' : '';
    rows.push([f, fr, '2. Críticas', partida, u, tot, hi, hf, dur, _rend(tot,dur,u), nPernos, pernosH]);
  };
  _grp2(controlItems.filter(c=>c.elemento==='Perno'&&c.actividad==='Perforación'), 'Perforaciones', 'ML', true);
  _grp2(controlItems.filter(c=>c.elemento==='Perno'&&c.actividad==='Inyección'),   'Inyecciones',   'ML', true);
  _grp2(controlItems.filter(c=>c.elemento==='Malla'), 'Instalación de mallas', 'M2', false);
  _grp2(controlItems.filter(c=>c.elemento==='Cable'), 'Instalación de cable',  'ML', false);

  // Bloque 3
  PARTIDAS_COMPLEMENTARIAS.forEach((p, i) => {
    const v = blq3Valores[i];
    const met = (v !== undefined && v !== '' && v !== null) ? Number(v) : 0;
    const hor = blq3Horarios[i] || {};
    const dur = _durH(hor.inicio, hor.fin);
    rows.push([f, fr, '3. Complementarias', p.n, p.u, met, hor.inicio||'', hor.fin||'', dur, _rend(met,dur,p.u), '', '']);
  });

  // Libres
  metradosManuales.forEach(m => {
    rows.push([f, fr, 'Libre', m.nombre, m.um||'', Number(m.met), '', '', '', '', '', '']);
  });
  return { headers, rows };
}

// Hoja/sección RECURSOS: mano de obra directa/indirecta, equipos y maquinaria, en formato
// vertical (Item / Descripción / Cantidad / Horas), agrupado por bloques con encabezado de sección.
function _buildRecursosRows() {
  const meta = getMeta();
  const headers = ['Item','Descripción','Cantidad','Horas'];
  const rows = [];

  const efectMin = _tiempoEfectivoMin();
  const horas = efectMin !== null ? Math.round((efectMin/60)*100)/100 : '';

  const addSeccion = (titulo, items) => {
    const validos = items.filter(it => (Number(it.cant)||0) > 0);
    if (validos.length === 0) return;
    rows.push(['', titulo, '', '']);
    validos.forEach((it, i) => rows.push([i+1, it.desc, Number(it.cant), horas]));
  };

  // Igual que addSeccion, pero sin filtrar: siempre muestra todos los recursos base,
  // aunque no se hayan llenado (cantidad en 0).
  const addSeccionSiempre = (titulo, items) => {
    if (items.length === 0) return;
    rows.push(['', titulo, '', '']);
    items.forEach((it, i) => rows.push([i+1, it.desc, Number(it.cant)||0, horas]));
  };

  // Mano de obra directa (recursos base, siempre se listan aunque queden en 0;
  // la Vigía es personal de mano de obra directa, no indirecta)
  addSeccionSiempre('MANO DE OBRA DIRECTA', [
    { desc:'Capataz',  cant: document.getElementById('f-capataces').value },
    { desc:'Operario', cant: document.getElementById('f-operarios').value },
    { desc:'Oficial',  cant: document.getElementById('f-oficiales').value },
    { desc:'Peón',     cant: document.getElementById('f-peones').value },
    { desc:'Vigía',    cant: document.getElementById('f-vigias').value }
  ]);

  // Mano de obra indirecta (roles adicionales, solo aplican a ciertos sectores)
  const indirecta = [];
  if (meta.sector === 'A: 4000 - SALA ELECTRICA') {
    indirecta.push(
      { desc:'Ingeniero residente',    cant: document.getElementById('f-ing-residente')  ? document.getElementById('f-ing-residente').value  : 0 },
      { desc:'Supervisor de campo',    cant: document.getElementById('f-sup-campo')      ? document.getElementById('f-sup-campo').value      : 0 },
      { desc:'Ingeniero de seguridad', cant: document.getElementById('f-ing-seguridad')  ? document.getElementById('f-ing-seguridad').value  : 0 },
      { desc:'Ingeniero de calidad',   cant: document.getElementById('f-ing-calidad')    ? document.getElementById('f-ing-calidad').value    : 0 },
      { desc:'Topógrafo',              cant: document.getElementById('f-topografo')      ? document.getElementById('f-topografo').value      : 0 }
    );
  }
  addSeccion('MANO DE OBRA INDIRECTA', indirecta);

  // Equipos (perforación) y Maquinaria (soporte operativo)
  const equipos = getEquiposRegistrados();
  addSeccion('EQUIPOS', equipos.perforacion.map(e => ({ desc: e.nombre, cant: e.cantidad })));
  addSeccion('MAQUINARIA', equipos.soporte.map(e => ({ desc: e.nombre, cant: e.cantidad })));

  return { headers, rows };
}

// Hoja/sección BITACORA: al inicio la restricción de acceso (si hubo) y el registro de jornada
// (hitos con hora), y luego todo lo registrado en el módulo Actividades (por cuarto de hora).
// Genera entradas de bitácora desde metrados (compartida por WhatsApp y Excel)
function _buildBitacoraEntradas() {
  const _hMin = h => { if (!h) return Infinity; const [hh,mm]=h.split(':').map(Number); return hh*60+(mm||0); };
  const entradas = [];
  // Bloque 1 — Preliminares
  PARTIDAS_PRELIMINARES.forEach((p,i) => {
    const v = blq1Valores[i];
    if (!v || Number(v) <= 0) return;
    const hor = blq1Horarios[i] || {};
    entradas.push({ sortKey:_hMin(hor.inicio), hi:hor.inicio||'', hf:hor.fin||'', texto:`Se realizó ${p.n} con un total de ${Number(v)} ${p.u}` });
  });
  // Bloque 2 — Críticas agrupadas
  const _grp = (items, textoFn) => {
    if (!items.length) return;
    const total = Math.round(items.reduce((s,c)=>s+Number(c.cantidad||0),0)*100)/100;
    const codigos = items.map(c=>c.codigo||'—').join(', ');
    const hi = items.map(c=>c.horaInicio).filter(Boolean).sort()[0]||'';
    const hf = items.map(c=>c.horaFin).filter(Boolean).sort().reverse()[0]||'';
    entradas.push({ sortKey:_hMin(hi), hi, hf, texto:textoFn(total,codigos) });
  };
  _grp(controlItems.filter(c=>c.elemento==='Perno'&&c.actividad==='Perforación'), (t,c)=>`Se realizaron perforaciones con un total de ${t} ML — Pernos: ${c}`);
  _grp(controlItems.filter(c=>c.elemento==='Perno'&&c.actividad==='Inyección'),   (t,c)=>`Se realizaron inyecciones con un total de ${t} ML — Pernos: ${c}`);
  _grp(controlItems.filter(c=>c.elemento==='Malla'),  (t,c)=>`Se realizó la instalación de malla con un total de ${t} M2, con los paños: ${c}`);
  _grp(controlItems.filter(c=>c.elemento==='Cable'),  (t,c)=>`Se instalaron cables con un total de ${t} ML: ${c}`);
  // Bloque 3 — Complementarias
  PARTIDAS_COMPLEMENTARIAS.forEach((p,i) => {
    const v = blq3Valores[i];
    if (!v || Number(v) <= 0) return;
    const hor = blq3Horarios[i] || {};
    entradas.push({ sortKey:_hMin(hor.inicio), hi:hor.inicio||'', hf:hor.fin||'', texto:`Se realizó ${p.n} con un total de ${Number(v)} ${p.u}` });
  });
  const conH = entradas.filter(e=>e.hi).sort((a,b)=>a.sortKey-b.sortKey);
  const sinH = entradas.filter(e=>!e.hi);
  return [...conH, ...sinH];
}

function _buildBitacoraRows() {
  const meta = getMeta();
  const headers = ['Fecha','Frente','Hora Inicio','Hora Fin','Actividad'];
  const eventos = [];

  // 1. Restricción para llegar al frente
  const tuvoRestriccion = document.getElementById('f-truckshop') && document.getElementById('f-truckshop').checked;
  if (tuvoRestriccion) {
    const desc = (document.getElementById('f-restriccion-desc') ? document.getElementById('f-restriccion-desc').value : '').trim();
    const desde = document.getElementById('f-restriccion-inicio') ? document.getElementById('f-restriccion-inicio').value : '';
    const hasta = document.getElementById('f-restriccion-fin') ? document.getElementById('f-restriccion-fin').value : '';
    eventos.push({ hi:desde, hf:hasta, actividad:'Restricción para llegar al frente'+(desc?': '+desc:''), sortKey:desde||'ZZ' });
  }

  // 2. Registro de jornada (hitos)
  currentHitos.forEach((h,i) => {
    const el = document.getElementById('hito-'+i);
    const hora = el ? el.value : '';
    if (hora) eventos.push({ hi:hora, hf:'', actividad:h, sortKey:hora });
  });

  // 3. Actividades de metrados (auto-generadas)
  _buildBitacoraEntradas().forEach(e => {
    eventos.push({ hi:e.hi, hf:e.hf, actividad:e.texto, sortKey:e.hi||'ZZ' });
  });

  eventos.sort((a,b) => a.sortKey.localeCompare(b.sortKey));

  const rows = eventos.map(ev => [
    _parseDate(meta.fecha||''), meta.frente||'', ev.hi||'', ev.hf||'', ev.actividad
  ]);
  return { headers, rows };
}

// Hoja/sección CONTROL_SOSTENIMIENTO: Longitud (ML de pernos/inyección/cable) o Ancho×Largo (malla).
function _buildControlSostenimientoRows() {
  const meta = getMeta();
  const headers = ['Fecha','Frente','Sistema','Zona de Sistema','Elemento','Tipo','Actividad','Código','Ubicación','Longitud','Ancho','Largo','Área (M2)','Unidad','Diámetro (mm)','Ángulo','Plano','Perforadora','Hora Inicio','Hora Fin','Capataz','Supervisor'];
  const rows = controlItems.map(c => {
    const lib = BIBLIOTECA_PERNOS[(c.frente || '') + '|' + (c.codigo || '')] || null;
    const area = (c.ancho && c.largo) ? Math.round(Number(c.ancho) * Number(c.largo) * 1000) / 1000 : '';
    return [
      _parseDate(c.fecha || meta.fecha || ''),
      c.frente || meta.frente || '',
      c.sistema || '',
      c.zona || '',
      c.elemento || '',
      c.tipo || '',
      c.actividad || '',
      c.codigo || '',
      c.ubicacion || '',
      (c.unidad === 'ML' && c.cantidad !== '' && c.cantidad !== undefined) ? c.cantidad : '',
      c.ancho || '',
      c.largo || '',
      area,
      c.unidad || '',
      c.diametro || (lib ? lib.d : '') || '',
      lib ? lib.a : '',
      c.plano || (lib ? (lib.p || '') : '') || '',
      c.tipoPerforadora || '',
      c.horaInicio || '',
      c.horaFin || '',
      meta.capataz || '',
      meta.supervisor || ''
    ];
  });
  return { headers, rows };
}

// Hoja/sección EQUIPOS.
function _buildEquiposRows() {
  const meta = getMeta();
  const equipos = getEquiposRegistrados();
  const headers = ['Fecha','Frente','Categoría','Equipo','Cantidad'];
  const rows = [
    ...equipos.perforacion.map(e => [_parseDate(meta.fecha)||'', meta.frente||'', 'Perforación', e.nombre, e.cantidad]),
    ...equipos.soporte.map(e => [_parseDate(meta.fecha)||'', meta.frente||'', 'Soporte operativo', e.nombre, e.cantidad])
  ];
  return { headers, rows };
}

// Hoja/sección STAND_BY: incluye restricción de acceso + registro documentario + módulo Stand By (sin cambios).
function _cuadrillaDelDia() {
  const cap = parseInt((document.getElementById('f-capataces') || {}).value) || 0;
  const op  = parseInt((document.getElementById('f-operarios') || {}).value) || 0;
  const of_ = parseInt((document.getElementById('f-oficiales') || {}).value) || 0;
  const pe  = parseInt((document.getElementById('f-peones')    || {}).value) || 0;
  const vi  = parseInt((document.getElementById('f-vigias')    || {}).value) || 0;
  return { capataz:cap, operarios:op, oficiales:of_, peones:pe, vigias:vi, total:cap+op+of_+pe+vi };
}

function _buildStandByExportRows() {
  const meta = getMeta();
  const tuvoRestriccion = document.getElementById('f-truckshop').checked;
  const sbExtra = [];
  if (tuvoRestriccion) {
    const rDesc  = (document.getElementById('f-restriccion-desc') ? document.getElementById('f-restriccion-desc').value : '') || '';
    const rDesde = document.getElementById('f-restriccion-inicio') ? document.getElementById('f-restriccion-inicio').value : '';
    const rHasta = document.getElementById('f-restriccion-fin') ? document.getElementById('f-restriccion-fin').value : '';
    const rMin   = _sbMinutos(rDesde, rHasta);
    sbExtra.push({ actividad:'Restricción de acceso al frente', desde:rDesde, hasta:rHasta, minutos:rMin, causa:'Restricción de acceso', comentario:rDesc });
  }
  // Registro documentario: desde Llegada a frente (hito 0) hasta Término de llenado de documentos (hito 3)
  const _hitoVals = currentHitos.map((h,hi) => { const el=document.getElementById('hito-'+hi); return el?el.value:''; });
  const _hLlegada = _hitoVals[0] || '';
  const _hTermDoc = _hitoVals[3] || '';
  if (_hLlegada && _hTermDoc) {
    const _rdMin = _sbMinutos(_hLlegada, _hTermDoc);
    sbExtra.push({ actividad:'Registro documentario', desde:_hLlegada, hasta:_hTermDoc, minutos:_rdMin, causa:'Registro documentario', comentario:'' });
  }
  const sbRegs = [...sbExtra.map((r,i)=>({...r,item:i+1})), ...getStandbyRegistrados().map((r,ri)=>({...r, item:sbExtra.length+ri+1}))];

  const headers = ['Item','Fecha','Frente','Actividad afectada','Desde','Hasta','Total (hh:mm)','Total (decimal)','Total (min)','Causa','Responsable de la liberación','Capataz','Operarios','Oficiales','Peones','Vigías','Total cuadrilla afectada','Comentarios'];
  const rows = sbRegs.map(r => {
    const c = (r.cuadrillaAfectada && typeof r.cuadrillaAfectada === 'object') ? r.cuadrillaAfectada : _cuadrillaDelDia();
    return [
      r.item,
      _parseDate(meta.fecha || ''),
      meta.frente || '',
      r.actividad,
      r.desde,
      r.hasta,
      r.minutos !== null ? _sbFmtHHMM(r.minutos) : '',
      r.minutos !== null ? Math.round(r.minutos / 60 * 100) / 100 : '',
      r.minutos !== null ? r.minutos : '',
      r.causa,
      r.responsable || '',
      c.capataz,
      c.operarios,
      c.oficiales,
      c.peones,
      c.vigias,
      c.total,
      r.comentario || ''
    ];
  });
  return { headers, rows, sbRegs };
}

// Hoja/sección REPORTE_WSP: texto WSP línea por línea + resumen de jornada + resumen completo en una sola celda.
function _buildReporteWspLineas() {
  buildTextoWsp();
  const textoWsp = document.getElementById('texto-wsp').value || '';
  const lineas = textoWsp ? textoWsp.split('\n').map(l => [l]) : [['Sin datos']];
  lineas.push(['']);
  lineas.push(['--- RESUMEN DE JORNADA ---']);
  currentHitos.forEach((h,hi) => {
    const el = document.getElementById('hito-'+hi);
    const hora = el ? el.value : '';
    if (hora) lineas.push([h + ': ' + hora]);
  });
  const _almS = document.getElementById('f-almuerzo-salida') ? document.getElementById('f-almuerzo-salida').value : '';
  const _almR = document.getElementById('f-almuerzo-retorno') ? document.getElementById('f-almuerzo-retorno').value : '';
  if (_almS) lineas.push(['Salida a refrigerio: ' + _almS]);
  if (_almR) lineas.push(['Retorno de refrigerio: ' + _almR]);
  if (document.getElementById('f-truckshop') && document.getElementById('f-truckshop').checked) {
    const _rDesc  = document.getElementById('f-restriccion-desc') ? document.getElementById('f-restriccion-desc').value : '';
    const _rDesde = document.getElementById('f-restriccion-inicio') ? document.getElementById('f-restriccion-inicio').value : '';
    const _rHasta = document.getElementById('f-restriccion-fin') ? document.getElementById('f-restriccion-fin').value : '';
    lineas.push(['Restricción de acceso: ' + (_rDesde&&_rHasta?_rDesde+' - '+_rHasta:'') + (_rDesc?' ('+_rDesc+')':'')]);
  }
  // Resumen completo del reporte en una sola celda
  lineas.push(['']);
  lineas.push(['--- RESUMEN COMPLETO (celda única) ---']);
  lineas.push([textoWsp]);
  return lineas;
}
// ==================== FIN HELPERS COMPARTIDOS DE EXPORT ====================

// Construye el libro de Excel completo (todas las hojas) y lo devuelve sin descargarlo.
// Lo usan tanto exportarXLSX() (descarga local) como terminarYEnviar() (envío a Power Automate).
function _construirWorkbookRDC() {

  const { headers, values } = _buildRdcRow();

  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([headers, values]);

  // Ancho de columnas automático
  ws['!cols'] = headers.map((h,i)=>{
    const hlen = h.length;
    const vlen = values[i] !== undefined && values[i] !== null ? String(values[i]).length : 0;
    return { wch: Math.min(Math.max(hlen, vlen, 8), 40) };
  });

  // Estilo cabecera hoja RDC: fondo azul, texto blanco, negrita
  headers.forEach((_,i)=>{
    const cellRef = XLSX.utils.encode_cell({r:0, c:i});
    if (!ws[cellRef]) return;
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
      fill: { fgColor: { rgb: '1D4ED8' } },
      alignment: { horizontal: 'center', wrapText: true }
    };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'RDC');

  // ===== HOJA METRADOS (vertical: EDT / Partida / Unidad / Metrado) =====
  const { headers: metHeaders, rows: metRows } = _buildMetradosRows();
  const wsMET = XLSX.utils.aoa_to_sheet([metHeaders, ...metRows]);
  wsMET['!cols'] = [{wch:12},{wch:16},{wch:14},{wch:55},{wch:8},{wch:10},{wch:11},{wch:11},{wch:12},{wch:18},{wch:10},{wch:14}];
  metHeaders.forEach((_,i)=>{
    const cellRef = XLSX.utils.encode_cell({r:0, c:i});
    if (!wsMET[cellRef]) return;
    wsMET[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
      fill: { fgColor: { rgb: '0F766E' } },
      alignment: { horizontal: 'center', wrapText: true }
    };
  });
  XLSX.utils.book_append_sheet(wb, wsMET, 'METRADOS');

  // ===== HOJA RECURSOS (vertical: Item / Descripción / Cantidad / Horas) =====
  const { headers: rcHeaders, rows: rcRows } = _buildRecursosRows();
  const wsRC = XLSX.utils.aoa_to_sheet([rcHeaders, ...rcRows]);
  wsRC['!cols'] = [{wch:8},{wch:40},{wch:12},{wch:10}];
  rcHeaders.forEach((_,i)=>{
    const cellRef = XLSX.utils.encode_cell({r:0, c:i});
    if (!wsRC[cellRef]) return;
    wsRC[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
      fill: { fgColor: { rgb: '7C3AED' } },
      alignment: { horizontal: 'center', wrapText: true }
    };
  });
  // Estilo de las filas de encabezado de sección (Item vacío, texto en Descripción)
  rcRows.forEach((row, r) => {
    if (row[0] === '' && row[1] && row[2] === '' && row[3] === '') {
      for (let c = 0; c < 4; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: r+1, c });
        if (!wsRC[cellRef]) wsRC[cellRef] = { t:'s', v:'' };
        wsRC[cellRef].s = {
          font: { bold: true, color: { rgb: '5B21B6' }, name: 'Arial', sz: 10 },
          fill: { fgColor: { rgb: 'EDE9FE' } }
        };
      }
    }
  });
  XLSX.utils.book_append_sheet(wb, wsRC, 'RECURSOS');

  // ===== HOJA BITACORA =====
  const { headers: biHeaders, rows: biRows } = _buildBitacoraRows();
  const wsBI = XLSX.utils.aoa_to_sheet([biHeaders, ...biRows]);
  wsBI['!cols'] = [{wch:12},{wch:16},{wch:10},{wch:10},{wch:60}];
  biHeaders.forEach((_,i)=>{
    const cellRef = XLSX.utils.encode_cell({r:0, c:i});
    if (!wsBI[cellRef]) return;
    wsBI[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
      fill: { fgColor: { rgb: '374151' } },
      alignment: { horizontal: 'center', wrapText: true }
    };
  });
  biRows.forEach((_, r) => {
    const cellRef = XLSX.utils.encode_cell({ r: r+1, c: 4 });
    if (wsBI[cellRef]) wsBI[cellRef].s = { alignment: { wrapText: true, vertical: 'top' } };
  });
  XLSX.utils.book_append_sheet(wb, wsBI, 'BITACORA');

  // ===== HOJA CONTROL_SOSTENIMIENTO =====
  const { headers: csHeaders, rows: csRows } = _buildControlSostenimientoRows();
  const wsCS = XLSX.utils.aoa_to_sheet([csHeaders, ...csRows]);

  // Ancho columnas CONTROL_SOSTENIMIENTO (22 cols)
  wsCS['!cols'] = [
    {wch:12},{wch:20},{wch:10},{wch:14},{wch:10},{wch:16},{wch:14},{wch:20},{wch:12},{wch:10},{wch:8},{wch:8},{wch:10},{wch:8},{wch:12},{wch:10},{wch:10},{wch:12},{wch:12},{wch:12},{wch:16},{wch:16}
  ];

  // Estilo cabecera hoja CONTROL: fondo verde oscuro
  csHeaders.forEach((_,i)=>{
    const cellRef = XLSX.utils.encode_cell({r:0, c:i});
    if (!wsCS[cellRef]) return;
    wsCS[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
      fill: { fgColor: { rgb: '15803D' } },
      alignment: { horizontal: 'center', wrapText: true }
    };
  });

  XLSX.utils.book_append_sheet(wb, wsCS, 'CONTROL_SOSTENIMIENTO');

  // ===== HOJA STAND_BY =====
  const { headers: sbHeaders, rows: sbSheetRows } = _buildStandByExportRows();
  // Sin fila de totales en STAND_BY
  const wsSB = XLSX.utils.aoa_to_sheet([sbHeaders, ...sbSheetRows]);
  wsSB['!cols'] = [{wch:6},{wch:12},{wch:18},{wch:36},{wch:8},{wch:8},{wch:12},{wch:10},{wch:10},{wch:24},{wch:20},{wch:8},{wch:10},{wch:10},{wch:8},{wch:8},{wch:10},{wch:40}];
  sbHeaders.forEach((_,i)=>{
    const cellRef = XLSX.utils.encode_cell({r:0, c:i});
    if (!wsSB[cellRef]) return;
    wsSB[cellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 },
      fill: { fgColor: { rgb: 'DC2626' } },
      alignment: { horizontal: 'center', wrapText: true }
    };
  });
  XLSX.utils.book_append_sheet(wb, wsSB, 'STAND_BY');

  // ===== HOJA REPORTE_WSP (texto descriptivo tal cual se comparte por WhatsApp) =====
  const wspLineas = _buildReporteWspLineas();
  const wsWSP = XLSX.utils.aoa_to_sheet(wspLineas);
  wsWSP['!cols'] = [{ wch: 95 }];
  wspLineas.forEach((_, r) => {
    const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
    if (wsWSP[cellRef]) {
      wsWSP[cellRef].s = { alignment: { wrapText: true, vertical: 'top' }, font: { name: 'Arial', sz: 10 } };
    }
  });
  XLSX.utils.book_append_sheet(wb, wsWSP, 'REPORTE_WSP');

  // HOJA TELEMETRÍA (oculta)
  if (_tele.inicio) {
    const _fin=new Date(),_tot=Math.round((_fin-_tele.inicio)/1000);
    const _th=['Pestaña','Hora entrada','Hora salida','Tiempo (seg)'];
    const _appVer = 'v39';
    const _tr=_tele.tabs.map(t=>[t.tab,t.entrada,t.salida,t.seg]);
    _tr.push(['TOTAL',_tele.inicio.toTimeString().slice(0,8),_fin.toTimeString().slice(0,8),_tot]);
    _tr.push(['','','Total minutos',Math.floor(_tot/60)+' min '+(_tot%60)+' seg']);
    const _wst=XLSX.utils.aoa_to_sheet([_th,..._tr]);
    _wst['!cols']=[{wch:14},{wch:14},{wch:14},{wch:14}];
    _th.forEach((_,i)=>{const r=XLSX.utils.encode_cell({r:0,c:i});if(!_wst[r])return;_wst[r].s={font:{bold:true,color:{rgb:'FFFFFF'},sz:9},fill:{fgColor:{rgb:'555555'}},alignment:{horizontal:'center'}};});
    // Versión del aplicativo en celda E1
    const _verCell = XLSX.utils.encode_cell({r:0,c:4});
    _wst[_verCell] = { v: 'Versión app: '+_appVer, t:'s', s:{font:{sz:8,color:{rgb:'AAAAAA'}}} };
    if (!_wst['!ref']) _wst['!ref'] = 'A1:E'+(_tr.length+1);
    XLSX.utils.book_append_sheet(wb,_wst,'TELEMETRIA');
    if(!wb.Workbook)wb.Workbook={};if(!wb.Workbook.Sheets)wb.Workbook.Sheets=[];
    const _ti=wb.SheetNames.indexOf('TELEMETRIA');
    if(_ti>=0){if(!wb.Workbook.Sheets[_ti])wb.Workbook.Sheets[_ti]={};wb.Workbook.Sheets[_ti].Hidden=1;}
  }

  return wb;
}

// Convierte el workbook a base64 (para enviarlo por POST) usando el propio conversor de SheetJS.
function _workbookABase64(wb) {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'base64', cellStyles: true });
}

function exportarXLSX() {
  const meta = getMeta();
  const fecha = meta.fecha || 'sin-fecha';
  const frente = meta.frente || 'frente';
  const wb = _construirWorkbookRDC();

  try {
    XLSX.writeFile(wb, `RD_${frente}_${fecha}.xlsx`, { bookType: 'xlsx', type: 'binary', cellStyles: true, cellDates: true });
  } catch(e) {
    // Fallback: download via blob
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true, cellDates: true });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `RD_${frente}_${fecha}.xlsx`;
    a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  }
  showToast(`Excel descargado — ${controlItems.length} elem. en CONTROL 📊✅`);
}

// ==================== ENVÍO DEL REPORTE (Power Automate) ====================
function _mostrarEstadoEnvio(tipo, mensajeHtml) {
  const box = document.getElementById('envio-status');
  if (!box) return;
  const clasePorTipo = { cargando: 'alert-blue', exito: 'alert-green', error: 'alert-red' };
  box.className = 'alert ' + (clasePorTipo[tipo] || 'alert-blue');
  box.style.display = 'flex';
  box.innerHTML = mensajeHtml;
}

function _actualizarBotonNuevo() {
  const btn = document.getElementById('btn-nuevo');
  if (!btn) return;
  const habilitado = reporteEnviado || reporteFinalizadoSinEnvio;
  btn.disabled = !habilitado;
  btn.style.opacity = habilitado ? '1' : '.5';
  btn.style.cursor = habilitado ? 'pointer' : 'not-allowed';
  btn.title = habilitado ? '' : 'Primero envía el reporte con "Terminado y Enviar", o usa "No tengo señal" si no hay conexión';
}

function _guardarDatosSticky() {
  try {
    const meta = getMeta();
    localStorage.setItem(STICKY_KEY, JSON.stringify({
      sector: meta.sector, frente: meta.frente,
      supervisor: meta.supervisor, capataz: meta.capataz
    }));
  } catch(e) {}
}
function _cargarDatosSticky() {
  try {
    const d = JSON.parse(localStorage.getItem(STICKY_KEY));
    if (!d) return;
    const sEl = document.getElementById('f-sector');
    const fEl = document.getElementById('f-frente');
    const supEl = document.getElementById('f-supervisor');
    const capEl = document.getElementById('f-capataz');
    if (sEl && d.sector) { sEl.value = d.sector; if (typeof onSectorChange === 'function') onSectorChange(); }
    if (fEl && d.frente) { fEl.value = d.frente; if (typeof onFrenteChange === 'function') onFrenteChange(); }
    if (supEl && d.supervisor) supEl.value = d.supervisor;
    if (capEl && d.capataz) capEl.value = d.capataz;
  } catch(e) {}
}
async function terminarYEnviar() {
  const btn = document.getElementById('btn-enviar');
  const meta = getMeta();
  const frente = meta.frente || '';
  const fecha = meta.fecha || '';

  if (!frente || !fecha) {
    showToast('Completa Fecha y Frente (pestaña Datos) antes de enviar ⚠️');
    return;
  }

  btn.disabled = true;
  const textoOriginalBtn = btn.innerHTML;
  btn.innerHTML = '<i class="ti ti-loader-2"></i> Enviando reporte...';
  _mostrarEstadoEnvio('cargando', '<i class="ti ti-loader-2" style="flex-shrink:0"></i><span>Enviando reporte, por favor espera...</span>');

  try {
    const wb = _construirWorkbookRDC();
    const contenidoArchivo = _workbookABase64(wb);
    const nombreArchivo = `${frente}_${fecha}.xlsx`;

    const respuesta = await fetch(POWER_AUTOMATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreArchivo, contenidoArchivo, frente, fecha })
    });

    if (respuesta.status === 202) {
      reporteEnviado = true;
      _actualizarBotonNuevo();
      _guardarDatosSticky();
      localStorage.removeItem(STORAGE_KEY);
      showToast('Reporte enviado ✅');
      btn.innerHTML = '<i class="ti ti-circle-check"></i> Reporte enviado';
      _mostrarEstadoEnvio('exito', '<i class="ti ti-circle-check" style="flex-shrink:0"></i><span>✅ Reporte enviado correctamente. Descarga tu copia cuando quieras. Para el siguiente reporte, toca la pestaña <strong>Datos</strong>.</span>');
    } else {
      throw new Error('Respuesta inesperada: HTTP ' + respuesta.status);
    }
  } catch (e) {
    const esRed = e instanceof TypeError && e.message && (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed'));
    const msgExtra = esRed ? ' Abre el archivo desde el navegador (no desde el explorador de archivos directo) o verifica tu conexión.' : (' — ' + e.message);
    _mostrarEstadoEnvio('error', '<i class="ti ti-alert-triangle" style="flex-shrink:0"></i><span>❌ No se pudo enviar.' + msgExtra + ' Tus datos no se han perdido. Descarga tu copia manualmente.</span>');
    showToast('Error al enviar el reporte ❌');
    btn.disabled = false;
    btn.innerHTML = textoOriginalBtn;
  }
}

function descargarMiCopia() {
  exportarXLSX();
}

// ==================== MODO SIN SEÑAL / COLA DE PENDIENTES ====================
function _leerColaPendientes() {
  try {
    const data = JSON.parse(localStorage.getItem(COLA_PENDIENTES_KEY));
    return Array.isArray(data) ? data : [];
  } catch(e) { return []; }
}
function _guardarColaPendientes(arr) {
  try { localStorage.setItem(COLA_PENDIENTES_KEY, JSON.stringify(arr)); } catch(e) {}
}
function _actualizarIndicadorPendientes() {
  const box = document.getElementById('pendientes-indicador');
  if (!box) return;
  const cola = _leerColaPendientes();
  if (cola.length === 0) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  box.style.display = 'block';
  box.innerHTML = `
    <div class="alert alert-amber">
      <i class="ti ti-cloud-off" style="flex-shrink:0"></i>
      <span style="flex:1"><strong>${cola.length} reporte${cola.length>1?'s':''} pendiente${cola.length>1?'s':''} de envío</strong> (sin señal). Se reintentará automáticamente al detectar conexión.
        <br><button class="secondary-btn" style="margin-top:6px;padding:6px 10px;font-size:12px" onclick="_reintentarColaPendientes(false)"><i class="ti ti-refresh"></i> Reintentar ahora</button>
      </span>
    </div>`;
}

// Marca el reporte actual como finalizado SIN confirmación de envío (por falta de señal),
// lo agrega a la cola de pendientes y habilita "Nuevo reporte". Exige confirmación explícita.
async function marcarSinSenal() {
  const meta = getMeta();
  const frente = meta.frente || '';
  const fecha = meta.fecha || '';

  if (!frente || !fecha) {
    showToast('Completa Fecha y Frente (pestaña Datos) antes de continuar ⚠️');
    return;
  }

  const confirmar = confirm(
    '📵 MODO SIN SEÑAL\n\n' +
    '¿Ya descargaste tu copia (Excel) de este reporte?\n\n' +
    'Al confirmar:\n' +
    '• El reporte quedará guardado en una cola de pendientes.\n' +
    '• La app intentará enviarlo automáticamente en cuanto detecte conexión (al abrir la app o al recuperar señal).\n' +
    '• Se habilitará el botón "Nuevo" para que puedas iniciar el siguiente reporte.\n\n' +
    '⚠️ Es tu responsabilidad conservar la copia descargada hasta que se confirme el envío.\n\n' +
    '¿Confirmas que ya descargaste tu copia y deseas continuar?'
  );
  if (!confirmar) return;

  // Descarga de respaldo automática, por si acaso
  exportarXLSX();

  const wb = _construirWorkbookRDC();
  const contenidoArchivo = _workbookABase64(wb);
  const nombreArchivo = `${frente}_${fecha}.xlsx`;

  const cola = _leerColaPendientes();
  cola.push({
    id: `${frente}_${fecha}_${Date.now()}`,
    nombreArchivo, contenidoArchivo, frente, fecha,
    creado: new Date().toISOString()
  });
  _guardarColaPendientes(cola);
  _actualizarIndicadorPendientes();

  reporteFinalizadoSinEnvio = true;
  saveDraft();
  _actualizarBotonNuevo();

  _mostrarEstadoEnvio('cargando', '<i class="ti ti-cloud-off" style="flex-shrink:0"></i><span>📵 Guardado sin conexión. Se intentará enviar automáticamente en cuanto haya señal. Ya puedes iniciar un nuevo reporte.</span>');
  showToast('Guardado sin conexión — se reintentará el envío 📵');

  // Intento silencioso inmediato, por si en realidad sí hay señal
  _reintentarColaPendientes(true);
}

// Reintenta enviar todos los reportes en la cola de pendientes. silencioso=true no muestra
// toasts de fallo (se usa en los intentos automáticos al abrir la app o recuperar conexión).
async function _reintentarColaPendientes(silencioso) {
  let cola = _leerColaPendientes();
  if (cola.length === 0) return;

  const meta = getMeta();
  const enviados = [];
  const restantes = [];

  for (const item of cola) {
    try {
      const respuesta = await fetch(POWER_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombreArchivo: item.nombreArchivo, contenidoArchivo: item.contenidoArchivo, frente: item.frente, fecha: item.fecha })
      });
      if (respuesta.status === 202) {
        enviados.push(item);
      } else {
        restantes.push(item);
      }
    } catch(e) {
      restantes.push(item);
    }
  }

  _guardarColaPendientes(restantes);
  _actualizarIndicadorPendientes();

  if (enviados.length > 0) {
    showToast(`${enviados.length} reporte${enviados.length>1?'s':''} pendiente${enviados.length>1?'s':''} enviado${enviados.length>1?'s':''} ✅`);
    // Si el reporte que se está viendo ahora mismo era uno de los enviados, actualiza su estado
    const actual = enviados.find(e => e.frente === meta.frente && e.fecha === meta.fecha);
    if (actual && reporteFinalizadoSinEnvio) {
      reporteEnviado = true;
      reporteFinalizadoSinEnvio = false;
      saveDraft();
      _actualizarBotonNuevo();
      _mostrarEstadoEnvio('exito', '<i class="ti ti-circle-check" style="flex-shrink:0"></i><span>✅ Este reporte, que estaba pendiente por falta de señal, ya fue enviado correctamente.</span>');
    }
  } else if (!silencioso) {
    showToast('Sigue sin haber conexión, se reintentará más tarde ❌');
  }
}
window.addEventListener('online', () => _reintentarColaPendientes(true));
// ==================== FIN ENVÍO DEL REPORTE ====================

function exportarCSV() {
  const meta = getMeta();
  const fecha = meta.fecha || 'sin-fecha';
  const frente = meta.frente || 'frente';

  const lines = [];
  const addSection = (nombre, headers, dataRows) => {
    lines.push(`=== ${nombre} ===`);
    lines.push(csvRow(headers));
    dataRows.forEach(r => lines.push(csvRow(r)));
    lines.push('');
  };

  const rdc = _buildRdcRow();
  addSection('RDC', rdc.headers, [rdc.values]);

  const metrados = _buildMetradosRows();
  addSection('METRADOS', metrados.headers, metrados.rows);

  const recursos = _buildRecursosRows();
  addSection('RECURSOS', recursos.headers, recursos.rows);

  const bitacora = _buildBitacoraRows();
  addSection('BITACORA', bitacora.headers, bitacora.rows);

  const control = _buildControlSostenimientoRows();
  addSection('CONTROL_SOSTENIMIENTO', control.headers, control.rows);

  const equipos = _buildEquiposRows();
  addSection('EQUIPOS', equipos.headers, equipos.rows);

  const standBy = _buildStandByExportRows();
  addSection('STAND_BY', standBy.headers, standBy.rows);

  lines.push('=== REPORTE_WSP ===');
  _buildReporteWspLineas().forEach(r => lines.push(csvRow(r)));

  const csvContent = '﻿' + lines.join('\n');
  downloadFile(csvContent, `RD_${frente}_${fecha}.csv`, 'text/csv;charset=utf-8');
  showToast('Exportado para Excel 📊✅');
}
function exportarJSON() {
  const meta = getMeta();
  const frente = meta.frente || 'frente';
  const fecha = meta.fecha || 'sin-fecha';
  const lista = PARTIDAS[frente] || [];

  const partidasOut = getPartidasEjecutadas().map(p=>({partida: p.n, unidad: p.u, metrado_ejecutado: p.met, nueva_no_catalogada: !!p.manual}));

  const data = {
    ...meta,
    personal: {
      capataz: document.getElementById('f-capataces').value,
      operarios: document.getElementById('f-operarios').value,
      oficiales: document.getElementById('f-oficiales').value,
      peones: document.getElementById('f-peones').value,
      vigias: document.getElementById('f-vigias').value
    },
    truck_shop: document.getElementById('f-truckshop').checked,
    hitos: currentHitos.map((h,i)=>({hito:h, hora: document.getElementById('hito-'+i).value})),
    partidas_previstas: partidasOut,
    actividades_no_previstas: rows.map(r=>({
      hora: r.hora,
      detalle_15min: quarterLabels(r.hora).map((lbl,idx)=>({hora:lbl, descripcion:(r.descs||[])[idx]||''})).filter(x=>x.descripcion.trim()!=='')
    })),
    control_sostenimiento: controlItems.map(c=>({fecha:c.fecha,frente:c.frente,sistema:c.sistema,sector:c.sector,elemento:c.elemento,tipo:c.tipo,actividad:c.actividad,codigo:c.codigo,codigoPerno:c.codigoPerno||'',cantidad:c.cantidad,unidad:c.unidad,partidaCodigo:c.partidaCodigo,partidaNombre:c.partidaNombre})),
    equipos_maquinaria: getEquiposRegistrados(),
    stand_by: {
      total_minutos: getStandbyTotalMin(),
      total_hhmm: _sbFmtHHMM(getStandbyTotalMin()),
      eventos: getStandbyRegistrados().map(r => ({
        item: r.item,
        actividad_afectada: r.actividad,
        desde: r.desde,
        hasta: r.hasta,
        total_minutos: r.minutos,
        total_hhmm: r.minutos !== null ? _sbFmtHHMM(r.minutos) : '',
        causa: r.causa,
        comentario: r.comentario
      }))
    },
    comentarios: document.getElementById('f-comentarios').value,
    requerimientos: (document.getElementById('f-requerimientos') ? document.getElementById('f-requerimientos').value : ''),
    restricciones: document.getElementById('f-restricciones').value
  };

  downloadFile(JSON.stringify(data, null, 2), `RD_${frente}_${fecha}.json`, 'application/json');
  showToast('Datos exportados en JSON 🗂️');
}

// ==================== SUPERVISOR PERSISTENTE ====================
function _initSupervisor() {
  const saved = localStorage.getItem(SUPERVISOR_KEY) || '';
  const el = document.getElementById('f-supervisor');
  const lbl = document.getElementById('sup-nombre-lbl');
  if (el) el.value = saved;
  if (lbl) lbl.textContent = saved || '—';
  if (!saved) setTimeout(() => _mostrarModalSup(), 600);
}
function _mostrarModalSup() {
  const modal = document.getElementById('modal-sup');
  if (!modal) return;
  modal.style.display = 'flex';
  const opts = document.getElementById('modal-sup-opts');
  if (opts && typeof SUPERVISORES !== 'undefined') {
    opts.innerHTML = SUPERVISORES.map(s =>
      '<button onclick="_seleccionarSup(\'' + s.replace(/'/g, "\\'") + '\')" style="padding:12px 14px;border:1px solid #e0e0e0;border-radius:10px;background:#f8f8f8;font-family:inherit;font-size:14px;cursor:pointer;text-align:left;color:#111;font-weight:500">' + s + '</button>'
    ).join('');
  }
}
function _cerrarModalSup() {
  const modal = document.getElementById('modal-sup');
  if (modal) modal.style.display = 'none';
}
function _seleccionarSup(nombre) {
  localStorage.setItem(SUPERVISOR_KEY, nombre);
  const el = document.getElementById('f-supervisor');
  const lbl = document.getElementById('sup-nombre-lbl');
  if (el) el.value = nombre;
  if (lbl) lbl.textContent = nombre;
  _cerrarModalSup();
  saveDraft();
  showToast('Supervisor guardado: ' + nombre);
}


function saveDraft() {
  if (suppressSave) return;
  const meta = getMeta();
  const data = {
    meta,
    personal: {
      capataz: document.getElementById('f-capataces').value,
      operarios: document.getElementById('f-operarios').value,
      oficiales: document.getElementById('f-oficiales').value,
      peones: document.getElementById('f-peones').value,
      vigias: document.getElementById('f-vigias').value
    },
    truckShop: document.getElementById('f-truckshop').checked,
    restriccionDesc: document.getElementById('f-restriccion-desc').value,
    restriccionInicio: document.getElementById('f-restriccion-inicio').value,
    restriccionFin: document.getElementById('f-restriccion-fin').value,
    almuerzoSalida: document.getElementById('f-almuerzo-salida').value,
    almuerzoRetorno: document.getElementById('f-almuerzo-retorno').value,
    hitos: currentHitos.map((h,i)=>{ const el=document.getElementById('hito-'+i); return el?el.value:''; }),
    partidaValores,
    rows, rowId,
    bitacoraActiv, bitacoraActivId,
    blq1Horarios, blq3Horarios,
    cables, cableId,
    controlItems, controlId,
    equiposLista, equiposListaId,
    comentarios: document.getElementById('f-comentarios').value,
    requerimientos: (document.getElementById('f-requerimientos') ? document.getElementById('f-requerimientos').value : ''),
    restricciones: document.getElementById('f-restricciones').value,
    redlineEstado,
    redlineSupervisor: document.getElementById('f-redline-supervisor') ? document.getElementById('f-redline-supervisor').value : '',
    redlineTexto: document.getElementById('f-redline').value,
    redlineSupervisor: document.getElementById('f-redline-supervisor') ? document.getElementById('f-redline-supervisor').value : '',
    progRows, progRowId, progAdicRows, progAdicId,
    blq1Valores, blq3Valores,
    metradosManuales, metradosManualId,
    standbyRows, standbyId,
    reporteEnviado,
    reporteFinalizadoSinEnvio
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}
function loadDraft() {
  let data;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e) { data = null; }
  if (!data) { _cargarDatosSticky(); return; }
  // Si el borrador guardado ya fue enviado: guardar datos sticky desde el borrador y limpiar
  if (data.reporteEnviado || data.reporteFinalizadoSinEnvio) {
    try {
      localStorage.setItem(STICKY_KEY, JSON.stringify({
        sector: (data.meta && data.meta.sector) || '',
        frente: (data.meta && data.meta.frente) || '',
        supervisor: (data.meta && data.meta.supervisor) || '',
        capataz: (data.meta && data.meta.capataz) || ''
      }));
    } catch(e) {}
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
    return;
  }
  suppressSave = true;

  document.getElementById('f-fecha').value = data.meta.fecha || '';
  document.getElementById('f-sector').value = data.meta.sector || '';
  onSectorChange();
  document.getElementById('f-frente').value = data.meta.frente || '';
  _cargarSketchesAnteriores();
  // cuadrilla field removed
  document.getElementById('f-capataz').value = data.meta.capataz || '';
  document.getElementById('f-supervisor').value = data.meta.supervisor || '';

  if (data.personal) {
    document.getElementById('f-capataces').value = data.personal.capataz ?? 1;
    document.getElementById('f-operarios').value = data.personal.operarios ?? 0;
    document.getElementById('f-oficiales').value = data.personal.oficiales ?? 0;
    document.getElementById('f-peones').value = data.personal.peones ?? 0;
    document.getElementById('f-vigias').value = data.personal.vigias ?? 0;
  }

  // Migrar partidaValores: asegurar que cada entrada tenga items:[]
  const rawPV = data.partidaValores || {};
  partidaValores = {};
  Object.keys(rawPV).forEach(k => {
    const v = rawPV[k];
    partidaValores[k] = {
      met: (v && v.met !== undefined) ? v.met : '',
      items: (v && Array.isArray(v.items)) ? v.items : []
    };
  });
  blq1Valores = data.blq1Valores || {};
  blq1Horarios = data.blq1Horarios || {};
  blq3Valores = data.blq3Valores || {};
  blq3Horarios = data.blq3Horarios || {};
  renderMetradosPartidas();

  document.getElementById('f-truckshop').checked = !!data.truckShop;
  toggleRestriccion();
  if (data.restriccionDesc) document.getElementById('f-restriccion-desc').value = data.restriccionDesc;
  if (data.restriccionInicio) document.getElementById('f-restriccion-inicio').value = data.restriccionInicio;
  if (data.restriccionFin) document.getElementById('f-restriccion-fin').value = data.restriccionFin;
  if (data.almuerzoSalida) document.getElementById('f-almuerzo-salida').value = data.almuerzoSalida;
  if (data.almuerzoRetorno) document.getElementById('f-almuerzo-retorno').value = data.almuerzoRetorno;

  renderHitos(false);
  (data.hitos||[]).forEach((v,i)=>{ const el=document.getElementById('hito-'+i); if(el) el.value=v||''; });

  rows = (data.rows || []).map(r => {
    if (!r.descs) {
      r.descs = ['','','',''];
      if (r.desc) r.descs[0] = r.desc;
    }
    return r;
  });
  rowId = data.rowId || rows.length;
  bitacoraActiv = data.bitacoraActiv || [];
  bitacoraActivId = data.bitacoraActivId || bitacoraActiv.length;
  _renderBitacora();

  cables = data.cables || [];
  cableId = data.cableId || 0;

  controlItems = (data.controlItems || []).map(c => ({
    ...c,
    // Migración: quitar ceros a la izquierda del número al final del código
    // "Z01/A-003" → "Z01/A-3", "Z01/A-R003" → "Z01/A-R3"
    codigo: (c.codigo||'').replace(/(\d+)$/, n => String(parseInt(n,10)))
  }));
  controlId = data.controlId || controlItems.length;
  // Nota: controlItems se reconstruye desde partidaValores con rebuildControlItems();
  // las funciones de render antiguas (renderCables/renderControlItems) ya no existen.

  // Cargar equipos unificados (nuevo formato), con fallback de formato antiguo
  if (data.equiposLista && data.equiposLista.length > 0) {
    equiposLista = data.equiposLista;
    equiposListaId = data.equiposListaId || equiposLista.length;
  } else {
    // Migrar formato antiguo a nuevo
    equiposLista = [];
    equiposListaId = 0;
    const soporte = new Set(EQUIPOS_SOPORTE_FIJOS.map(n=>n.toLowerCase()));
    EQUIPOS_PERFORACION_FIJOS.forEach((n,i)=>{ const v=parseInt((data.equiposPerforacionFijos||[])[i])||0; if(v>0) equiposLista.push({id:equiposListaId++,nombre:n,cantidad:v}); });
    EQUIPOS_SOPORTE_FIJOS.forEach((n,i)=>{ const v=parseInt((data.equiposSoporteFijos||[])[i])||0; if(v>0) equiposLista.push({id:equiposListaId++,nombre:n,cantidad:v}); });
    (data.equiposPerforacionManual||[]).forEach(m=>equiposLista.push({id:equiposListaId++,nombre:m.nombre,cantidad:m.cantidad}));
    (data.equiposSoporteManual||[]).forEach(m=>equiposLista.push({id:equiposListaId++,nombre:m.nombre,cantidad:m.cantidad}));
  }
  _renderEquiposLista();

  document.getElementById('f-comentarios').value = data.comentarios || '';
  if (document.getElementById('f-requerimientos')) document.getElementById('f-requerimientos').value = data.requerimientos || '';
  document.getElementById('f-restricciones').value = data.restricciones || '';
  if (data.redlineEstado) toggleRedline(data.redlineEstado);
  if (data.redlineTexto) document.getElementById('f-redline').value = data.redlineTexto;
  const _rds=document.getElementById('f-redline-supervisor'); if(_rds && data.redlineSupervisor) _rds.value=data.redlineSupervisor;
  const rdSup = document.getElementById('f-redline-supervisor');
  if (rdSup && data.redlineSupervisor) rdSup.value = data.redlineSupervisor;

  progRows = data.progRows || [];
  progRowId = data.progRowId || 0;
  progAdicRows = data.progAdicRows || [];
  progAdicId = data.progAdicId || 0;

  metradosManuales = data.metradosManuales || [];
  metradosManualId = data.metradosManualId || metradosManuales.length;
  renderMetradosManuales();

  standbyRows = data.standbyRows || [];
  standbyId = data.standbyId || (standbyRows.length ? Math.max(...standbyRows.map(r=>r.id)) + 1 : 0);
  renderStandbyRows();

  reporteEnviado = !!data.reporteEnviado;
  reporteFinalizadoSinEnvio = !!data.reporteFinalizadoSinEnvio;
  _actualizarBotonNuevo();
  if (reporteEnviado) {
    _mostrarEstadoEnvio('exito', '<i class="ti ti-circle-check" style="flex-shrink:0"></i><span>✅ Este reporte ya fue enviado correctamente.</span>');
    const btnEnviar = document.getElementById('btn-enviar');
    if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.innerHTML = '<i class="ti ti-circle-check"></i> Reporte enviado'; }
  } else if (reporteFinalizadoSinEnvio) {
    _mostrarEstadoEnvio('cargando', '<i class="ti ti-cloud-off" style="flex-shrink:0"></i><span>📵 Este reporte quedó pendiente de envío por falta de señal. Se reintentará automáticamente.</span>');
  }

  suppressSave = false;
}
function nuevoReporte() {
  if (!reporteEnviado && !reporteFinalizadoSinEnvio) {
    alert('🚫 Aún no has enviado este reporte.\n\nPresiona "Terminado y Enviar" en la pestaña Resumen y espera el mensaje de confirmación antes de iniciar un reporte nuevo.\n\nSi no tienes señal, usa el botón "No tengo señal — ya descargué mi copia".\n\nTranquilo, tus datos no se han perdido.');
    return;
  }
  const mensaje = reporteEnviado
    ? '✅ Este reporte ya fue enviado.\n\n¿Confirmas que deseas borrar el borrador actual y empezar un reporte nuevo?'
    : '📵 Este reporte quedó marcado como pendiente de envío por falta de señal (se reintentará automáticamente).\n\n¿Ya descargaste tu copia? ¿Confirmas que deseas borrar el borrador actual y empezar un reporte nuevo?';
  const confirmarBorrar = confirm(mensaje);
  if (!confirmarBorrar) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STICKY_KEY);
  location.reload();
}
