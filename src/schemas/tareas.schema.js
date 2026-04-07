import { z } from 'zod';

const etapaEnum = z.enum(['citas', 'disenos', 'cotizacion', 'contrato']);
const estadoEnum = z.enum(['pendiente', 'completada']);
const prioridadEnum = z.enum(['alta', 'media', 'baja']);
const followUpStatusEnum = z.enum(['pendiente', 'confirmado', 'inactivo']);
const sourceTypeEnum = z.enum(['cita', 'diseno']);

// Accept legacy value 'descartado' and normalize to 'inactivo'.
const followUpStatusInputSchema = z.union([
    followUpStatusEnum,
    z.literal('descartado')
]).transform((value) => (value === 'descartado' ? 'inactivo' : value));

const followUpEnteredAtSchema = z.union([
    z.number().int().nonnegative(),
    z.string().regex(/^\d+$/, 'followUpEnteredAt debe ser timestamp en milisegundos')
]).transform((value) => Number(value));

const citaPayloadSchema = z.object({
    fechaAgendada: z.union([z.string(), z.number(), z.date()]).optional(),
    nombreCliente: z.string().optional(),
    correoCliente: z.string().optional(),
    telefonoCliente: z.string().optional(),
    ubicacion: z.string().optional(),
    informacionAdicional: z.string().optional()
}).optional();

const clientePayloadSchema = z.object({
    nombre: z.string().optional(),
    correo: z.string().optional(),
    telefono: z.string().optional()
}).optional();

const visitaPayloadSchema = z.object({
    fechaProgramada: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
    aprobadaPorAdmin: z.boolean().optional(),
    aprobadaPorCliente: z.boolean().optional(),
    actualizadaEn: z.union([z.string(), z.number(), z.date()]).nullable().optional()
}).optional();

const wallSpecSchema = z.record(z.string(), z.any());
const fileUrlSchema = z.string().min(1, 'La URL del archivo es requerida').refine((value) => {
    const v = String(value || '').trim();
    return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/');
}, 'Debe ser una URL absoluta (http/https) o una ruta relativa iniciando con /');

const asignadoASchema = z.union([
    z.array(z.string().min(1)),
    z.string().min(1)
]).optional();

const toArrayString = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

// Schema para crear tarea
export const crearTareaSchema = z.object({
    etapa: etapaEnum,

    estado: estadoEnum.optional().default('pendiente'),

    asignadoA: asignadoASchema,
    assignedToIds: asignadoASchema,
    assignedTo: z.union([z.array(z.string()), z.string()]).optional(),

    proyecto: z.string().optional(),
    proyectoId: z.string().optional(),
    nombreProyecto: z.string().optional(),
    fechaLimite: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
    scheduledAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
    visitScheduledAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
    ubicacion: z.string().optional(),
    mapsUrl: z.string().optional(),
    wallSpecs: z.array(wallSpecSchema).optional(),
    wallCostEstimate: z.number().nullable().optional(),

    notas: z.string().optional().default(''),
    prioridad: prioridadEnum.optional().default('media'),
    followUpStatus: followUpStatusInputSchema.optional().default('pendiente'),
    seguimiento: followUpStatusInputSchema.optional(),
    estadoSeguimiento: followUpStatusInputSchema.optional(),
    followUpEnteredAt: followUpEnteredAtSchema.nullable().optional(),
    citaStarted: z.boolean().optional(),
    citaFinished: z.boolean().optional(),
    designApprovedByAdmin: z.boolean().optional(),
    designApprovedByClient: z.boolean().optional(),
    sourceType: sourceTypeEnum.optional(),
    sourceId: z.string().optional(),
    cita: citaPayloadSchema,
    cliente: clientePayloadSchema,
    nombreCliente: z.string().optional(),
    correoCliente: z.string().optional(),
    telefonoCliente: z.string().optional(),
    visita: visitaPayloadSchema,
    // Legacy input keys accepted temporarily.
    sourceCitaId: z.string().optional(),
    sourceDisenoId: z.string().optional()
});

// Schema para actualizar tarea
export const actualizarTareaSchema = z.object({
    etapa: etapaEnum.optional(),

    estado: estadoEnum.optional(),

    asignadoA: asignadoASchema,
    assignedToIds: asignadoASchema,
    assignedTo: z.union([z.array(z.string()), z.string()]).optional(),

    notas: z.string().optional(),
    prioridad: prioridadEnum.optional(),
    followUpStatus: followUpStatusInputSchema.optional(),
    seguimiento: followUpStatusInputSchema.optional(),
    estadoSeguimiento: followUpStatusInputSchema.optional(),
    followUpEnteredAt: followUpEnteredAtSchema.nullable().optional(),
    citaStarted: z.boolean().optional(),
    citaFinished: z.boolean().optional(),
    designApprovedByAdmin: z.boolean().optional(),
    designApprovedByClient: z.boolean().optional(),
    sourceType: sourceTypeEnum.optional(),
    sourceId: z.string().optional(),
    cita: citaPayloadSchema,
    cliente: clientePayloadSchema,
    nombreCliente: z.string().optional(),
    correoCliente: z.string().optional(),
    telefonoCliente: z.string().optional(),
    visita: visitaPayloadSchema,
    // Legacy input keys accepted temporarily.
    sourceCitaId: z.string().optional(),
    sourceDisenoId: z.string().optional(),
    nombreProyecto: z.string().optional(),
    fechaLimite: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
    scheduledAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
    visitScheduledAt: z.union([z.string(), z.number(), z.date()]).nullable().optional(),
    ubicacion: z.string().optional(),
    mapsUrl: z.string().optional(),
    wallSpecs: z.array(wallSpecSchema).optional(),
    wallCostEstimate: z.number().nullable().optional(),
    proyectoId: z.string().optional(),
    proyecto: z.string().optional()
}).refine(data => Object.keys(data).length > 0, {
    message: 'Debe proporcionar al menos un campo para actualizar'
});

// Schema para cambiar etapa
export const cambiarEtapaSchema = z.object({
    etapa: etapaEnum
});

// Schema para cambiar estado
export const cambiarEstadoSchema = z.object({
    estado: estadoEnum
});

// Schema para agregar archivos
export const agregarArchivosSchema = z.object({
    archivos: z.array(z.object({
        nombre: z.string({
            required_error: 'El nombre del archivo es requerido'
        }).min(1),
        tipo: z.string().optional(),
        url: fileUrlSchema,
        key: z.string().optional(),
        provider: z.enum(['dropbox', 'cloudinary', 'local']).optional(),
        mimeType: z.string().optional(),
        clienteId: z.string().optional(),
        createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
        id: z.string().optional()
    })).min(1, 'Debe proporcionar al menos un archivo')
});

// Schema para filtros de búsqueda
export const filtrosTareasSchema = z.object({
    etapa: etapaEnum.optional(),
    estado: estadoEnum.optional(),
    asignadoA: z.string().optional(),
    proyecto: z.string().optional(),
    prioridad: prioridadEnum.optional(),
    followUpStatus: followUpStatusInputSchema.optional(),
    seguimiento: followUpStatusInputSchema.optional(),
    estadoSeguimiento: followUpStatusInputSchema.optional()
});

export { etapaEnum, estadoEnum, prioridadEnum, followUpStatusEnum, sourceTypeEnum, toArrayString };
