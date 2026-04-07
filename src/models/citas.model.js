import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';
import { resolveOrCreateClienteIdentidad } from '../services/clienteIdentidad.service.js';

const citasSchema = new mongoose.Schema({
    // Fecha en que se agendó la cita
    fechaAgendada: {
        type: Date,
        required: true
    },
    // Fecha y hora en que se inició la cita
    fechaInicio: {
        type: Date,
        required: false,
        default: null
    },
    // Fecha y hora en que se terminó la cita
    fechaTermino: {
        type: Date,
        required: false,
        default: null
    },
    // Datos del cliente
    nombreCliente: {
        type: String,
        required: true,
        trim: true
    },
    correoCliente: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    telefonoCliente: {
        type: String,
        required: true,
        trim: true
    },
    correoNormalizado: {
        type: String,
        default: null,
        index: true
    },
    telefonoNormalizado: {
        type: String,
        default: null,
        index: true
    },
    clienteRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClienteIdentidad',
        default: null,
        index: true
    },
    clienteId: {
        type: String,
        default: '',
        index: true
    },
    ubicacion: {
        type: String,
        default: '',
        trim: true
    },
    // Ingeniero asignado por el admin
    ingenieroAsignado: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        default: null
    },
    // Especificaciones al iniciar la cita (medidas, estilo, preferencias)
    especificacionesInicio: {
        medidas: { type: String, default: '' },
        estilo: { type: String, default: '' },
        especificaciones: { type: String, default: '' },
        materialesPreferidos: { type: String, default: '' }
    },

    // Referencia al diseño de cocina seleccionado
    diseno: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Disenos',
        required: false,
        default: null
    },
    // Información adicional
    informacionAdicional: {
        type: String,
        default: ''
    },
    // Estado de la cita
    estado: {
        type: String,
        enum: ['programada', 'en_proceso', 'completada', 'cancelada'],
        default: 'programada'
    }
}, {
    timestamps: true
});
// Historial de cambios de estado para auditoría
citasSchema.add({
    historialEstados: [{
        from: { type: String },
        to: { type: String },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
        at: { type: Date, default: Date.now },
        nota: { type: String }
    }]
});

// Índices para búsquedas eficientes
citasSchema.index({ correoCliente: 1, fechaAgendada: 1 });
citasSchema.index({ estado: 1, fechaAgendada: 1 });

citasSchema.pre('save', async function preSaveClienteIdentity(next) {
    try {
        const correoNormalizado = String(this.correoCliente || '').trim().toLowerCase();
        const telefonoNormalizado = String(this.telefonoCliente || '').replace(/\D/g, '').trim();

        this.correoCliente = correoNormalizado;
        this.correoNormalizado = correoNormalizado || null;
        this.telefonoNormalizado = telefonoNormalizado || null;

        const clienteIdentidad = await resolveOrCreateClienteIdentidad({
            nombre: this.nombreCliente,
            correo: this.correoCliente,
            telefono: this.telefonoCliente
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

const CitasModel = connectDBClientes.models && connectDBClientes.models.Citas
    ? connectDBClientes.model('Citas')
    : connectDBClientes.model('Citas', citasSchema);

export default CitasModel;