// Estudio de Instagram (app de Nanina): imagen o video vertical generados con IA a partir de una foto + un prompt.
//  op "imagen"        -> OpenAI gpt-image-1 (edición con la foto de referencia), 1024x1536 vertical, JPEG.
//  op "video_crear"   -> OpenAI Sora 2 (/v1/videos) con la foto como primer cuadro, 720x1280 vertical (formato Reel).
//  op "video_estado"  -> consulta el trabajo; al terminar baja el MP4 y lo deja en Supabase (bucket público nexo2-fotos/nanina/).
// Claves del lado del servidor: OPENAI_API_KEY, SUPABASE_SERVICE_KEY (y SUPABASE_URL opcional).

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

const SB = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const err = (res, code, m) => res.status(code).json({ error: { message: m } });
const deB64 = (s) => {
  const mime = (String(s).match(/^data:(image\/\w+);base64,/) || [])[1] || "image/jpeg";
  return { mime, bin: Buffer.from(String(s).replace(/^data:[^,]+,/, ""), "base64") };
};
const msgOpenAI = (d, r) => (d && d.error && d.error.message) || ("Error de OpenAI (" + r.status + ")");

export default async function handler(req, res) {
  if (req.method !== "POST") return err(res, 405, "Método no permitido");
  const key = process.env.OPENAI_API_KEY;
  if (!key) return err(res, 500, "Falta OPENAI_API_KEY en el servidor.");
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const op = b.op;
  try {
    if (op === "imagen") {
      const prompt = String(b.prompt || "").slice(0, 8000);
      if (!prompt) return err(res, 400, "Escribí qué querés que haga la IA.");
      const imgs = (Array.isArray(b.imagenes) ? b.imagenes : []).filter(Boolean).slice(0, 4);
      let r;
      if (imgs.length) {
        const fd = new FormData();
        fd.append("model", "gpt-image-1");
        fd.append("prompt", prompt);
        fd.append("size", "1024x1536");
        fd.append("quality", b.calidad === "media" ? "medium" : "high");
        fd.append("input_fidelity", "high");
        fd.append("output_format", "jpeg");
        fd.append("output_compression", "88");
        imgs.forEach((im, i) => { const { mime, bin } = deB64(im); fd.append("image[]", new Blob([bin], { type: mime }), `ref${i}.${mime === "image/png" ? "png" : "jpg"}`); });
        r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + key }, body: fd });
      } else {
        r = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1536", quality: b.calidad === "media" ? "medium" : "high", output_format: "jpeg", output_compression: 88 }) });
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return err(res, r.status, msgOpenAI(d, r));
      const x = d && d.data && d.data[0] && d.data[0].b64_json;
      if (!x) return err(res, 500, "La IA no devolvió imagen.");
      const sk = process.env.SUPABASE_SERVICE_KEY;
      if (sk) {
        const path = "nanina/imagenes/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + ".jpg";
        const up = await fetch(`${SB}/storage/v1/object/nexo2-fotos/${path}`, { method: "POST", headers: { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: Buffer.from(x, "base64") }).catch(() => null);
        if (up && up.ok) return res.status(200).json({ url: `${SB}/storage/v1/object/public/nexo2-fotos/${path}` });
      }
      return res.status(200).json({ imagen: "data:image/jpeg;base64," + x });
    }

    if (op === "video_crear") {
      const prompt = String(b.prompt || "").slice(0, 4000);
      if (!prompt) return err(res, 400, "Escribí qué querés que pase en el video.");
      const seg = ["4", "8", "12"].includes(String(b.segundos)) ? String(b.segundos) : "8";
      const fd = new FormData();
      fd.append("model", "sora-2");
      fd.append("prompt", prompt);
      fd.append("seconds", seg);
      fd.append("size", "720x1280");
      if (b.imagen) { const { mime, bin } = deB64(b.imagen); fd.append("input_reference", new Blob([bin], { type: mime }), mime === "image/png" ? "ref.png" : "ref.jpg"); }
      const r = await fetch("https://api.openai.com/v1/videos", { method: "POST", headers: { Authorization: "Bearer " + key }, body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return err(res, r.status, msgOpenAI(d, r));
      return res.status(200).json({ id: d.id, estado: d.status || "queued" });
    }

    if (op === "video_estado") {
      const id = String(b.id || "").replace(/[^\w-]/g, "");
      if (!id) return err(res, 400, "Falta el id del video.");
      const r = await fetch("https://api.openai.com/v1/videos/" + id, { headers: { Authorization: "Bearer " + key } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return err(res, r.status, msgOpenAI(d, r));
      if (d.status === "failed") return res.status(200).json({ estado: "failed", error: (d.error && d.error.message) || "La IA no pudo hacer el video." });
      if (d.status !== "completed") return res.status(200).json({ estado: d.status, progreso: d.progress || 0 });
      const sk = process.env.SUPABASE_SERVICE_KEY;
      if (!sk) return err(res, 500, "Falta SUPABASE_SERVICE_KEY para guardar el video.");
      const v = await fetch("https://api.openai.com/v1/videos/" + id + "/content", { headers: { Authorization: "Bearer " + key } });
      if (!v.ok) return err(res, v.status, "No se pudo bajar el video terminado.");
      const bin = Buffer.from(await v.arrayBuffer());
      const path = "nanina/videos/" + id + ".mp4";
      const up = await fetch(`${SB}/storage/v1/object/nexo2-fotos/${path}`, { method: "POST", headers: { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "video/mp4", "x-upsert": "true" }, body: bin });
      if (!up.ok) return err(res, 500, "No se pudo guardar el video (" + up.status + ").");
      return res.status(200).json({ estado: "completed", url: `${SB}/storage/v1/object/public/nexo2-fotos/${path}` });
    }

    if (op === "subir_url") {
      // subida directa desde el navegador (Reels armados en la app)
      const sk = process.env.SUPABASE_SERVICE_KEY;
      if (!sk) return err(res, 500, "Falta SUPABASE_SERVICE_KEY.");
      const ext = b.ext === "webm" ? "webm" : "mp4";
      const path = "nanina/reels/" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "." + ext;
      const r = await fetch(`${SB}/storage/v1/object/upload/sign/nexo2-fotos/${path}`, { method: "POST", headers: { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) return err(res, 502, "No se pudo preparar la subida.");
      const j = await r.json(); const rel = String(j.url || "");
      const up = rel.startsWith("http") ? rel : rel ? `${SB}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}` : j.token ? `${SB}/storage/v1/object/upload/sign/nexo2-fotos/${path}?token=${j.token}` : "";
      if (!up) return err(res, 502, "No se pudo preparar la subida.");
      return res.status(200).json({ up, url: `${SB}/storage/v1/object/public/nexo2-fotos/${path}` });
    }

    return err(res, 400, "Operación desconocida.");
  } catch (e) {
    return err(res, 500, (e && e.message) || "Error del estudio.");
  }
}
