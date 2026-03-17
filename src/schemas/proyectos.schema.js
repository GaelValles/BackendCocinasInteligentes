import { z } from 'zod';

// Schema para crear proyecto
export const crearProyectoSchema = z.object({
    nombre: z.string({
        required_error: 'El nombre del proyecto es requerido'
    }).min(3, 'El nombre debe tener al menos 3 caracteres').trim(),
    
    cliente: z.string({
        required_error: 'El cliente es requerido'
    }).min(1, 'Debe asociar el proyecto a un cliente'),
    
    tipo: z.enum(['Cocina', 'Closet', 'vestidor', 'Mueble para el baño'], {
        required_error: 'El tipo de proyecto es requerido',
        invalid_type_error: 'Tipo inválido. Debe ser: Cocina, Closet, vestidor o Mueble para el baño'
    }),
    
    estado: z.enum(['cotizacion', 'aprobado', 'en_produccion', 'instalando', 'completado']).optional().default('cotizacion'),
    
    timelineActual: z.string().optional().default('Cotización en proceso'),
    
    pasosPosibles: z.array(z.string()).optional().default([]),
    
    presupuestoTotal: z.number().min(0).optional().default(0),
    anticipo: z.number().min(0).optional().default(0),
    segundoPago: z.number().min(0).optional().default(0),
    liquidacion: z.number().min(0).optional().default(0),
    
    cotizacion: z.string().optional(),
    levantamiento: z.string().optional(),
    empleadoAsignado: z.string().optional()
});

// Schema para actualizar proyecto
export const actualizarProyectoSchema = z.object({
    nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').trim().optional(),
    
    tipo: z.enum(['Cocina', 'Closet', 'vestidor', 'Mueble para el baño'], {
        invalid_type_error: 'Tipo inválido. Debe ser: Cocina, Closet, vestidor o Mueble para el baño'
    }).optional(),
    
    estado: z.enum(['cotizacion', 'aprobado', 'en_produccion', 'instalando', 'completado'], {
        invalid_type_error: 'Estado inválido'
    }).optional(),
    
    timelineActual: z.string().optional(),
    pasosPosibles: z.array(z.string()).optional(),
    
    presupuestoTotal: z.number().min(0).optional(),
    anticipo: z.number().min(0).optional(),
    segundoPago: z.number().min(0).optional(),
    liquidacion: z.number().min(0).optional(),
    
    cotizacion: z.string().optional(),
    levantamiento: z.string().optional(),
    empleadoAsignado: z.string().optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar'
});

// Schema para actualizar timeline
export const actualizarTimelineSchema = z.object({
    timelineActual: z.string({
        required_error: 'El timeline actual es requerido'
    }).min(1, 'El timeline no puede estar vacío'),
    
    pasosPosibles: z.array(z.string()).optional()
});

// Schema para agregar archivos públicos
export const agregarArchivosPublicosSchema = z.object({
    archivos: z.array(z.object({
        nombre: z.string({
            required_error: 'El nombre del archivo es requerido'
        }).min(1),
        tipo: z.enum(['jpg', 'pdf', 'png'], {
            required_error: 'El tipo de archivo es requerido'
        }),
        url: z.string({
            required_error: 'La URL del archivo es requerida'
        }).url('Debe ser una URL válida')
    })).min(1, 'Debe proporcionar al menos un archivo')
});

// Schema para filtros de búsqueda
export const filtrosProyectosSchema = z.object({
    cliente: z.string().optional(),
    tipo: z.enum(['Cocina', 'Closet', 'vestidor', 'Mueble para el baño']).optional(),
    estado: z.enum(['cotizacion', 'aprobado', 'en_produccion', 'instalando', 'completado']).optional(),
    empleadoAsignado: z.string().optional()
});
