import mongoose from 'mongoose';
import crypto from 'crypto';
import Citas from "../models/citas.model.js";
import Admin from "../models/admin.model.js";
import OrdenTrabajo from "../models/ordenTrabajo.model.js";
import Notificaciones from "../models/notificaciones.model.js";
import Tarea from '../models/tarea.model.js';
import { upsertTrackingAccessFromTarea } from '../services/trackingAccess.service.js';
import { verifyRecaptchaToken } from '../services/recaptcha.service.js';

const ROLES_ASIGNABLES = ['admin', 'arquitecto', 'empleado', 'ingeniero', 'empleado_general', 'staff'];
const ROLES_OPERATIVOS = ['ingeniero', 'arquitecto', 'empleado', 'empleado_general', 'staff'];
const ESTADOS_CITA_VALIDOS = ['programada', 'en_proceso', 'completada', 'cancelada'];

const citaToTaskEstado = (estadoCita) => (estadoCita === 'completada' ? 'completada' : 'pendiente');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : value);

const parseDateField = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildCitaPayload = (cita) => ({
    fechaAgendada: cita.fechaAgendada || null,
    nombreCliente: cita.nombreCliente || '',
    correoCliente: cita.correoCliente || '',
    telefonoCliente: cita.telefonoCliente || '',
    ubicacion: cita.ubicacion || '',
  mapsUrl: cita.mapsUrl || '',
    informacionAdicional: cita.informacionAdicional || ''
});

const syncTaskFromCita = async (cita, req, action = 'sync_cita') => {
    // Manejar ingenieroAsignado como array o singular (backward compatibility)
    let assignedIds = [];
    let assignedNames = [];

    if (Array.isArray(cita.ingenieroAsignado)) {
        // Es array (nuevo formato)
        assignedIds = cita.ingenieroAsignado
            .filter(id => id && mongoose.Types.ObjectId.isValid(String(id)))
            .map(id => String(id));
    } else if (cita.ingenieroAsignado) {
        // Es singular (formato antiguo)
        assignedIds = [String(cita.ingenieroAsignado)];
    }

    // Obtener nombres de los ingenieros
    if (assignedIds.length > 0) {
        const ingenieros = await Admin.find({ _id: { $in: assignedIds } }, 'nombre');
        assignedNames = ingenieros.map(ing => ing.nombre);
    }

    const citaId = String(cita._id);
    const existing = await Tarea.findOne({
        $or: [
            { sourceType: 'cita', sourceId: citaId },
            { sourceCitaId: citaId }
        ]
    });

    const payload = {
        etapa: existing?.etapa && existing.etapa !== 'citas' ? existing.etapa : 'citas',
        estado: citaToTaskEstado(cita.estado),
        asignadoA: assignedIds.length > 0 ? assignedIds : [],
        asignadoANombre: assignedNames.length > 0 ? assignedNames : [],
        nombreProyecto: '',
        proyectoId: null,
        notas: cita.informacionAdicional || cita.especificacionesInicio?.especificaciones || '',
        prioridad: 'media',
        citaStarted: ['en_proceso', 'completada'].includes(cita.estado),
        citaFinished: cita.estado === 'completada',
        sourceType: 'cita',
        sourceId: citaId,
        cita: buildCitaPayload(cita),
        mapsUrl: cita.mapsUrl || '',
        sourceCitaId: citaId
    };

    if (existing) {
        Object.assign(existing, payload);
        existing.historialCambios = existing.historialCambios || [];
        existing.historialCambios.push({
            by: req.admin?._id ? String(req.admin._id) : null,
            action,
            changes: { citaId: String(cita._id), estadoCita: cita.estado },
            at: new Date()
        });
        await existing.save();
        await upsertTrackingAccessFromTarea(existing);
        return existing;
    }

    const nueva = new Tarea({ 
        ...payload, 
        historialCambios: [{
            by: req.admin?._id ? String(req.admin._id) : null,
            action: 'create_from_cita',
            changes: { citaId: String(cita._id), estadoCita: cita.estado },
            at: new Date()
        }] 
    });
    await nueva.save();
    await upsertTrackingAccessFromTarea(nueva);
    return nueva;
};

const removeTaskFromCita = async (citaId) => {
    const id = String(citaId);
    await Tarea.findOneAndDelete({
        $or: [
            { sourceType: 'cita', sourceId: id },
            { sourceCitaId: id }
        ]
    });
};

