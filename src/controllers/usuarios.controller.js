import Admin from '../models/admin.model.js';

/**
 * Listar todos los usuarios activos
 */
export const listar = async (req, res) => {
    try {
        const usuarios = await Admin.find()
            .select('nombre correo telefono rol createdAt');

        res.status(200).json({
            success: true,
            data: usuarios
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
            rol: { $in: ['admin', 'arquitecto', 'empleado'] }
        }).select('nombre correo telefono rol');

        res.status(200).json({
            success: true,
            data: empleados
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
            .select('nombre correo telefono rol createdAt');

        if (!usuario) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: usuario
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
