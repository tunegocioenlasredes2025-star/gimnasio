/* ============================================================
   ATLETAS · Capa de datos
   - Modo NUBE (Supabase): datos compartidos en tiempo real.
   - Modo LOCAL (sin claves / sin internet): localStorage.
   localStorage funciona siempre como respaldo offline.

   Modelo de documento (JSONB): cada sesión es un documento con sus
   ejercicios y series anidados. Récords y métricas se calculan al
   vuelo a partir de las sesiones (no se guardan duplicados).
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'atletas_v1';
  const TABLES = ['usuarios', 'sesiones', 'ejercicios']; // ejercicios = personalizados

  /* ============================================================
     CATÁLOGO DE EJERCICIOS (base)
     ============================================================ */
  const EJERCICIOS_BASE = [
    // Sesión 1 — Tirón (Espalda / Bíceps)
    { id: 'dominadas',            nombre: 'Dominadas',              categoria: 'Espalda',   principal: true },
    { id: 'remo',                 nombre: 'Remo',                   categoria: 'Espalda',   principal: false },
    { id: 'curl-biceps-sentado',  nombre: 'Curl bíceps sentado',    categoria: 'Bíceps',    principal: false },
    { id: 'curl-z',               nombre: 'Curl barra Z',           categoria: 'Bíceps',    principal: true },
    { id: 'antebrazo',            nombre: 'Antebrazo',              categoria: 'Antebrazo', principal: false },
    { id: 'core',                 nombre: 'Core',                   categoria: 'Core',      principal: false },
    // Sesión 2 — Empuje (Pecho / Hombro / Tríceps)
    { id: 'press-banca',          nombre: 'Press banca',            categoria: 'Pecho',     principal: true },
    { id: 'press-inclinado',      nombre: 'Press inclinado',        categoria: 'Pecho',     principal: false },
    { id: 'press-militar',        nombre: 'Press militar',          categoria: 'Hombro',    principal: true },
    { id: 'elevaciones-laterales',nombre: 'Elevaciones laterales',  categoria: 'Hombro',    principal: false },
    { id: 'press-frances',        nombre: 'Press francés',          categoria: 'Tríceps',   principal: false },
    { id: 'polea-triceps',        nombre: 'Polea tríceps',          categoria: 'Tríceps',   principal: false },
    // Sesión 3 — Pierna A (cuádriceps)
    { id: 'sentadilla',           nombre: 'Sentadilla',             categoria: 'Pierna',    principal: true },
    { id: 'maquina-isquios',      nombre: 'Máquina isquios',        categoria: 'Pierna',    principal: false },
    { id: 'gemelos',              nombre: 'Gemelos',                categoria: 'Pierna',    principal: false },
    { id: 'step-up',              nombre: 'Step Up',                categoria: 'Pierna',    principal: false },
    { id: 'levantamiento-arrodillado', nombre: 'Levantamiento arrodillado', categoria: 'Pierna', principal: false },
    { id: 'estocadas',            nombre: 'Estocadas',              categoria: 'Pierna',    principal: false },
    // Sesión 4 — Pierna B (posterior)
    { id: 'peso-muerto',          nombre: 'Peso muerto',            categoria: 'Pierna',    principal: true },
    { id: 'extension-cuadriceps', nombre: 'Extensión de cuádriceps',categoria: 'Pierna',    principal: false },
    { id: 'hip-thrust',           nombre: 'Hip Thrust',             categoria: 'Glúteo',    principal: true },
  ];

  // Plantillas de sesión (orden de ejercicios)
  const SESIONES = {
    1: { nombre: 'Sesión 1 · Tirón',  sub: 'Espalda / Bíceps',          ejercicios: ['dominadas', 'remo', 'curl-biceps-sentado', 'curl-z', 'antebrazo', 'core'] },
    2: { nombre: 'Sesión 2 · Empuje', sub: 'Pecho / Hombro / Tríceps',  ejercicios: ['press-banca', 'press-inclinado', 'press-militar', 'elevaciones-laterales', 'press-frances', 'polea-triceps'] },
    3: { nombre: 'Sesión 3 · Pierna A', sub: 'Cuádriceps',              ejercicios: ['sentadilla', 'maquina-isquios', 'gemelos', 'step-up', 'levantamiento-arrodillado', 'estocadas'] },
    4: { nombre: 'Sesión 4 · Pierna B', sub: 'Posterior',               ejercicios: ['peso-muerto', 'extension-cuadriceps', 'gemelos', 'hip-thrust'] },
  };

  // Ejercicios destacados en analítica
  const DESTACADOS = ['press-banca', 'sentadilla', 'peso-muerto', 'dominadas', 'hip-thrust', 'press-militar', 'curl-z'];

  // Rangos de progresión
  const RANGO_PRINCIPAL = { min: 4, max: 8 };
  const RANGO_SECUNDARIO = { min: 8, max: 12 };

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
    seedIfEmpty(); // Mateo y Joaco siempre presentes
    return Cloud.enabled;
  }

  /* ============================================================
     EJERCICIOS (catálogo + personalizados)
     ============================================================ */
  function getEjercicios() {
    // base + personalizados activos
    const custom = (load().ejercicios || []).filter(e => e.activo !== false);
    return EJERCICIOS_BASE.concat(custom);
  }
  function getEjercicio(id) { return getEjercicios().find(e => e.id === id) || null; }
  function crearEjercicio(d) {
    const e = Object.assign({
      id: uid('EJ'), nombre: '', categoria: 'Otros', principal: false, activo: true, custom: true,
    }, d);
    if (!e.nombre.trim()) return null;
    load().ejercicios.unshift(e);
    save(); Cloud.push('ejercicios', e);
    return e;
  }

  /* ============================================================
     USUARIOS
     ============================================================ */
  function getUsuarios() { return load().usuarios; }
  function getUsuario(id) { return load().usuarios.find(u => u.id === id) || null; }
  function crearUsuario(nombre) {
    nombre = (nombre || '').trim();
    if (!nombre) return null;
    const u = { id: uid('US'), nombre, fechaCreacion: nowISO() };
    load().usuarios.push(u);
    save(); Cloud.push('usuarios', u);
    return u;
  }

  /* ============================================================
     SESIONES (documento con ejercicios + series)
     ============================================================ */
  function getSesiones(usuarioId) {
    let s = load().sesiones.slice();
    if (usuarioId) s = s.filter(x => x.usuarioId === usuarioId);
    return s.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.id).localeCompare(a.id));
  }
  function getSesion(id) { return load().sesiones.find(s => s.id === id) || null; }

  // estructura de un ejercicio dentro de la sesión
  function nuevaSerie() { return { peso: '', reps: '', rir: '', notas: '' }; }
  function nuevoEjercicioSesion(ejId) {
    const e = getEjercicio(ejId) || { id: ejId, nombre: ejId, categoria: 'Otros', principal: false };
    return {
      ejercicioId: e.id, nombre: e.nombre, categoria: e.categoria, principal: !!e.principal,
      series: [nuevaSerie(), nuevaSerie(), nuevaSerie()], notas: '',
    };
  }
  function plantillaSesion(tipo) {
    const t = SESIONES[tipo];
    const ejercicios = t ? t.ejercicios.map(nuevoEjercicioSesion) : [];
    return {
      usuarioId: null,
      fecha: todayISO(),
      tipoSesion: t ? t.nombre : 'Entrenamiento libre',
      tipoId: tipo || 'libre',
      duracion: '',
      observaciones: '',
      ejercicios,
    };
  }

  function crearSesion(d) {
    const s = Object.assign({
      id: uid('SE'), fechaCreacion: nowISO(),
      usuarioId: null, fecha: todayISO(), tipoSesion: 'Entrenamiento', tipoId: 'libre',
      duracion: '', observaciones: '', ejercicios: [],
    }, d);
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
     CÁLCULOS: volumen, records, métricas, progresión
     ============================================================ */
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  // Serie válida = tiene reps > 0
  function serieValida(se) { return num(se.reps) > 0; }
  // 1RM estimado (Epley) para una serie
  function e1rm(peso, reps) { peso = num(peso); reps = num(reps); if (!reps) return 0; return peso * (1 + reps / 30); }

  function volumenSerie(se) { return num(se.peso) * num(se.reps); }

  function volumenSesion(s) {
    let total = 0;
    (s.ejercicios || []).forEach(ej => (ej.series || []).forEach(se => { total += volumenSerie(se); }));
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

  // Récords por ejercicio para un usuario (mejor peso y mejor 1RM estimado)
  function getRecords(usuarioId) {
    const map = {}; // ejercicioId -> record
    getSesiones(usuarioId).forEach(s => {
      (s.ejercicios || []).forEach(ej => {
        (ej.series || []).forEach(se => {
          if (!serieValida(se)) return;
          const peso = num(se.peso), reps = num(se.reps), est = e1rm(peso, reps);
          const r = map[ej.ejercicioId] || { ejercicioId: ej.ejercicioId, nombre: ej.nombre, principal: ej.principal, pesoMax: 0, repsEnMax: 0, e1rm: 0, fecha: s.fecha };
          if (peso > r.pesoMax || (peso === r.pesoMax && reps > r.repsEnMax)) { r.pesoMax = peso; r.repsEnMax = reps; r.fecha = s.fecha; }
          if (est > r.e1rm) r.e1rm = est;
          r.nombre = ej.nombre; r.principal = ej.principal;
          map[ej.ejercicioId] = r;
        });
      });
    });
    return Object.values(map).sort((a, b) => b.e1rm - a.e1rm);
  }

  // Récords logrados en una fecha concreta (para “récords recientes”)
  function recordsRecientes(usuarioId, limite) {
    const recs = getRecords(usuarioId).filter(r => r.pesoMax > 0);
    return recs.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, limite || 5);
  }

  // Métricas agregadas
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

  // Serie temporal de un ejercicio (e1RM y peso máx por fecha) — para gráficos
  function serieTemporal(usuarioId, ejercicioId, desdeDias) {
    const limite = desdeDias ? Date.now() - desdeDias * 86400000 : 0;
    const puntos = [];
    getSesiones(usuarioId).slice().reverse().forEach(s => { // orden ascendente
      const f = new Date(s.fecha + 'T00:00:00').getTime();
      if (limite && f < limite) return;
      let mejorE = 0, mejorPeso = 0;
      (s.ejercicios || []).forEach(ej => {
        if (ej.ejercicioId !== ejercicioId) return;
        (ej.series || []).forEach(se => {
          if (!serieValida(se)) return;
          mejorE = Math.max(mejorE, e1rm(se.peso, se.reps));
          mejorPeso = Math.max(mejorPeso, num(se.peso));
        });
      });
      if (mejorE > 0) puntos.push({ fecha: s.fecha, e1rm: Math.round(mejorE), peso: mejorPeso });
    });
    return puntos;
  }

  // Sugerencia de progresión a partir de la última vez que se hizo el ejercicio
  function progresion(usuarioId, ejercicioId) {
    const e = getEjercicio(ejercicioId);
    const principal = e ? e.principal : false;
    const rango = principal ? RANGO_PRINCIPAL : RANGO_SECUNDARIO;
    // buscar la última sesión con ese ejercicio
    const sesiones = getSesiones(usuarioId);
    for (const s of sesiones) {
      const ej = (s.ejercicios || []).find(x => x.ejercicioId === ejercicioId);
      if (!ej) continue;
      const validas = (ej.series || []).filter(serieValida);
      if (validas.length < 3) return null; // hace falta ~3 series para decidir
      const todasEnTope = validas.every(se => num(se.reps) >= rango.max);
      if (todasEnTope) {
        return principal
          ? { tipo: 'subir', texto: 'Se recomienda aumentar carga en la próxima sesión', rango }
          : { tipo: 'subir', texto: 'Listo para progresar peso', rango };
      }
      return { tipo: 'mantener', texto: `Seguí en el rango ${rango.min}–${rango.max} reps`, rango };
    }
    return null;
  }

  // Última carga registrada de un ejercicio (para precargar el formulario)
  function ultimaCarga(usuarioId, ejercicioId) {
    const sesiones = getSesiones(usuarioId);
    for (const s of sesiones) {
      const ej = (s.ejercicios || []).find(x => x.ejercicioId === ejercicioId);
      if (ej && (ej.series || []).some(serieValida)) {
        return { fecha: s.fecha, series: ej.series.map(se => ({ peso: se.peso, reps: se.reps })) };
      }
    }
    return null;
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
    if (d._seeded) return;
    d._seeded = true;
    if (!d.usuarios.some(u => u.nombre === 'Mateo')) crearUsuario('Mateo');
    if (!d.usuarios.some(u => u.nombre === 'Joaco')) crearUsuario('Joaco');
    save();
  }

  /* ---------- API pública ---------- */
  window.DB = {
    EJERCICIOS_BASE, SESIONES, DESTACADOS, RANGO_PRINCIPAL, RANGO_SECUNDARIO,
    getEjercicios, getEjercicio, crearEjercicio,
    getUsuarios, getUsuario, crearUsuario,
    getSesiones, getSesion, crearSesion, actualizarSesion, eliminarSesion,
    plantillaSesion, nuevoEjercicioSesion, nuevaSerie,
    volumenSesion, seriesSesion, ejerciciosSesion,
    getRecords, recordsRecientes, metricas, serieTemporal, progresion, ultimaCarga,
    e1rm, exportar, importar, nowISO, todayISO,
    init, get cloudEnabled() { return Cloud.enabled; }, onRemoteChange: null,
  };
})();
