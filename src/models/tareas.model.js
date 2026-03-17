import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const archivoTareaSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    tipo: {
        type: String,
        enum: ['pdf', 'render', 'otro'],
        required: true
    },
    url: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const tareasSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: true,
        trim: true
    },
    etapa: {
        type: String,
        enum: ['citas', 'disenos', 'cotizacion', 'contrato'],
        required: true
    },
    estado: {
        type: String,
        enum: ['pendiente', 'completada'],
        default: 'pendiente'
    },
    asignadoA: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    proyecto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Proyecto',
        required: true
    },
    nombreProyecto: {
        type: String,
        trim: true
    },
    notas: {
        type: String,
        trim: true,
        default: ''
    },
    archivos: [archivoTareaSchema],
    creadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    }
}, {
    timestamps: true
});

// Índices para mejorar el rendimiento de búsquedas
tareasSchema.index({ etapa: 1 });
tareasSchema.index({ estado: 1 });
tareasSchema.index({ asignadoA: 1 });
tareasSchema.index({ proyecto: 1 });

const TareaModel = connectDBClientes.models && connectDBClientes.models.Tarea
    ? connectDBClientes.model('Tarea')
    : connectDBClientes.model('Tarea', tareasSchema);

export default TareaModel;
