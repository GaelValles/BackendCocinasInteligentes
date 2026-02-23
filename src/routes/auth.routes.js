import { Router } from "express";
import { 
    login, 
    register, 
    perfil, 
    verifyToken, 
    getUsers, 
    getUser, 
    deleteUser, 
    logout, 
    subirUser,
    getCurrentUser,
    updatePassword,
    requestPasswordReset,
    resetPassword
} from "../controllers/auth.controller.js";
import { authRequired } from "../middlewares/validateToken.js";
const router = Router()

// Ruta para login (usado en "Login" del diagrama)
router.post('/login', login);

// Ruta para registro de nuevos usuarios (usado en "Registrar usuario" del diagrama)
router.post('/register', register);

// Ruta para agregar usuario desde admin (usado en "Asignar personas a empresa" del diagrama)
router.post('/addUser', authRequired, subirUser);

// Ruta para ver todos los usuarios (usado en Dashboard/Admin del diagrama)
router.get('/verUsuarios', authRequired, getUsers);

// Ruta para ver un usuario específico
router.get('/VerUsuario/:id', authRequired, getUser);

// Ruta para eliminar/desactivar usuario
router.put('/deleteUser/:id', authRequired, deleteUser);

// Ruta para logout (usado en "Logout" del diagrama)
router.post('/logout', logout);

// Ruta para verificar token (usado en validación de sesión)
router.get('/verify', verifyToken);

// Ruta para obtener perfil del usuario autenticado
router.get('/perfil', authRequired, perfil);

// Ruta para obtener usuario actual (getCurrentUser)
router.get('/me', authRequired, getCurrentUser);

// Ruta para actualizar contraseña
router.put('/update-password', authRequired, updatePassword);

// Ruta para solicitar restablecimiento de contraseña
router.post('/request-password-reset', requestPasswordReset);

// Ruta para restablecer contraseña con token
router.post('/reset-password', resetPassword);

export default router;