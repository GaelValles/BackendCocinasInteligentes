import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const cotizacionSchema = new mongoose.Schema({
    cliente: {
        type: String,
        default: ''
    },
    projectType: {
        type: String,
        default: 'Cocina'
    },
    ubicacion: {
        type: String,
        default: ''
    },
    fechaInstalacion: {
        type: Date,
        default: null
    },
    medidas: {
        largo: { type: Number, default: 4.2 },
        alto: { type: Number, default: 2.4 },
        fondo: { type: Number, default: 0.6 },
        metrosLineales: { type: Number, default: 6 }
    },
    materialBase: {
        type: String,
        default: 'melamina'
    },
    selectedScenario: {
        type: String,
        default: null
    },
    materialColor: {
        type: String,
        default: 'Blanco Nieve'
    },
    materialThickness: {
        type: String,
        enum: ['16', '19'],
        default: '16'
    },
    hardware: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    labor: { type: Number, default: 12000 },
    flete: { type: Number, default: 2500 },
    instalacion: { type: Number, default: 4800 },
    desinstalacion: { type: Number, default: 0 },
    materialSubtotal: { type: Number, default: 0 },
    hardwareSubtotal: { type: Number, default: 0 },
    laborSubtotal: { type: Number, default: 0 },
    finalPrice: { type: Number, default: 0 },
    estado: {
        type: String,
        enum: ['borrador', 'enviado', 'aprobado'],
        default: 'borrador'
    },
    creadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        default: null
    },
    cita: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Citas',
        default: null
    },
    porcentajeUtilidad: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

cotizacionSchema.index({ creadoPor: 1, estado: 1 });
cotizacionSchema.index({ cliente: 1 });

export default connectDBClientes.model('Cotizacion', cotizacionSchema);
