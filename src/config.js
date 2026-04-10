import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const envTokenSecret = String(process.env.TOKEN_SECRET || '').trim();

if (!envTokenSecret && process.env.NODE_ENV === 'production') {
	throw new Error('TOKEN_SECRET no configurado en producción');
}

export const TOKEN_SECRET = envTokenSecret || 'dev-only-token-secret-change-me';