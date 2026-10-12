// Capa de datos de Belfast Inversores sobre Supabase (reemplaza las APIs de Cloudflare D1/R2 del original)
const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const BUCKET = "inversores";
const SKEY = "inv_session";

let session = null;
try { session = JSON.parse(localStorage.getItem(SKEY) || "null"); } catch { session = null; }
const saveSession = (s) => { session = s; try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch {} };

async function token() {
  if (!session) return null;
  if (session.expires_at && session.expires_at * 1000 < Date.now() + 60000) {
    try {
      const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: SUPA_KEY, "content-type": "application/json" }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
      const d = await r.json();
      if (!r.ok) throw new Error();
      saveSession({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at, email: d.user?.email || session.email });
    } catch { saveSession(null); return null; }
  }
  return session.access_token;
}
async function headers(extra = {}) {
  const t = await token();
  return { apikey: SUPA_KEY, Authorization: `Bearer ${t || SUPA_KEY}`, ...extra };
}
async function rest(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, { ...opts, headers: await headers({ "content-type": "application/json", ...(opts.headers || {}) }) });
  const txt = await r.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!r.ok) throw new Error((data && data.message) || "Error de conexión");
  return data;
}

export async function login(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: SUPA_KEY, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const d = await r.json();
  if (!r.ok) throw new Error("Email o contraseña incorrectos");
  saveSession({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at, email: d.user?.email || email });
}
export const logout = () => saveSession(null);

export async function me() {
  if (!(await token())) return { authenticated: false, admin: false, email: "" };
  try {
    const ok = await rest("/rpc/inv_soy_admin", { method: "POST", body: "{}" });
    return { authenticated: true, admin: ok === true, email: session?.email || "" };
  } catch { return { authenticated: true, admin: false, email: session?.email || "" }; }
}

export async function getContent() {
  const rows = await rest("/inv_content?id=eq.1&select=content,updated_at");
  if (!rows || !rows[0]) return { content: null, updatedAt: "" };
  return { content: rows[0].content, updatedAt: rows[0].updated_at };
}
export async function saveContent(content) {
  if (JSON.stringify(content).length > 100000) throw new Error("El contenido es demasiado extenso");
  const updatedAt = new Date().toISOString();
  await rest("/inv_content", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: 1, content, updated_at: updatedAt, updated_by: session?.email || "" }) });
  return updatedAt;
}

const toItem = (r) => ({ id: r.id, objectKey: r.object_key, fileName: r.file_name, contentType: r.content_type, size: r.size, category: r.category, title: r.title, caption: r.caption, createdAt: r.created_at });
export async function listMedia() {
  const rows = await rest("/inv_media?select=*&order=sort_order.desc,id.desc");
  return (rows || []).map(toItem);
}
export const mediaUrl = (item) => `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${item.objectKey}`;

export async function uploadMedia(file, { category, title, caption }) {
  const okType = file.type.startsWith("image/") || file.type.startsWith("video/") || file.type === "application/pdf";
  if (!okType) throw new Error("Subí una imagen, video o PDF");
  if (file.size > 30 * 1024 * 1024) throw new Error("El archivo no puede superar 30 MB");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const key = `brochure/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`;
  const up = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${key}`, { method: "POST", headers: await headers({ "content-type": file.type, "x-upsert": "false" }), body: file });
  if (!up.ok) throw new Error("No se pudo subir " + file.name);
  await rest("/inv_media", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ object_key: key, file_name: file.name, content_type: file.type, size: file.size, category: String(category || "Proyecto").slice(0, 60), title: String(title || file.name).slice(0, 160), caption: String(caption || "").slice(0, 500), sort_order: Date.now() }) });
}
export async function deleteMedia(item) {
  await rest(`/inv_media?id=eq.${item.id}`, { method: "DELETE" });
  try { await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${item.objectKey}`, { method: "DELETE", headers: await headers() }); } catch {}
}

export async function sendSurvey(data) {
  if (data.website) return;
  if (!data.consent || !["Sí, me interesa", "Quiero saber más", "Por ahora no"].includes(data.interest)) throw new Error("Indicá tu interés y autorizá el envío de tu respuesta");
  const answers = { consent: true, consentVersion: "2026-10-09", features: Array.isArray(data.features) ? data.features.filter((v) => typeof v === "string").slice(0, 12).map((v) => v.slice(0, 80)) : [] };
  for (const k of ["name", "contact", "interest", "goal", "horizon", "unit", "budget", "payment", "comments"]) answers[k] = String(data[k] ?? "").trim().slice(0, k === "comments" ? 1500 : 200);
  const r = await fetch(`${SUPA_URL}/rest/v1/inv_surveys`, { method: "POST", headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "content-type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ answers }) });
  if (!r.ok) throw new Error("No pudimos guardar tu respuesta. Intentá nuevamente.");
}
export async function listSurveys() {
  const rows = await rest("/inv_surveys?select=id,created_at,answers&order=id.desc&limit=300");
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at, ...r.answers }));
}
