/**
 * Middleware para verificar que el usuario tenga uno de los roles permitidos
 * @param  {...string} rolesPermitidos - Lista de roles que pueden acceder a la ruta
 * @returns {Function} Middleware de Express
 * 
 * Ejemplo de uso:
 * router.get('/admin-only', authRequired, requireRole('admin'), controller)
 * router.get('/staff', authRequired, requireRole('admin', 'arquitecto', 'ingeniero'), controller)
 */
export const requireRole = (...rolesPermitidos) => {
    return (req, res, next) => {
        // Verificar que el usuario esté autenticado
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: 'No autenticado'
            });
        }

        // Verificar que el usuario tenga un rol válido
        const userRole = req.admin.rol;
        
        if (!rolesPermitidos.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Acceso denegado. Se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}`
            });
        }

        // Usuario tiene el rol correcto, continuar
        next();
    };
};

/**
 * Middleware para verificar que el usuario sea admin
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware para verificar que el usuario sea admin o arquitecto
 */
export const requireStaff = requireRole('admin', 'arquitecto');

/**
 * Middleware para verificar que el usuario sea admin, arquitecto o ingeniero
 */
export const requireEmployee = requireRole('admin', 'arquitecto', 'ingeniero', 'empleado', 'empleado_general', 'staff');

/**
 * Verificar si el usuario actual es el propietario del recurso o tiene permisos de admin/arquitecto
 * @param {string} resourceUserId - ID del usuario propietario del recurso
 * @param {Object} req - Request de Express
 * @returns {boolean} true si tiene permiso
 */
export const isOwnerOrStaff = (resourceUserId, req) => {
    if (!req.admin) return false;
    
    const userRole = req.admin.rol;
    const userId = req.admin._id.toString();
    
    // Admin y arquitecto pueden acceder a todo
    if (userRole === 'admin' || userRole === 'arquitecto') {
        return true;
    }
    
    // Otros usuarios solo pueden acceder a sus propios recursos
    return userId === resourceUserId.toString();
};

/**
 * Verificar si el usuario puede modificar el recurso
 * @param {string} resourceUserId - ID del usuario propietario del recurso
 * @param {Object} req - Request de Express
 * @returns {boolean} true si puede modificar
 */
export const canModifyResource = (resourceUserId, req) => {
    if (!req.admin) return false;
    
    const userRole = req.admin.rol;
    const userId = req.admin._id.toString();
    
    // Admin puede modificar todo
    if (userRole === 'admin') {
        return true;
    }
    
    // Arquitecto puede modificar todo excepto admin
    if (userRole === 'arquitecto') {
        return true;
    }
    
    // Ingenieros solo pueden modificar sus propios recursos
    if (userRole === 'ingeniero') {
        return userId === resourceUserId.toString();
    }
    
    // Clientes no pueden modificar
    return false;
};
