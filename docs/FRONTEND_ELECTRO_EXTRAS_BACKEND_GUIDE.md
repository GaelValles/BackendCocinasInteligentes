# Integracion Frontend: Electrodomesticos y Extras

Este documento resume los cambios aplicados en frontend para desacoplar electrodomesticos/extras del flujo de materiales y dejar listo el contrato para backend (modelos, controladores y rutas).

## 1) Alcance funcional aplicado

- Electrodomesticos ahora se consumen desde una coleccion propia via API.
- Iluminacion tambien se consume desde la misma coleccion de electrodomesticos, filtrada por categoria (por ejemplo: `Iluminacion`, `Iluminación`, `Luz`).
- Se agrego una nueva seccion F de Extras en levantamiento detallado.
- Extras soporta categorias dinamicas (ademas de presets iniciales) y subtipos ilimitados.
- Tanto electrodomesticos como extras usan estructura base:
  - `nombre`
  - `precio`
  - `descripcion`
  - `imagenUrl`
- Frontend preparado para carga de imagen hacia Cloudinary por endpoint backend.
- Permisos en frontend:
  - `admin` y `empleado`: crear/editar
  - solo `admin`: eliminar

## 2) Cambios de frontend implementados

### 2.1 API client nuevo

Archivo:
- `src/lib/axios/equipamientoApi.ts`

Incluye operaciones CRUD con fallback de rutas para:
- electrodomesticos
- categorias de extras
- extras
- upload de imagen Cloudinary (via backend)

### 2.2 Context global nuevo

Archivo:
- `src/contexts/CatalogEquipamientoContext.tsx`

Responsabilidades:
- cargar catalogos de electrodomesticos/extras/categorias
- exponer metodos CRUD
- exponer `uploadImage(file)`
- exponer permisos `canMutate` y `canDelete` segun rol

### 2.3 Pantalla de gestion nueva

Archivo:
- `src/app/admin/equipamiento/page.tsx`

Capacidades:
- Tab Electrodomesticos: crear/editar/eliminar, subir imagen
- Tab Categorias de extras: presets + categorias dinamicas
- Tab Extras: crear/editar/eliminar, subir imagen

### 2.4 Integracion en layouts

Archivos:
- `src/app/admin/layout.tsx`
- `src/app/dashboard/layout.tsx`

Cambios:
- `CatalogEquipamientoProvider` agregado para que admin y dashboard consuman catalogos.
- Ruta nueva en sidebar admin: `/admin/equipamiento`.

### 2.5 Levantamiento detallado actualizado

Archivo:
- `src/app/dashboard/Levantamiento-detallado/page.tsx`

Cambios clave:
- Seccion C (electrodomesticos): ahora usa catalogo dinamico API.
- Seccion E (iluminacion): ahora usa items de la coleccion de electrodomesticos filtrados por categoria.
- Seccion F (extras): nueva seccion con
  - filtros por categoria
  - busqueda
  - seleccion multiple
  - captura de medidas opcionales
  - bloque "otro extra" con precio opcional
- El costo de "Iluminacion y extras" en estimacion ya suma:
  - iluminacion seleccionada
  - otro luminario
  - extras seleccionados
  - otro extra

### 2.6 Tipado de levantamiento

Archivo:
- `src/lib/levantamiento-catalog.ts`

Cambios:
- `sectionComments` extendido para incluir seccion `f`.
- calculo de complejidad (`levantamientoDetalleScopeMultiplier`) ahora considera `f`.

## 3) Contrato recomendado para backend

## 3.1 Modelos

### Electrodomestico
Campos minimos:
- `_id: ObjectId`
- `nombre: string` (required)
- `categoria: string` (required)
- `subtipo: string` (optional)
- `precio: number` (optional, default 0)
- `descripcion: string` (optional)
- `imagenUrl: string` (optional)
- `thumbnailUrl: string` (optional)
- `disponible: boolean` (default true)
- `createdBy: ObjectId` (opcional)
- `updatedBy: ObjectId` (opcional)
- timestamps

### ExtraCategoria
Campos minimos:
- `_id: ObjectId`
- `nombre: string` (required, unique sugerido)
- `descripcion: string` (optional)
- `orden: number` (optional)
- `disponible: boolean` (default true)
- timestamps

