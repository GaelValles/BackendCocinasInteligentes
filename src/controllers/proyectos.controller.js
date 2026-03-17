 
import mongoose from 'mongoose';
import Proyecto from '../models/proyecto.model.js';
import Admin from '../models/admin.model.js';
import Cotizacion from '../models/cotizacion.model.js';
import Levantamiento from '../models/levantamiento.model.js';

/**
 * Obtener todos los proyectos (con filtros opcionales)
 * GET /api/proyectos
 */
export const obtenerProyectos = async (req, res) => {
    try {
        const { cliente, tipo, estado, empleadoAsignado } = req.query;
        const userRole = req.admin.rol;
        const userId = req.admin._id;

        // Construir filtros
        let filtros = {};

        if (tipo) filtros.tipo = tipo;
        if (estado) filtros.estado = estado;

        // Aplicar lógica de permisos
        if (userRole === 'cliente') {
            // Clientes solo ven sus propios proyectos
            filtros.cliente = userId;
        } else if (userRole === 'ingeniero') {
            // Ingenieros solo ven proyectos asignados a ellos
            if (empleadoAsignado) {
                filtros.empleadoAsignado = empleadoAsignado;
            } else {
                filtros.empleadoAsignado = userId;
            }
        } else {
            // Admin y arquitecto pueden aplicar filtros libremente
            if (cliente) filtros.cliente = cliente;
            if (empleadoAsignado) filtros.empleadoAsignado = empleadoAsignado;
        }

        const proyectos = await Proyecto.find(filtros)
            .populate('cliente', 'nombre correo telefono')
            .populate('empleadoAsignado', 'nombre correo')
            .populate('cotizacion')
            .populate('levantamiento')
            .sort({ createdAt: -1 });

        // Formatear respuesta
        const proyectosFormateados = proyectos.map(proyecto => ({
            _id: proyecto._id,
            nombre: proyecto.nombre,
            cliente: proyecto.cliente._id,
            nombreCliente: proyecto.cliente.nombre,
            tipo: proyecto.tipo,
            estado: proyecto.estado,
            timelineActual: proyecto.timelineActual,
            pasosPosibles: proyecto.pasosPosibles,
            archivosPublicos: proyecto.archivosPublicos,
            presupuestoTotal: proyecto.presupuestoTotal,
            anticipo: proyecto.anticipo,
            segundoPago: proyecto.segundoPago,
            liquidacion: proyecto.liquidacion,
            cotizacion: proyecto.cotizacion?._id,
            levantamiento: proyecto.levantamiento?._id,
            empleadoAsignado: proyecto.empleadoAsignado?._id,
            nombreEmpleadoAsignado: proyecto.empleadoAsignado?.nombre,
            createdAt: proyecto.createdAt,
            updatedAt: proyecto.updatedAt
        }));

        res.json({
            success: true,
            message: 'Proyectos obtenidos exitosamente',
            data: proyectosFormateados
        });

    } catch (error) {
        console.error('Error al obtener proyectos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener proyectos',
            error: error.message
        });
    }
};

/**
 * Obtener proyecto por ID
 * GET /api/proyectos/:id
 */
export const obtenerProyecto = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de proyecto inválido'
            });
        }

        const proyecto = await Proyecto.findById(id)
            .populate('cliente', 'nombre correo telefono')
            .populate('empleadoAsignado', 'nombre correo')
            .populate('cotizacion')
            .populate('levantamiento');

        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        // Verificar permisos: Clientes solo ven sus propios proyectos
        const userRole = req.admin.rol;
        const userId = req.admin._id.toString();

        if (userRole === 'cliente' && proyecto.cliente._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para ver este proyecto'
            });
        }

        // Formatear respuesta
        const proyectoFormateado = {
            _id: proyecto._id,
            nombre: proyecto.nombre,
            cliente: proyecto.cliente._id,
            nombreCliente: proyecto.cliente.nombre,
            correoCliente: proyecto.cliente.correo,
            telefonoCliente: proyecto.cliente.telefono,
            tipo: proyecto.tipo,
            estado: proyecto.estado,
            timelineActual: proyecto.timelineActual,
            pasosPosibles: proyecto.pasosPosibles,
            archivosPublicos: proyecto.archivosPublicos,
            presupuestoTotal: proyecto.presupuestoTotal,
            anticipo: proyecto.anticipo,
            segundoPago: proyecto.segundoPago,
            liquidacion: proyecto.liquidacion,
            cotizacion: proyecto.cotizacion?._id,
            levantamiento: proyecto.levantamiento?._id,
            empleadoAsignado: proyecto.empleadoAsignado?._id,
            nombreEmpleadoAsignado: proyecto.empleadoAsignado?.nombre,
            createdAt: proyecto.createdAt,
            updatedAt: proyecto.updatedAt
        };

        res.json({
            success: true,
            message: 'Proyecto obtenido exitosamente',
            data: proyectoFormateado
        });

    } catch (error) {
        console.error('Error al obtener proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener proyecto',
            error: error.message
        });
    }
};

