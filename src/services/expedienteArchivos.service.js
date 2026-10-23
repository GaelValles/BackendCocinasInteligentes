import mongoose from 'mongoose';
import Proyecto from '../models/proyecto.model.js';
import Tarea from '../models/tarea.model.js';
import ClienteArchivo from '../models/clienteArchivo.model.js';

const HARDCODED_TRACKING_FILE_NAME = 'Levantamiento Preliminar.pdf';
const HARDCODED_TRACKING_FILE_ID = 'preliminar-1';

export const isHttpsMediaUrl = (url = '') => {
    const value = String(url || '').trim().toLowerCase();
    return value.startsWith('https://');
};

/** URL https sin query ni hash, en minúsculas (clave de deduplicación). */
export const canonicalHttpsUrlKey = (url = '') => {
    const trimmed = String(url || '').trim();
    if (!isHttpsMediaUrl(trimmed)) return '';

    try {
        const parsed = new URL(trimmed);
        const pathname = String(parsed.pathname || '/').replace(/\/+$/, '') || '/';
        return `${parsed.protocol}//${parsed.host}${pathname}`.toLowerCase();
    } catch {
        return trimmed.split('#')[0].split('?')[0].trim().toLowerCase();
    }
};

const RECEIPT_TIPOS = new Set(['recibo', 'recibo_1', 'recibo_2', 'recibo_3']);

export const isReceiptArchivo = (item = {}) => {
    const tipo = String(item?.tipo || item?.type || '').trim().toLowerCase();
    if (RECEIPT_TIPOS.has(tipo)) return true;
    const nombre = String(item?.nombre || item?.name || '').trim().toLowerCase();
    return Boolean(nombre && nombre.includes('recibo'));
};

const receiptSlotKey = (item = {}) => {
    const tipo = String(item?.tipo || item?.type || '').trim().toLowerCase();
    if (['recibo_1', 'recibo_2', 'recibo_3'].includes(tipo)) return tipo;

    const nombre = String(item?.nombre || item?.name || '').trim().toLowerCase();
    if (!nombre) return isReceiptArchivo(item) ? 'recibo-generico' : null;
    if (RECEIPT_TIPOS.has(tipo) || nombre.includes('recibo')) {
        return `recibo-nombre::${nombre}`;
    }

    return null;
};

export const collectReceiptCanonicalUrlsFromPagos = (pagos = {}) => {
    const urls = new Set();
    for (const slot of ['anticipo', 'segundoPago', 'liquidacion']) {
        const key = canonicalHttpsUrlKey(pagos?.[slot]?.receiptImage);
        if (key) urls.add(key);
    }
    return urls;
};

const isHardcodedTrackingFileRef = (file = {}) => {
    const nombre = String(file?.nombre ?? file?.name ?? '').trim();
    const id = String(file?.id ?? file?._id ?? '').trim();
    return nombre === HARDCODED_TRACKING_FILE_NAME || id === HARDCODED_TRACKING_FILE_ID;
};

const normalizeClienteCodigo = (value = '') => String(value || '').trim().toUpperCase().replace(/^K-/, '');

const asTrackingCotizaciones = (value) => (Array.isArray(value) ? value : []);

const isValidTrackingQuoteObject = (entry) => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry) && Object.keys(entry).length > 0)
);

const pickFirstValidTrackingQuote = (entries = []) => {
    for (const entry of asTrackingCotizaciones(entries)) {
        if (isValidTrackingQuoteObject(entry)) return entry;
    }
    return null;
};

export const resolveTrackingCotizacionesFromTarea = (tarea = {}) => {
    const cotizacionesFormales = asTrackingCotizaciones(tarea?.cotizacionesFormales);
    const preliminarCotizaciones = asTrackingCotizaciones(tarea?.preliminarCotizaciones);
    const cotizacionFormalData = pickFirstValidTrackingQuote(cotizacionesFormales)
        || (isValidTrackingQuoteObject(tarea?.cotizacionFormalData) ? tarea.cotizacionFormalData : null);
    const preliminarData = pickFirstValidTrackingQuote(preliminarCotizaciones)
        || (isValidTrackingQuoteObject(tarea?.preliminarData) ? tarea.preliminarData : null);

    return {
        cotizacionesFormales,
        preliminarCotizaciones,
        ...(cotizacionFormalData ? { cotizacionFormalData } : {}),
        ...(preliminarData ? { preliminarData } : {})
    };
};

const normalizeExpedienteArchivo = (archivo = {}) => {
    const nombre = String(archivo?.nombre || archivo?.name || '').trim();
    const url = String(archivo?.url || archivo?.src || '').trim();
    const tipo = String(archivo?.tipo || archivo?.type || 'otro').trim() || 'otro';
    const nivelRaw = archivo?.nivel;
    const nivel = ['preliminar', 'final'].includes(String(nivelRaw || '').toLowerCase())
        ? String(nivelRaw).toLowerCase()
        : (nivelRaw ?? null);

    return {
        id: archivo?._id ? String(archivo._id) : String(archivo?.id || `${nombre || 'archivo'}-${archivo?.createdAt || Date.now()}`),
        nombre: nombre || 'Archivo',
        name: nombre || 'Archivo',
        tipo,
        type: tipo,
        nivel,
        url,
        src: url,
        provider: archivo?.provider || null,
        createdAt: archivo?.createdAt || null
    };
};

export const mapArchivosPublicosForResponse = (archivosPublicos = [], pagos = null) => (
    mergeArchivosForPublicRead({
        groups: [archivosPublicos],
        pagos,
        normalizeItem: normalizeExpedienteArchivo
    })
);

