/* ============================================================
   ATLETAS · Capa de datos
   - Modo NUBE (Supabase): datos compartidos en tiempo real.
   - Modo LOCAL (sin claves / sin internet): localStorage.
   localStorage funciona siempre como respaldo offline.

   Modelo de documento (JSONB): cada usuario y cada sesión son
   documentos. El usuario guarda su perfil físico y SUS rutinas
   (personalizadas e independientes). No hace falta migración SQL:
   los campos nuevos viven dentro de `data`.
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'atletas_v1';
  const TABLES = ['usuarios', 'sesiones', 'ejercicios']; // ejercicios = legado (sugerencias globales)

  /* ============================================================
     TIPOS DE EJERCICIO
       carga      → peso (kg) · reps · RIR
       corporal   → reps · RIR            (sin kg externo)
       pliometria → reps · altura · dist  (sin kg, sin RIR)
       velocidad  → distancia · tiempo    (sin kg, sin RIR)
     ============================================================ */
  const TIPOS = {
    carga:      { label: 'Fuerza con carga', campos: ['peso', 'reps', 'rir'] },
    corporal:   { label: 'Peso corporal',    campos: ['reps', 'rir'] },
    pliometria: { label: 'Pliometría',       campos: ['reps', 'altura', 'distancia'] },
    velocidad:  { label: 'Velocidad',        campos: ['distancia', 'tiempo'] },
  };

  /* ============================================================
     RANGOS DE REPETICIONES (por objetivo)
     ============================================================ */
  const RANGOS = {
    fuerza:      { min: 1,  max: 6,  label: 'Fuerza máxima' },
    hipertrofia: { min: 6,  max: 10, label: 'Hipertrofia funcional' },
    accesorio:   { min: 10, max: 15, label: 'Accesorio' },
    pliometria:  { min: 12, max: 15, label: 'Pliometría' },
  };

  const GENEROS = ['masculino', 'femenino', 'otro'];
  const NIVELES = ['Principiante', 'Intermedio', 'Avanzado', 'Elite'];

  /* Estándares de fuerza relativa (1RM ÷ peso corporal), valores masculinos.
     Cada lift tiene 3 umbrales → 4 niveles. Para femenino se aplica un factor. */
  const STD_RATIO = {
    'press-banca':   [0.75, 1.25, 1.75],
    'press-inclinado': [0.6, 1.0, 1.45],
    'press-militar': [0.5, 0.8, 1.1],
    'sentadilla':    [1.0, 1.5, 2.25],
    'peso-muerto':   [1.25, 1.75, 2.5],
    'hip-thrust':    [1.5, 2.1, 2.85],
    'remo':          [0.75, 1.1, 1.5],
    'curl-z':        [0.4, 0.6, 0.85],
  };
  /* Estándares por repeticiones (peso corporal), valores masculinos. */
  const STD_REPS = {
    'dominadas':           [1, 8, 15],
    'dominadas-lastradas': [1, 6, 12],
    'fondos':              [1, 12, 25],
    'flexiones':           [10, 25, 45],
  };
  const FACTOR_FEM_RATIO = 0.72;
  const FACTOR_FEM_REPS = 0.6;

  /* ============================================================
     CATÁLOGO DE EJERCICIOS (base — sugerencias para todos)
     tipo  = carga | corporal | pliometria | velocidad
     rango = fuerza | hipertrofia | accesorio | pliometria
     ============================================================ */
  const EJERCICIOS_BASE = [
    // Tirón (Espalda / Bíceps)
    { id: 'dominadas',            nombre: 'Dominadas',              categoria: 'Espalda',   principal: true,  tipo: 'corporal', rango: 'fuerza' },
    { id: 'dominadas-lastradas',  nombre: 'Dominadas lastradas',    categoria: 'Espalda',   principal: true,  tipo: 'corporal', rango: 'fuerza' },
    { id: 'remo',                 nombre: 'Remo',                   categoria: 'Espalda',   principal: false, tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'remo-t',               nombre: 'Remo T',                 categoria: 'Espalda',   principal: false, tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'face-pull',            nombre: 'Face Pull',              categoria: 'Espalda',   principal: false, tipo: 'carga',    rango: 'accesorio' },
    { id: 'curl-biceps-sentado',  nombre: 'Curl bíceps sentado',    categoria: 'Bíceps',    principal: false, tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'curl-z',               nombre: 'Curl barra Z',           categoria: 'Bíceps',    principal: true,  tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'curl-martillo',        nombre: 'Curl martillo',          categoria: 'Bíceps',    principal: false, tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'antebrazo',            nombre: 'Antebrazo',              categoria: 'Antebrazo', principal: false, tipo: 'carga',    rango: 'accesorio' },
    { id: 'core',                 nombre: 'Core',                   categoria: 'Core',      principal: false, tipo: 'corporal', rango: 'accesorio' },
    // Empuje (Pecho / Hombro / Tríceps)
    { id: 'press-banca',          nombre: 'Press banca',            categoria: 'Pecho',     principal: true,  tipo: 'carga',    rango: 'fuerza' },
    { id: 'press-inclinado',      nombre: 'Press inclinado',        categoria: 'Pecho',     principal: false, tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'press-militar',        nombre: 'Press militar',          categoria: 'Hombro',    principal: true,  tipo: 'carga',    rango: 'fuerza' },
    { id: 'elevaciones-laterales',nombre: 'Elevaciones laterales',  categoria: 'Hombro',    principal: false, tipo: 'carga',    rango: 'accesorio' },
    { id: 'press-frances',        nombre: 'Press francés',          categoria: 'Tríceps',   principal: false, tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'polea-triceps',        nombre: 'Polea tríceps',          categoria: 'Tríceps',   principal: false, tipo: 'carga',    rango: 'accesorio' },
    // Pierna
    { id: 'sentadilla',           nombre: 'Sentadilla',             categoria: 'Pierna',    principal: true,  tipo: 'carga',    rango: 'fuerza' },
    { id: 'maquina-isquios',      nombre: 'Máquina isquios',        categoria: 'Pierna',    principal: false, tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'gemelos',              nombre: 'Gemelos',                categoria: 'Pierna',    principal: false, tipo: 'carga',    rango: 'accesorio' },
    { id: 'step-up',              nombre: 'Step Up',                categoria: 'Pierna',    principal: false, tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'levantamiento-arrodillado', nombre: 'Levantamiento arrodillado', categoria: 'Pierna', principal: false, tipo: 'carga', rango: 'accesorio' },
    { id: 'estocadas',            nombre: 'Estocadas',              categoria: 'Pierna',    principal: false, tipo: 'carga',    rango: 'hipertrofia' },
    { id: 'peso-muerto',          nombre: 'Peso muerto',            categoria: 'Pierna',    principal: true,  tipo: 'carga',    rango: 'fuerza' },
    { id: 'extension-cuadriceps', nombre: 'Extensión de cuádriceps',categoria: 'Pierna',    principal: false, tipo: 'carga',    rango: 'accesorio' },
    { id: 'hip-thrust',           nombre: 'Hip Thrust',             categoria: 'Glúteo',    principal: true,  tipo: 'carga',    rango: 'fuerza' },
    // Peso corporal (atletas)
    { id: 'fondos',               nombre: 'Fondos',                 categoria: 'Peso corporal', principal: false, tipo: 'corporal', rango: 'hipertrofia' },
    { id: 'flexiones',            nombre: 'Flexiones',              categoria: 'Peso corporal', principal: false, tipo: 'corporal', rango: 'accesorio' },
    { id: 'plancha',              nombre: 'Plancha',                categoria: 'Core',          principal: false, tipo: 'corporal', rango: 'accesorio' },
    { id: 'abdominales',          nombre: 'Abdominales',            categoria: 'Core',          principal: false, tipo: 'corporal', rango: 'accesorio' },
    // Pliometría
    { id: 'salto-cajon',          nombre: 'Saltos al cajón',        categoria: 'Pliometría', principal: true,  tipo: 'pliometria', rango: 'pliometria' },
    { id: 'saltos-laterales',     nombre: 'Saltos laterales',       categoria: 'Pliometría', principal: false, tipo: 'pliometria', rango: 'pliometria' },
    { id: 'multisaltos',          nombre: 'Multisaltos',            categoria: 'Pliometría', principal: false, tipo: 'pliometria', rango: 'pliometria' },
    { id: 'boundings',            nombre: 'Boundings',              categoria: 'Pliometría', principal: false, tipo: 'pliometria', rango: 'pliometria' },
    { id: 'salto-vertical',       nombre: 'Salto vertical',         categoria: 'Pliometría', principal: true,  tipo: 'pliometria', rango: 'pliometria' },
    // Velocidad
    { id: 'sprint-10',            nombre: 'Sprint 10 m',            categoria: 'Velocidad', principal: true,  tipo: 'velocidad', rango: null },
    { id: 'sprint-20',            nombre: 'Sprint 20 m',            categoria: 'Velocidad', principal: true,  tipo: 'velocidad', rango: null },
    { id: 'sprint-40',            nombre: 'Sprint 40 m',            categoria: 'Velocidad', principal: false, tipo: 'velocidad', rango: null },
  ];

  // Plantillas para sembrar las rutinas iniciales de un usuario nuevo
  const SESIONES = {
    1: { nombre: 'Sesión 1 · Tirón',  sub: 'Espalda / Bíceps',          ejercicios: ['dominadas', 'remo', 'curl-biceps-sentado', 'curl-z', 'antebrazo', 'core'] },
    2: { nombre: 'Sesión 2 · Empuje', sub: 'Pecho / Hombro / Tríceps',  ejercicios: ['press-banca', 'press-inclinado', 'press-militar', 'elevaciones-laterales', 'press-frances', 'polea-triceps'] },
    3: { nombre: 'Sesión 3 · Pierna A', sub: 'Cuádriceps',              ejercicios: ['sentadilla', 'maquina-isquios', 'gemelos', 'step-up', 'levantamiento-arrodillado', 'estocadas'] },
    4: { nombre: 'Sesión 4 · Pierna B', sub: 'Posterior',               ejercicios: ['peso-muerto', 'extension-cuadriceps', 'gemelos', 'hip-thrust'] },
    5: { nombre: 'Sesión 5 · Atlético', sub: 'Pliometría / Velocidad',  ejercicios: ['salto-cajon', 'salto-vertical', 'multisaltos', 'sprint-20', 'sprint-40', 'core'] },
  };

  // Ejercicios destacados en analítica
  const DESTACADOS = ['press-banca', 'sentadilla', 'peso-muerto', 'dominadas', 'hip-thrust', 'press-militar', 'curl-z', 'salto-vertical', 'sprint-20'];

  /* ============================================================
     FRASES DEL DÍA (estilo atleta — una distinta cada día)
     ============================================================ */
  const FRASES = [
    'Los días que no tenés ganas son los que más te hacen crecer.',
    'Tu competencia también está entrenando hoy.',
    'El progreso no se siente día a día. Se ve meses después.',
    'No entrenes para cansarte. Entrená para mejorar.',
    'Ser consistente gana más partidos que estar motivado.',
    'La disciplina sigue trabajando cuando la motivación desaparece.',
    'Lo que hoy parece poco, en un año cambia todo.',
    'Tu mejor versión no aparece sola. Se construye.',
    'Nadie llega lejos saltándose los días difíciles.',
    'El físico se gana en silencio y se muestra en la cancha.',
    'Una serie más hoy es una ventaja más mañana.',
    'No compitas con el de al lado. Competí con el que fuiste ayer.',
    'La técnica no descansa cuando el rival aprieta.',
    'Los detalles que nadie ve son los que deciden el partido.',
    'Entrenar cansado también suma. Sobre todo cansado.',
  ];
  function fraseDelDia() {
    const d = new Date();
    const inicio = new Date(d.getFullYear(), 0, 0);
    const dia = Math.floor((d - inicio) / 86400000);
    return FRASES[dia % FRASES.length];
  }

  /* ---------- Estado local ---------- */
  function defaultData() { return { usuarios: [], sesiones: [], ejercicios: [], _seeded: false, _counter: 0 }; }
  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      cache = raw ? JSON.parse(raw) : defaultData();
    } catch (e) { console.error('No se pudo leer el almacenamiento', e); cache = defaultData(); }
    TABLES.forEach(t => { if (!cache[t]) cache[t] = []; });
    return cache;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); }
    catch (e) { console.error('No se pudo guardar local', e); }
  }
  function uid(prefix) {
    const r = Math.random().toString(36).slice(2, 8);
    const t = (load()._counter = (load()._counter || 0) + 1);
    return `${prefix}-${t}-${r}`;
  }
  function nowISO() { return new Date().toISOString(); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  /* ============================================================
     NUBE (Supabase) — patrón documento { id, data, updated_at }
     ============================================================ */
  const Cloud = {
    client: null, enabled: false,
    init() {
      try {
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
          this.client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
            realtime: { params: { eventsPerSecond: 5 } },
          });
          this.enabled = true;
        }
      } catch (e) { console.error('Supabase init', e); this.enabled = false; }
      return this.enabled;
    },
    async pullAll() {
      for (const t of TABLES) {
        const { data, error } = await this.client.from('atl_' + t).select('id,data').order('updated_at', { ascending: false });
        if (error) throw error;
        cache[t] = (data || []).map(r => r.data);
      }
    },
    push(table, obj) {
      if (!this.enabled) return;
      this.client.from('atl_' + table)
        .upsert({ id: obj.id, data: obj, updated_at: nowISO() })
        .then(({ error }) => { if (error) console.error('push ' + table, error); });
    },
    remove(table, id) {
      if (!this.enabled) return;
      this.client.from('atl_' + table).delete().eq('id', id)
        .then(({ error }) => { if (error) console.error('remove ' + table, error); });
    },
    subscribe(onChange) {
      if (!this.enabled) return;
      this.client.channel('atletas-realtime')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          applyRemote(payload);
          if (typeof onChange === 'function') onChange();
        })
        .subscribe();
    },
  };

  function applyRemote(p) {
    const table = (p.table || '').replace(/^atl_/, '');
    if (!cache[table]) return;
    if (p.eventType === 'DELETE') {
      const id = p.old && p.old.id;
      cache[table] = cache[table].filter(x => x.id !== id);
    } else if (p.new && p.new.data) {
      const obj = p.new.data;
      const i = cache[table].findIndex(x => x.id === obj.id);
      if (i >= 0) cache[table][i] = obj; else cache[table].unshift(obj);
    }
    save();
  }

  /* ---------- Inicialización ---------- */
  async function init() {
    load();
    if (Cloud.init()) {
      try { await Cloud.pullAll(); save(); }
      catch (e) { console.error('No se pudo sincronizar con la nube, uso datos locales', e); }
      Cloud.subscribe(() => { if (window.DB && typeof DB.onRemoteChange === 'function') DB.onRemoteChange(); });
    }
    seedIfEmpty();
    return Cloud.enabled;
  }

  /* ============================================================
     EJERCICIOS (catálogo base + personalizados por usuario)
     ============================================================ */
  function getEjerciciosBase() { return EJERCICIOS_BASE.slice(); }
  function getEjerciciosDisponibles(usuarioId) {
    const u = getUsuario(usuarioId);
    const custom = (u && u.ejerciciosCustom) || [];
    const legado = (load().ejercicios || []).filter(e => e.activo !== false); // sugerencias viejas globales
    // base + custom del usuario + legado, sin duplicar ids
    const map = {};
    EJERCICIOS_BASE.concat(legado, custom).forEach(e => { map[e.id] = Object.assign({}, map[e.id], e); });
    return Object.values(map);
  }
  function getEjercicio(id, usuarioId) {
    return getEjerciciosDisponibles(usuarioId).find(e => e.id === id) || EJERCICIOS_BASE.find(e => e.id === id) || null;
  }
  function tipoDe(idOrEj, usuarioId) {
    const e = typeof idOrEj === 'string' ? getEjercicio(idOrEj, usuarioId) : idOrEj;
    const t = (e && e.tipo) || 'carga';
    return TIPOS[t] ? t : 'carga';
  }
  function camposTipo(idOrEj, usuarioId) { return TIPOS[tipoDe(idOrEj, usuarioId)].campos; }
  function rangoDe(idOrEj, usuarioId) {
    const e = typeof idOrEj === 'string' ? getEjercicio(idOrEj, usuarioId) : idOrEj;
    if (!e) return RANGOS.hipertrofia;
    if (e.rango && RANGOS[e.rango]) return RANGOS[e.rango];
    return e.principal ? RANGOS.fuerza : RANGOS.hipertrofia;
  }
  function esCorporal(tipo) { return tipo === 'corporal' || tipo === 'pliometria'; }

  // Crea un ejercicio personalizado que pertenece SÓLO a ese usuario
  function crearEjercicioCustom(usuarioId, d) {
    const u = getUsuario(usuarioId);
    if (!u) return null;
    const e = Object.assign({
      id: uid('EJ'), nombre: '', categoria: 'Otros', principal: false, custom: true,
      tipo: 'carga', rango: 'hipertrofia',
    }, d);
    if (!e.nombre.trim()) return null;
    u.ejerciciosCustom = u.ejerciciosCustom || [];
    u.ejerciciosCustom.unshift(e);
    persistUsuario(u);
    return e;
  }

  /* ============================================================
     USUARIOS (con perfil físico + rutinas)
     ============================================================ */
  function ensureUsuarioShape(u) {
    if (!u) return u;
    if (u.pesoCorporal === undefined) u.pesoCorporal = null;
    if (u.alturaCm === undefined) u.alturaCm = null;
    if (u.edad === undefined) u.edad = null;
    if (u.genero === undefined) u.genero = null;
    if (!Array.isArray(u.pesoHistorial)) u.pesoHistorial = [];
    if (!Array.isArray(u.ejerciciosCustom)) u.ejerciciosCustom = [];
    if (!Array.isArray(u.objetivos)) u.objetivos = [];
    if (!Array.isArray(u.rutinas) || !u.rutinas.length) u.rutinas = rutinasPorDefecto();
    // normalizar orden
    u.rutinas.forEach((r, i) => { if (r.orden == null) r.orden = i; });
    return u;
  }
  function getUsuarios() { return load().usuarios.map(ensureUsuarioShape); }
  function getUsuario(id) { return ensureUsuarioShape(load().usuarios.find(u => u.id === id) || null); }
  function persistUsuario(u) {
    if (!u) return;
    const i = load().usuarios.findIndex(x => x.id === u.id);
    if (i >= 0) cache.usuarios[i] = u;
    save(); Cloud.push('usuarios', u);
  }

  function crearUsuario(datos) {
    if (typeof datos === 'string') datos = { nombre: datos };
    datos = datos || {};
    const nombre = (datos.nombre || '').trim();
    if (!nombre) return null;
    const u = {
      id: uid('US'), nombre, fechaCreacion: nowISO(),
      pesoCorporal: datos.pesoCorporal != null && datos.pesoCorporal !== '' ? num(datos.pesoCorporal) : null,
      alturaCm: datos.alturaCm != null && datos.alturaCm !== '' ? num(datos.alturaCm) : null,
      edad: datos.edad != null && datos.edad !== '' ? num(datos.edad) : null,
      genero: datos.genero || null,
      pesoHistorial: [],
      ejerciciosCustom: [],
      rutinas: rutinasPorDefecto(),
    };
    if (u.pesoCorporal) u.pesoHistorial.push({ fecha: todayISO(), peso: u.pesoCorporal, altura: u.alturaCm, edad: u.edad });
    load().usuarios.push(u);
    persistUsuario(u);
    return u;
  }

  function actualizarUsuario(id, cambios) {
    const u = getUsuario(id);
    if (!u) return null;
    Object.assign(u, cambios);
    persistUsuario(u);
    return u;
  }

  // Perfil físico: actualiza valores actuales y guarda un punto en el historial (uno por día)
  function actualizarPerfilFisico(id, datos) {
    const u = getUsuario(id);
    if (!u) return null;
    if (datos.pesoCorporal !== undefined && datos.pesoCorporal !== '') u.pesoCorporal = num(datos.pesoCorporal);
    if (datos.alturaCm !== undefined && datos.alturaCm !== '') u.alturaCm = num(datos.alturaCm);
    if (datos.edad !== undefined && datos.edad !== '') u.edad = num(datos.edad);
    if (datos.genero !== undefined && datos.genero) u.genero = datos.genero;
    if (u.pesoCorporal) {
      const hoy = todayISO();
      u.pesoHistorial = (u.pesoHistorial || []).filter(p => p.fecha !== hoy);
      u.pesoHistorial.push({ fecha: hoy, peso: u.pesoCorporal, altura: u.alturaCm, edad: u.edad });
      u.pesoHistorial.sort((a, b) => a.fecha.localeCompare(b.fecha));
    }
    persistUsuario(u);
    return u;
  }

  // Peso corporal vigente en una fecha (último registro <= fecha; si no, el actual)
  function pesoCorporalEn(usuario, fechaISO) {
    if (!usuario) return 0;
    const h = (usuario.pesoHistorial || []).filter(p => (p.fecha || '') <= fechaISO);
    if (h.length) return num(h[h.length - 1].peso);
    return num(usuario.pesoCorporal);
  }

  /* ============================================================
     RUTINAS (sesiones plantilla, personalizadas por usuario)
     ============================================================ */
  function ejercicioRutinaDesde(ejBase) {
    return {
      ejercicioId: ejBase.id, nombre: ejBase.nombre, categoria: ejBase.categoria || 'Otros',
      tipo: ejBase.tipo || 'carga', rango: ejBase.rango || null, principal: !!ejBase.principal,
      seriesObjetivo: ejBase.seriesObjetivo || 3,
    };
  }
  function rutinasPorDefecto() {
    return Object.keys(SESIONES).map((k, i) => {
      const s = SESIONES[k];
      return {
        id: uid('RT'), nombre: s.nombre, sub: s.sub, orden: i,
        ejercicios: s.ejercicios.map(id => ejercicioRutinaDesde(EJERCICIOS_BASE.find(e => e.id === id) || { id, nombre: id })),
      };
    });
  }
  function getRutinas(usuarioId) {
    const u = getUsuario(usuarioId);
    return u ? (u.rutinas || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0)) : [];
  }
  function getRutina(usuarioId, rutinaId) {
    return getRutinas(usuarioId).find(r => r.id === rutinaId) || null;
  }
  function crearRutina(usuarioId, datos) {
    const u = getUsuario(usuarioId);
    if (!u) return null;
    const r = { id: uid('RT'), nombre: (datos && datos.nombre) || 'Nueva sesión', sub: (datos && datos.sub) || '', orden: (u.rutinas || []).length, ejercicios: [] };
    u.rutinas.push(r); persistUsuario(u);
    return r;
  }
  function actualizarRutina(usuarioId, rutinaId, cambios) {
    const u = getUsuario(usuarioId);
    if (!u) return null;
    const r = (u.rutinas || []).find(x => x.id === rutinaId);
    if (!r) return null;
    Object.assign(r, cambios);
    persistUsuario(u);
    return r;
  }
  function eliminarRutina(usuarioId, rutinaId) {
    const u = getUsuario(usuarioId);
    if (!u) return;
    u.rutinas = (u.rutinas || []).filter(r => r.id !== rutinaId);
    u.rutinas.forEach((r, i) => r.orden = i);
    persistUsuario(u);
  }
  function duplicarRutina(usuarioId, rutinaId) {
    const u = getUsuario(usuarioId);
    if (!u) return null;
    const r = (u.rutinas || []).find(x => x.id === rutinaId);
    if (!r) return null;
    const copia = JSON.parse(JSON.stringify(r));
    copia.id = uid('RT'); copia.nombre = r.nombre + ' (copia)'; copia.orden = u.rutinas.length;
    u.rutinas.push(copia); persistUsuario(u);
    return copia;
  }
  function reordenarRutinas(usuarioId, idsEnOrden) {
    const u = getUsuario(usuarioId);
    if (!u) return;
    idsEnOrden.forEach((id, i) => { const r = u.rutinas.find(x => x.id === id); if (r) r.orden = i; });
    persistUsuario(u);
  }

  // Ejercicios dentro de una rutina (permanentes)
  function agregarEjercicioARutina(usuarioId, rutinaId, ejDef) {
    const u = getUsuario(usuarioId);
    if (!u) return null;
    const r = (u.rutinas || []).find(x => x.id === rutinaId);
    if (!r) return null;
    r.ejercicios = r.ejercicios || [];
    r.ejercicios.push(ejercicioRutinaDesde(ejDef));
    persistUsuario(u);
    return r;
  }
  function quitarEjercicioDeRutina(usuarioId, rutinaId, index) {
    const u = getUsuario(usuarioId);
    if (!u) return;
    const r = (u.rutinas || []).find(x => x.id === rutinaId);
    if (!r) return;
    r.ejercicios.splice(index, 1);
    persistUsuario(u);
  }
  function editarEjercicioRutina(usuarioId, rutinaId, index, cambios) {
    const u = getUsuario(usuarioId);
    if (!u) return;
    const r = (u.rutinas || []).find(x => x.id === rutinaId);
    if (!r || !r.ejercicios[index]) return;
    Object.assign(r.ejercicios[index], cambios);
    persistUsuario(u);
  }
  function moverEjercicioRutina(usuarioId, rutinaId, index, dir) {
    const u = getUsuario(usuarioId);
    if (!u) return;
    const r = (u.rutinas || []).find(x => x.id === rutinaId);
    if (!r) return;
    const j = index + dir;
    if (j < 0 || j >= r.ejercicios.length) return;
    const tmp = r.ejercicios[index]; r.ejercicios[index] = r.ejercicios[j]; r.ejercicios[j] = tmp;
    persistUsuario(u);
  }

  /* ============================================================
     SESIONES (registro de entrenamiento)
     ============================================================ */
  function getSesiones(usuarioId) {
    let s = load().sesiones.slice();
    if (usuarioId) s = s.filter(x => x.usuarioId === usuarioId);
    return s.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.id).localeCompare(a.id));
  }
  function getSesion(id) { return load().sesiones.find(s => s.id === id) || null; }

  function nuevaSerie() { return { peso: '', reps: '', rir: '', altura: '', distancia: '', tiempo: '', notas: '' }; }

  // Construye un ejercicio de sesión a partir de un ejercicio de rutina (con sus series objetivo)
  function ejercicioSesionDesdeRutina(er) {
    const n = Math.max(1, num(er.seriesObjetivo) || 3);
    const series = []; for (let i = 0; i < n; i++) series.push(nuevaSerie());
    return {
      ejercicioId: er.ejercicioId, nombre: er.nombre, categoria: er.categoria,
      tipo: er.tipo || 'carga', rango: er.rango || null, principal: !!er.principal,
      series, notas: '',
    };
  }
  function nuevoEjercicioSesion(ejId, usuarioId) {
    const e = getEjercicio(ejId, usuarioId) || { id: ejId, nombre: ejId, categoria: 'Otros', principal: false, tipo: 'carga', rango: 'hipertrofia' };
    return {
      ejercicioId: e.id, nombre: e.nombre, categoria: e.categoria, principal: !!e.principal,
      tipo: tipoDe(e), rango: e.rango || null,
      series: [nuevaSerie(), nuevaSerie(), nuevaSerie()], notas: '',
    };
  }

  // Borrador de sesión a partir de una rutina del usuario
  function sesionDesdeRutina(usuarioId, rutinaId) {
    const u = getUsuario(usuarioId);
    const r = getRutina(usuarioId, rutinaId);
    if (!r) return null;
    return {
      usuarioId, rutinaId: r.id, fecha: todayISO(),
      tipoSesion: r.nombre, tipoId: r.id, duracion: '', observaciones: '',
      pesoCorporal: u ? num(u.pesoCorporal) : 0,
      ejercicios: (r.ejercicios || []).map(ejercicioSesionDesdeRutina),
    };
  }

  function crearSesion(d) {
    const u = getUsuario(d && d.usuarioId);
    const s = Object.assign({
      id: uid('SE'), fechaCreacion: nowISO(),
      usuarioId: null, fecha: todayISO(), tipoSesion: 'Entrenamiento', tipoId: 'libre', rutinaId: null,
      duracion: '', observaciones: '', pesoCorporal: u ? num(u.pesoCorporal) : 0, ejercicios: [],
    }, d);
    if (!s.pesoCorporal && u) s.pesoCorporal = pesoCorporalEn(u, s.fecha);
    load().sesiones.unshift(s);
    save(); Cloud.push('sesiones', s);
    return s;
  }
  function actualizarSesion(id, cambios) {
    const s = getSesion(id);
    if (!s) return null;
    Object.assign(s, cambios);
    save(); Cloud.push('sesiones', s);
    return s;
  }
  function eliminarSesion(id) {
    cache.sesiones = cache.sesiones.filter(s => s.id !== id);
    save(); Cloud.remove('sesiones', id);
  }

  /* ============================================================
     CÁLCULOS: volumen (con peso corporal), records, métricas
     ============================================================ */
  function serieValida(se) { return num(se.reps) > 0 || num(se.distancia) > 0 || String(se.tiempo || '').trim() !== ''; }
  function e1rm(peso, reps) { peso = num(peso); reps = num(reps); if (!reps) return 0; return peso * (1 + reps / 30); }

  // Carga efectiva de una serie según el tipo (peso corporal para ejercicios corporales)
  function cargaEfectiva(se, tipo, pesoCorporal) {
    if (tipo === 'carga') return num(se.peso);
    if (tipo === 'corporal' || tipo === 'pliometria') return num(pesoCorporal) + num(se.peso); // peso = lastre opcional
    return 0; // velocidad no mueve carga
  }
  function volumenSerie(se, tipo, pesoCorporal) { return cargaEfectiva(se, tipo, pesoCorporal) * num(se.reps); }

  function pesoCorporalSesion(s) {
    if (s.pesoCorporal) return num(s.pesoCorporal);
    const u = getUsuario(s.usuarioId);
    return u ? pesoCorporalEn(u, s.fecha) : 0;
  }
  function volumenSesion(s) {
    const bw = pesoCorporalSesion(s);
    let total = 0;
    (s.ejercicios || []).forEach(ej => {
      const tipo = ej.tipo || tipoDe(ej.ejercicioId, s.usuarioId);
      (ej.series || []).forEach(se => { if (serieValida(se)) total += volumenSerie(se, tipo, bw); });
    });
    return Math.round(total);
  }
  function seriesSesion(s) {
    let n = 0;
    (s.ejercicios || []).forEach(ej => (ej.series || []).forEach(se => { if (serieValida(se)) n++; }));
    return n;
  }
  function ejerciciosSesion(s) {
    return (s.ejercicios || []).filter(ej => (ej.series || []).some(serieValida)).length;
  }

  // Récords por ejercicio. excluirId ignora una sesión (récord ANTES de guardarla).
  function getRecords(usuarioId, excluirId) {
    const map = {};
    getSesiones(usuarioId).forEach(s => {
      if (excluirId && s.id === excluirId) return;
      (s.ejercicios || []).forEach(ej => {
        (ej.series || []).forEach(se => {
          if (!serieValida(se)) return;
          const peso = num(se.peso), reps = num(se.reps), est = e1rm(peso, reps);
          const r = map[ej.ejercicioId] || { ejercicioId: ej.ejercicioId, nombre: ej.nombre, principal: ej.principal, tipo: ej.tipo || tipoDe(ej.ejercicioId, usuarioId), pesoMax: 0, repsEnMax: 0, repsMax: 0, e1rm: 0, fecha: s.fecha };
          if (peso > r.pesoMax || (peso === r.pesoMax && reps > r.repsEnMax)) { r.pesoMax = peso; r.repsEnMax = reps; r.fecha = s.fecha; }
          if (reps > r.repsMax) r.repsMax = reps;
          if (est > r.e1rm) r.e1rm = est;
          r.nombre = ej.nombre; r.principal = ej.principal; r.tipo = ej.tipo || r.tipo;
          map[ej.ejercicioId] = r;
        });
      });
    });
    return Object.values(map).sort((a, b) => (b.e1rm - a.e1rm) || (b.repsMax - a.repsMax));
  }

  function recordsRecientes(usuarioId, limite) {
    const recs = getRecords(usuarioId).filter(r => r.pesoMax > 0 || r.repsMax > 0);
    return recs.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, limite || 5);
  }

  function detectarRecords(usuarioId, sesion) {
    if (!sesion || !sesion.ejercicios) return [];
    const prev = {};
    getRecords(usuarioId, sesion.id).forEach(r => { prev[r.ejercicioId] = r; });
    const logros = [];
    sesion.ejercicios.forEach(ej => {
      const validas = (ej.series || []).filter(serieValida);
      if (!validas.length) return;
      const tipo = ej.tipo || tipoDe(ej.ejercicioId, usuarioId);
      const pesoMax = Math.max(0, ...validas.map(se => num(se.peso)));
      const repsMax = Math.max(0, ...validas.map(se => num(se.reps)));
      const e1Max = Math.max(0, ...validas.map(se => e1rm(se.peso, se.reps)));
      const ant = prev[ej.ejercicioId];
      if (!ant) return;
      if (tipo === 'carga') {
        if (pesoMax > ant.pesoMax) logros.push({ nombre: ej.nombre, tipo: 'peso', antes: ant.pesoMax, ahora: pesoMax, delta: pesoMax - ant.pesoMax, unidad: 'kg' });
        else if (e1Max > ant.e1rm + 0.01) logros.push({ nombre: ej.nombre, tipo: '1rm', antes: Math.round(ant.e1rm), ahora: Math.round(e1Max), delta: Math.round(e1Max - ant.e1rm), unidad: 'kg' });
      } else {
        if (repsMax > ant.repsMax) logros.push({ nombre: ej.nombre, tipo: 'reps', antes: ant.repsMax, ahora: repsMax, delta: repsMax - ant.repsMax, unidad: 'reps' });
      }
    });
    return logros;
  }

  function metricas(usuarioId) {
    const sesiones = getSesiones(usuarioId);
    const now = new Date();
    const inicioSemana = new Date(now); const day = (now.getDay() + 6) % 7; inicioSemana.setDate(now.getDate() - day); inicioSemana.setHours(0, 0, 0, 0);
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    let semana = 0, mes = 0, volTotal = 0, ejerc = 0, series = 0;
    sesiones.forEach(s => {
      const f = new Date(s.fecha + 'T00:00:00');
      if (f >= inicioSemana) semana++;
      if (f >= inicioMes) mes++;
      volTotal += volumenSesion(s);
      ejerc += ejerciciosSesion(s);
      series += seriesSesion(s);
    });
    return { totalSesiones: sesiones.length, semana, mes, volTotal: Math.round(volTotal), ejercicios: ejerc, series };
  }

  function resumenSemana(usuarioId) {
    const now = new Date();
    const inicioSemana = new Date(now); const day = (now.getDay() + 6) % 7; inicioSemana.setDate(now.getDate() - day); inicioSemana.setHours(0, 0, 0, 0);
    const iso = inicioSemana.toISOString().slice(0, 10);
    let entrenamientos = 0, volumen = 0, ejercicios = 0, series = 0;
    getSesiones(usuarioId).forEach(s => {
      const f = new Date(s.fecha + 'T00:00:00');
      if (f < inicioSemana) return;
      entrenamientos++; volumen += volumenSesion(s); ejercicios += ejerciciosSesion(s); series += seriesSesion(s);
    });
    const prs = getRecords(usuarioId).filter(r => (r.pesoMax > 0 || r.repsMax > 0) && (r.fecha || '') >= iso).length;
    return { entrenamientos, volumen: Math.round(volumen), ejercicios, series, prs };
  }

  function serieTemporal(usuarioId, ejercicioId, desdeDias) {
    const limite = desdeDias ? Date.now() - desdeDias * 86400000 : 0;
    const puntos = [];
    getSesiones(usuarioId).slice().reverse().forEach(s => {
      const f = new Date(s.fecha + 'T00:00:00').getTime();
      if (limite && f < limite) return;
      let mejorE = 0, mejorPeso = 0, mejorReps = 0;
      (s.ejercicios || []).forEach(ej => {
        if (ej.ejercicioId !== ejercicioId) return;
        (ej.series || []).forEach(se => {
          if (!serieValida(se)) return;
          mejorE = Math.max(mejorE, e1rm(se.peso, se.reps));
          mejorPeso = Math.max(mejorPeso, num(se.peso));
          mejorReps = Math.max(mejorReps, num(se.reps));
        });
      });
      if (mejorE > 0 || mejorReps > 0) puntos.push({ fecha: s.fecha, e1rm: Math.round(mejorE), peso: mejorPeso, reps: mejorReps });
    });
    return puntos;
  }

  /* ============================================================
     FUERZA RELATIVA
     ============================================================ */
  function nivelIdx(v, u) { if (v < u[0]) return 0; if (v < u[1]) return 1; if (v < u[2]) return 2; return 3; }

  function fuerzaRelativa(usuario, ejercicioId, record) {
    if (!usuario) return null;
    const tipo = tipoDe(ejercicioId, usuario.id);
    const r = record || getRecords(usuario.id).find(x => x.ejercicioId === ejercicioId);
    if (!r) return null;
    const fem = usuario.genero === 'femenino';
    if (tipo === 'carga') {
      const bw = num(usuario.pesoCorporal);
      if (!bw || !r.e1rm) return null;
      const ratio = r.e1rm / bw;
      const base = STD_RATIO[ejercicioId];
      const umb = base ? (fem ? base.map(x => x * FACTOR_FEM_RATIO) : base) : null;
      return { tipo: 'carga', ratio, nivel: umb ? NIVELES[nivelIdx(ratio, umb)] : null, e1rm: r.e1rm, pesoMax: r.pesoMax, nombre: r.nombre };
    }
    if (tipo === 'corporal') {
      const base = STD_REPS[ejercicioId];
      if (!r.repsMax) return null;
      const umb = base ? (fem ? base.map(x => Math.max(1, Math.round(x * FACTOR_FEM_REPS))) : base) : null;
      return { tipo: 'corporal', reps: r.repsMax, nivel: umb ? NIVELES[nivelIdx(r.repsMax, umb)] : null, nombre: r.nombre };
    }
    return null;
  }

  // Análisis de fuerza relativa para los ejercicios con estándar y datos
  function analisisRelativo(usuarioId) {
    const u = getUsuario(usuarioId);
    if (!u) return [];
    const recs = getRecords(usuarioId);
    const ids = Object.keys(STD_RATIO).concat(Object.keys(STD_REPS));
    const out = [];
    ids.forEach(id => {
      const r = recs.find(x => x.ejercicioId === id);
      if (!r) return;
      const fr = fuerzaRelativa(u, id, r);
      if (fr) out.push(Object.assign({ ejercicioId: id }, fr));
    });
    return out;
  }

  function progresion(usuarioId, ejercicioId) {
    const e = getEjercicio(ejercicioId, usuarioId);
    const tipo = tipoDe(ejercicioId, usuarioId);
    if (tipo === 'velocidad') return null;
    const rango = rangoDe(ejercicioId, usuarioId);
    const principal = e ? e.principal : false;
    const sesiones = getSesiones(usuarioId);
    for (const s of sesiones) {
      const ej = (s.ejercicios || []).find(x => x.ejercicioId === ejercicioId);
      if (!ej) continue;
      const validas = (ej.series || []).filter(serieValida);
      if (validas.length < 3) return null;
      const todasEnTope = validas.every(se => num(se.reps) >= rango.max);
      if (todasEnTope) {
        if (tipo === 'carga') return { tipo: 'subir', texto: principal ? 'Llegaste al tope de reps: subí carga la próxima' : 'Listo para progresar peso', rango };
        return { tipo: 'subir', texto: 'Dominás el rango: sumá dificultad o reps', rango };
      }
      return { tipo: 'mantener', texto: `Seguí en el rango ${rango.min}–${rango.max} reps`, rango };
    }
    return null;
  }

  function ultimaCarga(usuarioId, ejercicioId) {
    const sesiones = getSesiones(usuarioId);
    for (const s of sesiones) {
      const ej = (s.ejercicios || []).find(x => x.ejercicioId === ejercicioId);
      if (ej && (ej.series || []).some(serieValida)) {
        return { fecha: s.fecha, series: ej.series.map(se => ({ peso: se.peso, reps: se.reps, altura: se.altura, distancia: se.distancia, tiempo: se.tiempo })) };
      }
    }
    return null;
  }

  /* ============================================================
     OBJETIVOS (metas por usuario, con progreso automático)
     ============================================================ */
  const OBJ_TIPOS = {
    fuerza:         { label: 'Fuerza',         linkEjercicio: true, unidad: 'kg' },
    repeticiones:   { label: 'Repeticiones',   linkEjercicio: true, unidad: 'reps' },
    peso_corporal:  { label: 'Peso corporal',  unidad: 'kg' },
    entrenamientos: { label: 'Entrenamientos', unidad: '' },
    personalizado:  { label: 'Personalizado',  unidad: '' },
  };

  // Valor actual de un objetivo, traído automáticamente de los datos del usuario
  function valorActualObjetivo(u, obj) {
    if (!u || !obj) return 0;
    switch (obj.tipo) {
      case 'peso_corporal': return num(u.pesoCorporal);
      case 'fuerza': { const r = getRecords(u.id).find(x => x.ejercicioId === obj.ejercicioId); return r ? r.pesoMax : 0; }
      case 'repeticiones': { const r = getRecords(u.id).find(x => x.ejercicioId === obj.ejercicioId); return r ? r.repsMax : 0; }
      case 'entrenamientos': return obj.periodo === 'semanal' ? resumenSemana(u.id).entrenamientos : getSesiones(u.id).length;
      default: return num(obj.valorActualManual);
    }
  }

  // Progreso { actual, meta, porcentaje }
  function progresoObjetivo(u, obj) {
    const actual = valorActualObjetivo(u, obj);
    const meta = num(obj.valorObjetivo);
    let pct;
    if (obj.direccion === 'bajar') {
      const ini = num(obj.valorInicial);
      pct = (ini === meta) ? 100 : ((ini - actual) / (ini - meta)) * 100;
    } else {
      pct = meta ? (actual / meta) * 100 : 0;
    }
    pct = Math.max(0, Math.min(100, pct));
    return { actual, meta, porcentaje: pct };
  }

  function getObjetivos(usuarioId) { const u = getUsuario(usuarioId); return u ? (u.objetivos || []) : []; }

  function crearObjetivo(usuarioId, d) {
    const u = getUsuario(usuarioId); if (!u) return null;
    const tipo = OBJ_TIPOS[d.tipo] ? d.tipo : 'personalizado';
    const meta = num(d.valorObjetivo);
    const obj = {
      id: uid('OB'), nombre: (d.nombre || '').trim() || 'Objetivo',
      tipo, ejercicioId: d.ejercicioId || null, periodo: d.periodo || 'total',
      valorObjetivo: meta,
      valorInicial: d.valorInicial != null && d.valorInicial !== '' ? num(d.valorInicial) : 0,
      valorActualManual: tipo === 'personalizado' ? num(d.valorActual) : 0,
      direccion: 'subir', principal: !!d.principal,
      fechaCreacion: todayISO(), fechaObjetivo: d.fechaObjetivo || null,
      completado: false, fechaCompletado: null,
    };
    const actual = valorActualObjetivo(u, obj);
    if (!obj.valorInicial) obj.valorInicial = actual;
    if (tipo === 'peso_corporal' && meta && meta < obj.valorInicial) obj.direccion = 'bajar';
    if (obj.principal) (u.objetivos || []).forEach(o => o.principal = false);
    u.objetivos = u.objetivos || [];
    u.objetivos.unshift(obj);
    persistUsuario(u);
    return obj;
  }

  function actualizarObjetivo(usuarioId, objId, cambios) {
    const u = getUsuario(usuarioId); if (!u) return null;
    const o = (u.objetivos || []).find(x => x.id === objId); if (!o) return null;
    if (cambios.principal) (u.objetivos || []).forEach(x => x.principal = false);
    Object.assign(o, cambios);
    persistUsuario(u);
    return o;
  }
  function eliminarObjetivo(usuarioId, objId) {
    const u = getUsuario(usuarioId); if (!u) return;
    u.objetivos = (u.objetivos || []).filter(o => o.id !== objId);
    persistUsuario(u);
  }

  // Detecta objetivos recién cumplidos, los archiva con fecha y los devuelve (para festejar)
  function evaluarObjetivos(usuarioId) {
    const u = getUsuario(usuarioId); if (!u) return [];
    let changed = false; const nuevos = [];
    (u.objetivos || []).forEach(o => {
      if (o.completado) return;
      if (o.tipo === 'entrenamientos' && o.periodo === 'semanal') return; // meta recurrente: no se archiva
      const p = progresoObjetivo(u, o);
      if (p.porcentaje >= 100) { o.completado = true; o.fechaCompletado = todayISO(); changed = true; nuevos.push(o); }
    });
    if (changed) persistUsuario(u);
    return nuevos;
  }

  /* ============================================================
     EXPORT / IMPORT
     ============================================================ */
  function exportar() { return JSON.stringify(load(), null, 2); }
  function importar(json) {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') throw new Error('Archivo inválido');
    cache = Object.assign(defaultData(), data);
    save();
    if (Cloud.enabled) TABLES.forEach(t => (cache[t] || []).forEach(o => Cloud.push(t, o)));
  }

  /* ---------- Semilla: Mateo y Joaco ---------- */
  function seedIfEmpty() {
    const d = load();
    if (!d.usuarios.some(u => u.nombre === 'Mateo')) crearUsuario('Mateo');
    if (!d.usuarios.some(u => u.nombre === 'Joaco')) crearUsuario('Joaco');
    // asegurar forma (rutinas/perfil) en usuarios existentes
    d.usuarios.forEach(ensureUsuarioShape);
    d._seeded = true;
    save();
  }

  /* ---------- API pública ---------- */
  window.DB = {
    EJERCICIOS_BASE, SESIONES, DESTACADOS, TIPOS, RANGOS, GENEROS, NIVELES,
    getEjerciciosBase, getEjerciciosDisponibles, getEjercicio, crearEjercicioCustom, tipoDe, camposTipo, rangoDe, esCorporal,
    fraseDelDia,
    getUsuarios, getUsuario, crearUsuario, actualizarUsuario, actualizarPerfilFisico, pesoCorporalEn,
    getRutinas, getRutina, crearRutina, actualizarRutina, eliminarRutina, duplicarRutina, reordenarRutinas,
    agregarEjercicioARutina, quitarEjercicioDeRutina, editarEjercicioRutina, moverEjercicioRutina,
    getSesiones, getSesion, crearSesion, actualizarSesion, eliminarSesion,
    sesionDesdeRutina, nuevoEjercicioSesion, nuevaSerie,
    volumenSesion, seriesSesion, ejerciciosSesion, serieValida, cargaEfectiva,
    getRecords, recordsRecientes, detectarRecords, metricas, resumenSemana, serieTemporal,
    fuerzaRelativa, analisisRelativo, progresion, ultimaCarga,
    OBJ_TIPOS, getObjetivos, crearObjetivo, actualizarObjetivo, eliminarObjetivo,
    valorActualObjetivo, progresoObjetivo, evaluarObjetivos,
    e1rm, exportar, importar, nowISO, todayISO,
    init, get cloudEnabled() { return Cloud.enabled; }, onRemoteChange: null,
  };
})();
