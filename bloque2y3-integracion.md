## 2) Reemplazar el cálculo de `planes`

Buscá este bloque dentro de `CronogramaScreenInner` (empieza en `const planes = obras.map...`) y agregale
`base`, `finHabiles` y `finDias` — son los datos que el Gantt necesita para dibujar la grilla de días.
También agrega `offCal`/`durCal` a cada tarea en modo manual.

REEMPLAZAR ESTE BLOQUE:

```jsx
  const planes = obras.map(o => { try {
    let tareas;
    if (o.modoManual) {
      tareas = (o.tareas || []).map(t => ({ ...t, vvInicio: t.desde || o.inicio || hoy, vvFin: (t.hasta && t.hasta >= (t.desde || "")) ? t.hasta : (t.desde || o.inicio || hoy), critica: false }));
    } else {
      tareas = crCPM(o.tareas || []).map(t => ({ ...t, vvInicio: crHabilDesde(o.inicio, t.es), vvFin: crHabilDesde(o.inicio, t.ef - 1) }));
    }
    tareas = tareas.map(t => {
      const desvReal = (t.realFin && t.vvFin) ? crDiasEntre(t.vvFin, t.realFin) : null;
      const desvRealIni = (t.realInicio && t.vvInicio) ? crDiasEntre(t.vvInicio, t.realInicio) : null;
      const defs = (t.defs || []).map(d => {
        const limite = crIsoMas(t.vvInicio, -crNum(d.diasAntes));
        const faltan = limite ? crDiasEntre(hoy, limite) : null;
        let estado = "futura";
        if (d.ok) estado = "ok"; else if (faltan !== null && faltan < 0) estado = "vencida"; else if (faltan !== null && faltan <= 15) estado = "urgente";
        const gid = "cron_" + d.id;
        const dec = g.punit[gid];
        const gest = dec ? (dec.decision === "confirmado" ? "punitorio" : dec.decision === "prorroga" ? "prorroga" : "sin_perjuicio") : (enManual.has(gid) ? "evaluacion" : null);
        return { ...d, limite, faltan, estado, gest, tarea: t.nombre, critica: t.critica };
      });
      return { ...t, desvReal, desvRealIni, defs };
    });
    const fin = tareas.reduce((m, t) => (!m || t.vvFin > m) ? t.vvFin : m, "");
    const defsPend = tareas.flatMap(t => t.defs).filter(d => !d.ok);
    const venc = defsPend.filter(d => d.estado === "vencida");
    // corrimiento contra la línea base fijada en el Cronograma de V+V
    const corr = (o.finBase && fin) ? crDiasEntre(o.finBase, fin) : null;
    return { o, tareas, fin, defsPend, venc, corr };
  } catch (e) { return { o, tareas: [], fin: "", defsPend: [], venc: [], corr: null, error: String(e && e.message || e) }; } }).filter(p => p && p.o);
```

POR ESTE:

