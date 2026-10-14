// NEXO Obra — DEMO simplificada: una sola app, tres paneles (Constructora · Estudio · Propietario).
// Datos de ejemplo cargados en el aparato (no toca ninguna base real). Mismo estilo que el resto de la suite.
import React, { useState, useEffect, useMemo } from "react";

// ── estilo (igual a la suite) ───────────────────────────────────────────────
const C = { bg: "#0d0d0f", card: "#111214", card2: "#16171a", border: "#232227", text: "#f2f0eb", sub: "#B8B5AE", muted: "#7A776F", accent: "#B0894F", accentL: "rgba(176,137,79,.14)", verde: "#3E9B62", amarillo: "#E0B13A", naranja: "#E8843B", rojo: "#D8473A" };
const FASE_COL = { verde: C.verde, amarillo: C.amarillo, naranja: C.naranja, rojo: C.rojo, ok: C.verde, futuro: C.muted };
const FASE_TXT = { verde: "Hay que pedirlo", amarillo: "Pedilo ya", naranja: "Urgente", rojo: "Vencido", ok: "Listo", futuro: "Todavía falta" };
const standalone = typeof window !== "undefined" && (window.navigator.standalone || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches));
const SAFE_TOP = `max(env(safe-area-inset-top), ${standalone ? 58 : 14}px)`;

