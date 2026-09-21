import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Proyecto from '../models/proyecto.model.js';
import Tarea from '../models/tarea.model.js';
import TrackingAccess from '../models/trackingAccess.model.js';
import ClienteArchivo from '../models/clienteArchivo.model.js';
import ClienteIdentidad from '../models/clienteIdentidad.model.js';
import {
    normalizeCodigoInput,
    findEnabledAccessByCodigo6,
    bootstrapTrackingAccessByCodigo6,
    getCodigo6FromProyecto,
    getCodigo6FromTarea
} from '../services/trackingAccess.service.js';

const TRACKING_SCOPE = 'tracking:read';
const rateLimitStore = new Map();

const TRACKING_RATE_LIMIT_IP_MAX = Number(process.env.TRACKING_RATE_LIMIT_IP_MAX || 10);
const TRACKING_RATE_LIMIT_IP_WINDOW_MIN = Number(process.env.TRACKING_RATE_LIMIT_IP_WINDOW_MIN || 10);
const TRACKING_RATE_LIMIT_CODE_MAX = Number(process.env.TRACKING_RATE_LIMIT_CODE_MAX || 5);
const TRACKING_RATE_LIMIT_CODE_WINDOW_MIN = Number(process.env.TRACKING_RATE_LIMIT_CODE_WINDOW_MIN || 5);

const getTrackingSecret = () => process.env.TRACKING_JWT_SECRET || process.env.TOKEN_SECRET || 'tracking-secret-dev';
const getTrackingTTL = () => process.env.TRACKING_JWT_TTL || '30m';

const buildKey = (scope, value) => `tracking:${scope}:${value}`;

const registerAttempt = ({ scope, value, max, windowMinutes }) => {
    const now = Date.now();
    const key = buildKey(scope, value);
    const windowMs = windowMinutes * 60 * 1000;

    const current = rateLimitStore.get(key);
    if (!current || current.expiresAt <= now) {
        const next = { count: 1, expiresAt: now + windowMs };
        rateLimitStore.set(key, next);
        return { blocked: false, remaining: Math.max(0, max - next.count) };
    }

    current.count += 1;
    rateLimitStore.set(key, current);

    if (current.count > max) {
        return { blocked: true, retryAfterMs: current.expiresAt - now };
    }

    return { blocked: false, remaining: Math.max(0, max - current.count) };
};

const clearRateLimit = ({ scope, value }) => {
    rateLimitStore.delete(buildKey(scope, value));
};

const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
};

const toDateOrNull = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateSimple = (value) => {
    const date = toDateOrNull(value);
    if (!date) return '';

    return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'long'
    }).format(date);
};

const formatDateISO = (value) => {
    const date = toDateOrNull(value);
    return date ? date.toISOString().slice(0, 10) : '';
};

const resolveCodigoFromBody = (body = {}) => {
    return body?.codigo ?? body?.code ?? body?.clienteId ?? '';
};

const mapArchivos = (archivos = []) => {
    return (Array.isArray(archivos) ? archivos : []).map((archivo) => {
        const nombre = archivo?.nombre || '';
        const lowerName = String(nombre).toLowerCase();
        let tipo = archivo?.tipo || '';

        if (!tipo) {
            if (lowerName.endsWith('.pdf')) tipo = 'pdf';
            else if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp')) tipo = 'img';
            else tipo = 'archivo';
        }

        return {
            id: archivo?._id ? String(archivo._id) : `${nombre}-${archivo?.createdAt || Date.now()}`,
            nombre,
            tipo,
            url: archivo?.url || ''
        };
    });
};

const TRACKING_RECEIPT_TYPES = new Set(['recibo_1', 'recibo_2', 'recibo_3']);

const normalizeTrackingFile = (archivo = {}) => {
    const tipo = String(archivo?.tipo || '').trim() || 'archivo';
    return {
        id: archivo?._id ? String(archivo._id) : String(archivo?.id || `${archivo?.nombre || 'archivo'}-${archivo?.createdAt || Date.now()}`),
        nombre: String(archivo?.nombre || ''),
        tipo,
        url: String(archivo?.url || '')
    };
};

