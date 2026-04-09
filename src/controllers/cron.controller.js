import crypto from 'crypto';
import { runFollowUpAutomation } from '../services/followUpCron.js';

const secureEquals = (left, right) => {
    const a = Buffer.from(String(left || ''));
    const b = Buffer.from(String(right || ''));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
};

const extractBearerToken = (authorizationHeader = '') => {
    const value = String(authorizationHeader || '').trim();
    if (!value.toLowerCase().startsWith('bearer ')) return '';
    return value.slice(7).trim();
};

export const runFollowUpCronNow = async (req, res) => {
    try {
        const expectedSecret = String(process.env.CRON_SECRET || '').trim();
        const incomingSecret = extractBearerToken(req.headers.authorization);

        if (!expectedSecret) {
            return res.status(503).json({
                success: false,
                message: 'CRON_SECRET no configurado en el entorno'
            });
        }

        if (!incomingSecret || !secureEquals(incomingSecret, expectedSecret)) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado'
            });
        }

        const result = await runFollowUpAutomation();
        if (!result?.success) {
            return res.status(500).json({
                success: false,
                message: 'Falló la ejecución del cron de follow-up',
                data: result
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Cron de follow-up ejecutado correctamente',
            data: result
        });
    } catch (error) {
        console.error('Error ejecutando cron follow-up manual:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno al ejecutar cron de follow-up'
        });
    }
};
