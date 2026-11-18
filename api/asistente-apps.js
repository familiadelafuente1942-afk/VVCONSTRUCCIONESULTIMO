// MiAsistente consulta las otras apps (NEXO 2, Barracas, Finanzas cliente, Seguimiento, Contratistas) en SOLO LECTURA,
// con las mismas consultas que los conectores de Claude. La llave se guarda en el teléfono de Sebastián (no en el código):
// acá solo está su huella (SHA-256).
import crypto from "crypto";
import { correrApp, CATALOGO } from "./mcp-apps.js";
import { correrNexo, CATALOGO_NEXO } from "./mcp-nexo.js";
const HUELLA = "cdd780b43fae5c0511f66e63c56fc4d4bcba90ee02c6b78a8c44fd259b2bcd4f";
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST" }); return; }
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } } b = b || {};
  const h = crypto.createHash("sha256").update("asistente-apps:" + String(b.llave || "")).digest("hex");
  if (!b.llave || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(HUELLA))) { res.status(401).json({ error: "Falta conectar MiAsistente con las apps (abrí el link de conexión una vez)." }); return; }
  if (b.op === "catalogo") { res.status(200).json({ nexo2: CATALOGO_NEXO, ...CATALOGO }); return; }
  try {
    const app = String(b.app || ""), q = String(b.consulta || "");
    const tx = app === "nexo2" ? await correrNexo(q, b.args) : await correrApp(app, q, b.args);
    res.status(200).json({ ok: true, texto: String(tx || "").slice(0, 80000) });
  } catch (e) { res.status(200).json({ ok: false, error: e.message || "No se pudo consultar" }); }
}
