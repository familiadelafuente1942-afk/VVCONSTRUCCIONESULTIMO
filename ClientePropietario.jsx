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
// Registra que la app se abrió — usado por NEXO Control para saber
// cuántas personas usan cada vista. No interfiere con nada existente.
function registrarApertura(appTag) {
  try {
    const key = "apertura:" + appTag + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);
    const valor = JSON.stringify({ app: appTag, ts: new Date().toISOString() });
    storage.set(key, valor).catch(() => {});
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
        app: "propietario",
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
function temaDe(cfg) { return { ...TBASE, navy: (cfg && cfg.colorPrincipal) || TBASE.navy, brass: (cfg && cfg.colorAcento) || TBASE.brass, bg: (cfg && cfg.colorFondo) || TBASE.bg }; }
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
  { id: "novedades", label: "Novedades", icon: "doc" },
  { id: "certificados", label: "Certificados", icon: "doc" },
  { id: "renders", label: "Renders", icon: "camera" },
  { id: "fotos", label: "Informe de avance", icon: "camera" },
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
  const [colorFondo, setColorFondo] = useState(config.colorFondo || TBASE.bg);
  function guardar() { onSave({ nombre: nombre.trim(), subtitulo: subtitulo.trim(), colorPrincipal, colorAcento, colorFondo }); onClose(); }
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(11,22,34,.55)", zIndex: 450, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", padding: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3, letterSpacing: "-0.01em" }}>Personalizar app</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>El logo es siempre el de Belfast (Belfast es quien te da el acceso) — no se cambia acá. Solo podés elegir cómo querés VER la app: el nombre y los colores.</div>
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
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 5 }}>Color de fondo (pantallas internas)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px" }}>
          <input type="color" value={colorFondo} onChange={e => setColorFondo(e.target.value)} style={{ width: 32, height: 32, border: "none", background: "none", padding: 0, cursor: "pointer" }} />
          <span style={{ fontSize: 12, color: T.sub, fontFamily: "monospace" }}>{colorFondo}</span>
        </div>
      </div>
      {(colorPrincipal !== TBASE.navy || colorAcento !== TBASE.brass || colorFondo !== TBASE.bg) && <button onClick={() => { setColorPrincipal(TBASE.navy); setColorAcento(TBASE.brass); setColorFondo(TBASE.bg); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 10.5, textDecoration: "underline", cursor: "pointer", marginTop: -12, marginBottom: 20, display: "block" }}>Volver a los colores originales</button>}
      <button onClick={guardar} style={{ width: "100%", background: colorAcento, border: "none", color: "#1a1205", borderRadius: 12, padding: "14px", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>Guardar</button>
    </div>
  </div>);
}


function Entrada({ onEntrar, config, onGuardarConfig, codigoInicial, proyectoUrl, logoBelfast }) {
  const T = temaDe(config);
  const [codigo, setCodigo] = useState(codigoInicial || "");
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
    <div style={{ width: 76, height: 76, borderRadius: "50%", border: `2px solid ${T.brass}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px", overflow: "hidden", background: logoBelfast ? "#fff" : "none" }}>
      {logoBelfast ? <img src={logoBelfast} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={32} c={T.brass} />}
    </div>
    <div style={{ textAlign: "center", color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{proyectoUrl || config?.nombre || "BELFAST"}</div>
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
// ─── Cuadro de sección (grilla 3 columnas, panel principal) ───
function CuadroSeccion({ label, onClick, config }) {
  const T = temaDe(config);
  return (<button onClick={onClick} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 6px", height: 52, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer" }}>
    <span style={{ fontSize: 9.5, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>{label}</span>
  </button>);
}

function SubHead({ titulo, onBack, config }) {
  const T = temaDe(config);
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
// Certificados de conformidad de etapas, firmados por el auditor (Héctor
// Ayala). Se cargan desde V+V/Belfast; acá es solo lectura.
function SeccionCertificados({ obra, certConformidad, onBack }) {
  const certs = (certConformidad || []).filter(c => c.obra_id === obra.id).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return (<div>
    <SubHead titulo="Certificados" onBack={onBack} />
    <div style={{ padding: 18 }}>
      {certs.length === 0 && <EmptyMsg>Todavía no hay certificados de conformidad cargados para esta obra.</EmptyMsg>}
      {certs.map(c => (
        <a key={c.id} href={c.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.brass}`, borderRadius: T.rsm, padding: 14, marginBottom: 10, textDecoration: "none" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{c.nombre}</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{fFecha(c.fecha)}{c.auditor ? ` · Auditor: ${c.auditor}` : ""}</div>
          </div>
          <span style={{ color: T.brass, fontWeight: 700, fontSize: 12 }}>Ver →</span>
        </a>
      ))}
    </div>
  </div>);
}
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

