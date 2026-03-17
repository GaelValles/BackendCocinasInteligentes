# Integración Frontend — Kanban / Citas

Este documento describe las rutas relevantes para mostrar y gestionar las "citas" desde el frontend (Kanban) y cómo se espera que el frontend haga las peticiones para que todo funcione.

**Archivo**: [src/docs/FRONTEND_KANBAN_INTEGRATION.md](src/docs/FRONTEND_KANBAN_INTEGRATION.md#L1)

**Respuesta estándar**
- Éxito: { success: true, data: ..., message?: '...' }
- Error:  { success: false, message: '...', error?: 'detalle' }

**Encabezados comunes**
- `Authorization`: `Bearer <token>` (para rutas protegidas)
- `Content-Type`: `application/json`
- `captcha-token`: (solo para `POST /api/citas` público al crear cita)

**Rutas principales (Kanban / Citas)**

- **GET /api/kanban/citas**
  - Auth: Requiere `Authorization` (el backend valida permisos según rol).
  - Query: opcional `?estado=` ó filtros simples.
  - Respuesta: `{ success: true, data: [ cards ] }` donde cada card tiene al menos:
    - `_id`, `title` (generado), `estado`, `fechaAgendada`, `cliente: { nombre, correo, telefono }`, `ingenieroAsignado` (objeto o null), `raw` (cita original opcional)
  - Uso: listar tarjetas por columna en Kanban (mapear `estado` a columna).

- **PUT /api/citas/:id/asignarIngeniero**
  - Auth: solo `admin`.
  - Body: `{ "ingenieroId": "<id>" }` — si se envía `null` o no se incluye, la asignación se remueve.
  - Respuesta: `{ success: true, data: { message, cita } }` con la `cita` actualizada (poblada con `ingenieroAsignado`).
  - Errores comunes: 400 (id inválido), 403 (no admin), 404 (cita o ingeniero no existe).

- **PUT /api/citas/:id/iniciar**
  - Auth: `admin` o `ingeniero`/`arquitecto` asignado.
  - Body opcional: `{ medidas?, estilo?, especificaciones?, materialesPreferidos? }`
  - Efecto: cambia `estado` -> `en_proceso`, set `fechaInicio`, agrega entrada en `historialEstados`.
  - Respuesta: `{ success: true, data: { message, cita } }`.
  - Errores: 400 si la cita no está en `programada`, 403 si usuario no asignado.

- **PUT /api/citas/:id/finalizar**
  - Auth: `admin` o `ingeniero`/`arquitecto` asignado.
  - Body opcional: `{ ingenieroId?, fechaEstimadaFinalizacion?, notasInternas? }`
  - Efecto: cambia `estado` -> `completada`, set `fechaTermino`, agrega `historialEstados` y crea `OrdenTrabajo` (respuesta incluye `ordenTrabajo` resumen).
  - Respuesta: `201 { success: true, data: { message, cita, ordenTrabajo } }`.

- **GET /api/citas/:id**
  - Auth: protegido; ingenieros solo pueden ver sus citas.
  - Respuesta: `{ success: true, data: cita }`.

- **GET /api/citas**
  - Lista todas las citas (paginación/filtrado puede aplicarse).
  - Respuesta: `{ success: true, data: [citas] }`.

- **GET /api/citas/availability?fecha=YYYY-MM-DD**
  - Ruta pública.
  - Respuesta: `{ success: true, fecha: 'YYYY-MM-DD', horariosOcupados: ['09:00','10:00'] }`.

- **POST /api/citas** (creación pública)
  - Headers: `captcha-token` requerido (reCAPTCHA token enviado por frontend)
  - Body ejemplo: `{ "fechaAgendada":"2026-03-20T10:00:00-06:00", "nombreCliente":"Ana", "correoCliente":"a@e.com", "telefonoCliente":"5512345678", "ubicacion":"CDMX", "diseno": "<idDesc>" }`
  - Validaciones: mínimo 1 hora de anticipación, sólo L-V, hora entre 9:00 y 18:00, buffer 1h entre citas.
  - Respuesta: `201 { success: true, data: cita }` o `400 { success: false, message, ... }`.

**Flujo recomendado para Frontend (Asignación y Kanban funcional)**

1. Mostrar columnas Kanban
   - Llamar `GET /api/kanban/citas` y mapear `card.estado` a columnas (ej: `programada`, `en_proceso`, `completada`, `cancelada`).
   - Renderizar `ingenieroAsignado?.nombre` o botón `Asignar` si null.

2. Asignar trabajador (acción admin)
   - UI: selector con lista de ingenieros (obtener desde `GET /api/usuarios?role=ingeniero` o desde backend existente).
   - Petición: `PUT /api/citas/:id/asignarIngeniero` con body `{ ingenieroId }`.
   - Tras éxito: reemplazar card con `data.cita` retornada y actualizar columna si cambió estado.

3. Iniciar trabajo (acción ingeniero asignado o admin)
   - UI: dentro de la tarjeta, botón `Iniciar` que abre modal para medidas/especificaciones.
   - Petición: `PUT /api/citas/:id/iniciar` con body de especificaciones.
   - Tras éxito: card cambia a `en_proceso`; backend actualiza `fechaInicio` y añade `historialEstados`.

4. Finalizar trabajo
   - UI: botón `Finalizar` (ingeniero/admin), opcionalmente solicitar `fechaEstimadaFinalizacion` y notas.
   - Petición: `PUT /api/citas/:id/finalizar`.
   - Tras éxito: backend crea `OrdenTrabajo` y devuelve resumen en `data.ordenTrabajo`. Card pasa a `completada`.

**Ejemplos (fetch)**

- Asignar ingeniero (admin):

```javascript
fetch('/api/citas/644d.../asignarIngeniero', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({ ingenieroId: '603a...' })
}).then(r=>r.json()).then(res => {
  if (res.success) updateCard(res.data.cita)
  else showError(res.message)
})
```

- Iniciar cita (ingeniero asignado):

```javascript
fetch('/api/citas/644d.../iniciar', {
  method: 'PUT',
  headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
  body: JSON.stringify({ medidas: '...', especificaciones: '...' })
}).then(r=>r.json()).then(res=>{ if(res.success) refreshCard(res.data.cita) })
```

- Finalizar cita:

```javascript
fetch('/api/citas/644d.../finalizar', {
  method: 'PUT',
  headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
  body: JSON.stringify({ notasInternas: 'Trabajo completado' })
}).then(r=>r.json()).then(res=>{ if(res.success) showOrder(res.data.ordenTrabajo) })
```

**Notas importantes para frontend**
- Respetar `Authorization` y roles: solo `admin` puede asignar; `ingeniero` solo puede iniciar/finalizar si está asignado.
- Después de cualquier mutación (assign/start/finish), refrescar la tarjeta individual (`GET /api/citas/:id`) o reconsultar la columna para mantener vista consistente.
- El backend guarda `historialEstados` en la cita: si quieres mostrar línea de tiempo, solicita `GET /api/citas/:id` y usa `cita.historialEstados`.
- Al crear cita desde formulario público, enviar `captcha-token` en headers como `captcha-token`.

---

Si quieres, agrego: una colección Thunder/Postman y ejemplos concretos con IDs de muestra. Puedo también incluir snippets en Axios/React si lo prefieres.