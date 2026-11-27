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

/* ===================== FIX-01 · guardado por cambios =====================
   El aparato manda solo lo que el usuario cambió: operaciones { p: ruta, v: valor | del: 1, t: hora del cambio, x: acción }.
   Rutas: ["m", id, ...] obras originales · ["n", id, ...] obras nuevas · ["g", clave] datos generales.
   Cada ruta guarda cuándo se escribió (pv). Si otro aparato la cambió después de lo que vio este (b), gana el cambio más reciente y queda anotado.
   sinCrono, cg, tpl y mod2 solo cambian con su acción explícita (Borrar / Generar / Volver a generar / Cambiar modelo / Restaurar). */
export const CRITICAS = ["sinCrono", "cg", "tpl", "mod2"];
const ACCIONES = ["borrar", "generar", "volver", "modelo", "restaurar", "recuperacion", "nueva"];
const RK = (p) => p.join("\u0001");
const esObj = (x) => x && typeof x === "object" && !Array.isArray(x);
function ponerEn(obj, ruta, v, borrar) {
  let o = obj; for (let i = 0; i < ruta.length - 1; i++) { const k = ruta[i]; if (!esObj(o[k])) { if (borrar) return; o[k] = {}; } o = o[k]; }
  const k = ruta[ruta.length - 1]; if (borrar) delete o[k]; else o[k] = v;
}
const leerEn = (obj, ruta) => { let o = obj; for (const k of ruta) { if (!esObj(o) && !Array.isArray(o)) return undefined; o = o[k]; if (o === undefined) return undefined; } return o; };
/* resumen corto de un valor para el registro (la base completa no entra: se anota cuántas tareas y una huella) */
function resumen(k, v) {
  if (v === undefined) return "(sin valor)";
  if (k === "baseOv" || k === "base") { if (!Array.isArray(v)) return "(sin base)"; let h = 5381; const q = JSON.stringify(v); for (let i = 0; i < q.length; i++) h = ((h << 5) + h + q.charCodeAt(i)) | 0; return v.length + " tareas · huella " + (h >>> 0).toString(36); }
  if (k === "cg" || k === "cgu") return Number(v) ? new Date(Number(v)).toISOString() : String(v);
  const s = JSON.stringify(v); return s.length > 160 ? s.slice(0, 157) + "…" : s;
}
/* aplica las operaciones sobre la nube actual (prev = leerCfg) y escribe solo las filas que cambian.
   Devuelve { ok, t, aplicadas, rech, ign, reg } — reg son las entradas para el registro. */
