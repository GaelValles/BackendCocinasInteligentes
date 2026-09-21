import Visita from '../models/visita.model.js';
import { verifyRecaptchaToken } from '../services/recaptcha.service.js';

const ACTIVE_STATES = ['solicitada', 'programada', 'confirmada'];
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

        const conflict = await Visita.findOne({
            estado: { $in: ACTIVE_STATES },
            fechaProgramada: {
                $gte: new Date(fecha.getTime() - SLOT_BUFFER_MS),
                $lte: new Date(fecha.getTime() + SLOT_BUFFER_MS)
            }
        }).select('_id').lean();
        if (conflict) {
            return res.status(409).json({ success: false, message: 'El horario de visita no está disponible' });
        }

        const visita = await Visita.create({
            fechaProgramada: fecha,
            nombreCliente: String(nombreCliente).trim(),
            correoCliente: String(correoCliente).trim().toLowerCase(),
            telefonoCliente: String(telefonoCliente).trim(),
            ubicacion: String(ubicacion || '').trim(),
            informacionAdicional: String(informacionAdicional || '').trim(),
            estado: ['solicitada', 'programada', 'confirmada', 'cancelada'].includes(estado) ? estado : 'solicitada'
        });

        return res.status(201).json({
            success: true,
            message: 'Solicitud de visita registrada correctamente',
            data: visita
        });
    } catch (error) {
        console.error('Error creando solicitud de visita:', error);
        return res.status(500).json({ success: false, message: 'Error al registrar solicitud de visita' });
    }
};
