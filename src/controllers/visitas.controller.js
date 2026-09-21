import Visita from '../models/visita.model.js';
import { verifyRecaptchaToken } from '../services/recaptcha.service.js';

const ACTIVE_STATES = ['solicitada', 'programada', 'confirmada'];
const VALID_STATES = ['solicitada', 'programada', 'confirmada', 'cancelada'];
const SLOT_BUFFER_MS = 60 * 60 * 1000;

const parseDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getDayRange = (value) => {
    const date = parseDate(value);
    if (!date) return null;
    const start = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
};

const formatSlot = (date) => date.toISOString().slice(11, 16);

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const getCaptchaToken = (req) => req.headers['captcha-token']
    || req.headers['captchatoken']
    || req.headers['x-captcha-token']
    || req.headers['cf-turnstile-response']
    || req.body?.captchaToken
    || req.body?.['cf-turnstile-response'];

const canManageVisits = (req) => ['admin', 'arquitecto', 'empleado', 'empleado_general', 'ingeniero', 'staff']
    .includes(String(req.admin?.rol || '').toLowerCase());

const buildVisitUpdate = (body = {}) => {
    const update = {};
    if (body.fechaProgramada !== undefined) update.fechaProgramada = parseDate(body.fechaProgramada);
    if (body.nombreCliente !== undefined) update.nombreCliente = String(body.nombreCliente).trim();
    if (body.correoCliente !== undefined) update.correoCliente = String(body.correoCliente).trim().toLowerCase();
    if (body.telefonoCliente !== undefined) update.telefonoCliente = String(body.telefonoCliente).trim();
    if (body.ubicacion !== undefined) update.ubicacion = String(body.ubicacion || '').trim();
    if (body.informacionAdicional !== undefined) update.informacionAdicional = String(body.informacionAdicional || '').trim();
    if (body.estado !== undefined && VALID_STATES.includes(String(body.estado))) update.estado = String(body.estado);
    return update;
};

const hasScheduleConflict = async ({ fecha, excludeId = null }) => {
    if (!fecha) return false;
    const filter = {
        estado: { $in: ACTIVE_STATES },
        fechaProgramada: {
            $gte: new Date(fecha.getTime() - SLOT_BUFFER_MS),
            $lte: new Date(fecha.getTime() + SLOT_BUFFER_MS)
        }
    };
    if (excludeId) filter._id = { $ne: excludeId };
    return Boolean(await Visita.findOne(filter).select('_id').lean());
};

export const listarVisitas = async (req, res) => {
    try {
        if (!canManageVisits(req)) {
            return res.status(403).json({ success: false, message: 'No autorizado para consultar visitas' });
        }

        const filter = {};
        if (req.query.estado && VALID_STATES.includes(String(req.query.estado))) {
            filter.estado = String(req.query.estado);
        }

        const visitas = await Visita.find(filter).sort({ fechaProgramada: 1, createdAt: -1 }).lean();
        return res.json({ success: true, data: visitas });
    } catch (error) {
        console.error('Error listando visitas:', error);
        return res.status(500).json({ success: false, message: 'Error al listar visitas' });
    }
};

export const obtenerDisponibilidadVisita = async (req, res) => {
    try {
        const { fecha } = req.query;
        const range = getDayRange(fecha);
        if (!range) {
            return res.status(400).json({ success: false, message: 'fecha debe tener formato YYYY-MM-DD' });
        }

        const visitas = await Visita.find({
            fechaProgramada: { $gte: range.start, $lt: range.end },
            estado: { $in: ACTIVE_STATES }
        }).select('fechaProgramada -_id').lean();

        return res.json({
            success: true,
            fecha: String(fecha).slice(0, 10),
            horariosOcupados: visitas.map((visita) => formatSlot(new Date(visita.fechaProgramada)))
        });
    } catch (error) {
        console.error('Error listando disponibilidad de visitas:', error);
        return res.status(500).json({ success: false, message: 'Error al consultar disponibilidad de visitas' });
    }
};

