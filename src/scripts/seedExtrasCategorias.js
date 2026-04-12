/**
 * Script para crear/actualizar categorías de extras en la BD.
 * Ejecutar: node src/scripts/seedExtrasCategorias.js
 * Requiere: connectDBUsers en .env
 */
import '../db.js';
import ExtraCategoria from '../models/extraCategoria.model.js';

const EXTRA_CATEGORIES = [
    { nombre: 'Alacena extraible', orden: 1 },
    { nombre: 'Bote de basura', orden: 2 },
    { nombre: 'Space tower', orden: 3 },
    { nombre: 'Mecanismos electricos', orden: 4 },
    { nombre: 'Sistemas inteligentes', orden: 5 },
    { nombre: 'Esquinas magicas', orden: 6 },
    { nombre: 'Persianas enrollables', orden: 7 },
    { nombre: 'Botelleros/especiero/canastillas', orden: 8 }
];

async function seed() {
    try {
        for (const cat of EXTRA_CATEGORIES) {
            const result = await ExtraCategoria.findOneAndUpdate(
                { nombre: cat.nombre },
                {
                    nombre: cat.nombre,
                    descripcion: `Categoría: ${cat.nombre}`,
                    orden: cat.orden,
                    disponible: true
                },
                { upsert: true, new: true }
            );
            console.log('✓ Categoría creada/actualizada:', cat.nombre);
        }

        console.log('\n✓ Seed de categorías de extras completado exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('✗ Error en seed:', error);
        process.exit(1);
    }
}

seed();
