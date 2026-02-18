import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.routes.js';
import contactoRoutes from './routes/contacto.routes.js';
import citasRoutes from './routes/citas.routes.js';
import diasRoutes from './routes/dias.routes.js';
import cotizacionesRoutes from './routes/cotizaciones.routes.js';
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
app.use(authRoutes);
app.use('/contacto', contactoRoutes);
app.use('/citas', citasRoutes);
app.use('/dias', diasRoutes);
app.use('/cotizaciones', cotizacionesRoutes);
app.use('/materiales', materialesRoutes);
app.use('/disenos', disenosRoutes);
app.use('/ordenes', ordenTrabajoRoutes);
app.use('/pagos', pagosRoutes);
// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Algo salió mal!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

export default app;