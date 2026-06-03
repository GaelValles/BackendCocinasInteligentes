# 🔧 Endpoints de Administración de Citas - Guía Implementada

**Fecha de Implementación:** 20 de Mayo de 2026  
**Estado:** ✅ Funcional  

---

## 📋 Resumen de Cambios

✅ **Modelo actualizado:** `ingenieroAsignado` ahora es un array  
✅ **3 nuevos endpoints implementados:** Asignar múltiples, actualizar datos, actualizar estado  
✅ **Backward compatible:** Maneja tanto singular como array  
✅ **Validaciones completas:** Email, teléfono, transición de estados  
✅ **Sincronización automática:** Con tareas y tracking  

---

## 🔌 Endpoints Implementados

### 1️⃣ Asignar Múltiple Ingenieros

**Endpoint:**
```
PUT /api/citas/:id/asignarIngenieros
```

**Headers Requeridos:**
```
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "ingenieroIds": ["id_ing_1", "id_ing_2", "id_ing_3"]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Ingenieros asignados correctamente",
  "data": {
    "cita": {
      "_id": "cita_id",
      "nombreCliente": "Juan Pérez",
      "correoCliente": "juan@example.com",
      "telefonoCliente": "+525512345678",
      "fechaAgendada": "2026-05-20T14:00:00Z",
      "ubicacion": "Durango Capital",
      "estado": "programada",
      "ingenieroAsignado": [
        {
          "_id": "ing_1",
          "nombre": "Carlos García",
          "correo": "carlos@kuche.com",
          "telefono": "+525587654321",
          "rol": "Ingeniero"
        },
        {
          "_id": "ing_2",
          "nombre": "María López",
          "correo": "maria@kuche.com",
          "telefono": "+525598765432",
          "rol": "Ingeniero"
        }
      ],
      "createdAt": "2026-05-15T10:30:00Z",
      "updatedAt": "2026-05-20T12:00:00Z"
    }
  }
}
```

**Validaciones:**
- ✅ Solo admin
- ✅ Array sin duplicados
- ✅ IDs válidos de MongoDB
- ✅ Ingenieros existen
- ✅ Tienen roles asignables
- ✅ Sincroniza con tareas automáticamente

**Errores Posibles:**
```json
{
  "success": false,
  "message": "ingenieroIds debe ser un array"
}

{
  "success": false,
  "message": "Uno o más ingenieros no existen"
}

{
  "success": false,
  "message": "Solo administradores pueden hacer esta operación"
}
```

---

### 2️⃣ Actualizar Datos del Cliente

**Endpoint:**
```
PUT /api/citas/:id/actualizarDatos
```

**Headers Requeridos:**
```
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

**Request Body (campos opcionales):**
```json
{
  "nombreCliente": "Juan Pérez Actualizado",
  "correoCliente": "nuevocorreo@example.com",
  "telefonoCliente": "+525599998888",
  "ubicacion": "Gómez Palacio",
  "informacionAdicional": "Información actualizada del proyecto"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Datos de la cita actualizados correctamente",
  "data": {
    "cita": {
      "_id": "cita_id",
      "nombreCliente": "Juan Pérez Actualizado",
      "correoCliente": "nuevocorreo@example.com",
      "telefonoCliente": "+525599998888",
      "fechaAgendada": "2026-05-20T14:00:00Z",
      "ubicacion": "Gómez Palacio",
      "informacionAdicional": "Información actualizada del proyecto",
      "estado": "programada",
      "ingenieroAsignado": [],
      "createdAt": "2026-05-15T10:30:00Z",
      "updatedAt": "2026-05-20T12:15:00Z"
    }
  }
}
```

**Validaciones:**
- ✅ Solo admin
- ✅ Nombre: mínimo 3 caracteres
- ✅ Email: formato válido
- ✅ Teléfono: mínimo 7 dígitos
- ✅ Campos NO editables: fechaAgendada, estado, ingenieros (usar endpoints específicos)

**Errores Posibles:**
```json
{
  "success": false,
  "message": "Nombre del cliente debe tener al menos 3 caracteres"
}

{
  "success": false,
  "message": "Email no válido"
}