// ── fechas y plata de espera ────────────────────────────────────────────────
const DIA = 86400000;
const hoyISO = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); };
const masDias = (iso, n) => new Date(new Date(iso + "T12:00:00").getTime() + n * DIA).toISOString().slice(0, 10);
const dif = (a, b) => Math.round((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / DIA); // a - b en días
const fmtF = (iso) => iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "—";
const money = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
let _id = 0; const nid = () => "n" + Date.now().toString(36) + (++_id);

// Cuánto antes hay que pedir, por rubro (semanas). Primera estimación, a calibrar con tiempos reales.
const LEAD = { "Aberturas": 8, "Instalaciones embutidas": 6, "Revestimientos y solados": 6, "Fundaciones": 4, "Losas": 4, "Contrapisos y carpetas": 4, "Tareas preliminares": 3, "Mampostería": 3, "Revoques": 3, "Cielorrasos": 3, "Pintura": 2 };

// El color lo pone el calendario; el estado lo pone la persona con un toque.
function semaforo(p, tarea, hoy) {
  if (!tarea) return { fase: "futuro", du: 99, diasRojo: 0 };
  const lead = (LEAD[p.rubro] || 4) * 7, banda = Math.max(3, (lead - 5) / 3);
  const fin = p.estado === "enobra" ? (p.enobraFecha || hoy) : p.estado === "respondido" ? (p.respFecha || hoy) : hoy;
  const duFin = dif(tarea.inicio, fin), du = dif(tarea.inicio, hoy);
  const diasRojo = Math.max(0, Math.floor(5 - duFin));
  if (p.estado === "enobra") return { fase: "ok", du, diasRojo, apagado: true };
  if (p.estado === "respondido") return { fase: "ok", du, diasRojo };
  let fase = "futuro";
  if (du <= 5) fase = "rojo"; else if (du <= 5 + banda) fase = "naranja"; else if (du <= 5 + 2 * banda) fase = "amarillo"; else if (du <= lead) fase = "verde";
  return { fase, du, diasRojo };
}
const costoDia = (obra) => (obra ? obra.personas * obra.jornal : 0);

// ── datos de ejemplo (fechas relativas a hoy, para que el semáforo muestre de todo) ──
function crearDemo() {
  const h = hoyISO(), d = (n) => masDias(h, n);
  const obras = [
    { id: "o1", nombre: "Sáenz Peña 01", modelo: "2 losas", propietario: "Familia Ruiz", avance: 38, personas: 7, jornal: 75000, equipo: ["Capataz · M. Gómez", "Oficial albañil × 3", "Ayudantes × 7", "Encargado de seguridad"], hitos: [["Fundaciones", d(-110), true], ["Losa 1", d(-18), true], ["Mampostería PB", d(6), false], ["Losa 2", d(75), false], ["Entrega", d(190), false]] },
    { id: "o2", nombre: "Los Puentes 132", modelo: "1 losa", propietario: "Sr. Paredes", avance: 62, personas: 5, jornal: 75000, equipo: ["Capataz · R. Díaz", "Oficial albañil × 2", "Ayudantes × 5"], hitos: [["Fundaciones", d(-150), true], ["Losa", d(-60), true], ["Revoques", d(-5), true], ["Cielorrasos", d(14), false], ["Entrega", d(70), false]] },
  ];
  const tareas = [
    { id: "t1", obra: "o1", nombre: "Losa 1", inicio: d(-18), dur: 20 },
    { id: "t2", obra: "o1", nombre: "Mampostería PB", inicio: d(6), dur: 25 },
    { id: "t3", obra: "o1", nombre: "Contrapisos y carpetas", inicio: d(3), dur: 12 },
    { id: "t4", obra: "o1", nombre: "Instalaciones embutidas", inicio: d(25), dur: 18 },
    { id: "t5", obra: "o1", nombre: "Colocación de aberturas", inicio: d(40), dur: 10 },
    { id: "t6", obra: "o1", nombre: "Revoques", inicio: d(60), dur: 30 },
    { id: "t7", obra: "o2", nombre: "Cielorrasos", inicio: d(14), dur: 10 },
    { id: "t8", obra: "o2", nombre: "Pintura", inicio: d(30), dur: 15 },
    { id: "t9", obra: "o2", nombre: "Baños: cuerpos de ducha y grifería", inicio: d(21), dur: 6 },
  ];
  const P = (id, obra, tarea, tipo, rubro, desc, estado, extra = {}) => ({ id, obra, tarea, tipo, rubro, desc, estado, reclamos: 0, ...extra });
  const pedidos = [
    P("p1", "o1", "t3", "Definición", "Contrapisos y carpetas", "Niveles de solado y pendientes", "pedido", { pedidoFecha: d(-12) }),
    P("p2", "o1", "t2", "Plano", "Mampostería", "Plano de mampostería de planta baja", "pedido", { pedidoFecha: d(-3) }),
    P("p3", "o1", "t4", "Plano", "Instalaciones embutidas", "Plano de instalaciones eléctricas y sanitarias", "porpedir"),
    P("p4", "o1", "t5", "Definición", "Aberturas", "Tipología y medidas de aberturas", "porpedir"),
    P("p5", "o1", "t6", "Definición", "Revoques", "Terminación de revoques exteriores", "porpedir"),
    P("p6", "o1", "t1", "Plano", "Losas", "Plano de armaduras de Losa 1", "enobra", { pedidoFecha: d(-70), respFecha: d(-40), enobraFecha: d(-30), respuesta: { texto: "Plano de armaduras vigente, versión 2.", archivos: ["Armaduras_L1_v2.pdf"] } }),
    P("p7", "o2", "t7", "Definición", "Cielorrasos", "Altura y tipo de cielorraso en living", "respondido", { pedidoFecha: d(-10), respFecha: d(-1), nuevo: true, respuesta: { texto: "Cielorraso de placa de yeso, junta tomada. Altura final 2,60 m. Detalle adjunto.", archivos: ["Detalle_cielorraso.pdf", "Planilla_alturas.xlsx"] } }),
    P("p8", "o2", "t8", "Definición", "Pintura", "Colores y sistema de pintura", "porpedir"),
    P("p9", "o2", "t9", "Definición", "Revestimientos y solados", "Cuerpos de ducha y grifería: modelos", "pedido", { pedidoFecha: d(-5) }),
  ];
  const planos = [
    { id: "pl1", obra: "o1", rubro: "Losas", nombre: "Armaduras Losa 1", version: 2, fecha: d(-40), historial: [{ version: 1, fecha: d(-75) }] },
    { id: "pl2", obra: "o1", rubro: "Fundaciones", nombre: "Planta de fundaciones", version: 1, fecha: d(-115), historial: [] },
    { id: "pl3", obra: "o2", rubro: "Losas", nombre: "Estructura losa", version: 3, fecha: d(-62), historial: [{ version: 1, fecha: d(-95) }, { version: 2, fecha: d(-80) }] },
  ];
  const adicionales = [
    { id: "a1", obra: "o1", desc: "Platea adicional en sector cochera", monto: 1850000, estado: "pendiente", req: [{ t: "Cotización cargada", ok: true }, { t: "Plano de detalle del estudio", ok: false }] },
    { id: "a2", obra: "o2", desc: "Muro de contención lateral", monto: 920000, estado: "autorizado", req: [{ t: "Cotización cargada", ok: true }, { t: "Plano de detalle del estudio", ok: true }] },
  ];
  const registro = [
    { id: "r1", obra: "o1", ts: Date.now() - 3 * 3600000, texto: "Se completó el encofrado del sector norte. Faltan 2 camiones de hormigón para mañana." },
    { id: "r2", obra: "o2", ts: Date.now() - 26 * 3600000, texto: "Visita del estudio: se revisó la altura de cielorrasos en el living." },
  ];
  const elecciones = [
    { id: "e1", obra: "o1", titulo: "Color de las aberturas", opciones: ["Negro mate", "Gris antracita"], limite: d(12), elegida: null },
    { id: "e2", obra: "o2", titulo: "Revestimiento del frente", opciones: ["Piedra natural", "Microcemento"], limite: d(20), elegida: null },
  ];
  const fotos = [
    { id: "f1", obra: "o1", fecha: d(-2), cap: "Encofrado sector norte", g: ["#3b3226", "#8a6d3b"] },
    { id: "f2", obra: "o1", fecha: d(-9), cap: "Armado de columnas", g: ["#26313b", "#4f6f8a"] },
    { id: "f3", obra: "o1", fecha: d(-18), cap: "Hormigonado Losa 1", g: ["#2e2e2e", "#7d7d7d"] },
    { id: "f4", obra: "o2", fecha: d(-4), cap: "Revoque grueso terminado", g: ["#3b2a26", "#8a5a4f"] },
    { id: "f5", obra: "o2", fecha: d(-12), cap: "Instalación sanitaria", g: ["#263b32", "#4f8a6d"] },
  ];
  return { v: 1, creado: h, obras, tareas, pedidos, planos, adicionales, registro, elecciones, fotos, liberadas: ["t1"] };
}
const KEY = "nexoobra_demo_v1", KEYP = "nexoobra_perfil";
function cargar() { try { const r = localStorage.getItem(KEY); if (r) { const d = JSON.parse(r); if (d && d.v === 1) return d; } } catch { } return crearDemo(); }

// ── piezas chicas ───────────────────────────────────────────────────────────
const Star = ({ s = 22 }) => (<svg width={s} height={s} viewBox="0 0 40 40" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><path d="M20 3v34M3 20h34M9 9l22 22M31 9L9 31" /><circle cx="20" cy="20" r="2.6" fill={C.accent} /></svg>);
const Eyebrow = ({ children }) => (<div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 10px" }}><span style={{ width: 18, height: 2, background: C.accent }} /><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: C.sub }}>{children}</span></div>);
const Card = ({ children, color, onClick, style }) => (<div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: color ? `4px solid ${color}` : `1px solid ${C.border}`, borderRadius: 12, padding: 13, marginBottom: 10, cursor: onClick ? "pointer" : "default", ...style }}>{children}</div>);
const Btn = ({ children, onClick, color = C.accent, ghost, disabled, small, style }) => (<button disabled={disabled} onClick={onClick} style={{ width: small ? "auto" : "100%", background: disabled ? C.card2 : ghost ? "transparent" : color, color: disabled ? C.muted : ghost ? C.text : "#0d0d0f", border: ghost ? `1px solid ${C.border}` : 0, borderRadius: 10, padding: small ? "8px 12px" : "13px 14px", fontSize: small ? 12 : 14, fontWeight: 800, cursor: disabled ? "default" : "pointer", marginTop: small ? 0 : 10, ...style }}>{children}</button>);
const Chip = ({ children, color = C.sub, bg }) => (<span style={{ display: "inline-block", fontSize: 10.5, fontWeight: 800, color, background: bg || "rgba(255,255,255,.06)", borderRadius: 6, padding: "3px 8px", marginRight: 6 }}>{children}</span>);
const Sel = ({ value, onChange, children }) => (<select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px", fontSize: 16, marginBottom: 8 }}>{children}</select>);
const Archivo = ({ n }) => (<div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", marginTop: 6, fontSize: 13, fontWeight: 700, color: C.accent }}>📎 <span style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>{n}</span><span style={{ whiteSpace: "nowrap" }}>Abrir ↗</span></div>);

// ── App ─────────────────────────────────────────────────────────────────────
export default function NexoObraApp() {
  const [D, setD] = useState(cargar);
  const [perfil, setPerfil] = useState(() => { try { return localStorage.getItem(KEYP) || ""; } catch { return ""; } });
  const [verAlcance, setVerAlcance] = useState(false);
  const [tab, setTab] = useState("");
  const [obraAbierta, setObraAbierta] = useState(null);
  const [toast, setToast] = useState("");
  const hoy = hoyISO();
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch { } }, [D]);
  useEffect(() => { try { perfil ? localStorage.setItem(KEYP, perfil) : localStorage.removeItem(KEYP); } catch { } }, [perfil]);
  const avisar = (t) => { setToast(t); setTimeout(() => setToast(""), 2200); };
  const upd = (k, fn) => setD(prev => ({ ...prev, [k]: fn(prev[k]) }));
  const setPed = (id, patch) => upd("pedidos", ps => ps.map(p => p.id === id ? { ...p, ...(typeof patch === "function" ? patch(p) : patch) } : p));
  const obraDe = (id) => D.obras.find(o => o.id === id);
  const tareaDe = (id) => D.tareas.find(t => t.id === id);
  const sem = (p) => semaforo(p, tareaDe(p.tarea), hoy);
  const entrar = (p) => { setPerfil(p); setVerAlcance(false); setObraAbierta(null); setTab(p === "constructora" ? "inicio" : p === "estudio" ? "pedidos" : "obra"); window.scrollTo && window.scrollTo(0, 0); };
  const ctx = { D, upd, setPed, obraDe, tareaDe, sem, hoy, avisar, tab, setTab, obraAbierta, setObraAbierta, setD };

  const reset = () => { if (confirm("¿Volver a cargar los datos de ejemplo?")) { const n = crearDemo(); setD(n); avisar("Datos de ejemplo restaurados"); } };

  return (<div style={{ background: C.bg, display: "flex", justifyContent: "center" }}><div style={{ height: "100dvh", width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", background: C.bg, color: C.text, fontFamily: "'Inter',-apple-system,sans-serif", borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
    <style>{`body{background:${C.bg}} *{-webkit-tap-highlight-color:transparent} input,textarea,select{font-family:inherit}`}</style>
    {(!perfil || verAlcance) ? <Alcance perfil={perfil} entrar={entrar} volver={() => setVerAlcance(false)} reset={reset} />
      : (<>
        <Header perfil={perfil} onAlcance={() => setVerAlcance(true)} />
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 24px" }}>
          {perfil === "constructora" && <Constructora {...ctx} />}
          {perfil === "estudio" && <Estudio {...ctx} />}
          {perfil === "propietario" && <Propietario {...ctx} />}
        </div>
        <Nav perfil={perfil} tab={tab} setTab={(t) => { setTab(t); setObraAbierta(null); }} />
      </>)}
    {toast && <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", width: "min(608px, calc(100% - 32px))", bottom: 86, zIndex: 50, background: C.accent, color: "#0d0d0f", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, fontWeight: 800, textAlign: "center" }}>{toast}</div>}
  </div></div>);
}

// ── Primer panel: el alcance de la app ──────────────────────────────────────
const PANELES = {
  constructora: { n: "Constructora", ico: "🏗️", d: "Ejecuta y anticipa", pts: ["Semáforo de pedidos y avisos", "Pide definiciones, planos y materiales", "Libera cada etapa sin esperar", "Registro y dotación en obra"] },
  estudio: { n: "Estudio", ico: "📐", d: "Proyecta y dirige la obra", pts: ["Ve lo que le piden, por fecha", "Responde con planos y archivos", "Sube la versión vigente de cada plano", "Autoriza adicionales"] },
  propietario: { n: "Propietario", ico: "🏠", d: "Sigue su obra", pts: ["Avance e hitos", "Fotos e informe semanal", "Elecciones que dependen de él", "Sin alertas ni costos"] },
};
function Alcance({ perfil, entrar, volver, reset }) {
  return (<div style={{ flex: 1, overflowY: "auto", padding: `${SAFE_TOP} 18px 30px` }}>
    <div style={{ textAlign: "center", padding: "10px 0 6px" }}>
      <Star s={46} />
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: ".3em", marginTop: 6 }}>NEXO</div>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Todos conectados · En tiempo real</div>
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, textAlign: "center", margin: "18px 0 4px" }}>La obra que se anticipa no se improvisa</div>
    <div style={{ fontSize: 13, color: C.sub, textAlign: "center", lineHeight: 1.5, marginBottom: 16 }}>Una sola app, tres paneles. Cada invitación abre solo el suyo.</div>
    {!perfil && <div style={{ fontSize: 11.5, color: C.accent, background: C.accentL, borderRadius: 10, padding: "9px 12px", marginBottom: 14, textAlign: "center", fontWeight: 700 }}>DEMO · Tocá un panel para ver la app como lo vería cada persona</div>}
    {Object.entries(PANELES).map(([k, p]) => {
      const mio = perfil === k, bloq = perfil && !mio;
      return (<div key={k} style={{ background: C.card, border: `1px solid ${mio ? C.accent : C.border}`, borderRadius: 14, padding: 15, marginBottom: 11, opacity: bloq ? .55 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>{bloq ? "🔒" : p.ico}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 800, color: mio ? C.accent : C.text }}>{p.n}</div><div style={{ fontSize: 12, color: C.sub }}>{p.d}</div></div>
          {mio && <Chip color={C.accent} bg={C.accentL}>TU PANEL</Chip>}
        </div>
        {!bloq && <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: C.sub, lineHeight: 1.65 }}>{p.pts.map(t => <li key={t}>{t}</li>)}</ul>}
        {bloq && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Bloqueado: este panel lo ve {k === "constructora" ? "la constructora" : k === "estudio" ? "el estudio" : "el propietario"} con su invitación.</div>}
        {!perfil && <Btn onClick={() => entrar(k)}>Entrar como {p.n.toLowerCase()}</Btn>}
      </div>);
    })}
    {perfil && <Btn onClick={volver}>Volver a mi panel</Btn>}
    {perfil && <Btn ghost onClick={() => entrar("")}>Cambiar de perfil (solo en la demo)</Btn>}
    <div style={{ textAlign: "center", marginTop: 18 }}><button onClick={reset} style={{ background: "none", border: 0, color: C.muted, fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>Restaurar datos de ejemplo</button></div>
  </div>);
}

