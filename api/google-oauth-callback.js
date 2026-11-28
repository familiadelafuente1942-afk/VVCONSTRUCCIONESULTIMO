// Mismo proyecto/clave pública de Supabase que ya usa MiAsistente.jsx (bco_storage).
const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";

// CAD Check (NEXO 2): la Dirección conecta su Google Drive. Se reconoce por el state "cad:<nonce>" y el token queda en nexo2_estado (privado).
async function cadGoogle(req, res) {
  const NX = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co", sk = process.env.SUPABASE_SERVICE_KEY || "";
  const H = { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
  const volver = (q) => { res.writeHead(302, { Location: "/nexo2.html?drive=" + q }); res.end(); };
  try {
    const { code, error, state } = req.query;
    if (error || !code) return volver("error");
    const rn = await fetch(`${NX}/rest/v1/nexo2_estado?select=valor&clave=eq.cad_google_nonce`, { headers: H }); const nn = ((await rn.json())[0] || {}).valor || {};
    if (!nn.n || String(state) !== "cad:" + nn.n || Date.now() - (nn.t || 0) > 15 * 60e3) return volver("error");
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI, grant_type: "authorization_code" }) });
    const d = await r.json(); if (!r.ok || !d.refresh_token) return volver("error");
    let email = ""; try { const u = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + d.access_token } }); email = (await u.json()).email || ""; } catch (e) {}
    const put = (clave, valor) => fetch(`${NX}/rest/v1/nexo2_estado?on_conflict=clave`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ clave, valor, actualizado: new Date().toISOString() }) });
    await put("cad_google", { rt: d.refresh_token, email, t: Date.now() }); await put("cad_google_nonce", { n: "", t: 0 });
    return volver("ok");
  } catch (e) { return volver("error"); }
}

export default async function handler(req, res) {
  if (String((req.query && req.query.state) || "").startsWith("cad:")) return cadGoogle(req, res);
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
