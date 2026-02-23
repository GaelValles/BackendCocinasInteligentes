# 📚 API Endpoints Completos - Backend Küche

## 🔐 Autenticación (/auth)

### POST /login
Iniciar sesión en el sistema.

**Request:**
```json
{
  "correo": "usuario@ejemplo.com",
  "password": "contraseña"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login exitoso",
  "token": "jwt_token_here",
  "data": {
    "user": {
      "id": "user_id",
      "nombre": "Juan Pérez",
      "correo": "usuario@ejemplo.com",
      "telefono": "555-1234",
      "rol": "admin"
    }
  }
}
```

---

### POST /register
Registrar nuevo usuario (no clientes).

**Request:**
```json
{
  "nombre": "Juan Pérez",
  "correo": "usuario@ejemplo.com",
  "telefono": "555-1234",
  "rol": "admin", // admin, arquitecto, empleado
  "password": "contraseña"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Usuario creado correctamente",
  "token": "jwt_token_here",
  "data": {
    "user": {
      "id": "user_id",
      "nombre": "Juan Pérez",
      "correo": "usuario@ejemplo.com",
      "rol": "admin"
    }
  }
}
```

---

### POST /logout
Cerrar sesión.

**Response (200):**
```json
{
  "success": true,
  "message": "Sesión cerrada correctamente"
}
```

---

### GET /verify
Verificar token actual.

**Headers:**
```
Cookie: token=jwt_token_here
// O
Authorization: Bearer jwt_token_here
```

**Response (200):**
```json
{
  "id": "user_id",
  "nombre": "Juan Pérez",
  "correo": "usuario@ejemplo.com",
  "telefono": "555-1234",
  "rol": "admin",
  "carros": [],
  "citas": [],
  "penaltyUntil": null
}
```

---

### GET /me
Obtener usuario actual autenticado.

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "nombre": "Juan Pérez",
    "correo": "usuario@ejemplo.com",
    "telefono": "555-1234",
    "rol": "admin",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### PUT /update-password
Actualizar contraseña del usuario autenticado.

**Headers:** Requiere autenticación

**Request:**
```json
{
  "currentPassword": "contraseña_actual",
  "newPassword": "contraseña_nueva"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Contraseña actualizada exitosamente"
}
```

---

### POST /request-password-reset
Solicitar restablecimiento de contraseña (por implementar envío de email).

**Request:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Si el correo existe, recibirás instrucciones para restablecer tu contraseña"
}
```

---

### GET /perfil
Obtener perfil del usuario autenticado.

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "id": "user_id",
  "nombre": "Juan Pérez",
  "correo": "usuario@ejemplo.com",
  "telefono": "555-1234",
  "rol": "admin"
}
```

---

### GET /verUsuarios
Listar todos los usuarios (solo admin).

**Headers:** Requiere autenticación

**Response (200):**
```json
[
  {
    "id": "user_id",
    "nombre": "Juan Pérez",
    "correo": "usuario@ejemplo.com",
    "rol": "admin"
  }
]
```

---

## 🏗️ Levantamientos Rápidos (/levantamientos)

### POST /levantamientos
Crear nuevo levantamiento.

**Headers:** Requiere autenticación

**Request:**
```json
{
  "cliente": {
    "nombre": "Carlos Gómez",
    "direccion": "Calle Principal 123",
    "telefono": "555-9876"
  },
  "metrosLineales": 8.5,
  "requiereIsla": true,
  "alacenasAltas": false,
  "tipoCubierta": "Granito Básico",
  "escenarioSeleccionado": "premium",
  "empleadoAsignado": "empleado_id", // opcional
  "notas": "Cliente prefiere colores claros" // opcional
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "levantamiento_id",
    "cliente": {...},
    "metrosLineales": 8.5,
    "precioBase": 42500,
    "factorMaterial": 1.0,
    "multiplicadorEscenario": 1.35,
    "precioEstimado": 57375,
    "rangoMin": 53359,
    "rangoMax": 61965,
    "estado": "pendiente",
    "historialEstados": [...]
  },
  "message": "Levantamiento creado exitosamente"
}
```

---

### GET /levantamientos
Listar levantamientos con filtros y paginación.

**Headers:** Requiere autenticación

