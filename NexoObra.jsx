// NEXO Obra — versión simplificada: una sola app, tres paneles (Constructora · Estudio · Propietario).
// Lee en SOLO LECTURA los datos reales de las obras (mismas claves que las otras apps) y usa el mismo estilo.
// No escribe nada en la base: no puede romper ni pisar datos de las otras aplicaciones.
import React, { useState, useEffect, useMemo } from "react";
import CronoPro, { alertasCrono } from "./CronoPro.jsx";
import { AvanceView, BitacoraView } from "./Cliente.jsx";

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const BRASS = "#B0894F";
const KEYS = ["vv_obras", "vv_bitacora", "vv_avance", "vv_informes_sem", "vv_renders", "vv_pedidos", "vv_matpedidos", "vv_cronopro", "vv_adicionales", "vv_certif_sem", "cliente_cfg", "vv_cfg", "vv_modelos_obra", "vv_gestion", "cliente_envios_prop"];
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
  estudio: { n: "Estudio", d: "Proyecta y dirige la obra", pts: ["Pedidos que le hacen, con su fecha límite", "Respuestas con planos y archivos", "Planos y documentos entregados", "Adicionales de obra"] },
  propietario: { n: "Propietario", d: "Sigue su obra", pts: ["Avance de su obra", "Fotos de la obra", "Informes semanales y de avance", "Sin alertas ni costos internos"] },
};
const NAVS = {
  constructora: [["inicio", "Inicio"], ["obras", "Obras"], ["avance", "Avance"], ["pedidos", "Pedidos"], ["bitacora", "Bitácora"], ["mas", "Más"]],
  estudio: [["pedidos", "Pedidos"], ["planos", "Planos"], ["adicionales", "Adicionales"]],
  propietario: [["obra", "Mi obra"], ["fotos", "Fotos"], ["informes", "Informes"]],
};
const KEYP = "nexoobra_perfil";

