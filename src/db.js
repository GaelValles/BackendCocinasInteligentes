import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ quiet: true }); // Carga variables de entorno sin ruido en logs
// Validar que la variable de entorno exista y dar un mensaje claro si falta
if (!process.env.connectDBUsers) {
  console.error('\n[FATAL] La variable de entorno `connectDBUsers` no está configurada.');
  console.error('Crea un archivo .env en la raíz del proyecto con la clave `connectDBUsers` (ver .env.example)');
  console.error('Ej: connectDBUsers=mongodb+srv://usuario:password@cluster.mongodb.net/kuche_db?retryWrites=true&w=majority\n');
  // Salir con código 1 para que nodemon/dev muestre el error y no quede colgado
  process.exit(1);
}

export const connectDBClientes = mongoose.createConnection(process.env.connectDBUsers, {
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 20000,
  maxPoolSize: 10,
  minPoolSize: 0
});

let dbReadyPromise = null;

export const ensureDbConnection = async () => {
  if (connectDBClientes.readyState === 1) return connectDBClientes;

  if (!dbReadyPromise) {
    dbReadyPromise = connectDBClientes.asPromise()
      .then(() => connectDBClientes)
      .catch((error) => {
        dbReadyPromise = null;
        throw error;
      });
  }

  return dbReadyPromise;
};

// Verifica conexión participantes
connectDBClientes.on('connected', () => {
  console.log('Conectado a MongoDB Clientes');
});
connectDBClientes.on('error', (err) => {
  console.error('Error en conexión Clientes:', err);
});
