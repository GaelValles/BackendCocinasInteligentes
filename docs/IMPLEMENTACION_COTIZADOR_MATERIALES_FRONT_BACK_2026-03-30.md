# Implementacion Cotizador Materiales (Front + Backend)

Fecha: 2026-03-30
Scope: Cotizador Pro + Admin Precios + Catalogo compartido

## 1) Que se hizo

- Se integró `Cotizador Pro` con el catálogo backend compartido (`materiales` + `herrajes`).
- Se habilitó alta de materiales/herrajes desde el modal `Agregar material` en `Cotizador Pro` con persistencia real por API.
- Se habilitó edición y eliminación en `Cotizador Pro` para elementos sincronizados desde backend.
- Se mantuvo `Admin Precios` como gestor de catálogo backend (ya existente) para operar el mismo dataset.
- Se dejó sin dependencia de `localStorage` para catálogo en cotizadores y admin precios.
- Se conservó `runtimeStore` solo para contexto temporal de navegación de tareas/citas (no para catálogo).

## 2) Como se hizo

### 2.1 Integracion API en Cotizador Pro
Archivo: `src/app/dashboard/cotizador/page.tsx`

Se agregaron llamadas a:
- `obtenerMateriales`
- `obtenerHerrajes`
- `crearMaterial`
- `crearHerraje`
- `actualizarMaterial`
- `actualizarHerraje`
- `eliminarMaterial`
- `eliminarHerraje`

Flujo implementado:
1. Carga inicial de catálogo desde backend.
2. Merge no destructivo con secciones del cotizador para preservar estructura visual.
3. Normalización de campos backend a `CatalogoItem` interno.
4. Persistencia en backend al guardar desde modal.
5. Re-sincronización automática tras create/update/delete.

### 2.2 Mapeo de secciones del cotizador
Se agregó mapeo explícito entre sección visual y sección de backend:
- CUBIERTA -> `cubierta`
- ESTRUCTURA -> `estructura`
- VISTAS -> `vistas`
- ESPESOR -> `espesor` (fallback controlado)
- CAJONES Y PUERTAS -> `cajones_puertas`
- ACCESORIOS DE MODULO -> `accesorios_modulo`
- EXTRAIBLES Y PUERTAS ABATIBLES -> `extraibles_puertas_abatibles`
- INSUMOS DE PRODUCCION -> `insumos_produccion`
- EXTRAS -> `extras`
- GASTOS FIJOS -> `gastos_fijos`

### 2.3 Alta desde formulario (Cotizador Pro)
Al guardar en modal:
1. Se valida nombre y precio.
2. Se infiere `kind` (`material` o `herraje`) por sección.
3. Se normaliza unidad para API (`m`, `m²`, `unidad`, etc.).
4. Se envía `POST` al endpoint correspondiente.
5. Se refresca catálogo desde backend para mantener consistencia.

### 2.4 Edicion y eliminacion
- Solo aplica de forma persistente a ítems sincronizados con backend (`backendId`).
- Tras actualizar/eliminar, se recarga catálogo desde API.
- Si un ítem no está sincronizado, se muestra error controlado para evitar incoherencias.

## 3) Estado de localStorage

- `Cotizador Pro`: sin uso de `localStorage` para catálogo.
- `Admin Precios`: sin uso de `localStorage` para catálogo.
- `Cotizador Preliminar`: actualmente redirige a otro flujo y no gestiona catálogo local.

## 4) Lo que se espera del backend

Para escalabilidad y mantenibilidad, backend debe garantizar:

### 4.1 Rutas de catálogo estables
- GET `/api/catalogos/materiales`
- GET `/api/catalogos/herrajes`
- POST `/api/catalogos/materiales`
- POST `/api/catalogos/herrajes`
- PATCH `/api/catalogos/materiales/:id`
- PATCH `/api/catalogos/herrajes/:id`
- DELETE `/api/catalogos/materiales/:id`
- DELETE `/api/catalogos/herrajes/:id`

(Se mantienen fallbacks de rutas ya contemplados en `catalogosApi.ts`.)

### 4.2 Campos requeridos por item
- `_id`
- `nombre`
- `precioUnitario` (o `precioPorMetro` / `precioMetroLineal`)
- `unidadMedida`
- `categoria`
- `seccion`
- `idCotizador` (recomendado)
- `disponible`

### 4.3 Contrato de respuesta
Formato recomendado:
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

Para listados, `data` puede venir en:
- array directo
- `data.materiales`
- `data.herrajes`
- `data.items`

### 4.4 Reglas de negocio recomendadas
- `seccion` debe aceptarse para toda alta/edición del catálogo de cotizador.
- Validar unidades y categorías con enums consistentes.
- No sobrescribir `idCotizador` si ya existe salvo edición explícita.
- Responder el registro actualizado en PATCH para sincronización robusta.

## 5) Observaciones para mantenimiento

- El catálogo quedó centralizado por API y reusable entre vistas.
- La lógica de merge evita romper UI aun si backend trae datos parciales.
- El siguiente paso recomendado es extraer el mapeo sección<->payload a un módulo compartido (`src/lib/cotizador-catalog-map.ts`) para reducir acoplamiento en la página.
