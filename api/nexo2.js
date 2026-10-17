// NEXO 2.0 en el servidor: sincroniza la configuración de las obras y valida los códigos de acceso.
// Variables en Vercel:
//   SUPABASE_SERVICE_KEY -> secret / service_role key del proyecto nexo-entorno
//   NEXO_DIR_CODE        -> código inicial de Dirección (después se puede cambiar desde la app)
//   SUPABASE_URL         -> opcional
// Tabla: public.nexo2_estado (clave, valor jsonb, actualizado), cerrada para la clave pública.
// Los códigos viven SOLO acá: nunca se devuelven salvo a quien presenta el código de Dirección.

const URL_BASE = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const OLD_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co"; // app anterior (fotos de avance ya cargadas)
const OLD_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const OLD_PUB = OLD_URL + "/storage/v1/object/public/";
const NEW_PUB = URL_BASE + "/storage/v1/object/public/nexo2-fotos/";
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


    // ===== traer lo cargado en la app anterior (solo Dirección) =====
    if (b.op === "av_import") {
      if (!dirOk(b.dir)) { await pausa(600); res.status(403).json({ error: "No autorizado" }); return; }
      const oh = { apikey: OLD_KEY, Authorization: "Bearer " + OLD_KEY };
      const leerOld = async (k) => {
        const r = await fetch(`${OLD_URL}/rest/v1/bco_storage?key=eq.${k}&select=value&limit=1`, { headers: oh });
        if (!r.ok) throw new Error("old " + r.status);
        const rows = await r.json();
        return rows[0] ? JSON.parse(rows[0].value) : null;
      };
      const obrasOld = (await leerOld("vv_obras")) || [];
      const avOld = (await leerOld("vv_avance")) || {};
      const nombre = {};
      (Array.isArray(obrasOld) ? obrasOld : []).forEach((o) => { if (o && o.id) nombre[o.id] = o.nombre || o.name || o.id; });
      if (b.modo !== "run") {
        const lista = Object.keys(avOld).map((id) => ({
          id, nombre: nombre[id] || id,
          n: (avOld[id] || []).length,
          fotos: (avOld[id] || []).reduce((t, h) => t + ((h.fotos && h.fotos.length) || (h.fotoUrl ? 1 : 0)), 0),
        })).filter((x) => x.n > 0);
        res.status(200).json({ obras: lista });
        return;
      }
      const map = b.map || {};
      let creados = 0, saltados = 0;
      for (const [oldId, nuevo] of Object.entries(map)) {
        if (!nuevo || !/^[A-Za-z0-9_-]{1,40}$/.test(nuevo) || !Array.isArray(avOld[oldId])) continue;
        const clave = "avances_" + nuevo;
        const v = await leer(H, clave);
        const items = (v && v.items) || [];
        const ids = new Set(items.map((x) => x.id));
        for (const h of avOld[oldId]) {
          if (!h || !h.id) continue;
          const id = "imp_" + String(h.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
          if (ids.has(id)) { saltados++; continue; }
          let fotos = Array.isArray(h.fotos) ? h.fotos : [];
          if (!fotos.length && h.fotoUrl) fotos = [h.fotoUrl];
          fotos = fotos.filter((u) => typeof u === "string" && u.startsWith(OLD_PUB)).slice(0, 12);
          let fecha = Number(h.ts) || 0;
          if (!fecha && typeof h.fecha === "string") { const [d, m, a] = h.fecha.split("/"); if (a) fecha = Date.parse(`20${a.slice(-2)}-${m}-${d}T12:00:00-03:00`); }
          if (!fecha) fecha = Date.now();
          const resumen = String(h.avance || "").replace(/\s+/g, " ").trim().slice(0, 700);
          const txt = String(h.descripcion || "").replace(/\s+/g, " ").trim().slice(0, 700);
          if (!fotos.length && !resumen && !txt) continue;
          items.push({ id, fecha, sector: "", txt: resumen ? "" : txt, resumen, autor: "App anterior", fotos, importado: true });
          creados++;
        }
        await escribir(H, clave, { items: items.sort((x, y) => x.fecha - y.fecha).slice(-1000) });
      }
      res.status(200).json({ ok: true, creados, saltados });
      return;
    }

    // ===== avances de obra con fotos =====
    if (typeof b.op === "string" && b.op.startsWith("av_")) {
      const obra = String(b.obra || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const clave = "avances_" + obra;
      if (b.op === "av_list") {
        const v = await leer(H, clave);
        res.status(200).json({ items: (v && v.items) || [] });
        return;
      }
      // el resto exige código de Dirección o de la jefatura de esa obra
      const cr = b.cred || {};
      let quien = "";
      if (cr.rol === "dir" && dirOk(cr.codigo)) quien = "dir";
      else if (cr.rol === "jefe" && norm(cr.codigo) && norm((cods.obras[obra] || {}).j) === norm(cr.codigo)) quien = "jefe";
      if (!quien) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código para cargar avances." }); return; }

      if (b.op === "av_foto") {
        const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(b.data || ""));
        if (!m || m[2].length > 4_000_000) { res.status(400).json({ error: "Foto inválida o muy pesada" }); return; }
        const buf = Buffer.from(m[2], "base64");
        const ext = m[1] === "jpeg" ? "jpg" : m[1];
        const path = `${obra}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const subir = () => fetch(`${URL_BASE}/storage/v1/object/nexo2-fotos/${path}`, {
          method: "POST", headers: { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "image/" + m[1], "x-upsert": "true" }, body: buf,
        });
        let r = await subir();
        if (!r.ok) {
          await fetch(`${URL_BASE}/storage/v1/bucket`, { method: "POST", headers: H, body: JSON.stringify({ id: "nexo2-fotos", name: "nexo2-fotos", public: true }) });
          r = await subir();
        }
        if (!r.ok) { res.status(502).json({ error: "No se pudo guardar la foto" }); return; }
        res.status(200).json({ url: `${URL_BASE}/storage/v1/object/public/nexo2-fotos/${path}` });
        return;
      }
      if (b.op === "av_add") {
        const it = b.item || {};
        const fotos = (Array.isArray(it.fotos) ? it.fotos : []).filter((u) => typeof u === "string" && u.startsWith(NEW_PUB)).slice(0, 12);
        const item = {
          id: "av" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          fecha: Number(it.fecha) || Date.now(),
          sector: String(it.sector || "").slice(0, 120),
          txt: String(it.txt || "").slice(0, 2000),
          autor: String(it.autor || (quien === "dir" ? "Dirección" : "Jefatura de obra")).slice(0, 80),
          fotos,
        };
        if (!item.txt && !fotos.length) { res.status(400).json({ error: "Cargá una foto o un texto" }); return; }
        const v = await leer(H, clave);
        const items = [...((v && v.items) || []), item].slice(-500);
        await escribir(H, clave, { items });
        res.status(200).json({ ok: true, item });
        return;
      }
      if (b.op === "av_resumen") {
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) { res.status(500).json({ error: "Falta ANTHROPIC_API_KEY" }); return; }
        const v = await leer(H, clave);
        const items = (v && v.items) || [];
        const i = items.findIndex((x) => x.id === b.id);
        if (i < 0) { res.status(404).json({ error: "No existe" }); return; }
        const cur = items[i];
        if (!cur.fotos || !cur.fotos.length) { res.status(200).json({ ok: true }); return; }
        const prev = items.filter((x) => x.id !== cur.id && x.fecha < cur.fecha && x.fotos && x.fotos.length).sort((p, q) => q.fecha - p.fecha)[0];
        const img = (u) => ({ type: "image", source: { type: "url", url: u } });
        const content = [];
        if (prev) { content.push({ type: "text", text: "FOTOS ANTERIORES:" }); prev.fotos.slice(0, 3).forEach((u) => content.push(img(u))); }
        content.push({ type: "text", text: prev ? "FOTOS ACTUALES:" : "FOTOS ACTUALES (no hay fotos anteriores para comparar):" });
        cur.fotos.slice(0, 4).forEach((u) => content.push(img(u)));
        const fechaTxt = (t) => new Date(t - 108e5).toISOString().slice(0, 10);
        content.push({ type: "text", text: (prev ? `Las fotos anteriores son del ${fechaTxt(prev.fecha)} y las actuales del ${fechaTxt(cur.fecha)}. ` : "") + (cur.sector ? `Sector: ${cur.sector}. ` : "") + (cur.txt ? `El jefe de obra escribió: "${cur.txt}". ` : "") + (prev ? "Resumí en 2 o 3 oraciones qué avanzó entre las fotos anteriores y las actuales y qué se ve pendiente. Si no se puede comparar, decilo." : "Describí en 2 oraciones qué se ve y en qué etapa está.") });
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-5", max_tokens: 400,
            system: "Sos un inspector de obra civil en Argentina. Comparás fotos de avance con criterio técnico y sos honesto: no inventes lo que no se ve. Respondé en español rioplatense (vos), claro y breve, sin títulos ni listas, máximo 3 oraciones.",
            messages: [{ role: "user", content }],
          }),
        });
        const d = await r.json();
        const txt = d && d.content && d.content.find((c) => c.type === "text");
        if (!r.ok || !txt) { res.status(502).json({ error: "No se pudo analizar las fotos" }); return; }
        items[i] = { ...cur, resumen: txt.text.trim().slice(0, 900) };
        const v2 = await leer(H, clave);
        const items2 = ((v2 && v2.items) || []).map((x) => (x.id === cur.id ? items[i] : x));
        await escribir(H, clave, { items: items2 });
        res.status(200).json({ ok: true, resumen: items[i].resumen });
        return;
      }
      if (b.op === "av_del") {
        const v = await leer(H, clave);
        const items = ((v && v.items) || []).filter((x) => x.id !== b.id);
        await escribir(H, clave, { items });
        res.status(200).json({ ok: true });
        return;
      }
    }
    res.status(400).json({ error: "Operación inválida" });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
}
