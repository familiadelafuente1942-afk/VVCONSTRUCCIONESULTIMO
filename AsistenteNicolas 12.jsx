import React, { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════════
// MI ASISTENTE — Asistente personal privado de Nicolás.
// Protegido con PIN. Lee TODOS los datos de V+V y puede consultar a la IA de V+V.
// Mismo backend (Supabase) y misma API (Anthropic) que el resto — costo cero extra.
// ════════════════════════════════════════════════════════════════════

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const SH = () => ({ "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY });
const storage = {
  set: async (key, value) => { try { localStorage.setItem(key, value); } catch { } try { await fetch(SUPA_URL + "/rest/v1/bco_storage", { method: "POST", headers: { ...SH(), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ key, value }) }); } catch { } return { value }; },
  get: async (key) => { try { const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { headers: SH(), mode: "cors" }); if (r.ok) { const d = await r.json(); if (d && d.length) return { value: d[0].value }; } } catch { } try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; } },
};
const uid = () => Math.random().toString(36).slice(2, 9);
const hoyStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`; };
const BUCKET = "bco-media";
async function subirBucket(dataUrl, nombre) {
  if (!dataUrl) return null;
  if (String(dataUrl).startsWith("http")) return dataUrl;
  try {
    const [meta, b64] = dataUrl.split(",");
    const mime = (meta.match(/data:(.*?);/) || [])[1] || "application/octet-stream";
    const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const path = `nicolas/${Date.now()}_${(nombre || "archivo").replace(/[^\w.\-]+/g, "_")}`;
    const r = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY, "Content-Type": mime, "x-upsert": "true" }, body: arr });
    if (r.ok) return `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  } catch { }
  return null;
}
function fileToDataUrl(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); }

async function callAI(msgs, sys, apiKey, useSearch) {
  msgs = (msgs || []).map(m => ({ role: m.role, content: m.content }));
  const body = { model: "claude-sonnet-4-6", max_tokens: 1500, messages: msgs };
  if (sys) body.system = sys;
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  async function doFetch(b) {
    try { const rp = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); if (rp.ok) return { ok: true, data: await rp.json() }; if (rp.status !== 404) { try { const e = await rp.json(); return { ok: false, err: e.error?.message || `Error ${rp.status}` }; } catch { return { ok: false, err: `Error ${rp.status}` }; } } } catch { }
    if (!apiKey) return { ok: false, err: "⚠ La IA no está disponible (falta crédito o configuración en Vercel)." };
    const headers = { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true", "anthropic-version": "2023-06-01", "x-api-key": apiKey };
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(b) });
    if (!r.ok) { let m = "Error de conexión."; try { const d = await r.json(); m = d.error?.message || `Error ${r.status}`; } catch { } return { ok: false, err: m }; }
    return { ok: true, data: await r.json() };
  }
  try {
    const res = await doFetch(body); if (!res.ok) return res.err;
    let d = res.data; if (d.error) return `Error: ${d.error.message || "Sin respuesta."}`;
    let g = 0; while (d.stop_reason === "pause_turn" && g < 4) { g++; const c = await doFetch({ ...body, messages: [...msgs, { role: "assistant", content: d.content }] }); if (!c.ok || c.data?.error) break; d = c.data; }
    return (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim() || "Sin respuesta.";
  } catch (e) { return `Error de conexión: ${e.message || ""}`; }
}

const T = { navy: "#1B1A16", accent: "#22463A", al: "#ECF0EC", bg: "#F4F2EC", card: "#FFFFFF", border: "#E5E1D6", text: "#1A1813", sub: "#6E695E", muted: "#A49D8D", rsm: 10, serif: "'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif", sans: "'Inter',-apple-system,'SF Pro Text',system-ui,sans-serif" };
const BRASS = "#A17C3E";

function obraNom(obras, id) { return (obras || []).find(o => o.id === id)?.nombre || "—"; }

