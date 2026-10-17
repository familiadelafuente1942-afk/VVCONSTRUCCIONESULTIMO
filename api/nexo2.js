// Sincronización de NEXO 2.0 (obras y códigos) contra Supabase, desde el servidor.
// Necesita en Vercel (Settings → Environment Variables):
//   SUPABASE_SERVICE_KEY -> service_role / secret key del proyecto nexo-entorno
//   SUPABASE_URL         -> opcional (por defecto https://qaubkwiwtszebdgfrizr.supabase.co)
// La tabla public.nexo2_estado (clave, valor jsonb, actualizado) está cerrada para la clave pública.

const URL_BASE = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const KEYS = ["cfg", "codigos"];

export default async function handler(req, res) {
  const sk = process.env.SUPABASE_SERVICE_KEY;
  if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY en Vercel." }); return; }
  const H = { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor&clave=in.(${KEYS.join(",")})`, { headers: H });
      if (!r.ok) { res.status(502).json({ error: "Supabase " + r.status }); return; }
      const out = {};
      for (const row of await r.json()) out[row.clave] = row.valor;
      res.status(200).json(out);
      return;
    }
    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      if (!KEYS.includes(b.key) || typeof b.v !== "string" || b.v.length > 2_000_000 || typeof b.t !== "number") {
        res.status(400).json({ error: "Datos inválidos" }); return;
      }
      const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?on_conflict=clave`, {
        method: "POST",
        headers: { ...H, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ clave: b.key, valor: { t: b.t, v: b.v }, actualizado: new Date().toISOString() }),
      });
      if (!r.ok) { res.status(502).json({ error: "Supabase " + r.status }); return; }
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "Método no permitido" });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
}
