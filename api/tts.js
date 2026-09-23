// Convierte texto a voz usando ElevenLabs (voz humana, no la robótica del navegador).
// Necesita en Vercel (Settings → Environment Variables):
//   ELEVENLABS_API_KEY   -> tu API key de elevenlabs.io
//   ELEVENLABS_VOICE_ID  -> el ID de la voz que elegiste.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  if (!apiKey) {
    res.status(500).json({ error: "Falta ELEVENLABS_API_KEY en Vercel." });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Cuerpo inválido" });
    return;
  }

  const texto = String(body?.texto || "").slice(0, 900);
  if (!texto) {
    res.status(400).json({ error: "Falta texto" });
    return;
  }

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: texto,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      res.status(502).json({ error: "ElevenLabs error: " + errText.slice(0, 300) });
      return;
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message || "Error" });
  }
}
