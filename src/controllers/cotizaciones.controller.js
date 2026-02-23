import CotizadorConfig from '../models/cotizadorConfig.model.js';
import Cotizacion from '../models/cotizacion.model.js';
import Materiales from '../models/materiales.model.js';

/**
 * Obtiene la configuración completa del cotizador para el frontend.
 * Base materials y hardware desde Materiales (precios); escenarios y colores desde CotizadorConfig.
 * Retorna arrays vacíos si no hay materiales en la BD - deben ser agregados previamente.
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

        const baseMaterials = materialesBase.map((m) => ({
            id: m.idCotizador,
            label: m.nombre,
            pricePerMeter: m.precioPorMetro ?? m.precioUnitario ?? 0
        }));

        const hardwareCatalog = materialesHerrajes.map((m) => ({
            id: m.idCotizador,
            label: m.nombre,
            unitPrice: m.precioUnitario ?? 0
        }));

        res.json({
            projectTypes: config.projectTypes,
            baseMaterials,
            scenarioCards: config.scenarioCards,
            materialColors: config.materialColors,
            hardwareCatalog
        });
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al obtener configuración del cotizador', 
            error: error.message 
        });
    }
};

/**
 * Crear una nueva cotización
 */
export const crear = async (req, res) => {
    try {
        const {
            cliente,
            tipoProyecto,
            ubicacion,
            fechaInstalacion,
            medidas,
            escenarioSeleccionado,
            materialBase,
            colorTextura,
            grosorTablero,
            herrajes,
            manoDeObra,
            flete,
            instalacion,
            desinstalacion,
            notas
        } = req.body;

        // Validaciones
        if (!cliente || !tipoProyecto || !ubicacion || !fechaInstalacion) {
            return res.status(400).json({
                success: false,
                message: 'Datos del proyecto incompletos'
            });
        }

        if (!medidas || !medidas.largo || !medidas.alto || !medidas.fondo || !medidas.metrosLineales) {
            return res.status(400).json({
                success: false,
                message: 'Medidas incompletas'
            });
        }

        if (!materialBase || !colorTextura) {
            return res.status(400).json({
                success: false,
                message: 'Material base y color son requeridos'
            });
        }

        // Buscar material en catálogo
        const materialCatalogo = await Materiales.findOne({
            idCotizador: materialBase,
            disponible: true
        });

        if (!materialCatalogo) {
            return res.status(400).json({
                success: false,
                message: 'Material no encontrado en catálogo'
            });
        }

        // Multiplicadores de escenario
        const multiplicadoresEscenario = {
            'esencial': 0.92,
            'tendencia': 1.05,
            'premium': 1.18
        };

        // Crear cotización
        const cotizacion = new Cotizacion({
            cliente,
            projectType: tipoProyecto,
            ubicacion,
            fechaInstalacion,
            medidas,
            selectedScenario: escenarioSeleccionado,
            multiplicadorEscenario: multiplicadoresEscenario[escenarioSeleccionado] || 1.0,
            materialBase,
            materialBaseRef: materialCatalogo._id,
            precioMaterialPorMetro: materialCatalogo.precioPorMetro ?? materialCatalogo.precioUnitario ?? 0,
            materialColor: colorTextura,
            materialThickness: grosorTablero || '16',
            herrajes: herrajes || [],
            labor: manoDeObra || 0,
            flete: flete || 0,
            instalacion: instalacion || 0,
            desinstalacion: desinstalacion || 0,
            notas: notas || '',
            estado: 'borrador',
            creadoPor: req.admin?.id || null,
            historialEstados: [{
                estado: 'borrador',
                fecha: new Date(),
                usuario: req.admin?.nombre || 'Sistema'
            }]
        });

        await cotizacion.save();

        res.status(201).json({
            success: true,
            data: cotizacion,
            message: 'Cotización creada exitosamente'
        });

    } catch (error) {
        console.error('Error al crear cotización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear cotización',
            error: error.message
        });
    }
};

/**
 * Guarda o actualiza un borrador de cotización.
 */
