// CAD Check (NEXO 2 · Dirección): se suben los planos en PDF de una obra y la IA revisa qué documentación falta,
// qué les falta a los planos (cotas, ejes, niveles…), inconsistencias y un cómputo preliminar. Datos en nexo2_estado:
//   cad_idx                 lista de proyectos (obras de NEXO o proyectos sueltos)
//   cad_<pid>               { nombre, obra, docs:[{id,n,u,disc,kb,t}], an:{t,modelo,docs,r}, prev:[…] }
import crypto from "crypto";
import { esDir } from "./nexo2.js";

const URL_BASE = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const PUB = URL_BASE + "/storage/v1/object/public/nexo2-fotos/";
const MODELO = process.env.CAD_MODEL || "claude-sonnet-5-5";
const DISC = ["Arquitectura", "Estructura", "Sanitaria", "Eléctrica", "Gas", "Climatización", "Incendio", "Carpinterías", "Detalles", "Memoria / pliego", "Estudio de suelos", "Otro"];
const idOk = (x) => String(x || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
const S = (x, n) => String(x == null ? "" : x).slice(0, n);
let H = null;
async function leer(clave) { const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=valor&clave=eq.${encodeURIComponent(clave)}`, { headers: H }); if (!r.ok) throw new Error("db " + r.status); const x = await r.json(); return x[0] ? x[0].valor : null; }
async function escribir(clave, valor) { const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?on_conflict=clave`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ clave, valor, actualizado: new Date().toISOString() }) }); if (!r.ok) throw new Error("db " + r.status); }
const resumenAn = (an) => (an && an.r ? { t: an.t, legajoFalta: (an.r.legajo || []).filter((x) => x.estado !== "RECIBIDO").length, planosConFaltas: (an.r.planos || []).filter((x) => (x.faltan || []).length).length, hallazgos: (an.r.hallazgos || []).length, computo: (an.r.computo || []).length } : null);

const SISTEMA = `Sos un técnico de obra de una constructora argentina (V+V Construcciones, trabaja con Belfast). Recibís el primer juego de planos de una obra y tenés que decir qué documentación falta para poder construir, qué les falta a los planos recibidos y hacer un cómputo preliminar.

Revisá:
1) LEGAJO: qué documentación está y cuál falta o está incompleta. Considerá: plantas de arquitectura de cada nivel, cortes, vistas/fachadas, planta de techos, planta de replanteo con ejes, niveles (NPT/NPC, nivel ±0,00 de referencia), estructura (fundaciones, plantas de encofrado, armaduras/planillas de doblado, cálculo), estudio de suelos, instalación sanitaria (agua fría/caliente, cloacal, pluvial), eléctrica, gas, climatización, incendio si corresponde, planilla de carpinterías, planilla de locales/terminaciones, detalles constructivos (escaleras, baños, cocina, aislaciones, encuentros), memoria descriptiva o pliego de especificaciones.
2) PLANOS: en cada plano o lámina recibida, qué le falta: cotas (parciales y totales), ejes, niveles, escala, rótulo (fecha, revisión, firma, profesional), norte, referencias de cortes, medidas de vanos, espesores de muros, pendientes, designación de locales, especificación de materiales.
3) HALLAZGOS: inconsistencias entre planos (por ejemplo, medidas o niveles que no coinciden entre planta y corte, estructura que no coincide con arquitectura, interferencias con instalaciones) y riesgos constructivos.
4) CÓMPUTO preliminar: solo con datos que surjan de los planos (superficie cubierta, semicubierta, superficie de losas, m3 de hormigón si hay datos, m2 de mampostería por tipo, m2 de contrapiso y carpeta, m2 de pisos, ml de zócalos, cantidad de aberturas, etc.). Si no hay datos suficientes para un ítem, no lo pongas.
5) PEDIDO: la lista concreta de lo que hay que pedirle al estudio de arquitectura, redactada para mandarla tal cual.

Reglas: no inventes nada que no esté en los documentos; si algo no se puede leer, decilo. Escribí en español rioplatense, claro y corto. Usá los nombres de archivo exactos.
Devolvé SOLO un JSON válido, sin texto antes ni después, con este formato:
{"resumen":"2 o 3 oraciones",
 "legajo":[{"documento":"…","disciplina":"…","estado":"RECIBIDO"|"INCOMPLETO"|"FALTA","detalle":"…"}],
 "planos":[{"plano":"nombre del archivo y lámina","faltan":["cotas","ejes","niveles",…],"detalle":"…"}],
 "hallazgos":[{"gravedad":"ALTA"|"MEDIA"|"BAJA","titulo":"…","detalle":"…","planos":["…"]}],
 "computo":[{"item":"…","unidad":"m2"|"m3"|"ml"|"un"|"kg","cantidad":número,"base":"de dónde sale el dato","confianza":0-100}],
 "pedido":["…"]}
Máximo 25 ítems de legajo, 20 planos, 15 hallazgos, 25 ítems de cómputo y 20 de pedido.`;

