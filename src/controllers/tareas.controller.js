import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import Tarea from '../models/tarea.model.js';
import Proyecto from '../models/proyecto.model.js';
import ClienteIdentidad from '../models/clienteIdentidad.model.js';
import Admin from '../models/admin.model.js';
import { uploadFileToDropbox } from '../libs/dropbox.js';
import { uploadFileToCloudinary } from '../libs/cloudinary.js';
import { upsertTrackingAccessFromTarea } from '../services/trackingAccess.service.js';

const ROLES_ASIGNABLES = ['admin', 'ingeniero', 'arquitecto', 'empleado', 'empleado_general', 'staff'];
const ROLES_OPERATIVOS = ['ingeniero', 'arquitecto', 'empleado', 'empleado_general', 'staff'];
const ETAPAS_VALIDAS = ['citas', 'disenos', 'cotizacion', 'contrato'];
const ESTADOS_VALIDOS = ['pendiente', 'completada'];
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baja'];
const FOLLOWUP_STATUS_VALIDOS = ['pendiente', 'confirmado', 'inactivo'];
const SOURCE_TYPES_VALIDOS = ['cita', 'diseno'];
const ETAPA_ACTUAL_VALIDAS = [
    'Diseño Aprobado',
    'Materiales en Taller',
    'Corte CNC',
    'Ensamble',
    'Instalación Final'
];

const PROCESS_FILE_TYPE_ALIASES = {
    levantamiento_detallado: 'levantamiento_detallado',
    levantamientodetallado: 'levantamiento_detallado',
    levantamiento: 'levantamiento_detallado',
    diseno: 'diseno',
    diseno_preliminar: 'diseno',
    diseno_final: 'diseno',
    render: 'diseno',
    sketchup: 'diseno',
    cotizacion_formal: 'cotizacion_formal',
    cotizacionformal: 'cotizacion_formal',
    hoja_taller: 'hoja_taller',
    hoja_de_taller: 'hoja_taller',
    hojadetaller: 'hoja_taller',
    recibo: 'recibo_1',
    recibo1: 'recibo_1',
    recibo_1: 'recibo_1',
    recibo2: 'recibo_2',
    recibo_2: 'recibo_2',
    recibo3: 'recibo_3',
    recibo_3: 'recibo_3',
    contrato: 'contrato',
    fotosproyecto: 'fotos_proyecto',
    fotos_proyecto: 'fotos_proyecto',
    foto_proyecto: 'fotos_proyecto'
};

const SINGLE_SLOT_TYPES = new Set([
    'levantamiento_detallado',
    'diseno',
    'cotizacion_formal',
    'hoja_taller',
    'recibo_1',
    'recibo_2',
    'recibo_3',
    'contrato'
]);

const DROPBOX_ONLY_TYPES = new Set(['diseno']);
const CLOUDINARY_ONLY_TYPES = new Set([
    'levantamiento_detallado',
    'cotizacion_formal',
    'hoja_taller',
    'recibo_1',
    'recibo_2',
    'recibo_3',
    'contrato',
    'fotos_proyecto'
]);

const normalizeProcessFileType = (value = '') => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_');

    return PROCESS_FILE_TYPE_ALIASES[normalized] || normalized || 'otro';
};

const resolveStrictProviderByType = (tipo = '') => {
    const canonicalType = normalizeProcessFileType(tipo);
    if (DROPBOX_ONLY_TYPES.has(canonicalType)) return 'dropbox';
    if (CLOUDINARY_ONLY_TYPES.has(canonicalType)) return 'cloudinary';
    return null;
};

const inferProviderFromFileMeta = (archivo = {}) => {
    const rawProvider = String(archivo.provider || '').trim().toLowerCase();
    if (['dropbox', 'cloudinary', 'local'].includes(rawProvider)) {
        return rawProvider;
    }

    const key = String(archivo.key || '').trim().toLowerCase();
    if (key.startsWith('dropbox:')) return 'dropbox';
    if (key.startsWith('cloudinary:')) return 'cloudinary';
    if (key.startsWith('local:')) return 'local';

    const url = String(archivo.url || '').trim().toLowerCase();
    if (url.includes('cloudinary.com')) return 'cloudinary';
    if (url.includes('dropboxusercontent.com') || url.includes('dropbox.com')) return 'dropbox';

    return 'local';
};

const toDateOrNow = (value) => {
    if (!value) return new Date();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
};

const toTaskFileRecord = (archivo = {}, clienteIdFallback = '') => ({
    id: String(archivo.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    nombre: String(archivo.nombre || ''),
    tipo: normalizeProcessFileType(archivo.tipo || 'otro'),
    url: String(archivo.url || ''),
    key: String(archivo.key || ''),
    provider: inferProviderFromFileMeta(archivo),
    mimeType: String(archivo.mimeType || ''),
    clienteId: String(archivo.clienteId || clienteIdFallback || '').trim().toUpperCase(),
    createdAt: toDateOrNow(archivo.createdAt)
});

const upsertTaskFiles = (currentFiles = [], incomingFiles = []) => {
    const normalizedCurrent = Array.isArray(currentFiles) ? currentFiles.map((item) => toTaskFileRecord(item)) : [];
    const result = [...normalizedCurrent];

    for (const incomingRaw of incomingFiles) {
        const incoming = toTaskFileRecord(incomingRaw);
        if (!incoming.url && !incoming.key) {
            continue;
        }

        const duplicatedByKey = incoming.key
            ? result.findIndex((item) => item.key && item.key === incoming.key)
            : -1;

        const duplicatedByUrl = duplicatedByKey === -1 && incoming.url
            ? result.findIndex((item) => item.url && item.url === incoming.url)
            : -1;

        const duplicatedBySlot = (duplicatedByKey === -1 && duplicatedByUrl === -1 && SINGLE_SLOT_TYPES.has(incoming.tipo))
            ? result.findIndex((item) => item.tipo === incoming.tipo)
            : -1;

        const targetIndex = duplicatedByKey !== -1
            ? duplicatedByKey
            : (duplicatedByUrl !== -1 ? duplicatedByUrl : duplicatedBySlot);

        if (targetIndex !== -1) {
            const existing = result[targetIndex];
            result[targetIndex] = {
                ...existing,
                ...incoming,
                id: incoming.id || existing.id,
                createdAt: incoming.createdAt || existing.createdAt,
                provider: incoming.provider || existing.provider,
                key: incoming.key || existing.key,
                mimeType: incoming.mimeType || existing.mimeType,
                clienteId: incoming.clienteId || existing.clienteId
            };
        } else {
            result.push(incoming);
        }
    }

    return result;
};

const upsertClienteFiles = (currentFiles = [], incomingFiles = [], context = {}) => {
    const result = Array.isArray(currentFiles) ? [...currentFiles] : [];
    const taskId = String(context.taskId || '');
    const proyectoId = String(context.proyectoId || '');

    for (const incomingRaw of incomingFiles) {
        const incoming = toTaskFileRecord(incomingRaw, context.clienteId || '');
        const target = {
            id: incoming.id,
            taskId,
            proyectoId,
            tipo: incoming.tipo,
            nombre: incoming.nombre,
            url: incoming.url,
            key: incoming.key,
            provider: incoming.provider,
            mimeType: incoming.mimeType,
            relacionadoA: 'tarea',
            relacionadoId: taskId,
            clienteId: incoming.clienteId,
            createdAt: incoming.createdAt
        };

        const byKey = incoming.key
            ? result.findIndex((item) => item?.key && item.key === incoming.key)
            : -1;

        const byUrl = byKey === -1 && incoming.url
            ? result.findIndex((item) => item?.url && item.url === incoming.url)
            : -1;

        const bySlot = (byKey === -1 && byUrl === -1 && SINGLE_SLOT_TYPES.has(incoming.tipo))
            ? result.findIndex((item) => item?.tipo === incoming.tipo && String(item?.taskId || '') === taskId)
            : -1;

        const targetIndex = byKey !== -1 ? byKey : (byUrl !== -1 ? byUrl : bySlot);
        if (targetIndex !== -1) {
            const existing = result[targetIndex] || {};
            result[targetIndex] = {
                ...existing,
                ...target,
                key: target.key || existing.key || '',
                provider: target.provider || existing.provider || 'local',
                mimeType: target.mimeType || existing.mimeType || '',
                clienteId: target.clienteId || existing.clienteId || ''
            };
        } else {
            result.push(target);
        }
    }

    return result;
};

const syncFilesWithClienteAndProject = async ({ tarea, archivosNormalizados }) => {
    const tareaId = String(tarea?._id || '');
    const proyectoId = String(tarea?.proyectoId || '');
    const clienteCodigo = String(tarea?.clienteId || '').trim().toUpperCase();

    if (clienteCodigo) {
        const cliente = await ClienteIdentidad.findOne({ codigo: clienteCodigo });
        if (cliente) {
            cliente.archivos = upsertClienteFiles(cliente.archivos, archivosNormalizados, {
                taskId: tareaId,
                proyectoId,
                clienteId: clienteCodigo
            });
            await cliente.save();
        }
    }

    if (proyectoId && mongoose.Types.ObjectId.isValid(proyectoId)) {
        const proyecto = await Proyecto.findById(proyectoId);
        if (proyecto) {
            proyecto.archivos = upsertTaskFiles(proyecto.archivos, archivosNormalizados);
            await proyecto.save();
        }
    }
};

const shouldUseDropboxForDesign = (fileName = '', tipo = '') => {
    const name = String(fileName || '').trim().toLowerCase();
    const ext = path.extname(name);
    const tipoNorm = String(tipo || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_');

    const isFormalDoc = ['cotizacion_formal', 'hoja_taller', 'levantamiento_detallado', 'recibo', 'contrato'].some((token) => tipoNorm.includes(token));
    if (isFormalDoc) return false;

    if (ext === '.skp') return true;
    if (tipoNorm.includes('diseno') || tipoNorm.includes('render') || tipoNorm.includes('sketchup') || tipoNorm.includes('modelo_3d') || tipoNorm.includes('modelo3d')) {
        return true;
    }

    return name.includes('diseno') || name.includes('diseño') || name.includes('render');
};

const shouldForceDropboxByTaskContext = async (taskId) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) return false;
    const task = await Tarea.findById(taskId, { etapa: 1, sourceType: 1 }).lean();
    return Boolean(task && (task.etapa === 'disenos' || task.sourceType === 'diseno'));
};

