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

// Íconos estilo SF Symbols (trazo fino), uno por tipo de pedido.
function TipoIcon({ tipo, size = 22, color = "currentColor" }) {
  const s = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", style: { display: "block" } };
  if (tipo === "definicion") // regla/escuadra — definiciones
    return (<svg {...s}><path d="M4.5 16.5 16.5 4.5a2.12 2.12 0 0 1 3 3L7.5 19.5l-4 1 1-4Z" /><path d="M13.5 7.5 16.5 10.5" /><path d="M9.5 11.5 11.5 13.5" /></svg>);
  if (tipo === "plano") // plano/documento con esquina doblada y líneas
    return (<svg {...s}><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4" /><path d="M8.5 12.5h7" /><path d="M8.5 15.5h7" /><path d="M8.5 9.5h3" /></svg>);
  // material — caja/paquete
  return (<svg {...s}><path d="M12 3 20.5 7.5v9L12 21 3.5 16.5v-9L12 3Z" /><path d="M3.5 7.5 12 12l8.5-4.5" /><path d="M12 12v9" /><path d="M7.75 5.25 16.25 9.75" /></svg>);
}

const TIPOS_PEDIDO = [
  { id: "material", label: "Materiales", sing: "material", icon: "📦", color: "#1B3A5B" },
  { id: "definicion", label: "Definiciones", sing: "definición", icon: "📐", color: "#B0894F" },
  { id: "plano", label: "Planos", sing: "plano", icon: "🗂️", color: "#3B6E9E" },
];
const tipoDe = (id) => TIPOS_PEDIDO.find(t => t.id === id) || TIPOS_PEDIDO[0];
const itemsTexto = (p) => (p.items || []).map(it => (p.tipo && p.tipo !== "material") ? `${it.nombre}${it.detalle ? ` (${it.detalle})` : ""}` : `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim());
const DOCS_BASE = ["Niveles", "Eje de replanteo en platea", "Planos de platea", "Planos de estructura", "Plano de replanteo de mampostería", "Plano de mampostería", "Plano de hogar", "Plano de parrilla", "Plano de vainas"];

// Carga SheetJS desde CDN una sola vez (para leer el Excel en el navegador)
function cargarXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("No se pudo cargar el lector de Excel."));
    document.head.appendChild(s);
  });
}
// Parsea el Excel de definiciones (formato V+V u hoja simple) → [{rubro, item}]
function parseDefinicionesXLSX(XLSX, ab) {
  const wb = XLSX.read(ab, { type: "array" });
  const shName = wb.SheetNames.find(n => /definici/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[shName], { header: 1, defval: "" });
  const out = []; let lastRubro = "";
  const esRuido = (t) => /rubro|definici[oó]n|fecha|estado|observ|checklist|construcciones|obra:|comitente|¿la tenemos|resumen|faltante/i.test(t);
  for (const row of rows) {
    let itemTxt = "", colG = "";
    row.forEach((cell, idx) => {
      if (typeof cell === "string") { if (cell.includes("•")) itemTxt = cell.replace(/^[\s•*·-]+/, "").trim(); if (idx === 6 && cell.trim()) colG = cell.trim(); }
    });
    if (itemTxt) { out.push({ rubro: colG || lastRubro || "General", item: itemTxt }); continue; }
    // fila de rubro: una celda de texto sola, sin bullet, que no sea ruido
    const textos = row.filter(c => typeof c === "string" && c.trim());
    if (textos.length && !esRuido(textos[0])) { lastRubro = textos[0].trim(); }
    // formato simple: rubro en una col, definición en otra (sin bullets)
    if (out.length === 0 && textos.length >= 2 && !esRuido(textos[0]) && !esRuido(textos[1])) {
      // heurística: primera col rubro, segunda definición
    }
  }
  return out;
}

function DefinicionesView({ obras, empresa, definiciones, persistDef }) {
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [cargando, setCargando] = useState(false);
  const [pdfHtml, setPdfHtml] = useState(null);
  const [nuevoRubro, setNuevoRubro] = useState("");
  const [nuevaDef, setNuevaDef] = useState("");
  const obraNom = id => obras.find(o => o.id === id)?.nombre || "—";
  const reg = (definiciones || []).find(r => r.obra_id === obraId);
  const items = reg ? reg.items : [];

  const guardar = (nextItems) => {
    const otros = (definiciones || []).filter(r => r.obra_id !== obraId);
    persistDef([...otros, { obra_id: obraId, items: nextItems, upd: Date.now() }]);
  };

  async function subirExcel(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    setCargando(true);
    try {
      const XLSX = await cargarXLSX();
      const ab = await file.arrayBuffer();
      const pares = parseDefinicionesXLSX(XLSX, ab);
      if (!pares.length) { alert("No pude leer definiciones en ese archivo. Fijate que tenga los rubros y las definiciones (como el Excel de V+V)."); setCargando(false); return; }
      const nuevos = pares.map(p => ({ id: uid() + Math.random().toString(36).slice(2, 5), rubro: p.rubro, nombre: p.item, tiene: false }));
      // no pisar lo ya marcado: si ya había ítems, agrego los que no estén
      const existentesKey = new Set(items.map(i => (i.rubro + "|" + i.nombre).toLowerCase()));
      const merge = [...items, ...nuevos.filter(n => !existentesKey.has((n.rubro + "|" + n.nombre).toLowerCase()))];
      guardar(merge);
      alert(`✓ Cargué ${nuevos.length} definiciones de "${file.name}". Marcá las que ya tenés.`);
    } catch (err) { alert(err.message || "No se pudo leer el archivo."); }
    setCargando(false);
  }

  const toggle = (id) => guardar(items.map(it => it.id === id ? { ...it, tiene: !it.tiene } : it));
  const quitar = (id) => guardar(items.filter(it => it.id !== id));
  const agregarManual = () => {
    const nom = nuevaDef.trim(); if (!nom) return;
    guardar([...items, { id: uid() + Math.random().toString(36).slice(2, 5), rubro: (nuevoRubro.trim() || "General"), nombre: nom, tiene: false }]);
    setNuevaDef("");
  };
  const limpiar = () => { if (window.confirm("¿Borrar todas las definiciones de esta obra?")) guardar([]); };

  const tienen = items.filter(i => i.tiene).length;
  const faltan = items.length - tienen;
  // agrupar por rubro para mostrar y para el PDF
  const grupos = [];
  items.forEach(it => { let g = grupos.find(x => x.rubro === it.rubro); if (!g) { g = { rubro: it.rubro, items: [] }; grupos.push(g); } g.items.push(it); });

  function pdfFaltantes() {
    const faltantes = grupos.map(g => ({ rubro: g.rubro, items: g.items.filter(i => !i.tiene) })).filter(g => g.items.length);
    const rowsHtml = faltantes.map(g => `<tr class="rub"><td colspan="2">${g.rubro}</td></tr>` + g.items.map(i => `<tr><td class="dot">•</td><td>${i.nombre}</td></tr>`).join("")).join("");
    const pct = items.length ? Math.round(tienen / items.length * 100) : 0;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Definiciones faltantes ${obraNom(obraId)}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Arial,sans-serif;color:#0F1B2D;padding:0 0 40px;line-height:1.5}.head{background:#0F1B2D;color:#fff;padding:20px 34px;border-bottom:4px solid #B0894F}.brand{font-size:20px;font-weight:800}.brand small{display:block;font-size:9px;color:#B0894F;letter-spacing:2px;margin-top:2px}.doc{font-size:12px;font-weight:800;color:#B0894F;text-transform:uppercase;letter-spacing:1px;margin-top:6px}.wrap{padding:0 34px}.meta{display:flex;justify-content:space-between;margin:18px 0;font-size:12px;color:#5B6B7F}.kpi{display:flex;gap:0;margin:14px 0;border:1px solid #E3E8EF;border-radius:8px;overflow:hidden}.kpi div{flex:1;text-align:center;padding:10px;border-right:1px solid #E3E8EF}.kpi div:last-child{border-right:none}.kpi b{display:block;font-size:20px}.kpi span{font-size:8px;color:#5B6B7F;text-transform:uppercase}table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}td{padding:7px 8px;border-bottom:1px solid #EEF1F5;vertical-align:top}.rub td{background:#EAF0F7;color:#1B3A5B;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.03em}.dot{width:20px;color:#B0894F;text-align:center}.obs{font-size:10px;color:#5B6B7F;margin-top:20px;border-top:1px solid #D6DCE4;padding-top:8px}.firmas{display:flex;justify-content:space-between;margin-top:44px}.firma{width:44%;text-align:center;font-size:10px;color:#5B6B7F}.firma .ln{border-top:1px solid #0F1B2D;padding-top:5px;margin-top:34px}@media print{.noprint{display:none}}</style></head><body><div class="head"><div class="brand">V+V CONSTRUCCIONES<small>CONSTRUCTORA</small></div><div class="doc">Definiciones faltantes de obra</div></div><div class="wrap"><div class="meta"><div>Obra: <b>${obraNom(obraId)}</b></div><div>Fecha: ${hoyStr()}</div></div><div class="kpi"><div><b style="color:#B91C1C">${faltan}</b><span>Faltantes</span></div><div><b style="color:#16A34A">${tienen}</b><span>Definidas</span></div><div><b>${items.length}</b><span>Total</span></div><div><b>${pct}%</b><span>Definido</span></div></div>${faltantes.length ? `<table><tbody>${rowsHtml}</tbody></table>` : '<p style="padding:20px 0;text-align:center;color:#16A34A;font-weight:700">No hay definiciones faltantes. Todas resueltas.</p>'}<div class="obs">Las definiciones pendientes atrasan el normal desarrollo de las tareas de albañilería, revoques y colocaciones. Es importante resolverlas para poder dar curso a las tareas, contrataciones y pedidos de materiales.</div><div class="firmas"><div class="firma"><div class="ln">${empresa || "V+V Construcciones"}</div></div><div class="firma"><div class="ln">Belfast CM — Recibido</div></div></div></div><div class="noprint" style="text-align:center;padding:22px"><button onclick="window.print()" style="background:#0F1B2D;color:#fff;border:none;border-radius:10px;padding:13px 26px;font-size:14px;font-weight:700">Guardar / Imprimir PDF</button></div></body></html>`;
    setPdfHtml(html);
  }
  function waFaltantes() {
    const faltantes = grupos.map(g => ({ rubro: g.rubro, items: g.items.filter(i => !i.tiene) })).filter(g => g.items.length);
    const txt = `*DEFINICIONES FALTANTES*\nObra: ${obraNom(obraId)}\nFecha: ${hoyStr()}\n\n` + faltantes.map(g => `*${g.rubro}*\n` + g.items.map(i => `• ${i.nombre}`).join("\n")).join("\n\n") + `\n\nFaltan ${faltan} de ${items.length} definiciones.\n(V+V Construcciones)`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  }

  if (obras.length === 0) return <div style={{ padding: "40px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>Todavía no hay obras cargadas.</div>;

  return (<div>
    <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Subí el Excel de definiciones, marcá las que ya tenés, y generá el PDF de faltantes para Belfast.</div>
    <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
    <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", fontSize: 14, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }}>
      {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </select>

    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: cargando ? "default" : "pointer", opacity: cargando ? 0.6 : 1, marginBottom: 14 }}>
      {cargando ? "Leyendo el Excel…" : "⬆︎ Subir Excel de definiciones"}
      <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={cargando} onChange={subirExcel} style={{ display: "none" }} />
    </label>

    {items.length > 0 && <>
      {/* resumen */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[["Faltan", faltan, "#B91C1C"], ["Tenemos", tienen, "#16A34A"], ["Total", items.length, T.text]].map(([l, v, c]) => (
          <div key={l} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>{l}</div>
          </div>
        ))}
      </div>

      {grupos.map(g => (<div key={g.rubro} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 13, marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.navy, marginBottom: 8 }}>{g.rubro}</div>
        {g.items.map(it => (<div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
          <button onClick={() => toggle(it.id)} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${it.tiene ? "#16A34A" : T.border}`, background: it.tiene ? "#16A34A" : "transparent", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{it.tiene ? "✓" : ""}</button>
          <div style={{ flex: 1, fontSize: 13, color: it.tiene ? T.text : T.sub, textDecoration: it.tiene ? "none" : "none" }}>{it.nombre}<span style={{ fontSize: 9.5, fontWeight: 800, color: it.tiene ? "#16A34A" : "#B45309", marginLeft: 6 }}>{it.tiene ? "TENEMOS" : "FALTA"}</span></div>
          <button onClick={() => quitar(it.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>))}
      </div>))}

      {/* agregar manual */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <input value={nuevoRubro} onChange={e => setNuevoRubro(e.target.value)} placeholder="Rubro" style={{ width: 110, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, color: T.text }} />
        <input value={nuevaDef} onChange={e => setNuevaDef(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregarManual(); } }} placeholder="Agregar definición…" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, color: T.text }} />
        <button onClick={agregarManual} style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "0 15px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>＋</button>
      </div>

      <button onClick={pdfFaltantes} style={{ width: "100%", background: T.navy, color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}>📄 PDF de definiciones faltantes</button>
      <button onClick={waFaltantes} style={{ width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 9 }}>📲 Enviar faltantes por WhatsApp</button>
      <button onClick={limpiar} style={{ width: "100%", background: "none", color: T.muted, border: "none", padding: "8px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Borrar todo y empezar de nuevo</button>
    </>}

    {items.length === 0 && !cargando && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "10px", lineHeight: 1.6 }}>Subí el Excel de definiciones para armar el checklist.<br />También podés cargarlas a mano una vez que subas al menos una.</div>}

    {pdfHtml && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", zIndex: 400, display: "flex", flexDirection: "column" }} onClick={() => setPdfHtml(null)}>
      <div style={{ padding: "10px 16px", display: "flex", justifyContent: "flex-end" }}><button onClick={() => setPdfHtml(null)} style={{ background: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cerrar ✕</button></div>
      <iframe title="PDF" srcDoc={pdfHtml} onClick={e => e.stopPropagation()} style={{ flex: 1, border: "none", background: "#fff", margin: "0 8px 8px", borderRadius: 10 }} />
    </div>}
  </div>);
}

function RecepcionDocs({ obras, empresa, docrecepcion, persistDoc }) {
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [nuevoItem, setNuevoItem] = useState("");
  const obraNom = id => obras.find(o => o.id === id)?.nombre || "—";

  const reg = (docrecepcion || []).find(r => r.obra_id === obraId);
  const items = reg ? reg.items : DOCS_BASE.map((n, i) => ({ id: "base" + i, nombre: n, recibido: false, fecha: "" }));

  const guardarItems = (nextItems) => {
    const otros = (docrecepcion || []).filter(r => r.obra_id !== obraId);
    persistDoc([...otros, { obra_id: obraId, items: nextItems, upd: Date.now() }]);
  };
  const toggle = (id) => guardarItems(items.map(it => it.id === id ? { ...it, recibido: !it.recibido, fecha: !it.recibido ? hoyStr() : "" } : it));
  const agregar = () => { const n = nuevoItem.trim(); if (!n) return; guardarItems([...items, { id: uid() + Date.now(), nombre: n, recibido: false, fecha: "" }]); setNuevoItem(""); };
  const quitar = (id) => guardarItems(items.filter(it => it.id !== id));
  const recibidos = items.filter(it => it.recibido).length;

  function remitoWA() {
    const lineas = items.map(it => `${it.recibido ? "✅" : "⬜"} ${it.nombre}${it.recibido && it.fecha ? ` (${it.fecha})` : ""}`);
    const txt = `*REMITO DE RECEPCIÓN DE DOCUMENTACIÓN*\nObra: ${obraNom(obraId)}\nFecha: ${hoyStr()}\nContratista: ${empresa}\n\nDocumentación inicial básica:\n${lineas.join("\n")}\n\nRecibidos: ${recibidos} de ${items.length}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  }

  if (obras.length === 0) return <div style={{ padding: "40px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>Todavía no hay obras cargadas.</div>;

  return (<div>
    <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Remito de recepción de la documentación inicial de obra. Marcá lo que fuiste recibiendo y generá el remito.</div>
    <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
    <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", fontSize: 14, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }}>
      {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </select>

    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>Documentación inicial</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: recibidos === items.length && items.length > 0 ? "#16A34A" : T.muted }}>{recibidos} de {items.length} recibidos</span>
      </div>
      {items.map(it => (<div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${T.border}` }}>
        <button onClick={() => toggle(it.id)} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${it.recibido ? "#16A34A" : T.border}`, background: it.recibido ? "#16A34A" : "transparent", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{it.recibido ? "✓" : ""}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: it.recibido ? T.text : T.sub }}>{it.nombre}</div>
          {it.recibido && it.fecha && <div style={{ fontSize: 10, color: "#16A34A", fontWeight: 700 }}>Recibido {it.fecha}</div>}
        </div>
        {!DOCS_BASE.includes(it.nombre) && <button onClick={() => quitar(it.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>}
      </div>))}
      <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
        <input value={nuevoItem} onChange={e => setNuevoItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }} placeholder="Agregar otra definición o plano…" style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text }} />
        <button onClick={agregar} style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "0 15px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>＋</button>
      </div>
    </div>

    <button onClick={remitoWA} style={{ width: "100%", marginTop: 14, background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>📲 Enviar remito de recepción por WhatsApp</button>
  </div>);
}

export default function ContratistaApp() {
  const [empresa, setEmpresa] = useState(() => { try { return localStorage.getItem("contratista_empresa") || ""; } catch { return ""; } });
  const [tmpEmpresa, setTmpEmpresa] = useState("");
  const [obras, setObras] = useState([]);
  const [matpedidos, setMatpedidos] = useState([]);
  const [vista, setVista] = useState("pedidos"); // "pedidos" | "recepcion" | "definiciones"
  const [docrecepcion, setDocrecepcion] = useState([]);
  const [definiciones, setDefiniciones] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [waFor, setWaFor] = useState(null);
  const [form, setForm] = useState(null);
  const [editEmpresa, setEditEmpresa] = useState(false);
  const [estiloOpen, setEstiloOpen] = useState(false);
  const [temaId, setTemaId] = useState(() => { try { return localStorage.getItem("contratista_tema") || "institucional"; } catch { return "institucional"; } });
  const lastWrite = useRef(0);
  const lastWriteDoc = useRef(0);
  async function persistDoc(next) {
    lastWriteDoc.current = Date.now();
    setDocrecepcion(next);
    try { localStorage.setItem("vv_docrecepcion", JSON.stringify(next)); } catch { }
    await storage.set("vv_docrecepcion", JSON.stringify(next)).catch(() => { });
  }
  const lastWriteDef = useRef(0);
  async function persistDef(next) {
    lastWriteDef.current = Date.now();
    setDefiniciones(next);
    try { localStorage.setItem("vv_definiciones", JSON.stringify(next)); } catch { }
    await storage.set("vv_definiciones", JSON.stringify(next)).catch(() => { });
  }

  useEffect(() => { initPush("contratista"); }, []);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const [ro, rm, rp] = await Promise.all([storage.get("vv_obras"), storage.get("vv_matpedidos"), storage.get("vv_personal")]);
        if (!alive) return;
        if (ro?.value) { try { setObras(JSON.parse(ro.value).filter(o => { const n = (o.nombre || "").toLowerCase(); return !(n.includes("canning") && n.includes("815")); })); } catch { } }
        if (rp?.value) { try { setPersonal(JSON.parse(rp.value)); } catch { } }
        if (rm?.value && Date.now() - lastWrite.current > 8000) { try { const mp = JSON.parse(rm.value); setMatpedidos(prev => JSON.stringify(mp) !== JSON.stringify(prev) ? mp : prev); } catch { } }
        try { const rd = await storage.get("vv_docrecepcion"); if (alive && rd?.value && Date.now() - lastWriteDoc.current > 8000) { const dd = JSON.parse(rd.value); setDocrecepcion(prev => JSON.stringify(dd) !== JSON.stringify(prev) ? dd : prev); } } catch { }
        try { const rf = await storage.get("vv_definiciones"); if (alive && rf?.value && Date.now() - lastWriteDef.current > 8000) { const df = JSON.parse(rf.value); setDefiniciones(prev => JSON.stringify(df) !== JSON.stringify(prev) ? df : prev); } } catch { }
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

  function nuevo(tipo = "material") { setForm({ tipo, obra_id: obras[0]?.id || "", items: [{ nombre: "", cantidad: "", unidad: "u", detalle: "" }], nota: "", fecha_pedido: new Date().toISOString().slice(0, 10), fecha_necesita: "" }); }
  function editar(p) { setForm({ id: p.id, tipo: p.tipo || "material", obra_id: p.obra_id, items: (p.items && p.items.length ? p.items.map(it => ({ nombre: it.nombre || "", cantidad: it.cantidad != null ? String(it.cantidad) : "", unidad: it.unidad || "u", detalle: it.detalle || "" })) : [{ nombre: "", cantidad: "", unidad: "u", detalle: "" }]), nota: p.nota || "", fecha_pedido: p.fecha_pedido || "", fecha_necesita: p.fecha_necesita || "" }); }
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
  function addItem() { setForm(f => ({ ...f, items: [...f.items, { nombre: "", cantidad: "", unidad: "u", detalle: "" }] })); }
  function setItem(i, k, v) { setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) })); }
  function delItem(i) { setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) })); }
  async function guardar() {
    const tipo = form.tipo || "material";
    const tp = tipoDe(tipo);
    const items = (form.items || []).filter(it => (it.nombre || "").trim()).map(it => ({ nombre: it.nombre.trim(), cantidad: it.cantidad != null ? String(it.cantidad) : "", unidad: it.unidad || "u", detalle: (it.detalle || "").trim() }));
    if (!items.length) { alert(`Agregá al menos ${tipo === "material" ? "un material" : tipo === "plano" ? "un plano" : "una definición"}.`); return; }
    const r = await storage.get("vv_matpedidos"); let arr = []; if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    if (form.id) {
      const next = arr.map(x => x.id === form.id ? { ...x, tipo, obra_id: form.obra_id, items, nota: form.nota || "", fecha_pedido: form.fecha_pedido || "", fecha_necesita: form.fecha_necesita || "", editadoFecha: hoyStr() } : x);
      const pid = form.id; await persistMat(next); setForm(null); setWaFor(pid);
      alert("✓ Pedido actualizado. Ya se ve así en V+V y Belfast. Podés reenviarlo por WhatsApp abajo.");
      return;
    }
    const p = { id: uid() + Date.now(), tipo, obra_id: form.obra_id, items, nota: form.nota || "", fecha: hoyStr(), fecha_pedido: form.fecha_pedido || "", fecha_necesita: form.fecha_necesita || "", ts: Date.now(), de: "contratista", empresa, leido: false, leidoFecha: "" };
    await persistMat([p, ...arr]); setForm(null); setWaFor(p.id);
    pushNotify(`Nuevo pedido de ${tp.label.toLowerCase()}`, `${empresa}: ${items.map(it => it.nombre).join(", ").slice(0, 90)}`, "");
    alert("✓ Pedido enviado a V+V y Belfast. Ahora podés mandarlo por WhatsApp al encargado de obra (abajo).");
  }

  async function borrar(id) {
    if (!confirm("¿Eliminar este pedido de materiales? También se quita en V+V y Belfast.")) return;
    const r = await storage.get("vv_matpedidos"); let arr = []; if (r?.value) { try { arr = JSON.parse(r.value); } catch { } }
    await persistMat(arr.filter(x => x.id !== id));
  }
  const obraNom = id => obras.find(o => o.id === id)?.nombre || "—";
  function waText(p) {
    const tp = tipoDe(p.tipo);
    const lines = itemsTexto(p).map(l => `• ${l}`);
    return `*Pedido de ${tp.label.toLowerCase()}* — ${obraNom(p.obra_id)}\nFecha: ${p.fecha}${p.fecha_necesita ? `\n📅 *Necesito en obra: ${fmtISO(p.fecha_necesita)}*` : ""}\nContratista: ${p.empresa || empresa}\n\n${lines.join("\n")}${p.nota ? "\n\nNota: " + p.nota : ""}\n\n✅ Por favor, confirmá la recepción respondiendo este mensaje con *OK / RECIBIDO*.`;
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
      {/* solapas */}
      <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
        {[["pedidos", "Pedidos"], ["recepcion", "Recepción de docs"], ["definiciones", "Definiciones"]].map(([k, l]) => (
          <button key={k} onClick={() => setVista(k)} style={{ flex: 1, background: vista === k ? T.navy : "transparent", color: vista === k ? "#fff" : T.sub, border: `1px solid ${vista === k ? T.navy : T.border}`, borderRadius: T.rsm, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {vista === "recepcion" ? <RecepcionDocs obras={obras} empresa={empresa} docrecepcion={docrecepcion} persistDoc={persistDoc} /> : vista === "definiciones" ? <DefinicionesView obras={obras} empresa={empresa} definiciones={definiciones} persistDef={persistDef} /> : <>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9 }}>Qué querés pedir</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {TIPOS_PEDIDO.map(t => (
          <button key={t.id} onClick={() => nuevo(t.id)} style={{ flex: 1, background: T.card, color: T.text, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 6px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", textAlign: "center", borderTop: `3px solid ${t.color}` }}>
            <div style={{ marginBottom: 5, display: "flex", justifyContent: "center" }}><TipoIcon tipo={t.id} size={26} color={t.color} /></div>{t.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Todos los pedidos ({lista.length})</div>
      {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "40px 18px" }}>Todavía no hay pedidos. Elegí arriba qué querés pedir.</div>}
      {lista.map(p => { const mio = p.de === "contratista" && p.empresa === empresa; return (<div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${p.leido ? "#16A34A" : mio ? BRASS : T.border}`, borderRadius: T.rsm, padding: 13, marginBottom: 9, boxShadow: T.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 800, color: "#fff", background: tipoDe(p.tipo).color, borderRadius: 5, padding: "2px 7px", marginRight: 7, verticalAlign: "middle" }}><TipoIcon tipo={p.tipo} size={12} color="#fff" /> {tipoDe(p.tipo).label}</span>{obraNom(p.obra_id)} · {p.fecha}</div>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: p.de === "vv" ? T.accent : p.de === "cliente" ? "#7C3AED" : BRASS, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>{origenLabel(p)}</span>
        </div>
        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{itemsTexto(p).map(l => `• ${l}`).join("\n")}</div>
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
    </>}
    </div>

    {form && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setForm(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 620, padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 14 }}>{form.id ? `Editar pedido de ${tipoDe(form.tipo).label.toLowerCase()}` : `Nuevo pedido de ${tipoDe(form.tipo).label.toLowerCase()}`}</div>
        <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
        <select value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 13px", fontSize: 14, color: T.text, margin: "6px 0 14px", boxSizing: "border-box" }}>
          {obras.length === 0 && <option value="">(sin obras cargadas)</option>}
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>{tipoDe(form.tipo).label}</div>
        {form.items.map((it, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <input value={it.nombre} onChange={e => setItem(i, "nombre", e.target.value)} placeholder={form.tipo === "material" ? "Material" : form.tipo === "plano" ? "Plano (ej: Estructura losa)" : "Definición (ej: Tipo de piso)"} style={{ flex: 2, minWidth: 0, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13.5, color: T.text }} />
          {(form.tipo || "material") === "material" ? <>
            <input value={it.cantidad} onChange={e => setItem(i, "cantidad", e.target.value)} placeholder="Cant." type="number" style={{ width: 60, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />
            <input value={it.unidad} onChange={e => setItem(i, "unidad", e.target.value)} placeholder="u" style={{ width: 50, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />
          </> : <input value={it.detalle || ""} onChange={e => setItem(i, "detalle", e.target.value)} placeholder="Detalle (opcional)" style={{ flex: 1.2, minWidth: 0, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 8px", fontSize: 13.5, color: T.text }} />}
          {form.items.length > 1 && <button onClick={() => delItem(i)} style={{ background: "none", border: "none", color: T.muted, fontSize: 16, cursor: "pointer" }}>✕</button>}
        </div>))}
        <button onClick={addItem} style={{ background: T.al, color: T.accent, border: "none", borderRadius: T.rsm, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>＋ Agregar {tipoDe(form.tipo).sing}</button>
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
