// Conector de WhatsApp para Claude (servidor MCP, "Streamable HTTP" sin sesión).
// Usa la API oficial de WhatsApp Business (Cloud API de Meta) de la app "V+V".
// Secretos: WA_TOKEN (token permanente del usuario del sistema) y WA_PHONE_ID viven en las variables de Vercel, nunca acá.
// Acceso: el link lleva una clave; acá solo se guarda su huella (SHA-256).
import crypto from "crypto";

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const HUELLA = "37666409523ee0322fecea16b8b8a838ac0c61b62b031570706fba297b331254";
const SH = { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY };
const GRAPH = "https://graph.facebook.com/v25.0";
const PHONE_ID = () => process.env.WA_PHONE_ID || "1500183396508087";
const WABA_ID = () => process.env.WA_WABA_ID || "922994070902446";

async function leer(key) {
  const r = await fetch(`${SUPA_URL}/rest/v1/bco_storage?key=eq.${encodeURIComponent(key)}&select=value&limit=1`, { headers: SH });
  if (!r.ok) throw new Error("No pude leer los contactos (" + r.status + ")");
  const d = await r.json(); if (!d.length || !d[0].value) return [];
  try { const v = JSON.parse(d[0].value); return Array.isArray(v) ? v : []; } catch { return []; }
}
async function guardar(key, arr) {
  const r = await fetch(`${SUPA_URL}/rest/v1/bco_storage`, { method: "POST", headers: { ...SH, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key, value: JSON.stringify(arr) }) });
  if (!r.ok) throw new Error("No pude guardar (" + r.status + ")");
}
async function registrar(tx) { try { const L = await leer("whatsapp_conector_log"); L.unshift({ t: Date.now(), tx }); await guardar("whatsapp_conector_log", L.slice(0, 300)); } catch { } }

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// Celulares de Argentina: 11 2345 6789 / 011 15 2345 6789 / +54 9 11 ... -> 5491123456789
function numero(v) {
  const raw = String(v || "").trim();
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (raw.startsWith("+") && !d.startsWith("54")) return d; // otro país, tal cual
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) { d = d.slice(2); if (d.startsWith("9")) d = d.slice(1); }
  if (d.startsWith("0")) d = d.slice(1);
  // número nacional: 10 dígitos, o 12 si trae el 15 después del código de área
  if (d.length === 12) { const m = d.match(/^(\d{2,4})15(\d{6,8})$/); if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2]; }
  return d.length === 10 ? "549" + d : d;
}
async function destino(para) {
  const C = await leer("wa_contactos");
  const q = norm(para);
  const exacto = C.find((c) => norm(c.nombre) === q) || C.find((c) => norm(c.nombre).includes(q) || q.includes(norm(c.nombre)));
  if (exacto) return { nombre: exacto.nombre, numero: exacto.numero };
  const n = numero(para);
  if (n.length >= 11) return { nombre: para, numero: n };
  throw new Error(`No tengo a "${para}" en los contactos. Pasame su número o agregalo con agregar_contacto.`);
}
async function graph(path, body, method) {
  const t = process.env.WA_TOKEN;
  if (!t) throw new Error("Falta el token de WhatsApp (WA_TOKEN) en Vercel");
  const r = await fetch(GRAPH + path, { method: method || (body ? "POST" : "GET"), headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j.error || {}; const code = e.code || r.status;
    if (code === 131047 || code === 131026 || /24 hours|re-engagement/i.test(e.message || "")) throw new Error("WhatsApp no deja mandar texto libre a alguien que no te escribió en las últimas 24 horas. Hay que usar una plantilla aprobada (enviar_plantilla).");
    if (code === 131030) throw new Error("Ese número no está en la lista de destinatarios permitidos del número de prueba. Agregalo en Meta (Paso 1. Pruébalo) o usá el número real.");
    if (code === 190) throw new Error("El token de WhatsApp venció o es inválido. Hay que generar uno nuevo.");
    throw new Error("WhatsApp respondió: " + (e.error_user_msg || e.message || r.status));
  }
  return j;
}
async function enviar(to, payload) { return graph(`/${PHONE_ID()}/messages`, { messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }); }

const TOOLS = [
  { name: "enviar_mensaje", description: "Manda un WhatsApp de texto desde el número de empresa de V+V. ANTES de llamar, confirmale a Sebastián en una frase a quién y qué texto vas a mandar y esperá su sí. Si la persona no escribió en las últimas 24 h, WhatsApp exige plantilla (enviar_plantilla).", inputSchema: { type: "object", properties: { para: { type: "string", description: "Nombre del contacto (ej: Enrico) o número" }, texto: { type: "string" } }, required: ["para", "texto"] } },
  { name: "enviar_pdf", description: "Manda un PDF (o cualquier documento) como ARCHIVO real por WhatsApp, no como link. Pedí confirmación antes.", inputSchema: { type: "object", properties: { para: { type: "string" }, url: { type: "string", description: "URL pública del PDF" }, nombre_archivo: { type: "string", description: "Ej: Auditoria-0008.pdf" }, texto: { type: "string", description: "Texto que acompaña (opcional)" } }, required: ["para", "url"] } },
  { name: "enviar_plantilla", description: "Manda un mensaje con una plantilla aprobada por Meta (necesario si la persona no escribió en las últimas 24 h). Pedí confirmación antes.", inputSchema: { type: "object", properties: { para: { type: "string" }, plantilla: { type: "string", description: "Nombre de la plantilla (ver plantillas)" }, idioma: { type: "string", description: "Código, ej es_AR, es, en_US" }, parametros: { type: "array", items: { type: "string" }, description: "Valores para {{1}}, {{2}}… del cuerpo" } }, required: ["para", "plantilla"] } },
  { name: "plantillas", description: "Lista las plantillas de mensaje de la cuenta de WhatsApp y su estado de aprobación.", inputSchema: { type: "object", properties: {} } },
  { name: "contactos", description: "Lista los contactos guardados para WhatsApp (nombre y número).", inputSchema: { type: "object", properties: {} } },
  { name: "agregar_contacto", description: "Guarda o actualiza un contacto de WhatsApp (nombre + celular).", inputSchema: { type: "object", properties: { nombre: { type: "string" }, numero: { type: "string", description: "Celular, ej 11 2345 6789" } }, required: ["nombre", "numero"] } },
  { name: "borrar_contacto", description: "Borra un contacto guardado, solo si Sebastián lo pide.", inputSchema: { type: "object", properties: { nombre: { type: "string" } }, required: ["nombre"] } },
];

async function ejecutar(name, a) {
  a = a || {};
  if (name === "contactos") { const C = await leer("wa_contactos"); return C.length ? C.map((c) => c.nombre + ": +" + c.numero).join("\n") : "Todavía no hay contactos guardados."; }
  if (name === "agregar_contacto") {
    const n = numero(a.numero); if (n.length < 11) throw new Error("Ese número no parece válido");
    const C = await leer("wa_contactos"); const i = C.findIndex((c) => norm(c.nombre) === norm(a.nombre));
    const c = { nombre: String(a.nombre).trim().slice(0, 60), numero: n };
    if (i >= 0) C[i] = c; else C.push(c);
    await guardar("wa_contactos", C); await registrar("Contacto: " + c.nombre);
    return `Guardé a ${c.nombre} (+${n}).`;
  }
  if (name === "borrar_contacto") { const C = await leer("wa_contactos"); const R = C.filter((c) => norm(c.nombre) !== norm(a.nombre)); if (R.length === C.length) throw new Error("No encontré ese contacto"); await guardar("wa_contactos", R); return "Contacto borrado."; }
  if (name === "plantillas") {
    const j = await graph(`/${WABA_ID()}/message_templates?fields=name,status,language,components&limit=50`);
    const L = (j.data || []).map((t) => { const b = (t.components || []).find((c) => c.type === "BODY"); return `${t.name} (${t.language}, ${t.status})${b ? ": " + b.text : ""}`; });
    return L.length ? L.join("\n") : "No hay plantillas.";
  }
  if (name === "enviar_mensaje") {
    const d = await destino(a.para); const texto = String(a.texto || "").trim(); if (!texto) throw new Error("Falta el texto");
    await enviar(d.numero, { type: "text", text: { body: texto.slice(0, 4000), preview_url: true } });
    await registrar(`Texto a ${d.nombre}: ${texto.slice(0, 200)}`);
    return `Listo, le mandé a ${d.nombre}: "${texto}".`;
  }
  if (name === "enviar_pdf") {
    const d = await destino(a.para); if (!/^https?:\/\//.test(String(a.url || ""))) throw new Error("Falta la URL del archivo");
    const fn = String(a.nombre_archivo || String(a.url).split("/").pop().split("?")[0] || "documento.pdf").slice(0, 120);
    await enviar(d.numero, { type: "document", document: { link: a.url, filename: fn, ...(a.texto ? { caption: String(a.texto).slice(0, 1000) } : {}) } });
    await registrar(`Archivo a ${d.nombre}: ${fn}`);
    return `Listo, le mandé a ${d.nombre} el archivo ${fn}.`;
  }
  if (name === "enviar_plantilla") {
    const d = await destino(a.para); const params = (a.parametros || []).map((x) => ({ type: "text", text: String(x) }));
    await enviar(d.numero, { type: "template", template: { name: a.plantilla, language: { code: a.idioma || "es_AR" }, ...(params.length ? { components: [{ type: "body", parameters: params }] } : {}) } });
    await registrar(`Plantilla ${a.plantilla} a ${d.nombre}`);
    return `Listo, le mandé a ${d.nombre} la plantilla ${a.plantilla}.`;
  }
  throw new Error("Herramienta desconocida: " + name);
}

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const mal = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
async function rpc(m) {
  const id = m.id ?? null;
  if (m.method === "initialize") return ok(id, { protocolVersion: (m.params && m.params.protocolVersion) || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "WhatsApp V+V", version: "1.0.0" }, instructions: "WhatsApp de empresa de V+V Construcciones (API oficial de Meta). Sebastián suele pedir manejando: antes de mandar cualquier mensaje confirmale en una frase corta a quién y qué vas a mandar, y mandá solo cuando diga que sí. Los PDF van como archivo, nunca como link." });
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
  const h = crypto.createHash("sha256").update("whatsapp:" + k).digest("hex");
  if (!k || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(HUELLA))) { res.status(401).json({ error: "Link inválido" }); return; }
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
