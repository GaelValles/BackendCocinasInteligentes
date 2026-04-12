import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const extraCategoriaSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    descripcion: {
        type: String,
        default: ''
    },
    orden: {
        type: Number,
        default: 0
    },
    disponible: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const ExtraCategoria = connectDBClientes.model('ExtraCategoria', extraCategoriaSchema);
export default ExtraCategoria;