/**
 * Crear nuevo proyecto
 * POST /api/proyectos
 */
export const crearProyecto = async (req, res) => {
    try {
        const {
            nombre,
            cliente,
            tipo,
            estado,
            timelineActual,
            pasosPosibles,
            presupuestoTotal,
            anticipo,
            segundoPago,
            liquidacion,
            cotizacion,
            levantamiento,
            empleadoAsignado
        } = req.body;

        // Validar que el cliente existe
        const clienteExiste = await Admin.findById(cliente);
        if (!clienteExiste) {
            return res.status(404).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        // Validar empleado asignado si se proporciona
        if (empleadoAsignado) {
            const empleadoExiste = await Admin.findById(empleadoAsignado);
            if (!empleadoExiste) {
                return res.status(404).json({
                    success: false,
                    message: 'Empleado asignado no encontrado'
                });
            }
        }

        // Crear el proyecto
        const nuevoProyecto = new Proyecto({
            nombre,
            cliente,
            nombreCliente: clienteExiste.nombre,
            tipo,
            estado: estado || 'cotizacion',
            timelineActual: timelineActual || 'Cotización en proceso',
            pasosPosibles: pasosPosibles || [],
            archivosPublicos: [],
            presupuestoTotal: presupuestoTotal || 0,
            anticipo: anticipo || 0,
            segundoPago: segundoPago || 0,
            liquidacion: liquidacion || 0,
            cotizacion,
            levantamiento,
            empleadoAsignado
        });

        await nuevoProyecto.save();

        // Poblar referencias
        await nuevoProyecto.populate('cliente', 'nombre correo telefono');
        await nuevoProyecto.populate('empleadoAsignado', 'nombre correo');

        // Formatear respuesta
        const proyectoFormateado = {
            _id: nuevoProyecto._id,
            nombre: nuevoProyecto.nombre,
            cliente: nuevoProyecto.cliente._id,
            nombreCliente: nuevoProyecto.cliente.nombre,
            tipo: nuevoProyecto.tipo,
            estado: nuevoProyecto.estado,
            timelineActual: nuevoProyecto.timelineActual,
            pasosPosibles: nuevoProyecto.pasosPosibles,
            archivosPublicos: nuevoProyecto.archivosPublicos,
            presupuestoTotal: nuevoProyecto.presupuestoTotal,
            anticipo: nuevoProyecto.anticipo,
            segundoPago: nuevoProyecto.segundoPago,
            liquidacion: nuevoProyecto.liquidacion,
            cotizacion: nuevoProyecto.cotizacion,
            levantamiento: nuevoProyecto.levantamiento,
            empleadoAsignado: nuevoProyecto.empleadoAsignado?._id,
            nombreEmpleadoAsignado: nuevoProyecto.empleadoAsignado?.nombre,
            createdAt: nuevoProyecto.createdAt,
            updatedAt: nuevoProyecto.updatedAt
        };

        res.status(201).json({
            success: true,
            message: 'Proyecto creado exitosamente',
            data: proyectoFormateado
        });

    } catch (error) {
        console.error('Error al crear proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear proyecto',
            error: error.message
        });
    }
};

/**
 * Actualizar proyecto
 * PUT /api/proyectos/:id
 */