export default function NexoObraApp() {
  const { R, st, recargar } = useReal();
  const [perfil, setPerfil] = useState(() => { try { return localStorage.getItem(KEYP) || ""; } catch { return ""; } });
  const [verAlcance, setVerAlcance] = useState(false);
  const [tab, setTab] = useState("");
  useEffect(() => { try { perfil ? localStorage.setItem(KEYP, perfil) : localStorage.removeItem(KEYP); } catch { } }, [perfil]);
  const cfg = useMemo(() => ({ ...DEFAULT_CFG, ...(R && R.cliente_cfg ? R.cliente_cfg : {}) }), [R]);
  const T = useMemo(() => theme(cfg), [cfg]);
  // La base puede traer obras repetidas (error viejo ya corregido): se deja una sola por obra, la última.
  const obras = useMemo(() => { const m = new Map(); arr(R && R.vv_obras).forEach(o => { if (o && o.id != null) m.set(o.id, o); }); return [...m.values()].filter(o => !o.privada); }, [R]);
  const [bitacoraV, setBitacora, rstB] = useOverlay("bitacora", arr(R && R.vv_bitacora));
  const [avanceV, setAvance, rstA] = useOverlay("avance", (R && R.vv_avance) || {});
  const [cronoV, setCronoPro, rstC] = useOverlay("cronopro", (R && R.vv_cronopro) || { obras: {} });
  const [enviosV, setEnvios, rstE] = useOverlay("envios", (R && R.cliente_envios_prop) || {});
  const restaurar = () => { rstB(); rstA(); rstC(); rstE(); };
  const D = useMemo(() => ({
    setBitacora, setAvance, setCronoPro, setEnvios, restaurar, envios: enviosV, apiKey: ((R && R.vv_cfg) || {}).apiKey, certif: (R && R.vv_certif_sem) || {}, modelosObra: arr(R && R.vv_modelos_obra), gestion: (R && R.vv_gestion) || null,
    obras, bitacora: arr(bitacoraV), avance: avanceV || {}, informesSem: (R && R.vv_informes_sem) || {}, renders: (R && R.vv_renders) || {},
    pedidos: arr(R && R.vv_pedidos), matpedidos: arr(R && R.vv_matpedidos), cronoPro: cronoV || { obras: {} }, adicionales: arr(R && R.vv_adicionales),
  }), [R, obras, bitacoraV, avanceV, cronoV, enviosV]);
  const entrar = (p) => { setPerfil(p); setVerAlcance(false); setTab(p ? NAVS[p][0][0] : ""); };
  useEffect(() => { if (perfil && !tab) setTab(NAVS[perfil][0][0]); }, [perfil, tab]);
  const ctx = { T, cfg, D, tab, setTab };

  return (<div style={{ background: T.bg }}><div style={{ height: "100dvh", width: "100%", display: "flex", flexDirection: "column", background: T.bg, color: T.text, fontFamily: "'Inter',sans-serif" }}>
    <style>{CSS}{`body{background:${T.bg}}`}</style>
    {(!perfil || verAlcance) ? <Alcance T={T} cfg={cfg} perfil={perfil} entrar={entrar} volver={() => setVerAlcance(false)} st={st} R={R} recargar={recargar} />
      : (<>
        <Cabecera T={T} cfg={cfg} perfil={perfil} onAlcance={() => setVerAlcance(true)} />
        {st === "error" && <div style={{ padding: "30px 22px", textAlign: "center", color: T.sub, fontSize: 13, lineHeight: 1.6 }}>No pude traer los datos de las obras ahora. Revisá la conexión.<div><button onClick={recargar} style={{ marginTop: 12, background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: "11px 18px", fontSize: 13, fontWeight: 700 }}>Reintentar</button></div></div>}
        {st === "cargando" && <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>Cargando tus obras…</div>}
        {R && <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {perfil === "constructora" && <Constructora {...ctx} recargar={recargar} st={st} />}
          {perfil === "estudio" && <Estudio {...ctx} />}
          {perfil === "propietario" && <Propietario {...ctx} />}
        </div>}
        <Nav T={T} perfil={perfil} tab={tab} setTab={setTab} />
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
    <div style={{ height: 1, background: T.border }} />
  </div>);
}
function Nav({ T, perfil, tab, setTab }) {
  if (!perfil) return null;
  return (<nav style={{ flexShrink: 0, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "center", paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)" }}>
    <div style={{ width: "100%", display: "flex" }}>{NAVS[perfil].map(([id, l]) => { const a = tab === id; return <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: "none", border: "none", padding: "6px 4px 5px", fontSize: 10.5, fontWeight: a ? 800 : 600, color: a ? T.accent : T.sub, borderTop: `2px solid ${a ? BRASS : "transparent"}`, marginTop: -1 }}>{l}</button>; })}</div>
  </nav>);
}

function Alcance({ T, cfg, perfil, entrar, volver, st, R, recargar }) {
  return (<div style={{ flex: 1, overflowY: "auto", padding: `calc(26px + max(env(safe-area-inset-top), ${SAFE_TOP_PX}px)) 20px 30px` }}>
    <div style={{ width: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        {cfg.logo ? <img src={cfg.logo} alt="" style={{ maxHeight: 60, maxWidth: 240, objectFit: "contain" }} /> : <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 28, color: T.text }}>NEXO Obra</div>}
      </div>
      <div style={{ textAlign: "center", fontSize: 12.5, color: T.sub, lineHeight: 1.55, margin: "10px 0 20px" }}>Una sola app, tres paneles. Cada invitación abre solo el suyo.</div>
      {R ? <div style={{ fontSize: 11.5, color: T.accent, background: T.accentLight, borderRadius: 10, padding: "9px 12px", marginBottom: 16, textAlign: "center", fontWeight: 700 }}>{new Set(arr(R.vv_obras).filter(o => o && !o.privada).map(o => o.id)).size} obras reales cargadas{st === "cache" ? " (última copia de este aparato)" : ""} · solo lectura</div>
        : <div style={{ fontSize: 12, color: T.sub, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 16, textAlign: "center" }}>{st === "error" ? "No pude traer los datos todavía." : "Cargando tus obras…"} <button onClick={recargar} style={{ background: "none", border: 0, color: BRASS, fontWeight: 800, fontSize: 12 }}>Reintentar</button></div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginBottom: 14 }}>
      {Object.entries(PANELES).map(([k, p]) => {
        const mio = perfil === k, bloq = perfil && !mio;
        return (<Card key={k} T={T} style={{ padding: 16, opacity: bloq ? .5 : 1, borderColor: mio ? T.accent : T.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 19, color: mio ? T.accent : T.text }}>{bloq ? "🔒 " : ""}{p.n}</div><div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{p.d}</div></div>
            {mio && <Badge c={T.accent} b={T.accentLight}>Tu panel</Badge>}
          </div>
          {!bloq && <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: T.sub, lineHeight: 1.65 }}>{p.pts.map(t => <li key={t}>{t}</li>)}</ul>}
          {bloq && <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>Bloqueado: este panel lo ve {k === "constructora" ? "la constructora" : k === "estudio" ? "el estudio" : "el propietario"}.</div>}
          {!perfil && <button disabled={!R} onClick={() => entrar(k)} style={{ width: "100%", marginTop: 12, background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: 12, fontSize: 13, fontWeight: 700, opacity: R ? 1 : .5 }}>Entrar como {p.n.toLowerCase()}</button>}
        </Card>);
      })}
      </div>
      {perfil && <button onClick={volver} style={{ width: "100%", background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: 12, fontSize: 13, fontWeight: 700 }}>Volver a mi panel</button>}
      {perfil && <button onClick={() => entrar("")} style={{ width: "100%", marginTop: 10, background: "transparent", color: T.sub, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: 11, fontSize: 12.5, fontWeight: 600 }}>Cambiar de perfil (solo en la demo)</button>}
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
function chipPedido(p, T) {
  const d = p.def && p.def.limite ? Math.round((new Date(p.def.limite + "T12:00:00") - new Date()) / 864e5) : null;
  if (p.estado === "resuelto") return { t: "Resuelto", c: "#3E9B62" };
  if (p.estado === "respondido") return { t: "Respondido", c: "#8B5CF6" };
  if (d != null && d < 0) return { t: `Vencido hace ${-d} d`, c: "#E5604A" };
  if (d != null) return { t: d === 0 ? "Vence hoy" : `Vence en ${d} d`, c: d <= 7 ? "#E0A04A" : "#3E9B62" };
  return { t: "Abierto", c: T.sub };
}
function ListaPedidos({ T, D, soloEstudio }) {
  const [f, setF] = useState("abiertos"); const [ab, setAb] = useState(null);
  let L = D.pedidos.filter(p => !soloEstudio || p.para === "estudio" || (p.def && p.def.tipo));
  const abiertos = L.filter(p => p.estado !== "resuelto"), hechos = L.filter(p => p.estado === "resuelto");
  const lista = (f === "abiertos" ? abiertos : hechos).slice().sort((a, b) => ((a.def && a.def.limite) || "9").localeCompare((b.def && b.def.limite) || "9"));
  const nomObra = (id) => (D.obras.find(o => o.id === id) || {}).nombre || "";
  return (<div>
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
  if (tab === "avance") return <div style={{ flex: 1, overflowY: "auto" }}><AvanceView T={x.T} obras={x.D.obras} avance={x.D.avance} setAvance={x.D.setAvance} apiKey={x.D.apiKey} cfg={x.cfg} certif={x.D.certif} envios={x.D.envios} setEnvios={x.D.setEnvios} /></div>;
  if (tab === "bitacora") return <div style={{ flex: 1, overflowY: "auto" }}><BitacoraView T={x.T} obras={x.D.obras} bitacora={x.D.bitacora} setBitacora={x.D.setBitacora} cfg={x.cfg} /></div>;
  return <CMas {...x} />;
}
function CInicio({ T, cfg, D, setTab }) {
  const [i, setI] = useState(0);
  const act = D.obras.filter(o => o.estado === "curso" || !o.estado); const L = act.length ? act : D.obras;
  useEffect(() => { if (L.length < 2) return; const t = setInterval(() => setI(k => (k + 1) % L.length), 4500); return () => clearInterval(t); }, [L.length]);
  const o = L[i % L.length];
  const rgbT = hexARgb(T.bg).join(","), TXR = hexARgb(T.text).join(",");
  const r0 = arr(D.renders[o.id])[0];
  const alertas = useMemo(() => { try { return alertasCrono(D.cronoPro, D.obras) || []; } catch { return []; } }, [D]);
  const abiertos = D.pedidos.filter(p => p.estado !== "resuelto");
  const novedades = [...D.obras.flatMap(x => arr(D.informesSem[x.id]).map(r => ({ ts: r.ts, t: `Informe semanal · ${x.nombre}` }))), ...D.bitacora.map(h => ({ ts: h.ts, t: `Bitácora · ${(D.obras.find(x => x.id === h.obra_id) || {}).nombre || ""}: ${h.titulo || h.desc || ""}` }))].filter(n => n.ts).sort((a, b) => b.ts - a.ts).slice(0, 5);
  const col = { retraso: "#E5604A", rojo: "#E5604A", amarillo: "#E0A04A", verde: "#3E9B62" };
  return (<div style={{ flex: 1, background: T.bg }}>
    <div style={{ position: "relative", height: "34vh", minHeight: 230, maxHeight: 380, overflow: "hidden", background: T.bg }}>
      {r0 && r0.url ? <img key={r0.url} src={r0.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: .85, animation: "fadeIn .6s ease" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg,${T.bg},${T.card})` }} />}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(${rgbT},.15) 0%, rgba(${rgbT},.4) 45%, ${T.bg} 100%)` }} />
      <div style={{ position: "absolute", bottom: 20, left: "clamp(18px,3vw,40px)", right: "clamp(18px,3vw,40px)" }}>
        <div style={{ fontSize: 9.5, letterSpacing: ".2em", textTransform: "uppercase", color: `rgba(${TXR},.55)` }}>{cfg.nombre}</div>
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 24, color: T.text, marginTop: 4 }}>{o.nombre}</div>
      </div>
      {L.length > 1 && <div style={{ position: "absolute", bottom: 8, right: 16, display: "flex", gap: 4 }}>{L.map((q, k) => <span key={q.id} style={{ width: 5, height: 5, borderRadius: "50%", background: k === i % L.length ? BRASS : `rgba(${TXR},.35)` }} />)}</div>}
    </div>
    <div style={{ padding: "22px clamp(18px,3vw,40px) 30px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 40, lineHeight: 1 }}>{o.avance || 0}</div><div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: `rgba(${TXR},.45)`, lineHeight: 1.3 }}>% de avance<br />general</div></div>
      <div style={{ height: 1, background: `rgba(${TXR},.1)`, marginBottom: 18 }} />
      <div style={{ fontSize: 10.5, fontWeight: 800, color: `rgba(${TXR},.4)`, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Qué hay que mover</div>
      {alertas.length === 0 && abiertos.length === 0 && <div style={{ fontSize: 12.5, color: T.muted, padding: "6px 0 14px" }}>Nada urgente por ahora.</div>}
      {alertas.slice(0, 5).map(a => { const c = col[a.fase] || BRASS; return (<div key={a.obraId + a.id} onClick={() => setTab("pedidos")} style={{ background: hexToRgba(c, .12), border: `1px solid ${c}`, borderLeft: `4px solid ${c}`, borderRadius: 10, padding: "11px 13px", marginBottom: 8 }}><div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: c }}>{a.fase === "verde" ? "Hay que pedirlo" : a.fase === "amarillo" ? "Pedilo ya" : a.fase === "rojo" ? "Debe estar hoy" : "Retraso"} · {a.obra}</div><div style={{ fontSize: 13.5, fontWeight: 800, margin: "3px 0 2px" }}>{a.desc}</div><div style={{ fontSize: 12, color: T.sub }}>Para la tarea «{a.tarea}»{a.need ? " · necesaria el " + a.need : ""}</div></div>); })}
      {abiertos.length > 0 && <div onClick={() => setTab("pedidos")} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid rgba(${TXR},.07)`, cursor: "pointer", fontSize: 12.5 }}><span><b style={{ color: "#D9B27C" }}>{abiertos.length}</b> {abiertos.length === 1 ? "pedido abierto" : "pedidos abiertos"} con el estudio</span><span style={{ color: `rgba(${TXR},.35)` }}>›</span></div>}
      <div style={{ fontSize: 10.5, fontWeight: 800, color: `rgba(${TXR},.4)`, textTransform: "uppercase", letterSpacing: ".05em", margin: "18px 0 10px" }}>Novedades recientes</div>
      {novedades.length === 0 && <div style={{ fontSize: 12, color: `rgba(${TXR},.4)` }}>Sin novedades todavía.</div>}
      {novedades.map((n, k) => <div key={k} style={{ padding: "11px 0", borderBottom: `1px solid rgba(${TXR},.07)`, fontSize: 12.5 }}>{n.t} <span style={{ color: `rgba(${TXR},.4)`, fontSize: 11 }}>· {fTs(n.ts)}</span></div>)}
    </div>
  </div>);
}
const SUBS = [["fotos", "Fotos"], ["avance", "Avance"], ["bitacora", "Bitácora"], ["informes", "Informes"], ["crono", "Cronograma"], ["archivos", "Archivos"], ["adic", "Adicionales"]];
function CObras({ T, D, cfg }) {
  const [id, setId] = useState(null); const [sub, setSub] = useState("fotos");
  const o = D.obras.find(x => x.id === id);
  if (!o) return wrap(<><Eyebrow T={T}>Obras</Eyebrow>{D.obras.map(x => <Card key={x.id} T={T} onClick={() => { setId(x.id); setSub("fotos"); }} style={{ padding: 15, marginBottom: 10, cursor: "pointer" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 19 }}>{x.nombre}</div><div style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>{x.avance || 0}%</div></div>
    <div style={{ height: 5, background: T.border, borderRadius: 4, margin: "10px 0 8px" }}><div style={{ width: (x.avance || 0) + "%", height: 5, background: T.accent, borderRadius: 4 }} /></div>
    <div style={{ fontSize: 11.5, color: T.sub }}>{arr(x.fotos).length} fotos · {D.bitacora.filter(h => h.obra_id === x.id).length} hechos en bitácora · {arr(x.informes).length + arr(D.informesSem[x.id]).length} informes</div></Card>)}</>);
    return wrap(<>
    <button onClick={() => setId(null)} style={{ background: "none", border: 0, color: T.accent, fontSize: 13, fontWeight: 800, padding: "0 0 10px" }}>← Obras</button>
    <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 24 }}>{o.nombre}</div>
    <div style={{ fontSize: 12, color: T.sub, margin: "3px 0 12px" }}>{o.avance || 0}% de avance{o.sector ? " · " + o.sector : ""}</div>
    {o.obs && <Card T={T} style={{ padding: 12, marginBottom: 12, fontSize: 12.5, color: T.sub, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{o.obs}</Card>}
    <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 10 }}>{SUBS.map(([k, l]) => <Pill key={k} T={T} a={sub === k} onClick={() => setSub(k)}>{l}</Pill>)}</div>
    {sub === "fotos" && <Galeria T={T} items={[...arr(o.fotos), ...arr(o.videos)]} />}
    {sub === "avance" && <div style={{ margin: "0 calc(-1 * clamp(16px,3vw,40px))" }}><AvanceView key={o.id} T={T} obras={[o]} avance={D.avance} setAvance={D.setAvance} apiKey={D.apiKey} cfg={cfg} certif={D.certif} envios={D.envios} setEnvios={D.setEnvios} /></div>}
    {sub === "bitacora" && <div style={{ margin: "0 calc(-1 * clamp(16px,3vw,40px))" }}><BitacoraView key={o.id} T={T} obras={[o]} bitacora={D.bitacora} setBitacora={D.setBitacora} cfg={cfg} /></div>}
    {sub === "informes" && <Informes T={T} D={D} o={o} />}
    {sub === "crono" && <div style={{ margin: "0 calc(-1 * clamp(16px,3vw,40px))" }}><CronoPro key={o.id} T={T} titulo="Cronograma" lado="cliente" modelosObra={D.modelosObra} gestion={D.gestion} obras={[{ id: o.id, nombre: o.nombre, inicio: o.inicio, cierre: o.cierre }]} data={D.cronoPro} setData={D.setCronoPro} /></div>}
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
function CMas({ T, D, recargar, st }) {
  return wrap(<><Eyebrow T={T}>Más</Eyebrow>
    <Card T={T} style={{ padding: "13px 15px", marginBottom: 8 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>Datos de las obras</div><div style={{ fontSize: 12, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>{D.obras.length} obras · {D.bitacora.length} hechos de bitácora · {D.obras.reduce((a, o) => a + arr(o.fotos).length, 0)} fotos. {st === "cache" ? "Mostrando la última copia guardada en este aparato." : "Actualizado recién."} Esta app solo lee: no modifica nada de las otras aplicaciones.</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>Los avances, bitácoras y cambios del cronograma que cargues acá quedan en este aparato (no tocan las otras apps).</div><button onClick={recargar} style={{ marginTop: 10, background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: "10px 16px", fontSize: 12.5, fontWeight: 700 }}>Actualizar ahora</button><button onClick={() => { if (confirm("¿Descartar lo cargado en este aparato y volver a los datos reales?")) D.restaurar(); }} style={{ marginTop: 10, marginLeft: 8, background: "transparent", color: T.sub, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 14px", fontSize: 12.5, fontWeight: 600 }}>Volver a datos reales</button></Card>
    <Card T={T} style={{ padding: "13px 15px" }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>Adicionales</div><div style={{ marginTop: 10 }}><ListaAdic T={T} D={D} /></div></Card></>);
}

// ── PANEL ESTUDIO ──────────────────────────────────────────────────────────
function Estudio({ T, D, tab }) {
  if (tab === "planos") {
    const L = D.pedidos.flatMap(p => arr(p.hilo).filter(h => h.de === "estudio").flatMap(h => arr(h.archivos).map(a => ({ a, p, fecha: h.fecha, ts: h.ts })))).sort((x, y) => (y.ts || 0) - (x.ts || 0));
    return wrap(<><Eyebrow T={T}>Planos y documentos entregados</Eyebrow>{L.length === 0 && <Vacio T={T}>Todavía no hay documentos entregados.</Vacio>}{L.map((x, i) => <Card key={i} T={T} style={{ padding: "11px 13px", marginBottom: 8 }}><div style={{ fontSize: 12, color: T.sub }}>{(D.obras.find(o => o.id === x.p.obra_id) || {}).nombre} · {x.p.asunto} · {fFecha(x.fecha)}</div><Archivo T={T} a={x.a} /></Card>)}</>);
  }
  if (tab === "adicionales") return wrap(<><Eyebrow T={T}>Adicionales de obra</Eyebrow><ListaAdic T={T} D={D} /></>);
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