// Crear cita (ruta pública, no requiere autenticación)
export const crearCita = async (req, res) => {
  try {
    const {
      fechaAgendada,
      nombreCliente,
      correoCliente,
      telefonoCliente,
      ubicacion,
      diseno,
      informacionAdicional
    } = req.body;

        // Verificar token de captcha en headers o body (frontend puede enviarlo de varias formas)
        const captchaHeader = req.headers['captcha-token']
            || req.headers['captchatoken']
            || req.headers['x-captcha-token']
            || req.headers['cf-turnstile-response']
            || req.headers['turnstile-response']
            || req.body?.captchaToken
            || req.body?.token
            || req.body?.['cf-turnstile-response'];

        if (!captchaHeader) {
            return res.status(400).json({ success: false, message: "El captcha (captcha-token o cf-turnstile-response) es requerido" });
        }

        const captchaResult = await verifyRecaptchaToken(String(captchaHeader), {
            expectedAction: 'submit_cita'
        });

        if (!captchaResult.success) {
            return res.status(400).json({
                success: false,
                message: 'La verificación del captcha falló',
                error: captchaResult.error || 'Token inválido o expirado'
            });
        }

    // Validaciones básicas
        if (!fechaAgendada) return res.status(400).json({ success: false, message: "Fecha agendada es requerida" });
        if (!nombreCliente) return res.status(400).json({ success: false, message: "Nombre del cliente es requerido" });
        if (!correoCliente) return res.status(400).json({ success: false, message: "Correo del cliente es requerido" });
        if (!telefonoCliente) return res.status(400).json({ success: false, message: "Teléfono del cliente es requerido" });

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

        // Verificar que la fecha sea futura y cumpla con mínimo 1 hora de anticipación
        const ahora = new Date();
        // Convertir ahora a hora de México para comparación de anticipación
        const ahoraMexico = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const diferenciaMs = fechaObj.getTime() - ahoraMexico.getTime();
        const unaHoraMs = 60 * 60 * 1000;
        if (diferenciaMs < unaHoraMs) {
            return res.status(400).json({ success: false, message: "La cita debe solicitarse con al menos 1 hora de anticipación" });
        }

    // Convertir a hora de México (America/Mexico_City) para validaciones
    const fechaMexico = new Date(fechaObj.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    
    // VALIDACIÓN: Solo lunes a viernes (0=Domingo, 6=Sábado)
    const diaSemana = fechaMexico.getDay();
    if (diaSemana === 0 || diaSemana === 6) {
      return res.status(400).json({ 
        message: "Las citas solo pueden agendarse de lunes a viernes",
        diaRecibido: fechaMexico.toLocaleDateString('es-MX', { 
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'America/Mexico_City'
        })
      });
    }

    // VALIDACIÓN: Solo entre 9:00 AM y 6:00 PM (hora de México)
    const hora = fechaMexico.getHours();
    const minutos = fechaMexico.getMinutes();
    const horaDecimal = hora + (minutos / 60);
    
    if (horaDecimal < 9 || horaDecimal >= 18) {
      return res.status(400).json({ 
        message: "Las citas solo pueden agendarse entre las 9:00 AM y las 6:00 PM (hora de México)",
        horaRecibida: `${hora}:${minutos.toString().padStart(2, '0')}`
      });
    }

        // VALIDACIÓN: Verificar disponibilidad (buffer de 1 hora antes y después)
        const unaHoraAntes = new Date(fechaObj.getTime() - unaHoraMs);
        const unaHoraDespues = new Date(fechaObj.getTime() + unaHoraMs);

        const citasConflicto = await Citas.find({
            fechaAgendada: {
                $gte: unaHoraAntes,
                $lte: unaHoraDespues
            },
            estado: { $in: ['programada', 'en_proceso'] }
        });

        if (citasConflicto.length > 0) {
            const horasCita = citasConflicto.map(c => {
                const fecha = new Date(c.fechaAgendada);
                const horas = String(fecha.getHours()).padStart(2, '0');
                const minutos = String(fecha.getMinutes()).padStart(2, '0');
                return `${horas}:${minutos}`;
            });

            return res.status(400).json({ 
                success: false,
                message: "Ya existe una cita programada en ese horario. Debe haber al menos 1 hora de separación entre citas.",
                citasOcupadas: horasCita
            });
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
      ubicacion: ubicacion?.trim() || '',
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

        await syncTaskFromCita(citaGuardada, req, 'create_cita');

        return res.status(201).json({
            success: true,
            data: citaCompleta,
            message: "Cita creada exitosamente"
        });
    } catch (error) {
        console.error('Error en crearCita:', error);
        return res.status(500).json({ success: false, message: 'Error al crear la cita', error: error.message });
    }
};

// Asignar ingeniero a una cita (solo admin)
export const asignarIngenieroCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { ingenieroId } = req.body;

    // Verificar que el usuario sea admin
    if (!req.admin || req.admin.rol !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: "Solo el administrador puede asignar ingenieros"
      });
    }

    // Validar ID de cita
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "ID de cita inválido" 
      });
    }

    // Buscar la cita
    const cita = await Citas.findById(id);
    if (!cita) {
      return res.status(404).json({ 
        success: false,
        message: "Cita no encontrada" 
      });
    }

    // Si se proporciona un ingenieroId, validar y asignar
    if (ingenieroId) {
      if (!mongoose.Types.ObjectId.isValid(ingenieroId)) {
        return res.status(400).json({ 
          success: false,
          message: "ID de ingeniero inválido" 
        });
      }

      // Verificar que el ingeniero existe
      const ingeniero = await Admin.findById(ingenieroId);
      if (!ingeniero) {
        return res.status(404).json({ 
          success: false,
          message: "Ingeniero no encontrado" 
        });
      }

      if (!ROLES_ASIGNABLES.includes(ingeniero.rol)) {
        return res.status(400).json({ 
          success: false,
          message: "El usuario no tiene un rol asignable"
        });
      }

      // Asignar a array (agregar si no existe)
      if (!cita.ingenieroAsignado.includes(ingenieroId)) {
        cita.ingenieroAsignado.push(ingenieroId);
        await cita.save();

        // Agregar la cita al array de citas del ingeniero si no existe
        if (!ingeniero.citas.includes(cita._id)) {
          ingeniero.citas.push(cita._id);
          await ingeniero.save();
        }
      }
    } else {
      // Si no se proporciona ingenieroId, remover la asignación
      cita.ingenieroAsignado = [];
      await cita.save();
    }

    // Obtener la cita actualizada con los ingenieros poblados
    const citaPopulated = await Citas.findById(id)
      .populate('ingenieroAsignado', 'nombre correo telefono rol');

    await syncTaskFromCita(citaPopulated, req, 'assign_ingeniero_cita');

    return res.json({ 
      success: true, 
      message: 'Ingeniero asignado correctamente',
      data: { cita: citaPopulated } 
    });
  } catch (error) {
    console.error('Error en asignarIngenieroCita:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al asignar ingeniero', 
      error: error.message 
    });
  }
};

