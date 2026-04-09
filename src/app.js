import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import responseWrapper from './middlewares/responseWrapper.js';

import authRoutes from './routes/auth.routes.js';
import contactoRoutes from './routes/contacto.routes.js';
import citasRoutes from './routes/citas.routes.js';
import diasRoutes from './routes/dias.routes.js';
import cotizacionesRoutes from './routes/cotizaciones.routes.js';
import levantamientosRoutes from './routes/levantamientos.routes.js';
import catalogosRoutes from './routes/catalogos.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import materialesRoutes from './routes/materiales.routes.js';
import disenosRoutes from './routes/disenos.routes.js';
import ordenTrabajoRoutes from './routes/ordenTrabajo.routes.js';
import pagosRoutes from './routes/pagos.routes.js';
import tareasRoutes from './routes/tareas.routes.js';
import proyectosRoutes from './routes/proyectos.routes.js';
import archivosRoutes from './routes/archivos.routes.js';
import uploadsCompatRoutes from './routes/uploads.compat.routes.js';
import kanbanRoutes from './routes/kanban.routes.js';
import workflowRoutes from './routes/workflow.routes.js';
import seguimientoRoutes from './routes/seguimiento.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import cronRoutes from './routes/cron.routes.js';
import { startFollowUpCron } from './services/followUpCron.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const DEV_ALLOWED_ORIGINS = new Set([
    'http://localhost:5173',
    'http://localhost:3000'
]);

const parseAllowedOrigins = () => {
    const values = [
        process.env.CORS_ALLOWED_ORIGINS,
        process.env.FRONTEND_URL,
        process.env.FRONTEND_PUBLIC_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
    ]
        .filter(Boolean)
        .flatMap((item) => String(item).split(','))
        .map((item) => item.trim())
        .filter(Boolean);

    return new Set(values);
};

const PROD_ALLOWED_ORIGINS = parseAllowedOrigins();
const allowAllOrigins = process.env.CORS_ALLOW_ALL === 'true';

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

const isAllowedOrigin = (origin) => {
    if (allowAllOrigins) return true;
    if (!origin) return true;
    if (DEV_ALLOWED_ORIGINS.has(origin)) return true;
    if (PROD_ALLOWED_ORIGINS.has(origin)) return true;

    try {
        const parsed = new URL(origin);
        const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        if (process.env.NODE_ENV === 'production') return false;
        return isLocalHost;
    } catch {
        return false;
    }
};

app.use(morgan('dev'));
app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`Origin no permitido por CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'captcha-token', 'x-captcha-token', 'captchatoken', 'x-public-tracking', 'Cache-Control', 'cache-control', 'Pragma', 'pragma', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Ku%C3%BCche-Trace']
}));
app.use(express.json());
app.use(cookieParser());
// Normalize JSON responses into the frontend envelope
app.use(responseWrapper);
// Serve uploaded files
import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Backend Küche API funcionando correctamente',
        version: '2.1.0',
        endpoints: {
            auth: '/api/auth/login, /api/auth/register, /api/auth/logout, /api/auth/verify, /api/auth/me',
            levantamientos: '/api/levantamientos',
            cotizaciones: '/api/cotizaciones',
            catalogos: '/api/catalogos',
            usuarios: '/api/usuarios',
            materiales: '/api/materiales',
            citas: '/api/citas',
            contacto: '/api/contacto',
            disenos: '/api/disenos',
            ordenes: '/api/ordenes',
            pagos: '/api/pagos',
            tareas: '/api/tareas',
            proyectos: '/api/proyectos',
            clientes: '/api/clientes',
            seguimiento: '/api/seguimiento',
            archivos: '/api/archivos',
            upload: '/api/uploads'
        }
    });
});

// Montar las rutas con prefijo /api
app.use('/api/auth', authRoutes);
app.use('/api/contacto', contactoRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/dias', diasRoutes);
app.use('/api/cotizaciones', cotizacionesRoutes);
app.use('/api/levantamientos', levantamientosRoutes);
app.use('/api/catalogos', catalogosRoutes);
// Alias: soportar rutas antiguas/fallbacks que el frontend intenta
app.use('/api/catalogo', catalogosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/empleados', usuariosRoutes); // Alias para empleados
app.use('/api/materiales', materialesRoutes);
app.use('/api/disenos', disenosRoutes);
app.use('/api/ordenes', ordenTrabajoRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/tareas', tareasRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/seguimiento', seguimientoRoutes);
app.use('/api/archivos', archivosRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api', uploadsCompatRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/workflow', workflowRoutes);
import herrajesRoutes from './routes/herrajes.routes.js';
app.use('/api/herrajes', herrajesRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Algo salió mal!',
        error: {
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
    });
});

// Initialize follow-up auto-inactivate cron job
if (!process.env.VERCEL && process.env.ENABLE_FOLLOWUP_CRON !== 'false') {
    try {
        startFollowUpCron();
    } catch (err) {
        console.error('⚠️  Failed to start follow-up cron job:', err.message);
    }
}

export default app;