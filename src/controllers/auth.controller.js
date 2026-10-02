import Admin from "../models/admin.model.js";
import { TOKEN_SECRET } from "../config.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {createAccessToken} from "../libs/jwt.js";
import { getTokenFromRequest } from "../middlewares/validateToken.js";
import { extractCaptchaToken, shouldSkipCaptchaVerification, verifyRecaptchaToken } from "../services/recaptcha.service.js";
import { connectDBClientes } from "../db.js";

const buildUserPayload = (user) => ({
    id: user._id,
    nombre: user.nombre,
    correo: user.correo,
    telefono: user.telefono,
    rol: user.rol,
    createdAt: user.createdAt
});

const authCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000
    };
};

export const register = async (req, res) => {
    const {nombre, correo, telefono, rol, password} = req.body;
    try {
        if (rol === 'cliente') {
            return res.status(400).json({
                success: false,
                message: 'No hay registro para clientes. Los datos del cliente se guardan al agendar una cita.'
            });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const newAdmin = new Admin({
            nombre,
            correo,
            telefono,
            rol,
            password: passwordHash,
        
        });

        const AdminSaved = await newAdmin.save();
        const token = await createAccessToken({id: AdminSaved._id})
        const userPayload = buildUserPayload(AdminSaved);
        
        res.cookie('token', token, authCookieOptions());
        res.json({
            success: true,
            message: 'Usuario creado correctamente',
            token,
            user: userPayload,
            data: {
                token,
                user: userPayload
            }
        })

    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message
        })
    }
};
export const subirUser = async (req, res) => {
    const {nombre, correo, telefono, rol, password} = req.body;
    try {
        if (rol === 'cliente') {
            return res.status(400).json({
                message: 'No se crean usuarios con rol cliente. Los datos del cliente se guardan al agendar una cita.'
            });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const newAdmin = new Admin({
            nombre,
            correo,
            telefono,
            rol,
            password: passwordHash
        });

        const AdminSaved = await newAdmin.save();
        res.status(201).json({
            success: true,
            message: 'Usuario creado correctamente',
            data: {
                id: AdminSaved._id,
                nombre: AdminSaved.nombre,
                correo: AdminSaved.correo,
                telefono: AdminSaved.telefono,
                rol: AdminSaved.rol
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const login = async (req, res) => {
    const correo = (req.body?.correo || req.body?.email || req.body?.usuario || '').trim();
    const password = req.body?.password || req.body?.contrasena || req.body?.passwordHash || '';
    try {
        const captchaToken = extractCaptchaToken(req);

        if (!shouldSkipCaptchaVerification(captchaToken)) {
            if (!captchaToken) {
                return res.status(400).json({
                    success: false,
                    message: 'El captcha (captcha-token o cf-turnstile-response) es requerido'
                });
            }

            const captchaResult = await verifyRecaptchaToken(String(captchaToken), {
                remoteIp: req.ip,
                expectedAction: 'login'
            });

            if (!captchaResult.success) {
                return res.status(400).json({
                    success: false,
                    message: 'La verificación del captcha falló',
                    error: captchaResult.error || 'Token inválido o expirado'
                });
            }
        }

        if (!correo || !password) {
            return res.status(400).json({
                success: false,
                message: 'Correo y contraseña son requeridos'
            });
        }

        console.log('--- INTENTO DE LOGIN ---');
        console.log('Correo recibido:', req.body?.email || req.body?.correo || req.body?.usuario);
        console.log('Base de datos activa en Mongoose:', connectDBClientes.name || connectDBClientes.db?.databaseName);
        const totalUsuarios = await Admin.countDocuments();
        console.log('Total de usuarios en esta BD:', totalUsuarios);
        if (totalUsuarios === 0) {
            console.warn('[login] totalUsuarios === 0: la URI conectada (connectDBUsers) podría no ser la BD con datos de producción.');
        }
        const listaCorreos = await Admin.find({}, 'correo nombre').lean();
        console.log('Correos existentes en la colección Users:', listaCorreos);

        try {
            const mongoClient = typeof connectDBClientes.getClient === 'function'
                ? connectDBClientes.getClient()
                : connectDBClientes.client;

            if (!connectDBClientes.db || !mongoClient) {
                console.log('Error listando bases de datos: conexión MongoDB aún no disponible');
            } else {
                const adminDb = connectDBClientes.db.admin();
                const dbs = await adminDb.listDatabases();
                console.log('=== BASES DE DATOS DISPONIBLES EN ATLAS ===');
                for (const dbInfo of dbs.databases) {
                    const dbInstance = mongoClient.db(dbInfo.name);
                    const collections = await dbInstance.listCollections().toArray();
                    const collectionNames = collections.map((c) => c.name);
                    console.log(`BD: [${dbInfo.name}] -> Colecciones:`, collectionNames);

                    const usersCollectionName = collectionNames.find((name) => name.toLowerCase() === 'users');
                    if (usersCollectionName) {
                        const usersInDb = await dbInstance.collection(usersCollectionName)
                            .find({}, { projection: { correo: 1, email: 1, nombre: 1, name: 1 } })
                            .limit(20)
                            .toArray();
                        const usersCount = await dbInstance.collection(usersCollectionName).countDocuments();
                        console.log(`  -> Colección ${usersCollectionName}: ${usersCount} documento(s)`);
                        console.log(`  -> Muestra de usuarios en [${dbInfo.name}]:`, usersInDb);
                    }
                }
                console.log('============================================');
            }
        } catch (e) {
            console.log('Error listando bases de datos:', e.message);
        }

        console.log('-------------------------');

        const AdminFound = await Admin.findOne({ correo: { $regex: new RegExp(`^${correo}$`, 'i') } });

        if (!AdminFound) return res.status(400).json({
            success: false,
            message: 'Usuario no encontrado'
        });
        const isMatch = await bcrypt.compare(password, AdminFound.password);
        
        if (!isMatch) return res.status(400).json({
            success: false,
            message: 'Contraseña incorrecta'
        });

        const token = await createAccessToken({id: AdminFound._id,});
        const userPayload = buildUserPayload(AdminFound);
        
        res.cookie('token', token, authCookieOptions());
        res.json({
            success: true,
            message: 'Login exitoso',
            token,
            user: userPayload,
            data: {
                token,
                user: userPayload
            }
        });

    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message
        });
    }
};

export const getUsers = async (req, res) => {
    try {
        const users = await Admin.find();
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params; // Asegúrate de recibir el id por params
        const user = await Admin.findByIdAndUpdate(id, { status: false }, { new: true });
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        res.json({ success: true, message: 'Usuario desactivado correctamente', data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await Admin.findById(id).select('-password'); // Excluye el campo de la contraseña

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


export const logout = (req, res) => {
    const cookieOptions = authCookieOptions();
    res.clearCookie('token', {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: '/'
    });
    return res.status(200).json({
        success: true,
        message: "Sesión cerrada correctamente"
    });
}

export const verifyToken = async (req, res) => {
    const token = getTokenFromRequest(req);

    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    jwt.verify(token, TOKEN_SECRET, async (err, admin) => {
        if (err) return res.status(401).json({ success: false, message: 'Token no válido' });
        
        const adminFound = await Admin.findById(admin.id)
            .populate('citas')
            .populate('carros');

        if (!adminFound) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

        const userPayload = buildUserPayload(adminFound);
        
        return res.json({
            success: true,
            user: userPayload,
            data: {
                ...userPayload,
                carros: adminFound.carros,
                citas: adminFound.citas,
                penaltyUntil: adminFound.penaltyUntil || null
            }
        });
    });
}

export const perfil = async(req, res) => {
    const adminFound = await Admin.findById(req.admin?.id)

    if (!adminFound) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const userPayload = buildUserPayload(adminFound);

    return res.json({ success: true, user: userPayload, data: userPayload });
}

export const updatePerfil = async (req, res) => {
    const {nombre, correo, telefono} = req.body;
    const adminUpdated = await Admin.findByIdAndUpdate(req.admin.id, {
        nombre,
        correo,
        telefono
    }, {new: true});
    if (!adminUpdated) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    return res.json({ success: true, data: adminUpdated });
};

/**
 * Obtener usuario actual autenticado (getCurrentUser)
 */
export const getCurrentUser = async (req, res) => {
    try {
        const adminFound = await Admin.findById(req.admin.id).select('-password');

        if (!adminFound) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const userPayload = buildUserPayload(adminFound);

        return res.json({
            success: true,
            user: userPayload,
            data: userPayload
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuario actual',
            error: error.message
        });
    }
};

/**
 * Actualizar contraseña del usuario autenticado
 */
export const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña actual y nueva contraseña son requeridas'
            });
        }

        const admin = await Admin.findById(req.admin.id);

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Verificar contraseña actual
        const isMatch = await bcrypt.compare(currentPassword, admin.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña actual incorrecta'
            });
        }

        // Hash de la nueva contraseña
        const passwordHash = await bcrypt.hash(newPassword, 10);
        admin.password = passwordHash;
        await admin.save();

        res.json({
            success: true,
            message: 'Contraseña actualizada exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al actualizar contraseña',
            error: error.message
        });
    }
};

/**
 * Solicitar restablecimiento de contraseña (por implementar con email)
 */
export const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email es requerido'
            });
        }

        const admin = await Admin.findOne({ correo: email });

        if (!admin) {
            // Por seguridad, retornar éxito aunque el usuario no exista
            return res.json({
                success: true,
                message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña'
            });
        }

        // TODO: Implementar envío de email con token de restablecimiento
        // Por ahora, solo retornamos éxito
        res.json({
            success: true,
            message: 'Instrucciones de restablecimiento enviadas al correo (por implementar)'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al solicitar restablecimiento',
            error: error.message
        });
    }
};

/**
 * Restablecer contraseña con token (por implementar con email)
 */
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token y nueva contraseña son requeridos'
            });
        }

        // TODO: Implementar validación de token de restablecimiento
        // Por ahora, retornar 501 (no implementado)
        res.status(501).json({
            success: false,
            message: 'Funcionalidad por implementar'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al restablecer contraseña',
            error: error.message
        });
    }
};