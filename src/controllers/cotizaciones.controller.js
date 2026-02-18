import CotizadorConfig from '../models/cotizadorConfig.model.js';
import Cotizacion from '../models/cotizacion.model.js';
import Materiales from '../models/materiales.model.js';

// Valores por defecto cuando no hay materiales en BD (misma lógica del frontend)
const BASE_MATERIALS_DEFAULT = [
    { id: 'melamina', label: 'Melamina', pricePerMeter: 6500 },
    { id: 'mdf', label: 'MDF', pricePerMeter: 7800 },
    { id: 'tech', label: 'Tech', pricePerMeter: 9800 }
];
const HARDWARE_DEFAULT = [
    { id: 'correderas', label: 'Correderas cierre suave', unitPrice: 500 },
    { id: 'bisagras', label: 'Bisagras 110° reforzadas', unitPrice: 140 },
    { id: 'jaladeras', label: 'Jaladeras minimalistas', unitPrice: 90 },
    { id: 'bote', label: 'Bote de basura extraíble', unitPrice: 1200 },
    { id: 'iluminacion', label: 'Iluminación LED interior', unitPrice: 780 }
];

/**
 * Obtiene la configuración completa del cotizador para el frontend.
 * Base materials y hardware desde Materiales (precios); escenarios y colores desde CotizadorConfig.
 */
export const getCotizadorConfig = async (req, res) => {
    try {
        const config = await CotizadorConfig.getConfig();

        const baseMaterialIds = ['melamina', 'mdf', 'tech'];
        const herrajeIds = ['correderas', 'bisagras', 'jaladeras', 'bote', 'iluminacion'];

        const materialesBase = await Materiales.find({
            idCotizador: { $in: baseMaterialIds },
            disponible: true
        }).select('idCotizador nombre precioPorMetro precioUnitario unidadMedida');

        const materialesHerrajes = await Materiales.find({
            idCotizador: { $in: herrajeIds },
            disponible: true
        }).select('idCotizador nombre precioUnitario');

        const baseMaterials = materialesBase.length > 0
            ? materialesBase.map((m) => ({
                id: m.idCotizador,
                label: m.nombre,
                pricePerMeter: m.precioPorMetro ?? m.precioUnitario ?? 6500
            }))
            : BASE_MATERIALS_DEFAULT;

        const hardwareCatalog = materialesHerrajes.length > 0
            ? materialesHerrajes.map((m) => ({
                id: m.idCotizador,
                label: m.nombre,
                unitPrice: m.precioUnitario ?? 500
            }))
            : HARDWARE_DEFAULT;

        res.json({
            projectTypes: config.projectTypes,
            baseMaterials,
            scenarioCards: config.scenarioCards,
            materialColors: config.materialColors,
            hardwareCatalog
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener configuración del cotizador', error: error.message });
    }
};

/**
 * Guarda o actualiza un borrador de cotización.
 */
export const guardarBorrador = async (req, res) => {
    try {
        const payload = { ...req.body, _id: req.params.id ?? req.body._id };
        const usuarioId = req.admin?.id ?? null;

        const cotizacionData = {
            cliente: payload.cliente ?? '',
            projectType: payload.projectType ?? 'Cocina',
            ubicacion: payload.ubicacion ?? '',
            fechaInstalacion: payload.fechaInstalacion ? new Date(payload.fechaInstalacion) : null,
            medidas: {
                largo: Number(payload.largo) || 4.2,
                alto: Number(payload.alto) || 2.4,
                fondo: Number(payload.fondo) || 0.6,
                metrosLineales: Number(payload.metrosLineales) || 6
            },
            materialBase: payload.materialBase ?? 'melamina',
            selectedScenario: payload.selectedScenario ?? null,
            materialColor: payload.materialColor ?? 'Blanco Nieve',
            materialThickness: payload.materialThickness ?? '16',
            hardware: payload.hardware ?? {},
            labor: Number(payload.labor) || 0,
            flete: Number(payload.flete) || 0,
            instalacion: Number(payload.instalacion) || 0,
            desinstalacion: Number(payload.desinstalacion) || 0,
            materialSubtotal: Number(payload.materialSubtotal) || 0,
            hardwareSubtotal: Number(payload.hardwareSubtotal) || 0,
            laborSubtotal: Number(payload.laborSubtotal) || 0,
            finalPrice: Number(payload.finalPrice) || 0,
            estado: 'borrador',
            creadoPor: usuarioId
        };

        let cotizacion;
        if (payload._id) {
            const filter = { _id: payload._id };
            if (usuarioId) filter.creadoPor = usuarioId;
            cotizacion = await Cotizacion.findOneAndUpdate(filter, cotizacionData, { new: true });
            if (!cotizacion) {
                return res.status(404).json({ message: 'Cotización no encontrada o no tienes permiso para modificarla' });
            }
        } else {
            cotizacion = new Cotizacion(cotizacionData);
            await cotizacion.save();
        }

        res.json({
            message: 'Borrador guardado correctamente',
            cotizacion
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al guardar borrador', error: error.message });
    }
};

/**
 * Obtiene una cotización por ID.
 */
export const obtenerCotizacion = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.admin?.id;
        const filtro = { _id: id };
        if (usuarioId) filtro.creadoPor = usuarioId;
        const cotizacion = await Cotizacion.findOne(filtro);
        if (!cotizacion) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }
        res.json(cotizacion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener cotización', error: error.message });
    }
};

/**
 * Lista cotizaciones del usuario autenticado (opcional: filtrar por estado).
 */
export const listarCotizaciones = async (req, res) => {
    try {
        const { estado } = req.query;
        const filtro = {};
        if (req.admin?.id) filtro.creadoPor = req.admin.id;
        if (estado) filtro.estado = estado;

        const cotizaciones = await Cotizacion.find(filtro)
            .sort({ updatedAt: -1 })
            .lean();

        res.json(cotizaciones);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al listar cotizaciones', error: error.message });
    }
};

/**
 * Genera PDF para cliente (stub: retorna mensaje; integrar con librería PDF posteriormente).
 */
export const generarPdfCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.admin?.id;
        const filtro = { _id: id };
        if (usuarioId) filtro.creadoPor = usuarioId;
        const cotizacion = await Cotizacion.findOne(filtro);
        if (!cotizacion) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }
        res.json({
            message: 'Generar PDF Cliente (pendiente de implementar)',
            cotizacion: cotizacion._id,
            finalPrice: cotizacion.finalPrice
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al generar PDF', error: error.message });
    }
};

/**
 * Genera hoja de taller (stub: retorna mensaje; integrar con librería PDF posteriormente).
 */
export const generarHojaTaller = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.admin?.id;
        const filtro = { _id: id };
        if (usuarioId) filtro.creadoPor = usuarioId;
        const cotizacion = await Cotizacion.findOne(filtro);
        if (!cotizacion) {
            return res.status(404).json({ message: 'Cotización no encontrada' });
        }
        res.json({
            message: 'Generar Hoja de Taller (pendiente de implementar)',
            cotizacion: cotizacion._id,
            medidas: cotizacion.medidas
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al generar hoja de taller', error: error.message });
    }
};
