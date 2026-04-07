import { z } from 'zod';

export const loginSeguimientoSchema = z.object({
    codigo: z.string().optional(),
    code: z.string().optional(),
    clienteId: z.string().optional()
}).transform((payload) => {
    const codigo = String(payload.codigo ?? payload.code ?? payload.clienteId ?? '').trim();
    return {
        codigo
    };
}).refine((payload) => payload.codigo.length > 0, {
    message: 'El codigo es requerido'
});
