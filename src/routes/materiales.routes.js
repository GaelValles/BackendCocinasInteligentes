import { Router } from "express";
import { authRequired } from "../middlewares/validateToken.js";
import {
    crearMaterial,
    obtenerMateriales,
    obtenerMaterial,
    actualizarMaterial,
    eliminarMaterial,
    buscarMaterialPorNombre,
    actualizarPrecioMaterial
} from "../controllers/materiales.controller.js";

const router = Router();

// Ruta para buscar material existente por nombre (usado en "comparar materiales nuevos con existentes" del diagrama)
router.get('/buscar', buscarMaterialPorNombre);

// Ruta para actualizar precio de material (usado en "registrar precios de materiales" del diagrama)
router.put('/actualizarPrecio/:id', authRequired, actualizarPrecioMaterial);

// Rutas CRUD completas para administración de materiales
router.post('/agregarMaterial', authRequired, crearMaterial);
router.get('/verMateriales', authRequired, obtenerMateriales);
router.get('/verMaterial/:id', authRequired, obtenerMaterial);
router.put('/actualizarMaterial/:id', authRequired, actualizarMaterial);
router.delete('/eliminarMaterial/:id', authRequired, eliminarMaterial);

export default router;
