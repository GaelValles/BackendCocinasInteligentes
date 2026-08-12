import jwt from 'jsonwebtoken';
import { TOKEN_SECRET } from '../config.js';
import Admin from '../models/admin.model.js';

export const getTokenFromRequest = (req) => {
    const cookieToken = req.cookies?.token;
    if (cookieToken) return cookieToken;

    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.trim()) {
        if (authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7).trim();
        }
        return authHeader.trim();
    }

    const headerToken = req.headers['x-access-token'] || req.headers['x-token'] || req.headers.token;
    if (typeof headerToken === 'string' && headerToken.trim()) {
        return headerToken.trim();
    }

    const queryToken = req.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
        return queryToken.trim();
    }

    return null;
};

export const authRequired = async (req, res, next) => {
    try {
        const token = getTokenFromRequest(req);

        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'No token provided' 
            });
        }

        // Verificar el token
        jwt.verify(token, TOKEN_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Invalid token' 
                });
            }

            // Buscar el usuario completo en la base de datos
            const admin = await Admin.findById(decoded.id);
            
            if (!admin) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Usuario no encontrado' 
                });
            }
            
            // Guardar el usuario completo en req.admin
            req.admin = admin;

            next();
        });
    } catch (error) {
        console.error('Error en authRequired:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Error en la autenticación' 
        });
    }
}