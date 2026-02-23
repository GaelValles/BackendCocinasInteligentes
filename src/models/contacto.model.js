import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

// Primer contacto desde la landing (nombre, teléfono, correo, mensaje opcional)
const contactoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    telefono: {
        type: String,
        required: true,
        trim: true
    },
    correo: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    mensaje: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

contactoSchema.index({ correo: 1, createdAt: -1 });

export default connectDBClientes.model('Contacto', contactoSchema);
