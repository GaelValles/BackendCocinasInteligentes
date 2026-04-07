import multer from 'multer';
import mongoose from 'mongoose';
import { uploadFileToDropbox, deleteFileFromDropbox } from '../libs/dropbox.js';
import { uploadFileToCloudinary, deleteFileFromCloudinary } from '../libs/cloudinary.js';
import ClienteArchivo from '../models/clienteArchivo.model.js';
import ClienteIdentidad from '../models/clienteIdentidad.model.js';
import path from 'path';

const DEBUG = String(process.env.DEBUG_ARCHIVOS || 'false').toLowerCase() === 'true';

// TIPOS CANÓNICOS
const CANONICAL_TYPES = {
  'levantamiento_detallado': ['levantamiento_detallado', 'levantamiento', 'preliminar'],
  'cotizacion_formal': ['cotizacion_formal', 'cotizacion', 'presupuesto'],
  'hoja_taller': ['hoja_taller', 'taller', 'hoja'],
  'diseno': ['diseno', 'diseño', 'render', 'modelo_3d', 'sketchup'],
  'recibo_1': ['recibo_1', 'recibo1'],
  'recibo_2': ['recibo_2', 'recibo2'],
  'recibo_3': ['recibo_3', 'recibo3'],
  'contrato': ['contrato'],
  'fotos_proyecto': ['fotos_proyecto', 'fotos', 'proyecto_photos']
};

const PROVIDER_BY_TYPE = {
  'diseno': 'dropbox',
  'levantamiento_detallado': 'cloudinary',
  'cotizacion_formal': 'cloudinary',
  'hoja_taller': 'cloudinary',
  'recibo_1': 'cloudinary',
  'recibo_2': 'cloudinary',
  'recibo_3': 'cloudinary',
  'contrato': 'cloudinary',
  'fotos_proyecto': 'cloudinary'
};

// MULTER
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'image/webp', 'application/octet-stream', 'application/x-sketchup'
  ];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.webp', '.skp'];
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'), false);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
});

// ============================================
// FUNCIONES UTILITARIAS
// ============================================

const normalizeType = (tipo = '') => {
  const normalized = String(tipo || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [canonical, aliases] of Object.entries(CANONICAL_TYPES)) {
    if (aliases.some(alias => normalized.includes(alias.replace(/[\s-]+/g, '_').replace(/[\s-]+/g, '')))) {
      return canonical;
    }
  }
  return 'otro';
};

const getProviderForType = (tipo) => {
  return PROVIDER_BY_TYPE[tipo] || 'cloudinary';
};

const ALLOWED_NIVELES = new Set(['preliminar', 'final']);

const normalizeNivel = (nivelRaw = '', tipo = '') => {
  if (nivelRaw === null || nivelRaw === undefined || String(nivelRaw).trim() === '') {
    return null;
  }

  const nivel = String(nivelRaw).trim().toLowerCase();
  if (!ALLOWED_NIVELES.has(nivel)) {
    return '__invalid__';
  }

  // Solo aplica nivel para diseno; para otros tipos se ignora silenciosamente.
  return tipo === 'diseno' ? nivel : null;
};

const findClienteByCodeOrId = async (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  try {
    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      return await ClienteIdentidad.findById(trimmed);
    }
    return await ClienteIdentidad.findOne({ codigo: trimmed.toUpperCase() });
  } catch {
    return null;
  }
};

// ============================================
// POST: UPLOAD
// ============================================

/**
 * POST /api/archivos/upload
 * Subir archivo único
 */
