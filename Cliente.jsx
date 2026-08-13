import React, { useState, useEffect, useRef, useCallback } from "react";

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

// Etapas de obra (para saber en qué momento está cada hecho de la bitácora)
const ETAPAS_OBRA = ["Trabajos preliminares", "Replanteo y movimiento de suelos", "Fundaciones", "Estructura", "Mampostería", "Techos y cubiertas", "Instalación sanitaria", "Instalación eléctrica", "Instalación de gas", "Contrapisos y carpetas", "Revoques", "Aberturas", "Revestimientos y solados", "Pintura", "Terminaciones", "Limpieza de obra y entrega"];

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

// Margen superior seguro: en modo app instalada (pantalla de inicio) iOS puede no
// informar env(safe-area-inset-top); garantizamos un mínimo para no quedar bajo el notch.
const SAFE_TOP_PX = (() => { try { return (window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches) ? 50 : 0; } catch (e) { return 0; } })();
// VERSION: v15 (FIX: pedidos creados a la vez ya no se pisan - fusion por pedido + tumbas)
// ════════════════════════════════════════════════════════════════════
// PANEL DE CLIENTE — App independiente y descargable
// Mismo backend Supabase que la app de V+V → los datos se comparten.
// El cliente: ve el estado de obra · sube/descarga archivos · mensajea
// con avisos en pantalla cuando llega un mensaje nuevo.
// El nombre/identidad del cliente es configurable (Ajustes).
// ════════════════════════════════════════════════════════════════════

// ── BACKEND COMPARTIDO (idéntico a la app de V+V) ───────────────────
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

// Aviso simple, no intrusivo, de que un guardado en la nube falló: guarda la clave y
// dispara un evento que un pequeño cartel (montado una sola vez en la raíz) escucha.
let ultimoAviso = 0;
function avisarErrorSync(key) {
  const ahora = Date.now();
  if (ahora - ultimoAviso < 8000) return;
  ultimoAviso = ahora;
  try { window.dispatchEvent(new CustomEvent("vv-sync-error", { detail: { key } })); } catch { }
}

// Registra que la app se abrió — usado por NEXO Control para saber
// cuántas personas usan cada vista. No interfiere con nada existente.
function registrarApertura(appTag) {
  // Va a una tabla liviana propia (no a bco_storage) para no sobrecargar
  // esa tabla, que ya tiene todo el resto del sistema.
  try {
    fetch(SUPA_URL + "/rest/v1/aperturas", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify({ app: appTag }),
    }).catch(() => {});
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
        app: "cliente",
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

function SyncBanner() {
  useEffect(() => { registrarApertura("cliente"); }, []);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const onErr = () => {
      setMsg("No se pudo guardar en la nube. Se guardó en este aparato — revisá la conexión y volvé a intentar.");
      setTimeout(() => setMsg(""), 7000);
    };
    window.addEventListener("vv-sync-error", onErr);
    return () => window.removeEventListener("vv-sync-error", onErr);
  }, []);
  if (!msg) return null;
  return (<div style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9999, background: "#DC2626", color: "#fff", borderRadius: 10, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, boxShadow: "0 6px 20px rgba(0,0,0,.25)", display: "flex", alignItems: "center", gap: 8 }}>
    <span>⚠</span><span style={{ flex: 1 }}>{msg}</span>
    <button onClick={() => setMsg("")} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>OK</button>
  </div>);
}

const storage = {
  set: async (key, value) => {
    // ANTES no revisaba si el servidor aceptó el guardado (solo atrapaba fallas de RED,
    // no un error HTTP como 403/413/500). Eso podía fallar en silencio: quedaba guardado
    // acá, pero nunca llegaba a la nube. Ahora revisa la respuesta y reintenta una vez.
    try { localStorage.setItem(key, value); } catch { }
    const intentar = () => fetch(SUPA_URL + "/rest/v1/bco_storage", { method: "POST", headers: { ...SH(), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ key, value }) });
    try {
      let r = await intentar();
      if (!r.ok) r = await intentar();
      if (!r.ok) { avisarErrorSync(key); return { value, ok: false }; }
    } catch { avisarErrorSync(key); return { value, ok: false }; }
    return { value, ok: true };
  },
  get: async (key) => {
    try {
      const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { method: "GET", headers: SH(), mode: "cors" });
      if (r.ok) { const d = await r.json(); if (d && d.length > 0) return { value: d[0].value }; }
    } catch { }
    try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; }
  },
};
const SUPA_BUCKET = "bco-media";
const SUPA_STORAGE_URL = SUPA_URL + "/storage/v1";
const mediaStorage = {
  upload: async (path, dataUrl, forceType) => {
    try {
      const res = await fetch(dataUrl); const blob = await res.blob();
      const tipo = forceType || blob.type || "application/octet-stream";
      const ext = (tipo.split('/')[1] || 'bin');
      const filePath = `${path}.${ext}`;
      const r = await fetch(`${SUPA_STORAGE_URL}/object/${SUPA_BUCKET}/${filePath}`, { method: "POST", headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY, "Content-Type": tipo, "x-upsert": "true" }, body: blob });
      if (!r.ok) return null;
      return `${SUPA_STORAGE_URL}/object/public/${SUPA_BUCKET}/${filePath}`;
    } catch { return null; }
  },
};
async function uploadArchivo(dataUrl, carpeta, nombre, forceType) {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('http')) return dataUrl;
  const url = await mediaStorage.upload(`${carpeta}/${nombre || uid()}`, dataUrl, forceType);
  return url || dataUrl;
}

// ── HELPERS ──────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const hoyStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`; };
const money = (n) => (Number(n) || 0).toLocaleString("es-AR") + " $";
const parseMontoNum = (m) => {
  // En Argentina el punto es separador de MILES y la coma es el decimal.
  // Antes: parseFloat("120.000.000") -> 120. Un presupuesto de 120 millones se leía como 120 pesos.
  if (m == null || m === "") return 0;
  if (typeof m === "number") return isFinite(m) ? m : 0;
  let s = String(m).replace(/[^0-9.,-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
};
function fileToDataUrl(f, maxW = 1400) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      if (!f.type.startsWith('image/')) { res(e.target.result); return; }
      const img = new Image();
      img.onload = () => {
        if (img.width <= maxW) { res(e.target.result); return; }
        const c = document.createElement('canvas'); const ratio = maxW / img.width;
        c.width = maxW; c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => res(e.target.result); img.src = e.target.result;
    };
    reader.onerror = rej; reader.readAsDataURL(f);
  });
}

// ── CACHÉ LOCAL DE ARCHIVOS (IndexedDB) ─────────────────────────────
// La primera vez que se abre un archivo en ESTE dispositivo hace falta conexión
// para traerlo. Pero a partir de ahí queda GUARDADO ACÁ (en este teléfono/iPad,
// no en la nube), y las próximas veces se abre directo desde esa copia local,
// sin volver a pedirle nada a Supabase. Por eso antes "quedaba pensando" sin
// conexión: siempre iba a buscarlo al servidor, nunca se quedaba con una copia.
const CACHE_DB = "vv_archivos_cache", CACHE_STORE = "files";
function abrirCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(CACHE_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function cacheGet(url) {
  try {
    const db = await abrirCacheDB();
    return await new Promise((res, rej) => {
      const r = db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(url);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch { return null; }
}
async function cachePut(url, blob) {
  try {
    const db = await abrirCacheDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).put(blob, url);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch { }
}
// Abre un archivo usando la copia local si ya está en este dispositivo (funciona
// SIN conexión). Si todavía no está, la trae una vez (necesita conexión esa
// primera vez) y la guarda para que la próxima sea instantánea y offline.
async function abrirArchivo(url, nombre) {
  if (!url) return { ok: false, motivo: "sin-url" };
  if (url.startsWith("data:")) { window.open(url, "_blank"); return { ok: true }; }
  let blob = await cacheGet(url);
  let nuevo = false;
  if (!blob) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, motivo: "sin-conexion" };
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("no se pudo traer");
      blob = await r.blob();
      nuevo = true;
    } catch { return { ok: false, motivo: "sin-conexion" }; }
  }
  const objUrl = URL.createObjectURL(blob);
  window.open(objUrl, "_blank");
  if (nuevo) cachePut(url, blob);
  return { ok: true, nuevo };
}
async function descargarArchivo(url, nombre) {
  const r = await abrirArchivo(url, nombre);
  if (!r.ok) alert("Este archivo todavía no está guardado en este dispositivo.\n\nAbrilo una vez con conexión y, de ahí en adelante, se va a poder ver sin internet.");
  return r.ok;
}

const FORCE_CLOUD = (() => { try { return new URLSearchParams(window.location.search).has("sync"); } catch { return false; } })();
const lastWrite = {};
function useStored(key, def) {
  const [v, setV] = useState(() => { try { const l = localStorage.getItem(key); return l ? JSON.parse(l) : def; } catch { return def; } });
  // Gana el MÁS RECIENTE (por sello de fecha), no el más grande: si no, un borrado
  // hecho en V+V (que achica la lista) se descarta acá y la obra borrada vuelve.
  useEffect(() => {
    (async () => {
      const r = await storage.get(key);
      if (!r?.value) return;
      try {
        const d = JSON.parse(r.value);
        if (Date.now() - (lastWrite[key] || 0) < 8000) return;
        if (FORCE_CLOUD) { setV(d); try { localStorage.setItem(key, r.value); } catch { } return; }
        const rTs = await storage.get(key + "__ts");
        const cloudTs = Number(rTs?.value || 0);
        let localTs = 0;
        try { localTs = Number(localStorage.getItem(key + "__ts") || 0); } catch { }
        if (cloudTs >= localTs) {
          setV(cur => JSON.stringify(d) !== JSON.stringify(cur) ? d : cur);
          try { localStorage.setItem(key, r.value); localStorage.setItem(key + "__ts", String(cloudTs)); } catch { }
        }
      } catch { }
    })();
  }, [key]);
  const set = useCallback(u => {
    setV(prev => {
      const n = typeof u === 'function' ? u(prev) : u;
      const j = JSON.stringify(n);
      const ts = Date.now();
      lastWrite[key] = ts;
      try { localStorage.setItem(key, j); localStorage.setItem(key + "__ts", String(ts)); } catch { }
      storage.set(key, j);
      storage.set(key + "__ts", String(ts));
      return n;
    });
  }, [key]);
  return [v, set];
}

// Llamada al modelo (usa la API Key cargada en la app de V+V, leída del backend compartido)
async function callAI(msgs, sys, apiKey, useSearch = false) {
  msgs = (msgs || []).map(m => ({ role: m.role, content: m.content }));
  const body = { model: "claude-sonnet-5", max_tokens: 4096, thinking: { type: "disabled" }, messages: msgs };
  if (sys) body.system = sys;
  if (useSearch) body.tools = [
    { type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", city: "Buenos Aires", region: "Buenos Aires", country: "AR", timezone: "America/Argentina/Buenos_Aires" } },
    { type: "web_fetch_20250910", name: "web_fetch", max_uses: 5 },
  ];
  async function doFetch(b) {
    try {
      const rp = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      if (rp.ok) return { ok: true, data: await rp.json() };
      if (rp.status !== 404) { try { const e = await rp.json(); return { ok: false, err: e.error?.message || `Error ${rp.status}` }; } catch { return { ok: false, err: `Error ${rp.status}` }; } }
    } catch { /* sin proxy: modo directo */ }
    if (!apiKey) return { ok: false, err: "⚠ El asistente todavía no está disponible. Configurá la IA (API Key en la app de V+V, o el proxy en Vercel)." };
    const headers = { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true", "anthropic-version": "2023-06-01", "x-api-key": apiKey };
    if (useSearch) headers["anthropic-beta"] = "web-fetch-2025-09-10";
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(b) });
    if (!r.ok) { let m = "Error de conexión."; try { const d = await r.json(); m = d.error?.message || `Error ${r.status}`; } catch { } return { ok: false, err: m }; }
    return { ok: true, data: await r.json() };
  }
  try {
    const res = await doFetch(body);
    if (!res.ok) return res.err;
    let d = res.data;
    if (d.error) return `Error: ${d.error.message || "Sin respuesta."}`;
    let guard = 0;
    while (d.stop_reason === "pause_turn" && guard < 4) {
      guard++;
      const cont = await doFetch({ ...body, messages: [...msgs, { role: "assistant", content: d.content }] });
      if (!cont.ok || cont.data?.error) break;
      d = cont.data;
    }
    return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim() || "Sin respuesta.";
  } catch (e) { return `Error de conexión: ${e.message || ""}`; }
}

// ── PEDIDOS (agente entre empresas) — compartido con la app de V+V ────
const PEDIDO_ESTADOS = { abierto: { l: "Abierto", c: "#F59E0B", b: "rgba(180,83,9,.14)" }, en_proceso: { l: "En proceso", c: "#3B82F6", b: "rgba(37,99,235,.14)" }, respondido: { l: "Respondido", c: "#8B5CF6", b: "rgba(139,92,246,.14)" }, resuelto: { l: "Resuelto", c: "#16A34A", b: "rgba(22,163,74,.14)" } };
const PEDIDO_MAX_IA = 4;
function parseAccion(texto) { const m = (texto || "").match(/```accion\s*([\s\S]*?)```/i); if (!m) return { limpio: texto, accion: null }; let a = null; try { a = JSON.parse(m[1].trim()); } catch { } return { limpio: (texto.replace(m[0], "").trim() || "Listo."), accion: a }; }
function nuevoPedido({ de, para, asunto, detalle, prioridad, obra_id }) { const f = hoyStr(), ts = Date.now(); return { id: uid() + ts, de, para, asunto: asunto || "(sin asunto)", estado: "abierto", prioridad: prioridad || "media", obra_id: obra_id || "", fecha: f, ts, iaTurns: 0, hilo: [{ de, texto: detalle || asunto || "", fecha: f, ts, porIA: false }] }; }
// Antes: iba a buscar la lista ENTERA a la nube antes de aplicar cualquier cambio (incluso
// tocar un simple botón de estado). Eso hacía que cada toque dependiera de la red y tardara;
// y si dos cambios se cruzaban (dos toques seguidos, o un toque justo cuando el sondeo
// periódico corría), el que terminaba de bajar de la nube DESPUÉS pisaba al otro — por eso
// a veces "no dejaba seleccionar" el estado: el toque se aplicaba y al ratito quedaba pisado
// por una lectura vieja. Ahora aplica el cambio directo sobre el estado que React YA tiene
// actualizado (mantenido al día por el sondeo) — instantáneo, sin depender de la red, y sin
// la carrera entre dos escrituras que se cruzan.
// ── GUARDADO DE PEDIDOS SIN PISAR LO DEL OTRO ──────────────────────────
// PROBLEMA que esto resuelve: antes cada app escribía la LISTA ENTERA en la nube.
// Si V+V creaba un pedido y el Cliente creaba otro antes de sondear (el sondeo tarda
// 4s), el Cliente escribía su lista —que todavía no tenía el pedido de V+V— y lo
// borraba para todos. Con 6 personas usando la app a la vez, esto pasa seguido.
//
// SOLUCIÓN: antes de guardar, traigo lo último de la nube y FUSIONO pedido por pedido.
// Gana la versión más nueva de cada uno (campo "upd"). Los borrados quedan anotados
// como "tumbas" para que la fusión no los resucite.
const TUMBAS_PED = "vv_pedidos_del";
function leerTumbas() { try { return JSON.parse(localStorage.getItem(TUMBAS_PED) || "{}"); } catch { return {}; } }

async function persistirPedidos(lista, tumbasNuevas) {
  let enNube = [], tumbasNube = {};
  try { const r = await storage.get("vv_pedidos"); if (r?.value) enNube = JSON.parse(r.value); } catch { }
  try { const r = await storage.get(TUMBAS_PED); if (r?.value) tumbasNube = JSON.parse(r.value); } catch { }
  if (!Array.isArray(enNube)) enNube = [];

  // uno todas las tumbas conocidas (nube + este aparato + las que acabo de hacer)
  const tumbas = { ...tumbasNube, ...leerTumbas(), ...(tumbasNuevas || {}) };

  // fusiono por id: de cada pedido me quedo con la versión más nueva
  const porId = {};
  for (const p of enNube) if (p && p.id) porId[p.id] = p;
  for (const p of (lista || [])) {
    if (!p || !p.id) continue;
    const otro = porId[p.id];
    if (!otro || (p.upd || 0) >= (otro.upd || 0)) porId[p.id] = p;
  }

  // saco los borrados (solo si la tumba es más nueva que el pedido)
  const fusionada = Object.values(porId).filter(p => !(tumbas[p.id] && tumbas[p.id] >= (p.upd || 0)));

  // limpio tumbas viejas para que no crezcan sin fin (30 días)
  const corte = Date.now() - 30 * 24 * 3600 * 1000;
  for (const k of Object.keys(tumbas)) if (tumbas[k] < corte) delete tumbas[k];

  const ts = Date.now();
  lastWrite["vv_pedidos"] = ts;
  try {
    localStorage.setItem(TUMBAS_PED, JSON.stringify(tumbas));
    localStorage.setItem("vv_pedidos", JSON.stringify(fusionada));
    localStorage.setItem("vv_pedidos__ts", String(ts));
  } catch { }
  await storage.set("vv_pedidos", JSON.stringify(fusionada));
  await storage.set("vv_pedidos__ts", String(ts));
  await storage.set(TUMBAS_PED, JSON.stringify(tumbas));
  return fusionada;
}

/* ═══ MATERIALES: la misma fusión que los pedidos ═══
   Antes las dos apps escribían la lista ENTERA y sin sello de fecha. Resultado:
   marcabas "Levantar" acá, V+V reescribía la lista vieja, y como el sello no cambiaba,
   al recargar volvías a adoptar los datos viejos. El "Levantado" se perdía.
   Ahora se fusiona por id (gana la versión más nueva de cada pedido) y siempre se
   escribe el sello. Los borrados quedan en tumbas para que no resuciten.          */
const TUMBAS_MAT = "vv_matpedidos_del";
function leerTumbasMat() { try { return JSON.parse(localStorage.getItem(TUMBAS_MAT) || "{}"); } catch { return {}; } }

async function persistirMats(lista, tumbasNuevas) {
  let enNube = [], tumbasNube = {};
  try { const r = await storage.get("vv_matpedidos"); if (r?.value) enNube = JSON.parse(r.value); } catch { }
  try { const r = await storage.get(TUMBAS_MAT); if (r?.value) tumbasNube = JSON.parse(r.value); } catch { }
  if (!Array.isArray(enNube)) enNube = [];

  const tumbas = { ...tumbasNube, ...leerTumbasMat(), ...(tumbasNuevas || {}) };

  const porId = {};
  for (const p of enNube) if (p && p.id) porId[p.id] = p;
  for (const p of (lista || [])) {
    if (!p || !p.id) continue;
    const otro = porId[p.id];
    if (!otro || (p.upd || 0) >= (otro.upd || 0)) porId[p.id] = p;
  }

  const fusionada = Object.values(porId).filter(p => !(tumbas[p.id] && tumbas[p.id] >= (p.upd || 0)));

  const corte = Date.now() - 30 * 24 * 3600 * 1000;
  for (const k of Object.keys(tumbas)) if (tumbas[k] < corte) delete tumbas[k];

  let salida = fusionada;
  const escribir = async (lista) => {
    const ts = Date.now();
    lastWrite["vv_matpedidos"] = ts;
    try {
      localStorage.setItem(TUMBAS_MAT, JSON.stringify(tumbas));
      localStorage.setItem("vv_matpedidos", JSON.stringify(lista));
      localStorage.setItem("vv_matpedidos__ts", String(ts));
    } catch { }
    await storage.set("vv_matpedidos", JSON.stringify(lista));
    await storage.set("vv_matpedidos__ts", String(ts));
    await storage.set(TUMBAS_MAT, JSON.stringify(tumbas));
  };
  await escribir(salida);

  // SEGUNDA PASADA. Si la otra app escribió en el mismo instante, leyó la nube ANTES
  // que yo escribiera y me pisó. Vuelvo a leer y fusiono otra vez: como gana el 'upd'
  // más nuevo de cada pedido, esta pasada recupera lo mío sin borrar lo de ella.
  for (let intento = 0; intento < 2; intento++) {
    let ahoraNube = [];
    try { const r = await storage.get("vv_matpedidos"); if (r?.value) ahoraNube = JSON.parse(r.value); } catch { }
    if (!Array.isArray(ahoraNube)) ahoraNube = [];

    const m = {};
    for (const p of ahoraNube) if (p && p.id) m[p.id] = p;
    for (const p of salida) {
      if (!p || !p.id) continue;
      const otro = m[p.id];
      if (!otro || (p.upd || 0) >= (otro.upd || 0)) m[p.id] = p;
    }
    const rehecha = Object.values(m).filter(p => !(tumbas[p.id] && tumbas[p.id] >= (p.upd || 0)));

    if (JSON.stringify(rehecha) === JSON.stringify(ahoraNube)) { salida = rehecha; break; }
    salida = rehecha;
    await escribir(salida);
  }
  return salida;
}

/* Aplica un cambio local y lo persiste fusionando. Solo los que cambiaron reciben
   sello nuevo; así no piso versiones más nuevas de los que no toqué. */
function aplicarMats(setMats, fn) {
  setMats(prev => {
    const antes = prev || [];
    const mapaAntes = {};
    for (const p of antes) if (p && p.id) mapaAntes[p.id] = p;

    const crudo = typeof fn === "function" ? fn(antes) : fn;
    const lista = Array.isArray(crudo) ? crudo : [];
    const ahora = Date.now();

    // sello nuevo solo a los que cambiaron
    const conSello = lista.map(p => {
      if (!p || !p.id) return p;
      const viejo = mapaAntes[p.id];
      const cambio = !viejo || JSON.stringify(viejo) !== JSON.stringify(p);
      return cambio ? { ...p, upd: ahora } : p;
    });

    // los que desaparecieron: a la tumba
    const idsAhora = new Set(conSello.map(p => p && p.id).filter(Boolean));
    const tumbasNuevas = {};
    for (const p of antes) if (p && p.id && !idsAhora.has(p.id)) tumbasNuevas[p.id] = ahora;

    persistirMats(conSello, tumbasNuevas);
    return conSello;
  });
}

function aplicarPedidos(setPedidos, fn) {
  let next;
  setPedidos(prev => {
    const antes = prev || [];
    const mapaAntes = {};
    for (const p of antes) if (p && p.id) mapaAntes[p.id] = p;

    const bruto = fn(antes.slice());
    const ahora = Date.now();

    // marco con la hora SOLO los pedidos que realmente cambiaron: si marcara todos,
    // pisaría los cambios que el otro hizo en pedidos que yo no toqué.
    next = (bruto || []).map(p => {
      if (!p || !p.id) return p;
      const a = mapaAntes[p.id];
      const cambio = !a || JSON.stringify({ ...a, upd: 0 }) !== JSON.stringify({ ...p, upd: 0 });
      return cambio ? { ...p, upd: ahora } : p;
    });

    // lo que estaba antes y ya no está = borrado -> le pongo la tumba
    const tumbas = {};
    for (const p of antes) if (p && p.id && !next.some(x => x && x.id === p.id)) tumbas[p.id] = ahora;

    // guardo en segundo plano: la pantalla ya se actualizó, esto no la traba
    persistirPedidos(next, tumbas).then(fusionada => {
      if (fusionada && JSON.stringify(fusionada) !== JSON.stringify(next)) {
        setPedidos(fusionada);   // apareció algo del otro lado: lo muestro
      }
    }).catch(() => { });

    return next;
  });
  return next;
}
async function ejecutarAccion(accion, miSide, ctx) {
  ctx = ctx || {};
  const setPedidos = ctx.setPedidos;
  if (!accion || !accion.tipo) return null;
  const otro = miSide === "vv" ? "cliente" : "vv";
  if (accion.tipo === "crear_pedido") { const para = (accion.para === "vv" || accion.para === "cliente") ? accion.para : otro; const obs = ctx.obras || []; const obra_id = accion.obra_id || (accion.obra ? obs.find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase()))?.id : "") || ""; const p = nuevoPedido({ de: miSide, para, asunto: accion.asunto, detalle: accion.detalle, prioridad: accion.prioridad, obra_id }); await aplicarPedidos(setPedidos, arr => [p, ...arr]); try{ pushNotify("Nuevo pedido", `Belfast: ${p.asunto}`, "vv"); }catch(e){} return `Pedido creado y enviado: “${p.asunto}”.`; }
  if (accion.tipo === "responder_pedido") { const f = hoyStr(), ts = Date.now(); await aplicarPedidos(setPedidos, arr => arr.map(x => x.id === accion.pedido_id ? { ...x, estado: "respondido", hilo: [...x.hilo, { de: miSide, texto: accion.texto || "", fecha: f, ts, porIA: false }] } : x)); return "Respuesta enviada."; }
  if (accion.tipo === "resolver_pedido") { await aplicarPedidos(setPedidos, arr => arr.map(x => x.id === accion.pedido_id ? { ...x, estado: "resuelto" } : x)); return "Pedido marcado como resuelto."; }
  if (accion.tipo === "cargar_personal") {
    if (!ctx.setPersonal) return "No se pudo cargar el personal.";
    const sitio = accion.sitio || "(sin sitio)"; const f = hoyStr(); const sel = accion.personal || "todos";
    const obras = ctx.obras || []; const obraId = accion.obra ? (obras.find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase()))?.id) : null;
    const incluir = (p) => { if (obraId) return p.obra_id === obraId; if (Array.isArray(sel)) return sel.some(n => (p.nombre || "").toLowerCase().includes(String(n).toLowerCase())); return sel === "todos" || sel === "all"; };
    let arr = ctx.personal || []; try { const r = await storage.get("vv_personal"); if (r?.value) arr = JSON.parse(r.value); } catch { }
    let n = 0; const next = arr.map(p => { if (incluir(p)) { n++; const sitios = (p.sitios || []).filter(s => s.sitio !== sitio); return { ...p, sitios: [...sitios, { sitio, fecha: f }] }; } return p; });
    ctx.setPersonal(next); return `Cargué ${n} trabajador(es) al sitio “${sitio}”.`;
  }
  if (accion.tipo === "enviar_mensaje") {
    const msg = { id: uid() + Date.now(), from: miSide, texto: accion.texto || "", fecha: hoyStr(), ts: Date.now(), archivos: [] };
    let arr = []; try { const r = await storage.get("vv_mensajes"); if (r?.value) arr = JSON.parse(r.value); } catch { }
    const next = [...arr, msg]; try { localStorage.setItem("vv_mensajes", JSON.stringify(next)); } catch { } { const __ts = Date.now(); lastWrite["vv_mensajes"] = __ts; try { localStorage.setItem("vv_mensajes__ts", String(__ts)); } catch { } await storage.set("vv_mensajes", JSON.stringify(next)); await storage.set("vv_mensajes__ts", String(__ts)); }
    if (ctx.setMensajes) ctx.setMensajes(next);
    try{ pushNotify("Nuevo mensaje", `Belfast: ${(accion.texto||"").slice(0,80)}`, "vv"); }catch(e){}
    return "Mensaje enviado a V+V (aparece en Mensajes).";
  }
  if (accion.tipo === "preguntar_ia") {
    const msg = { id: uid() + Date.now(), from: miSide, texto: accion.texto || "", tipo: "q", answered: false, fecha: hoyStr(), ts: Date.now() };
    let arr = []; try { const r = await storage.get("ia_dialogo"); if (r?.value) arr = JSON.parse(r.value); } catch { }
    const next = [...arr, msg]; try { localStorage.setItem("ia_dialogo", JSON.stringify(next)); } catch { } await storage.set("ia_dialogo", JSON.stringify(next)).catch(() => { });
    return "Le pasé tu consulta directo a la IA de V+V. Te muestro acá la respuesta apenas conteste.";
  }
  return null;
}
function accionLabel(a) { if (!a) return ""; if (a.tipo === "crear_pedido") return `Crear pedido → ${a.para === "cliente" ? "V+V/Cliente" : "V+V"}: “${a.asunto || ""}”`; if (a.tipo === "responder_pedido") return "Responder pedido"; if (a.tipo === "resolver_pedido") return "Marcar pedido como resuelto"; if (a.tipo === "enviar_mensaje") return `Enviar mensaje a V+V: “${(a.texto || "").slice(0, 60)}”`; if (a.tipo === "preguntar_ia") return `Consultar a la IA de V+V: “${(a.texto || "").slice(0, 60)}”`; if (a.tipo === "whatsapp") return `WhatsApp a ${a.persona || a.rol || "contacto"}: “${(a.texto || "").slice(0, 50)}”`; if (a.tipo === "traer_fotos") return `Traer ${a.videos ? "videos" : "fotos"} de ${a.obra || "la obra"}`; if (a.tipo === "traer_plano") return `Traer plano de ${a.obra || "la obra"}`; if (a.tipo === "cargar_personal") return `Cargar personal al sitio “${a.sitio || ""}”${a.obra ? ` (obra ${a.obra})` : a.personal && a.personal !== "todos" ? ` (${Array.isArray(a.personal) ? a.personal.join(", ") : a.personal})` : " (todos)"}`; return a.tipo; }

const ESTADOS = { pendiente: { l: "Pendiente", c: "#94A3B8", b: "rgba(255,255,255,.04)" }, curso: { l: "En curso", c: "#10B981", b: "rgba(22,163,74,.14)" }, pausada: { l: "Pausada", c: "#F59E0B", b: "rgba(180,83,9,.14)" }, terminada: { l: "Terminada", c: "#6366F1", b: "#EEF2FF" } };
const BRASS = "#B0894F";
const DEFAULT_CFG = { nombre: "Belfast Construction Management", sigla: "BELFAST", logo: "", accent: "#1E3A5F" };
const LUXE_BG = "radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px) 0 0/22px 22px, radial-gradient(1100px 520px at 50% -8%, rgba(176,137,79,0.13), transparent 62%), linear-gradient(180deg,#0b141f 0%,#0a1019 100%)";
const LUXE_HERO = "radial-gradient(620px 220px at 86% 0%, rgba(176,137,79,0.20), transparent 60%), linear-gradient(135deg,#101C2C 0%,#17283c 100%)";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#0d0d0f;overscroll-behavior:none;font-family:'Inter',sans-serif;}
  button{cursor:pointer;font-family:inherit;}input,textarea,select{font-family:inherit;}
  input:focus,textarea:focus{outline:none;}textarea{resize:none;}::-webkit-scrollbar{display:none;}
  @keyframes slidein{from{transform:translateY(-120%);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes fadeIn{from{opacity:0}to{opacity:.85}}
`;
// Dos temas completos, como en la app de V+V: "oscuro" (el actual) y
// "claro". El modo elegido define los valores de base; si el usuario
// además tocó algún color individual en Ajustes (Fondo/Texto/etc.), ese
// toque puntual manda por encima del modo.
const TEMA_OSCURO = { bg: "#0d0d0f", card: "#111214", border: "#232227", text: "#f2f0eb", sub: "rgba(242,240,235,.6)", muted: "rgba(242,240,235,.42)", accent: "#B0894F", shadow: "0 1px 2px rgba(0,0,0,.2),0 10px 30px rgba(0,0,0,.35)" };
const TEMA_CLARO = { bg: "#F5F6F8", card: "#ffffff", border: "#E6E9EE", text: "#131C2B", sub: "#4A5565", muted: "#97A0AE", accent: "#B0894F", shadow: "0 1px 2px rgba(16,28,44,.05),0 6px 20px rgba(16,28,44,.06)" };
function theme(cfg) {
  const c = cfg || {};
  const base = c.modo === "claro" ? TEMA_CLARO : TEMA_OSCURO;
  const bg = c.themeBg || base.bg;
  const text = c.themeText || base.text;
  const accent = c.accent || base.accent;
  const sub = c.themeText ? hexToRgba(c.themeText, .6) : base.sub;
  const muted = c.themeText ? hexToRgba(c.themeText, .42) : base.muted;
  return { bg, card: c.themeCard || base.card, border: c.themeBorder || base.border, text, sub, muted, accent, accentLight: hexToRgba(accent, .14), navy: bg, r: 12, rsm: 8, shadow: base.shadow };
}
function hexToRgba(hex, alpha) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── COMPONENTES BASE ─────────────────────────────────────────────────
function Card({ T, children, style = {} }) { return <div style={{ background: T.card, borderRadius: T.r, border: `1px solid ${T.border}`, boxShadow: T.shadow, ...style }}>{children}</div>; }
function Badge({ c, b, children }) { return <span style={{ fontSize: 10, fontWeight: 700, color: c, background: b, borderRadius: 20, padding: "3px 9px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{children}</span>; }
function Eyebrow({ T, children }) { return <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}><span style={{ width: 18, height: 2, background: BRASS }} /><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted }}>{children}</span></div>; }
function PBtn({ T, children, onClick, disabled, full, style = {} }) { return <button onClick={onClick} disabled={disabled} style={{ background: disabled ? "#E2E8F0" : T.accent, color: disabled ? "#94A3B8" : "#fff", border: "none", borderRadius: T.rsm, padding: "12px 20px", fontSize: 14, fontWeight: 600, width: full ? "100%" : "auto", cursor: disabled ? "default" : "pointer", ...style }}>{children}</button>; }

// ── HEADER DEL CLIENTE ───────────────────────────────────────────────
function ClientHeader({ T, cfg }) {
  return (<div style={{ background: T.navy, color: "#fff", flexShrink: 0 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 13, padding: "16px 20px 15px", minHeight: 64 }}>
      {cfg.logo ? <img src={cfg.logo} alt="" style={{ maxHeight: 48, maxWidth: 240, objectFit: "contain" }} />
        : <><div style={{ width: 46, height: 46, background: "rgba(255,255,255,.08)", border: `1px solid ${BRASS}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>{(cfg.sigla || "C").slice(0, 3)}</div>
          <div style={{ lineHeight: 1.25, textAlign: "left" }}><div style={{ fontSize: 9, fontWeight: 700, color: BRASS, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 3 }}>Panel de cliente</div><div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.04em" }}>{cfg.nombre}</div></div></>}
    </div>
    <div style={{ height: 2, background: BRASS }} />
  </div>);
}

// ── PANTALLA: OBRAS / ESTADO ─────────────────────────────────────────
// ── FORMULARIOS recibidos (cliente · lectura) ────────────────────────
const FORM_TPLS = [
  { id: "cie", nombre: "Certificado de Inicio de Etapa", sub: "00 · Tareas preliminares", modo: "sino", obs: true, resultado: true, secciones: [
    { t: "Documentación y definiciones técnicas", items: ["Alcance de los trabajos definido", "Sectores de intervención definidos", "Planos aplicables disponibles en obra", "Replanteos, niveles y referencias definidos", "Detalles específicos necesarios para la etapa disponibles"] },
    { t: "Condiciones operativas", items: ["Acceso habilitado para personal", "Frente de trabajo disponible", "Área de acopio disponible", "Circulaciones internas definidas", "Interferencias relevantes informadas"] },
    { t: "Servicios provisorios", items: ["Energía eléctrica disponible", "Agua disponible", "Sanitarios disponibles", "Condiciones mínimas de seguridad disponibles"] },
    { t: "Materiales y recursos", items: ["Materiales necesarios disponibles en obra", "Equipos requeridos disponibles", "Medios auxiliares necesarios disponibles"] }] },
  { id: "iav", nombre: "Informe de Auditoría y Viabilidad", sub: "Albañilería · Aud. H. Ayala", modo: "conforme", obs: true, interferencias: true, textos: [{ k: "observaciones", l: "Observaciones técnicas" }, { k: "recomendaciones", l: "Recomendaciones" }], resultado: true, secciones: [
    { t: "Documentación", items: ["Planos de arquitectura vigentes", "Planos de detalles constructivos disponibles", "Niveles y cotas definidas", "Modificaciones de proyecto informadas", "Criterios de terminación definidos"] },
    { t: "Condiciones operativas", items: ["Frente de trabajo liberado", "Replanteo ejecutado y verificado", "Niveles de referencia materializados", "Estructura receptora finalizada", "Sectores accesibles para ejecución", "Interferencias identificadas e informadas"] },
    { t: "Servicios provisorios", items: ["Energía eléctrica disponible", "Agua disponible", "Sanitarios disponibles", "Condiciones mínimas de seguridad disponibles"] },
    { t: "Materiales y recursos", items: ["Materiales necesarios disponibles en obra", "Equipos requeridos disponibles", "Medios auxiliares necesarios disponibles"] },
    { t: "Interferencias y precondiciones técnicas", items: ["Instalaciones sanitarias ejecutadas según proyecto", "Instalaciones eléctricas coordinadas", "Instalaciones especiales coordinadas", "Aberturas definidas y verificadas", "Elementos estructurales ejecutados según proyecto", "No existen interferencias que impidan la ejecución"] },
    { t: "Control específico de albañilería", items: ["Tipo de mampostería definido", "Espesores de muro definidos", "Encuentros constructivos definidos", "Refuerzos previstos identificados", "Dinteles definidos", "Terminaciones previstas definidas"] }] },
  { id: "estado", nombre: "Estado de situación de obra", sub: "Informe de avance", modo: "estado", rubros: true, textos: [{ k: "avance", l: "Estado actual de avance" }, { k: "proxima", l: "Próxima tarea / requisitos previos" }, { k: "documentacion", l: "Documentación a gestionar" }, { k: "cronograma", l: "Cronograma interno" }] },
  { id: "nota", nombre: "Nota de pedido de información", sub: "Solicitud a la Dirección de Obra", modo: "nota", lineas: true, textos: [{ k: "intro", l: "Presentación" }, { k: "nota", l: "Nota / aclaración" }] },
];
function FormViewer({ T, tpl, f, obraNombre, onClose }) {
  const av = (k) => f.resp?.[k] || "—";
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 320, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 1180, margin: "0 auto", padding: "20px", maxHeight: "90vh", overflowY: "auto", animation: "up .25s ease" }}>
      <div style={{ fontSize: 10.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{tpl.sub}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{tpl.nombre}</div>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12 }}>{obraNombre} · {f.fecha}{f.nro ? ` · N° ${f.nro}` : ""}</div>
      {f.resultado && <div style={{ display: "inline-block", fontSize: 12, fontWeight: 800, color: f.resultado.includes("NO APTO") ? "#EF4444" : f.resultado.includes("OBSERV") ? "#B45309" : "#16A34A", background: f.resultado.includes("NO APTO") ? "rgba(239,68,68,.10)" : f.resultado.includes("OBSERV") ? "rgba(180,83,9,.14)" : "rgba(22,163,74,.14)", borderRadius: 6, padding: "5px 11px", marginBottom: 12 }}>{f.resultado}</div>}
      {(tpl.textos || []).filter(tx => tpl.modo !== "iav").map(tx => (f.textos?.[tx.k]) && <div key={tx.k} style={{ marginBottom: 12 }}><div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", marginBottom: 4 }}>{tx.l}</div><div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{f.textos[tx.k]}</div></div>)}
      {(tpl.secciones || []).map((sec, si) => <div key={si} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, marginBottom: 6 }}>{sec.t}</div>
        {(sec.items || []).map((it, ii) => { const v = av(`${si}:${ii}`); const ok = v === "Sí" || v === "Conf." || v === "Conforme"; const no = v === "No"; return (<div key={ii} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: `1px solid ${T.bg}` }}><span style={{ fontSize: 12, color: T.text, flex: 1 }}>{it}</span><span style={{ fontSize: 11, fontWeight: 800, color: ok ? "#16A34A" : no ? "#EF4444" : T.muted, flexShrink: 0 }}>{v}</span></div>); })}
        {f.obs?.[si] && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 6, fontStyle: "italic" }}>Obs: {f.obs[si]}</div>}
      </div>)}
      {tpl.rubros && (f.rubros || []).length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, marginBottom: 6 }}>Rubros</div>{f.rubros.map((r, i) => <div key={i} style={{ fontSize: 12, color: T.text, padding: "4px 0", borderBottom: `1px solid ${T.bg}` }}><b>{r.rubro}</b> — {r.estado}{r.obs ? ` · ${r.obs}` : ""}</div>)}</div>}
      {tpl.lineas && (f.lineas || []).length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, marginBottom: 6 }}>Información solicitada</div>{f.lineas.filter(l => l.info?.trim()).map((l, i) => <div key={i} style={{ fontSize: 12, color: T.text, padding: "5px 0", borderBottom: `1px solid ${T.bg}` }}>{i + 1}. {l.info}</div>)}</div>}
      {tpl.interferencias && (f.interferencias || []).length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12.5, fontWeight: 800, color: T.accent, marginBottom: 6 }}>Interferencias detectadas</div>{f.interferencias.map((r, i) => <div key={i} style={{ fontSize: 12, color: T.text, padding: "4px 0", borderBottom: `1px solid ${T.bg}` }}><b>{r.d}</b>{r.i ? ` → ${r.i}` : ""}</div>)}</div>}
      {tpl.modo === "iav" && (tpl.textos || []).map(tx => (f.textos?.[tx.k]) && <div key={tx.k} style={{ marginBottom: 12 }}><div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", marginBottom: 4 }}>{tx.l}</div><div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{f.textos[tx.k]}</div></div>)}
      <button onClick={onClose} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: T.rsm, padding: "12px", fontSize: 13.5, fontWeight: 700, marginTop: 6 }}>Cerrar</button>
    </div>
  </div>);
}

// ── AVISOS EN LOS ÍCONOS ────────────────────────────────────────────────
// Pone el punto rojo en un ícono cuando llegó algo que todavía no abriste.
// Guarda los IDs ya vistos (no una fecha) porque no todos los registros traen
// fecha: una obra nueva, por ejemplo, no la trae — y así igual la detectamos.
// Queda guardado en el dispositivo, así el aviso sobrevive aunque cierres la app.
function useAvisos(clave, mapaIds) {
  const [vistos, setVistos] = useState(() => {
    try { const r = localStorage.getItem(clave); return r ? JSON.parse(r) : null; } catch { return null; }
  });
  const guardar = (v) => { try { localStorage.setItem(clave, JSON.stringify(v)); } catch { } };
  // La primera vez doy todo por visto: si no, al instalar la app quedaría todo en rojo.
  useEffect(() => {
    if (vistos === null) {
      const init = {};
      for (const k in mapaIds) init[k] = mapaIds[k];
      setVistos(init); guardar(init);
    }
  });
  const aviso = (cat) => {
    if (!vistos) return 0;
    const yaVi = new Set(vistos[cat] || []);
    return (mapaIds[cat] || []).filter(x => !yaVi.has(x)).length;
  };
  const marcarVisto = (cat) => {
    setVistos(prev => {
      const n = { ...(prev || {}), [cat]: mapaIds[cat] || [] };
      guardar(n); return n;
    });
  };
  return { aviso, marcarVisto };
}


// ═══ OBRAS (compartido: idéntico a V+V) — inline, sin archivo aparte ═══
// ══════════════════════════════════════════════════════════════════
// ─── Avance de obra (espejo de V+V) ───
const fFechaCorta = (iso) => { if (!iso) return ""; const p = String(iso).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0].slice(2)}` : String(iso); };
function AvanceView({ T, obras, avance, setAvance, apiKey, cfg, certif = {}, envios = {}, setEnvios }) {
  // Certificado semanal abierto (los emite V+V; acá se ven en modo lectura).
  const [certAbierto, setCertAbierto] = React.useState(null);
  const [obraId, setObraId] = React.useState(obras[0]?.id || "");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const fileRef = React.useRef(null);
  const [fechaFoto, setFechaFoto] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [pendientes, setPendientes] = React.useState([]);
  const obra = obras.find(o => o.id === obraId);
  const historial = ((avance || {})[obraId] || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const [pdfHtml, setPdfHtml] = React.useState(null);
  const _escPdf = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  function buildPdfAvance(entries) {
    const marca = (cfg?.nombre || "Belfast Construction Management").toUpperCase();
    const logo = cfg?.logo || "";
    const nom = obra?.nombre || "Obra";
    const secc = entries.map(h => {
      const fs = (h.fotos && h.fotos.length) ? h.fotos : (h.fotoUrl ? [h.fotoUrl] : []);
      const fotosH = fs.map(u => `<img src="${u}" />`).join("");
      return `<div class="ent"><div class="fecha">${_escPdf(h.fecha)}</div>${fotosH ? `<div class="fotos">${fotosH}</div>` : ""}${h.avance ? `<div class="bloque"><div class="lbl">Avance</div><div class="txt">${_escPdf(h.avance)}</div></div>` : ""}<div class="bloque"><div class="lbl">Estado</div><div class="txt">${_escPdf(h.descripcion)}</div></div></div>`;
    }).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      @page { margin: 14mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; }
      body { font-family: -apple-system, Arial, sans-serif; color: #1a2433; background: #eceff3; }
      .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 26px 30px 34px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
      @media screen { body { padding: 14px; } }
      @media print { body { background: #fff; padding: 0; } .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; } }
      .hdr { border-bottom: 2px solid #B0894F; padding-bottom: 14px; margin-bottom: 16px; text-align: center; }
      .logo { max-height: 96px; max-width: 320px; object-fit: contain; display: block; margin: 0 auto 10px; }
      .marca { font-size: 17px; font-weight: 800; color: #0F1B2D; }
      .tipo { font-size: 10px; font-weight: 700; color: #B0894F; letter-spacing: .18em; text-transform: uppercase; margin-top: 2px; }
      h1 { font-size: 15px; color: #0F1B2D; margin: 6px 0 2px; }
      .meta { font-size: 11px; color: #5B6B7F; }
      .ent { border: 1px solid #E3E8EF; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
      .fecha { font-size: 13px; font-weight: 800; color: #B0894F; margin-bottom: 8px; }
      .fotos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      .fotos img { width: calc(50% - 3px); max-height: 260px; object-fit: contain; background: #0b0f14; border-radius: 6px; page-break-inside: avoid; break-inside: avoid; }
      .fotos img:only-child { width: 100%; max-height: 340px; }
      .bloque { margin-bottom: 8px; page-break-inside: avoid; break-inside: avoid; }
      .lbl { font-size: 9.5px; font-weight: 800; color: #1B3A5B; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
      .txt { font-size: 12px; color: #1a2433; line-height: 1.5; }
      .foot { margin-top: 14px; font-size: 9px; color: #98A2B3; text-align: center; border-top: 1px solid #E3E8EF; padding-top: 8px; }
    </style></head><body><div class="sheet">
      <div class="hdr">${logo ? `<img class="logo" src="${logo}" />` : ""}<div class="marca">${marca}</div><div class="tipo">Informe de avance de obra</div><h1>${_escPdf(nom)}</h1><div class="meta">${entries.length === 1 ? ("Fecha: " + _escPdf(entries[0].fecha)) : (entries.length + " registros")} · Emitido: ${hoyStr()}</div></div>
      ${secc}
      <div class="foot">Generado por ${marca} · Seguimiento visual de avance de obra.</div>
    </div></body></html>`;
  }
  const pdfUno = (h) => { setPdfEntries([h]); setPdfHtml(buildPdfAvance([h])); };
  // Copia el PDF ya armado por Belfast a Informes, para que lo vea el propietario.
  // paraProp = true → lo ve el propietario en su panel.
  // paraProp = false → queda solo en Informes de Belfast, uso interno.
  const enviarAInformes = (h, paraProp) => {
    if (!setEnvios || !obraId) return;
    const reg = { id: h.id, tipo: "av", fecha: h.fecha, titulo: `Informe de avance ${h.fecha}`, html: buildPdfAvance([h]), prop: !!paraProp, ts: Date.now() };
    setEnvios(p => { const lista = ((p || {})[obraId] || []).filter(x => x.id !== reg.id); return { ...(p || {}), [obraId]: [reg, ...lista] }; });
    alert(paraProp ? "Listo: el propietario ya lo puede ver en su panel." : "Listo: quedó en Informes de Belfast (el propietario NO lo ve).");
  };
  const estado = (h) => ((envios || {})[obraId] || []).find(x => x.id === h.id);
  const pdfTodos = () => { const ord = historial.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)); if (!ord.length) { alert("No hay informes para exportar."); return; } setPdfEntries(ord); setPdfHtml(buildPdfAvance(ord)); };
  const [pdfEntries, setPdfEntries] = React.useState([]);
  async function mergeSaveAvance(oid, transform) {
    let cloud = {};
    try { const r = await storage.get("vv_avance"); if (r && r.value) cloud = JSON.parse(r.value) || {}; } catch (e) { }
    setAvance(prev => { const base = { ...cloud, ...(prev || {}) }; base[oid] = transform(base[oid] || []); return base; });
  }
  async function guardarPdf() {
    const entries = pdfEntries;
    if (!entries.length) return;
    setStatus("Generando PDF…");
    try {
      const jsPDF = await (async () => {
        if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
        const urls = ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js", "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js"];
        for (const src of urls) {
          try {
            await new Promise((resolve, reject) => { const sc = document.createElement("script"); sc.src = src; sc.onload = resolve; sc.onerror = reject; document.head.appendChild(sc); });
            if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
          } catch (e) { }
        }
        throw new Error("No se pudo cargar la librería PDF");
      })();
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
      const M = 40; let y = M;
      const marca = (cfg?.nombre || "Belfast Construction Management").toUpperCase();
      const logo = cfg?.logo || "";
      const nom = obra?.nombre || "Obra";
      const loadImg = async (url) => { const r = await fetch(url); const blob = await r.blob(); const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); }); const dim = await new Promise((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth || 800, h: im.naturalHeight || 600 }); im.onerror = () => res({ w: 800, h: 600 }); im.src = data; }); let fmt = "JPEG"; try { fmt = data.substring(5, data.indexOf(";")).split("/")[1].toUpperCase(); if (fmt === "JPG") fmt = "JPEG"; } catch { } return { data, w: dim.w, h: dim.h, fmt }; };
      const ensure = (need) => { if (y + need > H - M) { doc.addPage(); y = M; } };
      if (logo) { try { const im = await loadImg(logo); let lw = Math.min(150, im.w); let lh = lw * im.h / im.w; if (lh > 72) { lh = 72; lw = lh * im.w / im.h; } doc.addImage(im.data, im.fmt, (W - lw) / 2, y, lw, lh); y += lh + 10; } catch { } }
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(15, 27, 45); doc.text(marca, W / 2, y, { align: "center" }); y += 15;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(176, 137, 79); doc.text("INFORME DE AVANCE DE OBRA", W / 2, y, { align: "center" }); y += 15;
      doc.setFontSize(12); doc.setTextColor(15, 27, 45); doc.text(nom, W / 2, y, { align: "center" }); y += 13;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(91, 107, 127); doc.text((entries.length === 1 ? ("Fecha: " + entries[0].fecha) : (entries.length + " registros")) + "   \u00b7   Emitido: " + hoyStr(), W / 2, y, { align: "center" }); y += 12;
      doc.setDrawColor(176, 137, 79); doc.setLineWidth(1.4); doc.line(M, y, W - M, y); y += 20;
      const block = (label, txt) => { if (!txt) return; ensure(24); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(27, 58, 91); doc.text(label, M, y); y += 12; doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(26, 36, 51); const lines = doc.splitTextToSize(String(txt), W - 2 * M); for (const ln of lines) { ensure(14); doc.text(ln, M, y); y += 13; } y += 6; };
      for (const h of entries) {
        ensure(34); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(176, 137, 79); doc.text(String(h.fecha || ""), M, y); y += 15;
        const fs = (h.fotos && h.fotos.length) ? h.fotos : (h.fotoUrl ? [h.fotoUrl] : []);
        for (const u of fs) { try { const im = await loadImg(u); const maxW = W - 2 * M; let iw = maxW, ih = iw * im.h / im.w; if (ih > 300) { ih = 300; iw = ih * im.w / im.h; } const libre = H - M - y; if (ih + 8 > libre) { if (libre > 150) { ih = libre - 10; iw = ih * im.w / im.h; if (iw > maxW) { iw = maxW; ih = iw * im.h / im.w; } } else { doc.addPage(); y = M; } } doc.addImage(im.data, im.fmt, M + (maxW - iw) / 2, y, iw, ih); y += ih + 8; } catch { } }
        block("AVANCE", h.avance); block("ESTADO", h.descripcion); y += 8;
      }
      const blob = doc.output("blob");
      const file = new File([blob], `Avance ${nom}.pdf`, { type: "application/pdf" });
      setStatus("");
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: `Avance ${nom}` }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) { setStatus("No pude generar el PDF. Probá de nuevo."); }
  }
  async function onFoto(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return; e.target.value = "";
    if (!obraId) { alert("Elegí una obra primero."); return; }
    const sel = files.slice(0, 6);
    setBusy(true); setStatus("Preparando fotos…");
    try {
      const pend = [];
      for (const f of sel) {
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const comp = await compressImage(dataUrl, 1600, 0.7);
        const b64 = String(comp).split(",")[1];
        const mediaType = (String(comp).match(/data:(.*?);/) || [])[1] || "image/jpeg";
        pend.push({ comp, b64, mediaType });
      }
      setPendientes(pend);
      setFechaFoto(new Date().toISOString().slice(0, 10));
      setStatus("");
    } catch (err) { setStatus("No pude leer las fotos. Probá de nuevo."); }
    setBusy(false);
  }
  async function analizar() {
    if (!pendientes.length) return;
    setBusy(true); setStatus(pendientes.length > 1 ? `Subiendo y analizando ${pendientes.length} fotos… (unos segundos)` : "Subiendo y analizando la foto… (unos segundos)");
    try {
      const urls = [], imgs = [];
      for (const pf of pendientes) {
        const url = await uploadArchivo(pf.comp, "avance", uid() + ".jpg");
        urls.push(url || pf.comp);
        imgs.push({ type: "image", source: { type: "base64", media_type: pf.mediaType, data: pf.b64 } });
      }
      const prev = historial[0];
      const _fiso = fechaFoto || new Date().toISOString().slice(0, 10);
      const [_aa, _mm, _dd] = _fiso.split("-");
      const fechaHoy = `${_dd}/${_mm}/${_aa.slice(2)}`;
      const tsFoto = new Date(_fiso + "T12:00:00").getTime();
      const nF = pendientes.length;
      const encab = nF > 1 ? `Te paso ${nF} fotos de la obra "${obra?.nombre || ""}" del día ${fechaHoy} (son del MISMO día, de distintos sectores/ángulos — analizalas como un CONJUNTO y dame una sola conclusión).` : `Foto de la obra "${obra?.nombre || ""}" del día ${fechaHoy}.`;
      const sys = "Sos un inspector de obra civil en Argentina. Analizás fotos de avance de obra con criterio técnico. Sos honesto: el porcentaje es una ESTIMACIÓN visual, no una medición exacta. Escribí claro y breve, en español rioplatense (vos).";
      const instruc = prev
        ? `${encab}\n\nESTADO ANTERIOR (${prev.fecha}):\n${prev.descripcion}\n\nHacé DOS cosas:\n1) ESTADO ACTUAL: describí en 3-5 renglones qué se ve (estructura, mampostería, revoques, contrapisos, instalaciones, aberturas, terminaciones — lo que aplique).\n2) AVANCE: compará con el estado anterior. Qué se avanzó, qué falta, un % ESTIMADO de avance de la obra, y ALERTAS si no ves progreso esperable o algo raro.\nFormato EXACTO:\nESTADO ACTUAL: ...\nAVANCE: ...`
        : `${encab} Es la PRIMERA carga (línea de base). Describí el ESTADO ACTUAL en 3-5 renglones (estructura, mampostería, revoques, instalaciones, aberturas, terminaciones — lo que aplique) y estimá un % de avance general.\nFormato EXACTO:\nESTADO ACTUAL: ...`;
      const content = [...imgs, { type: "text", text: instruc }];
      const resp = await callAI([{ role: "user", content }], sys, apiKey, false);
      let descripcion = resp, avanceTxt = "";
      const mA = resp.match(/AVANCE:\s*([\s\S]*)$/i);
      const mE = resp.match(/ESTADO ACTUAL:\s*([\s\S]*?)(?:AVANCE:|$)/i);
      if (mE) descripcion = mE[1].trim();
      if (mA) avanceTxt = mA[1].trim();
      const item = { id: uid() + Date.now(), fecha: fechaHoy, ts: tsFoto, descripcion, avance: avanceTxt, fotos: urls, fotoUrl: urls[0] };
      await mergeSaveAvance(obraId, list => [item, ...list]);
      setPendientes([]); setStatus("");
    } catch (err) { setStatus("Hubo un error al analizar la(s) foto(s). Fijate que tengas crédito de API y probá de nuevo."); }
    setBusy(false);
  }
  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
    <div style={{ padding: "14px 18px 4px", flexShrink: 0 }}><div style={{ fontSize: 10, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.12em" }}>Seguimiento visual</div><div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Avance de obra</div><div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Subí una o varias fotos del día y la IA compara el avance con la anterior</div></div>
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 28px", minHeight: 0 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
      <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px", fontSize: 15, color: T.text, margin: "6px 0 14px" }}>
        {obras.length === 0 && <option value="">No hay obras</option>}
        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFoto} style={{ display: "none" }} />
      {pendientes.length === 0
        ? <button onClick={() => fileRef.current?.click()} disabled={busy || !obraId} style={{ width: "100%", background: busy ? T.border : T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "14px", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", marginBottom: 8 }}>{busy ? "Preparando…" : "Elegir foto(s)"}</button>
        : <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: T.shadow }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 8 }}>{pendientes.length === 1 ? "1 foto seleccionada" : `${pendientes.length} fotos seleccionadas`} — poné la fecha y analizá</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 10 }}>
              {pendientes.map((pf, i) => <div key={i} style={{ position: "relative" }}>
                <img src={pf.comp} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 7, display: "block", border: `1px solid ${T.border}` }} />
                <button onClick={() => setPendientes(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 12, cursor: "pointer", lineHeight: 1 }}>✕</button>
              </div>)}
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Fecha de la foto</label>
            <input type="date" value={fechaFoto} onChange={e => setFechaFoto(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px", fontSize: 15, color: T.text, margin: "6px 0 12px", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setPendientes([]); setStatus(""); }} disabled={busy} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, color: T.sub, borderRadius: T.rsm, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={analizar} disabled={busy} style={{ flex: 2, background: busy ? T.border : T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>{busy ? "Analizando…" : "✓ Analizar avance"}</button>
              <button onClick={() => fileRef.current?.click()} disabled={busy} title="Agregar más" style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: T.rsm, padding: "0 14px", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>＋</button>
            </div>
          </div>}
      {status && <div style={{ fontSize: 12.5, color: T.sub, textAlign: "center", padding: "6px 0 12px" }}>{status}</div>}
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, marginBottom: 16 }}>Consejo: elegí las fotos, fijate cuáles son y recién ahí poné la fecha del día en que se sacaron. Podés subir varias del mismo día (distintos sectores). El % es una estimación visual, no una medición exacta.</div>
      {historial.length > 0 && <button onClick={pdfTodos} style={{ width: "100%", background: T.card, border: `1px solid ${BRASS}`, color: T.text, borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}><Ico n="doc" /> PDF de toda la obra ({historial.length} fecha{historial.length > 1 ? "s" : ""})</button>}
      {historial.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "20px", lineHeight: 1.6 }}>Todavía no hay fotos de avance para esta obra.<br />Subí la primera (será la línea de base).</div>}
      {historial.map((h, idx) => (<div key={h.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        {(() => { const fs = (h.fotos && h.fotos.length) ? h.fotos : (h.fotoUrl ? [h.fotoUrl] : []); if (!fs.length) return null; if (fs.length === 1) return <img src={fs[0]} alt="" style={{ width: "100%", maxHeight: 340, objectFit: "contain", background: "#0b0f14", display: "block" }} />; return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, alignItems: "start", padding: 4, background: "#0b0f14" }}>{fs.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ display: "block" }}><img src={u} alt="" style={{ width: "100%", height: "auto", display: "block", borderRadius: 4 }} /></a>)}</div>; })()}
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{h.fecha}{idx === 0 ? "  ·  última" : ""}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {idx === historial.length - 1 && <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, background: T.al, borderRadius: 6, padding: "2px 7px" }}>línea de base</span>}
              <button onClick={() => pdfUno(h)} title="Exportar esta fecha a PDF" style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}><Ico n="doc" /> PDF</button>
              <button onClick={() => enviarAInformes(h, false)} title="Copiar a Informes de Belfast (uso interno)" style={{ background: estado(h) ? "rgba(37,99,235,.14)" : T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "4px 8px", fontSize: 10.5, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>{estado(h) ? "✓ Informes" : "→ Informes"}</button>
              <button onClick={() => enviarAInformes(h, true)} title="Mandarlo al panel del propietario" style={{ background: estado(h)?.prop ? "rgba(22,163,74,.18)" : BRASS, border: "none", color: estado(h)?.prop ? "#166534" : "#fff", borderRadius: 7, padding: "4px 8px", fontSize: 10.5, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>{estado(h)?.prop ? "✓ Propietario" : "→ Propietario"}</button>
            </div>
          </div>
          {h.avance && <div style={{ background: T.al, borderRadius: 8, padding: "9px 11px", marginBottom: 8 }}><div style={{ fontSize: 10, fontWeight: 800, color: T.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}><Ico n="chart" /> Avance</div><div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{h.avance}</div></div>}
          <div style={{ fontSize: 10, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Estado</div>
          <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{h.descripcion}</div>
        </div>
      </div>))}
    </div>
    {pdfHtml && <div style={{ position: "fixed", inset: 0, background: "#1a2433", zIndex: 300, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", rowGap: 8, padding: `calc(10px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 14px 10px`, background: "#0F1B2D", flexShrink: 0, position: "relative", zIndex: 2 }}>
        <button onClick={() => setPdfHtml(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>‹ Volver</button>
        <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, flex: "1 1 auto", textAlign: "center", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Informe de avance</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { const f = document.getElementById("avance-pdf"); if (f?.contentWindow) f.contentWindow.print(); }} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "9px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>Imprimir</button>
          <button onClick={guardarPdf} style={{ background: BRASS, border: "none", color: "#fff", borderRadius: 8, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}><Ico n="download" /> Guardar PDF</button>
        </div>
      </div>
      <iframe id="avance-pdf" srcDoc={pdfHtml} title="Avance PDF" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
    </div>}
  </div>);
}

// ─── Bitácora de obra (espejo de V+V) ───
// Drone IA — solo consulta: el cliente ve los vuelos, fotos y la lectura
// de IA que ya cargó V+V, pero no puede crear vuelos ni pedir análisis
// nuevos (eso es una tarea operativa del lado de V+V).
function DroneIAClienteView({ T, obras, dronevuelos }) {
  const [obraId, setObraId] = React.useState(obras[0]?.id || "");
  const [detalle, setDetalle] = React.useState(null);
  const obraNombre = (id) => obras.find(o => o.id === id)?.nombre || "—";
  const vuelos = (dronevuelos || []).filter(v => v.obra_id === obraId).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  // Vuelos de HOY, de todas las obras juntas — lo primero que se ve.
  const hoyISOd = new Date().toISOString().slice(0, 10);
  const esDeHoy = (v) => { try { return new Date(v.ts).toISOString().slice(0, 10) === hoyISOd; } catch { return false; } };
  const vuelosHoy = (dronevuelos || []).filter(esDeHoy).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const horaVuelo = (v) => { try { return new Date(v.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }); } catch { return ""; } };

  if (detalle) return (<div style={{ flex: 1, overflowY: "auto" }}>
    <div style={{ padding: "16px 20px" }}>
      <button onClick={() => setDetalle(null)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, width: 32, height: 32, fontSize: 15, color: T.sub, cursor: "pointer", marginBottom: 14 }}>←</button>
      <div style={{ fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 2 }}>Vuelo — {detalle.fecha}</div>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 16 }}>{detalle.piloto ? `Piloto: ${detalle.piloto}` : ""}{detalle.dronModelo ? ` · ${detalle.dronModelo}` : ""}</div>
      {detalle.notas && <Card T={T} style={{ padding: 13, marginBottom: 14 }}><Lbl>Notas del vuelo</Lbl><div style={{ fontSize: 13, color: T.text }}>{detalle.notas}</div></Card>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
        {(detalle.fotos || []).map(f => (<div key={f.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
          <img src={f.url} style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
          {f.lat && <div style={{ position: "absolute", bottom: 5, left: 5, background: "rgba(15,23,42,.65)", color: "#fff", fontSize: 9, borderRadius: 6, padding: "2px 6px" }}>📍 {f.lat.toFixed(4)}, {f.lon.toFixed(4)}</div>}
        </div>))}
      </div>
      {detalle.analisisIA && <Card T={T} style={{ padding: 13, background: T.accentLight || T.bg }}>
        <Lbl>Lectura de IA — {detalle.analisisFecha} <span style={{ textTransform: "none", fontWeight: 500 }}>(orientativa, no es una medición oficial)</span></Lbl>
        <div style={{ fontSize: 13, color: T.text, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{detalle.analisisIA}</div>
      </Card>}
    </div>
  </div>);

  return (<div style={{ flex: 1, overflowY: "auto" }}>
    <div style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 12 }}>🚁 Drone IA</div>
      {/* Los vuelos de hoy, de todas las obras */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${BRASS}`, borderRadius: 12, padding: 14, marginBottom: 14, boxShadow: T.shadow }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: vuelosHoy.length ? 10 : 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>Hoy en todas las obras</div>
          <div style={{ fontSize: 11, color: T.muted }}>{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        {vuelosHoy.length === 0
          ? <div style={{ fontSize: 12.5, color: T.muted, marginTop: 8 }}>Todavía no se cargó ningún vuelo hoy.</div>
          : vuelosHoy.map(v => (<div key={v.id} onClick={() => setDetalle(v)} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderTop: `1px solid ${T.border}`, cursor: "pointer" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: BRASS, flexShrink: 0, minWidth: 42, fontVariantNumeric: "tabular-nums" }}>{horaVuelo(v)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{obraNombre(v.obra_id)}</div>
              <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{v.piloto ? `Piloto: ${v.piloto}` : "Sin piloto"}{v.analisisIA ? " · con lectura IA" : ""}</div>
            </div>
            {(v.fotos || []).length > 0 && <div style={{ fontSize: 10.5, color: T.muted, flexShrink: 0 }}>📷 {(v.fotos || []).length}</div>}
          </div>))}
      </div>
      {obras.length > 1 && <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px", fontSize: 15, color: T.text, marginBottom: 14 }}>
        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>}
      {vuelos.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "40px 18px" }}>Todavía no hay vuelos cargados para {obraNombre(obraId)}.</div>}
      {vuelos.map(v => (<div key={v.id} onClick={() => setDetalle(v)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 14px", marginBottom: 8, cursor: "pointer" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{v.fecha}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{v.piloto ? `Piloto: ${v.piloto}` : "Sin piloto cargado"} · {(v.fotos || []).length} foto{(v.fotos || []).length !== 1 ? "s" : ""}{v.analisisIA ? " · con lectura IA" : ""}</div>
      </div>))}
    </div>
  </div>);
}

function GrabarReunionCliente({ T, cfg, apiKey, obras, minutas = [], setMinutas, onBack }) {
  const [paso, setPaso] = useState("form");
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [obraId, setObraId] = useState("");
  const [transcripcion, setTranscripcion] = useState("");
  const [segundos, setSegundos] = useState(0);
  const [minutaTexto, setMinutaTexto] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const recRef = useRef(null);
  const activoRef = useRef(false);
  const baseRef = useRef("");
  const timerRef = useRef(null);
  // Qué minuta está abierta y si ya tiene el PDF generado y guardado.
  const [minutaId, setMinutaId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const sttOk = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  function fFechaLarga(iso) { try { return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }); } catch { return iso; } }

  function arrancarReco() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "es-AR"; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      let finales = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) finales += e.results[i][0].transcript + " ";
      if (finales) { baseRef.current = (baseRef.current + " " + finales).trim(); setTranscripcion(baseRef.current); }
    };
    rec.onend = () => { if (activoRef.current) { try { rec.start(); } catch { setTimeout(() => { if (activoRef.current) try { rec.start(); } catch { } }, 300); } } };
    rec.onerror = (e) => { if (e.error === "no-speech" || e.error === "aborted") return; if (activoRef.current && e.error !== "not-allowed") { try { rec.start(); } catch { } } };
    recRef.current = rec;
    rec.start();
  }

  function empezar() {
    if (!titulo.trim()) { alert("Ponele un título a la reunión."); return; }
    if (!sttOk) { alert("Este navegador no permite grabar con reconocimiento de voz. Probá desde Chrome o Safari en el celular."); return; }
    baseRef.current = ""; setTranscripcion(""); setSegundos(0);
    activoRef.current = true;
    arrancarReco();
    timerRef.current = setInterval(() => setSegundos(s => s + 1), 1000);
    setPaso("grabando");
  }

  async function terminar() {
    activoRef.current = false;
    try { recRef.current?.stop(); } catch { }
    clearInterval(timerRef.current);
    const texto = transcripcion.trim();
    if (!texto) { alert("No capté nada de audio. Probá de nuevo, más cerca del micrófono."); setPaso("form"); return; }
    setPaso("armando");
    try {
      const obraNombre = obras.find(o => o.id === obraId)?.nombre || "";
      const sys = `Recibís la transcripción de voz de una reunión grabada. Puede tener errores de dictado, cortes, muletillas, o gente hablando encima. Tu trabajo es UNO SOLO: pasarla en limpio y ordenarla, armando un texto con hilo lógico y fácil de leer.

REGLAS INNEGOCIABLES:
- NUNCA comentes, juzgues ni aclares de qué trata la conversación. No digas si es de obra o no, si es relevante, si es informal, ni si te parece adecuada. No opines sobre el contenido.
- NUNCA te niegues ni pidas más contexto. Sea cual sea el tema, escribí lo que se escuchó.
- No agregues advertencias, disclaimers, ni notas del tipo "esta conversación no parece de trabajo". Nada de eso.
- Escribí SOLO lo que se dijo, ordenado y con sentido. No inventes nada que no esté en la transcripción.
- Si se distingue quién habla, marcalo. Si no, escribilo de corrido pero ordenado por temas, respetando el orden en que se hablaron.
- Español rioplatense, claro y natural.

FORMATO: empezá siempre con este encabezado exacto:
MINUTA DE REUNIÓN
${obraNombre ? `Obra: ${obraNombre} · ` : ""}Fecha: ${fFechaLarga(fecha)} · Tema: ${titulo}

Después el desarrollo de lo hablado, ordenado y legible.
Al final, SOLO si de verdad surgieron de la charla, agregá "ACUERDOS / DECISIONES" y/o "PENDIENTES" (numerados). Si no hubo acuerdos ni pendientes, no pongas esas secciones — no las fuerces.`;
      const resp = await callAI([{ role: "user", content: `Transcripción de la reunión:\n\n${texto}` }], sys, apiKey, false);
      setMinutaTexto(resp || "");
      const registro = { id: uid(), titulo: titulo.trim(), fecha, obra_id: obraId || null, transcripcion: texto, minutaTexto: resp || "", ts: Date.now() };
      if (setMinutas) setMinutas(p => [registro, ...(p || [])]);
      setMinutaId(registro.id); setPdfUrl(null);
      setPaso("lista");
    } catch { alert("No pude generar la minuta ahora. La transcripción completa sigue abajo, la podés copiar a mano."); setPaso("lista"); }
  }

  function cancelar() { activoRef.current = false; try { recRef.current?.stop(); } catch { } clearInterval(timerRef.current); setPaso("form"); }

  // Manda el PDF ya guardado: abre el menú del teléfono para elegir
  // WhatsApp, Mail, o lo que sea. El PDF sigue guardado acá igual.
  // Descarta la grabación que se acaba de hacer, sin tener que ir a
  // buscarla a la lista de minutas anteriores.
  function borrarEstaGrabacion() {
    if (!confirm("¿Borrar esta grabación?\n\nSe borra el audio transcripto y la minuta. No se puede deshacer.")) return;
    if (minutaId && setMinutas) setMinutas(p => (p || []).filter(x => x.id !== minutaId));
    setPaso("form"); setTitulo(""); setTranscripcion(""); setMinutaTexto(""); setMinutaId(null); setPdfUrl(null);
  }
  async function mandarPdf() {
    if (!pdfUrl) return;
    const nombreArchivo = `Minuta - ${titulo} - ${fecha}.pdf`;
    try {
      let blob;
      if (pdfUrl.startsWith("data:")) {
        // PDF incrustado: lo paso a archivo sin salir a la red.
        const b64 = pdfUrl.split(",")[1] || "";
        const bin = atob(b64); const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        blob = new Blob([arr], { type: "application/pdf" });
      } else {
        const r = await fetch(pdfUrl);
        blob = await r.blob();
      }
      const file = new File([blob], nombreArchivo, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: nombreArchivo, text: `Minuta de reunión — ${titulo}` });
        return;
      }
      const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = nombreArchivo; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch (e) {
      if (e && e.name === "AbortError") return;
      window.open(pdfUrl, "_blank");   // último recurso: abrirlo para compartir a mano
    }
  }
  async function generarPdf() {
    setGenerandoPdf(true);
    try {
      let jsPDF;
      if (window.jspdf && window.jspdf.jsPDF) jsPDF = window.jspdf.jsPDF;
      else {
        const urls = ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js", "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js"];
        for (const src of urls) { try { await new Promise((resolve, reject) => { const sc = document.createElement("script"); sc.src = src; sc.onload = resolve; sc.onerror = reject; document.head.appendChild(sc); }); if (window.jspdf && window.jspdf.jsPDF) { jsPDF = window.jspdf.jsPDF; break; } } catch { } }
        if (!jsPDF) throw new Error("No se pudo cargar la librería de PDF");
      }
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
      const M = 40; let y = M;
      const ensure = (need) => { if (y + need > H - M) { doc.addPage(); y = M; } };
      const obraNombre = obras.find(o => o.id === obraId)?.nombre || "";
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(15, 27, 45); doc.text((cfg?.nombre || "Minuta de reunión").toUpperCase(), W / 2, y, { align: "center" }); y += 16;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(176, 137, 79); doc.text("MINUTA DE REUNIÓN", W / 2, y, { align: "center" }); y += 16;
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(15, 27, 45); doc.text(titulo, W / 2, y, { align: "center" }); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(91, 107, 127);
      doc.text(`${fFechaLarga(fecha)}${obraNombre ? "   ·   Obra: " + obraNombre : ""}`, W / 2, y, { align: "center" }); y += 14;
      doc.setDrawColor(176, 137, 79); doc.setLineWidth(1.4); doc.line(M, y, W - M, y); y += 22;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(26, 36, 51);
      const cuerpo = minutaTexto.split("\n").filter((ln, i) => {
        const t = ln.trim();
        if (i < 3 && /^MINUTA DE REUNI[OÓ]N$/i.test(t)) return false;
        if (i < 3 && /^(Obra|Fecha|Tema)\s*:/i.test(t)) return false;
        return true;
      }).join("\n").trim();
      const lineas = doc.splitTextToSize(cuerpo || minutaTexto, W - 2 * M);
      for (const ln of lineas) {
        const esTitulo = /^(TEMAS TRATADOS|ACUERDOS|PENDIENTES)/i.test(ln.trim());
        ensure(esTitulo ? 22 : 15);
        if (esTitulo) { y += 6; doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(27, 58, 91); doc.text(ln, M, y); y += 15; doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(26, 36, 51); }
        else { doc.text(ln, M, y); y += 14; }
      }
      const blob = doc.output("blob");
      // El PDF NO se va de la app: se sube y queda guardado EN la minuta.
      const dataUrl = doc.output("datauristring");
      const url = await uploadFoto(dataUrl, "minutas-cliente", `${minutaId || uid()}.pdf`);
      setPdfUrl(url);
      if (minutaId && setMinutas) setMinutas(p => (p || []).map(m => m.id === minutaId ? { ...m, pdfUrl: url } : m));
    } catch { alert("No pude generar el PDF. Probá de nuevo."); }
    setGenerandoPdf(false);
  }

  const mm = String(Math.floor(segundos / 60)).padStart(2, "0"), ss = String(segundos % 60).padStart(2, "0");

  if (paso === "grabando") return (<div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <AppHeader T={T} title={titulo} sub="Grabando" back onBack={cancelar} />
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px 20px" }}>
      <div style={{ width: 90, height: 90, borderRadius: "50%", background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, flexShrink: 0 }}><Ico n="mic" s={36} c="#fff" /></div>
      <div style={{ fontSize: 30, fontWeight: 800, color: T.text, flexShrink: 0 }}>{mm}:{ss}</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 18, flexShrink: 0 }}>Grabando — se reinicia solo, no hace falta que hagas nada</div>
      {/* Único cuadro que scrollea — así el botón de terminar queda
          siempre fijo abajo, visible, sin importar cuánto dure la reunión. */}
      <div style={{ width: "100%", maxWidth: 480, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.r, padding: 16, flex: 1, minHeight: 0, overflowY: "auto", fontSize: 13, color: T.sub, lineHeight: 1.6, marginBottom: 16 }}>{transcripcion || "Escuchando… empezá a hablar."}</div>
      <PBtn T={T} full onClick={terminar} style={{ maxWidth: 480, background: "#DC2626", flexShrink: 0 }}>⏹ Terminar y armar la minuta</PBtn>
    </div>
  </div>);

  if (paso === "armando") return (<div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30 }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>Armando la minuta…</div>
    <div style={{ fontSize: 12, color: T.muted }}>Un momento, esto no tarda.</div>
  </div>);

  if (paso === "lista") return (<div style={{ flex: 1, overflowY: "auto" }}>
    <AppHeader T={T} title="Minuta de reunión" back onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.r, padding: 16, marginBottom: 16, whiteSpace: "pre-wrap", fontSize: 13, color: T.text, lineHeight: 1.6 }}>{minutaTexto || "No pude armar la minuta con IA — acá tenés la transcripción completa para copiar a mano:\n\n" + transcripcion}</div>
      <PBtn T={T} full onClick={generarPdf} disabled={generandoPdf} style={{ marginBottom: 10 }}>{generandoPdf ? "Generando…" : pdfUrl ? "🔄 Volver a generar el PDF" : "📄 Generar el PDF de la minuta"}</PBtn>
      {pdfUrl && <>
        <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", background: T.card, border: `1px solid ${T.border}`, color: T.accent, borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, textDecoration: "none", marginBottom: 10 }}>👁 Ver el PDF (queda guardado acá)</a>
        <PBtn T={T} full onClick={() => mandarPdf()} style={{ marginBottom: 10 }}>📤 Mandar por WhatsApp o Mail</PBtn>
      </>}
      <button onClick={() => { setPaso("form"); setTitulo(""); setTranscripcion(""); setMinutaTexto(""); setMinutaId(null); setPdfUrl(null); }} style={{ width: "100%", background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: T.rsm, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>Grabar otra reunión</button>
      <button onClick={borrarEstaGrabacion} style={{ width: "100%", background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", color: "#DC2626", borderRadius: T.rsm, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🗑 Borrar esta grabación</button>
    </div>
  </div>);

  return (<div style={{ flex: 1, overflowY: "auto" }}>
    <AppHeader T={T} title="🎙 Grabar reunión" sub="Se arma la minuta sola al terminar" back onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      {!sttOk && <div style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.35)", borderRadius: T.rsm, padding: 12, marginBottom: 14, fontSize: 12, color: "#991B1B" }}>Este navegador no tiene reconocimiento de voz disponible. Probá desde el celular, con Chrome o Safari.</div>}
      <Field label="Título de la reunión"><TInput value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Reunión de avance semanal" /></Field>
      <Field label="Fecha"><TInput type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></Field>
      {obras.length > 0 && <Field label="Obra (opcional)"><Sel value={obraId} onChange={e => setObraId(e.target.value)}><option value="">— Sin asignar —</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>}
      <PBtn T={T} full onClick={empezar} disabled={!sttOk} style={{ marginTop: 8 }}>🔴 Empezar a grabar</PBtn>
      {minutas.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em", margin: "22px 0 10px" }}>Minutas anteriores</div>
        {minutas.slice(0, 15).map(m => (<div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: 13, marginBottom: 8 }}>
          <div onClick={() => { setTitulo(m.titulo); setFecha(m.fecha); setObraId(m.obra_id || ""); setMinutaTexto(m.minutaTexto); setTranscripcion(m.transcripcion); setMinutaId(m.id); setPdfUrl(m.pdfUrl || null); setPaso("lista"); }} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{m.titulo}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{fFechaLarga(m.fecha)}{obras.find(o => o.id === m.obra_id) ? " · " + obras.find(o => o.id === m.obra_id).nombre : ""}</div>
          </div>
          <button onClick={() => { if (confirm(`¿Borrar "${m.titulo}"?\n\nSe borra la grabación y la minuta. No se puede deshacer.`)) setMinutas(p => (p || []).filter(x => x.id !== m.id)); }} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", padding: 6, flexShrink: 0, fontSize: 15 }}>🗑</button>
        </div>))}
      </>}
    </div>
  </div>);
}

// ── AUDITORÍA (lectura) — trae las supervisiones/revisiones/certificaciones que carga V+V ──
const AUD_TIPOS_CLI = [
  { id: "supervision", label: "Supervisiones", sigla: "SUP" },
  { id: "revision", label: "Revisión de doc.", sigla: "RDO" },
  { id: "certificacion", label: "Certificación", sigla: "CER" },
];
function AuditoriaClienteView({ T, obras, auditoria, cfg, desdeSemana }) {
  const [tipo, setTipo] = useState("supervision");
  const [obraId, setObraId] = useState("");
  const [soloSemana, setSoloSemana] = useState(!!desdeSemana);
  const tp = AUD_TIPOS_CLI.find(t => t.id === tipo) || AUD_TIPOS_CLI[0];
  const fmtDMY = (iso) => { const [a, m, d] = String(iso || "").split("-"); return a ? `${d}/${m}/${a.slice(2)}` : String(iso || ""); };
  const _e = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  const nombreObra = (id) => (obras.find(o => o.id === id) || {}).nombre || "—";
  const inicioSemanaAud = (() => { const d = new Date(); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const listaSemana = (auditoria || []).filter(x => x.ts && x.ts >= inicioSemanaAud).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const lista = soloSemana ? listaSemana : (auditoria || []).filter(x => x.tipo === tipo && (!obraId || x.obra_id === obraId)).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const [abierto, setAbierto] = useState(null);
  const [pdfHtml, setPdfHtml] = useState(null);
  const AUD_TIPOS_FULL = [
    { id: "supervision", titulo: "Acta de supervisión de obra" },
    { id: "revision", titulo: "Informe de revisión de documentación" },
    { id: "certificacion", titulo: "Certificado de etapa ejecutada" },
  ];
  // Mismo generador que en Constructora — mismo diseño, mismos datos, para
  // que Cliente vea exactamente el mismo certificado que carga V+V.
  function buildPdf(it) {
    const t = AUD_TIPOS_FULL.find(x => x.id === it.tipo) || AUD_TIPOS_FULL[0];
    const marca = (cfg?.empresa || "V+V Construcciones").toUpperCase();
    const logo = cfg?.logoEmpresa || cfg?.logoCentral || cfg?.logoEmpresa2 || "";
    const nomObra = nombreObra(it.obra_id);
    const colorRes = it.resultado === "No conforme" ? "#B91C1C" : it.resultado === "Conforme con observaciones" ? "#B45309" : "#15803D";
    const obsRows = (it.obs || []).length
      ? `<table><tr><th style="width:38px">N°</th><th>Observación</th><th style="width:110px">Sector / ítem</th><th style="width:88px">Criticidad</th></tr>
         ${(it.obs || []).map((o, i) => `<tr><td>${i + 1}</td><td>${_e(o.txt)}</td><td>${_e(o.sector || "—")}</td><td>${_e(o.crit || "Media")}</td></tr>`).join("")}</table>`
      : `<div class="vacio">Sin observaciones registradas.</div>`;
    let cuerpo = "";
    if (it.tipo === "supervision") {
      cuerpo = `
        <div class="grid"><div><span>Período</span><b>${_e(it.periodo || "—")}</b></div><div><span>Presentes</span><b>${_e(it.presentes || "—")}</b></div></div>
        <h2>Observaciones de la supervisión</h2>${obsRows}
        <h2>Interferencias detectadas</h2>${(it.interferencias || []).length ? `<ul>${(it.interferencias || []).map(x => `<li>${_e(x)}</li>`).join("")}</ul>` : `<div class="vacio">No se detectaron interferencias.</div>`}`;
    }
    if (it.tipo === "revision") {
      cuerpo = `
        <div class="grid"><div><span>Etapa</span><b>${_e(it.etapa || "—")}</b></div><div><span>Documentos revisados</span><b>${(it.docs || []).length}</b></div></div>
        <h2>Documentación revisada</h2>
        ${(it.docs || []).length ? `<table><tr><th>Documento</th><th style="width:90px">Versión</th><th style="width:100px">Fecha doc.</th></tr>
          ${(it.docs || []).map(d => `<tr><td>${_e(d.nombre)}</td><td>${_e(d.version || "—")}</td><td>${_e(d.fechaDoc || "—")}</td></tr>`).join("")}</table>` : `<div class="vacio">Sin documentos cargados.</div>`}
        <h2>Observaciones sobre la documentación</h2>${obsRows}`;
    }
    if (it.tipo === "certificacion") {
      cuerpo = `
        <div class="grid"><div><span>Etapa certificada</span><b>${_e(it.etapa || "—")}</b></div><div><span>Ejecutado por</span><b>${_e(it.ejecutadoPor || marca)}</b></div>
        <div><span>Plano de referencia</span><b>${_e(it.planoRef || "—")}</b></div><div><span>Versión / revisión</span><b>${_e(it.versionPlano || "—")}</b></div></div>
        <div class="decl">Se deja constancia de que la etapa <b>${_e(it.etapa || "")}</b> de la obra <b>${_e(nomObra)}</b> fue ejecutada <b>conforme al plano de referencia indicado</b> y a la directiva impartida por la Jefatura de Obra que se transcribe a continuación.</div>
        <h2>Directiva de la Jefatura de Obra</h2><div class="parr">${_e(it.directiva || "—")}</div>
        <h2>Observaciones</h2>${obsRows}`;
    }
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      @page { margin: 15mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; }
      body { font-family: -apple-system, Arial, sans-serif; color: #1a2433; background: #eceff3; }
      .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 28px 34px 34px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
      @media screen { body { padding: 14px; } }
      @media print { body { background: #fff; padding: 0; } .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; } }
      .hdr { border-bottom: 2px solid #B0894F; padding-bottom: 14px; text-align: center; }
      .logo { max-height: 84px; max-width: 290px; object-fit: contain; display: block; margin: 0 auto 10px; }
      .marca { font-size: 17px; font-weight: 800; color: #0F1B2D; }
      .tipo { font-size: 10px; font-weight: 700; color: #B0894F; letter-spacing: .18em; text-transform: uppercase; margin-top: 3px; }
      .barra { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; font-size: 11.5px; color: #5B6B7F; margin: 14px 0 16px; padding-bottom: 10px; border-bottom: 1px solid #E3E8EF; }
      .barra b { color: #0F1B2D; }
      .grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 4px; }
      .grid > div { flex: 1 1 45%; background: rgba(255,255,255,.04); border: 1px solid #E3E8EF; border-radius: 8px; padding: 8px 11px; }
      .grid span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #94A3B8; margin-bottom: 2px; }
      .grid b { font-size: 12.5px; color: #0F1B2D; }
      h2 { font-size: 11.5px; color: #1B3A5B; text-transform: uppercase; letter-spacing: .04em; margin: 18px 0 8px; padding-left: 9px; border-left: 3px solid #B0894F; }
      table { width: 100%; border-collapse: collapse; }
      th { background: rgba(255,255,255,.06); font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; color: #1B3A5B; text-align: left; padding: 7px 9px; border: 1px solid #E3E8EF; }
      td { font-size: 11.5px; padding: 7px 9px; border: 1px solid #E3E8EF; vertical-align: top; line-height: 1.45; }
      ul { margin: 0; padding-left: 20px; } li { font-size: 12px; line-height: 1.55; margin-bottom: 3px; }
      .vacio { font-size: 11.5px; color: #98A2B3; font-style: italic; }
      .parr { font-size: 12px; line-height: 1.6; text-align: justify; }
      .decl { font-size: 12.5px; line-height: 1.65; text-align: justify; background: rgba(255,255,255,.04); border: 1px solid #E3E8EF; border-left: 3px solid #B0894F; border-radius: 8px; padding: 11px 13px; margin: 14px 0 4px; }
      .res { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; border-radius: 6px; padding: 5px 12px; margin-top: 14px; color: ${colorRes}; border: 1.5px solid ${colorRes}; }
      .firmas { display: flex; gap: 40px; margin-top: 34px; page-break-inside: avoid; }
      .firma { flex: 1; text-align: center; }
      .linea { border-top: 1px solid #0F1B2D; margin-bottom: 5px; }
      .rol { font-size: 10px; color: #5B6B7F; }
      .foot { margin-top: 22px; font-size: 9px; color: #98A2B3; text-align: center; border-top: 1px solid #E3E8EF; padding-top: 8px; }
      .fotos { display: flex; flex-wrap: wrap; gap: 8px; }
      .fotos img { width: 130px; height: 130px; object-fit: cover; border-radius: 6px; border: 1px solid #E3E8EF; }
    </style></head><body><div class="sheet">
      <div class="hdr">${logo ? `<img class="logo" src="${logo}" />` : ""}<div class="marca">${marca}</div><div class="tipo">${_e(t.titulo)}</div></div>
      <div class="barra"><div>Obra: <b>${_e(nomObra)}</b></div><div>N°: <b>${_e(it.nro || "—")}</b></div><div>Fecha: <b>${fmtDMY(it.fecha)}</b></div></div>
      ${cuerpo}
      ${(() => {
        const fotos = it.fotos || [];
        if (!fotos.length) return "";
        const buenas = fotos.filter(f => f.url && (f.url.startsWith("http://") || f.url.startsWith("https://"))).slice(0, 8);
        const sinSubir = fotos.length - buenas.length;
        return `<h2>Fotos</h2>
          ${buenas.length ? `<div class="fotos">${buenas.map(f => `<img src="${f.url}" />`).join("")}</div>` : ""}
          ${sinSubir > 0 ? `<div class="vacio">${sinSubir} foto(s) no incluida(s) en el PDF: no se terminaron de subir a la nube desde el dispositivo de origen.</div>` : ""}`;
      })()}
      <div class="res">Resultado: ${_e(it.resultado || "—")}</div>
      ${it.conclusion ? `<h2>Conclusión</h2><div class="parr">${_e(it.conclusion)}</div>` : ""}
      <div class="firmas">
        <div class="firma"><div class="linea"></div><div class="rol">${_e(it.responsable || "Responsable técnico")}<br/>${marca}</div></div>
        <div class="firma"><div class="linea"></div><div class="rol">Jefatura de Obra / Dirección de Obra</div></div>
      </div>
      <div class="foot">Documento emitido por ${marca} · ${_e(t.titulo)} · ${_e(it.nro || "")}</div>
    </div></body></html>`;
  }
  return (<div style={{ flex: 1, overflowY: "auto" }}>
    <AppHeader title="Auditoría de obra" sub="Supervisiones y controles cargados por V+V" />
    <div style={{ padding: "14px 18px" }}>
      {listaSemana.length > 0 && <div onClick={() => setSoloSemana(v => !v)} style={{ display: "flex", alignItems: "center", gap: 10, background: soloSemana ? T.navy : T.accentLight, border: `1px solid ${soloSemana ? T.navy : BRASS}`, borderRadius: T.rsm, padding: "10px 13px", marginBottom: 12, cursor: "pointer" }}>
        <span style={{ width: 24, height: 24, borderRadius: "50%", background: BRASS, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{listaSemana.length}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: soloSemana ? "#fff" : T.text, flex: 1 }}>{soloSemana ? "Viendo solo lo nuevo de esta semana" : "Nuevas esta semana — tocá para verlas todas juntas"}</span>
        <span style={{ fontSize: 11, color: soloSemana ? "#fff" : BRASS, fontWeight: 700 }}>{soloSemana ? "Ver todo ▾" : "Ver ▸"}</span>
      </div>}
      {!soloSemana && <>
      <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
        {AUD_TIPOS_CLI.map(t => (
          <button key={t.id} onClick={() => setTipo(t.id)} style={{ flex: 1, background: tipo === t.id ? T.navy : T.card, color: tipo === t.id ? "#fff" : T.sub, border: `1px solid ${tipo === t.id ? T.navy : T.border}`, borderRadius: T.rsm, padding: "9px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{t.label}</button>
        ))}
      </div>
      <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 13, color: T.text, marginBottom: 14 }}>
        <option value="">Todas las obras</option>
        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
      </>}

      {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "26px 16px", lineHeight: 1.6 }}>{soloSemana ? "No hay auditorías nuevas esta semana." : `Todavía no hay ${tp.label.toLowerCase()} cargadas.`}</div>}
      {lista.map(it => {
        const abiertoAqui = abierto === it.id;
        const tipoLbl = (AUD_TIPOS_CLI.find(t => t.id === it.tipo) || {}).label;
        return (<div key={it.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${BRASS}`, borderRadius: 12, padding: 12, marginBottom: 9, boxShadow: T.shadow }}>
          <div onClick={() => setAbierto(abiertoAqui ? null : it.id)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: BRASS }}>{it.nro}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text, flex: 1, minWidth: 0 }}>{nombreObra(it.obra_id)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: it.resultado === "No conforme" ? "#B91C1C" : it.resultado === "Conforme con observaciones" ? "#B45309" : "#15803D" }}>{it.resultado}</span>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{soloSemana && tipoLbl ? `${tipoLbl} · ` : ""}{fmtDMY(it.fecha)}{it.periodo ? ` · ${it.periodo}` : ""} · {(it.obs || []).length} observación(es)</div>
          {abiertoAqui && (<div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
            {it.presentes && <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}><b style={{ color: T.text }}>Presentes:</b> {it.presentes}</div>}
            {(it.obs || []).length > 0 && (<div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 4 }}>Observaciones</div>
              {it.obs.map((o, i) => <div key={i} style={{ fontSize: 12, color: T.sub, marginBottom: 4, lineHeight: 1.4 }}>· {o.txt} {o.sector ? `(${o.sector})` : ""} {o.crit ? `— ${o.crit}` : ""}</div>)}
            </div>)}
            {(it.interferencias || []).length > 0 && (<div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 4 }}>Interferencias</div>
              {it.interferencias.map((x, i) => <div key={i} style={{ fontSize: 12, color: T.sub, marginBottom: 4 }}>· {x}</div>)}
            </div>)}
            {it.conclusion && <div style={{ fontSize: 12, color: T.sub, marginBottom: 8, lineHeight: 1.4 }}><b style={{ color: T.text }}>Conclusión:</b> {it.conclusion}</div>}
            {it.responsable && <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 8 }}>Responsable técnico: {it.responsable}</div>}
            {(it.fotos || []).length > 0 && (<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {it.fotos.map((f, i) => <a key={f.id || i} href={f.url} target="_blank" rel="noreferrer" style={{ width: 74, height: 74, borderRadius: 9, overflow: "hidden", border: `1px solid ${T.border}` }}>
                <img src={f.url} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </a>)}
            </div>)}
            <button onClick={() => setPdfHtml(buildPdf(it))} style={{ marginTop: 10, background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 8, padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ver PDF</button>
          </div>)}
        </div>);
      })}
    </div>

    {pdfHtml && <div style={{ position: "fixed", inset: 0, background: "#1a2433", zIndex: 320, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", rowGap: 8, padding: `calc(10px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 14px 10px`, background: "#0F1B2D", flexShrink: 0, position: "relative", zIndex: 2 }}>
        <button onClick={() => setPdfHtml(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>‹ Volver</button>
        <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, flex: "1 1 auto", textAlign: "center", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Certificado</span>
        <button onClick={() => { const f = document.getElementById("aud-cli-pdf"); if (f?.contentWindow) f.contentWindow.print(); }} style={{ background: BRASS, border: "none", color: "#fff", borderRadius: 8, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>Guardar / Imprimir</button>
      </div>
      <iframe id="aud-cli-pdf" srcDoc={pdfHtml} title="Certificado auditoría" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
    </div>}
  </div>);
}
function BitacoraView({ T, obras, bitacora, setBitacora, cfg }) {
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [abrir, setAbrir] = useState(false);
  const [edit, setEdit] = useState(null); // hecho en edición
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  const [fotos, setFotos] = useState([]);
  const [adjuntos, setAdjuntos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [pdfHtml, setPdfHtml] = useState(null);
  const fileRef = useRef(null);
  const adjRef = useRef(null);

  const obra = obras.find(o => o.id === obraId);
  const hechos = bitacora.filter(h => h.obra_id === obraId).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.ts || 0) - (a.ts || 0)));

  const limpiar = () => { setFecha(new Date().toISOString().slice(0, 10)); setTitulo(""); setDesc(""); setFotos([]); setAdjuntos([]); setEdit(null); setAbrir(false); };
  const editarHecho = (h) => { setEdit(h); setFecha(h.fecha); setTitulo(h.titulo); setDesc(h.desc); setFotos(h.fotos || []); setAdjuntos(h.adjuntos || []); setAbrir(true); };

  const agregarFotos = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setSubiendo(true);
    const nuevas = [];
    for (const f of files) {
      try {
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const comp = await compressImage(dataUrl, 1600, 0.7);
        const url = await uploadArchivo(comp, `bitacora/${obraId}`, `${uid()}.jpg`);
        if (url) nuevas.push({ id: uid(), url });
      } catch { }
    }
    setFotos(prev => [...prev, ...nuevas]);
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  async function agregarAdjuntos(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    if (!obraId) { alert("Elegí una obra primero."); return; }
    setSubiendo(true);
    try {
      const nuevos = [];
      for (const f of files) {
        if (f.size > 12 * 1024 * 1024) { alert(`"${f.name}" pesa más de 12 MB. Subí uno más liviano.`); continue; }
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const ext = (f.name.match(/\.([a-zA-Z0-9]+)$/) || [])[1] || "dat";
        const url = await uploadArchivo(dataUrl, `bitacora/${obraId}/adj`, `${uid()}.${ext}`);
        nuevos.push({ id: uid(), nombre: f.name, url: url || dataUrl, tipo: f.type || "", peso: f.size });
      }
      setAdjuntos(prev => [...prev, ...nuevos]);
    } catch (err) { alert("No pude subir el archivo. Probá de nuevo."); }
    setSubiendo(false);
    if (adjRef.current) adjRef.current.value = "";
  }
  const iconoArch = (nom = "", tipo = "") => { const e = (nom.split(".").pop() || "").toLowerCase(); if (["doc", "docx"].includes(e)) return ""; if (e === "pdf") return ""; if (["xls", "xlsx", "csv"].includes(e)) return ""; if (["png", "jpg", "jpeg", "webp", "heic"].includes(e)) return ""; return ""; };
  const guardar = () => {
    if (!titulo.trim() && !desc.trim()) { alert("Poné al menos un título o una descripción."); return; }
    if (!obraId) { alert("Elegí una obra."); return; }
    const hecho = { id: edit?.id || uid(), obra_id: obraId, fecha, titulo: titulo.trim(), desc: desc.trim(), fotos, adjuntos, ts: edit?.ts || Date.now() };
    setBitacora(prev => { const otros = (prev || []).filter(h => h.id !== hecho.id); return [...otros, hecho]; });
    limpiar();
  };
  const borrar = (id) => { if (confirm("¿Borrar este hecho de la bitácora?")) setBitacora(prev => (prev || []).filter(h => h.id !== id)); };

  const exportarPDF = () => {
    if (!obra) return;
    const marca = "V+V CONSTRUCCIONES";
    const hoy = hoyStr();
    const items = hechos.map((h, i) => {
      const fFmt = h.fecha ? h.fecha.split("-").reverse().join("/") : "";
      const fotosH = (h.fotos || []).map(ft => `<img src="${ft.url}" />`).join("");
      return `<div class="hecho">
        <div class="hh"><span class="num">${hechos.length - i}</span><span class="fecha">${fFmt}</span><span class="tit">${(h.titulo || "").replace(/</g, "&lt;")}</span></div>
        ${h.desc ? `<div class="desc">${(h.desc || "").replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</div>` : ""}
        ${fotosH ? `<div class="fotos">${fotosH}</div>` : ""}
        ${(h.adjuntos || []).length ? `<div class="adj"><b>Adjuntos:</b> ${(h.adjuntos || []).map(a => (a.nombre || "").replace(/</g, "&lt;")).join(" · ")}</div>` : ""}
      </div>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      @page { margin: 14mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; }
      body { font-family: -apple-system, Arial, sans-serif; color: #1a2433; background: #eceff3; }
      .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 26px 30px 34px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
      @media screen { body { padding: 14px; } }
      @media print { body { background: #fff; padding: 0; } .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; } }
      .hdr { border-bottom: 2px solid #B0894F; padding-bottom: 10px; margin-bottom: 14px; }
      .marca { font-size: 17px; font-weight: 800; color: #0F1B2D; letter-spacing: -.01em; }
      .tipo { font-size: 10px; font-weight: 700; color: #B0894F; letter-spacing: .18em; text-transform: uppercase; margin-top: 2px; }
      .meta { font-size: 11px; color: #5B6B7F; margin-top: 8px; }
      h1 { font-size: 15px; color: #0F1B2D; margin: 4px 0 2px; }
      .hecho { border: 1px solid #E3E8EF; border-left: 3px solid #1B3A5B; border-radius: 8px; padding: 11px 13px; margin-bottom: 11px; page-break-inside: avoid; }
      .hh { display: flex; align-items: baseline; gap: 9px; margin-bottom: 5px; flex-wrap: wrap; }
      .num { background: #0F1B2D; color: #fff; font-size: 10px; font-weight: 800; border-radius: 20px; padding: 1px 8px; }
      .fecha { font-size: 11px; font-weight: 800; color: #B0894F; }
      .tit { font-size: 13.5px; font-weight: 700; color: #0F1B2D; }
      .desc { font-size: 12px; color: #1a2433; line-height: 1.5; white-space: normal; }
      .adj { font-size: 10.5px; color: #1B3A5B; background: rgba(255,255,255,.06); border: 1px solid #E3E8EF; border-radius: 6px; padding: 6px 9px; margin-top: 8px; }
      .fotos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
      .fotos img { width: 150px; height: 112px; object-fit: cover; border-radius: 6px; border: 1px solid #E3E8EF; }
      .foot { margin-top: 16px; font-size: 9.5px; color: #98A2B3; text-align: center; border-top: 1px solid #E3E8EF; padding-top: 8px; }
      .vacio { font-size: 12px; color: #98A2B3; text-align: center; padding: 30px; }
    </style></head><body><div class="sheet">
      <div class="hdr">
        <div class="marca">${marca}</div>
        <div class="tipo">Historial de obra · Bitácora</div>
        <h1>${(obra.nombre || "").replace(/</g, "&lt;")}</h1>
        <div class="meta">Comitente: ${(cfg?.comitente || "Belfast Construction Management")} · Emitido: ${hoy} · ${hechos.length} hecho${hechos.length !== 1 ? "s" : ""} registrado${hechos.length !== 1 ? "s" : ""}</div>
      </div>
      ${items || '<div class="vacio">Todavía no hay hechos cargados en esta obra.</div>'}
      <div class="foot">Documento generado por ${marca} para respaldo y justificación de adicionales de obra.</div>
    </div></body></html>`;
    setPdfHtml(html);
  };

  const inp = { width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "11px 12px", fontSize: 14, color: T.text, boxSizing: "border-box" };

  // ── Lo del día, de TODAS las obras juntas ──────────────────────────
  // Lo primero que se ve al entrar: qué se cargó hoy, en qué obra y a qué
  // hora. Así no hay que ir obra por obra buscando qué hay nuevo.
  const hoyISO = new Date().toISOString().slice(0, 10);
  const mismaFecha = (h) => {
    if (h.fecha === hoyISO) return true;
    if (h.ts) { try { return new Date(h.ts).toISOString().slice(0, 10) === hoyISO; } catch { } }
    return false;
  };
  const delDia = (bitacora || []).filter(mismaFecha).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  // Horario de 24 h (16:45, no "04:45 p. m.") — es como se usa en obra.
  const horaDe = (h) => { try { return new Date(h.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }); } catch { return ""; } };
  const nombreObra = (id) => obras.find(o => o.id === id)?.nombre || "Sin obra";

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <div style={{ padding: "14px 18px 4px", flexShrink: 0 }}><div style={{ fontSize: 10, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.12em" }}>Registro diario</div><div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Bitácora de obra</div><div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Lo que va pasando en obra, día por día</div></div>
    <div style={{ padding: "16px 20px" }}>
      {/* Lo cargado hoy, de todas las obras */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${BRASS}`, borderRadius: 12, padding: 14, marginBottom: 16, boxShadow: T.shadow }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: delDia.length ? 10 : 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>Hoy en todas las obras</div>
          <div style={{ fontSize: 11, color: T.muted }}>{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        {delDia.length === 0
          ? <div style={{ fontSize: 12.5, color: T.muted, marginTop: 8 }}>Todavía no se cargó nada hoy.</div>
          : delDia.map(h => (<div key={h.id} onClick={() => setObraId(h.obra_id)} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderTop: `1px solid ${T.border}`, cursor: "pointer" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: BRASS, flexShrink: 0, minWidth: 42, fontVariantNumeric: "tabular-nums" }}>{horaDe(h)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{h.titulo || h.desc?.slice(0, 60) || "(sin título)"}</div>
              <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{nombreObra(h.obra_id)}{h.etapa ? ` · ${h.etapa}` : ""}</div>
            </div>
            {(h.fotos || []).length > 0 && <div style={{ fontSize: 10.5, color: T.muted, flexShrink: 0 }}>📷 {(h.fotos || []).length}</div>}
          </div>))}
      </div>

      {/* selector de obra */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <select value={obraId} onChange={e => { setObraId(e.target.value); limpiar(); }} style={{ ...inp, flex: 1 }}>
          <option value="">— Elegí una obra —</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        {obraId && hechos.length > 0 && <button onClick={exportarPDF} style={{ background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 8, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>PDF</button>}
      </div>

      {obraId && <>
        {/* botón nuevo / formulario */}
        
        {abrir && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 14, boxShadow: T.shadow }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>{edit ? "Editar hecho" : "Nuevo hecho"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: T.sub, width: 46 }}>Fecha</span>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, flex: 1 }} />
            </div>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título (ej: Cambio de nivel de platea)" style={inp} />
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción: qué pasó, por qué, quién lo pidió, qué implica…" rows={4} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
            {/* fotos */}
            {fotos.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {fotos.map(ft => (
                <div key={ft.id} style={{ position: "relative" }}>
                  <img src={ft.url} style={{ width: 66, height: 66, borderRadius: 8, objectFit: "cover", border: `1px solid ${T.border}` }} />
                  <button onClick={() => setFotos(prev => prev.filter(x => x.id !== ft.id))} style={{ position: "absolute", top: -6, right: -6, background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer", lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>}
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={agregarFotos} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={subiendo} style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{subiendo ? "Subiendo…" : "Agregar fotos"}</button>
            {adjuntos.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {adjuntos.map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
                  <span style={{ fontSize: 14 }}>{iconoArch(a.nombre, a.tipo)}</span>
                  <span style={{ flex: 1, fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
                  <button onClick={() => setAdjuntos(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", color: T.muted, fontSize: 14, cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>}
            <input ref={adjRef} type="file" multiple onChange={agregarAdjuntos} style={{ display: "none" }} />
            <button onClick={() => adjRef.current?.click()} disabled={subiendo} style={{ background: T.bg, border: `1px solid ${BRASS}`, color: T.text, borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{subiendo ? "Subiendo…" : "Adjuntar archivo (Word, PDF, Excel…)"}</button>
            <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
              <button onClick={limpiar} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={subiendo} style={{ flex: 2, background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{edit ? "Guardar cambios" : "Guardar hecho"}</button>
            </div>
          </div>
        </div>}

        {/* lista de hechos */}
        {hechos.length === 0 && !abrir && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "30px 18px" }}>Todavía no hay hechos cargados en esta obra. Los carga V+V desde su app.</div>}
        {hechos.map((h, i) => (
          <div key={h.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.accent}`, borderRadius: 12, padding: 13, marginBottom: 10, boxShadow: T.shadow }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: T.navy, borderRadius: 20, padding: "1px 8px", flexShrink: 0 }}>{hechos.length - i}</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: BRASS, flexShrink: 0 }}>{h.fecha ? h.fecha.split("-").reverse().join("/") : ""}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text, flex: 1, minWidth: 0 }}>{h.titulo}</span>
              {h.etapa && <span style={{ fontSize: 9.5, fontWeight: 700, color: T.accent, background: T.al, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>{h.etapa}</span>}
            </div>
            {h.desc && <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: (h.fotos || []).length ? 9 : 0 }}>{h.desc}</div>}
            {(h.fotos || []).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {h.fotos.map(ft => <img key={ft.id} src={ft.url} style={{ width: 76, height: 76, borderRadius: 8, objectFit: "cover", border: `1px solid ${T.border}` }} />)}
            </div>}
            {(h.adjuntos || []).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {h.adjuntos.map(a => <button key={a.id} onClick={() => window.open(a.url, "_blank")} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", maxWidth: "100%" }}><span>{iconoArch(a.nombre, a.tipo)}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span></button>)}
            </div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            
            </div>
          </div>
        ))}
      </>}
      {!obraId && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "40px 18px" }}>Elegí una obra para empezar la bitácora.</div>}
    </div>

    {/* overlay PDF */}
    {pdfHtml && <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 500, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 8, padding: `calc(10px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 14px 10px`, background: T.navy, flexShrink: 0, position: "relative", zIndex: 2 }}>
        <button onClick={() => setPdfHtml(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>‹ Volver</button>
        <button onClick={() => { const f = document.getElementById("bita-pdf"); if (f?.contentWindow) f.contentWindow.print(); }} style={{ background: BRASS, border: "none", color: "#fff", borderRadius: 8, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>Guardar / Imprimir</button>
      </div>
      <iframe id="bita-pdf" srcDoc={pdfHtml} title="Bitácora PDF" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
    </div>}
  </div>);
}



// ─── Gestión de Obras (mismo componente que V+V) ───
// ══════════════════════════════════════════════════════════════════

const SUPA_URL_OG = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY_OG = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const SUPA_BUCKET_OG = "bco-media";
const SUPA_STORAGE_URL_OG = SUPA_URL_OG + "/storage/v1";


const mediaStorage_OG = {
    // Subir un archivo (recibe dataURL base64) → devuelve URL pública
    upload: async (path, dataUrl) => {
        try {
            // Convertir dataURL a Blob
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const ext = blob.type.split('/')[1] || 'jpg';
            const filePath = `${path}.${ext}`;

            // Subir al bucket
            const r = await fetch(`${SUPA_STORAGE_URL_OG}/object/${SUPA_BUCKET_OG}/${filePath}`, {
                method: "POST",
                headers: {
                    "apikey": SUPA_KEY_OG,
                    "Authorization": "Bearer " + SUPA_KEY_OG,
                    "Content-Type": blob.type,
                    "x-upsert": "true"
                },
                body: blob
            });
            if (!r.ok) return null;
            // Devolver URL pública
            return `${SUPA_STORAGE_URL_OG}/object/public/${SUPA_BUCKET_OG}/${filePath}`;
        } catch { return null; }
    },
    // Eliminar archivo del bucket
    remove: async (path) => {
        try {
            await fetch(`${SUPA_STORAGE_URL_OG}/object/${SUPA_BUCKET_OG}/${path}`, {
                method: "DELETE",
                headers: { "apikey": SUPA_KEY_OG, "Authorization": "Bearer " + SUPA_KEY_OG }
            });
        } catch { }
    },
    // Detectar si una URL es del bucket (ya subida) o base64 local
    isRemoteUrl: (url) => url && (url.startsWith('http://') || url.startsWith('https://')),
};

async function uploadFoto(dataUrl, carpeta, nombre) {
    if (!dataUrl) return null;
    // Si ya es URL remota, no re-subir
    if (mediaStorage_OG.isRemoteUrl(dataUrl)) return dataUrl;
    const path = `${carpeta}/${nombre || uid_OG()}`;
    const remoteUrl = await mediaStorage_OG.upload(path, dataUrl);
    return remoteUrl || dataUrl; // fallback a base64 si falla
}

function compressImage(dataUrl, maxDim = 1600, quality = 0.7) {
    return new Promise((resolve) => {
        try {
            if (!dataUrl || !dataUrl.startsWith("data:image")) { resolve(dataUrl); return; }
            const img = new Image();
            img.onload = () => {
                try {
                    let { width, height } = img;
                    if (width > maxDim || height > maxDim) {
                        if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
                        else { width = Math.round(width * maxDim / height); height = maxDim; }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/jpeg", quality));
                } catch { resolve(dataUrl); }
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        } catch { resolve(dataUrl); }
    });
}

const DEFAULT_UBICACIONES = [{ id: "norte", code: "NORTE", name: "Zona Norte" }, { id: "sur", code: "SUR", name: "Zona Sur" }, { id: "oeste", code: "OESTE", name: "Zona Oeste" }, { id: "caba", code: "CABA", name: "Ciudad de Buenos Aires" }];

const DEFAULT_TEXTOS = {
    nav_ia: "IA", nav_inicio: "Inicio", nav_obras: "Obras", nav_personal: "Personal", nav_cargar: "Cargar", nav_mas: "Más", nav_privado: "Privado",
    dash_titulo: "Panel operativo", dash_subtitulo: "V+V Construcciones",
    dash_proyectoes: "Proyectos", dash_obras_activas: "Obras activas", dash_alertas: "Alertas", dash_personal: "Personal",
    dash_obras_curso: "Obras en curso", dash_ver_todas: "Ver todas →", dash_acciones: "Acciones rápidas",
    dash_nueva_lic: "Nueva proyecto", dash_nueva_obra: "Nueva obra", dash_presup_mat: "Presupuesto materiales", dash_subcontratos: "Subcontratos",
    obras_titulo: "Obras", obras_nueva: "Nueva obra", obras_avance: "Avance", obras_inicio: "Inicio", obras_cierre: "Cierre est.",
    obras_sector: "Sector", obras_estado: "Estado", obras_info: "Info", obras_notas: "Notas", obras_fotos: "Fotos", obras_archivos: "Archivos",
    obras_obs_placeholder: "Registrar observación...", obras_sin_notas: "Sin notas", obras_sin_fotos: "Sin fotos", obras_sin_archivos: "Sin archivos",
    obras_agregar_fotos: "Agregar fotos", obras_agregar_arch: "Agregar archivo", obras_eliminar: "Eliminar obra",
    lic_titulo: "Proyectos", lic_nueva: "Nueva proyecto", lic_nombre: "Nombre", lic_monto: "Monto", lic_fecha: "Fecha", lic_sector: "Sector",
    lic_crear: "Crear proyecto", lic_eliminar: "Eliminar",
    pers_titulo: "Personal de Obra", pers_nuevo: "Nuevo trabajador", pers_nombre: "Nombre", pers_rol: "Rol", pers_empresa: "Empresa",
    pers_obra: "Obra", pers_whatsapp: "WhatsApp", pers_documentacion: "Documentación", pers_sin_personal: "Sin personal registrado",
    pers_eliminar: "Eliminar trabajador", pers_agregar: "Agregar",
    carg_titulo: "Registro de Avance", carg_sub: "Fotos + Informe IA", carg_sel_obra: "Seleccioná la obra",
    carg_fotos: "Cargá fotos nuevas", carg_tomar: "Tomar foto", carg_galeria: "Galería / PC",
    carg_generar: "Comparar y generar informe", carg_analizando: "Analizando...",
    carg_informe: "Informe generado", carg_nuevo: "+ Nuevo", carg_descargar: "⬇ Descargar",
    chat_titulo: "IA", chat_placeholder: "Escribí o usá el micrófono…",
    chat_hablar: "Hablar", chat_escuchando: "Escuchando…", chat_pausar: "Pausar", chat_voz_auto: "Voz auto",
    mas_titulo: "Más opciones", mas_config: "Configuración", mas_config_sub: "Estética · Logos · Empresa · Admin",
    mas_cerrar_sesion: "Cerrar sesión",
    cfg_cuenta: "Cuenta y empresa", cfg_tema: "Tema visual", cfg_tipografia: "Tipografía",
    cfg_forma: "Forma de los elementos", cfg_logos: "Logos y textos", cfg_textos: "Textos de la app",
    cfg_guardar: "✓ Guardar y cerrar", cfg_restaurar: "↺ Restaurar tema por defecto",
};

const OBRA_ESTADOS = [{ id: "pendiente", label: "Pendiente", color: "#94A3B8", bg: "rgba(255,255,255,.04)" }, { id: "curso", label: "En Curso", color: "#6FCF97", bg: "rgba(111,207,151,.14)" }, { id: "pausada", label: "Pausada", color: "#D9B27C", bg: "rgba(180,83,9,.14)" }, { id: "terminada", label: "Terminada", color: "#8B93F5", bg: "rgba(99,102,241,.14)" }];

function t(cfg, key) { return cfg?.textos?.[key] || DEFAULT_TEXTOS[key] || key; }
function getLabelUbic(cfg) { return cfg?.labelUbicacion || "Zona/Barrio"; }

// ── helpers extra para la ficha/form ──
async function callAI_OG(msgs, sys, apiKey, useSearch = false) {
    msgs = (msgs || []).map(m => ({ role: m.role, content: m.content }));
    const body = {
        model: "claude-sonnet-5",
        thinking: { type: "disabled" },
        max_tokens: useSearch ? 4096 : 4096,
        messages: msgs,
    };
    if (sys) body.system = sys;
    if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", city: "Buenos Aires", region: "Buenos Aires", country: "AR", timezone: "America/Argentina/Buenos_Aires" } }];

    // Intenta primero el proxy serverless (/api/claude, clave del lado del servidor).
    // Si no existe (hosting estático) cae a la API directa con la key de Configuración.
    async function doFetch(b) {
        try {
            const rp = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
            if (rp.ok) return { ok: true, data: await rp.json() };
            if (rp.status !== 404) {
                try { const e = await rp.json(); return { ok: false, err: e.error?.message || `Error ${rp.status}` }; } catch { return { ok: false, err: `Error ${rp.status}` }; }
            }
        } catch { /* sin proxy: seguimos al modo directo */ }
        if (!apiKey) return { ok: false, err: "⚠ Falta configurar la IA: agregá la API Key en Más → Configuración, o configurá el proxy (variable ANTHROPIC_API_KEY en Vercel)." };
        const headers = { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true", "anthropic-version": "2023-06-01", "x-api-key": apiKey };
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(b) });
        if (!r.ok) { try { const e = await r.json(); return { ok: false, err: e.error?.message || `Error ${r.status}` }; } catch { return { ok: false, err: `Error ${r.status}` }; } }
        return { ok: true, data: await r.json() };
    }

    try {
        const res = await doFetch(body);
        if (!res.ok) return res.err;
        let d = res.data;
        if (d.error) return `Error: ${d.error.message || 'Sin respuesta.'}`;
        // La búsqueda web es del lado del servidor (Anthropic la ejecuta sola).
        // Si la respuesta queda en pausa, se continúa reenviando lo acumulado.
        let guard = 0;
        while (d.stop_reason === 'pause_turn' && guard < 4) {
            guard++;
            const cont = await doFetch({ ...body, messages: [...msgs, { role: 'assistant', content: d.content }] });
            if (!cont.ok || cont.data?.error) break;
            d = cont.data;
        }
        const txt = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        return txt || 'Sin respuesta.';
    } catch (e) {
        return `Error de conexión: ${e.message || 'Revisá la configuración de la IA.'}`;
    }
}
async function descargarArchivo_OG(url, nombre) {
    const r = await abrirArchivo(url, nombre);
    if (!r.ok) alert("Este archivo todavía no está guardado en este dispositivo.\n\nAbrilo una vez con conexión y, de ahí en adelante, se va a poder ver sin internet.");
    return r.ok;
}
function formatMonto(val) {
    const nums = String(val).replace(/[^\d]/g, '');
    if (!nums) return '';
    return nums.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' $';
}
function parseMonto(val) { return String(val).replace(/[^\d]/g, ''); }
function parseMontoNum_OG(m) {
  // OJO: en Argentina el punto es separador de MILES y la coma es el decimal.
  // Antes hacía parseFloat("120.000.000") -> 120 (tomaba el punto como decimal):
  // un presupuesto de 120 millones se leía como 120 pesos.
  if (m == null || m === "") return 0;
  if (typeof m === "number") return isFinite(m) ? m : 0;
  let s = String(m).replace(/[^0-9.,-]/g, "");   // saco $, espacios, letras
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");  // 1.234.567,89 -> 1234567.89
  } else {
    s = s.replace(/\./g, "");                    // 1.234.567 -> 1234567
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function getBase64(d) { return d.split(',')[1]; }
function getMediaType(d) { const m = d.match(/data:([^;]+);/); return m ? m[1] : 'image/jpeg'; }
function toDataUrl(f, maxW = 1400) {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => {
            if (!f.type.startsWith('image/')) { res(e.target.result); return; }
            const img = new Image();
            img.onload = () => {
                if (img.width <= maxW) { res(e.target.result); return; }
                const c = document.createElement('canvas');
                const ratio = maxW / img.width;
                c.width = maxW; c.height = Math.round(img.height * ratio);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                res(c.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => res(e.target.result);
            img.src = e.target.result;
        };
        reader.onerror = rej;
        reader.readAsDataURL(f);
    });
}

function getUbics(cfg) { return (cfg?.ubicaciones?.length ? cfg.ubicaciones : DEFAULT_UBICACIONES); }

function uid_OG() { return Math.random().toString(36).slice(2, 9); }

const money_OG = (n) => (Number(n) || 0).toLocaleString("es-AR") + " $";

const hoyStr_OG = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`; };

const T = { bg: "var(--bg,#0d0d0f)", card: "var(--card,#111214)", border: "var(--border,#232227)", text: "var(--text,#f2f0eb)", sub: "var(--sub,#B8B5AE)", muted: "var(--muted,#7A776F)", accent: "var(--accent,#B0894F)", accentLight: "var(--al,rgba(176,137,79,.14))", navy: "var(--navy,#0d0d0f)", r: "var(--r,14px)", rsm: "var(--rsm,10px)", shadow: "0 1px 2px rgba(0,0,0,.2),0 10px 30px rgba(0,0,0,.35)" };

function Card_OG({ children, style = {}, onClick }) { return <div onClick={onClick} style={{ background: T.card, borderRadius: T.r, border: `1px solid ${T.border}`, boxShadow: T.shadow, ...style }}>{children}</div>; }
function Badge_OG({ color, bg, children, style = {} }) { return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 20, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.04em", ...style }}>{children}</span>; }
function PBtn_OG({ children, onClick, disabled, full, style = {}, variant = "primary" }) {
    const v = { primary: { background: disabled ? "rgba(255,255,255,.08)" : "var(--accent,#B0894F)", color: disabled ? "#7A776F" : "#fff", boxShadow: disabled ? "none" : "0 2px 8px rgba(0,0,0,.18)", border: "none" }, ghost: { background: "none", border: `1.5px solid ${T.border}`, color: T.sub, boxShadow: "none" }, danger: { background: "rgba(239,68,68,.10)", border: "1.5px solid rgba(239,68,68,.30)", color: "#EF4444", boxShadow: "none" } };
    return <button onClick={onClick} disabled={disabled} style={{ ...v[variant], borderRadius: T.rsm, padding: "11px 20px", fontSize: 14, fontWeight: 600, width: full ? "100%" : "auto", transition: "all .15s", ...style }}>{children}</button>;
}
function Sheet({ title, onClose, children }) { return (<div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 200, display: "flex", alignItems: "flex-end", backdropFilter: "blur(2px)" }}><div style={{ background: T.card, borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "90vh", overflow: "auto", animation: "up .25s ease", paddingBottom: 32 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}><span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{title}</span><button onClick={onClose} style={{ background: T.bg, border: "none", borderRadius: 20, width: 32, height: 32, fontSize: 18, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button></div><div style={{ padding: "14px 20px 0" }}>{children}</div></div></div>); }
function Lbl({ children }) { return <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{children}</div>; }
function TInput({ value, onChange, placeholder, type = "text", extraStyle = {} }) { return <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text, ...extraStyle }} />; }
function Sel({ value, onChange, children }) { return <select value={value} onChange={onChange} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }}>{children}</select>; }
function FieldRow({ children }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>{children}</div>; }
function Field({ label, children }) { return <div style={{ marginBottom: 12 }}><Lbl>{label}</Lbl>{children}</div>; }
function PlusBtn({ onClick }) { return <button onClick={onClick} style={{ background: "var(--accent,#B0894F)", color: "#fff", border: "none", borderRadius: 20, width: 34, height: 34, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>+</button>; }
function AppHeader({ title, sub, right, back, onBack }) { return (<div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "12px 18px", flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{back && <button onClick={onBack} style={{ background: T.bg, border: "none", borderRadius: 10, width: 32, height: 32, fontSize: 16, color: T.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>}<div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>{title}</div>{sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{sub}</div>}</div>{right}</div></div>); }

function MontoInput({ value, onChange, placeholder }) {
    const [display, setDisplay] = useState(value ? formatMonto(parseMonto(value)) : value || '');
    useEffect(() => { setDisplay(value ? formatMonto(parseMonto(value)) : value || ''); }, [value]);
    function handleChange(e) {
        const raw = parseMonto(e.target.value);
        const fmt = raw ? formatMonto(raw) : '';
        setDisplay(fmt);
        onChange(fmt);
    }
    return <input value={display} onChange={handleChange} placeholder={placeholder || '0 $'} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} />;
}

function TabFotos({ detail, upd, fileRef, handleFoto, videoRef, handleVideo, apiKey, cfg }) {
    const [loadingIA, setLoadingIA] = useState(false);
    const [informe, setInforme] = useState('');
    const [selFotos, setSelFotos] = useState([]);
    const [modoSel, setModoSel] = useState(false);
    const fotos = detail.fotos || [];
    const videos = detail.videos || [];

    function toggleSel(id) { setSelFotos(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }

    async function analizarFotos() {
        if (!apiKey) { setInforme('⚠ Configurá tu API Key en Más → Configuración para usar esta función.'); return; }
        const fotosAAnalizar = selFotos.length > 0 ? fotos.filter(f => selFotos.includes(f.id)) : fotos.slice(-8);
        if (!fotosAAnalizar.length) { setInforme('Agregá al menos una foto para analizar.'); return; }
        setLoadingIA(true); setInforme('');
        try {
            const content = [];
            fotosAAnalizar.forEach(f => {
                try { content.push({ type: 'image', source: { type: 'base64', media_type: getMediaType(f.url), data: getBase64(f.url) } }); } catch { }
            });
            content.push({
                type: 'text', text: `Analizá estas ${fotosAAnalizar.length} fotos de la obra "${detail.nombre}" (${detail.sector || '—'}, avance declarado: ${detail.avance}%).

Generá un informe profesional V+V Construcciones con:
1. **Estado general de la obra**
2. **Avance estimado** — ¿coincide con el ${detail.avance}% declarado?
3. **Trabajos en ejecución**
4. **Correcciones y recomendaciones**
5. **Alertas de seguridad**
6. **Conclusión**

Usá un tono técnico y profesional. Respondé en español rioplatense.`});

            const r = await callAI_OG([{ role: 'user', content }],
                `Sos un inspector de obras de obras para V+V Construcciones. Analizás fotos y generás informes técnicos precisos y profesionales en español rioplatense. Si identificás materiales o trabajos, podés buscar precios actualizados en internet para incluir estimaciones de costo.`,
                apiKey, true);
            setInforme(r);
            const nuevoInf = { id: uid_OG(), ts: Date.now(), titulo: `Análisis IA — ${new Date().toLocaleDateString('es-AR')}`, tipo: 'diario', fecha: new Date().toLocaleDateString('es-AR'), notas: 'Generado automáticamente por IA a partir de fotos', nombre: 'informe_ia.txt', ext: 'IA', url: 'data:text/plain;base64,' + btoa(unescape(encodeURIComponent(r))), size: '—', cargado: new Date().toLocaleDateString('es-AR') };
            upd(detail.id, { informes: [nuevoInf, ...(detail.informes || [])] });
        } catch (e) { setInforme('Error al analizar: ' + e.message); }
        setLoadingIA(false); setModoSel(false); setSelFotos([]);
    }

    return (<div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFoto} style={{ display: "none" }} />
        <input ref={videoRef} type="file" accept="video/*" multiple onChange={handleVideo} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <PBtn_OG onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "11px 0", fontSize: 13 }}>{t(cfg, 'obras_agregar_fotos')}</PBtn_OG>
            <button onClick={() => videoRef.current?.click()} style={{ background: T.accentLight, border: `1.5px solid ${T.accent}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, color: T.accent, cursor: "pointer", flexShrink: 0 }}><Ico n="video" /> Video</button>
            {fotos.length > 0 && <button onClick={() => { setModoSel(v => !v); setSelFotos([]); }} style={{ background: modoSel ? T.accent : T.accentLight, border: `1.5px solid ${T.accent}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 12, fontWeight: 700, color: modoSel ? "#fff" : T.accent, cursor: "pointer", flexShrink: 0 }}>
                {modoSel ? "Cancelar" : "Seleccionar"}
            </button>}
        </div>
        {fotos.length > 0 && (<button onClick={analizarFotos} disabled={loadingIA} style={{ width: "100%", background: loadingIA ? "#94A3B8" : T.navy, border: "none", borderRadius: T.rsm, padding: "13px", marginBottom: 14, cursor: loadingIA ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#fff", fontSize: 13, fontWeight: 700 }}>
            {loadingIA
                ? <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />Analizando fotos con IA…</>
                : <>{modoSel && selFotos.length > 0 ? `Analizar ${selFotos.length} foto${selFotos.length > 1 ? 's' : ''} seleccionada${selFotos.length > 1 ? 's' : ''}` : "Analizar fotos con IA"}</>}
        </button>)}
        {modoSel && <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginBottom: 10 }}>{selFotos.length === 0 ? "Tocá las fotos que querés analizar" : `${selFotos.length} seleccionada${selFotos.length > 1 ? "s" : ""}`}</div>}
        {fotos.length === 0
            ? <div style={{ textAlign: "center", padding: "32px 0", color: T.muted, fontSize: 13 }}>{t(cfg, 'obras_sin_fotos')}</div>
            : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: informe ? 14 : 0 }}>
                {[...fotos].reverse().map(f => {
                    const sel = selFotos.includes(f.id);
                    return (<div key={f.id} onClick={() => modoSel && toggleSel(f.id)} style={{ borderRadius: T.rsm, overflow: "hidden", border: `2px solid ${sel ? "#10B981" : T.border}`, cursor: modoSel ? "pointer" : "default", position: "relative" }}>
                        {sel && <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</div>}
                        <img src={f.url} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", opacity: modoSel && !sel ? .6 : 1, transition: "opacity .2s" }} />
                        <div style={{ padding: "5px 8px", fontSize: 9, color: T.muted, background: T.card }}>{f.fecha}</div>
                        <button onClick={e => { e.stopPropagation(); upd(detail.id, { fotos: fotos.filter(x => x.id !== f.id) }); }} style={{ position: "absolute", top: 5, left: 5, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>✕</button>
                    </div>);
                })}
            </div>}
        {videos.length > 0 && <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Videos ({videos.length})</div>
            {videos.map(v => <div key={v.id} style={{ marginBottom: 10, borderRadius: T.rsm, overflow: "hidden", border: `1px solid ${T.border}` }}>
                <video src={v.url} controls playsInline style={{ width: "100%", display: "block", background: "#000" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: T.card }}><span style={{ fontSize: 10.5, color: T.muted }}>{v.nombre || "video"} · {v.fecha}</span><button onClick={() => upd(detail.id, { videos: videos.filter(x => x.id !== v.id) })} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar</button></div>
            </div>)}
        </div>}
        {informe && (<Card_OG style={{ padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} /><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Informe IA generado</span></div>
                <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { try { navigator.clipboard.writeText(informe); } catch { } }} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "4px 10px", fontSize: 11, color: T.sub, cursor: "pointer" }}><Ico n="list" /> Copiar</button>
                    <button onClick={() => setInforme('')} style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", borderRadius: 7, padding: "4px 8px", fontSize: 11, color: "#EF4444", cursor: "pointer" }}>✕</button>
                </div>
            </div>
            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "12px 14px", fontSize: 12, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto" }}>{informe}</div>
        </Card_OG>)}
    </div>);
}

function TabInformes({ detail, upd }) {
    const [subTab, setSubTab] = useState("diario");
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ titulo: '', tipo: 'diario', fecha: '', notas: '' });
    const fileRef = useRef(null);
    const informes = detail.informes || [];
    const TIPOS_INF = [
        { id: 'diario', label: 'Diario', color: '#3B82F6', bg: 'rgba(37,99,235,.14)' },
        { id: 'semanal', label: 'Semanal', color: '#7C3AED', bg: 'rgba(139,92,246,.14)' },
        { id: 'ingeniero', label: 'Ingeniero', color: '#10B981', bg: 'rgba(22,163,74,.14)' },
    ];
    async function handleFile(e) {
        const files = Array.from(e.target.files);
        const nuevos = [];
        let fallaron = 0;
        for (const f of files) {
            // Subo el archivo real al bucket (como fotos y planos) en vez de embeber
            // el base64 en la ficha de la obra: eso infla la sincronización con Cliente
            // y puede fallar en silencio con archivos grandes.
            const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
            const remoteUrl = await mediaStorage_OG.upload(`informes/${uid_OG()}_${f.name.replace(/\W+/g, "_")}`, dataUrl);
            if (!remoteUrl) fallaron++;
            nuevos.push({
                id: uid_OG(), ts: Date.now(), titulo: form.titulo || f.name.replace(/\.[^.]+$/, ''),
                tipo: form.tipo || subTab, fecha: form.fecha || new Date().toLocaleDateString('es-AR'),
                notas: form.notas, nombre: f.name, ext: f.name.split('.').pop().toUpperCase(),
                url: remoteUrl || dataUrl, size: (f.size / 1024).toFixed(0) + 'KB', cargado: new Date().toLocaleDateString('es-AR'),
            });
        }
        if (fallaron) alert(`⚠ ${fallaron} archivo(s) quedaron guardados en este dispositivo, pero no se pudieron subir a la nube. No van a verse desde Cliente ni desde otro dispositivo hasta que los vuelvas a cargar con conexión.`);
        upd(detail.id, { informes: [...nuevos, ...informes] });
        setForm({ titulo: '', tipo: 'diario', fecha: '', notas: '' });
        setShowNew(false);
        e.target.value = '';
    }
    const filtered = informes.filter(i => i.tipo === subTab);
    const tp = TIPOS_INF.find(x => x.id === subTab);

    return (<div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {TIPOS_INF.map(tipo => (<button key={tipo.id} onClick={() => setSubTab(tipo.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 20, border: `1.5px solid ${subTab === tipo.id ? tipo.color : T.border}`, background: subTab === tipo.id ? tipo.bg : T.card, color: tipo.color, fontSize: 11, fontWeight: subTab === tipo.id ? 700 : 500, cursor: "pointer" }}>{tipo.label} ({informes.filter(i => i.tipo === tipo.id).length})</button>))}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.txt,.jpg,.png" multiple onChange={handleFile} style={{ display: "none" }} />
        <button onClick={() => setShowNew(true)} style={{ width: "100%", background: tp?.bg, border: `1.5px dashed ${tp?.color}`, borderRadius: T.rsm, padding: "12px", marginBottom: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18, color: tp?.color }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: tp?.color }}>Subir informe {tp?.label}</span>
        </button>
        {filtered.length === 0
            ? <div style={{ textAlign: "center", padding: "28px 0", color: T.muted, fontSize: 12 }}>Sin informes {tp?.label?.toLowerCase()}s cargados</div>
            : filtered.map(inf => (<div key={inf.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 8 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: tp?.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: tp?.color }}>{inf.ext}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inf.titulo}</div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{inf.fecha} · {inf.size}</div>
                </div>
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <button onClick={() => descargarArchivo_OG(inf.url, inf.nombre)} style={{ background: T.accentLight, border: `1px solid ${T.border}`, borderRadius: 7, width: 30, height: 30, cursor: "pointer", color: T.accent, fontSize: 12 }}>↓</button>
                    <button onClick={() => upd(detail.id, { informes: informes.filter(x => x.id !== inf.id) })} style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", borderRadius: 7, width: 30, height: 30, cursor: "pointer", color: "#EF4444", fontSize: 12 }}>✕</button>
                </div>
            </div>))}
        {showNew && (<Sheet title={`Subir informe ${tp?.label}`} onClose={() => setShowNew(false)}>
            <Field label="Título (opcional)"><TInput value={form.titulo || ""} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Título del informe" /></Field>
            <FieldRow>
                <Field label="Tipo"><Sel value={form.tipo || ""} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>{TIPOS_INF.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</Sel></Field>
                <Field label="Fecha"><TInput value={form.fecha || ""} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} placeholder="dd/mm/aa" /></Field>
            </FieldRow>
            <Field label="Notas"><textarea value={form.notas || ""} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones..." rows={3} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text }} /></Field>
            <PBtn_OG full onClick={() => fileRef.current?.click()}><Ico n="clip" /> Seleccionar archivo</PBtn_OG>
        </Sheet>)}
    </div>);
}

// ── OBRAS ────────────────────────────────────────────────────────────
// ── TAB GASTOS (dentro de cada Obra) ─────────────────────────────────
const TIPOS_GASTO = [
    { id: 'viatico', label: 'Viático', color: '#F59E0B', bg: 'rgba(180,83,9,.14)' },
    { id: 'compra', label: 'Compra material', color: '#3B82F6', bg: 'rgba(37,99,235,.14)' },
    { id: 'herramienta', label: 'Herramienta', color: '#8B5CF6', bg: 'rgba(139,92,246,.14)' },
    { id: 'subcontrato', label: 'Subcontrato', color: '#10B981', bg: 'rgba(22,163,74,.14)' },
    { id: 'combustible', label: 'Combustible', color: '#F97316', bg: '#FFF7ED' },
    { id: 'otro', label: 'Otro', color: '#6B7280', bg: '#F9FAFB' },
];

function TabGastos({ detail, upd }) {
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ desc: '', tipo: 'viatico', monto: '', fecha: new Date().toLocaleDateString('es-AR'), quien: '', comprobante: null });
    const compRef = useRef(null);
    const gastos = detail.gastos || [];

    const total = gastos.reduce((s, g) => s + parseMontoNum_OG(g.monto), 0);
    const porTipo = TIPOS_GASTO.map(t => ({ ...t, total: gastos.filter(g => g.tipo === t.id).reduce((s, g) => s + parseMontoNum_OG(g.monto), 0) })).filter(t => t.total > 0);

    async function handleComp(e) {
        const f = e.target.files?.[0]; if (!f) return;
        const url = await toDataUrl(f);
        setForm(p => ({ ...p, comprobante: { url, nombre: f.name, ext: f.name.split('.').pop().toUpperCase() } }));
        e.target.value = '';
    }

    function agregar() {
        if (!String(form.desc || "").trim() || !form.monto) return;
        const nuevo = { id: uid_OG(), ...form };
        upd(detail.id, { gastos: [...gastos, nuevo] });
        setForm({ desc: '', tipo: 'viatico', monto: '', fecha: new Date().toLocaleDateString('es-AR'), quien: '', comprobante: null });
        setShowNew(false);
    }

    function eliminar(id) { upd(detail.id, { gastos: gastos.filter(g => g.id !== id) }); }

    return (<div>
        {/* Resumen */}
        <div style={{ background: T.navy, borderRadius: T.rsm, padding: "14px 16px", marginBottom: 14, color: "#fff" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total gastos — {detail.nombre}</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>${total.toLocaleString('es-AR')}</div>
            {porTipo.length > 0 && <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {porTipo.map(t => (
                    <div key={t.id} style={{ background: "rgba(255,255,255,.1)", borderRadius: 8, padding: "4px 10px" }}>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,.6)" }}>{t.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>${t.total.toLocaleString('es-AR')}</div>
                    </div>
                ))}
            </div>}
        </div>

        <button onClick={() => setShowNew(true)} style={{ width: "100%", background: T.accent, border: "none", borderRadius: T.rsm, padding: "12px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" /></svg>
            Cargar gasto
        </button>

        {gastos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: T.muted, fontSize: 13 }}>Sin gastos registrados</div>
        ) : (
            [...gastos].reverse().map(g => {
                const tipo = TIPOS_GASTO.find(t => t.id === g.tipo) || TIPOS_GASTO[5];
                return (<div key={g.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                                <span style={{ background: tipo.bg, color: tipo.color, borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700, border: `1px solid ${tipo.color}22` }}>{tipo.label}</span>
                                <span style={{ fontSize: 11, color: T.muted }}>{g.fecha}</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{g.desc}</div>
                            {g.quien && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}><Ico n="user" /> {g.quien}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: T.accent }}>${parseMontoNum_OG(g.monto).toLocaleString('es-AR')}</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {g.comprobante && (
                            <a href={g.comprobante.url} download={g.comprobante.nombre} style={{ textDecoration: "none", flex: 1 }}>
                                <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ width: 24, height: 24, borderRadius: 5, background: T.accentLight, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800 }}>{g.comprobante.ext}</div>
                                    <span style={{ fontSize: 11, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.comprobante.nombre}</span>
                                    <span style={{ fontSize: 10, color: T.accent, fontWeight: 600, marginLeft: "auto" }}>↓</span>
                                </div>
                            </a>
                        )}
                        <button onClick={() => eliminar(g.id)} style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#EF4444", cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>✕</button>
                    </div>
                </div>);
            })
        )}

        {showNew && (<Sheet title="Cargar gasto" onClose={() => setShowNew(false)}>
            <Field label="Descripción">
                <TInput value={form.desc || ""} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} placeholder="Ej: Cemento Portland 25kg" />
            </Field>
            <Lbl>Tipo de gasto</Lbl>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                {TIPOS_GASTO.map(t => (
                    <button key={t.id} onClick={() => setForm(p => ({ ...p, tipo: t.id }))} style={{ padding: "8px 4px", borderRadius: T.rsm, border: `1.5px solid ${form.tipo === t.id ? t.color : T.border}`, background: form.tipo === t.id ? t.bg : T.card, color: t.color, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{t.label}</button>
                ))}
            </div>
            <FieldRow>
                <Field label="Monto ($)">
                    <MontoInput value={form.monto || ""} onChange={v => setForm(p => ({ ...p, monto: v }))} placeholder="0 $" />
                </Field>
                <Field label="Fecha">
                    <TInput value={form.fecha || ""} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} placeholder="dd/mm/aa" />
                </Field>
            </FieldRow>
            <Field label="Quién realizó el gasto (opcional)">
                <TInput value={form.quien || ""} onChange={e => setForm(p => ({ ...p, quien: e.target.value }))} placeholder="Nombre del trabajador" />
            </Field>
            <Field label="Comprobante (foto o PDF)">
                <input ref={compRef} type="file" accept="image/*,.pdf" onChange={handleComp} style={{ display: "none" }} />
                {form.comprobante ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(22,163,74,.14)", border: "1px solid #86EFAC", borderRadius: T.rsm, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", flex: 1 }}>✓ {form.comprobante.nombre}</div>
                        <button onClick={() => setForm(p => ({ ...p, comprobante: null }))} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                ) : (
                    <button onClick={() => compRef.current?.click()} style={{ width: "100%", background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 12, fontWeight: 600, color: T.sub, cursor: "pointer" }}>
                        Adjuntar comprobante
                    </button>
                )}
            </Field>
            <PBtn_OG full onClick={agregar} disabled={!String(form.desc || "").trim() || !form.monto}>Guardar gasto</PBtn_OG>
        </Sheet>)}
    </div>);
}

function Obras({ obras, setObras, lics = [], detailId: detailIdProp, setDetailId: setDetailIdProp, requireAuth = (fn) => fn(), cfg, apiKey }) {
    const [detailIdLocal, setDetailIdLocal] = useState(null);
    const detailId = detailIdProp !== undefined ? detailIdProp : detailIdLocal;
    const setDetailId = setDetailIdProp || setDetailIdLocal;
    const UBICS = getUbics(cfg);
    const defaultAp = UBICS[0]?.id || 'aep';
    const [showNew, setShowNew] = useState(false);
    const [tab, setTab] = useState("info");
    const [form, setForm] = useState({ nombre: "", ap: defaultAp, sector: "", estado: "pendiente", avance: 0, inicio: "", cierre: "" });
    const [newObs, setNewObs] = useState("");
    const fileRef = useRef(null); const archRef = useRef(null); const videoRef = useRef(null); const planoRef = useRef(null);
    const detail = detailId ? obras.find(o => o.id === detailId) : null;

    // Actualizar form.ap si cambian las UBICS
    useEffect(() => {
        setForm(f => ({ ...f, ap: UBICS[0]?.id || f.ap }));
    }, [UBICS.length]);

    function add() {
        if (!String(form.nombre || "").trim()) return;
        const apFinal = form.ap || UBICS[0]?.id || defaultAp;
        setObras(p => [...p, { ...form, ap: apFinal, id: uid_OG(), avance: parseInt(form.avance) || 0, pagado: 0, obs: [], fotos: [], archivos: [], informes: [], docs: {} }]);
        setForm({ nombre: "", ap: UBICS[0]?.id || defaultAp, sector: "", estado: "pendiente", avance: 0, inicio: "", cierre: "" });
        setShowNew(false);
    }
    function upd(id, patch) {
        setObras(p => p.map(o => o.id === id ? { ...o, ...patch } : o));
    }
    async function handleFoto(e) {
        if (!detail) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const nuevas = await Promise.all(files.map(async f => {
            const dataUrl = await toDataUrl(f);
            const comprimida = await compressImage(dataUrl);
            const fotoId = uid_OG();
            // Subir al bucket — devuelve URL pública o base64 como fallback
            const url = await uploadFoto(comprimida, `obras/${detail.id}`, fotoId);
            return { id: fotoId, url, nombre: f.name, fecha: new Date().toLocaleDateString("es-AR") };
        }));
        const fallaron = nuevas.some(n => !mediaStorage_OG.isRemoteUrl(n.url));
        upd(detail.id, { fotos: [...(detail.fotos || []), ...nuevas] });
        e.target.value = "";
        if (fallaron) alert("⚠ Las fotos quedaron guardadas en este dispositivo, pero NO se pudieron subir a la nube. Para que se sincronicen entre dispositivos y se vean en la app de Belfast, falta configurar el bucket de fotos 'bco-media' en Supabase (crearlo, hacerlo público y darle permisos). Mirá las instrucciones que te pasó la app.");
    }
    async function handlePlano(e) {
        if (!detail) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const nuevos = [];
        for (const f of files) {
            const dataUrl = await toDataUrl(f);
            const url = await uploadFoto(dataUrl, `planos/${detail.id}`, `${Date.now()}_${(f.name || "plano").replace(/\W+/g, "_")}`);
            if (!mediaStorage_OG.isRemoteUrl(url)) { alert(`El plano "${f.name}" NO se pudo subir a la nube (bucket 'bco-media' en Supabase). No lo guardo local para no romper la sincronización.`); continue; }
            const ext = (f.name.split(".").pop() || "").toLowerCase();
            nuevos.push({ id: uid_OG(), nombre: f.name, url, fecha: new Date().toLocaleDateString("es-AR"), from: "vv", tipo: ext });
        }
        e.target.value = "";
        if (!nuevos.length) return;
        upd(detail.id, { planos: [...(detail.planos || []), ...nuevos] });
    }
    async function handleVideo(e) {
        if (!detail) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const nuevos = [];
        for (const f of files) {
            if (f.size > 60 * 1024 * 1024) { alert(`El video "${f.name}" pesa ${(f.size / 1048576).toFixed(0)} MB. Subí videos de hasta ~60 MB (grabá más corto o en menor calidad).`); continue; }
            const dataUrl = await toDataUrl(f);
            const vidId = uid_OG();
            const url = await uploadFoto(dataUrl, `obras/${detail.id}/videos`, vidId);
            if (!mediaStorage_OG.isRemoteUrl(url)) { alert(`El video "${f.name}" NO se pudo subir a la nube, así que no lo guardo (guardarlo local rompería la sincronización de la app). Revisá que el bucket 'bco-media' de Supabase exista, sea público y tenga permisos, y volvé a intentar.`); continue; }
            nuevos.push({ id: vidId, url, nombre: f.name, fecha: new Date().toLocaleDateString("es-AR") });
        }
        e.target.value = "";
        if (!nuevos.length) return;
        upd(detail.id, { videos: [...(detail.videos || []), ...nuevos] });
    }
    async function handleArch(e) {
        if (!detail) return;
        for (const f of Array.from(e.target.files)) {
            const dataUrl = await toDataUrl(f);
            const archId = uid_OG();
            const url = await uploadFoto(dataUrl, `obras/${detail.id}/archivos`, archId);
            upd(detail.id, { archivos: [...detail.archivos, { id: archId, url, nombre: f.name, ext: f.name.split(".").pop().toUpperCase(), fecha: new Date().toLocaleDateString("es-AR") }] });
        }
        e.target.value = "";
    }
    const ec = id => OBRA_ESTADOS.find(e => e.id === id) || OBRA_ESTADOS[0];

    if (detail) {
        const e = ec(detail.estado);
        return (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <AppHeader title={detail.nombre} sub={`${UBICS.find(a => a.id === detail.ap)?.code || detail.ap} · ${detail.sector || t(cfg, 'obras_sector')}`} back onBack={() => setDetailId(null)} right={<Badge_OG color={e.color} bg={e.bg}>{e.label}</Badge_OG>} />
                <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "12px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: T.sub, fontWeight: 600 }}>{t(cfg, 'obras_avance')}</span><span style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>{detail.avance}%</span></div>
                    <div style={{ height: 8, background: T.bg, borderRadius: 4 }}><div style={{ height: 8, background: T.accent, borderRadius: 4, width: `${detail.avance}%`, transition: "width .5s" }} /></div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span style={{ fontSize: 11, color: T.muted }}>{t(cfg, 'obras_inicio')}: {detail.inicio || "—"}</span><span style={{ fontSize: 11, color: T.muted }}>{t(cfg, 'obras_cierre')}: {detail.cierre || "—"}</span></div>
                    <input type="range" min="0" max="100" value={detail.avance} onChange={e => upd(detail.id, { avance: parseInt(e.target.value) })} style={{ width: "100%", accentColor: "var(--accent,#B0894F)", marginTop: 10 }} />
                </div>
                <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", overflowX: "auto" }}>
                    {[[`info`, t(cfg, 'obras_info')], [`obs`, t(cfg, 'obras_notas')], [`fotos`, t(cfg, 'obras_fotos')], [`planos`, 'Planos'], [`archivos`, t(cfg, 'obras_archivos')], [`informes`, 'Informes'], [`gastos`, 'Gastos']].map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)} style={{ flex: 1, minWidth: 52, padding: "10px 4px", background: "none", border: "none", fontSize: 11, fontWeight: tab === id ? 700 : 500, color: tab === id ? T.accent : T.muted, borderBottom: `2px solid ${tab === id ? "var(--accent,#B0894F)" : "transparent"}`, whiteSpace: "nowrap" }}>{label}</button>
                    ))}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", paddingBottom: 80 }}>
                    {tab === "info" && (<div>
                        <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px", marginBottom: 8, border: `1px solid ${T.border}` }}>
                            <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>Nombre de la obra</div>
                            <input value={detail.nombre || ''} onChange={e => upd(detail.id, { nombre: e.target.value })} placeholder="Nombre de la obra" style={{ width: "100%", background: "transparent", border: "none", fontSize: 14, fontWeight: 800, color: T.text, padding: 0 }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>{getLabelUbic(cfg)}</div>
                                <select value={detail.ap} onChange={e => upd(detail.id, { ap: e.target.value })} style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0, cursor: "pointer" }}>
                                    {UBICS.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                                </select>
                            </div>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>{t(cfg, 'obras_sector')}</div>
                                <input value={detail.sector || ''} onChange={e => upd(detail.id, { sector: e.target.value })} placeholder="Sin sector" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0 }} />
                            </div>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>{t(cfg, 'obras_inicio')}</div>
                                <input value={detail.inicio || ''} onChange={e => upd(detail.id, { inicio: e.target.value })} placeholder="dd/mm/aa" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0 }} />
                            </div>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>{t(cfg, 'obras_cierre')}</div>
                                <input value={detail.cierre || ''} onChange={e => upd(detail.id, { cierre: e.target.value })} placeholder="dd/mm/aa" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0 }} />
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>Presupuesto</div>
                                <input value={detail.monto || ''} onChange={e => upd(detail.id, { monto: e.target.value })} placeholder="$ 0" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0 }} />
                            </div>
                            <div style={{ background: detail.pagado > 0 ? "rgba(22,163,74,.14)" : T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}><Ico n="money" /> Pagado</div>
                                <input value={detail.pagado || ''} onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); upd(detail.id, { pagado: v ? parseFloat(v) : 0 }); }} placeholder="$ 0" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: "#10B981", padding: 0 }} />
                            </div>
                        </div>
                        <Lbl>{t(cfg, 'obras_estado')}</Lbl>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                            {OBRA_ESTADOS.map(e => (<button key={e.id} onClick={() => upd(detail.id, { estado: e.id })} style={{ padding: "9px", borderRadius: T.rsm, border: `1.5px solid ${detail.estado === e.id ? e.color : T.border}`, background: detail.estado === e.id ? e.bg : T.card, color: e.color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{e.label}</button>))}
                        </div>
                        <button onClick={() => { setObras(p => p.filter(o => o.id !== detail.id)); setDetailId(null); }} style={{ width: "100%", background: "rgba(239,68,68,.10)", border: "1.5px solid rgba(239,68,68,.30)", borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 600, color: "#EF4444", cursor: "pointer" }}>{t(cfg, 'obras_eliminar')}</button>
                    </div>)}
                    {tab === "obs" && (<div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                            <TInput value={newObs} onChange={e => setNewObs(e.target.value)} placeholder={t(cfg, 'obras_obs_placeholder')} />
                            <PBtn_OG onClick={() => { if (!newObs.trim()) return; const tx = newObs; setNewObs(""); upd(detail.id, { obs: [...detail.obs, { id: uid_OG(), txt: tx, fecha: new Date().toLocaleDateString("es-AR") }] }); }} disabled={!newObs.trim()} style={{ padding: "11px 16px", flexShrink: 0 }}>+</PBtn_OG>
                        </div>
                        {[...detail.obs].reverse().map(o => (<Card_OG key={o.id} style={{ padding: "12px 14px", marginBottom: 8 }}><div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{o.txt}</div><div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>{o.fecha}</div></Card_OG>))}
                        {(detail.obs || []).length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: T.muted, fontSize: 13 }}>{t(cfg, 'obras_sin_notas')}</div>}
                    </div>)}
                    {tab === "fotos" && (<TabFotos detail={detail} upd={upd} fileRef={fileRef} handleFoto={handleFoto} videoRef={videoRef} handleVideo={handleVideo} apiKey={apiKey} cfg={cfg} />)}
                    {tab === "planos" && (<div>
                        <input ref={planoRef} type="file" accept=".pdf,.dwg,.dxf,.dwf,.rvt,application/pdf,image/*" multiple onChange={handlePlano} style={{ display: "none" }} />
                        <button onClick={() => planoRef.current && planoRef.current.click()} style={{ width: "100%", background: T.navy, color: "#fff", border: "none", borderRadius: T.rsm, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderBottom: `2px solid ${BRASS_OG}`, marginBottom: 14 }}>＋ Subir plano (PDF / CAD)</button>
                        {(detail.planos || []).length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "22px 16px", lineHeight: 1.5 }}>Sin planos cargados.<br />Subí acá los planos de la obra (PDF, DWG, DXF…). Belfast también los ve y los puede subir.</div>}
                        {(detail.planos || []).map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 12px", marginBottom: 7 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}><Ico n="ruler" /> </div>
                            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{p.nombre}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{p.fecha}{p.from ? ` · ${p.from === "vv" ? "V+V" : "Belfast"}` : ""}</div></div>
                            <a href={p.url} target="_blank" rel="noreferrer" download={p.nombre} style={{ color: T.accent, fontWeight: 700, fontSize: 12, textDecoration: "none", flexShrink: 0 }}>Abrir ↗</a>
                            <button onClick={() => upd(detail.id, { planos: (detail.planos || []).filter(x => x.id !== p.id) })} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>
                        </div>)}
                    </div>)}
                    {tab === "archivos" && (<div>
                        <input ref={archRef} type="file" accept=".pdf,.xlsx,.xls,.docx,.doc" multiple onChange={handleArch} style={{ display: "none" }} />
                        <PBtn_OG full onClick={() => archRef.current?.click()} style={{ marginBottom: 14 }}>{t(cfg, 'obras_agregar_arch')}</PBtn_OG>
                        {(detail.archivos || []).map(f => (<div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 7 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 9, fontWeight: 700, color: T.accent }}>{f.ext}</span></div>
                            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre}</div><div style={{ fontSize: 10, color: T.muted }}>{f.fecha}</div></div>
                            <a href={f.url} download={f.nombre} style={{ textDecoration: "none" }}><button style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, width: 30, height: 30, fontSize: 13, color: T.sub, cursor: "pointer" }}>↓</button></a>
                        </div>))}
                        {(detail.archivos || []).length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: T.muted, fontSize: 13 }}>{t(cfg, 'obras_sin_archivos')}</div>}
                    </div>)}
                    {tab === "informes" && <TabInformes detail={detail} upd={upd} />}
                    {tab === "gastos" && <TabGastos detail={detail} upd={upd} />}
                </div>
            </div>
        );
    }

    return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
        <AppHeader title={t(cfg, 'obras_titulo')} sub={`${obras.length} registros`} right={<PlusBtn onClick={() => requireAuth(() => setShowNew(true), t(cfg, 'obras_nueva'))} />} />
        <div style={{ padding: "14px 18px" }}>
            {OBRA_ESTADOS.map(est => {
                const items = obras.filter(o => o.estado === est.id);
                if (!items.length) return null;
                return (<div key={est.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: est.color }} /><span style={{ fontSize: 11, fontWeight: 700, color: est.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{est.label}</span><span style={{ fontSize: 11, color: T.muted }}>({items.length})</span></div>
                    {items.map(o => (<Card_OG key={o.id} onClick={() => setDetailId(o.id)} style={{ padding: "13px 14px", marginBottom: 7, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{o.nombre}</div><span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{o.avance}%</span></div>
                        <div style={{ height: 4, background: T.bg, borderRadius: 4, marginBottom: 6 }}><div style={{ height: 4, background: T.accent, borderRadius: 4, width: `${o.avance}%` }} /></div>
                        <div style={{ fontSize: 11, color: T.muted }}>{UBICS.find(a => a.id === o.ap)?.code || o.ap} · {o.sector || "Sin sector"} · {o.cierre || "—"}</div>
                    </Card_OG>))}
                </div>);
            })}
        </div>
        {showNew && (<Sheet title={t(cfg, 'obras_nueva')} onClose={() => setShowNew(false)}>
            <Field label={t(cfg, 'obras_titulo')}><TInput value={form.nombre || ""} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Refacción Terminal B" /></Field>
            <FieldRow>
                <Field label={getLabelUbic(cfg)}><Sel value={form.ap || ""} onChange={e => setForm(p => ({ ...p, ap: e.target.value }))}>{UBICS.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}</Sel></Field>
                <Field label={t(cfg, 'obras_estado')}><Sel value={form.estado || ""} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>{OBRA_ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</Sel></Field>
            </FieldRow>
            <FieldRow>
                <Field label={t(cfg, 'obras_sector')}><TInput value={form.sector || ""} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} placeholder="Sector A" /></Field>
                <Field label={`${t(cfg, 'obras_avance')} %`}><TInput type="number" value={form.avance || ""} onChange={e => setForm(p => ({ ...p, avance: e.target.value }))} placeholder="0" /></Field>
            </FieldRow>
            <FieldRow>
                <Field label={t(cfg, 'obras_inicio')}><TInput value={form.inicio || ""} onChange={e => setForm(p => ({ ...p, inicio: e.target.value }))} placeholder="dd/mm/aa" /></Field>
                <Field label={t(cfg, 'obras_cierre')}><TInput value={form.cierre || ""} onChange={e => setForm(p => ({ ...p, cierre: e.target.value }))} placeholder="dd/mm/aa" /></Field>
            </FieldRow>
            <PBtn_OG full onClick={add} disabled={!String(form.nombre || "").trim()}>{t(cfg, 'obras_nueva')}</PBtn_OG>
        </Sheet>)}
    </div>);
}


// ════════════════════════════════════════════════════════════════════
// PREVIEW HARNESS — V+V Construcciones · dirección institucional premium
// Señal: hilo de bronce (regla membrete, anillo FAB, viñetas de sección).
// ════════════════════════════════════════════════════════════════════

const BRASS_OG = "#B0894F";
const INST_COLORS = { accent:"#1E3A5F", al:"rgba(255,255,255,.08)", bg:"#F5F6F8", card:"#FFFFFF", border:"#E6E9EE", text:"#131C2B", sub:"#4A5565", muted:"#97A0AE", navy:"#101C2C" };

const SAMPLE_OBRAS = [
  { id:"o1", nombre:"Castores 475", ap:"norte", sector:"Vivienda PB+1", estado:"curso", avance:68, inicio:"10/03/26", cierre:"30/08/26", monto:"12.400.000 $", pagado:8100000, obs:[{id:"b1",txt:"Hormigón visto terminado en PB.",fecha:"20/06/26"}], fotos:[], archivos:[], informes:[], gastos:[], docs:{} },
  { id:"o2", nombre:"Puentes 132", ap:"norte", sector:"Refacción integral", estado:"curso", avance:41, inicio:"02/04/26", cierre:"15/09/26", monto:"7.900.000 $", pagado:3000000, obs:[], fotos:[], archivos:[], informes:[], gastos:[], docs:{} },
  { id:"o3", nombre:"Golf 2–93", ap:"caba", sector:"Obra nueva", estado:"curso", avance:23, inicio:"20/05/26", cierre:"20/12/26", monto:"21.000.000 $", pagado:0, obs:[], fotos:[], archivos:[], informes:[], gastos:[], docs:{} },
  { id:"o5", nombre:"A 37", ap:"caba", sector:"Fit-out comercial", estado:"terminada", avance:100, inicio:"01/11/25", cierre:"28/02/26", monto:"9.200.000 $", pagado:9200000, obs:[], fotos:[], archivos:[], informes:[], gastos:[], docs:{} },
];
const SAMPLE_LICS = [
  { id:"l1", nombre:"Refacción Terminal B", ap:"norte", estado:"presupuesto", monto:"18.000.000 $", fecha:"12/06/26", sector:"Terminal B", docs:{}, visitas:[] },
  { id:"l2", nombre:"Oficinas Copeland Suipacha", ap:"caba", estado:"presentada", monto:"6.400.000 $", fecha:"02/06/26", sector:"Piso 25", docs:{}, visitas:[] },
  { id:"l3", nombre:"Obra Saavedra", ap:"caba", estado:"visitar", monto:"", fecha:"28/06/26", sector:"Lote", docs:{}, visitas:[] },
  { id:"l4", nombre:"Castores 475", ap:"norte", estado:"adjudicada", monto:"12.400.000 $", fecha:"01/03/26", sector:"Vivienda", docs:{}, visitas:[], lic_id:"l4" },
];
const SAMPLE_PERSONAL = [
  { id:"p1", nombre:"Héctor Ayala", rol:"Director Técnico", empresa:"V+V Construcciones", obra_id:"o1", telefono:"", foto:"", tareas:[], docs:{art:{nombre:"art.pdf",vence:""},dni:{nombre:"dni.pdf"}} },
  { id:"p2", nombre:"Marcos Giménez", rol:"Capataz", empresa:"V+V Construcciones", obra_id:"o2", telefono:"", foto:"", tareas:[], docs:{} },
];
const SAMPLE_ALERTS = [
  { id:"a1", msg:"Marcos Giménez: ART vence en 3 días", prioridad:"alta" },
  { id:"a3", msg:"Obra Saavedra: presentación de avance pendiente", prioridad:"media" },
];

// Viñeta de sección (hilo de bronce) — la firma que se repite.



// ═══ fin OBRAS compartido ═══

// ── PANTALLA: ARCHIVOS ───────────────────────────────────────────────
function ArchivosScreen({ T, obras, archivosCliente, setArchivosCliente, archivosVV, registrarSubida, quitarDeObra }) {
  const ref = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [destino, setDestino] = useState(obras[0]?.id || "");
  const obraArch = obras.flatMap(o => (o.archivos || []).map(a => ({ ...a, obra: o.nombre, _obraId: o.id })));
  async function subir(e) {
    const files = Array.from(e.target.files); if (!files.length) return; setSubiendo(true);
    const nuevos = [];
    for (const f of files) {
      const data = await fileToDataUrl(f);
      const url = await uploadArchivo(data, "cliente", f.name.replace(/\W+/g, "_"));
      nuevos.push({ id: uid(), nombre: f.name, url, fecha: hoyStr(), from: "cliente", obra_id: destino });
    }
    const r = await storage.get("cliente_archivos"); let actual = [];
    if (r?.value) { try { actual = JSON.parse(r.value); } catch { } }
    setArchivosCliente([...nuevos, ...actual]);
    if (destino && registrarSubida) await registrarSubida(nuevos.map(n => ({ nombre: n.nombre, url: n.url })), destino);
    setSubiendo(false); e.target.value = "";
  }
  const FileRow = ({ a, mine, onDelete }) => (<div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", marginBottom: 8, boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 11 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: mine ? "rgba(255,255,255,.08)" : T.bg, color: mine ? T.accent : T.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}><Ico n="doc" /> </div>
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nombre || "archivo"}</div><div style={{ fontSize: 11, color: T.muted }}>{a.fecha || a.obra || ""}</div></div>
    {a.url && <a href={a.url} target="_blank" rel="noreferrer" download={a.nombre} style={{ background: T.bg, color: T.accent, borderRadius: 7, padding: "7px 11px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Abrir</a>}
    {onDelete && <button onClick={() => { if (confirm("¿Eliminar este archivo?")) onDelete(); }} style={{ background: "none", border: "1px solid rgba(239,68,68,.35)", color: "#EF4444", borderRadius: 7, padding: "7px 9px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>✕</button>}
  </div>);
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <div style={{ padding: "16px 20px" }}>
      <input ref={ref} type="file" multiple onChange={subir} style={{ display: "none" }} />
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Subir a la obra</label>
      <select value={destino} onChange={e => setDestino(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 10px" }}>
        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        <option value="">General (sin obra)</option>
      </select>
      <button onClick={() => ref.current?.click()} disabled={subiendo} style={{ width: "100%", background: T.navy, color: "#fff", border: `2px dashed ${BRASS}`, borderRadius: T.rsm, padding: "16px", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{subiendo ? "Subiendo…" : "＋ Subir archivo"}</button>
      <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginBottom: 18 }}>{destino ? "Queda cargado en la obra y V+V recibe el aviso." : "Se guarda como archivo general."}</div>
      {(archivosVV.length > 0 || obraArch.length > 0) && <><Eyebrow T={T}>Compartidos por la obra</Eyebrow>
        {archivosVV.map(a => <FileRow key={a.id} a={a} />)}
        {obraArch.map((a, i) => <FileRow key={"o" + i} a={a} onDelete={a.from === "cliente" ? () => quitarDeObra(a._obraId, a.id) : undefined} />)}
      </>}
      <div style={{ marginTop: 16 }}><Eyebrow T={T}>Mis archivos enviados</Eyebrow>
        {archivosCliente.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "24px 18px" }}>Todavía no subiste archivos.</div>}
        {archivosCliente.map(a => <FileRow key={a.id} a={a} mine onDelete={() => setArchivosCliente(p => (p || []).filter(x => x.id !== a.id))} />)}
      </div>
    </div>
  </div>);
}

// ── PANTALLA: MENSAJES ───────────────────────────────────────────────
function MensajesScreen({ T, cfg, obras, mensajes, enviar, borrarMensaje, vaciarMensajes }) {
  const [input, setInput] = useState("");
  const [adj, setAdj] = useState([]);
  const [obraAdj, setObraAdj] = useState("");
  const fileRef = useRef(null); const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);
  async function addAdj(e) { const files = Array.from(e.target.files); if (!files.length) return; const nuevos = []; for (const f of files) { const data = await fileToDataUrl(f); const url = await uploadArchivo(data, "msg", f.name.replace(/\W+/g, "_")); nuevos.push({ nombre: f.name, url }); } setAdj(p => [...p, ...nuevos]); if (!obraAdj && obras[0]) setObraAdj(obras[0].id); e.target.value = ""; }
  async function send() { const t = input.trim(); if (!t && adj.length === 0) return; await enviar(t, adj, adj.length ? obraAdj : ""); setInput(""); setAdj([]); setObraAdj(""); }
  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    {mensajes.length > 0 && vaciarMensajes && <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
      <button onClick={vaciarMensajes} style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", color: "#EF4444", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Ico n="trash" /> Vaciar mensajes ({mensajes.length})</button>
    </div>}
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
      {mensajes.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "40px 18px", lineHeight: 1.6 }}>Escribile a V+V Construcciones. Te avisamos acá cuando respondan.</div>}
      {mensajes.map((m, i) => { const mine = m.from === "cliente"; return (<div key={m.id || i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 11 }}>
        <div style={{ maxWidth: "82%" }}>
          <div style={{ background: mine ? T.accent : T.card, color: mine ? "#fff" : T.text, border: mine ? "none" : `1px solid ${T.border}`, borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 13px", fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", boxShadow: T.shadow }}>
            {m.texto}
            {(m.archivos || []).map((a, j) => <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: mine ? "#fff" : T.accent, textDecoration: "underline" }}><Ico n="clip" /> {a.nombre}</a>)}
          </div>
          <div style={{ fontSize: 9.5, color: T.muted, marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "Vos" : "V+V"} · {m.fecha}{mine && m.id && borrarMensaje && <span onClick={() => borrarMensaje(m.id)} style={{ marginLeft: 8, color: "#EF4444", cursor: "pointer", fontWeight: 700 }}>Eliminar</span>}</div>
        </div>
      </div>); })}
      <div ref={bottomRef} />
    </div>
    <div style={{ borderTop: `1px solid ${T.border}`, background: T.card, padding: "10px 14px 14px" }}>
      {adj.length > 0 && <><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{adj.map((a, i) => <span key={i} style={{ background: T.bg, borderRadius: 6, padding: "5px 9px", fontSize: 11, color: T.sub }}><Ico n="clip" /> {a.nombre} <span onClick={() => setAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.muted }}>✕</span></span>)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, flexShrink: 0 }}>Cargar a obra:</span>
          <select value={obraAdj} onChange={e => setObraAdj(e.target.value)} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5, color: T.text }}>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            <option value="">No cargar a ninguna</option>
          </select>
        </div></>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <input ref={fileRef} type="file" multiple onChange={addAdj} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} style={{ width: 42, height: 42, borderRadius: T.rsm, background: T.bg, color: T.sub, border: `1px solid ${T.border}`, fontSize: 17, flexShrink: 0 }}>＋</button>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Escribí un mensaje…" rows={1} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 16, color: T.text, maxHeight: 110, minHeight: 42 }} />
        <button onClick={send} style={{ width: 42, height: 42, borderRadius: T.rsm, background: T.accent, color: "#fff", border: "none", fontSize: 17, flexShrink: 0 }}>↑</button>
      </div>
    </div>
  </div>);
}

// ── PANTALLA: AJUSTES ────────────────────────────────────────────────
function AjustesScreen({ T, cfg, setCfg, obras = [], setObras, renders = {}, setRenders }) {
  const logoRef = useRef(null);
  async function setLogo(f) { const d = await fileToDataUrl(f, 600); const url = await uploadArchivo(d, "logos", "cliente_logo"); setCfg(p => ({ ...p, logo: url })); }
  // Le pone (o le cambia) el código de acceso a una obra. Ese código es el
  // que se le pasa al dueño para que entre a ver SU obra, y nada más.
  // ── Renders del panel del propietario ─────────────────────────────
  // Se suben acá como imágenes y son las que rotan en el banner y las que
  // se ven en la sección "Renders" de la app del dueño.
  const [obraRender, setObraRender] = useState(obras[0]?.id || "");
  const [subiendoR, setSubiendoR] = useState(false);
  const renderRef = useRef(null);
  const rendersDeObra = (renders || {})[obraRender] || [];
  async function subirRenders(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !obraRender) { if (e.target) e.target.value = ""; return; }
    setSubiendoR(true);
    const nuevos = [];
    for (const f of files) {
      try {
        const data = await fileToDataUrl(f, 1600);
        const url = await uploadArchivo(data, `renders/${obraRender}`, `${Date.now()}_${(f.name || "render").replace(/\W+/g, "_")}`);
        nuevos.push({ id: uid(), nombre: f.name || "Render", url: url || data, ts: Date.now() });
      } catch { }
    }
    if (nuevos.length && setRenders) setRenders(p => ({ ...(p || {}), [obraRender]: [...((p || {})[obraRender] || []), ...nuevos] }));
    setSubiendoR(false);
    if (e.target) e.target.value = "";
    if (!nuevos.length) alert("No pude subir las imágenes. Probá de nuevo.");
  }
  function borrarRender(id) {
    if (!confirm("¿Sacar este render del panel del propietario?")) return;
    if (setRenders) setRenders(p => ({ ...(p || {}), [obraRender]: ((p || {})[obraRender] || []).filter(r => r.id !== id) }));
  }
  const setCodigo = (obraId, valor) => {
    const limpio = String(valor || "").toUpperCase().replace(/\s+/g, "");
    if (setObras) setObras(p => (p || []).map(o => o.id === obraId ? { ...o, codigoCliente: limpio } : o));
  };
  const linkPanel = typeof window !== "undefined" ? `${window.location.origin}/propietario.html` : "/propietario.html";

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <div style={{ padding: "16px 20px" }}>
      <Eyebrow T={T}>Códigos de clientes</Eyebrow>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>
        Cada obra puede tener un código. Se lo pasás al dueño junto con este link y entra a ver solo su obra:
        <span style={{ display: "block", marginTop: 4, color: T.accent, fontWeight: 700, wordBreak: "break-all" }}>{linkPanel}</span>
      </div>
      <Card T={T} style={{ padding: 0, marginBottom: 22, overflow: "hidden" }}>
        {obras.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: T.muted, textAlign: "center" }}>Todavía no hay obras cargadas.</div>}
        {obras.map((o, i) => (<div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderTop: i === 0 ? "none" : `1px solid ${T.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.nombre}</div>
            {o.codigoCliente && <div style={{ fontSize: 10, color: "#16A34A", fontWeight: 700, marginTop: 1 }}>✓ ya tiene código</div>}
          </div>
          <input
            value={o.codigoCliente || ""}
            onChange={e => setCodigo(o.id, e.target.value)}
            placeholder="Sin código"
            style={{ width: 140, flexShrink: 0, background: T.bg, border: `1px solid ${o.codigoCliente ? BRASS : T.border}`, borderRadius: 8, padding: "9px 10px", fontSize: 12.5, fontWeight: 800, color: o.codigoCliente ? T.accent : T.text, textAlign: "center", letterSpacing: "0.04em" }}
          />
        </div>))}
      </Card>

      <Eyebrow T={T}>Renders del panel del propietario</Eyebrow>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Subí acá las imágenes de renders. Son las que pasan como diapositivas en el banner y las que ve el dueño en la sección "Renders".</div>
      <Card T={T} style={{ padding: 13, marginBottom: 22 }}>
        {obras.length === 0
          ? <div style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: 8 }}>Todavía no hay obras cargadas.</div>
          : <>
            <select value={obraRender} onChange={e => setObraRender(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: T.text, marginBottom: 10, boxSizing: "border-box" }}>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <input ref={renderRef} type="file" accept="image/*" multiple onChange={subirRenders} style={{ display: "none" }} />
            <button onClick={() => renderRef.current?.click()} disabled={subiendoR} style={{ width: "100%", background: T.accentLight, border: `1px dashed ${BRASS}`, color: T.accent, borderRadius: 9, padding: "12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: rendersDeObra.length ? 11 : 0 }}>{subiendoR ? "Subiendo…" : "＋ Importar renders (imágenes)"}</button>
            {rendersDeObra.length > 0 && <>
              <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 7 }}>{rendersDeObra.length} render{rendersDeObra.length > 1 ? "s" : ""} · pasan en este orden</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {rendersDeObra.map(r => (<div key={r.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}` }}>
                  <img src={r.url} alt={r.nombre} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                  <button onClick={() => borrarRender(r.id)} style={{ position: "absolute", top: 3, right: 3, background: "rgba(220,38,38,.92)", border: "none", color: "#fff", borderRadius: 6, width: 22, height: 22, fontSize: 12, cursor: "pointer", lineHeight: 1 }}>✕</button>
                </div>))}
              </div>
            </>}
          </>}
      </Card>

      <Eyebrow T={T}>Identidad del cliente</Eyebrow>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Personalizá el nombre y el logo que ve este cliente.</div>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nombre del cliente</label>
      <input value={cfg.nombre} onChange={e => setCfg(p => ({ ...p, nombre: e.target.value }))} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text, margin: "6px 0 14px" }} />
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sigla (sin logo)</label>
      <input value={cfg.sigla} onChange={e => setCfg(p => ({ ...p, sigla: e.target.value }))} maxLength={4} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text, margin: "6px 0 14px" }} />
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Logo</label>
      <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) setLogo(e.target.files[0]); }} />
      <div style={{ display: "flex", gap: 8, margin: "6px 0 14px" }}>
        <button onClick={() => logoRef.current?.click()} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 600, color: T.text }}>{cfg.logo ? "Cambiar logo" : "Subir logo"}</button>
        {cfg.logo && <button onClick={() => setCfg(p => ({ ...p, logo: "" }))} style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", color: "#EF4444", borderRadius: T.rsm, padding: "11px 14px", fontSize: 13, fontWeight: 600 }}>Quitar</button>}
      </div>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tamaño del logo (Inicio)</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 14px" }}>
        <input type="range" min="28" max="120" value={cfg.logoSize || 52} onChange={e => setCfg(p => ({ ...p, logoSize: Number(e.target.value) }))} style={{ flex: 1 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: T.text, width: 32, textAlign: "right" }}>{cfg.logoSize || 52}px</span>
      </div>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Modo</label>
      <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 18 }}>
        <button onClick={() => setCfg(p => { const n = { ...p, modo: "oscuro" }; delete n.themeBg; delete n.themeCard; delete n.themeText; delete n.themeBorder; return n; })} style={{ flex: 1, background: (cfg.modo || "oscuro") === "oscuro" ? T.accent : T.card, color: (cfg.modo || "oscuro") === "oscuro" ? "#fff" : T.text, border: `1px solid ${(cfg.modo || "oscuro") === "oscuro" ? T.accent : T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🌙 Oscuro</button>
        <button onClick={() => setCfg(p => { const n = { ...p, modo: "claro" }; delete n.themeBg; delete n.themeCard; delete n.themeText; delete n.themeBorder; return n; })} style={{ flex: 1, background: cfg.modo === "claro" ? T.accent : T.card, color: cfg.modo === "claro" ? "#fff" : T.text, border: `1px solid ${cfg.modo === "claro" ? T.accent : T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>☀️ Claro</button>
      </div>

      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Color principal</label>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 8 }}>
        {["#B0894F", "#1E3A5F", "#1F5C49", "#6E3B2E", "#46406E", "#0E5A66", "#7A2E50"].map(col => <button key={col} onClick={() => setCfg(p => ({ ...p, accent: col }))} style={{ width: 32, height: 32, borderRadius: 5, background: col, border: `2px solid ${cfg.accent === col ? T.text : T.border}` }} />)}
        <input type="color" value={cfg.accent || "#B0894F"} onChange={e => setCfg(p => ({ ...p, accent: e.target.value }))} style={{ width: 32, height: 32, border: "none", background: "none" }} />
      </div>

      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginTop: 18 }}>Ajuste fino (opcional, encima del modo)</label>
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 14px", marginTop: 8 }}>
        {[
          ["Fondo", "themeBg", (cfg.modo === "claro" ? TEMA_CLARO : TEMA_OSCURO).bg],
          ["Fondo de tarjetas", "themeCard", (cfg.modo === "claro" ? TEMA_CLARO : TEMA_OSCURO).card],
          ["Texto", "themeText", (cfg.modo === "claro" ? TEMA_CLARO : TEMA_OSCURO).text],
          ["Líneas / bordes", "themeBorder", (cfg.modo === "claro" ? TEMA_CLARO : TEMA_OSCURO).border],
        ].map(([lbl, key, def]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
            <span style={{ fontSize: 12.5, color: T.text }}>{lbl}</span>
            <input type="color" value={cfg[key] || def} onChange={e => setCfg(p => ({ ...p, [key]: e.target.value }))} style={{ width: 32, height: 26, border: `1px solid ${T.border}`, borderRadius: 5, background: "none", cursor: "pointer", padding: 0 }} />
          </div>
        ))}
        <button onClick={() => setCfg(p => { const n = { ...p }; delete n.themeBg; delete n.themeCard; delete n.themeText; delete n.themeBorder; n.accent = "#B0894F"; return n; })} style={{ width: "100%", marginTop: 10, background: T.card, border: `1px solid ${T.border}`, color: T.text, borderRadius: 7, padding: "9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Restaurar colores del modo actual</button>
      </div>
      <div style={{ marginTop: 22, marginBottom: 8 }}><label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Agente IA</label></div>
      <div onClick={() => setCfg(p => ({ ...p, autoIA: !p.autoIA }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 14px", cursor: "pointer" }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>Responder pedidos automáticamente con IA</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.5 }}>El asistente contesta solo los pedidos de V+V (hasta {PEDIDO_MAX_IA} idas y vueltas). Consume tu cuota de API.</div></div>
        <div style={{ width: 44, height: 26, borderRadius: 14, background: cfg.autoIA ? "#16A34A" : T.border, position: "relative", flexShrink: 0, transition: "background .2s" }}><div style={{ position: "absolute", top: 3, left: cfg.autoIA ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} /></div>
      </div>
      <div style={{ marginTop: 22, marginBottom: 8 }}><label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Comunicación entre IA</label></div>
      <div onClick={() => setCfg(prev => ({ ...prev, iaAuto: !prev.iaAuto }))} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px", cursor: "pointer" }}>
        <div style={{ minWidth: 0, paddingRight: 12 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>Respuesta automática entre IA {cfg.iaAuto === false ? "(apagada)" : ""}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.45 }}>Prendida: cuando le pedís algo a la IA de V+V, responde sola. Es segura: responde una vez y se frena si no hay crédito. Apagala solo si querés silencio total.</div></div>
        <div style={{ width: 44, height: 26, borderRadius: 13, background: cfg.iaAuto === false ? T.border : "#16A34A", position: "relative", flexShrink: 0 }}><div style={{ position: "absolute", top: 3, left: cfg.iaAuto === false ? 3 : 21, width: 20, height: 20, borderRadius: "50%", background: "#fff" }} /></div>
      </div>
      <div style={{ marginTop: 22, marginBottom: 8 }}><label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Contraseña del resumen económico</label></div>
      <input value={cfg.ecoPin || ""} onChange={e => setCfg(p => ({ ...p, ecoPin: e.target.value }))} placeholder="2025" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text, margin: "6px 0 4px" }} />
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>Protege los montos (Contratado, Certificado, Saldo) en la pantalla Obra. Si lo dejás vacío, la contraseña es 2025.</div>
      <div style={{ marginTop: 22, marginBottom: 8 }}><label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Actualizaciones</label></div>
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 14px" }}>
        <div style={{ fontSize: 12.5, color: T.text, marginBottom: 4 }}>Versión instalada: <b>build 30-07-fixavance</b></div>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 11, lineHeight: 1.5 }}>Trae la última versión y todo lo último que cargó V+V (obras, informes, formularios, archivos). Limpia la caché.</div>
        <button onClick={() => { try { if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))); } catch (e) { } location.replace(location.pathname + "?sync=" + Date.now()); }} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: T.rsm, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Actualizar y traer lo último</button>
      </div>
      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 24, lineHeight: 1.5, textAlign: "center" }}>App de cliente · sincronizada con V+V Construcciones.</div>
    </div>
  </div>);
}

// ── TOAST ────────────────────────────────────────────────────────────
function Toast({ T, toast }) {
  if (!toast) return null;
  return (<div style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 500, background: T.navy, color: "#fff", borderRadius: 12, padding: "12px 18px", boxShadow: "0 8px 28px rgba(0,0,0,.3)", borderBottom: `2px solid ${BRASS}`, animation: "slidein .35s ease", display: "flex", alignItems: "center", gap: 10, maxWidth: 360 }}>
    <span style={{ fontSize: 18 }}><Ico n="chat" /> </span><span style={{ fontSize: 13, fontWeight: 600 }}>{toast}</span>
  </div>);
}

const NAV = [{ id: "inicio", label: "Inicio", icon: "M11.47 3.841a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.061l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 101.061 1.061l8.69-8.69z" }, { id: "asistente", label: "IA", icon: "M12 3a4 4 0 014 4v1a4 4 0 01-8 0V7a4 4 0 014-4zM5 21a7 7 0 0114 0" }, { id: "obras", label: "Obras", icon: "M3 21h18M5 21V7l7-4 7 4v14M10 21v-5h4v5" }, { id: "avance", label: "Avance", icon: "M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" }, { id: "informes", label: "Informes", icon: "M8 3h8l2 4v14H6V7z" }, { id: "cronograma", label: "Cronogramas", icon: "M3 5h18M3 10h12M3 15h15M3 20h8" }, { id: "bitacora", label: "Bitácora", icon: "M5 3h11l3 3v15H5zM9 8h7M9 12h7M9 16h4" }, { id: "auditoria", label: "Auditoría", icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z M9.5 12l1.8 1.8L15 10" }, { id: "mensajes", label: "Mensajes", icon: "M4 5h16v11H8l-4 4z" }, { id: "materiales", label: "Pedidos recibidos", icon: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7" }, { id: "formularios", label: "Certificados", icon: "M5 3h14v18H5zM9 7h6M9 11h6M9 15h4" }, { id: "archivos", label: "Archivos", icon: "M3 7h6l2 2h10v10H3z" }, { id: "personal", label: "Personal", icon: "M12 9a3 3 0 100 6 3 3 0 000-6z" }, { id: "gestion", label: "Gestión", icon: "M4 20V10M10 20V4M16 20v-7" }, { id: "minutas", label: "Grabar reunión", icon: "M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3z M5 11a7 7 0 0014 0 M12 18v3" }, { id: "ajustes", label: "Ajustes", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM12 4v2M12 18v2M4 12h2M18 12h2" }];

// ── PANTALLA: ASISTENTE IA ───────────────────────────────────────────
function AsistenteScreen({ T, cfg, apiKey, obras, tareas, msgs, setMsgs, pedidos, setPedidos, personal, setPersonal, mensajes, contactos = [], formularios = [], matpedidos = [], documentacion = [], certif = {}, bitacora = [], onPedidos, onMinutas }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const [escuchando, setEscuchando] = useState(false);
  const recRef = useRef(null);
  const sttOk = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const ttsOk = typeof window !== "undefined" && "speechSynthesis" in window;
  const [narrarAuto, setNarrarAuto] = useState(() => { try { return localStorage.getItem("cliente_narrar_auto") === "1"; } catch { return false; } });
  const [hablando, setHablando] = useState(false);
  const ultimoNarrado = useRef(null);
  function limpiarParaVoz(texto) {
    return String(texto || "")
      .replace(/```accion[\s\S]*?```/g, "")
      .replace(/[*_#`]/g, "")
      .replace(/https?:\/\/\S+/g, "un link")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, ". ")
      .trim();
  }
  function hablar(texto) {
    if (!ttsOk) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(limpiarParaVoz(texto));
      u.lang = "es-AR";
      u.rate = 1.02;
      const voces = window.speechSynthesis.getVoices();
      const voz = voces.find(v => v.lang === "es-AR") || voces.find(v => (v.lang || "").startsWith("es"));
      if (voz) u.voice = voz;
      u.onstart = () => setHablando(true);
      u.onend = () => setHablando(false);
      u.onerror = () => setHablando(false);
      window.speechSynthesis.speak(u);
    } catch { }
  }
  function pararVoz() { try { window.speechSynthesis.cancel(); } catch { } setHablando(false); }
  function toggleNarrarAuto() {
    setNarrarAuto(v => { const nv = !v; try { localStorage.setItem("cliente_narrar_auto", nv ? "1" : "0"); } catch { } if (!nv) pararVoz(); return nv; });
  }
  // narra sola la última respuesta de la IA, si el modo automático está prendido
  useEffect(() => {
    if (!narrarAuto || !ttsOk) return;
    const ult = msgs[msgs.length - 1];
    if (!ult || ult.role !== "assistant" || loading) return;
    const clave = ult.id || ult.ts || msgs.length;
    if (ultimoNarrado.current === clave) return;
    ultimoNarrado.current = clave;
    const texto = (Array.isArray(ult.content) ? (ult.content.find(b => b.type === "text")?.text || "") : ult.content) + (ult.accionResultado ? ". " + ult.accionResultado : "");
    hablar(texto);
  }, [msgs, loading, narrarAuto]);
  const [adj, setAdj] = useState([]);
  const [subiendoAdj, setSubiendoAdj] = useState(false);
  const fileRef = useRef(null);
  async function addAdj(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setSubiendoAdj(true);
    const nuevos = [];
    for (const f of files) {
      const data = await fileToDataUrl(f);
      const url = await uploadArchivo(data, "ia-chat", f.name.replace(/\W+/g, "_"));
      nuevos.push({ nombre: f.name, url, esImagen: (f.type || "").startsWith("image/"), dataUrl: data });
    }
    setAdj(p => [...p, ...nuevos]);
    setSubiendoAdj(false);
    e.target.value = "";
  }
  async function descargarMinuta(texto) {
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const filas = esc(texto).split("\n").map(l => l.trim() ? `<p style="margin:0 0 6px">${l}</p>` : "").join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Minuta de reunión</title></head><body style="font-family:Calibri,Arial,sans-serif;color:#0F1B2D;padding:20px;line-height:1.5">${filas}</body></html>`;
    const nombre = `Minuta_${hoyStr().replace(/\//g, "-")}.doc`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    try {
      const file = new File([blob], nombre, { type: "application/msword" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: nombre }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function toggleVoz() {
    if (!sttOk) return;
    if (escuchando) { recRef.current?.stop(); setEscuchando(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR(); rec.lang = "es-AR"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = e => { const txt = e.results[0][0].transcript; setInput(p => (p ? p + " " : "") + txt); };
    rec.onend = () => setEscuchando(false);
    rec.onerror = () => setEscuchando(false);
    recRef.current = rec; rec.start(); setEscuchando(true);
  }
  const cnDeb = "V+V";
  const DEBATE_MAX = 18;
  const [debateOpen, setDebateOpen] = useState(false);
  const [debateTema, setDebateTema] = useState("");
  const [debateActive, setDebateActive] = useState(false);
  const debateBusy = useRef(false);
  const debateSeen = useRef(0);
  async function saveDebate(deb) { try { localStorage.setItem("ia_debate", JSON.stringify(deb)); } catch { } await storage.set("ia_debate", JSON.stringify(deb)).catch(() => { }); }
  async function runDebateTurn() {
    if (debateBusy.current) return;
    debateBusy.current = true;
    try {
      const r = await storage.get("ia_debate"); const deb = r?.value ? JSON.parse(r.value) : null;
      if (!deb || !deb.active) { setDebateActive(false); debateBusy.current = false; return; }
      if ((deb.turnos || []).length >= deb.maxTurnos) { deb.active = false; await saveDebate(deb); setDebateActive(false); debateBusy.current = false; return; }
      const last = deb.turnos[deb.turnos.length - 1];
      const myTurn = deb.turnos.length === 0 ? deb.startedBy === "cliente" : last.from !== "cliente";
      if (!myTurn) { debateBusy.current = false; return; }
      const convo = deb.turnos.map(t => `${t.from === "cliente" ? (cfg.sigla || "Belfast") : cnDeb}: ${t.texto}`).join("\n");
      const sysD = `Sos la IA de ${cfg.nombre} en una CHARLA TÉCNICA con la IA de V+V Construcciones sobre: "${deb.tema}". Es colaborativa: ambas suman y profundizan (no discuten). Aportá EL SIGUIENTE turno: información nueva y concreta, profundizá un aspecto no tocado, y cerrá con un gancho o pregunta para que la otra IA siga. NO repitas lo ya dicho. Español rioplatense, tono técnico de construcción. Máximo 3-4 oraciones.`;
      const userD = deb.turnos.length === 0 ? `Arrancá la charla técnica sobre "${deb.tema}".` : `Charla hasta ahora:\n${convo}\n\nDá tu siguiente intervención.`;
      const resp = await callAI([{ role: "user", content: userD }], sysD, apiKey, false);
      if (/credit balance|too low to access|Plans & Billing|purchase credits|is too low/i.test(String(resp || ""))) {
        const rE = await storage.get("ia_debate"); const debE = rE?.value ? JSON.parse(rE.value) : deb;
        debE.active = false; await saveDebate(debE); setDebateActive(false);
        setMsgs(prev => [...prev, { role: "assistant", content: "Debate frenado: no hay crédito de API disponible. Recargá créditos en console.anthropic.com y volvé a intentar.", debate: true }]);
        debateBusy.current = false; return;
      }
      const r2 = await storage.get("ia_debate"); const deb2 = r2?.value ? JSON.parse(r2.value) : deb;
      if (!deb2.active) { setDebateActive(false); debateBusy.current = false; return; }
      deb2.turnos = [...(deb2.turnos || []), { from: "cliente", texto: (resp || "").trim(), ts: Date.now() }];
      if (deb2.turnos.length >= deb2.maxTurnos) deb2.active = false;
      await saveDebate(deb2);
    } catch { }
    debateBusy.current = false;
  }
  async function startDebate() {
    const tema = debateTema.trim(); if (!tema) return;
    const deb = { active: true, tema, turnos: [], maxTurnos: DEBATE_MAX, startedBy: "cliente", ts: Date.now() };
    await saveDebate(deb); debateSeen.current = 0; setDebateActive(true); setDebateOpen(false); setDebateTema("");
    setMsgs(prev => [...prev, { role: "assistant", content: `Debate técnico iniciado con la IA de V+V: "${tema}". Dejá las dos apps abiertas y mirá cómo se van respondiendo en vivo.`, debate: true }]);
    runDebateTurn();
  }
  async function stopDebate() {
    const r = await storage.get("ia_debate"); const deb = r?.value ? JSON.parse(r.value) : null;
    if (deb) { deb.active = false; await saveDebate(deb); }
    setDebateActive(false); setMsgs(prev => [...prev, { role: "assistant", content: "Debate frenado.", debate: true }]);
  }
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await storage.get("ia_debate"); const deb = r?.value ? JSON.parse(r.value) : null;
        if (!deb) return;
        if ((deb.turnos || []).length > debateSeen.current) {
          const nuevos = deb.turnos.slice(debateSeen.current); debateSeen.current = deb.turnos.length;
          setMsgs(prev => [...prev, ...nuevos.map(t => ({ role: "assistant", content: `IA ${t.from === "cliente" ? (cfg.sigla || "Belfast") : cnDeb}: ${t.texto}`, debate: true }))]);
          if (!deb.active && (deb.turnos || []).length >= deb.maxTurnos) setMsgs(prev => [...prev, { role: "assistant", content: "Debate finalizado.", debate: true }]);
        }
        if (deb.active && (deb.turnos || []).length < deb.maxTurnos) {
          const last = deb.turnos[deb.turnos.length - 1];
          const myTurn = deb.turnos.length === 0 ? deb.startedBy === "cliente" : last.from !== "cliente";
          if (myTurn) runDebateTurn();
        }
        setDebateActive(!!deb.active);
      } catch { }
    }, 7000);
    return () => clearInterval(iv);
  }, []);
  const pend = (pedidos || []).filter(p => p.para === "cliente" && p.estado !== "resuelto");
  const pendObras = [...new Set(pend.map(p => p.obra_id ? (obras.find(o => o.id === p.obra_id)?.nombre || "") : "general").filter(Boolean))].join(", ");
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);
  function sys() {
    const ob = obras.map(o => `· ${o.nombre} (${o.sector}, ${o.estado}, avance ${o.avance}%, contratado ${o.monto}, certificado ${money(o.pagado)})`).join("\n");
    const ped = (pedidos || []).filter(p => p.estado !== "resuelto").slice(0, 20).map(p => `· [${p.id}] "${p.asunto}" (${p.de === "cliente" ? "enviado a V+V" : "recibido de V+V"}, estado ${p.estado}) — último: ${(p.hilo || [])[(p.hilo || []).length - 1]?.texto?.slice(0, 80) || ""}`).join("\n");
    const per = (personal || []).map(p => `· ${p.nombre} — ${p.rol || ""} (obra ${obras.find(o => o.id === p.obra_id)?.nombre || "—"})${p.telefono ? ` · tel ${p.telefono}` : ""}${p.dni ? ` · DNI ${p.dni}` : ""}${p.cuil ? ` · CUIL ${p.cuil}` : ""}${(p.sitios || []).length ? ` [cargado en: ${p.sitios.map(s => s.sitio).join(", ")}]` : ""}`).join("\n");
    const msj = (mensajes || []).slice(-8).map(m => `· ${m.from === "cliente" ? "Nosotros" : "V+V"}: ${(m.texto || "").slice(0, 110)}`).join("\n");
    return `Sos el ASISTENTE de ${cfg.nombre} (comitente), en contacto con V+V Construcciones (la empresa que ejecuta la obra). Español rioplatense, claro y cordial. Estás CONECTADO a los mismos datos y al asistente de V+V: comparten la base de datos en tiempo real (obras, personal, pedidos, mensajes); ves lo que carga la otra empresa y ellos ven lo que cargás vos. NUNCA digas que no podés comunicarte con V+V ni con su asistente: SÍ podés, mandándoles un mensaje directo (les aparece en su pantalla de Mensajes) y ellos te responden. REGLA CLAVE: si te piden COMUNICARTE, HABLAR, AVISAR, DECIRLE o PREGUNTARLE algo a V+V, usá SIEMPRE la acción "enviar_mensaje" (se envía directo). "crear_pedido" es solo para pedidos formales de definiciones/documentación. También podés: informar sobre el avance de las obras, GESTIONAR PEDIDOS, cargar PERSONAL a los sitios/barrios (vos tramitás el acceso a los barrios privados), MANDAR WHATSAPP a los jefes de obra/contactos (usás la agenda de Personal → Contactos), y BUSCAR EN INTERNET información actual (normativa, código de edificación, proveedores, precios, datos de empresas). Cuando "Buscar en internet" está activo, tenés herramientas REALES de búsqueda y de LECTURA DE PÁGINAS WEB COMPLETAS (no simuladas) — si te pasan un link puntual, ABRÍLO y contá lo que dice; nunca respondas que no podés acceder a un link o que no tenés navegador, eso no es cierto cuando el check está activo. Priorizá fuentes argentinas y citá la fuente.

MINUTAS DE REUNIÓN: si te piden armar, redactar o pasar en limpio una minuta de reunión (por texto o dictada), pedí — solo si no te lo dieron — obra, fecha y quiénes participaron, y con eso redactá la minuta directo, con esta estructura fija:
MINUTA DE REUNIÓN
Obra: · Fecha: · Participantes:
TEMAS TRATADOS (numerados, un renglón por tema con lo relevante)
ACUERDOS / DECISIONES (numerados)
PENDIENTES (numerados, con quién queda a cargo si se dijo)
Sé fiel a lo que te contaron — no inventes acuerdos ni asistentes que no se mencionaron. Si dictan la reunión de corrido y desordenada, ordenala vos en esa estructura sin agregar nada que no se haya dicho.

OBRAS:\n${ob || "(sin obras)"}

PERSONAL:\n${per || "(sin personal)"}

MENSAJES RECIENTES con V+V:\n${msj || "(sin mensajes)"}

PEDIDOS ABIERTOS (con id):\n${ped || "(ninguno)"}

FORMULARIOS:\n${(formularios || []).map(f => `· ${(FORM_TPLS.find(t => t.id === f.tplId) || {}).nombre || "Formulario"} — ${obras.find(o => o.id === f.obra_id)?.nombre || "—"} (${f.fecha}${f.resultado ? ", " + f.resultado : ""}${f.compartido ? ", compartido" : ", borrador"})`).join("\n") || "(sin formularios)"}

ARCHIVOS DE OBRA:\n${obras.flatMap(o => (o.archivos || []).map(a => `· ${a.nombre} (obra ${o.nombre})`)).join("\n") || "(sin archivos)"}

DOCUMENTACIÓN (modelos):\n${(documentacion || []).map(d => `· ${d.nombre} [${d.cat}]`).join("\n") || "(sin documentación)"}

FOTOS Y VIDEOS POR OBRA:\n${obras.map(o => `· ${o.nombre}: ${(o.fotos || []).length} fotos, ${(o.videos || []).length} videos`).join("\n") || "(sin obras)"}

INFORMES TÉCNICOS POR OBRA (del más nuevo al más viejo):\n${obras.map(o => {
      const infs = (o.informes || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
      if (!infs.length) return null;
      return `· ${o.nombre}:\n${infs.map(i => `  - "${i.titulo || i.nombre || "Informe"}" [${i.tipo || "—"}] ${i.fecha || ""}${i.notas ? ` — ${i.notas}` : ""}`).join("\n")}`;
    }).filter(Boolean).join("\n") || "(sin informes cargados en ninguna obra)"}

CERTIFICADOS SEMANALES POR OBRA (del más nuevo al más viejo — resumen de avance de cada semana):\n${obras.map(o => {
      const cs = ((certif || {})[o.id] || []).slice().sort((a, b) => String(b.desde || "").localeCompare(String(a.desde || "")));
      if (!cs.length) return null;
      return `· ${o.nombre}:\n${cs.map(c => `  - Semana ${c.desde || "?"} al ${c.hasta || "?"}${c.desarrollo ? ` — ${String(c.desarrollo).slice(0, 100)}` : ""}`).join("\n")}`;
    }).filter(Boolean).join("\n") || "(sin certificados semanales cargados)"}

BITÁCORA DE OBRA POR OBRA (del más nuevo al más viejo — hechos y novedades del día a día):\n${obras.map(o => {
      const hs = (bitacora || []).filter(h => h.obra_id === o.id).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.ts || 0) - (a.ts || 0)));
      if (!hs.length) return null;
      return `· ${o.nombre}:\n${hs.map(h => `  - ${h.fecha}: "${h.titulo || "Hecho"}"${h.desc ? ` — ${String(h.desc).slice(0, 160)}` : ""}`).join("\n")}`;
    }).filter(Boolean).join("\n") || "(sin bitácora cargada en ninguna obra)"}

PLANOS POR OBRA:\n${obras.map(o => (o.planos || []).length ? `· ${o.nombre}: ${(o.planos || []).map(p => p.nombre).join(", ")}` : null).filter(Boolean).join("\n") || "(sin planos cargados)"}

TAREAS / CRONOGRAMA:\n${(tareas || []).map(t => `· ${t.nombre} — ${obras.find(o => o.id === t.obra_id)?.nombre || "—"} (${t.avance || 0}%)`).join("\n") || "(sin tareas)"}

PEDIDOS DE MATERIALES:\n${(matpedidos || []).map(p => `· ${obras.find(o => o.id === p.obra_id)?.nombre || "—"} (${p.fecha}): ${(p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ")}`).join("\n") || "(sin pedidos de materiales)"}

Tenés acceso COMPLETO y AL DETALLE de todos estos datos (obras, avances, montos, fotos, informes con título/tipo/fecha, certificados semanales, bitácora de obra, formularios, archivos, documentación, tareas, materiales, personal, contactos, pedidos). Nunca digas "no tengo acceso", "no lo puedo ver" o "no lo tengo en mi base de datos" a algo que está en este contexto — está TODO arriba, con contenido real, no solo cantidades: informes con título y fecha, certificados semanales con su resumen, bitácora con título y descripción de cada hecho. Si te piden "los últimos informes", "la última bitácora", "el certificado semanal" o "qué se cargó últimamente", mirá la lista correspondiente (ya están ordenadas de la más nueva a la más vieja) y respondé con el contenido real, no derives el pedido a nadie. Las fotos y videos no los "ves" uno por uno, pero sabés cuántos hay y de qué obra.

PROTOCOLO — cuando el usuario te pida una acción, respondé natural y AGREGÁ AL FINAL un bloque entre \`\`\`accion y \`\`\` con JSON, una de:
{"tipo":"crear_pedido","para":"vv","asunto":"...","detalle":"...","prioridad":"alta|media|baja","obra":"nombre de la obra de la que se trata"}
{"tipo":"responder_pedido","pedido_id":"ID","texto":"..."}
{"tipo":"resolver_pedido","pedido_id":"ID"}
{"tipo":"enviar_mensaje","texto":"el mensaje para V+V"}
{"tipo":"preguntar_ia","texto":"la consulta para la IA de V+V"}
{"tipo":"cargar_personal","sitio":"nombre del barrio/sitio","personal":"todos" | ["Nombre1","Nombre2"], "obra":"opcional: cargar todos los de esa obra"}
{"tipo":"whatsapp","persona":"nombre o rol del jefe de obra/contacto","obra":"opcional","texto":"el mensaje a enviar por WhatsApp"}
{"tipo":"traer_fotos","obra":"nombre de la obra","cantidad":1,"videos":false}
{"tipo":"traer_plano","obra":"nombre de la obra","buscar":"palabras clave (ej: replanteo platea)"}
{"tipo":"traer_informe","obra":"nombre de la obra","cantidad":1,"buscar":"palabras clave opcional (ej: hormigón, seguridad)"}
{"tipo":"traer_certificado","obra":"nombre de la obra","cantidad":1}
REGLA fotos: si te piden VER/MANDAR/PASAR fotos o videos de una obra (ej: "mandame la última foto de Castores"), usá "traer_fotos" con la obra y cantidad (1 = la última). videos:true si piden videos. Aparecen directo en el chat.
REGLA planos: si te piden un PLANO (PDF/CAD) de una obra (ej: "necesito el plano de replanteo de platea de Castores 475"), usá "traer_plano" con la obra y "buscar" (palabras clave). El plano aparece en el chat para abrir/descargar.
REGLA informes: si te piden el/los INFORME(S), o el "PDF de informes", o "lo último cargado" de una obra (ej: "mandame el último informe de Golf 293", "pasame el pdf del informe de seguridad de Castores"), usá "traer_informe" con la obra, cantidad (1 = el último) y "buscar" si dieron palabras clave (tipo, tema). Aparece directo en el chat para abrir/descargar — NUNCA digas que no podés mandarlo, siempre está ahí para traer.
REGLA certificados semanales: si te piden el/los CERTIFICADO(S) SEMANAL(ES) o "certificado de avance" de una obra (ej: "el último certificado semanal de Castores"), usá "traer_certificado" con la obra y cantidad. El contenido completo (desarrollo, recepciones, limpieza, alertas y fotos) se pega directo en el chat, no como archivo aparte — NUNCA digas que no tenés acceso ni que no podés generar un PDF, siempre está ahí para traer.
REGLA WhatsApp: si te piden MANDAR UN WHATSAPP a un jefe de obra o contacto, usá "whatsapp". Uso tu agenda (Personal → Contactos) y el personal de la obra. Te dejo el botón de WhatsApp listo para enviar.
REGLA CLAVE — elegí bien la acción:
- CANAL IA↔IA ("preguntar_ia"): SIEMPRE que involucre a la IA / el asistente de V+V o esperes que te devuelvan un DATO. Ejemplos: "preguntale a la IA de V+V…", "pedile a la IA de V+V…", "pedícelo/pedíselo a la IA…", "consultale al asistente de V+V…", "que la IA de V+V te pase/averigüe…". OJO: "pedile/pedícelo A LA IA" es SIEMPRE este canal (preguntar_ia), NO un crear_pedido. Va directo a la otra IA, que responde sola. ESTE es el canal entre las dos IA.
- CONVENCIÓN DEL USUARIO (IMPORTANTE): por defecto, cuando el usuario diga "pedile", "pedido", "pedícelo", "pedíselo" o "pedir" algo, SE REFIERE a consultarle a la IA de V+V → usá "preguntar_ia". Solo usá "crear_pedido" si el usuario aclara EXPLÍCITAMENTE que quiere un "pedido formal", una "nota de pedido" o documentación oficial.
- MENSAJE A LA PERSONA ("enviar_mensaje"): SOLO para un aviso/recado que lea un HUMANO de V+V en Mensajes, sin esperar datos. Ej: "avisale a V+V que…". Si dudás y mencionan "la IA/el asistente" o quieren respuesta con datos → preguntar_ia.
BANCOS DE DATOS CONECTADOS: primero respondé con TUS datos. Usá "preguntar_ia" si te lo piden o si el dato realmente no está y solo lo tendría V+V. Para info de internet, búsqueda web.
Usá solo ids/nombres reales. Sin acción concreta, no agregues el bloque.`;
  }
  async function send(texto) {
    const c = (texto ?? input).trim(); const adjActuales = texto != null ? [] : adj; if (!c && adjActuales.length === 0) return; if (loading) return;
    setInput(""); if (texto == null) setAdj([]);
    // Contenido para la IA: texto + imágenes en base64 (las ve de verdad) + links de otros archivos.
    const imgs = adjActuales.filter(a => a.esImagen && a.dataUrl);
    const otros = adjActuales.filter(a => !(a.esImagen && a.dataUrl));
    let contenidoIA = c;
    if (otros.length) contenidoIA += (contenidoIA ? "\n\n" : "") + otros.map(a => `[Archivo adjunto: ${a.nombre} — ${a.url || "no se pudo subir"}]`).join("\n");
    const contentBlocks = imgs.length
      ? [{ type: "text", text: contenidoIA || "Mirá este archivo." }, ...imgs.map(a => ({ type: "image", source: { type: "base64", media_type: (a.dataUrl.match(/^data:(.*?);/) || [, "image/jpeg"])[1], data: a.dataUrl.split(",")[1] } }))]
      : contenidoIA;
    const next = [...msgs, { role: "user", content: contentBlocks, docs: adjActuales.length ? adjActuales.map(a => ({ nombre: a.nombre, url: a.url })) : undefined }]; setMsgs(next); setLoading(true);
    const r = await callAI(next, sys(), apiKey, true);
    const { limpio, accion } = parseAccion(r);
    let extra = {};
    if (accion && accion.tipo === "traer_plano") {
      const target = accion.obra ? (obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase())) : (obras || [])[0];
      const planos = (target && target.planos) || [];
      const kw = String(accion.buscar || "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let match = kw.length ? planos.filter(p => kw.some(w => (p.nombre || "").toLowerCase().includes(w))) : planos;
      let res, docs;
      if (!target) { res = "No encontré esa obra."; docs = []; }
      else if (!planos.length) { res = `${target.nombre} no tiene planos cargados. Subilos en la obra → Ver detalle → Planos.`; docs = []; }
      else if (!match.length) { res = `No encontré un plano que coincida con "${accion.buscar}" en ${target.nombre}. Te dejo todos:`; docs = planos.map(p => ({ nombre: p.nombre, url: p.url })); }
      else { res = `Acá tenés ${match.length === 1 ? "el plano" : "los planos"} de ${target.nombre}${accion.buscar ? ` (${accion.buscar})` : ""}:`; docs = match.map(p => ({ nombre: p.nombre, url: p.url })); }
      extra = { accionDone: true, accionResultado: res, docs };
    } else if (accion && accion.tipo === "traer_informe") {
      const target = accion.obra ? (obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase())) : (obras || [])[0];
      const infs = ((target && target.informes) || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const kw = String(accion.buscar || "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let match = kw.length ? infs.filter(i => kw.some(w => `${i.titulo || ""} ${i.tipo || ""} ${i.notas || ""}`.toLowerCase().includes(w))) : infs;
      const cant = Math.max(1, Math.min(accion.cantidad || 1, 12));
      match = match.slice(0, cant);
      let res, docs;
      if (!target) { res = "No encontré esa obra."; docs = []; }
      else if (!infs.length) { res = `${target.nombre} todavía no tiene informes cargados.`; docs = []; }
      else if (!match.length) { res = `No encontré un informe que coincida con "${accion.buscar}" en ${target.nombre}. Te dejo el último cargado:`; docs = infs.slice(0, 1).map(i => ({ nombre: i.titulo || i.nombre || "Informe", url: i.url })); }
      else { res = `Acá tenés ${match.length === 1 ? "el informe" : `los últimos ${match.length} informes`} de ${target.nombre}${accion.buscar ? ` (${accion.buscar})` : ""}:`; docs = match.map(i => ({ nombre: `${i.titulo || i.nombre || "Informe"}${i.fecha ? ` — ${i.fecha}` : ""}`, url: i.url })); }
      extra = { accionDone: true, accionResultado: res, docs };
    } else if (accion && accion.tipo === "traer_certificado") {
      const target = accion.obra ? (obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase())) : (obras || [])[0];
      const cs = (((certif || {})[target?.id]) || []).slice().sort((a, b) => String(b.desde || "").localeCompare(String(a.desde || "")));
      const cant = Math.max(1, Math.min(accion.cantidad || 1, 12));
      const match = cs.slice(0, cant);
      let res, media = [], texto = "";
      if (!target) { res = "No encontré esa obra."; }
      else if (!cs.length) { res = `${target.nombre} todavía no tiene certificados semanales cargados.`; }
      else {
        res = `Acá tenés ${match.length === 1 ? "el certificado semanal" : `los últimos ${match.length} certificados semanales`} de ${target.nombre}:`;
        texto = match.map(item => {
          const partes = [`📋 CERTIFICADO SEMANAL — ${target.nombre}\nSemana ${fFechaCorta(item.desde)} al ${fFechaCorta(item.hasta)}`];
          if (item.desarrollo) partes.push(`Desarrollo:\n${item.desarrollo}`);
          if (item.recepciones) partes.push(`Recepciones:\n${item.recepciones}`);
          if (item.limpieza) partes.push(`Limpieza y seguridad:\n${item.limpieza}`);
          if (item.alertas) partes.push(`Alertas:\n${item.alertas}`);
          media.push(...(item.av || []).flatMap(a => (a.fotos && a.fotos.length) ? a.fotos : (a.fotoUrl ? [a.fotoUrl] : [])));
          return partes.join("\n\n");
        }).join("\n\n———\n\n");
      }
      extra = { accionDone: true, accionResultado: res, contentExtra: texto, media: media.length ? media : undefined, mediaTipo: media.length ? "fotos" : undefined };
    } else if (accion && accion.tipo === "traer_fotos") {
      const target = accion.obra ? (obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase())) : (obras || [])[0];
      const tipoMedia = accion.videos ? "videos" : "fotos";
      const cant = Math.max(1, Math.min(accion.cantidad || 3, 12));
      const media = ((target && target[tipoMedia]) || []).slice(-cant).reverse().map(f => f.url || f).filter(Boolean);
      let res;
      if (!target) res = "No encontré esa obra.";
      else if (!media.length) res = `${target.nombre} no tiene ${tipoMedia} cargadas todavía.`;
      else res = `Acá tenés ${media.length === 1 ? (tipoMedia === "videos" ? "el último video" : "la última foto") : `${media.length} ${tipoMedia}`} de ${target.nombre}:`;
      extra = { accionDone: true, accionResultado: res, media, mediaTipo: tipoMedia };
    } else if (accion && accion.tipo === "whatsapp") {
      const q = String(accion.persona || accion.rol || "").toLowerCase();
      const obraId = accion.obra ? (obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase()))?.id : null;
      const pool = [...(contactos || []), ...(personal || [])];
      let per = q ? pool.find(p => (p.nombre || "").toLowerCase().includes(q)) : null;
      if (!per && obraId) per = pool.find(p => p.obra_id === obraId && (p.telefono || "").trim());
      if (!per && q) per = pool.find(p => (p.rol || "").toLowerCase().includes(q) && (p.telefono || "").trim());
      const t = encodeURIComponent(accion.texto || "");
      let url, label, res;
      if (per && (per.telefono || "").trim()) { const clean = String(per.telefono).replace(/\D/g, ""); const num = clean.startsWith("54") ? clean : ("549" + clean); url = `https://wa.me/${num}?text=${t}`; label = `Enviar a ${per.nombre}`; res = `WhatsApp listo para ${per.nombre}${per.telefono ? " (" + per.telefono + ")" : ""}.`; }
      else { url = `https://wa.me/?text=${t}`; label = "Abrir WhatsApp"; res = per ? `${per.nombre} no tiene teléfono cargado. Abrí WhatsApp y elegí el contacto.` : "No encontré a esa persona con teléfono. Cargala en Personal → Contactos, o elegí el contacto."; }
      extra = { accionDone: true, accionResultado: res, waLink: url, waLabel: label };
    } else if (accion) { const res = await ejecutarAccion(accion, "cliente", { setPedidos, personal, setPersonal, obras }); extra = { accion, accionDone: true, accionResultado: res || "Hecho." }; }
    setMsgs([...next, { role: "assistant", content: limpio + (extra.contentExtra ? "\n\n" + extra.contentExtra : ""), ...extra }]); setLoading(false);
  }
  async function confirmAccion(idx) { const m = msgs[idx]; if (!m?.accion) return; const res = await ejecutarAccion(m.accion, "cliente", { setPedidos, personal, setPersonal, obras }); setMsgs(prev => prev.map((x, i) => i === idx ? { ...x, accionDone: true, accionResultado: res || "Acción ejecutada." } : x)); }
  function descartarAccion(idx) { setMsgs(prev => prev.map((x, i) => i === idx ? { ...x, accion: null, accionDescartada: true } : x)); }
  // ── Canal directo IA↔IA: muestra lo que consulta/responde V+V y responde solo ──
  const ctxRef = useRef("");
  ctxRef.current = `OBRAS:\n${(obras || []).map(o => `· ${o.nombre} (${o.sector}, ${o.estado}, avance ${o.avance}%, contratado ${o.monto}, certificado ${money(o.pagado)}, ${(o.fotos || []).length} fotos, ${(o.videos || []).length} videos, ${(o.informes || []).length} informes)`).join("\n") || "(sin obras)"}\n\nPERSONAL:\n${(personal || []).map(p => `· ${p.nombre} — ${p.rol || ""} (obra ${obras.find(o => o.id === p.obra_id)?.nombre || "—"})${(p.sitios || []).length ? ` [en: ${p.sitios.map(s => s.sitio).join(", ")}]` : ""}`).join("\n") || "(sin personal)"}\n\nPEDIDOS:\n${(pedidos || []).map(p => `· ${p.asunto} (${p.estado})`).join("\n") || "(sin pedidos)"}\n\nFORMULARIOS:\n${(formularios || []).map(f => `· ${(FORM_TPLS.find(t => t.id === f.tplId) || {}).nombre || "Formulario"} — ${obras.find(o => o.id === f.obra_id)?.nombre || "—"} (${f.fecha}${f.resultado ? ", " + f.resultado : ""})`).join("\n") || "(sin formularios)"}\n\nARCHIVOS:\n${(obras || []).flatMap(o => (o.archivos || []).map(a => `· ${a.nombre} (${o.nombre})`)).join("\n") || "(sin archivos)"}\n\nTAREAS:\n${(tareas || []).map(t => `· ${t.nombre} — ${obras.find(o => o.id === t.obra_id)?.nombre || "—"} (${t.avance || 0}%)`).join("\n") || "(sin tareas)"}\n\nPEDIDOS DE MATERIALES:\n${(matpedidos || []).map(p => `· ${obras.find(o => o.id === p.obra_id)?.nombre || "—"}: ${(p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ")}`).join("\n") || "(ninguno)"}`;
  const apiKeyRef = useRef(apiKey); apiKeyRef.current = apiKey;
  const iaSeen = useRef(-1);
  const iaBusy = useRef(false);
  const pedSeen = useRef(null);
  const matSeen = useRef(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await storage.get("ia_dialogo"); if (!r?.value) return;
        let arr = JSON.parse(r.value);
        if (iaSeen.current < 0) iaSeen.current = arr.length;
        else if (arr.length > iaSeen.current) {
          const nuevos = arr.slice(iaSeen.current).filter(m => m.from === "cliente" || m.to === "cliente" || (m.from === "vv" && m.tipo === "q" && !m.to)); iaSeen.current = arr.length;
          if (nuevos.length) setMsgs(prev => [...prev, ...nuevos.map(m => ({ role: "assistant", content: `IA ${m.from === "cliente" ? cfg.nombre : "V+V"} ${m.tipo === "q" ? "consultó" : "respondió"}: ${m.texto}` }))]);
        }
        const pend = arr.find(m => m.from === "vv" && m.tipo === "q" && !m.answered && (Date.now() - (m.ts || 0) < 300000));
        if (pend && !iaBusy.current && cfg?.iaAuto !== false) {
          iaBusy.current = true;
          try {
          arr = arr.map(m => m.id === pend.id ? { ...m, answered: true } : m);
          await storage.set("ia_dialogo", JSON.stringify(arr)).catch(() => { });
          const sysResp = `Sos el asistente de datos de ${cfg.nombre}. ESTOS SON TUS DATOS:\n${ctxRef.current}\n\nRespondé la consulta usando SOLO estos datos, breve y concreto (español rioplatense). Si el dato NO está en tus datos, respondé ÚNICAMENTE con la palabra NO_DATO. Nunca inventes. No agregues bloques de acción ni JSON.`;
          const resp = await callAI([{ role: "user", content: `Consulta de la IA de V+V: "${pend.texto}"` }], sysResp, apiKeyRef.current, false);
          let arr2 = []; try { const r2 = await storage.get("ia_dialogo"); if (r2?.value) arr2 = JSON.parse(r2.value); } catch { }
          arr2 = arr2.map(m => m.id === pend.id ? { ...m, answered: true } : m);
          if (/credit balance|too low to access|purchase credits|is too low/i.test(String(resp||""))) { iaBusy.current=false; return; }
          let textoResp = resp;
          if ((resp || "").trim().toUpperCase().startsWith("NO_DATO")) {
            let peds = []; try { const rp = await storage.get("vv_pedidos"); if (rp?.value) peds = JSON.parse(rp.value); } catch { }
            const np = nuevoPedido({ de: pend.from, para: "cliente", asunto: `[URGENTE] Consulta de la IA de V+V`, detalle: pend.texto, prioridad: "alta", obra_id: "" });
            const pedsNext = [np, ...peds]; try { localStorage.setItem("vv_pedidos", JSON.stringify(pedsNext)); } catch { } await storage.set("vv_pedidos", JSON.stringify(pedsNext)).catch(() => { });
            textoResp = `No tengo ese dato en la app de ${cfg.nombre}. Lo derivé al personal de ${cfg.nombre} como URGENTE (quedó en Pedidos). Respondemos apenas lo tengan.`;
          }
          arr2.push({ id: uid() + Date.now(), from: "cliente", to: pend.from, qid: pend.id, texto: textoResp, tipo: "a", answered: true, ts: Date.now(), fecha: hoyStr() });
          try { localStorage.setItem("ia_dialogo", JSON.stringify(arr2)); } catch { }
          await storage.set("ia_dialogo", JSON.stringify(arr2)).catch(() => { });
          } catch { }
          iaBusy.current = false;
        }
        // Avisar en el chat los pedidos nuevos que le llegan al cliente
        const rp = await storage.get("vv_pedidos");
        if (rp?.value) {
          const peds = JSON.parse(rp.value);
          const incoming = peds.filter(p => p.para === "cliente" && p.de !== "cliente");
          if (pedSeen.current === null) pedSeen.current = new Set(incoming.map(p => p.id));
          else {
            const nuevos = incoming.filter(p => !pedSeen.current.has(p.id));
            nuevos.forEach(p => pedSeen.current.add(p.id));
            if (nuevos.length) setMsgs(prev => [...prev, ...nuevos.map(p => ({ role: "assistant", content: `Te llegó un pedido de V+V: "${p.asunto}"${p.detalle ? " — " + p.detalle : ""}${p.prioridad === "alta" ? " ⚠ URGENTE" : ""}. Está en Pedidos. Decime si querés que lo responda.` }))]);
          }
        }
        // Avisar pedidos de MATERIALES nuevos y dejar listo el WhatsApp al jefe de obra
        const rmp = await storage.get("vv_matpedidos");
        if (rmp?.value) {
          const mps = JSON.parse(rmp.value).filter(p => p.de !== "cliente");
          if (matSeen.current === null) matSeen.current = new Set(mps.map(p => p.id));
          else {
            const nuevosMat = mps.filter(p => !matSeen.current.has(p.id));
            nuevosMat.forEach(p => matSeen.current.add(p.id));
            for (const p of nuevosMat) {
              const obraN = obras.find(o => o.id === p.obra_id)?.nombre || "obra";
              const jefe = (contactos || []).find(c => (!c.obra_id || c.obra_id === p.obra_id) && (c.telefono || "").trim()) || (personal || []).find(pe => pe.obra_id === p.obra_id && (pe.telefono || "").trim());
              const lines = (p.items || []).map(it => `• ${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join("\n");
              const txt = `*Pedido de materiales* — ${obraN}\nFecha: ${p.fecha}\n\n${lines}${p.nota ? "\n\nNota: " + p.nota : ""}\n\n(Enviado desde ${cfg?.nombre || "Belfast"})`;
              const t = encodeURIComponent(txt);
              const clean = jefe ? String(jefe.telefono).replace(/\D/g, "") : "";
              const num = clean ? (clean.startsWith("54") ? clean : ("549" + clean)) : "";
              const url = num ? `https://wa.me/${num}?text=${t}` : `https://wa.me/?text=${t}`;
              setMsgs(prev => [...prev, { role: "assistant", content: `Llegó un pedido de materiales para ${obraN}.${jefe ? ` Te lo dejo listo para reenviar al jefe de obra ${jefe.nombre} por WhatsApp:` : ` Te lo dejo listo para reenviar por WhatsApp (elegí el contacto):`}`, waLink: url, waLabel: jefe ? `Enviar a ${jefe.nombre}` : "Abrir WhatsApp" }]);
            }
          }
        }
      } catch { }
    };
    tick();
    const iv = setInterval(tick, 4000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", tick);
    return () => { alive = false; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", tick); };
  }, []);
  const QUICK = ["📝 Redactá una minuta de la reunión que te voy a contar", "¿Cómo viene el avance de cada obra?", "Cargá al personal de [obra] al barrio…", "¿Hay pedidos sin resolver?"];
  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    {pend.length > 0 && <div onClick={onPedidos} style={{ display: "flex", alignItems: "center", gap: 11, background: "rgba(239,68,68,.10)", borderBottom: "1px solid rgba(239,68,68,.30)", padding: "11px 16px", cursor: "pointer", flexShrink: 0 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EF4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{pend.length}</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>{pend.length} pedido{pend.length > 1 ? "s" : ""} pendiente{pend.length > 1 ? "s" : ""} de V+V</div><div style={{ fontSize: 11.5, color: "#B91C1C", marginTop: 1 }}>{pendObras ? `Obras: ${pendObras}` : "Tocá para ver"} →</div></div>
    </div>}
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px" }}>
      {onMinutas && <button onClick={onMinutas} style={{ width: "100%", maxWidth: 760, margin: "0 auto 16px", display: "flex", alignItems: "center", gap: 12, background: T.navy, border: `1px solid ${BRASS}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico n="mic" s={19} c="#fff" /></div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>🎙 Grabar reunión</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 1 }}>Se arma la minuta sola y se manda por PDF</div>
        </div>
      </button>}
      {msgs.length === 0 && <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, marginBottom: 14, textAlign: "center" }}>Consultá sobre tus obras o gestioná pedidos con V+V. Puedo crear y responder pedidos por vos.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560, margin: "0 auto" }}>{QUICK.map((q, i) => <button key={i} onClick={() => send(q)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px", fontSize: 13, color: T.text, textAlign: "left", boxShadow: T.shadow }}>{q}</button>)}</div>
      </div>}
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {msgs.map((m, i) => (<div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 11 }}>
          <div style={{ maxWidth: "84%", background: m.role === "user" ? T.accent : T.card, color: m.role === "user" ? "#fff" : T.text, border: m.role === "user" ? "none" : `1px solid ${T.border}`, borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "11px 14px", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", boxShadow: T.shadow }}>{Array.isArray(m.content) ? (m.content.find(b => b.type === "text")?.text || "") : m.content}</div>
          {m.role !== "user" && ttsOk && !narrarAuto && <button onClick={() => hablar((Array.isArray(m.content) ? (m.content.find(b => b.type === "text")?.text || "") : m.content) + (m.accionResultado ? ". " + m.accionResultado : ""))} style={{ marginTop: 5, background: "none", border: "none", color: T.muted, fontSize: 10.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>🔊 Escuchar</button>}
          {m.role !== "user" && /MINUTA DE REUNI[OÓ]N/i.test(String(m.content || "")) && <button onClick={() => descargarMinuta(m.content)} style={{ marginTop: 7, background: "#2B579A", color: "#fff", border: "none", borderRadius: 9, padding: "9px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Ico n="word" /> Descargar minuta (Word)</button>}
          {m.waLink && <a href={m.waLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 7, background: "#25D366", color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}><Ico n="send" /> {m.waLabel || "Enviar por WhatsApp"}</a>}
          {m.docs && m.docs.length > 0 && <div style={{ marginTop: 8, maxWidth: "84%" }}>{m.docs.map((d, i) => <a key={i} href={d.url} target="_blank" rel="noreferrer" download={d.nombre} style={{ display: "flex", alignItems: "center", gap: 9, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, textDecoration: "none" }}><span style={{ width: 30, height: 30, borderRadius: 7, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}><Ico n="ruler" /> </span><span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{d.nombre}</span><span style={{ color: T.accent, fontWeight: 700, fontSize: 11.5, flexShrink: 0 }}>Abrir ↗</span></a>)}</div>}
          {m.media && m.media.length > 0 && <div style={{ marginTop: 8, maxWidth: "84%" }}>{m.mediaTipo === "videos"
            ? m.media.map((u, i) => <video key={i} src={u} controls playsInline style={{ width: "100%", borderRadius: 10, marginBottom: 8, background: "#000", display: "block" }} />)
            : <div style={{ display: "grid", gridTemplateColumns: m.media.length === 1 ? "1fr" : "1fr 1fr", gap: 6 }}>{m.media.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" download><img src={u} alt="" style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.border}`, display: "block" }} /></a>)}</div>}
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>Tocá para abrir en grande o descargar/compartir.</div>
          </div>}
          {m.waLink && <a href={m.waLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 7, background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}><Ico n="send" /> {m.waLabel || "Enviar por WhatsApp"}</a>}
          {m.accion && !m.accionDone && !m.accionDescartada && <div style={{ maxWidth: "84%", marginTop: 7, background: T.bg, border: `1px solid ${T.accent}`, borderRadius: T.rsm, padding: "11px 13px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Acción propuesta</div>
            <div style={{ fontSize: 12.5, color: T.text, marginBottom: 10 }}>{accionLabel(m.accion)}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => confirmAccion(i)} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 7, padding: "9px", fontSize: 12.5, fontWeight: 700 }}>Confirmar</button>
              <button onClick={() => descartarAccion(i)} style={{ background: T.card, color: T.sub, border: `1px solid ${T.border}`, borderRadius: 7, padding: "9px 14px", fontSize: 12.5, fontWeight: 600 }}>Descartar</button>
            </div>
          </div>}
          {m.accionDone && <div style={{ maxWidth: "84%", marginTop: 6, fontSize: 11.5, color: "#16A34A", fontWeight: 700 }}>✓ {m.accionResultado}</div>}
        </div>))}
        {loading && <div style={{ display: "flex", gap: 5, padding: "6px 4px" }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.muted, animation: "pulse 1s infinite", animationDelay: `${i * .15}s` }} />)}</div>}
        <div ref={bottomRef} />
      </div>
    </div>
    <div style={{ borderTop: `1px solid ${T.border}`, background: T.card, padding: "10px 14px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 760, margin: "0 auto 8px" }}>
        {debateActive ? <button onClick={stopDebate} style={{ background: "#EF4444", color: "#fff", border: "none", borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>⏹ Frenar debate</button>
          : <button onClick={() => setDebateOpen(v => !v)} style={{ background: debateOpen ? T.accent : T.bg, color: debateOpen ? "#fff" : T.sub, border: `1px solid ${debateOpen ? T.accent : T.border}`, borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}><Ico n="mic" /> Debate IA</button>}
        {ttsOk && <button onClick={toggleNarrarAuto} title="Narrar las respuestas en voz alta" style={{ background: narrarAuto ? "#16A34A" : T.bg, color: narrarAuto ? "#fff" : T.sub, border: `1px solid ${narrarAuto ? "#16A34A" : T.border}`, borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🔊 {narrarAuto ? "Narrando ON" : "Narrar"}</button>}
        {hablando && <button onClick={pararVoz} style={{ background: "rgba(239,68,68,.10)", color: "#EF4444", border: "1px solid rgba(239,68,68,.30)", borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>⏹ Callar</button>}
        {msgs.length > 0 && <button onClick={() => setMsgs([])} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer", marginLeft: "auto" }}>Limpiar</button>}
      </div>
      {debateOpen && !debateActive && <div style={{ maxWidth: 760, margin: "0 auto 8px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 12px" }}>
        <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 8, lineHeight: 1.5 }}>Charla técnica entre las dos IA (~3 min, {DEBATE_MAX} turnos). Dales un tema y mirá cómo se responden en vivo en las dos apps.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={debateTema} onChange={e => setDebateTema(e.target.value)} onKeyDown={e => { if (e.key === "Enter") startDebate(); }} placeholder="Tema (ej: Steel Frame)" style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text }} />
          <button onClick={startDebate} disabled={!debateTema.trim()} style={{ background: debateTema.trim() ? T.navy : T.border, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "10px 16px", fontSize: 12.5, fontWeight: 700, cursor: debateTema.trim() ? "pointer" : "default" }}>Iniciar</button>
        </div>
      </div>}
      {debateActive && <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, marginBottom: 8, textAlign: "center" }}><Ico n="mic" /> Debate en curso… las dos IA están conversando (dejá las dos apps abiertas).</div>}
      {adj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, maxWidth: 760, margin: "0 auto 8px" }}>{adj.map((a, i) => <span key={i} style={{ background: T.bg, borderRadius: 6, padding: "5px 9px", fontSize: 11, color: T.sub, display: "inline-flex", alignItems: "center", gap: 5 }}><Ico n="clip" /> {a.nombre} <span onClick={() => setAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.muted, fontWeight: 700 }}>✕</span></span>)}</div>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: 760, margin: "0 auto" }}>
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={addAdj} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} disabled={subiendoAdj} title="Adjuntar archivo" style={{ width: 42, height: 42, borderRadius: T.rsm, background: T.bg, color: T.sub, border: `1px solid ${T.border}`, fontSize: 17, flexShrink: 0, cursor: "pointer" }}>{subiendoAdj ? "…" : "＋"}</button>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Escribí tu consulta…" rows={1} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 16, color: T.text, maxHeight: 110, minHeight: 42 }} />
        {sttOk && <button onClick={toggleVoz} title="Dictar por voz" style={{ width: 42, height: 42, borderRadius: T.rsm, background: escuchando ? "#DC2626" : T.bg, color: escuchando ? "#fff" : T.sub, border: `1px solid ${escuchando ? "#DC2626" : T.border}`, fontSize: 17, flexShrink: 0, cursor: "pointer" }}>🎙</button>}
        <button onClick={() => send()} disabled={loading || (!input.trim() && adj.length === 0)} style={{ width: 42, height: 42, borderRadius: T.rsm, background: (input.trim() || adj.length > 0) && !loading ? T.accent : T.border, color: "#fff", border: "none", fontSize: 17, flexShrink: 0 }}>↑</button>
      </div>
    </div>
  </div>);
}

// ── PANTALLA: PEDIDOS (cliente) ──────────────────────────────────────
function PedidosScreen({ T, cfg, apiKey, obras, pedidos, setPedidos }) {
  const miSide = "cliente", otroNom = "V+V Construcciones";
  const [filtro, setFiltro] = useState("todos");
  const [open, setOpen] = useState(null);
  const [nuevo, setNuevo] = useState(null);
  const [reply, setReply] = useState("");
  const [adj, setAdj] = useState([]);
  const [iaLoad, setIaLoad] = useState(false);
  const fileRef = useRef(null);
  async function addAdj(e) { const files = Array.from(e.target.files); if (!files.length) return; const nuevos = []; for (const f of files) { const data = await fileToDataUrl(f); const url = await uploadArchivo(data, "pedidos", f.name.replace(/\W+/g, "_")); nuevos.push({ nombre: f.name, url, img: f.type.startsWith("image/") }); } setAdj(p => [...p, ...nuevos]); e.target.value = ""; }
  useEffect(() => {
    // Antes comparaba CONTENIDO ("¿la nube dice algo distinto?") y si difería lo aplicaba
    // y lo volvía a guardar. Si esa lectura llegaba un instante antes de que un borrado
    // terminara de guardarse en la nube, traía la versión VIEJA y, al re-guardarla, LA
    // RESUCITABA. Ahora compara MARCA DE TIEMPO: solo adopta la nube si es más nueva que
    // lo último que este dispositivo ya escribió o aceptó.
    const pull = async () => {
      try {
        const rTs = await storage.get("vv_pedidos__ts");
        const cloudTs = Number(rTs?.value || 0);
        if (cloudTs <= (lastWrite["vv_pedidos"] || 0)) return;
        const r = await storage.get("vv_pedidos");
        if (r?.value) { lastWrite["vv_pedidos"] = cloudTs; setPedidos(JSON.parse(r.value)); }
      } catch { }
    };
    pull(); const iv = setInterval(pull, 4000);
    const onVis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", pull);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", pull); };
  }, []);
  const lista = pedidos.filter(p => filtro === "todos" ? true : filtro === "recibidos" ? p.para === miSide : p.de === miSide);
  const cur = open ? pedidos.find(p => p.id === open) : null;
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "";
  function crear() { if (!nuevo.asunto?.trim()) return; aplicarPedidos(setPedidos, arr => [nuevoPedido({ de: miSide, para: "vv", asunto: nuevo.asunto, detalle: nuevo.detalle, prioridad: nuevo.prioridad, obra_id: nuevo.obra_id }), ...arr]); setNuevo(null); }
  function responder(id, texto, porIA, archivos) { if (!texto?.trim() && !(archivos || []).length) return; const f = hoyStr(), ts = Date.now(); aplicarPedidos(setPedidos, arr => arr.map(x => x.id === id ? { ...x, estado: "respondido", hilo: [...x.hilo, { de: miSide, texto, fecha: f, ts, porIA: !!porIA, archivos: archivos || [] }] } : x)); setReply(""); setAdj([]); }
  function setEstado(id, estado) { aplicarPedidos(setPedidos, arr => arr.map(x => x.id === id ? { ...x, estado } : x)); }
  function borrarPedido(id) { if (!confirm("¿Eliminar este pedido? Se borra para las dos empresas.")) return; aplicarPedidos(setPedidos, arr => arr.filter(x => x.id !== id)); setOpen(null); }
  async function responderIA(p) { setIaLoad(true); const hist = (p.hilo || []).map(h => `${h.de === miSide ? cfg.nombre : "V+V"}: ${h.texto}`).join("\n"); const sys = `Sos el agente de ${cfg.nombre} respondiendo a V+V Construcciones. Redactá una respuesta breve y concreta (español rioplatense) al último mensaje. Solo el texto.`; const r = await callAI([{ role: "user", content: `Pedido: ${p.asunto}\n\nHilo:\n${hist}\n\nRedactá nuestra respuesta.` }], sys, apiKey); setReply(r); setIaLoad(false); }
  const Pill = (k, l) => <button key={k} onClick={() => setFiltro(k)} style={{ flex: 1, padding: "8px", borderRadius: T.rsm, border: `1px solid ${filtro === k ? T.accent : T.border}`, background: filtro === k ? "rgba(255,255,255,.08)" : T.card, color: filtro === k ? T.accent : T.sub, fontSize: 12, fontWeight: 700 }}>{l}</button>;

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "16px 20px" }}>
      {!cur && <>
        {(() => { const pend = pedidos.filter(p => p.para === miSide && p.estado !== "resuelto"); if (!pend.length) return null; const obrasTxt = [...new Set(pend.map(p => p.obra_id ? nomObra(p.obra_id) : "general").filter(Boolean))].join(", "); return (<div style={{ display: "flex", alignItems: "center", gap: 11, background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", borderRadius: T.rsm, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EF4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{pend.length}</div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>{pend.length} pedido{pend.length > 1 ? "s" : ""} pendiente{pend.length > 1 ? "s" : ""} de respuesta</div><div style={{ fontSize: 11.5, color: "#B91C1C", marginTop: 1 }}>{obrasTxt ? `Obras: ${obrasTxt}` : ""}</div></div>
        </div>); })()}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>{Pill("todos", "Todos")}{Pill("recibidos", "Recibidos")}{Pill("enviados", "Enviados")}</div>
        <button onClick={() => setNuevo({ asunto: "", detalle: "", prioridad: "media", obra_id: obras[0]?.id || "" })} style={{ width: "100%", background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: "12px", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>＋ Nuevo pedido a V+V</button>
        {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "30px 18px" }}>Sin pedidos. Creá uno o pedíselo a la IA.</div>}
        {lista.map(p => { const e = PEDIDO_ESTADOS[p.estado] || PEDIDO_ESTADOS.abierto; const ult = (p.hilo || [])[p.hilo?.length - 1]; return (<Card T={T} key={p.id} style={{ padding: 13, marginBottom: 9 }}>
          <div onClick={() => { setOpen(p.id); setReply(""); }} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{p.asunto}</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{p.de === miSide ? "Enviado" : "Recibido"} · {p.fecha}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                {p.obra_id && <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, background: "rgba(255,255,255,.08)", borderRadius: 5, padding: "2px 7px" }}><Ico n="building" /> {nomObra(p.obra_id)}</span>}
                {p.para === miSide && p.estado !== "resuelto" && <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", background: "rgba(239,68,68,.10)", borderRadius: 5, padding: "2px 7px" }}>● Pendiente de respuesta</span>}
              </div>
              <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 230 }}>{ult?.porIA ? "" : ""}{ult?.texto}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              <Badge c={e.c} b={e.b}>{e.l}</Badge>
            </div>
          </div>
        </Card>); })}
      </>}
      {cur && (() => { const e = PEDIDO_ESTADOS[cur.estado] || PEDIDO_ESTADOS.abierto; return (<>
        <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>← Volver</button>
        <Card T={T} style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}><div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{cur.asunto}</div><Badge c={e.c} b={e.b}>{e.l}</Badge></div>
          {cur.obra_id && <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: T.accent, background: "rgba(255,255,255,.08)", borderRadius: 6, padding: "4px 10px", marginTop: 8 }}><Ico n="building" /> Obra: {nomObra(cur.obra_id)}</div>}
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>{cur.de === miSide ? "Enviado a V+V" : "Recibido de V+V"} · {cur.fecha} · prioridad {cur.prioridad}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>{Object.entries(PEDIDO_ESTADOS).map(([k, v]) => <button key={k} onClick={() => setEstado(cur.id, k)} style={{ flex: 1, padding: "7px 4px", borderRadius: 7, border: `1px solid ${cur.estado === k ? v.c : T.border}`, background: cur.estado === k ? v.b : T.card, color: cur.estado === k ? v.c : T.muted, fontSize: 10.5, fontWeight: 700 }}>{v.l}</button>)}</div>
          <button onClick={() => borrarPedido(cur.id)} style={{ width: "100%", marginTop: 12, background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", color: "#EF4444", borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar pedido</button>
        </Card>
        <Eyebrow T={T}>Hilo</Eyebrow>
        {(cur.hilo || []).map((h, i) => { const mine = h.de === miSide; return (<div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
          <div style={{ maxWidth: "85%" }}>
            <div style={{ background: mine ? T.accent : T.card, color: mine ? "#fff" : T.text, border: mine ? "none" : `1px solid ${T.border}`, borderRadius: mine ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "10px 13px", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {h.texto}
              {(h.archivos || []).map((a, j) => a.img ? <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 7 }}><img src={a.url} alt={a.nombre} style={{ maxWidth: "100%", borderRadius: 8, display: "block" }} /></a> : <a key={j} href={a.url} target="_blank" rel="noreferrer" download={a.nombre} style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: mine ? "#fff" : T.accent, textDecoration: "underline" }}><Ico n="clip" /> {a.nombre}</a>)}
            </div>
            <div style={{ fontSize: 9.5, color: T.muted, marginTop: 3, textAlign: mine ? "right" : "left" }}>{h.porIA ? "IA · " : ""}{mine ? cfg.nombre : "V+V"} · {h.fecha}</div>
          </div>
        </div>); })}
        <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Escribí una respuesta…" rows={3} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 16, color: T.text, marginTop: 8 }} />
        {adj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{adj.map((a, i) => <span key={i} style={{ background: "rgba(255,255,255,.08)", borderRadius: 6, padding: "5px 9px", fontSize: 11, color: T.sub }}>{a.img ? "" : ""} {a.nombre} <span onClick={() => setAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.muted }}>✕</span></span>)}</div>}
        <input ref={fileRef} type="file" multiple onChange={addAdj} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => fileRef.current?.click()} style={{ width: 44, background: T.bg, color: T.sub, border: `1px solid ${T.border}`, borderRadius: T.rsm, fontSize: 17 }}>＋</button>
          <button onClick={() => responderIA(cur)} disabled={iaLoad} style={{ flex: 1, background: "rgba(255,255,255,.08)", color: T.accent, border: "none", borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700 }}>{iaLoad ? "Redactando…" : "Redactar con IA"}</button>
          <PBtn T={T} onClick={() => responder(cur.id, reply, false, adj)} style={{ flex: 1 }}>Enviar</PBtn>
        </div>
      </>); })()}
    </div>
    {nuevo && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={() => setNuevo(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 1180, margin: "0 auto", padding: "20px", animation: "up .25s ease" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 14 }}>Nuevo pedido a V+V</div>
        <input value={nuevo.asunto || ""} onChange={e => setNuevo({ ...nuevo, asunto: e.target.value })} placeholder="Asunto" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, marginBottom: 9 }} />
        <textarea value={nuevo.detalle || ""} onChange={e => setNuevo({ ...nuevo, detalle: e.target.value })} placeholder="Detalle de la solicitud" rows={4} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, marginBottom: 9 }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>¿De qué obra?</label>
        <select value={nuevo.obra_id || ""} onChange={e => setNuevo({ ...nuevo, obra_id: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 9px" }}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}<option value="">Sin obra específica</option></select>
        <select value={nuevo.prioridad || ""} onChange={e => setNuevo({ ...nuevo, prioridad: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, marginBottom: 12 }}><option value="alta">Prioridad alta</option><option value="media">Prioridad media</option><option value="baja">Prioridad baja</option></select>
        <PBtn T={T} full onClick={crear}>Crear y enviar</PBtn>
      </div>
    </div>}
  </div>);
}

// ── PANTALLA: PERSONAL (cliente) ─────────────────────────────────────
function PersonalScreen({ T, cfg, personal, setPersonal, obras, contactos = [], setContactos }) {
  const [cargar, setCargar] = useState(false);
  const [sitio, setSitio] = useState("");
  const [sel, setSel] = useState([]);
  const [filtroObra, setFiltroObra] = useState("");
  const [nomina, setNomina] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cForm, setCForm] = useState(null);
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  function nuevoC() { setCForm({ nombre: "", rol: "Jefe de obra", obra_id: obras[0]?.id || "", telefono: "" }); }
  function guardarC() { if (!String(cForm.nombre || "").trim() || !String(cForm.telefono || "").trim()) { alert("Poné al menos nombre y teléfono."); return; } if (cForm.id) setContactos(p => (p || []).map(x => x.id === cForm.id ? cForm : x)); else setContactos(p => [...(p || []), { ...cForm, id: uid() + Date.now() }]); setCForm(null); }
  function borrarC(id) { if (confirm("¿Eliminar este contacto?")) setContactos(p => (p || []).filter(x => x.id !== id)); }
  const diasHasta = (s) => { if (!s) return null; const [d, m, y] = s.split("/"); return Math.ceil((new Date(`20${y}`, m - 1, d) - new Date()) / 86400000); };
  const lista = personal.filter(p => !filtroObra || p.obra_id === filtroObra);
  const sitios = [...new Set((obras || []).map(o => o.nombre).filter(Boolean))];   // saco las obras sin nombre: generaban claves vacías
  function toggle(id) { setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }
  async function ejecutarCarga() {
    if (!sitio.trim() || sel.length === 0) return; const f = hoyStr();
    let arr = personal; try { const r = await storage.get("vv_personal"); if (r?.value) arr = JSON.parse(r.value); } catch { }
    const next = arr.map(p => sel.includes(p.id) ? { ...p, sitios: [...(p.sitios || []).filter(s => s.sitio !== sitio), { sitio, fecha: f }] } : p);
    setPersonal(next);
    const elegidos = next.filter(p => sel.includes(p.id));
    const txt = `NÓMINA DE PERSONAL — Acceso a ${sitio}\nEmpresa ejecutora: V+V Construcciones\nFecha: ${f}\n\n` + elegidos.map((p, i) => `${i + 1}. ${p.nombre} — ${p.rol || "—"}${p.empresa ? ` (${p.empresa})` : ""}`).join("\n");
    setNomina(txt); setSel([]); setSitio("");
  }
  function copiar(txt) { try { navigator.clipboard?.writeText(txt); } catch { } }

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "16px 20px" }}>
      <Eyebrow T={T}>Contactos para WhatsApp (jefes de obra)</Eyebrow>
      <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.55, marginBottom: 10 }}>Tu agenda propia de Belfast. Estos teléfonos los usa la app para reenviar los pedidos de materiales por WhatsApp.</div>
      {(contactos || []).map(c => (<Card T={T} key={c.id} style={{ padding: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#25D366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}><Ico n="send" /> </div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{c.nombre}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{c.rol || "—"} · {nomObra(c.obra_id)} · {c.telefono}</div></div>
          <button onClick={() => setCForm({ id: c.id, nombre: c.nombre || "", rol: c.rol || "", obra_id: c.obra_id || "", telefono: c.telefono || "" })} style={{ background: "none", border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Editar</button>
          <button onClick={() => borrarC(c.id)} style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", color: "#EF4444", borderRadius: 7, width: 30, height: 30, fontSize: 13, cursor: "pointer" }}>✕</button>
        </div>
      </Card>))}
      <button onClick={nuevoC} style={{ width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "12px", fontSize: 13, fontWeight: 700, marginBottom: 20, cursor: "pointer" }}>＋ Agregar contacto de WhatsApp</button>
      <Eyebrow T={T}>Personal de obra (V+V)</Eyebrow>
      <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, marginBottom: 14 }}>Personal de V+V Construcciones. Desde acá podés cargar trabajadores al barrio/sitio para tramitar el acceso.</div>
      <button onClick={() => { setCargar(true); setNomina(null); }} style={{ width: "100%", background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: "12px", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>＋ Cargar personal a un sitio</button>
      {personal.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "30px 18px" }}>V+V todavía no cargó personal.</div>}
      {personal.map(p => { const vc = Object.values(p.docs || {}).filter(d => d?.vence && diasHasta(d.vence) <= 15).length; const docn = Object.keys(p.docs || {}).length; return (<Card T={T} key={p.id} style={{ padding: 13, marginBottom: 9 }}>
        <div onClick={() => setDetalle(p)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{(p.nombre || "?").slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.nombre}</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{p.rol || "—"} · {nomObra(p.obra_id)}{p.telefono ? ` · ${p.telefono}` : ""}</div>
            {(p.sitios || []).length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>{p.sitios.map((s, i) => <span key={i} style={{ fontSize: 9.5, fontWeight: 700, color: "#16A34A", background: "rgba(22,163,74,.14)", borderRadius: 5, padding: "2px 6px" }}>✓ {s.sitio}</span>)}</div>}
          </div>
          {vc > 0 ? <Badge c="#EF4444" b="rgba(239,68,68,.10)">{vc} vence</Badge> : docn > 0 ? <Badge c="#16A34A" b="rgba(22,163,74,.14)">{docn} doc</Badge> : <Badge c="#94A3B8" b="rgba(255,255,255,.04)">s/doc</Badge>}
        </div>
      </Card>); })}
    </div>

    {detalle && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={() => setDetalle(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 1180, margin: "0 auto", padding: "20px", maxHeight: "85vh", overflowY: "auto", animation: "up .25s ease" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{detalle.nombre}</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>{detalle.rol} · {detalle.empresa || "V+V"} · {nomObra(detalle.obra_id)}</div>
        {detalle.telefono && <a href={`https://wa.me/${(() => { const c = String(detalle.telefono).replace(/\D/g, ""); return c.startsWith("54") ? c : "549" + c; })()}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", marginBottom: 14 }}><Ico n="send" /> WhatsApp · {detalle.telefono}</a>}
        <Eyebrow T={T}>Documentación</Eyebrow>
        {Object.keys(detalle.docs || {}).length === 0 && <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Sin documentación cargada.</div>}
        {Object.entries(detalle.docs || {}).map(([k, d]) => { const dias = d?.vence ? diasHasta(d.vence) : null; return (<div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.bg, borderRadius: T.rsm, padding: "10px 12px", marginBottom: 7 }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: T.text, textTransform: "uppercase" }}>{k}</div>{d?.vence && <div style={{ fontSize: 11, color: dias != null && dias <= 15 ? "#EF4444" : T.muted }}>Vence {d.vence}{dias != null ? ` (${dias < 0 ? "vencido" : dias + " d"})` : ""}</div>}</div>
          {d?.url && <a href={d.url} target="_blank" rel="noreferrer" download={d.nombre} style={{ background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 11px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ver</a>}
        </div>); })}
        {(detalle.sitios || []).length > 0 && <><Eyebrow T={T}>Sitios cargados</Eyebrow><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{detalle.sitios.map((s, i) => <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", background: "rgba(22,163,74,.14)", borderRadius: 6, padding: "5px 10px" }}>✓ {s.sitio} · {s.fecha}</span>)}</div></>}
      </div>
    </div>}

    {cargar && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={() => { setCargar(false); setNomina(null); }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 1180, margin: "0 auto", padding: "20px", maxHeight: "88vh", overflowY: "auto", animation: "up .25s ease" }}>
        {!nomina ? <>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 14 }}>Cargar personal a un sitio</div>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sitio / barrio</label>
          <input value={sitio} onChange={e => setSitio(e.target.value)} placeholder="Ej: Barrio Terralagos" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 8px" }} />
          {sitios.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{sitios.map(s => <button key={s} onClick={() => setSitio(s)} style={{ background: T.bg, color: T.sub, border: `1px solid ${T.border}`, borderRadius: 14, padding: "5px 11px", fontSize: 11.5, fontWeight: 600 }}>{s}</button>)}</div>}
          <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Filtrar por obra</label>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13.5, color: T.text, margin: "6px 0 12px" }}><option value="">Todas las obras</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Personal ({sel.length} sel.)</span>
            <button onClick={() => setSel(sel.length === lista.length ? [] : lista.map(p => p.id))} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700 }}>{sel.length === lista.length ? "Ninguno" : "Todos"}</button>
          </div>
          {lista.map(p => <div key={p.id} onClick={() => toggle(p.id)} style={{ display: "flex", alignItems: "center", gap: 11, background: sel.includes(p.id) ? "rgba(255,255,255,.08)" : T.bg, border: `1px solid ${sel.includes(p.id) ? T.accent : T.border}`, borderRadius: T.rsm, padding: "10px 12px", marginBottom: 7, cursor: "pointer" }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${sel.includes(p.id) ? T.accent : T.border}`, background: sel.includes(p.id) ? T.accent : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{sel.includes(p.id) ? "✓" : ""}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{p.nombre}</div><div style={{ fontSize: 11, color: T.muted }}>{p.rol || "—"} · {nomObra(p.obra_id)}</div></div>
          </div>)}
          <PBtn T={T} full onClick={ejecutarCarga} style={{ marginTop: 8 }}>Cargar {sel.length || ""} al sitio</PBtn>
        </> : <>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 6 }}>✓ Personal cargado</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Nómina lista para enviar a la administración del barrio.</div>
          <pre style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px", fontSize: 12, color: T.text, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>{nomina}</pre>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => copiar(nomina)} style={{ flex: 1, background: "rgba(255,255,255,.08)", color: T.accent, border: "none", borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700 }}>Copiar nómina</button>
            <PBtn T={T} onClick={() => { setCargar(false); setNomina(null); }} style={{ flex: 1 }}>Listo</PBtn>
          </div>
        </>}
      </div>
    </div>}

    {cForm && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={() => setCForm(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 1180, margin: "0 auto", padding: "20px", maxHeight: "88vh", overflowY: "auto", animation: "up .25s ease" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 14 }}>{cForm.id ? "Editar contacto" : "Nuevo contacto de WhatsApp"}</div>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Nombre</label>
        <input value={cForm.nombre || ""} onChange={e => setCForm({ ...cForm, nombre: e.target.value })} placeholder="Ej: Juan Pérez" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 12px" }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rol</label>
        <input value={cForm.rol || ""} onChange={e => setCForm({ ...cForm, rol: e.target.value })} placeholder="Jefe de obra" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 12px" }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Obra</label>
        <select value={cForm.obra_id || ""} onChange={e => setCForm({ ...cForm, obra_id: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 12px" }}><option value="">Sin obra</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Teléfono (WhatsApp)</label>
        <input value={cForm.telefono || ""} onChange={e => setCForm({ ...cForm, telefono: e.target.value })} placeholder="Ej: 11 5555 4444" type="tel" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 4px" }} />
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 14 }}>Con característica (ej. 11 para CABA/GBA). La app le antepone el código de país.</div>
        <PBtn T={T} full onClick={guardarC}>{cForm.id ? "Guardar cambios" : "Agregar contacto"}</PBtn>
      </div>
    </div>}
  </div>);
}
// Documento con la marca de BELFAST (no la de V+V). Es el que ve el
// propietario: él es cliente de Belfast, no de V+V.
function docBelfast(cfg, obraNombre, titulo, subtitulo, bloques, fotos) {
  const esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const marca = (cfg?.nombre || "Belfast Construction Management").toUpperCase();
  const logo = cfg?.logo || "";
  const secs = bloques.filter(([, t]) => t).map(([lbl, t]) =>
    `<div class="bloque"><div class="lbl">${esc(lbl)}</div><div class="txt">${esc(t).replace(/\n/g, "<br/>")}</div></div>`).join("");
  const fots = (fotos || []).length ? `<div class="fotos">${fotos.map(u => `<img src="${esc(u)}" />`).join("")}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    @page { margin: 15mm; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #16202e; margin: 0; padding: 22px; }
    .head { text-align: center; border-bottom: 2px solid #B0894F; padding-bottom: 12px; margin-bottom: 18px; }
    .head img { max-height: 54px; margin-bottom: 8px; }
    .marca { font-size: 15px; font-weight: 800; letter-spacing: .06em; color: #0F1B2D; }
    .tipo { font-size: 9px; font-weight: 800; letter-spacing: .12em; color: #B0894F; text-transform: uppercase; margin-top: 5px; }
    h1 { font-size: 17px; margin: 12px 0 4px; }
    .sub { font-size: 11.5px; color: #5B6B7F; }
    .bloque { margin-bottom: 14px; }
    .lbl { font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #1B3A5B; margin-bottom: 4px; }
    .txt { font-size: 12.5px; line-height: 1.6; }
    .fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
    .fotos img { width: 100%; border-radius: 6px; border: 1px solid #E3E8EF; }
    .pie { margin-top: 24px; padding-top: 10px; border-top: 1px solid #E3E8EF; font-size: 9.5px; color: #94A3B8; text-align: center; }
  </style></head><body>
    <div class="head">${logo ? `<img src="${esc(logo)}" />` : ""}<div class="marca">${esc(marca)}</div><div class="tipo">${esc(subtitulo)}</div></div>
    <h1>${esc(titulo)}</h1><div class="sub">Obra: ${esc(obraNombre)}</div>
    <div style="margin-top:18px">${secs}${fots}</div>
    <div class="pie">${esc(marca)} · Documento emitido para el propietario</div>
  </body></html>`;
}

function InformesScreen({ T, obras, formularios = [], certif = {}, informesSem = {}, avance = {}, cfg = {}, envios = {}, setEnvios }) {
  const [avAbierto, setAvAbierto] = React.useState(null);
  const [docAbierto, setDocAbierto] = React.useState(null);   // el informe armado, con logos
  // Arma el documento con la marca de Belfast y lo deja disponible para el
  // propietario en SU panel.
  function mandarAlPropietario(obraId, obraNombre, item, tipo) {
    if (!setEnvios) return;
    const html = tipo === "cert"
      ? docBelfast(cfg, obraNombre, `Certificado semanal ${fFechaCorta(item.desde)} al ${fFechaCorta(item.hasta)}`, "Certificado de avance",
          [["Desarrollo", item.desarrollo], ["Recepciones", item.recepciones], ["Limpieza y seguridad", item.limpieza], ["Alertas", item.alertas]],
          (item.av || []).flatMap(a => (a.fotos && a.fotos.length) ? a.fotos : (a.fotoUrl ? [a.fotoUrl] : [])))
      : docBelfast(cfg, obraNombre, `Informe de avance ${item.fecha}`, "Informe de avance",
          [["Avance alcanzado", item.avance], ["Estado de obra", item.descripcion]],
          (item.fotos && item.fotos.length) ? item.fotos : (item.fotoUrl ? [item.fotoUrl] : []));
    const reg = { id: item.id, tipo, prop: true, fecha: item.fecha || item.desde, titulo: tipo === "cert" ? `Certificado ${fFechaCorta(item.desde)} al ${fFechaCorta(item.hasta)}` : `Informe de avance ${item.fecha}`, html, ts: Date.now() };
    setEnvios(p => { const lista = ((p || {})[obraId] || []).filter(x => x.id !== reg.id); return { ...(p || {}), [obraId]: [reg, ...lista] }; });
    alert("Listo: el propietario ya lo puede ver en su panel.");
  }
  const [certAbierto, setCertAbierto] = React.useState(null);
  const [semAbierto, setSemAbierto] = React.useState(null);
  const [filtro, setFiltro] = useState("");
  const [open, setOpen] = useState(null);
  const [verForm, setVerForm] = useState(null);
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  const _escIS = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmtFechaIS = (iso) => { if (!iso) return ""; const [a, m, d] = String(iso).split("-"); return a ? `${d}/${m}/${a.slice(2)}` : String(iso); };
  function buildPdfInformeSemanal(rep, obraNombre) {
    const marca = (cfg?.empresa || "V+V Construcciones").toUpperCase();
    const logo = cfg?.logoEmpresa || cfg?.logoCentral || cfg?.logoEmpresa2 || "";
    const li = (arr) => (arr && arr.length) ? `<ul>${arr.map(x => `<li>${_escIS(x)}</li>`).join("")}</ul>` : `<div class="vacio">— sin registros —</div>`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      @page { margin: 15mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; }
      body { font-family: -apple-system, Arial, sans-serif; color: #1a2433; background: #eceff3; }
      .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 28px 34px 36px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
      @media screen { body { padding: 14px; } }
      @media print { body { background: #fff; padding: 0; } .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; } }
      .hdr { border-bottom: 2px solid #B0894F; padding-bottom: 14px; margin-bottom: 4px; text-align: center; }
      .logo { max-height: 88px; max-width: 300px; object-fit: contain; display: block; margin: 0 auto 10px; }
      .marca { font-size: 17px; font-weight: 800; color: #0F1B2D; }
      .tipo { font-size: 10px; font-weight: 700; color: #B0894F; letter-spacing: .18em; text-transform: uppercase; margin-top: 3px; }
      .barra { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 11.5px; color: #5B6B7F; margin: 14px 0 18px; padding-bottom: 10px; border-bottom: 1px solid #E3E8EF; }
      .barra b { color: #0F1B2D; }
      h2 { font-size: 12px; color: #1B3A5B; text-transform: uppercase; letter-spacing: .04em; margin: 18px 0 8px; padding-left: 9px; border-left: 3px solid #B0894F; }
      ul { margin: 0 0 4px; padding-left: 20px; } li { font-size: 12.5px; line-height: 1.6; margin-bottom: 3px; }
      .vacio { font-size: 12px; color: #98A2B3; font-style: italic; }
      .obs { font-size: 12px; line-height: 1.55; color: #1a2433; background: rgba(255,255,255,.04); border: 1px solid #E3E8EF; border-radius: 8px; padding: 10px 12px; margin-top: 4px; }
      .foot { margin-top: 22px; font-size: 9px; color: #98A2B3; text-align: center; border-top: 1px solid #E3E8EF; padding-top: 8px; }
    </style></head><body><div class="sheet">
      <div class="hdr">${logo ? `<img class="logo" src="${logo}" />` : ""}<div class="marca">${marca}</div><div class="tipo">Informe semanal de obra</div></div>
      <div class="barra"><div>Obra: <b>${_escIS(obraNombre || "")}</b></div><div>Semana: <b>${fmtFechaIS(rep.desde)} al ${fmtFechaIS(rep.hasta)}</b></div><div>Emitido: <b>${_escIS(rep.emitido || "")}</b></div></div>
      <h2>Trabajos realizados esta semana</h2>${li(rep.hechos)}
      <h2>Trabajos previstos para la próxima semana</h2>${li(rep.proxima)}
      ${rep.obs ? `<h2>Observaciones</h2><div class="obs">${_escIS(rep.obs)}</div>` : ""}
      <div class="foot">Generado por ${marca} · Informe semanal de obra.</div>
    </div></body></html>`;
  }
  // Arma el Certificado semanal (con bitácora y fotos) al momento — ya no
  // depende de que el PDF completo haya quedado guardado (eso era lo que
  // pesaba de más y tiraba error 413 al guardar); ahora se rearma desde los
  // datos crudos del certificado (av, bt), igual que hace V+V.
  function buildPdfCertSemanal(d, obraNombre) {
    const marca = (cfg?.empresa || "V+V Construcciones").toUpperCase();
    const logo = cfg?.logoEmpresa || cfg?.logoCentral || cfg?.logoEmpresa2 || "";
    const vin = (t) => (t || "").split("\n").map(l => l.replace(/^[-•\s]+/, "").trim()).filter(Boolean);
    const lista = (t, vacio) => { const it = vin(t); return it.length ? `<ul>${it.map(x => `<li>${_escIS(x)}</li>`).join("")}</ul>` : `<div class="vacio">${vacio}</div>`; };
    const visual = (d.av || []).map(h => { const fs = (h.fotos && h.fotos.length) ? h.fotos : (h.fotoUrl ? [h.fotoUrl] : []); return `<div class="ent"><div class="fecha">${_escIS(h.fecha)}</div>${fs.length ? `<div class="fotos">${fs.map(u => `<img src="${u}" />`).join("")}</div>` : ""}<div class="txt">${_escIS(h.avance || h.descripcion || "")}</div></div>`; }).join("") || `<div class="vacio">Sin registros visuales en la semana</div>`;
    const bita = (d.bt || []).length ? `<table><tr><th>Fecha</th><th>Hecho</th><th>Detalle</th></tr>${d.bt.map(h => `<tr><td>${_escIS(fmtFechaIS(h.fecha))}</td><td>${_escIS(h.titulo || "")}</td><td>${_escIS(h.desc || "")}</td></tr>`).join("")}</table>` : `<div class="vacio">Sin registros de bitácora en la semana</div>`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      @page { margin: 15mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; }
      body { font-family: -apple-system, Arial, sans-serif; color: #1a2433; background: #eceff3; }
      .sheet { max-width: 780px; margin: 0 auto; background: #fff; padding: 28px 34px 36px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
      @media screen { body { padding: 14px; } }
      @media print { body { background: #fff; padding: 0; } .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; } }
      .hdr { border-bottom: 2px solid #B0894F; padding-bottom: 14px; text-align: center; }
      .logo { max-height: 88px; max-width: 300px; object-fit: contain; display: block; margin: 0 auto 10px; }
      .marca { font-size: 17px; font-weight: 800; color: #0F1B2D; }
      .tipo { font-size: 10px; font-weight: 700; color: #B0894F; letter-spacing: .18em; text-transform: uppercase; margin-top: 3px; }
      .barra { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 11.5px; color: #5B6B7F; margin: 14px 0 18px; padding-bottom: 10px; border-bottom: 1px solid #E3E8EF; }
      .barra b { color: #0F1B2D; }
      h2 { font-size: 12px; color: #1B3A5B; text-transform: uppercase; letter-spacing: .04em; margin: 18px 0 8px; padding-left: 9px; border-left: 3px solid #B0894F; }
      .parr { font-size: 12.5px; line-height: 1.6; text-align: justify; }
      ul { margin: 0; padding-left: 20px; } li { font-size: 12.5px; line-height: 1.55; margin-bottom: 3px; }
      .vacio { font-size: 12px; color: #98A2B3; font-style: italic; }
      table { width: 100%; border-collapse: collapse; margin-top: 4px; }
      th { background: rgba(255,255,255,.06); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #1B3A5B; text-align: left; padding: 7px 9px; border: 1px solid #E3E8EF; }
      td { font-size: 11.5px; padding: 7px 9px; border: 1px solid #E3E8EF; vertical-align: top; line-height: 1.45; }
      .ent { border: 1px solid #E3E8EF; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
      .fecha { font-size: 12.5px; font-weight: 800; color: #B0894F; margin-bottom: 7px; }
      .fotos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
      .fotos img { width: calc(50% - 3px); max-height: 240px; object-fit: contain; background: #0b0f14; border-radius: 6px; page-break-inside: avoid; break-inside: avoid; }
      .fotos img:only-child { width: 100%; max-height: 320px; }
      .txt { font-size: 12px; line-height: 1.5; page-break-inside: avoid; break-inside: avoid; }
      .foot { margin-top: 20px; font-size: 9px; color: #98A2B3; text-align: center; border-top: 1px solid #E3E8EF; padding-top: 8px; }
    </style></head><body><div class="sheet">
      <div class="hdr">${logo ? `<img class="logo" src="${logo}" />` : ""}<div class="marca">${marca}</div><div class="tipo">Certificado semanal de avance</div></div>
      <div class="barra"><div>Obra: <b>${_escIS(obraNombre || "")}</b></div><div>Semana: <b>${fmtFechaIS(d.desde)} al ${fmtFechaIS(d.hasta)}</b></div><div>Emitido: <b>${_escIS(d.emitido || "")}</b></div></div>
      <h2>Desarrollo de la semana</h2><div class="parr">${_escIS(d.desarrollo)}</div>
      <h2>Recepción de materiales y documentación</h2>${lista(d.recepciones, "Sin registros en la semana")}
      <h2>Orden, limpieza y protección del personal</h2>${lista(d.limpieza, "Sin fotos para evaluar en la semana")}
      <h2>Recepción de documentación y elementos de protección</h2>
      ${(d.recepEstado || []).length ? `<table><tr><th>Rubro</th><th style="width:74px">Recibido</th><th>Pendiente</th></tr>
        ${(d.recepEstado || []).map(g => `<tr><td>${_escIS(g.cat)}</td><td style="text-align:center;font-weight:700;color:${g.ok === g.total ? "#15803D" : "#B45309"}">${g.ok}/${g.total}</td><td>${g.faltan.length ? _escIS(g.faltan.join(", ")) : "—"}</td></tr>`).join("")}</table>`
        : `<div class="vacio">No se cargó el checklist de recepción para esta obra.</div>`}
      <h2>Pendientes y alertas</h2>${lista(d.alertas, "Sin alertas")}
      <h2>Registro visual del avance</h2>${visual}
      <h2>Bitácora de la semana</h2>${bita}
      <div class="foot">Generado por ${marca} · Certificado semanal de avance de obra.</div>
    </div></body></html>`;
  }
  // Todos los informes semanales de todas las obras (o de la filtrada),
  // del más nuevo al más viejo — mismo criterio que los certificados.
  const informesSemTodos = obras.flatMap(o => ((informesSem || {})[o.id] || []).map(r => ({ ...r, _obra: o.nombre, _obraId: o.id })))
    .filter(r => !filtro || r._obraId === filtro)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const forms = (formularios || []).filter(f => f.compartido && (!filtro || f.obra_id === filtro)).sort((a, b) => (b.id > a.id ? 1 : -1));
  const todos = obras.flatMap(o => (o.informes || []).map(inf => ({ ...inf, obra: o.nombre, obra_id: o.id }))).filter(inf => !filtro || inf.obra_id === filtro).sort((a, b) => (b.id > a.id ? 1 : -1));
  // Todos los certificados semanales, de todas las obras (o de la filtrada),
  // ordenados del más nuevo al más viejo.
  const certsTodos = obras.flatMap(o => ((certif || {})[o.id] || []).map(c => ({ ...c, _obra: o.nombre, _obraId: o.id })))
    .filter(c => !filtro || c._obraId === filtro)
    .sort((a, b) => String(b.desde || "").localeCompare(String(a.desde || "")));
  // Informes de avance: cada carga de fotos con su lectura de la IA.
  // Solo los que tienen el informe ya armado (el PDF con logos que emite V+V).
  // Es lo único que le llega al cliente; el texto suelto queda para uso interno.
  const avTodos = obras.flatMap(o => ((avance || {})[o.id] || []).map(a => ({ ...a, _obra: o.nombre, _obraId: o.id })))
    .filter(a => a.html && (!filtro || a._obraId === filtro))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (docAbierto) return (<div style={{ position: "fixed", inset: 0, background: "#1a2433", zIndex: 400, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "calc(10px + env(safe-area-inset-top)) 12px 10px" }}>
      <button onClick={() => setDocAbierto(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>← Volver</button>
      <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docAbierto.titulo}</span>
      <button onClick={() => { const f = document.getElementById("doc-cliente"); if (f?.contentWindow) f.contentWindow.print(); }} style={{ background: BRASS, border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Imprimir / PDF</button>
    </div>
    <iframe id="doc-cliente" srcDoc={docAbierto.html} title={docAbierto.titulo} style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
  </div>);

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>

      {/* La obra se elige PRIMERO: filtra los certificados, los avances y los informes de abajo. */}
      <div style={{ padding: "0 18px", marginTop: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Obra</label>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 2px" }}><option value="">Todas las obras</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
      </div>

      {/* Informes semanales de obra — el texto de "trabajos realizados/previstos", distinto del certificado semanal */}
      {informesSemTodos.length > 0 && <div style={{ padding: "0 18px", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 8px" }}>Informes semanales de obra</div>
        {informesSemTodos.map(r => { const isOpen = semAbierto?.id === r.id; return (<div key={r.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${BRASS}`, borderRadius: 10, padding: "10px 12px", marginBottom: 7 }}>
          <div onClick={() => setSemAbierto(isOpen ? null : r)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Semana {fFechaCorta(r.desde)} al {fFechaCorta(r.hasta)}</div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{r._obra} · {(r.hechos || []).length} trabajo{(r.hechos || []).length === 1 ? "" : "s"} realizado{(r.hechos || []).length === 1 ? "" : "s"} · emitido {r.emitido}</div>
            </div>
            <span style={{ color: T.muted, fontSize: 11 }}>{isOpen ? "▲" : "▼"}</span>
          </div>
          {isOpen && <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>Trabajos realizados</div>
            {(r.hechos || []).length ? <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>{r.hechos.map((h, i) => <li key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, marginBottom: 3 }}>{h}</li>)}</ul> : <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic", marginBottom: 10 }}>— sin registros —</div>}
            <div style={{ fontSize: 10, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>Trabajos previstos</div>
            {(r.proxima || []).length ? <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>{r.proxima.map((h, i) => <li key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, marginBottom: 3 }}>{h}</li>)}</ul> : <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic", marginBottom: 10 }}>— sin registros —</div>}
            {r.obs && <><div style={{ fontSize: 10, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>Observaciones</div><div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 4 }}>{r.obs}</div></>}
            <button onClick={() => setDocAbierto({ html: buildPdfInformeSemanal(r, r._obra), titulo: `Informe semanal ${fFechaCorta(r.desde)} al ${fFechaCorta(r.hasta)}` })} style={{ marginTop: 8, background: "none", border: `1px solid ${BRASS}`, color: BRASS, borderRadius: 8, padding: "8px 13px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Ver PDF</button>
          </div>}
        </div>); })}
      </div>}

      {/* Certificados semanales emitidos por V+V — sólo lectura. El PDF se arma
          al momento (buildPdfCertSemanal), no depende de que haya quedado
          guardado un c.html — por eso ahora TODOS muestran "Ver informe",
          no solo el que por casualidad tenía el PDF viejo guardado. */}
      {certsTodos.length > 0 && <div style={{ padding: "0 18px", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 8px" }}>Certificados semanales de avance</div>
        {certsTodos.map(c => (<div key={c.id} onClick={() => setDocAbierto({ html: c.html || buildPdfCertSemanal(c, c._obra), titulo: `Certificado ${fFechaCorta(c.desde)} al ${fFechaCorta(c.hasta)}` })} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${BRASS}`, borderRadius: 10, padding: "10px 12px", marginBottom: 7, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Semana {fFechaCorta(c.desde)} al {fFechaCorta(c.hasta)}</div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{c._obra} · {(c.av || []).length} avance(s) · {(c.bt || []).length} de bitácora · emitido {c.emitido}</div>
            </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.accent, flexShrink: 0, background: T.accentLight, borderRadius: 6, padding: "5px 9px" }}>Ver informe</div>
              <button onClick={e => { e.stopPropagation(); mandarAlPropietario(c._obraId, c._obra, { ...c, html: c.html || buildPdfCertSemanal(c, c._obra) }, "cert"); }} style={{ background: ((envios || {})[c._obraId] || []).some(x => x.id === c.id) ? "rgba(22,163,74,.18)" : BRASS, border: "none", color: ((envios || {})[c._obraId] || []).some(x => x.id === c.id) ? "#166534" : "#fff", borderRadius: 6, padding: "5px 9px", fontSize: 10.5, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>{((envios || {})[c._obraId] || []).some(x => x.id === c.id) ? "✓ Enviado" : "→ Propietario"}</button>
          </div>
        </div>))}
      </div>}

      {/* Informes de avance — cada carga de fotos con su lectura */}
      {avTodos.length > 0 && <div style={{ padding: "0 18px", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 8px" }}>Informes de avance</div>
        {avTodos.map(a => { const fs = (a.fotos && a.fotos.length) ? a.fotos : (a.fotoUrl ? [a.fotoUrl] : []); return (
          <div key={a.id} onClick={() => setDocAbierto({ html: a.html, titulo: `Informe de avance ${a.fecha}` })} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 7, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{a.fecha}{a.avance ? ` — ${a.avance}` : ""}</div>
                <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{a._obra}{fs.length ? ` · ${fs.length} foto${fs.length > 1 ? "s" : ""}` : ""}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.accent, flexShrink: 0, background: T.accentLight, borderRadius: 6, padding: "5px 9px" }}>Ver informe</div>
              <button onClick={e => { e.stopPropagation(); mandarAlPropietario(a._obraId, a._obra, a, "av"); }} style={{ background: ((envios || {})[a._obraId] || []).some(x => x.id === a.id) ? "rgba(22,163,74,.18)" : BRASS, border: "none", color: ((envios || {})[a._obraId] || []).some(x => x.id === a.id) ? "#166534" : "#fff", borderRadius: 6, padding: "5px 9px", fontSize: 10.5, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>{((envios || {})[a._obraId] || []).some(x => x.id === a.id) ? "✓ Enviado" : "→ Propietario"}</button>
            </div>
            {avAbierto?.id === a.id && <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
              {a.descripcion && <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: fs.length ? 9 : 0 }}>{a.descripcion}</div>}
              {fs.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                {fs.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 7, overflow: "hidden", border: `1px solid ${T.border}` }}><img src={u} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} /></a>)}
              </div>}
            </div>}
          </div>); })}
      </div>}
    <div style={{ padding: "16px 20px" }}>
      {false && <div style={{ marginBottom: 18 }}>
        <Eyebrow T={T}>Formularios recibidos de V+V</Eyebrow>
        {forms.map(f => { const tpl = FORM_TPLS.find(t => t.id === f.tplId); return (<Card T={T} key={f.id} style={{ padding: 13, marginBottom: 9, borderLeft: `3px solid ${BRASS}` }}>
          <div onClick={() => setVerForm({ f, tpl, obra: nomObra(f.obra_id) })} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{tpl?.nombre || "Formulario"}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{nomObra(f.obra_id)} · {f.fecha}{f.nro ? ` · N° ${f.nro}` : ""}</div></div>
            {f.resultado ? <span style={{ fontSize: 9.5, fontWeight: 800, color: f.resultado.includes("NO APTO") ? "#EF4444" : f.resultado.includes("OBSERV") ? "#B45309" : "#16A34A", flexShrink: 0 }}>{f.resultado.replace(" PARA INICIO", "")}</span> : <span style={{ color: T.accent, fontWeight: 700, fontSize: 11 }}>Ver →</span>}
          </div>
        </Card>); })}
      </div>}
      <Eyebrow T={T}>Informes técnicos</Eyebrow>
      {todos.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "34px 18px" }}>Todavía no hay informes técnicos publicados.</div>}
      {todos.map(inf => (<Card T={T} key={inf.id} style={{ padding: 13, marginBottom: 9 }}>
        <div onClick={() => setOpen(inf)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{inf.titulo || "Informe"}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{inf.obra} · {inf.fecha}{(inf.archivos || []).length ? ` · ${(inf.archivos || []).length} adj.` : ""}</div></div>
          <Badge c={inf.tipo === "ia" ? "#8B5CF6" : "#3B82F6"} b={inf.tipo === "ia" ? "rgba(139,92,246,.14)" : "rgba(37,99,235,.14)"}>{inf.tipo === "ia" ? "IA" : "Técnico"}</Badge>
        </div>
      </Card>))}
    </div>
    {verForm && <FormViewer T={T} tpl={verForm.tpl} f={verForm.f} obraNombre={verForm.obra} onClose={() => setVerForm(null)} />}
    {open && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={() => setOpen(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 1180, margin: "0 auto", padding: "20px", maxHeight: "85vh", overflowY: "auto", animation: "up .25s ease" }}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>{open.obra} · {open.fecha}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 12 }}>{open.titulo || "Informe"}</div>
        {open.texto && <div style={{ background: T.bg, borderRadius: T.rsm, padding: "14px 15px", fontSize: 12.5, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{open.texto}</div>}
        {(open.archivos || []).map((a, i) => <button key={i} onClick={() => descargarArchivo(a.url, a.nombre)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 700, color: T.accent, cursor: "pointer" }}>⬇ {a.nombre}</button>)}
      </div>
    </div>}
  </div>);
}

// ── PLAN DE GESTIÓN (cliente · lectura) ──────────────────────────────
function FormulariosScreen({ T, obras, formularios = [] }) {
  const [filtro, setFiltro] = useState("");
  const [verForm, setVerForm] = useState(null);
  const [certConformidad] = useStored("vv_cert_conformidad", []);
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  const forms = (formularios || []).filter(f => f.compartido && (!filtro || f.obra_id === filtro)).sort((a, b) => (b.id > a.id ? 1 : -1));
  const certs = (certConformidad || []).filter(c => !filtro || c.obra_id === filtro).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "16px 20px" }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Obra</label>
      <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 16px" }}><option value="">Todas las obras</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>

      <Eyebrow T={T}>Certificados de conformidad de etapas</Eyebrow>
      {certs.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12, padding: "14px 4px", lineHeight: 1.5 }}>Todavía no hay certificados de conformidad cargados.</div>}
      {certs.map(c => (<Card T={T} key={c.id} style={{ padding: 12, marginBottom: 8, borderLeft: `3px solid ${BRASS}` }}>
        <a href={c.url} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{c.nombre}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{nomObra(c.obra_id)} · {c.fecha}{c.auditor ? ` · Auditor: ${c.auditor}` : ""}</div></div>
          <span style={{ color: T.accent, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>Ver →</span>
        </a>
      </Card>))}

      <div style={{ marginTop: 18 }}><Eyebrow T={T}>Formularios recibidos de V+V</Eyebrow></div>
      {forms.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "34px 18px", lineHeight: 1.55 }}>Todavía no recibiste formularios de V+V.<br />Cuando V+V comparta un formulario, aparece acá.</div>}
      {forms.map(f => { const tpl = FORM_TPLS.find(t => t.id === f.tplId); return (<Card T={T} key={f.id} style={{ padding: 13, marginBottom: 9, borderLeft: `3px solid ${BRASS}` }}>
        <div onClick={() => setVerForm({ f, tpl, obra: nomObra(f.obra_id) })} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{tpl?.nombre || "Formulario"}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{nomObra(f.obra_id)} · {f.fecha}{f.nro ? ` · N° ${f.nro}` : ""}{f.compartidoFecha ? ` · compartido ${f.compartidoFecha}` : ""}</div></div>
          {f.resultado ? <span style={{ fontSize: 9.5, fontWeight: 800, color: f.resultado.includes("NO APTO") ? "#EF4444" : f.resultado.includes("OBSERV") ? "#B45309" : "#16A34A", flexShrink: 0 }}>{f.resultado.replace(" PARA INICIO", "")}</span> : <span style={{ color: T.accent, fontWeight: 700, fontSize: 11 }}>Ver →</span>}
        </div>
      </Card>); })}
    </div>
    {verForm && <FormViewer T={T} tpl={verForm.tpl} f={verForm.f} obraNombre={verForm.obra} onClose={() => setVerForm(null)} />}
  </div>);
}

const TIPOS_PEDIDO_CLI = { material: { label: "Materiales", icon: "box", color: "#1B3A5B" }, definicion: { label: "Definiciones", icon: "ruler", color: "#B0894F" }, plano: { label: "Planos", icon: "plans", color: "#3B6E9E" } };
const tipoPedCli = (id) => TIPOS_PEDIDO_CLI[id] || TIPOS_PEDIDO_CLI.material;
const itemsTexto = (p) => (p.items || []).map(it => (p.tipo && p.tipo !== "material") ? `${it.nombre}${it.detalle ? ` (${it.detalle})` : ""}` : `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim());


// ═══ DEFINICIONES — misma pantalla que la app de Contratistas ═══
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
    const faltantes = grupos.map(g => ({ rubro: g.rubro, items: g.items.filter(i => !i.tiene) })).filter(g => g.items.length);
    const rowsHtml = faltantes.map(g => `<tr class="rub"><td colspan="2">${g.rubro}</td></tr>` + g.items.map(i => `<tr><td class="dot">•</td><td>${i.nombre}${i.obs ? `<div style="font-size:11px;color:#5B6B7F;margin-top:2px">Obs: ${String(i.obs).replace(/</g, "&lt;")}</div>` : ""}</td></tr>`).join("")).join("");
    const pct = items.length ? Math.round(tienen / items.length * 100) : 0;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Definiciones faltantes ${obraNom(obraId)}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Arial,sans-serif;color:#0F1B2D;padding:0 0 40px;line-height:1.5}.head{background:#0F1B2D;color:#fff;padding:20px 34px;border-bottom:4px solid #B0894F}.brand{font-size:20px;font-weight:800}.brand small{display:block;font-size:9px;color:#B0894F;letter-spacing:2px;margin-top:2px}.doc{font-size:12px;font-weight:800;color:#B0894F;text-transform:uppercase;letter-spacing:1px;margin-top:6px}.wrap{padding:0 34px}.meta{display:flex;justify-content:space-between;margin:18px 0;font-size:12px;color:#5B6B7F}.kpi{display:flex;gap:0;margin:14px 0;border:1px solid #E3E8EF;border-radius:8px;overflow:hidden}.kpi div{flex:1;text-align:center;padding:10px;border-right:1px solid #E3E8EF}.kpi div:last-child{border-right:none}.kpi b{display:block;font-size:20px}.kpi span{font-size:8px;color:#5B6B7F;text-transform:uppercase}table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}td{padding:7px 8px;border-bottom:1px solid #EEF1F5;vertical-align:top}.rub td{background:#EAF0F7;color:#1B3A5B;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.03em}.dot{width:20px;color:#B0894F;text-align:center}.obs{font-size:10px;color:#5B6B7F;margin-top:20px;border-top:1px solid #D6DCE4;padding-top:8px}.firmas{display:flex;justify-content:space-between;margin-top:44px}.firma{width:44%;text-align:center;font-size:10px;color:#5B6B7F}.firma .ln{border-top:1px solid #0F1B2D;padding-top:5px;margin-top:34px}@media print{.noprint{display:none}}</style></head><body><div class="head"><div class="brand">V+V CONSTRUCCIONES<small>CONSTRUCTORA</small></div><div class="doc">Definiciones faltantes de obra</div></div><div class="wrap"><div class="meta"><div>Obra: <b>${obraNom(obraId)}</b></div><div>Fecha: ${hoyStr()}</div></div><div class="kpi"><div><b style="color:#B91C1C">${faltan}</b><span>Faltantes</span></div><div><b style="color:#16A34A">${tienen}</b><span>Definidas</span></div><div><b>${items.length}</b><span>Total</span></div><div><b>${pct}%</b><span>Definido</span></div></div>${faltantes.length ? `<table><tbody>${rowsHtml}</tbody></table>` : '<p style="padding:20px 0;text-align:center;color:#16A34A;font-weight:700">No hay definiciones faltantes. Todas resueltas.</p>'}<div class="obs">Las definiciones pendientes atrasan el normal desarrollo de las tareas de albañilería, revoques y colocaciones. Es importante resolverlas para poder dar curso a las tareas, contrataciones y pedidos de materiales.</div><div class="firmas"><div class="firma"><div class="ln">${empresa || "V+V Construcciones"}</div></div><div class="firma"><div class="ln">Belfast CM — Recibido</div></div></div></div></body></html>`;
    setPdfHtml(html);
  }
  function waFaltantes() {
    const faltantes = grupos.map(g => ({ rubro: g.rubro, items: g.items.filter(i => !i.tiene) })).filter(g => g.items.length);
    const txt = `*DEFINICIONES FALTANTES*\nObra: ${obraNom(obraId)}\nFecha: ${hoyStr()}\n\n` + faltantes.map(g => `*${g.rubro}*\n` + g.items.map(i => `• ${i.nombre}${i.obs ? ` (${i.obs})` : ""}`).join("\n")).join("\n\n") + `\n\nFaltan ${faltan} de ${items.length} definiciones.\n(V+V Construcciones)`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
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
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 8 }}>{g.rubro}</div>
        {g.items.map(it => (<div key={it.id} style={{ padding: "9px 0", borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => toggle(it.id)} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${it.tiene ? "#16A34A" : T.border}`, background: it.tiene ? "#16A34A" : "transparent", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{it.tiene ? "✓" : ""}</button>
            <div style={{ flex: 1, fontSize: 13, color: it.tiene ? T.text : T.sub }}>{it.nombre}<span style={{ fontSize: 9.5, fontWeight: 800, color: it.tiene ? "#16A34A" : "#B45309", marginLeft: 6 }}>{it.tiene ? "TENEMOS" : "FALTA"}</span></div>
            <button onClick={() => quitar(it.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>✕</button>
          </div>
          <input defaultValue={it.obs || ""} onBlur={e => setObs(it.id, e.target.value)} placeholder="Observación (opcional)…" style={{ width: "100%", marginTop: 6, marginLeft: 34, maxWidth: "calc(100% - 34px)", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 10px", fontSize: 12, color: T.text, boxSizing: "border-box" }} />
        </div>))}
      </div>))}

      {/* agregar manual */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <input value={nuevoRubro} onChange={e => setNuevoRubro(e.target.value)} placeholder="Rubro" style={{ width: 110, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, color: T.text }} />
        <input value={nuevaDef} onChange={e => setNuevaDef(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregarManual(); } }} placeholder="Agregar definición…" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, color: T.text }} />
        <button onClick={agregarManual} style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "0 15px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>＋</button>
      </div>

      <button onClick={pdfFaltantes} style={{ width: "100%", background: T.navy, color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}><Ico n="doc" /> PDF de definiciones faltantes</button>
      <button onClick={wordDefiniciones} style={{ width: "100%", background: "#2B579A", color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}><Ico n="word" /> Word editable (todas + observaciones)</button>
      <button onClick={waFaltantes} style={{ width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}><Ico n="send" /> Enviar faltantes por WhatsApp</button>

      {/* ── Google Form ── */}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: 12, marginBottom: 9, background: T.card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: gformCfg ? 10 : (reg?.formId ? 10 : 0) }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}><Ico n="list" /> Formulario para el jefe de obra</div>
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
        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text, marginBottom: 6 }}>Observaciones del jefe de obra</div>
        {Object.keys(reg.gformObs).filter(k => reg.gformObs[k]).map(k => (
          <div key={k} style={{ fontSize: 12, color: T.text, marginBottom: 4, lineHeight: 1.4 }}><b>{k}:</b> {reg.gformObs[k]}</div>
        ))}
      </div>}
      <button onClick={limpiar} style={{ width: "100%", background: "none", color: T.muted, border: "none", padding: "8px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Borrar todo y empezar de nuevo</button>
    </>}

    {items.length === 0 && !cargando && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "10px", lineHeight: 1.6 }}>Subí el Excel de definiciones para armar el checklist.<br />También podés cargarlas a mano una vez que subas al menos una.</div>}

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



// ═══ Recepción de docs (igual que la app de Contratistas) ═══
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


function MaterialesScreen({ T, cfg, obras, personal = [], contactos = [], matpedidos = [], setMatpedidos, definiciones = [], setDefiniciones, docrecepcion = [], setDocrecepcion }) {
  // Estado del pedido de información (definiciones y planos): cuánto hace que espera
  // y cuándo V+V registró la recepción.
  const diasDe = (p) => { const t0 = p.ts || 0; return t0 ? Math.max(0, Math.floor((Date.now() - t0) / 86400000)) : 0; };
  const alertaDe = (p) => { const d = diasDe(p); if (d >= 5) return { txt: `⚠ Vencido — ${d} días sin respuesta`, color: "#B91C1C", bg: "rgba(239,68,68,.10)", bd: "rgba(239,68,68,.30)" }; if (d >= 3) return { txt: `⏳ ${d} días esperando`, color: "#B45309", bg: "rgba(180,83,9,.14)", bd: "rgba(180,83,9,.30)" }; return { txt: d === 0 ? "Pedido hoy" : d === 1 ? "1 día esperando" : `${d} días esperando`, color: "#1B3A5B", bg: "rgba(37,99,235,.14)", bd: "#DBEAFE" }; };
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  const [waFor, setWaFor] = useState(null);
  function marcarEnviado(id) { aplicarMats(setMatpedidos, prev => (prev || []).map(x => x.id === id ? { ...x, waEnviado: true, waEnviadoFecha: hoyStr(), waEnviadoPor: cfg?.sigla || "Belfast" } : x)); }
  function levantar(id, val) { aplicarMats(setMatpedidos, prev => (prev || []).map(x => x.id === id ? { ...x, leido: val, leidoFecha: val ? hoyStr() : "", leidoPor: val ? (cfg?.nombre || cfg?.sigla || "Belfast") : "" } : x)); }
  function waText(p) {
    const tp = tipoPedCli(p.tipo);
    const lines = itemsTexto(p).map(l => `• ${l}`);
    return `*Pedido de ${tp.label.toLowerCase()}* — ${nomObra(p.obra_id)}\nFecha: ${p.fecha}${p.de === "contratista" && p.empresa ? `\nContratista: ${p.empresa}` : ""}\n\n${lines.join("\n")}${p.nota ? "\n\nNota: " + p.nota : ""}\n\nPor favor, confirmá la recepción respondiendo este mensaje con *OK / RECIBIDO*.\n\n(Enviado desde ${cfg?.nombre || "Belfast"})`;
  }
  function waLink(text, phone) {
    const t = encodeURIComponent(text);
    if (phone) { const clean = String(phone).replace(/\D/g, ""); const num = clean.startsWith("54") ? clean : ("549" + clean); return `https://wa.me/${num}?text=${t}`; }
    return `https://wa.me/?text=${t}`;
  }
  const [vistaMat, setVistaMat] = useState("pedidos");
  const [form, setForm] = useState(null);
  function nuevo(tipo = "material") { setForm({ tipo, obra_id: obras[0]?.id || "", items: [{ nombre: "", cantidad: "", unidad: "u", detalle: "" }], nota: "", fecha_pedido: new Date().toISOString().slice(0, 10), fecha_necesita: "" }); }
  function addItem() { setForm(f => ({ ...f, items: [...f.items, { nombre: "", cantidad: "", unidad: "u", detalle: "" }] })); }
  function setItem(i, k, v) { setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) })); }
  function delItem(i) { setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) })); }
  async function guardar() {
    const tipo = form.tipo || "material";
    const items = (form.items || []).filter(it => (it.nombre || "").trim()).map(it => ({ nombre: it.nombre.trim(), cantidad: it.cantidad != null ? String(it.cantidad) : "", unidad: it.unidad || "u", detalle: (it.detalle || "").trim() }));
    if (!items.length) { alert(`Agregá al menos ${tipo === "material" ? "un material" : tipo === "plano" ? "un plano" : "una definición"}.`); return; }
    const p = { id: uid() + Date.now(), tipo, obra_id: form.obra_id, items, nota: form.nota || "", solicitante: (form.solicitante || "").trim(), fecha: hoyStr(), fecha_pedido: form.fecha_pedido || "", fecha_necesita: form.fecha_necesita || "", ts: Date.now(), de: "cliente", empresa: cfg?.nombre || "Belfast", leido: false, leidoFecha: "" };
    aplicarMats(setMatpedidos, prev => [p, ...(prev || [])]);
    setForm(null);
    alert("✓ Pedido enviado a V+V.");
  }
  const [fTipo, setFTipo] = useState("");
  const [fObra, setFObra] = useState("");
  const lista = (matpedidos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const obrasConPedidos = (obras || []).filter(o => lista.some(p => p.obra_id === o.id));
  const listaF = lista.filter(p => (!fObra || p.obra_id === fObra) && (!fTipo || (p.tipo || "material") === fTipo));
  const infoPend = lista.filter(p => p.tipo !== "material" && !p.cumplido);
  const infoVenc = infoPend.filter(p => diasDe(p) >= 5);
  const infoOk = lista.filter(p => p.tipo !== "material" && p.cumplido);
  const tabsMat = (<div style={{ display: "flex", gap: 7, padding: "14px 16px 0" }}>
    {[["pedidos", "Pedidos recibidos"], ["definiciones", "Definiciones"], ["recepcion", "Recepción de docs"]].map(([k, l]) => (
      <button key={k} onClick={() => setVistaMat(k)} style={{ flex: 1, background: vistaMat === k ? T.navy : "transparent", color: vistaMat === k ? "#fff" : T.sub, border: `1px solid ${vistaMat === k ? T.navy : T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
    ))}
  </div>);
  if (vistaMat === "recepcion") return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    {tabsMat}
    <RecepcionDocs obras={obras} empresa={cfg?.nombre || "Belfast"} docrecepcion={docrecepcion} persistDoc={setDocrecepcion} />
  </div>);
  if (vistaMat === "definiciones") return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ display: "flex", gap: 7, padding: "14px 16px 0" }}>
      {[["pedidos", "Pedidos recibidos"], ["definiciones", "Definiciones"], ["recepcion", "Recepción de docs"]].map(([k, l]) => (
        <button key={k} onClick={() => setVistaMat(k)} style={{ flex: 1, background: vistaMat === k ? T.navy : "transparent", color: vistaMat === k ? "#fff" : T.sub, border: `1px solid ${vistaMat === k ? T.navy : T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
      ))}
    </div>
    <DefinicionesView obras={obras} empresa={cfg?.nombre || "Belfast"} definiciones={definiciones} persistDef={setDefiniciones} />
  </div>);
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ display: "flex", gap: 7, padding: "14px 16px 0" }}>
      {[["pedidos", "Pedidos recibidos"], ["definiciones", "Definiciones"], ["recepcion", "Recepción de docs"]].map(([k, l]) => (
        <button key={k} onClick={() => setVistaMat(k)} style={{ flex: 1, background: vistaMat === k ? T.navy : "transparent", color: vistaMat === k ? "#fff" : T.sub, border: `1px solid ${vistaMat === k ? T.navy : T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
      ))}
    </div>
    {(infoPend.length > 0 || infoOk.length > 0) && <div style={{ margin: "14px 16px 0", background: infoVenc.length ? "rgba(239,68,68,.10)" : "#fff", border: `1px solid ${infoVenc.length ? "rgba(239,68,68,.30)" : T.border}`, borderLeft: `3px solid ${infoVenc.length ? "#B91C1C" : BRASS}`, borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: infoVenc.length ? "#B91C1C" : T.navy }}>
        {infoVenc.length ? `⚠ ${infoVenc.length} pedido(s) de información vencido(s)` : infoPend.length ? `${infoPend.length} pedido(s) de información pendiente(s)` : "Sin pedidos de información pendientes"}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 3, lineHeight: 1.45 }}>Definiciones y planos solicitados por V+V. {infoOk.length} con recepción registrada. Se considera vencido a los 5 días sin respuesta.</div>
    </div>}
    <div style={{ padding: "16px 20px" }}>
      <Eyebrow T={T}>Pedidos de V+V · materiales, definiciones y planos</Eyebrow>
      {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "34px 18px", lineHeight: 1.55 }}>Todavía no recibiste pedidos de materiales.<br />Cuando V+V cargue uno, aparece acá.</div>}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9 }}>Qué querés pedir</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {Object.keys(TIPOS_PEDIDO_CLI).map(k => { const t = TIPOS_PEDIDO_CLI[k]; return (
            <button key={k} onClick={() => nuevo(k)} style={{ flex: 1, background: T.card, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 6px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", textAlign: "center", borderTop: `3px solid ${t.color}` }}>
              <div style={{ fontSize: 20, marginBottom: 3 }}><Ico n={t.icon} s={18} /></div>{t.label}
            </button>); })}
        </div>
      </div>
      {lista.length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, margin: "0 16px 12px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 7, flexWrap: "wrap" }}>
          <button onClick={() => setFTipo("")} style={{ background: fTipo === "" ? T.accent : T.card, color: fTipo === "" ? "#fff" : T.sub, border: `1px solid ${fTipo === "" ? T.accent : T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Todo</button>
          {Object.keys(TIPOS_PEDIDO_CLI).map(k => { const t = TIPOS_PEDIDO_CLI[k]; return (
            <button key={k} onClick={() => setFTipo(fTipo === k ? "" : k)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: fTipo === k ? t.color : T.card, color: fTipo === k ? "#fff" : T.sub, border: `1px solid ${fTipo === k ? t.color : T.border}`, borderRadius: 8, padding: "6px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              <span><Ico n={t.icon} s={18} /></span>{t.label}
            </button>); })}
        </div>
        {obrasConPedidos.length > 1 && <select value={fObra} onChange={e => setFObra(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 11px", fontSize: 12.5, fontWeight: 600, color: T.text, boxSizing: "border-box" }}>
          <option value="">Todas las obras</option>
          {obrasConPedidos.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>}
      </div>}
      {listaF.map(p => { const jefes = [...(contactos || []).filter(c => (!c.obra_id || c.obra_id === p.obra_id) && (c.telefono || "").trim()), ...(personal || []).filter(pe => pe.obra_id === p.obra_id && (pe.telefono || "").trim())]; return (<Card T={T} key={p.id} style={{ padding: 13, marginBottom: 9, borderLeft: `3px solid ${tipoPedCli(p.tipo).color}` }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}><span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: tipoPedCli(p.tipo).color, borderRadius: 5, padding: "2px 7px", marginRight: 8 }}><Ico n={tipoPedCli(p.tipo).icon} s={13} c="#fff" /> {tipoPedCli(p.tipo).label}</span>{nomObra(p.obra_id)} · {p.fecha}<span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 800, color: "#fff", background: p.de === "vv" ? T.accent : BRASS, borderRadius: 5, padding: "2px 7px" }}>{p.de === "vv" ? "V+V" : (p.empresa || "Contratista")}</span></div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{itemsTexto(p).map(l => `• ${l}`).join("\n")}</div>
          {(p.solicitante || p.empresa) && <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "4px 9px", fontSize: 11, fontWeight: 700, color: T.sub }}><Ico n="user" s={12} c={T.sub} /> Pidió: {p.solicitante || p.empresa}{p.solicitante && p.empresa ? ` (${p.empresa})` : ""}</div>}
          {p.nota && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5, fontStyle: "italic" }}>{p.nota}</div>}
          <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 6, color: p.leido ? "#16A34A" : "#B45309" }}>{p.leido ? `✓ Levantado${p.leidoFecha ? " · " + p.leidoFecha : ""}` : "● Sin levantar"}</div>
          {p.tipo !== "material" && (p.cumplido
            ? <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: "#15803D", background: "rgba(22,163,74,.14)", border: "1px solid rgba(22,163,74,.30)", borderRadius: 6, padding: "3px 8px", marginTop: 7 }}>✓ Recepción registrada{p.cumplidoFecha ? " · " + p.cumplidoFecha : ""}</div>
            : (() => { const a = alertaDe(p); return <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: a.color, background: a.bg, border: `1px solid ${a.bd}`, borderRadius: 6, padding: "3px 8px", marginTop: 7 }}>{a.txt}</div>; })())}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          <button onClick={() => levantar(p.id, !p.leido)} style={{ flex: 1, background: p.leido ? T.bg : "rgba(22,163,74,.14)", color: p.leido ? T.sub : "#15803D", border: `1px solid ${p.leido ? T.border : "rgba(22,163,74,.30)"}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{p.leido ? "↩ Marcar sin levantar" : "✓ Levantar pedido"}</button>
          <button onClick={() => setWaFor(waFor === p.id ? null : p.id)} style={{ flex: 1, background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}><Ico n="send" /> WhatsApp</button>
          <button onClick={() => { if (confirm("¿Eliminar este pedido? Se borra para las dos empresas.")) aplicarMats(setMatpedidos, prev => (prev || []).filter(x => x.id !== p.id)); }} style={{ background: "none", border: "1px solid rgba(239,68,68,.35)", color: "#EF4444", borderRadius: T.rsm, padding: "10px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>
        {p.waEnviado && <div style={{ fontSize: 10, fontWeight: 700, color: "#0E7490", marginTop: 5 }}><Ico n="send" /> Enviado por WhatsApp{p.waEnviadoFecha ? " · " + p.waEnviadoFecha : ""}{p.waEnviadoPor ? " · " + p.waEnviadoPor : ""}</div>}
        {waFor === p.id && <div style={{ marginTop: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 11px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Enviar a…</div>
          {jefes.map(j => <a key={j.id} href={waLink(waText(p), j.telefono)} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", marginBottom: 7 }}><Ico n="send" /> {j.nombre}{j.rol ? ` · ${j.rol}` : ""}</a>)}
          <a href={waLink(waText(p))} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Elegir contacto de WhatsApp…</a>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>Se abre WhatsApp con el pedido ya escrito. Los jefes de obra con teléfono cargado aparecen arriba.</div>
        </div>}
      </Card>); })}
    </div>
    {form && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setForm(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 620, padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 14 }}>{form.id ? `Editar pedido de ${tipoPedCli(form.tipo).label.toLowerCase()}` : `Nuevo pedido de ${tipoPedCli(form.tipo).label.toLowerCase()}`}</div>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
        <select value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", fontSize: 14, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }}>
          {obras.length === 0 && <option value="">(sin obras cargadas)</option>}
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>{tipoPedCli(form.tipo).label}</div>
        {form.items.map((it, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <input value={it.nombre} onChange={e => setItem(i, "nombre", e.target.value)} placeholder={form.tipo === "material" ? "Material" : form.tipo === "plano" ? "Plano (ej: Estructura losa)" : "Definición (ej: Tipo de piso)"} style={{ flex: 2, minWidth: 0, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text }} />
          {(form.tipo || "material") === "material" ? <>
            <input value={it.cantidad} onChange={e => setItem(i, "cantidad", e.target.value)} placeholder="Cant." type="number" style={{ width: 60, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />
            <input value={it.unidad} onChange={e => setItem(i, "unidad", e.target.value)} placeholder="u" style={{ width: 50, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />
          </> : <input value={it.detalle || ""} onChange={e => setItem(i, "detalle", e.target.value)} placeholder="Detalle (opcional)" style={{ flex: 1.2, minWidth: 0, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />}
          {form.items.length > 1 && <button onClick={() => delItem(i)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer" }}>✕</button>}
        </div>))}
        <button onClick={addItem} style={{ background: T.al, color: T.accent, border: "none", borderRadius: T.rsm, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>＋ Agregar {tipoPedCli(form.tipo).sing}</button>
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
        <input value={form.solicitante || ""} onChange={e => setForm({ ...form, solicitante: e.target.value })} placeholder="Nombre y rol" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Nota (opcional)</label>
        <textarea value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} rows={2} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text, margin: "6px 0 14px", boxSizing: "border-box", resize: "vertical" }} />
        <button onClick={guardar} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{form.id ? "Guardar cambios" : "Enviar pedido"}</button>
      </div>
    </div>}
  </div>);
}
// Feriados nacionales argentinos. Un día feriado NO es hábil: no corre plazo
// ni se programa trabajo. Si el gobierno agrega puentes turísticos, se suman acá.
const FERIADOS = new Set([
  // 2026
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02", "2026-04-03",
  "2026-05-01", "2026-05-25", "2026-06-17", "2026-06-20", "2026-07-09", "2026-08-17",
  "2026-10-12", "2026-11-20", "2026-12-08", "2026-12-25",
  // 2027 (trasladables sujetos a confirmación oficial)
  "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-24", "2027-03-26", "2027-04-02",
  "2027-05-01", "2027-05-25", "2027-06-17", "2027-06-20", "2027-07-09", "2027-08-16",
  "2027-10-11", "2027-11-22", "2027-12-08", "2027-12-25",
]);
const _isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function diasHabiles(d1, d2) { if (!d1 || !d2) return 0; const a = new Date(d1); a.setHours(0, 0, 0, 0); const b = new Date(d2); b.setHours(0, 0, 0, 0); if (b <= a) return 0; let n = 0; const cur = new Date(a); while (cur < b) { cur.setDate(cur.getDate() + 1); const wd = cur.getDay(); if (wd !== 0 && wd !== 6 && !FERIADOS.has(_isoDe(cur))) n++; } return n; }
function gMetricas(fechaSolic, fechaReal, plazo, cerrado) { const fin = fechaReal || new Date(); const dias = diasHabiles(fechaSolic, fin); const desvio = dias - plazo; let estado; if (fechaReal || cerrado) estado = desvio <= 0 ? "Cumplido" : "Fuera de plazo"; else estado = desvio <= 0 ? "En plazo" : "Vencido"; return { dias, desvio, estado, retraso: Math.max(0, desvio) }; }
const GEST_ESTADOS = { "Cumplido": { c: "#16A34A", b: "rgba(22,163,74,.14)" }, "En plazo": { c: "#3B82F6", b: "rgba(37,99,235,.14)" }, "Fuera de plazo": { c: "#F59E0B", b: "rgba(180,83,9,.14)" }, "Vencido": { c: "#EF4444", b: "rgba(239,68,68,.10)" } };
const fmtD = d => d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "—";

/* ═══ CRONOGRAMAS (solo lectura, espejo de la app Cronograma de V+V) ═══
   Belfast ve el mismo plan que V+V: fechas planificadas, fechas comprometidas,
   fechas REALES de ejecución y las definiciones que le tocan responder —
   con su estado en el circuito de Gestión. Mismo motor de cálculo. */
const crNum = (x) => { const n = Number(String(x ?? "").replace(",", ".")); return isNaN(n) ? 0 : n; };
const crHoy = () => new Date().toISOString().slice(0, 10);
function crIsoMas(iso, dias) { if (!iso) return ""; const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + Math.round(crNum(dias))); return d.toISOString().slice(0, 10); }
function crDiasEntre(a, b) { if (!a || !b) return 0; return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000); }
function crEsHabil(iso) { if (!iso) return false; if (FERIADOS.has(iso)) return false; const d = new Date(iso + "T12:00:00"); const w = d.getDay(); return w >= 1 && w <= 5; }
function crPrimerHabil(iso) { let f = iso; for (let i = 0; i < 7; i++) { if (crEsHabil(f)) return f; f = crIsoMas(f, 1); } return iso; }
function crHabilDesde(inicio, n) { if (!inicio) return ""; let f = crPrimerHabil(inicio); let q = Math.max(0, Math.round(crNum(n))); let g = 0; while (q > 0 && g < 20000) { f = crIsoMas(f, 1); if (crEsHabil(f)) q--; g++; } return f; }
const CR_MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function crFmt(iso) { if (!iso) return "—"; const d = new Date(iso + "T12:00:00"); return `${d.getDate()} ${CR_MES[d.getMonth()]}`; }
function crCPM(tareas) {
  const T2 = (tareas || []).filter(t => t && t.id).map(t => ({ ...t, dias: Math.max(1, crNum(t.dias)), deps: (t.deps || []).filter(d => d && d.cod) }));
  const porCod = {}; T2.forEach(t => { if (t.cod) porCod[t.cod] = t; });
  const ES = {}, EF = {}, vis = {}, ok = {};
  function fES(t) { if (ok[t.id]) return ES[t.id]; if (vis[t.id]) { ES[t.id] = 0; EF[t.id] = t.dias; return 0; } vis[t.id] = true; let es = 0; for (const d of t.deps) { const p = porCod[d.cod]; if (!p || p.id === t.id) continue; fES(p); const c = d.tipo === "CC" ? ES[p.id] + crNum(d.lag) : EF[p.id] + crNum(d.lag); if (c > es) es = c; } es = Math.max(0, es); ES[t.id] = es; EF[t.id] = es + t.dias; vis[t.id] = false; ok[t.id] = true; return es; }
  T2.forEach(fES);
  const fin = T2.reduce((m, t) => Math.max(m, EF[t.id] || 0), 0);
  const suc = {}; T2.forEach(t => { suc[t.id] = []; });
  T2.forEach(sx => { for (const d of sx.deps) { const p = porCod[d.cod]; if (!p || p.id === sx.id) continue; suc[p.id].push({ s: sx, tipo: d.tipo, lag: crNum(d.lag) }); } });
  const LS = {}, LF = {}, ok2 = {}, vis2 = {};
  function fLS(t) { if (ok2[t.id]) return LS[t.id]; if (vis2[t.id]) { LF[t.id] = fin; LS[t.id] = fin - t.dias; return LS[t.id]; } vis2[t.id] = true; let lf = fin; for (const { s: sx, tipo, lag } of suc[t.id] || []) { if (tipo !== "FC") continue; fLS(sx); const c = LS[sx.id] - lag; if (c < lf) lf = c; } let ls = lf - t.dias; for (const { s: sx, tipo, lag } of suc[t.id] || []) { if (tipo !== "CC") continue; fLS(sx); const c = LS[sx.id] - lag; if (c < ls) ls = c; } LF[t.id] = lf; LS[t.id] = ls; vis2[t.id] = false; ok2[t.id] = true; return ls; }
  T2.forEach(fLS);
  return T2.map(t => ({ ...t, es: ES[t.id] ?? 0, ef: EF[t.id] ?? 0, critica: Math.round((LS[t.id] ?? 0) - (ES[t.id] ?? 0)) <= 0 }));
}
function CronogramaScreen(props) {
  // Cualquier error acá adentro se muestra en pantalla, nunca deja el panel en blanco.
  try { return CronogramaScreenInner(props); }
  catch (e) {
    const T = props.T || {};
    return (<div style={{ padding: "20px" }}>
      <div style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#B91C1C" }}>La pantalla de cronogramas tuvo un problema</div>
        <div style={{ fontSize: 12, color: "#991B1B", marginTop: 6, wordBreak: "break-word" }}>Error: {String(e && e.message || e)}</div>
        <div style={{ fontSize: 11, color: "#991B1B", marginTop: 6 }}>Sacale una captura a este mensaje y pasásela a Sebastián para corregirlo.</div>
      </div>
    </div>);
  }
}
function CronogramaScreenInner({ T, cfg, crono, gestion }) {
  const g = { punit: {}, manual: [], ...(gestion || {}) };
  const enManual = new Set((g.manual || []).map(x => x.id));
  const [ab, setAb] = useState({});
  const hoy = crHoy();
  const obras = (crono?.obras || []);
  const planes = obras.map(o => { try {
    let tareas;
    if (o.modoManual) {
      tareas = (o.tareas || []).map(t => ({ ...t, vvInicio: t.desde || o.inicio || hoy, vvFin: (t.hasta && t.hasta >= (t.desde || "")) ? t.hasta : (t.desde || o.inicio || hoy), critica: false }));
    } else {
      tareas = crCPM(o.tareas || []).map(t => ({ ...t, vvInicio: crHabilDesde(o.inicio, t.es), vvFin: crHabilDesde(o.inicio, t.ef - 1) }));
    }
    tareas = tareas.map(t => {
      const desvReal = (t.realFin && t.vvFin) ? crDiasEntre(t.vvFin, t.realFin) : null;
      const desvRealIni = (t.realInicio && t.vvInicio) ? crDiasEntre(t.vvInicio, t.realInicio) : null;
      const defs = (t.defs || []).map(d => {
        const limite = crIsoMas(t.vvInicio, -crNum(d.diasAntes));
        const faltan = limite ? crDiasEntre(hoy, limite) : null;
        let estado = "futura";
        if (d.ok) estado = "ok"; else if (faltan !== null && faltan < 0) estado = "vencida"; else if (faltan !== null && faltan <= 15) estado = "urgente";
        const gid = "cron_" + d.id;
        const dec = g.punit[gid];
        const gest = dec ? (dec.decision === "confirmado" ? "punitorio" : dec.decision === "prorroga" ? "prorroga" : "sin_perjuicio") : (enManual.has(gid) ? "evaluacion" : null);
        return { ...d, limite, faltan, estado, gest, tarea: t.nombre, critica: t.critica };
      });
      return { ...t, desvReal, desvRealIni, defs };
    });
    const fin = tareas.reduce((m, t) => (!m || t.vvFin > m) ? t.vvFin : m, "");
    const defsPend = tareas.flatMap(t => t.defs).filter(d => !d.ok);
    const venc = defsPend.filter(d => d.estado === "vencida");
    // corrimiento contra la línea base fijada en el Cronograma de V+V
    const corr = (o.finBase && fin) ? crDiasEntre(o.finBase, fin) : null;
    return { o, tareas, fin, defsPend, venc, corr };
  } catch (e) { return { o, tareas: [], fin: "", defsPend: [], venc: [], corr: null, error: String(e && e.message || e) }; } }).filter(p => p && p.o);
  const GEST_TAG = { punitorio: ["Punitorio", "#B91C1C", "rgba(239,68,68,.10)"], evaluacion: ["En evaluación", "#B45309", "rgba(180,83,9,.14)"], prorroga: ["Prórroga", "#2563EB", "rgba(37,99,235,.14)"], sin_perjuicio: ["Sin perjuicio", "#64748B", "rgba(255,255,255,.06)"] };
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.55, marginBottom: 14 }}>El plan de cada obra: fechas planificadas, comprometidas y REALES, y las definiciones pendientes de {cfg?.nombre || "Belfast"} con su estado en Gestión. Responder a tiempo evita que un retraso pase a evaluación de punitorio.</div>
      {planes.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "30px" }}>Sin cronogramas cargados.</div>}
      {planes.map(({ o, tareas, fin, defsPend, venc, corr }) => {
        const abierta = ab[o.id] !== undefined ? ab[o.id] : venc.length > 0;
        return (<Card T={T} key={o.id} style={{ padding: 0, marginBottom: 12, overflow: "hidden", borderLeft: `4px solid ${venc.length ? "#EF4444" : "#16A34A"}` }}>
          <div onClick={() => setAb(p => ({ ...p, [o.id]: !abierta }))} style={{ padding: "13px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>{o.nombre}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Fin estimado: {crFmt(fin)} · {tareas.length} tareas{corr !== null && corr > 0 ? <span style={{ color: "#B91C1C", fontWeight: 800 }}> · corrida +{corr} días</span> : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
              {venc.length > 0 ? <Badge c="#B91C1C" b="rgba(239,68,68,.10)">{venc.length} vencida{venc.length > 1 ? "s" : ""}</Badge> : defsPend.length > 0 ? <Badge c="#B45309" b="rgba(180,83,9,.14)">{defsPend.length} pendiente{defsPend.length > 1 ? "s" : ""}</Badge> : <Badge c="#16A34A" b="rgba(22,163,74,.14)">al día</Badge>}
              <span style={{ fontSize: 11, color: T.muted }}>{abierta ? "▲" : "▼"}</span>
            </div>
          </div>
          {abierta && <div style={{ borderTop: `1px solid ${T.border}`, padding: "4px 14px 13px" }}>
            {planes.find(p => p.o.id === o.id)?.error && <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 10 }}>No pude calcular esta obra: {planes.find(p => p.o.id === o.id).error}</div>}
            {corr !== null && corr > 0 && <div style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", borderRadius: 10, padding: "10px 11px", marginTop: 10, fontSize: 11.5, color: "#991B1B", lineHeight: 1.5 }}>El fin de obra se corrió <b>+{corr} días (~{(corr / 30.44).toFixed(1)} meses)</b> respecto del plan original. Todo corrimiento adicional queda sujeto a redeterminación de precios sobre el saldo del contrato.</div>}
            {defsPend.length > 0 && <>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "#B91C1C", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 10 }}>Definiciones a responder</div>
              {defsPend.map(d => { const tag = d.gest ? GEST_TAG[d.gest] : null; return (<div key={d.id} style={{ background: d.estado === "vencida" ? "rgba(239,68,68,.10)" : d.estado === "urgente" ? "rgba(180,83,9,.14)" : T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 11px", marginTop: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{d.nombre}</div>
                    <div style={{ fontSize: 10.5, color: T.sub, marginTop: 2 }}>Traba <b>{d.tarea}</b>{d.critica && <span style={{ color: "#B91C1C", fontWeight: 800 }}> · CAMINO CRÍTICO</span>}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 3, color: d.estado === "vencida" ? "#B91C1C" : d.estado === "urgente" ? "#B45309" : T.muted }}>
                      {d.estado === "vencida" ? `Vencida hace ${Math.abs(d.faltan)} días (límite ${crFmt(d.limite)})` : `Definir antes del ${crFmt(d.limite)} — faltan ${d.faltan} días`}
                    </div>
                  </div>
                  {tag && <Badge c={tag[1]} b={tag[2]}>{tag[0]}</Badge>}
                </div>
              </div>); })}
            </>}
            <div style={{ fontSize: 10.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", marginTop: 13 }}>Tareas</div>
            {tareas.map(t => (<div key={t.id} style={{ padding: "8px 0", borderBottom: `1px solid ${T.bg}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, minWidth: 0, flex: 1 }}>{t.nombre}{t.critica && <span style={{ fontSize: 9, color: "#B91C1C", fontWeight: 800, marginLeft: 6 }}>CRÍTICA</span>}</div>
                {crNum(t.avance) > 0 && <Badge c="#16A34A" b="rgba(22,163,74,.14)">{crNum(t.avance)}%</Badge>}
              </div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Plan: {crFmt(t.vvInicio)} → {crFmt(t.vvFin)}{t.bfInicio && t.bfFin ? ` · Comprometido: ${crFmt(t.bfInicio)} → ${crFmt(t.bfFin)}` : ""}</div>
              {t.realInicio && <div style={{ fontSize: 10.5, color: T.text, fontWeight: 700, marginTop: 1 }}>Real: {crFmt(t.realInicio)}{t.realFin ? ` → ${crFmt(t.realFin)}` : " → en curso"}{t.desvRealIni > 0 ? <span style={{ color: "#B91C1C" }}> · arrancó +{t.desvRealIni}d</span> : null}{t.desvReal !== null && t.desvReal !== 0 ? <span style={{ color: t.desvReal > 0 ? "#B91C1C" : "#16A34A" }}> · terminó {t.desvReal > 0 ? "+" : ""}{t.desvReal}d</span> : null}</div>}
            </div>))}
          </div>}
        </Card>);
      })}
    </div>
  </div>);
}

// ── Globito rojo en el ícono de la app (como Mensajes de iOS) ──────
// setAppBadge pinta el número en el ícono del escritorio. El número queda
// puesto al cerrar la app; se actualiza al abrirla o al volver a primer plano.
// Requiere iOS 16.4+, app instalada en pantalla de inicio y notificaciones permitidas.
function GlobitoPermiso() {
  const [estado, setEstado] = React.useState(() => {
    try {
      if (!("Notification" in window) || !("setAppBadge" in navigator)) return "no";
      if (localStorage.getItem("globito_off") === "1") return "no";
      return Notification.permission;   // "default" | "granted" | "denied"
    } catch { return "no"; }
  });
  if (estado !== "default") return null;
  return (<div style={{ display: "flex", alignItems: "center", gap: 9, background: "#0F1B2D", borderRadius: 12, padding: "10px 12px", margin: "0 0 10px", border: "1px solid #B08D3E" }}>
    <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "#fff", lineHeight: 1.45 }}>Activá los avisos para ver el <b>número rojo en el ícono</b> cuando haya alertas, sin abrir la app.</div>
    <button onClick={async () => { try { const p = await Notification.requestPermission(); setEstado(p); if (p === "granted") { try { await navigator.setAppBadge(1); setTimeout(() => navigator.clearAppBadge().catch(() => { }), 1500); } catch { } } } catch { setEstado("denied"); } }}
      style={{ background: "#B08D3E", border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>Activar</button>
    <button onClick={() => { try { localStorage.setItem("globito_off", "1"); } catch { } setEstado("no"); }}
      style={{ background: "none", border: "none", color: "rgba(255,255,255,.55)", fontSize: 15, cursor: "pointer", padding: "0 2px", flexShrink: 0 }}>×</button>
  </div>);
}
async function ponerGlobito(n) {
  try {
    if (!("setAppBadge" in navigator)) return;
    if (n > 0) await navigator.setAppBadge(Math.min(99, Math.round(n)));
    else await navigator.clearAppBadge();
  } catch { }
}
function GestionScreen({ T, cfg, pedidos, obras, gestion, matpedidos = [] }) {
  const g = { plazo: 5, dotacion: 7, costoPersona: 60000, manual: [], punit: {}, reuniones: [], ...(gestion || {}) };
  const [tab, setTab] = useState("registro");
  const cli = cfg?.nombre || "Belfast";
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  // Misma lectura de decisiones que V+V: acá Belfast VE lo mismo que V+V
  // decidió, con el cálculo abierto. Transparencia total, sin sorpresas.
  const conDecision = (base) => {
    const d = g.punit[base.id];
    const plazoEf = (base.plazoBase || g.plazo) + (d?.decision === "prorroga" ? (d.prorrogaDias || 0) : 0);
    const m = gMetricas(base.fechaSolic, base.fechaReal, plazoEf, base.cerrado);
    return { ...base, plazo: plazoEf, ...m, dec: d || null };
  };
  const itemsPedidos = (pedidos || []).map(p => { const solic = p.ts ? new Date(p.ts) : null; const resp = (p.hilo || []).find(h => h.de === p.para); const real = resp ? new Date(resp.ts) : null; return conDecision({ id: p.id, tipo: "Pedido de información", obra_id: p.obra_id, descripcion: p.asunto, imputable: p.para === "cliente" ? cli : "V+V", fechaSolic: solic, fechaReal: real, plazoBase: g.plazo, cerrado: p.estado === "resuelto" }); });
  const itemsManual = (g.manual || []).map(it => { const solic = it.fechaSolic ? new Date(it.fechaSolic) : null; const real = it.fechaReal ? new Date(it.fechaReal) : null; return conDecision({ ...it, fechaSolic: solic, fechaReal: real, plazoBase: it.plazo || g.plazo, cerrado: !!real }); });
  const parseDmy = (f) => { const m = String(f || "").match(/^(\d{2})\/(\d{2})\/(\d{2})$/); return m ? new Date(`20${m[3]}-${m[2]}-${m[1]}T12:00:00`) : null; };
  const itemsMat = (matpedidos || []).filter(p => p.tipo === "definicion" || p.tipo === "plano").map(p => {
    const solic = p.ts ? new Date(p.ts) : null;
    const real = p.cumplido ? (parseDmy(p.cumplidoFecha) || new Date()) : null;
    const desc = (p.items || []).map(it => it.nombre).filter(Boolean).join(", ") || (p.tipo === "plano" ? "Plano" : "Definición");
    return conDecision({ id: p.id, tipo: p.tipo === "plano" ? "Plano" : "Definición", obra_id: p.obra_id, descripcion: desc, imputable: cli, fechaSolic: solic, fechaReal: real, plazoBase: g.plazo, cerrado: !!p.cumplido });
  });
  const items = [...itemsPedidos, ...itemsMat, ...itemsManual].sort((a, b) => (b.fechaSolic || 0) - (a.fechaSolic || 0));
  const perItem = it => (it.dec?.decision === "confirmado") ? it.retraso * (Number(it.dec.personas) || g.dotacion) * (Number(it.dec.costoDia) || g.costoPersona) : 0;
  const esVencido = it => it.estado === "Vencido" || it.estado === "Fuera de plazo";
  const confirmados = items.filter(it => it.dec?.decision === "confirmado");
  const enEval = items.filter(it => esVencido(it) && !it.dec);
  const total = items.length, cumpl = items.filter(i => i.estado === "Cumplido" || i.estado === "En plazo").length;
  const pctCumpl = total ? Math.round(cumpl / total * 100) : 0;
  const diasProm = total ? (items.reduce((a, i) => a + i.dias, 0) / total).toFixed(1) : "—";
  const grp = n => confirmados.filter(i => i.imputable === n).reduce((a, i) => a + perItem(i), 0);
  const perjB = grp(cli), perjVV = grp("V+V"), perjE = grp("Estudio"), perjT = perjB + perjVV + perjE;
  const cnt = e => items.filter(i => i.estado === e).length;
  const DEC_BADGE = { confirmado: { t: "Punitorio", c: "#B91C1C", b: "rgba(239,68,68,.10)" }, sin_perjuicio: { t: "Sin perjuicio", c: "#64748B", b: "rgba(255,255,255,.06)" }, prorroga: { t: "Prórroga", c: "#2563EB", b: "rgba(37,99,235,.14)" } };
  const TABS = [["registro", "Registro"], ["punitorios", "Punitorios"], ["panel", "Panel"], ["plan", "Plan"], ["reunion", "Reunión"]];

  const ItemCard = ({ it }) => {
    const e = GEST_ESTADOS[it.estado] || GEST_ESTADOS["En plazo"]; const pj = perItem(it); const db2 = it.dec ? DEC_BADGE[it.dec.decision] : null;
    return (<Card T={T} style={{ padding: 13, marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{it.descripcion}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{it.tipo} · {nomObra(it.obra_id)} · imputable a <b style={{ color: T.sub }}>{it.imputable}</b></div>
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>Solic. {fmtD(it.fechaSolic)} · {it.fechaReal ? `resp. ${fmtD(it.fechaReal)}` : "sin respuesta"} · plazo {it.plazo} d · <b style={{ color: it.desvio > 0 ? "#EF4444" : "#16A34A" }}>desvío {it.desvio > 0 ? "+" : ""}{it.desvio}</b></div>
          {it.dec?.decision === "confirmado" && <div style={{ fontSize: 11, marginTop: 6, color: T.sub, lineHeight: 1.5 }}><b style={{ color: "#B91C1C" }}>Perjuicio: {money(pj)}</b> — {it.retraso} d × {Number(it.dec.personas) || g.dotacion} pers. × {money(Number(it.dec.costoDia) || g.costoPersona)}{it.dec.tarea ? <><br />Tarea detenida: {it.dec.tarea}</> : null}</div>}
          {it.dec?.decision === "prorroga" && <div style={{ fontSize: 11, marginTop: 6, color: "#2563EB" }}>Prórroga acordada: +{it.dec.prorrogaDias} días háb.{it.dec.nota ? ` — ${it.dec.nota}` : ""}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", flexShrink: 0 }}>
          <Badge c={e.c} b={e.b}>{it.estado}</Badge>
          {db2 && <Badge c={db2.c} b={db2.b}>{db2.t}</Badge>}
          {!it.dec && esVencido(it) && <Badge c="#B45309" b="rgba(180,83,9,.14)">En evaluación</Badge>}
        </div>
      </div>
    </Card>);
  };

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "14px 20px 0" }}>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ flexShrink: 0, padding: "8px 13px", borderRadius: 8, border: `1px solid ${tab === k ? T.accent : T.border}`, background: tab === k ? "rgba(255,255,255,.08)" : T.card, color: tab === k ? T.accent : T.sub, fontSize: 12.5, fontWeight: 700 }}>{l}</button>)}</div>
    </div>
    {tab === "registro" && <div style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Desempeño medido sobre los pedidos (plazo {g.plazo} días háb.).</div>
      {items.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "30px" }}>Sin ítems.</div>}
      {items.map(it => <ItemCard key={it.id} it={it} />)}
    </div>}
    {tab === "punitorios" && <div style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.55, marginBottom: 14 }}>Solo se imputan los retrasos que detuvieron una tarea en condiciones de avanzar, evaluados caso por caso con la dotación y el costo reales. Los retrasos marcados "en evaluación" no tienen monto asignado.</div>
      <Eyebrow T={T}>Punitorios confirmados ({confirmados.length}) — {money(perjT)}</Eyebrow>
      {confirmados.length === 0 && <div style={{ fontSize: 12, color: T.muted, padding: "8px 0 16px" }}>Sin punitorios confirmados.</div>}
      {confirmados.map(it => <ItemCard key={it.id} it={it} />)}
      {enEval.length > 0 && <>
        <div style={{ height: 8 }} />
        <Eyebrow T={T}>En evaluación ({enEval.length})</Eyebrow>
        {enEval.map(it => <ItemCard key={it.id} it={it} />)}
      </>}
      <div style={{ height: 14 }} />
      <Card T={T} style={{ padding: 14 }}>
        <Eyebrow T={T}>Criterio de cálculo</Eyebrow>
        <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.7 }}>Perjuicio = días de retraso × dotación afectada × costo diario por persona.<br />Referencia: {money(g.costoPersona)} por persona/día. Cada punitorio usa la dotación real de esa parada.</div>
      </Card>
    </div>}
    {tab === "panel" && <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
        {[["Ítems", total, T.accent], ["% Cumplimiento", pctCumpl + "%", "#16A34A"], ["Días háb. prom.", diasProm, "#3B82F6"], ["Perjuicio confirmado", money(perjT), "#EF4444"]].map(([l, v, c]) => <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px" }}><div style={{ fontSize: 17, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{l}</div></div>)}
      </div>
      <Eyebrow T={T}>Por estado</Eyebrow>
      <Card T={T} style={{ padding: 13, marginBottom: 14 }}>{["Cumplido", "En plazo", "Fuera de plazo", "Vencido"].map(s => { const e = GEST_ESTADOS[s]; return (<div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: e.c }} /><span style={{ fontSize: 12.5, color: T.text }}>{s}</span></div><span style={{ fontSize: 13, fontWeight: 800 }}>{cnt(s)}</span></div>); })}</Card>
      <Eyebrow T={T}>Perjuicio confirmado por responsable</Eyebrow>
      <Card T={T} style={{ padding: 13 }}>{[[cli, perjB], ["Estudio", perjE], ["V+V", perjVV]].map(([n, v]) => <div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0" }}><span style={{ fontSize: 12.5, color: T.text }}>{n}</span><span style={{ fontSize: 13, fontWeight: 800, color: v > 0 ? "#EF4444" : T.muted }}>{money(v)}</span></div>)}<div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${T.border}` }}><span style={{ fontSize: 13, fontWeight: 800 }}>TOTAL</span><span style={{ fontSize: 14, fontWeight: 800, color: "#EF4444" }}>{money(perjT)}</span></div></Card>
    </div>}
    {tab === "plan" && <div style={{ padding: "16px 20px" }}>
      {[["1. Objetivo", ["Medir tiempos de definición y certificación, detectar desvíos y valorizar el perjuicio económico de los retrasos para tomar decisiones y reclamar lo que corresponda."]],
      ["2. Estándares (SLA)", [`Pedidos de información (${cli}/Estudio): respuesta en máx. ${g.plazo} días hábiles desde la solicitud.`, `Certificados de obra (Héctor Ayala): entrega en máx. ${g.plazo} días hábiles desde la visita.`, "Toda solicitud y certificado se carga el mismo día en el Registro."]],
      ["3. Circuito de imputación", ["El sistema detecta el vencimiento en forma automática (candidato).", "V+V evalúa cada candidato: se confirma como punitorio SOLO si el retraso detuvo una tarea en condiciones de avanzar, identificando la tarea y la dotación real afectada.", "Los retrasos que no frenaron trabajo quedan registrados como incumplimiento de plazo, sin perjuicio económico.", "Las prórrogas acordadas entre las partes extienden el plazo del ítem y quedan documentadas."]],
      ["4. Política de punitorios", ["Por cada día de retraso imputable a " + cli + " o al Estudio que detenga una tarea en condiciones de avanzar: perjuicio = días de retraso × dotación afectada × costo diario por persona.", "Cada punitorio confirmado se documenta con su cronología, la tarea detenida y el cálculo abierto, y se presenta en la reunión mensual."]],
      ["5. Responsables", ["V+V: carga del registro, certificaciones en plazo (Héctor Ayala), evaluación de candidatos y emisión de reclamos.", cli + " / Estudio: respuesta a pedidos y provisión de definiciones en plazo."]]
      ].map(([titulo, puntos], i) => (<Card T={T} key={i} style={{ padding: 15, marginBottom: 11 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.accent, marginBottom: 8 }}>{titulo}</div>
        {puntos.map((p, j) => <div key={j} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6, marginBottom: 5, paddingLeft: 12, position: "relative" }}><span style={{ position: "absolute", left: 0, color: "#B08D3E" }}>·</span>{p}</div>)}
      </Card>))}
    </div>}
    {tab === "reunion" && <div style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 12 }}>Reuniones empresa a empresa V+V — {cli}. Lo acordado queda a la vista de las dos partes.</div>
      {(g.reuniones || []).length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "30px" }}>Sin reuniones registradas.</div>}
      {(g.reuniones || []).map(r => (<Card T={T} key={r.id} style={{ padding: 14, marginBottom: 9 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{r.periodo || "Reunión"}{r.fecha ? ` · ${r.fecha}` : ""}</div>
        {r.participantes && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>Participantes: {r.participantes}</div>}
        {r.flojo && <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}><b>Flojo:</b> {r.flojo}</div>}
        {r.mejorar && <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}><b>A mejorar:</b> {r.mejorar}</div>}
        {r.acciones && <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}><b>Acciones acordadas:</b> {r.acciones}</div>}
      </Card>))}
    </div>}
  </div>);
}

// ── SHELL WEB INSTITUCIONAL (Cliente) ────────────────────────────────
function WebClientHeader({ T, cfg, screen, setScreen, aviso }) {
  const badge = (id) => (typeof aviso === "function" ? aviso(id) : 0);   // sirve para TODOS los íconos
  // Globito del ícono de Belfast: la suma de los avisos de todas las secciones.
  useEffect(() => {
    try { const tot = ["mensajes", "materiales", "informes", "bitacora", "avance", "chat", "pedidos", "archivos"].reduce((s2, k) => s2 + (badge(k) || 0), 0); ponerGlobito(tot); } catch { }
  });
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 200, flexShrink: 0 }}>
      <div style={{ background: T.navy, color: "#fff", paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto", padding: "10px 16px", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRASS, whiteSpace: "nowrap" }}>Panel de Cliente</span>
        </div>
      </div>
      <div style={{ height: 2, background: BRASS }} />
    </header>
  );
}
// ── Menú inferior: los 5 accesos principales (los que se usan todo el
// tiempo), fijo abajo, como una app de celular. El resto de las
// secciones (IA, Informes, Cronogramas, Mensajes, Certificados,
// Archivos, Personal, Gestión, Grabar reunión, Ajustes) vive en "Más".
const BOTTOM_NAV = [
  { id: "inicio", label: "Inicio" },
  { id: "obras", label: "Obras" },
  { id: "avance", label: "Avance" },
  { id: "bitacora", label: "Bitácora" },
  { id: "materiales", label: "Pedidos" },
  { id: "auditoria", label: "Auditoría" },
];
const MAS_ITEMS = [
  { id: "asistente", label: "IA" },
  { id: "informes", label: "Informes" },
  { id: "cronograma", label: "Cronogramas" },
  { id: "mensajes", label: "Mensajes" },
  { id: "formularios", label: "Certificados" },
  { id: "archivos", label: "Archivos" },
  { id: "personal", label: "Personal" },
  { id: "gestion", label: "Gestión" },
  { id: "minutas", label: "Grabar reunión" },
  { id: "ajustes", label: "Ajustes" },
];
function BottomNav({ T, screen, setScreen, aviso }) {
  const badge = (id) => (typeof aviso === "function" ? aviso(id) : 0);
  const items = BOTTOM_NAV;
  return (<nav style={{ flexShrink: 0, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "center", paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)" }}>
    <div style={{ width: "100%", maxWidth: 1180, display: "flex" }}>
      {items.map(n => {
        const active = screen === n.id;
        const hayNuevo = badge(n.id) > 0;
        return (<button key={n.id} onClick={() => setScreen(n.id)} style={{ position: "relative", flex: 1, background: "none", border: "none", padding: "6px 4px 5px", fontSize: 10.5, fontWeight: (active || hayNuevo) ? 800 : 600, color: hayNuevo ? "#EF4444" : (active ? T.accent : T.sub), borderTop: `2px solid ${active ? BRASS : "transparent"}`, marginTop: -1, cursor: "pointer" }}>
          {n.label}
          {hayNuevo && <span style={{ position: "absolute", top: 4, right: "18%", background: "#EF4444", color: "#fff", borderRadius: 9, minWidth: 14, height: 14, fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{badge(n.id)}</span>}
        </button>);
      })}
    </div>
  </nav>);
}
function MasScreen({ T, screen, setScreen, aviso }) {
  const badge = (id) => (typeof aviso === "function" ? aviso(id) : 0);
  return (<div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
    <Eyebrow T={T}>Más</Eyebrow>
    {MAS_ITEMS.map(it => { const n = badge(it.id); return (
      <div key={it.id} onClick={() => setScreen(it.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 15px", marginBottom: 8, cursor: "pointer" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{it.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {n > 0 && <span style={{ background: "#EF4444", color: "#fff", borderRadius: 9, minWidth: 17, height: 17, fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{n}</span>}
          <span style={{ color: T.muted, fontSize: 14 }}>›</span>
        </div>
      </div>); })}
  </div>);
}
function WebClientHero({ T, cfg, obras }) {
  const activas = obras.filter(o => o.estado === "curso").length;
  const avg = obras.length ? Math.round(obras.reduce((a, o) => a + (o.avance || 0), 0) / obras.length) : 0;
  return (
    <div style={{ background: LUXE_HERO, color: "#fff", borderBottom: `2px solid ${BRASS}`, flexShrink: 0 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: BRASS, letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: 9 }}>{cfg.nombre}</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.1, maxWidth: 560 }}>Panel de seguimiento de obra</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.68)", marginTop: 10, maxWidth: 520, lineHeight: 1.6 }}>Avance, certificaciones, documentación y comunicación directa con V+V Construcciones.</div>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {[["Obras activas", activas], ["Avance prom.", avg + "%"], ["Obras", obras.length]].map(([l, v], i) => (
            <div key={i} style={{ textAlign: "center" }}><div style={{ fontSize: 26, fontWeight: 800 }}>{v}</div><div style={{ fontSize: 9.5, color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>{l}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
function WebClientFooter({ T, cfg }) {
  return (<div style={{ background: T.navy, color: "rgba(255,255,255,.55)", flexShrink: 0, borderTop: `2px solid ${BRASS}` }}>
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "6px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, fontSize: 10.5 }}>
      <span style={{ fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,.8)" }}>{(cfg.nombre || "CLIENTE").toUpperCase()}</span>
      <span>Ejecuta: V+V Construcciones · © {new Date().getFullYear()} · build 30-07-fixavance</span>
    </div>
  </div>);
}

const LOGO_FALLBACK_HERO = "data:image/jpeg;base64,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";
function InicioScreen({ T, cfg, obras, renders, mensajes, bitacora, avance, certif = {}, informesSem = {}, auditoria = [], onIr }) {
  const [slideIdx, setSlideIdx] = useState(0);
  // Rotan TODAS las obras en curso, tengan foto cargada o no — si a una
  // le falta, se muestra igual (con un fondo liso) hasta que se le cargue.
  const obrasEnCurso = (obras || []).filter(o => o.estado === "curso" || !o.estado);
  const listaCarrusel = obrasEnCurso.length ? obrasEnCurso : (obras || []);
  useEffect(() => {
    if (listaCarrusel.length < 2) return;
    const t = setInterval(() => setSlideIdx(i => (i + 1) % listaCarrusel.length), 4500);
    return () => clearInterval(t);
  }, [listaCarrusel.length]);
  const obraActual = listaCarrusel[slideIdx % Math.max(listaCarrusel.length, 1)];
  const renderActual = obraActual ? ((renders || {})[obraActual.id] || [])[0] : null;

  // "Novedades recientes": conteos de ESTA SEMANA (lunes a hoy) — si fuera
  // acumulado de siempre, con el tiempo iba a terminar diciendo "37.000
  // informes" y pierde sentido. Cada semana arranca de nuevo.
  const inicioSemanaC = (() => { const d = new Date(); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const estaSemanaC = (ts) => ts && ts >= inicioSemanaC;
  const informesTotC = obras.flatMap(o => (((informesSem || {})[o.id]) || [])).filter(r => estaSemanaC(r.ts)).length;
  const avanceInfTotC = obras.flatMap(o => (((avance || {})[o.id]) || [])).filter(a => a.html && estaSemanaC(a.ts)).length;
  const bitacoraTotC = (bitacora || []).filter(h => estaSemanaC(h.ts)).length;
  const certifTotC = obras.flatMap(o => (((certif || {})[o.id]) || [])).filter(c => estaSemanaC(c.ts)).length;
  const auditoriaTotC = (auditoria || []).filter(a => estaSemanaC(a.ts)).length;
  const mensajesTotC = (mensajes || []).filter(m => m.from && m.from !== "cliente" && estaSemanaC(m.ts)).length;
  const novedadesC = [
    informesTotC > 0 && { n: informesTotC, txt: `Informe${informesTotC > 1 ? "s" : ""} esta semana`, ir: "informes" },
    avanceInfTotC > 0 && { n: avanceInfTotC, txt: `Informe${avanceInfTotC > 1 ? "s" : ""} de avance esta semana`, ir: "informes" },
    bitacoraTotC > 0 && { n: bitacoraTotC, txt: `Bitácora${bitacoraTotC > 1 ? "s" : ""} esta semana`, ir: "bitacora" },
    certifTotC > 0 && { n: certifTotC, txt: `Certificado${certifTotC > 1 ? "s" : ""} semanal${certifTotC > 1 ? "es" : ""}`, ir: "informes" },
    auditoriaTotC > 0 && { n: auditoriaTotC, txt: `Auditoría${auditoriaTotC > 1 ? "s" : ""} esta semana`, ir: "auditoria", param: "semana" },
    mensajesTotC > 0 && { n: mensajesTotC, txt: `Mensaje${mensajesTotC > 1 ? "s" : ""} de V+V`, ir: "mensajes" },
  ].filter(Boolean);

  return (<div style={{ flex: 1, overflowY: "auto", background: "#0d0d0f", color: "#f2f0eb" }}>
    <div style={{ position: "relative", height: "38vh", minHeight: 260, maxHeight: 420, background: "#0d0d0f", overflow: "hidden" }}>
      {renderActual
        ? <img key={renderActual.url} src={renderActual.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: .85, animation: "fadeIn .6s ease" }} />
        : <div key={obraActual?.id || "sin-obra"} style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#0d0d0f,#1a1a1d)", animation: "fadeIn .6s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={LOGO_FALLBACK_HERO} alt="" style={{ width: "56%", maxWidth: 220, opacity: .5, filter: "grayscale(.2)" }} />
          </div>}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(13,13,15,.15) 0%, rgba(13,13,15,.4) 45%, #0d0d0f 100%)" }} />
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 16px)", left: 22, right: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ width: cfg?.logoSize || 60, height: cfg?.logoSize || 60, borderRadius: 14, overflow: "hidden", flexShrink: 0, background: "transparent" }}>
          <img src={cfg?.logo || LOGO_FALLBACK_HERO} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div onClick={() => onIr("mas")} style={{ color: "rgba(255,255,255,.8)", fontSize: 16, cursor: "pointer", padding: "4px 8px", letterSpacing: 2 }}>•••</div>
      </div>
      <div style={{ position: "absolute", bottom: 20, left: 22, right: 22 }}>
        <div style={{ fontSize: 9.5, letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>{cfg?.nombre || "Belfast"}</div>
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 24, color: "#fff", marginTop: 4 }}>{obraActual ? obraActual.nombre : "Panel de obras"}</div>
      </div>
      {listaCarrusel.length > 1 && <div style={{ position: "absolute", bottom: 8, right: 16, display: "flex", gap: 4 }}>
        {listaCarrusel.map((o, i) => <span key={o.id} style={{ width: 5, height: 5, borderRadius: "50%", background: i === (slideIdx % listaCarrusel.length) ? BRASS : "rgba(255,255,255,.35)" }} />)}
      </div>}
    </div>
    <div style={{ padding: "22px 22px 30px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 40, lineHeight: 1, color: "#fff" }}>{obraActual ? (obraActual.avance || 0) : 0}</div>
        <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(242,240,235,.45)", lineHeight: 1.3 }}>% de avance<br />general</div>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,.1)", marginBottom: 18 }} />
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(242,240,235,.4)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Novedades recientes</div>
      {novedadesC.length === 0 && <div style={{ fontSize: 12, color: "rgba(242,240,235,.4)", padding: "8px 0" }}>Sin novedades todavía.</div>}
      {novedadesC.map((n, i) => (<div key={i} onClick={() => onIr(n.ir, n.param)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,.07)", cursor: "pointer" }}>
        <span style={{ fontSize: 12.5 }}>{n.full ? n.txt : <><b style={{ color: "#D9B27C" }}>{n.n}</b> {n.txt}</>}</span><span style={{ color: "rgba(242,240,235,.35)", fontSize: 13 }}>›</span>
      </div>))}
      <div onClick={() => onIr("asistente")} style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg, rgba(20,18,15,.94), rgba(8,8,8,.97))", border: "1px solid rgba(176,137,79,.4)", borderRadius: 8, padding: "13px 15px", marginTop: 22, cursor: "pointer" }}>
        <div style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "#D9B27C", fontWeight: 700 }}>✦ IA Belfast</div>
        <div style={{ fontSize: 12, color: "rgba(242,240,235,.6)", marginTop: 5 }}>Pedile a la IA — buscar, subir fotos, cargar archivos a una obra…</div>
      </div>
    </div>
  </div>);
}

function ClienteApp() {
  useEffect(() => { if (FORCE_CLOUD) { try { history.replaceState(null, "", window.location.pathname); } catch { } } }, []);
  const [cfg, setCfg] = useStored("cliente_cfg", DEFAULT_CFG);
  const T = theme(cfg);
  const [screen, setScreen] = useState("inicio");
  const [obrasRaw, setObras] = useStored("vv_obras", []);
  // Obras marcadas como "privada" en V+V no existen para Belfast: se filtran acá,
  // en el único lugar donde Cliente.jsx lee la lista completa.
  const obras = (obrasRaw || []).filter(o => !o.privada);
  const [avance, setAvance] = useStored("vv_avance", {});
  const [definiciones, setDefiniciones] = useStored("vv_definiciones", []);
  const [docrecepcion, setDocrecepcion] = useStored("vv_docrecepcion", []);
  const [bitacora, setBitacora] = useStored("vv_bitacora", []);
  useEffect(() => { if (localStorage.getItem("purge_canning_bf_v1")) return; (async () => { try { const r = await storage.get("vv_obras"); if (r?.value) { const arr = JSON.parse(r.value); const filtered = arr.filter(o => !(o.nombre || "").toLowerCase().includes("canning 815")); if (filtered.length !== arr.length) { lastWrite["vv_obras"] = Date.now(); try { localStorage.setItem("vv_obras", JSON.stringify(filtered)); } catch { } await storage.set("vv_obras", JSON.stringify(filtered)).catch(() => { }); setObras(filtered); } } try { localStorage.setItem("purge_canning_bf_v1", "1"); } catch { } } catch { } })(); }, []);
  const [tareas, setTareas] = useStored("vv_tareas", []);
  const [mensajes, setMensajes] = useStored("vv_mensajes", []);
  const [archivosCliente, setArchivosCliente] = useStored("cliente_archivos", []);
  const [archivosVV, setArchivosVV] = useStored("vv_archivos", []);
  const [vvCfg] = useStored("vv_cfg", {});
  const [chatMsgs, setChatMsgs] = useStored("cliente_chat", []);
  const [pedidos, setPedidos] = useStored("vv_pedidos", []);
  const [personal, setPersonal] = useStored("vv_personal", []);
  const [gestion] = useStored("vv_gestion", {});
  const [crono] = useStored("vv_cronograma", { obras: [] });
  const [formularios] = useStored("vv_formularios", []);
  const [matpedidos, setMatpedidos] = useStored("vv_matpedidos", []);
  const [dronevuelos] = useStored("vv_drone", []);
  // Las reuniones de Belfast son PRIVADAS: van en su propia clave, separada
  // de "vv_minutas" (las de V+V). Ninguna de las dos empresas ve las del otro.
  const [minutas, setMinutas] = useStored("cliente_minutas", []);
  const [renders, setRenders] = useStored("vv_renders", {});
  const [certifSem] = useStored("vv_certif_sem", {});
  const [informesSem] = useStored("vv_informes_sem", {});
  // Lo que Belfast le manda al propietario, con la marca de Belfast.
  const [enviosProp, setEnviosProp] = useStored("cliente_envios_prop", {});
  const [contactos, setContactos] = useStored("cliente_contactos", []);
  const [documentacion] = useStored("vv_documentacion", []);
  const [auditoria] = useStored("vv_auditoria", []);
  const unreadMat = (matpedidos || []).filter(p => p.de === "vv" && !p.leido).length; // pedidos de V+V sin levantar
  const pendPed = (pedidos || []).filter(p => p.para === "cliente" && p.estado !== "resuelto").length;
  const lastPed = useRef(null);
  const lastForms = useRef(null);
  const [toast, setToast] = useState(null);
  const [unread, setUnread] = useState(0);
  const [unreadForms, setUnreadForms] = useState(0);
  // Persistente: recuerda lo visto aunque se cierre la app → badge aunque haya llegado con la app cerrada.
  const [seen, setSeen] = useState(() => { try { return JSON.parse(localStorage.getItem("cliente_seen") || "{}"); } catch { return {}; } });
  function markSeen(cat) { setSeen(prev => { const n = { ...prev, [cat]: Date.now() }; try { localStorage.setItem("cliente_seen", JSON.stringify(n)); } catch { } return n; }); }
  const unreadMsg = (mensajes || []).filter(m => m.from && m.from !== "cliente" && (m.ts || 0) > (seen.mensajes || 0)).length;
  const unreadInf = (obras || []).flatMap(o => o.informes || []).filter(i => (i.ts || 0) > (seen.informes || 0)).length;
  const unreadForm = (formularios || []).filter(f => f.compartido && (f.ts || 0) > (seen.formularios || 0)).length;
  const [iaDialogo, setIaDialogo] = useState([]);
  useEffect(() => { let alive = true; const pull = async () => { try { const r = await storage.get("ia_dialogo"); if (r?.value) { const arr = JSON.parse(r.value); if (alive) setIaDialogo(arr); } } catch { } }; pull(); const iv = setInterval(pull, 4000); const onVis = () => { if (document.visibilityState === "visible") pull(); }; document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", pull); return () => { alive = false; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", pull); }; }, []);
  const unreadIA = (iaDialogo || []).filter(m => m.from && m.from !== "cliente" && m.tipo === "q" && (m.ts || 0) > (seen.ia || 0)).length;

  // ── QUÉ CUENTA COMO "NUEVO" EN CADA ÍCONO ──
  const idsAviso = {
    asistente:   (iaDialogo || []).filter(m => m.from && m.from !== "cliente").map(m => "ia:" + (m.id || m.ts)),
    mensajes:    (mensajes || []).filter(m => m.from && m.from !== "cliente").map(m => "ms:" + m.id),
    // un pedido cuenta como nuevo si es para mí, o si le agregaron un mensaje al hilo, o le cambiaron el estado
    pedidos:     (pedidos || []).filter(p => p.para === "cliente").map(p => `pd:${p.id}:${(p.hilo || []).length}:${p.estado || ""}`),
    materiales:  (matpedidos || []).filter(p => p.de !== "cliente").map(p => `mp:${p.id}:${p.estado || ""}`),
    informes:    (obras || []).flatMap(o => (o.informes || []).map(i => "inf:" + (i.id || i.url || i.nombre))),
    formularios: (formularios || []).filter(f => f.compartido).map(f => "fm:" + f.id),
    archivos:    (archivosVV || []).map(a => "ar:" + (a.id || a.url || a.nombre)),
    obras:       (obras || []).map(o => "ob:" + o.id),              // ← OBRA NUEVA
    // la bitácora siempre la carga V+V (el cliente no escribe acá), así que
    // cada hecho nuevo cuenta como aviso — mismo criterio que "obras".
    bitacora:    (bitacora || []).map(h => "bt:" + h.id),
    personal:    (personal || []).map(p => "pe:" + p.id),
    gestion:     [],
    ajustes:     [],
  };
  const { aviso, marcarVisto } = useAvisos("cliente_avisos", idsAviso);
  // al abrir una pantalla, se apaga su punto rojo
  const [auditoriaDesdeSemana, setAuditoriaDesdeSemana] = React.useState(false);
  const irA = (id, param) => { setAuditoriaDesdeSemana(id === "auditoria" && param === "semana"); setScreen(id); marcarVisto(id); };
  // Si los datos de la pantalla activa siguen llegando de la nube (sync), se re-marca como
  // visto cada vez que cambian MIENTRAS el usuario sigue parado ahí — así el globito no
  // "revive" solo por datos que terminaron de sincronizar un segundo después del toque.
  useEffect(() => { if (screen) marcarVisto(screen); }, [screen, JSON.stringify(idsAviso[screen] || [])]);
  useEffect(() => { try { if (!localStorage.getItem("cliente_seen")) { const now = Date.now(); const init = { mensajes: now, informes: now, formularios: now, materiales: now, ia: now }; localStorage.setItem("cliente_seen", JSON.stringify(init)); setSeen(init); } else { const s = JSON.parse(localStorage.getItem("cliente_seen") || "{}"); if (s.ia == null) { s.ia = Date.now(); localStorage.setItem("cliente_seen", JSON.stringify(s)); setSeen(s); } } } catch { } }, []);
  useEffect(() => { initPush("belfast"); }, []);
  useEffect(() => { (async () => { try { const r = await storage.get("ia_debate"); if (r?.value) { const d = JSON.parse(r.value); if (d && d.active) { d.active = false; try { localStorage.setItem("ia_debate", JSON.stringify(d)); } catch { } await storage.set("ia_debate", JSON.stringify(d)).catch(() => { }); } } } catch { } })(); }, []);
  useEffect(() => {
    const total = unreadMsg + unreadForm + unreadInf + (unreadMat || 0) + pendPed + unreadIA;
    try { if ("setAppBadge" in navigator) { if (total > 0) navigator.setAppBadge(total); else navigator.clearAppBadge && navigator.clearAppBadge(); } } catch { }
  }, [unreadMsg, unreadForm, unreadInf, unreadMat, pendPed]);
  const lastCount = useRef(null);
  // espejo de los mensajes actuales, para detectar cuáles son nuevos por id
  const mensajesRef = useRef([]);
  useEffect(() => { mensajesRef.current = mensajes; }, [mensajes]);

  // Polling de mensajes y datos cada 8s → avisos en pantalla
  useEffect(() => {
    let alive = true;
    async function tick() {
      const [rm, ro, rp, rf, rmp, rmTs, roTs, rpTs, rmpTs] = await Promise.all([
        storage.get("vv_mensajes"), storage.get("vv_obras"), storage.get("vv_pedidos"), storage.get("vv_formularios"), storage.get("vv_matpedidos"),
        storage.get("vv_mensajes__ts"), storage.get("vv_obras__ts"), storage.get("vv_pedidos__ts"), storage.get("vv_matpedidos__ts"),
      ]);
      if (!alive) return;
      // Materiales: adopto la nube solo si es más nueva que mi última escritura, y
      // NO piso los cambios que hice recién (fusiono por id, gana el 'upd' más nuevo).
      if (rmp?.value && Number(rmpTs?.value || 0) > (lastWrite["vv_matpedidos"] || 0)) {
        try {
          const arrN = JSON.parse(rmp.value);
          if (Array.isArray(arrN)) {
            lastWrite["vv_matpedidos"] = Number(rmpTs.value);
            const tumbas = leerTumbasMat();
            setMatpedidos(prev => {
              const porId = {};
              for (const p of (prev || [])) if (p && p.id) porId[p.id] = p;
              for (const p of arrN) {
                if (!p || !p.id) continue;
                const mio = porId[p.id];
                // si lo mío es más nuevo (ej: recién toqué "Levantar"), me quedo con lo mío
                if (!mio || (p.upd || 0) > (mio.upd || 0)) porId[p.id] = p;
              }
              const out = Object.values(porId).filter(p => !(tumbas[p.id] && tumbas[p.id] >= (p.upd || 0)));
              return JSON.stringify(out) !== JSON.stringify(prev) ? out : prev;
            });
          }
        } catch { }
      }
      if (rm?.value) {
        try {
          // Antes solo adoptaba la lista si CRECÍA: un mensaje borrado en V+V nunca
          // desaparecía de acá. Ahora adopta siempre que la nube sea más nueva, y
          // detecta los nuevos por id (no por cantidad, que falla si borran y agregan).
          const arr = JSON.parse(rm.value);
          const cloudTs = Number(rmTs?.value || 0);
          if (cloudTs > (lastWrite["vv_mensajes"] || 0)) {
            const idsAntes = new Set((mensajesRef.current || []).map(m => m.id));
            const nuevosDeVV = arr.filter(m => !idsAntes.has(m.id) && m.from === "vv");
            lastWrite["vv_mensajes"] = cloudTs;
            lastCount.current = arr.length;
            setMensajes(arr);
            if (nuevosDeVV.length > 0 && idsAntes.size > 0) {
              setToast(`Nuevo mensaje de V+V Construcciones`);
              setTimeout(() => setToast(null), 4500);
              if (screenRef.current !== "mensajes") setUnread(u => u + nuevosDeVV.length);
              try { beep(); } catch { }
            }
          }
        } catch { }
      }
      if (ro?.value && Number(roTs?.value || 0) > (lastWrite["vv_obras"] || 0)) { try { lastWrite["vv_obras"] = Number(roTs.value); setObras(JSON.parse(ro.value)); } catch { } }
      if (rp?.value) {
        try {
          const arr = JSON.parse(rp.value); if (Number(rpTs?.value || 0) > (lastWrite["vv_pedidos"] || 0)) { lastWrite["vv_pedidos"] = Number(rpTs.value); setPedidos(arr); }
          // huella de pedidos recibidos cuyo último mensaje es de V+V
          const huella = arr.filter(p => p.para === "cliente" && p.estado !== "resuelto" && (p.hilo || [])[(p.hilo || []).length - 1]?.de === "vv").map(p => p.id + ":" + (p.hilo || []).length).join("|");
          if (lastPed.current === null) { lastPed.current = huella; }
          else if (huella !== lastPed.current) {
            lastPed.current = huella;
            setToast("V+V envió o actualizó un pedido");
            setTimeout(() => setToast(null), 4500);
            try { beep(); } catch { }
            // Auto-respuesta IA (opcional) — responde a pedidos de V+V con tope de turnos
            if (cfgRef.current?.autoIA && vvCfgRef.current?.apiKey) {
              for (const p of arr) {
                if (p.para === "cliente" && p.estado !== "resuelto" && (p.iaTurns || 0) < PEDIDO_MAX_IA && (p.hilo || [])[(p.hilo || []).length - 1]?.de === "vv") {
                  const hist = (p.hilo || []).map(h => `${h.de === "cliente" ? cfgRef.current.nombre : "V+V"}: ${h.texto}`).join("\n");
                  const r = await callAI([{ role: "user", content: `Pedido: ${p.asunto}\n\nHilo:\n${hist}\n\nRedactá nuestra respuesta (breve y concreta).` }], `Sos el agente de ${cfgRef.current.nombre} respondiendo a V+V Construcciones. Español rioplatense. Solo el texto de la respuesta.`, vvCfgRef.current.apiKey);
                  const f = hoyStr(), ts = Date.now();
                  await aplicarPedidos(setPedidos, list => list.map(x => x.id === p.id ? { ...x, estado: "respondido", iaTurns: (x.iaTurns || 0) + 1, hilo: [...x.hilo, { de: "cliente", texto: r, fecha: f, ts, porIA: true }] } : x));
                }
              }
            }
          }
        } catch { }
      }
      if (rf?.value) {
        try {
          const arr = JSON.parse(rf.value);
          const n = arr.filter(x => x.compartido).length;
          if (lastForms.current === null) { lastForms.current = n; }
          else if (n > lastForms.current) {
            const delta = n - lastForms.current; lastForms.current = n;
            setToast("V+V compartió un formulario");
            setTimeout(() => setToast(null), 4500);
            try { beep(); } catch { }
            if (screenRef.current !== "formularios") setUnreadForms(u => u + delta);
          } else { lastForms.current = n; }
        } catch { }
      }
    }
    const iv = setInterval(tick, 8000); tick();
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; if (screen === "mensajes") { setUnread(0); markSeen("mensajes"); } if (screen === "formularios") { setUnreadForms(0); markSeen("formularios"); } if (screen === "informes") markSeen("informes"); if (screen === "asistente") markSeen("ia"); }, [screen]);
  const cfgRef = useRef(cfg); useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  const vvCfgRef = useRef(vvCfg); useEffect(() => { vvCfgRef.current = vvCfg; }, [vvCfg]);

  async function postMensaje(msg) {
    const r = await storage.get("vv_mensajes"); let actual = mensajes;
    if (r?.value) { try { actual = JSON.parse(r.value); } catch { } }
    const next = [...actual, msg]; lastCount.current = next.length; setMensajes(next); return next;
  }
  async function vaciarMensajes() {
    if (!confirm("¿Borrar TODOS los mensajes?\n\nSe vacía el chat para las dos empresas y no se puede deshacer.")) return;
    if (!confirm("Confirmá de nuevo: se borra TODO el historial de mensajes.")) return;
    lastCount.current = 0; setMensajes([]);
  }
  async function borrarMensaje(id) {
    if (!id || !confirm("¿Eliminar este mensaje? Se borra para las dos empresas.")) return;
    const r = await storage.get("vv_mensajes"); let actual = mensajes;
    if (r?.value) { try { actual = JSON.parse(r.value); } catch { } }
    const next = actual.filter(m => m.id !== id); lastCount.current = next.length; setMensajes(next);
  }
  // Guarda los archivos dentro de la obra elegida (visible para V+V dentro de la obra)
  async function agregarAObra(obraId, files) {
    if (!obraId || !files?.length) return;
    const r = await storage.get("vv_obras"); let arr = obras;
    if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    const nuevos = files.map(f => ({ id: uid(), nombre: f.nombre, url: f.url, fecha: hoyStr(), from: "cliente" }));
    setObras(arr.map(o => o.id === obraId ? { ...o, archivos: [...(o.archivos || []), ...nuevos] } : o));
  }
  async function quitarDeObra(obraId, archId) {
    const r = await storage.get("vv_obras"); let arr = obras;
    if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    setObras(arr.map(o => o.id === obraId ? { ...o, archivos: (o.archivos || []).filter(a => a.id !== archId) } : o));
  }
  // Acuse de recibo automático del agente
  async function acuseRecibo(obraId, files) {
    const nom = obras.find(o => o.id === obraId)?.nombre || "la obra";
    const lista = files.map(f => f.nombre).join(", ");
    await postMensaje({ id: uid() + Date.now(), from: "vv", texto: `✓ Recibido. La documentación (${lista}) quedó cargada en ${nom}. La información llegó correctamente.`, fecha: hoyStr(), ts: Date.now(), porIA: true, archivos: [] });
  }
  // Registro de una subida desde la pantalla Archivos
  async function registrarSubida(files, obraId) {
    if (!obraId || !files?.length) return;
    const nom = obras.find(o => o.id === obraId)?.nombre || "una obra";
    await agregarAObra(obraId, files);
    await postMensaje({ id: uid() + Date.now(), from: "cliente", texto: `Subí documentación a ${nom}: ${files.map(f => f.nombre).join(", ")}`, fecha: hoyStr(), ts: Date.now(), archivos: files });
    await acuseRecibo(obraId, files);
  }
  async function enviar(texto, archivos, obraId) {
    await postMensaje({ id: uid() + Date.now(), from: "cliente", texto, fecha: hoyStr(), ts: Date.now(), archivos: archivos || [] });
    if (obraId && archivos?.length) { await agregarAObra(obraId, archivos); await acuseRecibo(obraId, archivos); }
  }

  return (<div style={{ width: "100%", maxWidth: "100vw", height: "100dvh", background: LUXE_BG, overflowX: "hidden" }}>
    <style>{css}</style>
    <Toast T={T} toast={toast} />
    <div style={{ width: "100%", height: "100dvh", background: "transparent", display: "flex", flexDirection: "column", position: "relative", color: T.text, overflow: "hidden" }}>
      {screen !== "inicio" && <WebClientHeader T={T} cfg={cfg} screen={screen} setScreen={irA} aviso={aviso} />}

      <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center", background: "transparent" }}>
        <div style={{ width: "100%", maxWidth: 1180, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg, borderLeft: `1px solid rgba(176,137,79,0.28)`, borderRight: `1px solid rgba(176,137,79,0.28)`, boxShadow: "0 0 80px rgba(0,0,0,0.45)" }}>
          {screen === "inicio" && <InicioScreen T={T} cfg={cfg} obras={obras} renders={renders} mensajes={mensajes} bitacora={bitacora} avance={avance} certif={certifSem} informesSem={informesSem} auditoria={auditoria} onIr={(id, param) => irA(id, param)} />}
          {screen === "asistente" && <AsistenteScreen T={T} cfg={cfg} apiKey={vvCfg.apiKey} obras={obras} tareas={tareas} msgs={chatMsgs} setMsgs={setChatMsgs} pedidos={pedidos} setPedidos={setPedidos} personal={personal} setPersonal={setPersonal} mensajes={mensajes} contactos={contactos} formularios={formularios} matpedidos={matpedidos} documentacion={documentacion} certif={certifSem} bitacora={bitacora} onPedidos={() => setScreen("pedidos")} onMinutas={() => setScreen("minutas")} />}
          {screen === "obras" && <div style={{ flex: 1, overflowY: "auto" }}><Obras obras={obras} setObras={setObras} cfg={cfg} apiKey={vvCfg.apiKey} /></div>}
          {screen === "drone" && <DroneIAClienteView T={T} obras={obras} dronevuelos={dronevuelos} />}
          {screen === "minutas" && <GrabarReunionCliente T={T} cfg={cfg} apiKey={vvCfg.apiKey} obras={obras} minutas={minutas} setMinutas={setMinutas} onBack={() => setScreen("asistente")} />}
          {screen === "avance" && <AvanceView T={T} obras={obras} avance={avance} setAvance={setAvance} apiKey={vvCfg.apiKey} cfg={cfg} certif={certifSem} envios={enviosProp} setEnvios={setEnviosProp} />}
          {screen === "bitacora" && <BitacoraView T={T} obras={obras} bitacora={bitacora} setBitacora={setBitacora} cfg={cfg} />}
          {screen === "auditoria" && <AuditoriaClienteView T={T} obras={obras} auditoria={auditoria} cfg={cfg} desdeSemana={auditoriaDesdeSemana} />}
          {screen === "personal" && <PersonalScreen T={T} cfg={cfg} personal={personal} setPersonal={setPersonal} obras={obras} contactos={contactos} setContactos={setContactos} />}
          {screen === "pedidos" && <PedidosScreen T={T} cfg={cfg} apiKey={vvCfg.apiKey} obras={obras} pedidos={pedidos} setPedidos={setPedidos} />}
          {screen === "materiales" && <MaterialesScreen T={T} cfg={cfg} obras={obras} personal={personal} contactos={contactos} matpedidos={matpedidos} setMatpedidos={setMatpedidos} definiciones={definiciones} setDefiniciones={setDefiniciones} docrecepcion={docrecepcion} setDocrecepcion={setDocrecepcion} />}
          {screen === "informes" && <InformesScreen T={T} obras={obras} formularios={formularios} certif={certifSem} informesSem={informesSem} avance={avance} cfg={cfg} envios={enviosProp} setEnvios={setEnviosProp} />}
          {screen === "formularios" && <FormulariosScreen T={T} obras={obras} formularios={formularios} />}
          {screen === "cronograma" && <CronogramaScreen T={T} cfg={cfg} crono={crono} gestion={gestion} />}
          {screen === "gestion" && <GestionScreen T={T} cfg={cfg} pedidos={pedidos} obras={obras} gestion={gestion} matpedidos={matpedidos} />}
          {screen === "archivos" && <ArchivosScreen T={T} obras={obras} archivosCliente={archivosCliente} setArchivosCliente={setArchivosCliente} archivosVV={archivosVV} registrarSubida={registrarSubida} quitarDeObra={quitarDeObra} />}
          {screen === "mensajes" && <MensajesScreen T={T} cfg={cfg} obras={obras} mensajes={mensajes} enviar={enviar} borrarMensaje={borrarMensaje} vaciarMensajes={vaciarMensajes} />}
          {screen === "ajustes" && <AjustesScreen T={T} cfg={cfg} setCfg={setCfg} obras={obras} setObras={setObras} renders={renders} setRenders={setRenders} />}
          {screen === "mas" && <MasScreen T={T} screen={screen} setScreen={irA} aviso={aviso} />}
        </div>
      </div>
      <BottomNav T={T} screen={screen} setScreen={irA} aviso={aviso} />
    </div>
    <SyncBanner />
    <div style={{ padding: "10px 16px 0" }}><GlobitoPermiso /></div>
  </div>);
}

function beep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination); o.frequency.value = 660; o.type = "sine";
  g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
  o.start(); o.stop(ctx.currentTime + 0.3);
}

export default ClienteApp;