export default function AsistenteNicolas() {
  const [pinOk, setPinOk] = useState(false);
  const [pinStored, setPinStored] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinNew, setPinNew] = useState(false);
  const [trust, setTrust] = useState(true);
  const [db, setDb] = useState({ obras: [], personal: [], pedidos: [], matpedidos: [], mensajes: [], formularios: [], documentacion: [] });
  const [pagos, setPagos] = useState([]);
  const [perfil, setPerfil] = useState("");
  const [gastos, setGastos] = useState([]);
  const chatWrite = useRef(0);
  const [archivos, setArchivos] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [camaras, setCamaras] = useState([]);
  const [ultimasFotos, setUltimasFotos] = useState([]);
  const [adjPend, setAdjPend] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [subiendoArch, setSubiendoArch] = useState(false);
  const [catArch, setCatArch] = useState("Presupuestos");
  const [obraEdit, setObraEdit] = useState(null);
  const archRef = useRef(null);
  const [modelos, setModelos] = useState([]);
  const [modeloSel, setModeloSel] = useState("");
  const modeloRef = useRef(null);
  const chatFileRef = useRef(null);
  const modelo = (modelos || []).find(m => m.id === modeloSel) || null;
  const CFG_DEF = { titulo: "Asistente", eyebrow: "V+V · Nicolás", accent: "#22463A", navy: "#1B1A16", bg: "#F4F2EC", card: "#FFFFFF", text: "#1A1813", fondoUrl: "", fondoOp: 14, serif: true, escala: 100, iconoUrl: "", iconoColor: "#22463A" };
  const [cfg, setCfg] = useState(() => { try { return { ...CFG_DEF, ...JSON.parse(localStorage.getItem("nicolas_cfg") || "{}") }; } catch { return CFG_DEF; } });
  const iconRef = useRef(null); const fondoRef = useRef(null);
  // Aplica la personalización al tema (colores) en vivo.
  T.accent = cfg.accent || "#22463A"; T.navy = cfg.navy || "#1B1A16"; T.bg = cfg.bg || "#F4F2EC"; T.card = cfg.card || "#FFFFFF"; T.text = cfg.text || "#1A1813";
  function saveCfg(next) { setCfg(next); try { localStorage.setItem("nicolas_cfg", JSON.stringify(next)); } catch { } storage.set("nicolas_cfg", JSON.stringify(next)).catch(() => { }); }
  function setC(k, v) { saveCfg({ ...cfg, [k]: v }); }
  useEffect(() => {
    // Ícono en la pantalla de inicio (apple-touch-icon) + favicon, best-effort.
    try {
      if (cfg.iconoUrl) {
        let l = document.querySelector("link[rel='apple-touch-icon']"); if (!l) { l = document.createElement("link"); l.rel = "apple-touch-icon"; document.head.appendChild(l); } l.href = cfg.iconoUrl;
        let f = document.querySelector("link[rel='icon']"); if (!f) { f = document.createElement("link"); f.rel = "icon"; document.head.appendChild(f); } f.href = cfg.iconoUrl;
      }
    } catch { }
  }, [cfg.iconoUrl]);
  function hexA(hex, a) { try { const h = (hex || "#000").replace("#", ""); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})`; } catch { return `rgba(0,0,0,${a})`; } }
  async function subirIcono(e) { const f = e.target.files[0]; if (!f) return; e.target.value = ""; const data = await fileToDataUrl(f); setC("iconoUrl", data); }
  async function subirFondo(e) { const f = e.target.files[0]; if (!f) return; e.target.value = ""; const data = await fileToDataUrl(f); const url = await subirBucket(data, f.name) || data; setC("fondoUrl", url); }
  const [vista, setVista] = useState("chat");
  const chatSeen = useRef(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [filtroObra, setFiltroObra] = useState("");
  const pagosWrite = useRef(0);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hola Nicolás 👋 Soy tu asistente personal. Tengo acceso a todos los datos de V+V. Preguntame lo que quieras: un DNI, el estado de una obra, la última foto de Castores, un plano, o pedime que le consulte algo a la IA de V+V." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [vozOn, setVozOn] = useState(false);
  const recRef = useRef(null);
  const lastSpokeRef = useRef(-1);
  const apiKey = "";
  const scrollRef = useRef(null);
  const iaWait = useRef(null);

  useEffect(() => { (async () => { const r = await storage.get("nicolas_pin"); if (r?.value) { setPinStored(r.value); try { if (localStorage.getItem("nicolas_trust") === "1") { setPinOk(true); return; } } catch { } } else { setPinStored("1234"); storage.set("nicolas_pin", "1234").catch(() => { }); } })(); }, []);

  useEffect(() => {
    if (!pinOk) return;
    let alive = true;
    async function pull() {
      const keys = ["vv_obras", "vv_personal", "vv_pedidos", "vv_matpedidos", "vv_mensajes", "vv_formularios", "vv_documentacion"];
      const res = await Promise.all(keys.map(k => storage.get(k)));
      if (!alive) return;
      const parse = (r) => { try { return r?.value ? JSON.parse(r.value) : []; } catch { return []; } };
      setDb({ obras: parse(res[0]), personal: parse(res[1]), pedidos: parse(res[2]), matpedidos: parse(res[3]), mensajes: parse(res[4]), formularios: parse(res[5]), documentacion: parse(res[6]) });
      if (Date.now() - pagosWrite.current > 4000) { const rp = await storage.get("nicolas_pagos"); if (!alive) return; const pg = parse(rp); setPagos(prev => JSON.stringify(pg) !== JSON.stringify(prev) ? pg : prev); }
      const [ra, rag, rg, rcon, rcam] = await Promise.all([storage.get("nicolas_archivos"), storage.get("nicolas_agenda"), storage.get("nicolas_gastos"), storage.get("nicolas_contactos"), storage.get("vv_camaras")]);
      if (alive) { const av = parse(ra); setArchivos(prev => JSON.stringify(av) !== JSON.stringify(prev) ? av : prev); const ag = parse(rag); setAgenda(prev => JSON.stringify(ag) !== JSON.stringify(prev) ? ag : prev); const gg = parse(rg); setGastos(prev => JSON.stringify(gg) !== JSON.stringify(prev) ? gg : prev); const cc = parse(rcon); setContactos(prev => JSON.stringify(cc) !== JSON.stringify(prev) ? cc : prev); const cm = parse(rcam); setCamaras(prev => JSON.stringify(cm) !== JSON.stringify(prev) ? cm : prev); }
      if (!modelos.length) { const rmod = await storage.get("nicolas_modelos"); if (alive && rmod?.value) { try { const arr = JSON.parse(rmod.value); setModelos(arr); if (arr.length && !modeloSel) setModeloSel(arr[0].id); } catch { } } }
      const rc = await storage.get("nicolas_cfg"); if (alive && rc?.value) { try { const c = JSON.parse(rc.value); setCfg(prev => JSON.stringify({ ...CFG_DEF, ...c }) !== JSON.stringify(prev) ? { ...CFG_DEF, ...c } : prev); } catch { } }
    }
    pull(); const iv = setInterval(pull, 5000); const onVis = () => { if (document.visibilityState === "visible") pull(); }; document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", pull); return () => { alive = false; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", pull); };
  }, [pinOk]);

  const scrollBottom = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight + 99999; };
  const scrollBottomHard = () => { try { requestAnimationFrame(scrollBottom); } catch { } [0, 60, 160, 320, 600, 1000].forEach(d => setTimeout(scrollBottom, d)); };
  useEffect(() => { scrollBottomHard(); }, [msgs, busy]);
  useEffect(() => { if (vista === "chat") scrollBottomHard(); }, [vista]);
  useEffect(() => {
    const h = () => { if (document.visibilityState !== "hidden") scrollBottomHard(); };
    document.addEventListener("visibilitychange", h); window.addEventListener("focus", h); window.addEventListener("pageshow", h); window.addEventListener("resize", h);
    return () => { document.removeEventListener("visibilitychange", h); window.removeEventListener("focus", h); window.removeEventListener("pageshow", h); window.removeEventListener("resize", h); };
  }, []);
  // Voz: leer en voz alta las respuestas nuevas cuando está activado.
  useEffect(() => { if (vozOn) { lastSpokeRef.current = msgs.length - 1; } else { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { } } }, [vozOn]);
  useEffect(() => { if (!vozOn) return; const i = msgs.length - 1; const last = msgs[i]; if (last && last.role === "assistant" && i > lastSpokeRef.current) { lastSpokeRef.current = i; hablar(last.content); } }, [msgs, vozOn]);

  // Memoria persistente: carga el historial del chat y el perfil al abrir.
  useEffect(() => {
    if (!pinOk) return;
    (async () => {
      try { const r = await storage.get("nicolas_chat"); if (r?.value) { const arr = JSON.parse(r.value); if (Array.isArray(arr) && arr.length) setMsgs(arr); } } catch { }
      try { const rp = await storage.get("nicolas_perfil"); if (rp?.value) setPerfil(rp.value); } catch { }
    })();
  }, [pinOk]);
  // Guarda el historial del chat cada vez que cambia (así no se pierde al cerrar).
  useEffect(() => {
    if (!pinOk) return;
    const t = setTimeout(() => { try { localStorage.setItem("nicolas_chat", JSON.stringify(msgs.slice(-120))); } catch { } storage.set("nicolas_chat", JSON.stringify(msgs.slice(-120))).catch(() => { }); }, 700);
    return () => clearTimeout(t);
  }, [msgs, pinOk]);

  // Globito rojo en Chat: mensajes nuevos del asistente mientras estás en otra solapa.
  useEffect(() => { if (vista === "chat") { chatSeen.current = msgs.length; setChatUnread(0); } else { const u = msgs.slice(chatSeen.current).filter(m => m.role === "assistant").length; setChatUnread(u); } }, [msgs, vista]);
  // Recordatorio: avisa en el chat por los eventos de mañana (un día antes).
  useEffect(() => {
    if (!pinOk) return;
    function parseFecha(f) { const p = String(f || "").split("/"); if (p.length < 3) return null; let [d, m, y] = p.map(n => parseInt(n, 10)); if (y < 100) y += 2000; if (!d || !m || !y) return null; return new Date(y, m - 1, d); }
    async function chequear() {
      const man = new Date(); man.setDate(man.getDate() + 1); man.setHours(0, 0, 0, 0);
      let arr = []; try { const r = await storage.get("nicolas_agenda"); if (r?.value) arr = JSON.parse(r.value); } catch { }
      const paraAvisar = arr.filter(e => { const fe = parseFecha(e.fecha); return fe && fe.getFullYear() === man.getFullYear() && fe.getMonth() === man.getMonth() && fe.getDate() === man.getDate() && !e.recordado; });
      if (!paraAvisar.length) return;
      setMsgs(prev => [...prev, ...paraAvisar.map(e => ({ role: "assistant", content: `🔔 Recordatorio: MAÑANA (${e.fecha}${e.hora ? " " + e.hora : ""}) tenés → ${e.titulo}${e.nota ? `\n${e.nota}` : ""}` }))]);
      try { if ("setAppBadge" in navigator) navigator.setAppBadge(paraAvisar.length); } catch { }
      const next = arr.map(e => paraAvisar.some(x => x.id === e.id) ? { ...e, recordado: true } : e);
      setAgenda(next); try { localStorage.setItem("nicolas_agenda", JSON.stringify(next)); } catch { } await storage.set("nicolas_agenda", JSON.stringify(next)).catch(() => { });
    }
    const t = setTimeout(chequear, 3000); const iv = setInterval(chequear, 60 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [pinOk]);

  function entrar() {
    try { localStorage.setItem("nicolas_trust", trust ? "1" : "0"); } catch { }
    if (pinNew) { const p = pinInput.trim(); if (p.length < 4) { alert("El PIN tiene que tener al menos 4 dígitos."); return; } storage.set("nicolas_pin", p); setPinStored(p); setPinNew(false); setPinOk(true); setPinInput(""); return; }
    if (pinInput === pinStored) { setPinOk(true); setPinInput(""); } else { alert("PIN incorrecto."); setPinInput(""); }
  }

  function hablar(texto) {
    try {
      const synth = window.speechSynthesis; if (!synth || !texto) return;
      synth.cancel();
      const limpio = String(texto).replace(/[*_#>`~]/g, "").replace(/\s+/g, " ").trim().slice(0, 650);
      const u = new SpeechSynthesisUtterance(limpio);
      u.lang = "es-AR"; u.rate = 1; u.pitch = 1;
      const vs = synth.getVoices() || []; const es = vs.find(v => /es[-_]AR/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)); if (es) u.voice = es;
      synth.speak(u);
    } catch { }
  }
  function dictar() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Este teléfono no permite dictar desde la app. Tocá el cuadro de texto y usá el micrófono del teclado (dictado del iPhone)."); return; }
    if (escuchando && recRef.current) { try { recRef.current.stop(); } catch { } return; }
    let rec; try { rec = new SR(); } catch { alert("No pude activar el micrófono."); return; }
    rec.lang = "es-AR"; rec.interimResults = true; rec.continuous = false;
    let base = input ? input + " " : "";
    rec.onresult = (e) => { let fin = "", inter = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else inter += t; } setInput((base + fin + inter).replace(/\s+/g, " ").trimStart()); if (fin) base += fin; };
    rec.onend = () => { setEscuchando(false); recRef.current = null; };
    rec.onerror = () => { setEscuchando(false); recRef.current = null; };
    recRef.current = rec; setEscuchando(true); try { rec.start(); } catch { setEscuchando(false); }
  }
  function buildSystem() {
    const o = db.obras || [];
    const obrasTxt = o.map(x => `· ${x.nombre}${x.estado ? ` (${x.estado})` : ""}${x.avance != null ? ` — avance ${x.avance}%` : ""} — ${(x.fotos || []).length} fotos, ${(x.videos || []).length} videos, ${(x.planos || []).length} planos, ${(x.informes || []).length} informes`).join("\n") || "(sin obras)";
    const planosTxt = o.map(x => (x.planos || []).length ? `· ${x.nombre}: ${(x.planos || []).map(p => p.nombre).join(", ")}` : null).filter(Boolean).join("\n") || "(sin planos)";
    const per = (db.personal || []).map(p => `· ${p.nombre} — ${p.rol || ""} (${obraNom(o, p.obra_id)})${p.empresa ? ` [${p.empresa}]` : ""}${p.telefono ? ` · tel ${p.telefono}` : ""}${p.dni ? ` · DNI ${p.dni}` : ""}${p.cuil ? ` · CUIL ${p.cuil}` : ""}`).join("\n") || "(sin personal)";
    const peds = (db.pedidos || []).map(p => `· [${p.estado || "abierto"}] ${p.asunto} (de ${p.de} → ${p.para})`).join("\n") || "(sin pedidos)";
    const mats = (db.matpedidos || []).map(p => `· ${obraNom(o, p.obra_id)} (${p.de === "vv" ? "V+V" : p.de === "cliente" ? "Belfast" : p.empresa || "contratista"}): ${(p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ")}${p.leido ? " ✓levantado" : " ●pendiente"}`).join("\n") || "(sin pedidos de materiales)";
    const pg = (pagos || []).slice(0, 40).map(p => `· ${p.fecha} — ${p.persona} $${(p.monto || 0).toLocaleString("es-AR")} (${p.obra || "sin obra"}) [${p.estado}${p.metodo ? ", " + p.metodo : ""}]`).join("\n") || "(sin pagos cargados)";
    const hoyG = hoyStr(); const mesG = hoyG.slice(3);
    const gs = (gastos || []).slice(0, 40).map(g => `· ${g.fecha} — ${g.concepto} $${(g.monto || 0).toLocaleString("es-AR")}`).join("\n") || "(sin gastos)";
    const totDia = (gastos || []).filter(g => g.fecha === hoyG).reduce((a, g) => a + (g.monto || 0), 0);
    const totMes = (gastos || []).filter(g => (g.fecha || "").slice(3) === mesG).reduce((a, g) => a + (g.monto || 0), 0);
    const totalPend = (pagos || []).filter(p => p.estado === "pendiente").reduce((a, p) => a + (p.monto || 0), 0);
    const ag = (agenda || []).slice(0, 30).map(e => `· ${e.fecha}${e.hora ? " " + e.hora : ""} — ${e.titulo}${e.nota ? " (" + e.nota + ")" : ""}`).join("\n") || "(agenda vacía)";
    const arch = (archivos || []).slice(0, 40).map(f => `· [${f.categoria}] ${f.nombre}`).join("\n") || "(sin archivos)";
    const con = (contactos || []).slice(0, 60).map(c => `· ${c.nombre}${c.telefono ? ` · WhatsApp ${c.telefono}` : ""}${c.email ? ` · ${c.email}` : ""}${c.alias ? ` · alias ${c.alias}` : ""}${c.nota ? ` (${c.nota})` : ""}`).join("\n") || "(sin contactos favoritos)";
    return `Sos el asistente personal y privado de Nicolás Arcussi (CEO / Director de Operaciones de V+V Construcciones). Hablás en español rioplatense (vos), claro y directo. Tenés memoria: recordás lo que Nicolás te contó (está en "SOBRE SEBASTIÁN") y el historial de esta conversación. Tratalo con cercanía y empatía, como alguien que lo conoce.

SOBRE SEBASTIÁN (lo que me fue contando; usalo para conocerlo y no volver a preguntar lo que ya sé):
${perfil || "(todavía no cargué datos personales; cuando me cuente algo durable sobre él, lo recuerdo)"}

Tenés acceso a TODOS los datos internos de V+V y a la agenda de pagos personal de Nicolás. Cuando te piden un dato puntual (un DNI, un teléfono, el estado de una obra, cuánto se le pagó a alguien), buscalo y respondé el valor EXACTO; nunca digas que no lo tenés si está acá abajo.

OBRAS:
${obrasTxt}

PLANOS POR OBRA:
${planosTxt}

PERSONAL (con DNI/CUIL/tel):
${per}

PEDIDOS:
${peds}

PEDIDOS DE MATERIALES:
${mats}

AGENDA DE PAGOS (personal de Nicolás) — pendiente total $${totalPend.toLocaleString("es-AR")}:
${pg}

GASTOS DIARIOS (generales) — hoy $${totDia.toLocaleString("es-AR")}, este mes $${totMes.toLocaleString("es-AR")}:
${gs}

MI AGENDA (eventos/citas):
${ag}

MIS ARCHIVOS GUARDADOS:
${arch}

MIS CONTACTOS FAVORITOS (usá estos para WhatsApp, mail y pagos):
${con}

Además podés ejecutar acciones. Si necesitás una, terminá tu respuesta con UN bloque:
<<ACCION>>{...}<<FIN>>
Acciones:
{"tipo":"pagar_mp","para":"Héctor","monto":300,"alias":"opcional alias/CVU si lo sabés"}
{"tipo":"mandar_mail","para":"Héctor","email":"opcional si lo sabés","asunto":"...","cuerpo":"texto del mail redactado"}
{"tipo":"como_llego","destino":"dirección o lugar (ej: Aeroparque, o Av. Corrientes 1234 CABA)"}
{"tipo":"foto_a_obra","obra":"Castores 475","cantidad":12}
{"tipo":"crear_obra","nombre":"Nombre de la obra","direccion":"opcional","estado":"En curso","avance":0}
{"tipo":"recordar","dato":"lo que hay que recordar de Nicolás (ej: tiene 3 hijos; su cumple es el 5/8; prefiere respuestas cortas)"}
{"tipo":"agendar","titulo":"Reunión con Belfast","fecha":"DD/MM/AA","hora":"10:00","nota":"opcional"}
{"tipo":"cargar_gasto","concepto":"Nafta","monto":15000,"fecha":"DD/MM/AA"}
{"tipo":"cargar_pago","persona":"Humberto","monto":50000,"obra":"Castores 475","estado":"pagado","metodo":"efectivo","nota":""}
{"tipo":"generar_pdf","tipo_doc":"presupuesto|comprobante|nota","titulo":"...","cliente":"...","obra":"...","texto":"cuerpo si es nota/comprobante","items":[{"desc":"Contrapiso","cantidad":100,"unidad":"m2","precio":8000}],"pie":"condiciones/validez"}
{"tipo":"whatsapp","persona":"Valeria","texto":"el mensaje a enviar por WhatsApp"}
{"tipo":"preguntar_ia","texto":"lo que querés consultarle a la IA de V+V"}
{"tipo":"traer_fotos","obra":"nombre de la obra","cantidad":1,"videos":false}
{"tipo":"traer_plano","obra":"nombre de la obra","buscar":"palabras clave del plano"}
Reglas:
- "pagar_mp" cuando Nicolás quiere PAGARLE o MANDARLE PLATA a alguien AHORA: "pagale a Héctor 300", "hacele un pago a X", "transferile a X", "mandale $Y a X", "pagale por Mercado Pago". Esto ABRE Mercado Pago con un botón para que confirme el pago (ninguna app paga sola). Si sabés el alias/CVU, incluilo. IMPORTANTE: si el pedido es "pagale/mandale plata a X", usá SIEMPRE pagar_mp (NO cargar_pago).
- "mandar_mail" cuando dice "mandale un mail a X que…". Redactá asunto y cuerpo profesional; se abre el mail listo para enviar. Si no sabés el email, dejalo vacío.
- "como_llego" cuando Nicolás pregunta cuánto tarda, cuánto hay, cómo llegar o la distancia a un lugar (ej: "¿cuánto tardo hasta el Aeroparque?", "¿cómo llego a Castores 475?"). Poné el destino. El sistema toma su ubicación GPS, estima el tiempo y le deja un botón a Google Maps.
- "foto_a_obra" cuando Nicolás sube una o varias fotos por el chat y te dice a qué obra van (ej: "subila a Castores 475", "estas fotos son de Golf 2-93", "mandalas a la obra A 37"). Tomo las últimas fotos que subió y las cargo en las fotos de esa obra (las ve V+V).
- "crear_obra" cuando dice "cargá una obra nueva", "agregá la obra X", "abrí una obra en tal dirección". Poné el nombre y lo que aclare (dirección, estado).
- "recordar" SIEMPRE que Nicolás te cuente algo durable sobre él (familia, hijos, gustos, fechas, cómo prefiere que le hables, su equipo, etc.). Guardalo para conocerlo. No lo uses para cosas pasajeras.
- "agendar" cuando dice "agendá / anotá en la agenda / recordame" un evento, reunión o cita (ej: "agendá reunión con Belfast el jueves a las 10"). Interpretá fecha (jueves, mañana, 15/07) y hora.
- "cargar_gasto" cuando dice "cargá un gasto de nafta de 15000", "anotá un gasto de comida 8000", "gasté 5000 en la ferretería". Son gastos generales del día (concepto + monto). No lleva obra.
- "cargar_pago" SOLO para REGISTRAR/ANOTAR en la planilla de Pagos un pago (no mueve plata): "anotá/registrá/cargá un pago a Humberto en Castores 475 de 50000", "anotá que le pagué a Juan 30 lucas". Palabras clave: anotá, registrá, cargá. Interpretá monto ("50 lucas"=50000, "50 mil"=50000), obra, estado y método. Si el pedido es "pagale/mandale plata a X" (sin decir anotar/registrar), NO uses esto: usá pagar_mp.
- "generar_pdf" cuando pide un PRESUPUESTO, COMPROBANTE o NOTA en PDF. Para presupuestos usá "items" (desc, cantidad, unidad, precio); el sistema calcula subtotales y total solo. Para comprobantes/notas usá "texto". ${modelo ? `Nicolás subió un MODELO de presupuesto: seguí su estructura, títulos y estilo. MODELO: """${(modelo.texto||"").slice(0,2500)}"""` : "Si pide presupuesto y no hay modelo, armá uno profesional igual."}
- "whatsapp" cuando dice "mandale un mensaje a X que…" o "escribile a X". Uso los teléfonos de Personal; le dejo el WhatsApp listo para enviar con un toque.
- "preguntar_ia" solo si pide expresamente consultar a la IA de V+V.
- "traer_fotos"/"traer_plano" para mostrar fotos, videos o planos en el chat.
Poné el bloque de acción solo cuando corresponda; si no, respondé normal.`;
  }

  function parseAccion(txt) { const m = txt.match(/<<ACCION>>([\s\S]*?)<<FIN>>/); if (!m) return { limpio: txt, accion: null }; let a = null; try { a = JSON.parse(m[1].trim()); } catch { } return { limpio: txt.replace(m[0], "").trim(), accion: a }; }

  async function persistPagos(next) {
    pagosWrite.current = Date.now(); setPagos(next);
    try { localStorage.setItem("nicolas_pagos", JSON.stringify(next)); } catch { }
    await storage.set("nicolas_pagos", JSON.stringify(next)).catch(() => { });
  }
  function cargarPago(a) {
    const obra = a.obra ? (db.obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(a.obra).toLowerCase())) : null;
    const p = { id: uid() + Date.now(), persona: a.persona || "", monto: Number(String(a.monto).replace(/[^\d.-]/g, "")) || 0, obra: obra?.nombre || a.obra || "", obra_id: obra?.id || "", estado: (a.estado || "pendiente").toLowerCase().includes("pag") ? "pagado" : "pendiente", metodo: a.metodo || "", nota: a.nota || "", fecha: a.fecha || hoyStr(), ts: Date.now() };
    persistPagos([p, ...(pagos || [])]);
    return p;
  }
  async function persistPagos(next) {
    pagosWrite.current = Date.now(); setPagos(next);
    try { localStorage.setItem("nicolas_pagos", JSON.stringify(next)); } catch { }
    await storage.set("nicolas_pagos", JSON.stringify(next)).catch(() => { });
  }
  async function persistArch(next) { setArchivos(next); await storage.set("nicolas_archivos", JSON.stringify(next)).catch(() => { }); }
  async function persistGastos(next) { setGastos(next); try { localStorage.setItem("nicolas_gastos", JSON.stringify(next)); } catch { } await storage.set("nicolas_gastos", JSON.stringify(next)).catch(() => { }); }
  function cargarGasto(a) { const g = { id: uid() + Date.now(), concepto: a.concepto || a.texto || "Gasto", monto: Number(String(a.monto).replace(/[^\d.-]/g, "")) || 0, fecha: a.fecha || hoyStr(), ts: Date.now() }; persistGastos([g, ...(gastos || [])]); return g; }
  async function exportarGastosExcel() {
    const lista = (gastos || []); if (!lista.length) { alert("No hay gastos para exportar."); return; }
    const filas = lista.map(g => ({ Fecha: g.fecha, Concepto: g.concepto, Monto: g.monto }));
    const XLSX = await cargarSDK();
    if (XLSX) { const ws = XLSX.utils.json_to_sheet(filas); ws["!cols"] = [{ wch: 10 }, { wch: 30 }, { wch: 12 }]; const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Gastos"); XLSX.writeFile(wb, `Gastos_${hoyStr().replace(/\//g, "-")}.xlsx`); }
    else { const cab = ["Fecha", "Concepto", "Monto"]; const csv = "\uFEFF" + [cab.join(";"), ...filas.map(r => cab.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `Gastos_${hoyStr().replace(/\//g, "-")}.csv`; a.click(); }
  }
  async function subirEnChat(e) {
    const files = Array.from(e.target.files); if (!files.length) return; e.target.value = "";
    const pend = [];
    for (const f of files) {
      const esImg = /^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name);
      const esPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      const esHoja = /\.(xlsx|xls|csv|tsv)$/i.test(f.name) || /spreadsheet|excel|csv/.test(f.type);
      const dataUrl = await fileToDataUrl(f);
      const url = await subirBucket(dataUrl, f.name);
      const item = { id: uid() + Date.now(), nombre: f.name, url: url || "", categoria: esImg ? "Fotos" : esHoja ? "Planillas" : "Chat", ext: (f.name.split(".").pop() || "").toUpperCase(), fecha: hoyStr(), ts: Date.now() };
      setArchivos(prev => { const n = [item, ...(prev || [])]; storage.set("nicolas_archivos", JSON.stringify(n)).catch(() => { }); return n; });
      if (esImg && url) setUltimasFotos(prev => [{ url, nombre: f.name }, ...prev].slice(0, 12));
      if (esImg || esPdf) {
        if (f.size > 3 * 1024 * 1024) { setMsgs(prev => [...prev, { role: "assistant", content: `"${f.name}" pesa más de 3MB; achicá la foto o mandá el PDF con menos páginas.` }]); continue; }
        const b64 = String(dataUrl).split(",")[1];
        const mediaType = esImg ? ((dataUrl.match(/data:(.*?);/) || [])[1] || "image/jpeg") : "application/pdf";
        pend.push({ nombre: f.name, kind: esImg ? "image" : "document", data: b64, mediaType });
        setMsgs(prev => [...prev, { role: "user", content: `📎 ${f.name}`, ...(esImg ? { media: [url || dataUrl], mediaTipo: "fotos" } : { docs: [{ nombre: f.name, url: url || "" }] }) }]);
      } else if (esHoja) {
        const XLSX = await cargarSDK(); let texto = "";
        if (XLSX) { try { const buf = await f.arrayBuffer(); const wb = XLSX.read(buf, { type: "array" }); for (const sn of wb.SheetNames) { texto += `\n--- Hoja: ${sn} ---\n` + XLSX.utils.sheet_to_csv(wb.Sheets[sn]); } texto = texto.slice(0, 12000); } catch { texto = ""; } }
        if (!texto.trim()) { setMsgs(prev => [...prev, { role: "assistant", content: `No pude leer la planilla "${f.name}". Probá guardándola como PDF.` }]); continue; }
        pend.push({ nombre: f.name, kind: "texto", texto: `Contenido de la planilla "${f.name}" (CSV):\n${texto}` });
        setMsgs(prev => [...prev, { role: "user", content: `📎 ${f.name} (planilla)`, docs: [{ nombre: f.name, url: url || "" }] }]);
      } else {
        setMsgs(prev => [...prev, { role: "assistant", content: `Guardé "${f.name}" en Archivos, pero para analizarlo necesito foto, PDF o planilla (Excel/CSV).` }]);
      }
    }
    if (pend.length) { setAdjPend(prev => [...prev, ...pend]); setMsgs(prev => [...prev, { role: "assistant", content: "Listo, lo tengo cargado. Decime qué querés que haga (leerlo, sacar los datos, resumirlo, etc.)." }]); }
  }
  async function persistAgenda(next) { setAgenda(next); await storage.set("nicolas_agenda", JSON.stringify(next)).catch(() => { }); }
  async function persistContactos(next) { setContactos(next); try { localStorage.setItem("nicolas_contactos", JSON.stringify(next)); } catch { } await storage.set("nicolas_contactos", JSON.stringify(next)).catch(() => { }); }
  async function persistCamaras(next) { setCamaras(next); try { localStorage.setItem("vv_camaras", JSON.stringify(next)); } catch { } await storage.set("vv_camaras", JSON.stringify(next)).catch(() => { }); }
  async function subirArchivos(e) {
    const files = Array.from(e.target.files); if (!files.length) return; e.target.value = ""; setSubiendoArch(true);
    const nuevos = [];
    for (const f of files) {
      const data = await fileToDataUrl(f);
      const url = await subirBucket(data, f.name);
      if (!url) { alert(`No pude subir "${f.name}" a la nube. Revisá el bucket 'bco-media' en Supabase.`); continue; }
      nuevos.push({ id: uid() + Date.now(), nombre: f.name, url, categoria: catArch, ext: (f.name.split(".").pop() || "").toUpperCase(), fecha: hoyStr(), ts: Date.now() });
    }
    if (nuevos.length) await persistArch([...nuevos, ...(archivos || [])]);
    setSubiendoArch(false);
  }
  function agendarEvento(a) {
    const ev = { id: uid() + Date.now(), fecha: a.fecha || hoyStr(), hora: a.hora || "", titulo: a.titulo || a.texto || "Evento", nota: a.nota || "", ts: Date.now() };
    persistAgenda([...(agenda || []), ev].sort((x, y) => (x.fecha + (x.hora || "")).localeCompare(y.fecha + (y.hora || ""))));
    return ev;
  }
  function guardarObra() {
    if (!obraEdit) return;
    (async () => {
      let arr = []; try { const r = await storage.get("vv_obras"); if (r?.value) arr = JSON.parse(r.value); } catch { }
      let next;
      if (obraEdit._new) {
        if (!(obraEdit.nombre || "").trim()) { alert("Poné un nombre de obra."); return; }
        const nueva = { id: uid() + Date.now(), nombre: obraEdit.nombre.trim(), estado: obraEdit.estado || "En curso", avance: Number(obraEdit.avance) || 0, direccion: obraEdit.direccion || "", fotos: [], videos: [], planos: [], informes: [], tareas: [] };
        next = [nueva, ...arr];
      } else {
        next = arr.map(o => o.id === obraEdit.id ? { ...o, nombre: obraEdit.nombre, estado: obraEdit.estado, avance: Number(obraEdit.avance) || 0, direccion: obraEdit.direccion } : o);
      }
      try { localStorage.setItem("vv_obras", JSON.stringify(next)); } catch { }
      await storage.set("vv_obras", JSON.stringify(next)).catch(() => { });
      setDb(d => ({ ...d, obras: next })); setObraEdit(null);
    })();
  }
  function crearObra(a) {
    const nueva = { id: uid() + Date.now(), nombre: a.nombre || a.obra || "Obra nueva", estado: a.estado || "En curso", avance: Number(a.avance) || 0, direccion: a.direccion || "", fotos: [], videos: [], planos: [], informes: [], tareas: [] };
    (async () => {
      let arr = []; try { const r = await storage.get("vv_obras"); if (r?.value) arr = JSON.parse(r.value); } catch { }
      const next = [nueva, ...arr];
      try { localStorage.setItem("vv_obras", JSON.stringify(next)); } catch { }
      await storage.set("vv_obras", JSON.stringify(next)).catch(() => { });
      setDb(d => ({ ...d, obras: next }));
    })();
    return nueva;
  }
  function cargarSDK() { return new Promise((resolve) => { if (window.XLSX) return resolve(window.XLSX); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = () => resolve(window.XLSX); s.onerror = () => resolve(null); document.head.appendChild(s); }); }
  async function exportarExcel() {
    const lista = (pagos || []).filter(p => !filtroObra || p.obra === filtroObra);
    if (!lista.length) { alert("No hay pagos para exportar."); return; }
    const filas = lista.map(p => ({ Fecha: p.fecha, Persona: p.persona, Obra: p.obra, Monto: p.monto, Estado: p.estado, Método: p.metodo, Nota: p.nota }));
    const XLSX = await cargarSDK();
    if (XLSX) {
      const ws = XLSX.utils.json_to_sheet(filas);
      ws["!cols"] = [{ wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 24 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Pagos");
      XLSX.writeFile(wb, `Pagos_${filtroObra || "todos"}_${hoyStr().replace(/\//g, "-")}.xlsx`);
    } else {
      const cab = ["Fecha", "Persona", "Obra", "Monto", "Estado", "Método", "Nota"];
      const csv = "\uFEFF" + [cab.join(";"), ...filas.map(f => cab.map(c => `"${String(f[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `Pagos_${hoyStr().replace(/\//g, "-")}.csv`; a.click();
    }
  }
  function cargarJsPDF() { return new Promise((resolve) => { if (window.jspdf) return resolve(window.jspdf); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload = () => resolve(window.jspdf); s.onerror = () => resolve(null); document.head.appendChild(s); }); }
  function cargarMammoth() { return new Promise((resolve) => { if (window.mammoth) return resolve(window.mammoth); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"; s.onload = () => resolve(window.mammoth); s.onerror = () => resolve(null); document.head.appendChild(s); }); }
  async function generarPDF(a) {
    const lib = await cargarJsPDF(); if (!lib) { alert("No pude cargar el generador de PDF (revisá internet)."); return null; }
    const { jsPDF } = lib; const doc = new jsPDF({ unit: "mm", format: "a4" }); const W = 210; const M = 16; let y = 18;
    const money = n => "$" + (Number(n) || 0).toLocaleString("es-AR");
    doc.setFillColor(15, 27, 45); doc.rect(0, 0, W, 26, "F");
    doc.setTextColor(176, 137, 79); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("V+V CONSTRUCCIONES", M, 14);
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(String(a.tipo_doc || "Documento").toUpperCase(), M, 20);
    doc.setTextColor(230, 230, 230); doc.setFontSize(8); doc.text(hoyStr(), W - M, 20, { align: "right" });
    y = 38; doc.setTextColor(15, 27, 45); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(a.titulo || "Documento", M, y); y += 8;
    doc.setDrawColor(176, 137, 79); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 8;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
    if (a.cliente) { doc.text(`Cliente: ${a.cliente}`, M, y); y += 6; }
    if (a.obra) { doc.text(`Obra: ${a.obra}`, M, y); y += 6; }
    if (a.texto) { const lines = doc.splitTextToSize(a.texto, W - 2 * M); doc.text(lines, M, y); y += lines.length * 5 + 4; }
    const items = a.items || [];
    if (items.length) {
      y += 2; doc.setFillColor(27, 58, 91); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.rect(M, y, W - 2 * M, 8, "F"); doc.text("Descripción", M + 2, y + 5.5); doc.text("Cant.", 120, y + 5.5); doc.text("P. Unit.", 145, y + 5.5); doc.text("Subtotal", W - M - 2, y + 5.5, { align: "right" }); y += 8;
      doc.setTextColor(40, 40, 40); doc.setFont("helvetica", "normal"); let total = 0;
      items.forEach((it, i) => {
        const cant = Number(it.cantidad) || 0, pu = Number(it.precio) || 0, sub = cant * pu; total += sub;
        if (i % 2) { doc.setFillColor(244, 247, 250); doc.rect(M, y, W - 2 * M, 7, "F"); }
        const dl = doc.splitTextToSize(`${it.desc || it.nombre || ""}`, 98);
        doc.text(dl[0] || "", M + 2, y + 5); doc.text(`${cant} ${it.unidad || ""}`, 120, y + 5); doc.text(money(pu), 145, y + 5); doc.text(money(sub), W - M - 2, y + 5, { align: "right" }); y += 7;
        if (y > 265) { doc.addPage(); y = 20; }
      });
      y += 2; doc.setDrawColor(180, 180, 180); doc.line(120, y, W - M, y); y += 6;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("TOTAL:", 130, y); doc.text(money(total), W - M - 2, y, { align: "right" }); y += 8;
    }
    if (a.pie) { y += 4; doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(90, 90, 90); const pl = doc.splitTextToSize(a.pie, W - 2 * M); doc.text(pl, M, y); }
    doc.save(`${String(a.titulo || "documento").replace(/[^\w\s-]/g, "").slice(0, 40)}_${hoyStr().replace(/\//g, "-")}.pdf`);
    return true;
  }
  async function subirModelo(e) {
    const f = e.target.files[0]; if (!f) return; e.target.value = "";
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (ext !== "docx") { alert("Subí el modelo en formato Word (.docx)."); return; }
    const mammoth = await cargarMammoth(); if (!mammoth) { alert("No pude procesar el Word (revisá internet)."); return; }
    try {
      const buf = await f.arrayBuffer(); const res = await mammoth.extractRawText({ arrayBuffer: buf });
      const texto = (res.value || "").slice(0, 4000);
      const nuevo = { id: uid() + Date.now(), nombre: f.name, texto, fecha: hoyStr() };
      const next = [nuevo, ...(modelos || [])];
      setModelos(next); setModeloSel(nuevo.id);
      await storage.set("nicolas_modelos", JSON.stringify(next)).catch(() => { });
      setMsgs(prev => [...prev, { role: "assistant", content: `📄 Guardé el modelo "${f.name}" en tu biblioteca. Quedó seleccionado. Cuando pidas un presupuesto, sigo ese formato. Podés guardar varios y elegir cuál usar en la solapa Modelos.` }]);
    } catch { alert("No pude leer el Word."); }
  }
  function getGPS() { return new Promise((resolve) => { if (!navigator.geolocation) return resolve(null); navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }); }); }
  async function comoLlego(destino) {
    const dest = String(destino || "").trim(); if (!dest) return;
    setMsgs(prev => [...prev, { role: "assistant", content: "Tomando tu ubicación… (aceptá el permiso de GPS si te lo pide)" }]);
    const pos = await getGPS();
    const mapsUrl = pos ? `https://www.google.com/maps/dir/?api=1&origin=${pos.lat},${pos.lng}&destination=${encodeURIComponent(dest)}&travelmode=driving` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
    if (!pos) { setMsgs(prev => [...prev, { role: "assistant", content: `No pude tomar tu ubicación (revisá el permiso de GPS del navegador). Igual te dejo la ruta hasta ${dest} para verla en el mapa:`, mapUrl: mapsUrl, mapLabel: `Cómo llegar a ${dest}` }]); return; }
    let est = "";
    try { est = await callAI([{ role: "user", content: `Estimá el tiempo APROXIMADO de viaje en auto desde las coordenadas ${pos.lat},${pos.lng} hasta "${dest}" (Argentina). Buscá la distancia/ruta en internet si hace falta. Respondé en 1-2 frases: distancia aprox y tiempo aprox en minutos, aclarando que es una estimación sin tráfico en vivo. Nada más.` }], "Sos un asistente que estima tiempos de viaje en Argentina. Breve y claro (vos).", apiKey, true); } catch { }
    if (!est || /error|no puedo|no dispong/i.test(est)) est = `Te dejo la ruta hasta ${dest}. Tocá el botón para ver el tiempo exacto con tráfico.`;
    setMsgs(prev => [...prev, { role: "assistant", content: `🚗 ${est}`, mapUrl: mapsUrl, mapLabel: "Ver ruta y tiempo real en Google Maps" }]);
  }
  async function preguntarIA(texto) {
    // Publica la consulta en el canal compartido; la IA de V+V la responde sola.
    let arr = []; try { const r = await storage.get("ia_dialogo"); if (r?.value) arr = JSON.parse(r.value); } catch { }
    const q = { id: uid() + Date.now(), from: "nicolas", texto, tipo: "q", answered: false, ts: Date.now(), fecha: hoyStr() };
    const next = [...arr, q]; try { localStorage.setItem("ia_dialogo", JSON.stringify(next)); } catch { } await storage.set("ia_dialogo", JSON.stringify(next)).catch(() => { });
    // Espera la respuesta (hasta ~30s).
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      let cur = []; try { const r = await storage.get("ia_dialogo"); if (r?.value) cur = JSON.parse(r.value); } catch { }
      const ans = cur.find(m => m.tipo === "a" && m.from === "vv" && (m.ts || 0) > q.ts);
      if (ans) return ans.texto;
    }
    return "La IA de V+V no respondió (puede estar sin crédito, o la respuesta automática apagada). Igual, puedo responderte yo con los datos que tengo.";
  }

  async function enviar() {
    const t = input.trim(); if ((!t && adjPend.length === 0) || busy) return;
    const adj = adjPend; setAdjPend([]);
    const nm = t ? [...msgs, { role: "user", content: t }] : [...msgs];
    setMsgs(nm); setInput(""); setBusy(true);
    const hist = nm.filter(m => m.role === "user" || m.role === "assistant").map(m => ({ role: m.role, content: m.content })).slice(-40);
    if (adj.length) {
      const textos = adj.filter(a => a.kind === "texto").map(a => a.texto).join("\n\n");
      const blocks = [{ type: "text", text: (t || "Analizá lo que te adjunté y decime lo que corresponda.") + (textos ? "\n\n" + textos : "") }];
      for (const a of adj) { if (a.kind === "image") blocks.push({ type: "image", source: { type: "base64", media_type: a.mediaType, data: a.data } }); else if (a.kind === "document") blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } }); }
      if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: blocks }; else hist.push({ role: "user", content: blocks });
    }
    const resp = await callAI(hist, buildSystem(), apiKey, useSearch);
    const { limpio, accion } = parseAccion(resp);
    let extra = {};
    if (accion && accion.tipo === "pagar_mp") {
      const per = (db.personal || []).find(x => (x.nombre || "").toLowerCase().includes(String(accion.para || "").toLowerCase()));
      const monto = Number(String(accion.monto).replace(/[^\d.-]/g, "")) || 0;
      const alias = accion.alias || per?.aliasmp || per?.alias || "";
      setMsgs(prev => [...prev, { role: "assistant", content: `💳 Pago preparado: ${accion.para || "—"}${monto ? ` · $${monto.toLocaleString("es-AR")}` : ""}.${alias ? `\nAlias/CVU: ${alias}` : ""}\n\nAbrí Mercado Pago y confirmá el pago vos (por seguridad, ninguna app puede pagar sola con tu plata).` }, { role: "assistant", content: "", mpUrl: "https://www.mercadopago.com.ar/", mpLabel: `Abrir Mercado Pago` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "mandar_mail") {
      const per = (db.personal || []).find(x => (x.nombre || "").toLowerCase().includes(String(accion.para || "").toLowerCase()));
      const email = accion.email || per?.email || "";
      const asunto = accion.asunto || ""; const cuerpo = accion.cuerpo || "";
      const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      setMsgs(prev => [...prev, { role: "assistant", content: `✉️ Mail listo para ${accion.para || email || "el contacto"}${email ? "" : " (al abrir, elegí el contacto en tu app de mail)"}:\nAsunto: ${asunto}\n\n${cuerpo}`, mailUrl: mailto, mailLabel: `Enviar mail${accion.para ? ` a ${accion.para}` : ""}` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "como_llego") { await comoLlego(accion.destino); setBusy(false); return; }
    if (accion && accion.tipo === "foto_a_obra") {
      const target = accion.obra ? (db.obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase())) : null;
      const fotos = (ultimasFotos || []).slice(0, accion.cantidad || 12);
      if (!target) { setMsgs(prev => [...prev, { role: "assistant", content: "No encontré esa obra. Decime el nombre exacto." }]); setBusy(false); return; }
      if (!fotos.length) { setMsgs(prev => [...prev, { role: "assistant", content: "No tengo fotos recién subidas para mandar. Subí la foto con 📎 y después decime a qué obra va." }]); setBusy(false); return; }
      let arr = []; try { const r = await storage.get("vv_obras"); if (r?.value) arr = JSON.parse(r.value); } catch { }
      const nuevas = fotos.map(f => ({ id: uid() + Date.now() + Math.random(), url: f.url, fecha: hoyStr(), from: "nicolas", nota: "" }));
      const next = arr.map(o => o.id === target.id ? { ...o, fotos: [...nuevas, ...(o.fotos || [])] } : o);
      try { localStorage.setItem("vv_obras", JSON.stringify(next)); } catch { } await storage.set("vv_obras", JSON.stringify(next)).catch(() => { });
      setDb(d => ({ ...d, obras: next })); setUltimasFotos([]);
      setMsgs(prev => [...prev, { role: "assistant", content: `📸 Subí ${nuevas.length === 1 ? "la foto" : nuevas.length + " fotos"} a la obra ${target.nombre}. Ya las ve V+V en las fotos de esa obra.${limpio ? "\n\n" + limpio : ""}` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "crear_obra") {
      const o = crearObra(accion);
      setMsgs(prev => [...prev, { role: "assistant", content: `🏗 Obra creada: ${o.nombre}${o.direccion ? ` · ${o.direccion}` : ""} (${o.estado}). Ya la ven V+V y todo el equipo.${limpio ? "\n\n" + limpio : ""}` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "recordar") {
      const nuevoPerfil = (perfil ? perfil + "\n" : "") + "· " + (accion.dato || "").trim();
      setPerfil(nuevoPerfil); try { localStorage.setItem("nicolas_perfil", nuevoPerfil); } catch { } storage.set("nicolas_perfil", nuevoPerfil).catch(() => { });
      setMsgs(prev => [...prev, { role: "assistant", content: limpio || `Anotado, me lo guardo 👍` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "agendar") {
      const ev = agendarEvento(accion);
      setMsgs(prev => [...prev, { role: "assistant", content: `📅 Agendado: ${ev.titulo} — ${ev.fecha}${ev.hora ? " " + ev.hora : ""}${ev.nota ? `\n${ev.nota}` : ""}.${limpio ? "\n\n" + limpio : ""}\n\nLo ves en la solapa Agenda.` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "generar_pdf") {
      setMsgs(prev => [...prev, { role: "assistant", content: limpio || `Generando el PDF "${accion.titulo || "documento"}"…` }]);
      const ok = await generarPDF(accion);
      if (ok) setMsgs(prev => [...prev, { role: "assistant", content: `✅ PDF generado y descargado: "${accion.titulo || "documento"}". Buscalo en tus Descargas.` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "cargar_gasto") {
      const g = cargarGasto(accion);
      setMsgs(prev => [...prev, { role: "assistant", content: `💸 Gasto cargado: ${g.concepto} · $${g.monto.toLocaleString("es-AR")} (${g.fecha}).${limpio ? "\n\n" + limpio : ""}\n\nLo ves en la solapa Gastos.` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "cargar_pago") {
      const p = cargarPago(accion);
      setMsgs(prev => [...prev, { role: "assistant", content: `✅ Pago cargado: ${p.persona || "—"}${p.monto ? ` · $${p.monto.toLocaleString("es-AR")}` : ""}${p.obra ? ` · ${p.obra}` : ""} · ${p.estado}${p.metodo ? ` · ${p.metodo}` : ""} (${p.fecha}).${limpio ? "\n\n" + limpio : ""}\n\nLo ves en la solapa Pagos y lo podés exportar a Excel.` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "whatsapp") {
      const q = String(accion.persona || "").toLowerCase();
      const fav = (contactos || []).find(c => (c.nombre || "").toLowerCase().includes(q) && (c.telefono || "").trim());
      const per = fav || (db.personal || []).find(x => (x.nombre || "").toLowerCase().includes(q) && (x.telefono || "").trim());
      const tel = per?.telefono; const clean = tel ? String(tel).replace(/\D/g, "") : ""; const num = clean ? (clean.startsWith("54") ? clean : "549" + clean) : "";
      const link = `https://wa.me/${num}?text=${encodeURIComponent(accion.texto || "")}`;
      if (num) { try { window.open(link, "_blank"); } catch { } }
      setMsgs(prev => [...prev, { role: "assistant", content: limpio || (num ? `Abriendo WhatsApp para ${accion.persona || "el contacto"}… si no se abrió solo, tocá el botón:` : `Preparé el WhatsApp, pero no encontré el teléfono de ${accion.persona || "el contacto"} en Favoritos ni en Personal. Tocá el botón y elegí el contacto:`), waLink: link, waLabel: num ? `Abrir WhatsApp de ${accion.persona || "contacto"}` : "Abrir WhatsApp" }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "preguntar_ia") {
      setMsgs(prev => [...prev, { role: "assistant", content: (limpio || "Consulto a la IA de V+V…") }]);
      const r = await preguntarIA(accion.texto);
      setMsgs(prev => [...prev, { role: "assistant", content: `🔗 IA de V+V: ${r}` }]);
      setBusy(false); return;
    }
    if (accion && (accion.tipo === "traer_fotos" || accion.tipo === "traer_plano")) {
      const target = accion.obra ? (db.obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase())) : (db.obras || [])[0];
      if (accion.tipo === "traer_fotos") {
        const tipo = accion.videos ? "videos" : "fotos";
        const media = ((target && target[tipo]) || []).slice(-Math.max(1, Math.min(accion.cantidad || 3, 12))).reverse().map(f => f.url || f).filter(Boolean);
        extra = { media, mediaTipo: tipo };
        if (!target) extra.note = "No encontré esa obra."; else if (!media.length) extra.note = `${target.nombre} no tiene ${tipo}.`;
      } else {
        const planos = (target && target.planos) || [];
        const kw = String(accion.buscar || "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const match = kw.length ? planos.filter(p => kw.some(w => (p.nombre || "").toLowerCase().includes(w))) : planos;
        extra = { docs: (match.length ? match : planos).map(p => ({ nombre: p.nombre, url: p.url })) };
        if (!target) extra.note = "No encontré esa obra."; else if (!planos.length) extra.note = `${target.nombre} no tiene planos.`;
      }
    }
    setMsgs(prev => [...prev, { role: "assistant", content: limpio || (extra.note || "Listo."), ...extra }]);
    setBusy(false);
  }

  if (!pinOk) {
    return (<div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))", fontFamily: T.sans }}>
      <div style={{ width: "100%", maxWidth: 380, background: T.card, borderRadius: 14, padding: "34px 28px", border: `1px solid ${T.border}`, boxShadow: "0 20px 50px -20px rgba(27,26,22,.25)" }}>
        <div style={{ width: 34, height: 1, background: BRASS, marginBottom: 18 }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: BRASS, letterSpacing: "0.22em", textTransform: "uppercase" }}>Privado · Nicolás</div>
        <div style={{ fontFamily: T.serif, fontSize: 27, fontWeight: 600, color: T.text, margin: "8px 0 8px" }}>Mi Asistente</div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 22, lineHeight: 1.5 }}>{pinNew ? "Definí un PIN. Solo lo sabés vos; te lo voy a pedir cada vez que entres." : "Ingresá tu PIN para continuar."}</div>
        <input value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, ""))} onKeyDown={e => { if (e.key === "Enter") entrar(); }} type="password" inputMode="numeric" placeholder="••••" autoFocus style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "14px", fontSize: 22, letterSpacing: "0.3em", textAlign: "center", color: T.text, marginBottom: 12, boxSizing: "border-box" }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.sub, marginBottom: 16, cursor: "pointer" }}><input type="checkbox" checked={trust} onChange={e => setTrust(e.target.checked)} /> No pedir el PIN en este dispositivo</label>
        <button onClick={entrar} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: T.rsm, padding: "14px", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer" }}>{pinNew ? "Crear PIN y entrar" : "Entrar"}</button>
      </div>
    </div>);
  }

  return (<div style={{ height: "100dvh", maxHeight: "100vh", background: cfg.fondoUrl ? `linear-gradient(${hexA(cfg.bg, 1 - (cfg.fondoOp || 14) / 100)}, ${hexA(cfg.bg, 1 - (cfg.fondoOp || 14) / 100)}), url(${cfg.fondoUrl}) center/cover fixed` : T.bg, display: "flex", flexDirection: "column", fontFamily: T.sans, color: T.text, maxWidth: 900, margin: "0 auto", overflowX: "hidden", width: "100%", boxShadow: "0 0 60px -30px rgba(27,26,22,.2)" }}>
    <div style={{ background: T.navy, color: "#fff", padding: "16px 18px 0", paddingTop: "max(16px, env(safe-area-inset-top))", borderBottom: `1px solid ${BRASS}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 9.5, fontWeight: 700, color: BRASS, letterSpacing: "0.22em", textTransform: "uppercase" }}>{cfg.eyebrow || "Privado"} · v20 · fix-nicolas</div><div style={{ fontFamily: cfg.serif ? T.serif : T.sans, fontSize: 22, fontWeight: 600, letterSpacing: "0.01em", marginTop: 2 }}>{cfg.titulo || "Mi Asistente"}</div></div>
        {vista === "chat" && <button onClick={() => setMsgs(msgs.slice(0, 1))} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.22)", color: "rgba(255,255,255,.85)", borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", cursor: "pointer" }}>Limpiar</button>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 2px", marginTop: 12, justifyContent: "center" }}>
        {[["chat", "Chat"], ["pagos", "Pagos"], ["gastos", "Gastos"], ["agenda", "Agenda"], ["archivos", "Archivos"], ["modelos", "Modelos"], ["obras", "Obras"], ["contactos", "Contactos"], ["camaras", "Cámaras"], ["ajustes", "Ajustes"]].map(([id, lb]) => { const cnt = id === "pagos" ? (pagos || []).length : id === "gastos" ? (gastos || []).length : id === "archivos" ? (archivos || []).length : id === "agenda" ? (agenda || []).length : id === "modelos" ? (modelos || []).length : id === "contactos" ? (contactos || []).length : id === "camaras" ? (camaras || []).length : 0; return <button key={id} onClick={() => setVista(id)} style={{ position: "relative", background: "none", border: "none", borderBottom: vista === id ? `2px solid ${BRASS}` : "2px solid transparent", color: vista === id ? "#fff" : "rgba(255,255,255,.55)", fontSize: 13, fontWeight: 700, padding: "9px 13px", cursor: "pointer", whiteSpace: "nowrap" }}>{id === "chat" && chatUnread > 0 && <span style={{ position: "absolute", top: 0, right: 2, background: "#EF4444", color: "#fff", borderRadius: 9, minWidth: 15, height: 15, fontSize: 8.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{chatUnread > 99 ? "99+" : chatUnread}</span>}{lb}{cnt ? ` ${cnt}` : ""}</button>; })}
      </div>
    </div>
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "hidden", zoom: (cfg.escala || 100) / 100 }}>
    {vista === "pagos" && <PagosBody pagos={pagos} obras={db.obras} filtroObra={filtroObra} setFiltroObra={setFiltroObra} exportar={exportarExcel} borrar={(id) => persistPagos((pagos || []).filter(p => p.id !== id))} />}
    {vista === "gastos" && <GastosBody gastos={gastos} onAdd={cargarGasto} exportar={exportarGastosExcel} borrar={(id) => persistGastos((gastos || []).filter(g => g.id !== id))} />}
    {vista === "contactos" && <ContactosBody contactos={contactos} onSave={persistContactos} />}
    {vista === "camaras" && <CamarasBody camaras={camaras} onSave={persistCamaras} />}
    {vista === "agenda" && <AgendaBody agenda={agenda} onAdd={agendarEvento} onDel={(id) => persistAgenda((agenda || []).filter(e => e.id !== id))} />}
    {vista === "archivos" && <ArchivosBody archivos={archivos} cat={catArch} setCat={setCatArch} archRef={archRef} subir={subirArchivos} subiendo={subiendoArch} borrar={(id) => persistArch((archivos || []).filter(a => a.id !== id))} />}
    {vista === "modelos" && <ModelosBody modelos={modelos} sel={modeloSel} setSel={setModeloSel} subir={() => modeloRef.current && modeloRef.current.click()} borrar={(id) => { const next = (modelos || []).filter(m => m.id !== id); setModelos(next); if (modeloSel === id) setModeloSel(next[0]?.id || ""); storage.set("nicolas_modelos", JSON.stringify(next)).catch(() => { }); }} />}
    {vista === "obras" && <ObrasBody obras={db.obras} obraEdit={obraEdit} setObraEdit={setObraEdit} guardar={guardarObra} onNueva={() => setObraEdit({ _new: true, nombre: "", estado: "En curso", avance: "", direccion: "" })} />}
    {vista === "ajustes" && <AjustesBody cfg={cfg} setC={setC} saveCfg={saveCfg} CFG_DEF={CFG_DEF} iconRef={iconRef} fondoRef={fondoRef} subirIcono={subirIcono} subirFondo={subirFondo} />}

    <div style={{ display: vista === "chat" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 16px 8px" }}>
      {msgs.map((m, i) => (<div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
        <div style={{ maxWidth: "88%", minWidth: 0 }}>
          <div style={{ background: m.role === "user" ? T.navy : T.card, color: m.role === "user" ? "#fff" : T.text, border: m.role === "user" ? "none" : `1px solid ${T.border}`, borderRadius: 14, padding: "11px 14px", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>{m.content}</div>
          {m.role === "assistant" && m.content && m.content.length > 8 && <button onClick={() => hablar(m.content)} title="Escuchar" style={{ marginTop: 4, background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", padding: "2px 0" }}>🔊 Escuchar</button>}
          {m.waLink && <a href={m.waLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, background: "#25D366", color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>📲 {m.waLabel || "Enviar por WhatsApp"}</a>}
          {m.mapUrl && <a href={m.mapUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, background: "#1A73E8", color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>🗺 {m.mapLabel || "Ver en Google Maps"}</a>}
          {m.mpUrl && <a href={m.mpUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, background: "#009EE3", color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>💳 {m.mpLabel || "Abrir Mercado Pago"}</a>}
          {m.mailUrl && <a href={m.mailUrl} style={{ display: "inline-block", marginTop: 8, background: "#EA4335", color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>✉️ {m.mailLabel || "Enviar mail"}</a>}
          {m.docs && m.docs.length > 0 && <div style={{ marginTop: 8 }}>{m.docs.map((d, j) => <a key={j} href={d.url} target="_blank" rel="noreferrer" download={d.nombre} style={{ display: "flex", alignItems: "center", gap: 9, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, textDecoration: "none" }}><span style={{ width: 30, height: 30, borderRadius: 7, background: T.al, color: T.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📐</span><span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{d.nombre}</span><span style={{ color: BRASS, fontWeight: 700, fontSize: 11.5 }}>Abrir ↗</span></a>)}</div>}
          {m.media && m.media.length > 0 && <div style={{ marginTop: 8 }}>{m.mediaTipo === "videos" ? m.media.map((u, j) => <video key={j} src={u} controls playsInline style={{ width: "100%", borderRadius: 10, marginBottom: 8, background: "#000" }} />) : <div style={{ display: "grid", gridTemplateColumns: m.media.length === 1 ? "1fr" : "1fr 1fr", gap: 6 }}>{m.media.map((u, j) => <a key={j} href={u} target="_blank" rel="noreferrer" download><img src={u} alt="" onLoad={scrollBottom} style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.border}`, display: "block" }} /></a>)}</div>}</div>}
        </div>
      </div>))}
      {busy && <div style={{ color: T.muted, fontSize: 13, padding: "4px 6px" }}>Pensando…</div>}
    </div>

    <div style={{ padding: "10px 14px 14px", paddingBottom: "max(14px, env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, background: T.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.sub, cursor: "pointer" }}><input type="checkbox" checked={useSearch} onChange={e => setUseSearch(e.target.checked)} /> Buscar en internet</label>
        <input ref={chatFileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.dwg,.dxf" multiple onChange={subirEnChat} style={{ display: "none" }} />
        <button onClick={() => chatFileRef.current && chatFileRef.current.click()} style={{ background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, padding: "4px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>📎 Foto / archivo</button>
        <input ref={modeloRef} type="file" accept=".docx" onChange={subirModelo} style={{ display: "none" }} />
        <button onClick={() => modeloRef.current && modeloRef.current.click()} style={{ background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, padding: "4px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>📄 Subir modelo</button>
        <button onClick={() => setVozOn(v => !v)} style={{ background: vozOn ? T.accent : "none", border: `1px solid ${vozOn ? T.accent : T.border}`, color: vozOn ? "#fff" : T.sub, borderRadius: 8, padding: "4px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>🔊 Voz {vozOn ? "activada" : ""}</button>
        {modelo && <span style={{ fontSize: 10.5, color: T.muted }}>Modelo activo: {modelo.nombre}</span>}
      </div>
      {adjPend.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{adjPend.map((a, i) => <span key={i} style={{ background: T.al, borderRadius: 7, padding: "5px 9px", fontSize: 11, color: T.accent, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>{a.kind === "image" ? "🖼" : a.kind === "texto" ? "📊" : "📄"} {a.nombre.slice(0, 22)} <span onClick={() => setAdjPend(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.muted }}>✕</span></span>)}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={dictar} title="Hablar" style={{ background: escuchando ? "#DC2626" : T.card, border: `1px solid ${escuchando ? "#DC2626" : T.border}`, color: escuchando ? "#fff" : T.accent, borderRadius: 12, padding: "0 15px", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>🎤</button>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") enviar(); }} placeholder={escuchando ? "Escuchando… hablá" : adjPend.length ? "Preguntá algo sobre lo que adjuntaste…" : "Escribí o tocá el micrófono…"} style={{ flex: 1, minWidth: 0, background: T.card, border: `1px solid ${escuchando ? "#DC2626" : T.border}`, borderRadius: 12, padding: "13px 15px", fontSize: 16, color: T.text }} />
        <button onClick={enviar} disabled={busy || (!input.trim() && adjPend.length === 0)} style={{ background: (busy || (!input.trim() && adjPend.length === 0)) ? T.border : T.accent, color: "#fff", border: "none", borderRadius: 12, padding: "0 20px", fontSize: 14, fontWeight: 600, letterSpacing: "0.03em", cursor: (busy || (!input.trim() && adjPend.length === 0)) ? "default" : "pointer" }}>Enviar</button>
      </div>
    </div>
    </div>
    </div>
  </div>);
}

function Icono({ n, size = 20 }) {
  const p = {
    chat: <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />,
    pagos: <React.Fragment><line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></React.Fragment>,
    gastos: <React.Fragment><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></React.Fragment>,
    agenda: <React.Fragment><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></React.Fragment>,
    archivos: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
    modelos: <React.Fragment><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></React.Fragment>,
    obras: <React.Fragment><line x1="3" y1="21" x2="21" y2="21" /><path d="M6 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16" /><path d="M14 21V10h3a1 1 0 0 1 1 1v10" /><line x1="9" y1="8" x2="10.5" y2="8" /><line x1="9" y1="12" x2="10.5" y2="12" /></React.Fragment>,
    ajustes: <React.Fragment><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></React.Fragment>,
    contactos: <React.Fragment><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></React.Fragment>,
    camaras: <React.Fragment><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></React.Fragment>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>{p[n] || null}</svg>;
}

function PagosBody({ pagos, obras, filtroObra, setFiltroObra, exportar, borrar }) {
  const lista = (pagos || []).filter(p => !filtroObra || p.obra === filtroObra).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const obrasUnicas = [...new Set((pagos || []).map(p => p.obra).filter(Boolean))];
  const totalPend = lista.filter(p => p.estado === "pendiente").reduce((a, p) => a + (p.monto || 0), 0);
  const totalPag = lista.filter(p => p.estado === "pagado").reduce((a, p) => a + (p.monto || 0), 0);
  return (<div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
    <a href="https://www.mercadopago.com.ar/" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#009EE3", color: "#fff", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, textDecoration: "none", marginBottom: 14, boxShadow: "0 2px 8px rgba(0,158,227,.3)" }}>💳 Pagar por Mercado Pago</a>
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 16, color: T.text }}>
        <option value="">Todas las obras</option>
        {obrasUnicas.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <button onClick={exportar} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: T.rsm, padding: "0 16px", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.03em", cursor: "pointer", whiteSpace: "nowrap" }}>Exportar Excel</button>
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em" }}>Pendiente</div><div style={{ fontFamily: T.serif, fontSize: 21, fontWeight: 600, color: "#9A6B1E", marginTop: 3 }}>${totalPend.toLocaleString("es-AR")}</div></div>
      <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em" }}>Pagado</div><div style={{ fontFamily: T.serif, fontSize: 21, fontWeight: 600, color: T.accent, marginTop: 3 }}>${totalPag.toLocaleString("es-AR")}</div></div>
    </div>
    {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "40px 18px", lineHeight: 1.6 }}>Todavía no cargaste pagos.<br />Desde el Chat, decime por ejemplo:<br /><span style={{ color: T.sub }}>"cargá un pago a Humberto en Castores 475 de 50000 en efectivo"</span></div>}
    {lista.map(p => (<div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `2px solid ${p.estado === "pagado" ? T.accent : "#B98A2E"}`, borderRadius: T.rsm, padding: "12px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.persona || "—"} · <span style={{ fontFamily: T.serif, fontWeight: 600 }}>${(p.monto || 0).toLocaleString("es-AR")}</span></div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>{p.obra || "sin obra"} · {p.fecha}{p.metodo ? ` · ${p.metodo}` : ""}{p.nota ? ` · ${p.nota}` : ""}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: p.estado === "pagado" ? T.accent : "#B98A2E", border: `1px solid ${p.estado === "pagado" ? T.accent : "#B98A2E"}`, borderRadius: 5, padding: "2px 7px" }}>{p.estado}</span>
          <button onClick={() => borrar(p.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer" }}>✕</button>
        </div>
      </div>
    </div>))}
  </div>);
}

function AgendaBody({ agenda, onAdd, onDel }) {
  const [f, setF] = useState({ fecha: "", hora: "", titulo: "", nota: "" });
  const lista = (agenda || []).slice().sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
  return (<div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 13, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 9 }}>Nuevo evento</div>
      <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
        <input value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} placeholder="Fecha (DD/MM/AA)" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 16, color: T.text }} />
        <input value={f.hora} onChange={e => setF({ ...f, hora: e.target.value })} placeholder="Hora" style={{ width: 78, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 16, color: T.text }} />
      </div>
      <input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Título (ej: Reunión con Belfast)" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 16, color: T.text, marginBottom: 8, boxSizing: "border-box" }} />
      <input value={f.nota} onChange={e => setF({ ...f, nota: e.target.value })} placeholder="Nota (opcional)" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 16, color: T.text, marginBottom: 10, boxSizing: "border-box" }} />
      <button onClick={() => { if (!f.titulo.trim()) { alert("Poné un título."); return; } onAdd({ ...f, fecha: f.fecha || hoyStr() }); setF({ fecha: "", hora: "", titulo: "", nota: "" }); }} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>＋ Agendar</button>
    </div>
    {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "30px 18px", lineHeight: 1.6 }}>Agenda vacía.<br />Desde el Chat podés decir: <span style={{ color: T.sub }}>"agendá reunión con Belfast el jueves a las 10"</span></div>}
    {lista.map(e => (<div key={e.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${BRASS}`, borderRadius: 10, padding: "11px 13px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: BRASS }}>{e.fecha}{e.hora ? ` · ${e.hora}` : ""}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 2 }}>{e.titulo}</div>
        {e.nota && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{e.nota}</div>}
      </div>
      <button onClick={() => onDel(e.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer" }}>✕</button>
    </div>))}
  </div>);
}

function ArchivosBody({ archivos, cat, setCat, archRef, subir, subiendo, borrar }) {
  const CATS = ["Presupuestos", "Contratos", "Comprobantes", "Planos", "Facturas", "Otros"];
  const usadas = [...new Set((archivos || []).map(a => a.categoria).filter(Boolean))];
  const all = [...CATS, ...usadas.filter(c => !CATS.includes(c))];
  const porCat = all.map(c => ({ c, items: (archivos || []).filter(a => a.categoria === c) })).filter(g => g.items.length);
  return (<div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
    <input ref={archRef} type="file" multiple onChange={subir} style={{ display: "none" }} />
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 13, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 9 }}>Subir archivo (Excel, PDF, Word, foto…)</div>
      <div style={{ display: "flex", gap: 7 }}>
        <select value={cat} onChange={e => { if (e.target.value === "__new__") { const n = prompt("Nombre de la carpeta:"); if (n && n.trim()) setCat(n.trim()); } else setCat(e.target.value); }} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 16, color: T.text }}>
          {all.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="__new__">＋ Nueva carpeta…</option>
        </select>
        <button onClick={() => archRef.current && archRef.current.click()} disabled={subiendo} style={{ background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 9, padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{subiendo ? "Subiendo…" : "＋ Subir"}</button>
      </div>
      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Se guardan en la carpeta “{cat}”. Solo los ves vos.</div>
    </div>
    {porCat.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "30px 18px" }}>Todavía no subiste archivos.</div>}
    {porCat.map(g => (<div key={g.c} style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{g.c} ({g.items.length})</div>
      {g.items.map(a => (<div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 7 }}>
        <span style={{ width: 34, height: 34, borderRadius: 8, background: T.al, color: T.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{a.ext || "•"}</span>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{a.nombre}</div><div style={{ fontSize: 10.5, color: T.muted }}>{a.fecha}</div></div>
        <a href={a.url} target="_blank" rel="noreferrer" download={a.nombre} style={{ color: BRASS, fontWeight: 700, fontSize: 12, textDecoration: "none", flexShrink: 0 }}>Abrir ↗</a>
        <button onClick={() => borrar(a.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>
      </div>))}
    </div>))}
  </div>);
}

function ObrasBody({ obras, obraEdit, setObraEdit, guardar, onNueva }) {
  return (<div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
    {obraEdit && obraEdit._new && <div style={{ background: T.card, border: `1px solid ${BRASS}`, borderRadius: 11, padding: "13px", marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Nueva obra</div>
      <input value={obraEdit.nombre || ""} onChange={e => setObraEdit({ ...obraEdit, nombre: e.target.value })} placeholder="Nombre de la obra" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text, marginBottom: 8, boxSizing: "border-box" }} />
      <input value={obraEdit.direccion || ""} onChange={e => setObraEdit({ ...obraEdit, direccion: e.target.value })} placeholder="Dirección (opcional)" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text, marginBottom: 8, boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
        <input value={obraEdit.estado || ""} onChange={e => setObraEdit({ ...obraEdit, estado: e.target.value })} placeholder="Estado" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text }} />
        <input value={obraEdit.avance != null ? obraEdit.avance : ""} onChange={e => setObraEdit({ ...obraEdit, avance: e.target.value })} placeholder="Avance %" type="number" style={{ width: 100, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text }} />
      </div>
      <div style={{ display: "flex", gap: 7 }}>
        <button onClick={() => setObraEdit(null)} style={{ flex: 1, background: "none", color: T.sub, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
        <button onClick={guardar} style={{ flex: 1.4, background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Crear obra</button>
      </div>
    </div>}
    {!(obraEdit && obraEdit._new) && <button onClick={onNueva} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 11, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>＋ Cargar nueva obra</button>}
    {(obras || []).length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "30px 18px" }}>No hay obras cargadas.</div>}
    {(obras || []).map(o => (<div key={o.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 11, padding: "13px", marginBottom: 9 }}>
      {obraEdit && obraEdit.id === o.id ? (<div>
        <input value={obraEdit.nombre || ""} onChange={e => setObraEdit({ ...obraEdit, nombre: e.target.value })} placeholder="Nombre" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 16, color: T.text, marginBottom: 8, boxSizing: "border-box" }} />
        <input value={obraEdit.direccion || ""} onChange={e => setObraEdit({ ...obraEdit, direccion: e.target.value })} placeholder="Dirección" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 16, color: T.text, marginBottom: 8, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
          <input value={obraEdit.estado || ""} onChange={e => setObraEdit({ ...obraEdit, estado: e.target.value })} placeholder="Estado" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 16, color: T.text }} />
          <input value={obraEdit.avance != null ? obraEdit.avance : ""} onChange={e => setObraEdit({ ...obraEdit, avance: e.target.value })} placeholder="Avance %" type="number" style={{ width: 90, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 16, color: T.text }} />
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <button onClick={() => setObraEdit(null)} style={{ flex: 1, background: "none", color: T.sub, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button onClick={guardar} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Guardar</button>
        </div>
      </div>) : (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>{o.nombre}</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{o.estado || "sin estado"}{o.avance != null ? ` · ${o.avance}% avance` : ""}{o.direccion ? ` · ${o.direccion}` : ""}</div>
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{(o.fotos || []).length} fotos · {(o.planos || []).length} planos · {(o.informes || []).length} informes</div>
        </div>
        <button onClick={() => setObraEdit({ id: o.id, nombre: o.nombre, estado: o.estado || "", avance: o.avance != null ? o.avance : "", direccion: o.direccion || "" })} style={{ background: T.al, color: T.navy, border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Editar</button>
      </div>)}
    </div>))}
    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>⚠ Los cambios en obras se sincronizan con la app de V+V (los ve tu equipo).</div>
  </div>);
}

function ModelosBody({ modelos, sel, setSel, subir, borrar }) {
  return (<div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
    <button onClick={subir} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 11, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>＋ Subir modelo de Word (.docx)</button>
    {(modelos || []).length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "30px 18px", lineHeight: 1.6 }}>No tenés modelos guardados.<br />Subí tus modelos de presupuesto (Word) y elegí cuál usar. Cuando pidas un presupuesto, sigo el que esté seleccionado.</div>}
    {(modelos || []).map(m => (<div key={m.id} onClick={() => setSel(m.id)} style={{ background: T.card, border: `1px solid ${sel === m.id ? BRASS : T.border}`, borderLeft: `3px solid ${sel === m.id ? BRASS : T.border}`, borderRadius: 10, padding: "12px 13px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>📄 {m.nombre}</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Guardado {m.fecha}{sel === m.id ? " · ✓ En uso" : ""}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {sel === m.id ? <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: BRASS, borderRadius: 5, padding: "3px 8px" }}>EN USO</span> : <span style={{ fontSize: 11, fontWeight: 700, color: T.sub }}>Usar</span>}
        <button onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar este modelo?")) borrar(m.id); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer" }}>✕</button>
      </div>
    </div>))}
  </div>);
}

function AjustesBody({ cfg, setC, saveCfg, CFG_DEF, iconRef, fondoRef, subirIcono, subirFondo }) {
  const PRESETS = [
    { n: "Oficina", accent: "#22463A", navy: "#1B1A16", bg: "#F4F2EC", card: "#FFFFFF", text: "#1A1813" },
    { n: "Grafito", accent: "#B08D57", navy: "#141414", bg: "#1B1B1D", card: "#232326", text: "#ECEAE4" },
    { n: "Borgoña", accent: "#7A2E3A", navy: "#201314", bg: "#F5F0EE", card: "#FFFFFF", text: "#1E1517" },
    { n: "Azul noche", accent: "#2E5A86", navy: "#0F1B2D", bg: "#EEF2F6", card: "#FFFFFF", text: "#14202E" },
    { n: "Arena", accent: "#9A6B3F", navy: "#2A2118", bg: "#F7F2E9", card: "#FFFFFF", text: "#241C12" },
  ];
  const Row = ({ label, hint, children }) => (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
    <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{label}</div>{hint && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{hint}</div>}</div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>);
  const Color = ({ k }) => (<input type="color" value={cfg[k]} onChange={e => setC(k, e.target.value)} style={{ width: 40, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: "none", cursor: "pointer", padding: 0 }} />);
  const Sec = ({ t }) => (<div style={{ fontSize: 10.5, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: "0.12em", margin: "18px 0 2px" }}>{t}</div>);
  return (<div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 30px" }}>
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px", margin: "6px 0 6px" }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, marginBottom: 3 }}>Actualizar la app</div>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 11, lineHeight: 1.45 }}>Trae la última versión con los cambios nuevos, sin borrar ni reinstalar nada.</div>
      <button onClick={async () => { try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch { } window.location.replace(window.location.pathname + "?v=" + Date.now()); }} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>🔄 Actualizar a la última versión</button>
    </div>
    <Sec t="Estilos rápidos" />
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 4px" }}>
      {PRESETS.map(p => <button key={p.n} onClick={() => saveCfg({ ...cfg, accent: p.accent, navy: p.navy, bg: p.bg, card: p.card, text: p.text })} style={{ display: "flex", alignItems: "center", gap: 7, background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: "6px 12px 6px 8px", cursor: "pointer" }}>
        <span style={{ display: "flex" }}><span style={{ width: 14, height: 14, borderRadius: "50%", background: p.navy, border: "1px solid rgba(0,0,0,.1)" }} /><span style={{ width: 14, height: 14, borderRadius: "50%", background: p.accent, marginLeft: -5, border: "1px solid rgba(0,0,0,.1)" }} /><span style={{ width: 14, height: 14, borderRadius: "50%", background: p.bg, marginLeft: -5, border: "1px solid rgba(0,0,0,.12)" }} /></span>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{p.n}</span>
      </button>)}
    </div>

    <Sec t="Identidad" />
    <Row label="Título"><input value={cfg.titulo} onChange={e => setC("titulo", e.target.value)} style={{ width: 150, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 16, color: T.text }} /></Row>
    <Row label="Subtítulo"><input value={cfg.eyebrow} onChange={e => setC("eyebrow", e.target.value)} style={{ width: 150, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 16, color: T.text }} /></Row>

    <Sec t="Tipografía" />
    <Row label="Títulos con serif" hint="Estilo clásico/gerencial en los títulos"><button onClick={() => setC("serif", !cfg.serif)} style={{ width: 44, height: 26, borderRadius: 13, background: cfg.serif ? T.accent : T.border, border: "none", position: "relative", cursor: "pointer" }}><span style={{ position: "absolute", top: 3, left: cfg.serif ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} /></button></Row>
    <Row label={`Tamaño de letra · ${cfg.escala || 100}%`}><input type="range" min="85" max="130" value={cfg.escala || 100} onChange={e => setC("escala", Number(e.target.value))} style={{ width: 140 }} /></Row>

    <Sec t="Colores" />
    <Row label="Acento (botones)"><Color k="accent" /></Row>
    <Row label="Encabezado"><Color k="navy" /></Row>
    <Row label="Fondo"><Color k="bg" /></Row>
    <Row label="Tarjetas"><Color k="card" /></Row>
    <Row label="Texto"><Color k="text" /></Row>

    <Sec t="Foto de fondo" />
    <input ref={fondoRef} type="file" accept="image/*" onChange={subirFondo} style={{ display: "none" }} />
    <Row label="Imagen de fondo" hint={cfg.fondoUrl ? "Cargada" : "Ninguna"}>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => fondoRef.current && fondoRef.current.click()} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.fondoUrl ? "Cambiar" : "Subir"}</button>
        {cfg.fondoUrl && <button onClick={() => setC("fondoUrl", "")} style={{ background: "none", color: T.sub, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Quitar</button>}
      </div>
    </Row>
    {cfg.fondoUrl && <Row label={`Intensidad de la foto · ${cfg.fondoOp || 14}%`}><input type="range" min="4" max="60" value={cfg.fondoOp || 14} onChange={e => setC("fondoOp", Number(e.target.value))} style={{ width: 140 }} /></Row>}

    <Sec t="Ícono en el celular" />
    <input ref={iconRef} type="file" accept="image/*" onChange={subirIcono} style={{ display: "none" }} />
    <Row label="Ícono de la app" hint="El que queda al 'Agregar a pantalla de inicio'">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {cfg.iconoUrl ? <img src={cfg.iconoUrl} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover", border: `1px solid ${T.border}` }} /> : <div style={{ width: 34, height: 34, borderRadius: 8, background: T.navy, color: BRASS, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.serif, fontWeight: 700 }}>S</div>}
        <button onClick={() => iconRef.current && iconRef.current.click()} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cfg.iconoUrl ? "Cambiar" : "Subir"}</button>
      </div>
    </Row>
    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>Para que tome el ícono nuevo en iPhone/iPad: subilo acá, después en Safari tocá Compartir → “Agregar a pantalla de inicio”. Usá una imagen cuadrada (ideal 512×512).</div>

    <button onClick={() => { if (confirm("¿Volver al estilo original?")) saveCfg({ ...CFG_DEF, iconoUrl: cfg.iconoUrl }); }} style={{ width: "100%", marginTop: 22, background: "none", color: T.sub, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Restablecer estilo original</button>
  </div>);
}

function GastosBody({ gastos, onAdd, exportar, borrar }) {
  const [f, setF] = React.useState({ concepto: "", monto: "" });
  const lista = (gastos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const hoy = hoyStr(); const mes = hoy.slice(3);
  const totDia = lista.filter(g => g.fecha === hoy).reduce((a, g) => a + (g.monto || 0), 0);
  const totMes = lista.filter(g => (g.fecha || "").slice(3) === mes).reduce((a, g) => a + (g.monto || 0), 0);
  return (<div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
    <a href="https://www.mercadopago.com.ar/" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#009EE3", color: "#fff", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, textDecoration: "none", marginBottom: 14, boxShadow: "0 2px 8px rgba(0,158,227,.3)" }}>💳 Pagar por Mercado Pago</a>
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 13, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 9 }}>Nuevo gasto</div>
      <input value={f.concepto} onChange={e => setF({ ...f, concepto: e.target.value })} placeholder="Concepto (nafta, comida, ferretería…)" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text, marginBottom: 8, boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 7 }}>
        <input value={f.monto} onChange={e => setF({ ...f, monto: e.target.value })} placeholder="Monto" inputMode="numeric" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text }} />
        <button onClick={() => { if (!f.concepto.trim() || !f.monto) { alert("Poné concepto y monto."); return; } onAdd({ concepto: f.concepto, monto: f.monto }); setF({ concepto: "", monto: "" }); }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "0 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>＋</button>
      </div>
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
      <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em" }}>Hoy</div><div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: T.text, marginTop: 3 }}>${totDia.toLocaleString("es-AR")}</div></div>
      <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em" }}>Este mes</div><div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: T.accent, marginTop: 3 }}>${totMes.toLocaleString("es-AR")}</div></div>
    </div>
    <button onClick={exportar} style={{ width: "100%", background: "none", color: T.accent, border: `1px solid ${T.accent}`, borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>Exportar Excel</button>
    {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "26px 18px", lineHeight: 1.6 }}>Sin gastos.<br />Desde el Chat: <span style={{ color: T.sub }}>"cargá un gasto de nafta de 15000"</span></div>}
    {lista.map(g => (<div key={g.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{g.concepto} · <span style={{ fontFamily: T.serif, fontWeight: 600 }}>${(g.monto || 0).toLocaleString("es-AR")}</span></div><div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>{g.fecha}</div></div>
      <button onClick={() => borrar(g.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>
    </div>))}
  </div>);
}

function ContactosBody({ contactos, onSave }) {
  const [form, setForm] = React.useState(null);
  const lista = (contactos || []).slice().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  function guardar() { if (!form.nombre?.trim()) { alert("Poné al menos el nombre."); return; } const arr = form.id ? lista.map(c => c.id === form.id ? form : c) : [...lista, { ...form, id: uid() + Date.now() }]; onSave(arr); setForm(null); }
  function borrar(id) { if (confirm("¿Borrar este contacto?")) onSave(lista.filter(c => c.id !== id)); }
  const waLink = (c) => { const clean = String(c.telefono || "").replace(/\D/g, ""); const num = clean.startsWith("54") ? clean : "549" + clean; return `https://wa.me/${num}`; };
  return (<div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
    {!form && <button onClick={() => setForm({ nombre: "", telefono: "", email: "", alias: "", nota: "" })} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 11, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>＋ Nuevo contacto favorito</button>}
    {form && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 13, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 9 }}>{form.id ? "Editar contacto" : "Nuevo contacto"}</div>
      {[["nombre", "Nombre y apellido"], ["telefono", "WhatsApp (ej: 1145678900)"], ["email", "Email (opcional)"], ["alias", "Alias/CVU Mercado Pago (opcional)"], ["nota", "Nota (ej: proveedor de hierro)"]].map(([k, ph]) => <input key={k} value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={ph} inputMode={k === "telefono" ? "tel" : "text"} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text, marginBottom: 8, boxSizing: "border-box" }} />)}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setForm(null)} style={{ flex: 1, background: "none", color: T.sub, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
        <button onClick={guardar} style={{ flex: 2, background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Guardar</button>
      </div>
    </div>}
    {lista.length === 0 && !form && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "26px 18px", lineHeight: 1.6 }}>Sin contactos favoritos.<br />Cargalos y después decime: <span style={{ color: T.sub }}>"mandale un WhatsApp a Enrico"</span>.</div>}
    {lista.map(c => (<div key={c.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{c.nombre}</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2, lineHeight: 1.5 }}>{c.telefono ? `📲 ${c.telefono}` : ""}{c.email ? `${c.telefono ? " · " : ""}✉️ ${c.email}` : ""}{c.alias ? ` · 💳 ${c.alias}` : ""}{c.nota ? <div style={{ color: T.muted }}>{c.nota}</div> : null}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {c.telefono && <a href={waLink(c)} target="_blank" rel="noreferrer" style={{ background: "#25D366", color: "#fff", borderRadius: 8, padding: "6px 9px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>WA</a>}
          <button onClick={() => setForm(c)} style={{ background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, padding: "6px 9px", fontSize: 12, cursor: "pointer" }}>✎</button>
          <button onClick={() => borrar(c.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer" }}>✕</button>
        </div>
      </div>
    </div>))}
  </div>);
}

function CamaraMini({ cam }) {
  const [tick, setTick] = React.useState(0);
  const [err, setErr] = React.useState(false);
  React.useEffect(() => { setErr(false); if (cam.tipo !== "snapshot") return; const iv = setInterval(() => setTick(t => t + 1), 5000); return () => clearInterval(iv); }, [cam.tipo, cam.url]);
  const src = cam.tipo === "snapshot" ? (cam.url + (cam.url.includes("?") ? "&" : "?") + "_t=" + tick) : cam.url;
  return (<div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: "#12100C" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>● {cam.nombre || "Cámara"}</div>
      {cam.url && <a href={cam.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#fff", opacity: .75, textDecoration: "none" }}>Abrir ↗</a>}
    </div>
    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#0a0f17" }}>
      {cam.tipo === "iframe" ? <iframe src={cam.url} title={cam.nombre} style={{ width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen" />
        : cam.tipo === "hls" ? <video src={cam.url} controls playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }} onError={() => setErr(true)} />
          : cam.url ? <img src={src} alt={cam.nombre} style={{ width: "100%", height: "100%", objectFit: "cover", display: err ? "none" : "block" }} onError={() => setErr(true)} onLoad={() => setErr(false)} /> : null}
      {(err || !cam.url) && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.6)", fontSize: 11.5, textAlign: "center", padding: 16, gap: 6 }}><div style={{ fontSize: 22 }}>📹</div><div>No se pudo mostrar la cámara acá.<br />Tocá "Abrir ↗" para verla, o revisá la URL en la app de V+V.</div></div>}
    </div>
  </div>);
}

function CamarasBody({ camaras, onSave }) {
  const lista = camaras || [];
  const [form, setForm] = React.useState(null);
  function guardar() { if (!form.nombre?.trim() || !form.url?.trim()) { alert("Poné un nombre y la URL de la cámara."); return; } const arr = form.id ? lista.map(c => c.id === form.id ? form : c) : [...lista, { ...form, id: uid() + Date.now() }]; onSave(arr); setForm(null); }
  function borrar(id) { if (confirm("¿Borrar esta cámara?")) onSave(lista.filter(c => c.id !== id)); }
  return (<div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
    {!form && <button onClick={() => setForm({ nombre: "", url: "", tipo: "snapshot" })} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 11, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>＋ Agregar cámara</button>}
    {form && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 13, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 9 }}>{form.id ? "Editar cámara" : "Nueva cámara"}</div>
      <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre (ej: Castores - Frente)" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text, marginBottom: 8, boxSizing: "border-box" }} />
      <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="URL del stream o embed (https://…)" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text, marginBottom: 8, boxSizing: "border-box" }} />
      <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 16, color: T.text, marginBottom: 10 }}>
        <option value="snapshot">Foto que se refresca (JPG/snapshot)</option>
        <option value="hls">Video en vivo (HLS .m3u8)</option>
        <option value="iframe">Página / embed web (iframe)</option>
        <option value="mjpeg">MJPEG</option>
      </select>
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, marginBottom: 10 }}>Necesitás una URL web de la cámara (snapshot JPG, HLS .m3u8 o embed). Las que solo andan por RTSP o por la app del fabricante no se pueden mostrar acá.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setForm(null)} style={{ flex: 1, background: "none", color: T.sub, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
        <button onClick={guardar} style={{ flex: 2, background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Guardar</button>
      </div>
    </div>}
    {lista.length === 0 && !form && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "26px 18px", lineHeight: 1.7 }}>No hay cámaras todavía.<br />Tocá "＋ Agregar cámara" y pegá la URL del stream.</div>}
    {lista.map(c => <div key={c.id} style={{ position: "relative" }}><CamaraMini cam={c} /><div style={{ position: "absolute", top: 8, right: 10, display: "flex", gap: 6 }}><button onClick={() => setForm(c)} style={{ background: "rgba(0,0,0,.5)", border: "none", color: "#fff", borderRadius: 7, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✎</button><button onClick={() => borrar(c.id)} style={{ background: "rgba(0,0,0,.5)", border: "none", color: "#fff", borderRadius: 7, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button></div></div>)}
  </div>);
}
