Resumen de requisiciones que necesitamos del frontend

Objetivo
- Listado claro de endpoints, headers, y payloads que el frontend debe usar para integrar el Kanban/dashboard y flujos de citas.

Encabezados obligatorios
- `Authorization`: Bearer <token> (para rutas protegidas)
- `Content-Type`: application/json
- `captcha-token`: token reCAPTCHA (header requerido por creación de citas)

CORS
- Backend acepta solicitudes desde: http://localhost:3000 y http://localhost:5173
- Asegúrate de que las peticiones incluyan `Origin` y envíen las credenciales si aplican.

Formato de respuesta esperado
- Envelope JSON: { success: true, data: ... } o { success: false, message: '...', error?: ... }

Endpoints principales (mapeo y ejemplos)

1) Kanban - columnas
- GET /api/kanban/citas
  - Retorna lista de items formateados para columna `citas`.
- GET /api/kanban/disenos
- GET /api/kanban/cotizacion
- GET /api/kanban/contrato

2) Tareas (endpoint de integración principal para el Kanban)
- GET /api/tareas?etapa=citas
  - Devuelve las `citas` mapeadas al formato de tareas.
- GET /api/tareas
- GET /api/tareas/:id
- POST /api/tareas
- PUT /api/tareas/:id
- PATCH /api/tareas/:id
  - Nota: el backend acepta PATCH y PUT; si el id corresponde a una `Cita`, el backend hará fallback y actualizará la `Cita`.
- PATCH /api/tareas/:id/etapa
  - Soporta drag & drop; si `id` es de una `Cita`, actualiza la cita.
- PATCH /api/tareas/:id/estado
  - Cambia estado (pendiente/completada). Ahora soporta fallback: si `id` es de `Cita`, actualizará la cita.

Payloads de ejemplo
- Actualizar estado (PATCH o PUT):
  - URL: /api/tareas/:id
  - Body: { "estado": "completada" }
- Cambiar etapa (drag):
  - URL: /api/tareas/:id/etapa
  - Body: { "etapa": "disenos" }
- Asignar trabajador (desde tareas endpoint):
  - URL: /api/tareas/:id
  - Body: { "asignadoA": "<userId>" }
  - Si `id` es una `Cita`, el backend actualizará `ingenieroAsignado` de la cita.

Flujos de Citas (endpoints directos)
- POST /api/citas  (requiere header `captcha-token`)
- GET /api/citas (listado)
- GET /api/citas/:id
- PATCH /api/citas/:id/asignar  (o ruta equivalente: /api/citas/:id con body asignado)
- POST /api/citas/:id/iniciar  (o PUT/PATCH /api/citas/:id con estado 'en_proceso')
- POST /api/citas/:id/finalizar

Contratos y Catálogos
- GET /api/catalogos/materiales  -> mapea a { _id, id, nombre, precioMetroLineal/Unitario, descripcion, activo }
- GET /api/catalogos/herrajes

Comportamiento esperado del frontend
- En Kanban: cuando se arrastra/solta, frontend debe llamar a PATCH /api/tareas/:id/etapa (o PUT /api/tareas/:id) con el nuevo `etapa`.
- Cuando cambia estado (check/completed), frontend puede llamar a PATCH /api/tareas/:id/estado o PATCH /api/tareas/:id con { estado }.
- En todos los write requests, si el backend responde con 401/403, mostrar diálogo de login/permisos; si responde 404 mostrar "Tarea no encontrada".

Notas operativas para el equipo frontend
- Enviar `asignadoA` como array o string; backend maneja ambos formatos.
  - También se acepta un objeto `{ _id: "<userId>" }` o un array de objetos.
- Para evitar errores por JSON malformado en Windows/curl, usar bibliotecas HTTP (fetch/axios) en el frontend.
- Si el frontend envía operaciones hacia ids que son `Cita` y el endpoint es `/api/tareas`, el backend ya soporta fallback (actualiza Cita y devuelve objeto con la forma de tarea para UI).

Solicitudes que el frontend debe confirmar/entregar
- Confirmar si usará `PATCH /api/tareas/:id/estado` o `PATCH /api/tareas/:id` cuando marca completada una tarea.
- Enviar un ejemplo de payload de asignación y arrastre que usen en producción.
  - Ejemplo `POST /api/tareas` payload:
    ```json
    {
      "titulo": "Tarea ejemplo",
      "etapa": "citas",
      "estado": "pendiente",
      "asignadoA": "6997ecffc5f0b9b61a04f3fb",
      "proyecto": null,
      "notas": "Notas"
    }
    ```
  - Ejemplo con array: `"asignadoA": ["6997ecffc5f0b9b61a04f3fb"]`
  - Ejemplo con objeto: `"asignadoA": { "_id": "6997ecffc5f0b9b61a04f3fb" }`
- Confirmar dominio/origenes de desarrollo para CORS (si hay más hosts).

Contacto
- Si necesitan ajustes, indicar el endpoint y ejemplo de request fallido (método, URL, headers, body) para reproducir localmente.
