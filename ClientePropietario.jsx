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
// cuántas personas usan cada vista. Tabla liviana propia (no bco_storage).
// Si falla, avisa por el canal de errores (no en silencio).
function registrarApertura(appTag) {
  try {
    fetch(SUPA_URL + "/rest/v1/aperturas", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Prefer": "return=minimal" },
      body: JSON.stringify({ app: appTag }),
    }).then(r => {
      if (!r.ok) r.text().then(t => reportarError("No se pudo registrar apertura: HTTP " + r.status, t)).catch(() => {});
    }).catch(e => reportarError("No se pudo registrar apertura (red)", String(e)));
  } catch (e) {}
}

// Vigía de errores — avisa a NEXO Control si algo se rompe en el navegador.
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
// Margen superior seguro (iPad/iPhone con la app instalada): evita que la hora tape los botones.
const SAFE_TOP_PX = (() => { try { return (window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches) ? 50 : 0; } catch (e) { return 0; } })();
const TOPPAD = (extra) => `calc(${extra}px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px))`;
const storage = {
  get: async (key) => {
    try {
      const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { method: "GET", headers: SH(), mode: "cors" });
      if (r.ok) { const d = await r.json(); if (d && d.length > 0) return { value: d[0].value }; }
    } catch { }
    try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; }
  },
  // Lee SOLO de la nube y distingue "no hay dato" (ok:true, value:null) de "no pude leer" (ok:false).
  getCloud: async (key) => {
    try {
      const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { method: "GET", headers: SH(), mode: "cors" });
      if (!r.ok) return { ok: false, value: null };
      const d = await r.json();
      return { ok: true, value: (d && d.length > 0) ? d[0].value : null };
    } catch { return { ok: false, value: null }; }
  },
  set: async (key, value) => {
    try { localStorage.setItem(key, value); } catch { }
    try {
      const r = await fetch(SUPA_URL + "/rest/v1/bco_storage", { method: "POST", headers: { ...SH(), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ key, value }) });
      return { value, ok: r.ok };
    } catch { return { value, ok: false }; }
  },
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

const TBASE = { navy: "#0d0d0f", brass: "#B0894F", brassLight: "#D9B27C", bg: "#0d0d0f", card: "#111214", border: "#232227", text: "#f2f0eb", sub: "rgba(242,240,235,.6)", muted: "rgba(242,240,235,.42)", r: 14, rsm: 10, shadow: "0 1px 2px rgba(0,0,0,.2),0 10px 30px rgba(0,0,0,.35)" };
const DISENO = { v: "a" };
const FONT = { serif: "'Fraunces',Georgia,'Times New Roman',serif" };
const FUENTES = { elegante: { n: "Elegante", f: "'Fraunces',Georgia,'Times New Roman',serif" }, moderna: { n: "Moderna", f: "-apple-system,'Segoe UI',system-ui,Helvetica,Arial,sans-serif" }, clasica: { n: "Clásica", f: "Georgia,'Times New Roman',serif" } };
// Solo se respeta el color de acento elegido; el fondo es siempre el oscuro de la marca.

