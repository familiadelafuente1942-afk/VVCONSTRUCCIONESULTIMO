import React, { useState, useEffect, useRef } from "react";
// VERSION: v6 (Muebles: solapa Herrajes, bisagras codo 0/9/17, tipos de corredera)

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
  alturaAlacena: 1400, espMesada: 30, solape: 25, descuentoRiel: 55,
  tipoBisagra: "codo0", tipoCorredera: "telescopica", cierreSuave: true,
  precioBisagra: 0, precioCorredera: 0, precioRiel: 0, precioVidrio: 0, precioTirador: 0,
};
const BISAGRAS = {
  codo0: { nom: "Bisagra cazoleta 35 mm · CODO 0", det: "puerta superpuesta (tapa el lateral)" },
  codo9: { nom: "Bisagra cazoleta 35 mm · CODO 9", det: "puerta semi-superpuesta (2 puertas en un lateral)" },
  codo17: { nom: "Bisagra cazoleta 35 mm · CODO 17", det: "puerta interior (entre laterales)" },
};
const CORREDERAS_T = {
  telescopica: { nom: "Corredera telescópica de bolillas 45 mm", det: "extracción total" },
  oculta: { nom: "Corredera oculta undermount", det: "bajo cajón, cierre suave" },
  rodillo: { nom: "Corredera a rodillo (riel simple)", det: "extracción parcial, económica" },
};
const VANO_DEF = { ancho: 3000, alto: 2600, prof: 600, paredB: 0 };
const CORREDERAS = [250, 300, 350, 400, 450, 500, 550, 600];
// Bisagras según alto de puerta (norma habitual)
function nBisagras(alto) { const h = num(alto); if (h <= 900) return 2; if (h <= 1600) return 3; if (h <= 2000) return 4; if (h <= 2400) return 5; return 6; }
function largoCorredera(profCaja) { const p = num(profCaja); let best = CORREDERAS[0]; for (const c of CORREDERAS) if (c <= p) best = c; return best; }
const TIPOS = [["bajo", "Bajo mesada"], ["alacena", "Alacena"], ["placard", "Placard"], ["cajonera", "Cajonera"], ["generico", "Genérico"]];
const DEF_TIPO = {
  bajo: { ancho: 600, alto: 860, prof: 580, zocalo: 100, estantes: 1, puertas: 1, cajones: 0, techoTravesanos: true, armado: "lat" },
  alacena: { ancho: 600, alto: 700, prof: 320, zocalo: 0, estantes: 1, puertas: 1, cajones: 0, techoTravesanos: false, armado: "lat" },
  placard: { ancho: 1200, alto: 2400, prof: 600, zocalo: 80, estantes: 3, puertas: 2, cajones: 0, techoTravesanos: false, armado: "lat", sistemaPuerta: "corrediza", matPuerta: "melamina" },
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
    const corr = m.sistemaPuerta === "corrediza";
    const sol = num(cfg.solape) || 25, dr = num(cfg.descuentoRiel) || 55;
    const anchoPu = corr ? (A + sol * (nPu - 1)) / nPu : (A - (nPu - 1) * L - 2 * 1) / nPu;
    const altoPu = corr ? Math.max(0, Hc - dr) : Math.max(0, Hc - 2 * 1);
    if (m.matPuerta === "vidrio") p.push({ nombre: corr ? "Puerta vidrio corrediza" : "Puerta vidrio", w: Math.round(anchoPu), h: Math.round(altoPu), cant: nPu, mat: "vidrio", canto: 0 });
    else add(corr ? "Puerta corrediza" : "Puerta", anchoPu, altoPu, nPu, "placa", 2 * (anchoPu + altoPu));
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
  const [rot, setRot] = useState({ yaw: 28, pitch: 16 });
  const drag = useRef(null);
  const svgRef = useRef(null);

  const onDown = (cx, cy) => { drag.current = { x: cx, y: cy, yaw: rot.yaw, pitch: rot.pitch }; };
  const onMove = (cx, cy) => { const d = drag.current; if (!d) return; const yaw = d.yaw + (cx - d.x) * 0.45; let pitch = d.pitch - (cy - d.y) * 0.45; pitch = Math.max(-80, Math.min(80, pitch)); setRot({ yaw, pitch }); };
  const onUp = () => { drag.current = null; };

  // Rotación 3D real: yaw (eje Y) + pitch (eje X), luego proyección
  const R = (x, y, zz) => {
    const cx = A / 2, cy = H / 2, cz = Pc / 2;
    let X = x - cx, Y = y - cy, Z = zz - cz;
    const ry = rot.yaw * Math.PI / 180, rp = rot.pitch * Math.PI / 180;
    let X1 = X * Math.cos(ry) + Z * Math.sin(ry);
    let Z1 = -X * Math.sin(ry) + Z * Math.cos(ry);
    let Y2 = Y * Math.cos(rp) - Z1 * Math.sin(rp);
    let Z2 = Y * Math.sin(rp) + Z1 * Math.cos(rp);
    return { x: X1, y: -Y2, z: Z2 };
  };
  const pt = (a) => { const p = R(a[0], a[1], a[2]); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; };
  const prof = (pts) => pts.reduce((s, a) => s + R(a[0], a[1], a[2]).z, 0) / pts.length; // z medio para orden de dibujo

  const caras = [];
  const cara = (key, pts, fill, op) => caras.push({ key, pts, fill, op: op == null ? 1 : op, z: prof(pts) });
  const MEL = "#E4D5BE", MEL_D = "#C9B492", MEL_L = "#F1E7D6", FRENTE = "#D8C7AC", INT = "#EFE6D6";
  const nPu = num(m.puertas), nCj = num(m.cajones), nEst = num(m.estantes);
  const L = num(cfg.luz) || 3;

  cara("fondo", [[0, z, Pc], [A, z, Pc], [A, z + Hc, Pc], [0, z + Hc, Pc]], INT);
  for (let i = 1; i <= nEst; i++) { const yy = z + (Hc / (nEst + 1)) * i; cara("est" + i, [[e, yy, 0], [A - e, yy, 0], [A - e, yy, Pc], [e, yy, Pc]], MEL_L); cara("estf" + i, [[e, yy - e, 0], [A - e, yy - e, 0], [A - e, yy, 0], [e, yy, 0]], MEL_D); }
  cara("piso", [[0, z + e, 0], [A, z + e, 0], [A, z + e, Pc], [0, z + e, Pc]], MEL_L);
  cara("pisoB", [[0, z, 0], [A, z, 0], [A, z, Pc], [0, z, Pc]], MEL_D);
  if (!m.techoTravesanos) { cara("techo", [[0, z + Hc - e, 0], [A, z + Hc - e, 0], [A, z + Hc - e, Pc], [0, z + Hc - e, Pc]], MEL_L); cara("techoT", [[0, z + Hc, 0], [A, z + Hc, 0], [A, z + Hc, Pc], [0, z + Hc, Pc]], MEL); }
  else { cara("tr1", [[e, z + Hc, 0], [A - e, z + Hc, 0], [A - e, z + Hc, 90], [e, z + Hc, 90]], MEL); cara("tr2", [[e, z + Hc, Pc - 90], [A - e, z + Hc, Pc - 90], [A - e, z + Hc, Pc], [e, z + Hc, Pc]], MEL); }
  cara("latI", [[0, z, 0], [0, z, Pc], [0, z + Hc, Pc], [0, z + Hc, 0]], MEL_D);
  cara("latIe", [[e, z, 0], [e, z, Pc], [e, z + Hc, Pc], [e, z + Hc, 0]], MEL_L);
  cara("latD", [[A, z, 0], [A, z, Pc], [A, z + Hc, Pc], [A, z + Hc, 0]], MEL);
  cara("latDe", [[A - e, z, 0], [A - e, z, Pc], [A - e, z + Hc, Pc], [A - e, z + Hc, 0]], MEL_L);
  if (z > 0) cara("zoc", [[0, 0, 0], [A, 0, 0], [A, z, 0], [0, z, 0]], "#8C99A6");
  if (!abierto) {
    if (nCj > 0) { const altoFr = (Hc - (nCj + 1) * L) / nCj; for (let i = 0; i < nCj; i++) { const y0 = z + L + i * (altoFr + L); cara("cj" + i, [[1, y0, 0], [A - 1, y0, 0], [A - 1, y0 + altoFr, 0], [1, y0 + altoFr, 0]], FRENTE); } }
    if (nPu > 0) { const aPu = (A - (nPu - 1) * L - 2) / nPu; for (let i = 0; i < nPu; i++) { const x0 = 1 + i * (aPu + L); cara("pu" + i, [[x0, z + 1, 0], [x0 + aPu, z + 1, 0], [x0 + aPu, z + Hc - 1, 0], [x0, z + Hc - 1, 0]], FRENTE, 0.96); } }
  }
  caras.sort((a, b) => b.z - a.z); // painter: dibuja lo lejano primero

  const todos = caras.flatMap(c => c.pts.map(a => R(a[0], a[1], a[2])));
  const xs = todos.map(p => p.x), ys = todos.map(p => p.y);
  const pad = Math.max(A, H, Pc) * 0.06;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;

  return <div style={{ background: "#F7F4EE", borderRadius: 14, padding: 10, border: `1px solid ${T.border}` }}>
    <svg ref={svgRef} viewBox={`${minX} ${minY} ${Math.max(1, maxX - minX)} ${Math.max(1, maxY - minY)}`}
      onMouseDown={ev => { ev.preventDefault(); onDown(ev.clientX, ev.clientY); }}
      onMouseMove={ev => onMove(ev.clientX, ev.clientY)} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={ev => { const t = ev.touches[0]; onDown(t.clientX, t.clientY); }}
      onTouchMove={ev => { ev.preventDefault(); const t = ev.touches[0]; onMove(t.clientX, t.clientY); }}
      onTouchEnd={onUp}
      style={{ width: "100%", height: "auto", maxHeight: 320, display: "block", cursor: "grab", touchAction: "none" }} preserveAspectRatio="xMidYMid meet">
      {caras.map(c => <polygon key={c.key} points={c.pts.map(pt).join(" ")} fill={c.fill} fillOpacity={c.op} stroke="#2A3542" strokeWidth={Math.max(A, H) / 380} strokeLinejoin="round" />)}
    </svg>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: 15 }}>↻</span>
      <input type="range" min="-180" max="180" value={Math.round(rot.yaw)} onChange={ev => setRot(r => ({ ...r, yaw: num(ev.target.value) }))} style={{ flex: 1, accentColor: T.accent }} />
      <input type="range" min="-80" max="80" value={Math.round(rot.pitch)} onChange={ev => setRot(r => ({ ...r, pitch: num(ev.target.value) }))} style={{ flex: 1, accentColor: T.accent }} />
    </div>
    <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
      {[["Frente", 0, 0], ["3/4", 28, 16], ["Lado", 90, 0], ["Arriba", 0, 70], ["Atrás", 180, 10]].map(([l, y, p]) => <button key={l} onClick={() => setRot({ yaw: y, pitch: p })} style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "5px 9px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.muted, marginTop: 6, padding: "0 2px" }}>
      <span>Ancho {mm(A)} · Alto {mm(H)} · Prof {mm(P)} mm</span>
      <span>Arrastrá para girar</span>
    </div>
  </div>;
}

// ---------- HERRAJES Y VIDRIOS ----------
function herrajes(muebles, cfg) {
  const ef = num(cfg.espFondo) || 3;
  const acc = {}; const push = (k, cant, unidad, detalle, grupo) => { if (!acc[k]) acc[k] = { item: k, cant: 0, unidad, detalle: detalle || "", grupo: grupo || "Herrajes", muebles: [] }; acc[k].cant += cant; };
  const addM = (k, nombre) => { if (acc[k] && !acc[k].muebles.includes(nombre)) acc[k].muebles.push(nombre); };
  const BIS = BISAGRAS[cfg.tipoBisagra] || BISAGRAS.codo0;
  const CORR = CORREDERAS_T[cfg.tipoCorredera] || CORREDERAS_T.telescopica;
  let vidrioM2 = 0, marcoMl = 0;
  muebles.forEach(m => {
    const n = Math.max(1, num(m.cant) || 1);
    const A = num(m.ancho), H = num(m.alto), P = num(m.prof);
    const z = num(m.zocalo) || 0, Hc = Math.max(0, H - z);
    const Pc = Math.max(0, cfg.descontarFondo && m.fondo !== false ? P - ef : P);
    const nPu = num(m.puertas), nCj = num(m.cajones);
    const corr = m.sistemaPuerta === "corrediza", vid = m.matPuerta === "vidrio";
    const nom = m.nombre || "Mueble";
    if (nPu > 0) {
      const sol = num(cfg.solape) || 25, dr = num(cfg.descuentoRiel) || 55;
      const anchoPu = corr ? (A + sol * (nPu - 1)) / nPu : (A - (nPu - 1) * (num(cfg.luz) || 3) - 2) / nPu;
      const altoPu = corr ? Math.max(0, Hc - dr) : Math.max(0, Hc - 2);
      if (corr) {
        const k1 = `Kit riel para puerta corrediza · ${nPu} hojas`;
        push(k1, n, "kit", `hoja ${mm(anchoPu)}×${mm(altoPu)} mm`, "Puertas corredizas"); addM(k1, nom);
        const k2 = "Riel superior + inferior (aluminio)";
        push(k2, (A / 1000) * 2 * n, "m", "largo del mueble ×2", "Puertas corredizas"); addM(k2, nom);
        const k3 = "Ruedas / carros de corrediza";
        push(k3, nPu * 2 * n, "u", "2 por hoja", "Puertas corredizas"); addM(k3, nom);
        const k4 = "Tope y guía inferior";
        push(k4, nPu * n, "u", "1 por hoja", "Puertas corredizas"); addM(k4, nom);
      } else {
        const bis = nBisagras(altoPu);
        const k1 = vid ? "Bisagra cazoleta PARA VIDRIO 35 mm · codo 0" : BIS.nom;
        push(k1, bis * nPu * n, "u", `${bis} por puerta (alto ${mm(altoPu)} mm) · ${vid ? "sin perforar el vidrio" : BIS.det}`, "Bisagras"); addM(k1, nom);
        const k2 = "Base / pie de bisagra (cruz)";
        push(k2, bis * nPu * n, "u", "1 por bisagra", "Bisagras"); addM(k2, nom);
        if (cfg.cierreSuave) { const k3 = "Amortiguador de cierre suave"; push(k3, bis * nPu * n, "u", "1 por bisagra", "Bisagras"); addM(k3, nom); }
      }
      const kt = "Tirador de puerta"; push(kt, nPu * n, "u", "1 por puerta", "Tiradores"); addM(kt, nom);
      if (vid) { vidrioM2 += (anchoPu * altoPu / 1e6) * nPu * n; marcoMl += (2 * (anchoPu + altoPu) / 1000) * nPu * n; }
    }
    if (nCj > 0) {
      const profCaja = Math.max(0, Pc - 30);
      const lc = largoCorredera(profCaja);
      const k1 = `${CORR.nom} · ${lc} mm`;
      push(k1, nCj * n, "par", `${CORR.det} · caja de ${mm(profCaja)} mm de profundidad`, "Correderas"); addM(k1, nom);
      const kt = "Tirador de cajón"; push(kt, nCj * n, "u", "1 por cajón", "Tiradores"); addM(kt, nom);
    }
    if (num(m.estantes) > 0) { const k = "Soporte de estante"; push(k, num(m.estantes) * 4 * n, "u", "4 por estante", "Estantes"); addM(k, nom); }
    if (z > 0 && (m.tipo === "bajo" || m.tipo === "cajonera" || m.tipo === "placard")) { const k = "Pata regulable"; push(k, 4 * n, "u", "4 por módulo", "Zócalo y colgado"); addM(k, nom); }
    if (m.tipo === "alacena") { const k = "Colgador de alacena (par)"; push(k, 2 * n, "u", "2 por alacena", "Zócalo y colgado"); addM(k, nom); }
  });
  const lista = Object.values(acc).map(x => ({ ...x, cant: Math.round(x.cant * 10) / 10 }));
  return { lista, vidrioM2, marcoMl };
}

// ---------- VANO: vista en planta y de frente ----------
const esAlacena = (m) => m.tipo === "alacena";
const esAlto = (m) => m.tipo === "placard";
function distribuir(muebles, pared) {
  // Devuelve muebles de esa pared con su x acumulado, separados por fila (piso / colgado)
  const de = muebles.filter(m => (m.pared || "A") === pared);
  const piso = [], colg = [];
  let xp = 0, xc = 0;
  de.forEach(m => {
    const A = num(m.ancho), n = Math.max(1, num(m.cant) || 1);
    for (let i = 0; i < n; i++) {
      if (esAlacena(m)) { colg.push({ m, x: xc, w: A }); xc += A; }
      else { piso.push({ m, x: xp, w: A }); xp += A; }
    }
  });
  return { piso, colg, anchoPiso: xp, anchoColg: xc };
}
function VanoVistas({ vano, muebles, cfg }) {
  const [pared, setPared] = useState("A");
  const W = num(vano.ancho) || 1, H = num(vano.alto) || 1, PR = num(vano.prof) || 600;
  const WB = num(vano.paredB) || 0;
  const anchoPared = pared === "B" ? WB : W;
  const d = distribuir(muebles, pared);
  const sobraPiso = anchoPared - d.anchoPiso, sobraColg = anchoPared - d.anchoColg;
  const hAlac = num(cfg.alturaAlacena) || 1400, eMes = num(cfg.espMesada) || 30;
  const COL = (m) => PALETA[(muebles.findIndex(x => x.id === m.id) + 1) % PALETA.length];

  // --- PLANTA ---
  const pad = Math.max(W, WB, PR) * 0.10 + 120;
  const dPlan = distribuir(muebles, "A"), dPlanB = WB > 0 ? distribuir(muebles, "B") : null;
  const planW = W + (WB > 0 ? PR : 0), planH = PR + (WB > 0 ? WB : 0);
  const planta = <svg viewBox={`${-pad} ${-pad} ${planW + pad * 2} ${planH + pad * 1.5}`} style={{ width: "100%", height: "auto", maxHeight: 300, display: "block" }} preserveAspectRatio="xMidYMid meet">
    {/* paredes */}
    <line x1="0" y1="0" x2={W} y2="0" stroke="#334155" strokeWidth={Math.max(W, 1) / 90} strokeLinecap="square" />
    {WB > 0 && <line x1="0" y1="0" x2="0" y2={WB} stroke="#334155" strokeWidth={Math.max(W, 1) / 90} strokeLinecap="square" />}
    {/* muebles pared A (piso) */}
    {dPlan.piso.map((it, i) => <g key={"a" + i}>
      <rect x={it.x} y="0" width={it.w} height={PR} fill={COL(it.m)} fillOpacity="0.22" stroke={COL(it.m)} strokeWidth={W / 260} />
      <text x={it.x + it.w / 2} y={PR / 2} textAnchor="middle" fontSize={W / 42} fill="#334155" fontWeight="700">{mm(it.w)}</text>
    </g>)}
    {/* alacenas pared A (punteadas, cuelgan sobre los bajos) */}
    {dPlan.colg.map((it, i) => <rect key={"ac" + i} x={it.x} y="0" width={it.w} height={Math.min(PR, 350)} fill="none" stroke={COL(it.m)} strokeWidth={W / 320} strokeDasharray={`${W / 90},${W / 130}`} />)}
    {/* pared B */}
    {dPlanB && dPlanB.piso.map((it, i) => <g key={"b" + i}>
      <rect x="0" y={it.x} width={PR} height={it.w} fill={COL(it.m)} fillOpacity="0.22" stroke={COL(it.m)} strokeWidth={W / 260} />
      <text x={PR / 2} y={it.x + it.w / 2} textAnchor="middle" fontSize={W / 42} fill="#334155" fontWeight="700">{mm(it.w)}</text>
    </g>)}
    {/* cota del vano */}
    <line x1="0" y1={-pad * 0.55} x2={W} y2={-pad * 0.55} stroke="#94A3B8" strokeWidth={W / 400} />
    <line x1="0" y1={-pad * 0.7} x2="0" y2={-pad * 0.4} stroke="#94A3B8" strokeWidth={W / 400} />
    <line x1={W} y1={-pad * 0.7} x2={W} y2={-pad * 0.4} stroke="#94A3B8" strokeWidth={W / 400} />
    <text x={W / 2} y={-pad * 0.68} textAnchor="middle" fontSize={W / 34} fill="#475569" fontWeight="700">Vano {mm(W)} mm</text>
    <text x={W / 2} y={PR + pad * 0.55} textAnchor="middle" fontSize={W / 40} fill={sobraPiso < 0 ? "#DC2626" : "#64748B"} fontWeight="700">{sobraPiso < 0 ? `Se pasan ${mm(-sobraPiso)} mm` : sobraPiso > 0 ? `Libre ${mm(sobraPiso)} mm` : "Justo"}</text>
  </svg>;

  // --- FRENTE ---
  const padF = Math.max(anchoPared, H) * 0.10 + 100;
  const frente = <svg viewBox={`${-padF} ${-padF * 0.5} ${anchoPared + padF * 2} ${H + padF * 1.4}`} style={{ width: "100%", height: "auto", maxHeight: 320, display: "block" }} preserveAspectRatio="xMidYMid meet">
    <rect x="0" y="0" width={anchoPared} height={H} fill="#FAFAF8" stroke="#334155" strokeWidth={anchoPared / 110} />
    {/* piso: bajos, cajoneras, placares */}
    {d.piso.map((it, i) => { const alt = num(it.m.alto); const y = H - alt; return <g key={"p" + i}>
      <rect x={it.x} y={y} width={it.w} height={alt} fill={COL(it.m)} fillOpacity="0.22" stroke={COL(it.m)} strokeWidth={anchoPared / 260} />
      <text x={it.x + it.w / 2} y={y + alt / 2} textAnchor="middle" fontSize={anchoPared / 40} fill="#334155" fontWeight="700">{mm(it.w)}</text>
      <text x={it.x + it.w / 2} y={y + alt / 2 + anchoPared / 30} textAnchor="middle" fontSize={anchoPared / 52} fill="#64748B">{it.m.nombre}</text>
    </g>; })}
    {/* mesada sobre los bajos */}
    {d.piso.filter(it => !esAlto(it.m)).length > 0 && (() => { const hb = Math.max(...d.piso.filter(it => !esAlto(it.m)).map(it => num(it.m.alto))); const anchoM = d.piso.filter(it => !esAlto(it.m)).reduce((s, it) => s + it.w, 0); return <rect x="0" y={H - hb - eMes} width={anchoM} height={eMes} fill="#64748B" />; })()}
    {/* alacenas colgadas */}
    {d.colg.map((it, i) => { const alt = num(it.m.alto); const y = H - hAlac - alt; return <g key={"c" + i}>
      <rect x={it.x} y={y} width={it.w} height={alt} fill={COL(it.m)} fillOpacity="0.22" stroke={COL(it.m)} strokeWidth={anchoPared / 260} />
      <text x={it.x + it.w / 2} y={y + alt / 2} textAnchor="middle" fontSize={anchoPared / 40} fill="#334155" fontWeight="700">{mm(it.w)}</text>
    </g>; })}
    {/* cotas */}
    <text x={anchoPared / 2} y={H + padF * 0.55} textAnchor="middle" fontSize={anchoPared / 32} fill="#475569" fontWeight="700">Vano {mm(anchoPared)} × {mm(H)} mm</text>
    {sobraPiso !== 0 && <rect x={d.anchoPiso} y={H - 100} width={Math.max(0, sobraPiso)} height="100" fill={sobraPiso < 0 ? "#DC2626" : "#22C55E"} fillOpacity="0.18" />}
  </svg>;

  return <div>
    {WB > 0 && <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
      {[["A", `Pared A (${mm(W)})`], ["B", `Pared B (${mm(WB)})`]].map(([k, l]) => <button key={k} onClick={() => setPared(k)} style={{ flex: 1, background: pared === k ? T.accent : T.al, color: pared === k ? "#fff" : T.sub, border: `1px solid ${pared === k ? T.accent : T.border}`, borderRadius: 9, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
    </div>}
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 11, marginBottom: 10, boxShadow: SHDsm }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", marginBottom: 6 }}>Vista en planta</div>
      <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 8 }}>{planta}</div>
    </div>
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 11, marginBottom: 10, boxShadow: SHDsm }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", marginBottom: 6 }}>Vista de frente {WB > 0 ? `· Pared ${pared}` : ""}</div>
      <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 8 }}>{frente}</div>
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ flex: 1, background: sobraPiso < 0 ? "rgba(220,38,38,.08)" : T.card, border: `1px solid ${sobraPiso < 0 ? "rgba(220,38,38,.4)" : T.border}`, borderRadius: 11, padding: "10px 12px" }}>
        <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Bajos / placares</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: sobraPiso < 0 ? "#DC2626" : T.accent }}>{mm(d.anchoPiso)} / {mm(anchoPared)} mm</div>
        <div style={{ fontSize: 10.5, color: sobraPiso < 0 ? "#DC2626" : T.sub, marginTop: 2, fontWeight: 700 }}>{sobraPiso < 0 ? `⚠ Se pasan ${mm(-sobraPiso)} mm` : sobraPiso > 0 ? `Libre: ${mm(sobraPiso)} mm` : "Entra justo ✓"}</div>
      </div>
      <div style={{ flex: 1, background: sobraColg < 0 ? "rgba(220,38,38,.08)" : T.card, border: `1px solid ${sobraColg < 0 ? "rgba(220,38,38,.4)" : T.border}`, borderRadius: 11, padding: "10px 12px" }}>
        <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase" }}>Alacenas</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: sobraColg < 0 ? "#DC2626" : T.accent }}>{mm(d.anchoColg)} / {mm(anchoPared)} mm</div>
        <div style={{ fontSize: 10.5, color: sobraColg < 0 ? "#DC2626" : T.sub, marginTop: 2, fontWeight: 700 }}>{sobraColg < 0 ? `⚠ Se pasan ${mm(-sobraColg)} mm` : sobraColg > 0 ? `Libre: ${mm(sobraColg)} mm` : d.anchoColg === 0 ? "Sin alacenas" : "Entra justo ✓"}</div>
      </div>
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
${(vidrios && vidrios.length) ? `<h2>Vidrios y marcos</h2><table><thead><tr><th>Mueble</th><th>Pieza</th><th style="text-align:right">Ancho</th><th style="text-align:right">Alto</th><th style="text-align:right">Cant.</th></tr></thead><tbody>${vidrios.map(p => `<tr><td>${p.mueble}</td><td>${p.nombre}</td><td class="r">${mm(p.w)}</td><td class="r">${mm(p.h)}</td><td class="r">${p.cant}</td></tr>`).join("")}</tbody></table><p style="font-size:11px;margin-top:6px;color:#5B6673">Total vidrio: <b>${herr.vidrioM2.toFixed(2)} m²</b> · Marco de aluminio: <b>${herr.marcoMl.toFixed(1)} m</b></p>` : ""}
${(herr && herr.lista.length) ? `<h2>Herrajes · lista de compra</h2>
<p style="font-size:11px;color:#5B6673;margin-bottom:6px">Bisagras: <b style="color:#0B1622">${(BISAGRAS[cfg.tipoBisagra] || BISAGRAS.codo0).nom}</b> (${(BISAGRAS[cfg.tipoBisagra] || BISAGRAS.codo0).det}) · Correderas: <b style="color:#0B1622">${(CORREDERAS_T[cfg.tipoCorredera] || CORREDERAS_T.telescopica).nom}</b></p>
<table><thead><tr><th>Grupo</th><th>Herraje</th><th>Detalle</th><th>En</th><th style="text-align:right">Cantidad</th></tr></thead><tbody>${herr.lista.map(h => `<tr><td>${h.grupo}</td><td><b>${h.item}</b></td><td style="color:#5B6673;font-size:10px">${h.detalle}</td><td style="color:#5B6673;font-size:10px">${(h.muebles || []).join(", ")}</td><td class="r"><b style="font-size:12px">${h.cant} ${h.unidad}</b></td></tr>`).join("")}</tbody></table>` : ""}
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
  const [vano, setVano] = useState(VANO_DEF);
  const [tab, setTab] = useState("vano");
  const [form, setForm] = useState(null);
  const [abierto, setAbierto] = useState({});
  const [pdfHtml, setPdfHtml] = useState(null);
  const [verCfg, setVerCfg] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const actualizar = async () => {
    setRefrescando(true); setOkMsg("");
    try {
      const r = await storage.get("vv_muebles");
      if (r && r.value) { const d = JSON.parse(r.value); setProyecto(d.proyecto || ""); setMuebles(d.muebles || []); setCfg({ ...CFG_DEF, ...(d.cfg || {}) }); setVano({ ...VANO_DEF, ...(d.vano || {}) }); }
      setOkMsg("✓"); setTimeout(() => setOkMsg(""), 1600);
    } catch { setOkMsg("!"); setTimeout(() => setOkMsg(""), 1600); }
    setRefrescando(false);
  };

  useEffect(() => { (async () => { try { const r = await storage.get("vv_muebles"); if (r && r.value) { const d = JSON.parse(r.value); setProyecto(d.proyecto || ""); setMuebles(d.muebles || []); setCfg({ ...CFG_DEF, ...(d.cfg || {}) }); setVano({ ...VANO_DEF, ...(d.vano || {}) }); } } catch { } setCargando(false); })(); }, []);
  const guardar = (next) => { const d = { proyecto: next.proyecto != null ? next.proyecto : proyecto, muebles: next.muebles || muebles, cfg: next.cfg || cfg, vano: next.vano || vano }; if (next.proyecto != null) setProyecto(next.proyecto); if (next.muebles) setMuebles(next.muebles); if (next.cfg) setCfg(next.cfg); if (next.vano) setVano(next.vano); try { storage.set("vv_muebles", JSON.stringify(d)); } catch { } };
  const setV = (k, v) => guardar({ vano: { ...vano, [k]: num(v) } });
  const mover = (id, dir) => { const i = muebles.findIndex(m => m.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= muebles.length) return; const arr = [...muebles]; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; guardar({ muebles: arr }); };

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
  const herr = herrajes(muebles, cfg);
  const vidrios = piezas.filter(p => p.mat === "vidrio");
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
      <button onClick={actualizar} title="Actualizar" style={{ position: "absolute", top: 14, left: 14, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 9, height: 34, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>↻ {okMsg || (refrescando ? "..." : "Actualizar")}</button>
      <button onClick={() => setVerCfg(true)} style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 9, width: 34, height: 34, fontSize: 15, cursor: "pointer" }}>⚙︎</button>
      <div style={{ fontSize: 16, fontWeight: 700 }}>V+V Muebles</div>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: BRASS, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 2 }}>Despiece y optimización de cortes</div>
    </div>
    <div style={{ display: "flex", background: "rgba(255,255,255,.9)", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 40 }}>
      {[["vano", "Vano"], ["muebles", "Muebles"], ["despiece", "Despiece"], ["herrajes", "Herrajes"], ["cortes", "Cortes"]].map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} style={{ flex: 1, background: "none", border: "none", color: tab === k ? T.text : T.muted, padding: "12px 2px 10px", fontSize: 11.5, fontWeight: tab === k ? 700 : 600, cursor: "pointer", position: "relative" }}>{l}{tab === k && <span style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 24, height: 2.5, background: BRASS, borderRadius: "2px 2px 0 0" }} />}</button>
      ))}
    </div>

    {/* HERRAJES */}
    {tab === "herrajes" && <div style={{ padding: "14px 16px 40px" }}>
      {muebles.length === 0 ? <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "30px 10px" }}>Cargá muebles para ver la lista de herrajes.</div> : <>
        <div style={{ background: `linear-gradient(155deg, #14263E 0%, ${T.navy} 68%)`, color: "#fff", borderRadius: 15, padding: 15, marginBottom: 12, boxShadow: SHD }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BRASS, letterSpacing: "0.12em", textTransform: "uppercase" }}>Lista de compra</div>
          <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            Bisagras: <b>{(BISAGRAS[cfg.tipoBisagra] || BISAGRAS.codo0).nom.replace("Bisagra cazoleta 35 mm · ", "")}</b><br />
            Correderas: <b>{(CORREDERAS_T[cfg.tipoCorredera] || CORREDERAS_T.telescopica).nom}</b>
          </div>
          <button onClick={() => setVerCfg(true)} style={{ marginTop: 9, background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Cambiar tipo de herraje</button>
        </div>
        {[...new Set(herr.lista.map(h => h.grupo))].map(g => <div key={g} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 12, marginBottom: 10, boxShadow: SHDsm }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{g}</div>
          {herr.lista.filter(h => h.grupo === g).map((h, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "9px 0", borderTop: i === 0 ? "none" : `1px solid ${T.border}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{h.item}</div>
              {h.detalle && <div style={{ fontSize: 10.5, color: T.sub, marginTop: 2 }}>{h.detalle}</div>}
              {h.muebles.length > 0 && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>En: {h.muebles.join(", ")}</div>}
            </div>
            <span style={{ background: T.al, borderRadius: 8, padding: "6px 11px", fontSize: 14, fontWeight: 800, color: T.accent, whiteSpace: "nowrap", flexShrink: 0 }}>{h.cant} {h.unidad}</span>
          </div>)}
        </div>)}
        {vidrios.length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 12, marginBottom: 10, boxShadow: SHDsm }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#3D7EA6", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>🪟 Vidrios y marcos</div>
          {vidrios.map((p, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "8px 0", borderTop: i === 0 ? "none" : `1px solid ${T.border}` }}>
            <span style={{ flex: 1 }}>{p.nombre}<span style={{ fontSize: 10, color: T.muted, display: "block" }}>{p.mueble}</span></span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, marginRight: 10 }}>{mm(p.w)} × {mm(p.h)}</span>
            <span style={{ background: "rgba(61,126,166,.12)", borderRadius: 8, padding: "6px 11px", fontSize: 13, fontWeight: 800, color: "#3D7EA6" }}>{p.cant}</span>
          </div>)}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, paddingTop: 9, marginTop: 4, borderTop: `2px solid ${T.border}`, fontWeight: 800 }}><span>Total</span><span style={{ color: "#3D7EA6" }}>{herr.vidrioM2.toFixed(2)} m² vidrio · {herr.marcoMl.toFixed(1)} m marco</span></div>
        </div>}
        <button onClick={() => setPdfHtml(reporteHTML(proyecto, cfg, piezas, resPlaca, resFondo, resumen, herr, vidrios))} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 11, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Lista de herrajes + despiece en PDF</button>
      </>}
    </div>}

    {/* VANO */}
    {tab === "vano" && <div style={{ padding: "14px 16px 40px" }}>
      <input value={proyecto} onChange={e => guardar({ proyecto: e.target.value })} placeholder="Nombre del proyecto (ej: Cocina Canning 815)" style={{ ...inp, marginTop: 0, marginBottom: 12, fontWeight: 700 }} />
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 13, marginBottom: 12, boxShadow: SHDsm }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>Medidas del vano</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Ancho (mm)</label><input value={vano.ancho} onChange={e => setV("ancho", e.target.value)} inputMode="numeric" style={inp} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Alto (mm)</label><input value={vano.alto} onChange={e => setV("alto", e.target.value)} inputMode="numeric" style={inp} /></div>
          <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Prof. (mm)</label><input value={vano.prof} onChange={e => setV("prof", e.target.value)} inputMode="numeric" style={inp} /></div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Pared B — en L (mm · 0 si es recto)</label>
          <input value={vano.paredB} onChange={e => setV("paredB", e.target.value)} inputMode="numeric" style={inp} />
        </div>
      </div>
      {muebles.length === 0 ? <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "24px 10px", lineHeight: 1.6 }}>Cargá el vano y después agregá muebles<br />en la solapa <b>Muebles</b> para verlos acomodados acá.</div> : <>
        <VanoVistas vano={vano} muebles={muebles} cfg={cfg} />
        <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, textTransform: "uppercase", margin: "16px 0 8px" }}>Orden en el vano (izquierda → derecha)</div>
        {muebles.map((m, i) => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${T.border}`, borderRadius: 11, padding: "10px 12px", marginBottom: 7, boxShadow: SHDsm }}>
          <span style={{ width: 12, height: 26, borderRadius: 4, background: PALETA[(i + 1) % PALETA.length], flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{m.nombre}{num(m.cant) > 1 ? ` ×${m.cant}` : ""}</div>
            <div style={{ fontSize: 10.5, color: T.muted }}>{mm(m.ancho)} mm · {esAlacena(m) ? "colgado" : "al piso"}{num(vano.paredB) > 0 ? ` · Pared ${m.pared || "A"}` : ""}</div>
          </div>
          {num(vano.paredB) > 0 && <button onClick={() => guardar({ muebles: muebles.map(x => x.id === m.id ? { ...x, pared: (x.pared || "A") === "A" ? "B" : "A" } : x) })} style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Pared {(m.pared || "A") === "A" ? "B" : "A"}</button>}
          <button onClick={() => mover(m.id, -1)} disabled={i === 0} style={{ background: T.al, border: `1px solid ${T.border}`, color: i === 0 ? T.muted : T.accent, borderRadius: 7, padding: "5px 9px", fontSize: 13, fontWeight: 700, cursor: i === 0 ? "default" : "pointer" }}>←</button>
          <button onClick={() => mover(m.id, 1)} disabled={i === muebles.length - 1} style={{ background: T.al, border: `1px solid ${T.border}`, color: i === muebles.length - 1 ? T.muted : T.accent, borderRadius: 7, padding: "5px 9px", fontSize: 13, fontWeight: 700, cursor: i === muebles.length - 1 ? "default" : "pointer" }}>→</button>
        </div>)}
      </>}
    </div>}

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
        {vidrios.length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 12, marginBottom: 10, boxShadow: SHDsm }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8, color: "#3D7EA6" }}>🪟 Vidrios y marcos</div>
          {vidrios.map((p, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "7px 0", borderTop: i === 0 ? "none" : `1px solid ${T.border}` }}>
            <span style={{ flex: 1 }}>{p.nombre}<span style={{ fontSize: 10, color: T.muted, marginLeft: 5 }}>{p.mueble}</span></span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, marginRight: 10 }}>{mm(p.w)} × {mm(p.h)}</span>
            <span style={{ background: "rgba(61,126,166,.12)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 800, color: "#3D7EA6", minWidth: 26, textAlign: "center" }}>{p.cant}</span>
          </div>)}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 8, marginTop: 4, borderTop: `2px solid ${T.border}`, fontWeight: 800 }}><span>Total vidrio</span><span style={{ color: "#3D7EA6" }}>{herr.vidrioM2.toFixed(2)} m² · marco {herr.marcoMl.toFixed(1)} m</span></div>
        </div>}
        {herr.lista.length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 12, marginBottom: 10, boxShadow: SHDsm }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>🔩 Herrajes</div>
          {[...new Set(herr.lista.map(h => h.grupo))].map(g => <div key={g} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{g}</div>
            {herr.lista.filter(h => h.grupo === g).map((h, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 0", borderTop: i === 0 ? "none" : `1px solid ${T.border}` }}>
              <span style={{ flex: 1 }}>{h.item}{h.detalle ? <span style={{ fontSize: 10, color: T.muted, display: "block" }}>{h.detalle}</span> : null}</span>
              <span style={{ background: T.al, borderRadius: 6, padding: "3px 9px", fontSize: 11.5, fontWeight: 800, color: T.accent, whiteSpace: "nowrap" }}>{h.cant} {h.unidad}</span>
            </div>)}
          </div>)}
        </div>}
        <button onClick={() => setPdfHtml(reporteHTML(proyecto, cfg, piezas, resPlaca, resFondo, resumen, herr, vidrios))} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 11, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Despiece + herrajes + plan de corte en PDF</button>
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
        <button onClick={() => setPdfHtml(reporteHTML(proyecto, cfg, piezas, resPlaca, resFondo, resumen, herr, vidrios))} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 11, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>Plan de corte en PDF (para el aserradero)</button>
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
        {num(form.puertas) > 0 && <>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Sistema de puerta</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {[["batiente", "Batiente (bisagras)"], ["corrediza", "Corrediza (riel)"]].map(([k, l]) => <button key={k} onClick={() => setF("sistemaPuerta", k)} style={{ flex: 1, background: (form.sistemaPuerta || "batiente") === k ? T.accent : T.al, color: (form.sistemaPuerta || "batiente") === k ? "#fff" : T.sub, border: `1px solid ${(form.sistemaPuerta || "batiente") === k ? T.accent : T.border}`, borderRadius: 9, padding: "10px 6px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Material de puerta</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {[["melamina", "Melamina 18mm"], ["vidrio", "Vidrio (marco alum.)"]].map(([k, l]) => <button key={k} onClick={() => setF("matPuerta", k)} style={{ flex: 1, background: (form.matPuerta || "melamina") === k ? T.accent : T.al, color: (form.matPuerta || "melamina") === k ? "#fff" : T.sub, border: `1px solid ${(form.matPuerta || "melamina") === k ? T.accent : T.border}`, borderRadius: 9, padding: "10px 6px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
            </div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 5 }}>{(form.matPuerta || "melamina") === "vidrio" ? "El vidrio no sale de la placa: va al listado de vidrios y marcos." : (form.sistemaPuerta === "corrediza" ? "Corredizas: las hojas se superponen " + (num(cfg.solape) || 25) + "mm." : "Batientes: bisagras cazoleta según el alto.")}</div>
          </div>
        </>}
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
        {[["placaW", "Ancho de placa (mm)"], ["placaH", "Alto de placa (mm)"], ["esp", "Espesor placa (mm)"], ["espFondo", "Espesor fondo (mm)"], ["kerf", "Espesor de sierra / kerf (mm)"], ["luz", "Luz entre frentes (mm)"], ["retranqueo", "Retranqueo de estante (mm)"], ["holgura", "Holgura de estante (mm)"], ["correderaLuz", "Luz corredera por lado (mm)"], ["cantoEsp", "Ancho de canto (mm)"], ["alturaAlacena", "Altura de alacenas al piso (mm)"], ["espMesada", "Espesor de mesada (mm)"], ["precioPlaca", "Precio por placa ($)"], ["precioCanto", "Precio canto por metro ($)"]].map(([k, l]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: T.sub, flex: 1 }}>{l}</span>
            <input value={cfg[k]} onChange={e => setC(k, num(e.target.value))} inputMode="numeric" style={{ ...inpSm, width: 110, textAlign: "right" }} />
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11.5, color: T.sub, fontWeight: 800, textTransform: "uppercase" }}>Tipo de bisagra</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {Object.entries(BISAGRAS).map(([k, v]) => <button key={k} onClick={() => setC("tipoBisagra", k)} style={{ textAlign: "left", background: cfg.tipoBisagra === k ? T.al : T.card, color: T.text, border: `1.5px solid ${cfg.tipoBisagra === k ? T.accent : T.border}`, borderRadius: 9, padding: "10px 12px", cursor: "pointer" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: cfg.tipoBisagra === k ? T.accent : T.text }}>{cfg.tipoBisagra === k ? "✓ " : ""}{v.nom}</div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{v.det}</div>
            </button>)}
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11.5, color: T.sub, fontWeight: 800, textTransform: "uppercase" }}>Tipo de corredera</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {Object.entries(CORREDERAS_T).map(([k, v]) => <button key={k} onClick={() => setC("tipoCorredera", k)} style={{ textAlign: "left", background: cfg.tipoCorredera === k ? T.al : T.card, color: T.text, border: `1.5px solid ${cfg.tipoCorredera === k ? T.accent : T.border}`, borderRadius: 9, padding: "10px 12px", cursor: "pointer" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: cfg.tipoCorredera === k ? T.accent : T.text }}>{cfg.tipoCorredera === k ? "✓ " : ""}{v.nom}</div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{v.det}</div>
            </button>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={() => setC("veta", !cfg.veta)} style={{ flex: 1, background: cfg.veta ? T.accent : T.al, color: cfg.veta ? "#fff" : T.sub, border: `1px solid ${cfg.veta ? T.accent : T.border}`, borderRadius: 9, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.veta ? "✓ " : ""}Respetar veta</button>
          <button onClick={() => setC("cierreSuave", !cfg.cierreSuave)} style={{ flex: 1, background: cfg.cierreSuave ? T.accent : T.al, color: cfg.cierreSuave ? "#fff" : T.sub, border: `1px solid ${cfg.cierreSuave ? T.accent : T.border}`, borderRadius: 9, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.cierreSuave ? "✓ " : ""}Cierre suave</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => setC("descontarFondo", !cfg.descontarFondo)} style={{ flex: 1, background: cfg.descontarFondo ? T.accent : T.al, color: cfg.descontarFondo ? "#fff" : T.sub, border: `1px solid ${cfg.descontarFondo ? T.accent : T.border}`, borderRadius: 9, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.descontarFondo ? "✓ " : ""}Descontar fondo de la prof.</button>
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>Respetar veta: las piezas no se rotan al optimizar (usa más placas pero mantiene el sentido del dibujo). Descontar fondo: la profundidad que cargás incluye el fondo aplicado atrás.</div>
        <button onClick={() => setVerCfg(false)} style={{ width: "100%", marginTop: 14, background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 10, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Listo</button>
      </div>
    </div>}

    {pdfHtml && <PdfOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
  </div>;
}
