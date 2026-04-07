import Admin from '../models/admin.model.js';
import bcrypt from 'bcryptjs';

const ROLES_ASIGNABLES = ['admin', 'arquitecto', 'empleado', 'ingeniero', 'empleado_general'];

const DEFAULT_TEMP_PASSWORD_LENGTH = 12;

const generateTempPassword = (length = DEFAULT_TEMP_PASSWORD_LENGTH) => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*';
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
};

const isEmailValid = (value = '') => {
    const email = String(value).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Crear usuario operativo para modal Integrantes
 * POST /api/usuarios
 */
export const crear = async (req, res) => {
    try {
        const { nombre, correo, rol, password } = req.body || {};

        if (!nombre || String(nombre).trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'nombre es obligatorio'
            });
        }

        if (!correo || String(correo).trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'correo es obligatorio'
            });
        }

        if (!isEmailValid(correo)) {
            return res.status(400).json({
                success: false,
                message: 'correo invalido'
            });
        }

        if (!rol || !['admin', 'arquitecto', 'empleado'].includes(String(rol))) {
            return res.status(400).json({
                success: false,
                message: 'rol invalido. Valores permitidos: admin, arquitecto, empleado'
            });
        }

        const correoNormalizado = String(correo).trim().toLowerCase();
        const existe = await Admin.findOne({ correo: correoNormalizado }).select('_id');
        if (existe) {
            return res.status(409).json({
                success: false,
                message: 'El correo ya existe'
            });
        }

        const rawPassword = password && String(password).trim().length >= 6
            ? String(password)
            : generateTempPassword();

        const passwordHash = await bcrypt.hash(rawPassword, 10);

        const nuevoUsuario = new Admin({
            nombre: String(nombre).trim(),
            correo: correoNormalizado,
            rol: String(rol),
            telefono: 'N/A',
            password: passwordHash,
            status: true
        });

        const saved = await nuevoUsuario.save();

        return res.status(201).json({
            success: true,
            message: 'Usuario creado correctamente',
            data: {
                _id: saved._id,
                nombre: saved.nombre,
                correo: saved.correo,
                rol: saved.rol,
                activo: saved.status !== false,
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt
            }
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'El correo ya existe'
            });
        }

        console.error('Error al crear usuario:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al crear usuario',
            error: error.message
        });
    }
};

/**
 * Listar todos los usuarios activos
 */
export const listar = async (req, res) => {
    try {
        const usuarios = await Admin.find({ status: { $ne: false } })
            .select('nombre correo telefono rol status createdAt');

        const data = usuarios.map((u) => ({
            _id: u._id,
            nombre: u.nombre,
            correo: u.correo,
            telefono: u.telefono,
            rol: u.rol,
            activo: u.status !== false,
            createdAt: u.createdAt
        }));

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar usuarios',
            error: error.message
        });
    }
};

/**
 * Listar empleados (arquitectos y empleados)
 */
export const listarEmpleados = async (req, res) => {
    try {
        const empleados = await Admin.find({
            status: { $ne: false },
            rol: { $in: ROLES_ASIGNABLES }
        }).select('nombre correo telefono rol status');

        const data = empleados.map((u) => ({
            _id: u._id,
            nombre: u.nombre,
            correo: u.correo,
            telefono: u.telefono,
            rol: u.rol,
            activo: u.status !== false
        }));

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error al listar empleados:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar empleados',
            error: error.message
        });
    }
};

/**
 * Obtener usuario por ID
 */
export const obtenerPorId = async (req, res) => {
    try {
        const usuario = await Admin.findById(req.params.id)
            .select('nombre correo telefono rol status createdAt');

        if (!usuario) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                _id: usuario._id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                telefono: usuario.telefono,
                rol: usuario.rol,
                activo: usuario.status !== false,
                createdAt: usuario.createdAt
            }
        });
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuario',
            error: error.message
        });
    }
};
