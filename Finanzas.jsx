import React, { useState, useEffect, useRef } from "react";
// VERSION: v44 (resultado desglosado: costo/impuestos/imprevistos/estructura/gastos)

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
const T = { navy: "#0B1622", accent: "#1B3A5B", al: "#EEF2F7", bg: "#F5F5F7", card: "#FFFFFF", border: "#E8EAED", text: "#0B1622", sub: "#5B6673", muted: "#98A2B0", ok: "#16A34A", warn: "#B45309", rsm: 12 };
const SHD = "0 1px 2px rgba(11,22,34,.04), 0 8px 24px -8px rgba(11,22,34,.10)";
const SHDsm = "0 1px 2px rgba(11,22,34,.05), 0 2px 8px -4px rgba(11,22,34,.08)";
const RUBROS_DEF = ["Trabajos preliminares", "Movimiento de suelo", "Estructura", "Albañilería", "Revoques", "Contrapiso", "Carpeta", "Colocación"];
const CAT_GASTO = ["Viáticos", "Combustible", "Fletes", "Comida en obra", "Herramientas", "Alquiler equipos", "Operación de obra", "Otro"];
const IMPREV_CATS = ["Seguro personal", "Multa de obra", "Multa de tránsito", "Otro imprevisto"];
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
  const save = (next) => { lastWrite.t = Date.now(); setData(next); try { localStorage.setItem("vv_finanzas", JSON.stringify(next)); } catch { } storage.set("vv_finanzas", JSON.stringify(next)); };
  return [data, save];
}

