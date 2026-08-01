import React, { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════════
// PANEL DEL PROPIETARIO — app aparte, solo lectura.
// El dueño de la casa entra con un CÓDIGO (que le da V+V/Belfast, cargado
// en la ficha de la obra) + su nombre. Ve nada más que SU obra: novedades,
// renders, cronograma, informes, actas, checklist, planos.
// Mismo backend Supabase que el resto de las apps de V+V — no escribe
// nada, solo lee.
// ════════════════════════════════════════════════════════════════════

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const SH = () => ({ "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY });
const storage = {
  get: async (key) => {
    try {
      const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { method: "GET", headers: SH(), mode: "cors" });
      if (r.ok) { const d = await r.json(); if (d && d.length > 0) return { value: d[0].value }; }
    } catch { }
    try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; }
  },
  set: async (key, value) => { try { localStorage.setItem(key, value); } catch { } try { await fetch(SUPA_URL + "/rest/v1/bco_storage", { method: "POST", headers: { ...SH(), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ key, value }) }); } catch { } return { value }; },
};
async function subirArchivo(file) {
  try {
    const ext = (file.name || "img").split(".").pop();
    const path = `propietario/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const r = await fetch(`${SUPA_URL}/storage/v1/object/bco-media/${path}`, { method: "POST", headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" }, body: file });
    if (r.ok) return `${SUPA_URL}/storage/v1/object/public/bco-media/${path}`;
  } catch { }
  return null;
}
const fFecha = (iso) => { if (!iso) return ""; const [a, m, d] = String(iso).split("-"); return a && d ? `${d}/${m}/${a.slice(2)}` : String(iso); };

const TBASE = { navy: "#0F1B2D", brass: "#B0894F", bg: "#F5F7FA", card: "#FFFFFF", border: "#E3E8EF", text: "#0F1B2D", sub: "#5B6B7F", muted: "#94A3B8", r: 14, rsm: 12, shadow: "0 1px 3px rgba(15,27,45,.06)" };
function temaDe(cfg) { return { ...TBASE, navy: (cfg && cfg.colorPrincipal) || TBASE.navy, brass: (cfg && cfg.colorAcento) || TBASE.brass }; }
const T = TBASE;

function Ico({ n, s = 18, c = "currentColor", st = 1.7 }) {
  const P = {
    building: "M3 21h18 M5 21V8l7-5 7 5v13 M9 21v-5h6v5 M9 11h1 M14 11h1",
    camera: "M3 8h4l2-2h6l2 2h4v11H3z M12 16a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z",
    calendar: "M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4",
    doc: "M7 3h7l5 5v13H7z M14 3v5h5",
    check: "M6 10V7a6 6 0 1112 0v3 M4 10h16v11H4z M12 15v2",
    checkmark: "M4 12.5l5 5L20 6.5",
    clip: "M9 4h6l1 3h3v14H5V7h3z M9 4a3 3 0 016 0",
    plans: "M3 5h8l2 2h8v12H3z M8 12h8 M8 16h5",
    chat: "M4 5h16v11H9l-5 4z",
    chevron: "M9 6l6 6-6 6",
    back: "M15 6l-6 6 6 6",
    lock: "M6 10V7a6 6 0 1112 0v3 M4 10h16v11H4z M12 15v2",
    bell: "M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z M10.5 20a2 2 0 003 0",
    user: "M12 12a4 4 0 100-8 4 4 0 000 8z M4 21c0-4 3.6-6 8-6s8 2 8 6",
    play: "M8 5l11 7-11 7z",
  }[n] || "M12 21a9 9 0 100-18 9 9 0 000 18z";
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={st} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, verticalAlign: "-3px", display: "inline-block" }}>{P.split(" M").map((d, i) => <path key={i} d={(i ? "M" : "") + d} />)}</svg>;
}

const SECCIONES = [
  { id: "renders", label: "Renders", icon: "camera" },
  { id: "fotos", label: "Fotos de avance", icon: "camera" },
  { id: "cronograma", label: "Cronograma", icon: "calendar" },
  { id: "informes", label: "Informes", icon: "doc" },
  { id: "planos", label: "Planos", icon: "plans" },
];

// ─── Personalización: logo y nombre de la app (queda guardado para todos los que entren) ───
function ConfigModalProp({ config, onSave, onClose }) {
  const T = temaDe(config);
  const [nombre, setNombre] = useState(config.nombre || "");
  const [subtitulo, setSubtitulo] = useState(config.subtitulo || "");
  const [colorPrincipal, setColorPrincipal] = useState(config.colorPrincipal || TBASE.navy);
  const [colorAcento, setColorAcento] = useState(config.colorAcento || TBASE.brass);
  const [logo, setLogo] = useState(config.logo || "");
  const [subiendo, setSubiendo] = useState(false);
  async function subirLogo(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setSubiendo(true); const url = await subirArchivo(f);
    if (url) setLogo(url); else alert("No se pudo subir. Revisá la conexión.");
    setSubiendo(false); e.target.value = "";
  }
  function guardar() { onSave({ nombre: nombre.trim(), subtitulo: subtitulo.trim(), logo, colorPrincipal, colorAcento }); onClose(); }
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(11,22,34,.55)", zIndex: 450, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", padding: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3, letterSpacing: "-0.01em" }}>Personalizar app</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>Cambia el logo y el nombre para todos los que entren acá.</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Logo</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: logo ? "#fff" : T.navy, border: `1.5px solid ${T.brass}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          {logo ? <img src={logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={26} c={T.brass} />}
        </div>
        <label style={{ background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{subiendo ? "Subiendo…" : logo ? "Cambiar logo" : "Subir logo"}<input type="file" accept="image/*" onChange={subirLogo} style={{ display: "none" }} /></label>
        {logo && <button onClick={() => setLogo("")} style={{ background: "none", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 9, padding: "10px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Quitar</button>}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Nombre</div>
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="BELFAST" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 15, fontWeight: 700, color: T.text, boxSizing: "border-box", marginBottom: 14 }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Subtítulo</div>
      <input value={subtitulo} onChange={e => setSubtitulo(e.target.value)} placeholder="Panel del propietario" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, color: T.text, boxSizing: "border-box", marginBottom: 20 }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Diseño</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 5 }}>Color principal (fondo)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px" }}>
            <input type="color" value={colorPrincipal} onChange={e => setColorPrincipal(e.target.value)} style={{ width: 32, height: 32, border: "none", background: "none", padding: 0, cursor: "pointer" }} />
            <span style={{ fontSize: 12, color: T.sub, fontFamily: "monospace" }}>{colorPrincipal}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 5 }}>Color de acento</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px" }}>
            <input type="color" value={colorAcento} onChange={e => setColorAcento(e.target.value)} style={{ width: 32, height: 32, border: "none", background: "none", padding: 0, cursor: "pointer" }} />
            <span style={{ fontSize: 12, color: T.sub, fontFamily: "monospace" }}>{colorAcento}</span>
          </div>
        </div>
      </div>
      {(colorPrincipal !== TBASE.navy || colorAcento !== TBASE.brass) && <button onClick={() => { setColorPrincipal(TBASE.navy); setColorAcento(TBASE.brass); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 10.5, textDecoration: "underline", cursor: "pointer", marginTop: -12, marginBottom: 20, display: "block" }}>Volver a los colores originales</button>}
      <button onClick={guardar} style={{ width: "100%", background: colorAcento, border: "none", color: "#1a1205", borderRadius: 12, padding: "14px", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>Guardar</button>
    </div>
  </div>);
}


function Entrada({ onEntrar, config, onGuardarConfig }) {
  const T = temaDe(config);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);

  async function entrar() {
    const cod = codigo.trim().toUpperCase().replace(/\s+/g, "");
    if (!cod) { setError("Ingresá el código que te dio Belfast."); return; }
    if (!nombre.trim()) { setError("Ingresá tu nombre."); return; }
    setError(""); setBuscando(true);
    try {
      const r = await storage.get("vv_obras");
      const obras = r?.value ? JSON.parse(r.value) : [];
      const obra = obras.find(o => (o.codigoCliente || "").toUpperCase() === cod);
      if (!obra) { setError("No encontré ninguna obra con ese código. Revisalo, o consultá con Belfast."); setBuscando(false); return; }
      try { localStorage.setItem("propietario_codigo", cod); localStorage.setItem("propietario_nombre", nombre.trim()); } catch { }
      onEntrar(cod, nombre.trim());
    } catch { setError("No pude conectar ahora. Probá de nuevo."); }
    setBuscando(false);
  }

  return (<div style={{ minHeight: "100vh", background: T.navy, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 24px", paddingTop: "calc(20px + env(safe-area-inset-top))", paddingBottom: "calc(20px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
    <div style={{ width: 76, height: 76, borderRadius: "50%", border: `2px solid ${T.brass}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px", overflow: "hidden", background: config?.logo ? "#fff" : "none" }}>
      {config?.logo ? <img src={config.logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={32} c={T.brass} />}
    </div>
    <div style={{ textAlign: "center", color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{config?.nombre || "BELFAST"}</div>
    <div style={{ textAlign: "center", color: "rgba(255,255,255,.6)", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 30 }}>{config?.subtitulo || "Panel del propietario"}</div>

    <div style={{ background: "rgba(255,255,255,.06)", borderRadius: T.r, padding: 20, marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Código de tu obra</div>
      <input value={codigo} onChange={e => setCodigo(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="El que te dio Belfast" style={{ width: "100%", background: "rgba(255,255,255,.08)", border: `1px solid rgba(255,255,255,.15)`, borderRadius: 10, padding: "12px 14px", fontSize: 15, fontWeight: 700, color: "#fff", boxSizing: "border-box", textTransform: "uppercase" }} />
    </div>
    <div style={{ background: "rgba(255,255,255,.06)", borderRadius: T.r, padding: 20, marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Tu nombre</div>
      <input value={nombre} onChange={e => setNombre(e.target.value)} onKeyDown={e => e.key === "Enter" && entrar()} placeholder="Nombre y apellido" style={{ width: "100%", background: "rgba(255,255,255,.08)", border: `1px solid rgba(255,255,255,.15)`, borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "#fff", boxSizing: "border-box" }} />
    </div>
    {error && <div style={{ color: "#F87171", fontSize: 12.5, marginBottom: 14, textAlign: "center" }}>{error}</div>}
    <button onClick={entrar} disabled={buscando} style={{ width: "100%", background: T.brass, border: "none", color: "#1a1205", borderRadius: 12, padding: "15px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>{buscando ? "Buscando…" : "Entrar"}</button>
    <button onClick={() => setEditando(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 11, marginTop: 22, cursor: "pointer" }}>⚙ Personalizar app</button>
    {editando && <ConfigModalProp config={config || {}} onSave={onGuardarConfig} onClose={() => setEditando(false)} />}
  </div>);
}

// ─── Fila de sección (lista principal) ───
function FilaSeccion({ label, icon, onClick, config }) {
  const T = temaDe(config);
  return (<button onClick={onClick} style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "16px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
    <div style={{ width: 34, height: 34, borderRadius: 9, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico n={icon} s={17} c={T.navy} /></div>
    <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: T.text }}>{label}</div>
    <Ico n="chevron" s={16} c={T.muted} />
  </button>);
}

function SubHead({ titulo, onBack }) {
  // paddingTop con env(safe-area-inset-top): en el iPhone, con la app
  // instalada en la pantalla de inicio, el contenido arranca DEBAJO del
  // reloj y la señal. Sin esto, el título queda encimado con la hora.
  return (<div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "16px 18px", paddingTop: "calc(16px + env(safe-area-inset-top))", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 5 }}>
    <button onClick={onBack} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.sub }}><Ico n="back" s={16} /></button>
    <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{titulo}</div>
  </div>);
}

function EmptyMsg({ children }) { return <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "40px 20px", lineHeight: 1.6 }}>{children}</div>; }

// ─── Secciones (todas de solo lectura) ───
function SeccionNovedades({ obra, certif, onBack }) {
  // Las novedades son los certificados semanales de avance (lo mismo que ve
  // Belfast en su pantalla de Informes), más los informes cargados a la obra.
  const certs = ((certif || {})[obra.id] || []).slice().sort((a, b) => String(b.desde || "").localeCompare(String(a.desde || "")));
  const items = (obra.informes || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return (<div>
    <SubHead titulo="Novedades" onBack={onBack} />
    <div style={{ padding: 18 }}>
      {certs.length === 0 && items.length === 0 && <EmptyMsg>Todavía no hay novedades cargadas para esta obra.</EmptyMsg>}
      {certs.map(c => (<div key={c.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.brass}`, borderRadius: T.rsm, padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.brass, marginBottom: 5 }}>Semana {fFecha(c.desde)} al {fFecha(c.hasta)}</div>
        {c.desarrollo && <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 8 }}>{c.desarrollo}</div>}
        {[["Recepciones", c.recepciones], ["Limpieza y seguridad", c.limpieza], ["Alertas", c.alertas]].map(([lbl, txt]) => txt ? (
          <div key={lbl} style={{ marginTop: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{lbl}</div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{txt}</div>
          </div>) : null)}
        {(c.av || []).some(a => (a.fotos || []).length || a.fotoUrl) && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginTop: 10 }}>
          {(c.av || []).flatMap(a => (a.fotos && a.fotos.length) ? a.fotos : (a.fotoUrl ? [a.fotoUrl] : [])).map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 7, overflow: "hidden", border: `1px solid ${T.border}` }}><img src={u} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} /></a>))}
        </div>}
      </div>))}
      {items.map((it, i) => (<div key={it.id || i} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.brass}`, borderRadius: T.rsm, padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.brass, marginBottom: 5 }}>{fFecha(it.fecha) || ""}</div>
        <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{it.texto || it.titulo || "Informe cargado."}</div>
      </div>))}
    </div>
  </div>);
}
// Un render es una IMAGEN cargada entre los planos de la obra. Los planos
// técnicos (pdf, dwg) no son renders y no van acá.
const EXT_IMAGEN = ["jpg", "jpeg", "png", "webp", "avif", "heic"];
function esRender(p) {
  const ext = String(p.tipo || (p.nombre || "").split(".").pop() || "").toLowerCase();
  if (/render/i.test(p.nombre || "")) return true;
  return EXT_IMAGEN.includes(ext);
}
// Primero los renders subidos a mano desde Belfast (Ajustes). Si esa obra
// no tiene ninguno cargado, se cae a los planos que sean imagen, como antes.
function rendersDe(obra, renders) {
  const propios = ((renders || {})[obra.id] || []);
  if (propios.length) return propios;
  return (obra.planos || []).filter(esRender);
}

function SeccionRenders({ obra, renders, onBack }) {
  const lista = rendersDe(obra, renders);
  return (<div>
    <SubHead titulo="Renders" onBack={onBack} />
    <div style={{ padding: 18 }}>
      {lista.length === 0 && <EmptyMsg>Todavía no hay renders cargados para esta obra.</EmptyMsg>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {lista.map((f, i) => <a key={f.id || i} href={f.url} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
          <img src={f.url} alt={f.nombre || ""} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
        </a>)}
      </div>
    </div>
  </div>);
}

// Las fotos son las del AVANCE DE OBRA (lo que se va viendo en el tiempo),
// no los renders. Vienen agrupadas por fecha.
function SeccionFotos({ obra, avance, onBack, config }) {
  const T = temaDe(config);
  const historial = ((avance || {})[obra.id] || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const conFotos = historial.map(h => ({ ...h, fotos: (h.fotos && h.fotos.length) ? h.fotos : (h.fotoUrl ? [h.fotoUrl] : []) })).filter(h => h.fotos.length);
  return (<div>
    <SubHead titulo="Fotos de avance" onBack={onBack} />
    <div style={{ padding: 18 }}>
      {conFotos.length === 0 && <EmptyMsg>Todavía no hay fotos de avance cargadas.</EmptyMsg>}
      {conFotos.map((h, i) => (<div key={h.id || i} style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: T.brass, marginBottom: 7 }}>{fFecha(h.fecha) || h.fecha}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {h.fotos.map((u, j) => <a key={j} href={u} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
            <img src={u} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
          </a>)}
        </div>
        {h.descripcion && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 7, lineHeight: 1.5 }}>{h.descripcion}</div>}
      </div>))}
    </div>
  </div>);
}
function SeccionCronograma({ obra, tareas, onBack, config }) {
  const T = temaDe(config);
  const propias = (tareas || []).filter(t => t.obra_id === obra.id);
  return (<div>
    <SubHead titulo="Cronograma" onBack={onBack} />
    <div style={{ padding: 18 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.r, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.sub }}>Avance general de obra</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.brass }}>{obra.avance || 0}%</div>
        </div>
        <div style={{ height: 8, background: T.bg, borderRadius: 6, overflow: "hidden" }}><div style={{ height: 8, width: `${obra.avance || 0}%`, background: T.brass }} /></div>
        {(obra.inicio || obra.cierre) && <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>{obra.inicio ? `Inicio: ${obra.inicio}` : ""}{obra.inicio && obra.cierre ? " · " : ""}{obra.cierre ? `Cierre estimado: ${obra.cierre}` : ""}</div>}
      </div>
      {propias.length === 0 && <EmptyMsg>Todavía no hay etapas cargadas en detalle.</EmptyMsg>}
      {propias.map((t, i) => (<div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, fontSize: 13, color: T.text }}>{t.nombre}</div>
        <div style={{ width: 80, height: 6, background: T.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: 6, width: `${t.avance || 0}%`, background: T.brass }} /></div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, width: 34, textAlign: "right" }}>{t.avance || 0}%</div>
      </div>))}
    </div>
  </div>);
}
function SeccionInformes({ obra, envios, onBack, config }) {
  const T = temaDe(config);
  const [doc, setDoc] = useState(null);
  // Lo que Belfast le mandó al propietario, con la marca de Belfast.
  // Solo lo que Belfast marcó para el propietario.
  const items = ((envios || {})[obra.id] || []).filter(x => x.prop).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));

  if (doc) return (<div style={{ position: "fixed", inset: 0, background: "#1a2433", zIndex: 400, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "calc(10px + env(safe-area-inset-top)) 12px 10px" }}>
      <button onClick={() => setDoc(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>← Volver</button>
      <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.titulo}</span>
      <button onClick={() => { const f = document.getElementById("doc-prop"); if (f?.contentWindow) f.contentWindow.print(); }} style={{ background: T.brass, border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Imprimir / PDF</button>
    </div>
    <iframe id="doc-prop" srcDoc={doc.html} title={doc.titulo} style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
  </div>);

  return (<div>
    <SubHead titulo="Informes" onBack={onBack} />
    <div style={{ padding: 18 }}>
      {items.length === 0 && <EmptyMsg>Todavía no hay informes disponibles para esta obra.</EmptyMsg>}
      {items.map(it => (<button key={it.id} onClick={() => setDoc(it)} style={{ width: "100%", textAlign: "left", background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.brass}`, borderRadius: T.rsm, padding: 14, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>{it.titulo}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{it.tipo === "cert" ? "Certificado semanal" : "Informe de avance"}</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.brass, flexShrink: 0 }}>Ver →</div>
      </button>))}
    </div>
  </div>);
}
function SeccionActas({ obra, auditoria, onBack }) {
  const items = (auditoria || []).filter(a => a.obra_id === obra.id).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const ETQ = { supervision: "Supervisión", revision: "Revisión de doc.", certificacion: "Certificación" };
  return (<div>
    <SubHead titulo="Actas" onBack={onBack} />
    <div style={{ padding: 18 }}>
      {items.length === 0 && <EmptyMsg>Todavía no hay actas cargadas.</EmptyMsg>}
      {items.map((it, i) => (<div key={it.id || i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>{ETQ[it.tipo] || "Acta"} — {it.nro}</div>
          <div style={{ fontSize: 11, color: T.muted }}>{fFecha(it.fecha)}</div>
        </div>
        {it.resultado && <div style={{ fontSize: 12, color: it.resultado === "Conforme" ? "#16A34A" : T.sub, fontWeight: 700 }}>{it.resultado}</div>}
        {it.conclusion && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>{it.conclusion}</div>}
      </div>))}
    </div>
  </div>);
}
function SeccionChecklist({ obra, formularios, onBack }) {
  const items = (formularios || []).filter(f => f.obra_id === obra.id).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return (<div>
    <SubHead titulo="Checklist" onBack={onBack} />
    <div style={{ padding: 18 }}>
      {items.length === 0 && <EmptyMsg>Todavía no hay checklists cargados.</EmptyMsg>}
      {items.map((it, i) => (<div key={it.id || i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>{it.nombre || "Checklist"}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{fFecha(it.fecha)}</div>
        </div>
        {it.resultado && <div style={{ fontSize: 11.5, fontWeight: 700, color: it.resultado?.includes("No") ? "#DC2626" : "#16A34A" }}>{it.resultado}</div>}
      </div>))}
    </div>
  </div>);
}
function SeccionPlanos({ obra, onBack, config }) {
  const T = temaDe(config);
  const items = obra.planos || [];
  return (<div>
    <SubHead titulo="Planos" onBack={onBack} />
    <div style={{ padding: 18 }}>
      {items.length === 0 && <EmptyMsg>Todavía no hay planos cargados.</EmptyMsg>}
      {items.map((it, i) => (<a key={it.id || i} href={it.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 11, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: 13, marginBottom: 9, textDecoration: "none" }}>
        <Ico n="plans" s={20} c={T.brass} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.nombre}</div>
          <div style={{ fontSize: 11, color: T.muted }}>{fFecha(it.fecha)}</div>
        </div>
      </a>))}
    </div>
  </div>);
}
function SeccionMensajes({ onBack }) {
  return (<div>
    <SubHead titulo="Mensajes" onBack={onBack} />
    <div style={{ padding: 18 }}>
      <EmptyMsg>La mensajería directa con Belfast todavía no está disponible acá — por ahora, para cualquier consulta, contactalos por los medios habituales.</EmptyMsg>
    </div>
  </div>);
}

