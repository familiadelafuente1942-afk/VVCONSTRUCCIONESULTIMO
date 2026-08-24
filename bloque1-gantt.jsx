const CR_DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function crDowDe(iso) { const d = new Date(iso + "T12:00:00"); return isNaN(d.getTime()) ? 0 : d.getDay(); }
function crHabilesEntre(a, b) {
  if (!a || !b) return 0;
  if (a > b) return -crHabilesEntre(b, a);
  let n = 0, f = a, guarda = 0;
  while (f < b && guarda < 20000) { if (crEsHabil(f)) n++; f = crIsoMas(f, 1); guarda++; }
  return n;
}
function crFmtCorta(iso) { if (!iso) return "—"; const d = new Date(iso + "T12:00:00"); if (isNaN(d.getTime())) return "—"; return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; }
const CR_COLOR_ETAPA = {
  "Preliminares": "#64748B", "Estructura": "#1B3A5B", "Albañilería": "#0E7490",
  "Instalaciones": "#7C3AED", "Terminaciones": "#B0894F", "Cierre": "#16A34A",
};

// Gantt de Belfast — el mismo dibujo que usa V+V en Cronograma.jsx, pero
// SOLO LECTURA: no tiene abrirHito/guardarHito/borrarHito ni onClick en los
// días. Belfast ve las referencias que V+V cargó, pero no las toca.
function BelfastCronoGantt({ T, plan }) {
  const hoy = crHoy();
  const [zoom, setZoom] = React.useState("dia");
  const o = plan.o;
  const manual = !!o.modoManual;
  const lista = plan.tareas;
  const baseCal = plan.base || o.inicio;
  const hitos = o.hitos || [];
  const hitoDe = (f) => hitos.find(h => h.fecha === f);

  const dias = React.useMemo(() => {
    const out = [];
    if (manual) {
      const n = Math.max(1, plan.finDias || 1);
      let f = baseCal;
      for (let i = 0; i < n && i < 3000; i++) { out.push(f); f = crIsoMas(f, 1); }
      return out;
    }
    const n = Math.max(1, plan.finHabiles || 1);
    let f = crPrimerHabil(o.inicio);
    for (let i = 0; i < n && i < 3000; i++) {
      out.push(f);
      let sig = crIsoMas(f, 1);
      let g = 0;
      while (!crEsHabil(sig) && g < 7) { sig = crIsoMas(sig, 1); g++; }
      f = sig;
    }
    return out;
  }, [o.inicio, plan.finHabiles, plan.finDias, manual, baseCal]);

  const ANCHO = zoom === "dia" ? 26 : zoom === "semana" ? 11 : 4;
  const ancho = dias.length * ANCHO;
  const colHoy = dias.indexOf(hoy);

  const bandas = React.useMemo(() => {
    const b = [];
    dias.forEach((d, i) => {
      const m = d.slice(0, 7);
      const ult = b[b.length - 1];
      if (ult && ult.mes === m) ult.n++;
      else b.push({ mes: m, desde: i, n: 1 });
    });
    return b;
  }, [dias]);

  const nomMes = (m) => { const [a, mm] = m.split("-"); return `${CR_MES[Number(mm) - 1]} ${a.slice(2)}`; };

  if (!lista.length) return null;

  return (<div style={{ marginLeft: -14, marginRight: -14, marginTop: 10, background: T.card, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "12px 0 14px" }}>
    <style>{`
      .cgr-lbl{width:112px;flex:0 0 112px}
      @media(min-width:520px){.cgr-lbl{width:180px;flex:0 0 180px}}
      .cgr-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
      .cgr-scroll::-webkit-scrollbar{height:7px}
      .cgr-scroll::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
    `}</style>

    <div style={{ display: "flex", gap: 4, padding: "0 14px 10px", alignItems: "center" }}>
      <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, marginRight: 3 }}>VER POR</span>
      {[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]].map(([k, l]) => (
        <button key={k} onClick={() => setZoom(k)} style={{
          background: zoom === k ? T.accent : T.accentLight, color: zoom === k ? "#fff" : T.sub,
          border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 11px",
          fontSize: 11.5, fontWeight: 700, cursor: "pointer",
        }}>{l}</button>
      ))}
      <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.muted }}>{dias.length} días{manual ? "" : " hábiles"}</span>
    </div>

    <div style={{ display: "flex", padding: "0 14px" }}>
      <div className="cgr-lbl" style={{ minWidth: 0 }}>
        <div style={{ height: 34 }} />
        {lista.map(t => (
          <div key={t.id} style={{ height: 26, display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5, fontWeight: t.critica ? 800 : 600, color: t.critica ? "#B91C1C" : T.text }}>{t.nombre}</span>
            {!manual && <span style={{ flexShrink: 0, fontSize: 8.5, fontWeight: 800, color: t.critica ? "#B91C1C" : T.muted }}>{t.critica ? "CRÍT" : `+${t.holgura ?? 0}d`}</span>}
          </div>
        ))}
      </div>

      <div className="cgr-scroll" style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
        <div style={{ width: ancho, minWidth: "100%", position: "relative" }}>
          <div style={{ display: "flex", height: 15 }}>
            {bandas.map((b, i) => (
              <div key={i} style={{
                width: b.n * ANCHO, flexShrink: 0, borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
                fontSize: 9.5, fontWeight: 800, color: T.sub, textTransform: "uppercase",
                letterSpacing: ".04em", paddingLeft: 3, overflow: "hidden", whiteSpace: "nowrap",
              }}>{b.n * ANCHO > 34 ? nomMes(b.mes) : ""}</div>
            ))}
          </div>

          <div style={{ display: "flex", height: 22, alignItems: "center" }}>
            {dias.map((d, i) => {
              const dd = Number(d.slice(8, 10));
              const esHoyD = d === hoy;
              const lunes = crDowDe(d) === 1;
              const h = hitoDe(d);
              const mostrar = zoom === "dia" || (zoom === "semana" && lunes);
              return (<div key={i} style={{
                width: ANCHO, flexShrink: 0, textAlign: "center",
                fontSize: zoom === "dia" ? 9.5 : 8.5,
                fontWeight: h || esHoyD ? 800 : 600,
                color: h ? "#fff" : esHoyD ? "#EF4444" : lunes ? T.sub : T.muted,
                background: h ? h.color : "transparent", borderRadius: h ? 4 : 0,
                borderLeft: lunes && !h ? `1px solid ${T.border}` : "none", lineHeight: "16px",
              }}>{mostrar || h ? dd : ""}</div>);
            })}
          </div>

          <div style={{ position: "relative", paddingTop: 6 }}>
            {dias.map((d, i) => crDowDe(d) === 1 ? (
              <div key={i} style={{ position: "absolute", left: i * ANCHO, top: 0, bottom: 0, width: 1, background: T.border, opacity: .55 }} />
            ) : null)}
            {colHoy >= 0 && (
              <div style={{ position: "absolute", left: colHoy * ANCHO, top: 0, bottom: 0, width: 2, background: "#EF4444", zIndex: 3, opacity: .9 }} />
            )}
            {hitos.map(h => {
              const i = dias.indexOf(h.fecha); if (i < 0) return null;
              const cx = i * ANCHO + ANCHO / 2;
              return (<React.Fragment key={h.id}>
                <div title={h.texto} style={{ position: "absolute", left: cx - 1, top: 4, bottom: 0, width: 2, background: h.color, zIndex: 4, opacity: .9 }} />
                <div title={h.texto} style={{ position: "absolute", left: cx - 6, top: -3, width: 12, height: 12, borderRadius: "50%", background: h.color, border: `2px solid ${T.card}`, boxShadow: "0 1px 3px rgba(0,0,0,.35)", zIndex: 6 }} />
              </React.Fragment>);
            })}

            {lista.map(t => {
              const col = t.critica ? "#B91C1C" : (CR_COLOR_ETAPA[t.etapa] || T.accent);
              const off = manual ? (t.offCal || 0) : t.es;
              const dur = manual ? (t.durCal || 1) : t.dias;
              const izq = off * ANCHO;
              const anc = Math.max(3, dur * ANCHO);
              const avance = Math.max(0, Math.min(100, crNum(t.avance)));
              let bIzq = null, bAnc = null;
              if (t.bfInicio && t.bfFin) {
                let i0, n;
                if (manual) { i0 = crDiasEntre(baseCal, t.bfInicio); n = Math.max(1, crDiasEntre(t.bfInicio, t.bfFin) + 1); }
                else { i0 = crHabilesEntre(crPrimerHabil(o.inicio), crPrimerHabil(t.bfInicio)); n = Math.max(1, crHabilesEntre(crPrimerHabil(t.bfInicio), t.bfFin) + 1); }
                bIzq = i0 * ANCHO; bAnc = Math.max(3, n * ANCHO);
              }
              return (<div key={t.id} style={{ height: 26, position: "relative" }}>
                <div style={{ position: "absolute", left: izq, width: anc, top: 5, height: 13, background: col, borderRadius: 3, opacity: .28, border: `1px solid ${col}` }} />
                {avance > 0 && <div style={{ position: "absolute", left: izq, width: anc * avance / 100, top: 5, height: 13, background: col, borderRadius: 3 }} />}
                {bIzq !== null && <div style={{ position: "absolute", left: bIzq, width: bAnc, top: 19, height: 5, border: `1.5px solid ${BRASS}`, borderRadius: 2, boxSizing: "border-box" }} />}
              </div>);
            })}
          </div>
        </div>
      </div>
    </div>

    <div style={{ display: "flex", gap: 12, margin: "10px 14px 0", flexWrap: "wrap", fontSize: 10, color: T.sub }}>
      {!manual && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 7, background: "#B91C1C", borderRadius: 3 }} /> camino crítico</span>}
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 7, background: T.accent, borderRadius: 3 }} /> V+V</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 6, border: `1.5px solid ${BRASS}`, borderRadius: 3, boxSizing: "border-box" }} /> Belfast</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 2, height: 10, background: "#EF4444" }} /> hoy</span>
      <span style={{ color: T.muted }}>· {manual ? "calendario real, con las fechas cargadas" : "solo días hábiles, sin fines de semana"}</span>
    </div>

    {hitos.length > 0 && <div style={{ margin: "10px 14px 0", display: "flex", flexDirection: "column", gap: 5 }}>
      {hitos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(h => (
        <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, background: T.accentLight, borderRadius: 8, padding: "7px 10px", borderLeft: `3px solid ${h.color}` }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: h.color, flexShrink: 0, minWidth: 52 }}>{crFmtCorta(h.fecha)}</span>
          <span style={{ fontSize: 12, color: T.text, flex: 1, minWidth: 0 }}>{h.texto}</span>
        </div>
      ))}
    </div>}
  </div>);
}