```jsx
  const planes = obras.map(o => { try {
    const base = o.modoManual
      ? (() => { const fechas = (o.tareas || []).map(t => t.desde).filter(Boolean); return fechas.length ? fechas.reduce((m, f) => f < m ? f : m, fechas[0]) : (o.inicio || hoy); })()
      : (o.inicio || hoy);
    let tareas;
    if (o.modoManual) {
      tareas = (o.tareas || []).map(t => {
        const vvInicio = t.desde || o.inicio || hoy;
        const vvFin = (t.hasta && t.hasta >= (t.desde || "")) ? t.hasta : (t.desde || o.inicio || hoy);
        const offCal = crDiasEntre(base, vvInicio);
        const durCal = crDiasEntre(vvInicio, vvFin) + 1;
        return { ...t, vvInicio, vvFin, critica: false, offCal, durCal };
      });
    } else {
      tareas = crCPM(o.tareas || []).map(t => ({ ...t, vvInicio: crHabilDesde(o.inicio, t.es), vvFin: crHabilDesde(o.inicio, t.ef - 1) }));
    }
    tareas = tareas.map(t => {
      const desvReal = (t.realFin && t.vvFin) ? crDiasEntre(t.vvFin, t.realFin) : null;
      const desvRealIni = (t.realInicio && t.vvInicio) ? crDiasEntre(t.vvInicio, t.realInicio) : null;
      const defs = (t.defs || []).map(d => {
        const limite = crIsoMas(t.vvInicio, -crNum(d.diasAntes));
        const faltan = limite ? crDiasEntre(hoy, limite) : null;
        let estado = "futura";
        if (d.ok) estado = "ok"; else if (faltan !== null && faltan < 0) estado = "vencida"; else if (faltan !== null && faltan <= 15) estado = "urgente";
        const gid = "cron_" + d.id;
        const dec = g.punit[gid];
        const gest = dec ? (dec.decision === "confirmado" ? "punitorio" : dec.decision === "prorroga" ? "prorroga" : "sin_perjuicio") : (enManual.has(gid) ? "evaluacion" : null);
        return { ...d, limite, faltan, estado, gest, tarea: t.nombre, critica: t.critica };
      });
      return { ...t, desvReal, desvRealIni, defs };
    });
    const fin = tareas.reduce((m, t) => (!m || t.vvFin > m) ? t.vvFin : m, "");
    const finHabiles = tareas.reduce((m, t) => Math.max(m, t.ef || 0), 0);
    const finDias = fin ? crDiasEntre(base, fin) + 1 : 0;
    const defsPend = tareas.flatMap(t => t.defs).filter(d => !d.ok);
    const venc = defsPend.filter(d => d.estado === "vencida");
    // corrimiento contra la línea base fijada en el Cronograma de V+V
    const corr = (o.finBase && fin) ? crDiasEntre(o.finBase, fin) : null;
    return { o, tareas, fin, defsPend, venc, corr, base, finHabiles, finDias };
  } catch (e) { return { o, tareas: [], fin: "", defsPend: [], venc: [], corr: null, error: String(e && e.message || e), base: o.inicio || hoy, finHabiles: 0, finDias: 0 }; } }).filter(p => p && p.o);
```

---

## 3) Insertar el Gantt en el render

Buscá la línea que arranca el `.map` de las obras:

```jsx
      {planes.map(({ o, tareas, fin, defsPend, venc, corr }) => {
```

Cambiala por (agrega `plan` completo, sin sacar nada):

```jsx
      {planes.map((plan) => {
        const { o, tareas, fin, defsPend, venc, corr } = plan;
```

Y después, dentro del bloque `{abierta && <div ...>}`, buscá esta línea (el aviso de corrimiento):

```jsx
            {corr !== null && corr > 0 && <div style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", borderRadius: 10, padding: "10px 11px", marginTop: 10, fontSize: 11.5, color: "#991B1B", lineHeight: 1.5 }}>El fin de obra se corrió <b>+{corr} días (~{(corr / 30.44).toFixed(1)} meses)</b> respecto del plan original. Todo corrimiento adicional queda sujeto a redeterminación de precios sobre el saldo del contrato.</div>}
```

Y agregale la barra de tiempo justo debajo:

```jsx
            {corr !== null && corr > 0 && <div style={{ background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.30)", borderRadius: 10, padding: "10px 11px", marginTop: 10, fontSize: 11.5, color: "#991B1B", lineHeight: 1.5 }}>El fin de obra se corrió <b>+{corr} días (~{(corr / 30.44).toFixed(1)} meses)</b> respecto del plan original. Todo corrimiento adicional queda sujeto a redeterminación de precios sobre el saldo del contrato.</div>}
            <BelfastCronoGantt T={T} plan={plan} />
```

Con eso alcanza: el resto del archivo (lista de tareas, definiciones, corrimiento) queda exactamente igual.