// ─── Panel principal ───
function Panel({ obra, nombreCliente, tareas, auditoria, formularios, avance, renders, certif, envios, config, onGuardarConfig }) {
  const T = temaDe(config);
  const [seccion, setSeccion] = useState(null);
  const [idx, setIdx] = useState(0);
  const [editando, setEditando] = useState(false);
  // En el banner van los RENDERS (cómo va a quedar), no las fotos de obra.
  const fotos = rendersDe(obra, renders);   // lo que rota en el banner
  useEffect(() => {
    if (fotos.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % fotos.length), 3800);
    return () => clearInterval(t);
  }, [fotos.length]);

  if (seccion === "renders") return <SeccionRenders obra={obra} renders={renders} onBack={() => setSeccion(null)} />;
  if (seccion === "fotos") return <SeccionFotos obra={obra} avance={avance} onBack={() => setSeccion(null)} config={config} />;
  if (seccion === "cronograma") return <SeccionCronograma obra={obra} tareas={tareas} onBack={() => setSeccion(null)} config={config} />;
  if (seccion === "informes") return <SeccionInformes obra={obra} envios={envios} onBack={() => setSeccion(null)} config={config} />;
  if (seccion === "planos") return <SeccionPlanos obra={obra} onBack={() => setSeccion(null)} config={config} />;

  return (<div style={{ minHeight: "100vh", background: T.bg }}>
    <div style={{ position: "relative", height: "calc(280px + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)", boxSizing: "border-box", background: T.navy, overflow: "hidden" }}>
      {fotos.map((f, i) => <div key={f.id || i} style={{ position: "absolute", inset: 0, backgroundImage: `url(${f.url})`, backgroundSize: "cover", backgroundPosition: "center", opacity: i === idx ? 1 : 0, transition: "opacity 1.4s ease" }} />)}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,27,45,.55) 0%, rgba(15,27,45,.25) 40%, rgba(15,27,45,.92) 100%)" }} />
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", border: `1.5px solid ${T.brass}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, overflow: "hidden", background: config?.logo ? "#fff" : "none" }}>
          {config?.logo ? <img src={config.logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={22} c={T.brass} />}
        </div>
        <div style={{ color: "rgba(255,255,255,.7)", fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 3 }}>Tu proyecto</div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, lineHeight: 1.15 }}>{obra.nombre}</div>
        <div style={{ width: "70%", maxWidth: 260, marginTop: 16 }}>
          <div style={{ height: 5, background: "rgba(255,255,255,.2)", borderRadius: 4, overflow: "hidden" }}><div style={{ height: 5, width: `${obra.avance || 0}%`, background: T.brass }} /></div>
          <div style={{ color: "rgba(255,255,255,.75)", fontSize: 11, marginTop: 6 }}>Avance {obra.avance || 0}%</div>
        </div>
      </div>
    </div>
    <div style={{ padding: "20px 18px 40px" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Secciones</div>
      {SECCIONES.map(s => <FilaSeccion key={s.id} label={s.label} icon={s.icon} onClick={() => setSeccion(s.id)} config={config} />)}
      <div style={{ textAlign: "center", fontSize: 11, color: T.muted, marginTop: 20 }}>Hola, {nombreCliente} · <button onClick={() => { try { localStorage.removeItem("propietario_codigo"); localStorage.removeItem("propietario_nombre"); } catch { } window.location.reload(); }} style={{ background: "none", border: "none", color: T.brass, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}>Salir</button></div>
      <div style={{ textAlign: "center", marginTop: 10 }}><button onClick={() => setEditando(true)} style={{ background: "none", border: "none", color: T.muted, fontSize: 10.5, cursor: "pointer" }}>⚙ Personalizar app</button></div>
    </div>
    {editando && <ConfigModalProp config={config || {}} onSave={onGuardarConfig} onClose={() => setEditando(false)} />}
  </div>);
}

export default function ClientePropietarioApp() {
  const [estado, setEstado] = useState("cargando"); // cargando | entrada | panel | error
  const [obra, setObra] = useState(null);
  const [nombreCliente, setNombreCliente] = useState("");
  const [config, setConfig] = useState({});
  const [extra, setExtra] = useState({ tareas: [], auditoria: [], formularios: [], avance: {}, renders: {}, certif: {}, envios: {} });

  async function guardarConfig(next) {
    setConfig(next);
    await storage.set("vv_propietario_config", JSON.stringify(next));
  }

  async function cargarObra(codigo, nombre) {
    try {
      const [ro, rt, ra, rf, rav, rr, rc, re] = await Promise.all([
        storage.get("vv_obras"), storage.get("vv_tareas"), storage.get("vv_auditoria"), storage.get("vv_formularios"), storage.get("vv_avance"), storage.get("vv_renders"), storage.get("vv_certif_sem"), storage.get("cliente_envios_prop"),
      ]);
      const obras = ro?.value ? JSON.parse(ro.value) : [];
      const encontrada = obras.find(o => (o.codigoCliente || "").toUpperCase() === codigo.toUpperCase());
      if (!encontrada) { setEstado("entrada"); return; }
      setObra(encontrada);
      setNombreCliente(nombre);
      setExtra({
        tareas: rt?.value ? JSON.parse(rt.value) : [],
        auditoria: ra?.value ? JSON.parse(ra.value) : [],
        formularios: rf?.value ? JSON.parse(rf.value) : [],
        avance: rav?.value ? JSON.parse(rav.value) : {},
        renders: rr?.value ? JSON.parse(rr.value) : {},
        certif: rc?.value ? JSON.parse(rc.value) : {},
        envios: re?.value ? JSON.parse(re.value) : {},
      });
      setEstado("panel");
    } catch { setEstado("entrada"); }
  }

  useEffect(() => {
    storage.get("vv_propietario_config").then(r => { if (r?.value) { try { setConfig(JSON.parse(r.value)); } catch { } } });
    let cod = null, nom = null;
    try { cod = localStorage.getItem("propietario_codigo"); nom = localStorage.getItem("propietario_nombre"); } catch { }
    if (cod && nom) cargarObra(cod, nom); else setEstado("entrada");
  }, []);

  if (estado === "cargando") return <div style={{ minHeight: "100vh", background: T.navy }} />;
  if (estado === "entrada") return <Entrada onEntrar={cargarObra} config={config} onGuardarConfig={guardarConfig} />;
  return <Panel obra={obra} nombreCliente={nombreCliente} tareas={extra.tareas} auditoria={extra.auditoria} formularios={extra.formularios} avance={extra.avance} renders={extra.renders} certif={extra.certif} envios={extra.envios} config={config} onGuardarConfig={guardarConfig} />;
}
