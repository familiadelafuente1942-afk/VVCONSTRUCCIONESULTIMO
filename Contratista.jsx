import React, { useState, useEffect, useRef } from "react";

// Margen superior seguro: en modo app instalada iOS puede no informar env(safe-area-inset-top).
const SAFE_TOP_PX = (() => { try { return (window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches) ? 50 : 0; } catch (e) { return 0; } })();

// ═══ Íconos de línea estilo iOS (reemplazan los emojis) ═══
function Ico({ n, s = 16, c = "currentColor", st = 1.7 }) {
  const P = {
    doc: "M7 3h7l5 5v13H7z M14 3v5h5",
    mic: "M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3z M5 11a7 7 0 0014 0 M12 18v3",
    building: "M3 21h18 M5 21V8l7-5 7 5v13 M9 21v-5h6v5 M9 11h1 M14 11h1",
    robot: "M12 3v3 M6 6h12v12H6z M9.5 11v1.5 M14.5 11v1.5 M4 10v4 M20 10v4",
    video: "M3 6h12v12H3z M15 10l6-3v10l-6-3",
    list: "M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01",
    download: "M12 3v12 M7 11l5 5 5-5 M4 20h16",
    upload: "M12 21V9 M7 13l5-5 5 5 M4 4h16",
    card: "M3 6h18v12H3z M3 10h18 M7 15h4",
    user: "M12 12a4 4 0 100-8 4 4 0 000 8z M4 21c0-4 3.6-6 8-6s8 2 8 6",
    link: "M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1 1 M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1-1",
    globe: "M12 21a9 9 0 100-18 9 9 0 000 18z M3 12h18 M12 3a14 14 0 000 18 M12 3a14 14 0 010 18",
    cal2: "M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4",
    money: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v10 M9.5 9.5h4a1.8 1.8 0 010 3.6h-3a1.8 1.8 0 000 3.6h4",
    bell: "M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z M10.5 20a2 2 0 003 0",
    sound: "M4 9h4l5-4v14l-5-4H4z M16.5 9.5a4 4 0 010 5",
    contact: "M4 5h16v14H4z M9 11a2 2 0 100-4 2 2 0 000 4z M6.5 16c.6-1.6 1.9-2.4 2.5-2.4s1.9.8 2.5 2.4 M14 9h4 M14 13h4",
    chart: "M4 20V10 M10 20V4 M16 20v-7 M3 20h18",
    pin: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
    car: "M5 16h14 M6.5 16l1.2-5h8.6l1.2 5 M4 16h16v3H4z M7.5 19v1.5 M16.5 19v1.5",
    wave: "M12 3v6 M8 6l8 0 M5 13a7 7 0 0014 0 M12 20v1",
    tools: "M14.5 6.5a3.5 3.5 0 004.8 4.8l-9 9a2.1 2.1 0 01-3-3l9-9z M4 6l3-3 4 4-3 3z",
    moon: "M20 14A8.5 8.5 0 019.9 4 8.5 8.5 0 1020 14z",
    thumb: "M7 21V10l5-7 1.2.8a2 2 0 01.8 2.2L13 10h5.5a2 2 0 012 2.4l-1.3 6a2 2 0 01-2 1.6H7z M3 10h4v11H3z",

    word: "M7 3h7l5 5v13H7z M14 3v5h5 M10 12l1.5 5 1.5-4 1.5 4L16 12",
    excel: "M7 3h7l5 5v13H7z M14 3v5h5 M10 12l5 6 M15 12l-5 6",
    box: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10",
    ruler: "M3 15L15 3l6 6L9 21z M8 10l2 2 M11 7l2 2 M14 4l2 2",
    plans: "M3 5h8l2 2h8v12H3z M8 12h8 M8 16h5",
    camera: "M3 8h4l2-2h6l2 2h4v11H3z M12 16a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z",
    clip: "M20 11l-8.5 8.5a4.5 4.5 0 01-6.4-6.4L14 4.3a3 3 0 014.2 4.2L9.7 17a1.5 1.5 0 01-2.1-2.1l8-8",
    trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6",
    chat: "M4 5h16v11H9l-5 4z",
    lock: "M6 10V7a6 6 0 1112 0v3 M4 10h16v11H4z M12 15v2",
    save: "M5 3h11l3 3v15H5z M8 3v6h7V3 M8 14h8v7H8z",
    calendar: "M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4",
    search: "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.3-4.3",
    sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z",
    check: "M4 12.5l5 5L20 6.5",
    image: "M3 5h18v14H3z M8.5 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 16l-5-5-9 8",
    life: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M5.6 5.6l3.9 3.9 M18.4 5.6l-3.9 3.9 M5.6 18.4l3.9-3.9 M18.4 18.4l-3.9-3.9",
    send: "M21 3L10.5 13.5 M21 3l-6.8 18-3.7-7.5L3 9.8z",
  }[n] || "M12 21a9 9 0 100-18 9 9 0 000 18z";
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={st} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, verticalAlign: "-2px", display: "inline-block" }}>{P.split(" M").map((d, i) => <path key={i} d={(i ? "M" : "") + d} />)}</svg>;
}

// ════════════════════════════════════════════════════════════════════
// APP DE CONTRATISTAS — Solo pedidos de materiales
// Mismo backend Supabase que V+V y Belfast → los pedidos se comparten.
// El contratista escribe su empresa (sin clave) y carga pedidos.
// Ve TODOS los pedidos de materiales con su estado.
// ════════════════════════════════════════════════════════════════════

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const ONESIGNAL_APP_ID = ""; // ← Pegá acá tu App ID de OneSignal (después de crear la app en OneSignal)
function initPush(appTag) {
  if (!ONESIGNAL_APP_ID || typeof window === "undefined") return;
  try {
    if (document.getElementById("onesignal-sdk")) return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const s = document.createElement("script");
    s.id = "onesignal-sdk"; s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"; s.defer = true;
    document.head.appendChild(s);
    window.OneSignalDeferred.push(async function (OneSignal) {
      try { await OneSignal.init({ appId: ONESIGNAL_APP_ID, allowLocalhostAsSecureOrigin: true }); } catch (e) {}
      try { await OneSignal.User.addTag("app", appTag); } catch (e) {}
      try { OneSignal.Slidedown.promptPush(); } catch (e) {}
    });
  } catch (e) {}
}
async function pushNotify(title, message, app, url) {
  try { await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title || "Novedad", message: message || "", app: app || "", url: url || "" }) }); } catch (e) {}
}

const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const SH = () => ({ "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY });
// Registra que la app se abrió — usado por NEXO Control para saber
// cuántas personas usan cada vista. No interfiere con nada existente.
function registrarApertura(appTag) {
  // Va a una tabla liviana propia (no a bco_storage) para no sobrecargar
  // esa tabla, que ya tiene todo el resto del sistema. Si falla, avisa por
  // el mismo canal de errores que usa el resto de la app (no en silencio).
  try {
    fetch(SUPA_URL + "/rest/v1/aperturas", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify({ app: appTag }),
    }).then(r => {
      if (!r.ok) r.text().then(t => reportarError("No se pudo registrar apertura: HTTP " + r.status, t)).catch(() => {});
    }).catch(e => reportarError("No se pudo registrar apertura (red)", String(e)));
  } catch (e) {}
}

// Vigía de errores — avisa a NEXO Control si algo se rompe en el navegador
// de cualquier persona que use esta vista, sin que nadie tenga que reportarlo.
function reportarError(mensaje, detalle) {
  try {
    fetch(SUPA_URL + "/rest/v1/app_errores", {
      method: "POST",
      headers: { ...SH(), "Prefer": "return=minimal" },
      body: JSON.stringify({
        app: "contratista",
        mensaje: String(mensaje || "").slice(0, 500),
        detalle: String(detalle || "").slice(0, 2000),
        url: (typeof location !== "undefined" ? location.href : ""),
        dispositivo: (typeof navigator !== "undefined" ? navigator.userAgent : ""),
      }),
    }).catch(() => {});
  } catch (e) {}
}
if (typeof window !== "undefined") {
  window.addEventListener("error", (ev) => { reportarError(ev.message, ev.error && ev.error.stack); });
  window.addEventListener("unhandledrejection", (ev) => { reportarError("Promise rechazada: " + ((ev.reason && ev.reason.message) || ev.reason), ev.reason && ev.reason.stack); });
}

// Protección de datos compartidos: antes de escribir en la nube se verifica que
// se pueda leer, y se bloquea cualquier guardado que borraría la mayoría de la lista.
const GUARD_KEYS = ["vv_matpedidos", "vv_docrecepcion", "vv_definiciones"];
function avisar(msg) { try { window.dispatchEvent(new CustomEvent("contratista-aviso", { detail: msg })); } catch { } }
async function leerNubeEstricto(key) {
  try {
    const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { method: "GET", headers: SH(), mode: "cors" });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    return { ok: true, value: d && d.length ? d[0].value : null };
  } catch { return { ok: false }; }
}
const _largo = (v) => { try { const a = JSON.parse(v); return Array.isArray(a) ? a.length : -1; } catch { return -1; } };
async function respaldoDiario(key, valorNube) {
  try {
    const d = new Date(); const f = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const bk = `vv_bak__${key}__${f}`;
    const ya = await leerNubeEstricto(bk);
    if (ya.ok && !ya.value && valorNube) await fetch(SUPA_URL + "/rest/v1/bco_storage", { method: "POST", headers: { ...SH(), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ key: bk, value: valorNube }) });
  } catch { }
}
const storage = {
  set: async (key, value) => {
    try { localStorage.setItem(key, value); } catch { }
    if (GUARD_KEYS.includes(key)) {
      const c = await leerNubeEstricto(key);
      if (!c.ok) { avisar("No se pudo verificar la nube: se guardó solo en este aparato y NO se tocó la nube. Revisá la conexión."); return { value, local: true }; }
      if (c.value) {
        const nube = _largo(c.value), nuevo = _largo(value);
        if (nube >= 3 && nuevo >= 0 && nuevo < nube * 0.5) { avisar("Se bloqueó un guardado que borraba la mayor parte de los datos. Actualizá la app e intentá de nuevo."); return { value: c.value, bloqueado: true }; }
        respaldoDiario(key, c.value);
      }
    }
    try { await fetch(SUPA_URL + "/rest/v1/bco_storage", { method: "POST", headers: { ...SH(), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ key, value }) }); } catch { }
    return { value };
  },
  get: async (key) => {
    try {
      const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { method: "GET", headers: SH(), mode: "cors" });
      if (r.ok) { const d = await r.json(); if (d && d.length > 0) return { value: d[0].value }; }
    } catch { }
    try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; }
  },
};
const uid = () => Math.random().toString(36).slice(2, 9);
const hoyStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`; };
const SUPA_BUCKET = "bco-media";
const SUPA_STORAGE_URL = SUPA_URL + "/storage/v1";
// Sube un archivo (foto de la respuesta, PDF, lo que sea) al mismo bucket
// que usan las otras apps → devuelve la URL pública.
async function subirArchivoDef(file) {
  const buf = await file.arrayBuffer();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `definiciones/${uid()}_${Date.now()}.${ext}`;
  const r = await fetch(`${SUPA_STORAGE_URL}/object/${SUPA_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": file.type || "application/octet-stream" },
    body: buf,
  });
  if (!r.ok) return null;
  return `${SUPA_STORAGE_URL}/object/public/${SUPA_BUCKET}/${path}`;
}

