// Ícono de la pantalla de inicio de Mi Asistente: sirve la foto que Sebastián eligió en la app (guardada en bco_storage).
// Si todavía no eligió ninguna, redirige al ícono por defecto.
const SUPA = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const r = await fetch(`${SUPA}/rest/v1/bco_storage?key=eq.sebastian_icono&select=value&limit=1`, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    const rows = r.ok ? await r.json() : [];
    const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec((rows[0] && rows[0].value) || "");
    if (m) { res.setHeader("Content-Type", m[1]); res.status(200).send(Buffer.from(m[2], "base64")); return; }
  } catch { }
  res.writeHead(302, { Location: "/icon-vv-180.png" }); res.end();
}
