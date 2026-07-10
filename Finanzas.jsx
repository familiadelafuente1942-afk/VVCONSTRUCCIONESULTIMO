import React, { useState, useEffect, useRef } from "react";
// VERSION: v86 (IA: boton logo = microfono para hablar, saco mic de la barra)

// V+V FINANZAS — Presupuesto simple (m² × precio) · Costo dividido en rubros (contratistas)
// 4 solapas: Presupuesto · Cert.Costo · Cert.Cliente · Resultado(PIN)
// Certificación por % de avance de cada rubro. Incidencia = costo del rubro / costo total.
// Redeterminación CAC por índices. Conformidad con firma dibujada. PDF con membrete.

const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const SH = () => ({ "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY });
const storage = {
  set: async (key, value) => { try { localStorage.setItem(key, value); } catch { } try { await fetch(SUPA_URL + "/rest/v1/bco_storage", { method: "POST", headers: { ...SH(), "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ key, value }) }); } catch { } return { value }; },
  get: async (key) => { try { const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", { method: "GET", headers: SH(), mode: "cors" }); if (r.ok) { const d = await r.json(); if (d && d.length > 0) return { value: d[0].value }; } } catch { } try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; } },
};
const uid = () => Math.random().toString(36).slice(2, 9);
async function subirArchivo(file) {
  try {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `finanzas/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const r = await fetch(`${SUPA_URL}/storage/v1/object/bco-media/${path}`, { method: "POST", headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" }, body: file });
    if (r.ok) return `${SUPA_URL}/storage/v1/object/public/bco-media/${path}`;
  } catch { }
  return "";
}
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fmtISO = (iso) => { if (!iso) return "—"; const [y, m, d] = String(iso).split("-"); return d && m && y ? `${d}/${m}/${y}` : iso; };
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };
const money = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
const fmtMiles = (v) => { const s = String(v == null ? "" : v).replace(/\D/g, ""); return s ? Number(s).toLocaleString("es-AR") : ""; };
const numMoney = (v) => { const s = String(v == null ? "" : v).replace(/\./g, "").replace(/[^\d]/g, ""); return s ? Number(s) : 0; };
const diasEntre = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
const BRASS = "#B0894F";
const T_LIGHT = { navy: "#0B1622", accent: "#1B3A5B", al: "#EEF2F7", bg: "#F5F5F7", card: "#FFFFFF", border: "#E8EAED", text: "#0B1622", sub: "#5B6673", muted: "#98A2B0", ok: "#16A34A", warn: "#B45309", rsm: 12, inpBg: "#FBFBFD", navBar: "rgba(255,255,255,.86)", dark: false };
const T_DARK = { navy: "#05070B", accent: "#7FB0EA", al: "#1B222C", bg: "#0C0F14", card: "#161B22", border: "#2A313C", text: "#EEF1F5", sub: "#AEB6C2", muted: "#6C7683", ok: "#3DDC84", warn: "#F5B44C", rsm: 12, inpBg: "#0F141B", navBar: "rgba(18,22,29,.86)", dark: true };
let T = T_LIGHT;
const buildInp = (t) => ({ width: "100%", background: t.inpBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 13px", fontSize: 16, color: t.text, boxSizing: "border-box", marginTop: 6, outline: "none", fontVariantNumeric: "tabular-nums" });
const buildInpSm = (t) => ({ background: t.inpBg, border: `1px solid ${t.border}`, borderRadius: 9, padding: "10px 8px", fontSize: 15, color: t.text, boxSizing: "border-box", outline: "none" });
let inp = buildInp(T), inpSm = buildInpSm(T);
const FUENTES = [["", "Inter", "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif"], ["sistema", "Sistema", "-apple-system,system-ui,'Segoe UI',Roboto,sans-serif"], ["serif", "Serif clásica", "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif"], ["redonda", "Redondeada", "'SF Pro Rounded','Varela Round',ui-rounded,system-ui,sans-serif"], ["elegante", "Elegante", "'Optima','Avenir Next',Avenir,system-ui,sans-serif"], ["mono", "Mono", "'SF Mono','JetBrains Mono',ui-monospace,Menlo,monospace"]];
const fuenteDe = (cfg) => (FUENTES.find(x => x[0] === (cfg?.fuente || "")) || FUENTES[0])[2];
const FONDOS_DARK = [["", "Negro", "#0C0F14"], ["carbon", "Carbón", "linear-gradient(160deg,#141A22,#05070B)"], ["navy", "Navy", "linear-gradient(160deg,#0E1728,#06090F)"], ["vino", "Vino", "linear-gradient(160deg,#1C1016,#0A0608)"], ["bosque", "Bosque", "linear-gradient(160deg,#0E1613,#050807)"], ["violeta", "Violeta", "linear-gradient(160deg,#16121F,#08060C)"]];
const SHD = "0 1px 2px rgba(11,22,34,.04), 0 8px 24px -8px rgba(11,22,34,.10)";
const SHDsm = "0 1px 2px rgba(11,22,34,.05), 0 2px 8px -4px rgba(11,22,34,.08)";
const RUBROS_DEF = ["Trabajos preliminares", "Movimiento de suelo", "Estructura", "Albañilería", "Revoques", "Contrapiso", "Carpeta", "Colocación"];
const CAT_GASTO = ["Viáticos", "Combustible", "Fletes", "Comida en obra", "Herramientas", "Alquiler equipos", "Operación de obra", "Otro"];
const IMPREV_CATS = ["Seguro personal", "Multa de obra", "Multa de tránsito", "Otro imprevisto"];
const FONDOS = [
  ["", "Claro", "#F5F5F7"],
  ["perla", "Perla", "linear-gradient(160deg,#FFFFFF,#E7E9EE)"],
  ["calido", "Cálido", "linear-gradient(160deg,#F6E8D2,#E7CFA6)"],
  ["arena", "Arena", "linear-gradient(160deg,#EDE1CB,#D6C29E)"],
  ["durazno", "Durazno", "linear-gradient(160deg,#F9E2D0,#F0C3A5)"],
  ["rosa", "Rosa", "linear-gradient(160deg,#F6E0E8,#E9BFCE)"],
  ["lavanda", "Lavanda", "linear-gradient(160deg,#E8E2F4,#CDC0E6)"],
  ["azul", "Azul", "linear-gradient(160deg,#DCE8F6,#B4CEEC)"],
  ["cielo", "Cielo", "linear-gradient(160deg,#D6EAF3,#AED4E6)"],
  ["menta", "Menta", "linear-gradient(160deg,#D8EFE4,#AEDCC7)"],
  ["salvia", "Salvia", "linear-gradient(160deg,#DFEAE0,#C0D6C6)"],
  ["grafito", "Grafito", "linear-gradient(160deg,#E1E4EA,#C2C8D2)"],
  ["navy", "Navy suave", "linear-gradient(160deg,#DDE3EE,#AAB6CC)"],
  ["dorado", "Dorado", "linear-gradient(160deg,#F3EAD3,#DEC58A)"],
];
function fondoDe(cfg) { const dark = cfg?.modo === "oscuro"; if (cfg?.fondoUrl) { const ov = dark ? "rgba(12,15,20,.82)" : "rgba(245,245,247,.82)"; return `linear-gradient(${ov},${ov}), url("${cfg.fondoUrl}") center/cover fixed no-repeat`; } if (dark) { const f = FONDOS_DARK.find(x => x[0] === (cfg?.fondoDark || "")); return f ? f[2] : "#0C0F14"; } const f = FONDOS.find(x => x[0] === (cfg?.fondo || "")); return f ? f[2] : "#F5F5F7"; }
const esImprev = (cat) => IMPREV_CATS.includes(cat);
function logH(d, accion) { const h = d.historial || []; return { ...d, historial: [...h, { id: Math.random().toString(36).slice(2, 9), accion, t: new Date().toLocaleString("es-AR"), ts: Date.now() }].slice(-250) }; }
const mesDe = (iso) => String(iso || "").slice(0, 7);
const mesLabel = (m) => { if (!m) return "—"; const [y, mm] = m.split("-"); const N = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]; return `${N[Number(mm) - 1] || mm}/${y.slice(2)}`; };
function cacRate(mes, cac) { const p = (cac || {})[mes]; if (p == null || String(p).trim() === "") return { rate: 0, provisorio: true }; return { rate: Math.sqrt(1 + num(p) / 100) - 1, provisorio: false }; }
function addMonthYM(ym, n) { const [y, m] = String(ym).split("-").map(Number); const d = new Date(y, (m - 1) + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function redetReplay(cert, obra, certsDeObra, cac) {
  const base = obra?.mesBase || mesDe(cert?.fecha); const cm = mesDe(cert?.fecha);
  const sorted = (certsDeObra || []).some(c => c.id === cert.id) ? [...(certsDeObra || [])] : [...(certsDeObra || []), cert];
  sorted.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.ts || 0) - (b.ts || 0)));
  let prevAcum = 0, bruto = 0;
  for (const cc of sorted) { const acum = clienteAcumDe(cc.cantidades, obra); if (cc.id === cert.id) { bruto = Math.max(0, acum - prevAcum); break; } prevAcum = acum; }
  const sameMonth = sorted.filter(c => mesDe(c.fecha) === cm);
  const k = Math.max(1, sameMonth.findIndex(c => c.id === cert.id) + 1);
  let factor = 1, provisorio = false, ym = addMonthYM(base, 1);
  while (ym < cm) { const rr = cacRate(ym, cac); if (rr.provisorio) provisorio = true; factor *= (1 + rr.rate); ym = addMonthYM(ym, 1); }
  const rrc = cacRate(cm, cac); if (rrc.provisorio) provisorio = true; factor *= Math.pow(1 + rrc.rate, Math.min(k, 2));
  return { ajuste: bruto * (factor - 1), provisorio, rate: rrc.rate, factor };
}

const lastWrite = { t: 0 };
function useFinanzas() {
  const [data, setData] = useState(() => { try { const l = localStorage.getItem("vv_finanzas"); return l ? JSON.parse(l) : { obras: [], certs: [], indices: {} }; } catch { return { obras: [], certs: [], indices: {} }; } });
  useEffect(() => {
    let alive = true;
    const pull = async () => { try { if (Date.now() - lastWrite.t < 8000) return; const r = await storage.get("vv_finanzas"); if (r?.value && alive) { const d = JSON.parse(r.value); setData(prev => JSON.stringify(d) !== JSON.stringify(prev) ? d : prev); } } catch { } };
    pull(); const iv = setInterval(pull, 5000);
    const onVis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", pull);
    return () => { alive = false; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", pull); };
  }, []);
  const save = (next) => { lastWrite.t = Date.now(); setData(next); try { localStorage.setItem("vv_finanzas", JSON.stringify(next)); } catch { } storage.set("vv_finanzas", JSON.stringify(next)); try { storage.set("vv_finanzas_resumen", resumenFinanciero(next)); } catch { } };
  const refrescar = async () => { try { const r = await storage.get("vv_finanzas"); if (r?.value) { const d = JSON.parse(r.value); try { localStorage.setItem("vv_finanzas", r.value); } catch { } lastWrite.t = 0; setData(d); return true; } } catch { } return false; };
  return [data, save, refrescar];
}

// ── Modelo: obra = { m2, precioCliente, costoM2, rubros:[{id,nombre,pct}] }
//    Rubros = solo % de incidencia (sin monto). El monto lo calcula el certificado.
function presupCliente(o) { return num(o?.m2) * num(o?.precioCliente); }
function quincenasObra(o) { const pm = num(o?.plazoMeses); return pm > 0 ? Math.round(pm * 26 / 12) : 0; }
function anticipoDe(o) { return o?.anticipoTipo === "monto" ? num(o?.anticipoMontoFijo) : presupCliente(o) * num(o?.anticipoPct) / 100; }
function resumenFinanciero(data) {
  const obras = data.obras || [], certs = data.certs || [], cac = data.cacMensual || {};
  const gastos = data.gastos || [], movs = data.movimientos || [], est = data.estructura || {};
  const cuotaQ = (num(est.nObras) > 0 ? num(est.mensual) / num(est.nObras) : 0) / 2;
  const certsDe = (id) => certs.filter(c => c.obraId === id).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.ts || 0) - (b.ts || 0)));
  const L = [`RESUMEN FINANCIERO DE V+V CONSTRUCCIONES (actualizado ${new Date().toLocaleString("es-AR")}). Todos los montos en pesos argentinos. Esta info es PRIVADA de Sebastián.`];
  let tF = 0, tCd = 0, tImp = 0, tImpr = 0, tUtil = 0, tFijo = 0, tGas = 0; const porO = {};
  certs.forEach(c => { const o = obras.find(x => x.id === c.obraId); if (!o) return; const r = calcCert(c, o, certsDe(o.id), cac); const imp = r.extraMontoPeriodo + r.extraPctPeriodo; tF += r.ajustado; tCd += r.costoDirPeriodo; tImp += imp; tImpr += r.imprevPeriodo; tUtil += (r.ajustado - r.costoDirPeriodo); if (!porO[o.id]) porO[o.id] = { o, fact: 0, cd: 0, imp: 0, impr: 0, nCert: 0, amort: 0 }; const p = porO[o.id]; p.fact += r.ajustado; p.cd += r.costoDirPeriodo; p.imp += imp; p.impr += r.imprevPeriodo; p.nCert++; p.amort += r.amort; });
  gastos.forEach(g => { if (!esImprev(g.cat)) tGas += num(g.monto); });
  Object.values(porO).forEach(p => { p.fijo = cuotaQ * p.nCert; tFijo += p.fijo; });
  const tRes = tUtil - tImp - tImpr - tFijo - tGas;
  const cob = movs.filter(m => m.tipo === "cobro").reduce((s, m) => s + num(m.monto), 0);
  const pag = movs.filter(m => m.tipo === "pago").reduce((s, m) => s + num(m.monto), 0);
  const gasTot = gastos.reduce((s, g) => s + num(g.monto), 0);
  const usadoImp = gastos.filter(g => esImprev(g.cat)).reduce((s, g) => s + num(g.monto), 0);
  L.push(`\nTOTALES (todas las obras): Facturado ${money(tF)} | Costo de obra ${money(tCd)} | Utilidad de obra ${money(tUtil)} | Impuestos/IIBB ${money(tImp)} | Imprevistos ${money(tImpr)} | Costo fijo estructura ${money(tFijo)} | Gastos de obra ${money(tGas)} | RESULTADO OPERATIVO ${money(tRes)} (margen ${tF > 0 ? (tRes / tF * 100).toFixed(1) : 0}%).`);
  L.push(`CAJA REAL: cobrado ${money(cob)}, pagado ${money(pag)}, gastos ${money(gasTot)}, saldo en caja ${money(cob - pag - gasTot)}.`);
  L.push(`FONDO DE IMPREVISTOS (5% del presupuesto): acumulado ${money(tImpr)}, usado ${money(usadoImp)}, disponible ${money(tImpr - usadoImp)}.`);
  L.push(`\nDETALLE POR OBRA:`);
  Object.values(porO).forEach(p => { const o = p.o, pc = presupCliente(o), pco = presupCosto(o), ult = certsDe(o.id).slice(-1)[0]; const avance = (pc > 0 && ult) ? clienteAcumDe(ult.cantidades, o) / pc * 100 : 0; const anticipo = anticipoDe(o), dispAnt = anticipo - p.amort, res = (p.fact - p.cd) - p.imp - p.impr - p.fijo; L.push(`· ${o.nombre}: presupuesto cliente ${money(pc)}, presupuesto costo ${money(pco)}, avance ${avance.toFixed(0)}%. Facturado ${money(p.fact)}, costo de obra ${money(p.cd)}, utilidad ${money(p.fact - p.cd)}, resultado ${money(res)}. Anticipo ${money(anticipo)} (disponible ${money(dispAnt)}). Certificados emitidos: ${p.nCert}. Plazo ${num(o.plazoMeses) || "?"} meses (${quincenasObra(o)} certificados quincenales previstos).`); });
  if (!obras.length) L.push("(Todavía no hay obras cargadas.)");
  return L.join("\n");
}
function limpiarTel(t) { return String(t || "").replace(/[^\d]/g, ""); }
function dedupeContactos(arr) { const seen = new Set(); return (arr || []).filter(c => { const k = (c.tipo || "") + "|" + String(c.nombre || "").trim().toLowerCase() + "|" + limpiarTel(c.telefono || ""); if (seen.has(k)) return false; seen.add(k); return true; }); }
function waLink(tel, texto) { return `https://wa.me/${limpiarTel(tel)}?text=${encodeURIComponent(texto)}`; }
function resumenSocioTexto(data) { return `*Resumen financiero — V+V Construcciones*\n\n${resumenFinanciero(data)}`; }
function reporteSociedadParcial(s, socio) {
  const presIni = num(s.presupuestoInicial != null ? s.presupuestoInicial : s.presupuesto);
  const adic = s.adicionales || [], gastos = s.gastos || [], cobros = s.cobros || [], retiros = s.retiros || s.pagos || [], lsoc = s.socios || [], media = s.adjuntos || [];
  const adicTot = adic.reduce((a, x) => a + num(x.monto), 0); const presTotal = presIni + adicTot;
  const costoReal = gastos.reduce((a, x) => a + num(x.monto), 0); const imprevTot = gastos.filter(g => g.tipo === "imprevisto").reduce((a, x) => a + num(x.monto), 0);
  const cobrado = cobros.reduce((a, x) => a + num(x.monto), 0); const restaCobrar = presTotal - cobrado;
  const util = presTotal - costoReal; const retTot = retiros.reduce((a, x) => a + num(x.monto), 0); const rest = util - retTot;
  const L = [`*${s.nombre} — Resultado parcial*`];
  if (s.descripcion) L.push(`_${s.descripcion}_`);
  L.push("");
  L.push(`*Presupuesto:* ${money(presTotal)}` + (adicTot ? ` (inicial ${money(presIni)} + adicionales ${money(adicTot)})` : ""));
  L.push(`*Cobrado:* ${money(cobrado)}  ·  *Resta a cobrar:* ${money(restaCobrar)}`);
  L.push(`*Costo real:* ${money(costoReal)}` + (imprevTot ? ` (imprevistos ${money(imprevTot)})` : ""));
  L.push(`*Utilidad:* ${money(util)}` + (presTotal > 0 ? ` (${(util / presTotal * 100).toFixed(0)}%)` : ""));
  L.push(`*Utilidad por distribuir:* ${money(rest)}`);
  if (adic.length) { L.push("", "*Adicionales:*"); adic.forEach(a => L.push(`• ${a.texto || "Adicional"}: ${money(num(a.monto))}`)); }
  if (imprevTot > 0) { L.push("", "*Imprevistos:*"); gastos.filter(g => g.tipo === "imprevisto").forEach(g => L.push(`• ${g.texto || "Imprevisto"}: ${money(num(g.monto))}`)); }
  if (lsoc.length) { L.push("", "*Reparto por socio:*"); lsoc.forEach(so => { const corr = util * num(so.pct) / 100; const rs = retiros.filter(r => r.socioId === so.id).reduce((a, r) => a + num(r.monto), 0); L.push(`• ${so.nombre} (${num(so.pct)}%): le corresponde ${money(corr)}, retiró ${money(rs)}, le queda ${money(corr - rs)}`); }); }
  if (socio) { const corr = util * num(socio.pct) / 100; const rs = retiros.filter(r => r.socioId === socio.id).reduce((a, r) => a + num(r.monto), 0); L.push("", `*${socio.nombre}, tu parte:* te corresponde ${money(corr)}, retiraste ${money(rs)}, te queda ${money(corr - rs)}.`); }
  if (media.length) { L.push("", "*Fotos y videos de la obra:*"); media.forEach(m => L.push(`${m.tipo === "video" ? "🎥" : "📷"} ${m.url}`)); }
  return L.join("\n");
}
function descargarArchivo(nombre, contenido, tipo) {
  try { const blob = new Blob([contenido], { type: tipo }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); setTimeout(() => { try { document.body.removeChild(a); } catch { } URL.revokeObjectURL(url); }, 1200); } catch (e) { alert("No se pudo descargar: " + (e && e.message)); }
}
function csvDe(data) {
  const rows = []; const R = (...a) => rows.push(a.map(v => { const s = String(v == null ? "" : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(";")); const M = (n) => Math.round(num(n) || 0);
  R("V+V CONSTRUCCIONES - RESPALDO", new Date().toLocaleString("es-AR")); R("");
  R("OBRAS DE CLIENTE"); R("Nombre", "m2", "Precio cli/m2", "Costo/m2", "Presup cliente", "Presup costo", "Plazo(m)", "Mes base");
  (data.obras || []).forEach(o => R(o.nombre, o.m2, o.precioCliente, o.costoM2, M(num(o.m2) * num(o.precioCliente)), M(num(o.m2) * num(o.costoM2)), o.plazoMeses, o.mesBase)); R("");
  R("CERTIFICADOS (cliente)"); R("Obra", "Fecha", "Rubro", "% acumulado");
  (data.certs || []).forEach(c => { const o = (data.obras || []).find(x => x.id === c.obraId); Object.entries(c.cantidades || {}).forEach(([rid, p]) => { const rb = (o && o.rubros || []).find(r => r.id === rid); R(o ? o.nombre : "", c.fecha, rb ? rb.nombre : rid, p); }); }); R("");
  R("MOVIMIENTOS DE CAJA"); R("Tipo", "Obra", "Monto", "Fecha", "Nota");
  (data.movimientos || []).forEach(m => { const o = (data.obras || []).find(x => x.id === m.obraId); R(m.tipo, o ? o.nombre : "General", M(m.monto), m.fecha, m.nota || ""); }); R("");
  R("GASTOS"); R("Categoria", "Obra", "Monto", "Fecha", "Nota");
  (data.gastos || []).forEach(g => { const o = (data.obras || []).find(x => x.id === g.obraId); R(g.cat, o ? o.nombre : "General", M(g.monto), g.fecha, g.nota || ""); }); R("");
  R("OBRAS EN SOCIEDAD"); R("Obra", "Presup inicial", "Costo estimado", "Adicionales", "Costo real", "Cobrado", "Utilidad");
  (data.sociedad || []).forEach(s => { const pi = num(s.presupuestoInicial != null ? s.presupuestoInicial : s.presupuesto); const ad = (s.adicionales || []).reduce((a, x) => a + num(x.monto), 0); const cr = (s.gastos || []).reduce((a, x) => a + num(x.monto), 0); const cob = (s.cobros || []).reduce((a, x) => a + num(x.monto), 0); R(s.nombre, M(pi), M(s.costoEstimado), M(ad), M(cr), M(cob), M(pi + ad - cr)); });
  (data.sociedad || []).forEach(s => { R(""); R("Detalle " + s.nombre); (s.adicionales || []).forEach(a => R("Adicional", a.texto, M(a.monto), a.fecha)); (s.gastos || []).forEach(g => R("Gasto", g.texto, g.tipo, M(g.monto), g.fecha)); (s.cobros || []).forEach(c => R("Cobro", c.texto, M(c.monto), c.fecha)); (s.socios || []).forEach(so => R("Socio", so.nombre, num(so.pct) + "%", so.tel)); (s.retiros || []).forEach(r => { const so = (s.socios || []).find(x => x.id === r.socioId); R("Retiro", so ? so.nombre : r.texto, M(r.monto), r.fecha); }); }); R("");
  R("OBRAS PARTICULARES"); R("Obra", "Rubro", "US$", "$", "Cotiz", "Nota");
  (data.propias || []).forEach(p => { (p.costos || []).forEach(c => R(p.nombre, c.cat, M(c.montoUsd), M(c.montoArs), c.cotiz, c.nota || "")); R(p.nombre, "VENTA ESTIMADA", M(p.ventaUsd), M(p.ventaArs)); }); R("");
  R("EDIFICIOS"); R("Edificio", "Tipo", "Detalle", "US$", "$", "Estado");
  (data.edificios || []).forEach(e => { (e.unidades || []).forEach(u => R(e.nombre, "Unidad", u.nombre, M(u.precioUsd), M(u.precioArs), u.estado)); (e.costos || []).forEach(c => R(e.nombre, "Costo", c.cat, M(c.montoUsd), M(c.montoArs))); });
  return "\uFEFF" + rows.join("\n");
}
function svgTortaHTML(titulo, items, PAL) {
  const its = (items || []).filter(x => Math.max(0, x.value) > 0); if (!its.length) return "";
  const total = its.reduce((a, x) => a + Math.max(0, x.value), 0), r = 55, C = 2 * Math.PI * r; let acc = 0;
  const segs = its.map((it, i) => { const col = it.color || PAL[i % PAL.length]; const len = Math.max(0, it.value) / total * C; const el = `<circle cx="75" cy="75" r="${r}" fill="none" stroke="${col}" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}"/>`; acc += len; return el; }).join("");
  const leg = its.map((it, i) => { const col = it.color || PAL[i % PAL.length]; const vl = it.valueLabel != null ? it.valueLabel : "$" + Math.round(it.value).toLocaleString("es-AR"); return `<div class="leg"><span class="dot" style="background:${col}"></span>${it.label}<span class="lv">${vl}</span></div>`; }).join("");
  return `<h2>${titulo}</h2><div class="chart"><svg width="150" height="150" viewBox="0 0 150 150"><g transform="rotate(-90 75 75)"><circle cx="75" cy="75" r="${r}" fill="none" stroke="#EEF0F3" stroke-width="22"/>${segs}</g></svg><div class="legs">${leg}</div></div>`;
}
function svgBarrasHTML(titulo, items, PAL) {
  const its = (items || []).filter(x => Math.abs(x.value) > 0); if (!its.length) return "";
  const max = Math.max(1, ...its.map(i => Math.abs(i.value)));
  const rows = its.map((it, i) => { const col = it.color || PAL[i % PAL.length]; const w = Math.abs(it.value) / max * 100; const vl = it.valueLabel != null ? it.valueLabel : "$" + Math.round(it.value).toLocaleString("es-AR"); return `<div class="brow"><div class="blab"><span>${it.label}</span><b>${vl}</b></div><div class="btrack"><div class="bfill" style="width:${w}%;background:${col}"></div></div></div>`; }).join("");
  return `<h2>${titulo}</h2>${rows}`;
}
function cargarXLSX() { return new Promise((res, rej) => { if (typeof window !== "undefined" && window.XLSX) return res(window.XLSX); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error("no se pudo cargar la librería")); document.head.appendChild(s); }); }
async function exportarExcel(data) {
  const M = (n) => Math.round(num(n) || 0);
  try {
    const XLSX = await cargarXLSX(); const wb = XLSX.utils.book_new();
    const add = (nombre, aoa, cols) => { const ws = XLSX.utils.aoa_to_sheet(aoa); if (cols) ws["!cols"] = cols.map(w => ({ wch: w })); ws["!freeze"] = { xSplit: 0, ySplit: 1 }; XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31)); };
    const obras = data.obras || []; const nom = (id) => { const o = obras.find(x => x.id === id); return o ? o.nombre : "General"; };
    const rSoc = (data.sociedad || []).reduce((a, s) => { const pi = num(s.presupuestoInicial != null ? s.presupuestoInicial : s.presupuesto); const ad = (s.adicionales || []).reduce((x, y) => x + num(y.monto), 0); const cr = (s.gastos || []).reduce((x, y) => x + num(y.monto), 0); return a + (pi + ad - cr); }, 0);
    const rProp = (data.propias || []).reduce((a, p) => a + (num(p.ventaArs) - (p.costos || []).reduce((x, y) => x + num(y.montoArs), 0)), 0);
    const rEdif = (data.edificios || []).reduce((a, e) => { const inv = (e.costos || []).reduce((x, y) => x + num(y.montoArs), 0); const vta = (e.unidades || []).reduce((x, y) => x + num(y.precioArs), 0); return a + (vta - inv); }, 0);
    add("Resumen", [["V+V CONSTRUCCIONES"], ["Respaldo generado", new Date().toLocaleString("es-AR")], [], ["Modelo", "Resultado $"], ["Obras en sociedad", rSoc], ["Obras particulares", rProp], ["Edificios", rEdif]], [26, 18]);
    add("Obras cliente", [["Nombre", "m2", "Precio cli/m2", "Costo/m2", "Presup cliente", "Presup costo", "Plazo(m)", "Mes base"], ...obras.map(o => [o.nombre, num(o.m2), num(o.precioCliente), num(o.costoM2), M(num(o.m2) * num(o.precioCliente)), M(num(o.m2) * num(o.costoM2)), num(o.plazoMeses), o.mesBase || ""])], [24, 8, 14, 14, 16, 16, 9, 10]);
    const cert = [["Obra", "Fecha", "Rubro", "% acumulado"]]; (data.certs || []).forEach(c => { const o = obras.find(x => x.id === c.obraId); Object.entries(c.cantidades || {}).forEach(([rid, p]) => { const rb = (o && o.rubros || []).find(r => r.id === rid); cert.push([o ? o.nombre : "", c.fecha, rb ? rb.nombre : rid, num(p)]); }); }); add("Certificados", cert, [24, 12, 22, 12]);
    add("Movimientos", [["Tipo", "Obra", "Monto", "Fecha", "Nota"], ...(data.movimientos || []).map(m => [m.tipo, nom(m.obraId), M(m.monto), m.fecha, m.nota || ""])], [10, 22, 14, 12, 26]);
    add("Gastos", [["Categoria", "Obra", "Monto", "Fecha", "Nota"], ...(data.gastos || []).map(g => [g.cat, nom(g.obraId), M(g.monto), g.fecha, g.nota || ""])], [18, 22, 14, 12, 26]);
    add("Sociedad", [["Obra", "Presup inicial", "Costo estimado", "Adicionales", "Costo real", "Cobrado", "Utilidad", "Retiros"], ...(data.sociedad || []).map(s => { const pi = num(s.presupuestoInicial != null ? s.presupuestoInicial : s.presupuesto); const ad = (s.adicionales || []).reduce((a, x) => a + num(x.monto), 0); const cr = (s.gastos || []).reduce((a, x) => a + num(x.monto), 0); const cob = (s.cobros || []).reduce((a, x) => a + num(x.monto), 0); const ret = (s.retiros || s.pagos || []).reduce((a, x) => a + num(x.monto), 0); return [s.nombre, M(pi), M(s.costoEstimado), M(ad), M(cr), M(cob), M(pi + ad - cr), M(ret)]; })], [22, 16, 16, 14, 14, 14, 14, 14]);
    const det = [["Obra", "Tipo", "Detalle", "Monto", "Fecha"]]; (data.sociedad || []).forEach(s => { (s.adicionales || []).forEach(a => det.push([s.nombre, "Adicional", a.texto || "", M(a.monto), a.fecha || ""])); (s.gastos || []).forEach(g => det.push([s.nombre, "Gasto " + (g.tipo || ""), g.texto || "", M(g.monto), g.fecha || ""])); (s.cobros || []).forEach(c => det.push([s.nombre, "Cobro", c.texto || "", M(c.monto), c.fecha || ""])); (s.socios || []).forEach(so => det.push([s.nombre, "Socio", so.nombre + " (" + num(so.pct) + "%)", so.tel || "", ""])); (s.retiros || []).forEach(r => { const so = (s.socios || []).find(x => x.id === r.socioId); det.push([s.nombre, "Retiro", so ? so.nombre : (r.texto || ""), M(r.monto), r.fecha || ""]); }); }); add("Sociedad detalle", det, [22, 16, 26, 14, 12]);
    const prop = [["Obra", "Rubro", "US$", "$", "Cotiz", "Nota"]]; (data.propias || []).forEach(p => { (p.costos || []).forEach(c => prop.push([p.nombre, c.cat, M(c.montoUsd), M(c.montoArs), num(c.cotiz), c.nota || ""])); prop.push([p.nombre, "VENTA ESTIMADA", M(p.ventaUsd), M(p.ventaArs), "", ""]); }); add("Particulares", prop, [22, 28, 14, 14, 10, 24]);
    const ed = [["Edificio", "Tipo", "Detalle", "US$", "$", "Estado"]]; (data.edificios || []).forEach(e => { (e.unidades || []).forEach(u => ed.push([e.nombre, "Unidad", u.nombre, M(u.precioUsd), M(u.precioArs), u.estado || ""])); (e.costos || []).forEach(c => ed.push([e.nombre, "Costo", c.cat, M(c.montoUsd), M(c.montoArs), ""])); }); add("Edificios", ed, [22, 10, 28, 14, 14, 12]);
    add("Presupuestos", [["Nombre", "Cliente", "Monto", "Estado", "Fecha", "Motivo"], ...(data.presupuestosSoc || []).map(p => [p.nombre, p.cliente || "", M(p.monto), (EST_PRES.find(e => e[0] === p.estado) || ["", p.estado])[1], p.fechaLimite || "", p.motivo || ""])], [24, 18, 14, 14, 12, 26]);
    XLSX.writeFile(wb, `VV-Finanzas-${hoyISO()}.xlsx`);
  } catch (e) { alert("No pude generar el Excel (" + (e && e.message) + "). Te bajo el CSV como alternativa."); descargarArchivo(`VV-Finanzas-${hoyISO()}.csv`, csvDe(data), "text/csv;charset=utf-8"); }
}
function reporteHTML(titulo, subtitulo, secciones, media, cfg, graficos) {
  const marca = (cfg && cfg.nombre) || "V+V Construcciones";
  const PAL = ["#1B3A5B", "#B0894F", "#16A34A", "#C2410C", "#7C3AED", "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#4F46E5", "#0D9488", "#9333EA", "#CA8A04", "#DC2626"];
  const filasHTML = secciones.map(sec => `<h2>${sec.titulo}</h2><table>${sec.filas.map(f => `<tr><td>${f.label}</td><td class="v${f.strong ? ' s' : ''}">${f.value}</td></tr>`).join("")}</table>`).join("");
  const grafHTML = (graficos || []).map(g => g.tipo === "torta" ? svgTortaHTML(g.titulo, g.items, PAL) : svgBarrasHTML(g.titulo, g.items, PAL)).join("");
  const fotos = (media || []).filter(m => m.tipo !== "video");
  const vids = (media || []).filter(m => m.tipo === "video");
  const fotosHTML = fotos.length ? `<h2>Fotos</h2><div class="fotos">${fotos.map(m => `<img src="${m.url}"/>`).join("")}</div>` : "";
  const vidsHTML = vids.length ? `<h2>Videos</h2>${vids.map(m => `<div class="lnk">🎥 <a href="${m.url}">${m.url}</a></div>`).join("")}` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#0B1622;margin:0;padding:26px 24px;font-size:13px}.head{border-bottom:2px solid #B0894F;padding-bottom:12px;margin-bottom:14px}.marca{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#B0894F;font-weight:700}h1{font-size:20px;margin:4px 0 2px}.sub{color:#5B6673;font-size:12px}h2{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#5B6673;margin:16px 0 5px;border-bottom:1px solid #E8EAED;padding-bottom:4px}table{width:100%;border-collapse:collapse}td{padding:5px 0;border-bottom:1px solid #F0F1F3}td.v{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}td.v.s{font-weight:800;font-size:15px;color:#16A34A}.chart{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:6px 0 12px}.legs{flex:1;min-width:170px}.leg{display:flex;align-items:center;font-size:12px;margin:3px 0}.leg .dot{width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:7px}.leg .lv{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums;padding-left:8px}.brow{margin:7px 0}.blab{display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px}.blab b{font-variant-numeric:tabular-nums}.btrack{height:9px;background:#EEF0F3;border-radius:5px;overflow:hidden}.bfill{height:100%;border-radius:5px}.fotos{display:flex;flex-wrap:wrap;gap:8px}.fotos img{width:31%;height:118px;object-fit:cover;border-radius:8px}.lnk{font-size:11px;margin:3px 0;word-break:break-all}.foot{margin-top:20px;color:#98A2B0;font-size:10px;text-align:center}@media print{.fotos img{width:31%}.chart,.brow{page-break-inside:avoid}}</style></head><body><div class="head"><div class="marca">${marca}</div><h1>${titulo}</h1>${subtitulo ? `<div class="sub">${subtitulo}</div>` : ""}<div class="sub">${new Date().toLocaleDateString("es-AR")}</div></div>${filasHTML}${grafHTML}${fotosHTML}${vidsHTML}<div class="foot">Generado con V+V Finanzas · documento informativo</div></body></html>`;
}
function seccionesSociedad(s) {
  const presIni = num(s.presupuestoInicial != null ? s.presupuestoInicial : s.presupuesto);
  const adic = s.adicionales || [], gastos = s.gastos || [], cobros = s.cobros || [], retiros = s.retiros || s.pagos || [], lsoc = s.socios || [];
  const adicTot = adic.reduce((a, x) => a + num(x.monto), 0), presTotal = presIni + adicTot;
  const costoReal = gastos.reduce((a, x) => a + num(x.monto), 0), imprevTot = gastos.filter(g => g.tipo === "imprevisto").reduce((a, x) => a + num(x.monto), 0);
  const cobrado = cobros.reduce((a, x) => a + num(x.monto), 0), util = presTotal - costoReal, retTot = retiros.reduce((a, x) => a + num(x.monto), 0);
  const sec = [{ titulo: "Resumen", filas: [{ label: "Presupuesto (inicial + adicionales)", value: money(presTotal) }, { label: "Cobrado", value: money(cobrado) }, { label: "Resta a cobrar", value: money(presTotal - cobrado) }, { label: "Costo real" + (imprevTot ? ` (imprev. ${money(imprevTot)})` : ""), value: money(costoReal) }, { label: "Utilidad", value: money(util), strong: true }, { label: "Utilidad por distribuir", value: money(util - retTot) }] }];
  if (lsoc.length) sec.push({ titulo: "Reparto por socio", filas: lsoc.map(so => { const corr = util * num(so.pct) / 100; const rs = retiros.filter(r => r.socioId === so.id).reduce((a, r) => a + num(r.monto), 0); return { label: `${so.nombre} (${num(so.pct)}%) — retiró ${money(rs)}`, value: money(corr - rs) }; }) });
  if (adic.length) sec.push({ titulo: "Adicionales", filas: adic.map(a => ({ label: a.texto || "Adicional", value: money(num(a.monto)) })) });
  if (gastos.length) sec.push({ titulo: "Gastos / costo real", filas: gastos.map(g => ({ label: (g.texto || "Gasto") + (g.tipo && g.tipo !== "normal" ? ` (${g.tipo})` : ""), value: money(num(g.monto)) })) });
  return sec;
}
function reportePropiaTexto(p) {
  const costos = p.costos || []; const rub = {}; costos.forEach(c => { rub[c.cat] = (rub[c.cat] || 0) + num(c.montoArs); });
  const inv = costos.reduce((s, c) => s + num(c.montoArs), 0), invU = costos.reduce((s, c) => s + num(c.montoUsd), 0);
  const vA = num(p.ventaArs), vU = num(p.ventaUsd);
  const L = [`*${p.nombre} — Obra particular*`, "", `*Inversión total:* ${money(inv)} / US$${Math.round(invU).toLocaleString("es-AR")}`];
  if (vU) L.push(`*Venta est.:* US$${Math.round(vU).toLocaleString("es-AR")} · *Resultado:* US$${Math.round(vU - invU).toLocaleString("es-AR")}`);
  if (vA) L.push(`*Venta est.:* ${money(vA)} · *Resultado:* ${money(vA - inv)}`);
  L.push("", "*Costos por rubro:*"); Object.entries(rub).filter(([, v]) => v > 0).forEach(([k, v]) => L.push(`• ${k}: ${money(v)}`));
  const media = p.adjuntos || []; if (media.length) { L.push("", "*Fotos y videos:*"); media.forEach(m => L.push(`${m.tipo === "video" ? "🎥" : "📷"} ${m.url}`)); }
  return L.join("\n");
}
function seccionesPropia(p) {
  const costos = p.costos || []; const rub = {}; costos.forEach(c => { rub[c.cat] = (rub[c.cat] || 0) + num(c.montoArs); });
  const inv = costos.reduce((s, c) => s + num(c.montoArs), 0), invU = costos.reduce((s, c) => s + num(c.montoUsd), 0), vA = num(p.ventaArs), vU = num(p.ventaUsd);
  return [{ titulo: "Resumen", filas: [{ label: "Inversión total US$", value: "US$" + Math.round(invU).toLocaleString("es-AR") }, { label: "Inversión total $", value: money(inv) }, ...(vU ? [{ label: "Venta estimada US$", value: "US$" + Math.round(vU).toLocaleString("es-AR") }, { label: "Resultado US$", value: "US$" + Math.round(vU - invU).toLocaleString("es-AR"), strong: true }] : []), ...(vA ? [{ label: "Venta estimada $", value: money(vA) }, { label: "Resultado $", value: money(vA - inv), strong: true }] : [])] }, { titulo: "Costos por rubro", filas: Object.entries(rub).filter(([, v]) => v > 0).map(([k, v]) => ({ label: k, value: money(v) })) }];
}
function reporteEdificioTexto(e) {
  const costos = e.costos || [], unidades = e.unidades || [];
  const inv = costos.reduce((s, c) => s + num(c.montoArs), 0), invU = costos.reduce((s, c) => s + num(c.montoUsd), 0);
  const vtaU = unidades.reduce((s, u) => s + num(u.precioUsd), 0), vtaA = unidades.reduce((s, u) => s + num(u.precioArs), 0), nV = unidades.filter(u => u.estado === "vendido").length;
  const L = [`*${e.nombre} — Edificio*`, "", `*Inversión total:* ${money(inv)} / US$${Math.round(invU).toLocaleString("es-AR")}`, `*Venta proyectada:* US$${Math.round(vtaU).toLocaleString("es-AR")} (${unidades.length} un., ${nV} vend.)`, `*Resultado:* US$${Math.round(vtaU - invU).toLocaleString("es-AR")} / ${money(vtaA - inv)}`, "", "*Unidades:*"];
  unidades.forEach(u => L.push(`• ${u.nombre} (${(u.estado || "disponible")}): US$${Math.round(num(u.precioUsd)).toLocaleString("es-AR")}`));
  const media = e.adjuntos || []; if (media.length) { L.push("", "*Fotos y videos:*"); media.forEach(m => L.push(`${m.tipo === "video" ? "🎥" : "📷"} ${m.url}`)); }
  return L.join("\n");
}
function seccionesEdificio(e) {
  const costos = e.costos || [], unidades = e.unidades || [];
  const inv = costos.reduce((s, c) => s + num(c.montoArs), 0), invU = costos.reduce((s, c) => s + num(c.montoUsd), 0), vtaU = unidades.reduce((s, u) => s + num(u.precioUsd), 0), vtaA = unidades.reduce((s, u) => s + num(u.precioArs), 0);
  const rub = {}; costos.forEach(c => { rub[c.cat] = (rub[c.cat] || 0) + num(c.montoArs); });
  return [{ titulo: "Resumen", filas: [{ label: "Inversión total US$", value: "US$" + Math.round(invU).toLocaleString("es-AR") }, { label: "Inversión total $", value: money(inv) }, { label: "Venta proyectada US$", value: "US$" + Math.round(vtaU).toLocaleString("es-AR") }, { label: "Resultado US$", value: "US$" + Math.round(vtaU - invU).toLocaleString("es-AR"), strong: true }, { label: "Resultado $", value: money(vtaA - inv), strong: true }] }, { titulo: "Unidades", filas: unidades.map(u => ({ label: `${u.nombre} · ${(u.estado || "disponible")}`, value: "US$" + Math.round(num(u.precioUsd)).toLocaleString("es-AR") })) }, { titulo: "Costos por rubro", filas: Object.entries(rub).filter(([, v]) => v > 0).map(([k, v]) => ({ label: k, value: money(v) })) }];
}
function mensajeCertificadoTexto(obra, data, certsDe, indices) {
  const cs = certsDe(obra.id); const ult = cs[cs.length - 1];
  if (!ult) return `Hola! Todavía no hay certificados cargados para ${obra.nombre}.`;
  const r = calcCert(ult, obra, cs, indices); const tot = quincenasObra(obra) || cs.length;
  const pc = presupCliente(obra); const ya = clienteAcumDe(ult.cantidades, obra); const resto = Math.max(0, pc - ya);
  return `Hola! Te paso el detalle del certificado de *${obra.nombre}*:\n\n` +
    `Certificado N° ${cs.length}${tot ? ` de ${tot}` : ""} — ${fmtISO(ult.fecha)}\n` +
    `Avance acumulado: ${pc > 0 ? (ya / pc * 100).toFixed(0) : 0}%\n` +
    `Monto del período: ${money(r.bruto)}\n` +
    (r.ajuste > 0 ? `Ajuste CAC (redet.): ${money(r.ajuste)}\n` : "") +
    (r.amort > 0 ? `Amortización anticipo: -${money(r.amort)}\n` : "") +
    `*Neto a cobrar: ${money(r.neto)}*\n` +
    `Saldo por cobrar: ${money(resto)}\n\n` +
    `El PDF del certificado te lo adjunto aparte. Cualquier cosa avisame. Saludos.`;
}
function AgendaTab({ obras, certs, certsDe, indices, data, save }) {
  const contactos = data.contactos || [];
  const [nombre, setNombre] = useState(""); const [telefono, setTelefono] = useState(""); const [tipo, setTipo] = useState("cliente"); const [obraId, setObraId] = useState("");
  const agregar = () => { if (!nombre.trim()) return; const key = tipo + "|" + nombre.trim().toLowerCase() + "|" + limpiarTel(telefono); if (contactos.some(c => ((c.tipo || "") + "|" + String(c.nombre || "").trim().toLowerCase() + "|" + limpiarTel(c.telefono || "")) === key)) { alert("Ese contacto ya está en la agenda."); return; } save({ ...data, contactos: [...contactos, { id: uid(), nombre: nombre.trim(), telefono: telefono.trim(), tipo, obraId: obraId || "", ts: Date.now() }] }); setNombre(""); setTelefono(""); setObraId(""); };
  const limpiarDup = () => save({ ...data, contactos: dedupeContactos(contactos) });
  const borrar = (id) => save({ ...data, contactos: contactos.filter(c => c.id !== id) });
  const setObraDe = (id, oid) => save({ ...data, contactos: contactos.map(c => c.id === id ? { ...c, obraId: oid } : c) });
  return (<div style={{ padding: "14px 16px 40px" }}>
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 10 }}>Nuevo contacto</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[["cliente", "Cliente"], ["socio", "Socio"]].map(([k, l]) => <button key={k} onClick={() => setTipo(k)} style={{ flex: 1, background: tipo === k ? T.navy : T.bg, color: tipo === k ? "#fff" : T.sub, border: "none", borderRadius: 9, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
      </div>
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" style={inp} />
      <input value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" placeholder="WhatsApp con código país (ej: 5491122334455)" style={inp} />
      {tipo === "cliente" && obras.length > 0 && <select value={obraId} onChange={e => setObraId(e.target.value)} style={inp}><option value="">Obra vinculada (opcional)</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>}
      <button onClick={agregar} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 11, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>Agregar contacto</button>
    </div>
    {contactos.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "20px 0" }}>Todavía no hay contactos cargados.</div>}
    {contactos.length - dedupeContactos(contactos).length > 0 && <button onClick={limpiarDup} style={{ width: "100%", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.4)", color: "#EF4444", borderRadius: 10, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>Limpiar {contactos.length - dedupeContactos(contactos).length} contacto(s) duplicado(s)</button>}
    {dedupeContactos(contactos).slice().sort((a, b) => a.tipo === b.tipo ? 0 : a.tipo === "socio" ? -1 : 1).map(c => { const esCli = c.tipo === "cliente"; const obra = obras.find(o => o.id === c.obraId); return (
      <div key={c.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: SHDsm }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{c.nombre}</div><div style={{ fontSize: 12, color: T.sub, marginTop: 1 }}>{c.telefono || "sin teléfono"}</div></div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: esCli ? T.accent : BRASS, background: esCli ? T.al : "rgba(176,137,79,.14)", borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>{esCli ? "CLIENTE" : "SOCIO"}</span>
        </div>
        {esCli ? <div style={{ marginTop: 10 }}>
          {obras.length > 0 && <select value={c.obraId || ""} onChange={e => setObraDe(c.id, e.target.value)} style={{ ...inp, marginTop: 0 }}><option value="">Elegí la obra del certificado…</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>}
          {obra ? <a href={waLink(c.telefono, mensajeCertificadoTexto(obra, data, certsDe, indices))} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", background: "#25D366", color: "#fff", borderRadius: 10, padding: "12px", fontSize: 13.5, fontWeight: 700, textDecoration: "none", marginTop: 8 }}>Enviar certificado por WhatsApp</a> : <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Elegí una obra para mandar su último certificado.</div>}
        </div> : <a href={waLink(c.telefono, resumenSocioTexto(data))} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", background: "#25D366", color: "#fff", borderRadius: 10, padding: "12px", fontSize: 13.5, fontWeight: 700, textDecoration: "none", marginTop: 10 }}>Enviar resumen por WhatsApp</a>}
        <button onClick={() => borrar(c.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11.5, cursor: "pointer", marginTop: 8, padding: 0 }}>Eliminar</button>
      </div>
    ); })}
    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>El teléfono va con código de país, sin +, sin 0 y sin 15 (ej: 5491122334455). El botón abre WhatsApp con el mensaje ya escrito. El PDF del certificado se adjunta desde Cert cliente (📄 → Compartir → WhatsApp).</div>
  </div>);
}
const RUBROS_PROPIA = ["Lote", "Movimiento de suelo", "Materiales gruesos", "Materiales de plomería", "Materiales de electricidad", "Mano de obra gruesa", "Pintura", "Plomería", "Electricidad", "Aire acondicionado", "Aberturas", "Pisos", "Artefactos sanitarios", "Revestimientos exterior", "Impermeabilización", "Muebles de interior (cocina y vestidores)", "Muebles de decoración", "Decoración", "Revestimientos especiales", "Iluminación", "Durlock", "Barandas de escalera", "Barandas de balcón", "Piscina", "Parquización", "Planta", "Artefactos eléctricos", "Electrodomésticos"];
const usdFmt = (n) => "US$" + Math.round(n || 0).toLocaleString("es-AR");
function arsUnif(c, cotU) { const n = num(c.monto); if (c.moneda === "ars") return n; if (c.moneda === "usd") return cotU > 0 ? n * cotU : num(c.montoArs); return num(c.montoArs); }
function usdUnif(c, cotU) { const n = num(c.monto); if (c.moneda === "usd") return n; if (c.moneda === "ars") return cotU > 0 ? n / cotU : num(c.montoUsd); return num(c.montoUsd); }
function RubroRow({ rubro, items, onAdd, onDel, cotizDef, setCotizDef, m2, cotU }) {
  const M2 = num(m2); const CU = num(cotU);
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState(""); const [moneda, setMoneda] = useState("ars"); const [cotiz, setCotiz] = useState(cotizDef || ""); const [nota, setNota] = useState(""); const [base, setBase] = useState("total");
  const subArs = items.reduce((s, c) => s + arsUnif(c, CU), 0), subUsd = items.reduce((s, c) => s + usdUnif(c, CU), 0);
  const agregar = () => { const mo = numMoney(monto); if (mo <= 0) return; const ct = numMoney(cotiz); const total = (base === "m2" && M2 > 0) ? mo * M2 : mo; let ars, usdv; if (moneda === "usd") { usdv = total; ars = ct > 0 ? total * ct : 0; } else { ars = total; usdv = ct > 0 ? total / ct : 0; } onAdd({ cat: rubro, moneda, monto: total, cotiz: ct, montoArs: ars, montoUsd: usdv, nota: nota.trim(), base, valorUnit: base === "m2" ? mo : null }); if (ct > 0) setCotizDef(String(ct)); setMonto(""); setNota(""); };
  return <div style={{ borderBottom: `1px solid ${T.border}`, padding: "9px 0" }}>
    <div onClick={() => setOpen(o => !o)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{rubro}{items.length > 0 ? <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginLeft: 6 }}>· {items.length} {items.length === 1 ? "carga" : "cargas"}</span> : ""}</span>
      {(subArs > 0 || subUsd > 0) ? <span style={{ fontSize: 11.5, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}><b style={{ color: T.accent }}>{usdFmt(subUsd)}</b> <span style={{ color: T.muted }}>/ {money(subArs)}</span></span> : <span style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>＋ cargar</span>}
    </div>
    {(subArs > 0 && M2 > 0) && <div style={{ fontSize: 10, color: T.muted, textAlign: "right", marginTop: 2 }}>{usdFmt(subUsd / M2)} / {money(subArs / M2)} por m²</div>}
    {open && <div style={{ marginTop: 8, background: T.bg, borderRadius: 9, padding: 10 }}>
      {M2 > 0 && <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>{[["total", "Cargar total"], ["m2", "Cargar por m²"]].map(([k, l]) => <button key={k} onClick={() => setBase(k)} style={{ flex: 1, background: base === k ? T.accent : T.card, color: base === k ? "#fff" : T.sub, border: `1px solid ${base === k ? T.accent : T.border}`, borderRadius: 7, padding: "7px 3px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}</div>}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ display: "flex", background: T.card, borderRadius: 8, padding: 2, border: `1px solid ${T.border}` }}>{[["usd", "US$"], ["ars", "$"]].map(([k, l]) => <button key={k} onClick={() => setMoneda(k)} style={{ background: moneda === k ? T.navy : "transparent", color: moneda === k ? "#fff" : T.sub, border: "none", borderRadius: 6, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}</div>
        <input value={monto} onChange={e => setMonto(fmtMiles(e.target.value))} inputMode="numeric" placeholder={(base === "m2" ? "Precio x m² " : "Monto ") + (moneda === "usd" ? "US$" : "$")} style={{ ...inpSm, flex: 1 }} />
      </div>
      {base === "m2" && M2 > 0 && numMoney(monto) > 0 && <div style={{ fontSize: 10.5, color: T.accent, marginTop: 5 }}>Total: {moneda === "usd" ? usdFmt(numMoney(monto) * M2) : money(numMoney(monto) * M2)} ({fmtMiles(M2)} m² × {moneda === "usd" ? usdFmt(numMoney(monto)) : money(numMoney(monto))})</div>}
      {numMoney(monto) > 0 && numMoney(cotiz) > 0 && (() => { const tn = (base === "m2" && M2 > 0 ? numMoney(monto) * M2 : numMoney(monto)); const ct = numMoney(cotiz); return <div style={{ fontSize: 10.5, color: T.ok, marginTop: 5 }}>≈ {moneda === "ars" ? usdFmt(tn / ct) : money(tn * ct)} a esta cotización</div>; })()}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 7 }}>
        <span style={{ fontSize: 11.5, color: T.sub, whiteSpace: "nowrap" }}>Cotiz. $/US$</span>
        <input value={cotiz} onChange={e => setCotiz(fmtMiles(e.target.value))} inputMode="numeric" placeholder="ej: 1450" style={{ ...inpSm, width: 92, textAlign: "right" }} />
        <button onClick={agregar} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Agregar</button>
      </div>
      <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (ej: Corralón X - factura 0012)" style={{ ...inpSm, width: "100%", boxSizing: "border-box", marginTop: 7 }} />
      {items.map(c => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: T.sub, marginTop: 6 }}><span style={{ minWidth: 0 }}>{usdFmt(usdUnif(c, CU))} · {money(arsUnif(c, CU))}{M2 > 0 ? ` · ${money(arsUnif(c, CU) / M2)}/m²` : ""}{c.moneda ? ` · cargado en ${c.moneda === "usd" ? "US$" : "$"}` : ""}{c.nota ? <span style={{ color: T.muted }}> · {c.nota}</span> : ""}</span><button onClick={() => onDel(c.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13, flexShrink: 0 }}>✕</button></div>)}
    </div>}
  </div>;
}
function PropiasPanel({ data, save }) {
  const propias = data.propias || [];
  const [nombre, setNombre] = useState(""); const [abrir, setAbrir] = useState(false); const [expandir, setExpandir] = useState({}); const [subiendo, setSubiendo] = useState(""); const [pdfHtml, setPdfHtml] = useState(null); const [m2n, setM2n] = useState("");
  const [cotizDef, setCotizDef] = useState(String(data.config?.cotizUSD || ""));
  const addPropia = () => { if (!nombre.trim()) return; save({ ...data, propias: [...propias, { id: uid(), nombre: nombre.trim(), m2: numMoney(m2n), ventaUsd: 0, ventaArs: 0, costos: [], adjuntos: [], ts: Date.now() }] }); setNombre(""); setM2n(""); setAbrir(false); };
  const upd = (pid, fn) => save({ ...data, config: { ...(data.config || {}), cotizUSD: numMoney(cotizDef) || data.config?.cotizUSD }, propias: propias.map(p => p.id === pid ? fn(p) : p) });
  const addCosto = (pid, c) => upd(pid, p => ({ ...p, costos: [...(p.costos || []), { id: uid(), ts: Date.now(), ...c }] }));
  const delCosto = (pid, cid) => upd(pid, p => ({ ...p, costos: (p.costos || []).filter(x => x.id !== cid) }));
  const setVenta = (pid, k, v) => upd(pid, p => ({ ...p, [k]: numMoney(v) }));
  const delPropia = (id) => save({ ...data, propias: propias.filter(p => p.id !== id) });
  const delAdj = (pid, url) => save({ ...data, propias: propias.map(p => p.id === pid ? { ...p, adjuntos: (p.adjuntos || []).filter(a => a.url !== url) } : p) });
  async function subirAdj(pid, files) { const arr = Array.from(files || []); if (!arr.length) return; setSubiendo(pid); const nuevos = []; for (const f of arr) { const url = await subirArchivo(f); if (url) nuevos.push({ url, tipo: (f.type || "").startsWith("video") ? "video" : "foto" }); } if (nuevos.length) save({ ...data, propias: propias.map(p => p.id === pid ? { ...p, adjuntos: [...(p.adjuntos || []), ...nuevos] } : p) }); else alert("No se pudo subir."); setSubiendo(""); }
  return (<div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm, borderTop: `3px solid ${BRASS}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obras particulares (para vender)</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Las que hacés para vos, llave en mano con lote. Cargás en $ o US$ con la cotización del momento.</div></div>
      <button onClick={() => setAbrir(o => !o)} style={{ background: T.al, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 700, color: T.accent, cursor: "pointer", flexShrink: 0 }}>{abrir ? "Cerrar" : "+ Nueva"}</button>
    </div>
    {abrir && <div style={{ background: T.bg, borderRadius: 11, padding: 12, marginTop: 10 }}>
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (ej: Casa Canning Lote 815)" style={{ ...inp, marginTop: 0 }} />
      <input value={m2n} onChange={e => setM2n(fmtMiles(e.target.value))} inputMode="numeric" placeholder="Superficie m² (para precios por m²)" style={inp} />
      <button onClick={addPropia} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Crear obra propia</button>
    </div>}
    {propias.map(p => {
      const costos = p.costos || []; const cotU = num(p.cotizUnif) || 0;
      const totArs = costos.reduce((s, c) => s + arsUnif(c, cotU), 0), totUsd = costos.reduce((s, c) => s + usdUnif(c, cotU), 0);
      const vU = num(p.ventaUsd), vA = num(p.ventaArs); const resU = vU - totUsd, resA = vA - totArs; const mgU = vU > 0 ? resU / vU * 100 : 0; const exp = expandir[p.id]; const sup = num(p.m2);
      return (<div key={p.id} style={{ background: T.bg, borderRadius: 12, padding: 13, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 14.5, fontWeight: 800 }}>{p.nombre}</span><button onClick={() => delPropia(p.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer" }}>Eliminar</button></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 12, color: T.sub, flex: 1 }}>Superficie</span><input defaultValue={p.m2 ? fmtMiles(p.m2) : ""} onBlur={e => setVenta(p.id, "m2", e.target.value)} inputMode="numeric" placeholder="m²" style={{ ...inpSm, width: 110, textAlign: "right" }} /><span style={{ fontSize: 12, color: T.sub }}>m²</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 12, color: T.sub, flex: 1 }}>Cotización p/ unificar (opcional)</span><input defaultValue={p.cotizUnif ? fmtMiles(p.cotizUnif) : ""} onBlur={e => setVenta(p.id, "cotizUnif", e.target.value)} inputMode="numeric" placeholder="dejar vacío" style={{ ...inpSm, width: 110, textAlign: "right" }} /></div>
        {cotU <= 0 && <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>Cada gasto se convierte con su propia cotización. Poné un valor acá solo si querés re-expresar todo a un tipo de cambio único.</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.card, borderRadius: 9, padding: "9px 11px" }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>Inversión total</span><span style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}><b style={{ color: T.accent }}>{usdFmt(totUsd)}</b> <span style={{ color: T.muted }}>/ {money(totArs)}</span></span></div>
        {sup > 0 && totArs > 0 && <div style={{ fontSize: 11, color: T.muted, textAlign: "right", marginTop: 3 }}>{usdFmt(totUsd / sup)} / {money(totArs / sup)} por m²</div>}
        {cotU > 0 && <div style={{ fontSize: 10, color: T.muted, textAlign: "right", marginTop: 2 }}>Unificado a cotización {fmtMiles(cotU)}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Venta est. US$</div><input defaultValue={p.ventaUsd ? fmtMiles(p.ventaUsd) : ""} onBlur={e => setVenta(p.id, "ventaUsd", e.target.value)} inputMode="numeric" placeholder="US$" style={{ ...inpSm, width: "100%", boxSizing: "border-box", textAlign: "right" }} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Venta est. $</div><input defaultValue={p.ventaArs ? fmtMiles(p.ventaArs) : ""} onBlur={e => setVenta(p.id, "ventaArs", e.target.value)} inputMode="numeric" placeholder="$" style={{ ...inpSm, width: "100%", boxSizing: "border-box", textAlign: "right" }} /></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9, paddingTop: 9, borderTop: `1px solid ${T.border}` }}><span style={{ fontSize: 13, fontWeight: 800 }}>Resultado esperado{vU > 0 ? ` · ${mgU.toFixed(0)}%` : ""}</span><span style={{ fontSize: 13.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{vU > 0 && <span style={{ color: resU >= 0 ? T.ok : "#EF4444" }}>{usdFmt(resU)}</span>}{vA > 0 && <span style={{ color: resA >= 0 ? T.ok : "#EF4444", marginLeft: 8 }}>{money(resA)}</span>}{vU <= 0 && vA <= 0 && <span style={{ color: T.muted, fontSize: 11, fontWeight: 600 }}>cargá la venta</span>}</span></div>
        {sup > 0 && (vU > 0 || vA > 0) && <div style={{ fontSize: 10.5, color: T.muted, textAlign: "right", marginTop: 3 }}>Venta {vU > 0 ? usdFmt(vU / sup) : money(vA / sup)}/m² · Resultado {vU > 0 ? usdFmt(resU / sup) : money(resA / sup)}/m²</div>}
        {(() => { const rt = {}; costos.forEach(c => { rt[c.cat] = (rt[c.cat] || 0) + arsUnif(c, cotU); }); const arr = Object.entries(rt).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); const top = arr.map(([k, v]) => ({ label: k, value: v })); return <div style={{ marginTop: 10 }}><GraficoTorta titulo="Costos por rubro" items={top} centro={money(totArs)} centroSub="inversión" /><GraficoBarras titulo="Costos por rubro (ranking)" items={top} />{(vU > 0 || vA > 0) && <GraficoBarras titulo="Inversión vs resultado" items={[{ label: "Inversión", value: totArs, color: "#C2410C" }, { label: "Resultado", value: Math.max(0, resA), color: T.ok }]} />}</div>; })()}
        <button onClick={() => setExpandir(e => ({ ...e, [p.id]: !e[p.id] }))} style={{ width: "100%", background: "none", border: `1px dashed ${T.border}`, color: T.accent, borderRadius: 9, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>{exp ? "Ocultar rubros ▲" : "Cargar / ver rubros ▼"}</button>
        {exp && <div style={{ marginTop: 8 }}>{RUBROS_PROPIA.map(r => <RubroRow key={r} rubro={r} items={costos.filter(c => c.cat === r)} onAdd={(c) => addCosto(p.id, c)} onDel={(cid) => delCosto(p.id, cid)} cotizDef={cotizDef} setCotizDef={setCotizDef} m2={sup} cotU={cotU} />)}</div>}
        {(p.adjuntos || []).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{(p.adjuntos || []).map(m => <div key={m.url} style={{ position: "relative" }}>{m.tipo === "video" ? <video src={m.url} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", background: "#000" }} /> : <img src={m.url} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }} />}<button onClick={() => delAdj(p.id, m.url)} style={{ position: "absolute", top: -6, right: -6, background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer", lineHeight: 1 }}>✕</button></div>)}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <label style={{ flex: 1, textAlign: "center", background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{subiendo === p.id ? "Subiendo…" : "📷 Foto/video"}<input type="file" accept="image/*,video/*" multiple onChange={e => { subirAdj(p.id, e.target.files); e.target.value = ""; }} style={{ display: "none" }} /></label>
          <a href={waLink("", reportePropiaTexto(p))} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", background: "#25D366", color: "#fff", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>WhatsApp</a>
          <button onClick={() => { const rt = {}; costos.forEach(c => { rt[c.cat] = (rt[c.cat] || 0) + num(c.montoArs); }); const arr = Object.entries(rt).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); const top = arr.map(([k, v]) => ({ label: k, value: v })); setPdfHtml(reporteHTML(p.nombre + " — Obra particular", "", seccionesPropia(p), p.adjuntos, data.config, [{ tipo: "torta", titulo: "Costos por rubro", items: top }, { tipo: "barras", titulo: "Inversión vs resultado", items: [{ label: "Inversión", value: totArs, color: "#C2410C" }, { label: "Resultado", value: Math.max(0, resA), color: "#16A34A" }] }])); }} style={{ flex: 1, background: T.navy, color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>PDF</button>
        </div>
      </div>);
    })}
    {propias.length === 0 && !abrir && <div style={{ fontSize: 12, color: T.muted, marginTop: 10, textAlign: "center" }}>Tocá "+ Nueva" para cargar una obra propia con sus rubros.</div>}
    {pdfHtml && <PdfOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
  </div>);
}

function BarrasMes({ titulo, series, meses }) {
  if (!meses.length) return null;
  const max = Math.max(1, ...meses.map(m => series.reduce((s, se) => Math.max(s, se.data[m] || 0), 0)));
  return (<div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 12 }}>{titulo}</div>
    {meses.map(m => <div key={m} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}><span style={{ color: T.sub, fontWeight: 600 }}>{mesLabel(m)}</span><span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{series.map((se, i) => <span key={i} style={{ color: se.color, marginLeft: i ? 8 : 0 }}>{money(se.data[m] || 0)}</span>)}</span></div>
      <div style={{ display: "flex", gap: 3, height: series.length > 1 ? 8 : 10 }}>{series.map((se, i) => <div key={i} style={{ flex: 1, background: T.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(se.data[m] || 0) / max * 100}%`, height: "100%", background: se.color, borderRadius: 4 }} /></div>)}</div>
    </div>)}
    {series.length > 1 && <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 11 }}>{series.map((se, i) => <span key={i} style={{ color: T.sub }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: se.color, marginRight: 5 }} />{se.nombre}</span>)}</div>}
  </div>);
}
function presupCosto(o) { return num(o?.m2) * num(o?.costoM2); }
function incidencia(o, r) { return num(r?.pct) / 100; }
function sumaIncid(o) { return (o?.rubros || []).reduce((s, r) => s + num(r.pct), 0); }
function clienteAcumDe(cant, o) { const pc = presupCliente(o); return (o?.rubros || []).reduce((s, r) => s + (num((cant || {})[r.id]) / 100) * (num(r.pct) / 100) * pc, 0); }
function costoAcumDe(cant, o) { const pco = presupCosto(o); return (o?.rubros || []).reduce((s, r) => s + (num((cant || {})[r.id]) / 100) * (num(r.pct) / 100) * pco, 0); }
function extraSums(o) { const l = o?.costoExtra || []; return { monto: l.filter(x => x.tipo !== "pct").reduce((s, x) => s + num(x.valor), 0), pct: l.filter(x => x.tipo === "pct").reduce((s, x) => s + num(x.valor), 0) }; }

function calcCert(cert, obra, certsDeObra, indices) {
  const pc = presupCliente(obra);
  const anticipoMonto = anticipoDe(obra);
  const prevCert = (certsDeObra || []).filter(c => c.id !== cert.id && (c.fecha < cert.fecha || (c.fecha === cert.fecha && (c.ts || 0) < (cert.ts || 0)))).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.ts || 0) - (a.ts || 0)))[0];
  const cliAcum = clienteAcumDe(cert.cantidades, obra);
  const prevCli = prevCert ? clienteAcumDe(prevCert.cantidades, obra) : 0;
  const bruto = Math.max(0, cliAcum - prevCli);
  const coAcum = costoAcumDe(cert.cantidades, obra);
  const prevCo = prevCert ? costoAcumDe(prevCert.cantidades, obra) : 0;
  const costoDirPeriodo = Math.max(0, coAcum - prevCo);
  const rd = redetReplay(cert, obra, certsDeObra, indices);
  const ajuste = rd.ajuste;
  const ajustado = bruto + rd.ajuste;
  const share = pc > 0 ? bruto / pc : 0;
  const amort = anticipoMonto * share;
  const neto = ajustado - amort;
  const { monto, pct } = extraSums(obra);
  const extraMontoPeriodo = monto * share;
  const imprevPeriodo = bruto * num(obra?.imprevistosPct != null ? obra.imprevistosPct : 5) / 100;
  const extraPctPeriodo = ajustado * pct / 100;
  const costo = costoDirPeriodo + extraMontoPeriodo + imprevPeriodo + extraPctPeriodo;
  const margen = ajustado - costo;
  const margenPct = ajustado > 0 ? margen / ajustado * 100 : 0;
  const avanceAcum = pc > 0 ? cliAcum / pc * 100 : 0;
  return { pc, anticipoMonto, avanceAcum, bruto, ajuste, ajustado, amort, neto, costoDirPeriodo, extraMontoPeriodo, imprevPeriodo, extraPctPeriodo, costo, margen, margenPct, provisorio: rd.provisorio, rate: rd.rate, saldoBase: rd.saldoBase };
}
function detalleRubros(cert, obra, certsDeObra) {
  const pc = presupCliente(obra), pco = presupCosto(obra);
  const prevCert = (certsDeObra || []).filter(c => c.id !== cert.id && (c.fecha < cert.fecha || (c.fecha === cert.fecha && (c.ts || 0) < (cert.ts || 0)))).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.ts || 0) - (a.ts || 0)))[0];
  return (obra?.rubros || []).map(r => {
    const inc = num(r.pct) / 100, acum = num((cert.cantidades || {})[r.id]), prev = prevCert ? num((prevCert.cantidades || {})[r.id]) : 0, per = Math.max(0, acum - prev);
    return { id: r.id, nombre: r.nombre, inc, pct: num(r.pct), pctAcum: acum, pctPrev: prev, per, clientePeriodo: (per / 100) * inc * pc, costoPeriodo: (per / 100) * inc * pco };
  });
}

