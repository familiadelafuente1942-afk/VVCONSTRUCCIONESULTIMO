import React, { useState, useEffect, useRef } from "react";
// VERSION: v1 (Muebles: despiece automatico + optimizador de cortes + render 3D)

// V+V MUEBLES — Diseño y corte de muebles de cocina y placares (placa 18 mm)
// Cargás medidas → render 3D → despiece automático → optimización de cortes en placas → PDF para el aserradero.

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const SH = () => ({ "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY });
const storage = {
  set: async (key, value) => { try { localStorage.setItem(key, value); } catch { } try { await fetch(SUPA_URL + "/rest/v1/bco_storage", { method: "POST", headers: { ...SH(), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ key, value }) }); } catch { } return { value }; },
  get: async (key) => { try { const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { method: "GET", headers: SH(), mode: "cors" }); if (r.ok) { const d = await r.json(); if (d && d.length > 0) return { value: d[0].value }; } } catch { } try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; } },
};
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };
const mm = (n) => Math.round(n) + "";
const money = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fmtISO = (iso) => { if (!iso) return "—"; const [y, m, d] = String(iso).split("-"); return d && m && y ? `${d}/${m}/${y}` : iso; };

const BRASS = "#B0894F";
const T = { navy: "#0B1622", accent: "#1B3A5B", al: "#EEF2F7", bg: "#F5F5F7", card: "#FFFFFF", border: "#E8EAED", text: "#0B1622", sub: "#5B6673", muted: "#98A2B0", ok: "#16A34A", warn: "#B45309", rsm: 12, inpBg: "#FBFBFD" };
const inp = { width: "100%", background: T.inpBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 13px", fontSize: 16, color: T.text, boxSizing: "border-box", marginTop: 6, outline: "none", fontVariantNumeric: "tabular-nums" };
const inpSm = { background: T.inpBg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 8px", fontSize: 15, color: T.text, boxSizing: "border-box", outline: "none" };
const SHD = "0 6px 22px rgba(15,27,45,.09)";
const SHDsm = "0 2px 8px rgba(15,27,45,.05)";
const PALETA = ["#1B3A5B", "#B0894F", "#3D7EA6", "#7A9E7E", "#C1666B", "#6B5B95", "#4E8098", "#A67C52", "#5C946E", "#8E7C93", "#D08C60", "#4A6FA5", "#9A8C98", "#6E8894"];

// ---------- CONFIG DEFAULT ----------
const CFG_DEF = {
  placaW: 1830, placaH: 2600, kerf: 4, esp: 18, espFondo: 3,
  veta: false, luz: 3, retranqueo: 20, holgura: 2, correderaLuz: 13,
  precioPlaca: 0, precioCanto: 0, cantoEsp: 22, descontarFondo: true, travesanoH: 100,
};
const TIPOS = [["bajo", "Bajo mesada"], ["alacena", "Alacena"], ["placard", "Placard"], ["cajonera", "Cajonera"], ["generico", "Genérico"]];
const DEF_TIPO = {
  bajo: { ancho: 600, alto: 860, prof: 580, zocalo: 100, estantes: 1, puertas: 1, cajones: 0, techoTravesanos: true, armado: "lat" },
  alacena: { ancho: 600, alto: 700, prof: 320, zocalo: 0, estantes: 1, puertas: 1, cajones: 0, techoTravesanos: false, armado: "lat" },
  placard: { ancho: 1200, alto: 2400, prof: 600, zocalo: 80, estantes: 3, puertas: 2, cajones: 0, techoTravesanos: false, armado: "lat" },
  cajonera: { ancho: 600, alto: 860, prof: 580, zocalo: 100, estantes: 0, puertas: 0, cajones: 3, techoTravesanos: true, armado: "lat" },
  generico: { ancho: 600, alto: 800, prof: 400, zocalo: 0, estantes: 1, puertas: 0, cajones: 0, techoTravesanos: false, armado: "lat" },
};

// ---------- DESPIECE ----------
// Devuelve piezas: {nombre, w, h, cant, mat:"placa"|"fondo", canto:mm lineales por pieza}
function despiece(m, cfg) {
  const e = num(cfg.esp) || 18, ef = num(cfg.espFondo) || 3;
  const A = num(m.ancho), H = num(m.alto), P = num(m.prof);
  const z = num(m.zocalo) || 0;
  const Hc = Math.max(0, H - z);                       // alto de carcasa
  const Pc = Math.max(0, cfg.descontarFondo && m.fondo !== false ? P - ef : P); // prof de carcasa
  const L = num(cfg.luz) || 3, RT = num(cfg.retranqueo) || 0, HG = num(cfg.holgura) || 0;
  const p = [];
  const add = (nombre, w, h, cant, mat, canto) => { if (w > 0 && h > 0 && cant > 0) p.push({ nombre, w: Math.round(w), h: Math.round(h), cant, mat: mat || "placa", canto: Math.round(canto || 0) }); };

  if (m.armado === "tp") {
    // Techo y piso enteros; laterales entre ellos
    add("Techo", A, Pc, 1, "placa", A);
    add("Piso", A, Pc, 1, "placa", A);
    add("Lateral", Pc, Math.max(0, Hc - 2 * e), 2, "placa", Math.max(0, Hc - 2 * e));
  } else {
    // Laterales enteros; techo y piso entre ellos
    add("Lateral", Pc, Hc, 2, "placa", Hc);
    add("Piso", Math.max(0, A - 2 * e), Pc, 1, "placa", Math.max(0, A - 2 * e));
    if (m.techoTravesanos) add("Travesaño", Math.max(0, A - 2 * e), num(cfg.travesanoH) || 100, 2, "placa", Math.max(0, A - 2 * e));
    else add("Techo", Math.max(0, A - 2 * e), Pc, 1, "placa", Math.max(0, A - 2 * e));
  }
  // Estantes
  const nEst = num(m.estantes);
  if (nEst > 0) add("Estante", Math.max(0, A - 2 * e - HG), Math.max(0, Pc - RT), nEst, "placa", Math.max(0, A - 2 * e - HG));
  // Fondo aplicado atrás
  if (m.fondo !== false) add("Fondo", A, Hc, 1, "fondo", 0);
  // Zócalo
  if (z > 0) add("Zócalo", A, z, 1, "placa", A);
  // Puertas
  const nPu = num(m.puertas);
  if (nPu > 0) {
    const anchoPu = (A - (nPu - 1) * L - 2 * 1) / nPu;
    const altoPu = Math.max(0, Hc - 2 * 1);
    add(nPu > 1 ? "Puerta" : "Puerta", anchoPu, altoPu, nPu, "placa", 2 * (anchoPu + altoPu));
  }
  // Cajones
  const nCj = num(m.cajones);
  if (nCj > 0) {
    const altoFr = (Hc - (nCj + 1) * L) / nCj;
    const anchoFr = A - 2 * 1;
    add("Frente cajón", anchoFr, altoFr, nCj, "placa", 2 * (anchoFr + altoFr));
    const anchoInt = Math.max(0, A - 2 * e - 2 * (num(cfg.correderaLuz) || 13));
    const profCaja = Math.max(0, Pc - 30);
    const altoCaja = Math.max(80, Math.min(220, altoFr - 40));
    add("Cajón · lateral", profCaja, altoCaja, nCj * 2, "placa", altoCaja);
    add("Cajón · frente/contra", Math.max(0, anchoInt - 2 * e), altoCaja, nCj * 2, "placa", altoCaja);
    add("Cajón · piso", anchoInt, profCaja, nCj, "fondo", 0);
  }
  const cant = Math.max(1, num(m.cant) || 1);
  return p.map(x => ({ ...x, cant: x.cant * cant, mueble: m.nombre || "Mueble" }));
}

// ---------- OPTIMIZADOR DE CORTES (guillotina, best-area-fit) ----------
function optimizar(piezas, cfg, mat) {
  const PW = num(cfg.placaW) || 1830, PH = num(cfg.placaH) || 2600, K = num(cfg.kerf) || 0;
  const veta = !!cfg.veta;
  const items = [];
  piezas.filter(p => (p.mat || "placa") === mat).forEach((p, idx) => {
    for (let i = 0; i < p.cant; i++) items.push({ id: p.nombre + "-" + idx + "-" + i, nombre: p.nombre, mueble: p.mueble, w: p.w, h: p.h, ci: idx });
  });
  // Ordenar por área desc (mejor empaque)
  items.sort((a, b) => (b.w * b.h) - (a.w * a.h) || Math.max(b.w, b.h) - Math.max(a.w, a.h));
  const placas = []; const noEntran = [];
  const nuevaPlaca = () => { const pl = { libres: [{ x: 0, y: 0, w: PW, h: PH }], piezas: [] }; placas.push(pl); return pl; };

  for (const it of items) {
    if ((it.w > PW && it.h > PW) || (it.w > PH && it.h > PH) || (Math.min(it.w, it.h) > Math.min(PW, PH)) || (Math.max(it.w, it.h) > Math.max(PW, PH))) { noEntran.push(it); continue; }
    let mejor = null;
    for (const pl of placas) {
      for (let i = 0; i < pl.libres.length; i++) {
        const fr = pl.libres[i];
        const opts = veta ? [[it.w, it.h, false]] : [[it.w, it.h, false], [it.h, it.w, true]];
        for (const [w, h, rot] of opts) {
          const pw = w + K, ph = h + K;
          if (pw <= fr.w + 0.001 && ph <= fr.h + 0.001) {
            const sobra = fr.w * fr.h - pw * ph;
            if (!mejor || sobra < mejor.sobra) mejor = { pl, i, fr, w, h, rot, sobra };
          }
        }
      }
    }
    if (!mejor) {
      const pl = nuevaPlaca(); const fr = pl.libres[0];
      const opts = veta ? [[it.w, it.h, false]] : [[it.w, it.h, false], [it.h, it.w, true]];
      let ok = null;
      for (const [w, h, rot] of opts) { if (w + K <= fr.w + 0.001 && h + K <= fr.h + 0.001) { ok = { pl, i: 0, fr, w, h, rot, sobra: 0 }; break; } }
      if (!ok) { noEntran.push(it); placas.pop(); continue; }
      mejor = ok;
    }
    const { pl, i, fr, w, h, rot } = mejor;
    const pw = w + K, ph = h + K;
    pl.piezas.push({ x: fr.x, y: fr.y, w, h, rot, nombre: it.nombre, mueble: it.mueble, ci: it.ci });
    pl.libres.splice(i, 1);
    const derecha = { x: fr.x + pw, y: fr.y, w: fr.w - pw, h: ph };
    const abajo = { x: fr.x, y: fr.y + ph, w: fr.w, h: fr.h - ph };
    if (derecha.w > 10 && derecha.h > 10) pl.libres.push(derecha);
    if (abajo.w > 10 && abajo.h > 10) pl.libres.push(abajo);
    pl.libres.sort((a, b) => (a.w * a.h) - (b.w * b.h));
  }
  const areaPiezas = placas.reduce((s, pl) => s + pl.piezas.reduce((a, p) => a + p.w * p.h, 0), 0);
  const areaTotal = placas.length * PW * PH;
  const uso = areaTotal > 0 ? (areaPiezas / areaTotal) * 100 : 0;
  return { placas, uso, desperdicio: 100 - uso, noEntran, PW, PH };
}

// ---------- RENDER 3D (proyección oblicua en SVG) ----------
function Render3D({ m, cfg, abierto }) {
  const e = num(cfg.esp) || 18, ef = num(cfg.espFondo) || 3;
  const A = num(m.ancho) || 1, H = num(m.alto) || 1, P = num(m.prof) || 1;
  const z = num(m.zocalo) || 0, Hc = Math.max(1, H - z);
  const Pc = Math.max(1, cfg.descontarFondo && m.fondo !== false ? P - ef : P);
  const DX = 0.45, DY = 0.30;
  const px = (x, y, zz) => x + DX * zz;
  const py = (x, y, zz) => (H - y) - DY * zz;
  const pt = (x, y, zz) => `${px(x, y, zz).toFixed(1)},${py(x, y, zz).toFixed(1)}`;
  const quad = (a, b, c, d, fill, op, stroke) => <polygon points={`${pt(...a)} ${pt(...b)} ${pt(...c)} ${pt(...d)}`} fill={fill} fillOpacity={op == null ? 1 : op} stroke={stroke || "#2A3542"} strokeWidth="2.2" strokeLinejoin="round" />;
  const MEL = "#E4D5BE", MEL_D = "#C9B492", MEL_L = "#F1E7D6", FRENTE = "#D8C7AC", INT = "#EFE6D6";
  const W = px(A, 0, Pc) + 20, HH = py(0, 0, 0) + 20;
  const minX = Math.min(px(0, 0, 0), px(0, 0, Pc)) - 10, minY = Math.min(py(0, H, Pc), py(0, H, 0)) - 10;
  const nPu = num(m.puertas), nCj = num(m.cajones), nEst = num(m.estantes);
  const est = []; for (let i = 1; i <= nEst; i++) est.push(z + (Hc / (nEst + 1)) * i);
  const piezas = [];
  // Fondo (atrás)
  piezas.push(<g key="fondo">{quad([0, z, Pc], [A, z, Pc], [A, z + Hc, Pc], [0, z + Hc, Pc], INT, 1)}</g>);
  // Interior: estantes
  est.forEach((yy, i) => piezas.push(<g key={"est" + i}>
    {quad([e, yy, 0], [A - e, yy, 0], [A - e, yy, Pc], [e, yy, Pc], MEL_L, 1)}
    {quad([e, yy - e, 0], [A - e, yy - e, 0], [A - e, yy, 0], [e, yy, 0], MEL_D, 1)}
  </g>));
  // Piso y techo
  piezas.push(<g key="piso">{quad([0, z + e, 0], [A, z + e, 0], [A, z + e, Pc], [0, z + e, Pc], MEL_L, 1)}</g>);
  if (!m.techoTravesanos) piezas.push(<g key="techo">{quad([0, z + Hc - e, 0], [A, z + Hc - e, 0], [A, z + Hc - e, Pc], [0, z + Hc - e, Pc], MEL_L, 1)}</g>);
  else piezas.push(<g key="trav">{quad([e, z + Hc - e, 0], [A - e, z + Hc - e, 0], [A - e, z + Hc - e, 90], [e, z + Hc - e, 90], MEL_L, 1)}{quad([e, z + Hc - e, Pc - 90], [A - e, z + Hc - e, Pc - 90], [A - e, z + Hc - e, Pc], [e, z + Hc - e, Pc], MEL_L, 1)}</g>);
  // Laterales
  piezas.push(<g key="lat">
    {quad([0, z, 0], [0, z, Pc], [0, z + Hc, Pc], [0, z + Hc, 0], MEL_D, 1)}
    {quad([A, z, 0], [A, z, Pc], [A, z + Hc, Pc], [A, z + Hc, 0], MEL, 1)}
    {quad([A - e, z, 0], [A, z, 0], [A, z + Hc, 0], [A - e, z + Hc, 0], MEL_D, 1)}
    {quad([0, z, 0], [e, z, 0], [e, z + Hc, 0], [0, z + Hc, 0], MEL_D, 1)}
  </g>);
  // Zócalo
  if (z > 0) piezas.push(<g key="zoc">{quad([0, 0, 0], [A, 0, 0], [A, z, 0], [0, z, 0], "#8C99A6", 1)}</g>);
  // Frentes
  if (!abierto) {
    if (nCj > 0) {
      const L = num(cfg.luz) || 3, altoFr = (Hc - (nCj + 1) * L) / nCj;
      for (let i = 0; i < nCj; i++) { const y0 = z + L + i * (altoFr + L); piezas.push(<g key={"cj" + i}>{quad([1, y0, 0], [A - 1, y0, 0], [A - 1, y0 + altoFr, 0], [1, y0 + altoFr, 0], FRENTE, 1)}<line x1={px(A / 2 - 60, 0, 0)} y1={py(0, y0 + altoFr / 2, 0)} x2={px(A / 2 + 60, 0, 0)} y2={py(0, y0 + altoFr / 2, 0)} stroke="#8A7A62" strokeWidth="5" strokeLinecap="round" /></g>); }
    }
    if (nPu > 0) {
      const L = num(cfg.luz) || 3, aPu = (A - (nPu - 1) * L - 2) / nPu;
      for (let i = 0; i < nPu; i++) { const x0 = 1 + i * (aPu + L); piezas.push(<g key={"pu" + i}>{quad([x0, z + 1, 0], [x0 + aPu, z + 1, 0], [x0 + aPu, z + Hc - 1, 0], [x0, z + Hc - 1, 0], FRENTE, 0.94)}<circle cx={px(x0 + (i === 0 && nPu > 1 ? aPu - 35 : 35), 0, 0)} cy={py(0, z + Hc / 2, 0)} r="9" fill="#6E6053" /></g>); }
    }
  }
  const vbW = Math.max(1, W - minX), vbH = Math.max(1, HH - minY);
  return <div style={{ background: "#F7F4EE", borderRadius: 14, padding: 10, border: `1px solid ${T.border}` }}>
    <svg viewBox={`${minX} ${minY} ${vbW} ${vbH}`} style={{ width: "100%", height: "auto", maxHeight: 340, display: "block" }} preserveAspectRatio="xMidYMid meet">{piezas}</svg>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.muted, marginTop: 6, padding: "0 4px" }}>
      <span>Ancho {mm(A)} · Alto {mm(H)} · Prof {mm(P)} mm</span>
      <span>{abierto ? "Interior" : "Cerrado"}</span>
    </div>
  </div>;
}

