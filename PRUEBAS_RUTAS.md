# Guía de pruebas de rutas – Backend Cocinas Inteligentes

Base URL: **http://localhost:3000** (o el `PORT` de tu `.env`).

Las rutas que requieren **auth** necesitan cookie `token` (login primero). En Postman/Insomnia: habilitar "Send cookies" / "Credentials: include".

---

## 1. Auth (prefijo: ninguno)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/login` | No | Login |
| POST | `/register` | No | Registro |
| POST | `/logout` | No | Cerrar sesión |
| GET | `/verify` | No | Verificar token (cookies) |
| GET | `/perfil` | Sí | Perfil del usuario |
| POST | `/addUser` | Sí (admin) | Crear usuario |
| GET | `/verUsuarios` | Sí | Listar usuarios |
| GET | `/VerUsuario/:id` | Sí | Ver usuario por ID |
| PUT | `/deleteUser/:id` | Sí | Desactivar usuario |

### Ejemplos JSON

**POST /login**
```json
{
  "correo": "admin@empresa.com",
  "password": "123456"
}
```

**POST /register** (no se permite rol `cliente`; los clientes solo se guardan al agendar una cita)
```json
{
  "nombre": "Juan Pérez",
  "correo": "juan@ejemplo.com",
  "telefono": "5512345678",
  "rol": "ingeniero",
  "password": "123456"
}
```
Roles permitidos: `admin`, `ingeniero`, `arquitecto`.

**POST /addUser** (admin; no se permite rol `cliente`)
```json
{
  "nombre": "María Ingeniera",
  "correo": "maria@empresa.com",
  "telefono": "5598765432",
  "rol": "ingeniero",
  "password": "123456"
}
```

---

## 2. Contacto (prefijo: `/contacto`) – Público

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/contacto` | No | Primer contacto desde landing |

**POST /contacto**
```json
{
  "nombre": "Roberto García",
  "telefono": "5511223344",
  "correo": "roberto@ejemplo.com"
}
```

---

## 3. Citas (prefijo: `/citas`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/citas/agregarCita` | No | Crear cita (público) |
| GET | `/citas/getAllCitas` | Sí | Todas las citas (admin) |
| GET | `/citas/verCitas` | Sí | Ver citas |
| GET | `/citas/verCita/:id` | Sí | Una cita por ID |
| GET | `/citas/porCliente?correo=...` | Sí | Citas por correo cliente |
| PUT | `/citas/actualizarCita/:id` | Sí | Actualizar cita |
| PUT | `/citas/:id/asignarIngeniero` | Sí (admin) | Asignar ingeniero |
| PUT | `/citas/:id/iniciar` | Sí | Iniciar cita + especificaciones |
| PUT | `/citas/:id/finalizar` | Sí | Finalizar cita y crear orden |
| PUT | `/citas/updateEstado/:id` | Sí | Cambiar estado |
| POST | `/citas/:id/cancel` | Sí | Cancelar cita |
| DELETE | `/citas/eliminarCita/:id` | Sí | Eliminar cita |
| GET | `/citas/porCarro/:id` | Sí | Obsoleto |

**POST /citas/agregarCita**
```json
{
  "fechaAgendada": "2025-03-15T10:00:00.000Z",
  "nombreCliente": "Ana López",
  "correoCliente": "ana@ejemplo.com",
  "telefonoCliente": "5588776655",
  "ubicacion": "Ciudad de México, CDMX",
  "informacionAdicional": "Interesada en cocina en L"
}
```

**PUT /citas/actualizarCita/:id**
```json
{
  "ubicacion": "Guadalajara, Jal.",
  "estado": "programada",
  "ingenieroAsignado": "ID_INGENIERO_O_NULL"
}
```

**PUT /citas/:id/asignarIngeniero**
```json
{
  "ingenieroId": "ID_MONGOOSE_INGENIERO"
}
```

**PUT /citas/:id/iniciar**
```json
{
  "medidas": "3.2m x 2.4m x 0.6m",
  "estilo": "Minimalista",
  "especificaciones": "Isla central, campana extractora",
  "materialesPreferidos": "Melamina blanca, granito negro"
}
```

**PUT /citas/:id/finalizar**
```json
{
  "ingenieroId": "ID_INGENIERO_O_NULL",
  "fechaEstimadaFinalizacion": "2025-04-30",
  "notasInternas": "Cliente prefiere entrega en mañana"
}
```

**PUT /citas/updateEstado/:id**
```json
{
  "estado": "en_proceso"
}
```
Estados válidos: `programada`, `en_proceso`, `completada`, `cancelada`.

**GET /citas/porCliente**  
Query: `?correo=ana@ejemplo.com`

---

## 4. Días inhábiles (prefijo: `/dias`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/dias/obtenerDias` | Sí | Listar días inhábiles |
| POST | `/dias/registrarDia` | Sí | Registrar día inhábil |
| DELETE | `/dias/eliminarDia/:id` | Sí | Eliminar día inhábil |

**POST /dias/registrarDia**
```json
{
  "fecha": "2025-12-25"
}
```

---

