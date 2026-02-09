import { Router } from "express";
import { authRequired } from "../middlewares/validateToken.js";
import {
    crearOrdenTrabajo,
    obtenerOrdenesTrabajo,
    obtenerOrdenTrabajo,
    obtenerOrdenPorNumeroSeguimiento,
    actualizarEstadoOrden,
    asignarIngeniero,
    agregarEvidencia,
    obtenerOrdenesPorIngeniero,
    obtenerOrdenesPendientesDiseno,
    finalizarOrden
} from "../controllers/ordenTrabajo.controller.js";

const router = Router();

// ========== RUTAS PÚBLICAS (sin autenticación) ==========

// Ruta pública para consultar estado por número de seguimiento (usado por el cliente)
router.get('/seguimiento/:numeroSeguimiento', obtenerOrdenPorNumeroSeguimiento);

// ========== RUTAS AUTENTICADAS ==========

// Crear orden de trabajo (usado al finalizar cita)
router.post('/crear', authRequired, crearOrdenTrabajo);

// Obtener todas las órdenes (admin)
router.get('/todas', authRequired, obtenerOrdenesTrabajo);

// Obtener una orden específica por ID
router.get('/:id', authRequired, obtenerOrdenTrabajo);

// Actualizar estado de la orden (usado en el flujo de progreso del diagrama)
router.put('/:id/estado', authRequired, actualizarEstadoOrden);

// Asignar ingeniero a una orden (usado por admin)
router.put('/:id/asignar-ingeniero', authRequired, asignarIngeniero);

// Agregar evidencia (fotos/documentos) a una orden
router.post('/:id/evidencia', authRequired, agregarEvidencia);

// Obtener órdenes asignadas a un ingeniero específico
router.get('/ingeniero/:ingenieroId', authRequired, obtenerOrdenesPorIngeniero);

// Obtener órdenes pendientes de diseño (para arquitectos)
router.get('/pendientes/diseno', authRequired, obtenerOrdenesPendientesDiseno);

// Finalizar orden de trabajo
router.put('/:id/finalizar', authRequired, finalizarOrden);

export default router;