function Header({ perfil, onAlcance }) {
  const p = PANELES[perfil];
  return (<div style={{ flexShrink: 0, padding: `${SAFE_TOP} 18px 10px`, borderBottom: `1px solid ${C.border}`, background: C.card, display: "flex", alignItems: "center", gap: 10 }}>
    <Star s={22} />
    <div style={{ flex: 1 }}><div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".2em", color: C.accent, textTransform: "uppercase" }}>NEXO Obra · demo</div><div style={{ fontSize: 16, fontWeight: 800 }}>Panel {p.n.toLowerCase()}</div></div>
    <button onClick={onAlcance} style={{ background: C.card2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, padding: "8px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Alcance</button>
  </div>);
}

const NAVS = {
  constructora: [["inicio", "Inicio"], ["obras", "Obras"], ["pedidos", "Pedidos"], ["registro", "Registro"], ["mas", "Más"]],
  estudio: [["pedidos", "Pedidos"], ["planos", "Planos"], ["adicionales", "Adicionales"]],
  propietario: [["obra", "Mi obra"], ["fotos", "Fotos"], ["elecciones", "Elecciones"]],
};
function Nav({ perfil, tab, setTab }) {
  return (<nav style={{ flexShrink: 0, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)" }}>
    {NAVS[perfil].map(([id, l]) => { const a = tab === id; return (<button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: "none", border: 0, borderTop: `2px solid ${a ? C.accent : "transparent"}`, padding: "10px 4px 7px", fontSize: 11.5, fontWeight: a ? 800 : 600, color: a ? C.accent : C.sub, cursor: "pointer" }}>{l}</button>); })}
  </nav>);
}

