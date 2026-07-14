// V+V CRONOGRAMA — app de cronogramas de obra
// VERSION: v2
//
// Cómo está pensada (las tres ideas que la sostienen):
//
//  1. CAMINO CRÍTICO. Las tareas se encadenan con dependencias reales (fin→comienzo y
//     comienzo→comienzo, con demoras). La app calcula la holgura de cada una. Las que
//     tienen holgura cero son el CAMINO CRÍTICO: si una se atrasa un día, la obra
//     entera termina un día más tarde. Eso contesta "qué pasos hay que cuidar
//     puntualmente para llegar a los 12 meses".
//
//  2. LAS DEFINICIONES SON RESTRICCIONES. Una tarea no está lista para arrancar si le
//     falta una definición del comitente. La app marca la tarea como BLOQUEADA y avisa
//     con anticipación, contando hacia atrás desde el día en que la tarea arranca.
//     El contenido sale del informe "Definiciones de obra" de V+V.
//
//  3. CRONOGRAMA CON PLATA. Cada tarea pesa un % del contrato. Con el avance cargado,
//     la app dice cuánta plata ejecutaste, y vos marcás si esa tarea ya está certificada
//     y pagada. Se conecta con Finanzas para traer el monto real del contrato.

import React, { useState, useEffect, useMemo, useRef } from "react";

/* ═══════════════════ NUBE (mismo Supabase que toda la suite) ═══════════════════ */
const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const SH = () => ({ apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": "application/json" });

let ultimoAviso = 0;
function avisarErrorSync() {
  const t = Date.now();
  if (t - ultimoAviso < 8000) return;
  ultimoAviso = t;
  try { window.dispatchEvent(new CustomEvent("vv-sync-error")); } catch { }
}

const storage = {
  get: async (key) => {
    try {
      const r = await fetch(`${SUPA_URL}/rest/v1/bco_storage?key=eq.${encodeURIComponent(key)}&select=value`, { headers: SH() });
      if (!r.ok) throw new Error("http");
      const j = await r.json();
      if (j && j[0]) return { value: j[0].value };
    } catch { }
    try { const v = localStorage.getItem(key); if (v != null) return { value: v }; } catch { }
    return null;
  },
  set: async (key, value) => {
    try { localStorage.setItem(key, value); } catch { }
    const intentar = () => fetch(SUPA_URL + "/rest/v1/bco_storage", {
      method: "POST", headers: { ...SH(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key, value }),
    });
    try {
      let r = await intentar();
      if (!r.ok) r = await intentar();
      if (!r.ok) { avisarErrorSync(); return { value, ok: false }; }
    } catch { avisarErrorSync(); return { value, ok: false }; }
    return { value, ok: true };
  },
};

function SyncBanner() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const f = () => { setMsg("No se pudo guardar en la nube. Quedó en este aparato — revisá la conexión."); setTimeout(() => setMsg(""), 7000); };
    window.addEventListener("vv-sync-error", f);
    return () => window.removeEventListener("vv-sync-error", f);
  }, []);
  if (!msg) return null;
  return (<div style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9999, background: "#DC2626", color: "#fff", borderRadius: 10, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, boxShadow: "0 6px 20px rgba(0,0,0,.25)", display: "flex", gap: 8, alignItems: "center" }}>
    <span>⚠</span><span style={{ flex: 1 }}>{msg}</span>
    <button onClick={() => setMsg("")} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>OK</button>
  </div>);
}

/* ═══════════════════ IDENTIDAD VISUAL (la de la suite) ═══════════════════ */
const T = {
  navy: "#0F1B2D", accent: "#1B3A5B", bg: "#F5F7FA", card: "#FFFFFF",
  border: "#D8DEE6", text: "#0F1B2D", sub: "#5B6B7F", muted: "#94A3B8",
  ok: "#16A34A", warn: "#F59E0B", danger: "#DC2626", critico: "#B91C1C",
};
const BRASS = "#B0894F";
const SHD = "0 6px 22px rgba(15,27,45,.10)";
const SHDsm = "0 2px 10px rgba(15,27,45,.06)";