function Money({ v, c }) { return <span style={{ fontWeight: 700, color: c || T.text, fontVariantNumeric: "tabular-nums" }}>{money(v)}</span>; }
function Field({ label, children, hint }) { return <div style={{ marginBottom: 13 }}><label style={{ fontSize: 11, fontWeight: 600, color: T.sub, letterSpacing: "0.02em" }}>{label}</label>{children}{hint && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}</div>; }
const inpLabelStyle = { fontSize: 12.5, fontWeight: 600, color: T.sub };
function Box({ t, v, c }) { return <div style={{ background: T.bg, borderRadius: 11, padding: "10px 12px" }}><div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>{t}</div><div style={{ fontSize: 14, fontWeight: 700, color: c || T.text, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{v}</div></div>; }
function Line({ t, v, c }) { return <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}><span style={{ color: T.sub }}>{t}</span><span style={{ fontWeight: 600, color: c || T.text, fontVariantNumeric: "tabular-nums" }}>{v}</span></div>; }

export default function App() {
  const [data, save, refrescar] = useFinanzas();
  const [refrescando, setRefrescando] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  async function actualizar() { setRefrescando(true); const ok = await refrescar(); setRefrescando(false); setOkMsg(ok ? "Actualizado ✓" : "Sin cambios"); setTimeout(() => setOkMsg(""), 2000); }
  useEffect(() => { const t = setTimeout(() => { try { storage.set("vv_finanzas_resumen", resumenFinanciero(data)); } catch { } }, 1500); return () => clearTimeout(t); }, [data]);
  const [tab, setTab] = useState("ia");
  const [verConfig, setVerConfig] = useState(false);
  const cfg = data.config || {};
  T = cfg.modo === "oscuro" ? T_DARK : T_LIGHT; inp = buildInp(T); inpSm = buildInpSm(T);
  const obras = data.obras || [], certs = data.certs || [], indices = data.cacMensual || {};
  const certsDe = (id) => certs.filter(c => c.obraId === id).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.ts || 0) - (b.ts || 0)));
  return (<div style={{ minHeight: "100vh", background: fondoDe(cfg), fontFamily: fuenteDe(cfg), width: "100%", color: T.text }}>
    <style>{`*{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}*:focus{outline:none}input:focus,select:focus{border-color:${BRASS}!important;box-shadow:0 0 0 3px rgba(176,137,79,.12)}::selection{background:rgba(176,137,79,.20)}button{-webkit-tap-highlight-color:transparent;transition:opacity .15s,transform .05s}button:active{transform:scale(.985)}body{margin:0}input,select,textarea{color:${T.text};background:${T.inpBg}}input::placeholder,textarea::placeholder{color:${T.muted}}@media(min-width:1700px){.vv-body{padding-left:calc((100% - 1560px)/2);padding-right:calc((100% - 1560px)/2)}}`}</style>
    <div style={{ background: `linear-gradient(180deg, #0E1B2B 0%, ${T.navy} 100%)`, color: "#fff", padding: "20px 24px 18px", textAlign: "center", position: "relative" }}>
      <button onClick={() => setVerConfig(true)} title="Personalización" style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 9, width: 34, height: 34, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙︎</button>
      <button onClick={actualizar} title="Actualizar" style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 9, height: 34, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>{refrescando ? "↻" : "↻"} {okMsg || (refrescando ? "..." : "Actualizar")}</button>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.logo ? "#fff" : `linear-gradient(145deg, ${BRASS}, #c9a869)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: T.navy, letterSpacing: "-0.02em", boxShadow: "0 2px 8px rgba(176,137,79,.35)", overflow: "hidden" }}>{cfg.logo ? <img src={cfg.logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : "V+V"}</div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{cfg.nombre || "V+V Construcciones"}</div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: BRASS, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 1 }}>{cfg.subtitulo || "Finanzas y Certificaciones"}</div>
        </div>
      </div>
    </div>
    <div style={{ display: "flex", background: T.navBar, backdropFilter: "saturate(180%) blur(12px)", WebkitBackdropFilter: "saturate(180%) blur(12px)", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50 }}>
      {[["ia", "✨ IA"], ["presupuesto", "Presupuestos"], ["costo", "Cert.", "costo"], ["cliente", "Cert.", "cliente"], ["caja", "Gastos"], ["resultado", "Resultados"], ["agenda", "Agenda"]].map(([k, l1, l2]) => (
        <button key={k} onClick={() => setTab(k)} style={{ flex: 1, background: "none", border: "none", color: tab === k ? T.text : T.muted, padding: "10px 1px 9px", fontSize: 10.5, fontWeight: tab === k ? 700 : 600, cursor: "pointer", position: "relative", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{l1}{l2 ? <><br />{l2}</> : ""}{tab === k && <span style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 24, height: 2.5, background: BRASS, borderRadius: "2px 2px 0 0" }} />}</button>
      ))}
    </div>
    <div className="vv-body">
      {tab === "presupuesto" && <PresupuestoTab obras={obras} data={data} save={save} certsDe={certsDe} indices={indices} />}
      {tab === "costo" && <CertTab modo="costo" obras={obras} data={data} save={save} certsDe={certsDe} indices={indices} />}
      {tab === "cliente" && <CertTab modo="cliente" obras={obras} data={data} save={save} certsDe={certsDe} indices={indices} />}
      {tab === "caja" && <CajaTab obras={obras} data={data} save={save} certs={certs} certsDe={certsDe} indices={indices} />}
      {tab === "resultado" && <ResultadoTab obras={obras} certs={certs} certsDe={certsDe} indices={indices} data={data} save={save} />}
      {tab === "agenda" && <AgendaTab obras={obras} certs={certs} certsDe={certsDe} indices={indices} data={data} save={save} />}
      {tab === "ia" && <AsistenteCargaTab data={data} save={save} />}
    </div>
    {verConfig && <ConfigModal data={data} save={save} onClose={() => setVerConfig(false)} />}
  </div>);
}

// ═══════════ 1 · PRESUPUESTO
function PresupuestoTab({ obras, data, save, certsDe, indices }) {
  const [form, setForm] = useState(null);
  const [firmandoP, setFirmandoP] = useState(null);
  const [pdfHtmlP, setPdfHtmlP] = useState(null);
  function imprimirPresupuesto(o) {
    const cfg = data.config || {}; const brandName = (cfg.nombre || "V+V Construcciones").toUpperCase(); const comitente = cfg.comitente || "Belfast Construction Management"; const brandHtml = cfg.logo ? `<div class="brand" style="display:flex;align-items:center;gap:10px"><img src="${cfg.logo}" style="height:40px;width:40px;object-fit:contain;background:#fff;border-radius:7px;padding:2px"/><div>${brandName}<small>CONSTRUCTORA</small></div></div>` : `<div class="brand">${brandName}<small>CONSTRUCTORA</small></div>`;
    const pc = presupCliente(o), m2 = num(o.m2), precio = num(o.precioCliente);
    const nro = obras.findIndex(x => x.id === o.id) + 1;
    const rows = (o.rubros || []).map(r => { const inc = num(r.pct); return `<tr><td>${r.nombre}</td><td class="ctr">${inc.toFixed(1)}%</td><td class="rgt">${money(inc / 100 * pc)}</td></tr>`; }).join("");
    const fp = o.firmasPresup || {};
    const firmaBox = (f, rol) => `<div style="width:240px;text-align:center">${f?.dataUrl ? `<img src="${f.dataUrl}" style="height:44px;display:block;margin:0 auto"/>` : `<div style="height:44px"></div>`}<div style="border-top:1px solid #0F1B2D;padding-top:5px;font-size:11px;color:#5B6B7F">${rol}${f?.nombre ? `<br><b style="color:#0F1B2D">${f.nombre}</b>` : "<br>&nbsp;"}${f?.codigo ? `<br><span style="font-size:8.5px;color:#94A3B8">Cód. ${f.codigo} · ${f.ts || ""}</span>` : ""}</div></div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Presupuesto ${o.nombre}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Arial,sans-serif;color:#0F1B2D;padding:0 0 34px;line-height:1.5}.head{background:#0F1B2D;color:#fff;padding:20px 40px;border-bottom:4px solid #B0894F;display:flex;justify-content:space-between;align-items:center}.brand{font-size:22px;font-weight:800}.brand small{display:block;font-size:10px;color:#B0894F;letter-spacing:2px;margin-top:2px}.doc{text-align:right;font-size:11px;color:#cdd5e0}.doc b{display:block;font-size:15px;color:#fff}.wrap{padding:0 40px}.meta{display:flex;justify-content:space-between;margin:22px 0 6px;font-size:12.5px}.meta span{color:#5B6B7F}h2{font-size:12px;color:#5B6B7F;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;border-bottom:1px solid #E3E8EF;padding-bottom:5px}p{font-size:12.5px;margin:8px 0}table{width:100%;border-collapse:collapse;font-size:12.5px}th{background:#EAF0F7;color:#1B3A5B;text-align:left;padding:8px 10px;font-size:10.5px;text-transform:uppercase}td{padding:8px 10px;border-bottom:1px solid #EEF1F5}.ctr{text-align:center}.rgt{text-align:right}.tot{margin-top:6px}.tot td{border:none;padding:4px 10px;font-size:13px}.tot .big td{border-top:2px solid #0F1B2D;font-size:17px;font-weight:800;color:#1B3A5B;padding-top:9px}.cond li{font-size:12px;margin:4px 0}.foot{display:flex;justify-content:space-between;font-size:11px;color:#5B6B7F;margin-top:54px}</style></head><body><div class="head">${brandHtml}<div class="doc"><b>PRESUPUESTO DE OBRA N° ${nro}</b>Fecha: ${fmtISO(hoyISO())}</div></div><div class="wrap"><div class="meta"><div><span>Obra:</span> <b>${o.nombre}</b></div><div><span>Comitente:</span> <b>${comitente}</b></div></div><p>Por medio del presente, <b>V+V Construcciones</b> presenta el presupuesto correspondiente a la ejecución de la obra <b>"${o.nombre}"</b>, con una superficie total de <b>${m2.toLocaleString("es-AR")} m²</b>, según el detalle de rubros e incidencias que se consigna a continuación. El presente documento tiene carácter de oferta formal y, una vez suscripto por las partes, constituye la aceptación del presupuesto de obra.</p><h2>Detalle por rubros</h2><table><thead><tr><th>Rubro</th><th class="ctr">Incidencia</th><th class="rgt">Monto</th></tr></thead><tbody>${rows}</tbody></table><table class="tot"><tr><td class="rgt">Superficie</td><td class="rgt">${m2.toLocaleString("es-AR")} m²</td></tr><tr><td class="rgt">Precio unitario</td><td class="rgt">${money(precio)} /m²</td></tr><tr class="big"><td class="rgt">TOTAL PRESUPUESTO</td><td class="rgt">${money(pc)}</td></tr></table><h2>Condiciones</h2><ul class="cond"><li><b>Anticipo:</b> ${o.anticipoTipo === "monto" ? money(num(o.anticipoMontoFijo)) : num(o.anticipoPct) + "% del total"} a la firma del presente, a descontar proporcionalmente de cada certificación.</li><li><b>Forma de pago:</b> saldo contra certificaciones de avance de obra.</li><li><b>Redeterminación:</b> los valores se ajustarán por el índice de la Cámara Argentina de la Construcción (CAC), tomando como mes base ${mesLabel(o.mesBase)}.</li><li><b>Validez de la oferta:</b> 15 días corridos desde la fecha.</li></ul><div class="foot">${firmaBox(fp.contratista, "Contratista · V+V Construcciones")}${firmaBox(fp.cliente, "Comitente / Propietario — Acepta el presupuesto")}</div></div></body></html>`;
    setPdfHtmlP(html);
  }
  const setRub = (i, k, v) => setForm(f => ({ ...f, rubros: f.rubros.map((r, j) => j === i ? { ...r, [k]: v } : r) }));
  const nuevo = () => ({ nombre: "", inicio: hoyISO(), mesBase: mesDe(hoyISO()), plazoMeses: "", anticipoTipo: "pct", anticipoPct: "", anticipoMontoFijo: "", imprevistosPct: "5", m2: "", precioCliente: "", costoM2: "", rubros: RUBROS_DEF.map(n => ({ id: uid(), nombre: n, pct: "" })), costoExtra: [{ id: uid(), nombre: "Impuestos / IIBB", tipo: "pct", valor: "" }] });
  function guardar() {
    if (!form.nombre?.trim()) { alert("Poné el nombre de la obra."); return; }
    if (numMoney(form.m2) <= 0 || numMoney(form.precioCliente) <= 0) { alert("Cargá los m² y el precio/m² del cliente."); return; }
    const rubros = (form.rubros || []).filter(r => r.nombre?.trim()).map(r => ({ id: r.id || uid(), nombre: r.nombre.trim(), pct: num(r.pct) }));
    if (rubros.length === 0) { alert("Cargá al menos un rubro con su % de incidencia."); return; }
    const sInc = rubros.reduce((a, r) => a + r.pct, 0);
    if (Math.abs(sInc - 100) > 0.5) { if (!confirm(`Las incidencias suman ${sInc}% (no 100%). ¿Guardar igual?`)) return; }
    const extra = (form.costoExtra || []).filter(l => l.nombre?.trim() && String(l.valor).trim() !== "").map(l => ({ id: l.id || uid(), nombre: l.nombre.trim(), tipo: l.tipo === "pct" ? "pct" : "monto", valor: l.tipo === "pct" ? num(l.valor) : numMoney(l.valor) }));
    const ob = { id: form.id || uid() + Date.now(), nombre: form.nombre.trim(), inicio: form.inicio || hoyISO(), mesBase: form.mesBase || mesDe(form.inicio || hoyISO()), anticipoTipo: form.anticipoTipo || "pct", anticipoPct: num(form.anticipoPct), anticipoMontoFijo: numMoney(form.anticipoMontoFijo), imprevistosPct: num(form.imprevistosPct), plazoMeses: num(form.plazoMeses), m2: numMoney(form.m2), precioCliente: numMoney(form.precioCliente), costoM2: numMoney(form.costoM2), rubros, costoExtra: extra };
    save(logH({ ...data, obras: form.id ? obras.map(o => o.id === ob.id ? ob : o) : [...obras, ob] }, `${form.id ? "Editó" : "Creó"} obra ${ob.nombre}`)); setForm(null);
  }
  function borrar(id) { if (!confirm("¿Eliminar esta obra y sus certificados?")) return; save({ ...data, obras: obras.filter(o => o.id !== id), certs: (data.certs || []).filter(c => c.obraId !== id) }); }
  const pCli = form ? numMoney(form.m2) * numMoney(form.precioCliente) : 0;
  const sInc = form ? (form.rubros || []).reduce((s, r) => s + num(r.pct), 0) : 0;
  const pCos = form ? numMoney(form.m2) * numMoney(form.costoM2) : 0;

  return (<div style={{ padding: "14px 16px 40px" }}>
    {!form && <button onClick={() => setForm(nuevo())} style={{ width: "100%", background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>＋ Nueva obra</button>}
    {form && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>{form.id ? "Editar obra" : "Nueva obra"}</div>
      <Field label="Nombre de la obra"><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Castores 475" style={inp} /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Metros² totales"><input value={form.m2} onChange={e => setForm({ ...form, m2: fmtMiles(e.target.value) })} inputMode="numeric" placeholder="795" style={inp} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Precio cliente $/m²"><input value={form.precioCliente} onChange={e => setForm({ ...form, precioCliente: fmtMiles(e.target.value) })} inputMode="numeric" placeholder="453.000" style={inp} /></Field></div>
      </div>
      <Field label="Costo interno $/m²" hint="Tu costo por m² (ej: 260.000). Presupuesto costo = m² × este valor."><input value={form.costoM2} onChange={e => setForm({ ...form, costoM2: fmtMiles(e.target.value) })} inputMode="numeric" placeholder="260.000" style={inp} /></Field>
      {(pCli > 0 || pCos > 0) && <div style={{ background: T.al, borderRadius: 9, padding: 10, marginBottom: 12, display: "flex", justifyContent: "space-around" }}><span style={{ fontSize: 12, color: T.sub }}>Cliente: <Money v={pCli} c={T.accent} /></span><span style={{ fontSize: 12, color: T.sub }}>Costo: <Money v={pCos} c={T.warn} /></span></div>}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Inicio"><input type="date" value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} style={inp} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Plazo (meses)"><input value={form.plazoMeses} onChange={e => setForm({ ...form, plazoMeses: e.target.value })} inputMode="numeric" placeholder="8" style={inp} /></Field></div>
      </div>
      <Field label="Anticipo">
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 5 }}>
          <div style={{ display: "flex", background: T.bg, borderRadius: 9, padding: 3, border: `1px solid ${T.border}` }}>
            {[["pct", "%"], ["monto", "$"]].map(([k, l]) => <button key={k} onClick={() => setForm({ ...form, anticipoTipo: k })} style={{ background: (form.anticipoTipo || "pct") === k ? T.navy : "transparent", color: (form.anticipoTipo || "pct") === k ? "#fff" : T.sub, border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
          </div>
          {(form.anticipoTipo || "pct") === "monto"
            ? <input value={form.anticipoMontoFijo} onChange={e => setForm({ ...form, anticipoMontoFijo: fmtMiles(e.target.value) })} inputMode="numeric" placeholder="Monto fijo $" style={{ ...inp, marginTop: 0, flex: 1 }} />
            : <input value={form.anticipoPct} onChange={e => setForm({ ...form, anticipoPct: e.target.value })} inputMode="decimal" placeholder="20 (%)" style={{ ...inp, marginTop: 0, flex: 1 }} />}
        </div>
      </Field>
      <Field label="Mes base redeterminación (CAC)" hint="Mes del índice de la oferta."><input type="month" value={form.mesBase || ""} onChange={e => setForm({ ...form, mesBase: e.target.value })} style={inp} /></Field>

      <div style={{ borderTop: `1px solid ${T.border}`, margin: "4px 0 10px", paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 3 }}>Rubros e incidencia (%)</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 9 }}>Solo el % que incide cada rubro en el total (sin monto). El monto lo calcula el certificado. Deben sumar 100%.</div>
        {(form.rubros || []).map((r, i) => (
          <div key={r.id} style={{ display: "flex", gap: 6, marginBottom: 7, alignItems: "center" }}>
            <input value={r.nombre} onChange={e => setRub(i, "nombre", e.target.value)} placeholder="Rubro" style={{ ...inpSm, flex: 1, minWidth: 0, background: T.card }} />
            <input value={r.pct} onChange={e => setRub(i, "pct", e.target.value)} inputMode="decimal" placeholder="%" style={{ ...inpSm, width: 70, textAlign: "center", background: T.card }} />
            <span style={{ fontSize: 13, color: T.sub, fontWeight: 700 }}>%</span>
            <button onClick={() => setForm(f => ({ ...f, rubros: f.rubros.filter((_, j) => j !== i) }))} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 7, padding: "9px 7px", fontSize: 11, cursor: "pointer" }}>✕</button>
          </div>))}
        <button onClick={() => setForm(f => ({ ...f, rubros: [...(f.rubros || []), { id: uid(), nombre: "", pct: "" }] }))} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 8, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 2 }}>＋ Agregar rubro</button>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 9, color: Math.abs(sInc - 100) < 0.5 ? T.ok : T.warn }}>Suma incidencias: {sInc}% {Math.abs(sInc - 100) < 0.5 ? "✓" : sInc > 100 ? "· te pasaste" : `· falta ${(100 - sInc).toFixed(1)}%`}</div>
      </div>

      {pCli > 0 && pCos > 0 && <div style={{ background: T.bg, borderRadius: 9, padding: 11, marginBottom: 12 }}>
        <Line t="Presupuesto cliente" v={money(pCli)} c={T.accent} />
        <Line t="Presupuesto costo" v={money(pCos)} c={T.warn} />
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 5, paddingTop: 5 }}><Line t={`Margen bruto (${(( pCli - pCos) / pCli * 100).toFixed(1)}%)`} v={money(pCli - pCos)} c={T.ok} /></div>
      </div>}

      <div style={{ borderTop: `1px solid ${T.border}`, margin: "4px 0 10px", paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>Otros costos (impuestos, gastos grales)</div>
        {(form.costoExtra || []).map((l, i) => (<div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          <input value={l.nombre} onChange={e => setForm(f => ({ ...f, costoExtra: f.costoExtra.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x) }))} placeholder="Concepto" style={{ ...inp, marginTop: 0, flex: 1, minWidth: 0 }} />
          <button onClick={() => setForm(f => ({ ...f, costoExtra: f.costoExtra.map((x, j) => j === i ? { ...x, tipo: x.tipo === "pct" ? "monto" : "pct" } : x) }))} style={{ background: l.tipo === "pct" ? T.warn : T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "11px 10px", fontSize: 14, fontWeight: 800, cursor: "pointer", width: 40 }}>{l.tipo === "pct" ? "%" : "$"}</button>
          <input value={l.valor} onChange={e => setForm(f => ({ ...f, costoExtra: f.costoExtra.map((x, j) => j === i ? { ...x, valor: x.tipo === "pct" ? e.target.value : fmtMiles(e.target.value) } : x) }))} inputMode="decimal" placeholder={l.tipo === "pct" ? "%" : "0"} style={{ ...inp, marginTop: 0, width: 82, textAlign: "right" }} />
          <button onClick={() => setForm(f => ({ ...f, costoExtra: f.costoExtra.filter((_, j) => j !== i) }))} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 8, padding: "11px 9px", fontSize: 12, cursor: "pointer" }}>✕</button>
        </div>))}
        <button onClick={() => setForm(f => ({ ...f, costoExtra: [...(f.costoExtra || []), { id: uid(), nombre: "", tipo: "monto", valor: "" }] }))} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 8, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>＋ Agregar costo</button>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Imprevistos (%)</span><input value={form.imprevistosPct} onChange={e => setForm({ ...form, imprevistosPct: e.target.value })} inputMode="decimal" placeholder="5" style={{ ...inp, marginTop: 0, width: 82, textAlign: "right" }} /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setForm(null)} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 9, padding: "12px", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
        <button onClick={guardar} style={{ flex: 2, background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "12px", fontWeight: 700, cursor: "pointer" }}>Guardar obra</button>
      </div>
    </div>}
    {obras.length === 0 && !form && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "30px 20px", lineHeight: 1.6 }}>No hay obras.<br />Tocá "Nueva obra".</div>}
    {obras.map(o => (<div key={o.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{o.nombre}</div><div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>{num(o.m2)} m² · {money(o.precioCliente)}/m² · {(o.rubros || []).length} rubros</div></div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setForm({ id: o.id, nombre: o.nombre, inicio: o.inicio, mesBase: o.mesBase || mesDe(o.inicio), anticipoTipo: o.anticipoTipo || "pct", anticipoPct: String(o.anticipoPct || ""), anticipoMontoFijo: o.anticipoMontoFijo ? fmtMiles(o.anticipoMontoFijo) : "", imprevistosPct: String(o.imprevistosPct != null ? o.imprevistosPct : 5), plazoMeses: o.plazoMeses ? String(o.plazoMeses) : "", m2: fmtMiles(o.m2), precioCliente: fmtMiles(o.precioCliente), costoM2: fmtMiles(o.costoM2), rubros: (o.rubros || []).map(r => ({ ...r, pct: String(r.pct) })), costoExtra: (o.costoExtra || []).map(l => ({ ...l, valor: l.tipo === "pct" ? String(l.valor) : fmtMiles(l.valor) })) })} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Editar</button>
          <button onClick={() => borrar(o.id)} style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 7, padding: "6px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>✕</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><Box t="Presupuesto costo" v={money(presupCosto(o))} c={T.warn} /><Box t="Presupuesto cliente" v={money(presupCliente(o))} c={T.accent} /></div>
      <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
        <button onClick={() => imprimirPresupuesto(o)} style={{ flex: 2, background: T.navy, color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>📄 Presupuesto PDF</button>
        <button onClick={() => setFirmandoP(o)} style={{ flex: 1, background: T.al, color: T.accent, border: "none", borderRadius: 9, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>✍️ Firmar{(o.firmasPresup?.cliente || o.firmasPresup?.contratista) ? " ✓" : ""}</button>
      </div>
    </div>))}
    {firmandoP && <FirmasModal titulo="Conformidad del presupuesto" cert={{ fecha: firmandoP.inicio, firmas: firmandoP.firmasPresup }} obra={firmandoP} onClose={() => setFirmandoP(null)} onSave={(firmas) => { save({ ...data, obras: obras.map(o => o.id === firmandoP.id ? { ...o, firmasPresup: firmas } : o) }); setFirmandoP(null); }} />}
    {pdfHtmlP && <PdfOverlay html={pdfHtmlP} onClose={() => setPdfHtmlP(null)} />}
  </div>);
}

// ═══════════ 2 y 3 · CERTIFICADOS
function CertTab({ modo, obras, data, save, certsDe, indices }) {
  const esCosto = modo === "costo";
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [nuevo, setNuevo] = useState({});
  const [fecha, setFecha] = useState(hoyISO());
  const [fechaPago, setFechaPago] = useState(() => proxViernes());
  const [firmando, setFirmando] = useState(null);
  const [pdfHtml, setPdfHtml] = useState(null);
  const obra = obras.find(o => o.id === obraId);
  const cs = obraId ? certsDe(obraId) : [];
  const ultimo = cs[cs.length - 1];
  useEffect(() => { setNuevo({}); }, [obraId]);
  const acumulado = {}; (obra?.rubros || []).forEach(r => { const ant = ultimo ? num(ultimo.cantidades?.[r.id]) : 0; acumulado[r.id] = Math.min(100, ant + num(nuevo[r.id])); });
  const certTmp = { id: "_tmp", cantidades: acumulado, fecha, ts: Date.now() + 1 };
  const preview = obra ? calcCert(certTmp, obra, cs, indices) : null;
  const det = obra ? detalleRubros(certTmp, obra, cs) : [];
  const costoPeriodo = det.reduce((s, d) => s + d.costoPeriodo, 0);

  function guardar() {
    if (!obra) return; const r = calcCert(certTmp, obra, cs, indices);
    if (r.bruto <= 0 && costoPeriodo <= 0) { alert("El avance tiene que ser mayor al del certificado anterior."); return; }
    const cert = { id: uid() + Date.now(), obraId, fecha, fechaPago, cantidades: { ...acumulado }, ts: Date.now() };
    save(logH({ ...data, certs: [...(data.certs || []), cert] }, `Certificado ${esCosto ? "costo" : "cliente"} · ${obra.nombre}`)); setNuevo({}); alert("Certificado guardado.");
  }
  function borrarCert(id) { if (confirm("¿Eliminar este certificado?")) save({ ...data, certs: (data.certs || []).filter(c => c.id !== id) }); }
  function imprimirCertificado(c) {
    const cfg = data.config || {}; const brandName = (cfg.nombre || "V+V Construcciones").toUpperCase(); const comitente = cfg.comitente || "Belfast CM"; const brandHtml = cfg.logo ? `<div class="brand" style="display:flex;align-items:center;gap:10px"><img src="${cfg.logo}" style="height:40px;width:40px;object-fit:contain;background:#fff;border-radius:7px;padding:2px"/><div>${brandName}<small>CONSTRUCTORA</small></div></div>` : `<div class="brand">${brandName}<small>CONSTRUCTORA</small></div>`;
    const r = calcCert(c, obra, cs, indices); const dd = detalleRubros(c, obra, cs).filter(d => d.per > 0);
    const certN = cs.findIndex(x => x.id === c.id) + 1;
    const cP = dd.reduce((s, d) => s + d.costoPeriodo, 0);
    const rows = dd.map(d => `<tr><td>${d.nombre}</td><td class="ctr">${(d.inc * 100).toFixed(1)}%</td><td class="ctr"><b>${d.pctAcum.toFixed(1)}%</b></td><td class="rgt">${money(esCosto ? d.costoPeriodo : d.clientePeriodo)}</td></tr>`).join("");
    const tr = (t, v, cls) => `<tr class="${cls || ""}"><td colspan="3" class="rgt">${t}</td><td class="rgt">${v}</td></tr>`;
    const resumen = esCosto ? tr("TOTAL COSTO DEL PERÍODO", money(cP), "neto") : `${tr("Certificado bruto", money(r.bruto))}${r.ajuste > 0 || r.provisorio ? tr(`Ajuste CAC (redet.)${r.provisorio ? " · provisorio" : ""}`, "+ " + money(r.ajuste)) : ""}${tr("Subtotal", money(r.ajustado))}${tr("Descuento anticipo", "− " + money(r.amort))}${tr("NETO A COBRAR", money(r.neto), "neto")}`;
    const fc = c.firmas || {};
    const firmaBox = (f, rol) => `<div style="width:230px;text-align:center">${f?.dataUrl ? `<img src="${f.dataUrl}" style="height:44px;display:block;margin:0 auto"/>` : `<div style="height:44px"></div>`}<div style="border-top:1px solid #0F1B2D;padding-top:5px;font-size:11px;color:#5B6B7F">${rol}${f?.nombre ? `<br><b style="color:#0F1B2D">${f.nombre}</b>` : ""}${f?.codigo ? `<br><span style="font-size:8.5px;color:#94A3B8">Cód. ${f.codigo} · ${f.ts || ""}</span>` : ""}</div></div>`;
    const fotos = (c.adjuntos || []).filter(a => a.tipo === "foto"); const videos = (c.adjuntos || []).filter(a => a.tipo === "video");
    const fotosHtml = fotos.length ? `<h2>Registro fotográfico de avance</h2><div style="display:flex;flex-wrap:wrap;gap:8px">${fotos.map(a => `<img src="${a.url}" style="width:31%;height:120px;object-fit:cover;border-radius:6px;border:1px solid #E3E8EF"/>`).join("")}</div>` + (videos.length ? `<div style="margin-top:8px;font-size:11px;color:#5B6B7F">Videos de avance: ${videos.map((a, i) => `<a href="${a.url}">video ${i + 1}</a>`).join(" · ")}</div>` : "") : (videos.length ? `<h2>Videos de avance</h2><div style="font-size:11px;color:#5B6B7F">${videos.map((a, i) => `<a href="${a.url}">video ${i + 1}</a>`).join(" · ")}</div>` : "");
    const totQ = quincenasObra(obra); const deY = totQ ? ` de ${totQ}` : ""; const docTit = esCosto ? `CERTIFICADO N° ${certN}${deY} · COSTO` : `CERTIFICADO N° ${certN}${deY}`;
    const secTit = esCosto ? "Rubros (costo interno)" : "Rubros certificados (incidencia sobre el total)";
    const baseP = esCosto ? presupCosto(obra) : presupCliente(obra); const acumP = esCosto ? costoAcumDe(c.cantidades, obra) : clienteAcumDe(c.cantidades, obra); const saldoP = baseP - acumP;
    const saldoHtml = baseP > 0 ? `<div style="margin-top:12px;padding:11px 13px;background:#F4F6F9;border-radius:8px;font-size:12px"><div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:#5B6B7F">Presupuesto ${esCosto ? "de costo" : "cliente"}</span><b>${money(baseP)}</b></div><div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:#5B6B7F">Certificado acumulado (${(baseP > 0 ? acumP / baseP * 100 : 0).toFixed(0)}%)</span><b>${money(acumP)}</b></div><div style="display:flex;justify-content:space-between;padding:5px 0 0;border-top:1px solid #E3E8EF;margin-top:3px"><span style="color:#0F1B2D;font-weight:700">${esCosto ? "Resta para terminar la obra" : "Resta por cobrar al cliente"}</span><b style="color:#1B3A5B">${money(saldoP)}</b></div></div>` : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Certificado ${obra.nombre}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Arial,sans-serif;color:#0F1B2D;padding:0 0 34px}.head{background:#0F1B2D;color:#fff;padding:20px 40px;border-bottom:4px solid #B0894F;display:flex;justify-content:space-between;align-items:center}.brand{font-size:22px;font-weight:800}.brand small{display:block;font-size:10px;color:#B0894F;letter-spacing:2px;margin-top:2px}.doc{text-align:right;font-size:11px;color:#cdd5e0}.doc b{display:block;font-size:15px;color:#fff}.wrap{padding:0 40px}.meta{display:flex;justify-content:space-between;margin:22px 0 6px;font-size:12.5px}.meta span{color:#5B6B7F}h2{font-size:12px;color:#5B6B7F;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;border-bottom:1px solid #E3E8EF;padding-bottom:5px}table{width:100%;border-collapse:collapse;font-size:12.5px}th{background:#EAF0F7;color:#1B3A5B;text-align:left;padding:8px 10px;font-size:10.5px;text-transform:uppercase}td{padding:8px 10px;border-bottom:1px solid #EEF1F5}.ctr{text-align:center}.rgt{text-align:right}.tot td{border:none;padding:4px 10px;font-size:13px}.tot.neto td{background:#EAF1FB;border-top:2px solid #1B3A5B;border-bottom:2px solid #1B3A5B;font-size:17px;font-weight:800;color:#1B3A5B;padding:13px 12px}.tot.neto td:first-child{border-left:2px solid #1B3A5B;border-top-left-radius:8px;border-bottom-left-radius:8px}.tot.neto td:last-child{border-right:2px solid #1B3A5B;border-top-right-radius:8px;border-bottom-right-radius:8px}.foot{display:flex;justify-content:space-between;font-size:11px;color:#5B6B7F}</style></head><body><div class="head">${brandHtml}<div class="doc"><b>${docTit}</b>Fecha: ${fmtISO(c.fecha)}</div></div><div class="wrap"><div class="meta"><div><span>Obra:</span> <b>${obra.nombre}</b></div><div><span>Comitente:</span> <b>${comitente}</b></div></div><h2>${secTit}</h2><table><thead><tr><th>Rubro</th><th class="ctr">Incid.</th><th class="ctr">Avance</th><th class="rgt">Importe</th></tr></thead><tbody>${rows}</tbody></table><h2>Resumen</h2><table class="tot">${resumen}</table><div style="margin-top:14px;font-size:12px;color:#5B6B7F">Pago: <b style="color:#0F1B2D">${fmtISO(c.fechaPago)}</b></div>${saldoHtml}${fotosHtml}<div class="foot" style="margin-top:44px">${firmaBox(fc.contratista, "Contratista · V+V Construcciones")}${firmaBox(fc.cliente, "Cliente · " + comitente)}</div></div></body></html>`;
    setPdfHtml(html);
  }

  if (obras.length === 0) return <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "40px 20px" }}>Primero cargá una obra en <b>Presupuesto</b>.</div>;
  return (<div style={{ padding: "14px 16px 40px" }}>
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3 }}>Certificar {esCosto ? "· costo interno" : "· al cliente"}</div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>Cargás una vez el % de avance por rubro; sirve para los dos certificados.</div>
      <Field label="Obra"><select value={obraId} onChange={e => setObraId(e.target.value)} style={inp}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select></Field>
      {(obra?.rubros || []).length > 0 && <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Avance por rubro</div>
          <button onClick={() => { if (confirm("¿Certificar el cierre? Completa el avance nuevo para llegar al 100%.")) { const nc = {}; (obra.rubros || []).forEach(r => { const ant = ultimo ? num(ultimo.cantidades?.[r.id]) : 0; nc[r.id] = Math.max(0, 100 - ant); }); setNuevo(nc); } }} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 7, padding: "5px 9px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>Cierre 100%</button>
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 9 }}>Escribí solo el <b>% NUEVO</b> de este certificado. El acumulado se suma solo y cobrás únicamente lo nuevo.</div>
        <div style={{ display: "flex", gap: 6, fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase", padding: "0 2px 3px" }}><span style={{ flex: 1 }}>Rubro</span><span style={{ width: 52, textAlign: "center" }}>Anterior</span><span style={{ width: 58, textAlign: "center" }}>Nuevo</span><span style={{ width: 54, textAlign: "center" }}>Acum.</span></div>
        {(obra.rubros || []).map(r => { const inc = incidencia(obra, r) * 100; const ant = ultimo ? num(ultimo.cantidades?.[r.id]) : 0; const nv = num(nuevo[r.id]); const acum = Math.min(100, ant + nv); const val = esCosto ? (nv / 100) * incidencia(obra, r) * presupCosto(obra) : (nv / 100) * incidencia(obra, r) * presupCliente(obra);
          return (<div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nombre}</div><div style={{ fontSize: 10, color: T.muted }}>incid. {inc.toFixed(1)}%{nv > 0 ? ` = ${money(val)}` : ""}</div></div>
            <span style={{ width: 52, textAlign: "center", fontSize: 13, fontWeight: 700, color: T.sub }}>{ant}%</span>
            <div style={{ width: 58, display: "flex", alignItems: "center", gap: 1, justifyContent: "center" }}><input value={nuevo[r.id] ?? ""} onChange={e => setNuevo(a => ({ ...a, [r.id]: e.target.value }))} inputMode="decimal" placeholder="0" style={{ ...inp, marginTop: 0, width: 44, textAlign: "center", padding: "10px 2px" }} /><span style={{ fontSize: 11, color: T.sub }}>%</span></div>
            <span style={{ width: 54, textAlign: "center", fontSize: 13, fontWeight: 800, color: acum > ant ? T.accent : T.muted }}>{acum}%</span>
          </div>); })}
        {(() => { const base = esCosto ? presupCosto(obra) : presupCliente(obra); const ya = ultimo ? (esCosto ? costoAcumDe(ultimo.cantidades, obra) : clienteAcumDe(ultimo.cantidades, obra)) : 0; const saldo = base - ya; const avance = base > 0 ? ya / base * 100 : 0; const antic = anticipoDe(obra); const amortYa = cs.reduce((s, cc) => s + calcCert(cc, obra, cs, indices).amort, 0); const dispAnt = antic - amortYa; return base > 0 ? <div style={{ background: T.bg, borderRadius: 9, padding: "10px 11px", marginTop: 4, fontSize: 11.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}><span style={{ color: T.sub }}>Presupuesto {esCosto ? "de costo" : "cliente"}</span><b>{money(base)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}><span style={{ color: T.sub }}>Ya certificado ({avance.toFixed(0)}%)</span><b>{money(ya)}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0 0", borderTop: `1px solid ${T.border}`, marginTop: 3 }}><span style={{ color: T.text, fontWeight: 700 }}>{esCosto ? "Resta para terminar la obra" : "Resta por cobrar al cliente"}</span><b style={{ color: esCosto ? T.warn : T.accent }}>{money(saldo)}</b></div>
          {!esCosto && antic > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 0", borderTop: `1px solid ${T.border}`, marginTop: 5 }}><span style={{ color: T.text, fontWeight: 700 }}>Anticipo disponible</span><b style={{ color: T.ok }}>{money(dispAnt)}</b></div>}
          {!esCosto && antic > 0 && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>Adelanto {obra.anticipoTipo === "monto" ? "(monto fijo)" : num(obra.anticipoPct) + "%"}: {money(antic)} · amortizado {money(amortYa)}</div>}
        </div> : null; })()}
      </div>}
      {!esCosto && <IndicesPanel data={data} save={save} obra={obra} fecha={fecha} indices={indices} />}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Paga (viernes)"><input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} style={inp} /></Field></div>
      </div>
      {preview && (esCosto ? costoPeriodo > 0 : preview.bruto > 0) && <div style={{ background: T.al, borderRadius: 11, padding: 13, margin: "4px 0 14px" }}>
        {esCosto ? <><div style={{ fontSize: 10, fontWeight: 800, color: T.warn, letterSpacing: "0.06em", marginBottom: 4 }}>CERTIFICADO DE COSTO</div>
          {det.filter(d => d.per > 0).map((d, i) => <Line key={i} t={`${d.nombre} (${d.pctAcum.toFixed(0)}%)`} v={money(d.costoPeriodo)} />)}
          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 5, paddingTop: 6, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 800 }}>Total costo directo</span><Money v={costoPeriodo} c={T.warn} /></div></>
          : <><div style={{ fontSize: 10, fontWeight: 800, color: T.accent, letterSpacing: "0.06em", marginBottom: 4 }}>CERTIFICADO AL CLIENTE</div>
          {det.filter(d => d.per > 0).map((d, i) => <Line key={i} t={`${d.nombre} · incid ${(d.inc * 100).toFixed(0)}% (${d.pctAcum.toFixed(0)}%)`} v={money(d.clientePeriodo)} />)}
          <div style={{ borderTop: `1px solid ${T.border}`, margin: "5px 0", paddingTop: 6 }}><Line t="Bruto" v={money(preview.bruto)} />{(preview.ajuste > 0 || preview.provisorio) && <Line t={`Ajuste CAC${preview.provisorio ? " · prov." : ""}`} v={"+ " + money(preview.ajuste)} c={T.ok} />}<Line t="Descuento anticipo" v={"− " + money(preview.amort)} c="#B45309" /></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: `${T.accent}1A`, border: `1.5px solid ${T.accent}`, borderRadius: 10, padding: "11px 13px", marginTop: 8 }}><span style={{ fontSize: 13.5, fontWeight: 800, color: T.accent }}>Neto a cobrar</span><span style={{ fontSize: 17, fontWeight: 800, color: T.accent, fontVariantNumeric: "tabular-nums" }}>{money(preview.neto)}</span></div></>}
      </div>}
      {preview && obra && (esCosto ? costoPeriodo <= 0 : preview.bruto <= 0) && <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9, padding: 11, fontSize: 12, color: "#92400E", margin: "4px 0 14px" }}>Este certificado da $0. Para el 2° certificado y siguientes, subí el % acumulado de algún rubro por encima del certificado anterior (o usá "Cierre 100%").</div>}
      <button onClick={guardar} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Guardar certificado</button>
    </div>
    {cs.length > 0 && <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 8px" }}>Certificados de {obra?.nombre}</div>
      {cs.slice().reverse().map(c => { const r = calcCert(c, obra, cs, indices); const cP = detalleRubros(c, obra, cs).reduce((s, d) => s + d.costoPeriodo, 0); return (
        <div key={c.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 9, boxShadow: SHDsm }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 800, color: esCosto ? T.warn : T.accent }}>{esCosto ? money(cP) : money(r.neto)}{(c.firmas?.cliente || c.firmas?.contratista) ? <span style={{ fontSize: 10, fontWeight: 700, color: T.ok, marginLeft: 6 }}>✓ conforme</span> : null}</div><div style={{ fontSize: 11, color: T.sub }}>Cert. N° {cs.findIndex(x => x.id === c.id) + 1}{quincenasObra(obra) ? ` de ${quincenasObra(obra)}` : ""} · {fmtISO(c.fecha)}</div></div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => setFirmando(c)} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 7, padding: "6px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✍️</button>
              <button onClick={() => imprimirCertificado(c)} style={{ background: T.navy, color: "#fff", border: "none", borderRadius: 7, padding: "6px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📄 PDF</button>
              <button onClick={() => borrarCert(c.id)} style={{ background: "none", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 7, padding: "6px 9px", fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>
          </div>
          <AdjuntosCert cert={c} data={data} save={save} />
        </div>); })}
    </div>}
    {firmando && <FirmasModal cert={firmando} obra={obras.find(o => o.id === firmando.obraId)} onClose={() => setFirmando(null)} onSave={(firmas) => { save({ ...data, certs: (data.certs || []).map(c => c.id === firmando.id ? { ...c, firmas } : c) }); setFirmando(null); }} />}
    {pdfHtml && <PdfOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
  </div>);
}