const normalizeDateOrNull = (value) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const validateDateInput = (fieldName, value) => {
    if (value === undefined) return { ok: true, value: undefined };
    const parsed = normalizeDateOrNull(value);
    if (parsed === undefined) {
        return { ok: false, message: `${fieldName} inválida. Debe ser una fecha válida (ISO recomendado)` };
    }
    return { ok: true, value: parsed };
};

const normalizeSource = (body = {}) => {
    const sourceType = body.sourceType
        || (body.sourceCitaId ? 'cita' : null)
        || (body.sourceDisenoId ? 'diseno' : null);

    const sourceId = sourceType === 'cita'
        ? String(body.sourceId || body.sourceCitaId || '').trim()
        : sourceType === 'diseno'
            ? String(body.sourceId || body.sourceDisenoId || '').trim()
            : String(body.sourceId || '').trim();

    return {
        sourceType: sourceType || null,
        sourceId: sourceId || null
    };
};

const normalizeCitaData = (raw = {}) => {
    if (!raw || typeof raw !== 'object') return null;

    const fechaAgendadaRaw = raw.fechaAgendada;
    const fechaAgendada = fechaAgendadaRaw !== undefined ? normalizeDateOrNull(fechaAgendadaRaw) : null;

    return {
        fechaAgendada,
        nombreCliente: raw.nombreCliente || '',
        correoCliente: String(raw.correoCliente || '').trim().toLowerCase(),
        telefonoCliente: raw.telefonoCliente || '',
        ubicacion: raw.ubicacion || '',
        informacionAdicional: raw.informacionAdicional || ''
    };
};

const normalizeClienteData = (raw = {}) => {
    if (!raw || typeof raw !== 'object') return null;
    const nombre = String(raw.nombre || '').trim();
    const correo = String(raw.correo || '').trim().toLowerCase();
    const telefono = String(raw.telefono || '').trim();

    return {
        nombre,
        correo,
        telefono
    };
};

const resolveClienteData = ({ cliente, nombreCliente, correoCliente, telefonoCliente, cita }) => {
    const fromCliente = normalizeClienteData(cliente);
    const fromAliases = normalizeClienteData({
        nombre: nombreCliente,
        correo: correoCliente,
        telefono: telefonoCliente
    });
    const fromCita = normalizeClienteData({
        nombre: cita?.nombreCliente,
        correo: cita?.correoCliente,
        telefono: cita?.telefonoCliente
    });

    const nombre = fromCliente?.nombre || fromAliases?.nombre || fromCita?.nombre || '';
    const correo = fromCliente?.correo || fromAliases?.correo || fromCita?.correo || '';
    const telefono = fromCliente?.telefono || fromAliases?.telefono || fromCita?.telefono || '';

    return {
        nombre,
        correo,
        telefono
    };
};

const normalizeVisitaData = (raw = {}) => {
    if (!raw || typeof raw !== 'object') return null;

    const fechaRaw = raw.fechaProgramada ?? raw.visitScheduledAt;
    const fechaProgramada = fechaRaw !== undefined ? normalizeDateOrNull(fechaRaw) : undefined;
    const actualizadaRaw = raw.actualizadaEn;
    const actualizadaEn = actualizadaRaw !== undefined ? normalizeDateOrNull(actualizadaRaw) : undefined;

    return {
        fechaProgramada,
        aprobadaPorAdmin: raw.aprobadaPorAdmin,
        aprobadaPorCliente: raw.aprobadaPorCliente,
        actualizadaEn
    };
};

const resolveVisitStateFromPayload = ({
    visita,
    visitScheduledAt,
    designApprovedByAdmin,
    designApprovedByClient,
    currentVisita = null
} = {}) => {
    const visitaParsed = normalizeVisitaData(visita);
    const current = currentVisita && typeof currentVisita === 'object' ? currentVisita : {};

    const fechaProgramada = visitaParsed?.fechaProgramada !== undefined
        ? visitaParsed.fechaProgramada
        : (visitScheduledAt !== undefined ? normalizeDateOrNull(visitScheduledAt) : (current.fechaProgramada ?? null));

    const aprobadaPorAdmin = visitaParsed?.aprobadaPorAdmin !== undefined
        ? Boolean(visitaParsed.aprobadaPorAdmin)
        : (designApprovedByAdmin !== undefined ? Boolean(designApprovedByAdmin) : Boolean(current.aprobadaPorAdmin ?? false));

    const aprobadaPorCliente = visitaParsed?.aprobadaPorCliente !== undefined
        ? Boolean(visitaParsed.aprobadaPorCliente)
        : (designApprovedByClient !== undefined ? Boolean(designApprovedByClient) : Boolean(current.aprobadaPorCliente ?? false));

    const actualizadaEn = visitaParsed?.actualizadaEn !== undefined
        ? visitaParsed.actualizadaEn
        : ((visita !== undefined || visitScheduledAt !== undefined || designApprovedByAdmin !== undefined || designApprovedByClient !== undefined)
            ? new Date()
            : (current.actualizadaEn ?? null));

    return {
        visitaParsed,
        value: {
            fechaProgramada,
            aprobadaPorAdmin,
            aprobadaPorCliente,
            actualizadaEn
        }
    };
};

const normalizeFileUrl = (url = '', baseUrl = '') => {
    const value = String(url || '').trim();
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.startsWith('/') && baseUrl) return `${baseUrl}${value}`;
    return value;
};

const normalizeFollowUpStatus = (status) => {
    if (status === undefined) return undefined;
    if (status === null) return null;

    const normalized = String(status).trim().toLowerCase();
    return normalized === 'descartado' ? 'inactivo' : normalized;
};