/**
 * Asignar Múltiples Ingenieros a una Cita
 * PUT /api/citas/:id/asignarIngenieros
 */
export const asignarMultiplesIngenieros = async (req, res) => {
  try {
    const { id } = req.params;
    const { ingenieroIds } = req.body;

    // Verificar que el usuario sea admin
    if (!req.admin || req.admin.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Solo administradores pueden hacer esta operación"
      });
    }

    // Validar que ingenieroIds sea array
    if (!Array.isArray(ingenieroIds)) {
      return res.status(400).json({
        success: false,
        message: "ingenieroIds debe ser un array"
      });
    }

    // Validar ID de cita
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID de cita inválido"
      });
    }

    // Buscar la cita
    const cita = await Citas.findById(id);
    if (!cita) {
      return res.status(404).json({
        success: false,
        message: "Cita no encontrada"
      });
    }

    // Remover duplicados
    const uniqueIds = [...new Set(ingenieroIds.map(id => String(id)))];

    // Validar que todos los IDs sean válidos
    for (const ingId of uniqueIds) {
      if (!mongoose.Types.ObjectId.isValid(ingId)) {
        return res.status(400).json({
          success: false,
          message: `ID de ingeniero inválido: ${ingId}`
        });
      }
    }

    // Verificar que todos los ingenieros existen
    const ingenieros = await Admin.find({ _id: { $in: uniqueIds } });
    if (ingenieros.length !== uniqueIds.length) {
      return res.status(404).json({
        success: false,
        message: "Uno o más ingenieros no existen"
      });
    }

    // Verificar que todos tengan roles asignables
    for (const ing of ingenieros) {
      if (!ROLES_ASIGNABLES.includes(ing.rol)) {
        return res.status(400).json({
          success: false,
          message: `${ing.nombre} no tiene un rol asignable (tiene: ${ing.rol})`
        });
      }
    }

    // Actualizar asignación
    cita.ingenieroAsignado = uniqueIds;
    await cita.save();

    // Obtener la cita actualizada con los ingenieros poblados
    const citaPopulated = await Citas.findById(id)
      .populate('ingenieroAsignado', 'nombre correo telefono rol');

    await syncTaskFromCita(citaPopulated, req, 'assign_multiple_ingenieros');

    return res.json({
      success: true,
      message: "Ingenieros asignados correctamente",
      data: { cita: citaPopulated }
    });
  } catch (error) {
    console.error('Error en asignarMultiplesIngenieros:', error);
    return res.status(500).json({
      success: false,
      message: "Error al asignar ingenieros",
      error: error.message
    });
  }
};

/**
 * Actualizar Datos del Cliente en la Cita
 * PUT /api/citas/:id/actualizarDatos
 */
