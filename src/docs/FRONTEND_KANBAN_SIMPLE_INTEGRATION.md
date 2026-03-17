Integración simple Kanban — Endpoints por columna

Objetivo
- Facilitar integración frontend-backend usando una petición dedicada por columna, evitando ambigüedad entre colecciones de dominio.

Rutas nuevas (backend)
- GET /api/kanban/citas
  - Descripción: lista las citas en formato listo para la UI Kanban.
  - Query params: `estado` (opcional)
  - Response: { success:true, data:[{ _id,titulo,etapa,estado,asignadoA,asignadoANombre,proyecto,nombreProyecto,notas,archivos,raw }], message }

- GET /api/kanban/disenos
  - Lista diseños (mapeados a la forma de tarjeta Kanban)

- GET /api/kanban/cotizacion
  - Lista cotizaciones

- GET /api/kanban/contrato
  - Lista proyectos (como seguimiento/contrato)

Ejemplos de uso (fetch)

- Obtener citas:
fetch('/api/kanban/citas')
  .then(r => r.json()).then(res => { if(res.success){ setCitas(res.data) } })

- Obtener diseños filtrando estado:
fetch('/api/kanban/disenos?estado=pendiente')
  .then(r => r.json()).then(res => { /* usar res.data */ })

Notas importantes para el frontend
- No usen `GET /api/tareas?etapa=citas` — ahora el contrato simple es `/api/kanban/citas`.
- Cada endpoint devuelve `raw` con el documento original en caso de que se necesiten campos adicionales.
- Para mutaciones (mover tarjeta, cambiar estado) usar los endpoints de dominio:
  - Citas: `/api/citas/:id` (PATCH para actualizar estado/fecha)
  - Disenos: `/api/disenos/:id`
  - Cotizaciones: `/api/cotizaciones/:id`
  - Proyectos: `/api/proyectos/:id`

Beneficio
- Evita transformaciones complejas en frontend y desacopla el UI de la estructura interna de datos.

Siguiente paso
- Puedo añadir documentación en el frontend explicando dónde cambiar las llamadas (buscar y reemplazar `GET /api/tareas?etapa=` por los nuevos endpoints).
