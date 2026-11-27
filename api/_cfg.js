// Guardado de la configuración de NEXO 2 repartido en filas (STO-01).
// Antes: una sola fila "cfg" con todo ({t, v: JSON en texto}).
// Ahora:  "cfgx"        → índice + datos generales (avisos, plantillas, eliminadas…), chico
//         "cfgo_<id>"   → una fila por obra (lo que antes estaba en mod[id] o en nuevas[])
// Afuera se sigue viendo igual: leerCfg() arma el mismo {t, v} de siempre, idéntico carácter por carácter.
// Cada fila guarda su entrada como texto (jsonb reordena claves; el texto no) y su hora "t".

export const LIM_FILA = 1_000_000; // tope propio por fila (bytes); aviso al 70 %
/* comparación de la parte general sin depender del orden de las claves (la base las reordena) */
const gK = (g, sinAvisos) => Object.keys(g || {}).filter((k) => !(sinAvisos && k === "avisos")).sort().map((k) => k + "=" + (typeof g[k] === "string" ? g[k] : JSON.stringify(g[k]))).join("\n");
const bytes = (s) => Buffer.byteLength(String(s || ""), "utf8");
const okId = (id) => /^[A-Za-z0-9_-]{1,40}$/.test(String(id || ""));

/* parte un cfg (objeto) en índice + filas por obra, recordando el orden exacto */
export function partir(C) {
  const orden = Object.keys(C);
  // todo va como texto: la base (jsonb) reordena las claves de los objetos y así el armado no sería idéntico
  const g = {}; orden.forEach((k) => { if (k !== "mod" && k !== "nuevas") g[k] = JSON.stringify(C[k]); });
  const mod = C.mod && typeof C.mod === "object" && !Array.isArray(C.mod) ? C.mod : null;
  const nuevas = Array.isArray(C.nuevas) ? C.nuevas : null;
  const filas = {}, idsMod = [], idsNue = [], sueltas = [];
  if (mod) for (const [id, e] of Object.entries(mod)) { if (!okId(id)) { sueltas.push(["m", id, JSON.stringify(e)]); continue; } idsMod.push(id); filas[id] = { k: "m", s: JSON.stringify(e) }; }
  if (nuevas) nuevas.forEach((e, i) => { const id = e && e.id; if (!okId(id) || filas[id]) { idsNue.push({ x: i }); sueltas.push(["n", i, JSON.stringify(e)]); return; } idsNue.push(id); filas[id] = { k: "n", s: JSON.stringify(e) }; });
  return { orden, g, idsMod: mod ? idsMod : null, idsNue: nuevas ? idsNue : null, filas, sueltas };
}

/* vuelve a armar el texto del cfg: mismo resultado que JSON.stringify(C) */
export function armar(ix, filas) {
  const S = (x) => JSON.stringify(x);
  const suel = ix.sueltas || [];
  const partes = (ix.orden || []).map((k) => {
    if (k === "mod" && ix.idsMod) {
      const L = ix.idsMod.filter((id) => filas[id]).map((id) => S(id) + ":" + filas[id].s);
      suel.filter((x) => x[0] === "m").forEach((x) => L.push(S(x[1]) + ":" + x[2]));
      return S(k) + ":{" + L.join(",") + "}";
    }
    if (k === "nuevas" && ix.idsNue) {
      const L = ix.idsNue.map((id) => (typeof id === "string" ? (filas[id] ? filas[id].s : null) : ((suel.find((x) => x[0] === "n" && x[1] === id.x) || [])[2] ?? null))).filter((x) => x != null);
      return S(k) + ":[" + L.join(",") + "]";
    }
    return S(k) + ":" + (typeof ix.g[k] === "string" ? ix.g[k] : S(ix.g[k]));
  });
  return "{" + partes.join(",") + "}";
}

async function filasPrefijo(URL_BASE, H, pref) {
  const r = await fetch(`${URL_BASE}/rest/v1/nexo2_estado?select=clave,valor&clave=like.${pref}*&limit=1000`, { headers: H });
  if (!r.ok) throw new Error("db " + r.status);
  return r.json();
}

