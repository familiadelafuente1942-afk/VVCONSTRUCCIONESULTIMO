import React, { useState, useEffect, useRef, useCallback } from "react";

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

function SyncBanner() {
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
  upload: async (path, dataUrl) => {
    try {
      const res = await fetch(dataUrl); const blob = await res.blob();
      const ext = (blob.type.split('/')[1] || 'bin');
      const filePath = `${path}.${ext}`;
      const r = await fetch(`${SUPA_STORAGE_URL}/object/${SUPA_BUCKET}/${filePath}`, { method: "POST", headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY, "Content-Type": blob.type, "x-upsert": "true" }, body: blob });
      if (!r.ok) return null;
      return `${SUPA_STORAGE_URL}/object/public/${SUPA_BUCKET}/${filePath}`;
    } catch { return null; }
  },
};
async function uploadArchivo(dataUrl, carpeta, nombre) {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('http')) return dataUrl;
  const url = await mediaStorage.upload(`${carpeta}/${nombre || uid()}`, dataUrl);
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
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", city: "Buenos Aires", region: "Buenos Aires", country: "AR", timezone: "America/Argentina/Buenos_Aires" } }];
  async function doFetch(b) {
    try {
      const rp = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      if (rp.ok) return { ok: true, data: await rp.json() };
      if (rp.status !== 404) { try { const e = await rp.json(); return { ok: false, err: e.error?.message || `Error ${rp.status}` }; } catch { return { ok: false, err: `Error ${rp.status}` }; } }
    } catch { /* sin proxy: modo directo */ }
    if (!apiKey) return { ok: false, err: "⚠ El asistente todavía no está disponible. Configurá la IA (API Key en la app de V+V, o el proxy en Vercel)." };
    const headers = { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true", "anthropic-version": "2023-06-01", "x-api-key": apiKey };
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
const PEDIDO_ESTADOS = { abierto: { l: "Abierto", c: "#F59E0B", b: "#FFFBEB" }, en_proceso: { l: "En proceso", c: "#3B82F6", b: "#EFF6FF" }, respondido: { l: "Respondido", c: "#8B5CF6", b: "#F5F3FF" }, resuelto: { l: "Resuelto", c: "#16A34A", b: "#ECFDF5" } };
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

const ESTADOS = { pendiente: { l: "Pendiente", c: "#94A3B8", b: "#F8FAFC" }, curso: { l: "En curso", c: "#10B981", b: "#ECFDF5" }, pausada: { l: "Pausada", c: "#F59E0B", b: "#FFFBEB" }, terminada: { l: "Terminada", c: "#6366F1", b: "#EEF2FF" } };
const BRASS = "#B0894F";
const DEFAULT_CFG = { nombre: "Belfast Construction Management", sigla: "BELFAST", logo: "", accent: "#1E3A5F" };
const LUXE_BG = "radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px) 0 0/22px 22px, radial-gradient(1100px 520px at 50% -8%, rgba(176,137,79,0.13), transparent 62%), linear-gradient(180deg,#0b141f 0%,#0a1019 100%)";
const LUXE_HERO = "radial-gradient(620px 220px at 86% 0%, rgba(176,137,79,0.20), transparent 60%), linear-gradient(135deg,#101C2C 0%,#17283c 100%)";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#F5F6F8;overscroll-behavior:none;font-family:'Inter',sans-serif;}
  button{cursor:pointer;font-family:inherit;}input,textarea,select{font-family:inherit;}
  input:focus,textarea:focus{outline:none;}textarea{resize:none;}::-webkit-scrollbar{display:none;}
  @keyframes slidein{from{transform:translateY(-120%);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
`;
function theme(accent) {
  return { bg: "#F5F6F8", card: "#fff", border: "#E6E9EE", text: "#131C2B", sub: "#4A5565", muted: "#97A0AE", accent: accent || "#1E3A5F", navy: "#101C2C", r: 14, rsm: 10, shadow: "0 1px 2px rgba(16,28,44,.05),0 6px 20px rgba(16,28,44,.06)" };
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
      {f.resultado && <div style={{ display: "inline-block", fontSize: 12, fontWeight: 800, color: f.resultado.includes("NO APTO") ? "#EF4444" : f.resultado.includes("OBSERV") ? "#B45309" : "#16A34A", background: f.resultado.includes("NO APTO") ? "#FEF2F2" : f.resultado.includes("OBSERV") ? "#FFFBEB" : "#ECFDF5", borderRadius: 6, padding: "5px 11px", marginBottom: 12 }}>{f.resultado}</div>}
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
function AvanceView({ T, obras, avance, setAvance, apiKey, cfg }) {
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
        ? <button onClick={() => fileRef.current?.click()} disabled={busy || !obraId} style={{ width: "100%", background: busy ? T.border : T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "14px", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", marginBottom: 8 }}>{busy ? "Preparando…" : "📷 Elegir foto(s)"}</button>
        : <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: T.shadow }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.navy, marginBottom: 8 }}>{pendientes.length === 1 ? "1 foto seleccionada" : `${pendientes.length} fotos seleccionadas`} — poné la fecha y analizá</div>
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
      {historial.length > 0 && <button onClick={pdfTodos} style={{ width: "100%", background: T.card, border: `1px solid ${BRASS}`, color: T.navy, borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>📄 PDF de toda la obra ({historial.length} fecha{historial.length > 1 ? "s" : ""})</button>}
      {historial.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "20px", lineHeight: 1.6 }}>Todavía no hay fotos de avance para esta obra.<br />Subí la primera (será la línea de base).</div>}
      {historial.map((h, idx) => (<div key={h.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        {(() => { const fs = (h.fotos && h.fotos.length) ? h.fotos : (h.fotoUrl ? [h.fotoUrl] : []); if (!fs.length) return null; if (fs.length === 1) return <img src={fs[0]} alt="" style={{ width: "100%", maxHeight: 340, objectFit: "contain", background: "#0b0f14", display: "block" }} />; return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, alignItems: "start", padding: 4, background: "#0b0f14" }}>{fs.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ display: "block" }}><img src={u} alt="" style={{ width: "100%", height: "auto", display: "block", borderRadius: 4 }} /></a>)}</div>; })()}
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{h.fecha}{idx === 0 ? "  ·  última" : ""}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {idx === historial.length - 1 && <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, background: T.al, borderRadius: 6, padding: "2px 7px" }}>línea de base</span>}
              <button onClick={() => pdfUno(h)} title="Exportar esta fecha a PDF" style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>📄 PDF</button>
            </div>
          </div>
          {h.avance && <div style={{ background: T.al, borderRadius: 8, padding: "9px 11px", marginBottom: 8 }}><div style={{ fontSize: 10, fontWeight: 800, color: T.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>📈 Avance</div><div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{h.avance}</div></div>}
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
          <button onClick={guardarPdf} style={{ background: BRASS, border: "none", color: "#fff", borderRadius: 8, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>📥 Guardar PDF</button>
        </div>
      </div>
      <iframe id="avance-pdf" srcDoc={pdfHtml} title="Avance PDF" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
    </div>}
  </div>);
}

// ─── Bitácora de obra (espejo de V+V) ───
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
  const iconoArch = (nom = "", tipo = "") => { const e = (nom.split(".").pop() || "").toLowerCase(); if (["doc", "docx"].includes(e)) return "📝"; if (e === "pdf") return "📕"; if (["xls", "xlsx", "csv"].includes(e)) return "📊"; if (["png", "jpg", "jpeg", "webp", "heic"].includes(e)) return "🖼"; return "📎"; };
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
      .adj { font-size: 10.5px; color: #1B3A5B; background: #F1F5F9; border: 1px solid #E3E8EF; border-radius: 6px; padding: 6px 9px; margin-top: 8px; }
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

  return (<div>
    <div style={{ padding: "14px 18px 4px", flexShrink: 0 }}><div style={{ fontSize: 10, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.12em" }}>Registro diario</div><div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Bitácora de obra</div><div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Lo que va pasando en obra, día por día</div></div>
    <div style={{ padding: "16px 20px" }}>
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
          <div style={{ fontSize: 13, fontWeight: 800, color: T.navy, marginBottom: 10 }}>{edit ? "Editar hecho" : "Nuevo hecho"}</div>
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
            <button onClick={() => fileRef.current?.click()} disabled={subiendo} style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{subiendo ? "Subiendo…" : "📷 Agregar fotos"}</button>
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
            <button onClick={() => adjRef.current?.click()} disabled={subiendo} style={{ background: T.bg, border: `1px solid ${BRASS}`, color: T.navy, borderRadius: 8, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{subiendo ? "Subiendo…" : "📎 Adjuntar archivo (Word, PDF, Excel…)"}</button>
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

const OBRA_ESTADOS = [{ id: "pendiente", label: "Pendiente", color: "#94A3B8", bg: "#F8FAFC" }, { id: "curso", label: "En Curso", color: "#10B981", bg: "#ECFDF5" }, { id: "pausada", label: "Pausada", color: "#F59E0B", bg: "#FFFBEB" }, { id: "terminada", label: "Terminada", color: "#6366F1", bg: "#EEF2FF" }];

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

const T = { bg: "var(--bg,#F1F5F9)", card: "var(--card,#fff)", border: "var(--border,#E2E8F0)", text: "var(--text,#0F172A)", sub: "var(--sub,#475569)", muted: "var(--muted,#94A3B8)", accent: "var(--accent,#1D4ED8)", accentLight: "var(--al,#EFF6FF)", navy: "var(--navy,#0F172A)", r: "var(--r,14px)", rsm: "var(--rsm,10px)", shadow: "0 1px 2px rgba(16,28,44,.05),0 6px 20px rgba(16,28,44,.06)" };

function Card_OG({ children, style = {}, onClick }) { return <div onClick={onClick} style={{ background: T.card, borderRadius: T.r, border: `1px solid ${T.border}`, boxShadow: T.shadow, ...style }}>{children}</div>; }
function Badge_OG({ color, bg, children, style = {} }) { return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 20, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.04em", ...style }}>{children}</span>; }
function PBtn_OG({ children, onClick, disabled, full, style = {}, variant = "primary" }) {
    const v = { primary: { background: disabled ? "#E2E8F0" : "var(--accent,#1D4ED8)", color: disabled ? "#94A3B8" : "#fff", boxShadow: disabled ? "none" : "0 2px 8px rgba(0,0,0,.18)", border: "none" }, ghost: { background: "none", border: `1.5px solid ${T.border}`, color: T.sub, boxShadow: "none" }, danger: { background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#EF4444", boxShadow: "none" } };
    return <button onClick={onClick} disabled={disabled} style={{ ...v[variant], borderRadius: T.rsm, padding: "11px 20px", fontSize: 14, fontWeight: 600, width: full ? "100%" : "auto", transition: "all .15s", ...style }}>{children}</button>;
}
function Sheet({ title, onClose, children }) { return (<div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 200, display: "flex", alignItems: "flex-end", backdropFilter: "blur(2px)" }}><div style={{ background: T.card, borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "90vh", overflow: "auto", animation: "up .25s ease", paddingBottom: 32 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}><span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{title}</span><button onClick={onClose} style={{ background: T.bg, border: "none", borderRadius: 20, width: 32, height: 32, fontSize: 18, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button></div><div style={{ padding: "14px 20px 0" }}>{children}</div></div></div>); }
function Lbl({ children }) { return <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{children}</div>; }
function TInput({ value, onChange, placeholder, type = "text", extraStyle = {} }) { return <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text, ...extraStyle }} />; }
function Sel({ value, onChange, children }) { return <select value={value} onChange={onChange} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }}>{children}</select>; }
function FieldRow({ children }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>{children}</div>; }
function Field({ label, children }) { return <div style={{ marginBottom: 12 }}><Lbl>{label}</Lbl>{children}</div>; }
function PlusBtn({ onClick }) { return <button onClick={onClick} style={{ background: "var(--accent,#1D4ED8)", color: "#fff", border: "none", borderRadius: 20, width: 34, height: 34, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>+</button>; }
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
            <button onClick={() => videoRef.current?.click()} style={{ background: T.accentLight, border: `1.5px solid ${T.accent}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, color: T.accent, cursor: "pointer", flexShrink: 0 }}>🎥 Video</button>
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
                {fotos.map(f => {
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
                    <button onClick={() => { try { navigator.clipboard.writeText(informe); } catch { } }} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "4px 10px", fontSize: 11, color: T.sub, cursor: "pointer" }}>📋 Copiar</button>
                    <button onClick={() => setInforme('')} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, padding: "4px 8px", fontSize: 11, color: "#EF4444", cursor: "pointer" }}>✕</button>
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
        { id: 'diario', label: 'Diario', color: '#3B82F6', bg: '#EFF6FF' },
        { id: 'semanal', label: 'Semanal', color: '#7C3AED', bg: '#F5F3FF' },
        { id: 'ingeniero', label: 'Ingeniero', color: '#10B981', bg: '#ECFDF5' },
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
                    <button onClick={() => upd(detail.id, { informes: informes.filter(x => x.id !== inf.id) })} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, width: 30, height: 30, cursor: "pointer", color: "#EF4444", fontSize: 12 }}>✕</button>
                </div>
            </div>))}
        {showNew && (<Sheet title={`Subir informe ${tp?.label}`} onClose={() => setShowNew(false)}>
            <Field label="Título (opcional)"><TInput value={form.titulo || ""} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Título del informe" /></Field>
            <FieldRow>
                <Field label="Tipo"><Sel value={form.tipo || ""} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>{TIPOS_INF.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</Sel></Field>
                <Field label="Fecha"><TInput value={form.fecha || ""} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} placeholder="dd/mm/aa" /></Field>
            </FieldRow>
            <Field label="Notas"><textarea value={form.notas || ""} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones..." rows={3} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text }} /></Field>
            <PBtn_OG full onClick={() => fileRef.current?.click()}>📎 Seleccionar archivo</PBtn_OG>
        </Sheet>)}
    </div>);
}

