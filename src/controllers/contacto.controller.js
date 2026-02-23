import Contacto from '../models/contacto.model.js';
import nodemailer from 'nodemailer';

// PASO 1: Configurar el transportador de correo (se reutiliza en cada envío)
const crearTransportador = () => {
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true para 465, false para otros puertos
        auth: {
            user: process.env.SMTP_USER,  // yanezgael576@gmail.com
            pass: process.env.SMTP_PASS   // Contraseña de aplicación de Gmail
        }
    });
};

// PASO 2: Crear contacto y enviar notificación por email
export const crearContacto = async (req, res) => {
    try {
        // PASO 2.1: Validar datos recibidos
        const { nombre, telefono, correo, mensaje } = req.body;
        
        if (!nombre?.trim()) {
            return res.status(400).json({ message: 'Nombre es requerido' });
        }
        if (!telefono?.trim()) {
            return res.status(400).json({ message: 'Teléfono es requerido' });
        }
        if (!correo?.trim()) {
            return res.status(400).json({ message: 'Correo es requerido' });
        }

        // PASO 2.2: Guardar el contacto en la base de datos
        const contacto = new Contacto({
            nombre: nombre.trim(),
            telefono: telefono.trim(),
            correo: correo.trim().toLowerCase(),
            mensaje: mensaje?.trim() || ''
        });
        await contacto.save();

        // PASO 2.3: Enviar email de notificación a la empresa
        try {
            const transporter = crearTransportador();
            
            await transporter.sendMail({
                from: process.env.SMTP_USER,        // De quién viene
                to: process.env.EMAIL_EMPRESA,      // yanezgael576@gmail.com
                subject: `🔔 Nueva solicitud de contacto - ${nombre}`,
                html: `
                    <!DOCTYPE html>
                    <html lang="es">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Nueva Solicitud</title>
                    </head>
                    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
                            <tr>
                                <td align="center">
                                    <!-- Contenedor principal -->
                                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                        
                                        <!-- Header guinda -->
                                        <tr>
                                            <td style="background: linear-gradient(135deg, #8B1538 0%, #A52A2A 100%); padding: 40px 30px; text-align: center;">
                                                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                                                    📬 Nueva Solicitud de Contacto
                                                </h1>
                                                <p style="margin: 10px 0 0 0; color: #FFE5E5; font-size: 14px;">
                                                    KÜCHE-Cocinas Inteligentes
                                                </p>
                                            </td>
                                        </tr>
                                        
                                        <!-- Contenido -->
                                        <tr>
                                            <td style="padding: 40px 30px;">
                                                <p style="margin: 0 0 25px 0; color: #4a4a4a; font-size: 15px; line-height: 1.6;">
                                                    Has recibido una nueva solicitud de contacto desde tu sitio web. A continuación los detalles:
                                                </p>
                                                
                                                <!-- Tarjeta de información -->
                                                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border-left: 4px solid #8B1538; border-radius: 8px; margin-bottom: 20px;">
                                                    <tr>
                                                        <td style="padding: 25px;">
                                                            
                                                            <!-- Nombre -->
                                                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 18px;">
                                                                <tr>
                                                                    <td style="padding-bottom: 6px;">
                                                                        <span style="color: #8B1538; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                                                            👤 Nombre
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td>
                                                                        <span style="color: #2c2c2c; font-size: 16px; font-weight: 500;">
                                                                            ${nombre}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                            
                                                            <!-- Teléfono -->
                                                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 18px;">
                                                                <tr>
                                                                    <td style="padding-bottom: 6px;">
                                                                        <span style="color: #8B1538; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                                                            📱 Teléfono
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td>
                                                                        <a href="tel:${telefono}" style="color: #2c2c2c; font-size: 16px; font-weight: 500; text-decoration: none;">
                                                                            ${telefono}
                                                                        </a>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                            
                                                            <!-- Correo -->
                                                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: ${mensaje ? '18px' : '0'};">
                                                                <tr>
                                                                    <td style="padding-bottom: 6px;">
                                                                        <span style="color: #8B1538; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                                                            ✉️ Correo electrónico
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td>
                                                                        <a href="mailto:${correo}" style="color: #2c2c2c; font-size: 16px; font-weight: 500; text-decoration: none;">
                                                                            ${correo}
                                                                        </a>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                            
                                                            ${mensaje ? `
                                                            <!-- Mensaje -->
                                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                                <tr>
                                                                    <td style="padding-bottom: 6px;">
                                                                        <span style="color: #8B1538; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                                                            💬 Mensaje
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td>
                                                                        <p style="margin: 0; color: #2c2c2c; font-size: 15px; line-height: 1.6; background-color: #ffffff; padding: 15px; border-radius: 6px;">
                                                                            ${mensaje}
                                                                        </p>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                            ` : ''}
                                                            
                                                        </td>
                                                    </tr>
                                                </table>
                                                
                                                <!-- Botón de acción -->
                                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                                                    <tr>
                                                        <td align="center">
                                                            <a href="mailto:${correo}" style="display: inline-block; background: linear-gradient(135deg, #8B1538 0%, #A52A2A 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(139, 21, 56, 0.3);">
                                                                📧 Responder ahora
                                                            </a>
                                                        </td>
                                                    </tr>
                                                </table>
                                                
                                            </td>
                                        </tr>
                                        
                                        <!-- Footer -->
                                        <tr>
                                            <td style="background-color: #fafafa; padding: 25px 30px; border-top: 1px solid #e5e5e5;">
                                                <p style="margin: 0 0 8px 0; color: #666666; font-size: 13px; text-align: center;">
                                                    <strong>Cocinas Inteligentes</strong>
                                                </p>
                                        
                                            </td>
                                        </tr>
                                        
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </body>
                    </html>
                `
            });
            
            console.log('✅ Email enviado correctamente a', process.env.EMAIL_EMPRESA);
        } catch (emailError) {
            console.error('❌ Error al enviar email:', emailError.message);
            // No falla la petición si el email falla, el contacto ya se guardó
        }

        // PASO 2.4: Responder al cliente
        return res.status(201).json({
            message: 'Solicitud recibida. Te contactaremos pronto.',
            contacto: {
                _id: contacto._id,
                nombre: contacto.nombre,
                correo: contacto.correo
            }
        });

    } catch (error) {
        console.error('❌ Error general:', error);
        return res.status(500).json({
            message: 'Error al registrar la solicitud',
            error: error.message
        });
    }
};
