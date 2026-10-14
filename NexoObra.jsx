// NEXO Obra — versión simplificada: una sola app, tres paneles (Constructora · Estudio · Propietario).
// Lee en SOLO LECTURA los datos reales de las obras (mismas claves que las otras apps) y usa el mismo estilo.
// No escribe nada en la base: no puede romper ni pisar datos de las otras aplicaciones.
import React, { useState, useEffect, useMemo } from "react";
import CronoPro from "./CronoPro.jsx";
import { AvanceView, BitacoraView, AjustesScreen } from "./Cliente.jsx";
import { ModelosObraView, ChatIA } from "./App.jsx";
import ClientePropietarioApp from "./ClientePropietario.jsx";

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const BRASS = "#B0894F";
const KEYS = ["vv_obras", "vv_bitacora", "vv_avance", "vv_informes_sem", "vv_renders", "vv_pedidos", "vv_matpedidos", "vv_cronopro", "vv_adicionales", "vv_certif_sem", "cliente_cfg", "vv_cfg", "vv_modelos_obra", "vv_gestion", "cliente_envios_prop", "vv_personal", "vv_tareas", "vv_mensajes", "vv_formularios", "vv_documentacion", "vv_auditoria", "vv_definiciones", "vv_docrecepcion", "vv_drone", "vv_minutas"];
const CACHE = "nexoobra_real_v2";

