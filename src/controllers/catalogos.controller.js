import CotizadorConfig from '../models/cotizadorConfig.model.js';
import Materiales from '../models/materiales.model.js';
import Admin from '../models/admin.model.js';

const BASE_MATERIAL_IDS = ['melamina', 'mdf', 'tech'];
const HERRAJE_IDS = ['correderas', 'bisagras', 'jaladeras', 'bote', 'iluminacion'];

const normalizeText = (value) => String(value || '').trim();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSection = (value) => normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_');

const parseBooleanQuery = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'si'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
    return fallback;
};

const parseSections = (query = {}) => {
    const values = [];
    if (query.seccion) values.push(query.seccion);
    if (query.secciones) {
        values.push(...String(query.secciones).split(','));
    }

    const normalized = values
        .map(normalizeSection)
        .filter(Boolean);

    return [...new Set(normalized)];
};

const normalizeTier = (gamaValue, tierValue) => {
    const raw = normalizeText(gamaValue || tierValue);
    if (!raw) return 'Tendencia';

    const check = raw.toLowerCase();
    if (check.includes('premium')) return 'Premium';
    if (check.includes('estandar') || check.includes('standard') || check.includes('basic')) return 'Estandar';
    return 'Tendencia';
};

const buildMaterialCatalogFilter = (query = {}, { defaultDisponible = true, forceHerrajes = false } = {}) => {
    const filter = {};
    const disponible = parseBooleanQuery(query.disponible, defaultDisponible);
    if (disponible !== undefined) filter.disponible = disponible;

    if (query.categoria) {
        filter.categoria = new RegExp(`^${escapeRegex(normalizeText(query.categoria))}$`, 'i');
    }

    if (query.proveedor) {
        filter.proveedor = new RegExp(escapeRegex(normalizeText(query.proveedor)), 'i');
    }

    const sections = parseSections(query);
    if (sections.length === 1) {
        filter.seccion = sections[0];
    } else if (sections.length > 1) {
        filter.seccion = { $in: sections };
    }

    if (query.q) {
        const qRegex = new RegExp(escapeRegex(normalizeText(query.q)), 'i');
        filter.$or = [
            { nombre: qRegex },
            { descripcion: qRegex },
            { idCotizador: qRegex },
            { categoria: qRegex },
            { proveedor: qRegex }
        ];
    }

    if (forceHerrajes) {
        filter.$and = [
            {
                $or: [
                    { categoria: /herrajes/i },
                    { idCotizador: { $in: HERRAJE_IDS } }
                ]
            }
        ];
    }

    return filter;
};

const mapCatalogMaterial = (item) => {
    const tier = normalizeTier(item.gama, item.tier);
    return {
        _id: item._id,
        id: item.idCotizador || String(item._id),
        idCotizador: item.idCotizador || null,
        nombre: item.nombre,
        unidadMedida: item.unidadMedida || 'unidad',
        precioUnitario: item.precioUnitario ?? null,
        precioPorMetro: item.precioPorMetro ?? null,
        precioMetroLineal: item.precioPorMetro ?? null,
        descripcion: item.descripcion || '',
        categoria: item.categoria || '',
        seccion: item.seccion || null,
        proveedor: item.proveedor || '',
        disponible: !!item.disponible,
        gama: tier,
        tier,
        image: item.image || ''
    };
};

/**
 * Obtener lista de materiales base activos
 */
export const obtenerMateriales = async (req, res) => {
    try {
        const { base } = req.query;

        const filtro = buildMaterialCatalogFilter(req.query, { defaultDisponible: true });
        // Compat: si el frontend solicita solo materiales base (cotizador), usar idCotizador filter
        if (base === 'true') {
            filtro.idCotizador = { $in: BASE_MATERIAL_IDS };
        }

        const materiales = await Materiales.find(filtro)
            .select('idCotizador nombre unidadMedida precioPorMetro precioUnitario descripcion disponible categoria seccion proveedor image gama tier')
            .sort({ nombre: 1 })
            .lean();

        const mapped = materiales.map(mapCatalogMaterial);

        res.status(200).json({ success: true, data: mapped });
    } catch (error) {
        console.error('Error al obtener materiales:', error);
        res.status(500).json({ success: false, message: 'Error al obtener materiales', error: error.message });
    }
};

