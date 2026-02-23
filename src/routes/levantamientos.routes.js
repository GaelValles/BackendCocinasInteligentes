import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import {
    crear,
    listar,
    obtenerPorId,
    actualizar,
    cambiarEstado,
    asignarEmpleado,
    eliminar,
    convertirACotizacion
} from '../controllers/levantamiento.controller.js';

const router = Router();

// Crear nuevo levantamiento
router.post('/', authRequired, crear);

// Listar levantamientos con filtros y paginación
router.get('/', authRequired, listar);

// Obtener levantamiento por ID
router.get('/:id', authRequired, obtenerPorId);

// Actualizar levantamiento
router.patch('/:id', authRequired, actualizar);

// Eliminar levantamiento
router.delete('/:id', authRequired, eliminar);

// Cambiar estado del levantamiento
router.patch('/:id/estado', authRequired, cambiarEstado);

// Asignar empleado al levantamiento
router.patch('/:id/asignar', authRequired, asignarEmpleado);

// Convertir levantamiento a cotización
router.post('/:id/convertir-cotizacion', authRequired, convertirACotizacion);

export default router;
