// Conectores de Claude (servidores MCP "Streamable HTTP" sin sesión, SOLO LECTURA) para las apps de Sebastián:
//   /mcp/barracas/<clave>      Barracas (Correo Argentino · Sucursal N°10): costos, compras, pagos y visitas de obra
//   /mcp/finanzas/<clave>      Finanzas cliente (V+V): certificados, cobros, gastos y resultado
//   /mcp/seguimiento/<clave>   Seguimiento V+V (Sebastián y Nicolás): obras, registros, tareas, agenda, personal, gastos
//   /mcp/contratistas/<clave>  Contratistas: quiénes son, sus obras, reclamos y auditorías
// Cada link lleva su propia clave; acá solo se guarda la huella (SHA-256).
import crypto from "crypto";
import auditoria from "./auditoria.js";
import { calcCert } from "./_fincalc.js";

const NX = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const BCO = "https://bxhjgxzvayszfqwlwinq.supabase.co", BCO_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const HUELLAS = { barracas: "561e17712ad3ead64d53ea5f861f1d2201ddebc8e394555a015a243d66023c41", finanzas: "10a3995de887f9aa2f89ee538fb63801c31650bc07fef021ecaa5a259007bcb5", seguimiento: "995743aaa829744b3f4b9a52420fb7e684b63641f14f62fe7c606d7edcad3423", contratistas: "6b8988264c0ca1cacf2489c817a62e662de4982b3ba24cad5d14624cddf7ab74" };
const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const pesos = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-AR");
const fl = (t) => { if (!t) return ""; if (typeof t === "string" && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(8, 10) + "/" + t.slice(5, 7) + "/" + t.slice(0, 4); const d = new Date(Number(t) - 108e5); return isNaN(d) ? String(t) : String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear(); };
const ts = (v) => { if (!v) return 0; if (typeof v === "number") return v; const p = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + "T12:00:00-03:00" : v); return isNaN(p) ? 0 : p; };
const corta = (s, n) => { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) + "…" : s; };
const sinB64 = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === "string" && /^data:/.test(x) ? "[imagen]" : x)));
const EST = { avanza: "se puede avanzar", material: "falta material", definicion: "falta definición", otro: "otro motivo", terminado: "terminado" };

let H = null;
async function filas(filtro) { const r = await fetch(`${NX}/rest/v1/nexo2_estado?select=clave,valor&limit=3000&${filtro}`, { headers: H }); if (!r.ok) throw new Error("No pude leer la base (" + r.status + ")"); return r.json(); }
async function leer(clave) { const x = await filas("clave=eq." + encodeURIComponent(clave)); return x[0] ? x[0].valor : null; }
async function bco(key) { const r = await fetch(`${BCO}/rest/v1/bco_storage?key=eq.${encodeURIComponent(key)}&select=value&limit=1`, { headers: { apikey: BCO_KEY, Authorization: "Bearer " + BCO_KEY } }); if (!r.ok) throw new Error("No pude leer (" + r.status + ")"); const d = await r.json(); return d[0] ? d[0].value : null; }
const items = async (clave) => { const v = await leer(clave); return (v && Array.isArray(v.items) && v.items) || []; };

// usa la vista que ya arma el enlace privado de auditorías (misma clave interna que ChatGPT)
async function vistaAuditoria(q) {
  let c = await leer("codigos"); if (c && typeof c.v === "string") { try { c = JSON.parse(c.v); } catch { c = null; } }
  const dir = (c && c.dir) || process.env.NEXO_DIR_CODE || process.env.NEXO2_DIR_CODE || ""; const rev = Number(((await leer("asist_cfg")) || {}).rev) || 0;
  const k = crypto.createHmac("sha256", String(dir).toUpperCase().replace(/[^A-Z0-9]/g, "")).update("asistente-auditorias-" + rev).digest("hex").slice(0, 40);
  let out = ""; const res = { setHeader() { return this; }, status() { return this; }, send(x) { out = String(x); }, json(x) { out = JSON.stringify(x); }, end() { } };
  await auditoria({ method: "GET", query: { ...q, k }, headers: { host: "nexoentorno.vercel.app" } }, res); return out;
}