## 5. Cotizaciones (prefijo: `/cotizaciones`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/cotizaciones/config` | No | Config cotizador (público) |
| GET | `/cotizaciones` | Sí | Listar mis cotizaciones |
| GET | `/cotizaciones/:id` | Sí | Una cotización por ID |
| POST | `/cotizaciones/borrador` | Sí | Crear borrador |
| PUT | `/cotizaciones/borrador/:id` | Sí | Actualizar borrador |
| POST | `/cotizaciones/:id/pdf-cliente` | Sí | Stub PDF cliente |
| POST | `/cotizaciones/:id/hoja-taller` | Sí | Stub hoja taller |

**GET /cotizaciones/config**  
Sin body. Respuesta: `projectTypes`, `baseMaterials`, `scenarioCards`, `materialColors`, `hardwareCatalog`.

**POST /cotizaciones/borrador**
```json
{
  "cliente": "Ana López",
  "projectType": "Cocina",
  "ubicacion": "CDMX",
  "metrosLineales": 6,
  "materialBase": "melamina",
  "materialColor": "Blanco Nieve",
  "materialThickness": "16",
  "labor": 12000,
  "flete": 2500,
  "instalacion": 4800,
  "desinstalacion": 0,
  "hardware": {
    "correderas": { "enabled": true, "qty": 6 },
    "bisagras": { "enabled": false, "qty": 0 }
  },
  "materialSubtotal": 39000,
  "hardwareSubtotal": 3000,
  "laborSubtotal": 19500,
  "finalPrice": 61500
}
```

**PUT /cotizaciones/borrador/:id**  
Mismo body que POST (opcional incluir `_id`).

---

## 6. Materiales (prefijo: `/materiales`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/materiales/buscar?nombre=...` | No | Buscar por nombre |
| GET | `/materiales/verMateriales` | Sí | Listar materiales |
| GET | `/materiales/verMaterial/:id` | Sí | Un material por ID |
| POST | `/materiales/agregarMaterial` | Sí (admin) | Crear material |
| PUT | `/materiales/actualizarMaterial/:id` | Sí (admin) | Actualizar material |
| PUT | `/materiales/actualizarPrecio/:id` | Sí (admin) | Solo actualizar precio |
| DELETE | `/materiales/eliminarMaterial/:id` | Sí (admin) | Eliminar material |

**POST /materiales/agregarMaterial**
```json
{
  "nombre": "Melamina blanca 18mm",
  "descripcion": "Tablero melamina",
  "unidadMedida": "m",
  "precioUnitario": 650,
  "categoria": "Madera",
  "proveedor": "Proveedor XYZ",
  "seccion": "estructura"
}
```
`unidadMedida`: `m`, `m²`, `m³`, `unidad`, `caja`, `paquete`.  
`categoria`: `Madera`, `Metal`, `Piedra`, `Granito`, `Mármol`, `Acero Inoxidable`, `Pintura`, `Herrajes`, `Iluminación`, `Adhesivos`, `Otro`.  
`seccion` (opcional): `cubierta`, `estructura`, `vistas`, `cajones_puertas`, `accesorios_modulo`, `extraibles_puertas_abatibles`, `insumos_produccion`, `extras`, `gastos_fijos`.

**PUT /materiales/actualizarPrecio/:id**
```json
{
  "nuevoPrecio": 680
}
```

**GET /materiales/verMateriales**  
Query opcionales: `?categoria=Herrajes`, `?disponible=true`.

---

## 7. Diseños (prefijo: `/disenos`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/disenos/disponibles` | No | Diseños autorizados (público) |
| GET | `/disenos/verDisenos` | Sí (admin) | Todos los diseños |
| GET | `/disenos/verDiseno/:id` | Sí | Un diseño por ID |
| GET | `/disenos/pendientes` | Sí (admin) | Pendientes de autorizar |
| GET | `/disenos/arquitecto/:arquitectoId` | Sí | Por arquitecto |
| POST | `/disenos/agregarDiseno` | Sí | Crear diseño |
| POST | `/disenos/preliminar` | Sí (arquitecto) | Subir preliminar (orden) |
| PUT | `/disenos/:id/autorizar` | Sí (admin) | Autorizar diseño |
| PUT | `/disenos/:id/rechazar` | Sí (admin) | Rechazar diseño |
| PUT | `/disenos/actualizarDiseno/:id` | Sí | Actualizar diseño |
| DELETE | `/disenos/eliminarDiseno/:id` | Sí (admin) | Eliminar diseño |

**POST /disenos/agregarDiseno**  
Categoría debe ser una del enum (ej: `Minimalista`, `En "L"`).
```json
{
  "nombre": "Cocina minimalista L",
  "descripcion": "Diseño en L con isla",
  "imagenes": [],
  "categoria": "Minimalista",
  "estado": "borrador",
  "materiales": [
    { "materialId": "ID_MATERIAL_1", "cantidad": 10 },
    { "materialId": "ID_MATERIAL_2", "cantidad": 2 }
  ],
  "especificaciones": {
    "dimensiones": "3x2.4",
    "color": "Blanco",
    "estilo": "Minimalista"
  }
}
```

