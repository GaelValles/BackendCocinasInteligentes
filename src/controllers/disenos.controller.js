import Disenos from '../models/disenos.model.js';
import Materiales from '../models/materiales.model.js';
import Notificaciones from '../models/notificaciones.model.js';
import Clientes from '../models/admin.model.js';
import OrdenTrabajo from '../models/ordenTrabajo.model.js';
import Tarea from '../models/tarea.model.js';

const disenoToTaskEstado = (estadoDiseno) => (estadoDiseno === 'autorizado' ? 'completada' : 'pendiente');

const syncTaskFromDiseno = async (diseno, req, action = 'sync_diseno') => {
    const assignedId = diseno.arquitecto ? String(diseno.arquitecto) : null;
    let assignedName = '';

    if (assignedId) {
        const user = await Clientes.findById(assignedId, 'nombre');
        assignedName = user?.nombre || '';
    }

    const disenoId = String(diseno._id);
    const existing = await Tarea.findOne({
        $or: [
            { sourceType: 'diseno', sourceId: disenoId },
            { sourceDisenoId: disenoId }
        ]
    });

    const payload = {
        etapa: existing?.etapa && existing.etapa !== 'disenos' ? existing.etapa : 'disenos',
        estado: disenoToTaskEstado(diseno.estado),
        asignadoA: assignedId ? [assignedId] : [],
        asignadoANombre: assignedName ? [assignedName] : [],
        notas: diseno.descripcion || '',
        prioridad: 'media',
        designApprovedByAdmin: diseno.estado === 'autorizado',
        sourceType: 'diseno',
        sourceId: disenoId,
        // Keep legacy field in sync while old records still exist.
        sourceDisenoId: disenoId
    };

    if (existing) {
        Object.assign(existing, payload);
        existing.historialCambios = existing.historialCambios || [];
        existing.historialCambios.push({
            by: req.admin?._id ? String(req.admin._id) : null,
            action,
            changes: { disenoId: String(diseno._id), estadoDiseno: diseno.estado },
            at: new Date()
        });
        await existing.save();
        return existing;
    }

    const nueva = new Tarea({
        ...payload,
        historialCambios: [{
            by: req.admin?._id ? String(req.admin._id) : null,
            action: 'create_from_diseno',
            changes: { disenoId: String(diseno._id), estadoDiseno: diseno.estado },
            at: new Date()
        }]
    });

    await nueva.save();
    return nueva;
};

const removeTaskFromDiseno = async (disenoId) => {
    const id = String(disenoId);
    await Tarea.findOneAndDelete({
        $or: [
            { sourceType: 'diseno', sourceId: id },
            { sourceDisenoId: id }
        ]
    });
};

// Crear diseño (admin o arquitecto)
export const crearDiseno = async (req, res) => {
    try {
        const { 
            nombre, 
            descripcion, 
            imagenes, 
            categoria, 
            materiales, 
            especificaciones,
            estado 
        } = req.body;

        // Verificar permisos (admin o arquitecto)
        if (req.admin.rol !== 'admin' && req.admin.rol !== 'arquitecto') {
            return res.status(403).json({ message: "No tienes permisos para crear diseños" });
        }

        // Validar y calcular precios de materiales
        let materialesConPrecio = [];
        let costoTotal = 0;

        if (materiales && materiales.length > 0) {
            for (const item of materiales) {
                const material = await Materiales.findById(item.materialId);
                if (!material) {
                    return res.status(404).json({ message: `Material ${item.materialId} no encontrado` });
                }

                const precioRegistrado = material.precioUnitario;
                materialesConPrecio.push({
                    material: item.materialId,
                    cantidad: item.cantidad,
                    precioRegistrado
                });

                costoTotal += item.cantidad * precioRegistrado;
            }
        }

        const diseno = new Disenos({
            nombre,
            descripcion,
            imagenes: imagenes || [],
            categoria,
            materiales: materialesConPrecio,
            especificaciones: especificaciones || {},
            precioBase: costoTotal,
            costoMateriales: costoTotal,
            estado: estado || 'borrador',
            arquitecto: req.admin.rol === 'arquitecto' ? req.admin.id : null
        });

        await diseno.save();
        await syncTaskFromDiseno(diseno, req, 'create_diseno');

        res.status(201).json({
            message: "Diseño creado exitosamente",
            diseno
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al crear diseño", error: error.message });
    }
};

// Obtener todos los diseños (admin)
export const obtenerDisenos = async (req, res) => {
    try {
        // Solo admin puede ver todos
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "No tienes permisos" });
        }

        const disenos = await Disenos.find()
            .populate('materiales.material')
            .populate('arquitecto', 'nombre correo')
            .populate('autorizadoPor', 'nombre')
            .sort({ createdAt: -1 });

        res.json(disenos);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener diseños", error: error.message });
    }
};

// Obtener un diseño específico
export const obtenerDiseno = async (req, res) => {
    try {
        const { id } = req.params;

        const diseno = await Disenos.findById(id)
            .populate('materiales.material')
            .populate('arquitecto', 'nombre correo')
            .populate('autorizadoPor', 'nombre');

        if (!diseno) {
            return res.status(404).json({ message: "Diseño no encontrado" });
        }

        res.json(diseno);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener diseño", error: error.message });
    }
};

