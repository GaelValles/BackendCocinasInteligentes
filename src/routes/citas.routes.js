import { Router } from "express";
import { authRequired } from "../middlewares/validateToken.js";
import {
    crearCita,
    actualizarCita,
    eliminarCita,
    obtenerCitas,
    obtenerCita,
    obtenerCitasPorCliente,
    obtenerCitasPorCarro,
    getAllCitas,
    updateCitaEstado,
    cancelarCita,
    iniciarCita,
    finalizarCita
} from "../controllers/citas.controller.js";

const router = Router();

// ========== RUTAS PÚBLICAS (sin autenticación) ==========

// Ruta pública para crear/agendar cita (no requiere cuenta ni autenticación)
router.post('/agregarCita', crearCita);

// ========== RUTAS AUTENTICADAS ==========

// Ruta para actualizar cita existente
router.put('/actualizarCita/:id', authRequired, actualizarCita);

// Ruta para eliminar cita
router.delete('/eliminarCita/:id', authRequired, eliminarCita);

// Ruta para ver citas del usuario autenticado (usado en "Ver citas" del diagrama)
router.get('/verCitas', authRequired, obtenerCitas);

// Ruta para ver una cita específica
router.get('/verCita/:id', authRequired, obtenerCita);

// Ruta para obtener citas por cliente específico
router.get('/porCliente/:id', authRequired, obtenerCitasPorCliente);

// Ruta para obtener citas por carro específico
router.get('/porCarro/:id', authRequired, obtenerCitasPorCarro);

// Ruta para cancelar cita (usado en "Cancelar cita" del diagrama con lógica de penalización)
router.post('/:id/cancel', authRequired, cancelarCita);

// Ruta para iniciar cita (usado en "Iniciar cita" del diagrama, cambia estado a "en_proceso")
router.put('/:id/iniciar', authRequired, iniciarCita);

// Ruta para finalizar cita (usado en "Finalizar cita" del diagrama, cambia estado a "completada")
router.put('/:id/finalizar', authRequired, finalizarCita);

// Ruta administrativa para ver todas las citas del sistema
router.get('/getAllCitas', authRequired, getAllCitas);

// Ruta para actualizar estado de cita (usado en "Seleccionar estado" del diagrama)
router.put('/updateEstado/:id', authRequired, updateCitaEstado);

export default router;