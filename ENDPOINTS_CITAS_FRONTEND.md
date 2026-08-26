# Documentación de endpoints de citas para frontend

Este documento reúne los endpoints del backend que el frontend puede usar para agendar, consultar y mostrar información del módulo de citas.

Base URL esperada:
- Desarrollo local: http://localhost:3000/api/citas
- O en el entorno deployado: <TU_BACKEND>/api/citas

## 1. Endpoints recomendados para agendar citas

### 1.1 Crear o agendar cita
- Método: POST
- Ruta: /api/citas/agregarCita
- Autenticación: pública (no requiere login)
- Headers obligatorios:
  - `Content-Type: application/json`
  - `captcha-token`: token de reCAPTCHA válido

Body esperado:
```json
{
  "fechaAgendada": "2026-08-26T14:30:00.000Z",
  "nombreCliente": "Juan Pérez",
  "correoCliente": "juan@example.com",
  "telefonoCliente": "+52 555 123 4567",
  "ubicacion": "Coyoacán, CDMX",
  "diseno": "64f1abc123def4567890abcde",
  "informacionAdicional": "Necesita cocina blanca"
}
```

Campos obligatorios:
- `fechaAgendada`
- `nombreCliente`
- `correoCliente`
- `telefonoCliente`

Campos opcionales:
- `ubicacion`
- `diseno` (ID de diseño, debe ser un ObjectId válido)
- `informacionAdicional`

Validaciones del backend:
- La fecha debe ser futura y con al menos 1 hora de anticipación.
- Solo se permiten citas de lunes a viernes.
- Solo entre las 9:00 y las 18:00 horas (hora de México).
- Debe haber al menos 1 hora de separación con otras citas activas.

Respuesta exitosa:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "fechaAgendada": "2026-08-26T14:30:00.000Z",
    "nombreCliente": "Juan Pérez",
    "correoCliente": "juan@example.com",
    "telefonoCliente": "+52 555 123 4567",
    "ubicacion": "Coyoacán, CDMX",
    "diseno": {
      "_id": "...",
      "nombre": "Cocina Moderna",
      "descripcion": "...",
      "imagenes": []
    },
    "informacionAdicional": "Necesita cocina blanca",
    "estado": "programada",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Cita creada exitosamente"
}
```

Errores comunes:
- 400: datos inválidos, captcha faltante o fecha fuera de horario
- 500: error interno del servidor

---

### 1.2 Consultar disponibilidad por día
- Método: GET
- Ruta: /api/citas/disponibilidad?fecha=YYYY-MM-DD
- Autenticación: pública

Ejemplo:
```http
GET /api/citas/disponibilidad?fecha=2026-08-26
```

Respuesta:
```json
{
  "success": true,
  "fecha": "2026-08-26",
  "horariosOcupados": ["09:00", "10:00", "14:30"]
}
```

Uso recomendado para el frontend:
- Mostrar horarios disponibles para un día concreto.
- El frontend puede filtrar los horarios ocupados y mostrar solo los disponibles.

---

### 1.3 Consultar horarios ocupados de forma simple
- Método: GET
- Ruta: /api/citas/horarios-ocupados
- Autenticación: pública

Respuesta:
```json
[
  {
    "fecha": "2026-08-26",
    "hora": "14:00"
  },
  {
    "fecha": "2026-08-27",
    "hora": "10:00"
  }
]
```

Uso recomendado para el frontend:
- Cargar de forma rápida una lista de horarios ocupados.
- Útil para mostrar disponibilidad general o bloquear fechas/horarios.

---

## 2. Endpoints para obtener y mostrar información de citas

### 2.1 Obtener citas por cliente (por correo)
- Método: GET
- Ruta: /api/citas/porCliente?correo=correo@ejemplo.com
- Autenticación: requiere token JWT

Ejemplo:
```http
GET /api/citas/porCliente?correo=juan@example.com
```

Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "fechaAgendada": "2026-08-26T14:30:00.000Z",
      "nombreCliente": "Juan Pérez",
      "correoCliente": "juan@example.com",
      "telefonoCliente": "+52 555 123 4567",
      "ubicacion": "Coyoacán, CDMX",
      "estado": "programada",
      "diseno": {
        "_id": "...",
        "nombre": "Cocina Moderna",
        "descripcion": "...",
        "imagenes": []
      }
    }
  ]
}
```

