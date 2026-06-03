# Arquitectura De Tareas Y Citas

## Proposito Del Modelo

Este sistema usa dos colecciones relacionadas:

- `citas`: representa la cita como evento y su estado operativo de agenda.
- `tareas`: representa la vista operativa del panel, donde se concentran la mayor parte de los datos que van evolucionando durante el proceso.

La razon de tener ambas es que la cita nace como agenda, pero la tarea sirve como contenedor de trabajo para el panel administrativo.

## Resumen Corto

- `citas` guarda la informacion base de la cita.
- `tareas` guarda una copia operativa de esa cita y agrega campos del flujo del panel.
- Hay campos repetidos a proposito para no depender de consultas complejas cada vez que se abre el panel.
- La sincronizacion actual va principalmente de `citas` hacia `tareas`.
- Si editas la coleccion equivocada, puede parecer que “no se actualiza”, aunque en realidad si se guardo en otra parte.

## Por Que Hay Datos Duplicados

Lo que ves como repeticion no es necesariamente un error. Es una forma de **desnormalizacion controlada**.

### Ejemplos de duplicados utiles

En `tareas` aparecen datos como:

- `cita.nombreCliente`
- `cita.ubicacion`
- `cita.informacionAdicional`
- `cliente.nombre`
- `cliente.correo`
- `cliente.telefono`
- `asignadoA`
- `asignadoANombre`
- `sourceType`
- `sourceId`
- `sourceCitaId`

Eso existe para que el panel pueda leer todo desde una sola coleccion sin tener que hacer varias consultas y joins cada vez.

## Que Problema Resuelve Esta Estructura

Si solo tuvieras `citas`, cada pantalla del panel tendria que:

- buscar la cita;
- buscar el cliente;
- buscar la asignacion;
- calcular el estado operativo;
- resolver el historial;
- reconstruir datos derivados.

Con la tarea como contenedor operativo, el panel abre un solo documento y ya tiene casi todo listo.

## Campo Canonico Y Campos Derivados

### En tareas

El campo canonico para responsables es:

- `asignadoA`

Los campos derivados o de compatibilidad son:

- `asignadoANombre`
- `assignedToIds`
- `assignedTo`

### En citas

El campo canonico para ingenieros asignados es:

- `ingenieroAsignado`

Ese campo vive en `citas`, porque la cita sigue siendo el origen del evento de agenda.

## Relacion Entre Las Dos Colecciones

La relacion se apoya en estas referencias:

- `sourceType`
- `sourceId`
- `sourceCitaId`

Eso permite encontrar que tarea corresponde a que cita.

### Lo Que Hace La Sincronizacion

Cuando se crea o actualiza una cita, el backend llama a la sincronizacion y actualiza la tarea asociada.

Eso hace que la tarea herede:

- el estado de la cita;
- el nombre del cliente;
- la ubicacion;
- la informacion adicional;
- la lista de asignados;
- datos de seguimiento y flags operativos.

## Importante: La Sincronizacion No Es Bidireccional Completa

Hoy la logica principal esta orientada a que la cita alimente la tarea.

Eso significa que:

- si editas la cita, la tarea puede sincronizarse;
- si editas la tarea, la cita no necesariamente cambia automaticamente;
- si esperas que ambas colecciones se actualicen al mismo tiempo sin una ruta especifica, puedes ver diferencias.

## Que Debes Editar Segun El Caso

### Debes editar `citas` cuando cambias:

- fecha agendada;
- estado de la cita;
- informacion base del cliente;
- ingenieros asignados a la cita;
- datos propios del evento de agenda.

### Debes editar `tareas` cuando cambias:

- responsables del panel;
- estado operativo de la tarea;
- etapa del flujo;
- datos que el formulario de detalles usa en el panel;
- informacion que el usuario espera ver en la tarjeta o detalle de tarea.

## Por Que A Vezes Parece Que No Se Actualiza

Este es el punto mas importante.

Puede pasar cualquiera de estas situaciones:

