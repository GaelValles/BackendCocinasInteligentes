import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from 'dns';

// Configurar DNS de Google solo para esta aplicación
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config(); // Carga las variables del archivo .env
export const connectDBClientes = mongoose.createConnection(process.env.connectDBUsers, {

});

// Verifica conexión participantes
connectDBClientes.on('connected', () => {
  console.log('Conectado a MongoDB Clientes');
});
connectDBClientes.on('error', (err) => {
  console.error('Error en conexión Clientes:', err);
});
