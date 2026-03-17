import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from 'dns';

// Configurar DNS de Google solo para esta aplicación
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config(); // Carga las variables del archivo .env
// Validar que la variable de entorno exista y dar un mensaje claro si falta
if (!process.env.connectDBUsers) {
  console.error('\n[FATAL] La variable de entorno `connectDBUsers` no está configurada.');
  console.error('Crea un archivo .env en la raíz del proyecto con la clave `connectDBUsers` (ver .env.example)');
  console.error('Ej: connectDBUsers=mongodb+srv://usuario:password@cluster.mongodb.net/kuche_db?retryWrites=true&w=majority\n');
  // Salir con código 1 para que nodemon/dev muestre el error y no quede colgado
  process.exit(1);
}

export const connectDBClientes = mongoose.createConnection(process.env.connectDBUsers, {

});

// Verifica conexión participantes
connectDBClientes.on('connected', () => {
  console.log('Conectado a MongoDB Clientes');
});
connectDBClientes.on('error', (err) => {
  console.error('Error en conexión Clientes:', err);
});
