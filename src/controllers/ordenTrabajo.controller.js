import OrdenTrabajo from '../models/ordenTrabajo.model.js';
import Citas from '../models/citas.model.js';
import Notificaciones from '../models/notificaciones.model.js';
import Clientes from '../models/admin.model.js';

// Crear orden de trabajo (se ejecuta al finalizar una cita)
export const crearOrdenTrabajo = async (req, res) => {
    try {
        const { citaId, ingenieroId, fechaEstimadaFinalizacion, notasInternas } = req.body;

        // Verificar que la cita existe
        const cita = await Citas.findById(citaId).populate('diseno');
        if (!cita) {
            return res.status(404).json({ message: "Cita no encontrada" });
        }

        // Verificar que la cita esté completada
        if (cita.estado !== 'completada') {
            return res.status(400).json({ message: "La cita debe estar completada para crear una orden de trabajo" });
        }

        // Generar número de seguimiento único
        const numeroSeguimiento = await OrdenTrabajo.generarNumeroSeguimiento();

        // Determinar estado inicial según si tiene diseño o no
        const estadoInicial = cita.diseno ? 'maquetacion' : 'pendiente_diseño';

        // Crear la orden de trabajo (cliente embebido desde datos de la cita)
        const ordenTrabajo = new OrdenTrabajo({
            numeroSeguimiento,
            cita: citaId,
            cliente: {
                nombre: cita.nombreCliente,
                correo: cita.correoCliente,
                telefono: cita.telefonoCliente
            },
            diseno: cita.diseno?._id || null,
            ingenieroAsignado: ingenieroId || null,
            estado: estadoInicial,
            fechaEstimadaFinalizacion,
            notasInternas: notasInternas || ''
        });

        await ordenTrabajo.save();

        // Si no tiene diseño, notificar a los arquitectos
        if (!cita.diseno) {
            const arquitectos = await Clientes.find({ rol: 'arquitecto' });
            
            for (const arquitecto of arquitectos) {
                await Notificaciones.crearNotificacion({
                    destinatario: arquitecto._id,
                    tipo: 'diseño_pendiente',
                    titulo: 'Nuevo diseño requerido',
                    mensaje: `La orden #${numeroSeguimiento} requiere un diseño preliminar`,
                    entidadRelacionada: {
                        tipo: 'OrdenTrabajo',
                        id: ordenTrabajo._id
                    },
                    prioridad: 'alta'
                });
            }
        }
        // Cliente sin cuenta User: puede ver progreso con GET /ordenes/progreso?correo=...&numeroSeguimiento=...

        // Si se asignó ingeniero, notificarle
        if (ingenieroId) {
            await Notificaciones.crearNotificacion({
                destinatario: ingenieroId,
                tipo: 'asignacion_orden',
                titulo: 'Nueva orden asignada',
                mensaje: `Te han asignado la orden #${numeroSeguimiento}`,
                entidadRelacionada: {
                    tipo: 'OrdenTrabajo',
                    id: ordenTrabajo._id
                },
                prioridad: 'alta'
            });
        }

        res.status(201).json({
            message: "Orden de trabajo creada exitosamente",
            numeroSeguimiento,
            ordenTrabajo
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al crear orden de trabajo", error: error.message });
    }
};

// Obtener todas las órdenes de trabajo (Admin)
export const obtenerOrdenesTrabajo = async (req, res) => {
    try {
        // Verificar que sea admin
        if (req.admin?.rol !== 'admin') {
            return res.status(403).json({ message: "No tienes permisos para ver todas las órdenes" });
        }

        const ordenes = await OrdenTrabajo.find()
            .populate('diseno', 'nombre precioBase categoria')
            .populate('ingenieroAsignado', 'nombre correo')
            .populate('cita')
            .sort({ createdAt: -1 });

        res.json(ordenes);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener órdenes de trabajo", error: error.message });
    }
};

// Obtener una orden de trabajo por ID (autenticado)
export const obtenerOrdenTrabajo = async (req, res) => {
    try {
        const { id } = req.params;

        const orden = await OrdenTrabajo.findById(id)
            .populate('diseno')
            .populate('ingenieroAsignado', 'nombre correo')
            .populate('cita')
            .populate('historialEstados.modificadoPor', 'nombre')
            .populate('evidencias.subidoPor', 'nombre');

        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        // Verificar permisos (admin o ingeniero asignado; cliente ve por endpoint público con correo + numeroSeguimiento)
        const esAdmin = req.admin?.rol === 'admin';
        const esIngenieroAsignado = orden.ingenieroAsignado && orden.ingenieroAsignado._id.toString() === req.admin?.id;

        if (!esAdmin && !esIngenieroAsignado) {
            return res.status(403).json({ message: "No tienes permisos para ver esta orden" });
        }

        res.json(orden);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener orden de trabajo", error: error.message });
    }
};

// Obtener progreso por número de seguimiento (PÚBLICO - solo se valida el id de la orden)
export const obtenerProgresoPorCorreo = async (req, res) => {
    try {
        const numeroSeguimiento = req.query.numeroSeguimiento;
        if (!numeroSeguimiento?.trim()) {
            return res.status(400).json({ message: "Se requiere numeroSeguimiento (query: ?numeroSeguimiento=...)" });
        }

        const orden = await OrdenTrabajo.findOne({
            numeroSeguimiento: numeroSeguimiento.toString().trim().toUpperCase()
        })
            .populate('diseno', 'nombre descripcion categoria imagenes')
            .select('-notasInternas');

        if (!orden) {
            return res.status(404).json({ message: "No se encontró el proyecto con ese número de seguimiento" });
        }

        const respuesta = {
            numeroSeguimiento: orden.numeroSeguimiento,
            estado: orden.estado,
            porcentajeProgreso: orden.porcentajeProgreso,
            diseno: orden.diseno,
            evidencias: orden.evidencias?.map(ev => ({
                tipo: ev.tipo,
                url: ev.url,
                descripcion: ev.descripcion,
                estado: ev.estado,
                fecha: ev.fecha
            })) || [],
            fechaInicio: orden.fechaInicio,
            fechaEstimadaFinalizacion: orden.fechaEstimadaFinalizacion,
            fechaFinalizacion: orden.fechaFinalizacion,
            historialEstados: orden.historialEstados?.map(h => ({
                estadoAnterior: h.estadoAnterior,
                estadoNuevo: h.estadoNuevo,
                fecha: h.fecha,
                comentario: h.comentario
            })) || []
        };

        res.json(respuesta);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al consultar progreso", error: error.message });
    }
};

// Obtener orden por número de seguimiento (PÚBLICO - sin autenticación)
export const obtenerOrdenPorNumeroSeguimiento = async (req, res) => {
    try {
        const { numeroSeguimiento } = req.params;

        const orden = await OrdenTrabajo.findOne({ numeroSeguimiento: numeroSeguimiento.toUpperCase() })
            .populate('diseno', 'nombre descripcion categoria imagenes')
            .populate('evidencias.subidoPor', 'nombre')
            .select('-notasInternas'); // Excluir información sensible

        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        // Retornar solo información pública
        const respuestaPublica = {
            numeroSeguimiento: orden.numeroSeguimiento,
            estado: orden.estado,
            porcentajeProgreso: orden.porcentajeProgreso,
            diseno: orden.diseno,
            evidencias: orden.evidencias.map(ev => ({
                tipo: ev.tipo,
                url: ev.url,
                descripcion: ev.descripcion,
                estado: ev.estado,
                fecha: ev.fecha
            })),
            fechaInicio: orden.fechaInicio,
            fechaEstimadaFinalizacion: orden.fechaEstimadaFinalizacion,
            fechaFinalizacion: orden.fechaFinalizacion,
            historialEstados: orden.historialEstados.map(h => ({
                estadoAnterior: h.estadoAnterior,
                estadoNuevo: h.estadoNuevo,
                fecha: h.fecha,
                comentario: h.comentario
            }))
        };

        res.json(respuestaPublica);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener orden de trabajo", error: error.message });
    }
};

// Actualizar estado de la orden
export const actualizarEstadoOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevoEstado, comentario } = req.body;

        // Verificar que sea admin o ingeniero
        if (req.admin.rol !== 'admin' && req.admin.rol !== 'ingeniero') {
            return res.status(403).json({ message: "No tienes permisos para actualizar estados" });
        }

        const orden = await OrdenTrabajo.findById(id);
        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        // Si es ingeniero, verificar que esté asignado
        if (req.admin.rol === 'ingeniero' && orden.ingenieroAsignado?.toString() !== req.admin.id) {
            return res.status(403).json({ message: "No estás asignado a esta orden" });
        }

        // Cambiar estado usando el método del modelo
        await orden.cambiarEstado(nuevoEstado, req.admin.id, comentario);

        // Crear notificación de cambio de estado
        await Notificaciones.notificarCambioEstadoOrden(orden, nuevoEstado);

        res.json({
            message: "Estado actualizado exitosamente",
            orden
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar estado", error: error.message });
    }
};

// Asignar ingeniero a una orden
export const asignarIngeniero = async (req, res) => {
    try {
        const { id } = req.params;
        const { ingenieroId } = req.body;

        // Solo admin puede asignar
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "Solo admin puede asignar ingenieros" });
        }

        // Verificar que el ingeniero existe y tiene el rol correcto
        const ingeniero = await Clientes.findById(ingenieroId);
        if (!ingeniero || ingeniero.rol !== 'ingeniero') {
            return res.status(400).json({ message: "Usuario no es un ingeniero válido" });
        }

        const orden = await OrdenTrabajo.findById(id);
        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        orden.ingenieroAsignado = ingenieroId;
        await orden.save();

        // Notificar al ingeniero
        await Notificaciones.crearNotificacion({
            destinatario: ingenieroId,
            tipo: 'asignacion_orden',
            titulo: 'Nueva orden asignada',
            mensaje: `Te han asignado la orden #${orden.numeroSeguimiento}`,
            entidadRelacionada: {
                tipo: 'OrdenTrabajo',
                id: orden._id
            },
            prioridad: 'alta'
        });

        res.json({
            message: "Ingeniero asignado exitosamente",
            orden
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al asignar ingeniero", error: error.message });
    }
};