// ═══════════ CAC mensual (%)
function AddMesIndice({ onAdd }) {
  const [m, setM] = useState(""); const [v, setV] = useState("");
  return <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
    <input type="month" value={m} onChange={e => setM(e.target.value)} style={{ ...inp, marginTop: 0, flex: 1 }} />
    <input value={v} onChange={e => setV(e.target.value)} inputMode="decimal" placeholder="% CAC" style={{ ...inp, marginTop: 0, width: 100, textAlign: "right" }} />
    <button onClick={() => { if (m && v) { onAdd(m, v); setM(""); setV(""); } }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "11px 12px", fontWeight: 700, cursor: "pointer" }}>＋</button>
  </div>;
}
function IndicesPanel({ data, save, obra, fecha, indices }) {
  const [open, setOpen] = useState(false);
  const mesCert = mesDe(fecha);
  const rr = cacRate(mesCert, indices);
  const pctMes = (indices || {})[mesCert];
  const setIndice = (mes, valor) => { const next = { ...(data.cacMensual || {}) }; if (String(valor).trim() === "") delete next[mes]; else next[mes] = num(valor); save({ ...data, cacMensual: next }); };
  const meses = Array.from(new Set([...Object.keys(indices || {}), obra?.mesBase, mesCert].filter(Boolean))).sort();
  return (<div style={{ background: T.al, borderRadius: 11, padding: 12, marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 10.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: "0.04em" }}>Redeterminación CAC</div>
        {rr.provisorio
          ? <div style={{ fontSize: 11.5, color: T.warn, marginTop: 3, fontWeight: 600 }}>Falta el CAC de {mesLabel(mesCert)} · provisorio (0%). Cargalo cuando salga.</div>
          : <div style={{ fontSize: 12.5, marginTop: 3 }}>CAC {mesLabel(mesCert)}: <b>{num(pctMes).toFixed(2)}%</b> · por quincena <b style={{ color: T.ok }}>{(rr.rate * 100).toFixed(4)}%</b></div>}
      </div>
      <button onClick={() => setOpen(o => !o)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 700, color: T.accent, cursor: "pointer", flexShrink: 0 }}>{open ? "Cerrar" : "CAC %"}</button>
    </div>
    {open && <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>Cargá el % del CAC de cada mes cuando sale (ej: 3). Se aplica dividido en las dos quincenas (√ compuesto) sobre el saldo pendiente. Si falta el mes actual, va provisorio en 0% y recalcula al cargarlo.</div>
      {meses.map(m => { const r2 = cacRate(m, indices); return <div key={m} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{mesLabel(m)}{m === mesCert ? " · este cert" : ""}{!r2.provisorio ? <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 400 }}> · quinc. {(r2.rate * 100).toFixed(3)}%</span> : ""}</span>
        <input defaultValue={indices[m] ?? ""} onBlur={e => setIndice(m, e.target.value)} inputMode="decimal" placeholder="% CAC" style={{ ...inp, marginTop: 0, width: 92, textAlign: "right" }} /><span style={{ fontSize: 12, color: T.sub }}>%</span>{indices[m] != null && <button onClick={() => setIndice(m, "")} style={{ background: "none", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>}
      </div>; })}
      <AddMesIndice onAdd={setIndice} />
    </div>}
  </div>);
}