const TEMAS = {
  bronce: { n: "Bronce", navy: "#0d0d0f", bg: "#0d0d0f", card: "#111214", border: "#232227", text: "#f2f0eb", sub: "rgba(242,240,235,.6)", muted: "rgba(242,240,235,.42)", brass: "#B0894F", brassLight: "#D9B27C", shadow: "0 1px 2px rgba(0,0,0,.2),0 10px 30px rgba(0,0,0,.35)" },
  marfil: { n: "Marfil", navy: "#1b1a18", bg: "#f3f1ec", card: "#ffffff", border: "#e1dcd1", text: "#1b1a18", sub: "rgba(27,26,24,.62)", muted: "rgba(27,26,24,.45)", brass: "#8a6a35", brassLight: "#b0894f", shadow: "0 1px 2px rgba(0,0,0,.05),0 10px 28px rgba(60,50,30,.10)" },
  acero: { n: "Acero", navy: "#0a111d", bg: "#0a111d", card: "#0f1a2b", border: "#1d2c45", text: "#e9f0f8", sub: "rgba(233,240,248,.62)", muted: "rgba(233,240,248,.42)", brass: "#4f93d1", brassLight: "#9cc7ec", shadow: "0 1px 2px rgba(0,0,0,.25),0 10px 30px rgba(0,5,20,.45)" },
  bosque: { n: "Bosque", navy: "#0b1410", bg: "#0b1410", card: "#101c17", border: "#1d2f27", text: "#eaf2ec", sub: "rgba(234,242,236,.62)", muted: "rgba(234,242,236,.42)", brass: "#5fa77f", brassLight: "#a8d4bb", shadow: "0 1px 2px rgba(0,0,0,.25),0 10px 30px rgba(0,10,5,.45)" },
  grafito: { n: "Grafito", navy: "#141416", bg: "#141416", card: "#1c1c20", border: "#2c2c32", text: "#f4f4f6", sub: "rgba(244,244,246,.62)", muted: "rgba(244,244,246,.42)", brass: "#c9c9d1", brassLight: "#e6e6ec", shadow: "0 1px 2px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.45)" },
};
const ACENTOS = ["#B0894F", "#4f93d1", "#5fa77f", "#c8574f", "#9078d6", "#d98a3d"];
function mezclar(hex, p) { const h = String(hex).replace("#", ""); if (h.length !== 6) return hex; const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return "#" + c.map(v => Math.round(v + (255 - v) * p).toString(16).padStart(2, "0")).join(""); }
function aplicarConfig(cfg) {
  const c = cfg || {};
  const t = TEMAS[c.tema] || TEMAS.bronce;
  Object.assign(TBASE, t, { r: 14, rsm: 10 });
  if (c.colorAcento && c.colorAcento.toLowerCase() !== (TEMAS.bronce.brass).toLowerCase()) { TBASE.brass = c.colorAcento; TBASE.brassLight = mezclar(c.colorAcento, .35); }
  else if (c.colorAcento && !c.tema) { /* acento original */ }
  DISENO.v = c.diseno || "a";
  FONT.serif = (FUENTES[c.fuente] || FUENTES.elegante).f;
}
function temaDe(cfg) { return { ...TBASE }; }
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
    more: "M5 12h.01 M12 12h.01 M19 12h.01",
    money: "M12 3v18 M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.8 4 3.5 4 1.8 4 3.5-1.8 3-4 3-4-1.3-4-3",
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
function ConfigModalProp({ config, onSave, onClose, onPreview }) {
  const [d, setD] = useState({ diseno: "a", tema: "bronce", fuente: "elegante", colorAcento: "", nombre: "", subtitulo: "", ...config });
  const T = temaDe(d);
  const cambiar = (p) => { const n = { ...d, ...p }; setD(n); onPreview && onPreview(n); };
  function cerrar() { onPreview && onPreview(null); onClose(); }
  function guardar() { onSave({ ...d, nombre: (d.nombre || "").trim(), subtitulo: (d.subtitulo || "").trim() }); onPreview && onPreview(null); onClose(); }
  const lbl = { fontSize: 10.5, fontWeight: 700, color: T.muted, margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: ".12em" };
  const inp = { width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", fontSize: 14.5, color: T.text, boxSizing: "border-box" };
  const sel = (on) => ({ border: `2px solid ${on ? T.brass : T.border}`, background: T.bg, color: T.text, borderRadius: 12, cursor: "pointer", fontFamily: "inherit" });
  const DIS = [["a", "Clásica", "Foto arriba y lista"], ["b", "Panel", "Círculo de avance y accesos"], ["c", "Inmersiva", "Foto grande y vidrio"]];
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 450, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={cerrar}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "18px 18px 0 0", padding: 20, paddingBottom: "calc(20px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 680, maxHeight: "74vh", overflowY: "auto", boxSizing: "border-box", color: T.text, boxShadow: "0 -10px 40px rgba(0,0,0,.4)" }}>
      <div style={{ fontFamily: FONT.serif, fontSize: 20, fontWeight: 600 }}>Personalizar app</div>
      <div style={{ fontSize: 12, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>Los cambios se ven en vivo detrás. Tocá Guardar para dejarlos.</div>

      <div style={lbl}>Diseño</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {DIS.map(([k, n, h]) => <button key={k} onClick={() => cambiar({ diseno: k })} style={{ ...sel(d.diseno === k), padding: "10px 6px", textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 800 }}>{n}</div><div style={{ fontSize: 9.5, color: T.muted, marginTop: 3, lineHeight: 1.3 }}>{h}</div></button>)}
      </div>

      <div style={lbl}>Tema</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
        {Object.entries(TEMAS).map(([k, t]) => <button key={k} onClick={() => cambiar({ tema: k, colorAcento: "" })} style={{ ...sel((d.tema || "bronce") === k), padding: "8px 2px" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", margin: "0 auto 5px", background: t.bg, border: `3px solid ${t.brass}`, boxShadow: "0 0 0 1px rgba(128,128,128,.4)" }} /><div style={{ fontSize: 10.5, fontWeight: 700 }}>{t.n}</div></button>)}
      </div>

      <div style={lbl}>Color de acento</div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <button onClick={() => cambiar({ colorAcento: "" })} style={{ ...sel(!d.colorAcento), padding: "7px 11px", fontSize: 11.5, fontWeight: 700 }}>Del tema</button>
        {ACENTOS.map(c => <button key={c} onClick={() => cambiar({ colorAcento: c })} aria-label={c} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: `3px solid ${d.colorAcento === c ? T.text : "transparent"}`, cursor: "pointer", padding: 0 }} />)}
        <input type="color" value={d.colorAcento || TBASE.brass} onChange={e => cambiar({ colorAcento: e.target.value })} style={{ width: 36, height: 36, border: "none", background: "none", padding: 0, cursor: "pointer" }} />
      </div>

      <div style={lbl}>Tipografía de títulos</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {Object.entries(FUENTES).map(([k, f]) => <button key={k} onClick={() => cambiar({ fuente: k })} style={{ ...sel((d.fuente || "elegante") === k), padding: "10px 4px", fontFamily: f.f, fontSize: 15, fontWeight: 600 }}>{f.n}</button>)}
      </div>

      <div style={lbl}>Nombre</div>
      <input value={d.nombre} onChange={e => setD({ ...d, nombre: e.target.value })} placeholder="BELFAST" style={inp} />
      <div style={lbl}>Subtítulo</div>
      <input value={d.subtitulo} onChange={e => setD({ ...d, subtitulo: e.target.value })} placeholder="Panel del propietario" style={inp} />
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={cerrar} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
        <button onClick={guardar} style={{ flex: 2, background: T.brass, border: "none", color: "#fff", borderRadius: 12, padding: 13, fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>Guardar</button>
      </div>
    </div>
  </div>);
}


function Entrada({ onEntrar, config, onGuardarConfig, onPreview, codigoInicial, proyectoUrl, logoBelfast }) {
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

  return (<div style={{ minHeight: "100vh", background: T.navy, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 24px", paddingTop: `calc(20px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px))`, paddingBottom: "calc(20px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
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
    {editando && <ConfigModalProp config={config || {}} onSave={onGuardarConfig} onPreview={onPreview} onClose={() => setEditando(false)} />}
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
  return (<div style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, padding: "14px 18px", paddingTop: TOPPAD(14), display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 5 }}>
    <button onClick={onBack} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.text, flexShrink: 0 }}><Ico n="back" s={17} /></button>
    <div style={{ fontFamily: FONT.serif, fontSize: 19, fontWeight: 600, color: T.text, letterSpacing: "-.01em" }}>{titulo}</div>
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
  // Respaldo: si a la foto le falta la fecha exacta (ts), se usa la fecha en
  // texto (dd/mm/aaaa) que sí tienen todas — para que las fotos viejas, de
  // antes de este arreglo, también queden ordenadas bien.
  const tsDe = (f) => f.ts || (() => { const m = String(f.fecha || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (!m) return 0; const d = new Date(+m[3], +m[2] - 1, +m[1]); return isNaN(d.getTime()) ? 0 : d.getTime(); })();
  const fotos = (obra.fotos || []).slice().sort((a, b) => tsDe(b) - tsDe(a));
  return (<div style={{ background: T.bg }}>
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
  return (<div style={{ background: T.bg }}>
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
  return (<div style={{ background: T.bg }}>
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
      {propias.map((t, i) => { const av = Math.max(0, Math.min(100, Number(t.avance) || 0)); return (<div key={t.id || i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 14px", marginBottom: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 9 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{t.nombre}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: av >= 100 ? "#4ADE80" : T.brass }}>{av}%</div>
        </div>
        <div style={{ height: 4, background: T.border, borderRadius: 4, overflow: "hidden" }}><div style={{ height: 4, width: `${av}%`, background: av >= 100 ? "#4ADE80" : T.brass, borderRadius: 4 }} /></div>
      </div>); })}
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: `calc(10px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 12px 10px` }}>
      <button onClick={() => setDoc(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>← Volver</button>
      <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.titulo}</span>
      <button onClick={() => { const f = document.getElementById("doc-prop"); if (f?.contentWindow) f.contentWindow.print(); }} style={{ background: T.brass, border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Imprimir / PDF</button>
    </div>
    <iframe id="doc-prop" srcDoc={doc.html} title={doc.titulo} style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
  </div>);

  return (<div style={{ background: T.bg }}>
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
  return (<div style={{ background: T.bg }}>
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
  return (<div style={{ background: T.bg }}>
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

// ─── Barra de navegación inferior ───
const NAV_PROP = [
  { id: "inicio", label: "Inicio", icon: "building" },
  { id: "avance", label: "Avance", icon: "camera" },
  { id: "informes", label: "Informes", icon: "doc" },
  { id: "cronograma", label: "Cronograma", icon: "calendar" },
  { id: "mas", label: "Más", icon: "more" },
];
function NavProp({ tab, setTab, config }) {
  const T = temaDe(config);
  if (DISENO.v !== "a") return (<nav style={{ flexShrink: 0, padding: "6px 14px calc(env(safe-area-inset-bottom) + 10px)", background: "transparent" }}>
    <div style={{ display: "flex", background: DISENO.v === "c" ? "rgba(30,30,34,.92)" : T.navy, borderRadius: 26, padding: 5, boxShadow: "0 8px 24px rgba(0,0,0,.28)" }}>
    {NAV_PROP.map(n => { const act = tab === n.id;
      return (<button key={n.id} onClick={() => setTab(n.id)} style={{ flex: act ? 1.7 : 1, background: act ? T.brass : "transparent", border: "none", borderRadius: 22, padding: "10px 4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: act ? "#fff" : "rgba(255,255,255,.65)", transition: "all .2s" }}>
        <Ico n={n.icon} s={19} c="currentColor" st={act ? 1.9 : 1.6} />{act && <span style={{ fontSize: 11.5, fontWeight: 800 }}>{n.label}</span>}
      </button>); })}
    </div></nav>);
  return (<nav style={{ flexShrink: 0, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)" }}>
    {NAV_PROP.map(n => {
      const act = tab === n.id;
      return (<button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", borderTop: `2px solid ${act ? T.brass : "transparent"}`, marginTop: -1, padding: "9px 2px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: act ? T.brass : T.sub }}>
        <Ico n={n.icon} s={20} c={act ? T.brass : T.sub} st={act ? 1.9 : 1.6} />
        <span style={{ fontSize: 10, fontWeight: act ? 800 : 600, letterSpacing: ".01em" }}>{n.label}</span>
      </button>);
    })}
  </nav>);
}

// ─── Inicio ───
function InicioProp({ obra, nombreCliente, renders, avance, certif, certConformidad, envios, config, logo, onIr }) {
  const T = temaDe(config);
  const [idx, setIdx] = useState(0);
  const fotosR = rendersDe(obra, renders);
  useEffect(() => {
    if (fotosR.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % fotosR.length), 4500);
    return () => clearInterval(t);
  }, [fotosR.length]);
  const rgbBg = (() => { const h = String(T.bg).replace("#", ""); return h.length === 6 ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(",") : "13,13,15"; })();

  // Fotos recientes: el álbum de la obra, o las del informe de avance si no hay álbum
  const tsFotoDe = (f) => f.ts || (() => { const m = String(f.fecha || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (!m) return 0; const d = new Date(+m[3], +m[2] - 1, +m[1]); return isNaN(d.getTime()) ? 0 : d.getTime(); })();
  const album = obra.fotos || [];
  const historial = ((avance || {})[obra.id] || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const fotosRecientes = album.length
    ? album.slice().sort((a, b) => tsFotoDe(b) - tsFotoDe(a)).slice(0, 4)
    : historial.flatMap(h => (h.fotos && h.fotos.length) ? h.fotos.map(u => ({ url: u })) : (h.fotoUrl ? [{ url: h.fotoUrl }] : [])).slice(0, 4);
  const destinoFotos = album.length ? "galeria" : "avance";

  // Novedades recientes: lo último que Belfast/V+V cargó para esta obra
  const novs = [];
  ((certif || {})[obra.id] || []).forEach(c => novs.push({ ts: c.ts || Date.parse(c.hasta || c.desde || "") || 0, t: "Novedades de la semana", s: `${fFecha(c.desde)} al ${fFecha(c.hasta)}`, ir: "novedades" }));
  (obra.informes || []).forEach(i => novs.push({ ts: i.ts || Date.parse(i.fecha || "") || 0, t: i.titulo || "Informe de obra", s: fFecha(i.fecha), ir: "novedades" }));
  ((envios || {})[obra.id] || []).filter(x => x.prop).forEach(e => novs.push({ ts: e.ts || 0, t: e.titulo || "Informe", s: e.tipo === "cert" ? "Certificado semanal" : "Informe de avance", ir: "informes" }));
  (certConformidad || []).filter(c => c.obra_id === obra.id).forEach(c => novs.push({ ts: c.ts || 0, t: c.nombre || "Certificado de conformidad", s: "Certificado de conformidad", ir: "certificados" }));
  novs.sort((a, b) => b.ts - a.ts);
  const novedades = novs.slice(0, 4);

  const HITOS = ["Inicio", "Estructura", "Instalaciones", "Terminaciones"];
  const accesos = [
    { id: "planos", label: "Planos", icon: "plans" },
    { id: "certificados", label: "Certificados", icon: "checkmark" },
    { id: "renders", label: "Renders", icon: "camera" },
    { id: "costos", label: "Costos", icon: "money" },
  ];
  const lbl = { fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em" };
  const actual = fotosR.length ? fotosR[idx % fotosR.length] : null;

  if (DISENO.v === "b") {
    const R = 46, C = 2 * Math.PI * R, av = Math.min(100, obra.avance || 0);
    const pasos = HITOS.map((h, i) => ({ h, hecho: obra.hitoActual != null && i < obra.hitoActual, act: obra.hitoActual === i }));
    return (<div style={{ background: T.bg, color: T.text, padding: "0 18px 26px", paddingTop: TOPPAD(16) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.navy, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>{logo ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={22} c={T.brassLight} />}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: T.muted }}>Hola, {nombreCliente}</div>
          <div style={{ fontFamily: FONT.serif, fontSize: 21, fontWeight: 600, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{obra.nombre}</div>
        </div>
        <button onClick={() => onIr("mas")} aria-label="Más" style={{ width: 38, height: 38, borderRadius: 12, background: T.card, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", fontSize: 15 }}>•••</button>
      </div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 22, padding: 18, display: "flex", alignItems: "center", gap: 18, boxShadow: T.shadow, marginBottom: 14 }}>
        <svg width="112" height="112" viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
          <circle cx="56" cy="56" r={R} fill="none" stroke={T.border} strokeWidth="9" />
          <circle cx="56" cy="56" r={R} fill="none" stroke={T.brass} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${C * av / 100} ${C}`} transform="rotate(-90 56 56)" />
          <text x="56" y="62" textAnchor="middle" fontFamily={FONT.serif} fontSize="27" fontWeight="600" fill={T.text}>{av}%</text>
        </svg>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>En ejecución</div>
          <div style={{ fontSize: 15, fontWeight: 700, margin: "3px 0 11px", lineHeight: 1.25 }}>{obra.etapaActual || "—"}</div>
          <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>Sigue</div>
          <div style={{ fontSize: 13, color: T.sub, marginTop: 3 }}>{obra.proximaEtapa || "—"}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 18 }}>
        {accesos.map(a => (<button key={a.id} onClick={() => onIr(a.id)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "12px 4px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer", color: T.text }}>
          <Ico n={a.icon} s={21} c={T.brass} /><span style={{ fontSize: 10.5, fontWeight: 700 }}>{a.label}</span></button>))}
      </div>
      {actual && <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", height: 170, marginBottom: 18, background: T.card }}>
        {fotosR.map((f, i) => <div key={f.id || i} style={{ position: "absolute", inset: 0, backgroundImage: `url("${f.url}")`, backgroundSize: "cover", backgroundPosition: "center", opacity: i === idx % fotosR.length ? 1 : 0, transition: "opacity 1.2s" }} />)}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "26px 14px 10px", background: "linear-gradient(transparent, rgba(0,0,0,.6))", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Render del proyecto</div>
      </div>}
      <div style={{ ...lbl, marginBottom: 10 }}>Etapas</div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: "6px 16px", marginBottom: 18 }}>
        {pasos.map((p, i) => (<div key={p.h} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < pasos.length - 1 ? `1px solid ${T.border}` : "none" }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: p.hecho ? T.brass : "transparent", border: `2px solid ${p.hecho || p.act ? T.brass : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.hecho ? <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>✓</span> : p.act ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.brass }} /> : null}</span>
          <span style={{ fontSize: 13.5, fontWeight: p.act ? 800 : 600, color: p.hecho || p.act ? T.text : T.muted, flex: 1 }}>{p.h}</span>
          <span style={{ fontSize: 10.5, color: p.act ? T.brass : T.muted, fontWeight: 700 }}>{p.hecho ? "Listo" : p.act ? "En curso" : ""}</span>
        </div>))}
      </div>
      <div style={{ ...lbl, marginBottom: 8 }}>Novedades</div>
      {novedades.map((n, i) => (<div key={i} onClick={() => onIr(n.ir)} style={{ display: "flex", gap: 12, alignItems: "center", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
        <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.t}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{n.s}</div></div>
        <span style={{ color: T.brass }}>›</span></div>))}
    </div>);
  }
  if (DISENO.v === "c") {
    return (<div style={{ background: T.bg, color: T.text, paddingBottom: 24 }}>
      <div style={{ position: "relative", height: "62vh", minHeight: 400, maxHeight: 560, overflow: "hidden" }}>
        {fotosR.map((f, i) => <div key={f.id || i} style={{ position: "absolute", inset: 0, backgroundImage: `url("${f.url}")`, backgroundSize: "cover", backgroundPosition: "center", opacity: actual && i === idx % fotosR.length ? 1 : 0, transition: "opacity 1.4s" }} />)}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,0) 35%, rgba(0,0,0,.2) 70%, ${T.bg})` }} />
        <div style={{ position: "absolute", top: TOPPAD(14), right: 18 }}>
          <button onClick={() => onIr("mas")} style={{ background: "rgba(255,255,255,.14)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", borderRadius: 20, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>•••</button>
        </div>
        <div style={{ position: "absolute", top: TOPPAD(20), left: 18, right: 18, bottom: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ width: 116, height: 116, borderRadius: "50%", border: `2px solid ${T.brass}`, overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 24px rgba(0,0,0,.5)", flexShrink: 0 }}>
            {logo ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={48} c="#0d0d0f" />}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.8)", marginTop: 18, letterSpacing: ".2em", textTransform: "uppercase" }}>Hola, {nombreCliente}</div>
          <div style={{ fontFamily: FONT.serif, fontSize: 36, fontWeight: 600, lineHeight: 1.05, color: "#fff", marginTop: 8, letterSpacing: "-.02em", textShadow: "0 2px 14px rgba(0,0,0,.5)" }}>{obra.nombre}</div>
          {(obra.sector || obra.inicio) && <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 6 }}>{obra.sector || ""}{obra.sector && obra.inicio ? " · " : ""}{obra.inicio ? `Inicio ${obra.inicio}` : ""}</div>}
        </div>
      </div>
      <div style={{ margin: "0 14px", marginTop: -2, background: "rgba(255,255,255,.07)", backdropFilter: "blur(14px)", border: `1px solid ${T.border}`, borderRadius: 22, padding: 18, boxShadow: T.shadow }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
          <div><div style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>Avance de obra</div>
            <div style={{ fontFamily: FONT.serif, fontSize: 52, fontWeight: 600, lineHeight: 1, marginTop: 4 }}>{obra.avance || 0}<span style={{ fontSize: 24, color: T.brass }}>%</span></div></div>
          <div style={{ textAlign: "right", maxWidth: "52%" }}><div style={{ fontSize: 10, color: T.muted, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700 }}>Ahora</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{obra.etapaActual || "—"}</div></div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>{HITOS.map((h, i) => <div key={h} style={{ flex: 1 }}><div style={{ height: 5, borderRadius: 3, background: obra.hitoActual != null && i <= obra.hitoActual ? T.brass : T.border }} /><div style={{ fontSize: 9.5, color: T.muted, marginTop: 6, fontWeight: 600 }}>{h}</div></div>)}</div>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "18px 14px 4px" }}>
        {accesos.map(a => (<button key={a.id} onClick={() => onIr(a.id)} style={{ flexShrink: 0, background: "none", border: "none", color: T.text, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 78 }}>
          <span style={{ width: 58, height: 58, borderRadius: "50%", background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico n={a.icon} s={22} c={T.brass} /></span><span style={{ fontSize: 11, fontWeight: 600 }}>{a.label}</span></button>))}
      </div>
      <div style={{ padding: "16px 14px 0" }}>
        <div style={{ ...lbl, marginBottom: 10 }}>Lo último</div>
        {novedades.map((n, i) => (<div key={i} onClick={() => onIr(n.ir)} style={{ display: "flex", gap: 13, alignItems: "center", padding: "13px 2px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico n="doc" s={17} c={T.brass} /></span>
          <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.t}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{n.s}</div></div></div>))}
        {fotosRecientes.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "88px 88px", gap: 6, marginTop: 18 }}>
          {fotosRecientes.slice(0, 3).map((f, i) => <img key={i} onClick={() => onIr(destinoFotos)} src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12, gridRow: i === 0 ? "1 / span 2" : "auto", cursor: "pointer" }} />)}
        </div>}
      </div>
    </div>);
  }
  return (<div style={{ background: T.bg, color: T.text }}>
    <div style={{ position: "relative", height: "46vh", minHeight: 340, maxHeight: 460, background: T.bg, overflow: "hidden" }}>
      {fotosR.map((f, i) => <div key={f.id || i} style={{ position: "absolute", inset: 0, backgroundImage: `url("${f.url}")`, backgroundSize: "cover", backgroundPosition: "center", opacity: actual && i === idx % fotosR.length ? .88 : 0, transition: "opacity 1.4s ease" }} />)}
      {!fotosR.length && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg,${T.bg},#17150f)` }} />}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(${rgbBg},.35) 0%, rgba(${rgbBg},.25) 40%, ${T.bg} 100%)` }} />
      <div style={{ position: "absolute", top: TOPPAD(14), right: 18 }}>
        <button onClick={() => onIr("mas")} style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", borderRadius: 20, padding: "6px 13px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", letterSpacing: ".04em" }}>•••</button>
      </div>
      <div style={{ position: "absolute", top: TOPPAD(18), left: 22, right: 22, bottom: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ width: 104, height: 104, borderRadius: "50%", border: `2px solid ${T.brass}`, overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 18px rgba(0,0,0,.5)", flexShrink: 0 }}>
          {logo ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Ico n="building" s={44} c="#0d0d0f" />}
        </div>
        <div style={{ fontSize: 10.5, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(242,240,235,.75)", marginTop: 16 }}>Hola, {nombreCliente}</div>
        <div style={{ fontFamily: FONT.serif, fontWeight: 600, fontSize: 27, color: "#f2f0eb", marginTop: 6, lineHeight: 1.15, textShadow: "0 2px 12px rgba(0,0,0,.45)" }}>{obra.nombre}</div>
        {(obra.sector || obra.inicio) && <div style={{ fontSize: 11.5, color: "rgba(242,240,235,.7)", marginTop: 5 }}>{obra.sector || ""}{obra.sector && obra.inicio ? " · " : ""}{obra.inicio ? `Inicio ${obra.inicio}` : ""}</div>}
      </div>
      {fotosR.length > 1 && <div style={{ position: "absolute", bottom: 8, right: 18, display: "flex", gap: 4 }}>
        {fotosR.map((f, i) => <span key={f.id || i} style={{ width: 5, height: 5, borderRadius: "50%", background: i === idx % fotosR.length ? T.brass : "rgba(255,255,255,.35)" }} />)}
      </div>}
    </div>

    <div style={{ padding: "6px 22px 28px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <div style={{ fontFamily: FONT.serif, fontWeight: 600, fontSize: 46, lineHeight: 1, color: T.text }}>{obra.avance || 0}<span style={{ fontSize: 24, color: T.brass }}>%</span></div>
        <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, lineHeight: 1.35 }}>de avance<br />general</div>
      </div>
      <div style={{ height: 4, background: T.border, borderRadius: 4, overflow: "hidden", marginBottom: 20 }}><div style={{ height: 4, width: `${Math.min(100, obra.avance || 0)}%`, background: `linear-gradient(90deg, ${T.brass}, ${TBASE.brassLight})`, borderRadius: 4 }} /></div>

      {(obra.etapaActual || obra.proximaEtapa) && <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        {obra.etapaActual && <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px" }}>
          <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>En ejecución</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{obra.etapaActual}</div>
        </div>}
        {obra.proximaEtapa && <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px" }}>
          <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Próxima etapa</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{obra.proximaEtapa}</div>
        </div>}
      </div>}

      {obra.hitoActual != null && <div style={{ marginBottom: 24 }}>
        <div style={{ ...lbl, marginBottom: 12 }}>Línea de tiempo</div>
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 6px 8px" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: T.border, zIndex: 0 }} />
          <div style={{ position: "absolute", left: 0, top: "50%", height: 2, background: T.brass, width: `${(obra.hitoActual / (HITOS.length - 1)) * 100}%`, zIndex: 1 }} />
          {HITOS.map((h, i) => (<div key={h} style={{ width: 13, height: 13, borderRadius: "50%", position: "relative", zIndex: 2, background: i <= obra.hitoActual ? T.brass : T.bg, border: `2px solid ${i <= obra.hitoActual ? T.brass : T.border}` }} />))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", margin: "0 -4px" }}>
          {HITOS.map((h, i) => <span key={h} style={{ fontSize: 9.5, color: i <= obra.hitoActual ? T.text : T.muted, fontWeight: 600, textAlign: "center", flex: 1 }}>{h}</span>)}
        </div>
      </div>}

      <div style={{ ...lbl, marginBottom: 6 }}>Novedades recientes</div>
      {novedades.length === 0 && <div style={{ fontSize: 12.5, color: T.muted, padding: "12px 0 18px" }}>Todavía no hay novedades cargadas.</div>}
      {novedades.map((n, i) => (<div key={i} onClick={() => onIr(n.ir)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.t}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{n.s}</div>
        </div>
        <span style={{ color: T.brass, fontSize: 16 }}>›</span>
      </div>))}

      {fotosRecientes.length > 0 && <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={lbl}>Últimas fotos de obra</div>
          <button onClick={() => onIr(destinoFotos)} style={{ background: "none", border: "none", color: T.brass, fontWeight: 700, fontSize: 11.5, cursor: "pointer", padding: 0 }}>Ver todas ›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
          {fotosRecientes.map((f, i) => (<button key={f.id || i} onClick={() => onIr(destinoFotos)} style={{ padding: 0, border: `1px solid ${T.border}`, cursor: "pointer", borderRadius: 8, overflow: "hidden", aspectRatio: "1", background: T.card }}>
            <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </button>))}
        </div>
      </div>}

      <div style={{ ...lbl, margin: "26px 0 10px" }}>Accesos</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {accesos.map(a => (<button key={a.id} onClick={() => onIr(a.id)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "15px 14px", display: "flex", alignItems: "center", gap: 11, cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(176,137,79,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico n={a.icon} s={17} c={T.brass} /></div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{a.label}</span>
        </button>))}
      </div>
    </div>
  </div>);
}

// ─── Más ───
function MasProp({ obra, config, onIr, onEditar, onSalir }) {
  const T = temaDe(config);
  const filas = [
    { id: "novedades", label: "Novedades", icon: "doc" },
    { id: "certificados", label: "Certificados", icon: "checkmark" },
    { id: "renders", label: "Renders", icon: "camera" },
    { id: "galeria", label: "Galería de obra", icon: "camera" },
    { id: "planos", label: "Planos", icon: "plans" },
    { id: "costos", label: "Costos", icon: "money" },
  ];
  return (<div style={{ background: T.bg, minHeight: "100%" }}>
    <div style={{ padding: "0 22px 30px", paddingTop: TOPPAD(18) }}>
      <div style={{ fontFamily: FONT.serif, fontSize: 26, fontWeight: 600, color: T.text, marginBottom: 4 }}>Más</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>{obra.nombre}</div>
      {filas.map(f => (<button key={f.id} onClick={() => onIr(f.id)} style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "15px 15px", marginBottom: 9, display: "flex", alignItems: "center", gap: 13, cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(176,137,79,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico n={f.icon} s={17} c={T.brass} /></div>
        <div style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: T.text }}>{f.label}</div>
        <Ico n="chevron" s={16} c={T.muted} />
      </button>))}
      <div style={{ height: 1, background: T.border, margin: "18px 0" }} />
      <button onClick={() => window.location.reload()} style={{ width: "100%", background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: T.rsm, padding: "13px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}>🔄 Actualizar</button>
      <button onClick={onEditar} style={{ width: "100%", background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: T.rsm, padding: "13px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}>⚙ Personalizar app</button>
      <button onClick={onSalir} style={{ width: "100%", background: "none", border: `1px solid ${T.border}`, color: "#F87171", borderRadius: T.rsm, padding: "13px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Salir</button>
    </div>
  </div>);
}

// ─── Panel principal ───
function Panel({ onPreview, obra, nombreCliente, tareas, auditoria, formularios, avance, renders, certif, certConformidad, envios, costos, onGuardarPropia, onCrearPropia, config, onGuardarConfig, logoBelfast, logoVVReal }) {
  const T = temaDe(config);
  const [tab, setTab] = useState("inicio");
  const [sub, setSub] = useState(null);   // sección abierta desde Inicio o Más
  const [editando, setEditando] = useState(false);
  const logo = obra?.privada ? (logoVVReal || logoBelfast) : logoBelfast;
  const scroller = useRef(null);
  useEffect(() => { try { if (scroller.current) scroller.current.scrollTop = 0; } catch { } }, [tab, sub]);

  // Ir a una sección: las 4 de la barra cambian de pestaña, el resto se abre aparte
  const ir = (id) => {
    if (["inicio", "avance", "informes", "cronograma", "mas"].includes(id)) { setSub(null); setTab(id); }
    else setSub(id);
  };
  const cambiarTab = (id) => { setSub(null); setTab(id); };
  const volverSub = () => setSub(null);
  const volverTab = () => { setSub(null); setTab("inicio"); };
  const salir = () => { try { localStorage.removeItem("propietario_codigo"); localStorage.removeItem("propietario_nombre"); } catch { } window.location.reload(); };

  let contenido;
  if (sub === "galeria") contenido = <SeccionGaleria obra={obra} onBack={volverSub} config={config} />;
  else if (sub === "novedades") contenido = <SeccionNovedades obra={obra} certif={certif} onBack={volverSub} />;
  else if (sub === "certificados") contenido = <SeccionCertificados obra={obra} certConformidad={certConformidad} onBack={volverSub} />;
  else if (sub === "renders") contenido = <SeccionRenders obra={obra} renders={renders} onBack={volverSub} />;
  else if (sub === "planos") contenido = <SeccionPlanos obra={obra} onBack={volverSub} config={config} />;
  else if (sub === "costos") contenido = <SeccionCostos costos={costos} onGuardarPropia={onGuardarPropia} onCrearPropia={onCrearPropia} onBack={volverSub} config={config} />;
  else if (tab === "avance") contenido = <SeccionFotos obra={obra} avance={avance} onBack={volverTab} config={config} />;
  else if (tab === "informes") contenido = <SeccionInformes obra={obra} envios={envios} onBack={volverTab} config={config} />;
  else if (tab === "cronograma") contenido = <SeccionCronograma obra={obra} tareas={tareas} onBack={volverTab} config={config} />;
  else if (tab === "mas") contenido = <MasProp obra={obra} config={config} onIr={ir} onEditar={() => setEditando(true)} onSalir={salir} />;
  else contenido = <InicioProp obra={obra} nombreCliente={nombreCliente} renders={renders} avance={avance} certif={certif} certConformidad={certConformidad} envios={envios} config={config} logo={logo} onIr={ir} />;

  return (<div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: T.bg, color: T.text }}>
    <div ref={scroller} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>{contenido}</div>
    <NavProp tab={sub ? (["novedades", "certificados", "renders", "galeria", "planos", "costos"].includes(sub) ? "mas" : tab) : tab} setTab={cambiarTab} config={config} />
    {editando && <ConfigModalProp config={config || {}} onSave={onGuardarConfig} onPreview={onPreview} onClose={() => setEditando(false)} />}
  </div>);
}

export default function ClientePropietarioApp() {
  useEffect(() => { registrarApertura("propietario"); }, []);
  const [estado, setEstado] = useState("cargando"); // cargando | entrada | panel | error
  const [obra, setObra] = useState(null);
  const [nombreCliente, setNombreCliente] = useState("");
  const [config, setConfig] = useState({});
  const [vista, setVista] = useState(null);
  const cfgEf = vista || config;
  aplicarConfig(cfgEf);
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
  // Lee SIEMPRE lo más nuevo de la nube justo antes de guardar. Si no se puede leer, NO se guarda
  // (antes una lectura fallida podía hacer que se escribiera encima de las finanzas con datos viejos).
  async function leerFinanzasNube() {
    const r = await storage.getCloud("vv_finanzas");
    if (!r.ok) throw new Error("sin-lectura");
    return r.value ? JSON.parse(r.value) : {};
  }
  async function escribirFinanzas(fin, propias) {
    const cantAntes = (fin.propias || []).length;
    if (propias.length < cantAntes) throw new Error("achica");   // nunca se pierde una obra particular
    const res = await storage.set("vv_finanzas", JSON.stringify({ ...fin, propias }));
    if (!res.ok) throw new Error("sin-escritura");
  }
  async function guardarPropia(patchFn) {
    const propiaId = extra.costos?.id;
    if (!propiaId) return;
    try {
      const fin = await leerFinanzasNube();
      const propias = (fin.propias || []).map(p => p.id === propiaId ? patchFn(p) : p);
      await escribirFinanzas(fin, propias);
      const actualizada = propias.find(p => p.id === propiaId);
      setExtra(ex => ({ ...ex, costos: actualizada ? { ...actualizada, facturasIva: ex.costos?.facturasIva } : ex.costos }));
    } catch { alert("No se pudo guardar. Revisá la conexión e intentá de nuevo."); }
  }

  async function crearPropia() {
    try {
      const fin = await leerFinanzasNube();
      const nueva = { id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)), nombre: obra?.nombre || "Obra", m2: 0, ventaUsd: 0, ventaArs: 0, costos: [], adjuntos: [], ts: Date.now() };
      const propias = [...(fin.propias || []), nueva];
      await escribirFinanzas(fin, propias);
      setExtra(ex => ({ ...ex, costos: { ...nueva, facturasIva: [] } }));
    } catch { alert("No se pudo crear. Revisá la conexión e intentá de nuevo."); }
  }

  async function cargarObra(codigo, nombre, silencioso) {
    try {
      const [ro, rt, ra, rf, rav, rr, rc, re, rfin, rcc] = await Promise.all([
        storage.get("vv_obras"), storage.get("vv_tareas"), storage.get("vv_auditoria"), storage.get("vv_formularios"), storage.get("vv_avance"), storage.get("vv_renders"), storage.get("vv_certif_sem"), storage.get("cliente_envios_prop"), storage.get("vv_finanzas"), storage.get("vv_cert_conformidad"),
      ]);
      const obras = ro?.value ? JSON.parse(ro.value) : [];
      const encontrada = obras.find(o => (o.codigoCliente || "").toUpperCase() === codigo.toUpperCase());
      if (!encontrada) { if (!silencioso) setEstado("entrada"); return; }
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
    } catch { if (!silencioso) setEstado("entrada"); }
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
    const refrescar = () => cargarObra(cod, nom, true);
    const iv = setInterval(refrescar, 20000);
    const onVis = () => { if (document.visibilityState === "visible") refrescar(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refrescar);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", refrescar); };
  }, [estado]);

  if (estado === "cargando") return <div style={{ minHeight: "100vh", background: TBASE.bg }} />;
  if (estado === "entrada") return <Entrada onPreview={setVista} onEntrar={cargarObra} config={cfgEf} onGuardarConfig={guardarConfig} codigoInicial={codigoInicial} proyectoUrl={proyectoUrl} logoBelfast={logoBelfast} />;
  return <Panel onPreview={setVista} obra={obra} nombreCliente={nombreCliente} tareas={extra.tareas} auditoria={extra.auditoria} formularios={extra.formularios} avance={extra.avance} renders={extra.renders} certif={extra.certif} certConformidad={extra.certConformidad} envios={extra.envios} costos={extra.costos} onGuardarPropia={guardarPropia} onCrearPropia={crearPropia} config={cfgEf} onGuardarConfig={guardarConfig} proyectoUrl={proyectoUrl} logoBelfast={logoBelfast} logoVVReal={logoVVReal} />;
}