### 1. Actualizaste la cita pero revisaste la tarea

En ese caso, la cita si cambio, pero la tarea puede mostrar otro estado o un snapshot distinto.

### 2. Actualizaste la tarea pero revisaste la cita

La tarea guardo bien, pero la cita no cambia porque no existe una sincronizacion inversa automatica completa.

### 3. El frontend llamo el endpoint incorrecto

El request salio con `200`, pero iba a `citas` cuando tu esperabas una actualizacion de `tareas`.

### 4. El documento correcto si se actualizo, pero el frontend renderiza datos viejos

Eso pasa cuando la UI conserva estado local y no vuelve a pedir el documento actualizado.

## Estructura Real De Cada Coleccion

### `citas`

Guarda datos mas cercanos a la agenda:

- fecha agendada;
- datos del cliente;
- ubicacion;
- estado de cita;
- ingenieros asignados;
- historial de estados.

### `tareas`

Guarda la vista operativa:

- etapa;
- estado;
- responsables;
- datos de cita embebidos;
- datos del cliente embebidos;
- seguimiento;
- notas;
- historial de cambios;
- referencias a origen.

## Por Que No Conviene Quitar Toda La Redundancia

Si eliminas demasiados campos duplicados:

- el panel necesitara mas consultas;
- tendras mas joins y populates;
- el frontend sera mas lento o mas fragil;
- el codigo de sincronizacion sera mas complejo.

La desnormalizacion ayuda a lectura rapida, aunque aumenta el riesgo de divergencia si no sincronizas bien.

## Riesgo Real De Este Modelo

El riesgo no es que existan duplicados.

El riesgo es que:

- actualices solo una coleccion;
- el frontend lea la otra;
- y despues parezca que no se guardo nada.

## Regla Practica Para No Equivocarte

Hazte esta pregunta antes de guardar:

### Quiero cambiar la agenda o la operacion?

- Si es agenda, usa `citas`.
- Si es operacion del panel, usa `tareas`.

### Quiero cambiar la fuente de verdad o su espejo?

- Si cambias `citas`, recuerda que `tareas` se sincroniza desde ahi.
- Si cambias `tareas`, no asumas que `citas` va a cambiar sola.

## Por Que Tu Documento De Tarea Tiene Datos De Cita

Porque la tarea no es solo una tarea generica.

En este sistema, la tarea funciona como un contenedor de seguimiento del ciclo completo de la cita. Por eso guarda:

- el cliente;
- la cita embebida;
- el estado operativo;
- los responsables;
- el historial;
- el origen de los datos.

Eso permite que el panel siga el caso completo sin saltar de coleccion en coleccion.

## Recomendacion De Trabajo

### Mantener como esta si:

- quieres rapidez al abrir el panel;
- el formulario trabaja sobre la tarea;
- aceptas que la cita sea el origen de algunos campos y la tarea el contenedor operativo.

### Simplificar mas si:

- quieres menos campos repetidos;
- puedes tolerar mas consultas;
- vas a reescribir el frontend para trabajar con relaciones y no con snapshots.

## Que Cambia Si Decides Hacerlo Mas Normalizado

Si quisieras reducir duplicados de forma fuerte, tendrias que:

- dejar solo referencias a la cita;
- poblar todo al consultar;
- redefinir la UI para leer desde varias colecciones;
- mover la logica de sincronizacion a un servicio mas robusto.

Eso puede quedar mas limpio a largo plazo, pero es mas costoso y mas riesgoso ahora.

## Resumen Final

La estructura actual esta pensada para mantener el panel rapido y operativo.

- `citas` conserva el dato de agenda.
- `tareas` conserva el dato operativo.
- hay duplicados por diseno, no por accidente.
- el problema aparece cuando editas una coleccion y revisas la otra esperando que se haya modificado igual.

Si quieres que todo funcione bien, debes decidir antes de guardar si el cambio pertenece a la cita, a la tarea, o a ambas con sincronizacion.
