import mongoose from 'mongoose';
import crypto from 'crypto';
import Citas from "../models/citas.model.js";
import Admin from "../models/admin.model.js";
import OrdenTrabajo from "../models/ordenTrabajo.model.js";
import Notificaciones from "../models/notificaciones.model.js";

// Crear cita (ruta pública, no requiere autenticación)
export const crearCita = async (req, res) => {
  try {
    const {
      fechaAgendada,
      nombreCliente,
      correoCliente,
      telefonoCliente,
      diseno,
      informacionAdicional
    } = req.body;

    // Validaciones básicas
    if (!fechaAgendada) return res.status(400).json({ message: "Fecha agendada es requerida" });
    if (!nombreCliente) return res.status(400).json({ message: "Nombre del cliente es requerido" });
    if (!correoCliente) return res.status(400).json({ message: "Correo del cliente es requerido" });
    if (!telefonoCliente) return res.status(400).json({ message: "Teléfono del cliente es requerido" });

    // Parse y validación de fecha
    let fechaObj;
    if (typeof fechaAgendada === 'number' || /^\d+$/.test(String(fechaAgendada))) {
      fechaObj = new Date(Number(fechaAgendada));
    } else {
      fechaObj = new Date(String(fechaAgendada));
    }
    if (!fechaObj || isNaN(fechaObj.getTime())) {
      return res.status(400).json({ message: "Fecha agendada inválida" });
    }

    // Verificar que la fecha sea futura
    const ahora = new Date();
    if (fechaObj <= ahora) {
      return res.status(400).json({ message: "La fecha agendada debe ser posterior a la fecha actual" });
    }

    // Validar ObjectId del diseño si se proporciona
    if (diseno && !mongoose.Types.ObjectId.isValid(diseno)) {
      return res.status(400).json({ message: "ID de diseño inválido" });
    }

    // Crear y guardar cita
    const nuevaCita = new Citas({
      fechaAgendada: fechaObj,
      nombreCliente: nombreCliente.trim(),
      correoCliente: correoCliente.toLowerCase().trim(),
      telefonoCliente: telefonoCliente.trim(),
      diseno: diseno || null,
      informacionAdicional: informacionAdicional || '',
      estado: 'programada'
    });

    const citaGuardada = await nuevaCita.save();

    // Poblar diseño si existe
    let citaCompleta = citaGuardada;
    if (citaGuardada.diseno) {
      citaCompleta = await Citas.findById(citaGuardada._id)
        .populate('diseno', 'nombre descripcion imagenes');
    }

    return res.status(201).json({
      message: "Cita creada exitosamente",
      cita: citaCompleta
    });
  } catch (error) {
    console.error('Error en crearCita:', error);
    return res.status(500).json({ message: "Error al crear la cita", error: error.message });
  }
};

// Cancelar cita (requiere autenticación de admin)
export const cancelarCita = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de cita inválido" });
    }

    const cita = await Citas.findById(id);
    if (!cita) return res.status(404).json({ message: "Cita no encontrada" });

    // Actualizar estado a cancelada
    cita.estado = 'cancelada';
    await cita.save();

    return res.status(200).json({
      message: "Cita cancelada exitosamente",
      cita
    });
  } catch (error) {
    console.error('Error en cancelarCita:', error);
    return res.status(500).json({ message: "Error al cancelar la cita", error: error.message });
  }
};

export const obtenerCitasPorCliente = async (req, res) => {
    try {
        const { correo } = req.query;
        
        if (!correo) {
            return res.status(400).json({ message: "Correo es requerido" });
        }

        // Obtenemos las citas por correo del cliente
        const citas = await Citas.find({
            correoCliente: correo.toLowerCase().trim()
        })
        .populate({
            path: 'diseno',
            select: 'nombre descripcion imagenes'
        })
        .sort({ fechaAgendada: -1 })
        .lean();

        res.json(citas);
    } catch (error) {
        console.error('Error en obtenerCitasPorCliente:', error);
        res.status(500).json({ 
            message: "Error al obtener las citas", 
            error: error.message 
        });
    }
};

