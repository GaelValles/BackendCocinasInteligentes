import ElectrodomesticoCategoria from '../models/electrodomesticoCategoria.model.js';
import Electrodomestico from '../models/electrodomestico.model.js';

const normalizeText = (text) => String(text || '').trim().toLowerCase();
const isAdmin = (req) => req.admin?.rol === 'admin';
const isEmpleado = (req) => req.admin?.rol === 'empleado';
const isAuthorized = (req) => isAdmin(req) || isEmpleado(req);

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mapCategoria = (categoria, fallbackNombre = '') => ({
    _id: String(categoria?._id || normalizeText(fallbackNombre)),
    nombre: categoria?.nombre || fallbackNombre,
    descripcion: categoria?.descripcion || '',
    orden: categoria?.orden ?? 0,
    disponible: categoria?.disponible !== false
});

export const listarElectrodomesticosCategorias = async (req, res) => {
    try {
        const categoriasConfiguradas = await ElectrodomesticoCategoria.find({ disponible: true })
            .lean()
            .sort({ orden: 1, createdAt: -1 });

        const categoriasDesdeElectrodomesticos = await Electrodomestico.aggregate([
            {
                $match: {
                    categoria: {
                        $type: 'string',
                        $ne: ''
                    }
                }
            },
            {
                $group: {
                    _id: '$categoria'
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        const categoriasMap = new Map();

        for (const categoria of categoriasConfiguradas) {
            categoriasMap.set(normalizeText(categoria.nombre), mapCategoria(categoria));
        }

        for (const categoria of categoriasDesdeElectrodomesticos) {
            const nombre = String(categoria?._id || '').trim();
            const key = normalizeText(nombre);
            if (!key || categoriasMap.has(key)) continue;

            categoriasMap.set(key, mapCategoria(null, nombre));
        }

        const data = Array.from(categoriasMap.values()).sort((a, b) => {
            const ordenA = Number(a.orden || 0);
            const ordenB = Number(b.orden || 0);
            if (ordenA !== ordenB) return ordenA - ordenB;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error listando categorías de electrodomésticos:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al listar categorías de electrodomésticos',
            error: error.message
        });
    }
};

export const crearElectrodomesticoCategoria = async (req, res) => {
    try {
        if (!isAuthorized(req)) {
            return res.status(403).json({
                success: false,
                message: 'No autorizado para crear categorías de electrodomésticos'
            });
        }

        const { nombre, descripcion, orden } = req.body || {};
        const nombreNormalizado = String(nombre || '').trim();

        if (!nombreNormalizado) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: [{ field: 'nombre', message: 'Nombre requerido' }]
            });
        }

        const existente = await ElectrodomesticoCategoria.findOne({
            nombre: { $regex: `^${escapeRegex(nombreNormalizado)}$`, $options: 'i' }
        });
        if (existente) {
            return res.status(409).json({ success: false, message: 'La categoría ya existe' });
        }

        const nuevaCategoria = await ElectrodomesticoCategoria.create({
            nombre: nombreNormalizado,
            descripcion: String(descripcion || '').trim(),
            orden: Number.isFinite(Number(orden)) ? Number(orden) : 0
        });

        return res.status(201).json({
            success: true,
            message: 'Categoría de electrodomésticos creada correctamente',
            data: nuevaCategoria
        });
    } catch (error) {
        console.error('Error creando categoría de electrodomésticos:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al crear categoría de electrodomésticos',
            error: error.message
        });
    }
};

export const actualizarElectrodomesticoCategoria = async (req, res) => {
    try {
        if (!isAuthorized(req)) {
            return res.status(403).json({
                success: false,
                message: 'No autorizado para actualizar categorías de electrodomésticos'
            });
        }

        const { nombre, descripcion, orden, disponible } = req.body || {};
        const categoria = await ElectrodomesticoCategoria.findById(req.params.id);
        if (!categoria) {
            return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
        }

        if (nombre !== undefined) categoria.nombre = String(nombre).trim();
        if (descripcion !== undefined) categoria.descripcion = String(descripcion || '').trim();
        if (orden !== undefined) categoria.orden = Number(orden);
        if (disponible !== undefined) categoria.disponible = Boolean(disponible);

        await categoria.save();

        return res.json({
            success: true,
            message: 'Categoría de electrodomésticos actualizada correctamente',
            data: categoria
        });
    } catch (error) {
        console.error('Error actualizando categoría de electrodomésticos:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al actualizar categoría de electrodomésticos',
            error: error.message
        });
    }
};

export const eliminarElectrodomesticoCategoria = async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Solo administradores pueden eliminar categorías'
            });
        }

        const categoria = await ElectrodomesticoCategoria.findByIdAndDelete(req.params.id);
        if (!categoria) {
            return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
        }

        return res.json({
            success: true,
            message: 'Categoría de electrodomésticos eliminada correctamente',
            data: categoria
        });
    } catch (error) {
        console.error('Error eliminando categoría de electrodomésticos:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al eliminar categoría de electrodomésticos',
            error: error.message
        });
    }
};