// ── tema: idéntico al de la app Cliente ─────────────────────────────────────
const TEMA_OSCURO = { bg: "#0d0d0f", card: "#111214", border: "#232227", text: "#f2f0eb", sub: "rgba(242,240,235,.6)", muted: "rgba(242,240,235,.42)", accent: "#B0894F", shadow: "0 1px 2px rgba(0,0,0,.2),0 10px 30px rgba(0,0,0,.35)" };
const TEMA_CLARO = { bg: "#F5F6F8", card: "#ffffff", border: "#E6E9EE", text: "#131C2B", sub: "#4A5565", muted: "#97A0AE", accent: "#B0894F", shadow: "0 1px 2px rgba(16,28,44,.05),0 6px 20px rgba(16,28,44,.06)" };
const DEFAULT_CFG = { nombre: "Belfast Construction Management", sigla: "BELFAST", logo: "", accent: "#1E3A5F" };
function hexARgb(hex) { const h = String(hex || "").replace("#", ""); const hh = h.length === 3 ? h.split("").map(x => x + x).join("") : h; const n = parseInt(hh, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbAHex(rgb) { return "#" + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join(""); }
function aclarar(hex, t) { const A = hexARgb(hex); const G = [76, 78, 84]; return rgbAHex(A.map((v, i) => v + (G[i] - v) * t)); }
function hexToRgba(hex, a) { const h = String(hex || "").replace("#", ""); if (h.length !== 6) return `rgba(255,255,255,${a})`; return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; }
function paletaBrillo(brillo) {
  const L = Math.max(0, Math.min(100, Number(brillo))) / 100; let tL = 1 - L;
  if (Math.abs(tL - L) < 0.55) tL = L < 0.5 ? L + 0.55 : L - 0.55; tL = Math.max(0, Math.min(1, tL));
  const g = (v) => { const n = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0"); return "#" + n + n + n; };
  const mix = (a, b, k) => g(a + (b - a) * k);
  return { bg: g(L), card: g(L < 0.5 ? L + 0.05 : L + 0.04), border: g(L < 0.5 ? L + 0.14 : L - 0.12), text: g(tL), sub: mix(tL, L, 0.3), muted: mix(tL, L, 0.52), navy: L < 0.5 ? g(L * 0.7) : "#0F172A", oscuro: L < 0.5 };
}
function theme(cfg) {
  const c = cfg || {};
  if (c.brillo != null) { const p = paletaBrillo(c.brillo); const ac = c.accent || BRASS; return { bg: p.bg, card: p.card, border: p.border, text: p.text, sub: p.sub, muted: p.muted, accent: ac, accentLight: hexToRgba(ac, .14), navy: p.oscuro ? p.bg : p.navy, r: 12, rsm: 8, shadow: p.oscuro ? TEMA_OSCURO.shadow : TEMA_CLARO.shadow }; }
  const base = c.modo === "claro" ? TEMA_CLARO : TEMA_OSCURO, osc = c.modo !== "claro";
  const pct = Math.max(0, Math.min(100, c.oscuroIntensidad == null ? 100 : Number(c.oscuroIntensidad))), t = osc ? (1 - pct / 100) * 0.62 : 0;
  const bg = c.themeBg || (osc ? aclarar(base.bg, t) : base.bg), text = c.themeText || base.text, accent = c.accent || base.accent;
  return { bg, card: c.themeCard || (osc ? aclarar(base.card, t) : base.card), border: c.themeBorder || (osc ? aclarar(base.border, Math.min(1, t * 1.3)) : base.border), text, sub: c.themeText ? hexToRgba(c.themeText, .6) : base.sub, muted: c.themeText ? hexToRgba(c.themeText, .42) : base.muted, accent, accentLight: hexToRgba(accent, .14), navy: bg, r: 12, rsm: 8, shadow: base.shadow };
}
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#0d0d0f;overscroll-behavior:none;font-family:'Inter',sans-serif;}
  button{cursor:pointer;font-family:inherit;}input,textarea,select{font-family:inherit;}
  input:focus,textarea:focus{outline:none;}textarea{resize:none;}::-webkit-scrollbar{display:none;}
  .xscroll{scrollbar-width:thin;scrollbar-color:#B0894F rgba(255,255,255,.12);}
  .xscroll::-webkit-scrollbar{display:block;height:9px;}
  .xscroll::-webkit-scrollbar-track{background:rgba(255,255,255,.1);border-radius:6px;}
  .xscroll::-webkit-scrollbar-thumb{background:#B0894F;border-radius:6px;}
  @keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:.85}}
`;
const SAFE_TOP_PX = (() => { try { return (window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches) ? 50 : 0; } catch (e) { return 0; } })();

// ── lectura de datos reales (solo GET) ─────────────────────────────────────
const parse = (v) => { if (v == null) return null; if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return null; } };
async function leerNube() {
  const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?select=key,value&key=in.(" + KEYS.join(",") + ")", { headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const rows = await r.json(), out = {};
  rows.forEach(x => { out[x.key] = parse(x.value); });
  if (!out.vv_obras) throw new Error("sin obras");
  return out;
}
function useReal() {
  const [R, setR] = useState(() => { try { const c = JSON.parse(localStorage.getItem(CACHE) || "null"); return c ? c.d : null; } catch { return null; } });
  const [st, setSt] = useState(R ? "cache" : "cargando");
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vivo = true;
    leerNube().then(d => { if (!vivo) return; setR(d); setSt("ok"); try { localStorage.setItem(CACHE, JSON.stringify({ d, ts: Date.now() })); } catch { } })
      .catch(() => { if (vivo) setSt(s => (s === "cache" ? "cache" : "error")); });
    return () => { vivo = false; };
  }, [intento]);
  return { R, st, recargar: () => { setSt(s => (R ? "cache" : "cargando")); setIntento(i => i + 1); } };
}

// Lo que se carga acá (avances, bitácora, cronograma) queda en ESTE aparato; no se escribe en la base real.
function useOverlay(key, real) {
  const K = "nexoobra_ov_" + key;
  const [loc, setLoc] = useState(() => { try { const v = localStorage.getItem(K); return v ? JSON.parse(v) : null; } catch { return null; } });
  const val = loc != null ? loc : real;
  const ref = React.useRef(val); ref.current = val;
  const set = (u) => { const n = typeof u === "function" ? u(ref.current) : u; ref.current = n; setLoc(n); try { localStorage.setItem(K, JSON.stringify(n)); } catch { } };
  const reset = () => { setLoc(null); try { localStorage.removeItem(K); } catch { } };
  return [val, set, reset, loc != null];
}

// ── utilidades de forma tolerante ──────────────────────────────────────────
const arr = (x) => (Array.isArray(x) ? x : []);
const urlDe = (x) => (typeof x === "string" ? x : (x && (x.url || x.src || x.dataUrl)) || "");
const fFecha = (iso) => { if (!iso) return ""; const s = String(iso).slice(0, 10).split("-"); return s.length === 3 ? `${s[2]}/${s[1]}/${s[0].slice(2)}` : String(iso); };
const fTs = (ts) => ts ? new Date(ts).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "2-digit" }) : "";
const esVideo = (u) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u || "");

// ── piezas de interfaz (mismo lenguaje visual que Cliente.jsx) ─────────────
const Card = ({ T, children, style = {}, onClick }) => <div onClick={onClick} style={{ background: T.card, borderRadius: T.r, border: `1px solid ${T.border}`, boxShadow: T.shadow, ...style }}>{children}</div>;
const Badge = ({ c, b, children }) => <span style={{ fontSize: 10, fontWeight: 700, color: c, background: b, borderRadius: 20, padding: "3px 9px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{children}</span>;
const Eyebrow = ({ T, children }) => <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}><span style={{ width: 18, height: 2, background: BRASS }} /><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: T.sub }}>{children}</span></div>;
const Vacio = ({ T, children }) => <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "26px 16px" }}>{children}</div>;
const Sel = ({ T, value, onChange, children }) => <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 14, color: T.text, margin: "6px 0 12px" }}>{children}</select>;
const Pill = ({ T, a, children, onClick }) => <button onClick={onClick} style={{ flexShrink: 0, background: a ? T.accent : "transparent", color: a ? "#fff" : T.sub, border: `1px solid ${a ? T.accent : T.border}`, borderRadius: 20, padding: "7px 13px", fontSize: 12, fontWeight: 700 }}>{children}</button>;
const Archivo = ({ T, a }) => { const u = urlDe(a), n = (a && (a.nombre || a.name)) || "Archivo"; return <a href={u || undefined} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 11px", marginTop: 6, textDecoration: "none", color: T.text, fontSize: 12.5, fontWeight: 600 }}><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span><span style={{ color: BRASS, fontSize: 11.5, fontWeight: 800 }}>Abrir ↗</span></a>; };
function Galeria({ T, items }) {
  const [ver, setVer] = useState(null);
  const L = items.map(urlDe).filter(Boolean);
  if (!L.length) return <Vacio T={T}>Todavía no hay fotos cargadas.</Vacio>;
  return (<>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 6 }}>{L.map((u, i) => esVideo(u)
      ? <video key={i} src={u} controls preload="metadata" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, background: "#000" }} />
      : <img key={i} src={u} alt="" loading="lazy" onClick={() => setVer(u)} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer" }} />)}</div>
    {ver && <div onClick={() => setVer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}><img src={ver} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /></div>}
  </>);
}
function Documento({ T, doc, cerrar }) {
  return (<div style={{ position: "fixed", inset: 0, background: "#1a2433", zIndex: 400, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: `calc(10px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 12px 10px` }}>
      <button onClick={cerrar} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700 }}>← Volver</button>
      <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.titulo}</span>
    </div>
    <iframe srcDoc={doc.html} title={doc.titulo} style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
  </div>);
}

// ── App ────────────────────────────────────────────────────────────────────
const PANELES = {
  constructora: { n: "Constructora", d: "Ejecuta y anticipa", pts: ["Inicio con la obra, el avance y lo que hay que mover", "Semáforo de pedidos según el cronograma", "Fotos, bitácora e informes de cada obra", "Pedidos al estudio y sus respuestas"] },
  estudio: { n: "Estudio", d: "Proyecta y dirige la obra", pts: ["Ve día a día el avance, las fotos y los informes de cada obra", "Pedidos que le hacen, con su fecha límite", "Respuestas con planos y archivos", "Planos entregados y ajustes de su panel"] },
  propietario: { n: "Propietario", d: "Sigue su obra", pts: ["Avance de su obra", "Fotos de la obra", "Informes semanales y de avance", "Sin alertas ni costos internos"] },
};
const NAVS = {
  constructora: [["inicio", "Inicio"], ["obras", "Obras"], ["pedidos", "Pedidos"], ["mas", "Más"]],
  estudio: [["inicio", "Inicio"], ["obras", "Obras"], ["pedidos", "Pedidos"], ["planos", "Planos"], ["ajustes", "Ajustes"]],
  propietario: [["obra", "Mi obra"], ["fotos", "Fotos"], ["informes", "Informes"]],
};
const KEYP = "nexoobra_perfil";
const PCOL = { constructora: "#B0894F", estudio: "#2F6F8F", propietario: "#3E8E62" };

export default function NexoObraApp() {
  const { R, st, recargar } = useReal();
  const [perfil, setPerfil] = useState(() => { try { return localStorage.getItem(KEYP) || ""; } catch { return ""; } });
  const [verAlcance, setVerAlcance] = useState(false);
  const [tab, setTab] = useState("");
  useEffect(() => { try { document.title = perfil ? "NEXO · " + PANELES[perfil].n : "NEXO Obra"; } catch { } }, [perfil]);
  useEffect(() => { try { perfil ? localStorage.setItem(KEYP, perfil) : localStorage.removeItem(KEYP); } catch { } }, [perfil]);
  const [cfg, setCfg, rstF] = useOverlay("cfg", useMemo(() => ({ ...DEFAULT_CFG, ...(R && R.cliente_cfg ? R.cliente_cfg : {}) }), [R]));
  const [rendersV, setRenders, rstR] = useOverlay("renders", (R && R.vv_renders) || {});
  const T = useMemo(() => theme(cfg), [cfg]);
  // La base puede traer obras repetidas (error viejo ya corregido): se deja una sola por obra, la última.
  const obras = useMemo(() => { const m = new Map(); arr(R && R.vv_obras).forEach(o => { if (o && o.id != null) m.set(o.id, o); }); return [...m.values()].filter(o => !o.privada); }, [R]);
  const [bitacoraV, setBitacora, rstB] = useOverlay("bitacora", arr(R && R.vv_bitacora));
  const [avanceV, setAvance, rstA] = useOverlay("avance", (R && R.vv_avance) || {});
  const [cronoV, setCronoPro, rstC] = useOverlay("cronopro", (R && R.vv_cronopro) || { obras: {} });
  const [enviosV, setEnvios, rstE] = useOverlay("envios", (R && R.cliente_envios_prop) || {});
  const [modelosV, setModelosObra, rstM] = useOverlay("modelos", arr(R && R.vv_modelos_obra));
  const [asigV, setAsig, rstS] = useOverlay("modelo_asig", {});
  const restaurar = () => { rstB(); rstA(); rstC(); rstE(); rstM(); rstS(); rstF(); rstR(); };
  const D = useMemo(() => ({
    setBitacora, setAvance, setCronoPro, setEnvios, restaurar, envios: enviosV, apiKey: ((R && R.vv_cfg) || {}).apiKey, certif: (R && R.vv_certif_sem) || {}, modelosObra: arr(modelosV), setModelosObra, asig: asigV || {}, setAsig, gestion: (R && R.vv_gestion) || null,
    ia: { personal: arr(R && R.vv_personal), tareas: arr(R && R.vv_tareas), mensajes: arr(R && R.vv_mensajes), formularios: arr(R && R.vv_formularios), documentacion: arr(R && R.vv_documentacion), auditoria: arr(R && R.vv_auditoria), definiciones: arr(R && R.vv_definiciones), docrecepcion: arr(R && R.vv_docrecepcion), dronevuelos: arr(R && R.vv_drone), minutas: arr(R && R.vv_minutas), gestion: (R && R.vv_gestion) || {} },
    obras, bitacora: arr(bitacoraV), avance: avanceV || {}, informesSem: (R && R.vv_informes_sem) || {}, renders: rendersV || {}, setRenders,
    pedidos: arr(R && R.vv_pedidos), matpedidos: arr(R && R.vv_matpedidos), cronoPro: cronoV || { obras: {} }, adicionales: arr(R && R.vv_adicionales),
  }), [R, obras, bitacoraV, avanceV, cronoV, enviosV, modelosV, asigV, rendersV]);
  const entrar = (p) => { setPerfil(p); setVerAlcance(false); setTab(p ? NAVS[p][0][0] : ""); };
  useEffect(() => { if (perfil && !tab) setTab(NAVS[perfil][0][0]); }, [perfil, tab]);
  const portada = useMemo(() => D.obras.flatMap(o => [...arr(D.renders[o.id]).map(urlDe), ...arr(o.fotos).slice(0, 1).map(urlDe)].filter(Boolean).slice(0, 1)).filter(u => !esVideo(u)), [D]);
  const [obraSel, setObraSel] = useState(null);
  const ctx = { T, cfg, setCfg, D, tab, setTab: (t) => { setTab(t); if (t !== "obras") setObraSel(null); }, obraSel, setObraSel };

  return (<div style={{ background: T.bg }}><div style={{ height: "100dvh", width: "100%", display: "flex", flexDirection: "column", background: T.bg, color: T.text, fontFamily: "'Inter',sans-serif" }}>
    <style>{CSS}{`body{background:${T.bg}}`}</style>
    {(!perfil || verAlcance) ? <Alcance imgs={portada} T={T} cfg={cfg} perfil={perfil} entrar={entrar} volver={() => setVerAlcance(false)} st={st} R={R} recargar={recargar} />
      : (<>
        {perfil === "propietario" ? <div style={{ position: "fixed", zIndex: 300, top: `calc(8px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px))`, left: 10, display: "flex", alignItems: "center", gap: 6, background: PCOL.propietario, color: "#fff", borderRadius: 20, padding: "5px 6px 5px 11px", boxShadow: "0 2px 10px rgba(0,0,0,.4)" }}><span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>Panel Propietario</span><button onClick={() => setVerAlcance(true)} style={{ background: "rgba(0,0,0,.28)", border: "none", color: "#fff", borderRadius: 14, padding: "4px 9px", fontSize: 10.5, fontWeight: 700 }}>Paneles</button></div>
          : <Cabecera T={T} cfg={cfg} perfil={perfil} onAlcance={() => setVerAlcance(true)} />}
        {perfil === "propietario" && <div style={{ flex: 1, minHeight: 0, background: "#0d0d0f" }}><ClientePropietarioApp /></div>}
        {st === "error" && <div style={{ padding: "30px 22px", textAlign: "center", color: T.sub, fontSize: 13, lineHeight: 1.6 }}>No pude traer los datos de las obras ahora. Revisá la conexión.<div><button onClick={recargar} style={{ marginTop: 12, background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: "11px 18px", fontSize: 13, fontWeight: 700 }}>Reintentar</button></div></div>}
        {st === "cargando" && <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>Cargando tus obras…</div>}
        {R && perfil !== "propietario" && <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {perfil === "constructora" && <Constructora {...ctx} recargar={recargar} st={st} />}
          {perfil === "estudio" && <Estudio {...ctx} />}
          {perfil === "propietario" && <Propietario {...ctx} />}
        </div>}
        {perfil !== "propietario" && <Nav T={T} perfil={perfil} tab={tab} setTab={ctx.setTab} />}
      </>)}
  </div></div>);
}

function Cabecera({ T, cfg, perfil, onAlcance }) {
  return (<div style={{ background: T.navy, color: "#fff", flexShrink: 0 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 13, padding: `calc(16px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 78px 15px`, minHeight: 64, position: "relative" }}>
      {cfg.logo ? <img src={cfg.logo} alt="" style={{ maxHeight: 48, maxWidth: 240, objectFit: "contain" }} />
        : <><div style={{ width: 46, height: 46, background: "rgba(255,255,255,.08)", border: `1px solid ${BRASS}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>{(cfg.sigla || "C").slice(0, 3)}</div>
          <div style={{ lineHeight: 1.25, textAlign: "left" }}><div style={{ fontSize: 9, fontWeight: 700, color: BRASS, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 3 }}>Panel {PANELES[perfil].n.toLowerCase()}</div><div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{cfg.nombre}</div></div></>}
      <button onClick={onAlcance} style={{ position: "absolute", right: 14, background: "transparent", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700 }}>Paneles</button>
    </div>
    <div style={{ background: PCOL[perfil], color: "#fff", textAlign: "center", padding: "7px 12px", fontSize: 12, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase" }}>Panel {PANELES[perfil].n}</div>
  </div>);
}
function Nav({ T, perfil, tab, setTab }) {
  if (!perfil) return null;
  return (<nav style={{ flexShrink: 0, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "center", paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)" }}>
    <div style={{ width: "100%", display: "flex" }}>{NAVS[perfil].map(([id, l]) => { const a = tab === id; return <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: "none", border: "none", padding: "6px 4px 5px", fontSize: 10.5, fontWeight: a ? 800 : 600, color: a ? T.accent : T.sub, borderTop: `2px solid ${a ? BRASS : "transparent"}`, marginTop: -1 }}>{l}</button>; })}</div>
  </nav>);
}

const FUENTES = "@import url('https://fonts.googleapis.com/css2?family=Michroma&family=Barlow+Semi+Condensed:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');";
const F_TIT = "'Michroma','Inter',sans-serif", F_TXT = "'Barlow Semi Condensed','Inter',sans-serif", F_MONO = "'Space Mono',monospace";
const Estrella = ({ s = 90 }) => (<svg width={s} height={s * .84} viewBox="0 0 120 100" fill="none" stroke="#F0C45A" strokeWidth="3.2" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(233,185,73,.45))" }}><path d="M60 11v86" /><path d="M13 62h94" /><path d="M31 36l58 52M89 36L31 88" /><circle cx="60" cy="7" r="4.6" fill="#F0C45A" stroke="none" /><circle cx="9" cy="62" r="4.6" fill="#F0C45A" stroke="none" /><circle cx="111" cy="62" r="4.6" fill="#F0C45A" stroke="none" /><circle cx="60" cy="62" r="8" fill="#B0894F" stroke="none" /></svg>);
function Alcance({ T, cfg, perfil, entrar, volver, st, R, recargar, imgs = [] }) {
  const hoyTxt = new Date().toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
  const nObras = R ? new Set(arr(R.vv_obras).filter(o => o && !o.privada).map(o => o.id)).size : 0;
  return (<div style={{ flex: 1, overflowY: "auto", fontFamily: F_TXT, background: "radial-gradient(900px 500px at 50% -10%, rgba(176,137,79,.12), transparent 60%), #0b0d12" }}>
    <style>{FUENTES}</style>
    <div style={{ maxWidth: 620, margin: "0 auto", minHeight: "100%", borderLeft: "1px solid rgba(255,255,255,.14)", borderRight: "1px solid rgba(255,255,255,.14)", background: "rgba(13,15,21,.7)" }}>
      <div style={{ padding: `calc(14px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 22px 12px`, borderBottom: "1px solid rgba(255,255,255,.14)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center" }}><Estrella s={22} /></div><span style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 15, color: "#E9B949", letterSpacing: ".06em" }}>NEXO</span></div>
          <span style={{ fontFamily: F_MONO, fontSize: 13, color: "#d7d3ca" }}>{hoyTxt}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 500, color: "#f2f0eb", marginTop: 14 }}>{perfil ? "Tu panel: " + PANELES[perfil].n : "Ingresá con tu cuenta"}</div>
      </div>
      <div style={{ padding: "26px 22px 34px" }}>
        {!perfil && <div style={{ textAlign: "center", marginBottom: 26 }}>
          <Estrella s={150} />
          <div style={{ fontFamily: F_TIT, fontSize: 54, letterSpacing: ".14em", color: "#f2f0eb", margin: "4px 0 4px" }}>NEXO</div>
          <div style={{ fontSize: 17, color: "#f2f0eb" }}>Todos conectados, En tiempo real.</div>
          <div style={{ fontFamily: F_TIT, fontSize: 22, lineHeight: 1.3, color: "#f2f0eb", textTransform: "uppercase", margin: "26px 0 10px" }}>La obra que se anticipa no se improvisa</div>
          <div style={{ width: 70, height: 2, background: "#E9B949", margin: "0 auto" }} />
        </div>}
        <div style={{ fontFamily: F_TIT, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "#f2f0eb", marginBottom: 14 }}>{perfil ? "Paneles de la app" : "Ingresá a tu panel"}</div>
        <div style={{ display: "grid", gap: 14 }}>
          {Object.entries(PANELES).map(([k, p], n) => {
            const mio = perfil === k, bloq = perfil && !mio, img = imgs[n % Math.max(imgs.length, 1)];
            return (<div key={k} onClick={() => { if (!perfil && R) entrar(k); else if (mio) volver(); }} style={{ position: "relative", height: 210, borderRadius: 22, overflow: "hidden", border: `1px solid ${mio ? "#E9B949" : "rgba(255,255,255,.2)"}`, background: "linear-gradient(135deg,#1a1d26,#0b0d12)", cursor: bloq || !R ? "default" : "pointer", opacity: bloq ? .5 : 1 }}>
              {img && <img src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: bloq ? "grayscale(1)" : "none" }} />}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.4) 45%, rgba(0,0,0,.88) 100%)" }} />
              <div style={{ position: "absolute", left: 20, right: 20, bottom: 16, color: "#f2f0eb" }}>
                <div style={{ fontFamily: F_TIT, fontSize: 9.5, letterSpacing: ".16em", textTransform: "uppercase", color: "#E9B949", marginBottom: 6 }}>{p.d}</div>
                <div style={{ fontFamily: F_TIT, fontSize: 22, textTransform: "uppercase", lineHeight: 1.15 }}>{bloq ? "🔒 " : ""}{p.n === "Estudio" ? "Estudio de arquitectura" : p.n}</div>
                <div style={{ fontSize: 14.5, fontWeight: 500, margin: "5px 0 8px", lineHeight: 1.35 }}>{p.pts[0]}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E9B949" }}>{bloq ? "Bloqueado: este panel lo ve " + (k === "constructora" ? "la constructora" : k === "estudio" ? "el estudio" : "el propietario") : mio ? "Tu panel · volver →" : "Ingresar →"}</div>
              </div>
            </div>);
          })}
        </div>
        <div style={{ marginTop: 16, border: "1px dashed rgba(255,255,255,.2)", borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "#f2f0eb" }}>Cada perfil entra con su invitación y ve solo su panel.</div>
        <div style={{ marginTop: 14, fontSize: 12.5, color: "#9a968c", textAlign: "center" }}>{R ? `${nObras} ${nObras === 1 ? "obra real cargada" : "obras reales cargadas"}${st === "cache" ? " (última copia de este aparato)" : ""} · solo lectura` : (st === "error" ? "No pude traer los datos todavía." : "Cargando tus obras…")} {!R && <button onClick={recargar} style={{ background: "none", border: 0, color: "#E9B949", fontWeight: 700, fontSize: 12.5 }}>Reintentar</button>}</div>
        {perfil && <button onClick={() => entrar("")} style={{ width: "100%", marginTop: 14, background: "transparent", color: "#d7d3ca", border: "1px solid rgba(255,255,255,.2)", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 600 }}>Cambiar de perfil (solo en la demo)</button>}
      </div>
    </div>
  </div>);
}

