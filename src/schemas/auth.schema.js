import { z } from "zod";

// Schema para validar creación de citas
export const citaSchema = z.object({
    fechaAgendada: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: "Fecha agendada debe ser una fecha válida"
    }).transform(val => new Date(val)),
    nombreCliente: z.string().min(1, "Nombre del cliente es requerido").trim(),
    correoCliente: z.string().email("Correo del cliente no es válido").toLowerCase().trim(),
    telefonoCliente: z.string().min(10, "Teléfono debe tener al menos 10 dígitos").trim(),
    diseno: z.string().optional(), // ObjectId opcional
    informacionAdicional: z.string().optional().default("")
}).refine(data => {
    const fechaAgendada = new Date(data.fechaAgendada);
    const ahora = new Date();
    return fechaAgendada > ahora;
}, {
    message: "La fecha agendada debe ser posterior a la fecha actual",
    path: ["fechaAgendada"]
});

export const registerSchema = z.object({
    nombre: z.string().min(1, "Nombre es requerido"),
    correo: z.string().email("Correo no es válido"),
    telefono: z.string().min(10, "Teléfono debe tener al menos 10 dígitos"),
    rol: z.enum(["admin", "ingeniero", "arquitecto", "cliente"], {
        errorMap: () => ({ message: "Rol debe ser 'admin', 'ingeniero', 'arquitecto' o 'cliente'" })
    }),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const loginSchema = z.object({
    correo: z.string({
        required_error: "Correo es requerido",
    }).email("Correo no es válido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres")
});