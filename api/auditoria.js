// Auditorías para el asistente de Sebastián: enlace privado (con clave larga) que devuelve las últimas
// auditorías de cada obra en texto y en PDF, sin iniciar sesión. Misma base que NEXO 2 (nexo2_estado).
//
//  GET  /api/auditoria?k=CLAVE                                  → listado (texto) de las últimas actas de cada obra
//  GET  /api/auditoria?k=CLAVE&obra=puentes246                  → PDF de la última acta de esa obra
//  GET  /api/auditoria?k=CLAVE&obra=puentes246&acta=SUP-2026-057 → PDF de esa acta
//  GET  ...&f=texto | f=json                                    → mismo contenido en texto / JSON
//  POST {op:"link", cod:<código de Dirección>}                  → devuelve el enlace con la clave
//  POST {op:"rotar", cod:<código de Dirección>}                 → anula la clave anterior y devuelve el enlace nuevo
// La clave sale del código de Dirección + un número de versión (se guarda solo el número, no la clave).

import crypto from "crypto";
import zlib from "zlib";
import PDFDocument from "pdfkit";

const URL_BASE = process.env.SUPABASE_URL || "https://qaubkwiwtszebdgfrizr.supabase.co";
const norm = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const headers = (sk) => ({ apikey: sk, Authorization: "Bearer " + sk, "Content-Type": "application/json" });

async function leer(H, clave) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=valor&clave=eq.${encodeURIComponent(clave)}`, { headers: H });
  if (!r.ok) throw new Error("db " + r.status);
  const rows = await r.json();
  return rows[0] ? rows[0].valor : null;
}
async function escribir(H, clave, valor) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?on_conflict=clave`, {
    method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ clave, valor, actualizado: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("db " + r.status);
}
async function dirCode(H) {
  let v = await leer(H, "codigos");
  if (v && typeof v.v === "string") { try { v = JSON.parse(v.v); } catch { v = null; } }
  return (v && v.dir) || process.env.NEXO_DIR_CODE || process.env.NEXO2_DIR_CODE || "";
}
const claveDe = (dir, rev) => crypto.createHmac("sha256", norm(dir)).update("asistente-auditorias-" + rev).digest("hex").slice(0, 40);
const iguales = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function paras(t) {
  const out = []; let cur = "";
  String(t == null ? "" : t).split(/\r?\n/).forEach((raw) => { const l = raw.trim(); if (!l) { if (cur) out.push(cur); cur = ""; return; } if (cur && (/^(\d+[.)]|[-•*–])\s/.test(l) || /[.!?:;]$/.test(cur))) { out.push(cur); cur = l; } else cur = cur ? cur + " " + l : l; });
  if (cur) out.push(cur); return out;
}
const lat = (s) => String(s == null ? "" : s).replace(/•/g, "-").replace(/[→⇒]/g, "->").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\u0000-ÿ]/g, "");
const fechaLarga = (t) => { const d = new Date((t || 0) - 3 * 3600e3); return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear(); };
const TIPO = { sup: "Acta de supervisión de obra", rev: "Informe de revisión de documentación", cert: "Certificado de etapa ejecutada" };

async function cargarObras(H) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor&clave=like.audreg_*`, { headers: H });
  if (!r.ok) throw new Error("db " + r.status);
  const regs = await r.json();
  const rs = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor&clave=like.snap_*`, { headers: H });
  const nombres = {};
  if (rs.ok) for (const s of await rs.json()) nombres[String(s.clave).slice(5)] = (s.valor && s.valor.nombre) || "";
  return regs.map((x) => {
    const nid = String(x.clave).slice(7);
    const items = ((x.valor && x.valor.items) || []).filter((a) => a && a.id && a.tipo).slice().sort((p, q) => (q.fecha || 0) - (p.fecha || 0) || String(q.num).localeCompare(String(p.num), "es", { numeric: true }));
    return { nid, nombre: nombres[nid] || nid, items };
  }).filter((o) => o.items.length);
}
const buscarObra = (obras, q) => { const n = nrm(q); if (!n) return null; return obras.find((o) => nrm(o.nid) === n) || obras.find((o) => nrm(o.nombre) === n) || obras.find((o) => nrm(o.nombre).includes(n) || n.includes(nrm(o.nombre))) || null; };

