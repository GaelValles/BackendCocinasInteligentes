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

const ETAPAS_VALIDAS = ['citas', 'disenos', 'cotizacion', 'contrato'];
const ESTADOS_VALIDOS = ['pendiente', 'completada'];
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baja'];
const FOLLOWUP_STATUS_VALIDOS = ['pendiente', 'confirmado', 'inactivo'];
const SOURCE_TYPES_VALIDOS = ['cita', 'diseno'];
const ROLES_OPERATIVOS = ['ingeniero', 'empleado', 'empleado_general', 'staff'];

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

const uploadsDir = path.join(process.cwd(), 'uploads', 'tasks');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
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
    return raw
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') return item;
            if (typeof item === 'object') return item._id || null;
            return null;
        })
        .filter(Boolean)
        .map(String);
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

const resolveAssignedUsers = async (ids) => {
    if (!ids.length) return [];

    for (const id of ids) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return { error: `ID de usuario asignado inválido: ${id}` };
        }
    }

    const users = await Admin.find({ _id: { $in: ids } }, 'nombre');
    if (users.length !== ids.length) {
        return { error: 'Uno o más usuarios asignados no existen' };
    }

    return users;
};

const normalizeSource = (body = {}) => {
    const sourceType = body.sourceType
        || (body.sourceCitaId ? 'cita' : null)
        || (body.sourceDisenoId ? 'diseno' : null);

    const sourceId = body.sourceId
        || body.sourceCitaId
        || body.sourceDisenoId
        || null;

    return {
        sourceType: sourceType || null,
        sourceId: sourceId ? String(sourceId) : null
    };
};

