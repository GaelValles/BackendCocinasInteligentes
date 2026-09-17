# Acceso a la guía del cron de seguimiento

La guía principal está en la raíz del workspace:

[GUIA_FRONTEND_CRON_SEGUIMIENTO_EMAIL.md](../GUIA_FRONTEND_CRON_SEGUIMIENTO_EMAIL.md)

También puedes abrirla desde PowerShell ubicado en `Backend` con:

```powershell
code ..\GUIA_FRONTEND_CRON_SEGUIMIENTO_EMAIL.md
```
# Guía completa: Cron de seguimiento y envío de correos

Esta guía contiene todo lo necesario para que el cron de seguimiento funcione en el despliegue y para que el frontend cree y actualice las tareas correctamente.

## 1. Qué hace el cron

El cron revisa tareas que cumplan simultáneamente estas condiciones:

```text
etapa = contrato
followUpStatus = pendiente
followUpEnteredAt != null
```

Envía los recordatorios al correo configurado en `EMAIL_EMPRESA` en estos hitos:

| Días transcurridos | Acción |
| --- | --- |
| 3 | Envía el primer recordatorio. |
| 8 | Envía el segundo recordatorio. |
| 13 | Envía el tercer recordatorio y desactiva el seguimiento. |

Al completar el hito de 13 días, el backend cambia automáticamente:

```json
{
	"followUpStatus": "inactivo",
	"estado": "completada"
}
```

El backend evita enviar dos veces el mismo hito mediante `followUpReminderStepsSent`.

## 2. Cómo se ejecuta en producción

En Vercel no se debe depender de un proceso `node-cron` permanente, porque las funciones serverless se duermen cuando no reciben peticiones. En producción, la ejecución la realiza **Vercel Cron**.

La configuración está en `vercel.json`:

```json
{
	"crons": [
		{
			"path": "/api/cron/followup/run",
			"schedule": "0 6 * * *"
		}
	]
}
```

Esto significa que Vercel llama la ruta todos los días a las `06:00 UTC`. El horario del cron de Vercel está expresado en UTC, no necesariamente en la hora local de México.

En local, si `VERCEL` no está activo, el backend inicia `node-cron` y programa la ejecución a las `00:00` de la zona horaria del proceso.

## 3. Ruta exclusiva del cron

```http
GET /api/cron/followup/run
```

La ruta está montada en `src/routes/cron.routes.js` y se protege con `CRON_SECRET`.

La llamada autorizada debe incluir:

```http
Authorization: Bearer <CRON_SECRET>
```

La función de Vercel Cron debe enviar este header automáticamente. El frontend **no debe llamar esta ruta desde el navegador**, no debe colocarla en un botón y no debe exponer `CRON_SECRET` en una variable `NEXT_PUBLIC_*`.

## 4. Variables obligatorias en Vercel

Estas variables deben existir en el proyecto de Vercel donde está desplegado el backend, no únicamente en el frontend:

```text
CRON_SECRET=<secreto largo y aleatorio>

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<cuenta Gmail remitente>
SMTP_PASS=<contraseña de aplicación de Gmail>
SMTP_FROM=<remitente opcional>
EMAIL_EMPRESA=<correo que recibe los recordatorios>
```

### Configuración de Gmail

`SMTP_PASS` debe ser una **contraseña de aplicación de Google**, no la contraseña normal de la cuenta.

Para generarla:

1. Activar la verificación en dos pasos en la cuenta de Google.
2. Entrar a la sección de contraseñas de aplicación.
3. Crear una contraseña para el backend.
4. Guardar el valor generado en `SMTP_PASS` en Vercel.

No incluir espacios adicionales ni comillas en el valor guardado en Vercel. El backend también elimina espacios internos cuando el host SMTP es Gmail, porque Google suele mostrar las contraseñas de aplicación agrupadas visualmente.

### Después de cambiar variables

Cada cambio en las variables requiere un nuevo despliegue:

1. Ir a `Settings > Environment Variables`.
2. Confirmar que las variables estén marcadas para `Production`.
3. Ir a `Deployments`.
4. Ejecutar `Redeploy` del deployment de producción.

Si la variable está marcada únicamente para `Preview`, el cron de producción no podrá leerla.

## 5. Qué debe hacer el frontend

El frontend no envía correos. Debe mantener correctamente el estado de las tareas para que el cron pueda encontrarlas.

### Crear una tarea directamente en seguimiento

```http
POST /api/tareas
```

Body relevante:

```json
{
	"nombreProyecto": "Cocina Residencial",
	"etapa": "contrato",
	"estado": "pendiente",
	"followUpStatus": "pendiente",
	"cliente": {
		"nombre": "Juan Pérez",
		"correo": "juan@example.com",
		"telefono": "5512345678"
	}
}
```

Al crearla en `contrato` con seguimiento pendiente, el backend registra `followUpEnteredAt` automáticamente.