const resolveFollowUpStatusFromPayload = (payload = {}) => {
    const candidates = [
        payload.followUpStatus,
        payload.seguimiento,
        payload.estadoSeguimiento
    ]
        .filter((value) => value !== undefined)
        .map((value) => normalizeFollowUpStatus(value));

    if (candidates.length > 1) {
        const [first, ...rest] = candidates;
        const hasConflict = rest.some((value) => value !== first);
        if (hasConflict) {
            return {
                error: 'followUpStatus, seguimiento y estadoSeguimiento tienen valores en conflicto'
            };
        }
    }

    const incoming = payload.followUpStatus
        ?? payload.seguimiento
        ?? payload.estadoSeguimiento;

    return {
        value: normalizeFollowUpStatus(incoming)
    };
};

const normalizePagoDetalle = (current = {}, incoming = {}) => {
    const currentSafe = current && typeof current === 'object' ? current : {};
    const incomingSafe = incoming && typeof incoming === 'object' ? incoming : {};

    const amountRaw = incomingSafe.amount !== undefined ? incomingSafe.amount : currentSafe.amount;
    const amountNumber = Number(amountRaw ?? 0);
    if (Number.isNaN(amountNumber) || amountNumber < 0) {
        return { ok: false, message: 'pagos.*.amount debe ser numérico y mayor o igual a 0' };
    }

    const dateRaw = incomingSafe.date !== undefined ? incomingSafe.date : currentSafe.date;
    const date = dateRaw === undefined || dateRaw === null ? '' : String(dateRaw);

    const receiptLabelRaw = incomingSafe.receiptLabel !== undefined ? incomingSafe.receiptLabel : currentSafe.receiptLabel;
    const receiptLabel = String(receiptLabelRaw || 'Ver recibo');

    const receiptImageRaw = incomingSafe.receiptImage !== undefined ? incomingSafe.receiptImage : currentSafe.receiptImage;
    const receiptImage = String(receiptImageRaw || '');

    return {
        ok: true,
        value: {
            amount: amountNumber,
            date,
            receiptLabel,
            receiptImage
        }
    };
};

const buildPagosState = (current = {}, incoming = undefined) => {
    const base = {
        anticipo: { amount: 0, date: '', receiptLabel: 'Ver recibo', receiptImage: '' },
        segundoPago: { amount: 0, date: '', receiptLabel: 'Ver recibo', receiptImage: '' },
        liquidacion: { amount: 0, date: '', receiptLabel: 'Ver recibo', receiptImage: '' }
    };

    const currentSafe = current && typeof current === 'object' ? current : {};
    const mergedCurrent = {
        anticipo: { ...base.anticipo, ...(currentSafe.anticipo || {}) },
        segundoPago: { ...base.segundoPago, ...(currentSafe.segundoPago || {}) },
        liquidacion: { ...base.liquidacion, ...(currentSafe.liquidacion || {}) }
    };

    if (incoming === undefined || incoming === null) {
        return { ok: true, value: mergedCurrent };
    }

    if (typeof incoming !== 'object' || Array.isArray(incoming)) {
        return { ok: false, message: 'pagos debe ser un objeto válido' };
    }

    const next = {};
    for (const key of ['anticipo', 'segundoPago', 'liquidacion']) {
        const detail = normalizePagoDetalle(mergedCurrent[key], incoming[key]);
        if (!detail.ok) {
            return detail;
        }
        next[key] = detail.value;
    }

    return { ok: true, value: next };
};

const resolveInversionFromPayload = ({ inversion, inversionTotal } = {}) => {
    const normalizeInput = (raw, fieldName) => {
        if (raw === undefined || raw === null || raw === '') {
            return { hasValue: false, value: undefined };
        }

        const numeric = Number(raw);
        if (!Number.isFinite(numeric) || numeric < 0) {
            return { error: `${fieldName} debe ser numérico y mayor o igual a 0` };
        }

        return { hasValue: true, value: numeric };
    };

    const canonical = normalizeInput(inversion, 'inversion');
    if (canonical.error) return canonical;

    const alias = normalizeInput(inversionTotal, 'inversionTotal');
    if (alias.error) return alias;

    if (canonical.hasValue && alias.hasValue && canonical.value !== alias.value) {
        return { error: 'inversion e inversionTotal tienen valores en conflicto' };
    }

    if (canonical.hasValue) return { value: canonical.value, hasValue: true };
    if (alias.hasValue) return { value: alias.value, hasValue: true };
    return { value: undefined, hasValue: false };
};