// ── Modelo: obra = { m2, precioCliente, costoM2, rubros:[{id,nombre,pct}] }
//    Rubros = solo % de incidencia (sin monto). El monto lo calcula el certificado.
function presupCliente(o) { return num(o?.m2) * num(o?.precioCliente); }
function quincenasObra(o) { const pm = num(o?.plazoMeses); return pm > 0 ? Math.round(pm * 26 / 12) : 0; }
function anticipoDe(o) { return o?.anticipoTipo === "monto" ? num(o?.anticipoMontoFijo) : presupCliente(o) * num(o?.anticipoPct) / 100; }
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
const inp = { width: "100%", background: "#FBFBFD", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 13px", fontSize: 16, color: T.text, boxSizing: "border-box", marginTop: 6, outline: "none", fontVariantNumeric: "tabular-nums" };
const inpSm = { background: "#FBFBFD", border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 8px", fontSize: 15, color: T.text, boxSizing: "border-box", outline: "none" };
function Box({ t, v, c }) { return <div style={{ background: T.bg, borderRadius: 11, padding: "10px 12px" }}><div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>{t}</div><div style={{ fontSize: 14, fontWeight: 700, color: c || T.text, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{v}</div></div>; }
function Line({ t, v, c }) { return <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}><span style={{ color: T.sub }}>{t}</span><span style={{ fontWeight: 600, color: c || T.text, fontVariantNumeric: "tabular-nums" }}>{v}</span></div>; }

export default function App() {
  const [data, save] = useFinanzas();
  const [tab, setTab] = useState("presupuesto");
  const [verConfig, setVerConfig] = useState(false);
  const cfg = data.config || {};
  const obras = data.obras || [], certs = data.certs || [], indices = data.cacMensual || {};
  const certsDe = (id) => certs.filter(c => c.obraId === id).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.ts || 0) - (b.ts || 0)));
  return (<div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", width: "100%", color: T.text }}>
    <style>{`*{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}*:focus{outline:none}input:focus,select:focus{border-color:${BRASS}!important;box-shadow:0 0 0 3px rgba(176,137,79,.12)}::selection{background:rgba(176,137,79,.20)}button{-webkit-tap-highlight-color:transparent;transition:opacity .15s,transform .05s}button:active{transform:scale(.985)}body{margin:0}@media(min-width:1700px){.vv-body{padding-left:calc((100% - 1560px)/2);padding-right:calc((100% - 1560px)/2)}}`}</style>
    <div style={{ background: `linear-gradient(180deg, #0E1B2B 0%, ${T.navy} 100%)`, color: "#fff", padding: "20px 24px 18px", textAlign: "center", position: "relative" }}>
      <button onClick={() => setVerConfig(true)} title="Personalización" style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 9, width: 34, height: 34, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙︎</button>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: cfg.logo ? "#fff" : `linear-gradient(145deg, ${BRASS}, #c9a869)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: T.navy, letterSpacing: "-0.02em", boxShadow: "0 2px 8px rgba(176,137,79,.35)", overflow: "hidden" }}>{cfg.logo ? <img src={cfg.logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : "V+V"}</div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{cfg.nombre || "V+V Construcciones"}</div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: BRASS, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 1 }}>{cfg.subtitulo || "Finanzas y Certificaciones"}</div>
        </div>
      </div>
    </div>
    <div style={{ display: "flex", background: "rgba(255,255,255,.85)", backdropFilter: "saturate(180%) blur(12px)", WebkitBackdropFilter: "saturate(180%) blur(12px)", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 50 }}>
      {[["presupuesto", "Presupuestos"], ["costo", "Cert.", "costo"], ["cliente", "Cert.", "cliente"], ["caja", "Gastos"], ["resultado", "Resultados"]].map(([k, l1, l2]) => (
        <button key={k} onClick={() => setTab(k)} style={{ flex: 1, background: "none", border: "none", color: tab === k ? T.navy : T.muted, padding: "10px 1px 9px", fontSize: 10.5, fontWeight: tab === k ? 700 : 600, cursor: "pointer", position: "relative", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{l1}{l2 ? <><br />{l2}</> : ""}{tab === k && <span style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 24, height: 2.5, background: BRASS, borderRadius: "2px 2px 0 0" }} />}</button>
      ))}
    </div>
    <div className="vv-body">
      {tab === "presupuesto" && <PresupuestoTab obras={obras} data={data} save={save} certsDe={certsDe} indices={indices} />}
      {tab === "costo" && <CertTab modo="costo" obras={obras} data={data} save={save} certsDe={certsDe} indices={indices} />}
      {tab === "cliente" && <CertTab modo="cliente" obras={obras} data={data} save={save} certsDe={certsDe} indices={indices} />}
      {tab === "caja" && <CajaTab obras={obras} data={data} save={save} certs={certs} certsDe={certsDe} indices={indices} />}
      {tab === "resultado" && <ResultadoTab obras={obras} certs={certs} certsDe={certsDe} indices={indices} data={data} save={save} />}
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
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Certificado ${obra.nombre}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Arial,sans-serif;color:#0F1B2D;padding:0 0 34px}.head{background:#0F1B2D;color:#fff;padding:20px 40px;border-bottom:4px solid #B0894F;display:flex;justify-content:space-between;align-items:center}.brand{font-size:22px;font-weight:800}.brand small{display:block;font-size:10px;color:#B0894F;letter-spacing:2px;margin-top:2px}.doc{text-align:right;font-size:11px;color:#cdd5e0}.doc b{display:block;font-size:15px;color:#fff}.wrap{padding:0 40px}.meta{display:flex;justify-content:space-between;margin:22px 0 6px;font-size:12.5px}.meta span{color:#5B6B7F}h2{font-size:12px;color:#5B6B7F;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;border-bottom:1px solid #E3E8EF;padding-bottom:5px}table{width:100%;border-collapse:collapse;font-size:12.5px}th{background:#EAF0F7;color:#1B3A5B;text-align:left;padding:8px 10px;font-size:10.5px;text-transform:uppercase}td{padding:8px 10px;border-bottom:1px solid #EEF1F5}.ctr{text-align:center}.rgt{text-align:right}.tot td{border:none;padding:4px 10px;font-size:13px}.tot.neto td{border-top:2px solid #0F1B2D;font-size:16px;font-weight:800;color:#1B3A5B;padding-top:9px}.foot{display:flex;justify-content:space-between;font-size:11px;color:#5B6B7F}</style></head><body><div class="head">${brandHtml}<div class="doc"><b>${docTit}</b>Fecha: ${fmtISO(c.fecha)}</div></div><div class="wrap"><div class="meta"><div><span>Obra:</span> <b>${obra.nombre}</b></div><div><span>Comitente:</span> <b>${comitente}</b></div></div><h2>${secTit}</h2><table><thead><tr><th>Rubro</th><th class="ctr">Incid.</th><th class="ctr">Avance</th><th class="rgt">Importe</th></tr></thead><tbody>${rows}</tbody></table><h2>Resumen</h2><table class="tot">${resumen}</table><div style="margin-top:14px;font-size:12px;color:#5B6B7F">Pago: <b style="color:#0F1B2D">${fmtISO(c.fechaPago)}</b></div>${saldoHtml}${fotosHtml}<div class="foot" style="margin-top:44px">${firmaBox(fc.contratista, "Contratista · V+V Construcciones")}${firmaBox(fc.cliente, "Cliente · " + comitente)}</div></div></body></html>`;
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
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 800 }}>Neto a cobrar</span><Money v={preview.neto} c={T.accent} /></div></>}
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
        <input defaultValue={indices[m] ?? ""} onBlur={e => setIndice(m, e.target.value)} inputMode="decimal" placeholder="% CAC" style={{ ...inp, marginTop: 0, width: 110, textAlign: "right" }} /><span style={{ fontSize: 12, color: T.sub }}>%</span>
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
  const setCfg = (k, v) => save({ ...data, config: { ...(data.config || {}), [k]: v } });
  async function subirLogo(e) { const f = e.target.files && e.target.files[0]; if (!f) return; setSubiendo(true); const url = await subirArchivo(f); if (url) setCfg("logo", url); else alert("No se pudo subir. Revisá la conexión."); setSubiendo(false); e.target.value = ""; }
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
      <button onClick={onClose} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 11, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>Listo</button>
    </div>
  </div>);
}
function PdfOverlay({ html, onClose }) {
  const ref = useRef(null);
  const imprimir = () => { try { const w = ref.current && ref.current.contentWindow; if (w) { w.focus(); w.print(); } } catch { } };
  return (<div style={{ position: "fixed", inset: 0, background: "#0F1B2D", zIndex: 500, display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: T.navy, borderBottom: `1px solid rgba(255,255,255,.1)`, alignItems: "center" }}>
      <button onClick={onClose} style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕ Cerrar</button>
      <div style={{ flex: 1, textAlign: "center", color: "rgba(255,255,255,.7)", fontSize: 11.5 }}>Vista previa</div>
      <button onClick={imprimir} style={{ background: BRASS, color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Imprimir / PDF</button>
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
    {items.map(it => (<div key={it.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, padding: "11px 13px", marginBottom: 8, boxShadow: SHDsm, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.kind === "cobro" ? "Cobro" : it.kind === "pago" ? "Pago" : it.cat}<span style={{ fontSize: 11, fontWeight: 500, color: T.sub }}> · {nombreObra(it.obraId)}</span></div><div style={{ fontSize: 11, color: T.muted }}>{fmtISO(it.fecha)}{it.nota ? ` · ${it.nota}` : ""}</div></div>
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
function KPI({ t, v, c }) { return <div style={{ background: T.card, borderRadius: 14, padding: "13px 14px", flex: 1, minWidth: 0, boxShadow: SHDsm }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>{t}</div><div style={{ fontSize: 17, fontWeight: 700, color: c || T.text, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{v}</div></div>; }

function ResultadoTab({ obras, certs, certsDe, indices, data, save }) {
  const [pin, setPin] = useState(""); const [ok, setOk] = useState(false);
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
      <BarsH items={proyMeses.map(k => ({ label: mesLabel(k), value: proy[k], valueLabel: money(proy[k]), color: proy[k] >= 0 ? T.ok : "#EF4444" }))} />
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
    <button onClick={() => { const n = prompt("Nueva clave (números):", ""); if (n && n.trim()) { try { localStorage.setItem("finanzas_pin", n.trim()); } catch { } alert("Clave actualizada."); } }} style={{ display: "block", margin: "8px auto 0", background: "none", border: "none", color: T.muted, fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>Cambiar clave</button>
  </div>);
}
function proxViernes() { const d = new Date(); const day = d.getDay(); let add = (5 - day + 7) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add); return d.toISOString().slice(0, 10); }
