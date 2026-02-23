# 🚀 Inicio Rápido - Backend Küche

## 📋 Pre-requisitos

- Node.js v16 o superior
- MongoDB instalado y corriendo
- npm o yarn

---

## 🔧 Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Verifica que existe el archivo `.env` en la raíz del proyecto con:

```env
PORT=3001
MONGO_URI=mongodb://localhost/cocinas-inteligentes
SECRET=tu_clave_secreta_jwt
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### 3. Inicializar base de datos (opcional)

Si necesitas datos de prueba para materiales:

```bash
node src/scripts/seedMaterialesCotizador.js
```

---

## ▶️ Iniciar el servidor

### Desarrollo (con hot-reload)

```bash
npm run dev
```

El servidor estará disponible en: `http://localhost:3001`

### Producción

```bash
npm start
```

---

## ✅ Verificación de funcionamiento

### 1. Health Check

Abre tu navegador o Postman y prueba:

**GET** `http://localhost:3001/verificar`

Deberías ver algo como:
```json
{
  "success": true,
  "message": "Backend Küche funcionando correctamente",
  "version": "2.0.0"
}
```

### 2. Obtener configuración del cotizador (público)

**GET** `http://localhost:3001/cotizaciones/config`

Deberías recibir la configuración completa del cotizador.

### 3. Crear un usuario administrador

**POST** `http://localhost:3001/register`

Body:
```json
{
  "nombre": "Admin Test",
  "correo": "admin@kuche.com",
  "telefono": "555-1234",
  "rol": "admin",
  "password": "password123"
}
```

Deberías recibir:
```json
{
  "success": true,
  "message": "Usuario creado correctamente",
  "token": "jwt_token_aqui",
  "data": {
    "user": {
      "id": "...",
      "nombre": "Admin Test",
      "correo": "admin@kuche.com",
      "rol": "admin"
    }
  }
}
```

Guarda el `token` para usarlo en peticiones autenticadas.

### 4. Login

**POST** `http://localhost:3001/login`

Body:
```json
{
  "correo": "admin@kuche.com",
  "password": "password123"
}
```

### 5. Verificar token

**GET** `http://localhost:3001/me`

Headers:
```
Authorization: Bearer tu_token_aqui
```

---

## 📚 Endpoints disponibles

Consulta [API_ENDPOINTS_COMPLETOS.md](./API_ENDPOINTS_COMPLETOS.md) para la documentación completa de todos los endpoints.

### Rutas principales:

- `/login`, `/register`, `/logout` - Autenticación
- `/levantamientos` - Módulo de Levantamiento Rápido
- `/cotizaciones` - Módulo de Cotizador Pro
- `/catalogos` - Catálogos (materiales, herrajes, colores, etc.)
- `/usuarios`, `/empleados` - Gestión de usuarios
- `/materiales` - CRUD de materiales
- `/citas` - Gestión de citas
- `/contacto` - Formularios de contacto
- `/disenos` - Diseños 3D
- `/ordenes` - Órdenes de trabajo
- `/pagos` - Gestión de pagos

---

## 🔐 Autenticación

El backend soporta dos métodos de autenticación:

### 1. Cookies (para web)
El token se envía automáticamente en las cookies.

### 2. Bearer Token (para APIs/mobile)
Incluye el token en el header de cada petición:

```
Authorization: Bearer tu_token_jwt
```

---

## 🛠️ Comandos útiles

### Ver logs en tiempo real (desarrollo)
```bash
npm run dev
```

### Ejecutar seeds
```bash
node src/scripts/seedMaterialesCotizador.js
```

### Limpiar node_modules y reinstalar
```bash
rm -rf node_modules
npm install
```

---

## 🐛 Troubleshooting

### Error: MongoDB no conecta

1. Verifica que MongoDB esté corriendo:
```bash
# Windows
net start MongoDB

# Mac/Linux
sudo systemctl start mongodb
```

2. Verifica la URI en `.env`:
```
MONGO_URI=mongodb://localhost:27017/cocinas-inteligentes
```

### Error: Puerto 3001 en uso

1. Cambia el puerto en `.env`:
```
PORT=3002
```

2. O mata el proceso que usa el puerto:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3001 | xargs kill -9
```

### Error: Token inválido

1. Verifica que el token no haya expirado
2. Verifica que estés enviando el formato correcto:
```
Authorization: Bearer <token>
```

### Error: CORS

Si recibes errores de CORS, verifica que tu frontend esté corriendo en:
- `http://localhost:5173` (Vite)
- `http://localhost:3000` (Next.js)

Si usas otro puerto, agrégalo en `src/app.js`:
```javascript
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:TU_PUERTO'],
    credentials: true
}));
```

---

## 📦 Estructura del Proyecto

```
Backend/
├── src/
│   ├── app.js              # Configuración Express
│   ├── index.js            # Punto de entrada
│   ├── config.js           # Configuraciones
│   ├── db.js               # Conexión MongoDB
│   ├── controllers/        # Lógica de negocio
│   ├── models/             # Modelos Mongoose
│   ├── routes/             # Definición de rutas
│   ├── middlewares/        # Middlewares (auth, validación)
│   ├── schemas/            # Esquemas de validación Zod
│   ├── libs/               # Utilidades (JWT, Cloudinary)
│   └── scripts/            # Scripts de inicialización
├── .env                    # Variables de entorno
├── package.json
├── nodemon.json
└── README.md
```

---

## 🎯 Próximos Pasos

1. ✅ Backend está listo para usar
2. 🔗 Integrar con el frontend
3. 📧 Implementar envío de correos (password reset)
4. 📄 Implementar generación de PDFs (cotizaciones)
5. 🧪 Agregar tests unitarios
6. 🚀 Preparar para producción (Docker, CI/CD)

---

## 📞 Soporte

Si encuentras algún problema durante la integración:

1. Revisa los logs del servidor
2. Verifica las variables de entorno
3. Consulta la documentación de endpoints: [API_ENDPOINTS_COMPLETOS.md](./API_ENDPOINTS_COMPLETOS.md)
4. Revisa los cambios realizados: [CAMBIOS_REALIZADOS.md](./CAMBIOS_REALIZADOS.md)

---

✅ **¡Todo listo para empezar a integrar el frontend!** 🚀