/* ---------------- BARRACAS ---------------- */
async function docBarracas() { const v = await leer("barracas_db"); if (!v || !v.v) throw new Error("Barracas todavía no está en la nube"); return JSON.parse(v.v); }
const visTxt = (v) => ({ fecha: fl(v.f), lugar: v.lugar, presentes: v.pres, notas: corta(v.notas, 3000), demoliciones: corta(v.dem, 1500), construccion: corta(v.cons, 1500), tecnico: corta(v.tec, 1500), tareas: corta(v.tar, 1500), audios: (v.aud || []).map((a) => corta(a.tx, 1500)).filter(Boolean), fotos: (v.fotos || []).map((f) => ({ link: f.u, tipo: ({ d: "Se demuele", m: "Se mantiene", n: "No va / se retira", t: "Técnico", o: "Otro" })[f.tag] || "Otro", descripcion: f.n || "" })).filter((f) => /^https:/.test(f.link || "")), videos: (v.videos || []).map((x) => ({ link: x.u || (x.partes && x.partes[0]), partes: (x.partes || []).length || undefined, descripcion: x.n || "" })).filter((x) => /^https:/.test(x.link || "")), informe: v.inf && v.inf.b ? corta(typeof v.inf.b === "string" ? v.inf.b : JSON.stringify(v.inf.b), 3000) : "" });
const BARRACAS = {
  tools: [
    { name: "resumen_costos", description: "Costos de la obra de Barracas (Correo Argentino, Sucursal N°10 Herrera): presupuesto por rubro, compras, mano de obra, pagos y totales.", inputSchema: { type: "object", properties: {} } },
    { name: "visitas", description: "Visitas de obra de Barracas: fecha, presentes, notas, demoliciones, construcción, técnico, tareas, lo dicho en los audios y las fotos.", inputSchema: { type: "object", properties: { cantidad: { type: "number", description: "Cuántas (las más recientes primero), por defecto 3" } } } },
    { name: "buscar", description: "Busca una palabra en todos los datos de Barracas.", inputSchema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] } },
  ],
  async run(n, a) {
    if (n === "resumen_costos") return corta(await vistaAuditoria({ costos: "barracas" }), 60000);
    const d = await docBarracas();
    if (n === "visitas") { const V = (d.obras || []).flatMap((o) => o.vis || []).sort((p, q) => String(q.f).localeCompare(String(p.f))); return JSON.stringify({ total: V.length, visitas: V.slice(0, Math.min(10, Number(a.cantidad) || 3)).map(visTxt) }); }
    if (n === "buscar") return buscarEn(sinB64(d), a.texto);
  },
};

