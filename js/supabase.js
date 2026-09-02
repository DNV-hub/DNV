// ==================== SUPABASE: CONEXIÓN Y CARGA DE DATOS ====================
// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = 'https://iysastfzhnygzuokomvi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vBIch0iT8eku3IzdW86b0g_gAgk73vh';

// Función helper para esperar a que Supabase esté listo
async function esperarSupabase(maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    if (window.supabase && typeof window.supabase.from === 'function') {
      console.log('✅ Supabase está listo');
      return window.supabase;
    }
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      const { createClient } = window.supabase;
      window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase inicializado');
      return window.supabase;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Supabase no se inicializó a tiempo');
}

// Inicializar Supabase
let supabaseReady = false;
(async () => {
  try {
    window.supabase = await esperarSupabase();
    supabaseReady = true;
  } catch (e) {
    console.error('❌ Error inicializando Supabase:', e);
  }
})();

const supabase = window.supabase;

// Variables que se cargarán desde Supabase
let SECTORES = {};
let SUPERVISORES = [];
let CAPATACES = [];
let REDLINE_SUPERVISORES = [];
// Codificación por frente/zona/sostenimiento (antes era la constante fija PREFIJOS_FRENTE
// en config.js; ahora vive en la tabla "prefijos" y se administra desde el panel admin).
// Misma forma de fila {f,z,s,p,pl} que usaba PREFIJOS_FRENTE, para no tocar rdc.js más de lo necesario.
let PREFIJOS = [];

// Función para cargar datos desde Supabase
async function cargarDatosSupabase() {
  try {
    // Esperar a que Supabase esté listo
    await esperarSupabase();

    console.log('📡 Cargando datos desde Supabase...');
    const { data: supData } = await window.supabase.from('supervisores').select('nombre').eq('estado', true).order('orden');
    SUPERVISORES = (supData || []).map(s => s.nombre);
    console.log('✅ Supervisores:', SUPERVISORES);

    const { data: capData } = await window.supabase.from('capataces').select('nombre').eq('estado', true).order('orden');
    CAPATACES = (capData || []).map(c => c.nombre);
    console.log('✅ Capataces:', CAPATACES);

    const { data: redlineSupData } = await window.supabase.from('redline_supervisores').select('nombre').eq('estado', true).order('orden');
    REDLINE_SUPERVISORES = (redlineSupData || []).map(s => s.nombre);
    console.log('✅ Supervisores Redline:', REDLINE_SUPERVISORES);

    const { data: sectData } = await window.supabase.from('sectores').select('id, nombre').eq('estado', true).order('orden');
    const { data: frenData } = await window.supabase.from('frentes').select('nombre, sector_id').eq('estado', true).order('orden');
    console.log('📊 Sectores:', sectData);
    console.log('📊 Frentes:', frenData);

    SECTORES = {};
    if (sectData) {
      sectData.forEach(sect => {
        const frentesDelSector = (frenData || []).filter(f => f.sector_id === sect.id).map(f => f.nombre);
        SECTORES[sect.nombre] = frentesDelSector;
      });
    }
    console.log('✅ SECTORES cargados:', SECTORES);

    const { data: prefData } = await window.supabase.from('prefijos').select('frente, zona, sost, prefijo, plano').eq('estado', true).order('orden');
    PREFIJOS = (prefData || []).map(p => ({ f: p.frente, z: p.zona, s: p.sost, p: p.prefijo, pl: p.plano }));
    console.log('✅ Prefijos cargados:', PREFIJOS);
  } catch (error) {
    console.error('❌ Error cargando Supabase:', error);
  }
}

