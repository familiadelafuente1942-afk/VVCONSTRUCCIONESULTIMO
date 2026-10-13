import React, { useState, useRef } from "react";

/* ═══ PEDIDO DE DEFINICIÓN / PLANO ═══
   Planilla modelo para pedirle al estudio de arquitectura (o a quien corresponda) una definición o un plano,
   y panel para que el estudio responda con una descripción y los documentos.
   Se usa en la app general y en la app del cliente, sobre los mismos pedidos (clave "vv_pedidos").
   Un pedido de este tipo es un pedido común con un campo extra: def = { tipo, tarea, limite:"AAAA-MM-DD" }. */

const TIPOS = ["Definición", "Plano", "Consulta técnica"];
const hoyISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
export const fmtLimite = (iso) => { if (!iso) return ""; const p = String(iso).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0].slice(2) : iso; };
export const diasHasta = (iso) => { if (!iso) return null; const p = iso.split("-"); const a = Date.UTC(+p[0], +p[1] - 1, +p[2]), h = new Date(); const b = Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()); return Math.round((a - b) / 864e5); };
export function chipDef(p) {
  if (!p || !p.def) return null;
  const d = diasHasta(p.def.limite), cerrado = p.estado === "resuelto", resp = p.estado === "respondido";
  let txt = p.def.tipo, col = "#8A8680";
  if (resp) { txt += " · respondido, falta confirmar"; col = "#8B5CF6"; }
  else if (p.def.limite && !cerrado) { if (d < 0) { txt += " · vencido hace " + (-d) + (d === -1 ? " día" : " días"); col = "#E5604A"; } else if (d === 0) { txt += " · vence hoy"; col = "#E5604A"; } else { txt += " · vence el " + fmtLimite(p.def.limite); col = d <= 3 ? "#E0A04A" : "#3E9B62"; } }
  if (cerrado) { txt += " · resuelto"; col = "#3E9B62"; }
  return { txt, col };
}

export const ACTORES = { vv: "V+V", cliente: "Cliente", estudio: "Estudio", contratista: "Contratista" };
export const quienEs = (k) => ACTORES[k] || k || "—";
// Cambia el estado de un pedido y deja anotado QUIÉN lo hizo y CUÁNDO (para medir los tiempos de cada actor)
export function conMov(x, estado, quien) {
  const def = x.def ? { ...x.def, mov: [...(x.def.mov || []), { ts: Date.now(), estado, quien }] } : x.def;
  return { ...x, estado, def };
}
const DIA = 864e5;
const finDia = (iso) => { const p = String(iso).split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 23, 59, 59).getTime(); };
export const fmtTs = (ts) => { if (!ts) return "—"; const d = new Date(ts); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getFullYear()).slice(2); };
const diaUTC = (t) => { const x = new Date(t); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()); };
const dias1 = (ms) => Math.max(0, Math.round(ms / DIA * 10) / 10);
const fmtD = (n) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ",")) + (n === 1 ? " día" : " días");

/* Recorrido de un pedido de definición: en manos de quién estuvo y cuánto tiempo.
   1) Quien recibió el pedido (cliente o V+V) hasta que lo pasa al estudio.
   2) El estudio, hasta que responde.
   3) Quien pidió, hasta que revisa y da por resuelto. */
