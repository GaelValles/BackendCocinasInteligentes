import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const usersSchema = new mongoose.Schema({
    nombre:{
        type: String,
        required: true
    },
    correo:{
        type: String,
        required: true,
        unique: true,
    },
    telefono:{
        type: String,
        required: true
    },
    rol:{
        type: String,
        enum: ['admin', 'ingeniero', 'arquitecto', 'cliente'],
        required: true,
        default: 'cliente'
    },
    password:{
        type: String,
        required: true
    },
    citas: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Citas'
    }],

    penaltyUntil: {
        type: Date,
        default: null
    },
    cancelacionesCount: {
        type: Number,
        default: 0
    }
},
{
    timestamps: true
});

export default connectDBClientes.model('Users', usersSchema);