function resumenTexto(o, a) {
  const D = a.data || {}; const L = [];
  L.push(`${TIPO[a.tipo] || a.tipo} ${a.num} · ${o.nombre} · ${fechaLarga(a.fecha)}${a.resultado ? " · Resultado: " + a.resultado : ""}`);
  if (D.periodo) L.push("Período: " + D.periodo);
  if (D.presentes) L.push("Presentes: " + D.presentes);
  if (D.etapa) L.push("Etapa: " + D.etapa);
  (D.obs || []).forEach((x, i) => { L.push(`${i + 1}. ${paras(x.desc).join(" ")}${x.sector ? " [" + x.sector + "]" : ""}${x.crit ? " (" + x.crit + ")" : ""}`); if (x.sol) L.push("   Posible solución: " + paras(x.sol).join(" ")); });
  if (!(D.obs || []).length && a.tipo !== "cert") L.push("Sin observaciones.");
  (D.interf || []).forEach((x) => L.push("Interferencia: " + paras(x).join(" ")));
  if (D.directiva) L.push("Directiva: " + paras(D.directiva).join(" "));
  if (D.conclusion) L.push("Conclusión: " + paras(D.conclusion).join(" "));
  return L.join("\n");
}

async function bajar(u) {
  try {
    if (/^data:image\/(png|jpe?g);base64,/i.test(u)) { const d = Buffer.from(u.split(",")[1], "base64"); return imagenValida(d) ? d : null; }
    if (!/^https:\/\//.test(u)) return null;
    const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > 8e6) return null;
    return imagenValida(b) ? b : null;
  } catch { return null; }
}
// pdfkit se cae con imágenes dañadas o PNG entrelazados: se comprueban antes de usarlas
function imagenValida(b) {
  try {
    if (b[0] === 0xff && b[1] === 0xd8) return b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9 && b.includes(Buffer.from([0xff, 0xc0])) || b.includes(Buffer.from([0xff, 0xc2]));
    if (b[0] === 0x89 && b[1] === 0x50) {
      let p = 8, idat = [], inter = 0, ct = 0;
      while (p + 12 <= b.length) { const len = b.readUInt32BE(p), t = b.toString("latin1", p + 4, p + 8); if (t === "IHDR") { ct = b[p + 8 + 9]; inter = b[p + 8 + 12]; } if (t === "IDAT") idat.push(b.subarray(p + 8, p + 8 + len)); if (t === "IEND") break; p += 12 + len; }
      if (inter !== 0 || !idat.length) return false;
      return !!zlibOk(Buffer.concat(idat));
    }
  } catch { /* inválida */ }
  return false;
}
function zlibOk(buf) { try { return zlib.inflateSync(buf).length > 0; } catch { return false; } }