const normalizeCitaData = (raw = {}) => {
    if (!raw || typeof raw !== 'object') return null;
    return {
        fechaAgendada: raw.fechaAgendada ? new Date(raw.fechaAgendada) : null,
        nombreCliente: raw.nombreCliente || '',
        correoCliente: raw.correoCliente || '',
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

const mapTask = (tarea, baseUrl = '') => {
    const sourceType = tarea.sourceType
        || (tarea.sourceCitaId ? 'cita' : null)
        || (tarea.sourceDisenoId ? 'diseno' : null);
    const sourceId = tarea.sourceId || tarea.sourceCitaId || tarea.sourceDisenoId || null;
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
            clienteId: archivo?.clienteId || tarea.clienteId || '',
            createdAt: archivo?.createdAt || null
        }))
        : [];

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
    cliente: {
        nombre: tarea.cliente?.nombre || citaData?.nombreCliente || '',
        correo: tarea.cliente?.correo || citaData?.correoCliente || '',
        telefono: tarea.cliente?.telefono || citaData?.telefonoCliente || ''
    },
    clienteRef: tarea.clienteRef || null,
    clienteId: tarea.clienteId || '',
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
            nombreCliente,
            correoCliente,
            telefonoCliente,
            sourceCitaId,
            sourceDisenoId
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

        const visitaParsed = normalizeVisitaData(visita);
        if (visita !== undefined && visitaParsed?.fechaProgramada === undefined && visita?.fechaProgramada !== undefined && visita?.fechaProgramada !== null && visita?.fechaProgramada !== '') {
            return res.status(400).json({ success: false, message: 'visita.fechaProgramada inválida. Debe ser una fecha válida (ISO recomendado)' });
        }

        const resolvedVisitScheduledAt = visitaParsed?.fechaProgramada !== undefined
            ? visitaParsed.fechaProgramada
            : visitScheduledAtParsed.value;

        const resolvedApprovedByAdmin = visitaParsed?.aprobadaPorAdmin !== undefined
            ? Boolean(visitaParsed.aprobadaPorAdmin)
            : Boolean(designApprovedByAdmin);

        const resolvedApprovedByClient = visitaParsed?.aprobadaPorCliente !== undefined
            ? Boolean(visitaParsed.aprobadaPorCliente)
            : Boolean(designApprovedByClient);

        const resolvedVisitaActualizadaEn = visitaParsed?.actualizadaEn !== undefined
            ? visitaParsed.actualizadaEn
            : (resolvedVisitScheduledAt !== null || resolvedApprovedByAdmin || resolvedApprovedByClient ? new Date() : null);

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

        const assignedIds = normalizeAssignedIds(asignadoA ?? assignedToIds);
        const assignedUsers = await resolveAssignedUsers(assignedIds);
        if (assignedUsers.error) {
            return res.status(404).json({ success: false, message: assignedUsers.error });
        }

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
            asignadoA: assignedIds,
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

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) {
            return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
        }

        if (!canViewOrEditTask(req, tarea)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar esta tarea' });
        }

        const {
            etapa,
            estado,
            asignadoA,
            assignedToIds,
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
            cita,
            visita,
            cliente,
            nombreCliente,
            correoCliente,
            telefonoCliente,
            sourceCitaId,
            sourceDisenoId,
            nombreProyecto,
            fechaLimite,
            scheduledAt,
            visitScheduledAt,
            ubicacion,
            mapsUrl,
            wallSpecs,
            wallCostEstimate,
            proyecto,
            proyectoId
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

        const visitaParsed = normalizeVisitaData(visita);
        if (visita !== undefined && visitaParsed?.fechaProgramada === undefined && visita?.fechaProgramada !== undefined && visita?.fechaProgramada !== null && visita?.fechaProgramada !== '') {
            return res.status(400).json({ success: false, message: 'visita.fechaProgramada inválida. Debe ser una fecha válida (ISO recomendado)' });
        }

        const source = normalizeSource({ sourceType, sourceId, sourceCitaId, sourceDisenoId });

        if (etapa !== undefined && !ETAPAS_VALIDAS.includes(etapa)) {
            return res.status(400).json({ success: false, message: 'Etapa inválida' });
        }

        if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ success: false, message: 'Estado inválido' });
        }

        if (prioridad !== undefined && !PRIORIDADES_VALIDAS.includes(prioridad)) {
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
        if (normalizedFollowUpStatus !== undefined && !FOLLOWUP_STATUS_VALIDOS.includes(normalizedFollowUpStatus)) {
            return res.status(400).json({ success: false, message: 'followUpStatus inválido' });
        }

        if (source.sourceType && !SOURCE_TYPES_VALIDOS.includes(source.sourceType)) {
            return res.status(400).json({ success: false, message: 'sourceType inválido' });
        }

        const before = {
            etapa: tarea.etapa,
            estado: tarea.estado,
            prioridad: tarea.prioridad,
            followUpStatus: tarea.followUpStatus
        };

        if (etapa !== undefined) tarea.etapa = etapa;
        if (estado !== undefined) tarea.estado = estado;
        if (notas !== undefined) tarea.notas = notas;
        if (prioridad !== undefined) tarea.prioridad = prioridad;
        if (normalizedFollowUpStatus !== undefined) tarea.followUpStatus = normalizedFollowUpStatus;
        if (followUpEnteredAt !== undefined) tarea.followUpEnteredAt = followUpEnteredAt;

        // Reactivation business rule: if task goes back to pendiente in contrato,
        // refresh follow-up entry time unless frontend explicitly provided one.
        if (
            normalizedFollowUpStatus === 'pendiente'
            && tarea.etapa === 'contrato'
            && followUpEnteredAt === undefined
        ) {
            tarea.followUpEnteredAt = Date.now();
            tarea.followUpReminderStepsSent = [];
            tarea.followUpLastReminderAt = null;
        }

        if (normalizedFollowUpStatus === 'confirmado' || normalizedFollowUpStatus === 'inactivo') {
            tarea.followUpReminderStepsSent = [];
            tarea.followUpLastReminderAt = null;
        }
        if (citaStarted !== undefined) tarea.citaStarted = Boolean(citaStarted);
        if (citaFinished !== undefined) tarea.citaFinished = Boolean(citaFinished);
        if (designApprovedByAdmin !== undefined) tarea.designApprovedByAdmin = Boolean(designApprovedByAdmin);
        if (designApprovedByClient !== undefined) tarea.designApprovedByClient = Boolean(designApprovedByClient);

        if (sourceType !== undefined || sourceId !== undefined || sourceCitaId !== undefined || sourceDisenoId !== undefined) {
            if (source.sourceType && !source.sourceId) {
                return res.status(400).json({ success: false, message: 'sourceId es requerido cuando sourceType está definido' });
            }
            tarea.sourceType = source.sourceType;
            tarea.sourceId = source.sourceId;
            tarea.sourceCitaId = source.sourceType === 'cita' ? source.sourceId : undefined;
            tarea.sourceDisenoId = source.sourceType === 'diseno' ? source.sourceId : undefined;
        }

        if (cita !== undefined) {
            tarea.cita = normalizeCitaData(cita);
        }

        if (
            cliente !== undefined
            || nombreCliente !== undefined
            || correoCliente !== undefined
            || telefonoCliente !== undefined
            || cita !== undefined
        ) {
            tarea.cliente = resolveClienteData({
                cliente: cliente !== undefined ? cliente : tarea.cliente,
                nombreCliente,
                correoCliente,
                telefonoCliente,
                cita: cita !== undefined ? tarea.cita : undefined
            });
        }

        if (nombreProyecto !== undefined) tarea.nombreProyecto = nombreProyecto || '';
        if (fechaLimite !== undefined) tarea.fechaLimite = fechaLimiteParsed.value;
        if (scheduledAt !== undefined) tarea.scheduledAt = scheduledAtParsed.value;
        if (visitScheduledAt !== undefined) tarea.visitScheduledAt = visitScheduledAtParsed.value;

        const shouldTouchVisita = visita !== undefined
            || visitScheduledAt !== undefined
            || designApprovedByAdmin !== undefined
            || designApprovedByClient !== undefined;

        if (shouldTouchVisita) {
            tarea.visita = tarea.visita || {};

            if (visitaParsed?.fechaProgramada !== undefined) {
                tarea.visitScheduledAt = visitaParsed.fechaProgramada;
            }

            if (visitaParsed?.aprobadaPorAdmin !== undefined) {
                tarea.designApprovedByAdmin = Boolean(visitaParsed.aprobadaPorAdmin);
            }

            if (visitaParsed?.aprobadaPorCliente !== undefined) {
                tarea.designApprovedByClient = Boolean(visitaParsed.aprobadaPorCliente);
            }

            tarea.visita.fechaProgramada = tarea.visitScheduledAt ?? null;
            tarea.visita.aprobadaPorAdmin = Boolean(tarea.designApprovedByAdmin);
            tarea.visita.aprobadaPorCliente = Boolean(tarea.designApprovedByClient);
            tarea.visita.actualizadaEn = visitaParsed?.actualizadaEn !== undefined
                ? visitaParsed.actualizadaEn
                : new Date();
        }

        if (ubicacion !== undefined) tarea.ubicacion = ubicacion || '';
        if (mapsUrl !== undefined) tarea.mapsUrl = mapsUrl || '';
        if (wallSpecs !== undefined) tarea.wallSpecs = Array.isArray(wallSpecs) ? wallSpecs : [];
        if (wallCostEstimate !== undefined) tarea.wallCostEstimate = wallCostEstimate ?? null;

        if (asignadoA !== undefined || assignedToIds !== undefined) {
            const assignedIds = normalizeAssignedIds(asignadoA ?? assignedToIds);
            const assignedUsers = await resolveAssignedUsers(assignedIds);
            if (assignedUsers.error) {
                return res.status(404).json({ success: false, message: assignedUsers.error });
            }
            tarea.asignadoA = assignedIds;
            tarea.asignadoANombre = assignedUsers.map((u) => u.nombre);
        }

        if (proyecto !== undefined || proyectoId !== undefined) {
            const projectResult = await resolveProjectName(proyectoId || proyecto);
            if (projectResult.error) {
                return res.status(400).json({ success: false, message: projectResult.error });
            }
            tarea.proyectoId = projectResult.proyectoId;
            if (!nombreProyecto) {
                tarea.nombreProyecto = projectResult.nombreProyecto || tarea.nombreProyecto;
            }
        }

        if (
            etapa !== undefined
            && etapa === 'contrato'
            && before.etapa !== 'contrato'
            && tarea.followUpStatus === 'pendiente'
            && followUpEnteredAt === undefined
        ) {
            tarea.followUpEnteredAt = Date.now();
            tarea.followUpReminderStepsSent = [];
            tarea.followUpLastReminderAt = null;
        }

        pushHistory(tarea, req, 'update', { before, after: { etapa: tarea.etapa, estado: tarea.estado, prioridad: tarea.prioridad, followUpStatus: tarea.followUpStatus } });
        await tarea.save();
        await upsertTrackingAccessFromTarea(tarea);

        return res.json({ success: true, message: 'Tarea actualizada exitosamente', data: mapTask(tarea, baseUrl) });
    } catch (error) {
        console.error('Error al actualizar tarea:', error);
        return res.status(500).json({ success: false, message: 'Error al actualizar tarea', error: error.message });
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