/* lee el cfg armado. Si todavía está en la fila única vieja, primero lo respalda y lo reparte (una sola vez). */
export async function leerCfg(ctx) {
  const { leer } = ctx;
  const ix = await leer(ctx.H, "cfgx");
  if (!ix || !ix.orden) return ctx.escribir ? migrar(ctx) : leer(ctx.H, "cfg");
  const rows = await filasPrefijo(ctx.URL_BASE, ctx.H, "cfgo_");
  const filas = {}; rows.forEach((x) => { const id = String(x.clave).slice(5); if (x.valor && typeof x.valor.s === "string") filas[id] = x.valor; });
  return { t: Number(ix.t) || 0, v: armar(ix, filas), _ix: ix, _filas: filas };
}

/* solo la hora (consulta liviana de cada 4 s) */
export async function horaCfg(ctx) {
  const ix = await ctx.leer(ctx.H, "cfgx");
  if (ix && ix.orden) return Number(ix.t) || 0;
  const v = await ctx.leer(ctx.H, "cfg"); return v ? Number(v.t) || 0 : 0;
}

async function migrar(ctx) {
  const { leer, escribir, H } = ctx;
  const cur = await leer(H, "cfg");
  if (!cur || typeof cur.v !== "string") return cur && cur.v === undefined ? null : cur;
  // 1 · respaldo completo antes de tocar nada (no lo borra la limpieza de 30 días)
  const sello = new Date(Date.now() - 108e5).toISOString().slice(0, 10).replace(/-/g, "");
  // si ya quedó un respaldo idéntico de un intento anterior se usa ese (y los demás repetidos se borran al terminar)
  let kb = "bk_cfg_premigracion_" + sello, previos = [];
  try { const r = await fetch(`${ctx.URL_BASE}/rest/v1/nexo2_estado?select=clave&clave=like.bk_cfg_premigracion_*&order=clave.asc`, { headers: H }); if (r.ok) previos = (await r.json()).map((x) => x.clave); } catch {}
  for (const k of previos) { const x = await leer(H, k); if (x && x.cfg && x.cfg.v === cur.v) { kb = k; break; } }
  if (!(await leer(H, kb))) await escribir(H, kb, { t: Date.now(), cfg: cur });
  const chk = await leer(H, kb); if (!chk || !chk.cfg || chk.cfg.v !== cur.v) return cur; // sin respaldo confirmado no se migra
  // 2 · se reparte en filas
  let C; try { C = JSON.parse(cur.v); } catch { return cur; }
  const fix = recuperarCronos(C);
  const t = fix.length ? Math.max(Date.now(), Number(cur.t) + 1) : Number(cur.t) || Date.now();
  const P = partir(C);
  for (const [id, f] of Object.entries(P.filas)) await escribir(H, "cfgo_" + id, { t, k: f.k, s: f.s });
  const ix = { t, orden: P.orden, g: P.g, idsMod: P.idsMod, idsNue: P.idsNue, sueltas: P.sueltas, migrado: Date.now(), respaldo: kb, fix };
  await escribir(H, "cfgx", ix);
  // 3 · se verifica que se lea igual; recién ahí la fila vieja queda marcada como movida
  const vuelta = await leerCfg(ctx);
  const esperado = fix.length ? JSON.stringify(C) : cur.v;
  if (!vuelta || vuelta.v !== esperado) { await fetch(`${ctx.URL_BASE}/rest/v1/nexo2_estado?clave=eq.cfgx`, { method: "DELETE", headers: H }); return cur; }
  await escribir(H, "cfg", { t, movido: "cfgx", respaldo: kb });
  for (const k of previos) if (k !== kb) { const x = await leer(H, k); if (x && x.cfg && x.cfg.v === cur.v) await fetch(`${ctx.URL_BASE}/rest/v1/nexo2_estado?clave=eq.${k}`, { method: "DELETE", headers: H }); }
  return vuelta;
}

