import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

const tareaSchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  etapa: { type: String, enum: ['citas','disenos','cotizacion','contrato'], required: true, default: 'citas' },
  estado: { type: String, enum: ['pendiente','completada'], required: true, default: 'pendiente' },
  asignadoA: { type: String, default: null },
  asignadoANombre: { type: String, default: '' },
  proyectoId: { type: String, default: null },
  nombreProyecto: { type: String, default: '' },
  notas: { type: String, default: '' },
  archivos: [{
    id: String,
    nombre: String,
    tipo: { type: String, enum: ['pdf','render','otro'], default: 'otro' },
    url: { type: String, default: '' }
  }]
}, { timestamps: true });

// índices útiles
tareaSchema.index({ etapa: 1, estado: 1, asignadoA: 1 });

const TareaModel = connectDBClientes.models && connectDBClientes.models.Tarea
  ? connectDBClientes.model('Tarea')
  : connectDBClientes.model('Tarea', tareaSchema);

export default TareaModel;
