import React, { useState, useEffect, useRef, useCallback } from "react";
import { PanelDefinicion, RecorridoDef, chipDef, fmtLimite, fmtTs, diasHasta, conMov } from "./PedidoDef.jsx";

/* ═══ PANEL DEL ESTUDIO DE ARQUITECTURA ═══
   Link propio para el estudio. Ve solo los pedidos de definición / plano que le mandaron,
   con su estado, la fecha límite y lo que se pidió. Puede avisar que lo está trabajando,
   hacer consultas y responder con descripción + planos. Todo queda en el mismo hilo que ve
   la empresa (clave "vv_pedidos"), con fecha y hora de cada movimiento. */

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const BUCKET = "bco-media";
const H = () => ({ "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY });
async function nubeGet(key) {
  try { const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { headers: H() }); if (!r.ok) return undefined; const d = await r.json(); return d && d.length ? d[0].value : null; } catch { return undefined; }
}
async function nubeSet(key, value) { const r = await fetch(SUPA_URL + "/rest/v1/bco_storage", { method: "POST", headers: { ...H(), Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key, value }) }); if (!r.ok) throw new Error("HTTP " + r.status); }
const uid = () => Math.random().toString(36).slice(2, 9);
const hoyStr = () => { const d = new Date(); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getFullYear()).slice(2); };
async function subirArchivo(file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = "pedidos/" + uid() + "_" + Date.now() + "." + ext;
  const r = await fetch(SUPA_URL + "/storage/v1/object/" + BUCKET + "/" + path, { method: "POST", headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": file.type || "application/octet-stream" }, body: await file.arrayBuffer() });
  if (!r.ok) throw new Error("No se pudo subir " + file.name);
  return { nombre: file.name, url: SUPA_URL + "/storage/v1/object/public/" + BUCKET + "/" + path, img: (file.type || "").startsWith("image/") };
}

const T = { bg: "#F3F1EC", card: "#FFFFFF", border: "#DDD8CD", text: "#1D1D1F", sub: "#5E5B55", muted: "#8A8680", accent: "#2F5D8C", rsm: 12 };
const ESTADOS = { abierto: ["Nuevo", "#E0A04A"], en_proceso: ["En estudio", "#2F5D8C"], respondido: ["Respondido", "#8B5CF6"], resuelto: ["Resuelto", "#3E9B62"] };

function Archivos({ lista }) {
  return (lista || []).map((a, j) => a.img
    ? <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 7 }}><img src={a.url} alt={a.nombre} style={{ maxWidth: "100%", borderRadius: 8, display: "block" }} /></a>
    : <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 7, marginRight: 6, background: "rgba(128,128,128,.14)", borderRadius: 6, padding: "5px 9px", fontSize: 12, color: "inherit", textDecoration: "none" }}>📎 {a.nombre}</a>);
}

