import OrdenTrabajo from '../models/ordenTrabajo.model.js';
import Citas from '../models/citas.model.js';
import Notificaciones from '../models/notificaciones.model.js';
import Clientes from '../models/admin.model.js';

// Crear orden de trabajo (se ejecuta al finalizar una cita)
export const crearOrdenTrabajo = async (req, res) => {
    try {
        const { citaId, ingenieroId, fechaEstimadaFinalizacion, notasInternas } = req.body;

        // Verificar que la cita existe
        const cita = await Citas.findById(citaId).populate('diseno').populate('cliente');
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

        // Crear la orden de trabajo
        const ordenTrabajo = new OrdenTrabajo({
            numeroSeguimiento,
            cita: citaId,
            cliente: cita.cliente._id,
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

        // Notificar al cliente
        await Notificaciones.crearNotificacion({
            destinatario: cita.cliente._id,
            tipo: 'cambio_estado_orden',
            titulo: 'Orden de trabajo creada',
            mensaje: `Tu orden #${numeroSeguimiento} ha sido creada. Puedes seguir el progreso con este número.`,
            entidadRelacionada: {
                tipo: 'OrdenTrabajo',
                id: ordenTrabajo._id
            },
            prioridad: 'alta'
        });

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
        if (req.user.rol !== 'admin') {
            return res.status(403).json({ message: "No tienes permisos para ver todas las órdenes" });
        }

        const ordenes = await OrdenTrabajo.find()
            .populate('cliente', 'nombre correo telefono')
            .populate('diseno', 'nombre precio categoria')
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
            .populate('cliente', 'nombre correo telefono')
            .populate('diseno')
            .populate('ingenieroAsignado', 'nombre correo')
            .populate('cita')
            .populate('historialEstados.modificadoPor', 'nombre')
            .populate('evidencias.subidoPor', 'nombre');

        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        // Verificar permisos (admin, ingeniero asignado, o cliente propietario)
        const esAdmin = req.user.rol === 'admin';
        const esIngenieroAsignado = orden.ingenieroAsignado && orden.ingenieroAsignado._id.toString() === req.user.id;
        const esCliente = orden.cliente._id.toString() === req.user.id;

        if (!esAdmin && !esIngenieroAsignado && !esCliente) {
            return res.status(403).json({ message: "No tienes permisos para ver esta orden" });
        }

        // Si es cliente, ocultar notas internas
        if (esCliente && !esAdmin) {
            orden.notasInternas = undefined;
        }

        res.json(orden);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener orden de trabajo", error: error.message });
    }
};

// Obtener orden por número de seguimiento (PÚBLICO - sin autenticación)
export const obtenerOrdenPorNumeroSeguimiento = async (req, res) => {
    try {
        const { numeroSeguimiento } = req.params;

        const orden = await OrdenTrabajo.findOne({ numeroSeguimiento: numeroSeguimiento.toUpperCase() })
            .populate('diseno', 'nombre descripcion categoria imagenes')
            .populate('evidencias.subidoPor', 'nombre')
            .select('-notasInternas -cita -cliente.password'); // Excluir información sensible

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
        if (req.user.rol !== 'admin' && req.user.rol !== 'ingeniero') {
            return res.status(403).json({ message: "No tienes permisos para actualizar estados" });
        }

        const orden = await OrdenTrabajo.findById(id);
        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        // Si es ingeniero, verificar que esté asignado
        if (req.user.rol === 'ingeniero' && orden.ingenieroAsignado?.toString() !== req.user.id) {
            return res.status(403).json({ message: "No estás asignado a esta orden" });
        }

        // Cambiar estado usando el método del modelo
        await orden.cambiarEstado(nuevoEstado, req.user.id, comentario);

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
        if (req.user.rol !== 'admin') {
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
        if (req.user.rol !== 'admin' && req.user.rol !== 'ingeniero') {
            return res.status(403).json({ message: "No tienes permisos para agregar evidencias" });
        }

        const orden = await OrdenTrabajo.findById(id);
        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        // Si es ingeniero, verificar que esté asignado
        if (req.user.rol === 'ingeniero' && orden.ingenieroAsignado?.toString() !== req.user.id) {
            return res.status(403).json({ message: "No estás asignado a esta orden" });
        }

        orden.evidencias.push({
            tipo,
            url,
            public_id,
            descripcion,
            estado: estado || orden.estado,
            subidoPor: req.user.id
        });

        await orden.save();

        // Notificar al cliente
        await Notificaciones.crearNotificacion({
            destinatario: orden.cliente,
            tipo: 'cambio_estado_orden',
            titulo: 'Nueva evidencia agregada',
            mensaje: `Se agregó nueva evidencia a tu orden #${orden.numeroSeguimiento}`,
            entidadRelacionada: {
                tipo: 'OrdenTrabajo',
                id: orden._id
            }
        });

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
        if (req.user.rol !== 'admin' && req.user.id !== ingenieroId) {
            return res.status(403).json({ message: "No tienes permisos para ver estas órdenes" });
        }

        const ordenes = await OrdenTrabajo.find({ ingenieroAsignado: ingenieroId })
            .populate('cliente', 'nombre correo telefono')
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
        if (req.user.rol !== 'arquitecto' && req.user.rol !== 'admin') {
            return res.status(403).json({ message: "No tienes permisos para ver estas órdenes" });
        }

        const ordenes = await OrdenTrabajo.find({ estado: 'pendiente_diseño' })
            .populate('cliente', 'nombre correo telefono')
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
        if (req.user.rol !== 'admin' && req.user.rol !== 'ingeniero') {
            return res.status(403).json({ message: "No tienes permisos para finalizar órdenes" });
        }

        const orden = await OrdenTrabajo.findById(id);
        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        // Si es ingeniero, verificar que esté asignado
        if (req.user.rol === 'ingeniero' && orden.ingenieroAsignado?.toString() !== req.user.id) {
            return res.status(403).json({ message: "No estás asignado a esta orden" });
        }

        await orden.cambiarEstado('completado', req.user.id, comentario || 'Orden finalizada');

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
