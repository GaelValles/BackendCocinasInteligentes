# Integración de edición y asignación de tareas

## Resumen
El backend expone una sola operación para editar una tarea y asignar trabajadores en el mismo request.

Solo un usuario con rol `admin` puede usar este flujo.

## Endpoint
```http
PUT /api/tareas/:id
```

También acepta `PATCH /api/tareas/:id`.

## Autenticación
Enviar token en `Authorization`:
```http
Authorization: Bearer <TOKEN>
```

## Reglas
- Solo `admin` puede editar.
- El payload puede incluir datos de edición de la tarea y asignación de trabajadores en la misma petición.
- Si se envía `asignadoA`, `assignedToIds` o `assignedTo`, el backend reemplaza la asignación actual por los IDs recibidos.
- Si no se envían campos, el backend responde `400`.

## Campos que acepta
### Edición general
- `etapa`
- `estado`
- `notas`
- `prioridad`
- `followUpStatus`
- `seguimiento`
- `estadoSeguimiento`
- `followUpEnteredAt`
- `citaStarted`
- `citaFinished`
- `designApprovedByAdmin`
- `designApprovedByClient`
- `sourceType`
- `sourceId`
- `sourceCitaId`
- `sourceDisenoId`
- `cita`
- `cliente`
- `nombreCliente`
- `correoCliente`
- `telefonoCliente`
- `nombreProyecto`
- `fechaLimite`
- `scheduledAt`
- `visitScheduledAt`
- `ubicacion`
- `mapsUrl`
- `wallSpecs`
- `wallCostEstimate`
- `proyecto`
- `proyectoId`
- `pagos`
- `seguimientoNota`
- `notaSeguimiento`

### Asignación de trabajadores
- `asignadoA`: array de IDs o un solo ID
- `assignedToIds`: alias de `asignadoA`
- `assignedTo`: alias de `asignadoA`

## Ejemplo de request
```javascript
async function editarTareaYAsignarTrabajadores(tareaId, token, datos) {
  const payload = {
    etapa: datos.etapa,
    estado: datos.estado,
    notas: datos.notas,
    prioridad: datos.prioridad,
    asignadoA: datos.trabajadoresIds,
    ubicacion: datos.ubicacion,
    proyectoId: datos.proyectoId
  };

  const response = await fetch(`${API_URL}/api/tareas/${tareaId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'No se pudo actualizar la tarea');
  return result.data;
}
```

## Ejemplo de payload
```json
{
  "etapa": "citas",
  "estado": "pendiente",
  "notas": "Actualizar datos de la tarjeta",
  "prioridad": "media",
  "asignadoA": ["66a111111111111111111111", "66b222222222222222222222"],
  "ubicacion": "Monterrey",
  "proyectoId": "66c333333333333333333333"
}
```

## Respuesta exitosa
```json
{
  "success": true,
  "message": "Tarea actualizada exitosamente",
  "data": {
    "id": "...",
    "asignadoA": ["..."],
    "asignadoANombre": ["..."]
  }
}
```

## Errores comunes
- `403`: solo un admin puede editar tareas.
- `400`: ID inválido o payload vacío.
- `404`: tarea no encontrada o algún trabajador no existe.