const calculatePagosSummary = (pagos = {}) => {
    const slots = ['anticipo', 'segundoPago', 'liquidacion'];
    const totalPagado = slots.reduce((acc, slot) => {
        const amount = Number(pagos?.[slot]?.amount ?? 0);
        return acc + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    return { totalPagado };
};

const resolveSeguimientoNotaFromPayload = ({ seguimientoNota, notaSeguimiento } = {}) => {
    const hasSeguimientoNota = seguimientoNota !== undefined;
    const hasNotaSeguimiento = notaSeguimiento !== undefined;

    if (!hasSeguimientoNota && !hasNotaSeguimiento) {
        return { ok: true, value: undefined };
    }

    if (hasSeguimientoNota && hasNotaSeguimiento && String(seguimientoNota || '') !== String(notaSeguimiento || '')) {
        return {
            ok: false,
            message: 'seguimientoNota y notaSeguimiento tienen valores en conflicto'
        };
    }

    return {
        ok: true,
        value: String((hasSeguimientoNota ? seguimientoNota : notaSeguimiento) || '')
    };
};

const resolveEtapaActualFromPayload = ({ etapaActual, timelineActual } = {}) => {
    const hasEtapaActual = etapaActual !== undefined;
    const hasTimelineActual = timelineActual !== undefined;

    if (!hasEtapaActual && !hasTimelineActual) {
        return { value: undefined };
    }

    const resolved = hasEtapaActual ? etapaActual : timelineActual;
    const normalized = String(resolved || '').trim();

    if (!normalized) {
        return { value: undefined };
    }

    if (!ETAPA_ACTUAL_VALIDAS.includes(normalized)) {
        return {
            error: `etapaActual inválida. Valores permitidos: ${ETAPA_ACTUAL_VALIDAS.join(', ')}`
        };
    }

    return { value: normalized };
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            const uploadDir = path.join(process.cwd(), 'uploads', 'tasks');
            fs.mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const safeOriginalName = path.basename(String(file.originalname || 'archivo'))
            .replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safeOriginalName}`);
    }
});

export const upload = multer({ storage });

const isStaff = (req) => ['admin', 'arquitecto'].includes(req.admin?.rol);
const isOperativo = (req) => ROLES_OPERATIVOS.includes(req.admin?.rol);

const canViewOrEditTask = (req, tarea) => {
    if (isStaff(req)) return true;
    if (!isOperativo(req)) return false;
    const assigned = Array.isArray(tarea.asignadoA) ? tarea.asignadoA.map(String) : [];
    return assigned.includes(String(req.admin._id));
};

const normalizeAssignedIds = (asignadoA) => {
    if (!asignadoA) return [];

    const raw = Array.isArray(asignadoA) ? asignadoA : [asignadoA];
    const normalized = raw
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') return item;
            if (typeof item === 'object') return item._id || item.id || item.nombre || item.name || item.correo || item.email || null;
            return null;
        })
        .filter(Boolean)
        .map(String)
        .map((id) => id.trim())
        .filter(Boolean);

    return Array.from(new Set(normalized));
};

const isStrictObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildAssignableUserQuery = () => ({
    rol: { $in: ROLES_ASIGNABLES },
    status: true
});

const matchUserToIdentifier = (user, identifier) => {
    const trimmed = String(identifier || '').trim();
    if (!trimmed || !user) return false;

    if (isStrictObjectId(trimmed)) {
        return String(user._id) === trimmed;
    }

    const lower = trimmed.toLowerCase();
    const nombre = String(user.nombre || user.name || '').trim().toLowerCase();
    const correo = String(user.correo || user.email || '').trim().toLowerCase();
    const username = String(user.username || '').trim().toLowerCase();

    return nombre === lower || correo === lower || username === lower;
};

const resolveAssignedUsers = async (assignedIds) => {
    const normalizedIds = normalizeAssignedIds(assignedIds);

    if (!normalizedIds.length) {
        return [];
    }

    const objectIds = normalizedIds.filter(isStrictObjectId);
    const nameLookups = normalizedIds.filter((id) => !isStrictObjectId(id));

    const orConditions = [];

    if (objectIds.length) {
        orConditions.push({ _id: { $in: objectIds } });
    }

    for (const lookup of nameLookups) {
        const trimmed = String(lookup).trim();
        const lower = trimmed.toLowerCase();
        orConditions.push(
            { nombre: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') },
            { correo: lower }
        );
    }

    const users = orConditions.length
        ? await Admin.find({
            ...buildAssignableUserQuery(),
            $or: orConditions
        }).select('_id nombre rol status correo')
        : [];

    const resolvedUsers = [];
    const missingIds = [];

    for (const identifier of normalizedIds) {
        const user = users.find((candidate) => matchUserToIdentifier(candidate, identifier));

        if (!user) {
            missingIds.push(identifier);
            continue;
        }

        if (!resolvedUsers.some((existing) => String(existing._id) === String(user._id))) {
            resolvedUsers.push(user);
        }
    }

    if (missingIds.length) {
        return { error: `No se encontraron responsables válidos para: ${missingIds.join(', ')}` };
    }

    return resolvedUsers;
};

const resolveAuthenticatedAssignableUser = async (req) => {
    if (!req.admin?._id) return null;

    return Admin.findOne({
        _id: req.admin._id,
        ...buildAssignableUserQuery()
    }).select('_id nombre rol status correo');
};

const resolveAssignedUsersForCreate = async (assignedIds, req) => {
    const normalizedIds = normalizeAssignedIds(assignedIds);
    const resolvedUsers = await resolveAssignedUsers(normalizedIds);

    if (!resolvedUsers.error) {
        return resolvedUsers;
    }

    if (!normalizedIds.length) {
        return [];
    }

    const fallbackUser = await resolveAuthenticatedAssignableUser(req);
    if (fallbackUser) {
        return [fallbackUser];
    }

    return resolvedUsers;
};

const mapTask = (tarea, baseUrl = '') => {
    const sourceType = tarea.sourceType
        || (tarea.sourceCitaId ? 'cita' : null)
        || (tarea.sourceDisenoId ? 'diseno' : null);
    const sourceId = tarea.sourceId || tarea.sourceCitaId || tarea.sourceDisenoId || null;
    const clienteIdResolved = String(tarea.clienteId || '').trim().toUpperCase();
    const citaData = sourceType === 'cita'
        ? {
            fechaAgendada: tarea.cita?.fechaAgendada || null,
            nombreCliente: tarea.cita?.nombreCliente || '',
            correoCliente: tarea.cita?.correoCliente || '',
            telefonoCliente: tarea.cita?.telefonoCliente || '',
            ubicacion: tarea.cita?.ubicacion || '',
            informacionAdicional: tarea.cita?.informacionAdicional || ''
        }
        : null;

    const visitaData = {
        fechaProgramada: tarea.visita?.fechaProgramada ?? tarea.visitScheduledAt ?? null,
        aprobadaPorAdmin: Boolean(tarea.visita?.aprobadaPorAdmin ?? tarea.designApprovedByAdmin),
        aprobadaPorCliente: Boolean(tarea.visita?.aprobadaPorCliente ?? tarea.designApprovedByClient),
        actualizadaEn: tarea.visita?.actualizadaEn || null
    };

    const mappedArchivos = Array.isArray(tarea.archivos)
        ? tarea.archivos.map((archivo) => ({
            id: archivo?.id || null,
            nombre: archivo?.nombre || '',
            tipo: normalizeProcessFileType(archivo?.tipo || 'otro'),
            url: normalizeFileUrl(archivo?.url || '', baseUrl),
            key: archivo?.key || '',
            provider: archivo?.provider || 'local',
            mimeType: archivo?.mimeType || '',
            clienteId: archivo?.clienteId || clienteIdResolved,
            createdAt: archivo?.createdAt || null
        }))
        : [];

    const pagosState = buildPagosState(tarea.pagos).value;
    const inversion = Number.isFinite(Number(tarea.inversion)) ? Number(tarea.inversion) : 0;
    const etapaActual = String(tarea.etapaActual || '').trim();
    const { totalPagado } = calculatePagosSummary(pagosState);
    const saldoPendiente = Math.max(inversion - totalPagado, 0);

    const archivosPorTipo = mappedArchivos.reduce((acc, item) => {
        if (!item?.tipo) return acc;
        acc[item.tipo] = item;
        return acc;
    }, {});

    return {
    id: String(tarea._id),
    _id: tarea._id,
    etapa: tarea.etapa,
    estado: tarea.estado,
    asignadoA: tarea.asignadoA || [],
    asignadoANombre: tarea.asignadoANombre || [],
    assignedToIds: tarea.asignadoA || [],
    assignedTo: tarea.asignadoANombre || [],
    nombreProyecto: tarea.nombreProyecto || '',
    proyectoId: tarea.proyectoId || null,
    fechaLimite: tarea.fechaLimite || null,
    scheduledAt: tarea.scheduledAt || null,
    visitScheduledAt: tarea.visitScheduledAt || null,
    ubicacion: tarea.ubicacion || '',
    mapsUrl: tarea.mapsUrl || '',
    notas: tarea.notas || '',
    prioridad: tarea.prioridad || 'media',
    followUpEnteredAt: tarea.followUpEnteredAt ?? null,
    followUpStatus: tarea.followUpStatus || 'pendiente',
    followUpReminderStepsSent: Array.isArray(tarea.followUpReminderStepsSent) ? tarea.followUpReminderStepsSent : [],
    followUpLastReminderAt: tarea.followUpLastReminderAt || null,
    citaStarted: Boolean(tarea.citaStarted),
    citaFinished: Boolean(tarea.citaFinished),
    designApprovedByAdmin: Boolean(tarea.designApprovedByAdmin),
    designApprovedByClient: Boolean(tarea.designApprovedByClient),
    wallSpecs: Array.isArray(tarea.wallSpecs) ? tarea.wallSpecs : [],
    wallCostEstimate: tarea.wallCostEstimate ?? null,
    visita: visitaData,
    sourceType,
    sourceId,
    clientId: clienteIdResolved,
    codigoCliente: clienteIdResolved,
    codigo: clienteIdResolved,
    cliente: {
        _id: tarea.clienteRef || null,
        id: tarea.clienteRef || null,
        clienteId: clienteIdResolved,
        codigo: clienteIdResolved,
        nombre: tarea.cliente?.nombre || citaData?.nombreCliente || '',
        correo: tarea.cliente?.correo || citaData?.correoCliente || '',
        telefono: tarea.cliente?.telefono || citaData?.telefonoCliente || ''
    },
    clienteRef: tarea.clienteRef || null,
    clienteId: clienteIdResolved,
    inversion,
    inversionTotal: inversion,
    etapaActual,
    timelineActual: etapaActual,
    pagos: pagosState,
    totalPagado,
    saldoPendiente,
    seguimientoNota: String(tarea.seguimientoNota || ''),
    cita: citaData,
    archivos: mappedArchivos,
    archivosPorTipo,
    createdAt: tarea.createdAt,
    updatedAt: tarea.updatedAt
    };
};

const pushHistory = (tarea, req, action, changes = {}) => {
    tarea.historialCambios = tarea.historialCambios || [];
    tarea.historialCambios.push({
        by: req.admin?._id ? String(req.admin._id) : null,
        action,
        changes,
        at: new Date()
    });
};

const validateEnum = (value, allowed, fieldName) => {
    if (value === undefined) return null;
    if (!allowed.includes(value)) return `${fieldName} inválido`;
    return null;
};

const resolveProjectName = async (projectIdLike) => {
    if (!projectIdLike) return { proyectoId: null, nombreProyecto: '' };

    const projectId = String(projectIdLike);
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return { error: 'ID de proyecto inválido' };
    }

    const proyecto = await Proyecto.findById(projectId, 'nombre');
    if (!proyecto) {
        return { proyectoId: projectId, nombreProyecto: '' };
    }

    return { proyectoId: projectId, nombreProyecto: proyecto.nombre || '' };
};

export const obtenerTareas = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const {
            etapa: etapaQuery,
            stage,
            estado,
            asignadoA,
            proyecto,
            prioridad,
            followUpStatus,
            seguimiento,
            estadoSeguimiento
        } = req.query;
        const etapa = etapaQuery || stage;
        const incomingFollowUpStatusQuery = followUpStatus ?? seguimiento ?? estadoSeguimiento;
        const normalizedFollowUpStatusQuery = normalizeFollowUpStatus(incomingFollowUpStatusQuery);

        const errorEtapa = validateEnum(etapa, ETAPAS_VALIDAS, 'Etapa');
        const errorEstado = validateEnum(estado, ESTADOS_VALIDOS, 'Estado');
        const errorPrioridad = validateEnum(prioridad, PRIORIDADES_VALIDAS, 'Prioridad');
        const errorFollow = validateEnum(normalizedFollowUpStatusQuery, FOLLOWUP_STATUS_VALIDOS, 'followUpStatus');

        if (errorEtapa || errorEstado || errorPrioridad || errorFollow) {
            return res.status(400).json({
                success: false,
                message: errorEtapa || errorEstado || errorPrioridad || errorFollow
            });
        }

        const filtros = {};
        if (etapa) filtros.etapa = etapa;
        if (estado) filtros.estado = estado;
        if (prioridad) filtros.prioridad = prioridad;
        if (normalizedFollowUpStatusQuery) filtros.followUpStatus = normalizedFollowUpStatusQuery;

        if (proyecto) filtros.proyectoId = String(proyecto);

        if (asignadoA) {
            filtros.asignadoA = String(asignadoA);
        } else if (isOperativo(req)) {
            filtros.asignadoA = String(req.admin._id);
        }

        const tareas = await Tarea.find(filtros).sort({ updatedAt: -1 });

        return res.json({
            success: true,
            data: tareas.map((item) => mapTask(item, baseUrl))
        });
    } catch (error) {
        console.error('Error al obtener tareas:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener tareas',
            error: error.message
        });
    }
};

export const obtenerTarea = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });

        if (!canViewOrEditTask(req, tarea)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para ver esta tarea' });
        }

        return res.json({ success: true, data: mapTask(tarea, baseUrl) });
    } catch (error) {
        console.error('Error al obtener tarea:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener tarea', error: error.message });
    }
};

export const crearTarea = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const {
            etapa,
            estado,
            asignadoA,
            assignedToIds,
            assignedTo,
            proyecto,
            proyectoId,
            nombreProyecto,
            fechaLimite,
            scheduledAt,
            visitScheduledAt,
            ubicacion,
            mapsUrl,
            wallSpecs,
            wallCostEstimate,
            notas,
            prioridad,
            followUpEnteredAt,
            followUpStatus,
            seguimiento,
            estadoSeguimiento,
            citaStarted,
            citaFinished,
            designApprovedByAdmin,
            designApprovedByClient,
            sourceType,
            sourceId,
            cita,
            visita,
            cliente,
            etapaActual,
            timelineActual,
            nombreCliente,
            correoCliente,
            telefonoCliente,
            sourceCitaId,
            sourceDisenoId,
            pagos,
            inversion,
            inversionTotal,
            seguimientoNota,
            notaSeguimiento
        } = req.body;

        const fechaLimiteParsed = validateDateInput('fechaLimite', fechaLimite);
        if (!fechaLimiteParsed.ok) {
            return res.status(400).json({ success: false, message: fechaLimiteParsed.message });
        }

        const scheduledAtParsed = validateDateInput('scheduledAt', scheduledAt);
        if (!scheduledAtParsed.ok) {
            return res.status(400).json({ success: false, message: scheduledAtParsed.message });
        }

        const visitScheduledAtParsed = validateDateInput('visitScheduledAt', visitScheduledAt);
        if (!visitScheduledAtParsed.ok) {
            return res.status(400).json({ success: false, message: visitScheduledAtParsed.message });
        }

        const visitState = resolveVisitStateFromPayload({
            visita,
            visitScheduledAt,
            designApprovedByAdmin,
            designApprovedByClient
        });
        const visitaParsed = visitState.visitaParsed;
        if (visita !== undefined && visitaParsed?.fechaProgramada === undefined && visita?.fechaProgramada !== undefined && visita?.fechaProgramada !== null && visita?.fechaProgramada !== '') {
            return res.status(400).json({ success: false, message: 'visita.fechaProgramada inválida. Debe ser una fecha válida (ISO recomendado)' });
        }

        const resolvedVisitScheduledAt = visitState.value.fechaProgramada !== undefined
            ? visitState.value.fechaProgramada
            : visitScheduledAtParsed.value;

        const resolvedApprovedByAdmin = visitState.value.aprobadaPorAdmin;

        const resolvedApprovedByClient = visitState.value.aprobadaPorCliente;

        const resolvedVisitaActualizadaEn = visitState.value.actualizadaEn;

        const source = normalizeSource({ sourceType, sourceId, sourceCitaId, sourceDisenoId });
        const incomingCita = cita !== undefined ? normalizeCitaData(cita) : null;
        const normalizedCita = source.sourceType === 'cita' ? incomingCita : null;
        const resolvedCliente = resolveClienteData({
            cliente,
            nombreCliente,
            correoCliente,
            telefonoCliente,
            cita: incomingCita
        });
        const etapaActualResolved = resolveEtapaActualFromPayload({ etapaActual, timelineActual });
        if (etapaActualResolved.error) {
            return res.status(400).json({ success: false, message: etapaActualResolved.error });
        }

        if (source.sourceType && !SOURCE_TYPES_VALIDOS.includes(source.sourceType)) {
            return res.status(400).json({ success: false, message: 'sourceType inválido' });
        }

        if (source.sourceType && !source.sourceId) {
            return res.status(400).json({ success: false, message: 'sourceId es requerido cuando sourceType está definido' });
        }

        if (!ETAPAS_VALIDAS.includes(etapa)) {
            return res.status(400).json({ success: false, message: 'Etapa inválida' });
        }

        if (estado && !ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ success: false, message: 'Estado inválido' });
        }

        if (prioridad && !PRIORIDADES_VALIDAS.includes(prioridad)) {
            return res.status(400).json({ success: false, message: 'Prioridad inválida' });
        }

        const followUpResolved = resolveFollowUpStatusFromPayload({
            followUpStatus,
            seguimiento,
            estadoSeguimiento
        });

        if (followUpResolved.error) {
            return res.status(400).json({ success: false, message: followUpResolved.error });
        }

        const normalizedFollowUpStatus = followUpResolved.value;
        if (normalizedFollowUpStatus && !FOLLOWUP_STATUS_VALIDOS.includes(normalizedFollowUpStatus)) {
            return res.status(400).json({ success: false, message: 'followUpStatus inválido' });
        }

        const normalizedPagos = buildPagosState({}, pagos);
        if (!normalizedPagos.ok) {
            return res.status(400).json({ success: false, message: normalizedPagos.message });
        }

        const inversionResolved = resolveInversionFromPayload({ inversion, inversionTotal });
        if (inversionResolved.error) {
            return res.status(400).json({ success: false, message: inversionResolved.error });
        }

        const targetFollowUpStatus = normalizedFollowUpStatus || 'pendiente';
        if (inversionResolved.hasValue && targetFollowUpStatus !== 'confirmado') {
            return res.status(400).json({ success: false, message: 'Solo se permite guardar inversion cuando followUpStatus es confirmado' });
        }
        if (etapaActualResolved.value && targetFollowUpStatus !== 'confirmado') {
            return res.status(400).json({ success: false, message: 'Solo se permite guardar etapaActual cuando followUpStatus es confirmado' });
        }

        const notaSeguimientoResolved = resolveSeguimientoNotaFromPayload({ seguimientoNota, notaSeguimiento });
        if (!notaSeguimientoResolved.ok) {
            return res.status(400).json({ success: false, message: notaSeguimientoResolved.message });
        }

        const assignedIds = normalizeAssignedIds(asignadoA ?? assignedToIds ?? assignedTo);
        const assignedUsers = await resolveAssignedUsersForCreate(assignedIds, req);
        if (assignedUsers.error) {
            return res.status(404).json({ success: false, message: assignedUsers.error });
        }

        const resolvedAssignedIds = assignedUsers.map((user) => String(user._id));

        if (source.sourceType && source.sourceId) {
            const existentePorOrigen = await Tarea.findOne({
                $or: [
                    { sourceType: source.sourceType, sourceId: source.sourceId },
                    ...(source.sourceType === 'cita' ? [{ sourceCitaId: source.sourceId }] : []),
                    ...(source.sourceType === 'diseno' ? [{ sourceDisenoId: source.sourceId }] : [])
                ]
            });
            if (existentePorOrigen) {
                return res.status(409).json({ success: false, message: `Ya existe una tarea creada para este ${source.sourceType}` });
            }
        }

        const projectResult = await resolveProjectName(proyectoId || proyecto);
        if (projectResult.error) {
            return res.status(400).json({ success: false, message: projectResult.error });
        }

        const nuevaTarea = new Tarea({
            etapa,
            estado: estado || 'pendiente',
            asignadoA: resolvedAssignedIds,
            asignadoANombre: assignedUsers.map((u) => u.nombre),
            proyectoId: projectResult.proyectoId,
            nombreProyecto: nombreProyecto || projectResult.nombreProyecto || '',
            fechaLimite: fechaLimiteParsed.value ?? null,
            scheduledAt: scheduledAtParsed.value ?? null,
            visitScheduledAt: resolvedVisitScheduledAt ?? null,
            ubicacion: ubicacion || '',
            mapsUrl: mapsUrl || '',
            wallSpecs: Array.isArray(wallSpecs) ? wallSpecs : [],
            wallCostEstimate: wallCostEstimate ?? null,
            notas: notas || '',
            prioridad: prioridad || 'media',
            followUpEnteredAt: followUpEnteredAt ?? null,
            followUpStatus: normalizedFollowUpStatus || 'pendiente',
            citaStarted: Boolean(citaStarted),
            citaFinished: Boolean(citaFinished),
            designApprovedByAdmin: resolvedApprovedByAdmin,
            designApprovedByClient: resolvedApprovedByClient,
            visita: {
                fechaProgramada: resolvedVisitScheduledAt ?? null,
                aprobadaPorAdmin: resolvedApprovedByAdmin,
                aprobadaPorCliente: resolvedApprovedByClient,
                actualizadaEn: resolvedVisitaActualizadaEn
            },
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            cita: normalizedCita,
            cliente: resolvedCliente,
            pagos: normalizedPagos.value,
            inversion: inversionResolved.hasValue ? inversionResolved.value : 0,
            etapaActual: etapaActualResolved.value || '',
            seguimientoNota: notaSeguimientoResolved.value || '',
            // Keep legacy IDs synced during transition.
            sourceCitaId: source.sourceType === 'cita' ? source.sourceId : undefined,
            sourceDisenoId: source.sourceType === 'diseno' ? source.sourceId : undefined
        });

        if (nuevaTarea.etapa === 'contrato' && nuevaTarea.followUpStatus === 'pendiente') {
            nuevaTarea.followUpEnteredAt = Date.now();
            nuevaTarea.followUpReminderStepsSent = [];
            nuevaTarea.followUpLastReminderAt = null;
        }

        pushHistory(nuevaTarea, req, 'create', { etapa: nuevaTarea.etapa, estado: nuevaTarea.estado });
        await nuevaTarea.save();
        await upsertTrackingAccessFromTarea(nuevaTarea);

        return res.status(201).json({
            success: true,
            message: 'Tarea creada exitosamente',
            data: mapTask(nuevaTarea, baseUrl)
        });
    } catch (error) {
        console.error('Error al crear tarea:', error);
        return res.status(500).json({ success: false, message: 'Error al crear tarea', error: error.message });
    }
};

export const actualizarTarea = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const { id } = req.params;

        if (!req.admin || req.admin.rol !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Solo un admin puede editar tareas'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) {
            return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
        }

        const {
            etapa,
            stage,
            estado,
            status,
            titulo,
            title,
            notas,
            prioridad,
            followUpStatus,
            seguimiento,
            estadoSeguimiento,
            followUpEnteredAt,
            citaStarted,
            citaFinished,
            designApprovedByAdmin,
            designApprovedByClient,
            sourceType,
            sourceId,
            sourceCitaId,
            sourceDisenoId,
            cita,
            visita,
            cliente,
            etapaActual,
            timelineActual,
            nombreCliente,
            correoCliente,
            telefonoCliente,
            nombreProyecto,
            project,
            fechaLimite,
            dueDate,
            scheduledAt,
            visitScheduledAt,
            ubicacion,
            location,
            mapsUrl,
            wallSpecs,
            wallCostEstimate,
            proyecto,
            proyectoId,
            pagos,
            inversion,
            inversionTotal,
            seguimientoNota,
            notaSeguimiento
        } = req.body || {};

        const incomingFields = [
            etapa,
            stage,
            estado,
            status,
            titulo,
            title,
            notas,
            prioridad,
            followUpStatus,
            seguimiento,
            estadoSeguimiento,
            followUpEnteredAt,
            citaStarted,
            citaFinished,
            designApprovedByAdmin,
            designApprovedByClient,
            sourceType,
            sourceId,
            sourceCitaId,
            sourceDisenoId,
            cita,
            visita,
            cliente,
            etapaActual,
            timelineActual,
            nombreCliente,
            correoCliente,
            telefonoCliente,
            nombreProyecto,
            project,
            fechaLimite,
            dueDate,
            scheduledAt,
            visitScheduledAt,
            ubicacion,
            location,
            mapsUrl,
            wallSpecs,
            wallCostEstimate,
            proyecto,
            proyectoId,
            pagos,
            inversion,
            inversionTotal,
            seguimientoNota,
            notaSeguimiento
        ];

        if (!incomingFields.some((value) => value !== undefined)) {
            return res.status(400).json({
                success: false,
                message: 'Debe proporcionar al menos un campo para actualizar'
            });
        }

        const etapaNormalizada = etapa ?? stage;
        const estadoNormalizado = estado ?? status;
        const fechaLimiteNormalizada = fechaLimite ?? dueDate;
        const ubicacionNormalizada = ubicacion ?? location;
        const nombreProyectoNormalizado = nombreProyecto ?? project ?? titulo ?? title;
        const proyectoRefNormalizado = proyectoId
            ?? (proyecto && mongoose.Types.ObjectId.isValid(String(proyecto)) ? proyecto : undefined)
            ?? (project && !nombreProyectoNormalizado && mongoose.Types.ObjectId.isValid(String(project)) ? project : undefined);

        if (etapaNormalizada !== undefined && !ETAPAS_VALIDAS.includes(etapaNormalizada)) {
            return res.status(400).json({ success: false, message: 'Etapa inválida' });
        }

        if (estadoNormalizado !== undefined && !ESTADOS_VALIDOS.includes(estadoNormalizado)) {
            return res.status(400).json({ success: false, message: 'Estado inválido' });
        }

        if (prioridad !== undefined && !PRIORIDADES_VALIDAS.includes(prioridad)) {
            return res.status(400).json({ success: false, message: 'Prioridad inválida' });
        }

        const dateFields = [
            ['fechaLimite', fechaLimiteNormalizada],
            ['scheduledAt', scheduledAt],
            ['visitScheduledAt', visitScheduledAt]
        ];

        for (const [fieldName, value] of dateFields) {
            if (value === undefined) continue;
            if (value === null || value === '') {
                tarea[fieldName] = null;
                continue;
            }
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ success: false, message: `${fieldName} inválida` });
            }
            tarea[fieldName] = parsed;
        }

        const followUpResolved = resolveFollowUpStatusFromPayload({
            followUpStatus,
            seguimiento,
            estadoSeguimiento
        });
        if (followUpResolved.error) {
            return res.status(400).json({ success: false, message: followUpResolved.error });
        }
        const normalizedFollowUpStatus = followUpResolved.value;
        if (normalizedFollowUpStatus !== undefined && !FOLLOWUP_STATUS_VALIDOS.includes(normalizedFollowUpStatus)) {
            return res.status(400).json({ success: false, message: 'followUpStatus inválido' });
        }

        const resolvedSourceType = sourceType ?? (sourceCitaId ? 'cita' : sourceDisenoId ? 'diseno' : undefined);
        const resolvedSourceId = sourceId ?? sourceCitaId ?? sourceDisenoId;
        if (resolvedSourceType !== undefined && resolvedSourceType !== null && !SOURCE_TYPES_VALIDOS.includes(resolvedSourceType)) {
            return res.status(400).json({ success: false, message: 'sourceType inválido' });
        }
        if (resolvedSourceType !== undefined && resolvedSourceType !== null && !resolvedSourceId) {
            return res.status(400).json({ success: false, message: 'sourceId es requerido cuando sourceType está definido' });
        }

        const normalizedPagos = buildPagosState(tarea.pagos, pagos);
        if (!normalizedPagos.ok) {
            return res.status(400).json({ success: false, message: normalizedPagos.message });
        }

        const inversionResolved = resolveInversionFromPayload({ inversion, inversionTotal });
        if (inversionResolved.error) {
            return res.status(400).json({ success: false, message: inversionResolved.error });
        }
        const etapaActualResolved = resolveEtapaActualFromPayload({ etapaActual, timelineActual });
        if (etapaActualResolved.error) {
            return res.status(400).json({ success: false, message: etapaActualResolved.error });
        }

        const targetFollowUpStatus = normalizedFollowUpStatus !== undefined
            ? normalizedFollowUpStatus
            : tarea.followUpStatus;
        if (inversionResolved.hasValue && targetFollowUpStatus !== 'confirmado') {
            return res.status(400).json({ success: false, message: 'Solo se permite guardar inversion cuando followUpStatus es confirmado' });
        }
        if (etapaActualResolved.value && targetFollowUpStatus !== 'confirmado') {
            return res.status(400).json({ success: false, message: 'Solo se permite guardar etapaActual cuando followUpStatus es confirmado' });
        }

        const notaSeguimientoResolved = resolveSeguimientoNotaFromPayload({ seguimientoNota, notaSeguimiento });
        if (!notaSeguimientoResolved.ok) {
            return res.status(400).json({ success: false, message: notaSeguimientoResolved.message });
        }

        const visitState = resolveVisitStateFromPayload({
            visita,
            visitScheduledAt,
            designApprovedByAdmin,
            designApprovedByClient,
            currentVisita: tarea.visita
        });

        const normalizedCita = cita !== undefined ? normalizeCitaData(cita) : undefined;
        const resolvedCliente = cliente !== undefined || nombreCliente !== undefined || correoCliente !== undefined || telefonoCliente !== undefined
            ? resolveClienteData({
                cliente,
                nombreCliente,
                correoCliente,
                telefonoCliente,
                cita: normalizedCita !== undefined ? normalizedCita : tarea.cita
            })
            : undefined;

        const projectResult = proyectoRefNormalizado !== undefined
            ? await resolveProjectName(proyectoRefNormalizado)
            : null;
        if (projectResult?.error) {
            return res.status(400).json({ success: false, message: projectResult.error });
        }

        const before = {
            etapa: tarea.etapa,
            estado: tarea.estado,
            asignadoA: Array.isArray(tarea.asignadoA) ? [...tarea.asignadoA] : [],
            prioridad: tarea.prioridad,
            followUpStatus: tarea.followUpStatus
        };

        if (etapaNormalizada !== undefined) tarea.etapa = etapaNormalizada;
        if (estadoNormalizado !== undefined) tarea.estado = estadoNormalizado;
        if (notas !== undefined) tarea.notas = String(notas || '');
        if (prioridad !== undefined) tarea.prioridad = prioridad;
        if (normalizedFollowUpStatus !== undefined) tarea.followUpStatus = normalizedFollowUpStatus;
        if (followUpEnteredAt !== undefined) tarea.followUpEnteredAt = followUpEnteredAt;
        if (citaStarted !== undefined) tarea.citaStarted = Boolean(citaStarted);
        if (citaFinished !== undefined) tarea.citaFinished = Boolean(citaFinished);
        tarea.designApprovedByAdmin = visitState.value.aprobadaPorAdmin;
        tarea.designApprovedByClient = visitState.value.aprobadaPorCliente;
        tarea.visitScheduledAt = visitState.value.fechaProgramada ?? null;
        tarea.visita = {
            fechaProgramada: visitState.value.fechaProgramada ?? null,
            aprobadaPorAdmin: visitState.value.aprobadaPorAdmin,
            aprobadaPorCliente: visitState.value.aprobadaPorCliente,
            actualizadaEn: visitState.value.actualizadaEn
        };
        if (resolvedSourceType !== undefined) tarea.sourceType = resolvedSourceType;
        if (resolvedSourceId !== undefined) tarea.sourceId = resolvedSourceId ? String(resolvedSourceId) : null;
        if (resolvedSourceType === 'cita') tarea.sourceCitaId = resolvedSourceId ? String(resolvedSourceId) : undefined;
        if (resolvedSourceType === 'diseno') tarea.sourceDisenoId = resolvedSourceId ? String(resolvedSourceId) : undefined;
        if (normalizedCita !== undefined) tarea.cita = normalizedCita;
        if (resolvedCliente !== undefined) tarea.cliente = resolvedCliente;
        if (nombreProyectoNormalizado !== undefined) tarea.nombreProyecto = String(nombreProyectoNormalizado || '');
        if (wallSpecs !== undefined) tarea.wallSpecs = Array.isArray(wallSpecs) ? wallSpecs : [];
        if (wallCostEstimate !== undefined) tarea.wallCostEstimate = wallCostEstimate ?? null;
        if (ubicacionNormalizada !== undefined) tarea.ubicacion = String(ubicacionNormalizada || '');
        if (mapsUrl !== undefined) tarea.mapsUrl = String(mapsUrl || '');
        if (normalizedPagos !== undefined) tarea.pagos = normalizedPagos.value;
        if (inversionResolved.hasValue) tarea.inversion = inversionResolved.value;
        if (etapaActualResolved.value !== undefined) tarea.etapaActual = etapaActualResolved.value;
        if (notaSeguimientoResolved.value !== undefined) tarea.seguimientoNota = notaSeguimientoResolved.value;
        if (projectResult) {
            tarea.proyectoId = projectResult.proyectoId;
            if (nombreProyectoNormalizado === undefined) tarea.nombreProyecto = projectResult.nombreProyecto || tarea.nombreProyecto;
        }

        if (normalizedFollowUpStatus === 'pendiente' && tarea.etapa === 'contrato' && followUpEnteredAt === undefined) {
            tarea.followUpEnteredAt = Date.now();
            tarea.followUpReminderStepsSent = [];
            tarea.followUpLastReminderAt = null;
        }

        if (normalizedFollowUpStatus === 'confirmado' || normalizedFollowUpStatus === 'inactivo') {
            tarea.followUpReminderStepsSent = [];
            tarea.followUpLastReminderAt = null;
        }

        if (etapaNormalizada !== undefined && etapaNormalizada === 'contrato' && before.etapa !== 'contrato' && tarea.followUpStatus === 'pendiente' && followUpEnteredAt === undefined) {
            tarea.followUpEnteredAt = Date.now();
            tarea.followUpReminderStepsSent = [];
            tarea.followUpLastReminderAt = null;
        }

        pushHistory(tarea, req, 'update', {
            before,
            after: {
                etapa: tarea.etapa,
                estado: tarea.estado,
                asignadoA: tarea.asignadoA,
                prioridad: tarea.prioridad,
                followUpStatus: tarea.followUpStatus
            }
        });

        await tarea.save();
        await upsertTrackingAccessFromTarea(tarea);

        return res.status(200).json({
            success: true,
            message: 'Tarea actualizada exitosamente',
            data: mapTask(tarea, baseUrl)
        });
    } catch (error) {
        console.error('Error al actualizar tarea:', error);
        return res.status(500).json({ success: false, message: 'Error al actualizar tarea', error: error.message });
    }
};

export const asignarTrabajadoresTarea = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const { id } = req.params;
        const { asignadoA, assignedToIds, assignedTo } = req.body || {};

        if (!req.admin || req.admin.rol !== 'admin') {
            return res.status(403).json({ success: false, message: 'Solo un admin puede asignar trabajadores' });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) {
            return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
        }

        const assignedIds = normalizeAssignedIds(asignadoA ?? assignedToIds ?? assignedTo);
        if (!assignedIds.length) {
            return res.status(400).json({ success: false, message: 'Debe proporcionar al menos un responsable' });
        }

        const assignedUsers = await resolveAssignedUsers(assignedIds);
        if (assignedUsers.error) {
            return res.status(404).json({ success: false, message: assignedUsers.error });
        }

        const before = {
            asignadoA: Array.isArray(tarea.asignadoA) ? [...tarea.asignadoA] : [],
            asignadoANombre: Array.isArray(tarea.asignadoANombre) ? [...tarea.asignadoANombre] : []
        };

        tarea.asignadoA = assignedUsers.map((user) => String(user._id));
        tarea.asignadoANombre = assignedUsers.map((user) => user.nombre);

        pushHistory(tarea, req, 'assign_workers', {
            before,
            after: {
                asignadoA: tarea.asignadoA,
                asignadoANombre: tarea.asignadoANombre
            }
        });

        await tarea.save();
        await upsertTrackingAccessFromTarea(tarea);

        return res.status(200).json({
            success: true,
            message: 'Trabajadores asignados exitosamente',
            data: mapTask(tarea, baseUrl)
        });
    } catch (error) {
        console.error('Error al asignar trabajadores a la tarea:', error);
        return res.status(500).json({ success: false, message: 'Error al asignar trabajadores', error: error.message });
    }
};

export const cambiarEtapa = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const { id } = req.params;
        const { etapa } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }

        if (!ETAPAS_VALIDAS.includes(etapa)) {
            return res.status(400).json({ success: false, message: 'Etapa inválida' });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });

        if (!canViewOrEditTask(req, tarea)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar esta tarea' });
        }

        const etapaAnterior = tarea.etapa;
        tarea.etapa = etapa;

        if (etapa === 'contrato' && etapaAnterior !== 'contrato' && tarea.followUpStatus === 'pendiente') {
            tarea.followUpEnteredAt = Date.now();
            tarea.followUpReminderStepsSent = [];
            tarea.followUpLastReminderAt = null;
        }

        pushHistory(tarea, req, 'change_stage', { from: etapaAnterior, to: etapa });
        await tarea.save();

        return res.json({ success: true, message: 'Etapa actualizada exitosamente', data: mapTask(tarea, baseUrl) });
    } catch (error) {
        console.error('Error al cambiar etapa:', error);
        return res.status(500).json({ success: false, message: 'Error al cambiar etapa', error: error.message });
    }
};

export const cambiarEstado = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const { id } = req.params;
        const { estado } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }

        if (!ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ success: false, message: 'Estado inválido' });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });

        if (!canViewOrEditTask(req, tarea)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar esta tarea' });
        }

        const estadoAnterior = tarea.estado;
        tarea.estado = estado;
        pushHistory(tarea, req, 'change_status', { from: estadoAnterior, to: estado });
        await tarea.save();

        return res.json({ success: true, message: 'Estado actualizado exitosamente', data: mapTask(tarea, baseUrl) });
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        return res.status(500).json({ success: false, message: 'Error al cambiar estado', error: error.message });
    }
};

export const agregarArchivos = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const { id } = req.params;
        let { archivos } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });

        if (!canViewOrEditTask(req, tarea)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para agregar archivos a esta tarea' });
        }

        if (req.files && req.files.length > 0) {
            archivos = [];

            const forceDropboxByTaskContext = await shouldForceDropboxByTaskContext(id);
            const tipoRequest = normalizeProcessFileType(req.body?.tipo || 'otro');
            const strictProvider = resolveStrictProviderByType(tipoRequest);

            if (!tarea.clienteId) {
                return res.status(400).json({
                    success: false,
                    message: 'La tarea no tiene clienteId. No se puede relacionar correctamente el archivo.'
                });
            }

            for (const file of req.files) {
                const fileBuffer = fs.readFileSync(file.path);
                const tipo = tipoRequest || normalizeProcessFileType(path.extname(file.originalname) === '.pdf' ? 'otro' : 'diseno');
                const uploadDate = new Date();

                let provider = 'local';
                let url = `${baseUrl}/uploads/tasks/${file.filename}`;
                let key = `local:uploads/tasks/${file.filename}`;

                try {
                    if (strictProvider === 'dropbox' || (!strictProvider && (forceDropboxByTaskContext || shouldUseDropboxForDesign(file.originalname, tipo)))) {
                        const dropboxResult = await uploadFileToDropbox(fileBuffer, file.originalname, 'tareas');
                        provider = 'dropbox';
                        url = dropboxResult.url;
                        key = dropboxResult.key;
                    } else {
                        const cloudinaryResult = await uploadFileToCloudinary(fileBuffer, file.originalname, file.mimetype, 'formal/tareas');
                        provider = 'cloudinary';
                        url = cloudinaryResult.url;
                        key = cloudinaryResult.key;
                    }
                } finally {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (e) {
                        console.warn('No se pudo eliminar archivo temporal local:', file.path, e.message);
                    }
                }

                if (strictProvider === 'dropbox' && provider !== 'dropbox') {
                    return res.status(500).json({ success: false, message: 'Archivo de diseno debe almacenarse en Dropbox' });
                }

                if (strictProvider === 'cloudinary' && provider !== 'cloudinary') {
                    return res.status(500).json({ success: false, message: 'Este tipo de archivo debe almacenarse en Cloudinary' });
                }

                archivos.push({
                    id: String(Date.now()) + Math.random(),
                    nombre: file.originalname,
                    tipo,
                    url,
                    key,
                    provider,
                    mimeType: file.mimetype,
                    clienteId: tarea.clienteId,
                    createdAt: uploadDate
                });
            }
        }

        if (!Array.isArray(archivos) || !archivos.length) {
            return res.status(400).json({ success: false, message: 'Debe enviar al menos un archivo' });
        }

        const archivosNormalizados = archivos.map((archivo) => toTaskFileRecord(archivo, tarea.clienteId));
        tarea.archivos = upsertTaskFiles(tarea.archivos, archivosNormalizados);

        pushHistory(tarea, req, 'add_files', {
            count: archivosNormalizados.length,
            tipos: archivosNormalizados.map((item) => item.tipo)
        });
        await tarea.save();
        await syncFilesWithClienteAndProject({ tarea, archivosNormalizados });

        return res.json({ success: true, message: 'Archivos agregados exitosamente', data: mapTask(tarea, baseUrl) });
    } catch (error) {
        console.error('Error al agregar archivos:', error);
        return res.status(500).json({ success: false, message: 'Error al agregar archivos', error: error.message });
    }
};

export const eliminarTarea = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });

        if (!isStaff(req)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar tareas' });
        }

        await Tarea.findByIdAndDelete(id);
        return res.json({ success: true, message: 'Tarea eliminada exitosamente', data: null });
    } catch (error) {
        console.error('Error al eliminar tarea:', error);
        return res.status(500).json({ success: false, message: 'Error al eliminar tarea', error: error.message });
    }
};

export const actualizarNotas = async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const { id } = req.params;
        const { notas } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });

        if (!canViewOrEditTask(req, tarea)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar esta tarea' });
        }

        tarea.notas = notas || '';
        pushHistory(tarea, req, 'update_notes', { notas: tarea.notas });
        await tarea.save();

        return res.json({ success: true, message: 'Notas actualizadas', data: mapTask(tarea, baseUrl) });
    } catch (error) {
        console.error('Error actualizarNotas:', error);
        return res.status(500).json({ success: false, message: 'Error al actualizar notas', error: error.message });
    }
};
