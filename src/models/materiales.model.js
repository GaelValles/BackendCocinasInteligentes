import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const materialesSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    descripcion: {
        type: String,
        default: ''
    },
    unidadMedida: {
        type: String,
        required: true,
        enum: [
            'm²',     // metro cuadrado
            'm³',     // metro cúbico
            'm',      // metro lineal
            'unidad', // pieza individual
            'caja',   // caja
            'paquete' // paquete
        ],
        default: 'unidad'
    },
    precioUnitario: {
        type: Number,
        required: function () { return this.precioPorMetro == null; },
        min: 0,
        default: null
    },
    // ID usado por el cotizador frontend (ej: "melamina", "mdf", "correderas")
    idCotizador: {
        type: String,
        trim: true,
        sparse: true,
        unique: true
    },
    // Precio por metro lineal (solo para materiales base: melamina, mdf, tech)
    precioPorMetro: {
        type: Number,
        min: 0,
        default: null
    },
    categoria: {
        type: String,
        required: true,
        enum: [
            'Madera',
            'Metal',
            'Piedra',
            'Granito',
            'Mármol',
            'Acero Inoxidable',
            'Pintura',
            'Herrajes',
            'Iluminación',
            'Adhesivos',
            'Otro'
        ]
    },
    proveedor: {
        type: String,
        default: ''
    },
    disponible: {
        type: Boolean,
        default: true
    },
    // Historial de precios para rastrear cambios
    historialPrecios: [{
        precio: {
            type: Number,
            required: true
        },
        fecha: {
            type: Date,
            default: Date.now
        },
        modificadoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Clientes'
        }
    }]
}, {
    timestamps: true
});

// Índices para búsquedas eficientes
materialesSchema.index({ nombre: 1 });
materialesSchema.index({ categoria: 1, disponible: 1 });

// Método para actualizar precio y guardar historial
materialesSchema.methods.actualizarPrecio = function(nuevoPrecio, usuarioId) {
    this.historialPrecios.push({
        precio: this.precioUnitario,
        fecha: new Date(),
        modificadoPor: usuarioId
    });
    this.precioUnitario = nuevoPrecio;
    return this.save();
};

export default connectDBClientes.model('Materiales', materialesSchema);
