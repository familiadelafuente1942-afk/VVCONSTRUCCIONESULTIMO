import React, { useState, useEffect, useRef } from "react";
// VERSION: v17 (Muebles: medidas propias de la isla)

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
async function subirRender(dataUrl) {
  try {
    const b = await (await fetch(dataUrl)).blob();
    const path = `muebles/render-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
    const r = await fetch(`${SUPA_URL}/storage/v1/object/bco-media/${path}`, { method: "POST", headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": "image/png", "x-upsert": "true" }, body: b });
    if (r.ok) return `${SUPA_URL}/storage/v1/object/public/bco-media/${path}`;
  } catch { }
  return "";
}
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
  matCuerpo: "f_blanco", matFrente: "f_dakar", sinSombras: false,
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
const VANO_DEF = { ancho: 3000, alto: 2600, prof: 600, paredB: 0, isla: false, islaAncho: 2400, islaProf: 900, islaAlto: 900, islaSep: 1100, islaVoladizo: 300, banquetas: 3 };

// ---------- CATÁLOGO DE PLACAS (Egger / Faplac) ----------
// hex = color base aproximado para el render. Si cargás la FOTO de la placa, el render usa la foto real.
// Medidas de tablero según proveedor: Egger 2800×2070 · Faplac melamina 1830×2750 · Faplac fondos 1830×2600
const MATERIALES = [
  // ---- EGGER (2800 × 2070) ----
  { id: "e_h1145", marca: "Egger", cod: "H1145 ST10", nom: "Roble Bardolino Natural", hex: "#C9AD86", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_h3303", marca: "Egger", cod: "H3303 ST10", nom: "Roble Hamilton Natural", hex: "#BFA979", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_h1334", marca: "Egger", cod: "H1334 ST9", nom: "Roble Sorano Claro", hex: "#D4BFA3", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_h1312", marca: "Egger", cod: "H1312 ST10", nom: "Roble Whiteriver Blanqueado", hex: "#DED2C0", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_h1199", marca: "Egger", cod: "H1199 ST12", nom: "Roble Termo Negro", hex: "#4A403A", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_h1307", marca: "Egger", cod: "H1307 ST19", nom: "Nogal Warmia Marrón", hex: "#7A5A42", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_h1277", marca: "Egger", cod: "H1277 ST9", nom: "Acacia Lakeland Crema", hex: "#DCC9AC", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_h1225", marca: "Egger", cod: "H1225 ST12", nom: "Fresno Trondheim", hex: "#C4B49B", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_h305", marca: "Egger", cod: "H305 ST12", nom: "Roble Tonsberg Natural", hex: "#BFA47F", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_h309", marca: "Egger", cod: "H309 ST12", nom: "Roble Tonsberg Marrón Oscuro", hex: "#6B5340", tipo: "madera", pw: 2800, ph: 2070 },
  { id: "e_w1100", marca: "Egger", cod: "W1100 PM", nom: "Blanco Alpino", hex: "#F2F1EC", tipo: "liso", pw: 2800, ph: 2070 },
  { id: "e_u999", marca: "Egger", cod: "U999 ST19", nom: "Negro", hex: "#22242A", tipo: "liso", pw: 2800, ph: 2070 },
  { id: "e_u961", marca: "Egger", cod: "U961 PM", nom: "Gris Grafito", hex: "#5C6067", tipo: "liso", pw: 2800, ph: 2070 },
  // ---- FAPLAC (1830 × 2750) ----
  { id: "f_dakar", marca: "Faplac", cod: "Roble Dakar", nom: "Roble Dakar (línea Maderas)", hex: "#B99A76", tipo: "madera", pw: 1830, ph: 2750 },
  { id: "f_cedro", marca: "Faplac", cod: "Cedro", nom: "Cedro (línea Maderas / Nature)", hex: "#B08258", tipo: "madera", pw: 1830, ph: 2750 },
  { id: "f_ebano", marca: "Faplac", cod: "Ébano Negro", nom: "Ébano Negro", hex: "#3A342F", tipo: "madera", pw: 1830, ph: 2750 },
  { id: "f_nogal", marca: "Faplac", cod: "Nogal", nom: "Nogal", hex: "#7B5B41", tipo: "madera", pw: 1830, ph: 2750 },
  { id: "f_paraiso", marca: "Faplac", cod: "Paraíso", nom: "Paraíso", hex: "#C6A882", tipo: "madera", pw: 1830, ph: 2750 },
  { id: "f_blanco", marca: "Faplac", cod: "Blanco", nom: "Blanco", hex: "#F4F3EF", tipo: "liso", pw: 1830, ph: 2750 },
  { id: "f_tapir", marca: "Faplac", cod: "Gris Tapir", nom: "Gris Tapir (Mesopotamia)", hex: "#8E8B85", tipo: "liso", pw: 1830, ph: 2750 },
  { id: "f_caliza", marca: "Faplac", cod: "Caliza", nom: "Caliza (Mesopotamia)", hex: "#D9D3C8", tipo: "liso", pw: 1830, ph: 2750 },
  { id: "f_jade", marca: "Faplac", cod: "Jade", nom: "Jade (Mesopotamia)", hex: "#6E8778", tipo: "liso", pw: 1830, ph: 2750 },
];
const matPorId = (id, extra) => [...(extra || []), ...MATERIALES].find(m => m.id === id) || MATERIALES[0];
const CORREDERAS = [250, 300, 350, 400, 450, 500, 550, 600];
// Bisagras según alto de puerta (norma habitual)
function nBisagras(alto) { const h = num(alto); if (h <= 900) return 2; if (h <= 1600) return 3; if (h <= 2000) return 4; if (h <= 2400) return 5; return 6; }
function largoCorredera(profCaja) { const p = num(profCaja); let best = CORREDERAS[0]; for (const c of CORREDERAS) if (c <= p) best = c; return best; }
const TIPOS = [["bajo", "Bajo mesada"], ["alacena", "Alacena"], ["placard", "Placard"], ["cajonera", "Cajonera"], ["electro", "Electrodoméstico"], ["generico", "Genérico"]];
// Electrodomésticos: si "mueble" es true, se corta la caja que lo aloja (columna/bajo). Si no, va suelto (heladera).
const ELECTROS = {
  anafe: { nom: "Anafe / cocina", ancho: 600, alto: 860, prof: 580, zona: "piso", mueble: true, en: "induction cooktop set into the countertop, with base cabinet below" },
  horno: { nom: "Horno empotrado", ancho: 600, alto: 860, prof: 580, zona: "piso", mueble: true, en: "built-in stainless steel oven in the base unit" },
  columna: { nom: "Columna horno + micro", ancho: 600, alto: 2100, prof: 580, zona: "piso", mueble: true, en: "tall appliance column with a built-in oven and a microwave stacked above" },
  microondas: { nom: "Microondas", ancho: 600, alto: 400, prof: 380, zona: "colgado", mueble: true, en: "built-in microwave" },
  campana: { nom: "Campana", ancho: 600, alto: 600, prof: 500, zona: "colgado", mueble: false, en: "stainless steel extractor hood above the cooktop" },
  heladera: { nom: "Heladera", ancho: 700, alto: 1800, prof: 700, zona: "piso", mueble: false, en: "large stainless steel french-door refrigerator" },
  lavavajillas: { nom: "Lavavajillas", ancho: 600, alto: 860, prof: 580, zona: "piso", mueble: false, en: "integrated dishwasher" },
  bacha: { nom: "Bacha / pileta", ancho: 800, alto: 860, prof: 580, zona: "piso", mueble: true, en: "undermount sink with a black mixer tap" },
  cafetera: { nom: "Cafetera", ancho: 300, alto: 400, prof: 400, zona: "mesada", mueble: false, en: "espresso machine on the countertop" },
};
const DEF_TIPO = {
  bajo: { ancho: 600, alto: 860, prof: 580, zocalo: 100, estantes: 1, puertas: 1, cajones: 0, techoTravesanos: true, armado: "lat" },
  alacena: { ancho: 600, alto: 700, prof: 320, zocalo: 0, estantes: 1, puertas: 1, cajones: 0, techoTravesanos: false, armado: "lat" },
  placard: { ancho: 1200, alto: 2400, prof: 600, zocalo: 80, estantes: 3, puertas: 2, cajones: 0, techoTravesanos: false, armado: "lat", sistemaPuerta: "corrediza", matPuerta: "melamina" },
  cajonera: { ancho: 600, alto: 860, prof: 580, zocalo: 100, estantes: 0, puertas: 0, cajones: 3, techoTravesanos: true, armado: "lat" },
  electro: { ancho: 600, alto: 860, prof: 580, zocalo: 100, estantes: 0, puertas: 0, cajones: 0, techoTravesanos: true, armado: "lat", electro: "anafe" },
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
  // Electrodoméstico: si no lleva mueble (heladera, campana, lavavajillas) no se corta nada
  if (m.tipo === "electro") {
    const E = ELECTROS[m.electro] || ELECTROS.anafe;
    if (!E.mueble) return [];
  }
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
function Render3D({ m, cfg, abierto, mats }) {
  const e = num(cfg.esp) || 18, ef = num(cfg.espFondo) || 3;
  const A = num(m.ancho) || 1, H = num(m.alto) || 1, P = num(m.prof) || 1;
  const z = num(m.zocalo) || 0, Hc = Math.max(1, H - z);
  const Pc = Math.max(1, cfg.descontarFondo && m.fondo !== false ? P - ef : P);
  const [rot, setRot] = useState({ yaw: 28, pitch: 16 });
  const drag = useRef(null);
  const uidR = useRef("r" + Math.random().toString(36).slice(2, 7));
  const U = uidR.current;

  const matCuerpo = matPorId(m.matCuerpo || cfg.matCuerpo, mats);
  const matFrente = matPorId(m.matFrente || cfg.matFrente || m.matCuerpo || cfg.matCuerpo, mats);

  const onDown = (cx, cy) => { drag.current = { x: cx, y: cy, yaw: rot.yaw, pitch: rot.pitch }; };
  const onMove = (cx, cy) => { const d = drag.current; if (!d) return; const yaw = d.yaw + (cx - d.x) * 0.45; let pitch = d.pitch - (cy - d.y) * 0.45; pitch = Math.max(-80, Math.min(80, pitch)); setRot({ yaw, pitch }); };
  const onUp = () => { drag.current = null; };

  const R = (x, y, zz) => {
    const cx = A / 2, cy = H / 2, cz = Pc / 2;
    const X = x - cx, Y = y - cy, Z = zz - cz;
    const ry = rot.yaw * Math.PI / 180, rp = rot.pitch * Math.PI / 180;
    const X1 = X * Math.cos(ry) + Z * Math.sin(ry);
    const Z1 = -X * Math.sin(ry) + Z * Math.cos(ry);
    const Y2 = Y * Math.cos(rp) - Z1 * Math.sin(rp);
    const Z2 = Y * Math.sin(rp) + Z1 * Math.cos(rp);
    return { x: X1, y: -Y2, z: Z2 };
  };
  const pt = (a) => { const p = R(a[0], a[1], a[2]); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; };
  const prof = (pts) => pts.reduce((s, a) => s + R(a[0], a[1], a[2]).z, 0) / pts.length;
  // Iluminación real: normal de la cara · dirección de luz
  const luz = (pts) => {
    const p0 = R(...pts[0]), p1 = R(...pts[1]), p2 = R(...pts[2]);
    const u = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
    const v = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };
    let n = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const L = Math.hypot(n.x, n.y, n.z) || 1; n = { x: n.x / L, y: n.y / L, z: n.z / L };
    const lz = { x: -0.35, y: -0.55, z: -0.76 }; // luz desde arriba-izquierda hacia el frente
    const d = Math.abs(n.x * lz.x + n.y * lz.y + n.z * lz.z);
    return { int: 0.55 + 0.45 * d, spec: Math.pow(d, 18) };
  };

  const caras = [];
  const cara = (key, pts, mat, tint) => { const l = luz(pts); caras.push({ key, pts, mat, z: prof(pts), int: l.int, spec: l.spec, tint }); };
  const nPu = num(m.puertas), nCj = num(m.cajones), nEst = num(m.estantes);
  const L = num(cfg.luz) || 3;
  const C = matCuerpo, F = matFrente;

  cara("fondo", [[0, z, Pc], [A, z, Pc], [A, z + Hc, Pc], [0, z + Hc, Pc]], C);
  for (let i = 1; i <= nEst; i++) { const yy = z + (Hc / (nEst + 1)) * i; cara("est" + i, [[e, yy, 0], [A - e, yy, 0], [A - e, yy, Pc], [e, yy, Pc]], C); cara("estf" + i, [[e, yy - e, 0], [A - e, yy - e, 0], [A - e, yy, 0], [e, yy, 0]], C); }
  cara("piso", [[0, z + e, 0], [A, z + e, 0], [A, z + e, Pc], [0, z + e, Pc]], C);
  cara("pisoB", [[0, z, 0], [A, z, 0], [A, z, Pc], [0, z, Pc]], C);
  if (!m.techoTravesanos) { cara("techo", [[0, z + Hc - e, 0], [A, z + Hc - e, 0], [A, z + Hc - e, Pc], [0, z + Hc - e, Pc]], C); cara("techoT", [[0, z + Hc, 0], [A, z + Hc, 0], [A, z + Hc, Pc], [0, z + Hc, Pc]], C); }
  else { cara("tr1", [[e, z + Hc, 0], [A - e, z + Hc, 0], [A - e, z + Hc, 90], [e, z + Hc, 90]], C); cara("tr2", [[e, z + Hc, Pc - 90], [A - e, z + Hc, Pc - 90], [A - e, z + Hc, Pc], [e, z + Hc, Pc]], C); }
  cara("latI", [[0, z, 0], [0, z, Pc], [0, z + Hc, Pc], [0, z + Hc, 0]], C);
  cara("latIe", [[e, z, 0], [e, z, Pc], [e, z + Hc, Pc], [e, z + Hc, 0]], C);
  cara("latD", [[A, z, 0], [A, z, Pc], [A, z + Hc, Pc], [A, z + Hc, 0]], C);
  cara("latDe", [[A - e, z, 0], [A - e, z, Pc], [A - e, z + Hc, Pc], [A - e, z + Hc, 0]], C);
  if (z > 0) cara("zoc", [[0, 0, 0], [A, 0, 0], [A, z, 0], [0, z, 0]], C, "#000");
  if (!abierto) {
    if (nCj > 0) { const altoFr = (Hc - (nCj + 1) * L) / nCj; for (let i = 0; i < nCj; i++) { const y0 = z + L + i * (altoFr + L); cara("cj" + i, [[1, y0, 0], [A - 1, y0, 0], [A - 1, y0 + altoFr, 0], [1, y0 + altoFr, 0]], F); } }
    if (nPu > 0) {
      const vid = m.matPuerta === "vidrio";
      const corr = m.sistemaPuerta === "corrediza", sol = num(cfg.solape) || 25;
      const aPu = corr ? (A + sol * (nPu - 1)) / nPu : (A - (nPu - 1) * L - 2) / nPu;
      for (let i = 0; i < nPu; i++) { const x0 = corr ? i * (aPu - sol) : 1 + i * (aPu + L); cara("pu" + i, [[x0, z + 1, corr ? -6 : 0], [x0 + aPu, z + 1, corr ? -6 : 0], [x0 + aPu, z + Hc - 1, corr ? -6 : 0], [x0, z + Hc - 1, corr ? -6 : 0]], vid ? { id: "vidrio", hex: "#BBD3DE", tipo: "vidrio" } : F); }
    }
  }
  caras.sort((a, b) => b.z - a.z);

  const todos = caras.flatMap(c => c.pts.map(a => R(a[0], a[1], a[2])));
  const xs = todos.map(p => p.x), ys = todos.map(p => p.y);
  const pad = Math.max(A, H, Pc) * 0.10;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const usados = [...new Map(caras.map(c => [c.mat.id, c.mat])).values()];

  return <div style={{ background: "linear-gradient(180deg,#FBFAF7 0%,#EFEDE8 100%)", borderRadius: 14, padding: 10, border: `1px solid ${T.border}` }}>
    <svg viewBox={`${minX} ${minY} ${Math.max(1, maxX - minX)} ${Math.max(1, maxY - minY)}`}
      onMouseDown={ev => { ev.preventDefault(); onDown(ev.clientX, ev.clientY); }}
      onMouseMove={ev => onMove(ev.clientX, ev.clientY)} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={ev => { const t = ev.touches[0]; onDown(t.clientX, t.clientY); }}
      onTouchMove={ev => { ev.preventDefault(); const t = ev.touches[0]; onMove(t.clientX, t.clientY); }}
      onTouchEnd={onUp}
      style={{ width: "100%", height: "auto", maxHeight: 340, display: "block", cursor: "grab", touchAction: "none" }} preserveAspectRatio="xMidYMid meet">
      <defs>
        {usados.map(mt => {
          if (mt.foto) return <pattern key={mt.id} id={`${U}_p_${mt.id}`} patternUnits="objectBoundingBox" width="1" height="1"><image href={mt.foto} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" /></pattern>;
          if (mt.tipo === "madera") return <pattern key={mt.id} id={`${U}_p_${mt.id}`} patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
            <rect x="0" y="0" width="1" height="1" fill={mt.hex} />
            {vetaBandas(mt.hex, mt.id).map((b, i) => <rect key={i} x={b.x} y="0" width={b.w} height="1" fill={mezcla(mt.hex, b.k)} opacity={b.o} />)}
          </pattern>;
          return null;
        })}
      </defs>
      {caras.map(c => {
        const mt = c.mat;
        const base = (mt.foto || mt.tipo === "madera") ? `url(#${U}_p_${mt.id})` : (mt.hex || "#DDD");
        const pts = c.pts.map(pt).join(" ");
        const sombra = cfg.sinSombras ? 0 : Math.max(0, 1 - c.int);
        return <g key={c.key}>
          <polygon points={pts} fill={base} fillOpacity={mt.tipo === "vidrio" ? 0.55 : 1} stroke="none" />
          {c.tint && <polygon points={pts} fill={c.tint} fillOpacity="0.35" />}
          {sombra > 0.001 && <polygon points={pts} fill="#0A1420" fillOpacity={sombra * 0.45} />}
          {!cfg.sinSombras && c.spec > 0.02 && <polygon points={pts} fill="#FFFFFF" fillOpacity={c.spec * (mt.tipo === "vidrio" ? 0.5 : 0.14)} />}
          <polygon points={pts} fill="none" stroke="#2A3542" strokeOpacity="0.5" strokeWidth={Math.max(A, H) / 900} strokeLinejoin="round" />
        </g>;
      })}
    </svg>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: 15 }}>↻</span>
      <input type="range" min="-180" max="180" value={Math.round(rot.yaw)} onChange={ev => setRot(r => ({ ...r, yaw: num(ev.target.value) }))} style={{ flex: 1, accentColor: T.accent }} />
      <input type="range" min="-80" max="80" value={Math.round(rot.pitch)} onChange={ev => setRot(r => ({ ...r, pitch: num(ev.target.value) }))} style={{ flex: 1, accentColor: T.accent }} />
    </div>
    <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
      {[["Frente", 0, 0], ["3/4", 28, 16], ["Lado", 90, 0], ["Arriba", 0, 70], ["Atrás", 180, 10]].map(([l, y, p]) => <button key={l} onClick={() => setRot({ yaw: y, pitch: p })} style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "5px 9px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.muted, marginTop: 6, padding: "0 2px", gap: 8 }}>
      <span>{mm(A)}×{mm(H)}×{mm(P)} mm</span>
      <span style={{ textAlign: "right" }}>{matCuerpo.marca} {matCuerpo.cod}{matFrente.id !== matCuerpo.id ? ` · frentes ${matFrente.cod}` : ""}</span>
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
const zonaElectro = (m) => { const E = ELECTROS[m.electro]; return E ? E.zona : "piso"; };
const esColgado = (m) => m.tipo === "alacena" || (m.tipo === "electro" && zonaElectro(m) === "colgado");
function distribuir(muebles, pared, zona) {
  // Devuelve muebles de esa pared/zona con su x acumulado, separados por fila (piso / colgado)
  const de = muebles.filter(m => (m.pared || "A") === pared && (m.zona || "pared") === (zona || "pared"));
  const piso = [], colg = [];
  let xp = 0, xc = 0;
  de.forEach(m => {
    const A = num(m.ancho), n = Math.max(1, num(m.cant) || 1);
    if (m.tipo === "electro" && zonaElectro(m) === "mesada") return; // cafetera: solo decorativa
    for (let i = 0; i < n; i++) {
      if (esColgado(m)) { colg.push({ m, x: xc, w: A }); xc += A; }
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
  const planta = <svg viewBox={`${-pad} ${-pad} ${planW + pad * 2} ${planH + pad * 2.6}`} style={{ width: "100%", height: "auto", maxHeight: 340, display: "block" }} preserveAspectRatio="xMidYMid meet">
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
  const frente = <svg viewBox={`${-padF} ${-padF * 0.7} ${anchoPared + padF * 2} ${H + padF * 2.1}`} style={{ width: "100%", height: "auto", maxHeight: 360, display: "block" }} preserveAspectRatio="xMidYMid meet">
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


// Veta de madera por bandas (robusta en Safari; los filtros feTurbulence rompen el SVG en iPad)
function vetaBandas(hex, seed) {
  let x = (String(seed || "s").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 97) + 3;
  const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  const bandas = [];
  let px = 0;
  while (px < 1) {
    const w = 0.012 + rnd() * 0.05;
    const k = 0.86 + rnd() * 0.22;
    const o = 0.18 + rnd() * 0.5;
    bandas.push({ x: px, w: Math.min(w, 1 - px), k, o });
    px += w + rnd() * 0.03;
  }
  return bandas;
}

// ---------- NIVEL / PLOMADA (sensores del iPhone) ----------
function Nivel({ onClose }) {
  const [ang, setAng] = useState({ beta: 0, gamma: 0 });
  const [permiso, setPermiso] = useState(typeof DeviceOrientationEvent === "undefined" || typeof DeviceOrientationEvent.requestPermission !== "function");
  useEffect(() => {
    if (!permiso) return;
    const h = (e) => setAng({ beta: e.beta || 0, gamma: e.gamma || 0 });
    window.addEventListener("deviceorientation", h, true);
    return () => window.removeEventListener("deviceorientation", h, true);
  }, [permiso]);
  const pedir = async () => { try { const r = await DeviceOrientationEvent.requestPermission(); if (r === "granted") setPermiso(true); else alert("Necesito permiso para usar los sensores."); } catch { alert("No pude activar los sensores."); } };
  const g = ang.gamma, b = ang.beta;
  const nivelado = Math.abs(g) < 0.6;
  const plomada = Math.abs(Math.abs(b) - 90) < 0.6;
  return <div style={{ position: "fixed", inset: 0, background: "#0C1016", zIndex: 700, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", gap: 8, padding: "10px 12px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
      <button onClick={onClose} style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕</button>
      <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700 }}>Nivel y plomada</div>
    </div>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: 20 }}>
      {!permiso ? <button onClick={pedir} style={{ background: BRASS, color: "#fff", border: "none", borderRadius: 12, padding: "16px 26px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Activar sensores</button> : <>
        <div style={{ width: 250, height: 250, borderRadius: "50%", border: `3px solid ${nivelado ? "#16A34A" : "rgba(255,255,255,.2)"}`, position: "relative", background: "rgba(255,255,255,.04)" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "rgba(255,255,255,.25)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "rgba(255,255,255,.25)" }} />
          <div style={{ position: "absolute", width: 54, height: 54, borderRadius: "50%", background: nivelado ? "#16A34A" : BRASS, left: `calc(50% - 27px + ${Math.max(-95, Math.min(95, g * 4))}px)`, top: `calc(50% - 27px + ${Math.max(-95, Math.min(95, (b - 90) * 2))}px)`, boxShadow: "0 4px 18px rgba(0,0,0,.5)", transition: "background .2s" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: nivelado ? "#16A34A" : "#fff", fontVariantNumeric: "tabular-nums" }}>{g.toFixed(1)}°</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", marginTop: 4 }}>Inclinación lateral {nivelado ? "· NIVELADO ✓" : ""}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: plomada ? "#16A34A" : "rgba(255,255,255,.7)", marginTop: 14, fontVariantNumeric: "tabular-nums" }}>{(Math.abs(b) - 90).toFixed(1)}° <span style={{ fontSize: 12, fontWeight: 600 }}>a plomo {plomada ? "✓" : ""}</span></div>
        </div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.4)", textAlign: "center", lineHeight: 1.6, maxWidth: 300 }}>Apoyá el borde del teléfono contra la pared o el mueble.<br />Verde = a nivel / a plomo.</div>
      </>}
    </div>
  </div>;
}

// ---------- LEER MEDIDAS DE UNA FOTO (IA) ----------
async function leerMedidasIA(dataUrl) {
  const m = String(dataUrl).match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) throw new Error("Imagen inválida.");
  const body = {
    model: "claude-sonnet-5", max_tokens: 500,
    messages: [{
      role: "user", content: [
        { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
        { type: "text", text: 'Esta imagen es una captura de la app Medir del iPhone, un plano, o una foto de un ambiente con medidas anotadas. Leé las medidas del VANO (el hueco donde va un mueble de cocina o placard). Respondé SOLO con un JSON, sin texto alrededor: {"ancho":N,"alto":N,"prof":N,"nota":"texto corto"} donde N son milímetros (si ves metros, convertí: 3,45 m = 3450). Si alguna medida no aparece, poné 0. En "nota" explicá brevemente de dónde sacaste los números.' }
      ]
    }]
  };
  const r = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const txt = await r.text();
  let d = null; try { d = JSON.parse(txt); } catch { throw new Error(`El servidor respondió ${r.status}.`); }
  if (!r.ok) throw new Error((d && d.error && d.error.message) || "Error de la IA.");
  const t = (d.content || []).map(x => x.text || "").join("");
  const j = t.match(/\{[\s\S]*\}/);
  if (!j) throw new Error("No pude leer medidas en esa imagen.");
  return JSON.parse(j[0]);
}

// ---------- RENDER FINAL FOTORREALISTA (escena completa en perspectiva) ----------
const hexRGB = (h) => { const s = String(h || "#ccc").replace("#", ""); return { r: parseInt(s.slice(0, 2), 16) || 200, g: parseInt(s.slice(2, 4), 16) || 200, b: parseInt(s.slice(4, 6), 16) || 200 }; };
const mezcla = (hex, k) => { const c = hexRGB(hex); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`; };

function RenderEscena({ vano, muebles, cfg, mats, proyecto, deco, onClose }) {
  const [cam, setCam] = useState({ yaw: -18, pitch: 6, dist: 2.6 });
  const [verIA, setVerIA] = useState(false);
  const svgRef = useRef(null);
  const drag = useRef(null);
  const U = "esc";
  const ef = num(cfg.espFondo) || 3;
  const W = Math.max(300, num(vano.ancho) || 3000);
  const HV = Math.max(300, num(vano.alto) || 2600);
  const hAlac = num(cfg.alturaAlacena) || 1400, eMes = num(cfg.espMesada) || 30;
  const L = num(cfg.luz) || 3;
  const d = distribuir(muebles, "A", "pared");
  const dI = distribuir(muebles, "A", "isla");
  const hayIsla = !!vano.isla;
  const matC = matPorId(cfg.matCuerpo, mats), matF = matPorId(cfg.matFrente, mats);

  const onDown = (x, y) => { drag.current = { x, y, ...cam }; };
  const onMove = (x, y) => { const g = drag.current; if (!g) return; setCam({ ...cam, yaw: g.yaw + (x - g.x) * 0.22, pitch: Math.max(-20, Math.min(40, g.pitch - (y - g.y) * 0.16)) }); };
  const onUp = () => { drag.current = null; };

  const anchoTotal = Math.max(W, d.anchoPiso, d.anchoColg, 600);
  const profMax = Math.max(300, ...muebles.map(m => num(m.prof) || 0));
  const zExtra = (vano.isla ? (num(vano.islaSep) || 1100) + (num(vano.islaProf) || 900) + (num(vano.islaVoladizo) || 0) + 700 : 0);
  const escala = Math.max(anchoTotal, HV, zExtra * 1.1);
  const D = escala * (2.2 + cam.dist), F = escala * 1.5;   // cámara siempre lejos: sin perspectiva extrema
  const cx = anchoTotal / 2, cy = HV * 0.42, cz = (profMax - zExtra) / 2;

  const proj = (x, y, z) => {
    const X = x - cx, Y = y - cy, Z = z - cz;
    const ry = cam.yaw * Math.PI / 180, rp = cam.pitch * Math.PI / 180;
    const X1 = X * Math.cos(ry) + Z * Math.sin(ry);
    const Z1 = -X * Math.sin(ry) + Z * Math.cos(ry);
    const Y2 = Y * Math.cos(rp) - Z1 * Math.sin(rp);
    const Z2 = Y * Math.sin(rp) + Z1 * Math.cos(rp);
    const dist = Math.max(escala * 0.9, D - Z2);           // nunca cerca de 0 -> no hay agujas
    const k = F / dist;
    return { x: X1 * k, y: -Y2 * k, dist };
  };
  const P = (a) => { const p = proj(a[0], a[1], a[2]); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; };
  const zMed = (pts) => pts.reduce((s, a) => s + proj(a[0], a[1], a[2]).dist, 0) / pts.length;
  // área con signo: si es negativa la cara mira para atrás -> no se dibuja
  const areaSigno = (pts) => { const q = pts.map(a => proj(a[0], a[1], a[2])); let s = 0; for (let i = 0; i < q.length; i++) { const j = (i + 1) % q.length; s += q[i].x * q[j].y - q[j].x * q[i].y; } return s / 2; };
  const luzCara = (pts) => {
    const q = pts.map(a => { const X = a[0] - cx, Y = a[1] - cy, Z = a[2] - cz; const ry = cam.yaw * Math.PI / 180, rp = cam.pitch * Math.PI / 180; const X1 = X * Math.cos(ry) + Z * Math.sin(ry); const Z1 = -X * Math.sin(ry) + Z * Math.cos(ry); return { x: X1, y: Y * Math.cos(rp) - Z1 * Math.sin(rp), z: Y * Math.sin(rp) + Z1 * Math.cos(rp) }; });
    const u = { x: q[1].x - q[0].x, y: q[1].y - q[0].y, z: q[1].z - q[0].z };
    const v = { x: q[2].x - q[0].x, y: q[2].y - q[0].y, z: q[2].z - q[0].z };
    let n = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const len = Math.hypot(n.x, n.y, n.z) || 1; n = { x: n.x / len, y: n.y / len, z: n.z / len };
    const lz = { x: -0.40, y: 0.64, z: 0.66 };
    const dp = Math.abs(n.x * lz.x + n.y * lz.y + n.z * lz.z);
    return { int: 0.50 + 0.50 * dp, spec: Math.pow(dp, 20) };
  };

  const caras = [];
  const addCara = (key, pts, mat, opts) => {
    if (areaSigno(pts) >= 0) return;                       // cara que mira para el otro lado: no se dibuja
    const l = luzCara(pts);
    caras.push({ key, pts, mat, z: zMed(pts), int: l.int, spec: l.spec, ...(opts || {}) });
  };

  const MESADA = { id: "mesada", hex: "#33373E", tipo: "liso", gloss: true };
  const ZOCALO = { id: "zoc", hex: "#22252A", tipo: "liso" };
  const TIRA = { id: "tira", hex: "#9AA1AA", tipo: "liso" };
  const INOX = { id: "inox", hex: "#8D939B", tipo: "liso", gloss: true };
  const VIDRIO_N = { id: "vidn", hex: "#1A1D22", tipo: "liso", gloss: true };
  const BANQ = { id: "banq", hex: "#26292E", tipo: "liso" };

  // Caja cerrada: frente + laterales + techo + piso (sin interior: no se ve y ensuciaba el dibujo)
  const modulo = (it, base) => {
    const m = it.m, A = it.w, x0 = it.x;
    const alt = num(m.alto) || 700, pf = Math.max(100, num(m.prof) || 500), zc = num(m.zocalo) || 0;
    const y0 = base + zc, Hc = Math.max(50, alt - zc);
    const mc = matPorId(m.matCuerpo || cfg.matCuerpo, mats), mf = matPorId(m.matFrente || cfg.matFrente, mats);
    const x1 = x0 + A, y1 = y0 + Hc, zF = 0, zB = pf;
    const nPu = num(m.puertas), nCj = num(m.cajones);
    const vid = m.matPuerta === "vidrio";
    const E = m.tipo === "electro" ? (ELECTROS[m.electro] || ELECTROS.anafe) : null;
    const cerrado = nPu > 0 || nCj > 0 || !!E;
    // laterales / techo / piso (winding para que el signo de área los oculte solo)
    addCara(`li${x0}${base}`, [[x0, y0, zF], [x0, y1, zF], [x0, y1, zB], [x0, y0, zB]], mc);
    addCara(`ld${x0}${base}`, [[x1, y0, zB], [x1, y1, zB], [x1, y1, zF], [x1, y0, zF]], mc);
    addCara(`tp${x0}${base}`, [[x0, y1, zF], [x0, y1, zB], [x1, y1, zB], [x1, y1, zF]], mc);
    addCara(`pi${x0}${base}`, [[x0, y0, zB], [x0, y0, zF], [x1, y0, zF], [x1, y0, zB]], mc);
    addCara(`fo${x0}${base}`, [[x0, y0, zB], [x1, y0, zB], [x1, y1, zB], [x0, y1, zB]], mc, { ao: 0.35 });
    if (!cerrado) { // sin puertas: se ve el interior (fondo + estantes)
      const nEst = num(m.estantes);
      for (let i = 1; i <= nEst; i++) { const yy = y0 + (Hc / (nEst + 1)) * i; addCara(`es${x0}${base}${i}`, [[x0, yy, zF], [x1, yy, zF], [x1, yy, zB], [x0, yy, zB]], mc); }
      addCara(`in${x0}${base}`, [[x0, y0, zB - 1], [x0, y1, zB - 1], [x1, y1, zB - 1], [x1, y0, zB - 1]], mc, { ao: 0.5 });
    }
    if (zc > 0) addCara(`zo${x0}${base}`, [[x0, base, zF + 25], [x1, base, zF + 25], [x1, base + zc, zF + 25], [x0, base + zc, zF + 25]], ZOCALO, { ao: 0.55 });
    // frentes
    const zP = zF - 18;
    if (E) {
      const k = m.electro;
      if (k === "heladera") { addCara(`he${x0}${base}`, [[x0 + 2, base, zP], [x1 - 2, base, zP], [x1 - 2, base + alt, zP], [x0 + 2, base + alt, zP]], INOX, { frente: true, gloss: true });
        addCara(`hep${x0}${base}`, [[x0 + A / 2 - 3, base + alt * 0.25, zP - 8], [x0 + A / 2 + 3, base + alt * 0.25, zP - 8], [x0 + A / 2 + 3, base + alt * 0.75, zP - 8], [x0 + A / 2 - 3, base + alt * 0.75, zP - 8]], TIRA, { tirador: true }); }
      else if (k === "campana") { const yc = base; addCara(`ca${x0}`, [[x0 + 40, yc, zP], [x1 - 40, yc, zP], [x1 - 40, yc + Hc, zP], [x0 + 40, yc + Hc, zP]], INOX, { frente: true, gloss: true });
        addCara(`cab${x0}`, [[x0, yc, zP], [x1, yc, zP], [x1, yc + 60, zP], [x0, yc + 60, zP]], INOX, { frente: true }); }
      else if (k === "columna") { addCara(`co1${x0}`, [[x0 + 2, y0 + Hc * 0.10, zP], [x1 - 2, y0 + Hc * 0.10, zP], [x1 - 2, y0 + Hc * 0.38, zP], [x0 + 2, y0 + Hc * 0.38, zP]], VIDRIO_N, { frente: true, gloss: true });
        addCara(`co2${x0}`, [[x0 + 2, y0 + Hc * 0.42, zP], [x1 - 2, y0 + Hc * 0.42, zP], [x1 - 2, y0 + Hc * 0.62, zP], [x0 + 2, y0 + Hc * 0.62, zP]], VIDRIO_N, { frente: true, gloss: true });
        addCara(`co3${x0}`, [[x0 + 2, y0 + Hc * 0.66, zP], [x1 - 2, y0 + Hc * 0.66, zP], [x1 - 2, y1 - 2, zP], [x0 + 2, y1 - 2, zP]], mf, { frente: true }); }
      else if (k === "microondas") { addCara(`mi${x0}${base}`, [[x0 + 2, y0 + 2, zP], [x1 - 2, y0 + 2, zP], [x1 - 2, y1 - 2, zP], [x0 + 2, y1 - 2, zP]], VIDRIO_N, { frente: true, gloss: true }); }
      else if (k === "horno") { addCara(`ho${x0}${base}`, [[x0 + 2, y0 + Hc * 0.30, zP], [x1 - 2, y0 + Hc * 0.30, zP], [x1 - 2, y1 - 2, zP], [x0 + 2, y1 - 2, zP]], VIDRIO_N, { frente: true, gloss: true });
        addCara(`hoc${x0}${base}`, [[x0 + 2, y0 + 2, zP], [x1 - 2, y0 + 2, zP], [x1 - 2, y0 + Hc * 0.26, zP], [x0 + 2, y0 + Hc * 0.26, zP]], mf, { frente: true }); }
      else if (k === "lavavajillas") { addCara(`lv${x0}${base}`, [[x0 + 2, y0 + 2, zP], [x1 - 2, y0 + 2, zP], [x1 - 2, y1 - 2, zP], [x0 + 2, y1 - 2, zP]], INOX, { frente: true, gloss: true }); }
      else { // anafe / bacha: frente de mueble comun
        addCara(`fe${x0}${base}`, [[x0 + 2, y0 + 2, zP], [x1 - 2, y0 + 2, zP], [x1 - 2, y1 - 2, zP], [x0 + 2, y1 - 2, zP]], mf, { frente: true });
      }
    }
    if (nCj > 0) {
      const aF = (Hc - (nCj + 1) * L) / nCj;
      for (let i = 0; i < nCj; i++) {
        const yy = y0 + L + i * (aF + L);
        addCara(`cj${x0}${base}${i}`, [[x0 + 1, yy, zP], [x0 + A - 1, yy, zP], [x0 + A - 1, yy + aF, zP], [x0 + 1, yy + aF, zP]], mf, { frente: true });
        const ty = yy + aF * 0.68;
        addCara(`tc${x0}${base}${i}`, [[x0 + A * 0.30, ty, zP - 14], [x0 + A * 0.70, ty, zP - 14], [x0 + A * 0.70, ty + 18, zP - 14], [x0 + A * 0.30, ty + 18, zP - 14]], TIRA, { tirador: true });
      }
    }
    if (nPu > 0) {
      const corr = m.sistemaPuerta === "corrediza", sol = num(cfg.solape) || 25;
      const aPu = corr ? (A + sol * (nPu - 1)) / nPu : (A - (nPu - 1) * L - 2) / nPu;
      for (let i = 0; i < nPu; i++) {
        const px = corr ? x0 + i * (aPu - sol) : x0 + 1 + i * (aPu + L);
        const zz = corr ? zP - (i % 2) * 22 : zP;
        addCara(`pu${x0}${base}${i}`, [[px, y0 + 1, zz], [px + aPu, y0 + 1, zz], [px + aPu, y1 - 1, zz], [px, y1 - 1, zz]], vid ? { id: "vid", hex: "#C3D7E0", tipo: "vidrio", gloss: true } : mf, { frente: true });
        const tx = (i === 0 && nPu > 1) ? px + aPu - 48 : px + 48;
        const ty = y0 + Hc * 0.40;
        addCara(`tp${x0}${base}${i}`, [[tx - 8, ty, zz - 14], [tx + 8, ty, zz - 14], [tx + 8, ty + Math.min(140, Hc * 0.3), zz - 14], [tx - 8, ty + Math.min(140, Hc * 0.3), zz - 14]], TIRA, { tirador: true });
      }
    }
  };

  // Piso: sólo bajo los muebles (nada de planos gigantes que se deformaban)
  const anchoPiso = Math.max(d.anchoPiso, d.anchoColg, vano.isla ? num(vano.islaAncho) || 2400 : 0, 600);
  const zPisoF = -(zExtra + 500) || -700;
  addCara("piso", [[-350, 0, zPisoF], [anchoPiso + 350, 0, zPisoF], [anchoPiso + 350, 0, profMax + 60], [-350, 0, profMax + 60]], { id: "piso", hex: "#B5ADA2", tipo: "liso" }, { piso: true });

  d.piso.forEach(it => modulo(it, 0));
  const bajos = d.piso.filter(it => !esAlto(it.m));
  if (bajos.length) {
    const hb = Math.max(...bajos.map(it => num(it.m.alto) || 860));
    const anchoM = bajos.reduce((s, it) => s + it.w, 0);
    const pM = Math.max(...bajos.map(it => num(it.m.prof) || 580)) + 25;
    addCara("mesada", [[-8, hb + eMes, -25], [-8, hb + eMes, pM], [anchoM + 8, hb + eMes, pM], [anchoM + 8, hb + eMes, -25]], MESADA, { gloss: true });
    addCara("mesadaF", [[-8, hb, -25], [anchoM + 8, hb, -25], [anchoM + 8, hb + eMes, -25], [-8, hb + eMes, -25]], MESADA);
  }
  d.colg.forEach(it => modulo(it, hAlac));

  // anafe y bacha: se ven sobre la mesada
  d.piso.forEach(it => {
    if (it.m.tipo !== "electro") return;
    const k = it.m.electro, hb = num(it.m.alto) || 860, pf = num(it.m.prof) || 580;
    const yT = hb + eMes + 1;
    if (k === "anafe") { addCara(`an${it.x}`, [[it.x + 30, yT, 60], [it.x + 30, yT, pf - 90], [it.x + it.w - 30, yT, pf - 90], [it.x + it.w - 30, yT, 60]], VIDRIO_N, { gloss: true }); }
    if (k === "bacha") { addCara(`ba${it.x}`, [[it.x + 60, yT, 80], [it.x + 60, yT, pf - 110], [it.x + it.w - 60, yT, pf - 110], [it.x + it.w - 60, yT, 80]], INOX, { gloss: true, ao: 0.5 }); }
  });

  // ---- ISLA ---- (medidas propias, definidas en el Vano)
  if (hayIsla) {
    const sep = Math.max(300, num(vano.islaSep) || 1100);
    const vol = Math.max(0, num(vano.islaVoladizo) || 0);
    const anchoI = Math.max(400, num(vano.islaAncho) || 2400);
    const profI = Math.max(300, num(vano.islaProf) || 900);
    const altoI = Math.max(500, num(vano.islaAlto) || 900);
    const zIF = -(sep + profI), zIB = -sep;                 // isla adelante de los bajos
    const zocI = num((dI.piso[0] || {}).m ? dI.piso[0].m.zocalo : 100) || 100;
    // cuerpo de la isla (con sus medidas). Si hay módulos, se dibujan sus frentes encima.
    addCara("islaL", [[0, zocI, zIF], [0, altoI, zIF], [0, altoI, zIB], [0, zocI, zIB]], matC);
    addCara("islaR", [[anchoI, zocI, zIB], [anchoI, altoI, zIB], [anchoI, altoI, zIF], [anchoI, zocI, zIF]], matC);
    addCara("islaPared", [[0, zocI, zIB], [0, altoI, zIB], [anchoI, altoI, zIB], [anchoI, zocI, zIB]], matF, { frente: true });
    addCara("islaZoc", [[0, 0, zIF + 25], [anchoI, 0, zIF + 25], [anchoI, zocI, zIF + 25], [0, zocI, zIF + 25]], ZOCALO, { ao: 0.6 });
    // frentes que dan a las banquetas: los módulos de la isla, escalados al ancho de la isla
    const totM = dI.anchoPiso || 0;
    if (totM > 0) {
      dI.piso.forEach(it => {
        const m = it.m, x0 = (it.x / totM) * anchoI, x1 = ((it.x + it.w) / totM) * anchoI;
        const mf = matPorId(m.matFrente || cfg.matFrente, mats);
        const nCjI = num(m.cajones), Hi = altoI - zocI;
        if (nCjI > 0) {
          const aF = (Hi - (nCjI + 1) * L) / nCjI;
          for (let i = 0; i < nCjI; i++) { const yy = zocI + L + i * (aF + L);
            addCara(`isc${x0}${i}`, [[x0 + 1, yy, zIF - 18], [x1 - 1, yy, zIF - 18], [x1 - 1, yy + aF, zIF - 18], [x0 + 1, yy + aF, zIF - 18]], mf, { frente: true });
            const ty = yy + aF * 0.68;
            addCara(`ist${x0}${i}`, [[x0 + (x1 - x0) * 0.3, ty, zIF - 32], [x0 + (x1 - x0) * 0.7, ty, zIF - 32], [x0 + (x1 - x0) * 0.7, ty + 18, zIF - 32], [x0 + (x1 - x0) * 0.3, ty + 18, zIF - 32]], TIRA, { tirador: true });
          }
        } else {
          addCara(`isf${x0}`, [[x0 + 1, zocI + 1, zIF - 18], [x1 - 1, zocI + 1, zIF - 18], [x1 - 1, altoI - 1, zIF - 18], [x0 + 1, altoI - 1, zIF - 18]], mf, { frente: true });
        }
      });
    } else {
      addCara("islaFrente", [[0, zocI, zIF], [anchoI, zocI, zIF], [anchoI, altoI, zIF], [0, altoI, zIF]], matF, { frente: true });
    }
    // anafe de la isla, sobre la mesada
    const yM = altoI + eMes;
    const anafeI = dI.piso.find(it => it.m.tipo === "electro" && it.m.electro === "anafe");
    if (anafeI) addCara("islaAnafe", [[anchoI * 0.32, yM + 1, zIB - 120], [anchoI * 0.32, yM + 1, zIF + 120], [anchoI * 0.68, yM + 1, zIF + 120], [anchoI * 0.68, yM + 1, zIB - 120]], VIDRIO_N, { gloss: true });
    // mesada con voladizo hacia las banquetas
    addCara("islaMes", [[-12, yM, zIF - vol], [-12, yM, zIB + 12], [anchoI + 12, yM, zIB + 12], [anchoI + 12, yM, zIF - vol]], MESADA, { gloss: true });
    addCara("islaMesF", [[-12, altoI, zIF - vol], [anchoI + 12, altoI, zIF - vol], [anchoI + 12, yM, zIF - vol], [-12, yM, zIF - vol]], MESADA);
    // banquetas
    const nB = Math.max(0, num(vano.banquetas) || 0);
    for (let i = 0; i < nB; i++) {
      const bx = anchoI * ((i + 1) / (nB + 1)), bz = zIF - vol - 180, aB = Math.max(500, altoI - 220), sw = 190;
      addCara(`bq${i}`, [[bx - sw / 2, aB, bz - sw / 2], [bx + sw / 2, aB, bz - sw / 2], [bx + sw / 2, aB, bz + sw / 2], [bx - sw / 2, aB, bz + sw / 2]], BANQ);           // asiento
      addCara(`bqf${i}`, [[bx - sw / 2, aB - 40, bz - sw / 2], [bx - sw / 2, aB, bz - sw / 2], [bx + sw / 2, aB, bz - sw / 2], [bx + sw / 2, aB - 40, bz - sw / 2]], BANQ); // canto
      addCara(`bqp${i}`, [[bx - 22, 0, bz - 22], [bx - 22, aB - 40, bz - 22], [bx + 22, aB - 40, bz - 22], [bx + 22, 0, bz - 22]], BANQ);                                   // caño
      addCara(`bqr${i}`, [[bx - sw / 2, aB, bz + sw / 2], [bx + sw / 2, aB, bz + sw / 2], [bx + sw / 2, aB + 330, bz + sw / 2], [bx - sw / 2, aB + 330, bz + sw / 2]], BANQ); // respaldo
    }
  }
  caras.sort((a, b) => b.z - a.z);

  const pts0 = caras.flatMap(c => c.pts.map(a => proj(a[0], a[1], a[2])));
  const xs = pts0.map(p => p.x), ys = pts0.map(p => p.y);
  const mnX = xs.length ? Math.min(...xs) : -100, mxX = xs.length ? Math.max(...xs) : 100;
  const mnY = ys.length ? Math.min(...ys) : -100, mxY = ys.length ? Math.max(...ys) : 100;
  const pd = Math.max(20, (mxX - mnX) * 0.06);
  const vbX = mnX - pd, vbY = mnY - pd, vbW = Math.max(10, (mxX - mnX) + pd * 2), vbH = Math.max(10, (mxY - mnY) + pd * 2);
  const usados = [...new Map(caras.filter(c => c.mat && c.mat.id).map(c => [c.mat.id, c.mat])).values()];

  return <div style={{ position: "fixed", inset: 0, background: "#11151B", zIndex: 600, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", gap: 8, padding: "10px 12px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
      <button onClick={onClose} style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕</button>
      <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, flex: 1 }}>Render final</div>
      {[["Frente", 0, 3], ["3/4", -18, 6], ["Lateral", -40, 8], ["Alto", -14, 28]].map(([l, y, p]) => <button key={l} onClick={() => setCam(c => ({ ...c, yaw: y, pitch: p }))} style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
    </div>
    <div style={{ flex: 1, minHeight: 0, background: "linear-gradient(180deg, #E8E4DD 0%, #CFC9C0 55%, #B7B0A6 100%)" }}>
      <svg ref={svgRef} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        onMouseDown={ev => { ev.preventDefault(); onDown(ev.clientX, ev.clientY); }} onMouseMove={ev => onMove(ev.clientX, ev.clientY)} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={ev => { const t = ev.touches[0]; onDown(t.clientX, t.clientY); }} onTouchMove={ev => { ev.preventDefault(); const t = ev.touches[0]; onMove(t.clientX, t.clientY); }} onTouchEnd={onUp}
        style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }} preserveAspectRatio="xMidYMid meet">
        <defs>
          {usados.map(mt => mt.foto
            ? <pattern key={mt.id} id={`${U}_p_${mt.id}`} patternUnits="objectBoundingBox" width="1" height="1"><image href={mt.foto} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" /></pattern>
            : (mt.tipo === "madera" ? <pattern key={mt.id} id={`${U}_p_${mt.id}`} patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
              <rect x="0" y="0" width="1" height="1" fill={mt.hex} />
              {vetaBandas(mt.hex, mt.id).map((b, i) => <rect key={i} x={b.x} y="0" width={b.w} height="1" fill={mezcla(mt.hex, b.k)} opacity={b.o} />)}
            </pattern> : null))}
          <linearGradient id={`${U}_ao`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity="0.45" /></linearGradient>
          <linearGradient id={`${U}_gl`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity="0.28" /><stop offset="50%" stopColor="#fff" stopOpacity="0.04" /><stop offset="100%" stopColor="#fff" stopOpacity="0" /></linearGradient>
        </defs>
        {caras.map(c => {
          const mt = c.mat || {}; const pts = c.pts.map(P).join(" ");
          const base = (mt.foto || mt.tipo === "madera") ? `url(#${U}_p_${mt.id})` : (mt.hex || "#ccc");
          const oscuro = cfg.sinSombras ? 0 : Math.max(0, 1 - c.int);
          return <g key={c.key}>
            <polygon points={pts} fill={base} fillOpacity={mt.tipo === "vidrio" ? 0.45 : 1} />
            {c.ao && !cfg.sinSombras && <polygon points={pts} fill={`url(#${U}_ao)`} fillOpacity={c.ao} />}
            {oscuro > 0.001 && <polygon points={pts} fill="#0A1018" fillOpacity={oscuro * 0.62} />}
            {(c.gloss || mt.gloss) && <polygon points={pts} fill={`url(#${U}_gl)`} />}
            {!cfg.sinSombras && c.spec > 0.03 && <polygon points={pts} fill="#fff" fillOpacity={c.spec * (mt.gloss ? 0.30 : 0.12)} />}
            <polygon points={pts} fill="none" stroke="#1B2430" strokeOpacity={c.frente ? 0.34 : 0.18} strokeWidth={escala / (c.frente ? 800 : 1400)} strokeLinejoin="round" />
          </g>;
        })}
      </svg>
    </div>
    <div style={{ padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", background: "#11151B", borderTop: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: "rgba(255,255,255,.55)", fontSize: 11, fontWeight: 700 }}>Zoom</span>
        <input type="range" min="10" max="200" value={Math.round(cam.dist * 40)} onChange={ev => setCam(c => ({ ...c, dist: num(ev.target.value) / 40 }))} style={{ flex: 1, accentColor: BRASS }} />
      </div>
      <button onClick={() => setVerIA(true)} style={{ width: "100%", marginTop: 10, background: `linear-gradient(135deg, ${BRASS}, #8E6C3A)`, color: "#fff", border: "none", borderRadius: 11, padding: "14px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>✨ Convertir en render fotorrealista</button>
      <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10.5, marginTop: 6, textAlign: "center" }}>Arrastrá para girar · {matC.marca} {matC.nom} (cuerpo) · {matF.nom} (frentes)</div>
    </div>
    {verIA && <RenderIA proyecto={proyecto} vano={vano} muebles={muebles} cfg={cfg} mats={mats} refSvg={svgRef} fotoAmbiente={vano.foto} deco={deco} onClose={() => setVerIA(false)} />}
  </div>;
}

// ---------- RENDER FOTORREALISTA CON IA (OpenAI gpt-image-1) ----------
const PAREDES = [["blanco", "Blanco", "plain white painted wall"], ["gris", "Gris cemento", "smooth grey microcement wall"], ["ladrillo", "Ladrillo negro", "dark charcoal brick wall"], ["lamas", "Lamas de madera", "vertical wood slat panelling (fluted wood) on the wall"], ["piedra", "Piedra natural", "natural stone cladding wall"], ["porcelanato", "Porcelanato símil mármol", "large-format marble-look porcelain slab wall"]];
const PISOS = [["porcelanato", "Porcelanato claro", "large format light beige porcelain tile floor"], ["madera", "Madera clara", "light oak wood-look plank floor"], ["cemento", "Cemento alisado", "polished concrete floor"], ["oscuro", "Porcelanato oscuro", "dark grey porcelain tile floor"]];
const LUCES = [["led", "LED bajo alacena", "warm LED strip lighting under the wall cabinets"], ["spots", "Spots en cielorraso", "recessed ceiling spotlights"], ["estantes", "Luz en estantes", "warm LED lighting inside the open shelves"], ["colgante", "Colgantes sobre isla", "pendant lights hanging over the island"], ["perimetral", "Luz perimetral", "cove lighting around the ceiling perimeter"]];
const DECOS = [["plantas", "Plantas", "small potted green plants"], ["floreros", "Floreros / vasijas", "sculptural ceramic vases and vessels"], ["vajilla", "Vajilla", "ceramic bowls and mugs neatly arranged"], ["libros", "Libros", "a few stacked design books"], ["frutas", "Frutera", "a bowl with fresh fruit"], ["cafetera", "Cafetera", "an espresso machine on the counter"], ["banquetas", "Banquetas", "black bar stools at the counter"], ["campana", "Campana", "a stainless steel extractor hood"]];

function promptEscena(proyecto, vano, muebles, cfg, mats, opciones) {
  const mc = matPorId(cfg.matCuerpo, mats), mf = matPorId(cfg.matFrente, mats);
  const d = distribuir(muebles, "A");
  const desc = (arr) => arr.map(it => `${mm(it.w)}mm wide ${it.m.tipo === "electro" ? ((ELECTROS[it.m.electro] || {}).en || "appliance") : it.m.tipo === "cajonera" ? `drawer unit with ${num(it.m.cajones)} drawers` : it.m.tipo === "placard" ? "tall wardrobe" : num(it.m.puertas) > 0 ? `cabinet with ${num(it.m.puertas)} ${it.m.sistemaPuerta === "corrediza" ? "sliding" : "hinged"} ${it.m.matPuerta === "vidrio" ? "glass" : "flat slab"} door(s)` : "open shelf unit"}`).join(", ");
  const bajos = d.piso.length ? `Base run (floor cabinets), left to right: ${desc(d.piso)}.` : "";
  const alac = d.colg.length ? `Wall-mounted upper cabinets at ${mm(num(cfg.alturaAlacena))}mm from floor, left to right: ${desc(d.colg)}.` : "";
  const els = muebles.filter(m => m.tipo === "electro").map(m => (ELECTROS[m.electro] || {}).en).filter(Boolean);
  const elec = els.length ? `Appliances (must appear, exactly these): ${els.join("; ")}.` : "";
  const dI = distribuir(muebles, "A", "isla");
  const isla = vano.isla ? `There is a KITCHEN ISLAND in front of the base run: ${mm(num(vano.islaAncho))}mm long × ${mm(num(vano.islaProf))}mm deep × ${mm(num(vano.islaAlto))}mm high, separated ${mm(num(vano.islaSep))}mm from the base cabinets, with a ${mm(num(vano.islaVoladizo))}mm countertop overhang on the seating side and ${num(vano.banquetas)} bar stools tucked under it${dI.piso.length ? `. The island fronts are: ${desc(dI.piso)}` : ""}. Frame the shot WIDER (step back) so the whole island and all the stools are fully visible in the composition.` : "";
  const par = (PAREDES.find(x => x[0] === opciones.pared) || PAREDES[0])[2];
  const pis = (PISOS.find(x => x[0] === opciones.piso) || PISOS[0])[2];
  const luces = (opciones.luces || []).map(k => (LUCES.find(x => x[0] === k) || [])[2]).filter(Boolean);
  const decos = (opciones.deco || []).map(k => (DECOS.find(x => x[0] === k) || [])[2]).filter(Boolean);
  const amb = opciones.luz === "noche" ? "Evening scene, dim warm ambient light, cosy atmosphere, glowing accents" : "Bright natural daylight, soft shadows, airy";
  const est = opciones.estilo === "clasico" ? "classic elegant Scandinavian style" : opciones.estilo === "industrial" ? "industrial style with matte black metal accents" : "modern minimalist high-end style, handleless slab fronts, clean lines";
  const refs = [];
  if (opciones.hayDiseno) refs.push("the first reference image is the technical 3D design of the cabinets");
  if (opciones.hayAmbiente) refs.push("another reference image is a photo of the REAL room where this goes — reproduce that room (its walls, floor, openings, light) as the background");
  if (opciones.nDeco > 0) refs.push(`the last ${opciones.nDeco} reference image(s) are the client's own decorative objects — place them naturally on the counter and shelves, keeping their exact shape and finish`);
  return `Photorealistic professional interior architectural photograph of a custom fitted kitchen/cabinetry, built from the provided design.
CRITICAL: keep exactly the same layout, proportions, number of cabinets, cabinet widths and positions as the design reference. Do not add or remove cabinets. Do not change the composition.
${refs.length ? "Reference images: " + refs.join("; ") + "." : ""}

Project: ${proyecto || "Custom kitchen"}. Wall opening ${mm(num(vano.ancho))}mm wide × ${mm(num(vano.alto))}mm high, cabinet depth ${mm(num(vano.prof))}mm.
${bajos}
${alac}
${elec}
${isla}
Carcass finish: ${mc.marca} ${mc.nom} melamine (${mc.tipo === "madera" ? "realistic wood grain" : "solid matte colour"}, colour ${mc.hex}).
Door and drawer front finish: ${mf.marca} ${mf.nom} melamine (${mf.tipo === "madera" ? "realistic natural wood grain" : "solid matte colour"}, colour ${mf.hex}).
Countertop: ${opciones.mesada || "black granite, 30mm thick, polished"}.
Handles: ${opciones.tirador || "slim brushed steel bar handles"}.
Wall behind and around: ${par}${opciones.colorPared ? ` in colour ${opciones.colorPared}` : ""}. Floor: ${pis}.
${luces.length ? "Lighting: " + luces.join(", ") + "." : ""}
${decos.length ? "Styling / props: " + decos.join(", ") + "." : ""}
${est}. ${amb}.${opciones.extra ? " " + opciones.extra : ""}
Shot with a 24mm wide-angle lens at eye level, sharp focus, realistic materials and reflections, high dynamic range, ultra-detailed, 8k architectural visualization. No text, no watermarks, no people.`;
}

function RenderIA({ proyecto, vano, muebles, cfg, mats, refSvg, fotoAmbiente, deco, onClose }) {
  const [op, setOp] = useState({ estilo: "moderno", luz: "noche", mesada: "", tirador: "", extra: "", pared: "blanco", piso: "porcelanato", luces: ["led", "spots"], deco: ["plantas"] });
  const [usarAmb, setUsarAmb] = useState(!!fotoAmbiente);
  const [decoSel, setDecoSel] = useState([]);
  const tog = (k, v) => setOp(o => ({ ...o, [k]: (o[k] || []).includes(v) ? o[k].filter(x => x !== v) : [...(o[k] || []), v] }));
  const [gen, setGen] = useState(false);
  const [img, setImg] = useState("");
  const [err, setErr] = useState("");
  const [usarRef, setUsarRef] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [link, setLink] = useState("");

  const guardarImg = async () => {
    if (!img || guardando) return;
    setGuardando(true);
    const nombre = `render-${(proyecto || "mueble").replace(/\s+/g, "-").slice(0, 30)}.png`;
    try {
      const blob = await (await fetch(img)).blob();
      const file = new File([blob], nombre, { type: "image/png" });
      // iPhone/iPad: compartir nativo -> "Guardar en Fotos"
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: proyecto || "Render" });
        setGuardando(false); return;
      }
      // resto: descarga normal
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch {
      // último recurso: subirla y dar el link
      const url = await subirRender(img);
      if (url) setLink(url); else alert("Mantené el dedo apretado sobre la imagen y elegí «Guardar en Fotos».");
    }
    setGuardando(false);
  };

  const svgAPng = () => new Promise((resolve) => {
    try {
      const el = refSvg && refSvg.current;
      if (!el) return resolve("");
      const xml = new XMLSerializer().serializeToString(el);
      const b = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(b);
      const im = new window.Image();
      im.onload = () => {
        try {
          const W = 768, H = Math.max(1, Math.round(W * (im.height || 540) / (im.width || 768)));
          const c = document.createElement("canvas"); c.width = W; c.height = H;
          const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
          ctx.drawImage(im, 0, 0, W, H);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL("image/jpeg", 0.8)); // JPEG: mucho más liviano que PNG
        } catch { resolve(""); }
      };
      im.onerror = () => { URL.revokeObjectURL(url); resolve(""); };
      im.src = url;
    } catch { resolve(""); }
  });

  const generar = async () => {
    setGen(true); setErr(""); setImg(""); setLink("");
    try {
      let imageB64 = "";
      if (usarRef) {
        imageB64 = await svgAPng();
        if (imageB64 && imageB64.length > 3200000) imageB64 = "";
      }
      const extras = [];
      if (usarAmb && fotoAmbiente) extras.push(fotoAmbiente);
      decoSel.forEach(id => { const o = (deco || []).find(x => x.id === id); if (o && o.foto) extras.push(o.foto); });
      const prompt = promptEscena(proyecto, vano, muebles, cfg, mats, { ...op, hayDiseno: !!imageB64, hayAmbiente: !!(usarAmb && fotoAmbiente), nDeco: decoSel.length });
      const r = await fetch("/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, imageB64: imageB64 || undefined, imagesB64: extras, size: "1536x1024", quality: "high" }) });
      const txt = await r.text();
      let d = null;
      try { d = JSON.parse(txt); } catch { throw new Error(`El servidor respondió ${r.status}. ${txt.slice(0, 160) || "Sin detalle."}`); }
      if (!r.ok) throw new Error((d && d.error && d.error.message) || `Error ${r.status} al generar el render.`);
      if (!d.image) throw new Error("La IA no devolvió imagen.");
      setImg(d.image);
    } catch (e) { setErr(e.message || "Error al generar el render."); }
    setGen(false);
  };

  return <div style={{ position: "fixed", inset: 0, background: "#0C1016", zIndex: 700, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", gap: 8, padding: "10px 12px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
      <button onClick={onClose} style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕</button>
      <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 700, flex: 1 }}>Render fotorrealista IA</div>
      {img && <button onClick={guardarImg} disabled={guardando} style={{ background: BRASS, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{guardando ? "..." : "Guardar"}</button>}
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
      {img ? <>
        <img src={img} alt="render" style={{ width: "100%", borderRadius: 12, display: "block", boxShadow: "0 10px 40px rgba(0,0,0,.5)" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setImg("")} style={{ flex: 1, background: "rgba(255,255,255,.12)", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cambiar opciones</button>
          <button onClick={generar} disabled={gen} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Generar otra</button>
        </div>
        <button onClick={async () => { if (link) return; setGuardando(true); const u = await subirRender(img); setGuardando(false); if (u) setLink(u); else alert("No pude subir la imagen."); }} style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,.08)", color: "#fff", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{guardando ? "Subiendo…" : link ? "✓ Link listo" : "Crear link para mandar por WhatsApp"}</button>
        {link && <div style={{ marginTop: 8 }}>
          <a href={link} target="_blank" rel="noreferrer" style={{ display: "block", color: BRASS, fontSize: 11.5, wordBreak: "break-all", textDecoration: "none", background: "rgba(176,137,79,.1)", padding: "10px 12px", borderRadius: 9 }}>{link}</a>
          <a href={`https://wa.me/?text=${encodeURIComponent((proyecto ? proyecto + " — " : "") + "Render: " + link)}`} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", marginTop: 8, background: "#25D366", color: "#fff", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Enviar por WhatsApp</a>
        </div>}
        <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, marginTop: 12, textAlign: "center", lineHeight: 1.6 }}>
          <b style={{ color: "rgba(255,255,255,.7)" }}>En iPhone/iPad:</b> tocá <b>Guardar</b> y elegí «Guardar en Fotos».<br />También podés mantener el dedo apretado sobre la imagen.
        </div>
        <div style={{ color: "rgba(255,255,255,.35)", fontSize: 10.5, marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>Render generado por IA. Las medidas exactas están en el despiece y el plan de corte.</div>
      </> : <>
        {gen ? <div style={{ textAlign: "center", padding: "60px 20px", color: "#fff" }}>
          <div style={{ fontSize: 34, marginBottom: 14 }}>🎨</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Generando el render…</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 6 }}>Tarda entre 20 y 60 segundos. No cierres la pantalla.</div>
        </div> : <>
          <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: 13, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Ambiente</div>
            {[["luz", [["noche", "Noche (LED cálido)"], ["dia", "Día (luz natural)"]]], ["estilo", [["moderno", "Moderno minimal"], ["clasico", "Clásico nórdico"], ["industrial", "Industrial"]]]].map(([k, opts]) => (
              <div key={k} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {opts.map(([v, l]) => <button key={v} onClick={() => setOp(o => ({ ...o, [k]: v }))} style={{ flex: 1, background: op[k] === v ? T.accent : "rgba(255,255,255,.08)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: 13, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Detalles (opcional)</div>
            <input value={op.mesada} onChange={e => setOp(o => ({ ...o, mesada: e.target.value }))} placeholder="Mesada (ej: granito negro, Silestone blanco)" style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "none", borderRadius: 9, padding: "12px", fontSize: 15, color: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
            <input value={op.tirador} onChange={e => setOp(o => ({ ...o, tirador: e.target.value }))} placeholder="Tiradores (ej: negro mate, sin tirador / uñero)" style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "none", borderRadius: 9, padding: "12px", fontSize: 15, color: "#fff", boxSizing: "border-box", marginBottom: 8 }} />
            <input value={op.extra} onChange={e => setOp(o => ({ ...o, extra: e.target.value }))} placeholder="Extras (ej: isla con banquetas, heladera inox, campana)" style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "none", borderRadius: 9, padding: "12px", fontSize: 15, color: "#fff", boxSizing: "border-box" }} />
          </div>
          <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: 13, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Pared y piso</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 6, marginBottom: 8 }}>
              {PAREDES.map(([k, l]) => <button key={k} onClick={() => setOp(o => ({ ...o, pared: k }))} style={{ background: op.pared === k ? T.accent : "rgba(255,255,255,.08)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)" }}>Color de pared</span>
              <input value={op.colorPared || ""} onChange={e => setOp(o => ({ ...o, colorPared: e.target.value }))} placeholder="ej: verde oliva, beige" style={{ flex: 1, background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, color: "#fff", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 6 }}>
              {PISOS.map(([k, l]) => <button key={k} onClick={() => setOp(o => ({ ...o, piso: k }))} style={{ background: op.piso === k ? BRASS : "rgba(255,255,255,.08)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: 13, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Luces</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 6 }}>
              {LUCES.map(([k, l]) => <button key={k} onClick={() => tog("luces", k)} style={{ background: (op.luces || []).includes(k) ? T.accent : "rgba(255,255,255,.08)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{(op.luces || []).includes(k) ? "✓ " : ""}{l}</button>)}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: 13, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Decoración</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 6 }}>
              {DECOS.map(([k, l]) => <button key={k} onClick={() => tog("deco", k)} style={{ background: (op.deco || []).includes(k) ? T.accent : "rgba(255,255,255,.08)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{(op.deco || []).includes(k) ? "✓ " : ""}{l}</button>)}
            </div>
            {(deco || []).length > 0 && <>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)", margin: "11px 0 7px" }}>Tus objetos (la IA los coloca en la escena):</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {deco.map(o => { const sel = decoSel.includes(o.id); return <button key={o.id} onClick={() => setDecoSel(s => sel ? s.filter(x => x !== o.id) : [...s, o.id])} style={{ width: 62, height: 62, borderRadius: 10, border: `2px solid ${sel ? BRASS : "rgba(255,255,255,.15)"}`, background: `url(${o.foto}) center/cover`, cursor: "pointer", position: "relative", padding: 0 }}>{sel && <span style={{ position: "absolute", top: 2, right: 3, background: BRASS, color: "#fff", borderRadius: 5, fontSize: 9, fontWeight: 800, padding: "1px 4px" }}>✓</span>}</button>; })}
              </div>
            </>}
          </div>
          {fotoAmbiente && <button onClick={() => setUsarAmb(v => !v)} style={{ width: "100%", background: usarAmb ? "rgba(27,58,91,.5)" : "rgba(255,255,255,.06)", border: `1px solid ${usarAmb ? T.accent : "rgba(255,255,255,.12)"}`, color: "#fff", borderRadius: 10, padding: "12px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 10, textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
            <img src={fotoAmbiente} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
            <span>{usarAmb ? "✓ " : ""}Usar la foto del ambiente real<div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", fontWeight: 600, marginTop: 2 }}>La IA reproduce tu ambiente como fondo.</div></span>
          </button>}
          <button onClick={() => setUsarRef(v => !v)} style={{ width: "100%", background: usarRef ? "rgba(27,58,91,.5)" : "rgba(255,255,255,.06)", border: `1px solid ${usarRef ? T.accent : "rgba(255,255,255,.12)"}`, color: "#fff", borderRadius: 10, padding: "12px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12, textAlign: "left" }}>
            {usarRef ? "✓ " : ""}Respetar mi diseño (usa tu render como guía)
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", fontWeight: 600, marginTop: 3 }}>Con esto la IA mantiene tus módulos y medidas en vez de inventar una cocina.</div>
          </button>
          {err && <div style={{ background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.4)", color: "#FCA5A5", borderRadius: 10, padding: "11px 13px", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{err}</div>}
          <button onClick={generar} style={{ width: "100%", background: `linear-gradient(135deg, ${BRASS}, #8E6C3A)`, color: "#fff", border: "none", borderRadius: 12, padding: "16px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Generar render fotorrealista</button>
          <div style={{ color: "rgba(255,255,255,.35)", fontSize: 10.5, marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>Usa la API de OpenAI (gpt-image-1). Costo aproximado: USD 0,04–0,17 por imagen, se factura a tu cuenta de OpenAI.</div>
        </>}
      </>}
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
  const [matsCustom, setMatsCustom] = useState([]);
  const [nuevoMat, setNuevoMat] = useState(null);
  const [verRender, setVerRender] = useState(false);
  const [verNivel, setVerNivel] = useState(false);
  const [deco, setDeco] = useState([]);
  const [leyendo, setLeyendo] = useState(false);
  const comprimir = (file, max) => new Promise((res) => { try { const img = new window.Image(); const u = URL.createObjectURL(file); img.onload = () => { let w = img.naturalWidth || 800, h = img.naturalHeight || 600; const M = max || 1100; if (w > M || h > M) { const k = M / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); } const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(u); res(c.toDataURL("image/jpeg", 0.82)); }; img.onerror = () => { URL.revokeObjectURL(u); res(""); }; img.src = u; } catch { res(""); } });
  const leerMedidas = async (file) => {
    if (!file) return; setLeyendo(true);
    try {
      const durl = await comprimir(file, 1400);
      const r = await leerMedidasIA(durl);
      const next = { ...vano }; let hubo = false;
      ["ancho", "alto", "prof"].forEach(k => { if (num(r[k]) > 0) { next[k] = num(r[k]); hubo = true; } });
      if (hubo) { guardar({ vano: next }); alert(`✓ Medidas leídas:\nAncho ${mm(next.ancho)} · Alto ${mm(next.alto)} · Prof ${mm(next.prof)} mm${r.nota ? "\n\n" + r.nota : ""}`); }
      else alert("No encontré medidas en esa imagen. Probá con una captura de la app Medir o una foto donde se vean los números.");
    } catch (e) { alert(e.message || "No pude leer las medidas."); }
    setLeyendo(false);
  };
  const subirFotoVano = async (file) => { if (!file) return; const d = await comprimir(file, 1200); if (d) guardar({ vano: { ...vano, foto: d } }); };
  const subirDeco = async (file) => { if (!file) return; const d = await comprimir(file, 800); if (d) { const next = [...deco, { id: uid(), nombre: "Objeto", foto: d }]; setDeco(next); guardar({ deco: next }); } };
  const borrarDeco = (id) => { const next = deco.filter(x => x.id !== id); setDeco(next); guardar({ deco: next }); };
  const todosMats = MATERIALES.map(b => matsCustom.find(c => c.id === b.id) || b).concat(matsCustom.filter(c => !MATERIALES.some(b => b.id === c.id)));
  const subirFotoMat = (id, file) => {
    if (!file) return;
    try {
      const img = new window.Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.naturalWidth || 600, h = img.naturalHeight || 600; const max = 700;
        if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
        const durl = c.toDataURL("image/jpeg", 0.82); URL.revokeObjectURL(url);
        const base = MATERIALES.find(x => x.id === id);
        const yaEs = matsCustom.find(x => x.id === id);
        const next = yaEs ? matsCustom.map(x => x.id === id ? { ...x, foto: durl } : x) : [...matsCustom, { ...(base || {}), foto: durl }];
        setMatsCustom(next); guardar({ matsCustom: next });
      };
      img.onerror = () => { URL.revokeObjectURL(url); alert("No pude leer la imagen."); };
      img.src = url;
    } catch { alert("No pude subir la foto."); }
  };
  const [refrescando, setRefrescando] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const actualizar = async () => {
    setRefrescando(true); setOkMsg("");
    try {
      const r = await storage.get("vv_muebles");
      if (r && r.value) { const d = JSON.parse(r.value); setProyecto(d.proyecto || ""); setMuebles(d.muebles || []); setCfg({ ...CFG_DEF, ...(d.cfg || {}) }); setVano({ ...VANO_DEF, ...(d.vano || {}) }); setMatsCustom(d.matsCustom || []); }
      setOkMsg("✓"); setTimeout(() => setOkMsg(""), 1600);
    } catch { setOkMsg("!"); setTimeout(() => setOkMsg(""), 1600); }
    setRefrescando(false);
  };

  useEffect(() => { (async () => { try { const r = await storage.get("vv_muebles"); if (r && r.value) { const d = JSON.parse(r.value); setProyecto(d.proyecto || ""); setMuebles(d.muebles || []); setCfg({ ...CFG_DEF, ...(d.cfg || {}) }); setVano({ ...VANO_DEF, ...(d.vano || {}) }); setMatsCustom(d.matsCustom || []); setDeco(d.deco || []); } } catch { } setCargando(false); })(); }, []);
  const guardar = (next) => { const d = { proyecto: next.proyecto != null ? next.proyecto : proyecto, muebles: next.muebles || muebles, cfg: next.cfg || cfg, vano: next.vano || vano, matsCustom: next.matsCustom || matsCustom, deco: next.deco || deco }; if (next.proyecto != null) setProyecto(next.proyecto); if (next.muebles) setMuebles(next.muebles); if (next.cfg) setCfg(next.cfg); if (next.vano) setVano(next.vano); if (next.matsCustom) setMatsCustom(next.matsCustom); if (next.deco) setDeco(next.deco); try { storage.set("vv_muebles", JSON.stringify(d)); } catch { } };
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
  const matC = matPorId(cfg.matCuerpo, matsCustom);
  const cfgP = { ...cfg, placaW: matC.pw || cfg.placaW, placaH: matC.ph || cfg.placaH };
  const piezas = muebles.flatMap(m => despiece(m, cfg));
  const herr = herrajes(muebles, cfg);
  const vidrios = piezas.filter(p => p.mat === "vidrio");
  const resPlaca = optimizar(piezas, cfgP, "placa");
  const resFondo = optimizar(piezas, { ...cfgP, veta: false, placaW: 1830, placaH: 2600 }, "fondo");
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
      {[["vano", "Vano"], ["muebles", "Muebles"], ["materiales", "Placas"], ["despiece", "Despiece"], ["herrajes", "Herrajes"], ["cortes", "Cortes"]].map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} style={{ flex: 1, background: "none", border: "none", color: tab === k ? T.text : T.muted, padding: "12px 2px 10px", fontSize: 11.5, fontWeight: tab === k ? 700 : 600, cursor: "pointer", position: "relative" }}>{l}{tab === k && <span style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 24, height: 2.5, background: BRASS, borderRadius: "2px 2px 0 0" }} />}</button>
      ))}
    </div>

    {/* PLACAS / MATERIALES */}
    {tab === "materiales" && <div style={{ padding: "14px 16px 40px" }}>
      <div style={{ background: `linear-gradient(155deg, #14263E 0%, ${T.navy} 68%)`, color: "#fff", borderRadius: 15, padding: 14, marginBottom: 12, boxShadow: SHD }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: BRASS, letterSpacing: "0.12em", textTransform: "uppercase" }}>Placas del proyecto</div>
        <div style={{ fontSize: 12.5, marginTop: 7, lineHeight: 1.6 }}>
          Cuerpo: <b>{matPorId(cfg.matCuerpo, matsCustom).marca} · {matPorId(cfg.matCuerpo, matsCustom).nom}</b><br />
          Frentes: <b>{matPorId(cfg.matFrente, matsCustom).marca} · {matPorId(cfg.matFrente, matsCustom).nom}</b>
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)", marginTop: 7 }}>Tablero: {matPorId(cfg.matCuerpo, matsCustom).pw} × {matPorId(cfg.matCuerpo, matsCustom).ph} mm — el plan de corte usa esta medida.</div>
      </div>
      <div style={{ background: "rgba(176,137,79,.09)", border: `1px solid rgba(176,137,79,.35)`, borderRadius: 11, padding: "10px 12px", fontSize: 11.5, color: T.sub, marginBottom: 14, lineHeight: 1.55 }}>
        <b style={{ color: T.text }}>Para que el render sea idéntico a la placa real:</b> tocá <b>📷</b> en el decorativo y subí la foto de la placa (del catálogo, del muestrario o de una placa). La app la usa como textura real en el 3D.
      </div>
      {["Egger", "Faplac"].map(marca => <div key={marca} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{marca} <span style={{ color: T.muted, fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>· tablero {MATERIALES.find(x => x.marca === marca).pw}×{MATERIALES.find(x => x.marca === marca).ph}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 8 }}>
          {todosMats.filter(x => x.marca === marca).map(mt => {
            const esC = cfg.matCuerpo === mt.id, esF = cfg.matFrente === mt.id;
            return <div key={mt.id} style={{ background: T.card, border: `1.5px solid ${(esC || esF) ? T.accent : T.border}`, borderRadius: 11, overflow: "hidden", boxShadow: SHDsm }}>
              <div style={{ height: 62, background: mt.foto ? `url(${mt.foto}) center/cover` : mt.hex, position: "relative" }}>
                <label style={{ position: "absolute", top: 5, right: 5, background: "rgba(255,255,255,.9)", borderRadius: 6, padding: "3px 6px", fontSize: 11, cursor: "pointer" }}>📷<input type="file" accept="image/*" onChange={ev => { subirFotoMat(mt.id, ev.target.files && ev.target.files[0]); ev.target.value = ""; }} style={{ display: "none" }} /></label>
                {mt.foto && <span style={{ position: "absolute", bottom: 5, left: 5, background: "rgba(22,163,74,.92)", color: "#fff", borderRadius: 5, padding: "2px 6px", fontSize: 9, fontWeight: 800 }}>FOTO REAL</span>}
              </div>
              <div style={{ padding: "8px 9px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.25 }}>{mt.nom}</div>
                <div style={{ fontSize: 9.5, color: T.muted, marginTop: 1 }}>{mt.cod}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
                  <button onClick={() => setC("matCuerpo", mt.id)} style={{ flex: 1, background: esC ? T.accent : T.al, color: esC ? "#fff" : T.sub, border: "none", borderRadius: 6, padding: "5px 2px", fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>{esC ? "✓ " : ""}Cuerpo</button>
                  <button onClick={() => setC("matFrente", mt.id)} style={{ flex: 1, background: esF ? BRASS : T.al, color: esF ? "#fff" : T.sub, border: "none", borderRadius: 6, padding: "5px 2px", fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>{esF ? "✓ " : ""}Frentes</button>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>)}
      {muebles.length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 12, boxShadow: SHDsm }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>Vista previa</div>
        <Render3D m={muebles[0]} cfg={cfg} abierto={false} mats={matsCustom} />
      </div>}
    </div>}

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
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <button onClick={() => guardar({ vano: { ...vano, isla: !vano.isla } })} style={{ width: "100%", background: vano.isla ? T.accent : T.al, color: vano.isla ? "#fff" : T.sub, border: `1px solid ${vano.isla ? T.accent : T.border}`, borderRadius: 10, padding: "13px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{vano.isla ? "✓ " : ""}🏝 Cocina con isla</button>
          {vano.isla && <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 10 }}>
              {[["islaAncho", "Ancho"], ["islaProf", "Profundidad"], ["islaAlto", "Alto"]].map(([k, l]) => <div key={k}>
                <label style={{ fontSize: 10, color: T.sub, fontWeight: 700 }}>{l} (mm)</label>
                <input value={vano[k]} onChange={e => setV(k, e.target.value)} inputMode="numeric" style={{ ...inp, padding: "11px 10px", fontSize: 15 }} />
              </div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginTop: 8 }}>
              {[["islaSep", "Separación"], ["islaVoladizo", "Voladizo"], ["banquetas", "Banquetas"]].map(([k, l]) => <div key={k}>
                <label style={{ fontSize: 10, color: T.sub, fontWeight: 700 }}>{l}{k === "banquetas" ? "" : " (mm)"}</label>
                <input value={vano[k]} onChange={e => setV(k, e.target.value)} inputMode="numeric" style={{ ...inp, padding: "11px 10px", fontSize: 15 }} />
              </div>)}
            </div>
            <div style={{ background: "rgba(176,137,79,.08)", borderRadius: 8, padding: "9px 11px", marginTop: 9, fontSize: 10.5, color: T.sub, lineHeight: 1.6 }}>
              <b>Separación:</b> distancia libre entre los bajos y la isla (circulación; se recomienda 900–1200 mm).<br />
              <b>Voladizo:</b> cuánto sobresale la mesada del lado de las banquetas (para las piernas; 250–350 mm).<br />
              En cada mueble elegí <b>«En la isla»</b> y sus frentes se reparten en ese ancho.
            </div>
          </>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 12 }}>
          <button onClick={() => setVerNivel(true)} style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 10, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📐 Nivel y plomada</button>
          <label style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 10, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>{leyendo ? "Leyendo…" : "📷 Leer medidas"}<input type="file" accept="image/*" onChange={e => { leerMedidas(e.target.files && e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} /></label>
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>Medí con la app <b>Medir</b> del iPhone, sacá captura y subila en «Leer medidas»: la IA carga el vano sola.</div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10, padding: 10, cursor: "pointer" }}>
          {vano.foto ? <img src={vano.foto} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>🖼</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, flex: 1 }}>{vano.foto ? "Cambiar foto del ambiente" : "Subir foto del ambiente / vano"}<div style={{ fontSize: 10, color: T.muted, fontWeight: 600, marginTop: 2 }}>Se usa como fondo real en el render IA.</div></span>
          <input type="file" accept="image/*" onChange={e => { subirFotoVano(e.target.files && e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />
        </label>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: 13, marginBottom: 12, boxShadow: SHDsm }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", marginBottom: 4 }}>Objetos de decoración</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 9, lineHeight: 1.5 }}>Subí fotos de tus piezas (floreros, bandejas, etc). Después las elegís antes del render y la IA las coloca en la escena.</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {deco.map(o => <div key={o.id} style={{ position: "relative" }}>
            <div style={{ width: 66, height: 66, borderRadius: 10, background: `url(${o.foto}) center/cover`, border: `1px solid ${T.border}` }} />
            <button onClick={() => borrarDeco(o.id)} style={{ position: "absolute", top: -5, right: -5, background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 11, cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>)}
          <label style={{ width: 66, height: 66, borderRadius: 10, border: `1px dashed ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.muted, cursor: "pointer" }}>＋<input type="file" accept="image/*" onChange={e => { subirDeco(e.target.files && e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} /></label>
        </div>
      </div>
      {muebles.length === 0 ? <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "24px 10px", lineHeight: 1.6 }}>Cargá el vano y después agregá muebles<br />en la solapa <b>Muebles</b> para verlos acomodados acá.</div> : <>
        <button onClick={() => setVerRender(true)} style={{ width: "100%", background: `linear-gradient(135deg, #1B3A5B, ${T.navy})`, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 12, padding: "15px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", marginBottom: 12, boxShadow: SHD }}>🎬 Ver render final del mueble armado</button>
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

      {muebles.length > 0 && <button onClick={() => setVerRender(true)} style={{ width: "100%", background: `linear-gradient(135deg, #1B3A5B, ${T.navy})`, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 800, cursor: "pointer", marginBottom: 12, boxShadow: SHD }}>🎬 Ver render final del mueble armado</button>}
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
        <Render3D m={m} cfg={cfg} abierto={ab} mats={matsCustom} />
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
        {form.tipo === "electro" && <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>¿Qué electrodoméstico?</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(104px,1fr))", gap: 6, marginTop: 6 }}>
            {Object.entries(ELECTROS).map(([k, E]) => <button key={k} onClick={() => setForm(f => ({ ...f, electro: k, ancho: E.ancho, alto: E.alto, prof: E.prof }))} style={{ background: form.electro === k ? T.accent : T.al, color: form.electro === k ? "#fff" : T.sub, border: `1px solid ${form.electro === k ? T.accent : T.border}`, borderRadius: 8, padding: "9px 4px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{form.electro === k ? "✓ " : ""}{E.nom}</button>)}
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>{(ELECTROS[form.electro] || ELECTROS.anafe).mueble ? "Se corta la caja que lo aloja (va al despiece)." : "Va suelto: no genera cortes de placa."}</div>
        </div>}
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>¿Dónde va?</label>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {[["pared", "Contra la pared"], ["isla", "En la isla"]].map(([k, l]) => <button key={k} onClick={() => setF("zona", k)} style={{ flex: 1, background: (form.zona || "pared") === k ? T.accent : T.al, color: (form.zona || "pared") === k ? "#fff" : T.sub, border: `1px solid ${(form.zona || "pared") === k ? T.accent : T.border}`, borderRadius: 9, padding: "10px 6px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
          </div>
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
        <div style={{ marginTop: 14 }}><Render3D m={form} cfg={cfg} abierto={num(form.puertas) === 0 && num(form.cajones) === 0} mats={matsCustom} /></div>
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
          <button onClick={() => setC("sinSombras", !cfg.sinSombras)} style={{ flex: 1, background: cfg.sinSombras ? T.accent : T.al, color: cfg.sinSombras ? "#fff" : T.sub, border: `1px solid ${cfg.sinSombras ? T.accent : T.border}`, borderRadius: 9, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.sinSombras ? "✓ " : ""}Render sin sombras</button>
          <button onClick={() => setC("cierreSuave", !cfg.cierreSuave)} style={{ flex: 1, background: cfg.cierreSuave ? T.accent : T.al, color: cfg.cierreSuave ? "#fff" : T.sub, border: `1px solid ${cfg.cierreSuave ? T.accent : T.border}`, borderRadius: 9, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.cierreSuave ? "✓ " : ""}Cierre suave</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => setC("descontarFondo", !cfg.descontarFondo)} style={{ flex: 1, background: cfg.descontarFondo ? T.accent : T.al, color: cfg.descontarFondo ? "#fff" : T.sub, border: `1px solid ${cfg.descontarFondo ? T.accent : T.border}`, borderRadius: 9, padding: "12px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.descontarFondo ? "✓ " : ""}Descontar fondo de la prof.</button>
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>Respetar veta: las piezas no se rotan al optimizar (usa más placas pero mantiene el sentido del dibujo). Descontar fondo: la profundidad que cargás incluye el fondo aplicado atrás.</div>
        <button onClick={() => setVerCfg(false)} style={{ width: "100%", marginTop: 14, background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 10, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Listo</button>
      </div>
    </div>}

    {verNivel && <Nivel onClose={() => setVerNivel(false)} />}
    {verRender && <RenderEscena vano={vano} muebles={muebles} cfg={cfg} mats={matsCustom} proyecto={proyecto} deco={deco} onClose={() => setVerRender(false)} />}
    {pdfHtml && <PdfOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
  </div>;
}