// ── tarjeta de pedido: el color lo pone el calendario, el estado se cambia con UN toque ──
function PedidoCard({ p, x, rol, mostrarObra = true }) {
  const { sem, obraDe, tareaDe, setPed, avisar } = x;
  const s = sem(p), col = FASE_COL[s.fase], o = obraDe(p.obra), t = tareaDe(p.tarea);
  const costo = s.fase === "rojo" ? costoDia(o) : 0;
  const debeEstar = t ? masDias(t.inicio, -5) : "";
  const [abierto, setAbierto] = useState(false);
  return (<Card color={s.apagado ? C.border : col}>
    <div onClick={() => setAbierto(a => !a)} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
        {!s.apagado && <Chip color={col} bg="rgba(255,255,255,.05)">{p.estado === "respondido" ? "Respondido" : FASE_TXT[s.fase]}</Chip>}
        {s.apagado && <Chip color={C.verde}>En obra ✓</Chip>}
        <Chip>{p.tipo}</Chip>
        {p.nuevo && <Chip color="#0d0d0f" bg={C.verde}>NUEVA RESPUESTA</Chip>}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.35 }}>{p.desc}</div>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>{mostrarObra && o ? o.nombre + " · " : ""}Para: {t ? t.nombre : "—"}<br />La tarea arranca el <b style={{ color: C.text }}>{t ? fmtF(t.inicio) : "—"}</b>{p.estado === "pedido" || p.estado === "porpedir" ? <> · debe estar el <b style={{ color: C.text }}>{fmtF(debeEstar)}</b></> : null}</div>
      {rol === "constructora" && costo > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: C.rojo, marginTop: 6 }}>Cada día en rojo cuesta {money(costo)} · ya van {s.diasRojo} {s.diasRojo === 1 ? "día" : "días"} = {money(costo * s.diasRojo)}</div>}
    </div>
    {abierto && p.respuesta && (<div style={{ marginTop: 8, background: C.card2, borderRadius: 8, padding: 10 }}><div style={{ fontSize: 11, fontWeight: 800, color: C.verde }}>Respuesta del estudio · {fmtF(p.respFecha)}</div><div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{p.respuesta.texto}</div>{(p.respuesta.archivos || []).map(a => <Archivo key={a} n={a} />)}</div>)}
    {rol === "constructora" && p.estado === "porpedir" && <Btn color={col} onClick={() => { setPed(p.id, { estado: "pedido", pedidoFecha: x.hoy }); avisar("Pedido enviado al estudio"); }}>Pedir al estudio</Btn>}
    {rol === "constructora" && p.estado === "pedido" && <Btn ghost onClick={() => { setPed(p.id, pp => ({ reclamos: (pp.reclamos || 0) + 1 })); avisar("Reclamo enviado al estudio"); }}>Reclamar{p.reclamos ? " (" + p.reclamos + ")" : ""} · pedido el {fmtF(p.pedidoFecha)}</Btn>}
    {rol === "constructora" && p.estado === "respondido" && <Btn color={C.verde} onClick={() => { setPed(p.id, { estado: "enobra", enobraFecha: x.hoy, nuevo: false }); avisar("Listo: ya está en obra"); }}>Ya está en obra</Btn>}
  </Card>);
}

