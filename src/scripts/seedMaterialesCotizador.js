/**
 * Script para crear/actualizar materiales del cotizador en la BD.
 * Ejecutar: node src/scripts/seedMaterialesCotizador.js
 * Requiere: connectDBUsers en .env
 */
import '../db.js';
import Materiales from '../models/materiales.model.js';

const BASE_MATERIALS = [
    { idCotizador: 'melamina', nombre: 'Melamina', precioPorMetro: 6500, unidadMedida: 'm' },
    { idCotizador: 'mdf', nombre: 'MDF', precioPorMetro: 7800, unidadMedida: 'm' },
    { idCotizador: 'tech', nombre: 'Tech', precioPorMetro: 9800, unidadMedida: 'm' }
];

const HERRADURAS = [
    { idCotizador: 'correderas', nombre: 'Correderas cierre suave', precioUnitario: 500, unidadMedida: 'unidad', seccion: 'herrajes' },
    { idCotizador: 'bisagras', nombre: 'Bisagras 110° reforzadas', precioUnitario: 140, unidadMedida: 'unidad', seccion: 'herrajes' },
    { idCotizador: 'jaladeras', nombre: 'Jaladeras minimalistas', precioUnitario: 90, unidadMedida: 'unidad', seccion: 'herrajes' },
    { idCotizador: 'bote', nombre: 'Bote de basura extraíble', precioUnitario: 1200, unidadMedida: 'unidad', seccion: 'herrajes' },
    { idCotizador: 'iluminacion', nombre: 'Iluminación LED interior', precioUnitario: 780, unidadMedida: 'unidad', seccion: 'herrajes' }
];

async function seed() {
    try {
        for (const m of BASE_MATERIALS) {
            await Materiales.findOneAndUpdate(
                { idCotizador: m.idCotizador },
                {
                    nombre: m.nombre,
                    precioPorMetro: m.precioPorMetro,
                    unidadMedida: m.unidadMedida,
                    seccion: m.seccion,
                    idCotizador: m.idCotizador,
                    descripcion: `Material base para cotizador - ${m.nombre}`,
                    disponible: true
                },
                { upsert: true, new: true }
            );
            console.log('Material base:', m.nombre);
        }
        for (const h of HERRADURAS) {
            await Materiales.findOneAndUpdate(
                { idCotizador: h.idCotizador },
                {
                    nombre: h.nombre,
                    precioUnitario: h.precioUnitario,
                    unidadMedida: h.unidadMedida,
                    seccion: h.seccion,
                    idCotizador: h.idCotizador,
                    descripcion: `Herraje para cotizador - ${h.nombre}`,
                    disponible: true
                },
                { upsert: true, new: true }
            );
            console.log('Herraje:', h.nombre);
        }
        console.log('Seed completado.');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

seed();