export const actualizarDatosCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombreCliente, correoCliente, telefonoCliente, ubicacion, informacionAdicional } = req.body;

    // Verificar que el usuario sea admin
    if (!req.admin || req.admin.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Solo administradores pueden editar datos de cita"
      });
    }

    // Validar ID de cita
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID de cita inválido"
      });
    }

    // Buscar la cita
    const cita = await Citas.findById(id);
    if (!cita) {
      return res.status(404).json({
        success: false,
        message: "Cita no encontrada"
      });
    }

    const camposRecibidos = [nombreCliente, correoCliente, telefonoCliente, ubicacion, informacionAdicional]
      .some((valor) => valor !== undefined);

    if (!camposRecibidos) {
      return res.status(400).json({
        success: false,
        message: "No se recibieron datos para actualizar la cita"
      });
    }

    // Validaciones
    if (nombreCliente && nombreCliente.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Nombre del cliente debe tener al menos 3 caracteres"
      });
    }

    if (correoCliente) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(correoCliente)) {
        return res.status(400).json({
          success: false,
          message: "Email no válido"
        });
      }
    }

    if (telefonoCliente) {
      const soloNumeros = telefonoCliente.replace(/\D/g, '');
      if (soloNumeros.length < 7) {
        return res.status(400).json({
          success: false,
          message: "Teléfono debe tener al menos 7 dígitos"
        });
      }
    }

    // Construir objeto de actualización
    const updateData = {};
    if (nombreCliente !== undefined) updateData.nombreCliente = normalizeString(nombreCliente);
    if (correoCliente !== undefined) updateData.correoCliente = normalizeString(correoCliente)?.toLowerCase();
    if (telefonoCliente !== undefined) updateData.telefonoCliente = normalizeString(telefonoCliente);
    if (ubicacion !== undefined) updateData.ubicacion = ubicacion;
    if (informacionAdicional !== undefined) updateData.informacionAdicional = informacionAdicional;

    // Actualizar la cita
    const citaActualizada = await Citas.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('ingenieroAsignado', 'nombre correo telefono rol');

    await syncTaskFromCita(citaActualizada, req, 'update_datos_cita');

    return res.json({
      success: true,
      message: "Datos de la cita actualizados correctamente",
      data: { cita: citaActualizada }
    });
  } catch (error) {
    console.error('Error en actualizarDatosCita:', error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar datos",
      error: error.message
    });
  }
};

/**
 * Actualizar Estado de la Cita
 * PUT /api/citas/:id/actualizarEstado
 */
