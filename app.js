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
  const dec = (n) => (Math.round(n * 10) / 10).toLocaleString('es-AR');
  const maxOf = (arr, f) => arr.reduce((m, x) => Math.max(m, f(x)), 0);
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  const ICONS = {
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    quote: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.2 6C5 7.3 3.7 9.6 3.7 12.4c0 .6.1 1.1.3 1.6.5 1.3 1.7 2.2 3 2.2 1.7 0 3-1.3 3-3s-1.3-3-3-3c-.2 0-.5 0-.7.1.3-1 1-1.9 2-2.5L7.2 6Zm9 0c-2.2 1.3-3.5 3.6-3.5 6.4 0 .6.1 1.1.3 1.6.5 1.3 1.7 2.2 3 2.2 1.7 0 3-1.3 3-3s-1.3-3-3-3c-.2 0-.5 0-.7.1.3-1 1-1.9 2-2.5L16.2 6Z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    arrowU: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 12l6-6 6 6"/></svg>',
    arrowD: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v13M6 12l6 6 6-6"/></svg>',
    dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>',
  };

  const CAMPO = {
    peso:      { lbl: 'Peso',   ph: 'kg',   im: 'decimal' },
    reps:      { lbl: 'Reps',   ph: 'reps', im: 'numeric' },
    rir:       { lbl: 'RIR',    ph: 'RIR',  im: 'numeric' },
    altura:    { lbl: 'Altura', ph: 'cm',   im: 'numeric' },
    distancia: { lbl: 'Dist.',  ph: 'm',    im: 'numeric' },
    tiempo:    { lbl: 'Tiempo', ph: 'seg',  im: 'decimal' },
  };

  const state = {
    usuarioId: null,
    tab: 'inicio',
    borrador: null,
    editandoId: null,
    rutinaEditId: null, // rutina abierta en el editor
    periodo: 30,
  };

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fechaLinda(iso) { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; }
  function fechaCorta(iso) { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return `${d.getDate()} ${MESES[d.getMonth()]}`; }

  /* ============================================================ ARRANQUE ============================================================ */
  async function start() {
    await DB.init();
    DB.onRemoteChange = () => { if (state.usuarioId) render(); };
    const last = localStorage.getItem('atletas_last_user');
    if (last && DB.getUsuario(last)) { state.usuarioId = last; render(); }
    else renderSelectorUsuario();
    actualizarBadgeNube();
  }
  function actualizarBadgeNube() {
    const b = $('#cloud-badge'); if (!b) return;
    if (DB.cloudEnabled) { b.textContent = 'Nube'; b.className = 'cloud-badge on'; }
    else { b.textContent = 'Local'; b.className = 'cloud-badge off'; }
  }

  /* ============================================================ SELECTOR DE USUARIO ============================================================ */
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
    $('#add-user', cont).addEventListener('click', formNuevoUsuario);
  }

  function generoOptions(sel) {
    return DB.GENEROS.map(g => `<option value="${g}" ${sel === g ? 'selected' : ''}>${cap(g)}</option>`).join('');
  }

  function formNuevoUsuario() {
    abrirModal(`
      <div class="modal-head"><h3>Nuevo atleta</h3><button class="modal-x" data-close>×</button></div>
      <div class="form-grid">
        <label class="field block"><span>Nombre</span><input id="nu-nombre" autocomplete="off" placeholder="Ej: Mateo"/></label>
        <div class="meta-row">
          <label class="field"><span>Peso corporal (kg)</span><input id="nu-peso" type="number" inputmode="decimal" placeholder="78"/></label>
          <label class="field"><span>Altura (cm)</span><input id="nu-altura" type="number" inputmode="numeric" placeholder="178"/></label>
        </div>
        <div class="meta-row">
          <label class="field"><span>Edad</span><input id="nu-edad" type="number" inputmode="numeric" placeholder="18"/></label>
          <label class="field"><span>Género</span><select id="nu-genero"><option value="">—</option>${generoOptions('')}</select></label>
        </div>
      </div>
      <button class="btn-primary btn-block" id="nu-crear">Crear atleta</button>
    `);
    $('#nu-crear').addEventListener('click', () => {
      const nombre = $('#nu-nombre').value.trim();
      if (!nombre) { toast('Poné un nombre'); return; }
      const u = DB.crearUsuario({
        nombre,
        pesoCorporal: $('#nu-peso').value, alturaCm: $('#nu-altura').value,
        edad: $('#nu-edad').value, genero: $('#nu-genero').value,
      });
      cerrarModal();
      if (u) entrar(u.id);
    });
    setTimeout(() => { const n = $('#nu-nombre'); if (n) n.focus(); }, 50);
  }

  function entrar(usuarioId) {
    state.usuarioId = usuarioId; state.tab = 'inicio'; state.rutinaEditId = null;
    localStorage.setItem('atletas_last_user', usuarioId);
    render();
  }

  /* ============================================================ PERFIL FÍSICO ============================================================ */
  function formPerfilFisico() {
    const u = DB.getUsuario(state.usuarioId); if (!u) return;
    const hist = (u.pesoHistorial || []).slice().reverse();
    abrirModal(`
      <div class="modal-head"><h3>Perfil físico</h3><button class="modal-x" data-close>×</button></div>
      <p class="muted" style="margin-bottom:14px">${esc(u.nombre)} · los datos mejoran tus análisis de fuerza relativa</p>
      <div class="form-grid">
        <div class="meta-row">
          <label class="field"><span>Peso corporal (kg)</span><input id="pf-peso" type="number" inputmode="decimal" value="${u.pesoCorporal != null ? u.pesoCorporal : ''}" placeholder="78"/></label>
          <label class="field"><span>Altura (cm)</span><input id="pf-altura" type="number" inputmode="numeric" value="${u.alturaCm != null ? u.alturaCm : ''}" placeholder="178"/></label>
        </div>
        <div class="meta-row">
          <label class="field"><span>Edad</span><input id="pf-edad" type="number" inputmode="numeric" value="${u.edad != null ? u.edad : ''}" placeholder="18"/></label>
          <label class="field"><span>Género</span><select id="pf-genero"><option value="">—</option>${generoOptions(u.genero)}</select></label>
        </div>
      </div>
      <button class="btn-primary btn-block" id="pf-guardar">Guardar</button>
      ${hist.length ? `<div class="hist-peso">
        <div class="card-head" style="margin:6px 0 8px"><h3>Historial de peso</h3></div>
        ${hist.map(p => `<div class="hp-row"><span class="muted">${fechaCorta(p.fecha)}</span><b>${dec(p.peso)} kg</b></div>`).join('')}
      </div>` : ''}
    `);
    $('#pf-guardar').addEventListener('click', () => {
      DB.actualizarPerfilFisico(state.usuarioId, {
        pesoCorporal: $('#pf-peso').value, alturaCm: $('#pf-altura').value,
        edad: $('#pf-edad').value, genero: $('#pf-genero').value,
      });
      cerrarModal(); toast('Perfil actualizado'); render();
    });
  }

  /* ============================================================ SHELL + ROUTER ============================================================ */
  function render() {
    $('#selector').classList.add('hidden');
    $('#app').classList.remove('hidden');
    const u = DB.getUsuario(state.usuarioId);
    if (!u) { renderSelectorUsuario(); return; }
    $('#header-user').textContent = u.nombre;
    $('#header-avatar').textContent = u.nombre.slice(0, 1).toUpperCase();
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));

    const view = $('#view');
    if (state.tab === 'inicio') view.innerHTML = vistaInicio(u);
    else if (state.tab === 'entrenar') view.innerHTML = vistaEntrenar();
    else if (state.tab === 'rutinas') view.innerHTML = state.rutinaEditId ? vistaRutinaEditor() : vistaRutinas();
    else if (state.tab === 'analisis') view.innerHTML = vistaAnalisis();
    else if (state.tab === 'historial') view.innerHTML = vistaHistorial();
    view.scrollTop = 0; window.scrollTo(0, 0);
    bindVista();
  }
  function irA(tab) {
    state.tab = tab;
    if (tab !== 'entrenar') { state.borrador = null; state.editandoId = null; }
    if (tab !== 'rutinas') state.rutinaEditId = null;
    render();
  }

  /* ============================================================ VISTA · INICIO ============================================================ */
  function recordValor(r) {
    if (r.pesoMax > 0) return `<b>${fmt(r.pesoMax)} kg</b> × ${r.repsEnMax} <span class="muted">· 1RM ~${fmt(r.e1rm)}</span>`;
    if (r.repsMax > 0) return `<b>${r.repsMax} reps</b>`;
    return '<span class="muted">—</span>';
  }
  function vistaInicio(u) {
    const m = DB.metricas(u.id);
    const sem = DB.resumenSemana(u.id);
    const recs = DB.recordsRecientes(u.id, 5);
    const ultima = DB.getSesiones(u.id)[0];
    const frase = DB.fraseDelDia();
    const faltaPerfil = !u.pesoCorporal;

    return `
    <section class="view-section">
      <div class="frase-card"><span class="frase-ico">${ICONS.quote}</span><p class="frase-txt">${esc(frase)}</p></div>
      <div class="section-head"><h2>Hola, ${esc(u.nombre)}</h2><p class="muted">${m.totalSesiones} entrenamientos registrados</p></div>

      ${faltaPerfil ? `<button class="aviso-perfil" id="aviso-perfil">Completá tu peso corporal y altura para análisis de fuerza relativa →</button>` : ''}

      <div class="card semana-card">
        <div class="card-head"><h3>Esta semana</h3><span class="muted">lunes → hoy</span></div>
        <div class="semana-grid">
          <div class="wk"><span class="wk-num">${sem.entrenamientos}</span><span class="wk-lbl">Entrenamientos</span></div>
          <div class="wk"><span class="wk-num">${sem.ejercicios}</span><span class="wk-lbl">Ejercicios</span></div>
          <div class="wk"><span class="wk-num">${fmt(sem.volumen)}</span><span class="wk-lbl">Kg movidos</span></div>
          <div class="wk ${sem.prs ? 'pr' : ''}"><span class="wk-num">${sem.prs}</span><span class="wk-lbl">Récords</span></div>
        </div>
      </div>

      <button class="btn-primary btn-block big" id="cta-entrenar">＋ Registrar entrenamiento</button>

      ${ultima ? `
      <div class="card">
        <div class="card-head"><h3>Último entrenamiento</h3><span class="muted">${fechaCorta(ultima.fecha)}</span></div>
        <div class="last-session"><strong>${esc(ultima.tipoSesion)}</strong>
          <span class="muted">${DB.ejerciciosSesion(ultima)} ejercicios · ${DB.seriesSesion(ultima)} series${DB.volumenSesion(ultima) ? ' · ' + fmt(DB.volumenSesion(ultima)) + ' kg' : ''}</span></div>
      </div>` : ''}

      <div class="card">
        <div class="card-head"><h3><span class="h-ico trophy">${ICONS.trophy}</span>Récords</h3><span class="muted">marcas personales</span></div>
        ${recs.length ? `<div class="record-list">${recs.map(r => `
          <div class="record-row">
            <div class="record-name">${esc(r.nombre)}${r.principal ? '<span class="dot-principal"></span>' : ''}</div>
            <div class="record-vals">${recordValor(r)}</div>
          </div>`).join('')}</div>` : `<p class="empty">Todavía no hay récords. ¡Registrá tu primer entrenamiento!</p>`}
      </div>
    </section>`;
  }

  /* ============================================================ VISTA · ENTRENAR ============================================================ */
  function vistaEntrenar() {
    if (!state.borrador) return vistaElegirSesion();
    return vistaFormularioSesion();
  }
  function vistaElegirSesion() {
    const rutinas = DB.getRutinas(state.usuarioId);
    const cards = rutinas.map((r, i) => `
      <button class="session-pick" data-rutina="${r.id}">
        <div class="sp-badge">${i + 1}</div>
        <div class="sp-body"><strong>${esc(r.nombre)}</strong><span class="muted">${esc(r.sub || '')}${r.sub ? ' · ' : ''}${(r.ejercicios || []).length} ejercicios</span></div>
        <span class="sp-arrow">›</span>
      </button>`).join('');
    return `
    <section class="view-section">
      <div class="section-head"><h2>Nuevo entrenamiento</h2><p class="muted">Elegí una de tus rutinas</p></div>
      ${rutinas.length ? `<div class="session-list">${cards}</div>` : `<p class="empty">No tenés rutinas. Creá una en la pestaña Rutinas.</p>`}
      <button class="session-pick ghost" data-rutina="libre">
        <div class="sp-badge alt">＋</div>
        <div class="sp-body"><strong>Entrenamiento libre</strong><span class="muted">Armá una sesión suelta</span></div>
        <span class="sp-arrow">›</span>
      </button>
      <button class="btn-ghost btn-block" id="ir-rutinas" style="margin-top:6px">Gestionar mis rutinas</button>
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
      <label class="field block"><span>Observaciones de la sesión</span>
        <textarea id="meta-obs" rows="2" placeholder="Cómo te sentiste, energía, dolores…">${esc(b.observaciones)}</textarea></label>
      <button class="btn-primary btn-block big" id="guardar-sesion-2">${state.editandoId ? 'Guardar cambios' : 'Guardar entrenamiento'}</button>
      ${state.editandoId ? `<button class="btn-danger btn-block" id="eliminar-sesion">Eliminar entrenamiento</button>` : ''}
    </section>`;
  }

  function mejoraActual(ej) {
    const ultima = DB.ultimaCarga(state.usuarioId, ej.ejercicioId);
    if (!ultima) return null;
    const tipo = ej.tipo || DB.tipoDe(ej.ejercicioId, state.usuarioId);
    const lastPeso = maxOf(ultima.series, s => num(s.peso)), lastReps = maxOf(ultima.series, s => num(s.reps));
    const curPeso = maxOf(ej.series, s => num(s.peso)), curReps = maxOf(ej.series, s => num(s.reps));
    if (tipo === 'carga') {
      if (curPeso > lastPeso) return `▲ +${dec(curPeso - lastPeso)} kg respecto al último`;
      if (curPeso > 0 && curPeso === lastPeso && curReps > lastReps) return `▲ +${curReps - lastReps} reps respecto al último`;
    } else if (tipo === 'corporal' || tipo === 'pliometria') {
      if (curReps > lastReps) return `▲ +${curReps - lastReps} reps respecto al último`;
    }
    return null;
  }

  function ejercicioCard(ej, idx) {
    const tipo = ej.tipo || DB.tipoDe(ej.ejercicioId, state.usuarioId);
    const campos = DB.camposTipo(ej.ejercicioId, state.usuarioId);
    const rango = DB.rangoDe(ej.ejercicioId, state.usuarioId);
    const prog = DB.progresion(state.usuarioId, ej.ejercicioId);
    const ultima = DB.ultimaCarga(state.usuarioId, ej.ejercicioId);
    const cols = `28px ${campos.map(() => '1fr').join(' ')} 30px`;

    const cabecera = `<div class="serie-head" style="grid-template-columns:${cols}"><span class="serie-n">#</span>${campos.map(c => `<span>${CAMPO[c].lbl}</span>`).join('')}<span></span></div>`;
    const series = ej.series.map((se, si) => `
      <div class="serie-row" data-ej="${idx}" data-se="${si}" style="grid-template-columns:${cols}">
        <span class="serie-n">${si + 1}</span>
        ${campos.map(c => `<input class="serie-in ${c}" inputmode="${CAMPO[c].im}" placeholder="${CAMPO[c].ph}" value="${esc(se[c])}" data-ej="${idx}" data-se="${si}" data-k="${c}"/>`).join('')}
        <button class="serie-del" data-ej="${idx}" data-se="${si}" title="Quitar serie">×</button>
      </div>`).join('');

    let ultimaTxt = '';
    if (ultima) {
      ultimaTxt = ultima.series.filter(s => DB.serieValida(s)).map(s => {
        if (tipo === 'carga') return `${esc(s.peso || 0)}×${esc(s.reps)}`;
        if (tipo === 'velocidad') return `${esc(s.distancia || '?')}m ${s.tiempo ? 'en ' + esc(s.tiempo) + 's' : ''}`.trim();
        return `${esc(s.reps)}${s.altura ? ' · ' + esc(s.altura) + 'cm' : ''}`;
      }).join(' · ');
    }
    const mejora = mejoraActual(ej);
    return `
    <div class="card ej-card" data-ej="${idx}">
      <div class="ej-head">
        <div class="ej-title">
          <strong>${esc(ej.nombre)}</strong>
          ${ej.principal ? '<span class="tag principal">Principal</span>' : ''}
          ${rango && tipo !== 'velocidad' ? `<span class="tag rango" title="${esc(rango.label)}">${rango.min}–${rango.max} reps</span>` : ''}
          <span class="tag tipo tipo-${tipo}">${esc(DB.TIPOS[tipo].label)}</span>
        </div>
        <button class="ej-del" data-ej="${idx}" title="Quitar ejercicio">${ICONS.trash}</button>
      </div>
      ${ultima ? `<div class="ej-last"><span>Última vez: ${ultimaTxt || '—'}</span><button class="ej-repetir" data-ej="${idx}" type="button">${ICONS.copy} Repetir</button></div>` : ''}
      <div class="ej-delta ${mejora ? 'show' : ''}" data-delta="${idx}">${mejora || ''}</div>
      ${prog ? `<div class="ej-hint ${prog.tipo === 'subir' ? 'up' : ''}"><span class="hint-ico">${prog.tipo === 'subir' ? ICONS.up : ICONS.info}</span>${esc(prog.texto)}</div>` : ''}
      ${cabecera}
      <div class="series-cont">${series}</div>
      <button class="btn-ghost btn-sm add-serie" data-ej="${idx}">＋ Serie</button>
    </div>`;
  }

  function iniciarSesion(rutinaId) {
    if (rutinaId === 'libre') {
      state.borrador = { usuarioId: state.usuarioId, fecha: DB.todayISO(), tipoSesion: 'Entrenamiento libre', tipoId: 'libre', rutinaId: null, duracion: '', observaciones: '', ejercicios: [] };
    } else {
      const b = DB.sesionDesdeRutina(state.usuarioId, rutinaId);
      if (!b) { toast('No se encontró la rutina'); return; }
      b.ejercicios.forEach(ej => {
        const u = DB.ultimaCarga(state.usuarioId, ej.ejercicioId);
        if (u) ej.series.forEach((se, i) => {
          if (!u.series[i]) return;
          se.peso = u.series[i].peso || ''; se.reps = u.series[i].reps || '';
          se.distancia = u.series[i].distancia || ''; se.tiempo = u.series[i].tiempo || ''; se.altura = u.series[i].altura || '';
        });
      });
      state.borrador = b;
    }
    state.editandoId = null;
    render();
  }

  /* ============================================================ VISTA · RUTINAS ============================================================ */
  function vistaRutinas() {
    const rutinas = DB.getRutinas(state.usuarioId);
    const cards = rutinas.map((r, i) => `
      <div class="card rutina-card" data-id="${r.id}">
        <div class="rutina-top">
          <div class="rutina-info">
            <strong>${esc(r.nombre)}</strong>
            <span class="muted">${esc(r.sub || '')}${r.sub ? ' · ' : ''}${(r.ejercicios || []).length} ejercicios</span>
          </div>
          <div class="rutina-move">
            <button class="ic-btn rt-up" data-id="${r.id}" ${i === 0 ? 'disabled' : ''} title="Subir">${ICONS.arrowU}</button>
            <button class="ic-btn rt-down" data-id="${r.id}" ${i === rutinas.length - 1 ? 'disabled' : ''} title="Bajar">${ICONS.arrowD}</button>
          </div>
        </div>
        <div class="rutina-actions">
          <button class="btn-ghost btn-sm rt-edit" data-id="${r.id}">${ICONS.edit} Editar</button>
          <button class="btn-ghost btn-sm rt-dup" data-id="${r.id}">${ICONS.dup} Duplicar</button>
          <button class="btn-ghost btn-sm danger rt-del" data-id="${r.id}">${ICONS.trash} Eliminar</button>
        </div>
      </div>`).join('');
    return `
    <section class="view-section">
      <div class="section-head"><h2>Mis rutinas</h2><p class="muted">Personalizá tus sesiones — solo afecta a ${esc(DB.getUsuario(state.usuarioId).nombre)}</p></div>
      ${cards || `<p class="empty">Todavía no tenés rutinas.</p>`}
      <button class="btn-primary btn-block big" id="nueva-rutina">＋ Nueva rutina</button>
    </section>`;
  }

  function vistaRutinaEditor() {
    const r = DB.getRutina(state.usuarioId, state.rutinaEditId);
    if (!r) { state.rutinaEditId = null; return vistaRutinas(); }
    const ejs = (r.ejercicios || []).map((e, i) => {
      const tipo = e.tipo || 'carga';
      const rango = e.rango && DB.RANGOS[e.rango] ? DB.RANGOS[e.rango] : null;
      return `
      <div class="card re-card" data-i="${i}">
        <div class="re-main">
          <div class="re-info">
            <strong>${esc(e.nombre)}</strong>
            <div class="re-tags">
              <span class="tag tipo tipo-${tipo}">${esc(DB.TIPOS[tipo].label)}</span>
              ${rango ? `<span class="tag rango">${rango.min}–${rango.max} reps</span>` : ''}
              <span class="tag rango">${num(e.seriesObjetivo) || 3} series</span>
            </div>
          </div>
          <div class="re-move">
            <button class="ic-btn re-up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>${ICONS.arrowU}</button>
            <button class="ic-btn re-down" data-i="${i}" ${i === r.ejercicios.length - 1 ? 'disabled' : ''}>${ICONS.arrowD}</button>
          </div>
        </div>
        <div class="re-actions">
          <button class="btn-ghost btn-sm re-edit" data-i="${i}">${ICONS.edit} Editar</button>
          <button class="btn-ghost btn-sm danger re-del" data-i="${i}">${ICONS.trash} Quitar</button>
        </div>
      </div>`;
    }).join('');
    return `
    <section class="view-section">
      <div class="form-top"><button class="link-back" id="rt-volver">‹ Mis rutinas</button></div>
      <div class="card meta-card">
        <input class="input-title" id="rt-nombre" value="${esc(r.nombre)}" placeholder="Nombre de la sesión"/>
        <input class="input-sub" id="rt-sub" value="${esc(r.sub || '')}" placeholder="Subtítulo (ej: Pecho / Hombro)"/>
      </div>
      ${ejs || `<p class="empty">Sin ejercicios. Agregá el primero.</p>`}
      <button class="btn-ghost btn-block" id="re-agregar">＋ Agregar ejercicio</button>
    </section>`;
  }

  function formEditarEjercicioRutina(index) {
    const r = DB.getRutina(state.usuarioId, state.rutinaEditId);
    const e = r && r.ejercicios[index]; if (!e) return;
    const tipoOpts = Object.keys(DB.TIPOS).map(k => `<option value="${k}" ${e.tipo === k ? 'selected' : ''}>${DB.TIPOS[k].label}</option>`).join('');
    const rangoOpts = `<option value="">—</option>` + Object.keys(DB.RANGOS).map(k => `<option value="${k}" ${e.rango === k ? 'selected' : ''}>${DB.RANGOS[k].label} (${DB.RANGOS[k].min}–${DB.RANGOS[k].max})</option>`).join('');
    abrirModal(`
      <div class="modal-head"><h3>Editar ejercicio</h3><button class="modal-x" data-close>×</button></div>
      <div class="form-grid">
        <label class="field block"><span>Nombre</span><input id="ee-nombre" value="${esc(e.nombre)}"/></label>
        <label class="field block"><span>Tipo</span><select id="ee-tipo">${tipoOpts}</select></label>
        <div class="meta-row">
          <label class="field"><span>Reps objetivo</span><select id="ee-rango">${rangoOpts}</select></label>
          <label class="field"><span>Series objetivo</span><input id="ee-series" type="number" inputmode="numeric" value="${num(e.seriesObjetivo) || 3}"/></label>
        </div>
      </div>
      <button class="btn-primary btn-block" id="ee-guardar">Guardar</button>
    `);
    $('#ee-guardar').addEventListener('click', () => {
      DB.editarEjercicioRutina(state.usuarioId, state.rutinaEditId, index, {
        nombre: $('#ee-nombre').value.trim() || e.nombre,
        tipo: $('#ee-tipo').value,
        rango: $('#ee-rango').value || null,
        seriesObjetivo: Math.max(1, num($('#ee-series').value) || 3),
      });
      cerrarModal(); render();
    });
  }

  /* ============================================================ VISTA · ANALÍTICA ============================================================ */
  function nivelClase(nivel) { return 'nivel-' + Math.max(0, DB.NIVELES.indexOf(nivel)); }
  function vistaAnalisis() {
    const u = DB.getUsuario(state.usuarioId);
    const fr = DB.analisisRelativo(state.usuarioId);
    const recsMap = {}; DB.getRecords(state.usuarioId).forEach(r => { recsMap[r.ejercicioId] = r; });
    const destacados = DB.DESTACADOS.filter(id => recsMap[id] && DB.tipoDe(id, state.usuarioId) !== 'velocidad');
    const charts = destacados.map(id => {
      const ej = DB.getEjercicio(id, state.usuarioId) || { nombre: id };
      const conCarga = DB.tipoDe(id, state.usuarioId) === 'carga';
      const serie = DB.serieTemporal(state.usuarioId, id, state.periodo || null).map(p => ({ fecha: p.fecha, valor: conCarga ? p.e1rm : p.reps }));
      return `<div class="card chart-card"><div class="card-head"><h3>${esc(ej.nombre)}</h3><span class="muted">${conCarga ? '1RM estimado' : 'Reps máximas'}</span></div>${Charts.linea(serie, { color: conCarga ? '#22c55e' : '#38bdf8', unidad: conCarga ? 'kg' : 'reps' })}</div>`;
    }).join('');

    let frHtml;
    if (!u.pesoCorporal) {
      frHtml = `<button class="aviso-perfil" id="aviso-perfil">Cargá tu peso corporal en Perfil físico para calcular fuerza relativa →</button>`;
    } else if (!fr.length) {
      frHtml = `<p class="empty">Registrá ejercicios principales (press banca, sentadilla, peso muerto, dominadas…) para ver tu fuerza relativa.</p>`;
    } else {
      frHtml = `<div class="fr-list">${fr.map(f => {
        const right = f.tipo === 'carga'
          ? `<b>${dec(f.ratio)}×</b> <span class="muted">peso corporal</span>`
          : `<b>${f.reps} reps</b> <span class="muted">a peso corporal</span>`;
        return `<div class="fr-row">
          <div class="fr-name">${esc(f.nombre)}<span class="muted">${f.tipo === 'carga' ? fmt(f.e1rm) + ' kg · 1RM est.' : ''}</span></div>
          <div class="fr-right">${right}${f.nivel ? `<span class="nivel-badge ${nivelClase(f.nivel)}">${f.nivel}</span>` : ''}</div>
        </div>`;
      }).join('')}</div>`;
    }

    return `
    <section class="view-section">
      <div class="section-head"><h2>Analítica</h2><p class="muted">Rendimiento relativo y evolución</p></div>
      <div class="card"><div class="card-head"><h3>Fuerza relativa</h3><span class="muted">peso movido ÷ peso corporal</span></div>${frHtml}</div>
      <div class="period-toggle">
        ${[[30, '30 días'], [90, '90 días'], [0, 'Todo']].map(([d, l]) => `<button class="period-btn ${state.periodo === d ? 'active' : ''}" data-periodo="${d}">${l}</button>`).join('')}
      </div>
      ${charts || `<p class="empty">Registrá entrenamientos para ver tu evolución.</p>`}
    </section>`;
  }

  /* ============================================================ VISTA · HISTORIAL ============================================================ */
  function vistaHistorial() {
    const sesiones = DB.getSesiones(state.usuarioId);
    if (!sesiones.length) return `<section class="view-section"><div class="section-head"><h2>Historial</h2></div><p class="empty">Todavía no registraste entrenamientos.</p></section>`;
    const grupos = {};
    sesiones.forEach(s => { const d = new Date(s.fecha + 'T00:00:00'); const k = `${MESES[d.getMonth()]} ${d.getFullYear()}`; (grupos[k] = grupos[k] || []).push(s); });
    const html = Object.keys(grupos).map(mes => `
      <div class="hist-month">${mes}</div>
      ${grupos[mes].map(s => `
        <button class="hist-card" data-id="${s.id}">
          <div class="hist-date"><span class="hd-day">${new Date(s.fecha + 'T00:00:00').getDate()}</span><span class="hd-dow">${DIAS[new Date(s.fecha + 'T00:00:00').getDay()].slice(0, 3)}</span></div>
          <div class="hist-body"><strong>${esc(s.tipoSesion)}</strong><span class="muted">${DB.ejerciciosSesion(s)} ejercicios · ${DB.seriesSesion(s)} series${DB.volumenSesion(s) ? ' · ' + fmt(DB.volumenSesion(s)) + ' kg' : ''}</span></div>
          <span class="sp-arrow">›</span>
        </button>`).join('')}`).join('');
    return `<section class="view-section"><div class="section-head"><h2>Historial</h2><p class="muted">${sesiones.length} entrenamientos</p></div>${html}</section>`;
  }

  function serieDetalleTxt(se, tipo) {
    if (tipo === 'carga') return `<b>${esc(se.peso || 0)}kg</b> × ${esc(se.reps)}${se.rir !== '' && se.rir != null ? ` <i>RIR ${esc(se.rir)}</i>` : ''}`;
    if (tipo === 'velocidad') return `<b>${esc(se.distancia || '?')} m</b>${se.tiempo ? ` en <i>${esc(se.tiempo)}s</i>` : ''}`;
    if (tipo === 'pliometria') return `<b>${esc(se.reps)} reps</b>${se.altura ? ` · ${esc(se.altura)}cm` : ''}${se.distancia ? ` · ${esc(se.distancia)}m` : ''}`;
    return `<b>${esc(se.reps)} reps</b>${se.rir !== '' && se.rir != null ? ` <i>RIR ${esc(se.rir)}</i>` : ''}`;
  }
  function detalleSesion(id) {
    const s = DB.getSesion(id); if (!s) return;
    const ejs = (s.ejercicios || []).map(ej => {
      const tipo = ej.tipo || DB.tipoDe(ej.ejercicioId, state.usuarioId);
      const series = (ej.series || []).filter(se => DB.serieValida(se));
      if (!series.length) return '';
      return `<div class="det-ej"><strong>${esc(ej.nombre)}</strong><div class="det-series">${series.map((se, i) => `<span class="det-serie">${i + 1}: ${serieDetalleTxt(se, tipo)}</span>`).join('')}</div>${ej.notas ? `<div class="det-notas">${esc(ej.notas)}</div>` : ''}</div>`;
    }).join('');
    const vol = DB.volumenSesion(s);
    abrirModal(`
      <div class="modal-head"><div><h3>${esc(s.tipoSesion)}</h3><span class="muted">${fechaLinda(s.fecha)}${s.duracion ? ' · ' + esc(s.duracion) + ' min' : ''}</span></div><button class="modal-x" data-close>×</button></div>
      <div class="modal-stats"><span><b>${DB.ejerciciosSesion(s)}</b> ejercicios</span><span><b>${DB.seriesSesion(s)}</b> series</span>${vol ? `<span><b>${fmt(vol)}</b> kg</span>` : ''}</div>
      ${ejs || '<p class="empty">Sin series cargadas.</p>'}
      ${s.observaciones ? `<div class="det-obs"><span class="muted">Observaciones</span><p>${esc(s.observaciones)}</p></div>` : ''}
      <div class="modal-actions"><button class="btn-ghost" id="editar-sesion">Editar</button><button class="btn-danger" id="eliminar-sesion-modal">Eliminar</button></div>
    `);
    $('#editar-sesion').addEventListener('click', () => { cerrarModal(); editarSesion(s.id); });
    $('#eliminar-sesion-modal').addEventListener('click', () => {
      if (confirm('¿Eliminar este entrenamiento? No se puede deshacer.')) { DB.eliminarSesion(s.id); cerrarModal(); toast('Entrenamiento eliminado'); render(); }
    });
  }
  function editarSesion(id) {
    const s = DB.getSesion(id); if (!s) return;
    state.borrador = JSON.parse(JSON.stringify(s)); state.editandoId = id; state.tab = 'entrenar'; render();
  }

  /* ============================================================ GUARDAR ============================================================ */
  function leerFormulario() {
    const b = state.borrador;
    b.tipoSesion = $('#meta-tipo').value.trim() || 'Entrenamiento';
    b.fecha = $('#meta-fecha').value || DB.todayISO();
    b.duracion = $('#meta-duracion').value;
    b.observaciones = $('#meta-obs').value.trim();
  }
  function guardar() {
    leerFormulario();
    const b = state.borrador;
    const hayDatos = b.ejercicios.some(ej => (ej.series || []).some(se => DB.serieValida(se)));
    if (!hayDatos) { toast('Cargá al menos una serie'); return; }
    const editando = !!state.editandoId;
    const guardada = editando ? DB.actualizarSesion(state.editandoId, b) : DB.crearSesion(b);
    const logros = guardada ? DB.detectarRecords(state.usuarioId, guardada) : [];
    state.borrador = null; state.editandoId = null; state.tab = 'inicio';
    render();
    if (logros.length) notificarRecords(logros);
    else toast(editando ? 'Entrenamiento actualizado' : 'Entrenamiento guardado');
  }
  function notificarRecords(logros) {
    const lista = logros.slice(0, 4).map(l => {
      const valor = l.tipo === 'reps' ? `${l.ahora} reps` : `${dec(l.ahora)} ${l.unidad}`;
      const delta = l.tipo === 'reps' ? `+${l.delta}` : `+${dec(l.delta)} ${l.unidad}`;
      return `<div class="pr-row"><span class="pr-name">${esc(l.nombre)}</span><span class="pr-val">${valor} <em>${delta}</em></span></div>`;
    }).join('');
    const banner = document.createElement('div');
    banner.className = 'pr-banner';
    banner.innerHTML = `<div class="pr-card"><div class="pr-top"><span class="pr-trophy">${ICONS.trophy}</span><strong>${logros.length === 1 ? 'Nuevo récord personal' : `${logros.length} récords personales`}</strong></div>${lista}<button class="btn-primary btn-block pr-ok">Seguir</button></div>`;
    document.body.appendChild(banner);
    const cerrar = () => banner.remove();
    banner.addEventListener('click', (e) => { if (e.target === banner || e.target.classList.contains('pr-ok')) cerrar(); });
    setTimeout(cerrar, 6000);
  }

  /* ============================================================ EVENTOS POR VISTA ============================================================ */
  function bindVista() {
    const cta = $('#cta-entrenar'); if (cta) cta.addEventListener('click', () => irA('entrenar'));
    const ap = $('#aviso-perfil'); if (ap) ap.addEventListener('click', formPerfilFisico);

    // ENTRENAR
    $$('.session-pick').forEach(b => b.addEventListener('click', () => iniciarSesion(b.dataset.rutina)));
    const irRut = $('#ir-rutinas'); if (irRut) irRut.addEventListener('click', () => irA('rutinas'));
    if (state.borrador) bindFormulario();

    // RUTINAS
    if (state.tab === 'rutinas') bindRutinas();

    // ANALÍTICA
    $$('.period-btn').forEach(b => b.addEventListener('click', () => { state.periodo = parseInt(b.dataset.periodo, 10); render(); }));

    // HISTORIAL
    $$('.hist-card').forEach(b => b.addEventListener('click', () => detalleSesion(b.dataset.id)));
  }

  function bindRutinas() {
    if (state.rutinaEditId) {
      $('#rt-volver').addEventListener('click', () => { state.rutinaEditId = null; render(); });
      const guardarMeta = () => DB.actualizarRutina(state.usuarioId, state.rutinaEditId, { nombre: $('#rt-nombre').value.trim() || 'Sesión', sub: $('#rt-sub').value.trim() });
      $('#rt-nombre').addEventListener('change', guardarMeta);
      $('#rt-sub').addEventListener('change', guardarMeta);
      $$('.re-edit').forEach(b => b.addEventListener('click', () => formEditarEjercicioRutina(+b.dataset.i)));
      $$('.re-del').forEach(b => b.addEventListener('click', () => { DB.quitarEjercicioDeRutina(state.usuarioId, state.rutinaEditId, +b.dataset.i); render(); }));
      $$('.re-up').forEach(b => b.addEventListener('click', () => { guardarMeta(); DB.moverEjercicioRutina(state.usuarioId, state.rutinaEditId, +b.dataset.i, -1); render(); }));
      $$('.re-down').forEach(b => b.addEventListener('click', () => { guardarMeta(); DB.moverEjercicioRutina(state.usuarioId, state.rutinaEditId, +b.dataset.i, 1); render(); }));
      $('#re-agregar').addEventListener('click', () => {
        guardarMeta();
        abrirSelectorEjercicio((ejDef) => { DB.agregarEjercicioARutina(state.usuarioId, state.rutinaEditId, ejDef); render(); });
      });
      return;
    }
    $('#nueva-rutina').addEventListener('click', () => {
      const r = DB.crearRutina(state.usuarioId, { nombre: 'Nueva sesión' });
      if (r) { state.rutinaEditId = r.id; render(); }
    });
    $$('.rt-edit').forEach(b => b.addEventListener('click', () => { state.rutinaEditId = b.dataset.id; render(); }));
    $$('.rt-dup').forEach(b => b.addEventListener('click', () => { DB.duplicarRutina(state.usuarioId, b.dataset.id); toast('Rutina duplicada'); render(); }));
    $$('.rt-del').forEach(b => b.addEventListener('click', () => {
      if (confirm('¿Eliminar esta rutina? No borra tu historial de entrenamientos.')) { DB.eliminarRutina(state.usuarioId, b.dataset.id); render(); }
    }));
    const ids = DB.getRutinas(state.usuarioId).map(r => r.id);
    $$('.rt-up').forEach(b => b.addEventListener('click', () => moverRutina(b.dataset.id, -1, ids)));
    $$('.rt-down').forEach(b => b.addEventListener('click', () => moverRutina(b.dataset.id, 1, ids)));
  }
  function moverRutina(id, dir, ids) {
    const i = ids.indexOf(id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const arr = ids.slice(); const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    DB.reordenarRutinas(state.usuarioId, arr); render();
  }

  function bindFormulario() {
    $('#cancelar-sesion').addEventListener('click', () => { state.borrador = null; state.editandoId = null; render(); });
    ['#guardar-sesion', '#guardar-sesion-2'].forEach(sel => { const el = $(sel); if (el) el.addEventListener('click', guardar); });
    const del = $('#eliminar-sesion');
    if (del) del.addEventListener('click', () => { if (confirm('¿Eliminar este entrenamiento? No se puede deshacer.')) { DB.eliminarSesion(state.editandoId); state.borrador = null; state.editandoId = null; state.tab = 'historial'; render(); } });

    const cont = $('#ejercicios-cont');
    cont.addEventListener('input', (e) => {
      const t = e.target;
      if (t.classList.contains('serie-in')) {
        const ej = +t.dataset.ej, se = +t.dataset.se, k = t.dataset.k;
        state.borrador.ejercicios[ej].series[se][k] = t.value;
        actualizarDelta(ej);
      }
    });
    cont.addEventListener('click', (e) => {
      const t = e.target;
      const repetir = t.closest('.ej-repetir');
      if (t.classList.contains('add-serie')) { state.borrador.ejercicios[+t.dataset.ej].series.push(DB.nuevaSerie()); rerenderEjercicios(); }
      else if (t.classList.contains('serie-del')) {
        const ej = +t.dataset.ej, se = +t.dataset.se;
        state.borrador.ejercicios[ej].series.splice(se, 1);
        if (!state.borrador.ejercicios[ej].series.length) state.borrador.ejercicios[ej].series.push(DB.nuevaSerie());
        rerenderEjercicios();
      } else if (t.classList.contains('ej-del')) { state.borrador.ejercicios.splice(+t.dataset.ej, 1); rerenderEjercicios(); }
      else if (repetir) repetirUltima(+repetir.dataset.ej);
    });
    $('#agregar-ejercicio').addEventListener('click', () => {
      abrirSelectorEjercicio((ejDef) => {
        state.borrador.ejercicios.push(DB.nuevoEjercicioSesion(ejDef.id, state.usuarioId));
        if (state.borrador.rutinaId) { DB.agregarEjercicioARutina(state.usuarioId, state.borrador.rutinaId, ejDef); toast('Agregado a tu rutina ✓'); }
        rerenderEjercicios();
      });
    });
  }

  function actualizarDelta(idx) {
    const ej = state.borrador.ejercicios[idx];
    const el = $(`[data-delta="${idx}"]`); if (!el) return;
    const txt = mejoraActual(ej); el.textContent = txt || ''; el.classList.toggle('show', !!txt);
  }
  function repetirUltima(idx) {
    const ej = state.borrador.ejercicios[idx];
    const u = DB.ultimaCarga(state.usuarioId, ej.ejercicioId); if (!u) return;
    ej.series = u.series.map(s => Object.assign(DB.nuevaSerie(), { peso: s.peso || '', reps: s.reps || '', distancia: s.distancia || '', tiempo: s.tiempo || '', altura: s.altura || '' }));
    if (!ej.series.length) ej.series = [DB.nuevaSerie()];
    rerenderEjercicios(); toast('Cargado de la última vez');
  }
  function rerenderEjercicios() {
    leerFormulario();
    $('#ejercicios-cont').innerHTML = state.borrador.ejercicios.map((ej, i) => ejercicioCard(ej, i)).join('');
    $('#meta-tipo').value = state.borrador.tipoSesion; $('#meta-fecha').value = state.borrador.fecha;
    $('#meta-duracion').value = state.borrador.duracion; $('#meta-obs').value = state.borrador.observaciones;
  }

  /* ============================================================ SELECTOR DE EJERCICIO (genérico) ============================================================ */
  function abrirSelectorEjercicio(onPick) {
    const ejs = DB.getEjerciciosDisponibles(state.usuarioId);
    const cats = {};
    ejs.forEach(e => { (cats[e.categoria] = cats[e.categoria] || []).push(e); });
    const lista = Object.keys(cats).sort().map(cat => `
      <div class="pick-cat">${esc(cat)}</div>
      ${cats[cat].map(e => `<button class="pick-ej" data-id="${e.id}">${esc(e.nombre)}${e.principal ? ' <span class="dot-principal"></span>' : ''}</button>`).join('')}`).join('');
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
      const ejDef = ejs.find(e => e.id === b.dataset.id);
      cerrarModal(); onPick(ejDef);
    }));
    $('#nuevo-ej').addEventListener('click', () => crearEjercicioNuevo(onPick));
  }
  function crearEjercicioNuevo(onPick) {
    const nombre = prompt('Nombre del ejercicio:');
    if (!nombre || !nombre.trim()) return;
    const opciones = Object.keys(DB.TIPOS);
    const lbls = opciones.map((k, i) => `${i + 1}) ${DB.TIPOS[k].label}`).join('\n');
    const tipo = opciones[(parseInt(prompt(`Tipo de ejercicio:\n${lbls}\n\nNúmero:`, '1'), 10) || 1) - 1] || 'carga';
    let rango = 'hipertrofia';
    if (tipo === 'pliometria') rango = 'pliometria';
    else if (tipo === 'velocidad') rango = null;
    else {
      const rk = Object.keys(DB.RANGOS).filter(k => k !== 'pliometria');
      const rl = rk.map((k, i) => `${i + 1}) ${DB.RANGOS[k].label} (${DB.RANGOS[k].min}–${DB.RANGOS[k].max})`).join('\n');
      rango = rk[(parseInt(prompt(`Reps objetivo:\n${rl}\n\nNúmero:`, '2'), 10) || 2) - 1] || 'hipertrofia';
    }
    const principal = tipo === 'carga' && rango === 'fuerza';
    const e = DB.crearEjercicioCustom(state.usuarioId, { nombre: nombre.trim(), categoria: 'Otros', principal, tipo, rango });
    cerrarModal();
    if (e) onPick(e);
  }

  /* ============================================================ MODAL + TOAST ============================================================ */
  function abrirModal(html) { const m = $('#modal'); $('#modal-content').innerHTML = html; m.classList.remove('hidden'); m.addEventListener('click', onModalClick); }
  function onModalClick(e) { if (e.target.id === 'modal' || e.target.hasAttribute('data-close') || e.target.classList.contains('modal-x')) cerrarModal(); }
  function cerrarModal() { const m = $('#modal'); m.classList.add('hidden'); m.removeEventListener('click', onModalClick); $('#modal-content').innerHTML = ''; }

  let toastT;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ============================================================ NAV GLOBAL ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => irA(b.dataset.tab)));
    $('#switch-user').addEventListener('click', renderSelectorUsuario);
    const pf = $('#perfil-fisico'); if (pf) pf.addEventListener('click', formPerfilFisico);
    start();
  });

  window.App = { irA, render };
})();
