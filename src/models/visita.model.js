import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const visitaSchema = new mongoose.Schema({
    fechaProgramada: {
        type: Date,
        required: true,
        index: true
    },
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
    ubicacion: {
        type: String,
        default: '',
        trim: true
    },
    informacionAdicional: {
        type: String,
        default: '',
        trim: true
    },
    estado: {
        type: String,
        enum: ['solicitada', 'programada', 'confirmada', 'cancelada'],
        default: 'solicitada',
        index: true
    }
}, {
    timestamps: true
});

visitaSchema.index({ fechaProgramada: 1, estado: 1 });

const Visita = connectDBClientes.models && connectDBClientes.models.Visita
    ? connectDBClientes.model('Visita')
    : connectDBClientes.model('Visita', visitaSchema);

export default Visita;
