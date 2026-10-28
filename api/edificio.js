// Edificio propio (proyecto personal de Sebastián): cotizador, flujo de caja a 24 meses, fondos y metas.
// Guarda un único documento en la misma base que NEXO 2 (tabla nexo2_estado, clave "edif_proyecto").
// Acceso: código de Dirección de NEXO (el mismo que usa en NEXO 2). Variable: SUPABASE_SERVICE_KEY.

const URL_BASE = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const norm = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const headers = (sk) => ({ apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" });
const CLAVE = "edif_proyecto";

async function leer(H, clave) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=valor&clave=eq.${clave}`, { headers: H });
  if (!r.ok) throw new Error("db " + r.status);
  const rows = await r.json();
  return rows[0] ? rows[0].valor : null;
}
async function escribir(H, clave, valor) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?on_conflict=clave`, {
    method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ clave, valor, actualizado: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("db " + r.status);
}
async function dirCode(H) {
  let v = await leer(H, "codigos");
  if (v && typeof v.v === "string") { try { v = JSON.parse(v.v); } catch { v = null; } }
  return (v && v.dir) || process.env.NEXO_DIR_CODE || process.env.NEXO2_DIR_CODE || "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "POST" }); return; }
  const sk = process.env.SUPABASE_SERVICE_KEY;
  if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY en Vercel." }); return; }
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } } b = b || {};
  const H = headers(sk);
  try {
    const dir = norm(await dirCode(H));
    if (!dir || norm(b.cod) !== dir) { await pausa(600); res.status(403).json({ error: "Código incorrecto." }); return; }
    if (b.op === "get") { const v = await leer(H, CLAVE); res.status(200).json({ ok: true, data: v && v.data ? v.data : null, t: (v && v.t) || 0 }); return; }
    if (b.op === "set") {
      const s = JSON.stringify(b.data || {});
      if (s.length > 400000) { res.status(400).json({ error: "Demasiado grande." }); return; }
      const prev = await leer(H, CLAVE);
      if (prev && Number(b.base) && Number(prev.t) > Number(b.base)) { res.status(409).json({ error: "Hay una versión más nueva guardada desde otro aparato.", t: prev.t }); return; }
      const t = Date.now();
      await escribir(H, CLAVE, { t, data: b.data });
      res.status(200).json({ ok: true, t }); return;
    }
    res.status(400).json({ error: "Operación inválida" });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 120) }); }
}
