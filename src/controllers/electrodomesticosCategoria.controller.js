import ElectrodomesticoCategoria from '../models/electrodomesticoCategoria.model.js';
import Electrodomestico from '../models/electrodomestico.model.js';

const normalizeText = (text) => String(text || '').trim().toLowerCase();

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