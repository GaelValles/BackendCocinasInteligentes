import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const disenosSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true
    },
    descripcion: {
        type: String,
        required: true
    },
    imagenes: [{
        url: {
            type: String,
            required: true
        },
        public_id: {
            type: String,
            required: true
        }
    }],
    precioBase: {
        type: Number,
        default: 0
    },
    estado: {
        type: String,
        enum: ['borrador', 'preliminar', 'autorizado'],
        default: 'borrador'
    },
    disponible: {
        type: Boolean,
        default: false
    },
    // Arquitecto que creó/subió el diseño
    arquitecto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: false
    },
    // Admin que autorizó el diseño
    autorizadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: false
    },
    fechaAutorizacion: {
        type: Date,
        required: false
    },
    categoria: {
        type: String,
        required: true,
        enum: [
            'En linea',
            'vintage',
            'Industrial',
            'Minimalista',
            'Rústica',
            'En "U"',
            'En "L"',
            'inteligente',
            'En escuadra'
        ]
    },
    // Materiales con cantidades específicas
    materiales: [{
        material: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Materiales',
            required: true
        },
        cantidad: {
            type: Number,
            required: true,
            min: 0
        },
        // Precio al momento de agregar el material (para histórico)
        precioRegistrado: {
            type: Number,
            required: true
        }
    }],
    // Costo total de materiales (calculado)
    costoMateriales: {
        type: Number,
        default: 0
    },
    especificaciones: {
        dimensiones: String,
        color: String,
        estilo: String
    }
}, {
    timestamps: true
});

// Índice para búsquedas por disponibilidad y categoría
disenosSchema.index({ disponible: 1, categoria: 1 });

// Método para calcular el costo total de materiales
disenosSchema.methods.calcularCostoMateriales = function() {
    this.costoMateriales = this.materiales.reduce((total, item) => {
        return total + (item.cantidad * item.precioRegistrado);
    }, 0);
    return this.costoMateriales;
};

// Método para calcular el precio final (solo materiales)
disenosSchema.methods.calcularPrecioFinal = function() {
    return this.calcularCostoMateriales();
};

// Hook pre-save para actualizar costos automáticamente
disenosSchema.pre('save', function(next) {
    if (this.isModified('materiales')) {
        this.costoMateriales = this.calcularCostoMateriales();
        this.precioBase = this.calcularPrecioFinal();
    }
    next();
});

const DisenosModel = connectDBClientes.models && connectDBClientes.models.Disenos
    ? connectDBClientes.model('Disenos')
    : connectDBClientes.model('Disenos', disenosSchema);

export default DisenosModel;
