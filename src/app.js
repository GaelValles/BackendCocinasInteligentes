import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';

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
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(morgan('dev'));
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Backend Küche API funcionando correctamente',
        version: '2.0.0',
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
            pagos: '/api/pagos'
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
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/empleados', usuariosRoutes); // Alias para empleados
app.use('/api/materiales', materialesRoutes);
app.use('/api/disenos', disenosRoutes);
app.use('/api/ordenes', ordenTrabajoRoutes);
app.use('/api/pagos', pagosRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Algo salió mal!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

export default app;