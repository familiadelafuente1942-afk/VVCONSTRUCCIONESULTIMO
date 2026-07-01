import React, { useState, useEffect, useRef, useCallback } from "react";

// ════════════════════════════════════════════════════════════════════
// PANEL DE CLIENTE — App independiente y descargable
// Mismo backend Supabase que la app de V+V → los datos se comparten.
// El cliente: ve el estado de obra · sube/descarga archivos · mensajea
// con avisos en pantalla cuando llega un mensaje nuevo.
// El nombre/identidad del cliente es configurable (Ajustes).
// ════════════════════════════════════════════════════════════════════

// ── BACKEND COMPARTIDO (idéntico a la app de V+V) ───────────────────
const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const SH = () => ({ "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY });

const storage = {
  set: async (key, value) => {
    try { localStorage.setItem(key, value); } catch { }
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
const parseMontoNum = (m) => { if (!m) return 0; return parseFloat(String(m).replace(/[^0-9.]/g, '')) || 0; };
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

const FORCE_CLOUD = (() => { try { return new URLSearchParams(window.location.search).has("sync"); } catch { return false; } })();
function useStored(key, def) {
  const [v, setV] = useState(() => { try { const l = localStorage.getItem(key); return l ? JSON.parse(l) : def; } catch { return def; } });
  useEffect(() => { (async () => { const r = await storage.get(key); if (r?.value) { try { const d = JSON.parse(r.value); if (FORCE_CLOUD) { setV(d); try { localStorage.setItem(key, r.value); } catch { } } else { setV(cur => JSON.stringify(d).length >= JSON.stringify(cur).length ? d : cur); } } catch { } } })(); }, [key]);
  const set = useCallback(u => { setV(prev => { const n = typeof u === 'function' ? u(prev) : u; const j = JSON.stringify(n); try { localStorage.setItem(key, j); } catch { } storage.set(key, j); return n; }); }, [key]);
  return [v, set];
}

// Llamada al modelo (usa la API Key cargada en la app de V+V, leída del backend compartido)
async function callAI(msgs, sys, apiKey, useSearch = false) {
  msgs = (msgs || []).map(m => ({ role: m.role, content: m.content }));
  const body = { model: "claude-sonnet-4-6", max_tokens: 1500, messages: msgs };
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
async function aplicarPedidos(setPedidos, fn) { let arr = []; try { const r = await storage.get("vv_pedidos"); if (r?.value) arr = JSON.parse(r.value); } catch { } const next = fn(arr.slice()); setPedidos(next); return next; }
async function ejecutarAccion(accion, miSide, ctx) {
  ctx = ctx || {};
  const setPedidos = ctx.setPedidos;
  if (!accion || !accion.tipo) return null;
  const otro = miSide === "vv" ? "cliente" : "vv";
  if (accion.tipo === "crear_pedido") { const para = (accion.para === "vv" || accion.para === "cliente") ? accion.para : otro; const obs = ctx.obras || []; const obra_id = accion.obra_id || (accion.obra ? obs.find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase()))?.id : "") || ""; const p = nuevoPedido({ de: miSide, para, asunto: accion.asunto, detalle: accion.detalle, prioridad: accion.prioridad, obra_id }); await aplicarPedidos(setPedidos, arr => [p, ...arr]); return `Pedido creado y enviado: “${p.asunto}”.`; }
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
    const next = [...arr, msg]; try { localStorage.setItem("vv_mensajes", JSON.stringify(next)); } catch { } await storage.set("vv_mensajes", JSON.stringify(next)).catch(() => { });
    if (ctx.setMensajes) ctx.setMensajes(next);
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
function accionLabel(a) { if (!a) return ""; if (a.tipo === "crear_pedido") return `Crear pedido → ${a.para === "cliente" ? "V+V/Cliente" : "V+V"}: “${a.asunto || ""}”`; if (a.tipo === "responder_pedido") return "Responder pedido"; if (a.tipo === "resolver_pedido") return "Marcar pedido como resuelto"; if (a.tipo === "enviar_mensaje") return `Enviar mensaje a V+V: “${(a.texto || "").slice(0, 60)}”`; if (a.tipo === "preguntar_ia") return `Consultar a la IA de V+V: “${(a.texto || "").slice(0, 60)}”`; if (a.tipo === "whatsapp") return `WhatsApp a ${a.persona || a.rol || "contacto"}: “${(a.texto || "").slice(0, 50)}”`; if (a.tipo === "cargar_personal") return `Cargar personal al sitio “${a.sitio || ""}”${a.obra ? ` (obra ${a.obra})` : a.personal && a.personal !== "todos" ? ` (${Array.isArray(a.personal) ? a.personal.join(", ") : a.personal})` : " (todos)"}`; return a.tipo; }

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
        {sec.items.map((it, ii) => { const v = av(`${si}:${ii}`); const ok = v === "Sí" || v === "Conf." || v === "Conforme"; const no = v === "No"; return (<div key={ii} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: `1px solid ${T.bg}` }}><span style={{ fontSize: 12, color: T.text, flex: 1 }}>{it}</span><span style={{ fontSize: 11, fontWeight: 800, color: ok ? "#16A34A" : no ? "#EF4444" : T.muted, flexShrink: 0 }}>{v}</span></div>); })}
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

function ObrasScreen({ T, obras, tareas, cfg, formularios = [] }) {
  const [verForm, setVerForm] = useState(null);
  const [open, setOpen] = useState(null);
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
            <Badge c={e.c} b={e.b}>{e.l}</Badge>
          </div>
          <div style={{ margin: "12px 0 6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}><span style={{ color: T.sub, fontWeight: 600 }}>Avance de obra</span><span style={{ color: T.accent, fontWeight: 800 }}>{o.avance}%</span></div>
            <div style={{ height: 8, background: T.bg, borderRadius: 5, overflow: "hidden" }}><div style={{ height: 8, width: `${o.avance}%`, background: T.accent, borderRadius: 5 }} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, background: T.bg, borderRadius: T.rsm, padding: "9px 11px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase" }}>Certificado</div><div style={{ fontSize: 12.5, fontWeight: 800, color: "#16A34A", marginTop: 2 }}>{pct}%</div></div>
            <div style={{ flex: 2, background: T.bg, borderRadius: T.rsm, padding: "9px 11px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase" }}>Saldo pendiente</div><div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginTop: 2 }}>{ecoUnlocked ? money(contr - cert) : "🔒 •••••"}</div></div>
          </div>
          {(ts.length > 0 || ult || (o.fotos || []).length > 0 || forms.length > 0) && <button onClick={() => setOpen(isOpen ? null : o.id)} style={{ width: "100%", marginTop: 12, background: "none", border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 700, color: T.accent }}>{isOpen ? "Ocultar detalle ▲" : `Ver detalle${forms.length ? ` · ${forms.length} formulario${forms.length > 1 ? "s" : ""}` : ""} ▼`}</button>}
          {isOpen && <div style={{ marginTop: 12 }}>
            {(o.fotos || []).length > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", marginBottom: 7 }}>Avance fotográfico ({o.fotos.length})</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>{o.fotos.map((f, i) => <a key={i} href={f.url || f} target="_blank" rel="noreferrer"><img src={f.url || f} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, border: `1px solid ${T.border}`, display: "block" }} /></a>)}</div></div>}
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
function ArchivosScreen({ T, obras, archivosCliente, setArchivosCliente, archivosVV, registrarSubida }) {
  const ref = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [destino, setDestino] = useState(obras[0]?.id || "");
  const obraArch = obras.flatMap(o => (o.archivos || []).map(a => ({ ...a, obra: o.nombre })));
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
  const FileRow = ({ a, mine }) => (<div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", marginBottom: 8, boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 11 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: mine ? "#EAEEF3" : T.bg, color: mine ? T.accent : T.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>📄</div>
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nombre || "archivo"}</div><div style={{ fontSize: 11, color: T.muted }}>{a.fecha || a.obra || ""}</div></div>
    {a.url && <a href={a.url} target="_blank" rel="noreferrer" download={a.nombre} style={{ background: T.bg, color: T.accent, borderRadius: 7, padding: "7px 11px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Abrir</a>}
    {mine && <button onClick={() => { if (confirm("¿Eliminar este archivo?")) setArchivosCliente(p => (p || []).filter(x => x.id !== a.id)); }} style={{ background: "none", border: "1px solid #FCA5A5", color: "#EF4444", borderRadius: 7, padding: "7px 9px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>✕</button>}
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
        {obraArch.map((a, i) => <FileRow key={"o" + i} a={a} />)}
      </>}
      <div style={{ marginTop: 16 }}><Eyebrow T={T}>Mis archivos enviados</Eyebrow>
        {archivosCliente.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "24px 18px" }}>Todavía no subiste archivos.</div>}
        {archivosCliente.map(a => <FileRow key={a.id} a={a} mine />)}
      </div>
    </div>
  </div>);
}

// ── PANTALLA: MENSAJES ───────────────────────────────────────────────
function MensajesScreen({ T, cfg, obras, mensajes, enviar, borrarMensaje }) {
  const [input, setInput] = useState("");
  const [adj, setAdj] = useState([]);
  const [obraAdj, setObraAdj] = useState("");
  const fileRef = useRef(null); const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);
  async function addAdj(e) { const files = Array.from(e.target.files); if (!files.length) return; const nuevos = []; for (const f of files) { const data = await fileToDataUrl(f); const url = await uploadArchivo(data, "msg", f.name.replace(/\W+/g, "_")); nuevos.push({ nombre: f.name, url }); } setAdj(p => [...p, ...nuevos]); if (!obraAdj && obras[0]) setObraAdj(obras[0].id); e.target.value = ""; }
  async function send() { const t = input.trim(); if (!t && adj.length === 0) return; await enviar(t, adj, adj.length ? obraAdj : ""); setInput(""); setAdj([]); setObraAdj(""); }
  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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

const NAV = [{ id: "asistente", label: "Asistente IA", icon: "M12 3a4 4 0 014 4v1a4 4 0 01-8 0V7a4 4 0 014-4zM5 21a7 7 0 0114 0" }, { id: "mensajes", label: "Mensajes", icon: "M4 5h16v11H8l-4 4z" }, { id: "pedidos", label: "Pedidos", icon: "M9 5h6M9 9h6M9 13h4M5 3h14v18H5z" }, { id: "materiales", label: "Materiales", icon: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7" }, { id: "informes", label: "Informes", icon: "M8 3h8l2 4v14H6V7z" }, { id: "formularios", label: "Formularios", icon: "M5 3h14v18H5zM9 7h6M9 11h6M9 15h4" }, { id: "archivos", label: "Archivos", icon: "M3 7h6l2 2h10v10H3z" }, { id: "obras", label: "Obra", icon: "M3 21h18M5 21V7l7-4 7 4v14M10 21v-5h4v5" }, { id: "personal", label: "Personal", icon: "M12 9a3 3 0 100 6 3 3 0 000-6z" }, { id: "gestion", label: "Gestión", icon: "M4 20V10M10 20V4M16 20v-7" }, { id: "ajustes", label: "Ajustes", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM12 4v2M12 18v2M4 12h2M18 12h2" }];

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
    const ped = (pedidos || []).filter(p => p.estado !== "resuelto").slice(0, 20).map(p => `· [${p.id}] "${p.asunto}" (${p.de === "cliente" ? "enviado a V+V" : "recibido de V+V"}, estado ${p.estado}) — último: ${p.hilo[p.hilo.length - 1]?.texto?.slice(0, 80) || ""}`).join("\n");
    const per = (personal || []).map(p => `· ${p.nombre} — ${p.rol || ""} (obra ${obras.find(o => o.id === p.obra_id)?.nombre || "—"})${(p.sitios || []).length ? ` [cargado en: ${p.sitios.map(s => s.sitio).join(", ")}]` : ""}`).join("\n");
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

TAREAS / CRONOGRAMA:\n${(tareas || []).map(t => `· ${t.nombre} — ${obras.find(o => o.id === t.obra_id)?.nombre || "—"} (${t.avance || 0}%)`).join("\n") || "(sin tareas)"}

PEDIDOS DE MATERIALES:\n${(matpedidos || []).map(p => `· ${obras.find(o => o.id === p.obra_id)?.nombre || "—"} (${p.fecha}): ${(p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ")} — ${p.leido ? "levantado" : "no leído"}`).join("\n") || "(sin pedidos de materiales)"}

Tenés acceso COMPLETO a todos estos datos (obras, avances, montos, fotos, informes, formularios, archivos, documentación, tareas, materiales, personal, contactos, pedidos). Cuando te pidan un DATO PUNTUAL, buscalo y dá el valor EXACTO; no digas "no lo tengo" si está arriba. Las fotos y videos no los "ves", pero sabés cuántos hay y de qué obra.

PROTOCOLO — cuando el usuario te pida una acción, respondé natural y AGREGÁ AL FINAL un bloque entre \`\`\`accion y \`\`\` con JSON, una de:
{"tipo":"crear_pedido","para":"vv","asunto":"...","detalle":"...","prioridad":"alta|media|baja","obra":"nombre de la obra de la que se trata"}
{"tipo":"responder_pedido","pedido_id":"ID","texto":"..."}
{"tipo":"resolver_pedido","pedido_id":"ID"}
{"tipo":"enviar_mensaje","texto":"el mensaje para V+V"}
{"tipo":"preguntar_ia","texto":"la consulta para la IA de V+V"}
{"tipo":"cargar_personal","sitio":"nombre del barrio/sitio","personal":"todos" | ["Nombre1","Nombre2"], "obra":"opcional: cargar todos los de esa obra"}
{"tipo":"whatsapp","persona":"nombre o rol del jefe de obra/contacto","obra":"opcional","texto":"el mensaje a enviar por WhatsApp"}
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
    if (accion && accion.tipo === "whatsapp") {
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
  const pedSeen = useRef(null);
  const matSeen = useRef(null);
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await storage.get("ia_dialogo"); if (!r?.value) return;
        let arr = JSON.parse(r.value);
        if (iaSeen.current < 0) iaSeen.current = arr.length;
        else if (arr.length > iaSeen.current) {
          const nuevos = arr.slice(iaSeen.current); iaSeen.current = arr.length;
          setMsgs(prev => [...prev, ...nuevos.map(m => ({ role: "assistant", content: `🔗 IA ${m.from === "cliente" ? cfg.nombre : "V+V"} ${m.tipo === "q" ? "consultó" : "respondió"}: ${m.texto}` }))]);
        }
        const pend = arr.find(m => m.from !== "cliente" && m.tipo === "q" && !m.answered);
        if (pend) {
          arr = arr.map(m => m.id === pend.id ? { ...m, answered: true } : m);
          await storage.set("ia_dialogo", JSON.stringify(arr)).catch(() => { });
          const sysResp = `Sos el asistente de datos de ${cfg.nombre}. ESTOS SON TUS DATOS:\n${ctxRef.current}\n\nRespondé la consulta usando SOLO estos datos, breve y concreto (español rioplatense). Si el dato NO está en tus datos, respondé ÚNICAMENTE con la palabra NO_DATO. Nunca inventes. No agregues bloques de acción ni JSON.`;
          const resp = await callAI([{ role: "user", content: `Consulta de la IA de V+V: "${pend.texto}"` }], sysResp, apiKeyRef.current, false);
          let arr2 = []; try { const r2 = await storage.get("ia_dialogo"); if (r2?.value) arr2 = JSON.parse(r2.value); } catch { }
          arr2 = arr2.map(m => m.id === pend.id ? { ...m, answered: true } : m);
          let textoResp = resp;
          if ((resp || "").trim().toUpperCase().startsWith("NO_DATO")) {
            let peds = []; try { const rp = await storage.get("vv_pedidos"); if (rp?.value) peds = JSON.parse(rp.value); } catch { }
            const np = nuevoPedido({ de: pend.from, para: "cliente", asunto: `[URGENTE] Consulta de la IA de V+V`, detalle: pend.texto, prioridad: "alta", obra_id: "" });
            const pedsNext = [np, ...peds]; try { localStorage.setItem("vv_pedidos", JSON.stringify(pedsNext)); } catch { } await storage.set("vv_pedidos", JSON.stringify(pedsNext)).catch(() => { });
            textoResp = `No tengo ese dato en la app de ${cfg.nombre}. Lo derivé al personal de ${cfg.nombre} como URGENTE (quedó en Pedidos). Respondemos apenas lo tengan.`;
          }
          arr2.push({ id: uid() + Date.now(), from: "cliente", texto: textoResp, tipo: "a", answered: true, ts: Date.now(), fecha: hoyStr() });
          try { localStorage.setItem("ia_dialogo", JSON.stringify(arr2)); } catch { }
          await storage.set("ia_dialogo", JSON.stringify(arr2)).catch(() => { });
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
              const lines = p.items.map(it => `• ${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join("\n");
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
    }, 6000);
    return () => clearInterval(iv);
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
  useEffect(() => { const iv = setInterval(async () => { try { const r = await storage.get("vv_pedidos"); if (r?.value) { const arr = JSON.parse(r.value); setPedidos(prev => JSON.stringify(arr) !== JSON.stringify(prev) ? arr : prev); } } catch { } }, 8000); return () => clearInterval(iv); }, []);
  const lista = pedidos.filter(p => filtro === "todos" ? true : filtro === "recibidos" ? p.para === miSide : p.de === miSide);
  const cur = open ? pedidos.find(p => p.id === open) : null;
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "";
  function crear() { if (!nuevo.asunto?.trim()) return; aplicarPedidos(setPedidos, arr => [nuevoPedido({ de: miSide, para: "vv", asunto: nuevo.asunto, detalle: nuevo.detalle, prioridad: nuevo.prioridad, obra_id: nuevo.obra_id }), ...arr]); setNuevo(null); }
  function responder(id, texto, porIA, archivos) { if (!texto?.trim() && !(archivos || []).length) return; const f = hoyStr(), ts = Date.now(); aplicarPedidos(setPedidos, arr => arr.map(x => x.id === id ? { ...x, estado: "respondido", hilo: [...x.hilo, { de: miSide, texto, fecha: f, ts, porIA: !!porIA, archivos: archivos || [] }] } : x)); setReply(""); setAdj([]); }
  function setEstado(id, estado) { aplicarPedidos(setPedidos, arr => arr.map(x => x.id === id ? { ...x, estado } : x)); }
  function borrarPedido(id) { if (!confirm("¿Eliminar este pedido? Se borra para las dos empresas.")) return; aplicarPedidos(setPedidos, arr => arr.filter(x => x.id !== id)); setOpen(null); }
  async function responderIA(p) { setIaLoad(true); const hist = p.hilo.map(h => `${h.de === miSide ? cfg.nombre : "V+V"}: ${h.texto}`).join("\n"); const sys = `Sos el agente de ${cfg.nombre} respondiendo a V+V Construcciones. Redactá una respuesta breve y concreta (español rioplatense) al último mensaje. Solo el texto.`; const r = await callAI([{ role: "user", content: `Pedido: ${p.asunto}\n\nHilo:\n${hist}\n\nRedactá nuestra respuesta.` }], sys, apiKey); setReply(r); setIaLoad(false); }
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
        {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "30px 18px" }}>Sin pedidos. Creá uno o pedíselo al Asistente IA.</div>}
        {lista.map(p => { const e = PEDIDO_ESTADOS[p.estado]; const ult = p.hilo[p.hilo.length - 1]; return (<Card T={T} key={p.id} style={{ padding: 13, marginBottom: 9 }}>
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
            <Badge c={e.c} b={e.b}>{e.l}</Badge>
          </div>
        </Card>); })}
      </>}
      {cur && (() => { const e = PEDIDO_ESTADOS[cur.estado]; return (<>
        <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>← Volver</button>
        <Card T={T} style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}><div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{cur.asunto}</div><Badge c={e.c} b={e.b}>{e.l}</Badge></div>
          {cur.obra_id && <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: T.accent, background: "#EAEEF3", borderRadius: 6, padding: "4px 10px", marginTop: 8 }}>🏗 Obra: {nomObra(cur.obra_id)}</div>}
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>{cur.de === miSide ? "Enviado a V+V" : "Recibido de V+V"} · {cur.fecha} · prioridad {cur.prioridad}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>{Object.entries(PEDIDO_ESTADOS).map(([k, v]) => <button key={k} onClick={() => setEstado(cur.id, k)} style={{ flex: 1, padding: "7px 4px", borderRadius: 7, border: `1px solid ${cur.estado === k ? v.c : T.border}`, background: cur.estado === k ? v.b : T.card, color: cur.estado === k ? v.c : T.muted, fontSize: 10.5, fontWeight: 700 }}>{v.l}</button>)}</div>
          <button onClick={() => borrarPedido(cur.id)} style={{ width: "100%", marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar pedido</button>
        </Card>
        <Eyebrow T={T}>Hilo</Eyebrow>
        {cur.hilo.map((h, i) => { const mine = h.de === miSide; return (<div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
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
        <input value={nuevo.asunto} onChange={e => setNuevo({ ...nuevo, asunto: e.target.value })} placeholder="Asunto" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, marginBottom: 9 }} />
        <textarea value={nuevo.detalle} onChange={e => setNuevo({ ...nuevo, detalle: e.target.value })} placeholder="Detalle de la solicitud" rows={4} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, marginBottom: 9 }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>¿De qué obra?</label>
        <select value={nuevo.obra_id} onChange={e => setNuevo({ ...nuevo, obra_id: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 9px" }}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}<option value="">Sin obra específica</option></select>
        <select value={nuevo.prioridad} onChange={e => setNuevo({ ...nuevo, prioridad: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, marginBottom: 12 }}><option value="alta">Prioridad alta</option><option value="media">Prioridad media</option><option value="baja">Prioridad baja</option></select>
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
  function guardarC() { if (!cForm.nombre.trim() || !cForm.telefono.trim()) { alert("Poné al menos nombre y teléfono."); return; } if (cForm.id) setContactos(p => (p || []).map(x => x.id === cForm.id ? cForm : x)); else setContactos(p => [...(p || []), { ...cForm, id: uid() + Date.now() }]); setCForm(null); }
  function borrarC(id) { if (confirm("¿Eliminar este contacto?")) setContactos(p => (p || []).filter(x => x.id !== id)); }
  const diasHasta = (s) => { if (!s) return null; const [d, m, y] = s.split("/"); return Math.ceil((new Date(`20${y}`, m - 1, d) - new Date()) / 86400000); };
  const lista = personal.filter(p => !filtroObra || p.obra_id === filtroObra);
  const sitios = [...new Set(obras.map(o => o.nombre))];
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
          <button onClick={() => setCForm(c)} style={{ background: "none", border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Editar</button>
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
        <input value={cForm.nombre} onChange={e => setCForm({ ...cForm, nombre: e.target.value })} placeholder="Ej: Juan Pérez" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 12px" }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rol</label>
        <input value={cForm.rol} onChange={e => setCForm({ ...cForm, rol: e.target.value })} placeholder="Jefe de obra" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 12px" }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Obra</label>
        <select value={cForm.obra_id} onChange={e => setCForm({ ...cForm, obra_id: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 12px" }}><option value="">Sin obra</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Teléfono (WhatsApp)</label>
        <input value={cForm.telefono} onChange={e => setCForm({ ...cForm, telefono: e.target.value })} placeholder="Ej: 11 5555 4444" type="tel" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 4px" }} />
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
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{inf.titulo || "Informe"}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{inf.obra} · {inf.fecha}{(inf.archivos || []).length ? ` · ${inf.archivos.length} adj.` : ""}</div></div>
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
        {(open.archivos || []).map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 8, fontSize: 13, fontWeight: 700, color: T.accent }}>📎 {a.nombre}</a>)}
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

function MaterialesScreen({ T, cfg, obras, personal = [], contactos = [], matpedidos = [], setMatpedidos }) {
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  const [waFor, setWaFor] = useState(null);
  function levantar(id) { setMatpedidos(prev => (prev || []).map(x => x.id === id ? { ...x, leido: true, leidoFecha: hoyStr() } : x)); }
  function waText(p) {
    const lines = p.items.map(it => `• ${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim());
    return `*Pedido de materiales* — ${nomObra(p.obra_id)}\nFecha: ${p.fecha}\n\n${lines.join("\n")}${p.nota ? "\n\nNota: " + p.nota : ""}\n\n(Enviado desde ${cfg?.nombre || "Belfast"})`;
  }
  function waLink(text, phone) {
    const t = encodeURIComponent(text);
    if (phone) { const clean = String(phone).replace(/\D/g, ""); const num = clean.startsWith("54") ? clean : ("549" + clean); return `https://wa.me/${num}?text=${t}`; }
    return `https://wa.me/?text=${t}`;
  }
  const lista = (matpedidos || []).filter(p => p.de !== "cliente").sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 30 }}>
    <div style={{ padding: "16px 20px" }}>
      <Eyebrow T={T}>Pedidos de materiales de V+V</Eyebrow>
      {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "34px 18px", lineHeight: 1.55 }}>Todavía no recibiste pedidos de materiales.<br />Cuando V+V cargue uno, aparece acá.</div>}
      {lista.map(p => { const jefes = [...(contactos || []).filter(c => (!c.obra_id || c.obra_id === p.obra_id) && (c.telefono || "").trim()), ...(personal || []).filter(pe => pe.obra_id === p.obra_id && (pe.telefono || "").trim())]; return (<Card T={T} key={p.id} style={{ padding: 13, marginBottom: 9, borderLeft: `3px solid ${p.leido ? T.border : "#EF4444"}`, background: p.leido ? T.card : "#FFFBEB" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{nomObra(p.obra_id)} · {p.fecha}<span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 800, color: "#fff", background: p.de === "vv" ? T.accent : BRASS, borderRadius: 5, padding: "2px 7px" }}>{p.de === "vv" ? "V+V" : (p.empresa || "Contratista")}</span>{!p.leido && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: "#fff", background: "#EF4444", borderRadius: 5, padding: "2px 7px" }}>NUEVO</span>}</div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{p.items.map(it => `• ${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join("\n")}</div>
          {p.nota && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5, fontStyle: "italic" }}>{p.nota}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          {!p.leido && <button onClick={() => levantar(p.id)} style={{ flex: 1, background: T.navy, color: "#fff", border: "none", borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", borderBottom: `2px solid ${BRASS}` }}>Levantar</button>}
          <button onClick={() => setWaFor(waFor === p.id ? null : p.id)} style={{ flex: 1, background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>📲 Enviar por WhatsApp</button>
        </div>
        {p.leido && <div style={{ fontSize: 10.5, fontWeight: 700, color: "#16A34A", marginTop: 8 }}>✓ Levantado{p.leidoFecha ? " · " + p.leidoFecha : ""}</div>}
        {waFor === p.id && <div style={{ marginTop: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 11px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Enviar a…</div>
          {jefes.map(j => <a key={j.id} href={waLink(waText(p), j.telefono)} target="_blank" rel="noreferrer" onClick={() => setWaFor(null)} style={{ display: "block", background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", marginBottom: 7 }}>📲 {j.nombre}{j.rol ? ` · ${j.rol}` : ""}</a>)}
          <a href={waLink(waText(p))} target="_blank" rel="noreferrer" onClick={() => setWaFor(null)} style={{ display: "block", background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Elegir contacto de WhatsApp…</a>
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

function GestionScreen({ T, cfg, pedidos, obras, gestion }) {
  const g = { plazo: 5, dotacion: 7, costoPersona: 60000, manual: [], ...(gestion || {}) };
  const [tab, setTab] = useState("registro");
  const cli = cfg?.nombre || "Belfast";
  const nomObra = id => obras.find(o => o.id === id)?.nombre || "—";
  const itemsPedidos = (pedidos || []).map(p => { const solic = p.ts ? new Date(p.ts) : null; const resp = (p.hilo || []).find(h => h.de === p.para); const real = resp ? new Date(resp.ts) : null; const m = gMetricas(solic, real, g.plazo, p.estado === "resuelto"); return { id: p.id, tipo: "Pedido de información", obra_id: p.obra_id, descripcion: p.asunto, imputable: p.para === "cliente" ? cli : "V+V", fechaSolic: solic, fechaReal: real, ...m }; });
  const itemsManual = (g.manual || []).map(it => { const solic = it.fechaSolic ? new Date(it.fechaSolic) : null; const real = it.fechaReal ? new Date(it.fechaReal) : null; const m = gMetricas(solic, real, it.plazo || g.plazo, !!real); return { ...it, fechaSolic: solic, fechaReal: real, ...m }; });
  const items = [...itemsPedidos, ...itemsManual].sort((a, b) => (b.fechaSolic || 0) - (a.fechaSolic || 0));
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
      {items.map(it => { const e = GEST_ESTADOS[it.estado]; const pj = perItem(it); return (<Card T={T} key={it.id} style={{ padding: 13, marginBottom: 9 }}>
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
function WebClientHeader({ T, cfg, screen, setScreen, unread, pendientes, unreadForms, unreadMat }) {
  const badge = (id) => (id === "mensajes" ? unread : id === "formularios" ? (unreadForms || 0) : id === "pedidos" ? pendientes : id === "materiales" ? (unreadMat || 0) : 0);
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
        <nav style={{ maxWidth: 1180, margin: "0 auto", padding: "4px 24px 0", display: "flex", gap: 2, justifyContent: "center", overflowX: "auto" }}>
          {NAV.map(n => { const active = screen === n.id; return (
            <button key={n.id} onClick={() => setScreen(n.id)} style={{ position: "relative", background: "none", border: "none", padding: "9px 14px", fontSize: 13, fontWeight: active ? 800 : 600, color: active ? T.accent : T.sub, borderBottom: `2px solid ${active ? BRASS : "transparent"}`, whiteSpace: "nowrap", cursor: "pointer" }}>
              {n.label}
              {badge(n.id) > 0 && <span style={{ position: "absolute", top: 2, right: 2, background: "#EF4444", color: "#fff", borderRadius: 9, minWidth: 15, height: 15, fontSize: 8.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{badge(n.id)}</span>}
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
  const unreadMat = (matpedidos || []).filter(p => p.de !== "cliente" && !p.leido).length;
  const lastPed = useRef(null);
  const lastForms = useRef(null);
  const [toast, setToast] = useState(null);
  const [unread, setUnread] = useState(0);
  const [unreadForms, setUnreadForms] = useState(0);
  const lastCount = useRef(null);

  // Polling de mensajes y datos cada 8s → avisos en pantalla
  useEffect(() => {
    let alive = true;
    async function tick() {
      const [rm, ro, rp, rf, rmp] = await Promise.all([storage.get("vv_mensajes"), storage.get("vv_obras"), storage.get("vv_pedidos"), storage.get("vv_formularios"), storage.get("vv_matpedidos")]);
      if (!alive) return;
      if (rmp?.value) { try { const mp = JSON.parse(rmp.value); setMatpedidos(prev => JSON.stringify(mp) !== JSON.stringify(prev) ? mp : prev); } catch { } }
      if (rm?.value) {
        try {
          const arr = JSON.parse(rm.value);
          if (lastCount.current === null) { lastCount.current = arr.length; }
          else if (arr.length > lastCount.current) {
            const nuevos = arr.slice(lastCount.current);
            const deVV = nuevos.filter(m => m.from === "vv");
            lastCount.current = arr.length;
            setMensajes(arr);
            if (deVV.length > 0) {
              setToast(`Nuevo mensaje de V+V Construcciones`);
              setTimeout(() => setToast(null), 4500);
              if (screenRef.current !== "mensajes") setUnread(u => u + deVV.length);
              try { beep(); } catch { }
            }
          } else { lastCount.current = arr.length; }
        } catch { }
      }
      if (ro?.value) { try { setObras(JSON.parse(ro.value)); } catch { } }
      if (rp?.value) {
        try {
          const arr = JSON.parse(rp.value); setPedidos(arr);
          // huella de pedidos recibidos cuyo último mensaje es de V+V
          const huella = arr.filter(p => p.para === "cliente" && p.estado !== "resuelto" && p.hilo[p.hilo.length - 1]?.de === "vv").map(p => p.id + ":" + p.hilo.length).join("|");
          if (lastPed.current === null) { lastPed.current = huella; }
          else if (huella !== lastPed.current) {
            lastPed.current = huella;
            setToast("V+V envió o actualizó un pedido");
            setTimeout(() => setToast(null), 4500);
            try { beep(); } catch { }
            // Auto-respuesta IA (opcional) — responde a pedidos de V+V con tope de turnos
            if (cfgRef.current?.autoIA && vvCfgRef.current?.apiKey) {
              for (const p of arr) {
                if (p.para === "cliente" && p.estado !== "resuelto" && (p.iaTurns || 0) < PEDIDO_MAX_IA && p.hilo[p.hilo.length - 1]?.de === "vv") {
                  const hist = p.hilo.map(h => `${h.de === "cliente" ? cfgRef.current.nombre : "V+V"}: ${h.texto}`).join("\n");
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
  useEffect(() => { screenRef.current = screen; if (screen === "mensajes") setUnread(0); if (screen === "formularios") setUnreadForms(0); }, [screen]);
  const cfgRef = useRef(cfg); useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  const vvCfgRef = useRef(vvCfg); useEffect(() => { vvCfgRef.current = vvCfg; }, [vvCfg]);

  async function postMensaje(msg) {
    const r = await storage.get("vv_mensajes"); let actual = mensajes;
    if (r?.value) { try { actual = JSON.parse(r.value); } catch { } }
    const next = [...actual, msg]; lastCount.current = next.length; setMensajes(next); return next;
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
      <WebClientHeader T={T} cfg={cfg} screen={screen} setScreen={setScreen} unread={unread} pendientes={pedidos.filter(p => p.para === "cliente" && p.estado !== "resuelto").length} unreadForms={unreadForms} unreadMat={unreadMat} />
      {screen === "obras" && <WebClientHero T={T} cfg={cfg} obras={obras} />}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center", background: "transparent" }}>
        <div style={{ width: "100%", maxWidth: 1180, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg, borderLeft: `1px solid rgba(176,137,79,0.28)`, borderRight: `1px solid rgba(176,137,79,0.28)`, boxShadow: "0 0 80px rgba(0,0,0,0.45)" }}>
          {screen === "asistente" && <AsistenteScreen T={T} cfg={cfg} apiKey={vvCfg.apiKey} obras={obras} tareas={tareas} msgs={chatMsgs} setMsgs={setChatMsgs} pedidos={pedidos} setPedidos={setPedidos} personal={personal} setPersonal={setPersonal} mensajes={mensajes} contactos={contactos} formularios={formularios} matpedidos={matpedidos} documentacion={documentacion} onPedidos={() => setScreen("pedidos")} />}
          {screen === "obras" && <ObrasScreen T={T} obras={obras} tareas={tareas} cfg={cfg} formularios={formularios} />}
          {screen === "personal" && <PersonalScreen T={T} cfg={cfg} personal={personal} setPersonal={setPersonal} obras={obras} contactos={contactos} setContactos={setContactos} />}
          {screen === "pedidos" && <PedidosScreen T={T} cfg={cfg} apiKey={vvCfg.apiKey} obras={obras} pedidos={pedidos} setPedidos={setPedidos} />}
          {screen === "materiales" && <MaterialesScreen T={T} cfg={cfg} obras={obras} personal={personal} contactos={contactos} matpedidos={matpedidos} setMatpedidos={setMatpedidos} />}
          {screen === "informes" && <InformesScreen T={T} obras={obras} formularios={formularios} />}
          {screen === "formularios" && <FormulariosScreen T={T} obras={obras} formularios={formularios} />}
          {screen === "gestion" && <GestionScreen T={T} cfg={cfg} pedidos={pedidos} obras={obras} gestion={gestion} />}
          {screen === "archivos" && <ArchivosScreen T={T} obras={obras} archivosCliente={archivosCliente} setArchivosCliente={setArchivosCliente} archivosVV={archivosVV} registrarSubida={registrarSubida} />}
          {screen === "mensajes" && <MensajesScreen T={T} cfg={cfg} obras={obras} mensajes={mensajes} enviar={enviar} borrarMensaje={borrarMensaje} />}
          {screen === "ajustes" && <AjustesScreen T={T} cfg={cfg} setCfg={setCfg} />}
        </div>
      </div>
      <WebClientFooter T={T} cfg={cfg} />
    </div>
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
