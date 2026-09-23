// Mismo proyecto/clave pública de Supabase que ya usa MiAsistente.jsx (bco_storage).
const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";

async function getRefreshToken() {
  try {
    const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq.sebastian_google_token&select=value&limit=1", {
      headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY },
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.length) return null;
    const parsed = JSON.parse(d[0].value);
    return parsed.refresh_token || null;
  } catch {
    return null;
  }
}

async function getAccessToken() {
  const refresh_token = await getRefreshToken();
  if (!refresh_token) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.access_token || null;
  } catch {
    return null;
  }
}

// Acepta "DD/MM", "DD/MM/AA" o "DD/MM/AAAA" + "HH:MM" (misma convención que el resto de la app).
function parseFechaHora(fecha, hora) {
  const p = String(fecha || "").split("/").map((s) => parseInt(s, 10));
  if (!p[0] || !p[1] || isNaN(p[0]) || isNaN(p[1])) return null;
  let [d, m, y] = p;
  if (y == null || isNaN(y)) y = new Date().getFullYear();
  else if (y < 100) y += 2000;
  const [hh, mm] = String(hora || "09:00").split(":").map((n) => parseInt(n, 10) || 0);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  return isNaN(dt.getTime()) ? null : dt;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido" });
    return;
  }
  const accessToken = await getAccessToken();
  if (!accessToken) {
    res.status(200).json({ ok: false, error: "no_conectado" });
    return;
  }
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ ok: false, error: "Cuerpo inválido" });
    return;
  }
  try {
    if (body.action === "create") {
      const inicio = parseFechaHora(body.fecha, body.hora);
      if (!inicio) {
        res.status(200).json({ ok: false, error: "fecha_invalida" });
        return;
      }
      const dur = Number(body.duracion_min) || 60;
      const fin = new Date(inicio.getTime() + dur * 60000);
      const event = {
        summary: body.titulo || "Evento",
        location: body.ubicacion || undefined,
        description: body.nota || undefined,
        start: { dateTime: inicio.toISOString(), timeZone: "America/Argentina/Buenos_Aires" },
        end: { dateTime: fin.toISOString(), timeZone: "America/Argentina/Buenos_Aires" },
      };
      const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken },
        body: JSON.stringify(event),
      });
      const data = await r.json();
      if (!r.ok) {
        res.status(200).json({ ok: false, error: data.error?.message || "Error de Google Calendar" });
        return;
      }
      res.status(200).json({ ok: true, id: data.id, htmlLink: data.htmlLink });
      return;
    }
    res.status(200).json({ ok: false, error: "accion_no_soportada" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Error" });
  }
}
