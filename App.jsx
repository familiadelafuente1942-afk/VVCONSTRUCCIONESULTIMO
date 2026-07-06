import React, { useState, useRef, useEffect, useCallback, memo } from "react";

// ── SUPABASE CONFIG ─────────────────────────────────────────────
const SUPA_URL = "https://bxhjgxzvayszfqwlwinq.supabase.co";
const ONESIGNAL_APP_ID = ""; // ← Pegá acá tu App ID de OneSignal (después de crear la app en OneSignal)
function initPush(appTag) {
  if (!ONESIGNAL_APP_ID || typeof window === "undefined") return;
  try {
    if (document.getElementById("onesignal-sdk")) return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const s = document.createElement("script");
    s.id = "onesignal-sdk"; s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"; s.defer = true;
    document.head.appendChild(s);
    window.OneSignalDeferred.push(async function (OneSignal) {
      try { await OneSignal.init({ appId: ONESIGNAL_APP_ID, allowLocalhostAsSecureOrigin: true }); } catch (e) {}
      try { await OneSignal.User.addTag("app", appTag); } catch (e) {}
      try { OneSignal.Slidedown.promptPush(); } catch (e) {}
    });
  } catch (e) {}
}
async function pushNotify(title, message, app, url) {
  try { await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title || "Novedad", message: message || "", app: app || "", url: url || "" }) }); } catch (e) {}
}

const SUPA_KEY = "sb_publishable_13lg1fm-zw7UHvCkVPdFFQ_07TSH4i5";
const SH = () => ({ "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY });

// Storage adapter: Supabase (cloud) con fallback a localStorage
// ── STORAGE ROBUSTO ────────────────────────────────────────────────────
// Principio: localStorage es la fuente de verdad local (síncrona, instantánea).
// Supabase es la nube (asíncrona, para sincronización entre dispositivos).
// NUNCA se pisa un dato nuevo con uno viejo del servidor.

const storage = {
    // Escribe SIEMPRE en localStorage primero (síncrono, instantáneo)
    // Luego intenta Supabase en background sin bloquear
    set: async (key, value) => {
        // 1. localStorage primero — nunca falla, inmediato
        try { localStorage.setItem(key, value); } catch { }
        // 2. Supabase en background
        try {
            await fetch(SUPA_URL + "/rest/v1/bco_storage", {
                method: "POST",
                headers: { ...SH(), "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify({ key, value })
            });
        } catch { }
        return { value };
    },
    // Lee: intenta Supabase, fallback a localStorage
    get: async (key) => {
        try {
            const r = await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key) + "&select=value&limit=1", {
                method: "GET", headers: SH(), mode: "cors"
            });
            if (r.ok) { const d = await r.json(); if (d && d.length > 0) return { value: d[0].value }; }
        } catch { }
        // Fallback localStorage
        try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; }
    },
    // Lee SOLO desde localStorage — síncrono, cero latencia
    getLocal: (key) => {
        try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; }
    },
    delete: async (key) => {
        try { localStorage.removeItem(key); } catch { }
        try { await fetch(SUPA_URL + "/rest/v1/bco_storage?key=eq." + encodeURIComponent(key), { method: "DELETE", headers: SH() }); } catch { }
        return { deleted: true };
    },
    list: async (prefix) => {
        try {
            const url = prefix ? SUPA_URL + "/rest/v1/bco_storage?key=like." + encodeURIComponent(prefix) + "*&select=key" : SUPA_URL + "/rest/v1/bco_storage?select=key";
            const r = await fetch(url, { headers: SH() });
            if (r.ok) { const d = await r.json(); return { keys: d.map(x => x.key) }; }
        } catch { }
        try { return { keys: Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix)) }; } catch { return { keys: [] }; }
    }
};

// ── SUPABASE STORAGE (bucket bcm-media) ─────────────────────────────
// Las fotos se suben como archivos reales al bucket público.
// La URL pública reemplaza al base64 — reduce el egress drásticamente.
const SUPA_BUCKET = "bco-media";
const SUPA_STORAGE_URL = SUPA_URL + "/storage/v1";

const mediaStorage = {
    // Subir un archivo (recibe dataURL base64) → devuelve URL pública
    upload: async (path, dataUrl) => {
        try {
            // Convertir dataURL a Blob
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const ext = blob.type.split('/')[1] || 'jpg';
            const filePath = `${path}.${ext}`;

            // Subir al bucket
            const r = await fetch(`${SUPA_STORAGE_URL}/object/${SUPA_BUCKET}/${filePath}`, {
                method: "POST",
                headers: {
                    "apikey": SUPA_KEY,
                    "Authorization": "Bearer " + SUPA_KEY,
                    "Content-Type": blob.type,
                    "x-upsert": "true"
                },
                body: blob
            });
            if (!r.ok) return null;
            // Devolver URL pública
            return `${SUPA_STORAGE_URL}/object/public/${SUPA_BUCKET}/${filePath}`;
        } catch { return null; }
    },
    // Eliminar archivo del bucket
    remove: async (path) => {
        try {
            await fetch(`${SUPA_STORAGE_URL}/object/${SUPA_BUCKET}/${path}`, {
                method: "DELETE",
                headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY }
            });
        } catch { }
    },
    // Detectar si una URL es del bucket (ya subida) o base64 local
    isRemoteUrl: (url) => url && (url.startsWith('http://') || url.startsWith('https://')),
};

// Wrapper que sube una foto al bucket y devuelve la URL pública.
// Si falla el upload (sin internet, bucket no existe), devuelve el base64 como fallback.
async function uploadFoto(dataUrl, carpeta, nombre) {
    if (!dataUrl) return null;
    // Si ya es URL remota, no re-subir
    if (mediaStorage.isRemoteUrl(dataUrl)) return dataUrl;
    const path = `${carpeta}/${nombre || uid()}`;
    const remoteUrl = await mediaStorage.upload(path, dataUrl);
    return remoteUrl || dataUrl; // fallback a base64 si falla
}
// Comprime/redimensiona una imagen (dataURL) para que pese poco antes de subirla.
// Una foto de celular de 4-8 MB queda en ~200-400 KB. Esto hace la subida confiable
// y evita inflar la base de datos si llegara a caer a base64.
function compressImage(dataUrl, maxDim = 1600, quality = 0.7) {
    return new Promise((resolve) => {
        try {
            if (!dataUrl || !dataUrl.startsWith("data:image")) { resolve(dataUrl); return; }
            const img = new Image();
            img.onload = () => {
                try {
                    let { width, height } = img;
                    if (width > maxDim || height > maxDim) {
                        if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
                        else { width = Math.round(width * maxDim / height); height = maxDim; }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/jpeg", quality));
                } catch { resolve(dataUrl); }
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        } catch { resolve(dataUrl); }
    });
}
// Si la URL trae ?sync=, esta carga prioriza SIEMPRE la nube (trae lo último cargado)
const FORCE_CLOUD = (() => { try { return new URLSearchParams(window.location.search).has("sync"); } catch { return false; } })();
// Marca de última escritura local por clave (para no pisar un cambio recién hecho al sincronizar)
const lastWrite = {};
// Carga desde localStorage SINCRÓNICAMENTE (sin flash), persiste en ambos lados
function useStoredState(key, defaultValue) {
    const [state, setState] = useState(() => {
        const local = storage.getLocal(key);
        if (local?.value) { try { return JSON.parse(local.value); } catch { } }
        return defaultValue;
    });
    const [cloudSynced, setCloudSynced] = useState(false);

    // Al montar: sincronizar con Supabase una sola vez
    useEffect(() => {
        (async () => {
            try {
                const r = await storage.get(key);
                if (r?.value) {
                    const cloudData = JSON.parse(r.value);
                    if (FORCE_CLOUD) {
                        // Forzar la versión de la nube (lo último cargado por cualquier dispositivo)
                        setState(cloudData);
                        try { localStorage.setItem(key, r.value); } catch { }
                    } else {
                        // Uso normal: la nube gana solo si tiene más datos que el local
                        setState(local => {
                            const localSize = JSON.stringify(local).length;
                            const cloudSize = JSON.stringify(cloudData).length;
                            return cloudSize > localSize ? cloudData : local;
                        });
                    }
                }
            } catch { }
            setCloudSynced(true);
        })();
    }, [key]);

    // Persiste cada vez que cambia el estado
    const setAndPersist = useCallback((updater) => {
        setState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            // Guardar inmediatamente en ambos lados
            const json = JSON.stringify(next);
            lastWrite[key] = Date.now();
            try { localStorage.setItem(key, json); } catch { }
            storage.set(key, json).catch(() => {});
            return next;
        });
    }, [key]);

    return [state, setAndPersist, cloudSynced];
}

// ── CONSTANTES ─────────────────────────────────────────────────────────
const AIRPORTS = [{ id: "norte", code: "NORTE", name: "Zona Norte" }, { id: "sur", code: "SUR", name: "Zona Sur" }];
const LIC_ESTADOS = [{ id: "visitar", label: "A Visitar", color: "#F59E0B", bg: "#FFFBEB" }, { id: "presupuesto", label: "Presupuesto", color: "#3B82F6", bg: "#EFF6FF" }, { id: "curso", label: "En Curso", color: "#8B5CF6", bg: "#F5F3FF" }, { id: "presentada", label: "Presentada", color: "#F97316", bg: "#FFF7ED" }, { id: "adjudicada", label: "Adjudicada", color: "#10B981", bg: "#ECFDF5" }, { id: "descartada", label: "Descartada", color: "#EF4444", bg: "#FEF2F2" }];
const OBRA_ESTADOS = [{ id: "pendiente", label: "Pendiente", color: "#94A3B8", bg: "#F8FAFC" }, { id: "curso", label: "En Curso", color: "#10B981", bg: "#ECFDF5" }, { id: "pausada", label: "Pausada", color: "#F59E0B", bg: "#FFFBEB" }, { id: "terminada", label: "Terminada", color: "#6366F1", bg: "#EEF2FF" }];
const ROLES = ["Jefe de Obra", "Capataz", "Técnico", "Proveedor", "Contratista", "Administrativo"];
const DOC_TYPES = [{ id: "art", label: "ART", acceptsExp: true }, { id: "antec", label: "Antecedentes", acceptsExp: false }, { id: "preoc", label: "Preocupacional", acceptsExp: true }, { id: "dni", label: "DNI", acceptsExp: false }, { id: "sicop", label: "SiCoP", acceptsExp: false }, { id: "alta", label: "Alta Temprana", acceptsExp: false }];
const LIC_DOC_TYPES = [{ id: "planos", label: "Planos", accept: ".pdf,.png,.jpg,.dwg,.zip" }, { id: "pliego", label: "Pliego", accept: ".pdf,.doc,.docx" }, { id: "excel", label: "Excel", accept: ".xlsx,.xls,.csv,.pdf" }, { id: "otros", label: "Otros", accept: "*" }];
const EMAIL_IA = "ia.vvcon@gmail.com";
const ADMIN_CREDS = [{ user: "admin", pass: "belfast2025", rol: "Administrador", nivel: "directivo" }, { user: "supervisor", pass: "obra2025", rol: "Supervisor", nivel: "directivo" }];
const USERS = ADMIN_CREDS;

function isDirectivo(user) {
    if (!user) return false;
    const nivel = user.nivel || '';
    const rol = (user.rol || '').toLowerCase();
    return nivel === 'directivo' || ['administrador', 'supervisor', 'gerente', 'director'].some(r => rol.includes(r));
}

// ── TEMA ───────────────────────────────────────────────────────────────
const THEME_PRESETS = [
    { id: "azul", label: "Azul", accent: "#1D4ED8", al: "#EFF6FF", bg: "#F1F5F9", card: "#fff", border: "#E2E8F0", text: "#0F172A", sub: "#475569", muted: "#94A3B8", navy: "#0F172A" },
    { id: "oscuro", label: "Oscuro", accent: "#60A5FA", al: "#172554", bg: "#0F172A", card: "#1E293B", border: "#334155", text: "#F1F5F9", sub: "#94A3B8", muted: "#475569", navy: "#020617" },
    { id: "verde", label: "Verde", accent: "#16A34A", al: "#DCFCE7", bg: "#F0FDF4", card: "#fff", border: "#BBF7D0", text: "#0F172A", sub: "#475569", muted: "#94A3B8", navy: "#14532D" },
    { id: "violeta", label: "Violeta", accent: "#7C3AED", al: "#F5F3FF", bg: "#FAF5FF", card: "#fff", border: "#E9D5FF", text: "#0F172A", sub: "#475569", muted: "#94A3B8", navy: "#3B0764" },
    { id: "rojo", label: "Rojo", accent: "#DC2626", al: "#FEF2F2", bg: "#FFF5F5", card: "#fff", border: "#FECACA", text: "#0F172A", sub: "#475569", muted: "#94A3B8", navy: "#7F1D1D" },
    { id: "naranja", label: "Naranja", accent: "#EA580C", al: "#FFF7ED", bg: "#FFFBF5", card: "#fff", border: "#FED7AA", text: "#0F172A", sub: "#475569", muted: "#94A3B8", navy: "#431407" },
    { id: "minimal", label: "Mínimal", accent: "#111111", al: "#F5F5F5", bg: "#FAFAFA", card: "#fff", border: "#E8E8E8", text: "#111", sub: "#555", muted: "#aaa", navy: "#111" },
    { id: "cyan", label: "Cyan", accent: "#0891B2", al: "#ECFEFF", bg: "#F0FDFF", card: "#fff", border: "#A5F3FC", text: "#0F172A", sub: "#475569", muted: "#94A3B8", navy: "#164E63" },
    { id: "rosa", label: "Rosa", accent: "#DB2777", al: "#FDF2F8", bg: "#FDF4FF", card: "#fff", border: "#FBCFE8", text: "#0F172A", sub: "#475569", muted: "#94A3B8", navy: "#500724" },
];
const FONTS = [
    { id: "jakarta", label: "Jakarta", value: "'Plus Jakarta Sans'" },
    { id: "inter", label: "Inter", value: "'Inter'" },
    { id: "poppins", label: "Poppins", value: "'Poppins'" },
    { id: "roboto", label: "Roboto", value: "'Roboto'" },
    { id: "montserrat", label: "Montserrat", value: "'Montserrat'" },
    { id: "system", label: "Sistema", value: "-apple-system,BlinkMacSystemFont" },
];
const RADIUS_OPTS = [{ id: "sharp", label: "Recto", r: 4 }, { id: "normal", label: "Normal", r: 14 }, { id: "suave", label: "Suave", r: 20 }, { id: "round", label: "Redondo", r: 28 }];
const COLOR_KEYS = [{ k: "accent", label: "Principal" }, { k: "bg", label: "Fondo" }, { k: "card", label: "Tarjetas" }, { k: "text", label: "Texto" }, { k: "navy", label: "Encabezado" }, { k: "border", label: "Bordes" }];
const DEFAULT_COLORS = { accent: "#1D4ED8", al: "#EFF6FF", bg: "#F1F5F9", card: "#ffffff", border: "#E2E8F0", text: "#0F172A", sub: "#475569", muted: "#94A3B8", navy: "#0F172A" };
const DEFAULT_UBICACIONES = [{ id: "norte", code: "NORTE", name: "Zona Norte" }, { id: "sur", code: "SUR", name: "Zona Sur" }, { id: "oeste", code: "OESTE", name: "Zona Oeste" }, { id: "caba", code: "CABA", name: "Ciudad de Buenos Aires" }];

const DEFAULT_TEXTOS = {
    nav_ia: "IA", nav_inicio: "Inicio", nav_obras: "Obras", nav_personal: "Personal", nav_cargar: "Cargar", nav_mas: "Más",
    dash_titulo: "Panel operativo", dash_subtitulo: "V+V Construcciones",
    dash_proyectoes: "Proyectos", dash_obras_activas: "Obras activas", dash_alertas: "Alertas", dash_personal: "Personal",
    dash_obras_curso: "Obras en curso", dash_ver_todas: "Ver todas →", dash_acciones: "Acciones rápidas",
    dash_nueva_lic: "Nueva proyecto", dash_nueva_obra: "Nueva obra", dash_presup_mat: "Presupuesto materiales", dash_subcontratos: "Subcontratos",
    obras_titulo: "Obras", obras_nueva: "Nueva obra", obras_avance: "Avance", obras_inicio: "Inicio", obras_cierre: "Cierre est.",
    obras_sector: "Sector", obras_estado: "Estado", obras_info: "Info", obras_notas: "Notas", obras_fotos: "Fotos", obras_archivos: "Archivos",
    obras_obs_placeholder: "Registrar observación...", obras_sin_notas: "Sin notas", obras_sin_fotos: "Sin fotos", obras_sin_archivos: "Sin archivos",
    obras_agregar_fotos: "Agregar fotos", obras_agregar_arch: "Agregar archivo", obras_eliminar: "Eliminar obra",
    lic_titulo: "Proyectos", lic_nueva: "Nueva proyecto", lic_nombre: "Nombre", lic_monto: "Monto", lic_fecha: "Fecha", lic_sector: "Sector",
    lic_crear: "Crear proyecto", lic_eliminar: "Eliminar",
    pers_titulo: "Personal de Obra", pers_nuevo: "Nuevo trabajador", pers_nombre: "Nombre", pers_rol: "Rol", pers_empresa: "Empresa",
    pers_obra: "Obra", pers_whatsapp: "WhatsApp", pers_documentacion: "Documentación", pers_sin_personal: "Sin personal registrado",
    pers_eliminar: "Eliminar trabajador", pers_agregar: "Agregar",
    carg_titulo: "Registro de Avance", carg_sub: "Fotos + Informe IA", carg_sel_obra: "Seleccioná la obra",
    carg_fotos: "Cargá fotos nuevas", carg_tomar: "Tomar foto", carg_galeria: "Galería / PC",
    carg_generar: "Comparar y generar informe", carg_analizando: "Analizando...",
    carg_informe: "Informe generado", carg_nuevo: "+ Nuevo", carg_descargar: "⬇ Descargar",
    chat_titulo: "Asistente IA", chat_placeholder: "Escribí o usá el micrófono…",
    chat_hablar: "Hablar", chat_escuchando: "Escuchando…", chat_pausar: "Pausar", chat_voz_auto: "Voz auto",
    mas_titulo: "Más opciones", mas_config: "Configuración", mas_config_sub: "Estética · Logos · Empresa · Admin",
    mas_cerrar_sesion: "Cerrar sesión",
    cfg_cuenta: "Cuenta y empresa", cfg_tema: "Tema visual", cfg_tipografia: "Tipografía",
    cfg_forma: "Forma de los elementos", cfg_logos: "Logos y textos", cfg_textos: "Textos de la app",
    cfg_guardar: "✓ Guardar y cerrar", cfg_restaurar: "↺ Restaurar tema por defecto",
};

const DEFAULT_CONFIG = { email: EMAIL_IA, empresa: "V+V Construcciones", cargo: "Gerencia de Obra", telefono: "", ciudad: "Buenos Aires, Argentina", logoEmpresa2: "", logoEmpresa: "", logoAsistente: "", logoCentral: "", tituloAsistente: "Asistente V+V Construcciones", subtituloAsistente: "Lee todos los datos de la app en tiempo real", themeId: "azul", colors: { ...DEFAULT_COLORS }, fontId: "jakarta", radiusId: "normal", ubicaciones: DEFAULT_UBICACIONES, labelUbicacion: "Zona/Barrio", textos: { ...DEFAULT_TEXTOS } };

// ── HELPERS ───────────────────────────────────────────────────────────
function t(cfg, key) { return cfg?.textos?.[key] || DEFAULT_TEXTOS[key] || key; }
function getUbics(cfg) { return (cfg?.ubicaciones?.length ? cfg.ubicaciones : DEFAULT_UBICACIONES); }
function getLabelUbic(cfg) { return cfg?.labelUbicacion || "Zona/Barrio"; }
function uid() { return Math.random().toString(36).slice(2, 9); }

function toDataUrl(f, maxW = 1400) {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => {
            if (!f.type.startsWith('image/')) { res(e.target.result); return; }
            const img = new Image();
            img.onload = () => {
                if (img.width <= maxW) { res(e.target.result); return; }
                const c = document.createElement('canvas');
                const ratio = maxW / img.width;
                c.width = maxW; c.height = Math.round(img.height * ratio);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                res(c.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => res(e.target.result);
            img.src = e.target.result;
        };
        reader.onerror = rej;
        reader.readAsDataURL(f);
    });
}
function getBase64(d) { return d.split(',')[1]; }
function getMediaType(d) { const m = d.match(/data:([^;]+);/); return m ? m[1] : 'image/jpeg'; }

// callAI con soporte de web_search real
// useSearch=true activa búsqueda en internet (precios, proveedores, noticias, etc.)
async function callAI(msgs, sys, apiKey, useSearch = false) {
    msgs = (msgs || []).map(m => ({ role: m.role, content: m.content }));
    const body = {
        model: "claude-sonnet-4-6",
        max_tokens: useSearch ? 4096 : 4096,
        messages: msgs,
    };
    if (sys) body.system = sys;
    if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", city: "Buenos Aires", region: "Buenos Aires", country: "AR", timezone: "America/Argentina/Buenos_Aires" } }];

    // Intenta primero el proxy serverless (/api/claude, clave del lado del servidor).
    // Si no existe (hosting estático) cae a la API directa con la key de Configuración.
    async function doFetch(b) {
        try {
            const rp = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
            if (rp.ok) return { ok: true, data: await rp.json() };
            if (rp.status !== 404) {
                try { const e = await rp.json(); return { ok: false, err: e.error?.message || `Error ${rp.status}` }; } catch { return { ok: false, err: `Error ${rp.status}` }; }
            }
        } catch { /* sin proxy: seguimos al modo directo */ }
        if (!apiKey) return { ok: false, err: "⚠ Falta configurar la IA: agregá la API Key en Más → Configuración, o configurá el proxy (variable ANTHROPIC_API_KEY en Vercel)." };
        const headers = { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true", "anthropic-version": "2023-06-01", "x-api-key": apiKey };
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(b) });
        if (!r.ok) { try { const e = await r.json(); return { ok: false, err: e.error?.message || `Error ${r.status}` }; } catch { return { ok: false, err: `Error ${r.status}` }; } }
        return { ok: true, data: await r.json() };
    }

    try {
        const res = await doFetch(body);
        if (!res.ok) return res.err;
        let d = res.data;
        if (d.error) return `Error: ${d.error.message || 'Sin respuesta.'}`;
        // La búsqueda web es del lado del servidor (Anthropic la ejecuta sola).
        // Si la respuesta queda en pausa, se continúa reenviando lo acumulado.
        let guard = 0;
        while (d.stop_reason === 'pause_turn' && guard < 4) {
            guard++;
            const cont = await doFetch({ ...body, messages: [...msgs, { role: 'assistant', content: d.content }] });
            if (!cont.ok || cont.data?.error) break;
            d = cont.data;
        }
        const txt = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        return txt || 'Sin respuesta.';
    } catch (e) {
        return `Error de conexión: ${e.message || 'Revisá la configuración de la IA.'}`;
    }
}

function daysSince(s) { if (!s) return 999; const [d, m, y] = s.split("/"); return Math.ceil((new Date(`20${y}`, m - 1, d) - new Date()) / (1000 * 60 * 60 * 24)); }
function hexLight(hex) { try { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `#${Math.round(r * .12 + 255 * .88).toString(16).padStart(2, '0')}${Math.round(g * .12 + 255 * .88).toString(16).padStart(2, '0')}${Math.round(b * .12 + 255 * .88).toString(16).padStart(2, '0')}`; } catch { return '#EFF6FF'; } }
function buildThemeCSS(cfg) {
    const c = cfg.colors || DEFAULT_COLORS;
    const fv = FONTS.find(f => f.id === cfg.fontId)?.value || "'Plus Jakarta Sans'";
    const rv = RADIUS_OPTS.find(r => r.id === cfg.radiusId)?.r || 14;
    return `:root{--bg:${c.bg};--card:${c.card};--border:${c.border};--text:${c.text};--sub:${c.sub || '#475569'};--muted:${c.muted || '#94A3B8'};--accent:${c.accent};--al:${c.al || hexLight(c.accent)};--navy:${c.navy};--r:${rv}px;--rsm:${Math.max(4, rv - 4)}px;--font:${fv};}`;
}
function parseMontoNum(m) { if (!m) return 0; return parseFloat(String(m).replace(/[^0-9.]/g, '')) || 0; }
function formatMonto(val) {
    const nums = String(val).replace(/[^\d]/g, '');
    if (!nums) return '';
    return nums.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' $';
}
function parseMonto(val) { return String(val).replace(/[^\d]/g, ''); }

const T = { bg: "var(--bg,#F1F5F9)", card: "var(--card,#fff)", border: "var(--border,#E2E8F0)", text: "var(--text,#0F172A)", sub: "var(--sub,#475569)", muted: "var(--muted,#94A3B8)", accent: "var(--accent,#1D4ED8)", accentLight: "var(--al,#EFF6FF)", navy: "var(--navy,#0F172A)", r: "var(--r,14px)", rsm: "var(--rsm,10px)", shadow: "0 1px 2px rgba(16,28,44,.05),0 6px 20px rgba(16,28,44,.06)" };

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Montserrat:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg,#F1F5F9);overscroll-behavior:none;}
  input,textarea,select,button{font-family:var(--font,'Plus Jakarta Sans'),sans-serif;}
  input:focus,textarea:focus,select:focus{outline:none;}textarea{resize:none;}button{cursor:pointer;}::-webkit-scrollbar{display:none;}
  @keyframes up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes scanSweep{0%{top:-100%}100%{top:200%}}
`;

// ── COMPONENTES BASE ─────────────────────────────────────────────────
const VVLogo = ({ size = 44 }) => (
    <svg width={Math.round(size * 1.12)} height={size} viewBox="0 0 278 212" fill="none" stroke="#111" strokeWidth="5.5" strokeLinejoin="miter">
        <polygon points="8,84 98,84 126,54 36,54" />
        <path d="M8,84 L8,200 L98,200 L98,174 L52,174 L52,132 L98,132 L98,117 L57,117 L57,88 L98,88 L98,84 Z" />
        <line x1="98" y1="84" x2="126" y2="54" />
        <rect x="120" y="6" width="150" height="194" />
        <rect x="138" y="22" width="114" height="72" />
        <rect x="179" y="128" width="21" height="72" />
    </svg>
);
const EmpresaSymbol = ({ size = 54 }) => (
    <svg width={size} height={Math.round(size * .52)} viewBox="0 0 130 68" fill="none">
        <ellipse cx="48" cy="34" rx="44" ry="20" stroke="#6b7280" strokeWidth="9" fill="none" />
        <polygon points="22,18 22,50 70,34" fill="#6b7280" />
    </svg>
);
function AppBrand({ cfg }) {
    const lb = cfg?.logoEmpresa2, la = cfg?.logoEmpresa;
    return (
        <div style={{ background: "#fff", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "stretch", flexShrink: 0, minHeight: 72 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px" }}>
                {lb ? <img src={lb} alt="V+V Construcciones" style={{ maxHeight: 54, maxWidth: "100%", objectFit: "contain" }} />
                    : <div style={{ display: "flex", alignItems: "center", gap: 8 }}><VVLogo size={46} /><div style={{ lineHeight: 1.2 }}><div style={{ fontSize: 13, fontWeight: 900, color: "#111", letterSpacing: "0.06em" }}>BELFAST</div><div style={{ fontSize: 8, fontWeight: 600, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>Construction Mgmt</div></div></div>}
            </div>
            <div style={{ width: 1, background: T.border, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px" }}>
                {la ? <img src={la} alt="V+V Construcciones" style={{ maxHeight: 54, maxWidth: "100%", objectFit: "contain" }} />
                    : <div style={{ display: "flex", alignItems: "center", gap: 8 }}><EmpresaSymbol size={58} /><div style={{ lineHeight: 1.35 }}><div style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>zonas</div><div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Argentina</div></div></div>}
            </div>
        </div>
    );
}

function Card({ children, style = {}, onClick }) { return <div onClick={onClick} style={{ background: T.card, borderRadius: T.r, border: `1px solid ${T.border}`, boxShadow: T.shadow, ...style }}>{children}</div>; }
function Badge({ color, bg, children, style = {} }) { return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 20, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.04em", ...style }}>{children}</span>; }
function PBtn({ children, onClick, disabled, full, style = {}, variant = "primary" }) {
    const v = { primary: { background: disabled ? "#E2E8F0" : "var(--accent,#1D4ED8)", color: disabled ? "#94A3B8" : "#fff", boxShadow: disabled ? "none" : "0 2px 8px rgba(0,0,0,.18)", border: "none" }, ghost: { background: "none", border: `1.5px solid ${T.border}`, color: T.sub, boxShadow: "none" }, danger: { background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#EF4444", boxShadow: "none" } };
    return <button onClick={onClick} disabled={disabled} style={{ ...v[variant], borderRadius: T.rsm, padding: "11px 20px", fontSize: 14, fontWeight: 600, width: full ? "100%" : "auto", transition: "all .15s", ...style }}>{children}</button>;
}
function Sheet({ title, onClose, children }) { return (<div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 200, display: "flex", alignItems: "flex-end", backdropFilter: "blur(2px)" }}><div style={{ background: T.card, borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "90vh", overflow: "auto", animation: "up .25s ease", paddingBottom: 32 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}><span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{title}</span><button onClick={onClose} style={{ background: T.bg, border: "none", borderRadius: 20, width: 32, height: 32, fontSize: 18, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button></div><div style={{ padding: "14px 20px 0" }}>{children}</div></div></div>); }
function Lbl({ children }) { return <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{children}</div>; }
function TInput({ value, onChange, placeholder, type = "text", extraStyle = {} }) { return <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text, ...extraStyle }} />; }
function Sel({ value, onChange, children }) { return <select value={value} onChange={onChange} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }}>{children}</select>; }
function FieldRow({ children }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>{children}</div>; }
function Field({ label, children }) { return <div style={{ marginBottom: 12 }}><Lbl>{label}</Lbl>{children}</div>; }
function PlusBtn({ onClick }) { return <button onClick={onClick} style={{ background: "var(--accent,#1D4ED8)", color: "#fff", border: "none", borderRadius: 20, width: 34, height: 34, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>+</button>; }
function AppHeader({ title, sub, right, back, onBack }) { return (<div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "12px 18px", flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{back && <button onClick={onBack} style={{ background: T.bg, border: "none", borderRadius: 10, width: 32, height: 32, fontSize: 16, color: T.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>}<div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>{title}</div>{sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{sub}</div>}</div>{right}</div></div>); }

function MontoInput({ value, onChange, placeholder }) {
    const [display, setDisplay] = useState(value ? formatMonto(parseMonto(value)) : value || '');
    useEffect(() => { setDisplay(value ? formatMonto(parseMonto(value)) : value || ''); }, [value]);
    function handleChange(e) {
        const raw = parseMonto(e.target.value);
        const fmt = raw ? formatMonto(raw) : '';
        setDisplay(fmt);
        onChange(fmt);
    }
    return <input value={display} onChange={handleChange} placeholder={placeholder || '0 $'} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} />;
}

function LoginModal({ titulo, onSuccess, onClose }) {
    const [u, setU] = useState('');
    const [p, setP] = useState('');
    const [err, setErr] = useState('');
    const [showPass, setShowPass] = useState(false);
    function login() {
        const usuario = u.trim().toLowerCase();
        const contra = p.trim();
        if (!usuario || !contra) { setErr('Completá usuario y contraseña'); return; }
        const f = ADMIN_CREDS.find(c => c.user === usuario && c.pass === contra);
        if (f) { setErr(''); onSuccess(f); } else { setErr('Usuario o contraseña incorrectos'); }
    }
    return (<Sheet title={titulo || "Acceso requerido"} onClose={onClose}>
        <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#15803D"><path fillRule="evenodd" clipRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" /></svg>
            <span style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>Área protegida – Acceso administrativo</span>
        </div>
        <Field label="Usuario">
            <input value={u} onChange={e => { setU(e.target.value); setErr(''); }} placeholder="Ingresá tu usuario"
                autoCapitalize="none" autoCorrect="off" autoComplete="username"
                onKeyDown={e => e.key === 'Enter' && login()}
                style={{ width: "100%", background: T.bg, border: `1.5px solid ${err ? '#FECACA' : T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} />
        </Field>
        <Field label="Contraseña">
            <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={p} onChange={e => { setP(e.target.value); setErr(''); }}
                    placeholder="••••••••" autoComplete="current-password"
                    onKeyDown={e => e.key === 'Enter' && login()}
                    style={{ width: "100%", background: T.bg, border: `1.5px solid ${err ? '#FECACA' : T.border}`, borderRadius: T.rsm, padding: "11px 44px 11px 14px", fontSize: 14, color: T.text }} />
                <button onClick={() => setShowPass(v => !v)} type="button"
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: showPass ? "var(--accent,#1D4ED8)" : T.muted, display: "flex", alignItems: "center", padding: 4 }}>
                    {showPass
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" stroke="currentColor" strokeWidth="1.5" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.5" /></svg>
                    }
                </button>
            </div>
        </Field>
        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#EF4444", marginBottom: 12, fontWeight: 600 }}>{err}</div>}
        <PBtn full onClick={login}>Ingresar</PBtn>
    </Sheet>);
}

// ── NAVEGACIÓN ─────────────────────────────────────────────────────────
const NAV_DEFS = [
    { id: "chat", tk: "nav_ia", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" /></svg> },
    { id: "dashboard", tk: "nav_inicio", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.47 3.841a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.061l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 101.061 1.061l8.69-8.69z" /><path d="M12 5.432l8.159 8.159.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198l.091-.086L12 5.432z" /></svg> },
    { id: "obras", tk: "nav_obras", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M4.5 2.25a.75.75 0 000 1.5v16.5h-.75a.75.75 0 000 1.5h16.5a.75.75 0 000-1.5h-.75V3.75a.75.75 0 000-1.5h-15zM9 6a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5H9zm-.75 3.75A.75.75 0 019 9h1.5a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM9 12a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5H9zm3.75-5.25A.75.75 0 0113.5 6H15a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM13.5 9a.75.75 0 000 1.5H15A.75.75 0 0015 9h-1.5zm-.75 3.75a.75.75 0 01.75-.75H15a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM9 19.5v-2.25a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75V19.5H9z" /></svg> },
    { id: "personal", tk: "nav_personal", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg> },
    { id: "cargar", tk: "nav_cargar", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" /><path fillRule="evenodd" clipRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3H6a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-1.5a.75.75 0 100-1.5.75.75 0 000 1.5z" /></svg> },
    { id: "mas", tk: "nav_mas", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M4.5 12a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" /></svg> },
];

function BottomNav({ view, setView, alerts, cfg, badges = {} }) {
    return (<nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", padding: "6px 0 max(8px,env(safe-area-inset-bottom))", zIndex: 100, boxShadow: "0 -2px 16px rgba(0,0,0,.06)" }}>
        {NAV_DEFS.map(n => {
            const active = view === n.id; const badge = n.id === "dashboard" && alerts.length > 0; const cnt = badges[n.id] || 0; const label = t(cfg, n.tk); return (
                <button key={n.id} onClick={() => setView(n.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", color: n.id === "cargar" ? "#fff" : active ? "var(--accent,#1D4ED8)" : T.muted, padding: "4px 0", position: "relative" }}>
                    {n.id === "cargar" ? <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--accent,#1D4ED8)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: -16, boxShadow: "0 4px 14px rgba(0,0,0,.25)", border: `3px solid ${T.card}` }}>{n.icon}</div> : n.icon}
                    <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, color: n.id === "cargar" ? "var(--accent,#1D4ED8)" : undefined }}>{label}</span>
                    {badge && <div style={{ position: "absolute", top: 4, right: "calc(50% - 12px)", width: 7, height: 7, borderRadius: "50%", background: "#EF4444", border: `1.5px solid ${T.card}` }} />}
                    {cnt > 0 && <div style={{ position: "absolute", top: -1, right: "calc(50% - 20px)", minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "#EF4444", color: "#fff", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${T.card}` }}>{cnt > 99 ? "99+" : cnt}</div>}
                </button>
            );
        })}
    </nav>);
}

function Dashboard({ lics, obras, personal, alerts, setView, setDetailObraId, requireAuth, cfg, customIcons = {}, web = false, pedidos = [], onPedidos }) {
    const UBICS = getUbics(cfg);
    const pend = (pedidos || []).filter(p => p.para === "vv" && p.estado !== "resuelto");
    const pendObras = [...new Set(pend.map(p => p.obra_id ? obraNom(obras, p.obra_id) : "general").filter(Boolean))].join(", ");
    return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
        {!web && <div style={{ background: T.navy, padding: "16px 18px 20px" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginBottom: 3 }}>{t(cfg, 'dash_subtitulo')}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{t(cfg, 'dash_titulo')}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
                {[{ l: t(cfg, 'dash_proyectoes'), v: lics.filter(l => !["adjudicada", "descartada"].includes(l.estado)).length, c: "#7E9CB8" }, { l: t(cfg, 'dash_obras_activas'), v: obras.filter(o => o.estado === "curso").length, c: "#5E8C7B" }, { l: t(cfg, 'dash_alertas'), v: alerts.length, c: "#B0894F" }, { l: t(cfg, 'dash_personal'), v: personal.length, c: "#8A8FA3" }].map(k => (
                    <div key={k.l} style={{ background: "rgba(255,255,255,.08)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: k.c }}>{k.v}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,.5)", marginTop: 2, lineHeight: 1.3 }}>{k.l}</div>
                    </div>
                ))}
            </div>
        </div>}
        <div style={{ padding: web ? "18px 18px 14px" : "14px 18px" }}>
            {pend.length > 0 && <div onClick={onPedidos} style={{ display: "flex", alignItems: "center", gap: 11, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", marginBottom: 16, cursor: "pointer" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EF4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{pend.length}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>{pend.length} pedido{pend.length > 1 ? "s" : ""} pendiente{pend.length > 1 ? "s" : ""} de respuesta</div>
                    <div style={{ fontSize: 11.5, color: "#B91C1C", marginTop: 1 }}>{pendObras ? `Obras: ${pendObras}` : "Tocá para ver"} →</div>
                </div>
            </div>}
            {alerts.length > 0 && (<div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Alertas ({alerts.length})</div>
                    <button onClick={() => setView("seguimiento")} style={{ fontSize: 12, color: T.accent, background: "none", border: "none", fontWeight: 600, cursor: "pointer" }}>Ver todas →</button>
                </div>
                {/* Alertas de alta prioridad primero */}
                {alerts.filter(a => a.prioridad === 'alta').slice(0, 5).map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444", flexShrink: 0, marginTop: 4 }} />
                        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, flex: 1 }}>{a.msg}</div>
                    </div>
                ))}
                {/* Alertas medias (máx 4) */}
                {alerts.filter(a => a.prioridad === 'media').slice(0, 4).map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flexShrink: 0, marginTop: 4 }} />
                        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5, flex: 1 }}>{a.msg}</div>
                    </div>
                ))}
                {alerts.filter(a => a.prioridad === 'media').length > 4 && (
                    <button onClick={() => setView("seguimiento")} style={{ width: "100%", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px", fontSize: 12, color: "#92400E", fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
                        + {alerts.filter(a => a.prioridad === 'media').length - 4} alertas más → Ver seguimiento
                    </button>
                )}
            </div>)}
            {alerts.length === 0 && (
                <div style={{ background: "#ECFDF5", border: "1px solid #86EFAC", borderRadius: 10, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: "#15803D", fontWeight: 600 }}>✓ Todo en orden — sin alertas activas</div>
                </div>
            )}
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t(cfg, 'dash_obras_curso')}</div>
                    <button onClick={() => setView("obras")} style={{ fontSize: 12, color: T.accent, background: "none", border: "none", fontWeight: 600 }}>{t(cfg, 'dash_ver_todas')}</button>
                </div>
                {obras.filter(o => o.estado === "curso").map(o => (<Card key={o.id} onClick={() => { setDetailObraId(o.id); setView("obras"); }} style={{ padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><div style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1, paddingRight: 8 }}>{o.nombre}</div><Badge color="#10B981" bg="#ECFDF5">{o.avance}%</Badge></div>
                    <div style={{ height: 4, background: T.bg, borderRadius: 4, marginBottom: 6 }}><div style={{ height: 4, background: T.accent, borderRadius: 4, width: `${o.avance}%` }} /></div>
                    <div style={{ fontSize: 11, color: T.muted }}>{UBICS.find(a => a.id === o.ap)?.code || o.ap} · {t(cfg, 'obras_cierre')}: {o.cierre}</div>
                </Card>))}
            </div>
        </div>
    </div>);
}

// DocMultiGrid: múltiples archivos por categoría (planos, pliegos, excel, otros)
function DocMultiGrid({ docs, onUpload, onRemove, refs, prefix }) {
    // docs es ahora un objeto { planos: [{id,nombre,url},...], pliego: [...], ... }
    return (<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {LIC_DOC_TYPES.map(d => {
            const lista = Array.isArray(docs?.[d.id]) ? docs[d.id] : docs?.[d.id] ? [docs[d.id]] : [];
            const rk = `${prefix}_${d.id}`;
            return (<div key={d.id}>
                <input type="file" accept={d.accept} multiple style={{ display: "none" }} ref={el => refs.current[rk] = el}
                    onChange={async e => {
                        for (const f of Array.from(e.target.files)) { await onUpload(d.id, f); }
                        e.target.value = "";
                    }} />
                {/* Header de categoría + botón agregar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{d.label}</span>
                        {lista.length > 0 && <span style={{ fontSize: 10, color: T.muted }}>({lista.length})</span>}
                    </div>
                    <button onClick={() => refs.current[rk]?.click()} style={{ background: T.accentLight, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: T.accent, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Agregar
                    </button>
                </div>
                {/* Lista de archivos */}
                {lista.length === 0 ? (
                    <button onClick={() => refs.current[rk]?.click()} style={{ width: "100%", background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: 10, padding: "10px", cursor: "pointer", textAlign: "center", color: T.muted, fontSize: 11 }}>
                        Sin archivos — tocá para subir
                    </button>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {lista.map((f, i) => (
                            <div key={f.id || i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 9, padding: "8px 10px" }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <span style={{ fontSize: 8, fontWeight: 800, color: "#15803D" }}>{(f.nombre || '').split('.').pop().toUpperCase().slice(0,4)}</span>
                                </div>
                                <span style={{ flex: 1, fontSize: 11, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre}</span>
                                <a href={f.url} download={f.nombre} style={{ textDecoration: "none", flexShrink: 0 }}>
                                    <button style={{ background: "none", border: "1px solid #86EFAC", borderRadius: 6, padding: "4px 8px", fontSize: 10, color: "#15803D", fontWeight: 600, cursor: "pointer" }}>↓</button>
                                </a>
                                <button onClick={() => onRemove(d.id, f.id || i)} style={{ background: "none", border: "1px solid #FCA5A5", borderRadius: 6, padding: "4px 7px", fontSize: 10, color: "#EF4444", cursor: "pointer", flexShrink: 0 }}>✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>);
        })}
    </div>);
}

// Mantener DocGrid viejo para compatibilidad con otros módulos que lo usen
function DocGrid({ docs, onUpload, onRemove, refs, prefix }) {
    return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{LIC_DOC_TYPES.map(d => {
        const doc = docs?.[d.id]; const rk = `${prefix}_${d.id}`; return (<div key={d.id}><input type="file" accept={d.accept} style={{ display: "none" }} ref={el => refs.current[rk] = el} onChange={async e => { if (e.target.files[0]) await onUpload(d.id, e.target.files[0]); e.target.value = ""; }} />
            {doc ? (<div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 10, padding: "9px 10px" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#15803D", marginBottom: 2 }}>{d.label}</div><div style={{ fontSize: 10, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>{doc.nombre}</div><div style={{ display: "flex", gap: 4 }}><a href={doc.url} download={doc.nombre} style={{ textDecoration: "none", flex: 1 }}><button style={{ width: "100%", background: "none", border: "1px solid #86EFAC", borderRadius: 6, padding: "4px 0", fontSize: 9, color: "#15803D", fontWeight: 600, cursor: "pointer" }}>↓ Ver</button></a><button onClick={() => onRemove(d.id)} style={{ background: "none", border: "1px solid #FCA5A5", borderRadius: 6, padding: "4px 7px", fontSize: 9, color: "#EF4444", cursor: "pointer" }}>✕</button></div></div>
            ) : (<button onClick={() => refs.current[rk]?.click()} style={{ width: "100%", background: T.bg, border: "1.5px dashed #86EFAC", borderRadius: 10, padding: "10px 6px", cursor: "pointer", textAlign: "center" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#15803D", marginBottom: 2 }}>{d.label.slice(0, 3).toUpperCase()}</div><div style={{ fontSize: 11, fontWeight: 600, color: T.sub }}>{d.label}</div><div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>Subir</div></button>)}</div>);
    })}</div>);
}

// ── PROYECTOS ─────────────────────────────────────────────────────
function Proyectos({ lics, setLics, requireAuth, cfg, obras, setObras }) {
    const UBICS = getUbics(cfg);
    const [ap, setAp] = useState("todos");
    const [showNew, setShowNew] = useState(false);
    const [showDetail, setShowDetail] = useState(null);
    const [form, setForm] = useState({ nombre: "", ap: "", estado: "visitar", monto: "", fecha: "", sector: "", docs: {} });
    const docRefs = useRef({}); const newDocRefs = useRef({});
    const filtered = lics.filter(l => ap === "todos" || l.ap === ap);

    // Asegurar que form.ap tenga un valor válido cuando cambien las UBICS
    useEffect(() => {
        if (!form.ap && UBICS.length > 0) setForm(f => ({ ...f, ap: UBICS[0].id }));
    }, [UBICS.length]);

    function autoCrearObra(lic) {
        const yaExiste = obras.some(o => o.lic_id === lic.id);
        if (yaExiste) return;
        const nuevaObra = {
            id: uid(), lic_id: lic.id, nombre: lic.nombre, ap: lic.ap, sector: lic.sector || "",
            estado: "curso", avance: 0, inicio: new Date().toLocaleDateString("es-AR"), cierre: "",
            obs: [{ id: uid(), txt: `Obra creada automáticamente al adjudicar la proyecto.`, fecha: new Date().toLocaleDateString("es-AR") }],
            fotos: [], archivos: [], informes: [], docs: {},
        };
        setObras(p => [...p, nuevaObra]);
    }

    function cambiarEstado(licId, nuevoEstado) {
        setLics(p => p.map(l => {
            if (l.id !== licId) return l;
            if ((nuevoEstado === "adjudicada" || nuevoEstado === "curso") && l.estado !== nuevoEstado) autoCrearObra({ ...l, estado: nuevoEstado });
            return { ...l, estado: nuevoEstado };
        }));
    }
    function add() {
        if (!form.nombre.trim()) return;
        const apFinal = form.ap || UBICS[0]?.id || 'aep';
        setLics(p => [...p, { ...form, ap: apFinal, id: uid() }]);
        setForm({ nombre: "", ap: UBICS[0]?.id || '', estado: "visitar", monto: "", fecha: "", sector: "", docs: {} });
        setShowNew(false);
    }
    function del(id) { setLics(p => p.filter(l => l.id !== id)); setShowDetail(null); }
    // handleDoc: agrega un archivo a la lista de esa categoría (no reemplaza)
    async function handleDoc(licId, did, file) {
        const url = await toDataUrl(file);
        const nuevo = { id: uid(), nombre: file.name, url };
        setLics(p => p.map(l => {
            if (l.id !== licId) return l;
            const docsActuales = l.docs || {};
            const listaActual = Array.isArray(docsActuales[did]) ? docsActuales[did] : docsActuales[did] ? [docsActuales[did]] : [];
            return { ...l, docs: { ...docsActuales, [did]: [...listaActual, nuevo] } };
        }));
    }
    async function handleNewDoc(did, file) {
        const url = await toDataUrl(file);
        const nuevo = { id: uid(), nombre: file.name, url };
        setForm(f => {
            const listaActual = Array.isArray(f.docs?.[did]) ? f.docs[did] : f.docs?.[did] ? [f.docs[did]] : [];
            return { ...f, docs: { ...f.docs, [did]: [...listaActual, nuevo] } };
        });
    }
    function removeDoc(licId, did, fileId) {
        setLics(p => p.map(l => {
            if (l.id !== licId) return l;
            const docsActuales = l.docs || {};
            const lista = Array.isArray(docsActuales[did]) ? docsActuales[did] : docsActuales[did] ? [docsActuales[did]] : [];
            return { ...l, docs: { ...docsActuales, [did]: lista.filter((f, i) => (f.id || i) !== fileId) } };
        }));
    }
    function removeNewDoc(did, fileId) {
        setForm(f => {
            const lista = Array.isArray(f.docs?.[did]) ? f.docs[did] : f.docs?.[did] ? [f.docs[did]] : [];
            return { ...f, docs: { ...f.docs, [did]: lista.filter((x, i) => (x.id || i) !== fileId) } };
        });
    }
    const detail = showDetail ? lics.find(l => l.id === showDetail) : null;

    return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
        <AppHeader title="Proyectos" sub={`${filtered.length} registros`} right={<PlusBtn onClick={() => requireAuth(() => setShowNew(true), "Nueva proyecto")} />} />
        {/* Filtros por ubicación — usa UBICS configuradas */}
        <div style={{ padding: "10px 18px", display: "flex", gap: 6, overflowX: "auto" }}>
            {[{ id: "todos", label: "Todos" }, ...UBICS.map(a => ({ id: a.id, label: a.code }))].map(f => (
                <button key={f.id} onClick={() => setAp(f.id)} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${ap === f.id ? "var(--accent,#1D4ED8)" : T.border}`, background: ap === f.id ? T.accentLight : T.card, color: ap === f.id ? T.accent : T.sub, fontSize: 12, fontWeight: 600 }}>{f.label}</button>
            ))}
        </div>
        <div style={{ padding: "0 18px" }}>
            {LIC_ESTADOS.map(est => {
                const items = filtered.filter(l => l.estado === est.id);
                if (!items.length) return null;
                return (<div key={est.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: est.color }} /><span style={{ fontSize: 11, fontWeight: 700, color: est.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{est.label}</span><span style={{ fontSize: 11, color: T.muted }}>({items.length})</span></div>
                    {items.map(lic => {
                        const obraVinc = obras.find(o => o.lic_id === lic.id);
                        const ubicLabel = UBICS.find(a => a.id === lic.ap)?.code || lic.ap || '—';
                        return (<Card key={lic.id} onClick={() => setShowDetail(lic.id)} style={{ padding: "13px 14px", marginBottom: 7, cursor: "pointer" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <div style={{ flex: 1, paddingRight: 8 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>{lic.nombre}{obraVinc && <span style={{ fontSize: 9, fontWeight: 700, background: "#ECFDF5", color: "#10B981", border: "1px solid #86EFAC", borderRadius: 20, padding: "1px 6px" }}>🏗 EN OBRA</span>}</div>
                                    <div style={{ fontSize: 11, color: T.muted }}>{ubicLabel}{lic.sector ? ` · ${lic.sector}` : ""}</div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{lic.monto}</div>
                                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{lic.fecha}</div>
                                </div>
                            </div>
                        </Card>);
                    })}
                </div>);
            })}
        </div>
        {showNew && (<Sheet title="Nueva proyecto" onClose={() => setShowNew(false)}>
            <Field label="Nombre"><TInput value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Refacción Terminal B" /></Field>
            <FieldRow>
                <Field label={getLabelUbic(cfg)}>
                    <Sel value={form.ap || UBICS[0]?.id || ''} onChange={e => setForm(p => ({ ...p, ap: e.target.value }))}>
                        {UBICS.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                    </Sel>
                </Field>
                <Field label="Estado"><Sel value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>{LIC_ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</Sel></Field>
            </FieldRow>
            <FieldRow>
                <Field label="Monto"><MontoInput value={form.monto} onChange={v => setForm(p => ({ ...p, monto: v }))} placeholder="0 $" /></Field>
                <Field label="Sector"><TInput value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} placeholder="Terminal A" /></Field>
            </FieldRow>
            <Field label="Fecha"><TInput value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} placeholder="dd/mm/aa" /></Field>
            <div style={{ marginBottom: 14 }}><Lbl>Documentos</Lbl><DocMultiGrid docs={form.docs} onUpload={handleNewDoc} onRemove={(did, fileId) => removeNewDoc(did, fileId)} refs={newDocRefs} prefix="new" /></div>
            <PBtn full onClick={add} disabled={!form.nombre.trim()}>Crear proyecto</PBtn>
        </Sheet>)}
        {detail && (<Sheet title={detail.nombre} onClose={() => setShowDetail(null)}>
            <Field label="Nombre"><TInput value={detail.nombre} onChange={e => setLics(p => p.map(l => l.id === detail.id ? { ...l, nombre: e.target.value } : l))} placeholder="Nombre de la proyecto" /></Field>
            <FieldRow>
                <Field label={getLabelUbic(cfg)}>
                    <Sel value={detail.ap} onChange={e => setLics(p => p.map(l => l.id === detail.id ? { ...l, ap: e.target.value } : l))}>
                        {UBICS.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                    </Sel>
                </Field>
                <Field label="Monto"><MontoInput value={detail.monto || ''} onChange={v => setLics(p => p.map(l => l.id === detail.id ? { ...l, monto: v } : l))} placeholder="0 $" /></Field>
            </FieldRow>
            <FieldRow>
                <Field label="Sector"><TInput value={detail.sector || ''} onChange={e => setLics(p => p.map(l => l.id === detail.id ? { ...l, sector: e.target.value } : l))} placeholder="Terminal A" /></Field>
                <Field label="Fecha"><TInput value={detail.fecha || ''} onChange={e => setLics(p => p.map(l => l.id === detail.id ? { ...l, fecha: e.target.value } : l))} placeholder="dd/mm/aa" /></Field>
            </FieldRow>
            <div style={{ marginBottom: 16 }}><Lbl>Documentos</Lbl><DocMultiGrid docs={detail.docs || {}} onUpload={(did, file) => handleDoc(detail.id, did, file)} onRemove={(did, fileId) => removeDoc(detail.id, did, fileId)} refs={docRefs} prefix={`det_${detail.id}`} /></div>
            <Field label="Estado">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {LIC_ESTADOS.map(e => (<button key={e.id} onClick={() => cambiarEstado(detail.id, e.id)} style={{ padding: "7px 4px", borderRadius: T.rsm, border: `1.5px solid ${detail.estado === e.id ? e.color : T.border}`, background: detail.estado === e.id ? e.bg : T.card, color: e.color, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{e.label}</button>))}
                </div>
            </Field>
            {(detail.estado === "adjudicada" || detail.estado === "curso") && (() => {
                const obraVinc = obras.find(o => o.lic_id === detail.id);
                return obraVinc ? (
                    <div style={{ background: "#ECFDF5", border: "1px solid #86EFAC", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#10B981"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#15803D" }}>✅ Obra creada automáticamente</div><div style={{ fontSize: 11, color: "#166534", marginTop: 1 }}>{obraVinc.nombre} — En Curso ({obraVinc.avance}%)</div></div>
                    </div>
                ) : (
                    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>⚠ Sin obra vinculada</div>
                        <button onClick={() => autoCrearObra(detail)} style={{ background: "#F59E0B", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Crear obra ahora</button>
                    </div>
                );
            })()}

            {/* ── REGISTRO FOTOGRÁFICO DE VISITAS ────────────────────── */}
            <RegistroVisitas
                licId={detail.id}
                visitas={detail.visitas || []}
                onUpdate={nuevasVisitas => {
                    const key = `bco_lic_vis_${detail.id}`;
                    const json = JSON.stringify(nuevasVisitas);
                    try { localStorage.setItem(key, json); } catch { }
                    storage.set(key, json).catch(() => { });
                    setLics(p => p.map(l => l.id === detail.id ? { ...l, visitas: nuevasVisitas } : l));
                }}
            />

            <PBtn full variant="danger" onClick={() => del(detail.id)} style={{ marginTop: 8 }}>Eliminar proyecto</PBtn>
        </Sheet>)}
    </div>);
}

// ── REGISTRO FOTOGRÁFICO DE VISITAS (usado en Proyectos) ──────────
const ETAPAS_VISITA = [
    { id: 'antes', label: 'Antes', color: '#F59E0B', bg: '#FFFBEB' },
    { id: 'durante', label: 'Durante', color: '#3B82F6', bg: '#EFF6FF' },
    { id: 'despues', label: 'Después', color: '#10B981', bg: '#ECFDF5' },
];

function RegistroVisitas({ visitas, onUpdate, licId }) {
    const camRef = useRef(null);
    const galRef = useRef(null);
    const [nuevaDesc, setNuevaDesc] = useState('');
    const [nuevaEtapa, setNuevaEtapa] = useState('antes');
    const [cargando, setCargando] = useState(false);
    const [vistaFoto, setVistaFoto] = useState(null);
    const [filtroEtapa, setFiltroEtapa] = useState('todas');

    async function subirFotos(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setCargando(true);
        const nuevas = await Promise.all(files.map(async f => {
            const dataUrl = await toDataUrl(f);
            const comprimida = await compressImage(dataUrl);
            const fotoId = uid();
            // Subir al bucket Supabase Storage
            const url = await uploadFoto(comprimida, `proyectoes/${licId || 'general'}`, fotoId);
            return {
                id: fotoId,
                url,
                nombre: f.name,
                desc: nuevaDesc.trim(),
                etapa: nuevaEtapa,
                fecha: new Date().toLocaleDateString('es-AR'),
                hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            };
        }));
        onUpdate([...visitas, ...nuevas]);
        setNuevaDesc('');
        setCargando(false);
        e.target.value = '';
    }

    function editarDesc(id, desc) {
        onUpdate(visitas.map(v => v.id === id ? { ...v, desc } : v));
    }
    function cambiarEtapa(id, etapa) {
        onUpdate(visitas.map(v => v.id === id ? { ...v, etapa } : v));
    }
    function eliminar(id) {
        onUpdate(visitas.filter(v => v.id !== id));
    }

    const filtradas = filtroEtapa === 'todas' ? visitas : visitas.filter(v => v.etapa === filtroEtapa);
    const contPorEtapa = etapa => visitas.filter(v => v.etapa === etapa).length;

    return (<div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Lbl>Registro fotográfico de visitas ({visitas.length})</Lbl>
        </div>

        {/* Selector de etapa + descripción + botones de subida */}
        <div style={{ background: T.bg, borderRadius: T.rsm, padding: "12px", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                {ETAPAS_VISITA.map(et => (
                    <button key={et.id} onClick={() => setNuevaEtapa(et.id)}
                        style={{ flex: 1, padding: "7px 4px", borderRadius: T.rsm, border: `1.5px solid ${nuevaEtapa === et.id ? et.color : T.border}`, background: nuevaEtapa === et.id ? et.bg : T.card, color: et.color, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        {et.label}
                    </button>
                ))}
            </div>
            <textarea
                value={nuevaDesc}
                onChange={e => setNuevaDesc(e.target.value)}
                placeholder="Descripción de la visita (opcional)..."
                rows={2}
                style={{ width: "100%", background: T.card, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "8px 12px", fontSize: 12, color: T.text, marginBottom: 8, resize: "none" }}
            />
            <input ref={camRef} type="file" accept="image/*" capture="environment" multiple onChange={subirFotos} style={{ display: "none" }} />
            <input ref={galRef} type="file" accept="image/*" multiple onChange={subirFotos} style={{ display: "none" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button onClick={() => camRef.current?.click()} disabled={cargando}
                    style={{ background: T.navy, border: "none", borderRadius: T.rsm, padding: "10px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" /><path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3H6a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0z" clipRule="evenodd" /></svg>
                    {cargando ? 'Subiendo...' : 'Tomar foto'}
                </button>
                <button onClick={() => galRef.current?.click()} disabled={cargando}
                    style={{ background: T.card, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "10px", color: T.text, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" /></svg>
                    Galería / PC
                </button>
            </div>
        </div>

        {/* Filtros por etapa */}
        {visitas.length > 0 && (<div style={{ display: "flex", gap: 5, marginBottom: 10, overflowX: "auto" }}>
            <button onClick={() => setFiltroEtapa('todas')} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${filtroEtapa === 'todas' ? T.accent : T.border}`, background: filtroEtapa === 'todas' ? T.accentLight : T.card, color: filtroEtapa === 'todas' ? T.accent : T.sub, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Todas ({visitas.length})
            </button>
            {ETAPAS_VISITA.map(et => (
                <button key={et.id} onClick={() => setFiltroEtapa(et.id)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${filtroEtapa === et.id ? et.color : T.border}`, background: filtroEtapa === et.id ? et.bg : T.card, color: et.color, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {et.label} ({contPorEtapa(et.id)})
                </button>
            ))}
        </div>)}

        {/* Comparación Antes/Después si hay fotos de ambas etapas */}
        {visitas.some(v => v.etapa === 'antes') && visitas.some(v => v.etapa === 'despues') && filtroEtapa === 'todas' && (<div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Comparación antes / después</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", marginBottom: 4, textAlign: "center", textTransform: "uppercase" }}>Antes</div>
                    {visitas.filter(v => v.etapa === 'antes').slice(-1).map(f => (
                        <div key={f.id} onClick={() => setVistaFoto(f)} style={{ cursor: "pointer" }}>
                            <img src={f.url} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 10, border: "2px solid #F59E0B" }} />
                            <div style={{ fontSize: 9, color: T.muted, marginTop: 3, textAlign: "center" }}>{f.fecha} {f.hora}</div>
                        </div>
                    ))}
                </div>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#10B981", marginBottom: 4, textAlign: "center", textTransform: "uppercase" }}>Después</div>
                    {visitas.filter(v => v.etapa === 'despues').slice(-1).map(f => (
                        <div key={f.id} onClick={() => setVistaFoto(f)} style={{ cursor: "pointer" }}>
                            <img src={f.url} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 10, border: "2px solid #10B981" }} />
                            <div style={{ fontSize: 9, color: T.muted, marginTop: 3, textAlign: "center" }}>{f.fecha} {f.hora}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>)}

        {/* Galería historial */}
        {filtradas.length === 0 && visitas.length > 0 && (
            <div style={{ textAlign: "center", padding: "16px 0", color: T.muted, fontSize: 12 }}>Sin fotos en esta etapa</div>
        )}
        {filtradas.length === 0 && visitas.length === 0 && (
            <div style={{ textAlign: "center", padding: "16px 0", color: T.muted, fontSize: 12 }}>Aún no hay fotos de visita. Subí la primera para iniciar el historial.</div>
        )}
        {filtradas.map((foto, idx) => {
            const etapa = ETAPAS_VISITA.find(e => e.id === foto.etapa) || ETAPAS_VISITA[0];
            return (<div key={foto.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, overflow: "hidden", marginBottom: 10 }}>
                <div onClick={() => setVistaFoto(foto)} style={{ cursor: "pointer", position: "relative" }}>
                    <img src={foto.url} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                    {/* Badge de etapa */}
                    <div style={{ position: "absolute", top: 8, left: 8, background: etapa.bg, border: `1px solid ${etapa.color}`, borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: etapa.color }}>
                        {etapa.label}
                    </div>
                    {/* Fecha + hora */}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,.6))", padding: "16px 10px 6px", fontSize: 10, color: "#fff" }}>
                        {foto.fecha} · {foto.hora}
                    </div>
                </div>
                <div style={{ padding: "10px 12px" }}>
                    {/* Descripción editable */}
                    <textarea
                        value={foto.desc || ''}
                        onChange={e => editarDesc(foto.id, e.target.value)}
                        placeholder="Agregar descripción..."
                        rows={2}
                        style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, color: T.text, resize: "none", marginBottom: 8 }}
                    />
                    {/* Cambiar etapa + borrar */}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {ETAPAS_VISITA.map(et => (
                            <button key={et.id} onClick={() => cambiarEtapa(foto.id, et.id)}
                                style={{ padding: "4px 10px", borderRadius: 20, border: `1.5px solid ${foto.etapa === et.id ? et.color : T.border}`, background: foto.etapa === et.id ? et.bg : T.card, color: et.color, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                {et.label}
                            </button>
                        ))}
                        <button onClick={() => eliminar(foto.id)}
                            style={{ marginLeft: "auto", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 20, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: "#EF4444", cursor: "pointer" }}>
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>);
        })}

        {/* Vista ampliada de foto */}
        {vistaFoto && (
            <div onClick={() => setVistaFoto(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
                <img src={vistaFoto.url} alt="" style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 10 }} />
                {vistaFoto.desc && <div style={{ color: "#fff", fontSize: 13, marginTop: 12, textAlign: "center", maxWidth: 340, lineHeight: 1.5 }}>{vistaFoto.desc}</div>}
                <div style={{ color: "rgba(255,255,255,.6)", fontSize: 11, marginTop: 6 }}>
                    {ETAPAS_VISITA.find(e => e.id === vistaFoto.etapa)?.label} · {vistaFoto.fecha} {vistaFoto.hora}
                </div>
                <div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, marginTop: 16 }}>Tocá para cerrar</div>
            </div>
        )}
    </div>);
}

// ── OBRAS: TABS ──────────────────────────────────────────────────────
function TabFotos({ detail, upd, fileRef, handleFoto, videoRef, handleVideo, apiKey, cfg }) {
    const [loadingIA, setLoadingIA] = useState(false);
    const [informe, setInforme] = useState('');
    const [selFotos, setSelFotos] = useState([]);
    const [modoSel, setModoSel] = useState(false);
    const fotos = detail.fotos || [];
    const videos = detail.videos || [];

    function toggleSel(id) { setSelFotos(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }

    async function analizarFotos() {
        if (!apiKey) { setInforme('⚠ Configurá tu API Key en Más → Configuración para usar esta función.'); return; }
        const fotosAAnalizar = selFotos.length > 0 ? fotos.filter(f => selFotos.includes(f.id)) : fotos.slice(-8);
        if (!fotosAAnalizar.length) { setInforme('Agregá al menos una foto para analizar.'); return; }
        setLoadingIA(true); setInforme('');
        try {
            const content = [];
            fotosAAnalizar.forEach(f => {
                try { content.push({ type: 'image', source: { type: 'base64', media_type: getMediaType(f.url), data: getBase64(f.url) } }); } catch { }
            });
            content.push({
                type: 'text', text: `Analizá estas ${fotosAAnalizar.length} fotos de la obra "${detail.nombre}" (${detail.sector || '—'}, avance declarado: ${detail.avance}%).

Generá un informe profesional V+V Construcciones con:
1. **Estado general de la obra**
2. **Avance estimado** — ¿coincide con el ${detail.avance}% declarado?
3. **Trabajos en ejecución**
4. **Correcciones y recomendaciones**
5. **Alertas de seguridad**
6. **Conclusión**

Usá un tono técnico y profesional. Respondé en español rioplatense.`});

            const r = await callAI([{ role: 'user', content }],
                `Sos un inspector de obras de obras para V+V Construcciones. Analizás fotos y generás informes técnicos precisos y profesionales en español rioplatense. Si identificás materiales o trabajos, podés buscar precios actualizados en internet para incluir estimaciones de costo.`,
                apiKey, true);
            setInforme(r);
            const nuevoInf = { id: uid(), ts: Date.now(), titulo: `Análisis IA — ${new Date().toLocaleDateString('es-AR')}`, tipo: 'diario', fecha: new Date().toLocaleDateString('es-AR'), notas: 'Generado automáticamente por IA a partir de fotos', nombre: 'informe_ia.txt', ext: 'IA', url: 'data:text/plain;base64,' + btoa(unescape(encodeURIComponent(r))), size: '—', cargado: new Date().toLocaleDateString('es-AR') };
            upd(detail.id, { informes: [nuevoInf, ...(detail.informes || [])] });
        } catch (e) { setInforme('Error al analizar: ' + e.message); }
        setLoadingIA(false); setModoSel(false); setSelFotos([]);
    }

    return (<div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFoto} style={{ display: "none" }} />
        <input ref={videoRef} type="file" accept="video/*" multiple onChange={handleVideo} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <PBtn onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "11px 0", fontSize: 13 }}>{t(cfg, 'obras_agregar_fotos')}</PBtn>
            <button onClick={() => videoRef.current?.click()} style={{ background: T.accentLight, border: `1.5px solid ${T.accent}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 12.5, fontWeight: 700, color: T.accent, cursor: "pointer", flexShrink: 0 }}>🎥 Video</button>
            {fotos.length > 0 && <button onClick={() => { setModoSel(v => !v); setSelFotos([]); }} style={{ background: modoSel ? T.accent : T.accentLight, border: `1.5px solid ${T.accent}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 12, fontWeight: 700, color: modoSel ? "#fff" : T.accent, cursor: "pointer", flexShrink: 0 }}>
                {modoSel ? "Cancelar" : "Seleccionar"}
            </button>}
        </div>
        {fotos.length > 0 && (<button onClick={analizarFotos} disabled={loadingIA} style={{ width: "100%", background: loadingIA ? "#94A3B8" : T.navy, border: "none", borderRadius: T.rsm, padding: "13px", marginBottom: 14, cursor: loadingIA ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#fff", fontSize: 13, fontWeight: 700 }}>
            {loadingIA
                ? <><div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />Analizando fotos con IA…</>
                : <>{modoSel && selFotos.length > 0 ? `Analizar ${selFotos.length} foto${selFotos.length > 1 ? 's' : ''} seleccionada${selFotos.length > 1 ? 's' : ''}` : "Analizar fotos con IA"}</>}
        </button>)}
        {modoSel && <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginBottom: 10 }}>{selFotos.length === 0 ? "Tocá las fotos que querés analizar" : `${selFotos.length} seleccionada${selFotos.length > 1 ? "s" : ""}`}</div>}
        {fotos.length === 0
            ? <div style={{ textAlign: "center", padding: "32px 0", color: T.muted, fontSize: 13 }}>{t(cfg, 'obras_sin_fotos')}</div>
            : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: informe ? 14 : 0 }}>
                {fotos.map(f => {
                    const sel = selFotos.includes(f.id);
                    return (<div key={f.id} onClick={() => modoSel && toggleSel(f.id)} style={{ borderRadius: T.rsm, overflow: "hidden", border: `2px solid ${sel ? "#10B981" : T.border}`, cursor: modoSel ? "pointer" : "default", position: "relative" }}>
                        {sel && <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</div>}
                        <img src={f.url} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", opacity: modoSel && !sel ? .6 : 1, transition: "opacity .2s" }} />
                        <div style={{ padding: "5px 8px", fontSize: 9, color: T.muted, background: T.card }}>{f.fecha}</div>
                        <button onClick={e => { e.stopPropagation(); upd(detail.id, { fotos: fotos.filter(x => x.id !== f.id) }); }} style={{ position: "absolute", top: 5, left: 5, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>✕</button>
                    </div>);
                })}
            </div>}
        {videos.length > 0 && <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Videos ({videos.length})</div>
            {videos.map(v => <div key={v.id} style={{ marginBottom: 10, borderRadius: T.rsm, overflow: "hidden", border: `1px solid ${T.border}` }}>
                <video src={v.url} controls playsInline style={{ width: "100%", display: "block", background: "#000" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: T.card }}><span style={{ fontSize: 10.5, color: T.muted }}>{v.nombre || "video"} · {v.fecha}</span><button onClick={() => upd(detail.id, { videos: videos.filter(x => x.id !== v.id) })} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar</button></div>
            </div>)}
        </div>}
        {informe && (<Card style={{ padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} /><span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Informe IA generado</span></div>
                <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { try { navigator.clipboard.writeText(informe); } catch { } }} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "4px 10px", fontSize: 11, color: T.sub, cursor: "pointer" }}>📋 Copiar</button>
                    <button onClick={() => setInforme('')} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, padding: "4px 8px", fontSize: 11, color: "#EF4444", cursor: "pointer" }}>✕</button>
                </div>
            </div>
            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "12px 14px", fontSize: 12, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto" }}>{informe}</div>
        </Card>)}
    </div>);
}

function TabInformes({ detail, upd }) {
    const [subTab, setSubTab] = useState("diario");
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ titulo: '', tipo: 'diario', fecha: '', notas: '' });
    const fileRef = useRef(null);
    const informes = detail.informes || [];
    const TIPOS_INF = [
        { id: 'diario', label: 'Diario', color: '#3B82F6', bg: '#EFF6FF' },
        { id: 'semanal', label: 'Semanal', color: '#7C3AED', bg: '#F5F3FF' },
        { id: 'ingeniero', label: 'Ingeniero', color: '#10B981', bg: '#ECFDF5' },
    ];
    async function handleFile(e) {
        const files = Array.from(e.target.files);
        const nuevos = [];
        for (const f of files) {
            const url = await toDataUrl(f);
            nuevos.push({
                id: uid(), ts: Date.now(), titulo: form.titulo || f.name.replace(/\.[^.]+$/, ''),
                tipo: form.tipo || subTab, fecha: form.fecha || new Date().toLocaleDateString('es-AR'),
                notas: form.notas, nombre: f.name, ext: f.name.split('.').pop().toUpperCase(),
                url, size: (f.size / 1024).toFixed(0) + 'KB', cargado: new Date().toLocaleDateString('es-AR'),
            });
        }
        upd(detail.id, { informes: [...nuevos, ...informes] });
        setForm({ titulo: '', tipo: 'diario', fecha: '', notas: '' });
        setShowNew(false);
        e.target.value = '';
    }
    const filtered = informes.filter(i => i.tipo === subTab);
    const tp = TIPOS_INF.find(x => x.id === subTab);

    return (<div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {TIPOS_INF.map(tipo => (<button key={tipo.id} onClick={() => setSubTab(tipo.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 20, border: `1.5px solid ${subTab === tipo.id ? tipo.color : T.border}`, background: subTab === tipo.id ? tipo.bg : T.card, color: tipo.color, fontSize: 11, fontWeight: subTab === tipo.id ? 700 : 500, cursor: "pointer" }}>{tipo.label} ({informes.filter(i => i.tipo === tipo.id).length})</button>))}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.txt,.jpg,.png" multiple onChange={handleFile} style={{ display: "none" }} />
        <button onClick={() => setShowNew(true)} style={{ width: "100%", background: tp?.bg, border: `1.5px dashed ${tp?.color}`, borderRadius: T.rsm, padding: "12px", marginBottom: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 18, color: tp?.color }}>+</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: tp?.color }}>Subir informe {tp?.label}</span>
        </button>
        {filtered.length === 0
            ? <div style={{ textAlign: "center", padding: "28px 0", color: T.muted, fontSize: 12 }}>Sin informes {tp?.label?.toLowerCase()}s cargados</div>
            : filtered.map(inf => (<div key={inf.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 8 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: tp?.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: tp?.color }}>{inf.ext}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inf.titulo}</div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{inf.fecha} · {inf.size}</div>
                </div>
                <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <a href={inf.url} download={inf.nombre} style={{ textDecoration: "none" }}>
                        <button style={{ background: T.accentLight, border: `1px solid ${T.border}`, borderRadius: 7, width: 30, height: 30, cursor: "pointer", color: T.accent, fontSize: 12 }}>↓</button>
                    </a>
                    <button onClick={() => upd(detail.id, { informes: informes.filter(x => x.id !== inf.id) })} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, width: 30, height: 30, cursor: "pointer", color: "#EF4444", fontSize: 12 }}>✕</button>
                </div>
            </div>))}
        {showNew && (<Sheet title={`Subir informe ${tp?.label}`} onClose={() => setShowNew(false)}>
            <Field label="Título (opcional)"><TInput value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Título del informe" /></Field>
            <FieldRow>
                <Field label="Tipo"><Sel value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>{TIPOS_INF.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</Sel></Field>
                <Field label="Fecha"><TInput value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} placeholder="dd/mm/aa" /></Field>
            </FieldRow>
            <Field label="Notas"><textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones..." rows={3} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text }} /></Field>
            <PBtn full onClick={() => fileRef.current?.click()}>📎 Seleccionar archivo</PBtn>
        </Sheet>)}
    </div>);
}

// ── OBRAS ────────────────────────────────────────────────────────────
// ── TAB GASTOS (dentro de cada Obra) ─────────────────────────────────
const TIPOS_GASTO = [
    { id: 'viatico', label: 'Viático', color: '#F59E0B', bg: '#FFFBEB' },
    { id: 'compra', label: 'Compra material', color: '#3B82F6', bg: '#EFF6FF' },
    { id: 'herramienta', label: 'Herramienta', color: '#8B5CF6', bg: '#F5F3FF' },
    { id: 'subcontrato', label: 'Subcontrato', color: '#10B981', bg: '#ECFDF5' },
    { id: 'combustible', label: 'Combustible', color: '#F97316', bg: '#FFF7ED' },
    { id: 'otro', label: 'Otro', color: '#6B7280', bg: '#F9FAFB' },
];

function TabGastos({ detail, upd }) {
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ desc: '', tipo: 'viatico', monto: '', fecha: new Date().toLocaleDateString('es-AR'), quien: '', comprobante: null });
    const compRef = useRef(null);
    const gastos = detail.gastos || [];

    const total = gastos.reduce((s, g) => s + parseMontoNum(g.monto), 0);
    const porTipo = TIPOS_GASTO.map(t => ({ ...t, total: gastos.filter(g => g.tipo === t.id).reduce((s, g) => s + parseMontoNum(g.monto), 0) })).filter(t => t.total > 0);

    async function handleComp(e) {
        const f = e.target.files?.[0]; if (!f) return;
        const url = await toDataUrl(f);
        setForm(p => ({ ...p, comprobante: { url, nombre: f.name, ext: f.name.split('.').pop().toUpperCase() } }));
        e.target.value = '';
    }

    function agregar() {
        if (!form.desc.trim() || !form.monto) return;
        const nuevo = { id: uid(), ...form };
        upd(detail.id, { gastos: [...gastos, nuevo] });
        setForm({ desc: '', tipo: 'viatico', monto: '', fecha: new Date().toLocaleDateString('es-AR'), quien: '', comprobante: null });
        setShowNew(false);
    }

    function eliminar(id) { upd(detail.id, { gastos: gastos.filter(g => g.id !== id) }); }

    return (<div>
        {/* Resumen */}
        <div style={{ background: T.navy, borderRadius: T.rsm, padding: "14px 16px", marginBottom: 14, color: "#fff" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total gastos — {detail.nombre}</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>${total.toLocaleString('es-AR')}</div>
            {porTipo.length > 0 && <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {porTipo.map(t => (
                    <div key={t.id} style={{ background: "rgba(255,255,255,.1)", borderRadius: 8, padding: "4px 10px" }}>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,.6)" }}>{t.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>${t.total.toLocaleString('es-AR')}</div>
                    </div>
                ))}
            </div>}
        </div>

        <button onClick={() => setShowNew(true)} style={{ width: "100%", background: T.accent, border: "none", borderRadius: T.rsm, padding: "12px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" /></svg>
            Cargar gasto
        </button>

        {gastos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: T.muted, fontSize: 13 }}>Sin gastos registrados</div>
        ) : (
            [...gastos].reverse().map(g => {
                const tipo = TIPOS_GASTO.find(t => t.id === g.tipo) || TIPOS_GASTO[5];
                return (<div key={g.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                                <span style={{ background: tipo.bg, color: tipo.color, borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700, border: `1px solid ${tipo.color}22` }}>{tipo.label}</span>
                                <span style={{ fontSize: 11, color: T.muted }}>{g.fecha}</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{g.desc}</div>
                            {g.quien && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>👤 {g.quien}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: T.accent }}>${parseMontoNum(g.monto).toLocaleString('es-AR')}</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {g.comprobante && (
                            <a href={g.comprobante.url} download={g.comprobante.nombre} style={{ textDecoration: "none", flex: 1 }}>
                                <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ width: 24, height: 24, borderRadius: 5, background: T.accentLight, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800 }}>{g.comprobante.ext}</div>
                                    <span style={{ fontSize: 11, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.comprobante.nombre}</span>
                                    <span style={{ fontSize: 10, color: T.accent, fontWeight: 600, marginLeft: "auto" }}>↓</span>
                                </div>
                            </a>
                        )}
                        <button onClick={() => eliminar(g.id)} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#EF4444", cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>✕</button>
                    </div>
                </div>);
            })
        )}

        {showNew && (<Sheet title="Cargar gasto" onClose={() => setShowNew(false)}>
            <Field label="Descripción">
                <TInput value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} placeholder="Ej: Cemento Portland 25kg" />
            </Field>
            <Lbl>Tipo de gasto</Lbl>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                {TIPOS_GASTO.map(t => (
                    <button key={t.id} onClick={() => setForm(p => ({ ...p, tipo: t.id }))} style={{ padding: "8px 4px", borderRadius: T.rsm, border: `1.5px solid ${form.tipo === t.id ? t.color : T.border}`, background: form.tipo === t.id ? t.bg : T.card, color: t.color, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{t.label}</button>
                ))}
            </div>
            <FieldRow>
                <Field label="Monto ($)">
                    <MontoInput value={form.monto} onChange={v => setForm(p => ({ ...p, monto: v }))} placeholder="0 $" />
                </Field>
                <Field label="Fecha">
                    <TInput value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} placeholder="dd/mm/aa" />
                </Field>
            </FieldRow>
            <Field label="Quién realizó el gasto (opcional)">
                <TInput value={form.quien} onChange={e => setForm(p => ({ ...p, quien: e.target.value }))} placeholder="Nombre del trabajador" />
            </Field>
            <Field label="Comprobante (foto o PDF)">
                <input ref={compRef} type="file" accept="image/*,.pdf" onChange={handleComp} style={{ display: "none" }} />
                {form.comprobante ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ECFDF5", border: "1px solid #86EFAC", borderRadius: T.rsm, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", flex: 1 }}>✓ {form.comprobante.nombre}</div>
                        <button onClick={() => setForm(p => ({ ...p, comprobante: null }))} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                ) : (
                    <button onClick={() => compRef.current?.click()} style={{ width: "100%", background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 12, fontWeight: 600, color: T.sub, cursor: "pointer" }}>
                        📎 Adjuntar comprobante
                    </button>
                )}
            </Field>
            <PBtn full onClick={agregar} disabled={!form.desc.trim() || !form.monto}>Guardar gasto</PBtn>
        </Sheet>)}
    </div>);
}

function Obras({ obras, setObras, lics, detailId, setDetailId, requireAuth, cfg, apiKey }) {
    const UBICS = getUbics(cfg);
    const defaultAp = UBICS[0]?.id || 'aep';
    const [showNew, setShowNew] = useState(false);
    const [tab, setTab] = useState("info");
    const [form, setForm] = useState({ nombre: "", ap: defaultAp, sector: "", estado: "pendiente", avance: 0, inicio: "", cierre: "" });
    const [newObs, setNewObs] = useState("");
    const fileRef = useRef(null); const archRef = useRef(null); const videoRef = useRef(null); const planoRef = useRef(null);
    const detail = detailId ? obras.find(o => o.id === detailId) : null;

    // Actualizar form.ap si cambian las UBICS
    useEffect(() => {
        setForm(f => ({ ...f, ap: UBICS[0]?.id || f.ap }));
    }, [UBICS.length]);

    function add() {
        if (!form.nombre.trim()) return;
        const apFinal = form.ap || UBICS[0]?.id || defaultAp;
        setObras(p => [...p, { ...form, ap: apFinal, id: uid(), avance: parseInt(form.avance) || 0, pagado: 0, obs: [], fotos: [], archivos: [], informes: [], docs: {} }]);
        setForm({ nombre: "", ap: UBICS[0]?.id || defaultAp, sector: "", estado: "pendiente", avance: 0, inicio: "", cierre: "" });
        setShowNew(false);
    }
    function upd(id, patch) {
        setObras(p => p.map(o => o.id === id ? { ...o, ...patch } : o));
    }
    async function handleFoto(e) {
        if (!detail) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const nuevas = await Promise.all(files.map(async f => {
            const dataUrl = await toDataUrl(f);
            const comprimida = await compressImage(dataUrl);
            const fotoId = uid();
            // Subir al bucket — devuelve URL pública o base64 como fallback
            const url = await uploadFoto(comprimida, `obras/${detail.id}`, fotoId);
            return { id: fotoId, url, nombre: f.name, fecha: new Date().toLocaleDateString("es-AR") };
        }));
        const fallaron = nuevas.some(n => !mediaStorage.isRemoteUrl(n.url));
        upd(detail.id, { fotos: [...(detail.fotos || []), ...nuevas] });
        e.target.value = "";
        if (fallaron) alert("⚠ Las fotos quedaron guardadas en este dispositivo, pero NO se pudieron subir a la nube. Para que se sincronicen entre dispositivos y se vean en la app de Belfast, falta configurar el bucket de fotos 'bco-media' en Supabase (crearlo, hacerlo público y darle permisos). Mirá las instrucciones que te pasó la app.");
    }
    async function handlePlano(e) {
        if (!detail) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const nuevos = [];
        for (const f of files) {
            const dataUrl = await toDataUrl(f);
            const url = await uploadFoto(dataUrl, `planos/${detail.id}`, `${Date.now()}_${(f.name || "plano").replace(/\W+/g, "_")}`);
            if (!mediaStorage.isRemoteUrl(url)) { alert(`El plano "${f.name}" NO se pudo subir a la nube (bucket 'bco-media' en Supabase). No lo guardo local para no romper la sincronización.`); continue; }
            const ext = (f.name.split(".").pop() || "").toLowerCase();
            nuevos.push({ id: uid(), nombre: f.name, url, fecha: new Date().toLocaleDateString("es-AR"), from: "vv", tipo: ext });
        }
        e.target.value = "";
        if (!nuevos.length) return;
        upd(detail.id, { planos: [...(detail.planos || []), ...nuevos] });
    }
    async function handleVideo(e) {
        if (!detail) return;
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const nuevos = [];
        for (const f of files) {
            if (f.size > 60 * 1024 * 1024) { alert(`El video "${f.name}" pesa ${(f.size / 1048576).toFixed(0)} MB. Subí videos de hasta ~60 MB (grabá más corto o en menor calidad).`); continue; }
            const dataUrl = await toDataUrl(f);
            const vidId = uid();
            const url = await uploadFoto(dataUrl, `obras/${detail.id}/videos`, vidId);
            if (!mediaStorage.isRemoteUrl(url)) { alert(`El video "${f.name}" NO se pudo subir a la nube, así que no lo guardo (guardarlo local rompería la sincronización de la app). Revisá que el bucket 'bco-media' de Supabase exista, sea público y tenga permisos, y volvé a intentar.`); continue; }
            nuevos.push({ id: vidId, url, nombre: f.name, fecha: new Date().toLocaleDateString("es-AR") });
        }
        e.target.value = "";
        if (!nuevos.length) return;
        upd(detail.id, { videos: [...(detail.videos || []), ...nuevos] });
    }
    async function handleArch(e) {
        if (!detail) return;
        for (const f of Array.from(e.target.files)) {
            const dataUrl = await toDataUrl(f);
            const archId = uid();
            const url = await uploadFoto(dataUrl, `obras/${detail.id}/archivos`, archId);
            upd(detail.id, { archivos: [...detail.archivos, { id: archId, url, nombre: f.name, ext: f.name.split(".").pop().toUpperCase(), fecha: new Date().toLocaleDateString("es-AR") }] });
        }
        e.target.value = "";
    }
    const ec = id => OBRA_ESTADOS.find(e => e.id === id) || OBRA_ESTADOS[0];

    if (detail) {
        const e = ec(detail.estado);
        return (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <AppHeader title={detail.nombre} sub={`${UBICS.find(a => a.id === detail.ap)?.code || detail.ap} · ${detail.sector || t(cfg, 'obras_sector')}`} back onBack={() => setDetailId(null)} right={<Badge color={e.color} bg={e.bg}>{e.label}</Badge>} />
                <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "12px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: T.sub, fontWeight: 600 }}>{t(cfg, 'obras_avance')}</span><span style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>{detail.avance}%</span></div>
                    <div style={{ height: 8, background: T.bg, borderRadius: 4 }}><div style={{ height: 8, background: T.accent, borderRadius: 4, width: `${detail.avance}%`, transition: "width .5s" }} /></div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span style={{ fontSize: 11, color: T.muted }}>{t(cfg, 'obras_inicio')}: {detail.inicio || "—"}</span><span style={{ fontSize: 11, color: T.muted }}>{t(cfg, 'obras_cierre')}: {detail.cierre || "—"}</span></div>
                    <input type="range" min="0" max="100" value={detail.avance} onChange={e => upd(detail.id, { avance: parseInt(e.target.value) })} style={{ width: "100%", accentColor: "var(--accent,#1D4ED8)", marginTop: 10 }} />
                </div>
                <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, display: "flex", overflowX: "auto" }}>
                    {[[`info`, t(cfg, 'obras_info')], [`obs`, t(cfg, 'obras_notas')], [`fotos`, t(cfg, 'obras_fotos')], [`planos`, 'Planos'], [`archivos`, t(cfg, 'obras_archivos')], [`informes`, 'Informes'], [`gastos`, 'Gastos']].map(([id, label]) => (
                        <button key={id} onClick={() => setTab(id)} style={{ flex: 1, minWidth: 52, padding: "10px 4px", background: "none", border: "none", fontSize: 11, fontWeight: tab === id ? 700 : 500, color: tab === id ? T.accent : T.muted, borderBottom: `2px solid ${tab === id ? "var(--accent,#1D4ED8)" : "transparent"}`, whiteSpace: "nowrap" }}>{label}</button>
                    ))}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", paddingBottom: 80 }}>
                    {tab === "info" && (<div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>{getLabelUbic(cfg)}</div>
                                <select value={detail.ap} onChange={e => upd(detail.id, { ap: e.target.value })} style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0, cursor: "pointer" }}>
                                    {UBICS.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                                </select>
                            </div>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>{t(cfg, 'obras_sector')}</div>
                                <input value={detail.sector || ''} onChange={e => upd(detail.id, { sector: e.target.value })} placeholder="Sin sector" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0 }} />
                            </div>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>{t(cfg, 'obras_inicio')}</div>
                                <input value={detail.inicio || ''} onChange={e => upd(detail.id, { inicio: e.target.value })} placeholder="dd/mm/aa" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0 }} />
                            </div>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>{t(cfg, 'obras_cierre')}</div>
                                <input value={detail.cierre || ''} onChange={e => upd(detail.id, { cierre: e.target.value })} placeholder="dd/mm/aa" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0 }} />
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                            <div style={{ background: T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>Presupuesto</div>
                                <input value={detail.monto || ''} onChange={e => upd(detail.id, { monto: e.target.value })} placeholder="$ 0" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: T.text, padding: 0 }} />
                            </div>
                            <div style={{ background: detail.pagado > 0 ? "#ECFDF5" : T.bg, borderRadius: T.rsm, padding: "10px 12px" }}>
                                <div style={{ fontSize: 10, color: T.muted, marginBottom: 5, textTransform: "uppercase" }}>💰 Pagado</div>
                                <input value={detail.pagado || ''} onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); upd(detail.id, { pagado: v ? parseFloat(v) : 0 }); }} placeholder="$ 0" style={{ width: "100%", background: "transparent", border: "none", fontSize: 12, fontWeight: 600, color: "#10B981", padding: 0 }} />
                            </div>
                        </div>
                        <Lbl>{t(cfg, 'obras_estado')}</Lbl>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                            {OBRA_ESTADOS.map(e => (<button key={e.id} onClick={() => upd(detail.id, { estado: e.id })} style={{ padding: "9px", borderRadius: T.rsm, border: `1.5px solid ${detail.estado === e.id ? e.color : T.border}`, background: detail.estado === e.id ? e.bg : T.card, color: e.color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{e.label}</button>))}
                        </div>
                        <button onClick={() => { setObras(p => p.filter(o => o.id !== detail.id)); setDetailId(null); }} style={{ width: "100%", background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 600, color: "#EF4444", cursor: "pointer" }}>{t(cfg, 'obras_eliminar')}</button>
                    </div>)}
                    {tab === "obs" && (<div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                            <TInput value={newObs} onChange={e => setNewObs(e.target.value)} placeholder={t(cfg, 'obras_obs_placeholder')} />
                            <PBtn onClick={() => { if (!newObs.trim()) return; const tx = newObs; setNewObs(""); upd(detail.id, { obs: [...detail.obs, { id: uid(), txt: tx, fecha: new Date().toLocaleDateString("es-AR") }] }); }} disabled={!newObs.trim()} style={{ padding: "11px 16px", flexShrink: 0 }}>+</PBtn>
                        </div>
                        {[...detail.obs].reverse().map(o => (<Card key={o.id} style={{ padding: "12px 14px", marginBottom: 8 }}><div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{o.txt}</div><div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>{o.fecha}</div></Card>))}
                        {detail.obs.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: T.muted, fontSize: 13 }}>{t(cfg, 'obras_sin_notas')}</div>}
                    </div>)}
                    {tab === "fotos" && (<TabFotos detail={detail} upd={upd} fileRef={fileRef} handleFoto={handleFoto} videoRef={videoRef} handleVideo={handleVideo} apiKey={apiKey} cfg={cfg} />)}
                    {tab === "planos" && (<div>
                        <input ref={planoRef} type="file" accept=".pdf,.dwg,.dxf,.dwf,.rvt,application/pdf,image/*" multiple onChange={handlePlano} style={{ display: "none" }} />
                        <button onClick={() => planoRef.current && planoRef.current.click()} style={{ width: "100%", background: T.navy, color: "#fff", border: "none", borderRadius: T.rsm, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderBottom: `2px solid ${BRASS}`, marginBottom: 14 }}>＋ Subir plano (PDF / CAD)</button>
                        {(detail.planos || []).length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "22px 16px", lineHeight: 1.5 }}>Sin planos cargados.<br />Subí acá los planos de la obra (PDF, DWG, DXF…). Belfast también los ve y los puede subir.</div>}
                        {(detail.planos || []).map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 12px", marginBottom: 7 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>📐</div>
                            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{p.nombre}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{p.fecha}{p.from ? ` · ${p.from === "vv" ? "V+V" : "Belfast"}` : ""}</div></div>
                            <a href={p.url} target="_blank" rel="noreferrer" download={p.nombre} style={{ color: T.accent, fontWeight: 700, fontSize: 12, textDecoration: "none", flexShrink: 0 }}>Abrir ↗</a>
                            <button onClick={() => upd(detail.id, { planos: (detail.planos || []).filter(x => x.id !== p.id) })} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>
                        </div>)}
                    </div>)}
                    {tab === "archivos" && (<div>
                        <input ref={archRef} type="file" accept=".pdf,.xlsx,.xls,.docx,.doc" multiple onChange={handleArch} style={{ display: "none" }} />
                        <PBtn full onClick={() => archRef.current?.click()} style={{ marginBottom: 14 }}>{t(cfg, 'obras_agregar_arch')}</PBtn>
                        {detail.archivos.map(f => (<div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 7 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 9, fontWeight: 700, color: T.accent }}>{f.ext}</span></div>
                            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre}</div><div style={{ fontSize: 10, color: T.muted }}>{f.fecha}</div></div>
                            <a href={f.url} download={f.nombre} style={{ textDecoration: "none" }}><button style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, width: 30, height: 30, fontSize: 13, color: T.sub, cursor: "pointer" }}>↓</button></a>
                        </div>))}
                        {detail.archivos.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: T.muted, fontSize: 13 }}>{t(cfg, 'obras_sin_archivos')}</div>}
                    </div>)}
                    {tab === "informes" && <TabInformes detail={detail} upd={upd} />}
                    {tab === "gastos" && <TabGastos detail={detail} upd={upd} />}
                </div>
            </div>
        );
    }

    return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
        <AppHeader title={t(cfg, 'obras_titulo')} sub={`${obras.length} registros`} right={<PlusBtn onClick={() => requireAuth(() => setShowNew(true), t(cfg, 'obras_nueva'))} />} />
        <div style={{ padding: "14px 18px" }}>
            {OBRA_ESTADOS.map(est => {
                const items = obras.filter(o => o.estado === est.id);
                if (!items.length) return null;
                return (<div key={est.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: est.color }} /><span style={{ fontSize: 11, fontWeight: 700, color: est.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{est.label}</span><span style={{ fontSize: 11, color: T.muted }}>({items.length})</span></div>
                    {items.map(o => (<Card key={o.id} onClick={() => setDetailId(o.id)} style={{ padding: "13px 14px", marginBottom: 7, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{o.nombre}</div><span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{o.avance}%</span></div>
                        <div style={{ height: 4, background: T.bg, borderRadius: 4, marginBottom: 6 }}><div style={{ height: 4, background: T.accent, borderRadius: 4, width: `${o.avance}%` }} /></div>
                        <div style={{ fontSize: 11, color: T.muted }}>{UBICS.find(a => a.id === o.ap)?.code || o.ap} · {o.sector || "Sin sector"} · {o.cierre || "—"}</div>
                    </Card>))}
                </div>);
            })}
        </div>
        {showNew && (<Sheet title={t(cfg, 'obras_nueva')} onClose={() => setShowNew(false)}>
            <Field label={t(cfg, 'obras_titulo')}><TInput value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Refacción Terminal B" /></Field>
            <FieldRow>
                <Field label={getLabelUbic(cfg)}><Sel value={form.ap} onChange={e => setForm(p => ({ ...p, ap: e.target.value }))}>{UBICS.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}</Sel></Field>
                <Field label={t(cfg, 'obras_estado')}><Sel value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>{OBRA_ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</Sel></Field>
            </FieldRow>
            <FieldRow>
                <Field label={t(cfg, 'obras_sector')}><TInput value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} placeholder="Sector A" /></Field>
                <Field label={`${t(cfg, 'obras_avance')} %`}><TInput type="number" value={form.avance} onChange={e => setForm(p => ({ ...p, avance: e.target.value }))} placeholder="0" /></Field>
            </FieldRow>
            <FieldRow>
                <Field label={t(cfg, 'obras_inicio')}><TInput value={form.inicio} onChange={e => setForm(p => ({ ...p, inicio: e.target.value }))} placeholder="dd/mm/aa" /></Field>
                <Field label={t(cfg, 'obras_cierre')}><TInput value={form.cierre} onChange={e => setForm(p => ({ ...p, cierre: e.target.value }))} placeholder="dd/mm/aa" /></Field>
            </FieldRow>
            <PBtn full onClick={add} disabled={!form.nombre.trim()}>{t(cfg, 'obras_nueva')}</PBtn>
        </Sheet>)}
    </div>);
}


// ════════════════════════════════════════════════════════════════════
// PREVIEW HARNESS — V+V Construcciones · dirección institucional premium
// Señal: hilo de bronce (regla membrete, anillo FAB, viñetas de sección).
// ════════════════════════════════════════════════════════════════════

const BRASS = "#B0894F";
const INST_COLORS = { accent:"#1E3A5F", al:"#EAEEF3", bg:"#F5F6F8", card:"#FFFFFF", border:"#E6E9EE", text:"#131C2B", sub:"#4A5565", muted:"#97A0AE", navy:"#101C2C" };

const SAMPLE_OBRAS = [
  { id:"o1", nombre:"Castores 475", ap:"norte", sector:"Vivienda PB+1", estado:"curso", avance:68, inicio:"10/03/26", cierre:"30/08/26", monto:"12.400.000 $", pagado:8100000, obs:[{id:"b1",txt:"Hormigón visto terminado en PB.",fecha:"20/06/26"}], fotos:[], archivos:[], informes:[], gastos:[], docs:{} },
  { id:"o2", nombre:"Puentes 132", ap:"norte", sector:"Refacción integral", estado:"curso", avance:41, inicio:"02/04/26", cierre:"15/09/26", monto:"7.900.000 $", pagado:3000000, obs:[], fotos:[], archivos:[], informes:[], gastos:[], docs:{} },
  { id:"o3", nombre:"Golf 2–93", ap:"caba", sector:"Obra nueva", estado:"curso", avance:23, inicio:"20/05/26", cierre:"20/12/26", monto:"21.000.000 $", pagado:0, obs:[], fotos:[], archivos:[], informes:[], gastos:[], docs:{} },
  { id:"o4", nombre:"Canning 815", ap:"sur", sector:"Fachada Alucobond", estado:"pausada", avance:88, inicio:"05/01/26", cierre:"10/07/26", monto:"15.500.000 $", pagado:13600000, obs:[], fotos:[], archivos:[], informes:[], gastos:[], docs:{} },
  { id:"o5", nombre:"A 37", ap:"caba", sector:"Fit-out comercial", estado:"terminada", avance:100, inicio:"01/11/25", cierre:"28/02/26", monto:"9.200.000 $", pagado:9200000, obs:[], fotos:[], archivos:[], informes:[], gastos:[], docs:{} },
];
const SAMPLE_LICS = [
  { id:"l1", nombre:"Refacción Terminal B", ap:"norte", estado:"presupuesto", monto:"18.000.000 $", fecha:"12/06/26", sector:"Terminal B", docs:{}, visitas:[] },
  { id:"l2", nombre:"Oficinas Copeland Suipacha", ap:"caba", estado:"presentada", monto:"6.400.000 $", fecha:"02/06/26", sector:"Piso 25", docs:{}, visitas:[] },
  { id:"l3", nombre:"Obra Saavedra", ap:"caba", estado:"visitar", monto:"", fecha:"28/06/26", sector:"Lote", docs:{}, visitas:[] },
  { id:"l4", nombre:"Castores 475", ap:"norte", estado:"adjudicada", monto:"12.400.000 $", fecha:"01/03/26", sector:"Vivienda", docs:{}, visitas:[], lic_id:"l4" },
];
const SAMPLE_PERSONAL = [
  { id:"p1", nombre:"Héctor Ayala", rol:"Director Técnico", empresa:"V+V Construcciones", obra_id:"o1", telefono:"", foto:"", tareas:[], docs:{art:{nombre:"art.pdf",vence:""},dni:{nombre:"dni.pdf"}} },
  { id:"p2", nombre:"Marcos Giménez", rol:"Capataz", empresa:"V+V Construcciones", obra_id:"o2", telefono:"", foto:"", tareas:[], docs:{} },
];
const SAMPLE_ALERTS = [
  { id:"a1", msg:"Marcos Giménez: ART vence en 3 días", prioridad:"alta" },
  { id:"a2", msg:"Canning 815: 88% pagado pero obra pausada", prioridad:"alta" },
  { id:"a3", msg:"Obra Saavedra: presentación de avance pendiente", prioridad:"media" },
];

// Viñeta de sección (hilo de bronce) — la firma que se repite.
function Eyebrow({ children, light }) {
  return (<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:11 }}>
    <span style={{ width:18, height:2, background:BRASS, flexShrink:0 }} />
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase", color: light ? "rgba(255,255,255,.7)" : T.muted }}>{children}</span>
  </div>);
}

// Encabezado tipo membrete institucional.
function BrandHeader({ cfg }) {
  const l1 = cfg?.logoEmpresa2, l2 = cfg?.logoEmpresa;
  const tieneLogo = l1 || l2;
  const ls = cfg?.logoSize || 100;
  const f = ls / 72;
  return (
    <div style={{ background:"var(--card,#fff)", flexShrink:0, borderBottom:"1px solid var(--border,#E6E9EE)" }}>
      <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center", padding:"18px 56px 16px" }}>
        {tieneLogo ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20 }}>
            {l1 && <img src={l1} alt="" style={{ maxHeight:ls, maxWidth:ls*4.2, objectFit:"contain" }} />}
            {l2 && <img src={l2} alt="" style={{ maxHeight:ls, maxWidth:ls*4.2, objectFit:"contain" }} />}
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:Math.round(15*f) }}>
            <div style={{ width:Math.round(62*f), height:Math.round(62*f), background:"var(--navy,#101C2C)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:Math.round(21*f), fontWeight:800, letterSpacing:"0.02em", borderBottom:`3px solid ${BRASS}` }}>V+V</div>
            <div style={{ lineHeight:1.25, textAlign:"left" }}>
              <div style={{ fontSize:Math.round(10*f), fontWeight:700, color:"var(--muted,#97A0AE)", letterSpacing:"0.26em", textTransform:"uppercase", marginBottom:4 }}>Construcción · Obra</div>
              <div style={{ fontSize:Math.round(21*f), fontWeight:800, color:"var(--text,#131C2B)", letterSpacing:"0.1em", textTransform:"uppercase" }}>V+V Construcciones</div>
            </div>
          </div>
        )}
        <div style={{ position:"absolute", right:16, top:"50%", transform:"translateY(-50%)", width:34, height:34, borderRadius:"50%", background:"var(--al,#EAEEF3)", border:"1px solid var(--border,#E6E9EE)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"var(--accent,#1E3A5F)", flexShrink:0 }}>S</div>
      </div>
      <div style={{ height:2, background:BRASS, width:"100%" }} />
    </div>
  );
}

// Cabecera premium para pantallas propias.
function PageHead({ eyebrow, title, sub, back, onBack }) {
  return (<div style={{ background:"var(--card,#fff)", borderBottom:"1px solid var(--border,#E6E9EE)", padding:"16px 20px 15px", position:"sticky", top:0, zIndex:10 }}>
    <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
      {back && <button onClick={onBack} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, width:32, height:32, fontSize:15, color:T.sub, cursor:"pointer", flexShrink:0 }}>←</button>}
      <div style={{ flex:1 }}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <div style={{ fontSize:22, fontWeight:800, color:T.text, letterSpacing:"-0.01em", lineHeight:1.1 }}>{title}</div>
        {sub && <div style={{ fontSize:12.5, color:T.muted, marginTop:4 }}>{sub}</div>}
      </div>
    </div>
  </div>);
}

function CargarView({ obras, cfg, apiKey }) {
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [fotos, setFotos] = useState([]);
  const [informe, setInforme] = useState("");
  const [loading, setLoading] = useState(false);
  const camRef = useRef(null), galRef = useRef(null);
  const obra = obras.find(o => o.id === obraId);
  async function add(e){ const files=Array.from(e.target.files); if(!files.length) return; const nuevas=await Promise.all(files.map(async f=>({ id:uid(), url:await toDataUrl(f) }))); setFotos(p=>[...p,...nuevas]); e.target.value=""; }
  async function analizar(){
    if(!fotos.length){ setInforme("Agregá al menos una foto."); return; }
    setLoading(true); setInforme("");
    const content=[];
    fotos.slice(-8).forEach(f=>{ try{ content.push({ type:'image', source:{ type:'base64', media_type:getMediaType(f.url), data:getBase64(f.url) } }); }catch{} });
    content.push({ type:'text', text:`Analizá estas ${Math.min(fotos.length,8)} fotos de la obra "${obra?.nombre||''}" (${obra?.sector||'—'}, avance ${obra?.avance||0}%). Informe profesional V+V: estado general, avance estimado, trabajos en ejecución, correcciones, alertas de seguridad y conclusión. Español rioplatense.` });
    const r = await callAI([{ role:'user', content }], "Sos inspector de obras de V+V Construcciones. Generás informes técnicos en español rioplatense.", apiKey, true);
    setInforme(r); setLoading(false);
  }
  return (<div style={{ flex:1, overflowY:"auto", paddingBottom:80 }}>
    <PageHead eyebrow="Relevamiento" title="Registro de avance" sub="Fotografías e informe asistido" />
    <div style={{ padding:"16px 20px" }}>
      <Field label="Obra"><Sel value={obraId} onChange={e=>setObraId(e.target.value)}>{obras.map(o=><option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      <input ref={camRef} type="file" accept="image/*" capture="environment" multiple onChange={add} style={{ display:"none" }} />
      <input ref={galRef} type="file" accept="image/*" multiple onChange={add} style={{ display:"none" }} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, margin:"6px 0 14px" }}>
        <button onClick={()=>camRef.current?.click()} style={{ background:T.navy, border:"none", borderRadius:T.rsm, padding:"13px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z"/><path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3H6a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0z" clipRule="evenodd"/></svg>
          Tomar foto
        </button>
        <button onClick={()=>galRef.current?.click()} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"13px", color:T.text, fontSize:13, fontWeight:600, cursor:"pointer" }}>Galería / PC</button>
      </div>
      {fotos.length>0 && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:14 }}>
        {fotos.map(f=>(<div key={f.id} style={{ position:"relative", borderRadius:T.rsm, overflow:"hidden", border:`1px solid ${T.border}` }}>
          <img src={f.url} alt="" style={{ width:"100%", aspectRatio:"1", objectFit:"cover" }} />
          <button onClick={()=>setFotos(p=>p.filter(x=>x.id!==f.id))} style={{ position:"absolute", top:4, right:4, width:20, height:20, borderRadius:4, background:"rgba(16,28,44,.72)", border:"none", color:"#fff", cursor:"pointer", fontSize:10 }}>✕</button>
        </div>))}
      </div>}
      <button onClick={analizar} disabled={loading} style={{ width:"100%", background:loading?"#94A3B8":T.accent, border:"none", borderRadius:T.rsm, padding:"14px", color:"#fff", fontSize:14, fontWeight:600, letterSpacing:"0.01em", cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        {loading ? <><div style={{ width:16, height:16, border:"2px solid rgba(255,255,255,.35)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin .8s linear infinite" }} />Analizando…</> : "Generar informe"}
      </button>
      {!apiKey && <div style={{ fontSize:11, color:T.muted, textAlign:"center", marginTop:8 }}>La IA requiere tu API Key (Más → Configuración).</div>}
      {informe && <Card style={{ padding:"16px", marginTop:14 }}>
        <Eyebrow>Informe</Eyebrow>
        <div style={{ background:T.bg, borderRadius:T.rsm, padding:"13px 15px", fontSize:12, color:T.text, lineHeight:1.7, whiteSpace:"pre-wrap", maxHeight:320, overflowY:"auto" }}>{informe}</div>
      </Card>}
    </div>
  </div>);
}

function MIcon({ id }){
  const p = { stroke:"currentColor", strokeWidth:1.5, fill:"none", strokeLinecap:"round", strokeLinejoin:"round" };
  const m = {
    cliente:<><path {...p} d="M3 21h18"/><path {...p} d="M5 21V7l7-4 7 4v14"/><path {...p} d="M10 21v-5h4v5"/></>,
    mensajes:<><path {...p} d="M4 5h16v11H8l-4 4z"/></>,
    pedidos:<><path {...p} d="M9 5h6M9 9h6M9 13h4"/><rect {...p} x="5" y="3" width="14" height="18" rx="2"/><path {...p} d="M9 17l1.5 1.5L13 16"/></>,
    gestion:<><path {...p} d="M4 20V10M10 20V4M16 20v-7M20 20H3"/></>,
    formularios:<><rect {...p} x="5" y="3" width="14" height="18" rx="2"/><path {...p} d="M9 7h6M9 11h6M9 15h4"/></>,
    proyectos:<><path {...p} d="M7 3h7l4 4v14H7z"/><path {...p} d="M14 3v4h4"/></>,
    seguimiento:<><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M12 8v4l3 2"/></>,
    materiales:<><rect {...p} x="4" y="7" width="16" height="13" rx="1"/><path {...p} d="M4 10h16"/></>,
    subcontratos:<><circle {...p} cx="9" cy="9" r="3"/><path {...p} d="M15 7l5 5-3 3-5-5"/></>,
    informes:<><path {...p} d="M10 3h4v5l3 9a2 2 0 01-2 3H9a2 2 0 01-2-3l3-9z"/></>,
    gantt:<><path {...p} d="M4 7h9M4 12h13M4 17h7"/></>,
    contactos:<><circle {...p} cx="12" cy="9" r="3"/><path {...p} d="M5 20a7 7 0 0114 0"/></>,
    proveedores:<><rect {...p} x="2" y="8" width="11" height="8"/><path {...p} d="M13 10h4l4 3v3h-8"/><circle {...p} cx="7" cy="18" r="1.6"/><circle {...p} cx="17" cy="18" r="1.6"/></>,
    vigilancia:<><path {...p} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle {...p} cx="12" cy="12" r="3"/></>,
    presentismo:<><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M8 12l3 3 5-6"/></>,
    archivos:<><path {...p} d="M3 7h6l2 2h10v10H3z"/></>,
    info:<><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></>,
    resumen:<><path {...p} d="M5 19V9M12 19V5M19 19v-7"/></>,
    cotizacion:<><circle {...p} cx="12" cy="12" r="9"/><path {...p} d="M12 7v10M9.5 9.5a2.5 2 0 012.5-1.5c1.4 0 2.5.7 2.5 1.8 0 2.4-5 1.4-5 3.6 0 1.1 1.1 1.8 2.5 1.8a2.5 2 0 002.5-1.5"/></>,
    herramientas:<><path {...p} d="M14 7a3 3 0 00-4 4l-6 6 2 2 6-6a3 3 0 004-4l-2 2-2-2 2-2z"/></>,
    dias:<><rect {...p} x="4" y="5" width="16" height="16" rx="1"/><path {...p} d="M4 9h16M8 3v4M16 3v4"/></>,
    alertas:<><rect {...p} x="7" y="3" width="10" height="18" rx="2"/><path {...p} d="M11 18h2"/></>,
    config:<><circle {...p} cx="12" cy="12" r="3"/><path {...p} d="M19 12a7 7 0 00-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 00-1.7-1l-.3-2.5h-4l-.3 2.5a7 7 0 00-1.7 1l-2.3-1-2 3.5L4.1 11a7 7 0 000 2l-2 1.5 2 3.5 2.3-1a7 7 0 001.7 1l.3 2.5h4l.3-2.5a7 7 0 001.7-1l2.3 1 2-3.5-2-1.5a7 7 0 00.1-1z"/></>,
  };
  return <svg width="21" height="21" viewBox="0 0 24 24">{m[id]||m.proyectos}</svg>;
}

const MAS_TILES = [
  { id:"personal", label:"Personal" },
  { id:"matpedidos", label:"Pedido de materiales" },
  { id:"documentacion", label:"Documentación" },
  { id:"cliente", label:"Panel cliente" },
  { id:"pedidos", label:"Pedidos" },
  { id:"gestion", label:"Plan de gestión" },
  { id:"proyectos", label:"Proyectos", go:"proyectos" },
  { id:"seguimiento", label:"Seguimiento" }, { id:"materiales", label:"Materiales" },
  { id:"subcontratos", label:"Subcontratos" },
  { id:"gantt", label:"Gantt" }, { id:"contactos", label:"Contactos" },
  { id:"proveedores", label:"Proveedores" }, { id:"vigilancia", label:"Vigilancia" },
  { id:"presentismo", label:"Presentismo" }, { id:"archivos", label:"Archivos" },
  { id:"info", label:"Info externa" }, { id:"resumen", label:"Resumen" },
  { id:"cotizacion", label:"Cotización" }, { id:"herramientas", label:"Herramientas" },
  { id:"dias", label:"Días trabajados" }, { id:"alertas", label:"Alertas WA" },
];

function Adjuntos({ items = [], onChange }) {
  const fRef = useRef(null); const aRef = useRef(null);
  const [sub, setSub] = useState(false);
  async function up(e, tipo) {
    const files = Array.from(e.target.files); if (!files.length) return;
    setSub(true); const nuevos = [];
    for (const f of files) {
      const data = await toDataUrl(f);
      const url = await uploadFoto(data, "adjuntos", `${Date.now()}_${(f.name || "arch").replace(/[^\w.\-]+/g, "_")}`);
      nuevos.push({ id: uid(), nombre: f.name || "archivo", url, tipo, fecha: hoyStr() });
    }
    onChange([...(items || []), ...nuevos]); setSub(false); e.target.value = "";
    if (nuevos.some(n => !mediaStorage.isRemoteUrl(n.url))) alert("⚠ Quedó guardado en este dispositivo pero no se pudo subir a la nube. Revisá el bucket 'bco-media' en Supabase para que se sincronice y lo vean todos.");
  }
  function del(id) { onChange((items || []).filter(x => x.id !== id)); }
  const fotos = (items || []).filter(a => a.tipo === "foto");
  const arch = (items || []).filter(a => a.tipo !== "foto");
  return (<div style={{ marginTop: 8 }}>
    <input ref={fRef} type="file" accept="image/*" multiple onChange={e => up(e, "foto")} style={{ display: "none" }} />
    <input ref={aRef} type="file" multiple onChange={e => up(e, "archivo")} style={{ display: "none" }} />
    <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Fotos y archivos{(items || []).length ? ` (${(items || []).length})` : ""}</div>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <button onClick={() => fRef.current && fRef.current.click()} disabled={sub} style={{ flex: 1, background: T.al, color: T.accent, border: `1px solid ${T.accent}`, borderRadius: T.rsm, padding: "9px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>📷 Foto</button>
      <button onClick={() => aRef.current && aRef.current.click()} disabled={sub} style={{ flex: 1, background: T.al, color: T.accent, border: `1px solid ${T.accent}`, borderRadius: T.rsm, padding: "9px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>📎 Archivo</button>
    </div>
    {sub && <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 8 }}>Subiendo…</div>}
    {fotos.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 8 }}>{fotos.map(a => (<div key={a.id} style={{ position: "relative" }}><a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, border: `1px solid ${T.border}`, display: "block" }} /></a><button onClick={() => del(a.id)} style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 11, cursor: "pointer" }}>✕</button></div>))}</div>}
    {arch.map(a => (<div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 11px", marginBottom: 6 }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>📎 {a.nombre}</div><div style={{ fontSize: 10, color: T.muted }}>{a.fecha}</div></div><a href={a.url} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: 700, fontSize: 12, textDecoration: "none", flexShrink: 0 }}>Abrir ↗</a><button onClick={() => del(a.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button></div>))}
  </div>);
}
function DocumentacionView({ db, cfg, onBack }) {
  const documentacion = db.documentacion || [];
  const setDocumentacion = db.setDocumentacion;
  const CATS = ["Planillas modelo", "Formularios modelo", "Contratos / Legal", "Instructivos", "Certificados modelo", "Planos", "Presupuestos", "Certificaciones", "Notas de pedido", "Actas", "Otros"];
  const usadas = [...new Set((db.documentacion || []).map(d => d.cat).filter(Boolean))];
  const allCats = [...CATS, ...usadas.filter(c => !CATS.includes(c))];
  const [cat, setCat] = useState(CATS[0]);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef(null);
  function onCatChange(e) {
    if (e.target.value === "__new__") { const n = prompt("Nombre de la nueva carpeta:"); if (n && n.trim()) setCat(n.trim()); return; }
    setCat(e.target.value);
  }
  async function subir(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSubiendo(true);
    const nuevos = [];
    for (const f of files) {
      const data = await toDataUrl(f);
      const url = await uploadFoto(data, "documentacion", `${Date.now()}_${f.name.replace(/[^\w.\-]+/g, "_")}`);
      nuevos.push({ id: uid(), nombre: f.name, url, cat, fecha: hoyStr() });
    }
    setDocumentacion(p => [...nuevos, ...(p || [])]);
    setSubiendo(false);
    e.target.value = "";
    if (nuevos.some(n => !mediaStorage.isRemoteUrl(n.url))) alert("⚠ El archivo quedó guardado en este dispositivo pero no se pudo subir a la nube. Revisá el bucket de fotos en Supabase.");
  }
  function borrar(id) { if (confirm("¿Eliminar este documento?")) setDocumentacion(p => (p || []).filter(x => x.id !== id)); }
  const porCat = allCats.map(c => ({ c, items: documentacion.filter(d => d.cat === c) })).filter(g => g.items.length);
  return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
      <PageHead title="Documentación" sub="Modelos de planillas y archivos de uso" back onBack={onBack} />
      <div style={{ padding: "0 16px" }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.r, padding: 14, marginBottom: 16, boxShadow: T.shadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9 }}>Subir modelo / archivo</div>
          <label style={{ fontSize: 11, color: T.muted }}>Carpeta</label>
          <select value={cat} onChange={onCatChange} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text, margin: "6px 0 12px" }}>{allCats.map(c => <option key={c} value={c}>{c}</option>)}<option value="__new__">＋ Nueva carpeta…</option></select>
          <input ref={inputRef} type="file" multiple onChange={subir} style={{ display: "none" }} />
          <button onClick={() => inputRef.current && inputRef.current.click()} disabled={subiendo} style={{ width: "100%", background: T.navy, color: "#fff", border: "none", borderRadius: T.rsm, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", borderBottom: `2px solid ${BRASS}` }}>{subiendo ? "Subiendo…" : "＋ Elegir archivo(s)"}</button>
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>Sirve para PDF, Word, Excel, imágenes. Quedan disponibles para todo el equipo y se sincronizan entre dispositivos.</div>
        </div>
        {porCat.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "26px 18px", lineHeight: 1.55 }}>Todavía no hay documentos.<br />Subí acá los modelos de planillas, formularios y archivos que están usando.</div>}
        {porCat.map(g => (
          <div key={g.c} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: BRASS, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{g.c} ({g.items.length})</div>
            {g.items.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 12px", marginBottom: 7 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{d.nombre}</div>
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{d.fecha}</div>
                </div>
                <a href={d.url} target="_blank" rel="noreferrer" style={{ color: T.accent, fontWeight: 700, fontSize: 12, textDecoration: "none", flexShrink: 0 }}>Abrir ↗</a>
                <button onClick={() => borrar(d.id)} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
function MatPedidosView({ db, cfg, onBack }) {
  const { obras, matpedidos = [], setMatpedidos, personal = [] } = db;
  const cn = cfg?.clienteSigla || cfg?.clienteNombre || "Belfast";
  const [form, setForm] = useState(null);
  const [waFor, setWaFor] = useState(null);
  function waText(p) {
    const lines = p.items.map(it => `• ${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim());
    return `*Pedido de materiales* — ${obraNom(obras, p.obra_id)}\nFecha: ${p.fecha}${p.de === "contratista" && p.empresa ? `\nContratista: ${p.empresa}` : ""}\n\n${lines.join("\n")}${p.nota ? "\n\nNota: " + p.nota : ""}\n\n✅ Por favor, confirmá la recepción respondiendo este mensaje con *OK / RECIBIDO*.\n\n(Enviado desde V+V Construcciones)`;
  }
  function marcarEnviado(id) { setMatpedidos(prev => (prev || []).map(x => x.id === id ? { ...x, waEnviado: true, waEnviadoFecha: hoyStr(), waEnviadoPor: "V+V" } : x)); }
  function waLink(text, phone) {
    const t = encodeURIComponent(text);
    if (phone) { const clean = String(phone).replace(/\D/g, ""); const num = clean.startsWith("54") ? clean : ("549" + clean); return `https://wa.me/${num}?text=${t}`; }
    return `https://wa.me/?text=${t}`;
  }
  function nuevo() { setForm({ obra_id: obras[0]?.id || "", items: [{ nombre: "", cantidad: "", unidad: "u" }], nota: "" }); }
  function addItem() { setForm(f => ({ ...f, items: [...f.items, { nombre: "", cantidad: "", unidad: "u" }] })); }
  function setItem(i, k, v) { setForm(f => ({ ...f, items: f.items.map((it, j) => j === i ? { ...it, [k]: v } : it) })); }
  function delItem(i) { setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) })); }
  function guardar() {
    const items = (form.items || []).filter(it => (it.nombre || "").trim());
    if (!items.length) { alert("Agregá al menos un material."); return; }
    const p = { id: uid() + Date.now(), obra_id: form.obra_id, items, nota: form.nota || "", fecha: hoyStr(), ts: Date.now(), de: "vv", leido: false, leidoFecha: "" };
    setMatpedidos(prev => [p, ...(prev || [])]); setForm(null);
    pushNotify("Nuevo pedido de materiales", `V+V · ${obraNom(obras, form.obra_id)}: ${items.map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ").slice(0, 80)}`, "belfast");
    alert(`✓ Pedido de materiales enviado a ${cn}. Le queda como NO LEÍDO hasta que lo levante.`);
  }
  function borrar(id) { if (confirm("¿Eliminar este pedido de materiales?")) setMatpedidos(prev => (prev || []).filter(x => x.id !== id)); }
  const lista = (matpedidos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="materiales" label="Pedido de materiales" sub={`Registro · enviado a ${cn}`} onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <button onClick={nuevo} style={{ width: "100%", background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>＋ Nuevo pedido de materiales</button>
      {lista.length === 0 && <EmptyMsg>Sin pedidos de materiales todavía.</EmptyMsg>}
      {lista.map(p => { const jefes = (personal || []).filter(pe => pe.obra_id === p.obra_id && (pe.telefono || "").trim()); return (<Card key={p.id} style={{ padding: 13, marginBottom: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{obraNom(obras, p.obra_id) || "Sin obra"} · {p.fecha}{p.de === "contratista" && <span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 800, color: "#fff", background: BRASS, borderRadius: 5, padding: "2px 7px" }}>{p.empresa || "Contratista"}</span>}</div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>{p.items.map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(" · ")}</div>
            {p.nota && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4, fontStyle: "italic" }}>{p.nota}</div>}
            <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 6, color: p.leido ? "#16A34A" : "#B45309" }}>{p.leido ? `✓ Levantado por ${cn}${p.leidoFecha ? " · " + p.leidoFecha : ""}` : `● No leído por ${cn}`}</div>
            {p.waEnviado && <div style={{ fontSize: 10, fontWeight: 700, color: "#0E7490", marginTop: 3 }}>📲 Enviado por WhatsApp{p.waEnviadoFecha ? " · " + p.waEnviadoFecha : ""}{p.waEnviadoPor ? " · " + p.waEnviadoPor : ""}</div>}
          </div>
          <button onClick={() => borrar(p.id)} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 6, width: 30, height: 30, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>
        <button onClick={() => setWaFor(waFor === p.id ? null : p.id)} style={{ width: "100%", marginTop: 10, background: "#25D366", color: "#fff", border: "none", borderRadius: T.rsm, padding: "9px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>📲 Enviar por WhatsApp a los jefes de obra</button>
        {waFor === p.id && <div style={{ marginTop: 9, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 11px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Enviar a…</div>
          {jefes.map(j => <a key={j.id} href={waLink(waText(p), j.telefono)} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", marginBottom: 7 }}>📲 {j.nombre}{j.rol ? ` · ${j.rol}` : ""}</a>)}
          <a href={waLink(waText(p))} target="_blank" rel="noreferrer" onClick={() => { marcarEnviado(p.id); setWaFor(null); }} style={{ display: "block", background: T.card, color: T.accent, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Elegir contacto de WhatsApp…</a>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>Los jefes de obra con teléfono cargado (en Personal) aparecen arriba para enviar directo.</div>
        </div>}
      </Card>); })}
    </div>
    {form && <Sheet title="Nuevo pedido de materiales" onClose={() => setForm(null)}>
      <Field label="Obra"><Sel value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", margin: "6px 0 8px" }}>Materiales</div>
      {form.items.map((it, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <input value={it.nombre} onChange={e => setItem(i, "nombre", e.target.value)} placeholder="Material" style={{ flex: 2, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 11px", fontSize: 13, color: T.text }} />
        <input value={it.cantidad} onChange={e => setItem(i, "cantidad", e.target.value)} placeholder="Cant." type="number" style={{ width: 62, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 8px", fontSize: 13, color: T.text }} />
        <input value={it.unidad} onChange={e => setItem(i, "unidad", e.target.value)} placeholder="u" style={{ width: 54, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 8px", fontSize: 13, color: T.text }} />
        {form.items.length > 1 && <button onClick={() => delItem(i)} style={{ background: "none", border: "none", color: T.muted, fontSize: 15, cursor: "pointer" }}>✕</button>}
      </div>))}
      <button onClick={addItem} style={{ background: T.al, color: T.accent, border: "none", borderRadius: T.rsm, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>＋ Agregar material</button>
      <Field label="Nota (opcional)"><textarea value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} rows={2} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text }} /></Field>
      <PBtn full onClick={guardar} style={{ marginTop: 6 }}>Enviar pedido a {cn}</PBtn>
    </Sheet>}
  </div>);
}
function MasView({ cfg, setCfg, sub, setSub, goView, db, apiKey }) {
  if (sub === "config") return <MasConfig cfg={cfg} setCfg={setCfg} onBack={()=>setSub(null)} />;
  if (sub) {
    const back = ()=>setSub(null);
    const P = { db, cfg, apiKey, onBack:back };
    switch (sub) {
      case "seguimiento": return <SeguimientoView {...P} />;
      case "materiales": return <MaterialesView {...P} />;
      case "subcontratos": return <SubcontratosView {...P} />;
      case "informes": return <InformesView {...P} />;
      case "gantt": return <GanttView {...P} />;
      case "contactos": return <ContactosView {...P} />;
      case "proveedores": return <ProveedoresView {...P} />;
      case "vigilancia": return <VigilanciaView {...P} />;
      case "presentismo": return <PresentismoView {...P} />;
      case "archivos": return <ArchivosView {...P} />;
      case "info": return <InfoExternaView {...P} />;
      case "resumen": return <ResumenView {...P} />;
      case "cotizacion": return <CotizacionView {...P} />;
      case "herramientas": return <HerramientasView {...P} />;
      case "dias": return <DiasView {...P} />;
      case "alertas": return <AlertasWaView {...P} />;
      case "cliente": return <ClientePanel {...P} />;
      case "personal": return <PersonalView personal={db.personal} setPersonal={db.setPersonal} obras={db.obras} cfg={cfg} />;
      case "documentacion": return <DocumentacionView db={db} cfg={cfg} onBack={back} />;
      case "matpedidos": return <MatPedidosView db={db} cfg={cfg} onBack={back} />;
      case "pedidos": return <PedidosView {...P} />;
      case "gestion": return <GestionView {...P} />;
      case "formularios": return <FormulariosView {...P} />;
      case "mensajes": return <MensajesVVView {...P} />;
      default: {
        const tile = MAS_TILES.find(t=>t.id===sub);
        return (<div style={{ flex:1, overflowY:"auto", paddingBottom:80 }}>
          <PageHead title={tile?.label||"Módulo"} back onBack={back} />
          <PreviewStub titulo={tile?.label||"Módulo"} />
        </div>);
      }
    }
  }
  const pend = (db?.pedidos || []).filter(p => p.para === "vv" && p.estado !== "resuelto");
  const pendObras = [...new Set(pend.map(p => p.obra_id ? obraNom(db.obras, p.obra_id) : "general").filter(Boolean))].join(", ");
  const tileBtn = (tl, onClick) => { const b = tl.id === "pedidos" ? pend.length : 0; return (
    <button key={tl.id} onClick={onClick} style={{ position:"relative", background:T.card, border:`1px solid ${b>0?"#EF4444":T.border}`, borderRadius:T.rsm, padding:"16px 8px 14px", display:"flex", flexDirection:"column", alignItems:"center", gap:10, cursor:"pointer", boxShadow:T.shadow }}>
      {b>0 && <span style={{ position:"absolute", top:6, right:6, background:"#EF4444", color:"#fff", borderRadius:9, minWidth:18, height:18, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 5px" }}>{b}</span>}
      <div style={{ width:40, height:40, borderRadius:8, background:T.al, color:T.accent, display:"flex", alignItems:"center", justifyContent:"center" }}><MIcon id={tl.id} /></div>
      <div style={{ fontSize:11, fontWeight:600, color:T.text, textAlign:"center", lineHeight:1.25 }}>{tl.label}</div>
    </button>
  ); };
  return (<div style={{ flex:1, overflowY:"auto", paddingBottom:80 }}>
    <PageHead eyebrow="Panel" title="Más" sub="Módulos y configuración del sistema" />
    <div style={{ padding:"16px 20px" }}>
      {pend.length>0 && <div onClick={()=>setSub("pedidos")} style={{ display:"flex", alignItems:"center", gap:11, background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:T.rsm, padding:"12px 14px", marginBottom:16, cursor:"pointer" }}>
        <div style={{ width:30, height:30, borderRadius:"50%", background:"#EF4444", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, flexShrink:0 }}>{pend.length}</div>
        <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:13, fontWeight:700, color:"#991B1B" }}>{pend.length} pedido{pend.length>1?"s":""} pendiente{pend.length>1?"s":""} en Pedidos</div><div style={{ fontSize:11.5, color:"#B91C1C", marginTop:1 }}>{pendObras?`Obras: ${pendObras}`:"Tocá para ver"} →</div></div>
      </div>}
      <Eyebrow>Módulos</Eyebrow>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginBottom:22 }}>
        {MAS_TILES.map(tl=>tileBtn(tl, ()=> tl.go ? goView(tl.go) : setSub(tl.id)))}
      </div>
      <Eyebrow>Sistema</Eyebrow>
      <button onClick={()=>setSub("config")} style={{ width:"100%", background:T.card, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"15px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", boxShadow:T.shadow }}>
        <div style={{ width:42, height:42, borderRadius:8, background:T.navy, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}><MIcon id="config" /></div>
        <div style={{ flex:1, textAlign:"left" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Configuración</div>
          <div style={{ fontSize:11.5, color:T.muted, marginTop:2 }}>Identidad, tema, color, tipografía y API Key</div>
        </div>
        <span style={{ fontSize:16, color:T.muted }}>›</span>
      </button>
    </div>
  </div>);
}

function LogoSlot({ label, value, onSet, onClear }) {
  const ref = useRef(null);
  return (<div style={{ flex:1 }}>
    <input ref={ref} type="file" accept="image/*" style={{ display:"none" }} onChange={async e=>{ if(e.target.files[0]){ const url=await toDataUrl(e.target.files[0]); onSet(url);} e.target.value=""; }} />
    <Lbl>{label}</Lbl>
    {value ? (
      <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"10px", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
        <img src={value} alt="" style={{ maxHeight:44, maxWidth:"100%", objectFit:"contain" }} />
        <div style={{ display:"flex", gap:6, width:"100%" }}>
          <button onClick={()=>ref.current?.click()} style={{ flex:1, background:T.al, border:`1px solid ${T.border}`, borderRadius:5, padding:"6px", fontSize:11, fontWeight:600, color:T.accent, cursor:"pointer" }}>Cambiar</button>
          <button onClick={onClear} style={{ background:"#FBECEC", border:"1px solid #E9C6C6", borderRadius:5, padding:"6px 10px", fontSize:11, color:"#B4453C", cursor:"pointer", fontWeight:600 }}>✕</button>
        </div>
      </div>
    ) : (
      <button onClick={()=>ref.current?.click()} style={{ width:"100%", background:T.bg, border:`1px dashed ${T.border}`, borderRadius:T.rsm, padding:"18px 8px", cursor:"pointer", textAlign:"center", color:T.muted }}>
        <div style={{ fontSize:20, marginBottom:4 }}>＋</div><div style={{ fontSize:11, fontWeight:600 }}>Subir logo</div>
      </button>
    )}
  </div>);
}

function MasConfig({ cfg, setCfg, onBack }) {
  const c = cfg.colors || DEFAULT_COLORS;
  function aplicarPreset(p){ setCfg(prev=>({ ...prev, themeId:p.id, colors:{ accent:p.accent, al:p.al, bg:p.bg, card:p.card, border:p.border, text:p.text, sub:p.sub, muted:p.muted, navy:p.navy } })); }
  function setAccent(val){ setCfg(prev=>({ ...prev, colors:{ ...prev.colors, accent:val, al:hexLight(val) } })); }
  function setColorKey(k,val){ setCfg(prev=>({ ...prev, colors:{ ...prev.colors, [k]:val } })); }
  return (<div style={{ flex:1, overflowY:"auto", paddingBottom:80 }}>
    <PageHead eyebrow="Sistema" title="Configuración" sub="Identidad visual de la app" back onBack={onBack} />
    <div style={{ padding:"16px 20px" }}>
      <Eyebrow>Logotipos</Eyebrow>
      <div style={{ fontSize:11.5, color:T.muted, marginBottom:11, lineHeight:1.5 }}>Sin logo se muestra el texto “V+V Construcciones”.</div>
      <div style={{ display:"flex", gap:10 }}>
        <LogoSlot label="Principal" value={cfg.logoEmpresa2} onSet={u=>setCfg(p=>({...p,logoEmpresa2:u}))} onClear={()=>setCfg(p=>({...p,logoEmpresa2:""}))} />
        <LogoSlot label="Secundario" value={cfg.logoEmpresa} onSet={u=>setCfg(p=>({...p,logoEmpresa:u}))} onClear={()=>setCfg(p=>({...p,logoEmpresa:""}))} />
      </div>
      <div style={{ marginTop:18, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Eyebrow>Tamaño del logo</Eyebrow>
        <span style={{ fontSize:12, fontWeight:700, color:T.accent }}>{cfg.logoSize||100}px</span>
      </div>
      <input type="range" min="44" max="200" value={cfg.logoSize||100} onChange={e=>setCfg(p=>({...p,logoSize:Number(e.target.value)}))} style={{ width:"100%", accentColor:T.accent }} />
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:T.muted, marginTop:2 }}><span>Chico</span><span>Grande</span></div>
      <div style={{ marginTop:20 }}><Eyebrow>Comunicación entre IA</Eyebrow></div>
      <div onClick={()=>setCfg(prev=>({ ...prev, iaAuto: !prev.iaAuto }))} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.card, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"12px 14px", cursor:"pointer", marginBottom:6 }}>
        <div style={{ minWidth:0, paddingRight:12 }}><div style={{ fontSize:13.5, fontWeight:700, color:T.text }}>Respuesta automática entre IA {cfg.iaAuto===false ? "(apagada)" : ""}</div><div style={{ fontSize:11, color:T.muted, marginTop:2, lineHeight:1.45 }}>Prendida: cuando le pedís algo a la IA de la otra empresa (“pedile a la IA de Belfast…”), la otra responde sola. Es segura: responde una vez y se frena si no hay crédito. Apagala solo si querés silencio total entre las IA.</div></div>
        <div style={{ width:44, height:26, borderRadius:13, background: cfg.iaAuto===false ? T.border : "#16A34A", position:"relative", flexShrink:0, transition:"background .2s" }}><div style={{ position:"absolute", top:3, left: cfg.iaAuto===false ? 3 : 21, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left .2s" }} /></div>
      </div>
      <div style={{ marginTop:20 }}><Eyebrow>Panel de cliente</Eyebrow></div>
      <div style={{ fontSize:11.5, color:T.muted, marginBottom:9, lineHeight:1.5 }}>Nombre que aparece en el Panel de cliente y en la app del cliente.</div>
      <input value={cfg.clienteNombre||""} onChange={e=>setCfg(p=>({...p,clienteNombre:e.target.value}))} placeholder="Belfast Construction Management" style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"12px 14px", fontSize:13, color:T.text, marginBottom:8 }} />
      <input value={cfg.clienteSigla||""} onChange={e=>setCfg(p=>({...p,clienteSigla:e.target.value}))} placeholder="Sigla: BELFAST" maxLength={8} style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"12px 14px", fontSize:13, color:T.text }} />
      <div style={{ marginTop:20 }}><Eyebrow>Datos de contacto</Eyebrow></div>
      <div style={{ fontSize:11.5, color:T.muted, marginBottom:10, lineHeight:1.5 }}>Aparecen en el pie y en notas/mails de la app.</div>
      <label style={{ fontSize:11, fontWeight:700, color:T.sub, textTransform:"uppercase", letterSpacing:"0.05em" }}>Email</label>
      <input value={cfg.email||""} onChange={e=>setCfg(p=>({...p,email:e.target.value}))} type="email" placeholder="correo@empresa.com" style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"12px 14px", fontSize:13, color:T.text, margin:"6px 0 12px" }} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div><label style={{ fontSize:11, fontWeight:700, color:T.sub, textTransform:"uppercase", letterSpacing:"0.05em" }}>Teléfono</label><input value={cfg.telefono||""} onChange={e=>setCfg(p=>({...p,telefono:e.target.value}))} placeholder="11 ..." style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"12px 14px", fontSize:13, color:T.text, marginTop:6 }} /></div>
        <div><label style={{ fontSize:11, fontWeight:700, color:T.sub, textTransform:"uppercase", letterSpacing:"0.05em" }}>Ciudad</label><input value={cfg.ciudad||""} onChange={e=>setCfg(p=>({...p,ciudad:e.target.value}))} style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"12px 14px", fontSize:13, color:T.text, marginTop:6 }} /></div>
      </div>
      <div style={{ marginTop:12 }}><label style={{ fontSize:11, fontWeight:700, color:T.sub, textTransform:"uppercase", letterSpacing:"0.05em" }}>Empresa</label><input value={cfg.empresa||""} onChange={e=>setCfg(p=>({...p,empresa:e.target.value}))} style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"12px 14px", fontSize:13, color:T.text, marginTop:6 }} /></div>
      <div style={{ marginTop:20 }}><Eyebrow>API Key de Claude</Eyebrow></div>
      <input value={cfg.apiKey||""} onChange={e=>setCfg(p=>({...p,apiKey:e.target.value}))} placeholder="sk-ant-..." style={{ width:"100%", background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"12px 14px", fontSize:13, color:T.text }} />
      <div style={{ marginTop:20 }}><Eyebrow>Actualizaciones</Eyebrow></div>
      <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"13px 14px" }}>
        <div style={{ fontSize:12.5, color:T.text, marginBottom:4 }}>Versión instalada: <b>build 01-07-IA</b></div>
        <div style={{ fontSize:11.5, color:T.muted, marginBottom:11, lineHeight:1.5 }}>Trae la última versión y todo lo último cargado (fotos, archivos, pedidos y cambios de cualquier dispositivo). Limpia la caché.</div>
        <button onClick={()=>{ try{ if(window.caches) caches.keys().then(ks=>ks.forEach(k=>caches.delete(k))); }catch(e){} location.replace(location.pathname+"?sync="+Date.now()); }} style={{ width:"100%", background:T.accent, color:"#fff", border:"none", borderRadius:T.rsm, padding:"12px", fontSize:13.5, fontWeight:700, cursor:"pointer" }}>Actualizar y traer lo último</button>
      </div>
      <div style={{ marginTop:20 }}><Eyebrow>Tema</Eyebrow></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        {THEME_PRESETS.map(p=>{ const sel=cfg.themeId===p.id; return (<button key={p.id} onClick={()=>aplicarPreset(p)} style={{ background:p.card, border:`${sel?2:1}px solid ${sel?p.accent:T.border}`, borderRadius:T.rsm, padding:"11px 8px", cursor:"pointer", textAlign:"center" }}>
          <div style={{ display:"flex", gap:4, justifyContent:"center", marginBottom:6 }}><span style={{ width:15, height:15, borderRadius:3, background:p.accent }} /><span style={{ width:15, height:15, borderRadius:3, background:p.bg, border:`1px solid ${p.border}` }} /><span style={{ width:15, height:15, borderRadius:3, background:p.navy }} /></div>
          <div style={{ fontSize:11, fontWeight:600, color:p.text }}>{p.label}</div></button>); })}
      </div>
      <div style={{ marginTop:20 }}><Eyebrow>Color principal</Eyebrow></div>
      <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
        {["#1E3A5F","#101C2C","#1F5C49","#6E3B2E","#46406E","#0E5A66","#7A2E50","#B0894F","#1F2937"].map(col=>(<button key={col} onClick={()=>setAccent(col)} style={{ width:32, height:32, borderRadius:5, background:col, border:`2px solid ${c.accent===col?T.text:T.border}`, cursor:"pointer" }} />))}
        <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:T.sub, cursor:"pointer" }}><input type="color" value={c.accent} onChange={e=>setAccent(e.target.value)} style={{ width:32, height:32, border:"none", background:"none", cursor:"pointer" }} />Personalizado</label>
      </div>
      <div style={{ marginTop:20 }}><Eyebrow>Colores avanzados</Eyebrow></div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {COLOR_KEYS.map(ck=>(<label key={ck.k} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, background:T.bg, border:`1px solid ${T.border}`, borderRadius:T.rsm, padding:"9px 11px", cursor:"pointer" }}><span style={{ fontSize:12, color:T.sub, fontWeight:600 }}>{ck.label}</span><input type="color" value={c[ck.k]||"#000000"} onChange={e=>setColorKey(ck.k,e.target.value)} style={{ width:30, height:26, border:"none", background:"none", cursor:"pointer" }} /></label>))}
      </div>
      <div style={{ marginTop:20 }}><Eyebrow>Tipografía</Eyebrow></div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {FONTS.map(f=>{ const sel=cfg.fontId===f.id; return <button key={f.id} onClick={()=>setCfg(p=>({...p,fontId:f.id}))} style={{ padding:"9px 15px", borderRadius:T.rsm, border:`1px solid ${sel?T.accent:T.border}`, background:sel?T.al:T.card, color:sel?T.accent:T.sub, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:f.value+",sans-serif" }}>{f.label}</button>; })}
      </div>
      <div style={{ marginTop:20 }}><Eyebrow>Forma de los elementos</Eyebrow></div>
      <div style={{ display:"flex", gap:6 }}>
        {RADIUS_OPTS.map(r=>{ const sel=cfg.radiusId===r.id; return <button key={r.id} onClick={()=>setCfg(p=>({...p,radiusId:r.id}))} style={{ flex:1, padding:"11px 4px", border:`1px solid ${sel?T.accent:T.border}`, background:sel?T.al:T.card, color:sel?T.accent:T.sub, fontSize:12, fontWeight:600, cursor:"pointer", borderRadius:r.r }}>{r.label}</button>; })}
      </div>
      <button onClick={()=>setCfg({ ...DEFAULT_CONFIG, themeId:"institucional", fontId:"inter", radiusId:"sharp", colors:{...INST_COLORS}, apiKey:cfg.apiKey })} style={{ width:"100%", marginTop:24, background:T.navy, border:"none", borderRadius:T.rsm, padding:"12px", fontSize:13, fontWeight:600, color:"#fff", cursor:"pointer" }}>Restablecer diseño institucional</button>
    </div>
  </div>);
}

function PreviewStub({ titulo }) {
  return (<div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center", color:T.muted }}>
    <div style={{ width:52, height:52, borderRadius:8, background:T.bg, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16, color:T.sub }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
    </div>
    <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:6 }}>{titulo}</div>
    <div style={{ fontSize:12, lineHeight:1.55, maxWidth:280 }}>Este módulo no quedó guardado al comprimirse la conversación. Subí tu archivo .jsx completo para recuperarlo.</div>
  </div>);
}

const NAV = [
  { id:"chat", label:"IA" }, { id:"dashboard", label:"Inicio" }, { id:"obras", label:"Obras" },
  { id:"personal", label:"Personal" }, { id:"cargar", label:"Cargar", fab:true }, { id:"mas", label:"Más" },
];


// ════════════════════════════════════════════════════════════════════
// MÓDULOS RECONSTRUIDOS — V+V Construcciones
// Personal · Asistente IA · y los 16 módulos de "Más", funcionales y
// enganchados al estado real (db) con persistencia local + Supabase.
// ════════════════════════════════════════════════════════════════════

const money = (n) => (Number(n) || 0).toLocaleString("es-AR") + " $";
const obraNom = (obras, id) => obras.find(o => o.id === id)?.nombre || "—";
const personaNom = (personal, id) => personal.find(p => p.id === id)?.nombre || "—";
const hoyStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`; };
const waLink = (tel, txt) => `https://wa.me/${String(tel || "").replace(/[^\d]/g, "")}${txt ? `?text=${encodeURIComponent(txt)}` : ""}`;

function EmptyMsg({ children }) {
  return <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "38px 18px", lineHeight: 1.65 }}>{children}</div>;
}
function SubHead({ id, label, sub, onBack }) {
  return (<div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "14px 20px 13px", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12 }}>
    <button onClick={onBack} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, width: 32, height: 32, fontSize: 15, color: T.sub, cursor: "pointer", flexShrink: 0 }}>←</button>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MIcon id={id} /></div>
    <div style={{ flex: 1, lineHeight: 1.2 }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>);
}
function AddFab({ onClick, label = "Agregar" }) {
  return <button onClick={onClick} style={{ position: "absolute", right: 18, bottom: 86, background: T.navy, color: "#fff", border: `2px solid ${BRASS}`, borderRadius: 30, padding: "12px 18px", fontSize: 13, fontWeight: 700, boxShadow: "0 6px 16px rgba(16,28,44,.32)", cursor: "pointer", zIndex: 50 }}>＋ {label}</button>;
}
function MiniStat({ label, value, color }) {
  return (<div style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 12px", boxShadow: T.shadow }}>
    <div style={{ fontSize: 19, fontWeight: 800, color: color || T.text, letterSpacing: "-0.01em" }}>{value}</div>
    <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>{label}</div>
  </div>);
}
function RowItem({ onClick, children, onDelete }) {
  return (<div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 14px", marginBottom: 9, boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12 }}>
    <div onClick={onClick} style={{ flex: 1, cursor: onClick ? "pointer" : "default", minWidth: 0 }}>{children}</div>
    {onDelete && <button onClick={onDelete} style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: 6, width: 30, height: 30, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>✕</button>}
  </div>);
}

// ── PERSONAL ─────────────────────────────────────────────────────────
function PersonalView({ personal, setPersonal, obras, cfg }) {
  const [form, setForm] = useState(null);       // null | {} para nuevo
  const [detalle, setDetalle] = useState(null);  // trabajador en detalle
  const fotoRef = useRef(null);
  const obraIdsDe = (p) => (p?.obra_ids && p.obra_ids.length) ? p.obra_ids : (p?.obra_id ? [p.obra_id] : []);
  const obrasNombres = (p) => { const ns = obraIdsDe(p).map(id => obraNom(obras, id)).filter(n => n && n !== "—"); return ns.length ? ns.join(", ") : "Sin asignar"; };
  const toggleObra = (oid) => { const cur = obraIdsDe(form); const next = cur.includes(oid) ? cur.filter(x => x !== oid) : [...cur, oid]; setForm({ ...form, obra_ids: next, obra_id: next[0] || "" }); };

  function guardar() {
    if (!form?.nombre?.trim()) return;
    if (form.id) setPersonal(p => p.map(x => x.id === form.id ? form : x));
    else setPersonal(p => [...p, { ...form, id: uid(), tareas: [], docs: form.docs || {} }]);
    setForm(null);
  }
  function borrar(id) { setPersonal(p => p.filter(x => x.id !== id)); setDetalle(null); }
  async function subirDoc(persId, docId, file) {
    const url = await toDataUrl(file);
    setPersonal(p => p.map(x => x.id === persId ? { ...x, docs: { ...x.docs, [docId]: { nombre: file.name, url, vence: x.docs?.[docId]?.vence || "" } } } : x));
  }
  function setVence(persId, docId, vence) {
    setPersonal(p => p.map(x => x.id === persId ? { ...x, docs: { ...x.docs, [docId]: { ...(x.docs?.[docId] || {}), vence } } } : x));
  }

  const venceCount = (p) => Object.values(p.docs || {}).filter(d => d?.vence && daysSince(d.vence) <= 15).length;
  const docsOk = (p) => Object.keys(p.docs || {}).length;

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <PageHead eyebrow="Recursos" title="Personal de obra" sub={`${personal.length} trabajadores registrados`} />
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", gap: 9, marginBottom: 16 }}>
        <MiniStat label="Total" value={personal.length} />
        <MiniStat label="Doc. al día" value={personal.filter(p => docsOk(p) > 0 && venceCount(p) === 0).length} color="#16A34A" />
        <MiniStat label="Por vencer" value={personal.reduce((a, p) => a + venceCount(p), 0)} color="#F59E0B" />
      </div>
      {personal.length === 0 && <EmptyMsg>Sin personal registrado.<br />Tocá “＋ Trabajador” para empezar.</EmptyMsg>}
      {personal.map(p => {
        const vc = venceCount(p);
        return (<RowItem key={p.id} onClick={() => setDetalle(p)} onDelete={() => borrar(p.id)}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: p.foto ? "transparent" : T.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
              {p.foto ? <img src={p.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.nombre || "?").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{p.rol || "—"} · {obrasNombres(p)}{p.telefono ? ` · 📲 ${p.telefono}` : ""}</div>
              {(p.sitios || []).length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>{p.sitios.map((s, i) => <span key={i} style={{ fontSize: 9.5, fontWeight: 700, color: "#16A34A", background: "#ECFDF5", borderRadius: 5, padding: "2px 6px" }}>✓ {s.sitio}</span>)}</div>}
            </div>
            {vc > 0
              ? <Badge color="#EF4444" bg="#FEF2F2">{vc} vence</Badge>
              : docsOk(p) > 0 ? <Badge color="#16A34A" bg="#ECFDF5">OK</Badge> : <Badge color="#94A3B8" bg="#F8FAFC">s/doc</Badge>}
          </div>
        </RowItem>);
      })}
    </div>
    <AddFab onClick={() => setForm({ nombre: "", rol: ROLES[0], empresa: cfg?.empresa || "V+V Construcciones", obra_id: obras[0]?.id || "", telefono: "", foto: "", docs: {} })} label="Trabajador" />

    {form && <Sheet title={form.id ? "Editar trabajador" : "Nuevo trabajador"} onClose={() => setForm(null)}>
      <Field label="Nombre y apellido"><TInput value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Juan Pérez" /></Field>
      <FieldRow>
        <Field label="Rol"><Sel value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</Sel></Field>
      </FieldRow>
      <Field label="Obras asignadas (tocá para elegir varias)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {obras.length === 0 && <span style={{ fontSize: 12, color: T.muted }}>No hay obras cargadas.</span>}
          {obras.map(o => { const on = obraIdsDe(form).includes(o.id); return <span key={o.id} onClick={() => toggleObra(o.id)} style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, padding: "7px 12px", borderRadius: 20, border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accent : T.card, color: on ? "#fff" : T.sub }}>{on ? "✓ " : ""}{o.nombre}</span>; })}
        </div>
      </Field>
      <FieldRow>
        <Field label="Empresa"><TInput value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} /></Field>
        <Field label="WhatsApp"><TInput value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="549114..." /></Field>
        <FieldRow>
          <Field label="DNI"><TInput value={form.dni || ""} onChange={e => setForm({ ...form, dni: e.target.value })} placeholder="30.123.456" /></Field>
          <Field label="CUIL"><TInput value={form.cuil || ""} onChange={e => setForm({ ...form, cuil: e.target.value })} placeholder="20-30123456-3" /></Field>
        </FieldRow>
      </FieldRow>
      <PBtn full onClick={guardar} style={{ marginTop: 6 }}>{form.id ? "Guardar cambios" : "Agregar trabajador"}</PBtn>
    </Sheet>}

    {detalle && <Sheet title={detalle.nombre} onClose={() => setDetalle(null)}>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 6 }}>{detalle.rol} · {detalle.empresa} · {obraNom(obras, detalle.obra_id)}</div>
      {(detalle.dni || detalle.cuil || detalle.telefono) && <div style={{ fontSize: 12.5, color: T.text, marginBottom: 14, lineHeight: 1.6 }}>{detalle.dni ? `DNI: ${detalle.dni}` : ""}{detalle.dni && (detalle.cuil || detalle.telefono) ? "  ·  " : ""}{detalle.cuil ? `CUIL: ${detalle.cuil}` : ""}{detalle.cuil && detalle.telefono ? "  ·  " : ""}{detalle.telefono ? `Tel: ${detalle.telefono}` : ""}</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {detalle.telefono && <a href={waLink(detalle.telefono, "")} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: "center", background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>WhatsApp</a>}
        <button onClick={() => { setForm(detalle); setDetalle(null); }} style={{ flex: 1, background: T.al, color: T.accent, border: "none", borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Editar datos</button>
      </div>
      <Eyebrow>Documentación</Eyebrow>
      {DOC_TYPES.map(d => {
        const doc = detalle.docs?.[d.id];
        const dias = doc?.vence ? daysSince(doc.vence) : null;
        return (<div key={d.id} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{d.label}</span>
            {doc ? <Badge color={dias != null && dias <= 15 ? "#EF4444" : "#16A34A"} bg={dias != null && dias <= 15 ? "#FEF2F2" : "#ECFDF5"}>{doc.nombre ? "cargado" : "—"}</Badge>
              : <DocUpload onPick={f => subirDoc(detalle.id, d.id, f)} />}
          </div>
          {d.acceptsExp && doc && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: T.muted }}>Vence:</span>
            <input value={doc.vence || ""} onChange={e => setVence(detalle.id, d.id, e.target.value)} placeholder="dd/mm/aa" style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 12, color: T.text }} />
            {dias != null && <span style={{ fontSize: 11, fontWeight: 700, color: dias <= 15 ? "#EF4444" : T.muted }}>{dias < 0 ? "vencido" : `${dias} d`}</span>}
          </div>}
        </div>);
      })}
      <div style={{ marginTop: 16 }}><Adjuntos items={detalle.adjuntos} onChange={next => { setPersonal(p => p.map(x => x.id === detalle.id ? { ...x, adjuntos: next } : x)); setDetalle(d => ({ ...d, adjuntos: next })); }} /></div>
      <button onClick={() => borrar(detalle.id)} style={{ width: "100%", marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Eliminar trabajador</button>
    </Sheet>}
  </div>);
}
function DocUpload({ onPick }) {
  const r = useRef(null);
  return (<><input ref={r} type="file" accept=".pdf,image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) onPick(e.target.files[0]); e.target.value = ""; }} />
    <button onClick={() => r.current?.click()} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Subir</button></>);
}

// ── ASISTENTE IA ─────────────────────────────────────────────────────
function ChatIA({ db, cfg, apiKey, msgs, setMsgs }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatAdj, setChatAdj] = useState([]);
  const chatFileRef = useRef(null);
  const [useSearch, setUseSearch] = useState(true);
  const [escuchando, setEscuchando] = useState(false);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const recRef = useRef(null);
  const sttOk = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const cnDeb = cfg?.clienteSigla || cfg?.clienteNombre || "Belfast";
  const DEBATE_MAX = 18;
  const [debateOpen, setDebateOpen] = useState(false);
  const [debateTema, setDebateTema] = useState("");
  const [debateActive, setDebateActive] = useState(false);
  const debateBusy = useRef(false);
  const debateSeen = useRef(0);
  async function saveDebate(deb) { try { localStorage.setItem("ia_debate", JSON.stringify(deb)); } catch { } await storage.set("ia_debate", JSON.stringify(deb)).catch(() => { }); }
  async function runDebateTurn() {
    if (debateBusy.current) return;
    debateBusy.current = true;
    try {
      const r = await storage.get("ia_debate"); const deb = r?.value ? JSON.parse(r.value) : null;
      if (!deb || !deb.active) { setDebateActive(false); debateBusy.current = false; return; }
      if ((deb.turnos || []).length >= deb.maxTurnos) { deb.active = false; await saveDebate(deb); setDebateActive(false); debateBusy.current = false; return; }
      const last = deb.turnos[deb.turnos.length - 1];
      const myTurn = deb.turnos.length === 0 ? deb.startedBy === "vv" : last.from !== "vv";
      if (!myTurn) { debateBusy.current = false; return; }
      const convo = deb.turnos.map(t => `${t.from === "vv" ? "V+V" : cnDeb}: ${t.texto}`).join("\n");
      const sysD = `Sos la IA de V+V Construcciones en una CHARLA TÉCNICA con la IA de ${cnDeb} sobre: "${deb.tema}". Es colaborativa: ambas suman y profundizan (no discuten). Aportá EL SIGUIENTE turno: información nueva y concreta, profundizá un aspecto no tocado, y cerrá con un gancho o pregunta para que la otra IA siga. NO repitas lo ya dicho. Español rioplatense, tono técnico de construcción. Máximo 3-4 oraciones.`;
      const userD = deb.turnos.length === 0 ? `Arrancá la charla técnica sobre "${deb.tema}".` : `Charla hasta ahora:\n${convo}\n\nDá tu siguiente intervención.`;
      const resp = await callAI([{ role: "user", content: userD }], sysD, apiKey, false);
      if (/credit balance|too low to access|Plans & Billing|purchase credits|is too low/i.test(String(resp || ""))) {
        const rE = await storage.get("ia_debate"); const debE = rE?.value ? JSON.parse(rE.value) : deb;
        debE.active = false; await saveDebate(debE); setDebateActive(false);
        setMsgs(prev => [...prev, { role: "assistant", content: "🎙 Debate frenado: no hay crédito de API disponible. Recargá créditos en console.anthropic.com y volvé a intentar.", debate: true }]);
        debateBusy.current = false; return;
      }
      const r2 = await storage.get("ia_debate"); const deb2 = r2?.value ? JSON.parse(r2.value) : deb;
      if (!deb2.active) { setDebateActive(false); debateBusy.current = false; return; }
      deb2.turnos = [...(deb2.turnos || []), { from: "vv", texto: (resp || "").trim(), ts: Date.now() }];
      if (deb2.turnos.length >= deb2.maxTurnos) deb2.active = false;
      await saveDebate(deb2);
    } catch { }
    debateBusy.current = false;
  }
  async function startDebate() {
    const tema = debateTema.trim(); if (!tema) return;
    const deb = { active: true, tema, turnos: [], maxTurnos: DEBATE_MAX, startedBy: "vv", ts: Date.now() };
    await saveDebate(deb); debateSeen.current = 0; setDebateActive(true); setDebateOpen(false); setDebateTema("");
    setMsgs(prev => [...prev, { role: "assistant", content: `🎙 Debate técnico iniciado con la IA de ${cnDeb}: "${tema}". Dejá las dos apps abiertas y mirá cómo se van respondiendo en vivo.`, debate: true }]);
    runDebateTurn();
  }
  async function stopDebate() {
    const r = await storage.get("ia_debate"); const deb = r?.value ? JSON.parse(r.value) : null;
    if (deb) { deb.active = false; await saveDebate(deb); }
    setDebateActive(false); setMsgs(prev => [...prev, { role: "assistant", content: "🎙 Debate frenado.", debate: true }]);
  }
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await storage.get("ia_debate"); const deb = r?.value ? JSON.parse(r.value) : null;
        if (!deb) return;
        if ((deb.turnos || []).length > debateSeen.current) {
          const nuevos = deb.turnos.slice(debateSeen.current); debateSeen.current = deb.turnos.length;
          setMsgs(prev => [...prev, ...nuevos.map(t => ({ role: "assistant", content: `🎙 IA ${t.from === "vv" ? "V+V" : cnDeb}: ${t.texto}`, debate: true }))]);
          if (deb.active) setDebateActive(true);
          if (!deb.active && (deb.turnos || []).length >= deb.maxTurnos) setMsgs(prev => [...prev, { role: "assistant", content: "🎙 Debate finalizado.", debate: true }]);
        }
        if (deb.active && (deb.turnos || []).length < deb.maxTurnos) {
          const last = deb.turnos[deb.turnos.length - 1];
          const myTurn = deb.turnos.length === 0 ? deb.startedBy === "vv" : last.from !== "vv";
          if (myTurn) runDebateTurn();
        }
        setDebateActive(!!deb.active);
      } catch { }
    }, 7000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { const el = scrollRef.current; if (!el) return; const go = () => { el.scrollTop = el.scrollHeight; }; go(); [60, 160, 320, 600].forEach(t => setTimeout(go, t)); requestAnimationFrame(go); }, [msgs, loading]);

  function buildSystem() {
    const { obras, lics, personal, pedidos, mensajes, formularios, documentacion, archivosGen, tareas, matpedidos, materiales, subcontratos, proveedores, herramientas } = db;
    const cn = cfg?.clienteNombre || "el cliente";
    const ob = obras.map(o => `· ${o.nombre} (${o.sector}, ${o.estado}, avance ${o.avance}%, monto ${o.monto}, pagado ${money(o.pagado)})`).join("\n");
    const li = lics.map(l => `· ${l.nombre} (${l.estado}, ${l.monto || "s/monto"}, ${l.sector})`).join("\n");
    const pe = personal.map(p => `· ${p.nombre} — ${p.rol || ""} en ${((p.obra_ids && p.obra_ids.length) ? p.obra_ids : (p.obra_id ? [p.obra_id] : [])).map(id => obraNom(obras, id)).filter(n => n && n !== "—").join(", ") || "sin obra asignada"}${p.empresa ? ` [${p.empresa}]` : ""}${p.telefono ? ` · WhatsApp ${p.telefono}` : ""}${p.dni ? ` · DNI ${p.dni}` : ""}${p.cuil ? ` · CUIL ${p.cuil}` : ""}${(p.adjuntos || []).length ? ` · ${p.adjuntos.length} adjunto(s)` : ""}`).join("\n");
    const ped = (pedidos || []).filter(p => p.estado !== "resuelto").slice(0, 20).map(p => `· [${p.id}] "${p.asunto}" (${p.de === "vv" ? "enviado a" : "recibido de"} ${p.de === "vv" ? cn : cn}, estado ${p.estado}) — último: ${p.hilo[p.hilo.length - 1]?.texto?.slice(0, 80) || ""}`).join("\n");
    const msgs = (mensajes || []).slice(-8).map(m => `· ${m.from === "vv" ? "Nosotros (V+V)" : cn}: ${(m.texto || "").slice(0, 110)}`).join("\n");
    return `Sos el ASISTENTE de V+V Construcciones (subcontratista de obra, Argentina). Ayudás a los jefes de obra y a la dirección con LO QUE NECESITEN. Hablás en español rioplatense (vos), claro y profesional.

IMPORTANTE — QUIÉN ES QUIÉN (no los confundas NUNCA):
· V+V Construcciones = tu empresa, la casa. Sebastián es el Presidente; Nicolás Arcussi es el CEO / Director de Operaciones.
· ${cn} = el CLIENTE, una empresa EXTERNA (el comitente/mandante). Cuando decís "el cliente" o "${cn}" te referís a esta empresa de afuera.
· "Tita" = la asistente personal de Sebastián. Es de V+V, de la casa, INTERNA. Tita NO es ${cn}, NO es el cliente, NO es una empresa externa.
· "Asistente de Nicolás" = la asistente personal de Nicolás. También es de V+V, de la casa, interna. Tampoco es el cliente.
Si Tita o la asistente de Nicolás te escriben o consultan algo, son GENTE DE LA CASA (V+V): tratalos con confianza, nunca como si fueran ${cn} ni un cliente externo. Solo ${cn} es "el cliente".

Tus capacidades:
1) BUSCAR EN INTERNET (tenés la herramienta de búsqueda web activa): conseguir proveedores y contactos (corralones, ferreterías, alquiler de equipos, hormigón, áridos), precios de materiales, normativa y código de edificación de CABA/Buenos Aires, teléfonos, direcciones, datos de empresas, o cualquier información actual. Cuando te pidan algo que no está en la app o que cambia seguido, BUSCÁ en internet (no digas que no podés). Priorizá fuentes argentinas; al dar proveedores listá nombre, zona, contacto/teléfono y link, y citá la fuente.
1b) ANALIZAR ARCHIVOS ADJUNTOS: el usuario puede adjuntarte FOTOS y PDF (con el 📎) para que los leas y analices. Si te mandan una PÓLIZA o NÓMINA de seguro, leela y extraé los datos de CADA PERSONA de forma ordenada: nombre y apellido, DNI/CUIL, y lo que figure (categoría, ART/aseguradora, N° de póliza, vigencia, suma asegurada). Devolvé una lista clara persona por persona. Si te piden, compará con el Personal cargado en la app y marcá quién está y quién falta. También podés analizar remitos, facturas, planos o cualquier foto de obra.
2) Conocés los datos de la app y respondés sobre obras, personal, proyectos y pedidos.
3) Redactás notas, mails y mensajes.
4) Sos el agente de mensajería con ${cn} y GESTIONÁS PEDIDOS (temas a resolver con la otra empresa): podés crear pedidos, responderlos y marcarlos resueltos.
5) ESTÁS CONECTADO con la app y el asistente de ${cn}: comparten la misma base de datos en tiempo real (obras, personal, pedidos, mensajes). Todo lo que carguen o pregunten de un lado, se ve del otro. Podés ENVIARLE UN MENSAJE directo a ${cn} (les aparece en su pantalla de Mensajes) y ellos te responden. NUNCA digas que no podés comunicarte con ${cn} ni con su asistente: SÍ podés, mandando un mensaje.

REGLA CLAVE de comunicación — elegí bien la acción:
- CANAL IA↔IA (usá "preguntar_ia"): SIEMPRE que la consulta involucre a la IA / el asistente de ${cn}, o esperes que te devuelvan un DATO. Ejemplos: "preguntale a la IA de ${cn}…", "pedile a la IA de ${cn}…", "pedícelo/pedíselo a la IA…", "consultale al asistente de ${cn}…", "que la IA de ${cn} te pase/averigüe…". OJO: cuando dicen "pedile/pedícelo A LA IA" es SIEMPRE este canal (preguntar_ia), NO un crear_pedido. Va directo a la otra IA, que responde sola y la respuesta te aparece acá. ESTE es el canal entre las dos IA.
- CONVENCIÓN DEL USUARIO (IMPORTANTE): por defecto, cuando el usuario diga "pedile", "pedido", "pedícelo", "pedíselo" o "pedir" algo, SE REFIERE a consultarle a la IA de ${cn} → usá "preguntar_ia". Solo usá "crear_pedido" (pedido formal) si el usuario aclara EXPLÍCITAMENTE que quiere "un pedido formal", una "nota de pedido" o documentación oficial.
- MENSAJE A LA PERSONA (usá "enviar_mensaje"): SOLO cuando es un aviso/recado para que lo lea un HUMANO de ${cn} en su pantalla de Mensajes, sin esperar respuesta de datos. Ejemplos: "avisale a ${cn} que mañana visitamos la obra", "mandale un mensaje diciendo que…". Si dudás entre este y preguntar_ia, y la persona menciona "la IA/el asistente" o quiere una respuesta con datos → usá preguntar_ia.
- BANCOS DE DATOS CONECTADOS: primero respondé con TUS datos (obras, personal, pedidos, fotos, etc.). Usá "preguntar_ia" si te lo piden explícitamente o si el dato realmente no está en tus datos y solo lo tendría ${cn}. No consultes a la otra IA por cosas que ya tenés ni por info de internet (para eso, búsqueda web).
- "crear_pedido" es solo para pedidos formales de definiciones o documentación.
- Si te piden PEDIR o CARGAR MATERIALES (ej: "necesito 50 bolsas de cemento y 20 hierros del 8 para Castores", "cargá un pedido de materiales de…"), usá "pedido_materiales" con la lista de items (nombre, cantidad, unidad) y la obra. Se carga solo en el registro "Pedido de materiales" y se le envía a ${cn}. Ideal para dictarlo desde el celular sin abrir el formulario. Si no aclaran la obra, usá la que mencionen o preguntá cuál.
- Si te piden MANDAR UN WHATSAPP a alguien del personal (ej: "mandale un WhatsApp al jefe de obra de Castores que…"), usá "whatsapp" con la persona/rol, la obra si ayuda, y el texto. Uso los teléfonos cargados en Personal. Te dejo el botón de WhatsApp listo para enviar.
- Si te piden VER, MANDAR o PASAR FOTOS o VIDEOS de una obra (ej: "mandame la última foto de Castores", "pasame las fotos de Golf", "mandame el último video de A 37"), usá "traer_fotos" con la obra y la cantidad (1 = la última, o el número que pidan). Poné videos:true si piden videos. Las fotos/videos aparecen directo en el chat para verlas, descargarlas o compartirlas.
- Si te piden un PLANO (PDF o CAD) de una obra (ej: "necesito el plano de replanteo de platea de Castores 475", "pasame el plano de estructura de Golf"), usá "traer_plano" con la obra y "buscar" (palabras clave del plano). El plano aparece en el chat para abrir o descargar. Los planos los suben Belfast y V+V en cada obra.
Nunca digas que no podés comunicarte: SÍ podés.

OBRAS:\n${ob || "(sin obras)"}

PROYECTOS:\n${li || "(sin proyectos)"}

PERSONAL:\n${pe || "(sin personal)"}

PEDIDOS ABIERTOS (con su id):\n${ped || "(ninguno)"}

MENSAJES RECIENTES con ${cn}:\n${msgs || "(sin mensajes)"}

FORMULARIOS:\n${(formularios || []).map(f => `· ${(FORM_TPLS.find(t => t.id === f.tplId) || {}).nombre || "Formulario"} — ${obraNom(obras, f.obra_id)} (${f.fecha}${f.resultado ? ", " + f.resultado : ""}${f.compartido ? ", compartido con " + cn : ", borrador"})`).join("\n") || "(sin formularios)"}

ARCHIVOS:\n${[...(archivosGen || []).map(a => `· ${a.nombre} (general)`), ...obras.flatMap(o => (o.archivos || []).map(a => `· ${a.nombre} (obra ${o.nombre})`))].join("\n") || "(sin archivos)"}

DOCUMENTACIÓN (modelos):\n${(documentacion || []).map(d => `· ${d.nombre} [${d.cat}]`).join("\n") || "(sin documentación)"}

FOTOS E INFORMES POR OBRA:\n${obras.map(o => `· ${o.nombre}: ${(o.fotos || []).length} fotos, ${(o.videos || []).length} videos, ${(o.informes || []).length} informes`).join("\n") || "(sin obras)"}

PLANOS POR OBRA:\n${obras.map(o => (o.planos||[]).length ? `· ${o.nombre}: ${(o.planos||[]).map(p=>p.nombre).join(", ")}` : null).filter(Boolean).join("\n") || "(sin planos cargados)"}

TAREAS / CRONOGRAMA:\n${(tareas || []).map(t => `· ${t.nombre} — ${obraNom(obras, t.obra_id)} (${t.avance || 0}%)`).join("\n") || "(sin tareas)"}

PEDIDOS DE MATERIALES:\n${(matpedidos || []).map(p => `· ${obraNom(obras, p.obra_id)} (${p.fecha}): ${(p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ")} — ${p.leido ? "levantado por " + cn : "no leído"}`).join("\n") || "(sin pedidos de materiales)"}

MATERIALES:\n${(materiales || []).slice(0, 40).map(m => `· ${m.nombre || m.item || JSON.stringify(m)}`).join("\n") || "(sin materiales)"}

SUBCONTRATOS:\n${(subcontratos || []).map(s => `· ${s.nombre || s.rubro || ""}${s.empresa ? " — " + s.empresa : ""}`).join("\n") || "(sin subcontratos)"}

PROVEEDORES:\n${(proveedores || []).map(p => `· ${p.nombre || ""}${p.rubro ? " (" + p.rubro + ")" : ""}${p.telefono ? " tel " + p.telefono : ""}`).join("\n") || "(sin proveedores)"}

HERRAMIENTAS:\n${(herramientas || []).map(h => `· ${h.nombre || ""}${h.obra_id ? " — " + obraNom(obras, h.obra_id) : ""}`).join("\n") || "(sin herramientas)"}

Tenés acceso COMPLETO a todos estos datos de la app. Cuando te pidan un DATO PUNTUAL (un número, fecha, cantidad, teléfono, monto, cuántas fotos/videos, etc.), buscalo en estos datos y dá el valor EXACTO. No digas "no lo tengo" si el dato figura arriba. Respondé cualquier consulta sobre obras, avances, montos, fotos, videos, informes, formularios, archivos, documentación, tareas, materiales, subcontratos, proveedores, herramientas, personal y pedidos usando esta información. (Las fotos no las "ves", pero sabés cuántas hay y de qué obra; para verlas remití a la obra.)

PROTOCOLO DE ACCIONES — cuando el usuario te pida gestionar un tema con ${cn} (pedir definiciones, solicitar documentación, plantear o responder un tema, cerrar un pedido, o mandarle un mensaje), respondé en lenguaje natural y AGREGÁ AL FINAL un único bloque entre \`\`\`accion y \`\`\` con JSON válido, una de estas formas:
{"tipo":"crear_pedido","para":"cliente","asunto":"...","detalle":"...","prioridad":"alta|media|baja","obra":"nombre de la obra de la que se trata"}
{"tipo":"responder_pedido","pedido_id":"ID_EXACTO","texto":"..."}
{"tipo":"resolver_pedido","pedido_id":"ID_EXACTO"}
{"tipo":"enviar_mensaje","texto":"el mensaje para ${cn}"}
{"tipo":"preguntar_ia","texto":"la consulta para la IA de ${cn}"}
{"tipo":"pedido_materiales","obra":"nombre de la obra","items":[{"nombre":"Cemento","cantidad":"50","unidad":"bolsas"},{"nombre":"Hierro del 8","cantidad":"20","unidad":"u"}],"nota":"opcional"}
{"tipo":"whatsapp","persona":"nombre o rol de la persona (ej: jefe de obra)","obra":"opcional: obra para ubicarlo","texto":"el mensaje a enviar por WhatsApp"}
{"tipo":"traer_fotos","obra":"nombre de la obra","cantidad":1,"videos":false}
{"tipo":"traer_plano","obra":"nombre de la obra","buscar":"palabras clave del plano (ej: replanteo platea)"}
{"tipo":"cargar_personal","sitio":"nombre del barrio/sitio","personal":"todos" | ["Nombre1","Nombre2"], "obra":"opcional: todos los de esa obra"}
{"tipo":"agregar_personal","personas":[{"nombre":"Juan Pérez","dni":"20345678","cuil":"20-20345678-9","rol":"Oficial","empresa":"","telefono":"","obra":"Castores 475","aseguradora":"","poliza":"","vigencia":""}]}
REGLA ESPECIAL NÓMINA/PERSONAL: cuando el usuario te adjunte una nómina, póliza o lista de gente y te pida CARGARLA/SUBIRLA al listado de Personal, LEÉ el documento y devolvé SIEMPRE un bloque "agregar_personal" con TODAS las personas y sus datos (nombre completo obligatorio; DNI, CUIL, rol, empresa, aseguradora, N° póliza y vigencia si figuran). En el TEXTO sé BREVE (ej: "Cargo estas 14 personas al Personal:") y NO repitas toda la lista larga en el texto — la lista completa va DENTRO del bloque de acción. Incluí SÍ o SÍ el bloque de acción con TODAS las personas, porque es lo único que las carga de verdad. Se ejecuta directo.
Usá solo ids reales de la lista. Si no hay acción concreta, no agregues el bloque. La acción se ejecuta cuando el usuario la confirma.`;
  }
  async function confirmAccion(idx) {
    const m = msgs[idx]; if (!m?.accion) return;
    const res = await ejecutarAccion(m.accion, "vv", { setPedidos: db.setPedidos, personal: db.personal, setPersonal: db.setPersonal, obras: db.obras, setMensajes: db.setMensajes });
    setMsgs(prev => prev.map((x, i) => i === idx ? { ...x, accionDone: true, accionResultado: res || "Acción ejecutada." } : x));
  }
  function descartarAccion(idx) { setMsgs(prev => prev.map((x, i) => i === idx ? { ...x, accion: null, accionDescartada: true } : x)); }
  async function addChatAdj(e) {
    const files = Array.from(e.target.files); if (!files.length) return; e.target.value = "";
    const nuevos = [];
    for (const f of files) {
      const esImg = /^image\//.test(f.type) || /\.(jpe?g|png|gif|webp)$/i.test(f.name);
      const esPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (!esImg && !esPdf) { alert(`"${f.name}": la IA solo puede analizar imágenes (foto) y PDF. Convertí el archivo a PDF o foto.`); continue; }
      if (f.size > 3 * 1024 * 1024) { alert(`"${f.name}" es muy pesado (más de 3MB). Sacale una foto más chica, o si es PDF mandá menos páginas. Así la IA lo puede procesar.`); continue; }
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      const data = String(dataUrl).split(",")[1];
      const mediaType = esImg ? ((dataUrl.match(/data:(.*?);/) || [])[1] || "image/jpeg") : "application/pdf";
      nuevos.push({ nombre: f.name, kind: esImg ? "image" : "document", mediaType, data, dataUrl });
    }
    if (nuevos.length) setChatAdj(p => [...p, ...nuevos]);
  }
  async function send(texto) {
    const c = (texto ?? input).trim(); if ((!c && chatAdj.length === 0) || loading) return;
    const adj = chatAdj; setChatAdj([]);
    setInput(""); const next = [...msgs, { role: "user", content: c || (adj.length ? "(archivo adjunto)" : ""), adjIA: adj.map(a => ({ nombre: a.nombre, kind: a.kind, dataUrl: a.dataUrl })) }]; setMsgs(next); setLoading(true);
    const apiMsgs = next.map((m, i) => {
      if (i === next.length - 1 && adj.length) {
        const blocks = [{ type: "text", text: c || "Analizá este archivo/foto y contame qué es y sus datos clave." }];
        for (const a of adj) blocks.push(a.kind === "image" ? { type: "image", source: { type: "base64", media_type: a.mediaType, data: a.data } } : { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } });
        return { role: "user", content: blocks };
      }
      return { role: m.role, content: typeof m.content === "string" ? m.content : m.content };
    });
    const r = await callAI(apiMsgs, buildSystem(), apiKey, useSearch);
    const { limpio, accion } = parseAccion(r);
    let extra = {};
    if (accion && accion.tipo === "traer_plano") {
      const obs = db.obras || [];
      const target = accion.obra ? obs.find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase())) : obs[0];
      const planos = (target && target.planos) || [];
      const kw = String(accion.buscar || "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let match = kw.length ? planos.filter(p => kw.some(w => (p.nombre || "").toLowerCase().includes(w))) : planos;
      let res, docs;
      if (!target) { res = "No encontré esa obra. Decime el nombre exacto."; docs = []; }
      else if (!planos.length) { res = `${target.nombre} no tiene planos cargados todavía. Pedile a Belfast (o cargalo vos) en la obra → pestaña Planos.`; docs = []; }
      else if (!match.length) { res = `No encontré un plano que coincida con "${accion.buscar}" en ${target.nombre}. Te dejo todos los que hay:`; docs = planos.map(p => ({ nombre: p.nombre, url: p.url })); }
      else { res = `Acá tenés ${match.length === 1 ? "el plano" : "los planos"} de ${target.nombre}${accion.buscar ? ` (${accion.buscar})` : ""}:`; docs = match.map(p => ({ nombre: p.nombre, url: p.url })); }
      extra = { accionDone: true, accionResultado: res, docs };
    } else if (accion && accion.tipo === "traer_fotos") {
      const obs = db.obras || [];
      const target = accion.obra ? obs.find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase())) : obs[0];
      const tipoMedia = accion.videos ? "videos" : "fotos";
      const cant = Math.max(1, Math.min(accion.cantidad || 3, 12));
      const media = ((target && target[tipoMedia]) || []).slice(-cant).reverse();
      const urls = media.map(f => f.url || f).filter(Boolean);
      let res;
      if (!target) res = "No encontré esa obra. Decime el nombre exacto.";
      else if (!urls.length) res = `${target.nombre} no tiene ${tipoMedia} cargadas todavía.`;
      else res = `Acá tenés ${urls.length === 1 ? (tipoMedia === "videos" ? "el último video" : "la última foto") : `${urls.length} ${tipoMedia}`} de ${target.nombre}:`;
      extra = { accionDone: true, accionResultado: res, media: urls, mediaTipo: tipoMedia };
    } else if (accion && accion.tipo === "whatsapp") {
      const pers = db.personal || [];
      const q = String(accion.persona || accion.rol || "").toLowerCase();
      const obraId = accion.obra ? (db.obras || []).find(o => (o.nombre || "").toLowerCase().includes(String(accion.obra).toLowerCase()))?.id : null;
      let per = q ? pers.find(p => (p.nombre || "").toLowerCase().includes(q)) : null;
      if (!per && obraId) per = pers.find(p => p.obra_id === obraId && (p.telefono || "").trim());
      if (!per && q) per = pers.find(p => (p.rol || "").toLowerCase().includes(q) && (p.telefono || "").trim());
      const t = encodeURIComponent(accion.texto || "");
      let url, label, res;
      if (per && (per.telefono || "").trim()) { const clean = String(per.telefono).replace(/\D/g, ""); const num = clean.startsWith("54") ? clean : ("549" + clean); url = `https://wa.me/${num}?text=${t}`; label = `Enviar a ${per.nombre}`; res = `WhatsApp listo para ${per.nombre}${per.telefono ? " (" + per.telefono + ")" : ""}.`; }
      else { url = `https://wa.me/?text=${t}`; label = "Abrir WhatsApp"; res = per ? `${per.nombre} no tiene teléfono cargado en Personal. Abrí WhatsApp y elegí el contacto.` : "No encontré a esa persona con teléfono en Personal. Cargale el WhatsApp o elegí el contacto."; }
      extra = { accionDone: true, accionResultado: res, waLink: url, waLabel: label };
    } else if (accion && accion.tipo === "agregar_personal") {
      const nuevos = Array.isArray(accion.personas) ? accion.personas : [];
      let arr = []; try { const rr = await storage.get("vv_personal"); if (rr?.value) arr = JSON.parse(rr.value); } catch { }
      const obs = db.obras || []; let add = 0, dup = 0;
      for (const p of nuevos) {
        const nombre = String(p.nombre || "").trim(); if (!nombre) continue;
        if (arr.find(x => (x.nombre || "").toLowerCase() === nombre.toLowerCase() || (p.dni && x.dni && String(x.dni) === String(p.dni)))) { dup++; continue; }
        const nombresObras = Array.isArray(p.obras) ? p.obras : (p.obra ? [p.obra] : []);
        const ids = nombresObras.map(nm => obs.find(o => (o.nombre || "").toLowerCase().includes(String(nm).toLowerCase()))?.id).filter(Boolean);
        arr.push({ id: uid() + Date.now() + Math.floor(Math.random() * 999), nombre, rol: p.rol || "", empresa: p.empresa || "", telefono: p.telefono || "", dni: p.dni || "", cuil: p.cuil || "", obra_id: ids[0] || "", obra_ids: ids, aseguradora: p.aseguradora || "", poliza: p.poliza || "", vigencia: p.vigencia || "", adjuntos: [] });
        add++;
      }
      try { localStorage.setItem("vv_personal", JSON.stringify(arr)); } catch { }
      await storage.set("vv_personal", JSON.stringify(arr)).catch(() => { });
      if (db.setPersonal) db.setPersonal(arr);
      extra = { accionDone: true, accionResultado: add ? `✅ Cargué ${add} persona(s) al listado de Personal${dup ? ` (${dup} ya estaban)` : ""}. Andá a la pestaña Personal para verlas.` : `No agregué a nadie: ${dup ? "ya estaban todos cargados" : "no pude leer nombres en el archivo. Probá con una foto/PDF más nítido"}.` };
    } else if (accion) { const res = await ejecutarAccion(accion, "vv", { setPedidos: db.setPedidos, personal: db.personal, setPersonal: db.setPersonal, obras: db.obras, setMensajes: db.setMensajes, setMatpedidos: db.setMatpedidos }); extra = { accion, accionDone: true, accionResultado: res || "Hecho." }; }
    setMsgs([...next, { role: "assistant", content: limpio, ...extra }]); setLoading(false);
  }
  // ── Canal directo IA↔IA: muestra lo que consulta/responde la otra IA y responde solo ──
  const cnIA = cfg?.clienteNombre || "el cliente";
  const ctxRef = useRef("");
  ctxRef.current = `OBRAS:\n${(db.obras || []).map(o => `· ${o.nombre} (${o.sector}, ${o.estado}, avance ${o.avance}%, monto ${o.monto}, pagado ${money(o.pagado)}, inicio ${o.inicio}, cierre ${o.cierre}, ${(o.fotos || []).length} fotos, ${(o.videos || []).length} videos, ${(o.informes || []).length} informes)`).join("\n") || "(sin obras)"}\n\nPERSONAL:\n${(db.personal || []).map(p => `· ${p.nombre} — ${p.rol || ""} (${obraNom(db.obras, p.obra_id)})${p.telefono ? " tel " + p.telefono : ""}${p.dni ? " DNI " + p.dni : ""}${p.cuil ? " CUIL " + p.cuil : ""}`).join("\n") || "(sin personal)"}\n\nPEDIDOS:\n${(db.pedidos || []).map(p => `· ${p.asunto} (${p.estado})`).join("\n") || "(sin pedidos)"}\n\nFORMULARIOS:\n${(db.formularios || []).map(f => `· ${(FORM_TPLS.find(t => t.id === f.tplId) || {}).nombre || "Formulario"} — ${obraNom(db.obras, f.obra_id)} (${f.fecha}${f.resultado ? ", " + f.resultado : ""})`).join("\n") || "(sin formularios)"}\n\nARCHIVOS:\n${[...(db.archivosGen || []).map(a => `· ${a.nombre}`), ...(db.obras || []).flatMap(o => (o.archivos || []).map(a => `· ${a.nombre} (${o.nombre})`))].join("\n") || "(sin archivos)"}\n\nTAREAS:\n${(db.tareas || []).map(t => `· ${t.nombre} — ${obraNom(db.obras, t.obra_id)} (${t.avance || 0}%)`).join("\n") || "(sin tareas)"}\n\nPEDIDOS DE MATERIALES:\n${(db.matpedidos || []).map(p => `· ${obraNom(db.obras, p.obra_id)}: ${(p.items || []).map(it => `${it.cantidad || ""} ${it.unidad || ""} ${it.nombre}`.trim()).join(", ")}`).join("\n") || "(ninguno)"}`;
  const apiKeyRef = useRef(apiKey); apiKeyRef.current = apiKey;
  const iaSeen = useRef(-1);
  const iaBusy = useRef(false);
  const pedSeen = useRef(null);
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await storage.get("ia_dialogo"); if (!r?.value) return;
        let arr = JSON.parse(r.value);
        if (iaSeen.current < 0) iaSeen.current = arr.length;
        else if (arr.length > iaSeen.current) {
          const nuevos = arr.slice(iaSeen.current); iaSeen.current = arr.length;
          setMsgs(prev => [...prev, ...nuevos.map(m => ({ role: "assistant", content: `🔗 ${m.from === "vv" ? "IA V+V" : m.from === "sebastian" ? "Tita (asistente de Sebastián)" : m.from === "nicolas" ? "Asistente de Nicolás" : "IA " + cnIA} ${m.tipo === "q" ? "consultó" : "respondió"}: ${m.texto}` }))]);
        }
        const pend = arr.find(m => m.from !== "vv" && m.tipo === "q" && !m.answered && (Date.now() - (m.ts || 0) < 300000));
        if (pend && !iaBusy.current && cfg?.iaAuto !== false) {
          iaBusy.current = true;
          try {
          arr = arr.map(m => m.id === pend.id ? { ...m, answered: true } : m);
          await storage.set("ia_dialogo", JSON.stringify(arr)).catch(() => { });
          const sysResp = `Sos el asistente de datos de V+V Construcciones. Quien te consulta suele ser Tita (asistente personal de Sebastián) o la asistente de Nicolás: son de V+V, de la casa, NO son el cliente ni una empresa externa. ESTOS SON TUS DATOS:\n${ctxRef.current}\n\nRespondé la consulta usando SOLO estos datos, breve y concreto (español rioplatense). Si el dato NO está en tus datos, respondé ÚNICAMENTE con la palabra NO_DATO. Nunca inventes. No agregues bloques de acción ni JSON.`;
          const resp = await callAI([{ role: "user", content: `Te consulta ${pend.from === "sebastian" ? "TITA, la asistente personal de Sebastián (el Presidente de V+V). NO es un cliente: es de la casa, tratala con confianza" : pend.from === "nicolas" ? "la asistente personal de Nicolás (CEO de V+V). NO es un cliente: es de la casa" : "la IA de " + cnIA}: "${pend.texto}"` }], sysResp, apiKeyRef.current, false);
          let arr2 = []; try { const r2 = await storage.get("ia_dialogo"); if (r2?.value) arr2 = JSON.parse(r2.value); } catch { }
          arr2 = arr2.map(m => m.id === pend.id ? { ...m, answered: true } : m);
          if (/credit balance|too low to access|purchase credits|is too low/i.test(String(resp||""))) { iaBusy.current=false; return; }
          let textoResp = resp;
          if ((resp || "").trim().toUpperCase().startsWith("NO_DATO")) {
            let peds = []; try { const rp = await storage.get("vv_pedidos"); if (rp?.value) peds = JSON.parse(rp.value); } catch { }
            const np = nuevoPedido({ de: pend.from, para: "vv", asunto: `[URGENTE] Consulta de ${pend.from === "sebastian" ? "Tita (asistente de Sebastián)" : pend.from === "nicolas" ? "asistente de Nicolás" : "la IA de " + cnIA}`, detalle: pend.texto, prioridad: "alta", obra_id: "" });
            const pedsNext = [np, ...peds]; try { localStorage.setItem("vv_pedidos", JSON.stringify(pedsNext)); } catch { } await storage.set("vv_pedidos", JSON.stringify(pedsNext)).catch(() => { });
            textoResp = `No tengo ese dato en la app de V+V. Lo derivé al personal de V+V como URGENTE (quedó en Pedidos). Te respondemos apenas lo tengan.`;
          }
          arr2.push({ id: uid() + Date.now(), from: "vv", texto: textoResp, tipo: "a", answered: true, ts: Date.now(), fecha: hoyStr() });
          try { localStorage.setItem("ia_dialogo", JSON.stringify(arr2)); } catch { }
          await storage.set("ia_dialogo", JSON.stringify(arr2)).catch(() => { });
          } catch { }
          iaBusy.current = false;
        }
        // Avisar en el chat los pedidos nuevos que le llegan a V+V
        const rp = await storage.get("vv_pedidos");
        if (rp?.value) {
          const peds = JSON.parse(rp.value);
          const incoming = peds.filter(p => p.para === "vv" && p.de !== "vv");
          if (pedSeen.current === null) pedSeen.current = new Set(incoming.map(p => p.id));
          else {
            const nuevos = incoming.filter(p => !pedSeen.current.has(p.id));
            nuevos.forEach(p => pedSeen.current.add(p.id));
            if (nuevos.length) setMsgs(prev => [...prev, ...nuevos.map(p => ({ role: "assistant", content: `📥 Te llegó un pedido de ${cnIA}: "${p.asunto}"${p.detalle ? " — " + p.detalle : ""}${p.prioridad === "alta" ? " ⚠ URGENTE" : ""}. Está en Pedidos. Decime si querés que lo responda.` }))]);
          }
        }
      } catch { }
    }, 6000);
    return () => clearInterval(iv);
  }, []);
  function toggleVoz() {
    if (!sttOk) return;
    if (escuchando) { recRef.current?.stop(); setEscuchando(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR(); rec.lang = "es-AR"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = e => { const txt = e.results[0][0].transcript; setInput(p => (p ? p + " " : "") + txt); };
    rec.onend = () => setEscuchando(false);
    rec.onerror = () => setEscuchando(false);
    recRef.current = rec; rec.start(); setEscuchando(true);
  }
  const QUICK = ["Redactá una nota de pedido de información para Belfast CM", "Resumime el estado de todas las obras", "¿Qué documentación está por vencer?", "Calculá cuánto falta cobrar de la cartera"];

  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
    <div style={{ flexShrink: 0 }}><PageHead eyebrow="Inteligencia · v9 avance" title={cfg?.tituloAsistente || "Asistente IA"} sub={cfg?.subtituloAsistente || "Lee todos los datos de la app"} /></div>
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px", minHeight: 0 }}>
      {msgs.length === 0 && <div style={{ paddingTop: 8 }}>
        <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, marginBottom: 14, textAlign: "center" }}>Preguntame sobre tus obras, personal o proyectos. También redacto notas y mails.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {QUICK.map((q, i) => <button key={i} onClick={() => send(q)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px", fontSize: 13, color: T.text, textAlign: "left", cursor: "pointer", boxShadow: T.shadow }}>{q}</button>)}
        </div>
      </div>}
      {msgs.map((m, i) => (<div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 11 }}>
        <div style={{ maxWidth: "84%", background: m.role === "user" ? T.navy : T.card, color: m.role === "user" ? "#fff" : T.text, border: m.role === "user" ? "none" : `1px solid ${T.border}`, borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "11px 14px", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", boxShadow: T.shadow }}>{m.content}</div>
        {m.adjIA && m.adjIA.length > 0 && <div style={{ marginTop: 6, maxWidth: "84%", display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>{m.adjIA.map((a, j) => a.kind === "image" ? <img key={j} src={a.dataUrl} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.border}` }} /> : <span key={j} style={{ background: T.al, color: T.accent, borderRadius: 8, padding: "8px 11px", fontSize: 11.5, fontWeight: 700 }}>📄 {a.nombre.slice(0, 24)}</span>)}</div>}
        {m.waLink && <a href={m.waLink} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 7, background: "#25D366", color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>📲 {m.waLabel || "Enviar por WhatsApp"}</a>}
        {m.docs && m.docs.length > 0 && <div style={{ marginTop: 8, maxWidth: "84%" }}>{m.docs.map((d, i) => <a key={i} href={d.url} target="_blank" rel="noreferrer" download={d.nombre} style={{ display: "flex", alignItems: "center", gap: 9, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 6, textDecoration: "none" }}><span style={{ width: 30, height: 30, borderRadius: 7, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📐</span><span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.text, wordBreak: "break-word" }}>{d.nombre}</span><span style={{ color: T.accent, fontWeight: 700, fontSize: 11.5, flexShrink: 0 }}>Abrir ↗</span></a>)}</div>}
        {m.media && m.media.length > 0 && <div style={{ marginTop: 8, maxWidth: "84%" }}>{m.mediaTipo === "videos"          ? m.media.map((u, i) => <video key={i} src={u} controls playsInline style={{ width: "100%", borderRadius: 10, marginBottom: 8, background: "#000", display: "block" }} />)
          : <div style={{ display: "grid", gridTemplateColumns: m.media.length === 1 ? "1fr" : "1fr 1fr", gap: 6 }}>{m.media.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" download style={{ display: "block" }}><img src={u} alt="" style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.border}`, display: "block" }} /></a>)}</div>}
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>Tocá {m.mediaTipo === "videos" ? "el video" : "la foto"} para abrir en grande o descargar/compartir.</div>
        </div>}
        {m.accion && !m.accionDone && !m.accionDescartada && <div style={{ maxWidth: "84%", marginTop: 7, background: T.al, border: `1px solid ${T.accent}`, borderRadius: T.rsm, padding: "11px 13px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Acción propuesta</div>
          <div style={{ fontSize: 12.5, color: T.text, marginBottom: 10 }}>{accionLabel(m.accion)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => confirmAccion(i)} style={{ flex: 1, background: T.accent, color: "#fff", border: "none", borderRadius: 7, padding: "9px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Confirmar y ejecutar</button>
            <button onClick={() => descartarAccion(i)} style={{ background: T.card, color: T.sub, border: `1px solid ${T.border}`, borderRadius: 7, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Descartar</button>
          </div>
        </div>}
        {m.accionDone && <div style={{ maxWidth: "84%", marginTop: 6, fontSize: 11.5, color: "#16A34A", fontWeight: 700 }}>✓ {m.accionResultado}</div>}
      </div>))}
      {loading && <div style={{ display: "flex", gap: 5, padding: "6px 4px" }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.muted, animation: "pulse 1s infinite", animationDelay: `${i * .15}s` }} />)}</div>}
      <div ref={bottomRef} />
    </div>
    <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, background: T.card, padding: "10px 14px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button onClick={() => setUseSearch(s => !s)} style={{ background: useSearch ? T.al : T.bg, color: useSearch ? T.accent : T.muted, border: `1px solid ${useSearch ? T.accent : T.border}`, borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🌐 Buscar en internet {useSearch ? "ON" : "OFF"}</button>
        {debateActive ? <button onClick={stopDebate} style={{ background: "#EF4444", color: "#fff", border: "none", borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>⏹ Frenar debate</button>
          : <button onClick={() => setDebateOpen(v => !v)} style={{ background: debateOpen ? T.navy : T.bg, color: debateOpen ? "#fff" : T.sub, border: `1px solid ${debateOpen ? T.navy : T.border}`, borderRadius: 20, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🎙 Debate IA</button>}
        {msgs.length > 0 && <button onClick={() => setMsgs([])} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer", marginLeft: "auto" }}>Limpiar</button>}
      </div>
      {debateOpen && !debateActive && <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 12px", marginBottom: 8 }}>
        <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 8, lineHeight: 1.5 }}>Charla técnica entre las dos IA (~3 min, {DEBATE_MAX} turnos). Dales un tema y mirá cómo se responden en vivo en las dos apps.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={debateTema} onChange={e => setDebateTema(e.target.value)} onKeyDown={e => { if (e.key === "Enter") startDebate(); }} placeholder="Tema (ej: Steel Frame)" style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "10px 12px", fontSize: 13, color: T.text }} />
          <button onClick={startDebate} disabled={!debateTema.trim()} style={{ background: debateTema.trim() ? T.navy : T.border, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "10px 16px", fontSize: 12.5, fontWeight: 700, cursor: debateTema.trim() ? "pointer" : "default" }}>Iniciar</button>
        </div>
      </div>}
      {debateActive && <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>🎙 Debate en curso… las dos IA están conversando (dejá las dos apps abiertas).</div>}
      {chatAdj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{chatAdj.map((a, i) => <span key={i} style={{ background: T.al, borderRadius: 7, padding: "5px 9px", fontSize: 11, color: T.accent, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>{a.kind === "image" ? "🖼" : "📄"} {a.nombre.slice(0, 22)} <span onClick={() => setChatAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.muted }}>✕</span></span>)}</div>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <input ref={chatFileRef} type="file" accept="image/*,.pdf" multiple onChange={addChatAdj} style={{ display: "none" }} />
        <button onClick={() => chatFileRef.current?.click()} title="Adjuntar foto o PDF para analizar" style={{ width: 42, height: 42, borderRadius: T.rsm, background: T.bg, color: T.accent, border: `1px solid ${T.border}`, fontSize: 17, flexShrink: 0, cursor: "pointer" }}>📎</button>
        {sttOk && <button onClick={toggleVoz} style={{ width: 42, height: 42, borderRadius: T.rsm, background: escuchando ? "#EF4444" : T.bg, color: escuchando ? "#fff" : T.sub, border: `1px solid ${escuchando ? "#EF4444" : T.border}`, fontSize: 16, cursor: "pointer", flexShrink: 0, animation: escuchando ? "pulse 1s infinite" : "none" }}>🎤</button>}
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={escuchando ? "Escuchando…" : "Escribí, adjuntá 📎 o usá el micrófono…"} rows={1} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 13.5, color: T.text, maxHeight: 110, minHeight: 42 }} />
        <button onClick={() => send()} disabled={loading || (!input.trim() && chatAdj.length === 0)} style={{ width: 42, height: 42, borderRadius: T.rsm, background: (input.trim() || chatAdj.length) && !loading ? T.accent : T.border, color: "#fff", border: "none", fontSize: 17, cursor: (input.trim() || chatAdj.length) ? "pointer" : "default", flexShrink: 0 }}>↑</button>
      </div>
      {!apiKey && <div style={{ fontSize: 10.5, color: T.muted, textAlign: "center", marginTop: 7 }}>Cargá tu API Key en Más → Configuración para activar la IA.</div>}
    </div>
  </div>);
}

// ── SEGUIMIENTO (alertas vivas) ──────────────────────────────────────
function SeguimientoView({ db, onBack }) {
  const { obras, personal } = db;
  const alerts = [];
  personal.forEach(p => Object.entries(p.docs || {}).forEach(([k, d]) => {
    if (d?.vence) { const dias = daysSince(d.vence); if (dias <= 15) alerts.push({ id: `${p.id}_${k}`, msg: `${p.nombre}: ${k.toUpperCase()} ${dias < 0 ? "vencido" : `vence en ${dias} días`}`, prioridad: dias <= 5 ? "alta" : "media" }); }
  }));
  obras.forEach(o => {
    if (o.estado === "pausada") alerts.push({ id: `${o.id}_pausa`, msg: `${o.nombre}: obra pausada (avance ${o.avance}%)`, prioridad: "media" });
    const pct = parseMontoNum(o.monto) ? Math.round((o.pagado / parseMontoNum(o.monto)) * 100) : 0;
    if (pct > o.avance + 15 && o.estado !== "terminada") alerts.push({ id: `${o.id}_pago`, msg: `${o.nombre}: ${pct}% pagado vs ${o.avance}% de avance`, prioridad: "alta" });
  });
  const col = { alta: "#EF4444", media: "#F59E0B", baja: "#3B82F6" };
  const bg = { alta: "#FEF2F2", media: "#FFFBEB", baja: "#EFF6FF" };
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <SubHead id="seguimiento" label="Seguimiento" sub="Alertas calculadas en tiempo real" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", gap: 9, marginBottom: 16 }}>
        <MiniStat label="Críticas" value={alerts.filter(a => a.prioridad === "alta").length} color="#EF4444" />
        <MiniStat label="Medias" value={alerts.filter(a => a.prioridad === "media").length} color="#F59E0B" />
        <MiniStat label="Total" value={alerts.length} />
      </div>
      {alerts.length === 0 && <EmptyMsg>Sin alertas activas. Todo en orden ✓</EmptyMsg>}
      {alerts.map(a => (<div key={a.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${col[a.prioridad]}`, borderRadius: T.rsm, padding: "13px 14px", marginBottom: 9, boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: col[a.prioridad], flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, color: T.text }}>{a.msg}</span>
        <Badge color={col[a.prioridad]} bg={bg[a.prioridad]}>{a.prioridad}</Badge>
      </div>))}
    </div>
  </div>);
}

// ── MATERIALES ───────────────────────────────────────────────────────
function MaterialesView({ db, onBack }) {
  const { obras, materiales, setMateriales } = db;
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [form, setForm] = useState(null);
  const items = materiales.filter(m => m.obra_id === obraId);
  const total = items.reduce((a, m) => a + (Number(m.cantidad) || 0) * (Number(m.precio) || 0), 0);
  function guardar() { if (!form.nombre?.trim()) return; if (form.id) setMateriales(p => p.map(x => x.id === form.id ? form : x)); else setMateriales(p => [...p, { ...form, id: uid(), obra_id: obraId }]); setForm(null); }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="materiales" label="Materiales" sub="Cómputo por obra" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <Field label="Obra"><Sel value={obraId} onChange={e => setObraId(e.target.value)}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      <div style={{ background: T.navy, borderRadius: T.rsm, padding: "14px 16px", margin: "4px 0 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${BRASS}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total materiales</span>
        <span style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>{money(total)}</span>
      </div>
      {items.length === 0 && <EmptyMsg>Sin materiales cargados para esta obra.</EmptyMsg>}
      {items.map(m => (<RowItem key={m.id} onClick={() => setForm(m)} onDelete={() => setMateriales(p => p.filter(x => x.id !== m.id))}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{m.nombre}{(m.adjuntos || []).length ? <span style={{ marginLeft: 6, fontSize: 10.5, color: T.muted }}>📎{(m.adjuntos || []).length}</span> : ""}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{m.cantidad} {m.unidad} × {money(m.precio)}</div></div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>{money((Number(m.cantidad) || 0) * (Number(m.precio) || 0))}</div>
        </div>
      </RowItem>))}
    </div>
    <AddFab onClick={() => setForm({ nombre: "", cantidad: "", unidad: "u", precio: "" })} label="Material" />
    {form && <Sheet title={form.id ? "Material" : "Nuevo material"} onClose={() => setForm(null)}>
      <Field label="Material"><TInput value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Cemento Portland" /></Field>
      <FieldRow>
        <Field label="Cantidad"><TInput type="number" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} /></Field>
        <Field label="Unidad"><TInput value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })} placeholder="u, m², bolsa…" /></Field>
      </FieldRow>
      <Field label="Precio unitario ($)"><TInput type="number" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} /></Field>
      <Adjuntos items={form.adjuntos} onChange={next => setForm({ ...form, adjuntos: next })} />
      <PBtn full onClick={guardar} style={{ marginTop: 10 }}>{form.id ? "Guardar" : "Agregar material"}</PBtn>
    </Sheet>}
  </div>);
}

// ── SUBCONTRATOS ─────────────────────────────────────────────────────
function SubcontratosView({ db, onBack }) {
  const { obras, subcontratos, setSubcontratos } = db;
  const [form, setForm] = useState(null);
  const estados = [{ id: "presupuestado", c: "#3B82F6", b: "#EFF6FF" }, { id: "contratado", c: "#8B5CF6", b: "#F5F3FF" }, { id: "ejecucion", c: "#F59E0B", b: "#FFFBEB" }, { id: "finalizado", c: "#16A34A", b: "#ECFDF5" }];
  const total = subcontratos.reduce((a, s) => a + parseMontoNum(s.monto), 0);
  function guardar() { if (!form.empresa?.trim()) return; if (form.id) setSubcontratos(p => p.map(x => x.id === form.id ? form : x)); else setSubcontratos(p => [...p, { ...form, id: uid() }]); setForm(null); }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="subcontratos" label="Subcontratos" sub={`${subcontratos.length} contratos`} onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", gap: 9, marginBottom: 16 }}>
        <MiniStat label="Contratos" value={subcontratos.length} />
        <MiniStat label="En ejecución" value={subcontratos.filter(s => s.estado === "ejecucion").length} color="#F59E0B" />
        <MiniStat label="Monto total" value={money(total)} color={T.accent} />
      </div>
      {subcontratos.length === 0 && <EmptyMsg>Sin subcontratos cargados.</EmptyMsg>}
      {subcontratos.map(s => { const e = estados.find(x => x.id === s.estado) || estados[0]; return (<RowItem key={s.id} onClick={() => setForm(s)} onDelete={() => setSubcontratos(p => p.filter(x => x.id !== s.id))}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{s.empresa}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{s.rubro} · {obraNom(obras, s.obra_id)}</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 13.5, fontWeight: 800, color: T.accent }}>{s.monto || "—"}</div><Badge color={e.c} bg={e.b} style={{ marginTop: 3 }}>{s.estado}</Badge></div>
        </div>
      </RowItem>); })}
    </div>
    <AddFab onClick={() => setForm({ empresa: "", rubro: "", obra_id: obras[0]?.id || "", monto: "", estado: "presupuestado" })} label="Subcontrato" />
    {form && <Sheet title={form.id ? "Editar subcontrato" : "Nuevo subcontrato"} onClose={() => setForm(null)}>
      <Field label="Empresa / contratista"><TInput value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} /></Field>
      <FieldRow>
        <Field label="Rubro"><TInput value={form.rubro} onChange={e => setForm({ ...form, rubro: e.target.value })} placeholder="Yesería, electricidad…" /></Field>
        <Field label="Obra"><Sel value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Monto"><TInput value={form.monto} onChange={e => setForm({ ...form, monto: formatMonto(e.target.value) })} placeholder="0 $" /></Field>
        <Field label="Estado"><Sel value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>{estados.map(x => <option key={x.id} value={x.id}>{x.id}</option>)}</Sel></Field>
      </FieldRow>
      <PBtn full onClick={guardar} style={{ marginTop: 6 }}>{form.id ? "Guardar" : "Agregar"}</PBtn>
    </Sheet>}
  </div>);
}

// ── INFORMES IA ──────────────────────────────────────────────────────
function InformesView({ db, apiKey, onBack }) {
  const { obras, setObras, setMensajes } = db;
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null);
  const [nuevo, setNuevo] = useState(null);
  const fileRef = useRef(null);
  async function enviarABelfast(inf) {
    if (!inf) return;
    const resumen = (inf.texto || "").slice(0, 500);
    const msg = { id: uid() + Date.now(), from: "vv", texto: `📄 Informe de obra — ${inf.obra}\n${inf.titulo || ""}${resumen ? "\n\n" + resumen : ""}`, fecha: hoyStr(), ts: Date.now(), archivos: inf.archivos || [] };
    let arr = []; try { const r = await storage.get("vv_mensajes"); if (r?.value) arr = JSON.parse(r.value); } catch { }
    const next = [...arr, msg]; try { localStorage.setItem("vv_mensajes", JSON.stringify(next)); } catch { } await storage.set("vv_mensajes", JSON.stringify(next)).catch(() => { });
    if (setMensajes) setMensajes(next);
    setObras(p => p.map(x => x.id === inf.obra_id ? { ...x, informes: (x.informes || []).map(i => i.id === inf.id ? { ...i, enviado: true, enviadoFecha: hoyStr() } : i) } : x));
    setOpen(o => o ? { ...o, enviado: true } : o);
    alert("✓ Informe enviado a Belfast.\n\nLe llega a Mensajes y ya lo ve en su pestaña Informes.");
  }
  const todos = obras.flatMap(o => (o.informes || []).map(inf => ({ ...inf, obra: o.nombre, obra_id: o.id }))).filter(inf => !filtro || inf.obra_id === filtro).sort((a, b) => (b.id > a.id ? 1 : -1));
  async function generar() {
    const o = obras.find(x => x.id === obraId) || obras[0]; if (!o) { alert("Primero creá una obra."); return; } setLoading(true);
    const sys = "Sos inspector técnico de V+V Construcciones. Redactás informes de avance profesionales en español rioplatense.";
    const prompt = `Redactá un informe técnico de avance para la obra "${o.nombre}" (${o.sector}). Estado: ${o.estado}, avance ${o.avance}%, inicio ${o.inicio}, cierre estimado ${o.cierre}. Incluí: situación general, trabajos ejecutados, pendientes, alertas y conclusión.`;
    const r = await callAI([{ role: "user", content: prompt }], sys, apiKey, false);
    const inf = { id: uid() + Date.now(), ts: Date.now(), fecha: hoyStr(), titulo: "Informe de avance (IA)", texto: r, tipo: "ia", archivos: [] };
    setObras(p => p.map(x => x.id === o.id ? { ...x, informes: [...(x.informes || []), inf] } : x));
    setLoading(false); setOpen({ ...inf, obra: o.nombre, obra_id: o.id });
  }
  async function addArch(e) { const files = Array.from(e.target.files); if (!files.length) return; const nuevos = []; for (const f of files) { const data = await toDataUrl(f); const url = await uploadFoto(data, "informes", f.name.replace(/\W+/g, "_")); nuevos.push({ nombre: f.name, url }); } setNuevo(p => ({ ...p, archivos: [...(p.archivos || []), ...nuevos] })); e.target.value = ""; }
  function guardarManual() {
    if (!nuevo.titulo?.trim() && !nuevo.texto?.trim()) { alert("Escribí al menos un título o el detalle del informe."); return; }
    const targetId = nuevo.obra_id || obras[0]?.id;
    if (!targetId) { alert("Primero creá una obra para poder guardar el informe."); return; }
    const inf = { id: uid() + Date.now(), ts: Date.now(), fecha: hoyStr(), titulo: nuevo.titulo || "Informe técnico", texto: nuevo.texto || "", tipo: "tecnico", archivos: nuevo.archivos || [] };
    setObras(p => p.map(x => x.id === targetId ? { ...x, informes: [...(x.informes || []), inf] } : x));
    setNuevo(null);
  }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="informes" label="Informes técnicos" sub="Por obra · IA y manuales" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <Card style={{ padding: 15, marginBottom: 16 }}>
        <Eyebrow>Generar con IA</Eyebrow>
        <Field label="Obra"><Sel value={obraId} onChange={e => setObraId(e.target.value)}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <PBtn onClick={generar} disabled={loading} style={{ flex: 1 }}>{loading ? "Generando…" : "Generar con IA"}</PBtn>
          <button onClick={() => setNuevo({ obra_id: obraId || obras[0]?.id || "", titulo: "", texto: "", archivos: [] })} style={{ flex: 1, background: T.al, color: T.accent, border: "none", borderRadius: T.rsm, padding: "11px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>＋ Informe manual</button>
        </div>
      </Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Eyebrow>Historial</Eyebrow>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 9px", fontSize: 12, color: T.sub }}><option value="">Todas las obras</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
      </div>
      {todos.length === 0 && <EmptyMsg>Sin informes para esta obra.</EmptyMsg>}
      {todos.map(inf => (<RowItem key={inf.id} onClick={() => setOpen(inf)} onDelete={() => setObras(p => p.map(x => x.id === inf.obra_id ? { ...x, informes: x.informes.filter(i => i.id !== inf.id) } : x))}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{inf.titulo || "Informe"}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{inf.obra} · {inf.fecha}{(inf.archivos || []).length ? ` · ${inf.archivos.length} adj.` : ""}{inf.enviado ? " · ✓ enviado a Belfast" : ""}</div></div>
          <Badge color={inf.tipo === "ia" ? "#8B5CF6" : "#3B82F6"} bg={inf.tipo === "ia" ? "#F5F3FF" : "#EFF6FF"}>{inf.tipo === "ia" ? "IA" : "Técnico"}</Badge>
        </div>
      </RowItem>))}
    </div>
    {open && <Sheet title={`${open.obra} · ${open.fecha}`} onClose={() => setOpen(null)}>
      <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 8 }}>{open.titulo || "Informe"}</div>
      {open.texto && <div style={{ background: T.bg, borderRadius: T.rsm, padding: "14px 15px", fontSize: 12.5, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{open.texto}</div>}
      {(open.archivos || []).map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 8, fontSize: 13, fontWeight: 700, color: T.accent }}>📎 {a.nombre}</a>)}
      <button onClick={() => enviarABelfast(open)} style={{ width: "100%", marginTop: 16, background: open.enviado ? T.al : T.navy, color: open.enviado ? T.accent : "#fff", border: open.enviado ? `1px solid ${T.accent}` : "none", borderRadius: T.rsm, padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", borderBottom: open.enviado ? undefined : `2px solid ${BRASS}` }}>{open.enviado ? "✓ Enviado a Belfast · reenviar" : "📤 Enviar a Belfast"}</button>
      <div style={{ fontSize: 10.5, color: T.muted, textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>Los informes ya aparecen solos en la pestaña Informes de Belfast. Con este botón, además le llega un aviso a Mensajes.</div>
    </Sheet>}
    {nuevo && <Sheet title="Nuevo informe técnico" onClose={() => setNuevo(null)}>
      <Field label="Obra"><Sel value={nuevo.obra_id} onChange={e => setNuevo({ ...nuevo, obra_id: e.target.value })}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      <Field label="Título"><TInput value={nuevo.titulo} onChange={e => setNuevo({ ...nuevo, titulo: e.target.value })} placeholder="Ej: Inspección estructural PB" /></Field>
      <Field label="Detalle"><textarea value={nuevo.texto} onChange={e => setNuevo({ ...nuevo, texto: e.target.value })} rows={5} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} /></Field>
      <input ref={fileRef} type="file" multiple onChange={addArch} style={{ display: "none" }} />
      <button onClick={() => fileRef.current?.click()} style={{ width: "100%", background: T.bg, border: `1px dashed ${T.border}`, borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 600, color: T.sub, cursor: "pointer", marginBottom: 8 }}>📎 Adjuntar archivos {(nuevo.archivos || []).length ? `(${nuevo.archivos.length})` : ""}</button>
      <PBtn full onClick={guardarManual}>Guardar informe</PBtn>
    </Sheet>}
  </div>);
}

// ── GANTT ────────────────────────────────────────────────────────────
function GanttView({ db, onBack }) {
  const { obras, tareas, setTareas } = db;
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const [form, setForm] = useState(null);
  const items = tareas.filter(t => t.obra_id === obraId);
  const toDate = s => { if (!s) return null; const [d, m, y] = s.split("/"); return new Date(`20${y}`, m - 1, d); };
  const dates = items.flatMap(t => [toDate(t.inicio), toDate(t.fin)]).filter(Boolean);
  const min = dates.length ? new Date(Math.min(...dates)) : new Date();
  const max = dates.length ? new Date(Math.max(...dates)) : new Date();
  const span = Math.max(1, (max - min) / 86400000);
  function guardar() { if (!form.nombre?.trim()) return; setTareas(p => [...p, { ...form, id: uid(), obra_id: obraId }]); setForm(null); }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="gantt" label="Gantt" sub="Cronograma de tareas" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <Field label="Obra"><Sel value={obraId} onChange={e => setObraId(e.target.value)}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      {items.length === 0 && <EmptyMsg>Sin tareas en el cronograma de esta obra.</EmptyMsg>}
      {items.map(t => {
        const i = toDate(t.inicio), f = toDate(t.fin);
        const off = i ? ((i - min) / 86400000 / span) * 100 : 0;
        const w = i && f ? Math.max(6, ((f - i) / 86400000 / span) * 100) : 12;
        return (<div key={t.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 9, boxShadow: T.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{t.nombre}</span>
            <button onClick={() => setTareas(p => p.filter(x => x.id !== t.id))} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
          <div style={{ position: "relative", height: 22, background: T.bg, borderRadius: 5 }}>
            <div style={{ position: "absolute", left: `${off}%`, width: `${w}%`, top: 3, bottom: 3, background: T.accent, borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 6, overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, width: `${t.avance || 0}%`, background: BRASS, borderRadius: 4, opacity: .85 }} />
              <span style={{ position: "relative", fontSize: 9.5, fontWeight: 700, color: "#fff" }}>{t.avance || 0}%</span>
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 5 }}>{t.inicio} → {t.fin}</div>
        </div>);
      })}
    </div>
    <AddFab onClick={() => setForm({ nombre: "", inicio: hoyStr(), fin: "", avance: 0 })} label="Tarea" />
    {form && <Sheet title="Nueva tarea" onClose={() => setForm(null)}>
      <Field label="Tarea"><TInput value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Hormigonado de losa" /></Field>
      <FieldRow>
        <Field label="Inicio (dd/mm/aa)"><TInput value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} /></Field>
        <Field label="Fin (dd/mm/aa)"><TInput value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} /></Field>
      </FieldRow>
      <Field label={`Avance: ${form.avance}%`}><input type="range" min="0" max="100" value={form.avance} onChange={e => setForm({ ...form, avance: Number(e.target.value) })} style={{ width: "100%", accentColor: T.accent }} /></Field>
      <PBtn full onClick={guardar} style={{ marginTop: 6 }}>Agregar tarea</PBtn>
    </Sheet>}
  </div>);
}

// ── CONTACTOS ────────────────────────────────────────────────────────
function ContactosView({ db, onBack }) {
  const { contactos, setContactos } = db;
  const [form, setForm] = useState(null); const [q, setQ] = useState("");
  const filtr = contactos.filter(c => (c.nombre + c.empresa + c.rol).toLowerCase().includes(q.toLowerCase()));
  function guardar() { if (!form.nombre?.trim()) return; if (form.id) setContactos(p => p.map(x => x.id === form.id ? form : x)); else setContactos(p => [...p, { ...form, id: uid() }]); setForm(null); }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="contactos" label="Contactos" sub={`${contactos.length} en la agenda`} onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <TInput value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar contacto…" extraStyle={{ marginBottom: 14 }} />
      {filtr.length === 0 && <EmptyMsg>{contactos.length ? "Sin resultados." : "Agenda vacía."}</EmptyMsg>}
      {filtr.map(c => (<RowItem key={c.id} onClick={() => setForm(c)} onDelete={() => setContactos(p => p.filter(x => x.id !== c.id))}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{(c.nombre || "?").slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{c.nombre}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{[c.rol, c.empresa].filter(Boolean).join(" · ") || "—"}</div></div>
          <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
            {c.telefono && <a href={waLink(c.telefono, "")} target="_blank" rel="noreferrer" style={{ width: 32, height: 32, borderRadius: 7, background: "#ECFDF5", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 14 }}>✆</a>}
            {c.email && <a href={`mailto:${c.email}`} style={{ width: 32, height: 32, borderRadius: 7, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 13 }}>✉</a>}
          </div>
        </div>
      </RowItem>))}
    </div>
    <AddFab onClick={() => setForm({ nombre: "", empresa: "", rol: "", email: "", telefono: "" })} label="Contacto" />
    {form && <Sheet title={form.id ? "Editar contacto" : "Nuevo contacto"} onClose={() => setForm(null)}>
      <Field label="Nombre"><TInput value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Field>
      <FieldRow>
        <Field label="Empresa"><TInput value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} /></Field>
        <Field label="Rol"><TInput value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} /></Field>
      </FieldRow>
      <Field label="Email"><TInput value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" /></Field>
      <Field label="Teléfono / WhatsApp"><TInput value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></Field>
      <PBtn full onClick={guardar} style={{ marginTop: 6 }}>{form.id ? "Guardar" : "Agregar"}</PBtn>
    </Sheet>}
  </div>);
}

// ── PROVEEDORES ──────────────────────────────────────────────────────
function ProveedoresView({ db, onBack }) {
  const { proveedores, setProveedores } = db;
  const [form, setForm] = useState(null);
  function guardar() { if (!form.nombre?.trim()) return; if (form.id) setProveedores(p => p.map(x => x.id === form.id ? form : x)); else setProveedores(p => [...p, { ...form, id: uid() }]); setForm(null); }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="proveedores" label="Proveedores" sub={`${proveedores.length} registrados`} onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      {proveedores.length === 0 && <EmptyMsg>Sin proveedores cargados.</EmptyMsg>}
      {proveedores.map(c => (<RowItem key={c.id} onClick={() => setForm(c)} onDelete={() => setProveedores(p => p.filter(x => x.id !== c.id))}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MIcon id="proveedores" /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{c.nombre}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{c.rubro || "—"}</div></div>
          <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
            {c.telefono && <a href={waLink(c.telefono, "")} target="_blank" rel="noreferrer" style={{ width: 32, height: 32, borderRadius: 7, background: "#ECFDF5", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 14 }}>✆</a>}
            {c.email && <a href={`mailto:${c.email}`} style={{ width: 32, height: 32, borderRadius: 7, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 13 }}>✉</a>}
          </div>
        </div>
      </RowItem>))}
    </div>
    <AddFab onClick={() => setForm({ nombre: "", rubro: "", email: "", telefono: "" })} label="Proveedor" />
    {form && <Sheet title={form.id ? "Editar proveedor" : "Nuevo proveedor"} onClose={() => setForm(null)}>
      <Field label="Nombre / razón social"><TInput value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Field>
      <Field label="Rubro"><TInput value={form.rubro} onChange={e => setForm({ ...form, rubro: e.target.value })} placeholder="Corralón, aberturas, hierros…" /></Field>
      <FieldRow>
        <Field label="Teléfono"><TInput value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></Field>
        <Field label="Email"><TInput value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
      </FieldRow>
      <PBtn full onClick={guardar} style={{ marginTop: 6 }}>{form.id ? "Guardar" : "Agregar"}</PBtn>
    </Sheet>}
  </div>);
}

// ── VIGILANCIA ───────────────────────────────────────────────────────
function CamaraTile({ cam, onDelete, obras }) {
  const [tick, setTick] = useState(0);
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); if (cam.tipo !== "snapshot") return; const iv = setInterval(() => setTick(t => t + 1), 5000); return () => clearInterval(iv); }, [cam.tipo, cam.url]);
  const src = cam.tipo === "snapshot" ? (cam.url + (cam.url.includes("?") ? "&" : "?") + "_t=" + tick) : cam.url;
  return (<div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, overflow: "hidden", boxShadow: T.shadow, marginBottom: 10 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: T.navy }}>
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>● {cam.nombre}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.6)" }}>{obraNom(obras, cam.obra_id)} · {cam.tipo}</div></div>
      {onDelete && <button onClick={onDelete} style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 6, width: 26, height: 26, cursor: "pointer", flexShrink: 0 }}>✕</button>}
    </div>
    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#0a0f17" }}>
      {cam.tipo === "iframe" ? <iframe src={cam.url} title={cam.nombre} style={{ width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen" />
        : cam.tipo === "hls" ? <video src={cam.url} controls playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }} onError={() => setErr(true)} />
          : <img src={src} alt={cam.nombre} style={{ width: "100%", height: "100%", objectFit: "cover", display: err ? "none" : "block" }} onError={() => setErr(true)} onLoad={() => setErr(false)} />}
      {err && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.6)", fontSize: 11.5, textAlign: "center", padding: 16, gap: 6 }}><div style={{ fontSize: 22 }}>📹</div><div>No se pudo cargar la cámara.<br />Revisá la URL, el acceso a la red y el formato (no RTSP).</div></div>}
    </div>
  </div>);
}

function VigilanciaView({ db, onBack }) {
  const { obras, vigilancia, setVigilancia, camaras, setCamaras } = db;
  const [form, setForm] = useState(null);
  const [camForm, setCamForm] = useState(null);
  const niveles = [{ id: "normal", c: "#16A34A", b: "#ECFDF5" }, { id: "atención", c: "#F59E0B", b: "#FFFBEB" }, { id: "incidente", c: "#EF4444", b: "#FEF2F2" }];
  function guardar() { if (!form.nota?.trim()) return; setVigilancia(p => [{ ...form, id: uid(), fecha: hoyStr() }, ...p]); setForm(null); }
  function guardarCam() { if (!camForm.nombre?.trim() || !camForm.url?.trim()) return; if (camForm.id) setCamaras(p => p.map(x => x.id === camForm.id ? camForm : x)); else setCamaras(p => [...p, { ...camForm, id: uid() }]); setCamForm(null); }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="vigilancia" label="Vigilancia" sub="Cámaras y partes de seguridad" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Eyebrow>Cámaras en vivo</Eyebrow>
        <button onClick={() => setCamForm({ nombre: "", obra_id: obras[0]?.id || "", tipo: "mjpeg", url: "" })} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 7, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ Agregar</button>
      </div>
      {(camaras || []).length === 0 && <div style={{ background: T.bg, border: `1px dashed ${T.border}`, borderRadius: T.rsm, padding: "18px", fontSize: 12, color: T.muted, lineHeight: 1.6, textAlign: "center", marginBottom: 18 }}>Sin cámaras configuradas. Agregá una con la URL del stream (MJPEG, snapshot JPG, HLS .m3u8 o embed web).</div>}
      {(camaras || []).map(c => <CamaraTile key={c.id} cam={c} obras={obras} onDelete={() => setCamaras(p => p.filter(x => x.id !== c.id))} />)}

      <div style={{ marginTop: 14 }}><Eyebrow>Partes de seguridad</Eyebrow></div>
      {vigilancia.length === 0 && <EmptyMsg>Sin novedades de vigilancia registradas.</EmptyMsg>}
      {vigilancia.map(v => { const n = niveles.find(x => x.id === v.nivel) || niveles[0]; return (<div key={v.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${n.c}`, borderRadius: T.rsm, padding: "12px 14px", marginBottom: 9, boxShadow: T.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <Badge color={n.c} bg={n.b}>{v.nivel}</Badge>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 11, color: T.muted }}>{v.fecha} · {obraNom(obras, v.obra_id)}</span><button onClick={() => setVigilancia(p => p.filter(x => x.id !== v.id))} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}>✕</button></div>
        </div>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{v.nota}</div>
      </div>); })}
    </div>
    <AddFab onClick={() => setForm({ obra_id: obras[0]?.id || "", nivel: "normal", nota: "" })} label="Novedad" />
    {camForm && <Sheet title={camForm.id ? "Editar cámara" : "Agregar cámara"} onClose={() => setCamForm(null)}>
      <Field label="Nombre"><TInput value={camForm.nombre} onChange={e => setCamForm({ ...camForm, nombre: e.target.value })} placeholder="Ej: Acceso Castores 475" /></Field>
      <FieldRow>
        <Field label="Obra"><Sel value={camForm.obra_id} onChange={e => setCamForm({ ...camForm, obra_id: e.target.value })}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
        <Field label="Tipo"><Sel value={camForm.tipo} onChange={e => setCamForm({ ...camForm, tipo: e.target.value })}><option value="mjpeg">MJPEG (stream)</option><option value="snapshot">Snapshot JPG</option><option value="hls">HLS (.m3u8)</option><option value="iframe">Embed web</option></Sel></Field>
      </FieldRow>
      <Field label="URL del stream"><TInput value={camForm.url} onChange={e => setCamForm({ ...camForm, url: e.target.value })} placeholder="http://usuario:clave@IP:puerto/ruta" /></Field>
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, marginBottom: 10 }}>El navegador no reproduce RTSP. Usá MJPEG, snapshot JPG, HLS o el embed web de tu cámara/NVR. La cámara tiene que ser accesible desde donde abrís la app (red local o con reenvío de puertos / DDNS).</div>
      <PBtn full onClick={guardarCam}>{camForm.id ? "Guardar" : "Agregar cámara"}</PBtn>
    </Sheet>}
    {form && <Sheet title="Nueva novedad" onClose={() => setForm(null)}>
      <FieldRow>
        <Field label="Obra"><Sel value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
        <Field label="Nivel"><Sel value={form.nivel} onChange={e => setForm({ ...form, nivel: e.target.value })}>{niveles.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}</Sel></Field>
      </FieldRow>
      <Field label="Descripción"><textarea value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} rows={4} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} /></Field>
      <PBtn full onClick={guardar} style={{ marginTop: 6 }}>Registrar</PBtn>
    </Sheet>}
  </div>);
}

// ── PRESENTISMO ──────────────────────────────────────────────────────
function PresentismoView({ db, onBack }) {
  const { personal, obras, presentismo, setPresentismo } = db;
  const [fecha, setFecha] = useState(hoyStr());
  const estadoDe = (pid) => presentismo.find(r => r.fecha === fecha && r.persona_id === pid)?.estado || null;
  function marcar(pid, estado) {
    setPresentismo(p => {
      const ex = p.find(r => r.fecha === fecha && r.persona_id === pid);
      if (ex) return p.map(r => (r === ex ? { ...r, estado } : r));
      return [...p, { id: uid(), fecha, persona_id: pid, estado }];
    });
  }
  const opts = [{ id: "presente", lbl: "P", c: "#16A34A", b: "#ECFDF5" }, { id: "tarde", lbl: "T", c: "#F59E0B", b: "#FFFBEB" }, { id: "ausente", lbl: "A", c: "#EF4444", b: "#FEF2F2" }];
  const pres = personal.filter(p => estadoDe(p.id) === "presente").length;
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <SubHead id="presentismo" label="Presentismo" sub="Control de asistencia diaria" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <Field label="Fecha"><TInput value={fecha} onChange={e => setFecha(e.target.value)} placeholder="dd/mm/aa" /></Field>
      <div style={{ display: "flex", gap: 9, margin: "4px 0 16px" }}>
        <MiniStat label="Presentes" value={pres} color="#16A34A" />
        <MiniStat label="Total" value={personal.length} />
      </div>
      {personal.length === 0 && <EmptyMsg>Cargá personal para tomar asistencia.</EmptyMsg>}
      {personal.map(p => { const est = estadoDe(p.id); return (<div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 8, boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{p.nombre}</div><div style={{ fontSize: 11, color: T.muted }}>{obraNom(obras, p.obra_id)}</div></div>
        <div style={{ display: "flex", gap: 5 }}>
          {opts.map(o => (<button key={o.id} onClick={() => marcar(p.id, o.id)} style={{ width: 34, height: 34, borderRadius: 7, fontSize: 13, fontWeight: 800, cursor: "pointer", border: `1px solid ${est === o.id ? o.c : T.border}`, background: est === o.id ? o.c : o.b, color: est === o.id ? "#fff" : o.c }}>{o.lbl}</button>))}
        </div>
      </div>); })}
    </div>
  </div>);
}

// ── ARCHIVOS ─────────────────────────────────────────────────────────
function ArchivosView({ db, onBack }) {
  const { obras, archivosGen, setArchivosGen, setObras } = db;
  const ref = useRef(null);
  const obraArch = obras.flatMap(o => (o.archivos || []).map(a => ({ ...a, obra: o.nombre, obra_id: o.id })));
  function borrarObraArch(a) {
    if (!confirm("¿Eliminar este archivo de la obra?")) return;
    const k = a.id || a.url || a.nombre;
    setObras(p => p.map(x => x.id === a.obra_id ? { ...x, archivos: (x.archivos || []).filter(f => (f.id || f.url || f.nombre) !== k) } : x));
  }
  async function subir(e) {
    const files = Array.from(e.target.files); if (!files.length) return;
    const nuevos = await Promise.all(files.map(async f => ({ id: uid(), nombre: f.name, url: await toDataUrl(f), fecha: hoyStr() })));
    setArchivosGen(p => [...nuevos, ...p]); e.target.value = "";
  }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="archivos" label="Archivos" sub="Repositorio general y por obra" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <input ref={ref} type="file" multiple onChange={subir} style={{ display: "none" }} />
      <button onClick={() => ref.current?.click()} style={{ width: "100%", background: T.navy, color: "#fff", border: `2px dashed ${BRASS}`, borderRadius: T.rsm, padding: "16px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 18 }}>＋ Subir archivo</button>
      {archivosGen.length > 0 && <><Eyebrow>Generales</Eyebrow>
        {archivosGen.map(a => (<RowItem key={a.id} onDelete={() => setArchivosGen(p => p.filter(x => x.id !== a.id))}>
          <a href={a.url} download={a.nombre} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: T.al, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MIcon id="archivos" /></div>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nombre}</div><div style={{ fontSize: 11, color: T.muted }}>{a.fecha}</div></div>
          </a>
        </RowItem>))}</>}
      {obraArch.length > 0 && <div style={{ marginTop: 16 }}><Eyebrow>De obras</Eyebrow>
        {obraArch.map((a, i) => (<RowItem key={i} onDelete={() => borrarObraArch(a)}>{a.url ? <a href={a.url} target="_blank" rel="noreferrer" download={a.nombre} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 11 }}><div style={{ width: 36, height: 36, borderRadius: 8, background: T.bg, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MIcon id="archivos" /></div><div><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{a.nombre || "archivo"}</div><div style={{ fontSize: 11, color: T.muted }}>{a.obra}</div></div></a> : <div style={{ display: "flex", alignItems: "center", gap: 11 }}><div style={{ width: 36, height: 36, borderRadius: 8, background: T.bg, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MIcon id="archivos" /></div><div><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{a.nombre || "archivo"}</div><div style={{ fontSize: 11, color: T.muted }}>{a.obra}</div></div></div>}</RowItem>))}
      </div>}
      {archivosGen.length === 0 && obraArch.length === 0 && <EmptyMsg>Sin archivos cargados.</EmptyMsg>}
    </div>
  </div>);
}

// ── INFO EXTERNA (IA + web) ──────────────────────────────────────────
function InfoExternaView({ apiKey, onBack }) {
  const [q, setQ] = useState(""); const [r, setR] = useState(""); const [loading, setLoading] = useState(false);
  async function buscar(texto) {
    const c = (texto ?? q).trim(); if (!c) return; setLoading(true); setR(""); setQ(c);
    const res = await callAI([{ role: "user", content: c }], "Sos un asistente de información para una constructora argentina. Respondé con datos actuales y concretos en español rioplatense. Citá la fuente cuando puedas.", apiKey, true);
    setR(res); setLoading(false);
  }
  const chips = ["Precio del cemento Portland hoy en Argentina", "Cotización del dólar blue hoy", "Valor del m² de construcción en CABA", "Últimas normativas de obra de AA2000"];
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <SubHead id="info" label="Info externa" sub="Consultas con búsqueda en internet" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <TInput value={q} onChange={e => setQ(e.target.value)} placeholder="Precios, cotizaciones, normativas…" />
        <button onClick={() => buscar()} disabled={loading} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: T.rsm, padding: "0 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>{loading ? "…" : "Buscar"}</button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {chips.map((ch, i) => <button key={i} onClick={() => buscar(ch)} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 20, padding: "7px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>{ch}</button>)}
      </div>
      {loading && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: 20 }}>Buscando en internet…</div>}
      {r && <Card style={{ padding: 16 }}><Eyebrow>Resultado</Eyebrow><div style={{ background: T.bg, borderRadius: T.rsm, padding: "13px 15px", fontSize: 12.5, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{r}</div></Card>}
      {!apiKey && <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginTop: 12 }}>Requiere API Key (Más → Configuración).</div>}
    </div>
  </div>);
}

// ── RESUMEN ──────────────────────────────────────────────────────────
function ResumenView({ db, apiKey, onBack }) {
  const { obras, lics, personal } = db;
  const [exec, setExec] = useState(""); const [loading, setLoading] = useState(false);
  const cartera = obras.reduce((a, o) => a + parseMontoNum(o.monto), 0);
  const cobrado = obras.reduce((a, o) => a + (o.pagado || 0), 0);
  const activas = obras.filter(o => o.estado === "curso").length;
  const avgAvance = obras.length ? Math.round(obras.reduce((a, o) => a + (o.avance || 0), 0) / obras.length) : 0;
  async function generar() {
    setLoading(true);
    const ctx = `Obras: ${obras.length} (${activas} en curso). Cartera ${money(cartera)}, cobrado ${money(cobrado)}. Avance promedio ${avgAvance}%. Personal: ${personal.length}. Proyectos: ${lics.length}.`;
    const r = await callAI([{ role: "user", content: `Redactá un resumen ejecutivo breve (5-6 líneas) del estado operativo de V+V Construcciones. Datos: ${ctx}` }], "Sos analista de gestión de V+V Construcciones. Español rioplatense, tono ejecutivo.", apiKey, false);
    setExec(r); setLoading(false);
  }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <SubHead id="resumen" label="Resumen" sub="Panorama global de la operación" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 16 }}>
        <MiniStat label="Obras activas" value={activas} color="#16A34A" />
        <MiniStat label="Avance prom." value={avgAvance + "%"} color={T.accent} />
        <MiniStat label="Cartera total" value={money(cartera)} />
        <MiniStat label="Cobrado" value={`${cartera ? Math.round(cobrado / cartera * 100) : 0}%`} color={BRASS} />
        <MiniStat label="Personal" value={personal.length} />
        <MiniStat label="Proyectos" value={lics.length} />
      </div>
      <Card style={{ padding: 15 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: exec ? 12 : 0 }}>
          <Eyebrow>Resumen ejecutivo IA</Eyebrow>
          <button onClick={generar} disabled={loading} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{loading ? "…" : "Generar"}</button>
        </div>
        {exec && <div style={{ background: T.bg, borderRadius: T.rsm, padding: "13px 15px", fontSize: 12.5, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{exec}</div>}
      </Card>
    </div>
  </div>);
}

// ── COTIZACIÓN ───────────────────────────────────────────────────────
function CotizacionView({ db, apiKey, onBack }) {
  const { obras } = db;
  const [obraId, setObraId] = useState("");
  const [desc, setDesc] = useState(""); const [r, setR] = useState(""); const [loading, setLoading] = useState(false);
  async function cotizar() {
    if (!desc.trim()) return; setLoading(true); setR("");
    const o = obras.find(x => x.id === obraId);
    const sys = "Sos cotizador de obra de V+V Construcciones (Argentina). Cotizás a precios de mercado actuales en pesos argentinos: materiales, mano de obra, equipos, seguros y gastos generales. Devolvés un presupuesto desglosado por ítems con subtotales y total. Español rioplatense.";
    const prompt = `Cotizá el siguiente trabajo${o ? ` para la obra "${o.nombre}" (${o.sector})` : ""}:\n\n${desc}\n\nUsá precios actuales del mercado de la construcción argentino.`;
    const res = await callAI([{ role: "user", content: prompt }], sys, apiKey, true);
    setR(res); setLoading(false);
  }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <SubHead id="cotizacion" label="Cotización" sub="Presupuesto asistido a valores de mercado" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <Field label="Obra (opcional)"><Sel value={obraId} onChange={e => setObraId(e.target.value)}><option value="">— Sin obra —</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      <Field label="Descripción del trabajo / pliego"><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={5} placeholder="Ej: Provisión y colocación de 120 m² de porcelanato 60x60 en planta baja, incluida carpeta…" style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} /></Field>
      <PBtn full onClick={cotizar} disabled={loading}>{loading ? "Cotizando a precios de mercado…" : "Cotizar con IA"}</PBtn>
      {!apiKey && <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginTop: 8 }}>Requiere API Key (Más → Configuración).</div>}
      {r && <Card style={{ padding: 16, marginTop: 16 }}><Eyebrow>Presupuesto estimado</Eyebrow><div style={{ background: T.bg, borderRadius: T.rsm, padding: "13px 15px", fontSize: 12.5, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{r}</div></Card>}
    </div>
  </div>);
}

// ── HERRAMIENTAS ─────────────────────────────────────────────────────
function HerramientasView({ db, onBack }) {
  const { obras, herramientas, setHerramientas } = db;
  const [form, setForm] = useState(null);
  const est = [{ id: "ok", c: "#16A34A", b: "#ECFDF5" }, { id: "reparación", c: "#F59E0B", b: "#FFFBEB" }, { id: "baja", c: "#EF4444", b: "#FEF2F2" }];
  function guardar() { if (!form.nombre?.trim()) return; if (form.id) setHerramientas(p => p.map(x => x.id === form.id ? form : x)); else setHerramientas(p => [...p, { ...form, id: uid() }]); setForm(null); }
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="herramientas" label="Herramientas" sub="Inventario y ubicación" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      {herramientas.length === 0 && <EmptyMsg>Sin herramientas en el inventario.</EmptyMsg>}
      {herramientas.map(h => { const e = est.find(x => x.id === h.estado) || est[0]; return (<RowItem key={h.id} onClick={() => setForm(h)} onDelete={() => setHerramientas(p => p.filter(x => x.id !== h.id))}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{h.nombre} {h.cantidad ? `×${h.cantidad}` : ""}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{obraNom(obras, h.obra_id)}</div></div>
          <Badge color={e.c} bg={e.b}>{h.estado}</Badge>
        </div>
      </RowItem>); })}
    </div>
    <AddFab onClick={() => setForm({ nombre: "", cantidad: "1", obra_id: obras[0]?.id || "", estado: "ok" })} label="Herramienta" />
    {form && <Sheet title={form.id ? "Editar herramienta" : "Nueva herramienta"} onClose={() => setForm(null)}>
      <Field label="Herramienta / equipo"><TInput value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Amoladora Bosch" /></Field>
      <FieldRow>
        <Field label="Cantidad"><TInput type="number" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} /></Field>
        <Field label="Estado"><Sel value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>{est.map(x => <option key={x.id} value={x.id}>{x.id}</option>)}</Sel></Field>
      </FieldRow>
      <Field label="Obra / ubicación"><Sel value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })}><option value="">Depósito</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      <Adjuntos items={form.adjuntos} onChange={next => setForm({ ...form, adjuntos: next })} />
      <PBtn full onClick={guardar} style={{ marginTop: 10 }}>{form.id ? "Guardar" : "Agregar"}</PBtn>
    </Sheet>}
  </div>);
}

// ── DÍAS TRABAJADOS ──────────────────────────────────────────────────
function DiasView({ db, onBack }) {
  const { personal, obras, presentismo } = db;
  const conteo = personal.map(p => {
    const regs = presentismo.filter(r => r.persona_id === p.id);
    const dias = regs.filter(r => r.estado === "presente").length + regs.filter(r => r.estado === "tarde").length;
    return { ...p, dias, tarde: regs.filter(r => r.estado === "tarde").length, aus: regs.filter(r => r.estado === "ausente").length };
  }).sort((a, b) => b.dias - a.dias);
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <SubHead id="dias" label="Días trabajados" sub="Acumulado por presentismo" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      {personal.length === 0 && <EmptyMsg>Sin personal registrado.</EmptyMsg>}
      {conteo.map(p => (<div key={p.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px 14px", marginBottom: 9, boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{p.nombre}</div><div style={{ fontSize: 11, color: T.muted }}>{obraNom(obras, p.obra_id)} · {p.tarde} tarde · {p.aus} aus.</div></div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800, color: T.accent, lineHeight: 1 }}>{p.dias}</div><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>días</div></div>
      </div>))}
      <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>Los días se calculan a partir del módulo Presentismo.</div>
    </div>
  </div>);
}

// ── ALERTAS WA (composer) ────────────────────────────────────────────
function AlertasWaView({ db, onBack }) {
  const { personal, obras } = db;
  const conTel = personal.filter(p => p.telefono);
  const [sel, setSel] = useState([]);
  const [tpl, setTpl] = useState("custom");
  const [msg, setMsg] = useState("");
  const plantillas = {
    custom: "",
    inicio: "Buen día. Te recordamos que mañana se inicia la jornada a las 8:00 hs en obra. Saludos, V+V Construcciones.",
    doc: "Hola, necesitamos que actualices tu documentación (ART/preocupacional) que está por vencer. Acercate a administración. Gracias — V+V.",
    suspension: "Atención: por condiciones climáticas se suspende la jornada de hoy. Te avisamos cuando se retome. V+V Construcciones.",
  };
  const texto = tpl === "custom" ? msg : plantillas[tpl];
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    <SubHead id="alertas" label="Alertas WA" sub="Avisos por WhatsApp al personal" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <Field label="Plantilla"><Sel value={tpl} onChange={e => setTpl(e.target.value)}>
        <option value="custom">Mensaje personalizado</option>
        <option value="inicio">Recordatorio de inicio de jornada</option>
        <option value="doc">Documentación por vencer</option>
        <option value="suspension">Suspensión por clima</option>
      </Sel></Field>
      <Field label="Mensaje"><textarea value={tpl === "custom" ? msg : plantillas[tpl]} onChange={e => { setTpl("custom"); setMsg(e.target.value); }} rows={4} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} /></Field>
      <Eyebrow>Destinatarios ({sel.length})</Eyebrow>
      {conTel.length === 0 && <EmptyMsg>Ningún trabajador tiene WhatsApp cargado. Agregalo en Personal.</EmptyMsg>}
      {conTel.map(p => (<div key={p.id} onClick={() => toggle(p.id)} style={{ display: "flex", alignItems: "center", gap: 11, background: sel.includes(p.id) ? T.al : T.card, border: `1px solid ${sel.includes(p.id) ? T.accent : T.border}`, borderRadius: T.rsm, padding: "11px 13px", marginBottom: 8, cursor: "pointer" }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${sel.includes(p.id) ? T.accent : T.border}`, background: sel.includes(p.id) ? T.accent : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>{sel.includes(p.id) ? "✓" : ""}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{p.nombre}</div><div style={{ fontSize: 11, color: T.muted }}>{obraNom(obras, p.obra_id)}</div></div>
        <a href={waLink(p.telefono, texto)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ background: "#25D366", color: "#fff", borderRadius: 7, padding: "7px 11px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Enviar</a>
      </div>))}
      {sel.length > 0 && texto && <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Abrí los chats seleccionados uno por uno:</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {sel.map(id => { const p = personal.find(x => x.id === id); return <a key={id} href={waLink(p.telefono, texto)} target="_blank" rel="noreferrer" style={{ background: "#25D366", color: "#fff", borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700, textAlign: "center", textDecoration: "none" }}>WhatsApp a {p.nombre}</a>; })}
        </div>
      </div>}
    </div>
  </div>);
}


// ── PEDIDOS / SEGUIMIENTO (agente entre empresas) ────────────────────
const PEDIDO_ESTADOS = { abierto:{l:"Abierto",c:"#F59E0B",b:"#FFFBEB"}, en_proceso:{l:"En proceso",c:"#3B82F6",b:"#EFF6FF"}, respondido:{l:"Respondido",c:"#8B5CF6",b:"#F5F3FF"}, resuelto:{l:"Resuelto",c:"#16A34A",b:"#ECFDF5"} };
const PEDIDO_MAX_IA = 4; // tope de intercambios automáticos IA↔IA por pedido
function parseAccion(texto){ const t=texto||""; let m=t.match(/```accion\s*([\s\S]*?)```/i)||t.match(/```accion\s*([\s\S]*)$/i); if(!m) return {limpio:texto,accion:null}; let raw=m[1].trim(); let a=null; try{a=JSON.parse(raw);}catch{ const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i){ try{a=JSON.parse(raw.slice(i,j+1));}catch{} } } return {limpio:(t.replace(m[0],"").trim()||"Listo."),accion:a}; }
function nuevoPedido({de,para,asunto,detalle,prioridad,obra_id}){ const f=hoyStr(),ts=Date.now(); return {id:uid()+ts, de, para, asunto:asunto||"(sin asunto)", estado:"abierto", prioridad:prioridad||"media", obra_id:obra_id||"", fecha:f, ts, iaTurns:0, hilo:[{de,texto:detalle||asunto||"",fecha:f,ts,porIA:false}]}; }
async function aplicarPedidos(setPedidos, fn){ let arr=[]; try{const r=await storage.get("vv_pedidos"); if(r?.value) arr=JSON.parse(r.value);}catch{} const next=fn(arr.slice()); setPedidos(next); return next; }
async function ejecutarAccion(accion, miSide, ctx){
  ctx = ctx || {};
  const setPedidos = ctx.setPedidos;
  if(!accion||!accion.tipo) return null;
  const otro = miSide==="vv" ? "cliente":"vv";
  if(accion.tipo==="crear_pedido"){ const para=(accion.para==="vv"||accion.para==="cliente")?accion.para:otro; const obs=ctx.obras||[]; const obra_id=accion.obra_id||(accion.obra?obs.find(o=>(o.nombre||"").toLowerCase().includes(String(accion.obra).toLowerCase()))?.id:"")||""; const p=nuevoPedido({de:miSide,para,asunto:accion.asunto,detalle:accion.detalle,prioridad:accion.prioridad,obra_id}); await aplicarPedidos(setPedidos,arr=>[p,...arr]); try{ pushNotify("Nuevo pedido", `${miSide==="vv"?"V+V":"Belfast"}: ${p.asunto}`, para==="vv"?"vv":"belfast"); }catch(e){} return `Pedido creado y enviado: “${p.asunto}”.`; }
  if(accion.tipo==="responder_pedido"){ const f=hoyStr(),ts=Date.now(); await aplicarPedidos(setPedidos,arr=>arr.map(x=>x.id===accion.pedido_id?{...x,estado:"respondido",hilo:[...x.hilo,{de:miSide,texto:accion.texto||"",fecha:f,ts,porIA:false}]}:x)); return "Respuesta enviada."; }
  if(accion.tipo==="resolver_pedido"){ await aplicarPedidos(setPedidos,arr=>arr.map(x=>x.id===accion.pedido_id?{...x,estado:"resuelto"}:x)); return "Pedido marcado como resuelto."; }
  if(accion.tipo==="cargar_personal"){
    if(!ctx.setPersonal) return "No se pudo cargar el personal.";
    const sitio=accion.sitio||"(sin sitio)"; const f=hoyStr(); const sel=accion.personal||"todos";
    const obras=ctx.obras||[]; const obraId=accion.obra?(obras.find(o=>(o.nombre||"").toLowerCase().includes(String(accion.obra).toLowerCase()))?.id):null;
    const incluir=(p)=>{ if(obraId) return p.obra_id===obraId; if(Array.isArray(sel)) return sel.some(n=>(p.nombre||"").toLowerCase().includes(String(n).toLowerCase())); return sel==="todos"||sel==="all"; };
    let arr=ctx.personal||[]; try{const r=await storage.get("vv_personal"); if(r?.value) arr=JSON.parse(r.value);}catch{}
    let n=0; const next=arr.map(p=>{ if(incluir(p)){ n++; const sitios=(p.sitios||[]).filter(s=>s.sitio!==sitio); return {...p,sitios:[...sitios,{sitio,fecha:f}]}; } return p; });
    ctx.setPersonal(next); return `Cargué ${n} trabajador(es) al sitio “${sitio}”.`;
  }
  if(accion.tipo==="enviar_mensaje"){
    const msg={ id:uid()+Date.now(), from:miSide, texto:accion.texto||"", fecha:hoyStr(), ts:Date.now(), archivos:[] };
    let arr=[]; try{const r=await storage.get("vv_mensajes"); if(r?.value) arr=JSON.parse(r.value);}catch{}
    const next=[...arr,msg]; try{ localStorage.setItem("vv_mensajes",JSON.stringify(next)); }catch{} await storage.set("vv_mensajes",JSON.stringify(next)).catch(()=>{});
    if(ctx.setMensajes) ctx.setMensajes(next);
    try{ pushNotify("Nuevo mensaje", `${miSide==="vv"?"V+V":"Belfast"}: ${(accion.texto||"").slice(0,80)}`, miSide==="vv"?"belfast":"vv"); }catch(e){}
    return "Mensaje enviado a la otra empresa (aparece en Mensajes).";
  }
  if(accion.tipo==="preguntar_ia"){
    const msg={ id:uid()+Date.now(), from:miSide, texto:accion.texto||"", tipo:"q", answered:false, fecha:hoyStr(), ts:Date.now() };
    let arr=[]; try{const r=await storage.get("ia_dialogo"); if(r?.value) arr=JSON.parse(r.value);}catch{}
    const next=[...arr,msg]; try{ localStorage.setItem("ia_dialogo",JSON.stringify(next)); }catch{} await storage.set("ia_dialogo",JSON.stringify(next)).catch(()=>{});
    return "Le pasé tu consulta directo a la IA de la otra empresa. Te muestro acá la respuesta apenas conteste.";
  }
  if(accion.tipo==="pedido_materiales"){
    const obs=ctx.obras||[];
    const obra_id=accion.obra_id||(accion.obra?obs.find(o=>(o.nombre||"").toLowerCase().includes(String(accion.obra).toLowerCase()))?.id:"")||(obs[0]?.id||"");
    const items=Array.isArray(accion.items)?accion.items.filter(it=>it&&(it.nombre||"").trim()).map(it=>({nombre:String(it.nombre).trim(),cantidad:it.cantidad!=null?String(it.cantidad):"",unidad:it.unidad?String(it.unidad):"u"})):[];
    if(!items.length) return "No pude leer los materiales. Decime qué necesitás (material y cantidad) y de qué obra.";
    const p={ id:uid()+Date.now(), obra_id, items, nota:accion.nota||"", fecha:hoyStr(), ts:Date.now(), de:"vv", leido:false, leidoFecha:"" };
    let arr=[]; try{const r=await storage.get("vv_matpedidos"); if(r?.value) arr=JSON.parse(r.value);}catch{}
    const next=[p,...arr]; try{ localStorage.setItem("vv_matpedidos",JSON.stringify(next)); }catch{} await storage.set("vv_matpedidos",JSON.stringify(next)).catch(()=>{});
    if(ctx.setMatpedidos) ctx.setMatpedidos(next);
    const resumen=items.map(it=>`${it.cantidad} ${it.unidad} ${it.nombre}`.trim()).join(", ");
    return `Pedido de materiales cargado y enviado a Belfast (${obraNom(obs,obra_id)}): ${resumen}. Le queda como no leído hasta que lo levante.`;
  }
  return null;
}
function accionLabel(a){ if(!a) return ""; if(a.tipo==="crear_pedido") return `Crear pedido → ${a.para==="vv"?"V+V":"Cliente"}: “${a.asunto||""}”`; if(a.tipo==="responder_pedido") return "Responder pedido"; if(a.tipo==="resolver_pedido") return "Marcar pedido como resuelto"; if(a.tipo==="enviar_mensaje") return `Enviar mensaje a la otra empresa: “${(a.texto||"").slice(0,60)}”`; if(a.tipo==="preguntar_ia") return `Consultar a la IA de la otra empresa: “${(a.texto||"").slice(0,60)}”`; if(a.tipo==="pedido_materiales") return `Pedido de materiales → Belfast: ${(a.items||[]).map(it=>`${it.cantidad||""} ${it.unidad||""} ${it.nombre}`.trim()).join(", ").slice(0,70)}`; if(a.tipo==="whatsapp") return `WhatsApp a ${a.persona||a.rol||"contacto"}: “${(a.texto||"").slice(0,50)}”`; if(a.tipo==="traer_fotos") return `Traer ${a.videos?"videos":"fotos"} de ${a.obra||"la obra"}`; if(a.tipo==="traer_plano") return `Traer plano ${a.buscar?`"${a.buscar}" `:""}de ${a.obra||"la obra"}`; if(a.tipo==="cargar_personal") return `Cargar personal al sitio “${a.sitio||""}”${a.obra?` (obra ${a.obra})`:a.personal&&a.personal!=="todos"?` (${Array.isArray(a.personal)?a.personal.join(", "):a.personal})`:" (todos)"}`; return a.tipo; }

function PedidosView({ db, cfg, apiKey, onBack }) {
  const { pedidos, setPedidos, obras } = db;
  const miSide = "vv"; const otroNom = cfg?.clienteNombre || "Cliente";
  const [filtro, setFiltro] = useState("todos");
  const [open, setOpen] = useState(null);
  const [nuevo, setNuevo] = useState(null);
  const [reply, setReply] = useState("");
  const [adj, setAdj] = useState([]);
  const [iaLoad, setIaLoad] = useState(false);
  const fileRef = useRef(null);
  async function addAdj(e) { const files = Array.from(e.target.files); if (!files.length) return; const nuevos = []; for (const f of files) { const data = await toDataUrl(f); const url = await uploadFoto(data, "pedidos", f.name.replace(/\W+/g, "_")); nuevos.push({ nombre: f.name, url, img: f.type.startsWith("image/") }); } setAdj(p => [...p, ...nuevos]); e.target.value = ""; }

  useEffect(() => { const pull = async () => { try { const r = await storage.get("vv_pedidos"); if (r?.value) { const arr = JSON.parse(r.value); setPedidos(prev => JSON.stringify(arr) !== JSON.stringify(prev) ? arr : prev); } } catch {} }; pull(); const iv = setInterval(pull, 4000); const onVis = () => { if (document.visibilityState === "visible") pull(); }; document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", pull); return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", pull); }; }, []);

  const lista = pedidos.filter(p => filtro === "todos" ? true : filtro === "recibidos" ? p.para === miSide : p.de === miSide);
  const cur = open ? pedidos.find(p => p.id === open) : null;
  function crear() { if (!nuevo.asunto?.trim()) return; aplicarPedidos(setPedidos, arr => [nuevoPedido({ de: miSide, para: "cliente", asunto: nuevo.asunto, detalle: nuevo.detalle, prioridad: nuevo.prioridad, obra_id: nuevo.obra_id }), ...arr]); setNuevo(null); }
  function responder(id, texto, porIA, archivos) { if (!texto?.trim() && !(archivos || []).length) return; const f = hoyStr(), ts = Date.now(); aplicarPedidos(setPedidos, arr => arr.map(x => x.id === id ? { ...x, estado: "respondido", hilo: [...x.hilo, { de: miSide, texto, fecha: f, ts, porIA: !!porIA, archivos: archivos || [] }] } : x)); setReply(""); setAdj([]); }
  function setEstado(id, estado) { aplicarPedidos(setPedidos, arr => arr.map(x => x.id === id ? { ...x, estado } : x)); }
  function borrarPedido(id) { if (!confirm("¿Eliminar este pedido? Se borra para las dos empresas.")) return; aplicarPedidos(setPedidos, arr => arr.filter(x => x.id !== id)); setOpen(null); }
  async function responderIA(p) {
    setIaLoad(true);
    const hist = p.hilo.map(h => `${h.de === miSide ? "Nosotros (V+V)" : otroNom}: ${h.texto}`).join("\n");
    const sys = `Sos el agente de V+V Construcciones gestionando un pedido con ${otroNom}. Redactá una respuesta breve, concreta y profesional (español rioplatense) al último mensaje del hilo. Solo el texto de la respuesta, sin encabezados.`;
    const r = await callAI([{ role: "user", content: `Pedido: ${p.asunto}\n\nHilo:\n${hist}\n\nRedactá nuestra respuesta.` }], sys, apiKey, false);
    setReply(r); setIaLoad(false);
  }
  const persp = (h) => h.de === miSide;

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="pedidos" label="Pedidos · Seguimiento" sub={`Gestión de temas con ${otroNom}`} onBack={onBack} />
    {!cur && <div style={{ padding: "16px 20px" }}>
      {(() => { const pend = pedidos.filter(p => p.para === miSide && p.estado !== "resuelto"); if (!pend.length) return null; const obrasTxt = [...new Set(pend.map(p => p.obra_id ? obraNom(obras, p.obra_id) : "general").filter(Boolean))].join(", "); return (<div style={{ display: "flex", alignItems: "center", gap: 11, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: T.rsm, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EF4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{pend.length}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>{pend.length} pedido{pend.length > 1 ? "s" : ""} pendiente{pend.length > 1 ? "s" : ""} de respuesta</div><div style={{ fontSize: 11.5, color: "#B91C1C", marginTop: 1 }}>{obrasTxt ? `Obras: ${obrasTxt}` : ""}</div></div>
      </div>); })()}
      <div style={{ display: "flex", gap: 9, marginBottom: 16 }}>
        <MiniStat label="Abiertos" value={pedidos.filter(p => p.estado !== "resuelto").length} color="#F59E0B" />
        <MiniStat label="Recibidos" value={pedidos.filter(p => p.para === miSide && p.estado !== "resuelto").length} color="#3B82F6" />
        <MiniStat label="Resueltos" value={pedidos.filter(p => p.estado === "resuelto").length} color="#16A34A" />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["todos", "Todos"], ["recibidos", "Recibidos"], ["enviados", "Enviados"]].map(([k, l]) => <button key={k} onClick={() => setFiltro(k)} style={{ flex: 1, padding: "8px", borderRadius: T.rsm, border: `1px solid ${filtro === k ? T.accent : T.border}`, background: filtro === k ? T.al : T.card, color: filtro === k ? T.accent : T.sub, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
      </div>
      {lista.length === 0 && <EmptyMsg>Sin pedidos. Creá uno o pedíselo al Asistente IA (“pedí definiciones a {otroNom} sobre…”).</EmptyMsg>}
      {lista.map(p => { const e = PEDIDO_ESTADOS[p.estado]; const ult = p.hilo[p.hilo.length - 1]; return (<RowItem key={p.id} onClick={() => { setOpen(p.id); setReply(""); }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{p.asunto}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
              {p.obra_id && <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, background: T.al, borderRadius: 5, padding: "2px 7px" }}>🏗 {obraNom(obras, p.obra_id)}</span>}
              {p.para === miSide && p.estado !== "resuelto" && <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444", background: "#FEF2F2", borderRadius: 5, padding: "2px 7px" }}>● Pendiente de respuesta</span>}
              <span style={{ fontSize: 10.5, color: T.muted }}>{p.de === miSide ? "Enviado" : "Recibido"} · {p.fecha}</span>
            </div>
            <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{ult?.porIA ? "🤖 " : ""}{ult?.texto}</div>
          </div>
          <Badge color={e.c} bg={e.b}>{e.l}</Badge>
        </div>
      </RowItem>); })}
    </div>}

    {cur && (() => { const e = PEDIDO_ESTADOS[cur.estado]; return (<div style={{ padding: "16px 20px" }}>
      <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: T.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>← Volver a la lista</button>
      <Card style={{ padding: 15, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{cur.asunto}</div>
          <Badge color={e.c} bg={e.b}>{e.l}</Badge>
        </div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{cur.de === miSide ? `Enviado a ${otroNom}` : `Recibido de ${otroNom}`} · {cur.fecha} · prioridad {cur.prioridad}</div>
        {cur.obra_id && <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: T.accent, background: T.al, borderRadius: 6, padding: "4px 10px", marginTop: 8 }}>🏗 Obra: {obraNom(obras, cur.obra_id)}</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {Object.entries(PEDIDO_ESTADOS).map(([k, v]) => <button key={k} onClick={() => setEstado(cur.id, k)} style={{ flex: 1, padding: "7px 4px", borderRadius: 7, border: `1px solid ${cur.estado === k ? v.c : T.border}`, background: cur.estado === k ? v.b : T.card, color: cur.estado === k ? v.c : T.muted, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{v.l}</button>)}
        </div>
        <button onClick={() => borrarPedido(cur.id)} style={{ width: "100%", marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar pedido</button>
      </Card>
      <Eyebrow>Hilo</Eyebrow>
      {cur.hilo.map((h, i) => { const mine = persp(h); return (<div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
        <div style={{ maxWidth: "85%" }}>
          <div style={{ background: mine ? T.navy : T.card, color: mine ? "#fff" : T.text, border: mine ? "none" : `1px solid ${T.border}`, borderRadius: mine ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "10px 13px", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {h.texto}
            {(h.archivos || []).map((a, j) => a.img ? <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 7 }}><img src={a.url} alt={a.nombre} style={{ maxWidth: "100%", borderRadius: 8, display: "block" }} /></a> : <a key={j} href={a.url} target="_blank" rel="noreferrer" download={a.nombre} style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: mine ? "#fff" : T.accent, textDecoration: "underline" }}>📎 {a.nombre}</a>)}
          </div>
          <div style={{ fontSize: 9.5, color: T.muted, marginTop: 3, textAlign: mine ? "right" : "left" }}>{h.porIA ? "🤖 IA · " : ""}{mine ? "V+V" : otroNom} · {h.fecha}</div>
        </div>
      </div>); })}
      <div style={{ marginTop: 12 }}>
        <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Escribí una respuesta…" rows={3} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 13.5, color: T.text }} />
        {adj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{adj.map((a, i) => <span key={i} style={{ background: T.al, borderRadius: 6, padding: "5px 9px", fontSize: 11, color: T.sub }}>{a.img ? "🖼" : "📎"} {a.nombre} <span onClick={() => setAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.muted }}>✕</span></span>)}</div>}
        <input ref={fileRef} type="file" multiple onChange={addAdj} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => fileRef.current?.click()} style={{ width: 44, background: T.bg, color: T.sub, border: `1px solid ${T.border}`, borderRadius: T.rsm, fontSize: 17, cursor: "pointer" }}>＋</button>
          <button onClick={() => responderIA(cur)} disabled={iaLoad} style={{ flex: 1, background: T.al, color: T.accent, border: "none", borderRadius: T.rsm, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{iaLoad ? "Redactando…" : "🤖 Redactar con IA"}</button>
          <PBtn onClick={() => responder(cur.id, reply, false, adj)} style={{ flex: 1 }}>Enviar</PBtn>
        </div>
      </div>
    </div>); })()}

    {!cur && <AddFab onClick={() => setNuevo({ asunto: "", detalle: "", prioridad: "media", obra_id: "" })} label="Pedido" />}
    {nuevo && <Sheet title={`Nuevo pedido a ${otroNom}`} onClose={() => setNuevo(null)}>
      <Field label="Asunto"><TInput value={nuevo.asunto} onChange={e => setNuevo({ ...nuevo, asunto: e.target.value })} placeholder="Ej: Definiciones de terminaciones PB" /></Field>
      <Field label="Detalle / solicitud"><textarea value={nuevo.detalle} onChange={e => setNuevo({ ...nuevo, detalle: e.target.value })} rows={4} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} /></Field>
      <FieldRow>
        <Field label="Prioridad"><Sel value={nuevo.prioridad} onChange={e => setNuevo({ ...nuevo, prioridad: e.target.value })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Sel></Field>
        <Field label="Obra"><Sel value={nuevo.obra_id} onChange={e => setNuevo({ ...nuevo, obra_id: e.target.value })}><option value="">—</option>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      </FieldRow>
      <PBtn full onClick={crear} style={{ marginTop: 6 }}>Crear y enviar</PBtn>
    </Sheet>}
  </div>);
}

// ── FORMULARIOS / PLANTILLAS EN USO CONTINUO ─────────────────────────
const FORM_TPLS = [
  { id: "cie", nombre: "Certificado de Inicio de Etapa", sub: "00 · Tareas preliminares", modo: "sino", obs: true, resultado: ["APTO PARA INICIO", "APTO CON OBSERVACIONES", "NO APTO PARA INICIO"], secciones: [
    { t: "Documentación y definiciones técnicas", items: ["Alcance de los trabajos definido", "Sectores de intervención definidos", "Planos aplicables disponibles en obra", "Replanteos, niveles y referencias definidos", "Detalles específicos necesarios para la etapa disponibles"] },
    { t: "Condiciones operativas", items: ["Acceso habilitado para personal", "Frente de trabajo disponible", "Área de acopio disponible", "Circulaciones internas definidas", "Interferencias relevantes informadas"] },
    { t: "Servicios provisorios", items: ["Energía eléctrica disponible", "Agua disponible", "Sanitarios disponibles", "Condiciones mínimas de seguridad disponibles"] },
    { t: "Materiales y recursos", items: ["Materiales necesarios disponibles en obra", "Equipos requeridos disponibles", "Medios auxiliares necesarios disponibles"] }] },
  { id: "iav", nombre: "Informe de Auditoría y Viabilidad", sub: "Albañilería · Aud. H. Ayala", modo: "conforme", obs: true, interferencias: true, textos: [{ k: "observaciones", l: "Observaciones técnicas" }, { k: "recomendaciones", l: "Recomendaciones" }], resultado: ["APTO PARA INICIO", "APTO CON OBSERVACIONES", "NO APTO PARA INICIO"], secciones: [
    { t: "Documentación", items: ["Planos de arquitectura vigentes", "Planos de detalles constructivos disponibles", "Niveles y cotas definidas", "Modificaciones de proyecto informadas", "Criterios de terminación definidos"] },
    { t: "Condiciones operativas", items: ["Frente de trabajo liberado", "Replanteo ejecutado y verificado", "Niveles de referencia materializados", "Estructura receptora finalizada", "Sectores accesibles para ejecución", "Interferencias identificadas e informadas"] },
    { t: "Servicios provisorios", items: ["Energía eléctrica disponible", "Agua disponible", "Sanitarios disponibles", "Condiciones mínimas de seguridad disponibles"] },
    { t: "Materiales y recursos", items: ["Materiales necesarios disponibles en obra", "Equipos requeridos disponibles", "Medios auxiliares necesarios disponibles"] },
    { t: "Interferencias y precondiciones técnicas", items: ["Instalaciones sanitarias ejecutadas según proyecto", "Instalaciones eléctricas coordinadas", "Instalaciones especiales coordinadas", "Aberturas definidas y verificadas", "Elementos estructurales ejecutados según proyecto", "No existen interferencias que impidan la ejecución"] },
    { t: "Control específico de albañilería", items: ["Tipo de mampostería definido", "Espesores de muro definidos", "Encuentros constructivos definidos", "Refuerzos previstos identificados", "Dinteles definidos", "Terminaciones previstas definidas"] }] },
  { id: "estado", nombre: "Estado de situación de obra", sub: "Informe de avance", modo: "estado", rubros: true, textos: [{ k: "avance", l: "Estado actual de avance" }, { k: "proxima", l: "Próxima tarea / requisitos previos" }, { k: "documentacion", l: "Documentación a gestionar (para no quedar parados)" }, { k: "cronograma", l: "Cronograma interno (notas)" }] },
  { id: "nota", nombre: "Nota de pedido de información", sub: "Solicitud a la Dirección de Obra", modo: "nota", lineas: true, textos: [{ k: "intro", l: "Texto de presentación" }, { k: "nota", l: "Nota / aclaración" }] },
];

function FormulariosView({ db, cfg, onBack }) {
  const { obras, formularios, setFormularios, setPedidos } = db;
  const cli = cfg?.clienteNombre || "Belfast Construction Management";
  const [pick, setPick] = useState(false);
  const [obraPick, setObraPick] = useState(obras[0]?.id || "");
  const [ed, setEd] = useState(null);
  const list = formularios || [];
  const tplOf = id => FORM_TPLS.find(t => t.id === id);
  const RG = ({ value, onChange, opts }) => <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>{opts.map(o => <button key={o} onClick={() => onChange(value === o ? "" : o)} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${value === o ? T.accent : T.border}`, background: value === o ? T.accent : T.card, color: value === o ? "#fff" : T.sub, fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>{o}</button>)}</div>;

  function nuevo(tpl) { setEd({ id: uid(), tplId: tpl.id, obra_id: obraPick, fecha: hoyStr(), nro: "", resp: {}, obs: {}, textos: {}, interferencias: [], rubros: [], lineas: [{ info: "", resp: "" }], resultado: "" }); setPick(false); }
  function guardar(compartir) { const item = compartir ? { ...ed, compartido: true, compartidoFecha: hoyStr(), ts: Date.now() } : { ...ed, ts: ed.ts || Date.now() }; const exists = list.some(x => x.id === item.id); setFormularios(exists ? list.map(x => x.id === item.id ? item : x) : [item, ...list]); setEd(null); if (compartir) { const o = obras.find(x => x.id === item.obra_id); alert(`✓ Formulario compartido con ${cfg?.clienteSigla || "Belfast"}.\n\nLo va a ver en la pestaña "Informes" y dentro de la obra ${o?.nombre ? `"${o.nombre}"` : "seleccionada"}.`); } }
  function crearPedidoDesdeNota() { const o = obras.find(x => x.id === ed.obra_id); const det = (ed.lineas || []).filter(l => l.info?.trim()).map((l, i) => `${i + 1}. ${l.info}`).join("\n"); aplicarPedidos(setPedidos, arr => [nuevoPedido({ de: "vv", para: "cliente", asunto: `Nota de pedido — ${o?.nombre || "obra"}`, detalle: (ed.textos.intro || "") + (det ? "\n\n" + det : ""), prioridad: "media", obra_id: ed.obra_id }), ...arr]); }

  if (ed) {
    const tpl = tplOf(ed.tplId); const opts = tpl.modo === "conforme" ? ["Conf.", "No", "N/A"] : ["Sí", "No", "N/A"];
    const set = patch => setEd({ ...ed, ...patch });
    const setLinea = (i, k, v) => set({ lineas: ed.lineas.map((x, j) => j === i ? { ...x, [k]: v } : x) });
    const setRubro = (i, k, v) => set({ rubros: ed.rubros.map((x, j) => j === i ? { ...x, [k]: v } : x) });
    const setIntf = (i, k, v) => set({ interferencias: ed.interferencias.map((x, j) => j === i ? { ...x, [k]: v } : x) });
    return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
      <SubHead id="formularios" label={tpl.nombre} sub={tpl.sub} onBack={() => setEd(null)} />
      <div style={{ padding: "16px 20px" }}>
        <Card style={{ padding: 14, marginBottom: 14 }}>
          <FieldRow><Field label="Obra"><Sel value={ed.obra_id} onChange={e => set({ obra_id: e.target.value })}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field><Field label="Fecha"><TInput value={ed.fecha} onChange={e => set({ fecha: e.target.value })} /></Field></FieldRow>
          <Field label="N° de documento"><TInput value={ed.nro} onChange={e => set({ nro: e.target.value })} placeholder="0001" /></Field>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Comitente: {cli} · Contratista: V+V Construcciones{tpl.id === "iav" ? " · Auditor: Arq. Héctor Ayala" : ""}</div>
        </Card>
        {tpl.textos?.filter(tx => tpl.modo !== "iav").map(tx => <Field key={tx.k} label={tx.l}><textarea value={ed.textos[tx.k] || ""} onChange={e => set({ textos: { ...ed.textos, [tx.k]: e.target.value } })} rows={3} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 13.5, color: T.text }} /></Field>)}
        {tpl.secciones?.map((sec, si) => <Card key={si} style={{ padding: 13, marginBottom: 11 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, marginBottom: 8 }}>{sec.t}</div>
          {sec.items.map((it, ii) => <div key={ii} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${T.bg}` }}><span style={{ fontSize: 12, color: T.text, flex: 1 }}>{it}</span><RG value={ed.resp[`${si}:${ii}`]} onChange={v => set({ resp: { ...ed.resp, [`${si}:${ii}`]: v } })} opts={opts} /></div>)}
          {tpl.obs && <textarea value={ed.obs[si] || ""} onChange={e => set({ obs: { ...ed.obs, [si]: e.target.value } })} placeholder="Observaciones de la sección…" rows={2} style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px 11px", fontSize: 12.5, color: T.text, marginTop: 8 }} />}
        </Card>)}
        {tpl.rubros && <Card style={{ padding: 13, marginBottom: 11 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, marginBottom: 8 }}>Rubros · estado · observaciones</div>
          {ed.rubros.map((r, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 7 }}><TInput value={r.rubro} onChange={e => setRubro(i, "rubro", e.target.value)} placeholder="Rubro" /><TInput value={r.estado} onChange={e => setRubro(i, "estado", e.target.value)} placeholder="Estado" /><button onClick={() => set({ rubros: ed.rubros.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}>✕</button></div>)}
          <button onClick={() => set({ rubros: [...ed.rubros, { rubro: "", estado: "", obs: "" }] })} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ Rubro</button>
        </Card>}
        {tpl.lineas && <Card style={{ padding: 13, marginBottom: 11 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, marginBottom: 8 }}>Información solicitada</div>
          {ed.lineas.map((l, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 7, alignItems: "flex-start" }}><span style={{ fontSize: 12, color: T.muted, marginTop: 10 }}>{i + 1}.</span><textarea value={l.info} onChange={e => setLinea(i, "info", e.target.value)} placeholder="Ítem solicitado" rows={2} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "8px 10px", fontSize: 12.5, color: T.text }} /><button onClick={() => set({ lineas: ed.lineas.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", marginTop: 8 }}>✕</button></div>)}
          <div style={{ display: "flex", gap: 8 }}><button onClick={() => set({ lineas: [...ed.lineas, { info: "", resp: "" }] })} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ Ítem</button><button onClick={crearPedidoDesdeNota} style={{ background: T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Crear pedido en la app →</button></div>
        </Card>}
        {tpl.interferencias && <Card style={{ padding: 13, marginBottom: 11 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, marginBottom: 8 }}>Interferencias y riesgos detectados</div>
          {ed.interferencias.map((r, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 7 }}><TInput value={r.d} onChange={e => setIntf(i, "d", e.target.value)} placeholder="Interferencia" /><TInput value={r.i} onChange={e => setIntf(i, "i", e.target.value)} placeholder="Impacto" /><button onClick={() => set({ interferencias: ed.interferencias.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}>✕</button></div>)}
          <button onClick={() => set({ interferencias: [...ed.interferencias, { d: "", i: "" }] })} style={{ background: T.al, color: T.accent, border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ Interferencia</button>
        </Card>}
        {tpl.modo === "iav" && tpl.textos?.map(tx => <Field key={tx.k} label={tx.l}><textarea value={ed.textos[tx.k] || ""} onChange={e => set({ textos: { ...ed.textos, [tx.k]: e.target.value } })} rows={3} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 13.5, color: T.text }} /></Field>)}
        {tpl.resultado && <Card style={{ padding: 13, marginBottom: 11 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, marginBottom: 8 }}>Resultado / Evaluación</div>
          {tpl.resultado.map(r => <button key={r} onClick={() => set({ resultado: r })} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: 6, borderRadius: 8, border: `1px solid ${ed.resultado === r ? T.accent : T.border}`, background: ed.resultado === r ? T.al : T.card, color: ed.resultado === r ? T.accent : T.text, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{ed.resultado === r ? "● " : "○ "}{r}</button>)}
        </Card>}
        <Card style={{ padding: 13, marginBottom: 11 }}><Adjuntos items={ed.adjuntos} onChange={next => set({ adjuntos: next })} /></Card>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => guardar(false)} style={{ flex: 1, background: T.card, color: T.sub, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>Guardar borrador</button>
          <PBtn onClick={() => guardar(true)} style={{ flex: 1.4 }}>Guardar y compartir con {cfg?.clienteSigla || "Belfast"}</PBtn>
        </div>
        <div style={{ fontSize: 10.5, color: T.muted, textAlign: "center", marginTop: 8 }}>Al compartir, el formulario le aparece a Belfast dentro de la obra.</div>
      </div>
    </div>);
  }

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="formularios" label="Formularios" sub="Plantillas digitales en uso continuo" onBack={onBack} />
    <div style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 14 }}>Completá y guardá las planillas por obra; quedan en la app para reusarlas siempre. Plantillas: Certificado de Inicio de Etapa, Informe de Auditoría, Estado de situación y Nota de pedido.</div>
      {list.length === 0 && <EmptyMsg>Sin formularios cargados. Tocá ＋ para empezar uno.</EmptyMsg>}
      {list.map(f => { const tpl = tplOf(f.tplId); return (<Card key={f.id} style={{ padding: 13, marginBottom: 9 }}>
        <div onClick={() => setEd({ ...f, obs: f.obs || {}, textos: f.textos || {}, resp: f.resp || {}, interferencias: f.interferencias || [], rubros: f.rubros || [], lineas: f.lineas || [{ info: "", resp: "" }] })} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{tpl?.nombre || "Formulario"}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{obraNom(obras, f.obra_id)} · {f.fecha}{f.nro ? ` · N° ${f.nro}` : ""}</div><div style={{ fontSize: 10.5, fontWeight: 700, color: f.compartido ? "#16A34A" : T.muted, marginTop: 3 }}>{f.compartido ? `✓ Compartido con ${cfg?.clienteSigla || "Belfast"}` : "Borrador (no compartido)"}</div></div>
          {f.resultado ? <Badge color={f.resultado.includes("NO APTO") ? "#EF4444" : f.resultado.includes("OBSERV") ? "#F59E0B" : "#16A34A"} bg={f.resultado.includes("NO APTO") ? "#FEF2F2" : f.resultado.includes("OBSERV") ? "#FFFBEB" : "#ECFDF5"}>{f.resultado.replace(" PARA INICIO", "")}</Badge> : <span style={{ color: T.muted, fontSize: 16 }}>›</span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar este formulario (${tpl?.nombre || "Formulario"} · ${obraNom(obras, f.obra_id)})?${f.compartido ? "\n\nOJO: está compartido — también se borra en Belfast." : ""}`)) setFormularios(list.filter(x => x.id !== f.id)); }} style={{ marginTop: 10, background: "#FEF2F2", border: "1px solid #FECACA", color: "#EF4444", borderRadius: T.rsm, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar formulario</button>
      </Card>); })}
    </div>
    <AddFab onClick={() => setPick(true)} label="Formulario" />
    {pick && <Sheet title="Nuevo formulario" onClose={() => setPick(false)}>
      <Field label="Obra"><Sel value={obraPick} onChange={e => setObraPick(e.target.value)}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", margin: "6px 0 8px" }}>Plantilla</div>
      {FORM_TPLS.map(tpl => <button key={tpl.id} onClick={() => nuevo(tpl)} style={{ display: "block", width: "100%", textAlign: "left", background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}><div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{tpl.nombre}</div><div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{tpl.sub}</div></button>)}
    </Sheet>}
  </div>);
}

// ── PLAN DE GESTIÓN OPERATIVO ────────────────────────────────────────
function diasHabiles(d1, d2) { if (!d1 || !d2) return 0; const a = new Date(d1); a.setHours(0, 0, 0, 0); const b = new Date(d2); b.setHours(0, 0, 0, 0); if (b <= a) return 0; let n = 0; const cur = new Date(a); while (cur < b) { cur.setDate(cur.getDate() + 1); const wd = cur.getDay(); if (wd !== 0 && wd !== 6) n++; } return n; }
function gMetricas(fechaSolic, fechaReal, plazo, cerrado) { const fin = fechaReal || new Date(); const dias = diasHabiles(fechaSolic, fin); const desvio = dias - plazo; let estado; if (fechaReal || cerrado) estado = desvio <= 0 ? "Cumplido" : "Fuera de plazo"; else estado = desvio <= 0 ? "En plazo" : "Vencido"; return { dias, desvio, estado, retraso: Math.max(0, desvio) }; }
const GEST_ESTADOS = { "Cumplido": { c: "#16A34A", b: "#ECFDF5" }, "En plazo": { c: "#3B82F6", b: "#EFF6FF" }, "Fuera de plazo": { c: "#F59E0B", b: "#FFFBEB" }, "Vencido": { c: "#EF4444", b: "#FEF2F2" } };
const fmtD = d => d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "—";
const isoHoy = () => new Date().toISOString().slice(0, 10);

function GestionView({ db, cfg, onBack }) {
  const { pedidos, obras, gestion, setGestion } = db;
  const g = { plazo: 5, dotacion: 7, costoPersona: 60000, oficios: [{ oficio: "Oficial albañil", costo: 60000 }, { oficio: "Ayudante", costo: 45000 }, { oficio: "Oficial especializado", costo: 75000 }], manual: [], reuniones: [], ...(gestion || {}) };
  const [tab, setTab] = useState("registro");
  const [mForm, setMForm] = useState(null);
  const [rForm, setRForm] = useState(null);
  const upd = (patch) => setGestion({ ...g, ...patch });
  const cli = cfg?.clienteNombre || "Belfast";

  const itemsPedidos = (pedidos || []).map(p => { const solic = p.ts ? new Date(p.ts) : null; const resp = (p.hilo || []).find(h => h.de === p.para); const real = resp ? new Date(resp.ts) : null; const m = gMetricas(solic, real, g.plazo, p.estado === "resuelto"); return { id: p.id, auto: true, tipo: "Pedido de información", obra_id: p.obra_id, descripcion: p.asunto, imputable: p.para === "cliente" ? cli : "V+V", fechaSolic: solic, fechaReal: real, plazo: g.plazo, ...m }; });
  const itemsManual = (g.manual || []).map(it => { const solic = it.fechaSolic ? new Date(it.fechaSolic) : null; const real = it.fechaReal ? new Date(it.fechaReal) : null; const m = gMetricas(solic, real, it.plazo || g.plazo, !!real); return { ...it, auto: false, fechaSolic: solic, fechaReal: real, plazo: it.plazo || g.plazo, ...m }; });
  const items = [...itemsPedidos, ...itemsManual].sort((a, b) => (b.fechaSolic || 0) - (a.fechaSolic || 0));
  const perItem = (it) => (it.estado === "Vencido" || it.estado === "Fuera de plazo") ? it.retraso * (it.dotacion || g.dotacion) * g.costoPersona : 0;
  const total = items.length;
  const cumpl = items.filter(i => i.estado === "Cumplido" || i.estado === "En plazo").length;
  const pctCumpl = total ? Math.round(cumpl / total * 100) : 0;
  const diasProm = total ? (items.reduce((a, i) => a + i.dias, 0) / total).toFixed(1) : "—";
  const grp = (n) => items.filter(i => i.imputable === n).reduce((a, i) => a + perItem(i), 0);
  const perjBelfast = grp(cli), perjVV = grp("V+V"), perjEstudio = grp("Estudio"), perjTotal = perjBelfast + perjVV + perjEstudio;
  const cnt = (e) => items.filter(i => i.estado === e).length;
  const perjDia = g.dotacion * g.costoPersona;

  function guardarManual() { if (!mForm.descripcion?.trim()) return; const it = { ...mForm, id: mForm.id || uid() }; const exists = (g.manual || []).some(x => x.id === it.id); upd({ manual: exists ? g.manual.map(x => x.id === it.id ? it : x) : [...(g.manual || []), it] }); setMForm(null); }
  function guardarReunion() { const it = { ...rForm, id: rForm.id || uid() }; const exists = (g.reuniones || []).some(x => x.id === it.id); upd({ reuniones: exists ? g.reuniones.map(x => x.id === it.id ? it : x) : [it, ...(g.reuniones || [])] }); setRForm(null); }

  const TABS = [["registro", "Registro"], ["panel", "Panel"], ["punitorios", "Punitorios"], ["plan", "Plan"], ["reunion", "Reunión"]];

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90, position: "relative" }}>
    <SubHead id="gestion" label="Plan de gestión" sub="Desempeño, desvíos y perjuicio económico" onBack={onBack} />
    <div style={{ padding: "14px 20px 0" }}>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ flexShrink: 0, padding: "8px 13px", borderRadius: 8, border: `1px solid ${tab === k ? T.accent : T.border}`, background: tab === k ? T.al : T.card, color: tab === k ? T.accent : T.sub, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
      </div>
    </div>

    {tab === "registro" && <div style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 12 }}>Los pedidos de la app se miden solos (plazo {g.plazo} días háb.). Sumá manualmente certificados u otros con el botón ＋.</div>
      {items.length === 0 && <EmptyMsg>Sin ítems. Cargá pedidos o agregá un registro manual.</EmptyMsg>}
      {items.map(it => { const e = GEST_ESTADOS[it.estado]; const pj = perItem(it); return (<Card key={it.id} style={{ padding: 13, marginBottom: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{it.descripcion}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{it.tipo} · {obraNom(obras, it.obra_id) || "—"} · imputable a <b style={{ color: T.sub }}>{it.imputable}</b></div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10.5, color: T.muted }}>Solic. {fmtD(it.fechaSolic)} · {it.fechaReal ? `resp. ${fmtD(it.fechaReal)}` : "sin respuesta"} · {it.dias} d háb.</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: it.desvio > 0 ? "#EF4444" : "#16A34A" }}>desvío {it.desvio > 0 ? "+" : ""}{it.desvio}</span>
              {!it.auto && <button onClick={() => setMForm({ ...g.manual.find(x => x.id === it.id) })} style={{ background: "none", border: "none", color: T.accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>editar</button>}
              {!it.auto && <button onClick={() => upd({ manual: g.manual.filter(x => x.id !== it.id) })} style={{ background: "none", border: "none", color: T.muted, fontSize: 11, cursor: "pointer" }}>✕</button>}
            </div>
            {pj > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginTop: 5 }}>Perjuicio: {money(pj)}</div>}
          </div>
          <Badge color={e.c} bg={e.b}>{it.estado}</Badge>
        </div>
      </Card>); })}
      <AddFab onClick={() => setMForm({ tipo: "Certificado", obra_id: obras[0]?.id || "", descripcion: "", imputable: "Estudio", fechaSolic: isoHoy(), plazo: g.plazo, fechaReal: "" })} label="Registro" />
    </div>}

    {tab === "panel" && <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
        <MiniStat label="Ítems" value={total} color={T.accent} />
        <MiniStat label="% Cumplimiento" value={pctCumpl + "%"} color="#16A34A" />
        <MiniStat label="Días háb. prom." value={diasProm} color="#3B82F6" />
        <MiniStat label="Perjuicio total" value={money(perjTotal)} color="#EF4444" />
      </div>
      <Eyebrow>Por estado</Eyebrow>
      <Card style={{ padding: 13, marginBottom: 14 }}>
        {["Cumplido", "En plazo", "Fuera de plazo", "Vencido"].map(s => { const e = GEST_ESTADOS[s]; return (<div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.bg}` }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: e.c }} /><span style={{ fontSize: 12.5, color: T.text }}>{s}</span></div><span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{cnt(s)}</span></div>); })}
      </Card>
      <Eyebrow>Perjuicio imputable</Eyebrow>
      <Card style={{ padding: 13 }}>
        {[[cli, perjBelfast], ["Estudio", perjEstudio], ["V+V (interno)", perjVV]].map(([n, v]) => (<div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.bg}` }}><span style={{ fontSize: 12.5, color: T.text }}>{n}</span><span style={{ fontSize: 13, fontWeight: 800, color: v > 0 ? "#EF4444" : T.muted }}>{money(v)}</span></div>))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 9 }}><span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>TOTAL</span><span style={{ fontSize: 14, fontWeight: 800, color: "#EF4444" }}>{money(perjTotal)}</span></div>
      </Card>
    </div>}

    {tab === "punitorios" && <div style={{ padding: "16px 20px" }}>
      <Card style={{ padding: 15, marginBottom: 14 }}>
        <Eyebrow>Parámetros (editables)</Eyebrow>
        <FieldRow>
          <Field label="Plazo (días háb.)"><TInput type="number" value={g.plazo} onChange={e => upd({ plazo: +e.target.value || 0 })} /></Field>
          <Field label="Dotación parada"><TInput type="number" value={g.dotacion} onChange={e => upd({ dotacion: +e.target.value || 0 })} /></Field>
        </FieldRow>
        <Field label="Costo diario por persona ($)"><TInput type="number" value={g.costoPersona} onChange={e => upd({ costoPersona: +e.target.value || 0 })} /></Field>
        <div style={{ background: T.al, borderRadius: T.rsm, padding: "11px 13px", marginTop: 6 }}><div style={{ fontSize: 11.5, color: T.sub }}>Perjuicio por día de retraso</div><div style={{ fontSize: 18, fontWeight: 800, color: "#EF4444" }}>{money(perjDia)}</div><div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{g.dotacion} pers. × {money(g.costoPersona)}</div></div>
      </Card>
      <Eyebrow>Costo diario por oficio</Eyebrow>
      <Card style={{ padding: 13, marginBottom: 14 }}>
        {(g.oficios || []).map((o, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0" }}><span style={{ fontSize: 12.5, color: T.text }}>{o.oficio}</span><input type="number" value={o.costo} onChange={e => upd({ oficios: g.oficios.map((x, j) => j === i ? { ...x, costo: +e.target.value || 0 } : x) })} style={{ width: 110, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "6px 9px", fontSize: 12.5, color: T.text, textAlign: "right" }} /></div>))}
      </Card>
      <Eyebrow>Simulador acumulado</Eyebrow>
      <Card style={{ padding: 13 }}>
        {[1, 2, 3, 4, 5, 7, 10, 15].map(d => (<div key={d} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.bg}` }}><span style={{ fontSize: 12.5, color: T.sub }}>{d} día{d > 1 ? "s" : ""} de retraso</span><span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{money(d * perjDia)}</span></div>))}
      </Card>
    </div>}

    {tab === "plan" && <div style={{ padding: "16px 20px" }}>
      {[["1. Objetivo", ["Medir tiempos de definición y certificación, detectar desvíos y valorizar el perjuicio económico de los retrasos para tomar decisiones y reclamar lo que corresponda."]],
      ["2. Estándares (SLA)", [`Pedidos de información (${cli}/Estudio): respuesta en máx. ${g.plazo} días hábiles desde la solicitud.`, `Certificados de obra (Héctor Ayala): entrega en máx. ${g.plazo} días hábiles desde la visita.`, "Toda solicitud y certificado se carga el mismo día en el Registro."]],
      ["3. Qué mejorar", ["Anticipación: pedir definiciones y materiales durante la tarea previa, no al terminarla.", "Seguimiento: revisar el Panel semanalmente y escalar los vencidos.", "Trazabilidad: fechar solicitud, respuesta y entrega sin excepción.", "Responsabilidad: asignar a cada desvío su causa (V+V / " + cli + " / Estudio)."]],
      ["4. Política de punitorios", ["Por cada día de retraso imputable a " + cli + " o al Estudio que detenga una tarea en condiciones de avanzar, se computa un perjuicio = Días de retraso × Dotación parada × Costo diario. Se presenta en la reunión mensual como perjuicio económico medible."]],
      ["5. Responsables", ["V+V: carga del registro, certificaciones en plazo (Héctor Ayala), seguimiento.", cli + " / Estudio: respuesta a pedidos y provisión de definiciones en plazo."]]
      ].map(([titulo, puntos], i) => (<Card key={i} style={{ padding: 15, marginBottom: 11 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.accent, marginBottom: 8 }}>{titulo}</div>
        {puntos.map((p, j) => <div key={j} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6, marginBottom: 5, paddingLeft: 12, position: "relative" }}><span style={{ position: "absolute", left: 0, color: BRASS }}>·</span>{p}</div>)}
      </Card>))}
    </div>}

    {tab === "reunion" && <div style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 12 }}>Reunión empresa a empresa: V+V ({cfg?.firmante || "Sebastián De la Fuente"}) — {cli} (Enrico, CEO).</div>
      {(g.reuniones || []).length === 0 && <EmptyMsg>Sin reuniones registradas.</EmptyMsg>}
      {(g.reuniones || []).map(r => (<Card key={r.id} style={{ padding: 14, marginBottom: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{r.periodo || "Reunión"}{r.fecha ? ` · ${r.fecha}` : ""}</div>
          <div style={{ display: "flex", gap: 8 }}><button onClick={() => setRForm({ ...r })} style={{ background: "none", border: "none", color: T.accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>editar</button><button onClick={() => upd({ reuniones: g.reuniones.filter(x => x.id !== r.id) })} style={{ background: "none", border: "none", color: T.muted, fontSize: 11.5, cursor: "pointer" }}>✕</button></div>
        </div>
        {r.flojo && <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}><b>Flojo:</b> {r.flojo}</div>}
        {r.mejorar && <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}><b>A mejorar:</b> {r.mejorar}</div>}
        {r.acciones && <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}><b>Acciones:</b> {r.acciones}</div>}
      </Card>))}
      <AddFab onClick={() => setRForm({ periodo: "", fecha: hoyStr(), participantes: "", flojo: "", mejorar: "", acciones: "" })} label="Reunión" />
    </div>}

    {mForm && <Sheet title={mForm.id ? "Editar registro" : "Nuevo registro"} onClose={() => setMForm(null)}>
      <FieldRow>
        <Field label="Tipo"><Sel value={mForm.tipo} onChange={e => setMForm({ ...mForm, tipo: e.target.value })}><option>Certificado</option><option>Pedido de información</option><option>Visita técnica</option><option>Otro</option></Sel></Field>
        <Field label="Obra"><Sel value={mForm.obra_id} onChange={e => setMForm({ ...mForm, obra_id: e.target.value })}>{obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}</Sel></Field>
      </FieldRow>
      <Field label="Descripción"><TInput value={mForm.descripcion} onChange={e => setMForm({ ...mForm, descripcion: e.target.value })} placeholder="Ej: Certificado estado de situación" /></Field>
      <FieldRow>
        <Field label="Imputable a"><Sel value={mForm.imputable} onChange={e => setMForm({ ...mForm, imputable: e.target.value })}><option value={cli}>{cli}</option><option value="Estudio">Estudio</option><option value="V+V">V+V</option></Sel></Field>
        <Field label="Plazo (días háb.)"><TInput type="number" value={mForm.plazo} onChange={e => setMForm({ ...mForm, plazo: +e.target.value || 0 })} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Fecha solic./visita"><TInput type="date" value={mForm.fechaSolic} onChange={e => setMForm({ ...mForm, fechaSolic: e.target.value })} /></Field>
        <Field label="Fecha real (si entregó)"><TInput type="date" value={mForm.fechaReal} onChange={e => setMForm({ ...mForm, fechaReal: e.target.value })} /></Field>
      </FieldRow>
      <PBtn full onClick={guardarManual} style={{ marginTop: 6 }}>Guardar</PBtn>
    </Sheet>}

    {rForm && <Sheet title={rForm.id ? "Editar reunión" : "Nueva reunión"} onClose={() => setRForm(null)}>
      <FieldRow>
        <Field label="Período / Mes"><TInput value={rForm.periodo} onChange={e => setRForm({ ...rForm, periodo: e.target.value })} placeholder="Junio 2026" /></Field>
        <Field label="Fecha"><TInput value={rForm.fecha} onChange={e => setRForm({ ...rForm, fecha: e.target.value })} /></Field>
      </FieldRow>
      <Field label="Participantes"><TInput value={rForm.participantes} onChange={e => setRForm({ ...rForm, participantes: e.target.value })} /></Field>
      <Field label="Lo que estuvo flojo"><textarea value={rForm.flojo} onChange={e => setRForm({ ...rForm, flojo: e.target.value })} rows={3} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} /></Field>
      <Field label="A mejorar"><textarea value={rForm.mejorar} onChange={e => setRForm({ ...rForm, mejorar: e.target.value })} rows={3} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} /></Field>
      <Field label="Acciones acordadas"><textarea value={rForm.acciones} onChange={e => setRForm({ ...rForm, acciones: e.target.value })} rows={3} style={{ width: "100%", background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 14px", fontSize: 14, color: T.text }} /></Field>
      <PBtn full onClick={guardarReunion} style={{ marginTop: 6 }}>Guardar</PBtn>
    </Sheet>}
  </div>);
}

// ── MENSAJES CON EL CLIENTE (lado V+V) ───────────────────────────────
function MensajesVVView({ db, cfg, onBack }) {
  const { mensajes, setMensajes, clienteArchivos } = db;
  const cn = cfg?.clienteNombre || "Cliente";
  const [input, setInput] = useState("");
  const [adj, setAdj] = useState([]);
  const fileRef = useRef(null), bottomRef = useRef(null);
  const lastRef = useRef(mensajes.length);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);
  // Poll: traer mensajes nuevos del cliente mientras esté abierto
  useEffect(() => {
    const iv = setInterval(async () => {
      const r = await storage.get("vv_mensajes");
      if (r?.value) { try { const arr = JSON.parse(r.value); if (arr.length !== lastRef.current) { lastRef.current = arr.length; setMensajes(arr); } } catch { } }
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  async function addAdj(e) { const files = Array.from(e.target.files); if (!files.length) return; const nuevos = []; for (const f of files) { const data = await toDataUrl(f); const url = await uploadFoto(data, "msg", f.name.replace(/\W+/g, "_")); nuevos.push({ nombre: f.name, url }); } setAdj(p => [...p, ...nuevos]); e.target.value = ""; }
  async function enviar() {
    const t = input.trim(); if (!t && adj.length === 0) return;
    const msg = { id: uid() + Date.now(), from: "vv", texto: t, fecha: hoyStr(), ts: Date.now(), archivos: adj };
    const r = await storage.get("vv_mensajes"); let actual = mensajes;
    if (r?.value) { try { actual = JSON.parse(r.value); } catch { } }
    const next = [...actual, msg]; lastRef.current = next.length; setMensajes(next); setInput(""); setAdj([]);
  }
  async function borrarMsg(id) {
    if (!id || !confirm("¿Eliminar este mensaje? Se borra para las dos empresas.")) return;
    const r = await storage.get("vv_mensajes"); let actual = mensajes;
    if (r?.value) { try { actual = JSON.parse(r.value); } catch { } }
    const next = actual.filter(m => m.id !== id); lastRef.current = next.length; setMensajes(next);
  }
  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <SubHead id="mensajes" label="Mensajes" sub={`Chat con ${cn}`} onBack={onBack} />
    {clienteArchivos.length > 0 && <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "9px 16px", display: "flex", gap: 7, overflowX: "auto" }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", flexShrink: 0, alignSelf: "center" }}>Del cliente:</span>
      {clienteArchivos.slice(0, 8).map(a => <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{ flexShrink: 0, background: T.al, color: T.accent, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>📎 {a.nombre}</a>)}
    </div>}
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
      {mensajes.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 12.5, padding: "40px 18px", lineHeight: 1.6 }}>Sin mensajes todavía. Escribile a {cn} desde acá; lo ve en su app de cliente al instante.</div>}
      {mensajes.map((m, i) => { const mine = m.from === "vv"; return (<div key={m.id || i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 11 }}>
        <div style={{ maxWidth: "82%" }}>
          <div style={{ background: mine ? T.navy : T.card, color: mine ? "#fff" : T.text, border: mine ? "none" : `1px solid ${T.border}`, borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 13px", fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", boxShadow: T.shadow }}>
            {m.texto}{(m.archivos || []).map((a, j) => <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 12, fontWeight: 700, color: mine ? "#fff" : T.accent, textDecoration: "underline" }}>📎 {a.nombre}</a>)}
          </div>
          <div style={{ fontSize: 9.5, color: T.muted, marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "V+V" : cn} · {m.fecha}{mine && m.id && <span onClick={() => borrarMsg(m.id)} style={{ marginLeft: 8, color: "#EF4444", cursor: "pointer", fontWeight: 700 }}>Eliminar</span>}</div>
        </div>
      </div>); })}
      <div ref={bottomRef} />
    </div>
    <div style={{ borderTop: `1px solid ${T.border}`, background: T.card, padding: "10px 14px 14px" }}>
      {adj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{adj.map((a, i) => <span key={i} style={{ background: T.bg, borderRadius: 6, padding: "5px 9px", fontSize: 11, color: T.sub }}>📎 {a.nombre} <span onClick={() => setAdj(p => p.filter((_, j) => j !== i))} style={{ cursor: "pointer", color: T.muted }}>✕</span></span>)}</div>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <input ref={fileRef} type="file" multiple onChange={addAdj} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} style={{ width: 42, height: 42, borderRadius: T.rsm, background: T.bg, color: T.sub, border: `1px solid ${T.border}`, fontSize: 17, flexShrink: 0 }}>＋</button>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder={`Responder a ${cn}…`} rows={1} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "11px 13px", fontSize: 13.5, color: T.text, maxHeight: 110, minHeight: 42 }} />
        <button onClick={enviar} style={{ width: 42, height: 42, borderRadius: T.rsm, background: T.accent, color: "#fff", border: "none", fontSize: 17, flexShrink: 0 }}>↑</button>
      </div>
    </div>
  </div>);
}

// ── PANEL DE CLIENTE (Belfast) ───────────────────────────────────────
function ClientePanel({ db, cfg, onBack }) {
  const { obras, tareas } = db;
  const cs = cfg?.clienteSigla || "BELFAST";
  const cn = cfg?.clienteNombre || "Belfast Construction Management";
  const [open, setOpen] = useState(null);
  const estId = (e) => OBRA_ESTADOS.find(x => x.id === e) || OBRA_ESTADOS[0];
  const contratado = obras.reduce((a, o) => a + parseMontoNum(o.monto), 0);
  const certificado = obras.reduce((a, o) => a + (o.pagado || 0), 0);
  const saldo = contratado - certificado;
  const activas = obras.filter(o => o.estado === "curso").length;
  const avg = obras.length ? Math.round(obras.reduce((a, o) => a + (o.avance || 0), 0) / obras.length) : 0;

  return (<div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
    {/* Membrete Belfast */}
    <div style={{ background: "#101C2C", color: "#fff", padding: "16px 20px 15px", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 6, width: 32, height: 32, fontSize: 15, color: "#fff", cursor: "pointer", flexShrink: 0 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: BRASS, letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: 3 }}>Panel de Cliente</div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "0.06em" }}>{cs}</div>
          <div style={{ fontSize: 11, opacity: .65, marginTop: 2 }}>{cn}</div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)", marginTop: 8 }}>Ejecuta: V+V Construcciones · Actualizado {hoyStr()}</div>
    </div>
    <div style={{ height: 2, background: BRASS }} />

    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginBottom: 10 }}>
        <MiniStat label="Obras activas" value={activas} color="#16A34A" />
        <MiniStat label="Avance prom." value={avg + "%"} color={T.accent} />
        <MiniStat label="Obras" value={obras.length} />
      </div>
      <div style={{ background: "#101C2C", borderRadius: T.rsm, padding: "15px 17px", marginBottom: 20, borderBottom: `2px solid ${BRASS}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Resumen económico</div>
        {[["Contratado", contratado, "#fff"], ["Certificado", certificado, "#16A34A"], ["Saldo", saldo, BRASS]].map(([l, v, c], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: i ? "1px solid rgba(255,255,255,.08)" : "none" }}>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.75)" }}>{l}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: c }}>{money(v)}</span>
          </div>))}
      </div>

      <Eyebrow>Estado de obras</Eyebrow>
      {obras.map(o => {
        const e = estId(o.estado);
        const contr = parseMontoNum(o.monto), cert = o.pagado || 0;
        const pctCobro = contr ? Math.round((cert / contr) * 100) : 0;
        const ts = tareas.filter(t => t.obra_id === o.id);
        const ultInf = (o.informes || [])[o.informes?.length - 1];
        const isOpen = open === o.id;
        return (<Card key={o.id} style={{ padding: 15, marginBottom: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>{o.nombre}</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{o.sector} · {o.inicio} → {o.cierre}</div>
            </div>
            <Badge color={e.color} bg={e.bg}>{e.label}</Badge>
          </div>
          <div style={{ margin: "12px 0 6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}><span style={{ color: T.sub, fontWeight: 600 }}>Avance de obra</span><span style={{ color: T.accent, fontWeight: 800 }}>{o.avance}%</span></div>
            <div style={{ height: 8, background: T.bg, borderRadius: 5, overflow: "hidden" }}><div style={{ height: 8, width: `${o.avance}%`, background: T.accent, borderRadius: 5, transition: "width .5s" }} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, background: T.bg, borderRadius: T.rsm, padding: "9px 11px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Certificado</div><div style={{ fontSize: 12.5, fontWeight: 800, color: "#16A34A", marginTop: 2 }}>{pctCobro}%</div></div>
            <div style={{ flex: 2, background: T.bg, borderRadius: T.rsm, padding: "9px 11px" }}><div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Saldo pendiente</div><div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginTop: 2 }}>{money(contr - cert)}</div></div>
          </div>
          {(ts.length > 0 || ultInf || (o.fotos || []).length > 0) && <button onClick={() => setOpen(isOpen ? null : o.id)} style={{ width: "100%", marginTop: 12, background: "none", border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "9px", fontSize: 12, fontWeight: 700, color: T.accent, cursor: "pointer" }}>{isOpen ? "Ocultar detalle ▲" : "Ver detalle ▼"}</button>}
          {isOpen && <div style={{ marginTop: 12 }}>
            {(o.fotos || []).length > 0 && <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>Avance fotográfico</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>{o.fotos.slice(0, 6).map((f, i) => <div key={i} style={{ position: "relative" }}><img src={f.url || f} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, border: `1px solid ${T.border}`, display: "block" }} />{i === 5 && o.fotos.length > 6 && <div style={{ position: "absolute", inset: 0, background: "rgba(15,27,45,.62)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 800 }}>+{o.fotos.length - 6}</div>}</div>)}</div>
            </div>}
            {ts.length > 0 && <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>Cronograma</div>
              {ts.map(t => (<div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 12, color: T.text }}>{t.nombre}</span>
                <div style={{ width: 70, height: 6, background: T.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: 6, width: `${t.avance || 0}%`, background: BRASS, borderRadius: 4 }} /></div>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, width: 32, textAlign: "right" }}>{t.avance || 0}%</span>
              </div>))}
            </div>}
            {ultInf && <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>Último informe · {ultInf.fecha}</div>
              <div style={{ background: T.bg, borderRadius: T.rsm, padding: "11px 13px", fontSize: 12, color: T.text, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>{ultInf.texto}</div>
            </div>}
          </div>}
        </Card>);
      })}
      <div style={{ textAlign: "center", fontSize: 10.5, color: T.muted, marginTop: 14, lineHeight: 1.5 }}>Documento informativo generado por V+V Construcciones para Belfast Construction Management.</div>
    </div>
  </div>);
}

// ── SHELL WEB INSTITUCIONAL (V+V) ────────────────────────────────────
const LUXE_BG = "radial-gradient(rgba(255,255,255,0.022) 1px, transparent 1px) 0 0/22px 22px, radial-gradient(1100px 520px at 50% -8%, rgba(176,137,79,0.13), transparent 62%), linear-gradient(180deg,#0b141f 0%,#0a1019 100%)";
const LUXE_HERO = "radial-gradient(620px 220px at 86% 0%, rgba(176,137,79,0.20), transparent 60%), linear-gradient(135deg,#101C2C 0%,#17283c 100%)";
function AvanceView({ obras, avance, setAvance, apiKey }) {
  const [obraId, setObraId] = React.useState(obras[0]?.id || "");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const fileRef = React.useRef(null);
  const obra = obras.find(o => o.id === obraId);
  const historial = ((avance || {})[obraId] || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  async function onFoto(e) {
    const f = e.target.files?.[0]; if (!f) return; e.target.value = "";
    if (!obraId) { alert("Elegí una obra primero."); return; }
    setBusy(true); setStatus("Subiendo y analizando la foto… (unos segundos)");
    try {
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      const comp = await compressImage(dataUrl, 1600, 0.7);
      const b64 = String(comp).split(",")[1];
      const mediaType = (String(comp).match(/data:(.*?);/) || [])[1] || "image/jpeg";
      const url = await uploadFoto(comp, "avance", uid() + ".jpg");
      const prev = historial[0];
      const fechaHoy = hoyStr();
      const sys = "Sos un inspector de obra civil en Argentina. Analizás fotos de avance de obra con criterio técnico. Sos honesto: el porcentaje es una ESTIMACIÓN visual, no una medición exacta. Escribí claro y breve, en español rioplatense (vos).";
      const instruc = prev
        ? `Foto de la obra "${obra?.nombre || ""}" de hoy (${fechaHoy}).\n\nESTADO ANTERIOR (${prev.fecha}):\n${prev.descripcion}\n\nHacé DOS cosas:\n1) ESTADO ACTUAL: describí en 3-5 renglones qué se ve hoy (estructura, mampostería, revoques, contrapisos, instalaciones, aberturas, terminaciones — lo que aplique).\n2) AVANCE: compará con el estado anterior. Qué se avanzó, qué falta, un % ESTIMADO de avance de la obra, y ALERTAS si no ves progreso esperable o algo raro.\nFormato EXACTO:\nESTADO ACTUAL: ...\nAVANCE: ...`
        : `Foto de la obra "${obra?.nombre || ""}" de hoy (${fechaHoy}). Es la PRIMERA foto (línea de base). Describí el ESTADO ACTUAL en 3-5 renglones (estructura, mampostería, revoques, instalaciones, aberturas, terminaciones — lo que aplique) y estimá un % de avance general.\nFormato EXACTO:\nESTADO ACTUAL: ...`;
      const content = [{ type: "image", source: { type: "base64", media_type: mediaType, data: b64 } }, { type: "text", text: instruc }];
      const resp = await callAI([{ role: "user", content }], sys, apiKey, false);
      let descripcion = resp, avanceTxt = "";
      const mA = resp.match(/AVANCE:\s*([\s\S]*)$/i);
      const mE = resp.match(/ESTADO ACTUAL:\s*([\s\S]*?)(?:AVANCE:|$)/i);
      if (mE) descripcion = mE[1].trim();
      if (mA) avanceTxt = mA[1].trim();
      const item = { id: uid() + Date.now(), fecha: fechaHoy, ts: Date.now(), descripcion, avance: avanceTxt, fotoUrl: url || comp };
      setAvance(prevAv => ({ ...(prevAv || {}), [obraId]: [item, ...((prevAv || {})[obraId] || [])] }));
      setStatus("");
    } catch (err) { setStatus("Hubo un error al analizar la foto. Fijate que tengas crédito de API y probá de nuevo."); }
    setBusy(false);
  }
  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
    <div style={{ flexShrink: 0 }}><PageHead eyebrow="Seguimiento visual" title="Avance de obra" sub="Subí una foto y la IA compara el avance con la anterior" /></div>
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 28px", minHeight: 0 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase" }}>Obra</label>
      <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: T.rsm, padding: "12px", fontSize: 15, color: T.text, margin: "6px 0 14px" }}>
        {obras.length === 0 && <option value="">No hay obras</option>}
        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFoto} style={{ display: "none" }} />
      <button onClick={() => fileRef.current?.click()} disabled={busy || !obraId} style={{ width: "100%", background: busy ? T.border : T.navy, color: "#fff", border: `1px solid ${BRASS}`, borderRadius: T.rsm, padding: "14px", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", marginBottom: 8 }}>{busy ? "Analizando…" : "📷 Tomar / subir foto de hoy"}</button>
      {status && <div style={{ fontSize: 12.5, color: T.sub, textAlign: "center", padding: "6px 0 12px" }}>{status}</div>}
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, marginBottom: 16 }}>Consejo: sacá la foto siempre desde el mismo lugar y ángulo para que la comparación sea más precisa. El % es una estimación visual, no una medición exacta.</div>
      {historial.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "20px", lineHeight: 1.6 }}>Todavía no hay fotos de avance para esta obra.<br />Subí la primera (será la línea de base).</div>}
      {historial.map((h, idx) => (<div key={h.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        {h.fotoUrl && <img src={h.fotoUrl} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />}
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{h.fecha}{idx === 0 ? "  ·  última" : ""}</div>
            {idx === historial.length - 1 && <span style={{ fontSize: 10, fontWeight: 700, color: T.muted, background: T.al, borderRadius: 6, padding: "2px 7px" }}>línea de base</span>}
          </div>
          {h.avance && <div style={{ background: T.al, borderRadius: 8, padding: "9px 11px", marginBottom: 8 }}><div style={{ fontSize: 10, fontWeight: 800, color: T.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>📈 Avance</div><div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{h.avance}</div></div>}
          <div style={{ fontSize: 10, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Estado</div>
          <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{h.descripcion}</div>
        </div>
      </div>))}
    </div>
  </div>);
}
const WEB_NAV = [
  { id:"chat", label:"Asistente IA" }, { id:"dashboard", label:"Inicio" },
  { id:"obras", label:"Obras" }, { id:"avance", label:"Avance" }, { id:"mensajes", label:"Mensajes" },
  { id:"informes", label:"Informes" }, { id:"formularios", label:"Formularios" },
  { id:"mas", label:"Más" },
];
function WebHeader({ cfg, view, go, pendientes, badges = {} }) {
  const l1 = cfg?.logoEmpresa2, l2 = cfg?.logoEmpresa; const tieneLogo = l1 || l2;
  const lh = Math.min(Math.max(cfg?.logoSize || 42, 30), 64);
  const cnt = (id) => (badges[id] || 0);
  return (
    <header style={{ position:"sticky", top:0, zIndex:200, flexShrink:0 }}>
      <div style={{ background:T.navy, color:"#fff" }}>
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"6px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.22em", textTransform:"uppercase", color:"rgba(255,255,255,.6)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>Construcción · Obra · Gestión integral</span>
          <span style={{ fontSize:10.5, color:"rgba(255,255,255,.5)", whiteSpace:"nowrap" }}>{cfg?.ciudad || "Buenos Aires, Argentina"}</span>
        </div>
      </div>
      <div style={{ background:T.card, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:1180, margin:"0 auto", padding:"12px 24px 2px", display:"flex", justifyContent:"center" }}>
          <div onClick={()=>go("dashboard")} style={{ display:"flex", alignItems:"center", gap:11, cursor:"pointer" }}>
            {tieneLogo ? <img src={l1 || l2} alt="" style={{ maxHeight:lh, maxWidth:260, objectFit:"contain" }} />
              : <><div style={{ width:44, height:44, background:T.navy, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:15, fontWeight:800, borderBottom:`2px solid ${BRASS}` }}>V+V</div>
                <div style={{ lineHeight:1.2, textAlign:"left" }}><div style={{ fontSize:15, fontWeight:800, color:T.text, letterSpacing:"0.08em", textTransform:"uppercase" }}>V+V Construcciones</div><div style={{ fontSize:8.5, color:T.muted, letterSpacing:"0.18em", textTransform:"uppercase", marginTop:2 }}>Subcontratista de obra</div></div></>}
          </div>
        </div>
        <nav style={{ maxWidth:1180, margin:"0 auto", padding:"4px 12px 0", display:"flex", gap:2, justifyContent:"center", flexWrap:"wrap" }}>
          {WEB_NAV.map(n=>{ const active=view===n.id; return (
            <button key={n.id} onClick={()=>go(n.id)} style={{ position:"relative", background:"none", border:"none", padding:"9px 12px", fontSize:12.5, fontWeight:active?800:600, color:active?T.accent:T.sub, letterSpacing:"0.02em", borderBottom:`2px solid ${active?BRASS:"transparent"}`, whiteSpace:"nowrap", cursor:"pointer" }}>
              {n.label}
              {cnt(n.id) > 0 && <span style={{ position:"absolute", top:3, right:2, background:"#EF4444", color:"#fff", borderRadius:9, minWidth:16, height:16, fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px" }}>{cnt(n.id) > 99 ? "99+" : cnt(n.id)}</span>}
            </button>
          ); })}
        </nav>
      </div>
      <div style={{ height:2, background:BRASS }} />
    </header>
  );
}
function WebHero({ cfg, obras, personal }) {
  const activas = obras.filter(o=>o.estado==="curso").length;
  const avg = obras.length ? Math.round(obras.reduce((a,o)=>a+(o.avance||0),0)/obras.length) : 0;
  return (
    <div style={{ background:LUXE_HERO, color:"#fff", borderBottom:`2px solid ${BRASS}`, flexShrink:0 }}>
      <div style={{ maxWidth:1180, margin:"0 auto", padding:"32px 24px 28px", display:"flex", justifyContent:"space-between", alignItems:"flex-end", gap:24, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:BRASS, letterSpacing:"0.26em", textTransform:"uppercase", marginBottom:9 }}>V+V Construcciones</div>
          <div style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.01em", lineHeight:1.1, maxWidth:560 }}>Gestión integral de obra</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.68)", marginTop:10, maxWidth:520, lineHeight:1.6 }}>Seguimiento de obras, personal, documentación y certificación, en un solo lugar.</div>
        </div>
        <div style={{ display:"flex", gap:28 }}>
          {[["Obras activas",activas],["Avance prom.",avg+"%"],["Personal",personal.length]].map(([l,v],i)=>(
            <div key={i} style={{ textAlign:"center" }}><div style={{ fontSize:26, fontWeight:800 }}>{v}</div><div style={{ fontSize:9.5, color:"rgba(255,255,255,.55)", textTransform:"uppercase", letterSpacing:"0.06em", marginTop:3 }}>{l}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
function WebFooter({ cfg }) {
  return (<div style={{ background:T.navy, color:"rgba(255,255,255,.55)", flexShrink:0, borderTop:`2px solid ${BRASS}` }}>
    <div style={{ maxWidth:1180, margin:"0 auto", padding:"11px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6, fontSize:11 }}>
      <span style={{ fontWeight:700, letterSpacing:"0.08em", color:"rgba(255,255,255,.8)" }}>V+V CONSTRUCCIONES</span>
      <span>© {new Date().getFullYear()} · {cfg?.email || "ia.vvcon@gmail.com"} · Buenos Aires, Argentina · build 01-07-IA</span>
    </div>
  </div>);
}

function App() {
  useEffect(() => { if (FORCE_CLOUD) { try { history.replaceState(null, "", window.location.pathname); } catch { } } }, []);
  const [cfg, setCfg] = useStoredState("vv_cfg", { ...DEFAULT_CONFIG, themeId:"institucional", fontId:"inter", radiusId:"sharp", colors:{...INST_COLORS}, apiKey:"" });
  const [view, setView] = useState("chat");
  const [lics, setLics] = useStoredState("vv_lics", SAMPLE_LICS);
  const [obras, setObras] = useStoredState("vv_obras", SAMPLE_OBRAS);
  const [personal, setPersonal] = useStoredState("vv_personal", SAMPLE_PERSONAL);
  const [materiales, setMateriales] = useStoredState("vv_materiales", []);
  const [subcontratos, setSubcontratos] = useStoredState("vv_subcontratos", []);
  const [contactos, setContactos] = useStoredState("vv_contactos", []);
  const [proveedores, setProveedores] = useStoredState("vv_proveedores", []);
  const [herramientas, setHerramientas] = useStoredState("vv_herramientas", []);
  const [tareas, setTareas] = useStoredState("vv_tareas", []);
  const [presentismo, setPresentismo] = useStoredState("vv_presentismo", []);
  const [archivosGen, setArchivosGen] = useStoredState("vv_archivos", []);
  const [vigilancia, setVigilancia] = useStoredState("vv_vigilancia", []);
  const [camaras, setCamaras] = useStoredState("vv_camaras", []);
  const [avance, setAvance] = useStoredState("vv_avance", {});
  const [gestion, setGestion] = useStoredState("vv_gestion", {});
  const [formularios, setFormularios] = useStoredState("vv_formularios", []);
  const [documentacion, setDocumentacion] = useStoredState("vv_documentacion", []);
  const [matpedidos, setMatpedidos] = useStoredState("vv_matpedidos", []);
  const [mensajes, setMensajes] = useStoredState("vv_mensajes", []);
  const [pedidos, setPedidos] = useStoredState("vv_pedidos", []);
  const [clienteArchivos] = useStoredState("cliente_archivos", []);
  const [chatMsgs, setChatMsgs] = useStoredState("vv_chat", []);
  const [detailObraId, setDetailObraId] = useState(null);
  const [masSub, setMasSub] = useState(null);
  // Recordatorio diario: pedidos/materiales sin responder en el día generan un aviso en Mensajes (para V+V y Belfast). No usa IA/créditos.
  useEffect(() => {
    async function chequear() {
      try {
        const hoy = hoyStr();
        let peds = []; try { const r = await storage.get("vv_pedidos"); if (r?.value) peds = JSON.parse(r.value); } catch { }
        let mats = []; try { const r = await storage.get("vv_matpedidos"); if (r?.value) mats = JSON.parse(r.value); } catch { }
        const dia = 20 * 60 * 60 * 1000;
        const pendPeds = peds.filter(p => p.estado !== "resuelto" && (Date.now() - (p.ts || 0) > dia) && p.recordatorioFecha !== hoy);
        const pendMats = mats.filter(p => !p.leido && (Date.now() - (p.ts || 0) > dia) && p.recordatorioFecha !== hoy);
        if (!pendPeds.length && !pendMats.length) return;
        let msgs = []; try { const r = await storage.get("vv_mensajes"); if (r?.value) msgs = JSON.parse(r.value); } catch { }
        const nuevos = [];
        for (const p of pendPeds) {
          const quien = p.para === "cliente" ? (cfg?.clienteSigla || "Belfast") : "V+V";
          nuevos.push({ id: uid() + Date.now() + Math.random(), from: "sistema", recordatorio: true, texto: `⏰ RECORDATORIO: el pedido "${p.asunto || "sin asunto"}" sigue SIN RESPONDER. Le corresponde a ${quien} atenderlo. (Está pendiente desde ${p.fecha || "hace más de un día"}.)`, fecha: hoy, ts: Date.now() });
        }
        for (const p of pendMats) {
          nuevos.push({ id: uid() + Date.now() + Math.random(), from: "sistema", recordatorio: true, texto: `⏰ RECORDATORIO: hay un pedido de materiales SIN LEVANTAR${p.empresa ? " de " + p.empresa : ""} (${p.fecha || ""}). Por favor gestionarlo.`, fecha: hoy, ts: Date.now() });
        }
        const pedsNext = peds.map(p => pendPeds.some(x => x.id === p.id) ? { ...p, recordatorioFecha: hoy } : p);
        const matsNext = mats.map(p => pendMats.some(x => x.id === p.id) ? { ...p, recordatorioFecha: hoy } : p);
        const msgsNext = [...msgs, ...nuevos];
        try { localStorage.setItem("vv_mensajes", JSON.stringify(msgsNext)); } catch { }
        await storage.set("vv_mensajes", JSON.stringify(msgsNext)).catch(() => { });
        if (pendPeds.length) await storage.set("vv_pedidos", JSON.stringify(pedsNext)).catch(() => { });
        if (pendMats.length) await storage.set("vv_matpedidos", JSON.stringify(matsNext)).catch(() => { });
        setMensajes(msgsNext);
      } catch { }
    }
    const t = setTimeout(chequear, 8000);
    const iv = setInterval(chequear, 60 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);
  // Sincronización entre dispositivos: cada 10s trae lo último de la nube de todos los
  // datos compartidos. No pisa una clave recién editada en ESTE equipo (margen de 7s).
  useEffect(() => {
    const stores = [["vv_obras", setObras], ["vv_personal", setPersonal], ["vv_lics", setLics], ["vv_materiales", setMateriales], ["vv_subcontratos", setSubcontratos], ["vv_contactos", setContactos], ["vv_proveedores", setProveedores], ["vv_herramientas", setHerramientas], ["vv_tareas", setTareas], ["vv_presentismo", setPresentismo], ["vv_archivos", setArchivosGen], ["vv_vigilancia", setVigilancia], ["vv_camaras", setCamaras], ["vv_avance", setAvance], ["vv_formularios", setFormularios], ["vv_documentacion", setDocumentacion], ["vv_matpedidos", setMatpedidos], ["vv_gestion", setGestion], ["vv_cfg", setCfg]];
    let alive = true;
    const pullAll = async () => {
      for (const [key, setter] of stores) {
        try {
          if (Date.now() - (lastWrite[key] || 0) < 6000) continue; // recién editado acá: no tocar
          const r = await storage.get(key);
          if (!r?.value) continue;
          const localRaw = storage.getLocal(key)?.value;
          if (r.value === localRaw) continue; // sin cambios
          if (alive) setter(JSON.parse(r.value)); // adoptar lo último de la nube
        } catch { }
      }
    };
    pullAll();
    const iv = setInterval(pullAll, 4000);
    const onVis = () => { if (document.visibilityState === "visible") pullAll(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", pullAll);
    return () => { alive = false; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", pullAll); };
  }, []);
  const requireAuth = (fn) => fn();
  useEffect(() => { try { if (!localStorage.getItem("vv_seen")) { const now = Date.now(); const init = { mensajes: now, informes: now, materiales: now, ia: now }; localStorage.setItem("vv_seen", JSON.stringify(init)); setSeen(init); } else { const s = JSON.parse(localStorage.getItem("vv_seen") || "{}"); if (s.ia == null) { s.ia = Date.now(); localStorage.setItem("vv_seen", JSON.stringify(s)); setSeen(s); } } } catch { } }, []);
  useEffect(() => { initPush("vv"); }, []);
  useEffect(() => { (async () => { try { const r = await storage.get("ia_debate"); if (r?.value) { const d = JSON.parse(r.value); if (d && d.active) { d.active = false; try { localStorage.setItem("ia_debate", JSON.stringify(d)); } catch { } await storage.set("ia_debate", JSON.stringify(d)).catch(() => { }); } } } catch { } })(); }, []);
  useEffect(() => { (async () => { try { const r = await storage.get("ia_debate"); if (r?.value) { const d = JSON.parse(r.value); if (d && d.active) { d.active = false; try { localStorage.setItem("ia_debate", JSON.stringify(d)); } catch { } await storage.set("ia_debate", JSON.stringify(d)).catch(() => { }); } } } catch { } })(); }, []);
  const [seen, setSeen] = useState(() => { try { return JSON.parse(localStorage.getItem("vv_seen") || "{}"); } catch { return {}; } });
  const [iaDialogo, setIaDialogo] = useState([]);
  useEffect(() => { let alive = true; const pull = async () => { try { const r = await storage.get("ia_dialogo"); if (r?.value) { const arr = JSON.parse(r.value); if (alive) setIaDialogo(arr); } } catch { } }; pull(); const iv = setInterval(pull, 4000); const onVis = () => { if (document.visibilityState === "visible") pull(); }; document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", pull); return () => { alive = false; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", pull); }; }, []);
  function markSeen(cat) { setSeen(prev => { const n = { ...prev, [cat]: Date.now() }; try { localStorage.setItem("vv_seen", JSON.stringify(n)); } catch { } return n; }); }
  const unreadMensajes = (mensajes || []).filter(m => m.from && m.from !== "vv" && (m.ts || 0) > (seen.mensajes || 0)).length;
  const unreadMat = (matpedidos || []).filter(p => p.de !== "vv" && (p.ts || 0) > (seen.materiales || 0)).length;
  const unreadInformes = (obras || []).flatMap(o => o.informes || []).filter(inf => (inf.ts || 0) > (seen.informes || 0)).length;
  const unreadIA = (iaDialogo || []).filter(m => m.from && m.from !== "vv" && m.tipo === "q" && (m.ts || 0) > (seen.ia || 0)).length;
  const pendVV = pedidos.filter(p => p.para === "vv" && p.estado !== "resuelto").length;
  const navBadges = { mensajes: unreadMensajes, informes: unreadInformes, chat: unreadIA, mas: pendVV + unreadMat };
  useEffect(() => {
    const total = unreadMensajes + pendVV + unreadMat + unreadInformes + unreadIA;
    try { if ("setAppBadge" in navigator) { if (total > 0) navigator.setAppBadge(total); else navigator.clearAppBadge && navigator.clearAppBadge(); } } catch { }
  }, [unreadMensajes, pendVV, unreadMat, unreadInformes, unreadIA]);
  const go = (v)=>{ setView(v); if (v === "mensajes") markSeen("mensajes"); if (v === "mas") markSeen("materiales"); if (v === "informes") markSeen("informes"); if (v === "chat") markSeen("ia"); };
  const db = { lics, setLics, obras, setObras, personal, setPersonal, materiales, setMateriales, subcontratos, setSubcontratos, contactos, setContactos, proveedores, setProveedores, herramientas, setHerramientas, tareas, setTareas, presentismo, setPresentismo, archivosGen, setArchivosGen, vigilancia, setVigilancia, mensajes, setMensajes, clienteArchivos, pedidos, setPedidos, camaras, setCamaras, gestion, setGestion, formularios, setFormularios, documentacion, setDocumentacion, matpedidos, setMatpedidos };

  return (
    <div style={{ width:"100%", height:"100dvh", background:LUXE_BG }}>
      <style>{css}</style>
      <style>{buildThemeCSS(cfg)}</style>
      <div style={{ width:"100%", height:"100dvh", background:"transparent", display:"flex", flexDirection:"column", position:"relative", color:"var(--text,#131C2B)", fontFamily:"var(--font,'Inter'),sans-serif", overflow:"hidden" }}>
        <WebHeader cfg={cfg} view={view} go={(v)=>{ go(v); if(v==="mas") setMasSub(null); }} pendientes={pendVV} badges={navBadges} />
        {view==="dashboard" && <WebHero cfg={cfg} obras={obras} personal={personal} />}
        <div style={{ flex:1, overflow:"hidden", display:"flex", justifyContent:"center", background:"transparent" }}>
          <div style={{ width:"100%", maxWidth:1180, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--bg,#F5F6F8)", borderLeft:`1px solid rgba(176,137,79,0.28)`, borderRight:`1px solid rgba(176,137,79,0.28)`, boxShadow:"0 0 80px rgba(0,0,0,0.45)" }}>
            {view==="dashboard" && <Dashboard lics={lics} obras={obras} personal={personal} alerts={SAMPLE_ALERTS} setView={setView} setDetailObraId={setDetailObraId} requireAuth={requireAuth} cfg={cfg} web pedidos={pedidos} onPedidos={()=>{ setView("mas"); setMasSub("pedidos"); }} />}
            {view==="proyectos" && <Proyectos lics={lics} setLics={setLics} requireAuth={requireAuth} cfg={cfg} obras={obras} setObras={setObras} />}
            {view==="obras" && <Obras obras={obras} setObras={setObras} lics={lics} detailId={detailObraId} setDetailId={setDetailObraId} requireAuth={requireAuth} cfg={cfg} apiKey={cfg.apiKey} />}
            {view==="avance" && <AvanceView obras={obras} avance={avance} setAvance={setAvance} apiKey={cfg.apiKey} />}
            {view==="cargar" && <CargarView obras={obras} cfg={cfg} apiKey={cfg.apiKey} />}
            {view==="personal" && <PersonalView personal={personal} setPersonal={setPersonal} obras={obras} cfg={cfg} />}
            {view==="chat" && <ChatIA db={db} cfg={cfg} apiKey={cfg.apiKey} msgs={chatMsgs} setMsgs={setChatMsgs} />}
            {view==="mas" && <MasView cfg={cfg} setCfg={setCfg} sub={masSub} setSub={setMasSub} goView={go} db={db} apiKey={cfg.apiKey} />}
            {view==="informes" && <InformesView db={db} cfg={cfg} apiKey={cfg.apiKey} onBack={()=>setView("dashboard")} />}
            {view==="formularios" && <FormulariosView db={db} cfg={cfg} apiKey={cfg.apiKey} onBack={()=>setView("dashboard")} />}
            {view==="mensajes" && <MensajesVVView db={db} cfg={cfg} apiKey={cfg.apiKey} onBack={()=>setView("dashboard")} />}
          </div>
        </div>
        <WebFooter cfg={cfg} />
      </div>
    </div>
  );
}

export default App;