export default function EstudioApp() {
  const [nombre, setNombre] = useState(() => { try { return localStorage.getItem("estudio_nombre") || ""; } catch { return ""; } });
  const [borrador, setBorrador] = useState("");
  const [pedidos, setPedidos] = useState([]);
  const [obras, setObras] = useState([]);
  const [error, setError] = useState("");
  const [cargado, setCargado] = useState(false);
  const [filtro, setFiltro] = useState("responder");
  const [obra, setObra] = useState("");
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState("");
  const [adjMsg, setAdjMsg] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef(null);

  const traer = useCallback(async () => {
    const v = await nubeGet("vv_pedidos");
    if (v === undefined) { setError("Sin conexión. Reintentando…"); return; }
    setError("");
    try { setPedidos(v ? JSON.parse(v) : []); } catch { }
    setCargado(true);
  }, []);
  useEffect(() => {
    traer(); const iv = setInterval(traer, 8000);
    const onVis = () => { if (document.visibilityState === "visible") traer(); };
    document.addEventListener("visibilitychange", onVis);
    (async () => { const o = await nubeGet("vv_obras"); try { if (o) setObras(JSON.parse(o).map(x => ({ id: x.id, nombre: x.nombre }))); } catch { } })();
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [traer]);

  // Cambia UN pedido: trae la lista fresca de la nube, modifica ese pedido y guarda (no pisa lo que hicieron los demás)
  async function cambiar(id, fn) {
    setGuardando(true);
    try {
      const v = await nubeGet("vv_pedidos");
      if (v === undefined) throw new Error("sin conexión");
      const lista = v ? JSON.parse(v) : [];
      const ahora = Date.now();
      const sig = lista.map(p => p.id === id ? { ...fn(p), upd: ahora } : p);
      await nubeSet("vv_pedidos", JSON.stringify(sig));
      await nubeSet("vv_pedidos__ts", String(ahora));
      setPedidos(sig);
    } catch (e) { alert("No se pudo guardar (" + e.message + "). Probá de nuevo."); }
    setGuardando(false);
  }
  const entrada = (texto, archivos) => ({ de: "estudio", nombre, texto, fecha: hoyStr(), ts: Date.now(), porIA: false, archivos: archivos || [] });
  const tomar = (id) => cambiar(id, p => conMov({ ...p, hilo: [...(p.hilo || []), entrada("El estudio recibió el pedido y está trabajando en la respuesta.")] }, "en_proceso", "estudio"));
  const responder = (id, texto, adj) => cambiar(id, p => conMov({ ...p, hilo: [...(p.hilo || []), entrada(texto || "Respuesta con documentación adjunta.", adj)] }, "respondido", "estudio"));
  const consultar = async (id) => { if (!msg.trim() && !adjMsg.length) return; const t = msg, a = adjMsg; setMsg(""); setAdjMsg([]); await cambiar(id, p => ({ ...p, estado: p.estado === "abierto" ? "en_proceso" : p.estado, hilo: [...(p.hilo || []), entrada(t, a)] })); };
  async function adjuntar(e) { const fs = Array.from(e.target.files || []); e.target.value = ""; const n = []; for (const f of fs) { try { n.push(await subirArchivo(f)); } catch (er) { alert(er.message); } } setAdjMsg(p => [...p, ...n]); }

  const mios = pedidos.filter(p => p && p.def && p.para === "estudio");
  const nomObra = (id) => (obras.find(o => o.id === id) || {}).nombre || "";
  const obrasCon = obras.filter(o => mios.some(p => p.obra_id === o.id));
  const enObra = mios.filter(p => !obra || p.obra_id === obra);
  const grupos = { responder: enObra.filter(p => p.estado === "abierto" || p.estado === "en_proceso"), respondidos: enObra.filter(p => p.estado === "respondido"), resueltos: enObra.filter(p => p.estado === "resuelto"), todos: enObra };
  const lista = (grupos[filtro] || []).slice().sort((a, b) => (a.def.limite || "9999").localeCompare(b.def.limite || "9999") || b.ts - a.ts);
  const cur = open ? mios.find(p => p.id === open) : null;

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 10 };
  const wrap = { minHeight: "100%", background: T.bg, color: T.text, paddingTop: "env(safe-area-inset-top)" };
  const inner = { maxWidth: 760, margin: "0 auto", padding: "18px 16px 40px" };

  if (!nombre) return (<div style={wrap}><div style={{ ...inner, paddingTop: 60 }}>
    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".1em", color: T.accent, textTransform: "uppercase" }}>V+V Construcciones</div>
    <div style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 8px" }}>Panel del estudio</div>
    <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.6, marginBottom: 18 }}>Acá ves las definiciones y los planos que te pide la obra, con su fecha límite, y respondés cargando la descripción y la documentación.</div>
    <div style={card}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Nombre del estudio</div>
      <input value={borrador} onChange={e => setBorrador(e.target.value)} placeholder="Ej: Estudio Fernández Arquitectos" style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 13px", fontSize: 16, background: T.bg, color: T.text }} />
      <div style={{ fontSize: 12, color: T.muted, margin: "8px 0 12px" }}>Con este nombre se firman tus respuestas.</div>
      <button onClick={() => { const n = borrador.trim(); if (!n) return; try { localStorage.setItem("estudio_nombre", n); } catch { } setNombre(n); }} style={{ width: "100%", background: T.accent, color: "#fff", border: 0, borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Entrar</button>
    </div>
  </div></div>);

  return (<div style={wrap}><div style={inner}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
      <div><div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: T.accent, textTransform: "uppercase" }}>Panel del estudio · V+V Construcciones</div>
        <div style={{ fontSize: 21, fontWeight: 800, marginTop: 3 }}>{nombre}</div></div>
      <button onClick={() => { try { localStorage.removeItem("estudio_nombre"); } catch { } setNombre(""); }} style={{ background: "none", border: 0, color: T.muted, fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>Cambiar</button>
    </div>
    {error && <div style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}

    {!cur && <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["responder", "Para responder", grupos.responder.length, "#E0A04A"], ["respondidos", "Respondidos", grupos.respondidos.length, "#8B5CF6"], ["resueltos", "Resueltos", grupos.resueltos.length, "#3E9B62"]].map(([k, l, n, c]) => (
          <button key={k} onClick={() => setFiltro(k)} style={{ flex: 1, background: filtro === k ? c : T.card, color: filtro === k ? "#fff" : T.text, border: `1px solid ${filtro === k ? c : T.border}`, borderRadius: 12, padding: "10px 4px", cursor: "pointer" }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{n}</div><div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>{l}</div></button>))}
      </div>
      {obrasCon.length > 1 && <select value={obra} onChange={e => setObra(e.target.value)} style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 12px", fontSize: 15, background: T.card, color: T.text, marginBottom: 12 }}><option value="">Todas las obras</option>{obrasCon.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>}
      {!cargado && <div style={{ textAlign: "center", color: T.muted, padding: 30 }}>Cargando pedidos…</div>}
      {cargado && lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 14, padding: "36px 18px", lineHeight: 1.6 }}>{mios.length === 0 ? "Todavía no te mandaron ningún pedido. Cuando la obra pida una definición o un plano, aparece acá." : "No hay pedidos en esta pestaña."}</div>}
      {lista.map(p => { const ch = chipDef(p), e = ESTADOS[p.estado] || ESTADOS.abierto, d = diasHasta(p.def.limite); return (
        <div key={p.id} onClick={() => { setOpen(p.id); setMsg(""); setAdjMsg([]); }} style={{ ...card, cursor: "pointer", borderLeft: `4px solid ${ch.col}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{p.def.tarea}</div>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: e[1], borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>{e[0]}</span>
          </div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>{p.def.tipo}{nomObra(p.obra_id) ? " · " + nomObra(p.obra_id) : ""} · pedido el {p.fecha}</div>
          {p.def.limite && p.estado !== "resuelto" && p.estado !== "respondido" && <div style={{ fontSize: 12.5, fontWeight: 800, color: ch.col, marginTop: 6 }}>{d < 0 ? "Vencido hace " + (-d) + (d === -1 ? " día" : " días") : d === 0 ? "Vence hoy" : "Necesario antes del " + fmtLimite(p.def.limite) + " (" + d + (d === 1 ? " día" : " días") + ")"}</div>}
        </div>); })}
    </>}

    {cur && (() => { const e = ESTADOS[cur.estado] || ESTADOS.abierto, primero = (cur.hilo || [])[0] || {}; return (<>
      <button onClick={() => setOpen(null)} style={{ background: "none", border: 0, color: T.accent, fontSize: 14, fontWeight: 700, marginBottom: 10, cursor: "pointer", padding: 0 }}>← Volver</button>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div style={{ fontSize: 18, fontWeight: 800 }}>{cur.def.tarea}</div><span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: e[1], borderRadius: 6, padding: "3px 9px", height: "fit-content" }}>{e[0]}</span></div>
        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 4 }}>{cur.def.tipo}{nomObra(cur.obra_id) ? " · Obra: " + nomObra(cur.obra_id) : ""} · prioridad {cur.prioridad}</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", margin: "14px 0 5px" }}>Qué se pidió</div>
        <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{primero.texto}</div>
        <Archivos lista={primero.archivos} />
      </div>
      <RecorridoDef T={T} p={cur} />
      <PanelDefinicion T={T} p={cur} miSide="estudio" subir={subirArchivo} onTomar={() => tomar(cur.id)} onResponder={(t, a) => responder(cur.id, t, a)} />
      <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", margin: "4px 0 8px" }}>Hilo</div>
      {(cur.hilo || []).slice(1).length === 0 && <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>Todavía no hay mensajes.</div>}
      {(cur.hilo || []).slice(1).map((h, i) => { const mine = h.de === "estudio"; return (<div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}><div style={{ maxWidth: "88%" }}>
        <div style={{ background: mine ? T.accent : T.card, color: mine ? "#fff" : T.text, border: mine ? 0 : `1px solid ${T.border}`, borderRadius: mine ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "10px 13px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{h.texto}<Archivos lista={h.archivos} /></div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? (h.nombre || nombre) : (h.de === "cliente" ? "Cliente" : "V+V")} · {h.fecha}</div></div></div>); })}
      {cur.estado !== "resuelto" && <div style={card}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>¿Una duda o una aclaración antes de responder?</div>
        <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} placeholder="Escribí tu consulta…" style={{ width: "100%", border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", fontSize: 16, background: T.bg, color: T.text }} />
        {adjMsg.length > 0 && <div style={{ marginTop: 6, fontSize: 12, color: T.sub }}>{adjMsg.map(a => a.nombre).join(" · ")}</div>}
        <input ref={fileRef} type="file" multiple onChange={adjuntar} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => fileRef.current && fileRef.current.click()} style={{ width: 46, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 18, cursor: "pointer" }}>＋</button>
          <button onClick={() => consultar(cur.id)} disabled={guardando} style={{ flex: 1, background: T.text, color: "#fff", border: 0, borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>{guardando ? "Enviando…" : "Enviar consulta"}</button>
        </div>
      </div>}
    </>); })()}
  </div></div>);
}
