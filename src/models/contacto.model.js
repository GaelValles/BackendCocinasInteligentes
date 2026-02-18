import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

// Primer contacto desde la landing (nombre, teléfono, correo)
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
    }
}, {
    timestamps: true
});

contactoSchema.index({ correo: 1, createdAt: -1 });

export default connectDBClientes.model('Contacto', contactoSchema);