// Obtener diseños disponibles (autorizados) - PÚBLICO o autenticado
export const obtenerDisenosDisponibles = async (req, res) => {
    try {
        const disenos = await Disenos.find({ 
            disponible: true, 
            estado: 'autorizado' 
        })
            .populate('materiales.material')
            .select('-arquitecto -autorizadoPor'); // Ocultar info de quién lo creó

        res.json(disenos);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener diseños disponibles", error: error.message });
    }
};

// Actualizar diseño
export const actualizarDiseno = async (req, res) => {
    try {
        const { id } = req.params;
        const actualizaciones = req.body;

        // Verificar permisos
        if (req.admin.rol !== 'admin' && req.admin.rol !== 'arquitecto') {
            return res.status(403).json({ message: "No tienes permisos para actualizar diseños" });
        }

        const diseno = await Disenos.findById(id);
        if (!diseno) {
            return res.status(404).json({ message: "Diseño no encontrado" });
        }

        // Si es arquitecto, solo puede actualizar sus propios diseños en borrador
        if (req.admin.rol === 'arquitecto') {
            if (diseno.arquitecto?.toString() !== req.admin.id) {
                return res.status(403).json({ message: "No puedes actualizar diseños de otros arquitectos" });
            }
            if (diseno.estado !== 'borrador') {
                return res.status(403).json({ message: "Solo puedes actualizar diseños en borrador" });
            }
        }

        // Si se actualizan materiales, recalcular precio
        if (actualizaciones.materiales) {
            let materialesConPrecio = [];
            let costoTotal = 0;

            for (const item of actualizaciones.materiales) {
                const material = await Materiales.findById(item.materialId || item.material);
                if (!material) {
                    return res.status(404).json({ message: `Material no encontrado` });
                }

                const precioRegistrado = material.precioUnitario;
                materialesConPrecio.push({
                    material: item.materialId || item.material,
                    cantidad: item.cantidad,
                    precioRegistrado
                });

                costoTotal += item.cantidad * precioRegistrado;
            }

            actualizaciones.materiales = materialesConPrecio;
            actualizaciones.costoMateriales = costoTotal;
            actualizaciones.precio = costoTotal;
        }

        Object.assign(diseno, actualizaciones);
        await diseno.save();
        await syncTaskFromDiseno(diseno, req, 'update_diseno');

        res.json({
            message: "Diseño actualizado exitosamente",
            diseno
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar diseño", error: error.message });
    }
};

// Eliminar diseño
export const eliminarDiseno = async (req, res) => {
    try {
        const { id } = req.params;

        // Solo admin puede eliminar
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "Solo admin puede eliminar diseños" });
        }

        const diseno = await Disenos.findByIdAndDelete(id);
        if (!diseno) {
            return res.status(404).json({ message: "Diseño no encontrado" });
        }

        await removeTaskFromDiseno(diseno._id);

        res.json({ message: "Diseño eliminado exitosamente" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al eliminar diseño", error: error.message });
    }
};

// Subir diseño preliminar (arquitecto)
export const subirDisenoPreliminar = async (req, res) => {
    try {
        const { 
            ordenTrabajoId,
            nombre, 
            descripcion, 
            imagenes, 
            categoria, 
            materiales, 
            especificaciones 
        } = req.body;

        // Verificar que sea arquitecto
        if (req.admin.rol !== 'arquitecto') {
            return res.status(403).json({ message: "Solo arquitectos pueden subir diseños preliminares" });
        }

        // Verificar que la orden existe y está pendiente de diseño
        const orden = await OrdenTrabajo.findById(ordenTrabajoId);
        if (!orden) {
            return res.status(404).json({ message: "Orden de trabajo no encontrada" });
        }

        if (orden.estado !== 'pendiente_diseño') {
            return res.status(400).json({ message: "Esta orden no está pendiente de diseño" });
        }

        // Validar y calcular precios de materiales
        let materialesConPrecio = [];
        let costoTotal = 0;

        if (materiales && materiales.length > 0) {
            for (const item of materiales) {
                const material = await Materiales.findById(item.materialId);
                if (!material) {
                    return res.status(404).json({ message: `Material ${item.materialId} no encontrado` });
                }

                const precioRegistrado = material.precioUnitario;
                materialesConPrecio.push({
                    material: item.materialId,
                    cantidad: item.cantidad,
                    precioRegistrado
                });

                costoTotal += item.cantidad * precioRegistrado;
            }
        }

        const diseno = new Disenos({
            nombre,
            descripcion,
            imagenes: imagenes || [],
            categoria,
            materiales: materialesConPrecio,
            especificaciones: especificaciones || {},
            precioBase: costoTotal,
            costoMateriales: costoTotal,
            estado: 'preliminar',
            arquitecto: req.admin.id,
            disponible: false // No disponible hasta autorización
        });

        await diseno.save();
        await syncTaskFromDiseno(diseno, req, 'create_diseno_preliminar');

        // Vincular diseño a la orden
        orden.diseno = diseno._id;
        await orden.save();

        // Notificar a todos los admins
        const admins = await Clientes.find({ rol: 'admin' });
        for (const admin of admins) {
            await Notificaciones.crearNotificacion({
                destinatario: admin._id,
                tipo: 'diseño_pendiente',
                titulo: 'Diseño preliminar para autorizar',
                mensaje: `El arquitecto ${req.admin.nombre} subió un diseño preliminar para la orden #${orden.numeroSeguimiento}`,
                entidadRelacionada: {
                    tipo: 'Disenos',
                    id: diseno._id
                },
                prioridad: 'alta'
            });
        }

        res.status(201).json({
            message: "Diseño preliminar subido exitosamente. Pendiente de autorización.",
            diseno
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al subir diseño preliminar", error: error.message });
    }
};

// Obtener diseños pendientes de autorización (admin)
export const obtenerDisenosPendientes = async (req, res) => {
    try {
        // Solo admin puede ver pendientes
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "Solo admin puede ver diseños pendientes" });
        }

        const disenos = await Disenos.find({ estado: 'preliminar' })
            .populate('materiales.material')
            .populate('arquitecto', 'nombre correo')
            .sort({ createdAt: -1 });

        res.json(disenos);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener diseños pendientes", error: error.message });
    }
};

