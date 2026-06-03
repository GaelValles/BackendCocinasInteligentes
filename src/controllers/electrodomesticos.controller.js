import Electrodomestico from '../models/electrodomestico.model.js';
import ElectrodomesticoCategoria from '../models/electrodomesticoCategoria.model.js';
import { uploadFileToCloudinary } from '../libs/cloudinary.js';

const normalizeText = (text) => {
    return String(text || '').trim().toLowerCase();
};

const escapeRegex = (text) => {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const buildCategoryLookup = async () => {
    const categorias = await ElectrodomesticoCategoria.find({ disponible: true })
        .select('_id nombre')
        .lean();

    const byId = new Map();
    const byName = new Map();

    for (const categoria of categorias) {
        const nombreNormalizado = normalizeText(categoria.nombre);
        byId.set(String(categoria._id), categoria);
        byName.set(nombreNormalizado, categoria);
    }

    return { byId, byName };
};

const resolveCategoriaFilter = async (categoriaId) => {
    const normalizedValue = normalizeText(categoriaId);
    if (!normalizedValue) return null;

    const lookup = await buildCategoryLookup();
    const byIdMatch = lookup.byId.get(String(categoriaId));
    if (byIdMatch) {
        return {
            categoriaId: String(byIdMatch._id),
            categoriaNombre: byIdMatch.nombre
        };
    }

    const byNameMatch = lookup.byName.get(normalizedValue);
    if (byNameMatch) {
        return {
            categoriaId: String(byNameMatch._id),
            categoriaNombre: byNameMatch.nombre
        };
    }

    return {
        categoriaId: normalizedValue,
        categoriaNombre: categoriaId
    };
};

const isAdmin = (req) => req.admin?.rol === 'admin';
const isEmpleado = (req) => req.admin?.rol === 'empleado';
const isAuthorized = (req) => isAdmin(req) || isEmpleado(req);

export const listarElectrodomesticos = async (req, res) => {
    try {
        const { q, categoria, categoriaId, disponible } = req.query;
        const filter = {};
        const andConditions = [];

        if (disponible !== undefined) {
            filter.disponible = disponible === 'true';
        } else {
            filter.disponible = true;
        }

        if (categoriaId) {
            const resolved = await resolveCategoriaFilter(categoriaId);
            if (resolved) {
                andConditions.push({
                    $or: [
                    { categoriaId: resolved.categoriaId },
                    {
                        categoria: {
                            $regex: `^${escapeRegex(normalizeText(resolved.categoriaNombre))}$`,
                            $options: 'i'
                        }
                    }
                    ]
                });
            }
        }

        if (categoria) {
            const normalizedCategoria = normalizeText(categoria);
            andConditions.push({
                categoria: {
                    $regex: `^${escapeRegex(normalizedCategoria)}$`,
                    $options: 'i'
                }
            });
        }

        if (q) {
            const normalizedQ = normalizeText(q);
            andConditions.push({
                $or: [
                { nombre: { $regex: escapeRegex(normalizedQ), $options: 'i' } },
                { descripcion: { $regex: escapeRegex(normalizedQ), $options: 'i' } }
                ]
            });
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        const electrodomesticos = await Electrodomestico.find(filter)
            .lean()
            .sort({ createdAt: -1 });

        const categorias = await ElectrodomesticoCategoria.find({ disponible: true })
            .select('_id nombre')
            .lean();

        const categoriaByName = new Map(categorias.map((categoriaItem) => [normalizeText(categoriaItem.nombre), categoriaItem]));

        return res.json({
            success: true,
            data: electrodomesticos.map((item) => ({
                ...item,
                categoriaId: item.categoriaId || categoriaByName.get(normalizeText(item.categoria))?._id || null
            }))
        });
    } catch (error) {
        console.error('Error listando electrodomésticos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar electrodomésticos',
            error: error.message
        });
    }
};

export const crearElectrodomestico = async (req, res) => {
    try {
        if (!isAuthorized(req)) {
            return res.status(403).json({
                success: false,
                message: 'No autorizado para crear electrodomésticos'
            });
        }

        const { nombre, categoria, categoriaId, subtipo, precio, descripcion, imagenUrl, thumbnailUrl } = req.body;

        if (!nombre || (!categoria && !categoriaId)) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: [
                    { field: 'nombre', message: 'Nombre requerido' },
                    { field: 'categoria', message: 'Categoría requerida' }
                ]
            });
        }

        const categoriaLookup = categoriaId ? await ElectrodomesticoCategoria.findById(categoriaId).lean() : null;
        const categoriaNombre = categoriaLookup?.nombre || categoria;

        const nuevoElectrodomestico = new Electrodomestico({
            nombre: nombre.trim(),
            categoria: String(categoriaNombre || '').trim(),
            categoriaId: categoriaLookup?._id ? String(categoriaLookup._id) : (categoriaId || null),
            subtipo: subtipo ? subtipo.trim() : null,
            precio: precio || 0,
            descripcion: descripcion || '',
            imagenUrl: imagenUrl || null,
            thumbnailUrl: thumbnailUrl || null,
            createdBy: req.admin?._id
        });

        await nuevoElectrodomestico.save();

        return res.status(201).json({
            success: true,
            message: 'Electrodoméstico creado correctamente',
            data: nuevoElectrodomestico
        });
    } catch (error) {
        console.error('Error creando electrodoméstico:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear electrodoméstico',
            error: error.message
        });
    }
};

