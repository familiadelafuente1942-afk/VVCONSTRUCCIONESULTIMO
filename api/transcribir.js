// Proxy serverless: transcribe un tramo de audio de una reunión con OpenAI.
// Usa OPENAI_API_KEY (la misma que ya usa api/render.js). El navegador nunca ve la clave.
export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: { message: "Método no permitido" } }); return; }
  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(500).json({ error: { message: "Falta OPENAI_API_KEY en el servidor (Vercel -> Settings -> Environment Variables)." } }); return; }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const mime = String(body.mime || "audio/webm");
    const buf = Buffer.from(String(body.audio || ""), "base64");
    if (!buf.length) { res.status(400).json({ error: { message: "Audio vacío" } }); return; }
    const ext = /mp4|m4a|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : /wav/.test(mime) ? "wav" : /mpeg|mp3/.test(mime) ? "mp3" : "webm";
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: mime }), "reunion." + ext);
    fd.append("model", "whisper-1");
    fd.append("language", "es");
    fd.append("prompt", "Reunión de trabajo en Argentina sobre construcción: obra gris, losa, contrapiso, hormigón, certificado, adicional, cronograma, V+V Construcciones, Belfast, San Telmo, Hudson.");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + key }, body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { res.status(r.status).json({ error: { message: (data && data.error && data.error.message) || "Error de OpenAI" } }); return; }
    res.status(200).json({ text: data.text || "" });
  } catch (e) {
    res.status(500).json({ error: { message: String((e && e.message) || e) } });
  }
}
