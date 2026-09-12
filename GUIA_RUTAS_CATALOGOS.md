# Guía de rutas de Catálogos: Materiales, Herrajes, Electrodomésticos y Extras

Rutas montadas en `app.js`:
- `/api/materiales` → `materiales.routes.js`
- `/api/herrajes` → `herrajes.routes.js` (usa el mismo controlador/modelo de materiales, filtrando `seccion: 'herrajes'`)
- `/api/electrodomesticos` → `electrodomesticos.routes.js`
- `/api/extras` → `extras.routes.js`
- `/api/catalogos` (y alias `/api/catalogo`) → agrupa lectura de todos los catálogos + algunos endpoints admin duplicados

Auth: las rutas de **lectura (GET)** son públicas (no requieren token) salvo que se indique lo contrario. Las de **creación/edición/borrado** requieren `Authorization: Bearer <token>` (`authRequired`) y rol `admin` (algunas también aceptan `empleado`, se indica en cada caso).

---

## 1. Materiales (`/api/materiales`)

### `GET /api/materiales` o `GET /api/materiales/verMateriales`
Lista materiales. Público.

**Query params opcionales:**
| Param | Uso |
|---|---|
| `disponible` | `true`/`false` (default: no filtra) |
| `seccion` | una sección (ver enum abajo) |
| `secciones` | varias, separadas por coma |
| `proveedor` | texto (regex insensible a mayúsculas) |
| `q` | busca en `nombre`, `descripcion`, `idCotizador`, `proveedor` |