/* ---------------- FINANZAS CLIENTE ---------------- */
const FINANZAS = {
  tools: [
    { name: "resumen", description: "Resumen financiero de V+V Construcciones (Finanzas cliente): facturado, costo directo, imprevistos, gastos, cobros, pagos, resultado por obra y total. Información privada de Sebastián.", inputSchema: { type: "object", properties: {} } },
    { name: "certificados", description: "Certificados cargados, los más recientes primero, con su número, fecha de pago, avance acumulado, monto del período, redeterminación, total, descuento de anticipo, neto a cobrar, costo y margen (misma cuenta que la app).", inputSchema: { type: "object", properties: { obra: { type: "string" }, cantidad: { type: "number" } } } },
    { name: "movimientos", description: "Cobros, pagos y gastos cargados en Finanzas (los más recientes primero).", inputSchema: { type: "object", properties: { tipo: { type: "string", enum: ["cobro", "pago", "gasto"] }, cantidad: { type: "number" } } } },
  ],
  async run(n, a) {
    if (n === "resumen") { const r = await bco("vv_finanzas_resumen"); if (r) return corta(r, 60000); }
    const raw = await bco("vv_finanzas"); if (!raw) return "Todavía no hay datos de Finanzas en la nube."; const d = JSON.parse(raw);
    const obra = (id) => ((d.obras || []).find((o) => o.id === id) || {}).nombre || id;
    if (n === "resumen") return JSON.stringify(sinB64({ obras: (d.obras || []).map((o) => o.nombre), certificados: (d.certs || []).length }));
    if (n === "certificados") {
      // montos calculados con la misma cuenta que la app (avance del período, redeterminación, anticipo, costo y margen)
      let C = (d.certs || []).slice().sort((p, q) => String(q.fecha).localeCompare(String(p.fecha)) || (q.ts || 0) - (p.ts || 0)); if (a.obra) C = C.filter((c) => nrm(obra(c.obraId)).includes(nrm(a.obra)));
      const cac = d.cacMensual || {}, de = (id) => (d.certs || []).filter((c) => c.obraId === id).sort((p, q) => (p.fecha < q.fecha ? -1 : p.fecha > q.fecha ? 1 : (p.ts || 0) - (q.ts || 0)));
      return JSON.stringify(C.slice(0, Math.min(60, Number(a.cantidad) || 20)).map((c) => { const o = (d.obras || []).find((x) => x.id === c.obraId); const L = de(c.obraId), nro = L.findIndex((x) => x.id === c.id) + 1; let r = null; try { r = o ? calcCert(c, o, L, cac) : null; } catch { }
        return { obra: obra(c.obraId), certificado_n: nro, fecha: fl(c.fecha), fecha_de_pago: fl(c.fechaPago), avance_acumulado: r ? Math.round(r.avanceAcum) + "%" : "", monto_del_periodo: r ? pesos(r.bruto) : "", redeterminacion: r ? pesos(r.ajuste) + (r.provisorio ? " (provisoria)" : "") : "", total_certificado: r ? pesos(r.ajustado) : "", descuento_anticipo: r && r.amort ? pesos(r.amort) : "", neto_a_cobrar: r ? pesos(r.neto) : "", costo_de_obra_del_periodo: r ? pesos(r.costo) : "", margen: r ? pesos(r.margen) + " (" + Math.round(r.margenPct) + "%)" : "", fotos: (c.adjuntos || []).length }; }));
    }
    if (n === "movimientos") { let M = [...(d.movimientos || []).map((m) => ({ ...m, clase: m.tipo })), ...(d.gastos || []).map((g) => ({ ...g, clase: "gasto" }))]; if (a.tipo) M = M.filter((m) => m.clase === a.tipo); M.sort((p, q) => ts(q.fecha) - ts(p.fecha) || (q.ts || 0) - (p.ts || 0)); return JSON.stringify(M.slice(0, Math.min(80, Number(a.cantidad) || 30)).map((m) => sinB64({ ...m, obra: m.obraId ? obra(m.obraId) : m.obra }))); }
  },
};