export const mergeArchivosForPublicRead = ({
    groups = [],
    pagos = null,
    normalizeItem = normalizeExpedienteArchivo
} = {}) => {
    const merged = [];
    const seenCanonicalUrls = new Set();
    const seenReceiptSlots = new Set();
    const receiptUrlsFromPagos = collectReceiptCanonicalUrlsFromPagos(pagos);

    for (const group of groups) {
        for (const raw of (Array.isArray(group) ? group : [])) {
            if (isHardcodedTrackingFileRef(raw)) continue;

            const item = normalizeItem(raw);
            const canonicalUrl = canonicalHttpsUrlKey(item?.url || item?.src);
            if (!canonicalUrl) continue;

            if (receiptUrlsFromPagos.has(canonicalUrl)) continue;

            const slotKey = receiptSlotKey(item);
            if (slotKey) {
                if (seenReceiptSlots.has(slotKey)) continue;
                seenReceiptSlots.add(slotKey);
            }

            if (seenCanonicalUrls.has(canonicalUrl)) continue;
            seenCanonicalUrls.add(canonicalUrl);
            merged.push(item);
        }
    }

    return merged;
};

export const mergeExpedienteHttpsArchivos = ({
    archivosPublicos = [],
    tareaArchivos = [],
    pagos = null
} = {}) => mergeArchivosForPublicRead({
    groups: [archivosPublicos, tareaArchivos],
    pagos,
    normalizeItem: normalizeExpedienteArchivo
});

export const mergeArchivoListsByUrl = (primary = [], secondary = [], pagos = null) => mergeArchivosForPublicRead({
    groups: [primary, secondary],
    pagos,
    normalizeItem: (raw) => {
        const normalized = normalizeExpedienteArchivo(raw);
        return {
            ...raw,
            ...normalized,
            url: normalized.url || String(raw?.url || raw?.src || '').trim(),
            src: normalized.url || String(raw?.url || raw?.src || '').trim()
        };
    }
});

export const resolveProyectoForExpediente = async ({ tarea = null, clienteCodigo = '' } = {}) => {
    const codigo = normalizeClienteCodigo(clienteCodigo || tarea?.clienteId || '');
    const proyectoSelect = '_id clienteId archivosPublicos presupuestoTotal pagos tipo fechaContrato fechaEntrega';

    if (tarea?.proyectoId && mongoose.Types.ObjectId.isValid(String(tarea.proyectoId))) {
        const byId = await Proyecto.findById(tarea.proyectoId).select(proyectoSelect).lean();
        if (byId) return byId;
    }

    if (codigo.length === 6) {
        return Proyecto.findOne({ clienteId: codigo }).sort({ updatedAt: -1 }).select(proyectoSelect).lean();
    }

    return null;
};

export const resolveLatestTareaForExpediente = async ({ tareaId = null, clienteCodigo = '' } = {}) => {
    if (tareaId && mongoose.Types.ObjectId.isValid(String(tareaId))) {
        return Tarea.findById(tareaId).lean();
    }

    const codigo = normalizeClienteCodigo(clienteCodigo);
    if (codigo.length !== 6) return null;

    return Tarea.findOne({ clienteId: codigo }).sort({ updatedAt: -1 }).lean();
};

export const buildExpedienteSeguimientoArchivos = async ({
    tareaId = null,
    clienteCodigo = '',
    tarea = null
} = {}) => {
    const tareaDoc = tarea || await resolveLatestTareaForExpediente({ tareaId, clienteCodigo });
    const codigo = normalizeClienteCodigo(clienteCodigo || tareaDoc?.clienteId || '');
    const proyecto = await resolveProyectoForExpediente({ tarea: tareaDoc, clienteCodigo: codigo });

    const pagos = tareaDoc?.pagos || proyecto?.pagos || null;
    const archivos = mergeExpedienteHttpsArchivos({
        archivosPublicos: proyecto?.archivosPublicos,
        tareaArchivos: tareaDoc?.archivos,
        pagos
    });
    const archivosPublicos = mapArchivosPublicosForResponse(proyecto?.archivosPublicos, pagos);

    return {
        tarea: tareaDoc,
        proyecto,
        codigo,
        archivosPublicos,
        archivos,
        ...resolveTrackingCotizacionesFromTarea(tareaDoc || {})
    };
};

export const buildPanelArchivosWithSeguimiento = async ({ clienteCodigo = '', nivel = null } = {}) => {
    const codigo = normalizeClienteCodigo(clienteCodigo);
    const query = { clienteId: codigo };
    if (nivel) {
        query.nivel = nivel;
    }

    const clienteArchivos = codigo
        ? await ClienteArchivo.find(query).sort({ createdAt: -1 }).lean()
        : [];

    const seguimiento = await buildExpedienteSeguimientoArchivos({ clienteCodigo: codigo });
    const pagos = seguimiento.tarea?.pagos || seguimiento.proyecto?.pagos || null;
    const archivos = mergeArchivoListsByUrl(clienteArchivos, seguimiento.archivos, pagos);

    const archivosAgrupados = {};
    for (const archivo of archivos) {
        const tipo = String(archivo?.tipo || 'otro');
        if (!archivosAgrupados[tipo]) archivosAgrupados[tipo] = [];
        archivosAgrupados[tipo].push(archivo);
    }

    return {
        ...seguimiento,
        archivos,
        archivosAgrupados,
        total: archivos.length
    };
};
