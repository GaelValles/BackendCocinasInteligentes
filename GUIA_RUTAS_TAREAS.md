# Guía de rutas de Tareas (`/api/tareas`)

Todas las rutas requieren header `Authorization: Bearer <token>` (middleware `authRequired`). Base path según `app.js`: `/api/tareas`.

Permisos generales:
- **admin / arquitecto** (`isStaff`): pueden ver y editar cualquier tarea.
- **ingeniero / empleado / empleado_general / staff** (`isOperativo`): solo pueden ver/editar tareas donde aparecen en `asignadoA`.
- Crear tarea, actualizar (PUT/PATCH `:id`), asignar trabajadores y eliminar: **solo rol `admin`** (o `isStaff` para eliminar).

---

## 1. `GET /api/tareas`
Lista tareas con filtros opcionales por query string.

**Query params (todos opcionales):**
| Param | Valores | Notas |
|---|---|---|
| `etapa` / `stage` | `citas`, `disenos`, `cotizacion`, `contrato` | |
| `estado` | `pendiente`, `completada` | |
| `asignadoA` | id de usuario (string) | Si no lo mandas y el usuario es operativo, se fuerza a su propio id |
| `proyecto` | id de proyecto | |
| `prioridad` | `alta`, `media`, `baja` | |
| `followUpStatus` / `seguimiento` / `estadoSeguimiento` | `pendiente`, `confirmado`, `inactivo` (`descartado` se normaliza a `inactivo`) | |

Respuesta: `{ success, data: Tarea[] }`.

## 2. `GET /api/tareas/:id`
Obtiene una tarea por id. 403 si el usuario operativo no está asignado a ella.

---

## 3. `POST /api/tareas` — Crear tarea (solo lectura del schema `crearTareaSchema`)
Body JSON esperado (todos opcionales salvo `etapa`):

```jsonc
{
  "etapa": "citas",                 // REQUERIDO: citas | disenos | cotizacion | contrato
  "estado": "pendiente",            // pendiente | completada (default pendiente)
  "asignadoA": ["<adminId>"],       // o assignedToIds / assignedTo. Acepta string o array de ids/nombres/correos
  "proyectoId": "<proyectoId>",     // o "proyecto"
  "nombreProyecto": "Cocina X",     // si no se manda, se resuelve del proyecto
  "fechaLimite": "2025-01-01",      // ISO date o null
  "scheduledAt": "2025-01-01",
  "visitScheduledAt": "2025-01-01",
  "ubicacion": "Calle 123",
  "mapsUrl": "https://maps...",
  "wallSpecs": [{ "...": "..." }],
  "wallCostEstimate": 1234,
  "notas": "texto libre",
  "prioridad": "media",             // alta | media | baja
  "followUpStatus": "pendiente",    // pendiente | confirmado | inactivo (alias: seguimiento, estadoSeguimiento)
  "followUpEnteredAt": 1234567890,  // timestamp ms
  "citaStarted": false,
  "citaFinished": false,
  "designApprovedByAdmin": false,
  "designApprovedByClient": false,
  "etapaActual": "Diseño Aprobado", // solo válido si followUpStatus === 'confirmado'. Valores: 'Diseño Aprobado','Materiales en Taller','Corte CNC','Ensamble','Instalación Final'
  "sourceType": "cita",             // cita | diseno (opcional, define origen de la tarea)
  "sourceId": "<id origen>",        // requerido si sourceType está presente
  "cita": {                         // solo se guarda si sourceType === 'cita'
    "fechaAgendada": "2025-01-01",
    "nombreCliente": "Juan",
    "correoCliente": "juan@mail.com",
    "telefonoCliente": "5512345678",
    "ubicacion": "Calle 123",
    "informacionAdicional": "..."
  },
  "cliente": { "nombre": "Juan", "correo": "juan@mail.com", "telefono": "5512345678" },
  "visita": {
    "fechaProgramada": "2025-01-01",
    "aprobadaPorAdmin": false,
    "aprobadaPorCliente": false
  },
  "pagos": {                        // solo si followUpStatus === 'confirmado' se puede usar inversion
    "anticipo": { "amount": 1000, "date": "2025-01-01", "receiptLabel": "Ver recibo", "receiptImage": "https://..." },
    "segundoPago": { "amount": 0 },
    "liquidacion": { "amount": 0 }
  },
  "inversion": 15000,               // o inversionTotal (deben coincidir si mandas ambos). Solo si followUpStatus === 'confirmado'
  "seguimientoNota": "texto"         // o notaSeguimiento (deben coincidir si mandas ambos)
}
```

Notas importantes:
- Si `sourceType` + `sourceId` ya existen en otra tarea → error 409 (no duplicar tareas por la misma cita/diseño).
- `asignadoA` puede recibir ids de Mongo, nombres o correos; el backend los resuelve contra la colección `Admin` (roles asignables: `admin, ingeniero, arquitecto, empleado, empleado_general, staff`, y `status: true`). Si no encuentra alguno, responde 404.
- `inversion`/`etapaActual` solo se guardan si `followUpStatus` resultante es `confirmado`; si no, error 400.

Respuesta: `201 { success, message, data: Tarea }`.

---

## 4. `PUT /api/tareas/:id` y `PATCH /api/tareas/:id` — Actualizar tarea (solo admin)
Mismo body que crear pero todos los campos opcionales (`actualizarTareaSchema`), y admite alias adicionales:
- `stage` (alias de `etapa`), `status` (alias de `estado`)
- `titulo` / `title` (alias de `nombreProyecto` si no se manda éste)
- `dueDate` (alias de `fechaLimite`), `location` (alias de `ubicacion`)
- `project` (alias de `proyecto`)