/* ---------------- SEGUIMIENTO V+V ---------------- */
const SEGUIMIENTO = {
  tools: [
    { name: "novedades", description: "Lo último del Seguimiento V+V (Sebastián y Nicolás): registros y retrasos, hitos, adicionales, gastos y visitas de los últimos días.", inputSchema: { type: "object", properties: { dias: { type: "number", description: "Por defecto 3" } } } },
    { name: "obras", description: "Obras del Seguimiento con etapa, capataz, nota, personal asignado y próximos hitos.", inputSchema: { type: "object", properties: {} } },
    { name: "tareas", description: "Tareas pendientes o en curso (con responsable, prioridad y fechas).", inputSchema: { type: "object", properties: { todas: { type: "boolean", description: "true para incluir las terminadas" } } } },
    { name: "agenda", description: "Agenda de visitas (quién va, dónde, motivo), próximas y recientes.", inputSchema: { type: "object", properties: { dias: { type: "number", description: "Por defecto 14 para adelante" } } } },
    { name: "buscar", description: "Busca una palabra en todo el Seguimiento.", inputSchema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] } },
  ],
  async run(n, a) {
    const O = await items("seg_obras"); const nom = (id) => (O.find((o) => o.id === id) || {}).nombre || "";
    if (n === "novedades") { const d0 = Date.now() - Math.max(1, Math.min(30, Number(a.dias) || 3)) * 864e5; const en = (...t) => t.some((x) => ts(x) >= d0);
      const [R, Hi, Ad, G, Ag] = await Promise.all(["registros", "hitos", "adicionales", "gastos", "agenda"].map((c) => items("seg_" + c))); const out = [];
      R.filter((r) => en(r.fecha, r.creado, r.editado)).forEach((r) => out.push({ t: ts(r.fecha || r.creado), obra: nom(r.obra), que: (r.tipo === "retraso" ? "Retraso: " : "Registro: ") + r.titulo + (r.causa ? " (" + r.causa + ")" : "") + (r.dias ? " · " + r.dias + " días" : "") + (r.costo ? " · " + pesos(r.costo) : "") + (r.desc ? " — " + corta(r.desc, 400) : "") }));
      Hi.filter((h) => en(h.fecha, h.creado, h.editado)).forEach((h) => out.push({ t: ts(h.fecha), obra: nom(h.obra), que: "Hito " + (h.hecho ? "hecho" : "previsto") + ": " + h.titulo }));
      Ad.filter((x) => en(x.fecha, x.creado, x.editado)).forEach((x) => out.push({ t: ts(x.fecha), obra: nom(x.obra), que: "Adicional: " + x.titulo + " " + pesos(x.monto) + " (" + x.estado + ")" }));
      G.filter((g) => en(g.fecha, g.creado)).forEach((g) => out.push({ t: ts(g.fecha), obra: nom(g.obra), que: "Gasto: " + g.concepto + " " + pesos(g.monto) + " (" + g.de + ")" }));
      Ag.filter((v) => en(v.fecha, v.creado, v.editado)).forEach((v) => out.push({ t: ts(v.fecha), obra: nom(v.obra), que: "Visita " + (v.hecho ? "hecha" : "agendada") + ": " + v.quien + " a " + (v.lugar || nom(v.obra)) + (v.motivo ? " — " + corta(v.motivo, 200) : "") }));
      out.sort((p, q) => q.t - p.t); return JSON.stringify({ novedades: out.slice(0, 80).map((x) => ({ fecha: fl(x.t), obra: x.obra, que: x.que })) }); }
    if (n === "obras") { const [P, Hi] = await Promise.all([items("seg_personal"), items("seg_hitos")]); return JSON.stringify(O.map((o) => ({ obra: o.nombre, etapa: o.etapa, capataz: o.capataz, nota: o.nota, personal: P.filter((p) => p.obra === o.id && p.activo !== false).map((p) => p.nombre + (p.rol ? " (" + p.rol + ")" : "") + (p.haciendo ? ": " + p.haciendo : "")), proximos_hitos: Hi.filter((h) => h.obra === o.id && !h.hecho).sort((p, q) => (p.fecha || 0) - (q.fecha || 0)).slice(0, 5).map((h) => fl(h.fecha) + " " + h.titulo) }))); }
    if (n === "tareas") { const T = (await items("seg_tareas")).filter((t) => a.todas || !/^(ok|hecha|terminada|fin)/i.test(t.estado || "")); return JSON.stringify(T.sort((p, q) => (p.fin || 9e15) - (q.fin || 9e15)).slice(0, 80).map((t) => ({ titulo: t.titulo, ambito: t.ambito, estado: t.estado, resp: t.resp, prioridad: t.prio, inicio: fl(t.inicio), fin: fl(t.fin), nota: corta(t.nota, 300) }))); }
    if (n === "agenda") { const A = await items("seg_agenda"), d0 = Date.now() - 3 * 864e5, d1 = Date.now() + (Number(a.dias) || 14) * 864e5; return JSON.stringify(A.filter((v) => v.fecha >= d0 && v.fecha <= d1).sort((p, q) => p.fecha - q.fecha).map((v) => ({ fecha: fl(v.fecha), quien: v.quien, lugar: v.lugar || nom(v.obra), motivo: v.motivo, hecho: v.hecho }))); }
    if (n === "buscar") { const R = await filas("clave=like.seg_*"); return buscarEn(R.filter((r) => !/^seg_(cfg|flags)$/.test(r.clave)).map((r) => ({ seccion: r.clave, ...r.valor })), a.texto); }
  },
};

