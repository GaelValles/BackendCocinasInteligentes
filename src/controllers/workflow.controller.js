import mongoose from 'mongoose';
import Citas from '../models/citas.model.js';
import Tarea from '../models/tarea.model.js';

const ETAPAS_DESTINO_VALIDAS = ['disenos', 'cotizacion', 'contrato'];

export const promoverCita = async (req, res) => {
    try {
        const { id } = req.params;
        const { etapaDestino = 'disenos' } = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de cita inválido' });
        }

        if (!ETAPAS_DESTINO_VALIDAS.includes(etapaDestino)) {
            return res.status(400).json({ success: false, message: 'etapaDestino inválida' });
        }

        const cita = await Citas.findById(id).populate('ingenieroAsignado', 'nombre');
        if (!cita) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada' });
        }

        const citaId = String(cita._id);
        const existingTask = await Tarea.findOne({
            $or: [
                { sourceType: 'cita', sourceId: citaId },
                { sourceCitaId: citaId }
            ]
        });

        const asignadoA = cita.ingenieroAsignado?._id ? [String(cita.ingenieroAsignado._id)] : [];
        const asignadoANombre = cita.ingenieroAsignado?.nombre ? [cita.ingenieroAsignado.nombre] : [];

        let tarea;
        if (existingTask) {
            existingTask.etapa = etapaDestino;
            existingTask.estado = 'pendiente';
            existingTask.asignadoA = asignadoA;
            existingTask.asignadoANombre = asignadoANombre;
            existingTask.notas = existingTask.notas || cita.informacionAdicional || '';
            existingTask.sourceType = 'cita';
            existingTask.sourceId = citaId;
            existingTask.sourceCitaId = citaId;
            existingTask.cita = {
                fechaAgendada: cita.fechaAgendada || null,
                nombreCliente: cita.nombreCliente || '',
                correoCliente: cita.correoCliente || '',
                telefonoCliente: cita.telefonoCliente || '',
                ubicacion: cita.ubicacion || '',
                informacionAdicional: cita.informacionAdicional || ''
            };
            existingTask.historialCambios = existingTask.historialCambios || [];
            existingTask.historialCambios.push({
                by: req.admin?._id ? String(req.admin._id) : null,
                action: 'promote_cita',
                changes: { from: 'citas', to: etapaDestino, citaId },
                at: new Date()
            });
            tarea = await existingTask.save();
        } else {
            tarea = await Tarea.create({
                etapa: etapaDestino,
                estado: 'pendiente',
                asignadoA,
                asignadoANombre,
                notas: cita.informacionAdicional || '',
                prioridad: 'media',
                citaStarted: ['en_proceso', 'completada'].includes(cita.estado),
                citaFinished: cita.estado === 'completada',
                sourceType: 'cita',
                sourceId: citaId,
                sourceCitaId: citaId,
                cita: {
                    fechaAgendada: cita.fechaAgendada || null,
                    nombreCliente: cita.nombreCliente || '',
                    correoCliente: cita.correoCliente || '',
                    telefonoCliente: cita.telefonoCliente || '',
                    ubicacion: cita.ubicacion || '',
                    informacionAdicional: cita.informacionAdicional || ''
                },
                historialCambios: [{
                    by: req.admin?._id ? String(req.admin._id) : null,
                    action: 'promote_cita',
                    changes: { from: 'citas', to: etapaDestino, citaId },
                    at: new Date()
                }]
            });
        }

        const estadoAnterior = cita.estado;
        cita.estado = 'completada';
        if (!cita.fechaTermino) cita.fechaTermino = new Date();
        cita.historialEstados = cita.historialEstados || [];
        cita.historialEstados.push({
            from: estadoAnterior,
            to: 'completada',
            by: req.admin?._id || null,
            at: new Date(),
            nota: `Promovida a ${etapaDestino}`
        });
        await cita.save();

        return res.status(201).json({
            success: true,
            message: 'Cita promovida exitosamente',
            data: {
                cita,
                tarea
            }
        });
    } catch (error) {
        console.error('Error en promoverCita:', error);
        return res.status(500).json({ success: false, message: 'Error al promover cita', error: error.message });
    }
};
