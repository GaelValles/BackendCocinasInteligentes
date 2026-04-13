# 🧪 Guía de Pruebas Locales - Electrodomésticos y Extras

## 🚀 Preparación Inicial

### 1. Verificar Setup
```bash
# Navega al backend
cd "C:\Users\yanez\OneDrive\Escritorio\backendCocinasInteligentes\Backend"

# Ejecuta script de verificación
node src/scripts/verify-local-setup.js
```

Expected output:
```
✓ Conexión a MongoDB
✓ Categorías de Extras (8 encontradas)
✓ Modelo Electrodomestico
✓ Modelo Extra
✓ Variables de Entorno
✓ Entorno de Ejecución = development

🎉 ¡Todo está listo para pruebas locales!
```

### 2. Iniciar Servidor Local
```bash
npm run dev
```

Expected output:
```
Conectado a MongoDB Clientes
Server running on port 3000
```

## 🔑 Autenticación para Pruebas

Necesitas un token JWT para pruebas de endpoints protegidos (POST, PATCH, DELETE).

### Opción A: Login como Admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kuche.com",
    "password": "YourAdminPassword"
  }'
```

Respuesta esperada:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "_id": "...",
      "email": "admin@kuche.com",
      "rol": "admin"
    }
  }
}
```

Copiar el token y usarlo en próximas peticiones como:
```
Authorization: Bearer <TOKEN_AQUÍ>
```

### Opción B: Token de Prueba Directo

Si no tienes admin, puedes modificar temporalmente un controlador para dev o crear un admin directamente en MongoDB.

## 📋 Endpoints para Probar

### 1. LISTAR ELECTRODOMÉSTICOS (Público)

```bash
# Todos disponibles
curl http://localhost:3000/api/electrodomesticos

# Con filtros
curl "http://localhost:3000/api/electrodomesticos?disponible=true"
curl "http://localhost:3000/api/electrodomesticos?q=led"
curl "http://localhost:3000/api/electrodomesticos?categoria=iluminacion"
```

Expected (vacío inicialmente, se llena tras crear):
```json
{
  "success": true,
  "data": []
}
```

### 2. CREAR ELECTRODOMÉSTICO (Protegido)

```bash
curl -X POST http://localhost:3000/api/electrodomesticos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "nombre": "Refrigerador Samsung RS28",
    "categoria": "Electrodomésticos",
    "precio": 8500,
    "descripcion": "Refrigerador de 2 puertas con dispensador"
  }'
```

Expected:
```json
{
  "success": true,
  "message": "Electrodoméstico creado correctamente",
  "data": {
    "_id": "...",
    "nombre": "Refrigerador Samsung RS28",
    "categoria": "Electrodomésticos",
    "precio": 8500,
    "createdAt": "2026-04-12T..."
  }
}
```

Copiar el `_id` para pruebas posteriores.

### 3. ACTUALIZAR ELECTRODOMÉSTICO (Protegido)

```bash
curl -X PATCH http://localhost:3000/api/electrodomesticos/COPIAR_ID_AQUI \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "precio": 7999,
    "disponible": true
  }'
```

### 4. ELIMINAR ELECTRODOMÉSTICO (Admin Only)

```bash
curl -X DELETE http://localhost:3000/api/electrodomesticos/COPIAR_ID_AQUI \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 5. LISTAR CATEGORÍAS DE EXTRAS (Público)

```bash
curl http://localhost:3000/api/extras/categorias
```

Expected:
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "nombre": "Alacena extraible",
      "orden": 1,
      "disponible": true
    },
    ...
  ]
}
```

### 6. CREAR EXTRA (Protegido)

```bash
curl -X POST http://localhost:3000/api/extras \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "nombre": "Alacena extraible gris",
    "categoria": "Alacena extraible",
    "precio": 1500,
    "descripcion": "Alacena extraible de aluminio"
  }'
```

### 7. LISTAR EXTRAS CON FILTROS (Público)