### Extra
Campos minimos:
- `_id: ObjectId`
- `nombre: string` (required)
- `categoriaId: ObjectId` (optional pero recomendado)
- `categoria: string` (required, denormalizado para lectura rapida)
- `subtipo: string` (optional)
- `precio: number` (optional, default 0)
- `descripcion: string` (optional)
- `imagenUrl: string` (optional)
- `thumbnailUrl: string` (optional)
- `disponible: boolean` (default true)
- timestamps

## 3.2 Controladores sugeridos

### ElectrodomesticosController
- `listar(req, res)`
  - filtros: `q`, `categoria`, `disponible`
- `crear(req, res)`
- `actualizar(req, res)`
- `eliminar(req, res)` (soft delete recomendado: `disponible=false`)

### ExtrasCategoriasController
- `listar(req, res)`
- `crear(req, res)`
- `actualizar(req, res)`
- `eliminar(req, res)`

### ExtrasController
- `listar(req, res)`
  - filtros: `q`, `categoria`, `categoriaId`, `disponible`
- `crear(req, res)`
- `actualizar(req, res)`
- `eliminar(req, res)` (soft delete recomendado)

### MediaController (Cloudinary)
- `uploadCloudinary(req, res)`
  - recibe multipart file
  - sube a Cloudinary
  - responde urls (`secureUrl`, `thumbnailUrl`, `publicId`)

## 3.3 Rutas recomendadas

Frontend ya contempla fallback para estas variantes:

- Electrodomesticos
  - `GET /api/electrodomesticos`
  - `POST /api/electrodomesticos`
  - `PATCH /api/electrodomesticos/:id`
  - `DELETE /api/electrodomesticos/:id`

- Categorias de extras
  - `GET /api/extras/categorias`
  - `POST /api/extras/categorias`
  - `PATCH /api/extras/categorias/:id`
  - `DELETE /api/extras/categorias/:id`

- Extras
  - `GET /api/extras`
  - `POST /api/extras`
  - `PATCH /api/extras/:id`
  - `DELETE /api/extras/:id`

- Upload Cloudinary
  - `POST /api/uploads/cloudinary`

## 3.4 Formato de respuesta esperado

Seguir contrato existente:

```json
{
  "success": true,
  "message": "...",
  "data": []
}
```