### Mover una tarea a seguimiento

```http
PATCH /api/tareas/:id/etapa
```

```json
{
	"etapa": "contrato"
}
```

Si la tarea cambia a `contrato` y sigue pendiente, el backend inicia el contador en `followUpEnteredAt`.

### Confirmar seguimiento

```http
PATCH /api/tareas/:id
```

```json
{
	"followUpStatus": "confirmado"
}
```

### Desactivar seguimiento manualmente

```http
PATCH /api/tareas/:id
```

```json
{
	"followUpStatus": "inactivo"
}
```

El frontend no debe modificar manualmente estos campos:

- `followUpEnteredAt`
- `followUpReminderStepsSent`
- `followUpLastReminderAt`
- `followUpProcessingAt`
- `followUpProcessingStep`

Esos valores los controla el backend y el cron.

## 6. Rutas de lectura para el frontend

Listar tareas:

```http
GET /api/tareas
```

Listar únicamente tareas pendientes de seguimiento:

```http
GET /api/tareas?followUpStatus=pendiente
```

Consultar una tarea:

```http
GET /api/tareas/:id
```

El frontend debe leer estos campos:

```json
{
	"followUpStatus": "pendiente",
	"followUpEnteredAt": 1760000000000,
	"followUpReminderStepsSent": [3, 8],
	"followUpLastReminderAt": "2026-09-17T06:00:00.000Z"
}
```

Para las peticiones autenticadas, mantener el mecanismo utilizado por el resto del frontend:

```javascript
fetch(`${API_URL}/api/tareas`, {
	credentials: 'include'
});
```

Si el proyecto usa JWT en lugar de cookie, enviar también:

```http
Authorization: Bearer <TOKEN>
```

## 7. Respuesta de ejecución del cron

Cuando Vercel ejecuta correctamente la ruta, el backend responde:

```json
{
	"success": true,
	"message": "Cron de follow-up ejecutado correctamente",
	"data": {
		"reviewed": 4,
		"reminded": 1,
		"inactivated": 0
	}
}
```

Los campos significan:

- `reviewed`: tareas encontradas con seguimiento pendiente.
- `reminded`: correos enviados correctamente.
- `inactivated`: tareas que llegaron al hito de 13 días.

Errores posibles:

| Código | Significado | Qué revisar |
| --- | --- | --- |
| `401` | `CRON_SECRET` incorrecto o ausente en la llamada. | Configuración del Cron y secreto del proyecto. |
| `503` | `CRON_SECRET` no existe en el entorno. | Variables de Vercel y redeploy. |
| `500` | Error durante la consulta o envío. | Logs de la función, MongoDB y SMTP. |

## 8. Diagnóstico completo en Vercel

1. Confirmar que `Backend/vercel.json` contiene el cron con la ruta exacta `/api/cron/followup/run`.
2. Confirmar en Vercel que el Cron Job aparece activo.
3. Confirmar que el deployment de producción contiene las últimas modificaciones.
4. Confirmar las variables `CRON_SECRET`, `SMTP_USER`, `SMTP_PASS` y `EMAIL_EMPRESA` en `Production`.
5. Hacer `Redeploy` después de modificar cualquier variable.
6. Revisar los logs de Vercel buscando:

```text
[CRON] Processing
[CRON] Follow-up automation completed
[CRON] Could not send follow-up reminder
```

7. Verificar en MongoDB que la tarea tenga:

```text
etapa: contrato
followUpStatus: pendiente
followUpEnteredAt: un número válido
```

8. Confirmar que el hito que debe enviarse no esté ya contenido en `followUpReminderStepsSent`.
9. Revisar la bandeja de spam del destinatario configurado en `EMAIL_EMPRESA`.
10. Comprobar que la contraseña de Gmail sea de aplicación y que la cuenta permita SMTP.

## 9. Prueba manual segura

La ejecución manual solo debe hacerse desde un entorno seguro, nunca desde el navegador del usuario:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Get `
	-Uri "https://TU_BACKEND.vercel.app/api/cron/followup/run" `
	-Headers $headers
```

No pegar el secreto directamente en un archivo del frontend ni en el historial de comandos compartido.

## 10. Responsabilidades separadas

### Backend / Vercel

- Mantener activa la configuración de Vercel Cron.
- Leer las variables SMTP del entorno.
- Validar `CRON_SECRET`.
- Buscar las tareas pendientes.
- Enviar los correos.
- Registrar los hitos enviados y los errores.

### Frontend

- Usar las rutas `/api/tareas` para crear y actualizar tareas.
- Mover correctamente las tareas a `contrato`.
- Mantener `followUpStatus` como `pendiente` mientras requieran seguimiento.
- Mostrar el estado y los hitos de seguimiento.
- No ejecutar `/api/cron/followup/run` desde el navegador.
- No exponer credenciales SMTP ni `CRON_SECRET`.
