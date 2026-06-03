# Endpoint Correcto Segun El Cambio

## Regla General

Antes de guardar, identifica si el cambio pertenece a:

- **cita**: agenda, estado de la cita, ingenieros asignados a la cita.
- **tarea**: vista operativa del panel, responsables, etapa, estado de trabajo y datos que evolucionan en el seguimiento.

Si eliges el endpoint equivocado, el request puede responder `200` pero el cambio quedara guardado en la coleccion que no estabas revisando.

## Cuando Debes Usar Citas

Usa endpoints de `citas` cuando el cambio sea sobre la cita original.

### Casos correctos

- cambiar nombre, correo, telefono, ubicacion o informacion adicional de la cita;
- cambiar el estado de la cita;
- asignar o quitar ingenieros de la cita;
- iniciar, finalizar o cancelar la cita.

### Endpoints relevantes

- `PUT /api/citas/:id/actualizarDatos`
- `PUT /api/citas/updateEstado/:id`
- `PUT /api/citas/:id/asignarIngeniero`
- `PUT /api/citas/:id/asignarIngenieros`

## Cuando Debes Usar Tareas

Usa endpoints de `tareas` cuando el cambio pertenezca al flujo operativo del panel.

### Casos correctos

- cambiar responsables de la tarea;
- cambiar etapa;
- cambiar estado operativo;
- editar titulo o notas de trabajo;
- actualizar fecha limite, ubicacion o datos visibles del panel.

### Endpoints relevantes

- `PUT /api/tareas/:id`
- `PATCH /api/tareas/:id`

## Regla Para No Confundirte

### Si el formulario es de cita

Debes esperar cambios en:

- `citas`

Y, si existe sincronizacion, en el espejo operativo de `tareas`.

### Si el formulario es de tarea

Debes esperar cambios en:

- `tareas`

No asumas que `citas` cambiara sola.

## Mapa Rapido De Uso

### Cambios de agenda

Usa `citas`.

Ejemplos:

- actualizar datos de contacto de la cita;
- cambiar de `programada` a `en_proceso`;
- asignar ingenieros a la cita.

### Cambios de trabajo operativo

Usa `tareas`.

Ejemplos:

- asignar varios responsables;
- mover la tarea de `citas` a `disenos` o `contrato`;
- ajustar notas internas;
- cambiar el estado de seguimiento.

## Que Debes Revisar En Network

### Si editas cita

Busca algo como:

```text
PUT /api/citas/:id/actualizarDatos
PUT /api/citas/updateEstado/:id
```

### Si editas tarea

Busca algo como:

```text
PUT /api/tareas/:id
PATCH /api/tareas/:id
```

Si ves `citas` cuando querias tocar responsables del panel, estas usando la ruta equivocada.

## Que Debe Contener El Body

### Para cita

```json
{
  "nombreCliente": "Miguel Sanchez",
  "ubicacion": "Durango Capital",
  "informacionAdicional": "Cita En hacienda de tapias\n"
}
```

### Para tarea

```json
{
  "titulo": "Tarea de prueba",
  "etapa": "contrato",
  "estado": "pendiente",
  "asignadoA": [
    "698369a08e72ed6558bdf6da",
    "6998b2becb83c41f1ee66687"
  ]
}
```

## Como Saber Si Funciono

### Funciono bien si

- el endpoint correcto se llamo;
- la respuesta fue `200`;
- el documento correcto cambio en la base de datos;
- al recargar la UI ves el mismo dato guardado.

### No funciono bien si

- el request fue a la coleccion equivocada;
- el backend respondio `200` pero revisaste otro documento;
- la UI no hizo refetch y mostro datos viejos;
- mandaste campos de cita cuando querias modificar la tarea.

## Resumen Final

- Usa `citas` para agenda y estado de cita.
- Usa `tareas` para asignacion y flujo operativo.
- Si cambias responsables del panel, debes tocar `tareas`.
- Si cambias ingenieros de la cita, debes tocar `citas`.
