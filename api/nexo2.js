// NEXO 2.0 en el servidor: sincroniza la configuración de las obras y valida los códigos de acceso.
// Variables en Vercel:
//   SUPABASE_SERVICE_KEY -> secret / service_role key del proyecto nexo-entorno
//   NEXO_DIR_CODE        -> código inicial de Dirección (después se puede cambiar desde la app)
//   SUPABASE_URL         -> opcional
// Tabla: public.nexo2_estado (clave, valor jsonb, actualizado), cerrada para la clave pública.
// Los códigos viven SOLO acá: nunca se devuelven salvo a quien presenta el código de Dirección.

const URL_BASE = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const norm = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Códigos vigentes al momento de cerrar el sistema (se usan una sola vez, hasta que Dirección los guarde).
const SEED = {
  o1: { clave: "LP132-4827", j: "J-LP132-3516", a: "A-LP132-8240" },
  o2: { clave: "CA475-3159", j: "J-CA475-6127", a: "A-CA475-4093" },
  o3: { clave: "GO293-7062", j: "J-GO293-9051", a: "A-GO293-2674" },
  o4: { clave: "LP246-9514", j: "J-LP246-1738", a: "A-LP246-5809" },
  o5: { clave: "SB88-2406", j: "J-SB88-7342", a: "A-SB88-3961" },
};
const FIELD = { prop: "clave", jefe: "j", aud: "a" };

function headers(sk) {
  return { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
}
async function leer(H, clave) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=valor&clave=eq.${clave}`, { headers: H });
  if (!r.ok) throw new Error("db " + r.status);
  const rows = await r.json();
  return rows[0] ? rows[0].valor : null;
}
async function escribir(H, clave, valor) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?on_conflict=clave`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ clave, valor, actualizado: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("db " + r.status);
}
async function leerCodigos(H) {
  let v = await leer(H, "codigos");
  if (v && typeof v.v === "string") { try { v = JSON.parse(v.v); } catch { v = null; } }
  if (v && v.obras) return { dir: v.dir || "", obras: v.obras, seed: false };
  return { dir: "", obras: JSON.parse(JSON.stringify(SEED)), seed: true };
}
const dirVigente = (c) => c.dir || process.env.NEXO_DIR_CODE || process.env.NEXO2_DIR_CODE || "";
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  const sk = process.env.SUPABASE_SERVICE_KEY;
  if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY en Vercel." }); return; }
  const H = headers(sk);
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const v = await leer(H, "cfg");
      res.status(200).json(v ? { cfg: v } : {});
      return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    // configuración de obras (no secreta)
    if (!b.op) {
      if (b.key !== "cfg" || typeof b.v !== "string" || b.v.length > 2_000_000 || typeof b.t !== "number") {
        res.status(400).json({ error: "Datos inválidos" }); return;
      }
      await escribir(H, "cfg", { t: b.t, v: b.v });
      res.status(200).json({ ok: true });
      return;
    }

    const cods = await leerCodigos(H);
    const dirOk = (c) => { const d = norm(dirVigente(cods)); return !!d && norm(c) === d; };

    if (b.op === "login") {
      const n = norm(b.codigo);
      if (b.rol === "dir") {
        if (!dirVigente(cods)) { res.status(200).json({ ok: false, error: "Falta NEXO_DIR_CODE en Vercel." }); return; }
        if (dirOk(b.codigo)) { res.status(200).json({ ok: true }); return; }
      } else if (FIELD[b.rol] && n) {
        const id = Object.keys(cods.obras).find((k) => norm((cods.obras[k] || {})[FIELD[b.rol]]) === n);
        if (id && n !== norm(dirVigente(cods))) { res.status(200).json({ ok: true, obra: id }); return; }
      }
      await pausa(600);
      res.status(200).json({ ok: false });
      return;
    }

    if (b.op === "cods_get") {
      if (!dirOk(b.dir)) { await pausa(600); res.status(403).json({ error: "No autorizado" }); return; }
      res.status(200).json({ dir: dirVigente(cods), obras: cods.obras, seed: cods.seed });
      return;
    }

    if (b.op === "cods_set") {
      if (!dirOk(b.dir)) { await pausa(600); res.status(403).json({ error: "No autorizado" }); return; }
      const d = b.data || {};
      const obras = {};
      const vistos = new Set();
      const nd = norm(d.dir || dirVigente(cods));
      if (nd.length < 4) { res.status(400).json({ error: "Código de Dirección inválido" }); return; }
      vistos.add(nd);
      for (const [id, x] of Object.entries(d.obras || {})) {
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || typeof x !== "object") continue;
        const o = {};
        for (const f of ["clave", "j", "a"]) {
          const n = norm(x[f]);
          if (n) { if (vistos.has(n)) { res.status(400).json({ error: "Código repetido: " + x[f] }); return; } vistos.add(n); }
          o[f] = String(x[f] || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
        }
        obras[id] = o;
      }
      const dir = String(d.dir || dirVigente(cods)).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
      await escribir(H, "codigos", { dir, obras });
      res.status(200).json({ ok: true });
      return;
    }
    res.status(400).json({ error: "Operación inválida" });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
}
