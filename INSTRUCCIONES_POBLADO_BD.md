# Instrucciones para Poblar la Base de Datos

## Cambios Realizados

### 1. Eliminación de Datos Simulados
Se eliminaron los valores por defecto simulados (`BASE_MATERIALS_DEFAULT` y `HARDWARE_DEFAULT`) del controlador de cotizaciones. Ahora el sistema depende completamente de los datos en la base de datos.

### 2. Seguridad y Autenticación
Todas las rutas de materiales ahora requieren autenticación:
- ✅ **Agregar material**: Requiere autenticación de administrador
- ✅ **Buscar material**: Requiere autenticación de administrador
- ✅ **Actualizar material**: Requiere autenticación de administrador
- ✅ **Eliminar material**: Requiere autenticación de administrador
- ✅ **Ver materiales**: Requiere autenticación de administrador

### 3. Rutas de Cotización
- ✅ `/api/cotizaciones/config` - **PÚBLICA** (para clientes sin autenticación)
- ✅ Todas las demás rutas de cotización requieren autenticación

## Pasos para Llenar la Base de Datos

### Opción 1: Usar el Script de Seed (Recomendado)

El script `seedMaterialesCotizador.js` poblará automáticamente los materiales base del cotizador:

```bash
node src/scripts/seedMaterialesCotizador.js
```

Este script crea:
- **Materiales Base**: Melamina, MDF, Tech
- **Herrajes**: Correderas, Bisagras, Jaladeras, Bote de basura, Iluminación LED

### Opción 2: Agregar Materiales Manualmente via API

#### 1. Autenticarse como Admin

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@ejemplo.com",
  "password": "tu_password"
}
```

Guarda el token recibido.

#### 2. Agregar un Material Base

```bash
POST /api/materiales/agregarMaterial
Authorization: Bearer TU_TOKEN_AQUI
Content-Type: application/json

{
  "nombre": "Melamina",
  "descripcion": "Material base para cotizador",
  "unidadMedida": "m",
  "precioPorMetro": 6500,
  "categoria": "Madera",
  "idCotizador": "melamina",
  "disponible": true
}
```

#### 3. Agregar Herrajes

```bash
POST /api/materiales/agregarMaterial
Authorization: Bearer TU_TOKEN_AQUI
Content-Type: application/json

{
  "nombre": "Correderas cierre suave",
  "descripcion": "Herraje para cajones",
  "unidadMedida": "unidad",
  "precioUnitario": 500,
  "categoria": "Herrajes",
  "idCotizador": "correderas",
  "disponible": true
}
```

## Materiales Requeridos para el Cotizador

### Materiales Base (idCotizador requerido):
- `melamina` - Melamina (precioPorMetro)
- `mdf` - MDF (precioPorMetro)
- `tech` - Tech (precioPorMetro)

### Herrajes (idCotizador requerido):
- `correderas` - Correderas cierre suave (precioUnitario)
- `bisagras` - Bisagras 110° reforzadas (precioUnitario)
- `jaladeras` - Jaladeras minimalistas (precioUnitario)
- `bote` - Bote de basura extraíble (precioUnitario)
- `iluminacion` - Iluminación LED interior (precioUnitario)

## Comportamiento del Sistema

### Si NO hay materiales en la BD:
- La ruta `/api/cotizaciones/config` retornará arrays vacíos para `baseMaterials` y `hardwareCatalog`
- El cotizador del frontend no funcionará correctamente
- **Solución**: Ejecutar el script de seed o agregar materiales manualmente

### Si hay materiales en la BD:
- La ruta `/api/cotizaciones/config` retornará los materiales disponibles con sus precios actualizados
- El cotizador funcionará correctamente
- Los clientes pueden usar el cotizador sin autenticación
- Solo administradores autenticados pueden modificar materiales y crear cotizaciones

## Verificación

Para verificar que los materiales se agregaron correctamente:

```bash
GET /api/materiales/verMateriales
Authorization: Bearer TU_TOKEN_AQUI
```

O consulta la configuración del cotizador (sin autenticación):

```bash
GET /api/cotizaciones/config
```

## Notas Importantes

1. **idCotizador**: Este campo es crucial. Debe coincidir exactamente con los IDs esperados por el frontend
2. **Precios**: Los materiales base usan `precioPorMetro`, los herrajes usan `precioUnitario`
3. **Disponible**: Solo materiales con `disponible: true` aparecerán en el cotizador
4. **Autenticación**: Solo usuarios autenticados con rol de administrador pueden gestionar materiales