export const actualizarEstadoCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, estadoCita, fechaTermino } = req.body;
    const estadoRecibido = estado ?? estadoCita;

    // Verificar que el usuario sea admin
    if (!req.admin || req.admin.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Solo administradores pueden cambiar el estado"
      });
    }

    // Validar ID de cita
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID de cita inválido"
      });
    }

    // Estados válidos
    if (!ESTADOS_CITA_VALIDOS.includes(estadoRecibido)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Valores permitidos: ${ESTADOS_CITA_VALIDOS.join(', ')}`
      });
    }

    // Buscar la cita
    const cita = await Citas.findById(id);
    if (!cita) {
      return res.status(404).json({
        success: false,
        message: "Cita no encontrada"
      });
    }

    // Validaciones de transición de estado
    const estadoActual = cita.estado;
    const transicionesValidas = {
      'programada': ['en_proceso', 'cancelada'],
      'en_proceso': ['completada', 'cancelada'],
      'completada': [], // No puede cambiar
      'cancelada': []    // No puede cambiar
    };

    if (!transicionesValidas[estadoActual].includes(estadoRecibido)) {
      return res.status(400).json({
        success: false,
        message: `No se puede cambiar de '${estadoActual}' a '${estadoRecibido}'`
      });
    }

    const fechaTerminoParseada = parseDateField(fechaTermino);

    if (fechaTermino && !fechaTerminoParseada) {
      return res.status(400).json({
        success: false,
        message: "fechaTermino inválida"
      });
    }

    // Si se proporciona fechaTermino, validar que sea >= fechaAgendada
    if (fechaTerminoParseada) {
      const termino = fechaTerminoParseada;
      if (termino < cita.fechaAgendada) {
        return res.status(400).json({
          success: false,
          message: "La fecha de término no puede ser anterior a la fecha agendada"
        });
      }
    }

    // Actualizar la cita
    const updateData = { estado: estadoRecibido };
    if (estadoRecibido === 'completada') {
      updateData.fechaTermino = fechaTerminoParseada || new Date();
      // Si completa, también marcar fechaInicio si no existe
      if (!cita.fechaInicio) {
        updateData.fechaInicio = cita.fechaAgendada;
      }
    } else if (fechaTerminoParseada) {
      updateData.fechaTermino = fechaTerminoParseada;
    }

    const citaActualizada = await Citas.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('ingenieroAsignado', 'nombre correo telefono rol');

    await syncTaskFromCita(citaActualizada, req, 'update_estado_cita');

    return res.json({
      success: true,
      message: `Estado actualizado a '${estadoRecibido}'`,
      data: { cita: citaActualizada }
    });
  } catch (error) {
    console.error('Error en actualizarEstadoCita:', error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar estado",
      error: error.message
    });
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

    // Push history
    try {
        cita.historialEstados = cita.historialEstados || [];
        cita.historialEstados.push({ from: cita.estado, to: 'cancelada', by: req.admin?._id || null, at: new Date(), nota: 'Cancelada' });
        await cita.save();
    } catch (e) {
        console.error('Error al push historial en cancelarCita', e);
    }

    await syncTaskFromCita(cita, req, 'cancel_cita');

    return res.status(200).json({ success: true, data: { message: 'Cita cancelada exitosamente', cita } });
  } catch (error) {
        console.error('Error en cancelarCita:', error);
        return res.status(500).json({ success: false, message: 'Error al cancelar la cita', error: error.message });
  }
};

export const obtenerCitasPorCliente = async (req, res) => {
    try {
        const correo = req.query.correo;
        if (!correo) {
            return res.status(400).json({ message: "Correo es requerido (query: ?correo=...)" });
        }

        const citas = await Citas.find({
            correoCliente: correo.toString().toLowerCase().trim()
        })
        .populate({
            path: 'diseno',
            select: 'nombre descripcion imagenes'
        })
        .sort({ fechaAgendada: -1 })
        .lean();

        res.json({ success: true, data: citas });
    } catch (error) {
        console.error('Error en obtenerCitasPorCliente:', error);
        res.status(500).json({ success: false, message: 'Error al obtener las citas', error: error.message });
    }
};

export const actualizarCita = async (req, res) => {
    try {
        const { id } = req.params;
    const { fechaAgendada, fechaInicio, fechaTermino, nombreCliente, correoCliente, telefonoCliente, ubicacion, mapsUrl, informacionAdicional, estado, estadoCita, diseno, ingenieroAsignado } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID de cita inválido' });
    }

        const cita = await Citas.findById(id);
        if (!cita) return res.status(404).json({ success: false, message: 'Cita no encontrada' });

    const estadoNormalizado = estado ?? estadoCita;
    const hayDatosParaActualizar = [
      fechaAgendada,
      fechaInicio,
      fechaTermino,
      nombreCliente,
      correoCliente,
      telefonoCliente,
      ubicacion,
      mapsUrl,
      informacionAdicional,
      estadoNormalizado,
      diseno,
      ingenieroAsignado
    ].some((valor) => valor !== undefined);

    if (!hayDatosParaActualizar) {
      return res.status(400).json({
        success: false,
        message: 'No se recibieron datos para actualizar la cita'
      });
    }

    if (estadoNormalizado !== undefined && !ESTADOS_CITA_VALIDOS.includes(estadoNormalizado)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Valores permitidos: ${ESTADOS_CITA_VALIDOS.join(', ')}`
      });
    }

        // Construir objeto de actualización
        const updateData = {};
    const fechaAgendadaParseada = parseDateField(fechaAgendada);
    const fechaInicioParseada = parseDateField(fechaInicio);
    const fechaTerminoParseada = parseDateField(fechaTermino);

    if (fechaAgendada !== undefined && !fechaAgendadaParseada) {
      return res.status(400).json({ success: false, message: 'fechaAgendada inválida' });
    }
    if (fechaInicio !== undefined && !fechaInicioParseada) {
      return res.status(400).json({ success: false, message: 'fechaInicio inválida' });
    }
    if (fechaTermino !== undefined && !fechaTerminoParseada) {
      return res.status(400).json({ success: false, message: 'fechaTermino inválida' });
    }

    if (fechaAgendadaParseada) updateData.fechaAgendada = fechaAgendadaParseada;
    if (fechaInicioParseada) updateData.fechaInicio = fechaInicioParseada;
    if (fechaTerminoParseada) updateData.fechaTermino = fechaTerminoParseada;
    if (nombreCliente !== undefined) updateData.nombreCliente = normalizeString(nombreCliente);
    if (correoCliente !== undefined) updateData.correoCliente = normalizeString(correoCliente)?.toLowerCase();
    if (telefonoCliente !== undefined) updateData.telefonoCliente = normalizeString(telefonoCliente);
    if (ubicacion !== undefined) updateData.ubicacion = normalizeString(ubicacion);
    if (mapsUrl !== undefined) updateData.mapsUrl = normalizeString(mapsUrl);
        if (informacionAdicional !== undefined) updateData.informacionAdicional = informacionAdicional;
    if (estadoNormalizado !== undefined) updateData.estado = estadoNormalizado;
        if (diseno !== undefined) updateData.diseno = diseno;
    if (ingenieroAsignado !== undefined) updateData.ingenieroAsignado = ingenieroAsignado || [];

        // Determine if estado will change for history
        const previoEstado = cita.estado;

        // Apply updates directly to the document
        Object.keys(updateData).forEach(key => {
            cita[key] = updateData[key];
        });

        // If estado changed, push to historialEstados
        if (updateData.estado && updateData.estado !== previoEstado) {
            cita.historialEstados = cita.historialEstados || [];
            cita.historialEstados.push({ from: previoEstado, to: updateData.estado, by: req.admin?._id || null, at: new Date(), nota: 'Actualización manual' });
        }

        await cita.save();
        await cita.populate({ path: 'diseno', select: 'nombre descripcion imagenes' });

        await syncTaskFromCita(cita, req, 'update_cita');

        res.json({ success: true, data: cita });
    } catch (error) {
        console.error('Error en actualizarCita:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar cita', error: error.message });
    }
};

export const eliminarCita = async (req, res) => {
    try {
        const { id } = req.params;

        const cita = await Citas.findById(id);
        if (!cita) return res.status(404).json({ message: "Cita no encontrada" });

        await removeTaskFromCita(cita._id);
        await Citas.findByIdAndDelete(id);

        res.json({ success: true, data: { message: 'Cita eliminada correctamente' } });
    } catch (error) {
        console.error('Error en eliminarCita:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar cita', error: error.message });
    }
};