**Query Parameters:**
- `estado` (opcional): pendiente, en_revision, contactado, cotizado, rechazado, archivado
- `empleadoAsignado` (opcional): ID del empleado
- `fechaDesde` (opcional): ISO date string
- `fechaHasta` (opcional): ISO date string
- `page` (opcional, default: 1)
- `limit` (opcional, default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "levantamiento_id",
      "cliente": {...},
      "estado": "pendiente",
      "precioEstimado": 57375,
      "empleadoAsignado": {
        "nombre": "María López",
        "email": "maria@ejemplo.com"
      }
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "pages": 3,
    "limit": 10
  }
}
```

---

### GET /levantamientos/:id
Obtener levantamiento específico.

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "levantamiento_id",
    "cliente": {...},
    "metrosLineales": 8.5,
    "precioEstimado": 57375,
    "rangoMin": 53359,
    "rangoMax": 61965,
    "estado": "pendiente",
    "empleadoAsignado": {...},
    "historialEstados": [...]
  }
}
```

---

### PATCH /levantamientos/:id
Actualizar levantamiento.

**Headers:** Requiere autenticación

**Request:**
```json
{
  "metrosLineales": 9.0,
  "notas": "Actualización de medidas"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {...},
  "message": "Levantamiento actualizado exitosamente"
}
```

---

### PATCH /levantamientos/:id/estado
Cambiar estado del levantamiento.

**Headers:** Requiere autenticación

**Request:**
```json
{
  "estado": "en_revision",
  "notas": "Iniciando revisión del proyecto"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {...},
  "message": "Estado actualizado exitosamente"
}
```

---

### PATCH /levantamientos/:id/asignar
Asignar empleado al levantamiento.

**Headers:** Requiere autenticación

**Request:**
```json
{
  "empleadoId": "empleado_id"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {...},
  "message": "Empleado asignado exitosamente"
}
```

---

### DELETE /levantamientos/:id
Eliminar levantamiento.

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "message": "Levantamiento eliminado exitosamente"
}
```

---

### POST /levantamientos/:id/convertir-cotizacion
Convertir levantamiento a cotización (por implementar).

**Headers:** Requiere autenticación

**Response (501):**
```json
{
  "success": false,
  "message": "Función no implementada aún"
}
```

---

## 💰 Cotizaciones (/cotizaciones)

### GET /cotizaciones/config
Obtener configuración del cotizador (PÚBLICA - no requiere autenticación).

**Response (200):**
```json
{
  "projectTypes": ["Cocina", "Closet", "vestidor", "Mueble para el baño"],
  "baseMaterials": [
    {
      "id": "melamina",
      "label": "Melamina",
      "pricePerMeter": 6500
    }
  ],
  "scenarioCards": [
    {
      "id": "esencial",
      "title": "GAMA ESENCIAL",
      "subtitle": "Cocina minimalista limpia",
      "multiplier": 0.92,
      "image": "/images/cocina1.jpg",
      "tags": ["Melamina", "Granito", "Herrajes Std"]
    }
  ],
  "materialColors": ["Blanco Nieve", "Nogal Calido", "Gris Grafito", "Fresno Arena"],
  "hardwareCatalog": [
    {
      "id": "correderas",
      "label": "Correderas cierre suave",
      "unitPrice": 500
    }
  ]
}
```

---

### POST /cotizaciones
Crear nueva cotización.

**Headers:** Requiere autenticación

**Request:**
```json
{
  "cliente": "Carlos Gómez",
  "tipoProyecto": "Cocina",
  "ubicacion": "Ciudad de México",
  "fechaInstalacion": "2024-06-15",
  "medidas": {
    "largo": 5.5,
    "alto": 2.4,
    "fondo": 0.6,
    "metrosLineales": 8.5
  },
  "escenarioSeleccionado": "premium",
  "materialBase": "melamina",
  "colorTextura": "Blanco Nieve",
  "grosorTablero": "19",
  "herrajes": [
    {
      "herrajeId": "herraje_id",
      "nombre": "Correderas cierre suave",
      "precioUnitario": 500,
      "enabled": true,
      "cantidad": 10
    }
  ],
  "manoDeObra": 15000,
  "flete": 3000,
  "instalacion": 5000,
  "desinstalacion": 0,
  "notas": "Cliente prefiere instalación matutina"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "cotizacion_id",
    "cliente": "Carlos Gómez",
    "materialSubtotal": 58650,
    "hardwareSubtotal": 5000,
    "laborSubtotal": 23000,
    "finalPrice": 86650,
    "estado": "borrador"
  },
  "message": "Cotización creada exitosamente"
}
```

---

### POST /cotizaciones/borrador
Guardar cotización como borrador.

**Headers:** Requiere autenticación

**Request:**
```json
{
  "cliente": "Carlos Gómez",
  "projectType": "Cocina",
  "materialBase": "melamina",
  "metrosLineales": 8.5,
  // ... otros campos
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {...},
  "message": "Borrador guardado correctamente"
}
```

---

### GET /cotizaciones
Listar cotizaciones con filtros.

**Headers:** Requiere autenticación

**Query Parameters:**
- `estado` (opcional)
- `tipoProyecto` (opcional)
- `fechaDesde` (opcional)
- `fechaHasta` (opcional)
- `page` (opcional, default: 1)
- `limit` (opcional, default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "cotizacion_id",
      "cliente": "Carlos Gómez",
      "finalPrice": 86650,
      "estado": "borrador",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "pages": 2,
    "limit": 10
  }
}
```

