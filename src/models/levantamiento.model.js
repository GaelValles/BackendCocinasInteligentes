import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

// Subesquema para historial de estados
const historialEstadoSchema = new mongoose.Schema({
    estado: {
        type: String,
        required: true
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    usuario: {
        type: String,
        default: 'Sistema'
    },
    notas: {
        type: String,
        default: ''
    }
}, { _id: false });

const levantamientoSchema = new mongoose.Schema({
    // PASO 1 - Información del cliente
    cliente: {
        nombre: {
            type: String,
            required: [true, 'Nombre del cliente es requerido'],
            trim: true
        },
        direccion: {
            type: String,
            required: [true, 'Dirección es requerida'],
            trim: true
        },
        telefono: {
            type: String,
            required: [true, 'Teléfono es requerido'],
            trim: true
        }
    },
    
    // PASO 2 - Geometría
    metrosLineales: {
        type: Number,
        required: [true, 'Metros lineales es requerido'],
        min: [0, 'Metros lineales debe ser mayor o igual a 0']
    },
    
    // PASO 3 - Necesidades
    requiereIsla: {
        type: Boolean,
        default: false
    },
    alacenasAltas: {
        type: Boolean,
        default: false
    },
    tipoCubierta: {
        type: String,
        required: [true, 'Tipo de cubierta es requerido'],
        enum: {
            values: ['Granito Básico', 'Cuarzo', 'Piedra Sinterizada'],
            message: 'Tipo de cubierta no válido'
        }
    },
    
    // PASO 4 - Selección de escenario
    escenarioSeleccionado: {
        type: String,
        required: [true, 'Escenario es requerido'],
        enum: {
            values: ['esencial', 'tendencia', 'premium'],
            message: 'Escenario no válido'
        }
    },
    
    // Campos de cálculo (se calculan automáticamente)
    precioBase: {
        type: Number,
        default: 0
    },
    factorMaterial: {
        type: Number,
        default: 1.0
    },
    multiplicadorEscenario: {
        type: Number,
        default: 1.0
    },
    precioEstimado: {
        type: Number,
        default: 0
    },
    rangoMin: {
        type: Number,
        default: 0
    },
    rangoMax: {
        type: Number,
        default: 0
    },
    
    // PASO 5 - Asignación y seguimiento
    empleadoAsignado: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        default: null
    },
    estado: {
        type: String,
        enum: ['pendiente', 'en_revision', 'contactado', 'cotizado', 'rechazado', 'archivado'],
        default: 'pendiente'
    },
    historialEstados: [historialEstadoSchema],
    
    // Metadata adicional
    notas: {
        type: String,
        default: ''
    },
    convertidoACotizacion: {
        type: Boolean,
        default: false
    },
    cotizacionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cotizacion',
        default: null
    }
}, {
    timestamps: true
});

// Índices para optimizar consultas
levantamientoSchema.index({ estado: 1, createdAt: -1 });
levantamientoSchema.index({ empleadoAsignado: 1 });

// Middleware pre-save para calcular precios automáticamente
levantamientoSchema.pre('save', function(next) {
    // Constantes de cálculo
    const PRECIO_BASE_POR_METRO = 5000;
    
    const factoresMaterial = {
        'Granito Básico': 1.0,
        'Cuarzo': 1.2,
        'Piedra Sinterizada': 1.5
    };
    
    const multiplicadoresEscenario = {
        'esencial': 0.9,
        'tendencia': 1.1,
        'premium': 1.35
    };
    
    // Calcular precio base
    this.precioBase = this.metrosLineales * PRECIO_BASE_POR_METRO;
    
    // Obtener factor de material
    this.factorMaterial = factoresMaterial[this.tipoCubierta] || 1.0;
    
    // Obtener multiplicador de escenario
    this.multiplicadorEscenario = multiplicadoresEscenario[this.escenarioSeleccionado] || 1.0;
    
    // Calcular precio estimado
    this.precioEstimado = this.precioBase * this.factorMaterial * this.multiplicadorEscenario;
    
    // Calcular rangos
    this.rangoMin = Math.round(this.precioEstimado * 0.93);
    this.rangoMax = Math.round(this.precioEstimado * 1.08);
    
    next();
});

const LevantamientoModel = connectDBClientes.models && connectDBClientes.models.Levantamiento
    ? connectDBClientes.model('Levantamiento')
    : connectDBClientes.model('Levantamiento', levantamientoSchema);

export default LevantamientoModel;
