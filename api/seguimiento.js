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
  obras: (q) => ({ nombre: str(q.nombre, 80), orden: num(q.orden, 0, 999), nota: str(q.nota, 400), etapa: str(q.etapa, 120), nexo: ident(q.nexo), capataz: str(q.capataz, 60) }),
  hitos: (q) => ({ obra: ident(q.obra), titulo: str(q.titulo, 120), fecha: num(q.fecha, 0, 4e12), tipo: ["hormigonado", "etapa", "entrega", "otro"].includes(q.tipo) ? q.tipo : "otro", hecho: !!q.hecho, nota: str(q.nota, 300), prevista: num(q.prevista, 0, 4e12), motivo: str(q.motivo, 300) }),
  registros: (q) => ({
    obra: ident(q.obra), tipo: q.tipo === "retraso" ? "retraso" : "hecho", titulo: str(q.titulo, 200), fecha: num(q.fecha, 0, 4e12),
    resp: str(q.resp, 120), personal: str(q.personal, 400), imputable: str(q.imputable, 120), costo: num(q.costo, 0, 1e12), desc: str(q.desc, 3000),
    tarea: str(q.tarea, 200), desde: num(q.desde, 0, 4e12), hasta: num(q.hasta, 0, 4e12), causa: str(q.causa, 200), evitable: !!q.evitable,
    dias: num(q.dias, 0, 5000), etapa: str(q.etapa, 120), detenida: str(q.detenida, 300), certAfecta: str(q.certAfecta, 300), origen: q.origen === "nexo" ? "nexo" : "", nexoId: ident(q.nexoId), nexoEd: num(q.nexoEd, 0, 4e12),
    fotos: (Array.isArray(q.fotos) ? q.fotos : []).filter((f) => f && typeof f.u === "string" && /^https:\/\/[a-z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\//.test(f.u)).slice(0, 40).map((f) => ({ u: f.u.slice(0, 400), f: num(f.f, 0, 4e12) })),
  }),
  adicionales: (q) => ({ obra: ident(q.obra), fecha: num(q.fecha, 0, 4e12), titulo: str(q.titulo, 160), monto: num(q.monto, 0, 1e12), estado: ["pendiente", "aprobado", "rechazado", "cobrado"].includes(q.estado) ? q.estado : "pendiente", nota: str(q.nota, 600) }),
  tareas: (q) => ({
    ambito: str(q.ambito, 60), titulo: str(q.titulo, 200), nota: str(q.nota, 1000),
    inicio: num(q.inicio, 0, 4e12), fin: num(q.fin, 0, 4e12), inicioReal: num(q.inicioReal, 0, 4e12), finReal: num(q.finReal, 0, 4e12),
    estado: ESTADOS.includes(q.estado) ? q.estado : "pend", resp: str(q.resp, 80), prio: ["alta", "normal"].includes(q.prio) ? q.prio : "normal",
    orden: num(q.orden, 0, 99999),
  }),
  personal: (q) => ({ obra: ident(q.obra), nombre: str(q.nombre, 80), rol: str(q.rol, 80), haciendo: str(q.haciendo, 200), nota: str(q.nota, 300), activo: q.activo !== false }),
  agenda: (q) => ({ fecha: num(q.fecha, 0, 4e12), quien: ["Nicolás", "Sebastián", "Ambos", "Nadie"].includes(q.quien) ? q.quien : "Nicolás", lugar: str(q.lugar, 80), obra: ident(q.obra), motivo: str(q.motivo, 400), hecho: !!q.hecho, fijar: !!q.fijar, hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(q.hora || "")) ? String(q.hora) : "" }),
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


function audDeReg(v, obraNom) {
  const items = ((v && v.items) || []).slice().sort((x, y) => (y.fecha || 0) - (x.fecha || 0)).slice(0, 80);
  const T = { sup: "Acta de supervisión de obra", rev: "Informe de revisión de documentación", cert: "Certificado de etapa ejecutada" };
  const f2 = (t) => { const d = new Date(t || 0); return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + String(d.getUTCFullYear()).slice(2); };
  return items.map((r) => {
    const D = r.data || {}, obs = D.obs || [];
    const obsSec = obs.length ? [{ h: r.tipo === "sup" ? "Observaciones de la supervisión" : "Observaciones", tabla: { cols: ["N°", "Observación", "Sector / ítem", "Criticidad"], rows: obs.map((x, i) => [String(i + 1), "Descripción\n" + x.desc + (x.sol ? "\nPosible solución\n" + x.sol : ""), x.sector || "—", x.crit || "—"]) } }] : [{ h: "Observaciones", texto: "Sin observaciones." }];
    let campos, secs, intro = "";
    if (r.tipo === "sup") { campos = [["Período", D.periodo || ""], ["Presentes", D.presentes || ""]]; secs = [...obsSec, ...((D.interf || []).length ? [{ h: "Interferencias detectadas", lista: D.interf }] : [])]; }
    else if (r.tipo === "rev") { const ds = D.docs || []; campos = [["Etapa a ejecutar", D.etapa || ""], ["Documentos revisados", String(ds.length)]]; secs = [{ h: "Documentos revisados", tabla: { cols: ["Plano / documento", "Revisión", "Origen"], rows: ds.map((x) => [x.nombre, x.rev || "—", "Panel del estudio"]) } }, ...obsSec]; }
    else { campos = [["Etapa certificada", D.etapa || ""], ["Ejecutado por", D.ejecutado || ""], ["Plano de referencia", D.plano || ""], ["Versión / revisión", D.rev || ""]]; intro = `Se deja constancia de que la etapa ${D.etapa || ""} de la obra ${obraNom} fue ejecutada conforme al plano de referencia indicado y a la directiva impartida por la Jefatura de Obra que se transcribe a continuación.`; secs = [{ h: "Directiva de la Jefatura de Obra", texto: D.directiva || "—" }, ...obsSec]; }
    return { id: r.id, tipo: r.tipo, num: r.num, fecha: r.fecha, doc: { titulo: T[r.tipo], sub: "Auditoría de obra · Belfast", obra: obraNom, num: r.num, fecha: f2(r.fecha), resultado: r.resultado, conclusion: D.conclusion || "", intro, campos, secciones: secs, fotos: (D.fotos || []).filter((u) => /^https:\/\//.test(u)).slice(0, 12), adj: (D.adjuntos || []).slice(0, 20).map((x) => ({ u: /^https:\/\//.test(x.u || "") ? x.u : "", n: String(x.n || "").slice(0, 120), t: String(x.t || "").slice(0, 60), d: String(x.d || "").slice(0, 300) })), firma: D.firma && /^https:\/\//.test(D.firma.png || "") ? { png: D.firma.png, at: D.firma.at || 0 } : null, ver: r.ver || 1, firmas: [[D.responsable || "Responsable técnico", "Auditoría de obra"]] } };
  });
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
      // Golf 293 (NEXO 2: o3) se agrega una sola vez; si después se borra a mano, no vuelve
      try {
        const fl = (await leer(H, "seg_flags")) || {};
        if (!fl.golf293) {
          const nr = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
          if (!obras.some((o) => nr(o.nombre) === "golf293" || o.nexo === "o3")) {
            obras.push({ id: "golf293", nombre: "Golf 293", orden: obras.length, nota: "", etapa: "", nexo: "o3", capataz: "", por: "sistema", creado: Date.now(), editado: Date.now() });
            await escribir(H, "seg_obras", { items: obras });
          }
          await escribir(H, "seg_flags", { ...fl, golf293: true });
        }
      } catch (e) { /* si falla, se reintenta en la próxima carga */ }
      const [tareas, personal, gastos, sueldos, agenda, hitos, bitOld, adicionales] = await Promise.all(["tareas", "personal", "gastos", "sueldos", "agenda", "hitos", "bitacora", "adicionales"].map((c) => leerCol(H, c)));
      let registros = await leerCol(H, "registros");
      if (bitOld.length) { // la "bitácora" pasó a llamarse Registros: se traen las anotaciones viejas
        const nuevos = bitOld.map((x) => ({ id: "r" + x.id, obra: x.obra, tipo: "hecho", titulo: String(x.texto || "").split("\n")[0].slice(0, 80) || "Anotación", fecha: x.fecha, resp: "", personal: "", imputable: "", costo: 0, desc: x.texto || "", tarea: "", desde: 0, hasta: 0, causa: "", evitable: false, fotos: [], por: x.por, creado: x.creado, editado: x.editado, editor: x.editor }));
        registros = [...registros, ...nuevos];
        await escribir(H, "seg_registros", { items: registros });
        await escribir(H, "seg_bitacora", { items: [] });
      }
      res.status(200).json({ ok: true, quien, obras, tareas, personal, gastos, sueldos, agenda, hitos, registros, adicionales, ahora: Date.now() });
      return;
    }

    // ---- lectura de NEXO 2 (solo lectura: acá nunca se escribe nada en NEXO 2) ----
    if (b.op === "nexo") {
      const MAP = { puentes132: "o1", castores475: "o2", puentes246: "o4" };
      const obras = await leerCol(H, "obras");
      const out = {};
      // obras de NEXO 2 que no están vinculadas a mano: se casan por nombre exacto (sin tildes ni mayúsculas)
      const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").replace(/(^|[^0-9])0+(?=[0-9])/g, "$1");
      let snaps = [];
      try {
        const rs = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor&clave=like.snap_*`, { headers: H });
        if (rs.ok) snaps = (await rs.json()).map((r) => ({ nid: String(r.clave).slice(5), nombre: (r.valor && r.valor.nombre) || "" }));
      } catch (e) { snaps = []; }
      // configuración de obras de NEXO 2 (nombres y renders subidos): se lee directo, sin esperar a que Dirección abra NEXO 2
      const cfgFotos = {};
      try {
        const c = await leer(H, "cfg");
        const O = (c && typeof c.v === "string" && JSON.parse(c.v)) || {};
        const https = (u) => typeof u === "string" && /^https:\/\//.test(u) && u.length < 600;
        for (const n of Array.isArray(O.nuevas) ? O.nuevas : []) {
          if (!n || !ident(n.id)) continue;
          cfgFotos[n.id] = [n.imgUrl, ...(Array.isArray(n.renders) ? n.renders : [])].filter(https).slice(0, 12);
          if (!snaps.some((x) => x.nid === n.id)) snaps.push({ nid: n.id, nombre: n.nombre || "" });
        }
        for (const [id, ch] of Object.entries(O.mod || {})) {
          const L = [ch && ch.imgUrl, ...(ch && Array.isArray(ch.renders) ? ch.renders : [])].filter(https).slice(0, 12);
          if (L.length) cfgFotos[id] = L;
        }
      } catch (e) { /* sin configuración: se usa lo publicado */ }
      const porNombre = (nom) => {
        const n = nrm(nom); if (!n) return "";
        const igual = snaps.filter((x) => nrm(x.nombre) === n);
        return igual.length ? igual[0].nid : "";
      };
      for (const o of obras) {
        const nid = o.nexo || MAP[o.id] || porNombre(o.nombre);
        if (!nid || !/^[A-Za-z0-9_-]{1,40}$/.test(nid)) continue;
        const [snap, inf, areg] = await Promise.all([leer(H, "snap_" + nid), leer(H, "informes_" + nid), leer(H, "audreg_" + nid).catch(() => null)]);
        const I = ((inf && inf.items) || []).slice().sort((x, y) => (y.desde || 0) - (x.desde || 0));
        const ult = I[0];
        const frenadas = ult ? (ult.tareas || []).filter((t) => t.causa && (t.av === null || t.av < 100) && t.causa !== "Interna de la constructora").map((t) => ({ name: t.name, causa: t.causa, causaTxt: t.causaTxt || "", resp: t.resp || "", desde: t.desdeF || 0, card: t.card || "", av: t.av })) : [];
        out[o.id] = { audReg: audDeReg(areg, o.nombre), nexo: nid, snapT: (snap && snap.t) || 0, info: (snap && snap.info) || null, fotosCfg: cfgFotos[nid] || [], cards: (snap && snap.cards) || [], informeDesde: ult ? ult.desde : 0, informeHasta: ult ? ult.hasta : 0, frenadas };
      }
      res.status(200).json({ ok: true, nexo: out });
      return;
    }

    // ---- trae los registros de NEXO 2 (solo lectura sobre NEXO 2: se copian acá y se mantienen al día) ----
    if (b.op === "importar_nexo") {
      const NX = [["o1", "Los Puentes 132"], ["o2", "Castores 475"], ["o3", "Golf 293"], ["o4", "Los Puentes 246"]];
      const MAP0 = { puentes132: "o1", castores475: "o2", puentes246: "o4" };
      let obras = await leerCol(H, "obras");
      let regs = await leerCol(H, "registros");
      const borrados = new Set(((await leer(H, "seg_borrados")) || {}).ids || []);
      const hab = (a, bb) => { let n = 0; for (let d = a + 864e5; d <= bb; d += 864e5) { const w = new Date(d).getUTCDay(); if (w > 0 && w < 6) n++; } return n; };
      let nuevos = 0, actualizados = 0, quitados = 0, obrasNuevas = 0;
      for (const [nid, nombre] of NX) {
        const v = await leer(H, "gestion_" + nid);
        const items = (v && v.items) || [];
        let ob = obras.find((o) => o.nexo === nid || (!o.nexo && MAP0[o.id] === nid));
        if (!ob) {
          if (!items.length) continue;
          ob = { id: nombre.toLowerCase().replace(/[^a-z0-9]/g, ""), nombre, orden: obras.length, nota: "", etapa: "", nexo: nid, por: "sistema", creado: Date.now(), editado: Date.now() };
          obras.push(ob); obrasNuevas++;
        }
        const vistos = new Set();
        for (const r of items) {
          const id = "n_" + nid + "_" + ident(r.id);
          vistos.add(id);
          if (borrados.has(id)) continue;
          const prev = regs.find((x) => x.id === id);
          if (prev && (prev.nexoEd || 0) >= (r.editado || 0)) continue;
          const esH = r.tipo === "hecho";
          const est = Number(r.estDias) || 0;
          const real = r.realDias !== "" && r.realDias != null ? Number(r.realDias) || 0 : (r.inicio && r.fin ? hab(r.inicio - 864e5, r.fin) : 0);
          const arr = r.arranqueDias !== "" && r.arranqueDias != null ? Number(r.arranqueDias) || 0 : (r.posible && r.inicio && r.inicio > r.posible ? hab(r.posible - 864e5, r.inicio - 864e5) : 0);
          const dias = esH ? 0 : Math.max(0, real + arr - est);
          const monto = esH ? Number(r.costo) || 0 : dias * (Number(r.personas) || 0) * (Number(r.valor) || 0) + (Number(r.costo) || 0);
          const causas = (r.causas || []).concat(r.causaTxt ? [r.causaTxt] : []).join(" + ");
          const titulo = esH ? (r.titulo || "Registro") : (r.titulo || ("Retraso en " + (r.tarea || "la obra") + (causas ? " : " + causas : "")));
          const desc = esH ? (r.desc || "") : [r.causaTxt, r.nota, r.detenida ? "Tarea detenida: " + r.detenida : "", r.certAfecta ? "Esto atrasó el cobro de: " + r.certAfecta : ""].filter(Boolean).join("\n");
          const fotos = [...(r.fotosIni || []), ...(r.fotosFin || [])].map((f) => ({ u: f.u, f: f.f || 0 }));
          const nuevo = COLS.registros({ obra: ob.id, tipo: esH ? "hecho" : "retraso", titulo, fecha: r.fecha || r.inicio || r.fin || r.creado || 0, resp: r.resp, personal: r.personal, imputable: r.imputable, costo: monto, desc, tarea: r.tarea, desde: r.posible || r.inicio || 0, hasta: r.fin || 0, causa: causas, evitable: r.evitable, dias, etapa: r.etapa, detenida: r.detenida, certAfecta: r.certAfecta, origen: "nexo", nexoId: ident(r.id), nexoEd: r.editado || 1, fotos });
          const it = { ...nuevo, id, por: "NEXO 2", creado: (prev && prev.creado) || r.creado || Date.now(), editado: Date.now(), editor: "NEXO 2" };
          regs = regs.filter((x) => x.id !== id); regs.push(it);
          prev ? actualizados++ : nuevos++;
        }
        const antes = regs.length;
        regs = regs.filter((x) => !(x.origen === "nexo" && x.obra === ob.id && x.id.startsWith("n_" + nid + "_") && !vistos.has(x.id)));
        quitados += antes - regs.length;
      }
      if (nuevos || actualizados || quitados) await escribir(H, "seg_registros", { items: regs.slice(-3000) });
      if (obrasNuevas) await escribir(H, "seg_obras", { items: obras });
      res.status(200).json({ ok: true, nuevos, actualizados, quitados, obrasNuevas });
      return;
    }

    // ---- trae las bitácoras de la app anterior de V+V (solo lectura sobre esa app) ----
    if (b.op === "aud_old") {
      const OLD = "https://bxhjgxzvayszfqwlwinq.supabase.co", OK = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
      const HO = { apikey: OK, Authorization: "Bearer " + OK };
      const leerOld = async (k) => { const r = await fetch(`${OLD}/rest/v1/bco_storage?key=eq.${k}&select=value&limit=1`, { headers: HO }); if (!r.ok) throw new Error("old " + r.status); const rows = await r.json(); let v = rows[0] ? rows[0].value : null; if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } } return v; };
      let aud, obOld;
      try { [aud, obOld] = await Promise.all([leerOld("vv_auditoria"), leerOld("vv_obras")]); } catch (e) { res.status(200).json({ ok: true, por: {}, total: 0, sinObra: [], leidas: -1, error: String(e.message || e).slice(0, 80) }); return; }
      if (!Array.isArray(aud)) {
        let claves = []; try { const r = await fetch(`${OLD}/rest/v1/bco_storage?key=ilike.*audit*&select=key&limit=20`, { headers: HO }); if (r.ok) claves = (await r.json()).map((x) => x.key); } catch { }
        aud = []; for (const k of claves.filter((k) => /^vv_audit/i.test(k) && !/bak/i.test(k)).slice(0, 3)) { try { const v = await leerOld(k); if (Array.isArray(v)) { aud = v; break; } } catch { } }
        if (!aud.length) { res.status(200).json({ ok: true, por: {}, total: 0, sinObra: [], leidas: 0, forma: "claves parecidas: " + (claves.join(", ") || "ninguna") }); return; }
      }
      const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
      const obras = await leerCol(H, "obras");
      const nomOld = {}; (Array.isArray(obOld) ? obOld : []).forEach((o) => { nomOld[o.id] = o.nombre; });
      const casar = (nom) => { const n = nrm(nom); if (!n) return null; return obras.find((o) => nrm(o.nombre) === n) || obras.find((o) => nrm(o.nombre).includes(n) || n.includes(nrm(o.nombre))) || null; };
      const S = (x, n) => String(x == null ? "" : x).slice(0, n);
      const dts = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : 0; };
      const dmy = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || "")); return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : S(f, 20); };
      const T = { supervision: ["sup", "Acta de supervisión de obra"], revision: ["rev", "Informe de revisión de documentación"], certificacion: ["cert", "Certificado de etapa ejecutada"] };
      const por = {}; const sinObra = new Set(); let total = 0;
      for (const it of aud) {
        const t = T[it.tipo]; if (!t) continue;
        const nom = nomOld[it.obra_id] || it.obra_nombre || "";
        const ob = casar(nom); if (!ob) { if (nom) sinObra.add(nom); continue; }
        const obs = (Array.isArray(it.obs) ? it.obs : []).slice(0, 40);
        const obsSec = obs.length ? [{ h: it.tipo === "supervision" ? "Observaciones de la supervisión" : "Observaciones", tabla: { cols: ["N°", "Observación", "Sector / ítem", "Criticidad"], rows: obs.map((x, i) => [String(i + 1), S(x.txt, 800), S(x.sector || "—", 100), S(x.crit || "Media", 20)]) } }] : [{ h: "Observaciones", texto: "Sin observaciones." }];
        let campos, secs;
        if (it.tipo === "supervision") { campos = [["Período", S(it.periodo, 200)], ["Presentes", S(it.presentes, 200)]]; secs = [...obsSec, ...((it.interferencias || []).filter(Boolean).length ? [{ h: "Interferencias detectadas", lista: it.interferencias.filter(Boolean).slice(0, 20).map((x) => S(x, 600)) }] : [])]; }
        else if (it.tipo === "revision") { const ds = (Array.isArray(it.docs) ? it.docs : []).slice(0, 30); campos = [["Etapa a ejecutar", S(it.etapa, 160)], ["Documentos revisados", String(ds.length)]]; secs = [{ h: "Documentos revisados", tabla: { cols: ["Plano / documento", "Revisión", "Fecha"], rows: ds.map((d) => [S(d.nombre, 200), S(d.version || "—", 20), S(d.fechaDoc || "—", 30)]) } }, ...obsSec]; }
        else { campos = [["Etapa certificada", S(it.etapa, 160)], ["Ejecutado por", S(it.ejecutadoPor, 80)], ["Plano de referencia", S(it.planoRef, 80)], ["Versión / revisión", S(it.versionPlano, 20)]]; secs = [{ h: "Directiva de la Jefatura de Obra", texto: S(it.directiva || "—", 1500) }, ...obsSec]; }
        const fotos = (Array.isArray(it.fotos) ? it.fotos : []).map((f) => (f && f.url) || "").filter((u) => /^https:\/\//.test(u)).slice(0, 8).map((u) => S(u, 600));
        const rec = { id: "o_" + S(it.id, 30).replace(/[^A-Za-z0-9_-]/g, ""), tipo: t[0], num: S(it.nro, 30), fecha: dts(it.fecha) || Number(it.ts) || 0, viejo: true, sinFotos: (Array.isArray(it.fotos) ? it.fotos.length : 0) - fotos.length,
          doc: { titulo: t[1], sub: "Auditoría de obra · App anterior", obra: ob.nombre, num: S(it.nro, 30), fecha: dmy(it.fecha), resultado: S(it.resultado, 40), conclusion: S(it.conclusion, 800), intro: "", campos, secciones: secs, fotos, firmas: [[S(it.responsable || "Responsable técnico", 60), "Auditoría de obra"]] } };
        (por[ob.id] = por[ob.id] || []).push(rec); total++;
      }
      const hist = ((await leer(H, "seg_auditoria_hist")) || {}).items || [];
      const ids = new Set(hist.map((x) => x.id)); let nuevos = 0;
      Object.entries(por).forEach(([oid, L]) => L.forEach((r) => { if (!ids.has(r.id)) { hist.push({ ...r, obra: oid }); nuevos++; } }));
      if (nuevos) await escribir(H, "seg_auditoria_hist", { items: hist.slice(-1500) });
      const out = {}; hist.forEach((r) => { (out[r.obra] = out[r.obra] || []).push(r); });
      res.status(200).json({ ok: true, por: out, total: hist.length, sinObra: [...sinObra], leidas: aud.length }); return;
    }
    if (b.op === "importar_bitacora") {
      const OLD = "https://bxhjgxzvayszfqwlwinq.supabase.co", OK = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
      const HO = { apikey: OK, Authorization: "Bearer " + OK };
      const leerOld = async (k) => { const r = await fetch(`${OLD}/rest/v1/bco_storage?key=eq.${k}&select=value&limit=1`, { headers: HO }); if (!r.ok) throw new Error("old " + r.status); const rows = await r.json(); let v = rows[0] && rows[0].value; if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } } return v; };
      const bit = await leerOld("vv_bitacora"), obOld = await leerOld("vv_obras");
      if (!Array.isArray(bit)) { res.status(200).json({ ok: true, nuevos: 0, total: 0, sinObra: [] }); return; }
      const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const obras = await leerCol(H, "obras");
      let regs = await leerCol(H, "registros");
      const borrados = new Set(((await leer(H, "seg_borrados")) || {}).ids || []);
      const nomOld = {}; (Array.isArray(obOld) ? obOld : []).forEach((o) => { nomOld[o.id] = o.nombre; });
      const casar = (nom) => { const n = nrm(nom); if (!n) return null; return obras.find((o) => nrm(o.nombre) === n) || obras.find((o) => nrm(o.nombre).includes(n) || n.includes(nrm(o.nombre))) || null; };
      const dts = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : 0; };
      let nuevos = 0; const sinObra = new Set();
      for (const h of bit) {
        const nom = nomOld[h.obra_id] || h.obra_nombre || "";
        const ob = casar(nom);
        if (!ob) { if (nom) sinObra.add(nom); continue; }
        const id = "v_" + ident(h.id || String(h.ts || Math.random()));
        if (borrados.has(id) || regs.some((x) => x.id === id)) continue;
        const dd = Number(h.diasDesvio) || 0;
        const adj = (h.adjuntos || []).map((a) => `${a.nombre || "adjunto"}${a.url ? " (" + a.url + ")" : ""}`).join("\n");
        const nuevo = COLS.registros({ obra: ob.id, tipo: dd > 0 ? "retraso" : "hecho", titulo: h.titulo || String(h.desc || "").slice(0, 80) || "Anotación", fecha: dts(h.fecha) || h.ts || 0, desc: [h.desc, adj ? "Adjuntos:\n" + adj : ""].filter(Boolean).join("\n\n"), causa: h.categoriaDesvio || h.causaDesvio || "", dias: dd, etapa: h.etapa || "", origen: "", fotos: (h.fotos || []).map((f) => ({ u: typeof f === "string" ? f : f && (f.url || f.u) || "", f: dts(h.fecha) })) });
        regs.push({ ...nuevo, id, por: "App anterior", creado: h.ts || Date.now(), editado: Date.now(), editor: "App anterior" }); nuevos++;
      }
      if (nuevos) await escribir(H, "seg_registros", { items: regs.slice(-3000) });
      res.status(200).json({ ok: true, nuevos, total: bit.length, sinObra: [...sinObra] });
      return;
    }

    // ---- renders de la app anterior de V+V (solo lectura): se casan con las obras por nombre ----
    if (b.op === "aud_fotos") {
      const nid = String(b.nexo || "");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(nid)) { res.status(400).json({ error: "Obra inválida" }); return; }
      const v = await leer(H, "audfot_" + nid);
      const m = (v && v.fotos) || {};
      res.status(200).json({ ok: true, fotos: m[String(b.id || "")] || [] }); return;
    }
    if (b.op === "renders_obras") {
      const OLD = "https://bxhjgxzvayszfqwlwinq.supabase.co", OK = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
      const HO = { apikey: OK, Authorization: "Bearer " + OK };
      const leerOld = async (k) => { const r = await fetch(`${OLD}/rest/v1/bco_storage?key=eq.${k}&select=value&limit=1`, { headers: HO }); if (!r.ok) throw new Error("old " + r.status); const rows = await r.json(); let v = rows[0] && rows[0].value; if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } } return v; };
      let rend = null, obOld = null;
      try { [rend, obOld] = await Promise.all([leerOld("vv_renders"), leerOld("vv_obras")]); } catch (e) { res.status(200).json({ ok: true, renders: {}, error: String(e.message || e) }); return; }
      const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").replace(/(^|[^0-9])0+(?=[0-9])/g, "$1");
      const obras = await leerCol(H, "obras");
      const out = {};
      for (const ov of Array.isArray(obOld) ? obOld : []) {
        const lista = rend && rend[ov.id];
        if (!Array.isArray(lista) || !lista.length) continue;
        const n = nrm(ov.nombre); if (!n) continue;
        const ob = obras.find((o) => nrm(o.nombre) === n) || obras.find((o) => nrm(o.nombre).includes(n) || n.includes(nrm(o.nombre)));
        if (!ob) continue;
        const urls = lista.map((x) => (x && typeof x === "object" ? x.url : x)).filter((u) => typeof u === "string" && (/^https:\/\//.test(u) || (/^data:image\//.test(u) && u.length < 450000)));
        if (urls.length) out[ob.id] = urls.slice(0, 1);
      }
      res.status(200).json({ ok: true, renders: out });
      return;
    }

    if (b.op === "foto") {
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(b.data || ""));
      if (!m || m[2].length > 4000000) { res.status(400).json({ error: "Foto inválida o muy pesada" }); return; }
      const buf = Buffer.from(m[2], "base64");
      const path = `seguimiento/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
      const subir = () => fetch(`${URL_BASE}/storage/v1/object/nexo2-fotos/${path}`, { method: "POST", headers: { apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "image/" + m[1], "x-upsert": "true" }, body: buf });
      let r = await subir();
      if (!r.ok) { await fetch(`${URL_BASE}/storage/v1/bucket`, { method: "POST", headers: H, body: JSON.stringify({ id: "nexo2-fotos", name: "nexo2-fotos", public: true }) }); r = await subir(); }
      if (!r.ok) { res.status(502).json({ error: "No se pudo guardar la foto" }); return; }
      res.status(200).json({ url: `${URL_BASE}/storage/v1/object/public/nexo2-fotos/${path}` });
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
      // lectura, escritura y verificación: si dos pedidos pisan la misma lista, se reintenta para no perder datos
      let base = items;
      for (let t = 0; t < 4; t++) {
        const sin = base.filter((x) => x.id !== id);
        sin.push(item);
        await escribir(H, "seg_" + col, { items: sin.slice(-3000) });
        const ver = await leerCol(H, col);
        if (ver.some((x) => x.id === id && x.editado === item.editado)) { if (t === 0 || base.every((x) => ver.some((y) => y.id === x.id))) break; }
        base = ver.length ? ver : base;
        await pausa(120 + Math.random() * 200);
        const otra = await leerCol(H, col);
        base = [...otra, ...base.filter((x) => !otra.some((y) => y.id === x.id))];
      }
      res.status(200).json({ ok: true, item });
      return;
    }

    if (b.op === "borrar") {
      const id = ident(b.id);
      if (col === "registros" && /^[nv]_/.test(id)) { const bo = (await leer(H, "seg_borrados")) || { ids: [] }; await escribir(H, "seg_borrados", { ids: [...new Set([...(bo.ids || []), id])].slice(-2000) }); }
      const items = await leerCol(H, col);
      await escribir(H, "seg_" + col, { items: items.filter((x) => x.id !== id) });
      if (col === "obras") {
        for (const c of ["tareas", "personal", "hitos", "registros", "adicionales"]) {
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
