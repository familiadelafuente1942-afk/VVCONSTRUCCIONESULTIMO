const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";

// Precios en USD por millón de tokens (entrada, salida)
const PRECIOS = {
  "claude-sonnet-5": { entrada: 2.00, salida: 10.00 },
  "claude-sonnet-4-6": { entrada: 3.00, salida: 15.00 },
  "claude-haiku-4-5-20251001": { entrada: 1.00, salida: 5.00 },
  "claude-3-haiku-20240307": { entrada: 0.25, salida: 1.25 },
  "claude-opus-5": { entrada: 5.00, salida: 25.00 },
};

async function registrarUsoIA({ app, origen, obra, modelo, tokensEntrada, tokensSalida }) {
  try {
    const precio = PRECIOS[modelo] || { entrada: 0, salida: 0 };
    const costoUsd =
      (tokensEntrada / 1_000_000) * precio.entrada +
      (tokensSalida / 1_000_000) * precio.salida;
    await fetch(`${SUPA_URL}/rest/v1/ai_usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        app: app || "vv-construcciones",
        origen: origen || null,
        obra: obra || null,
        modelo,
        tokens_entrada: tokensEntrada || 0,
        tokens_salida: tokensSalida || 0,
        costo_usd: Number(costoUsd.toFixed(6)),
      }),
    });
  } catch (e) {
    // Nunca romper la respuesta al usuario por un fallo al registrar el uso
    console.error("No se pudo registrar uso de IA:", e);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Método no permitido" } });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: { message: "Falta ANTHROPIC_API_KEY en el servidor (Vercel -> Environment Variables)." } });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    };
    // Si el pedido incluye la herramienta web_fetch (leer páginas completas),
    // hace falta este header extra para que Anthropic la habilite.
    if ((body.tools || []).some(t => t.type === "web_fetch_20250910")) {
      headers["anthropic-beta"] = "web-fetch-2025-09-10";
    }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await r.json();
    res.status(r.status).json(data);

    // Registrar el uso en segundo plano (no bloquea ni retrasa la respuesta al usuario)
    if (r.ok && data && data.usage) {
      registrarUsoIA({
        app: "vv-construcciones",
        origen: (req.headers["x-nexo-origen"]) || null,
        obra: (req.headers["x-nexo-obra"]) || null,
        modelo: body.model,
        tokensEntrada: data.usage.input_tokens,
        tokensSalida: data.usage.output_tokens,
      });
    }
  } catch (e) {
    res.status(500).json({ error: { message: e.message || "Error en el proxy" } });
  }
}
