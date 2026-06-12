/* ============================================================
   ATLETAS · App (router + vistas)
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const fmt = (n) => Math.round(n).toLocaleString('es-AR');

  const ICONS = {
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  };

  const state = {
    usuarioId: null,
    tab: 'inicio',
    borrador: null,    // sesión en edición (objeto)
    editandoId: null,  // id si se está editando una sesión existente
    periodo: 30,       // días para analítica
  };

  /* ---------- Fechas ---------- */
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fechaLinda(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
  }
  function fechaCorta(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate()} ${MESES[d.getMonth()]}`;
  }

  /* ============================================================
     ARRANQUE
     ============================================================ */
  async function start() {
    await DB.init();
    DB.onRemoteChange = () => { if (state.usuarioId) render(); };
    // recordar último usuario
    const last = localStorage.getItem('atletas_last_user');
    if (last && DB.getUsuario(last)) { state.usuarioId = last; render(); }
    else renderSelectorUsuario();
    actualizarBadgeNube();
  }

  function actualizarBadgeNube() {
    const b = $('#cloud-badge');
    if (!b) return;
    if (DB.cloudEnabled) { b.textContent = 'Nube'; b.className = 'cloud-badge on'; }
    else { b.textContent = 'Local'; b.className = 'cloud-badge off'; }
  }

  /* ============================================================
     SELECTOR DE USUARIO
     ============================================================ */
  function renderSelectorUsuario() {
    state.usuarioId = null;
    const usuarios = DB.getUsuarios();
    $('#app').classList.add('hidden');
    const cont = $('#selector');
    cont.classList.remove('hidden');
    cont.innerHTML = `
      <div class="selector-inner">
        <div class="brand">
          <div class="brand-logo">A</div>
          <h1>ATLETAS</h1>
          <p>Seguimiento de entrenamiento de alto rendimiento</p>
        </div>
        <div class="user-grid">
          ${usuarios.map(u => `
            <button class="user-card" data-id="${u.id}">
              <span class="user-avatar">${esc(u.nombre.slice(0, 1).toUpperCase())}</span>
              <span class="user-name">${esc(u.nombre)}</span>
            </button>`).join('')}
          <button class="user-card add" id="add-user">
            <span class="user-avatar">＋</span>
            <span class="user-name">Nuevo atleta</span>
          </button>
        </div>
      </div>`;
    $$('.user-card[data-id]', cont).forEach(b => b.addEventListener('click', () => entrar(b.dataset.id)));
    $('#add-user', cont).addEventListener('click', () => {
      const nombre = prompt('Nombre del nuevo atleta:');
      if (nombre && nombre.trim()) { DB.crearUsuario(nombre.trim()); renderSelectorUsuario(); }
    });
  }

  function entrar(usuarioId) {
    state.usuarioId = usuarioId;
    state.tab = 'inicio';
    localStorage.setItem('atletas_last_user', usuarioId);
    render();
  }

  /* ============================================================
     SHELL + ROUTER
     ============================================================ */
  function render() {
    $('#selector').classList.add('hidden');
    $('#app').classList.remove('hidden');
    const u = DB.getUsuario(state.usuarioId);
    if (!u) { renderSelectorUsuario(); return; }

    $('#header-user').textContent = u.nombre;
    $('#header-avatar').textContent = u.nombre.slice(0, 1).toUpperCase();

    // tabs activos
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));

    const view = $('#view');
    if (state.tab === 'inicio') view.innerHTML = vistaInicio(u);
    else if (state.tab === 'entrenar') view.innerHTML = vistaEntrenar();
    else if (state.tab === 'analisis') view.innerHTML = vistaAnalisis();
    else if (state.tab === 'historial') view.innerHTML = vistaHistorial();
    view.scrollTop = 0;
    window.scrollTo(0, 0);
    bindVista();
  }

  function irA(tab) { state.tab = tab; if (tab !== 'entrenar') { state.borrador = null; state.editandoId = null; } render(); }

  /* ============================================================
     VISTA · INICIO (Dashboard)
     ============================================================ */
  function vistaInicio(u) {
    const m = DB.metricas(u.id);
    const recs = DB.recordsRecientes(u.id, 5);
    const ultima = DB.getSesiones(u.id)[0];

    return `
    <section class="view-section">
      <div class="section-head">
        <h2>Hola, ${esc(u.nombre)}</h2>
        <p class="muted">${m.totalSesiones} entrenamientos registrados</p>
      </div>

      <div class="stat-grid">
        <div class="stat"><span class="stat-num">${m.semana}</span><span class="stat-lbl">Esta semana</span></div>
        <div class="stat"><span class="stat-num">${m.mes}</span><span class="stat-lbl">Este mes</span></div>
        <div class="stat accent"><span class="stat-num">${fmt(m.volTotal)}</span><span class="stat-lbl">Kg movidos (total)</span></div>
        <div class="stat"><span class="stat-num">${m.series}</span><span class="stat-lbl">Series totales</span></div>
      </div>

      <button class="btn-primary btn-block big" id="cta-entrenar">＋ Registrar entrenamiento</button>

      ${ultima ? `
      <div class="card">
        <div class="card-head"><h3>Último entrenamiento</h3><span class="muted">${fechaCorta(ultima.fecha)}</span></div>
        <div class="last-session">
          <strong>${esc(ultima.tipoSesion)}</strong>
          <span class="muted">${DB.ejerciciosSesion(ultima)} ejercicios · ${DB.seriesSesion(ultima)} series · ${fmt(DB.volumenSesion(ultima))} kg</span>
        </div>
      </div>` : ''}

      <div class="card">
        <div class="card-head"><h3><span class="h-ico trophy">${ICONS.trophy}</span>Récords</h3><span class="muted">por 1RM estimado</span></div>
        ${recs.length ? `<div class="record-list">${recs.map(r => `
          <div class="record-row">
            <div class="record-name">${esc(r.nombre)}${r.principal ? '<span class="dot-principal" title="Ejercicio principal"></span>' : ''}</div>
            <div class="record-vals">
              <b>${fmt(r.pesoMax)} kg</b> × ${r.repsEnMax}
              <span class="muted">· 1RM ~${fmt(r.e1rm)}</span>
            </div>
          </div>`).join('')}</div>` : `<p class="empty">Todavía no hay récords. ¡Registrá tu primer entrenamiento!</p>`}
      </div>
    </section>`;
  }

  /* ============================================================
     VISTA · ENTRENAR
     ============================================================ */
  function vistaEntrenar() {
    if (!state.borrador) return vistaElegirSesion();
    return vistaFormularioSesion();
  }

  function vistaElegirSesion() {
    const cards = Object.keys(DB.SESIONES).map(k => {
      const s = DB.SESIONES[k];
      return `<button class="session-pick" data-tipo="${k}">
        <div class="sp-badge">${k}</div>
        <div class="sp-body">
          <strong>${esc(s.nombre)}</strong>
          <span class="muted">${esc(s.sub)} · ${s.ejercicios.length} ejercicios</span>
        </div>
        <span class="sp-arrow">›</span>
      </button>`;
    }).join('');

    return `
    <section class="view-section">
      <div class="section-head"><h2>Nuevo entrenamiento</h2><p class="muted">Elegí la sesión</p></div>
      <div class="session-list">${cards}</div>
      <button class="session-pick ghost" data-tipo="libre">
        <div class="sp-badge alt">＋</div>
        <div class="sp-body"><strong>Entrenamiento libre</strong><span class="muted">Armá tu propia sesión</span></div>
        <span class="sp-arrow">›</span>
      </button>
    </section>`;
  }

  function vistaFormularioSesion() {
    const b = state.borrador;
    const ejHtml = b.ejercicios.map((ej, i) => ejercicioCard(ej, i)).join('');
    return `
    <section class="view-section form-session">
      <div class="form-top">
        <button class="link-back" id="cancelar-sesion">‹ Cancelar</button>
        <button class="btn-primary btn-save" id="guardar-sesion">${state.editandoId ? 'Guardar cambios' : 'Guardar'}</button>
      </div>

      <div class="card meta-card">
        <input class="input-title" id="meta-tipo" value="${esc(b.tipoSesion)}" placeholder="Nombre de la sesión"/>
        <div class="meta-row">
          <label class="field"><span>Fecha</span><input type="date" id="meta-fecha" value="${esc(b.fecha)}"/></label>
          <label class="field"><span>Duración (min)</span><input type="number" inputmode="numeric" id="meta-duracion" value="${esc(b.duracion)}" placeholder="—"/></label>
        </div>
      </div>

      <div id="ejercicios-cont">${ejHtml}</div>

      <button class="btn-ghost btn-block" id="agregar-ejercicio">＋ Agregar ejercicio</button>
      <label class="field block">
        <span>Observaciones de la sesión</span>
        <textarea id="meta-obs" rows="2" placeholder="Cómo te sentiste, energía, dolores…">${esc(b.observaciones)}</textarea>
      </label>
      <button class="btn-primary btn-block big" id="guardar-sesion-2">${state.editandoId ? 'Guardar cambios' : 'Guardar entrenamiento'}</button>
      ${state.editandoId ? `<button class="btn-danger btn-block" id="eliminar-sesion">Eliminar entrenamiento</button>` : ''}
    </section>`;
  }

  function ejercicioCard(ej, idx) {
    const prog = DB.progresion(state.usuarioId, ej.ejercicioId);
    const rango = ej.principal ? DB.RANGO_PRINCIPAL : DB.RANGO_SECUNDARIO;
    const ultima = DB.ultimaCarga(state.usuarioId, ej.ejercicioId);
    const series = ej.series.map((se, si) => `
      <div class="serie-row" data-ej="${idx}" data-se="${si}">
        <span class="serie-n">${si + 1}</span>
        <input class="serie-in peso" inputmode="decimal" placeholder="kg" value="${esc(se.peso)}" data-ej="${idx}" data-se="${si}" data-k="peso"/>
        <input class="serie-in reps" inputmode="numeric" placeholder="reps" value="${esc(se.reps)}" data-ej="${idx}" data-se="${si}" data-k="reps"/>
        <input class="serie-in rir" inputmode="numeric" placeholder="RIR" value="${esc(se.rir)}" data-ej="${idx}" data-se="${si}" data-k="rir"/>
        <button class="serie-del" data-ej="${idx}" data-se="${si}" title="Quitar serie">×</button>
      </div>`).join('');

    return `
    <div class="card ej-card" data-ej="${idx}">
      <div class="ej-head">
        <div class="ej-title">
          <strong>${esc(ej.nombre)}</strong>
          ${ej.principal ? '<span class="tag principal">Principal</span>' : ''}
          <span class="tag rango">${rango.min}–${rango.max} reps</span>
        </div>
        <button class="ej-del" data-ej="${idx}" title="Quitar ejercicio" aria-label="Quitar ejercicio">${ICONS.trash}</button>
      </div>
      ${ultima ? `<div class="ej-last">Última vez: ${ultima.series.filter(s => num(s.reps) > 0).map(s => `${esc(s.peso || 0)}×${esc(s.reps)}`).join(' · ') || '—'}</div>` : ''}
      ${prog ? `<div class="ej-hint ${prog.tipo === 'subir' ? 'up' : ''}"><span class="hint-ico">${prog.tipo === 'subir' ? ICONS.up : ICONS.info}</span>${esc(prog.texto)}</div>` : ''}
      <div class="serie-head"><span class="serie-n">#</span><span>Peso</span><span>Reps</span><span>RIR</span><span></span></div>
      <div class="series-cont">${series}</div>
      <button class="btn-ghost btn-sm add-serie" data-ej="${idx}">＋ Serie</button>
    </div>`;
  }

  /* ---------- helpers de borrador ---------- */
  function nuevoBorrador(tipo) {
    if (tipo === 'libre') {
      state.borrador = {
        usuarioId: state.usuarioId, fecha: DB.todayISO(), tipoSesion: 'Entrenamiento libre',
        tipoId: 'libre', duracion: '', observaciones: '', ejercicios: [],
      };
    } else {
      const p = DB.plantillaSesion(parseInt(tipo, 10));
      p.usuarioId = state.usuarioId;
      // precargar última carga conocida en cada ejercicio
      p.ejercicios.forEach(ej => {
        const u = DB.ultimaCarga(state.usuarioId, ej.ejercicioId);
        if (u) ej.series.forEach((se, i) => { if (u.series[i]) se.peso = u.series[i].peso; });
      });
      state.borrador = p;
    }
    state.editandoId = null;
    render();
  }

  /* ============================================================
     VISTA · ANALÍTICA
     ============================================================ */
  function vistaAnalisis() {
    const recsMap = {};
    DB.getRecords(state.usuarioId).forEach(r => { recsMap[r.ejercicioId] = r; });
    const destacados = DB.DESTACADOS.filter(id => recsMap[id]); // solo los que tienen datos

    const charts = destacados.map(id => {
      const ej = DB.getEjercicio(id) || { nombre: id };
      const serie = DB.serieTemporal(state.usuarioId, id, state.periodo || null)
        .map(p => ({ fecha: p.fecha, valor: p.e1rm }));
      return `
      <div class="card chart-card">
        <div class="card-head"><h3>${esc(ej.nombre)}</h3><span class="muted">1RM estimado</span></div>
        ${Charts.linea(serie, { color: '#22c55e', unidad: 'kg' })}
      </div>`;
    }).join('');

    return `
    <section class="view-section">
      <div class="section-head"><h2>Analítica</h2><p class="muted">Evolución de tus levantamientos</p></div>
      <div class="period-toggle">
        ${[[30, '30 días'], [90, '90 días'], [0, 'Todo']].map(([d, l]) =>
          `<button class="period-btn ${state.periodo === d ? 'active' : ''}" data-periodo="${d}">${l}</button>`).join('')}
      </div>
      ${charts || `<p class="empty">Registrá entrenamientos de press banca, sentadilla, peso muerto, dominadas o hip thrust para ver tu evolución.</p>`}
    </section>`;
  }

  /* ============================================================
     VISTA · HISTORIAL
     ============================================================ */
  function vistaHistorial() {
    const sesiones = DB.getSesiones(state.usuarioId);
    if (!sesiones.length) {
      return `<section class="view-section"><div class="section-head"><h2>Historial</h2></div>
        <p class="empty">Todavía no registraste entrenamientos.</p></section>`;
    }
    // agrupar por mes
    const grupos = {};
    sesiones.forEach(s => {
      const d = new Date(s.fecha + 'T00:00:00');
      const k = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
      (grupos[k] = grupos[k] || []).push(s);
    });

    const html = Object.keys(grupos).map(mes => `
      <div class="hist-month">${mes}</div>
      ${grupos[mes].map(s => `
        <button class="hist-card" data-id="${s.id}">
          <div class="hist-date"><span class="hd-day">${new Date(s.fecha + 'T00:00:00').getDate()}</span><span class="hd-dow">${DIAS[new Date(s.fecha + 'T00:00:00').getDay()].slice(0, 3)}</span></div>
          <div class="hist-body">
            <strong>${esc(s.tipoSesion)}</strong>
            <span class="muted">${DB.ejerciciosSesion(s)} ejercicios · ${DB.seriesSesion(s)} series · ${fmt(DB.volumenSesion(s))} kg</span>
          </div>
          <span class="sp-arrow">›</span>
        </button>`).join('')}
    `).join('');

    return `<section class="view-section">
      <div class="section-head"><h2>Historial</h2><p class="muted">${sesiones.length} entrenamientos</p></div>
      ${html}</section>`;
  }

  function detalleSesion(id) {
    const s = DB.getSesion(id);
    if (!s) return;
    const ejs = (s.ejercicios || []).map(ej => {
      const series = (ej.series || []).filter(se => num(se.reps) > 0);
      if (!series.length) return '';
      return `<div class="det-ej">
        <strong>${esc(ej.nombre)}</strong>
        <div class="det-series">${series.map((se, i) =>
          `<span class="det-serie">${i + 1}: <b>${esc(se.peso || 0)}kg</b> × ${esc(se.reps)}${se.rir !== '' && se.rir != null ? ` <i>RIR ${esc(se.rir)}</i>` : ''}</span>`).join('')}</div>
        ${ej.notas ? `<div class="det-notas">${esc(ej.notas)}</div>` : ''}
      </div>`;
    }).join('');

    abrirModal(`
      <div class="modal-head">
        <div><h3>${esc(s.tipoSesion)}</h3><span class="muted">${fechaLinda(s.fecha)}${s.duracion ? ' · ' + esc(s.duracion) + ' min' : ''}</span></div>
        <button class="modal-x" data-close>×</button>
      </div>
      <div class="modal-stats">
        <span><b>${DB.ejerciciosSesion(s)}</b> ejercicios</span>
        <span><b>${DB.seriesSesion(s)}</b> series</span>
        <span><b>${fmt(DB.volumenSesion(s))}</b> kg</span>
      </div>
      ${ejs || '<p class="empty">Sin series cargadas.</p>'}
      ${s.observaciones ? `<div class="det-obs"><span class="muted">Observaciones</span><p>${esc(s.observaciones)}</p></div>` : ''}
      <button class="btn-primary btn-block" id="editar-sesion" data-id="${s.id}">Editar entrenamiento</button>
    `);
    $('#editar-sesion').addEventListener('click', () => { cerrarModal(); editarSesion(s.id); });
  }

  function editarSesion(id) {
    const s = DB.getSesion(id);
    if (!s) return;
    state.borrador = JSON.parse(JSON.stringify(s));
    state.editandoId = id;
    state.tab = 'entrenar';
    render();
  }

  /* ============================================================
     GUARDAR
     ============================================================ */
  function leerFormulario() {
    const b = state.borrador;
    b.tipoSesion = $('#meta-tipo').value.trim() || 'Entrenamiento';
    b.fecha = $('#meta-fecha').value || DB.todayISO();
    b.duracion = $('#meta-duracion').value;
    b.observaciones = $('#meta-obs').value.trim();
    // los inputs de series ya se actualizan en vivo en el borrador
  }

  function guardar() {
    leerFormulario();
    const b = state.borrador;
    const hayDatos = b.ejercicios.some(ej => (ej.series || []).some(se => num(se.reps) > 0));
    if (!hayDatos) { toast('Cargá al menos una serie con repeticiones'); return; }

    if (state.editandoId) {
      DB.actualizarSesion(state.editandoId, b);
      toast('Entrenamiento actualizado');
    } else {
      DB.crearSesion(b);
      toast('Entrenamiento guardado');
    }
    state.borrador = null; state.editandoId = null;
    state.tab = 'inicio';
    render();
  }

  /* ============================================================
     EVENTOS POR VISTA
     ============================================================ */
  function bindVista() {
    // INICIO
    const cta = $('#cta-entrenar');
    if (cta) cta.addEventListener('click', () => irA('entrenar'));

    // ENTRENAR · elegir sesión
    $$('.session-pick').forEach(b => b.addEventListener('click', () => nuevoBorrador(b.dataset.tipo)));

    // ENTRENAR · formulario
    if (state.borrador) bindFormulario();

    // ANALÍTICA
    $$('.period-btn').forEach(b => b.addEventListener('click', () => { state.periodo = parseInt(b.dataset.periodo, 10); render(); }));

    // HISTORIAL
    $$('.hist-card').forEach(b => b.addEventListener('click', () => detalleSesion(b.dataset.id)));
  }

  function bindFormulario() {
    $('#cancelar-sesion').addEventListener('click', () => {
      state.borrador = null; state.editandoId = null;
      state.tab = state.tab; render();
    });
    ['#guardar-sesion', '#guardar-sesion-2'].forEach(sel => { const el = $(sel); if (el) el.addEventListener('click', guardar); });
    const del = $('#eliminar-sesion');
    if (del) del.addEventListener('click', () => {
      if (confirm('¿Eliminar este entrenamiento? No se puede deshacer.')) {
        DB.eliminarSesion(state.editandoId);
        state.borrador = null; state.editandoId = null; state.tab = 'historial'; render();
      }
    });

    // inputs de series (delegación)
    const cont = $('#ejercicios-cont');
    cont.addEventListener('input', (e) => {
      const t = e.target;
      if (t.classList.contains('serie-in')) {
        const ej = +t.dataset.ej, se = +t.dataset.se, k = t.dataset.k;
        state.borrador.ejercicios[ej].series[se][k] = t.value;
      }
    });
    cont.addEventListener('click', (e) => {
      const t = e.target;
      if (t.classList.contains('add-serie')) {
        const ej = +t.dataset.ej;
        state.borrador.ejercicios[ej].series.push(DB.nuevaSerie());
        rerenderEjercicios();
      } else if (t.classList.contains('serie-del')) {
        const ej = +t.dataset.ej, se = +t.dataset.se;
        state.borrador.ejercicios[ej].series.splice(se, 1);
        if (!state.borrador.ejercicios[ej].series.length) state.borrador.ejercicios[ej].series.push(DB.nuevaSerie());
        rerenderEjercicios();
      } else if (t.classList.contains('ej-del')) {
        const ej = +t.dataset.ej;
        state.borrador.ejercicios.splice(ej, 1);
        rerenderEjercicios();
      }
    });

    $('#agregar-ejercicio').addEventListener('click', abrirSelectorEjercicio);
  }

  function rerenderEjercicios() {
    // preservar metadatos del form antes de re-render
    leerFormulario();
    const cont = $('#ejercicios-cont');
    cont.innerHTML = state.borrador.ejercicios.map((ej, i) => ejercicioCard(ej, i)).join('');
    // restaurar valores meta en el DOM (leerFormulario no toca el DOM, pero re-render del form completo sí)
    $('#meta-tipo').value = state.borrador.tipoSesion;
    $('#meta-fecha').value = state.borrador.fecha;
    $('#meta-duracion').value = state.borrador.duracion;
    $('#meta-obs').value = state.borrador.observaciones;
  }

  function abrirSelectorEjercicio() {
    const ejs = DB.getEjercicios();
    const cats = {};
    ejs.forEach(e => { (cats[e.categoria] = cats[e.categoria] || []).push(e); });
    const lista = Object.keys(cats).sort().map(cat => `
      <div class="pick-cat">${esc(cat)}</div>
      ${cats[cat].map(e => `<button class="pick-ej" data-id="${e.id}">${esc(e.nombre)}${e.principal ? ' <span class="dot-principal"></span>' : ''}</button>`).join('')}
    `).join('');
    abrirModal(`
      <div class="modal-head"><h3>Agregar ejercicio</h3><button class="modal-x" data-close>×</button></div>
      <input id="buscar-ej" class="input-search" placeholder="Buscar…" autocomplete="off"/>
      <div class="pick-list" id="pick-list">${lista}</div>
      <button class="btn-ghost btn-block" id="nuevo-ej">＋ Crear ejercicio nuevo</button>
    `);
    const buscar = $('#buscar-ej');
    buscar.addEventListener('input', () => {
      const q = buscar.value.toLowerCase();
      $$('.pick-ej').forEach(b => { b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none'; });
      $$('.pick-cat').forEach(c => { c.style.display = q ? 'none' : ''; });
    });
    $$('.pick-ej').forEach(b => b.addEventListener('click', () => {
      state.borrador.ejercicios.push(DB.nuevoEjercicioSesion(b.dataset.id));
      cerrarModal(); rerenderEjercicios();
    }));
    $('#nuevo-ej').addEventListener('click', () => {
      const nombre = prompt('Nombre del ejercicio:');
      if (!nombre || !nombre.trim()) return;
      const principal = confirm('¿Es un ejercicio PRINCIPAL? (rango 4–8 reps)\nAceptar = Sí · Cancelar = No (secundario 8–12)');
      const e = DB.crearEjercicio({ nombre: nombre.trim(), categoria: 'Otros', principal });
      if (e) { state.borrador.ejercicios.push(DB.nuevoEjercicioSesion(e.id)); cerrarModal(); rerenderEjercicios(); }
    });
  }

  /* ============================================================
     MODAL + TOAST
     ============================================================ */
  function abrirModal(html) {
    const m = $('#modal');
    $('#modal-content').innerHTML = html;
    m.classList.remove('hidden');
    m.addEventListener('click', onModalClick);
  }
  function onModalClick(e) {
    if (e.target.id === 'modal' || e.target.hasAttribute('data-close') || e.target.classList.contains('modal-x')) cerrarModal();
  }
  function cerrarModal() {
    const m = $('#modal');
    m.classList.add('hidden');
    m.removeEventListener('click', onModalClick);
    $('#modal-content').innerHTML = '';
  }

  let toastT;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ============================================================
     NAV GLOBAL
     ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => irA(b.dataset.tab)));
    $('#switch-user').addEventListener('click', renderSelectorUsuario);
    start();
  });

  window.App = { irA, render };
})();