// ── selector de obra compartido ────────────────────────────────────────────
function useObra(D) { const [id, setId] = useState(""); const o = D.obras.find(x => x.id === id) || D.obras[0]; return [o, setId]; }
function SelObra({ T, D, o, setId }) { return <Sel T={T} value={o ? o.id : ""} onChange={setId}>{D.obras.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</Sel>; }
const wrap = (children) => <div style={{ padding: "18px clamp(16px,3vw,40px) 30px", width: "100%" }}>{children}</div>;

// bloque de informes (semanales + de avance + informes cargados a la obra)
function Informes({ T, D, o }) {
  const [doc, setDoc] = useState(null); const [ab, setAb] = useState(null);
  const sem = arr(D.informesSem[o.id]).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const av = arr(D.avance[o.id]).filter(a => a.html).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const inf = arr(o.informes).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (doc) return <Documento T={T} doc={doc} cerrar={() => setDoc(null)} />;
  const vacio = !sem.length && !av.length && !inf.length;
  return (<div>
    {vacio && <Vacio T={T}>Todavía no hay informes de esta obra.</Vacio>}
    {sem.length > 0 && <><Eyebrow T={T}>Informes semanales</Eyebrow>{sem.map(r => { const open = ab === r.id; return (<Card key={r.id} T={T} style={{ padding: "11px 13px", marginBottom: 8, borderLeft: `3px solid ${BRASS}` }}>
      <div onClick={() => setAb(open ? null : r.id)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>Semana {fFecha(r.desde)} al {fFecha(r.hasta)}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{arr(r.hechos).length} trabajos realizados{r.emitido ? " · emitido " + r.emitido : ""}</div></div><span style={{ color: T.muted, fontSize: 11 }}>{open ? "▲" : "▼"}</span></div>
      {open && <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
        {[["Trabajos realizados", r.hechos], ["Trabajos previstos", r.proxima]].map(([t, l]) => <div key={t}><div style={{ fontSize: 10, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: ".05em", margin: "4px 0 5px" }}>{t}</div>{arr(l).length ? <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>{arr(l).map((h, i) => <li key={i} style={{ fontSize: 12.5, lineHeight: 1.55, marginBottom: 3 }}>{h}</li>)}</ul> : <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>— sin registros —</div>}</div>)}
        {r.obs && <><div style={{ fontSize: 10, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: ".05em", margin: "4px 0 5px" }}>Observaciones</div><div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.obs}</div></>}
      </div>}</Card>); })}</>}
    {av.length > 0 && <><Eyebrow T={T}>Informes de avance</Eyebrow>{av.map((a, i) => <Card key={a.id || i} T={T} style={{ padding: "11px 13px", marginBottom: 8 }} onClick={() => setDoc({ html: a.html, titulo: "Informe de avance " + fTs(a.ts) })}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}><span style={{ fontSize: 13, fontWeight: 700 }}>Informe de avance · {fTs(a.ts)}</span><span style={{ color: BRASS, fontSize: 12, fontWeight: 800 }}>Ver ›</span></div></Card>)}</>}
    {inf.length > 0 && <><Eyebrow T={T}>Informes cargados</Eyebrow>{inf.map((x, i) => <Card key={x.id || i} T={T} style={{ padding: "10px 13px", marginBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{x.titulo || x.nombre || "Informe"}</div>{x.ts && <div style={{ fontSize: 10.5, color: T.muted }}>{fTs(x.ts)}</div>}{urlDe(x) && <Archivo T={T} a={x} />}</Card>)}</>}
  </div>);
}
// avance de obra en modo lectura (lo carga la constructora; lo ven estudio y propietario)
function AvanceLista({ T, D, o }) {
  const [doc, setDoc] = useState(null);
  const L = arr(D.avance[o.id]).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (doc) return <Documento T={T} doc={doc} cerrar={() => setDoc(null)} />;
  if (!L.length) return <Vacio T={T}>Todavía no hay avances cargados en esta obra.</Vacio>;
  return L.map((h, i) => { const fs = arr(h.fotos).length ? arr(h.fotos) : (h.fotoUrl ? [h.fotoUrl] : []); return (<Card key={h.id || i} T={T} style={{ marginBottom: 10, overflow: "hidden" }}>
    <div style={{ padding: "11px 13px" }}><div style={{ fontSize: 12, fontWeight: 800, color: BRASS }}>{fFecha(h.fecha) || fTs(h.ts)}</div>
      {h.avance && <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{h.avance}</div>}
      {h.descripcion && <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55, marginTop: 3, whiteSpace: "pre-wrap" }}>{h.descripcion}</div>}
      {h.html && <button onClick={() => setDoc({ html: h.html, titulo: "Informe de avance " + (fFecha(h.fecha) || "") })} style={{ marginTop: 8, background: "none", border: `1px solid ${BRASS}`, color: BRASS, borderRadius: 8, padding: "7px 12px", fontSize: 11.5, fontWeight: 700 }}>Ver informe</button>}</div>
    {fs.length > 0 && <div style={{ padding: "0 8px 8px" }}><Galeria T={T} items={fs} /></div>}
  </Card>); });
}
// bitácora: hechos con sus fotos y adjuntos
function Bitacora({ T, D, o }) {
  const L = D.bitacora.filter(h => h.obra_id === o.id).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.ts || 0) - (a.ts || 0)));
  if (!L.length) return <Vacio T={T}>Todavía no hay hechos en la bitácora de esta obra.</Vacio>;
  return L.map(h => { const fs = arr(h.fotos).length ? arr(h.fotos) : (h.fotoUrl ? [h.fotoUrl] : []); return (<Card key={h.id} T={T} style={{ marginBottom: 10, overflow: "hidden" }}>
    <div style={{ padding: "11px 13px" }}><div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700 }}>{fFecha(h.fecha)}</div>{h.titulo && <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{h.titulo}</div>}{h.desc && <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55, marginTop: 3, whiteSpace: "pre-wrap" }}>{h.desc}</div>}</div>
    {fs.length > 0 && <div style={{ padding: "0 8px 8px" }}><Galeria T={T} items={fs} /></div>}
    {arr(h.adjuntos).length > 0 && <div style={{ padding: "0 13px 11px" }}>{arr(h.adjuntos).map((a, i) => <Archivo key={i} T={T} a={a} />)}</div>}
  </Card>); });
}
function Hilo({ T, p }) {
  return arr(p.hilo).map((h, i) => <div key={i} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 11px", marginTop: 7 }}>
    <div style={{ fontSize: 10, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: ".05em" }}>{h.de === "estudio" ? "Estudio" : h.de === "vv" ? "Constructora" : h.de === "cliente" ? "Cliente" : h.de || ""}{h.fecha ? " · " + fFecha(h.fecha) : ""}</div>
    {h.texto && <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 3, whiteSpace: "pre-wrap" }}>{h.texto}</div>}
    {arr(h.archivos).map((a, j) => <Archivo key={j} T={T} a={a} />)}
  </div>);
}
const SEM = { rojo: "#E5604A", naranja: "#E58A3A", amarillo: "#E0B93A", verde: "#3E9B62", apagado: "#8B8B8B" };
const SEM_ORD = ["rojo", "naranja", "amarillo", "verde", "apagado"];
function semPedido(p) {
  if (p.estado === "resuelto") return { k: "apagado", t: "Resuelto" };
  if (p.estado === "respondido") return { k: "apagado", t: "Respondido", viol: true };
  const d = p.def && p.def.limite ? Math.round((new Date(p.def.limite + "T12:00:00") - new Date()) / 864e5) : null;
  if (d == null) return { k: "verde", t: "Abierto", d };
  if (d < 0) return { k: "rojo", t: `Vencido hace ${-d} d`, d };
  if (d <= 3) return { k: "rojo", t: d === 0 ? "Vence hoy" : `Pedir ya · ${d} d`, d };
  if (d <= 7) return { k: "naranja", t: `Urgente · ${d} d`, d };
  if (d <= 14) return { k: "amarillo", t: `Pedir · ${d} d`, d };
  return { k: "verde", t: `En ventana · ${d} d`, d };
}
function chipPedido(p, T) { const s = semPedido(p); return { t: s.t, c: s.viol ? "#8B5CF6" : SEM[s.k], k: s.k }; }
function cuentaSem(L) { const r = { rojo: 0, naranja: 0, amarillo: 0, verde: 0 }; L.forEach(p => { const k = semPedido(p).k; if (r[k] != null) r[k]++; }); return r; }
function Semaforo({ T, L }) { const c = cuentaSem(L); return <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>{["rojo", "naranja", "amarillo", "verde"].map(k => <div key={k} style={{ flex: "1 1 70px", textAlign: "center", border: `1px solid ${SEM[k]}`, borderRadius: 10, padding: "7px 4px", background: SEM[k] + "18" }}><div style={{ fontSize: 20, fontWeight: 800, color: SEM[k], fontFamily: "'Fraunces',serif" }}>{c[k]}</div><div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: T.sub }}>{k === "rojo" ? "Vencido / ya" : k === "naranja" ? "Urgente" : k === "amarillo" ? "Pedir" : "En ventana"}</div></div>)}</div>; }
function Checklist({ T, D, o }) {
  const L = D.pedidos.filter(p => p.obra_id === o.id);
  const [ab, setAb] = useState(null);
  if (!L.length) return <Vacio T={T}>Esta obra no tiene pedidos cargados.</Vacio>;
  const G = {}; L.forEach(p => { const t = (p.def && p.def.tarea) || "Sin tarea asignada"; (G[t] = G[t] || []).push(p); });
  const grupos = Object.entries(G).map(([t, ps]) => { const act = ps.filter(p => p.estado !== "resuelto"); const peor = act.length ? SEM_ORD.indexOf(act.map(p => semPedido(p).k).sort((x, y) => SEM_ORD.indexOf(x) - SEM_ORD.indexOf(y))[0]) : 4; const lim = act.map(p => (p.def && p.def.limite) || "9").sort()[0] || "z"; return { t, ps, peor, lim, act }; }).sort((a, b) => a.peor - b.peor || a.lim.localeCompare(b.lim));
  return (<div>
    <Semaforo T={T} L={L} />
    {grupos.map(g => { const k = SEM_ORD[g.peor]; return <Card key={g.t} T={T} style={{ padding: 0, marginBottom: 10, overflow: "hidden", borderLeft: `4px solid ${SEM[k]}` }}>
      <div style={{ padding: "11px 13px", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}><div style={{ fontSize: 14, fontWeight: 800 }}>{g.t}</div><div style={{ fontSize: 11, color: T.sub }}>{g.ps.length - g.act.length}/{g.ps.length} resueltos</div></div>
      {g.ps.slice().sort((a, b) => ((a.def && a.def.limite) || "9").localeCompare((b.def && b.def.limite) || "9")).map(p => { const c = chipPedido(p, T), open = ab === p.id; return <div key={p.id} style={{ borderTop: `1px solid ${T.border}`, padding: "9px 13px" }}>
        <div onClick={() => setAb(open ? null : p.id)} style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer" }}>
          <span style={{ width: 11, height: 11, borderRadius: 11, background: c.c, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, textDecoration: p.estado === "resuelto" ? "line-through" : "none", opacity: p.estado === "resuelto" ? .6 : 1 }}>{p.asunto}</div>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: c.c, whiteSpace: "nowrap" }}>{c.t}</span></div>
        {open && <div style={{ marginTop: 8 }}>{p.def && p.def.tipo && <div style={{ fontSize: 11.5, color: T.sub }}>{p.def.tipo}{p.def.limite ? " · límite " + fFecha(p.def.limite) : ""}</div>}{p.detalle && <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55, marginTop: 4 }}>{p.detalle}</div>}<Hilo T={T} p={p} />{arr(p.docs).map((a, i) => <Archivo key={i} T={T} a={a} />)}</div>}
      </div>; })}
    </Card>; })}
  </div>);
}
function ListaPedidos({ T, D, soloEstudio }) {
  const [f, setF] = useState("abiertos"); const [ab, setAb] = useState(null); const [col, setCol] = useState("");
  let L = D.pedidos.filter(p => !soloEstudio || p.para === "estudio" || (p.def && p.def.tipo));
  const abiertos = L.filter(p => p.estado !== "resuelto"), hechos = L.filter(p => p.estado === "resuelto");
  const lista = (f === "abiertos" ? abiertos : hechos).filter(p => !col || semPedido(p).k === col).slice().sort((a, b) => ((a.def && a.def.limite) || "9").localeCompare((b.def && b.def.limite) || "9"));
  const nomObra = (id) => (D.obras.find(o => o.id === id) || {}).nombre || "";
  return (<div>
    {f === "abiertos" && <><Semaforo T={T} L={abiertos} /><div className="xscroll" style={{ display: "flex", gap: 7, marginBottom: 10, overflowX: "auto" }}><Pill T={T} a={!col} onClick={() => setCol("")}>Todos</Pill>{["rojo", "naranja", "amarillo", "verde"].map(k => <Pill key={k} T={T} a={col === k} onClick={() => setCol(col === k ? "" : k)}>{k[0].toUpperCase() + k.slice(1)}</Pill>)}</div></>}
    <div style={{ display: "flex", gap: 7, marginBottom: 12 }}><Pill T={T} a={f === "abiertos"} onClick={() => setF("abiertos")}>Abiertos · {abiertos.length}</Pill><Pill T={T} a={f === "hechos"} onClick={() => setF("hechos")}>Resueltos · {hechos.length}</Pill></div>
    {lista.length === 0 && <Vacio T={T}>No hay pedidos en esta lista.</Vacio>}
    {lista.map(p => { const c = chipPedido(p, T), open = ab === p.id; return (<Card key={p.id} T={T} style={{ padding: 13, marginBottom: 9, borderLeft: `4px solid ${c.c}` }}>
      <div onClick={() => setAb(open ? null : p.id)} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap" }}><span style={{ fontSize: 10.5, fontWeight: 800, color: c.c, border: `1px solid ${c.c}`, borderRadius: 5, padding: "2px 7px" }}>{c.t}</span>{p.def && p.def.tipo && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, border: `1px solid ${T.border}`, borderRadius: 5, padding: "2px 7px" }}>{p.def.tipo}</span>}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.asunto}</div>
        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 3 }}>{nomObra(p.obra_id)}{p.def && p.def.tarea ? " · para " + p.def.tarea : ""}{p.def && p.def.limite ? " · límite " + fFecha(p.def.limite) : ""}</div>
      </div>
      {open && <div style={{ marginTop: 8 }}>{p.detalle && <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55 }}>{p.detalle}</div>}<Hilo T={T} p={p} />{arr(p.docs).map((a, i) => <Archivo key={i} T={T} a={a} />)}</div>}
    </Card>); })}
  </div>);
}

