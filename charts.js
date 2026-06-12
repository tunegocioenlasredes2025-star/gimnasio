/* ============================================================
   ATLETAS · Gráficos en SVG puro (sin librerías externas)
   ============================================================ */
(function () {
  'use strict';

  const C = {
    grid: '#243248',
    line: '#22c55e',
    line2: '#38bdf8',
    text: '#64748b',
    dot: '#22c55e',
    area: 'rgba(34,197,94,0.15)',
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /**
   * Gráfico de líneas. puntos = [{fecha:'YYYY-MM-DD', valor:Number}]
   * opts: { titulo, unidad, color }
   */
  function linea(puntos, opts) {
    opts = opts || {};
    const color = opts.color || C.line;
    const W = 320, H = 150, padL = 34, padR = 10, padT = 14, padB = 22;
    const innerW = W - padL - padR, innerH = H - padT - padB;

    if (!puntos || puntos.length === 0) {
      return `<div class="chart-empty">Sin datos todavía</div>`;
    }
    if (puntos.length === 1) {
      const p = puntos[0];
      return `<div class="chart-single"><b>${esc(p.valor)}</b> ${esc(opts.unidad || '')}<span>${esc(p.fecha)}</span></div>`;
    }

    const vals = puntos.map(p => p.valor);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min = min - 1; max = max + 1; }
    const range = max - min;
    // padding del eje Y
    min = Math.max(0, min - range * 0.1); max = max + range * 0.1;

    const x = (i) => padL + (innerW * i) / (puntos.length - 1);
    const y = (v) => padT + innerH - (innerH * (v - min)) / (max - min);

    const linePts = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
    const areaPts = `${padL},${padT + innerH} ${linePts} ${padL + innerW},${padT + innerH}`;

    // líneas de referencia (3)
    let grid = '';
    for (let g = 0; g <= 2; g++) {
      const v = min + (range * 1.2) * (g / 2);
      const yy = y(v);
      grid += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>`;
      grid += `<text x="2" y="${(yy + 3).toFixed(1)}" fill="${C.text}" font-size="9">${Math.round(v)}</text>`;
    }

    const dots = puntos.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="2.5" fill="${color}"/>`).join('');

    // etiquetas X: primera y última
    const first = puntos[0].fecha.slice(5), last = puntos[puntos.length - 1].fecha.slice(5);
    const xlabels =
      `<text x="${padL}" y="${H - 5}" fill="${C.text}" font-size="9">${esc(first)}</text>` +
      `<text x="${W - padR}" y="${H - 5}" fill="${C.text}" font-size="9" text-anchor="end">${esc(last)}</text>`;

    return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      ${grid}
      <polygon points="${areaPts}" fill="${color}" opacity="0.12"/>
      <polyline points="${linePts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xlabels}
    </svg>`;
  }

  /**
   * Mini barras (ej: volumen por sesión). datos = [{label, valor}]
   */
  function barras(datos, opts) {
    opts = opts || {};
    const color = opts.color || C.line2;
    if (!datos || !datos.length) return `<div class="chart-empty">Sin datos todavía</div>`;
    const W = 320, H = 120, padB = 18, padT = 8, padL = 6, padR = 6;
    const innerH = H - padT - padB, innerW = W - padL - padR;
    const max = Math.max(...datos.map(d => d.valor), 1);
    const bw = innerW / datos.length;
    let bars = '';
    datos.forEach((d, i) => {
      const h = (innerH * d.valor) / max;
      const xx = padL + i * bw + bw * 0.15;
      const yy = padT + innerH - h;
      bars += `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="${color}" opacity="0.85"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
  }

  window.Charts = { linea, barras };
})();
