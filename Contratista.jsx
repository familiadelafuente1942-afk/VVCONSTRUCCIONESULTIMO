import React, { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════════
// APP DE CONTRATISTAS — Solo pedidos de materiales
// Mismo backend Supabase que V+V y Belfast → los pedidos se comparten.
// El contratista escribe su empresa (sin clave) y carga pedidos.
// Ve TODOS los pedidos de materiales con su estado.
// ════════════════════════════════════════════════════════════════════

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
const uid = () => Math.random().toString(36).slice(2, 9);
const hoyStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`; };

const BRASS = "#B0894F";
const T = { navy: "#0F1B2D", accent: "#1B3A5B", al: "#EAF0F7", bg: "#F5F7FA", card: "#FFFFFF", border: "#E3E8EF", text: "#0F1B2D", sub: "#5B6B7F", muted: "#94A3B8", rsm: 12, shadow: "0 1px 3px rgba(15,27,45,.06)" };

function origenLabel(p) { return p.de === "vv" ? "V+V" : p.de === "cliente" ? "Belfast" : (p.empresa || "Contratista"); }

export default function ContratistaApp() {
  const [empresa, setEmpresa] = useState(() => { try { return localStorage.getItem("contratista_empresa") || ""; } catch { return ""; } });
  const [tmpEmpresa, setTmpEmpresa] = useState("");
  const [obras, setObras] = useState([]);
  const [matpedidos, setMatpedidos] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [waFor, setWaFor] = useState(null);
  const [form, setForm] = useState(null);
  const [editEmpresa, setEditEmpresa] = useState(false);
  const lastWrite = useRef(0);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const [ro, rm, rp] = await Promise.all([storage.get("vv_obras"), storage.get("vv_matpedidos"), storage.get("vv_personal")]);
        if (!alive) return;
        if (ro?.value) { try { setObras(JSON.parse(ro.value)); } catch { } }
        if (rp?.value) { try { setPersonal(JSON.parse(rp.value)); } catch { } }
        if (rm?.value && Date.now() - lastWrite.current > 4000) { try { const mp = JSON.parse(rm.value); setMatpedidos(prev => JSON.stringify(mp) !== JSON.stringify(prev) ? mp : prev); } catch { } }
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

  function nuevo() { setForm({ obra_id: obras[0]?.id || "", items: [{ nombre: "", cantidad: "", unidad: "u" }], nota: "" }); }
  function addItem() { setForm(f => ({ ...f, items: [...f.items, { nombre: "", cantidad: "", unidad: "u" }] })); }
  function setItem(i, k, v) { setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) })); }
  function delItem(i) { setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) })); }
  async function guardar() {
    const items = (form.items || []).filter(it => (it.nombre || "").trim()).map(it => ({ nombre: it.nombre.trim(), cantidad: it.cantidad != null ? String(it.cantidad) : "", unidad: it.unidad || "u" }));
    if (!items.length) { alert("Agregá al menos un material."); return; }
    const p = { id: uid() + Date.now(), obra_id: form.obra_id, items, nota: form.nota || "", fecha: hoyStr(), ts: Date.now(), de: "contratista", empresa, leido: false, leidoFecha: "" };
    const r = await storage.get("vv_matpedidos"); let arr = []; if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    await persistMat([p, ...arr]); setForm(null); setWaFor(p.id);
    alert("✓ Pedido enviado a V+V y Belfast. Ahora podés mandarlo por WhatsApp al encargado de obra (abajo).");
  }

  async function borrar(id) {
    if (!confirm("¿Eliminar este pedido de materiales? También se quita en V+V y Belfast.")) return;
    const r = await storage.get("vv_matpedidos"); let arr = []; if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    await persistMat(arr.filter(x => x.id !== id));
  }
  const obraNom = id => obras.find(o => o.id === id)?.nombre || "—";
  function waText(p) {
    const lines = p.items.map(it => `• ${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim());
    return `*Pedido de materiales* — ${obraNom(p.obra_id)}\nFecha: ${p.fecha}\nContratista: ${p.empresa || empresa}\n\n${lines.join("\n")}${p.nota ? "\n\nNota: " + p.nota : ""}\n\n✅ Por favor, confirmá la recepción respondiendo este mensaje con *OK / RECIBIDO*.`;
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
  const lista = (matpedidos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));

  if (!empresa || editEmpresa) {
    return (<div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, background: T.card, borderRadius: 16, padding: "28px 24px", boxShadow: "0 8px 30px rgba(15,27,45,.1)", borderTop: `3px solid ${BRASS}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: BRASS, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>V+V Construcciones</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: T.text, marginBottom: 6 }}>Pedidos de materiales</div>
        <div style={{ fontSize: 13, color: T.sub, marginBottom: 20, lineHeight: 1.5 }}>Ingresá el nombre de tu empresa para cargar pedidos de materiales de las obras.</div>
        <input value={tmpEmpresa} onChange={e => setTmpEmpresa(e.target.value)} onKeyDown={e => { if (e.key === "Enter") guardarEmpresa(); }} placeholder="Nombre de tu empresa" autoFocus style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 15px", fontSize: 15, color: T.text, marginBottom: 14, boxSizing: "border-box" }} />
        <button onClick={guardarEmpresa} disabled={!tmpEmpresa.trim()} style={{ width: "100%", background: tmpEmpresa.trim() ? T.navy : T.border, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 14, fontWeight: 700, cursor: tmpEmpresa.trim() ? "pointer" : "default" }}>Entrar</button>
      </div>
    </div>);
  }

  return (<div style={{ minHeight: "100vh", background: T.bg, fontFamily: "Inter, system-ui, sans-serif", maxWidth: 620, margin: "0 auto" }}>
    <div style={{ background: T.navy, color: "#fff", padding: "16px 20px", borderBottom: `2px solid ${BRASS}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, letterSpacing: "0.1em", textTransform: "uppercase" }}>Pedidos de materiales</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{empresa}</div>
      </div>
      <button onClick={() => { setTmpEmpresa(empresa); setEditEmpresa(true); }} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Cambiar</button>
    </div>

    <div style={{ padding: "16px 20px 90px" }}>
      <button onClick={nuevo} style={{ width: "100%", background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 18 }}>＋ Nuevo pedido de materiales</button>

      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Todos los pedidos ({lista.length})</div>
      {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "40px 18px" }}>Todavía no hay pedidos de materiales.</div>}
      {lista.map(p => { const mio = p.de === "contratista" && p.empresa === empresa; return (<div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${p.leido ? "#16A34A" : mio ? BRASS : T.border}`, borderRadius: T.rsm, padding: 13, marginBottom: 9, boxShadow: T.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{obraNom(p.obra_id)} · {p.fecha}</div>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: p.de === "vv" ? T.accent : p.de === "cliente" ? "#7C3AED" : BRASS, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>{origenLabel(p)}</span>
        </div>
        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{p.items.map(it => `• ${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join("\n")}</div>
        {p.nota && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4, fontStyle: "italic" }}>{p.nota}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7, gap: 8 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: p.leido ? "#16A34A" : "#B45309" }}>{p.leido ? `✓ Levantado${p.leidoFecha ? " · " + p.leidoFecha : ""}` : "● Pendiente"}</div>
          {mio && !p.leido && <button onClick={() => borrar(p.id)} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Eliminar</button>}
        </div>
        {p.waEnviado && <div style={{ fontSize: 10, fontWeight: 700, color: "#0E7490", marginTop: 6 }}>📲 Enviado por WhatsApp{p.waEnviadoFecha ? " · " + p.waEnviadoFecha : ""}{p.waEnviadoPor ? " · " + p.waEnviadoPor : ""}</div>}
        <button onClick={() => setWaFor(waFor === p.id ? null : p.id)} style={{ width: "100%", marginTop: 9, background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "9px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>📲 Mandar por WhatsApp al encargado</button>
        {waFor === p.id && <div style={{ marginTop: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 11px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Enviar a…</div>
          {encargados(p.obra_id).map(j => <a key={j.id} href={waLink(waText(p), j.telefono)} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", marginBottom: 7 }}>📲 {j.nombre}{j.rol ? ` · ${j.rol}` : ""}</a>)}
          <a href={waLink(waText(p))} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Elegir contacto…</a>
          {encargados(p.obra_id).length === 0 && <div style={{ fontSize: 10, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>No hay encargado con teléfono cargado para esta obra. Usá "Elegir contacto" o pedile a V+V que cargue el teléfono del encargado.</div>}
        </div>}
      </div>); })}
    </div>

    {form && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setForm(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 620, padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 14 }}>Nuevo pedido de materiales</div>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
        <select value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", fontSize: 14, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }}>
          {obras.length === 0 && <option value="">(sin obras cargadas)</option>}
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>Materiales</div>
        {form.items.map((it, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <input value={it.nombre} onChange={e => setItem(i, "nombre", e.target.value)} placeholder="Material" style={{ flex: 2, minWidth: 0, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text }} />
          <input value={it.cantidad} onChange={e => setItem(i, "cantidad", e.target.value)} placeholder="Cant." type="number" style={{ width: 60, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />
          <input value={it.unidad} onChange={e => setItem(i, "unidad", e.target.value)} placeholder="u" style={{ width: 50, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />
          {form.items.length > 1 && <button onClick={() => delItem(i)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer" }}>✕</button>}
        </div>))}
        <button onClick={addItem} style={{ background: T.al, color: T.accent, border: "none", borderRadius: T.rsm, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>＋ Agregar material</button>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Nota (opcional)</label>
        <textarea value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} rows={2} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text, margin: "6px 0 14px", boxSizing: "border-box", resize: "vertical" }} />
        <button onClick={guardar} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Enviar pedido</button>
      </div>
    </div>}
  </div>);
}