let BRASS = "#B0894F";
const FONTS = { elegante: "'Fraunces',Georgia,'Times New Roman',serif", moderna: "-apple-system,'Segoe UI',system-ui,Helvetica,Arial,sans-serif", clasica: "Georgia,'Times New Roman',serif" };
let SERIF = FONTS.elegante;
let T = { navy: "#B0894F", accent: "#B0894F", al: "rgba(176,137,79,.14)", bg: "#0d0d0f", card: "#111214", border: "#232227", text: "#f2f0eb", head: "#f2f0eb", sub: "rgba(242,240,235,.62)", muted: "rgba(242,240,235,.42)", rsm: 12, shadow: "0 10px 30px rgba(0,0,0,.35)", brassLight: "#D9B27C", warn: "#E0A458", warnBg: "rgba(217,119,6,.14)", warnBd: "rgba(217,119,6,.38)", ok: "#5CC98A", okBg: "rgba(22,163,74,.14)", okBd: "rgba(22,163,74,.38)", danger: "#F08080", dangerBg: "rgba(239,68,68,.12)", dangerBd: "rgba(239,68,68,.35)", oscuro: true };
const _OSC = { warn: "#E0A458", warnBg: "rgba(217,119,6,.14)", warnBd: "rgba(217,119,6,.38)", ok: "#5CC98A", okBg: "rgba(22,163,74,.14)", okBd: "rgba(22,163,74,.38)", danger: "#F08080", dangerBg: "rgba(239,68,68,.12)", dangerBd: "rgba(239,68,68,.35)", oscuro: true, rsm: 12 };
const _CLA = { warn: "#B45309", warnBg: "#FFFBEB", warnBd: "#FDE68A", ok: "#15803D", okBg: "#ECFDF5", okBd: "#A7F3D0", danger: "#B91C1C", dangerBg: "#FEF2F2", dangerBd: "#FECACA", oscuro: false, rsm: 12 };
const PALETAS = {
  bronce: { nombre: "Bronce", ..._OSC, navy: "#B0894F", accent: "#B0894F", al: "rgba(176,137,79,.14)", bg: "#0d0d0f", card: "#111214", border: "#232227", text: "#f2f0eb", head: "#f2f0eb", sub: "rgba(242,240,235,.62)", muted: "rgba(242,240,235,.42)", brass: "#B0894F", brassLight: "#D9B27C", shadow: "0 10px 30px rgba(0,0,0,.35)" },
  marfil: { nombre: "Marfil", ..._CLA, navy: "#1b1a18", accent: "#8a6a35", al: "#efe8da", bg: "#f3f1ec", card: "#ffffff", border: "#e1dcd1", text: "#1b1a18", head: "#1b1a18", sub: "rgba(27,26,24,.62)", muted: "rgba(27,26,24,.45)", brass: "#8a6a35", brassLight: "#b0894f", shadow: "0 8px 24px rgba(60,50,30,.10)" },
  acero: { nombre: "Acero", ..._OSC, navy: "#3f7fbd", accent: "#4f93d1", al: "rgba(79,147,209,.15)", bg: "#0a111d", card: "#0f1a2b", border: "#1d2c45", text: "#e9f0f8", head: "#e9f0f8", sub: "rgba(233,240,248,.62)", muted: "rgba(233,240,248,.42)", brass: "#4f93d1", brassLight: "#9cc7ec", shadow: "0 10px 30px rgba(0,5,20,.45)" },
  bosque: { nombre: "Bosque", ..._OSC, navy: "#3f8f69", accent: "#5fa77f", al: "rgba(95,167,127,.15)", bg: "#0b1410", card: "#101c17", border: "#1d2f27", text: "#eaf2ec", head: "#eaf2ec", sub: "rgba(234,242,236,.62)", muted: "rgba(234,242,236,.42)", brass: "#5fa77f", brassLight: "#a8d4bb", shadow: "0 10px 30px rgba(0,10,5,.45)" },
  grafito: { nombre: "Grafito", ..._OSC, navy: "#6b6b78", accent: "#c9c9d1", al: "rgba(201,201,209,.12)", bg: "#141416", card: "#1c1c20", border: "#2c2c32", text: "#f4f4f6", head: "#f4f4f6", sub: "rgba(244,244,246,.62)", muted: "rgba(244,244,246,.42)", brass: "#c9c9d1", brassLight: "#e6e6ec", shadow: "0 10px 30px rgba(0,0,0,.45)" },
};
const ACENTOS = ["#B0894F", "#4f93d1", "#5fa77f", "#c8574f", "#9078d6", "#d98a3d"];
function mezclar(hex, p) { const h = String(hex).replace("#", ""); if (h.length !== 6) return hex; const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return "#" + c.map(v => Math.round(v + (255 - v) * p).toString(16).padStart(2, "0")).join(""); }
function aplicarEstilo(e) {
  const est = e || {};
  const p = PALETAS[est.tema] || PALETAS.bronce;
  Object.assign(T, p); BRASS = p.brass;
  if (est.acento) { T.accent = est.acento; BRASS = est.acento; T.brassLight = mezclar(est.acento, .35); if (p.oscuro) T.navy = est.acento; T.al = p.oscuro ? "rgba(255,255,255,.08)" : p.al; }
  SERIF = FONTS[est.fuente] || FONTS.elegante;
}
function achicarLogo(file, max = 256) {
  return new Promise((res) => {
    try {
      const fr = new FileReader();
      fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/png")); }; im.onerror = () => res(null); im.src = fr.result; };
      fr.onerror = () => res(null); fr.readAsDataURL(file);
    } catch { res(null); }
  });
}
function leerEstilo() {
  try { const j = localStorage.getItem("contratista_estilo"); if (j) { const e = JSON.parse(j); if (e && typeof e === "object") return e; } } catch { }
  return { tema: "bronce", acento: "", fuente: "elegante" };
}
function guardarEstilo(e) { try { localStorage.setItem("contratista_estilo", JSON.stringify(e)); } catch { } }
aplicarEstilo(leerEstilo());


function origenLabel(p) { return p.de === "vv" ? "V+V" : p.de === "cliente" ? "Belfast" : (p.empresa || "Contratista"); }

// Íconos estilo SF Symbols (trazo fino), uno por tipo de pedido.
function TipoIcon({ tipo, size = 22, color = "currentColor" }) {
  const s = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } };
  if (tipo === "definicion") // regla/escuadra — definiciones
    return (<svg {...s}><path d="M4.5 16.5 16.5 4.5a2.12 2.12 0 0 1 3 3L7.5 19.5l-4 1 1-4Z" /><path d="M13.5 7.5 16.5 10.5" /><path d="M9.5 11.5 11.5 13.5" /></svg>);
  if (tipo === "plano") // plano/documento con esquina doblada y líneas
    return (<svg {...s}><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4" /><path d="M8.5 12.5h7" /><path d="M8.5 15.5h7" /><path d="M8.5 9.5h3" /></svg>);
  // material — caja/paquete
  return (<svg {...s}><path d="M12 3 20.5 7.5v9L12 21 3.5 16.5v-9L12 3Z" /><path d="M3.5 7.5 12 12l8.5-4.5" /><path d="M12 12v9" /><path d="M7.75 5.25 16.25 9.75" /></svg>);
}