// ── OBRAS ────────────────────────────────────────────────────────────
// ── TAB GASTOS (dentro de cada Obra) ─────────────────────────────────
const TIPOS_GASTO = [
    { id: 'viatico', label: 'Viático', color: '#F59E0B', bg: '#FFFBEB' },
    { id: 'compra', label: 'Compra material', color: '#3B82F6', bg: '#EFF6FF' },
    { id: 'herramienta', label: 'Herramienta', color: '#8B5CF6', bg: '#F5F3FF' },
    { id: 'subcontrato', label: 'Subcontrato', color: '#10B981', bg: '#ECFDF5' },
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
                            {g.quien && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>👤 {g.quien}</div>}
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
                        <button onClick={() => eliminar(g.id)} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#EF4444", cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>✕</button>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ECFDF5", border: "1px solid #86EFAC", borderRadius: T.rsm, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", flex: 1 }}>✓ {form.comprobante.nombre}</div>
                        <button onClick={() => setForm(p => ({ ...p, comprobante: null }))} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                ) : (
                    <button onClick={() => compRef.current?.click()} style={{ width: "100%", background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 12, fontWeight: 600, color: T.sub, cursor: "pointer" }}>
                        📎 Adjuntar comprobante
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
                    <input type="range" min="0" max="100" value={detail.avance} onChange={e => upd(detail.id, { avance: parseInt(e.target.value) })} style={{ width: "100%", accentColor: "var(--accent,#1D4ED8)", marginTop: 10 }} />
                </div>
                <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", overflowX: "auto" }}>
                    {[[`info`, t(cfg, 'obras_info')], [`obs`, t(cfg, 'obras_notas')], [`fotos`, t(cfg, 'obras_fotos')], [`planos`, 'Planos'], [`archivos`, t(cfg, 'obras_archivos')], [`informes`, 'Informes'], [`gastos`, 'Gastos']].map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)} style={{ flex: 1, minWidth: 52, padding: "10px 4px", background: "none", border: "none", fontSize: 11, fontWeight: tab === id ? 700 : 500, color: tab === id ? T.accent : T.muted, borderBottom: `2px solid ${tab === id ? "var(--accent,#1D4ED8)" : "transparent"}`, whiteSpace: "nowrap" }}>{label}</button>
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
                            <div style={{ background: detail.pagado > 0 ? "#ECFDF5" : T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>💰 Pagado</div>
                                <input value={detail.pagado || ''} onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); upd(detail.id, { pagado: v ? parseFloat(v) : 0 }); }} placeholder="$ 0" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: "#10B981", padding: 0 }} />
                            </div>
                        </div>
                        <Lbl>{t(cfg, 'obras_estado')}</Lbl>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                            {OBRA_ESTADOS.map(e => (<button key={e.id} onClick={() => upd(detail.id, { estado: e.id })} style={{ padding: "9px", borderRadius: T.rsm, border: `1.5px solid ${detail.estado === e.id ? e.color : T.border}`, background: detail.estado === e.id ? e.bg : T.card, color: e.color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{e.label}</button>))}
                        </div>
                        <button onClick={() => { setObras(p => p.filter(o => o.id !== detail.id)); setDetailId(null); }} style={{ width: "100%", background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 600, color: "#EF4444", cursor: "pointer" }}>{t(cfg, 'obras_eliminar')}</button>
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
                            <div style={{ width: 34, height: 34, borderRadius: 8, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>📐</div>
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
const INST_COLORS = { accent:"#1E3A5F", al:"#EAEEF3", bg:"#F5F6F8", card:"#FFFFFF", border:"#E6E9EE", text:"#131C2B", sub:"#4A5565", muted:"#97A0AE", navy:"#101C2C" };

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

function ObrasScreen({ T, obras, setObras, tareas, cfg, formularios = [] }) {
  const [verForm, setVerForm] = useState(null);
  const [open, setOpen] = useState(null);
  const [subP, setSubP] = useState(false);
  async function subirPlanos(e, obra) {
    const files = Array.from(e.target.files); if (!files.length) return; setSubP(true);
    const nuevos = [];
    for (const f of files) {
      const data = await fileToDataUrl(f);
      const url = await uploadArchivo(data, `planos/${obra.id}`, `${Date.now()}_${f.name.replace(/\W+/g, "_")}`);
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      nuevos.push({ id: uid(), nombre: f.name, url, fecha: hoyStr(), from: "cliente", tipo: ext });
    }
    if (setObras) setObras(prev => prev.map(o => o.id === obra.id ? { ...o, planos: [...(o.planos || []), ...nuevos] } : o));
    setSubP(false); e.target.value = "";
    if (nuevos.some(n => !String(n.url || "").startsWith("http"))) alert("⚠ El plano quedó en este dispositivo pero NO se subió a la nube (bucket 'bco-media' en Supabase). Configuralo para que V+V y la IA lo puedan ver.");
  }
  function borrarObra(o) {
    if (!setObras) return;
    const nom = String(o.nombre || "").trim();
    const esc = prompt(`BORRAR LA OBRA "${nom}"\n\nSe borra en las dos apps (Cliente y V+V) y no se puede deshacer.\nSe pierden sus tareas, planos e informes.\n\nEscribí el nombre de la obra para confirmar:`);
    if (esc == null) return;
    if (esc.trim().toLowerCase() !== nom.toLowerCase()) { alert("El nombre no coincide. No borré nada."); return; }
    setObras(prev => prev.filter(x => x.id !== o.id));
    alert(`Obra "${nom}" borrada.`);
  }
  function borrarPlano(obra, id) { if (confirm("¿Eliminar este plano?") && setObras) setObras(prev => prev.map(o => o.id === obra.id ? { ...o, planos: (o.planos || []).filter(x => x.id !== id) } : o)); }
  const [ecoUnlocked, setEcoUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const ecoPin = String(cfg?.ecoPin || "2025");
  const contratado = obras.reduce((a, o) => a + parseMontoNum(o.monto), 0);
  const certificado = obras.reduce((a, o) => a + (o.pagado || 0), 0);
  const avg = obras.length ? Math.round(obras.reduce((a, o) => a + (o.avance || 0), 0) / obras.length) : 0;
  const activas = obras.filter(o => o.estado === "curso").length;
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginBottom: 10 }}>
        {[["Activas", activas, "#16A34A"], ["Avance", avg + "%", T.accent], ["Obras", obras.length, T.text]].map(([l, v, c], i) =>
          <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 12px", boxShadow: T.shadow }}><div style={{ fontSize: 19, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>{l}</div></div>)}
      </div>
      <div style={{ background: T.navy, borderRadius: T.rsm, padding: "15px 17px", marginBottom: 20, borderBottom: `2px solid ${BRASS}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Resumen económico</span>{ecoUnlocked && <button onClick={() => setEcoUnlocked(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.55)", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>🔒 Bloquear</button>}</div>
        {ecoUnlocked ? [["Contratado", contratado, "#fff"], ["Certificado", certificado, "#16A34A"], ["Saldo", contratado - certificado, BRASS]].map(([l, v, c], i) =>
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: i ? "1px solid rgba(255,255,255,.08)" : "none" }}><span style={{ fontSize: 12.5, color: "rgba(255,255,255,.75)" }}>{l}</span><span style={{ fontSize: 14, fontWeight: 800, color: c }}>{money(v)}</span></div>)
          : <div><div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginBottom: 11, lineHeight: 1.5 }}>🔒 Protegido. Ingresá la contraseña para ver los montos.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { if (pinInput === ecoPin) { setEcoUnlocked(true); setPinInput(""); } else alert("Contraseña incorrecta."); } }} placeholder="Contraseña" style={{ flex: 1, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: T.rsm, padding: "10px 12px", fontSize: 14, color: "#fff", outline: "none" }} />
              <button onClick={() => { if (pinInput === ecoPin) { setEcoUnlocked(true); setPinInput(""); } else alert("Contraseña incorrecta."); }} style={{ background: BRASS, color: "#fff", border: "none", borderRadius: T.rsm, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Ver</button>
            </div></div>}
      </div>
      <Eyebrow T={T}>Estado de obras</Eyebrow>
      {obras.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "38px 18px" }}>Todavía no hay obras publicadas.</div>}
      {obras.map(o => {
        const e = ESTADOS[o.estado] || ESTADOS.pendiente;
        const contr = parseMontoNum(o.monto), cert = o.pagado || 0, pct = contr ? Math.round(cert / contr * 100) : 0;
        const ts = tareas.filter(t => t.obra_id === o.id);
        const ult = (o.informes || [])[o.informes?.length - 1];
        const forms = formularios.filter(f => f.compartido && f.obra_id === o.id);
        const isOpen = open === o.id;
        return (<Card T={T} key={o.id} style={{ padding: 15, marginBottom: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{o.nombre}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{o.sector} · {o.inicio} → {o.cierre}</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              <Badge c={e.c} b={e.b}>{e.l}</Badge>
              {setObras && <button onClick={ev => { ev.stopPropagation(); borrarObra(o); }} title="Borrar obra"
                style={{ background: "none", border: "none", color: T.muted, fontSize: 15, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>🗑</button>}
            </div>
          </div>
          <div style={{ margin: "12px 0 6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}><span style={{ color: T.sub, fontWeight: 600 }}>Avance de obra</span><span style={{ color: T.accent, fontWeight: 800 }}>{o.avance}%</span></div>
            <div style={{ height: 8, background: T.bg, borderRadius: 5, overflow: "hidden" }}><div style={{ height: 8, width: `${o.avance}%`, background: T.accent, borderRadius: 5 }} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, background: T.bg, borderRadius: T.rsm, padding: "9px 11px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase" }}>Certificado</div><div style={{ fontSize: 12.5, fontWeight: 800, color: "#16A34A", marginTop: 2 }}>{pct}%</div></div>
            <div style={{ flex: 2, background: T.bg, borderRadius: T.rsm, padding: "9px 11px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase" }}>Saldo pendiente</div><div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginTop: 2 }}>{ecoUnlocked ? money(contr - cert) : "🔒 •••••"}</div></div>
          </div>
          <button onClick={() => setOpen(isOpen ? null : o.id)} style={{ width: "100%", marginTop: 12, background: "none", border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 700, color: T.accent }}>{isOpen ? "Ocultar detalle ▲" : `Ver detalle${forms.length ? ` · ${forms.length} formulario${forms.length > 1 ? "s" : ""}` : ""}${(o.planos || []).length ? ` · ${(o.planos || []).length} plano${(o.planos || []).length > 1 ? "s" : ""}` : ""} ▼`}</button>
          {isOpen && <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 7 }}>Planos (PDF / CAD){(o.planos || []).length ? ` (${(o.planos || []).length})` : ""}</div>
              {(o.planos || []).map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 11px", marginBottom: 6 }}>
                <div style={{ width: 30, height: 30, borderRadius: 7, background: "#EAEEF3", color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📐</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{p.nombre}</div><div style={{ fontSize: 10, color: T.muted }}>{p.fecha}{p.from ? ` · ${p.from === "vv" ? "V+V" : "Belfast"}` : ""}</div></div>
                <a href={p.url} target="_blank" rel="noreferrer" download={p.nombre} style={{ color: T.accent, fontWeight: 700, fontSize: 11.5, textDecoration: "none", flexShrink: 0 }}>Abrir</a>
                <button onClick={() => borrarPlano(o, p.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>)}
              <label style={{ display: "block", textAlign: "center", background: T.navy, color: "#fff", borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderBottom: `2px solid ${BRASS}` }}>{subP ? "Subiendo…" : "＋ Subir plano (PDF/CAD)"}<input type="file" accept=".pdf,.dwg,.dxf,.dwf,.rvt,application/pdf,image/*" multiple onChange={e => subirPlanos(e, o)} style={{ display: "none" }} /></label>
            </div>
            {(o.fotos || []).length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 7 }}>Avance fotográfico ({(o.fotos || []).length})</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>{(o.fotos || []).map((f, i) => <a key={i} href={f.url || f} target="_blank" rel="noreferrer"><img src={f.url || f} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, border: `1px solid ${T.border}`, display: "block" }} /></a>)}</div></div>}
            {(o.videos || []).length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 7 }}>Videos ({o.videos.length})</div>{o.videos.map((v, i) => <video key={i} src={v.url || v} controls playsInline style={{ width: "100%", borderRadius: 6, marginBottom: 8, background: "#000", display: "block" }} />)}</div>}
            {ts.length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 7 }}>Cronograma</div>{ts.map(t => <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}><span style={{ flex: 1, fontSize: 12, color: T.text }}>{t.nombre}</span><div style={{ width: 70, height: 6, background: T.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: 6, width: `${t.avance || 0}%`, background: BRASS }} /></div><span style={{ fontSize: 11, fontWeight: 700, color: T.muted, width: 32, textAlign: "right" }}>{t.avance || 0}%</span></div>)}</div>}
            {ult && <div><div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 7 }}>Último informe · {ult.fecha}</div><div style={{ background: T.bg, borderRadius: T.rsm, padding: "11px 13px", fontSize: 12, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{ult.texto}</div></div>}
            {forms.length > 0 && <div style={{ marginTop: 12 }}><div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 7 }}>Formularios recibidos de V+V</div>{forms.map(f => { const tpl = FORM_TPLS.find(t => t.id === f.tplId); return (<div key={f.id} onClick={() => setVerForm({ f, tpl, obra: o.nombre })} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", marginBottom: 7, cursor: "pointer" }}><div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{tpl?.nombre || "Formulario"}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{f.fecha}{f.nro ? ` · N° ${f.nro}` : ""}{f.compartidoFecha ? ` · compartido ${f.compartidoFecha}` : ""}</div></div>{f.resultado ? <span style={{ fontSize: 9.5, fontWeight: 800, color: f.resultado.includes("NO APTO") ? "#EF4444" : f.resultado.includes("OBSERV") ? "#B45309" : "#16A34A", flexShrink: 0 }}>{f.resultado.replace(" PARA INICIO", "")}</span> : <span style={{ color: T.accent, fontWeight: 700, fontSize: 11 }}>Ver →</span>}</div>); })}</div>}
          </div>}
        </Card>);
      })}
    </div>
    {verForm && <FormViewer T={T} tpl={verForm.tpl} f={verForm.f} obraNombre={verForm.obra} onClose={() => setVerForm(null)} />}
  </div>);
}

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
    <div style={{ width: 36, height: 36, borderRadius: 8, background: mine ? "#EAEEF3" : T.bg, color: mine ? T.accent : T.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>📄</div>
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nombre || "archivo"}</div><div style={{ fontSize: 11, color: T.muted }}>{a.fecha || a.obra || ""}</div></div>
    {a.url && <a href={a.url} target="_blank" rel="noreferrer" download={a.nombre} style={{ background: T.bg, color: T.accent, borderRadius: 7, padding: "7px 11px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Abrir</a>}
    {onDelete && <button onClick={() => { if (confirm("¿Eliminar este archivo?")) onDelete(); }} style={{ background: "none", border: "1px solid #FCA5A5", color: "#EF4444", borderRadius: 7, padding: "7px 9px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>✕</button>}
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
      <button onClick={vaciarMensajes} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🗑 Vaciar mensajes ({mensajes.length})</button>
    </div>}
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
      {mensajes.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "40px 18px", lineHeight: 1.6 }}>Escribile a V+V Construcciones. Te avisamos acá cuando respondan.</div>}
      {mensajes.map((m, i) => { const mine = m.from === "cliente"; return (<div key={m.id || i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 11 }}>
        <div style={{ maxWidth: "82%" }}>
          <div style={{ background: mine ? T.accent : T.card, color: mine ? "#fff" : T.text, border: mine ? "none" : `1px solid ${T.border}`, borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 13px", fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", boxShadow: T.shadow }}>
            {m.texto}
            {(m.archivos || []).map((a, j) => <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: mine ? "#fff" : T.accent, textDecoration: "underline" }}>📎 {a.nombre}</a>)}
          </div>
          <div style={{ fontSize: 9.5, color: T.muted, marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "Vos" : "V+V"} · {m.fecha}{mine && m.id && borrarMensaje && <span onClick={() => borrarMensaje(m.id)} style={{ marginLeft: 8, color: "#EF4444", cursor: "pointer", fontWeight: 700 }}>Eliminar</span>}</div>
        </div>
      </div>); })}
      <div ref={bottomRef} />
    </div>
    <div style={{ borderTop: `1px solid ${T.border}`, background: T.card, padding: "10px 14px 14px" }}>
      {adj.length > 0 && <><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{adj.map((a, i) => <span key={i} style={{ background: T.bg, borderRadius: 6, padding: "5px 9px", fontSize: 11, color: T.sub }}>📎 {a.nombre} <span onClick={() => setAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.muted }}>✕</span></span>)}</div>
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
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Escribí un mensaje…" rows={1} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 13.5, color: T.text, maxHeight: 110, minHeight: 42 }} />
        <button onClick={send} style={{ width: 42, height: 42, borderRadius: T.rsm, background: T.accent, color: "#fff", border: "none", fontSize: 17, flexShrink: 0 }}>↑</button>
      </div>
    </div>
  </div>);
}

// ── PANTALLA: AJUSTES ────────────────────────────────────────────────
function AjustesScreen({ T, cfg, setCfg }) {
  const logoRef = useRef(null);
  async function setLogo(f) { const d = await fileToDataUrl(f, 600); const url = await uploadArchivo(d, "logos", "cliente_logo"); setCfg(p => ({ ...p, logo: url })); }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <div style={{ padding: "16px 20px" }}>
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
        {cfg.logo && <button onClick={() => setCfg(p => ({ ...p, logo: "" }))} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: T.rsm, padding: "11px 14px", fontSize: 13, fontWeight: 600 }}>Quitar</button>}
      </div>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Color principal</label>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 8 }}>
        {["#1E3A5F", "#101C2C", "#1F5C49", "#6E3B2E", "#46406E", "#0E5A66", "#7A2E50"].map(col => <button key={col} onClick={() => setCfg(p => ({ ...p, accent: col }))} style={{ width: 32, height: 32, borderRadius: 5, background: col, border: `2px solid ${cfg.accent === col ? T.text : T.border}` }} />)}
        <input type="color" value={cfg.accent} onChange={e => setCfg(p => ({ ...p, accent: e.target.value }))} style={{ width: 32, height: 32, border: "none", background: "none" }} />
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
        <div style={{ fontSize: 12.5, color: T.text, marginBottom: 4 }}>Versión instalada: <b>build 01-07-IA</b></div>
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
    <span style={{ fontSize: 18 }}>📩</span><span style={{ fontSize: 13, fontWeight: 600 }}>{toast}</span>
  </div>);
}

const NAV = [{ id: "asistente", label: "IA", icon: "M12 3a4 4 0 014 4v1a4 4 0 01-8 0V7a4 4 0 014-4zM5 21a7 7 0 0114 0" }, { id: "obras", label: "Obras", icon: "M3 21h18M5 21V7l7-4 7 4v14M10 21v-5h4v5" }, { id: "avance", label: "Avance", icon: "M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" }, { id: "bitacora", label: "Bitácora", icon: "M5 3h11l3 3v15H5zM9 8h7M9 12h7M9 16h4" }, { id: "mensajes", label: "Mensajes", icon: "M4 5h16v11H8l-4 4z" }, { id: "materiales", label: "Materiales", icon: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7" }, { id: "informes", label: "Informes", icon: "M8 3h8l2 4v14H6V7z" }, { id: "formularios", label: "Formularios", icon: "M5 3h14v18H5zM9 7h6M9 11h6M9 15h4" }, { id: "archivos", label: "Archivos", icon: "M3 7h6l2 2h10v10H3z" }, { id: "personal", label: "Personal", icon: "M12 9a3 3 0 100 6 3 3 0 000-6z" }, { id: "gestion", label: "Gestión", icon: "M4 20V10M10 20V4M16 20v-7" }, { id: "ajustes", label: "Ajustes", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM12 4v2M12 18v2M4 12h2M18 12h2" }];

// ── PANTALLA: ASISTENTE IA ───────────────────────────────────────────
function AsistenteScreen({ T, cfg, apiKey, obras, tareas, msgs, setMsgs, pedidos, setPedidos, personal, setPersonal, mensajes, contactos = [], formularios = [], matpedidos = [], documentacion = [], onPedidos }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
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
        setMsgs(prev => [...prev, { role: "assistant", content: "🎙 Debate frenado: no hay crédito de API disponible. Recargá créditos en console.anthropic.com y volvé a intentar.", debate: true }]);
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
    setMsgs(prev => [...prev, { role: "assistant", content: `🎙 Debate técnico iniciado con la IA de V+V: "${tema}". Dejá las dos apps abiertas y mirá cómo se van respondiendo en vivo.`, debate: true }]);
    runDebateTurn();
  }
  async function stopDebate() {
    const r = await storage.get("ia_debate"); const deb = r?.value ? JSON.parse(r.value) : null;
    if (deb) { deb.active = false; await saveDebate(deb); }
    setDebateActive(false); setMsgs(prev => [...prev, { role: "assistant", content: "🎙 Debate frenado.", debate: true }]);
  }
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await storage.get("ia_debate"); const deb = r?.value ? JSON.parse(r.value) : null;
        if (!deb) return;
        if ((deb.turnos || []).length > debateSeen.current) {
          const nuevos = deb.turnos.slice(debateSeen.current); debateSeen.current = deb.turnos.length;
          setMsgs(prev => [...prev, ...nuevos.map(t => ({ role: "assistant", content: `🎙 IA ${t.from === "cliente" ? (cfg.sigla || "Belfast") : cnDeb}: ${t.texto}`, debate: true }))]);
          if (!deb.active && (deb.turnos || []).length >= deb.maxTurnos) setMsgs(prev => [...prev, { role: "assistant", content: "🎙 Debate finalizado.", debate: true }]);
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
    return `Sos el ASISTENTE de ${cfg.nombre} (comitente), en contacto con V+V Construcciones (la empresa que ejecuta la obra). Español rioplatense, claro y cordial. Estás CONECTADO a los mismos datos y al asistente de V+V: comparten la base de datos en tiempo real (obras, personal, pedidos, mensajes); ves lo que carga la otra empresa y ellos ven lo que cargás vos. NUNCA digas que no podés comunicarte con V+V ni con su asistente: SÍ podés, mandándoles un mensaje directo (les aparece en su pantalla de Mensajes) y ellos te responden. REGLA CLAVE: si te piden COMUNICARTE, HABLAR, AVISAR, DECIRLE o PREGUNTARLE algo a V+V, usá SIEMPRE la acción "enviar_mensaje" (se envía directo). "crear_pedido" es solo para pedidos formales de definiciones/documentación. También podés: informar sobre el avance de las obras, GESTIONAR PEDIDOS, cargar PERSONAL a los sitios/barrios (vos tramitás el acceso a los barrios privados), MANDAR WHATSAPP a los jefes de obra/contactos (usás la agenda de Personal → Contactos), y BUSCAR EN INTERNET información actual (normativa, código de edificación, proveedores, precios, datos de empresas). Priorizá fuentes argentinas y citá la fuente.

OBRAS:\n${ob || "(sin obras)"}

PERSONAL:\n${per || "(sin personal)"}

MENSAJES RECIENTES con V+V:\n${msj || "(sin mensajes)"}

PEDIDOS ABIERTOS (con id):\n${ped || "(ninguno)"}

FORMULARIOS:\n${(formularios || []).map(f => `· ${(FORM_TPLS.find(t => t.id === f.tplId) || {}).nombre || "Formulario"} — ${obras.find(o => o.id === f.obra_id)?.nombre || "—"} (${f.fecha}${f.resultado ? ", " + f.resultado : ""}${f.compartido ? ", compartido" : ", borrador"})`).join("\n") || "(sin formularios)"}

ARCHIVOS DE OBRA:\n${obras.flatMap(o => (o.archivos || []).map(a => `· ${a.nombre} (obra ${o.nombre})`)).join("\n") || "(sin archivos)"}

DOCUMENTACIÓN (modelos):\n${(documentacion || []).map(d => `· ${d.nombre} [${d.cat}]`).join("\n") || "(sin documentación)"}

FOTOS E INFORMES POR OBRA:\n${obras.map(o => `· ${o.nombre}: ${(o.fotos || []).length} fotos, ${(o.videos || []).length} videos, ${(o.informes || []).length} informes`).join("\n") || "(sin obras)"}

PLANOS POR OBRA:\n${obras.map(o => (o.planos || []).length ? `· ${o.nombre}: ${(o.planos || []).map(p => p.nombre).join(", ")}` : null).filter(Boolean).join("\n") || "(sin planos cargados)"}

TAREAS / CRONOGRAMA:\n${(tareas || []).map(t => `· ${t.nombre} — ${obras.find(o => o.id === t.obra_id)?.nombre || "—"} (${t.avance || 0}%)`).join("\n") || "(sin tareas)"}

PEDIDOS DE MATERIALES:\n${(matpedidos || []).map(p => `· ${obras.find(o => o.id === p.obra_id)?.nombre || "—"} (${p.fecha}): ${(p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ")}`).join("\n") || "(sin pedidos de materiales)"}

Tenés acceso COMPLETO a todos estos datos (obras, avances, montos, fotos, informes, formularios, archivos, documentación, tareas, materiales, personal, contactos, pedidos). Cuando te pidan un DATO PUNTUAL, buscalo y dá el valor EXACTO; no digas "no lo tengo" si está arriba. Las fotos y videos no los "ves", pero sabés cuántos hay y de qué obra.

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
REGLA fotos: si te piden VER/MANDAR/PASAR fotos o videos de una obra (ej: "mandame la última foto de Castores"), usá "traer_fotos" con la obra y cantidad (1 = la última). videos:true si piden videos. Aparecen directo en el chat.
REGLA planos: si te piden un PLANO (PDF/CAD) de una obra (ej: "necesito el plano de replanteo de platea de Castores 475"), usá "traer_plano" con la obra y "buscar" (palabras clave). El plano aparece en el chat para abrir/descargar.
REGLA WhatsApp: si te piden MANDAR UN WHATSAPP a un jefe de obra o contacto, usá "whatsapp". Uso tu agenda (Personal → Contactos) y el personal de la obra. Te dejo el botón de WhatsApp listo para enviar.
REGLA CLAVE — elegí bien la acción:
- CANAL IA↔IA ("preguntar_ia"): SIEMPRE que involucre a la IA / el asistente de V+V o esperes que te devuelvan un DATO. Ejemplos: "preguntale a la IA de V+V…", "pedile a la IA de V+V…", "pedícelo/pedíselo a la IA…", "consultale al asistente de V+V…", "que la IA de V+V te pase/averigüe…". OJO: "pedile/pedícelo A LA IA" es SIEMPRE este canal (preguntar_ia), NO un crear_pedido. Va directo a la otra IA, que responde sola. ESTE es el canal entre las dos IA.
- CONVENCIÓN DEL USUARIO (IMPORTANTE): por defecto, cuando el usuario diga "pedile", "pedido", "pedícelo", "pedíselo" o "pedir" algo, SE REFIERE a consultarle a la IA de V+V → usá "preguntar_ia". Solo usá "crear_pedido" si el usuario aclara EXPLÍCITAMENTE que quiere un "pedido formal", una "nota de pedido" o documentación oficial.
- MENSAJE A LA PERSONA ("enviar_mensaje"): SOLO para un aviso/recado que lea un HUMANO de V+V en Mensajes, sin esperar datos. Ej: "avisale a V+V que…". Si dudás y mencionan "la IA/el asistente" o quieren respuesta con datos → preguntar_ia.
BANCOS DE DATOS CONECTADOS: primero respondé con TUS datos. Usá "preguntar_ia" si te lo piden o si el dato realmente no está y solo lo tendría V+V. Para info de internet, búsqueda web.
Usá solo ids/nombres reales. Sin acción concreta, no agregues el bloque.`;
  }
  async function send(texto) {
    const c = (texto ?? input).trim(); if (!c || loading) return;
    setInput(""); const next = [...msgs, { role: "user", content: c }]; setMsgs(next); setLoading(true);
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
    setMsgs([...next, { role: "assistant", content: limpio, ...extra }]); setLoading(false);
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
          if (nuevos.length) setMsgs(prev => [...prev, ...nuevos.map(m => ({ role: "assistant", content: `🔗 IA ${m.from === "cliente" ? cfg.nombre : "V+V"} ${m.tipo === "q" ? "consultó" : "respondió"}: ${m.texto}` }))]);
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
            if (nuevos.length) setMsgs(prev => [...prev, ...nuevos.map(p => ({ role: "assistant", content: `📥 Te llegó un pedido de V+V: "${p.asunto}"${p.detalle ? " — " + p.detalle : ""}${p.prioridad === "alta" ? " ⚠ URGENTE" : ""}. Está en Pedidos. Decime si querés que lo responda.` }))]);
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
              setMsgs(prev => [...prev, { role: "assistant", content: `📲 Llegó un pedido de materiales para ${obraN}.${jefe ? ` Te lo dejo listo para reenviar al jefe de obra ${jefe.nombre} por WhatsApp:` : ` Te lo dejo listo para reenviar por WhatsApp (elegí el contacto):`}`, waLink: url, waLabel: jefe ? `Enviar a ${jefe.nombre}` : "Abrir WhatsApp" }]);
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
  const QUICK = ["¿Cómo viene el avance de cada obra?", "Cargá al personal de [obra] al barrio…", "¿Hay pedidos sin resolver?"];
  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    {pend.length > 0 && <div onClick={onPedidos} style={{ display: "flex", alignItems: "center", gap: 11, background: "#FEF2F2", borderBottom: "1px solid #FECACA", padding: "11px 16px", cursor: "pointer", flexShrink: 0 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EF4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{pend.length}</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>{pend.length} pedido{pend.length > 1 ? "s" : ""} pendiente{pend.length > 1 ? "s" : ""} de V+V</div><div style={{ fontSize: 11.5, color: "#B91C1C", marginTop: 1 }}>{pendObras ? `Obras: ${pendObras}` : "Tocá para ver"} →</div></div>
    </div>}
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px" }}>
      {msgs.length === 0 && <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, marginBottom: 14, textAlign: "center" }}>Consultá sobre tus obras o gestioná pedidos con V+V. Puedo crear y responder pedidos por vos.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560, margin: "0 auto" }}>{QUICK.map((q, i) => <button key={i} onClick={() => send(q)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px", fontSize: 13, color: T.text, textAlign: "left", boxShadow: T.shadow }}>{q}</button>)}</div>
      </div>}
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {msgs.map((m, i) => (<div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 11 }}>
          <div style={{ maxWidth: "84%", background: m.role === "user" ? T.accent : T.card, color: m.role === "user" ? "#fff" : T.text, border: m.role === "user" ? "none" : `1px solid ${T.border}`, borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "11px 14px", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", boxShadow: T.shadow }}>{m.content}</div>
          {m.waLink && <a href={m.waLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 7, background: "#25D366", color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>📲 {m.waLabel || "Enviar por WhatsApp"}</a>}
          {m.docs && m.docs.length > 0 && <div style={{ marginTop: 8, maxWidth: "84%" }}>{m.docs.map((d, i) => <a key={i} href={d.url} target="_blank" rel="noreferrer" download={d.nombre} style={{ display: "flex", alignItems: "center", gap: 9, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, textDecoration: "none" }}><span style={{ width: 30, height: 30, borderRadius: 7, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📐</span><span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{d.nombre}</span><span style={{ color: T.accent, fontWeight: 700, fontSize: 11.5, flexShrink: 0 }}>Abrir ↗</span></a>)}</div>}
          {m.media && m.media.length > 0 && <div style={{ marginTop: 8, maxWidth: "84%" }}>{m.mediaTipo === "videos"
            ? m.media.map((u, i) => <video key={i} src={u} controls playsInline style={{ width: "100%", borderRadius: 10, marginBottom: 8, background: "#000", display: "block" }} />)
            : <div style={{ display: "grid", gridTemplateColumns: m.media.length === 1 ? "1fr" : "1fr 1fr", gap: 6 }}>{m.media.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" download><img src={u} alt="" style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.border}`, display: "block" }} /></a>)}</div>}
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>Tocá para abrir en grande o descargar/compartir.</div>
          </div>}
          {m.waLink && <a href={m.waLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 7, background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>📲 {m.waLabel || "Enviar por WhatsApp"}</a>}
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
          : <button onClick={() => setDebateOpen(v => !v)} style={{ background: debateOpen ? T.accent : T.bg, color: debateOpen ? "#fff" : T.sub, border: `1px solid ${debateOpen ? T.accent : T.border}`, borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🎙 Debate IA</button>}
        {msgs.length > 0 && <button onClick={() => setMsgs([])} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer", marginLeft: "auto" }}>Limpiar</button>}
      </div>
      {debateOpen && !debateActive && <div style={{ maxWidth: 760, margin: "0 auto 8px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 12px" }}>
        <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 8, lineHeight: 1.5 }}>Charla técnica entre las dos IA (~3 min, {DEBATE_MAX} turnos). Dales un tema y mirá cómo se responden en vivo en las dos apps.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={debateTema} onChange={e => setDebateTema(e.target.value)} onKeyDown={e => { if (e.key === "Enter") startDebate(); }} placeholder="Tema (ej: Steel Frame)" style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text }} />
          <button onClick={startDebate} disabled={!debateTema.trim()} style={{ background: debateTema.trim() ? T.navy : T.border, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "10px 16px", fontSize: 12.5, fontWeight: 700, cursor: debateTema.trim() ? "pointer" : "default" }}>Iniciar</button>
        </div>
      </div>}
      {debateActive && <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>🎙 Debate en curso… las dos IA están conversando (dejá las dos apps abiertas).</div>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: 760, margin: "0 auto" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Escribí tu consulta…" rows={1} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 13.5, color: T.text, maxHeight: 110, minHeight: 42 }} />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: 42, height: 42, borderRadius: T.rsm, background: input.trim() && !loading ? T.accent : T.border, color: "#fff", border: "none", fontSize: 17, flexShrink: 0 }}>↑</button>
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
  const Pill = (k, l) => <button key={k} onClick={() => setFiltro(k)} style={{ flex: 1, padding: "8px", borderRadius: T.rsm, border: `1px solid ${filtro === k ? T.accent : T.border}`, background: filtro === k ? "#EAEEF3" : T.card, color: filtro === k ? T.accent : T.sub, fontSize: 12, fontWeight: 700 }}>{l}</button>;

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "16px 20px" }}>
      {!cur && <>
        {(() => { const pend = pedidos.filter(p => p.para === miSide && p.estado !== "resuelto"); if (!pend.length) return null; const obrasTxt = [...new Set(pend.map(p => p.obra_id ? nomObra(p.obra_id) : "general").filter(Boolean))].join(", "); return (<div style={{ display: "flex", alignItems: "center", gap: 11, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: T.rsm, padding: "12px 14px", marginBottom: 14 }}>
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
                {p.obra_id && <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, background: "#EAEEF3", borderRadius: 5, padding: "2px 7px" }}>🏗 {nomObra(p.obra_id)}</span>}
                {p.para === miSide && p.estado !== "resuelto" && <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", background: "#FEF2F2", borderRadius: 5, padding: "2px 7px" }}>● Pendiente de respuesta</span>}
              </div>
              <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 230 }}>{ult?.porIA ? "🤖 " : ""}{ult?.texto}</div>
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
          {cur.obra_id && <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: T.accent, background: "#EAEEF3", borderRadius: 6, padding: "4px 10px", marginTop: 8 }}>🏗 Obra: {nomObra(cur.obra_id)}</div>}
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>{cur.de === miSide ? "Enviado a V+V" : "Recibido de V+V"} · {cur.fecha} · prioridad {cur.prioridad}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>{Object.entries(PEDIDO_ESTADOS).map(([k, v]) => <button key={k} onClick={() => setEstado(cur.id, k)} style={{ flex: 1, padding: "7px 4px", borderRadius: 7, border: `1px solid ${cur.estado === k ? v.c : T.border}`, background: cur.estado === k ? v.b : T.card, color: cur.estado === k ? v.c : T.muted, fontSize: 10.5, fontWeight: 700 }}>{v.l}</button>)}</div>
          <button onClick={() => borrarPedido(cur.id)} style={{ width: "100%", marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar pedido</button>
        </Card>
        <Eyebrow T={T}>Hilo</Eyebrow>
        {(cur.hilo || []).map((h, i) => { const mine = h.de === miSide; return (<div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
          <div style={{ maxWidth: "85%" }}>
            <div style={{ background: mine ? T.accent : T.card, color: mine ? "#fff" : T.text, border: mine ? "none" : `1px solid ${T.border}`, borderRadius: mine ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "10px 13px", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {h.texto}
              {(h.archivos || []).map((a, j) => a.img ? <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 7 }}><img src={a.url} alt={a.nombre} style={{ maxWidth: "100%", borderRadius: 8, display: "block" }} /></a> : <a key={j} href={a.url} target="_blank" rel="noreferrer" download={a.nombre} style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: mine ? "#fff" : T.accent, textDecoration: "underline" }}>📎 {a.nombre}</a>)}
            </div>
            <div style={{ fontSize: 9.5, color: T.muted, marginTop: 3, textAlign: mine ? "right" : "left" }}>{h.porIA ? "🤖 IA · " : ""}{mine ? cfg.nombre : "V+V"} · {h.fecha}</div>
          </div>
        </div>); })}
        <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Escribí una respuesta…" rows={3} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 13.5, color: T.text, marginTop: 8 }} />
        {adj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{adj.map((a, i) => <span key={i} style={{ background: "#EAEEF3", borderRadius: 6, padding: "5px 9px", fontSize: 11, color: T.sub }}>{a.img ? "🖼" : "📎"} {a.nombre} <span onClick={() => setAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.muted }}>✕</span></span>)}</div>}
        <input ref={fileRef} type="file" multiple onChange={addAdj} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => fileRef.current?.click()} style={{ width: 44, background: T.bg, color: T.sub, border: `1px solid ${T.border}`, borderRadius: T.rsm, fontSize: 17 }}>＋</button>
          <button onClick={() => responderIA(cur)} disabled={iaLoad} style={{ flex: 1, background: "#EAEEF3", color: T.accent, border: "none", borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700 }}>{iaLoad ? "Redactando…" : "🤖 Redactar con IA"}</button>
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
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#25D366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>📲</div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{c.nombre}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{c.rol || "—"} · {nomObra(c.obra_id)} · {c.telefono}</div></div>
          <button onClick={() => setCForm({ id: c.id, nombre: c.nombre || "", rol: c.rol || "", obra_id: c.obra_id || "", telefono: c.telefono || "" })} style={{ background: "none", border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Editar</button>
          <button onClick={() => borrarC(c.id)} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 7, width: 30, height: 30, fontSize: 13, cursor: "pointer" }}>✕</button>
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
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{p.rol || "—"} · {nomObra(p.obra_id)}{p.telefono ? ` · 📲 ${p.telefono}` : ""}</div>
            {(p.sitios || []).length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>{p.sitios.map((s, i) => <span key={i} style={{ fontSize: 9.5, fontWeight: 700, color: "#16A34A", background: "#ECFDF5", borderRadius: 5, padding: "2px 6px" }}>✓ {s.sitio}</span>)}</div>}
          </div>
          {vc > 0 ? <Badge c="#EF4444" b="#FEF2F2">{vc} vence</Badge> : docn > 0 ? <Badge c="#16A34A" b="#ECFDF5">{docn} doc</Badge> : <Badge c="#94A3B8" b="#F8FAFC">s/doc</Badge>}
        </div>
      </Card>); })}
    </div>

    {detalle && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={() => setDetalle(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 1180, margin: "0 auto", padding: "20px", maxHeight: "85vh", overflowY: "auto", animation: "up .25s ease" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{detalle.nombre}</div>
        <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>{detalle.rol} · {detalle.empresa || "V+V"} · {nomObra(detalle.obra_id)}</div>
        {detalle.telefono && <a href={`https://wa.me/${(() => { const c = String(detalle.telefono).replace(/\D/g, ""); return c.startsWith("54") ? c : "549" + c; })()}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", marginBottom: 14 }}>📲 WhatsApp · {detalle.telefono}</a>}
        <Eyebrow T={T}>Documentación</Eyebrow>
        {Object.keys(detalle.docs || {}).length === 0 && <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Sin documentación cargada.</div>}
        {Object.entries(detalle.docs || {}).map(([k, d]) => { const dias = d?.vence ? diasHasta(d.vence) : null; return (<div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.bg, borderRadius: T.rsm, padding: "10px 12px", marginBottom: 7 }}>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: T.text, textTransform: "uppercase" }}>{k}</div>{d?.vence && <div style={{ fontSize: 11, color: dias != null && dias <= 15 ? "#EF4444" : T.muted }}>Vence {d.vence}{dias != null ? ` (${dias < 0 ? "vencido" : dias + " d"})` : ""}</div>}</div>
          {d?.url && <a href={d.url} target="_blank" rel="noreferrer" download={d.nombre} style={{ background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 11px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ver</a>}
        </div>); })}
        {(detalle.sitios || []).length > 0 && <><Eyebrow T={T}>Sitios cargados</Eyebrow><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{detalle.sitios.map((s, i) => <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", background: "#ECFDF5", borderRadius: 6, padding: "5px 10px" }}>✓ {s.sitio} · {s.fecha}</span>)}</div></>}
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
          {lista.map(p => <div key={p.id} onClick={() => toggle(p.id)} style={{ display: "flex", alignItems: "center", gap: 11, background: sel.includes(p.id) ? "#EAEEF3" : T.bg, border: `1px solid ${sel.includes(p.id) ? T.accent : T.border}`, borderRadius: T.rsm, padding: "10px 12px", marginBottom: 7, cursor: "pointer" }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${sel.includes(p.id) ? T.accent : T.border}`, background: sel.includes(p.id) ? T.accent : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{sel.includes(p.id) ? "✓" : ""}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{p.nombre}</div><div style={{ fontSize: 11, color: T.muted }}>{p.rol || "—"} · {nomObra(p.obra_id)}</div></div>
          </div>)}
          <PBtn T={T} full onClick={ejecutarCarga} style={{ marginTop: 8 }}>Cargar {sel.length || ""} al sitio</PBtn>
        </> : <>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 6 }}>✓ Personal cargado</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Nómina lista para enviar a la administración del barrio.</div>
          <pre style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px", fontSize: 12, color: T.text, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>{nomina}</pre>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => copiar(nomina)} style={{ flex: 1, background: "#EAEEF3", color: T.accent, border: "none", borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700 }}>Copiar nómina</button>
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
function InformesScreen({ T, obras, formularios = [] }) {
  const [filtro, setFiltro] = useState("");
  const [open, setOpen] = useState(null);
  const [verForm, setVerForm] = useState(null);
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  const forms = (formularios || []).filter(f => f.compartido && (!filtro || f.obra_id === filtro)).sort((a, b) => (b.id > a.id ? 1 : -1));
  const todos = obras.flatMap(o => (o.informes || []).map(inf => ({ ...inf, obra: o.nombre, obra_id: o.id }))).filter(inf => !filtro || inf.obra_id === filtro).sort((a, b) => (b.id > a.id ? 1 : -1));
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "16px 20px" }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Obra</label>
      <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 16px" }}><option value="">Todas las obras</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
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
          <Badge c={inf.tipo === "ia" ? "#8B5CF6" : "#3B82F6"} b={inf.tipo === "ia" ? "#F5F3FF" : "#EFF6FF"}>{inf.tipo === "ia" ? "IA" : "Técnico"}</Badge>
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
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  const forms = (formularios || []).filter(f => f.compartido && (!filtro || f.obra_id === filtro)).sort((a, b) => (b.id > a.id ? 1 : -1));
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "16px 20px" }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Obra</label>
      <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 16px" }}><option value="">Todas las obras</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
      <Eyebrow T={T}>Formularios recibidos de V+V</Eyebrow>
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

