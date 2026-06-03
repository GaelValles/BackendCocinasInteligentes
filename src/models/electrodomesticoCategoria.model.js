import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const electrodomesticoCategoriaSchema = new mongoose.Schema({
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

const ElectrodomesticoCategoria = connectDBClientes.models && connectDBClientes.models.ElectrodomesticoCategoria
    ? connectDBClientes.model('ElectrodomesticoCategoria')
    : connectDBClientes.model('ElectrodomesticoCategoria', electrodomesticoCategoriaSchema);

export default ElectrodomesticoCategoria;