export function trazaDef(p, ahora = Date.now()) {
  const d = p.def || {}, mov = d.mov || [], o = d.origen || {};
  const cerrado = p.estado === "resuelto";
  const tFwd = p.ts || 0, tReq = o.pidioTs && o.pidioTs < tFwd ? o.pidioTs : tFwd;
  const hiloResp = (p.hilo || []).filter(h => h.de !== p.de);
  const mResp = mov.find(m => m.estado === "respondido" || m.estado === "resuelto");
  const tResp = mResp ? mResp.ts : ((p.estado === "respondido" || cerrado) && hiloResp.length ? hiloResp[0].ts : null);
  const mRes = mov.slice().reverse().find(m => m.estado === "resuelto");
  const tRes = cerrado ? (mRes ? mRes.ts : (tResp || tFwd)) : null;
  const seg = [];
  if (tReq && tReq < tFwd - 5 * 60000) seg.push({ actor: quienEs(p.de), que: "Tardó en pasarlo al estudio", de: tReq, a: tFwd });
  seg.push({ actor: quienEs(p.para), que: "Tiempo de respuesta del estudio", de: tFwd, a: tResp || ahora, abierto: !tResp });
  if (tResp) seg.push({ actor: quienEs(p.de), que: "Revisión de la respuesta", de: tResp, a: tRes || ahora, abierto: !tRes });
  seg.forEach(x => { x.dias = dias1(x.a - x.de); });
  const vence = d.limite ? finDia(d.limite) : null;
  const llegoA = tResp || ahora;
  const vencido = !!(vence && llegoA > vence);
  let culpable = null;
  if (vencido) { const s0 = seg.find(x => vence >= x.de && vence <= x.a) || (vence < seg[0].de ? seg[0] : seg[seg.length - 1]); culpable = s0.actor; }
  return { seg, vence, vencido, culpable, diasAtraso: vencido ? Math.max(1, Math.round((diaUTC(llegoA) - diaUTC(vence)) / DIA)) : 0, holder: cerrado ? null : seg[seg.length - 1].actor, tReq, tFwd, tResp, tRes, cerrado };
}