{
  "success": false,
  "message": "Teléfono debe tener al menos 7 dígitos"
}
```

---

### 3️⃣ Actualizar Estado de la Cita

**Endpoint:**
```
PUT /api/citas/:id/actualizarEstado
```

**Headers Requeridos:**
```
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "estado": "en_proceso",
  "fechaTermino": "2026-05-25T16:00:00Z"
}
```

**Estados Válidos:**
- `programada` → `en_proceso`, `cancelada`
- `en_proceso` → `completada`, `cancelada`
- `completada` → No puede cambiar
- `cancelada` → No puede cambiar

**Response (200):**
```json
{
  "success": true,
  "message": "Estado actualizado a 'en_proceso'",
  "data": {
    "cita": {
      "_id": "cita_id",
      "nombreCliente": "Juan Pérez",
      "estado": "en_proceso",
      "fechaAgendada": "2026-05-20T14:00:00Z",
      "fechaInicio": "2026-05-20T13:55:00Z",
      "fechaTermino": null,
      "updatedAt": "2026-05-20T13:55:00Z"
    }
  }
}
```

**Validaciones:**
- ✅ Solo admin
- ✅ Estado válido
- ✅ Transiciones permitidas
- ✅ Si es "completada": requiere `fechaTermino`
- ✅ `fechaTermino` >= `fechaAgendada`

**Errores Posibles:**
```json
{
  "success": false,
  "message": "No se puede cambiar de 'programada' a 'invalidState'"
}

{
  "success": false,
  "message": "Se requiere 'fechaTermino' cuando el estado es 'completada'"
}

{
  "success": false,
  "message": "La fecha de término no puede ser anterior a la fecha agendada"
}
```

---

## 💻 Ejemplos de Uso en Frontend

### JavaScript - Actualizar Datos

```javascript
async function actualizarDatosCita(citaId, token, datos) {
  const payload = {
    nombreCliente: datos.nombre,
    correoCliente: datos.correo,
    telefonoCliente: datos.telefono,
    ubicacion: datos.ubicacion,
    informacionAdicional: datos.notas
  };

    const response = await fetch(
        `http://localhost:3000/api/citas/${citaId}/actualizarDatos`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
      body: JSON.stringify(payload)
        }
    );

    const resultado = await response.json();
    console.log('[CITAS][ACTUALIZAR_DATOS][RESPUESTA_RECIBIDA]', resultado);
    
    if (resultado.success) {
        return resultado.data.cita;
    } else {
        console.error('❌ Error:', resultado.message);
        return null;
    }
}

// Uso
const cita = await actualizarDatosCita(
    'citaId123',
    'tokenAdmin',
    {
        nombre: 'Nuevo Nombre',
        correo: 'nuevo@email.com',
        telefono: '+5255987654321',
        ubicacion: 'Nueva dirección',
        notas: 'Nuevas notas'
    }
);
```

---

### React - Asignar Múltiples Ingenieros

```jsx
import { useState } from 'react';

function AsignarIngenieros({ citaId, token }) {
    const [seleccionados, setSeleccionados] = useState([]);
    const [cargando, setCargando] = useState(false);

    const asignar = async () => {
        setCargando(true);
        try {
        const payload = {
          ingenieroIds: seleccionados
        };

            const response = await fetch(
                `http://localhost:3000/api/citas/${citaId}/asignarIngenieros`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
            body: JSON.stringify(payload)
                }
            );

            const resultado = await response.json();
            console.log('[CITAS][ASIGNAR_INGENIEROS][RESPUESTA_RECIBIDA]', resultado);

            if (resultado.success) {
                alert('✅ Ingenieros asignados');
            } else {
                alert('❌ Error: ' + resultado.message);
            }
        } finally {
            setCargando(false);
        }
    };

    return (
        <div>
            <h3>Asignar Ingenieros</h3>
            
            {/* Checkboxes para seleccionar ingenieros */}
            <label>
                <input
                    type="checkbox"
                    value="ing1"
                    onChange={(e) => {
                        if (e.target.checked) {
                            setSeleccionados([...seleccionados, e.target.value]);
                        } else {
                            setSeleccionados(seleccionados.filter(id => id !== e.target.value));
                        }
                    }}
                />
                Carlos García
            </label>

            <label>
                <input
                    type="checkbox"
                    value="ing2"
                    onChange={(e) => {
                        if (e.target.checked) {
                            setSeleccionados([...seleccionados, e.target.value]);
                        } else {
                            setSeleccionados(seleccionados.filter(id => id !== e.target.value));
                        }
                    }}
                />
                María López
            </label>

            <button onClick={asignar} disabled={cargando || seleccionados.length === 0}>
                {cargando ? 'Asignando...' : 'Asignar Ingenieros'}
            </button>
        </div>
    );
}

