import jwt from 'jsonwebtoken';
import { TOKEN_SECRET } from '../config.js';
import Admin from '../models/admin.model.js';

export const authRequired = async (req, res, next) => {
    try {
        // Buscar token en cookies o en header Authorization
        let token = req.cookies.token;
        
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

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