/* ---------------- CONTRATISTAS ---------------- */
async function obrasNombres() { const S = await filas("clave=like.snap_*"); const m = {}; S.forEach((s) => (m[String(s.clave).slice(5)] = (s.valor && s.valor.nombre) || "")); return m; }
const audTxt = (a) => a ? `Personal: ${a.personal || 0}${a.ociosos ? " (" + a.ociosos + " sin tarea)" : ""}. ` + (a.items || []).map((i) => `${i.n ? i.n + ". " : ""}${i.tarea}: ${EST[i.est] || i.est}${i.est === "avanza" && (i.gente || i.fin) ? " (" + (i.gente || "?") + " personas, termina " + fl(i.fin) + ")" : ""}${i.falta ? " — falta " + i.falta : ""}${i.nota ? " — " + i.nota : ""}`).join("; ") + (a.concl ? ". Conclusión: " + a.concl : "") + (a.inf ? " (respuesta al informe " + (a.inf.semana || "") + ")" : "") : "";
const CONTRATISTAS = {
  tools: [
    { name: "contratistas", description: "Lista de contratistas dados de alta (empresa, rubro y obras), sin códigos de acceso.", inputSchema: { type: "object", properties: {} } },
    { name: "reclamos", description: "Reclamos, presupuestos, listados de materiales y auditorías que mandaron los contratistas, con estado y si Dirección respondió. Filtros por contratista, obra o solo sin respuesta.", inputSchema: { type: "object", properties: { contratista: { type: "string" }, obra: { type: "string" }, solo_sin_respuesta: { type: "boolean" }, dias: { type: "number", description: "Solo los de los últimos N días" }, cantidad: { type: "number" } } } },
    { name: "reclamo", description: "Detalle completo de un reclamo o auditoría por número (ej 0004): pedido por pedido, historial y respuestas.", inputSchema: { type: "object", properties: { num: { type: "string" } }, required: ["num"] } },
  ],
  async run(n, a) {
    const [reg, R, ON] = await Promise.all([leer("ctcods"), filas("clave=like.ctrec_*"), obrasNombres()]);
    const L = (reg && reg.items) || [];
    if (n === "contratistas") { const por = {}; L.forEach((c) => { const k = nrm(c.nombre); (por[k] = por[k] || { empresa: c.nombre, rubro: c.rubro, obras: [] }).obras.push(c.obraNombre || ON[c.obra] || c.obra); }); return JSON.stringify(Object.values(por)); }
    let X = R.flatMap((r) => ((r.valor && r.valor.items) || []).map((x) => ({ ...x, obraN: x.obraNombre || ON[x.obra || String(r.clave).slice(6)] || x.obra }))).sort((p, q) => (q.creado || 0) - (p.creado || 0));
    const resp = (x) => (x.hist || []).some((h) => h.por === "dir");
    if (n === "reclamo") { const x = X.find((y) => nrm(y.num) === nrm(a.num) || String(Number(y.num)) === String(Number(a.num))); if (!x) return "No encontré ese número."; return JSON.stringify({ num: x.num, obra: x.obraN, contratista: x.ctNombre, rubro: x.rubro, tipo: x.tipo, titulo: x.titulo, estado: x.estado, fecha: fl(x.creado), detalle: x.tipo === "auditoria" ? audTxt(x.aud) : corta(x.desc, 3000), monto: x.monto ? pesos(x.monto) : undefined, fotos: (x.fotos || []).length, historial: (x.hist || []).map((h) => fl(h.t) + " " + (h.por === "dir" ? "Dirección" : h.nom || "Contratista") + ": " + corta(h.tx, 500)) }); }
    if (a.contratista) X = X.filter((x) => nrm(x.ctNombre).includes(nrm(a.contratista)));
    if (a.obra) X = X.filter((x) => nrm(x.obraN).includes(nrm(a.obra)));
    if (a.dias) X = X.filter((x) => (x.creado || 0) >= Date.now() - Number(a.dias) * 864e5);
    if (a.solo_sin_respuesta) X = X.filter((x) => !resp(x) && !/resuelto|cerrado/.test(x.estado || ""));
    return JSON.stringify({ cantidad: X.length, items: X.slice(0, Math.min(60, Number(a.cantidad) || 20)).map((x) => ({ num: x.num, fecha: fl(x.creado), obra: x.obraN, contratista: x.ctNombre, tipo: x.tipo, titulo: x.titulo, estado: x.estado, respondido: resp(x), resumen: x.tipo === "auditoria" ? corta(audTxt(x.aud), 600) : corta(x.desc, 300) })) });
  },
};

