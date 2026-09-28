import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { requireStaff } from '../middlewares/roleValidator.js';
import {
    crear,
    listar,
    listarEmpleados,
    obtenerPorId,
    actualizar,
    eliminar
} from '../controllers/usuarios.controller.js';

const router = Router();

// Crear usuario operativo (Integrantes modal) y alias compatibles
router.post('/', authRequired, requireStaff, crear);
router.post('/crear', authRequired, requireStaff, crear);
router.post('/agregar', authRequired, requireStaff, crear);

// Listar todos los usuarios
router.get('/', authRequired, listar);

// Listar empleados (alias para compatibilidad)
router.get('/empleados', authRequired, listarEmpleados);

// Obtener usuario por ID
router.get('/:id', authRequired, obtenerPorId);

router.put('/:id', authRequired, requireStaff, actualizar);
router.delete('/:id', authRequired, requireStaff, eliminar);

export default router;
