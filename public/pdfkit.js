/* PDF-02 · armado común de los PDF hechos con jsPDF (Contratistas y constancias):
   filas de tabla con alto calculado, títulos que no quedan solos al pie y fotos que aprovechan el espacio. Medidas en mm. */
(function () {
  /* foto → JPEG comprimido (calidad 0,75, lado mayor 1600 px). Devuelve null si no se puede leer. */
  async function imgJpeg(u) {
    try {
      const b = await (await fetch(u)).blob();
      const url = URL.createObjectURL(b);
      const r = await new Promise((ok) => { const i = new Image(); i.onload = () => { try { const M = 1600, k = Math.min(1, M / Math.max(i.naturalWidth, i.naturalHeight)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(i.naturalWidth * k)); c.height = Math.max(1, Math.round(i.naturalHeight * k)); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); ok({ d: c.toDataURL('image/jpeg', 0.75), w: c.width, h: c.height }) } catch (e) { ok(null) } }; i.onerror = () => ok(null); i.src = url });
      URL.revokeObjectURL(url); return r;
    } catch (e) { return null }
  }
  /* L: estado del documento { d, y, M, W, top, bot } */
  const nueva = (L) => { L.d.addPage(); L.y = L.top };
  const libre = (L) => L.bot - L.y;
  /* título de sección: si después no entra lo mínimo (minCont mm), pasa a la hoja siguiente junto con su contenido */
  function titulo(L, t, minCont, dibujar) { const h = 10; if (libre(L) < h + (minCont || 14)) nueva(L); dibujar(t); }
  /* tabla: alto de cada fila según el texto real + 2,5 mm arriba y abajo; nunca dos textos en la misma línea de una celda */
  function tabla(L, o) {
    const { d } = L, X = [], CW = L.W - 2 * L.M; let x = L.M; o.w.forEach((p) => { X.push(x); x += p * CW });
    const pad = 2.5, lh = (o.fs || 9) * 0.42, fs = o.fs || 9;
    const enc = () => { d.setFont('helvetica', 'bold'); d.setFontSize(fs - 0.5); const C = o.cols.map((c, k) => d.splitTextToSize(String(c), o.w[k] * CW - 4)); const h = Math.max(...C.map((c) => c.length)) * lh + 2 * pad; if (libre(L) < h + 12) nueva(L); d.setFillColor(...(o.encColor || [15, 27, 45])); d.rect(L.M, L.y, CW, h, 'F'); d.setTextColor(255, 255, 255); C.forEach((c, k) => c.forEach((z, j) => d.text(z, X[k] + 2, L.y + pad + lh * 0.8 + j * lh))); L.y += h };
    enc();
    o.rows.forEach((r, ri) => {
      d.setFontSize(fs); const C = r.cells.map((c, k) => { d.setFont('helvetica', (r.b || (o.boldCol === k)) ? 'bold' : 'normal'); return d.splitTextToSize(String(c == null ? '' : c), o.w[k] * CW - 4) });
      const h = Math.max(...C.map((c) => c.length)) * lh + 2 * pad;
      if (libre(L) < h) { nueva(L); enc() }
      if (ri % 2 === 0) { d.setFillColor(245, 242, 236); d.rect(L.M, L.y, CW, h, 'F') }
      d.setTextColor(30, 30, 30);
      C.forEach((c, k) => { d.setFont('helvetica', (r.b || (o.boldCol === k)) ? 'bold' : 'normal'); c.forEach((z, j) => d.text(z, X[k] + 2, L.y + pad + lh * 0.8 + j * lh)) });
      d.setDrawColor(225, 220, 210); d.setLineWidth(0.2); d.line(L.M, L.y + h, L.M + CW, L.y + h);
      L.y += h;
    });
  }
  /* fotos en grilla: 2 por fila (3 si son más de 6), proporción real, centradas, fecha debajo.
     Si la fila no entra en lo que queda de la hoja se achica (hasta 50 %); recién si ni así entra, pasa de hoja. */
  async function fotos(L, lista, o) {
    o = o || {}; const { d } = L, CW = L.W - 2 * L.M, N = lista.length;
    const cols = o.cols || (N > 6 ? 3 : 2), gap = 5, cw = (CW - gap * (cols - 1)) / cols, hMax = o.hMax || (cols === 3 ? 58 : 85), cap = 4.5;
    const ims = await Promise.all(lista.map((f) => imgJpeg(f.u || f)));
    for (let k = 0; k < N; k += cols) {
      const fila = lista.slice(k, k + cols), im = ims.slice(k, k + cols);
      const dims = im.map((x) => { if (!x) return { w: cw * 0.6, h: 22 }; let w = cw, h = cw * x.h / x.w; if (h > hMax) { h = hMax; w = h * x.w / x.h } return { w, h } });
      const alto = Math.max(...dims.map((z) => z.h)), rowH = alto + cap + 2;
      let s = 1;
      if (rowH > libre(L)) { const s2 = (libre(L) - cap - 2) / alto; if (s2 >= 0.5) s = s2; else { nueva(L) } }
      fila.forEach((f, j) => {
        const x0 = L.M + j * (cw + gap), z = dims[j], w = z.w * s, h = z.h * s, x = x0 + (cw - w) / 2, y = L.y + (alto * s - h) / 2;
        if (im[j]) { try { d.addImage(im[j].d, 'JPEG', x, y, w, h) } catch (e) {} }
        else { d.setDrawColor(200, 190, 175); d.setLineWidth(0.3); d.rect(x, y, w, h); d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(140, 130, 120); d.text(d.splitTextToSize('Foto ' + (k + j + 1) + ': no se pudo leer la imagen', w - 4), x + 2, y + 6) }
        const fe = f.fecha || o.fecha || ''; if (fe) { d.setFont('helvetica', 'normal'); d.setFontSize(7.5); d.setTextColor(110, 105, 95); d.text(String(fe), x0 + cw / 2, L.y + alto * s + 3.6, { align: 'center' }) }
      });
      L.y += alto * s + cap + 2;
    }
    return N;
  }
  window.PK = { imgJpeg, titulo, tabla, fotos, nueva, libre };
})();