---

### GET /cotizaciones/:id
Obtener cotización específica.

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "cotizacion_id",
    "cliente": "Carlos Gómez",
    "medidas": {...},
    "materialSubtotal": 58650,
    "hardwareSubtotal": 5000,
    "laborSubtotal": 23000,
    "finalPrice": 86650,
    "estado": "borrador",
    "historialEstados": [...]
  }
}
```

---

### PATCH /cotizaciones/:id
Actualizar cotización.

**Headers:** Requiere autenticación

**Request:**
```json
{
  "labor": 18000,
  "notas": "Actualización de mano de obra"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {...},
  "message": "Cotización actualizada exitosamente"
}
```

---

### PATCH /cotizaciones/:id/estado
Cambiar estado de cotización.

**Headers:** Requiere autenticación

**Request:**
```json
{
  "estado": "enviada",
  "notas": "Enviada al cliente por correo"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {...},
  "message": "Estado actualizado exitosamente"
}
```

---

### DELETE /cotizaciones/:id
Eliminar cotización.

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "message": "Cotización eliminada exitosamente"
}
```

---

### POST /cotizaciones/:id/pdf-cliente
Generar PDF para cliente (por implementar).

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "message": "Generar PDF Cliente (pendiente de implementar)",
  "data": {
    "cotizacion": "cotizacion_id",
    "finalPrice": 86650
  }
}
```

---

### POST /cotizaciones/:id/hoja-taller
Generar hoja de taller (por implementar).

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "message": "Generar Hoja de Taller (pendiente de implementar)",
  "data": {
    "cotizacion": "cotizacion_id",
    "medidas": {...}
  }
}
```

---

## 📚 Catálogos (/catalogos)

### GET /catalogos/materiales
Obtener lista de materiales base (PÚBLICA).

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "material_id",
      "idCotizador": "melamina",
      "nombre": "Melamina",
      "precioPorMetro": 6500,
      "descripcion": "Material base estándar",
      "categoria": "Madera"
    }
  ]
}
```

---

### GET /catalogos/herrajes
Obtener lista de herrajes (PÚBLICA).

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "herraje_id",
      "idCotizador": "correderas",
      "nombre": "Correderas cierre suave",
      "precioUnitario": 500,
      "descripcion": "Correderas de alta calidad",
      "categoria": "Herrajes"
    }
  ]
}
```

---

### GET /catalogos/colores
Obtener lista de colores disponibles (PÚBLICA).

**Response (200):**
```json
{
  "success": true,
  "data": [
    "Blanco Nieve",
    "Nogal Calido",
    "Gris Grafito",
    "Fresno Arena"
  ]
}
```

---

### GET /catalogos/tipos-proyecto
Obtener tipos de proyecto disponibles (PÚBLICA).

**Response (200):**
```json
{
  "success": true,
  "data": [
    "Cocina",
    "Closet",
    "vestidor",
    "Mueble para el baño"
  ]
}
```

---

### GET /catalogos/tipos-cubierta
Obtener tipos de cubierta para levantamiento (PÚBLICA).

**Response (200):**
```json
{
  "success": true,
  "data": [
    "Granito Básico",
    "Cuarzo",
    "Piedra Sinterizada"
  ]
}
```

---

