# Requisitos Backend — Dashboard Admin (`/admin`)

Base URL configurada en `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Todos los endpoints requieren el header:
```
Authorization: Bearer <token>
Content-Type: application/json
```

El CORS del backend debe aceptar origen `http://localhost:3000`.

Todas las respuestas deben seguir este envelope:
```json
{ "success": true, "data": <payload> }
```
En caso de error:
```json
{ "success": false, "message": "Descripción del error" }
```

---

## Endpoint 1 — Obtener todas las citas

```
GET /api/citas/getAllCitas
```

### Respuesta esperada

```json
{
  "success": true,
  "data": [
    {
      "_id": "abc123",
      "fechaAgendada": "2026-03-16T10:00:00.000Z",
      "fechaInicio": "2026-03-16T10:00:00.000Z",
      "fechaTermino": null,
      "nombreCliente": "Juan Pérez",
      "correoCliente": "juan@example.com",
      "telefonoCliente": "5551234567",
      "ubicacion": "Col. Roma Norte",
      "informacionAdicional": "",
      "estado": "programada",
      "ingenieroAsignado": {
        "_id": "user123",
        "nombre": "Carlos López",
        "correo": "carlos@kuche.com",
        "telefono": "5559876543",
        "rol": "arquitecto"
      },
      "especificacionesInicio": {
        "medidas": "",
        "estilo": "",
        "especificaciones": "",
        "materialesPreferidos": []
      },
      "createdAt": "2026-03-01T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

### Notas
- `estado` puede ser: `"programada"` | `"en_proceso"` | `"completada"` | `"cancelada"`
- `ingenieroAsignado` puede ser el objeto populado **o** un string con el ID. Si no tiene asignado debe ser `null` o ausente.
- `fechaAgendada` debe ser ISO 8601. El frontend extrae la hora con `toLocaleTimeString` y la fecha con `.slice(0, 10)` para comparar con la fecha de hoy.

### Cómo se usa en el dashboard
| Campo | Uso |
|-------|-----|
| `fechaAgendada` | Mostrar en Agenda de Hoy (filtra por fecha de hoy) |
| `nombreCliente` | Nombre en la tarjeta de cita |
| `estado` | Color del punto y etiqueta del tipo de visita |
| `ingenieroAsignado` | Si es null → badge "Sin asignar" + cuenta en KPI "Citas sin asignar" |
| `ubicacion` | Se muestra bajo el nombre en la tarjeta |

---

## Endpoint 2 — Obtener catálogo de materiales

```
GET /api/catalogos/materiales
```

### Respuesta esperada

```json
{
  "success": true,
  "data": [
    {
      "_id": "mat001",
      "id": "mat001",
      "nombre": "Granito Negro Galaxy",
      "precioMetroLineal": 850.00,
      "descripcion": "Granito importado de Brasil",
      "activo": true
    },
    {
      "_id": "mat002",
      "id": "mat002",
      "nombre": "MDF Enchapado",
      "precioMetroLineal": 420.00,
      "descripcion": "Tablero MDF con enchapado de madera",
      "activo": true
    }
  ]
}
```

### Notas
- El dashboard solo necesita `data.length` para mostrar el contador "Total de materiales".
- El cotizador (`/dashboard/cotizador`) también consume este endpoint y sí usa todos los campos.

---

## Endpoint 3 — Kanban: etapa Citas

```
GET /api/kanban/citas
```

### Respuesta esperada

```json
{
  "success": true,
  "data": [
    {
      "_id": "tarea001",
      "titulo": "Levantamiento García",
      "etapa": "citas",
      "estado": "pendiente",
      "asignadoA": "user123",
      "asignadoANombre": "Carlos López",
      "proyecto": "proy001",
      "nombreProyecto": "Cocina García",
      "notas": "Cliente prefiere cita matutina",
      "archivos": [],
      "createdAt": "2026-03-01T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

---

## Endpoint 4 — Kanban: etapa Diseños

```
GET /api/kanban/disenos
```

Misma estructura que `/api/kanban/citas` con `"etapa": "disenos"`.

### Cómo se usa en el dashboard
- `estado === "pendiente"` → cuenta en KPI "Diseños por aprobar"
- Items con `etapa === "disenos"` y `estado === "pendiente"` aparecen en el panel "Requiere tu atención"

---

## Endpoint 5 — Kanban: etapa Cotización

```
GET /api/kanban/cotizacion
```

Misma estructura con `"etapa": "cotizacion"`.

---

## Endpoint 6 — Kanban: etapa Contrato/Seguimiento

```
GET /api/kanban/contrato
```

Misma estructura con `"etapa": "contrato"`.

---

## Fallback automático de Kanban

Si alguno de los 4 endpoints kanban (`/api/kanban/*`) no responde, el frontend automáticamente llama a:

```
GET /api/tareas?etapa=<citas|disenos|cotizacion|contrato>
```

con la misma estructura de respuesta. Si este también falla, el dashboard simplemente muestra `0` en los contadores afectados sin romper la página.

---

## Resumen de campos TypeScript

### `Cita`
```typescript
interface Cita {
  _id: string;
  fechaAgendada: string;           // ISO 8601
  fechaInicio?: string;
  fechaTermino?: string;
  nombreCliente: string;
  correoCliente: string;
  telefonoCliente: string;
  ubicacion?: string;
  informacionAdicional?: string;
  estado: 'programada' | 'en_proceso' | 'completada' | 'cancelada';
  ingenieroAsignado?: {
    _id: string;
    nombre: string;
    correo: string;
    telefono?: string;
    rol: string;
  } | string | null;
  especificacionesInicio: {
    medidas?: string;
    estilo?: string;
    especificaciones?: string;
    materialesPreferidos?: string[];
  };
  createdAt: string;
  updatedAt: string;
}
```

### `Material`
```typescript
interface Material {
  _id: string;
  id: string;
  nombre: string;
  precioMetroLineal: number;
  descripcion?: string;
  activo: boolean;
}
```

### `Tarea` (Kanban)
```typescript
interface Tarea {
  _id: string;
  titulo: string;
  etapa: 'citas' | 'disenos' | 'cotizacion' | 'contrato';
  estado: 'pendiente' | 'completada';
  asignadoA: string;           // ID del usuario
  asignadoANombre: string;     // Nombre populado
  proyecto: string;            // ID del proyecto
  nombreProyecto: string;      // Nombre populado
  notas?: string;
  archivos?: {
    id: string;
    nombre: string;
    tipo: 'pdf' | 'render' | 'otro';
    url?: string;
    createdAt?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Cómo probar que el backend responde correctamente

```bash
# 1. Citas
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/citas/getAllCitas

# 2. Materiales
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/catalogos/materiales

# 3. Kanban citas
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/kanban/citas

# 4. Kanban diseños
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/kanban/disenos

# 5. Kanban cotización
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/kanban/cotizacion

# 6. Kanban contrato
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/kanban/contrato
```

Cada uno debe devolver HTTP 200 con `{ "success": true, "data": [...] }`.
