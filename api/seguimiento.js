// Seguimiento interno V+V (Sebastián y Nicolás): obras, tareas, personal, gastos y sueldo.
// Usa la misma base que NEXO 2.0 (tabla nexo2_estado, claves "seg_*"). Variables: SUPABASE_SERVICE_KEY (ya existe).
// Acceso: un código compartido que se crea la primera vez con el código de Dirección de NEXO; cada aparato queda
// recordado con un token propio (se guarda solo su huella en el servidor).

import crypto from "crypto";

const URL_BASE = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const norm = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const sha = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const headers = (sk) => ({ apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" });

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
async function codigoDir(H) {
  let v = await leer(H, "codigos");
  if (v && typeof v.v === "string") { try { v = JSON.parse(v.v); } catch { v = null; } }
  return (v && v.dir) || process.env.NEXO_DIR_CODE || process.env.NEXO2_DIR_CODE || "";
}

const OBRAS0 = [
  ["castores475", "Castores 475"], ["puentes132", "Los Puentes 132"], ["puentes246", "Los Puentes 246"],
  ["saenz01", "Sáenz Peña 01"], ["saenz011", "Sáenz Peña 011"], ["mayling37", "Mayling A37"],
];
const QUIEN = ["Sebastián", "Nicolás"];
const str = (x, n) => String(x == null ? "" : x).trim().slice(0, n);
const num = (x, lo, hi) => Math.min(hi, Math.max(lo, Number(x) || 0));
const ident = (x) => String(x || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
const ESTADOS = ["pend", "curso", "hecha"];

// Campos permitidos por colección
const COLS = {
  obras: (q) => ({ nombre: str(q.nombre, 80), orden: num(q.orden, 0, 999), nota: str(q.nota, 400), etapa: str(q.etapa, 120), nexo: ident(q.nexo) }),
  hitos: (q) => ({ obra: ident(q.obra), titulo: str(q.titulo, 120), fecha: num(q.fecha, 0, 4e12), tipo: ["hormigonado", "etapa", "entrega", "otro"].includes(q.tipo) ? q.tipo : "otro", hecho: !!q.hecho, nota: str(q.nota, 300), prevista: num(q.prevista, 0, 4e12), motivo: str(q.motivo, 300) }),
  bitacora: (q) => ({ obra: ident(q.obra), fecha: num(q.fecha, 0, 4e12), texto: str(q.texto, 2000) }),
  adicionales: (q) => ({ obra: ident(q.obra), fecha: num(q.fecha, 0, 4e12), titulo: str(q.titulo, 160), monto: num(q.monto, 0, 1e12), estado: ["pendiente", "aprobado", "rechazado", "cobrado"].includes(q.estado) ? q.estado : "pendiente", nota: str(q.nota, 600) }),
  tareas: (q) => ({
    ambito: str(q.ambito, 60), titulo: str(q.titulo, 200), nota: str(q.nota, 1000),
    inicio: num(q.inicio, 0, 4e12), fin: num(q.fin, 0, 4e12), inicioReal: num(q.inicioReal, 0, 4e12), finReal: num(q.finReal, 0, 4e12),
    estado: ESTADOS.includes(q.estado) ? q.estado : "pend", resp: str(q.resp, 80), prio: ["alta", "normal"].includes(q.prio) ? q.prio : "normal",
    orden: num(q.orden, 0, 99999),
  }),
  personal: (q) => ({ obra: ident(q.obra), nombre: str(q.nombre, 80), rol: str(q.rol, 80), haciendo: str(q.haciendo, 200), nota: str(q.nota, 300), activo: q.activo !== false }),
  agenda: (q) => ({ fecha: num(q.fecha, 0, 4e12), quien: ["Nicolás", "Sebastián", "Ambos", "Nadie"].includes(q.quien) ? q.quien : "Nicolás", lugar: str(q.lugar, 80), obra: ident(q.obra), motivo: str(q.motivo, 400), hecho: !!q.hecho }),
  gastos: (q) => ({
    fecha: num(q.fecha, 0, 4e12), concepto: str(q.concepto, 200), monto: num(q.monto, 0, 1e12), cat: str(q.cat, 60),
    de: q.de === "Nicolás" ? "Nicolás" : "Empresa", obra: ident(q.obra), nota: str(q.nota, 400),
  }),
  sueldos: (q) => ({ mes: str(q.mes, 7), monto: num(q.monto, 0, 1e12), fecha: num(q.fecha, 0, 4e12), pagado: !!q.pagado, nota: str(q.nota, 400) }),
};

async function leerCol(H, col) {
  const v = await leer(H, "seg_" + col);
  return (v && Array.isArray(v.items) && v.items) || [];
}

export default async function handler(req, res) {
  const sk = process.env.SUPABASE_SERVICE_KEY;
  if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY en Vercel." }); return; }
  const H = headers(sk);
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const cfg = (await leer(H, "seg_cfg")) || { hash: "", salt: "", tokens: [] };

    if (b.op === "estado") { res.status(200).json({ configurado: !!cfg.hash }); return; }

    if (b.op === "setup") {
      const dir = await codigoDir(H);
      if (cfg.hash) { res.status(409).json({ error: "El código ya está creado." }); return; }
      if (!dir || norm(b.dir) !== norm(dir)) { await pausa(700); res.status(403).json({ error: "Código de Dirección incorrecto." }); return; }
      const nuevo = norm(b.codigo);
      if (nuevo.length < 4) { res.status(400).json({ error: "Elegí un código de al menos 4 letras o números." }); return; }
      const salt = crypto.randomBytes(8).toString("hex");
      await escribir(H, "seg_cfg", { hash: sha(salt + nuevo), salt, tokens: [] });
      res.status(200).json({ ok: true });
      return;
    }

    if (b.op === "login") {
      if (!cfg.hash) { res.status(200).json({ ok: false, error: "Todavía no hay código creado." }); return; }
      if (!QUIEN.includes(b.quien)) { res.status(400).json({ error: "Elegí quién sos." }); return; }
      if (sha(cfg.salt + norm(b.codigo)) !== cfg.hash) { await pausa(800); res.status(200).json({ ok: false, error: "Código incorrecto." }); return; }
      const token = crypto.randomBytes(24).toString("base64url");
      const tokens = [{ h: sha(token), quien: b.quien, t: Date.now() }, ...(cfg.tokens || [])].slice(0, 30);
      await escribir(H, "seg_cfg", { ...cfg, tokens });
      res.status(200).json({ ok: true, token, quien: b.quien });
      return;
    }

    // ---- desde acá hace falta un aparato reconocido ----
    // App abierta (sin código): solo se indica quién es.
    const quien = QUIEN.includes(b.quien) ? b.quien : "Sebastián";
    const tk = { h: "", quien };

    if (b.op === "logout") {
      res.status(200).json({ ok: true });
      return;
    }

    if (b.op === "cambiar_codigo") {
      const nuevo = norm(b.codigo);
      if (nuevo.length < 4) { res.status(400).json({ error: "Elegí un código de al menos 4 letras o números." }); return; }
      const salt = crypto.randomBytes(8).toString("hex");
      await escribir(H, "seg_cfg", { hash: sha(salt + nuevo), salt, tokens: [tk] });
      res.status(200).json({ ok: true, aviso: "Los demás aparatos van a pedir el código nuevo." });
      return;
    }

    if (b.op === "todo") {
      let obras = await leerCol(H, "obras");
      if (!obras.length) {
        obras = OBRAS0.map(([id, nombre], i) => ({ id, nombre, orden: i, nota: "", por: "sistema", creado: Date.now(), editado: Date.now() }));
        await escribir(H, "seg_obras", { items: obras });
      }
      const [tareas, personal, gastos, sueldos, agenda, hitos, bitacora, adicionales] = await Promise.all(["tareas", "personal", "gastos", "sueldos", "agenda", "hitos", "bitacora", "adicionales"].map((c) => leerCol(H, c)));
      res.status(200).json({ ok: true, quien, obras, tareas, personal, gastos, sueldos, agenda, hitos, bitacora, adicionales, ahora: Date.now() });
      return;
    }

    // ---- lectura de NEXO 2 (solo lectura: acá nunca se escribe nada en NEXO 2) ----
    if (b.op === "nexo") {
      const MAP = { puentes132: "o1", castores475: "o2", puentes246: "o4" };
      const obras = await leerCol(H, "obras");
      const out = {};
      for (const o of obras) {
        const nid = o.nexo || MAP[o.id];
        if (!nid || !/^[A-Za-z0-9_-]{1,40}$/.test(nid)) continue;
        const [snap, inf] = await Promise.all([leer(H, "snap_" + nid), leer(H, "informes_" + nid)]);
        const I = ((inf && inf.items) || []).slice().sort((x, y) => (y.desde || 0) - (x.desde || 0));
        const ult = I[0];
        const frenadas = ult ? (ult.tareas || []).filter((t) => t.causa && (t.av === null || t.av < 100) && t.causa !== "Interna de la constructora").map((t) => ({ name: t.name, causa: t.causa, causaTxt: t.causaTxt || "", resp: t.resp || "", desde: t.desdeF || 0, card: t.card || "", av: t.av })) : [];
        out[o.id] = { nexo: nid, snapT: (snap && snap.t) || 0, cards: (snap && snap.cards) || [], informeDesde: ult ? ult.desde : 0, informeHasta: ult ? ult.hasta : 0, frenadas };
      }
      res.status(200).json({ ok: true, nexo: out });
      return;
    }

    const col = String(b.col || "");
    if (!COLS[col]) { res.status(400).json({ error: "Colección inválida" }); return; }

    if (b.op === "guardar") {
      const q = b.item || {};
      if (JSON.stringify(q).length > 6000) { res.status(400).json({ error: "Dato demasiado largo" }); return; }
      const id = ident(q.id) || col[0] + Date.now().toString(36) + crypto.randomBytes(2).toString("hex");
      const items = await leerCol(H, col);
      const prev = items.find((x) => x.id === id);
      const item = { ...COLS[col](q), id, por: (prev && prev.por) || quien, creado: (prev && prev.creado) || Date.now(), editado: Date.now(), editor: quien };
      if (col === "tareas" && !item.ambito) { res.status(400).json({ error: "Falta el ámbito" }); return; }
      if (col === "obras" && !item.nombre) { res.status(400).json({ error: "Falta el nombre" }); return; }
      const sin = items.filter((x) => x.id !== id);
      sin.push(item);
      await escribir(H, "seg_" + col, { items: sin.slice(-3000) });
      res.status(200).json({ ok: true, item });
      return;
    }

    if (b.op === "borrar") {
      const id = ident(b.id);
      const items = await leerCol(H, col);
      await escribir(H, "seg_" + col, { items: items.filter((x) => x.id !== id) });
      if (col === "obras") {
        for (const c of ["tareas", "personal", "hitos", "bitacora", "adicionales"]) {
          const L = await leerCol(H, c);
          const k = c === "tareas" ? (x) => x.ambito === "obra:" + id : (x) => x.obra === id;
          if (L.some(k)) await escribir(H, "seg_" + c, { items: L.filter((x) => !k(x)) });
        }
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "Operación desconocida" });
  } catch (e) {
    res.status(500).json({ error: "Error del servidor" });
  }
}