export const obtenerCitasPorCarro = async (req, res) => {
    try {
        // Esta función ya no aplica al nuevo modelo
        return res.status(400).json({ 
            message: "Función obsoleta: las citas ya no están asociadas a carros" 
        });
    } catch (error) {
        console.error('Error en obtenerCitasPorCarro:', error);
        return res.status(500).json({
            message: "Error en la operación",
            error: error.message
        });
    }
};

export const actualizarCita = async (req, res) => {
    try {
        const { id } = req.params;
        const { fechaAgendada, fechaInicio, fechaTermino, nombreCliente, correoCliente, telefonoCliente, informacionAdicional, estado, diseno } = req.body;

        const cita = await Citas.findById(id);
        if (!cita) return res.status(404).json({ message: "Cita no encontrada" });

        // Construir objeto de actualización
        const updateData = {};
        if (fechaAgendada) updateData.fechaAgendada = new Date(fechaAgendada);
        if (fechaInicio) updateData.fechaInicio = new Date(fechaInicio);
        if (fechaTermino) updateData.fechaTermino = new Date(fechaTermino);
        if (nombreCliente) updateData.nombreCliente = nombreCliente.trim();
        if (correoCliente) updateData.correoCliente = correoCliente.toLowerCase().trim();
        if (telefonoCliente) updateData.telefonoCliente = telefonoCliente.trim();
        if (informacionAdicional !== undefined) updateData.informacionAdicional = informacionAdicional;
        if (estado) updateData.estado = estado;
        if (diseno !== undefined) updateData.diseno = diseno;

        const citaActualizada = await Citas.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate({
            path: 'diseno',
            select: 'nombre descripcion imagenes'
        });

        res.json(citaActualizada);
    } catch (error) {
        console.error('Error en actualizarCita:', error);
        res.status(500).json({ message: error.message });
    }
};

export const eliminarCita = async (req, res) => {
    try {
        const { id } = req.params;

        const cita = await Citas.findById(id);
        if (!cita) return res.status(404).json({ message: "Cita no encontrada" });

        await Citas.findByIdAndDelete(id);

        res.json({ message: "Cita eliminada correctamente" });
    } catch (error) {
        console.error('Error en eliminarCita:', error);
        res.status(500).json({ message: error.message });
    }
};

export const obtenerCitas = async (req, res) => {
    try {
        const citas = await Citas.find()
            .populate({
                path: 'diseno',
                select: 'nombre descripcion imagenes'
            })
            .sort({ fechaAgendada: -1 })
            .lean();
        
        res.json(citas);
    } catch (error) {
        console.error('Error en obtenerCitas:', error);
        res.status(500).json({ message: error.message });
    }
};

export const obtenerCita = async (req, res) => {
    try {
        const { id } = req.params;
        const cita = await Citas.findById(id)
            .populate({
                path: 'diseno',
                select: 'nombre descripcion imagenes'
            });
        
        if (!cita) return res.status(404).json({ message: "Cita no encontrada" });
        
        res.json(cita);
    } catch (error) {
        console.error('Error en obtenerCita:', error);
        res.status(500).json({ message: error.message });
    }
};

export const getAllCitas = async (req, res) => {
    try {
        const citas = await Citas.find()
            .populate({
                path: 'diseno',
                select: 'nombre descripcion imagenes'
            })
            .sort({ fechaAgendada: -1 })
            .lean();

        res.json(citas);
    } catch (error) {
        console.error('Error en getAllCitas:', error);
        res.status(500).json({ 
            message: "Error al obtener todas las citas", 
            error: error.message 
        });
    }
};