// ── PANEL CONSTRUCTORA ──────────────────────────────────────────────────────
function Constructora(x) {
  const { D, tab, obraAbierta } = x;
  if (obraAbierta) return <ObraDetalle {...x} />;
  if (tab === "inicio") return <CInicio {...x} />;
  if (tab === "obras") return <CObras {...x} />;
  if (tab === "pedidos") return <CPedidos {...x} />;
  if (tab === "registro") return <CRegistro {...x} />;
  return <CMas {...x} />;
}
function CInicio(x) {
  const { D, sem, setPed, avisar, hoy, obraDe, setTab } = x;
  const act = D.pedidos.filter(p => p.estado !== "enobra");
  const urg = act.filter(p => ["rojo", "naranja", "amarillo"].includes(sem(p).fase) && p.estado !== "respondido").sort((a, b) => ["rojo", "naranja", "amarillo"].indexOf(sem(a).fase) - ["rojo", "naranja", "amarillo"].indexOf(sem(b).fase));
  const resp = D.pedidos.filter(p => p.estado === "respondido");
  const cuenta = (f) => act.filter(p => p.estado !== "respondido" && sem(p).fase === f).length;
  const costoTot = D.pedidos.reduce((a, p) => { const s = sem(p); const o = obraDe(p.obra); return a + s.diasRojo * costoDia(o); }, 0);
  const evitados = D.pedidos.filter(p => (p.estado === "respondido" || p.estado === "enobra") && sem(p).diasRojo === 0).length;
  return (<div>
    <Eyebrow>¿Qué tengo que hacer hoy?</Eyebrow>
    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
      {[["rojo", "Vencidos"], ["naranja", "Urgentes"], ["amarillo", "Pedir ya"]].map(([f, l]) => (<div key={f} style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderTop: `3px solid ${FASE_COL[f]}`, borderRadius: 10, padding: "10px 6px", textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: cuenta(f) ? FASE_COL[f] : C.muted }}>{cuenta(f)}</div><div style={{ fontSize: 10.5, color: C.sub, fontWeight: 700 }}>{l}</div></div>))}
    </div>
    {resp.length > 0 && (<><Eyebrow>Respondió el estudio</Eyebrow>{resp.map(p => <PedidoCard key={p.id} p={p} x={x} rol="constructora" />)}</>)}
    <Eyebrow>Pedidos que hay que mover</Eyebrow>
    {urg.length === 0 && <Card><div style={{ fontSize: 13, color: C.sub }}>Nada urgente. Todo en orden por hoy.</div></Card>}
    {urg.map(p => <PedidoCard key={p.id} p={p} x={x} rol="constructora" />)}
    <Eyebrow>El costo de la espera</Eyebrow>
    <Card><div style={{ fontSize: 26, fontWeight: 800, color: costoTot ? C.rojo : C.verde }}>{money(costoTot)}</div><div style={{ fontSize: 12, color: C.sub, lineHeight: 1.5, marginTop: 3 }}>Días en rojo × personas en obra × jornal, hasta hoy. Se actualiza solo.</div>
      <div style={{ fontSize: 12, color: C.verde, marginTop: 8, fontWeight: 700 }}>{evitados} {evitados === 1 ? "pedido resuelto" : "pedidos resueltos"} antes del rojo: espera evitada.</div></Card>
  </div>);
}
function CObras(x) {
  const { D, sem, setObraAbierta } = x;
  return (<div><Eyebrow>¿Cómo está cada obra?</Eyebrow>
    {D.obras.map(o => { const ps = D.pedidos.filter(p => p.obra === o.id); const c = (f) => ps.filter(p => p.estado !== "respondido" && sem(p).fase === f).length; return (<Card key={o.id} onClick={() => setObraAbierta(o.id)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><div style={{ fontSize: 17, fontWeight: 800 }}>{o.nombre}</div><div style={{ fontSize: 12, color: C.sub }}>{o.modelo}</div></div>
      <div style={{ height: 6, background: C.card2, borderRadius: 4, margin: "10px 0 6px" }}><div style={{ width: o.avance + "%", height: 6, background: C.accent, borderRadius: 4 }} /></div>
      <div style={{ fontSize: 12, color: C.sub }}>{o.avance}% de avance · {o.personas} personas en obra</div>
      <div style={{ marginTop: 8 }}>{["rojo", "naranja", "amarillo"].map(f => c(f) > 0 && <Chip key={f} color={FASE_COL[f]}>{c(f)} {f === "rojo" ? "vencido" : f === "naranja" ? "urgente" : "pedir ya"}</Chip>)}{!["rojo", "naranja", "amarillo"].some(f => c(f) > 0) && <Chip color={C.verde}>Sin pedidos en riesgo</Chip>}</div>
    </Card>); })}
  </div>);
}
const SUBS = [["crono", "Cronograma"], ["pedidos", "Pedidos"], ["planos", "Planos"], ["adic", "Adicionales"], ["lib", "Liberación"], ["equipo", "Equipo"]];
function ObraDetalle(x) {
  const { D, obraAbierta, setObraAbierta, sem, obraDe, upd, avisar, hoy } = x;
  const o = obraDe(obraAbierta); const [sub, setSub] = useState("crono");
  const tareas = D.tareas.filter(t => t.obra === o.id), ps = D.pedidos.filter(p => p.obra === o.id);
  return (<div>
    <button onClick={() => setObraAbierta(null)} style={{ background: "none", border: 0, color: C.accent, fontSize: 13, fontWeight: 800, padding: "10px 0", cursor: "pointer" }}>← Obras</button>
    <div style={{ fontSize: 20, fontWeight: 800 }}>{o.nombre}</div>
    <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>{o.modelo} · {o.avance}% de avance</div>
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>{SUBS.map(([k, l]) => (<button key={k} onClick={() => setSub(k)} style={{ flexShrink: 0, background: sub === k ? C.accent : C.card, color: sub === k ? "#0d0d0f" : C.sub, border: `1px solid ${sub === k ? C.accent : C.border}`, borderRadius: 18, padding: "8px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>{l}</button>))}</div>
    {sub === "crono" && (<div style={{ marginTop: 10 }}>{tareas.sort((a, b) => a.inicio.localeCompare(b.inicio)).map(t => { const pp = ps.filter(p => p.tarea === t.id); const peor = pp.map(p => sem(p)).filter(s => ["rojo", "naranja", "amarillo", "verde"].includes(s.fase)).sort((a, b) => ["rojo", "naranja", "amarillo", "verde"].indexOf(a.fase) - ["rojo", "naranja", "amarillo", "verde"].indexOf(b.fase))[0]; const en = dif(t.inicio, hoy);
      return (<Card key={t.id} color={peor ? FASE_COL[peor.fase] : C.border}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div style={{ fontSize: 14, fontWeight: 800 }}>{t.nombre}</div><div style={{ fontSize: 11.5, color: C.sub, whiteSpace: "nowrap" }}>{fmtF(t.inicio)} → {fmtF(masDias(t.inicio, t.dur))}</div></div><div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{en > 0 ? `Arranca en ${en} días` : en > -t.dur ? "En ejecución" : "Terminada"} · {pp.length} {pp.length === 1 ? "pedido" : "pedidos"}</div></Card>); })}</div>)}
    {sub === "pedidos" && (<div style={{ marginTop: 10 }}>{tareas.sort((a, b) => a.inicio.localeCompare(b.inicio)).map(t => { const pp = ps.filter(p => p.tarea === t.id); if (!pp.length) return null; return (<div key={t.id}><div style={{ fontSize: 12, fontWeight: 800, color: C.sub, margin: "12px 0 6px", textTransform: "uppercase", letterSpacing: ".06em" }}>{t.nombre}</div>{pp.map(p => <PedidoCard key={p.id} p={p} x={x} rol="constructora" mostrarObra={false} />)}</div>); })}</div>)}
    {sub === "planos" && <PlanosLista x={x} obra={o.id} editable={false} />}
    {sub === "adic" && <AdicLista x={x} obra={o.id} rol="constructora" />}
    {sub === "lib" && (<div style={{ marginTop: 10 }}><div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.5, marginBottom: 10 }}>La etapa se libera sola cuando todo lo que necesita está respondido y en obra. La cuadrilla arranca sin esperar.</div>{tareas.sort((a, b) => a.inicio.localeCompare(b.inicio)).map(t => { const pp = ps.filter(p => p.tarea === t.id); const falta = pp.filter(p => p.estado !== "enobra"); const lib = D.liberadas.includes(t.id); const ok = falta.length === 0; return (<Card key={t.id} color={lib ? C.verde : ok ? C.accent : C.border}><div style={{ fontSize: 14, fontWeight: 800 }}>{t.nombre}</div>
      {lib && <div style={{ fontSize: 12.5, color: C.verde, marginTop: 4, fontWeight: 700 }}>✓ Etapa liberada</div>}
      {!lib && ok && <Btn color={C.verde} onClick={() => { upd("liberadas", l => [...l, t.id]); avisar("Etapa liberada: la cuadrilla puede arrancar"); }}>Liberar etapa</Btn>}
      {!lib && !ok && <div style={{ fontSize: 12, color: C.sub, marginTop: 5, lineHeight: 1.55 }}>Falta: {falta.map(p => p.desc).join(" · ")}</div>}</Card>); })}</div>)}
    {sub === "equipo" && (<div style={{ marginTop: 10 }}>
      <Card><div style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>Personas hoy en obra</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}><button onClick={() => upd("obras", os => os.map(q => q.id === o.id ? { ...q, personas: Math.max(0, q.personas - 1) } : q))} style={{ width: 44, height: 44, borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontSize: 22, cursor: "pointer" }}>−</button><div style={{ fontSize: 30, fontWeight: 800, minWidth: 40, textAlign: "center" }}>{o.personas}</div><button onClick={() => upd("obras", os => os.map(q => q.id === o.id ? { ...q, personas: q.personas + 1 } : q))} style={{ width: 44, height: 44, borderRadius: 10, background: C.card2, border: `1px solid ${C.border}`, color: C.text, fontSize: 22, cursor: "pointer" }}>+</button></div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>Jornal: {money(o.jornal)} · cada día parado cuesta {money(costoDia(o))}</div></Card>
      <Eyebrow>Equipo de obra</Eyebrow>{o.equipo.map(e => <Card key={e}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{e}</div></Card>)}</div>)}
  </div>);
}
function CPedidos(x) {
  const { D, sem, setD, hoy, avisar } = x;
  const [f, setF] = useState("todos"); const [nuevo, setNuevo] = useState(false);
  const [o, setO] = useState(D.obras[0].id), [r, setR] = useState("Losas"), [ti, setTi] = useState("Plano"), [tk, setTk] = useState("");
  const tareas = D.tareas.filter(t => t.obra === o);
  const lista = D.pedidos.filter(p => f === "todos" ? true : f === "respondido" ? p.estado === "respondido" : (p.estado !== "respondido" && p.estado !== "enobra" && sem(p).fase === f)).sort((a, b) => sem(a).du - sem(b).du);
  function crear() { const t = tk || (tareas[0] && tareas[0].id); if (!t) return; const p = { id: nid(), obra: o, tarea: t, tipo: ti, rubro: r, desc: (ti === "Plano" ? "Plano de " : ti === "Material" ? "Materiales de " : "Definición de ") + r.toLowerCase(), estado: "pedido", pedidoFecha: hoy, reclamos: 0 }; setD(prev => ({ ...prev, pedidos: [p, ...prev.pedidos] })); setNuevo(false); avisar("Pedido enviado al estudio"); }
  return (<div><Eyebrow>¿Qué falta y quién lo debe?</Eyebrow>
    <Btn onClick={() => setNuevo(n => !n)} style={{ marginTop: 0 }}>{nuevo ? "Cerrar" : "＋ Nuevo pedido"}</Btn>
    {nuevo && (<Card style={{ marginTop: 10 }}><Sel value={o} onChange={v => { setO(v); setTk(""); }}>{D.obras.map(q => <option key={q.id} value={q.id}>{q.nombre}</option>)}</Sel><Sel value={tk || (tareas[0] && tareas[0].id)} onChange={setTk}>{tareas.map(t => <option key={t.id} value={t.id}>Para: {t.nombre}</option>)}</Sel><Sel value={r} onChange={setR}>{Object.keys(LEAD).map(k => <option key={k}>{k}</option>)}</Sel><Sel value={ti} onChange={setTi}><option>Plano</option><option>Definición</option><option>Material</option></Sel><div style={{ fontSize: 11.5, color: C.sub, marginBottom: 4 }}>Se pide con {LEAD[r]} semanas de anticipación.</div><Btn onClick={crear}>Pedir al estudio</Btn></Card>)}
    <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "12px 0 4px" }}>{[["todos", "Todos"], ["rojo", "Vencidos"], ["naranja", "Urgentes"], ["amarillo", "Pedir ya"], ["verde", "A tiempo"], ["respondido", "Respondidos"]].map(([k, l]) => (<button key={k} onClick={() => setF(k)} style={{ flexShrink: 0, background: f === k ? C.accent : C.card, color: f === k ? "#0d0d0f" : C.sub, border: `1px solid ${f === k ? C.accent : C.border}`, borderRadius: 16, padding: "7px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{l}</button>))}</div>
    <div style={{ marginTop: 8 }}>{lista.map(p => <PedidoCard key={p.id} p={p} x={x} rol="constructora" />)}{lista.length === 0 && <Card><div style={{ fontSize: 13, color: C.sub }}>No hay pedidos en esta vista.</div></Card>}</div>
  </div>);
}
function CRegistro(x) {
  const { D, upd, obraDe, avisar } = x; const [t, setT] = useState(""); const [o, setO] = useState(D.obras[0].id);
  return (<div><Eyebrow>¿Qué pasó hoy en obra?</Eyebrow>
    <Card><Sel value={o} onChange={setO}>{D.obras.map(q => <option key={q.id} value={q.id}>{q.nombre}</option>)}</Sel><textarea value={t} onChange={e => setT(e.target.value)} rows={3} placeholder="Escribí lo que pasó hoy…" style={{ width: "100%", background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 16, resize: "none" }} /><Btn disabled={!t.trim()} onClick={() => { upd("registro", r => [{ id: nid(), obra: o, ts: Date.now(), texto: t.trim() }, ...r]); setT(""); avisar("Guardado en el registro"); }}>Guardar</Btn></Card>
    {D.registro.slice().sort((a, b) => b.ts - a.ts).map(r => (<Card key={r.id}><div style={{ fontSize: 11.5, color: C.sub, fontWeight: 700 }}>{(obraDe(r.obra) || {}).nombre} · {new Date(r.ts).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div><div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>{r.texto}</div></Card>))}
  </div>);
}
function CMas(x) {
  const { D, obraDe } = x; const [ver, setVer] = useState("");
  const item = (k, l, d) => (<Card key={k} onClick={() => setVer(ver === k ? "" : k)}><div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontSize: 14, fontWeight: 800 }}>{l}</div><div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{d}</div></div><span style={{ color: C.muted }}>{ver === k ? "▾" : "›"}</span></div>
    {ver === k && k === "modelos" && (<div style={{ marginTop: 10 }}>{Object.entries(LEAD).sort((a, b) => b[1] - a[1]).map(([r, w]) => (<div key={r} style={{ display: "flex", alignItems: "center", gap: 8, margin: "5px 0", fontSize: 12.5 }}><span style={{ flex: "0 0 150px", color: C.sub }}>{r}</span><span style={{ flex: 1, height: 8, background: C.card2, borderRadius: 4 }}><span style={{ display: "block", width: w * 12 + "%", height: 8, background: C.accent, borderRadius: 4 }} /></span><b style={{ width: 52, textAlign: "right" }}>{w} sem</b></div>))}<div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Primera estimación para el modelo de 2 losas, a calibrar con los tiempos reales que registre la app.</div></div>)}
    {ver === k && k === "informe" && (<div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: C.sub }}>{D.obras.map(o => <div key={o.id} style={{ marginBottom: 8 }}><b style={{ color: C.text }}>{o.nombre}:</b> {o.avance}% de avance. Hito siguiente: {(o.hitos.find(h => !h[2]) || [])[0] || "—"}.</div>)}<div style={{ fontSize: 11, color: C.muted }}>Es el mismo informe que recibe el propietario: sin alertas, costos ni notas internas.</div></div>)}
    {ver === k && k === "plantillas" && <div style={{ marginTop: 10, fontSize: 12.5, color: C.sub, lineHeight: 1.6 }}>Pedido de definición · Pedido de plano · Pedido de materiales · Acta de liberación de etapa. Una plantilla por tipo, con los campos mínimos.</div>}
    {ver === k && k === "config" && <div style={{ marginTop: 10, fontSize: 12.5, color: C.sub, lineHeight: 1.6 }}>Jornal por obra, anticipación por rubro, invitaciones por panel y responsables. En la demo se cargan fijos.</div>}
  </Card>);
  return (<div><Eyebrow>Más</Eyebrow>{item("modelos", "Modelos y biblioteca de pedidos", "Cuánto antes se pide cada rubro")}{item("plantillas", "Plantillas", "Formatos listos para pedir y liberar")}{item("informe", "Informe semanal", "Lo que ve el propietario")}{item("config", "Configuración", "Invitaciones, jornales y plazos")}</div>);
}

// ── Planos y adicionales (compartidos) ──────────────────────────────────────
function PlanosLista({ x, obra, editable }) {
  const { D, upd, avisar, obraDe, hoy } = x;
  const pl = D.planos.filter(p => !obra || p.obra === obra);
  return (<div style={{ marginTop: obra ? 10 : 0 }}>{!obra && <Eyebrow>Versión vigente por rubro</Eyebrow>}
    {pl.map(p => (<Card key={p.id}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><div style={{ fontSize: 14, fontWeight: 800 }}>{p.nombre}</div><div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{(obraDe(p.obra) || {}).nombre} · {p.rubro}</div></div><Chip color={C.verde}>v{p.version} vigente</Chip></div>
      <Archivo n={`${p.nombre.replace(/\s+/g, "_")}_v${p.version}.pdf`} />
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Vigente desde el {fmtF(p.fecha)}{p.historial.length ? ` · reemplaza a v${p.historial[p.historial.length - 1].version}` : ""}</div>
      {editable && <Btn ghost onClick={() => { upd("planos", ps => ps.map(q => q.id === p.id ? { ...q, version: q.version + 1, fecha: hoy, historial: [...q.historial, { version: q.version, fecha: q.fecha }] } : q)); avisar(`Subiste la v${p.version + 1}: la anterior queda como reemplazada`); }}>Subir nueva versión</Btn>}</Card>))}
    {pl.length === 0 && <Card><div style={{ fontSize: 13, color: C.sub }}>Todavía no hay planos cargados.</div></Card>}
  </div>);
}
function AdicLista({ x, obra, rol }) {
  const { D, upd, avisar, obraDe } = x;
  const L = D.adicionales.filter(a => !obra || a.obra === obra);
  const set = (id, patch) => upd("adicionales", as => as.map(a => a.id === id ? { ...a, ...patch } : a));
  return (<div style={{ marginTop: obra ? 10 : 0 }}>{!obra && <Eyebrow>Adicionales para autorizar</Eyebrow>}
    {L.map(a => { const ok = a.req.every(r => r.ok); const col = a.estado === "autorizado" ? C.verde : a.estado === "rechazado" ? C.rojo : C.amarillo;
      return (<Card key={a.id} color={col}><div style={{ fontSize: 14, fontWeight: 800 }}>{a.desc}</div><div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{(obraDe(a.obra) || {}).nombre}{rol === "constructora" ? " · " + money(a.monto) : ""}</div>
        <div style={{ marginTop: 8 }}>{a.req.map(r => <div key={r.t} style={{ fontSize: 12.5, color: r.ok ? C.verde : C.naranja, margin: "3px 0" }}>{r.ok ? "✓" : "○"} {r.t}</div>)}</div>
        <div style={{ marginTop: 6 }}><Chip color={col}>{a.estado === "autorizado" ? "Autorizado" : a.estado === "rechazado" ? "Rechazado" : "Pendiente de autorización"}</Chip>{a.estado === "autorizado" && !ok && <Chip color={C.naranja}>Bloqueado hasta cumplir</Chip>}</div>
        {rol === "estudio" && a.estado === "pendiente" && (<div style={{ display: "flex", gap: 8 }}><Btn color={C.verde} onClick={() => { set(a.id, { estado: "autorizado" }); avisar("Adicional autorizado"); }}>Autorizar</Btn><Btn ghost onClick={() => { set(a.id, { estado: "rechazado" }); avisar("Adicional rechazado"); }}>Rechazar</Btn></div>)}
        {rol === "constructora" && a.estado === "pendiente" && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Esperando que el estudio lo autorice.</div>}
      </Card>); })}
    {L.length === 0 && <Card><div style={{ fontSize: 13, color: C.sub }}>No hay adicionales.</div></Card>}
  </div>);
}

// ── PANEL ESTUDIO ───────────────────────────────────────────────────────────
function Estudio(x) {
  const { tab, D } = x;
  if (tab === "planos") return <PlanosLista x={x} editable />;
  if (tab === "adicionales") return <AdicLista x={x} rol="estudio" />;
  return <EPedidos {...x} />;
}
function EPedidos(x) {
  const { D, sem, setPed, upd, obraDe, tareaDe, hoy, avisar } = x;
  const [ver, setVer] = useState("pend"); const [abierto, setAbierto] = useState(null); const [txt, setTxt] = useState(""); const [arch, setArch] = useState([]);
  const mios = D.pedidos.filter(p => p.tipo !== "Material" && (p.estado === "pedido" || p.estado === "respondido" || p.estado === "enobra"));
  const pend = mios.filter(p => p.estado === "pedido").sort((a, b) => sem(a).du - sem(b).du);
  const hechos = mios.filter(p => p.estado !== "pedido").sort((a, b) => (b.respFecha || "").localeCompare(a.respFecha || ""));
  function responder(p) {
    const archivos = arch.length ? arch : [p.tipo === "Plano" ? `Plano_${p.rubro.replace(/\s+/g, "_")}_v1.pdf` : `Definicion_${p.rubro.replace(/\s+/g, "_")}.pdf`];
    setPed(p.id, { estado: "respondido", respFecha: hoy, nuevo: true, respuesta: { texto: txt.trim() || "Respuesta con documentación adjunta.", archivos } });
    if (p.tipo === "Plano") upd("planos", ps => { const ex = ps.find(q => q.obra === p.obra && q.rubro === p.rubro); if (ex) return ps.map(q => q === ex ? { ...q, version: q.version + 1, fecha: hoy, historial: [...q.historial, { version: q.version, fecha: q.fecha }] } : q); return [...ps, { id: nid(), obra: p.obra, rubro: p.rubro, nombre: p.desc.replace(/^Plano de /, "Plano "), version: 1, fecha: hoy, historial: [] }]; });
    setAbierto(null); setTxt(""); setArch([]); avisar("Respuesta enviada a la constructora");
  }
  const lista = ver === "pend" ? pend : hechos;
  return (<div><Eyebrow>Lo que te piden, por fecha</Eyebrow>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>{[["pend", `Para responder · ${pend.length}`], ["hechos", `Respondidos · ${hechos.length}`]].map(([k, l]) => (<button key={k} onClick={() => setVer(k)} style={{ flex: 1, background: ver === k ? C.accent : C.card, color: ver === k ? "#0d0d0f" : C.sub, border: `1px solid ${ver === k ? C.accent : C.border}`, borderRadius: 10, padding: "10px 6px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>{l}</button>))}</div>
    {lista.map(p => { const s = sem(p), t = tareaDe(p.tarea), col = p.estado === "pedido" ? FASE_COL[s.fase] : C.verde; const debe = t ? masDias(t.inicio, -5) : ""; const dd = debe ? dif(debe, hoy) : 0;
      return (<Card key={p.id} color={col}><div onClick={() => setAbierto(abierto === p.id ? null : p.id)} style={{ cursor: "pointer" }}>
        <div style={{ marginBottom: 5 }}><Chip>{p.tipo}</Chip>{p.estado === "pedido" && <Chip color={dd < 0 ? C.rojo : dd <= 7 ? C.naranja : C.verde}>{dd < 0 ? `Vencido hace ${-dd} d` : dd === 0 ? "Vence hoy" : (dd === 1 ? "Falta 1 día" : `Faltan ${dd} días`)}</Chip>}{p.estado !== "pedido" && <Chip color={C.verde}>Respondido {fmtF(p.respFecha)}</Chip>}</div>
        <div style={{ fontSize: 14.5, fontWeight: 800 }}>{p.desc}</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>{(obraDe(p.obra) || {}).nombre} · para {t ? t.nombre : "—"}<br />Lo necesita antes del {fmtF(debe)} · pedido el {fmtF(p.pedidoFecha)}</div></div>
        {p.estado !== "pedido" && p.respuesta && abierto === p.id && <div style={{ marginTop: 8, background: C.card2, borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.5 }}>{p.respuesta.texto}{p.respuesta.archivos.map(a => <Archivo key={a} n={a} />)}</div>}
        {p.estado === "pedido" && abierto === p.id && (<div style={{ marginTop: 10 }}><textarea value={txt} onChange={e => setTxt(e.target.value)} rows={3} placeholder="Escribí la respuesta (opcional)…" style={{ width: "100%", background: C.card2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 16, resize: "none" }} />
          {arch.map(a => <Archivo key={a} n={a} />)}
          <Btn ghost onClick={() => setArch(a => [...a, `${p.tipo === "Plano" ? "Plano" : "Documento"}_${p.rubro.replace(/\s+/g, "_")}_${a.length + 1}.${a.length % 2 ? "dwg" : "pdf"}`])}>＋ Adjuntar archivo (PDF, CAD, Excel…)</Btn>
          <Btn color={C.verde} onClick={() => responder(p)}>Responder y enviar</Btn></div>)}
        {p.estado === "pedido" && abierto !== p.id && <Btn onClick={() => setAbierto(p.id)}>Responder</Btn>}
      </Card>); })}
    {lista.length === 0 && <Card><div style={{ fontSize: 13, color: C.sub }}>{ver === "pend" ? "No tenés pedidos para responder. Todo al día." : "Todavía no respondiste ninguno."}</div></Card>}
  </div>);
}

// ── PANEL PROPIETARIO (sin alertas, sin costos, sin nada interno) ───────────
function Propietario(x) {
  const { D, tab, upd, avisar, obraDe, hoy } = x;
  const [oid, setOid] = useState(D.obras[0].id); const o = obraDe(oid);
  const Selector = () => (<div style={{ display: "flex", gap: 6, margin: "6px 0 4px", overflowX: "auto" }}>{D.obras.map(q => (<button key={q.id} onClick={() => setOid(q.id)} style={{ flexShrink: 0, background: oid === q.id ? C.accent : C.card, color: oid === q.id ? "#0d0d0f" : C.sub, border: `1px solid ${oid === q.id ? C.accent : C.border}`, borderRadius: 16, padding: "8px 13px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>{q.nombre}</button>))}</div>);
  if (tab === "fotos") return (<div><Eyebrow>Fotos de tu obra</Eyebrow><Selector />{D.fotos.filter(f => f.obra === oid).sort((a, b) => b.fecha.localeCompare(a.fecha)).map(f => (<div key={f.id} style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}><div style={{ height: 150, background: `linear-gradient(135deg,${f.g[0]},${f.g[1]})`, display: "flex", alignItems: "flex-end", padding: 12 }}><span style={{ fontSize: 24 }}>📷</span></div><div style={{ background: C.card, padding: "10px 12px" }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{f.cap}</div><div style={{ fontSize: 11.5, color: C.sub }}>{fmtF(f.fecha)}</div></div></div>))}</div>);
  if (tab === "elecciones") return (<div><Eyebrow>Elecciones que dependen de vos</Eyebrow><Selector />{D.elecciones.filter(e => e.obra === oid).map(e => (<Card key={e.id} color={e.elegida ? C.verde : C.accent} style={{ marginTop: 10 }}><div style={{ fontSize: 14.5, fontWeight: 800 }}>{e.titulo}</div><div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>Necesitamos tu elección antes del {fmtF(e.limite)}</div>
    {e.elegida ? <div style={{ fontSize: 13, color: C.verde, fontWeight: 800, marginTop: 8 }}>✓ Elegiste: {e.elegida}</div> : <div style={{ display: "flex", gap: 8 }}>{e.opciones.map(op => <Btn key={op} ghost onClick={() => { upd("elecciones", es => es.map(q => q.id === e.id ? { ...q, elegida: op } : q)); avisar("Gracias, avisamos a la obra"); }}>{op}</Btn>)}</div>}</Card>))}</div>);
  return (<div><Eyebrow>Tu obra</Eyebrow><Selector />
    <Card style={{ marginTop: 10 }}><div style={{ fontSize: 13, color: C.sub }}>{o.nombre} · {o.propietario}</div><div style={{ fontSize: 44, fontWeight: 800, color: C.accent, lineHeight: 1.1, marginTop: 4 }}>{o.avance}%</div><div style={{ fontSize: 12, color: C.sub }}>de avance</div><div style={{ height: 8, background: C.card2, borderRadius: 4, marginTop: 10 }}><div style={{ width: o.avance + "%", height: 8, background: C.accent, borderRadius: 4 }} /></div></Card>
    <Eyebrow>Hitos</Eyebrow>
    {o.hitos.map(([n, f, hecho], i) => (<div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}><div style={{ width: 22, height: 22, borderRadius: "50%", background: hecho ? C.verde : "transparent", border: `2px solid ${hecho ? C.verde : C.muted}`, color: "#0d0d0f", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{hecho ? "✓" : ""}</div><div><div style={{ fontSize: 14, fontWeight: 700, color: hecho ? C.text : C.sub }}>{n}</div><div style={{ fontSize: 11.5, color: C.muted }}>{hecho ? "Completado" : "Previsto"} · {fmtF(f)}</div></div></div>))}
    <Eyebrow>Informe de la semana</Eyebrow>
    <Card><div style={{ fontSize: 13, lineHeight: 1.6, color: C.sub }}>Esta semana la obra avanzó según lo previsto. Próximo hito: <b style={{ color: C.text }}>{(o.hitos.find(h => !h[2]) || [])[0] || "—"}</b>. Mirá las fotos nuevas en la solapa Fotos.</div></Card>
  </div>);
}
