import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

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

// Índices para búsquedas eficientes
citasSchema.index({ correoCliente: 1, fechaAgendada: 1 });
citasSchema.index({ estado: 1, fechaAgendada: 1 });

export default connectDBClientes.model('Citas', citasSchema);