export const updateCitaEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        // Validar que el estado sea válido
        const estadosValidos = ['programada', 'en_proceso', 'completada', 'cancelada'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ 
                message: "Estado no válido" 
            });
        }

        const updateData = { estado };

        // Si el estado es 'completada', agregar fechaTermino
        if (estado === 'completada' && !req.body.fechaTermino) {
            updateData.fechaTermino = new Date();
        }

        // Si el estado es 'en_proceso', agregar fechaInicio si no existe
        if (estado === 'en_proceso') {
            const cita = await Citas.findById(id);
            if (cita && !cita.fechaInicio) {
                updateData.fechaInicio = new Date();
            }
        }

        const citaActualizada = await Citas.findByIdAndUpdate(
            id,
            updateData,
            { 
                new: true,
                runValidators: true
            }
        ).populate({
            path: 'diseno',
            select: 'nombre descripcion imagenes'
        });

        if (!citaActualizada) {
            return res.status(404).json({ 
                message: "Cita no encontrada" 
            });
        }

        res.json(citaActualizada);
    } catch (error) {
        console.error('Error en updateCitaEstado:', error);
        res.status(500).json({ 
            message: "Error al actualizar el estado de la cita", 
            error: error.message 
        });
    }
};

// Iniciar cita (cambia estado a en_proceso y registra fechaInicio)
export const iniciarCita = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que sea admin o ingeniero
        if (req.admin && req.admin.rol !== 'admin' && req.admin.rol !== 'ingeniero') {
            return res.status(403).json({ message: "No tienes permisos para iniciar citas" });
        }

        const cita = await Citas.findById(id);
        if (!cita) {
            return res.status(404).json({ message: "Cita no encontrada" });
        }

        if (cita.estado !== 'programada') {
            return res.status(400).json({ message: "La cita no está en estado programada" });
        }

        cita.estado = 'en_proceso';
        cita.fechaInicio = new Date();
        await cita.save();

        // Poblar diseño para respuesta si existe
        if (cita.diseno) {
            await cita.populate({
                path: 'diseno',
                select: 'nombre descripcion imagenes'
            });
        }

        res.json({
            message: "Cita iniciada exitosamente",
            cita
        });

    } catch (error) {
        console.error('Error en iniciarCita:', error);
        res.status(500).json({ message: "Error al iniciar cita", error: error.message });
    }
};

// Finalizar cita (cambia estado a completada, registra fechaTermino y crea orden de trabajo)
export const finalizarCita = async (req, res) => {
    try {
        const { id } = req.params;
        const { ingenieroId, fechaEstimadaFinalizacion, notasInternas } = req.body;

        // Verificar que sea admin o ingeniero
        if (req.admin && req.admin.rol !== 'admin' && req.admin.rol !== 'ingeniero') {
            return res.status(403).json({ message: "No tienes permisos para finalizar citas" });
        }

        const cita = await Citas.findById(id).populate('diseno');
        if (!cita) {
            return res.status(404).json({ message: "Cita no encontrada" });
        }

        if (cita.estado === 'completada') {
            return res.status(400).json({ message: "La cita ya está completada" });
        }

        // Actualizar cita
        cita.estado = 'completada';
        cita.fechaTermino = new Date();
        await cita.save();

        // Generar número de seguimiento único
        const numeroSeguimiento = crypto.randomBytes(4).toString('hex').toUpperCase();

        // Determinar estado inicial según si tiene diseño o no
        const estadoInicial = cita.diseno ? 'maquetacion' : 'pendiente_diseño';

        // Crear la orden de trabajo
        const ordenTrabajo = new OrdenTrabajo({
            numeroSeguimiento,
            cita: cita._id,
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
            const arquitectos = await Admin.find({ rol: 'arquitecto' });
            
            for (const arquitecto of arquitectos) {
                await Notificaciones.create({
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

        // Si se asignó ingeniero, notificarle
        if (ingenieroId) {
            await Notificaciones.create({
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
            message: "Cita finalizada y orden de trabajo creada exitosamente",
            cita,
            ordenTrabajo: {
                _id: ordenTrabajo._id,
                numeroSeguimiento,
                estado: estadoInicial
            }
        });

    } catch (error) {
        console.error('Error en finalizarCita:', error);
        res.status(500).json({ message: "Error al finalizar cita", error: error.message });
    }
};