import { z } from 'zod';

// Schema para crear tarea
export const crearTareaSchema = z.object({
    titulo: z.string({
        required_error: 'El título es requerido'
    }).min(3, 'El título debe tener al menos 3 caracteres').trim(),
    
    etapa: z.enum(['citas', 'disenos', 'cotizacion', 'contrato'], {
        required_error: 'La etapa es requerida',
        invalid_type_error: 'Etapa inválida. Debe ser: citas, disenos, cotizacion o contrato'
    }),
    
    estado: z.enum(['pendiente', 'completada']).optional().default('pendiente'),
    
    asignadoA: z.string({
        required_error: 'El usuario asignado es requerido'
    }).min(1, 'Debe asignar la tarea a un usuario'),
    
    proyecto: z.string({
        required_error: 'El proyecto es requerido'
    }).min(1, 'Debe asociar la tarea a un proyecto'),
    
    notas: z.string().optional().default('')
});

// Schema para actualizar tarea
export const actualizarTareaSchema = z.object({
    titulo: z.string().min(3, 'El título debe tener al menos 3 caracteres').trim().optional(),
    
    etapa: z.enum(['citas', 'disenos', 'cotizacion', 'contrato'], {
        invalid_type_error: 'Etapa inválida. Debe ser: citas, disenos, cotizacion o contrato'
    }).optional(),
    
    estado: z.enum(['pendiente', 'completada'], {
        invalid_type_error: 'Estado inválido. Debe ser: pendiente o completada'
    }).optional(),
    
    asignadoA: z.string().optional(),
    
    notas: z.string().optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar'
});

// Schema para cambiar etapa
export const cambiarEtapaSchema = z.object({
    etapa: z.enum(['citas', 'disenos', 'cotizacion', 'contrato'], {
        required_error: 'La etapa es requerida',
        invalid_type_error: 'Etapa inválida. Debe ser: citas, disenos, cotizacion o contrato'
    })
});

// Schema para cambiar estado
export const cambiarEstadoSchema = z.object({
    estado: z.enum(['pendiente', 'completada'], {
        required_error: 'El estado es requerido',
        invalid_type_error: 'Estado inválido. Debe ser: pendiente o completada'
    })
});

// Schema para agregar archivos
export const agregarArchivosSchema = z.object({
    archivos: z.array(z.object({
        nombre: z.string({
            required_error: 'El nombre del archivo es requerido'
        }).min(1),
        tipo: z.enum(['pdf', 'render', 'otro'], {
            required_error: 'El tipo de archivo es requerido'
        }),
        url: z.string({
            required_error: 'La URL del archivo es requerida'
        }).url('Debe ser una URL válida')
    })).min(1, 'Debe proporcionar al menos un archivo')
});

// Schema para filtros de búsqueda
export const filtrosTareasSchema = z.object({
    etapa: z.enum(['citas', 'disenos', 'cotizacion', 'contrato']).optional(),
    estado: z.enum(['pendiente', 'completada']).optional(),
    asignadoA: z.string().optional(),
    proyecto: z.string().optional()
});
