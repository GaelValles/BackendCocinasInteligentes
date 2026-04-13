/**
 * Script de verificación para pruebas locales
 * Ejecutar: node src/scripts/verify-local-setup.js
 */
import '../db.js';
import Electrodomestico from '../models/electrodomestico.model.js';
import ExtraCategoria from '../models/extraCategoria.model.js';
import Extra from '../models/extra.model.js';

const tests = [];

// Test 1: Verificar conexión a MongoDB
tests.push({
    name: '✓ Conexión a MongoDB',
    fn: async () => {
        try {
            // Verificar readyState (1=conectado, 2=conectando)
            const readyState = Electrodomestico.db.readyState;
            if (readyState !== 1 && readyState !== 2) {
                throw new Error(`Estado: ${readyState} (esperado: 1 o 2)`);
            }
            const stateLabel = readyState === 1 ? 'Conectado' : 'Conectando';
            return `✓ ${stateLabel}`;
        } catch (error) {
            throw new Error(`✗ Error: ${error.message}`);
        }
    }
});

// Test 2: Verificar categorías de extras
tests.push({
    name: '✓ Categorías de Extras',
    fn: async () => {
        try {
            const count = await ExtraCategoria.countDocuments();
            const categorias = await ExtraCategoria.find().select('nombre').lean();
            const nombres = categorias.map(c => c.nombre).join(', ');
            return `✓ ${count} categorías encontradas: ${nombres}`;
        } catch (error) {
            throw new Error(`✗ Error: ${error.message}`);
        }
    }
});

// Test 3: Verificar modelo Electrodomestico
tests.push({
    name: '✓ Modelo Electrodomestico',
    fn: async () => {
        try {
            const count = await Electrodomestico.countDocuments();
            return `✓ Colección lista. Documentos: ${count}`;
        } catch (error) {
            throw new Error(`✗ Error: ${error.message}`);
        }
    }
});

// Test 4: Verificar modelo Extra
tests.push({
    name: '✓ Modelo Extra',
    fn: async () => {
        try {
            const count = await Extra.countDocuments();
            return `✓ Colección lista. Documentos: ${count}`;
        } catch (error) {
            throw new Error(`✗ Error: ${error.message}`);
        }
    }
});

// Test 5: Verificar variables de entorno críticas
tests.push({
    name: '✓ Variables de Entorno',
    fn: async () => {
        const required = ['TOKEN_SECRET', 'CRON_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`✗ Variables faltantes: ${missing.join(', ')}`);
        }
        
        return `✓ Todas las variables críticas configuradas (${required.length})`;
    }
});

// Test 6: Verificar NODE_ENV
tests.push({
    name: '✓ Entorno de Ejecución',
    fn: async () => {
        const nodeEnv = process.env.NODE_ENV;
        if (nodeEnv !== 'development' && nodeEnv !== 'production') {
            throw new Error(`✗ NODE_ENV inválido: ${nodeEnv}`);
        }
        return `✓ NODE_ENV = ${nodeEnv}`;
    }
});

async function runTests() {
    console.log('\n🧪 VERIFICACIÓN DE SETUP LOCAL\n');
    console.log('═'.repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            console.log(`${test.name}`);
            console.log(`   ${result}\n`);
            passed++;
        } catch (error) {
            console.log(`${test.name}`);
            console.log(`   ${error.message}\n`);
            failed++;
        }
    }
    
    console.log('═'.repeat(50));
    console.log(`\n📊 RESULTADOS: ${passed} pasados, ${failed} fallidos\n`);
    
    if (failed === 0) {
        console.log('🎉 ¡Todo está listo para pruebas locales!\n');
        console.log('Próximos pasos:');
        console.log('  1. npm run dev');
        console.log('  2. Abrir http://localhost:3000 (o el puerto configurado)');
        console.log('  3. Probar endpoints de electrodomésticos y extras\n');
    } else {
        console.log('⚠️  Hay problemas que necesitan solución antes de continuar\n');
    }
    
    process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(err => {
    console.error('Error críticon:', err);
    process.exit(1);
});
