import Contacto from '../models/contacto.model.js';
import nodemailer from 'nodemailer';

// Crear contacto desde landing (público) y enviar email a la empresa
export const crearContacto = async (req, res) => {
    try {
        const { nombre, telefono, correo } = req.body;

        if (!nombre?.trim()) return res.status(400).json({ message: 'Nombre es requerido' });
        if (!telefono?.trim()) return res.status(400).json({ message: 'Teléfono es requerido' });
        if (!correo?.trim()) return res.status(400).json({ message: 'Correo es requerido' });

        const contacto = new Contacto({
            nombre: nombre.trim(),
            telefono: telefono.trim(),
            correo: correo.trim().toLowerCase()
        });
        await contacto.save();

        // Enviar email a la empresa (correo configurado en .env)
        const emailEmpresa = process.env.EMAIL_EMPRESA || process.env.EMAIL_DESTINO;
        if (emailEmpresa) {
            try {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: Number(process.env.SMTP_PORT) || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.SMTP_USER,
                    to: emailEmpresa,
                    subject: `[Landing] Solicitud de información - ${nombre.trim()}`,
                    text: `Nuevo contacto desde la web.\n\nNombre: ${nombre}\nTeléfono: ${telefono}\nCorreo: ${correo}`,
                    html: `<p><strong>Nuevo contacto desde la web</strong></p><p>Nombre: ${nombre}</p><p>Teléfono: ${telefono}</p><p>Correo: ${correo}</p>`
                });
            } catch (emailError) {
                console.error('Error al enviar email de contacto:', emailError);
                // No fallar la petición si el email falla; el contacto ya se guardó
            }
        }

        return res.status(201).json({
            message: 'Solicitud recibida. Te contactaremos pronto.',
            contacto: { _id: contacto._id, nombre: contacto.nombre, correo: contacto.correo }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al registrar la solicitud', error: error.message });
    }
};