// Agregar evidencia a una orden
export const agregarEvidencia = async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo, url, public_id, descripcion, estado } = req.body;

        // Verificar que sea admin o ingeniero
        if (req.admin.rol !== 'admin' && req.admin.rol !== 'ingeniero') {
            return res.status(403).json({ message: "No tienes permisos para agregar evidencias" });
        }

        const orden = await OrdenTrabajo.findById(id);
        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        // Si es ingeniero, verificar que esté asignado
        if (req.admin.rol === 'ingeniero' && orden.ingenieroAsignado?.toString() !== req.admin.id) {
            return res.status(403).json({ message: "No estás asignado a esta orden" });
        }

        orden.evidencias.push({
            tipo,
            url,
            public_id,
            descripcion,
            estado: estado || orden.estado,
            subidoPor: req.admin.id
        });

        await orden.save();

        res.json({
            message: "Evidencia agregada exitosamente",
            orden
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al agregar evidencia", error: error.message });
    }
};

// Obtener órdenes por ingeniero
export const obtenerOrdenesPorIngeniero = async (req, res) => {
    try {
        const { ingenieroId } = req.params;

        // Verificar permisos (admin o el mismo ingeniero)
        if (req.admin.rol !== 'admin' && req.admin.id !== ingenieroId) {
            return res.status(403).json({ message: "No tienes permisos para ver estas órdenes" });
        }

        const ordenes = await OrdenTrabajo.find({ ingenieroAsignado: ingenieroId })
            .populate('diseno', 'nombre categoria')
            .populate('cita')
            .sort({ createdAt: -1 });

        res.json(ordenes);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener órdenes", error: error.message });
    }
};

