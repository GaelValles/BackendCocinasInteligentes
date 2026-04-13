# 🚀 INICIO RÁPIDO - Testing Local

## ⚡ En 3 Pasos

### 1. Verificar Setup
```bash
node src/scripts/verify-local-setup.js
```
Deberías ver: ✅ 6 pasados, 0 fallidos

### 2. Iniciar Servidor
```bash
npm run dev
```
Deberías ver: ✓ Server running on port 3000

### 3. Probar Endpoints
```bash
# Listar electrodomésticos (público)
curl http://localhost:3000/api/electrodomesticos

# Listar categorías de extras (público)
curl http://localhost:3000/api/extras/categorias

# Para crear/editar/eliminar necesitas token (ver LOCAL_TESTING_GUIDE.md)
```

## 📚 Documentación Completa

Ver [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md) para:
- Ejemplos completos con curl
- Cómo obtener token de autenticación
- Pruebas de upload de imágenes
- Troubleshooting

## 📝 Estado Actual

- ✅ Rama: `add-cotizaciones`
- ✅ NODE_ENV: `development` (local)
- ✅ MongoDB: Conectado (8 categorías de extras listas)
- ✅ Variables de entorno: Todas configuradas
- ✅ Modelos: 3 (Electrodomestico, ExtraCategoria, Extra)
- ✅ Controladores: 3 (CRUD completo)
- ✅ Rutas: 2 archivos (electrodomesticos, extras)

## 🔄 Si Necesitas Cambiar de Rama

```bash
# Volver a main
git checkout main

# O crear una nueva rama
git checkout -b feature/nueva-feature

# Volver a add-cotizaciones
git checkout add-cotizaciones
```

---

**Rama**: add-cotizaciones  
**Entorno**: Development Local  
**Último Update**: Abril 12, 2026
