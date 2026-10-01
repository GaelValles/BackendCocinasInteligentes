import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const isServerless = Boolean(process.env.VERCEL);

const globalCache = globalThis;

export const getMongoUri = () => String(
  process.env.connectDBUsers
  || process.env.MONGODB_URI
  || process.env.MONGO_URI
  || ''
).trim();

const connectionOptions = {
  serverSelectionTimeoutMS: isServerless ? 15000 : 8000,
  socketTimeoutMS: isServerless ? 45000 : 20000,
  maxPoolSize: isServerless ? 5 : 10,
  minPoolSize: 0,
  bufferCommands: false
};

const getOrCreateConnection = () => {
  if (!globalCache.__mongooseClientesConnection) {
    const uri = getMongoUri();
    if (!uri) {
      if (!isServerless) {
        console.error('\n[FATAL] La variable de entorno `connectDBUsers` no está configurada.');
        console.error('Crea un archivo .env en la raíz del proyecto con la clave `connectDBUsers`');
        console.error('Ej: connectDBUsers=mongodb+srv://usuario:password@cluster.mongodb.net/kuche_db?retryWrites=true&w=majority\n');
        process.exit(1);
      }

      throw new Error('Variable connectDBUsers (o MONGODB_URI) no está configurada');
    }

    globalCache.__mongooseClientesConnection = mongoose.createConnection(uri, connectionOptions);

    globalCache.__mongooseClientesConnection.on('connected', () => {
      console.log('Conectado a MongoDB Clientes');
    });
    globalCache.__mongooseClientesConnection.on('error', (err) => {
      console.error('Error en conexión Clientes:', err);
    });
    globalCache.__mongooseClientesConnection.on('disconnected', () => {
      globalCache.__mongooseDbReadyPromise = null;
    });
  }

  return globalCache.__mongooseClientesConnection;
};

export const connectDBClientes = getOrCreateConnection();

let dbReadyPromise = null;

const connectOnce = async (connection) => {
  const uri = getMongoUri();
  if (!uri) {
    throw new Error('Variable connectDBUsers (o MONGODB_URI) no está configurada');
  }

  if (connection.readyState === 1) {
    return connection;
  }

  if (connection.readyState === 0) {
    await connection.openUri(uri, connectionOptions);
  } else if (connection.readyState === 2) {
    await connection.asPromise();
  } else {
    await connection.asPromise().catch(async () => {
      await connection.openUri(uri, connectionOptions);
    });
  }

  if (connection.readyState !== 1) {
    throw new Error('MongoDB no alcanzó estado connected');
  }

  return connection;
};

export const ensureDbConnection = async () => {
  const connection = getOrCreateConnection();

  if (connection.readyState === 1) {
    return connection;
  }

  if (!dbReadyPromise) {
    dbReadyPromise = globalCache.__mongooseDbReadyPromise = connectOnce(connection)
      .catch((error) => {
        dbReadyPromise = null;
        globalCache.__mongooseDbReadyPromise = null;
        throw error;
      })
      .then((conn) => {
        dbReadyPromise = null;
        globalCache.__mongooseDbReadyPromise = null;
        return conn;
      });
  }

  return dbReadyPromise;
};

// Reutilizar promesa en caliente entre invocaciones serverless
if (globalCache.__mongooseDbReadyPromise && !dbReadyPromise) {
  dbReadyPromise = globalCache.__mongooseDbReadyPromise;
}
