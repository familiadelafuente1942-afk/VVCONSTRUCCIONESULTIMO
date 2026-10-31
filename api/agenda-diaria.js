// Aviso diario de las 8:00 (hora Argentina): manda la agenda completa del día al celular de Sebastián.
// Si no hay nada agendado ese día, no manda nada.
// Lo dispara el cron de Vercel (vercel.json). Canal: ntfy (app gratuita) con el tema privado NTFY_TOPIC.
// Variables en Vercel: NTFY_TOPIC (obligatoria), CRON_SECRET (opcional; si existe, también se acepta "Authorization: Bearer ...").
const SUPA = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const miles = (n) => Math.round(Number(n) || 0).toLocaleString("es-AR");
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"], MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const ua = String((req.headers && req.headers["user-agent"]) || "");
  const sec = process.env.CRON_SECRET;
  const okSec = sec && (req.headers || {}).authorization === "Bearer " + sec;
  if (!ua.startsWith("vercel-cron") && !okSec) { res.status(403).json({ error: "No autorizado" }); return; }
  const topic = process.env.NTFY_TOPIC;
  if (!topic) { res.status(500).json({ error: "Falta NTFY_TOPIC en Vercel." }); return; }
  try {
    const ar = new Date(Date.now() - 3 * 3600e3); // hora Argentina (UTC-3)
    const dd = String(ar.getUTCDate()).padStart(2, "0"), mm = String(ar.getUTCMonth() + 1).padStart(2, "0"), yy = String(ar.getUTCFullYear()).slice(-2);
    const hoy = `${dd}/${mm}/${yy}`;
    const r = await fetch(`${SUPA}/rest/v1/bco_storage?key=eq.sebastian_agenda&select=value&limit=1`, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (!r.ok) throw new Error("db " + r.status);
    const rows = await r.json();
    let ag = []; try { ag = JSON.parse((rows[0] && rows[0].value) || "[]"); } catch { }
    const norm = (f) => { const [d, m, a] = String(f || "").split("/"); return d && m && a ? `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${a.slice(-2)}` : ""; };
    const del = ag.filter((e) => norm(e.fecha) === hoy).sort((a, b) => String(a.hora || "99").localeCompare(String(b.hora || "99")));
    if (!del.length) { res.status(200).json({ ok: true, enviado: false, motivo: "Sin nada agendado hoy" }); return; }
    const L = del.map((e) => e.tipo === "pago" ? `💰 Pagar a ${e.titulo}${e.monto ? " — $" + miles(e.monto) : ""}${e.nota ? " (" + e.nota + ")" : ""}` : `${e.hora ? e.hora + " · " : ""}${e.titulo}${e.nota ? " — " + e.nota : ""}`);
    const titulo = `Agenda de hoy · ${DIAS[ar.getUTCDay()]} ${ar.getUTCDate()} ${MESES[ar.getUTCMonth()]}`;
    const p = await fetch("https://ntfy.sh/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, title: titulo, message: L.join("\n"), priority: 4, tags: ["calendar"] }) });
    if (!p.ok) throw new Error("ntfy " + p.status);
    res.status(200).json({ ok: true, enviado: true, items: del.length });
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 120) }); }
}