/**
 * Obtener lista de herrajes activos
 */
export const obtenerHerrajes = async (req, res) => {
    try {
        const filtro = buildMaterialCatalogFilter(req.query, {
            defaultDisponible: true,
            forceHerrajes: true
        });

        const herrajes = await Materiales.find(filtro)
            .select('idCotizador nombre unidadMedida precioPorMetro precioUnitario descripcion categoria seccion disponible proveedor image gama tier')
            .sort({ nombre: 1 })
            .lean();

        const mapped = herrajes.map(mapCatalogMaterial);

        res.status(200).json({ success: true, data: mapped });
    } catch (error) {
        console.error('Error al obtener herrajes:', error);
        res.status(500).json({ success: false, message: 'Error al obtener herrajes', error: error.message });
    }
};

/**
 * Obtener lista de colores disponibles
 */
export const obtenerColores = async (req, res) => {
    try {
        const config = await CotizadorConfig.getConfig();
        
        const colores = config.materialColors || [
            'Blanco Nieve',
            'Nogal Calido',
            'Gris Grafito',
            'Fresno Arena'
        ];

        res.status(200).json({
            success: true,
            data: colores
        });
    } catch (error) {
        console.error('Error al obtener colores:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener colores',
            error: error.message
        });
    }
};

/**
 * Obtener tipos de proyecto disponibles
 */
export const obtenerTiposProyecto = async (req, res) => {
    try {
        const config = await CotizadorConfig.getConfig();
        
        const tipos = config.projectTypes || [
            'Cocina',
            'Closet',
            'vestidor',
            'Mueble para el baño'
        ];

        res.status(200).json({
            success: true,
            data: tipos
        });
    } catch (error) {
        console.error('Error al obtener tipos de proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tipos de proyecto',
            error: error.message
        });
    }
};

/**
 * Obtener tipos de cubierta disponibles para levantamiento
 */
export const obtenerTiposCubierta = async (req, res) => {
    try {
        const tipos = [
            'Granito Básico',
            'Cuarzo',
            'Piedra Sinterizada'
        ];

        res.status(200).json({
            success: true,
            data: tipos
        });
    } catch (error) {
        console.error('Error al obtener tipos de cubierta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tipos de cubierta',
            error: error.message
        });
    }
};

/**
 * Obtener escenarios disponibles para levantamiento
 */
export const obtenerEscenariosLevantamiento = async (req, res) => {
    try {
        const escenarios = [
            { 
                id: 'esencial', 
                title: 'GAMA ESENCIAL',
                subtitle: 'Opción económica y funcional',
                multiplicador: 0.9,
                descripcion: 'Materiales básicos de calidad estándar'
            },
            { 
                id: 'tendencia', 
                title: 'GAMA TENDENCIA',
                subtitle: 'Balance entre precio y calidad',
                multiplicador: 1.1,
                descripcion: 'Materiales de calidad media-alta'
            },
            { 
                id: 'premium', 
                title: 'GAMA PREMIUM',
                subtitle: 'Lujo y máxima calidad',
                multiplicador: 1.35,
                descripcion: 'Materiales de primera calidad'
            }
        ];

        res.status(200).json({
            success: true,
            data: escenarios
        });
    } catch (error) {
        console.error('Error al obtener escenarios:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener escenarios',
            error: error.message
        });
    }
};

/**
 * Obtener escenarios disponibles para cotizador
 */
export const obtenerEscenariosCotizador = async (req, res) => {
    try {
        const config = await CotizadorConfig.getConfig();

        res.status(200).json({
            success: true,
            data: config.scenarioCards || []
        });
    } catch (error) {
        console.error('Error al obtener escenarios del cotizador:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener escenarios del cotizador',
            error: error.message
        });
    }
};

/**
 * Obtener todos los empleados/arquitectos disponibles para asignación
 */
export const obtenerEmpleados = async (req, res) => {
    try {
        const empleados = await Admin.find({
            rol: { $in: ['admin', 'arquitecto', 'empleado'] }
        }).select('nombre correo telefono rol');

        res.status(200).json({
            success: true,
            data: empleados
        });
    } catch (error) {
        console.error('Error al obtener empleados:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener empleados',
            error: error.message
        });
    }
};
