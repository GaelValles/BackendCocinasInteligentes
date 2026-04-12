import ExtraCategoria from '../models/extraCategoria.model.js';

const isAdmin = (req) => req.admin?.rol === 'admin';
const isEmpleado = (req) => req.admin?.rol === 'empleado';
const isAuthorized = (req) => isAdmin(req) || isEmpleado(req);

export const listarExtrasCategorias = async (req, res) => {
    try {
        const categorias = await ExtraCategoria.find({ disponible: true })
            .lean()
            .sort({ orden: 1, createdAt: -1 });

        return res.json({
            success: true,
            data: categorias
        });
    } catch (error) {
        console.error('Error listando categorías de extras:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar categorías de extras',
            error: error.message
        });
    }
};

export const crearExtraCategoria = async (req, res) => {
    try {
        if (!isAuthorized(req)) {
            return res.status(403).json({
                success: false,
                message: 'No autorizado para crear categorías de extras'
            });
        }

        const { nombre, descripcion, orden } = req.body;

        if (!nombre) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: [
                    { field: 'nombre', message: 'Nombre requerido' }
                ]
            });
        }

        // Verificar si la categoría ya existe
        const existente = await ExtraCategoria.findOne({ nombre: nombre.trim() });
        if (existente) {
            return res.status(400).json({
                success: false,
                message: 'La categoría ya existe'
            });
        }

        const nuevaCategoria = new ExtraCategoria({
            nombre: nombre.trim(),
            descripcion: descripcion || '',
            orden: orden || 0
        });

        await nuevaCategoria.save();

        return res.status(201).json({
            success: true,
            message: 'Categoría de extras creada correctamente',
            data: nuevaCategoria
        });
    } catch (error) {
        console.error('Error creando categoría de extras:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear categoría de extras',
            error: error.message
        });
    }
};

export const actualizarExtraCategoria = async (req, res) => {
    try {
        if (!isAuthorized(req)) {
            return res.status(403).json({
                success: false,
                message: 'No autorizado para actualizar categorías de extras'
            });
        }

        const { id } = req.params;
        const { nombre, descripcion, orden, disponible } = req.body;

        const categoria = await ExtraCategoria.findById(id);
        if (!categoria) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        if (nombre !== undefined) categoria.nombre = nombre.trim();
        if (descripcion !== undefined) categoria.descripcion = descripcion;
        if (orden !== undefined) categoria.orden = orden;
        if (disponible !== undefined) categoria.disponible = disponible;

        await categoria.save();

        return res.json({
            success: true,
            message: 'Categoría actualizada correctamente',
            data: categoria
        });
    } catch (error) {
        console.error('Error actualizando categoría de extras:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar categoría de extras',
            error: error.message
        });
    }
};

export const eliminarExtraCategoria = async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Solo administradores pueden eliminar categorías'
            });
        }

        const { id } = req.params;
        const result = await ExtraCategoria.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        return res.json({
            success: true,
            message: 'Categoría eliminada correctamente',
            data: result
        });
    } catch (error) {
        console.error('Error eliminando categoría de extras:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar categoría de extras',
            error: error.message
        });
    }
};
