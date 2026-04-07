import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const clienteArchivoSchema = new mongoose.Schema(
  {
    // Cliente propietario del archivo
    clienteId: {
      type: String,
      required: true,
      index: true
    },
    // Tarea que generó el archivo (opcional, puede ser null)
    tareasId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tarea',
      default: null
    },
    // Tipo de archivo (levantamiento_detallado, cotizacion_formal, etc.)
    tipo: {
      type: String,
      enum: [
        'levantamiento_detallado',
        'cotizacion_formal',
        'hoja_taller',
        'diseno',
        'recibo_1',
        'recibo_2',
        'recibo_3',
        'contrato',
        'fotos_proyecto',
        'otro'
      ],
      required: true,
      index: true
    },
    // Nivel del diseno dentro del flujo (preliminar/final)
    nivel: {
      type: String,
      enum: ['preliminar', 'final', null],
      default: null,
      index: true
    },
    // Nombre del archivo
    nombre: {
      type: String,
      required: true
    },
    // URL pública del archivo en el provider
    url: {
      type: String,
      required: true
    },
    // Key para identificar y eliminar del provider
    key: {
      type: String,
      required: true,
      unique: true,
      sparse: true
    },
    // Provider donde se almacena (cloudinary, dropbox, local)
    provider: {
      type: String,
      enum: ['cloudinary', 'dropbox', 'local'],
      default: 'cloudinary'
    },
    // MIME type del archivo
    mimeType: {
      type: String,
      default: 'application/pdf'
    }
  },
  {
    timestamps: true,
    collection: 'clientesArchivos'
  }
);

// Índices para queries frecuentes
clienteArchivoSchema.index({ clienteId: 1, tipo: 1 });
clienteArchivoSchema.index({ tareasId: 1 });
clienteArchivoSchema.index({ tareasId: 1, tipo: 1, nivel: 1, createdAt: -1 });
clienteArchivoSchema.index({ createdAt: -1 });

const ClienteArchivo = connectDBClientes.model('ClienteArchivo', clienteArchivoSchema);

export default ClienteArchivo;
