/* CON-01 · Constancia de tarea no convencional / mayor tiempo de ejecución.
   Lo comparten la app de Contratistas y NEXO 2: motivos, cálculo del tiempo extra y el PDF. */
(function () {
  const MOT = [
    ['detalle', 'Detalle constructivo especial o fuera de lo estándar'],
    ['material', 'Material o sistema no habitual'],
    ['redef', 'Rehacer trabajo por cambio de definición o de plano'],
    ['gremio', 'Rehacer trabajo por error de otro gremio'],
    ['cond', 'Condiciones de obra (acceso, altura, interferencias, clima)'],
    ['falta', 'Falta de definición al momento de ejecutar'],
    ['otro', 'Otro'],
  ];
  const EST_T = { hacer: 'Por hacer', ejec: 'En ejecución', fin: 'Terminada' };
  const num = (x) => { const n = Number(String(x == null ? '' : x).replace(',', '.')); return isFinite(n) && n > 0 ? n : 0 };
  const horas = (t) => (t ? num(t.n) * (t.u === 'h' ? 1 : 8) : 0);
  const hh = (t) => horas(t) * Math.max(1, num(t && t.p) || 1);
  const fmtN = (n) => (Math.round(n * 10) / 10).toLocaleString('es-AR');
  const uTxt = (n, u) => fmtN(n) + ' ' + (u === 'h' ? (n === 1 ? 'hora' : 'horas') : (n === 1 ? 'día' : 'días'));
  const tTxt = (t) => (t && num(t.n) ? uTxt(num(t.n), t.u) + ' · ' + (num(t.p) || 1) + ' ' + ((num(t.p) || 1) === 1 ? 'persona' : 'personas') : '—');
  /* tiempo extra (real − habitual) y horas-hombre extra */
  function calc(hab, real) {
    const mismaU = (hab && hab.u) === (real && real.u);
    const dif = mismaU ? num(real && real.n) - num(hab && hab.n) : (horas(real) - horas(hab)) / ((real && real.u) === 'h' ? 1 : 8);
    const u = (real && real.u) || 'd';
    const hhx = hh(real) - hh(hab);
    const dias = (horas(real) - horas(hab)) / 8;
    const sg = (n) => (n > 0 ? '+' : n < 0 ? '−' : '');
    return { dif, u, hhx, dias, txt: sg(dif) + uTxt(Math.abs(dif), u) + ' · ' + sg(hhx) + fmtN(Math.abs(hhx)) + ' h-h' };
  }
  /* el tiempo que vale: el aceptado si hubo "Conforme con otro tiempo", si no el declarado */
  function vigente(nc) { const r = nc && nc.res; return r && r.acc === 'otro' && r.acep ? r.acep : nc && nc.real }
  function diasAceptados(nc) { const r = nc && nc.res; if (!r || (r.acc !== 'conf' && r.acc !== 'otro')) return 0; return Math.max(0, Math.ceil(calc(nc.hab, vigente(nc)).dias - 1e-9)) }
  const estado = (it) => { const r = it && it.nc && it.nc.res; if (r && r.acc === 'conf') return 'Conforme'; if (r && r.acc === 'otro') return 'Conforme con otro tiempo'; if (r && r.acc === 'obs') return 'Observado'; return 'Informado' };
  const motTxt = (nc) => (nc.motivos || []).map((k) => (k === 'otro' ? 'Otro: ' + (nc.otroTxt || '') : (MOT.find((m) => m[0] === k) || [k, k])[1]));
  const fh = (t) => (t ? new Date(t).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '');

  function cargarJs(src) { return new Promise((ok, ko) => { if (document.querySelector('script[src="' + src + '"]')) { if (window.jspdf) ok(); else setTimeout(() => (window.jspdf ? ok() : ko()), 1500); return } const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s) }) }
  async function imgData(u) { try { const b = await (await fetch(u)).blob(); return await new Promise((ok) => { const r = new FileReader(); r.onload = () => { const i = new Image(); i.onload = () => { const M = 1200, k = Math.min(1, M / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); ok({ d: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height }) }; i.onerror = () => ok(null); i.src = r.result }; r.readAsDataURL(b) }) } catch (e) { return null } }

  /* PDF con el mismo formato que los de auditoría: franja oscura arriba, título dorado, Helvetica */
  async function pdf(it, opt) {
    opt = opt || {};
    if (!window.jspdf) await cargarJs('/vendor/jspdf/jspdf.umd.min.js');
    const { jsPDF } = window.jspdf, d = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, M = 16, CW = W - 2 * M, nc = it.nc || {};
    let y = 18;
    const sup = (t) => String(t == null ? '' : t).replace(/²/g, '2').replace(/³/g, '3').replace(/−/g, '-');
    const nueva = (h) => { if (y + h > 284) { d.addPage(); y = 18 } };
    const lin = (t, sz, b, col, ind) => { d.setFont('helvetica', b ? 'bold' : 'normal'); d.setFontSize(sz); d.setTextColor(...(col || [30, 30, 30])); d.splitTextToSize(sup(t), CW - (ind || 0)).forEach((l) => { nueva(sz * 0.45); d.text(l, M + (ind || 0), y); y += sz * 0.45 }) };
    const fila = (k, v) => { d.setFont('helvetica', 'bold'); d.setFontSize(10); d.setTextColor(110, 105, 95); const L = d.splitTextToSize(sup(v || '—'), CW - 48); nueva(5 * L.length); d.text(k, M, y); d.setFont('helvetica', 'normal'); d.setTextColor(30, 30, 30); L.forEach((l, k2) => d.text(l, M + 48, y + k2 * 4.6)); y += Math.max(6, L.length * 4.6 + 1.4) };
    const H = (t) => { y += 3; nueva(12); d.setFont('helvetica', 'bold'); d.setFontSize(12); d.setTextColor(30, 30, 30); d.text(t, M, y); d.setDrawColor(184, 145, 90); d.setLineWidth(0.4); d.line(M, y + 1.6, W - M, y + 1.6); y += 7 };
    d.setFillColor(23, 24, 28); d.rect(0, 0, W, 30, 'F'); d.setTextColor(184, 145, 90); d.setFont('helvetica', 'bold'); d.setFontSize(10);
    d.text('CONSTANCIA DE TAREA NO CONVENCIONAL N° ' + (it.num || '—'), M, 12);
    d.setTextColor(255, 255, 255); d.setFontSize(16); d.text(sup(String(it.obraNombre || opt.obra || '')).slice(0, 60), M, 22); y = 40;
    fila('Contratista', (it.ctNombre || '') + (it.rubro ? ' (' + it.rubro + ')' : ''));
    fila('Rubro', it.rubro || '—');
    fila('Cargada', fh(it.creado));
    fila('Estado', estado(it) + (nc.estadoT ? ' · tarea ' + (EST_T[nc.estadoT] || nc.estadoT).toLowerCase() : ''));
    H('Tarea');
    fila('Tarea del cronograma', nc.tareaNom || it.tarea || '—');
    if (nc.ubic) fila('Ubicación en obra', nc.ubic);
    fila('Motivos', motTxt(nc).join(' · '));
    lin(nc.desc || it.desc || '', 10, 0, [50, 50, 50]); y += 2;
    if (nc.adic) fila('Adicional vinculado', 'N° ' + (nc.adic.num || '') + ' (el reconocimiento económico va por el adicional)');
    else if (nc.pideEcon) fila('Reconocimiento económico', 'Pedido: va por un Adicional aparte');
    H('Tiempos');
    const cols = ['Tiempo habitual', 'Tiempo real', 'Diferencia', 'Personas', 'H-h extra'], w = [0.24, 0.24, 0.18, 0.14, 0.2];
    const tabla = (rows) => { const X = []; let x = M; w.forEach((p) => { X.push(x); x += p * CW });
      nueva(9); d.setFillColor(15, 27, 45); d.rect(M, y - 4.6, CW, 7, 'F'); d.setFont('helvetica', 'bold'); d.setFontSize(8.5); d.setTextColor(255, 255, 255); cols.forEach((c, k) => d.text(c, X[k] + 2, y)); y += 6;
      rows.forEach((r, ri) => { const L = r.cells.map((c, k) => d.splitTextToSize(sup(c), w[k] * CW - 4)); const h = Math.max(...L.map((l) => l.length)) * 4.4 + 2; nueva(h + 2); if (r.lbl) { d.setFont('helvetica', 'bold'); d.setFontSize(7.5); d.setTextColor(110, 105, 95); d.text(r.lbl, M + 2, y); y += 3.6 } if (ri % 2 === 0) { d.setFillColor(245, 242, 236); d.rect(M, y - 3.8, CW, h, 'F') } d.setFont('helvetica', r.b ? 'bold' : 'normal'); d.setFontSize(9); d.setTextColor(30, 30, 30); L.forEach((l, k) => l.forEach((z, j) => d.text(z, X[k] + 2, y + j * 4.4))); y += h + 1 }) };
    const fil = (lbl, hab, real) => { const c = calc(hab, real); return { lbl, cells: [tTxt(hab), tTxt(real), c.txt.split(' · ')[0], String(Math.max(1, num(real && real.p) || 1)), (c.hhx > 0 ? '+' : '') + fmtN(c.hhx) + ' h-h'] } };
    const rows = [fil('DECLARADO POR EL CONTRATISTA', nc.hab, nc.real)];
    if (nc.res && nc.res.acc === 'otro' && nc.res.acep) rows.push({ ...fil('ACEPTADO POR ' + String(nc.res.nom || nc.res.porNom || 'LA OBRA').toUpperCase(), nc.hab, nc.res.acep), b: 1 });
    tabla(rows);
    const F = (it.fotos || []).slice(0, 12);
    if (F.length) {
      H('Fotos');
      const cw = (CW - 6) / 2;
      for (let k = 0; k < F.length; k += 2) {
        const par = await Promise.all(F.slice(k, k + 2).map(imgData)); let hmax = 0;
        const hs = par.map((im) => (im ? Math.min(90, cw * im.h / im.w) : 0)); hmax = Math.max(...hs, 0);
        nueva(hmax + 8);
        par.forEach((im, j) => { if (!im) return; const x = M + j * (cw + 6); try { d.addImage(im.d, 'JPEG', x, y, cw, hs[j]) } catch (e) {} });
        y += hmax + 2; d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.setTextColor(110, 105, 95); d.text('Cargada el ' + fh(it.creado), M, y + 2); y += 6;
      }
    }
    const A = it.archivos || [];
    if (A.length) { H('Adjuntos'); A.forEach((a) => { lin('• ' + (a.n || 'archivo'), 9.5, 1, [30, 30, 30]); if (a.u) { d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(40, 90, 160); d.splitTextToSize(a.u, CW - 4).forEach((l) => { nueva(4); d.textWithLink ? d.textWithLink(l, M + 4, y, { url: a.u }) : d.text(l, M + 4, y); y += 3.8 }) } }) }
    H('Historial');
    (it.hist || []).forEach((h) => { lin(fh(h.t) + ' · ' + (h.nom || h.por || ''), 9, 1, [70, 72, 80]); if (h.tx) lin(h.tx, 9.5, 0, [40, 40, 40], 3); y += 1 });
    y += 4; nueva(16); d.setDrawColor(184, 145, 90); d.setLineWidth(0.5); d.line(M, y, W - M, y); y += 7;
    const r = nc.res;
    lin('Estado final: ' + estado(it), 11, 1);
    if (r && (r.acc === 'conf' || r.acc === 'otro')) lin('Conformado por: ' + (r.nom || '') + ' · ' + fh(r.t) + (r.cmt ? ' — ' + r.cmt : ''), 10, 0, [31, 120, 70]);
    else lin('Pendiente de conformidad', 10, 0, [200, 70, 62]);
    const n = d.getNumberOfPages(); for (let p = 1; p <= n; p++) { d.setPage(p); d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.setTextColor(150, 145, 135); d.text('Constancia N° ' + (it.num || '') + ' · página ' + p + ' de ' + n, W - M, 292, { align: 'right' }) }
    return d.output('blob');
  }
  const nombreArchivo = (it) => ('Constancia tarea no convencional N ' + (it.num || '') + ' - ' + (it.obraNombre || '') + ' - ' + (it.ctNombre || '')).replace(/[\\/:*?"<>|]+/g, '-').trim() + '.pdf';
  window.NC = { MOT, EST_T, calc, vigente, diasAceptados, estado, motTxt, tTxt, pdf, nombreArchivo, num };
})();
