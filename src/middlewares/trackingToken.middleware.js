import jwt from 'jsonwebtoken';
import TrackingAccess from '../models/trackingAccess.model.js';

const TRACKING_SCOPE = 'tracking:read';

const getTrackingSecret = () => process.env.TRACKING_JWT_SECRET || process.env.TOKEN_SECRET || 'tracking-secret-dev';

export const trackingAuthRequired = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, getTrackingSecret());

        if (!decoded || decoded.scope !== TRACKING_SCOPE) {
            return res.status(403).json({ success: false, message: 'Invalid tracking scope' });
        }

        const access = await TrackingAccess.findOne({
            _id: decoded.sub,
            enabled: true,
            codigo6: decoded.codigo6
        }).lean();

        if (!access) {
            return res.status(401).json({ success: false, message: 'Sesion de seguimiento invalida' });
        }

        req.tracking = {
            claims: decoded,
            access
        };

        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token de seguimiento inválido' });
    }
};
