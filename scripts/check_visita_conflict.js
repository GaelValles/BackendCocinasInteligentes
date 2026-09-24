// Diagnóstico: revisa qué visitas existen cerca de una fecha dada
// Ejecutar: node scripts/check_visita_conflict.js "2026-09-28T18:00:00.000Z"
import '../src/db.js';
import { connectDBClientes, ensureDbConnection } from '../src/db.js';
import Visita from '../src/models/visita.model.js';

const target = process.argv[2] || '2026-09-28T18:00:00.000Z';
const fecha = new Date(target);
const bufferMs = 60 * 60 * 1000;

(async () => {
  await ensureDbConnection();

  const rango = {
    $gte: new Date(fecha.getTime() - bufferMs),
    $lte: new Date(fecha.getTime() + bufferMs)
  };

  const visitas = await Visita.find({ fechaProgramada: rango }).lean();

  console.log(`Fecha objetivo: ${fecha.toISOString()}`);
  console.log(`Rango de conflicto (+-1h): ${rango.$gte.toISOString()} .. ${rango.$lte.toISOString()}`);
  console.log(`Visitas encontradas en ese rango: ${visitas.length}`);
  visitas.forEach((v) => {
    console.log(`- id=${v._id} fecha=${new Date(v.fechaProgramada).toISOString()} estado=${v.estado} cliente=${v.nombreCliente}`);
  });

  await connectDBClientes.close();
  process.exit(0);
})().catch((err) => {
  console.error('Error en diagnóstico:', err);
  process.exit(1);
});
