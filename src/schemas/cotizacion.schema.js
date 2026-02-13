import { z } from 'zod';

export const cotizacionBorradorSchema = z.object({
    _id: z.string().optional(),
    cliente: z.string().optional().default(''),
    projectType: z.string().optional().default('Cocina'),
    ubicacion: z.string().optional().default(''),
    fechaInstalacion: z.union([z.string(), z.date(), z.null()]).optional().nullable(),
    largo: z.number().or(z.string().transform(Number)).optional(),
    alto: z.number().or(z.string().transform(Number)).optional(),
    fondo: z.number().or(z.string().transform(Number)).optional(),
    metrosLineales: z.number().or(z.string().transform(Number)).optional(),
    materialBase: z.string().optional().default('melamina'),
    selectedScenario: z.string().nullable().optional(),
    materialColor: z.string().optional().default('Blanco Nieve'),
    materialThickness: z.enum(['16', '19']).optional().default('16'),
    hardware: z.record(z.string(), z.object({
        enabled: z.boolean(),
        qty: z.number()
    })).optional().default({}),
    labor: z.number().or(z.string().transform(Number)).optional(),
    flete: z.number().or(z.string().transform(Number)).optional(),
    instalacion: z.number().or(z.string().transform(Number)).optional(),
    desinstalacion: z.number().or(z.string().transform(Number)).optional(),
    materialSubtotal: z.number().optional(),
    hardwareSubtotal: z.number().optional(),
    laborSubtotal: z.number().optional(),
    finalPrice: z.number().optional()
}).passthrough();