Uso recomendado para el frontend:
- Mostrar historial o próximas citas de un cliente.
- Buscar citas usando el correo del cliente.

---

### 2.2 Obtener una cita específica
- Método: GET
- Ruta: /api/citas/verCita/:id
- Autenticación: requiere token JWT

Ejemplo:
```http
GET /api/citas/verCita/64f1abc123def4567890abcde
```

Respuesta:
```json
{
  "success": true,
  "data": {
    "_id": "64f1abc123def4567890abcde",
    "fechaAgendada": "2026-08-26T14:30:00.000Z",
    "nombreCliente": "Juan Pérez",
    "correoCliente": "juan@example.com",
    "telefonoCliente": "+52 555 123 4567",
    "ubicacion": "Coyoacán, CDMX",
    "estado": "programada",
    "diseno": {
      "_id": "...",
      "nombre": "Cocina Moderna",
      "descripcion": "...",
      "imagenes": []
    },
    "ingenieroAsignado": []
  }
}
```

---

### 2.3 Obtener todas las citas
- Método: GET
- Ruta: /api/citas/verCitas
- Autenticación: pública en la ruta actual

Respuesta:
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "fechaAgendada": "...",
      "nombreCliente": "...",
      "correoCliente": "...",
      "estado": "programada"
    }
  ]
}
```

Uso recomendado para el frontend:
- Listar todas las citas en paneles administrativos o vistas de seguimiento.

---

## 3. Estructura de datos esperada por el backend

El modelo de cita espera estos campos principales:

```json
{
  "fechaAgendada": "2026-08-26T14:30:00.000Z",
  "nombreCliente": "Juan Pérez",
  "correoCliente": "juan@example.com",
  "telefonoCliente": "+52 555 123 4567",
  "ubicacion": "Coyoacán, CDMX",
  "mapsUrl": "https://maps.google.com/..",
  "informacionAdicional": "Texto libre",
  "diseno": "ObjectId",
  "estado": "programada"
}
```

### Campos que el frontend debería enviar al agendar
- `fechaAgendada` (obligatorio)
- `nombreCliente` (obligatorio)
- `correoCliente` (obligatorio)
- `telefonoCliente` (obligatorio)
- `ubicacion` (opcional)
- `diseno` (opcional)
- `informacionAdicional` (opcional)

### Campos que el frontend debería mostrar al leer una cita
- `_id`
- `fechaAgendada`
- `nombreCliente`
- `correoCliente`
- `telefonoCliente`
- `ubicacion`
- `estado`
- `diseno`
- `informacionAdicional`
- `ingenieroAsignado`

---

## 4. Notas importantes para la integración frontend

1. El backend envía respuestas con el formato:
```json
{
  "success": true,
  "data": { ... },
  "message": "..."
}
```

2. La ruta de agendar cita requiere el header `captcha-token`.

3. El backend valida que la cita se programe en horario laboral y con separación mínima de 1 hora.

4. Para mostrar citas, el frontend puede usar:
   - `/api/citas/porCliente?correo=...` para consultas de un cliente específico.
   - `/api/citas/verCita/:id` para ver detalles de una cita.
   - `/api/citas/verCitas` para listar varias citas.

5. Si el frontend necesita actualizar estados de una cita, también existen endpoints de administración como:
   - `PUT /api/citas/:id/actualizarEstado`
   - `PUT /api/citas/:id/iniciar`
   - `PUT /api/citas/:id/finalizar`

---

## 5. Resumen práctico para el módulo de agendar citas

Para el flujo inicial del frontend, los endpoints mínimos son:

- POST `/api/citas/agregarCita` → agendar cita
- GET `/api/citas/disponibilidad?fecha=YYYY-MM-DD` → consultar horarios disponibles
- GET `/api/citas/horarios-ocupados` → obtener horarios ocupados de forma simple
- GET `/api/citas/porCliente?correo=...` → mostrar citas del cliente

Con esto ya se puede construir el flujo completo de:
1. seleccionar fecha,
2. consultar disponibilidad,
3. capturar datos del cliente,
4. agendar la cita,
5. mostrar la información guardada.