/* ═══════════════════ FECHAS Y NÚMEROS ═══════════════════ */
const DIA = 86400000;
const hoyISO = () => new Date().toISOString().slice(0, 10);
function isoMas(iso, dias) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + (Number(dias) || 0));
  return d.toISOString().slice(0, 10);
}
function diasEntre(a, b) {
  if (!a || !b) return 0;
  const da = new Date(a + "T12:00:00"), db = new Date(b + "T12:00:00");
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  return Math.round((db - da) / DIA);
}
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}
function fmtCorta(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const num = (x) => { const n = Number(String(x ?? "").replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const numSimple = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };
const money = (n) => "$" + Math.round(numSimple(n)).toLocaleString("es-AR");

/* ═══════════════════ EL MODELO DE OBRA ═══════════════════
   Cada tarea tiene:
     cod        · código corto, para encadenar dependencias
     dias       · cuánto dura
     deps       · de qué tareas depende. tipo "FC" = arranca cuando la otra termina.
                  tipo "CC" = arranca junto con la otra. lag = días de demora.
     peso       · % del contrato que representa esa tarea
     defs       · definiciones del comitente que la traban

   Las definiciones salen del informe técnico de V+V: cuántos días antes hace falta,
   por qué la obra la necesita, y qué pasa si llega tarde.                            */
const PLANTILLA_BASE = [
  { cod: "OBR", etapa: "Preliminares", nombre: "Obrador, cerco y replanteo", dias: 10, deps: [], peso: 1.5, defs: [] },
  { cod: "EXC", etapa: "Preliminares", nombre: "Excavación y movimiento de suelos", dias: 12, deps: [{ cod: "OBR", tipo: "FC", lag: 0 }], peso: 2, defs: [] },

  { cod: "FUN", etapa: "Estructura", nombre: "Fundaciones y platea", dias: 18, deps: [{ cod: "EXC", tipo: "FC", lag: 0 }], peso: 6, defs: [
    { nombre: "Piso radiante: ¿lleva o no?", diasAntes: 90,
      porQue: "Necesita la cañería embutida dentro de la carpeta. Define el paquete de platea y el espesor del contrapiso.",
      consecuencia: "Imposible de agregar después sin romper toda la carpeta del ambiente.",
      plazoReal: "Debe decidirse desde el inicio del proyecto" },
    { nombre: "Parrilla u hogar: modelo y ubicación", diasAntes: 90,
      porQue: "El conducto de humos y su base se resuelven en la estructura y en la mampostería temprana, no se agregan después.",
      consecuencia: "Sin obra mayor, no se puede agregar un conducto de humos correcto una vez cerrada la estructura.",
      plazoReal: "Debe ser de las primeras definiciones de todo el proyecto" },
  ] },
  { cod: "EST", etapa: "Estructura", nombre: "Estructura de hormigón armado", dias: 60, deps: [{ cod: "FUN", tipo: "FC", lag: 0 }], peso: 16, defs: [] },

  { cod: "MAM", etapa: "Albañilería", nombre: "Mampostería", dias: 45, deps: [{ cod: "EST", tipo: "CC", lag: 45 }], peso: 9, defs: [
    { nombre: "Carpintería: puertas y ventanas (modelo y medida exacta)", diasAntes: 60,
      porQue: "El vano —la abertura en la pared— se construye a la medida exacta del marco elegido.",
      consecuencia: "Vano mal dimensionado; rotura de mampostería para ajustar.",
      plazoReal: "30 a 60 días de fabricación" },
    { nombre: "Aire acondicionado: tipo, potencia y ubicación de unidades", diasAntes: 30,
      porQue: "Define el pase en pared o losa, la sección de cañería y la banquina de la unidad exterior.",
      consecuencia: "Apertura de pases ya cerrados; riesgo de filtraciones por pases mal ubicados.",
      plazoReal: "15 a 30 días, según stock del equipo" },
  ] },
  { cod: "CUB", etapa: "Albañilería", nombre: "Cubierta y techos", dias: 25, deps: [{ cod: "MAM", tipo: "CC", lag: 35 }], peso: 5, defs: [] },

  { cod: "SAN", etapa: "Instalaciones", nombre: "Instalación sanitaria (bajo losa y muros)", dias: 30, deps: [{ cod: "MAM", tipo: "CC", lag: 45 }], peso: 4, defs: [
    { nombre: "Griferías y artefactos sanitarios (bidé, inodoro, vanitory, ducha)", diasAntes: 45,
      porQue: "Cada modelo tiene una distancia entre ejes distinta; la cañería se embute con esa medida exacta.",
      consecuencia: "Rotura de revoque o cerámica ya colocada, para reubicar los caños.",
      plazoReal: "20 a 45 días" },
  ] },
  { cod: "ELE", etapa: "Instalaciones", nombre: "Instalación eléctrica (cañerías)", dias: 30, deps: [{ cod: "MAM", tipo: "CC", lag: 50 }], peso: 4, defs: [
    { nombre: "Cantidad y ubicación de bocas eléctricas y circuitos especiales", diasAntes: 30,
      porQue: "Las cañerías eléctricas se embuten en pared o losa antes del revoque grueso. Incluye TV, datos, cortinas y domótica.",
      consecuencia: "Cableado visto, o rotura de pared para agregar una boca.",
      plazoReal: "La decisión es rápida, pero bloquea la tarea si se demora" },
  ] },
  { cod: "GAS", etapa: "Instalaciones", nombre: "Instalación de gas", dias: 15, deps: [{ cod: "SAN", tipo: "CC", lag: 20 }], peso: 1.5, defs: [] },
  { cod: "AIR", etapa: "Instalaciones", nombre: "Aire acondicionado (cañerías y pases)", dias: 20, deps: [{ cod: "SAN", tipo: "CC", lag: 20 }], peso: 3, defs: [] },
  { cod: "RAD", etapa: "Instalaciones", nombre: "Piso radiante (colocación)", dias: 15, deps: [{ cod: "SAN", tipo: "FC", lag: 10 }], peso: 2, defs: [] },

  { cod: "CPI", etapa: "Albañilería", nombre: "Contrapisos", dias: 20, deps: [{ cod: "RAD", tipo: "FC", lag: 0 }], peso: 4, defs: [
    { nombre: "Muebles de cocina (bajo mesada, alacenas, isla, electrodomésticos)", diasAntes: 90,
      porQue: "Definen la banquina de apoyo, el nivel de piso bajo el mueble y la ubicación exacta de agua, gas, desagüe y tomas eléctricas.",
      consecuencia: "Rotura de contrapiso y mampostería para reubicar instalaciones; atraso de toda la cocina.",
      plazoReal: "45 a 90 días (elegir + fabricar a medida + entregar)" },
    { nombre: "Banquina para equipos (bomba, compresor, unidad externa de A/A, tanque)", diasAntes: 30,
      porQue: "La base de hormigón se dimensiona según la medida y el peso exacto del equipo.",
      consecuencia: "Base mal dimensionada; hay que romper y rehacer la fundación del equipo.",
      plazoReal: "15 a 30 días" },
  ] },
  { cod: "CAR", etapa: "Albañilería", nombre: "Carpetas", dias: 15, deps: [{ cod: "CPI", tipo: "FC", lag: 0 }], peso: 2, defs: [
    { nombre: "Tipo y espesor de piso por ambiente (porcelanato, madera, alfombra, piedra)", diasAntes: 60,
      porQue: "El nivel de la carpeta se calcula según el espesor del piso definitivo, para que todos los ambientes queden a nivel entre sí.",
      consecuencia: "Escalón entre ambientes, o rotura de carpeta para volver a nivelar.",
      plazoReal: "30 a 60 días si es importado o de pedido especial" },
  ] },

  { cod: "RGR", etapa: "Terminaciones", nombre: "Revoque grueso", dias: 30, deps: [{ cod: "CPI", tipo: "CC", lag: 15 }], peso: 4.5, defs: [] },
  { cod: "CPT", etapa: "Terminaciones", nombre: "Colocación de carpinterías", dias: 20, deps: [{ cod: "RGR", tipo: "CC", lag: 25 }], peso: 6, defs: [] },
  { cod: "RFI", etapa: "Terminaciones", nombre: "Revoque fino y yesería", dias: 25, deps: [{ cod: "RGR", tipo: "FC", lag: 5 }], peso: 3, defs: [
    { nombre: "Terminación de revoques (liso, símil piedra, textura)", diasAntes: 20,
      porQue: "Define la técnica y el espesor de aplicación, previo a la pintura.",
      consecuencia: "Atraso de pintura y de toda la terminación final.",
      plazoReal: "La decisión es rápida, pero bloquea toda la etapa si no está" },
  ] },
  { cod: "PIS", etapa: "Terminaciones", nombre: "Colocación de pisos", dias: 25, deps: [{ cod: "CAR", tipo: "FC", lag: 0 }, { cod: "RFI", tipo: "FC", lag: 0 }], peso: 6.5, defs: [] },
  { cod: "REV", etapa: "Terminaciones", nombre: "Revestimientos de baños y cocina", dias: 20, deps: [{ cod: "PIS", tipo: "CC", lag: 10 }], peso: 3, defs: [] },
  { cod: "PAR", etapa: "Terminaciones", nombre: "Parrilla y hogar (terminación)", dias: 12, deps: [{ cod: "PIS", tipo: "CC", lag: 25 }], peso: 1.5, defs: [] },
  { cod: "MUE", etapa: "Terminaciones", nombre: "Muebles de cocina (colocación)", dias: 15, deps: [{ cod: "PIS", tipo: "FC", lag: 0 }], peso: 5, defs: [] },
  { cod: "PLA", etapa: "Terminaciones", nombre: "Placards y carpintería interior", dias: 15, deps: [{ cod: "MUE", tipo: "CC", lag: 5 }], peso: 2.5, defs: [] },
  { cod: "MES", etapa: "Terminaciones", nombre: "Mesadas y banquinas", dias: 12, deps: [{ cod: "MUE", tipo: "FC", lag: 0 }], peso: 2, defs: [] },
  { cod: "PIN", etapa: "Terminaciones", nombre: "Pintura", dias: 25, deps: [{ cod: "MUE", tipo: "CC", lag: 20 }], peso: 3.5, defs: [] },
  { cod: "ART", etapa: "Terminaciones", nombre: "Artefactos, griferías y bachas", dias: 12, deps: [{ cod: "PIN", tipo: "CC", lag: 15 }], peso: 1.5, defs: [] },
  { cod: "FIN", etapa: "Cierre", nombre: "Limpieza final y entrega", dias: 10, deps: [{ cod: "PIN", tipo: "FC", lag: 0 }, { cod: "ART", tipo: "FC", lag: 0 }], peso: 1, defs: [] },
];

const ETAPAS = ["Preliminares", "Estructura", "Albañilería", "Instalaciones", "Terminaciones", "Cierre"];
const COLOR_ETAPA = {
  "Preliminares": "#64748B", "Estructura": "#1B3A5B", "Albañilería": "#0E7490",
  "Instalaciones": "#7C3AED", "Terminaciones": "#B0894F", "Cierre": "#16A34A",
};
const TOPE_DIAS = 365;

function plantillaAObra(plantilla) {
  return (plantilla || []).map(t => ({
    id: uid(),
    cod: t.cod || uid().slice(0, 3).toUpperCase(),
    etapa: t.etapa || "Terminaciones",
    nombre: t.nombre || "(sin nombre)",
    dias: Math.max(1, numSimple(t.dias)),
    deps: (t.deps || []).map(d => ({ cod: d.cod, tipo: d.tipo === "CC" ? "CC" : "FC", lag: numSimple(d.lag) })),
    peso: numSimple(t.peso),
    avance: 0,
    certificado: false, pagado: false,
    bfInicio: "", bfFin: "",
    defs: (t.defs || []).map(d => ({
      id: uid(),
      nombre: d.nombre || "(definición)",
      diasAntes: numSimple(d.diasAntes),
      porQue: d.porQue || "",
      consecuencia: d.consecuencia || "",
      plazoReal: d.plazoReal || "",
      ok: false, fechaOk: "",
      avisadoVV: false, avisadoBF: false,
    })),
  }));
}

/* ═══════════════════ EL MOTOR: CAMINO CRÍTICO ═══════════════════
   Pasada hacia adelante  → cuándo puede arrancar cada tarea (lo más temprano).
   Pasada hacia atrás     → cuándo tiene que arrancar como MUY tarde sin correr la obra.
   Holgura = la diferencia. Holgura 0 → está en el camino crítico.                     */
function calcCPM(tareas) {
  const T2 = (tareas || []).filter(t => t && t.id).map(t => ({
    ...t,
    dias: Math.max(1, numSimple(t.dias)),
    deps: (t.deps || []).filter(d => d && d.cod),
  }));
  const porCod = {};
  T2.forEach(t => { if (t.cod) porCod[t.cod] = t; });

  const ES = {}, EF = {};
  const visitando = {}, listo = {};

  // hacia adelante, con protección contra dependencias circulares
  function calcES(t) {
    if (listo[t.id]) return ES[t.id];
    if (visitando[t.id]) { ES[t.id] = 0; EF[t.id] = t.dias; return 0; }  // ciclo: corto acá
    visitando[t.id] = true;
    let es = 0;
    for (const d of t.deps) {
      const p = porCod[d.cod];
      if (!p || p.id === t.id) continue;
      calcES(p);
      const cand = d.tipo === "CC" ? ES[p.id] + numSimple(d.lag) : EF[p.id] + numSimple(d.lag);
      if (cand > es) es = cand;
    }
    es = Math.max(0, es);
    ES[t.id] = es; EF[t.id] = es + t.dias;
    visitando[t.id] = false; listo[t.id] = true;
    return es;
  }
  T2.forEach(calcES);

  const finProyecto = T2.reduce((m, t) => Math.max(m, EF[t.id] || 0), 0);

  // sucesores, para la pasada hacia atrás
  const sucesores = {};
  T2.forEach(t => { sucesores[t.id] = []; });
  T2.forEach(s => {
    for (const d of s.deps) {
      const p = porCod[d.cod];
      if (!p || p.id === s.id) continue;
      sucesores[p.id].push({ suc: s, tipo: d.tipo, lag: numSimple(d.lag) });
    }
  });

  // Pasada hacia atrás. Ojo con la diferencia, que es real y no es un detalle:
  //  · FC (fin→comienzo): el sucesor espera a que ESTA TERMINE. Entonces la tarea
  //    tiene fecha límite de FIN. Si se alarga, empuja al sucesor.
  //  · CC (comienzo→comienzo): el sucesor solo espera a que ESTA ARRANQUE. Entonces
  //    la tarea tiene fecha límite de COMIENZO, pero su fin queda libre: si se alarga,
  //    NO empuja al sucesor (por eso mampostería puede arrancar con la estructura en curso).
  const LS = {}, LF = {};
  const listo2 = {}, visitando2 = {};
  function calcLS(t) {
    if (listo2[t.id]) return LS[t.id];
    if (visitando2[t.id]) { LF[t.id] = finProyecto; LS[t.id] = finProyecto - t.dias; return LS[t.id]; }
    visitando2[t.id] = true;
    const sucs = sucesores[t.id] || [];

    // el FIN solo lo atan los sucesores de tipo FC
    let lf = finProyecto;
    for (const { suc, tipo, lag } of sucs) {
      if (tipo !== "FC") continue;
      calcLS(suc);
      const cand = LS[suc.id] - lag;
      if (cand < lf) lf = cand;
    }

    // el COMIENZO lo atan su propio fin y los sucesores de tipo CC
    let ls = lf - t.dias;
    for (const { suc, tipo, lag } of sucs) {
      if (tipo !== "CC") continue;
      calcLS(suc);
      const cand = LS[suc.id] - lag;
      if (cand < ls) ls = cand;
    }

    LF[t.id] = lf; LS[t.id] = ls;
    visitando2[t.id] = false; listo2[t.id] = true;
    return ls;
  }
  T2.forEach(calcLS);

  return T2.map(t => {
    const es = ES[t.id] ?? 0, ef = EF[t.id] ?? 0;
    const ls = LS[t.id] ?? 0, lf = LF[t.id] ?? 0;
    const holgura = Math.round(ls - es);          // ¿cuánto puede demorarse en ARRANCAR?
    const holguraFin = Math.round(lf - ef);       // ¿cuánto puede estirarse sin correr la obra?
    return {
      ...t, es, ef, ls, lf,
      holgura, holguraFin,
      critica: holgura <= 0,
      // si además el fin está atado, alargarla corre la obra entera
      finAtado: holguraFin <= 0,
    };
  });
}

/* Todo el plan de una obra: fechas, definiciones, alertas, plata */
function calcObra(obra, diasAviso, finanzas) {
  const aviso = numSimple(diasAviso) || 15;
  const base = calcCPM(obra?.tareas || []);
  const hoy = hoyISO();

  const tareas = base.map(t => {
    const vvInicio = isoMas(obra.inicio, t.es);
    const vvFin = isoMas(obra.inicio, t.ef);
    const desvio = (t.bfFin && vvFin) ? diasEntre(t.bfFin, vvFin) : null;

    const defs = (t.defs || []).map(d => {
      const limite = isoMas(vvInicio, -numSimple(d.diasAntes));
      const faltan = limite ? diasEntre(hoy, limite) : null;
      let estado = "futura";
      if (d.ok) estado = "ok";
      else if (faltan !== null && faltan < 0) estado = "vencida";
      else if (faltan !== null && faltan <= aviso) estado = "urgente";
      return { ...d, limite, faltan, estado, tareaNombre: t.nombre, tareaInicio: vvInicio, tareaId: t.id, critica: t.critica };
    });

    const trabas = defs.filter(d => !d.ok);
    // la tarea está BLOQUEADA si arranca pronto y todavía le faltan definiciones
    const arrancaEn = diasEntre(hoy, vvInicio);
    const bloqueada = trabas.length > 0 && arrancaEn <= aviso;

    return { ...t, vvInicio, vvFin, desvio, defs, trabas, bloqueada, arrancaEn };
  });

  const finDias = tareas.reduce((m, t) => Math.max(m, t.ef), 0);
  const fin = isoMas(obra.inicio, finDias);
  const meses = finDias / 30.44;
  const excede = finDias > TOPE_DIAS;

  const defs = tareas.flatMap(t => t.defs);
  const pendientes = defs.filter(d => !d.ok);
  const vencidas = pendientes.filter(d => d.estado === "vencida");
  const urgentes = pendientes.filter(d => d.estado === "urgente");

  // avance físico, ponderado por el peso de cada tarea
  const pesoTotal = tareas.reduce((s, t) => s + numSimple(t.peso), 0);
  const avancePond = pesoTotal > 0
    ? tareas.reduce((s, t) => s + numSimple(t.peso) * numSimple(t.avance), 0) / pesoTotal
    : 0;

  // el contrato, si la obra está enganchada a Finanzas
  const fo = finanzas?.obras?.find(o => o.id === obra.finanzasObraId);
  const contrato = fo ? numSimple(fo.m2) * numSimple(fo.precioCliente) : 0;
  const costoTotal = fo ? numSimple(fo.m2) * numSimple(fo.costoM2) : 0;

  const conPlata = tareas.map(t => {
    const frac = pesoTotal > 0 ? numSimple(t.peso) / pesoTotal : 0;
    const valor = contrato * frac;
    const costo = costoTotal * frac;
    return { ...t, valor, costo, ejecutado: valor * numSimple(t.avance) / 100 };
  });

  const ejecutado = conPlata.reduce((s, t) => s + t.ejecutado, 0);
  const certificado = conPlata.filter(t => t.certificado).reduce((s, t) => s + t.valor, 0);
  const pagado = conPlata.filter(t => t.pagado).reduce((s, t) => s + t.costo, 0);
  const costoEjec = conPlata.reduce((s, t) => s + t.costo * numSimple(t.avance) / 100, 0);
  const sinCertificar = ejecutado - certificado;

  const criticas = conPlata.filter(t => t.critica);
  const enCurso = conPlata.filter(t => t.vvInicio <= hoy && t.vvFin >= hoy);
  const bloqueadas = conPlata.filter(t => t.bloqueada);

  return {
    tareas: conPlata, finDias, fin, meses, excede,
    defs, pendientes, vencidas, urgentes,
    pesoTotal, avancePond,
    contrato, costoTotal, ejecutado, certificado, pagado, costoEjec, sinCertificar,
    ligada: !!fo, finanzasNombre: fo?.nombre || "",
    criticas, enCurso, bloqueadas,
  };
}

/* ═══════════════════ ALERTAS → PEDIDOS (canal a V+V y Belfast) ═══════════════════ */
const TUMBAS_PED = "vv_pedidos_del";
async function crearPedido({ para, asunto, detalle, prioridad }) {
  const f = new Date().toLocaleDateString("es-AR");
  const ts = Date.now();
  const p = {
    id: uid(), de: "vv", para, asunto, estado: "abierto",
    prioridad: prioridad || "alta", obra_id: "", fecha: f, ts, iaTurns: 0, upd: ts,
    hilo: [{ de: "vv", texto: detalle || asunto, fecha: f, ts, porIA: false }],
  };
  let enNube = [], tumbas = {};
  try { const r = await storage.get("vv_pedidos"); if (r?.value) enNube = JSON.parse(r.value); } catch { }
  try { const r = await storage.get(TUMBAS_PED); if (r?.value) tumbas = JSON.parse(r.value); } catch { }
  if (!Array.isArray(enNube)) enNube = [];
  const porId = {};
  for (const x of enNube) if (x && x.id) porId[x.id] = x;
  porId[p.id] = p;
  const lista = Object.values(porId).filter(x => !(tumbas[x.id] && tumbas[x.id] >= (x.upd || 0)));
  const r1 = await storage.set("vv_pedidos", JSON.stringify(lista));
  await storage.set("vv_pedidos__ts", String(Date.now()));
  return r1.ok;
}

/* ═══════════════════ PIEZAS ═══════════════════ */
const inp = {
  width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${T.border}`,
  borderRadius: 10, outline: "none", marginTop: 8, background: "#fff", color: T.text,
  fontFamily: "inherit", boxSizing: "border-box",
};
const inpSm = { ...inp, padding: "7px 9px", fontSize: 13, marginTop: 0 };

function Btn({ children, onClick, tipo = "primario", chico, full, disabled }) {
  const e = {
    primario: { background: T.accent, color: "#fff", border: "none" },
    suave: { background: T.bg, color: T.accent, border: `1px solid ${T.border}` },
    peligro: { background: "#FEF2F2", color: T.danger, border: "1px solid #FECACA" },
    brass: { background: BRASS, color: "#fff", border: "none" },
  }[tipo];
  return (<button onClick={onClick} disabled={disabled} style={{
    ...e, borderRadius: 10, padding: chico ? "7px 11px" : "11px 15px",
    fontSize: chico ? 12 : 13.5, fontWeight: 700, cursor: disabled ? "default" : "pointer",
    width: full ? "100%" : "auto", opacity: disabled ? .45 : 1, fontFamily: "inherit",
  }}>{children}</button>);
}
function Chip({ children, color, fondo }) {
  return (<span style={{ background: fondo, color, borderRadius: 6, padding: "2px 7px", fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap" }}>{children}</span>);
}
const SEM = {
  vencida: { c: T.danger, b: "#FEF2F2", l: "Vencida" },
  urgente: { c: "#B45309", b: "#FFFBEB", l: "Urgente" },
  futura: { c: T.sub, b: T.bg, l: "En plazo" },
  ok: { c: T.ok, b: "#ECFDF5", l: "Definida" },
};

/* ─── La firma: dos líneas de tiempo + el camino crítico marcado ─── */
function Gantt({ obra, plan, soloCriticas }) {
  const total = Math.max(plan.finDias, TOPE_DIAS, 1);
  const hoyOff = diasEntre(obra.inicio, hoyISO());
  const pctHoy = Math.max(0, Math.min(100, hoyOff / total * 100));
  const lista = soloCriticas ? plan.tareas.filter(t => t.critica) : plan.tareas;

  return (<div style={{ background: T.card, borderRadius: 14, padding: "14px 16px 14px 14px", boxShadow: SHDsm, overflow: "hidden" }}>
    <div style={{ position: "relative", height: 16, marginBottom: 8 }}>
      {Array.from({ length: 13 }).map((_, i) => {
        const pct = (i * 30.44) / total * 100;
        if (pct > 100) return null;
        return (<div key={i} style={{ position: "absolute", left: `${pct}%`, top: 0, fontSize: 9, color: T.muted, fontWeight: 700, transform: "translateX(-50%)" }}>{i === 0 ? "0" : `m${i}`}</div>);
      })}
    </div>

    <div style={{ position: "relative" }}>
      {hoyOff >= 0 && hoyOff <= total && (
        <div style={{ position: "absolute", left: `${pctHoy}%`, top: -6, bottom: 0, width: 2, background: T.danger, zIndex: 4, opacity: .8 }} />
      )}
      {plan.finDias > TOPE_DIAS && (
        <div style={{ position: "absolute", left: `${TOPE_DIAS / total * 100}%`, top: -6, bottom: 0, width: 2, background: BRASS, zIndex: 4 }} />
      )}

      {lista.map(t => {
        const izq = t.es / total * 100;
        const ancho = Math.max(0.7, t.dias / total * 100);
        const col = t.critica ? T.critico : (COLOR_ETAPA[t.etapa] || T.accent);
        let bIzq = null, bAncho = null;
        if (t.bfInicio && t.bfFin) {
          const o = diasEntre(obra.inicio, t.bfInicio);
          const d = Math.max(1, diasEntre(t.bfInicio, t.bfFin));
          bIzq = o / total * 100; bAncho = Math.max(0.7, d / total * 100);
        }
        return (<div key={t.id} style={{ marginBottom: 9 }}>
          <div style={{ fontSize: 10.5, color: t.critica ? T.critico : T.sub, fontWeight: t.critica ? 800 : 600, marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}>
            {t.bloqueada && <span title="bloqueada por una definición" style={{ width: 6, height: 6, borderRadius: "50%", background: T.danger, flexShrink: 0 }} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</span>
            {t.critica && <span style={{ fontSize: 8.5, fontWeight: 800, color: T.critico, letterSpacing: ".04em", flexShrink: 0 }}>CRÍTICA</span>}
            {!t.critica && t.holgura > 0 && <span style={{ fontSize: 9, color: T.muted, flexShrink: 0 }}>+{t.holgura}d</span>}
          </div>
          <div style={{ position: "relative", height: bIzq !== null ? 17 : 8 }}>
            {/* barra de avance dentro de la barra de plan */}
            <div style={{ position: "absolute", left: `${izq}%`, width: `${ancho}%`, top: 0, height: 7, background: col, borderRadius: 4, opacity: .28 }} />
            <div style={{ position: "absolute", left: `${izq}%`, width: `${ancho * numSimple(t.avance) / 100}%`, top: 0, height: 7, background: col, borderRadius: 4 }} />
            {bIzq !== null && (
              <div style={{ position: "absolute", left: `${bIzq}%`, width: `${bAncho}%`, top: 10, height: 5, background: "transparent", border: `1.5px solid ${BRASS}`, borderRadius: 4 }} />
            )}
          </div>
        </div>);
      })}
    </div>

    <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", fontSize: 10, color: T.sub }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 6, background: T.critico, borderRadius: 3 }} /> camino crítico</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 6, background: T.accent, borderRadius: 3 }} /> V+V</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 6, border: `1.5px solid ${BRASS}`, borderRadius: 3 }} /> Belfast</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 2, height: 10, background: T.danger }} /> hoy</span>
    </div>
  </div>);
}

/* ─── Cabecera de obra ─── */
function Hero({ obra, plan }) {
  const pct = Math.min(100, plan.finDias / TOPE_DIAS * 100);
  const col = plan.excede ? "#FCA5A5" : plan.finDias > TOPE_DIAS * .92 ? "#FCD34D" : "#7DE0A6";
  return (<div style={{ background: `linear-gradient(155deg, #14263E 0%, ${T.navy} 68%)`, color: "#fff", borderRadius: 18, padding: 20, boxShadow: SHD, borderTop: `3px solid ${BRASS}` }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, letterSpacing: ".1em", textTransform: "uppercase" }}>Plazo de obra</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "6px 0 2px" }}>
      <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-.02em", color: col, lineHeight: 1.05 }}>{plan.meses.toFixed(1)}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,.75)" }}>meses</span>
    </div>
    <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)" }}>{fmtFecha(obra.inicio)} → {fmtFecha(plan.fin)} · {plan.finDias} días</div>

    <div style={{ marginTop: 12, height: 7, background: "rgba(255,255,255,.14)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 4 }} />
    </div>
    <div style={{ fontSize: 11, color: plan.excede ? "#FCA5A5" : "rgba(255,255,255,.6)", marginTop: 5, fontWeight: plan.excede ? 700 : 400 }}>
      {plan.excede
        ? `Te pasás ${plan.finDias - TOPE_DIAS} días del tope de 12 meses. Hay que acortar o solapar tareas del camino crítico.`
        : `${TOPE_DIAS - plan.finDias} días de margen sobre los 12 meses.`}
    </div>

    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.14)", display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "rgba(255,255,255,.95)" }}>{plan.avancePond.toFixed(0)}%</div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase", fontWeight: 700 }}>avance</div>
      </div>
      <div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "#FCA5A5" }}>{plan.criticas.length}</div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase", fontWeight: 700 }}>críticas</div>
      </div>
      {plan.vencidas.length > 0 && <div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "#FCA5A5" }}>{plan.vencidas.length}</div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase", fontWeight: 700 }}>vencidas</div>
      </div>}
      {plan.urgentes.length > 0 && <div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "#FCD34D" }}>{plan.urgentes.length}</div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase", fontWeight: 700 }}>urgentes</div>
      </div>}
      <div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "rgba(255,255,255,.95)" }}>{plan.pendientes.length}</div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase", fontWeight: 700 }}>a definir</div>
      </div>
    </div>
  </div>);
}

