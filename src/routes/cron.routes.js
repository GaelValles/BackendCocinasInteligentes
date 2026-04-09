import { Router } from 'express';
import { runFollowUpCronNow } from '../controllers/cron.controller.js';

const router = Router();

// Called by Vercel Cron with Authorization: Bearer <CRON_SECRET>
router.get('/followup/run', runFollowUpCronNow);

export default router;
