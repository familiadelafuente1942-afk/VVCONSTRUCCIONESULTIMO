import React, { useState, useEffect, useRef, useMemo } from "react";

/* ═══ CRONOGRAMA PRO ═══
   Cronograma de obra con ruta crítica, calendario día por día y pedidos atados a tareas.
   Se usa igual en la app de V+V y en la página del cliente (mismo archivo, mismos datos).
   Datos: data = { obras: { [obraId]: plan }, modelos?: [...] }  — se guardan con la clave "vv_cronopro".
   plan = { inicio:"AAAA-MM-DD", costo, plan:bool, dias:[L..D 1/0], excep:{ "AAAA-MM-DD": 1|0 }, tareas:[{id,name,dur,preds:[ids]}], pedidos:[{id,tipo,desc,task,lead,quien,resp}] }
   Props: T (tema), obras [{id,nombre,inicio?}], data, setData, gated (bool: pedir código para editar), Gate (componente de código). */

const CRIT = "#E5604A", OK = "#3E9B62", WARN = "#E0A04A", BAR = "#6E86A8", GHOST = "#8A8680";
const BASE = Date.UTC(2024, 0, 1) / 864e5, NDAYS = 2600;
const DIAS0 = [1, 1, 1, 1, 1, 0, 0];
const nid = () => Math.random().toString(36).slice(2, 9);
const isoOf = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const dnOf = (s) => { const p = String(s || "").split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; };
const dowOf = (n) => (new Date(n * 864e5).getUTCDay() + 6) % 7;
const hoyISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const fmtN = (n, wk) => new Date(n * 864e5).toLocaleDateString("es-AR", wk ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).replace(/\./g, "");
const money = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");
// "dd/mm/aa" (como guarda la app) → "AAAA-MM-DD"
const isoDeCorta = (s) => { const m = String(s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (!m) return ""; const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return y + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0"); };

// ── Calendario: todos los días del calendario cuentan; los que no se trabajan no suman duración ──
function mkCal(dias, excep) {
  let dd = dias || DIAS0; if (!dd.some(Boolean)) dd = DIAS0;
  const ex = excep || {}, WD = [], isW = {};
  for (let d = 0; d < NDAYS; d++) { const n = BASE + d, e = ex[isoOf(n)], w = e != null ? !!e : !!dd[dowOf(n)]; if (w) { WD.push(n); isW[n] = 1; } }
  return { WD, isW };
}
const wdIdx = (cal, iso) => { const n = dnOf(iso); let lo = 0, hi = cal.WD.length; while (lo < hi) { const m = (lo + hi) >> 1; if (cal.WD[m] < n) lo = m + 1; else hi = m; } return lo; };
const D = (cal, i) => cal.WD[Math.min(Math.max(i, 0), cal.WD.length - 1)];

function ordenar(tareas) {
  const byId = {}; tareas.forEach(t => { byId[t.id] = t; });
  const done = {}, vis = {}, ord = [], pm = {}; let cyc = false;
  const visit = (t) => {
    if (done[t.id]) return; if (vis[t.id]) { cyc = true; return; }
    vis[t.id] = 1; pm[t.id] = [];
    (t.preds || []).forEach(p => { const q = byId[p]; if (!q || q.id === t.id) return; visit(q); if (done[q.id]) pm[t.id].push(p); else cyc = true; });
    vis[t.id] = 0; done[t.id] = 1; ord.push(t);
  };
  tareas.forEach(visit);
  return { ord, pm, cyc };
}
function programar(o, cons, start) {
  const ES = {}, EF = {};
  o.ord.forEach(t => { let s = start; o.pm[t.id].forEach(p => { if (EF[p] != null) s = Math.max(s, EF[p]); }); if (cons[t.id] != null) s = Math.max(s, cons[t.id]); ES[t.id] = s; EF[t.id] = s + t.dur; });
  let end = start; o.ord.forEach(t => { end = Math.max(end, EF[t.id]); });
  const LF = {};
  for (let i = o.ord.length - 1; i >= 0; i--) { const t = o.ord[i]; let lf = end; o.ord.forEach(u => { if (o.pm[u.id].indexOf(t.id) >= 0) lf = Math.min(lf, LF[u.id] - u.dur); }); LF[t.id] = lf; }
  return { ES, EF, LF, end };
}
function calcular(P, hoy) {
  const cal = mkCal(P.dias, P.excep), o = ordenar(P.tareas), start = wdIdx(cal, P.inicio), hoyI = wdIdx(cal, hoy);
  const base = programar(o, {}, start), info = {}, cons = {};
  (P.pedidos || []).forEach(p => {
    if (base.ES[p.task] == null) return;
    const need = base.ES[p.task], emitir = need - (+p.lead || 0); let c = null, st, txt;
    if (p.resp) { const r = wdIdx(cal, p.resp), late = r - need; c = r; if (late > 0) { st = "late"; txt = "Llega " + late + (late === 1 ? " día" : " días") + " tarde"; } else { st = "ok"; txt = "En fecha"; } }
    else if (hoyI > need) { st = "late"; txt = "Atrasado"; c = hoyI; }
    else if (hoyI >= emitir) { st = "warn"; txt = "Emitir ya"; }
    else { st = "ok"; txt = "En fecha"; }
    let single = 0; if (c != null) { const q = {}; q[p.task] = c; single = programar(o, q, start).end - base.end; }
    info[p.id] = { need, emitir, c, st, txt, single };
    if (c != null) cons[p.task] = Math.max(cons[p.task] || 0, c);
  });
  const cur = programar(o, cons, start);
  return { cal, o, start, hoyI, base, cur, info, delta: cur.end - base.end };
}

// ── Modelos de obra (cronogramas tipo): tareas con dependencias + pedidos habituales ──
function modeloDesde(id, nombre, tareas, pedidos) {
  const ids = tareas.map((_, i) => id + "t" + (i + 1));
  return { id, nombre, tareas: tareas.map((x, i) => ({ id: ids[i], name: x[0], dur: x[1], preds: x[2].map(n => ids[n - 1]).filter(Boolean) })),
    pedidos: (pedidos || []).map((p, i) => ({ id: id + "p" + (i + 1), tipo: p[0], desc: p[1], task: ids[p[2] - 1], lead: p[3], quien: p[4], resp: "" })).filter(p => p.task) };
}
const MODELOS_BASE = [
  modeloDesde("m_a", "Obra gris y pisos (ejemplo completo)",
    [["Replanteo y nivelación", 3, []], ["Excavación y submuración", 8, [1]], ["Fundaciones", 7, [2]], ["Columnas y vigas PB", 6, [3]], ["Losa PB", 5, [4]], ["Mampostería PB", 9, [5]], ["Columnas y vigas PA", 6, [5]], ["Losa PA", 5, [7]], ["Mampostería PA", 9, [8]], ["Contrapisos", 6, [6, 9]], ["Instalación de pisos", 10, [10]]],
    [["Definición", "Plano de armaduras de losa PB", 5, 5, "Estudio"], ["Materiales", "Hierro de 12 y 8 mm, 14 toneladas", 4, 4, "Constructora"], ["Materiales", "Ladrillo hueco 18, 9.000 unidades", 6, 6, "Contratista"], ["Definición", "Nivel de contrapiso en cocheras", 10, 5, "Estudio"], ["Materiales", "Porcelanato 60x60, 180 m²", 11, 15, "Propietario"]]),
  modeloDesde("m_b", "Vivienda con subsuelo",
    [["Replanteo y nivelación", 3, []], ["Excavación de subsuelo", 10, [1]], ["Submuración y muros de subsuelo", 12, [2]], ["Losa de subsuelo", 6, [3]], ["Columnas y vigas PB", 6, [4]], ["Losa PB", 5, [5]], ["Mampostería PB", 10, [6]], ["Columnas y vigas PA", 6, [6]], ["Losa PA", 5, [8]], ["Mampostería PA", 10, [9]], ["Contrapisos", 7, [7, 10]], ["Instalación de pisos", 12, [11]]], []),
  modeloDesde("m_c", "Ampliación chica", [["Demolición y limpieza", 3, []], ["Fundaciones", 5, [1]], ["Muros", 8, [2]], ["Losa", 4, [3]], ["Contrapiso", 3, [4]], ["Pisos", 5, [5]]], []),
  modeloDesde("m_d", "En blanco", [["Primera tarea", 5, []]], []),
];
// Copia con ids nuevos (para aplicar un modelo a una obra sin pisar el modelo)
function clonar(m) {
  const map = {}; m.tareas.forEach(t => { map[t.id] = nid(); });
  return { tareas: m.tareas.map(t => ({ id: map[t.id], name: t.name, dur: t.dur, preds: (t.preds || []).map(p => map[p]).filter(Boolean) })),
    pedidos: (m.pedidos || []).filter(p => map[p.task]).map(p => ({ id: nid(), tipo: p.tipo, desc: p.desc, task: map[p.task], lead: p.lead, quien: p.quien, resp: "" })) };
}
const planNuevo = (inicio, m) => ({ inicio: inicio || hoyISO(), costo: 450000, plan: true, dias: DIAS0.slice(), excep: {}, ...(m ? clonar(m) : { tareas: [], pedidos: [] }) });

function Inp({ value, onCommit, type = "text", T, style, ...rest }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  const base = { width: "100%", minWidth: 0, boxSizing: "border-box", background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px", minHeight: 40, fontSize: 13, fontFamily: type === "text" ? "inherit" : "ui-monospace,monospace" };
  if (type === "date") return <input type="date" value={v} onChange={e => { setV(e.target.value); onCommit(e.target.value); }} style={{ ...base, ...style }} {...rest} />;
  return <input type={type} value={v} onChange={e => setV(e.target.value)} onBlur={() => { if (String(v) !== String(value ?? "")) onCommit(v); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} style={{ ...base, ...style }} {...rest} />;
}
const Lbl = ({ T, children }) => <div style={{ fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{children}</div>;
const Pill = ({ k, children }) => {
  const c = { ok: [OK, "rgba(62,155,98,.18)"], warn: [WARN, "rgba(224,160,74,.18)"], late: [CRIT, "rgba(229,96,74,.16)"], crit: [CRIT, "rgba(229,96,74,.16)"], hol: ["#9a968f", "rgba(128,128,128,.16)"], cur: ["#fff", "#B0894F"] }[k] || ["#9a968f", "rgba(128,128,128,.16)"];
  return <span style={{ display: "inline-block", fontSize: 11, fontWeight: 800, borderRadius: 99, padding: "3px 9px", whiteSpace: "nowrap", color: c[0], background: c[1] }}>{children}</span>;
};

export default function CronoPro({ T, obras = [], data, setData, gated = false, Gate = null, titulo = "Cronograma" }) {
  const lista = (obras || []).filter(o => o && o.id);
  const [obraId, setObraId] = useState(lista[0]?.id || "");
  const [tab, setTab] = useState("crono");
  const [unlocked, setUnlocked] = useState(false);
  const [gate, setGate] = useState(null);
  const [editing, setEditing] = useState(null);   // id del modelo que se está editando
  const [draft, setDraft] = useState(null);
  const [toast, setToast] = useState(null);
  const [gw, setGw] = useState(0);
  const gref = useRef(null), toastT = useRef(null);
  const can = !gated || unlocked;
  const guard = (fn) => { if (can) fn(); else setGate({ fn }); };
  const hoy = hoyISO();

  useEffect(() => { if (!obraId && lista[0]) setObraId(lista[0].id); }, [lista.length]);
  const obra = lista.find(o => o.id === obraId) || null;
  const modelos = (data && data.modelos) || MODELOS_BASE;
  const setModelos = (f) => setData(prev => { const p = prev || {}; const cur = p.modelos || MODELOS_BASE; return { ...p, modelos: typeof f === "function" ? f(cur) : f }; });
  const planObra = (data && data.obras && data.obras[obraId]) || null;
  const W = editing ? draft : planObra;
  const setW = (f) => {
    if (editing) setDraft(d => f(d));
    else setData(prev => { const p = prev || {}; const os = p.obras || {}; return { ...p, obras: { ...os, [obraId]: f(os[obraId]) } }; });
  };
  const aviso = (msg, undo) => { setToast({ msg, undo }); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 7000); };
  const M = useMemo(() => (W && W.tareas && W.tareas.length ? calcular(W, hoy) : null), [W, hoy]);

  useEffect(() => {
    const f = () => setGw(gref.current ? gref.current.clientWidth : 0);
    f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f);
  }, [tab, obraId, !!M]);

  const fmt = (i) => M ? fmtN(D(M.cal, i)) : "";
  const fmtW = (i) => M ? fmtN(D(M.cal, i), 1) : "";
  const critOf = (id) => (M.cur.LF[id] - M.cur.EF[id]) === 0 || (M.base.LF[id] - M.base.EF[id]) === 0;
  const rowNum = (id) => { const i = W.tareas.findIndex(t => t.id === id); return i + 1; };

  // ── tema ──
  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, minWidth: 0 };
  const hint = { fontSize: 12, color: T.muted, lineHeight: 1.55 };
  const eyebrow = { fontSize: 10.5, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em" };
  const btn = (pri) => ({ font: "inherit", fontSize: 12, fontWeight: 700, background: pri ? T.accent : T.bg, color: pri ? "#fff" : T.text, border: `1px solid ${pri ? T.accent : T.border}`, borderRadius: 10, padding: "8px 12px", minHeight: 36, cursor: "pointer", whiteSpace: "nowrap" });
  const ibtn = { font: "inherit", fontSize: 14, lineHeight: 1, width: 34, height: 34, border: `1px solid ${T.border}`, background: T.bg, color: T.sub, borderRadius: 8, cursor: "pointer", padding: 0, flex: "none" };
  const itemBorder = (c) => ({ background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${c}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 });

  // ── acciones ──
  const crearDesde = (m) => guard(() => {
    const ini = isoDeCorta(obra && obra.inicio) || hoy;
    setData(prev => { const p = prev || {}; const os = p.obras || {}; const ant = os[obraId]; return { ...p, obras: { ...os, [obraId]: { ...planNuevo(ant ? ant.inicio : ini, m), ...(ant ? { costo: ant.costo, plan: ant.plan, dias: ant.dias, excep: ant.excep } : {}) } } }; });
    setTab("crono"); aviso("Modelo «" + m.nombre + "» cargado en la obra.");
  });
  const toggleDia = (iso) => guard(() => {
    const n = dnOf(iso), def = (W.dias || DIAS0)[dowOf(n)] ? 1 : 0, ex = W.excep || {}, cur = ex[iso] != null ? ex[iso] : def, nv = 1 - cur;
    setW(p => { const e = { ...(p.excep || {}) }; if (nv === def) delete e[iso]; else e[iso] = nv; return { ...p, excep: e }; });
    aviso(fmtN(n, 1) + (nv ? ": se trabaja." : ": no se trabaja."));
  });
  const setT = (id, patch) => guard(() => setW(p => ({ ...p, tareas: p.tareas.map(t => t.id === id ? { ...t, ...patch } : t) })));
  const setP = (id, patch) => guard(() => setW(p => ({ ...p, pedidos: p.pedidos.map(x => x.id === id ? { ...x, ...patch } : x) })));
  const addT = () => guard(() => setW(p => { const last = p.tareas[p.tareas.length - 1]; return { ...p, tareas: [...p.tareas, { id: nid(), name: "Nueva tarea", dur: 5, preds: last ? [last.id] : [] }] }; }));
  const addP = () => guard(() => setW(p => p.tareas.length ? { ...p, pedidos: [...p.pedidos, { id: nid(), tipo: "Materiales", desc: "Nuevo pedido", task: p.tareas[0].id, lead: 5, quien: "", resp: "" }] } : p));
  const delT = (id) => guard(() => {
    if (W.tareas.length <= 1) { aviso("La obra necesita al menos una tarea."); return; }
    const prev = W, n0 = W.pedidos.length;
    setW(p => ({ ...p, tareas: p.tareas.filter(t => t.id !== id).map(t => ({ ...t, preds: (t.preds || []).filter(x => x !== id) })), pedidos: p.pedidos.filter(x => x.task !== id) }));
    aviso("Tarea eliminada" + (n0 > W.pedidos.filter(x => x.task !== id).length ? " junto con sus pedidos." : "."), () => setW(() => prev));
  });
  const delP = (id) => guard(() => { const prev = W; setW(p => ({ ...p, pedidos: p.pedidos.filter(x => x.id !== id) })); aviso("Pedido eliminado.", () => setW(() => prev)); });
  const mover = (id, dir) => guard(() => setW(p => { const a = p.tareas.slice(), i = a.findIndex(t => t.id === id), j = i + dir; if (j < 0 || j >= a.length) return p; [a[i], a[j]] = [a[j], a[i]]; return { ...p, tareas: a }; }));
  const setPreds = (t, txt) => {
    const nums = (String(txt).match(/\d+/g) || []).map(Number), ids = [];
    nums.forEach(n => { const q = W.tareas[n - 1]; if (q && q.id !== t.id && ids.indexOf(q.id) < 0) ids.push(q.id); });
    setT(t.id, { preds: ids });
  };
  const editarModelo = (m) => guard(() => { setDraft({ ...planNuevo(hoy), tareas: m.tareas.map(t => ({ ...t, preds: (t.preds || []).slice() })), pedidos: (m.pedidos || []).map(p => ({ ...p })) }); setEditing(m.id); setTab("tareas"); });
  const guardarModelo = () => { const d = draft; setModelos(ms => ms.map(m => m.id === editing ? { ...m, tareas: d.tareas, pedidos: d.pedidos.map(p => ({ ...p, resp: "" })) } : m)); setEditing(null); setDraft(null); setTab("modelos"); aviso("Modelo guardado."); };
  const cancelarModelo = () => { setEditing(null); setDraft(null); setTab("modelos"); };
  const nuevoModelo = () => guard(() => { const id = nid(); const m = { id, nombre: "Modelo nuevo", tareas: [{ id: nid(), name: "Primera tarea", dur: 5, preds: [] }], pedidos: [] }; setModelos(ms => [...ms, m]); setDraft({ ...planNuevo(hoy), tareas: m.tareas, pedidos: [] }); setEditing(id); setTab("tareas"); });
  const guardarComoModelo = () => guard(() => { if (!planObra) { aviso("Esta obra todavía no tiene cronograma."); return; } const m = { id: nid(), nombre: "Modelo de " + (obra ? obra.nombre : "obra"), tareas: planObra.tareas, pedidos: planObra.pedidos.map(p => ({ ...p, resp: "" })) }; setModelos(ms => [...ms, m]); aviso("Guardado como «" + m.nombre + "». Podés cambiarle el nombre en la lista."); });
  const dupModelo = (m) => guard(() => { const c = clonar(m); setModelos(ms => [...ms, { id: nid(), nombre: m.nombre + " (copia)", ...c }]); aviso("Modelo duplicado."); });
  const delModelo = (m) => guard(() => { const prev = modelos; setModelos(ms => ms.filter(x => x.id !== m.id)); aviso("Modelo eliminado.", () => setModelos(prev)); });

  const pedirTab = (k) => { if (k === "crono" || can) { setTab(k); return; } setGate({ fn: () => setTab(k) }); };
  const TABS = [["crono", "Cronograma"], ["tareas", "Tareas"], ["pedidos", "Pedidos"], ["modelos", "Modelos"]];
  const bloq = (k) => gated && !unlocked && k !== "crono";

  // ── Gantt ──
  const gantt = () => {
    const cal = M.cal, labW = 112, H = 46, dh = dnOf(hoy), isoEx = W.excep || {};
    const min = Math.min(D(cal, M.start), dh), max = Math.max(Math.max(D(cal, M.cur.end - 1), D(cal, M.base.end - 1)) + 8, dh + 4);
    const n = max - min, px = Math.max(15, Math.min(24, Math.floor(((gw || 360) - labW - 2) / n))), Wd = n * px;
    const x = (d) => (d - min) * px;
    const head = [], shade = [];
    for (let d = min; d < max; d++) {
      const off = !cal.isW[d], iso = isoOf(d);
      if (dowOf(d) === 0) head.push(<div key={"w" + d} style={{ position: "absolute", top: 0, left: x(d), borderLeft: `1px solid ${T.border}`, fontFamily: "ui-monospace,monospace", fontSize: 10, color: T.muted, padding: "3px 0 0 3px", height: 24 }}>{fmtN(d)}</div>);
      head.push(<div key={"d" + d} onClick={() => toggleDia(iso)} title={fmtN(d, 1) + (off ? " · no se trabaja" : "") + " · tocá para cambiar"} style={{ position: "absolute", top: 24, left: x(d), width: px, height: 19, textAlign: "center", fontFamily: "ui-monospace,monospace", fontSize: 9, lineHeight: "19px", color: off ? GHOST : T.sub, background: off ? "rgba(128,128,128,.16)" : "transparent", boxShadow: isoEx[iso] != null ? `inset 0 -2px 0 ${T.accent}` : "none", cursor: "pointer", userSelect: "none" }}>{new Date(d * 864e5).getUTCDate()}</div>);
      if (off) shade.push(<div key={"s" + d} style={{ position: "absolute", top: 0, bottom: 0, left: labW + x(d), width: px, background: "rgba(128,128,128,.10)", pointerEvents: "none" }} />);
    }
    const rowOf = {}; W.tareas.forEach((t, k) => { rowOf[t.id] = k; });
    const links = [];
    W.tareas.forEach(t => { (M.o.pm[t.id] || []).forEach(p => {
      const x1 = x(D(cal, M.cur.EF[p] - 1) + 1), y1 = rowOf[p] * H + H / 2, x2 = x(D(cal, M.cur.ES[t.id])), y2 = rowOf[t.id] * H + H / 2, xm = Math.max(x1 + 7, x2 - 7), c = critOf(p) && critOf(t.id);
      links.push(<path key={p + t.id} d={`M${x1} ${y1} H${xm} V${y2} H${x2}`} fill="none" stroke={c ? CRIT : GHOST} strokeWidth={c ? 1.6 : 1} opacity={c ? 0.9 : 0.6} markerEnd="url(#arCP)" />);
    }); });
    const rows = W.tareas.map(t => {
      const es = M.cur.ES[t.id], ef = M.cur.EF[t.id], bes = M.base.ES[t.id], bef = M.base.EF[t.id];
      const fl = M.cur.LF[t.id] - ef, c = critOf(t.id), slip = es - bes, xs = x(D(cal, es)), xe = x(D(cal, ef - 1) + 1);
      const marks = []; let k = 0;
      (W.pedidos || []).forEach(p => { if (p.task !== t.id || !M.info[p.id]) return; const inf = M.info[p.id]; marks.push(<div key={p.id} title={p.desc + " · debe estar respondido el " + fmtW(inf.need)} style={{ position: "absolute", top: 2, left: x(D(cal, inf.need)) + px / 2 - 5 + k * 7, width: 10, height: 10, transform: "rotate(45deg)", background: inf.st === "ok" ? OK : inf.st === "warn" ? WARN : CRIT, border: `1px solid ${T.card}` }} />); k++; });
      return (<div key={t.id} style={{ display: "flex", height: H, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ position: "sticky", left: 0, zIndex: 3, flex: `0 0 ${labW}px`, width: labW, background: T.card, padding: "0 8px", display: "flex", alignItems: "center", borderRight: `1px solid ${T.border}`, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, color: T.text }}>{t.name}<div style={{ fontFamily: "ui-monospace,monospace", fontSize: 10, fontWeight: 400, color: c ? CRIT : T.muted }}>{c ? "Crítica" : "Holgura " + fl + " d"}</div></div>
        </div>
        <div style={{ position: "relative", flex: "0 0 auto", width: Wd, height: "100%" }}>
          {W.plan !== false && <div style={{ position: "absolute", top: 35, height: 0, borderTop: `3px solid ${GHOST}`, borderRadius: 2, left: x(D(cal, bes)), width: x(D(cal, bef - 1) + 1) - x(D(cal, bes)) }} />}
          {!c && fl > 0 && <div title={"Holgura: " + fl + " días de trabajo"} style={{ position: "absolute", top: 21, height: 0, borderTop: `2px dotted ${BAR}`, opacity: 0.8, left: xe, width: x(D(cal, M.cur.LF[t.id] - 1) + 1) - xe }} />}
          <div title={t.name + ": " + fmtW(es) + " a " + fmtW(ef - 1)} style={{ position: "absolute", top: 11, height: 20, borderRadius: 4, background: c ? CRIT : BAR, display: "flex", alignItems: "center", paddingLeft: 5, fontFamily: "ui-monospace,monospace", fontSize: 10.5, color: "#fff", whiteSpace: "nowrap", left: xs, width: xe - xs }}>{t.dur} d{slip > 0 && <span style={{ position: "absolute", left: "calc(100% + 5px)", color: CRIT, fontWeight: 500 }}>+{slip} d</span>}</div>
          {marks}
        </div>
      </div>);
    });
    return (<div style={{ position: "relative", width: "max-content", minWidth: "100%" }}>
      <div style={{ display: "flex", height: 44, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ position: "sticky", left: 0, zIndex: 3, flex: `0 0 ${labW}px`, width: labW, background: T.card, padding: "0 8px", display: "flex", alignItems: "center", borderRight: `1px solid ${T.border}`, fontSize: 10, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: T.muted }}>Tarea</div>
        <div style={{ position: "relative", flex: "0 0 auto", width: Wd, height: "100%" }}>{head}</div>
      </div>
      <div style={{ position: "relative" }}>
        {shade}
        <svg width={Wd} height={W.tareas.length * H} style={{ position: "absolute", top: 0, left: labW, pointerEvents: "none", overflow: "visible" }}><defs><marker id="arCP" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill={GHOST} /></marker></defs>{links}</svg>
        {rows}
        {dh >= min && dh <= max && <div style={{ position: "absolute", top: 0, bottom: 0, left: labW, width: Wd, pointerEvents: "none" }}><div style={{ position: "absolute", top: 0, bottom: 0, left: x(dh) + px / 2, borderLeft: `2px dashed ${T.accent}`, zIndex: 1 }} /><div style={{ position: "absolute", top: 2, left: x(dh) + px / 2 + 4, fontSize: 9.5, fontWeight: 800, color: T.accent, letterSpacing: ".06em" }}>HOY</div></div>}
      </div>
    </div>);
  };

  // ── pantallas ──
  const vacio = (<div style={{ ...card, textAlign: "center", padding: "26px 16px" }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Esta obra todavía no tiene cronograma</div>
    <div style={{ ...hint, margin: "6px 0 14px" }}>Elegí un modelo para empezar. Después podés cambiar todas las tareas, duraciones y pedidos.</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {modelos.map(m => <button key={m.id} style={btn(false)} onClick={() => crearDesde(m)}>{!can ? "🔒 " : ""}{m.nombre}</button>)}
    </div>
  </div>);

  const kpi = (lab, val, sub, tone) => (<div style={{ ...card, display: "flex", flexDirection: "column", gap: 3, padding: "11px 12px" }}>
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: T.muted }}>{lab}</div>
    <div style={{ fontSize: 21, fontWeight: 800, color: tone === "bad" ? CRIT : tone === "good" ? OK : T.text, fontVariantNumeric: "tabular-nums" }}>{val}</div>
    <div style={{ fontSize: 11, color: T.muted }}>{sub}</div></div>);

  const pantallaCrono = () => {
    if (!W || !M) return vacio;
    const d = M.delta, c = +W.costo || 0, ds = W.dias || DIAS0, ex = W.excep || {};
    return (<>
      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, color: T.text }}>Cuánto te cuesta cada pedido que llega tarde</div>
      <div style={hint}>Cada pedido está atado a la tarea que lo necesita. Si llega después de que esa tarea arranca, la tarea se corre, y si está en la ruta crítica corre el final de la obra.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {kpi("Fin planificado", fmt(M.base.end - 1), "Sin ningún atraso")}
        {kpi("Fin proyectado", fmt(M.cur.end - 1), "Con los pedidos de hoy", d > 0 ? "bad" : "")}
        {kpi("Atraso de la obra", d + (d === 1 ? " día" : " días"), "días de trabajo", d > 0 ? "bad" : "good")}
        {kpi("Costo del atraso", money(d * c), d + " × " + money(c), d > 0 ? "bad" : "good")}
      </div>
      <div style={card}>
        <div style={{ ...eyebrow, marginBottom: 10 }}>Cronograma</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", fontSize: 11, color: T.muted, marginBottom: 10 }}>
          <span><i style={{ display: "inline-block", width: 18, height: 9, borderRadius: 2, background: CRIT, marginRight: 5 }} />Ruta crítica</span>
          <span><i style={{ display: "inline-block", width: 18, height: 9, borderRadius: 2, background: BAR, marginRight: 5 }} />Con holgura</span>
          <span><i style={{ display: "inline-block", width: 18, borderTop: `3px solid ${GHOST}`, marginRight: 5, verticalAlign: "middle" }} />Plan original</span>
          <span><i style={{ display: "inline-block", width: 8, height: 8, transform: "rotate(45deg)", background: OK, marginRight: 6 }} />Pedido debe estar respondido</span>
        </div>
        <div ref={gref} style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 8, background: T.bg }}>{gantt()}</div>
        <div style={{ ...hint, marginTop: 8 }}>Cada columna es un día del calendario. Los días grises no se trabajan. Tocá el número de un día para marcarlo como no laborable (feriado, lluvia) o como trabajado (sábado). Deslizá para ver todo.</div>
      </div>
      <div style={card}>
        <div style={{ ...eyebrow, marginBottom: 10 }}>Datos de la obra</div>
        {!can ? <button style={btn(false)} onClick={() => guard(() => { })}>🔒 Editar con código</button> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><Lbl T={T}>Inicio de obra</Lbl><Inp T={T} type="date" value={W.inicio} onCommit={v => v && setW(p => ({ ...p, inicio: v }))} /></div>
              <div><Lbl T={T}>Costo de un día parado ($)</Lbl><Inp T={T} type="number" min="0" step="10000" value={W.costo} onCommit={v => setW(p => ({ ...p, costo: Math.max(0, +v || 0) }))} /></div>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: T.sub }}><input type="checkbox" checked={W.plan !== false} onChange={e => setW(p => ({ ...p, plan: e.target.checked }))} /> Mostrar plan original en el cronograma</label>
            <div><Lbl T={T}>Días que se trabajan por semana</Lbl>
              <div style={{ display: "flex", gap: 6 }}>{["L", "M", "X", "J", "V", "S", "D"].map((l, i) => <button key={i} type="button" onClick={() => { if (ds[i] && ds.filter(Boolean).length === 1) { aviso("Tiene que haber al menos un día de trabajo."); return; } setW(p => { const a = (p.dias || DIAS0).slice(); a[i] = a[i] ? 0 : 1; return { ...p, dias: a }; }); }} style={{ flex: 1, font: "inherit", fontSize: 12, fontWeight: 800, minHeight: 38, borderRadius: 8, border: `1px solid ${ds[i] ? T.accent : T.border}`, background: ds[i] ? T.accent : T.bg, color: ds[i] ? "#fff" : T.muted, cursor: "pointer", padding: 0 }}>{l}</button>)}</div></div>
            <div><Lbl T={T}>Días puntuales (feriados, sábados trabajados)</Lbl>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.keys(ex).sort().map(k => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 99, padding: "4px 6px 4px 10px", fontSize: 11.5, color: T.sub }}>{fmtN(dnOf(k), 1)} · {ex[k] ? "se trabaja" : "no se trabaja"}<button type="button" aria-label="Quitar" onClick={() => setW(p => { const e = { ...(p.excep || {}) }; delete e[k]; return { ...p, excep: e }; })} style={{ border: 0, background: "none", color: T.muted, cursor: "pointer", padding: "0 4px", fontSize: 13 }}>✕</button></span>)}
                {!Object.keys(ex).length && <span style={hint}>Ninguno cargado.</span>}
              </div>
              <ExcepAdd T={T} btn={btn} onAdd={(v, t) => { setW(p => { const e = { ...(p.excep || {}) }, def = (p.dias || DIAS0)[dowOf(dnOf(v))] ? 1 : 0; if (t === def) delete e[v]; else e[v] = t; return { ...p, excep: e }; }); }} aviso={aviso} />
            </div>
          </div>)}
      </div>
    </>);
  };

  const pantallaTareas = () => {
    if (!W) return <div style={{ ...card, ...hint, textAlign: "center", padding: 24 }}>Primero creá el cronograma de la obra en la solapa Cronograma.</div>;
    return (<>
      <div><div style={eyebrow}>Tareas de la obra</div><div style={{ ...hint, marginTop: 4 }}>En "Empieza después de" escribí los números de las tareas que tienen que terminar antes, por ejemplo 3, 5. Vacío significa que arranca con la obra.</div>{M && M.o.cyc && <div style={{ ...hint, color: CRIT, fontWeight: 700, marginTop: 4 }}>Hay una dependencia circular: se ignoró la que cierra el círculo.</div>}</div>
      {W.tareas.map((t, i) => { const cr = M && critOf(t.id), fl = M ? M.cur.LF[t.id] - M.cur.EF[t.id] : 0;
        return (<div key={t.id} style={itemBorder(cr ? CRIT : BAR)}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
            <span style={{ flex: "none", width: 26, height: 26, borderRadius: "50%", background: T.bg, color: T.sub, fontFamily: "ui-monospace,monospace", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
            <Inp T={T} value={t.name} onCommit={v => setT(t.id, { name: v || "Sin nombre" })} style={{ fontWeight: 700 }} />
            <button style={{ ...ibtn, opacity: i === 0 ? 0.35 : 1 }} disabled={i === 0} onClick={() => mover(t.id, -1)} aria-label="Subir">↑</button>
            <button style={{ ...ibtn, opacity: i === W.tareas.length - 1 ? 0.35 : 1 }} disabled={i === W.tareas.length - 1} onClick={() => mover(t.id, 1)} aria-label="Bajar">↓</button>
            <button style={{ ...ibtn, color: CRIT }} onClick={() => delT(t.id)} aria-label="Eliminar tarea">✕</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><Lbl T={T}>Duración (días de trabajo)</Lbl><Inp T={T} type="number" min="1" step="1" value={t.dur} onCommit={v => setT(t.id, { dur: Math.max(1, Math.round(+v) || 1) })} /></div>
            <div><Lbl T={T}>Empieza después de (N°)</Lbl><Inp T={T} inputMode="numeric" placeholder="ej. 3, 5" value={(t.preds || []).map(rowNum).filter(Boolean).join(", ")} onCommit={v => setPreds(t, v)} /></div>
          </div>
          {M && <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, fontSize: 12, color: T.sub }}><span><b style={{ fontFamily: "ui-monospace,monospace", fontWeight: 500, color: T.text }}>{fmtW(M.cur.ES[t.id])}</b> → <b style={{ fontFamily: "ui-monospace,monospace", fontWeight: 500, color: T.text }}>{fmtW(M.cur.EF[t.id] - 1)}</b></span>{cr ? <Pill k="crit">Crítica</Pill> : <Pill k="hol">Holgura {fl} d</Pill>}</div>}
        </div>); })}
      <button style={{ ...btn(true), minHeight: 44 }} onClick={addT}>+ Agregar tarea</button>
    </>);
  };

  const pantallaPedidos = () => {
    if (!W) return <div style={{ ...card, ...hint, textAlign: "center", padding: 24 }}>Primero creá el cronograma de la obra en la solapa Cronograma.</div>;
    const c = +W.costo || 0;
    return (<>
      <div><div style={eyebrow}>Pedidos atados a una tarea</div><div style={{ ...hint, marginTop: 4 }}>Cambiá la fecha de respuesta de un pedido y mirá cómo se mueve la obra en la solapa Cronograma. Cualquier día del calendario sirve.</div></div>
      {!W.pedidos.length && <div style={{ ...card, ...hint, textAlign: "center", padding: 24 }}>Todavía no hay pedidos. Agregá el primero con el botón de abajo.</div>}
      {W.pedidos.map(p => { const inf = M && M.info[p.id];
        const eff = !inf ? "" : inf.single > 0 ? "Corre el fin " + inf.single + (inf.single === 1 ? " día" : " días") + " · " + money(inf.single * c) : (inf.c != null && inf.c > inf.need) ? "Lo absorbe la holgura de la tarea" : "Sin efecto en la obra";
        return (<div key={p.id} style={itemBorder(!inf ? BAR : inf.st === "ok" ? OK : inf.st === "warn" ? WARN : CRIT)}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
            <select value={p.tipo} onChange={e => setP(p.id, { tipo: e.target.value })} style={{ width: 130, flex: "none", background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 8px", minHeight: 40, fontSize: 13 }}>{["Materiales", "Definición", "Plano"].map(x => <option key={x}>{x}</option>)}</select>
            <Inp T={T} value={p.desc} onCommit={v => setP(p.id, { desc: v })} style={{ fontWeight: 700 }} />
            <button style={{ ...ibtn, color: CRIT }} onClick={() => delP(p.id)} aria-label="Eliminar pedido">✕</button>
          </div>
          <div><Lbl T={T}>Tarea que lo necesita</Lbl><select value={p.task} onChange={e => setP(p.id, { task: e.target.value })} style={{ width: "100%", background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 8px", minHeight: 40, fontSize: 13 }}>{W.tareas.map((t, i) => <option key={t.id} value={t.id}>{i + 1}. {t.name}</option>)}</select></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><Lbl T={T}>Responsable</Lbl><Inp T={T} value={p.quien} onCommit={v => setP(p.id, { quien: v })} /></div>
            <div><Lbl T={T}>Anticipación (días)</Lbl><Inp T={T} type="number" min="0" step="1" value={p.lead} onCommit={v => setP(p.id, { lead: Math.max(0, Math.round(+v) || 0) })} /></div>
          </div>
          <div><Lbl T={T}>Respuesta real o comprometida</Lbl><Inp T={T} type="date" value={p.resp || ""} onCommit={v => setP(p.id, { resp: v })} /></div>
          {inf && <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>Emitir antes del <b style={{ fontFamily: "ui-monospace,monospace", fontWeight: 500, color: T.text }}>{fmtW(inf.emitir)}</b> · debe estar el <b style={{ fontFamily: "ui-monospace,monospace", fontWeight: 500, color: T.text }}>{fmtW(inf.need)}</b></div>}
          {inf && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}><Pill k={inf.st}>{inf.txt}</Pill><span style={{ fontSize: 12, color: T.muted }}>{eff}</span></div>}
        </div>); })}
      <button style={{ ...btn(true), minHeight: 44 }} onClick={addP}>+ Agregar pedido</button>
    </>);
  };

  const pantallaModelos = () => (<>
    <div><div style={eyebrow}>Modelos de obra</div><div style={{ ...hint, marginTop: 4 }}>Un modelo es un cronograma tipo: tareas, duraciones, dependencias y pedidos habituales. No todas las obras son iguales, así que armá uno por cada tipo.</div></div>
    {modelos.map(m => (<div key={m.id} style={{ ...itemBorder(BAR) }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Inp T={T} value={m.nombre} onCommit={v => guard(() => setModelos(ms => ms.map(x => x.id === m.id ? { ...x, nombre: v || "Modelo sin nombre" } : x)))} style={{ fontWeight: 700 }} />{editing === m.id && <Pill k="cur">Editando</Pill>}</div>
      <div style={{ fontSize: 12, color: T.sub }}>{m.tareas.length} tareas · {(m.pedidos || []).length} pedidos tipo</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button style={btn(true)} disabled={!!editing || !obraId} onClick={() => crearDesde(m)}>Usar en esta obra</button>
        <button style={btn(false)} disabled={!!editing} onClick={() => editarModelo(m)}>Editar</button>
        <button style={btn(false)} disabled={!!editing} onClick={() => dupModelo(m)}>Duplicar</button>
        <button style={{ ...ibtn, color: CRIT, width: "auto", padding: "0 12px" }} disabled={!!editing} onClick={() => delModelo(m)} aria-label="Eliminar modelo">✕</button>
      </div>
    </div>))}
    <button style={{ ...btn(true), minHeight: 44 }} disabled={!!editing} onClick={nuevoModelo}>+ Nuevo modelo en blanco</button>
    <button style={{ ...btn(false), minHeight: 44 }} disabled={!!editing} onClick={guardarComoModelo}>Guardar esta obra como modelo</button>
  </>);

  const edM = editing ? modelos.find(m => m.id === editing) : null;
  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: T.bg, color: T.text }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: T.card }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{edM ? "Modelo · " + edM.nombre : titulo + (obra ? " · " + obra.nombre : "")}</div>
        <div style={{ fontSize: 11, color: T.muted }}>{M ? fmt(M.start) + " → " + fmt(M.cur.end - 1) + " · " + (M.cur.end - M.start) + " días de trabajo" : "Sin cronograma cargado"}</div>
      </div>
      {lista.length > 1 && !editing && <select value={obraId} onChange={e => setObraId(e.target.value)} aria-label="Obra" style={{ maxWidth: 150, background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 8px", minHeight: 36, fontSize: 12, fontWeight: 700 }}>{lista.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>}
    </div>
    {edM && <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", alignItems: "center", justifyContent: "space-between", background: "rgba(176,137,79,.16)", borderBottom: `1px solid ${T.accent}`, padding: "10px 16px", fontSize: 12.5, fontWeight: 700 }}>
      <span>Estás editando el modelo «{edM.nombre}». Los cambios se guardan al tocar "Guardar modelo".</span>
      <span style={{ display: "flex", gap: 8 }}><button style={btn(true)} onClick={guardarModelo}>Guardar modelo</button><button style={btn(false)} onClick={cancelarModelo}>Cancelar</button></span></div>}
    <div role="tablist" style={{ display: "flex", background: T.card, borderBottom: `1px solid ${T.border}` }}>
      {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => pedirTab(k)} style={{ flex: 1, font: "inherit", fontSize: 11.5, fontWeight: 700, color: tab === k ? T.text : T.sub, background: "none", border: 0, padding: "10px 4px 9px", cursor: "pointer", borderBottom: `2px solid ${tab === k ? T.accent : "transparent"}`, marginBottom: -1 }}>{bloq(k) ? "🔒 " : ""}{l}</button>)}
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 90px", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      {!lista.length ? <div style={{ ...card, ...hint, textAlign: "center", padding: 24 }}>No hay obras cargadas todavía.</div>
        : tab === "crono" ? pantallaCrono() : tab === "tareas" ? pantallaTareas() : tab === "pedidos" ? pantallaPedidos() : pantallaModelos()}
    </div>
    {toast && <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(80px + env(safe-area-inset-bottom,0px))", background: T.text, color: T.bg, padding: "10px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, display: "flex", gap: 14, alignItems: "center", zIndex: 900, maxWidth: "calc(100% - 32px)" }}>
      <span>{toast.msg}</span>{toast.undo && <button style={{ font: "inherit", fontWeight: 800, background: "none", border: 0, color: T.accent, cursor: "pointer", padding: 0 }} onClick={() => { toast.undo(); setToast(null); }}>Deshacer</button>}</div>}
    {gate && Gate && <Gate titulo="El cronograma solo se modifica con código, para no tocarlo por error." onOk={() => { setUnlocked(true); const fn = gate.fn; setGate(null); if (fn) fn(); }} onCancel={() => setGate(null)} />}
  </div>);
}

function ExcepAdd({ T, btn, onAdd, aviso }) {
  const [f, setF] = useState(""), [t, setT] = useState("0");
  return (<div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
    <input type="date" value={f} onChange={e => setF(e.target.value)} style={{ flex: 1, minWidth: 0, background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px", minHeight: 40, fontSize: 12.5 }} />
    <select value={t} onChange={e => setT(e.target.value)} style={{ width: 120, flex: "none", background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 6px", minHeight: 40, fontSize: 12 }}><option value="0">No se trabaja</option><option value="1">Se trabaja</option></select>
    <button type="button" style={btn(false)} onClick={() => { if (!f) { aviso("Elegí una fecha primero."); return; } onAdd(f, t === "1" ? 1 : 0); setF(""); }}>Agregar</button>
  </div>);
}