// La galería general: son las fotos de la obra cargadas en la pestaña
// "Fotos" de Belfast/Constructora (obra.fotos) — el mismo álbum que ven
// ellos, distinto del informe semanal de avance.
function SeccionGaleria({ obra, onBack, config }) {
  const T = temaDe(config);
  const fotos = (obra.fotos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return (<div style={{ minHeight: "100vh", background: T.bg }}>
    <SubHead titulo="Galería de obra" onBack={onBack} config={config} />
    <div style={{ padding: 18 }}>
      {fotos.length === 0 && <EmptyMsg>Todavía no hay fotos cargadas en la galería de esta obra.</EmptyMsg>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {fotos.map((f, i) => <a key={f.id || i} href={f.url} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
          <img src={f.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
        </a>)}
      </div>
    </div>
  </div>);
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
  return (<div style={{ minHeight: "100vh", background: T.bg }}>
    <SubHead titulo="Informe de avance" onBack={onBack} config={config} />
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
  return (<div style={{ minHeight: "100vh", background: T.bg }}>
    <SubHead titulo="Cronograma" onBack={onBack} config={config} />
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

  return (<div style={{ minHeight: "100vh", background: T.bg }}>
    <SubHead titulo="Informes" onBack={onBack} config={config} />
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
  return (<div style={{ minHeight: "100vh", background: T.bg }}>
    <SubHead titulo="Planos" onBack={onBack} config={config} />
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
function moneyAR(n) { return "$" + Math.round(Number(n) || 0).toLocaleString("es-AR"); }
const fmtMiles = (v) => { const s = String(v == null ? "" : v).replace(/\D/g, ""); return s ? Number(s).toLocaleString("es-AR") : ""; };
const numMiles = (v) => { const s = String(v == null ? "" : v).replace(/\D/g, ""); return s ? Number(s) : 0; };
function arsUnif(c, cotU) { const n = Number(c.monto) || 0; if (c.moneda === "ars") return n; if (c.moneda === "usd") return cotU > 0 ? n * cotU : (Number(c.montoArs) || 0); return Number(c.montoArs) || 0; }
function usdUnif(c, cotU) { const n = Number(c.monto) || 0; if (c.moneda === "usd") return n; if (c.moneda === "ars") return cotU > 0 ? n / cotU : (Number(c.montoUsd) || 0); return Number(c.montoUsd) || 0; }
function usdFmt(n) { return "USD " + Math.round(Number(n) || 0).toLocaleString("es-AR"); }
function SeccionCostos({ costos, onGuardarPropia, onCrearPropia, onBack, config }) {
  const T = temaDe(config);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({ cat: "", monto: "", moneda: "ars", nota: "" });
  const [guardando, setGuardando] = useState(false);
  const sup0 = Number(costos?.m2) || 0;
  const vU0 = Number(costos?.ventaUsd) || 0;
  const vA0 = Number(costos?.ventaArs) || 0;
  const cot0 = Number(costos?.cotizUnif) || 0;
  const [supTxt, setSupTxt] = useState(sup0 ? fmtMiles(sup0) : "");
  const [vUTxt, setVUTxt] = useState(vU0 ? fmtMiles(vU0) : "");
  const [vATxt, setVATxt] = useState(vA0 ? fmtMiles(vA0) : "");
  const [cotTxt, setCotTxt] = useState(cot0 ? fmtMiles(cot0) : "");
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState({ cat: "", monto: "", moneda: "ars", nota: "" });
  const [catNuevaModo, setCatNuevaModo] = useState(false);
  useEffect(() => { setSupTxt(sup0 ? fmtMiles(sup0) : ""); }, [sup0]);
  useEffect(() => { setVUTxt(vU0 ? fmtMiles(vU0) : ""); }, [vU0]);
  useEffect(() => { setVATxt(vA0 ? fmtMiles(vA0) : ""); }, [vA0]);
  useEffect(() => { setCotTxt(cot0 ? fmtMiles(cot0) : ""); }, [cot0]);

  if (!costos) {
    return (<div style={{ minHeight: "100vh", background: T.bg }}>
      <SubHead titulo="Costos" onBack={onBack} config={config} />
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.5 }}>Todavía no hay una obra particular vinculada en Finanzas para cargar costos acá.</div>
        <button disabled={creando} onClick={async () => { setCreando(true); await onCrearPropia?.(); setCreando(false); }} style={{ background: T.brass, border: "none", color: "#fff", borderRadius: 12, padding: "13px 22px", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>{creando ? "Creando…" : "+ Empezar a cargar costos"}</button>
      </div>
    </div>);
  }

  const lista = (costos.costos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const cotU = Number(costos.cotizUnif) || 0;
  const sup = sup0;
  const totArs = lista.reduce((s, c) => s + arsUnif(c, cotU), 0);
  const totUsd = lista.reduce((s, c) => s + usdUnif(c, cotU), 0);
  const vU = vU0, vA = vA0;
  const resU = vU - totUsd, resA = vA - totArs, mgU = vU > 0 ? resU / vU * 100 : 0;
  const porRubro = {};
  lista.forEach(c => { const k = c.cat || "Otros"; porRubro[k] = (porRubro[k] || 0) + arsUnif(c, cotU); });
  const rubros = Object.entries(porRubro).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  const inpEd = { width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px", fontSize: 13, color: T.text, boxSizing: "border-box" };
  function agregarGasto() {
    const monto = Number(nuevo.monto) || 0;
    if (!nuevo.cat.trim() || monto <= 0) return;
    setGuardando(true);
    const catNorm = nuevo.cat.trim().toLowerCase();
    const existente = (costos.costos || []).find(c => (c.cat || "").trim().toLowerCase() === catNorm && (c.moneda === "usd") === (nuevo.moneda === "usd"));
    if (existente) {
      onGuardarPropia(p => ({ ...p, costos: (p.costos || []).map(x => x.id === existente.id ? { ...x, monto: (Number(x.monto) || 0) + monto, montoArs: nuevo.moneda === "ars" ? (Number(x.montoArs) || 0) + monto : x.montoArs, montoUsd: nuevo.moneda === "usd" ? (Number(x.montoUsd) || 0) + monto : x.montoUsd, nota: nuevo.nota.trim() || x.nota } : x) })).finally(() => setGuardando(false));
    } else {
      const item = { id: (Date.now().toString(36)), ts: Date.now(), cat: nuevo.cat.trim(), moneda: nuevo.moneda, monto, montoArs: nuevo.moneda === "ars" ? monto : 0, montoUsd: nuevo.moneda === "usd" ? monto : 0, nota: nuevo.nota.trim(), fecha: new Date().toISOString().slice(0, 10) };
      onGuardarPropia(p => ({ ...p, costos: [...(p.costos || []), item] })).finally(() => setGuardando(false));
    }
    setNuevo({ cat: "", monto: "", moneda: "ars", nota: "" });
    setCatNuevaModo(false);
  }
  function borrarGasto(id) {
    if (!window.confirm("¿Borrar este gasto?")) return;
    onGuardarPropia(p => ({ ...p, costos: (p.costos || []).filter(c => c.id !== id) }));
  }

  function abrirEdicion(c) {
    setEditandoId(c.id);
    setEditForm({ cat: c.cat || "", monto: fmtMiles(c.moneda === "usd" ? (c.montoUsd || c.monto) : (c.montoArs || c.monto)), moneda: c.moneda === "usd" ? "usd" : "ars", nota: c.nota || "" });
  }
  function guardarEdicion() {
    const monto = numMiles(editForm.monto);
    if (!editForm.cat.trim() || monto <= 0) return;
    onGuardarPropia(p => ({ ...p, costos: (p.costos || []).map(x => x.id === editandoId ? { ...x, cat: editForm.cat.trim(), moneda: editForm.moneda, monto, montoArs: editForm.moneda === "ars" ? monto : 0, montoUsd: editForm.moneda === "usd" ? monto : 0, nota: editForm.nota.trim() } : x) }));
    setEditandoId(null);
  }

  const inpEdMini = { ...inpEd, fontSize: 12.5, padding: "7px 9px" };
  return (<div style={{ minHeight: "100vh", background: T.bg }}>
    <SubHead titulo="Costos" onBack={onBack} config={config} />
    <div style={{ padding: 18 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}><span style={{ fontSize: 12.5, color: T.sub, flex: 1 }}>Superficie</span><input value={supTxt} onChange={e => setSupTxt(fmtMiles(e.target.value))} onBlur={e => onGuardarPropia(p => ({ ...p, m2: numMiles(e.target.value) }))} inputMode="numeric" placeholder="m²" style={{ ...inpEd, width: 100, textAlign: "right" }} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${T.border}` }}><span style={{ fontSize: 12.5, color: T.sub, flex: 1 }}>Fecha de inicio</span><input type="date" defaultValue={costos.inicio || ""} onBlur={e => onGuardarPropia(p => ({ ...p, inicio: e.target.value }))} style={{ ...inpEd, width: 150, textAlign: "right" }} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${T.border}` }}><span style={{ fontSize: 12.5, color: T.sub, flex: 1 }}>Cotización p/ unificar</span><input value={cotTxt} onChange={e => setCotTxt(fmtMiles(e.target.value))} onBlur={e => onGuardarPropia(p => ({ ...p, cotizUnif: numMiles(e.target.value) }))} inputMode="numeric" placeholder="ej: 1450" style={{ ...inpEd, width: 110, textAlign: "right" }} /></div>
        {cotU <= 0 && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4, lineHeight: 1.4 }}>Sin esto, los gastos en pesos y en dólares no se pueden sumar juntos — la inversión y el resultado esperado van a quedar incompletos. Poné acá el dólar del momento (ej: 1450) para unificar todo.</div>}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Inversión total</div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.brass}`, borderRadius: T.r, padding: "14px 16px", marginBottom: 4 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: T.brass, lineHeight: 1.1 }}>{usdFmt(totUsd)}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 2 }}>{moneyAR(totArs)}</div>
      </div>
      {sup > 0 && totArs > 0 && <div style={{ fontSize: 11, color: T.muted, textAlign: "right", marginBottom: 16 }}>{usdFmt(totUsd / sup)} / {moneyAR(totArs / sup)} por m²</div>}

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 9 }}>Venta esperada</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: T.muted, marginBottom: 4 }}>US$</div><input value={vUTxt} onChange={e => setVUTxt(fmtMiles(e.target.value))} onBlur={e => onGuardarPropia(p => ({ ...p, ventaUsd: numMiles(e.target.value) }))} inputMode="numeric" placeholder="USD" style={{ ...inpEd, textAlign: "right" }} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: T.muted, marginBottom: 4 }}>$</div><input value={vATxt} onChange={e => setVATxt(fmtMiles(e.target.value))} onBlur={e => onGuardarPropia(p => ({ ...p, ventaArs: numMiles(e.target.value) }))} inputMode="numeric" placeholder="$" style={{ ...inpEd, textAlign: "right" }} /></div>
        </div>
        {(vU > 0 || vA > 0) && <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Resultado esperado{vU > 0 ? ` · ${mgU.toFixed(0)}%` : ""}</div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${resU >= 0 || resA >= 0 ? "#16A34A" : "#DC2626"}`, borderRadius: T.r, padding: "14px 16px", marginBottom: 4 }}>
            {vU > 0 && <div style={{ fontSize: 30, fontWeight: 800, color: resU >= 0 ? "#16A34A" : "#DC2626", lineHeight: 1.1 }}>{usdFmt(resU)}</div>}
            {vA > 0 && <div style={{ fontSize: vU > 0 ? 16 : 30, fontWeight: vU > 0 ? 700 : 800, color: vU > 0 ? T.text : (resA >= 0 ? "#16A34A" : "#DC2626"), marginTop: vU > 0 ? 2 : 0, lineHeight: 1.1 }}>{moneyAR(resA)}</div>}
          </div>
          {sup > 0 && <div style={{ fontSize: 11, color: T.muted, textAlign: "right", marginBottom: 16 }}>{vU > 0 ? usdFmt(vU / sup) : moneyAR(vA / sup)}/m² venta · {vU > 0 ? usdFmt(resU / sup) : moneyAR(resA / sup)}/m² resultado</div>}
        </div>}
      </div>

      {rubros.length > 0 && <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 9 }}>Costos por rubro</div>
        {rubros.map(([cat, v]) => (<div key={cat} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span style={{ color: T.sub, fontWeight: 600 }}>{cat}</span><span style={{ fontWeight: 700 }}>{moneyAR(v)}</span></div>
          <div style={{ height: 6, background: T.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: 6, width: `${Math.min(100, v / rubros[0][1] * 100)}%`, background: T.brass, borderRadius: 4 }} /></div>
        </div>))}
      </div>}

      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", margin: "20px 0 9px" }}>Detalle de gastos</div>
      {lista.length === 0 && <EmptyMsg>Todavía no hay gastos cargados.</EmptyMsg>}
      {lista.map((c, i) => (editandoId === c.id ? (<div key={c.id || i} style={{ background: T.card, border: `1px solid ${T.brass}`, borderLeft: `3px solid ${T.brass}`, borderRadius: T.rsm, padding: 12, marginBottom: 8 }}>
        <input value={editForm.cat} onChange={e => setEditForm(f => ({ ...f, cat: e.target.value }))} placeholder="Categoría" style={{ ...inpEdMini, marginBottom: 7 }} />
        <div style={{ display: "flex", gap: 7, marginBottom: 7 }}>
          <input value={editForm.monto} onChange={e => setEditForm(f => ({ ...f, monto: fmtMiles(e.target.value) }))} inputMode="numeric" placeholder="Monto" style={{ ...inpEdMini, flex: 1 }} />
          <div style={{ display: "flex", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[["ars", "$"], ["usd", "US$"]].map(([v, l]) => <button key={v} onClick={() => setEditForm(f => ({ ...f, moneda: v }))} style={{ background: editForm.moneda === v ? T.brass : "transparent", color: editForm.moneda === v ? "#fff" : T.sub, border: "none", padding: "0 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
          </div>
        </div>
        <input value={editForm.nota} onChange={e => setEditForm(f => ({ ...f, nota: e.target.value }))} placeholder="Nota (opcional)" style={{ ...inpEdMini, marginBottom: 9 }} />
        <div style={{ display: "flex", gap: 7 }}>
          <button onClick={() => setEditandoId(null)} style={{ flex: 1, background: "none", color: T.sub, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
          <button onClick={guardarEdicion} style={{ flex: 1.5, background: T.brass, color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Guardar</button>
        </div>
      </div>) : (<div key={c.id || i} onClick={() => c.id && abrirEdicion(c)} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.brass}`, borderRadius: T.rsm, padding: 12, marginBottom: 8, cursor: c.id ? "pointer" : "default" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{c.cat || "Gasto"}</div>
          {c.nota && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{c.nota}</div>}
          {(c.fecha || c.ts) && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{fFecha(c.fecha || new Date(c.ts).toISOString().slice(0, 10))}</div>}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, flexShrink: 0 }}>{c.moneda === "usd" ? usdFmt(c.montoUsd || c.monto) : moneyAR(c.montoArs || c.monto)}</div>
        {c.id && <button onClick={(ev) => { ev.stopPropagation(); borrarGasto(c.id); }} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 16, cursor: "pointer", padding: "0 0 0 4px", flexShrink: 0 }}>✕</button>}
      </div>)))}

      <div style={{ background: T.card, border: `1px dashed ${T.border}`, borderRadius: T.r, padding: 14, marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 4 }}>+ Agregar gasto</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 10, lineHeight: 1.4 }}>Si ponés el mismo nombre de una categoría que ya existe (ej: "Materiales generales"), se suma a esa — no crea una nueva. Tocá cualquier gasto de la lista para editarlo.</div>
        {(() => {
          const catsExistentes = [...new Set((costos.costos || []).map(c => (c.cat || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
          return (<>
            <select value={catNuevaModo ? "__nueva__" : (catsExistentes.includes(nuevo.cat) ? nuevo.cat : "")} onChange={e => { if (e.target.value === "__nueva__") { setCatNuevaModo(true); setNuevo(n => ({ ...n, cat: "" })); } else { setCatNuevaModo(false); setNuevo(n => ({ ...n, cat: e.target.value })); } }} style={{ ...inpEd, marginBottom: 8 }}>
              <option value="" disabled>{catsExistentes.length ? "Elegí una sección…" : "Todavía no hay secciones creadas"}</option>
              {catsExistentes.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__nueva__">＋ Nueva sección…</option>
            </select>
            {catNuevaModo && <input value={nuevo.cat} onChange={e => setNuevo(n => ({ ...n, cat: e.target.value }))} placeholder="Nombre de la sección nueva" autoFocus style={{ ...inpEd, marginBottom: 8 }} />}
          </>);
        })()}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={fmtMiles(nuevo.monto)} onChange={e => setNuevo(n => ({ ...n, monto: numMiles(e.target.value) }))} inputMode="numeric" placeholder="Monto" style={{ ...inpEd, flex: 1 }} />
          <div style={{ display: "flex", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[["ars", "$"], ["usd", "US$"]].map(([v, l]) => <button key={v} onClick={() => setNuevo(n => ({ ...n, moneda: v }))} style={{ background: nuevo.moneda === v ? T.brass : "transparent", color: nuevo.moneda === v ? "#fff" : T.sub, border: "none", padding: "0 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
          </div>
        </div>
        <input value={nuevo.nota} onChange={e => setNuevo(n => ({ ...n, nota: e.target.value }))} placeholder="Nota (opcional)" style={{ ...inpEd, marginBottom: 10 }} />
        <button disabled={guardando} onClick={agregarGasto} style={{ width: "100%", background: T.brass, border: "none", color: "#fff", borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{guardando ? "Guardando…" : "Agregar"}</button>
      </div>

      {(costos.adjuntos || []).length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", margin: "20px 0 9px" }}>Fotos y videos</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {costos.adjuntos.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer">{m.tipo === "video" ? <video src={m.url} style={{ width: 76, height: 76, borderRadius: 9, objectFit: "cover", background: "#000" }} /> : <img src={m.url} style={{ width: 76, height: 76, borderRadius: 9, objectFit: "cover" }} />}</a>)}
        </div>
      </>}

      {costos.facturasIva && costos.facturasIva.length > 0 && (() => {
        const fs = costos.facturasIva;
        const ivaDe = (fx) => Number(fx.montoIva != null ? fx.montoIva : fx.total) || 0;
        const cobradoDe = (fx) => (fx.cobros || []).reduce((s, c) => s + (Number(c.monto) || 0), 0);
        const totIva = fs.reduce((s, fx) => s + ivaDe(fx), 0);
        const totCobrado = fs.reduce((s, fx) => s + cobradoDe(fx), 0);
        return (<>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", margin: "20px 0 9px" }}>IVA — facturación</div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.r, padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: T.sub }}>Total IVA facturado</span><b style={{ fontSize: 13 }}>{moneyAR(totIva)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: T.sub }}>Cobrado</span><b style={{ fontSize: 13, color: "#16A34A" }}>{moneyAR(totCobrado)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: T.sub }}>Saldo pendiente</span><b style={{ fontSize: 13, color: totIva - totCobrado > 0 ? "#D97706" : T.text }}>{moneyAR(totIva - totCobrado)}</b></div>
          </div>
          {fs.map((fx, i) => (<div key={fx.id || i} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.brass}`, borderRadius: T.rsm, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{fx.nroFactura ? `Fact. ${fx.nroFactura}` : "Factura"}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{moneyAR(ivaDe(fx))}</div>
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{fFecha(fx.fecha)}{fx.cliente ? ` · ${fx.cliente}` : ""}</div>
          </div>))}
        </>);
      })()}
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
function Panel({ obra, nombreCliente, tareas, auditoria, formularios, avance, renders, certif, certConformidad, envios, costos, onGuardarPropia, onCrearPropia, config, onGuardarConfig, logoBelfast, logoVVReal }) {
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

  if (seccion === "galeria") return <SeccionGaleria obra={obra} onBack={() => setSeccion(null)} config={config} />;
  if (seccion === "novedades") return <SeccionNovedades obra={obra} certif={certif} onBack={() => setSeccion(null)} />;
  if (seccion === "certificados") return <SeccionCertificados obra={obra} certConformidad={certConformidad} onBack={() => setSeccion(null)} />;
  if (seccion === "renders") return <SeccionRenders obra={obra} renders={renders} onBack={() => setSeccion(null)} />;
  if (seccion === "fotos") return <SeccionFotos obra={obra} avance={avance} onBack={() => setSeccion(null)} config={config} />;
  if (seccion === "cronograma") return <SeccionCronograma obra={obra} tareas={tareas} onBack={() => setSeccion(null)} config={config} />;
  if (seccion === "informes") return <SeccionInformes obra={obra} envios={envios} onBack={() => setSeccion(null)} config={config} />;
  if (seccion === "planos") return <SeccionPlanos obra={obra} onBack={() => setSeccion(null)} config={config} />;
  if (seccion === "costos") return <SeccionCostos costos={costos} onGuardarPropia={onGuardarPropia} onCrearPropia={onCrearPropia} onBack={() => setSeccion(null)} config={config} />;

  return (<div style={{ minHeight: "100vh", background: T.bg }}>
    <div style={{ padding: "calc(20px + env(safe-area-inset-top)) 18px 40px" }}>
      <div style={{ fontSize: 19, fontWeight: 800, color: T.brass, marginBottom: 14 }}>Hola, {nombreCliente}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>{obra.nombre}</div>
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/10", borderRadius: 14, overflow: "hidden", marginBottom: 22, background: T.navy }}>
        {fotos.map((f, i) => <div key={f.id || i} style={{ position: "absolute", inset: 0, backgroundImage: `url(${f.url})`, backgroundSize: "cover", backgroundPosition: "center", opacity: i === idx ? 1 : 0, transition: "opacity 1.4s ease" }} />)}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.15) 0%, transparent 40%)" }} />
        <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", border: `2.5px solid ${T.brass}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fff", boxShadow: "0 3px 10px rgba(0,0,0,.3)" }}>
            {(() => { const logoActivo = obra?.privada ? (logoVVReal || logoBelfast) : logoBelfast; return logoActivo ? <img src={logoActivo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={22} c={T.navy} />; })()}
          </div>
        </div>
      </div>
      {(() => {
        // Prioriza el álbum general de la obra (Belfast/Constructora → Fotos).
        // Si esa obra todavía no tiene fotos cargadas ahí, muestra las del
        // informe de avance para no dejar la galería vacía mientras tanto.
        const album = obra.fotos || [];
        const historial = ((avance || {})[obra.id] || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
        const fotosRecientes = album.length
          ? album.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 4)
          : historial.flatMap(h => (h.fotos && h.fotos.length) ? h.fotos.map(u => ({ url: u })) : (h.fotoUrl ? [{ url: h.fotoUrl }] : [])).slice(0, 4);
        if (!fotosRecientes.length) return null;
        const destino = album.length ? "galeria" : "fotos";
        return (<>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Galería de obra</div>
            <button onClick={() => setSeccion(destino)} style={{ background: "none", border: "none", color: T.brass, fontWeight: 700, fontSize: 11.5, cursor: "pointer", padding: 0 }}>Ver todas</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 22 }}>
            {fotosRecientes.map((f, i) => (
              <button key={f.id || i} onClick={() => setSeccion(destino)} style={{ padding: 0, border: "none", cursor: "pointer", borderRadius: 8, overflow: "hidden", aspectRatio: "1", background: T.bg }}>
                <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        </>);
      })()}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <div style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
          <div style={{ fontSize: 8.5, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".02em", marginBottom: 4 }}>Avance General</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.brass }}>{obra.avance || 0}%</div>
        </div>
        {obra.etapaActual && <div style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
          <div style={{ fontSize: 8.5, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".02em", marginBottom: 4 }}>En Ejecución</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.text, lineHeight: 1.25 }}>{obra.etapaActual}</div>
        </div>}
        {obra.proximaEtapa && <div style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
          <div style={{ fontSize: 8.5, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".02em", marginBottom: 4 }}>Próxima Etapa</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.text, lineHeight: 1.25 }}>{obra.proximaEtapa}</div>
        </div>}
      </div>
      {obra.hitoActual != null && (() => {
        const HITOS = ["Inicio", "Estructura", "Instalaciones", "Terminaciones"];
        const actual = obra.hitoActual;
        return (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Línea de tiempo</div>
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 4px 6px" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: T.border, zIndex: 0 }} />
              <div style={{ position: "absolute", left: 0, top: "50%", height: 2, background: T.brass, width: `${(actual / (HITOS.length - 1)) * 100}%`, zIndex: 1 }} />
              {HITOS.map((h, i) => (
                <div key={h} style={{ width: 12, height: 12, borderRadius: "50%", position: "relative", zIndex: 2, background: i <= actual ? T.brass : "#fff", border: `2px solid ${i <= actual ? T.brass : T.border}` }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "0 -6px" }}>
              {HITOS.map(h => <span key={h} style={{ fontSize: 9, color: T.sub, fontWeight: 600, textAlign: "center", flex: 1 }}>{h}</span>)}
            </div>
          </div>
        );
      })()}
      <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Secciones</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {SECCIONES.map(s => <CuadroSeccion key={s.id} label={s.label} onClick={() => setSeccion(s.id)} config={config} />)}
        <CuadroSeccion label="Costos" onClick={() => setSeccion("costos")} config={config} />
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: T.muted, marginTop: 24 }}>Hola, {nombreCliente} · <button onClick={() => window.location.reload()} style={{ background: "none", border: "none", color: T.brass, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}>🔄 Actualizar</button> · <button onClick={() => { try { localStorage.removeItem("propietario_codigo"); localStorage.removeItem("propietario_nombre"); } catch { } window.location.reload(); }} style={{ background: "none", border: "none", color: T.brass, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}>Salir</button></div>
      <div style={{ textAlign: "center", marginTop: 10 }}><button onClick={() => setEditando(true)} style={{ background: "none", border: "none", color: T.muted, fontSize: 10.5, cursor: "pointer" }}>⚙ Personalizar app</button></div>
    </div>
    {editando && <ConfigModalProp config={config || {}} onSave={onGuardarConfig} onClose={() => setEditando(false)} />}
  </div>);
}

export default function ClientePropietarioApp() {
  useEffect(() => { registrarApertura("propietario"); }, []);
  const [estado, setEstado] = useState("cargando"); // cargando | entrada | panel | error
  const [obra, setObra] = useState(null);
  const [nombreCliente, setNombreCliente] = useState("");
  const [config, setConfig] = useState({});
  const [logoBelfast, setLogoBelfast] = useState("");
  const [logoVVReal, setLogoVVReal] = useState("");
  const [proyectoUrl, setProyectoUrl] = useState("");
  const [codigoInicial, setCodigoInicial] = useState("");
  const [extra, setExtra] = useState({ tareas: [], auditoria: [], formularios: [], avance: {}, renders: {}, certif: {}, certConformidad: [], envios: {} });

  async function guardarConfig(next) {
    setConfig(next);
    await storage.set("vv_propietario_config", JSON.stringify(next));
  }

  // Edita la obra particular en Finanzas desde Propietario. Siempre trae la versión
  // más nueva justo antes de guardar (no la que quedó cacheada al entrar), para no
  // pisar cambios que Finanzas haya hecho mientras tanto — y toca solo esta obra,
  // el resto del archivo de Finanzas queda intacto.
  async function guardarPropia(patchFn) {
    const propiaId = extra.costos?.id;
    if (!propiaId) return;
    try {
      const r = await storage.get("vv_finanzas");
      const fin = r?.value ? JSON.parse(r.value) : {};
      const propias = (fin.propias || []).map(p => p.id === propiaId ? patchFn(p) : p);
      await storage.set("vv_finanzas", JSON.stringify({ ...fin, propias }));
      const actualizada = propias.find(p => p.id === propiaId);
      setExtra(ex => ({ ...ex, costos: actualizada ? { ...actualizada, facturasIva: ex.costos?.facturasIva } : ex.costos }));
    } catch { alert("No se pudo guardar. Revisá la conexión e intentá de nuevo."); }
  }

  async function crearPropia() {
    try {
      const r = await storage.get("vv_finanzas");
      const fin = r?.value ? JSON.parse(r.value) : {};
      const nueva = { id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)), nombre: obra?.nombre || "Obra", m2: 0, ventaUsd: 0, ventaArs: 0, costos: [], adjuntos: [], ts: Date.now() };
      const propias = [...(fin.propias || []), nueva];
      await storage.set("vv_finanzas", JSON.stringify({ ...fin, propias }));
      setExtra(ex => ({ ...ex, costos: { ...nueva, facturasIva: [] } }));
    } catch { alert("No se pudo crear. Revisá la conexión e intentá de nuevo."); }
  }

  async function cargarObra(codigo, nombre) {
    try {
      const [ro, rt, ra, rf, rav, rr, rc, re, rfin, rcc] = await Promise.all([
        storage.get("vv_obras"), storage.get("vv_tareas"), storage.get("vv_auditoria"), storage.get("vv_formularios"), storage.get("vv_avance"), storage.get("vv_renders"), storage.get("vv_certif_sem"), storage.get("cliente_envios_prop"), storage.get("vv_finanzas"), storage.get("vv_cert_conformidad"),
      ]);
      const obras = ro?.value ? JSON.parse(ro.value) : [];
      const encontrada = obras.find(o => (o.codigoCliente || "").toUpperCase() === codigo.toUpperCase());
      if (!encontrada) { setEstado("entrada"); return; }
      setObra(encontrada);
      setNombreCliente(nombre);
      // Obra particular en Finanzas: se busca por nombre (no hay un id compartido entre
      // las dos apps), comparando sin mayúsculas/acentos, por si no coincide 100% literal.
      let costos = null;
      try {
        const fin = rfin?.value ? JSON.parse(rfin.value) : null;
        const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const propia = (fin?.propias || []).find(p => {
          const np = norm(p.nombre), nn = norm(encontrada.nombre), ns = norm(encontrada.sector);
          return np === nn || np.includes(nn) || nn.includes(np) || (ns && (np.includes(ns) || ns.includes(np)));
        });
        if (propia) {
          const facturasIva = (fin?.ivaFacturas || []).filter(f => {
            const nf = norm(f.obra), nn = norm(encontrada.nombre), ns = norm(encontrada.sector);
            return nf && (nf.includes(nn) || nn.includes(nf) || (ns && (nf.includes(ns) || ns.includes(nf))));
          });
          costos = { ...propia, facturasIva };
        }
      } catch { }
      setExtra({
        tareas: rt?.value ? JSON.parse(rt.value) : [],
        auditoria: ra?.value ? JSON.parse(ra.value) : [],
        formularios: rf?.value ? JSON.parse(rf.value) : [],
        avance: rav?.value ? JSON.parse(rav.value) : {},
        renders: rr?.value ? JSON.parse(rr.value) : {},
        certif: rc?.value ? JSON.parse(rc.value) : {},
        certConformidad: rcc?.value ? JSON.parse(rcc.value) : [],
        envios: re?.value ? JSON.parse(re.value) : {},
        costos,
      });
      setEstado("panel");
    } catch { setEstado("entrada"); }
  }

  useEffect(() => {
    storage.get("vv_propietario_config").then(r => { if (r?.value) { try { setConfig(JSON.parse(r.value)); } catch { } } });
    // El logo es el de Belfast en las obras normales (Belfast da el acceso),
    // pero en las obras PRIVADAS (las que V+V gestiona directo, sin Belfast
    // — como Terralagos) es el de V+V, tomado de su propio Ajustes.
    storage.get("cliente_cfg").then(r => { if (r?.value) { try { const c = JSON.parse(r.value); if (c.logo) setLogoBelfast(c.logo); } catch { } } });
    storage.get("vv_cfg").then(r => { if (r?.value) { try { const c = JSON.parse(r.value); if (c.logoEmpresa2 || c.logoEmpresa) setLogoVVReal(c.logoEmpresa2 || c.logoEmpresa); } catch { } } });
    let params = null;
    try { params = new URLSearchParams(window.location.search); } catch { }
    const proyecto = params ? params.get("p") : null;
    if (proyecto) {
      setProyectoUrl(proyecto);
      try {
        document.title = proyecto;
        let m = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (!m) { m = document.createElement("meta"); m.setAttribute("name", "apple-mobile-web-app-title"); document.head.appendChild(m); }
        m.setAttribute("content", proyecto);
      } catch { }
      // Ícono con el número de lote, uno por proyecto (mismo logo, distinto badge).
      try {
        const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const ICONOS_PROP = {
          "golf293": "golf293",
          "lospuentes246": "puentes246", "puentes246": "puentes246",
          "castores475": "castores475",
          "maylinga37": "mayling37", "mayling37": "mayling37", "maylinga37obra": "mayling37",
          "lospuentes132": "puentes132", "puentes132": "puentes132",
          "terralagos815": "terralagos815", "lote815": "terralagos815",
        };
        const slug = ICONOS_PROP[norm(proyecto)];
        if (slug) {
          let li = document.querySelector('link[rel="apple-touch-icon"]');
          if (!li) { li = document.createElement("link"); li.setAttribute("rel", "apple-touch-icon"); document.head.appendChild(li); }
          li.setAttribute("href", `/icon-prop-${slug}-180.png?v=2`);
          let lf = document.querySelector('link[rel="icon"]');
          if (lf) lf.setAttribute("href", `/icon-prop-${slug}-192.png?v=2`);
        }
      } catch { }
    }
    const codigoUrl = params ? params.get("c") : null;
    if (codigoUrl) setCodigoInicial(codigoUrl.toUpperCase());
    let cod = null, nom = null;
    try { cod = localStorage.getItem("propietario_codigo"); nom = localStorage.getItem("propietario_nombre"); } catch { }
    if (cod && nom) cargarObra(cod, nom); else setEstado("entrada");
  }, []);

  // Actualiza sola: cada 20s, y también apenas volvés a la app (sin tener que cerrarla y
  // abrirla de nuevo). Así ves los informes/fotos/certificados que V+V va cargando en vivo.
  useEffect(() => {
    let cod = null, nom = null;
    try { cod = localStorage.getItem("propietario_codigo"); nom = localStorage.getItem("propietario_nombre"); } catch { }
    if (!cod || !nom) return;
    const refrescar = () => cargarObra(cod, nom);
    const iv = setInterval(refrescar, 20000);
    const onVis = () => { if (document.visibilityState === "visible") refrescar(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refrescar);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", refrescar); };
  }, [estado]);

  if (estado === "cargando") return <div style={{ minHeight: "100vh", background: T.navy }} />;
  if (estado === "entrada") return <Entrada onEntrar={cargarObra} config={config} onGuardarConfig={guardarConfig} codigoInicial={codigoInicial} proyectoUrl={proyectoUrl} logoBelfast={logoBelfast} />;
  return <Panel obra={obra} nombreCliente={nombreCliente} tareas={extra.tareas} auditoria={extra.auditoria} formularios={extra.formularios} avance={extra.avance} renders={extra.renders} certif={extra.certif} certConformidad={extra.certConformidad} envios={extra.envios} costos={extra.costos} onGuardarPropia={guardarPropia} onCrearPropia={crearPropia} config={config} onGuardarConfig={guardarConfig} proyectoUrl={proyectoUrl} logoBelfast={logoBelfast} logoVVReal={logoVVReal} />;
}
