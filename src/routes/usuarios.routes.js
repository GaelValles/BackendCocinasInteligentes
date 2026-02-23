import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import {
    listar,
    listarEmpleados,
    obtenerPorId
} from '../controllers/usuarios.controller.js';

const router = Router();

// Listar todos los usuarios
router.get('/', authRequired, listar);

// Listar empleados (alias para compatibilidad)
router.get('/empleados', authRequired, listarEmpleados);

// Obtener usuario por ID
router.get('/:id', authRequired, obtenerPorId);

export default router;
