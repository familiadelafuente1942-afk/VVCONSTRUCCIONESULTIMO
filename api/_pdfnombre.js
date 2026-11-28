// Copia para el servidor de public/pdfnombre.js (mismo nombre descriptivo de los PDF). Si cambia aquel, regenerar este.
const window = {}, document = { addEventListener() {} };
/* PDF-01 · nombre descriptivo para todos los PDF y adjuntos que se bajan o se comparten (NEXO 2 y Contratistas)
   [Tipo de documento] N° [número] - [Obra] - [Título o tarea] - [AAAA-MM-DD].pdf */
(function () {
  const MAL = /[\/\\:*?"<>|\r\n\t]+/g;
  const limpio = (x) => String(x == null ? '' : x).replace(MAL, ' ').replace(/\s+/g, ' ').trim();
  /* "SAENZ PEÑA 011" → "Saenz Peña 011"; lo que ya viene escrito en minúsculas y mayúsculas queda igual */
  const tipoTitulo = (x) => limpio(x).split(' ').map((w) => (w.length > 1 && w === w.toUpperCase() && /[A-ZÁÉÍÓÚÑÜ]/.test(w) && !/\d/.test(w) ? w.charAt(0) + w.slice(1).toLowerCase() : w)).join(' ');
  /* recorta sin partir palabras y marca el corte con "…" */
  /* si el corte cae en medio de una palabra, se termina la palabra (como en "…sobre…"); si la palabra es muy larga, se corta antes */
  const recorta = (x, n, estricto) => { x = limpio(x); if (x.length <= n) return x; let c = x.slice(0, n);
    if (x[n] !== ' ' && c[c.length - 1] !== ' ') { const m = x.slice(n).match(/^\S+/); const resto = m ? m[0] : ''; if (!estricto && resto.length <= 12) c = c + resto; else { const k = c.lastIndexOf(' '); if (k > n * 0.5) c = c.slice(0, k) } }
    c = c.replace(/[\s,.;-]+$/, ''); return c.length < x.length ? c + '…' : c };
  const iso = (t) => { const d = t ? new Date(typeof t === 'string' && /^\d{4}-\d\d-\d\d$/.test(t) ? t + 'T12:00:00-03:00' : t) : new Date(); if (isNaN(d)) return ''; const a = new Date(d.getTime() - 3 * 3600e3); return a.toISOString().slice(0, 10) };
  function nombrePdf(doc) {
    doc = doc || {};
    const ext = doc.ext || 'pdf';
    const p = [limpio(doc.tipo || 'Documento') + (doc.num != null && String(doc.num).trim() ? ' N° ' + limpio(doc.num) : '')];
    if (doc.obra) p.push(tipoTitulo(doc.obra));
    if (doc.titulo && limpio(doc.titulo)) p.push(recorta(doc.titulo, 60));
    const f = doc.sinFecha ? '' : iso(doc.fecha);
    if (f) p.push((doc.fechaPref ? doc.fechaPref + ' ' : '') + f);
    let n = p.join(' - ');
    const tope = 150 - ext.length - 1;
    if (n.length > tope) { const fin = f ? ' - ' + (doc.fechaPref ? doc.fechaPref + ' ' : '') + f : ''; n = recorta(n.slice(0, n.length - fin.length), tope - fin.length - 1, true).replace(/…$/, '') + '…' + fin }
    return n + '.' + ext;
  }
  /* nombre original de un adjunto, limpio y con su extensión */
  function nombreAdjunto(n, url) {
    let x = limpio(n);
    if (!x) { try { x = decodeURIComponent(String(url || '').split('?')[0].split('/').pop()) } catch (e) { x = 'archivo' } }
    if (x.length > 150) { const m = x.match(/(\.[A-Za-z0-9]{1,5})$/); const e = m ? m[1] : ''; x = recorta(x.slice(0, x.length - e.length), 150 - e.length - 1, true).replace(/…$/, '') + e }
    return x;
  }
  /* links del almacenamiento: se agrega ?download=<nombre> (el archivo guardado no se toca) */
  const esStorage = (u) => /\/storage\/v1\/object\/(public|sign)\//.test(String(u || ''));
  function urlDescarga(u, nombre) {
    if (!u || !nombre || !esStorage(u) || /[?&]download=/.test(u)) return u;
    return u + (u.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(nombre);
  }
  /* bajar un blob con su nombre (en lugar de abrirlo sin nombre) */
  function bajarBlob(blob, nombre) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = nombre; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000) }
  /* cualquier link a un archivo del almacenamiento: al tocarlo baja con el nombre que le corresponde.
     Cada app define window.__nombreDeUrl(url) → nombre (busca el documento o el adjunto en sus datos). */
  document.addEventListener('click', (ev) => {
    const a = ev.target && ev.target.closest && ev.target.closest('a[href]'); if (!a) return;
    const u = a.getAttribute('href'); if (!esStorage(u) || /[?&]download=/.test(u)) return;
    let n = a.dataset.dl || ''; if (!n && typeof window.__nombreDeUrl === 'function') { try { n = window.__nombreDeUrl(u.split('?')[0]) || '' } catch (e) { n = '' } }
    if (n) a.setAttribute('href', urlDescarga(u, n));
  }, true);
  /* los avisos de contratistas (en las dos apps tienen la misma forma) */
  const TIPO_AV = { material: 'Aviso falta de material', definicion: 'Aviso falta de definición', retraso: 'Aviso de retraso', adicional: 'Adicional', otro: 'Aviso', presupuesto: 'Presupuesto', materiales: 'Listado de materiales', noconv: 'Constancia tarea no convencional' };
  function docAviso(it, obraNombre) {
    it = it || {}; const cump = it.tipo === 'auditoria' && it.aud && it.aud.inf;
    const tipo = it.tipo === 'auditoria' ? (cump ? 'Auditoria cumplimiento semanal' : 'Auditoria de obra') : (TIPO_AV[it.tipo] || 'Aviso');
    const titulo = it.tipo === 'noconv' ? ((it.nc && it.nc.tareaNom) || it.tarea || '') : it.tipo === 'auditoria' ? '' : (it.titulo || '');
    return { tipo, num: it.num, obra: obraNombre || it.obraNombre || '', titulo, fecha: it.creado };
  }
  window.docAvisoPdf = docAviso;
  window.nombrePdf = nombrePdf; window.nombreAdjunto = nombreAdjunto; window.urlDescarga = urlDescarga; window.bajarBlob = bajarBlob; window.pdfTipoTitulo = tipoTitulo;
})();
export const nombrePdf = window.nombrePdf, docAvisoPdf = window.docAvisoPdf, urlDescarga = window.urlDescarga;
