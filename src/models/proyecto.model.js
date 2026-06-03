import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';
import { resolveOrCreateClienteIdentidad } from '../services/clienteIdentidad.service.js';

const pagoDetalleSchema = new mongoose.Schema({
    amount: { type: Number, min: 0, default: 0 },
    date: { type: String, default: '' },
    receiptLabel: { type: String, default: 'Ver recibo' },
    receiptImage: { type: String, default: '' }
}, { _id: false });

const archivoPublicoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    tipo: {
        type: String,
        enum: ['jpg', 'jpeg', 'pdf', 'png', 'webp', 'cotizacion_formal', 'hoja_taller', 'levantamiento_detallado', 'recibo', 'recibo_1', 'recibo_2', 'recibo_3', 'contrato', 'otro'],
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
    pagos: {
        anticipo: { type: pagoDetalleSchema, default: () => ({}) },
        segundoPago: { type: pagoDetalleSchema, default: () => ({}) },
        liquidacion: { type: pagoDetalleSchema, default: () => ({}) }
    },
    seguimientoNota: {
        type: String,
        default: ''
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

// Hook pre-save para asegurar que clienteId está poblado con código de clienteIdentidad
proyectoSchema.pre('save', async function preSaveClienteIdentidad(next) {
    try {
        // Si ya tiene clienteId y clienteRef, no hacer nada
        if (this.clienteId && this.clienteRef) {
            return next();
        }

        // Si tiene clienteRef pero no clienteId, resolver desde la referencia
        if (this.clienteRef && !this.clienteId) {
            const ClienteIdentidad = mongoose.model('ClienteIdentidad');
            const cliente = await ClienteIdentidad.findById(this.clienteRef).lean();
            if (cliente?.codigo) {
                this.clienteId = cliente.codigo;
            }
            return next();
        }

        // Si no tiene referencias, intentar crear o resolver clienteIdentidad
        if (!this.clienteRef || !this.clienteId) {
            const nombreCliente = this.nombreCliente || this.nombre || 'Cliente';
            const clienteIdentidad = await resolveOrCreateClienteIdentidad({
                nombre: nombreCliente,
                correo: '',
                telefono: ''
            });

            if (clienteIdentidad) {
                this.clienteRef = clienteIdentidad._id;
                this.clienteId = clienteIdentidad.codigo;
            }
        }

        next();
    } catch (error) {
        console.warn('Error en pre-save de clienteIdentidad para proyecto:', error.message);
        next();
    }
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
 
