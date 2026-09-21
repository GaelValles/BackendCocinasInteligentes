# Contrato Backend requerido: Estatus público de seguimiento

## Diagnóstico frontend

El portal `/seguimiento` autentica al cliente con:

```http
POST /api/seguimiento/login
```

También tolera estos aliases de autenticación:

```http
POST /api/seguimiento/auth
POST /api/seguimiento/access
```

La respuesta debe contener el proyecto completo en `data.project` o, como mínimo, una respuesta equivalente normalizable a:

```json
{
  "success": true,
  "data": {
    "token": "token-publico",
    "expiresAt": "2026-10-01T00:00:00.000Z",
    "project": {}
  }
}
```

El proyecto no puede ser un objeto vacío. Debe traer los datos que el cliente ya tiene guardados en backend: código, nombre, estado, etapa, cotizaciones, levantamientos y archivos.

## 1. Campos mínimos de `data.project`

```json
{
  "codigo": "K-4F7QZ",
  "cliente": "Juan Perez",
  "nombre": "Juan Perez",
  "titulo": "Cocina residencial",
  "isProspect": false,
  "kanbanStage": "contrato",
  "kanbanFollowUpStatus": "confirmado",
  "estadoProyecto": "Cliente confirmado",
  "etapaActual": "Diseño Aprobado",
  "inversion": 250000,
  "fechaInicio": "2026-09-01",
  "fechaEntrega": "2026-12-01",
  "garantiaInicio": "",
  "pagos": {
    "anticipo": { "amount": 125000, "date": "", "receiptImage": "" },
    "segundoPago": { "amount": 62500, "date": "", "receiptImage": "" },
    "liquidacion": { "amount": 62500, "date": "", "receiptImage": "" }
  },
  "archivos": [],
  "cotizacionesFormales": [],
  "preliminarCotizaciones": []
}
```

Los nombres de cotización aceptados por el frontend son `cotizacionFormalData`, `cotizacionesFormales`, `preliminarData` y `preliminarCotizaciones`.

Los documentos pueden llegar embebidos en `project.archivos`, pero el frontend también los consulta por las rutas de archivos del cliente y los incorpora a la vista.

## 2. Cómo se determina confirmado vs prospecto

El frontend considera confirmado si se cumple una de estas condiciones:

```text
kanbanFollowUpStatus = confirmado
```

O bien:

```text
kanbanStage = contrato y kanbanFollowUpStatus != descartado
```

Para que un cliente confirmado vea el dashboard completo, el backend debe enviar `kanbanStage` y `kanbanFollowUpStatus`, o enviar `isProspect: false` de forma confiable.

No se debe derivar el estado solo por tener archivos o una cotización.

## 3. Rutas de lectura de archivos

El frontend consulta, con autenticación de la sesión pública o token disponible:

```http
GET /api/archivos/cliente/:clienteId
GET /api/archivos/clientes/:clienteId
GET /api/archivos/tarea/:tareaId
GET /api/archivos/panel/:codigo
```

Las rutas deben devolver una de estas formas equivalentes:

```json
{ "success": true, "data": [ ... ] }
```

```json
{ "success": true, "archivos": [ ... ] }
```

Cada archivo debe incluir:

```json
{
  "id": "archivo-id",
  "_id": "archivo-id",
  "nombre": "cotizacion-formal.pdf",
  "tipo": "cotizacion_formal",
  "url": "https://res.cloudinary.com/...",
  "key": "cloudinary:public-id",
  "provider": "cloudinary",
  "mimeType": "application/pdf",
  "clienteId": "4F7QZ",
  "createdAt": "2026-09-21T12:00:00.000Z"
}
```

El backend debe normalizar códigos con y sin prefijo `K-`: `K-4F7QZ` y `4F7QZ` deben encontrar el mismo cliente.

## 4. Persistencia del estatus público

El backend expone una ruta protegida para que el modal administrativo guarde cambios:

Ruta recomendada:

```http
PATCH /api/seguimiento/proyectos/:codigo
```

Alternativa si el recurso se identifica por tarea:

```http
PATCH /api/tareas/:id/estatus-publico
```

Body recomendado:

```json
{
  "estadoProyecto": "Cliente confirmado",
  "etapaActual": "Materiales en Taller",
  "fechaInicio": "2026-09-01",
  "fechaEntrega": "2026-12-01",
  "garantiaInicio": "",
  "inversion": 250000,
  "pagos": {
    "anticipo": { "amount": 125000, "date": "", "receiptImage": "" },
    "segundoPago": { "amount": 62500, "date": "", "receiptImage": "" },
    "liquidacion": { "amount": 62500, "date": "", "receiptImage": "" }
  },
  "archivos": []
}
```

La ruta requiere el JWT administrativo normal (`Authorization: Bearer <token>` o cookie de sesión) y acepta los roles `admin`, `arquitecto`, `empleado`, `empleado_general`, `ingeniero` y `staff`.

La respuesta es:

```json
{
  "success": true,
  "message": "Estatus público actualizado",
  "data": { "project": { ...proyectoActualizado } }
}
```

El código puede enviarse con o sin prefijo `K-`; el backend lo normaliza. El frontend no debe enviar `CRON_SECRET`, secretos SMTP ni secretos de Cloudinary.

El login público también devuelve estos aliases para que el frontend no tenga que transformar el snapshot:

```json
{
  "nombre": "Juan Perez",
  "titulo": "Cocina residencial",
  "kanbanStage": "contrato",
  "kanbanFollowUpStatus": "confirmado",
  "cotizacionesFormales": [],
  "cotizacionFormalData": [],
  "preliminarCotizaciones": [],
  "preliminarData": []
}
```

La persistencia actualiza el proyecto (`estado`, `timelineActual`, `presupuestoTotal`, `pagos`, `seguimientoNota`) y la tarea más reciente (`etapaActual`, `seguimientoNota` y `followUpStatus` cuando el estado es `Cliente confirmado`).

## 5. Corrección aplicada en frontend

- `src/app/seguimiento/page.tsx`: los archivos remotos cargados ya se aplican al estado de proyecto; antes se calculaba un objeto nuevo dentro de `useMemo` pero se descartaba.
- `src/components/admin/PublicStatusEditorModal.tsx`: al abrir, intenta cargar el proyecto real usando `POST /api/seguimiento/login` con el código del cliente; antes `reload()` siempre dejaba el formulario vacío y mostraba “No hay datos guardados”.

## 6. Información que backend debe entregar

Para cerrar completamente el flujo, backend debe confirmar:

1. La forma exacta de la respuesta de `POST /api/seguimiento/login`.
2. Si `data.project` se construye desde `Tarea`, `ClienteIdentidad`, `Proyecto` o una combinación.
3. La ruta exacta para guardar `estadoProyecto`, `etapaActual`, pagos y archivos desde el modal administrativo.
4. Si el código se recibe con `K-` o sin `K-`, y cómo se normaliza.
5. Qué endpoint devuelve las cotizaciones preliminares/formales asociadas al proyecto cuando no están dentro de `data.project`.
6. Si los PDFs se consideran archivos remotos por `GET /api/archivos/cliente/:clienteId` o deben venir en otra relación.