const inp = (T) => ({ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm || 10, padding: "11px 13px", fontSize: 16, color: T.text, fontFamily: "inherit" });
const lab = (T) => ({ display: "block", fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", margin: "12px 0 6px" });

function Adjuntos({ T, adj, setAdj, subir, texto }) {
  const ref = useRef(null);
  const [subiendo, setSub] = useState(false);
  const [errUp, setErrUp] = useState("");
  const agregar = async (e) => {
    const input = e.target, fs = Array.from(input.files || []); if (!fs.length) return; setSub(true); setErrUp("");
    const nuevos = [], fallos = []; for (const f of fs) { try { const a = await subir(f); if (a) nuevos.push(a); else fallos.push(f.name); } catch (er) { fallos.push((er && er.message) || f.name); } }
    setAdj(p => [...p, ...nuevos]); setSub(false); if (fallos.length) setErrUp(fallos.join(" · ")); try { input.value = ""; } catch (er) { }
  };
  return (<div>
    <input ref={ref} type="file" multiple onChange={agregar} style={{ display: "none" }} />
    <button type="button" onClick={() => ref.current && ref.current.click()} disabled={subiendo} style={{ width: "100%", background: T.bg, color: T.text, border: `1px dashed ${T.border}`, borderRadius: T.rsm || 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{subiendo ? "Subiendo…" : "＋ " + texto}</button>
    {errUp && <div style={{ color: "#E5604A", fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>{errUp}</div>}
    {adj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{adj.map((a, i) => <span key={i} style={{ background: "rgba(128,128,128,.14)", borderRadius: 6, padding: "5px 9px", fontSize: 11.5, color: T.sub }}>{a.nombre} <span onClick={() => setAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", marginLeft: 4, fontWeight: 800 }}>✕</span></span>)}</div>}
  </div>);
}

// Planilla modelo para hacer el pedido.
// paraOpciones: a quién se puede mandar (por defecto solo "paraNombre"). inicial: datos ya cargados (por ejemplo, cuando viene de un pedido del contratista).
export function PlanillaDefinicion({ T, obras = [], paraNombre = "el estudio", paraOpciones = null, inicial = null, subir, onCrear, onCancel }) {
  const ini = inicial || {};
  const [f, setF] = useState({ tipo: ini.tipo || "Definición", obra_id: ini.obra_id || (obras[0] && obras[0].id) || "", tarea: ini.tarea || "", que: ini.que || "", limite: ini.limite || "", debio: ini.debio || "", prioridad: "media", para: (paraOpciones && paraOpciones[0] && paraOpciones[0].k) || "" });
  const [adj, setAdj] = useState([]);
  const [err, setErr] = useState("");
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErr(""); };
  const destino = paraOpciones ? ((paraOpciones.find(o => o.k === f.para) || paraOpciones[0]).l) : paraNombre;
  const enviar = () => {
    if (!f.tarea.trim()) { setErr("Poné qué tarea o rubro necesita la definición (por ejemplo: Aberturas)."); return; }
    if (!f.que.trim() && !adj.length) { setErr("Contá qué hay que definir o adjuntá un archivo de referencia."); return; }
    const lineas = [f.tipo.toUpperCase() + " — " + f.tarea.trim(), f.limite ? "Necesito la respuesta antes del " + fmtLimite(f.limite) : "", f.que.trim() ? "\nQué hay que definir:\n" + f.que.trim() : ""].filter(Boolean);
    const def = { tipo: f.tipo, tarea: f.tarea.trim(), limite: f.limite || "", debioPedir: f.debio || "", mov: [{ ts: Date.now(), estado: "abierto", quien: "pedido" }] };
    if (ini.origen) def.origen = ini.origen;
    onCrear({ asunto: f.tipo + ": " + f.tarea.trim(), detalle: lineas.join("\n"), prioridad: f.prioridad, obra_id: f.obra_id, para: f.para || undefined, def, archivos: adj });
  };
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onCancel}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, color: T.text, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 640, padding: "20px 20px 26px", maxHeight: "92vh", overflowY: "auto" }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>Pedir definición o plano</div>
      <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>Planilla modelo. Se la mandamos a {destino} con todo lo necesario para que responda y cargue la documentación.</div>
      {paraOpciones && paraOpciones.length > 1 && <><label style={lab(T)}>Se lo pido a</label>
        <div style={{ display: "flex", gap: 6 }}>{paraOpciones.map(o => <button key={o.k} type="button" onClick={() => set("para", o.k)} style={{ flex: 1, padding: "10px 4px", borderRadius: 8, border: `1px solid ${f.para === o.k ? T.accent : T.border}`, background: f.para === o.k ? T.accent : T.bg, color: f.para === o.k ? "#fff" : T.text, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{o.l}</button>)}</div></>}
      <label style={lab(T)}>Qué se pide</label>
      <div style={{ display: "flex", gap: 6 }}>{TIPOS.map(t => <button key={t} type="button" onClick={() => set("tipo", t)} style={{ flex: 1, padding: "10px 4px", borderRadius: 8, border: `1px solid ${f.tipo === t ? T.accent : T.border}`, background: f.tipo === t ? T.accent : T.bg, color: f.tipo === t ? "#fff" : T.text, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t}</button>)}</div>
      <label style={lab(T)}>Obra</label>
      <select value={f.obra_id} onChange={e => set("obra_id", e.target.value)} style={inp(T)}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
      <label style={lab(T)}>Tarea o rubro que lo necesita</label>
      <input value={f.tarea} onChange={e => set("tarea", e.target.value)} placeholder="Ej: Aberturas, nivel de contrapiso, armadura de losa PB" style={inp(T)} />
      <label style={lab(T)}>Qué hay que definir</label>
      <textarea value={f.que} onChange={e => set("que", e.target.value)} rows={4} placeholder="Ej: Medidas y tipo de carpintería de cada abertura, color y vidrio." style={inp(T)} />
      <label style={lab(T)}>Necesito la respuesta antes del</label>
      <input type="date" value={f.limite} onChange={e => set("limite", e.target.value)} style={inp(T)} />
      <label style={lab(T)}>Debería haberse pedido el (según cronograma, opcional)</label>
      <input type="date" value={f.debio} onChange={e => set("debio", e.target.value)} style={inp(T)} />
      <label style={lab(T)}>Prioridad</label>
      <select value={f.prioridad} onChange={e => set("prioridad", e.target.value)} style={inp(T)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select>
      <label style={lab(T)}>Archivos de referencia (opcional)</label>
      <Adjuntos T={T} adj={adj} setAdj={setAdj} subir={subir} texto="Adjuntar plano o foto de referencia" />
      {err && <div style={{ color: "#E5604A", fontSize: 12.5, fontWeight: 700, marginTop: 10 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, background: T.bg, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.rsm || 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
        <button type="button" onClick={enviar} style={{ flex: 2, background: T.accent, color: "#fff", border: 0, borderRadius: T.rsm || 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Enviar pedido</button>
      </div>
    </div>
  </div>);
}

// Panel dentro del pedido. Tres situaciones:
//  · me toca responder (soy el estudio): descripción + documentos, y puedo marcar "estoy trabajando en esto"
//  · soy quien pidió y el estudio ya respondió: acepto y doy por resuelto, o pido un ajuste
//  · espero la respuesta
export function PanelDefinicion({ T, p, miSide, subir, onResponder, onReabrir, onTomar, onResolver, onDevolver }) {
  const [texto, setTexto] = useState("");
  const [adj, setAdj] = useState([]);
  const [err, setErr] = useState("");
  if (!p || !p.def) return null;
  const ch = chipDef(p), cerrado = p.estado === "resuelto", paraEstudio = p.para === "estudio";
  const yaRespondioEstudio = paraEstudio && p.estado === "respondido", meToca = p.para === miSide;
  const respondido = p.estado === "respondido" || (!paraEstudio && (p.hilo || []).some(h => h.de !== p.de));
  const enviar = () => { if (!texto.trim() && !adj.length) { setErr("Escribí la respuesta o subí el plano/documento."); return; } onResponder(texto, adj); setTexto(""); setAdj([]); setErr(""); };
  const btn = (bg, col, bd) => ({ width: "100%", marginTop: 10, background: bg, color: col, border: bd || 0, borderRadius: T.rsm || 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer" });
  return (<div style={{ border: `1px solid ${ch.col}`, borderLeft: `4px solid ${ch.col}`, background: T.card, borderRadius: T.rsm || 10, padding: 13, marginBottom: 14 }}>
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: ch.col }}>{ch.txt}</div>
    <div style={{ fontSize: 14, fontWeight: 800, color: T.text, margin: "3px 0" }}>{p.def.tarea}</div>
    {cerrado
      ? <div style={{ fontSize: 12.5, color: T.sub }}>Este pedido está resuelto{p.def.devueltoTs ? " y la respuesta ya se envió al contratista" : ""}. {onReabrir && miSide !== "estudio" && <button type="button" onClick={onReabrir} style={{ background: "none", border: 0, color: T.accent, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0 }}>Reabrir</button>}</div>
      : meToca
        ? (<div>
          <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5, marginBottom: 8 }}>{yaRespondioEstudio ? "Ya enviaste una respuesta. Si falta la definición, el plano o algún documento, subilo acá y se suma al pedido." : "Respondé con la descripción de la definición y subí el plano o los documentos."}</div>
          {onTomar && p.estado === "abierto" && <button type="button" onClick={onTomar} style={{ ...btn(T.bg, T.text, `1px solid ${T.border}`), marginTop: 0, marginBottom: 10 }}>Lo recibí, estoy trabajando en esto</button>}
          <textarea value={texto} onChange={e => { setTexto(e.target.value); setErr(""); }} rows={4} placeholder="Descripción de la definición, medidas, materiales, aclaraciones…" style={inp(T)} />
          <div style={{ marginTop: 8 }}><Adjuntos T={T} adj={adj} setAdj={setAdj} subir={subir} texto="Subir plano o documentación" /></div>
          {err && <div style={{ color: "#E5604A", fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>{err}</div>}
          <button type="button" onClick={enviar} style={btn(T.accent, "#fff")}>{yaRespondioEstudio ? "Enviar documentación" : paraEstudio ? "Enviar respuesta" : "Enviar respuesta y dar por resuelto"}</button>
        </div>)
        : (yaRespondioEstudio && miSide === "estudio")
          ? <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>Enviaste la respuesta. Falta que la empresa la revise y la dé por resuelta. Si piden un ajuste, el pedido vuelve a aparecer en "Para responder".</div>
        : (paraEstudio && respondido && onResolver)
          ? (<div>
            <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>El estudio respondió. Revisá la respuesta y los archivos en el hilo.</div>
            {onDevolver && p.def.origen && p.def.origen.matId && <button type="button" onClick={onDevolver} style={btn("#3E9B62", "#fff")}>Enviar al contratista y dar por resuelto</button>}
            <button type="button" onClick={onResolver} style={btn(onDevolver && p.def.origen && p.def.origen.matId ? T.bg : "#3E9B62", onDevolver && p.def.origen && p.def.origen.matId ? T.text : "#fff", onDevolver && p.def.origen && p.def.origen.matId ? `1px solid ${T.border}` : 0)}>{onDevolver && p.def.origen && p.def.origen.matId ? "Dar por resuelto sin enviar" : "Está bien, dar por resuelto"}</button>
            {onReabrir && <button type="button" onClick={onReabrir} style={btn(T.bg, T.text, `1px solid ${T.border}`)}>Pedir un ajuste al estudio</button>}
          </div>)
          : <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>{respondido ? "Ya hay una respuesta. Revisala en el hilo y, si está bien, marcá el pedido como resuelto." : (paraEstudio ? "Está en el estudio. Cuando suban el plano o la descripción, aparece en el hilo." : "Esperando la respuesta. Cuando suban el plano o la descripción, aparece en el hilo.")}</div>}
  </div>);
}

// Línea de tiempo de un pedido: debió pedirse / se pidió / límite / respondió / quedó resuelto, y cuánto estuvo con cada uno
export function RecorridoDef({ T, p }) {
  if (!p || !p.def) return null;
  const t = trazaDef(p), d = p.def, o = d.origen || {};
  const hitos = [
    d.debioPedir ? ["Debía pedirse", fmtLimite(d.debioPedir)] : null,
    o.pidioTs ? ["Lo pidió " + (o.quien || "el contratista"), fmtTs(o.pidioTs)] : null,
    o.leidoTs ? ["El cliente lo levantó", fmtTs(o.leidoTs)] : null,
    ["Se mandó al estudio", fmtTs(t.tFwd)],
    d.limite ? ["Se necesitaba el", fmtLimite(d.limite)] : null,
    ["Respuesta del estudio", t.tResp ? fmtTs(t.tResp) : "pendiente"],
    d.devueltoTs ? ["Enviado al contratista", fmtTs(d.devueltoTs)] : null,
    ["Resuelto", t.tRes ? fmtTs(t.tRes) : "pendiente"],
  ].filter(Boolean);
  return (<div style={{ border: `1px solid ${T.border}`, background: T.card, borderRadius: T.rsm || 10, padding: 13, marginBottom: 14 }}>
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: T.sub, marginBottom: 8 }}>Recorrido del pedido</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "5px 12px", fontSize: 12.5 }}>
      {hitos.map(([a, b], i) => <React.Fragment key={i}><span style={{ color: T.sub }}>{a}</span><span style={{ color: b === "pendiente" ? "#E0A04A" : T.text, fontWeight: 700 }}>{b}</span></React.Fragment>)}
    </div>
    <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 10, paddingTop: 8 }}>
      {t.seg.map((s, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "3px 0" }}><span style={{ color: T.sub }}>{s.que}</span><span style={{ fontWeight: 800, color: s.abierto ? "#E0A04A" : T.text, whiteSpace: "nowrap" }}>{s.actor} · {fmtD(s.dias)}{s.abierto ? " (sigue)" : ""}</span></div>)}
    </div>
    {t.vencido && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 800, color: "#E5604A" }}>Se pasó {fmtD(t.diasAtraso)} de la fecha límite. Se trabó en: {t.culpable}.</div>}
  </div>);
}

// Tablero "quién está trabando": suma el tiempo que los pedidos estuvieron en manos de cada actor
export function TableroDef({ T, pedidos = [], obras = [], onOpen }) {
  const [obra, setObra] = useState("");
  const nomObra = (id) => (obras.find(o => o.id === id) || {}).nombre || "";
  const todos = (pedidos || []).filter(p => p && p.def && (!obra || p.obra_id === obra)).map(p => ({ p, t: trazaDef(p) }));
  const abiertos = todos.filter(x => !x.t.cerrado), venc = todos.filter(x => x.t.vencido);
  const rank = {};
  const R = (a) => (rank[a] = rank[a] || { actor: a, dias: 0, abiertos: 0, vencidos: 0 });
  todos.forEach(({ t }) => { t.seg.forEach(s => { R(s.actor).dias += s.dias; if (s.abierto) R(s.actor).abiertos++; }); if (t.vencido) R(t.culpable).vencidos++; });
  const filas = Object.values(rank).sort((a, b) => b.vencidos - a.vencidos || b.dias - a.dias);
  const maxD = Math.max(1, ...filas.map(f => f.dias));
  const top = filas[0];
  const caja = (v, l, c) => <div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 4px", textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 9.5, color: T.sub, textTransform: "uppercase", fontWeight: 700 }}>{l}</div></div>;
  const obrasCon = obras.filter(o => (pedidos || []).some(p => p && p.def && p.obra_id === o.id));
  if (!(pedidos || []).some(p => p && p.def)) return <div style={{ textAlign: "center", color: T.sub, fontSize: 13, padding: "30px 18px", lineHeight: 1.6 }}>Todavía no hay pedidos de definición o plano. Cuando se pida el primero, acá aparece quién lo tiene y cuánto tarda cada uno.</div>;
  return (<div>
    {obrasCon.length > 1 && <select value={obra} onChange={e => setObra(e.target.value)} style={{ ...inp(T), marginBottom: 10 }}><option value="">Todas las obras</option>{obrasCon.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>}
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{caja(abiertos.length, "Abiertos", "#E0A04A")}{caja(venc.length, "Vencidos", "#E5604A")}{caja(todos.length - abiertos.length, "Resueltos", "#3E9B62")}</div>
    {top && (top.vencidos > 0 || top.abiertos > 0) && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: "4px solid #E5604A", borderRadius: T.rsm || 10, padding: 12, marginBottom: 12, fontSize: 13, lineHeight: 1.5, color: T.text }}><b>Hoy lo que más traba: {top.actor}.</b> {top.vencidos > 0 ? top.vencidos + (top.vencidos === 1 ? " pedido vencido" : " pedidos vencidos") + " en su etapa, " : ""}{top.abiertos} abierto{top.abiertos === 1 ? "" : "s"} en su poder, {fmtD(Math.round(top.dias))} acumulados.</div>}
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: T.sub, margin: "4px 0 8px" }}>Tiempo que estuvo en manos de cada uno</div>
    {filas.map(f => <div key={f.actor} style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}><b style={{ color: T.text }}>{f.actor}</b><span style={{ color: T.sub }}>{fmtD(Math.round(f.dias))} · {f.vencidos} vencido{f.vencidos === 1 ? "" : "s"} · {f.abiertos} abierto{f.abiertos === 1 ? "" : "s"}</span></div>
      <div style={{ height: 9, background: T.bg, borderRadius: 5, overflow: "hidden", border: `1px solid ${T.border}` }}><div style={{ width: Math.max(3, Math.round(f.dias / maxD * 100)) + "%", height: "100%", background: f.vencidos ? "#E5604A" : "#3E9B62" }} /></div>
    </div>)}
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: T.sub, margin: "16px 0 8px" }}>Cada pedido</div>
    {todos.sort((a, b) => (a.t.cerrado - b.t.cerrado) || (b.t.vencido - a.t.vencido) || (b.p.ts - a.p.ts)).map(({ p, t }) => { const ch = chipDef(p); return (<div key={p.id} onClick={() => onOpen && onOpen(p.id)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm || 10, padding: 12, marginBottom: 8, cursor: onOpen ? "pointer" : "default" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div style={{ fontSize: 13.5, fontWeight: 800, color: T.text }}>{p.def.tarea}</div><span style={{ fontSize: 10.5, fontWeight: 800, color: t.holder ? "#E0A04A" : "#3E9B62", whiteSpace: "nowrap" }}>{t.holder ? "Lo tiene: " + t.holder : "Resuelto"}</span></div>
      <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>{nomObra(p.obra_id)}{nomObra(p.obra_id) ? " · " : ""}{ch && ch.txt}</div>
      <div style={{ fontSize: 11.5, color: T.sub, marginTop: 5, lineHeight: 1.6 }}>{p.def.debioPedir ? "Debía pedirse " + fmtLimite(p.def.debioPedir) + " · " : ""}Pedido {fmtTs(t.tReq)}{p.def.limite ? " · Necesario " + fmtLimite(p.def.limite) : ""}{t.tResp ? " · Respondido " + fmtTs(t.tResp) : ""}</div>
      {t.vencido && <div style={{ fontSize: 11.5, fontWeight: 800, color: "#E5604A", marginTop: 4 }}>Se trabó en: {t.culpable} (+{fmtD(t.diasAtraso)} sobre la fecha límite)</div>}
    </div>); })}
  </div>);
}
