// Conector de MiAsistente para Claude (servidor MCP, "Streamable HTTP" sin sesión).
// Sebastián le habla a Claude (app o voz) y Claude lee y carga gastos, pagos y agenda directo en MiAsistente.
// Los datos son los mismos que usa la app: tabla bco_storage (claves sebastian_gastos, sebastian_pagos, sebastian_agenda).
// Acceso: el link lleva una clave; acá solo se guarda su huella (SHA-256), nunca la clave.
import crypto from "crypto";

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const HUELLA = "551314a31ab8f0d077397648795606f55fc19b5d240499ed68bd72d86a179e26";
const SH = { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY };

async function leer(key) {
  const r = await fetch(`${SUPA_URL}/rest/v1/bco_storage?key=eq.${encodeURIComponent(key)}&select=value&limit=1`, { headers: SH });
  if (!r.ok) throw new Error("No pude leer MiAsistente (" + r.status + ")");
  const d = await r.json(); if (!d.length || !d[0].value) return [];
  try { const v = JSON.parse(d[0].value); return Array.isArray(v) ? v : []; } catch { return []; }
}
async function guardar(key, arr) {
  const r = await fetch(`${SUPA_URL}/rest/v1/bco_storage`, { method: "POST", headers: { ...SH, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key, value: JSON.stringify(arr) }) });
  if (!r.ok) throw new Error("No pude guardar en MiAsistente (" + r.status + ")");
}
async function registrar(tx) {
  try { const L = await leer("miasistente_conector_log"); L.unshift({ t: Date.now(), tx }); await guardar("miasistente_conector_log", L.slice(0, 300)); } catch { }
}

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now();
const ar = () => new Date(Date.now() - 3 * 3600e3);
const hoyStr = () => { const d = ar(); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear()).slice(2)}`; };
// acepta "17/11/26", "17/11", "2026-11-17", "hoy", "mañana", "pasado mañana"
function fecha(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s || s === "hoy") return hoyStr();
  const suma = (n) => { const d = new Date(ar().getTime() + n * 864e5); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear()).slice(2)}`; };
  if (s === "mañana" || s === "manana") return suma(1);
  if (s.startsWith("pasado")) return suma(2);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[3].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[1].slice(2)}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/); if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3] ? m[3].slice(-2) : String(ar().getUTCFullYear()).slice(2)}`;
  return String(v);
}
const orden = (f, h) => { const p = String(f || "").split("/").map(Number); if (!p[0] || !p[1]) return 9e15; const y = p[2] ? (p[2] < 100 ? 2000 + p[2] : p[2]) : ar().getUTCFullYear(); const [hh, mm] = String(h || "").split(":").map(Number); return Date.UTC(y, p[1] - 1, p[0], hh || 0, mm || 0); };
function monto(v) { if (typeof v === "number") return isFinite(v) ? Math.round(v) : 0; let t = String(v ?? "").toLowerCase().trim(); let mult = 1; if (/luca|mil|k\b/.test(t)) mult = 1000; if (/palo|mill/.test(t)) mult = 1e6; t = t.replace(/[^\d.,]/g, ""); if (!t) return 0; if (t.includes(",")) t = t.replace(/\./g, "").replace(",", "."); else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); const n = Number(t) * mult; return isFinite(n) ? Math.round(n) : 0; }
const pesos = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");

const TOOLS = [
  { name: "resumen", description: "Resumen de MiAsistente de Sebastián: agenda de hoy y de los próximos días, pagos pendientes y gastos del mes. Usalo cuando pregunte cómo viene, qué tiene hoy o qué debe.", inputSchema: { type: "object", properties: {} } },
  { name: "cargar_gasto", description: "Carga uno o varios gastos del día a día en la solapa Gastos de MiAsistente (concepto + monto en pesos). Si dice varios juntos, mandalos todos en la lista.", inputSchema: { type: "object", properties: { gastos: { type: "array", items: { type: "object", properties: { concepto: { type: "string", description: "En qué gastó, ej: Nafta" }, monto: { type: "number", description: "Monto en pesos, sin separadores (50 lucas = 50000)" }, fecha: { type: "string", description: "DD/MM/AA, AAAA-MM-DD, 'hoy' o 'mañana'. Si no la dice, hoy" } }, required: ["concepto", "monto"] } } }, required: ["gastos"] } },
  { name: "cargar_pago", description: "Registra un pago en la solapa Pagos de MiAsistente (a una persona, por ejemplo un oficial o proveedor de una obra).", inputSchema: { type: "object", properties: { persona: { type: "string" }, monto: { type: "number", description: "En pesos, sin separadores" }, obra: { type: "string", description: "Obra, si la nombra" }, estado: { type: "string", enum: ["pagado", "pendiente"], description: "pagado si ya lo pagó; pendiente si lo tiene que pagar" }, metodo: { type: "string", description: "efectivo, transferencia…" }, nota: { type: "string" }, fecha: { type: "string" } }, required: ["persona", "monto"] } },
  { name: "agendar", description: "Agrega un evento o un recordatorio de pago a la Agenda de MiAsistente (le llega el aviso como a los demás).", inputSchema: { type: "object", properties: { titulo: { type: "string", description: "Qué es; si es un pago, a quién pagarle" }, fecha: { type: "string", description: "DD/MM/AA, AAAA-MM-DD, 'hoy' o 'mañana'" }, hora: { type: "string", description: "HH:MM (opcional)" }, nota: { type: "string" }, es_pago: { type: "boolean", description: "true si es un pago a realizar" }, monto: { type: "number", description: "Monto si es pago" } }, required: ["titulo", "fecha"] } },
  { name: "ver_gastos", description: "Lista los gastos cargados (los más recientes primero) con su total.", inputSchema: { type: "object", properties: { cantidad: { type: "number", description: "Cuántos traer (por defecto 30)" }, mes: { type: "string", description: "MM/AA para filtrar un mes, ej 11/26" } } } },
  { name: "ver_pagos", description: "Lista los pagos (los más recientes primero), con filtro opcional por estado u obra.", inputSchema: { type: "object", properties: { estado: { type: "string", enum: ["pagado", "pendiente"] }, obra: { type: "string" }, cantidad: { type: "number" } } } },
  { name: "ver_agenda", description: "Muestra la agenda desde hoy (o desde la fecha que diga) por la cantidad de días pedida.", inputSchema: { type: "object", properties: { desde: { type: "string" }, dias: { type: "number", description: "Por defecto 7" } } } },
  { name: "marcar_pagado", description: "Marca como pagado un pago pendiente (usá el id que devuelve ver_pagos).", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "borrar", description: "Borra un gasto, pago o evento cargado por error. Solo si Sebastián lo pide claramente. Usá el id que devuelven ver_gastos / ver_pagos / ver_agenda.", inputSchema: { type: "object", properties: { que: { type: "string", enum: ["gasto", "pago", "evento"] }, id: { type: "string" } }, required: ["que", "id"] } },
];

async function ejecutar(name, a) {
  a = a || {};
  if (name === "cargar_gasto") {
    const lista = (Array.isArray(a.gastos) ? a.gastos : [a]).filter((x) => x && (x.concepto || x.monto != null));
    if (!lista.length) throw new Error("Decime concepto y monto");
    const G = await leer("sebastian_gastos");
    const nuevos = lista.map((x) => ({ id: uid() + Math.floor(Math.random() * 9999), concepto: String(x.concepto || "Gasto").slice(0, 120), monto: monto(x.monto), fecha: fecha(x.fecha), ts: Date.now() }));
    await guardar("sebastian_gastos", [...nuevos, ...G]);
    const tot = nuevos.reduce((s, g) => s + g.monto, 0);
    await registrar("Gasto: " + nuevos.map((g) => g.concepto + " " + pesos(g.monto)).join(", "));
    return `Cargué ${nuevos.length} gasto${nuevos.length > 1 ? "s" : ""} en MiAsistente (total ${pesos(tot)}): ${nuevos.map((g) => g.concepto + " " + pesos(g.monto) + " (" + g.fecha + ")").join("; ")}.`;
  }
  if (name === "cargar_pago") {
    const [P, O] = await Promise.all([leer("sebastian_pagos"), leer("vv_obras")]);
    const ob = a.obra ? O.find((o) => String(o.nombre || "").toLowerCase().includes(String(a.obra).toLowerCase())) : null;
    const p = { id: uid(), persona: String(a.persona || "").slice(0, 120), monto: monto(a.monto), obra: (ob && ob.nombre) || a.obra || "", obra_id: (ob && ob.id) || "", estado: String(a.estado || "pendiente").toLowerCase().includes("pag") ? "pagado" : "pendiente", metodo: a.metodo || "", nota: a.nota || "", fecha: fecha(a.fecha), ts: Date.now() };
    await guardar("sebastian_pagos", [p, ...P]);
    await registrar("Pago: " + p.persona + " " + pesos(p.monto) + " " + p.estado);
    return `Pago cargado en MiAsistente: ${p.persona} · ${pesos(p.monto)}${p.obra ? " · " + p.obra : ""} · ${p.estado}${p.metodo ? " · " + p.metodo : ""} (${p.fecha}).`;
  }
  if (name === "agendar") {
    const A = await leer("sebastian_agenda");
    const esPago = !!a.es_pago;
    const ev = { id: uid(), fecha: fecha(a.fecha), hora: a.hora || "", titulo: String(a.titulo || "Evento").slice(0, 160), nota: a.nota || "", tipo: esPago ? "pago" : "evento", ...(esPago ? { monto: monto(a.monto) } : {}), ts: Date.now() };
    const N = [...A, ev].sort((x, y) => orden(x.fecha, x.hora) - orden(y.fecha, y.hora));
    await guardar("sebastian_agenda", N);
    await registrar("Agenda: " + ev.titulo + " " + ev.fecha);
    return esPago ? `Anoté en la agenda el pago a ${ev.titulo}${ev.monto ? " de " + pesos(ev.monto) : ""} para el ${ev.fecha}.` : `Agendado: ${ev.titulo} el ${ev.fecha}${ev.hora ? " a las " + ev.hora : ""}.`;
  }
  if (name === "ver_gastos") {
    let G = await leer("sebastian_gastos"); if (a.mes) G = G.filter((g) => String(g.fecha || "").slice(3) === String(a.mes).trim());
    const L = G.slice(0, Math.min(200, a.cantidad || 30));
    return JSON.stringify({ total: pesos(G.reduce((s, g) => s + (Number(g.monto) || 0), 0)), cantidad: G.length, gastos: L.map((g) => ({ id: g.id, fecha: g.fecha, concepto: g.concepto, monto: g.monto })) });
  }
  if (name === "ver_pagos") {
    let P = await leer("sebastian_pagos");
    if (a.estado) P = P.filter((p) => p.estado === a.estado);
    if (a.obra) P = P.filter((p) => String(p.obra || "").toLowerCase().includes(String(a.obra).toLowerCase()));
    return JSON.stringify({ total: pesos(P.reduce((s, p) => s + (Number(p.monto) || 0), 0)), cantidad: P.length, pagos: P.slice(0, Math.min(200, a.cantidad || 30)).map((p) => ({ id: p.id, fecha: p.fecha, persona: p.persona, monto: p.monto, obra: p.obra, estado: p.estado, metodo: p.metodo, nota: p.nota })) });
  }
  if (name === "ver_agenda") {
    const A = await leer("sebastian_agenda"); const d0 = orden(fecha(a.desde)) , d1 = d0 + (a.dias || 7) * 864e5;
    return JSON.stringify({ desde: fecha(a.desde), eventos: A.filter((e) => { const o = orden(e.fecha); return o >= d0 && o < d1; }).map((e) => ({ id: e.id, fecha: e.fecha, hora: e.hora, titulo: e.titulo, tipo: e.tipo, monto: e.monto, nota: e.nota })) });
  }
  if (name === "marcar_pagado") {
    const P = await leer("sebastian_pagos"); const p = P.find((x) => String(x.id) === String(a.id)); if (!p) throw new Error("No encontré ese pago");
    p.estado = "pagado"; p.ts = Date.now(); await guardar("sebastian_pagos", P); await registrar("Pagado: " + p.persona);
    return `Listo: el pago a ${p.persona} de ${pesos(p.monto)} quedó como pagado.`;
  }
  if (name === "borrar") {
    const key = { gasto: "sebastian_gastos", pago: "sebastian_pagos", evento: "sebastian_agenda" }[a.que]; if (!key) throw new Error("Decime si es gasto, pago o evento");
    const L = await leer(key); const x = L.find((y) => String(y.id) === String(a.id)); if (!x) throw new Error("No lo encontré");
    await guardar("miasistente_conector_papelera", [{ t: Date.now(), key, x }, ...(await leer("miasistente_conector_papelera"))].slice(0, 100));
    await guardar(key, L.filter((y) => String(y.id) !== String(a.id))); await registrar("Borrado " + a.que + ": " + (x.concepto || x.persona || x.titulo));
    return `Borré el ${a.que}: ${x.concepto || x.persona || x.titulo}.`;
  }
  if (name === "resumen") {
    const [A, P, G] = await Promise.all([leer("sebastian_agenda"), leer("sebastian_pagos"), leer("sebastian_gastos")]);
    const h = orden(hoyStr()), mes = hoyStr().slice(3);
    const pend = P.filter((p) => p.estado === "pendiente"), gm = G.filter((g) => String(g.fecha || "").slice(3) === mes);
    return JSON.stringify({ hoy: hoyStr(), agenda_hoy: A.filter((e) => orden(e.fecha) === h).map((e) => (e.hora ? e.hora + " " : "") + e.titulo + (e.tipo === "pago" ? " (pago " + pesos(e.monto) + ")" : "")), proximos_7_dias: A.filter((e) => { const o = orden(e.fecha); return o > h && o < h + 7 * 864e5; }).map((e) => e.fecha + " " + (e.hora || "") + " " + e.titulo), pagos_pendientes: { cantidad: pend.length, total: pesos(pend.reduce((s, p) => s + (Number(p.monto) || 0), 0)), detalle: pend.slice(0, 15).map((p) => p.persona + " " + pesos(p.monto) + (p.obra ? " (" + p.obra + ")" : "")) }, gastos_del_mes: { cantidad: gm.length, total: pesos(gm.reduce((s, g) => s + (Number(g.monto) || 0), 0)) } });
  }
  throw new Error("Herramienta desconocida: " + name);
}

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const mal = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
async function rpc(m) {
  const id = m.id ?? null;
  if (m.method === "initialize") return ok(id, { protocolVersion: (m.params && m.params.protocolVersion) || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "MiAsistente", version: "1.0.0" }, instructions: "Datos reales de MiAsistente de Sebastián (V+V Construcciones, Argentina). Montos en pesos sin decimales. Cargá lo que te pide y confirmale en una oración lo que quedó cargado." });
  if (m.method === "ping") return ok(id, {});
  if (m.method === "tools/list") return ok(id, { tools: TOOLS });
  if (m.method === "tools/call") {
    const p = m.params || {};
    try { const tx = await ejecutar(p.name, p.arguments); return ok(id, { content: [{ type: "text", text: tx }] }); }
    catch (e) { return ok(id, { content: [{ type: "text", text: "No se pudo: " + (e.message || "error") }], isError: true }); }
  }
  if (m.method === "resources/list") return ok(id, { resources: [] });
  if (m.method === "prompts/list") return ok(id, { prompts: [] });
  if (String(m.method || "").startsWith("notifications/")) return null;
  return mal(id, -32601, "Método no soportado");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  const k = String((req.query && req.query.k) || "");
  const h = crypto.createHash("sha256").update("miasistente:" + k).digest("hex");
  if (!k || h.length !== HUELLA.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(HUELLA))) { res.status(401).json({ error: "Link inválido" }); return; }
  if (req.method === "GET") { res.status(405).setHeader("Allow", "POST").end(); return; }
  if (req.method === "DELETE") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { res.status(400).json(mal(null, -32700, "JSON inválido")); return; } }
  const lote = Array.isArray(b) ? b : [b];
  const out = (await Promise.all(lote.map(rpc))).filter(Boolean);
  if (!out.length) { res.status(202).end(); return; }
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(Array.isArray(b) ? out : out[0]);
}
