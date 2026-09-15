import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const envTokenSecret = String(process.env.TOKEN_SECRET || '').trim();

if (!envTokenSecret && process.env.NODE_ENV === 'production') {
	throw new Error('TOKEN_SECRET no configurado en producción');
}

export const TOKEN_SECRET = envTokenSecret || 'dev-only-token-secret-change-me';