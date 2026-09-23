export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    res.status(500).send("Falta GOOGLE_CLIENT_ID o GOOGLE_OAUTH_REDIRECT_URI en Vercel (Environment Variables).");
    return;
  }
  const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly");
  const url = "https://accounts.google.com/o/oauth2/v2/auth"
    + "?client_id=" + encodeURIComponent(clientId)
    + "&redirect_uri=" + encodeURIComponent(redirectUri)
    + "&response_type=code"
    + "&access_type=offline"
    + "&prompt=consent"
    + "&scope=" + scope;
  res.writeHead(302, { Location: url });
  res.end();
}