En errores validables, sugerido:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    { "field": "nombre", "message": "Nombre requerido" }
  ]
}
```

## 3.5 Permisos recomendados

- `admin`
  - CRUD completo en electrodomesticos/extras/categorias
- `empleado`
  - crear y editar
  - sin eliminar
- `arquitecto`
  - lectura (opcional segun negocio)

## 4) Notas de integracion

- La seleccion de cliente en levantamiento detallado no se persiste en BD por ahora (se mantiene enfoque global de catalogo).
- Se mantiene compatibilidad con flujo actual de cotizacion preliminar y PDF.
- Cuando backend quede listo, bastara con exponer rutas y contratos arriba para operar sin cambios estructurales adicionales en frontend.

## 5) Checklist de implementacion backend (orden recomendado)

Usa este orden para reducir retrabajo y dejar el frontend funcionando en cuanto antes.

### Fase 1: Modelos y esquema de datos

- [ ] Crear modelo `Electrodomestico` con campos:
  - [ ] `nombre` (required)
  - [ ] `categoria` (required)
  - [ ] `subtipo` (optional)
  - [ ] `precio` (number, default 0)
  - [ ] `descripcion` (optional)
  - [ ] `imagenUrl` (optional)
  - [ ] `thumbnailUrl` (optional)
  - [ ] `disponible` (boolean, default true)
  - [ ] timestamps
- [ ] Crear modelo `ExtraCategoria` con campos:
  - [ ] `nombre` (required, unique sugerido)
  - [ ] `descripcion` (optional)
  - [ ] `orden` (optional)
  - [ ] `disponible` (boolean, default true)
  - [ ] timestamps
- [ ] Crear modelo `Extra` con campos:
  - [ ] `nombre` (required)
  - [ ] `categoriaId` (ObjectId ref `ExtraCategoria`, opcional)
  - [ ] `categoria` (required, denormalizado)
  - [ ] `subtipo` (optional)
  - [ ] `precio` (number, default 0)
  - [ ] `descripcion` (optional)
  - [ ] `imagenUrl` (optional)
  - [ ] `thumbnailUrl` (optional)
  - [ ] `disponible` (boolean, default true)
  - [ ] timestamps

### Fase 2: Seed inicial

- [ ] Insertar categorias base de extras:
  - [ ] Alacena extraible
  - [ ] Bote de basura
  - [ ] Space tower
  - [ ] Mecanismos electricos
  - [ ] Sistemas inteligentes (alexa)
  - [ ] Esquinas magicas
  - [ ] Persianas enrollables
  - [ ] Botelleros/especiero/canastillas
- [ ] Verificar que frontend pueda listar presets mas categorias nuevas sin romper filtros.

### Fase 3: Controladores CRUD

- [ ] `ElectrodomesticosController`
  - [ ] `listar` con filtros `q`, `categoria`, `disponible`
  - [ ] `crear`
  - [ ] `actualizar`
  - [ ] `eliminar` (soft delete recomendado)
- [ ] `ExtrasCategoriasController`
  - [ ] `listar`
  - [ ] `crear`
  - [ ] `actualizar`
  - [ ] `eliminar`
- [ ] `ExtrasController`
  - [ ] `listar` con filtros `q`, `categoria`, `categoriaId`, `disponible`
  - [ ] `crear`
  - [ ] `actualizar`
  - [ ] `eliminar` (soft delete recomendado)

### Fase 4: Upload Cloudinary

- [ ] Implementar endpoint `POST /api/uploads/cloudinary` (multipart/form-data)
- [ ] Subir archivo a carpeta configurable (ej. `kuche/equipamiento`)
- [ ] Generar y devolver:
  - [ ] `secureUrl`
  - [ ] `thumbnailUrl` (transformacion recomendada)
  - [ ] `publicId`
  - [ ] `width`, `height`, `format` (opcional)
- [ ] Validar mime type y tamano maximo de archivo.

### Fase 5: Rutas

- [ ] Registrar rutas:
  - [ ] `GET/POST /api/electrodomesticos`
  - [ ] `PATCH/DELETE /api/electrodomesticos/:id`
  - [ ] `GET/POST /api/extras/categorias`
  - [ ] `PATCH/DELETE /api/extras/categorias/:id`
  - [ ] `GET/POST /api/extras`
  - [ ] `PATCH/DELETE /api/extras/:id`
  - [ ] `POST /api/uploads/cloudinary`

### Fase 6: Permisos y autorizacion

- [ ] Middleware de autenticacion en todas las rutas anteriores.
- [ ] Politica recomendada:
  - [ ] `admin`: CRUD completo
  - [ ] `empleado`: crear/editar/listar
  - [ ] `empleado`: sin eliminar
  - [ ] `arquitecto`: solo lectura (si aplica)
- [ ] Responder 403 consistente cuando no tenga permiso.

### Fase 7: Contrato de respuesta

- [ ] Asegurar formato uniforme:

```json
{
  "success": true,
  "message": "...",
  "data": []
}
```

- [ ] En validaciones, incluir arreglo `errors`:

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    { "field": "nombre", "message": "Nombre requerido" }
  ]
}
```

### Fase 8: Pruebas minimas (QA tecnico)

- [ ] Crear electrodomestico con imagen y validar que aparece en levantamiento (Seccion C o E segun categoria).
- [ ] Crear categoria de extra y crear extra con imagen dentro de esa categoria.
- [ ] Validar filtros por `categoria` y `q` en listados.
- [ ] Validar que `empleado` no puede eliminar.
- [ ] Validar soft delete (si se usa) y que `disponible=true` no regrese eliminados.
- [ ] Validar endpoint de Cloudinary con archivo invalido (esperar error controlado).

### Fase 9: Criterio de Done

- [ ] Frontend admin puede crear/editar/eliminar (segun rol) electrodomesticos y extras sin mocks.
- [ ] Levantamiento detallado consume datos reales desde API en Secciones C, E y F.
- [ ] Upload de imagen en frontend funciona contra backend + Cloudinary.
- [ ] Build frontend y smoke test de flujo principal pasan sin errores.
