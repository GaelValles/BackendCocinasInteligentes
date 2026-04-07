import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const clienteIdentidadSchema = new mongoose.Schema({
    codigo: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        minlength: 6,
        maxlength: 6
    },
    nombre: {
        type: String,
        default: '',
        trim: true
    },
    correo: {
        type: String,
        default: '',
        trim: true,
        lowercase: true
    },
    telefono: {
        type: String,
        default: '',
        trim: true
    },
    correoNormalizado: {
        type: String,
        default: null,
        unique: true,
        sparse: true,
        index: true
    },
    telefonoNormalizado: {
        type: String,
        default: null,
        unique: true,
        sparse: true,
        index: true
    },
    archivos: [{
        id: {
            type: String,
            default: ''
        },
        taskId: {
            type: String,
            default: ''
        },
        proyectoId: {
            type: String,
            default: ''
        },
        tipo: {
            type: String,
            default: 'otro'
        },
        nombre: {
            type: String,
            default: ''
        },
        url: {
            type: String,
            default: ''
        },
        key: {
            type: String,
            default: ''
        },
        provider: {
            type: String,
            default: ''
        },
        mimeType: {
            type: String,
            default: ''
        },
        relacionadoA: {
            type: String,
            default: 'cliente'
        },
        relacionadoId: {
            type: String,
            default: ''
        },
        clienteId: {
            type: String,
            default: ''
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

clienteIdentidadSchema.index({ codigo: 1, 'archivos.tipo': 1, 'archivos.createdAt': -1 });
clienteIdentidadSchema.index({ 'archivos.key': 1 });

const ClienteIdentidadModel = connectDBClientes.models && connectDBClientes.models.ClienteIdentidad
    ? connectDBClientes.model('ClienteIdentidad')
    : connectDBClientes.model('ClienteIdentidad', clienteIdentidadSchema);

export default ClienteIdentidadModel;