/* ─── Una definición ─── */
function FilaDef({ d, onToggle, onAvisar, onBorrar, onEditar, compacto }) {
  const s = SEM[d.estado] || SEM.futura;
  const [abierto, setAbierto] = useState(false);
  const [porQue, setPorQue] = useState(false);
  return (<div style={{ background: s.b, borderRadius: 11, padding: "11px 12px", marginTop: 8, border: `1px solid ${d.estado === "vencida" ? "#FECACA" : T.border}` }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
      <button onClick={onToggle} style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, cursor: "pointer",
        border: `1.5px solid ${d.ok ? T.ok : T.border}`, background: d.ok ? T.ok : "#fff",
        color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1, padding: 0,
      }}>{d.ok ? "✓" : ""}</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, textDecoration: d.ok ? "line-through" : "none", opacity: d.ok ? .55 : 1 }}>{d.nombre}</div>
        <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>
          Traba <b>{d.tareaNombre}</b>{d.critica && <span style={{ color: T.critico, fontWeight: 800 }}> · TAREA CRÍTICA</span>} · arranca {fmtCorta(d.tareaInicio)}
        </div>
        {!d.ok && (
          <div style={{ fontSize: 11.5, color: s.c, fontWeight: 700, marginTop: 3 }}>
            {d.estado === "vencida"
              ? `Debía estar definida el ${fmtFecha(d.limite)} — hace ${Math.abs(d.faltan)} días`
              : `Definir antes del ${fmtFecha(d.limite)} — faltan ${d.faltan} días`}
          </div>
        )}
        {d.plazoReal && !d.ok && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Proceso real: {d.plazoReal}</div>}
      </div>
      <Chip color={s.c} fondo="#fff">{s.l}</Chip>
    </div>

    {(d.porQue || d.consecuencia) && !d.ok && (
      <div style={{ marginTop: 8 }}>
        <button onClick={() => setPorQue(!porQue)} style={{ background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          {porQue ? "▲ Ocultar" : "▼ Por qué no puede esperar"}
        </button>
        {porQue && <div style={{ background: "#fff", borderRadius: 9, padding: 10, marginTop: 6 }}>
          {d.porQue && <div style={{ fontSize: 11.5, color: T.text, lineHeight: 1.55 }}><b>La obra la necesita para:</b> {d.porQue}</div>}
          {d.consecuencia && <div style={{ fontSize: 11.5, color: T.danger, lineHeight: 1.55, marginTop: 6 }}><b>Si llega tarde:</b> {d.consecuencia}</div>}
        </div>}
      </div>
    )}

    {!d.ok && (
      <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
        <Btn chico tipo={d.avisadoVV ? "suave" : "primario"} onClick={() => onAvisar("vv")}>{d.avisadoVV ? "✓ Avisado a V+V" : "Avisar a V+V"}</Btn>
        <Btn chico tipo={d.avisadoBF ? "suave" : "brass"} onClick={() => onAvisar("cliente")}>{d.avisadoBF ? "✓ Pedido a Belfast" : "Pedir a Belfast"}</Btn>
        {!compacto && <Btn chico tipo="suave" onClick={() => setAbierto(!abierto)}>{abierto ? "Cerrar" : "Editar"}</Btn>}
      </div>
    )}

    {abierto && <div style={{ marginTop: 9, background: "#fff", borderRadius: 9, padding: 10 }}>
      <input defaultValue={d.nombre} onBlur={e => onEditar({ nombre: e.target.value })} placeholder="Qué hay que definir" style={{ ...inpSm, marginBottom: 7 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 12, color: T.sub, flex: 1 }}>Días de anticipación</span>
        <input defaultValue={d.diasAntes} onBlur={e => onEditar({ diasAntes: numSimple(e.target.value) })} inputMode="numeric" style={{ ...inpSm, width: 70, textAlign: "right" }} />
      </div>
      <input defaultValue={d.consecuencia} onBlur={e => onEditar({ consecuencia: e.target.value })} placeholder="Qué pasa si llega tarde" style={{ ...inpSm, marginBottom: 7 }} />
      <Btn chico tipo="peligro" onClick={onBorrar}>Eliminar definición</Btn>
    </div>}
  </div>);
}