// ---------- PLANO DE CORTE ----------
function PlacaSVG({ pl, PW, PH, n, total }) {
  const esc = 100 / PW;
  return <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 10, marginBottom: 10, boxShadow: SHDsm }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 800 }}>Placa {n} de {total}</span>
      <span style={{ fontSize: 10.5, color: T.muted }}>{PW} × {PH} mm · {pl.piezas.length} piezas</span>
    </div>
    <svg viewBox={`-8 -8 ${PW + 16} ${PH + 16}`} style={{ width: "100%", height: "auto", maxHeight: 420, display: "block", background: "#FBFBFD", borderRadius: 6 }} preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width={PW} height={PH} fill="#FFFFFF" stroke="#94A3B8" strokeWidth="6" />
      {pl.piezas.map((p, i) => {
        const c = PALETA[p.ci % PALETA.length];
        const chico = Math.min(p.w, p.h) < 190;
        return <g key={i}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={c} fillOpacity="0.20" stroke={c} strokeWidth="5" />
          {!chico && <text x={p.x + p.w / 2} y={p.y + p.h / 2 - 22} textAnchor="middle" fontSize="46" fontWeight="700" fill={c}>{p.nombre}</text>}
          <text x={p.x + p.w / 2} y={p.y + p.h / 2 + (chico ? 16 : 34)} textAnchor="middle" fontSize={chico ? 40 : 44} fill="#334155" fontWeight="600">{mm(p.w)}×{mm(p.h)}{p.rot ? " ↻" : ""}</text>
        </g>;
      })}
    </svg>
  </div>;
}