export const actualizarProyecto = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de proyecto inválido'
            });
        }

        const proyecto = await Proyecto.findById(id);
        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        // Verificar permisos
        const userRole = req.admin.rol;
        const userId = req.admin._id.toString();

        if (userRole === 'ingeniero') {
            // Ingenieros solo pueden actualizar proyectos asignados a ellos
            if (!proyecto.empleadoAsignado || proyecto.empleadoAsignado.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para actualizar este proyecto'
                });
            }
        }

        // Clientes no pueden actualizar proyectos
        if (userRole === 'cliente') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para actualizar proyectos'
            });
        }

        // Validar empleado asignado si se proporciona
        if (updateData.empleadoAsignado) {
            const empleadoExiste = await Admin.findById(updateData.empleadoAsignado);
            if (!empleadoExiste) {
                return res.status(404).json({
                    success: false,
                    message: 'Empleado asignado no encontrado'
                });
            }
        }

        // Actualizar proyecto
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && key !== '_id' && key !== 'cliente') {
                proyecto[key] = updateData[key];
            }
        });

        await proyecto.save();

        // Poblar referencias
        await proyecto.populate('cliente', 'nombre correo telefono');
        await proyecto.populate('empleadoAsignado', 'nombre correo');

        // Formatear respuesta
        const proyectoFormateado = {
            _id: proyecto._id,
            nombre: proyecto.nombre,
            cliente: proyecto.cliente._id,
            nombreCliente: proyecto.cliente.nombre,
            tipo: proyecto.tipo,
            estado: proyecto.estado,
            timelineActual: proyecto.timelineActual,
            pasosPosibles: proyecto.pasosPosibles,
            archivosPublicos: proyecto.archivosPublicos,
            presupuestoTotal: proyecto.presupuestoTotal,
            anticipo: proyecto.anticipo,
            segundoPago: proyecto.segundoPago,
            liquidacion: proyecto.liquidacion,
            cotizacion: proyecto.cotizacion,
            levantamiento: proyecto.levantamiento,
            empleadoAsignado: proyecto.empleadoAsignado?._id,
            nombreEmpleadoAsignado: proyecto.empleadoAsignado?.nombre,
            createdAt: proyecto.createdAt,
            updatedAt: proyecto.updatedAt
        };

        res.json({
            success: true,
            message: 'Proyecto actualizado exitosamente',
            data: proyectoFormateado
        });

    } catch (error) {
        console.error('Error al actualizar proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar proyecto',
            error: error.message
        });
    }
};

/**
 * Actualizar timeline público del proyecto
 * PATCH /api/proyectos/:id/timeline
 */
export const actualizarTimeline = async (req, res) => {
    try {
        const { id } = req.params;
        const { timelineActual, pasosPosibles } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de proyecto inválido'
            });
        }

        const proyecto = await Proyecto.findById(id);
        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        // Actualizar timeline
        proyecto.timelineActual = timelineActual;
        if (pasosPosibles) proyecto.pasosPosibles = pasosPosibles;

        await proyecto.save();

        // Poblar referencias
        await proyecto.populate('cliente', 'nombre correo');
        await proyecto.populate('empleadoAsignado', 'nombre correo');

        res.json({
            success: true,
            message: 'Timeline actualizado exitosamente',
            data: {
                _id: proyecto._id,
                timelineActual: proyecto.timelineActual,
                pasosPosibles: proyecto.pasosPosibles,
                updatedAt: proyecto.updatedAt
            }
        });

    } catch (error) {
        console.error('Error al actualizar timeline:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar timeline',
            error: error.message
        });
    }
};

/**
 * Agregar archivos públicos al proyecto
 * POST /api/proyectos/:id/archivos
 */
export const agregarArchivosPublicos = async (req, res) => {
    try {
        const { id } = req.params;
        const { archivos } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de proyecto inválido'
            });
        }

        const proyecto = await Proyecto.findById(id);
        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        // Agregar los archivos
        archivos.forEach(archivo => {
            proyecto.archivosPublicos.push({
                nombre: archivo.nombre,
                tipo: archivo.tipo,
                url: archivo.url,
                createdAt: new Date()
            });
        });

        await proyecto.save();

        res.json({
            success: true,
            message: 'Archivos agregados exitosamente',
            data: {
                _id: proyecto._id,
                archivosPublicos: proyecto.archivosPublicos,
                updatedAt: proyecto.updatedAt
            }
        });

    } catch (error) {
        console.error('Error al agregar archivos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar archivos',
            error: error.message
        });
    }
};

/**
 * Actualizar pagos del proyecto (anticipo, segundoPago, liquidacion)
 * PATCH /api/proyectos/:id/pagos
 */