/* STO-02 · obras con modelo y "Generar cronograma" (cg) que quedaron con sinCrono por el error del servidor */
function recuperarCronos(C) {
  const out = [];
  const arreglar = (id, e) => { if (e && e.tpl && e.mod2 && e.cg && e.sinCrono === true && !e.baseOv) { e.sinCrono = false; out.push(id); } };
  for (const [id, e] of Object.entries(C.mod || {})) arreglar(id, e);
  for (const e of C.nuevas || []) arreglar(e && e.id, e);
  return out;
}

/* guarda un cfg nuevo (texto). Solo escribe las filas que cambiaron.
   bt = hora de la nube sobre la que trabajó el aparato: si una obra cambió en la nube después de eso, no se pisa (conflicto). */
export async function escribirCfg(ctx, prev, vNuevo, t, bt) {
  const { escribir, H } = ctx;
  const N = JSON.parse(vNuevo), P = partir(N);
  const ixPrev = prev && prev._ix, fPrev = (prev && prev._filas) || {};
  const big = [];
  for (const [id, f] of Object.entries(P.filas)) if (bytes(f.s) > LIM_FILA) big.push(id);
  if (bytes(Object.values(P.g).join("")) > LIM_FILA) big.push("general");
  if (big.length) return { error: "grande", ids: big };
  if (ixPrev && typeof bt === "number" && bt > 0) {
    const choca = [];
    for (const [id, f] of Object.entries(P.filas)) { const a = fPrev[id]; if (a && a.s !== f.s && Number(a.t) > bt) choca.push(id); }
    for (const id of Object.keys(fPrev)) if (!P.filas[id] && Number(fPrev[id].t) > bt) choca.push(id);
    if (gK(ixPrev.g, true) !== gK(P.g, true) && Number(ixPrev.tg || 0) > bt) choca.push("general");
    if (choca.length) return { error: "conflicto", ids: choca };
  }
  const cambiadas = [];
  for (const [id, f] of Object.entries(P.filas)) { const a = fPrev[id]; if (!a || a.s !== f.s || a.k !== f.k) { await escribir(H, "cfgo_" + id, { t, k: f.k, s: f.s }); cambiadas.push(id); } }
  for (const id of Object.keys(fPrev)) if (!P.filas[id]) { await fetch(`${ctx.URL_BASE}/rest/v1/nexo2_estado?clave=eq.cfgo_${id}`, { method: "DELETE", headers: H }); cambiadas.push(id); }
  const gs = gK(P.g, false), gPrev = ixPrev ? gK(ixPrev.g, false) : "";
  const tg = ixPrev && gK(ixPrev.g, true) === gK(P.g, true) ? Number(ixPrev.tg || 0) : t;
  await escribir(H, "cfgx", { ...(ixPrev || {}), t, tg, orden: P.orden, g: P.g, idsMod: P.idsMod, idsNue: P.idsNue, sueltas: P.sueltas });
  return { ok: true, cambiadas, general: gs !== gPrev };
}

/* el cfg dentro de una copia (filas de un bk_): sirve para copias viejas (fila única) y nuevas (repartidas) */
export function cfgDeFilas(filas) {
  const L = filas || [];
  const ix = (L.find((y) => y.clave === "cfgx") || {}).valor;
  if (ix && ix.orden) {
    const f = {}; L.forEach((y) => { if (/^cfgo_/.test(y.clave) && y.valor && typeof y.valor.s === "string") f[y.clave.slice(5)] = y.valor; });
    return { t: Number(ix.t) || 0, v: armar(ix, f) };
  }
  const c = (L.find((y) => y.clave === "cfg") || {}).valor;
  return c && typeof c.v === "string" ? c : null;
}

/* tamaño de la fila más grande (para el aviso interno al 70 %) */
export function tamanos(cfg) {
  if (!cfg) return null;
  const out = { general: bytes(Object.values((cfg._ix && cfg._ix.g) || {}).join("")) };
  Object.entries(cfg._filas || {}).forEach(([id, f]) => { out[id] = bytes(f.s); });
  let max = ["", 0]; Object.entries(out).forEach(([k, v]) => { if (v > max[1]) max = [k, v]; });
  return { max: max[1], fila: max[0], pct: Math.round((max[1] / LIM_FILA) * 100), lim: LIM_FILA };
}