/* ─── Una tarea, en modo edición ─── */
function FilaTarea({ t, plan, onEditar, onBorrar, onAddDef, onDef, onAvisar }) {
  const [ab, setAb] = useState(false);
  const col = t.critica ? T.critico : (COLOR_ETAPA[t.etapa] || T.accent);
  const rojas = t.trabas.filter(d => d.estado === "vencida").length;
  const ambar = t.trabas.filter(d => d.estado === "urgente").length;
  const otras = plan.tareas.filter(x => x.id !== t.id);

  return (<div style={{ background: T.card, borderRadius: 12, marginTop: 9, boxShadow: SHDsm, overflow: "hidden", borderLeft: `4px solid ${col}` }}>
    <div onClick={() => setAb(!ab)} style={{ padding: "12px 13px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, color: col, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", display: "flex", gap: 6, alignItems: "center" }}>
            <span>{t.cod}</span>
            {t.critica ? <span style={{ color: T.critico }}>· CRÍTICA</span> : <span style={{ color: T.muted }}>· holgura {t.holgura}d</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 1 }}>{t.nombre}</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 3 }}>
            {fmtCorta(t.vvInicio)} → {fmtCorta(t.vvFin)} · {t.dias} días · {t.peso}% del contrato
          </div>
          {t.bfInicio && t.bfFin && (
            <div style={{ fontSize: 11.5, color: BRASS, fontWeight: 700, marginTop: 1 }}>
              Belfast: {fmtCorta(t.bfInicio)} → {fmtCorta(t.bfFin)}
              {t.desvio !== null && t.desvio !== 0 && (
                <span style={{ color: t.desvio > 0 ? T.danger : T.ok, marginLeft: 6 }}>
                  {t.desvio > 0 ? `${t.desvio}d tarde` : `${Math.abs(t.desvio)}d antes`}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
          {rojas > 0 && <Chip color={T.danger} fondo="#FEF2F2">{rojas} vencida{rojas > 1 ? "s" : ""}</Chip>}
          {ambar > 0 && <Chip color="#B45309" fondo="#FFFBEB">{ambar} urgente{ambar > 1 ? "s" : ""}</Chip>}
          {t.avance > 0 && <Chip color={T.ok} fondo="#ECFDF5">{t.avance}%</Chip>}
          <span style={{ fontSize: 11, color: T.muted }}>{ab ? "▲" : "▼"}</span>
        </div>
      </div>
    </div>

    {ab && <div style={{ padding: "0 13px 13px", borderTop: `1px solid ${T.border}` }}>
      <input defaultValue={t.nombre} onBlur={e => onEditar({ nombre: e.target.value })} style={inp} />
      <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Dura (días)</div>
          <input defaultValue={t.dias} onBlur={e => onEditar({ dias: Math.max(1, numSimple(e.target.value)) })} inputMode="numeric" style={inpSm} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Peso (% contrato)</div>
          <input defaultValue={t.peso} onBlur={e => onEditar({ peso: numSimple(e.target.value) })} inputMode="decimal" style={inpSm} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Avance %</div>
          <input defaultValue={t.avance} onBlur={e => onEditar({ avance: Math.max(0, Math.min(100, numSimple(e.target.value))) })} inputMode="numeric" style={inpSm} />
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Etapa</div>
        <select defaultValue={t.etapa} onChange={e => onEditar({ etapa: e.target.value })} style={inpSm}>
          {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* dependencias: de acá sale el camino crítico */}
      <div style={{ fontSize: 10.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", marginTop: 14, letterSpacing: ".05em" }}>Depende de</div>
      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2, lineHeight: 1.45 }}>De acá sale el camino crítico. FC = arranca cuando la otra termina. CC = arranca junto con la otra.</div>
      {(t.deps || []).map((d, i) => (
        <div key={i} style={{ display: "flex", gap: 5, marginTop: 6, alignItems: "center" }}>
          <select value={d.cod} onChange={e => onEditar({ deps: t.deps.map((x, k) => k === i ? { ...x, cod: e.target.value } : x) })} style={{ ...inpSm, flex: 2 }}>
            {otras.map(o => <option key={o.id} value={o.cod}>{o.cod} · {o.nombre.slice(0, 22)}</option>)}
          </select>
          <select value={d.tipo} onChange={e => onEditar({ deps: t.deps.map((x, k) => k === i ? { ...x, tipo: e.target.value } : x) })} style={{ ...inpSm, width: 62 }}>
            <option value="FC">FC</option><option value="CC">CC</option>
          </select>
          <input defaultValue={d.lag} onBlur={e => onEditar({ deps: t.deps.map((x, k) => k === i ? { ...x, lag: numSimple(e.target.value) } : x) })}
            inputMode="numeric" title="días de demora" style={{ ...inpSm, width: 52, textAlign: "right" }} />
          <button onClick={() => onEditar({ deps: t.deps.filter((_, k) => k !== i) })} style={{ background: "none", border: "none", color: T.muted, fontSize: 15, cursor: "pointer", padding: "0 3px" }}>×</button>
        </div>
      ))}
      <div style={{ marginTop: 7 }}>
        <Btn chico tipo="suave" onClick={() => otras[0] && onEditar({ deps: [...(t.deps || []), { cod: otras[0].cod, tipo: "FC", lag: 0 }] })}>+ Dependencia</Btn>
      </div>

      <div style={{ fontSize: 10.5, fontWeight: 800, color: BRASS, textTransform: "uppercase", marginTop: 14, letterSpacing: ".05em" }}>Fechas de Belfast</div>
      <div style={{ display: "flex", gap: 7, marginTop: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Inicio</div>
          <input type="date" defaultValue={t.bfInicio || ""} onBlur={e => onEditar({ bfInicio: e.target.value })} style={inpSm} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Fin</div>
          <input type="date" defaultValue={t.bfFin || ""} onBlur={e => onEditar({ bfFin: e.target.value })} style={inpSm} />
        </div>
      </div>

      <div style={{ fontSize: 10.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", marginTop: 15, letterSpacing: ".05em" }}>
        Definiciones que la traban ({(t.defs || []).length})
      </div>
      {(t.defs || []).map(d => (
        <FilaDef key={d.id} d={d}
          onToggle={() => onDef(d.id, x => ({ ...x, ok: !x.ok, fechaOk: !x.ok ? hoyISO() : "" }))}
          onEditar={(c) => onDef(d.id, x => ({ ...x, ...c }))}
          onBorrar={() => onDef(d.id, null)}
          onAvisar={(p) => onAvisar(d, p)} />
      ))}
      <div style={{ marginTop: 9 }}><Btn chico tipo="suave" onClick={onAddDef}>+ Agregar definición</Btn></div>

      <div style={{ marginTop: 14, paddingTop: 11, borderTop: `1px solid ${T.border}` }}>
        <Btn chico tipo="peligro" onClick={onBorrar}>Eliminar tarea</Btn>
      </div>
    </div>}
  </div>);
}

/* ─── Plata: el cronograma cargado con el contrato ─── */
function PanelPlata({ obra, plan, finanzas, onLigar, onEditar }) {
  if (!plan.ligada) {
    return (<div>
      <div style={{ background: T.card, borderRadius: 14, padding: 18, boxShadow: SHDsm }}>
        <div style={{ fontSize: 14.5, fontWeight: 800 }}>Enganchá esta obra con Finanzas</div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 5, lineHeight: 1.55 }}>
          Elegí a qué obra de Finanzas corresponde. Con eso la app reparte el monto del contrato entre las tareas
          según su peso, y podés ver si lo que está ejecutado ya se certificó y se pagó.
        </div>
        <select value={obra.finanzasObraId || ""} onChange={e => onLigar(e.target.value)} style={{ ...inp, marginTop: 11 }}>
          <option value="">— Elegí la obra de Finanzas —</option>
          {(finanzas?.obras || []).map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        {!(finanzas?.obras || []).length && (
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
            No hay obras cargadas en Finanzas todavía. Cargalas ahí y vuelven a aparecer acá.
          </div>
        )}
      </div>
    </div>);
  }

  const pctCert = plan.contrato > 0 ? plan.certificado / plan.contrato * 100 : 0;
  const pctEjec = plan.contrato > 0 ? plan.ejecutado / plan.contrato * 100 : 0;

  return (<div>
    <div style={{ background: `linear-gradient(155deg, #14263E 0%, ${T.navy} 68%)`, color: "#fff", borderRadius: 18, padding: 20, boxShadow: SHD, borderTop: `3px solid ${BRASS}` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: BRASS, letterSpacing: ".1em", textTransform: "uppercase" }}>Ejecutado y sin certificar</div>
      <div style={{ fontSize: 38, fontWeight: 800, margin: "7px 0 2px", color: plan.sinCertificar > 0 ? "#FCD34D" : "#7DE0A6", letterSpacing: "-.02em", lineHeight: 1.05 }}>
        {money(plan.sinCertificar)}
      </div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.7)", lineHeight: 1.5 }}>
        {plan.sinCertificar > 0
          ? "Trabajo que ya hiciste y todavía no le facturaste a Belfast."
          : "Todo lo ejecutado ya está certificado."}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.14)", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 90 }}>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase", fontWeight: 700 }}>Contrato</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{money(plan.contrato)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 90 }}>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase", fontWeight: 700 }}>Ejecutado</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{money(plan.ejecutado)}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)" }}>{pctEjec.toFixed(0)}%</div>
        </div>
        <div style={{ flex: 1, minWidth: 90 }}>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase", fontWeight: 700 }}>Certificado</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{money(plan.certificado)}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)" }}>{pctCert.toFixed(0)}%</div>
        </div>
        <div style={{ flex: 1, minWidth: 90 }}>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.6)", textTransform: "uppercase", fontWeight: 700 }}>Pagado a prov.</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{money(plan.pagado)}</div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)", marginTop: 10 }}>Ligada a “{plan.finanzasNombre}” en Finanzas</div>
    </div>

    <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".06em", margin: "16px 0 2px" }}>Tarea por tarea</div>
    <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 4, lineHeight: 1.5 }}>
      Marcá si cada tarea ya se certificó (le facturaste a Belfast) y si ya la pagaste. Así ves, por ejemplo, si la losa terminada ya está cobrada y pagada.
    </div>

    {plan.tareas.filter(t => t.avance > 0 || t.certificado || t.pagado).length === 0 && (
      <div style={{ background: T.card, borderRadius: 12, padding: 16, textAlign: "center", boxShadow: SHDsm, marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Todavía no cargaste avance en ninguna tarea</div>
        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4 }}>Cargá el % de avance en “Editar” y las tareas aparecen acá.</div>
      </div>
    )}

    {plan.tareas.filter(t => t.avance > 0 || t.certificado || t.pagado).map(t => (
      <div key={t.id} style={{ background: T.card, borderRadius: 12, padding: 12, marginTop: 8, boxShadow: SHDsm, borderLeft: `4px solid ${t.critica ? T.critico : COLOR_ETAPA[t.etapa] || T.accent}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.nombre}</div>
            <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>
              {t.avance}% hecho · vale {money(t.valor)} · ejecutado {money(t.ejecutado)}
            </div>
          </div>
          {t.avance >= 100 && <Chip color={T.ok} fondo="#ECFDF5">terminada</Chip>}
        </div>
        <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
          <button onClick={() => onEditar(t.id, { certificado: !t.certificado })} style={{
            flex: 1, padding: "8px 6px", borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${t.certificado ? T.ok : T.border}`,
            background: t.certificado ? "#ECFDF5" : "#fff", color: t.certificado ? T.ok : T.sub,
          }}>{t.certificado ? "✓ Certificada" : "Certificar"}</button>
          <button onClick={() => onEditar(t.id, { pagado: !t.pagado })} style={{
            flex: 1, padding: "8px 6px", borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${t.pagado ? T.ok : T.border}`,
            background: t.pagado ? "#ECFDF5" : "#fff", color: t.pagado ? T.ok : T.sub,
          }}>{t.pagado ? "✓ Pagada" : "Marcar pagada"}</button>
        </div>
        {t.avance >= 100 && !t.certificado && (
          <div style={{ fontSize: 11, color: "#B45309", marginTop: 7, fontWeight: 700 }}>
            Terminada y sin certificar: {money(t.valor)} que podrías estar facturando.
          </div>
        )}
      </div>
    ))}
  </div>);
}

/* ─── Qué se viene: las próximas 6 semanas ─── */
function Lookahead({ plan, onAvisar, obra }) {
  const hoy = hoyISO();
  const limite = isoMas(hoy, 42);
  const proximas = plan.tareas
    .filter(t => t.vvInicio <= limite && t.vvFin >= hoy)
    .sort((a, b) => a.es - b.es);

  return (<div>
    <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.55, marginBottom: 10 }}>
      Lo que arranca o sigue en curso en las próximas 6 semanas, y si está listo para empezar.
      Una tarea no está lista si le falta una definición.
    </div>

    {proximas.length === 0 && (
      <div style={{ background: T.card, borderRadius: 12, padding: 18, textAlign: "center", boxShadow: SHDsm }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>No hay tareas en las próximas 6 semanas</div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>Revisá la fecha de inicio de la obra.</div>
      </div>
    )}

    {proximas.map(t => {
      const lista = t.trabas.length === 0;
      return (<div key={t.id} style={{
        background: T.card, borderRadius: 12, padding: 13, marginTop: 9, boxShadow: SHDsm,
        borderLeft: `4px solid ${lista ? T.ok : T.danger}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{t.nombre}</div>
            <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>
              {t.arrancaEn > 0 ? `Arranca en ${t.arrancaEn} días` : t.arrancaEn === 0 ? "Arranca hoy" : "En curso"} · {fmtCorta(t.vvInicio)} → {fmtCorta(t.vvFin)}
            </div>
            {t.critica && <div style={{ fontSize: 10.5, color: T.critico, fontWeight: 800, marginTop: 2 }}>CAMINO CRÍTICO — si se atrasa, se atrasa toda la obra</div>}
          </div>
          <Chip color={lista ? T.ok : T.danger} fondo={lista ? "#ECFDF5" : "#FEF2F2"}>
            {lista ? "Lista" : `Traba: ${t.trabas.length}`}
          </Chip>
        </div>

        {t.trabas.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: T.danger, textTransform: "uppercase", letterSpacing: ".05em" }}>No puede arrancar hasta que se defina</div>
            {t.trabas.map(d => (
              <FilaDef key={d.id} d={d} compacto
                onToggle={() => {}} onEditar={() => {}} onBorrar={() => {}}
                onAvisar={(p) => onAvisar(obra, d, p)} />
            ))}
          </div>
        )}
      </div>);
    })}
  </div>);
}

