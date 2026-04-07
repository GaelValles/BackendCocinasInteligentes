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

router.get('/buscar', authRequired, buscarMaterialPorNombre);

router.put('/actualizarPrecio/:id', authRequired, actualizarPrecioMaterial);

// Rutas CRUD completas para administración de materiales
router.post('/agregarMaterial', authRequired, crearMaterial);
router.get('/verMateriales', authRequired, obtenerMateriales);
router.get('/verMaterial/:id', authRequired, obtenerMaterial);
router.put('/actualizarMaterial/:id', authRequired, actualizarMaterial);
router.delete('/eliminarMaterial/:id', authRequired, eliminarMaterial);

// Canonical/fallback routes used by frontend integrations.
router.get('/', obtenerMateriales);
router.get('/:id', obtenerMaterial);
router.post('/', authRequired, crearMaterial);
router.patch('/:id', authRequired, actualizarMaterial);
router.delete('/:id', authRequired, eliminarMaterial);

export default router;