export const crearVisita = async (req, res) => {
    try {
        const captchaToken = getCaptchaToken(req);
        if (!captchaToken) {
            return res.status(400).json({ success: false, message: 'El captcha (captcha-token) es requerido' });
        }

        const captchaResult = await verifyRecaptchaToken(String(captchaToken), {
            expectedAction: 'submit_visita'
        });
        if (!captchaResult.success) {
            return res.status(403).json({
                success: false,
                message: 'La verificación del captcha falló',
                error: captchaResult.error || 'Token inválido o expirado'
            });
        }

        const {
            fechaProgramada,
            nombreCliente,
            correoCliente,
            telefonoCliente,
            ubicacion,
            informacionAdicional,
            estado
        } = req.body || {};
        const fecha = parseDate(fechaProgramada);

        if (!fecha || !nombreCliente || !correoCliente || !telefonoCliente) {
            return res.status(400).json({
                success: false,
                message: 'fechaProgramada, nombreCliente, correoCliente y telefonoCliente son requeridos'
            });
        }
        if (!isValidEmail(correoCliente)) {
            return res.status(400).json({ success: false, message: 'correoCliente inválido' });
        }
        if (fecha.getTime() <= Date.now()) {
            return res.status(400).json({ success: false, message: 'fechaProgramada debe ser futura' });
        }

        const requestedState = ['solicitada', 'programada', 'confirmada', 'cancelada'].includes(estado)
            ? estado
            : 'solicitada';
        if (ACTIVE_STATES.includes(requestedState) && await hasScheduleConflict({ fecha })) {
            return res.status(409).json({ success: false, message: 'El horario de visita no está disponible' });
        }

        const visita = await Visita.create({
            fechaProgramada: fecha,
            nombreCliente: String(nombreCliente).trim(),
            correoCliente: String(correoCliente).trim().toLowerCase(),
            telefonoCliente: String(telefonoCliente).trim(),
            ubicacion: String(ubicacion || '').trim(),
            informacionAdicional: String(informacionAdicional || '').trim(),
            estado: requestedState
        });

        return res.status(201).json({
            success: true,
            message: 'Visita registrada correctamente',
            data: visita
        });
    } catch (error) {
        console.error('Error creando solicitud de visita:', error);
        return res.status(500).json({ success: false, message: 'Error al registrar solicitud de visita' });
    }
};

export const actualizarVisita = async (req, res) => {
    try {
        if (!canManageVisits(req)) {
            return res.status(403).json({ success: false, message: 'No autorizado para actualizar visitas' });
        }

        const visita = await Visita.findById(req.params.id);
        if (!visita) return res.status(404).json({ success: false, message: 'Visita no encontrada' });

        const update = buildVisitUpdate(req.body);
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'fechaProgramada') && !update.fechaProgramada) {
            return res.status(400).json({ success: false, message: 'fechaProgramada inválida' });
        }
        if (update.correoCliente !== undefined && !isValidEmail(update.correoCliente)) {
            return res.status(400).json({ success: false, message: 'correoCliente inválido' });
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'estado') && !VALID_STATES.includes(String(req.body.estado))) {
            return res.status(400).json({ success: false, message: 'estado inválido' });
        }

        const nextDate = update.fechaProgramada || visita.fechaProgramada;
        const nextState = update.estado || visita.estado;
        if (ACTIVE_STATES.includes(nextState) && await hasScheduleConflict({ fecha: nextDate, excludeId: visita._id })) {
            return res.status(409).json({ success: false, message: 'El horario de visita no está disponible' });
        }

        Object.assign(visita, update);
        await visita.save();
        return res.json({ success: true, message: 'Visita actualizada correctamente', data: visita });
    } catch (error) {
        console.error('Error actualizando visita:', error);
        return res.status(500).json({ success: false, message: 'Error al actualizar visita' });
    }
};

export const eliminarVisita = async (req, res) => {
    try {
        if (!canManageVisits(req)) {
            return res.status(403).json({ success: false, message: 'No autorizado para eliminar visitas' });
        }

        const visita = await Visita.findByIdAndDelete(req.params.id);
        if (!visita) return res.status(404).json({ success: false, message: 'Visita no encontrada' });

        return res.json({ success: true, message: 'Visita eliminada correctamente', data: visita });
    } catch (error) {
        console.error('Error eliminando visita:', error);
        return res.status(500).json({ success: false, message: 'Error al eliminar visita' });
    }
};