export const actualizarElectrodomestico = async (req, res) => {
    try {
        if (!isAuthorized(req)) {
            return res.status(403).json({
                success: false,
                message: 'No autorizado para actualizar electrodomésticos'
            });
        }

        const { id } = req.params;
        const { nombre, categoria, categoriaId, subtipo, precio, descripcion, imagenUrl, thumbnailUrl, disponible } = req.body;

        const electrodomestico = await Electrodomestico.findById(id);
        if (!electrodomestico) {
            return res.status(404).json({
                success: false,
                message: 'Electrodoméstico no encontrado'
            });
        }

        if (nombre !== undefined) electrodomestico.nombre = nombre.trim();
        if (categoriaId !== undefined) {
            if (categoriaId) {
                const categoriaLookup = await ElectrodomesticoCategoria.findById(categoriaId).lean();
                electrodomestico.categoriaId = categoriaLookup?._id ? String(categoriaLookup._id) : String(categoriaId);
                if (categoriaLookup?.nombre) {
                    electrodomestico.categoria = categoriaLookup.nombre.trim();
                }
            } else {
                electrodomestico.categoriaId = null;
            }
        }
        if (categoria !== undefined) electrodomestico.categoria = categoria.trim();
        if (subtipo !== undefined) electrodomestico.subtipo = subtipo ? subtipo.trim() : null;
        if (precio !== undefined) electrodomestico.precio = precio;
        if (descripcion !== undefined) electrodomestico.descripcion = descripcion;
        if (imagenUrl !== undefined) electrodomestico.imagenUrl = imagenUrl;
        if (thumbnailUrl !== undefined) electrodomestico.thumbnailUrl = thumbnailUrl;
        if (disponible !== undefined) electrodomestico.disponible = disponible;
        electrodomestico.updatedBy = req.admin?._id;

        await electrodomestico.save();

        return res.json({
            success: true,
            message: 'Electrodoméstico actualizado correctamente',
            data: electrodomestico
        });
    } catch (error) {
        console.error('Error actualizando electrodoméstico:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar electrodoméstico',
            error: error.message
        });
    }
};

export const eliminarElectrodomestico = async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Solo administradores pueden eliminar electrodomésticos'
            });
        }

        const { id } = req.params;
        const result = await Electrodomestico.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Electrodoméstico no encontrado'
            });
        }

        return res.json({
            success: true,
            message: 'Electrodoméstico eliminado correctamente',
            data: result
        });
    } catch (error) {
        console.error('Error eliminando electrodoméstico:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar electrodoméstico',
            error: error.message
        });
    }
};

export const uploadImagenCloudinary = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó archivo'
            });
        }

        const uploadResult = await uploadFileToCloudinary(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            'kuche/equipamiento'
        );

        return res.json({
            success: true,
            message: 'Imagen subida correctamente',
            data: {
                secureUrl: uploadResult.secure_url,
                thumbnailUrl: uploadResult.thumbnail_url || uploadResult.secure_url,
                publicId: uploadResult.public_id,
                width: uploadResult.width,
                height: uploadResult.height,
                format: uploadResult.format
            }
        });
    } catch (error) {
        console.error('Error subiendo imagen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al subir imagen',
            error: error.message
        });
    }
};