export const subirArchivo = async (req, res) => {
  try {
    const file = req.file || (Array.isArray(req.files) ? req.files[0] : null);
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const { tipo, clienteId, tareasId, nivel, relacionadoA, relacionadoId } = req.body;
    const tipoNormalizado = normalizeType(tipo);
    const nivelNormalizado = normalizeNivel(nivel, tipoNormalizado);

    const tareasIdNormalizado = (() => {
      if (tareasId) return String(tareasId);
      if (String(relacionadoA || '').toLowerCase() === 'tarea' && relacionadoId) {
        return String(relacionadoId);
      }
      return null;
    })();

    if (nivelNormalizado === '__invalid__') {
      return res.status(400).json({
        success: false,
        message: 'nivel inválido. Valores permitidos: preliminar, final'
      });
    }

    if (!clienteId) {
      return res.status(400).json({ success: false, message: 'clienteId es obligatorio' });
    }

    // Validar cliente existe
    const cliente = await findClienteByCodeOrId(clienteId);
    if (!cliente) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    // Validar tarea si viene
    if (tareasIdNormalizado && !mongoose.Types.ObjectId.isValid(tareasIdNormalizado)) {
      return res.status(400).json({ success: false, message: 'tareasId inválido' });
    }

    // Subir a provider
    const provider = getProviderForType(tipoNormalizado);
    let uploadResult;

    try {
      if (provider === 'dropbox') {
        uploadResult = await uploadFileToDropbox(file.buffer, file.originalname, 'archivos-cliente');
      } else {
        uploadResult = await uploadFileToCloudinary(file.buffer, file.originalname, file.mimetype, 'archivos-cliente');
      }
    } catch (uploadError) {
      console.error(`Upload to ${provider} failed:`, uploadError);
      throw uploadError;
    }

    // Crear documento en ClienteArchivo
    const clienteArchivo = await ClienteArchivo.create({
      clienteId: cliente.codigo,
      tareasId: tareasIdNormalizado || null,
      tipo: tipoNormalizado,
      nivel: nivelNormalizado,
      nombre: file.originalname,
      url: uploadResult.url,
      key: uploadResult.key,
      provider: uploadResult.provider || 'cloudinary',
      mimeType: file.mimetype
    });

    if (DEBUG) {
      console.log('[UPLOAD] Archivo creado:', {
        _id: clienteArchivo._id,
        clienteId: cliente.codigo,
        tipo: tipoNormalizado
      });
    }

    res.status(201).json({
      success: true,
      message: 'Archivo subido exitosamente',
      data: {
        _id: clienteArchivo._id,
        nombre: clienteArchivo.nombre,
        tipo: clienteArchivo.tipo,
        nivel: clienteArchivo.nivel,
        url: clienteArchivo.url,
        key: clienteArchivo.key,
        provider: clienteArchivo.provider,
        clienteId: clienteArchivo.clienteId,
        tareasId: clienteArchivo.tareasId,
        relacionadoA: relacionadoA || (clienteArchivo.tareasId ? 'tarea' : 'cliente'),
        relacionadoId: relacionadoId || (clienteArchivo.tareasId ? String(clienteArchivo.tareasId) : clienteArchivo.clienteId),
        createdAt: clienteArchivo.createdAt,
        updatedAt: clienteArchivo.updatedAt
      }
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir archivo',
      error: error.message
    });
  }
};

/**
 * POST /api/archivos/upload-multiple
 * Subir múltiples archivos
 */
