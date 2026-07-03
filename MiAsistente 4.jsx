import React, { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════════
// MI ASISTENTE — Asistente personal privado de Sebastián.
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
    const path = `sebastian/${Date.now()}_${(nombre || "archivo").replace(/[^\w.\-]+/g, "_")}`;
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

export default function MiAsistente() {
  const [pinOk, setPinOk] = useState(false);
  const [pinStored, setPinStored] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinNew, setPinNew] = useState(false);
  const [trust, setTrust] = useState(true);
  const [db, setDb] = useState({ obras: [], personal: [], pedidos: [], matpedidos: [], mensajes: [], formularios: [], documentacion: [] });
  const [pagos, setPagos] = useState([]);
  const [perfil, setPerfil] = useState("");
  const chatWrite = useRef(0);
  const [archivos, setArchivos] = useState([]);
  const [ultimasFotos, setUltimasFotos] = useState([]);
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
  const CFG_DEF = { titulo: "Mi Asistente", eyebrow: "Privado · Sebastián", accent: "#22463A", navy: "#1B1A16", bg: "#F4F2EC", card: "#FFFFFF", text: "#1A1813", fondoUrl: "", fondoOp: 14, serif: true, escala: 100, iconoUrl: "", iconoColor: "#22463A" };
  const [cfg, setCfg] = useState(() => { try { return { ...CFG_DEF, ...JSON.parse(localStorage.getItem("sebastian_cfg") || "{}") }; } catch { return CFG_DEF; } });
  const iconRef = useRef(null); const fondoRef = useRef(null);
  // Aplica la personalización al tema (colores) en vivo.
  T.accent = cfg.accent || "#22463A"; T.navy = cfg.navy || "#1B1A16"; T.bg = cfg.bg || "#F4F2EC"; T.card = cfg.card || "#FFFFFF"; T.text = cfg.text || "#1A1813";
  function saveCfg(next) { setCfg(next); try { localStorage.setItem("sebastian_cfg", JSON.stringify(next)); } catch { } storage.set("sebastian_cfg", JSON.stringify(next)).catch(() => { }); }
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
  const [filtroObra, setFiltroObra] = useState("");
  const pagosWrite = useRef(0);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hola Sebastián 👋 Soy tu asistente personal. Tengo acceso a todos los datos de V+V. Preguntame lo que quieras: un DNI, el estado de una obra, la última foto de Castores, un plano, o pedime que le consulte algo a la IA de V+V." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const apiKey = "";
  const scrollRef = useRef(null);
  const iaWait = useRef(null);

  useEffect(() => { (async () => { const r = await storage.get("miasistente_pin"); if (r?.value) { setPinStored(r.value); try { if (localStorage.getItem("miasistente_trust") === "1") { setPinOk(true); return; } } catch { } } else setPinNew(true); })(); }, []);

  useEffect(() => {
    if (!pinOk) return;
    let alive = true;
    async function pull() {
      const keys = ["vv_obras", "vv_personal", "vv_pedidos", "vv_matpedidos", "vv_mensajes", "vv_formularios", "vv_documentacion"];
      const res = await Promise.all(keys.map(k => storage.get(k)));
      if (!alive) return;
      const parse = (r) => { try { return r?.value ? JSON.parse(r.value) : []; } catch { return []; } };
      setDb({ obras: parse(res[0]), personal: parse(res[1]), pedidos: parse(res[2]), matpedidos: parse(res[3]), mensajes: parse(res[4]), formularios: parse(res[5]), documentacion: parse(res[6]) });
      if (Date.now() - pagosWrite.current > 4000) { const rp = await storage.get("sebastian_pagos"); if (!alive) return; const pg = parse(rp); setPagos(prev => JSON.stringify(pg) !== JSON.stringify(prev) ? pg : prev); }
      const [ra, rag] = await Promise.all([storage.get("sebastian_archivos"), storage.get("sebastian_agenda")]);
      if (alive) { const av = parse(ra); setArchivos(prev => JSON.stringify(av) !== JSON.stringify(prev) ? av : prev); const ag = parse(rag); setAgenda(prev => JSON.stringify(ag) !== JSON.stringify(prev) ? ag : prev); }
      if (!modelos.length) { const rmod = await storage.get("sebastian_modelos"); if (alive && rmod?.value) { try { const arr = JSON.parse(rmod.value); setModelos(arr); if (arr.length && !modeloSel) setModeloSel(arr[0].id); } catch { } } }
      const rc = await storage.get("sebastian_cfg"); if (alive && rc?.value) { try { const c = JSON.parse(rc.value); setCfg(prev => JSON.stringify({ ...CFG_DEF, ...c }) !== JSON.stringify(prev) ? { ...CFG_DEF, ...c } : prev); } catch { } }
    }
    pull(); const iv = setInterval(pull, 8000); return () => { alive = false; clearInterval(iv); };
  }, [pinOk]);

  const scrollBottom = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
  useEffect(() => { requestAnimationFrame(scrollBottom); const t = setTimeout(scrollBottom, 120); return () => clearTimeout(t); }, [msgs, busy, vista]);
  useEffect(() => {
    const h = () => { if (document.visibilityState === "visible") requestAnimationFrame(scrollBottom); };
    document.addEventListener("visibilitychange", h); window.addEventListener("focus", h); window.addEventListener("pageshow", h);
    return () => { document.removeEventListener("visibilitychange", h); window.removeEventListener("focus", h); window.removeEventListener("pageshow", h); };
  }, []);

  // Memoria persistente: carga el historial del chat y el perfil al abrir.
  useEffect(() => {
    if (!pinOk) return;
    (async () => {
      try { const r = await storage.get("sebastian_chat"); if (r?.value) { const arr = JSON.parse(r.value); if (Array.isArray(arr) && arr.length) setMsgs(arr); } } catch { }
      try { const rp = await storage.get("sebastian_perfil"); if (rp?.value) setPerfil(rp.value); } catch { }
    })();
  }, [pinOk]);
  // Guarda el historial del chat cada vez que cambia (así no se pierde al cerrar).
  useEffect(() => {
    if (!pinOk) return;
    const t = setTimeout(() => { try { localStorage.setItem("sebastian_chat", JSON.stringify(msgs.slice(-120))); } catch { } storage.set("sebastian_chat", JSON.stringify(msgs.slice(-120))).catch(() => { }); }, 700);
    return () => clearTimeout(t);
  }, [msgs, pinOk]);

  // Recordatorio: avisa en el chat por los eventos de mañana (un día antes).
  useEffect(() => {
    if (!pinOk) return;
    function parseFecha(f) { const p = String(f || "").split("/"); if (p.length < 3) return null; let [d, m, y] = p.map(n => parseInt(n, 10)); if (y < 100) y += 2000; if (!d || !m || !y) return null; return new Date(y, m - 1, d); }
    async function chequear() {
      const man = new Date(); man.setDate(man.getDate() + 1); man.setHours(0, 0, 0, 0);
      let arr = []; try { const r = await storage.get("sebastian_agenda"); if (r?.value) arr = JSON.parse(r.value); } catch { }
      const paraAvisar = arr.filter(e => { const fe = parseFecha(e.fecha); return fe && fe.getFullYear() === man.getFullYear() && fe.getMonth() === man.getMonth() && fe.getDate() === man.getDate() && !e.recordado; });
      if (!paraAvisar.length) return;
      setMsgs(prev => [...prev, ...paraAvisar.map(e => ({ role: "assistant", content: `🔔 Recordatorio: MAÑANA (${e.fecha}${e.hora ? " " + e.hora : ""}) tenés → ${e.titulo}${e.nota ? `\n${e.nota}` : ""}` }))]);
      try { if ("setAppBadge" in navigator) navigator.setAppBadge(paraAvisar.length); } catch { }
      const next = arr.map(e => paraAvisar.some(x => x.id === e.id) ? { ...e, recordado: true } : e);
      setAgenda(next); try { localStorage.setItem("sebastian_agenda", JSON.stringify(next)); } catch { } await storage.set("sebastian_agenda", JSON.stringify(next)).catch(() => { });
    }
    const t = setTimeout(chequear, 3000); const iv = setInterval(chequear, 60 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [pinOk]);

  function entrar() {
    try { localStorage.setItem("miasistente_trust", trust ? "1" : "0"); } catch { }
    if (pinNew) { const p = pinInput.trim(); if (p.length < 4) { alert("El PIN tiene que tener al menos 4 dígitos."); return; } storage.set("miasistente_pin", p); setPinStored(p); setPinNew(false); setPinOk(true); setPinInput(""); return; }
    if (pinInput === pinStored) { setPinOk(true); setPinInput(""); } else { alert("PIN incorrecto."); setPinInput(""); }
  }

  function buildSystem() {
    const o = db.obras || [];
    const obrasTxt = o.map(x => `· ${x.nombre}${x.estado ? ` (${x.estado})` : ""}${x.avance != null ? ` — avance ${x.avance}%` : ""} — ${(x.fotos || []).length} fotos, ${(x.videos || []).length} videos, ${(x.planos || []).length} planos, ${(x.informes || []).length} informes`).join("\n") || "(sin obras)";
    const planosTxt = o.map(x => (x.planos || []).length ? `· ${x.nombre}: ${(x.planos || []).map(p => p.nombre).join(", ")}` : null).filter(Boolean).join("\n") || "(sin planos)";
    const per = (db.personal || []).map(p => `· ${p.nombre} — ${p.rol || ""} (${obraNom(o, p.obra_id)})${p.empresa ? ` [${p.empresa}]` : ""}${p.telefono ? ` · tel ${p.telefono}` : ""}${p.dni ? ` · DNI ${p.dni}` : ""}${p.cuil ? ` · CUIL ${p.cuil}` : ""}`).join("\n") || "(sin personal)";
    const peds = (db.pedidos || []).map(p => `· [${p.estado || "abierto"}] ${p.asunto} (de ${p.de} → ${p.para})`).join("\n") || "(sin pedidos)";
    const mats = (db.matpedidos || []).map(p => `· ${obraNom(o, p.obra_id)} (${p.de === "vv" ? "V+V" : p.de === "cliente" ? "Belfast" : p.empresa || "contratista"}): ${(p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ")}${p.leido ? " ✓levantado" : " ●pendiente"}`).join("\n") || "(sin pedidos de materiales)";
    const pg = (pagos || []).slice(0, 40).map(p => `· ${p.fecha} — ${p.persona} $${(p.monto || 0).toLocaleString("es-AR")} (${p.obra || "sin obra"}) [${p.estado}${p.metodo ? ", " + p.metodo : ""}]`).join("\n") || "(sin pagos cargados)";
    const totalPend = (pagos || []).filter(p => p.estado === "pendiente").reduce((a, p) => a + (p.monto || 0), 0);
    const ag = (agenda || []).slice(0, 30).map(e => `· ${e.fecha}${e.hora ? " " + e.hora : ""} — ${e.titulo}${e.nota ? " (" + e.nota + ")" : ""}`).join("\n") || "(agenda vacía)";
    const arch = (archivos || []).slice(0, 40).map(f => `· [${f.categoria}] ${f.nombre}`).join("\n") || "(sin archivos)";
    return `Sos el asistente personal y privado de Sebastián (Presidente de V+V Construcciones). Hablás en español rioplatense (vos), claro y directo. Tenés memoria: recordás lo que Sebastián te contó (está en "SOBRE SEBASTIÁN") y el historial de esta conversación. Tratalo con cercanía y empatía, como alguien que lo conoce.

SOBRE SEBASTIÁN (lo que me fue contando; usalo para conocerlo y no volver a preguntar lo que ya sé):
${perfil || "(todavía no cargué datos personales; cuando me cuente algo durable sobre él, lo recuerdo)"}

Tenés acceso a TODOS los datos internos de V+V y a la agenda de pagos personal de Sebastián. Cuando te piden un dato puntual (un DNI, un teléfono, el estado de una obra, cuánto se le pagó a alguien), buscalo y respondé el valor EXACTO; nunca digas que no lo tenés si está acá abajo.

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

AGENDA DE PAGOS (personal de Sebastián) — pendiente total $${totalPend.toLocaleString("es-AR")}:
${pg}

MI AGENDA (eventos/citas):
${ag}

MIS ARCHIVOS GUARDADOS:
${arch}

Además podés ejecutar acciones. Si necesitás una, terminá tu respuesta con UN bloque:
<<ACCION>>{...}<<FIN>>
Acciones:
{"tipo":"foto_a_obra","obra":"Castores 475","cantidad":12}
{"tipo":"crear_obra","nombre":"Nombre de la obra","direccion":"opcional","estado":"En curso","avance":0}
{"tipo":"recordar","dato":"lo que hay que recordar de Sebastián (ej: tiene 3 hijos; su cumple es el 5/8; prefiere respuestas cortas)"}
{"tipo":"agendar","titulo":"Reunión con Belfast","fecha":"DD/MM/AA","hora":"10:00","nota":"opcional"}
{"tipo":"cargar_pago","persona":"Humberto","monto":50000,"obra":"Castores 475","estado":"pagado","metodo":"efectivo","nota":""}
{"tipo":"generar_pdf","tipo_doc":"presupuesto|comprobante|nota","titulo":"...","cliente":"...","obra":"...","texto":"cuerpo si es nota/comprobante","items":[{"desc":"Contrapiso","cantidad":100,"unidad":"m2","precio":8000}],"pie":"condiciones/validez"}
{"tipo":"whatsapp","persona":"Valeria","texto":"el mensaje a enviar por WhatsApp"}
{"tipo":"preguntar_ia","texto":"lo que querés consultarle a la IA de V+V"}
{"tipo":"traer_fotos","obra":"nombre de la obra","cantidad":1,"videos":false}
{"tipo":"traer_plano","obra":"nombre de la obra","buscar":"palabras clave del plano"}
Reglas:
- "foto_a_obra" cuando Sebastián sube una o varias fotos por el chat y te dice a qué obra van (ej: "subila a Castores 475", "estas fotos son de Golf 2-93", "mandalas a la obra A 37"). Tomo las últimas fotos que subió y las cargo en las fotos de esa obra (las ve V+V).
- "crear_obra" cuando dice "cargá una obra nueva", "agregá la obra X", "abrí una obra en tal dirección". Poné el nombre y lo que aclare (dirección, estado).
- "recordar" SIEMPRE que Sebastián te cuente algo durable sobre él (familia, hijos, gustos, fechas, cómo prefiere que le hables, su equipo, etc.). Guardalo para conocerlo. No lo uses para cosas pasajeras.
- "agendar" cuando dice "agendá / anotá en la agenda / recordame" un evento, reunión o cita (ej: "agendá reunión con Belfast el jueves a las 10"). Interpretá fecha (jueves, mañana, 15/07) y hora.
- "cargar_pago" cuando Sebastián dice algo como "cargá un pago a Humberto en Castores 475 de 50000" o "anotá que le pagué a Juan 30 lucas en efectivo". Interpretá monto (50000, "50 lucas"=50000, "50 mil"=50000), obra, estado (pagado/pendiente) y método (efectivo/transferencia) de lo que diga. Si no aclara estado, poné pendiente.
- "generar_pdf" cuando pide un PRESUPUESTO, COMPROBANTE o NOTA en PDF. Para presupuestos usá "items" (desc, cantidad, unidad, precio); el sistema calcula subtotales y total solo. Para comprobantes/notas usá "texto". ${modelo ? `Sebastián subió un MODELO de presupuesto: seguí su estructura, títulos y estilo. MODELO: """${(modelo.texto||"").slice(0,2500)}"""` : "Si pide presupuesto y no hay modelo, armá uno profesional igual."}
- "whatsapp" cuando dice "mandale un mensaje a X que…" o "escribile a X". Uso los teléfonos de Personal; le dejo el WhatsApp listo para enviar con un toque.
- "preguntar_ia" solo si pide expresamente consultar a la IA de V+V.
- "traer_fotos"/"traer_plano" para mostrar fotos, videos o planos en el chat.
Poné el bloque de acción solo cuando corresponda; si no, respondé normal.`;
  }

  function parseAccion(txt) { const m = txt.match(/<<ACCION>>([\s\S]*?)<<FIN>>/); if (!m) return { limpio: txt, accion: null }; let a = null; try { a = JSON.parse(m[1].trim()); } catch { } return { limpio: txt.replace(m[0], "").trim(), accion: a }; }

  async function persistPagos(next) {
    pagosWrite.current = Date.now(); setPagos(next);
    try { localStorage.setItem("sebastian_pagos", JSON.stringify(next)); } catch { }
    await storage.set("sebastian_pagos", JSON.stringify(next)).catch(() => { });
  }
  function cargarPago(a) {
    const obra = a.obra ? (db.obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(a.obra).toLowerCase())) : null;
    const p = { id: uid() + Date.now(), persona: a.persona || "", monto: Number(String(a.monto).replace(/[^\d.-]/g, "")) || 0, obra: obra?.nombre || a.obra || "", obra_id: obra?.id || "", estado: (a.estado || "pendiente").toLowerCase().includes("pag") ? "pagado" : "pendiente", metodo: a.metodo || "", nota: a.nota || "", fecha: a.fecha || hoyStr(), ts: Date.now() };
    persistPagos([p, ...(pagos || [])]);
    return p;
  }
  async function persistPagos(next) {
    pagosWrite.current = Date.now(); setPagos(next);
    try { localStorage.setItem("sebastian_pagos", JSON.stringify(next)); } catch { }
    await storage.set("sebastian_pagos", JSON.stringify(next)).catch(() => { });
  }
  async function persistArch(next) { setArchivos(next); await storage.set("sebastian_archivos", JSON.stringify(next)).catch(() => { }); }
  async function subirEnChat(e) {
    const files = Array.from(e.target.files); if (!files.length) return; e.target.value = "";
    for (const f of files) {
      const data = await fileToDataUrl(f);
      const url = await subirBucket(data, f.name);
      if (!url) { setMsgs(prev => [...prev, { role: "assistant", content: `No pude subir "${f.name}" a la nube. Revisá el bucket 'bco-media' en Supabase.` }]); continue; }
      const esImg = /^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name);
      const item = { id: uid() + Date.now(), nombre: f.name, url, categoria: esImg ? "Fotos" : "Chat", ext: (f.name.split(".").pop() || "").toUpperCase(), fecha: hoyStr(), ts: Date.now() };
      setArchivos(prev => { const n = [item, ...(prev || [])]; storage.set("sebastian_archivos", JSON.stringify(n)).catch(() => { }); return n; });
      if (esImg) setUltimasFotos(prev => [{ url, nombre: f.name }, ...prev].slice(0, 12));
      setMsgs(prev => [...prev, { role: "user", content: `📎 Subí: ${f.name}`, ...(esImg ? { media: [url], mediaTipo: "fotos" } : { docs: [{ nombre: f.name, url }] }) }, { role: "assistant", content: esImg ? `✅ Guardada en Archivos → Fotos: ${f.name}. ¿A qué obra la subo? Decime, por ejemplo: "subila a Castores 475".` : `✅ Guardado en Archivos: ${f.name}. Ya lo tengo disponible.` }]);
    }
  }
  async function persistAgenda(next) { setAgenda(next); await storage.set("sebastian_agenda", JSON.stringify(next)).catch(() => { }); }
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
      await storage.set("sebastian_modelos", JSON.stringify(next)).catch(() => { });
      setMsgs(prev => [...prev, { role: "assistant", content: `📄 Guardé el modelo "${f.name}" en tu biblioteca. Quedó seleccionado. Cuando pidas un presupuesto, sigo ese formato. Podés guardar varios y elegir cuál usar en la solapa Modelos.` }]);
    } catch { alert("No pude leer el Word."); }
  }
  async function preguntarIA(texto) {
    // Publica la consulta en el canal compartido; la IA de V+V la responde sola.
    let arr = []; try { const r = await storage.get("ia_dialogo"); if (r?.value) arr = JSON.parse(r.value); } catch { }
    const q = { id: uid() + Date.now(), from: "sebastian", texto, tipo: "q", answered: false, ts: Date.now(), fecha: hoyStr() };
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
    const t = input.trim(); if (!t || busy) return;
    const nm = [...msgs, { role: "user", content: t }];
    setMsgs(nm); setInput(""); setBusy(true);
    const hist = nm.filter(m => m.role === "user" || m.role === "assistant").map(m => ({ role: m.role, content: m.content })).slice(-40);
    const resp = await callAI(hist, buildSystem(), apiKey, useSearch);
    const { limpio, accion } = parseAccion(resp);
    let extra = {};
    if (accion && accion.tipo === "foto_a_obra") {
      const target = accion.obra ? (db.obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase())) : null;
      const fotos = (ultimasFotos || []).slice(0, accion.cantidad || 12);
      if (!target) { setMsgs(prev => [...prev, { role: "assistant", content: "No encontré esa obra. Decime el nombre exacto." }]); setBusy(false); return; }
      if (!fotos.length) { setMsgs(prev => [...prev, { role: "assistant", content: "No tengo fotos recién subidas para mandar. Subí la foto con 📎 y después decime a qué obra va." }]); setBusy(false); return; }
      let arr = []; try { const r = await storage.get("vv_obras"); if (r?.value) arr = JSON.parse(r.value); } catch { }
      const nuevas = fotos.map(f => ({ id: uid() + Date.now() + Math.random(), url: f.url, fecha: hoyStr(), from: "sebastian", nota: "" }));
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
      setPerfil(nuevoPerfil); try { localStorage.setItem("sebastian_perfil", nuevoPerfil); } catch { } storage.set("sebastian_perfil", nuevoPerfil).catch(() => { });
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
    if (accion && accion.tipo === "cargar_pago") {
      const p = cargarPago(accion);
      setMsgs(prev => [...prev, { role: "assistant", content: `✅ Pago cargado: ${p.persona || "—"}${p.monto ? ` · $${p.monto.toLocaleString("es-AR")}` : ""}${p.obra ? ` · ${p.obra}` : ""} · ${p.estado}${p.metodo ? ` · ${p.metodo}` : ""} (${p.fecha}).${limpio ? "\n\n" + limpio : ""}\n\nLo ves en la solapa Pagos y lo podés exportar a Excel.` }]);
      setBusy(false); return;
    }
    if (accion && accion.tipo === "whatsapp") {
      const per = (db.personal || []).find(x => (x.nombre || "").toLowerCase().includes(String(accion.persona || "").toLowerCase()) && (x.telefono || "").trim());
      const tel = per?.telefono; const clean = tel ? String(tel).replace(/\D/g, "") : ""; const num = clean ? (clean.startsWith("54") ? clean : "549" + clean) : "";
      const link = `https://wa.me/${num}?text=${encodeURIComponent(accion.texto || "")}`;
      setMsgs(prev => [...prev, { role: "assistant", content: limpio || `Te dejé listo el WhatsApp para ${accion.persona || "el contacto"}${per ? "" : " (no encontré su teléfono en Personal, elegí el contacto a mano)"}:`, waLink: link, waLabel: `Enviar a ${accion.persona || "contacto"}` }]);
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
        <div style={{ fontSize: 10, fontWeight: 700, color: BRASS, letterSpacing: "0.22em", textTransform: "uppercase" }}>Privado · Sebastián</div>
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
        <div><div style={{ fontSize: 9.5, fontWeight: 700, color: BRASS, letterSpacing: "0.22em", textTransform: "uppercase" }}>{cfg.eyebrow || "Privado"}</div><div style={{ fontFamily: cfg.serif ? T.serif : T.sans, fontSize: 22, fontWeight: 600, letterSpacing: "0.01em", marginTop: 2 }}>{cfg.titulo || "Mi Asistente"}</div></div>
        {vista === "chat" && <button onClick={() => setMsgs(msgs.slice(0, 1))} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.22)", color: "rgba(255,255,255,.85)", borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", cursor: "pointer" }}>Limpiar</button>}
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 12, overflowX: "auto" }}>
        {[["chat", "💬 Chat"], ["pagos", "💵 Pagos"], ["agenda", "📅 Agenda"], ["archivos", "📁 Archivos"], ["modelos", "📄 Modelos"], ["obras", "🏗 Obras"], ["ajustes", "⚙ Ajustes"]].map(([id, lb]) => <button key={id} onClick={() => setVista(id)} style={{ background: "none", border: "none", borderBottom: vista === id ? `2px solid ${BRASS}` : "2px solid transparent", color: vista === id ? "#fff" : "rgba(255,255,255,.55)", fontSize: 13, fontWeight: 700, padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>{lb}{id === "pagos" && (pagos || []).length ? ` (${pagos.length})` : ""}{id === "archivos" && (archivos || []).length ? ` (${archivos.length})` : ""}{id === "agenda" && (agenda || []).length ? ` (${agenda.length})` : ""}{id === "modelos" && (modelos || []).length ? ` (${modelos.length})` : ""}</button>)}
      </div>
    </div>
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowX: "hidden", zoom: (cfg.escala || 100) / 100 }}>
    {vista === "pagos" && <PagosBody pagos={pagos} obras={db.obras} filtroObra={filtroObra} setFiltroObra={setFiltroObra} exportar={exportarExcel} borrar={(id) => persistPagos((pagos || []).filter(p => p.id !== id))} />}
    {vista === "agenda" && <AgendaBody agenda={agenda} onAdd={agendarEvento} onDel={(id) => persistAgenda((agenda || []).filter(e => e.id !== id))} />}
    {vista === "archivos" && <ArchivosBody archivos={archivos} cat={catArch} setCat={setCatArch} archRef={archRef} subir={subirArchivos} subiendo={subiendoArch} borrar={(id) => persistArch((archivos || []).filter(a => a.id !== id))} />}
    {vista === "modelos" && <ModelosBody modelos={modelos} sel={modeloSel} setSel={setModeloSel} subir={() => modeloRef.current && modeloRef.current.click()} borrar={(id) => { const next = (modelos || []).filter(m => m.id !== id); setModelos(next); if (modeloSel === id) setModeloSel(next[0]?.id || ""); storage.set("sebastian_modelos", JSON.stringify(next)).catch(() => { }); }} />}
    {vista === "obras" && <ObrasBody obras={db.obras} obraEdit={obraEdit} setObraEdit={setObraEdit} guardar={guardarObra} onNueva={() => setObraEdit({ _new: true, nombre: "", estado: "En curso", avance: "", direccion: "" })} />}
    {vista === "ajustes" && <AjustesBody cfg={cfg} setC={setC} saveCfg={saveCfg} CFG_DEF={CFG_DEF} iconRef={iconRef} fondoRef={fondoRef} subirIcono={subirIcono} subirFondo={subirFondo} />}

    <div style={{ display: vista === "chat" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px 16px 8px" }}>
      {msgs.map((m, i) => (<div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
        <div style={{ maxWidth: "88%", minWidth: 0 }}>
          <div style={{ background: m.role === "user" ? T.navy : T.card, color: m.role === "user" ? "#fff" : T.text, border: m.role === "user" ? "none" : `1px solid ${T.border}`, borderRadius: 14, padding: "11px 14px", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>{m.content}</div>
          {m.waLink && <a href={m.waLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, background: "#25D366", color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>📲 {m.waLabel || "Enviar por WhatsApp"}</a>}
          {m.docs && m.docs.length > 0 && <div style={{ marginTop: 8 }}>{m.docs.map((d, j) => <a key={j} href={d.url} target="_blank" rel="noreferrer" download={d.nombre} style={{ display: "flex", alignItems: "center", gap: 9, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, textDecoration: "none" }}><span style={{ width: 30, height: 30, borderRadius: 7, background: T.al, color: T.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📐</span><span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{d.nombre}</span><span style={{ color: BRASS, fontWeight: 700, fontSize: 11.5 }}>Abrir ↗</span></a>)}</div>}
          {m.media && m.media.length > 0 && <div style={{ marginTop: 8 }}>{m.mediaTipo === "videos" ? m.media.map((u, j) => <video key={j} src={u} controls playsInline style={{ width: "100%", borderRadius: 10, marginBottom: 8, background: "#000" }} />) : <div style={{ display: "grid", gridTemplateColumns: m.media.length === 1 ? "1fr" : "1fr 1fr", gap: 6 }}>{m.media.map((u, j) => <a key={j} href={u} target="_blank" rel="noreferrer" download><img src={u} alt="" style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.border}`, display: "block" }} /></a>)}</div>}</div>}
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
        {modelo && <span style={{ fontSize: 10.5, color: T.muted }}>Modelo activo: {modelo.nombre}</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") enviar(); }} placeholder="Escribí tu consulta…" style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 15px", fontSize: 16, color: T.text }} />
        <button onClick={enviar} disabled={busy || !input.trim()} style={{ background: (busy || !input.trim()) ? T.border : T.accent, color: "#fff", border: "none", borderRadius: 12, padding: "0 20px", fontSize: 14, fontWeight: 600, letterSpacing: "0.03em", cursor: (busy || !input.trim()) ? "default" : "pointer" }}>Enviar</button>
      </div>
    </div>
    </div>
    </div>
  </div>);
}

function PagosBody({ pagos, obras, filtroObra, setFiltroObra, exportar, borrar }) {
  const lista = (pagos || []).filter(p => !filtroObra || p.obra === filtroObra).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const obrasUnicas = [...new Set((pagos || []).map(p => p.obra).filter(Boolean))];
  const totalPend = lista.filter(p => p.estado === "pendiente").reduce((a, p) => a + (p.monto || 0), 0);
  const totalPag = lista.filter(p => p.estado === "pagado").reduce((a, p) => a + (p.monto || 0), 0);
  return (<div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
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
