import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { promoverCita } from '../controllers/workflow.controller.js';

const router = Router();

router.use(authRequired);
router.post('/citas/:id/promover', promoverCita);

export default router;
