# 🚀 Integración Frontend-Backend Lista

## ✅ Estructura de Axios Creada

Se ha creado una estructura profesional y organizada de Axios en `src/lib/axios/` con los siguientes archivos:

### Archivos Creados

1. **`axiosConfig.ts`** - Configuración base con interceptores
   - Maneja tokens JWT automáticamente
   - Interceptores de request/response
   - Manejo de errores global
   - Redirección automática en 401

2. **`authApi.ts`** - API de autenticación
   - login()
   - register()
   - logout()
   - getCurrentUser()
   - isAuthenticated()
   - getUserFromStorage()
   - updatePassword()
   - requestPasswordReset()
   - resetPassword()

3. **`levantamientosApi.ts`** - API de levantamientos rápidos
   - crearLevantamiento()
   - listarLevantamientos()
   - obtenerLevantamiento()
   - actualizarLevantamiento()
   - cambiarEstadoLevantamiento()
   - asignarEmpleadoLevantamiento()
   - eliminarLevantamiento()
   - convertirLevantamientoACotizacion()

4. **`cotizacionesApi.ts`** - API de cotizaciones detalladas
   - obtenerConfigCotizador() (PÚBLICA)
   - crearCotizacion()
   - guardarBorrador()
   - listarCotizaciones()
   - obtenerCotizacion()
   - actualizarCotizacion()
   - cambiarEstadoCotizacion()
   - eliminarCotizacion()
   - generarPDFCliente()
   - generarHojaTaller()

5. **`catalogosApi.ts`** - API de catálogos
   - obtenerMateriales()
   - obtenerHerrajes()
   - obtenerColores()
   - obtenerTiposProyecto()
   - obtenerTiposCubierta()

6. **`usuariosApi.ts`** - API de usuarios/empleados
   - listarUsuarios()
   - listarEmpleados()
   - obtenerUsuario()

7. **`index.ts`** - Exportaciones centralizadas
   - Exporta todas las APIs
   - Exporta todos los tipos TypeScript

8. **`README.md`** - Documentación completa
   - Ejemplos de uso
   - Guías de implementación
   - Formato de respuestas
   - Manejo de errores

### Archivos de Configuración

9. **`.env.local`** - Variables de entorno
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

10. **`package.json`** - Actualizado con axios

---

## 📦 Tipos TypeScript Completos

Todos los endpoints tienen:
- ✅ Tipos de entrada (request)
- ✅ Tipos de salida (response)
- ✅ Tipos de filtros
- ✅ Tipos de estados
- ✅ IntelliSense completo

---

## 🎯 Próximos Pasos

### 1. Instalar Dependencias

```bash
npm install
```

Esto instalará axios (agregado al package.json)

### 2. Conectar Páginas con el Backend

#### Ejemplo: Página de Login

```typescript
// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { authApi } from '@/lib/axios';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await authApi.login({ email, password });
      
      if (response.success) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Tu formulario aquí */}
    </form>
  );
}
```

#### Ejemplo: Página de Levantamientos

```typescript
// src/app/dashboard/levantamiento/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { levantamientosApi } from '@/lib/axios';
import type { Levantamiento } from '@/lib/axios';

export default function LevantamientoPage() {
  const [levantamientos, setLevantamientos] = useState<Levantamiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarLevantamientos();
  }, []);

  const cargarLevantamientos = async () => {
    try {
      const response = await levantamientosApi.listarLevantamientos({
        page: 1,
        limit: 10
      });
      
      if (response.success) {
        setLevantamientos(response.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const crearNuevo = async (data) => {
    try {
      const response = await levantamientosApi.crearLevantamiento(data);
      
      if (response.success) {
        // Recargar lista
        cargarLevantamientos();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Renderizar componentes...
}
```

#### Ejemplo: Página de Cotizador