```bash
# Por categoría
curl "http://localhost:3000/api/extras?categoria=Alacena%20extraible"

# Con búsqueda
curl "http://localhost:3000/api/extras?q=gris"

# Solo disponibles
curl http://localhost:3000/api/extras?disponible=true
```

## 📤 UPLOAD DE IMÁGENES

### Crear Extra con Imagen (Paso 1: Upload)

```bash
# Asume que tienes un archivo imagen.jpg en el directorio actual
curl -X POST http://localhost:3000/api/extras/upload/imagen \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@imagen.jpg"
```

Expected:
```json
{
  "success": true,
  "message": "Imagen subida correctamente",
  "data": {
    "secureUrl": "https://res.cloudinary.com/dci9m49qc/image/upload/v1712973...",
    "thumbnailUrl": "https://res.cloudinary.com/dci9m49qc/image/upload/v1712973...",
    "publicId": "kuche/extras/imagen_xyz123",
    "width": 1200,
    "height": 800
  }
}
```

### Crear Extra con URL de Imagen (Paso 2: POST)

Usa las URLs del paso anterior:

```bash
curl -X POST http://localhost:3000/api/extras \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "nombre": "Alacena extraible gris",
    "categoria": "Alacena extraible",
    "precio": 1500,
    "descripcion": "Alacena extraible de aluminio",
    "imagenUrl": "https://res.cloudinary.com/dci9m49qc/image/upload/v1712973...",
    "thumbnailUrl": "https://res.cloudinary.com/dci9m49qc/image/upload/v1712973..."
  }'
```

## 🧪 Flux de Prueba Completo

1. **Login** → Obtener token
2. **Listar categorías de extras** → Verifica que existen 8
3. **Crear electrodoméstico** → Copiar ID
4. **Listar electrodomésticos** → Verifica que aparece
5. **Actualizar electrodoméstico** → Cambiar precio
6. **Crear extra** → Con categoría existente
7. **Listar extras** → Con filtros
8. **Upload imagen** → Obtener URLs
9. **Actualizar extra** → Con imágenes
10. **Eliminar** (como admin) → Verificar que desaparece

## 🐛 Troubleshooting

### "Unauthorized" Error
- ✓ Verifica que pasás el token en el header `Authorization: Bearer TOKEN`
- ✓ Verifica que el token no expiró
- ✓ Verifica que el usuario existe en admin.model

### "ENOENT: mkdir..." Error
- ✓ Solo en Vercel, local no debería tener este problema

### "Operation buffering timeout" Error
- ✓ Verifica que MongoDB Atlas está accesible
- ✓ Verifica que tu IP está en Network Access whitelist de Atlas
- ✓ Para dev local, es preferible usar MongoDB local en lugar de Atlas

### "Cloudinary error" en upload
- ✓ Verifica que CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET están en .env
- ✓ Verifica que las credenciales son correctas

## 🔄 Resync con Rama Main (Si es necesario)

Si en algún momento necesitas sincronizar con main:

```bash
# Desde add-cotizaciones
git fetch origin
git rebase origin/main

# Si hay conflictos, resolverlos y:
git rebase --continue

# Luego push:
git push origin add-cotizaciones --force-with-lease
```

## 📝 Notas para Dev

- La rama `add-cotizaciones` es para desarrollo de nuevas features
- Los cambios en `.env` son locales, no se comitean
- `NODE_ENV=development` en local, `production` en Vercel
- Los scripts de seed ya fueron ejecutados, pero puedes re-ejecutarlos sin problema (upsert)

## ✅ Checklist Antes de Producción

- [ ] Todos los tests locales pasan
- [ ] Upload de imágenes funciona correctamente
- [ ] Permisos (admin/empleado) funcionan
- [ ] Filtros y búsqueda funcionan
- [ ] Frontend integrado correctamente
- [ ] No hay console.errors en servidor
- [ ] Performance aceptable (<2s por request)

---

**Rama**: add-cotizaciones  
**Entorno**: Local Development  
**Última actualización**: Abril 12, 2026