export const obtenerCitas = async (req, res) => {
    try {
        const citas = await Citas.find()
            .populate({
                path: 'diseno',
                select: 'nombre descripcion imagenes'
            })
            .populate('ingenieroAsignado', 'nombre correo telefono rol')
            .sort({ fechaAgendada: -1 })
            .lean();
        res.json({ success: true, data: citas });
    } catch (error) {
        console.error('Error en obtenerCitas:', error);
        res.status(500).json({ success: false, message: 'Error al obtener citas', error: error.message });
    }
};

export const obtenerCita = async (req, res) => {
    try {
        const { id } = req.params;
        const cita = await Citas.findById(id)
            .populate({
                path: 'diseno',
                select: 'nombre descripcion imagenes'
            })
            .populate('ingenieroAsignado', 'nombre correo telefono rol');
        
        if (!cita) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
        
        // Si es ingeniero o arquitecto, solo puede ver sus citas asignadas
        if (req.admin && ROLES_OPERATIVOS.includes(req.admin.rol)) {
            const adminId = String(req.admin.id || req.admin._id);
            const esAsignado = Array.isArray(cita.ingenieroAsignado)
                ? cita.ingenieroAsignado.some(id => String(id) === adminId)
                : cita.ingenieroAsignado && String(cita.ingenieroAsignado) === adminId;
            
            if (!esAsignado) {
                return res.status(403).json({ success: false, message: 'No tienes permiso para ver esta cita' });
            }
        }
        
        res.json({ success: true, data: cita });
    } catch (error) {
        console.error('Error en obtenerCita:', error);
        res.status(500).json({ success: false, message: 'Error al obtener cita', error: error.message });
    }
};

export const getAllCitas = obtenerCitas;

export const updateCitaEstado = async (req, res) => {
    try {
    const { estado, estadoCita } = req.body;
    const estadoRecibido = estado ?? estadoCita;
        const estadosValidos = ['programada', 'en_proceso', 'completada', 'cancelada'];
    if (!estadosValidos.includes(estadoRecibido)) {
            return res.status(400).json({ success: false, message: 'Estado no válido' });
        }

        // Delegate to actualizarCita to ensure single update path
        // If completing, set fechaTermino when not provided
    req.body.estado = estadoRecibido;

    if (estadoRecibido === 'completada' && !req.body.fechaTermino) {
            req.body.fechaTermino = new Date();
        }

        // actualizarCita expects req.params.id and req.body; call it directly
        return await actualizarCita(req, res);
    } catch (error) {
        console.error('Error en updateCitaEstado:', error);
        return res.status(500).json({ success: false, message: 'Error al actualizar el estado de la cita', error: error.message });
    }
};

// Iniciar cita (cambia estado a en_proceso, registra fechaInicio y especificaciones)
export const iniciarCita = async (req, res) => {
    try {
        const { id } = req.params;
        const { medidas, estilo, especificaciones, materialesPreferidos } = req.body || {};

        // Verificar que sea admin o ingeniero
        if (req.admin && req.admin.rol !== 'admin' && !ROLES_OPERATIVOS.includes(req.admin.rol)) {
            return res.status(403).json({ message: "No tienes permisos para iniciar citas" });
        }

        const cita = await Citas.findById(id);
        if (!cita) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada' });
        }

        // Si es ingeniero o arquitecto, solo puede iniciar sus citas asignadas
        if (ROLES_OPERATIVOS.includes(req.admin.rol)) {
            const adminId = String(req.admin.id || req.admin._id);
            const esAsignado = Array.isArray(cita.ingenieroAsignado)
                ? cita.ingenieroAsignado.some(id => String(id) === adminId)
                : cita.ingenieroAsignado && String(cita.ingenieroAsignado) === adminId;
            
            if (!esAsignado) {
                return res.status(403).json({ success: false, message: "Solo puedes iniciar las citas asignadas a ti" });
            }
        }

        if (cita.estado !== 'programada') {
            return res.status(400).json({ success: false, message: 'La cita no está en estado programada' });
        }

        const previoEstado = cita.estado;

        cita.estado = 'en_proceso';
        cita.fechaInicio = new Date();
        if (medidas !== undefined) cita.especificacionesInicio.medidas = medidas;
        if (estilo !== undefined) cita.especificacionesInicio.estilo = estilo;
        if (especificaciones !== undefined) cita.especificacionesInicio.especificaciones = especificaciones;
        if (materialesPreferidos !== undefined) cita.especificacionesInicio.materialesPreferidos = materialesPreferidos;
        // Push history
        try {
            cita.historialEstados = cita.historialEstados || [];
            cita.historialEstados.push({ from: previoEstado, to: 'en_proceso', by: req.admin?._id || null, at: new Date(), nota: 'Inicio de trabajo' });
        } catch (e) {
            console.error('Error al preparar historial en iniciarCita', e);
        }

        await cita.save();

        await syncTaskFromCita(cita, req, 'start_cita');

        // Poblar diseño e ingeniero para respuesta
        await cita.populate([
            { path: 'diseno', select: 'nombre descripcion imagenes' },
            { path: 'ingenieroAsignado', select: 'nombre correo telefono rol' }
        ]);

        res.json({ success: true, data: { message: 'Cita iniciada exitosamente', cita } });

    } catch (error) {
        console.error('Error en iniciarCita:', error);
        res.status(500).json({ success: false, message: 'Error al iniciar cita', error: error.message });
    }
};

