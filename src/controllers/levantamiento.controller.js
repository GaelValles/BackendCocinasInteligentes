import Levantamiento from '../models/levantamiento.model.js';

/**
 * Crear un nuevo levantamiento
 */
export const crear = async (req, res) => {
    try {
        const { cliente, metrosLineales, requiereIsla, alacenasAltas, tipoCubierta, escenarioSeleccionado, empleadoAsignado, notas } = req.body;

        // Validaciones
        if (!cliente || !cliente.nombre || !cliente.direccion || !cliente.telefono) {
            return res.status(400).json({
                success: false,
                message: 'Datos del cliente incompletos'
            });
        }

        if (!metrosLineales || metrosLineales <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Metros lineales debe ser mayor a 0'
            });
        }

        if (!tipoCubierta) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de cubierta es requerido'
            });
        }

        if (!escenarioSeleccionado) {
            return res.status(400).json({
                success: false,
                message: 'Escenario es requerido'
            });
        }

        // Crear levantamiento
        const levantamiento = new Levantamiento({
            cliente,
            metrosLineales,
            requiereIsla: requiereIsla || false,
            alacenasAltas: alacenasAltas || false,
            tipoCubierta,
            escenarioSeleccionado,
            empleadoAsignado: empleadoAsignado || null,
            notas: notas || '',
            historialEstados: [{
                estado: 'pendiente',
                fecha: new Date(),
                usuario: req.admin?.nombre || 'Sistema'
            }]
        });

        await levantamiento.save();

        res.status(201).json({
            success: true,
            data: levantamiento,
            message: 'Levantamiento creado exitosamente'
        });

    } catch (error) {
        console.error('Error al crear levantamiento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear levantamiento',
            error: error.message
        });
    }
};

/**
 * Listar levantamientos con filtros y paginación
 */
export const listar = async (req, res) => {
    try {
        const { estado, empleadoAsignado, fechaDesde, fechaHasta, page = 1, limit = 10 } = req.query;

        // Construir filtros
        const filtros = {};

        if (estado) {
            filtros.estado = estado;
        }

        if (empleadoAsignado) {
            filtros.empleadoAsignado = empleadoAsignado;
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
        const [levantamientos, total] = await Promise.all([
            Levantamiento.find(filtros)
                .populate('empleadoAsignado', 'nombre email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Levantamiento.countDocuments(filtros)
        ]);

        res.status(200).json({
            success: true,
            data: levantamientos,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error al listar levantamientos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar levantamientos',
            error: error.message
        });
    }
};

/**
 * Obtener un levantamiento por ID
 */
export const obtenerPorId = async (req, res) => {
    try {
        const levantamiento = await Levantamiento.findById(req.params.id)
            .populate('empleadoAsignado', 'nombre email rol')
            .populate('cotizacionId');

        if (!levantamiento) {
            return res.status(404).json({
                success: false,
                message: 'Levantamiento no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: levantamiento
        });

    } catch (error) {
        console.error('Error al obtener levantamiento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener levantamiento',
            error: error.message
        });
    }
};

/**
 * Actualizar un levantamiento
 */
export const actualizar = async (req, res) => {
    try {
        const levantamiento = await Levantamiento.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!levantamiento) {
            return res.status(404).json({
                success: false,
                message: 'Levantamiento no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: levantamiento,
            message: 'Levantamiento actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar levantamiento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar levantamiento',
            error: error.message
        });
    }
};

/**
 * Cambiar estado de un levantamiento
 */
export const cambiarEstado = async (req, res) => {
    try {
        const { estado, notas } = req.body;

        const estadosValidos = ['pendiente', 'en_revision', 'contactado', 'cotizado', 'rechazado', 'archivado'];

        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                message: 'Estado no válido'
            });
        }

        const levantamiento = await Levantamiento.findById(req.params.id);

        if (!levantamiento) {
            return res.status(404).json({
                success: false,
                message: 'Levantamiento no encontrado'
            });
        }

        // Actualizar estado
        levantamiento.estado = estado;
        levantamiento.historialEstados.push({
            estado,
            fecha: new Date(),
            usuario: req.admin?.nombre || 'Sistema',
            notas: notas || ''
        });

        await levantamiento.save();

        res.status(200).json({
            success: true,
            data: levantamiento,
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
 * Asignar empleado a un levantamiento
 */
export const asignarEmpleado = async (req, res) => {
    try {
        const { empleadoId } = req.body;

        const levantamiento = await Levantamiento.findByIdAndUpdate(
            req.params.id,
            { 
                empleadoAsignado: empleadoId,
                estado: 'en_revision'
            },
            { new: true }
        ).populate('empleadoAsignado', 'nombre email');

        if (!levantamiento) {
            return res.status(404).json({
                success: false,
                message: 'Levantamiento no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: levantamiento,
            message: 'Empleado asignado exitosamente'
        });

    } catch (error) {
        console.error('Error al asignar empleado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al asignar empleado',
            error: error.message
        });
    }
};

/**
 * Eliminar un levantamiento
 */
export const eliminar = async (req, res) => {
    try {
        const levantamiento = await Levantamiento.findByIdAndDelete(req.params.id);

        if (!levantamiento) {
            return res.status(404).json({
                success: false,
                message: 'Levantamiento no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Levantamiento eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar levantamiento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar levantamiento',
            error: error.message
        });
    }
};

/**
 * Convertir levantamiento a cotización
 * Por implementar - retorna 501 por ahora
 */
export const convertirACotizacion = async (req, res) => {
    try {
        res.status(501).json({
            success: false,
            message: 'Función no implementada aún'
        });
    } catch (error) {
        console.error('Error al convertir a cotización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al convertir a cotización',
            error: error.message
        });
    }
};