/* ═══════════════════ PANTALLA DE OBRA ═══════════════════ */
function PantallaObra({ obra, plan, finanzas, guardarObra, borrarObra, volver, avisar, diasAviso }) {
  const [vista, setVista] = useState("plan");
  const [soloCrit, setSoloCrit] = useState(false);

  const editarTarea = (tid, campos) => guardarObra(o => ({ ...o, tareas: (o.tareas || []).map(t => t.id === tid ? { ...t, ...campos } : t) }));
  const borrarTarea = (tid) => { if (confirm("¿Eliminar esta tarea?")) guardarObra(o => ({ ...o, tareas: (o.tareas || []).filter(t => t.id !== tid) })); };
  const addDef = (tid) => guardarObra(o => ({
    ...o, tareas: (o.tareas || []).map(t => t.id === tid
      ? { ...t, defs: [...(t.defs || []), { id: uid(), nombre: "Nueva definición", diasAntes: 30, porQue: "", consecuencia: "", plazoReal: "", ok: false, fechaOk: "", avisadoVV: false, avisadoBF: false }] }
      : t),
  }));
  const editarDef = (tid, did, fn) => guardarObra(o => ({
    ...o, tareas: (o.tareas || []).map(t => {
      if (t.id !== tid) return t;
      if (fn === null) return { ...t, defs: (t.defs || []).filter(d => d.id !== did) };
      return { ...t, defs: (t.defs || []).map(d => d.id === did ? fn(d) : d) };
    }),
  }));
  const addTarea = () => guardarObra(o => ({
    ...o, tareas: [...(o.tareas || []), {
      id: uid(), cod: "T" + String((o.tareas || []).length + 1).padStart(2, "0"),
      etapa: "Terminaciones", nombre: "Nueva tarea", dias: 10, deps: [], peso: 1,
      avance: 0, certificado: false, pagado: false, bfInicio: "", bfFin: "", defs: [],
    }],
  }));
  const normalizar = () => {
    const total = plan.pesoTotal;
    if (total <= 0) return;
    guardarObra(o => ({ ...o, tareas: (o.tareas || []).map(t => ({ ...t, peso: Math.round(numSimple(t.peso) / total * 1000) / 10 })) }));
  };

  const porEtapa = useMemo(() => {
    const g = {};
    for (const t of plan.tareas) (g[t.etapa] = g[t.etapa] || []).push(t);
    return g;
  }, [plan.tareas]);

  const VISTAS = [
    ["plan", "Cronograma"],
    ["viene", `Qué viene${plan.bloqueadas.length ? ` (${plan.bloqueadas.length})` : ""}`],
    ["defs", `Definiciones${plan.pendientes.length ? ` (${plan.pendientes.length})` : ""}`],
    ["plata", "Plata"],
    ["editar", "Editar"],
  ];

  return (<div style={{ padding: "14px 16px 44px" }}>
    <button onClick={volver} style={{ background: "none", border: "none", color: T.accent, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 11 }}>← Todas las obras</button>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
      <h2 style={{ fontSize: 21, fontWeight: 800, margin: 0, letterSpacing: "-.01em" }}>{obra.nombre}</h2>
      <button onClick={borrarObra} style={{ background: "none", border: "none", color: T.muted, fontSize: 11.5, cursor: "pointer" }}>Eliminar</button>
    </div>

    <Hero obra={obra} plan={plan} />

    <div style={{ display: "flex", gap: 2, background: T.card, borderRadius: 12, padding: 4, margin: "14px 0", boxShadow: SHDsm, overflowX: "auto" }}>
      {VISTAS.map(([k, l]) => (
        <button key={k} onClick={() => setVista(k)} style={{
          flex: "1 0 auto", background: vista === k ? T.accent : "transparent", color: vista === k ? "#fff" : T.sub,
          border: "none", borderRadius: 9, padding: "9px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          whiteSpace: "nowrap", fontFamily: "inherit",
        }}>{l}</button>
      ))}
    </div>

    {vista === "plan" && <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span style={{ fontSize: 12, color: T.sub, flex: 1 }}>Inicio de obra</span>
        <input type="date" defaultValue={obra.inicio} onBlur={e => guardarObra(o => ({ ...o, inicio: e.target.value }))} style={{ ...inpSm, width: 150 }} />
      </div>
      <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 11, padding: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.critico, textTransform: "uppercase", letterSpacing: ".05em" }}>El camino crítico</div>
        <div style={{ fontSize: 11.5, color: T.text, marginTop: 4, lineHeight: 1.55 }}>
          {plan.criticas.length} tareas sin holgura. Si cualquiera se atrasa un día, la obra entera termina un día más tarde.
          Son las que hay que cuidar para llegar a los 12 meses.
        </div>
        <div style={{ marginTop: 8 }}>
          <Btn chico tipo={soloCrit ? "primario" : "suave"} onClick={() => setSoloCrit(!soloCrit)}>
            {soloCrit ? "Ver todas las tareas" : "Ver solo las críticas"}
          </Btn>
        </div>
      </div>
      <Gantt obra={obra} plan={plan} soloCriticas={soloCrit} />
    </>}

    {vista === "viene" && <Lookahead plan={plan} obra={obra} onAvisar={avisar} />}

    {vista === "defs" && <>
      {plan.defs.length === 0 && (
        <div style={{ background: T.card, borderRadius: 12, padding: 18, textAlign: "center", boxShadow: SHDsm }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Esta obra no tiene definiciones cargadas</div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>Sumalas desde “Editar”, en la tarea que corresponda.</div>
        </div>
      )}
      {["vencida", "urgente", "futura", "ok"].map(est => {
        const g = plan.defs.filter(d => d.estado === est);
        if (!g.length) return null;
        const s = SEM[est];
        return (<div key={est} style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: s.c, textTransform: "uppercase", letterSpacing: ".06em" }}>
            {est === "vencida" ? "Vencidas — frenan la obra" : est === "urgente" ? `Urgentes — dentro de ${diasAviso} días` : est === "futura" ? "Más adelante" : "Ya definidas"} ({g.length})
          </div>
          {g.map(d => (
            <FilaDef key={d.id} d={d}
              onToggle={() => editarDef(d.tareaId, d.id, x => ({ ...x, ok: !x.ok, fechaOk: !x.ok ? hoyISO() : "" }))}
              onEditar={(c) => editarDef(d.tareaId, d.id, x => ({ ...x, ...c }))}
              onBorrar={() => editarDef(d.tareaId, d.id, null)}
              onAvisar={(p) => avisar(obra, d, p)} />
          ))}
        </div>);
      })}
    </>}

    {vista === "plata" && (
      <PanelPlata obra={obra} plan={plan} finanzas={finanzas}
        onLigar={(id) => guardarObra(o => ({ ...o, finanzasObraId: id }))}
        onEditar={editarTarea} />
    )}

    {vista === "editar" && <>
      <div style={{ background: T.card, borderRadius: 11, padding: 12, boxShadow: SHDsm, marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Los pesos suman {plan.pesoTotal.toFixed(1)}%</div>
            <div style={{ fontSize: 10.5, color: Math.abs(plan.pesoTotal - 100) > 0.5 ? T.warn : T.muted, marginTop: 2 }}>
              {Math.abs(plan.pesoTotal - 100) > 0.5 ? "Conviene que sumen 100% para que la plata cierre." : "Perfecto."}
            </div>
          </div>
          {Math.abs(plan.pesoTotal - 100) > 0.5 && <Btn chico tipo="suave" onClick={normalizar}>Ajustar a 100%</Btn>}
        </div>
      </div>
      {ETAPAS.map(et => {
        const ts = porEtapa[et];
        if (!ts?.length) return null;
        return (<div key={et} style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: COLOR_ETAPA[et], textTransform: "uppercase", letterSpacing: ".06em" }}>{et}</div>
          {ts.map(t => (
            <FilaTarea key={t.id} t={t} plan={plan}
              onEditar={(c) => editarTarea(t.id, c)}
              onBorrar={() => borrarTarea(t.id)}
              onAddDef={() => addDef(t.id)}
              onDef={(did, fn) => editarDef(t.id, did, fn)}
              onAvisar={(d, p) => avisar(obra, d, p)} />
          ))}
        </div>);
      })}
      <div style={{ marginTop: 16 }}><Btn full onClick={addTarea}>+ Agregar tarea a esta obra</Btn></div>
    </>}
  </div>);
}

