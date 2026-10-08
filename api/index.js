import app from '../src/app.js';
import { ensureDbConnection } from '../src/db.js';

// Precalentar conexión en cold start (el middleware /api también espera activamente)
if (process.env.VERCEL) {
  ensureDbConnection().catch((error) => {
    console.error('Warm-up MongoDB en serverless:', error?.message || error);
  });
}

export default app;