function buscarEn(data, texto) {
  const b = nrm(texto); if (b.length < 3) return "Decime al menos 3 letras."; const hits = [];
  const rec = (v, camino) => { if (hits.length >= 25 || v == null) return; if (Array.isArray(v)) { v.forEach((x, i) => rec(x, camino)); return; } if (typeof v === "object") { const t = JSON.stringify(v); if (t.length < 1500 && nrm(t).includes(b)) { hits.push({ donde: camino, dato: t }); return; } Object.entries(v).forEach(([k, x]) => rec(x, camino ? camino + "." + k : k)); return; } if (nrm(v).includes(b)) hits.push({ donde: camino, dato: corta(v, 600) }); };
  rec(data, ""); return JSON.stringify({ busqueda: texto, resultados: hits });
}

const APPS = { barracas: { ...BARRACAS, nombre: "Barracas" }, finanzas: { ...FINANZAS, nombre: "Finanzas cliente" }, seguimiento: { ...SEGUIMIENTO, nombre: "Seguimiento V+V" }, contratistas: { ...CONTRATISTAS, nombre: "Contratistas" } };
// para MiAsistente (api/asistente-apps.js): misma consulta, sin pasar por el protocolo MCP
export async function correrApp(app, name, args) {
  const A = APPS[app]; if (!A || !A.tools.some((t) => t.name === name)) throw new Error("Consulta desconocida");
  const sk = process.env.SUPABASE_SERVICE_KEY; H = { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
  return A.run(name, args || {});
}
export const CATALOGO = Object.fromEntries(Object.entries(APPS).map(([k, A]) => [k, A.tools.map((t) => ({ name: t.name, description: t.description, args: Object.keys((t.inputSchema && t.inputSchema.properties) || {}) }))]));
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
async function rpc(m, A) {
  const id = m.id ?? null;
  if (m.method === "initialize") return ok(id, { protocolVersion: (m.params && m.params.protocolVersion) || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: A.nombre, version: "1.0.0" }, instructions: `Datos reales de la app ${A.nombre} de Sebastián (V+V Construcciones, Argentina). Suele preguntar manejando: contestá corto y hablado, montos sin decimales con separador de miles. Solo lectura.` });
  if (m.method === "ping") return ok(id, {});
  if (m.method === "tools/list") return ok(id, { tools: A.tools });
  if (m.method === "tools/call") { const p = m.params || {}; try { if (!A.tools.some((t) => t.name === p.name)) throw new Error("Herramienta desconocida"); const tx = await A.run(p.name, p.arguments || {}); return ok(id, { content: [{ type: "text", text: tx || "Sin datos." }] }); } catch (e) { return ok(id, { content: [{ type: "text", text: "No se pudo: " + (e.message || "error") }], isError: true }); } }
  if (m.method === "resources/list") return ok(id, { resources: [] });
  if (m.method === "prompts/list") return ok(id, { prompts: [] });
  if (String(m.method || "").startsWith("notifications/")) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Método no soportado" } };
}
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version"); res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  const app = String((req.query && req.query.app) || ""), k = String((req.query && req.query.k) || ""), A = APPS[app];
  const h = crypto.createHash("sha256").update(app + ":" + k).digest("hex");
  if (!A || !k || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(HUELLAS[app]))) { res.status(401).json({ error: "Link inválido" }); return; }
  if (req.method === "GET") { res.setHeader("Allow", "POST"); res.status(405).end(); return; }
  if (req.method === "DELETE") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }
  const sk = process.env.SUPABASE_SERVICE_KEY; if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY" }); return; }
  H = { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { res.status(400).json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }); return; } }
  const lote = Array.isArray(b) ? b : [b]; const out = (await Promise.all(lote.map((m) => rpc(m, A)))).filter(Boolean);
  if (!out.length) { res.status(202).end(); return; }
  res.setHeader("Content-Type", "application/json"); res.status(200).json(Array.isArray(b) ? out : out[0]);
}
