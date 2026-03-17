import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';
import crypto from 'crypto';

const ordenTrabajoSchema = new mongoose.Schema({
    // Número único de seguimiento (alfanumérico aleatorio)
    numeroSeguimiento: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    // Relación con la cita original
    cita: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Citas',
        required: true
    },
    // Cliente propietario (embebido: quien registró la cita; puede no tener cuenta User)
    cliente: {
        nombre: { type: String, default: '' },
        correo: { type: String, default: '' },
        telefono: { type: String, default: '' }
    },
    // Diseño asociado (puede ser null si está pendiente)
    diseno: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Disenos',
        required: false,
        default: null
    },
    // Ingeniero asignado
    ingenieroAsignado: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: false
    },
    // Estado del progreso
    estado: {
        type: String,
        enum: [
            'pendiente_diseño',
            'maquetacion',
            'compra_materiales',
            'fabricacion_iniciada',
            'armado_final',
            'fabricacion_lista',
            'instalacion',
            'completado'
        ],
        default: 'pendiente_diseño'
    },
    // Progreso en porcentaje (calculado automáticamente)
    porcentajeProgreso: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    // Historial de cambios de estado
    historialEstados: [{
        estadoAnterior: String,
        estadoNuevo: String,
        fecha: {
            type: Date,
            default: Date.now
        },
        modificadoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Users'
        },
        comentario: String
    }],
    // Evidencias del progreso (fotos, documentos)
    evidencias: [{
        tipo: {
            type: String,
            enum: ['foto', 'documento', 'video'],
            default: 'foto'
        },
        url: {
            type: String,
            required: true
        },
        public_id: {
            type: String,
            required: true
        },
        descripcion: String,
        estado: {
            type: String,
            enum: [
                'pendiente_diseño',
                'maquetacion',
                'compra_materiales',
                'fabricacion_iniciada',
                'armado_final',
                'fabricacion_lista',
                'instalacion',
                'completado'
            ]
        },
        fecha: {
            type: Date,
            default: Date.now
        },
        subidoPor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Users'
        }
    }],
    // Fechas importantes
    fechaInicio: {
        type: Date,
        default: Date.now
    },
    fechaEstimadaFinalizacion: {
        type: Date,
        required: false
    },
    fechaFinalizacion: {
        type: Date,
        required: false
    },
    // Notas internas (solo visibles para admin/ingeniero)
    notasInternas: {
        type: String,
        default: ''
    },
    // Observaciones del cliente
    observacionesCliente: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Índices para búsquedas eficientes
ordenTrabajoSchema.index({ cliente: 1 });
ordenTrabajoSchema.index({ ingenieroAsignado: 1 });
ordenTrabajoSchema.index({ estado: 1 });

// Método para generar número de seguimiento único
ordenTrabajoSchema.statics.generarNumeroSeguimiento = async function() {
    let numeroSeguimiento;
    let existe = true;
    
    while (existe) {
        // Generar 8 caracteres alfanuméricos aleatorios
        numeroSeguimiento = crypto.randomBytes(4).toString('hex').toUpperCase();
        
        // Verificar si ya existe
        const ordenExistente = await this.findOne({ numeroSeguimiento });
        existe = !!ordenExistente;
    }
    
    return numeroSeguimiento;
};

// Método para calcular porcentaje de progreso basado en el estado
ordenTrabajoSchema.methods.calcularProgreso = function() {
    const estadosProgreso = {
        'pendiente_diseño': 5,
        'maquetacion': 15,
        'compra_materiales': 25,
        'fabricacion_iniciada': 40,
        'armado_final': 60,
        'fabricacion_lista': 75,
        'instalacion': 90,
        'completado': 100
    };
    
    this.porcentajeProgreso = estadosProgreso[this.estado] || 0;
    return this.porcentajeProgreso;
};

// Método para cambiar estado y registrar en historial
ordenTrabajoSchema.methods.cambiarEstado = function(nuevoEstado, usuarioId, comentario = '') {
    this.historialEstados.push({
        estadoAnterior: this.estado,
        estadoNuevo: nuevoEstado,
        fecha: new Date(),
        modificadoPor: usuarioId,
        comentario
    });
    
    this.estado = nuevoEstado;
    this.calcularProgreso();
    
    // Si se completa, registrar fecha de finalización
    if (nuevoEstado === 'completado') {
        this.fechaFinalizacion = new Date();
    }
    
    return this.save();
};

// Hook pre-save para calcular progreso automáticamente
ordenTrabajoSchema.pre('save', function(next) {
    if (this.isModified('estado')) {
        this.calcularProgreso();
    }
    next();
});

const OrdenTrabajoModel = connectDBClientes.models && connectDBClientes.models.OrdenTrabajo
    ? connectDBClientes.model('OrdenTrabajo')
    : connectDBClientes.model('OrdenTrabajo', ordenTrabajoSchema);

export default OrdenTrabajoModel;