/* ═══════════════════ LA APP ═══════════════════ */
export default function Cronograma() {
  const [data, setData] = useState({ plantilla: [], obras: [], cfg: { aviso: 15 } });
  const [finanzas, setFinanzas] = useState({ obras: [] });
  const [cargando, setCargando] = useState(true);
  const [pantalla, setPantalla] = useState("obras");
  const [obraId, setObraId] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [nom, setNom] = useState("");
  const [ini, setIni] = useState(hoyISO());
  const [toast, setToast] = useState("");
  const escrito = useRef(0);
  const avisarToast = (t) => { setToast(t); setTimeout(() => setToast(""), 3800); };

  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get("vv_cronograma");
        const d = r?.value ? JSON.parse(r.value) : null;
        setData({
          plantilla: d?.plantilla?.length ? d.plantilla : JSON.parse(JSON.stringify(PLANTILLA_BASE)),
          obras: d?.obras || [],
          cfg: { aviso: numSimple(d?.cfg?.aviso) || 15 },
        });
      } catch {
        setData({ plantilla: JSON.parse(JSON.stringify(PLANTILLA_BASE)), obras: [], cfg: { aviso: 15 } });
      }
      // traigo las obras de Finanzas, para poder enganchar el contrato
      try {
        const r = await storage.get("vv_finanzas");
        if (r?.value) { const f = JSON.parse(r.value); setFinanzas({ obras: f?.obras || [] }); }
      } catch { }
      setCargando(false);
    })();
  }, []);

  const guardar = (nuevo) => {
    setData(nuevo);
    escrito.current = Date.now();
    storage.set("vv_cronograma", JSON.stringify(nuevo));
    storage.set("vv_cronograma__ts", String(escrito.current));
  };

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const rTs = await storage.get("vv_cronograma__ts");
        const ct = Number(rTs?.value || 0);
        if (ct > escrito.current) {
          const r = await storage.get("vv_cronograma");
          if (r?.value) {
            const d = JSON.parse(r.value);
            escrito.current = ct;
            setData({ plantilla: d.plantilla || [], obras: d.obras || [], cfg: { aviso: numSimple(d.cfg?.aviso) || 15 } });
          }
        }
        const rf = await storage.get("vv_finanzas");
        if (rf?.value) { const f = JSON.parse(rf.value); setFinanzas({ obras: f?.obras || [] }); }
      } catch { }
    }, 12000);
    return () => clearInterval(iv);
  }, []);

  const diasAviso = numSimple(data.cfg?.aviso) || 15;
  const obras = data.obras || [];
  const planes = useMemo(() => {
    const m = {};
    for (const o of obras) m[o.id] = calcObra(o, diasAviso, finanzas);
    return m;
  }, [obras, diasAviso, finanzas]);

  const badge = obras.reduce((s, o) => s + (planes[o.id]?.vencidas.length || 0) + (planes[o.id]?.urgentes.length || 0), 0);

  const guardarObra = (oid, fn) => guardar({ ...data, obras: obras.map(o => o.id === oid ? fn(o) : o) });
  const marcarDef = (oid, tid, did, fn) => guardarObra(oid, o => ({
    ...o, tareas: (o.tareas || []).map(t => {
      if (t.id !== tid) return t;
      if (fn === null) return { ...t, defs: (t.defs || []).filter(d => d.id !== did) };
      return { ...t, defs: (t.defs || []).map(d => d.id === did ? fn(d) : d) };
    }),
  }));

  const crearObra = () => {
    if (!nom.trim()) return;
    const o = { id: uid(), nombre: nom.trim(), inicio: ini || hoyISO(), finanzasObraId: "", tareas: plantillaAObra(data.plantilla) };
    guardar({ ...data, obras: [...obras, o] });
    setNom(""); setIni(hoyISO()); setNueva(false);
    setObraId(o.id); setPantalla("obra");
  };

  const avisar = async (obra, d, para) => {
    const quien = para === "vv" ? "V+V" : "Belfast";
    const urg = d.estado === "vencida" ? "VENCIDA" : "URGENTE";
    const cuando = d.estado === "vencida"
      ? `Debía estar definida el ${fmtFecha(d.limite)} — hace ${Math.abs(d.faltan)} días.`
      : `Hay tiempo hasta el ${fmtFecha(d.limite)} — faltan ${d.faltan} días.`;
    const detalle = [
      `DEFINICIÓN ${urg} — ${obra.nombre}`, "",
      `Qué hay que definir: ${d.nombre}`,
      `Traba la tarea: ${d.tareaNombre}, que arranca el ${fmtFecha(d.tareaInicio)}.`,
      d.critica ? "Esa tarea está en el CAMINO CRÍTICO: si se atrasa, se corre la fecha de entrega de toda la obra." : "",
      cuando,
      d.plazoReal ? `Proceso real de definición: ${d.plazoReal}.` : "",
      d.porQue ? `\nPor qué la obra la necesita: ${d.porQue}` : "",
      d.consecuencia ? `Si llega tarde: ${d.consecuencia}` : "",
    ].filter(Boolean).join("\n");

    const ok = await crearPedido({
      para, asunto: `Definición: ${d.nombre} — ${obra.nombre}`,
      detalle, prioridad: d.estado === "vencida" ? "alta" : "media",
    });
    if (!ok) { avisarToast("No se pudo enviar. Revisá la conexión."); return; }
    marcarDef(obra.id, d.tareaId, d.id, x => ({ ...x, [para === "vv" ? "avisadoVV" : "avisadoBF"]: true }));
    avisarToast(`Alerta enviada a ${quien}. Queda en Pedidos.`);
  };

  const obra = obras.find(o => o.id === obraId);
  const plan = obra ? planes[obra.id] : null;

  if (cargando) return (<div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif", color: T.sub, fontSize: 13 }}>Cargando cronogramas…</div>);

  const NAV = [["obras", "Obras"], ["alertas", "Alertas"], ["modelo", "Modelo"], ["ajustes", "Ajustes"]];

  /* alertas globales */
  const todasAlertas = [];
  obras.forEach(o => { (planes[o.id]?.pendientes || []).forEach(d => todasAlertas.push({ ...d, obra: o })); });
  todasAlertas.sort((a, b) => (a.faltan ?? 9999) - (b.faltan ?? 9999));

  return (<div style={{ minHeight: "100vh", background: T.bg, fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: T.text }}>
    <header style={{ position: "sticky", top: 0, zIndex: 200, background: T.card, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ background: T.navy, padding: "6px 16px", textAlign: "center" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: BRASS }}>V+V Construcciones · Cronogramas</span>
      </div>
      <nav style={{ display: "flex", gap: 2, padding: "0 10px", overflowX: "auto" }}>
        {NAV.map(([k, l]) => {
          const act = pantalla === k || (k === "obras" && pantalla === "obra");
          const n = k === "alertas" ? badge : 0;
          return (<button key={k} onClick={() => { setPantalla(k); if (k === "obras") setObraId(null); }} style={{
            position: "relative", background: "none", border: "none", padding: "11px 13px",
            fontSize: 12.5, fontWeight: (act || n > 0) ? 800 : 600,
            color: n > 0 ? T.danger : (act ? T.accent : T.sub),
            borderBottom: `2px solid ${act ? BRASS : "transparent"}`, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
          }}>
            {l}
            {n > 0 && <span style={{ position: "absolute", top: 4, right: 2, background: T.danger, color: "#fff", borderRadius: 9, minWidth: 15, height: 15, fontSize: 8.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{n > 99 ? "99+" : n}</span>}
          </button>);
        })}
      </nav>
      <div style={{ height: 2, background: BRASS }} />
    </header>

    <main style={{ maxWidth: 900, margin: "0 auto" }}>
      {pantalla === "obra" && obra && plan && (
        <PantallaObra obra={obra} plan={plan} finanzas={finanzas} diasAviso={diasAviso}
          guardarObra={(fn) => guardarObra(obra.id, fn)}
          borrarObra={() => {
            if (!confirm(`¿Eliminar el cronograma de ${obra.nombre}?`)) return;
            guardar({ ...data, obras: obras.filter(o => o.id !== obra.id) });
            setObraId(null); setPantalla("obras");
          }}
          volver={() => { setObraId(null); setPantalla("obras"); }}
          avisar={avisar} />
      )}

      {pantalla === "obras" && !obra && (<div style={{ padding: "14px 16px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ fontSize: 21, fontWeight: 800, margin: 0, letterSpacing: "-.01em" }}>Obras</h2>
          <Btn chico onClick={() => setNueva(!nueva)}>{nueva ? "Cerrar" : "+ Nueva obra"}</Btn>
        </div>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 12 }}>Un cronograma por obra. Arranca con una copia del modelo y después la ajustás.</div>

        {nueva && <div style={{ background: T.card, borderRadius: 13, padding: 14, marginBottom: 14, boxShadow: SHDsm }}>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nombre de la obra (ej: Castores 475)" style={{ ...inp, marginTop: 0 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
            <span style={{ fontSize: 12.5, color: T.sub, flex: 1 }}>Fecha de inicio</span>
            <input type="date" value={ini} onChange={e => setIni(e.target.value)} style={{ ...inpSm, width: 155 }} />
          </div>
          <div style={{ marginTop: 11 }}><Btn full onClick={crearObra} disabled={!nom.trim()}>Crear cronograma</Btn></div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>
            Copia las {data.plantilla?.length || 0} tareas del modelo, con sus dependencias y definiciones.
          </div>
        </div>}

        {obras.length === 0 && !nueva && (
          <div style={{ background: T.card, borderRadius: 14, padding: 26, textAlign: "center", boxShadow: SHDsm }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Todavía no hay cronogramas</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 5, lineHeight: 1.55 }}>Creá el primero y la app empieza a avisarte cuándo hace falta cada definición.</div>
            <div style={{ marginTop: 14 }}><Btn onClick={() => setNueva(true)}>Crear la primera obra</Btn></div>
          </div>
        )}

        {obras.map(o => {
          const p = planes[o.id];
          if (!p) return null;
          const pct = Math.min(100, p.finDias / TOPE_DIAS * 100);
          const col = p.excede ? T.danger : T.accent;
          return (<div key={o.id} onClick={() => { setObraId(o.id); setPantalla("obra"); }} style={{
            background: T.card, borderRadius: 13, padding: 14, marginTop: 10, boxShadow: SHDsm, cursor: "pointer",
            borderLeft: `4px solid ${p.vencidas.length ? T.danger : p.urgentes.length ? T.warn : BRASS}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800 }}>{o.nombre}</div>
                <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>
                  {fmtFecha(o.inicio)} → {fmtFecha(p.fin)} · <b style={{ color: col }}>{p.meses.toFixed(1)} meses</b> · {p.avancePond.toFixed(0)}% hecho
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                {p.vencidas.length > 0 && <Chip color={T.danger} fondo="#FEF2F2">{p.vencidas.length} vencida{p.vencidas.length > 1 ? "s" : ""}</Chip>}
                {p.urgentes.length > 0 && <Chip color="#B45309" fondo="#FFFBEB">{p.urgentes.length} urgente{p.urgentes.length > 1 ? "s" : ""}</Chip>}
                {p.excede && <Chip color={T.danger} fondo="#FEF2F2">+12 meses</Chip>}
              </div>
            </div>
            <div style={{ marginTop: 9, height: 5, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: col }} />
            </div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>
              {p.tareas.length} tareas · {p.criticas.length} críticas · {p.pendientes.length} a definir
              {p.ligada && ` · ${money(p.sinCertificar)} sin certificar`}
            </div>
          </div>);
        })}
      </div>)}

      {pantalla === "alertas" && (<div style={{ padding: "14px 16px 44px" }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 3px", letterSpacing: "-.01em" }}>Alertas</h2>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 14 }}>Definiciones de todas las obras, por urgencia. Avisa {diasAviso} días antes del límite.</div>
        {todasAlertas.length === 0 && (
          <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 14, padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ok }}>Todo al día</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 4 }}>No hay definiciones pendientes.</div>
          </div>
        )}
        {[["Vencidas — están frenando la obra", todasAlertas.filter(d => d.estado === "vencida"), T.danger],
          [`Urgentes — dentro de ${diasAviso} días`, todasAlertas.filter(d => d.estado === "urgente"), "#B45309"],
          ["Más adelante", todasAlertas.filter(d => d.estado === "futura"), T.sub]].map(([tit, g, col]) => {
          if (!g.length) return null;
          return (<div key={tit} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: col, textTransform: "uppercase", letterSpacing: ".06em" }}>{tit} ({g.length})</div>
            {g.map(d => (<div key={d.obra.id + d.id}>
              <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, marginTop: 9, marginBottom: -3, textTransform: "uppercase" }}>{d.obra.nombre}</div>
              <FilaDef d={d}
                onToggle={() => marcarDef(d.obra.id, d.tareaId, d.id, x => ({ ...x, ok: !x.ok, fechaOk: !x.ok ? hoyISO() : "" }))}
                onEditar={(c) => marcarDef(d.obra.id, d.tareaId, d.id, x => ({ ...x, ...c }))}
                onBorrar={() => marcarDef(d.obra.id, d.tareaId, d.id, null)}
                onAvisar={(p) => avisar(d.obra, d, p)} />
            </div>))}
          </div>);
        })}
      </div>)}

      {pantalla === "modelo" && (
        <PantallaModelo plantilla={data.plantilla || []} guardar={(p) => guardar({ ...data, plantilla: p })} />
      )}

      {pantalla === "ajustes" && (<div style={{ padding: "14px 16px 44px" }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 14px", letterSpacing: "-.01em" }}>Ajustes</h2>
        <div style={{ background: T.card, borderRadius: 13, padding: 14, boxShadow: SHDsm }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Avisar con cuántos días de anticipación</div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>Una definición pasa a “urgente” cuando le quedan estos días o menos.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <input defaultValue={diasAviso} onBlur={e => guardar({ ...data, cfg: { ...data.cfg, aviso: Math.max(1, numSimple(e.target.value)) } })} inputMode="numeric" style={{ ...inpSm, width: 80, textAlign: "right" }} />
            <span style={{ fontSize: 13, color: T.sub }}>días</span>
          </div>
        </div>
        {[["El camino crítico", "Las tareas se encadenan con dependencias. La app calcula la holgura de cada una: las de holgura cero forman el camino crítico. Si una de esas se atrasa un día, la obra entera termina un día más tarde. Son las que hay que cuidar para entrar en los 12 meses."],
          ["Las definiciones traban tareas", "Una tarea no está lista para arrancar si le falta una definición del comitente. En “Qué viene” aparecen las próximas 6 semanas y cuáles están trabadas. El contenido sale del informe de definiciones de V+V: por qué la obra necesita cada una y qué pasa si llega tarde."],
          ["Cómo llegan las alertas", "Cada definición tiene dos botones. “Avisar a V+V” crea un pedido interno que te aparece en la app de V+V. “Pedir a Belfast” le llega directo a Belfast en su panel. Usa el mismo sistema de Pedidos, así que queda el hilo y el estado."],
          ["La plata", "Cada tarea pesa un % del contrato. Enganchás la obra con Finanzas y la app reparte el monto real entre las tareas. Con el avance cargado te dice cuánto ejecutaste, y marcás qué está certificado y qué está pagado."]].map(([t2, d2]) => (
          <div key={t2} style={{ background: T.card, borderRadius: 13, padding: 14, marginTop: 11, boxShadow: SHDsm }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t2}</div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 5, lineHeight: 1.6 }}>{d2}</div>
          </div>
        ))}
      </div>)}
    </main>

    {toast && <div style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9998, background: T.navy, color: "#fff", borderRadius: 11, padding: "12px 15px", fontSize: 12.5, fontWeight: 700, boxShadow: "0 8px 26px rgba(0,0,0,.28)", borderLeft: `3px solid ${BRASS}` }}>{toast}</div>}
    <SyncBanner />
  </div>);
}

/* ═══════════════════ EL MODELO ═══════════════════ */
function PantallaModelo({ plantilla, guardar }) {
  const editar = (i, c) => guardar(plantilla.map((t, k) => k === i ? { ...t, ...c } : t));
  const borrar = (i) => { if (confirm("¿Sacar esta tarea del modelo?")) guardar(plantilla.filter((_, k) => k !== i)); };
  const agregar = () => guardar([...plantilla, { cod: "T" + (plantilla.length + 1), etapa: "Terminaciones", nombre: "Nueva tarea", dias: 10, deps: [], peso: 1, defs: [] }]);
  const addDef = (i) => editar(i, { defs: [...(plantilla[i].defs || []), { nombre: "Nueva definición", diasAntes: 30, porQue: "", consecuencia: "", plazoReal: "" }] });
  const editDef = (i, j, c) => editar(i, { defs: (plantilla[i].defs || []).map((d, k) => k === j ? { ...d, ...c } : d) });
  const delDef = (i, j) => editar(i, { defs: (plantilla[i].defs || []).filter((_, k) => k !== j) });
  const restaurar = () => { if (confirm("¿Volver el modelo al original de V+V?")) guardar(JSON.parse(JSON.stringify(PLANTILLA_BASE))); };

  const conIds = plantilla.map((t, i) => ({ ...t, id: "p" + i }));
  const plan = calcCPM(conIds);
  const fin = plan.reduce((m, t) => Math.max(m, t.ef), 0);
  const excede = fin > TOPE_DIAS;
  const peso = plantilla.reduce((s, t) => s + numSimple(t.peso), 0);

  return (<div style={{ padding: "14px 16px 44px" }}>
    <h2 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 3px", letterSpacing: "-.01em" }}>El modelo</h2>
    <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.55, marginBottom: 12 }}>
      El cronograma tipo. Cada obra nueva arranca con una copia y después se edita sola, sin tocar esto.
    </div>

    <div style={{ background: excede ? "#FEF2F2" : T.card, border: `1px solid ${excede ? "#FECACA" : T.border}`, borderRadius: 12, padding: 13, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em" }}>Plazo del modelo</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: excede ? T.danger : T.accent, marginTop: 3 }}>{(fin / 30.44).toFixed(1)} meses</div>
      <div style={{ fontSize: 11.5, color: excede ? T.danger : T.sub, marginTop: 2 }}>
        {excede ? `Se pasa ${fin - TOPE_DIAS} días del tope.` : `${fin} días · entra en los 12 meses con ${TOPE_DIAS - fin} de margen.`}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
        {plan.filter(t => t.critica).length} tareas en el camino crítico · pesos suman {peso.toFixed(1)}%
      </div>
    </div>

    {plantilla.map((t, i) => {
      const p = plan.find(x => x.id === "p" + i);
      return (<div key={i} style={{ background: T.card, borderRadius: 12, padding: 13, marginTop: 9, boxShadow: SHDsm, borderLeft: `4px solid ${p?.critica ? T.critico : COLOR_ETAPA[t.etapa] || T.accent}` }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, color: p?.critica ? T.critico : T.muted, textTransform: "uppercase", marginBottom: 3 }}>
          {t.cod} {p?.critica ? "· CRÍTICA" : `· holgura ${p?.holgura ?? 0}d`}
        </div>
        <input defaultValue={t.nombre} onBlur={e => editar(i, { nombre: e.target.value })} style={{ ...inpSm, fontWeight: 700, marginBottom: 7 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.sub, marginBottom: 3 }}>Dura</div>
            <input defaultValue={t.dias} onBlur={e => editar(i, { dias: Math.max(1, numSimple(e.target.value)) })} inputMode="numeric" style={inpSm} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.sub, marginBottom: 3 }}>Peso %</div>
            <input defaultValue={t.peso} onBlur={e => editar(i, { peso: numSimple(e.target.value) })} inputMode="decimal" style={inpSm} />
          </div>
          <div style={{ flex: 1.3 }}>
            <div style={{ fontSize: 10, color: T.sub, marginBottom: 3 }}>Etapa</div>
            <select defaultValue={t.etapa} onChange={e => editar(i, { etapa: e.target.value })} style={inpSm}>
              {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        {(t.defs || []).map((d, j) => (
          <div key={j} style={{ background: T.bg, borderRadius: 9, padding: 9, marginTop: 7 }}>
            <input defaultValue={d.nombre} onBlur={e => editDef(i, j, { nombre: e.target.value })} placeholder="Qué hay que definir" style={{ ...inpSm, marginBottom: 6 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 11.5, color: T.sub, flex: 1 }}>Días de anticipación</span>
              <input defaultValue={d.diasAntes} onBlur={e => editDef(i, j, { diasAntes: numSimple(e.target.value) })} inputMode="numeric" style={{ ...inpSm, width: 64, textAlign: "right" }} />
              <button onClick={() => delDef(i, j)} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer" }}>Quitar</button>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <Btn chico tipo="suave" onClick={() => addDef(i)}>+ Definición</Btn>
          <Btn chico tipo="peligro" onClick={() => borrar(i)}>Quitar tarea</Btn>
        </div>
      </div>);
    })}

    <div style={{ display: "flex", gap: 7, marginTop: 15 }}>
      <Btn full onClick={agregar}>+ Agregar tarea</Btn>
      <Btn tipo="suave" onClick={restaurar}>Restaurar</Btn>
    </div>
  </div>);
}

export { calcCPM, calcObra, plantillaAObra, PLANTILLA_BASE, isoMas, diasEntre, TOPE_DIAS };