export async function aplicarOps(ctx, prev, ops, opt) {
  const { escribir, H } = ctx; opt = opt || {};
  const now = Math.max(Date.now(), (prev && Number(prev.t) || 0) + 1);
  const base = Number(opt.b) || 0, desfase = Number(opt.offset) || 0;
  const ix = (prev && prev._ix) ? JSON.parse(JSON.stringify(prev._ix)) : { orden: ["mod", "nuevas"], g: {}, idsMod: [], idsNue: [], sueltas: [] };
  if (!ix.idsMod) ix.idsMod = []; if (!ix.idsNue) ix.idsNue = []; if (!ix.orden.includes("mod")) ix.orden.unshift("mod"); if (!ix.orden.includes("nuevas")) ix.orden.splice(1, 0, "nuevas");
  ix.pv = ix.pv || {};
  const filas = {}; for (const [id, f] of Object.entries((prev && prev._filas) || {})) filas[id] = { ...f };
  const entradas = {}, tocadas = new Set(), rech = [], ign = [], reg = [], aplicadas = [];
  const entrada = (id) => { if (!(id in entradas)) { const f = filas[id]; entradas[id] = f ? JSON.parse(f.s) : undefined; } return entradas[id]; };
  let gCambio = false;
  for (const op of (Array.isArray(ops) ? ops : []).slice(0, 5000)) {
    const p = Array.isArray(op && op.p) ? op.p.map(String) : null; if (!p || p.length < 2 || p.length > 8) continue;
    const t = Math.min(now, (Number(op.t) || now) + desfase); // hora del cambio, llevada al reloj del servidor
    const kind = p[0];
    if (kind === "g") {
      const k = p[1]; if (!["plant", "fu", "del", "delN", "avisos"].includes(k)) continue;
      const cur = ix.g[k] !== undefined ? JSON.parse(ix.g[k]) : undefined;
      let nv;
      if (k === "avisos") { const m = new Map(); [...(cur || []), ...(Array.isArray(op.v) ? op.v : [])].forEach((x) => { if (x && x.id) m.set(x.id, x); }); nv = [...m.values()].filter((x) => now - Number(x.t || 0) < 14 * 864e5).sort((x, y) => (Number(x.t || 0) - Number(y.t || 0)) || String(x.id).localeCompare(String(y.id))).slice(-40); }
      else if (k === "del" || k === "delN") { nv = [...new Set([...(cur || []), ...(Array.isArray(op.v) ? op.v : [])])].slice(-300); if (JSON.stringify(nv) !== JSON.stringify(cur || [])) reg.push({ obra: "general", campos: [k], antes: resumen(k, cur), despues: resumen(k, nv), res: "ok", tipo: "borrado" }); }
      else { const pv = ix.pv[RK(p)]; if (pv && pv.s > base && pv.t > t) { rech.push({ p, motivo: "más nuevo en la nube" }); reg.push({ obra: "general", campos: [k], res: "rechazado", motivo: "en la nube hay un cambio más reciente" }); continue; } nv = op.del ? undefined : op.v; ix.pv[RK(p)] = { t, s: now }; }
      if (Array.isArray(nv) && !nv.length && cur === undefined) nv = undefined; // una lista vacía no se crea (el aparato no la tiene)
      const s2 = nv === undefined ? undefined : JSON.stringify(nv);
      if (s2 !== ix.g[k]) { if (s2 === undefined) { delete ix.g[k]; ix.orden = ix.orden.filter((z) => z !== k); } else { if (!ix.orden.includes(k)) ix.orden.push(k); ix.g[k] = s2; } gCambio = true; aplicadas.push(p); }
      continue;
    }
    if (kind !== "m" && kind !== "n") continue;
    const id = p[1]; if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) continue;
    const resto = p.slice(2), k0 = resto[0];
    let e = entrada(id);
    // obra que no existe en la nube: se crea entera (es una obra nueva o una obra original con su primer cambio)
    if (e === undefined) {
      if (op.del) continue;
      if (resto.length) { e = entradas[id] = {}; }
      else { entradas[id] = JSON.parse(JSON.stringify(op.v || {})); filas[id] = { t: now, k: kind, s: "{}", pv: {} }; filas[id].pv[RK(p)] = { t, s: now }; tocadas.add(id); if (kind === "m") { if (!ix.idsMod.includes(id)) ix.idsMod.push(id); } else if (!ix.idsNue.includes(id)) ix.idsNue.push(id); aplicadas.push(p); reg.push({ obra: id, campos: ["(obra completa)"], res: "ok", tipo: "alta" }); continue; }
      filas[id] = { t: now, k: kind, s: "{}", pv: {} }; if (kind === "m") { if (!ix.idsMod.includes(id)) ix.idsMod.push(id); } else if (!ix.idsNue.includes(id)) ix.idsNue.push(id);
    }
    // obra entera mandada sobre una que ya existe: se toma campo por campo
    const sub = resto.length ? [{ r: resto, v: op.v, del: op.del }] : (op.del ? Object.keys(e).map((k) => ({ r: [k], del: 1 })) : Object.keys(op.v || {}).map((k) => ({ r: [k], v: op.v[k] })));
    for (const z of sub) {
      const k = z.r[0], ruta = [kind, id, ...z.r], rk = RK(ruta);
      if (CRITICAS.includes(k) && !(ACCIONES.includes(op.x))) { ign.push({ p: ruta, motivo: "solo con su botón" }); reg.push({ obra: id, campos: [z.r.join(".")], res: "ignorado", motivo: "marca crítica sin acción explícita", antes: resumen(k, e[k]), despues: resumen(k, z.del ? undefined : z.v) }); continue; }
      const pv = filas[id].pv || (filas[id].pv = {});
      // ¿la cambió otro aparato después de lo que vio este? (la misma ruta, una más general o una más particular)
      let otro = null; for (const [q, w] of Object.entries(pv)) { if (w.s > base && (q === rk || rk.startsWith(q + "\u0001") || q.startsWith(rk + "\u0001")) && (!otro || w.t > otro.t)) otro = w; }
      if (otro && otro.t > t) { rech.push({ p: ruta, motivo: "más nuevo en la nube", actual: leerEn(e, z.r) }); reg.push({ obra: id, campos: [z.r.join(".")], res: "rechazado", motivo: "otro aparato lo cambió después" }); continue; }
      const antes = leerEn(e, z.r);
      if (JSON.stringify(antes) === JSON.stringify(z.del ? undefined : z.v)) continue;
      ponerEn(e, z.r, z.v === undefined ? undefined : JSON.parse(JSON.stringify(z.v)), !!z.del || z.v === undefined);
      for (const q of Object.keys(pv)) if (q.startsWith(rk + "\u0001")) delete pv[q];
      pv[rk] = { t, s: now }; tocadas.add(id); aplicadas.push(ruta);
      const crit = CRITICAS.includes(k) || k === "baseOv" || z.del;
      const casa = k === "ovt" || k === "cgu"; // sellos de hora internos: no cuentan como conflicto
      reg.push({ obra: id, campos: [z.r.join(".")], res: otro && !casa ? "conflicto" : "ok", ...(otro && !casa ? { motivo: "dos aparatos cambiaron lo mismo: quedó el más reciente" } : {}), ...(crit ? { antes: resumen(k, antes), despues: resumen(k, z.del ? undefined : z.v), accion: op.x || "" } : {}) });
    }
  }
  for (const id of tocadas) { const s = JSON.stringify(entradas[id]); if (Buffer.byteLength(s) > LIM_FILA) return { error: "grande", ids: [id] }; }
  for (const id of tocadas) { const f = filas[id]; await escribir(H, "cfgo_" + id, { t: now, k: f.k, s: JSON.stringify(entradas[id]), pv: f.pv || {} }); }
  if (tocadas.size || gCambio || !prev || !prev._ix) { ix.t = now; if (gCambio) ix.tg = now; await escribir(H, "cfgx", ix); }
  return { ok: true, t: (tocadas.size || gCambio) ? now : Number(prev && prev.t) || now, aplicadas, rech, ign, reg };
}