export const guardarBorrador = async (req, res) => {
    try {
        const payload = { ...req.body, _id: req.params.id ?? req.body._id };
        const usuarioId = req.admin?.id ?? null;

        // Buscar material si se especifica
        let materialInfo = {};
        if (payload.materialBase) {
            const materialCatalogo = await Materiales.findOne({
                idCotizador: payload.materialBase,
                disponible: true
            });

            if (materialCatalogo) {
                materialInfo = {
                    materialBaseRef: materialCatalogo._id,
                    precioMaterialPorMetro: materialCatalogo.precioPorMetro ?? materialCatalogo.precioUnitario ?? 0
                };
            }
        }

        const cotizacionData = {
            cliente: payload.cliente ?? '',
            projectType: payload.projectType ?? 'Cocina',
            ubicacion: payload.ubicacion ?? '',
            fechaInstalacion: payload.fechaInstalacion ? new Date(payload.fechaInstalacion) : null,
            medidas: {
                largo: Number(payload.largo) || payload.medidas?.largo || 4.2,
                alto: Number(payload.alto) || payload.medidas?.alto || 2.4,
                fondo: Number(payload.fondo) || payload.medidas?.fondo || 0.6,
                metrosLineales: Number(payload.metrosLineales) || payload.medidas?.metrosLineales || 6
            },
            materialBase: payload.materialBase ?? 'melamina',
            ...materialInfo,
            selectedScenario: payload.selectedScenario ?? null,
            materialColor: payload.materialColor ?? 'Blanco Nieve',
            materialThickness: payload.materialThickness ?? '16',
            hardware: payload.hardware ?? {},
            herrajes: payload.herrajes ?? [],
            labor: Number(payload.labor) || 0,
            flete: Number(payload.flete) || 0,
            instalacion: Number(payload.instalacion) || 0,
            desinstalacion: Number(payload.desinstalacion) || 0,
            notas: payload.notas ?? '',
            estado: 'borrador',
            creadoPor: usuarioId
        };

        let cotizacion;
        if (payload._id) {
            const filter = { _id: payload._id };
            if (usuarioId) filter.creadoPor = usuarioId;
            cotizacion = await Cotizacion.findOneAndUpdate(filter, cotizacionData, { new: true });
            if (!cotizacion) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Cotización no encontrada o no tienes permiso para modificarla' 
                });
            }
        } else {
            cotizacion = new Cotizacion(cotizacionData);
            await cotizacion.save();
        }

        res.json({
            success: true,
            data: cotizacion,
            message: 'Borrador guardado correctamente'
        });
    } catch (error) {
        console.error('Error al guardar borrador:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al guardar borrador', 
            error: error.message 
        });
    }
};

/**
 * Listar cotizaciones con filtros y paginación
 */
export const listar = async (req, res) => {
    try {
        const { estado, tipoProyecto, fechaDesde, fechaHasta, page = 1, limit = 10 } = req.query;

        // Construir filtros
        const filtros = {};

        if (req.admin?.id) {
            filtros.creadoPor = req.admin.id;
        }

        if (estado) {
            filtros.estado = estado;
        }

        if (tipoProyecto) {
            filtros.projectType = tipoProyecto;
        }

        if (fechaDesde || fechaHasta) {
            filtros.createdAt = {};
            if (fechaDesde) {
                filtros.createdAt.$gte = new Date(fechaDesde);
            }
            if (fechaHasta) {
                filtros.createdAt.$lte = new Date(fechaHasta);
            }
        }

        // Paginación
        const skip = (page - 1) * limit;

        // Ejecutar queries en paralelo
        const [cotizaciones, total] = await Promise.all([
            Cotizacion.find(filtros)
                .populate('empleadoAsignado', 'nombre email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Cotizacion.countDocuments(filtros)
        ]);

        res.status(200).json({
            success: true,
            data: cotizaciones,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error al listar cotizaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar cotizaciones',
            error: error.message
        });
    }
};

/**
 * Alias de listar para mantener compatibilidad
 */
export const listarCotizaciones = listar;

/**
 * Obtener una cotización por ID
 */
export const obtenerPorId = async (req, res) => {
    try {
        const cotizacion = await Cotizacion.findById(req.params.id)
            .populate('empleadoAsignado', 'nombre email rol')
            .populate('materialBaseRef')
            .populate('herrajes.herrajeId');

        if (!cotizacion) {
            return res.status(404).json({
                success: false,
                message: 'Cotización no encontrada'
            });
        }

        res.status(200).json({
            success: true,
            data: cotizacion
        });

    } catch (error) {
        console.error('Error al obtener cotización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener cotización',
            error: error.message
        });
    }
};

