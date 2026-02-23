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

// Subesquema para herrajes individuales
const herrajeItemSchema = new mongoose.Schema({
    herrajeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Materiales'
    },
    nombre: {
        type: String,
        default: ''
    },
    precioUnitario: {
        type: Number,
        default: 0,
        min: 0
    },
    enabled: {
        type: Boolean,
        default: false
    },
    cantidad: {
        type: Number,
        default: 0,
        min: 0
    }
}, { _id: false });

const cotizacionSchema = new mongoose.Schema({
    // SECCIÓN A - Datos del proyecto
    cliente: {
        type: String,
        default: ''
    },
    clienteRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cliente',
        default: null
    },
    projectType: {
        type: String,
        enum: ['Cocina', 'Closet', 'vestidor', 'Mueble para el baño'],
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
        largo: { type: Number, default: 4.2, min: 0 },
        alto: { type: Number, default: 2.4, min: 0 },
        fondo: { type: Number, default: 0.6, min: 0 },
        metrosLineales: { type: Number, default: 6, min: 0 }
    },
    
    // SECCIÓN B - Nivel de acabados
    selectedScenario: {
        type: String,
        enum: ['esencial', 'tendencia', 'premium'],
        default: null
    },
    multiplicadorEscenario: {
        type: Number,
        default: 1.0
    },
    
    // SECCIÓN C - Materiales
    materialBase: {
        type: String,
        default: 'melamina'
    },
    materialBaseRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Materiales',
        default: null
    },
    precioMaterialPorMetro: {
        type: Number,
        default: 0,
        min: 0
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
    factorGrosor: {
        type: Number,
        default: 1.0
    },
    
    // SECCIÓN C - Herrajes (mantener hardware para compatibilidad)
    hardware: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    herrajes: [herrajeItemSchema],
    
    // SECCIÓN C - Mano de obra y extras
    labor: { type: Number, default: 12000, min: 0 },
    flete: { type: Number, default: 2500, min: 0 },
    instalacion: { type: Number, default: 4800, min: 0 },
    desinstalacion: { type: Number, default: 0, min: 0 },
    
    // SECCIÓN D - Cálculos finales
    materialSubtotal: { type: Number, default: 0 },
    hardwareSubtotal: { type: Number, default: 0 },
    laborSubtotal: { type: Number, default: 0 },
    finalPrice: { type: Number, default: 0 },
    
    // Estado y seguimiento
    estado: {
        type: String,
        enum: ['borrador', 'enviado', 'aprobado', 'enviada', 'aprobada', 'en_produccion', 'lista_instalacion', 'instalada', 'rechazada', 'archivada'],
        default: 'borrador'
    },
    historialEstados: [historialEstadoSchema],
    empleadoAsignado: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        default: null
    },
    
    // Metadata adicional
    notas: {
        type: String,
        default: ''
    },
    origenLevantamiento: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Levantamiento',
        default: null
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

// Índices para optimizar consultas
cotizacionSchema.index({ creadoPor: 1, estado: 1 });
cotizacionSchema.index({ cliente: 1 });
cotizacionSchema.index({ empleadoAsignado: 1 });

// Middleware pre-save para calcular precios automáticamente
cotizacionSchema.pre('save', function(next) {
    // CÁLCULO 1 - Factor de grosor
    this.factorGrosor = this.materialThickness === '19' ? 1.08 : 1.0;
    
    // CÁLCULO 2 - Multiplicador de escenario
    const multiplicadoresEscenario = {
        'esencial': 0.92,
        'tendencia': 1.05,
        'premium': 1.18
    };
    if (this.selectedScenario) {
        this.multiplicadorEscenario = multiplicadoresEscenario[this.selectedScenario] || 1.0;
    }
    
    // CÁLCULO 3 - Subtotal de materiales
    const metrosLineales = this.medidas?.metrosLineales || 0;
    const precioMaterial = this.precioMaterialPorMetro || 0;
    this.materialSubtotal = metrosLineales * precioMaterial * this.factorGrosor;
    
    // CÁLCULO 4 - Subtotal de herrajes
    if (this.herrajes && this.herrajes.length > 0) {
        this.hardwareSubtotal = this.herrajes.reduce((sum, item) => {
            if (item.enabled) {
                return sum + (item.cantidad * item.precioUnitario);
            }
            return sum;
        }, 0);
    } else {
        this.hardwareSubtotal = 0;
    }
    
    // CÁLCULO 5 - Subtotal de mano de obra
    this.laborSubtotal = (this.labor || 0) + (this.flete || 0) + (this.instalacion || 0) + (this.desinstalacion || 0);
    
    // CÁLCULO 6 - Precio final
    this.finalPrice = this.materialSubtotal + this.hardwareSubtotal + this.laborSubtotal;
    
    next();
});

export default connectDBClientes.model('Cotizacion', cotizacionSchema);