// ═══════════ Firma con el dedo
function SignaturePad({ value, onChange }) {
  const ref = useRef(null); const drawing = useRef(false);
  useEffect(() => { const c = ref.current; if (!c) return; const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height); img.src = value; } }, []);
  const pos = (e) => { const c = ref.current, r = c.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) }; };
  const start = (e) => { e.preventDefault(); drawing.current = true; const ctx = ref.current.getContext("2d"), p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.strokeStyle = "#0F1B2D"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current.getContext("2d"), p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const end = () => { if (!drawing.current) return; drawing.current = false; try { onChange(ref.current.toDataURL("image/png")); } catch { } };
  const clear = () => { const c = ref.current, ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); onChange(""); };
  return (<div><canvas ref={ref} width={520} height={150} onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={{ width: "100%", height: 120, border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", touchAction: "none", display: "block" }} />
    <button onClick={clear} style={{ background: "none", border: "none", color: T.muted, fontSize: 11.5, marginTop: 3, cursor: "pointer", textDecoration: "underline" }}>Limpiar</button></div>);
}
function genCodigo(fecha) { return "VV-" + String(fecha || hoyISO()).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function ConfigModal({ data, save, onClose }) {
  const cfg = data.config || {};
  const [subiendo, setSubiendo] = useState(false);
  const [subiendoFondo, setSubiendoFondo] = useState(false);
  const setCfg = (k, v) => save({ ...data, config: { ...(data.config || {}), [k]: v } });
  async function subirLogo(e) { const f = e.target.files && e.target.files[0]; if (!f) return; setSubiendo(true); const url = await subirArchivo(f); if (url) setCfg("logo", url); else alert("No se pudo subir. Revisá la conexión."); setSubiendo(false); e.target.value = ""; }
  async function subirFondo(e) { const f = e.target.files && e.target.files[0]; if (!f) return; setSubiendoFondo(true); const url = await subirArchivo(f); if (url) { save({ ...data, config: { ...(data.config || {}), fondoUrl: url, fondo: "" } }); } else alert("No se pudo subir. Revisá la conexión."); setSubiendoFondo(false); e.target.value = ""; }
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(11,22,34,.55)", zIndex: 450, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", padding: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3, letterSpacing: "-0.01em" }}>Personalización</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>Cambiá el logo y los datos que aparecen en la app y en los PDF.</div>
      <Field label="Logo de la empresa">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <div style={{ width: 60, height: 60, borderRadius: 13, background: cfg.logo ? "#fff" : `linear-gradient(145deg, ${BRASS}, #c9a869)`, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>{cfg.logo ? <img src={cfg.logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 15, fontWeight: 800, color: T.navy }}>V+V</span>}</div>
          <label style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{subiendo ? "Subiendo…" : cfg.logo ? "Cambiar logo" : "Subir logo"}<input type="file" accept="image/*" onChange={subirLogo} style={{ display: "none" }} /></label>
          {cfg.logo && <button onClick={() => setCfg("logo", "")} style={{ background: "none", border: `1px solid #FECACA`, color: "#EF4444", borderRadius: 9, padding: "10px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Quitar</button>}
        </div>
      </Field>
      <Field label="Nombre de la empresa"><input defaultValue={cfg.nombre ?? ""} onBlur={e => setCfg("nombre", e.target.value)} placeholder="V+V Construcciones" style={inp} /></Field>
      <Field label="Subtítulo"><input defaultValue={cfg.subtitulo ?? ""} onBlur={e => setCfg("subtitulo", e.target.value)} placeholder="Finanzas y Certificaciones" style={inp} /></Field>
      <Field label="Comitente (aparece en los PDF)"><input defaultValue={cfg.comitente ?? ""} onBlur={e => setCfg("comitente", e.target.value)} placeholder="Belfast CM" style={inp} /></Field>
      <Field label="Modo de color">
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {[["claro", "☀︎ Claro"], ["oscuro", "🌙 Oscuro"]].map(([k, l]) => <button key={k} onClick={() => setCfg("modo", k)} style={{ flex: 1, background: (cfg.modo || "claro") === k ? T.accent : T.al, color: (cfg.modo || "claro") === k ? "#fff" : T.sub, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
        </div>
      </Field>
      <Field label="Tipografía">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 6 }}>
          {FUENTES.map(([k, l, fam]) => <button key={k} onClick={() => setCfg("fuente", k)} style={{ background: (cfg.fuente || "") === k ? T.accent : T.al, color: (cfg.fuente || "") === k ? "#fff" : T.text, border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 13px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: fam }}>{l}</button>)}
        </div>
      </Field>
      <Field label="Fondo de pantalla">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {(cfg.modo === "oscuro" ? FONDOS_DARK : FONDOS).map(([k, l, bg]) => { const sel = cfg.modo === "oscuro" ? (cfg.fondoDark || "") === k : (cfg.fondo || "") === k; return <button key={k} onClick={() => save({ ...data, config: { ...(data.config || {}), [cfg.modo === "oscuro" ? "fondoDark" : "fondo"]: k, fondoUrl: "" } })} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 50, height: 50, borderRadius: 11, background: bg, border: `2px solid ${sel && !cfg.fondoUrl ? BRASS : T.border}` }} />
            <span style={{ fontSize: 10.5, color: T.sub, fontWeight: 600 }}>{l}</span>
          </button>; })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          {cfg.fondoUrl && <div style={{ width: 52, height: 52, borderRadius: 11, background: `url("${cfg.fondoUrl}") center/cover`, border: `2px solid ${BRASS}`, flexShrink: 0 }} />}
          <label style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{subiendoFondo ? "Subiendo…" : cfg.fondoUrl ? "Cambiar foto" : "Subir foto de fondo"}<input type="file" accept="image/*" onChange={subirFondo} style={{ display: "none" }} /></label>
          {cfg.fondoUrl && <button onClick={() => setCfg("fondoUrl", "")} style={{ background: "none", border: `1px solid #FECACA`, color: "#EF4444", borderRadius: 9, padding: "10px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Quitar</button>}
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>La foto se ve suave de fondo para no molestar la lectura. Las tarjetas quedan siempre legibles.</div>
      </Field>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Respaldo de datos</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>Tus datos ya se guardan solos en la nube. Igual podés descargar copias por las dudas.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => exportarExcel(data)} style={{ flex: "1 1 45%", background: "#1D6F42", color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Descargar Excel</button>
          <button onClick={() => descargarArchivo(`VV-Finanzas-RESPALDO-${hoyISO()}.json`, JSON.stringify(data, null, 2), "application/json")} style={{ flex: "1 1 45%", background: T.navy, color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Respaldo completo</button>
        </div>
        <label style={{ display: "block", textAlign: "center", background: T.al, color: T.accent, border: `1px dashed ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Restaurar desde respaldo (.json)<input type="file" accept=".json,application/json" onChange={async e => { const f = e.target.files && e.target.files[0]; if (!f) return; try { const txt = await f.text(); const obj = JSON.parse(txt); if (!obj || typeof obj !== "object") throw new Error("Archivo inválido"); if (confirm("Esto REEMPLAZA todos los datos actuales por los del respaldo. ¿Continuar?")) { save(obj); alert("Respaldo restaurado ✓"); } } catch (err) { alert("No se pudo restaurar: " + (err && err.message)); } e.target.value = ""; }} style={{ display: "none" }} /></label>
        <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>El "Excel" (.xlsx) sale con una hoja por modelo (Obras cliente, Certificados, Movimientos, Gastos, Sociedad, Particulares, Edificios, Presupuestos), igual que la app. El "Respaldo completo" (.json) es el que sirve para restaurar todo exacto si perdés el acceso — guardalo en tu mail o en Archivos.</div>
      </div>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Otras apps de V+V</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[["mi-asistente.html", "🤖 Mi Asistente"], ["index.html", "🏗 V+V"], ["cliente.html", "👤 Cliente"], ["contratista.html", "🧰 Contratista"], ["nicolas.html", "📋 Nicolás"]].map(([href, l]) => <a key={href} href={href} style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>{l}</a>)}
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 7 }}>Se abren en la misma ventana. Mi Asistente ya ve estas finanzas para responderte por plata.</div>
      </div>
      <button onClick={onClose} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 11, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>Listo</button>
    </div>
  </div>);
}
function PdfOverlay({ html, onClose }) {
  const ref = useRef(null); const [gen, setGen] = useState(false);
  const imprimir = () => { try { const w = ref.current && ref.current.contentWindow; if (w) { w.focus(); w.print(); } } catch { alert("No se pudo abrir la impresión."); } };
  async function compartirWA() {
    setGen(true);
    try {
      const win = ref.current && ref.current.contentWindow, doc = ref.current && ref.current.contentDocument;
      if (!win || !doc) throw new Error("preview no lista");
      if (!win.html2pdf) { await new Promise((res, rej) => { const s = doc.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"; s.onload = res; s.onerror = () => rej(new Error("no se pudo cargar el generador")); doc.head.appendChild(s); }); }
      const opt = { margin: 6, image: { type: "jpeg", quality: 0.95 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } };
      const blob = await win.html2pdf().set(opt).from(doc.body).outputPdf("blob");
      const file = new File([blob], "VV-reporte.pdf", { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Reporte V+V" }); }
      else { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "VV-reporte.pdf"; document.body.appendChild(a); a.click(); setTimeout(() => { try { a.remove(); } catch { } URL.revokeObjectURL(url); }, 1500); }
    } catch (e) { if (!(e && e.name === "AbortError")) alert('No pude generar el PDF para compartir directo (a veces pasa por las fotos). Usá "Guardar / Imprimir" y desde ahí tocá Compartir → WhatsApp o Guardar en Archivos.'); }
    setGen(false);
  }
  return (<div style={{ position: "fixed", inset: 0, background: "#0F1B2D", zIndex: 500, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: T.navy, borderBottom: `1px solid rgba(255,255,255,.1)`, alignItems: "center" }}>
      <button onClick={onClose} style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕</button>
      <button onClick={imprimir} style={{ background: BRASS, color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Guardar / Imprimir</button>
      <div style={{ flex: 1 }} />
      <button onClick={compartirWA} disabled={gen} style={{ background: gen ? "rgba(37,211,102,.5)" : "#25D366", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: gen ? "default" : "pointer" }}>{gen ? "Generando…" : "WhatsApp"}</button>
    </div>
    <iframe ref={ref} srcDoc={html} title="pdf" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
  </div>);
}
function AdjuntosCert({ cert, data, save }) {
  const [subiendo, setSubiendo] = useState(false);
  const adj = cert.adjuntos || [];
  async function onFiles(e) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setSubiendo(true); const nuevos = [];
    for (const f of files) { const url = await subirArchivo(f); if (url) nuevos.push({ url, tipo: (f.type || "").startsWith("video") ? "video" : "foto", ts: Date.now() }); }
    if (nuevos.length) save({ ...data, certs: (data.certs || []).map(c => c.id === cert.id ? { ...c, adjuntos: [...(c.adjuntos || []), ...nuevos] } : c) });
    setSubiendo(false); e.target.value = "";
  }
  function quitar(url) { if (!confirm("¿Quitar este archivo?")) return; save({ ...data, certs: (data.certs || []).map(c => c.id === cert.id ? { ...c, adjuntos: (c.adjuntos || []).filter(a => a.url !== url) } : c) }); }
  return (<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9, alignItems: "center" }}>
    {adj.map((a, i) => (<div key={i} style={{ position: "relative", width: 52, height: 52 }}>
      {a.tipo === "video" ? <video src={a.url} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 7, border: `1px solid ${T.border}` }} /> : <img src={a.url} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 7, border: `1px solid ${T.border}` }} />}
      {a.tipo === "video" && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", textShadow: "0 1px 3px #000", pointerEvents: "none" }}>▶</span>}
      <button onClick={() => quitar(a.url)} style={{ position: "absolute", top: -6, right: -6, background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, lineHeight: "18px", cursor: "pointer", padding: 0 }}>✕</button>
    </div>))}
    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, background: T.al, color: T.accent, border: `1px dashed ${T.border}`, borderRadius: 8, padding: "8px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{subiendo ? "Subiendo…" : "📷 Foto/Video"}<input type="file" accept="image/*,video/*" multiple onChange={onFiles} style={{ display: "none" }} /></label>
  </div>);
}
function FirmasModal({ cert, obra, onClose, onSave, titulo }) {
  const f0 = cert.firmas || {};
  const [cliNom, setCliNom] = useState(f0.cliente?.nombre || ""); const [cliImg, setCliImg] = useState(f0.cliente?.dataUrl || "");
  const [conNom, setConNom] = useState(f0.contratista?.nombre || ""); const [conImg, setConImg] = useState(f0.contratista?.dataUrl || "");
  function guardar() { const stamp = new Date().toLocaleString("es-AR"); const firmas = { ...(cert.firmas || {}) }; if (cliNom.trim() && cliImg) firmas.cliente = { nombre: cliNom.trim(), dataUrl: cliImg, ts: stamp, codigo: f0.cliente?.codigo || genCodigo(cert.fecha) }; if (conNom.trim() && conImg) firmas.contratista = { nombre: conNom.trim(), dataUrl: conImg, ts: stamp, codigo: f0.contratista?.codigo || genCodigo(cert.fecha) }; onSave(firmas); }
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(15,27,45,.55)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "16px 16px 0 0", padding: 18, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 3 }}>{titulo || "Conformidad del certificado"}</div>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 16 }}>{obra?.nombre} · {fmtISO(cert.fecha)}. Cada parte firma con el dedo. Queda con fecha/hora y código.</div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.sub, textTransform: "uppercase", marginBottom: 6 }}>Cliente (Belfast)</div>
        <input type="text" value={cliNom} onChange={e => setCliNom(e.target.value)} placeholder="Nombre y apellido del responsable" style={{ ...inp, marginTop: 0, marginBottom: 7 }} />
        <SignaturePad value={cliImg} onChange={setCliImg} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.sub, textTransform: "uppercase", marginBottom: 6 }}>Contratista (V+V)</div>
        <input type="text" value={conNom} onChange={e => setConNom(e.target.value)} placeholder="Nombre y apellido del responsable" style={{ ...inp, marginTop: 0, marginBottom: 7 }} />
        <SignaturePad value={conImg} onChange={setConImg} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={onClose} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 9, padding: "13px", fontWeight: 700, cursor: "pointer" }}>Cerrar</button>
        <button onClick={guardar} style={{ flex: 2, background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "13px", fontWeight: 700, cursor: "pointer" }}>Guardar conformidad</button>
      </div>
    </div>
  </div>);
}

// ═══════════ 4 · RESULTADO (PIN)
function CajaTab({ obras, data, save, certs, certsDe, indices }) {
  const [tipo, setTipo] = useState("cobro");
  const [obraId, setObraId] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [cat, setCat] = useState(CAT_GASTO[0]);
  const [nota, setNota] = useState("");
  const [verHist, setVerHist] = useState(false);
  const movs = data.movimientos || [], gastos = data.gastos || [];
  const nombreObra = (id) => obras.find(o => o.id === id)?.nombre || "General";
  const cobros = movs.filter(m => m.tipo === "cobro").reduce((s, m) => s + num(m.monto), 0);
  const pagos = movs.filter(m => m.tipo === "pago").reduce((s, m) => s + num(m.monto), 0);
  const gastosTot = gastos.reduce((s, g) => s + num(g.monto), 0);
  const saldo = cobros - pagos - gastosTot;
  const totImprev = (certs || []).reduce((s, c) => { const o = obras.find(x => x.id === c.obraId); if (!o) return s; return s + calcCert(c, o, certsDe(c.obraId), indices).imprevPeriodo; }, 0);
  const usadoImprev = gastos.filter(g => esImprev(g.cat)).reduce((s, g) => s + num(g.monto), 0);
  const saldoImprev = totImprev - usadoImprev;
  function registrar() {
    const mm = numMoney(monto); if (!mm) { alert("Poné un monto."); return; }
    const base = { id: uid() + Date.now(), obraId, monto: mm, fecha, nota: nota.trim(), ts: Date.now() };
    if (tipo === "gasto") save(logH({ ...data, gastos: [...gastos, { ...base, cat }] }, `Gasto ${cat} · ${nombreObra(obraId)} · ${money(mm)}`));
    else save(logH({ ...data, movimientos: [...movs, { ...base, tipo }] }, `${tipo === "cobro" ? "Cobro" : "Pago"} · ${nombreObra(obraId)} · ${money(mm)}`));
    setMonto(""); setNota("");
  }
  function borrarMov(id) { if (confirm("¿Eliminar?")) save(logH({ ...data, movimientos: movs.filter(m => m.id !== id) }, "Borró movimiento")); }
  function borrarGasto(id) { if (confirm("¿Eliminar?")) save(logH({ ...data, gastos: gastos.filter(g => g.id !== id) }, "Borró gasto")); }
  function setObraGasto(id, oid) { save(logH({ ...data, gastos: gastos.map(g => g.id === id ? { ...g, obraId: oid } : g) }, `Asignó gasto a ${nombreObra(oid)}`)); }
  const items = [...movs.map(m => ({ ...m, kind: m.tipo })), ...gastos.map(g => ({ ...g, kind: "gasto" }))].sort((a, b) => b.ts - a.ts).slice(0, 40);
  const hist = (data.historial || []).slice().reverse();
  const colorDe = (k) => k === "cobro" ? T.ok : "#EF4444";
  const signo = (k) => k === "cobro" ? "+ " : "− ";
  return (<div style={{ padding: "14px 16px 40px" }}>
    <div style={{ background: `linear-gradient(155deg, #14263E 0%, ${T.navy} 68%)`, color: "#fff", borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: SHD, border: `1px solid rgba(176,137,79,.28)` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, letterSpacing: "0.1em", textTransform: "uppercase" }}>Saldo de caja real</div>
      <div style={{ fontSize: 30, fontWeight: 800, margin: "6px 0 4px", color: saldo >= 0 ? "#7DE0A6" : "#FCA5A5" }}>{money(saldo)}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)" }}>Plata que entró menos lo que salió (pagos + gastos).</div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.12)" }}>
        <div><div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase" }}>Cobré</div><div style={{ fontSize: 14, fontWeight: 800 }}>{money(cobros)}</div></div>
        <div><div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase" }}>Pagué</div><div style={{ fontSize: 14, fontWeight: 800, color: "#FCA5A5" }}>{money(pagos)}</div></div>
        <div><div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase" }}>Gastos</div><div style={{ fontSize: 14, fontWeight: 800, color: "#FCA5A5" }}>{money(gastosTot)}</div></div>
      </div>
    </div>
    {obras.length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 14, borderTop: `3px solid ${BRASS}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 10 }}>Fondo de imprevistos</div>
      <Line t="Acumulado (5% del presupuesto)" v={money(totImprev)} c={T.accent} />
      <Line t="Usado (seguros, multas…)" v={"− " + money(usadoImprev)} c={T.warn} />
      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 800 }}>Resto disponible</span><Money v={saldoImprev} c={saldoImprev >= 0 ? T.ok : "#EF4444"} /></div>
      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Para usar el fondo, cargá un gasto y elegí un tipo del grupo "Imprevisto (fondo)" abajo. El detalle por obra está en Resultados.</div>
    </div>}
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["cobro", "＋ Cobro"], ["pago", "− Pago"], ["gasto", "Gasto obra"]].map(([k, l]) => <button key={k} onClick={() => setTipo(k)} style={{ flex: 1, background: tipo === k ? T.navy : T.bg, color: tipo === k ? "#fff" : T.sub, border: "none", borderRadius: 8, padding: "9px 4px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
      </div>
      <Field label="Obra"><select value={obraId} onChange={e => setObraId(e.target.value)} style={inp}><option value="">General (sin obra)</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select></Field>
      {tipo === "gasto" && <Field label="Tipo de gasto"><select value={cat} onChange={e => setCat(e.target.value)} style={inp}><optgroup label="Gasto de obra">{CAT_GASTO.map(c => <option key={c} value={c}>{c}</option>)}</optgroup><optgroup label="Imprevisto (fondo)">{IMPREV_CATS.map(c => <option key={c} value={c}>{c}</option>)}</optgroup></select></Field>}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Monto"><input value={monto} onChange={e => setMonto(fmtMiles(e.target.value))} inputMode="numeric" placeholder="0" style={inp} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Fecha"><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} /></Field></div>
      </div>
      <Field label="Nota (opcional)"><input value={nota} onChange={e => setNota(e.target.value)} placeholder={tipo === "pago" ? "Proveedor / personal…" : "Detalle…"} style={inp} /></Field>
      <button onClick={registrar} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>Registrar</button>
    </div>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>Últimos movimientos</div>
    {items.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "16px" }}>Todavía no cargaste movimientos.</div>}
    {items.map(it => (<div key={it.id} style={{ background: T.card, border: `1px solid ${it.kind === "gasto" && !it.obraId ? "rgba(180,83,9,.45)" : T.border}`, borderRadius: 13, padding: "11px 13px", marginBottom: 8, boxShadow: SHDsm, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.kind === "cobro" ? "Cobro" : it.kind === "pago" ? "Pago" : it.cat}{it.kind !== "gasto" && <span style={{ fontSize: 11, fontWeight: 500, color: T.sub }}> · {nombreObra(it.obraId)}</span>}</div>
        <div style={{ fontSize: 11, color: T.muted }}>{fmtISO(it.fecha)}{it.nota ? ` · ${it.nota}` : ""}</div>
        {it.kind === "gasto" && obras.length > 0 && <select value={it.obraId || ""} onChange={e => setObraGasto(it.id, e.target.value)} style={{ ...inpSm, marginTop: 6, width: "100%", boxSizing: "border-box", fontWeight: 700, color: it.obraId ? T.accent : T.warn, borderColor: it.obraId ? T.border : "rgba(180,83,9,.5)" }}><option value="">⚠ Asignar obra…</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}><span style={{ fontSize: 13, fontWeight: 800, color: colorDe(it.kind) }}>{signo(it.kind)}{money(num(it.monto))}</span><button onClick={() => it.kind === "gasto" ? borrarGasto(it.id) : borrarMov(it.id)} style={{ background: "none", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 6, padding: "4px 7px", fontSize: 10, cursor: "pointer" }}>✕</button></div>
    </div>))}
    <button onClick={() => setVerHist(v => !v)} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: T.muted, fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>{verHist ? "Ocultar" : "Ver"} historial de actividad</button>
    {verHist && <div style={{ marginTop: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
      {hist.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>Sin actividad registrada.</div>}
      {hist.slice(0, 60).map(h => <div key={h.id} style={{ fontSize: 11, color: T.sub, padding: "3px 0", borderBottom: `1px solid ${T.bg}` }}><span style={{ color: T.muted }}>{h.t}</span> — {h.accion}</div>)}
    </div>}
  </div>);
}

// ═══════════ Gráficos (SVG propio, sin librerías)
function Donut({ segs, size = 150, thickness = 20, centro, centroSub }) {
  const r = (size - thickness) / 2, C = 2 * Math.PI * r;
  const total = segs.reduce((s, x) => s + Math.max(0, x.value), 0) || 1; let acc = 0;
  return (<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.bg} strokeWidth={thickness} />
      {segs.map((s, i) => { const len = Math.max(0, s.value) / total * C; const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />; acc += len; return el; })}
    </g>
    {centro && <text x="50%" y="49%" textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="800" fill={T.text}>{centro}</text>}
    {centroSub && <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fill={T.muted}>{centroSub}</text>}
  </svg>);
}
function BarsH({ items }) {
  const max = Math.max(1, ...items.map(i => Math.abs(i.value)));
  return (<div>{items.map((it, i) => (<div key={i} style={{ marginBottom: 9 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}><span style={{ color: T.sub, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span><span style={{ fontWeight: 800, color: it.color || T.text, marginLeft: 8, flexShrink: 0 }}>{it.valueLabel != null ? it.valueLabel : money(it.value)}</span></div>
    <div style={{ height: 9, background: T.bg, borderRadius: 5, overflow: "hidden" }}><div style={{ width: Math.abs(it.value) / max * 100 + "%", height: "100%", background: it.color || T.accent, borderRadius: 5 }} /></div>
  </div>))}</div>);
}
function Dot({ c }) { return <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: c, marginRight: 6, verticalAlign: "middle" }} />; }
const PALETA = ["#1B3A5B", "#B0894F", "#16A34A", "#C2410C", "#7C3AED", "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#4F46E5", "#0D9488", "#9333EA", "#CA8A04", "#DC2626"];
function GraficoTorta({ titulo, items, centro, centroSub }) {
  const its = (items || []).filter(x => Math.max(0, x.value) > 0);
  if (!its.length) return null;
  const segs = its.map((it, i) => ({ value: Math.max(0, it.value), color: it.color || PALETA[i % PALETA.length] }));
  return <div style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: SHDsm }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 10 }}>{titulo}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <Donut segs={segs} size={128} thickness={18} centro={centro} centroSub={centroSub} />
      <div style={{ flex: 1, minWidth: 140, fontSize: 12 }}>{its.map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Dot c={it.color || PALETA[i % PALETA.length]} />{it.label}</span><b style={{ marginLeft: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{it.valueLabel != null ? it.valueLabel : money(it.value)}</b></div>)}</div>
    </div>
  </div>;
}
function GraficoBarras({ titulo, items }) {
  const its = (items || []).filter(x => Math.abs(x.value) > 0);
  if (!its.length) return null;
  return <div style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: SHDsm }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 12 }}>{titulo}</div>
    <BarsH items={its.map((it, i) => ({ ...it, color: it.color || PALETA[i % PALETA.length] }))} />
  </div>;
}
function KPI({ t, v, c }) { return <div style={{ background: T.card, borderRadius: 14, padding: "13px 14px", flex: 1, minWidth: 0, boxShadow: SHDsm }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>{t}</div><div style={{ fontSize: 17, fontWeight: 700, color: c || T.text, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{v}</div></div>; }

function MiniAdder({ titulo, campo1, campo2, tipos, onAdd, btn }) {
  const [c1, setC1] = useState(""); const [tipo, setTipo] = useState(tipos ? tipos[0][0] : ""); const [monto, setMonto] = useState(""); const [fecha, setFecha] = useState(hoyISO());
  return <div style={{ background: T.bg, borderRadius: 9, padding: 10, marginTop: 8 }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 6 }}>{titulo}</div>
    <input value={c1} onChange={e => setC1(e.target.value)} placeholder={campo1} style={{ ...inpSm, width: "100%", boxSizing: "border-box" }} />
    {tipos && <div style={{ display: "flex", gap: 5, marginTop: 6 }}>{tipos.map(([k, l]) => <button key={k} onClick={() => setTipo(k)} style={{ flex: 1, background: tipo === k ? T.navy : T.card, color: tipo === k ? "#fff" : T.sub, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 3px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}</div>}
    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <input value={monto} onChange={e => setMonto(fmtMiles(e.target.value))} inputMode="numeric" placeholder={campo2 || "Monto $"} style={{ ...inpSm, flex: 1, textAlign: "right" }} />
      <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inpSm, width: 138 }} />
      <button onClick={() => { if (numMoney(monto) > 0) { onAdd({ texto: c1.trim(), tipo, monto: numMoney(monto), fecha }); setC1(""); setMonto(""); } }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "0 15px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>＋</button>
    </div>
  </div>;
}
function MoneyInput({ value, onSave, placeholder, style }) {
  const [v, setV] = useState(value ? fmtMiles(value) : "");
  useEffect(() => { setV(value ? fmtMiles(value) : ""); }, [value]);
  return <input value={v} onChange={e => setV(fmtMiles(e.target.value))} onBlur={() => onSave(numMoney(v))} inputMode="numeric" placeholder={placeholder} style={style} />;
}
function SocioAdder({ onAdd }) {
  const [nombre, setNombre] = useState(""); const [pct, setPct] = useState(""); const [tel, setTel] = useState("");
  return <div style={{ background: T.bg, borderRadius: 9, padding: 10, marginTop: 8 }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 6 }}>Agregar socio</div>
    <div style={{ display: "flex", gap: 6 }}>
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del socio" style={{ ...inpSm, flex: 1 }} />
      <input value={pct} onChange={e => setPct(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="%" style={{ ...inpSm, width: 64, textAlign: "right" }} />
    </div>
    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <input value={tel} onChange={e => setTel(e.target.value)} inputMode="tel" placeholder="Teléfono / info (opcional)" style={{ ...inpSm, flex: 1 }} />
      <button onClick={() => { if (nombre.trim()) { onAdd({ nombre: nombre.trim(), pct: num(pct), tel: tel.trim() }); setNombre(""); setPct(""); setTel(""); } }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "0 15px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>＋</button>
    </div>
  </div>;
}
function RetiroAdder({ socios, onAdd }) {
  const [socioId, setSocioId] = useState(""); const [monto, setMonto] = useState(""); const [fecha, setFecha] = useState(hoyISO());
  return <div style={{ background: T.bg, borderRadius: 9, padding: 10, marginTop: 8 }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 6 }}>Nuevo retiro de utilidad</div>
    {socios.length > 0 ? <select value={socioId} onChange={e => setSocioId(e.target.value)} style={{ ...inpSm, width: "100%", boxSizing: "border-box" }}><option value="">Elegí socio…</option>{socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select> : <div style={{ fontSize: 11, color: T.muted }}>Cargá los socios primero para asignar el retiro.</div>}
    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <input value={monto} onChange={e => setMonto(fmtMiles(e.target.value))} inputMode="numeric" placeholder="Monto $" style={{ ...inpSm, flex: 1, textAlign: "right" }} />
      <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inpSm, width: 138 }} />
      <button onClick={() => { if (numMoney(monto) > 0 && (socioId || !socios.length)) { const so = socios.find(x => x.id === socioId); onAdd({ socioId, texto: so ? so.nombre : "Socio", monto: numMoney(monto), fecha }); setMonto(""); } }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "0 15px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>＋</button>
    </div>
  </div>;
}
function GeneralPanel({ data, obras, certs, certsDe, indices }) {
  const [desde, setDesde] = useState(""); const [hasta, setHasta] = useState(""); const [pdfHtml, setPdfHtml] = useState(null);
  const enR = (f) => { if (!f) return false; if (desde && f < desde) return false; if (hasta && f > hasta) return false; return true; };
  const fechaDe = (ts) => ts ? new Date(ts).toISOString().slice(0, 10) : "";
  const anio = new Date().getFullYear();
  const presets = [["Este mes", new Date().toISOString().slice(0, 8) + "01", new Date().toISOString().slice(0, 10)], ["Este año", `${anio}-01-01`, `${anio}-12-31`], ["Todo", "", ""]];
  // CLIENTE — caja del período
  const movs = data.movimientos || [], gastosG = data.gastos || [];
  let cliCob = 0, cliEgr = 0; const cliObra = {};
  const addCli = (key, k, v) => { if (!cliObra[key]) cliObra[key] = { cob: 0, egr: 0 }; cliObra[key][k] += v; };
  movs.forEach(m => { if (!enR(m.fecha)) return; const o = obras.find(x => x.id === m.obraId); const key = o ? o.nombre : "General"; if (m.tipo === "cobro") { cliCob += num(m.monto); addCli(key, "cob", num(m.monto)); } else { cliEgr += num(m.monto); addCli(key, "egr", num(m.monto)); } });
  gastosG.forEach(g => { if (!enR(g.fecha)) return; cliEgr += num(g.monto); const o = obras.find(x => x.id === g.obraId); addCli(o ? o.nombre : "General", "egr", num(g.monto)); });
  // SOCIEDAD
  const soc = data.sociedad || []; let socCob = 0, socEgr = 0; const socObra = [];
  soc.forEach(s => { const cob = (s.cobros || []).filter(c => enR(c.fecha)).reduce((a, c) => a + num(c.monto), 0); const egr = (s.gastos || []).filter(g => enR(g.fecha)).reduce((a, g) => a + num(g.monto), 0); socCob += cob; socEgr += egr; if (cob || egr) socObra.push({ nombre: s.nombre, cob, egr }); });
  // PARTICULARES / EDIFICIOS — inversión del período (por ts de cada costo)
  const prop = data.propias || []; let propEgr = 0; const propObra = [];
  prop.forEach(p => { const egr = (p.costos || []).filter(c => enR(fechaDe(c.ts))).reduce((a, c) => a + num(c.montoArs), 0); propEgr += egr; if (egr) propObra.push({ nombre: p.nombre, egr }); });
  const edif = data.edificios || []; let edifEgr = 0; const edifObra = [];
  edif.forEach(e => { const egr = (e.costos || []).filter(c => enR(fechaDe(c.ts))).reduce((a, c) => a + num(c.montoArs), 0); edifEgr += egr; if (egr) edifObra.push({ nombre: e.nombre, egr }); });
  const totCob = cliCob + socCob; const totEgr = cliEgr + socEgr + edifEgr; const flujo = totCob - totEgr;
  // RESULTADOS ACUMULADOS (todo, sin filtro de período)
  const est = data.estructura || {}; const cuotaQ = (num(est.nObras) > 0 ? num(est.mensual) / num(est.nObras) : 0) / 2;
  let cFact = 0, cCostoDir = 0, cImp = 0, cImprev = 0, cNcert = 0;
  certs.forEach(c => { const o = obras.find(x => x.id === c.obraId); if (!o) return; const r = calcCert(c, o, certsDe(c.obraId), indices); cFact += r.ajustado; cCostoDir += r.costoDirPeriodo; cImp += r.extraMontoPeriodo + r.extraPctPeriodo; cImprev += r.imprevPeriodo; cNcert++; });
  const cGastos = gastosG.filter(g => !esImprev(g.cat)).reduce((a, g) => a + num(g.monto), 0);
  const cResCliente = (cFact - cCostoDir) - cImp - cImprev - (cuotaQ * cNcert) - cGastos;
  const rSoc = soc.reduce((a, s) => { const presIni = num(s.presupuestoInicial != null ? s.presupuestoInicial : s.presupuesto); const adicT = (s.adicionales || []).reduce((x, y) => x + num(y.monto), 0); const cReal = (s.gastos || []).reduce((x, y) => x + num(y.monto), 0); return a + (presIni + adicT - cReal); }, 0);
  const rProp = prop.reduce((a, p) => { const inv = (p.costos || []).reduce((x, y) => x + num(y.montoArs), 0); return a + (num(p.ventaArs) - inv); }, 0);
  const rEdif = edif.reduce((a, e) => { const inv = (e.costos || []).reduce((x, y) => x + num(y.montoArs), 0); const vta = (e.unidades || []).reduce((x, y) => x + num(y.precioArs), 0); return a + (vta - inv); }, 0);
  const resTotal = cResCliente + rSoc + rEdif;
  const R = (t, v, c) => <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}><span style={{ color: T.sub }}>{t}</span><b style={{ color: c || T.text }}>{money(v)}</b></div>;
  return (<div>
    <div style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: SHDsm }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>Período</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: T.muted, marginBottom: 2 }}>Desde</div><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ ...inpSm, width: "100%", boxSizing: "border-box" }} /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: T.muted, marginBottom: 2 }}>Hasta</div><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ ...inpSm, width: "100%", boxSizing: "border-box" }} /></div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>{presets.map(([l, d, h]) => <button key={l} onClick={() => { setDesde(d); setHasta(h); }} style={{ flex: 1, background: T.al, border: `1px solid ${T.border}`, color: T.accent, borderRadius: 8, padding: "8px 4px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}</div>
    </div>
    <div style={{ background: `linear-gradient(155deg, #14263E 0%, ${T.navy} 68%)`, color: "#fff", borderRadius: 18, padding: 20, marginBottom: 14, boxShadow: SHD, border: `1px solid rgba(176,137,79,.28)` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, letterSpacing: "0.1em", textTransform: "uppercase" }}>Flujo del período {desde || hasta ? `(${fmtISO(desde) || "inicio"} → ${fmtISO(hasta) || "hoy"})` : "(todo)"}</div>
      <div style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 10px", color: flujo >= 0 ? "#7DE0A6" : "#FCA5A5" }}>{money(flujo)}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0", borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 8 }}><span style={{ color: "rgba(255,255,255,.75)" }}>Cobrado en el período</span><b>{money(totCob)}</b></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}><span style={{ color: "rgba(255,255,255,.75)" }}>Egresos / inversión</span><b style={{ color: "#FCA5A5" }}>− {money(totEgr)}</b></div>
    </div>
    <div style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: SHDsm }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>Cobrado por modelo (en el período)</div>
      {R("Clientes", cliCob, T.ok)}{R("Sociedad", socCob, T.ok)}
      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6, marginBottom: 8 }}>Edificios se cobra al vender; acá se muestra por la inversión del período. Obras particulares va en un canal aparte (abajo).</div>
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8, fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>Egresos por modelo</div>
      {R("Clientes", cliEgr, T.warn)}{R("Sociedad", socEgr, T.warn)}{R("Edificios", edifEgr, T.warn)}
    </div>
    <GraficoBarras titulo="Cobrado por modelo (período)" items={[{ label: "Clientes", value: cliCob, color: T.ok }, { label: "Sociedad", value: socCob, color: "#16A34A" }]} />
    <GraficoBarras titulo="Egresos / inversión por modelo (período)" items={[{ label: "Clientes", value: cliEgr }, { label: "Sociedad", value: socEgr }, { label: "Edificios", value: edifEgr }]} />
    <GraficoTorta titulo="Resultado por modelo (acumulado)" items={[{ label: "Cliente", value: cResCliente }, { label: "Sociedad", value: rSoc }, { label: "Edificios", value: rEdif }]} centro={money(resTotal)} centroSub="resultado" />
    <GraficoBarras titulo="Resultado por modelo (acumulado)" items={[{ label: "Cliente", value: cResCliente }, { label: "Sociedad", value: rSoc }, { label: "Edificios", value: rEdif }]} />
    {(Object.keys(cliObra).length > 0 || socObra.length > 0 || propObra.length > 0 || edifObra.length > 0) && <div style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: SHDsm }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 8 }}>Detalle por obra (período)</div>
      {Object.entries(cliObra).map(([k, v]) => <div key={"c" + k} style={{ padding: "6px 0", borderBottom: `1px solid ${T.border}` }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{k} <span style={{ fontSize: 9.5, color: T.accent, fontWeight: 700 }}>CLIENTE</span></div><div style={{ fontSize: 11.5, color: T.sub }}>Cobrado {money(v.cob)} · Egresos {money(v.egr)}</div></div>)}
      {socObra.map((v, i) => <div key={"s" + i} style={{ padding: "6px 0", borderBottom: `1px solid ${T.border}` }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{v.nombre} <span style={{ fontSize: 9.5, color: BRASS, fontWeight: 700 }}>SOCIEDAD</span></div><div style={{ fontSize: 11.5, color: T.sub }}>Cobrado {money(v.cob)} · Egresos {money(v.egr)}</div></div>)}
      {propObra.map((v, i) => <div key={"p" + i} style={{ padding: "6px 0", borderBottom: `1px solid ${T.border}` }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{v.nombre} <span style={{ fontSize: 9.5, color: T.sub, fontWeight: 700 }}>PARTICULAR</span></div><div style={{ fontSize: 11.5, color: T.sub }}>Invertido {money(v.egr)}</div></div>)}
      {edifObra.map((v, i) => <div key={"e" + i} style={{ padding: "6px 0", borderBottom: `1px solid ${T.border}` }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{v.nombre} <span style={{ fontSize: 9.5, color: T.sub, fontWeight: 700 }}>EDIFICIO</span></div><div style={{ fontSize: 11.5, color: T.sub }}>Invertido {money(v.egr)}</div></div>)}
    </div>}
    <div style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: SHDsm, borderTop: `3px solid ${BRASS}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 4 }}>Resultados parciales (acumulado total)</div>
      <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>Resultado esperado de cada modelo con todo lo cargado hasta hoy.</div>
      {R("Obras de cliente", cResCliente, cResCliente >= 0 ? T.ok : "#EF4444")}
      {R("Obras en sociedad", rSoc, rSoc >= 0 ? T.ok : "#EF4444")}
      {R("Edificios", rEdif, rEdif >= 0 ? T.ok : "#EF4444")}
      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 13.5, fontWeight: 800 }}>Resultado general V+V</span><Money v={resTotal} c={resTotal >= 0 ? T.ok : "#EF4444"} /></div>
      <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>No incluye obras particulares (van por canal aparte hasta venderse).</div>
    </div>
    <div style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: SHDsm, border: `1px dashed ${BRASS}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: BRASS, textTransform: "uppercase", marginBottom: 4 }}>Obras particulares · canal aparte</div>
      <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>Se maneja por separado: hasta que vendas, solo hay inversión. No afecta el resultado general.</div>
      {R("Invertido en el período", propEgr, T.warn)}
      {R("Resultado esperado (con venta estimada)", rProp, rProp >= 0 ? T.ok : "#EF4444")}
    </div>
    <button onClick={() => setPdfHtml(reporteHTML("V+V Construcciones — Resultado general", `Período: ${desde || hasta ? `${fmtISO(desde) || "inicio"} → ${fmtISO(hasta) || "hoy"}` : "todo"}`, [{ titulo: "Flujo del período", filas: [{ label: "Cobrado en el período", value: money(totCob) }, { label: "Egresos / inversión", value: money(totEgr) }, { label: "Flujo del período", value: money(flujo), strong: true }] }, { titulo: "Cobrado por modelo", filas: [{ label: "Clientes", value: money(cliCob) }, { label: "Sociedad", value: money(socCob) }] }, { titulo: "Egresos por modelo", filas: [{ label: "Clientes", value: money(cliEgr) }, { label: "Sociedad", value: money(socEgr) }, { label: "Edificios", value: money(edifEgr) }] }, { titulo: "Resultados por modelo (acumulado)", filas: [{ label: "Obras de cliente", value: money(cResCliente) }, { label: "Obras en sociedad", value: money(rSoc) }, { label: "Edificios", value: money(rEdif) }, { label: "Resultado general V+V", value: money(resTotal), strong: true }] }, { titulo: "Obras particulares (canal aparte)", filas: [{ label: "Invertido en el período", value: money(propEgr) }, { label: "Resultado esperado (con venta)", value: money(rProp) }] }], null, data.config, [{ tipo: "barras", titulo: "Cobrado por modelo", items: [{ label: "Clientes", value: cliCob }, { label: "Sociedad", value: socCob }] }, { tipo: "barras", titulo: "Egresos por modelo", items: [{ label: "Clientes", value: cliEgr }, { label: "Sociedad", value: socEgr }, { label: "Edificios", value: edifEgr }] }, { tipo: "torta", titulo: "Resultado por modelo", items: [{ label: "Cliente", value: cResCliente }, { label: "Sociedad", value: rSoc }, { label: "Edificios", value: rEdif }] }]))} style={{ width: "100%", background: T.navy, color: "#fff", border: "none", borderRadius: 11, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>Exportar resultado general a PDF</button>
    {pdfHtml && <PdfOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
  </div>);
}
function SociedadPanel({ data, save }) {
  const socios = data.sociedad || [];
  const [abrir, setAbrir] = useState(false); const [expand, setExpand] = useState({}); const [subiendo, setSubiendo] = useState(""); const [pdfHtml, setPdfHtml] = useState(null);
  const [f, setF] = useState({ nombre: "", descripcion: "", presupuesto: "", costoEst: "" });
  const add = () => { if (!f.nombre.trim()) return; save({ ...data, sociedad: [...socios, { id: uid(), nombre: f.nombre.trim(), descripcion: f.descripcion.trim(), presupuestoInicial: numMoney(f.presupuesto), costoEstimado: numMoney(f.costoEst), adicionales: [], gastos: [], cobros: [], retiros: [], socios: [], ts: Date.now() }] }); setF({ nombre: "", descripcion: "", presupuesto: "", costoEst: "" }); setAbrir(false); };
  const upd = (id, fn) => save({ ...data, sociedad: socios.map(x => x.id === id ? fn(x) : x) });
  const del = (id) => save({ ...data, sociedad: socios.filter(x => x.id !== id) });
  const push = (id, campo, item) => upd(id, s => ({ ...s, [campo]: [...(s[campo] || []), { id: uid(), ts: Date.now(), ...item }] }));
  const pull = (id, campo, iid) => upd(id, s => ({ ...s, [campo]: (s[campo] || []).filter(x => x.id !== iid) }));
  const setCampo = (id, k, v) => upd(id, s => ({ ...s, [k]: v }));
  async function subirAdj(id, files) { const arr = Array.from(files || []); if (!arr.length) return; setSubiendo(id); const nuevos = []; for (const f of arr) { const url = await subirArchivo(f); if (url) nuevos.push({ url, tipo: (f.type || "").startsWith("video") ? "video" : "foto" }); } if (nuevos.length) upd(id, s => ({ ...s, adjuntos: [...(s.adjuntos || []), ...nuevos] })); else alert("No se pudo subir."); setSubiendo(""); }
  return (<div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm, borderTop: `3px solid ${BRASS}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obras en sociedad</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Presupuesto y costo reales, cobranza, socios y reparto de utilidades.</div></div>
      <button onClick={() => setAbrir(o => !o)} style={{ background: T.al, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 700, color: T.accent, cursor: "pointer", flexShrink: 0 }}>{abrir ? "Cerrar" : "+ Nueva"}</button>
    </div>
    {abrir && <div style={{ background: T.bg, borderRadius: 11, padding: 12, marginTop: 10 }}>
      <input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} placeholder="Nombre de la obra" style={{ ...inp, marginTop: 0 }} />
      <textarea value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} placeholder="Descripción de la obra" style={{ ...inp, minHeight: 56, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8 }}>
        <input value={f.presupuesto} onChange={e => setF({ ...f, presupuesto: fmtMiles(e.target.value) })} inputMode="numeric" placeholder="Presupuesto inicial $" style={{ ...inp, flex: 1 }} />
        <input value={f.costoEst} onChange={e => setF({ ...f, costoEst: fmtMiles(e.target.value) })} inputMode="numeric" placeholder="Costo estimado $" style={{ ...inp, flex: 1 }} />
      </div>
      <button onClick={add} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Crear obra en sociedad</button>
    </div>}
    {socios.map(s => {
      const presIni = num(s.presupuestoInicial != null ? s.presupuestoInicial : s.presupuesto); const costoEst = num(s.costoEstimado != null ? s.costoEstimado : s.costo);
      const adic = s.adicionales || [], gastos = s.gastos || [], cobros = s.cobros || [], retiros = s.retiros || s.pagos || [], lsoc = s.socios || [];
      const adicTot = adic.reduce((a, x) => a + num(x.monto), 0); const presTotal = presIni + adicTot;
      const costoReal = gastos.reduce((a, x) => a + num(x.monto), 0); const imprevTot = gastos.filter(g => g.tipo === "imprevisto").reduce((a, x) => a + num(x.monto), 0);
      const cobrado = cobros.reduce((a, x) => a + num(x.monto), 0); const restaCobrar = presTotal - cobrado;
      const util = presTotal - costoReal; const retTot = retiros.reduce((a, x) => a + num(x.monto), 0); const rest = util - retTot; const mg = presTotal > 0 ? util / presTotal * 100 : 0;
      const sumaPct = lsoc.reduce((a, x) => a + num(x.pct), 0); const exp = expand[s.id];
      return (<div key={s.id} style={{ background: T.bg, borderRadius: 12, padding: 13, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}><span style={{ fontSize: 14.5, fontWeight: 800 }}>{s.nombre}</span><button onClick={() => del(s.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer" }}>Eliminar</button></div>
        {s.descripcion && <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 8, lineHeight: 1.4 }}>{s.descripcion}</div>}
        <Line t={`Presupuesto (inicial ${money(presIni)}${adicTot > 0 ? ` + adic. ${money(adicTot)}` : ""})`} v={money(presTotal)} c={T.accent} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}><span style={{ color: T.sub }}>Cobrado / resta a cobrar</span><span><b style={{ color: T.ok }}>{money(cobrado)}</b> <span style={{ color: T.muted }}>/ {money(restaCobrar)}</span></span></div>
        <Line t={`Costo real${imprevTot > 0 ? ` (imprev. ${money(imprevTot)})` : ""}`} v={money(costoReal)} c={T.warn} />
        {costoEst > 0 && <div style={{ fontSize: 10.5, color: T.muted, marginTop: -2, marginBottom: 4 }}>Costo estimado {money(costoEst)} · desvío {costoReal - costoEst >= 0 ? "+" : ""}{money(costoReal - costoEst)}</div>}
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 5, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 800 }}>Utilidad {presTotal > 0 ? `· ${mg.toFixed(0)}%` : ""}</span><Money v={util} c={util >= 0 ? T.ok : "#EF4444"} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}><span style={{ fontSize: 12.5, fontWeight: 800 }}>Utilidad por distribuir</span><Money v={rest} c={rest >= 0 ? T.ok : "#EF4444"} /></div>
        <button onClick={() => setExpand(x => ({ ...x, [s.id]: !x[s.id] }))} style={{ width: "100%", background: "none", border: `1px dashed ${T.border}`, color: T.accent, borderRadius: 9, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>{exp ? "Ocultar detalle ▲" : "Socios · cobros · adicionales · gastos · retiros ▼"}</button>
        {exp && <div style={{ marginTop: 8 }}>
          <GraficoTorta titulo="Composición del presupuesto" items={[{ label: "Costo", value: costoReal - imprevTot }, { label: "Imprevistos", value: imprevTot }, { label: "Utilidad", value: Math.max(0, util) }]} centro={money(presTotal)} centroSub="presup." />
          <GraficoBarras titulo="Presupuesto · Costo · Utilidad" items={[{ label: "Presupuesto", value: presTotal, color: T.accent }, { label: "Costo real", value: costoReal, color: "#C2410C" }, { label: "Utilidad", value: Math.max(0, util), color: T.ok }]} />
          {lsoc.length > 0 && <GraficoBarras titulo="Reparto de utilidad por socio" items={lsoc.map(so => ({ label: `${so.nombre} (${num(so.pct)}%)`, value: util * num(so.pct) / 100 }))} />}
          <GraficoTorta titulo="Cobranza" items={[{ label: "Cobrado", value: cobrado, color: T.ok }, { label: "Resta a cobrar", value: Math.max(0, presTotal - cobrado), color: T.warn }]} centro={presTotal > 0 ? Math.round(cobrado / presTotal * 100) + "%" : "0%"} centroSub="cobrado" />
          <div style={{ background: T.card, borderRadius: 10, padding: 11, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 11, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.05em" }}>Socios y reparto</span>{lsoc.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: sumaPct === 100 ? T.ok : T.warn }}>{sumaPct}%{sumaPct !== 100 ? " ⚠" : " ✓"}</span>}</div>
            {lsoc.map(so => { const corr = util * num(so.pct) / 100; const retS = retiros.filter(r => r.socioId === so.id).reduce((a, r) => a + num(r.monto), 0); const queda = corr - retS; return <div key={so.id} style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>{so.nombre} <span style={{ color: T.muted, fontWeight: 600 }}>· {num(so.pct)}%</span></span><button onClick={() => pull(s.id, "socios", so.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 12 }}>✕</button></div>
              {so.tel && <div style={{ fontSize: 10.5, color: T.muted }}>{so.tel}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 3 }}><span style={{ color: T.sub }}>Le corresponde {money(corr)}</span><span style={{ color: T.sub }}>Retiró {money(retS)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, marginTop: 1 }}><span>Le queda</span><span style={{ color: queda >= 0 ? T.ok : "#EF4444" }}>{money(queda)}</span></div>
              {so.tel && <a href={waLink(so.tel, reporteSociedadParcial(s, so))} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", background: "#25D366", color: "#fff", borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 700, textDecoration: "none", marginTop: 7 }}>Enviar su resultado por WhatsApp</a>}
            </div>; })}
            <SocioAdder onAdd={(it) => push(s.id, "socios", it)} />
          </div>
          <div style={{ background: T.card, borderRadius: 10, padding: 11, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Fotos y videos de la obra</div>
            {(s.adjuntos || []).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>{(s.adjuntos || []).map(m => <div key={m.id} style={{ position: "relative" }}>{m.tipo === "video" ? <video src={m.url} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", background: "#000" }} /> : <img src={m.url} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover" }} />}<button onClick={() => pull(s.id, "adjuntos", m.id)} style={{ position: "absolute", top: -6, right: -6, background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer", lineHeight: 1 }}>✕</button></div>)}</div>}
            <label style={{ display: "block", textAlign: "center", background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{subiendo === s.id ? "Subiendo…" : "＋ Subir foto o video"}<input type="file" accept="image/*,video/*" multiple onChange={e => { subirAdj(s.id, e.target.files); e.target.value = ""; }} style={{ display: "none" }} /></label>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <a href={waLink("", reporteSociedadParcial(s))} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", background: "#25D366", color: "#fff", borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>WhatsApp</a>
              <button onClick={() => setPdfHtml(reporteHTML(s.nombre + " — Resultado parcial", s.descripcion, seccionesSociedad(s), s.adjuntos, data.config, [{ tipo: "torta", titulo: "Composición del presupuesto", items: [{ label: "Costo", value: costoReal - imprevTot }, { label: "Imprevistos", value: imprevTot }, { label: "Utilidad", value: Math.max(0, util) }] }, ...(lsoc.length ? [{ tipo: "barras", titulo: "Reparto de utilidad por socio", items: lsoc.map(so => ({ label: `${so.nombre} (${num(so.pct)}%)`, value: util * num(so.pct) / 100 })) }] : []), { tipo: "torta", titulo: "Cobranza", items: [{ label: "Cobrado", value: cobrado, color: "#16A34A" }, { label: "Resta a cobrar", value: Math.max(0, presTotal - cobrado), color: "#C2410C" }] }]))} style={{ flex: 1, background: T.navy, color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Exportar PDF</button>
            </div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>El reporte va con todos los números detallados y los links a las fotos/videos. Cada socio con teléfono cargado tiene su botón propio arriba.</div>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cobros (lo que se cobra)</div>
          {cobros.map(c => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: T.sub, marginTop: 5 }}><span>{c.texto || "Cobro"} · {fmtISO(c.fecha)}</span><span style={{ display: "flex", gap: 8, alignItems: "center" }}>{money(num(c.monto))}<button onClick={() => pull(s.id, "cobros", c.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>✕</button></span></div>)}
          <MiniAdder titulo="Nuevo cobro" campo1="Concepto / quién paga" onAdd={(it) => push(s.id, "cobros", it)} />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 14 }}>Adicionales (suman al presupuesto)</div>
          {adic.map(a => <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: T.sub, marginTop: 5 }}><span>{a.texto || "Adicional"} · {fmtISO(a.fecha)}</span><span style={{ display: "flex", gap: 8, alignItems: "center" }}>{money(num(a.monto))}<button onClick={() => pull(s.id, "adicionales", a.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>✕</button></span></div>)}
          <MiniAdder titulo="Nuevo adicional" campo1="Descripción del adicional" onAdd={(it) => push(s.id, "adicionales", it)} />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 14 }}>Gastos / pagos (costo real)</div>
          {gastos.map(g => <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: T.sub, marginTop: 5 }}><span>{g.texto || "Gasto"}{g.tipo && g.tipo !== "normal" ? <span style={{ color: g.tipo === "imprevisto" ? T.warn : T.accent, fontWeight: 700 }}> · {g.tipo}</span> : ""} · {fmtISO(g.fecha)}</span><span style={{ display: "flex", gap: 8, alignItems: "center" }}>{money(num(g.monto))}<button onClick={() => pull(s.id, "gastos", g.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>✕</button></span></div>)}
          <MiniAdder titulo="Nuevo gasto / pago parcial" campo1="Concepto (proveedor, mano de obra…)" tipos={[["normal", "Normal"], ["imprevisto", "Imprevisto"], ["adicional", "Adicional"]]} onAdd={(it) => push(s.id, "gastos", it)} />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 14 }}>Retiros de utilidades</div>
          {retiros.map(p => { const so = lsoc.find(x => x.id === p.socioId); return <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: T.sub, marginTop: 5 }}><span>{so ? so.nombre : (p.texto || p.socio || "Socio")} · {fmtISO(p.fecha)}</span><span style={{ display: "flex", gap: 8, alignItems: "center" }}>{money(num(p.monto))}<button onClick={() => pull(s.id, "retiros", p.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>✕</button></span></div>; })}
          <RetiroAdder socios={lsoc} onAdd={(it) => push(s.id, "retiros", it)} />
        </div>}
      </div>);
    })}
    {socios.length === 0 && !abrir && <div style={{ fontSize: 12, color: T.muted, marginTop: 10, textAlign: "center" }}>Tocá "+ Nueva" para cargar una obra en sociedad.</div>}
    {pdfHtml && <PdfOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
  </div>);
}
function UnidadAdder({ onAdd, cotizDef }) {
  const [nombre, setNombre] = useState(""); const [m2, setM2] = useState(""); const [moneda, setMoneda] = useState("usd"); const [precio, setPrecio] = useState(""); const [cotiz, setCotiz] = useState(cotizDef || "");
  const add = () => { if (!nombre.trim()) return; const p = numMoney(precio); const ct = numMoney(cotiz); let ars, usdv; if (moneda === "usd") { usdv = p; ars = ct > 0 ? p * ct : 0; } else { ars = p; usdv = ct > 0 ? p / ct : 0; } onAdd({ nombre: nombre.trim(), m2: numMoney(m2), precioUsd: usdv, precioArs: ars, cotiz: ct, estado: "disponible" }); setNombre(""); setM2(""); setPrecio(""); };
  return <div style={{ background: T.bg, borderRadius: 9, padding: 10, marginTop: 8 }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 6 }}>Agregar unidad</div>
    <div style={{ display: "flex", gap: 6 }}>
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Depto (ej: 2°A)" style={{ ...inpSm, flex: 1 }} />
      <input value={m2} onChange={e => setM2(fmtMiles(e.target.value))} inputMode="numeric" placeholder="m²" style={{ ...inpSm, width: 70, textAlign: "right" }} />
    </div>
    <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
      <div style={{ display: "flex", background: T.card, borderRadius: 8, padding: 2, border: `1px solid ${T.border}` }}>{[["usd", "US$"], ["ars", "$"]].map(([k, l]) => <button key={k} onClick={() => setMoneda(k)} style={{ background: moneda === k ? T.navy : "transparent", color: moneda === k ? "#fff" : T.sub, border: "none", borderRadius: 6, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}</div>
      <input value={precio} onChange={e => setPrecio(fmtMiles(e.target.value))} inputMode="numeric" placeholder="Precio venta" style={{ ...inpSm, flex: 1 }} />
    </div>
    <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11.5, color: T.sub }}>Cotiz.</span>
      <input value={cotiz} onChange={e => setCotiz(fmtMiles(e.target.value))} inputMode="numeric" placeholder="ej: 1450" style={{ ...inpSm, width: 90, textAlign: "right" }} />
      <button onClick={add} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Agregar unidad</button>
    </div>
  </div>;
}
function EdificiosPanel({ data, save }) {
  const edificios = data.edificios || [];
  const [abrir, setAbrir] = useState(false); const [nombre, setNombre] = useState(""); const [expandir, setExpandir] = useState({}); const [subiendo, setSubiendo] = useState(""); const [pdfHtml, setPdfHtml] = useState(null);
  const [cotizDef, setCotizDef] = useState(String(data.config?.cotizUSD || ""));
  const upd = (id, fn) => save({ ...data, config: { ...(data.config || {}), cotizUSD: numMoney(cotizDef) || data.config?.cotizUSD }, edificios: edificios.map(e => e.id === id ? fn(e) : e) });
  const addEd = () => { if (!nombre.trim()) return; save({ ...data, edificios: [...edificios, { id: uid(), nombre: nombre.trim(), costos: [], unidades: [], adjuntos: [], ts: Date.now() }] }); setNombre(""); setAbrir(false); };
  const delEd = (id) => save({ ...data, edificios: edificios.filter(e => e.id !== id) });
  const delAdj = (id, url) => save({ ...data, edificios: edificios.map(e => e.id === id ? { ...e, adjuntos: (e.adjuntos || []).filter(a => a.url !== url) } : e) });
  async function subirAdj(id, files) { const arr = Array.from(files || []); if (!arr.length) return; setSubiendo(id); const nuevos = []; for (const f of arr) { const url = await subirArchivo(f); if (url) nuevos.push({ url, tipo: (f.type || "").startsWith("video") ? "video" : "foto" }); } if (nuevos.length) save({ ...data, edificios: edificios.map(e => e.id === id ? { ...e, adjuntos: [...(e.adjuntos || []), ...nuevos] } : e) }); else alert("No se pudo subir."); setSubiendo(""); }
  const addCosto = (id, c) => upd(id, e => ({ ...e, costos: [...(e.costos || []), { id: uid(), ts: Date.now(), ...c }] }));
  const delCosto = (id, cid) => upd(id, e => ({ ...e, costos: (e.costos || []).filter(x => x.id !== cid) }));
  const addUnidad = (id, u) => upd(id, e => ({ ...e, unidades: [...(e.unidades || []), { id: uid(), ts: Date.now(), ...u }] }));
  const delUnidad = (id, uid2) => upd(id, e => ({ ...e, unidades: (e.unidades || []).filter(x => x.id !== uid2) }));
  const setEstado = (id, uid2, est) => upd(id, e => ({ ...e, unidades: (e.unidades || []).map(x => x.id === uid2 ? { ...x, estado: est } : x) }));
  const nextEstado = { disponible: "reservado", reservado: "vendido", vendido: "disponible" };
  const colEstado = { disponible: T.muted, reservado: T.warn, vendido: T.ok };
  return (<div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm, borderTop: `3px solid ${BRASS}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Edificios de departamentos</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Costo por rubros + unidades a vender. Todo en $ y US$.</div></div>
      <button onClick={() => setAbrir(o => !o)} style={{ background: T.al, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 700, color: T.accent, cursor: "pointer", flexShrink: 0 }}>{abrir ? "Cerrar" : "+ Nuevo"}</button>
    </div>
    {abrir && <div style={{ background: T.bg, borderRadius: 11, padding: 12, marginTop: 10 }}>
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (ej: Edificio Libertador 2200)" style={{ ...inp, marginTop: 0 }} />
      <button onClick={addEd} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Crear edificio</button>
    </div>}
    {edificios.map(e => {
      const costos = e.costos || [], unidades = e.unidades || []; const cotU = num(e.cotizUnif) || 0;
      const totArs = costos.reduce((s, c) => s + arsUnif(c, cotU), 0), totUsd = costos.reduce((s, c) => s + usdUnif(c, cotU), 0);
      const vtaUsd = unidades.reduce((s, u) => s + num(u.precioUsd), 0), vtaArs = unidades.reduce((s, u) => s + num(u.precioArs), 0);
      const resU = vtaUsd - totUsd, resA = vtaArs - totArs; const nV = unidades.filter(u => u.estado === "vendido").length; const exp = expandir[e.id];
      return (<div key={e.id} style={{ background: T.bg, borderRadius: 12, padding: 13, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 14.5, fontWeight: 800 }}>{e.nombre}</span><button onClick={() => delEd(e.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer" }}>Eliminar</button></div>
        <div style={{ display: "flex", justifyContent: "space-between", background: T.card, borderRadius: 9, padding: "9px 11px" }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>Inversión total</span><span style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}><b style={{ color: T.accent }}>{usdFmt(totUsd)}</b> <span style={{ color: T.muted }}>/ {money(totArs)}</span></span></div>
        <div style={{ display: "flex", justifyContent: "space-between", background: T.card, borderRadius: 9, padding: "9px 11px", marginTop: 6 }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>Venta proyectada <span style={{ fontSize: 10.5, color: T.muted }}>· {unidades.length} un. ({nV} vend.)</span></span><span style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}><b style={{ color: T.accent }}>{usdFmt(vtaUsd)}</b> <span style={{ color: T.muted }}>/ {money(vtaArs)}</span></span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9, paddingTop: 9, borderTop: `1px solid ${T.border}` }}><span style={{ fontSize: 13, fontWeight: 800 }}>Resultado esperado</span><span style={{ fontSize: 13.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}><span style={{ color: resU >= 0 ? T.ok : "#EF4444" }}>{usdFmt(resU)}</span><span style={{ color: resA >= 0 ? T.ok : "#EF4444", marginLeft: 8 }}>{money(resA)}</span></span></div>
        {(() => { const porEstado = { disponible: 0, reservado: 0, vendido: 0 }; unidades.forEach(u => { porEstado[u.estado || "disponible"] += num(u.precioUsd); }); const rt = {}; costos.forEach(c => { rt[c.cat] = (rt[c.cat] || 0) + arsUnif(c, cotU); }); const arr = Object.entries(rt).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); const top = arr.map(([k, v]) => ({ label: k, value: v })); return <div style={{ marginTop: 10 }}>
          <GraficoTorta titulo="Unidades por estado (US$)" items={[{ label: "Vendido", value: porEstado.vendido, color: T.ok }, { label: "Reservado", value: porEstado.reservado, color: T.warn }, { label: "Disponible", value: porEstado.disponible, color: T.muted }].map(x => ({ ...x, valueLabel: usdFmt(x.value) }))} centro={unidades.length + ""} centroSub="unidades" />
          <GraficoTorta titulo="Costos por rubro" items={top} centro={money(totArs)} centroSub="inversión" />
          <GraficoBarras titulo="Costos por rubro (ranking)" items={top} />
          <GraficoBarras titulo="Inversión vs venta proyectada" items={[{ label: "Inversión", value: totArs, color: "#C2410C" }, { label: "Venta proyectada", value: vtaArs, color: T.ok }]} />
        </div>; })()}
        <button onClick={() => setExpandir(x => ({ ...x, [e.id]: !x[e.id] }))} style={{ width: "100%", background: "none", border: `1px dashed ${T.border}`, color: T.accent, borderRadius: 9, padding: "10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 10 }}>{exp ? "Ocultar unidades y costos ▲" : "Cargar unidades y costos ▼"}</button>
        {exp && <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Unidades (departamentos)</div>
          {unidades.map(u => <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
            <div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{u.nombre}{u.m2 ? <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 400 }}> · {num(u.m2)} m²</span> : ""}</div><div style={{ fontSize: 11, color: T.sub }}>{usdFmt(num(u.precioUsd))} / {money(num(u.precioArs))}</div></div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}><button onClick={() => setEstado(e.id, u.id, nextEstado[u.estado || "disponible"])} style={{ background: T.card, border: `1px solid ${T.border}`, color: colEstado[u.estado || "disponible"], borderRadius: 6, padding: "5px 9px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>{(u.estado || "disponible").toUpperCase()}</button><button onClick={() => delUnidad(e.id, u.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13 }}>✕</button></div>
          </div>)}
          <UnidadAdder onAdd={(u) => addUnidad(e.id, u)} cotizDef={cotizDef} />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 4px" }}>Costos por rubro</div>
          {RUBROS_PROPIA.map(r => <RubroRow key={r} rubro={r} items={costos.filter(c => c.cat === r)} onAdd={(c) => addCosto(e.id, c)} onDel={(cid) => delCosto(e.id, cid)} cotizDef={cotizDef} setCotizDef={setCotizDef} cotU={cotU} />)}
        </div>}
        {(e.adjuntos || []).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{(e.adjuntos || []).map(m => <div key={m.url} style={{ position: "relative" }}>{m.tipo === "video" ? <video src={m.url} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", background: "#000" }} /> : <img src={m.url} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }} />}<button onClick={() => delAdj(e.id, m.url)} style={{ position: "absolute", top: -6, right: -6, background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer", lineHeight: 1 }}>✕</button></div>)}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <label style={{ flex: 1, textAlign: "center", background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{subiendo === e.id ? "Subiendo…" : "📷 Foto/video"}<input type="file" accept="image/*,video/*" multiple onChange={ev => { subirAdj(e.id, ev.target.files); ev.target.value = ""; }} style={{ display: "none" }} /></label>
          <a href={waLink("", reporteEdificioTexto(e))} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", background: "#25D366", color: "#fff", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>WhatsApp</a>
          <button onClick={() => { const pe = { disponible: 0, reservado: 0, vendido: 0 }; unidades.forEach(u => { pe[u.estado || "disponible"] += num(u.precioUsd); }); const rt = {}; costos.forEach(c => { rt[c.cat] = (rt[c.cat] || 0) + num(c.montoArs); }); const arr = Object.entries(rt).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); const top = arr.map(([k, v]) => ({ label: k, value: v })); setPdfHtml(reporteHTML(e.nombre + " — Edificio", "", seccionesEdificio(e), e.adjuntos, data.config, [{ tipo: "torta", titulo: "Unidades por estado (US$)", items: [{ label: "Vendido", value: pe.vendido, color: "#16A34A", valueLabel: usdFmt(pe.vendido) }, { label: "Reservado", value: pe.reservado, color: "#C2410C", valueLabel: usdFmt(pe.reservado) }, { label: "Disponible", value: pe.disponible, color: "#98A2B0", valueLabel: usdFmt(pe.disponible) }] }, { tipo: "torta", titulo: "Costos por rubro", items: top }])); }} style={{ flex: 1, background: T.navy, color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>PDF</button>
        </div>
      </div>);
    })}
    {edificios.length === 0 && !abrir && <div style={{ fontSize: 12, color: T.muted, marginTop: 10, textAlign: "center" }}>Tocá "+ Nuevo" para cargar un edificio con sus unidades y costos.</div>}
    {pdfHtml && <PdfOverlay html={pdfHtml} onClose={() => setPdfHtml(null)} />}
  </div>);
}
const EST_PRES = [["por_presentar", "A presentar"], ["presentado", "Sin definición"], ["ganado", "Ganado"], ["perdido", "No cerrado"]];
function PresupuestosPanel({ data, save }) {
  const lista = data.presupuestosSoc || [];
  const [abrir, setAbrir] = useState(false);
  const [f, setF] = useState({ nombre: "", cliente: "", monto: "", estado: "presentado", fechaLimite: "" });
  const hoy = hoyISO();
  const COL = { por_presentar: T.muted, presentado: T.accent, ganado: T.ok, perdido: "#EF4444" };
  const add = () => { if (!f.nombre.trim()) return; save({ ...data, presupuestosSoc: [...lista, { id: uid(), nombre: f.nombre.trim(), cliente: f.cliente.trim(), monto: numMoney(f.monto), estado: f.estado, fechaLimite: f.fechaLimite, motivo: "", ts: Date.now() }] }); setF({ nombre: "", cliente: "", monto: "", estado: "presentado", fechaLimite: "" }); setAbrir(false); };
  const upd = (id, patch) => save({ ...data, presupuestosSoc: lista.map(p => p.id === id ? { ...p, ...patch } : p) });
  const del = (id) => save({ ...data, presupuestosSoc: lista.filter(p => p.id !== id) });
  const ganados = lista.filter(p => p.estado === "ganado"), perdidos = lista.filter(p => p.estado === "perdido"), presentados = lista.filter(p => p.estado === "presentado"), porPresentar = lista.filter(p => p.estado === "por_presentar");
  const definidos = ganados.length + perdidos.length; const efectividad = definidos > 0 ? ganados.length / definidos * 100 : 0;
  const atrasados = porPresentar.filter(p => p.fechaLimite && p.fechaLimite < hoy);
  const montoGanado = ganados.reduce((a, p) => a + num(p.monto), 0), montoPerdido = perdidos.reduce((a, p) => a + num(p.monto), 0);
  return (<div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm, borderTop: `3px solid ${BRASS}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Presupuestos</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Seguimiento de presupuestos y efectividad.</div></div>
      <button onClick={() => setAbrir(o => !o)} style={{ background: T.al, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 700, color: T.accent, cursor: "pointer", flexShrink: 0 }}>{abrir ? "Cerrar" : "+ Nuevo"}</button>
    </div>
    {atrasados.length > 0 && <div style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.4)", borderRadius: 10, padding: "10px 12px", marginTop: 10, fontSize: 12.5, color: "#EF4444", fontWeight: 700 }}>⚠ {atrasados.length} presupuesto{atrasados.length > 1 ? "s" : ""} atrasado{atrasados.length > 1 ? "s" : ""} — vencidos y sin presentar</div>}
    {presentados.length > 0 && <div style={{ background: T.al, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", marginTop: 8, fontSize: 12, color: T.sub }}>⏳ {presentados.length} sin definición, esperando respuesta del cliente</div>}
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <div style={{ flex: 1, background: `linear-gradient(155deg, #14263E 0%, ${T.navy} 68%)`, color: "#fff", borderRadius: 12, padding: "13px 14px" }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: BRASS, textTransform: "uppercase", letterSpacing: "0.06em" }}>Efectividad</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#7DE0A6", margin: "3px 0" }}>{efectividad.toFixed(0)}%</div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)" }}>{ganados.length} ganados de {definidos} definidos</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ flex: 1, background: T.bg, borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600 }}>Ganado</div><div style={{ fontSize: 13, fontWeight: 700, color: T.ok }}>{money(montoGanado)}</div></div>
        <div style={{ flex: 1, background: T.bg, borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600 }}>No cerrado</div><div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444" }}>{money(montoPerdido)}</div></div>
      </div>
    </div>
    <GraficoTorta titulo="Presupuestos por estado" items={[{ label: "Ganados", value: ganados.length, color: T.ok, valueLabel: ganados.length + "" }, { label: "No cerrados", value: perdidos.length, color: "#EF4444", valueLabel: perdidos.length + "" }, { label: "Sin definición", value: presentados.length, color: T.accent, valueLabel: presentados.length + "" }, { label: "A presentar", value: porPresentar.length, color: T.muted, valueLabel: porPresentar.length + "" }]} centro={lista.length + ""} centroSub="total" />
    <GraficoBarras titulo="Monto por estado" items={[{ label: "Ganado", value: montoGanado, color: T.ok }, { label: "No cerrado", value: montoPerdido, color: "#EF4444" }, { label: "Sin definición", value: presentados.reduce((a, p) => a + num(p.monto), 0), color: T.accent }]} />
    {abrir && <div style={{ background: T.bg, borderRadius: 11, padding: 12, marginTop: 4 }}>
      <input value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} placeholder="Nombre del proyecto / obra" style={{ ...inp, marginTop: 0 }} />
      <input value={f.cliente} onChange={e => setF({ ...f, cliente: e.target.value })} placeholder="Cliente (opcional)" style={inp} />
      <div style={{ display: "flex", gap: 8 }}>
        <input value={f.monto} onChange={e => setF({ ...f, monto: fmtMiles(e.target.value) })} inputMode="numeric" placeholder="Monto $" style={{ ...inp, flex: 1 }} />
        <select value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} style={{ ...inp, flex: 1 }}>{EST_PRES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <div style={{ fontSize: 10.5, color: T.muted, margin: "6px 0 2px" }}>Fecha límite (para presentar) o de presentación</div>
      <input type="date" value={f.fechaLimite} onChange={e => setF({ ...f, fechaLimite: e.target.value })} style={{ ...inp, marginTop: 0 }} />
      <button onClick={add} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Agregar presupuesto</button>
    </div>}
    {lista.slice().reverse().map(p => { const atrasado = p.estado === "por_presentar" && p.fechaLimite && p.fechaLimite < hoy; return (<div key={p.id} style={{ background: T.bg, borderRadius: 12, padding: 12, marginTop: 10, border: atrasado ? "1px solid rgba(239,68,68,.5)" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 13.5, fontWeight: 800 }}>{p.nombre}</div>{p.cliente && <div style={{ fontSize: 11, color: T.sub }}>{p.cliente}</div>}</div><button onClick={() => del(p.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer" }}>Eliminar</button></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, fontSize: 12 }}><b>{money(num(p.monto))}</b><span style={{ color: atrasado ? "#EF4444" : T.muted, fontWeight: atrasado ? 700 : 400 }}>{p.fechaLimite ? (atrasado ? "⚠ vencido " : "") + fmtISO(p.fechaLimite) : "sin fecha"}</span></div>
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>{EST_PRES.map(([k, l]) => <button key={k} onClick={() => upd(p.id, { estado: k })} style={{ flex: 1, background: p.estado === k ? COL[k] : "transparent", color: p.estado === k ? "#fff" : T.sub, border: `1px solid ${p.estado === k ? COL[k] : T.border}`, borderRadius: 7, padding: "7px 2px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}</div>
      {p.estado === "perdido" && <input value={p.motivo || ""} onChange={e => upd(p.id, { motivo: e.target.value })} placeholder="Motivo por el que no se cerró…" style={{ ...inpSm, width: "100%", boxSizing: "border-box", marginTop: 8 }} />}
    </div>); })}
    {lista.length === 0 && !abrir && <div style={{ fontSize: 12, color: T.muted, marginTop: 10, textAlign: "center" }}>Tocá "+ Nuevo" para cargar un presupuesto y seguir su efectividad.</div>}
  </div>);
}
function SociedadWrap({ data, save }) {
  const [vista, setVista] = useState("obras");
  return (<div>
    <div style={{ display: "flex", gap: 6, background: T.card, borderRadius: 11, padding: 4, marginBottom: 12, boxShadow: SHDsm }}>
      {[["obras", "Obras"], ["presupuestos", "Presupuestos"]].map(([k, l]) => <button key={k} onClick={() => setVista(k)} style={{ flex: 1, background: vista === k ? T.accent : "transparent", color: vista === k ? "#fff" : T.sub, border: "none", borderRadius: 8, padding: "9px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
    </div>
    {vista === "obras" ? <SociedadPanel data={data} save={save} /> : <PresupuestosPanel data={data} save={save} />}
  </div>);
}
function matchEnt(lista, nombre) { const n = String(nombre || "").trim().toLowerCase(); if (!n) return null; return (lista || []).find(x => String(x.nombre || "").trim().toLowerCase() === n) || (lista || []).find(x => { const e = String(x.nombre || "").trim().toLowerCase(); return e && (e.includes(n) || n.includes(e)); }) || null; }
function rubroMatch(r) { const n = String(r || "").trim().toLowerCase(); if (!n) return "Otros"; return RUBROS_PROPIA.find(x => x.toLowerCase() === n) || RUBROS_PROPIA.find(x => x.toLowerCase().includes(n) || n.includes(x.toLowerCase())) || r; }
function accionAplicable(data, a) {
  if (!a) return false;
  if (a.operacion === "contacto") { if (a.tipo === "borrar") return (data.contactos || []).some(c => String(c.nombre || "").trim().toLowerCase() === String(a.nombre || a.objetivo || "").trim().toLowerCase()); return !!String(a.nombre || a.objetivo || "").trim(); }
  if (a.operacion === "presupuesto") return true;
  if (a.operacion === "obra") return !!String(a.nombre || a.objetivo || a.rubro || "").trim();
  if (a.operacion === "socio") return !!matchEnt(data.sociedad || [], a.objetivo);
  if (a.operacion === "unidad") return !!matchEnt(data.edificios || [], a.objetivo);
  if (a.modelo === "cliente") return true;
  if (a.modelo === "particular") return !!matchEnt(data.propias || [], a.objetivo);
  if (a.modelo === "edificio") return !!matchEnt(data.edificios || [], a.objetivo);
  if (a.modelo === "sociedad") return !!matchEnt(data.sociedad || [], a.objetivo);
  return false;
}
function aplicarAccion(data, a) {
  if (!accionAplicable(data, a)) return null;
  const monto = num(a.monto); const fecha = a.fecha || hoyISO(); const moneda = a.moneda === "usd" ? "usd" : "ars"; const cotiz = num(a.cotizacion); const borrar = a.tipo === "borrar";
  const dual = () => { let ars, usdv; if (moneda === "usd") { usdv = monto; ars = cotiz > 0 ? monto * cotiz : 0; } else { ars = monto; usdv = cotiz > 0 ? monto / cotiz : 0; } return { montoArs: ars, montoUsd: usdv }; };
  if (a.operacion === "contacto") {
    const nombre = String(a.nombre || a.objetivo || "").trim();
    if (borrar) { const seen = false; const nc = (data.contactos || []).filter(c => String(c.nombre || "").trim().toLowerCase() !== nombre.toLowerCase()); return { ...data, contactos: nc }; }
    const tipoC = /socio/i.test(String(a.rubro || a.nota || a.operacion || "")) ? "socio" : "cliente";
    return { ...data, contactos: [...(data.contactos || []), { id: uid(), nombre, telefono: String(a.telefono || "").trim(), tipo: tipoC, obraId: "", ts: Date.now() }] };
  }
  if (a.operacion === "socio") { const s = matchEnt(data.sociedad || [], a.objetivo); if (!s) return null; if (borrar) return { ...data, sociedad: data.sociedad.map(x => x.id === s.id ? { ...x, socios: (x.socios || []).filter(so => String(so.nombre || "").trim().toLowerCase() !== String(a.nombre || "").trim().toLowerCase()) } : x) }; return { ...data, sociedad: data.sociedad.map(x => x.id === s.id ? { ...x, socios: [...(x.socios || []), { id: uid(), nombre: String(a.nombre || "").trim(), pct: num(a.pct), tel: String(a.telefono || "").trim() }] } : x) }; }
  if (a.operacion === "unidad") { const e = matchEnt(data.edificios || [], a.objetivo); if (!e) return null; const d = dual(); return { ...data, edificios: data.edificios.map(x => x.id === e.id ? { ...x, unidades: [...(x.unidades || []), { id: uid(), nombre: a.rubro || a.nombre || "Unidad", m2: num(a.m2), precioUsd: d.montoUsd, precioArs: d.montoArs, cotiz, estado: "disponible", ts: Date.now() }] } : x) }; }
  if (a.operacion === "presupuesto") { return { ...data, presupuestosSoc: [...(data.presupuestosSoc || []), { id: uid(), nombre: a.objetivo || a.rubro || "Presupuesto", cliente: a.nota || "", monto, estado: "presentado", fechaLimite: a.fecha || "", motivo: "", ts: Date.now() }] }; }
  if (a.operacion === "obra") {
    const nombre = String(a.nombre || a.objetivo || a.rubro || "").trim(); if (!nombre) return null;
    const rubros = Array.isArray(a.rubros) && a.rubros.length ? a.rubros.map(r => ({ id: uid(), nombre: r.nombre || r.rubro || "Rubro", pct: num(r.pct) })) : [{ id: uid(), nombre: "General", pct: 100 }];
    const inicio = a.fecha || hoyISO();
    const obra = { id: uid(), nombre, inicio, mesBase: inicio.slice(0, 7), plazoMeses: num(a.plazoMeses) || 12, anticipoTipo: "pct", anticipoPct: num(a.anticipoPct), anticipoMontoFijo: 0, imprevistosPct: 5, m2: num(a.m2), precioCliente: num(a.precioM2 != null ? a.precioM2 : a.precioCliente), costoM2: num(a.costoM2), rubros, costoExtra: [], firmasPresup: {} };
    return { ...data, obras: [...(data.obras || []), obra] };
  }
  if (a.modelo === "particular") { const p = matchEnt(data.propias || [], a.objetivo); if (!p) return null; const d = dual(); return { ...data, propias: data.propias.map(x => x.id === p.id ? { ...x, costos: [...(x.costos || []), { id: uid(), cat: rubroMatch(a.rubro), moneda, monto, cotiz, montoArs: d.montoArs, montoUsd: d.montoUsd, nota: a.nota || "", ts: Date.now() }] } : x) }; }
  if (a.modelo === "edificio") { const e = matchEnt(data.edificios || [], a.objetivo); if (!e) return null; const d = dual(); return { ...data, edificios: data.edificios.map(x => x.id === e.id ? { ...x, costos: [...(x.costos || []), { id: uid(), cat: rubroMatch(a.rubro), moneda, monto, cotiz, montoArs: d.montoArs, montoUsd: d.montoUsd, ts: Date.now() }] } : x) }; }
  if (a.modelo === "sociedad") { const s = matchEnt(data.sociedad || [], a.objetivo); if (!s) return null; const campo = a.operacion === "cobro" ? "cobros" : a.operacion === "adicional" ? "adicionales" : a.operacion === "retiro" ? "retiros" : "gastos"; const item = campo === "gastos" ? { id: uid(), texto: a.rubro || a.nota || "Gasto", tipo: /imprev/i.test(String(a.rubro || a.nota || "")) ? "imprevisto" : "normal", monto, fecha, ts: Date.now() } : { id: uid(), texto: a.rubro || a.nota || campo, monto, fecha, ts: Date.now() }; return { ...data, sociedad: data.sociedad.map(x => x.id === s.id ? { ...x, [campo]: [...(x[campo] || []), item] } : x) }; }
  if (a.modelo === "cliente") { const o = matchEnt(data.obras || [], a.objetivo); if (a.operacion === "cobro" || a.operacion === "pago") return { ...data, movimientos: [...(data.movimientos || []), { id: uid(), tipo: a.operacion, obraId: o ? o.id : "", monto, fecha, nota: a.nota || a.rubro || "", ts: Date.now() }] }; return { ...data, gastos: [...(data.gastos || []), { id: uid(), cat: a.rubro || "Otros", obraId: o ? o.id : "", monto, fecha, nota: a.nota || "", ts: Date.now() }] }; }
  return null;
}
function descAccion(a) {
  const m = num(a.monto); const mtxt = m ? (money(m) + (a.moneda === "usd" ? " US$" : "")) : "";
  if (a.operacion === "contacto") return (a.tipo === "borrar" ? "Borrar contacto: " : "Agregar contacto: ") + (a.nombre || a.objetivo || "");
  if (a.operacion === "socio") return (a.tipo === "borrar" ? "Borrar socio " : "Agregar socio ") + (a.nombre || "") + (a.pct ? ` (${num(a.pct)}%)` : "") + " · " + (a.objetivo || "");
  if (a.operacion === "unidad") return "Agregar unidad " + (a.rubro || a.nombre || "") + (mtxt ? " " + mtxt : "") + " · " + (a.objetivo || "");
  if (a.operacion === "presupuesto") return "Agregar presupuesto " + (a.objetivo || "") + (mtxt ? " " + mtxt : "");
  if (a.operacion === "obra") { const nom = String(a.nombre || a.objetivo || a.rubro || "").trim(); return "Crear obra/presupuesto: " + nom + (a.m2 ? ` · ${num(a.m2)} m²` : "") + (a.precioM2 ? ` · $${num(a.precioM2)}/m² cliente` : "") + (a.costoM2 ? ` · costo $${num(a.costoM2)}/m²` : ""); }
  const op = a.operacion === "cobro" ? "Cobro" : a.operacion === "pago" ? "Pago" : a.operacion === "adicional" ? "Adicional" : a.operacion === "retiro" ? "Retiro" : a.operacion === "costo" ? "Costo" : "Gasto";
  return op + (mtxt ? " " + mtxt : "") + (a.rubro ? ` · ${a.rubro}` : "") + " · " + (a.objetivo || "sin asignar");
}
function AsistenteCargaTab({ data, save }) {
  const [texto, setTexto] = useState(""); const [files, setFiles] = useState([]); const [cargando, setCargando] = useState(false); const [msgs, setMsgs] = useState(() => { try { const l = localStorage.getItem("vv_ia_chat"); return l ? JSON.parse(l) : []; } catch { return []; } }); const [acciones, setAcciones] = useState([]); const [error, setError] = useState(""); const [subLogo, setSubLogo] = useState(false); const [mostrarTexto, setMostrarTexto] = useState(false);
  const taRef = useRef(null);
  useEffect(() => { try { const s = JSON.stringify(msgs.slice(-40)); localStorage.setItem("vv_ia_chat", s); storage.set("vv_ia_chat", s); } catch { } }, [msgs]);
  useEffect(() => { if (msgs.length === 0) { (async () => { try { const r = await storage.get("vv_ia_chat"); if (r && r.value) { const arr = JSON.parse(r.value); if (Array.isArray(arr) && arr.length) setMsgs(arr); } } catch { } })(); } }, []);
  const enfocar = () => { setMostrarTexto(true); setTimeout(() => { try { taRef.current && taRef.current.focus(); } catch { } }, 60); };
  const comprimirImg = (file) => new Promise((res) => { try { const img = new window.Image(); const url = URL.createObjectURL(file); img.onload = () => { let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; const max = 1600; if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); } const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); const durl = c.toDataURL("image/jpeg", 0.8); URL.revokeObjectURL(url); res({ b64: durl.split(",")[1], media: "image/jpeg" }); }; img.onerror = () => { URL.revokeObjectURL(url); res(null); }; img.src = url; } catch { res(null); } });
  async function subirLogo(file) { if (!file) return; setSubLogo(true); try { const url = await subirArchivo(file); if (url) save({ ...data, config: { ...(data.config || {}), logo: url } }); else alert("No se pudo subir el logo."); } catch { alert("No se pudo subir el logo."); } setSubLogo(false); }
  const ents = { cliente: (data.obras || []).map(o => o.nombre), particular: (data.propias || []).map(p => p.nombre), sociedad: (data.sociedad || []).map(s => s.nombre), edificio: (data.edificios || []).map(e => e.nombre) };
  const socNames = (data.sociedad || []).flatMap(s => (s.socios || []).map(so => so.nombre));
  const contNames = (data.contactos || []).map(c => c.nombre);
  const system = `Sos el asistente de una app financiera de una constructora argentina (V+V). El usuario te habla en español rioplatense (vos) o te manda fotos/PDF de facturas, remitos o documentación. Tu tarea es entender qué quiere cargar, modificar o borrar y devolver SOLO un JSON valido (sin markdown, sin texto fuera del JSON):
{"respuesta":"<mensaje corto y claro al usuario, en español rioplatense>","acciones":[{"tipo":"agregar|borrar","modelo":"cliente|particular|sociedad|edificio","operacion":"gasto|cobro|pago|adicional|retiro|costo|contacto|socio|unidad|presupuesto|obra","objetivo":"<obra/entidad donde va, exacta de las listas>","rubro":"<rubro/concepto>","monto":<entero sin puntos>,"moneda":"ars|usd","cotizacion":<numero o null>,"fecha":"YYYY-MM-DD o null","nombre":"<para contacto/socio/obra>","telefono":"<opcional>","pct":<para socio, numero o null>,"m2":<para obra/unidad o null>,"precioM2":<precio venta al cliente por m2, para obra>,"costoM2":<costo por m2, para obra>,"plazoMeses":<para obra>,"anticipoPct":<para obra>,"rubros":[{"nombre":"<rubro>","pct":<incidencia %>}],"nota":"<texto>","confianza":"alta|media|baja","falta":"<que falta o vacio>"}]}
Listas actuales:
- Obras cliente: ${ents.cliente.join(", ") || "(ninguna)"}
- Particular: ${ents.particular.join(", ") || "(ninguna)"}
- Sociedad: ${ents.sociedad.join(", ") || "(ninguna)"}
- Edificios: ${ents.edificio.join(", ") || "(ninguna)"}
- Socios cargados: ${socNames.join(", ") || "(ninguno)"}
- Contactos en agenda: ${contNames.join(", ") || "(ninguno)"}
Reglas: El usuario SIEMPRE indica dónde cargar (ej: "cargar en sociedad un pago para el plomero de 50000" => modelo sociedad, operacion gasto, rubro "plomero", monto 50000). Si dice "anotá/anótame un gasto" SIN decir la obra (ej: "anotá 50000 de nafta"), usá modelo "cliente", operacion "gasto", rubro el concepto (nafta), objetivo "" (queda sin asignar; el usuario le pone la obra después en la planilla de Gastos). Para CREAR un presupuesto de obra de cliente usá operacion "obra" con nombre, m2, precioM2 (precio de venta al cliente por m2), costoM2 (costo por m2), plazoMeses, anticipoPct y rubros [{nombre,pct}] si los da; lo que no diga, dejalo en null/0. Convertí montos a entero (2.000.500 => 2000500). "dólares/USD/u$s" => usd, si no aclara => ars. Para particular y edificio la operacion de costos es "costo". Para agenda usá operacion "contacto" (nombre + telefono; poné "socio" en rubro si es socio, si no cliente). Para borrar personas: tipo "borrar", operacion "contacto", nombre. Si un PDF/foto tiene varias líneas, una acción por línea. NUNCA borres algo si no estás seguro; ante la duda no lo pongas y pedí aclaración en "respuesta". Si falta info, confianza "baja" y detallá en "falta". Si el usuario solo pregunta o saluda, devolvé acciones vacías y respondé en "respuesta". Hoy es ${hoyISO()}.`;
  const toB64 = (f) => new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(",")[1]); rd.onerror = () => rej(new Error("no se pudo leer")); rd.readAsDataURL(f); });
  const hablar = (txt) => { try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = "es-AR"; window.speechSynthesis.speak(u); } catch { } };
  const escuchar = () => { try { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { enfocar(); alert("Para dictar en el iPhone: tocá el micrófono del teclado (al lado de la barra espaciadora)."); return; } const rec = new SR(); rec.lang = "es-AR"; rec.interimResults = false; rec.onresult = (e) => setTexto(t => (t ? t + " " : "") + e.results[0][0].transcript); rec.onerror = () => enfocar(); rec.start(); } catch { enfocar(); alert("Usá el micrófono del teclado para dictar."); } };
  async function enviar() {
    if (!texto.trim() && !files.length) return;
    const userText = texto.trim() || "(archivos adjuntos)";
    setMsgs(m => [...m, { role: "user", text: userText }]); setTexto(""); setCargando(true); setError(""); setAcciones([]);
    try {
      const content = []; const extras = [];
      for (const f of files) { if (f.type === "application/pdf") { const b64 = await toB64(f); content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }); } else if ((f.type || "").startsWith("image/")) { const c = await comprimirImg(f); if (c) content.push({ type: "image", source: { type: "base64", media_type: c.media, data: c.b64 } }); else { const b64 = await toB64(f); content.push({ type: "image", source: { type: "base64", media_type: f.type || "image/jpeg", data: b64 } }); } } else { extras.push(f.name); } }
      content.push({ type: "text", text: userText + (extras.length ? `\n(También adjunté archivos que no se leen solos: ${extras.join(", ")})` : "") });
      setFiles([]);
      const history = msgs.slice(-4).map(mm => ({ role: mm.role, content: mm.text }));
      const body = { model: "claude-sonnet-5", max_tokens: 3000, system, messages: [...history, { role: "user", content }] };
      const r = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); if (!r.ok) throw new Error((d && d.error && d.error.message) || ("Error " + r.status));
      const txt = (d.content || []).filter(x => x.type === "text").map(x => x.text).join("\n");
      let parsed = { respuesta: "", acciones: [] };
      try { const j = txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1); parsed = JSON.parse(j); } catch { parsed.respuesta = txt || "No pude interpretarlo."; }
      setMsgs(m => [...m, { role: "assistant", text: parsed.respuesta || "Listo." }]);
      setAcciones((parsed.acciones || []).map(a => ({ ...a, _id: uid() })));
    } catch (e) { setError("No pude procesarlo (" + (e && e.message) + "). Si es una foto o PDF muy pesado, probá con una más liviana o escribime los datos."); setMsgs(m => [...m, { role: "assistant", text: "Tuve un problema para procesarlo. Probá de nuevo o escribime los datos." }]); }
    setCargando(false);
  }
  const confirmar = (a) => { const nd = aplicarAccion(data, a); if (!nd) { alert("No pude aplicarlo. Revisá que la obra/persona exista y el nombre coincida."); return; } save(nd); setAcciones(prev => prev.filter(x => x._id !== a._id)); setMsgs(m => [...m, { role: "assistant", text: "✓ Cargado: " + descAccion(a) }]); };
  const confirmarTodo = () => { let nd = data; const ok = []; acciones.forEach(a => { const r = aplicarAccion(nd, a); if (r) { nd = r; ok.push(a._id); } }); if (ok.length) save(nd); setAcciones(prev => prev.filter(x => !ok.includes(x._id))); if (ok.length) setMsgs(m => [...m, { role: "assistant", text: `✓ Cargué ${ok.length} cosa(s).` }]); if (ok.length < acciones.length) alert("Algunas no las pude cargar (revisá la obra/persona)."); };
  const descartar = (id) => setAcciones(prev => prev.filter(x => x._id !== id));
  const vacio = msgs.length === 0 && acciones.length === 0 && !cargando;
  return (<div style={{ padding: "14px 16px 40px" }}>
    <div style={{ textAlign: "center", marginBottom: 16, marginTop: 4 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, letterSpacing: "0.14em", textTransform: "uppercase" }}>Asistente V+V</div>
      <div style={{ fontSize: 13, color: T.sub, marginTop: 5, lineHeight: 1.4 }}>Hablale para cargar, o subí fotos/PDF.<br />Siempre te muestro qué entendí y vos confirmás.</div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 16 }}>
      <div onClick={escuchar} style={{ width: "min(74vw, 250px)", aspectRatio: "1", background: T.card, border: `2px solid ${T.accent}`, borderRadius: 22, boxShadow: SHD, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, position: "relative" }}>
        {data.config && data.config.logo ? <img src={data.config.logo} alt="logo" style={{ width: 96, height: 96, borderRadius: 18, objectFit: "cover", background: "#fff" }} /> : <div style={{ fontSize: 54 }}>🎤</div>}
        <div style={{ fontSize: 16, fontWeight: 800, color: T.accent }}>🎤 Hablarle a la IA</div>
        <label onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 10, right: 10, background: T.al, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 9px", fontSize: 10.5, fontWeight: 700, color: T.sub, cursor: "pointer" }}>{subLogo ? "…" : "✎ logo"}<input type="file" accept="image/*" onChange={e => { subirLogo(e.target.files && e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} /></label>
      </div>
      <label style={{ width: "min(74vw, 250px)", aspectRatio: "1", background: T.card, border: `2px dashed ${T.accent}`, borderRadius: 22, boxShadow: SHD, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 54 }}>📎</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.accent }}>Subir fotos / archivos</div>
        <div style={{ fontSize: 11, color: T.muted }}>fotos, video, PDF, documentos</div>
        <input type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple onChange={e => { setFiles(Array.from(e.target.files || [])); e.target.value = ""; }} style={{ display: "none" }} />
      </label>
    </div>
    {files.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>{files.map((f, i) => <span key={i} style={{ fontSize: 11, background: T.al, color: T.sub, borderRadius: 7, padding: "5px 9px" }}>{f.type === "application/pdf" ? "📄" : "🖼"} {f.name.slice(0, 22)}</span>)}</div>}
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
      <textarea ref={taRef} value={texto} onChange={e => setTexto(e.target.value)} placeholder='Escribile a la IA qué cargar…' style={{ ...inp, minHeight: 48, resize: "vertical", marginTop: 0, flex: 1 }} />
      <button onClick={enviar} disabled={cargando || (!texto.trim() && !files.length)} style={{ background: cargando || (!texto.trim() && !files.length) ? T.muted : T.accent, color: "#fff", border: "none", borderRadius: 11, padding: "12px 18px", fontSize: 14, fontWeight: 800, cursor: cargando ? "default" : "pointer" }}>{cargando ? "…" : "Enviar"}</button>
    </div>
    {msgs.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Conversación</span><button onClick={() => { setMsgs([]); setAcciones([]); try { localStorage.setItem("vv_ia_chat", "[]"); storage.set("vv_ia_chat", "[]"); } catch { } }} style={{ background: "none", border: `1px solid ${T.border}`, color: T.sub, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>＋ Nueva</button></div>}
    {msgs.map((mm, i) => <div key={i} style={{ display: "flex", justifyContent: mm.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div style={{ maxWidth: "85%", background: mm.role === "user" ? T.accent : T.card, color: mm.role === "user" ? "#fff" : T.text, border: mm.role === "user" ? "none" : `1px solid ${T.border}`, borderRadius: 13, padding: "10px 13px", fontSize: 13, lineHeight: 1.45, boxShadow: SHDsm }}>
        {mm.text}
        {mm.role === "assistant" && <button onClick={() => hablar(mm.text)} title="Escuchar" style={{ background: "none", border: "none", color: T.accent, cursor: "pointer", fontSize: 14, marginLeft: 6 }}>🔊</button>}
      </div>
    </div>)}
    {cargando && <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: "8px 0" }}>Pensando…</div>}
    {error && <div style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.4)", borderRadius: 10, padding: "11px 13px", fontSize: 12.5, color: "#EF4444", margin: "6px 0" }}>{error}</div>}
    {acciones.length > 1 && <button onClick={confirmarTodo} style={{ width: "100%", background: T.ok, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", margin: "8px 0" }}>Confirmar y aplicar todo ({acciones.length})</button>}
    {acciones.map(a => { const ap = accionAplicable(data, a); const esBorrar = a.tipo === "borrar"; return (<div key={a._id} style={{ background: T.card, border: `1px solid ${!ap ? "rgba(239,68,68,.45)" : esBorrar ? "rgba(239,68,68,.35)" : T.border}`, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: SHDsm }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: esBorrar ? "#EF4444" : T.accent, background: esBorrar ? "rgba(239,68,68,.12)" : T.al, borderRadius: 6, padding: "3px 8px", textTransform: "uppercase" }}>{esBorrar ? "Borrar" : "Cargar"}</span>
        {a.confianza && <span style={{ fontSize: 10, fontWeight: 700, color: a.confianza === "alta" ? T.ok : a.confianza === "media" ? T.warn : "#EF4444" }}>{a.confianza}</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{descAccion(a)}</div>
      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{fmtISO(a.fecha || hoyISO())}{a.cotizacion ? ` · cotiz ${num(a.cotizacion)}` : ""}{a.nota && a.operacion !== "presupuesto" ? ` · ${a.nota}` : ""}</div>
      {!ap && <div style={{ fontSize: 11, color: "#EF4444", marginTop: 5, fontWeight: 700 }}>⚠ No encontré "{a.objetivo || a.nombre}". Revisá el nombre o cargalo primero.</div>}
      {a.falta && ap && <div style={{ fontSize: 11, color: T.warn, marginTop: 5 }}>Revisá: {a.falta}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => confirmar(a)} disabled={!ap} style={{ flex: 1, background: !ap ? T.muted : esBorrar ? "#EF4444" : T.ok, color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: ap ? "pointer" : "default" }}>{esBorrar ? "Confirmar borrado" : "Confirmar y cargar"}</button>
        <button onClick={() => descartar(a._id)} style={{ background: T.bg, color: T.sub, border: `1px solid ${T.border}`, borderRadius: 9, padding: "11px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Descartar</button>
      </div>
    </div>); })}
  </div>);
}
function ResultadoTab({ obras, certs, certsDe, indices, data, save }) {
  const [pin, setPin] = useState(""); const [ok, setOk] = useState(false); const [subtab, setSubtab] = useState("cliente");
  const [estimPct, setEstimPct] = useState("");
  const PIN = (() => { try { return localStorage.getItem("finanzas_pin") || "1234"; } catch { return "1234"; } })();
  if (!ok) return (<div style={{ padding: "40px 24px", textAlign: "center" }}>
    <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div><div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Resultado — privado</div>
    <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 18 }}>Solo para vos. Ingresá tu clave.</div>
    <input value={pin} onChange={e => setPin(e.target.value)} type="password" inputMode="numeric" placeholder="Clave" style={{ ...inp, maxWidth: 200, margin: "0 auto", textAlign: "center", letterSpacing: 4 }} onKeyDown={e => { if (e.key === "Enter") { if (pin === PIN) setOk(true); else alert("Clave incorrecta."); } }} />
    <button onClick={() => { if (pin === PIN) setOk(true); else alert("Clave incorrecta."); }} style={{ display: "block", margin: "12px auto 0", background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "11px 26px", fontWeight: 700, cursor: "pointer" }}>Entrar</button>
    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 14 }}>Clave por defecto: 1234</div>
  </div>);

  const est = data.estructura || {};
  const mensual = num(est.mensual), nObras = num(est.nObras);
  const cuota = nObras > 0 ? mensual / nObras : 0; // costo fijo por obra por MES
  const cuotaQ = cuota / 2; // por quincena (cada certificado)
  const setEst = (k, v) => save({ ...data, estructura: { ...(data.estructura || {}), [k]: v } });

  let totFact = 0, totCobro = 0, totCostoDir = 0, totImpuestos = 0, totUtil = 0, totFijo = 0, totImprev = 0, provisCount = 0, provisMonto = 0; const porObra = {}; const provisMeses = new Set();
  certs.forEach(c => { const o = obras.find(x => x.id === c.obraId); if (!o) return; const r = calcCert(c, o, certsDe(c.obraId), indices); const imp = r.extraMontoPeriodo + r.extraPctPeriodo; totFact += r.ajustado; totCobro += r.neto; totCostoDir += r.costoDirPeriodo; totImpuestos += imp; totImprev += r.imprevPeriodo; totUtil += (r.ajustado - r.costoDirPeriodo); if (r.provisorio) { provisCount++; provisMonto += r.ajustado; provisMeses.add(mesDe(c.fecha)); } if (!porObra[o.id]) porObra[o.id] = { nombre: o.nombre, fact: 0, cobro: 0, costoDir: 0, impuestos: 0, imprev: 0, util: 0, nCert: 0, gastos: 0, imprevAcum: 0, imprevUsado: 0, anticipo: anticipoDe(o), amort: 0, presupCli: presupCliente(o), presupCos: presupCosto(o) }; const p = porObra[o.id]; p.fact += r.ajustado; p.cobro += r.neto; p.costoDir += r.costoDirPeriodo; p.impuestos += imp; p.imprev += r.imprevPeriodo; p.util += (r.ajustado - r.costoDirPeriodo); p.nCert += 1; p.imprevAcum += r.imprevPeriodo; p.amort += r.amort; });
  const gastosArr = data.gastos || []; let totGastos = 0, usadoImprev = 0; const imprevPorCat = {};
  gastosArr.forEach(g => { if (esImprev(g.cat)) { const mm = num(g.monto); usadoImprev += mm; imprevPorCat[g.cat] = (imprevPorCat[g.cat] || 0) + mm; if (g.obraId && porObra[g.obraId]) porObra[g.obraId].imprevUsado += mm; return; } totGastos += num(g.monto); if (g.obraId && porObra[g.obraId]) porObra[g.obraId].gastos += num(g.monto); });
  const saldoImprev = totImprev - usadoImprev;
  const gastosPorCat = {}; gastosArr.forEach(g => { if (esImprev(g.cat)) return; gastosPorCat[g.cat || "Otro"] = (gastosPorCat[g.cat || "Otro"] || 0) + num(g.monto); });
  Object.values(porObra).forEach(p => { p.fijo = cuotaQ * p.nCert; totFijo += p.fijo; p.costo = p.costoDir; p.res = p.util - p.impuestos - p.imprev - p.fijo - p.gastos; p.restoCobrar = Math.max(0, p.presupCli - p.cobro); p.restoPagar = Math.max(0, p.presupCos - p.costoDir); });
  const totCosto = totCostoDir;
  const totRes = totUtil - totImpuestos - totImprev - totFijo - totGastos;
  const movs = data.movimientos || [];
  const cobroReal = movs.filter(m => m.tipo === "cobro").reduce((s, m) => s + num(m.monto), 0);
  const pagoReal = movs.filter(m => m.tipo === "pago").reduce((s, m) => s + num(m.monto), 0);
  const saldoCaja = cobroReal - pagoReal - totGastos;
  const arr = Object.values(porObra);
  const totPresupCli = arr.reduce((s, p) => s + p.presupCli, 0);
  const totRestoCobrar = arr.reduce((s, p) => s + p.restoCobrar, 0);
  const totRestoPagar = arr.reduce((s, p) => s + p.restoPagar, 0);
  const avanceGen = totPresupCli > 0 ? totFact / totPresupCli * 100 : 0;
  const margenGen = totFact > 0 ? totRes / totFact * 100 : 0;
  const fijoPctUtil = totUtil > 0 ? totFijo / totUtil * 100 : 0;
  // Proyección de utilidad esperada según plazo de obra
  const proy = {};
  obras.forEach(o => { const pm = num(o.plazoMeses); if (pm <= 0) return; const utilTot = presupCliente(o) - presupCosto(o); const utilMes = utilTot / pm; const b = (o.inicio || hoyISO()).slice(0, 7).split("-").map(Number); for (let i = 0; i < pm; i++) { const d = new Date(b[0], b[1] - 1 + i, 1); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; proy[key] = (proy[key] || 0) + utilMes - cuota; } });
  const proyMeses = Object.keys(proy).sort();
  const utilEsperadaNeta = proyMeses.reduce((s, k) => s + proy[k], 0);
  const utilMensualProm = proyMeses.length ? utilEsperadaNeta / proyMeses.length : 0;
  const hayPlazo = obras.some(o => num(o.plazoMeses) > 0);
  const totalQuincenas = obras.reduce((s, o) => s + quincenasObra(o), 0);
  const utilPorQuincena = totalQuincenas > 0 ? utilEsperadaNeta / totalQuincenas : 0;
  const nCertsTot = arr.reduce((s, p) => s + p.nCert, 0);
  const promCobro = nCertsTot > 0 ? totCobro / nCertsTot : 0;
  const promPago = nCertsTot > 0 ? totCosto / nCertsTot : 0;

  return (<div style={{ padding: "14px 16px 40px" }}>
    <div style={{ display: "flex", gap: 3, background: T.card, borderRadius: 12, padding: 4, marginBottom: 14, boxShadow: SHDsm, flexWrap: "wrap" }}>
      {[["general", "General"], ["cliente", "Cliente"], ["particulares", "Particul."], ["sociedad", "Sociedad"], ["edificios", "Edificios"]].map(([k, l]) => <button key={k} onClick={() => setSubtab(k)} style={{ flex: "1 1 30%", background: subtab === k ? T.navy : "transparent", color: subtab === k ? "#fff" : T.sub, border: "none", borderRadius: 8, padding: "9px 2px", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.02em" }}>{l}</button>)}
    </div>
    {subtab === "cliente" && <>
    <div style={{ background: `linear-gradient(155deg, #14263E 0%, ${T.navy} 68%)`, color: "#fff", borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: SHD, border: `1px solid rgba(176,137,79,.28)` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, letterSpacing: "0.1em", textTransform: "uppercase" }}>Resultado operativo</div>
      <div style={{ fontSize: 30, fontWeight: 800, margin: "6px 0 4px", color: totRes >= 0 ? "#7DE0A6" : "#FCA5A5" }}>{money(totRes)}</div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.75)", lineHeight: 1.5 }}>Lo que podés guardar sin comprometer nada. Descontado TODO: costos de obra, impuestos, imprevistos y el costo fijo de estructura.</div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}><span style={{ color: "rgba(255,255,255,.7)" }}>Certificado (facturado)</span><span style={{ fontWeight: 700 }}>{money(totFact)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}><span style={{ color: "rgba(255,255,255,.7)" }}>− Costo de obra</span><span style={{ fontWeight: 700, color: "#FCA5A5" }}>− {money(totCostoDir)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0", borderTop: "1px solid rgba(255,255,255,.1)", marginTop: 3, paddingTop: 5 }}><span style={{ color: "rgba(255,255,255,.85)", fontWeight: 700 }}>= Utilidad de obra</span><span style={{ fontWeight: 800 }}>{money(totUtil)}</span></div>
        {totImpuestos > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}><span style={{ color: "rgba(255,255,255,.7)" }}>− Impuestos / IIBB</span><span style={{ fontWeight: 700, color: "#FCA5A5" }}>− {money(totImpuestos)}</span></div>}
        {totImprev > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}><span style={{ color: "rgba(255,255,255,.7)" }}>− Imprevistos (5% → fondo)</span><span style={{ fontWeight: 700, color: "#FCA5A5" }}>− {money(totImprev)}</span></div>}
        {totFijo > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}><span style={{ color: "rgba(255,255,255,.7)" }}>− Costo fijo de estructura</span><span style={{ fontWeight: 700, color: "#FCA5A5" }}>− {money(totFijo)}</span></div>}
        {totGastos > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}><span style={{ color: "rgba(255,255,255,.7)" }}>− Gastos de obra</span><span style={{ fontWeight: 700, color: "#FCA5A5" }}>− {money(totGastos)}</span></div>}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.12)" }}>
        <div><div style={{ fontSize: 10, color: "rgba(255,255,255,.6)", textTransform: "uppercase" }}>Cobrado</div><div style={{ fontSize: 15, fontWeight: 800 }}>{money(totCobro)}</div></div>
        <div><div style={{ fontSize: 10, color: "rgba(255,255,255,.6)", textTransform: "uppercase" }}>Costo obra</div><div style={{ fontSize: 15, fontWeight: 800, color: "#FCA5A5" }}>{money(totCosto)}</div></div>
      </div>
    </div>

    {hayPlazo && <div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 3 }}>Resultado esperado (proyección)</div>
      <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 12 }}>Utilidad total y flujo mensual según el plazo de cada obra (ya descontada la estructura).</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, background: T.bg, borderRadius: 11, padding: "11px 12px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Utilidad esperada total</div><div style={{ fontSize: 16, fontWeight: 700, color: utilEsperadaNeta >= 0 ? T.ok : "#EF4444", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{money(utilEsperadaNeta)}</div></div>
        <div style={{ flex: 1, background: T.bg, borderRadius: 11, padding: "11px 12px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Promedio por mes</div><div style={{ fontSize: 16, fontWeight: 700, color: T.accent, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{money(utilMensualProm)}</div></div>
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 10 }}>Flujo de utilidad por mes</div>
      {(() => { const mx = Math.max(1, ...proyMeses.map(k => Math.abs(proy[k]))); return proyMeses.map(k => { const v = proy[k]; const pos = v >= 0; return <div key={k} style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11.5, marginBottom: 4 }}><span style={{ color: T.sub, fontWeight: 600 }}>{mesLabel(k)}</span><span style={{ fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums" }}>{money(v)}</span></div>
        <div style={{ height: 4, background: T.bg, borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${Math.abs(v) / mx * 100}%`, height: "100%", background: pos ? T.ok : "#EF4444", opacity: 0.5, borderRadius: 3 }} /></div>
      </div>; }); })()}
      <div style={{ display: "flex", gap: 8, margin: "14px 0 12px" }}>
        <div style={{ flex: 1, background: T.bg, borderRadius: 11, padding: "11px 12px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Certificados quincenales</div><div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{totalQuincenas}</div></div>
        <div style={{ flex: 1, background: T.bg, borderRadius: 11, padding: "11px 12px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Utilidad por quincena</div><div style={{ fontSize: 16, fontWeight: 700, color: T.ok, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{money(utilPorQuincena)}</div></div>
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
        {obras.filter(o => num(o.plazoMeses) > 0).map(o => { const q = quincenasObra(o); const ut = presupCliente(o) - presupCosto(o); return <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0" }}><span style={{ color: T.sub, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.nombre} · {num(o.plazoMeses)}m · {q} quinc.</span><b style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0, marginLeft: 8 }}>{money(q > 0 ? ut / q : 0)}/q</b></div>; })}
      </div>
      <div style={{ background: T.al, borderRadius: 10, padding: "10px 12px", marginTop: 12, fontSize: 11.5, color: T.sub }}>Pagos viernes de por medio (~26 al año). Esta es la utilidad estimada que libera cada quincena para reinvertir o retirar. Es una proyección, no un valor definitivo.</div>
    </div>}

    {!hayPlazo && obras.length > 0 && <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#92400E" }}>Para ver la proyección de utilidad mensual, cargá el <b>plazo (meses)</b> de cada obra en Presupuesto.</div>}

    {arr.length > 0 && <>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <KPI t="Facturado" v={money(totFact)} c={T.accent} />
        <KPI t="Costo obra" v={money(totCostoDir)} c={T.warn} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <KPI t="Resultado" v={money(totRes)} c={totRes >= 0 ? T.ok : "#EF4444"} />
        <KPI t="Margen" v={margenGen.toFixed(1) + "%"} c={T.ok} />
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 10 }}>Composición de lo facturado</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Donut segs={[{ value: totCostoDir, color: T.warn }, { value: totImpuestos, color: "#C2410C" }, { value: totImprev, color: "#D97706" }, { value: totFijo, color: BRASS }, { value: totGastos, color: T.muted }, { value: Math.max(0, totRes), color: T.ok }]} centro={margenGen.toFixed(0) + "%"} centroSub="ganancia" />
          <div style={{ flex: 1, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span><Dot c={T.warn} />Costo de obra</span><b>{money(totCostoDir)}</b></div>
            {totImpuestos > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span><Dot c="#C2410C" />Impuestos/IIBB</span><b>{money(totImpuestos)}</b></div>}
            {totImprev > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span><Dot c="#D97706" />Imprevistos</span><b>{money(totImprev)}</b></div>}
            {totFijo > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span><Dot c={BRASS} />Costo fijo</span><b>{money(totFijo)}</b></div>}
            {totGastos > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span><Dot c={T.muted} />Gastos de obra</span><b>{money(totGastos)}</b></div>}
            <div style={{ display: "flex", justifyContent: "space-between" }}><span><Dot c={T.ok} />Ganancia</span><b style={{ color: totRes >= 0 ? T.ok : "#EF4444" }}>{money(totRes)}</b></div>
          </div>
        </div>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}><span style={{ fontWeight: 700, color: T.sub, textTransform: "uppercase", fontSize: 11 }}>Avance general de cobro</span><b>{avanceGen.toFixed(1)}%</b></div>
        <div style={{ height: 12, background: T.bg, borderRadius: 6, overflow: "hidden" }}><div style={{ width: Math.min(100, avanceGen) + "%", height: "100%", background: BRASS }} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11.5 }}>
          <span style={{ color: T.sub }}>Resto a cobrar <b style={{ color: T.accent }}>{money(totRestoCobrar)}</b></span>
          <span style={{ color: T.sub }}>Resto a pagar <b style={{ color: T.warn }}>{money(totRestoPagar)}</b></span>
        </div>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 12 }}>Resultado por obra</div>
        <BarsH items={arr.map(p => ({ label: p.nombre, value: p.res, color: p.res >= 0 ? T.ok : "#EF4444" }))} />
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 12 }}>Avance por obra</div>
        <BarsH items={arr.map(p => { const av = p.presupCli > 0 ? p.cobro / p.presupCli * 100 : 0; return { label: p.nombre, value: av, valueLabel: av.toFixed(0) + "%", color: BRASS }; })} />
      </div>

      {nCertsTot > 0 && <div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 3 }}>Promedio por certificado</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 12 }}>Sobre {nCertsTot} {nCertsTot === 1 ? "certificado emitido" : "certificados emitidos"}.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: T.bg, borderRadius: 11, padding: "11px 12px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Certificado de cobro</div><div style={{ fontSize: 16, fontWeight: 700, color: T.accent, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{money(promCobro)}</div></div>
          <div style={{ flex: 1, background: T.bg, borderRadius: 11, padding: "11px 12px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Certificado de pago</div><div style={{ fontSize: 16, fontWeight: 700, color: T.warn, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{money(promPago)}</div></div>
        </div>
      </div>}

      {provisCount > 0 && <div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm, borderTop: `3px solid #F59E0B` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 3 }}>Redeterminación pendiente</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 12 }}>Certificados hechos con índice provisorio (falta el definitivo del mes por el atraso del CAC).</div>
        <Line t="Certificados provisorios" v={String(provisCount)} />
        <Line t="Meses sin índice definitivo" v={[...provisMeses].sort().map(mesLabel).join(", ")} />
        <Line t="Certificado a valor provisorio" v={money(provisMonto)} c={T.accent} />
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>Aumento estimado del mes (%)</span><input value={estimPct} onChange={e => setEstimPct(e.target.value)} inputMode="decimal" placeholder="3" style={{ ...inp, marginTop: 0, width: 90, textAlign: "right" }} /></div>
          {num(estimPct) > 0 && <div style={{ background: T.al, borderRadius: 10, padding: "10px 12px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>Diferencia estimada a cobrar</span><Money v={provisMonto * num(estimPct) / 100} c={T.ok} /></div>}
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 10 }}>Cuando cargues el índice real del mes en Cert cliente, la app recalcula sola y esa diferencia queda cobrada. El % estimado es solo una previsión.</div>
      </div>}

      {obras.some(o => anticipoDe(o) > 0) && <div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm, borderTop: `3px solid ${T.accent}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 3 }}>Anticipo (adelanto del cliente)</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 12 }}>Lo que cobraste de adelanto y cuánto te queda disponible. Se va amortizando (descontando) en cada certificado.</div>
        {arr.map((p, i) => { const disp = p.anticipo - p.amort; return (<div key={i} style={{ background: T.bg, borderRadius: 11, padding: "11px 12px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 800 }}>{p.nombre}</span></div>
          <Line t="Anticipo recibido" v={money(p.anticipo)} c={T.accent} />
          <Line t="Amortizado en certificados" v={"− " + money(p.amort)} c={T.warn} />
          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 5, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12.5, fontWeight: 800 }}>Disponible del anticipo</span><Money v={disp} c={disp >= 0 ? T.ok : "#EF4444"} /></div>
        </div>); })}
        {arr.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>Cargá un certificado para ver la amortización del anticipo.</div>}
      </div>}

      {obras.length > 0 && <div style={{ background: T.card, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: SHDsm, borderTop: `3px solid ${BRASS}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 3 }}>Fondo de imprevistos (caja separada)</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 12 }}>El 5% del total del presupuesto se reserva acá (se va acumulando con cada certificado). Cubre seguros del personal, multas de obra y de tránsito. Lo que queda se reparte.</div>
        <Line t="Acumulado (5% del presupuesto)" v={money(totImprev)} c={T.accent} />
        <Line t="Usado en imprevistos" v={"− " + money(usadoImprev)} c={T.warn} />
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 800 }}>Saldo disponible</span><Money v={saldoImprev} c={saldoImprev >= 0 ? T.ok : "#EF4444"} /></div>

        {Object.keys(imprevPorCat).length > 0 && <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Usado por tipo</div>
          {Object.entries(imprevPorCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Line key={k} t={k} v={money(v)} c={T.warn} />)}
        </div>}

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Saldo por obra</div>
          {arr.map((p, i) => { const saldoO = p.imprevAcum - p.imprevUsado; return (<div key={i} style={{ background: T.bg, borderRadius: 10, padding: "9px 11px", marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.nombre}</span><Money v={saldoO} c={saldoO >= 0 ? T.ok : "#EF4444"} /></div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>Acumuló {money(p.imprevAcum)} · usó {money(p.imprevUsado)}</div>
          </div>); })}
        </div>

        {saldoImprev > 0 && <div style={{ background: T.al, borderRadius: 10, padding: "10px 12px", marginTop: 10, fontSize: 11.5, color: T.sub }}>Quedan <b style={{ color: T.ok }}>{money(saldoImprev)}</b> libres para repartir: herramientas o premios al personal administrativo / sobrestantes.</div>}
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Para descontar del fondo, cargá el gasto en Gastos eligiendo un tipo del grupo "Imprevisto (fondo)".</div>
      </div>}

      {totFijo > 0 && <div style={{ background: T.al, borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: T.sub }}>El costo fijo de estructura se lleva el <b style={{ color: T.warn }}>{fijoPctUtil.toFixed(1)}%</b> de la utilidad de las obras.</div>}

      {(cobroReal > 0 || pagoReal > 0 || totGastos > 0) && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 10 }}>Caja real (lo que entró y salió)</div>
        <Line t="Cobrado real" v={money(cobroReal)} c={T.ok} />
        <Line t="Pagado real (proveedores/personal)" v={"− " + money(pagoReal)} c={T.warn} />
        <Line t="Gastos de obra" v={"− " + money(totGastos)} c={T.warn} />
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 5, paddingTop: 6, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 800 }}>Saldo de caja</span><Money v={saldoCaja} c={saldoCaja >= 0 ? T.ok : "#EF4444"} /></div>
      </div>}

      {Object.keys(gastosPorCat).length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 12 }}>Gastos de obra por tipo</div>
        <BarsH items={Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: BRASS }))} />
      </div>}
    </>}

    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: SHDsm, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", marginBottom: 3 }}>Costo fijo de estructura</div>
      <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 10 }}>Capataz, administrativo, sobrestante, etc. (mensual). Se reparte entre las obras que indiques (incluí las que están fuera de esta app).</div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}><span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Costo fijo mensual ($)</span><input value={mensual ? fmtMiles(mensual) : ""} onChange={e => setEst("mensual", numMoney(e.target.value))} inputMode="numeric" placeholder="0" style={{ ...inp, marginTop: 0, width: 130, textAlign: "right" }} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}><span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Dividir entre (obras)</span><input value={nObras || ""} onChange={e => setEst("nObras", num(e.target.value))} inputMode="numeric" placeholder="Ej: 8" style={{ ...inp, marginTop: 0, width: 130, textAlign: "right" }} /></div>
      {cuota > 0 && <div style={{ background: T.bg, borderRadius: 9, padding: 10, marginTop: 4 }}><Line t={`Por obra / mes (÷ ${nObras})`} v={money(cuota)} c={T.warn} /><Line t="Por certificado (quincena)" v={money(cuotaQ)} c={T.warn} /></div>}
    </div>

    {Object.values(porObra).length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "20px" }}>Todavía no hay certificados.</div>}
    {Object.values(porObra).map((p, i) => { const mg = p.fact > 0 ? p.res / p.fact * 100 : 0; const alerta = p.costoDir > p.cobro; return (<div key={i} style={{ background: T.card, border: `1px solid ${alerta ? "#EF4444" : T.border}`, borderRadius: 14, padding: 16, marginBottom: 10, boxShadow: SHDsm }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{p.nombre}</div>
      {alerta && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 10px", fontSize: 11.5, fontWeight: 700, color: "#EF4444", marginBottom: 9 }}>⚠ El costo de obra supera lo cobrado ({money(p.costoDir - p.cobro)} de más).</div>}
      <Line t="Certificado (facturado)" v={money(p.fact)} c={T.accent} />
      <Line t="− Costo de obra" v={money(p.costoDir)} c={T.warn} />
      <div style={{ borderTop: `1px solid ${T.border}`, margin: "4px 0", paddingTop: 4 }}><Line t="= Utilidad de obra" v={money(p.util)} c={T.ok} /></div>
      {p.impuestos > 0 && <Line t="− Impuestos / IIBB" v={money(p.impuestos)} c={T.warn} />}
      {p.imprev > 0 && <Line t="− Imprevistos (5% → fondo)" v={money(p.imprev)} c={T.warn} />}
      {cuotaQ > 0 && <Line t={`− Estructura (${p.nCert} ${p.nCert === 1 ? "cert" : "certs"})`} v={money(p.fijo)} c={T.warn} />}
      {p.gastos > 0 && <Line t="− Gastos de obra" v={money(p.gastos)} c={T.warn} />}
      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 5, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 800 }}>Resultado · margen {mg.toFixed(1)}%</span><Money v={p.res} c={p.res >= 0 ? T.ok : "#EF4444"} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.bg}`, fontSize: 11 }}><span style={{ color: T.muted }}>Resto a cobrar {money(p.restoCobrar)}</span><span style={{ color: T.muted }}>Resto a pagar {money(p.restoPagar)}</span></div>
    </div>); })}
    {(() => { const factMes = {}, cobroMes = {}, pagoMes = {}; certs.forEach(c => { const o = obras.find(x => x.id === c.obraId); if (!o) return; const r = calcCert(c, o, certsDe(c.obraId), indices); const m = mesDe(c.fecha); factMes[m] = (factMes[m] || 0) + r.ajustado; }); (data.movimientos || []).forEach(mv => { const m = mesDe(mv.fecha); if (mv.tipo === "cobro") cobroMes[m] = (cobroMes[m] || 0) + num(mv.monto); else if (mv.tipo === "pago") pagoMes[m] = (pagoMes[m] || 0) + num(mv.monto); }); const mF = Object.keys(factMes).sort(); const mC = Array.from(new Set([...Object.keys(cobroMes), ...Object.keys(pagoMes)])).sort(); return <>
      {mF.length > 0 && <BarrasMes titulo="Facturación por mes" meses={mF} series={[{ nombre: "Facturado", color: T.accent, data: factMes }]} />}
      {mC.length > 0 && <BarrasMes titulo="Cobros vs pagos por mes" meses={mC} series={[{ nombre: "Cobros", color: T.ok, data: cobroMes }, { nombre: "Pagos", color: T.warn, data: pagoMes }]} />}
    </>; })()}
    </>}
    {subtab === "particulares" && <PropiasPanel data={data} save={save} />}
    {subtab === "sociedad" && <SociedadWrap data={data} save={save} />}
    {subtab === "edificios" && <EdificiosPanel data={data} save={save} />}
    {subtab === "general" && <GeneralPanel data={data} obras={obras} certs={certs} certsDe={certsDe} indices={indices} />}
    <button onClick={() => { const n = prompt("Nueva clave (números):", ""); if (n && n.trim()) { try { localStorage.setItem("finanzas_pin", n.trim()); } catch { } alert("Clave actualizada."); } }} style={{ display: "block", margin: "8px auto 0", background: "none", border: "none", color: T.muted, fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>Cambiar clave</button>
  </div>);
}
function proxViernes() { const d = new Date(); const day = d.getDay(); let add = (5 - day + 7) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10); }