async function pdfActa(o, a) {
  const D = a.data || {};
  const doc = new PDFDocument({ size: "A4", margins: { top: 64, bottom: 64, left: 48, right: 48 }, bufferPages: true, info: { Title: `${a.num} · ${o.nombre}`, Author: "Belfast / V+V" } });
  const chunks = []; doc.on("data", (c) => chunks.push(c));
  const fin = new Promise((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const W = doc.page.width - 96, X = 48;
  const INK = "#1b1b1b", MUT = "#6b665c", GOLD = "#a67c2a", LINE = "#d9d3c7";
  doc.rect(0, 0, doc.page.width, 8).fill(GOLD);
  doc.fillColor(MUT).font("Helvetica").fontSize(8.5).text("BELFAST · AUDITORÍA DE OBRA", X, 30, { characterSpacing: 1.2 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(19).text(lat(TIPO[a.tipo] || "Acta"), X, 48, { width: W });
  doc.moveDown(0.3).font("Helvetica").fontSize(10).fillColor(MUT).text(lat(`${a.num} · ${o.nombre} · ${fechaLarga(a.fecha)}`));
  doc.moveDown(0.8);
  const campo = (k, v) => { if (!v) return; doc.font("Helvetica-Bold").fontSize(9).fillColor(MUT).text(lat(k).toUpperCase(), X, doc.y, { width: W, characterSpacing: 0.6 }); doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(lat(v), X, doc.y + 1, { width: W }); doc.moveDown(0.5); };
  campo("Obra", o.nombre); campo("Resultado", a.resultado);
  campo("Período", D.periodo); campo("Presentes", D.presentes); campo("Etapa", D.etapa); campo("Ejecutado por", D.ejecutado); campo("Plano de referencia", D.plano); campo("Versión / revisión", D.rev);
  const hd = (t) => { if (doc.y > doc.page.height - 140) doc.addPage(); doc.moveDown(0.5); doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(lat(t), X, doc.y, { width: W }); doc.moveTo(X, doc.y + 2).lineTo(X + W, doc.y + 2).strokeColor(LINE).lineWidth(0.8).stroke(); doc.moveDown(0.6); };
  const obs = D.obs || [];
  if (a.tipo === "rev" && (D.docs || []).length) { hd("Documentos revisados"); D.docs.forEach((x) => doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(lat(`• ${x.nombre}${x.rev ? " · rev. " + x.rev : ""}`), X, doc.y, { width: W })); doc.moveDown(0.4); }
  if (a.tipo === "cert" && D.directiva) { hd("Directiva de la Jefatura de Obra"); paras(D.directiva).forEach((p) => doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(lat(p), X, doc.y, { width: W, align: "left" }).moveDown(0.4)); }
  hd(a.tipo === "sup" ? "Observaciones de la supervisión" : "Observaciones");
  if (!obs.length) doc.font("Helvetica-Oblique").fontSize(10.5).fillColor(MUT).text("Sin observaciones.", X, doc.y, { width: W });
  obs.forEach((x, i) => {
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(GOLD).text(`${i + 1}.  ${lat([x.sector, x.crit].filter(Boolean).join(" · ")) || "Observación"}`, X, doc.y, { width: W });
    paras(x.desc).forEach((p) => doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(lat(p), X + 14, doc.y + 1, { width: W - 14 }));
    if (x.sol) { doc.font("Helvetica-Bold").fontSize(9).fillColor(MUT).text("Posible solución", X + 14, doc.y + 3, { width: W - 14 }); paras(x.sol).forEach((p) => doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(lat(p), X + 14, doc.y + 1, { width: W - 14 })); }
    doc.moveDown(0.7);
  });
  if ((D.interf || []).length) { hd("Interferencias detectadas"); D.interf.forEach((x) => doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(lat("• " + paras(x).join(" ")), X, doc.y, { width: W }).moveDown(0.3)); }
  if (D.conclusion) { hd("Conclusión"); paras(D.conclusion).forEach((p) => doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(lat(p), X, doc.y, { width: W }).moveDown(0.4)); }
  // fotos y adjuntos (JPG/PNG)
  const imgs = [];
  for (const u of (D.fotos || []).slice(0, 12)) imgs.push({ u, n: "" });
  for (const x of (D.adjuntos || []).slice(0, 20)) if (x && x.u) imgs.push({ u: x.u, n: x.n || "" });
  const bufs = await Promise.all(imgs.map((x) => bajar(x.u)));
  const ok = imgs.map((x, i) => ({ ...x, b: bufs[i] })).filter((x) => x.b);
  if (ok.length) {
    hd("Fotos y adjuntos");
    const cw = (W - 12) / 2, ch = 150; let col = 0, y0 = doc.y;
    for (const x of ok) {
      if (col === 0 && y0 + ch + 16 > doc.page.height - 70) { doc.addPage(); y0 = doc.y; }
      const px = X + col * (cw + 12);
      try { doc.image(x.b, px, y0, { fit: [cw, ch], align: "center", valign: "center" }); } catch { /* imagen no soportada */ }
      if (x.n) doc.font("Helvetica").fontSize(8).fillColor(MUT).text(lat(x.n).slice(0, 60), px, y0 + ch + 2, { width: cw });
      if (col === 1) { y0 += ch + 18; col = 0; } else col = 1;
    }
    doc.y = col === 1 ? y0 + ch + 18 : y0;
  }
  const F = D.firma;
  if (F && F.png) {
    const b = await bajar(F.png);
    if (b) { if (doc.y > doc.page.height - 150) doc.addPage(); doc.moveDown(1); const y = doc.y; try { doc.image(b, X + W / 2 - 80, y, { fit: [160, 60] }); } catch { /* firma no soportada */ } doc.moveTo(X + W / 2 - 100, y + 66).lineTo(X + W / 2 + 100, y + 66).strokeColor(INK).lineWidth(0.6).stroke(); doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(lat(F.nombre || ""), X, y + 70, { width: W, align: "center" }); if (F.at) doc.fillColor(MUT).fontSize(8.5).text(lat(fechaLarga(F.at)), X, doc.y, { width: W, align: "center" }); }
  }
  const n = doc.bufferedPageRange().count;
  for (let i = 0; i < n; i++) { doc.switchToPage(i); doc.page.margins.bottom = 0; doc.font("Helvetica").fontSize(8).fillColor(MUT).text(lat(`${a.num} · ${o.nombre}`), X, doc.page.height - 40, { width: W / 2, lineBreak: false }); doc.text(`Página ${i + 1} de ${n}`, X + W / 2, doc.page.height - 40, { width: W / 2, align: "right", lineBreak: false }); }
  doc.end();
  return fin;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const sk = process.env.SUPABASE_SERVICE_KEY;
  if (!sk) { res.status(500).json({ error: "Falta SUPABASE_SERVICE_KEY en Vercel." }); return; }
  const H = headers(sk);
  try {
    const dir = await dirCode(H);
    const cfg = (await leer(H, "asist_cfg")) || { rev: 0 };
    const rev = Number(cfg.rev) || 0;
    const base = (req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "nexoentorno.vercel.app";
    const enlace = (r) => `https://${base}/api/auditoria?k=${claveDe(dir, r)}`;
    if (req.method === "POST") {
      let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } } b = b || {};
      if (!dir || norm(b.cod) !== norm(dir)) { await pausa(700); res.status(403).json({ error: "Código incorrecto." }); return; }
      if (b.op === "rotar") { await escribir(H, "asist_cfg", { rev: rev + 1, t: Date.now() }); res.status(200).json({ ok: true, enlace: enlace(rev + 1) }); return; }
      if (b.op === "link") { res.status(200).json({ ok: true, enlace: enlace(rev) }); return; }
      res.status(400).json({ error: "Operación inválida" }); return;
    }
    if (req.method !== "GET") { res.status(405).send("GET"); return; }
    const q = req.query || Object.fromEntries(new URL(req.url, "https://x").searchParams);
    if (!dir || !q.k || !iguales(q.k, claveDe(dir, rev))) { await pausa(700); res.status(403).send("Enlace no válido."); return; }
    const obras = await cargarObras(H);
    const f = String(q.f || "");
    if (q.hoy !== undefined || q.fecha) {
      const ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(q.fecha || "")) ? String(q.fecha) : new Date(Date.now() - 108e5).toISOString().slice(0, 10);
      const d0 = Date.parse(ymd + "T00:00:00-03:00"), d1 = d0 + 864e5;
      const en = (...ts) => ts.some((t) => Number(t) >= d0 && Number(t) < d1);
      const col = async (c) => { const v = await leer(H, "seg_" + c); return (v && Array.isArray(v.items) && v.items) || []; };
      const [sObras, sRegs, sAdic] = await Promise.all([col("obras"), col("registros"), col("adicionales")]);
      const nom = (id) => (sObras.find((x) => x.id === id) || {}).nombre || id;
      const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
      const out = [];
      const [dd, mm, aa] = [ymd.slice(8), ymd.slice(5, 7), ymd.slice(0, 4)];
      const L = ["CARGADO EL " + dd + "/" + mm + "/" + aa + " (todas las obras)\n"];
      for (const o of obras) for (const a of o.items) if (en(a.fecha, a.editado)) out.push({ obra: o.nombre, tipo: "Acta", texto: `${TIPO[a.tipo] || a.tipo} ${a.num}${a.resultado ? " · " + a.resultado : ""}`, link: `${enlace(rev)}&obra=${encodeURIComponent(o.nid)}&acta=${encodeURIComponent(a.num)}` });
      for (const r of sRegs) if (en(r.fecha, r.creado, r.editado)) out.push({ obra: nom(r.obra), tipo: r.tipo === "retraso" ? "Registro (retraso)" : "Registro", texto: `${r.titulo || "Registro"}${r.causa ? " · " + r.causa : ""}${r.costo ? " · " + money(r.costo) : ""}${(r.fotos || []).length ? " · " + r.fotos.length + " foto(s)" : ""}\n   ${String(r.desc || "").replace(/\s+/g, " ").slice(0, 600)}` });
      for (const x of sAdic) if (en(x.fecha, x.creado, x.editado)) out.push({ obra: nom(x.obra), tipo: "Adicional", texto: `${x.titulo} · ${money(x.monto)} · ${x.estado}` });
      if (f === "json") { res.status(200).json({ fecha: ymd, items: out }); return; }
      if (!out.length) L.push("No hay nada cargado en esa fecha.");
      const por = {}; out.forEach((i) => (por[i.obra] = por[i.obra] || []).push(i));
      Object.keys(por).forEach((k) => { L.push("== " + k + " =="); por[k].forEach((i) => L.push(`- [${i.tipo}] ${i.texto}${i.link ? "\n   PDF: " + i.link : ""}`)); L.push(""); });
      res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.status(200).send(L.join("\n")); return;
    }
    if (!q.obra) {
      const L = ["AUDITORÍAS DE OBRA (más recientes primero)\n"];
      L.push("Lo cargado hoy (todas las obras): " + enlace(rev) + "&hoy=1\n");
      for (const o of obras) {
        L.push(`== ${o.nombre} ==`);
        o.items.slice(0, 5).forEach((a, i) => L.push(`- ${a.num} · ${fechaLarga(a.fecha)} · ${TIPO[a.tipo] || a.tipo}${a.resultado ? " · " + a.resultado : ""}${i === 0 ? "  <- última" : ""}`));
        L.push(`  PDF de la última: ${enlace(rev)}&obra=${encodeURIComponent(o.nid)}\n`);
      }
      if (!obras.length) L.push("No hay actas cargadas.");
      if (f === "json") { res.status(200).json(obras.map((o) => ({ obra: o.nombre, id: o.nid, actas: o.items.slice(0, 10).map((a) => ({ num: a.num, tipo: a.tipo, fecha: fechaLarga(a.fecha), resultado: a.resultado || "" })) }))); return; }
      res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.status(200).send(L.join("\n")); return;
    }
    const o = buscarObra(obras, q.obra);
    if (!o) { res.status(404).send("No encontré esa obra. Disponibles: " + obras.map((x) => x.nombre).join(", ")); return; }
    let items = o.items; if (q.tipo) items = items.filter((a) => a.tipo === q.tipo);
    const a = !q.acta || q.acta === "ultima" ? items[0] : items.find((x) => norm(x.num) === norm(q.acta) || x.id === q.acta);
    if (!a) { res.status(404).send("No encontré esa acta."); return; }
    if (f === "texto") { res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.status(200).send(resumenTexto(o, a)); return; }
    if (f === "json") { res.status(200).json({ obra: o.nombre, num: a.num, tipo: a.tipo, fecha: fechaLarga(a.fecha), resultado: a.resultado || "", texto: resumenTexto(o, a) }); return; }
    const buf = await pdfActa(o, a);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${String(a.num).replace(/[^A-Za-z0-9_-]/g, "")}.pdf"`);
    res.status(200).send(buf);
  } catch (e) { res.status(500).json({ error: String(e.message || e).slice(0, 160) }); }
}
