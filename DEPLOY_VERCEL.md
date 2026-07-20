# Deploy Backend a Vercel (sin localhost)

## 1) Preparar variables en Vercel
En Vercel -> Project -> Settings -> Environment Variables, agrega al menos:

- connectDBUsers
- NODE_ENV=production
- TOKEN_SECRET
- CRON_SECRET
- TRACKING_JWT_SECRET
- TRACKING_JWT_TTL=30m
- CORS_ALLOWED_ORIGINS
- FRONTEND_URL
- FRONTEND_PUBLIC_URL
- CORS_ALLOW_ALL=false
- CORS_ALLOW_VERCEL_PREVIEWS=false (o true si quieres permitir previews *.vercel.app)

Si usas email/archivos, agrega tambien:

- EMAIL_EMPRESA
- SMTP_HOST
- SMTP_PORT
- SMTP_SECURE
- SMTP_USER
- SMTP_PASS
- SMTP_FROM
- DROPBOX_ACCESS_TOKEN
- DROPBOX_ROOT_PATH
- REQUIRE_DROPBOX_UPLOADS
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

## 2) Cambiar origenes de localhost a dominio real
Ejemplo recomendado en produccion:

- CORS_ALLOWED_ORIGINS=https://tu-frontend.vercel.app,https://www.tudominio.com
- FRONTEND_URL=https://tu-frontend.vercel.app
- FRONTEND_PUBLIC_URL=https://www.tudominio.com

No dejes localhost en estas variables de produccion.

## 3) Configuracion Vercel del repo
Este backend ya incluye `vercel.json` con:

- Funcion serverless en `api/index.js`
- Rewrite global a `api/index.js`
- Cron diario en `/api/cron/followup/run`

No necesitas cambiar `src/index.js` para Vercel.

## 4) Deploy
Desde la raiz del proyecto:

```bash
vercel
```

Para produccion:

```bash
vercel --prod
```

## 5) Validar endpoints
Con tu URL de Vercel:

```bash
curl https://tu-backend.vercel.app/
curl https://tu-backend.vercel.app/api/citas/horarios-ocupados
```

## 6) Frontend
En tu frontend cambia la URL base de API a:

- https://tu-backend.vercel.app

y elimina referencias a localhost en variables de produccion.
