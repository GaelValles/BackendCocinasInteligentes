Resumen corto

He detectado que la razón por la cual el frontend no mostraba tareas en la columna "Citas / Diseños / Cotización / Seguimiento" era de modelo de datos: en la base de datos no existen registros homogéneos de `Tarea`. Los datos reales están organizados por colecciones de dominio (por ejemplo `Citas`, `Disenos`, `Cotizacion`, etc.). El frontend esperaba leer una única colección `tareas` para poblar las columnas del Kanban.

Qué hice ahora

- Añadí soporte puntual para "citas": cuando el frontend pide `GET /api/tareas?etapa=citas` el backend ahora consulta la colección `Citas`, aplica permisos (cliente ve sus citas; ingeniero las asignadas) y devuelve objetos mapeados en el formato que el frontend usa para una `tarea`.
- Protegí modelos Mongoose contra recompilación (OverwriteModelError) para que el servidor arranque establemente.
- Documenté cómo usar el endpoint y ejemplos de respuesta para que el frontend pueda mostrar la columna `citas` sin cambiar su código de Kanban.

Cómo solicitar las citas desde el frontend

- Endpoint:
  GET /api/tareas?etapa=citas

- Headers comunes: `Authorization: Bearer <token>` (si aplica)

- Respuesta (ejemplo):
  {
    "success": true,
    "message": "Citas obtenidas exitosamente",
    "data": [
      {
        "_id": "69b34db14db91b2bb7e790e9",
        "titulo": "Cita: Test Usuario - 2026-03-13T15:00:00.000Z",
        "etapa": "citas",
        "estado": "programada",
        "asignadoA": null,
        "asignadoANombre": null,
        "proyecto": null,
        "nombreProyecto": "",
        "notas": "Horario solicitado: 09:00",
        "archivos": [],
        "fechaAgendada": "2026-03-13T15:00:00.000Z",
        "nombreCliente": "Test Usuario",
        "correoCliente": "test+api@example.com",
        "telefonoCliente": "+52 0000000000",
        "createdAt": "2026-03-12T23:35:13.157Z"
      }
    ]
  }

Limitaciones actuales

- Implementé solo `etapa=citas`. Las otras etapas (`disenos`, `cotizacion`, `contrato`/seguimiento) todavía no están mapeadas; si el frontend pide `?etapa=disenos` seguirá buscando en la colección `Tarea` y puede devolver vacío.
- La conversión es solo de lectura: acciones específicas relacionadas con un dominio (p.ej. mover una cita para cambiar fecha) deben implementarse en sus endpoints del dominio (p.ej. `/api/citas/*`) o el backend debe implementar lógica de escritura/mapeo adicional para reflejar cambios en la colección original.

Opciones de diseño (recomendación)

Opción A — Mapear en backend (lo que empecé)
- Qué: mantener colecciones de dominio (Citas, Disenos, Cotizacion, Seguimiento) y en el backend crear mapeos que respondan a `/api/tareas?etapa=...` unificando la vista.
- Pros: no duplicas datos, modelo de dominio queda intacto, menor riesgo de inconsistencia si cada recurso evoluciona diferente.
- Contras: el backend debe implementar y mantener los mapeos por cada tipo; las operaciones de escritura en Kanban (p. ej. mover tarjeta) pueden requerir traducción a operaciones sobre la entidad de dominio correspondiente.
- Cuando usar: equipo backend puede mantener estos adaptadores y el número de tipos es pequeño.

Opción B — Crear/usar una colección `Tarea` como índice (sinónimo único)
- Qué: crear (o poblar) una colección `Tarea` que represente cada elemento del Kanban (una fila por cita, por diseño, por cotización). Mantenerla sincronizada (crear/actualizar/eliminar) desde los eventos/domains que cambian (webhooks, hooks en controladores, triggers en DB o jobs en background).
- Pros: frontend consulta una sola colección, operaciones de Kanban (mover tarjeta, actualizar notas, adjuntar archivos) son uniformes y simples; rendimiento de lectura más directo.
- Contras: duplicación de datos → riesgo de inconsistencias si no sincronizas correctamente; necesitas lógica adicional para crear/actualizar/eliminar `Tarea` al cambiar la entidad de origen.
- Cuando usar: si el frontend exige simplicidad y latencia baja en la vista Kanban, y se dispone a mantener la sincronización (recomendado para productos con UI compleja y altas exigencias de UX).

Mi recomendación práctica

- Si prefieres avanzar rápido y no introducir duplicación ahora: continuar con el enfoque de mapeo por backend (Opción A). Yo puedo implementar los mapeos para `disenos`, `cotizacion` y `contrato` de forma similar a `citas`.
- Si el equipo quiere una solución a largo plazo, consistente y de bajo fricción para el frontend (mejor UX y consultas simples), implementar la colección `Tarea` (Opción B) y sincronizar desde los controladores/servicios sería mejor.

Siguientes pasos que puedo hacer ahora

- (Rápido) Implementar mapeos para `disenos`, `cotizacion`, `contrato` y dejar `GET /api/tareas?etapa=<x>` funcional para todas las columnas.
- (Medio) Añadir endpoints write-through: cuando el frontend mueva una tarjeta, traducir esa acción a la entidad de dominio correcta.
- (Completo) Implementar la colección `Tarea` y un mecanismo de sincronización (hooks en controladores o jobs) para mantenerla actualizada.

Dónde está la documentación

- Archivo creado: [src/docs/FRONTEND_TAREAS_EXPLICACION.md](src/docs/FRONTEND_TAREAS_EXPLICACION.md#L1)

¿Quieres que implemente los mapeos para las otras etapas (`disenos`, `cotizacion`, `contrato`) ahora (opción A), o prefieres que prepare la migración/sincronización hacia una colección `Tarea` (opción B)? Indica preferencia y procedo.