/**
 * Alias de obtenerPorId para mantener compatibilidad
 */
export const obtenerCotizacion = obtenerPorId;

/**
 * Actualizar una cotización
 */
export const actualizar = async (req, res) => {
    try {
        // Si se actualiza el material, buscar en catálogo
        if (req.body.materialBase) {
            const materialCatalogo = await Materiales.findOne({
                idCotizador: req.body.materialBase,
                disponible: true
            });

            if (materialCatalogo) {
                req.body.precioMaterialPorMetro = materialCatalogo.precioPorMetro ?? materialCatalogo.precioUnitario ?? 0;
                req.body.materialBaseRef = materialCatalogo._id;
            }
        }

        const cotizacion = await Cotizacion.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!cotizacion) {
            return res.status(404).json({
                success: false,
                message: 'Cotización no encontrada'
            });
        }

        res.status(200).json({
            success: true,
            data: cotizacion,
            message: 'Cotización actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar cotización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar cotización',
            error: error.message
        });
    }
};

/**
 * Cambiar estado de una cotización
 */
export const cambiarEstado = async (req, res) => {
    try {
        const { estado, notas } = req.body;

        const estadosValidos = [
            'borrador', 'enviada', 'aprobada', 'en_produccion', 
            'lista_instalacion', 'instalada', 'rechazada', 'archivada',
            'enviado', 'aprobado' // Mantener compatibilidad
        ];

        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                message: 'Estado no válido'
            });
        }

        const cotizacion = await Cotizacion.findById(req.params.id);

        if (!cotizacion) {
            return res.status(404).json({
                success: false,
                message: 'Cotización no encontrada'
            });
        }

        // Actualizar estado
        cotizacion.estado = estado;
        cotizacion.historialEstados.push({
            estado,
            fecha: new Date(),
            usuario: req.admin?.nombre || 'Sistema',
            notas: notas || ''
        });

        await cotizacion.save();

        res.status(200).json({
            success: true,
            data: cotizacion,
            message: 'Estado actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al cambiar estado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado',
            error: error.message
        });
    }
};

/**
 * Eliminar una cotización
 */
export const eliminar = async (req, res) => {
    try {
        const cotizacion = await Cotizacion.findByIdAndDelete(req.params.id);

        if (!cotizacion) {
            return res.status(404).json({
                success: false,
                message: 'Cotización no encontrada'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cotización eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar cotización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar cotización',
            error: error.message
        });
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
            return res.status(404).json({ 
                success: false,
                message: 'Cotización no encontrada' 
            });
        }
        res.json({
            success: true,
            message: 'Generar PDF Cliente (pendiente de implementar)',
            data: {
                cotizacion: cotizacion._id,
                finalPrice: cotizacion.finalPrice
            }
        });
    } catch (error) {
        console.error('Error al generar PDF:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al generar PDF', 
            error: error.message 
        });
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
            return res.status(404).json({ 
                success: false,
                message: 'Cotización no encontrada' 
            });
        }
        res.json({
            success: true,
            message: 'Generar Hoja de Taller (pendiente de implementar)',
            data: {
                cotizacion: cotizacion._id,
                medidas: cotizacion.medidas
            }
        });
    } catch (error) {
        console.error('Error al generar hoja de taller:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al generar hoja de taller', 
            error: error.message 
        });
    }
};
