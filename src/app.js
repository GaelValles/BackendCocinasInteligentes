import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.routes.js';
import citasRoutes from './routes/citas.routes.js';
import diasRoutes from './routes/dias.routes.js';
import cotizacionesRoutes from './routes/cotizaciones.routes.js';
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
app.use('/citas', citasRoutes);
app.use('/dias', diasRoutes);
app.use('/cotizaciones', cotizacionesRoutes);
// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Algo salió mal!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

export default app;