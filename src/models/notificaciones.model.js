import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const notificacionesSchema = new mongoose.Schema({
    // Usuario destinatario
    destinatario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    // Tipo de notificación
    tipo: {
        type: String,
        enum: [
            'cambio_estado_orden',
            'asignacion_orden',
            'diseño_pendiente',
            'diseño_autorizado',
            'diseño_rechazado',
            'nueva_cita',
            'cita_cancelada',
            'material_agregado',
            'comentario_nuevo'
        ],
        required: true
    },
    // Título de la notificación
    titulo: {
        type: String,
        required: true
    },
    // Mensaje/contenido
    mensaje: {
        type: String,
        required: true
    },
    // Referencia a la entidad relacionada
    entidadRelacionada: {
        tipo: {
            type: String,
            enum: ['OrdenTrabajo', 'Citas', 'Disenos', 'Materiales'],
            required: true
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        }
    },
    // Estado de la notificación
    leida: {
        type: Boolean,
        default: false
    },
    // Fecha de lectura
    fechaLectura: {
        type: Date,
        required: false
    },
    // Prioridad
    prioridad: {
        type: String,
        enum: ['baja', 'media', 'alta', 'urgente'],
        default: 'media'
    },
    // Para notificaciones email
    enviadoPorEmail: {
        type: Boolean,
        default: false
    },
    fechaEnvioEmail: {
        type: Date,
        required: false
    },
    // Para notificaciones push
    enviadoPorPush: {
        type: Boolean,
        default: false
    },
    fechaEnvioPush: {
        type: Date,
        required: false
    }
}, {
    timestamps: true
});

// Índices para búsquedas eficientes
notificacionesSchema.index({ destinatario: 1, leida: 1 });
notificacionesSchema.index({ destinatario: 1, createdAt: -1 });
notificacionesSchema.index({ 'entidadRelacionada.tipo': 1, 'entidadRelacionada.id': 1 });

// Método estático para crear notificación
notificacionesSchema.statics.crearNotificacion = async function(data) {
    const notificacion = new this({
        destinatario: data.destinatario,
        tipo: data.tipo,
        titulo: data.titulo,
        mensaje: data.mensaje,
        entidadRelacionada: data.entidadRelacionada,
        prioridad: data.prioridad || 'media'
    });
    
    await notificacion.save();
    
    // Aquí se puede integrar el envío de email/push
    // Por ahora solo creamos el registro
    
    return notificacion;
};

// Método para marcar como leída
notificacionesSchema.methods.marcarComoLeida = function() {
    this.leida = true;
    this.fechaLectura = new Date();
    return this.save();
};

// Método estático para obtener notificaciones no leídas de un usuario
notificacionesSchema.statics.obtenerNoLeidas = function(usuarioId) {
    return this.find({
        destinatario: usuarioId,
        leida: false
    }).sort({ createdAt: -1 });
};

// Método estático para notificar cambio de estado en orden de trabajo
notificacionesSchema.statics.notificarCambioEstadoOrden = async function(ordenTrabajo, nuevoEstado) {
    const estadosTexto = {
        'pendiente_diseño': 'Pendiente de diseño',
        'maquetacion': 'En maquetación del diseño',
        'compra_materiales': 'Comprando materiales',
        'fabricacion_iniciada': 'Fabricación iniciada',
        'armado_final': 'En etapa final de armado',
        'fabricacion_lista': 'Fabricación lista',
        'instalacion': 'En proceso de instalación',
        'completado': 'Trabajo completado'
    };
    
    // Notificar al cliente
    await this.crearNotificacion({
        destinatario: ordenTrabajo.cliente,
        tipo: 'cambio_estado_orden',
        titulo: 'Actualización de tu proyecto',
        mensaje: `Tu orden #${ordenTrabajo.numeroSeguimiento} cambió a: ${estadosTexto[nuevoEstado]}`,
        entidadRelacionada: {
            tipo: 'OrdenTrabajo',
            id: ordenTrabajo._id
        },
        prioridad: nuevoEstado === 'completado' ? 'alta' : 'media'
    });
    
    // Si hay ingeniero asignado, también notificarle
    if (ordenTrabajo.ingenieroAsignado) {
        await this.crearNotificacion({
            destinatario: ordenTrabajo.ingenieroAsignado,
            tipo: 'cambio_estado_orden',
            titulo: 'Estado de orden actualizado',
            mensaje: `La orden #${ordenTrabajo.numeroSeguimiento} cambió a: ${estadosTexto[nuevoEstado]}`,
            entidadRelacionada: {
                tipo: 'OrdenTrabajo',
                id: ordenTrabajo._id
            }
        });
    }
};

export default connectDBClientes.model('Notificaciones', notificacionesSchema);
