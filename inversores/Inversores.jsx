"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, Check, ChevronDown, CircleDollarSign, Clock3, Download, FileText, ImagePlus, Landmark, LockKeyhole, MapPin, Menu, Pencil, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { InvestorSurvey, SurveyInbox } from "./investor-survey.jsx";
import * as api from "./api.js";
import logoImg from "./img/belfast-logo.jpeg";
import c1 from "./img/concept-1.jpeg";
import c2 from "./img/concept-2.jpeg";
import c3 from "./img/concept-3.jpeg";
import c4 from "./img/concept-4.jpeg";
import c5 from "./img/concept-5.jpeg";
const CONCEPT_SRC = [c1, c2, c3, c4, c5];
import { defaultContent } from "./brochure.js";
const concepts = Array.from({ length: 5 }, (_, i) => ({ id: -(i + 1), fileName: `concept-${i + 1}.jpeg`, contentType: "image/jpeg", category: "Dise\xF1o conceptual", title: `Arquitectura Belfast \xB7 propuesta ${String(i + 1).padStart(2, "0")}`, caption: "Imagen conceptual ilustrativa. No representa un proyecto aprobado ni un lote definitivo.", createdAt: "", src: CONCEPT_SRC[i] }));
const mediaUrl = (item) => item.src ?? api.mediaUrl(item);
const nav = [["propuesta", "Propuesta"], ["modalidad", "Modalidad"], ["simulador", "Simulador"], ["proyecto", "Proyecto"], ["avances", "Avances"], ["documentos", "Documentaci\xF3n"], ["tu-inversion", "Tu inversi\xF3n"], ["contacto", "Contacto"]];
function Home() {
  const [content, setContent] = useState(defaultContent);
  const [draft, setDraft] = useState(defaultContent);
  const [media, setMedia] = useState([]);
  const [admin, setAdmin] = useState({ authenticated: false, admin: false, email: "" });
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [resumen, setResumen] = useState({ total: 0, interesados: 0 });
  const [saveState, setSaveState] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("Renders");
  const [activeMedia, setActiveMedia] = useState(null);
  const refresh = async () => {
    const [contentData, mediaItems, meData] = await Promise.all([api.getContent().catch(() => ({ content: null, updatedAt: "" })), api.listMedia().catch(() => []), api.me()]);
    let saved = contentData.content;
    if (saved) { saved = { ...saved }; for (const key of ["heroSubtitle", "heroTitle", "ctaTitle", "conceptBody"]) { if (typeof saved[key] === "string" && /primer (proyecto|edificio)/i.test(saved[key])) delete saved[key]; } }
    const merged = saved ? { ...defaultContent, ...saved } : defaultContent;
    setContent(merged);
    setDraft(merged);
    setUpdatedAt(contentData.updatedAt ?? "");
    setMedia(mediaItems);
    setAdmin(meData);
    api.resumen().then(setResumen);
  };
  useEffect(() => {
    refresh().catch(() => void 0);
  }, []);
  const images = useMemo(() => [...media.filter((item) => item.contentType.startsWith("image/")), ...concepts], [media]);
  useEffect(() => {
    if (!activeMedia) return;
    const onKey = (event) => {
      if (event.key === "Escape") setActiveMedia(null);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [activeMedia]);
  const videos = useMemo(() => media.filter((item) => item.contentType.startsWith("video/")), [media]);
  const documents = useMemo(() => media.filter((item) => item.contentType === "application/pdf"), [media]);
  const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaveState("Guardando\u2026");
    try {
      const at = await api.saveContent(draft);
      setContent(draft);
      setUpdatedAt(at);
      setSaveState("Cambios publicados");
      setTimeout(() => setSaveState(""), 2500);
    } catch (e) { setSaveState(e instanceof Error ? e.message : "No se pudo guardar"); }
  };
  const upload = async (files, title = "", caption = "") => {
    if (!files?.length) return;
    setUploading(true);
    setSaveState(`Subiendo ${files.length} archivo${files.length > 1 ? "s" : ""}\u2026`);
    for (const file of Array.from(files)) {
      try {
        const base = file.name.replace(/\.[^.]+$/, "");
        await api.uploadMedia(file, { category: uploadCategory, title: title ? (files.length > 1 ? `${title} \xB7 ${base}` : title) : base, caption });
      } catch (e) {
        setSaveState(e instanceof Error ? e.message : `No se pudo subir ${file.name}`);
        setUploading(false);
        return;
      }
    }
    await refresh();
    setUploading(false);
    setSaveState("Archivos publicados");
    setTimeout(() => setSaveState(""), 2500);
  };
  const deleteMedia = async (item) => {
    if (!confirm(`\xBFEliminar ${item.title}?`)) return;
    try { await api.deleteMedia(item); setMedia((current) => current.filter((entry) => entry.id !== item.id)); } catch { setSaveState("No se pudo eliminar"); }
  };
  const whatsappUrl = content.whatsapp ? `https://wa.me/${content.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, quiero recibir informaci\xF3n sobre ${content.projectName} de Belfast Desarrollos.`)}` : "#contacto";
  return <main>
    <header className="topbar">
      <a className="brand" href="#inicio"><img className="brand-logo" src={logoImg} alt="Belfast Construction Management" /><span><b>BELFAST</b><small>DESARROLLOS</small></span></a>
      <nav className={menuOpen ? "open" : ""}>{nav.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>
      <div className="header-actions">{admin.admin ? <button className="edit-button" onClick={() => {
    setEditing(true);
    setDraft(content);
  }}><Pencil size={16} />Editar</button> : <button className="admin-link" onClick={() => setLoginOpen(true)}><LockKeyhole size={15} />Acceso Belfast</button>}<button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
    </header>

    <section className="hero" id="inicio"><div className="hero-concept-board"><div className="concept-label"><strong>REFERENCIAS DE DISEÑO</strong><span>Distintas alternativas. Un mismo lenguaje.</span></div><div className="concept-triptych">{concepts.slice(0, 3).map((item, index) => <button key={item.id} onClick={() => setActiveMedia(item)}><img src={mediaUrl(item)} alt={`Alternativa conceptual ${index + 1} de arquitectura Belfast`} /><span>Alternativa {String(index + 1).padStart(2, "0")}</span></button>)}</div><p>Estas imágenes muestran posibles diseños y el estilo buscado. Ninguna representa el edificio definitivo. Lote, altura, distribución y amenities se definirán con la factibilidad y el anteproyecto.</p></div><div className="hero-shade" /><div className="hero-content">
      <p className="kicker">BELFAST DESARROLLOS / PROPIEDAD HORIZONTAL</p><p className="project-edition">{content.projectName} — INVERSORES</p><h1>{content.heroTitle}</h1><p className="hero-copy">{content.heroSubtitle}</p>
      <div className="hero-meta"><span><MapPin size={16} />{content.location}</span><span className="stage-dot" />{content.stageLabel}</div>
      <div className="hero-actions"><a className="primary" href="#modalidad">Conocer la propuesta<ArrowRight size={18} /></a><button className="secondary" onClick={() => window.print()}><Download size={17} />Guardar presentación</button></div>
    </div></section><section className="investment-ribbon"><span className="ribbon-title">Participar<br />desde el comienzo.</span><div><small>La estructura</small><strong>{content.modelTitle}</strong></div><div><small>Primer paso</small><strong>Aporte inicial</strong><span>{content.initialContribution}</span></div><div><small>El recorrido</small><strong>{content.installments}</strong><span>Integración de la inversión</span></div><a href="#modalidad">Ver modalidad <ArrowRight size={20} /></a></section>

    <div className="visual-navigation"><span>ARQUITECTURA BELFAST <small>Diseños conceptuales · lote a definir</small></span><div>{images.map((item, index) => <button key={item.id} aria-label={`Mostrar imagen ${index + 1}`} onClick={() => setActiveMedia(item)}>{String(index + 1).padStart(2, "0")}</button>)}</div><a href="#documentos">Explorar las imágenes <ArrowRight size={16} /></a></div>
    <section className="experience section"><p className="eyebrow">LOS SOCIOS / EL RECORRIDO</p><h2>{content.experienceTitle}</h2><p className="lead">{content.experienceBody}</p></section>
    <section className="intro section" id="propuesta"><div><p className="eyebrow">01 / NUESTRA MIRADA</p><h2>{content.conceptTitle}</h2></div><p className="lead">{content.conceptBody}</p></section>
    <section className="model section" id="modalidad"><div className="section-heading"><div><p className="eyebrow">02 / CÓMO PARTICIPAR</p><h2>El acuerdo. Los aportes. El proyecto.</h2></div><Landmark /></div><div className="model-layout"><article className="model-main"><p className="number">01</p><h3>{content.modelTitle}</h3><p>{content.modelBody}</p><div className="trust-line"><ShieldCheck /><span>La estructura jurídica y económica definitiva se documentará antes de cada adhesión.</span></div></article><div className="terms-grid"><Metric label="Aporte inicial" value={content.initialContribution} /><Metric label="Integración" value={content.installments} /><Metric label="Ticket estimado" value={content.investmentTicket} /><Metric label="Plazo del proyecto" value={content.projectTerm} /><Metric label="Moneda" value={content.currency} /><Metric label="Retorno de referencia" value={content.returnReference} /></div></div></section>
    <FundingSim content={content} resumen={resumen} />
    <section className="product section" id="proyecto"><div className="product-copy"><p className="eyebrow">03 / EL LENGUAJE ARQUITECTÓNICO</p><h2>{content.productTitle}</h2><p>{content.productBody}</p><div className="product-facts"><span><Building2 /><small>Unidades</small><b>{content.unitsReference}</b></span><span><CircleDollarSign /><small>Superficie comercial</small><b>{content.sellableAreaReference}</b></span><span><Check /><small>Servicios y amenities</small><b>{content.amenitiesReference}</b></span></div></div><div className="product-alternatives"><p className="eyebrow">POSIBLES DISEÑOS / NO DEFINITIVOS</p><div>{concepts.slice(2, 5).map((item) => <button key={item.id} onClick={() => setActiveMedia(item)}><img src={mediaUrl(item)} alt={item.title} /><span>Referencia de estilo</span></button>)}</div><p>El edificio podrá tomar este lenguaje arquitectónico. Su configuración final no está definida.</p></div></section>
    <section className="definition section" id="distribucion"><p className="eyebrow">EL PRODUCTO / DEFINICIÓN EN DESARROLLO</p><h2>El edificio, por dentro.</h2><div className="definition-blocks">{[["Plantas y distribuci\xF3n", content.distributionBody, "Plantas"], ["Amenities y servicios", content.amenitiesBody, "Amenities"], ["Qu\xE9 buscamos y para qui\xE9n", content.profileBody, "Perfil"]].map(([title, body, category]) => <article key={category}><h3>{title}</h3><p>{body}</p><div className="section-files">{media.filter((item) => item.category === category).map((item) => <button key={item.id} onClick={() => setActiveMedia(item)}>{item.contentType.startsWith("image/") ? <img src={mediaUrl(item)} alt={item.title} /> : <FileText />}<strong>{item.title}</strong>{item.caption && <span>{item.caption}</span>}</button>)}</div>{!media.some((item) => item.category === category) && <small>Material por incorporar · sujeto al lote y al anteproyecto</small>}</article>)}</div></section>
    <section className="timeline section" id="avances"><div className="section-heading"><div><p className="eyebrow">04 / LA HOJA DE RUTA</p><h2>Del terreno al edificio.</h2></div><Clock3 /></div><div className="timeline-list">{content.milestones.map((item, index) => <article key={`${item.title}-${index}`} className={item.status === "En curso" ? "current" : ""}><span className="timeline-index">{String(index + 1).padStart(2, "0")}</span><div><small>{item.status}</small><h3>{item.title}</h3><p>{item.detail}</p></div></article>)}</div></section>
    <section className="transparency section"><div><p className="eyebrow">05 / SEGUIMIENTO</p><h2>{content.trustTitle}</h2><p>{content.trustBody}</p></div><div className="transparency-points"><span><Check />Datos del lote y prefactibilidad</span><span><Check />Plantas, vistas e imágenes</span><span><Check />Plan económico actualizado</span><span><Check />Documentación y cronograma</span></div></section>
    <section className="library section" id="documentos"><div className="section-heading"><div><p className="eyebrow">06 / EXPLORAR LA ARQUITECTURA</p><h2>Formas, materiales y luz.</h2></div><span className="live-badge">{media.length ? `${media.length} archivos publicados` : "Se actualiza con cada avance"}</span></div>{images.length || videos.length ? <div className="gallery">{[...images, ...videos].map((item) => <button key={item.id} onClick={() => setActiveMedia(item)}>{item.contentType.startsWith("image/") ? <img src={mediaUrl(item)} alt={item.title} /> : <video src={mediaUrl(item)} muted />}<span><small>{item.category}</small><b>{item.title}</b></span></button>)}</div> : <div className="empty-library"><ImagePlus /><strong>Próximamente</strong><p>Acá se incorporarán el lote seleccionado, los renders, las plantas y las vistas.</p></div>}{documents.length > 0 && <div className="documents">{documents.map((item) => <a key={item.id} href={api.mediaUrl(item)} target="_blank"><FileText /><span><small>{item.category}</small><b>{item.title}</b></span><ArrowRight /></a>)}</div>}</section>
    <section className="faq section"><p className="eyebrow">ANTES DE INVERTIR</p><h2>Las preguntas, sin vueltas.</h2><div className="faq-list">{content.faqs.map((item, index) => <details key={`${item.question}-${index}`} open={index === 0}><summary>{item.question}<ChevronDown /></summary><p>{item.answer}</p></details>)}</div></section>
    <InvestorSurvey />
    <section className="contact section" id="contacto"><div><p className="eyebrow">BELFAST DESARROLLOS</p><h2>{content.ctaTitle}</h2><p>{content.ctaBody}</p></div><div className="contact-actions"><a className="primary light" href={whatsappUrl} target={content.whatsapp ? "_blank" : void 0}>Solicitar información<ArrowRight /></a>{content.email && <a href={`mailto:${content.email}`}>{content.email}</a>}</div></section>
    <footer><div className="brand"><img className="brand-logo" src={logoImg} alt="Belfast" /><span><b>BELFAST</b><small>DESARROLLOS</small></span></div><p>{content.disclaimer}</p>{updatedAt && <small>Última actualización: {new Date(updatedAt).toLocaleDateString("es-AR")}</small>}</footer>

    {loginOpen && <LoginBox onClose={() => setLoginOpen(false)} onDone={async () => { setLoginOpen(false); await refresh(); }} />}
    {activeMedia && <div className="viewer"><button className="viewer-close" onClick={() => setActiveMedia(null)}><X />Volver</button>{activeMedia.contentType.startsWith("image/") ? <img src={mediaUrl(activeMedia)} alt={activeMedia.title} /> : activeMedia.contentType === "application/pdf" ? <iframe title={activeMedia.title} src={mediaUrl(activeMedia)} /> : <video src={mediaUrl(activeMedia)} controls autoPlay />}<div><small>{activeMedia.category}</small><strong>{activeMedia.title}</strong>{activeMedia.caption && <p>{activeMedia.caption}</p>}</div></div>}
    {editing && <AdminPanel draft={draft} setDraft={setDraft} setField={setField} save={save} close={() => setEditing(false)} saveState={saveState} upload={upload} uploading={uploading} uploadCategory={uploadCategory} setUploadCategory={setUploadCategory} media={media} deleteMedia={deleteMedia} />} 
  </main>;
}
const parseNum = (s) => Number(String(s ?? "").replace(/[^\d]/g, "")) || 0;
const usd = (n) => "USD " + Math.round(n).toLocaleString("es-AR");
function FundingSim({ content, resumen }) {
  const goal = parseNum(content.fundingGoal);
  const committed = parseNum(content.fundingCommitted);
  const pct = Math.min(100, Math.max(5, parseNum(content.simInitialPct) || 30));
  const cuotas = parseNum(content.installments) || 24;
  const [aporte, setAporte] = useState(50000);
  const inicial = aporte * pct / 100;
  const cuota = (aporte - inicial) / cuotas;
  const part = goal > 0 ? aporte / goal * 100 : null;
  const avance = goal > 0 ? Math.min(100, committed / goal * 100) : 0;
  return <section className="sim section" id="simulador">
    <div><p className="eyebrow">CÓMO QUEDARÍA TU APORTE</p><h2>Simulá tu participación.</h2><p className="lead">Elegí un monto de referencia y mirá cómo se compondrían el aporte inicial y las cuotas. Es una simulación orientativa: los valores definitivos se fijarán en el contrato de fideicomiso.</p></div>
    <div className="sim-box">
      {goal > 0 && <div className="sim-meter"><div className="sim-meter-top"><span>Objetivo de la ronda</span><b>{usd(goal)}</b></div><div className="sim-bar"><i style={{ width: `${avance}%` }} /></div><div className="sim-meter-bot"><span>{committed > 0 ? `${usd(committed)} comprometidos (${Math.round(avance)}%)` : "Ronda abierta"}</span>{resumen.interesados > 0 && <span>{resumen.interesados} {resumen.interesados === 1 ? "persona ya manifestó" : "personas ya manifestaron"} interés</span>}</div></div>}
      <label className="sim-field"><span>Monto de aporte total (USD)</span><input type="range" min={5000} max={goal > 0 ? Math.max(5000, Math.min(goal, 500000)) : 300000} step={1000} value={aporte} onChange={(e) => setAporte(Number(e.target.value))} /><b>{usd(aporte)}</b></label>
      <div className="sim-results">
        <div><small>Aporte inicial ({pct}%)</small><strong>{usd(inicial)}</strong></div>
        <div><small>{cuotas} cuotas de</small><strong>{usd(cuota)}</strong></div>
        {part !== null && <div><small>Participación estimada</small><strong>{part < 0.1 ? "<0,1" : part.toFixed(part < 10 ? 2 : 1).replace(".", ",")}%</strong></div>}
      </div>
      <p className="sim-note">Simulación ilustrativa con valores a confirmar. No constituye oferta ni promesa de rentabilidad.</p>
      <a className="primary" href="#tu-inversion">Quiero que me contacten <ArrowRight size={18} /></a>
    </div>
  </section>;
}

function Metric({ label, value }) {
  return <article><small>{label}</small><strong>{value}</strong></article>;
}
function AdminPanel({ draft, setDraft, setField, save, close, saveState, upload, uploading, uploadCategory, setUploadCategory, media, deleteMedia }) {
  const [fileTitle, setFileTitle] = useState("");
  const [fileCaption, setFileCaption] = useState("");
  const fields = [["fundingGoal", "Objetivo de fondos de la ronda (USD, solo números)"], ["fundingCommitted", "Fondos ya comprometidos (USD, solo números)"], ["simInitialPct", "% de aporte inicial para el simulador"], ["experienceTitle", "T\xEDtulo sobre la experiencia"], ["experienceBody", "Experiencia de los socios", true], ["distributionBody", "Plantas y distribuci\xF3n", true], ["amenitiesBody", "Amenities y servicios", true], ["profileBody", "Qu\xE9 buscamos y perfil del desarrollo", true], ["projectName", "Nombre del proyecto"], ["stageLabel", "Etapa actual"], ["heroTitle", "T\xEDtulo principal"], ["heroSubtitle", "Introducci\xF3n", true], ["location", "Ubicaci\xF3n"], ["conceptTitle", "T\xEDtulo de la propuesta"], ["conceptBody", "Descripci\xF3n de la propuesta", true], ["modelTitle", "Modalidad"], ["modelBody", "Explicaci\xF3n del fideicomiso", true], ["initialContribution", "Aporte inicial"], ["installments", "Cantidad de cuotas"], ["investmentTicket", "Ticket estimado"], ["projectTerm", "Plazo estimado"], ["currency", "Moneda"], ["returnReference", "Retorno de referencia"], ["productTitle", "T\xEDtulo del producto"], ["productBody", "Descripci\xF3n del producto", true], ["unitsReference", "Unidades"], ["sellableAreaReference", "Superficie vendible"], ["amenitiesReference", "Amenities"], ["trustTitle", "T\xEDtulo del seguimiento"], ["trustBody", "Explicaci\xF3n del seguimiento", true], ["ctaTitle", "T\xEDtulo de contacto"], ["ctaBody", "Texto de contacto", true], ["whatsapp", "WhatsApp con c\xF3digo de pa\xEDs"], ["email", "Email"], ["disclaimer", "Aclaraci\xF3n legal", true]];
  return <div className="admin-shell"><div className="admin-head"><div><small>MODO BELFAST</small><h2>Editar presentación</h2></div><button onClick={close}><X /></button></div><div className="admin-body">
    <section><h3>Contenido general</h3><div className="admin-fields">{fields.map(([key, label, long]) => <label key={key}><span>{label}</span>{long ? <textarea value={String(draft[key])} onChange={(e) => setField(key, e.target.value)} /> : <input value={String(draft[key])} onChange={(e) => setField(key, e.target.value)} />}</label>)}</div></section>
    <section><h3>Etapas del proyecto</h3>{draft.milestones.map((item, index) => <div className="repeat-row" key={index}><input value={item.title} onChange={(e) => setDraft((c) => ({ ...c, milestones: c.milestones.map((x, i) => i === index ? { ...x, title: e.target.value } : x) }))} /><input value={item.detail} onChange={(e) => setDraft((c) => ({ ...c, milestones: c.milestones.map((x, i) => i === index ? { ...x, detail: e.target.value } : x) }))} /><select value={item.status} onChange={(e) => setDraft((c) => ({ ...c, milestones: c.milestones.map((x, i) => i === index ? { ...x, status: e.target.value } : x) }))}><option>Completado</option><option>En curso</option><option>Próximo</option></select></div>)}</section>
    <section><h3>Preguntas frecuentes</h3>{draft.faqs.map((item, index) => <div className="repeat-row faq-edit" key={index}><input value={item.question} onChange={(e) => setDraft((c) => ({ ...c, faqs: c.faqs.map((x, i) => i === index ? { ...x, question: e.target.value } : x) }))} /><textarea value={item.answer} onChange={(e) => setDraft((c) => ({ ...c, faqs: c.faqs.map((x, i) => i === index ? { ...x, answer: e.target.value } : x) }))} /></div>)}</section>
    <section><h3>Imágenes, videos y documentos</h3><p>Elegí Plantas, Amenities o Perfil para que el archivo aparezca también en su sección del proyecto.</p><div className="admin-fields"><label><span>Título del material (opcional)</span><input value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} placeholder="Ej.: Departamento 2 ambientes · 58 m²" /></label><label><span>Descripción del material</span><textarea value={fileCaption} onChange={(e) => setFileCaption(e.target.value)} placeholder="Distribución, superficie, orientación o detalle del amenity" /></label></div><div className="upload-row"><select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}><option>Renders</option><option>Plantas</option><option>Amenities</option><option>Perfil</option><option>Vistas</option><option>Lote</option><option>Documentación</option><option>Avances</option></select><label className="upload-button"><Upload />{uploading ? "Subiendo\u2026" : "Subir varios archivos"}<input type="file" multiple accept="image/*,video/*,application/pdf" disabled={uploading} onChange={(e) => upload(e.target.files, fileTitle, fileCaption)} /></label></div><div className="admin-media">{media.map((item) => <article key={item.id}><span><small>{item.category}</small><b>{item.title}</b></span><button onClick={() => deleteMedia(item)}><Trash2 /></button></article>)}</div></section>
    <SurveyInbox />
  </div><div className="admin-footer"><span>{saveState}</span><button onClick={save}>Guardar y publicar cambios</button></div></div>;
}
function LoginBox({ onClose, onDone }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e) => { e.preventDefault(); setBusy(true); setErr(""); try { await api.login(email.trim(), pass); await onDone(); } catch (x) { setErr(x.message); } setBusy(false); };
  return <div className="viewer" style={{ display: "grid", placeItems: "center" }}><form onSubmit={go} style={{ background: "#fff", color: "#20201e", padding: 28, borderRadius: 14, width: "min(92vw,380px)", display: "grid", gap: 12 }}><strong style={{ fontSize: 18 }}>Acceso Belfast</strong><input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: 12, border: "1px solid #ded8cf", borderRadius: 8 }} /><input type="password" required placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} style={{ padding: 12, border: "1px solid #ded8cf", borderRadius: 8 }} />{err && <small style={{ color: "#b91c1c" }}>{err}</small>}<button className="primary" disabled={busy}>{busy ? "Ingresando\u2026" : "Ingresar"}</button><button type="button" onClick={onClose} style={{ background: "none", border: 0, color: "#74716b" }}>Cancelar</button></form></div>;
}
export {
  Home as default
};
