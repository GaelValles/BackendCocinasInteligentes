import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { obtenerHerrajes } from '../controllers/catalogos.controller.js';
import {
    crearMaterial,
    actualizarMaterial,
    eliminarMaterial
} from '../controllers/materiales.controller.js';

const router = Router();

// GET /api/herrajes -> listado (fallback)
router.get('/', obtenerHerrajes);

// Operaciones administrativas para herrajes (mapeadas a material controller)
router.post('/', authRequired, crearMaterial);
router.patch('/:id', authRequired, actualizarMaterial);
router.delete('/:id', authRequired, eliminarMaterial);

export default router;