const mergeTrackingFiles = (...fileGroups) => {
    const merged = [];
    const seen = new Set();

    for (const group of fileGroups) {
        for (const raw of (Array.isArray(group) ? group : [])) {
            const item = normalizeTrackingFile(raw);
            if (!item.url) continue;

            const dedupKey = `${item.tipo}::${item.url}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);
            merged.push(item);
        }
    }

    return merged;
};

const buildTaskReceiptIndex = (archivos = []) => {
    const index = {};
    for (const raw of (Array.isArray(archivos) ? archivos : [])) {
        const item = normalizeTrackingFile(raw);
        if (!TRACKING_RECEIPT_TYPES.has(item.tipo) || !item.url) continue;
        if (!index[item.tipo]) index[item.tipo] = item;
    }
    return index;
};

const buildClientReceiptIndex = (archivos = []) => {
    const index = {};
    for (const raw of (Array.isArray(archivos) ? archivos : [])) {
        const tipo = String(raw?.tipo || '').trim();
        const url = String(raw?.url || '').trim();
        if (!TRACKING_RECEIPT_TYPES.has(tipo) || !url) continue;
        if (!index[tipo]) {
            index[tipo] = {
                id: raw?._id ? String(raw._id) : `${tipo}-${raw?.createdAt || Date.now()}`,
                nombre: String(raw?.nombre || ''),
                tipo,
                url
            };
        }
    }
    return index;
};

const buildPagosDto = ({ proyecto, tarea, receiptIndex = {} } = {}) => {
    const defaultDto = {
        amount: 0,
        date: '',
        receiptLabel: 'Ver recibo',
        receiptImage: ''
    };

    const slots = [
        ['anticipo', 'recibo_1'],
        ['segundoPago', 'recibo_2'],
        ['liquidacion', 'recibo_3']
    ];

    const out = {};

    for (const [slot, receiptType] of slots) {
        const taskSlot = tarea?.pagos?.[slot] || {};
        const projectSlot = proyecto?.pagos?.[slot] || {};
        const fallbackReceipt = receiptIndex[receiptType]?.url || '';

        const fallbackAmount = Number(slot === 'anticipo'
            ? proyecto?.anticipo
            : slot === 'segundoPago'
                ? proyecto?.segundoPago
                : proyecto?.liquidacion);

        out[slot] = {
            amount: Number.isFinite(Number(taskSlot?.amount))
                ? Number(taskSlot.amount)
                : (Number.isFinite(Number(projectSlot?.amount))
                    ? Number(projectSlot.amount)
                    : (Number.isFinite(fallbackAmount) ? fallbackAmount : defaultDto.amount)),
            date: String(taskSlot?.date || projectSlot?.date || defaultDto.date),
            receiptLabel: String(taskSlot?.receiptLabel || projectSlot?.receiptLabel || defaultDto.receiptLabel),
            receiptImage: String(taskSlot?.receiptImage || projectSlot?.receiptImage || fallbackReceipt || defaultDto.receiptImage)
        };
    }

    return out;
};

const resolveInversionForTracking = ({ proyecto, tarea } = {}) => {
    const inversionTarea = Number(tarea?.inversion);
    if (Number.isFinite(inversionTarea) && inversionTarea > 0) {
        return inversionTarea;
    }

    const inversionProyecto = Number(proyecto?.presupuestoTotal);
    if (Number.isFinite(inversionProyecto) && inversionProyecto > 0) {
        return inversionProyecto;
    }

    return Number.isFinite(inversionTarea) ? inversionTarea : 0;
};

const calculatePagosSummary = (pagos = {}) => {
    const slots = ['anticipo', 'segundoPago', 'liquidacion'];
    const totalPagado = slots.reduce((acc, slot) => {
        const amount = Number(pagos?.[slot]?.amount ?? 0);
        return acc + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    return { totalPagado };
};

const resolveProjectByCodigo6 = async (codigo6) => {
    if (!codigo6 || String(codigo6).length !== 6) return null;

    const byClienteId = await Proyecto.findOne({ clienteId: codigo6 })
        .populate('cliente', 'nombre')
        .sort({ updatedAt: -1 })
        .lean();

    if (byClienteId) return byClienteId;

    const [proyecto] = await Proyecto.aggregate([
        {
            $addFields: {
                _projectIdStr: { $toString: '$_id' },
                _clientIdStr: { $toString: '$cliente' }
            }
        },
        {
            $addFields: {
                _projectCode6: { $toUpper: { $substr: ['$_projectIdStr', 0, 6] } },
                _clientCode6: { $toUpper: { $substr: ['$_clientIdStr', 0, 6] } }
            }
        },
        {
            $match: {
                $or: [
                    { _projectCode6: codigo6 },
                    { _clientCode6: codigo6 }
                ]
            }
        },
        { $project: { _projectIdStr: 0, _clientIdStr: 0, _projectCode6: 0, _clientCode6: 0 } },
        { $limit: 1 }
    ]);

    if (!proyecto?._id) return null;

    return Proyecto.findById(proyecto._id)
        .populate('cliente', 'nombre')
        .lean();
};

const resolveProjectForAccess = async (access) => {
    if (!access) return null;

    if (access.projectId && mongoose.Types.ObjectId.isValid(String(access.projectId))) {
        const proyecto = await Proyecto.findById(access.projectId)
            .populate('cliente', 'nombre')
            .lean();
        if (proyecto) return proyecto;
    }

    if (access.taskId) {
        const taskId = String(access.taskId);
        if (mongoose.Types.ObjectId.isValid(taskId)) {
            const tarea = await Tarea.findById(taskId).lean();
            if (tarea?.proyectoId && mongoose.Types.ObjectId.isValid(String(tarea.proyectoId))) {
                const proyecto = await Proyecto.findById(tarea.proyectoId)
                    .populate('cliente', 'nombre')
                    .lean();
                if (proyecto) return proyecto;
            }
        }
    }

    if (access.clientId) {
        const proyectoByClient = await Proyecto.findOne({
            $or: [
                { clienteRef: access.clientId },
                { clienteId: access.codigo6 }
            ]
        })
            .populate('cliente', 'nombre')
            .sort({ updatedAt: -1 })
            .lean();

        if (proyectoByClient) return proyectoByClient;
    }

    // Fallback crítico: si el access existe pero no resuelve por IDs,
    // buscar por coincidencia de los primeros 6 caracteres del ObjectId.
    const fallbackProyecto = await resolveProjectByCodigo6(access.codigo6);
    if (fallbackProyecto) {
        return fallbackProyecto;
    }

    return null;
};

const resolveTaskForAccess = async (access) => {
    if (!access) return null;

    if (access.taskId && mongoose.Types.ObjectId.isValid(String(access.taskId))) {
        const byTaskId = await Tarea.findById(access.taskId).lean();
        if (byTaskId) return byTaskId;
    }

    const filters = [];

    if (access.clientId) {
        filters.push({ clienteRef: access.clientId });
    }

    if (access.codigo6) {
        filters.push({ clienteId: access.codigo6 });
    }

    if (!filters.length) return null;

    return Tarea.findOne({ $or: filters })
        .sort({ updatedAt: -1 })
        .lean();
};

const buildProjectSnapshot = async (access) => {
    const proyecto = await resolveProjectForAccess(access);
    if (!proyecto) {
        const tarea = await resolveTaskForAccess(access);
        if (!tarea) return null;

        // Usar clienteId de la tarea (ya contiene código de clienteIdentidad)
        const codigoClienteIdentidad = String(tarea?.clienteId || access?.codigo6 || '').trim().toUpperCase();
        const clientReceipts = codigoClienteIdentidad
            ? await ClienteArchivo.find({ clienteId: codigoClienteIdentidad, tipo: { $in: Array.from(TRACKING_RECEIPT_TYPES) } })
                .sort({ createdAt: -1 })
                .lean()
            : [];
        const receiptIndex = {
            ...buildTaskReceiptIndex(tarea?.archivos),
            ...buildClientReceiptIndex(clientReceipts)
        };

        const clienteNombre = tarea.cliente?.nombre || tarea.cita?.nombreCliente || 'Cliente';
        const pagos = buildPagosDto({ tarea, receiptIndex });
        const inversion = resolveInversionForTracking({ tarea });
        const { totalPagado } = calculatePagosSummary(pagos);
        const saldoPendiente = Math.max(inversion - totalPagado, 0);

        const kanbanStage = tarea.etapa || '';
        const kanbanFollowUpStatus = tarea.followUpStatus || 'pendiente';

        return {
            codigo: codigoClienteIdentidad,
            cliente: clienteNombre,
            nombre: clienteNombre,
            titulo: tarea.nombreProyecto || 'Proyecto de cocina',
            isProspect: true,
            kanbanStage,
            kanbanFollowUpStatus,
            inversion,
            inversionTotal: inversion,
            fechaInicio: formatDateSimple(tarea.createdAt),
            fechaEntrega: formatDateSimple(tarea.updatedAt),
            garantiaInicio: formatDateISO(tarea.updatedAt),
            estadoProyecto: tarea.estado || 'pendiente',
            etapaActual: tarea.etapaActual || tarea.etapa || 'Diseño Aprobado',
            timelineActual: tarea.etapaActual || tarea.etapa || 'Diseño Aprobado',
            followUpStatus: tarea.followUpStatus || 'pendiente',
            pagos,
            totalPagado,
            saldoPendiente,
            seguimientoNota: String(tarea.seguimientoNota || ''),
            archivos: mergeTrackingFiles(tarea.archivos, clientReceipts),
            cotizacionPreliminarImage: '',
            cotizacionFormalImage: '',
            cotizacionesFormales: [],
            cotizacionFormalData: [],
            preliminarCotizaciones: [],
            preliminarData: [],
            projectId: tarea.proyectoId || null,
            taskId: String(tarea._id)
        };
    }

    const ultimaTarea = await Tarea.findOne({ proyectoId: String(proyecto._id) })
        .sort({ updatedAt: -1 })
        .lean();

    // Usar clienteId del proyecto (ya contiene código de clienteIdentidad)
    const codigoClienteIdentidad = String(proyecto?.clienteId || access?.codigo6 || ultimaTarea?.clienteId || '').trim().toUpperCase();
    const clientReceipts = codigoClienteIdentidad
        ? await ClienteArchivo.find({ clienteId: codigoClienteIdentidad, tipo: { $in: Array.from(TRACKING_RECEIPT_TYPES) } })
            .sort({ createdAt: -1 })
            .lean()
        : [];

    const receiptIndex = {
        ...buildTaskReceiptIndex(proyecto.archivos),
        ...buildTaskReceiptIndex(ultimaTarea?.archivos),
        ...buildClientReceiptIndex(clientReceipts)
    };

    const archivos = mergeTrackingFiles(proyecto.archivosPublicos, proyecto.archivos, ultimaTarea?.archivos, clientReceipts);
    const cotizacionPreliminarImage = archivos.find((a) => String(a.nombre).toLowerCase().includes('preliminar'))?.url || '';
    const cotizacionFormalImage = archivos.find((a) => String(a.nombre).toLowerCase().includes('formal'))?.url || '';
    const pagos = buildPagosDto({ proyecto, tarea: ultimaTarea, receiptIndex });
    const inversion = resolveInversionForTracking({ proyecto, tarea: ultimaTarea });
    const { totalPagado } = calculatePagosSummary(pagos);
    const saldoPendiente = Math.max(inversion - totalPagado, 0);

    const kanbanStage = ultimaTarea?.etapa || '';
    const kanbanFollowUpStatus = ultimaTarea?.followUpStatus || 'pendiente';
    const isProspect = !(kanbanFollowUpStatus === 'confirmado'
        || (kanbanStage === 'contrato' && kanbanFollowUpStatus !== 'inactivo'));

    return {
        codigo: codigoClienteIdentidad,
        cliente: proyecto.nombreCliente || proyecto.cliente?.nombre || 'Cliente',
        nombre: proyecto.nombreCliente || proyecto.cliente?.nombre || 'Cliente',
        titulo: proyecto.nombre || 'Proyecto de cocina',
        isProspect,
        kanbanStage,
        kanbanFollowUpStatus,
        inversion,
        inversionTotal: inversion,
        fechaInicio: formatDateSimple(proyecto.createdAt),
        fechaEntrega: formatDateSimple(proyecto.updatedAt),
        garantiaInicio: formatDateISO(proyecto.updatedAt),
        estadoProyecto: proyecto.estado || 'cotizacion',
            etapaActual: ultimaTarea?.etapaActual || proyecto.timelineActual || ultimaTarea?.etapa || 'Diseño Aprobado',
            timelineActual: ultimaTarea?.etapaActual || proyecto.timelineActual || ultimaTarea?.etapa || 'Diseño Aprobado',
        followUpStatus: ultimaTarea?.followUpStatus || 'pendiente',
        pagos,
        totalPagado,
        saldoPendiente,
        seguimientoNota: String(ultimaTarea?.seguimientoNota || proyecto?.seguimientoNota || ''),
        archivos,
        cotizacionPreliminarImage,
        cotizacionFormalImage,
        cotizacionesFormales: [],
        cotizacionFormalData: [],
        preliminarCotizaciones: [],
        preliminarData: [],
        projectId: String(proyecto._id)
    };
};

const signTrackingToken = (access) => {
    const ttl = getTrackingTTL();

    const token = jwt.sign({
        sub: String(access._id),
        scope: TRACKING_SCOPE,
        codigo6: access.codigo6
    }, getTrackingSecret(), { expiresIn: ttl });

    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;

    return { token, expiresAt };
};

export const loginSeguimiento = async (req, res) => {
    try {
        const codigo = normalizeCodigoInput(resolveCodigoFromBody(req.body));
        const ip = getClientIp(req);

        console.log(`[DEBUG] Login seguimiento intento: codigo=${codigo}, longitud=${codigo.length}, ip=${ip}`);

        const ipLimit = registerAttempt({
            scope: 'ip',
            value: ip,
            max: TRACKING_RATE_LIMIT_IP_MAX,
            windowMinutes: TRACKING_RATE_LIMIT_IP_WINDOW_MIN
        });

        if (ipLimit.blocked) {
            console.log(`[DEBUG] Login bloqueado por IP: ${ip}`);
            return res.status(429).json({ success: false, message: 'Demasiados intentos. Intenta mas tarde' });
        }

        if (codigo.length !== 6) {
            console.log(`[DEBUG] Código rechazado por longitud: ${codigo.length} (esperado 6)`);
            registerAttempt({
                scope: 'code',
                value: 'invalid-length',
                max: TRACKING_RATE_LIMIT_CODE_MAX,
                windowMinutes: TRACKING_RATE_LIMIT_CODE_WINDOW_MIN
            });
            return res.status(401).json({ success: false, message: 'Codigo invalido' });
        }

        let access = await findEnabledAccessByCodigo6(codigo);
        console.log(`[DEBUG] Búsqueda directa en DB: encontrado=${!!access}`);

        if (!access) {
            console.log(`[DEBUG] Iniciando bootstrap para código ${codigo}...`);
            access = await bootstrapTrackingAccessByCodigo6(codigo);
            console.log(`[DEBUG] Bootstrap resultado: encontrado=${!!access}`);
        }

        if (!access) {
            console.log(`[DEBUG] Acceso no encontrado después de DB + bootstrap`);
            const codeLimit = registerAttempt({
                scope: 'code',
                value: codigo,
                max: TRACKING_RATE_LIMIT_CODE_MAX,
                windowMinutes: TRACKING_RATE_LIMIT_CODE_WINDOW_MIN
            });

            if (codeLimit.blocked) {
                console.log(`[DEBUG] Código bloqueado por intentos: ${codigo}`);
                return res.status(429).json({ success: false, message: 'Demasiados intentos. Intenta mas tarde' });
            }

            return res.status(401).json({ success: false, message: 'Codigo invalido' });
        }

        const snapshot = await buildProjectSnapshot(access);
        if (!snapshot) {
            console.log(`[DEBUG] Snapshot es null para access ${access._id}`);
            return res.status(401).json({ success: false, message: 'Codigo invalido' });
        }

        const { token, expiresAt } = signTrackingToken(access);

        clearRateLimit({ scope: 'code', value: codigo });

        console.log(`[DEBUG] Login exitoso para código ${codigo}, proyecto ${snapshot.projectId}`);

        return res.status(200).json({
            success: true,
            data: {
                token,
                expiresAt,
                project: snapshot
            }
        });
    } catch (error) {
        console.error('Error en login de seguimiento:', error);
        return res.status(500).json({ success: false, message: 'Error al iniciar sesion de seguimiento', error: error.message });
    }
};

export const getProyectoSeguimiento = async (req, res) => {
    try {
        const access = req.tracking?.access;
        const snapshot = await buildProjectSnapshot(access);

        if (!snapshot) {
            return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }

        return res.status(200).json({ success: true, data: snapshot });
    } catch (error) {
        console.error('Error al obtener seguimiento de proyecto:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener seguimiento', error: error.message });
    }
};

export const getArchivosSeguimiento = async (req, res) => {
    try {
        const access = req.tracking?.access;
        const proyecto = await resolveProjectForAccess(access);

        if (!proyecto) {
            const tarea = await resolveTaskForAccess(access);
            if (!tarea) {
                return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
            }

            const clienteCodigo = String(tarea?.clienteId || access?.codigo6 || '').trim().toUpperCase();
            const clientReceipts = clienteCodigo
                ? await ClienteArchivo.find({ clienteId: clienteCodigo, tipo: { $in: Array.from(TRACKING_RECEIPT_TYPES) } })
                    .sort({ createdAt: -1 })
                    .lean()
                : [];

            return res.status(200).json({ success: true, data: mergeTrackingFiles(tarea.archivos, clientReceipts) });
        }

        const ultimaTarea = await Tarea.findOne({ proyectoId: String(proyecto._id) })
            .sort({ updatedAt: -1 })
            .lean();

        const clienteCodigo = String(proyecto?.clienteId || access?.codigo6 || ultimaTarea?.clienteId || '').trim().toUpperCase();
        const clientReceipts = clienteCodigo
            ? await ClienteArchivo.find({ clienteId: clienteCodigo, tipo: { $in: Array.from(TRACKING_RECEIPT_TYPES) } })
                .sort({ createdAt: -1 })
                .lean()
            : [];

        return res.status(200).json({
            success: true,
            data: mergeTrackingFiles(proyecto.archivosPublicos, proyecto.archivos, ultimaTarea?.archivos, clientReceipts)
        });
    } catch (error) {
        console.error('Error al obtener archivos de seguimiento:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener archivos', error: error.message });
    }
};

export const getPagosSeguimiento = async (req, res) => {
    try {
        const access = req.tracking?.access;
        const proyecto = await resolveProjectForAccess(access);

        if (!proyecto) {
            const tarea = await resolveTaskForAccess(access);
            if (!tarea) {
                return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
            }

            const clienteCodigo = String(tarea?.clienteId || access?.codigo6 || '').trim().toUpperCase();
            const clientReceipts = clienteCodigo
                ? await ClienteArchivo.find({ clienteId: clienteCodigo, tipo: { $in: Array.from(TRACKING_RECEIPT_TYPES) } })
                    .sort({ createdAt: -1 })
                    .lean()
                : [];
            const receiptIndex = {
                ...buildTaskReceiptIndex(tarea?.archivos),
                ...buildClientReceiptIndex(clientReceipts)
            };

            return res.status(200).json({ success: true, data: buildPagosDto({ tarea, receiptIndex }) });
        }

        const ultimaTarea = await Tarea.findOne({ proyectoId: String(proyecto._id) })
            .sort({ updatedAt: -1 })
            .lean();

        const clienteCodigo = String(proyecto?.clienteId || access?.codigo6 || ultimaTarea?.clienteId || '').trim().toUpperCase();
        const clientReceipts = clienteCodigo
            ? await ClienteArchivo.find({ clienteId: clienteCodigo, tipo: { $in: Array.from(TRACKING_RECEIPT_TYPES) } })
                .sort({ createdAt: -1 })
                .lean()
            : [];
        const receiptIndex = {
            ...buildTaskReceiptIndex(proyecto.archivos),
            ...buildTaskReceiptIndex(ultimaTarea?.archivos),
            ...buildClientReceiptIndex(clientReceipts)
        };

        return res.status(200).json({ success: true, data: buildPagosDto({ proyecto, tarea: ultimaTarea, receiptIndex }) });
    } catch (error) {
        console.error('Error al obtener pagos de seguimiento:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener pagos', error: error.message });
    }
};

export const logoutSeguimiento = async (req, res) => {
    return res.status(200).json({ success: true, message: 'Sesion de seguimiento finalizada' });
};

export const actualizarEstatusPublico = async (req, res) => {
    try {
        const rol = String(req.admin?.rol || '').toLowerCase();
        if (!['admin', 'arquitecto', 'empleado', 'empleado_general', 'ingeniero', 'staff'].includes(rol)) {
            return res.status(403).json({ success: false, message: 'No autorizado para actualizar el estatus público' });
        }

        const codigo6 = normalizeCodigoInput(req.params.codigo);
        if (codigo6.length !== 6) {
            return res.status(400).json({ success: false, message: 'Código de cliente inválido' });
        }

        const access = await findEnabledAccessByCodigo6(codigo6);
        const projectId = access?.projectId && mongoose.Types.ObjectId.isValid(String(access.projectId))
            ? String(access.projectId)
            : null;
        let proyecto = projectId ? await Proyecto.findById(projectId) : await Proyecto.findOne({ clienteId: codigo6 }).sort({ updatedAt: -1 });
        if (!proyecto) {
            return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }

        const { estadoProyecto, etapaActual, fechaInicio, fechaEntrega, garantiaInicio, inversion, pagos, seguimientoNota } = req.body || {};
        const allowedProjectStates = ['cotizacion', 'aprobado', 'en_produccion', 'instalando', 'completado'];
        if (estadoProyecto !== undefined) {
            const stateMap = {
                'cliente confirmado': 'aprobado',
                'cotización': 'cotizacion',
                'cotizacion': 'cotizacion',
                'en producción': 'en_produccion',
                'en_produccion': 'en_produccion',
                'instalación': 'instalando',
                'instalando': 'instalando',
                'completado': 'completado'
            };
            const normalizedState = String(estadoProyecto).trim().toLowerCase();
            proyecto.estado = stateMap[normalizedState] || (allowedProjectStates.includes(normalizedState) ? normalizedState : proyecto.estado);
        }
        if (etapaActual !== undefined) proyecto.timelineActual = String(etapaActual || '').trim();
        if (inversion !== undefined && Number.isFinite(Number(inversion))) proyecto.presupuestoTotal = Number(inversion);
        if (pagos && typeof pagos === 'object') {
            for (const slot of ['anticipo', 'segundoPago', 'liquidacion']) {
                if (pagos[slot] !== undefined) proyecto.pagos[slot] = pagos[slot];
            }
        }
        if (seguimientoNota !== undefined) proyecto.seguimientoNota = String(seguimientoNota || '').trim();
        await proyecto.save();

        const tarea = await Tarea.findOne({ proyectoId: String(proyecto._id) }).sort({ updatedAt: -1 });
        if (tarea) {
            if (etapaActual !== undefined) tarea.etapaActual = String(etapaActual || '').trim();
            if (seguimientoNota !== undefined) tarea.seguimientoNota = String(seguimientoNota || '').trim();
            if (estadoProyecto !== undefined && String(estadoProyecto).trim().toLowerCase() === 'cliente confirmado') {
                tarea.followUpStatus = 'confirmado';
            }
            await tarea.save();
        }

        const refreshedAccess = access || await findEnabledAccessByCodigo6(codigo6);
        const project = refreshedAccess ? await buildProjectSnapshot(refreshedAccess) : null;
        return res.json({ success: true, message: 'Estatus público actualizado', data: { project } });
    } catch (error) {
        console.error('Error actualizando estatus público:', error);
        return res.status(500).json({ success: false, message: 'Error al actualizar estatus público' });
    }
};

/**
 * DEBUG: Listar todos los proyectos con su código6 calculado
 * GET /api/seguimiento/debug/proyectos
 * SOLO para desarrollo - sin autenticación
 */
export const debugProyectos = async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ success: false, message: 'Debug no disponible en producción' });
        }

        const proyectos = await Proyecto.find({})
            .select('_id nombre cliente nombreCliente estado')
            .populate('cliente', 'nombre')
            .limit(100)
            .lean();

        const results = proyectos.map((proyecto) => ({
            _id: String(proyecto._id),
            nombre: proyecto.nombre,
            cliente: String(proyecto.cliente?._id || proyecto.cliente || 'N/A'),
            nombreCliente: proyecto.nombreCliente || proyecto.cliente?.nombre || '',
            codigo6Calculado: getCodigo6FromProyecto(proyecto),
            estado: proyecto.estado
        }));

        return res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error('Error en debug proyectos:', error);
        return res.status(500).json({ success: false, message: 'Error en debug', error: error.message });
    }
};

/**
 * DEBUG: Listar todos los tracking_access registrados
 * GET /api/seguimiento/debug/access
 * SOLO para desarrollo - sin autenticación
 */
export const debugTrackingAccess = async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ success: false, message: 'Debug no disponible en producción' });
        }

        const accesses = await TrackingAccess.find({})
            .select('codigo6 projectId taskId clientId enabled')
            .populate('projectId', '_id nombre')
            .limit(100)
            .lean();

        const results = accesses.map((access) => ({
            _id: String(access._id),
            codigo6: access.codigo6,
            projectId: access.projectId ? String(access.projectId._id || access.projectId) : null,
            projectNombre: access.projectId?.nombre || null,
            taskId: access.taskId ? String(access.taskId) : null,
            clientId: access.clientId ? String(access.clientId) : null,
            enabled: access.enabled,
            createdAt: access.createdAt
        }));

        return res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error('Error en debug access:', error);
        return res.status(500).json({ success: false, message: 'Error en debug', error: error.message });
    }
};

/**
 * DEBUG: Validar qué se obtiene al ingresar un código
 * POST /api/seguimiento/debug/validate
 * Body: { codigo: "string" }
 * SOLO para desarrollo - sin autenticación
 */
export const debugValidateCodigo = async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(403).json({ success: false, message: 'Debug no disponible en producción' });
        }

        const inputCodigo = resolveCodigoFromBody(req.body);
        const normalizado = normalizeCodigoInput(inputCodigo || '');

        const foundInDB = await findEnabledAccessByCodigo6(normalizado);
        const bootstrapped = !foundInDB && await bootstrapTrackingAccessByCodigo6(normalizado);

        return res.status(200).json({
            success: true,
            data: {
                inputBruto: inputCodigo,
                inputAliasCode: req.body?.code,
                inputAliasClienteId: req.body?.clienteId,
                inputNormalizado: normalizado,
                inputLongitud: normalizado.length,
                esValido: normalizado.length === 6,
                encontradoEnDB: !!foundInDB,
                registroEnDB: foundInDB ? {
                    _id: String(foundInDB._id),
                    codigo6: foundInDB.codigo6,
                    projectId: foundInDB.projectId ? String(foundInDB.projectId) : null,
                    enabled: foundInDB.enabled
                } : null,
                codigosEnBDqueCoincidenParcialmente: await TrackingAccess.find(
                    { codigo6: { $regex: normalizado.slice(0, 3) } },
                    { codigo6: 1, projectId: 1, enabled: 1 }
                ).limit(10).lean()
            }
        });
    } catch (error) {
        console.error('Error en debug validate:', error);
        return res.status(500).json({ success: false, message: 'Error en debug', error: error.message });
    }
};
