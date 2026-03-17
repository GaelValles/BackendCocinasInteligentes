// Script de prueba para endpoints de citas
// Ejecutar: node scripts/test_citas.js

const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

function formatYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

(async () => {
  try {
    // Preparar fecha: ahora + 2 horas (minutos a 0)
    const fecha = new Date(Date.now() + 2 * 60 * 60 * 1000);
    fecha.setMinutes(0, 0, 0);
    const iso = fecha.toISOString();
    const fechaQuery = formatYYYYMMDD(fecha);

    console.log('Base URL:', baseUrl);
    console.log('Probando GET /api/citas/disponibilidad?fecha=' + fechaQuery);

    const getRes = await fetch(`${baseUrl}/api/citas/disponibilidad?fecha=${fechaQuery}`);
    const getBody = await getRes.json().catch(() => ({}));
    console.log('GET respuesta status:', getRes.status);
    console.log(JSON.stringify(getBody, null, 2));

    // Para crear la cita garantizamos al menos 1 día adelante para no chocar con la validación de 1 hora
    const fechaTomorrow = new Date();
    fechaTomorrow.setDate(fechaTomorrow.getDate() + 1);
    const fechaTomorrowQuery = formatYYYYMMDD(fechaTomorrow);

    console.log('Consultando disponibilidad para la fecha de prueba (mañana):', fechaTomorrowQuery);
    const getResTomorrow = await fetch(`${baseUrl}/api/citas/disponibilidad?fecha=${fechaTomorrowQuery}`);
    const getBodyTomorrow = await getResTomorrow.json().catch(() => ({}));

    const ocupados = Array.isArray(getBodyTomorrow.horariosOcupados) ? getBodyTomorrow.horariosOcupados : [];
    const candidatos = ['09:00','10:00','11:00','13:00','14:00','15:00','16:00'];
    const disponible = candidatos.find(h => !ocupados.includes(h));

    if (!disponible) {
      console.log('No se encontró hora disponible en candidatos para mañana, abortando POST.');
      return;
    }

    // Construir ISO usando offset de Mexico City (-06:00). Ajustar si tu zona difiere.
    const isoLocal = `${fechaTomorrowQuery}T${disponible}:00-06:00`;
    const payload = {
      fechaAgendada: isoLocal,
      nombreCliente: 'Test Usuario',
      correoCliente: 'test+api@example.com',
      telefonoCliente: '+52 0000000000',
      ubicacion: 'Prueba Ciudad',
      informacionAdicional: `Horario solicitado: ${disponible}`
    };

    console.log('\nIntentando POST /api/citas/agregarCita con hora disponible:', disponible);

    const postRes = await fetch(`${baseUrl}/api/citas/agregarCita`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'captcha-token': 'test-token'
      },
      body: JSON.stringify(payload)
    });

    const postBody = await postRes.json().catch(() => ({}));
    console.log('POST respuesta status:', postRes.status);
    console.log(JSON.stringify(postBody, null, 2));

  } catch (error) {
    console.error('Error en script de pruebas:', error);
  }
})();
