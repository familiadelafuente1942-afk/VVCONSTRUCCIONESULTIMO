// Conector de NEXO 2 para Claude (servidor MCP "Streamable HTTP" sin sesión), SOLO LECTURA.
// Para que Sebastián, manejando, le pregunte a Claude las novedades de las obras: avances, registros, adicionales,
// actas de auditoría, reclamos y auditorías de contratistas. Misma base que NEXO 2 (nexo2_estado).
// Acceso: el link lleva una clave; acá solo se guarda su huella (SHA-256).
import crypto from "crypto";

const URL_BASE = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const HUELLA = "e5439f25f1470ae7e33198c50defe7f5a8a083aed06d552cda053d18f890bf18";
const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const pesos = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-AR");
const fl = (t) => { if (!t) return ""; if (typeof t === "string" && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(8, 10) + "/" + t.slice(5, 7) + "/" + t.slice(0, 4); const d = new Date(Number(t) - 3 * 3600e3); return isNaN(d) ? String(t) : String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear(); };
const ts = (v) => { if (!v) return 0; if (typeof v === "number") return v; const p = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + "T12:00:00-03:00" : v); return isNaN(p) ? 0 : p; };
const PROHIBIDO = /^(codigos|cfg|cfg_prev|asist_cfg|seg_cfg|seg_flags|fotodesc|ctcods)$|^audfot_|^audtrash_|^bk_|token|hash|sesion|pin/i;
const TIPO_ACTA = { sup: "Acta de supervisión", rev: "Revisión de documentación", cert: "Certificado de etapa" };
const EST = { avanza: "se puede avanzar", material: "falta material", definicion: "falta definición", otro: "otro motivo", terminado: "terminado" };

