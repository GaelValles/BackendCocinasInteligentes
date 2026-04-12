import Extra from '../models/extra.model.js';
import { uploadFileToCloudinary } from '../libs/cloudinary.js';

const normalizeText = (text) => {
    return String(text || '').trim().toLowerCase();
};

const escapeRegex = (text) => {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const isAdmin = (req) => req.admin?.rol === 'admin';
const isEmpleado = (req) => req.admin?.rol === 'empleado';
const isAuthorized = (req) => isAdmin(req) || isEmpleado(req);

export const listarExtras = async (req, res) => {
    try {
        const { q, categoria, categoriaId, disponible } = req.query;
        const filter = { disponible: true };

        if (disponible !== undefined) {
            filter.disponible = disponible === 'true';
        }

        if (categoria) {
            const normalizedCategoria = normalizeText(categoria);
            filter.categoria = {
                $regex: escapeRegex(normalizedCategoria),
                $options: 'i'
            };
        }

        if (categoriaId) {
            filter.categoriaId = categoriaId;
        }

        if (q) {
            const normalizedQ = normalizeText(q);
            filter.$or = [
                { nombre: { $regex: escapeRegex(normalizedQ), $options: 'i' } },
                { descripcion: { $regex: escapeRegex(normalizedQ), $options: 'i' } }
            ];
        }

        const extras = await Extra.find(filter)
            .lean()
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            data: extras
        });
    } catch (error) {
        console.error('Error listando extras:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar extras',
            error: error.message
        });
    }
};

export const crearExtra = async (req, res) => {
    try {
        if (!isAuthorized(req)) {
            return res.status(403).json({
                success: false,
                message: 'No autorizado para crear extras'
            });
        }

        const { nombre, categoriaId, categoria, subtipo, precio, descripcion, imagenUrl, thumbnailUrl } = req.body;

        if (!nombre || !categoria) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: [
                    { field: 'nombre', message: 'Nombre requerido' },
                    { field: 'categoria', message: 'Categoría requerida' }
                ]
            });
        }

        const nuevoExtra = new Extra({
            nombre: nombre.trim(),
            categoriaId: categoriaId || null,
            categoria: categoria.trim(),
            subtipo: subtipo ? subtipo.trim() : null,
            precio: precio || 0,
            descripcion: descripcion || '',
            imagenUrl: imagenUrl || null,
            thumbnailUrl: thumbnailUrl || null
        });

        await nuevoExtra.save();

        return res.status(201).json({
            success: true,
            message: 'Extra creado correctamente',
            data: nuevoExtra
        });
    } catch (error) {
        console.error('Error creando extra:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear extra',
            error: error.message
        });
    }
};

export const actualizarExtra = async (req, res) => {
    try {
        if (!isAuthorized(req)) {
            return res.status(403).json({
                success: false,
                message: 'No autorizado para actualizar extras'
            });
        }

        const { id } = req.params;
        const { nombre, categoriaId, categoria, subtipo, precio, descripcion, imagenUrl, thumbnailUrl, disponible } = req.body;

        const extra = await Extra.findById(id);
        if (!extra) {
            return res.status(404).json({
                success: false,
                message: 'Extra no encontrado'
            });
        }

        if (nombre !== undefined) extra.nombre = nombre.trim();
        if (categoriaId !== undefined) extra.categoriaId = categoriaId;
        if (categoria !== undefined) extra.categoria = categoria.trim();
        if (subtipo !== undefined) extra.subtipo = subtipo ? subtipo.trim() : null;
        if (precio !== undefined) extra.precio = precio;
        if (descripcion !== undefined) extra.descripcion = descripcion;
        if (imagenUrl !== undefined) extra.imagenUrl = imagenUrl;
        if (thumbnailUrl !== undefined) extra.thumbnailUrl = thumbnailUrl;
        if (disponible !== undefined) extra.disponible = disponible;

        await extra.save();

        return res.json({
            success: true,
            message: 'Extra actualizado correctamente',
            data: extra
        });
    } catch (error) {
        console.error('Error actualizando extra:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar extra',
            error: error.message
        });
    }
};

export const eliminarExtra = async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: 'Solo administradores pueden eliminar extras'
            });
        }

        const { id } = req.params;
        const result = await Extra.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Extra no encontrado'
            });
        }

        return res.json({
            success: true,
            message: 'Extra eliminado correctamente',
            data: result
        });
    } catch (error) {
        console.error('Error eliminando extra:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar extra',
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
            'kuche/extras'
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
