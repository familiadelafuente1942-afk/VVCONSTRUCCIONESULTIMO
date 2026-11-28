// NEXO 2.0 en el servidor: sincroniza la configuración de las obras y valida los códigos de acceso.
// Variables en Vercel:
//   SUPABASE_SERVICE_KEY -> secret / service_role key del proyecto nexo-entorno
//   NEXO_DIR_CODE        -> código inicial de Dirección (después se puede cambiar desde la app)
//   SUPABASE_URL         -> opcional
// Tabla: public.nexo2_estado (clave, valor jsonb, actualizado), cerrada para la clave pública.
// Los códigos viven SOLO acá: nunca se devuelven salvo a quien presenta el código de Dirección.

import crypto from "crypto";
import { leerCfg, escribirCfg, horaCfg, cfgDeFilas, tamanos, aplicarOps } from "./_cfg.js";
import { NEXO_BUILD } from "./_build.js";

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
// MODO PRUEBAS (temporal): con true, la app entra sin códigos. El código "PRUEBAS" vale como Dirección y los contratistas
// entran con "PRUEBAS:<id>". Los códigos reales NO se tocan ni se mandan al navegador. Poner false para volver a pedir códigos.
const MODO_PRUEBAS = false;

function headers(sk) {
  return { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" };
}
async function leer(H, clave) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=valor&clave=eq.${clave}`, { headers: H });
  if (!r.ok) throw new Error("db " + r.status);
  const rows = await r.json();
  const v = rows[0] ? rows[0].valor : null;
  // en los cumplimientos cada obra numera sus puntos 1, 2, 3… (no sigue la numeración del informe de todas las obras)
  let cambio = false;
  if (v && /^ctrec_/.test(clave) && Array.isArray(v.items)) v.items.forEach((x) => { if (x && x.aud && x.aud.inf && Array.isArray(x.aud.items)) x.aud.items.forEach((z, k) => { if (z && z.n !== k + 1) { z.n = k + 1; cambio = true; } }); });
  if (cambio) { try { await escribir(H, clave, v); } catch (e) {} }
  return v;
}
async function escribir(H, clave, valor) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?on_conflict=clave`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ clave, valor, actualizado: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("db " + r.status);
}
/* FIX-01 · registro de cambios: una fila por obra y por día (reg_<obra>_<AAAAMMDD>), se conserva 90 días */
async function registrar(H, reg, meta, build, req) {
  if (!Array.isArray(reg) || !reg.length) return;
  meta = meta || {}; const t = Date.now(), dia = new Date(t - 108e5).toISOString().slice(0, 10).replace(/-/g, "");
  const ua = String((req && req.headers && req.headers["user-agent"]) || "").slice(0, 160);
  const ip = String((req && req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "").split(",")[0].trim().slice(0, 45);
  const base = { t, rol: String(meta.rol || "").slice(0, 20), nom: String(meta.nom || "").slice(0, 60), cod: String(meta.cod || "").slice(0, 8), panel: String(meta.panel || "").slice(0, 60), build: String(build || "").slice(0, 20), ua, ip };
  // un renglón por obra con los campos guardados; aparte, uno por cada cambio de cronograma/base/borrado, conflicto, rechazo o marca ignorada
  const porObra = {}; reg.forEach((r) => { const L = (porObra[r.obra] = porObra[r.obra] || []); if (r.res === "ok" && r.antes === undefined && !r.tipo) { let j = L.find((x) => x._junto); if (!j) { j = { obra: r.obra, campos: [], res: "ok", _junto: 1, n: 0 }; L.push(j); } j.n++; if (j.campos.length < 40) j.campos.push(...r.campos); } else L.push(r); });
  Object.values(porObra).forEach((L) => L.forEach((x) => { if (x._junto) { if (x.n > x.campos.length) x.campos.push("y " + (x.n - x.campos.length) + " más"); delete x._junto; delete x.n; } }));
  for (const [obra, L] of Object.entries(porObra)) {
    const k = "reg_" + String(obra).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) + "_" + dia; const cur = (await leer(H, k)) || { items: [] };
    cur.items = (cur.items || []).concat(L.map((r) => ({ ...base, ...r }))).slice(-3000); await escribir(H, k, cur);
  }
}
async function fix2Recuperar(CX, v) {
  const ids = ["o3", "o2", "o4", "o7269"]; const C = JSON.parse(v.v); const ops = [];
  ids.forEach((id) => { const e = (C.mod && C.mod[id]) || (C.nuevas || []).find((x) => x && x.id === id); if (e && e.sinCrono === true) ops.push({ p: [C.mod && C.mod[id] ? "m" : "n", id, "sinCrono"], v: false, t: Date.now(), x: "recuperacion" }); });
  if (ops.length) { const w = await aplicarOps(CX, v, ops, { b: Date.now() }); try { await registrar(CX.H, w.reg, { rol: "sistema", nom: "Recuperación FIX-01 (sin regenerar, sin tocar ov ni baseOv)" }, NEXO_BUILD, null); } catch (e) {} }
  const v2 = await leerCfg(CX); const ix = { ...v2._ix, fix2: Date.now() }; await CX.escribir(CX.H, "cfgx", ix); return await leerCfg(CX);
}
/* CON-01 · constancia de tarea no convencional: limpieza y validación de los datos */
const NC_MOT = ["detalle", "material", "redef", "gremio", "cond", "falta", "otro"];
function ncTiempo(x) { x = x || {}; const n = Math.min(9999, Math.max(0, Number(String(x.n == null ? "" : x.n).replace(",", ".")) || 0)); return { n: Math.round(n * 10) / 10, u: x.u === "h" ? "h" : "d", p: Math.min(999, Math.max(1, Math.round(Number(x.p) || 1))) }; }
function ncLimpio(x) {
  x = x || {}; const s = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
  return { tareaId: s(x.tareaId, 60).replace(/[^A-Za-z0-9_:#-]/g, ""), tareaNom: s(x.tareaNom, 200), otra: !!x.otra, ubic: s(x.ubic, 120),
    motivos: (Array.isArray(x.motivos) ? x.motivos : []).filter((k) => NC_MOT.includes(k)).filter((k, i, a) => a.indexOf(k) === i), otroTxt: s(x.otroTxt, 300), desc: s(x.desc, 3000),
    hab: ncTiempo(x.hab), real: ncTiempo(x.real), estadoT: ["hacer", "ejec", "fin"].includes(x.estadoT) ? x.estadoT : "hacer", pideEcon: !!x.pideEcon };
}
function ncError(nc) {
  if (!nc.tareaNom) return "Elegí la tarea del cronograma afectada";
  if (!nc.motivos.length) return "Marcá por qué no es convencional";
  if (nc.motivos.includes("otro") && !nc.otroTxt) return "Escribí cuál es el otro motivo";
  if (nc.desc.length < 20) return "La descripción tiene que tener al menos 20 caracteres";
  if (!nc.hab.n || !nc.real.n) return "Completá el tiempo habitual y el tiempo real";
  return "";
}
async function leerCodigos(H) {
  let v = await leer(H, "codigos");
  if (v && typeof v.v === "string") { try { v = JSON.parse(v.v); } catch { v = null; } }
  if (v && v.obras) return { dir: v.dir || "", obras: v.obras, seed: false };
  return { dir: "", obras: JSON.parse(JSON.stringify(SEED)), seed: true };
}
const dirVigente = (c) => c.dir || process.env.NEXO_DIR_CODE || process.env.NEXO2_DIR_CODE || "";
// ===== Conector personal de Claude (un link por persona y rol; se guarda solo la huella) =====
const huellaCod = (c) => crypto.createHash("sha256").update("c:" + norm(c)).digest("hex").slice(0, 16);
const CAMPO_ROL = { jefe: "j", aud: "a", est: "e", prop: "clave" };
// devuelve la credencial vigente de un link (o null si el código cambió o se dio de baja). Solo se usa dentro del servidor.
export async function credToken(H, z) {
  if (!z || !z.rol) return null;
  const cods = await leerCodigos(H);
  if (z.rol === "dir") { const d = dirVigente(cods); return d && huellaCod(d) === z.ch ? { rol: "dir", cred: { rol: "dir", codigo: d }, obras: null } : null; }
  if (z.rol === "ct") { const reg = (await leer(H, "ctcods")) || {}; const x = (reg.items || []).find((c) => c.id === z.ctId); return x && huellaCod(x.cod) === z.ch ? { rol: "ct", cred: { rol: "ct", codigo: x.cod }, ct: x } : null; }
  const f = CAMPO_ROL[z.rol]; if (!f) return null;
  const cod = ((cods.obras || {})[z.obra] || {})[f];
  if (!norm(cod) || huellaCod(cod) !== z.ch) return null;
  return { rol: z.rol, cred: { rol: z.rol, codigo: cod }, obras: Object.keys(cods.obras || {}).filter((o) => norm((cods.obras[o] || {})[f]) === norm(cod)) };
}

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
// ===== Visitas de obra: nunca se pierden por un equipo desactualizado =====
// Une las visitas de dos versiones (por id); dentro de cada visita une fotos, audios y videos (por id).
// Lo borrado a propósito queda anotado (o.visDel / v.del) y no vuelve.
const VCAMPOS = ["fotos", "aud", "videos"];
function unirVisitas(base, otra) {
  // devuelve true si "base" cambió
  if (!base || !otra || !Array.isArray(base.obras) || !Array.isArray(otra.obras)) return false;
  let ch = false;
  otra.obras.forEach((oo, i) => {
    if (!oo || !Array.isArray(oo.vis)) return;
    const ob = base.obras.find((x) => x && x.nombre && x.nombre === oo.nombre) || base.obras[i];
    if (!ob) return;
    const del = new Set([...(ob.visDel || []), ...(oo.visDel || [])]);
    if ((oo.visDel || []).some((d) => !(ob.visDel || []).includes(d))) { ob.visDel = [...del]; ch = true; }
    ob.vis = Array.isArray(ob.vis) ? ob.vis : [];
    const antes = ob.vis.length;
    ob.vis = ob.vis.filter((v) => v && !del.has(v.id));
    if (ob.vis.length !== antes) ch = true;
    for (const vo of oo.vis) {
      if (!vo || !vo.id || del.has(vo.id)) continue;
      const vb = ob.vis.find((x) => x.id === vo.id);
      if (!vb) { if (visConDatos(vo)) { ob.vis.push(JSON.parse(JSON.stringify(vo))); ch = true; } continue; }
      const vdel = new Set([...(vb.del || []), ...(vo.del || [])]);
      if ((vo.del || []).some((d) => !(vb.del || []).includes(d))) { vb.del = [...vdel]; ch = true; }
      for (const c of VCAMPOS) {
        const A = Array.isArray(vb[c]) ? vb[c] : [], B = Array.isArray(vo[c]) ? vo[c] : [];
        const n0 = A.length; let L = A.filter((x) => x && !vdel.has(x.id));
        for (const x of B) {
          if (!x || vdel.has(x.id)) continue;
          const y = L.find((z) => z.id === x.id);
          if (!y) { L.push(x); ch = true; }
          else if (c === "aud") { if (!y.u && x.u) { y.u = x.u; ch = true; } if (String(x.tx || "").length > String(y.tx || "").length) { y.tx = x.tx; ch = true; } }
          else if (String(x.n || "").length > String(y.n || "").length) { y.n = x.n; ch = true; }
        }
        if (L.length !== n0 || A.length !== L.length) ch = true;
        if (L.length || vb[c]) vb[c] = L;
      }
      for (const k of Object.keys(vo)) {
        if (VCAMPOS.includes(k) || k === "del" || k === "id") continue;
        const a = vb[k], b2 = vo[k];
        if (typeof b2 === "string") { if (b2.length > String(a || "").length && (!a || k !== "f")) { vb[k] = b2; ch = true; } }
        else if (k === "inf") { if (b2 && (!a || (b2.ts || 0) > (a.ts || 0))) { vb[k] = b2; ch = true; } }
        else if (a == null && b2 != null) { vb[k] = b2; ch = true; }
      }
    }
    if (ob.vis.length > 1) ob.vis.sort((a, b) => String(a.f || "").localeCompare(String(b.f || "")));
  });
  return ch;
}
// saca fotos/audios/videos repetidos (mismo archivo): se queda con el que tiene clasificación o descripción
function sinRepetidos(doc) {
  let ch = false;
  for (const o of (doc && doc.obras) || []) for (const v of (o && o.vis) || []) for (const c of ["fotos", "aud", "videos"]) {
    if (!Array.isArray(v[c])) continue; const m = new Map();
    for (const x of v[c]) { const k = (x && (x.u || (x.partes && x.partes[0]))) || (x && x.id); if (!k) continue; const y = m.get(k);
      if (!y) m.set(k, x); else { const pesa = (z) => (z.tag && z.tag !== "o" ? 2 : 0) + (z.n || z.tx ? 1 : 0); if (pesa(x) > pesa(y)) m.set(k, x); } }
    if (m.size !== v[c].length) { const quedan = new Set(m.values()); v.del = [...new Set([...(v.del || []), ...v[c].filter((x) => !quedan.has(x)).map((x) => x.id).filter(Boolean)])]; v[c] = v[c].filter((x) => quedan.has(x)); ch = true; }
  }
  return ch;
}
function visConDatos(v) {
  return !!(v && ((v.fotos || []).length || (v.aud || []).length || (v.videos || []).length || ["notas", "dem", "cons", "tec", "tar", "pres"].some((k) => String(v[k] || "").trim())));
}
// Fotos, audios y videos subidos a la visita que quedaron sin anotar en la base (p. ej. un equipo pisó los datos): se vuelven a colgar en la visita de su día.
async function recuperarArchivos(H, app, doc) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/list/nexo2-fotos`, { method: "POST", headers: H, body: JSON.stringify({ prefix: app + "/", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } }) });
  if (!r.ok) return 0;
  const L = await r.json(); if (!Array.isArray(L)) return 0;
  const o = (doc.obras || [])[0]; if (!o) return 0;
  const txt = JSON.stringify(doc); let n = 0; const lim = Date.now() - 4 * 864e5;
  for (const f of L) {
    const m = /^(fot|aud|vid)-(\d{13})-[a-z0-9]+\.(\w+)$/.exec(f && f.name || ""); if (!m) continue;
    const ts = Number(m[2]); if (ts < lim || txt.includes(f.name)) continue;
    const u = NEW_PUB + app + "/" + f.name, dia = new Date(ts - 108e5).toISOString().slice(0, 10);
    o.vis = Array.isArray(o.vis) ? o.vis : [];
    let v = o.vis.filter((x) => x.f === dia).pop();
    if (!v) { v = { id: "vr" + dia.replace(/-/g, ""), f: dia, lugar: (o.vis[0] && o.vis[0].lugar) || "", pres: "", notas: "", dem: "", cons: "", tec: "", tar: "", aud: [], fotos: [] }; o.vis.push(v); }
    const id = m[1][0] + "r" + ts;
    if (m[1] === "fot") (v.fotos = v.fotos || []).push({ id, u, tag: "o", n: "", ts });
    else if (m[1] === "aud") (v.aud = v.aud || []).push({ id, d: 0, ts, u, tx: "" });
    else (v.videos = v.videos || []).push({ id, u, n: "", ts });
    n++;
  }
  if (n) o.vis.sort((a, b) => String(a.f || "").localeCompare(String(b.f || "")));
  return n;
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


function audSan(A) {
  if (!A || typeof A !== "object") return null;
  const S = (v, n) => String(v == null ? "" : v).slice(0, n);
  const K = A.k || {};
  const l = (Array.isArray(A.l) ? A.l : []).slice(0, 60).map((x) => {
    const d = x.doc || {};
    return { nf: Math.min(4, Number(x.nf) || 0), id: S(x.id, 20), tipo: ["sup", "rev", "cert"].includes(x.tipo) ? x.tipo : "sup", num: S(x.num, 30), fecha: Number(x.fecha) || 0,
      doc: { titulo: S(d.titulo, 80), sub: S(d.sub, 80), obra: S(d.obra, 80), num: S(d.num, 30), fecha: S(d.fecha, 30), resultado: S(d.resultado, 40), conclusion: S(d.conclusion, 600), intro: S(d.intro, 600),
        campos: (Array.isArray(d.campos) ? d.campos : []).slice(0, 8).map((c) => [S(c && c[0], 60), S(c && c[1], 200)]),
        secciones: (Array.isArray(d.secciones) ? d.secciones : []).slice(0, 8).map((q) => ({ h: S(q.h, 80), texto: q.texto != null ? S(q.texto, 800) : undefined,
          lista: Array.isArray(q.lista) ? q.lista.slice(0, 20).map((t) => S(t, 400)) : undefined,
          tabla: q.tabla && Array.isArray(q.tabla.cols) ? { cols: q.tabla.cols.slice(0, 5).map((t) => S(t, 40)), rows: (Array.isArray(q.tabla.rows) ? q.tabla.rows : []).slice(0, 25).map((r) => (Array.isArray(r) ? r : []).slice(0, 5).map((t) => S(t, 700))) } : undefined })),
        fotos: (Array.isArray(d.fotos) ? d.fotos : []).filter((u) => /^https:\/\//.test(String(u))).slice(0, 8).map((u) => S(u, 600)), firmas: (Array.isArray(d.firmas) ? d.firmas : []).slice(0, 3).map((f) => [S(f && f[0], 60), S(f && f[1], 80)]) } };
  });
  return { k: { prox: Number(K.prox) || 0, rev: Number(K.rev) || 0, cert: Number(K.cert) || 0 }, l };
}
// ===== Avisos push (Web Push) para cotizaciones de proveedores =====
async function pushLib(H) {
  const wp = (await import("web-push")).default;
  let v = await leer(H, "push_vapid");
  if (!v || !v.pub || !v.priv) { const k = wp.generateVAPIDKeys(); v = { pub: k.publicKey, priv: k.privateKey }; await escribir(H, "push_vapid", v); }
  wp.setVapidDetails("mailto:avisos@nexoentorno.vercel.app", v.pub, v.priv);
  return { wp, pub: v.pub };
}
async function pushEnviar(H, subs, payload) {
  if (!subs || !subs.length) return subs || [];
  const { wp } = await pushLib(H);
  const vivos = [];
  await Promise.all(subs.map(async (s) => {
    try { await wp.sendNotification(s, JSON.stringify(payload), { TTL: 86400 }); vivos.push(s); }
    catch (e) { if (!(e && (e.statusCode === 404 || e.statusCode === 410))) vivos.push(s); }
  }));
  return vivos;
}

// el adicional que manda el contratista entra también en la planilla de Adicionales de NEXO 2 (misma obra, su propio N° correlativo)
async function ctAdicSync(H, rec) {
  try {
    if (!rec || rec.tipo !== "adicional" || !/^[A-Za-z0-9_-]{1,40}$/.test(String(rec.obra || ""))) return;
    const c = rec.cert || {}; const clave = "adic_" + rec.obra; const id = "ct" + String(rec.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 36);
    const v = await leer(H, clave); const items = ((v && v.items) || []); const prev = items.find((x) => x.id === id);
    const nro = prev && prev.adicionalNro ? prev.adicionalNro : String(items.reduce((m, x) => Math.max(m, parseInt(x.adicionalNro, 10) || 0), 0) + 1).padStart(3, "0");
    const cot = {}; ["materiales", "manoObra", "equipos", "subcontratos", "otros"].forEach((k) => { const x = (c.cot || {})[k] || {}; cot[k] = { unidad: String(x.u || ""), cant: String(x.c || ""), punit: String(x.p || "") }; });
    if (!rec.cert && rec.monto) cot.otros = { unidad: "gl", cant: "1", punit: String(rec.monto) };
    const fe = new Date(rec.creado || Date.now()); const iso = new Date(fe.getTime() - 3 * 36e5).toISOString().slice(0, 10);
    const r = {
      id, obra: rec.obra, adicionalNro: nro, ubicacion: String(c.ubic || rec.tarea || ""), fecha: iso, contratista: "Belfast Construction Management", comitente: String(c.comit || ""),
      solicitadoPor: String(c.solic || ""), fechaPedido: String(c.fped || ""), medioPedido: String(c.medio || "Verbal"), requerimiento: String(c.req || ""), tipoAdicional: String(c.tipoAd || "Tarea nueva"),
      descripcionTecnica: rec.desc && String(rec.desc).trim().toLowerCase().startsWith(String(rec.titulo || "").trim().toLowerCase()) ? String(rec.desc) : [rec.titulo, rec.desc].filter(Boolean).join("\n"), modificaCert: !!c.modCert, detalleModificacion: String(c.detMod || ""), docsAdjuntos: Array.isArray(c.docs) ? c.docs : [], identificacionPlanos: "",
      cotiz: cot, incidenciaPlazo: c.plazo === "dias" ? "dias" : "sin", diasIncidencia: c.plazo === "dias" ? String(c.dias || "") : "", validezCotizacion: String(c.validez || "15"), requisitos: Array.isArray(c.reqs) ? c.reqs : [],
      resolucion: String(c.res || "En revisión"), autorizadoPor: String(c.aut || ""), ctRec: rec.id, ctNum: rec.num || "", fotos: rec.fotos || [], editado: Date.now(), por: "ct",
    };
    const out = items.filter((x) => x.id !== id); out.push(prev ? { ...prev, ...r } : r);
    await escribir(H, clave, { items: out.slice(-300) });
    return id;
  } catch (e) { return; }
}
// certificado de tarea adicional (contratistas): solo datos simples, con tope de tamaño
function certLimpio(c) {
  try {
    const raw = JSON.stringify(c || {}); if (raw.length > 12000) return null;
    const lim = (v, d) => { if (d > 4) return undefined; if (typeof v === "string") return v.slice(0, 3000); if (typeof v === "number" || typeof v === "boolean") return v; if (Array.isArray(v)) return v.slice(0, 40).map((x) => lim(x, d + 1)); if (v && typeof v === "object") { const o = {}; Object.keys(v).slice(0, 40).forEach((k) => { o[String(k).slice(0, 40)] = lim(v[k], d + 1); }); return o; } return undefined; };
    return lim(JSON.parse(raw), 0);
  } catch (e) { return null; }
}
export default async function handler(req, res) {
  const sk = process.env.SUPABASE_SERVICE_KEY;
  if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY en Vercel." }); return; }
  const H = headers(sk);
  const CX = { leer, escribir, H, URL_BASE };
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
      const cfgT = await horaCfg(CX); if (cfgT > out.ultima) out.ultima = cfgT;
      res.status(200).json(out);
      return;
    }
    if (req.method === "GET" && req.query && req.query.backup) {
      // copia completa diaria de la base (todas las filas de nexo2_estado), guardada 30 días. La llama el cron de Vercel.
      const cronOk = (process.env.CRON_SECRET && req.headers.authorization === "Bearer " + process.env.CRON_SECRET) || /vercel-cron/i.test(String(req.headers["user-agent"] || ""));
      if (!cronOk) { res.status(403).json({ error: "No autorizado" }); return; }
      const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor&clave=not.like.bk_*&clave=not.like.reg_*&limit=5000`, { headers: H });
      if (!r.ok) { res.status(502).json({ error: "No se pudo leer la base" }); return; }
      const filas = await r.json();
      const hoy = new Date(Date.now() - 108e5).toISOString().slice(0, 10).replace(/-/g, "");
      await escribir(H, "bk_" + hoy, { t: Date.now(), n: filas.length, filas });
      // FIX-01 · el registro de cambios se conserva 90 días
      try { const lim = new Date(Date.now() - 108e5 - 91 * 864e5).toISOString().slice(0, 10).replace(/-/g, ""); const rr = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave&clave=like.reg_*&limit=5000`, { headers: H }); const regs = rr.ok ? await rr.json() : []; for (const f of regs) { const m = /^reg_.+_(\d{8})$/.exec(f.clave); if (m && m[1] < lim) await fetch(`${URL_BASE}/rest/v1/nexo2_estado?clave=eq.${encodeURIComponent(f.clave)}`, { method: "DELETE", headers: H }); } } catch (e) {}
      const l = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave&clave=like.bk_*`, { headers: H });
      let borradas = 0;
      if (l.ok) {
        const lim = new Date(Date.now() - 108e5 - 30 * 864e5).toISOString().slice(0, 10).replace(/-/g, "");
        for (const x of await l.json()) {
          if (/^bk_\d{8}$/.test(x.clave) && x.clave.slice(3) < lim) { await fetch(`${URL_BASE}/rest/v1/nexo2_estado?clave=eq.${x.clave}`, { method: "DELETE", headers: H }); borradas++; }
        }
      }
      res.status(200).json({ ok: true, copia: "bk_" + hoy, filas: filas.length, borradas });
      return;
    }
    if (req.method === "GET" && req.query && req.query.t) {
      // consulta liviana: solo la versión (para enterarse de cambios en segundos sin bajar todo)
      res.status(200).json({ t: await horaCfg(CX), build: process.env.NEXO_BUILD_TEST || NEXO_BUILD, now: Date.now() });
      return;
    }
    if (req.method === "GET") {
      let v = await leerCfg(CX);
      if (!v || typeof v.v !== "string") { res.status(200).json({ build: NEXO_BUILD, now: Date.now() }); return; }
      // FIX-01 · recuperación (una sola vez): las 4 obras a las que un aparato desactualizado les volvió a poner sinCrono
      try { if (v._ix && !v._ix.fix2) v = await fix2Recuperar(CX, v); } catch (e) {}
      // aviso interno: alguna fila pasó el 70 % del tope
      const tm = tamanos(v);
      res.status(200).json({ cfg: { t: v.t, v: v.v }, build: process.env.NEXO_BUILD_TEST || NEXO_BUILD, now: Date.now(), ...(tm && tm.pct >= 70 ? { cap: tm } : {}) });
      return;
    }
    if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    // ===== Paseo Colón · presupuesto y cronograma sincronizados entre dispositivos (último cambio gana) =====
    const pcKey = b.app === "industria" ? "industria_db" : b.app === "barracas" ? "barracas_db" : b.app === "casa" ? "casa_db" : b.app === "canning" ? "canning_db" : b.app === "milanocasa" ? "milanocasa_db" : "paseocolon_db";
    if (b.op === "pc_diag") {
      // resumen (sin contenido) de las visitas guardadas en la base, sus copias y los archivos subidos, para diagnosticar pérdidas
      const res1 = (d) => { try { const n = JSON.parse(d.v); return { t: d.t, kb: Math.round(d.v.length / 1024), visDel: (n.obras || []).map((o) => o.visDel || []), vis: (n.obras || []).map((o) => (o.vis || []).map((v) => [v.id, v.f, String(v.notas || "").length + String(v.tar || "").length + String(v.dem || "").length + String(v.cons || "").length + String(v.tec || "").length, (v.fotos || []).length, (v.aud || []).length, (v.videos || []).length, (v.del || []).length])) }; } catch (e) { return { err: e.message }; } };
      const out = {};
      for (const k of [pcKey, pcKey + "_prev", ...Array.from({ length: 24 }, (_, h) => pcKey + "_h" + h)]) { const d = await leer(H, k).catch(() => null); if (d && d.v) out[k] = res1(d); }
      for (const pre of [b.app + "/", b.app]) {
        const r = await fetch(`${URL_BASE}/storage/v1/object/list/nexo2-fotos`, { method: "POST", headers: H, body: JSON.stringify({ prefix: pre, limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } }) });
        const j = await r.json().catch(() => null);
        out["st_" + pre] = { s: r.status, n: Array.isArray(j) ? j.length : j, top: Array.isArray(j) ? j.slice(0, 60).map((x) => x.name) : null };
      }
      res.status(200).json(out); return;
    }
    if (b.op === "pc_get") {
      let v = await leer(H, pcKey);
      // una sola vez: recupera visitas, fotos, audios y videos que un equipo desactualizado haya pisado
      if (v && v.v && pcKey === "barracas_db" && !String(v.v).includes('"_recVis":2')) {
        try {
          const n = JSON.parse(v.v); let ch = false;
          const fuentes = [await leer(H, pcKey + "_prev")];
          for (let h = 0; h < 24; h++) fuentes.push(await leer(H, pcKey + "_h" + h).catch(() => null));
          for (const f of fuentes) { if (f && f.v) { try { if (unirVisitas(n, JSON.parse(f.v))) ch = true; } catch {} } }
          if (await recuperarArchivos(H, "barracas", n).catch(() => 0)) ch = true;
          n._recVis = 2; const t = ch ? Date.now() : Number(v.t) || Date.now();
          const nv = { t, v: JSON.stringify(n) };
          if (ch) await escribir(H, pcKey + "_prev", v);
          await escribir(H, pcKey, nv); v = nv;
        } catch {}
      }
      if (v && v.v && pcKey === "barracas_db" && !String(v.v).includes('"_dedup":1')) {
        try { const n = JSON.parse(v.v); sinRepetidos(n); n._dedup = 1; const nv = { t: Date.now(), v: JSON.stringify(n) }; await escribir(H, pcKey + "_prev", v); await escribir(H, pcKey, nv); v = nv; } catch {}
      }
      // una sola vez: saca la visita de prueba del 15/11 que la recuperación había vuelto a traer (ya estaba borrada)
      if (v && v.v && pcKey === "barracas_db" && !String(v.v).includes('"_fixVr":1')) {
        try {
          const n = JSON.parse(v.v);
          (n.obras || []).forEach((o) => { const fu = (o.vis || []).filter((x) => /^vr\d{8}$/.test(x.id || "") && (x.fotos || []).concat(x.aud || [], x.videos || []).every((y) => /^[fav]r\d+$/.test(y.id || ""))); if (fu.length) { o.visDel = [...new Set([...(o.visDel || []), ...fu.map((x) => x.id)])]; o.vis = o.vis.filter((x) => !fu.includes(x)); } });
          n._fixVr = 1; const nv = { t: Date.now(), v: JSON.stringify(n) };
          await escribir(H, pcKey + "_prev", v); await escribir(H, pcKey, nv); v = nv;
        } catch {}
      }
      res.status(200).json({ ok: true, doc: v || null }); return;
    }
    if (b.op === "pc_put") {
      if (typeof b.v !== "string" || b.v.length > 4_000_000 || typeof b.t !== "number") { res.status(400).json({ error: "Datos inválidos" }); return; }
      const cur = await leer(H, pcKey);
      if (cur && Number(cur.t) > b.t) { res.status(409).json({ error: "Hay una versión más nueva", doc: cur }); return; }
      let v = b.v, t = b.t, unido = false;
      // lo que viene nunca borra visitas, fotos, audios ni videos que ya estaban (salvo los que se borraron a propósito)
      if (cur && cur.v && cur.v !== b.v) {
        try { const n = JSON.parse(b.v); const u1 = unirVisitas(n, JSON.parse(cur.v)), u2 = sinRepetidos(n); if (u1 || u2) { v = JSON.stringify(n); t = Date.now(); unido = true; } } catch {}
        await escribir(H, pcKey + "_prev", cur);
        // copia por hora (las últimas 24 horas) para poder volver atrás
        const hs = "_h" + new Date().getUTCHours(); const hc = await leer(H, pcKey + hs).catch(() => null);
        if (!hc || Date.now() - Number(hc.t || 0) > 3600e3) await escribir(H, pcKey + hs, cur).catch(() => {});
      }
      await escribir(H, pcKey, { t, v });
      res.status(200).json(unido ? { ok: true, doc: { t, v } } : { ok: true }); return;
    }

    // ===== Pedidos de cotización a proveedores (link público "Cotizador Belfast") =====
    // El proveedor solo puede ver el pedido (cz_ver) y enviar su cotización (cz_resp). Leer las respuestas pide la clave k del pedido.
    // ===== Barracas · paneles de solo lectura (Estudio y Cliente): devuelve una copia SIN datos internos =====
    if (b.op === "bar_panel") {
      const k = String(b.k || "");
      const cur = await leer(H, "barracas_db");
      let n = null; try { n = cur && cur.v ? JSON.parse(cur.v) : null; } catch { n = null; }
      const pn = (n && n.panel) || {};
      const rol = /^[a-z0-9]{16,40}$/.test(k) ? (k === pn.e ? "estudio" : k === pn.c ? "cliente" : "") : "";
      if (!rol || !n || !Array.isArray(n.obras)) { await new Promise((r) => setTimeout(r, 500)); res.status(403).json({ error: "Link inválido" }); return; }
      const obras = n.obras.map((o) => {
        const cf = o.cf || {};
        return {
          nombre: o.nombre, rv: o.rv, rz: 99, rub: (o.rub || []).map((r) => ({ n: r.n, m: 0, e: 0 })), int: [], compras: [],
          gg: 0, ut: 0, imp: 0, cot: 0, m2c: o.m2c || 0, m2v: o.m2v || 0, lote: 0, plus: 0, zona: 0,
          pre: rol === "estudio" ? o.pre : undefined,
          cf: { ini: cf.ini, n: cf.n, curva: cf.curva, v: cf.v, it: cf.it, bx: cf.bx, es: cf.es, av: cf.av, esI: cf.esI, avI: cf.avI, pre: 100, ant: 0, cuo: 0, stop: 0 },
          seg: { it: ((o.seg && o.seg.it) || []).filter((x) => rol === "estudio" || x.k !== "a") },
          pub: rol === "estudio" ? (o.pub || null) : null,
        };
      });
      res.status(200).json({ ok: true, rol, t: cur.t, db: { obras, act: Math.min(Number(n.act) || 0, obras.length - 1) } }); return;
    }
    if (b.op === "push_key") { const { pub } = await pushLib(H); res.status(200).json({ ok: true, pub }); return; }
    if (typeof b.op === "string" && b.op.startsWith("cz_")) {
      const id = String(b.id || "");
      if (!/^[a-z0-9]{10,24}$/.test(id)) { res.status(400).json({ error: "Pedido inválido" }); return; }
      const K = "cotped_" + id;
      const cur = await leer(H, K);
      if (b.op === "cz_crear") {
        if (typeof b.k !== "string" || b.k.length < 10 || b.k.length > 60 || JSON.stringify(b.ped || {}).length > 60000) { res.status(400).json({ error: "Datos inválidos" }); return; }
        if (cur && cur.k !== b.k) { res.status(403).json({ error: "No autorizado" }); return; }
        await escribir(H, K, { k: b.k, ped: b.ped || {}, resps: (cur && cur.resps) || [], subs: (cur && cur.subs) || [], cerrado: !!b.cerrado, t: Date.now() });
        res.status(200).json({ ok: true }); return;
      }
      if (!cur) { res.status(404).json({ error: "El pedido no existe" }); return; }
      if (b.op === "cz_up_url") {
        // el proveedor sube su presupuesto (PDF o foto) desde la página del link
        if (cur.cerrado) { res.status(403).json({ error: "Este pedido ya está cerrado" }); return; }
        const nm = String(b.name || "").slice(0, 120), sz = Number(b.size) || 0;
        if (sz <= 0 || sz > 25e6) { res.status(400).json({ error: "El archivo debe pesar hasta 25 MB" }); return; }
        const ext = ((/\.([A-Za-z0-9]{1,5})$/.exec(nm) || [])[1] || "").toLowerCase();
        if (!/^(pdf|jpg|jpeg|png|webp|heic|xls|xlsx|doc|docx)$/.test(ext)) { res.status(400).json({ error: "Subí el presupuesto en PDF, foto, Excel o Word" }); return; }
        const path = `cotiz/${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const firmar = () => fetch(`${URL_BASE}/storage/v1/object/upload/sign/nexo2-fotos/${path}`, { method: "POST", headers: H, body: "{}" });
        let r = await firmar();
        if (!r.ok) { await fetch(`${URL_BASE}/storage/v1/bucket`, { method: "POST", headers: H, body: JSON.stringify({ id: "nexo2-fotos", name: "nexo2-fotos", public: true }) }); r = await firmar(); }
        if (!r.ok) { res.status(502).json({ error: "No se pudo preparar la subida" }); return; }
        const j = await r.json(); const rel = String(j.url || "");
        const up = rel.startsWith("http") ? rel : rel ? `${URL_BASE}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}` : j.token ? `${URL_BASE}/storage/v1/object/upload/sign/nexo2-fotos/${path}?token=${j.token}` : "";
        if (!up) { res.status(502).json({ error: "No se pudo preparar la subida" }); return; }
        res.status(200).json({ ok: true, up, pub: NEW_PUB + path }); return;
      }
      if (b.op === "cz_ver") { res.status(200).json({ ok: true, ped: cur.ped || {}, cerrado: !!cur.cerrado }); return; }
      if (b.op === "cz_resp") {
        if (cur.cerrado) { res.status(403).json({ error: "Este pedido ya está cerrado" }); return; }
        const r = b.resp || {};
        if (typeof r !== "object" || JSON.stringify(r).length > 40000 || !String(r.prov || "").trim()) { res.status(400).json({ error: "Datos inválidos" }); return; }
        if ((cur.resps || []).length >= 20) { res.status(429).json({ error: "El pedido ya recibió el máximo de cotizaciones" }); return; }
        cur.resps = [...(cur.resps || []), { ...r, rid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), t: Date.now() }];
        await escribir(H, K, cur);
        try {
          if ((cur.subs || []).length) {
            const vivos = await pushEnviar(H, cur.subs, { title: "Nueva cotización", body: String(r.prov).trim().slice(0, 60) + " cotizó " + String((cur.ped && cur.ped.g) || "tu pedido").slice(0, 80), url: (typeof (cur.ped && cur.ped.url) === "string" && /^\/[a-z0-9._-]+\.html$/.test(cur.ped.url)) ? cur.ped.url : "/correo-barracas.html", tag: "cz-" + id });
            if (vivos.length !== cur.subs.length) { const c2 = await leer(H, K); if (c2) { c2.subs = vivos; await escribir(H, K, c2); } }
          }
        } catch {}
        res.status(200).json({ ok: true }); return;
      }
      if (b.op === "cz_sub") {
        if (cur.k !== b.k) { res.status(403).json({ error: "No autorizado" }); return; }
        const sb = b.sub || {};
        if (typeof sb.endpoint !== "string" || !/^https:\/\//.test(sb.endpoint) || sb.endpoint.length > 1000 || !sb.keys || typeof sb.keys.p256dh !== "string" || typeof sb.keys.auth !== "string") { res.status(400).json({ error: "Suscripción inválida" }); return; }
        const lim = { endpoint: sb.endpoint, keys: { p256dh: sb.keys.p256dh.slice(0, 200), auth: sb.keys.auth.slice(0, 100) } };
        cur.subs = [...(cur.subs || []).filter((x) => x.endpoint !== lim.endpoint), lim].slice(-10);
        if (b.quitar) cur.subs = cur.subs.filter((x) => x.endpoint !== lim.endpoint);
        await escribir(H, K, cur);
        res.status(200).json({ ok: true }); return;
      }
      if (b.op === "cz_leer") {
        if (cur.k !== b.k) { res.status(403).json({ error: "No autorizado" }); return; }
        res.status(200).json({ ok: true, resps: cur.resps || [] }); return;
      }
      res.status(400).json({ error: "Operación inválida" }); return;
    }

    if (b.op === "bar_up_url") {
      // Barracas · Visita: URL firmada de subida directa (fotos y audio de la visita)
      if (b.app !== "barracas" && b.app !== "paseo" && b.app !== "milanocasa" && b.app !== "casa" && b.app !== "industria") { res.status(400).json({ error: "App inválida" }); return; }
      const nm = String(b.name || "").slice(0, 120), sz = Number(b.size) || 0;
      if (sz <= 0 || sz > 50e6) { res.status(400).json({ error: "El archivo debe pesar entre 1 byte y 50 MB" }); return; }
      const ext = ((/\.([A-Za-z0-9]{1,5})$/.exec(nm) || [])[1] || "bin").toLowerCase();
      if (!/^(jpg|jpeg|png|webp|webm|m4a|mp4|mov|ogg|mp3|wav|pdf|heic|xls|xlsx|csv|doc|docx|dwg|dxf|zip)$/.test(ext)) { res.status(400).json({ error: "Tipo de archivo no permitido" }); return; }
      const path = `${b.app === "industria" ? "industria" : b.app === "paseo" ? "paseo" : b.app === "milanocasa" ? "milanocasa" : b.app === "casa" ? "casa" : "barracas"}/${String(b.pref || "adj").replace(/[^a-z]/g, "").slice(0, 8) || "adj"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const firmar = () => fetch(`${URL_BASE}/storage/v1/object/upload/sign/nexo2-fotos/${path}`, { method: "POST", headers: H, body: "{}" });
      let r = await firmar();
      if (!r.ok) { await fetch(`${URL_BASE}/storage/v1/bucket`, { method: "POST", headers: H, body: JSON.stringify({ id: "nexo2-fotos", name: "nexo2-fotos", public: true }) }); r = await firmar(); }
      if (!r.ok) { res.status(502).json({ error: "No se pudo preparar la subida" }); return; }
      const j = await r.json(); const rel = String(j.url || "");
      const up = rel.startsWith("http") ? rel : rel ? `${URL_BASE}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}` : j.token ? `${URL_BASE}/storage/v1/object/upload/sign/nexo2-fotos/${path}?token=${j.token}` : "";
      if (!up) { res.status(502).json({ error: "No se pudo preparar la subida" }); return; }
      res.status(200).json({ ok: true, up, pub: NEW_PUB + path }); return;
    }

    // FIX-01 · guardado por cambios (la única forma de guardar la configuración desde la app)
    if (b.op === "cfg_ops") {
      const BMIN = process.env.NEXO_BUILD_TEST || NEXO_BUILD;
      if (!b.build || String(b.build) < BMIN) { res.status(426).json({ error: "version", build: BMIN }); return; }
      if (!Array.isArray(b.ops) || JSON.stringify(b.ops).length > 4_000_000) { res.status(400).json({ error: "Datos inválidos" }); return; }
      let prev = null; try { prev = await leerCfg(CX); } catch { prev = null; }
      // protección: no se puede guardar un "primer cronograma" sobre una obra que ya tiene uno en la nube
      if (Array.isArray(b.nuevos) && b.nuevos.length && prev && typeof prev.v === "string") {
        try { const P = JSON.parse(prev.v); const tiene = (id) => !!((P.mod && P.mod[id] && P.mod[id].tpl && !P.mod[id].sinCrono) || (P.nuevas || []).some((x) => x && x.id === id && x.tpl && !x.sinCrono));
          const choca = b.nuevos.filter((id) => typeof id === "string" && tiene(id)); if (choca.length) { res.status(409).json({ error: "ya_existe", ids: choca, t: Number(prev.t) || 0 }); return; } } catch {}
      }
      const offset = typeof b.now === "number" ? Date.now() - b.now : 0;
      const w = await aplicarOps(CX, prev, b.ops, { b: Number(b.bt) || 0, offset });
      if (w.error === "grande") { res.status(413).json({ error: "grande", ids: w.ids }); return; }
      try { await registrar(H, w.reg, b.meta, b.build, req); } catch (e) {}
      res.status(200).json({ ok: true, t: w.t, rech: w.rech, ign: w.ign, n: w.aplicadas.length }); return;
    }

    // configuración de obras con el formato anterior (la obra entera): ya no se acepta, para que un aparato desactualizado no pise datos más nuevos
    if (!b.op) { res.status(426).json({ error: "version", build: NEXO_BUILD }); return; }
    if (false) {
      if (b.key !== "cfg" || typeof b.v !== "string" || b.v.length > 4_000_000 || typeof b.t !== "number") {
        res.status(400).json({ error: "Datos inválidos" }); return;
      }
      // la hora de versión la pone el servidor (siempre creciente): los relojes de cada aparato pueden estar desfasados
      let prev = null; try { prev = await leerCfg(CX); } catch { prev = null; }
      // protección: no se puede guardar un "primer cronograma" sobre una obra que ya tiene uno en la nube
      if (Array.isArray(b.nuevos) && b.nuevos.length && prev && typeof prev.v === "string") {
        try {
          const P = JSON.parse(prev.v);
          const tiene = (id) => !!((P.mod && P.mod[id] && P.mod[id].tpl) || (P.nuevas || []).some((x) => x && x.id === id && x.tpl));
          const choca = b.nuevos.filter((id) => typeof id === "string" && tiene(id));
          if (choca.length) { res.status(409).json({ error: "ya_existe", ids: choca, t: Number(prev.t) || 0 }); return; }
        } catch { /* si no se puede leer, no bloquea */ }
      }
      const t = Math.max(Date.now(), (prev && Number(prev.t) || 0) + 1);
      // ningún aparato (ni con una versión vieja de la app) puede borrar obras nuevas: solo se van las que Dirección eliminó a propósito (delN)
      let vOut = b.v;
      try {
        if (prev && typeof prev.v === "string") {
          const P = JSON.parse(prev.v), N = JSON.parse(b.v); N.nuevas = Array.isArray(N.nuevas) ? N.nuevas : [];
          const dn = new Set([...(P.delN || []), ...(N.delN || [])]); let ch = false;
          for (const x of (P.nuevas || [])) if (x && x.id && !dn.has(x.id) && !N.nuevas.some((y) => y && y.id === x.id)) { N.nuevas.push(x); ch = true; }
          if (dn.size && JSON.stringify([...dn]) !== JSON.stringify(N.delN || [])) { N.delN = [...dn].slice(-300); ch = true; }
          // los avisos entre roles se suman (nunca se pisan): si dos aparatos guardan casi juntos, no se pierde ninguno
          if (Array.isArray(P.avisos) && P.avisos.length) {
            const L = Array.isArray(N.avisos) ? N.avisos.slice() : []; const ids = new Set(L.map((x) => x && x.id)); let add = 0;
            for (const x of P.avisos) if (x && x.id && !ids.has(x.id) && Date.now() - Number(x.t || 0) < 14 * 864e5) { L.push(x); add++; }
            if (add) { L.sort((x, y) => (Number(x.t || 0) - Number(y.t || 0)) || String(x.id).localeCompare(String(y.id))); const L2 = L.slice(-40); if (L2.map((z) => z.id).join() !== (N.avisos || []).map((z) => z && z.id).join()) { N.avisos = L2; ch = true; } }
          }
          // cronograma borrado por Dirección (sinCrono): un aparato con una versión vieja de la app no lo puede deshacer sin querer
          for (const [id, ch0] of Object.entries(P.mod || {})) if (ch0 && ch0.sinCrono === true) { N.mod = N.mod || {}; const e = N.mod[id] || {}; if (e.sinCrono === undefined && !(Number(e.cg) > Number(ch0.cg || 0))) { N.mod[id] = { ...e, sinCrono: true }; ch = true; } }
          for (const x of (P.nuevas || [])) if (x && x.sinCrono === true) { const y = N.nuevas.find((z) => z && z.id === x.id); if (y && y.sinCrono === undefined && !(Number(y.cg) > Number(x.cg || 0))) { y.sinCrono = true; ch = true; } }
          if (ch) vOut = JSON.stringify(N);
        }
      } catch { /* si no se puede leer, se guarda como vino */ }
      const w = await escribirCfg(CX, prev, vOut, t, typeof b.bt === "number" ? b.bt : null);
      if (w.error === "conflicto") { res.status(409).json({ error: "conflicto", ids: w.ids, t: prev ? Number(prev.t) || 0 : 0 }); return; }
      if (w.error === "grande") { res.status(413).json({ error: "grande", ids: w.ids }); return; }
      // si la nube tenía obras que este aparato no traía, se le devuelve lo que quedó guardado para que se ponga al día
      res.status(200).json(vOut !== b.v ? { ok: true, t, v: vOut } : { ok: true, t });
      return;
    }

    const cods = await leerCodigos(H);
    const dirOk = (c) => { if (MODO_PRUEBAS && norm(c) === "PRUEBAS") return true; const d = norm(dirVigente(cods)); return !!d && norm(c) === d; };

    if (b.op === "reg_list") {
      // FIX-01 · registro de cambios de una obra (Dirección)
      const cr = b.cred || {}; if (!(cr.rol === "dir" && dirOk(cr.codigo))) { res.status(403).json({ error: "Solo Dirección" }); return; }
      const obra = String(b.obra || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40); const dias = Math.min(90, Math.max(1, Number(b.dias) || 30));
      const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor&clave=like.reg_${obra}_*&limit=200`, { headers: H }); const L = r.ok ? await r.json() : [];
      const desde = Date.now() - dias * 864e5; const items = L.flatMap((x) => (x.valor && x.valor.items) || []).filter((x) => x.t >= desde).sort((a, c) => c.t - a.t).slice(0, 1500).map(({ ip, ...x }) => x);
      res.status(200).json({ ok: true, items }); return;
    }
    if (b.op === "respaldo_manual") {
      // respaldo con nombre (no lo borra la limpieza de 30 días): todas las filas, incluidos cfg, auditorías, registro y obras
      const cr = b.cred || {}; if (!(cr.rol === "dir" && dirOk(cr.codigo))) { res.status(403).json({ error: "Solo Dirección" }); return; }
      const nom = "bk_" + String(b.nombre || "manual").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40) + "_" + new Date(Date.now() - 108e5).toISOString().slice(0, 16).replace(/[-:T]/g, "");
      const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor&clave=not.like.bk_*&clave=not.like.reg_*&limit=5000`, { headers: H });
      if (!r.ok) { res.status(502).json({ error: "No se pudo leer la base" }); return; }
      const filas = await r.json();
      await escribir(H, nom, { t: Date.now(), n: filas.length, filas });
      const chk = await leer(H, nom);
      const tipos = {}; filas.forEach((f) => { const k = String(f.clave).replace(/_[^_]*$/, "").replace(/\d+$/, ""); tipos[k] = (tipos[k] || 0) + 1; });
      res.status(200).json({ ok: !!(chk && chk.n === filas.length), copia: nom, filas: filas.length, bytes: JSON.stringify(filas).length, tipos }); return;
    }
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

    if (b.op === "obras_recuperables" || b.op === "obras_restaurar") {
      // obras que estaban en la nube (copias diarias o fotos de obra) y ya no aparecen; Dirección elige cuáles volver a traer
      if (!dirOk(b.dir)) { await pausa(600); res.status(403).json({ error: "No autorizado" }); return; }
      const cur = await leerCfg(CX); let C = {}; try { C = cur && cur.v ? JSON.parse(cur.v) : {}; } catch { C = {}; }
      C.mod = C.mod || {}; C.nuevas = Array.isArray(C.nuevas) ? C.nuevas : []; C.del = Array.isArray(C.del) ? C.del : []; C.delN = Array.isArray(C.delN) ? C.delN : [];
      const ya = new Set(C.nuevas.map((x) => x && x.id)), cand = new Map();
      const lb = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave&clave=like.bk_*&order=clave.desc`, { headers: H });
      const bks = lb.ok ? (await lb.json()).map((x) => x.clave).filter((k) => /^bk_\d{8}$/.test(k)).slice(0, 30) : [];
      for (const k of bks) {
        const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=valor&clave=eq.${k}`, { headers: H }); const j = r.ok ? await r.json() : [];
        const f = { valor: cfgDeFilas((j[0] && j[0].valor && j[0].valor.filas) || []) }; if (!f.valor || !f.valor.v) continue;
        let B; try { B = JSON.parse(f.valor.v); } catch { continue; }
        const dia = k.slice(3, 7) + "-" + k.slice(7, 9) + "-" + k.slice(9, 11);
        for (const x of (B.nuevas || [])) if (x && x.id && !ya.has(x.id) && !cand.has(x.id)) cand.set(x.id, { id: x.id, nombre: x.nombre || x.id, tipo: "nueva", dia, cfg: x });
        for (const id of C.del) if (!(B.del || []).includes(id) && !cand.has(id)) cand.set(id, { id, nombre: (B.mod && B.mod[id] && B.mod[id].nombre) || id, tipo: "base", dia });
      }
      const rs = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor&clave=like.snap_*`, { headers: H });
      if (rs.ok) for (const x of await rs.json()) { const id = String(x.clave).slice(5); if (!ya.has(id) && !cand.has(id) && !/^o[1-6]$/.test(id)) cand.set(id, { id, nombre: (x.valor && x.valor.nombre) || id, tipo: "solo_nombre", dia: "" }); }
      if (b.op === "obras_recuperables") { res.status(200).json({ ok: true, items: [...cand.values()].map(({ cfg, ...r }) => r) }); return; }
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String); let n = 0;
      for (const id of ids) {
        const c = cand.get(id); if (!c) continue;
        if (c.tipo === "nueva") { C.nuevas.push(c.cfg); n++; }
        else if (c.tipo === "base") { C.del = C.del.filter((x) => x !== id); n++; }
        else if (c.tipo === "solo_nombre" && b.min && typeof b.min === "object") { C.nuevas.push({ ...b.min, id, nombre: c.nombre, recuperada: Date.now() }); n++; }
        C.delN = C.delN.filter((x) => x !== id);
      }
      if (n) { const t = Math.max(Date.now(), (cur && Number(cur.t) || 0) + 1); const w = await escribirCfg(CX, cur, JSON.stringify(C), t, null); if (!w.ok) { res.status(500).json({ error: "No se pudo guardar" }); return; } }
      res.status(200).json({ ok: true, n }); return;
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

    // ===== Planos de la obra: carpetas y planos editables (estructura compartida por obra), papelera de 30 días y plantillas =====
    if (typeof b.op === "string" && b.op.startsWith("pla_")) {
      const DIAS30 = 30 * 864e5;
      if (b.op === "pla_tpl_list") { const v = await leer(H, "planos_plantillas"); res.status(200).json({ ok: true, items: (v && v.items) || [] }); return; }
      if (b.op === "pla_tpl_save" || b.op === "pla_tpl_del") {
        const cr = b.cred || {};
        if (!(cr.rol === "dir" && dirOk(cr.codigo))) { await pausa(600); res.status(403).json({ error: "Solo Dirección puede guardar plantillas." }); return; }
        const v = await leer(H, "planos_plantillas"); let items = (v && v.items) || [];
        const id = String(b.id || (b.tpl && b.tpl.id) || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
        if (!id) { res.status(400).json({ error: "Plantilla inválida" }); return; }
        items = items.filter((x) => x.id !== id);
        if (b.op === "pla_tpl_save") {
          const raw = JSON.stringify(b.tpl || {});
          if (raw.length > 200000) { res.status(400).json({ error: "La plantilla es demasiado grande" }); return; }
          items.push({ ...JSON.parse(raw), id, nombre: String((b.tpl || {}).nombre || "Plantilla").slice(0, 60), editado: Date.now() });
        }
        await escribir(H, "planos_plantillas", { items: items.slice(-30) });
        res.status(200).json({ ok: true, items }); return;
      }
      const obra = String(b.obra || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const clave = "planos_" + obra;
      if (b.op === "pla_list") { const v = await leer(H, clave); res.status(200).json({ ok: true, doc: v || null }); return; }
      if (b.op === "pla_save") {
        const cr = b.cred || {};
        const quien = cr.rol === "dir" && dirOk(cr.codigo) ? "Dirección" : cr.rol === "jefe" && norm(cr.codigo) && norm((cods.obras[obra] || {}).j) === norm(cr.codigo) ? "Jefatura de obra" : "";
        if (!quien) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código para guardar los cambios de Planos." }); return; }
        const raw = JSON.stringify(b.doc || {});
        if (raw.length > 400000) { res.status(400).json({ error: "La estructura de planos es demasiado grande" }); return; }
        const cur = await leer(H, clave);
        const rev = cur && Number(cur.rev) || 0;
        if (Number(b.rev) !== rev) { res.status(409).json({ error: "Alguien cambió Planos mientras tanto", doc: cur }); return; }
        const d = JSON.parse(raw);
        const sl = {}; const ahora = Date.now();
        Object.entries(d.sl || {}).forEach(([k, v]) => { if (v && v.x && ahora - Number(v.x) > DIAS30) return; sl[String(k).slice(0, 200)] = v; });
        const fdel = {}; Object.entries(d.fdel || {}).forEach(([k, t]) => { if (ahora - Number(t) <= DIAS30) fdel[k] = t; });
        const doc = { ...d, sl, fdel, log: (Array.isArray(d.log) ? d.log : []).slice(-150), rev: rev + 1, t: ahora, por: quien };
        await escribir(H, clave, doc);
        res.status(200).json({ ok: true, rev: doc.rev }); return;
      }
      res.status(400).json({ error: "Operación desconocida" }); return;
    }

    // ===== Certificados de tareas adicionales (los carga la jefatura de obra o Dirección; incluyen cotización) =====
    if (typeof b.op === "string" && b.op.startsWith("adic_")) {
      const obra = String(b.obra || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const cr = b.cred || {};
      const quien = cr.rol === "dir" && dirOk(cr.codigo) ? "dir" : cr.rol === "jefe" && norm(cr.codigo) && norm((cods.obras[obra] || {}).j) === norm(cr.codigo) ? "jefe" : "";
      if (!quien) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código para ver o guardar adicionales." }); return; }
      const clave = "adic_" + obra;
      if (b.op === "adic_list") { const v = await leer(H, clave); res.status(200).json({ ok: true, items: (v && v.items) || [] }); return; }
      const id = String((b.rec && b.rec.id) || b.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
      if (!id) { res.status(400).json({ error: "Adicional inválido" }); return; }
      if (b.op === "adic_del") { const v = await leer(H, clave); await escribir(H, clave, { items: ((v && v.items) || []).filter((x) => x.id !== id) }); res.status(200).json({ ok: true }); return; }
      if (b.op === "adic_save") {
        const raw = JSON.stringify(b.rec || {});
        if (raw.length > 20000) { res.status(400).json({ error: "El certificado es demasiado largo" }); return; }
        const rec = { ...JSON.parse(raw), id, obra, editado: Date.now(), por: quien };
        const v = await leer(H, clave);
        const prevA = ((v && v.items) || []).find((x) => x.id === id);
        if (prevA) ["ctRec", "ctNum", "fotos"].forEach((k) => { if (prevA[k] != null && rec[k] == null) rec[k] = prevA[k]; });
        const items = ((v && v.items) || []).filter((x) => x.id !== id); items.push(rec);
        await escribir(H, clave, { items: items.slice(-300) });
        if (rec.ctRec) {
          // la resolución de Dirección vuelve al contratista (aprobado para ejecutar → en verde en su app)
          try {
            const k2 = "ctrec_" + obra; const v2 = await leer(H, k2); const it = v2 && (v2.items || []).find((x) => x.id === String(rec.ctRec));
            if (it) {
              const res0 = (it.cert && it.cert.res) || "En revisión"; const res1 = String(rec.resolucion || "En revisión").slice(0, 60);
              it.cert = { ...(it.cert || {}), res: res1, aut: String(rec.autorizadoPor || "").slice(0, 120) };
              if (rec.cotiz) { it.cert.cot = {}; Object.entries(rec.cotiz).slice(0, 8).forEach(([kk, x]) => { it.cert.cot[kk] = { u: String((x || {}).unidad || ""), c: String((x || {}).cant || ""), p: String((x || {}).punit || "") }; }); }
              const t = Date.now(); it.editado = t;
              if (res1 !== res0) { it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([{ t, por: "dir", nom: "Dirección", tx: "Adicional: " + res1 + (rec.autorizadoPor ? " · " + rec.autorizadoPor : "") }]).slice(-100); if (!it.primeraResp) it.primeraResp = t; }
              await escribir(H, k2, { ...v2, items: v2.items });
            }
          } catch (e) {}
        }
        res.status(200).json({ ok: true, rec }); return;
      }
      res.status(400).json({ error: "Operación desconocida" }); return;
    }

    // ===== Compras (solo Dirección): ítems, pedidos de cotización y presupuestos de cada obra =====
    if (typeof b.op === "string" && b.op.startsWith("cmpr_")) {
      const cr = b.cred || {};
      if (!(cr.rol === "dir" && dirOk(cr.codigo))) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código de Dirección." }); return; }
      const OK = (x) => /^[A-Za-z0-9_-]{1,40}$/.test(String(x || ""));
      if (b.op === "cmpr_all") {
        const ids = (Array.isArray(b.obras) ? b.obras : []).map(String).filter(OK).slice(0, 60);
        const docs = {};
        await Promise.all(ids.map(async (id) => { const v = await leer(H, "compras_" + id); if (v && v.doc) docs[id] = { doc: v.doc, t: v.t || 0 }; }));
        res.status(200).json({ ok: true, docs }); return;
      }
      if (!OK(b.obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const clave = "compras_" + b.obra;
      if (b.op === "cmpr_get") { const v = await leer(H, clave); res.status(200).json({ ok: true, doc: (v && v.doc) || null, t: (v && v.t) || 0 }); return; }
      if (b.op === "cmpr_set") {
        const raw = JSON.stringify(b.doc || {});
        if (raw.length > 900000) { res.status(400).json({ error: "Compras ocupa demasiado: borrá pedidos o presupuestos viejos." }); return; }
        const t = Date.now();
        await escribir(H, clave, { doc: JSON.parse(raw), t });
        res.status(200).json({ ok: true, t }); return;
      }
      res.status(400).json({ error: "Operación desconocida" }); return;
    }

    // ===== Conectar con Claude: Dirección genera, lista y da de baja los links personales de cada persona =====
    if (b.op === "mcp_list" || b.op === "mcp_new" || b.op === "mcp_del") {
      const cr = b.cred || {};
      if (!(cr.rol === "dir" && dirOk(cr.codigo))) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código de Dirección." }); return; }
      const regC = (await leer(H, "ctcods")) || {}; const listaC = Array.isArray(regC.items) ? regC.items : [];
      const tk = (await leer(H, "mcptok")) || { items: [] }; let items = Array.isArray(tk.items) ? tk.items : [];
      const vista = async (z) => ({ id: z.id, rol: z.rol, obra: z.obra || "", ctId: z.ctId || "", nombre: z.nombre || "", creado: z.creado, ult: z.ult || 0, vigente: !!(await credToken(H, z)) });
      if (b.op === "mcp_list") { res.status(200).json({ ok: true, items: await Promise.all(items.map(vista)), roles: Object.fromEntries(Object.entries(cods.obras || {}).map(([o, c]) => [o, Object.keys(CAMPO_ROL).filter((r) => norm((c || {})[CAMPO_ROL[r]]))])) }); return; }
      if (b.op === "mcp_del") { items = items.filter((z) => z.id !== String(b.id || "")); await escribir(H, "mcptok", { items }); res.status(200).json({ ok: true }); return; }
      const rol = String(b.rol || ""); let z = null;
      const nom = String(b.nombre || "").trim().slice(0, 60);
      if (rol === "dir") { const d = dirVigente(cods); if (!nom) { res.status(400).json({ error: "Poné el nombre de la persona" }); return; } z = { key: "dir:" + norm(nom), rol, nombre: nom, ch: huellaCod(d) }; }
      else if (rol === "ct") { const x = listaC.find((c) => c.id === String(b.id || "")); if (!x) { res.status(404).json({ error: "No existe ese contratista" }); return; } z = { key: "ct:" + norm(x.cod), rol, ctId: x.id, nombre: x.nombre, ch: huellaCod(x.cod) }; }
      else if (CAMPO_ROL[rol]) {
        const ob = String(b.obra || ""); const cod = ((cods.obras || {})[ob] || {})[CAMPO_ROL[rol]];
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(ob) || !norm(cod)) { res.status(400).json({ error: "Esa obra no tiene código para ese rol: cargalo primero en Códigos de acceso." }); return; }
        z = { key: rol + ":" + ob, rol, obra: ob, nombre: nom, ch: huellaCod(cod) };
      } else { res.status(400).json({ error: "Rol inválido" }); return; }
      const k = crypto.randomBytes(18).toString("base64url");
      z = { id: "m" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), h: crypto.createHash("sha256").update("u:" + k).digest("hex"), ...z, creado: Date.now(), ult: 0 };
      items = items.filter((y) => y.key !== z.key).concat([z]).slice(-500);
      await escribir(H, "mcptok", { items });
      res.status(200).json({ ok: true, link: "https://" + (req.headers.host || "nexoentorno.vercel.app") + "/mcp/u/" + k, item: await vista(z) }); return;
    }

    // ===== Contratistas / subcontratistas (4.º panel): avisan faltantes, falta de definiciones, retrasos y adicionales DIRECTO a Dirección y Jefatura =====
    if (typeof b.op === "string" && b.op.startsWith("ct_")) {
      const str = (x, n) => String(x == null ? "" : x).slice(0, n);
      const num = (x, lo, hi) => Math.min(hi, Math.max(lo, Number(x) || 0));
      const idOk = (x) => String(x || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
      const TIPOS = ["material", "definicion", "retraso", "adicional", "otro", "presupuesto", "materiales", "auditoria", "noconv"];
      const DOC = (t) => t === "presupuesto" || t === "materiales"; // la auditoría entra como un reclamo más (se responde y cuenta en los tiempos)
      const ESTADOS = ["abierto", "gestion", "resuelto", "rechazado", "cerrado", "recibido"];
      const reg = (await leer(H, "ctcods")) || { items: [] };
      const lista = Array.isArray(reg.items) ? reg.items : [];
      const cr = b.cred || {};
      if (MODO_PRUEBAS) {
        // modo pruebas: "PRUEBAS:<id del contratista>" se cambia acá por su código real (nunca sale del servidor)
        const real = (c) => { const m = /^PRUEBAS:(.+)$/i.exec(String(c || "")); if (!m) return c; const x = lista.find((y) => String(y.id).toLowerCase() === m[1].toLowerCase()); return x ? x.cod : c; };
        if (b.op === "ct_pruebas_list") { res.status(200).json({ ok: true, items: lista.map((c) => ({ id: c.id, nombre: c.nombre, rubro: c.rubro, obra: c.obra, obraNombre: c.obraNombre })) }); return; }
        b.codigo = real(b.codigo); cr.codigo = real(cr.codigo); if (Array.isArray(cr.codigos)) cr.codigos = cr.codigos.map(real);
      }
      let quien = "", ct = null;
      // Todas las obras de un contratista: las que tienen su código y las cargadas con el mismo nombre (ej. "V+V" con un código distinto en cada obra)
      const nomN = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9+]/g, "");
      // códigos vinculados entre sí (el contratista sumó otra obra con otro código): vale en todos sus equipos
      const grupos = Array.isArray(reg.vinc) ? reg.vinc : [];
      const conVinc = (cs) => { const out = new Set(cs); grupos.forEach((g) => { if (g.some((c) => out.has(c))) g.forEach((c) => out.add(c)); }); return [...out]; };
      const misAccesos = (n) => {
        if (!n) return [];
        const propios = lista.filter((c) => norm(c.cod) === n);
        if (!propios.length) return [];
        const noms = new Set(propios.map((c) => nomN(c.nombre)).filter(Boolean));
        const todos = lista.filter((c) => norm(c.cod) === n || noms.has(nomN(c.nombre)));
        const vistos = new Set(); // una entrada por obra (primero la de su propio código)
        return [...propios, ...todos.filter((c) => !propios.includes(c))].filter((c) => (vistos.has(c.obra) ? false : (vistos.add(c.obra), true)));
      };
      if (b.op === "ct_login") {
        const n = norm(b.codigo);
        const vx = new Set(); const xs = n ? conVinc([n]).flatMap(misAccesos).filter((c) => (vx.has(c.obra) ? false : (vx.add(c.obra), true))) : [];
        const x = xs[0];
        if (!x) { await pausa(600); res.status(200).json({ ok: false }); return; }
        // un mismo contratista puede tener acceso a varias obras (mismo código): devuelve todas
        const obras = xs.map((c) => ({ id: c.obra, nombre: c.obraNombre, jw: ((reg.jw || {})[c.obra]) || "" }));
        res.status(200).json({ ok: true, ct: { id: x.id, obra: x.obra, obraNombre: x.obraNombre, nombre: x.nombre, rubro: x.rubro, jw: ((reg.jw || {})[x.obra]) || "", obras } }); return;
      }
      const obraAll = String(b.obra || "");
      let misCt = [];
      if (cr.rol === "ct") {
        // puede tener varios códigos (uno por obra): junta todas sus obras
        const cods = conVinc([cr.codigo, ...(Array.isArray(cr.codigos) ? cr.codigos : [])].map(norm).filter(Boolean)).slice(0, 40);
        const vistos = new Set(); misCt = cods.flatMap(misAccesos).filter((c) => (vistos.has(c.obra) ? false : (vistos.add(c.obra), true))); ct = misCt.find((c) => c.obra === obraAll) || misCt[0] || null; if (ct) quien = "ct"; }
      else if (cr.rol === "dir" && dirOk(cr.codigo)) quien = "dir";
      else if (cr.rol === "jefe" && norm(cr.codigo) && /^[A-Za-z0-9_-]{1,40}$/.test(obraAll) && norm((cods.obras[obraAll] || {}).j) === norm(cr.codigo)) quien = "jefe";
      // auditoría y propietario: solo leen las constancias de tarea no convencional (la auditoría todas; el propietario las que Dirección compartió)
      else if (cr.rol === "aud" && b.op === "ct_list_obra" && norm(cr.codigo) && /^[A-Za-z0-9_-]{1,40}$/.test(obraAll) && norm((cods.obras[obraAll] || {}).a) === norm(cr.codigo)) quien = "aud";
      else if (cr.rol === "prop" && b.op === "ct_list_obra" && norm(cr.codigo) && /^[A-Za-z0-9_-]{1,40}$/.test(obraAll) && norm((cods.obras[obraAll] || {}).clave) === norm(cr.codigo)) quien = "prop";
      if (!quien) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código." }); return; }
      const obra = quien === "ct" ? ct.obra : obraAll;
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra) && b.op !== "ct_list_all") { res.status(400).json({ error: "Obra inválida" }); return; }
      const clave = "ctrec_" + obra;
      const pubOk = (u) => typeof u === "string" && (u.startsWith(NEW_PUB) || u.startsWith(OLD_PUB));
      const fts = (arr) => (Array.isArray(arr) ? arr : []).filter(pubOk).slice(0, 10);
      const arch = (arr) => (Array.isArray(arr) ? arr : []).filter((a) => a && pubOk(a.u)).map((a) => ({ u: a.u, n: str(a.n, 120) })).slice(0, 10);

      if (b.op === "ct_up_url") {
        const nm = str(b.name, 120), sz = Number(b.size) || 0;
        if (sz <= 0 || sz > 50e6) { res.status(400).json({ error: "El archivo debe pesar hasta 50 MB" }); return; }
        const ext = ((/\.([A-Za-z0-9]{1,5})$/.exec(nm) || [])[1] || "jpg").toLowerCase();
        const path = `${obra}/ct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const firmar = () => fetch(`${URL_BASE}/storage/v1/object/upload/sign/nexo2-fotos/${path}`, { method: "POST", headers: H, body: "{}" });
        let r = await firmar();
        if (!r.ok) { await fetch(`${URL_BASE}/storage/v1/bucket`, { method: "POST", headers: H, body: JSON.stringify({ id: "nexo2-fotos", name: "nexo2-fotos", public: true }) }); r = await firmar(); }
        if (!r.ok) { res.status(502).json({ error: "No se pudo preparar la subida" }); return; }
        const j = await r.json(); const rel = String(j.url || "");
        const up = rel.startsWith("http") ? rel : rel ? `${URL_BASE}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}` : j.token ? `${URL_BASE}/storage/v1/object/upload/sign/nexo2-fotos/${path}?token=${j.token}` : "";
        if (!up) { res.status(502).json({ error: "No se pudo preparar la subida" }); return; }
        res.status(200).json({ ok: true, up, pub: NEW_PUB + path }); return;
      }
      if (b.op === "ct_mine") {
        if (quien !== "ct") { res.status(403).json({ error: "Solo para contratistas" }); return; }
        // todas las obras donde tiene acceso, cada reclamo con su obra
        const ids = new Set(misCt.map((c) => c.id));
        const porObra = await Promise.all(misCt.map(async (c) => { const v = await leer(H, "ctrec_" + c.obra); return ((v && v.items) || []).filter((x) => ids.has(x.ctId)).map((x) => ({ ...x, asig: undefined, hist: (x.hist || []).filter((h) => !h.interno), obraNombre: c.obraNombre })); }));
        const obras = misCt.map((c) => ({ id: c.obra, nombre: c.obraNombre, jw: ((reg.jw || {})[c.obra]) || "" }));
        res.status(200).json({ ok: true, jw: ((reg.jw || {})[ct.obra]) || "", obras, yo: { nombre: ct.nombre, rubro: ct.rubro }, items: porObra.flat() }); return;
      }
      if (b.op === "ct_new") {
        if (quien !== "ct") { res.status(403).json({ error: "Solo para contratistas" }); return; }
        const q = b.rec || {};
        const tipo = TIPOS.includes(q.tipo) ? q.tipo : "otro";
        const esDoc = DOC(tipo);
        // CON-01 · constancia de tarea no convencional / mayor tiempo de ejecución
        let nc = null;
        if (tipo === "noconv") { nc = ncLimpio(q.nc); const e = ncError(nc); if (e) { res.status(400).json({ error: e }); return; } q.titulo = "Tarea no convencional · " + nc.tareaNom; q.desc = nc.desc; q.tarea = nc.tareaNom + (nc.ubic ? " · " + nc.ubic : ""); }
        if (!esDoc && !str(q.titulo, 200).trim()) { res.status(400).json({ error: "Escribí qué pasa" }); return; }
        if (tipo === "auditoria" && !(q.aud && Array.isArray(q.aud.items) && q.aud.items.length)) { res.status(400).json({ error: "Cargá al menos una tarea en la auditoría" }); return; }
        if (esDoc && tipo !== "auditoria" && !str(q.desc, 3000).trim() && !arch(q.archivos).length && !num(q.monto, 0, 1e12)) { res.status(400).json({ error: "Adjuntá el archivo o escribí el detalle" }); return; }
        const t = Date.now();
        const rec = {
          id: "r" + t.toString(36) + Math.random().toString(36).slice(2, 5), obra, ctId: ct.id, ctNombre: ct.nombre, rubro: ct.rubro,
          tipo, titulo: str(q.titulo, 200).trim() || (tipo === "presupuesto" ? "Presupuesto" : tipo === "auditoria" ? "Auditoría de obra" : "Listado de materiales"), desc: str(q.desc, tipo === "auditoria" ? 8000 : 3000), tarea: str(q.tarea, 200), diasRetraso: esDoc ? 0 : num(q.diasRetraso, 0, 999),
          monto: num(q.monto, 0, 1e12), fotos: fts(q.fotos), archivos: arch(q.archivos), doc: esDoc, estado: esDoc ? "recibido" : "abierto", creado: t, editado: t,
          hist: [{ t, por: "ct", nom: ct.nombre, tx: esDoc ? (tipo === "presupuesto" ? "Presupuesto enviado" : tipo === "auditoria" ? "Auditoría de obra enviada" : "Listado de materiales enviado") : tipo === "noconv" ? "Constancia cargada · informada" : q.via === "claude" ? "Reclamo cargado por voz desde Claude" : "Reclamo cargado" }],
        };
        if (nc) rec.nc = nc;
        if (q.via === "claude") rec.via = "claude";
        if (tipo === "adicional" && q.cert) { const cc = certLimpio(q.cert); if (cc) rec.cert = cc; }
        if (tipo === "auditoria") {
          // auditoría del estado de la obra: qué se puede avanzar y qué no (y por qué), con la gente que hay
          const a = q.aud || {};
          const EA = ["avanza", "material", "definicion", "otro", "terminado", "parcial", "pendiente", "noconv"];
          rec.aud = { fecha: str(a.fecha, 10), personal: num(a.personal, 0, 999), ociosos: num(a.ociosos, 0, 999), concl: str(a.concl, 3000),
            items: (Array.isArray(a.items) ? a.items : []).slice(0, 80).map((x, k) => ({ n: a.inf ? k + 1 : (num(x.n, 0, 999) || undefined), tarea: str(x.tarea, 300), est: EA.includes(x.est) ? x.est : "otro", parcial: x.est === "parcial" ? (num(x.pct || x.parcial, 0, 100) || 50) : undefined, falta: str(x.falta, 300), pedido: str(x.pedido, 10), gente: num(x.gente, 0, 999), fin: str(x.fin, 10), nota: str(x.nota, 600), fotos: fts(x.fotos), nc: x.est === "noconv" && x.nc ? idOk(x.nc) : undefined, ncNum: x.est === "noconv" && x.ncNum ? str(x.ncNum, 8) : undefined })),
            reclamos: (Array.isArray(a.reclamos) ? a.reclamos : []).slice(0, 40).map((r) => ({ id: idOk(r.id), num: str(r.num, 8), titulo: str(r.titulo, 200), tipo: str(r.tipo, 40), dias: num(r.dias, 0, 9999) })),
            clase: a.clase === "def" ? "def" : undefined,
            inf: a.inf && typeof a.inf === "object" ? { semana: str(a.inf.semana, 160), resp: str(a.inf.resp, 120), obraTxt: str(a.inf.obraTxt, 120), u: pubOk(a.inf.u) ? a.inf.u : "", n: str(a.inf.n, 120), total: num(a.inf.total, 0, 999) } : undefined,
            fotosP: (Array.isArray(a.fotosP) ? a.fotosP : []).filter((f) => f && pubOk(f.u)).slice(0, 12).map((f) => ({ u: f.u, n: str(f.n, 400) })) };
        }
        // número correlativo para todos los reclamos (0001, 0002, …), desde el 16/11/2026
        const reg2 = (await leer(H, "ctcods")) || reg;
        const nro = (Number(reg2.nro) || 0) + 1;
        rec.num = String(nro).padStart(4, "0");
        await escribir(H, "ctcods", { ...reg2, nro });
        const v = await leer(H, clave);
        const items = ((v && v.items) || []);
        if (rec.aud) rec.aud.items.forEach((z) => { if (z.nc) { const c0 = items.find((y) => y.id === z.nc && y.tipo === "noconv"); if (c0) z.ncNum = c0.num; else { delete z.nc; delete z.ncNum; } } });
        if (rec.aud) {
          // los reclamos que el contratista incluyó en la auditoría quedan adentro de ella: llega un solo aviso
          const ids = new Set(rec.aud.reclamos.map((r) => r.id).filter(Boolean));
          items.forEach((x) => { if (ids.has(x.id) && x.ctId === ct.id && !x.doc) { x.enAud = rec.id; x.enAudNum = rec.num; } });
        }
        if (rec.tipo === "adicional") rec.adicId = await ctAdicSync(H, rec);
        // adicional creado desde una constancia: quedan vinculados entre sí
        if (rec.tipo === "adicional" && q.ncId) { const c0 = items.find((x) => x.id === idOk(q.ncId) && x.tipo === "noconv" && x.ctId === ct.id); if (c0) { rec.ncId = c0.id; rec.ncNum = c0.num; c0.nc = { ...(c0.nc || {}), adic: { id: rec.id, num: rec.num } }; c0.hist = (c0.hist || []).concat([{ t, por: "ct", nom: ct.nombre, tx: "Adicional N° " + rec.num + " cargado con estos datos" }]).slice(-100); c0.editado = t; } }
        items.push(rec);
        await escribir(H, clave, { items: items.slice(-500) });
        res.status(200).json({ ok: true, rec }); return;
      }
      if (b.op === "ct_cert_set") {
        // el contratista completa o corrige el certificado de un adicional ya enviado (cotización, autorización…)
        const id = idOk(b.id); const cc = certLimpio(b.cert);
        if (!cc) { res.status(400).json({ error: "Certificado inválido" }); return; }
        const v = await leer(H, clave); const items = (v && v.items) || []; const it = items.find((x) => x.id === id);
        if (!it || it.tipo !== "adicional") { res.status(404).json({ error: "No existe ese adicional" }); return; }
        if (quien === "ct" && it.ctId !== ct.id) { res.status(403).json({ error: "No es tuyo" }); return; }
        const t = Date.now(); it.cert = cc; const tot = ["materiales", "manoObra", "equipos", "subcontratos", "otros"].reduce((a, k) => { const x = (cc.cot || {})[k] || {}; const n = (z) => Number(String(z == null ? "" : z).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0; return a + n(x.c) * n(x.p); }, 0);
        if (tot) it.monto = Math.round(tot);
        it.adicId = (await ctAdicSync(H, it)) || it.adicId;
        it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([{ t, por: quien === "ct" ? "ct" : quien, nom: quien === "ct" ? ct.nombre : "Dirección", tx: "Certificado del adicional actualizado" + (cc.res ? " · " + cc.res : "") }]).slice(-100); it.editado = t;
        await escribir(H, clave, { items }); res.status(200).json({ ok: true, rec: it }); return;
      }
      if (b.op === "ct_titulo") {
        // el contratista corrige el título de lo que mandó (ej. "Otro": que diga de qué se trata)
        const id = idOk(b.id); const tit = String(b.titulo == null ? "" : b.titulo).replace(/\s+/g, " ").trim().slice(0, 200);
        if (!tit) { res.status(400).json({ error: "Escribí el título" }); return; }
        const v = await leer(H, clave); const items = (v && v.items) || []; const it = items.find((x) => x.id === id);
        if (!it) { res.status(404).json({ error: "No existe" }); return; }
        if (quien === "ct" && it.ctId !== ct.id) { res.status(403).json({ error: "No es tuyo" }); return; }
        if (tit !== it.titulo) { const t = Date.now(); it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([{ t, por: quien === "ct" ? "ct" : quien, nom: quien === "ct" ? ct.nombre : "Dirección", tx: "Título cambiado: " + tit }]).slice(-100); it.titulo = tit; it.editado = t; await escribir(H, clave, { items }); }
        res.status(200).json({ ok: true, rec: it }); return;
      }
      if (b.op === "ct_aud_editar") {
        // sumar, corregir o quitar puntos de un cumplimiento ya enviado (se recorre la obra y aparecen cosas nuevas)
        const id = idOk(b.id);
        const v = await leer(H, clave);
        const items = ((v && v.items) || []);
        const it = items.find((x) => x.id === id);
        if (!it || !it.aud || !Array.isArray(it.aud.items)) { res.status(404).json({ error: "No existe ese cumplimiento" }); return; }
        if (quien === "ct" && it.ctId !== ct.id) { res.status(403).json({ error: "No es tu cumplimiento" }); return; }
        const txt = (x) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, 300);
        const I = it.aud.items, ed = [], qu = [], ad = [];
        (Array.isArray(b.cambios) ? b.cambios : []).slice(0, 200).forEach((c) => { const x = I[Number(c && c.i)]; const t = txt(c && c.tarea); if (x && t && t !== x.tarea) { ed.push(t); x.tarea = t; } });
        const Q = new Set((Array.isArray(b.quitar) ? b.quitar : []).map(Number).filter((k) => I[k]));
        Q.forEach((k) => qu.push((I[k].n ? I[k].n + ". " : "") + (I[k].tarea || "")));
        it.aud.items = I.filter((x, k) => !Q.has(k));
        let mx = it.aud.items.reduce((m, x) => Math.max(m, Number(x.n) || 0), 0);
        (Array.isArray(b.add) ? b.add : []).slice(0, 60).map(txt).filter(Boolean).forEach((t) => { if (it.aud.items.length >= 200) return; mx++; it.aud.items.push({ n: mx, tarea: t, est: "pendiente", obra: it.obra, nuevo: Date.now() }); ad.push(mx + ". " + t); });
        let cl = "";
        if (b.clase === "def" || b.clase === "cump") { const ya = it.aud.clase === "def" ? "def" : "cump"; if (b.clase !== ya) { if (b.clase === "def") it.aud.clase = "def"; else delete it.aud.clase; cl = b.clase === "def" ? "Pasado a Pedido de definiciones" : "Pasado a Cumplimiento semanal"; if (typeof it.titulo === "string") it.titulo = b.clase === "def" ? it.titulo.replace(/^(Cumplimiento semanal|Respuesta al informe)/, "Pedido de definiciones") : it.titulo.replace(/^Pedido de definiciones/, "Cumplimiento semanal"); } }
        if (!ed.length && !qu.length && !ad.length && !cl) { res.status(400).json({ error: "No cambiaste ningún punto" }); return; }
        const t = Date.now(), nom = quien === "ct" ? ct.nombre : quien === "dir" ? "Dirección" : "Jefatura de obra";
        const tx = [cl, ad.length ? "Puntos nuevos: " + ad.join("; ") : "", ed.length ? "Puntos corregidos: " + ed.join("; ") : "", qu.length ? "Puntos quitados: " + qu.join("; ") : ""].filter(Boolean).join(" · ");
        it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([{ t, por: quien === "ct" ? "ct" : quien, nom, tx }]).slice(-100);
        it.editado = t;
        await escribir(H, clave, { items });
        res.status(200).json({ ok: true, rec: it }); return;
      }
      if (b.op === "ct_aud_cumplir") {
        // marcar tareas de una auditoría / respuesta al informe como cumplidas (o desmarcarlas)
        const id = idOk(b.id);
        const v = await leer(H, clave);
        const items = ((v && v.items) || []);
        const it = items.find((x) => x.id === id);
        if (!it || !it.aud || !Array.isArray(it.aud.items)) { res.status(404).json({ error: "No existe esa auditoría" }); return; }
        if (quien === "ct" && it.ctId !== ct.id) { res.status(403).json({ error: "No es tu reclamo" }); return; }
        const t = Date.now(), si = [], no = [], pz = [], fo = [];
        (Array.isArray(b.marcas) ? b.marcas : []).slice(0, 80).forEach((m) => {
          const k = Number(m && m.i); const x = it.aud.items[k]; if (!x) return;
          const nom = (x.n ? x.n + ". " : "") + (x.tarea || "");
          // fotos de terminada / de lo hecho (solo direcciones de la nube)
          if (Array.isArray(m.fotos)) {
            const F = m.fotos.filter((u) => typeof u === "string" && /^https:\/\//.test(u) && u.length < 600).slice(0, 6);
            const antes = JSON.stringify(x.fotosFin || []);
            if (JSON.stringify(F) !== antes) { const nuevas = F.filter((u) => !(x.fotosFin || []).includes(u)).length; x.fotosFin = F; if (nuevas) fo.push(nom + " (" + nuevas + " foto" + (nuevas > 1 ? "s" : "") + ")"); }
          }
          const pa = Math.round(Number(m.parcial) || 0);
          if (m.e === "par" && pa > 0 && pa < 100) {
            if (x.cumplida) x.cumplida = 0;
            if (Number(x.parcial) !== pa) { x.parcial = pa; pz.push(nom + " (" + pa + "%)"); }
          } else if (m.ok) {
            if (x.parcial) x.parcial = 0;
            if (!x.cumplida) { x.cumplida = t; si.push(nom); }
          } else {
            // motivo de lo no cumplido: sigue en curso, o retraso por falta de material / definición / otro
            const MO = ["avanza", "material", "definicion", "otro", "noconv"];
            if (m.e === "no" && m.motivo === "noconv" && (idOk(m.nc) || "") !== (x.nc || "")) { const c0 = items.find((z) => z.id === idOk(m.nc) && z.tipo === "noconv"); x.nc = c0 ? c0.id : undefined; x.ncNum = c0 ? c0.num : undefined; if (x.est === "noconv") no.push(nom + (c0 ? " (constancia N° " + c0.num + ")" : "")); }
            if (m.e === "no" && typeof m.falta === "string" && m.falta.trim().slice(0, 300) !== (x.falta || "")) { x.falta = m.falta.trim().slice(0, 300); if (!no.includes(nom)) no.push(nom + (x.falta ? " (falta " + x.falta + ")" : "")); }
            if (m.e === "no" && MO.includes(m.motivo) && x.est !== m.motivo) { x.est = m.motivo; if (x.cumplida) x.cumplida = 0; if (x.parcial) x.parcial = 0; no.push(nom + (m.motivo === "avanza" ? "" : " (retraso: " + (m.motivo === "material" ? "falta material" : m.motivo === "definicion" ? "falta definición" : m.motivo === "noconv" ? "tarea no convencional / mayor tiempo" + (x.ncNum ? ", constancia N° " + x.ncNum : "") : "otro motivo") + ")")); }
            if (m.e === "no" && x.est === "pendiente") { x.est = "avanza"; if (!x.cumplida) no.push(nom); }
            if (x.cumplida) { x.cumplida = 0; no.push(nom); }
            if (x.parcial) { x.parcial = 0; if (!no.includes(nom)) no.push(nom); }
            if (m.e === "no" && (x.est === "terminado" || x.est === "parcial")) { x.est = "avanza"; if (!no.includes(nom)) no.push(nom); }
          }
        });
        if (!si.length && !no.length && !pz.length && !fo.length) { res.status(400).json({ error: "No cambiaste ninguna tarea" }); return; }
        const nom = quien === "ct" ? ct.nombre : quien === "dir" ? "Dirección" : "Jefatura de obra";
        const tx = [si.length ? "Tareas cumplidas: " + si.join("; ") : "", pz.length ? "Cumplimiento parcial: " + pz.join("; ") : "", no.length ? "No cumplidas / con retraso: " + no.join("; ") : "", fo.length ? "Fotos de cómo quedó: " + fo.join("; ") : ""].filter(Boolean).join(" · ");
        it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([{ t, por: quien === "ct" ? "ct" : quien, nom, tx }]).slice(-100);
        it.editado = t;
        await escribir(H, clave, { items });
        res.status(200).json({ ok: true, rec: it }); return;
      }
      if (b.op === "ct_cmt") {
        const id = idOk(b.id);
        const v = await leer(H, clave);
        const items = ((v && v.items) || []);
        const it = items.find((x) => x.id === id);
        if (!it) { res.status(404).json({ error: "No existe ese reclamo" }); return; }
        if (quien === "ct" && it.ctId !== ct.id) { res.status(403).json({ error: "No es tu reclamo" }); return; }
        const tx = str(b.txt, 2000).trim();
        let est = ESTADOS.includes(b.estado) ? b.estado : "";
        if (quien === "ct") { if (est && est !== "cerrado" && est !== "abierto") est = ""; }
        else if (est === "cerrado") est = "";
        if (!tx && !est) { res.status(400).json({ error: "Escribí una respuesta" }); return; }
        if (quien !== "ct" && est === "rechazado" && !tx) { res.status(400).json({ error: "Explicá por qué no corresponde" }); return; }
        const t = Date.now();
        const por = quien === "ct" ? "ct" : quien;
        const nom = quien === "ct" ? ct.nombre : quien === "dir" ? "Dirección" : "Jefatura de obra";
        if (quien !== "ct" && !it.primeraResp) { it.primeraResp = t; it.primeraPor = por; }
        if (est) { it.estado = est; if (est === "resuelto") { it.resuelto = t; it.resueltoPor = por; } if (est === "abierto") { it.resuelto = 0; it.reabierto = (it.reabierto || 0) + 1; } if (est === "cerrado") it.cerradoT = t; }
        it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([{ t, por, nom, tx, estado: est || undefined, fotos: fts(b.fotos) }]).slice(-100);
        it.editado = t;
        await escribir(H, clave, { items });
        res.status(200).json({ ok: true, rec: it }); return;
      }
      if (b.op === "ct_nc_resp" || b.op === "ct_nc_set" || b.op === "ct_nc_share") {
        const id = idOk(b.id); const v = await leer(H, clave); const items = (v && v.items) || []; const it = items.find((x) => x.id === id);
        if (!it || it.tipo !== "noconv") { res.status(404).json({ error: "No existe esa constancia" }); return; }
        const t = Date.now(); const H2 = (x) => { it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([x]).slice(-100); it.editado = t; };
        if (b.op === "ct_nc_resp") {
          // Jefatura o Dirección: Conforme · Conforme con otro tiempo · Observado
          if (quien !== "dir" && quien !== "jefe") { res.status(403).json({ error: "Solo la jefatura o la Dirección" }); return; }
          const acc = ["conf", "otro", "obs"].includes(b.acc) ? b.acc : ""; if (!acc) { res.status(400).json({ error: "Elegí una respuesta" }); return; }
          const nom = str(b.nombre, 80).trim(), cmt = str(b.cmt, 1500).trim();
          if (acc !== "obs" && !nom) { res.status(400).json({ error: "Escribí el nombre de quien da la conformidad" }); return; }
          if (acc === "obs" && !cmt) { res.status(400).json({ error: "Explicá qué se observa" }); return; }
          const acep = acc === "otro" ? ncTiempo(b.acep) : null;
          if (acc === "otro" && !acep.n) { res.status(400).json({ error: "Poné el tiempo aceptado" }); return; }
          const porNom = quien === "dir" ? "Dirección" : "Jefatura de obra";
          it.nc = { ...(it.nc || {}), res: { acc, nom: nom || porNom, cmt, t, por: quien, porNom, ...(acep ? { acep } : {}) } };
          if (!it.primeraResp) { it.primeraResp = t; it.primeraPor = quien; }
          if (acc === "obs") it.estado = "gestion"; else { it.estado = "resuelto"; it.resuelto = t; it.resueltoPor = quien; }
          const tt = (x) => (x && x.n ? x.n + (x.u === "h" ? " h" : " días") + " · " + (x.p || 1) + " pers." : "");
          H2({ t, por: quien, nom: nom || porNom, estado: it.estado, tx: (acc === "conf" ? "Conforme" : acc === "otro" ? "Conforme con otro tiempo: " + tt(acep) + " (declarado " + tt(it.nc.real) + ")" : "Observado") + (cmt ? ": " + cmt : "") });
        } else if (b.op === "ct_nc_set") {
          // el contratista corrige y reenvía (por ejemplo después de una observación)
          if (quien !== "ct" || it.ctId !== ct.id) { res.status(403).json({ error: "No es tuya" }); return; }
          if (it.nc && it.nc.res && it.nc.res.acc !== "obs") { res.status(400).json({ error: "Ya tiene conformidad" }); return; }
          const nc = ncLimpio({ ...(it.nc || {}), ...(b.nc || {}) }); const e = ncError(nc); if (e) { res.status(400).json({ error: e }); return; }
          nc.adic = (it.nc || {}).adic; nc.prop = (it.nc || {}).prop; nc.res = null;
          it.nc = nc; it.titulo = "Tarea no convencional · " + nc.tareaNom; it.desc = nc.desc; it.tarea = nc.tareaNom + (nc.ubic ? " · " + nc.ubic : "");
          if (Array.isArray(b.fotos)) it.fotos = fts(b.fotos); if (Array.isArray(b.archivos)) it.archivos = arch(b.archivos);
          it.estado = "abierto"; it.resuelto = 0; it.reabierto = (it.reabierto || 0) + 1;
          H2({ t, por: "ct", nom: ct.nombre, estado: "abierto", tx: "Constancia corregida y reenviada" + (str(b.txt, 1500).trim() ? ": " + str(b.txt, 1500).trim() : "") });
        } else {
          if (quien !== "dir") { res.status(403).json({ error: "Solo Dirección" }); return; }
          it.nc = { ...(it.nc || {}), prop: !!b.v };
          H2({ t, por: "dir", nom: "Dirección", tx: b.v ? "Compartida con el propietario" : "Dejó de compartirse con el propietario" });
        }
        await escribir(H, clave, { ...(v || {}), items }); res.status(200).json({ ok: true, rec: it }); return;
      }
      if (b.op === "ct_escalar") {
        // la jefatura pasa el reclamo del contratista a la Dirección (el estudio no responde); la Dirección o la jefatura lo cierran
        if (quien === "ct") { res.status(403).json({ error: "Solo la jefatura o la Dirección" }); return; }
        const id = idOk(b.id); const v = await leer(H, clave); const items = ((v && v.items) || []); const it = items.find((x) => x.id === id);
        if (!it) { res.status(404).json({ error: "No existe ese reclamo" }); return; }
        const t = Date.now(); const nom = quien === "dir" ? "Dirección" : "Jefatura de obra";
        if (b.cerrar) { if (it.esc) it.esc = { ...it.esc, ok: t, okPor: quien }; it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([{ t, por: quien, nom, tx: "Pedido a la Dirección cerrado (destrabado)" }]).slice(-100); }
        else {
          const m = ["doc", "def", "mat", "otro"].includes(b.m) ? b.m : "otro"; const tx = str(b.txt, 1500).trim(); const por = str(b.por, 60).trim() || nom;
          it.esc = { t, m, txt: tx, por, quien };
          if (!it.primeraResp) { it.primeraResp = t; it.primeraPor = quien; }
          if (it.estado === "abierto") it.estado = "gestion";
          it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([{ t, por: quien, nom: por, tx: "Pasado a la Dirección para destrabar con el estudio" + (tx ? ": " + tx : ""), estado: it.estado }]).slice(-100);
        }
        it.editado = t; await escribir(H, clave, { items }); res.status(200).json({ ok: true, rec: it }); return;
      }
      if (b.op === "ct_enc_set") {
        // personas encargadas (nombre + WhatsApp) a las que la Dirección les asigna reclamos
        if (quien !== "dir") { res.status(403).json({ error: "Solo Dirección" }); return; }
        const enc = (Array.isArray(b.enc) ? b.enc : []).slice(0, 30).map((e) => ({ id: idOk(e.id) || ("e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)), nombre: str(e.nombre, 60).trim(), tel: String(e.tel || "").replace(/\D/g, "").slice(0, 16) })).filter((e) => e.nombre && e.tel.length >= 10);
        await escribir(H, "ctcods", { ...reg, items: lista, enc });
        res.status(200).json({ ok: true, enc }); return;
      }
      if (b.op === "ct_asignar") {
        // la Dirección asigna el reclamo a hasta 2 encargados (queda registrado; el WhatsApp se manda desde NEXO 2)
        if (quien !== "dir") { res.status(403).json({ error: "Solo Dirección" }); return; }
        const v = await leer(H, clave); const items = ((v && v.items) || []); const it = items.find((x) => x.id === idOk(b.id));
        if (!it) { res.status(404).json({ error: "No existe ese reclamo" }); return; }
        const E = Array.isArray(reg.enc) ? reg.enc : [];
        const asig = (Array.isArray(b.ids) ? b.ids : []).map((i) => E.find((e) => e.id === i)).filter(Boolean).slice(0, 2).map((e) => ({ id: e.id, nombre: e.nombre, tel: e.tel }));
        const t = Date.now();
        it.asig = asig; it.editado = t;
        it.hist = (Array.isArray(it.hist) ? it.hist : []).concat([{ t, por: "dir", nom: "Dirección", tx: asig.length ? "Asignado a " + asig.map((e) => e.nombre).join(" y ") : "Sin encargados asignados", interno: true }]).slice(-100);
        await escribir(H, clave, { items });
        res.status(200).json({ ok: true, rec: it }); return;
      }
      if (b.op === "ct_leer_informe") {
        // lee el Informe Diario / Semanal que manda la jefatura (PDF o foto) y devuelve los pedidos con su gremio
        if (quien !== "ct") { res.status(403).json({ error: "No autorizado" }); return; }
        const key = process.env.ANTHROPIC_API_KEY; if (!key) { res.status(500).json({ error: "Falta la IA en el servidor" }); return; }
        if (!pubOk(b.url)) { res.status(400).json({ error: "Archivo inválido" }); return; }
        const f = await fetch(b.url); if (!f.ok) { res.status(400).json({ error: "No pude abrir el archivo" }); return; }
        const buf = Buffer.from(await f.arrayBuffer()); if (buf.length > 20e6) { res.status(400).json({ error: "El archivo es muy pesado" }); return; }
        const ct0 = (f.headers.get("content-type") || "").toLowerCase(), esPdf = ct0.includes("pdf") || /\.pdf($|\?)/i.test(b.url) || buf.slice(0, 4).toString() === "%PDF";
        const mt = esPdf ? "application/pdf" : (/png/.test(ct0) ? "image/png" : /webp/.test(ct0) ? "image/webp" : "image/jpeg");
        const bloque = esPdf ? { type: "document", source: { type: "base64", media_type: mt, data: buf.toString("base64") } } : { type: "image", source: { type: "base64", media_type: mt, data: buf.toString("base64") } };
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 8000,
            system: "Leés informes de obra (Informe Diario / Semanal de la jefatura de obra) y devolvés SOLO un JSON válido, sin texto extra ni ```.",
            messages: [{ role: "user", content: [bloque, { type: "text", text: 'Extraé del informe: {"obra":"nombre de la obra (si el informe abarca varias obras, poné: Todas las obras)","semana":"ej: Semana 69. Del 16 al 20 de Noviembre","responsable":"nombre","tareas":[{"n":1,"texto":"texto exacto de la tarea","gremio":"gremio o persona asignada tal como figura (ej: V+V, Cesar)","obra":"obra a la que corresponde esta tarea (por el título o la sección donde está)"}]}. Incluí TODAS las tareas numeradas, en orden, con el texto completo.' + (Array.isArray(b.obras) && b.obras.length ? ' Las obras posibles son: ' + b.obras.slice(0, 40).map((x) => str(x, 80)).join(' | ') + '. En "obra" de cada tarea usá uno de esos nombres tal cual.' : '') + ' Si un dato no está, dejalo vacío.' }] }] }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { res.status(502).json({ error: (d.error && d.error.message) || "La IA no pudo leer el informe" }); return; }
        const txt = ((d.content || []).find((c) => c.type === "text") || {}).text || "";
        let j = null; try { j = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)); } catch {}
        if (!j || !Array.isArray(j.tareas) || !j.tareas.length) { res.status(200).json({ ok: false, error: "No encontré tareas en el informe. Probá con el PDF original o una foto más nítida." }); return; }
        res.status(200).json({ ok: true, inf: { obra: str(j.obra, 120), semana: str(j.semana, 160), responsable: str(j.responsable, 120), tareas: j.tareas.slice(0, 200).map((t, i) => ({ n: num(t.n, 0, 999) || i + 1, texto: str(t.texto, 300), gremio: str(t.gremio, 80), obra: str(t.obra, 120) })).filter((t) => t.texto) } }); return;
      }
      if (b.op === "ct_borr_get" || b.op === "ct_borr_set" || b.op === "ct_borr_del") {
        // auditorías en borrador: se precargan en un equipo y se terminan en la obra desde otro
        if (quien !== "ct") { res.status(403).json({ error: "No autorizado" }); return; }
        const kb = "ctborr_" + (norm(ct.nombre).slice(0, 40) || norm(ct.id));
        const cur = (await leer(H, kb)) || { items: [] }; let L = Array.isArray(cur.items) ? cur.items : [];
        if (b.op === "ct_borr_set") {
          const x = b.borr; const raw = JSON.stringify(x || null);
          if (!x || typeof x !== "object" || !/^b\d{6,16}$/.test(String(x.id || "")) || raw.length > 200000) { res.status(400).json({ error: "Borrador inválido" }); return; }
          const y = JSON.parse(raw); y.t = Date.now(); delete y.enviando; delete y.subiendo;
          L = [...L.filter((z) => z.id !== y.id), y].slice(-20);
          await escribir(H, kb, { items: L });
          res.status(200).json({ ok: true, t: y.t }); return;
        }
        if (b.op === "ct_borr_del") { L = L.filter((z) => z.id !== String(b.id || "")); await escribir(H, kb, { items: L }); }
        res.status(200).json({ ok: true, items: L }); return;
      }
      if (b.op === "ct_vincular") {
        // el contratista suma otra obra con otro código: queda guardado en el servidor para que la vea en la PC, el iPad y el celular
        if (quien !== "ct") { res.status(403).json({ error: "No autorizado" }); return; }
        const nuevo = norm(b.nuevo);
        if (!nuevo || !lista.some((c) => norm(c.cod) === nuevo)) { await pausa(600); res.status(200).json({ ok: false, error: "Código incorrecto" }); return; }
        const mios = conVinc([norm(cr.codigo), ...(Array.isArray(cr.codigos) ? cr.codigos : []).map(norm)].filter(Boolean)).filter((c) => lista.some((x) => norm(x.cod) === c));
        const todos = new Set([...mios, nuevo]);
        const resto = grupos.filter((g) => !g.some((c) => todos.has(c)));
        grupos.filter((g) => g.some((c) => todos.has(c))).forEach((g) => g.forEach((c) => todos.add(c)));
        await escribir(H, "ctcods", { ...reg, items: lista, vinc: [...resto, [...todos]] });
        res.status(200).json({ ok: true }); return;
      }
      if (b.op === "ct_pdf") {
        // el contratista armó el PDF del reclamo / auditoría: queda guardado para que lo vean Dirección y Jefatura
        if (quien !== "ct") { res.status(403).json({ error: "No autorizado" }); return; }
        const u = String(b.url || ""); if (!pubOk(u)) { res.status(400).json({ error: "PDF inválido" }); return; }
        const v = await leer(H, clave); const items = ((v && v.items) || []); const it = items.find((x) => x.id === idOk(b.id));
        if (!it) { res.status(404).json({ error: "No existe" }); return; }
        if (it.ctId !== ct.id) { res.status(403).json({ error: "No es tuyo" }); return; }
        it.pdf = u; await escribir(H, clave, { items });
        res.status(200).json({ ok: true }); return;
      }
      if (b.op === "ct_mover") {
        // el contratista lo cargó en la obra equivocada: lo pasa a otra de sus obras (mantiene el número)
        if (quien !== "ct") { res.status(403).json({ error: "No autorizado" }); return; }
        const id = idOk(b.id), dest = misCt.find((c) => c.obra === String(b.hacia || ""));
        if (!dest || dest.obra === obra) { res.status(400).json({ error: "Elegí otra de tus obras" }); return; }
        const v = await leer(H, clave); const items = (v && v.items) || [];
        const it = items.find((x) => x.id === id);
        if (!it) { res.status(404).json({ error: "No existe" }); return; }
        if (it.ctId !== ct.id) { res.status(403).json({ error: "No es tuyo" }); return; }
        const kd = "ctrec_" + dest.obra, vd = await leer(H, kd); const itemsD = (vd && vd.items) || [];
        const nuevo = { ...it, obra: dest.obra, obraNombre: dest.obraNombre, ctId: dest.id, pdf: undefined, editado: Date.now(), hist: [...(it.hist || []), { t: Date.now(), por: "ct", nom: ct.nombre, tx: "Pasado de " + (ct.obraNombre || obra) + " a " + (dest.obraNombre || dest.obra) }] };
        if (nuevo.aud && Array.isArray(nuevo.aud.items)) nuevo.aud = { ...nuevo.aud, items: nuevo.aud.items.map((z) => (z && z.obra ? { ...z, obra: dest.obra } : z)) };
        await escribir(H, kd, { ...(vd || {}), items: [...itemsD.filter((x) => x.id !== id), nuevo] });
        await escribir(H, clave, { ...(v || {}), items: items.filter((x) => x.id !== id) });
        res.status(200).json({ ok: true, rec: nuevo }); return;
      }
      if (b.op === "ct_del") {
        if (quien !== "ct") { res.status(403).json({ error: "Solo el contratista puede borrar lo que cargó" }); return; }
        const id = idOk(b.id);
        const v = await leer(H, clave);
        const items = ((v && v.items) || []);
        const it = items.find((x) => x.id === id);
        if (!it) { res.status(404).json({ error: "No existe" }); return; }
        if (it.ctId !== ct.id) { res.status(403).json({ error: "No es tuyo" }); return; }
        await escribir(H, clave, { items: items.filter((x) => x.id !== id) });
        res.status(200).json({ ok: true }); return;
      }
      if (b.op === "ct_list_obra") {
        if (quien === "ct") { res.status(403).json({ error: "No autorizado" }); return; }
        const v = await leer(H, clave);
        if (quien === "aud" || quien === "prop") {
          const L = ((v && v.items) || []).filter((x) => x.tipo === "noconv" && (quien === "aud" || (x.nc && x.nc.prop)));
          res.status(200).json({ ok: true, items: L.map((x) => { const { ctId, asig, esc, ...r } = x; return r; }), cts: [] }); return;
        }
        res.status(200).json({ ok: true, items: ((v && v.items) || []).filter((x) => quien === "dir" || x.tipo !== "presupuesto"), cts: lista.filter((c) => c.obra === obra).map((c) => (quien === "dir" ? c : { id: c.id, nombre: c.nombre, rubro: c.rubro })) }); return;
      }
      if (b.op === "ct_list_all") {
        if (quien !== "dir") { res.status(403).json({ error: "Solo Dirección" }); return; }
        const ids = Array.from(new Set([...Object.keys(cods.obras || {}), ...lista.map((c) => c.obra)]));
        const out = {};
        await Promise.all(ids.map(async (id) => { const v = await leer(H, "ctrec_" + id); if (v && v.items && v.items.length) {
          // adicionales con certificado que todavía no pasaron a la planilla de Adicionales
          let cambio = false; for (const x of v.items) { if (x.tipo === "adicional" && x.cert && !x.adicId) { x.adicId = await ctAdicSync(H, x); if (x.adicId) cambio = true; } }
          if (cambio) await escribir(H, "ctrec_" + id, { ...v, items: v.items });
          out[id] = v.items; } }));
        const tk0 = (await leer(H, "mcptok")) || {}; const mcp = {};
        (tk0.items || []).filter((z) => z.rol === "ct").forEach((z) => { const base = lista.find((c) => c.id === z.ctId); if (base) lista.filter((c) => norm(c.cod) === norm(base.cod)).forEach((c) => (mcp[c.id] = { id: z.id, creado: z.creado, ult: z.ult || 0 })); });
        res.status(200).json({ ok: true, obras: out, cts: lista, jw: reg.jw || {}, enc: reg.enc || [], mcp }); return;
      }
      if (b.op === "ct_cod_edit") {
        // Dirección corrige el nombre de la empresa y el rubro de un contratista
        if (quien !== "dir") { res.status(403).json({ error: "Solo Dirección" }); return; }
        const x = lista.find((c) => c.id === idOk(b.id));
        if (!x) { res.status(404).json({ error: "No existe" }); return; }
        const nombre = str(b.nombre, 80).trim(), rubro = str(b.rubro, 60).trim();
        if (!nombre) { res.status(400).json({ error: "Poné el nombre de la empresa" }); return; }
        const viejo = x.nombre;
        lista.forEach((c) => { if (c === x || (b.todas && norm(c.cod) === norm(x.cod)) || (b.todas && viejo && c.nombre === viejo)) { c.nombre = nombre; if (c === x || b.rubroTodas) c.rubro = rubro; } });
        await escribir(H, "ctcods", { ...reg, items: lista });
        res.status(200).json({ ok: true, cts: lista }); return;
      }
      if (b.op === "ct_jw_set") {
        // WhatsApp de la jefatura de cada obra: los contratistas le mandan el PDF del reclamo a ese número
        if (quien !== "dir") { res.status(403).json({ error: "Solo Dirección" }); return; }
        const tel = String(b.tel || "").replace(/\D/g, "").slice(0, 16);
        const jw = { ...(reg.jw || {}) }; if (tel) jw[obra] = tel; else delete jw[obra];
        await escribir(H, "ctcods", { ...reg, items: lista, jw });
        res.status(200).json({ ok: true, jw }); return;
      }
      if (b.op === "ct_cod_save") {
        if (quien !== "dir") { res.status(403).json({ error: "Solo Dirección" }); return; }
        // sumarle esta obra a un contratista que ya tiene código (mismo código para todas sus obras)
        if (b.cod) {
          const base = lista.find((c) => norm(c.cod) === norm(b.cod));
          if (!base) { res.status(400).json({ error: "No existe ese contratista" }); return; }
          if (lista.some((c) => norm(c.cod) === norm(b.cod) && c.obra === obra)) { res.status(400).json({ error: "Ya tiene acceso a esa obra" }); return; }
          const x = { id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), obra, obraNombre: str(b.obraNombre, 120), nombre: base.nombre, rubro: str(b.rubro, 60).trim() || base.rubro, cod: base.cod, creado: Date.now() };
          lista.push(x);
          await escribir(H, "ctcods", { ...reg, items: lista });
          res.status(200).json({ ok: true, ct: x }); return;
        }
        const nombre = str(b.nombre, 80).trim(), rubro = str(b.rubro, 60).trim();
        if (!nombre) { res.status(400).json({ error: "Poné el nombre del contratista" }); return; }
        const usados = new Set([norm(dirVigente(cods)), ...lista.map((c) => norm(c.cod))]);
        Object.values(cods.obras || {}).forEach((o) => ["clave", "j", "a", "e"].forEach((f) => { if (norm(o[f])) usados.add(norm(o[f])); }));
        const AL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let cod = "";
        for (let k = 0; k < 50; k++) { cod = "CT-" + Array.from({ length: 5 }, () => AL[Math.floor(Math.random() * AL.length)]).join(""); if (!usados.has(norm(cod))) break; }
        const x = { id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), obra, obraNombre: str(b.obraNombre, 120), nombre, rubro, cod, creado: Date.now() };
        lista.push(x);
        await escribir(H, "ctcods", { ...reg, items: lista });
        res.status(200).json({ ok: true, ct: x }); return;
      }
      if (b.op === "ct_cod_del") {
        if (quien !== "dir") { res.status(403).json({ error: "Solo Dirección" }); return; }
        await escribir(H, "ctcods", { ...reg, items: lista.filter((c) => c.id !== idOk(b.id)) });
        res.status(200).json({ ok: true }); return;
      }
      res.status(400).json({ error: "Operación desconocida" }); return;
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
    if (typeof b.op === "string" && b.op.startsWith("aud_") && b.op !== "aud_fotos_save") {
      const obra = String(b.obra || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const clave = "audreg_" + obra, claveT = "audtrash_" + obra;
      const DIAS30 = 30 * 864e5;
      const limpiarPapelera = async (tv) => { const t = ((tv && tv.items) || []); const vivos = t.filter((x) => Date.now() - (x.delAt || 0) < DIAS30); if (vivos.length !== t.length) await escribir(H, claveT, { items: vivos }); return vivos; };
      if (b.op === "aud_list") { const [v, tv] = await Promise.all([leer(H, clave), leer(H, claveT)]); const tr = await limpiarPapelera(tv); res.status(200).json({ ok: true, items: (v && v.items) || [], trash: tr.map((x) => ({ id: x.id, tipo: x.tipo, num: x.num, fecha: x.fecha, delAt: x.delAt, delBy: x.delBy })) }); return; }
      const cr = b.cred || {};
      const quien = cr.rol === "dir" && dirOk(cr.codigo) ? "dir" : cr.rol === "aud" && norm(cr.codigo) && norm((cods.obras[obra] || {}).a) === norm(cr.codigo) ? "aud" : "";
      if (!quien) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código para guardar el acta." }); return; }
      const S = (x, n) => String(x == null ? "" : x).slice(0, n);
      const subirB64 = async (dataUrl, pref) => {
        const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/.exec(String(dataUrl || ""));
        if (!m || m[2].length > 4_000_000) return "";
        const ext = m[1] === "image/jpeg" ? "jpg" : m[1] === "application/pdf" ? "pdf" : m[1].split("/")[1];
        const path = `${obra}/${pref}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const subir = () => fetch(`${URL_BASE}/storage/v1/object/nexo2-fotos/${path}`, { method: "POST", headers: { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": m[1], "x-upsert": "true" }, body: Buffer.from(m[2], "base64") });
        let r = await subir();
        if (!r.ok) { await fetch(`${URL_BASE}/storage/v1/bucket`, { method: "POST", headers: H, body: JSON.stringify({ id: "nexo2-fotos", name: "nexo2-fotos", public: true }) }); r = await subir(); }
        return r.ok ? `${NEW_PUB}${path}` : "";
      };
      if (b.op === "aud_up_url") {
        // URL firmada de subida directa al almacenamiento (evita el límite de 4,5 MB del pedido)
        const nm = S(b.name, 120), sz = Number(b.size) || 0;
        if (sz <= 0 || sz > 40e6) { res.status(400).json({ error: "El archivo debe pesar entre 1 byte y 40 MB" }); return; }
        const ext = ((/\.([A-Za-z0-9]{1,5})$/.exec(nm) || [])[1] || "bin").toLowerCase();
        const path = `${obra}/${S(b.pref, 8).replace(/[^a-z]/g, "") || "adj"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const firmar = () => fetch(`${URL_BASE}/storage/v1/object/upload/sign/nexo2-fotos/${path}`, { method: "POST", headers: H, body: "{}" });
        let r = await firmar();
        if (!r.ok) { await fetch(`${URL_BASE}/storage/v1/bucket`, { method: "POST", headers: H, body: JSON.stringify({ id: "nexo2-fotos", name: "nexo2-fotos", public: true }) }); r = await firmar(); }
        if (!r.ok) { res.status(502).json({ error: "No se pudo preparar la subida" }); return; }
        const j = await r.json(); const rel = String(j.url || "");
        const up = rel.startsWith("http") ? rel : rel ? `${URL_BASE}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}` : j.token ? `${URL_BASE}/storage/v1/object/upload/sign/nexo2-fotos/${path}?token=${j.token}` : "";
        if (!up) { res.status(502).json({ error: "No se pudo preparar la subida" }); return; }
        res.status(200).json({ ok: true, up, pub: NEW_PUB + path }); return;
      }
      if (b.op === "aud_foto") { const u = await subirB64(b.data, S(b.pref, 8).replace(/[^a-z]/g, "") || "aud"); if (!u) { res.status(400).json({ error: "No se pudo subir el archivo" }); return; } res.status(200).json({ ok: true, url: u }); return; }
      if (b.op === "aud_save") {
        const q = b.rec || {}; const D = q.data || {};
        const id = String(q.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30);
        if (!id || !["sup", "rev", "cert"].includes(q.tipo)) { res.status(400).json({ error: "Acta inválida" }); return; }
        const pub = (u) => String(u || "").startsWith(NEW_PUB) ? String(u).slice(0, 600) : "";
        const fotos = []; for (const u of (Array.isArray(D.fotos) ? D.fotos : []).slice(0, 40)) { const s = String(u || ""); const r = s.startsWith(NEW_PUB) ? s : await subirB64(s, "aud"); if (!r) { res.status(400).json({ error: "Una foto no está subida: reintentá la subida antes de guardar" }); return; } fotos.push(r); }
        const adjuntos = []; for (const x of (Array.isArray(D.adjuntos) ? D.adjuntos : []).slice(0, 30)) { let u = pub(x && x.u); if (!u && x && x.data) u = await subirB64(x.data, "adj"); if (!u) { res.status(400).json({ error: "Un archivo adjunto no está subido: reintentá la subida antes de guardar" }); return; } adjuntos.push({ u, n: S(x && x.n, 120), t: S(x && x.t, 60), d: S(x && x.d, 300) }); }
        let firma = null; const Fm = D.firma;
        if (Fm && typeof Fm === "object") {
          let fu = pub(Fm.png); if (!fu && Fm.data) fu = await subirB64(Fm.data, "firma");
          let pts = 0; const strokes = (Array.isArray(Fm.strokes) ? Fm.strokes : []).slice(0, 60).map((s) => (Array.isArray(s) ? s : []).slice(0, 800).map((p) => [Math.round(Number(p && p[0]) || 0), Math.round(Number(p && p[1]) || 0)])).filter((s) => (pts += s.length) < 4000);
          firma = { png: fu, strokes, w: Math.min(2000, Number(Fm.w) || 0), h: Math.min(2000, Number(Fm.h) || 0), at: Math.min(4e12, Number(Fm.at) || Date.now()), nombre: S(Fm.nombre, 200) };
        }
        const v = await leer(H, clave); const prev = ((v && v.items) || []).find((x) => x.id === id);
        let numFinal = S(prev ? prev.num : q.num, 30);
        if (!prev) { const pre = numFinal.replace(/\d+$/, ""); if (numFinal && ((v && v.items) || []).some((x) => x.num === numFinal && x.id !== id)) { const mx = ((v && v.items) || []).reduce((m, x) => (String(x.num).startsWith(pre) ? Math.max(m, parseInt(String(x.num).split("-").pop(), 10) || 0) : m), 0); numFinal = pre + String(mx + 1).padStart(3, "0"); } }
        const rec = { id, tipo: q.tipo, num: numFinal, fecha: Math.min(4e12, Math.max(0, Number(q.fecha) || 0)), resultado: S(q.resultado, 40), editado: Date.now(), por: prev ? prev.por : quien, ver: prev ? (prev.ver || 1) + 1 : 1,
          hist: prev ? [...(prev.hist || []), { ver: prev.ver || 1, editado: prev.editado || 0, fecha: prev.fecha, resultado: prev.resultado, data: prev.data }].slice(-12) : [], log: prev ? prev.log || [] : [],
          data: { periodo: S(D.periodo, 200), presentes: S(D.presentes, 200), resultado: S(D.resultado, 40), conclusion: S(D.conclusion, 1500), responsable: S(D.responsable, 200), etapa: S(D.etapa, 160), plano: S(D.plano, 80), rev: S(D.rev, 20), directiva: S(D.directiva, 1500), ejecutado: S(D.ejecutado, 80), certId: S(D.certId, 40), supId: S(D.supId, 40),
            obs: (Array.isArray(D.obs) ? D.obs : []).slice(0, 40).map((x) => ({ desc: S(x.desc, 1200), sol: S(x.sol, 1200), sector: S(x.sector, 100), crit: S(x.crit, 20) })),
            interf: (Array.isArray(D.interf) ? D.interf : []).slice(0, 20).map((x) => S(x, 600)),
            docs: (Array.isArray(D.docs) ? D.docs : []).slice(0, 30).map((x) => ({ nombre: S(x.nombre, 200), rev: S(x.rev, 20), doc: S(x.doc, 40) })), fotos, adjuntos, firma } };
        const items = ((v && v.items) || []).filter((x) => x.id !== id); items.push(rec);
        await escribir(H, clave, { items: items.slice(-400) });
        res.status(200).json({ ok: true, rec }); return;
      }
      if (b.op === "aud_pdf") {
        const id = String(b.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30), u = String(b.url || "");
        if (!id || !u.startsWith(NEW_PUB)) { res.status(400).json({ error: "PDF inválido" }); return; }
        const v = await leer(H, clave); const items = (v && v.items) || []; const it = items.find((x) => x.id === id);
        if (!it) { res.status(404).json({ error: "Acta inexistente" }); return; }
        it.pdf = u.slice(0, 600); it.pdfVer = it.ver || 1;
        await escribir(H, clave, { items });
        res.status(200).json({ ok: true }); return;
      }
      if (b.op === "aud_del") {
        const id = String(b.id || ""); const [v, tv] = await Promise.all([leer(H, clave), leer(H, claveT)]);
        const rec = ((v && v.items) || []).find((x) => x.id === id);
        if (!rec) { res.status(200).json({ ok: true }); return; }
        const tr = await limpiarPapelera(tv);
        tr.push({ ...rec, delAt: Date.now(), delBy: S(b.quien || (quien === "dir" ? "Dirección" : "Auditoría"), 60), log: [...(rec.log || []), { t: Date.now(), a: "eliminó", q: S(b.quien || quien, 60) }] });
        await escribir(H, claveT, { items: tr.slice(-200) });
        await escribir(H, clave, { items: ((v && v.items) || []).filter((x) => x.id !== id) });
        res.status(200).json({ ok: true }); return;
      }
      if (b.op === "aud_trash") { const tr = await limpiarPapelera(await leer(H, claveT)); res.status(200).json({ ok: true, items: tr }); return; }
      if (b.op === "aud_restore") {
        const id = String(b.id || ""); const [v, tv] = await Promise.all([leer(H, clave), leer(H, claveT)]);
        const tr = await limpiarPapelera(tv); const rec = tr.find((x) => x.id === id);
        if (!rec) { res.status(404).json({ error: "No está en la papelera (pasaron más de 30 días)." }); return; }
        const { delAt, delBy, ...limpio } = rec; limpio.log = [...(rec.log || []), { t: Date.now(), a: "restauró", q: S(b.quien || quien, 60) }];
        const items = ((v && v.items) || []).filter((x) => x.id !== id); items.push(limpio);
        await escribir(H, clave, { items: items.slice(-400) });
        await escribir(H, claveT, { items: tr.filter((x) => x.id !== id) });
        res.status(200).json({ ok: true, rec: limpio }); return;
      }
    }
    if (b.op === "aud_fotos_save") {
      const obra = String(b.obra || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const cr = b.cred || {};
      if (!(cr.rol === "dir" && dirOk(cr.codigo))) { await pausa(600); res.status(403).json({ error: "Volvé a ingresar tu código de Dirección." }); return; }
      const m = {}; let tot = 0;
      for (const [id, arr] of Object.entries(b.fotos && typeof b.fotos === "object" ? b.fotos : {}).slice(0, 12)) {
        if (!/^[A-Za-z0-9_-]{1,20}$/.test(id) || !Array.isArray(arr)) continue;
        m[id] = arr.filter((u) => /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(String(u)) && String(u).length < 150000).slice(0, 4).filter((u) => (tot += String(u).length) < 3000000).map(String);
      }
      await escribir(H, "audfot_" + obra, { t: Date.now(), fotos: m });
      res.status(200).json({ ok: true }); return;
    }
    // ===== 9.3 · cronograma armado en la nube (fuente única de fechas y avance) =====
    if (b.op === "crono_get") {
      const ids = (Array.isArray(b.obras) ? b.obras : []).map(String).filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 40);
      const out = {};
      await Promise.all(ids.map(async (id) => { const v = await leer(H, "crono_" + id); if (v) out[id] = v; }));
      res.status(200).json({ ok: true, crono: out }); return;
    }
    if (b.op === "crono_save") {
      const obra = String(b.obra || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(obra)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const cr = b.cred || {};
      const ok = (cr.rol === "dir" && dirOk(cr.codigo)) || (cr.rol === "jefe" && norm(cr.codigo) && norm(((cods.obras || {})[obra] || {}).j) === norm(cr.codigo));
      if (!ok) { await pausa(600); res.status(403).json({ error: "Solo Dirección o la jefatura de la obra" }); return; }
      const str = (x, n) => String(x == null ? "" : x).slice(0, n), num = (x) => (x == null || x === "" ? null : Math.min(4e12, Math.max(-4e12, Number(x) || 0)));
      const tareas = (Array.isArray(b.tareas) ? b.tareas : []).slice(0, 800).map((t) => ({ id: str(t.id, 60), n: str(t.n, 140), s: num(t.s), e: num(t.e), bs: num(t.bs), be: num(t.be), ri: num(t.ri), rf: num(t.rf), av: num(t.av) }));
      const prev = await leer(H, "crono_" + obra);
      const build = str(b.build, 20);
      if (prev && prev.build && build && prev.build > build) { res.status(409).json({ error: "Hay una versión más nueva de la app", build: prev.build }); return; }
      const val = { t: Date.now(), build, por: cr.rol === "dir" ? "dir" : "jefe", n: tareas.length, tareas };
      await escribir(H, "crono_" + obra, val);
      res.status(200).json({ ok: true, t: val.t }); return;
    }
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
      const info = { avance: num(I.avance), modelo: str(I.modelo, 120), jefe: str(I.jefe, 60), estudio: str(I.estudio, 60), entrega: num(I.entrega), base: num(I.base), desvio: Math.max(-999, Math.min(999, Math.round(Number(I.desvio) || 0))), vencidas: num(I.vencidas), defsOk: num(I.defsOk), defsTot: num(I.defsTot), etapa: str(I.etapa, 120), foto: /^https:\/\//.test(String(I.foto || "")) ? str(I.foto, 600) : /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(I.foto || "")) && String(I.foto).length < 300000 ? String(I.foto) : "", ubic: str(I.ubic, 80), plan: num(I.plan), fotosLoc: num(I.fotosLoc), fotos: (Array.isArray(I.fotos) ? I.fotos : []).filter((u) => /^https:\/\//.test(String(u))).slice(0, 12).map((u) => str(u, 600)), aud: audSan(I.aud), dots: { rojo: num(dots.rojo), naranja: num(dots.naranja), amarillo: num(dots.amarillo), verde: num(dots.verde), ok: num(dots.ok) } };
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
