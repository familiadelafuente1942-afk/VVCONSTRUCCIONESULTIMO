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
  const d = diasHasta(p.def.limite), cerrado = p.estado === "resuelto";
  let txt = p.def.tipo, col = "#8A8680";
  if (p.def.limite && !cerrado) { if (d < 0) { txt += " · vencido hace " + (-d) + (d === -1 ? " día" : " días"); col = "#E5604A"; } else if (d === 0) { txt += " · vence hoy"; col = "#E5604A"; } else { txt += " · vence el " + fmtLimite(p.def.limite); col = d <= 3 ? "#E0A04A" : "#3E9B62"; } }
  if (cerrado) { txt += " · resuelto"; col = "#3E9B62"; }
  return { txt, col };
}

const inp = (T) => ({ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm || 10, padding: "11px 13px", fontSize: 16, color: T.text, fontFamily: "inherit" });
const lab = (T) => ({ display: "block", fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", margin: "12px 0 6px" });

function Adjuntos({ T, adj, setAdj, subir, texto }) {
  const ref = useRef(null);
  const [subiendo, setSub] = useState(false);
  const agregar = async (e) => {
    const fs = Array.from(e.target.files || []); if (!fs.length) return; setSub(true);
    const nuevos = []; for (const f of fs) { try { const a = await subir(f); if (a) nuevos.push(a); } catch (er) { } }
    setAdj(p => [...p, ...nuevos]); setSub(false); e.target.value = "";
  };
  return (<div>
    <input ref={ref} type="file" multiple accept="image/*,application/pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx" onChange={agregar} style={{ display: "none" }} />
    <button type="button" onClick={() => ref.current && ref.current.click()} disabled={subiendo} style={{ width: "100%", background: T.bg, color: T.text, border: `1px dashed ${T.border}`, borderRadius: T.rsm || 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{subiendo ? "Subiendo…" : "＋ " + texto}</button>
    {adj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{adj.map((a, i) => <span key={i} style={{ background: "rgba(128,128,128,.14)", borderRadius: 6, padding: "5px 9px", fontSize: 11.5, color: T.sub }}>{a.nombre} <span onClick={() => setAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", marginLeft: 4, fontWeight: 800 }}>✕</span></span>)}</div>}
  </div>);
}

// Planilla modelo para hacer el pedido
export function PlanillaDefinicion({ T, obras = [], paraNombre = "el estudio", subir, onCrear, onCancel }) {
  const [f, setF] = useState({ tipo: "Definición", obra_id: (obras[0] && obras[0].id) || "", tarea: "", que: "", limite: "", prioridad: "media" });
  const [adj, setAdj] = useState([]);
  const [err, setErr] = useState("");
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErr(""); };
  const enviar = () => {
    if (!f.tarea.trim()) { setErr("Poné qué tarea o rubro necesita la definición (por ejemplo: Aberturas)."); return; }
    if (!f.que.trim() && !adj.length) { setErr("Contá qué hay que definir o adjuntá un archivo de referencia."); return; }
    const lineas = [f.tipo.toUpperCase() + " — " + f.tarea.trim(), f.limite ? "Necesito la respuesta antes del " + fmtLimite(f.limite) : "", f.que.trim() ? "\nQué hay que definir:\n" + f.que.trim() : ""].filter(Boolean);
    onCrear({ asunto: f.tipo + ": " + f.tarea.trim(), detalle: lineas.join("\n"), prioridad: f.prioridad, obra_id: f.obra_id, def: { tipo: f.tipo, tarea: f.tarea.trim(), limite: f.limite || "" }, archivos: adj });
  };
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onCancel}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, color: T.text, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 640, padding: "20px 20px 26px", maxHeight: "92vh", overflowY: "auto" }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>Pedir definición o plano</div>
      <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>Planilla modelo. Se la mandamos a {paraNombre} con todo lo necesario para que responda y cargue la documentación.</div>
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

// Panel dentro del pedido: resumen de lo pedido y, para quien debe responder, el formulario de respuesta con documentos
export function PanelDefinicion({ T, p, miSide, subir, onResponder, onReabrir }) {
  const [texto, setTexto] = useState("");
  const [adj, setAdj] = useState([]);
  const [err, setErr] = useState("");
  if (!p || !p.def) return null;
  const ch = chipDef(p), meToca = p.para === miSide, cerrado = p.estado === "resuelto";
  const respondido = (p.hilo || []).some(h => h.de !== p.de);
  const enviar = () => { if (!texto.trim() && !adj.length) { setErr("Escribí la respuesta o subí el plano/documento."); return; } onResponder(texto, adj); setTexto(""); setAdj([]); setErr(""); };
  return (<div style={{ border: `1px solid ${ch.col}`, borderLeft: `4px solid ${ch.col}`, background: T.card, borderRadius: T.rsm || 10, padding: 13, marginBottom: 14 }}>
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: ch.col }}>{ch.txt}</div>
    <div style={{ fontSize: 14, fontWeight: 800, color: T.text, margin: "3px 0" }}>{p.def.tarea}</div>
    {cerrado
      ? <div style={{ fontSize: 12.5, color: T.sub }}>Este pedido está resuelto. {onReabrir && <button type="button" onClick={onReabrir} style={{ background: "none", border: 0, color: T.accent, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0 }}>Reabrir</button>}</div>
      : meToca
        ? (<div>
          <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5, marginBottom: 8 }}>Respondé con la descripción de la definición y subí el plano o los documentos.</div>
          <textarea value={texto} onChange={e => { setTexto(e.target.value); setErr(""); }} rows={4} placeholder="Descripción de la definición, medidas, materiales, aclaraciones…" style={inp(T)} />
          <div style={{ marginTop: 8 }}><Adjuntos T={T} adj={adj} setAdj={setAdj} subir={subir} texto="Subir plano o documentación" /></div>
          {err && <div style={{ color: "#E5604A", fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>{err}</div>}
          <button type="button" onClick={enviar} style={{ width: "100%", marginTop: 10, background: T.accent, color: "#fff", border: 0, borderRadius: T.rsm || 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Enviar respuesta y dar por resuelto</button>
        </div>)
        : <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>{respondido ? "Ya hay una respuesta. Revisala en el hilo y, si está bien, marcá el pedido como resuelto." : "Esperando la respuesta. Cuando suban el plano o la descripción, aparece en el hilo."}</div>}
  </div>);
}
