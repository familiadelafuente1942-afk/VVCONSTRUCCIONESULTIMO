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

/* ═══════════════════ IDENTIDAD VISUAL (el patrón de la suite) ═══════════════════ */
const BRASS = "#B0894F";
const T_LIGHT = {
  navy: "#0B1622", accent: "#1B3A5B", al: "#EEF2F7", bg: "#F5F5F7", card: "#FFFFFF",
  border: "#E8EAED", text: "#0B1622", sub: "#5B6673", muted: "#98A2B0",
  ok: "#16A34A", warn: "#B45309", danger: "#DC2626", critico: "#B91C1C",
  inpBg: "#FBFBFD", dark: false,
};
const T_DARK = {
  navy: "#05070B", accent: "#7FB0EA", al: "#1B222C", bg: "#0C0F14", card: "#161B22",
  border: "#2A313C", text: "#EEF1F5", sub: "#AEB6C2", muted: "#6C7683",
  ok: "#3DDC84", warn: "#F5B44C", danger: "#F87171", critico: "#F87171",
  inpBg: "#0F141B", dark: true,
};
let T = T_LIGHT;
const SHD = "0 6px 22px rgba(15,27,45,.10)";
const SHDsm = "0 2px 10px rgba(15,27,45,.06)";

const buildInp = (t) => ({
  width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${t.border}`,
  borderRadius: 10, outline: "none", marginTop: 8, background: t.inpBg, color: t.text,
  fontFamily: "inherit", boxSizing: "border-box",
});
const buildInpSm = (t) => ({ ...buildInp(t), padding: "7px 9px", fontSize: 13, marginTop: 0 });
let inp = buildInp(T), inpSm = buildInpSm(T);

const FUENTES = [
  ["", "Inter", "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif"],
  ["sistema", "Sistema", "-apple-system,system-ui,'Segoe UI',Roboto,sans-serif"],
  ["serif", "Serif clásica", "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif"],
  ["redonda", "Redondeada", "'SF Pro Rounded','Varela Round',ui-rounded,system-ui,sans-serif"],
  ["elegante", "Elegante", "'Optima','Avenir Next',Avenir,system-ui,sans-serif"],
  ["mono", "Mono", "'SF Mono','JetBrains Mono',ui-monospace,Menlo,monospace"],
];
const fuenteDe = (cfg) => (FUENTES.find(x => x[0] === (cfg?.fuente || "")) || FUENTES[0])[2];

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
const FONDOS_DARK = [
  ["", "Negro", "#0C0F14"],
  ["carbon", "Carbón", "linear-gradient(160deg,#141A22,#05070B)"],
  ["navy", "Navy", "linear-gradient(160deg,#0E1728,#06090F)"],
  ["vino", "Vino", "linear-gradient(160deg,#1C1016,#0A0608)"],
  ["bosque", "Bosque", "linear-gradient(160deg,#0E1613,#050807)"],
  ["violeta", "Violeta", "linear-gradient(160deg,#16121F,#08060C)"],
];
function fondoDe(cfg) {
  const dark = cfg?.modo === "oscuro";
  if (cfg?.fondoUrl) {
    const ov = dark ? "rgba(12,15,20,.82)" : "rgba(245,245,247,.82)";
    return `linear-gradient(${ov},${ov}), url("${cfg.fondoUrl}") center/cover fixed no-repeat`;
  }
  if (dark) { const f = FONDOS_DARK.find(x => x[0] === (cfg?.fondoDark || "")); return f ? f[2] : "#0C0F14"; }
  const f = FONDOS.find(x => x[0] === (cfg?.fondo || "")); return f ? f[2] : "#F5F5F7";
}

/* subir el logo o el fondo a la nube */
async function subirArchivo(file) {
  try {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `cronograma/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const r = await fetch(`${SUPA_URL}/storage/v1/object/bco-media/${path}`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
      body: file,
    });
    if (r.ok) return `${SUPA_URL}/storage/v1/object/public/bco-media/${path}`;
  } catch { }
  return "";
}

