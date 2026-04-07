import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';
import {
  resolveOrCreateClienteIdentidad,
  syncProyectoClienteIdentidad
} from '../services/clienteIdentidad.service.js';

const tareaSchema = new mongoose.Schema({
  etapa: { type: String, enum: ['citas','disenos','cotizacion','contrato'], required: true, default: 'citas' },
  estado: { type: String, enum: ['pendiente','completada'], required: true, default: 'pendiente' },
  asignadoA: [{ type: String }],
  asignadoANombre: [{ type: String }],
  proyectoId: { type: String, default: null },
  nombreProyecto: { type: String, default: '' },
  fechaLimite: { type: Date, default: null },
  scheduledAt: { type: Date, default: null },
  visitScheduledAt: { type: Date, default: null },
  ubicacion: { type: String, default: '' },
  mapsUrl: { type: String, default: '' },
  prioridad: { type: String, enum: ['alta', 'media', 'baja'], default: 'media' },
  followUpEnteredAt: { type: Number, default: null },
  followUpStatus: { type: String, enum: ['pendiente', 'confirmado', 'inactivo'], default: 'pendiente' },
  followUpReminderStepsSent: {
    type: [{ type: Number, enum: [3, 8, 13] }],
    default: []
  },
  followUpLastReminderAt: { type: Date, default: null },
  citaStarted: { type: Boolean, default: false },
  citaFinished: { type: Boolean, default: false },
  designApprovedByAdmin: { type: Boolean, default: false },
  designApprovedByClient: { type: Boolean, default: false },
  wallSpecs: [{ type: mongoose.Schema.Types.Mixed, default: {} }],
  wallCostEstimate: { type: Number, default: null },
  sourceType: { type: String, enum: ['cita', 'diseno'], default: undefined },
  sourceId: { type: String, default: undefined },
  cita: {
    fechaAgendada: { type: Date, default: null },
    nombreCliente: { type: String, default: '' },
    correoCliente: { type: String, default: '' },
    telefonoCliente: { type: String, default: '' },
    ubicacion: { type: String, default: '' },
    informacionAdicional: { type: String, default: '' }
  },
  visita: {
    fechaProgramada: { type: Date, default: null },
    aprobadaPorAdmin: { type: Boolean, default: false },
    aprobadaPorCliente: { type: Boolean, default: false },
    actualizadaEn: { type: Date, default: null }
  },
  cliente: {
    nombre: { type: String, default: '' },
    correo: { type: String, default: '' },
    telefono: { type: String, default: '' }
  },
  clienteRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClienteIdentidad',
    default: null
  },
  clienteId: {
    type: String,
    default: ''
  },
  // Legacy source fields kept temporarily to avoid breaking old records.
  sourceCitaId: { type: String, default: undefined },
  sourceDisenoId: { type: String, default: undefined },
  notas: { type: String, default: '' },
  historialCambios: [{
    by: { type: String, default: null },
    action: { type: String, required: true },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// índices útiles
tareaSchema.index({ etapa: 1, estado: 1, asignadoA: 1 });
tareaSchema.index(
  { sourceType: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceType: { $in: ['cita', 'diseno'] },
      sourceId: { $exists: true, $ne: null }
    }
  }
);
tareaSchema.index(
  { sourceCitaId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceCitaId: { $exists: true, $ne: null }
    }
  }
);
tareaSchema.index(
  { sourceDisenoId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceDisenoId: { $exists: true, $ne: null }
    }
  }
);
tareaSchema.index({ etapa: 1, followUpStatus: 1, updatedAt: 1 });
tareaSchema.index({ clienteRef: 1, proyectoId: 1 });
tareaSchema.index({ clienteId: 1 });

tareaSchema.pre('save', async function preSaveClienteIdentidad(next) {
  try {
    const clienteNombre = String(this.cliente?.nombre || this.cita?.nombreCliente || '').trim();
    const clienteCorreo = String(this.cliente?.correo || this.cita?.correoCliente || '').trim().toLowerCase();
    const clienteTelefono = String(this.cliente?.telefono || this.cita?.telefonoCliente || '').trim();

    this.cliente = {
      nombre: clienteNombre,
      correo: clienteCorreo,
      telefono: clienteTelefono
    };

    const clienteIdentidad = await resolveOrCreateClienteIdentidad({
      nombre: clienteNombre,
      correo: clienteCorreo,
      telefono: clienteTelefono
    });

    if (clienteIdentidad) {
      this.clienteRef = clienteIdentidad._id;
      this.clienteId = clienteIdentidad.codigo;
    }

    next();
  } catch (error) {
    next(error);
  }
});

tareaSchema.post('save', async function postSaveSyncProyectoCliente(doc) {
  try {
    if (!doc?.proyectoId || !doc?.clienteRef || !doc?.clienteId) return;

    await syncProyectoClienteIdentidad({
      proyectoId: doc.proyectoId,
      clienteIdentidad: {
        _id: doc.clienteRef,
        codigo: doc.clienteId
      }
    });
  } catch (error) {
    console.warn('No se pudo sincronizar cliente con proyecto desde tarea:', error.message);
  }
});

const TareaModel = connectDBClientes.models && connectDBClientes.models.Tarea
  ? connectDBClientes.model('Tarea')
  : connectDBClientes.model('Tarea', tareaSchema);

export default TareaModel;