export default AsignarIngenieros;
```

---

### Cambiar Estado

```javascript
async function cambiarEstadoCita(citaId, token, nuevoEstado, fechaTermino = null) {
    const body = { estado: nuevoEstado };
    
    if (fechaTermino) {
        body.fechaTermino = fechaTermino;
    }

    const response = await fetch(
        `http://localhost:3000/api/citas/${citaId}/actualizarEstado`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }
    );

    const resultado = await response.json();
    console.log('[CITAS][CAMBIAR_ESTADO][RESPUESTA_RECIBIDA]', resultado);

    if (resultado.success) {
        return resultado.data.cita;
    } else {
        console.error('❌ Error:', resultado.message);
        return null;
    }
}

// Ejemplo: Cambiar a "en_proceso"
await cambiarEstadoCita('citaId123', 'tokenAdmin', 'en_proceso');

// Ejemplo: Completar cita con fecha de término
await cambiarEstadoCita(
    'citaId123',
    'tokenAdmin',
    'completada',
    new Date().toISOString()
);
```

---

## 🧪 Testing con cURL

### Test 1: Asignar múltiples ingenieros

```bash
curl -X PUT http://localhost:3000/api/citas/abc123/asignarIngenieros \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "ingenieroIds": ["id_ing_1", "id_ing_2"]
  }'
```

### Test 2: Actualizar datos del cliente

```bash
curl -X PUT http://localhost:3000/api/citas/abc123/actualizarDatos \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "nombreCliente": "Nuevo Nombre",
    "correoCliente": "nuevo@email.com",
    "telefonoCliente": "+525599998888"
  }'
```

### Test 3: Cambiar estado a "en_proceso"

```bash
curl -X PUT http://localhost:3000/api/citas/abc123/actualizarEstado \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "estado": "en_proceso"
  }'
```

### Test 4: Completar cita

```bash
curl -X PUT http://localhost:3000/api/citas/abc123/actualizarEstado \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "estado": "completada",
    "fechaTermino": "2026-05-25T16:00:00Z"
  }'
```

---

## 📝 Cambios en la Base de Datos

**Modelo Anterior:**
```javascript
ingenieroAsignado: ObjectId (singular)
```

**Modelo Nuevo:**
```javascript
ingenieroAsignado: [ObjectId] (array)
```

**Migración (si es necesaria):**
```javascript
// Convertir documentos existentes a array
db.citas.updateMany(
  { ingenieroAsignado: { $exists: true, $type: "objectId" } },
  [{ $set: { ingenieroAsignado: ["$ingenieroAsignado"] } }]
);
```

---

## ✅ Checklist de Verificación

- [ ] Modelo de Cita actualizado con `ingenieroAsignado` como array
- [ ] 3 nuevos endpoints implementados
- [ ] Rutas agregadas correctamente
- [ ] Validaciones funcionando
- [ ] Sincronización con tareas
- [ ] Transiciones de estado correctas
- [ ] Email y teléfono validados
- [ ] Solo admin puede usar estos endpoints
- [ ] Testing con cURL funciona
- [ ] Frontend conecta correctamente

---

## 🆘 Troubleshooting

| Problema | Solución |
|----------|----------|
| "Solo administradores" | Verificar que el token sea de admin |
| "ingenieroIds debe ser array" | Enviar `{"ingenieroIds": [...]}` |
| "Email no válido" | Formato debe ser: usuario@dominio.com |
| "No se puede cambiar" | Verificar transiciones permitidas |
| "Se requiere fechaTermino" | Agregar `fechaTermino` cuando estado es "completada" |

---

## 📊 Estructura de Datos Final

```json
{
  "_id": "cita_id",
  "nombreCliente": "Juan Pérez",
  "correoCliente": "juan@example.com",
  "telefonoCliente": "+525512345678",
  "ubicacion": "Durango Capital",
  "fechaAgendada": "2026-05-20T14:00:00Z",
  "fechaInicio": "2026-05-20T13:55:00Z",
  "fechaTermino": null,
  "estado": "programada",
  "informacionAdicional": "Notas adicionales",
  "ingenieroAsignado": [
    {
      "_id": "ing_1",
      "nombre": "Carlos García",
      "correo": "carlos@kuche.com",
      "rol": "Ingeniero"
    },
    {
      "_id": "ing_2",
      "nombre": "María López",
      "correo": "maria@kuche.com",
      "rol": "Ingeniero"
    }
  ],
  "clienteId": "A1B2C3",
  "createdAt": "2026-05-15T10:30:00Z",
  "updatedAt": "2026-05-20T12:15:00Z"
}
```

---

**Status:** ✅ Listo para Producción  
**Última Actualización:** 20 de Mayo de 2026