function descargarArchivo(nombre, contenido, tipo) {
  try {
    const blob = new Blob([contenido], { type: tipo || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  } catch { alert("No se pudo descargar."); }
}

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
/* ═══ DÍAS HÁBILES ═══
   Se trabaja de lunes a viernes. Las duraciones de las tareas se cuentan en días
   hábiles; las fechas del calendario salen salteando sábados y domingos.        */
function esHabil(iso) {
  if (!iso) return false;
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return false;
  const dow = d.getDay();          // 0 domingo … 6 sábado
  return dow >= 1 && dow <= 5;
}
/* el primer día hábil desde una fecha (si cae finde, se corre al lunes) */
function primerHabil(iso) {
  let f = iso;
  for (let i = 0; i < 7; i++) { if (esHabil(f)) return f; f = isoMas(f, 1); }
  return iso;
}
/* la fecha del n-ésimo día hábil contando desde 'inicio' (n = 0 → el primero) */
function habilDesde(inicio, n) {
  if (!inicio) return "";
  let f = primerHabil(inicio);
  let quedan = Math.max(0, Math.round(numSimple(n)));
  let guarda = 0;
  while (quedan > 0 && guarda < 20000) {
    f = isoMas(f, 1);
    if (esHabil(f)) quedan--;
    guarda++;
  }
  return f;
}
/* cuántos días hábiles hay entre dos fechas (contando la primera, sin la última) */
function habilesEntre(a, b) {
  if (!a || !b) return 0;
  if (a > b) return -habilesEntre(b, a);
  let n = 0, f = a, guarda = 0;
  while (f < b && guarda < 20000) { if (esHabil(f)) n++; f = isoMas(f, 1); guarda++; }
  return n;
}
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const dowDe = (iso) => { const d = new Date(iso + "T12:00:00"); return isNaN(d.getTime()) ? 0 : d.getDay(); };

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
  { cod: "OBR", etapa: "Preliminares", nombre: "Obrador, cerco y replanteo", dias: 7, deps: [], peso: 1.5, materiales: ["Cerco de obra", "Cartelería"], defs: [] },
  { cod: "EXC", etapa: "Preliminares", nombre: "Excavación y movimiento de suelos", dias: 9, deps: [{ cod: "OBR", tipo: "FC", lag: 0 }], peso: 2, materiales: ["Máquina y camiones"], defs: [] },

  { cod: "FUN", etapa: "Estructura", nombre: "Fundaciones y platea", dias: 13, deps: [{ cod: "EXC", tipo: "FC", lag: 0 }], peso: 6, materiales: ["Hierro y hormigón", "Film de polietileno"], defs: [
    { nombre: "Piso radiante: ¿lleva o no?", diasAntes: 90,
      porQue: "Necesita la cañería embutida dentro de la carpeta. Define el paquete de platea y el espesor del contrapiso.",
      consecuencia: "Imposible de agregar después sin romper toda la carpeta del ambiente.",
      plazoReal: "Debe decidirse desde el inicio del proyecto" },
    { nombre: "Parrilla u hogar: modelo y ubicación", diasAntes: 90,
      porQue: "El conducto de humos y su base se resuelven en la estructura y en la mampostería temprana, no se agregan después.",
      consecuencia: "Sin obra mayor, no se puede agregar un conducto de humos correcto una vez cerrada la estructura.",
      plazoReal: "Debe ser de las primeras definiciones de todo el proyecto" },
  ] },
  { cod: "EST", etapa: "Estructura", nombre: "Estructura de hormigón armado", dias: 43, deps: [{ cod: "FUN", tipo: "FC", lag: 0 }], peso: 16, materiales: ["Hierro, encofrados y hormigón"], defs: [] },

  { cod: "MAM", etapa: "Albañilería", nombre: "Mampostería", dias: 32, deps: [{ cod: "EST", tipo: "CC", lag: 32 }], peso: 9, materiales: ["Ladrillos, cemento, cal", "Dinteles"], defs: [
    { nombre: "Carpintería: puertas y ventanas (modelo y medida exacta)", diasAntes: 60,
      porQue: "El vano —la abertura en la pared— se construye a la medida exacta del marco elegido.",
      consecuencia: "Vano mal dimensionado; rotura de mampostería para ajustar.",
      plazoReal: "30 a 60 días de fabricación" },
    { nombre: "Aire acondicionado: tipo, potencia y ubicación de unidades", diasAntes: 30,
      porQue: "Define el pase en pared o losa, la sección de cañería y la banquina de la unidad exterior.",
      consecuencia: "Apertura de pases ya cerrados; riesgo de filtraciones por pases mal ubicados.",
      plazoReal: "15 a 30 días, según stock del equipo" },
  ] },
  { cod: "CUB", etapa: "Albañilería", nombre: "Cubierta y techos", dias: 18, deps: [{ cod: "MAM", tipo: "CC", lag: 25 }], peso: 5, materiales: ["Material de cubierta", "Aislaciones"], defs: [] },

  { cod: "SAN", etapa: "Instalaciones", nombre: "Instalación sanitaria (bajo losa y muros)", dias: 21, deps: [{ cod: "MAM", tipo: "CC", lag: 32 }], peso: 4, materiales: ["Cañería sanitaria", "Artefactos ya definidos"], defs: [
    { nombre: "Griferías y artefactos sanitarios (bidé, inodoro, vanitory, ducha)", diasAntes: 45,
      porQue: "Cada modelo tiene una distancia entre ejes distinta; la cañería se embute con esa medida exacta.",
      consecuencia: "Rotura de revoque o cerámica ya colocada, para reubicar los caños.",
      plazoReal: "20 a 45 días" },
  ] },
  { cod: "ELE", etapa: "Instalaciones", nombre: "Instalación eléctrica (cañerías)", dias: 21, deps: [{ cod: "MAM", tipo: "CC", lag: 36 }], peso: 4, materiales: ["Caños corrugados, cajas", "Tablero"], defs: [
    { nombre: "Cantidad y ubicación de bocas eléctricas y circuitos especiales", diasAntes: 30,
      porQue: "Las cañerías eléctricas se embuten en pared o losa antes del revoque grueso. Incluye TV, datos, cortinas y domótica.",
      consecuencia: "Cableado visto, o rotura de pared para agregar una boca.",
      plazoReal: "La decisión es rápida, pero bloquea la tarea si se demora" },
  ] },
  { cod: "GAS", etapa: "Instalaciones", nombre: "Instalación de gas", dias: 11, deps: [{ cod: "SAN", tipo: "CC", lag: 14 }], peso: 1.5, materiales: ["Cañería de gas", "Artefactos a gas"], defs: [] },
  { cod: "AIR", etapa: "Instalaciones", nombre: "Aire acondicionado (cañerías y pases)", dias: 14, deps: [{ cod: "SAN", tipo: "CC", lag: 14 }], peso: 3, materiales: ["Equipos de A/A", "Cañería frigorífica"], defs: [] },
  { cod: "RAD", etapa: "Instalaciones", nombre: "Piso radiante (colocación)", dias: 11, deps: [{ cod: "SAN", tipo: "FC", lag: 7 }], peso: 2, materiales: ["Caños y colector de piso radiante"], defs: [] },

  { cod: "CPI", etapa: "Albañilería", nombre: "Contrapisos", dias: 14, deps: [{ cod: "RAD", tipo: "FC", lag: 0 }], peso: 4, materiales: ["Hormigón de contrapiso"], defs: [
    { nombre: "Muebles de cocina (bajo mesada, alacenas, isla, electrodomésticos)", diasAntes: 90,
      porQue: "Definen la banquina de apoyo, el nivel de piso bajo el mueble y la ubicación exacta de agua, gas, desagüe y tomas eléctricas.",
      consecuencia: "Rotura de contrapiso y mampostería para reubicar instalaciones; atraso de toda la cocina.",
      plazoReal: "45 a 90 días (elegir + fabricar a medida + entregar)" },
    { nombre: "Banquina para equipos (bomba, compresor, unidad externa de A/A, tanque)", diasAntes: 30,
      porQue: "La base de hormigón se dimensiona según la medida y el peso exacto del equipo.",
      consecuencia: "Base mal dimensionada; hay que romper y rehacer la fundación del equipo.",
      plazoReal: "15 a 30 días" },
  ] },
  { cod: "CAR", etapa: "Albañilería", nombre: "Carpetas", dias: 11, deps: [{ cod: "CPI", tipo: "FC", lag: 0 }], peso: 2, materiales: ["Arena, cemento", "Malla si corresponde"], defs: [
    { nombre: "Tipo y espesor de piso por ambiente (porcelanato, madera, alfombra, piedra)", diasAntes: 60,
      porQue: "El nivel de la carpeta se calcula según el espesor del piso definitivo, para que todos los ambientes queden a nivel entre sí.",
      consecuencia: "Escalón entre ambientes, o rotura de carpeta para volver a nivelar.",
      plazoReal: "30 a 60 días si es importado o de pedido especial" },
  ] },

  { cod: "RGR", etapa: "Terminaciones", nombre: "Revoque grueso", dias: 21, deps: [{ cod: "CPI", tipo: "CC", lag: 11 }], peso: 4.5, materiales: ["Cal, cemento, arena"], defs: [] },
  { cod: "CPT", etapa: "Terminaciones", nombre: "Colocación de carpinterías", dias: 14, deps: [{ cod: "RGR", tipo: "CC", lag: 18 }], peso: 6, materiales: ["CARPINTERÍAS FABRICADAS", "Herrajes y vidrios"], defs: [] },
  { cod: "RFI", etapa: "Terminaciones", nombre: "Revoque fino y yesería", dias: 18, deps: [{ cod: "RGR", tipo: "FC", lag: 4 }], peso: 3, materiales: ["Yeso, enduido"], defs: [
    { nombre: "Terminación de revoques (liso, símil piedra, textura)", diasAntes: 20,
      porQue: "Define la técnica y el espesor de aplicación, previo a la pintura.",
      consecuencia: "Atraso de pintura y de toda la terminación final.",
      plazoReal: "La decisión es rápida, pero bloquea toda la etapa si no está" },
  ] },
  { cod: "PIS", etapa: "Terminaciones", nombre: "Colocación de pisos", dias: 18, deps: [{ cod: "CAR", tipo: "FC", lag: 0 }, { cod: "RFI", tipo: "FC", lag: 0 }], peso: 6.5, materiales: ["PIEZAS DE PISO", "Adhesivo y pastina"], defs: [] },
  { cod: "REV", etapa: "Terminaciones", nombre: "Revestimientos de baños y cocina", dias: 14, deps: [{ cod: "PIS", tipo: "CC", lag: 7 }], peso: 3, materiales: ["REVESTIMIENTOS", "Adhesivo y pastina"], defs: [] },
  { cod: "PAR", etapa: "Terminaciones", nombre: "Parrilla y hogar (terminación)", dias: 9, deps: [{ cod: "PIS", tipo: "CC", lag: 18 }], peso: 1.5, materiales: ["Parrilla u hogar"], defs: [] },
  { cod: "MUE", etapa: "Terminaciones", nombre: "Muebles de cocina (colocación)", dias: 11, deps: [{ cod: "PIS", tipo: "FC", lag: 0 }], peso: 5, materiales: ["MUEBLES DE COCINA FABRICADOS", "Electrodomésticos empotrados"], defs: [] },
  { cod: "PLA", etapa: "Terminaciones", nombre: "Placards y carpintería interior", dias: 11, deps: [{ cod: "MUE", tipo: "CC", lag: 4 }], peso: 2.5, materiales: ["Placards fabricados"], defs: [] },
  { cod: "MES", etapa: "Terminaciones", nombre: "Mesadas y banquinas", dias: 9, deps: [{ cod: "MUE", tipo: "FC", lag: 0 }], peso: 2, materiales: ["MESADAS", "Bachas"], defs: [] },
  { cod: "PIN", etapa: "Terminaciones", nombre: "Pintura", dias: 18, deps: [{ cod: "MUE", tipo: "CC", lag: 14 }], peso: 3.5, materiales: ["Pintura, fondos, selladores"], defs: [] },
  { cod: "ART", etapa: "Terminaciones", nombre: "Artefactos, griferías y bachas", dias: 9, deps: [{ cod: "PIN", tipo: "CC", lag: 11 }], peso: 1.5, materiales: ["GRIFERÍAS Y ARTEFACTOS", "Bachas y accesorios"], defs: [] },
  { cod: "FIN", etapa: "Cierre", nombre: "Limpieza final y entrega", dias: 7, deps: [{ cod: "PIN", tipo: "FC", lag: 0 }, { cod: "ART", tipo: "FC", lag: 0 }], peso: 1, materiales: ["Material de limpieza"], defs: [] },
];

const ETAPAS = ["Preliminares", "Estructura", "Albañilería", "Instalaciones", "Terminaciones", "Cierre"];

/* ─── CONTRATOS DE PROVEEDORES ───
   Cuándo hay que CERRAR el contrato de cada proveedor para llegar a tiempo.
   diasAntes = plazo del proveedor (fabricación + entrega + margen), contado hacia atrás
   desde que ese rubro se necesita en obra (el inicio de la tarea ligada).
   Los plazos son un criterio de arranque; se editan por obra.                        */
const CONTRATOS_BASE = [
  { nombre: "Muebles de cocina y placares", cod: "MUE", diasAntes: 90, nota: "Fabricación a medida (60–75 d) + colocación. Depende de definir bajo mesada, alacenas, isla y electrodomésticos." },
  { nombre: "Mesadas y banquinas", cod: "MES", diasAntes: 45, nota: "Mármol/granito/silestone. Se toman medidas sobre los muebles ya colocados; cerrar antes para reservar material y plazo." },
  { nombre: "Carpinterías: puertas y ventanas", cod: "CPT", diasAntes: 75, nota: "Aberturas de fábrica a medida (aluminio/madera). Definir modelo y medida exacta." },
  { nombre: "Barandas y herrería", cod: "PIS", diasAntes: 45, nota: "Herrería de escaleras, balcones y barandas. Fabricación a medida + amure." },
  { nombre: "Aire acondicionado", cod: "AIR", diasAntes: 45, nota: "Equipos (según potencia y stock) + cañerías y pases antes de cerrar tabiques." },
  { nombre: "Calefacción / piso radiante", cod: "RAD", diasAntes: 45, nota: "Caldera, colectores y caños. Cerrar antes de contrapisos si es piso radiante." },
  { nombre: "Parrilla y hogar", cod: "PAR", diasAntes: 40, nota: "Kit/insertable a amurar. Definir tipo y medidas antes de la albañilería del sector." },
  { nombre: "Griferías y artefactos", cod: "ART", diasAntes: 30, nota: "Reservar modelos y colores; suelen tener demora de importación." },
];

// Calcula, para cada contrato de la obra, la fecha límite para cerrarlo y su urgencia.
function calcContratos(obra, tareas, aviso, hoy) {
  return (obra?.contratos || []).map(c => {
    const t = c.taskId ? tareas.find(x => x.id === c.taskId) : (c.cod ? tareas.find(x => x.cod === c.cod) : null);
    const necesita = t ? t.vvInicio : (c.fechaObra || "");     // cuándo se necesita en obra
    const limite = necesita ? isoMas(necesita, -numSimple(c.diasAntes)) : "";
    const faltan = limite ? diasEntre(hoy, limite) : null;
    let estado = "futura";
    if (c.cerrado) estado = "ok";
    else if (faltan !== null && faltan < 0) estado = "vencida";
    else if (faltan !== null && faltan <= aviso) estado = "urgente";
    return { ...c, tareaNombre: t ? t.nombre : "", necesita, limite, faltan, estado };
  }).sort((a, b) => (a.faltan ?? 99999) - (b.faltan ?? 99999));
}
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
    materiales: [...(t.materiales || [])],
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
  const hoy = hoyISO();

  // ── MODO MANUAL: las fechas las carga el usuario a mano, sin dependencias ni camino crítico ──
  if (obra?.modoManual) {
    const raw = obra?.tareas || [];
    // el calendario arranca en la fecha más temprana cargada (o el inicio de obra)
    const fechas = raw.map(t => t.desde).filter(Boolean);
    const base = fechas.length ? fechas.reduce((m, f) => f < m ? f : m, fechas[0]) : (obra.inicio || hoy);
    const tareas = raw.map(t => {
      const vvInicio = t.desde || obra.inicio || hoy;
      const vvFin = t.hasta && t.hasta >= vvInicio ? t.hasta : vvInicio;
      const offCal = diasEntre(base, vvInicio);
      const durCal = diasEntre(vvInicio, vvFin) + 1;
      const dias = durCal;
      const desvio = (t.bfFin && vvFin) ? diasEntre(t.bfFin, vvFin) : null;
      const defs = (t.defs || []).map(d => {
        const limite = isoMas(vvInicio, -numSimple(d.diasAntes));
        const faltan = limite ? diasEntre(hoy, limite) : null;
        let estado = "futura";
        if (d.ok) estado = "ok";
        else if (faltan !== null && faltan < 0) estado = "vencida";
        else if (faltan !== null && faltan <= aviso) estado = "urgente";
        return { ...d, limite, faltan, estado, tareaNombre: t.nombre, tareaInicio: vvInicio, tareaId: t.id, critica: false };
      });
      const trabas = defs.filter(d => !d.ok);
      const arrancaEn = diasEntre(hoy, vvInicio);
      const bloqueada = trabas.length > 0 && arrancaEn <= aviso;
      return { ...t, es: offCal, ef: offCal + durCal, critica: false, holgura: null, vvInicio, vvFin, dias, desvio, defs, trabas, bloqueada, arrancaEn, offCal, durCal };
    });
    const fin = tareas.reduce((m, t) => (!m || t.vvFin > m) ? t.vvFin : m, "");
    const ini = tareas.reduce((m, t) => (!m || t.vvInicio < m) ? t.vvInicio : m, "");
    const finDias = (fin && ini) ? diasEntre(ini, fin) + 1 : 0;
    const meses = finDias / 30.44;
    const excede = finDias > TOPE_DIAS;
    const pesoTotal = tareas.reduce((s, t) => s + numSimple(t.peso), 0);
    const avancePond = pesoTotal > 0 ? tareas.reduce((s, t) => s + numSimple(t.peso) * numSimple(t.avance), 0) / pesoTotal : 0;
    const defs = tareas.flatMap(t => t.defs);
    const pendientes = defs.filter(d => !d.ok);
    const vencidas = pendientes.filter(d => d.estado === "vencida");
    const urgentes = pendientes.filter(d => d.estado === "urgente");
    const fo = finanzas?.obras?.find(o => o.id === obra.finanzasObraId);
    const contrato = fo ? numSimple(fo.m2) * numSimple(fo.precioCliente) : 0;
    const costoTotal = fo ? numSimple(fo.m2) * numSimple(fo.costoM2) : 0;
    const conPlata = tareas.map(t => {
      const frac = pesoTotal > 0 ? numSimple(t.peso) / pesoTotal : 0;
      const valor = contrato * frac, costo = costoTotal * frac;
      return { ...t, valor, costo, ejecutado: valor * numSimple(t.avance) / 100 };
    });
    const ejecutado = conPlata.reduce((s, t) => s + t.ejecutado, 0);
    const certificado = conPlata.filter(t => t.certificado).reduce((s, t) => s + t.valor, 0);
    const pagado = conPlata.filter(t => t.pagado).reduce((s, t) => s + t.costo, 0);
    const costoEjec = conPlata.reduce((s, t) => s + t.costo * numSimple(t.avance) / 100, 0);
    const sinCertificar = ejecutado - certificado;
    const enCurso = conPlata.filter(t => t.vvInicio <= hoy && t.vvFin >= hoy);
    const bloqueadas = conPlata.filter(t => t.bloqueada);
    const contratos = calcContratos(obra, conPlata, aviso, hoy);
    return {
      tareas: conPlata, finDias, finHabiles: 0, fin, meses, excede,
      defs, pendientes, vencidas, urgentes, pesoTotal, avancePond,
      contrato, costoTotal, ejecutado, certificado, pagado, costoEjec, sinCertificar,
      ligada: !!fo, finanzasNombre: fo?.nombre || "",
      criticas: [], enCurso, bloqueadas, base, modoManual: true, contratos,
    };
  }

  const base = calcCPM(obra?.tareas || []);

  const tareas = base.map(t => {
    // el CPM da días HÁBILES; acá los paso a fechas reales, salteando sábados y domingos
    const vvInicio = habilDesde(obra.inicio, t.es);
    const vvFin = habilDesde(obra.inicio, t.ef - 1);   // el último día que se trabaja
    const desvio = (t.bfFin && vvFin) ? diasEntre(t.bfFin, vvFin) : null;
    // posición en el calendario, para dibujar el Gantt (los meses son corridos)
    const offCal = diasEntre(obra.inicio, vvInicio);
    const durCal = diasEntre(vvInicio, vvFin) + 1;

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

    return { ...t, vvInicio, vvFin, desvio, defs, trabas, bloqueada, arrancaEn, offCal, durCal };
  });

  // el plazo se mide en días de CALENDARIO (los 12 meses son corridos, no hábiles)
  const fin = tareas.reduce((m, t) => (!m || t.vvFin > m) ? t.vvFin : m, "");
  const finDias = fin ? diasEntre(obra.inicio, fin) + 1 : 0;
  const finHabiles = tareas.reduce((m, t) => Math.max(m, t.ef), 0);
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
  const contratos = calcContratos(obra, conPlata, aviso, hoy);

  return {
    tareas: conPlata, finDias, finHabiles, fin, meses, excede,
    defs, pendientes, vencidas, urgentes,
    pesoTotal, avancePond,
    contrato, costoTotal, ejecutado, certificado, pagado, costoEjec, sinCertificar,
    ligada: !!fo, finanzasNombre: fo?.nombre || "",
    criticas, enCurso, bloqueadas, contratos,
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
function Field({ label, children, hint }) {
  return (<div style={{ marginBottom: 13 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: T.sub, letterSpacing: ".02em" }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
  </div>);
}

function Btn({ children, onClick, tipo = "primario", chico, full, disabled }) {
  const e = {
    primario: { background: T.accent, color: "#fff", border: "none" },
    suave: { background: T.bg, color: T.accent, border: `1px solid ${T.border}` },
    peligro: { background: TONO.rojo().b, color: TONO.rojo().c, border: `1px solid ${TONO.rojo().bd}` },
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
/* Los tonos de aviso se adaptan al tema: en oscuro no pueden ser pasteles claros,
   quedarían como parches encandilantes. Se usan velados sobre el fondo. */
const TONO = {
  rojo: () => T.dark
    ? { c: "#F87171", b: "rgba(248,113,113,.13)", bd: "rgba(248,113,113,.32)" }
    : { c: "#DC2626", b: "#FEF2F2", bd: "#FECACA" },
  ambar: () => T.dark
    ? { c: "#F5B44C", b: "rgba(245,180,76,.13)", bd: "rgba(245,180,76,.32)" }
    : { c: "#B45309", b: "#FFFBEB", bd: "#FDE68A" },
  verde: () => T.dark
    ? { c: "#3DDC84", b: "rgba(61,220,132,.13)", bd: "rgba(61,220,132,.32)" }
    : { c: "#16A34A", b: "#ECFDF5", bd: "#A7F3D0" },
  gris: () => ({ c: T.sub, b: T.dark ? T.al : T.bg, bd: T.border }),
};

function semDe(est) {
  const [tono, label] = {
    vencida: ["rojo", "Vencida"], urgente: ["ambar", "Urgente"],
    futura: ["gris", "En plazo"], ok: ["verde", "Definida"],
  }[est] || ["gris", "En plazo"];
  const t = TONO[tono]();
  return { c: t.c, b: t.b, bd: t.bd, l: label };
}

/* ─── La firma: dos líneas de tiempo + el camino crítico marcado ─── */
function Gantt({ obra, plan, soloCriticas, guardarObra }) {
  const hoy = hoyISO();
  const [zoom, setZoom] = useState("dia");   // "dia" | "semana" | "mes"
  const [hitoFecha, setHitoFecha] = useState(null); // fecha ISO que estoy editando
  const [hitoTxt, setHitoTxt] = useState("");
  const [hitoCol, setHitoCol] = useState("#B91C1C");
  const manual = !!plan.modoManual;
  const lista = soloCriticas ? plan.tareas.filter(t => t.critica) : plan.tareas;
  const baseCal = plan.base || obra.inicio;

  // marcas de días clave (hormigonadas, hitos, etc.)
  const hitos = obra.hitos || [];
  const hitoDe = (f) => hitos.find(h => h.fecha === f);
  const COLORES_HITO = ["#B91C1C", "#B0894F", "#1B3A5B", "#16A34A", "#7C3AED"];
  const abrirHito = (f) => { const h = hitoDe(f); setHitoTxt(h?.texto || ""); setHitoCol(h?.color || "#B91C1C"); setHitoFecha(f); };
  const guardarHito = () => {
    const f = hitoFecha, txt = hitoTxt.trim();
    guardarObra(o => {
      const otros = (o.hitos || []).filter(h => h.fecha !== f);
      return { ...o, hitos: txt ? [...otros, { id: uid(), fecha: f, texto: txt, color: hitoCol }] : otros };
    });
    setHitoFecha(null);
  };
  const borrarHito = () => { const f = hitoFecha; guardarObra(o => ({ ...o, hitos: (o.hitos || []).filter(h => h.fecha !== f) })); setHitoFecha(null); };

  // La grilla: en automático son días hábiles (sin fines de semana);
  // en manual es el calendario real, desde la primera fecha cargada.
  const dias = useMemo(() => {
    const out = [];
    if (manual) {
      const n = Math.max(1, plan.finDias || 1);
      let f = baseCal;
      for (let i = 0; i < n && i < 3000; i++) { out.push(f); f = isoMas(f, 1); }
      return out;
    }
    const n = Math.max(1, plan.finHabiles || 1);
    let f = primerHabil(obra.inicio);
    for (let i = 0; i < n && i < 3000; i++) {
      out.push(f);
      let sig = isoMas(f, 1);
      let g = 0;
      while (!esHabil(sig) && g < 7) { sig = isoMas(sig, 1); g++; }
      f = sig;
    }
    return out;
  }, [obra.inicio, plan.finHabiles, plan.finDias, manual, baseCal]);

  const ANCHO = zoom === "dia" ? 26 : zoom === "semana" ? 11 : 4;
  const ancho = dias.length * ANCHO;

  // el día de hoy, en columnas
  const colHoy = dias.indexOf(hoy);

  // bandas de mes, para la cabecera
  const bandas = useMemo(() => {
    const b = [];
    dias.forEach((d, i) => {
      const m = d.slice(0, 7);
      const ult = b[b.length - 1];
      if (ult && ult.mes === m) ult.n++;
      else b.push({ mes: m, desde: i, n: 1 });
    });
    return b;
  }, [dias]);

  const nomMes = (m) => {
    const [a, mm] = m.split("-");
    return `${MESES[Number(mm) - 1]} ${a.slice(2)}`;
  };

  return (<div style={{ marginLeft: -16, marginRight: -16, background: T.card, boxShadow: SHDsm, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "12px 0 14px" }}>
    <style>{`
      .gnt-lbl{width:118px;flex:0 0 118px}
      @media(min-width:520px){.gnt-lbl{width:190px;flex:0 0 190px}}
      @media(min-width:820px){.gnt-lbl{width:250px;flex:0 0 250px}}
      .gnt-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
      .gnt-scroll::-webkit-scrollbar{height:7px}
      .gnt-scroll::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
    `}</style>

    {/* zoom */}
    <div style={{ display: "flex", gap: 4, padding: "0 12px 10px", alignItems: "center" }}>
      <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, marginRight: 3 }}>VER POR</span>
      {[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]].map(([k, l]) => (
        <button key={k} onClick={() => setZoom(k)} style={{
          background: zoom === k ? T.accent : T.al, color: zoom === k ? "#fff" : T.sub,
          border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 11px",
          fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>{l}</button>
      ))}
      <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.muted }}>{dias.length} días{manual ? "" : " hábiles"}</span>
    </div>

    <div style={{ display: "flex", padding: "0 12px" }}>
      {/* columna fija de nombres */}
      <div className="gnt-lbl" style={{ minWidth: 0 }}>
        {/* hueco de la cabecera */}
        <div style={{ height: 34 }} />
        {lista.map(t => (
          <div key={t.id} style={{ height: 26, display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            {t.bloqueada && <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.danger, flexShrink: 0 }} />}
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5, fontWeight: t.critica ? 800 : 600, color: t.critica ? T.critico : T.text }}>{t.nombre}</span>
            {!manual && <span style={{ flexShrink: 0, fontSize: 8.5, fontWeight: 800, color: t.critica ? T.critico : T.muted }}>{t.critica ? "CRÍT" : `+${t.holgura}d`}</span>}
          </div>
        ))}
      </div>

      {/* la línea de tiempo: se corre a lo largo */}
      <div className="gnt-scroll" style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
        <div style={{ width: ancho, minWidth: "100%", position: "relative" }}>

          {/* cabecera: los meses */}
          <div style={{ display: "flex", height: 15 }}>
            {bandas.map((b, i) => (
              <div key={i} style={{
                width: b.n * ANCHO, flexShrink: 0, borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
                fontSize: 9.5, fontWeight: 800, color: T.sub, textTransform: "uppercase",
                letterSpacing: ".04em", paddingLeft: 3, overflow: "hidden", whiteSpace: "nowrap",
              }}>{b.n * ANCHO > 34 ? nomMes(b.mes) : ""}</div>
            ))}
          </div>

          {/* cabecera: el número de día (tocá un día para marcarlo) */}
          <div style={{ display: "flex", height: 22, alignItems: "center" }}>
            {dias.map((d, i) => {
              const dd = Number(d.slice(8, 10));
              const esHoyD = d === hoy;
              const lunes = dowDe(d) === 1;
              const h = hitoDe(d);
              const mostrar = zoom === "dia" || (zoom === "semana" && lunes);
              return (<div key={i} onClick={() => abrirHito(d)} title="Tocá para poner una referencia en este día" style={{
                width: ANCHO, flexShrink: 0, textAlign: "center", cursor: "pointer",
                fontSize: zoom === "dia" ? 9.5 : 8.5,
                fontWeight: h || esHoyD ? 800 : 600,
                color: h ? "#fff" : esHoyD ? T.danger : lunes ? T.sub : T.muted,
                background: h ? h.color : "transparent", borderRadius: h ? 4 : 0,
                borderLeft: lunes && !h ? `1px solid ${T.border}` : "none", lineHeight: "16px",
              }}>{mostrar || h ? dd : ""}</div>);
            })}
          </div>

          {/* las filas */}
          <div style={{ position: "relative", paddingTop: 6 }}>
            {/* grilla: una línea cada lunes */}
            {dias.map((d, i) => dowDe(d) === 1 ? (
              <div key={i} style={{ position: "absolute", left: i * ANCHO, top: 0, bottom: 0, width: 1, background: T.border, opacity: .55 }} />
            ) : null)}
            {/* la línea de hoy */}
            {colHoy >= 0 && (
              <div style={{ position: "absolute", left: colHoy * ANCHO, top: 0, bottom: 0, width: 2, background: T.danger, zIndex: 3, opacity: .9 }} />
            )}
            {/* marcas de días clave: línea + punto (chincheta) bien visible */}
            {hitos.map(h => { const i = dias.indexOf(h.fecha); if (i < 0) return null; const cx = i * ANCHO + ANCHO / 2; return (
              <React.Fragment key={h.id}>
                <div onClick={() => abrirHito(h.fecha)} title={h.texto} style={{ position: "absolute", left: cx - 1, top: 4, bottom: 0, width: 2, background: h.color, zIndex: 4, opacity: .9, cursor: "pointer" }} />
                <div onClick={() => abrirHito(h.fecha)} title={h.texto} style={{ position: "absolute", left: cx - 6, top: -3, width: 12, height: 12, borderRadius: "50%", background: h.color, border: `2px solid ${T.card}`, boxShadow: "0 1px 3px rgba(0,0,0,.35)", zIndex: 6, cursor: "pointer" }} />
              </React.Fragment>
            ); })}

            {lista.map(t => {
              const col = t.critica ? T.critico : (COLOR_ETAPA[t.etapa] || T.accent);
              const off = manual ? (t.offCal || 0) : t.es;
              const dur = manual ? (t.durCal || 1) : t.dias;
              const izq = off * ANCHO;
              const anc = Math.max(3, dur * ANCHO);
              const avance = Math.max(0, Math.min(100, numSimple(t.avance)));
              // Belfast, si cargaste sus fechas: en manual por calendario, en auto por día hábil
              let bIzq = null, bAnc = null;
              if (t.bfInicio && t.bfFin) {
                let i0, n;
                if (manual) { i0 = diasEntre(baseCal, t.bfInicio); n = Math.max(1, diasEntre(t.bfInicio, t.bfFin) + 1); }
                else { i0 = habilesEntre(primerHabil(obra.inicio), primerHabil(t.bfInicio)); n = Math.max(1, habilesEntre(primerHabil(t.bfInicio), t.bfFin) + 1); }
                bIzq = i0 * ANCHO; bAnc = Math.max(3, n * ANCHO);
              }
              return (<div key={t.id} style={{ height: 26, position: "relative" }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: 11, height: 2, background: T.dark ? T.al : T.bg }} />
                <div style={{ position: "absolute", left: izq, width: anc, top: 5, height: 13, background: col, borderRadius: 3, opacity: .28, border: `1px solid ${col}` }} />
                {avance > 0 && <div style={{ position: "absolute", left: izq, width: anc * avance / 100, top: 5, height: 13, background: col, borderRadius: 3 }} />}
                {bIzq !== null && <div style={{ position: "absolute", left: bIzq, width: bAnc, top: 19, height: 5, border: `1.5px solid ${BRASS}`, borderRadius: 2, boxSizing: "border-box" }} />}
              </div>);
            })}
          </div>
        </div>
      </div>
    </div>

    <div style={{ display: "flex", gap: 12, margin: "10px 12px 0", flexWrap: "wrap", fontSize: 10, color: T.sub }}>
      {!manual && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 7, background: T.critico, borderRadius: 3 }} /> camino crítico</span>}
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 7, background: T.accent, borderRadius: 3 }} /> V+V</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 6, border: `1.5px solid ${BRASS}`, borderRadius: 3, boxSizing: "border-box" }} /> Belfast</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 2, height: 10, background: T.danger }} /> hoy</span>
      <span style={{ color: T.muted }}>· {manual ? "calendario real, con las fechas que cargaste" : "solo días hábiles, sin fines de semana"}</span>
    </div>

    {/* referencias de días clave */}
    <div style={{ margin: "10px 12px 0" }}>
      {hitos.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
        {hitos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(h => (
          <div key={h.id} onClick={() => abrirHito(h.fecha)} style={{ display: "flex", alignItems: "center", gap: 8, background: T.al, borderRadius: 8, padding: "7px 10px", cursor: "pointer", borderLeft: `3px solid ${h.color}` }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: h.color, flexShrink: 0, minWidth: 52 }}>{fmtCorta(h.fecha)}</span>
            <span style={{ fontSize: 12, color: T.text, flex: 1, minWidth: 0 }}>{h.texto}</span>
          </div>
        ))}
      </div>}
      <div style={{ fontSize: 10.5, color: T.muted, textAlign: "center" }}>Tocá un día de arriba para marcar una hormigonada, un hito o una referencia.</div>
    </div>

    {/* editor de referencia del día */}
    {hitoFecha && <div onClick={() => setHitoFecha(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,27,45,.5)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "18px 18px 0 0", padding: "18px 20px 26px", width: "100%", maxWidth: 620, boxShadow: "0 -6px 24px rgba(0,0,0,.15)" }}>
        <div style={{ width: 40, height: 4, background: T.border, borderRadius: 4, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Referencia del {fmtFecha(hitoFecha)}</div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 3, marginBottom: 13 }}>Marcá algo importante de ese día: una hormigonada, un hito, la entrega de un sector.</div>
        <input value={hitoTxt} onChange={e => setHitoTxt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") guardarHito(); }} autoFocus placeholder="Ej: Hormigonada de losa 1er piso" style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 13px", fontSize: 14, color: T.text, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8, margin: "13px 0" }}>
          {COLORES_HITO.map(c => (
            <button key={c} onClick={() => setHitoCol(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: hitoCol === c ? `3px solid ${T.text}` : `2px solid ${T.border}`, cursor: "pointer" }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {hitoDe(hitoFecha) && <button onClick={borrarHito} style={{ background: T.al, color: T.danger, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Borrar</button>}
          <button onClick={guardarHito} style={{ flex: 1, background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 10, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Guardar referencia</button>
        </div>
      </div>
    </div>}
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
  const s = semDe(d.estado);
  const [abierto, setAbierto] = useState(false);
  const [porQue, setPorQue] = useState(false);
  return (<div style={{ background: s.b, borderRadius: 11, padding: "11px 12px", marginTop: 8, border: `1px solid ${d.estado === "vencida" ? s.bd : T.border}` }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
      <button onClick={onToggle} style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, cursor: "pointer",
        border: `1.5px solid ${d.ok ? T.ok : T.border}`, background: d.ok ? T.ok : T.card,
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
      <Chip color={s.c} fondo={T.card}>{s.l}</Chip>
    </div>

    {(d.porQue || d.consecuencia) && !d.ok && (
      <div style={{ marginTop: 8 }}>
        <button onClick={() => setPorQue(!porQue)} style={{ background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          {porQue ? "▲ Ocultar" : "▼ Por qué no puede esperar"}
        </button>
        {porQue && <div style={{ background: T.card, borderRadius: 9, padding: 10, marginTop: 6 }}>
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

    {abierto && <div style={{ marginTop: 9, background: T.card, borderRadius: 9, padding: 10 }}>
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
function FilaTarea({ t, plan, onEditar, onBorrar, onAddDef, onDef, onAvisar, manual }) {
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
            {manual ? <span style={{ color: T.muted }}>· {t.etapa}</span> : (t.critica ? <span style={{ color: T.critico }}>· CRÍTICA</span> : <span style={{ color: T.muted }}>· holgura {t.holgura}d</span>)}
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
          {rojas > 0 && <Chip color={TONO.rojo().c} fondo={TONO.rojo().b}>{rojas} vencida{rojas > 1 ? "s" : ""}</Chip>}
          {ambar > 0 && <Chip color={TONO.ambar().c} fondo={TONO.ambar().b}>{ambar} urgente{ambar > 1 ? "s" : ""}</Chip>}
          {t.avance > 0 && <Chip color={TONO.verde().c} fondo={TONO.verde().b}>{t.avance}%</Chip>}
          <span style={{ fontSize: 11, color: T.muted }}>{ab ? "▲" : "▼"}</span>
        </div>
      </div>
    </div>

    {ab && <div style={{ padding: "0 13px 13px", borderTop: `1px solid ${T.border}` }}>
      <input defaultValue={t.nombre} onBlur={e => onEditar({ nombre: e.target.value })} style={inp} />
      {manual ? (<div style={{ display: "flex", gap: 7, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Desde</div>
          <input type="date" defaultValue={t.desde || ""} onBlur={e => onEditar({ desde: e.target.value })} style={inpSm} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Hasta</div>
          <input type="date" defaultValue={t.hasta || ""} onBlur={e => onEditar({ hasta: e.target.value })} style={inpSm} />
        </div>
      </div>) : (<div style={{ display: "flex", gap: 7, marginTop: 8 }}>
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
      </div>)}
      {manual && <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Peso (% contrato)</div>
          <input defaultValue={t.peso} onBlur={e => onEditar({ peso: numSimple(e.target.value) })} inputMode="decimal" style={inpSm} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Avance %</div>
          <input defaultValue={t.avance} onBlur={e => onEditar({ avance: Math.max(0, Math.min(100, numSimple(e.target.value))) })} inputMode="numeric" style={inpSm} />
        </div>
      </div>}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10.5, color: T.sub, marginBottom: 3 }}>Etapa</div>
        <select defaultValue={t.etapa} onChange={e => onEditar({ etapa: e.target.value })} style={inpSm}>
          {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* dependencias: de acá sale el camino crítico (solo en modo automático) */}
      {!manual && <>
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
      </>}

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

/* ─── AGENDA: el calendario día por día, de lunes a viernes ───
   Contesta la pregunta concreta: "¿qué pasa el día 24?" — qué arranca, qué material
   tiene que estar en obra, qué definición vence y qué se está ejecutando.          */
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function Agenda({ obra, plan }) {
  const hoy = hoyISO();
  const mesDe = (iso) => (iso || hoy).slice(0, 7);
  // arranco en el mes de hoy si la obra está en curso; si no, en el mes de inicio
  const mesIni = mesDe(obra.inicio);
  const mesFin = mesDe(plan.fin || obra.inicio);
  const mesHoy = mesDe(hoy);
  const arranque = (mesHoy >= mesIni && mesHoy <= mesFin) ? mesHoy : mesIni;
  const [mes, setMes] = useState(arranque);
  const [diaAbierto, setDiaAbierto] = useState(null);

  /* qué pasa cada día */
  const eventosDe = (d) => {
    const arrancan = plan.tareas.filter(t => t.vvInicio === d);
    const terminan = plan.tareas.filter(t => t.vvFin === d && t.vvInicio !== d);
    const enCurso = plan.tareas.filter(t => t.vvInicio < d && t.vvFin > d);
    const defs = plan.defs.filter(x => x.limite === d && !x.ok);
    const materiales = arrancan.flatMap(t => (t.materiales || []).map(m => ({ mat: m, tarea: t.nombre, critica: t.critica })));
    return { arrancan, terminan, enCurso, defs, materiales, hayAlgo: arrancan.length || terminan.length || defs.length || materiales.length };
  };

  /* armo la grilla del mes: filas = semanas, columnas = lunes a viernes */
  const [anio, mm] = mes.split("-").map(Number);
  const primero = `${anio}-${String(mm).padStart(2, "0")}-01`;
  const diasEnMes = new Date(anio, mm, 0).getDate();
  const semanas = [];
  let semana = [null, null, null, null, null];
  for (let dd = 1; dd <= diasEnMes; dd++) {
    const iso = `${anio}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const dw = dowDe(iso);
    if (dw === 0 || dw === 6) continue;          // sábado y domingo no se trabaja
    const col = dw - 1;                            // lunes = 0 … viernes = 4
    if (semana[col] !== null) { semanas.push(semana); semana = [null, null, null, null, null]; }
    semana[col] = iso;
    if (col === 4) { semanas.push(semana); semana = [null, null, null, null, null]; }
  }
  if (semana.some(x => x !== null)) semanas.push(semana);

  /* navegación entre meses */
  const mover = (n) => {
    const d = new Date(anio, mm - 1 + n, 1);
    const nuevo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (nuevo >= mesIni && nuevo <= mesFin) { setMes(nuevo); setDiaAbierto(null); }
  };
  const hayAntes = mes > mesIni, hayDespues = mes < mesFin;

  /* los días del mes que tienen algo, para el listado de abajo */
  const diasConAlgo = [];
  for (let dd = 1; dd <= diasEnMes; dd++) {
    const iso = `${anio}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    if (!esHabil(iso)) continue;
    const ev = eventosDe(iso);
    if (ev.hayAlgo) diasConAlgo.push({ iso, dd, ev });
  }

  const btnMes = (act, on) => ({
    background: act ? T.al : "transparent", border: `1px solid ${act ? T.border : "transparent"}`,
    color: act ? T.accent : T.muted, borderRadius: 9, width: 34, height: 34,
    fontSize: 16, fontWeight: 700, cursor: act ? "pointer" : "default", fontFamily: "inherit",
  });

  return (<div>
    <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.55, marginBottom: 12 }}>
      Se trabaja de lunes a viernes. Tocá un día para ver qué arranca, qué material tiene que estar
      en obra y qué definición vence.
    </div>

    {/* el mes */}
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <button onClick={() => mover(-1)} disabled={!hayAntes} style={{ ...btnMes(hayAntes) }}>‹</button>
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, textTransform: "capitalize" }}>{MESES_LARGO[mm - 1]} {anio}</div>
        <div style={{ fontSize: 10.5, color: T.muted }}>{diasConAlgo.length} días con movimiento</div>
      </div>
      <button onClick={() => mover(1)} disabled={!hayDespues} style={{ ...btnMes(hayDespues) }}>›</button>
      {mesHoy >= mesIni && mesHoy <= mesFin && mes !== mesHoy && (
        <button onClick={() => { setMes(mesHoy); setDiaAbierto(null); }} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 9, padding: "8px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Hoy</button>
      )}
    </div>

    {/* la grilla, lunes a viernes */}
    <div style={{ background: T.card, borderRadius: 14, padding: 12, boxShadow: SHDsm }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5, marginBottom: 5 }}>
        {["LUN", "MAR", "MIÉ", "JUE", "VIE"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: ".05em" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
        {semanas.flat().map((iso, i) => {
          if (!iso) return <div key={i} />;
          const dd = Number(iso.slice(8, 10));
          const ev = eventosDe(iso);
          const esHoy = iso === hoy;
          const sel = diaAbierto === iso;
          const dentro = iso >= obra.inicio && iso <= plan.fin;
          const hayDef = ev.defs.length > 0;
          const vencida = ev.defs.some(d => d.estado === "vencida" || d.faltan <= 0);

          // los colores de las etapas que están activas ese día
          const etapasHoy = [...new Set([...ev.arrancan, ...ev.enCurso, ...ev.terminan].map(t => t.etapa))];

          return (<button key={i} onClick={() => setDiaAbierto(sel ? null : iso)} style={{
            position: "relative", minHeight: 52, borderRadius: 9, padding: "4px 3px 3px", cursor: "pointer",
            background: sel ? T.accent : esHoy ? TONO.rojo().b : dentro ? (T.dark ? T.al : T.bg) : "transparent",
            border: `1px solid ${sel ? T.accent : esHoy ? TONO.rojo().bd : "transparent"}`,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 12.5, fontWeight: esHoy || sel ? 800 : 600, color: sel ? "#fff" : esHoy ? TONO.rojo().c : dentro ? T.text : T.muted }}>{dd}</span>

            {/* puntitos: una por etapa activa */}
            <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
              {etapasHoy.slice(0, 4).map(et => (
                <span key={et} style={{ width: 5, height: 5, borderRadius: "50%", background: sel ? "#fff" : COLOR_ETAPA[et] }} />
              ))}
            </div>

            {/* banderita: arranca una tarea */}
            {ev.arrancan.length > 0 && (
              <span style={{ fontSize: 8, fontWeight: 800, color: sel ? "#fff" : T.accent, lineHeight: 1 }}>▶{ev.arrancan.length > 1 ? ev.arrancan.length : ""}</span>
            )}
            {/* aviso: vence una definición */}
            {hayDef && (
              <span style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: "50%", background: vencida ? TONO.rojo().c : TONO.ambar().c }} />
            )}
          </button>);
        })}
      </div>

      <div style={{ display: "flex", gap: 11, marginTop: 10, flexWrap: "wrap", fontSize: 9.5, color: T.sub }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 9, color: T.accent, fontWeight: 800 }}>▶</span> arranca una tarea</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: TONO.ambar().c }} /> vence una definición</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent }} /> etapa en curso</span>
      </div>
    </div>

    {/* el día que tocaste */}
    {diaAbierto && <DiaDetalle iso={diaAbierto} ev={eventosDe(diaAbierto)} />}

    {/* todo el mes, día por día */}
    <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".06em", margin: "18px 0 4px" }}>
      El mes, día por día
    </div>
    {diasConAlgo.length === 0 && (
      <div style={{ background: T.card, borderRadius: 12, padding: 16, textAlign: "center", boxShadow: SHDsm }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Este mes no arranca ni vence nada</div>
        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4 }}>Las tareas en curso siguen su ritmo.</div>
      </div>
    )}
    {diasConAlgo.map(({ iso, dd, ev }) => <DiaDetalle key={iso} iso={iso} ev={ev} compacto />)}
  </div>);
}

/* el detalle de un día */
function DiaDetalle({ iso, ev, compacto }) {
  const dw = dowDe(iso);
  const dd = Number(iso.slice(8, 10));
  const esHoy = iso === hoyISO();
  return (<div style={{
    background: T.card, borderRadius: 12, padding: 13, marginTop: 9, boxShadow: SHDsm,
    borderLeft: `4px solid ${ev.defs.length ? TONO.ambar().c : ev.arrancan.length ? T.accent : T.border}`,
  }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 7 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: esHoy ? TONO.rojo().c : T.text }}>{dd}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: T.sub, textTransform: "capitalize" }}>{DOW[dw]}</span>
      {esHoy && <Chip color={TONO.rojo().c} fondo={TONO.rojo().b}>HOY</Chip>}
    </div>

    {/* lo más importante: qué tiene que estar en obra */}
    {ev.materiales.length > 0 && (
      <div style={{ background: TONO.ambar().b, border: `1px solid ${TONO.ambar().bd}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: TONO.ambar().c, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>
          Tiene que estar en obra
        </div>
        {ev.materiales.map((m, i) => (
          <div key={i} style={{ fontSize: 12.5, fontWeight: 700, color: T.text, marginTop: 3 }}>
            · {m.mat}
            <span style={{ fontSize: 10.5, fontWeight: 500, color: T.muted }}> — para {m.tarea}</span>
          </div>
        ))}
      </div>
    )}

    {ev.arrancan.map(t => (
      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 0" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.accent, flexShrink: 0 }}>▶ ARRANCA</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</span>
        {t.critica && <Chip color={TONO.rojo().c} fondo={TONO.rojo().b}>CRÍTICA</Chip>}
      </div>
    ))}

    {ev.terminan.map(t => (
      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 0" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: TONO.verde().c, flexShrink: 0 }}>■ TERMINA</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</span>
      </div>
    ))}

    {ev.defs.map(d => (
      <div key={d.id} style={{ background: TONO.rojo().b, border: `1px solid ${TONO.rojo().bd}`, borderRadius: 10, padding: 9, marginTop: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: TONO.rojo().c, textTransform: "uppercase", letterSpacing: ".05em" }}>Vence la definición</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 3 }}>{d.nombre}</div>
        <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>Traba {d.tareaNombre}</div>
      </div>
    ))}

    {!compacto && ev.enCurso.length > 0 && (
      <div style={{ marginTop: 7, paddingTop: 7, borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>En curso</div>
        {ev.enCurso.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: COLOR_ETAPA[t.etapa] || T.accent, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</span>
          </div>
        ))}
      </div>
    )}
  </div>);
}

/* ─── Reparto: cuánto pesa cada rubro ───
   Torta por etapa + barras por tarea. Si la obra está enganchada a Finanzas,
   además de los % muestra la plata que le toca a cada uno. */
function Torta({ partes, total, centroArriba, centroAbajo }) {
  const R = 54, GROSOR = 22;
  const C = 2 * Math.PI * R;
  let acum = 0;
  return (<svg viewBox="0 0 140 140" style={{ width: 150, height: 150, flexShrink: 0 }}>
    <circle cx="70" cy="70" r={R} fill="none" stroke={T.dark ? T.al : T.bg} strokeWidth={GROSOR} />
    {partes.map((p, i) => {
      const pct = total > 0 ? p.valor / total * 100 : 0;
      const largo = pct / 100 * C;
      const off = -(acum / 100 * C);
      acum += pct;
      if (pct <= 0) return null;
      return (<circle key={i} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth={GROSOR}
        strokeDasharray={`${largo} ${C - largo}`} strokeDashoffset={off}
        transform="rotate(-90 70 70)" />);
    })}
    <text x="70" y="66" textAnchor="middle" style={{ fontSize: 15, fontWeight: 800, fill: T.text }}>{centroArriba}</text>
    <text x="70" y="80" textAnchor="middle" style={{ fontSize: 8, fontWeight: 700, fill: T.muted, letterSpacing: ".05em" }}>{centroAbajo}</text>
  </svg>);
}

/* ─── CONTRATOS DE PROVEEDORES: cuándo cerrar cada uno ─── */
function PanelContratos({ plan, obra, guardarObra }) {
  const contratos = plan.contratos || [];
  const cargarSugeridos = () => guardarObra(o => {
    const existentes = new Set((o.contratos || []).map(c => (c.nombre || "").toLowerCase()));
    const nuevos = CONTRATOS_BASE
      .filter(b => !existentes.has(b.nombre.toLowerCase()))
      .map(b => ({ id: uid(), nombre: b.nombre, cod: b.cod, taskId: (o.tareas || []).find(t => t.cod === b.cod)?.id || "", diasAntes: b.diasAntes, nota: b.nota, cerrado: false, fechaCerrado: "" }));
    return { ...o, contratos: [...(o.contratos || []), ...nuevos] };
  });
  const editar = (id, campos) => guardarObra(o => ({ ...o, contratos: (o.contratos || []).map(c => c.id === id ? { ...c, ...campos } : c) }));
  const borrar = (id) => { if (confirm("¿Sacar este contrato?")) guardarObra(o => ({ ...o, contratos: (o.contratos || []).filter(c => c.id !== id) })); };
  const agregar = () => guardarObra(o => ({ ...o, contratos: [...(o.contratos || []), { id: uid(), nombre: "Nuevo proveedor", cod: "", taskId: (o.tareas || [])[0]?.id || "", diasAntes: 45, nota: "", cerrado: false, fechaCerrado: "" }] }));
  const tono = (est) => est === "vencida" ? TONO.rojo() : est === "urgente" ? TONO.ambar() : est === "ok" ? TONO.verde() : { c: T.muted, b: T.bg, bd: T.border };
  const pend = contratos.filter(c => !c.cerrado);
  const criticos = pend.filter(c => c.estado === "vencida" || c.estado === "urgente");

  return (<div>
    <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55, marginBottom: 12 }}>
      Cuándo hay que <b>cerrar el contrato</b> de cada proveedor para llegar a tiempo. Se calcula hacia atrás desde que ese rubro se necesita en obra, contando la fabricación y la entrega.
    </div>

    {contratos.length === 0 && (
      <div style={{ background: T.card, borderRadius: 12, padding: 18, textAlign: "center", boxShadow: SHDsm }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Todavía no cargaste contratos</div>
        <div style={{ fontSize: 12, color: T.sub, marginTop: 4, lineHeight: 1.5 }}>Cargá los sugeridos (muebles, mesadas, carpinterías, barandas, aire, calefacción, parrilla, griferías) y ajustá los plazos.</div>
        <div style={{ marginTop: 12 }}><Btn onClick={cargarSugeridos}>Cargar contratos sugeridos</Btn></div>
      </div>
    )}

    {criticos.length > 0 && (
      <div style={{ background: TONO.rojo().b, border: `1px solid ${TONO.rojo().bd}`, borderRadius: 11, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.critico, textTransform: "uppercase", letterSpacing: ".05em" }}>Cerrar YA</div>
        <div style={{ fontSize: 12, color: T.text, marginTop: 4, lineHeight: 1.5 }}>{criticos.map(c => c.nombre).join(" · ")} {criticos.length === 1 ? "necesita" : "necesitan"} que cierres el contrato ahora para no atrasar la obra.</div>
      </div>
    )}

    {contratos.map(c => {
      const to = tono(c.estado);
      const otras = plan.tareas;
      return (<div key={c.id} style={{ background: T.card, borderRadius: 12, marginBottom: 9, boxShadow: SHDsm, borderLeft: `4px solid ${to.c}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 13px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{c.nombre}</div>
              {c.cerrado
                ? <div style={{ fontSize: 11.5, color: T.ok, fontWeight: 700, marginTop: 2 }}>✓ Contrato cerrado{c.fechaCerrado ? ` · ${fmtCorta(c.fechaCerrado)}` : ""}</div>
                : c.limite
                  ? <div style={{ fontSize: 11.5, marginTop: 2, color: to.c, fontWeight: 700 }}>
                      Cerrar antes del {fmtFecha(c.limite)}
                      {c.faltan !== null && <span> · {c.faltan < 0 ? `${Math.abs(c.faltan)} días tarde` : c.faltan === 0 ? "es hoy" : `faltan ${c.faltan} días`}</span>}
                    </div>
                  : <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Ligá una tarea para calcular la fecha</div>}
              {c.tareaNombre && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Se necesita en obra: {fmtCorta(c.necesita)} · {c.tareaNombre}</div>}
            </div>
            <button onClick={() => editar(c.id, { cerrado: !c.cerrado, fechaCerrado: !c.cerrado ? hoyISO() : "" })} style={{ flexShrink: 0, background: c.cerrado ? T.ok : "transparent", color: c.cerrado ? "#fff" : T.sub, border: `1.5px solid ${c.cerrado ? T.ok : T.border}`, borderRadius: 8, padding: "7px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{c.cerrado ? "✓ Cerrado" : "Cerrar"}</button>
          </div>

          {c.nota && <div style={{ fontSize: 11, color: T.muted, marginTop: 7, lineHeight: 1.45, fontStyle: "italic" }}>{c.nota}</div>}

          <div style={{ display: "flex", gap: 7, marginTop: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 46%" }}>
              <div style={{ fontSize: 10, color: T.sub, marginBottom: 3 }}>Se necesita para</div>
              <select value={c.taskId || ""} onChange={e => editar(c.id, { taskId: e.target.value })} style={{ ...inpSm, width: "100%" }}>
                <option value="">(elegir tarea)</option>
                {otras.map(t => <option key={t.id} value={t.id}>{t.cod} · {t.nombre.slice(0, 24)}</option>)}
              </select>
            </div>
            <div style={{ width: 92 }}>
              <div style={{ fontSize: 10, color: T.sub, marginBottom: 3 }}>Días antes</div>
              <input defaultValue={c.diasAntes} onBlur={e => editar(c.id, { diasAntes: Math.max(0, numSimple(e.target.value)) })} inputMode="numeric" style={{ ...inpSm, width: "100%", textAlign: "right" }} />
            </div>
            <button onClick={() => borrar(c.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 15, cursor: "pointer", padding: "8px 4px" }}>×</button>
          </div>
        </div>
      </div>);
    })}

    {contratos.length > 0 && <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      <Btn chico tipo="suave" onClick={agregar}>+ Otro contrato</Btn>
      <Btn chico tipo="suave" onClick={cargarSugeridos}>Cargar sugeridos que falten</Btn>
    </div>}
  </div>);
}

function PanelReparto({ plan, obra }) {
  const totalPeso = plan.pesoTotal;
  const ligada = plan.ligada;

  // agrupo por etapa
  const porEtapa = ETAPAS.map(et => {
    const ts = plan.tareas.filter(t => t.etapa === et);
    const peso = ts.reduce((s, t) => s + numSimple(t.peso), 0);
    const plata = ts.reduce((s, t) => s + t.valor, 0);
    const costo = ts.reduce((s, t) => s + t.costo, 0);
    return { etapa: et, color: COLOR_ETAPA[et], peso, plata, costo, tareas: ts.length };
  }).filter(e => e.peso > 0);

  // tareas ordenadas de mayor a menor
  const ranking = [...plan.tareas].filter(t => numSimple(t.peso) > 0)
    .sort((a, b) => numSimple(b.peso) - numSimple(a.peso));
  const maxPeso = ranking.length ? numSimple(ranking[0].peso) : 1;

  const pctDe = (p) => totalPeso > 0 ? numSimple(p) / totalPeso * 100 : 0;

  if (!plan.tareas.length) return (
    <div style={{ background: T.card, borderRadius: 12, padding: 18, textAlign: "center", boxShadow: SHDsm }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Esta obra no tiene tareas</div>
    </div>
  );

  return (<div>
    <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.55, marginBottom: 12 }}>
      Cuánto pesa cada rubro sobre el total de la obra. Los porcentajes los editás tarea por tarea en “Editar”.
      {!ligada && " Enganchá la obra con Finanzas en “Plata” y también vas a ver cuánta plata es cada uno."}
    </div>

    {/* la torta, por etapa */}
    <div style={{ background: T.card, borderRadius: 14, padding: 16, boxShadow: SHDsm }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Por etapa</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Torta partes={porEtapa.map(e => ({ valor: e.peso, color: e.color }))} total={totalPeso}
          centroArriba={ligada ? money(plan.contrato).replace("$", "$ ") : `${totalPeso.toFixed(0)}%`}
          centroAbajo={ligada ? "CONTRATO" : "TOTAL"} />
        <div style={{ flex: 1, minWidth: 190 }}>
          {porEtapa.map(e => (
            <div key={e.etapa} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: e.color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.etapa}</span>
              <span style={{ fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{pctDe(e.peso).toFixed(1)}%</span>
              {ligada && <span style={{ fontSize: 11, color: T.sub, flexShrink: 0, minWidth: 82, textAlign: "right" }}>{money(e.plata)}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* el ranking, tarea por tarea */}
    <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".06em", margin: "18px 0 4px" }}>
      Tarea por tarea, de mayor a menor
    </div>
    <div style={{ background: T.card, borderRadius: 14, padding: "14px 16px", boxShadow: SHDsm }}>
      {ranking.map(t => {
        const pct = pctDe(t.peso);
        const col = COLOR_ETAPA[t.etapa] || T.accent;
        return (<div key={t.id} style={{ marginBottom: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</span>
            {ligada && <span style={{ fontSize: 11, color: T.sub, flexShrink: 0 }}>{money(t.valor)}</span>}
            <span style={{ fontSize: 12.5, fontWeight: 800, flexShrink: 0, minWidth: 42, textAlign: "right", color: col }}>{pct.toFixed(1)}%</span>
          </div>
          <div style={{ height: 9, background: T.dark ? T.al : T.bg, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${maxPeso > 0 ? numSimple(t.peso) / maxPeso * 100 : 0}%`, height: "100%", background: col, borderRadius: 3 }} />
          </div>
        </div>);
      })}
    </div>

    {/* control: que los pesos cierren en 100 */}
    <div style={{
      background: Math.abs(totalPeso - 100) > 0.5 ? TONO.ambar().b : TONO.verde().b,
      border: `1px solid ${Math.abs(totalPeso - 100) > 0.5 ? TONO.ambar().bd : TONO.verde().bd}`,
      borderRadius: 12, padding: 13, marginTop: 12,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: Math.abs(totalPeso - 100) > 0.5 ? TONO.ambar().c : TONO.verde().c }}>
        Los pesos suman {totalPeso.toFixed(1)}%
      </div>
      <div style={{ fontSize: 11.5, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>
        {Math.abs(totalPeso - 100) > 0.5
          ? "Conviene que sumen 100% para que los porcentajes y la plata cierren. Ajustalos en “Editar”."
          : "Perfecto: los porcentajes cierran."}
      </div>
    </div>

    {ligada && (
      <div style={{ background: T.card, borderRadius: 14, padding: 16, boxShadow: SHDsm, marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Lo que deja cada etapa</div>
        {porEtapa.map(e => {
          const margen = e.plata - e.costo;
          const pctM = e.plata > 0 ? margen / e.plata * 100 : 0;
          return (<div key={e.etapa} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: e.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.etapa}</span>
            <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>cuesta {money(e.costo)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 800, flexShrink: 0, minWidth: 90, textAlign: "right", color: margen >= 0 ? TONO.verde().c : TONO.rojo().c }}>
              {money(margen)}
            </span>
            <span style={{ fontSize: 10.5, color: T.muted, flexShrink: 0, minWidth: 40, textAlign: "right" }}>{pctM.toFixed(0)}%</span>
          </div>);
        })}
      </div>
    )}
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
          {t.avance >= 100 && <Chip color={TONO.verde().c} fondo={TONO.verde().b}>terminada</Chip>}
        </div>
        <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
          <button onClick={() => onEditar(t.id, { certificado: !t.certificado })} style={{
            flex: 1, padding: "8px 6px", borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${t.certificado ? T.ok : T.border}`,
            background: t.certificado ? TONO.verde().b : T.card, color: t.certificado ? TONO.verde().c : T.sub,
          }}>{t.certificado ? "✓ Certificada" : "Certificar"}</button>
          <button onClick={() => onEditar(t.id, { pagado: !t.pagado })} style={{
            flex: 1, padding: "8px 6px", borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${t.pagado ? T.ok : T.border}`,
            background: t.pagado ? TONO.verde().b : T.card, color: t.pagado ? TONO.verde().c : T.sub,
          }}>{t.pagado ? "✓ Pagada" : "Marcar pagada"}</button>
        </div>
        {t.avance >= 100 && !t.certificado && (
          <div style={{ fontSize: 11, color: TONO.ambar().c, marginTop: 7, fontWeight: 700 }}>
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
          <Chip color={lista ? TONO.verde().c : TONO.rojo().c} fondo={lista ? TONO.verde().b : TONO.rojo().b}>
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
      desde: o.modoManual ? (o.inicio || hoyISO()) : "", hasta: "",
    }],
  }));
  const cambiarModo = (manual) => {
    if (manual && !obra.modoManual) {
      // al pasar a manual, sembramos fechas desde/hasta usando lo que el CPM ya calculó, para no perder nada
      guardarObra(o => ({ ...o, modoManual: true, tareas: (o.tareas || []).map(t => {
        const p = (plan.tareas || []).find(x => x.id === t.id);
        return { ...t, desde: t.desde || p?.vvInicio || o.inicio || hoyISO(), hasta: t.hasta || p?.vvFin || "" };
      }) }));
    } else if (!manual && obra.modoManual) {
      guardarObra(o => ({ ...o, modoManual: false }));
    }
  };
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
    ["agenda", "Agenda"],
    ["viene", `Qué viene${plan.bloqueadas.length ? ` (${plan.bloqueadas.length})` : ""}`],
    ["defs", `Definiciones${plan.pendientes.length ? ` (${plan.pendientes.length})` : ""}`],
    ["contratos", (() => { const p = (plan.contratos || []).filter(c => !c.cerrado && (c.estado === "vencida" || c.estado === "urgente")).length; return `Contratos${p ? ` (${p})` : ""}`; })()],
    ["reparto", "Reparto"],
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
      <div style={{ display: "flex", gap: 6, marginBottom: 10, background: T.bg, borderRadius: 10, padding: 4, border: `1px solid ${T.border}` }}>
        {[[false, "Automático", "encadena por dependencias"], [true, "Manual", "cargás fecha a mano"]].map(([m, l, sub]) => (
          <button key={l} onClick={() => cambiarModo(m)} style={{ flex: 1, background: !!obra.modoManual === m ? T.navy : "transparent", color: !!obra.modoManual === m ? "#fff" : T.sub, border: "none", borderRadius: 8, padding: "9px 6px", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{l}</div>
            <div style={{ fontSize: 9, opacity: .8, marginTop: 1 }}>{sub}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span style={{ fontSize: 12, color: T.sub, flex: 1 }}>Inicio de obra</span>
        <input type="date" defaultValue={obra.inicio} onBlur={e => guardarObra(o => ({ ...o, inicio: e.target.value }))} style={{ ...inpSm, width: 150 }} />
      </div>
      {obra.modoManual
        ? <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 11, padding: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.55 }}>Modo manual: en cada tarea cargás la fecha <b>Desde</b> y <b>Hasta</b>. No hay dependencias ni camino crítico — el Gantt se dibuja con las fechas que pongas.</div>
          </div>
        : <div style={{ background: TONO.rojo().b, border: `1px solid ${TONO.rojo().bd}`, borderRadius: 11, padding: 12, marginBottom: 10 }}>
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
      </div>}
      <Gantt obra={obra} plan={plan} soloCriticas={obra.modoManual ? false : soloCrit} guardarObra={guardarObra} />
    </>}

    {vista === "agenda" && <Agenda obra={obra} plan={plan} />}

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
        const s = semDe(est);
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

    {vista === "contratos" && <PanelContratos plan={plan} obra={obra} guardarObra={guardarObra} />}

    {vista === "reparto" && <PanelReparto plan={plan} obra={obra} />}

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
            <FilaTarea key={t.id} t={t} plan={plan} manual={!!obra.modoManual}
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


/* ═══════════════════ PERSONALIZACIÓN (el mismo panel de toda la suite) ═══════════════════ */
function ConfigModal({ data, save, onClose }) {
  const cfg = data.config || {};
  const [subiendo, setSubiendo] = useState(false);
  const [subiendoFondo, setSubiendoFondo] = useState(false);
  const setCfg = (k, v) => save({ ...data, config: { ...(data.config || {}), [k]: v } });

  async function subirLogo(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setSubiendo(true);
    const url = await subirArchivo(f);
    if (url) setCfg("logo", url); else alert("No se pudo subir. Revisá la conexión.");
    setSubiendo(false); e.target.value = "";
  }
  async function subirFondo(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setSubiendoFondo(true);
    const url = await subirArchivo(f);
    if (url) save({ ...data, config: { ...(data.config || {}), fondoUrl: url, fondo: "" } });
    else alert("No se pudo subir. Revisá la conexión.");
    setSubiendoFondo(false); e.target.value = "";
  }

  return (<div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(11,22,34,.55)", zIndex: 450, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: T.card, color: T.text, borderRadius: "18px 18px 0 0", padding: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 3, letterSpacing: "-.01em" }}>Personalización</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>Cambiá el aspecto de la app y los datos que aparecen arriba.</div>

      <Field label="Logo de la empresa">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <div style={{ width: 60, height: 60, borderRadius: 13, background: cfg.logo ? "#fff" : `linear-gradient(145deg, ${BRASS}, #c9a869)`, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {cfg.logo ? <img src={cfg.logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 15, fontWeight: 800, color: "#0B1622" }}>V+V</span>}
          </div>
          <label style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {subiendo ? "Subiendo…" : cfg.logo ? "Cambiar logo" : "Subir logo"}
            <input type="file" accept="image/*" onChange={subirLogo} style={{ display: "none" }} />
          </label>
          {cfg.logo && <button onClick={() => setCfg("logo", "")} style={{ background: "none", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 9, padding: "10px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Quitar</button>}
        </div>
      </Field>

      <Field label="Nombre de la empresa">
        <input defaultValue={cfg.nombre ?? ""} onBlur={e => setCfg("nombre", e.target.value)} placeholder="V+V Construcciones" style={inp} />
      </Field>
      <Field label="Subtítulo">
        <input defaultValue={cfg.subtitulo ?? ""} onBlur={e => setCfg("subtitulo", e.target.value)} placeholder="Cronogramas de obra" style={inp} />
      </Field>

      <Field label="Modo de color">
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {[["claro", "☀︎ Claro"], ["oscuro", "🌙 Oscuro"]].map(([k, l]) => (
            <button key={k} onClick={() => setCfg("modo", k)} style={{
              flex: 1, background: (cfg.modo || "claro") === k ? T.accent : T.al,
              color: (cfg.modo || "claro") === k ? "#fff" : T.sub,
              border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px",
              fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>{l}</button>
          ))}
        </div>
      </Field>

      <Field label="Tipografía">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 6 }}>
          {FUENTES.map(([k, l, fam]) => (
            <button key={k} onClick={() => setCfg("fuente", k)} style={{
              background: (cfg.fuente || "") === k ? T.accent : T.al,
              color: (cfg.fuente || "") === k ? "#fff" : T.text,
              border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 13px",
              fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: fam,
            }}>{l}</button>
          ))}
        </div>
      </Field>

      <Field label="Fondo de pantalla">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {(cfg.modo === "oscuro" ? FONDOS_DARK : FONDOS).map(([k, l, bg]) => {
            const sel = cfg.modo === "oscuro" ? (cfg.fondoDark || "") === k : (cfg.fondo || "") === k;
            return (<button key={k} onClick={() => save({ ...data, config: { ...(data.config || {}), [cfg.modo === "oscuro" ? "fondoDark" : "fondo"]: k, fondoUrl: "" } })}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <div style={{ width: 50, height: 50, borderRadius: 11, background: bg, border: `2px solid ${sel && !cfg.fondoUrl ? BRASS : T.border}` }} />
              <span style={{ fontSize: 10.5, color: T.sub, fontWeight: 600 }}>{l}</span>
            </button>);
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          {cfg.fondoUrl && <div style={{ width: 52, height: 52, borderRadius: 11, background: `url("${cfg.fondoUrl}") center/cover`, border: `2px solid ${BRASS}`, flexShrink: 0 }} />}
          <label style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {subiendoFondo ? "Subiendo…" : cfg.fondoUrl ? "Cambiar foto" : "Subir foto de fondo"}
            <input type="file" accept="image/*" onChange={subirFondo} style={{ display: "none" }} />
          </label>
          {cfg.fondoUrl && <button onClick={() => setCfg("fondoUrl", "")} style={{ background: "none", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 9, padding: "10px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Quitar</button>}
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6 }}>La foto se ve suave de fondo para no molestar la lectura.</div>
      </Field>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>Respaldo de datos</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>Tus cronogramas se guardan solos en la nube. Igual podés bajar una copia.</div>
        <button onClick={() => descargarArchivo(`VV-Cronogramas-RESPALDO-${hoyISO()}.json`, JSON.stringify(data, null, 2), "application/json")}
          style={{ width: "100%", background: T.navy, color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Respaldo completo (.json)
        </button>
        <label style={{ display: "block", textAlign: "center", background: T.al, color: T.accent, border: `1px dashed ${T.border}`, borderRadius: 9, padding: "11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
          Restaurar desde respaldo (.json)
          <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={async e => {
            const f = e.target.files && e.target.files[0]; if (!f) return;
            try {
              const obj = JSON.parse(await f.text());
              if (!obj || typeof obj !== "object") throw new Error("Archivo inválido");
              if (confirm("Esto REEMPLAZA todos los cronogramas actuales por los del respaldo. ¿Continuar?")) { save(obj); alert("Respaldo restaurado ✓"); }
            } catch (err) { alert("No se pudo restaurar: " + (err && err.message)); }
            e.target.value = "";
          }} />
        </label>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Otras apps de V+V</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[["index.html", "🏗 V+V"], ["finanzas.html", "💰 Finanzas"], ["cliente.html", "👤 Cliente"], ["contratista.html", "🧰 Contratista"], ["nicolas.html", "📋 Nicolás"], ["mi-asistente.html", "🤖 Mi Asistente"], ["muebles.html", "🪚 Muebles"]].map(([href, l]) => (
            <a key={href} href={href} style={{ background: T.al, color: T.accent, border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 13px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>{l}</a>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>Actualizar la app</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>Si subiste una versión nueva y seguís viendo la vieja, tocá acá: borra el caché y trae la última.</div>
        <button onClick={async () => {
          try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch { }
          window.location.replace(window.location.pathname + "?v=" + Date.now());
        }} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          🔄 Actualizar a la última versión
        </button>
      </div>

      <button onClick={onClose} style={{ width: "100%", marginTop: 16, background: T.al, color: T.sub, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cerrar</button>
    </div>
  </div>);
}

/* ═══════════════════ LA APP ═══════════════════ */
export default function Cronograma() {
  const [data, setData] = useState({ plantilla: [], obras: [], cfg: { aviso: 15 }, config: {} });
  const [finanzas, setFinanzas] = useState({ obras: [] });
  const [cargando, setCargando] = useState(true);
  const [verConfig, setVerConfig] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [pantalla, setPantalla] = useState("obras");
  const [obraId, setObraId] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [nom, setNom] = useState("");
  const [ini, setIni] = useState(hoyISO());
  const [modoNuevo, setModoNuevo] = useState("auto"); // "auto" | "manual"
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
          config: d?.config || {},
        });
      } catch {
        setData({ plantilla: JSON.parse(JSON.stringify(PLANTILLA_BASE)), obras: [], cfg: { aviso: 15 }, config: {} });
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

  /* Traer lo último de la nube, ahora mismo, sin esperar al poller */
  async function actualizar() {
    setRefrescando(true);
    let ok = false;
    try {
      const r = await storage.get("vv_cronograma");
      if (r?.value) {
        const d = JSON.parse(r.value);
        escrito.current = 0;   // lo de la nube manda
        setData({
          plantilla: d.plantilla || [], obras: d.obras || [],
          cfg: { aviso: numSimple(d.cfg?.aviso) || 15 }, config: d.config || {},
        });
        ok = true;
      }
      const rf = await storage.get("vv_finanzas");
      if (rf?.value) { const f = JSON.parse(rf.value); setFinanzas({ obras: f?.obras || [] }); }
    } catch { }
    setRefrescando(false);
    setOkMsg(ok ? "Actualizado ✓" : "Sin cambios");
    setTimeout(() => setOkMsg(""), 2000);
  }

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
            setData({ plantilla: d.plantilla || [], obras: d.obras || [], cfg: { aviso: numSimple(d.cfg?.aviso) || 15 }, config: d.config || {} });
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
    const manual = modoNuevo === "manual";
    const o = manual
      ? { id: uid(), nombre: nom.trim(), inicio: ini || hoyISO(), finanzasObraId: "", modoManual: true, tareas: [] }
      : { id: uid(), nombre: nom.trim(), inicio: ini || hoyISO(), finanzasObraId: "", tareas: plantillaAObra(data.plantilla) };
    guardar({ ...data, obras: [...obras, o] });
    setNom(""); setIni(hoyISO()); setNueva(false); setModoNuevo("auto");
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

  /* el tema, según lo que hayas elegido en Personalización */
  const cfgUI = data.config || {};
  T = cfgUI.modo === "oscuro" ? T_DARK : T_LIGHT;
  inp = buildInp(T); inpSm = buildInpSm(T);

  if (cargando) return (<div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif", color: T.sub, fontSize: 13 }}>Cargando cronogramas…</div>);

  const NAV = [["obras", "Obras"], ["alertas", "Alertas"], ["modelo", "Modelo"], ["ajustes", "Ajustes"]];

  /* alertas globales */
  const todasAlertas = [];
  obras.forEach(o => { (planes[o.id]?.pendientes || []).forEach(d => todasAlertas.push({ ...d, obra: o })); });
  todasAlertas.sort((a, b) => (a.faltan ?? 9999) - (b.faltan ?? 9999));

  return (<div style={{ minHeight: "100vh", background: fondoDe(cfgUI), fontFamily: fuenteDe(cfgUI), color: T.text }}>
    <style>{`*{-webkit-font-smoothing:antialiased}*:focus{outline:none}input:focus,select:focus{border-color:${BRASS}!important;box-shadow:0 0 0 3px rgba(176,137,79,.12)}button{-webkit-tap-highlight-color:transparent;transition:opacity .15s,transform .05s}button:active{transform:scale(.985)}body{margin:0}input,select,textarea{color:${T.text};background:${T.inpBg}}input::placeholder,textarea::placeholder{color:${T.muted}}`}</style>

    {/* cabecera: logo, nombre, actualizar y personalización — igual que el resto de la suite */}
    <div style={{ background: `linear-gradient(180deg, #0E1B2B 0%, ${T.dark ? "#05070B" : "#0B1622"} 100%)`, color: "#fff", padding: "20px 24px 18px", textAlign: "center", position: "relative" }}>
      <button onClick={actualizar} title="Actualizar" style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 9, height: 34, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
        ↻ {okMsg || (refrescando ? "..." : "Actualizar")}
      </button>
      <button onClick={() => setVerConfig(true)} title="Personalización" style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 9, width: 34, height: 34, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⚙︎</button>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: cfgUI.logo ? "#fff" : `linear-gradient(145deg, ${BRASS}, #c9a869)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#0B1622", letterSpacing: "-.02em", boxShadow: "0 2px 8px rgba(176,137,79,.35)", overflow: "hidden" }}>
          {cfgUI.logo ? <img src={cfgUI.logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : "V+V"}
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.15 }}>{cfgUI.nombre || "V+V Construcciones"}</div>
          <div style={{ fontSize: 9.5, fontWeight: 600, color: BRASS, letterSpacing: ".18em", textTransform: "uppercase", marginTop: 1 }}>{cfgUI.subtitulo || "Cronogramas de obra"}</div>
        </div>
      </div>
    </div>

    {verConfig && <ConfigModal data={data} save={guardar} onClose={() => setVerConfig(false)} />}

    <header style={{ position: "sticky", top: 0, zIndex: 200, background: T.card, borderBottom: `1px solid ${T.border}` }}>
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

    <main style={{ maxWidth: 1500, margin: "0 auto" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: ".05em", margin: "12px 0 6px" }}>Cómo la vas a cargar</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["auto", "Automático", "usa el modelo y encadena solo"], ["manual", "Manual", "vacía, cargás fechas a mano"]].map(([m, l, sub]) => (
              <button key={m} onClick={() => setModoNuevo(m)} style={{ flex: 1, background: modoNuevo === m ? T.navy : T.bg, color: modoNuevo === m ? "#fff" : T.text, border: `1px solid ${modoNuevo === m ? T.navy : T.border}`, borderRadius: 9, padding: "9px 6px", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{l}</div>
                <div style={{ fontSize: 9.5, opacity: .8, marginTop: 1, lineHeight: 1.3 }}>{sub}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 11 }}><Btn full onClick={crearObra} disabled={!nom.trim()}>Crear cronograma</Btn></div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>
            {modoNuevo === "manual" ? "Arranca vacía. Vas agregando tareas y en cada una ponés la fecha desde y hasta." : `Copia las ${data.plantilla?.length || 0} tareas del modelo, con sus dependencias y definiciones.`}
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
                {p.vencidas.length > 0 && <Chip color={TONO.rojo().c} fondo={TONO.rojo().b}>{p.vencidas.length} vencida{p.vencidas.length > 1 ? "s" : ""}</Chip>}
                {p.urgentes.length > 0 && <Chip color={TONO.ambar().c} fondo={TONO.ambar().b}>{p.urgentes.length} urgente{p.urgentes.length > 1 ? "s" : ""}</Chip>}
                {p.excede && <Chip color={TONO.rojo().c} fondo={TONO.rojo().b}>+12 meses</Chip>}
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
          <div style={{ background: TONO.verde().b, border: `1px solid ${TONO.verde().bd}`, borderRadius: 14, padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ok }}>Todo al día</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 4 }}>No hay definiciones pendientes.</div>
          </div>
        )}
        {[["Vencidas — están frenando la obra", todasAlertas.filter(d => d.estado === "vencida"), TONO.rojo().c],
          [`Urgentes — dentro de ${diasAviso} días`, todasAlertas.filter(d => d.estado === "urgente"), TONO.ambar().c],
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

    <div style={{ background: excede ? TONO.rojo().b : T.card, border: `1px solid ${excede ? TONO.rojo().bd : T.border}`, borderRadius: 12, padding: 13, marginBottom: 12 }}>
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
