import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const archivoPublicoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    tipo: {
        type: String,
        enum: ['jpg', 'jpeg', 'pdf', 'png', 'webp', 'cotizacion_formal', 'hoja_taller', 'levantamiento_detallado', 'recibo', 'contrato', 'otro'],
        required: true
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const proyectoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    nombreCliente: {
        type: String,
        trim: true
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
    tipo: {
        type: String,
        enum: ['Cocina', 'Closet', 'vestidor', 'Mueble para el baño'],
        required: true
    },
    estado: {
        type: String,
        enum: ['cotizacion', 'aprobado', 'en_produccion', 'instalando', 'completado'],
        default: 'cotizacion'
    },
    // Timeline público visible al cliente
    timelineActual: {
        type: String,
        default: 'Cotización en proceso'
    },
    pasosPosibles: [{
        type: String
    }],
    // Archivos privados (backend audit trail)
    archivos: [{
        id: String,
        nombre: String,
        tipo: String,
        url: { type: String, default: '' },
        key: { type: String, default: '' },
        provider: { type: String, enum: ['dropbox', 'cloudinary', 'local'], default: 'local' },
        mimeType: { type: String, default: '' },
        clienteId: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now }
    }],
    // Archivos públicos visibles al cliente
    archivosPublicos: [archivoPublicoSchema],
    // Información de pagos
    presupuestoTotal: {
        type: Number,
        default: 0
    },
    anticipo: {
        type: Number,
        default: 0
    },
    segundoPago: {
        type: Number,
        default: 0
    },
    liquidacion: {
        type: Number,
        default: 0
    },
    // Referencias a otros modelos
    cotizacion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cotizacion'
    },
    levantamiento: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Levantamiento'
    },
    empleadoAsignado: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    }
}, {
    timestamps: true
});

// Índices para mejorar el rendimiento
proyectoSchema.index({ cliente: 1 });
proyectoSchema.index({ clienteRef: 1 });
proyectoSchema.index({ clienteId: 1 });
proyectoSchema.index({ estado: 1 });
proyectoSchema.index({ empleadoAsignado: 1 });

const ProyectoModel = connectDBClientes.models && connectDBClientes.models.Proyecto
    ? connectDBClientes.model('Proyecto')
    : connectDBClientes.model('Proyecto', proyectoSchema);

export default ProyectoModel;
 