// Finalizar cita (cambia estado a completada, registra fechaTermino y crea orden de trabajo)
export const finalizarCita = async (req, res) => {
    try {
        const { id } = req.params;
        const { ingenieroId, fechaEstimadaFinalizacion, notasInternas } = req.body;

        // Verificar que sea admin o ingeniero
        if (req.admin && req.admin.rol !== 'admin' && !ROLES_OPERATIVOS.includes(req.admin.rol)) {
            return res.status(403).json({ message: "No tienes permisos para finalizar citas" });
        }

        const cita = await Citas.findById(id).populate('diseno');
        if (!cita) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada' });
        }

        // Si es ingeniero o arquitecto, solo puede finalizar sus citas asignadas
        if (ROLES_OPERATIVOS.includes(req.admin.rol)) {
            const adminId = String(req.admin.id || req.admin._id);
            const esAsignado = Array.isArray(cita.ingenieroAsignado)
                ? cita.ingenieroAsignado.some(id => String(id) === adminId)
                : cita.ingenieroAsignado && String(cita.ingenieroAsignado) === adminId;
            
            if (!esAsignado) {
                return res.status(403).json({ success: false, message: "Solo puedes finalizar las citas asignadas a ti" });
            }
        }

        if (cita.estado === 'completada') {
            return res.status(400).json({ success: false, message: 'La cita ya está completada' });
        }

        const previoEstado = cita.estado;

        // Actualizar cita
        cita.estado = 'completada';
        cita.fechaTermino = new Date();
        try {
            cita.historialEstados = cita.historialEstados || [];
            cita.historialEstados.push({ from: previoEstado, to: 'completada', by: req.admin?._id || null, at: new Date(), nota: 'Finalización de cita' });
        } catch (e) {
            console.error('Error al preparar historial en finalizarCita', e);
        }

        await cita.save();

        await syncTaskFromCita(cita, req, 'finish_cita');

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

        res.status(201).json({ success: true, data: { message: 'Cita finalizada y orden de trabajo creada exitosamente', cita, ordenTrabajo: { _id: ordenTrabajo._id, numeroSeguimiento, estado: estadoInicial } } });

    } catch (error) {
        console.error('Error en finalizarCita:', error);
        res.status(500).json({ success: false, message: 'Error al finalizar cita', error: error.message });
    }
};

// Obtener citas asignadas al ingeniero autenticado
export const obtenerCitasIngeniero = async (req, res) => {
    try {
        // Verificar que sea ingeniero o arquitecto
        if (!req.admin || !ROLES_OPERATIVOS.includes(req.admin.rol)) {
            return res.status(403).json({ message: "Solo personal operativo puede acceder a esta ruta" });
        }

        // Buscar citas asignadas al ingeniero
        const citas = await Citas.find({ ingenieroAsignado: req.admin.id })
            .populate({
                path: 'diseno',
                select: 'nombre descripcion imagenes'
            })
            .populate('ingenieroAsignado', 'nombre correo telefono rol')
            .sort({ fechaAgendada: -1 })
            .lean();

        res.json({ success: true, data: { message: `Citas asignadas a ${req.admin.nombre || 'ti'}`, total: citas.length, citas } });
    } catch (error) {
        console.error('Error en obtenerCitasIngeniero:', error);
        res.status(500).json({ success: false, message: 'Error al obtener las citas', error: error.message });
    }
};

// Actualizar especificaciones de una cita (solo el ingeniero asignado)
export const actualizarEspecificaciones = async (req, res) => {
    try {
        const { id } = req.params;
        const { medidas, estilo, especificaciones, materialesPreferidos } = req.body || {};

        // Verificar que sea ingeniero o arquitecto
        if (!req.admin || !ROLES_OPERATIVOS.includes(req.admin.rol)) {
            return res.status(403).json({ message: "Solo personal operativo puede actualizar especificaciones" });
        }

        const cita = await Citas.findById(id);
        if (!cita) {
            return res.status(404).json({ message: "Cita no encontrada" });
        }

        // Verificar que la cita esté asignada al ingeniero
        const adminId = String(req.admin.id || req.admin._id);
        const esAsignado = Array.isArray(cita.ingenieroAsignado)
            ? cita.ingenieroAsignado.some(id => String(id) === adminId)
            : cita.ingenieroAsignado && String(cita.ingenieroAsignado) === adminId;
        
        if (!esAsignado) {
            return res.status(403).json({ message: "Solo puedes actualizar las especificaciones de tus citas asignadas" });
        }

        // Verificar que la cita esté en proceso
        if (cita.estado !== 'en_proceso') {
            return res.status(400).json({ message: "Solo puedes actualizar especificaciones de citas en proceso" });
        }

        // Actualizar especificaciones
        if (medidas !== undefined) cita.especificacionesInicio.medidas = medidas;
        if (estilo !== undefined) cita.especificacionesInicio.estilo = estilo;
        if (especificaciones !== undefined) cita.especificacionesInicio.especificaciones = especificaciones;
        if (materialesPreferidos !== undefined) cita.especificacionesInicio.materialesPreferidos = materialesPreferidos;

        await cita.save();

        // Poblar diseño e ingeniero para respuesta
        await cita.populate([
            { path: 'diseno', select: 'nombre descripcion imagenes' },
            { path: 'ingenieroAsignado', select: 'nombre correo telefono rol' }
        ]);

        res.json({ success: true, data: { message: 'Especificaciones actualizadas exitosamente', cita } });

    } catch (error) {
        console.error('Error en actualizarEspecificaciones:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar especificaciones', error: error.message });
    }
};

