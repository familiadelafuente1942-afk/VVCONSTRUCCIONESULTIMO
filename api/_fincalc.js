// GENERADO desde FinanzasCliente.jsx (cálculo de certificados) con scripts/fincalc-build.sh. No editar a mano: si cambia el cálculo en la app, volver a generarlo.
// ../claude-0/-home-claude/40485029-4f9d-5958-86a4-f456c11af345/scratchpad/fc/Fin.jsx
var num = (v) => {
  const n = Number(String(v == null ? "" : v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
};
var numMoney = (v) => {
  const s = String(v == null ? "" : v).replace(/\./g, "").replace(/[^\d]/g, "");
  return s ? Number(s) : 0;
};
function ordenarObras(arr) {
  return [...arr || []].sort((a, b) => {
    const fa = a?.inicio || "", fb = b?.inicio || "";
    if (fa && fb) {
      if (fa !== fb) return fa < fb ? -1 : 1;
      return String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es");
    }
    if (fa && !fb) return -1;
    if (!fa && fb) return 1;
    return String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es");
  });
}
var T_LIGHT = { navy: "#0B1622", accent: "#1B3A5B", al: "#EEF2F7", bg: "#F5F5F7", card: "#FFFFFF", border: "#E8EAED", text: "#0B1622", sub: "#5B6673", muted: "#98A2B0", ok: "#16A34A", warn: "#B45309", rsm: 12, inpBg: "#FBFBFD", navBar: "rgba(255,255,255,.86)", dark: false };
var T = T_LIGHT;
var buildInp = (t) => ({ width: "100%", background: t.inpBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 13px", fontSize: 16, color: t.text, boxSizing: "border-box", marginTop: 6, outline: "none", fontVariantNumeric: "tabular-nums" });
var buildInpSm = (t) => ({ background: t.inpBg, border: `1px solid ${t.border}`, borderRadius: 9, padding: "10px 8px", fontSize: 15, color: t.text, boxSizing: "border-box", outline: "none" });
var inp = buildInp(T);
var inpSm = buildInpSm(T);
var RUBROS_COMPLETA = [
  ["Trabajos preliminares", 4],
  ["Movimiento de suelo", 4],
  ["Estructura", 30],
  ["Alba\xF1iler\xEDa", 22],
  ["Revoques", 15],
  ["Contrapiso", 8],
  ["Carpeta", 6],
  ["Colocaci\xF3n", 11]
];
var RUBROS_DEF = RUBROS_COMPLETA.map(([n]) => n);
var mesDe = (iso) => String(iso || "").slice(0, 7);
function cacMes(mes, cac) {
  const p = (cac || {})[mes];
  if (p == null || String(p).trim() === "") return { rate: 0, provisorio: true };
  return { rate: num(p) / 100, provisorio: false };
}
function addMonthYM(ym, n) {
  const [y, m] = String(ym).split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function indiceAcumulado(mesBase, mesHasta, cacMensual) {
  const meses = [];
  let factor = 1, ym = mesBase, guard = 0;
  const tope = mesHasta < mesBase ? mesBase : mesHasta;
  while (ym <= tope && guard++ < 240) {
    if (ym === mesBase) {
      meses.push({ mes: ym, rate: 0, provisorio: false, factor: 1 });
    } else {
      const r = cacMes(ym, cacMensual);
      factor *= 1 + r.rate;
      meses.push({ mes: ym, rate: r.rate, provisorio: r.provisorio, factor });
    }
    ym = addMonthYM(ym, 1);
  }
  return { factor, meses };
}
function redetReplay(cert, obra, certsDeObra, cac) {
  const sorted = (certsDeObra || []).some((c) => c.id === cert.id) ? [...certsDeObra || []] : [...certsDeObra || [], cert];
  sorted.sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.ts || 0) - (b.ts || 0));
  let saldo = presupCliente(obra), mesRef = obra?.mesBase || mesDe(sorted[0]?.fecha), prevAcum = 0;
  let out = { ajuste: 0, provisorio: false, rate: 0, factor: 1, saldoBase: saldo };
  for (const cc of sorted) {
    const acum = clienteAcumDe(cc.cantidades, obra);
    const bruto = Math.max(0, acum - prevAcum);
    prevAcum = acum;
    const mesCC = mesDe(cc.fecha);
    const { factor, meses } = indiceAcumulado(mesRef, mesCC, cac);
    const provisorio = meses.some((m) => m.provisorio);
    const saldoBase = saldo;
    const base = saldoBase - bruto;
    const ajuste = base * (factor - 1);
    saldo = base + ajuste;
    mesRef = mesCC;
    if (cc.id === cert.id) {
      out = { ajuste, provisorio, rate: factor - 1, factor, saldoBase };
      break;
    }
  }
  return out;
}
function presupCliente(o) {
  return numMoney(o?.m2) * numMoney(o?.precioCliente);
}
function anticipoDe(o) {
  return o?.anticipoTipo === "monto" ? num(o?.anticipoMontoFijo) : presupCliente(o) * num(o?.anticipoPct) / 100;
}
function presupCosto(o) {
  return numMoney(o?.m2) * numMoney(o?.costoM2);
}
function clienteAcumDe(cant, o) {
  const pc = presupCliente(o);
  return (o?.rubros || []).reduce((s, r) => s + num((cant || {})[r.id]) / 100 * (num(r.pct) / 100) * pc, 0);
}
function costoAcumDe(cant, o) {
  const pco = presupCosto(o);
  return (o?.rubros || []).reduce((s, r) => s + num((cant || {})[r.id]) / 100 * (num(r.pct) / 100) * pco, 0);
}
function extraSums(o) {
  const l = o?.costoExtra || [];
  return { monto: l.filter((x) => x.tipo !== "pct").reduce((s, x) => s + num(x.valor), 0), pct: l.filter((x) => x.tipo === "pct").reduce((s, x) => s + num(x.valor), 0) };
}
function calcCert(cert, obra, certsDeObra, indices) {
  const pc = presupCliente(obra);
  const anticipoMonto = anticipoDe(obra);
  const prevCert = (certsDeObra || []).filter((c) => c.id !== cert.id && (c.fecha < cert.fecha || c.fecha === cert.fecha && (c.ts || 0) < (cert.ts || 0))).sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.ts || 0) - (a.ts || 0))[0];
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
var inpLabelStyle = { fontSize: 12.5, fontWeight: 600, color: T.sub };
export {
  calcCert,
  ordenarObras
};