Respuesta `data[]`, cada item:
```jsonc
{
  "_id": "...",
  "id": "melamina",            // = idCotizador si existe, si no el _id
  "idCotizador": "melamina",
  "nombre": "Melamina Blanca",
  "descripcion": "",
  "unidadMedida": "m2",
  "precioUnitario": 120,
  "precioPorMetro": null,
  "precioMetroLineal": null,    // alias de precioPorMetro
  "seccion": "cubierta",
  "proveedor": "Proveedor X",
  "image": "https://...",
  "gama": "Tendencia",          // alias: tier
  "tier": "Tendencia",
  "disponible": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `GET /api/materiales/:id` o `/verMaterial/:id`
Detalle completo (incluye `historialPrecios` poblado con nombre de quien modificó). Público.

### `GET /api/materiales/buscar?nombre=...`
Busca material exacto (case-insensitive) por nombre, útil para evitar duplicados antes de crear. Requiere auth. Respuesta: `{ data: { existe: boolean, material? } }`.

### `POST /api/materiales` o `/agregarMaterial` (solo admin)
Body:
```jsonc
{
  "nombre": "Melamina Blanca",        // requerido
  "unidadMedida": "m2",               // requerido: m2|m3|m|unidad|caja|paquete|placas|hoja|pies
  "precioUnitario": 120,              // requerido precioUnitario O precioPorMetro
  "precioPorMetro": null,             // alias aceptado: precioMetroLineal
  "descripcion": "",
  "seccion": "cubierta",              // opcional. Enum: cubierta, estructura, vistas, espesor, herrajes, cajones_puertas, accesorios_modulo, extraibles_puertas_abatibles, insumos_produccion, otros, gastos_fijos
  "proveedor": "Proveedor X",
  "image": "https://...",
  "gama": "Tendencia",                // o "tier". Se normaliza a: Estandar | Tendencia | Premium (default Tendencia)
  "idCotizador": "melamina",          // opcional, único, usado por el cotizador frontend
  "disponible": true
}
```
- Rechaza si ya existe un material con el mismo `nombre` (409).
- Guarda automáticamente el primer registro en `historialPrecios`.

### `PUT /api/materiales/actualizarPrecio/:id` (solo admin)
Body:
```json
{ "nuevoPrecio": 135 }
```
Actualiza solo el precio (guarda el precio anterior en `historialPrecios` vía método del modelo `actualizarPrecio`).

### `PUT/PATCH /api/materiales/:id` o `/actualizarMaterial/:id` (solo admin)
Mismo body que crear pero todo opcional. Alias `precio` también aceptado (actualiza `precioPorMetro` si ya existe, si no `precioUnitario`, guardando historial). Cambiar `precioUnitario` directamente también registra historial.

### `DELETE /api/materiales/:id` o `/eliminarMaterial/:id` (solo admin)
Elimina definitivamente.

---

## 2. Herrajes (`/api/herrajes`)
Los "herrajes" **no tienen modelo propio**: son materiales con `seccion: 'herrajes'`. Se reusa el controlador de materiales.

### `GET /api/herrajes`
Lista solo materiales de la sección `herrajes` (equivalente a `GET /api/materiales?seccion=herrajes`). Público.

### `POST /api/herrajes` (solo admin)
Igual que crear material, pero si no mandas `seccion` se fuerza `'herrajes'` y si no mandas `unidadMedida` se usa `'unidad'` por default.

### `PATCH /api/herrajes/:id`, `DELETE /api/herrajes/:id` (solo admin)
Igual que actualizar/eliminar material (mismo controlador, mismas reglas).

> También puedes gestionar herrajes vía `/api/catalogos/herrajes` (alias, mismo comportamiento).

---

## 3. Electrodomésticos (`/api/electrodomesticos`)

### `GET /api/electrodomesticos/categorias`
Lista categorías (fusiona categorías configuradas en `ElectrodomesticoCategoria` + nombres de categoría usados libremente en electrodomésticos existentes). Público.
```jsonc
{ "data": [ { "_id": "...", "nombre": "Refrigeración", "descripcion": "", "orden": 0, "disponible": true } ] }
```

### `GET /api/electrodomesticos`
Lista electrodomésticos. Público.

**Query params opcionales:**
| Param | Uso |
|---|---|
| `disponible` | `true`/`false` (default `true`) |
| `categoriaId` | id de categoría o nombre; resuelve por id primero, luego por nombre exacto |
| `categoria` | nombre exacto de categoría (regex insensible a mayúsculas) |
| `q` | busca en `nombre`, `descripcion` |

Respuesta: cada item trae todos los campos del modelo + `categoriaId` resuelto si faltaba.

### `POST /api/electrodomesticos` (admin o empleado)
Body:
```jsonc
{
  "nombre": "Refrigerador 2 puertas",   // requerido
  "categoria": "Refrigeración",          // requerido si no mandas categoriaId
  "categoriaId": "<id categoría>",       // opcional, si existe sobreescribe el nombre de categoria con el de la categoría encontrada
  "subtipo": "Built-in",
  "precio": 25000,
  "descripcion": "",
  "imagenUrl": "https://res.cloudinary.com/...",
  "thumbnailUrl": "https://res.cloudinary.com/..."
}
```

### `PATCH /api/electrodomesticos/:id` (admin o empleado)
Todos los campos anteriores opcionales, más `disponible` (boolean). Si mandas `categoriaId` vacío/null, se limpia la relación.

### `DELETE /api/electrodomesticos/:id` (solo admin)

### `POST /api/electrodomesticos/upload/imagen` (admin o empleado, requiere auth)
`multipart/form-data` con campo `file` (imagen JPEG/PNG/WebP, máx 5MB). Sube a Cloudinary carpeta `kuche/equipamiento`.
Respuesta:
```json
{
  "data": {
    "secureUrl": "https://res.cloudinary.com/...",
    "thumbnailUrl": "https://res.cloudinary.com/...",
    "publicId": "...",
    "width": 800,
    "height": 600,
    "format": "jpg"
  }
}
```
Usa `secureUrl`/`thumbnailUrl` de la respuesta como `imagenUrl`/`thumbnailUrl` al crear o actualizar el electrodoméstico.

> Nota: `ElectrodomesticoCategoria` no tiene endpoints propios de crear/actualizar/eliminar expuestos en estas rutas (solo lectura vía `/categorias`).

---

## 4. Extras (`/api/extras`)

### Categorías de extras
- `GET /api/extras/categorias` — Público. Lista `ExtraCategoria` disponibles.
- `POST /api/extras/categorias` (admin o empleado):
  ```json
  { "nombre": "Iluminación LED", "descripcion": "", "orden": 0 }
  ```
  Rechaza si ya existe una categoría con ese `nombre` exacto.
- `PATCH /api/extras/categorias/:id` (admin o empleado): mismos campos opcionales + `disponible`.
- `DELETE /api/extras/categorias/:id` (solo admin).

### Extras
`GET /api/extras` — Público.

**Query params opcionales:**
| Param | Uso |
|---|---|
| `disponible` | `true`/`false` (default `true`) |
| `categoria` | nombre (regex insensible a mayúsculas) |
| `categoriaId` | id exacto de `ExtraCategoria` |
| `q` | busca en `nombre`, `descripcion` |

`POST /api/extras` (admin o empleado):
```jsonc
{
  "nombre": "Barra desayunador",       // requerido
  "categoria": "Mobiliario extra",     // requerido (texto libre, no se valida contra categoriaId)
  "categoriaId": "<id ExtraCategoria>",// opcional, referencia
  "subtipo": "Madera",
  "precio": 3500,
  "descripcion": "",
  "imagenUrl": "https://...",
  "thumbnailUrl": "https://..."
}
```

`PATCH /api/extras/:id` (admin o empleado): mismos campos opcionales + `disponible`.

`DELETE /api/extras/:id` (solo admin).

`POST /api/extras/upload/imagen` (admin o empleado, requiere auth): igual que electrodomésticos pero sube a carpeta `kuche/extras`. Mismo formato de respuesta.

---

## 5. Endpoint agregador `/api/catalogos` (y alias `/api/catalogo`)
Útil si el frontend quiere golpear un solo prefijo para lectura de catálogos:

| Ruta | Equivale a |
|---|---|
| `GET /api/catalogos/materiales` | `GET /api/materiales` |
| `GET /api/catalogos/herrajes` | `GET /api/herrajes` |
| `GET /api/catalogos/colores` | catálogo de colores fijo |
| `GET /api/catalogos/tipos-proyecto` | catálogo fijo |
| `GET /api/catalogos/tipos-cubierta` | catálogo fijo |
| `GET /api/catalogos/escenarios-levantamiento` | catálogo fijo |
| `GET /api/catalogos/escenarios-cotizador` | catálogo fijo |
| `GET /api/catalogos/empleados` (requiere auth) | lista de empleados/admins |
| `POST/PATCH/DELETE /api/catalogos/materiales(/:id)` | igual que en `/api/materiales` (solo admin) |
| `POST/PATCH/DELETE /api/catalogos/herrajes(/:id)` | igual que en `/api/herrajes` (solo admin) |

No expone rutas propias para electrodomésticos/extras; usa directamente `/api/electrodomesticos` y `/api/extras` para esos.

---

## Resumen rápido para el frontend
1. **Mostrar catálogos en el cotizador/formularios:** `GET /api/materiales`, `GET /api/herrajes`, `GET /api/electrodomesticos` (+ `/categorias`), `GET /api/extras` (+ `/categorias`). Todos públicos, sin token.
2. **Panel de administración (crear/editar/borrar):** usar los mismos recursos con método POST/PATCH/DELETE + token de admin (electrodomésticos y extras también aceptan rol `empleado`, salvo borrar que es solo `admin`).
3. **Subir imágenes:** primero `POST /api/electrodomesticos/upload/imagen` o `POST /api/extras/upload/imagen` con el archivo, luego usar la URL devuelta en el body de crear/actualizar.
4. **Materiales vs Herrajes:** son la misma colección; un herraje es simplemente un material con `seccion: 'herrajes'`. No dupliques lógica de frontend, solo cambia el filtro/endpoint.