export const actualizarPagos = async (req, res) => {
    try {
        const { id } = req.params;
        const { anticipo, segundoPago, liquidacion } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de proyecto inválido' });
        }

        const proyecto = await Proyecto.findById(id);
        if (!proyecto) {
            return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }

        // Permisos: solo admin e ingeniero pueden actualizar pagos
        const userRole = req.admin?.rol;
        if (userRole === 'cliente') {
            return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar pagos' });
        }

        if (anticipo !== undefined) proyecto.anticipo = anticipo;
        if (segundoPago !== undefined) proyecto.segundoPago = segundoPago;
        if (liquidacion !== undefined) proyecto.liquidacion = liquidacion;

        await proyecto.save();

        res.json({
            success: true,
            message: 'Pagos actualizados exitosamente',
            data: {
                _id: proyecto._id,
                anticipo: proyecto.anticipo,
                segundoPago: proyecto.segundoPago,
                liquidacion: proyecto.liquidacion,
                updatedAt: proyecto.updatedAt
            }
        });

    } catch (error) {
        console.error('Error al actualizar pagos:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar pagos', error: error.message });
    }
};

/**
 * Eliminar archivo público del proyecto
 * DELETE /api/proyectos/:id/archivos/:fileId
 */
export const eliminarArchivoPublico = async (req, res) => {
    try {
        const { id, fileId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de proyecto inválido'
            });
        }

        const proyecto = await Proyecto.findById(id);
        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        // Eliminar el archivo
        proyecto.archivosPublicos = proyecto.archivosPublicos.filter(
            archivo => archivo._id.toString() !== fileId
        );

        await proyecto.save();

        res.json({
            success: true,
            message: 'Archivo eliminado exitosamente',
            data: {
                _id: proyecto._id,
                archivosPublicos: proyecto.archivosPublicos,
                updatedAt: proyecto.updatedAt
            }
        });

    } catch (error) {
        console.error('Error al eliminar archivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar archivo',
            error: error.message
        });
    }
};

/**
 * Eliminar proyecto
 * DELETE /api/proyectos/:id
 */
export const eliminarProyecto = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de proyecto inválido'
            });
        }

        // Solo admin puede eliminar proyectos
        const userRole = req.admin.rol;
        if (userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Solo administradores pueden eliminar proyectos'
            });
        }

        const proyecto = await Proyecto.findByIdAndDelete(id);
        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Proyecto eliminado exitosamente',
            data: null
        });

    } catch (error) {
        console.error('Error al eliminar proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar proyecto',
            error: error.message
        });
    }
};

// --- Aliases / Public endpoints expected by proyectos.routes.js ---
// Reuse existing implementations for public-facing route names
export const obtenerProyectoPublico = obtenerProyecto;
export const actualizarTimelinePublico = actualizarTimeline;

export const agregarArchivoPublico = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de proyecto inválido' });
        }

        const proyecto = await Proyecto.findById(id);
        if (!proyecto) {
            return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
        }

        // If a file was uploaded via multer, add it
        if (req.file) {
            const fileUrl = `/uploads/projects/${req.file.filename}`;
            proyecto.archivosPublicos.push({
                nombre: req.file.originalname,
                tipo: req.file.mimetype,
                url: fileUrl,
                createdAt: new Date()
            });
            await proyecto.save();

            return res.json({
                success: true,
                message: 'Archivo público agregado exitosamente',
                data: { _id: proyecto._id, archivosPublicos: proyecto.archivosPublicos, updatedAt: proyecto.updatedAt }
            });
        }

        // Fallback: accept archivos array in body (reuse existing logic)
        const { archivos } = req.body;
        if (archivos && Array.isArray(archivos)) {
            archivos.forEach(archivo => {
                proyecto.archivosPublicos.push({ nombre: archivo.nombre, tipo: archivo.tipo, url: archivo.url, createdAt: new Date() });
            });
            await proyecto.save();
            return res.json({ success: true, message: 'Archivos agregados exitosamente', data: { _id: proyecto._id, archivosPublicos: proyecto.archivosPublicos, updatedAt: proyecto.updatedAt } });
        }

        return res.status(400).json({ success: false, message: 'No se recibió archivo ni datos válidos' });

    } catch (error) {
        console.error('Error en agregarArchivoPublico:', error);
        res.status(500).json({ success: false, message: 'Error al agregar archivo público', error: error.message });
    }
};