async function filas(H, filtro) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor,actualizado&limit=3000&${filtro}`, { headers: H });
  if (!r.ok) throw new Error("No pude leer NEXO 2 (" + r.status + ")"); return r.json();
}
async function leer(H, clave) { const x = await filas(H, "clave=eq." + encodeURIComponent(clave)); return x[0] ? x[0].valor : null; }

// obras activas de la cartera (las 4 de base menos las eliminadas, más las nuevas) con su último estado
async function cartera(H) {
  const [cfgR, snaps] = await Promise.all([leer(H, "cfg"), filas(H, "clave=like.snap_*")]);
  let C = {}; try { C = cfgR && cfgR.v ? JSON.parse(cfgR.v) : {}; } catch { }
  const del = new Set(C.del || []), dn = new Set(C.delN || []);
  const S = {}; snaps.forEach((s) => (S[String(s.clave).slice(5)] = s.valor || {}));
  const ids = ["o1", "o2", "o3", "o4"].filter((i) => !del.has(i)).concat((C.nuevas || []).filter((x) => x && x.id && !dn.has(x.id)).map((x) => x.id));
  return ids.map((id) => { const s = S[id] || {}, nu = (C.nuevas || []).find((x) => x.id === id) || {}, i = s.info || {};
    return { id, nombre: s.nombre || (C.mod && C.mod[id] && C.mod[id].nombre) || nu.nombre || id, avance: i.avance, etapa: i.etapa, jefe: i.jefe, entrega: i.entrega ? fl(i.entrega) : "", desvio_semanas: i.desvio, tarjetas_vencidas: i.vencidas, definiciones: i.defsTot ? i.defsOk + " de " + i.defsTot : "", nos_deben: (s.cards || []).filter((c) => (c.pend || []).length).slice(0, 10).map((c) => (c.tipo === "mat" ? "materiales" : "documentación") + " para " + c.tarea + ": " + c.pend.map((p) => p.txt + (p.resp ? " (debe " + p.resp + ")" : "")).join(", ")), actualizado: s.t ? fl(s.t) : "" };
  });
}
const nombreDe = (O, id) => (O.find((o) => o.id === id) || {}).nombre || id;
const buscarObra = (O, q) => { const n = nrm(q); return O.find((o) => nrm(o.id) === n || nrm(o.nombre) === n) || O.find((o) => nrm(o.nombre).includes(n) || (n.length > 3 && n.includes(nrm(o.nombre)))) || null; };

async function reclamos(H, O) {
  const R = await filas(H, "clave=like.ctrec_*"); const out = [];
  for (const r of R) for (const x of ((r.valor && r.valor.items) || [])) {
    const resp = (x.hist || []).filter((h) => h.por === "dir");
    out.push({ obra: nombreDe(O, x.obra || String(r.clave).slice(6)), num: x.num, tipo: x.tipo, titulo: x.titulo, contratista: x.ctNombre, estado: x.estado, respondido: resp.length > 0, creado: x.creado, ultimo: (x.hist || []).slice(-1)[0], desc: String(x.desc || "").slice(0, 600), aud: x.aud });
  }
  return out.sort((a, b) => (b.creado || 0) - (a.creado || 0));
}
const audTxt = (a) => a ? `Personal en obra: ${a.personal || 0}${a.ociosos ? " (" + a.ociosos + " sin tarea)" : ""}. ` + (a.items || []).map((i) => `${i.tarea}: ${EST[i.est] || i.est}${i.est === "avanza" && (i.gente || i.fin) ? " (" + (i.gente || "?") + " personas, termina " + fl(i.fin) + ")" : ""}${i.falta ? " — falta " + i.falta : ""}`).join("; ") + (a.concl ? ". Conclusión: " + a.concl : "") : "";

async function ejecutar(name, a, H) {
  a = a || {};
  const O = await cartera(H);
  if (name === "obras") return JSON.stringify({ obras: O });
  if (name === "novedades") {
    const dias = Math.max(1, Math.min(30, Number(a.dias) || 2)), d0 = Date.now() - dias * 864e5;
    const en = (...t) => t.some((x) => ts(x) >= d0);
    const [regs, adic, actas, rec] = await Promise.all([leer(H, "seg_registros"), leer(H, "seg_adicionales"), filas(H, "clave=like.audreg_*"), reclamos(H, O)]);
    const segNom = {}; try { ((await leer(H, "seg_obras") || {}).items || []).forEach((x) => (segNom[x.id] = x.nombre)); } catch { }
    const out = [];
    for (const r of ((regs && regs.items) || [])) if (en(r.fecha, r.creado, r.editado)) out.push({ cuando: fl(r.fecha || r.creado), obra: segNom[r.obra] || nombreDe(O, r.obra), que: (r.tipo === "retraso" ? "Retraso: " : "Registro: ") + (r.titulo || "") + (r.causa ? " (" + r.causa + ")" : "") + (r.costo ? " " + pesos(r.costo) : "") + (r.desc ? " — " + String(r.desc).slice(0, 300) : "") });
    for (const x of ((adic && adic.items) || [])) if (en(x.fecha, x.creado, x.editado)) out.push({ cuando: fl(x.fecha || x.creado), obra: segNom[x.obra] || nombreDe(O, x.obra), que: "Adicional: " + x.titulo + " " + pesos(x.monto) + " (" + (x.estado || "") + ")" });
    for (const r of actas) for (const x of ((r.valor && r.valor.items) || [])) if (x && en(x.fecha, x.editado)) out.push({ cuando: fl(x.fecha), obra: nombreDe(O, String(r.clave).slice(7)), que: (TIPO_ACTA[x.tipo] || "Acta") + " " + (x.num || "") + (x.resultado ? ": " + x.resultado : "") });
    for (const x of rec) { const h = (x.ultimo && x.ultimo.t) || 0; if (en(x.creado, h)) out.push({ cuando: fl(Math.max(x.creado || 0, h)), obra: x.obra, que: `${x.tipo === "auditoria" ? "Auditoría" : "Reclamo"} N° ${x.num || ""} de ${x.contratista}: ${x.titulo} · ${x.respondido ? "respondido" : "SIN RESPUESTA de Dirección"}${x.ultimo ? " · último movimiento: " + x.ultimo.tx : ""}${x.tipo === "auditoria" ? " — " + audTxt(x.aud).slice(0, 700) : x.desc ? " — " + x.desc.slice(0, 300) : ""}` }); }
    out.sort((p, q) => ts(q.cuando.split("/").reverse().join("-")) - ts(p.cuando.split("/").reverse().join("-")));
    return JSON.stringify({ periodo: "últimos " + dias + " días", cantidad: out.length, novedades: out.slice(0, 80) });
  }
  if (name === "obra") {
    const o = buscarObra(O, a.nombre); if (!o) return "No encontré esa obra. Las obras son: " + O.map((x) => x.nombre).join(", ");
    const [regs, act, rec] = await Promise.all([leer(H, "seg_registros"), leer(H, "audreg_" + o.id), reclamos(H, O)]);
    const segO = ((await leer(H, "seg_obras") || {}).items || []).find((x) => nrm(x.nombre) === nrm(o.nombre)) || {};
    const rr = ((regs && regs.items) || []).filter((r) => r.obra === o.id || r.obra === segO.id).sort((p, q) => ts(q.fecha || q.creado) - ts(p.fecha || p.creado)).slice(0, 10);
    const ac = ((act && act.items) || []).filter((x) => x && x.tipo).sort((p, q) => (q.fecha || 0) - (p.fecha || 0)).slice(0, 5);
    const rc = rec.filter((x) => x.obra === o.nombre).slice(0, 10);
    return JSON.stringify({ obra: o, ultimos_registros: rr.map((r) => fl(r.fecha || r.creado) + " " + (r.tipo === "retraso" ? "RETRASO " : "") + (r.titulo || "") + (r.causa ? " (" + r.causa + ")" : "") + (r.desc ? ": " + String(r.desc).slice(0, 250) : "")), ultimas_actas: ac.map((x) => fl(x.fecha) + " " + (TIPO_ACTA[x.tipo] || x.tipo) + " " + (x.num || "") + (x.resultado ? ": " + x.resultado : "")), reclamos_y_auditorias: rc.map((x) => ({ fecha: fl(x.creado), num: x.num, tipo: x.tipo, contratista: x.contratista, titulo: x.titulo, respondido: x.respondido, detalle: x.tipo === "auditoria" ? audTxt(x.aud).slice(0, 900) : x.desc.slice(0, 300) })) });
  }
  if (name === "reclamos") {
    let R = await reclamos(H, O); if (a.obra) { const o = buscarObra(O, a.obra); if (o) R = R.filter((x) => x.obra === o.nombre); }
    if (a.solo_sin_respuesta) R = R.filter((x) => !x.respondido && x.estado !== "resuelto" && x.estado !== "cerrado");
    return JSON.stringify({ cantidad: R.length, reclamos: R.slice(0, Math.min(60, Number(a.cantidad) || 20)).map((x) => ({ fecha: fl(x.creado), obra: x.obra, num: x.num, tipo: x.tipo, contratista: x.contratista, titulo: x.titulo, estado: x.estado, respondido: x.respondido, detalle: x.tipo === "auditoria" ? audTxt(x.aud).slice(0, 700) : x.desc.slice(0, 300) })) });
  }
  if (name === "buscar") {
    const b = nrm(a.texto); if (b.length < 3) return "Decime al menos 3 letras para buscar.";
    const R = await filas(H, "clave=not.like.audfot_*"); const hits = [];
    for (const r of R) { if (PROHIBIDO.test(r.clave)) continue; const items = Array.isArray(r.valor && r.valor.items) ? r.valor.items : [r.valor];
      for (const it of items) { const t = JSON.stringify(it, (k, x) => (typeof x === "string" && /^data:/.test(x) ? "" : x)); if (t && nrm(t).includes(b)) hits.push({ seccion: r.clave, dato: t.length > 600 ? t.slice(0, 600) + "…" : t }); if (hits.length >= 25) break; }
      if (hits.length >= 25) break; }
    return JSON.stringify({ busqueda: a.texto, resultados: hits });
  }
  throw new Error("Herramienta desconocida: " + name);
}

const TOOLS = [
  { name: "novedades", description: "Lo último que pasó en las obras de NEXO 2 (V+V / Belfast): registros y retrasos, adicionales, actas de auditoría, reclamos y auditorías de contratistas (con si Dirección respondió). Usalo para 'contame las novedades', 'qué pasó hoy', 'los últimos detalles'.", inputSchema: { type: "object", properties: { dias: { type: "number", description: "Cuántos días para atrás (por defecto 2)" } } } },
  { name: "obras", description: "Cartera de obras de NEXO 2 con avance, etapa, jefe de obra, entrega prevista, desvío en semanas, tarjetas vencidas y lo que nos deben (materiales/documentación).", inputSchema: { type: "object", properties: {} } },
  { name: "obra", description: "Detalle de una obra: estado, últimos registros, últimas actas y reclamos/auditorías de contratistas.", inputSchema: { type: "object", properties: { nombre: { type: "string", description: "Nombre de la obra, ej: Golf 293, Los Puentes 246" } }, required: ["nombre"] } },
  { name: "reclamos", description: "Reclamos y auditorías que mandaron los contratistas, por obra o todos; con opción de ver solo los que Dirección todavía no respondió.", inputSchema: { type: "object", properties: { obra: { type: "string" }, solo_sin_respuesta: { type: "boolean" }, cantidad: { type: "number" } } } },
  { name: "buscar", description: "Busca una palabra en todos los datos de NEXO 2 (obras, registros, reclamos, compras, etc.).", inputSchema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] } },
];
// para MiAsistente (api/asistente-apps.js)
export async function correrNexo(name, args) { const sk = process.env.SUPABASE_SERVICE_KEY; return ejecutar(name, args || {}, { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" }); }
export const CATALOGO_NEXO = TOOLS.map((t) => ({ name: t.name, description: t.description, args: Object.keys((t.inputSchema && t.inputSchema.properties) || {}) }));
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
async function rpc(m, H) {
  const id = m.id ?? null;
  if (m.method === "initialize") return ok(id, { protocolVersion: (m.params && m.params.protocolVersion) || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "NEXO 2", version: "1.0.0" }, instructions: "Datos reales de NEXO 2 (obras de V+V Construcciones con Belfast, Argentina). Sebastián suele preguntar manejando: contestá corto, hablado, sin listas largas, montos sin decimales con separador de miles. Solo lectura." });
  if (m.method === "ping") return ok(id, {});
  if (m.method === "tools/list") return ok(id, { tools: TOOLS });
  if (m.method === "tools/call") { const p = m.params || {}; try { return ok(id, { content: [{ type: "text", text: await ejecutar(p.name, p.arguments, H) }] }); } catch (e) { return ok(id, { content: [{ type: "text", text: "No se pudo: " + (e.message || "error") }], isError: true }); } }
  if (m.method === "resources/list") return ok(id, { resources: [] });
  if (m.method === "prompts/list") return ok(id, { prompts: [] });
  if (String(m.method || "").startsWith("notifications/")) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Método no soportado" } };
}
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version"); res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  const k = String((req.query && req.query.k) || ""), h = crypto.createHash("sha256").update("nexo2:" + k).digest("hex");
  if (!k || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(HUELLA))) { res.status(401).json({ error: "Link inválido" }); return; }
  if (req.method === "GET") { res.setHeader("Allow", "POST"); res.status(405).end(); return; }
  if (req.method === "DELETE") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }
  const sk = process.env.SUPABASE_SERVICE_KEY; if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY" }); return; }
  const H = { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }); return; } }
  const lote = Array.isArray(b) ? b : [b]; const out = (await Promise.all(lote.map((m) => rpc(m, H)))).filter(Boolean);
  if (!out.length) { res.status(202).end(); return; }
  res.setHeader("Content-Type", "application/json"); res.status(200).json(Array.isArray(b) ? out : out[0]);
}