// Obtener órdenes pendientes de diseño (para arquitectos)
export const obtenerOrdenesPendientesDiseno = async (req, res) => {
    try {
        // Verificar que sea arquitecto o admin
        if (req.admin.rol !== 'arquitecto' && req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "No tienes permisos para ver estas órdenes" });
        }

        const ordenes = await OrdenTrabajo.find({ estado: 'pendiente_diseño' })
            .populate('cita')
            .sort({ createdAt: -1 });

        res.json(ordenes);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener órdenes pendientes", error: error.message });
    }
};

// Finalizar orden de trabajo
export const finalizarOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const { comentario } = req.body;

        // Verificar que sea admin o ingeniero
        if (req.admin.rol !== 'admin' && req.admin.rol !== 'ingeniero') {
            return res.status(403).json({ message: "No tienes permisos para finalizar órdenes" });
        }

        const orden = await OrdenTrabajo.findById(id);
        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        // Si es ingeniero, verificar que esté asignado
        if (req.admin.rol === 'ingeniero' && orden.ingenieroAsignado?.toString() !== req.admin.id) {
            return res.status(403).json({ message: "No estás asignado a esta orden" });
        }

        await orden.cambiarEstado('completado', req.admin.id, comentario || 'Orden finalizada');

        // Notificación se crea automáticamente en cambiarEstado

        res.json({
            message: "Orden finalizada exitosamente",
            orden
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al finalizar orden", error: error.message });
    }
};