// ── PANEL CONSTRUCTORA ─────────────────────────────────────────────────────
function Constructora(x) {
  const { tab } = x;
  if (!x.D.obras.length) return wrap(<Vacio T={x.T}>No hay obras cargadas.</Vacio>);
  if (tab === "inicio") return <CInicio {...x} />;
  if (tab === "obras") return <CObras {...x} />;
  if (tab === "pedidos") return wrap(<><Eyebrow T={x.T}>Pedidos</Eyebrow><ListaPedidos T={x.T} D={x.D} /></>);
  return <CMas {...x} />;
}
function IAOverlay({ T, cfg, D, cerrar }) {
  const [msgs, setMsgs] = useState([]);
  const noop = () => {};
  const db = useMemo(() => ({ ...D.ia, obras: D.obras, bitacora: D.bitacora, avance: D.avance, pedidos: D.pedidos, matpedidos: D.matpedidos, adicionales: D.adicionales, modelosObra: D.modelosObra, certConformidad: [], lics: [], archivosGen: [], materiales: [], subcontratos: [], proveedores: [], herramientas: [], setPedidos: noop, setPersonal: noop, setMensajes: noop, setGestion: noop, setTareas: noop, setMatpedidos: noop }), [D]);
  return (<div style={{ position: "fixed", inset: 0, zIndex: 450, background: T.bg, display: "flex", flexDirection: "column" }}>
    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: `calc(10px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 14px 10px`, borderBottom: `1px solid ${T.border}`, background: T.card }}>
      <button onClick={cerrar} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700 }}>← Volver</button>
      <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>NEXO IA</span><span style={{ fontSize: 11.5, color: T.muted }}>Responde con lo que está cargado</span>
    </div>
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", maxWidth: 900, width: "100%", margin: "0 auto" }}><ChatIA db={db} cfg={{ ...cfg, apiKey: D.apiKey }} apiKey={D.apiKey} msgs={msgs} setMsgs={setMsgs} /></div>
  </div>);
}
function CInicio({ T, cfg, D, setTab, setObraSel }) {
  const [iaAbierta, setIaAbierta] = useState(false);
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const abiertos = D.pedidos.filter(p => p.estado !== "resuelto");
  const dias = (p) => p.def && p.def.limite ? Math.round((new Date(p.def.limite + "T12:00:00") - hoy) / 864e5) : null;
  const venc = abiertos.filter(p => dias(p) != null && dias(p) < 0), porv = abiertos.filter(p => dias(p) != null && dias(p) >= 0 && dias(p) <= 7);
  const obrasAfect = new Set([...venc, ...porv].map(p => p.obra_id)).size;
  const rgb = hexARgb(T.text).join(",");
  const act = D.obras.filter(o => o.estado === "curso" || !o.estado); const L = act.length ? act : D.obras;
  const fotoDe = (q) => [...arr(D.renders[q.id]).map(urlDe), ...arr(q.fotos).map(urlDe)].find(u => u && !esVideo(u)) || "";
  const novedades = [...D.obras.flatMap(x => arr(D.informesSem[x.id]).map(r => ({ ts: r.ts, t: `Informe semanal · ${x.nombre}` }))), ...D.bitacora.map(h => ({ ts: h.ts, t: `Bitácora · ${(D.obras.find(x => x.id === h.obra_id) || {}).nombre || ""}: ${h.titulo || h.desc || ""}` }))].filter(n => n.ts).sort((a, b) => b.ts - a.ts).slice(0, 5);
  const hora = new Date().getHours(), saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";
  const plural = (n, a, b) => n + " " + (n === 1 ? a : b);
  return (<div style={{ flex: 1, background: T.bg }}>
    <div style={{ padding: "22px clamp(18px,3vw,40px) 30px" }}>
      <div style={{ fontSize: 10.5, letterSpacing: ".2em", textTransform: "uppercase", color: `rgba(${rgb},.55)`, fontWeight: 700 }}>{saludo} · {cfg.nombre}</div>
      <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: "clamp(24px,3.4vw,34px)", lineHeight: 1.2, margin: "8px 0 18px" }}>{venc.length + porv.length === 0 ? `${plural(L.length, "obra en curso", "obras en curso")}, sin pedidos por vencer` : `${plural(venc.length, "pedido vencido", "pedidos vencidos")} y ${porv.length} por vencer en ${plural(obrasAfect, "obra", "obras")}`}</div>
      <div style={{ position: "relative" }}>
      {[["‹", -1], ["›", 1]].map(([t, d]) => <button key={t} onClick={() => { const e = document.getElementById("carr-obras"); if (e) e.scrollBy({ left: d * 380, behavior: "smooth" }); }} style={{ position: "absolute", top: 70, [d < 0 ? "left" : "right"]: -6, zIndex: 5, width: 36, height: 36, borderRadius: 18, border: "1px solid rgba(255,255,255,.3)", background: "rgba(0,0,0,.65)", color: "#fff", fontSize: 22, lineHeight: 1 }}>{t}</button>)}
      <div id="carr-obras" className="xscroll" style={{ display: "flex", gap: 14, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 12, marginBottom: 16 }}>
        {L.map(o => { const f = fotoDe(o); return (<div key={o.id} onClick={() => { setObraSel && setObraSel(o.id); setTab("obras"); }} style={{ flex: "0 0 min(360px,82%)", scrollSnapAlign: "start", background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", cursor: "pointer", boxShadow: T.shadow }}>
          <div style={{ height: 170, background: `linear-gradient(135deg,${T.bg},${T.border})` }}>{f && <img src={f} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}</div>
          <div style={{ padding: "13px 15px 15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 20 }}>{o.nombre}</div><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 24, color: "#E9B949" }}>{o.avance || 0}%</div></div>
            {o.sector && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{o.sector}</div>}
            <div style={{ height: 5, background: T.border, borderRadius: 4, margin: "10px 0 8px" }}><div style={{ width: (o.avance || 0) + "%", height: 5, background: "#E9B949", borderRadius: 4 }} /></div>
            <div style={{ fontSize: 11.5, color: T.muted }}>{arr(o.fotos).length} fotos · {D.bitacora.filter(h => h.obra_id === o.id).length} en bitácora</div>
          </div></div>); })}
      </div>
      </div>
      <div onClick={() => setIaAbierta(true)} style={{ display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${BRASS}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer", marginBottom: 16 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Estrella s={30} /></div><div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800, color: "#E9B949", letterSpacing: ".04em" }}>NEXO IA</div><div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>Preguntale a la app por cualquier obra. Responde con lo que está cargado.</div></div><span style={{ color: T.muted, fontSize: 18 }}>›</span></div>
      {iaAbierta && <IAOverlay T={T} cfg={cfg} D={D} cerrar={() => setIaAbierta(false)} />}
      <div style={{ height: 1, background: `rgba(${rgb},.1)`, marginBottom: 6 }} />
      {abiertos.length > 0 && <div onClick={() => setTab("pedidos")} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid rgba(${rgb},.07)`, cursor: "pointer", fontSize: 12.5 }}><span><b style={{ color: "#D9B27C" }}>{abiertos.length}</b> {abiertos.length === 1 ? "pedido abierto" : "pedidos abiertos"} con el estudio</span><span style={{ color: `rgba(${rgb},.35)` }}>›</span></div>}
      <div style={{ fontSize: 10.5, fontWeight: 800, color: `rgba(${rgb},.4)`, textTransform: "uppercase", letterSpacing: ".05em", margin: "18px 0 10px" }}>Novedades recientes</div>
      {novedades.length === 0 && <div style={{ fontSize: 12, color: `rgba(${rgb},.4)` }}>Sin novedades todavía.</div>}
      {novedades.map((n, k) => <div key={k} style={{ padding: "11px 0", borderBottom: `1px solid rgba(${rgb},.07)`, fontSize: 12.5 }}>{n.t} <span style={{ color: `rgba(${rgb},.4)`, fontSize: 11 }}>· {fTs(n.ts)}</span></div>)}
    </div>
  </div>);
}
const SUBS = [["fotos", "Fotos"], ["avance", "Avance"], ["bitacora", "Bitácora"], ["informes", "Informes"], ["crono", "Cronograma"], ["check", "Checklist"], ["archivos", "Archivos"], ["adic", "Adicionales"]];
function CObras({ T, D, cfg, rol, obraSel, setObraSel }) {
  const est = rol === "estudio";
  const [idL, setIdL] = useState(null); const id = obraSel != null ? obraSel : idL; const setId = (v) => { setIdL(v); setObraSel && setObraSel(v); }; const [sub, setSub] = useState("crono");
  const o = D.obras.find(x => x.id === id);
  const fotoDe = (q) => [...arr(D.renders[q.id]).map(urlDe), ...arr(q.fotos).map(urlDe)].find(u => u && !esVideo(u)) || "";
  if (!o) return wrap(<><Eyebrow T={T}>Obras</Eyebrow>{D.obras.map(x => { const f = fotoDe(x); return <Card key={x.id} T={T} onClick={() => { setId(x.id); setSub("crono"); }} style={{ padding: 10, marginBottom: 10, cursor: "pointer", display: "flex", gap: 13, alignItems: "center" }}>
    <div style={{ width: 96, height: 72, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: `linear-gradient(135deg,${T.bg},${T.border})` }}>{f && <img src={f} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 18 }}>{x.nombre}</div><div style={{ fontSize: 14, fontWeight: 800, color: "#E9B949" }}>{x.avance || 0}%</div></div>
      <div style={{ height: 5, background: T.border, borderRadius: 4, margin: "8px 0 7px" }}><div style={{ width: (x.avance || 0) + "%", height: 5, background: "#E9B949", borderRadius: 4 }} /></div>
      {(() => { const c = cuentaSem(D.pedidos.filter(p => p.obra_id === x.id)); return (c.rojo + c.naranja + c.amarillo) > 0 && <div style={{ display: "flex", gap: 8, marginBottom: 5 }}>{["rojo", "naranja", "amarillo"].filter(k => c[k]).map(k => <span key={k} style={{ fontSize: 11, fontWeight: 800, color: SEM[k] }}>● {c[k]}</span>)}<span style={{ fontSize: 11, color: T.sub }}>pedidos</span></div>; })()}
      <div style={{ fontSize: 11.5, color: T.sub }}>{x.sector ? x.sector + " · " : ""}{arr(x.fotos).length} fotos · {D.bitacora.filter(h => h.obra_id === x.id).length} en bitácora · {arr(x.informes).length + arr(D.informesSem[x.id]).length} informes</div>
    </div></Card>; })}</>);
  const mid = (D.asig && D.asig[o.id] != null) ? D.asig[o.id] : o.modeloId;
  return wrap(<>
    <button onClick={() => setId(null)} style={{ background: "none", border: 0, color: T.accent, fontSize: 13, fontWeight: 800, padding: "0 0 10px" }}>← Obras</button>
    {(() => { const f = fotoDe(o); return <div style={{ position: "relative", height: 190, borderRadius: 16, overflow: "hidden", marginBottom: 14, background: `linear-gradient(135deg,${T.card},${T.bg})`, border: `1px solid ${T.border}` }}>
      {f && <img src={f} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.4) 50%, rgba(0,0,0,.88) 100%)" }} />
      <div style={{ position: "absolute", left: 18, right: 18, bottom: 14, color: "#f2f0eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 26 }}>{o.nombre}</div><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 28, color: "#E9B949" }}>{o.avance || 0}%</div></div>
        <div style={{ height: 5, background: "rgba(255,255,255,.22)", borderRadius: 4, margin: "8px 0 6px" }}><div style={{ width: (o.avance || 0) + "%", height: 5, background: "#E9B949", borderRadius: 4 }} /></div>
        <div style={{ fontSize: 11.5, opacity: .8 }}>{o.sector || ""}</div>
      </div></div>; })()}
    {o.obs && <Card T={T} style={{ padding: 12, marginBottom: 12, fontSize: 12.5, color: T.sub, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{o.obs}</Card>}
    <div className="xscroll" style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 10 }}>{(est ? SUBS.filter(([k]) => k !== "adic") : SUBS).map(([k, l]) => <Pill key={k} T={T} a={sub === k} onClick={() => setSub(k)}>{l}</Pill>)}</div>
    {sub === "fotos" && <Galeria T={T} items={[...arr(o.fotos), ...arr(o.videos)]} />}
    {sub === "avance" && est && <AvanceLista T={T} D={D} o={o} />}
    {sub === "avance" && !est && <div style={{ margin: "0 calc(-1 * clamp(16px,3vw,40px))" }}><AvanceView key={o.id} T={T} obras={[o]} avance={D.avance} setAvance={D.setAvance} apiKey={D.apiKey} cfg={cfg} certif={D.certif} envios={D.envios} setEnvios={D.setEnvios} /></div>}
    {sub === "bitacora" && est && <Bitacora T={T} D={D} o={o} />}
    {sub === "bitacora" && !est && <div style={{ margin: "0 calc(-1 * clamp(16px,3vw,40px))" }}><BitacoraView key={o.id} T={T} obras={[o]} bitacora={D.bitacora} setBitacora={D.setBitacora} cfg={cfg} /></div>}
    {sub === "informes" && <Informes T={T} D={D} o={o} />}
    {sub === "crono" && est && <div style={{ margin: "0 calc(-1 * clamp(16px,3vw,40px))" }}><CronoPro key={o.id + mid} T={T} titulo="Cronograma" lado="cliente" modelosObra={D.modelosObra} gestion={D.gestion} obras={[{ id: o.id, nombre: o.nombre, inicio: o.inicio, cierre: o.cierre, modeloId: mid }]} data={D.cronoPro} setData={() => {}} /></div>}
    {sub === "crono" && !est && <div style={{ margin: "0 calc(-1 * clamp(16px,3vw,40px))" }}>
      <div style={{ padding: "0 clamp(16px,3vw,40px)" }}><div style={{ fontSize: 10.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em" }}>Modelo de cronograma de esta obra</div>
        <Sel T={T} value={mid || ""} onChange={v => D.setAsig(p => ({ ...(p || {}), [o.id]: v }))}><option value="">— sin modelo —</option>{D.modelosObra.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</Sel>
        {!mid && <div style={{ fontSize: 12, color: T.muted, margin: "-6px 0 10px" }}>Esta obra no tiene modelo asignado. Los modelos se crean en Más → Modelos de cronograma.</div>}</div>
      <CronoPro key={o.id + mid} T={T} titulo="Cronograma" lado="cliente" modelosObra={D.modelosObra} gestion={D.gestion} obras={[{ id: o.id, nombre: o.nombre, inicio: o.inicio, cierre: o.cierre, modeloId: mid }]} data={D.cronoPro} setData={D.setCronoPro} /></div>}
    {sub === "check" && <Checklist T={T} D={D} o={o} />}
    {sub === "archivos" && (arr(o.archivos).length ? arr(o.archivos).map((a, i) => <Archivo key={i} T={T} a={a} />) : <Vacio T={T}>No hay archivos cargados.</Vacio>)}
    {sub === "adic" && <ListaAdic T={T} D={D} obra={o.id} />}
  </>);
}
function ListaAdic({ T, D, obra }) {
  const L = D.adicionales.filter(a => !obra || a.obra_id === obra).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (!L.length) return <Vacio T={T}>No hay adicionales cargados.</Vacio>;
  return L.map((a, i) => <Card key={a.id || i} T={T} style={{ padding: 13, marginBottom: 9 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div style={{ fontSize: 13.5, fontWeight: 800 }}>{a.adicionalNro ? "Adicional N° " + a.adicionalNro : "Adicional"}{a.tipoAdicional ? " · " + a.tipoAdicional : ""}</div><div style={{ fontSize: 11, color: T.muted }}>{fFecha(a.fecha)}</div></div>
    <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>{(D.obras.find(o => o.id === a.obra_id) || {}).nombre}</div>
    {a.requerimiento && <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 6 }}>{a.requerimiento}</div>}
    {a.descripcionTecnica && <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.55, marginTop: 4 }}>{a.descripcionTecnica}</div>}
    {a.resolucion && <div style={{ marginTop: 6 }}><Badge c={T.accent} b={T.accentLight}>{a.resolucion}</Badge></div>}
    {arr(a.docsAdjuntos).map((d, j) => <Archivo key={j} T={T} a={d} />)}
  </Card>);
}
function CBitacora({ T, D }) { const [o, setId] = useObra(D); return wrap(<><Eyebrow T={T}>Bitácora</Eyebrow><SelObra T={T} D={D} o={o} setId={setId} /><Bitacora T={T} D={D} o={o} /></>); }
function CMas({ T, D, cfg, recargar, st }) {
  const [ver, setVer] = useState("");
  if (ver === "modelos") return <div style={{ flex: 1, overflowY: "auto" }}><ModelosObraView db={{ modelosObra: D.modelosObra, setModelosObra: D.setModelosObra }} cfg={cfg} onBack={() => setVer("")} /></div>;
  return wrap(<><Eyebrow T={T}>Más</Eyebrow>
    <Card T={T} onClick={() => setVer("modelos")} style={{ padding: "13px 15px", marginBottom: 8, cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 13.5, fontWeight: 700 }}>Modelos de cronograma</div><div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>{D.modelosObra.length} modelos · se asignan a cada obra dentro de su Cronograma</div></div><span style={{ color: T.muted }}>›</span></div></Card>
    <Card T={T} style={{ padding: "13px 15px", marginBottom: 8 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>Modelo de cada obra</div>{D.obras.map(o => { const id = (D.asig && D.asig[o.id] != null) ? D.asig[o.id] : o.modeloId; const m = D.modelosObra.find(q => q.id === id); return <div key={o.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}><span>{o.nombre}</span><span style={{ color: m ? T.accent : T.muted, fontWeight: 700 }}>{m ? m.nombre : "sin modelo"}</span></div>; })}</Card>
    <Card T={T} style={{ padding: "13px 15px" }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>Datos de las obras</div><div style={{ fontSize: 12, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>{D.obras.length} obras · {D.bitacora.length} hechos de bitácora · {D.obras.reduce((a, o) => a + arr(o.fotos).length, 0)} fotos. {st === "cache" ? "Mostrando la última copia guardada en este aparato." : "Actualizado recién."} Esta app solo lee: no modifica nada de las otras aplicaciones. Lo que cargues acá (avances, bitácoras, cronograma, modelos) queda en este aparato.</div><button onClick={recargar} style={{ marginTop: 10, background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: "10px 16px", fontSize: 12.5, fontWeight: 700 }}>Actualizar ahora</button><button onClick={() => { if (confirm("¿Descartar lo cargado en este aparato y volver a los datos reales?")) D.restaurar(); }} style={{ marginTop: 10, marginLeft: 8, background: "transparent", color: T.sub, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 14px", fontSize: 12.5, fontWeight: 600 }}>Volver a datos reales</button></Card></>);
}

// ── PANEL ESTUDIO ──────────────────────────────────────────────────────────
function Estudio(x) {
  const { T, D, tab } = x;
  if (tab === "inicio") return <CInicio {...x} />;
  if (tab === "obras") return <CObras {...x} rol="estudio" />;
  if (tab === "planos") {
    const L = D.pedidos.flatMap(p => arr(p.hilo).filter(h => h.de === "estudio").flatMap(h => arr(h.archivos).map(a => ({ a, p, fecha: h.fecha, ts: h.ts })))).sort((x, y) => (y.ts || 0) - (x.ts || 0));
    return wrap(<><Eyebrow T={T}>Planos y documentos entregados</Eyebrow>{L.length === 0 && <Vacio T={T}>Todavía no hay documentos entregados.</Vacio>}{L.map((x, i) => <Card key={i} T={T} style={{ padding: "11px 13px", marginBottom: 8 }}><div style={{ fontSize: 12, color: T.sub }}>{(D.obras.find(o => o.id === x.p.obra_id) || {}).nombre} · {x.p.asunto} · {fFecha(x.fecha)}</div><Archivo T={T} a={x.a} /></Card>)}</>);
  }
  if (tab === "ajustes") return <div style={{ flex: 1, overflowY: "auto" }}><AjustesScreen T={T} cfg={x.cfg} setCfg={x.setCfg} obras={D.obras} setObras={() => {}} renders={D.renders} setRenders={D.setRenders} /></div>;
  return wrap(<><Eyebrow T={T}>Lo que te piden</Eyebrow><ListaPedidos T={T} D={D} soloEstudio /></>);
}

// ── PANEL PROPIETARIO (sin alertas ni costos internos) ─────────────────────
function Propietario({ T, D, tab }) {
  const [o, setId] = useObra(D);
  if (!o) return wrap(<Vacio T={T}>No hay obras.</Vacio>);
  const fotos = [...arr(o.fotos), ...D.bitacora.filter(h => h.obra_id === o.id).flatMap(h => arr(h.fotos))];
  if (tab === "fotos") return wrap(<><Eyebrow T={T}>Fotos de tu obra</Eyebrow><SelObra T={T} D={D} o={o} setId={setId} /><Galeria T={T} items={fotos} /></>);
  if (tab === "informes") return wrap(<><Eyebrow T={T}>Informes</Eyebrow><SelObra T={T} D={D} o={o} setId={setId} /><Informes T={T} D={D} o={{ ...o, informes: arr(o.informes) }} /></>);
  const r0 = arr(D.renders[o.id])[0];
  return wrap(<><Eyebrow T={T}>Tu obra</Eyebrow><SelObra T={T} D={D} o={o} setId={setId} />
    <Card T={T} style={{ overflow: "hidden" }}>{r0 && r0.url && <img src={r0.url} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />}
      <div style={{ padding: 18 }}><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 22 }}>{o.nombre}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "14px 0 10px" }}><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 40, lineHeight: 1 }}>{o.avance || 0}</div><div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted }}>% de avance</div></div>
        <div style={{ height: 5, background: T.border, borderRadius: 4 }}><div style={{ width: (o.avance || 0) + "%", height: 5, background: T.accent, borderRadius: 4 }} /></div></div></Card>
    {fotos.length > 0 && <><div style={{ height: 16 }} /><Eyebrow T={T}>Últimas fotos</Eyebrow><Galeria T={T} items={fotos.slice(-6).reverse()} /></>}</>);
}