Reglas:
- Debe enviarse al menos un campo (si no, 400).
- Solo actualiza los campos presentes en el body (no se sobreescriben los que no llegan), **excepto** `visita`/`designApprovedByAdmin`/`designApprovedByClient`/`visitScheduledAt`, que siempre se recalculan juntos como un bloque.
- Mismas validaciones de enums, fechas, pagos, inversión y etapaActual que en creación.
- Cambiar `etapa` a `contrato` (si antes no lo era) reinicia el flujo de seguimiento (`followUpEnteredAt`, contadores de recordatorio).

Respuesta: `200 { success, message, data: Tarea }`.

---

## 5. `PATCH /api/tareas/:id/etapa` — Cambiar solo la etapa
Body:
```json
{ "etapa": "disenos" }
```
`etapa` requerido, uno de: `citas, disenos, cotizacion, contrato`. Permitido para admin/arquitecto o el operativo asignado a la tarea.

## 6. `PATCH /api/tareas/:id/estado` — Cambiar solo el estado
Body:
```json
{ "estado": "completada" }
```
`estado` requerido: `pendiente` | `completada`.

## 7. `PATCH /api/tareas/:id/notas` — Actualizar notas
Body:
```json
{ "notas": "texto libre" }
```
No usa schema de validación (acepta cualquier string, vacío permitido).

---

## 8. `PUT /api/tareas/:id/asignar-trabajadores` y `PATCH /api/tareas/:id/asignar-trabajadores` (solo admin)
Body:
```json
{ "asignadoA": ["<adminId1>", "<adminId2>"] }
```
- Acepta también `assignedToIds` o `assignedTo`.
- Debe tener al menos 1 elemento; si algún id/nombre/correo no resuelve a un usuario asignable, responde 404 con el detalle.
- Reemplaza completamente la lista de asignados (no hace merge).

---

## 9. `POST /api/tareas/:id/archivos` — Agregar archivos
Dos formas de uso:

### A) Subida real de archivo (multipart/form-data)
- Campo de archivo: `files` (puede mandar varios, usa `multer.array('files')`).
- Campo adicional opcional en el form: `tipo` (string) para forzar el tipo de archivo (ver tabla de tipos abajo).
- La tarea **debe tener `clienteId`** ya asignado (se genera automáticamente al crear la tarea si tiene datos de cliente); si no, responde 400.
- El backend decide el proveedor de almacenamiento (Dropbox o Cloudinary) según el tipo de archivo — no lo controla el frontend.

### B) JSON con archivos ya subidos externamente
Body:
```json
{
  "archivos": [
    {
      "nombre": "plano.pdf",
      "tipo": "cotizacion_formal",
      "url": "https://res.cloudinary.com/...",
      "key": "cloudinary:xxxx",
      "provider": "cloudinary",
      "mimeType": "application/pdf",
      "clienteId": "CLI-001"
    }
  ]
}
```
- `nombre` y `url` son requeridos (`url` debe ser absoluta http/https o ruta que empiece con `/`).
- `tipo`, `key`, `provider` (`dropbox|cloudinary|local`), `mimeType`, `clienteId`, `createdAt`, `id` son opcionales.
- Se debe mandar al menos 1 archivo en el arreglo.

**Tipos de archivo reconocidos (`tipo`)** — se normalizan automáticamente (minúsculas, sin acentos, guiones→_):
`levantamiento_detallado`, `diseno`, `cotizacion_formal`, `hoja_taller`, `recibo_1`, `recibo_2`, `recibo_3`, `contrato`, `fotos_proyecto`, `otro`.
- Los tipos de la lista anterior (excepto `fotos_proyecto` y `otro`) son de **slot único**: si subes otro archivo con el mismo `tipo`, reemplaza al anterior en vez de agregarse.
- Duplicados también se detectan por `key` o `url` iguales.

Efecto: además de guardarse en `tarea.archivos`, se sincroniza el archivo con `ClienteIdentidad.archivos` (si hay `clienteId`) y con `Proyecto.archivos` (si hay `proyectoId`).

---

## 10. `DELETE /api/tareas/:id` (solo admin/arquitecto)
Elimina la tarea definitivamente. Sin body.

---

## Campos de solo lectura (no se envían, los calcula el backend)
Al leer una tarea (`GET`), la respuesta incluye campos calculados que **no debes enviar al crear/actualizar**:
- `asignadoANombre`, `assignedToIds`, `assignedTo` (derivados de `asignadoA`)
- `cliente` (objeto con `_id`, `clienteId`, `codigo`, `nombre`, `correo`, `telefono`) y `clienteId`/`clientId`/`codigoCliente`/`codigo` (se generan automáticamente al guardar, vía `ClienteIdentidad`)
- `archivosPorTipo` (mapa `tipo -> archivo`)
- `totalPagado`, `saldoPendiente` (calculados desde `pagos` e `inversion`)
- `historialCambios` (bitácora interna, no editable directamente)
- `createdAt`, `updatedAt`

## Resumen rápido de flujo recomendado desde frontend
1. Crear tarea con `POST /api/tareas` (etapa mínima requerida).
2. Editar campos generales con `PUT`/`PATCH /:id`.
3. Mover de etapa con `PATCH /:id/etapa` (o incluirlo en el PATCH general).
4. Marcar completada/pendiente con `PATCH /:id/estado`.
5. Reasignar responsables con `PATCH /:id/asignar-trabajadores` (solo admin).
6. Subir archivos con `POST /:id/archivos` (multipart si es archivo real, JSON si ya tienes la URL).
7. Actualizar solo notas rápidas con `PATCH /:id/notas`.
