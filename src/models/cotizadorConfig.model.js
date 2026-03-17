import { connectDBClientes } from '../db.js';
import mongoose from 'mongoose';

// Configuración del cotizador: tipos de proyecto, escenarios, colores
// Los precios de materiales/herrajes se obtienen de Materiales
const cotizadorConfigSchema = new mongoose.Schema({
    projectTypes: {
        type: [String],
        default: ['Cocina', 'Closet', 'vestidor', 'Mueble para el baño']
    },
    scenarioCards: [{
        id: { type: String, required: true },
        title: { type: String, required: true },
        subtitle: { type: String, default: '' },
        multiplier: { type: Number, required: true, min: 0 },
        image: { type: String, default: '' },
        tags: { type: [String], default: [] }
    }],
    materialColors: {
        type: [String],
        default: ['Blanco Nieve', 'Nogal Calido', 'Gris Grafito', 'Fresno Arena']
    }
}, {
    timestamps: true,
    collection: 'cotizadorconfig'
});

// Un solo documento de configuración
cotizadorConfigSchema.statics.getConfig = async function () {
    let config = await this.findOne();
    if (!config) {
        config = await this.create({
            scenarioCards: [
                { id: 'esencial', title: 'GAMA ESENCIAL', subtitle: 'Cocina minimalista limpia', multiplier: 0.92, image: '/images/cocina1.jpg', tags: ['Melamina', 'Granito', 'Herrajes Std'] },
                { id: 'tendencia', title: 'GAMA TENDENCIA', subtitle: 'Texturas y brillo', multiplier: 1.05, image: '/images/cocina6.jpg', tags: ['Melamina', 'Granito', 'Herrajes Std'] },
                { id: 'premium', title: 'GAMA PREMIUM', subtitle: 'Lujo con luces y madera', multiplier: 1.18, image: '/images/render3.jpg', tags: ['Melamina', 'Granito', 'Herrajes Std'] }
            ]
        });
    }
    return config;
};

const CotizadorConfigModel = connectDBClientes.models && connectDBClientes.models.CotizadorConfig
    ? connectDBClientes.model('CotizadorConfig')
    : connectDBClientes.model('CotizadorConfig', cotizadorConfigSchema);

export default CotizadorConfigModel;