const TIPOS_PEDIDO_CLI = { material: { label: "Materiales", icon: "📦", color: "#1B3A5B" }, definicion: { label: "Definiciones", icon: "📐", color: "#B0894F" }, plano: { label: "Planos", icon: "🗂️", color: "#3B6E9E" } };
const tipoPedCli = (id) => TIPOS_PEDIDO_CLI[id] || TIPOS_PEDIDO_CLI.material;
const itemsTexto = (p) => (p.items || []).map(it => (p.tipo && p.tipo !== "material") ? `${it.nombre}${it.detalle ? ` (${it.detalle})` : ""}` : `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim());

function MaterialesScreen({ T, cfg, obras, personal = [], contactos = [], matpedidos = [], setMatpedidos }) {
  // Estado del pedido de información (definiciones y planos): cuánto hace que espera
  // y cuándo V+V registró la recepción.
  const diasDe = (p) => { const t0 = p.ts || 0; return t0 ? Math.max(0, Math.floor((Date.now() - t0) / 86400000)) : 0; };
  const alertaDe = (p) => { const d = diasDe(p); if (d >= 5) return { txt: `⚠ Vencido — ${d} días sin respuesta`, color: "#B91C1C", bg: "#FEF2F2", bd: "#FECACA" }; if (d >= 3) return { txt: `⏳ ${d} días esperando`, color: "#B45309", bg: "#FFFBEB", bd: "#FDE68A" }; return { txt: d === 0 ? "Pedido hoy" : d === 1 ? "1 día esperando" : `${d} días esperando`, color: "#1B3A5B", bg: "#EFF6FF", bd: "#DBEAFE" }; };
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  const [waFor, setWaFor] = useState(null);
  function marcarEnviado(id) { aplicarMats(setMatpedidos, prev => (prev || []).map(x => x.id === id ? { ...x, waEnviado: true, waEnviadoFecha: hoyStr(), waEnviadoPor: cfg?.sigla || "Belfast" } : x)); }
  function levantar(id, val) { aplicarMats(setMatpedidos, prev => (prev || []).map(x => x.id === id ? { ...x, leido: val, leidoFecha: val ? hoyStr() : "", leidoPor: val ? (cfg?.nombre || cfg?.sigla || "Belfast") : "" } : x)); }
  function waText(p) {
    const tp = tipoPedCli(p.tipo);
    const lines = itemsTexto(p).map(l => `• ${l}`);
    return `*Pedido de ${tp.label.toLowerCase()}* — ${nomObra(p.obra_id)}\nFecha: ${p.fecha}${p.de === "contratista" && p.empresa ? `\nContratista: ${p.empresa}` : ""}\n\n${lines.join("\n")}${p.nota ? "\n\nNota: " + p.nota : ""}\n\n✅ Por favor, confirmá la recepción respondiendo este mensaje con *OK / RECIBIDO*.\n\n(Enviado desde ${cfg?.nombre || "Belfast"})`;
  }
  function waLink(text, phone) {
    const t = encodeURIComponent(text);
    if (phone) { const clean = String(phone).replace(/\D/g, ""); const num = clean.startsWith("54") ? clean : ("549" + clean); return `https://wa.me/${num}?text=${t}`; }
    return `https://wa.me/?text=${t}`;
  }
  const lista = (matpedidos || []).filter(p => p.de !== "cliente").sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const infoPend = lista.filter(p => p.tipo !== "material" && !p.cumplido);
  const infoVenc = infoPend.filter(p => diasDe(p) >= 5);
  const infoOk = lista.filter(p => p.tipo !== "material" && p.cumplido);
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    {(infoPend.length > 0 || infoOk.length > 0) && <div style={{ margin: "14px 16px 0", background: infoVenc.length ? "#FEF2F2" : "#fff", border: `1px solid ${infoVenc.length ? "#FECACA" : T.border}`, borderLeft: `3px solid ${infoVenc.length ? "#B91C1C" : BRASS}`, borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: infoVenc.length ? "#B91C1C" : T.navy }}>
        {infoVenc.length ? `⚠ ${infoVenc.length} pedido(s) de información vencido(s)` : infoPend.length ? `${infoPend.length} pedido(s) de información pendiente(s)` : "Sin pedidos de información pendientes"}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 3, lineHeight: 1.45 }}>Definiciones y planos solicitados por V+V. {infoOk.length} con recepción registrada. Se considera vencido a los 5 días sin respuesta.</div>
    </div>}
    <div style={{ padding: "16px 20px" }}>
      <Eyebrow T={T}>Pedidos de V+V · materiales, definiciones y planos</Eyebrow>
      {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "34px 18px", lineHeight: 1.55 }}>Todavía no recibiste pedidos de materiales.<br />Cuando V+V cargue uno, aparece acá.</div>}
      {lista.map(p => { const jefes = [...(contactos || []).filter(c => (!c.obra_id || c.obra_id === p.obra_id) && (c.telefono || "").trim()), ...(personal || []).filter(pe => pe.obra_id === p.obra_id && (pe.telefono || "").trim())]; return (<Card T={T} key={p.id} style={{ padding: 13, marginBottom: 9, borderLeft: `3px solid ${tipoPedCli(p.tipo).color}` }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}><span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: tipoPedCli(p.tipo).color, borderRadius: 5, padding: "2px 7px", marginRight: 8 }}>{tipoPedCli(p.tipo).icon} {tipoPedCli(p.tipo).label}</span>{nomObra(p.obra_id)} · {p.fecha}<span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 800, color: "#fff", background: p.de === "vv" ? T.accent : BRASS, borderRadius: 5, padding: "2px 7px" }}>{p.de === "vv" ? "V+V" : (p.empresa || "Contratista")}</span></div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{itemsTexto(p).map(l => `• ${l}`).join("\n")}</div>
          {p.nota && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5, fontStyle: "italic" }}>{p.nota}</div>}
          <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 6, color: p.leido ? "#16A34A" : "#B45309" }}>{p.leido ? `✓ Levantado${p.leidoFecha ? " · " + p.leidoFecha : ""}` : "● Sin levantar"}</div>
          {p.tipo !== "material" && (p.cumplido
            ? <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: "#15803D", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 6, padding: "3px 8px", marginTop: 7 }}>✓ Recepción registrada{p.cumplidoFecha ? " · " + p.cumplidoFecha : ""}</div>
            : (() => { const a = alertaDe(p); return <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color: a.color, background: a.bg, border: `1px solid ${a.bd}`, borderRadius: 6, padding: "3px 8px", marginTop: 7 }}>{a.txt}</div>; })())}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          <button onClick={() => levantar(p.id, !p.leido)} style={{ flex: 1, background: p.leido ? T.bg : "#ECFDF5", color: p.leido ? T.sub : "#15803D", border: `1px solid ${p.leido ? T.border : "#A7F3D0"}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{p.leido ? "↩ Marcar sin levantar" : "✓ Levantar pedido"}</button>
          <button onClick={() => setWaFor(waFor === p.id ? null : p.id)} style={{ flex: 1, background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>📲 WhatsApp</button>
          <button onClick={() => { if (confirm("¿Eliminar este pedido? Se borra para las dos empresas.")) aplicarMats(setMatpedidos, prev => (prev || []).filter(x => x.id !== p.id)); }} style={{ background: "none", border: "1px solid #FCA5A5", color: "#EF4444", borderRadius: T.rsm, padding: "10px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>
        {p.waEnviado && <div style={{ fontSize: 10, fontWeight: 700, color: "#0E7490", marginTop: 5 }}>📲 Enviado por WhatsApp{p.waEnviadoFecha ? " · " + p.waEnviadoFecha : ""}{p.waEnviadoPor ? " · " + p.waEnviadoPor : ""}</div>}
        {waFor === p.id && <div style={{ marginTop: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 11px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Enviar a…</div>
          {jefes.map(j => <a key={j.id} href={waLink(waText(p), j.telefono)} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", marginBottom: 7 }}>📲 {j.nombre}{j.rol ? ` · ${j.rol}` : ""}</a>)}
          <a href={waLink(waText(p))} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Elegir contacto de WhatsApp…</a>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>Se abre WhatsApp con el pedido ya escrito. Los jefes de obra con teléfono cargado aparecen arriba.</div>
        </div>}
      </Card>); })}
    </div>
  </div>);
}
function diasHabiles(d1, d2) { if (!d1 || !d2) return 0; const a = new Date(d1); a.setHours(0, 0, 0, 0); const b = new Date(d2); b.setHours(0, 0, 0, 0); if (b <= a) return 0; let n = 0; const cur = new Date(a); while (cur < b) { cur.setDate(cur.getDate() + 1); const wd = cur.getDay(); if (wd !== 0 && wd !== 6) n++; } return n; }
function gMetricas(fechaSolic, fechaReal, plazo, cerrado) { const fin = fechaReal || new Date(); const dias = diasHabiles(fechaSolic, fin); const desvio = dias - plazo; let estado; if (fechaReal || cerrado) estado = desvio <= 0 ? "Cumplido" : "Fuera de plazo"; else estado = desvio <= 0 ? "En plazo" : "Vencido"; return { dias, desvio, estado, retraso: Math.max(0, desvio) }; }
const GEST_ESTADOS = { "Cumplido": { c: "#16A34A", b: "#ECFDF5" }, "En plazo": { c: "#3B82F6", b: "#EFF6FF" }, "Fuera de plazo": { c: "#F59E0B", b: "#FFFBEB" }, "Vencido": { c: "#EF4444", b: "#FEF2F2" } };
const fmtD = d => d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "—";

function GestionScreen({ T, cfg, pedidos, obras, gestion, matpedidos = [] }) {
  const g = { plazo: 5, dotacion: 7, costoPersona: 60000, manual: [], ...(gestion || {}) };
  const [tab, setTab] = useState("registro");
  const cli = cfg?.nombre || "Belfast";
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  const itemsPedidos = (pedidos || []).map(p => { const solic = p.ts ? new Date(p.ts) : null; const resp = (p.hilo || []).find(h => h.de === p.para); const real = resp ? new Date(resp.ts) : null; const m = gMetricas(solic, real, g.plazo, p.estado === "resuelto"); return { id: p.id, tipo: "Pedido de información", obra_id: p.obra_id, descripcion: p.asunto, imputable: p.para === "cliente" ? cli : "V+V", fechaSolic: solic, fechaReal: real, ...m }; });
  const itemsManual = (g.manual || []).map(it => { const solic = it.fechaSolic ? new Date(it.fechaSolic) : null; const real = it.fechaReal ? new Date(it.fechaReal) : null; const m = gMetricas(solic, real, it.plazo || g.plazo, !!real); return { ...it, fechaSolic: solic, fechaReal: real, ...m }; });
  const parseDmy = (f) => { const m = String(f || "").match(/^(\d{2})\/(\d{2})\/(\d{2})$/); return m ? new Date(`20${m[3]}-${m[2]}-${m[1]}T12:00:00`) : null; };
  const itemsMat = (matpedidos || []).filter(p => p.tipo === "definicion" || p.tipo === "plano").map(p => {
    const solic = p.ts ? new Date(p.ts) : null;
    const real = p.cumplido ? (parseDmy(p.cumplidoFecha) || new Date()) : null;
    const m = gMetricas(solic, real, g.plazo, !!p.cumplido);
    const desc = (p.items || []).map(it => it.nombre).filter(Boolean).join(", ") || (p.tipo === "plano" ? "Plano" : "Definición");
    return { id: p.id, tipo: p.tipo === "plano" ? "Plano" : "Definición", obra_id: p.obra_id, descripcion: desc, imputable: cli, fechaSolic: solic, fechaReal: real, ...m };
  });
  const items = [...itemsPedidos, ...itemsMat, ...itemsManual].sort((a, b) => (b.fechaSolic || 0) - (a.fechaSolic || 0));
  const perItem = it => (it.estado === "Vencido" || it.estado === "Fuera de plazo") ? it.retraso * (it.dotacion || g.dotacion) * g.costoPersona : 0;
  const total = items.length, cumpl = items.filter(i => i.estado === "Cumplido" || i.estado === "En plazo").length;
  const pctCumpl = total ? Math.round(cumpl / total * 100) : 0;
  const diasProm = total ? (items.reduce((a, i) => a + i.dias, 0) / total).toFixed(1) : "—";
  const grp = n => items.filter(i => i.imputable === n).reduce((a, i) => a + perItem(i), 0);
  const perjB = grp(cli), perjVV = grp("V+V"), perjE = grp("Estudio"), perjT = perjB + perjVV + perjE;
  const cnt = e => items.filter(i => i.estado === e).length;
  const TABS = [["registro", "Registro"], ["panel", "Panel"], ["punitorios", "Punitorios"], ["plan", "Plan"]];

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "14px 20px 0" }}>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ flexShrink: 0, padding: "8px 13px", borderRadius: 8, border: `1px solid ${tab === k ? T.accent : T.border}`, background: tab === k ? "#EAEEF3" : T.card, color: tab === k ? T.accent : T.sub, fontSize: 12.5, fontWeight: 700 }}>{l}</button>)}</div>
    </div>
    {tab === "registro" && <div style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Desempeño medido sobre los pedidos (plazo {g.plazo} días háb.). Vista de seguimiento.</div>
      {items.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "30px" }}>Sin ítems.</div>}
      {items.map(it => { const e = GEST_ESTADOS[it.estado] || GEST_ESTADOS["En plazo"]; const pj = perItem(it); return (<Card T={T} key={it.id} style={{ padding: 13, marginBottom: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{it.descripcion}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{it.tipo} · {nomObra(it.obra_id)} · imputable a <b style={{ color: T.sub }}>{it.imputable}</b></div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>Solic. {fmtD(it.fechaSolic)} · {it.fechaReal ? `resp. ${fmtD(it.fechaReal)}` : "sin respuesta"} · {it.dias} d háb. · <b style={{ color: it.desvio > 0 ? "#EF4444" : "#16A34A" }}>desvío {it.desvio > 0 ? "+" : ""}{it.desvio}</b></div>
            {pj > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginTop: 5 }}>Perjuicio: {money(pj)}</div>}
          </div>
          <Badge c={e.c} b={e.b}>{it.estado}</Badge>
        </div>
      </Card>); })}
    </div>}
    {tab === "panel" && <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
        {[["Ítems", total, T.accent], ["% Cumplimiento", pctCumpl + "%", "#16A34A"], ["Días háb. prom.", diasProm, "#3B82F6"], ["Perjuicio total", money(perjT), "#EF4444"]].map(([l, v, c]) => <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px" }}><div style={{ fontSize: 17, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{l}</div></div>)}
      </div>
      <Eyebrow T={T}>Por estado</Eyebrow>
      <Card T={T} style={{ padding: 13, marginBottom: 14 }}>{["Cumplido", "En plazo", "Fuera de plazo", "Vencido"].map(s => { const e = GEST_ESTADOS[s]; return (<div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: e.c }} /><span style={{ fontSize: 12.5, color: T.text }}>{s}</span></div><span style={{ fontSize: 13, fontWeight: 800 }}>{cnt(s)}</span></div>); })}</Card>
      <Eyebrow T={T}>Perjuicio imputable</Eyebrow>
      <Card T={T} style={{ padding: 13 }}>{[[cli, perjB], ["Estudio", perjE], ["V+V", perjVV]].map(([n, v]) => <div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0" }}><span style={{ fontSize: 12.5, color: T.text }}>{n}</span><span style={{ fontSize: 13, fontWeight: 800, color: v > 0 ? "#EF4444" : T.muted }}>{money(v)}</span></div>)}<div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${T.border}` }}><span style={{ fontSize: 13, fontWeight: 800 }}>TOTAL</span><span style={{ fontSize: 14, fontWeight: 800, color: "#EF4444" }}>{money(perjT)}</span></div></Card>
    </div>}
    {tab === "punitorios" && <div style={{ padding: "16px 20px" }}>
      <Card T={T} style={{ padding: 14, marginBottom: 14 }}>
        <Eyebrow T={T}>Parámetros</Eyebrow>
        <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.8 }}>Plazo estándar: <b>{g.plazo} días hábiles</b><br />Dotación parada: <b>{g.dotacion} personas</b><br />Costo diario por persona: <b>{money(g.costoPersona)}</b></div>
        <div style={{ background: "#EAEEF3", borderRadius: T.rsm, padding: "11px 13px", marginTop: 10 }}><div style={{ fontSize: 11.5, color: T.sub }}>Perjuicio por día de retraso</div><div style={{ fontSize: 18, fontWeight: 800, color: "#EF4444" }}>{money(g.dotacion * g.costoPersona)}</div></div>
      </Card>
      <Eyebrow T={T}>Simulador acumulado</Eyebrow>
      <Card T={T} style={{ padding: 13 }}>{[1, 2, 3, 5, 7, 10, 15].map(d => <div key={d} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ fontSize: 12.5, color: T.sub }}>{d} día{d > 1 ? "s" : ""}</span><span style={{ fontSize: 12.5, fontWeight: 700 }}>{money(d * g.dotacion * g.costoPersona)}</span></div>)}</Card>
    </div>}
    {tab === "plan" && <div style={{ padding: "16px 20px" }}>
      {[["Objetivo", "Medir tiempos de definición y certificación, detectar desvíos y valorizar el perjuicio económico de los retrasos."], ["SLA", `Pedidos de información: respuesta en máx. ${g.plazo} días hábiles. Certificados: entrega en máx. ${g.plazo} días hábiles.`], ["Política de punitorios", "Por cada día de retraso imputable que detenga una tarea en condiciones de avanzar: perjuicio = días × dotación parada × costo diario. Se presenta en la reunión mensual."]].map(([t, d], i) => <Card T={T} key={i} style={{ padding: 14, marginBottom: 10 }}><div style={{ fontSize: 13, fontWeight: 800, color: T.accent, marginBottom: 6 }}>{t}</div><div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>{d}</div></Card>)}
    </div>}
  </div>);
}

