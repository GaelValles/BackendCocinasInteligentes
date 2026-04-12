import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const electrodomesticoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
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
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
    }
}, {
    timestamps: true
});

const Electrodomestico = connectDBClientes.model('Electrodomestico', electrodomesticoSchema);
export default Electrodomestico;