// ---------- PDF ----------
function PdfOverlay({ html, onClose }) {
  const ref = useRef(null);
  const imprimir = () => { try { const w = ref.current && ref.current.contentWindow; if (w) { w.focus(); w.print(); } } catch { alert("No se pudo abrir la impresión."); } };
  return <div style={{ position: "fixed", inset: 0, background: T.navy, zIndex: 500, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: T.navy, borderBottom: "1px solid rgba(255,255,255,.1)", alignItems: "center" }}>
      <button onClick={onClose} style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕</button>
      <button onClick={imprimir} style={{ background: BRASS, color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Guardar / Imprimir</button>
    </div>
    <iframe ref={ref} srcDoc={html} title="pdf" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
  </div>;
}

function svgPlacaHTML(pl, PW, PH, n, total) {
  const piezas = pl.piezas.map(p => {
    const c = PALETA[p.ci % PALETA.length]; const chico = Math.min(p.w, p.h) < 190;
    return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="5"/>` +
      (chico ? "" : `<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 - 22}" text-anchor="middle" font-size="46" font-weight="700" fill="${c}">${p.nombre}</text>`) +
      `<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + (chico ? 16 : 34)}" text-anchor="middle" font-size="44" fill="#334155" font-weight="600">${mm(p.w)}×${mm(p.h)}${p.rot ? " ↻" : ""}</text>`;
  }).join("");
  return `<div class="placa"><div class="ph">Placa ${n} de ${total} · ${PW}×${PH} mm · ${pl.piezas.length} piezas</div>
  <svg viewBox="-8 -8 ${PW + 16} ${PH + 16}" width="100%" style="max-height:640px"><rect x="0" y="0" width="${PW}" height="${PH}" fill="#fff" stroke="#94A3B8" stroke-width="6"/>${piezas}</svg></div>`;
}

function reporteHTML(proyecto, cfg, piezas, resPlaca, resFondo, resumen) {
  const filas = piezas.map(p => `<tr><td>${p.mueble}</td><td>${p.nombre}</td><td class="r">${mm(p.w)}</td><td class="r">${mm(p.h)}</td><td class="r">${p.cant}</td><td>${p.mat === "fondo" ? "Fondo " + cfg.espFondo + "mm" : "Placa " + cfg.esp + "mm"}</td></tr>`).join("");
  const placas = resPlaca.placas.map((pl, i) => svgPlacaHTML(pl, resPlaca.PW, resPlaca.PH, i + 1, resPlaca.placas.length)).join("");
  const fondos = resFondo.placas.map((pl, i) => svgPlacaHTML(pl, resFondo.PW, resFondo.PH, i + 1, resFondo.placas.length)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Despiece y corte</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,'Segoe UI',system-ui,sans-serif;color:#0B1622;padding:26px 30px 40px;font-size:12px}
.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${BRASS};padding-bottom:10px;margin-bottom:14px}
.hd h1{font-size:19px;letter-spacing:-.01em}.hd .sub{font-size:10px;color:#5B6673;text-transform:uppercase;letter-spacing:.12em;font-weight:700}
h2{font-size:13px;margin:18px 0 8px;color:#1B3A5B;text-transform:uppercase;letter-spacing:.06em}
table{width:100%;border-collapse:collapse;font-size:11px}th{background:#EEF2F7;text-align:left;padding:6px 7px;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#5B6673}
td{padding:6px 7px;border-bottom:1px solid #E8EAED}td.r{text-align:right;font-variant-numeric:tabular-nums}
.kpis{display:flex;gap:10px;margin:10px 0 4px}.kpi{flex:1;background:#EEF2F7;border-radius:8px;padding:9px 11px}
.kpi b{display:block;font-size:17px;color:#1B3A5B}.kpi span{font-size:9.5px;color:#5B6673;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
.placa{page-break-inside:avoid;margin-bottom:14px;border:1px solid #E8EAED;border-radius:8px;padding:8px}
.ph{font-size:11px;font-weight:700;margin-bottom:5px;color:#1B3A5B}
@media print{.placa{page-break-inside:avoid}}
</style></head><body>
<div class="hd"><div><h1>${proyecto || "Proyecto de muebles"}</h1><div class="sub">V+V · Despiece y plan de corte</div></div><div style="text-align:right;font-size:10.5px;color:#5B6673">${fmtISO(hoyISO())}<br/>Placa ${cfg.placaW}×${cfg.placaH} · ${cfg.esp}mm<br/>Sierra ${cfg.kerf}mm${cfg.veta ? " · Veta respetada" : ""}</div></div>
<div class="kpis"><div class="kpi"><span>Placas ${cfg.esp}mm</span><b>${resumen.nPlacas}</b></div><div class="kpi"><span>Placas fondo</span><b>${resumen.nFondos}</b></div><div class="kpi"><span>Aprovechamiento</span><b>${resumen.uso.toFixed(1)}%</b></div><div class="kpi"><span>Canto ${cfg.cantoEsp}mm</span><b>${resumen.cantoMl.toFixed(1)} m</b></div></div>
${resumen.costo > 0 ? `<div style="font-size:11px;margin:8px 0;color:#5B6673">Costo estimado de materiales: <b style="color:#0B1622;font-size:13px">${money(resumen.costo)}</b></div>` : ""}
<h2>Despiece de piezas</h2>
<table><thead><tr><th>Mueble</th><th>Pieza</th><th style="text-align:right">Ancho</th><th style="text-align:right">Alto</th><th style="text-align:right">Cant.</th><th>Material</th></tr></thead><tbody>${filas}</tbody></table>
<h2>Plan de corte · placas ${cfg.esp}mm</h2>${placas || "<p style='font-size:11px;color:#5B6673'>Sin piezas.</p>"}
${resFondo.placas.length ? `<h2>Plan de corte · fondos ${cfg.espFondo}mm</h2>${fondos}` : ""}
${resPlaca.noEntran.length || resFondo.noEntran.length ? `<p style="color:#B45309;font-size:11px;margin-top:10px"><b>Atención:</b> ${resPlaca.noEntran.length + resFondo.noEntran.length} pieza(s) no entran en la placa. Revisá las medidas.</p>` : ""}
</body></html>`;
}

// ---------- APP ----------
export default function Muebles() {
  const [cargando, setCargando] = useState(true);
  const [proyecto, setProyecto] = useState("");
  const [muebles, setMuebles] = useState([]);
  const [cfg, setCfg] = useState(CFG_DEF);
  const [tab, setTab] = useState("muebles");
  const [form, setForm] = useState(null);
  const [abierto, setAbierto] = useState({});
  const [pdfHtml, setPdfHtml] = useState(null);
  const [verCfg, setVerCfg] = useState(false);

  useEffect(() => { (async () => { try { const r = await storage.get("vv_muebles"); if (r && r.value) { const d = JSON.parse(r.value); setProyecto(d.proyecto || ""); setMuebles(d.muebles || []); setCfg({ ...CFG_DEF, ...(d.cfg || {}) }); } } catch { } setCargando(false); })(); }, []);
  const guardar = (next) => { const d = { proyecto: next.proyecto != null ? next.proyecto : proyecto, muebles: next.muebles || muebles, cfg: next.cfg || cfg }; if (next.proyecto != null) setProyecto(next.proyecto); if (next.muebles) setMuebles(next.muebles); if (next.cfg) setCfg(next.cfg); try { storage.set("vv_muebles", JSON.stringify(d)); } catch { } };

  const nuevo = (tipo) => { const d = DEF_TIPO[tipo] || DEF_TIPO.generico; setForm({ id: "", tipo, nombre: (TIPOS.find(t => t[0] === tipo) || [])[1] || "Mueble", cant: 1, fondo: true, ...d }); };
  const editar = (m) => setForm({ ...m });
  const guardarMueble = () => {
    if (!form) return;
    if (!num(form.ancho) || !num(form.alto) || !num(form.prof)) { alert("Cargá ancho, alto y profundidad."); return; }
    const m = { ...form, id: form.id || uid() };
    guardar({ muebles: form.id ? muebles.map(x => x.id === form.id ? m : x) : [...muebles, m] });
    setForm(null);
  };
  const borrarMueble = (id) => { if (confirm("¿Eliminar este mueble?")) guardar({ muebles: muebles.filter(m => m.id !== id) }); };

  // Cálculos
  const piezas = muebles.flatMap(m => despiece(m, cfg));
  const resPlaca = optimizar(piezas, cfg, "placa");
  const resFondo = optimizar(piezas, { ...cfg, veta: false }, "fondo");
  const cantoMl = piezas.reduce((s, p) => s + (p.canto * p.cant), 0) / 1000;
  const costo = resPlaca.placas.length * num(cfg.precioPlaca) + cantoMl * num(cfg.precioCanto);
  const resumen = { nPlacas: resPlaca.placas.length, nFondos: resFondo.placas.length, uso: resPlaca.uso, cantoMl, costo };
  const totalPiezas = piezas.reduce((s, p) => s + p.cant, 0);

  if (cargando) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 13 }}>Cargando…</div>;

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setC = (k, v) => guardar({ cfg: { ...cfg, [k]: v } });

  return <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", color: T.text }}>
    <style>{`*{-webkit-font-smoothing:antialiased}*:focus{outline:none}body{margin:0}input:focus,select:focus{border-color:${BRASS}!important}button{-webkit-tap-highlight-color:transparent}`}</style>
    <div style={{ background: `linear-gradient(180deg, #0E1B2B 0%, ${T.navy} 100%)`, color: "#fff", padding: "18px 20px 16px", textAlign: "center", position: "relative" }}>
      <button onClick={() => setVerCfg(true)} style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 9, width: 34, height: 34, fontSize: 15, cursor: "pointer" }}>⚙︎</button>
      <div style={{ fontSize: 16, fontWeight: 700 }}>V+V Muebles</div>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: BRASS, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 2 }}>Despiece y optimización de cortes</div>
    </div>
    <div style={{ display: "flex", background: "rgba(255,255,255,.9)", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 40 }}>
      {[["muebles", "Muebles"], ["despiece", "Despiece"], ["cortes", "Cortes"]].map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} style={{ flex: 1, background: "none", border: "none", color: tab === k ? T.text : T.muted, padding: "12px 2px 10px", fontSize: 12.5, fontWeight: tab === k ? 700 : 600, cursor: "pointer", position: "relative" }}>{l}{tab === k && <span style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 26, height: 2.5, background: BRASS, borderRadius: "2px 2px 0 0" }} />}</button>
      ))}
    </div>

    {/* MUEBLES */}
    {tab === "muebles" && <div style={{ padding: "14px 16px 40px" }}>
      <input value={proyecto} onChange={e => guardar({ proyecto: e.target.value })} placeholder="Nombre del proyecto (ej: Cocina Canning 815)" style={{ ...inp, marginTop: 0, marginBottom: 12, fontWeight: 700 }} />
      {muebles.length > 0 && <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 11, padding: "10px 12px", boxShadow: SHDsm }}><div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Placas {cfg.esp}mm</div><div style={{ fontSize: 20, fontWeight: 800, color: T.accent }}>{resumen.nPlacas}</div></div>
        <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 11, padding: "10px 12px", boxShadow: SHDsm }}><div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Aprovech.</div><div style={{ fontSize: 20, fontWeight: 800, color: resumen.uso > 75 ? T.ok : T.warn }}>{resumen.uso.toFixed(0)}%</div></div>
        <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 11, padding: "10px 12px", boxShadow: SHDsm }}><div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Piezas</div><div style={{ fontSize: 20, fontWeight: 800 }}>{totalPiezas}</div></div>
      </div>}

      {muebles.map(m => { const ab = !!abierto[m.id]; return <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 15, padding: 13, marginBottom: 12, boxShadow: SHDsm }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{m.nombre}{num(m.cant) > 1 ? ` ×${m.cant}` : ""}</div>
            <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>{mm(m.ancho)} × {mm(m.alto)} × {mm(m.prof)} mm · {(TIPOS.find(t => t[0] === m.tipo) || [])[1]}</div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{num(m.estantes) > 0 ? `${m.estantes} estante(s) · ` : ""}{num(m.puertas) > 0 ? `${m.puertas} puerta(s) · ` : ""}{num(m.cajones) > 0 ? `${m.cajones} cajón(es) · ` : ""}{m.armado === "tp" ? "techo/piso enteros" : "laterales enteros"}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => editar(m)} style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Editar</button>
            <button onClick={() => borrarMueble(m.id)} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>✕</button>
          </div>
        </div>
        <Render3D m={m} cfg={cfg} abierto={ab} />
        <button onClick={() => setAbierto(s => ({ ...s, [m.id]: !s[m.id] }))} style={{ width: "100%", marginTop: 8, background: "none", border: `1px dashed ${T.border}`, color: T.accent, borderRadius: 9, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{ab ? "Ver cerrado" : "Ver interior"}</button>
      </div>; })}

      {muebles.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "26px 10px", lineHeight: 1.6 }}>Agregá tu primer mueble.<br />Cargás las medidas y te armo el render, el despiece y el plan de corte.</div>}

      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "16px 0 8px" }}>Agregar mueble</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8 }}>
        {TIPOS.map(([k, l]) => <button key={k} onClick={() => nuevo(k)} style={{ background: T.card, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 11, padding: "13px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: SHDsm }}>＋ {l}</button>)}
      </div>
    </div>}

    {/* DESPIECE */}
    {tab === "despiece" && <div style={{ padding: "14px 16px 40px" }}>
      {piezas.length === 0 ? <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "30px 10px" }}>Cargá muebles para ver el despiece.</div> : <>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 12, marginBottom: 12, boxShadow: SHDsm }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0" }}><span style={{ color: T.sub }}>Total de piezas</span><b>{totalPiezas}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderTop: `1px solid ${T.border}` }}><span style={{ color: T.sub }}>Canto {cfg.cantoEsp}mm</span><b>{cantoMl.toFixed(1)} m</b></div>
          {costo > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "7px 0 2px", borderTop: `1px solid ${T.border}`, fontWeight: 800 }}><span>Costo materiales</span><span style={{ color: T.accent }}>{money(costo)}</span></div>}
        </div>
        {muebles.map(m => { const ps = despiece(m, cfg); return <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 12, marginBottom: 10, boxShadow: SHDsm }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>{m.nombre}{num(m.cant) > 1 ? ` ×${m.cant}` : ""}</div>
          {ps.map((p, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "7px 0", borderTop: i === 0 ? "none" : `1px solid ${T.border}` }}>
            <span style={{ flex: 1 }}>{p.nombre}<span style={{ fontSize: 10, color: T.muted, marginLeft: 5 }}>{p.mat === "fondo" ? `${cfg.espFondo}mm` : `${cfg.esp}mm`}</span></span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, marginRight: 10 }}>{mm(p.w)} × {mm(p.h)}</span>
            <span style={{ background: T.al, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 800, color: T.accent, minWidth: 26, textAlign: "center" }}>{p.cant}</span>
          </div>)}
        </div>; })}
        <button onClick={() => setPdfHtml(reporteHTML(proyecto, cfg, piezas, resPlaca, resFondo, resumen))} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 11, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Despiece + plan de corte en PDF</button>
      </>}
    </div>}

    {/* CORTES */}
    {tab === "cortes" && <div style={{ padding: "14px 16px 40px" }}>
      {piezas.length === 0 ? <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "30px 10px" }}>Cargá muebles para optimizar los cortes.</div> : <>
        <div style={{ background: `linear-gradient(155deg, #14263E 0%, ${T.navy} 68%)`, color: "#fff", borderRadius: 15, padding: 15, marginBottom: 12, boxShadow: SHD }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BRASS, letterSpacing: "0.12em", textTransform: "uppercase" }}>Optimización</div>
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            <div><div style={{ fontSize: 25, fontWeight: 800 }}>{resumen.nPlacas}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.7)" }}>placas {cfg.esp}mm</div></div>
            <div><div style={{ fontSize: 25, fontWeight: 800 }}>{resumen.uso.toFixed(0)}%</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.7)" }}>aprovechado</div></div>
            <div><div style={{ fontSize: 25, fontWeight: 800, color: BRASS }}>{resPlaca.desperdicio.toFixed(0)}%</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.7)" }}>desperdicio</div></div>
            {resumen.nFondos > 0 && <div><div style={{ fontSize: 25, fontWeight: 800 }}>{resumen.nFondos}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.7)" }}>placas fondo</div></div>}
          </div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.65)", marginTop: 9 }}>Placa {cfg.placaW}×{cfg.placaH} · sierra {cfg.kerf}mm{cfg.veta ? " · veta respetada (sin rotar)" : " · piezas pueden rotar"}</div>
        </div>
        {(resPlaca.noEntran.length > 0 || resFondo.noEntran.length > 0) && <div style={{ background: "rgba(180,83,9,.1)", border: "1px solid rgba(180,83,9,.35)", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: T.warn, marginBottom: 12, fontWeight: 700 }}>⚠ {resPlaca.noEntran.length + resFondo.noEntran.length} pieza(s) no entran en la placa. Revisá medidas o cambiá el tamaño de placa en ⚙︎.</div>}
        {resPlaca.placas.map((pl, i) => <PlacaSVG key={i} pl={pl} PW={resPlaca.PW} PH={resPlaca.PH} n={i + 1} total={resPlaca.placas.length} />)}
        {resFondo.placas.length > 0 && <>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", margin: "14px 0 8px" }}>Fondos · {cfg.espFondo}mm</div>
          {resFondo.placas.map((pl, i) => <PlacaSVG key={"f" + i} pl={pl} PW={resFondo.PW} PH={resFondo.PH} n={i + 1} total={resFondo.placas.length} />)}
        </>}
        <button onClick={() => setPdfHtml(reporteHTML(proyecto, cfg, piezas, resPlaca, resFondo, resumen))} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 11, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>Plan de corte en PDF (para el aserradero)</button>
      </>}
    </div>}

    {/* FORM MUEBLE */}
    {form && <div onClick={() => setForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(11,22,34,.55)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", padding: 18, width: "100%", maxWidth: 680, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{form.id ? "Editar mueble" : "Nuevo mueble"}</div>
        <input value={form.nombre} onChange={e => setF("nombre", e.target.value)} placeholder="Nombre (ej: Bajo mesada pileta)" style={inp} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Ancho (mm)</label><input value={form.ancho} onChange={e => setF("ancho", e.target.value)} inputMode="numeric" style={inp} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Alto (mm)</label><input value={form.alto} onChange={e => setF("alto", e.target.value)} inputMode="numeric" style={inp} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Prof. (mm)</label><input value={form.prof} onChange={e => setF("prof", e.target.value)} inputMode="numeric" style={inp} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Estantes</label><input value={form.estantes} onChange={e => setF("estantes", e.target.value)} inputMode="numeric" style={inp} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Puertas</label><input value={form.puertas} onChange={e => setF("puertas", e.target.value)} inputMode="numeric" style={inp} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Cajones</label><input value={form.cajones} onChange={e => setF("cajones", e.target.value)} inputMode="numeric" style={inp} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Zócalo (mm)</label><input value={form.zocalo} onChange={e => setF("zocalo", e.target.value)} inputMode="numeric" style={inp} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Cantidad</label><input value={form.cant} onChange={e => setF("cant", e.target.value)} inputMode="numeric" style={inp} /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Armado del cajón</label>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {[["lat", "Laterales enteros"], ["tp", "Techo y piso enteros"]].map(([k, l]) => <button key={k} onClick={() => setF("armado", k)} style={{ flex: 1, background: form.armado === k ? T.accent : T.al, color: form.armado === k ? "#fff" : T.sub, border: `1px solid ${form.armado === k ? T.accent : T.border}`, borderRadius: 9, padding: "10px 6px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setF("techoTravesanos", !form.techoTravesanos)} style={{ flex: 1, background: form.techoTravesanos ? T.accent : T.al, color: form.techoTravesanos ? "#fff" : T.sub, border: `1px solid ${form.techoTravesanos ? T.accent : T.border}`, borderRadius: 9, padding: "11px 6px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{form.techoTravesanos ? "✓ " : ""}Techo con travesaños</button>
          <button onClick={() => setF("fondo", form.fondo === false)} style={{ flex: 1, background: form.fondo !== false ? T.accent : T.al, color: form.fondo !== false ? "#fff" : T.sub, border: `1px solid ${form.fondo !== false ? T.accent : T.border}`, borderRadius: 9, padding: "11px 6px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{form.fondo !== false ? "✓ " : ""}Lleva fondo</button>
        </div>
        <div style={{ marginTop: 14 }}><Render3D m={form} cfg={cfg} abierto={num(form.puertas) === 0 && num(form.cajones) === 0} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => setForm(null)} style={{ flex: 1, background: T.bg, color: T.sub, border: `1px solid ${T.border}`, borderRadius: 10, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button onClick={guardarMueble} style={{ flex: 2, background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 10, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Guardar mueble</button>
        </div>
      </div>
    </div>}

    {/* CONFIG */}
    {verCfg && <div onClick={() => setVerCfg(false)} style={{ position: "fixed", inset: 0, background: "rgba(11,22,34,.55)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", padding: 18, width: "100%", maxWidth: 680, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Configuración</div>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 14 }}>Placa, sierra, espesores y precios.</div>
        {[["placaW", "Ancho de placa (mm)"], ["placaH", "Alto de placa (mm)"], ["esp", "Espesor placa (mm)"], ["espFondo", "Espesor fondo (mm)"], ["kerf", "Espesor de sierra / kerf (mm)"], ["luz", "Luz entre frentes (mm)"], ["retranqueo", "Retranqueo de estante (mm)"], ["holgura", "Holgura de estante (mm)"], ["correderaLuz", "Luz corredera por lado (mm)"], ["cantoEsp", "Ancho de canto (mm)"], ["precioPlaca", "Precio por placa ($)"], ["precioCanto", "Precio canto por metro ($)"]].map(([k, l]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: T.sub, flex: 1 }}>{l}</span>
            <input value={cfg[k]} onChange={e => setC(k, num(e.target.value))} inputMode="numeric" style={{ ...inpSm, width: 110, textAlign: "right" }} />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={() => setC("veta", !cfg.veta)} style={{ flex: 1, background: cfg.veta ? T.accent : T.al, color: cfg.veta ? "#fff" : T.sub, border: `1px solid ${cfg.veta ? T.accent : T.border}`, borderRadius: 9, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.veta ? "✓ " : ""}Respetar veta</button>
          <button onClick={() => setC("descontarFondo", !cfg.descontarFondo)} style={{ flex: 1, background: cfg.descontarFondo ? T.accent : T.al, color: cfg.descontarFondo ? "#fff" : T.sub, border: `1px solid ${cfg.descontarFondo ? T.accent : T.border}`, borderRadius: 9, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.descontarFondo ? "✓ " : ""}Descontar fondo de la prof.</button>
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>Respetar veta: las piezas no se rotan al optimizar (usa más placas pero mantiene el sentido del dibujo). Descontar fondo: la profundidad que cargás incluye el fondo aplicado atrás.</div>
        <button onClick={() => setVerCfg(false)} style={{ width: "100%", marginTop: 14, background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 10, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Listo</button>
      </div>
    </div>}

    {pdfHtml && <PdfOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
  </div>;
}
