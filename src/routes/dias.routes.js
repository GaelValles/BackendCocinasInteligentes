import { Router } from "express";
import { authRequired } from "../middlewares/validateToken.js";
import {
    obtenerDiasInhabiles,
    registrarDiaInhabil,
    eliminarDiaInhabil
} from "../controllers/dias.controller.js";

const router = Router();

// Ruta para obtener días inhábiles (usado en "Ver días" del diagrama para mostrar disponibilidad)
router.get('/obtenerDias', authRequired, obtenerDiasInhabiles);

// Ruta para registrar día inhábil (usado en "Registrar día" del diagrama)
router.post('/registrarDia', authRequired, registrarDiaInhabil);

// Ruta para eliminar día inhábil
router.delete('/eliminarDia/:id', authRequired, eliminarDiaInhabil);

export default router;