export const subirMultiples = async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'No files provided' });
    }

    const { tipo, clienteId, tareasId, nivel, relacionadoA, relacionadoId } = req.body;
    const tipoNormalizado = normalizeType(tipo);
    const nivelNormalizado = normalizeNivel(nivel, tipoNormalizado);

    const tareasIdNormalizado = (() => {
      if (tareasId) return String(tareasId);
      if (String(relacionadoA || '').toLowerCase() === 'tarea' && relacionadoId) {
        return String(relacionadoId);
      }
      return null;
    })();
    if (tareasIdNormalizado && !mongoose.Types.ObjectId.isValid(tareasIdNormalizado)) {
      return res.status(400).json({ success: false, message: 'tareasId inválido' });
    }


    if (nivelNormalizado === '__invalid__') {
      return res.status(400).json({
        success: false,
        message: 'nivel inválido. Valores permitidos: preliminar, final'
      });
    }

    if (!clienteId) {
      return res.status(400).json({ success: false, message: 'clienteId es obligatorio' });
    }

    const cliente = await findClienteByCodeOrId(clienteId);
    if (!cliente) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    const archivosSubidos = [];
    const errores = [];
    const provider = getProviderForType(tipoNormalizado);

    for (const file of files) {
      try {
        let uploadResult;

        if (provider === 'dropbox') {
          uploadResult = await uploadFileToDropbox(file.buffer, file.originalname, 'archivos-cliente');
        } else {
          uploadResult = await uploadFileToCloudinary(file.buffer, file.originalname, file.mimetype, 'archivos-cliente');
        }

        const clienteArchivo = await ClienteArchivo.create({
          clienteId: cliente.codigo,
          tareasId: tareasIdNormalizado || null,
          tipo: tipoNormalizado,
          nivel: nivelNormalizado,
          nombre: file.originalname,
          url: uploadResult.url,
          key: uploadResult.key,
          provider: uploadResult.provider || 'cloudinary',
          mimeType: file.mimetype
        });

        archivosSubidos.push({
          _id: clienteArchivo._id,
          nombre: clienteArchivo.nombre,
          tipo: clienteArchivo.tipo,
          nivel: clienteArchivo.nivel,
          url: clienteArchivo.url,
          key: clienteArchivo.key,
          provider: clienteArchivo.provider,
          clienteId: clienteArchivo.clienteId,
          tareasId: clienteArchivo.tareasId,
          relacionadoA: relacionadoA || (clienteArchivo.tareasId ? 'tarea' : 'cliente'),
          relacionadoId: relacionadoId || (clienteArchivo.tareasId ? String(clienteArchivo.tareasId) : clienteArchivo.clienteId),
          createdAt: clienteArchivo.createdAt,
          updatedAt: clienteArchivo.updatedAt
        });

      } catch (error) {
        errores.push({
          nombre: file.originalname,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `${archivosSubidos.length} de ${files.length} archivos subidos`,
      data: { 
        archivosSubidos, 
        errores: errores.length ? errores : undefined 
      }
    });

  } catch (error) {
    console.error('Error uploading multiple files:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir archivos',
      error: error.message
    });
  }
};

// ============================================
// DELETE: ARCHIVO
// ============================================

/**
 * DELETE /api/archivos/:id
 * Eliminar archivo por ID
 */
export const eliminarArchivo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const archivo = await ClienteArchivo.findById(id);
    if (!archivo) {
      return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
    }

    // Eliminar del provider
    if (archivo.key.startsWith('dropbox:')) {
      await deleteFileFromDropbox(archivo.key);
    } else if (archivo.key.startsWith('cloudinary:')) {
      await deleteFileFromCloudinary(archivo.key);
    }

    // Eliminar documento
    await ClienteArchivo.findByIdAndDelete(id);

    if (DEBUG) {
      console.log('[DELETE] Archivo eliminado:', { _id: id, key: archivo.key });
    }

    res.json({ success: true, message: 'Archivo eliminado' });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar archivo',
      error: error.message
    });
  }
};

// ============================================
// GET: ARCHIVOS DEL CLIENTE
// ============================================

/**
 * GET /api/clientes/:clienteId/archivos
 * Obtener archivos de un cliente
 */
export const obtenerArchivosCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { tipo, nivel } = req.query;

    const cliente = await findClienteByCodeOrId(clienteId);
    if (!cliente) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    let query = { clienteId: cliente.codigo };
    if (tipo) {
      query.tipo = normalizeType(tipo);
    }
    if (nivel) {
      const nivelNormalizado = normalizeNivel(nivel, query.tipo || 'diseno');
      if (nivelNormalizado === '__invalid__') {
        return res.status(400).json({
          success: false,
          message: 'nivel inválido. Valores permitidos: preliminar, final'
        });
      }
      query.nivel = nivelNormalizado;
    }

    const archivos = await ClienteArchivo.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Archivos obtenidos',
      data: archivos
    });

  } catch (error) {
    console.error('Error fetching client files:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener archivos',
      error: error.message
    });
  }
};