function limpiarR(r) {
  const arr = (x, n) => (Array.isArray(x) ? x.slice(0, n) : []);
  const g = (x) => (["ALTA", "MEDIA", "BAJA"].includes(x) ? x : "MEDIA");
  const e = (x) => (["RECIBIDO", "INCOMPLETO", "FALTA"].includes(x) ? x : "INCOMPLETO");
  return {
    resumen: S(r.resumen, 1200),
    legajo: arr(r.legajo, 30).map((x) => ({ documento: S(x.documento, 160), disciplina: S(x.disciplina, 60), estado: e(x.estado), detalle: S(x.detalle, 500) })),
    planos: arr(r.planos, 25).map((x) => ({ plano: S(x.plano, 200), faltan: arr(x.faltan, 15).map((f) => S(f, 60)), detalle: S(x.detalle, 600) })),
    hallazgos: arr(r.hallazgos, 20).map((x) => ({ gravedad: g(x.gravedad), titulo: S(x.titulo, 160), detalle: S(x.detalle, 800), planos: arr(x.planos, 6).map((p) => S(p, 160)) })),
    computo: arr(r.computo, 30).map((x) => ({ item: S(x.item, 160), unidad: S(x.unidad, 8), cantidad: Math.round((Number(x.cantidad) || 0) * 100) / 100, base: S(x.base, 300), confianza: Math.max(0, Math.min(100, Math.round(Number(x.confianza) || 0))) })).filter((x) => x.cantidad > 0),
    pedido: arr(r.pedido, 25).map((x) => S(x, 400)),
  };
}

