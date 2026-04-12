# Implementación Backend: Electrodomésticos y Extras

## 📋 Resumen de Implementación

Se ha implementado un sistema completo de gestión de electrodomésticos y extras en el backend, alineado con los cambios realizados en el frontend. Esta implementación permite:

- Gestión dinámica de catálogos de electrodomésticos (Sección C del levantamiento)
- Filtrado por iluminación desde el mismo catálogo (Sección E del levantamiento)
- Gestión completa de extras por categoría (Sección F del levantamiento)
- Categorías predeterminadas de extras inicializa automáticamente
- Subida de imágenes a Cloudinary con gestión de thumbnails
- Control de permisos basado en roles (admin, empleado, arquitecto)

## 🗂️ Archivos Creados

### Modelos
1. **src/models/electrodomestico.model.js**
   - Schema con campos: nombre, categoria, subtipo, precio, descripcion, imagenUrl, thumbnailUrl, disponible
   - Referencias a Admin para createdBy y updatedBy
   - Timestamps automáticos

2. **src/models/extraCategoria.model.js**
   - Schema para categorías de extras: nombre (unique), descripcion, orden, disponible
   - Permite gestión dinámica de categorías

3. **src/models/extra.model.js**
   - Schema completo con: nombre, categoriaId, categoria (denormalizado), subtipo, precio, descripcion, imagenUrl, thumbnailUrl, disponible
   - Referencia a ExtraCategoria para integridad referencial

### Controladores
1. **src/controllers/electrodomesticos.controller.js**
   - `listarElectrodomesticos()`: GET con filtros q, categoria, disponible
   - `crearElectrodomestico()`: POST (auth required, empleado+)
   - `actualizarElectrodomestico()`: PATCH (auth required, empleado+)
   - `eliminarElectrodomestico()`: DELETE (admin only)
   - `uploadImagenCloudinary()`: POST para subir imagen a Cloudinary

2. **src/controllers/extrasCategoria.controller.js**
   - `listarExtrasCategorias()`: GET sin filtros
   - `crearExtraCategoria()`: POST (auth required, empleado+)
   - `actualizarExtraCategoria()`: PATCH (auth required, empleado+)
   - `eliminarExtraCategoria()`: DELETE (admin only)
   - Valida uniqueness del nombre de categoría

3. **src/controllers/extras.controller.js**
   - `listarExtras()`: GET con filtros q, categoria, categoriaId, disponible
   - `crearExtra()`: POST (auth required, empleado+)
   - `actualizarExtra()`: PATCH (auth required, empleado+)
   - `eliminarExtra()`: DELETE (admin only)
   - `uploadImagenCloudinary()`: POST para subir imagen a Cloudinary

### Rutas
1. **src/routes/electrodomesticos.routes.js**
   - `GET /api/electrodomesticos` (público): Listar todos disponibles
   - `POST /api/electrodomesticos` (auth): Crear nuevo
   - `PATCH /api/electrodomesticos/:id` (auth): Actualizar
   - `DELETE /api/electrodomesticos/:id` (auth): Eliminar
   - `POST /api/electrodomesticos/upload/imagen` (auth): Subir imagen

2. **src/routes/extras.routes.js**
   - `GET /api/extras/categorias` (público): Listar categorías
   - `POST /api/extras/categorias` (auth): Crear categoría
   - `PATCH /api/extras/categorias/:id` (auth): Actualizar categoría
   - `DELETE /api/extras/categorias/:id` (auth): Eliminar categoría
   - `GET /api/extras` (público): Listar extras
   - `POST /api/extras` (auth): Crear extra
   - `PATCH /api/extras/:id` (auth): Actualizar extra
   - `DELETE /api/extras/:id` (auth): Eliminar extra
   - `POST /api/extras/upload/imagen` (auth): Subir imagen

### Scripts
1. **src/scripts/seedExtrasCategorias.js**
   - Crea 8 categorías predeterminadas:
     - Alacena extraible
     - Bote de basura
     - Space tower
     - Mecanismos eléctricos
     - Sistemas inteligentes
     - Esquinas mágicas
     - Persianas enrollables
     - Botelleros/especiero/canastillas

