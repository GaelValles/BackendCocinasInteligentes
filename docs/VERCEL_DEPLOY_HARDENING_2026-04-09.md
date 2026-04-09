# Vercel Deploy + Hardening (Backend)

Fecha: 2026-04-09

## 1) Cron en produccion (Vercel)

Se implemento ejecucion de follow-up en Vercel via Cron HTTP seguro.

- Endpoint cron protegido: GET /api/cron/followup/run
- Seguridad: valida Authorization Bearer contra CRON_SECRET usando comparacion timing-safe.
- Programacion en Vercel: vercel.json -> crons[] con schedule diario.

Rutas/codigo:
- src/controllers/cron.controller.js
- src/routes/cron.routes.js
- src/app.js
- vercel.json

## 2) Cambios de estabilidad aplicados

- Entrada serverless para Vercel: api/index.js
- Rewrites globales a Express: vercel.json
- CORS por entorno con allowlist por variables:
  - CORS_ALLOWED_ORIGINS
  - FRONTEND_URL
  - FRONTEND_PUBLIC_URL
- Se evita iniciar node-cron en Vercel serverless:
  - Solo corre node-cron en entornos no Vercel.

## 3) Hardening de seguridad aplicado

- TOKEN_SECRET ya no queda hardcodeado en repo.
- En produccion, si TOKEN_SECRET no existe, app falla de forma explicita.
- Cookies de auth endurecidas:
  - httpOnly
  - secure en production
  - sameSite none en production / lax en local
  - clearCookie coherente en logout
- Se eliminaron logs sensibles de token y payload decodificado.
- Headers de seguridad base en app:
  - X-Content-Type-Options
  - X-Frame-Options
  - Referrer-Policy
  - Permissions-Policy
- X-Powered-By deshabilitado.

## 4) Resultado de auditoria de dependencias

Comando ejecutado:
- npm audit fix --omit=dev

Resultado despues del fix:
- 1 vulnerabilidad low restante (aws-sdk v2 advisory de validacion de region / recomendacion migrar a v3).
- Se corrigieron automaticamente vulnerabilidades moderadas/altas que tenian fix compatible.

## 5) Variables de entorno requeridas en Vercel

Minimas:
- connectDBUsers
- TOKEN_SECRET
- CRON_SECRET

CORS recomendadas:
- CORS_ALLOWED_ORIGINS
- FRONTEND_URL
- FRONTEND_PUBLIC_URL

Si usas email/archivos en produccion:
- SMTP_USER
- SMTP_PASS
- EMAIL_EMPRESA
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- DROPBOX_ACCESS_TOKEN
- DO_SPACES_KEY
- DO_SPACES_SECRET
- DO_SPACES_ENDPOINT
- DO_SPACES_BUCKET

## 6) Configuracion sugerida en Vercel (UI)

- Application Preset: Express
- Root Directory: ./ (o carpeta backend si monorepo)
- Build Command: vacio
- Output Directory: vacio
- Install Command: npm install

## 7) Verificacion post-deploy

1. GET / debe responder health JSON.
2. GET /api/catalogos/materiales?disponible=true debe responder 200.
3. Cron:
   - Definir CRON_SECRET en Vercel.
   - Verificar invocaciones del path /api/cron/followup/run en logs de Functions/Cron.
4. CORS:
   - Probar request real desde frontend Vercel y confirmar ausencia de error de origin.

## 8) Riesgo residual y recomendacion

- Riesgo residual bajo: advisory de aws-sdk v2.
- Recomendacion: planificar migracion de src/libs/digitalocean.js a AWS SDK v3 (cliente S3) para cerrar ese ultimo hallazgo low y reducir superficie futura.
