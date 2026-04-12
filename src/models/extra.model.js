import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const extraSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    categoriaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExtraCategoria',
        default: null
    },
    categoria: {
        type: String,
        required: true,
        trim: true
    },
    subtipo: {
        type: String,
        trim: true,
        default: null
    },
    precio: {
        type: Number,
        default: 0,
        min: 0
    },
    descripcion: {
        type: String,
        default: ''
    },
    imagenUrl: {
        type: String,
        default: null
    },
    thumbnailUrl: {
        type: String,
        default: null
    },
    disponible: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const Extra = connectDBClientes.model('Extra', extraSchema);
export default Extra;