// Obtener disponibilidad de horarios (ruta pública)
export const obtenerDisponibilidad = async (req, res) => {
    try {
        const { fecha } = req.query;

        if (!fecha) {
            return res.status(400).json({ 
                success: false, 
                message: "Fecha requerida" 
            });
        }

        // Parsear la fecha solicitada (formato: YYYY-MM-DD)
        // Agregar la hora de México para buscar correctamente
        const fechaInicio = new Date(fecha + 'T00:00:00');
        const fechaFin = new Date(fecha + 'T23:59:59.999');

        const citas = await Citas.find({
            fechaAgendada: { $gte: fechaInicio, $lte: fechaFin },
            estado: { $in: ['programada', 'en_proceso'] }
        });

        const horariosOcupados = citas.map(cita => {
            const fecha = new Date(cita.fechaAgendada);
            const horas = String(fecha.getHours()).padStart(2, '0');
            const minutos = String(fecha.getMinutes()).padStart(2, '0');
            return `${horas}:${minutos}`;
        });

        return res.status(200).json({
            success: true,
            fecha: fecha,
            horariosOcupados: horariosOcupados
        });

    } catch (error) {
        console.error('Error en obtenerDisponibilidad:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Error al consultar disponibilidad"
        });
    }
};

// Alias público para compatibilidad con frontend que intenta cargar citas sin auth
export const obtenerCitasPublicasCompat = async (req, res) => {
    try {
        const { fecha } = req.query;

        if (fecha) {
            const fechaInicio = new Date(`${fecha}T00:00:00`);
            const fechaFin = new Date(`${fecha}T23:59:59.999`);

            const citas = await Citas.find({
                fechaAgendada: { $gte: fechaInicio, $lte: fechaFin },
                estado: { $in: ['programada', 'en_proceso'] }
            }).select('fechaAgendada estado -_id').lean();

            const horariosOcupados = citas.map(cita => {
                const fechaCita = new Date(cita.fechaAgendada);
                const horas = String(fechaCita.getHours()).padStart(2, '0');
                const minutos = String(fechaCita.getMinutes()).padStart(2, '0');
                return `${horas}:${minutos}`;
            });

            return res.status(200).json({
                success: true,
                fecha,
                horariosOcupados
            });
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const citas = await Citas.find({
            estado: { $in: ['programada', 'en_proceso'] },
            fechaAgendada: { $gte: hoy }
        }).select('fechaAgendada estado -_id').lean();

        const data = citas.map(cita => {
            const fechaCita = new Date(cita.fechaAgendada);
            return {
                fecha: fechaCita.toISOString().split('T')[0],
                hora: `${String(fechaCita.getHours()).padStart(2, '0')}:${String(fechaCita.getMinutes()).padStart(2, '0')}`,
                estado: cita.estado
            };
        });

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error en obtenerCitasPublicasCompat:', error);
        return res.status(500).json({ success: false, message: 'Error al consultar citas públicas' });
    }
};

/**
 * Obtener Horarios Ocupados - PÚBLICO (Sin Autenticación)
 * Retorna SOLO fecha y hora de citas ocupadas
 * Optimizado para que el frontend cargue rápido los horarios disponibles
 */
export const obtenerHorariosOcupados = async (req, res) => {
    try {
        // Obtener hoy a las 00:00
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Buscar citas activas (solo lo necesario: fecha)
        const citas = await Citas.find({
            estado: { $in: ['programada', 'en_proceso'] },
            fechaAgendada: { $gte: hoy }
        }).select('fechaAgendada -_id').lean();

        // Convertir a formato simple: {fecha: "2026-05-20", hora: "14:00"}
        const horarios = citas.map(cita => {
            const fecha = new Date(cita.fechaAgendada);
            return {
                fecha: fecha.toISOString().split('T')[0], // YYYY-MM-DD
                hora: String(fecha.getHours()).padStart(2, '0') + ':00' // HH:00
            };
        });

        // Retornar array directo (más simple para el frontend)
        return res.status(200).json(horarios);

    } catch (error) {
        console.error('Error en obtenerHorariosOcupados:', error);
        // Retornar array vacío si hay error (no bloquea el frontend)
        return res.status(200).json([]);
    }
};