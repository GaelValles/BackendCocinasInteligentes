import CotizadorConfig from '../models/cotizadorConfig.model.js';
import Materiales from '../models/materiales.model.js';
import Admin from '../models/admin.model.js';

/**
 * Obtener lista de materiales base activos
 */
export const obtenerMateriales = async (req, res) => {
    try {
        const materiales = await Materiales.find({ 
            disponible: true,
            idCotizador: { $in: ['melamina', 'mdf', 'tech'] }
        }).select('idCotizador nombre precioPorMetro precioUnitario descripcion categoria');

        res.status(200).json({
            success: true,
            data: materiales
        });
    } catch (error) {
        console.error('Error al obtener materiales:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener materiales',
            error: error.message
        });
    }
};

/**
 * Obtener lista de herrajes activos
 */
export const obtenerHerrajes = async (req, res) => {
    try {
        const herrajes = await Materiales.find({ 
            disponible: true,
            idCotizador: { $in: ['correderas', 'bisagras', 'jaladeras', 'bote', 'iluminacion'] }
        }).select('idCotizador nombre precioUnitario descripcion categoria');

        res.status(200).json({
            success: true,
            data: herrajes
        });
    } catch (error) {
        console.error('Error al obtener herrajes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener herrajes',
            error: error.message
        });
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
