// Mismo proyecto/clave pública de Supabase que ya usa MiAsistente.jsx (bco_storage).
const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";

export default async function handler(req, res) {
  const { code, error } = req.query;
  if (error) {
    res.writeHead(302, { Location: "/mi-asistente.html?google=error" });
    res.end();
    return;
  }
  if (!code) {
    res.status(400).send("Falta el código que devuelve Google.");
    return;
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    res.status(500).send("Falta GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_OAUTH_REDIRECT_URI en Vercel.");
    return;
  }
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.refresh_token) {
      res.writeHead(302, { Location: "/mi-asistente.html?google=error" });
      res.end();
      return;
    }
    await fetch(SUPA_URL + "/rest/v1/bco_storage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": "Bearer " + SUPA_KEY,
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({ key: "sebastian_google_token", value: JSON.stringify({ refresh_token: data.refresh_token }) }),
    });
    res.writeHead(302, { Location: "/mi-asistente.html?google=ok" });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: "/mi-asistente.html?google=error" });
    res.end();
  }
}
