import { Router } from 'express';
import { crearContacto } from '../controllers/contacto.controller.js';

const router = Router();

// Público: primer contacto desde la landing (nombre, teléfono, correo)
router.post('/', crearContacto);

export default router;
