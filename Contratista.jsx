import React, { useState, useEffect, useRef } from "react";

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

let BRASS = "#B0894F";
let T = { navy: "#0F1B2D", accent: "#1B3A5B", al: "#EAF0F7", bg: "#F5F7FA", card: "#FFFFFF", border: "#E3E8EF", text: "#0F1B2D", sub: "#5B6B7F", muted: "#94A3B8", rsm: 12, shadow: "0 1px 3px rgba(15,27,45,.06)" };
const PALETAS = {
  institucional: { nombre: "Institucional", navy: "#0F1B2D", accent: "#1B3A5B", al: "#EAF0F7", bg: "#F5F7FA", brass: "#B0894F" },
  grafito: { nombre: "Grafito", navy: "#1F2937", accent: "#374151", al: "#EEF1F5", bg: "#F4F5F7", brass: "#9CA3AF" },
  pino: { nombre: "Verde pino", navy: "#14342B", accent: "#22463A", al: "#E7F0EB", bg: "#F4F7F5", brass: "#C79A3E" },
  vino: { nombre: "Vino", navy: "#3B1220", accent: "#6B2338", al: "#F6E9EE", bg: "#FAF5F6", brass: "#C79A3E" },
  arena: { nombre: "Arena", navy: "#3A2E1E", accent: "#6B5637", al: "#F3EDE2", bg: "#FAF7F1", brass: "#C79A3E" },
  negro: { nombre: "Negro", navy: "#111214", accent: "#2A2C31", al: "#EDEEF0", bg: "#F5F5F6", brass: "#C9A25A" },
};
function aplicarTema(id) { const p = PALETAS[id] || PALETAS.institucional; T.navy = p.navy; T.accent = p.accent; T.al = p.al; T.bg = p.bg; BRASS = p.brass; try { localStorage.setItem("contratista_tema", id); } catch { } }
try { aplicarTema(localStorage.getItem("contratista_tema") || "institucional"); } catch { }

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
  const [estiloOpen, setEstiloOpen] = useState(false);
  const [temaId, setTemaId] = useState(() => { try { return localStorage.getItem("contratista_tema") || "institucional"; } catch { return "institucional"; } });
  const lastWrite = useRef(0);

  useEffect(() => { initPush("contratista"); }, []);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const [ro, rm, rp] = await Promise.all([storage.get("vv_obras"), storage.get("vv_matpedidos"), storage.get("vv_personal")]);
        if (!alive) return;
        if (ro?.value) { try { setObras(JSON.parse(ro.value)); } catch { } }
        if (rp?.value) { try { setPersonal(JSON.parse(rp.value)); } catch { } }
        if (rm?.value && Date.now() - lastWrite.current > 8000) { try { const mp = JSON.parse(rm.value); setMatpedidos(prev => JSON.stringify(mp) !== JSON.stringify(prev) ? mp : prev); } catch { } }
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

  function nuevo() { setForm({ obra_id: obras[0]?.id || "", items: [{ nombre: "", cantidad: "", unidad: "u" }], nota: "", fecha_pedido: new Date().toISOString().slice(0, 10), fecha_necesita: "" }); }
  function editar(p) { setForm({ id: p.id, obra_id: p.obra_id, items: (p.items && p.items.length ? p.items.map(it => ({ nombre: it.nombre || "", cantidad: it.cantidad != null ? String(it.cantidad) : "", unidad: it.unidad || "u" })) : [{ nombre: "", cantidad: "", unidad: "u" }]), nota: p.nota || "", fecha_pedido: p.fecha_pedido || "", fecha_necesita: p.fecha_necesita || "" }); }
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
  function addItem() { setForm(f => ({ ...f, items: [...f.items, { nombre: "", cantidad: "", unidad: "u" }] })); }
  function setItem(i, k, v) { setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) })); }
  function delItem(i) { setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) })); }
  async function guardar() {
    const items = (form.items || []).filter(it => (it.nombre || "").trim()).map(it => ({ nombre: it.nombre.trim(), cantidad: it.cantidad != null ? String(it.cantidad) : "", unidad: it.unidad || "u" }));
    if (!items.length) { alert("Agregá al menos un material."); return; }
    const r = await storage.get("vv_matpedidos"); let arr = []; if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    if (form.id) {
      const next = arr.map(x => x.id === form.id ? { ...x, obra_id: form.obra_id, items, nota: form.nota || "", fecha_pedido: form.fecha_pedido || "", fecha_necesita: form.fecha_necesita || "", editadoFecha: hoyStr() } : x);
      const pid = form.id; await persistMat(next); setForm(null); setWaFor(pid);
      alert("✓ Pedido actualizado. Ya se ve así en V+V y Belfast. Podés reenviarlo por WhatsApp abajo.");
      return;
    }
    const p = { id: uid() + Date.now(), obra_id: form.obra_id, items, nota: form.nota || "", fecha: hoyStr(), fecha_pedido: form.fecha_pedido || "", fecha_necesita: form.fecha_necesita || "", ts: Date.now(), de: "contratista", empresa, leido: false, leidoFecha: "" };
    await persistMat([p, ...arr]); setForm(null); setWaFor(p.id);
    pushNotify("Nuevo pedido de materiales", `${empresa}: ${items.map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ").slice(0, 90)}`, "");
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
    return `*Pedido de materiales* — ${obraNom(p.obra_id)}\nFecha: ${p.fecha}${p.fecha_necesita ? `\n📅 *Necesito en obra: ${fmtISO(p.fecha_necesita)}*` : ""}\nContratista: ${p.empresa || empresa}\n\n${lines.join("\n")}${p.nota ? "\n\nNota: " + p.nota : ""}\n\n✅ Por favor, confirmá la recepción respondiendo este mensaje con *OK / RECIBIDO*.`;
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
        <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, letterSpacing: "0.1em", textTransform: "uppercase" }}>Pedidos de materiales · v2</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{empresa}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setEstiloOpen(true)} title="Cambiar estilo" style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>🎨 Estilo</button>
        <button onClick={() => { setTmpEmpresa(empresa); setEditEmpresa(true); }} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Cambiar</button>
      </div>
    </div>
    {estiloOpen && <div onClick={() => setEstiloOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,27,45,.45)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", padding: "18px 20px 26px", width: "100%", maxWidth: 620, boxShadow: "0 -6px 24px rgba(0,0,0,.15)" }}>
        <div style={{ width: 40, height: 4, background: T.border, borderRadius: 4, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 3 }}>Estilo de la app</div>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 16 }}>Elegí una paleta. Se guarda en este dispositivo.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {Object.entries(PALETAS).map(([id, p]) => (<button key={id} onClick={() => { aplicarTema(id); setTemaId(id); setEstiloOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, background: T.bg, border: `2px solid ${temaId === id ? p.brass : T.border}`, borderRadius: 12, padding: "11px 12px", cursor: "pointer", textAlign: "left" }}>
            <div style={{ display: "flex", flexShrink: 0 }}><span style={{ width: 20, height: 20, borderRadius: "50% 0 0 50%", background: p.navy }} /><span style={{ width: 20, height: 20, borderRadius: "0 50% 50% 0", background: p.brass }} /></div>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{p.nombre}{temaId === id ? " ✓" : ""}</span>
          </button>))}
        </div>
      </div>
    </div>}

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
        {p.fecha_necesita && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.al, color: T.accent, borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 700 }}>📅 Necesito en obra: {fmtISO(p.fecha_necesita)}</div>
          <a href={icsEntrega(p)} download={`Entrega-${obraNom(p.obra_id).replace(/[^\w]/g, "_")}.ics`} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.navy, color: "#fff", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}>🔔 Agendar + alerta</a>
        </div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7, gap: 8 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: p.leido ? "#16A34A" : "#B45309" }}>{p.leido ? `✓ Levantado${p.leidoFecha ? " · " + p.leidoFecha : ""}` : "● Pendiente"}</div>
          {mio && <div style={{ display: "flex", gap: 6, flexShrink: 0 }}><button onClick={() => editar(p)} style={{ background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Editar</button><button onClick={() => borrar(p.id)} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Eliminar</button></div>}
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
        <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 14 }}>{form.id ? "Editar pedido de materiales" : "Nuevo pedido de materiales"}</div>
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
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Nota (opcional)</label>
        <textarea value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} rows={2} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text, margin: "6px 0 14px", boxSizing: "border-box", resize: "vertical" }} />
        <button onClick={guardar} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{form.id ? "Guardar cambios" : "Enviar pedido"}</button>
      </div>
    </div>}
  </div>);
}