### GET /catalogos/escenarios-levantamiento
Obtener escenarios para levantamiento (PÚBLICA).

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "esencial",
      "title": "GAMA ESENCIAL",
      "subtitle": "Opción económica y funcional",
      "multiplicador": 0.9,
      "descripcion": "Materiales básicos de calidad estándar"
    }
  ]
}
```

---

### GET /catalogos/escenarios-cotizador
Obtener escenarios para cotizador (PÚBLICA).

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "esencial",
      "title": "GAMA ESENCIAL",
      "subtitle": "Cocina minimalista limpia",
      "multiplier": 0.92,
      "image": "/images/cocina1.jpg",
      "tags": ["Melamina", "Granito", "Herrajes Std"]
    }
  ]
}
```

---

### GET /catalogos/empleados
Obtener lista de empleados para asignación.

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "empleado_id",
      "nombre": "María López",
      "correo": "maria@ejemplo.com",
      "telefono": "555-4321",
      "rol": "arquitecto"
    }
  ]
}
```

---

## 👥 Usuarios (/usuarios y /empleados)

### GET /usuarios
Listar todos los usuarios.

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "user_id",
      "nombre": "Juan Pérez",
      "correo": "juan@ejemplo.com",
      "telefono": "555-1234",
      "rol": "admin",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### GET /usuarios/:id
Obtener usuario por ID.

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "user_id",
    "nombre": "Juan Pérez",
    "correo": "juan@ejemplo.com",
    "telefono": "555-1234",
    "rol": "admin",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### GET /empleados
Listar empleados (alias de /usuarios/empleados).

**Headers:** Requiere autenticación

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "empleado_id",
      "nombre": "María López",
      "correo": "maria@ejemplo.com",
      "telefono": "555-4321",
      "rol": "arquitecto"
    }
  ]
}
```

---

## 🎨 Materiales (/materiales)

### POST /materiales/agregarMaterial
Agregar nuevo material (solo admin).

**Headers:** Requiere autenticación

**Request:**
```json
{
  "nombre": "Granito Premium",
  "descripcion": "Granito de alta calidad",
  "unidadMedida": "m²",
  "precioUnitario": 8500,
  "categoria": "Granito",
  "idCotizador": "granito-premium",
  "disponible": true
}
```

---

### GET /materiales/verMateriales
Ver todos los materiales.

**Headers:** Requiere autenticación

**Query Parameters:**
- `categoria` (opcional)
- `disponible` (opcional)

---

### GET /materiales/verMaterial/:id
Ver material específico.

**Headers:** Requiere autenticación

---

### PUT /materiales/actualizarMaterial/:id
Actualizar material (solo admin).

**Headers:** Requiere autenticación

---

### PUT /materiales/actualizarPrecio/:id
Actualizar precio de material (solo admin).

**Headers:** Requiere autenticación

**Request:**
```json
{
  "nuevoPrecio": 7200
}
```

---

### DELETE /materiales/eliminarMaterial/:id
Eliminar material (solo admin).

**Headers:** Requiere autenticación

---

### GET /materiales/buscar
Buscar material por nombre (solo admin).

**Headers:** Requiere autenticación

**Query Parameters:**
- `nombre` (requerido)

---

## 📋 Formato de Respuestas

### Éxito (2xx)
```json
{
  "success": true,
  "data": {...}, // Datos solicitados
  "message": "Mensaje descriptivo",
  "pagination": {...} // Solo en listados
}
```

### Error (4xx, 5xx)
```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "Detalle técnico (solo en development)"
}
```

---

## 🔒 Autenticación

### Métodos Soportados

1. **Cookie (sesiones web):**
   ```
   Cookie: token=jwt_token_here
   ```

2. **Header Authorization (APIs, mobile):**
   ```
   Authorization: Bearer jwt_token_here
   ```

### Códigos de Estado

- `200` - Operación exitosa
- `201` - Recurso creado
- `400` - Error de validación
- `401` - No autenticado
- `403` - Sin permisos
- `404` - No encontrado
- `500` - Error del servidor
- `501` - No implementado

---

## 🌐 Notas de Integración

### CORS Configurado
El backend está configurado para aceptar peticiones desde:
- `http://localhost:5173` (Vite/React)
- `http://localhost:3000` (Next.js)

### Base URL
```
http://localhost:3001
```

### Almacenamiento de Token
El frontend debe almacenar el token JWT en:
- `localStorage` o `sessionStorage` para persistencia
- Incluir en header `Authorization: Bearer <token>` en cada petición autenticada

---

✅ **Documentación completa y actualizada - Lista para integración frontend-backend**
