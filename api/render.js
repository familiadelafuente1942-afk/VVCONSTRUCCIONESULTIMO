// Proxy serverless para generar renders fotorrealistas con OpenAI (gpt-image-1).
// La clave queda del lado del servidor: definí OPENAI_API_KEY en
// Vercel -> Settings -> Environment Variables. El navegador nunca la ve.
//
// Si se envía "imageB64" (el render vectorial del mueble), se usa el endpoint de
// EDICIÓN: la IA respeta la estructura del diseño (medidas, cantidad de módulos,
// dónde va cada cosa) y solo lo vuelve fotorrealista. Sin imagen, genera de cero.

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Método no permitido" } });
    return;
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(500).json({ error: { message: "Falta OPENAI_API_KEY en el servidor (Vercel -> Settings -> Environment Variables)." } });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const prompt = String(body.prompt || "").slice(0, 30000);
    const size = body.size || "1536x1024";
    const quality = body.quality || "high";
    const imageB64 = body.imageB64;
    if (!prompt) {
      res.status(400).json({ error: { message: "Falta el prompt." } });
      return;
    }

    let r;
    // imagenes de referencia: el render del mueble + foto del ambiente + objetos de decoracion
    const imgs = [];
    if (imageB64) imgs.push(imageB64);
    if (Array.isArray(body.imagesB64)) for (const x of body.imagesB64) if (x && imgs.length < 5) imgs.push(x);

    if (imgs.length) {
      const fd = new FormData();
      fd.append("model", "gpt-image-1");
      fd.append("prompt", prompt);
      fd.append("size", size);
      fd.append("quality", quality);
      fd.append("input_fidelity", "high");
      imgs.forEach((im, i) => {
        const mime = (String(im).match(/^data:(image\/\w+);base64,/) || [])[1] || "image/png";
        const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
        const bin = Buffer.from(String(im).replace(/^data:image\/\w+;base64,/, ""), "base64");
        fd.append("image[]", new Blob([bin], { type: mime }), `ref${i}.${ext}`);
      });
      r = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: "Bearer " + key },
        body: fd,
      });
    } else {
      r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({ model: "gpt-image-1", prompt, size, quality }),
      });
    }

    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: { message: (data && data.error && data.error.message) || "Error de OpenAI" } });
      return;
    }
    const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) {
      res.status(500).json({ error: { message: "OpenAI no devolvió imagen." } });
      return;
    }
    res.status(200).json({ image: "data:image/png;base64," + b64 });
  } catch (e) {
    res.status(500).json({ error: { message: (e && e.message) || "Error en el proxy de render" } });
  }
}