// ---- Google Drive: Dirección conecta su cuenta de Google una vez; el estudio le comparte la carpeta y los planos se traen solos ----
const discDe = (n) => /estruct|encofr|armad|fundac|hormig/i.test(n) ? "Estructura" : /sanit|cloac|agua|pluv|desag/i.test(n) ? "Sanitaria" : /electr|ilum|tomas/i.test(n) ? "Eléctrica" : /\bgas\b/i.test(n) ? "Gas" : /clima|aire|hvac|calef/i.test(n) ? "Climatización" : /incend/i.test(n) ? "Incendio" : /carpint|abert/i.test(n) ? "Carpinterías" : /detall/i.test(n) ? "Detalles" : /suelo/i.test(n) ? "Estudio de suelos" : /memor|pliego|espec/i.test(n) ? "Memoria / pliego" : "Arquitectura";
const idDrive = (link) => { const t = String(link || "").trim(); const m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(t) || /\/d\/([A-Za-z0-9_-]{10,})/.exec(t) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(t) || /^([A-Za-z0-9_-]{20,})$/.exec(t); return m ? m[1] : ""; };
class DriveError extends Error { constructor(m, cod) { super(m); this.cod = cod; } }
async function tokenDrive() {
  const g = await leer("cad_google"); if (!g || !g.rt) throw new DriveError("Primero conectá Google Drive (una sola vez).", "sin_google");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", refresh_token: g.rt, grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new DriveError("Google pidió volver a conectar la cuenta de Drive.", "sin_google");
  return j.access_token;
}
async function gd(tok, path) {
  const r = await fetch("https://www.googleapis.com/drive/v3/" + path + (path.includes("?") ? "&" : "?") + "supportsAllDrives=true", { headers: { Authorization: "Bearer " + tok } });
  if (r.ok) return r;
  const j = await r.json().catch(() => ({})); const m = String((j.error && j.error.message) || r.status); const why = ((j.error && j.error.errors) || [])[0] || {};
  if (/accessNotConfigured|has not been used|is disabled/i.test(m + why.reason)) throw new DriveError("Falta activar la API de Google Drive en el proyecto de Google de la app (es un clic en la consola de Google Cloud): " + (m.match(/https:\/\/\S+/) || [""])[0], "api_off");
  if (r.status === 404 || r.status === 403) throw new DriveError("Tu cuenta de Google no tiene acceso a esa carpeta o archivo. Pedí acceso al estudio.", "sin_acceso");
  if (r.status === 401) throw new DriveError("Google pidió volver a conectar la cuenta de Drive.", "sin_google");
  throw new DriveError("Google Drive respondió: " + m.slice(0, 160), "otro");
}
async function listarDrive(tok, id) {
  const F = "id,name,mimeType,modifiedTime,size,webViewLink";
  const raiz = await (await gd(tok, `files/${id}?fields=${F}`)).json();
  if (raiz.mimeType !== "application/vnd.google-apps.folder") return { raiz, files: [{ ...raiz, ruta: "" }] };
  const out = []; const cola = [{ id, ruta: "", nivel: 0 }];
  while (cola.length && out.length < 300) {
    const c = cola.shift(); let pt = "";
    do {
      const q = encodeURIComponent(`'${c.id}' in parents and trashed=false`);
      const j = await (await gd(tok, `files?q=${q}&fields=nextPageToken,files(${F})&pageSize=200&includeItemsFromAllDrives=true${pt ? "&pageToken=" + pt : ""}`)).json();
      for (const f of j.files || []) { if (f.mimeType === "application/vnd.google-apps.folder") { if (c.nivel < 3) cola.push({ id: f.id, ruta: (c.ruta ? c.ruta + " / " : "") + f.name, nivel: c.nivel + 1 }); } else out.push({ ...f, ruta: c.ruta }); }
      pt = j.nextPageToken || "";
    } while (pt && out.length < 300);
  }
  return { raiz, files: out };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  const sk = process.env.SUPABASE_SERVICE_KEY; if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY" }); return; }
  H = { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } } b = b || {};
  try {
    if (!(await esDir(H, (b.cred || {}).codigo))) { await new Promise((r) => setTimeout(r, 600)); res.status(403).json({ error: "Volvé a ingresar tu código de Dirección." }); return; }
    const idx = (await leer("cad_idx")) || { items: [] }; const L = Array.isArray(idx.items) ? idx.items : [];
    if (b.op === "cad_list") {
      const filas = await Promise.all(L.map(async (p) => { const v = await leer("cad_" + p.id); return { ...p, docs: ((v && v.docs) || []).length, an: resumenAn(v && v.an) }; }));
      res.status(200).json({ ok: true, items: filas, disc: DISC }); return;
    }
    if (b.op === "cad_new") {
      const nombre = S(b.nombre, 120).trim(); const obra = idOk(b.obra);
      if (!nombre) { res.status(400).json({ error: "Poné el nombre del proyecto" }); return; }
      const id = obra || "p" + Date.now().toString(36);
      if (!L.some((x) => x.id === id)) { L.push({ id, nombre, obra: obra || "", t: Date.now() }); await escribir("cad_idx", { items: L }); }
      const v = (await leer("cad_" + id)) || { nombre, obra: obra || "", docs: [] };
      if (!(await leer("cad_" + id))) await escribir("cad_" + id, v);
      res.status(200).json({ ok: true, id, p: v }); return;
    }
    if (b.op === "cad_google_estado") { const g = await leer("cad_google"); res.status(200).json({ ok: true, conectado: !!(g && g.rt), email: (g && g.email) || "" }); return; }
    if (b.op === "cad_google_url") {
      const cid = process.env.GOOGLE_CLIENT_ID, ru = process.env.GOOGLE_OAUTH_REDIRECT_URI;
      if (!cid || !ru) { res.status(500).json({ error: "Falta la configuración de Google en Vercel" }); return; }
      const n = crypto.randomBytes(16).toString("hex"); await escribir("cad_google_nonce", { n, t: Date.now() });
      const url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + encodeURIComponent(cid) + "&redirect_uri=" + encodeURIComponent(ru) + "&response_type=code&access_type=offline&prompt=consent&include_granted_scopes=true&state=" + encodeURIComponent("cad:" + n) + "&scope=" + encodeURIComponent("https://www.googleapis.com/auth/drive.readonly openid email");
      res.status(200).json({ ok: true, url }); return;
    }
    if (b.op === "cad_google_salir") { await escribir("cad_google", { rt: "", email: "", t: Date.now() }); res.status(200).json({ ok: true }); return; }
    const pid = idOk(b.pid); const P = L.find((x) => x.id === pid);
    if (!P) { res.status(404).json({ error: "No existe ese proyecto" }); return; }
    const K = "cad_" + pid; const v = (await leer(K)) || { nombre: P.nombre, obra: P.obra, docs: [] }; v.docs = Array.isArray(v.docs) ? v.docs : [];
    if (b.op === "cad_get") { res.status(200).json({ ok: true, p: v, disc: DISC }); return; }
    if (b.op === "cad_doc_add") {
      const u = String(b.u || ""); if (!u.startsWith(PUB)) { res.status(400).json({ error: "Archivo inválido" }); return; }
      if (v.docs.length >= 60) { res.status(400).json({ error: "Hasta 60 planos por proyecto" }); return; }
      const d = { id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: S(b.n, 160) || "plano.pdf", u, disc: DISC.includes(b.disc) ? b.disc : "Arquitectura", kb: Math.round((Number(b.size) || 0) / 1024), t: Date.now() };
      v.docs.push(d); await escribir(K, v); res.status(200).json({ ok: true, p: v }); return;
    }
    if (b.op === "cad_doc_set" || b.op === "cad_doc_del") {
      const d = v.docs.find((x) => x.id === idOk(b.id)); if (!d) { res.status(404).json({ error: "No existe ese plano" }); return; }
      if (b.op === "cad_doc_del") v.docs = v.docs.filter((x) => x !== d); else if (DISC.includes(b.disc)) d.disc = b.disc;
      await escribir(K, v); res.status(200).json({ ok: true, p: v }); return;
    }
    if (b.op === "cad_drive_list") {
      const id = b.link ? idDrive(b.link) : String((v.drive && v.drive.id) || ""); if (!id) { res.status(400).json({ error: "Pegá el link de la carpeta o del archivo de Google Drive" }); return; }
      try {
        const tok = await tokenDrive(); const { raiz, files } = await listarDrive(tok, id);
        v.drive = { id, nombre: raiz.name, link: raiz.webViewLink || String(b.link || ""), t: Date.now() }; await escribir(K, v);
        const pdf = files.filter((f) => f.mimeType === "application/pdf" || /\.pdf$/i.test(f.name));
        const otros = files.filter((f) => !pdf.includes(f));
        const est = (f) => { const d = v.docs.find((x) => x.drive === f.id); return !d ? "nuevo" : d.dmod !== f.modifiedTime ? "cambiado" : "importado"; };
        res.status(200).json({ ok: true, carpeta: raiz.name, p: v, files: pdf.map((f) => ({ id: f.id, n: f.name, ruta: f.ruta, kb: Math.round((Number(f.size) || 0) / 1024), mod: f.modifiedTime, est: est(f) })), otros: otros.slice(0, 50).map((f) => ({ n: f.name, ruta: f.ruta, tipo: /dwg|dxf/i.test(f.name) ? "CAD" : (f.mimeType || "").replace("application/vnd.google-apps.", "Google ") })) });
      } catch (e) { if (!(e instanceof DriveError)) throw e; res.status(200).json({ ok: false, falla: e.message, cod: e.cod, link: String(b.link || "") }); }
      return;
    }
    if (b.op === "cad_drive_import") {
      const fid = /^[A-Za-z0-9_-]{10,80}$/.test(String(b.fid || "")) ? String(b.fid) : ""; if (!fid) { res.status(400).json({ error: "Archivo inválido" }); return; }
      try {
        const tok = await tokenDrive();
        const meta = await (await gd(tok, `files/${fid}?fields=id,name,mimeType,modifiedTime,size`)).json();
        if (Number(meta.size) > 45e6) { res.status(200).json({ ok: false, falla: `“${meta.name}” pesa más de 45 MB` }); return; }
        const buf = Buffer.from(await (await gd(tok, `files/${fid}?alt=media`)).arrayBuffer());
        const path = `cad/${pid}/${fid}-${Date.now().toString(36)}.pdf`;
        const up = await fetch(`${URL_BASE}/storage/v1/object/nexo2-fotos/${path}`, { method: "POST", headers: { apikey: H.apikey, Authorization: H.Authorization, "Content-Type": "application/pdf", "x-upsert": "true" }, body: buf });
        if (!up.ok) { res.status(502).json({ error: "No se pudo guardar el plano (" + up.status + ")" }); return; }
        const v2 = (await leer(K)) || v; v2.docs = Array.isArray(v2.docs) ? v2.docs : [];
        const prev = v2.docs.find((x) => x.drive === fid);
        const d = { id: prev ? prev.id : "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: S(meta.name, 160), u: PUB + path, disc: prev ? prev.disc : discDe(meta.name), kb: Math.round(buf.length / 1024), t: Date.now(), drive: fid, dmod: meta.modifiedTime, ruta: S(b.ruta, 200) };
        if (prev) v2.docs = v2.docs.map((x) => (x === prev ? d : x)); else { if (v2.docs.length >= 60) { res.status(200).json({ ok: false, falla: "Hasta 60 planos por proyecto" }); return; } v2.docs.push(d); }
        await escribir(K, v2); res.status(200).json({ ok: true, p: v2, cambiado: !!prev });
      } catch (e) { if (!(e instanceof DriveError)) throw e; res.status(200).json({ ok: false, falla: e.message, cod: e.cod }); }
      return;
    }
    if (b.op === "cad_del") {
      await escribir("cad_idx", { items: L.filter((x) => x.id !== pid) }); res.status(200).json({ ok: true }); return;
    }
    if (b.op === "cad_analizar") {
      const key = process.env.ANTHROPIC_API_KEY; if (!key) { res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en el servidor" }); return; }
      const ids = Array.isArray(b.ids) && b.ids.length ? new Set(b.ids.map(idOk)) : null;
      const docs = v.docs.filter((d) => !ids || ids.has(d.id)).slice(0, 12);
      if (!docs.length) { res.status(400).json({ error: "Subí al menos un plano en PDF" }); return; }
      const content = docs.map((d) => ({ type: "document", source: { type: "url", url: d.u }, title: d.n + " (" + d.disc + ")" }));
      content.push({ type: "text", text: `Obra: "${v.nombre}". Planos recibidos (${docs.length}):\n` + docs.map((d) => `- ${d.n} · disciplina declarada: ${d.disc}`).join("\n") + `\n\nDisciplinas que NO se subieron: ${DISC.filter((x) => !["Otro"].includes(x) && !docs.some((d) => d.disc === x)).join(", ") || "ninguna"}.\nHacé la revisión completa y devolvé el JSON.` });
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: MODELO, max_tokens: 12000, system: SISTEMA, messages: [{ role: "user", content }] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const m = String((j.error && j.error.message) || r.status); res.status(502).json({ error: /too large|exceed|maximum|pages/i.test(m) ? "Los planos son demasiado pesados para revisarlos juntos (máximo 100 páginas y 32 MB en total): elegí menos planos y probá de nuevo." : "La IA no pudo revisar los planos: " + m.slice(0, 200) }); return; }
      const txt = ((j.content || []).find((c) => c.type === "text") || {}).text || "";
      let R; try { const a = txt.indexOf("{"), z = txt.lastIndexOf("}"); R = limpiarR(JSON.parse(txt.slice(a, z + 1))); } catch (e) { res.status(502).json({ error: "La IA devolvió una respuesta que no se pudo leer. Probá de nuevo." }); return; }
      const v2 = (await leer(K)) || v; // por si se subió algo mientras tanto
      if (v2.an) v2.prev = [{ t: v2.an.t, r: v2.an.r }, ...(v2.prev || [])].slice(0, 3);
      v2.an = { t: Date.now(), modelo: MODELO, docs: docs.map((d) => d.id), r: R };
      await escribir(K, v2);
      res.status(200).json({ ok: true, p: v2 }); return;
    }
    res.status(400).json({ error: "Operación desconocida" });
  } catch (e) { res.status(500).json({ error: "Error: " + (e.message || e) }); }
}