```typescript
// src/app/dashboard/cotizador/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { cotizacionesApi, catalogosApi } from '@/lib/axios';
import type { Material, Herraje } from '@/lib/axios';

export default function CotizadorPage() {
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [herrajes, setHerrajes] = useState<Herraje[]>([]);

  useEffect(() => {
    cargarCatalogos();
  }, []);

  const cargarCatalogos = async () => {
    try {
      const [materialesRes, herrajesRes] = await Promise.all([
        catalogosApi.obtenerMateriales(),
        catalogosApi.obtenerHerrajes()
      ]);
      
      if (materialesRes.success) {
        setMateriales(materialesRes.data);
      }
      
      if (herrajesRes.success) {
        setHerrajes(herrajesRes.data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const guardarCotizacion = async (data) => {
    try {
      const response = await cotizacionesApi.crearCotizacion(data);
      
      if (response.success) {
        console.log('Cotización creada:', response.data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Renderizar componentes...
}
```

### 3. Crear Hook Personalizado para Auth (Opcional pero Recomendado)

```typescript
// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { authApi, type User } from '@/lib/axios';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (authApi.isAuthenticated()) {
        const response = await authApi.getCurrentUser();
        if (response.success) {
          setUser(response.data);
        }
      }
    } catch (error) {
      console.error('Error chequeando auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    if (response.success) {
      setUser(response.data.user);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    router.push('/login');
  };

  return { user, loading, login, logout, isAuthenticated: !!user };
}
```

### 4. Crear Context de Auth (Opcional pero Recomendado)

```typescript
// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { authApi, type User } from '@/lib/axios';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = authApi.getUserFromStorage();
    setUser(storedUser);
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    if (response.success) {
      setUser(response.data.user);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
```

### 5. Proteger Rutas

```typescript
// src/components/ProtectedRoute.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/axios';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!authApi.isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  return <>{children}</>;
}
```

---

## 🔍 Eliminar Datos Simulados

### Archivos a Modificar

1. **`src/app/dashboard/levantamiento/page.tsx`**
   - Quitar arrays hardcodeados
   - Usar `levantamientosApi.listarLevantamientos()`
   - Usar `levantamientosApi.crearLevantamiento()`
   - Usar `catalogosApi.obtenerTiposCubierta()`

2. **`src/app/dashboard/cotizador/page.tsx`**
   - Quitar arrays `baseMaterials`, `hardwareCatalog`, etc.
   - Usar `catalogosApi.obtenerMateriales()`
   - Usar `catalogosApi.obtenerHerrajes()`
   - Usar `catalogosApi.obtenerColores()`
   - Usar `cotizacionesApi.crearCotizacion()`
   - Usar `cotizacionesApi.guardarBorrador()`

3. **`src/components/LevantamientoSection.tsx`**
   - Quitar datos hardcodeados
   - Usar APIs de catálogos

---

## 📋 Checklist de Integración

- [x] Estructura de axios creada
- [x] Configuración de axios con interceptores
- [x] APIs de autenticación
- [x] APIs de levantamientos
- [x] APIs de cotizaciones
- [x] APIs de catálogos
- [x] APIs de usuarios
- [x] Tipos TypeScript completos
- [x] Documentación README
- [x] Variables de entorno (.env.local)
- [x] Axios agregado a package.json
- [ ] Instalar dependencias (`npm install`)
- [ ] Conectar página de login
- [ ] Conectar página de levantamientos
- [ ] Conectar página de cotizador
- [ ] Crear hook useAuth
- [ ] Crear AuthContext
- [ ] Proteger rutas privadas
- [ ] Quitar datos simulados

---

## 🎨 Formato de Respuestas

Todas las respuestas siguen el formato del backend:

```typescript
// Éxito
{
  success: true,
  data: {...},
  message?: "Mensaje",
  pagination?: {...}
}

// Error
{
  success: false,
  message: "Error",
  error?: "Detalle"
}
```

---

## 🚦 Estados de Workflow

### Levantamientos
- `pendiente` → `en_revision` → `contactado` → `cotizado`
- También: `rechazado`, `archivado`

### Cotizaciones
- `borrador` → `enviada` → `aprobada` → `en_produccion` → `lista_instalacion` → `instalada`
- También: `rechazada`, `archivada`

---

## 📚 Documentación de Referencia

- **Documentación APIs:** `src/lib/axios/README.md`
- **Documentación Backend:** `CAMBIOS_REALIZADOS.md`
- **Prompt Backend:** `PROMPT_BACKEND_KUCHE.txt`

---

✅ **Frontend listo para conectar con el backend. Siguiente paso: `npm install` y comenzar a integrar las páginas.**