## ✅ Alteraciones a Archivos Existentes

### src/app.js
- Importados: `electrodomesticosRoutes` y `extrasRoutes`
- Montadas rutas: `/api/electrodomesticos` y `/api/extras`
- Actualizado health check endpoint con nuevas rutas

## 🔐 Permisos Implementados

| Rol | Listar | Crear | Editar | Eliminar |
|-----|--------|-------|--------|----------|
| Público | ✓ | ✗ | ✗ | ✗ |
| Empleado | ✓ | ✓ | ✓ | ✗ |
| Admin | ✓ | ✓ | ✓ | ✓ |

## 📤 Formato de Respestasa

### Éxito
```json
{
  "success": true,
  "message": "Descripción",
  "data": { /* objeto o array */ }
}
```

### Error de Validación
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    { "field": "nombre", "message": "Nombre requerido" }
  ]
}
```

### Error General
```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "Detalles del error"
}
```

## 🚀 Configuración de Multer

- Storage: Memory (temporal, para upload a Cloudinary)
- Tipos permitidos: JPEG, PNG, WebP
- Tamaño máximo: 5MB
- Validación MIME type y extensión

## 📝 Ejemplos de Uso

### Listar electrodomésticos disponibles
```bash
GET /api/electrodomesticos?disponible=true&q=led
```

### Crear electrodoméstico
```bash
POST /api/electrodomesticos
Authorization: Bearer <token>
Content-Type: application/json

{
  "nombre": "Refrigerador Samsung",
  "categoria": "Electrodomésticos",
  "precio": 8500,
  "descripcion": "Refrigerador de 2 puertas"
}
```

### Subir imagen de electrodoméstico
```bash
POST /api/electrodomesticos/upload/imagen
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <imagen.jpg>
```

### Listar extras por categoría
```bash
GET /api/extras?categoria=Alacena%20extraible
```

### Crear extra categoría
```bash
POST /api/extras/categorias
Authorization: Bearer <token>
Content-Type: application/json

{
  "nombre": "Accesorios especiales",
  "descripcion": "Categoría para accesorios únicos"
}
```

## ✨ Características Especiales

1. **Filtrado Inteligente**: Búsqueda por texto normalizado y regex seguro
2. **Denormalización**: Campo `categoria` en extras para lectura rápida sin joins
3. **Soft Delete**: Uso de flag `disponible` en lugar de eliminar registros
4. **Cloudinary Integration**: Subida y gestión de imágenes con folder organization (`kuche/equipamiento`, `kuche/extras`)
5. **Timestamps**: Tracks automáticos de creación y actualización
6. **Lean Queries**: Optimización de BD con `.lean()` en queries de lectura

## 📚 Integración con Frontend

El backend está listo para soportar:

- **Admin Panel**: CRUD completo de electrodomésticos y extras
- **Levantamiento Detallado**:
  - Sección C: Electrodomésticos con búsqueda y filtros
  - Sección E: Iluminación filtrada desde electrodomésticos
  - Sección F: Extras con categorías dinámicas y subtipos ilimitados
- **Carga de Imágenes**: Upload directo a Cloudinary con URLs seguras

## 🧪 Testing Recomendado

Usar el script `seedExtrasCategorias.js` ya ejecutado para inicializar categorías.

```bash
# En desarrollo
npm run dev

# Probar endpoints
curl http://localhost:3000/api/electrodomesticos
curl http://localhost:3000/api/extras
curl http://localhost:3000/api/extras/categorias
```

## 📌 Notas Importantes

1. **Token Requerido**: Todos los endpoints mutables (POST, PATCH, DELETE) requieren autenticación
2. **Validación de Rol**: Admin y Empleado pueden crear/editar, solo Admin puede eliminar
3. **Cloudinary**: Requiere CLOUDINARY_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET en .env
4. **Disponibilidad**: Flag `disponible: true` es el filtro por defecto en listados
5. **Denormalización de Categoría**: En extras, el campo `categoria` se mantiene separadamente del ID por performance

---

**Fecha**: Abril 12, 2026  
**Status**: ✅ Implementación Completa  
**Próximos Pasos**: Deploy a Vercel y testing con frontend