// Autorizar diseño (admin)
export const autorizarDiseno = async (req, res) => {
    try {
        const { id } = req.params;

        // Solo admin puede autorizar
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "Solo admin puede autorizar diseños" });
        }

        const diseno = await Disenos.findById(id).populate('arquitecto');
        if (!diseno) {
            return res.status(404).json({ message: "Diseño no encontrado" });
        }

        if (diseno.estado === 'autorizado') {
            return res.status(400).json({ message: "Este diseño ya está autorizado" });
        }

        diseno.estado = 'autorizado';
        diseno.disponible = true;
        diseno.autorizadoPor = req.admin.id;
        diseno.fechaAutorizacion = new Date();
        await diseno.save();
        await syncTaskFromDiseno(diseno, req, 'autorizar_diseno');

        // Notificar al arquitecto
        if (diseno.arquitecto) {
            await Notificaciones.crearNotificacion({
                destinatario: diseno.arquitecto._id,
                tipo: 'diseño_autorizado',
                titulo: 'Diseño autorizado',
                mensaje: `Tu diseño "${diseno.nombre}" ha sido autorizado por ${req.admin.nombre}`,
                entidadRelacionada: {
                    tipo: 'Disenos',
                    id: diseno._id
                },
                prioridad: 'media'
            });
        }

        // Buscar orden de trabajo asociada y actualizar estado
        const orden = await OrdenTrabajo.findOne({ diseno: diseno._id });
        if (orden && orden.estado === 'pendiente_diseño') {
            await orden.cambiarEstado('maquetacion', req.admin.id, 'Diseño autorizado, iniciando maquetación');
            // Cliente (embebido) no tiene User id; puede ver progreso por correo + numeroSeguimiento
        }

        res.json({
            message: "Diseño autorizado exitosamente",
            diseno
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al autorizar diseño", error: error.message });
    }
};

// Rechazar diseño (admin)
export const rechazarDiseno = async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        // Solo admin puede rechazar
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "Solo admin puede rechazar diseños" });
        }

        const diseno = await Disenos.findById(id).populate('arquitecto');
        if (!diseno) {
            return res.status(404).json({ message: "Diseño no encontrado" });
        }

        diseno.estado = 'borrador';
        diseno.disponible = false;
        await diseno.save();
        await syncTaskFromDiseno(diseno, req, 'rechazar_diseno');

        // Notificar al arquitecto
        if (diseno.arquitecto) {
            await Notificaciones.crearNotificacion({
                destinatario: diseno.arquitecto._id,
                tipo: 'diseño_rechazado',
                titulo: 'Diseño rechazado',
                mensaje: `Tu diseño "${diseno.nombre}" requiere ajustes. Motivo: ${motivo || 'No especificado'}`,
                entidadRelacionada: {
                    tipo: 'Disenos',
                    id: diseno._id
                },
                prioridad: 'alta'
            });
        }

        res.json({
            message: "Diseño rechazado. El arquitecto puede modificarlo.",
            diseno
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al rechazar diseño", error: error.message });
    }
};

// Obtener diseños por arquitecto
export const obtenerDisenosPorArquitecto = async (req, res) => {
    try {
        const { arquitectoId } = req.params;

        // Verificar permisos (admin o el mismo arquitecto)
        if (req.admin.rol !== 'admin' && req.admin.id !== arquitectoId) {
            return res.status(403).json({ message: "No tienes permisos para ver estos diseños" });
        }

        const disenos = await Disenos.find({ arquitecto: arquitectoId })
            .populate('materiales.material')
            .populate('autorizadoPor', 'nombre')
            .sort({ createdAt: -1 });

        res.json(disenos);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener diseños", error: error.message });
    }
};
