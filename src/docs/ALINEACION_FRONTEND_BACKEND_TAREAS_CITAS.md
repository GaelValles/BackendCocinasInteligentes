# Alineación Frontend ↔ Backend — Dashboard Empleado (Tareas/Citas)

Fecha: 2026-03-13

## 1) Diagnóstico del error de consola actual

El error que aparece al correr `npm run dev` **no era de integración API**:

- Error: `Unable to acquire lock ... .next/dev/lock`
- Causa: había otra instancia de `next dev` viva (`PID 6924`) bloqueando el lock.
- Estado actual: frontend levanta bien en `http://localhost:3000`.

Conclusión: este error en particular corresponde al **entorno local frontend** (proceso duplicado), no al backend.

---

## 2) Qué sí puede seguir fallando por contrato front/back

Aunque el frontend ya compila y corre, hay puntos de desalineación de datos que pueden causar tarjetas vacías o updates fallidos.

### 2.1 Filtro de columna

- Frontend manda: `GET /api/tareas?etapa=citas`.
- Si backend espera `stage` en lugar de `etapa`, puede devolver vacío.

Regla acordada: soportar **`etapa`** como canonical y opcionalmente aceptar `stage` por compatibilidad.

### 2.2 Estados de `citas` vs estados de `tareas`

- En `Tarea` (kanban general): frontend usa `pendiente | completada`.
- En dominio `Cita`: backend puede manejar `programada | en_proceso | completada | cancelada`.

Impacto:
- Si backend responde estado `programada`, el frontend lo normaliza a `pendiente` para UI.
- Si frontend hace `PATCH /api/tareas/:id/estado` con `pendiente`, backend puede rechazar si ese registro realmente vive en dominio `Cita` y no admite ese valor.

### 2.3 Campos de asignación/proyecto

Frontend renderiza con nombres visibles:

- `asignadoANombre`
- `nombreProyecto`

Si backend solo manda IDs (`asignadoA`, `proyecto`) sin nombres, la UI mostrará `Sin asignar` / `General`.

---

## 3) Contrato de nombres recomendado (canónico)

## 3.1 Respuesta de listado

Ruta:

- `GET /api/tareas?etapa=<citas|disenos|cotizacion|contrato>`

Formato:

```json
{
  "success": true,
  "data": [
    {
      "_id": "string",
      "titulo": "string",
      "etapa": "citas|disenos|cotizacion|contrato",
      "estado": "pendiente|completada",
      "asignadoA": "string|null",
      "asignadoANombre": "string|null",
      "proyecto": "string|null",
      "nombreProyecto": "string|null",
      "notas": "string",
      "archivos": [
        { "id": "string", "nombre": "string", "tipo": "pdf|render|otro", "url": "string" }
      ],
      "createdAt": "ISO",
      "updatedAt": "ISO"
    }
  ],
  "message": "string"
}
```

## 3.2 Endpoints de mutación

- `PATCH /api/tareas/:id/etapa` body `{ "etapa": "..." }`
- `PATCH /api/tareas/:id/estado` body `{ "estado": "pendiente|completada" }`
- `POST /api/tareas/:id/archivos` body `{ "archivos": [{ "nombre": "...", "tipo": "...", "url": "..." }] }`

---

## 4) Tabla de mapeo exacta frontend/backend

| Frontend usa | Backend debe enviar | Obligatorio | Nota |
|---|---|---|---|
| `id` tarjeta | `_id` | Sí | Identificador único |
| `title` | `titulo` | Sí | Texto principal |
| `stage` | `etapa` | Sí | Columna kanban |
| `status` | `estado` | Sí | Estado de tarjeta |
| `assignedTo` | `asignadoANombre` | Recomendado | Si falta, frontend muestra “Sin asignar” |
| `assignedToId` | `asignadoA` | Recomendado | Necesario para filtro "mine" robusto |
| `project` | `nombreProyecto` | Recomendado | Si falta, frontend muestra “General” |
| `notes` | `notas` | Opcional | |
| `files[].name` | `archivos[].nombre` | Opcional | |
| `files[].type` | `archivos[].tipo` | Opcional | `pdf|render|otro` |

---

## 5) Ownership: ¿frontend o backend?

## 5.1 Frontend

- Normalizar variaciones de texto (`diseños`, `cotización`, `seguimiento`) a etapas canónicas.
- Mostrar fallback visual cuando nombres no vengan poblados.
- Enviar `etapa` en filtros y mutaciones.

## 5.2 Backend

- Garantizar que `GET /api/tareas?etapa=citas` devuelva datos reales mapeados.
- Definir si `PATCH /api/tareas/:id/estado` acepta solo `pendiente|completada` o traduce desde dominios como `citas`.
- Poblar `asignadoANombre` y `nombreProyecto` cuando existan relaciones.
- Mantener envelope consistente `{ success, data, message }`.

---

## 6) Checklist de verificación rápida (ambos equipos)

- [ ] `npm run dev` levanta sin lock local.
- [ ] `GET /api/tareas?etapa=citas` devuelve al menos 1 elemento real.
- [ ] Cada item trae `_id`, `titulo`, `etapa`, `estado`.
- [ ] Al mover tarjeta: `PATCH /etapa` responde `success: true`.
- [ ] Al marcar completada: `PATCH /estado` responde `success: true`.
- [ ] Si se usa vista “Mis tareas”, llega `asignadoA` o `asignadoANombre` coherente.

---

## 7) Nota de transición recomendada

Mientras backend completa `disenos`, `cotizacion` y `contrato`, mantener activo el flujo por etapas empezando con `citas` y escalar columna por columna, evitando asumir que todas las etapas ya están mapeadas.
