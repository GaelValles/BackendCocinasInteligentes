import multer from 'multer';
import { uploadFile, deleteFile, validateFileType, validateFileSize } from '../libs/digitalocean.js';
import Tarea from '../models/tareas.model.js';
import Proyecto from '../models/proyecto.model.js';

// Configurar multer para manejar uploads en memoria
const storage = multer.memoryStorage();

// Filtro de archivos permitidos
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/pdf',
        'image/webp'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, WEBP) y PDFs'), false);
    }
};

// Configurar multer
export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB límite
    },
    fileFilter: fileFilter
});

/**
 * Subir archivo a DigitalOcean Spaces
 * POST /api/archivos/upload
 * Content-Type: multipart/form-data
 * Body: file, tipo, relacionadoA, relacionadoId
 */
export const subirArchivo = async (req, res) => {
    try {
        // Verificar que se haya subido un archivo
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó ningún archivo'
            });
        }

        const { tipo, relacionadoA, relacionadoId } = req.body;

        // Validar campos requeridos
        if (!tipo || !relacionadoA || !relacionadoId) {
            return res.status(400).json({
                success: false,
                message: 'Campos requeridos: tipo, relacionadoA, relacionadoId'
            });
        }

        // Validar tipo de archivo
        if (!validateFileType(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de archivo no permitido'
            });
        }

        // Validar tamaño del archivo
        if (!validateFileSize(req.file.size)) {
            return res.status(400).json({
                success: false,
                message: 'El archivo excede el tamaño máximo permitido de 10MB'
            });
        }

        // Determinar la carpeta según el tipo
        let folder = 'general';
        if (relacionadoA === 'tarea') {
            folder = 'tareas';
        } else if (relacionadoA === 'proyecto') {
            folder = 'proyectos';
        } else if (relacionadoA === 'cotizacion') {
            folder = 'cotizaciones';
        }

        // Subir archivo a DigitalOcean Spaces
        const resultado = await uploadFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            folder
        );

        // Preparar respuesta
        const archivoInfo = {
            id: Date.now().toString(),
            nombre: req.file.originalname,
            tipo: tipo,
            url: resultado.url,
            key: resultado.key,
            tamano: req.file.size,
            mimeType: req.file.mimetype,
            relacionadoA: relacionadoA,
            relacionadoId: relacionadoId,
            createdAt: new Date()
        };

        res.status(200).json({
            success: true,
            message: 'Archivo subido exitosamente',
            data: archivoInfo
        });

    } catch (error) {
        console.error('Error al subir archivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al subir archivo',
            error: error.message
        });
    }
};

/**
 * Subir múltiples archivos
 * POST /api/archivos/upload-multiple
 * Content-Type: multipart/form-data
 * Body: files[], tipo, relacionadoA, relacionadoId
 */
export const subirMultiplesArchivos = async (req, res) => {
    try {
        // Verificar que se hayan subido archivos
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron archivos'
            });
        }

        const { tipo, relacionadoA, relacionadoId } = req.body;

        // Validar campos requeridos
        if (!tipo || !relacionadoA || !relacionadoId) {
            return res.status(400).json({
                success: false,
                message: 'Campos requeridos: tipo, relacionadoA, relacionadoId'
            });
        }

        // Determinar la carpeta según el tipo
        let folder = 'general';
        if (relacionadoA === 'tarea') {
            folder = 'tareas';
        } else if (relacionadoA === 'proyecto') {
            folder = 'proyectos';
        } else if (relacionadoA === 'cotizacion') {
            folder = 'cotizaciones';
        }

        // Subir todos los archivos
        const archivosSubidos = [];
        const errores = [];

        for (const file of req.files) {
            try {
                // Validar cada archivo
                if (!validateFileType(file.mimetype)) {
                    errores.push({
                        nombre: file.originalname,
                        error: 'Tipo de archivo no permitido'
                    });
                    continue;
                }

                if (!validateFileSize(file.size)) {
                    errores.push({
                        nombre: file.originalname,
                        error: 'Archivo excede 10MB'
                    });
                    continue;
                }

                // Subir archivo
                const resultado = await uploadFile(
                    file.buffer,
                    file.originalname,
                    file.mimetype,
                    folder
                );

                archivosSubidos.push({
                    id: Date.now().toString() + Math.random(),
                    nombre: file.originalname,
                    tipo: tipo,
                    url: resultado.url,
                    key: resultado.key,
                    tamano: file.size,
                    mimeType: file.mimetype,
                    createdAt: new Date()
                });

            } catch (error) {
                errores.push({
                    nombre: file.originalname,
                    error: error.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `${archivosSubidos.length} archivos subidos exitosamente`,
            data: {
                archivosSubidos,
                errores: errores.length > 0 ? errores : undefined
            }
        });

    } catch (error) {
        console.error('Error al subir archivos múltiples:', error);
        res.status(500).json({
            success: false,
            message: 'Error al subir archivos',
            error: error.message
        });
    }
};

/**
 * Eliminar archivo de DigitalOcean Spaces
 * DELETE /api/archivos/:key
 * Body: key (el key del archivo en Spaces)
 */
export const eliminarArchivo = async (req, res) => {
    try {
        const { key } = req.body;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere la key del archivo'
            });
        }

        // Eliminar archivo de DigitalOcean Spaces
        await deleteFile(key);

        res.json({
            success: true,
            message: 'Archivo eliminado exitosamente',
            data: null
        });

    } catch (error) {
        console.error('Error al eliminar archivo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar archivo',
            error: error.message
        });
    }
};

/**
 * Obtener archivos asociados a una tarea
 * GET /api/archivos/tarea/:id
 */
export const obtenerArchivosTarea = async (req, res) => {
    try {
        const { id } = req.params;

        const tarea = await Tarea.findById(id);
        if (!tarea) {
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Archivos obtenidos exitosamente',
            data: tarea.archivos
        });

    } catch (error) {
        console.error('Error al obtener archivos de tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener archivos',
            error: error.message
        });
    }
};

/**
 * Obtener archivos públicos de un proyecto
 * GET /api/archivos/proyecto/:id
 */
export const obtenerArchivosProyecto = async (req, res) => {
    try {
        const { id } = req.params;

        const proyecto = await Proyecto.findById(id);
        if (!proyecto) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        // Verificar permisos: Clientes solo ven sus propios proyectos
        const userRole = req.admin.rol;
        const userId = req.admin._id.toString();

        if (userRole === 'cliente' && proyecto.cliente.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para ver estos archivos'
            });
        }

        res.json({
            success: true,
            message: 'Archivos públicos obtenidos exitosamente',
            data: proyecto.archivosPublicos
        });

    } catch (error) {
        console.error('Error al obtener archivos de proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener archivos',
            error: error.message
        });
    }
};
