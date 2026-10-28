// NEXO 2.0 en el servidor: sincroniza la configuración de las obras y valida los códigos de acceso.
// Variables en Vercel:
//   SUPABASE_SERVICE_KEY -> secret / service_role key del proyecto nexo-entorno
//   NEXO_DIR_CODE        -> código inicial de Dirección (después se puede cambiar desde la app)
//   SUPABASE_URL         -> opcional
// Tabla: public.nexo2_estado (clave, valor jsonb, actualizado), cerrada para la clave pública.
// Los códigos viven SOLO acá: nunca se devuelven salvo a quien presenta el código de Dirección.

import crypto from "crypto";

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
const FIELD = { prop: "clave", jefe: "j", aud: "a", est: "e" };

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

// ===== sesión del aparato (cookie firmada de 400 días) =====
// Recuerda en el servidor qué códigos ya se ingresaron en este aparato, así no se vuelven a pedir aunque
// el navegador borre su memoria local. No usa la IP (cambia con el wifi/datos y la comparten varias personas).
const COOKIE = "nexo2_dev";
const secreto = () => process.env.NEXO_COOKIE_SECRET || process.env.SUPABASE_SERVICE_KEY || "";
function firmar(obj) {
  const p = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return p + "." + crypto.createHmac("sha256", secreto()).update(p).digest("base64url");
}
function abrirTok(tok) {
  try {
    const [p, f] = String(tok || "").split(".");
    if (!p || !f) return null;
    const e = crypto.createHmac("sha256", secreto()).update(p).digest("base64url");
    const a = Buffer.from(f), c = Buffer.from(e);
    if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
    return JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch { return null; }
}
function leerSes(req) {
  const m = String(req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  const d = m && abrirTok(decodeURIComponent(m[1]));
  return d && typeof d === "object" ? d : {};
}
function ponerSes(res, d) {
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(firmar(d))}; Max-Age=34560000; Path=/; HttpOnly; Secure; SameSite=Lax`);
}
const limpio = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  const sk = process.env.SUPABASE_SERVICE_KEY;
  if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY en Vercel." }); return; }
  const H = headers(sk);
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET" && req.query && req.query.stats) {
      // solo conteos (sin nombres ni contenido) para el panel NEXO Control
      res.setHeader("Access-Control-Allow-Origin", "*");
      const cods = await leerCodigos(H);
      const ids = Object.keys(cods.obras || {});
      const ahora = Date.now(), DIA = 864e5, ini = Math.floor((ahora - 108e5) / DIA) * DIA + 108e5;
      const out = { ok: true, obras: ids.length, informes: 0, informesHoy: 0, informes7: 0, avances: 0, avancesHoy: 0, avances7: 0, fotos: 0, ultima: 0, obrasConInforme: 0 };
      for (const id of ids) {
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) continue;
        const [iv, av] = await Promise.all([leer(H, "informes_" + id), leer(H, "avances_" + id)]);
        const I = (iv && iv.items) || [], A = (av && av.items) || [];
        if (I.length) out.obrasConInforme++;
        I.forEach((x) => { out.informes++; const t = Number(x.editado) || Number(x.fecha) || 0; if (t >= ini) out.informesHoy++; if (t >= ahora - 7 * DIA) out.informes7++; if (t > out.ultima) out.ultima = t; });
        A.forEach((x) => { out.avances++; out.fotos += (x.fotos || []).length; const t = Number(x.creado) || Number(x.fecha) || 0; if (t >= ini) out.avancesHoy++; if (t >= ahora - 7 * DIA) out.avances7++; });
      }
      const cfg = await leer(H, "cfg"); if (cfg && Number(cfg.t) > out.ultima) out.ultima = Number(cfg.t);
      res.status(200).json(out);
      return;
    }
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
        if (dirOk(b.codigo)) { const ses = leerSes(req); ses.dir = limpio(b.codigo); ses.last = { r: "dir" }; ponerSes(res, ses); res.status(200).json({ ok: true }); return; }
      } else if (FIELD[b.rol] && n) {
        const id = Object.keys(cods.obras).find((k) => norm((cods.obras[k] || {})[FIELD[b.rol]]) === n);
        if (id && n !== norm(dirVigente(cods))) {
          const ses = leerSes(req); const k = b.rol; ses[k] = ses[k] || {}; ses[k][id] = limpio(b.codigo);
          ses.last = { r: k === "prop" ? "cli" : k, cobra: k === "prop" ? id : undefined };
          ponerSes(res, ses);
          res.status(200).json({ ok: true, obra: id }); return;
        }
      }
      await pausa(600);
      res.status(200).json({ ok: false });
      return;
    }

    if (b.op === "sesion") {
      // devuelve lo que este aparato ya tenía autorizado (y sigue siendo válido con los códigos de hoy)
      const ses = leerSes(req);
      const out = { ok: true, prop: [], jefe: [], aud: [], est: [], last: ses.last || null };
      if (ses.dir && dirOk(ses.dir)) out.dir = ses.dir; else delete ses.dir;
      for (const rol of ["prop", "jefe", "aud", "est"]) {
        for (const [id, cod] of Object.entries(ses[rol] || {})) {
          const o = cods.obras[id];
          if (o && norm(o[FIELD[rol]]) === norm(cod)) out[rol].push({ id, codigo: cod }); else delete ses[rol][id];
        }
      }
      if (!out.dir && !out.prop.length && !out.jefe.length && !out.aud.length && !out.est.length && !(ses.last && ses.last.r === "est")) { res.status(200).json({ ok: false }); return; }
      ponerSes(res, ses);
      res.status(200).json(out); return;
    }
    if (b.op === "sesion_set") {
      const ses = leerSes(req); const l = b.last || {};
      if (["dir", "jefe", "aud", "cli", "est"].includes(l.r)) { ses.last = { r: l.r, cobra: String(l.cobra || "").slice(0, 40) || undefined, cons: String(l.cons || "").slice(0, 80) || undefined }; ponerSes(res, ses); }
      res.status(200).json({ ok: true }); return;
    }
    if (b.op === "sesion_borrar") {
      res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
      res.status(200).json({ ok: true }); return;
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
        for (const f of ["clave", "j", "a", "e"]) {
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
      let creados = 0, saltados = 0, completados = 0;
      for (const [oldId, nuevo] of Object.entries(map)) {
        if (!nuevo || !/^[A-Za-z0-9_-]{1,40}$/.test(nuevo) || !Array.isArray(avOld[oldId])) continue;
        const clave = "avances_" + nuevo;
        const v = await leer(H, clave);
        const items = (v && v.items) || [];
        const ids = new Set(items.map((x) => x.id));
        const porId = new Map(items.map((x) => [x.id, x]));
        for (const h of avOld[oldId]) {
          if (!h || !h.id) continue;
          const id = "imp_" + String(h.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
          if (ids.has(id)) {
            // los informes importados antes se habían cortado a 700 caracteres: se completan
            const ex = porId.get(id), full = String(h.avance || "").replace(/\s+/g, " ").trim().slice(0, 4000);
            if (ex && ex.importado && full.length > String(ex.resumen || "").length) { ex.resumen = full; completados++; }
            saltados++; continue;
          }
          let fotos = Array.isArray(h.fotos) ? h.fotos : [];
          if (!fotos.length && h.fotoUrl) fotos = [h.fotoUrl];
          fotos = fotos.filter((u) => typeof u === "string" && u.startsWith(OLD_PUB)).slice(0, 12);
          let fecha = Number(h.ts) || 0;
          if (!fecha && typeof h.fecha === "string") { const [d, m, a] = h.fecha.split("/"); if (a) fecha = Date.parse(`20${a.slice(-2)}-${m}-${d}T12:00:00-03:00`); }
          if (!fecha) fecha = Date.now();
          const resumen = String(h.avance || "").replace(/\s+/g, " ").trim().slice(0, 4000);
          const txt = String(h.descripcion || "").replace(/\s+/g, " ").trim().slice(0, 700);
          if (!fotos.length && !resumen && !txt) continue;
          items.push({ id, fecha, sector: "", txt: resumen ? "" : txt, resumen, autor: "App anterior", fotos, importado: true });
          creados++;
        }
        await escribir(H, clave, { items: items.sort((x, y) => x.fecha - y.fecha).slice(-1000) });
      }
      res.status(200).json({ ok: true, creados, saltados, completados });
      return;
    }

    // ===== Gestión de obra (interna, solo Dirección): registros de retrasos con causa, fotos y perjuicio =====
    if (typeof b.op === "string" && b.op.startsWith("ges_")) {
      const obra = String(b.obra || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const cr = b.cred || {};
      if (!(cr.rol === "dir" && dirOk(cr.codigo))) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código de Dirección." }); return; }
      const clave = "gestion_" + obra;
      if (b.op === "ges_list") {
        const v = await leer(H, clave);
        res.status(200).json({ items: (v && v.items) || [] });
        return;
      }
      if (b.op === "ges_del") {
        const v = await leer(H, clave);
        await escribir(H, clave, { items: ((v && v.items) || []).filter((x) => x.id !== b.id) });
        res.status(200).json({ ok: true });
        return;
      }
      if (b.op === "ges_save") {
        const q = b.registro || {};
        const id = String(q.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
        if (!id) { res.status(400).json({ error: "Registro inválido" }); return; }
        const str = (x, n) => String(x == null ? "" : x).slice(0, n);
        const num = (x, lo, hi) => Math.min(hi, Math.max(lo, Number(x) || 0));
        const fts = (arr) => (Array.isArray(arr) ? arr : [])
          .filter((f) => f && typeof f.u === "string" && (f.u.startsWith(NEW_PUB) || f.u.startsWith(OLD_PUB)))
          .map((f) => ({ u: f.u, f: num(f.f, 0, 4e12) })).slice(0, 40);
        const r = {
          id, titulo: str(q.titulo, 200), tid: str(q.tid, 60), tarea: str(q.tarea, 200), etapa: str(q.etapa, 120),
          resp: str(q.resp, 120), personal: str(q.personal, 400),
          posible: num(q.posible, 0, 4e12), inicio: num(q.inicio, 0, 4e12), fin: num(q.fin, 0, 4e12),
          estDias: num(q.estDias, 0, 2000), realDias: num(q.realDias, 0, 2000), arranqueDias: num(q.arranqueDias, 0, 2000),
          causas: (Array.isArray(q.causas) ? q.causas : []).slice(0, 10).map((c) => str(c, 120)), causaTxt: str(q.causaTxt, 500),
          evitable: !!q.evitable, imputable: str(q.imputable, 120), detenida: str(q.detenida, 300), certAfecta: str(q.certAfecta, 300),
          personas: num(q.personas, 0, 500), valor: num(q.valor, 0, 1e9), nota: str(q.nota, 2000),
          tipo: q.tipo === "hecho" ? "hecho" : "retraso", desc: str(q.desc, 3000), fecha: num(q.fecha, 0, 4e12), costo: num(q.costo, 0, 1e12),
          fotosIni: fts(q.fotosIni), fotosFin: fts(q.fotosFin), creado: num(q.creado, 0, 4e12) || Date.now(), editado: Date.now(),
        };
        const v = await leer(H, clave);
        const items = ((v && v.items) || []).filter((x) => x.id !== id);
        items.push(r);
        await escribir(H, clave, { items: items.slice(-300) });
        res.status(200).json({ ok: true, registro: r });
        return;
      }
      res.status(400).json({ error: "Operación desconocida" });
      return;
    }

    // ===== resumen de tarjetas abiertas (lo publica NEXO 2 para la app interna de seguimiento; solo se lee desde allá) =====
    if (b.op === "snap_save") {
      const obra = String(b.obra || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const cr = b.cred || {};
      if (!(cr.rol === "dir" && dirOk(cr.codigo))) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código de Dirección." }); return; }
      const str = (x, n) => String(x == null ? "" : x).slice(0, n);
      const num = (x) => Math.min(4e12, Math.max(0, Number(x) || 0));
      const cards = (Array.isArray(b.cards) ? b.cards : []).slice(0, 80).map((c) => ({
        id: str(c.id, 40), tipo: c.tipo === "mat" ? "mat" : "doc", tarea: str(c.tarea, 120), limite: num(c.limite), color: str(c.color, 12), n: num(c.n),
        pend: (Array.isArray(c.pend) ? c.pend : []).slice(0, 12).map((i) => ({ txt: str(i.txt, 160), resp: str(i.resp, 60), tipo: str(i.tipo, 40) })),
      }));
      const I = b.info || {}; const dots = I.dots || {};
      const info = { avance: num(I.avance), modelo: str(I.modelo, 120), jefe: str(I.jefe, 60), estudio: str(I.estudio, 60), entrega: num(I.entrega), base: num(I.base), desvio: Math.max(-999, Math.min(999, Math.round(Number(I.desvio) || 0))), vencidas: num(I.vencidas), defsOk: num(I.defsOk), defsTot: num(I.defsTot), etapa: str(I.etapa, 120), foto: /^https:\/\//.test(String(I.foto || "")) ? str(I.foto, 600) : /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(I.foto || "")) && String(I.foto).length < 300000 ? String(I.foto) : "", ubic: str(I.ubic, 80), plan: num(I.plan), fotosLoc: num(I.fotosLoc), fotos: (Array.isArray(I.fotos) ? I.fotos : []).filter((u) => /^https:\/\//.test(String(u))).slice(0, 12).map((u) => str(u, 600)), dots: { rojo: num(dots.rojo), naranja: num(dots.naranja), amarillo: num(dots.amarillo), verde: num(dots.verde), ok: num(dots.ok) } };
      await escribir(H, "snap_" + obra, { t: Date.now(), nombre: str(b.nombre, 80), cards, info });
      res.status(200).json({ ok: true });
      return;
    }

    // ===== informes semanales (único punto de carga; de ahí salen los avances) =====
    if (typeof b.op === "string" && b.op.startsWith("inf_")) {
      const obra = String(b.obra || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const clave = "informes_" + obra, claveAv = "avances_" + obra;
      if (b.op === "inf_list") {
        const v = await leer(H, clave);
        res.status(200).json({ items: (v && v.items) || [] });
        return;
      }
      const cr = b.cred || {};
      let quien = "";
      if (cr.rol === "dir" && dirOk(cr.codigo)) quien = "dir";
      else if (cr.rol === "jefe" && norm(cr.codigo) && norm((cods.obras[obra] || {}).j) === norm(cr.codigo)) quien = "jefe";
      if (!quien) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código para guardar el informe." }); return; }
      const dia = (t) => new Date(t - 108e5).toISOString().slice(0, 10);
      const quitarAv = async (infId) => {
        const a = await leer(H, claveAv);
        const items = ((a && a.items) || []);
        const quedan = items.filter((x) => x.inf !== infId);
        return { items, quedan };
      };
      if (b.op === "inf_save") {
        const q = b.informe || {};
        const id = String(q.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
        if (!id) { res.status(400).json({ error: "Informe inválido" }); return; }
        const num = (x, lo, hi) => Math.min(hi, Math.max(lo, Number(x) || 0));
        const str = (x, n) => String(x == null ? "" : x).slice(0, n);
        const fotos = (Array.isArray(q.fotos) ? q.fotos : [])
          .filter((f) => f && typeof f.u === "string" && (f.u.startsWith(NEW_PUB) || f.u.startsWith(OLD_PUB)))
          .map((f) => ({ u: f.u, f: Number(f.f) > 0 && Number(f.f) <= Date.now() + 36e5 ? Number(f.f) : Date.now() }))
          .slice(0, 40);
        const inf = {
          id, n: num(q.n, 1, 9999), desde: num(q.desde, 0, 4e12), hasta: num(q.hasta, 0, 4e12),
          etapa: str(q.etapa, 80), av: num(q.av, 0, 100), avPlan: num(q.avPlan, 0, 100), trab: num(q.trab, 0, 7), lluvia: num(q.lluvia, 0, 7),
          dot: num(q.dot, 0, 9999), fin: str(q.fin, 40),
          v: num(q.v, 0, 9), cierre: num(q.cierre, 0, 4e12),
          tareas: (Array.isArray(q.tareas) ? q.tareas : []).slice(0, 150).map((t) => ({
            tid: str(t.tid, 60), name: str(t.name, 120), equipo: str(t.equipo, 80), fase: num(t.fase, 0, 9), etapa: str(t.etapa, 80), nivel: str(t.nivel, 40), tipo: str(t.tipo, 20),
            av: (t.av === null || t.av === undefined || t.av === "") ? null : num(t.av, 0, 100), previsto: num(t.previsto, 0, 100),
            estado: str(t.estado, 20), causa: str(t.causa, 120), causaTxt: str(t.causaTxt, 200), resp: str(t.resp, 40), desdeF: num(t.desdeF, 0, 4e12), card: str(t.card, 200),
            vinc: (Array.isArray(t.vinc) ? t.vinc : []).slice(0, 12).map((x) => str(x, 60)), add: !!t.add,
            sd: !!t.sd,
            nueva: t.nueva && typeof t.nueva === "object" ? { name: str(t.nueva.name, 120), etapa: str(t.nueva.etapa, 80) } : undefined,
          })),
          ejecutados: str(q.ejecutados, 6000), proxima: str(q.proxima, 4000), obs: str(q.obs, 4000), resumen: str(q.resumen, 4000),
          fotos, fecha: num(q.fecha, 0, 4e12), autor: quien === "dir" ? "Dirección" : "Jefatura de obra", editado: Date.now(),
        };
        if (!inf.ejecutados || !fotos.length) { res.status(400).json({ error: "El informe necesita lo ejecutado y al menos una foto" }); return; }
        const v = await leer(H, clave);
        const choque = ((v && v.items) || []).find((x) => x.id !== id && x.desde === inf.desde);
        if (choque && String(b.reemplazar || "") !== choque.id) { res.status(409).json({ ok: false, error: "dup", id: choque.id }); return; }
        if (choque) { const { quedan: q2 } = await quitarAv(choque.id); await escribir(H, claveAv, { items: q2 }); }
        let items = ((v && v.items) || []).filter((x) => x.id !== id && x.desde !== inf.desde);
        items.push(inf);
        items = items.sort((x, y) => x.desde - y.desde).slice(-300);
        await escribir(H, clave, { items });
        // los avances de este informe se rearman: una entrada por día de foto, con el resumen del informe
        const { items: avPrev, quedan } = await quitarAv(id);
        const prevRes = {};
        avPrev.filter((x) => x.inf === id).forEach((x) => { if (x.resumen) prevRes[x.fotos && x.fotos[0] ? x.fotos[0] : x.id] = x.resumen; });
        const grupos = {};
        fotos.forEach((f) => { (grupos[dia(f.f)] = grupos[dia(f.f)] || []).push(f); });
        const dias = Object.keys(grupos).sort();
        const corto = inf.ejecutados.replace(/\s+/g, " ").trim().slice(0, 420);
        const nuevos = dias.map((dk, k) => {
          const fs = grupos[dk];
          const ts = Math.min(...fs.map((f) => f.f));
          const it = { id: "av" + id + "_" + dk.replace(/-/g, ""), fecha: ts, sector: inf.etapa, txt: k === dias.length - 1 ? corto : "", autor: inf.autor, fotos: fs.map((f) => f.u), inf: id };
          const rr = prevRes[it.fotos[0]]; if (rr) it.resumen = rr;
          return it;
        });
        await escribir(H, claveAv, { items: [...quedan, ...nuevos].sort((x, y) => x.fecha - y.fecha).slice(-500) });
        res.status(200).json({ ok: true, informe: inf, avances: nuevos.map((x) => x.id) });
        return;
      }
      if (b.op === "inf_del") {
        const id = String(b.id || "");
        const v = await leer(H, clave);
        await escribir(H, clave, { items: ((v && v.items) || []).filter((x) => x.id !== id) });
        const { quedan } = await quitarAv(id);
        await escribir(H, claveAv, { items: quedan });
        res.status(200).json({ ok: true });
        return;
      }
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
          fecha: Number(it.fecha) > 0 && Number(it.fecha) <= Date.now() + 36e5 ? Number(it.fecha) : Date.now(),
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
            model: "claude-sonnet-5", max_tokens: 1200,
            system: "Sos un inspector de obra civil en Argentina. Comparás fotos de avance con criterio técnico y sos honesto: no inventes lo que no se ve. Respondé en español rioplatense (vos), claro y breve, sin títulos ni listas, máximo 4 oraciones, y terminá siempre la última oración completa.",
            messages: [{ role: "user", content }],
          }),
        });
        const d = await r.json();
        const txt = d && d.content && d.content.find((c) => c.type === "text");
        if (!r.ok || !txt) { res.status(502).json({ error: "No se pudo analizar las fotos" }); return; }
        items[i] = { ...cur, resumen: txt.text.trim().slice(0, 3000) };
        const v2 = await leer(H, clave);
        const items2 = ((v2 && v2.items) || []).map((x) => (x.id === cur.id ? items[i] : x));
        await escribir(H, clave, { items: items2 });
        res.status(200).json({ ok: true, resumen: items[i].resumen });
        return;
      }
      if (b.op === "av_comparar") {
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) { res.status(500).json({ error: "Falta ANTHROPIC_API_KEY" }); return; }
        const v = await leer(H, clave);
        const items = (v && v.items) || [];
        const cur = items.find((x) => x.id === b.id);
        if (!cur) { res.status(404).json({ error: "No existe el avance" }); return; }
        if (!cur.fotos || !cur.fotos.length) { res.status(200).json({ ok: false, error: "Este avance no tiene fotos para comparar." }); return; }
        const prev = items.filter((x) => x.id !== cur.id && x.fecha < cur.fecha && x.fotos && x.fotos.length).sort((p, q) => q.fecha - p.fecha)[0];
        if (!prev) { res.status(200).json({ ok: false, error: "No hay fotos anteriores de esta obra para comparar." }); return; }
        const img = (u) => ({ type: "image", source: { type: "url", url: u } });
        const fechaTxt = (t) => new Date(t - 108e5).toISOString().slice(0, 10);
        const content = [{ type: "text", text: "FOTOS ANTERIORES (" + fechaTxt(prev.fecha) + "):" }];
        prev.fotos.slice(0, 3).forEach((u) => content.push(img(u)));
        content.push({ type: "text", text: "FOTOS ACTUALES (" + fechaTxt(cur.fecha) + "):" });
        cur.fotos.slice(0, 4).forEach((u) => content.push(img(u)));
        content.push({ type: "text", text: `Las fotos anteriores son del ${fechaTxt(prev.fecha)} y las actuales del ${fechaTxt(cur.fecha)}. ` + (cur.sector ? `Sector: ${cur.sector}. ` : "") + (cur.txt ? `El jefe de obra escribió: "${cur.txt}". ` : "") + "Resumí en 2 o 3 oraciones qué cambió y qué avance se ve entre las fotos anteriores y las actuales, y qué se ve pendiente. Si no se puede comparar, decilo." });
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-5", max_tokens: 1200,
            system: "Sos un inspector de obra civil en Argentina. Comparás fotos de avance con criterio técnico y sos honesto: no inventes lo que no se ve. Respondé en español rioplatense (vos), claro y breve, sin títulos ni listas, máximo 4 oraciones, y terminá siempre la última oración completa.",
            messages: [{ role: "user", content }],
          }),
        });
        const d = await r.json();
        const txt = d && d.content && d.content.find((c) => c.type === "text");
        if (!r.ok || !txt) { res.status(502).json({ error: "No se pudo analizar las fotos" }); return; }
        // es una sugerencia: no se guarda hasta que el usuario la confirme
        res.status(200).json({ ok: true, texto: txt.text.trim().slice(0, 3000), previo: { id: prev.id, fecha: prev.fecha }, actual: { id: cur.id, fecha: cur.fecha } });
        return;
      }
      if (b.op === "av_edit") {
        const it = b.item || {};
        const v = await leer(H, clave);
        const items = (v && v.items) || [];
        const i = items.findIndex((x) => x.id === b.id);
        if (i < 0) { res.status(404).json({ error: "No existe el avance" }); return; }
        const fotos = (Array.isArray(it.fotos) ? it.fotos : []).filter((u) => typeof u === "string" && (u.startsWith(NEW_PUB) || u.startsWith(OLD_PUB))).slice(0, 12);
        const nuevo = { ...items[i], sector: String(it.sector || "").slice(0, 120), txt: String(it.txt || "").slice(0, 2000), fotos, editado: Date.now() };
        if (Number(it.fecha) > 0 && Number(it.fecha) <= Date.now() + 36e5) nuevo.fecha = Number(it.fecha);
        if (typeof it.resumen === "string") nuevo.resumen = it.resumen.replace(/\s+/g, " ").trim().slice(0, 4000);
        if (!nuevo.txt && !fotos.length && !nuevo.resumen) { res.status(400).json({ error: "El avance quedaría vacío" }); return; }
        items[i] = nuevo;
        await escribir(H, clave, { items });
        res.status(200).json({ ok: true, item: nuevo });
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
