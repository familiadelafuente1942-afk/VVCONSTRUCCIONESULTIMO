"use client";
import { useEffect, useState } from "react";
import { sendSurvey, listSurveys } from "./api.js";
const amenities = ["Terraza / rooftop", "Parrilla", "SUM / espacio social", "Coworking", "Gimnasio", "Piscina", "Cocheras", "Bicicletero", "Bajas expensas"];
function InvestorSurvey() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const form = event.currentTarget;
    const fd = new FormData(form);
    const data = { ...Object.fromEntries(fd), features: fd.getAll("features"), consent: fd.get("consent") === "on" };
    try {
      await sendSurvey(data);
      setDone(true);
      setStatus("Tu respuesta qued\xF3 guardada. Gracias por ayudarnos a definir el proyecto.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  return <section className="survey section" id="tu-inversion"><p className="eyebrow">TU MIRADA / DEFINIR EL NEGOCIO</p><h2>¿Te interesa formar parte?</h2><p className="survey-intro">Estamos reuniendo interesados en una propuesta de Belfast Desarrollos: fideicomiso inmobiliario, aporte inicial y 24 cuotas. Queremos saber si te interesa conversar. Responder no reserva una unidad ni compromete dinero; lote, montos y condiciones están por definir.</p>{done ? <div className="survey-success" role="status"><p>{status}</p><button onClick={() => {
    setDone(false);
    setStatus("");
  }}>Cargar otra respuesta</button></div> : <form onSubmit={submit}>
 <fieldset className="interest-choice"><legend>¿Te interesaría participar en este desarrollo?</legend><div>{["S\xED, me interesa", "Quiero saber m\xE1s", "Por ahora no"].map((value) => <label key={value}><input type="radio" name="interest" value={value} required />{value}</label>)}</div></fieldset><div className="survey-fields"><label>Nombre (opcional)<input name="name" maxLength={200} autoComplete="name" /></label><label>WhatsApp o email (opcional)<input name="contact" maxLength={200} /></label></div><details className="survey-detail"><summary>Opcional: contanos cómo imaginás tu inversión</summary><div className="survey-fields"><label>¿Cuál sería tu objetivo principal?<select name="goal" defaultValue=""><option value="">Por definir</option>{["Reventa", "Capitalizaci\xF3n", "Renta", "Uso propio", "Combinado"].map((x) => <option key={x}>{x}</option>)}</select></label><label>¿Qué plazo tenés en mente?<select name="horizon"><option>Por definir</option><option>Hasta la finalización de obra</option><option>3 a 5 años</option><option>Más de 5 años</option></select></label><label>¿Qué unidad te interesa?<select name="unit"><option>Por definir</option><option>Monoambiente</option><option>2 ambientes</option><option>3 ambientes</option><option>4 ambientes o más</option><option>Varias unidades</option></select></label><label>Rango de inversión orientativo (USD, opcional)<input name="budget" placeholder="Ej.: USD 50.000 a 100.000" maxLength={200} /></label><label>¿Cómo preferís integrar el aporte?<select name="payment"><option>Entrada inicial + 24 cuotas</option><option>Mayor entrada y cuotas menores</option><option>Aporte al contado</option><option>Quiero conversar alternativas</option></select></label></div>
 <fieldset><legend>¿Qué debería tener el edificio para interesarte?</legend><div className="survey-options">{amenities.map((x) => <label key={x}><input type="checkbox" name="features" value={x} />{x}</label>)}</div></fieldset><label className="survey-comment">¿Qué necesitás ver para decidir? ¿Cómo pensás el negocio?<textarea name="comments" maxLength={1500} rows={4} placeholder="Ubicación, distribución, retorno esperado, calidad, gastos, plazo…" /></label></details><label className="honey" aria-hidden="true">Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label><label className="survey-consent"><input type="checkbox" name="consent" required />Autorizo a Belfast Desarrollos a guardar mi respuesta para evaluar esta propuesta y, si dejo contacto, comunicarse conmigo sobre este proyecto. No autoriza campañas ajenas al proyecto. Puedo solicitar corrección o eliminación de mis datos a Belfast.</label><button className="primary" disabled={busy}>{busy ? "Guardando\u2026" : "Enviar mi respuesta"}</button><p role="status">{status}</p></form>}</section>;
}
function SurveyInbox() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("Cargando respuestas\u2026");
  async function load() {
    try {
      const data = { items: await listSurveys() };
      setItems(data.items);
      setStatus(data.items.length ? `${data.items.length} respuestas \xB7 ${data.items.filter((x) => x.interest === "S\xED, me interesa").length} interesados \xB7 ${data.items.filter((x) => x.interest === "Quiero saber m\xE1s").length} quieren m\xE1s informaci\xF3n \xB7 ${data.items.filter((x) => x.interest === "Por ahora no").length} por ahora no` : "Todav\xEDa no hay respuestas");
    } catch {
      setStatus("No se pudieron cargar las respuestas");
    }
  }
  useEffect(() => {
    load();
  }, []);
  function exportCsv() {
    const cols = [["createdAt", "Fecha"], ["name", "Nombre"], ["contact", "Contacto"], ["interest", "Interés"], ["goal", "Objetivo"], ["horizon", "Plazo"], ["unit", "Unidad"], ["budget", "Aporte orientativo"], ["payment", "Forma de pago"], ["features", "Prioridades"], ["comments", "Comentarios"]];
    const esc = (v) => '"' + String(Array.isArray(v) ? v.join(" | ") : v ?? "").replace(/"/g, '""') + '"';
    const csv = "\uFEFF" + [cols.map((c) => esc(c[1])).join(";"), ...items.map((it) => cols.map((c) => esc(it[c[0]])).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "interesados-belfast.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section><h3>Encuesta de inversores · privada</h3><button onClick={load}>Actualizar respuestas</button> <button onClick={exportCsv} disabled={!items.length}>Descargar Excel (CSV)</button><p>{status}</p><div className="survey-inbox">{items.map((item) => <article key={item.id}><strong>{item.name || "Respuesta sin nombre"} · {item.interest || "Inter\xE9s no indicado"}</strong><small>{new Date(item.createdAt).toLocaleString("es-AR")}</small><p>{item.contact || "Sin contacto"} · Objetivo: {item.goal || "Por definir"}</p><p>Plazo: {item.horizon} · Unidad: {item.unit}<br />Aporte: {item.budget || "No informado"}<br />Pago: {item.payment}</p><p>Prioridades: {item.features?.join(", ") || "No informadas"}</p>{item.comments && <p>{item.comments}</p>}</article>)}</div></section>;
}
export {
  InvestorSurvey,
  SurveyInbox
};
