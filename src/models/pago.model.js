import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const pagoSchema = new mongoose.Schema({
    ordenTrabajo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrdenTrabajo',
        required: true
    },
    monto: {
        type: Number,
        required: true,
        min: 0
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    concepto: {
        type: String,
        default: '',
        trim: true
    },
    registradoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    }
}, {
    timestamps: true
});

pagoSchema.index({ ordenTrabajo: 1, fecha: -1 });

export default connectDBClientes.model('Pago', pagoSchema);