**POST /disenos/preliminar** (arquitecto, orden en `pendiente_diseño`)
```json
{
  "ordenTrabajoId": "ID_ORDEN_TRABAJO",
  "nombre": "Propuesta cocina cliente López",
  "descripcion": "Según especificaciones de la cita",
  "imagenes": [
    { "url": "https://...", "public_id": "cloud_xxx" }
  ],
  "categoria": "Minimalista",
  "materiales": [
    { "materialId": "ID_MATERIAL_1", "cantidad": 8 }
  ],
  "especificaciones": { "dimensiones": "3.2x2.4" }
}
```

**PUT /disenos/:id/rechazar**
```json
{
  "motivo": "Ajustar medidas de la isla"
}
```

---

## 8. Órdenes de trabajo (prefijo: `/ordenes`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/ordenes/progreso?numeroSeguimiento=...` | No | Progreso por id/número de seguimiento (público) |
| GET | `/ordenes/seguimiento/:numeroSeguimiento` | No | Estado por número (público) |
| GET | `/ordenes/todas` | Sí (admin) | Todas las órdenes |
| GET | `/ordenes/:id` | Sí | Una orden por ID |
| GET | `/ordenes/ingeniero/:ingenieroId` | Sí | Órdenes del ingeniero |
| GET | `/ordenes/pendientes/diseno` | Sí (arquitecto/admin) | Pendientes de diseño |
| POST | `/ordenes/crear` | Sí | Crear orden (citaId) |
| PUT | `/ordenes/:id/estado` | Sí | Cambiar estado |
| PUT | `/ordenes/:id/asignar-ingeniero` | Sí (admin) | Asignar ingeniero |
| POST | `/ordenes/:id/evidencia` | Sí | Agregar evidencia |
| PUT | `/ordenes/:id/finalizar` | Sí | Finalizar orden |

**GET /ordenes/progreso**  
Query: `?numeroSeguimiento=ABC12DEF` (solo se valida el id/número de la orden)

**POST /ordenes/crear**
```json
{
  "citaId": "ID_CITA_COMPLETADA",
  "ingenieroId": "ID_INGENIERO_O_NULL",
  "fechaEstimadaFinalizacion": "2025-05-01",
  "notasInternas": "Prioridad alta"
}
```

**PUT /ordenes/:id/estado**
```json
{
  "nuevoEstado": "compra_materiales",
  "comentario": "Materiales solicitados a almacén"
}
```
Estados: `pendiente_diseño`, `maquetacion`, `compra_materiales`, `fabricacion_iniciada`, `armado_final`, `fabricacion_lista`, `instalacion`, `completado`.

**PUT /ordenes/:id/asignar-ingeniero**
```json
{
  "ingenieroId": "ID_INGENIERO"
}
```

**POST /ordenes/:id/evidencia**
```json
{
  "tipo": "foto",
  "url": "https://cloudinary.com/...",
  "public_id": "evidencia_xyz",
  "descripcion": "Avance de estructura",
  "estado": "fabricacion_iniciada"
}
```
`tipo`: `foto`, `documento`, `video`. `estado`: mismo enum de la orden.

**PUT /ordenes/:id/finalizar**
```json
{
  "comentario": "Instalación completada"
}
```

---

## 9. Pagos (prefijo: `/pagos`) – Todas con auth

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/pagos` | Sí (admin) | Registrar pago |
| GET | `/pagos/orden/:ordenId` | Sí (admin/ingeniero) | Pagos de una orden |

**POST /pagos**
```json
{
  "ordenTrabajoId": "ID_ORDEN_TRABAJO",
  "monto": 15000,
  "concepto": "Anticipo 30%"
}
```

**GET /pagos/orden/:ordenId**  
Sin body. Respuesta: `{ "pagos": [...], "totalPagado": 15000 }`.

---

## Orden sugerido para probar

1. **Auth:** `POST /login` (o `POST /register`) y comprobar que se envía la cookie.
2. **Públicas:** `POST /contacto`, `POST /citas/agregarCita`, `GET /cotizaciones/config`, `GET /disenos/disponibles`.
3. **Citas:** con token, `GET /citas/getAllCitas`, `PUT /citas/:id/iniciar`, `PUT /citas/:id/finalizar`.
4. **Órdenes:** `GET /ordenes/todas`, `GET /ordenes/progreso?numeroSeguimiento=...`.
5. **Materiales:** `POST /materiales/agregarMaterial`, `GET /materiales/verMateriales`.
6. **Diseños:** `POST /disenos/agregarDiseno`, `GET /disenos/pendientes`, `PUT /disenos/:id/autorizar`.
7. **Cotizaciones:** `POST /cotizaciones/borrador`, `GET /cotizaciones`.
8. **Pagos:** `POST /pagos`, `GET /pagos/orden/:ordenId`.

---

## Colección Postman/Insomnia

- Base: `http://localhost:3000`.
- Auth por cookie: en la petición de login no borrar cookies; en el resto, enviar cookies automáticamente.
- Reemplazar `:id`, `:ordenId`, `:numeroSeguimiento`, `ID_MATERIAL_1`, etc. por IDs reales después de crear recursos.