const TIPOS_PEDIDO = [
  { id: "material", label: "Materiales", sing: "material", icon: "box", color: "#4f93d1" },
  { id: "definicion", label: "Definiciones", sing: "definición", icon: "ruler", color: "#B0894F" },
  { id: "plano", label: "Planos", sing: "plano", icon: "plans", color: "#8a7fd6" },
];
const tipoDe = (id) => TIPOS_PEDIDO.find(t => t.id === id) || TIPOS_PEDIDO[0];
const itemsTexto = (p) => (p.items || []).map(it => (p.tipo && p.tipo !== "material") ? `${it.nombre}${it.detalle ? ` (${it.detalle})` : ""}` : `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim());
const DOCS_BASE = [
  { n: "Niveles", c: "Documentación técnica" },
  { n: "Eje de replanteo en platea", c: "Documentación técnica" },
  { n: "Planos de platea", c: "Documentación técnica" },
  { n: "Planos de estructura", c: "Documentación técnica" },
  { n: "Plano de replanteo de mampostería", c: "Documentación técnica" },
  { n: "Plano de mampostería", c: "Documentación técnica" },
  { n: "Plano de hogar", c: "Documentación técnica" },
  { n: "Plano de parrilla", c: "Documentación técnica" },
  { n: "Plano de vainas", c: "Documentación técnica" },
  { n: "Cascos", c: "Elementos de protección" },
  { n: "Chalecos reflectivos", c: "Elementos de protección" },
  { n: "Calzado de seguridad", c: "Elementos de protección" },
  { n: "Guantes", c: "Elementos de protección" },
  { n: "Antiparras / protección ocular", c: "Elementos de protección" },
  { n: "Protección auditiva", c: "Elementos de protección" },
  { n: "Arnés y cabo de vida", c: "Elementos de protección" },
  { n: "Barbijos / protección respiratoria", c: "Elementos de protección" },
  { n: "Matafuegos", c: "Elementos de protección" },
  { n: "Botiquín de primeros auxilios", c: "Elementos de protección" },
  { n: "Vallado y señalización", c: "Elementos de protección" },
  { n: "Póliza ART del personal", c: "Otros ítems" },
  { n: "Alta temprana / F931", c: "Otros ítems" },
  { n: "Seguro de responsabilidad civil", c: "Otros ítems" },
  { n: "Llaves / acceso a la obra", c: "Otros ítems" },
  { n: "Conexión de agua y luz de obra", c: "Otros ítems" },
  { n: "Baño químico / obrador", c: "Otros ítems" },
];
const DOC_CATS = ["Documentación técnica", "Elementos de protección", "Otros ítems"];

// Carga SheetJS desde CDN una sola vez (para leer el Excel en el navegador)
function cargarXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("No se pudo cargar el lector de Excel."));
    document.head.appendChild(s);
  });
}
// Parsea el Excel de definiciones (formato V+V u hoja simple) → [{rubro, item}]
function parseDefinicionesXLSX(XLSX, ab) {
  const wb = XLSX.read(ab, { type: "array" });
  const shName = wb.SheetNames.find(n => /definici/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[shName], { header: 1, defval: "" });
  const out = []; let lastRubro = "";
  const esRuido = (t) => /rubro|definici[oó]n|fecha|estado|observ|checklist|construcciones|obra:|comitente|¿la tenemos|resumen|faltante/i.test(t);
  for (const row of rows) {
    let itemTxt = "", colG = "";
    row.forEach((cell, idx) => {
      if (typeof cell === "string") { if (cell.includes("•")) itemTxt = cell.replace(/^[\s•*·-]+/, "").trim(); if (idx === 6 && cell.trim()) colG = cell.trim(); }
    });
    if (itemTxt) { out.push({ rubro: colG || lastRubro || "General", item: itemTxt }); continue; }
    // fila de rubro: una celda de texto sola, sin bullet, que no sea ruido
    const textos = row.filter(c => typeof c === "string" && c.trim());
    if (textos.length && !esRuido(textos[0])) { lastRubro = textos[0].trim(); }
    // formato simple: rubro en una col, definición en otra (sin bullets)
    if (out.length === 0 && textos.length >= 2 && !esRuido(textos[0]) && !esRuido(textos[1])) {
      // heurística: primera col rubro, segunda definición
    }
  }
  return out;
}

function DefinicionesView({ obras, empresa, definiciones, persistDef }) {
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [cargando, setCargando] = useState(false);
  const [pdfHtml, setPdfHtml] = useState(null);
  const pdfRef = useRef(null);
  const imprimirPdf = () => { try { const w = pdfRef.current && pdfRef.current.contentWindow; if (w) { w.focus(); w.print(); } } catch { alert("No se pudo abrir la impresión."); } };
  const [nuevoRubro, setNuevoRubro] = useState("");
  const [nuevaDef, setNuevaDef] = useState("");
  const obraNom = id => obras.find(o => o.id === id)?.nombre || "—";
  const reg = (definiciones || []).find(r => r.obra_id === obraId);
  const items = reg ? reg.items : [];

  const guardar = (nextItems) => {
    const otros = (definiciones || []).filter(r => r.obra_id !== obraId);
    persistDef([...otros, { ...(reg || {}), obra_id: obraId, items: nextItems, upd: Date.now() }]);
  };
  const patchReg = (patch) => {
    const otros = (definiciones || []).filter(r => r.obra_id !== obraId);
    persistDef([...otros, { obra_id: obraId, items, upd: Date.now(), ...(reg || {}), ...patch }]);
  };
  const [gformUrl, setGformUrl] = useState(() => { try { return localStorage.getItem("contratista_gform_url") || ""; } catch { return ""; } });
  // Selección puntual: cuáles definiciones estás pidiendo AHORA. No se
  // guarda (es solo para armar el PDF/Word/WhatsApp de este envío) — si no
  // tildás nada, se comporta como siempre (todas las faltantes).
  const [seleccion, setSeleccion] = useState(new Set());
  const toggleSeleccion = (id) => setSeleccion(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  useEffect(() => { setSeleccion(new Set()); }, [obraId]);
  const [gformCfg, setGformCfg] = useState(false);
  const [gformBusy, setGformBusy] = useState("");
  const guardarGformUrl = (v) => { setGformUrl(v); try { localStorage.setItem("contratista_gform_url", v.trim()); } catch { } };

  async function subirExcel(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    setCargando(true);
    try {
      const XLSX = await cargarXLSX();
      const ab = await file.arrayBuffer();
      const pares = parseDefinicionesXLSX(XLSX, ab);
      if (!pares.length) { alert("No pude leer definiciones en ese archivo. Fijate que tenga los rubros y las definiciones (como el Excel de V+V)."); setCargando(false); return; }
      const nuevos = pares.map(p => ({ id: uid() + Math.random().toString(36).slice(2, 5), rubro: p.rubro, nombre: p.item, tiene: false }));
      // no pisar lo ya marcado: si ya había ítems, agrego los que no estén
      const existentesKey = new Set(items.map(i => (i.rubro + "|" + i.nombre).toLowerCase()));
      const merge = [...items, ...nuevos.filter(n => !existentesKey.has((n.rubro + "|" + n.nombre).toLowerCase()))];
      guardar(merge);
      alert(`✓ Cargué ${nuevos.length} definiciones de "${file.name}". Marcá las que ya tenés.`);
    } catch (err) { alert(err.message || "No se pudo leer el archivo."); }
    setCargando(false);
  }

  const toggle = (id) => guardar(items.map(it => it.id === id ? { ...it, tiene: !it.tiene } : it));
  const setObs = (id, v) => guardar(items.map(it => it.id === id ? { ...it, obs: v } : it));
  const quitar = (id) => guardar(items.filter(it => it.id !== id));
  // Estado + seguimiento por definición: cuándo se pidió, cuándo llegó la
  // respuesta, y el archivo/texto de esa respuesta — para poder abrir
  // cualquier definición y saber en qué está.
  const [abierto, setAbierto] = useState(null); // id de la definición abierta
  const [respTexto, setRespTexto] = useState("");
  const [subiendoResp, setSubiendoResp] = useState(false);
  const marcarPedidas = (ids) => {
    guardar(items.map(it => ids.includes(it.id) ? { ...it, estado: "pedida", historial: [...(it.historial || []), { ts: Date.now(), tipo: "pedida", texto: "Se solicitó la definición." }] } : it));
  };
  async function cargarRespuesta(id, archivoFile) {
    setSubiendoResp(true);
    let archivoUrl = null, archivoNombre = null;
    if (archivoFile) { archivoUrl = await subirArchivoDef(archivoFile); archivoNombre = archivoFile.name; if (!archivoUrl) { alert("No se pudo subir el archivo. Probá de nuevo."); setSubiendoResp(false); return; } }
    guardar(items.map(it => it.id === id ? {
      ...it, tiene: true, estado: "respondida",
      historial: [...(it.historial || []), { ts: Date.now(), tipo: "respondida", texto: respTexto.trim(), archivoUrl, archivoNombre }],
    } : it));
    setRespTexto(""); setSubiendoResp(false); setAbierto(null);
  }
  const estadoDe = (it) => it.tiene ? "respondida" : (it.estado === "pedida" ? "pedida" : "pendiente");
  const agregarManual = () => {
    const nom = nuevaDef.trim(); if (!nom) return;
    guardar([...items, { id: uid() + Math.random().toString(36).slice(2, 5), rubro: (nuevoRubro.trim() || "General"), nombre: nom, tiene: false }]);
    setNuevaDef("");
  };
  const limpiar = () => { if (window.confirm("¿Borrar todas las definiciones de esta obra?")) guardar([]); };

  const tienen = items.filter(i => i.tiene).length;
  const faltan = items.length - tienen;
  // agrupar por rubro para mostrar y para el PDF
  const grupos = [];
  items.forEach(it => { let g = grupos.find(x => x.rubro === it.rubro); if (!g) { g = { rubro: it.rubro, items: [] }; grupos.push(g); } g.items.push(it); });

  function pdfFaltantes() {
    const usarSeleccion = seleccion.size > 0;
    const faltantes = grupos.map(g => ({ rubro: g.rubro, items: g.items.filter(i => !i.tiene && (!usarSeleccion || seleccion.has(i.id))) })).filter(g => g.items.length);
    const cantEnviada = faltantes.reduce((s, g) => s + g.items.length, 0);
    const tituloDoc = usarSeleccion ? `Definición${cantEnviada > 1 ? "es" : ""} solicitada${cantEnviada > 1 ? "s" : ""}` : "Definiciones faltantes de obra";
    const rowsHtml = faltantes.map(g => `<tr class="rub"><td colspan="2">${g.rubro}</td></tr>` + g.items.map(i => `<tr><td class="dot">•</td><td>${i.nombre}${i.obs ? `<div style="font-size:11px;color:#5B6B7F;margin-top:2px">Obs: ${String(i.obs).replace(/</g, "&lt;")}</div>` : ""}</td></tr>`).join("")).join("");
    const pct = items.length ? Math.round(tienen / items.length * 100) : 0;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${tituloDoc} ${obraNom(obraId)}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Arial,sans-serif;color:#0F1B2D;padding:0 0 40px;line-height:1.5}.head{background:#0F1B2D;color:#fff;padding:20px 34px;border-bottom:4px solid #B0894F}.brand{font-size:20px;font-weight:800}.brand small{display:block;font-size:9px;color:#B0894F;letter-spacing:2px;margin-top:6px}.doc{font-size:12px;font-weight:800;color:#B0894F;text-transform:uppercase;letter-spacing:1px;margin-top:6px}.wrap{padding:0 34px}.meta{display:flex;justify-content:space-between;margin:18px 0;font-size:12px;color:#5B6B7F}.kpi{display:flex;gap:0;margin:14px 0;border:1px solid #E3E8EF;border-radius:8px;overflow:hidden}.kpi div{flex:1;text-align:center;padding:10px;border-right:1px solid #E3E8EF}.kpi div:last-child{border-right:none}.kpi b{display:block;font-size:20px}.kpi span{font-size:8px;color:#5B6B7F;text-transform:uppercase}table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}td{padding:7px 8px;border-bottom:1px solid #EEF1F5;vertical-align:top}.rub td{background:#EAF0F7;color:#1B3A5B;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.03em}.dot{width:20px;color:#B0894F;text-align:center}.obs{font-size:10px;color:#5B6B7F;margin-top:20px;border-top:1px solid #D6DCE4;padding-top:8px}.firmas{display:flex;justify-content:space-between;margin-top:44px}.firma{width:44%;text-align:center;font-size:10px;color:#5B6B7F}.firma .ln{border-top:1px solid #0F1B2D;padding-top:5px;margin-top:34px}@media print{.noprint{display:none}}</style></head><body><div class="head"><div class="brand">V+V CONSTRUCCIONES<small>CONSTRUCTORA</small></div><div class="doc">${tituloDoc}</div></div><div class="wrap"><div class="meta"><div>Obra: <b>${obraNom(obraId)}</b></div><div>Fecha: ${hoyStr()}</div></div>${usarSeleccion ? "" : `<div class="kpi"><div><b style="color:#B91C1C">${faltan}</b><span>Faltantes</span></div><div><b style="color:#16A34A">${tienen}</b><span>Definidas</span></div><div><b>${items.length}</b><span>Total</span></div><div><b>${pct}%</b><span>Definido</span></div></div>`}${faltantes.length ? `<table><tbody>${rowsHtml}</tbody></table>` : '<p style="padding:20px 0;text-align:center;color:#16A34A;font-weight:700">No hay definiciones faltantes. Todas resueltas.</p>'}<div class="obs">Las definiciones pendientes atrasan el normal desarrollo de las tareas de albañilería, revoques y colocaciones. Es importante resolverlas para poder dar curso a las tareas, contrataciones y pedidos de materiales.</div><div class="firmas"><div class="firma"><div class="ln">${empresa || "V+V Construcciones"}</div></div><div class="firma"><div class="ln">Belfast CM — Recibido</div></div></div></div></body></html>`;
    setPdfHtml(html);
    if (usarSeleccion) marcarPedidas(faltantes.flatMap(g => g.items.map(i => i.id)));
  }
  function waFaltantes() {
    const usarSeleccion = seleccion.size > 0;
    const faltantes = grupos.map(g => ({ rubro: g.rubro, items: g.items.filter(i => !i.tiene && (!usarSeleccion || seleccion.has(i.id))) })).filter(g => g.items.length);
    const cantEnviada = faltantes.reduce((s, g) => s + g.items.length, 0);
    const titulo = usarSeleccion ? `*DEFINICIÓN${cantEnviada > 1 ? "ES" : ""} SOLICITADA${cantEnviada > 1 ? "S" : ""}*` : "*DEFINICIONES FALTANTES*";
    const pie = usarSeleccion ? `\n\n(V+V Construcciones)` : `\n\nFaltan ${faltan} de ${items.length} definiciones.\n(V+V Construcciones)`;
    const txt = `${titulo}\nObra: ${obraNom(obraId)}\nFecha: ${hoyStr()}\n\n` + faltantes.map(g => `*${g.rubro}*\n` + g.items.map(i => `• ${i.nombre}${i.obs ? ` (${i.obs})` : ""}`).join("\n")).join("\n\n") + pie;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
    if (usarSeleccion) marcarPedidas(faltantes.flatMap(g => g.items.map(i => i.id)));
  }

  // Genera un Word (.doc) EDITABLE con TODAS las definiciones (faltantes y las que ya tenés) + observaciones.
  // Documento Word-compatible por HTML: se abre y edita en Word / Pages / Google Docs, sin depender de CDN.
  async function wordDefiniciones() {
    const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const filas = grupos.map(g => {
      const cab = `<tr><td colspan="3" style="background:#EAF0F7;color:#1B3A5B;font-weight:bold;font-size:11pt;padding:6px 8px;border:1px solid #B8C4D4">${esc(g.rubro)}</td></tr>`;
      const its = g.items.map(it => `<tr>
        <td style="padding:6px 8px;border:1px solid #C9D2DE;width:52%">${esc(it.nombre)}</td>
        <td style="padding:6px 8px;border:1px solid #C9D2DE;width:16%;font-weight:bold;color:${it.tiene ? "#16A34A" : "#B45309"}">${it.tiene ? "TENEMOS" : "FALTA"}</td>
        <td style="padding:6px 8px;border:1px solid #C9D2DE;width:32%">${esc(it.obs || "")}</td>
      </tr>`).join("");
      return cab + its;
    }).join("");
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>Definiciones ${esc(obraNom(obraId))}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  body{font-family:Calibri,Arial,sans-serif;color:#0F1B2D;font-size:11pt}
  h1{font-size:15pt;color:#0F1B2D;margin:0 0 2px}
  .marca{font-size:16pt;font-weight:bold;color:#0F1B2D}
  .doc{font-size:10pt;font-weight:bold;color:#B0894F;text-transform:uppercase;letter-spacing:1px}
  .meta{font-size:10pt;color:#5B6B7F;margin:10px 0 4px}
  table{border-collapse:collapse;width:100%;margin-top:8px}
  th{background:#0F1B2D;color:#fff;font-size:10pt;padding:7px 8px;border:1px solid #0F1B2D;text-align:left}
  .nota{font-size:9.5pt;color:#5B6B7F;margin-top:16px;border-top:1px solid #D6DCE4;padding-top:8px}
</style></head>
<body>
  <div class="marca">V+V CONSTRUCCIONES</div>
  <div class="doc">Definiciones de obra</div>
  <div class="meta"><b>Obra:</b> ${esc(obraNom(obraId))} &nbsp;·&nbsp; <b>Fecha:</b> ${hoyStr()} &nbsp;·&nbsp; Faltan ${faltan} de ${items.length} (${items.length ? Math.round(tienen / items.length * 100) : 0}% definido)</div>
  <table>
    <thead><tr><th>Definición</th><th>Estado</th><th>Observación</th></tr></thead>
    <tbody>${filas || '<tr><td colspan="3" style="padding:10px;border:1px solid #C9D2DE">Sin definiciones cargadas.</td></tr>'}</tbody>
  </table>
  <div class="nota">Documento editable generado por V+V Construcciones. Las definiciones pendientes atrasan el desarrollo de las tareas de albañilería, revoques y colocaciones; es importante resolverlas para dar curso a las tareas, contrataciones y pedidos de materiales.</div>
</body></html>`;
    const nombre = `Definiciones_${(obraNom(obraId) || "obra").replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")}.doc`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    // iOS/Safari bloquea la descarga directa de blobs → usamos el menú de compartir de Apple.
    try {
      const file = new File([blob], nombre, { type: "application/msword" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: nombre });
        return;
      }
    } catch (e) { if (e && e.name === "AbortError") return; }
    // Fallback (escritorio y navegadores sin share): descarga por enlace.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ── GOOGLE FORM (vía Apps Script) ──
  async function postGform(payload) {
    if (!gformUrl.trim()) throw new Error("Primero configurá la URL de Apps Script (tocá el engranaje).");
    const r = await fetch(gformUrl.trim(), { method: "POST", body: JSON.stringify(payload), redirect: "follow" });
    const txt = await r.text();
    let data; try { data = JSON.parse(txt); } catch { throw new Error("Respuesta inesperada de Google. Revisá que la URL termine en /exec y esté publicada como 'Cualquier usuario'."); }
    if (!data.ok) throw new Error(data.error || "Error al hablar con Google.");
    return data;
  }

  async function generarGform() {
    if (!items.length) { alert("No hay definiciones cargadas en esta obra."); return; }
    setGformBusy("crear");
    try {
      const data = await postGform({ action: "crear", obra: obraNom(obraId), items: items.map(i => ({ rubro: i.rubro, nombre: i.nombre })) });
      patchReg({ formId: data.formId, formUrl: data.viewUrl, formEdit: data.editUrl });
      setGformBusy("");
      // compartir el link (share sheet en iOS)
      const link = data.viewUrl;
      try {
        if (navigator.share) { await navigator.share({ title: `Definiciones ${obraNom(obraId)}`, text: `Formulario de definiciones – ${obraNom(obraId)}`, url: link }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
      window.prompt("Formulario creado. Copiá el link y mandáselo al jefe de obra:", link);
    } catch (err) { setGformBusy(""); alert(err.message || "No se pudo crear el formulario."); }
  }

  async function traerRespuestas(silencioso) {
    if (!reg?.formId) { if (!silencioso) alert("Todavía no generaste el formulario de esta obra."); return; }
    setGformBusy("leer");
    try {
      const data = await postGform({ action: "leer", formId: reg.formId });
      if (!data.respondido) { setGformBusy(""); if (!silencioso) alert("El formulario todavía no tiene respuestas."); return; }
      const estados = data.estados || {};
      const nextItems = items.map(it => estados[it.nombre] ? { ...it, tiene: estados[it.nombre] === "tenemos" } : it);
      const otros = (definiciones || []).filter(r => r.obra_id !== obraId);
      persistDef([...otros, { ...(reg || {}), obra_id: obraId, items: nextItems, upd: Date.now(), gformObs: data.obs || {}, gformFecha: data.fecha }]);
      setGformBusy("");
      if (!silencioso) alert("✓ Actualicé las definiciones con las respuestas del jefe de obra.");
    } catch (err) { setGformBusy(""); if (!silencioso) alert(err.message || "No se pudieron traer las respuestas."); }
  }

  // Auto-traer respuestas al abrir una obra que ya tiene formulario
  const ultObra = useRef("");
  useEffect(() => {
    if (obraId && obraId !== ultObra.current && reg?.formId && gformUrl.trim()) { ultObra.current = obraId; traerRespuestas(true); }
    else if (obraId !== ultObra.current) ultObra.current = obraId;
  }, [obraId, reg?.formId]);

  return (<div>
    <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Subí el Excel de definiciones, marcá las que ya tenés, y generá el PDF de faltantes para Belfast.</div>
    <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
    <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", fontSize: 14, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }}>
      {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </select>

    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: cargando ? "default" : "pointer", opacity: cargando ? 0.6 : 1, marginBottom: 14 }}>
      {cargando ? "Leyendo el Excel…" : "⬆︎ Subir Excel de definiciones"}
      <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={cargando} onChange={subirExcel} style={{ display: "none" }} />
    </label>

    {/* Cargar una definición a mano — siempre disponible, no hace falta
        haber subido un Excel antes. */}
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      <input value={nuevoRubro} onChange={e => setNuevoRubro(e.target.value)} placeholder="Rubro" style={{ width: 110, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, color: T.text }} />
      <input value={nuevaDef} onChange={e => setNuevaDef(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregarManual(); } }} placeholder="Agregar definición…" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, color: T.text }} />
      <button onClick={agregarManual} style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "0 15px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>＋</button>
    </div>

    {items.length > 0 && <>
      {/* resumen */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["Faltan", faltan, "#B91C1C"], ["Tenemos", tienen, "#16A34A"], ["Total", items.length, T.text]].map(([l, v, c]) => (
          <div key={l} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>{l}</div>
          </div>
        ))}
      </div>

      {grupos.map(g => (<div key={g.rubro} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 13, marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.head, marginBottom: 8 }}>{g.rubro}</div>
        {g.items.map(it => { const est = estadoDe(it); const estLbl = est === "respondida" ? "TENEMOS" : est === "pedida" ? "PEDIDA" : "FALTA"; const estColor = est === "respondida" ? "#16A34A" : est === "pedida" ? "#B0894F" : "#B45309";
        return (<div key={it.id} style={{ padding: "9px 0", borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => toggle(it.id)} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${it.tiene ? "#16A34A" : T.border}`, background: it.tiene ? "#16A34A" : "transparent", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{it.tiene ? "✓" : ""}</button>
            <div onClick={() => { setAbierto(abierto === it.id ? null : it.id); setRespTexto(""); }} style={{ flex: 1, fontSize: 13, color: it.tiene ? T.text : T.sub, cursor: "pointer" }}>{it.nombre}<span style={{ fontSize: 9.5, fontWeight: 800, color: estColor, marginLeft: 6 }}>{estLbl}</span>{(it.historial || []).length > 0 && <span style={{ fontSize: 9.5, color: T.muted, marginLeft: 6 }}>· {abierto === it.id ? "▾" : "▸"} historial</span>}</div>
            {!it.tiene && <button onClick={() => toggleSeleccion(it.id)} title="Pedir esta ahora" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${seleccion.has(it.id) ? BRASS : T.border}`, background: seleccion.has(it.id) ? BRASS : "transparent", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>★</button>}
            <button onClick={() => quitar(it.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>✕</button>
          </div>
          <input defaultValue={it.obs || ""} onBlur={e => setObs(it.id, e.target.value)} placeholder="Observación (opcional)…" style={{ width: "100%", marginTop: 6, marginLeft: 34, maxWidth: "calc(100% - 34px)", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 10px", fontSize: 12, color: T.text, boxSizing: "border-box" }} />

          {abierto === it.id && <div style={{ marginTop: 10, marginLeft: 34, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: T.head, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Seguimiento</div>
            {(it.historial || []).length === 0 && <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 10 }}>Todavía no se pidió esta definición — tildala con ★ y mandala por PDF o WhatsApp para empezar el seguimiento.</div>}
            {(it.historial || []).slice().reverse().map((h, i) => (<div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: h.tipo === "respondida" ? "#16A34A" : BRASS, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text }}>{h.tipo === "respondida" ? "Respondida" : "Pedida"} <span style={{ fontWeight: 400, color: T.muted, fontSize: 10 }}>{new Date(h.ts).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div>
                {h.texto && <div style={{ fontSize: 12, color: T.sub, marginTop: 2, whiteSpace: "pre-wrap" }}>{h.texto}</div>}
                {h.archivoUrl && <a href={h.archivoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 4, fontSize: 11.5, color: BRASS, fontWeight: 700, textDecoration: "none" }}>📎 {h.archivoNombre || "Ver archivo"}</a>}
              </div>
            </div>))}

            {!it.tiene && <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: T.head, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Cargar respuesta</div>
              <textarea value={abierto === it.id ? respTexto : ""} onChange={e => setRespTexto(e.target.value)} placeholder="Escribí la respuesta que llegó (o dejá vacío si solo adjuntás un archivo)…" rows={2} style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 10px", fontSize: 12, color: T.text, boxSizing: "border-box", resize: "vertical", marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ flex: 1, textAlign: "center", background: T.card, border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  📎 Adjuntar archivo
                  <input type="file" accept="image/*,.pdf,.doc,.docx" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) cargarRespuesta(it.id, f); }} disabled={subiendoResp} />
                </label>
                <button onClick={() => cargarRespuesta(it.id, null)} disabled={subiendoResp || !respTexto.trim()} style={{ flex: 1, background: respTexto.trim() ? T.navy : T.border, color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 12, fontWeight: 700, cursor: respTexto.trim() ? "pointer" : "default" }}>{subiendoResp ? "Guardando…" : "Guardar solo texto"}</button>
              </div>
            </div>}
          </div>}
        </div>); })}
      </div>))}

      {seleccion.size > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.al, border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: BRASS, flex: 1 }}>★ {seleccion.size} definición{seleccion.size > 1 ? "es" : ""} seleccionada{seleccion.size > 1 ? "s" : ""} — el PDF y el WhatsApp van a llevar solo esta{seleccion.size > 1 ? "s" : ""}.</span>
        <button onClick={() => setSeleccion(new Set())} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, fontWeight: 700, textDecoration: "underline", cursor: "pointer", flexShrink: 0 }}>Limpiar</button>
      </div>}

      <button onClick={pdfFaltantes} style={{ width: "100%", background: T.navy, color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}><Ico n="doc" /> {seleccion.size > 0 ? `PDF de la${seleccion.size > 1 ? "s" : ""} seleccionada${seleccion.size > 1 ? "s" : ""}` : "PDF de definiciones faltantes"}</button>
      <button onClick={wordDefiniciones} style={{ width: "100%", background: "#2B579A", color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}><Ico n="word" /> Word editable (todas + observaciones)</button>
      <button onClick={waFaltantes} style={{ width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}><Ico n="send" /> {seleccion.size > 0 ? `Enviar la${seleccion.size > 1 ? "s" : ""} seleccionada${seleccion.size > 1 ? "s" : ""} por WhatsApp` : "Enviar faltantes por WhatsApp"}</button>

      {/* ── Google Form ── */}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: 12, marginBottom: 9, background: T.card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: gformCfg ? 10 : (reg?.formId ? 10 : 0) }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.head }}><Ico n="list" /> Formulario para el jefe de obra</div>
          <button onClick={() => setGformCfg(v => !v)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 9px", fontSize: 11, fontWeight: 700, color: T.sub, cursor: "pointer" }}>⚙︎ {gformUrl ? "Configurado" : "Configurar"}</button>
        </div>

        {gformCfg && <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, marginBottom: 6 }}>Pegá la URL de tu Apps Script (la que termina en <b>/exec</b>). La creás una sola vez con el instructivo que te pasé.</div>
          <input value={gformUrl} onChange={e => guardarGformUrl(e.target.value)} placeholder="https://script.google.com/…/exec" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 11px", fontSize: 12, color: T.text, boxSizing: "border-box" }} />
        </div>}

        {!reg?.formId
          ? <button onClick={generarGform} disabled={gformBusy === "crear" || !gformUrl} style={{ width: "100%", background: gformUrl ? "#4285F4" : T.border, color: "#fff", border: "none", borderRadius: 9, padding: "12px", fontSize: 13, fontWeight: 700, cursor: gformUrl ? "pointer" : "default" }}>{gformBusy === "crear" ? "Creando el formulario…" : "Generar Google Form"}</button>
          : <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={generarGform} style={{ flex: 1, background: "#4285F4", color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Compartir link</button>
                <button onClick={() => traerRespuestas(false)} disabled={gformBusy === "leer"} style={{ flex: 1, background: T.navy, color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{gformBusy === "leer" ? "Trayendo…" : "↻ Traer respuestas"}</button>
              </div>
              {reg.gformFecha && <div style={{ fontSize: 10.5, color: T.muted, textAlign: "center" }}>Última respuesta cargada: {new Date(reg.gformFecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>}
              <button onClick={() => { if (confirm("¿Desvincular este formulario? Vas a poder generar uno nuevo.")) patchReg({ formId: null, formUrl: null, formEdit: null }); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 10.5, cursor: "pointer", textDecoration: "underline" }}>Desvincular formulario</button>
            </div>}
      </div>

      {/* observaciones del jefe (de las respuestas del form) */}
      {reg?.gformObs && Object.keys(reg.gformObs).some(k => reg.gformObs[k]) && <div style={{ border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: 12, marginBottom: 9, background: T.al }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.head, marginBottom: 6 }}>Observaciones del jefe de obra</div>
        {Object.keys(reg.gformObs).filter(k => reg.gformObs[k]).map(k => (
          <div key={k} style={{ fontSize: 12, color: T.text, marginBottom: 4, lineHeight: 1.4 }}><b>{k}:</b> {reg.gformObs[k]}</div>
        ))}
      </div>}
      <button onClick={limpiar} style={{ width: "100%", background: "none", color: T.muted, border: "none", padding: "8px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Borrar todo y empezar de nuevo</button>
    </>}

    {items.length === 0 && !cargando && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "10px", lineHeight: 1.6 }}>Subí el Excel de definiciones, o cargalas una por una arriba, con rubro y definición.</div>}

    {pdfHtml && <div style={{ position: "fixed", inset: 0, background: "#0F1B2D", zIndex: 500, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", rowGap: 8, padding: `calc(10px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 14px 10px`, background: T.navy, borderBottom: "1px solid rgba(255,255,255,.1)", alignItems: "center", flexShrink: 0, position: "relative", zIndex: 2 }}>
        <button onClick={() => setPdfHtml(null)} style={{ background: "rgba(255,255,255,.16)", color: "#fff", border: "none", borderRadius: 9, padding: "11px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>‹ Volver</button>
        <div style={{ flex: 1 }} />
        <button onClick={imprimirPdf} style={{ background: BRASS, color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Guardar / Imprimir</button>
      </div>
      <iframe ref={pdfRef} srcDoc={pdfHtml} title="pdf" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
    </div>}
  </div>);
}

function RecepcionDocs({ obras, empresa, docrecepcion, persistDoc }) {
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [nuevoItem, setNuevoItem] = useState("");
  const [catNuevo, setCatNuevo] = useState(DOC_CATS[0]);
  const obraNom = id => obras.find(o => o.id === id)?.nombre || "—";

  const reg = (docrecepcion || []).find(r => r.obra_id === obraId);
  const items = reg ? reg.items : DOCS_BASE.map((d, i) => ({ id: "base" + i, nombre: d.n, cat: d.c, recibido: false, fecha: "" }));

  const guardarItems = (nextItems) => {
    const otros = (docrecepcion || []).filter(r => r.obra_id !== obraId);
    persistDoc([...otros, { obra_id: obraId, items: nextItems, upd: Date.now() }]);
  };
  const toggle = (id) => guardarItems(items.map(it => it.id === id ? { ...it, recibido: !it.recibido, fecha: !it.recibido ? hoyStr() : "" } : it));
  const agregar = () => { const n = nuevoItem.trim(); if (!n) return; guardarItems([...items, { id: uid() + Date.now(), nombre: n, cat: catNuevo, recibido: false, fecha: "" }]); setNuevoItem(""); };
  const quitar = (id) => guardarItems(items.filter(it => it.id !== id));
  const recibidos = items.filter(it => it.recibido).length;

  function remitoWA() {
    const lineas = items.map(it => `${it.recibido ? "" : "⬜"} ${it.nombre}${it.recibido && it.fecha ? ` (${it.fecha})` : ""}`);
    const txt = `*REMITO DE RECEPCIÓN DE DOCUMENTACIÓN*\nObra: ${obraNom(obraId)}\nFecha: ${hoyStr()}\nContratista: ${empresa}\n\nDocumentación inicial básica:\n${lineas.join("\n")}\n\nRecibidos: ${recibidos} de ${items.length}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  }

  if (obras.length === 0) return <div style={{ padding: "40px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>Todavía no hay obras cargadas.</div>;

  return (<div>
    <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Remito de recepción de la documentación inicial de obra. Marcá lo que fuiste recibiendo y generá el remito.</div>
    <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
    <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", fontSize: 14, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }}>
      {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </select>

    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>Documentación inicial</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: recibidos === items.length && items.length > 0 ? "#16A34A" : T.muted }}>{recibidos} de {items.length} recibidos</span>
      </div>
      {DOC_CATS.concat(["Otros"]).map(cat => {
        const delGrupo = items.filter(it => (it.cat || "Documentación técnica") === cat || (cat === "Otros" && it.cat && !DOC_CATS.includes(it.cat)));
        if (!delGrupo.length) return null;
        const okG = delGrupo.filter(it => it.recibido).length;
        return (<div key={cat} style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: T.accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: okG === delGrupo.length ? "#16A34A" : T.muted }}>{okG}/{delGrupo.length}</span>
          </div>
          {delGrupo.map(it => (<div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${T.border}` }}>
        <button onClick={() => toggle(it.id)} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${it.recibido ? "#16A34A" : T.border}`, background: it.recibido ? "#16A34A" : "transparent", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{it.recibido ? "✓" : ""}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: it.recibido ? T.text : T.sub }}>{it.nombre}</div>
          {it.recibido && it.fecha && <div style={{ fontSize: 10, color: "#16A34A", fontWeight: 700 }}>Recibido {it.fecha}</div>}
        </div>
        {!DOCS_BASE.some(d => d.n === it.nombre) && <button onClick={() => quitar(it.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>}
      </div>))}
        </div>);
      })}
      <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
        <select value={catNuevo} onChange={e => setCatNuevo(e.target.value)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 8px", fontSize: 12, color: T.text, maxWidth: 130 }}>
          {DOC_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={nuevoItem} onChange={e => setNuevoItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }} placeholder="Agregar ítem…" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text }} />
        <button onClick={agregar} style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "0 15px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>＋</button>
      </div>
    </div>

    <button onClick={remitoWA} style={{ width: "100%", marginTop: 14, background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}><Ico n="send" /> Enviar remito de recepción por WhatsApp</button>
  </div>);
}

export default function ContratistaApp() {
  useEffect(() => { registrarApertura("contratista"); }, []);
  const [empresa, setEmpresa] = useState(() => { try { return localStorage.getItem("contratista_empresa") || ""; } catch { return ""; } });
  const [persona, setPersona] = useState(() => { try { return localStorage.getItem("contratista_persona") || ""; } catch { return ""; } });
  const setPersonaP = (v) => { setPersona(v); try { localStorage.setItem("contratista_persona", v); } catch { } };
  const [tmpEmpresa, setTmpEmpresa] = useState("");
  const [obrasTodas, setObras] = useState([]);
  const [matpedidos, setMatpedidos] = useState([]);
  const [vista, setVista] = useState("inicio"); // "inicio" | "pedidos" | "recepcion" | "definiciones"
  const [fObra, setFObra] = useState("");   // filtro obra ("" = todas)
  const [diagOpen, setDiagOpen] = useState(false);   // panel de diagnóstico temporal
  const [fTipo, setFTipo] = useState("");   // filtro tipo ("" = todos)
  const [fEstado, setFEstado] = useState(""); // "" | "pendiente" | "levantado"
  const [docrecepcion, setDocrecepcion] = useState([]);
  const [definiciones, setDefiniciones] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [waFor, setWaFor] = useState(null);
  const [form, setForm] = useState(null);
  const [editEmpresa, setEditEmpresa] = useState(false);
  const [estiloOpen, setEstiloOpen] = useState(false);
  const [estilo, setEstilo] = useState(() => leerEstilo());
  aplicarEstilo(estilo);
  const obras = obrasTodas.filter(o => !((estilo.ocultas) || []).includes(o.id));
  const [menuOpen, setMenuOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [obrasOpen, setObrasOpen] = useState(false);
  const [confOcultar, setConfOcultar] = useState(null);
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    const h = (e) => { setAviso(String(e.detail || "")); setTimeout(() => setAviso(""), 9000); };
    window.addEventListener("contratista-aviso", h);
    return () => window.removeEventListener("contratista-aviso", h);
  }, []);
  useEffect(() => {
    try { if (!document.getElementById("fonts-fraunces")) { const l = document.createElement("link"); l.id = "fonts-fraunces"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap"; document.head.appendChild(l); } } catch { }
  }, []);
  const lastWrite = useRef(0);
  const lastWriteDoc = useRef(0);
  async function persistDoc(next) {
    lastWriteDoc.current = Date.now();
    setDocrecepcion(next);
    try { localStorage.setItem("vv_docrecepcion", JSON.stringify(next)); } catch { }
    await storage.set("vv_docrecepcion", JSON.stringify(next)).catch(() => { });
  }
  const lastWriteDef = useRef(0);
  async function persistDef(next) {
    lastWriteDef.current = Date.now();
    setDefiniciones(next);
    try { localStorage.setItem("vv_definiciones", JSON.stringify(next)); } catch { }
    await storage.set("vv_definiciones", JSON.stringify(next)).catch(() => { });
  }

  useEffect(() => { initPush("contratista"); }, []);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const [ro, rm, rp, rr] = await Promise.all([storage.get("vv_obras"), storage.get("vv_matpedidos"), storage.get("vv_personal"), storage.get("vv_obras_remap")]);
        if (!alive) return;
        let remapObj = {};
        try { if (rr?.value) remapObj = JSON.parse(rr.value) || {}; } catch { }
        if (ro?.value) { try { setObras(JSON.parse(ro.value).filter(o => { const n = (o.nombre || "").toLowerCase(); return !(n.includes("canning") && n.includes("815")); })); } catch { } }
        if (rp?.value) { try { setPersonal(JSON.parse(rp.value)); } catch { } }
        if (rm?.value && Date.now() - lastWrite.current > 8000) { try { let mp = JSON.parse(rm.value); if (Object.keys(remapObj).length) mp = mp.map(p => remapObj[p.obra_id] ? { ...p, obra_id: remapObj[p.obra_id] } : p); setMatpedidos(prev => JSON.stringify(mp) !== JSON.stringify(prev) ? mp : prev); } catch { } }
        try { const rd = await storage.get("vv_docrecepcion"); if (alive && rd?.value && Date.now() - lastWriteDoc.current > 8000) { const dd = JSON.parse(rd.value); setDocrecepcion(prev => JSON.stringify(dd) !== JSON.stringify(prev) ? dd : prev); } } catch { }
        try { const rf = await storage.get("vv_definiciones"); if (alive && rf?.value && Date.now() - lastWriteDef.current > 8000) { const df = JSON.parse(rf.value); setDefiniciones(prev => JSON.stringify(df) !== JSON.stringify(prev) ? df : prev); } } catch { }
      } catch { }
    }
    pull();
    const iv = setInterval(pull, 6000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  function guardarEmpresa() {
    const e = tmpEmpresa.trim(); if (!e) return;
    try { localStorage.setItem("contratista_empresa", e); } catch { }
    setEmpresa(e); setEditEmpresa(false); setTmpEmpresa("");
  }

  async function persistMat(next) {
    lastWrite.current = Date.now();
    setMatpedidos(next);
    try { localStorage.setItem("vv_matpedidos", JSON.stringify(next)); } catch { }
    await storage.set("vv_matpedidos", JSON.stringify(next)).catch(() => { });
  }

  function nuevo(tipo = "material") { setForm({ tipo, obra_id: obras[0]?.id || "", items: [{ nombre: "", cantidad: "", unidad: "u", detalle: "" }], nota: "", fecha_pedido: new Date().toISOString().slice(0, 10), fecha_necesita: "", solicitante: persona }); }
  function editar(p) { setForm({ id: p.id, tipo: p.tipo || "material", obra_id: p.obra_id, items: (p.items && p.items.length ? p.items.map(it => ({ nombre: it.nombre || "", cantidad: it.cantidad != null ? String(it.cantidad) : "", unidad: it.unidad || "u", detalle: it.detalle || "" })) : [{ nombre: "", cantidad: "", unidad: "u", detalle: "" }]), nota: p.nota || "", fecha_pedido: p.fecha_pedido || "", fecha_necesita: p.fecha_necesita || "" }); }
  function fmtISO(iso) { if (!iso) return ""; const [y, m, d] = String(iso).split("-"); return d && m && y ? `${d}/${m}/${y}` : iso; }
  function icsEntrega(p) {
    const dia = String(p.fecha_necesita || "").replace(/-/g, ""); if (dia.length !== 8) return "";
    const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const obra = obraNom(p.obra_id);
    const items = (p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ");
    const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const L = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//V+V//Contratista//ES", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT", `UID:${p.id}@vvcontratista`, `DTSTAMP:${dtstamp}`,
      `DTSTART:${dia}T080000`, `DTEND:${dia}T090000`,
      `SUMMARY:${esc("Entrega materiales — " + obra)}`,
      `DESCRIPTION:${esc("Pedido de " + (p.empresa || "") + "\n" + items + (p.nota ? "\nNota: " + p.nota : ""))}`,
      `LOCATION:${esc(obra)}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio: entrega de materiales mañana", "TRIGGER:-P1D", "END:VALARM",
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Entrega de materiales hoy", "TRIGGER:-PT1H", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ];
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(L.join("\r\n"));
  }
  function addItem() { setForm(f => ({ ...f, items: [...f.items, { nombre: "", cantidad: "", unidad: "u", detalle: "" }] })); }
  function setItem(i, k, v) { setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) })); }
  function delItem(i) { setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) })); }
  async function guardar() {
    const tipo = form.tipo || "material";
    const tp = tipoDe(tipo);
    const items = (form.items || []).filter(it => (it.nombre || "").trim()).map(it => ({ nombre: it.nombre.trim(), cantidad: it.cantidad != null ? String(it.cantidad) : "", unidad: it.unidad || "u", detalle: (it.detalle || "").trim() }));
    if (!items.length) { alert(`Agregá al menos ${tipo === "material" ? "un material" : tipo === "plano" ? "un plano" : "una definición"}.`); return; }
    const r = await storage.get("vv_matpedidos"); let arr = []; if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    if (form.id) {
      const next = arr.map(x => x.id === form.id ? { ...x, tipo, obra_id: form.obra_id, items, nota: form.nota || "", fecha_pedido: form.fecha_pedido || "", fecha_necesita: form.fecha_necesita || "", solicitante: (form.solicitante || persona || "").trim(), editadoFecha: hoyStr(), editadoPor: (form.solicitante || persona || "").trim() } : x);
      const pid = form.id; await persistMat(next); setForm(null); setWaFor(pid);
      alert("✓ Pedido actualizado. Ya se ve así en V+V y Belfast. Podés reenviarlo por WhatsApp abajo.");
      return;
    }
    const p = { id: uid() + Date.now(), tipo, obra_id: form.obra_id, items, nota: form.nota || "", fecha: hoyStr(), fecha_pedido: form.fecha_pedido || "", fecha_necesita: form.fecha_necesita || "", ts: Date.now(), de: "contratista", empresa, solicitante: (form.solicitante || persona || "").trim(), leido: false, leidoFecha: "" };
    await persistMat([p, ...arr]); setForm(null); setWaFor(p.id);
    pushNotify(`Nuevo pedido de ${tp.label.toLowerCase()}`, `${empresa}: ${items.map(it => it.nombre).join(", ").slice(0, 90)}`, "");
    alert("✓ Pedido enviado a V+V y Belfast. Ahora podés mandarlo por WhatsApp al encargado de obra (abajo).");
  }

  async function borrar(id) {
    if (!confirm("¿Eliminar este pedido de materiales? También se quita en V+V y Belfast.")) return;
    const r = await storage.get("vv_matpedidos"); let arr = []; if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    await persistMat(arr.filter(x => x.id !== id));
  }
  const obraNom = id => obras.find(o => o.id === id)?.nombre || "—";
  function waText(p) {
    const tp = tipoDe(p.tipo);
    const lines = itemsTexto(p).map(l => `• ${l}`);
    return `*Pedido de ${tp.label.toLowerCase()}* — ${obraNom(p.obra_id)}\nFecha: ${p.fecha}${p.fecha_necesita ? `\n*Necesito en obra: ${fmtISO(p.fecha_necesita)}*` : ""}\nContratista: ${p.empresa || empresa}\n\n${lines.join("\n")}${p.nota ? "\n\nNota: " + p.nota : ""}\n\nPor favor, confirmá la recepción respondiendo este mensaje con *OK / RECIBIDO*.`;
  }
  function waLink(text, phone) {
    const t = encodeURIComponent(text);
    if (phone) { const clean = String(phone).replace(/\D/g, ""); const num = clean.startsWith("54") ? clean : ("549" + clean); return `https://wa.me/${num}?text=${t}`; }
    return `https://wa.me/?text=${t}`;
  }
  function encargados(obra_id) { return (personal || []).filter(pe => pe.obra_id === obra_id && (pe.telefono || "").trim()); }
  async function marcarEnviado(id, quien) {
    const r = await storage.get("vv_matpedidos"); let arr = []; if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    await persistMat(arr.map(x => x.id === id ? { ...x, waEnviado: true, waEnviadoFecha: hoyStr(), waEnviadoPor: quien || (empresa) } : x));
  }
  const listaTodos = (matpedidos || []).filter(p => !((estilo.ocultas) || []).includes(p.obra_id)).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const lista = listaTodos.filter(p =>
    (!fObra || p.obra_id === fObra) &&
    (!fTipo || (p.tipo || "material") === fTipo)
  );
  const obrasConPedidos = obras;   // antes solo mostraba las que YA tenían algún pedido — dejaba obras nuevas invisibles en el filtro hasta que alguien ya les hubiera cargado uno
  // agrupar los pedidos por obra, para el registro general
  const grupos = [];
  lista.forEach(p => { let g = grupos.find(x => x.obra_id === p.obra_id); if (!g) { g = { obra_id: p.obra_id, nombre: obraNom(p.obra_id) || "Sin obra", pedidos: [] }; grupos.push(g); } g.pedidos.push(p); });
  grupos.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const tabs = [["inicio", "Inicio", "building"], ["pedidos", "Pedidos", "list"], ["recepcion", "Recepción", "doc"], ["definiciones", "Definiciones", "ruler"]];
  const FONT_UI = "Inter, system-ui, sans-serif";
  const hoyISO = new Date().toISOString().slice(0, 10);
  const mios = listaTodos.filter(p => p.de === "contratista" && p.empresa === empresa);
  const porAvisar = mios.filter(p => !p.waEnviado).length;
  const filasEstado = (obras || []).map(o => {
    const ped = listaTodos.filter(p => p.obra_id === o.id);
    const ultMat = ped.filter(p => (p.tipo || "material") === "material").reduce((m, x) => Math.max(m, x.ts || 0), 0);
    return { id: o.id, nombre: o.nombre, total: ped.length, dm: ultMat ? Math.floor((Date.now() - ultMat) / 86400000) : null };
  }).filter(f => f.total > 0 || f.dm === null);
  const alertaDm = (n) => n === null || n >= 7;
  const obrasSinPedir = filasEstado.filter(f => alertaDm(f.dm)).length;
  const proximas = listaTodos.filter(p => p.fecha_necesita && p.fecha_necesita >= hoyISO).sort((a, b) => String(a.fecha_necesita).localeCompare(String(b.fecha_necesita))).slice(0, 3);
  const lblS = { fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em" };
  const topPad = (n) => `calc(${n}px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px))`;
  const btnIco = { background: T.card, border: `1px solid ${T.border}`, color: T.text, borderRadius: 12, width: 40, height: 40, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" };
  const txtDm = (n) => n === null ? "sin pedidos de material" : n === 0 ? "pidió hoy" : n === 1 ? "pidió ayer" : `hace ${n} días`;
  const aplicarYGuardar = (n) => { guardarEstilo(n); setEstilo(n); };

  if (!empresa || editEmpresa) {
    return (<div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, paddingTop: topPad(24), fontFamily: FONT_UI }}>
      <div style={{ width: 92, height: 92, borderRadius: "50%", border: `2px solid ${BRASS}`, overflow: "hidden", background: estilo.logo ? "#fff" : T.card, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: T.shadow }}>{estilo.logo ? <img src={estilo.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={40} c={BRASS} />}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: BRASS, letterSpacing: ".22em", textTransform: "uppercase", marginBottom: 8 }}>V+V Construcciones</div>
      <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: T.head, marginBottom: 8, textAlign: "center" }}>Pedidos de materiales</div>
      <div style={{ fontSize: 13, color: T.sub, marginBottom: 24, lineHeight: 1.5, textAlign: "center", maxWidth: 320 }}>Ingresá el nombre de tu empresa para cargar pedidos de las obras.</div>
      <div style={{ width: "100%", maxWidth: 400, background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 20, boxShadow: T.shadow }}>
        <input value={tmpEmpresa} onChange={e => setTmpEmpresa(e.target.value)} onKeyDown={e => { if (e.key === "Enter") guardarEmpresa(); }} placeholder="Nombre de tu empresa" autoFocus style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "14px 15px", fontSize: 15, color: T.text, marginBottom: 14, boxSizing: "border-box" }} />
        <button onClick={guardarEmpresa} disabled={!tmpEmpresa.trim()} style={{ width: "100%", background: tmpEmpresa.trim() ? BRASS : T.border, color: "#fff", border: "none", borderRadius: T.rsm, padding: "14px", fontSize: 14.5, fontWeight: 800, cursor: tmpEmpresa.trim() ? "pointer" : "default" }}>Entrar</button>
        {editEmpresa && <button onClick={() => { setEditEmpresa(false); setTmpEmpresa(""); }} style={{ width: "100%", background: "none", border: "none", color: T.muted, fontSize: 12, marginTop: 12, cursor: "pointer", textDecoration: "underline" }}>Cancelar</button>}
      </div>
    </div>);
  }

  const encabezado = (titulo) => (<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: `${topPad(16)} 20px 14px` }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, letterSpacing: ".16em", textTransform: "uppercase" }}>{empresa}</div>
      <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: T.head, lineHeight: 1.15, marginTop: 2 }}>{titulo}</div>
    </div>
    <button onClick={() => setMenuOpen(true)} aria-label="Más opciones" style={btnIco}>•••</button>
  </div>);

  const tarjetaPedido = (p) => { const mio = p.de === "contratista" && p.empresa === empresa; const tp = tipoDe(p.tipo); return (<div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: T.shadow }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, minWidth: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 800, color: "#fff", background: tp.color, borderRadius: 6, padding: "3px 8px", marginRight: 7, verticalAlign: "middle" }}><TipoIcon tipo={p.tipo} size={12} color="#fff" /> {tp.label}</span>
        <span style={{ fontWeight: 800, color: T.head }}>{obraNom(p.obra_id)}</span><span style={{ color: T.muted, fontWeight: 600 }}> · {p.fecha}</span>
      </div>
      <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: p.de === "vv" ? T.accent : p.de === "cliente" ? "#7C3AED" : BRASS, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>{origenLabel(p)}</span>
    </div>
    <div style={{ fontSize: 13, color: T.sub, marginTop: 8, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{itemsTexto(p).map(l => `• ${l}`).join("\n")}</div>
    {(p.solicitante || p.empresa) && <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 9, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 700, color: T.sub }}><Ico n="user" s={12} c={T.sub} /> Pidió: {p.solicitante || p.empresa}{p.solicitante && p.empresa ? ` (${p.empresa})` : ""}</div>}
    {p.nota && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6, fontStyle: "italic" }}>{p.nota}</div>}
    {p.fecha_necesita && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.al, color: T.accent, borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 700 }}><Ico n="cal2" /> Necesito en obra: {fmtISO(p.fecha_necesita)}</div>
      <a href={icsEntrega(p)} download={`Entrega-${obraNom(p.obra_id).replace(/[^\w]/g, "_")}.ics`} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.navy, color: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}><Ico n="bell" /> Agendar + alerta</a>
    </div>}
    {mio && <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 9 }}><button onClick={() => editar(p)} style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Editar</button><button onClick={() => borrar(p.id)} style={{ background: T.dangerBg, border: `1px solid ${T.dangerBd}`, color: T.danger, borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Eliminar</button></div>}
    {p.waEnviado && <div style={{ fontSize: 10, fontWeight: 700, color: T.ok, marginTop: 8 }}><Ico n="send" /> Enviado por WhatsApp{p.waEnviadoFecha ? " · " + p.waEnviadoFecha : ""}{p.waEnviadoPor ? " · " + p.waEnviadoPor : ""}</div>}
    <button onClick={() => setWaFor(waFor === p.id ? null : p.id)} style={{ width: "100%", marginTop: 10, background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><Ico n="send" /> Mandar por WhatsApp al encargado</button>
    {waFor === p.id && <div style={{ marginTop: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 11px" }}>
      <div style={{ ...lblS, marginBottom: 8 }}>Enviar a…</div>
      {encargados(p.obra_id).map(j => <a key={j.id} href={waLink(waText(p), j.telefono)} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", marginBottom: 7 }}><Ico n="send" /> {j.nombre}{j.rol ? ` · ${j.rol}` : ""}</a>)}
      <a href={waLink(waText(p))} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Elegir contacto…</a>
      {encargados(p.obra_id).length === 0 && <div style={{ fontSize: 10, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>No hay encargado con teléfono cargado para esta obra. Usá "Elegir contacto" o pedile a V+V que cargue el teléfono del encargado.</div>}
    </div>}
  </div>); };

  const ocultarObra = (id) => { const nuevas = [...((estilo.ocultas) || []).filter(x => x !== id), id]; aplicarYGuardar({ ...estilo, ocultas: nuevas }); setConfOcultar(null); if (fObra === id) setFObra(""); };
  const selBtn = (on) => ({ border: `2px solid ${on ? BRASS : T.border}`, background: T.bg, color: T.text, borderRadius: 12, cursor: "pointer", fontFamily: "inherit" });

  return (<div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: FONT_UI, maxWidth: 620, margin: "0 auto", position: "relative" }}>
    {aviso && <div onClick={() => setAviso("")} style={{ position: "fixed", top: topPad(8), left: 12, right: 12, zIndex: 700, maxWidth: 596, margin: "0 auto", background: T.dangerBg, border: `1px solid ${T.dangerBd}`, color: T.danger, backdropFilter: "blur(10px)", borderRadius: 12, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, lineHeight: 1.4, boxShadow: T.shadow, cursor: "pointer" }}>{aviso}</div>}

    {vista === "inicio" && <div>
      <div style={{ position: "relative", padding: `${topPad(18)} 20px 26px`, textAlign: "center", background: `radial-gradient(120% 90% at 50% 0%, ${T.al} 0%, transparent 70%)` }}>
        <button onClick={() => setMenuOpen(true)} aria-label="Más opciones" style={{ ...btnIco, position: "absolute", right: 18, top: topPad(14) }}>•••</button>
        <div style={{ width: 96, height: 96, borderRadius: "50%", border: `2px solid ${BRASS}`, overflow: "hidden", background: estilo.logo ? "#fff" : T.card, display: "flex", alignItems: "center", justifyContent: "center", margin: "6px auto 16px", boxShadow: T.shadow }}>{estilo.logo ? <img src={estilo.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={42} c={BRASS} />}</div>
        <div style={{ fontSize: 10.5, letterSpacing: ".22em", textTransform: "uppercase", color: T.muted }}>{estilo.saludo || "Hola"}{persona ? `, ${persona.split(/[\s—-]/)[0]}` : ""}</div>
        <div style={{ fontFamily: SERIF, fontSize: 29, fontWeight: 600, color: T.head, marginTop: 6, lineHeight: 1.12 }}>{estilo.nombre || empresa}</div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}>{estilo.subtitulo || "Pedidos de materiales · V+V Construcciones"}</div>
      </div>
      <div style={{ padding: "0 20px 110px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 22 }}>
          {[[mios.length, "Mis pedidos", T.head], [porAvisar, "Por avisar", porAvisar ? T.warn : T.head], [obrasSinPedir, "Obras sin pedir", obrasSinPedir ? T.warn : T.head]].map(([n, l, c]) => <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "13px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: c, lineHeight: 1 }}>{n}</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 6, fontWeight: 700, letterSpacing: ".04em" }}>{l}</div></div>)}
        </div>
        <div style={{ ...lblS, marginBottom: 10 }}>Qué querés pedir</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 24 }}>
          {TIPOS_PEDIDO.map(t => <button key={t.id} onClick={() => nuevo(t.id)} style={{ background: T.card, color: T.text, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 6px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center", boxShadow: T.shadow }}>
            <span style={{ width: 46, height: 46, borderRadius: "50%", background: T.bg, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 9px" }}><TipoIcon tipo={t.id} size={24} color={t.color} /></span>{t.label}</button>)}
        </div>
        {proximas.length > 0 && <div style={{ marginBottom: 24 }}>
          <div style={{ ...lblS, marginBottom: 10 }}>Próximas entregas</div>
          {proximas.map(p => <div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "11px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "center", minWidth: 44 }}><div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: BRASS, lineHeight: 1 }}>{String(p.fecha_necesita).slice(8, 10)}</div><div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, marginTop: 3 }}>{["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"][(+String(p.fecha_necesita).slice(5, 7) || 1) - 1]}</div></div>
            <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.head, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{obraNom(p.obra_id)}</div><div style={{ fontSize: 11.5, color: T.sub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemsTexto(p).join(", ")}</div></div>
          </div>)}
        </div>}
        {filasEstado.length > 0 && <div style={{ marginBottom: 24 }}>
          <div style={{ ...lblS, marginBottom: 10 }}>Estado por obra</div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "6px 8px" }}>
            {filasEstado.slice().sort((a, b) => (b.dm === null ? 9999 : b.dm) - (a.dm === null ? 9999 : a.dm)).map((f, i, arr) => (
              <div key={f.id} onClick={() => { setFObra(f.id); setVista("pedidos"); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 8px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: alertaDm(f.dm) ? T.warn : T.ok, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: alertaDm(f.dm) ? T.warn : T.sub, whiteSpace: "nowrap" }}>{txtDm(f.dm)}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: T.sub, background: T.bg, borderRadius: 20, padding: "2px 8px" }}>{f.total}</span>
                <button onClick={(e) => { e.stopPropagation(); setConfOcultar({ id: f.id, nombre: f.nombre }); }} aria-label={"Ocultar " + f.nombre} style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, width: 28, height: 28, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>))}
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 8, lineHeight: 1.45 }}>En ámbar, las obras que hace 7 días o más que no piden materiales. Tocá una para ver sus pedidos.</div>
        </div>}
        {listaTodos.length > 0 && <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}><div style={lblS}>Últimos pedidos</div><button onClick={() => setVista("pedidos")} style={{ background: "none", border: "none", color: BRASS, fontWeight: 700, fontSize: 11.5, cursor: "pointer", padding: 0 }}>Ver todos ›</button></div>
          {listaTodos.slice(0, 3).map(tarjetaPedido)}
        </div>}
        {listaTodos.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "24px 18px" }}>Todavía no hay pedidos. Elegí arriba qué querés pedir.</div>}
      </div>
    </div>}

    {vista !== "inicio" && <div>
      {encabezado(vista === "pedidos" ? "Pedidos" : vista === "recepcion" ? "Recepción de documentos" : "Definiciones")}
      <div style={{ padding: "0 20px 110px" }}>
        {vista === "recepcion" ? <RecepcionDocs obras={obras} empresa={empresa} docrecepcion={docrecepcion} persistDoc={persistDoc} /> : vista === "definiciones" ? <DefinicionesView obras={obras} empresa={empresa} definiciones={definiciones} persistDef={persistDef} /> : <>
          <div style={{ display: "flex", gap: 6, marginBottom: 9, flexWrap: "wrap" }}>
            <button onClick={() => setFTipo("")} style={{ background: fTipo === "" ? BRASS : T.card, color: fTipo === "" ? "#fff" : T.sub, border: `1px solid ${fTipo === "" ? BRASS : T.border}`, borderRadius: 20, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Todo</button>
            {TIPOS_PEDIDO.map(t => <button key={t.id} onClick={() => setFTipo(fTipo === t.id ? "" : t.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: fTipo === t.id ? t.color : T.card, color: fTipo === t.id ? "#fff" : T.sub, border: `1px solid ${fTipo === t.id ? t.color : T.border}`, borderRadius: 20, padding: "7px 13px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}><TipoIcon tipo={t.id} size={13} color={fTipo === t.id ? "#fff" : t.color} />{t.label}</button>)}
          </div>
          {obrasConPedidos.length > 1 && <select value={fObra} onChange={e => setFObra(e.target.value)} style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 12px", fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 14 }}>
            <option value="">Todas las obras</option>
            {obrasConPedidos.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>}
          <div style={{ fontSize: 10.5, fontWeight: 800, color: T.sub, margin: "0 0 12px" }}>{lista.length} pedido{lista.length !== 1 ? "s" : ""} · {grupos.length} obra{grupos.length !== 1 ? "s" : ""}</div>
          {listaTodos.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "40px 18px" }}>Todavía no hay pedidos. Tocá el botón + para cargar el primero.</div>}
          {listaTodos.length > 0 && lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "26px 18px" }}>Ningún pedido con esos filtros.<br /><button onClick={() => { setFObra(""); setFTipo(""); }} style={{ marginTop: 8, background: "none", border: "none", color: BRASS, fontWeight: 700, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>Ver todos</button></div>}
          {grupos.map(g => {
            const ult = g.pedidos.reduce((m, x) => Math.max(m, x.ts || 0), 0);
            const d = ult ? Math.floor((Date.now() - ult) / 86400000) : null;
            const ultMat = g.pedidos.filter(x => (x.tipo || "material") === "material").reduce((m, x) => Math.max(m, x.ts || 0), 0);
            const dm = ultMat ? Math.floor((Date.now() - ultMat) / 86400000) : null;
            const txt = (n) => n === 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
            const alerta = dm === null || dm >= 7;
            return (<div key={g.obra_id} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: T.head, flex: 1, minWidth: 0 }}>{g.nombre}</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: BRASS, borderRadius: 20, padding: "3px 10px" }}>{g.pedidos.length}</div>
                <button onClick={() => setConfOcultar({ id: g.obra_id, nombre: g.nombre })} style={{ background: "none", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Ocultar</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 11 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 9px" }}>Último pedido: {d === null ? "—" : txt(d)}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: alerta ? T.warn : T.ok, background: alerta ? T.warnBg : T.okBg, border: `1px solid ${alerta ? T.warnBd : T.okBd}`, borderRadius: 8, padding: "4px 9px" }}>Materiales: {dm === null ? "sin pedidos" : txt(dm)}</span>
              </div>
              {g.pedidos.map(tarjetaPedido)}
            </div>);
          })}
          <div style={{ marginTop: 6 }}>
            <button onClick={() => setDiagOpen(v => !v)} style={{ background: "none", border: "none", color: T.muted, fontSize: 10.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>{diagOpen ? "Ocultar diagnóstico" : "Ver diagnóstico (ids crudos)"}</button>
            {diagOpen && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 11, marginTop: 8, fontSize: 10.5, fontFamily: "monospace" }}>
              <div style={{ fontWeight: 800, marginBottom: 4, color: T.head }}>OBRAS ({(obras || []).length}):</div>
              {(obras || []).map(o => <div key={o.id} style={{ marginBottom: 2, color: T.text }}>{o.nombre} → <span style={{ color: T.sub }}>{o.id}</span></div>)}
              <div style={{ fontWeight: 800, margin: "10px 0 4px", color: T.head }}>PEDIDOS DE MATERIAL ({(matpedidos || []).length}):</div>
              {(matpedidos || []).map(p => {
                const obraMatch = (obras || []).find(o => o.id === p.obra_id);
                if (obraMatch) return <div key={p.id} style={{ marginBottom: 2, color: T.text }}>{obraMatch.nombre} → obra_id: <span style={{ color: T.sub }}>{p.obra_id}</span></div>;
                return <div key={p.id} style={{ marginBottom: 8, padding: "6px 0", borderTop: `1px dashed ${T.border}` }}>
                  <div style={{ color: T.danger, marginBottom: 2 }}>⚠ SIN OBRA (huérfano) → obra_id: {p.obra_id || "(vacío)"} — {p.fecha || ""}</div>
                  <div style={{ color: T.sub, marginBottom: 4 }}>Pidió: {(p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).filter(Boolean).join(", ") || "(sin items)"}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(obras || []).map(o => <button key={o.id} onClick={async () => {
                      const nuevos = (matpedidos || []).map(x => x.id === p.id ? { ...x, obra_id: o.id, upd: Date.now() } : x);
                      setMatpedidos(nuevos);
                      lastWrite.current = Date.now();
                      try { localStorage.setItem("vv_matpedidos", JSON.stringify(nuevos)); } catch { }
                      await storage.set("vv_matpedidos", JSON.stringify(nuevos)).catch(() => { });
                      alert(`Reasignado a ${o.nombre}.`);
                    }} style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text, borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>→ {o.nombre}</button>)}
                  </div>
                </div>;
              })}
            </div>}
          </div>
        </>}
      </div>
    </div>}

    {vista === "pedidos" && <button onClick={() => setNuevoOpen(true)} aria-label="Nuevo pedido" style={{ position: "fixed", right: "max(18px, calc(50% - 292px))", bottom: "calc(88px + env(safe-area-inset-bottom))", width: 56, height: 56, borderRadius: "50%", background: BRASS, color: "#fff", border: "none", fontSize: 30, lineHeight: 1, cursor: "pointer", boxShadow: "0 8px 22px rgba(0,0,0,.4)", zIndex: 60 }}>＋</button>}

    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 80, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", width: "100%", maxWidth: 620, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)" }}>
        {tabs.map(([k, l, ic]) => { const act = vista === k; return (<button key={k} onClick={() => setVista(k)} style={{ flex: 1, background: "none", border: "none", borderTop: `2px solid ${act ? BRASS : "transparent"}`, marginTop: -1, padding: "9px 2px 7px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: act ? BRASS : T.sub }}>
          <Ico n={ic} s={20} c={act ? BRASS : T.sub} st={act ? 1.9 : 1.6} /><span style={{ fontSize: 10, fontWeight: act ? 800 : 600 }}>{l}</span></button>); })}
      </div>
    </nav>

    {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "18px 18px 0 0", padding: "16px 20px calc(22px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 620 }}>
        <div style={{ width: 40, height: 4, background: T.border, borderRadius: 4, margin: "0 auto 14px" }} />
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: T.head }}>{empresa}</div>
        <div style={{ fontSize: 12, color: T.sub, margin: "2px 0 14px" }}>{persona || "Contratista"}</div>
        {[["↻", "Actualizar y traer lo último", () => { try { if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))); } catch (e) { } location.replace(location.pathname + "?sync=" + Date.now()); }], ["▤", "Mostrar u ocultar obras", () => { setMenuOpen(false); setObrasOpen(true); }], ["✦", "Personalizar estilo", () => { setMenuOpen(false); setEstiloOpen(true); }], ["⇄", "Cambiar de empresa", () => { setMenuOpen(false); setTmpEmpresa(empresa); setEditEmpresa(true); }]].map(([ic, l, fn]) => <button key={l} onClick={fn} style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, background: T.bg, border: `1px solid ${T.border}`, color: T.text, borderRadius: 12, padding: "14px", marginBottom: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "left" }}><span style={{ width: 30, textAlign: "center", color: BRASS, fontSize: 17 }}>{ic}</span>{l}</button>)}
      </div>
    </div>}

    {nuevoOpen && <div onClick={() => setNuevoOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "18px 18px 0 0", padding: "16px 20px calc(22px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 620 }}>
        <div style={{ width: 40, height: 4, background: T.border, borderRadius: 4, margin: "0 auto 14px" }} />
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: T.head, marginBottom: 12 }}>Qué querés pedir</div>
        {TIPOS_PEDIDO.map(t => <button key={t.id} onClick={() => { setNuevoOpen(false); nuevo(t.id); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, background: T.bg, border: `1px solid ${T.border}`, color: T.text, borderRadius: 12, padding: "13px 14px", marginBottom: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "left" }}><TipoIcon tipo={t.id} size={24} color={t.color} />{t.label}</button>)}
      </div>
    </div>}

    {obrasOpen && <div onClick={() => setObrasOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 450, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "18px 18px 0 0", padding: "16px 20px calc(22px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 620, maxHeight: "78vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, background: T.border, borderRadius: 4, margin: "0 auto 14px" }} />
        <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: T.head }}>Obras que se muestran</div>
        <div style={{ fontSize: 12, color: T.sub, margin: "4px 0 14px", lineHeight: 1.45 }}>Apagá las que no tienen que aparecer. Dejan de verse en toda la app, con sus pedidos. No se borra nada de V+V ni de Belfast, y las podés volver a prender cuando quieras.</div>
        {obrasTodas.length === 0 && <div style={{ fontSize: 13, color: T.muted, padding: "10px 0" }}>Todavía no se cargaron obras.</div>}
        {obrasTodas.map(o => { const oculta = (estilo.ocultas || []).includes(o.id); return <button key={o.id} onClick={() => aplicarYGuardar({ ...estilo, ocultas: oculta ? (estilo.ocultas || []).filter(x => x !== o.id) : [...(estilo.ocultas || []), o.id] })} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: T.bg, border: `1px solid ${T.border}`, color: oculta ? T.muted : T.text, borderRadius: 12, padding: "13px 14px", marginBottom: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: oculta ? "line-through" : "none" }}>{o.nombre}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}><span style={{ fontSize: 10.5, color: oculta ? T.danger : T.ok, fontWeight: 800 }}>{oculta ? "OCULTA" : "VISIBLE"}</span><span style={{ width: 38, height: 22, borderRadius: 20, background: oculta ? T.border : BRASS, position: "relative" }}><span style={{ position: "absolute", top: 2, left: oculta ? 2 : 18, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} /></span></span>
        </button>; })}
        <button onClick={() => setObrasOpen(false)} style={{ width: "100%", background: BRASS, color: "#fff", border: "none", borderRadius: 12, padding: 14, fontSize: 14.5, fontWeight: 800, cursor: "pointer", marginTop: 10 }}>Listo</button>
      </div>
    </div>}

    {confOcultar && <div onClick={() => setConfOcultar(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 470, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 22, width: "100%", maxWidth: 380 }}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: T.head, marginBottom: 8 }}>¿Ocultar esta obra?</div>
        <div style={{ fontSize: 13.5, color: T.text, fontWeight: 700, marginBottom: 6 }}>{confOcultar.nombre}</div>
        <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5, marginBottom: 18 }}>Deja de aparecer en esta app, con sus pedidos. No se borra nada. La podés volver a mostrar desde el menú ••• → Mostrar u ocultar obras.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setConfOcultar(null)} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => ocultarObra(confOcultar.id)} style={{ flex: 1.4, background: T.danger, border: "none", color: "#fff", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Ocultar</button>
        </div>
      </div>
    </div>}

    {estiloOpen && <div onClick={() => setEstiloOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 450, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "18px 18px 0 0", padding: "16px 20px calc(22px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 620, maxHeight: "72vh", overflowY: "auto", boxShadow: "0 -10px 40px rgba(0,0,0,.4)" }}>
        <div style={{ width: 40, height: 4, background: T.border, borderRadius: 4, margin: "0 auto 14px" }} />
        <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: T.head }}>Personalizar app</div>
        <div style={{ fontSize: 12, color: T.sub, margin: "3px 0 4px" }}>Los cambios se ven al instante y quedan guardados en este dispositivo.</div>
        <div style={{ ...lblS, margin: "16px 0 8px" }}>Logo</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", border: `2px solid ${BRASS}`, overflow: "hidden", background: estilo.logo ? "#fff" : T.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{estilo.logo ? <img src={estilo.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={28} c={BRASS} />}</div>
          <label style={{ flex: 1, textAlign: "center", background: BRASS, color: "#fff", borderRadius: 12, padding: "12px 10px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{estilo.logo ? "Cambiar logo" : "Subir logo"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => { const f = e.target.files && e.target.files[0]; if (!f) return; const d = await achicarLogo(f); if (d) aplicarYGuardar({ ...estilo, logo: d }); else setAviso("No se pudo leer esa imagen. Probá con otra."); e.target.value = ""; }} /></label>
          {estilo.logo && <button onClick={() => aplicarYGuardar({ ...estilo, logo: "" })} style={{ background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 12, padding: "12px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Quitar</button>}
        </div>
        <div style={{ ...lblS, margin: "16px 0 8px" }}>Textos</div>
        {[["saludo", "Saludo", "Hola"], ["nombre", "Nombre que se muestra", empresa], ["subtitulo", "Subtítulo", "Pedidos de materiales · V+V Construcciones"]].map(([k, l, ph]) => <div key={k} style={{ marginBottom: 9 }}>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 700 }}>{l}</div>
          <input id={"estilo-" + k} value={estilo[k] || ""} onChange={e => aplicarYGuardar({ ...estilo, [k]: e.target.value })} placeholder={ph} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, color: T.text, boxSizing: "border-box" }} />
        </div>)}
        <div style={{ ...lblS, margin: "16px 0 8px" }}>Tema</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
          {Object.entries(PALETAS).map(([id, p]) => <button key={id} onClick={() => aplicarYGuardar({ ...estilo, tema: id, acento: "" })} style={{ ...selBtn((estilo.tema || "bronce") === id), padding: "8px 2px" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", margin: "0 auto 5px", background: p.bg, border: `3px solid ${p.brass}`, boxShadow: "0 0 0 1px rgba(128,128,128,.4)" }} /><div style={{ fontSize: 10.5, fontWeight: 700 }}>{p.nombre}</div></button>)}
        </div>
        <div style={{ ...lblS, margin: "16px 0 8px" }}>Color de acento</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <button onClick={() => aplicarYGuardar({ ...estilo, acento: "" })} style={{ ...selBtn(!estilo.acento), padding: "7px 11px", fontSize: 11.5, fontWeight: 700 }}>Del tema</button>
          {ACENTOS.map(c => <button key={c} onClick={() => aplicarYGuardar({ ...estilo, acento: c })} aria-label={c} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: `3px solid ${estilo.acento === c ? T.text : "transparent"}`, cursor: "pointer", padding: 0 }} />)}
          <input type="color" value={estilo.acento || BRASS} onChange={e => aplicarYGuardar({ ...estilo, acento: e.target.value })} style={{ width: 36, height: 36, border: "none", background: "none", padding: 0, cursor: "pointer" }} />
        </div>
        <div style={{ ...lblS, margin: "16px 0 8px" }}>Tipografía de títulos</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[["elegante", "Elegante"], ["moderna", "Moderna"], ["clasica", "Clásica"]].map(([k, n]) => <button key={k} onClick={() => aplicarYGuardar({ ...estilo, fuente: k })} style={{ ...selBtn((estilo.fuente || "elegante") === k), padding: "10px 4px", fontFamily: FONTS[k], fontSize: 15, fontWeight: 600 }}>{n}</button>)}
        </div>
        <button onClick={() => setEstiloOpen(false)} style={{ width: "100%", background: BRASS, color: "#fff", border: "none", borderRadius: 12, padding: 14, fontSize: 14.5, fontWeight: 800, cursor: "pointer", marginTop: 20 }}>Listo</button>
      </div>
    </div>}

    {form && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 460, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setForm(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 620, padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: T.head, marginBottom: 14 }}>{form.id ? `Editar pedido de ${tipoDe(form.tipo).label.toLowerCase()}` : `Nuevo pedido de ${tipoDe(form.tipo).label.toLowerCase()}`}</div>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
        <select value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", fontSize: 14, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }}>
          {obras.length === 0 && <option value="">(sin obras cargadas)</option>}
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>{tipoDe(form.tipo).label}</div>
        {form.items.map((it, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <input value={it.nombre} onChange={e => setItem(i, "nombre", e.target.value)} placeholder={form.tipo === "material" ? "Material" : form.tipo === "plano" ? "Plano (ej: Estructura losa)" : "Definición (ej: Tipo de piso)"} style={{ flex: 2, minWidth: 0, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text }} />
          {(form.tipo || "material") === "material" ? <>
            <input value={it.cantidad} onChange={e => setItem(i, "cantidad", e.target.value)} placeholder="Cant." type="number" style={{ width: 60, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />
            <input value={it.unidad} onChange={e => setItem(i, "unidad", e.target.value)} placeholder="u" style={{ width: 50, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />
          </> : <input value={it.detalle || ""} onChange={e => setItem(i, "detalle", e.target.value)} placeholder="Detalle (opcional)" style={{ flex: 1.2, minWidth: 0, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />}
          {form.items.length > 1 && <button onClick={() => delItem(i)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer" }}>✕</button>}
        </div>))}
        <button onClick={addItem} style={{ background: T.al, color: T.accent, border: "none", borderRadius: T.rsm, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>＋ Agregar {tipoDe(form.tipo).sing}</button>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Fecha del pedido</label>
            <input type="date" value={form.fecha_pedido || ""} onChange={e => setForm({ ...form, fecha_pedido: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 15, color: T.text, margin: "6px 0 0", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase" }}>Necesito en obra</label>
            <input type="date" value={form.fecha_necesita || ""} onChange={e => setForm({ ...form, fecha_necesita: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.accent}`, borderRadius: T.rsm, padding: "11px", fontSize: 15, color: T.text, margin: "6px 0 0", boxSizing: "border-box" }} />
          </div>
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Quién lo pide</label>
        <input value={form.solicitante || ""} onChange={e => { setForm({ ...form, solicitante: e.target.value }); setPersonaP(e.target.value); }} placeholder="Nombre y rol (ej: Marcos Giménez — capataz)" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Nota (opcional)</label>
        <textarea value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} rows={2} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text, margin: "6px 0 14px", boxSizing: "border-box", resize: "vertical" }} />
        <button onClick={guardar} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{form.id ? "Guardar cambios" : "Enviar pedido"}</button>
      </div>
    </div>}
  </div>);
}