/**
 * GET /api/clientes/:clienteId/archivos/:tipo
 * Obtener archivos de un cliente por tipo específico
 */
export const obtenerArchivosPorTipo = async (req, res) => {
  try {
    const { clienteId, tipo } = req.params;
    const { nivel } = req.query;

    const cliente = await findClienteByCodeOrId(clienteId);
    if (!cliente) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    const tipoNormalizado = normalizeType(tipo);
    const query = {
      clienteId: cliente.codigo,
      tipo: tipoNormalizado
    };

    if (nivel) {
      const nivelNormalizado = normalizeNivel(nivel, tipoNormalizado);
      if (nivelNormalizado === '__invalid__') {
        return res.status(400).json({
          success: false,
          message: 'nivel inválido. Valores permitidos: preliminar, final'
        });
      }
      query.nivel = nivelNormalizado;
    }

    const archivos = await ClienteArchivo.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      message: `Archivos de tipo ${tipoNormalizado}`,
      data: archivos
    });

  } catch (error) {
    console.error('Error fetching files by type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener archivos',
      error: error.message
    });
  }
};

/**
 * GET /api/tareas/:tareaId/archivos
 * Obtener archivos asociados a una tarea
 */
export const obtenerArchivosTarea = async (req, res) => {
  try {
    const { tareaId } = req.params;
    const { nivel } = req.query;

    if (!mongoose.Types.ObjectId.isValid(tareaId)) {
      return res.status(400).json({ success: false, message: 'tareaId inválido' });
    }

    const query = { tareasId: tareaId };
    if (nivel) {
      const nivelNormalizado = normalizeNivel(nivel, 'diseno');
      if (nivelNormalizado === '__invalid__') {
        return res.status(400).json({
          success: false,
          message: 'nivel inválido. Valores permitidos: preliminar, final'
        });
      }
      query.nivel = nivelNormalizado;
    }

    const archivos = await ClienteArchivo.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Archivos de tarea obtenidos',
      data: archivos
    });

  } catch (error) {
    console.error('Error fetching task files:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener archivos',
      error: error.message
    });
  }
};

/**
 * GET /api/clientes/panel/:codigo/archivos
 * Obtener archivos del panel del cliente
 */
export const obtenerArchivosPanel = async (req, res) => {
  try {
    const { codigo } = req.params;
    const { nivel } = req.query;

    const cliente = await findClienteByCodeOrId(codigo);
    if (!cliente) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    const query = { clienteId: cliente.codigo };
    if (nivel) {
      const nivelNormalizado = normalizeNivel(nivel, 'diseno');
      if (nivelNormalizado === '__invalid__') {
        return res.status(400).json({
          success: false,
          message: 'nivel inválido. Valores permitidos: preliminar, final'
        });
      }
      query.nivel = nivelNormalizado;
    }

    const archivos = await ClienteArchivo.find(query).sort({ createdAt: -1 });

    // Agrupar por tipo
    const archivosAgrupados = {};
    archivos.forEach(archivo => {
      if (!archivosAgrupados[archivo.tipo]) {
        archivosAgrupados[archivo.tipo] = [];
      }
      archivosAgrupados[archivo.tipo].push(archivo);
    });

    res.json({
      success: true,
      message: 'Archivos del panel obtenidos',
      data: {
        total: archivos.length,
        porTipo: archivosAgrupados,
        archivos
      }
    });

  } catch (error) {
    console.error('Error fetching panel files:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener archivos',
      error: error.message
    });
  }
};
