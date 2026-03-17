import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const diasInhabilesSchema = new mongoose.Schema({
    fecha: {
        type: Date,
        required: true
    },
    registradoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    }
}, {
    timestamps: true
});

// Índice único para fecha (evita duplicados y mejora búsquedas)
diasInhabilesSchema.index({ fecha: 1 }, { unique: true });

const DiasModel = connectDBClientes.models && connectDBClientes.models.DiasInhabiles
    ? connectDBClientes.model('DiasInhabiles')
    : connectDBClientes.model('DiasInhabiles', diasInhabilesSchema);

export default DiasModel;