// ── SHELL WEB INSTITUCIONAL (Cliente) ────────────────────────────────
function WebClientHeader({ T, cfg, screen, setScreen, aviso }) {
  const badge = (id) => (typeof aviso === "function" ? aviso(id) : 0);   // sirve para TODOS los íconos
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 200, flexShrink: 0 }}>
      <div style={{ background: T.navy, color: "#fff" }}>
        <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto", padding: "6px 16px", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRASS, whiteSpace: "nowrap" }}>Panel de Cliente</span>
        </div>
      </div>
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 24px 2px", display: "flex", justifyContent: "center" }}>
          <div onClick={() => setScreen("obras")} style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}>
            {cfg.logo ? <img src={cfg.logo} alt="" style={{ maxHeight: 46, maxWidth: 240, objectFit: "contain" }} />
              : <><div style={{ width: 44, height: 44, background: T.navy, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 800, borderBottom: `2px solid ${BRASS}` }}>{(cfg.sigla || "C").slice(0, 3)}</div>
                <div style={{ lineHeight: 1.2, textAlign: "left" }}><div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "0.04em" }}>{cfg.nombre}</div><div style={{ fontSize: 8.5, color: T.muted, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 2 }}>Seguimiento de obra</div></div></>}
          </div>
        </div>
        <nav style={{ maxWidth: 1180, margin: "0 auto", padding: "4px 12px 0", display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
          {NAV.map(n => { const active = screen === n.id; const hayNuevo = badge(n.id) > 0; return (
            <button key={n.id} onClick={() => setScreen(n.id)} style={{ position: "relative", background: "none", border: "none", padding: "9px 12px", fontSize: 12.5, fontWeight: (active || hayNuevo) ? 800 : 600, color: hayNuevo ? "#EF4444" : (active ? T.accent : T.sub), borderBottom: `2px solid ${active ? BRASS : "transparent"}`, whiteSpace: "nowrap", cursor: "pointer" }}>
              {n.label}
              {hayNuevo && <span style={{ position: "absolute", top: 2, right: 2, background: "#EF4444", color: "#fff", borderRadius: 9, minWidth: 15, height: 15, fontSize: 8.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{badge(n.id)}</span>}
            </button>); })}
        </nav>
      </div>
      <div style={{ height: 2, background: BRASS }} />
    </header>
  );
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
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "11px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, fontSize: 11 }}>
      <span style={{ fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,.8)" }}>{(cfg.nombre || "CLIENTE").toUpperCase()}</span>
      <span>Ejecuta: V+V Construcciones · © {new Date().getFullYear()} · build 01-07-IA</span>
    </div>
  </div>);
}

function ClienteApp() {
  useEffect(() => { if (FORCE_CLOUD) { try { history.replaceState(null, "", window.location.pathname); } catch { } } }, []);
  const [cfg, setCfg] = useStored("cliente_cfg", DEFAULT_CFG);
  const T = theme(cfg.accent);
  const [screen, setScreen] = useState("asistente");
  const [obras, setObras] = useStored("vv_obras", []);
  const [avance, setAvance] = useStored("vv_avance", {});
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
  const [formularios] = useStored("vv_formularios", []);
  const [matpedidos, setMatpedidos] = useStored("vv_matpedidos", []);
  const [contactos, setContactos] = useStored("cliente_contactos", []);
  const [documentacion] = useStored("vv_documentacion", []);
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
    personal:    (personal || []).map(p => "pe:" + p.id),
    gestion:     [],
    ajustes:     [],
  };
  const { aviso, marcarVisto } = useAvisos("cliente_avisos", idsAviso);
  // al abrir una pantalla, se apaga su punto rojo
  const irA = (id) => { setScreen(id); marcarVisto(id); };
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
    await postMensaje({ id: uid() + Date.now(), from: "cliente", texto: `📎 Subí documentación a ${nom}: ${files.map(f => f.nombre).join(", ")}`, fecha: hoyStr(), ts: Date.now(), archivos: files });
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
      <WebClientHeader T={T} cfg={cfg} screen={screen} setScreen={irA} aviso={aviso} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center", background: "transparent" }}>
        <div style={{ width: "100%", maxWidth: 1180, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg, borderLeft: `1px solid rgba(176,137,79,0.28)`, borderRight: `1px solid rgba(176,137,79,0.28)`, boxShadow: "0 0 80px rgba(0,0,0,0.45)" }}>
          {screen === "asistente" && <AsistenteScreen T={T} cfg={cfg} apiKey={vvCfg.apiKey} obras={obras} tareas={tareas} msgs={chatMsgs} setMsgs={setChatMsgs} pedidos={pedidos} setPedidos={setPedidos} personal={personal} setPersonal={setPersonal} mensajes={mensajes} contactos={contactos} formularios={formularios} matpedidos={matpedidos} documentacion={documentacion} onPedidos={() => setScreen("pedidos")} />}
          {screen === "obras" && <div style={{ flex: 1, overflowY: "auto" }}><Obras obras={obras} setObras={setObras} cfg={cfg} apiKey={vvCfg.apiKey} /></div>}
          {screen === "avance" && <AvanceView T={T} obras={obras} avance={avance} setAvance={setAvance} apiKey={vvCfg.apiKey} cfg={cfg} />}
          {screen === "bitacora" && <BitacoraView T={T} obras={obras} bitacora={bitacora} setBitacora={setBitacora} cfg={cfg} />}
          {screen === "personal" && <PersonalScreen T={T} cfg={cfg} personal={personal} setPersonal={setPersonal} obras={obras} contactos={contactos} setContactos={setContactos} />}
          {screen === "pedidos" && <PedidosScreen T={T} cfg={cfg} apiKey={vvCfg.apiKey} obras={obras} pedidos={pedidos} setPedidos={setPedidos} />}
          {screen === "materiales" && <MaterialesScreen T={T} cfg={cfg} obras={obras} personal={personal} contactos={contactos} matpedidos={matpedidos} setMatpedidos={setMatpedidos} />}
          {screen === "informes" && <InformesScreen T={T} obras={obras} formularios={formularios} />}
          {screen === "formularios" && <FormulariosScreen T={T} obras={obras} formularios={formularios} />}
          {screen === "gestion" && <GestionScreen T={T} cfg={cfg} pedidos={pedidos} obras={obras} gestion={gestion} matpedidos={matpedidos} />}
          {screen === "archivos" && <ArchivosScreen T={T} obras={obras} archivosCliente={archivosCliente} setArchivosCliente={setArchivosCliente} archivosVV={archivosVV} registrarSubida={registrarSubida} quitarDeObra={quitarDeObra} />}
          {screen === "mensajes" && <MensajesScreen T={T} cfg={cfg} obras={obras} mensajes={mensajes} enviar={enviar} borrarMensaje={borrarMensaje} vaciarMensajes={vaciarMensajes} />}
          {screen === "ajustes" && <AjustesScreen T={T} cfg={cfg} setCfg={setCfg} />}
        </div>
      </div>
      <WebClientFooter T={T} cfg={cfg} />
    </div>
    <SyncBanner />
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
