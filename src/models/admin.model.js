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
        enum: ['admin', 'ingeniero', 'arquitecto', 'cliente', 'empleado', 'empleado_general'],
        required: true,
        default: 'cliente'
    },
    status: {
        type: Boolean,
        default: true
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

const UsersModel = connectDBClientes.models && connectDBClientes.models.Users
    ? connectDBClientes.model('Users')
    : connectDBClientes.model('Users', usersSchema);

export default UsersModel;