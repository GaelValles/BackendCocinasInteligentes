import cron from 'node-cron';
import nodemailer from 'nodemailer';
import Tarea from '../models/tarea.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const FOLLOWUP_REMINDER_STEPS = [3, 8, 13];

const createMailTransport = () => nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const buildReminderMail = ({ tarea, elapsedDays, stepDays }) => {
    const clienteNombre = tarea?.cliente?.nombre || tarea?.cita?.nombreCliente || 'Sin nombre';
    const clienteCorreo = tarea?.cliente?.correo || tarea?.cita?.correoCliente || 'Sin correo';
    const clienteTelefono = tarea?.cliente?.telefono || tarea?.cita?.telefonoCliente || 'Sin telefono';

    return {
        subject: `Seguimiento pendiente (${stepDays} dias) - ${tarea.nombreProyecto || `Tarea ${tarea._id}`}`,
        html: `
            <h2>Recordatorio de seguimiento pendiente</h2>
            <p>Esta tarea permanece en seguimiento sin confirmacion.</p>
            <ul>
                <li><strong>Hito actual:</strong> ${stepDays} dias</li>
                <li><strong>Dias transcurridos:</strong> ${elapsedDays}</li>
                <li><strong>Tarea ID:</strong> ${tarea._id}</li>
                <li><strong>Proyecto:</strong> ${tarea.nombreProyecto || 'Sin nombre de proyecto'}</li>
                <li><strong>Etapa:</strong> ${tarea.etapa}</li>
                <li><strong>Estado seguimiento:</strong> ${tarea.followUpStatus}</li>
                <li><strong>Cliente:</strong> ${clienteNombre}</li>
                <li><strong>Correo cliente:</strong> ${clienteCorreo}</li>
                <li><strong>Telefono cliente:</strong> ${clienteTelefono}</li>
                <li><strong>Ubicacion:</strong> ${tarea.ubicacion || 'Sin ubicacion'}</li>
                <li><strong>Notas:</strong> ${tarea.notas || 'Sin notas'}</li>
            </ul>
            <p>Favor de comunicarse con el cliente.</p>
        `,
        text: [
            'Recordatorio de seguimiento pendiente',
            `Hito actual: ${stepDays} dias`,
            `Dias transcurridos: ${elapsedDays}`,
            `Tarea ID: ${tarea._id}`,
            `Proyecto: ${tarea.nombreProyecto || 'Sin nombre de proyecto'}`,
            `Etapa: ${tarea.etapa}`,
            `Estado seguimiento: ${tarea.followUpStatus}`,
            `Cliente: ${clienteNombre}`,
            `Correo cliente: ${clienteCorreo}`,
            `Telefono cliente: ${clienteTelefono}`,
            `Ubicacion: ${tarea.ubicacion || 'Sin ubicacion'}`,
            `Notas: ${tarea.notas || 'Sin notas'}`,
            'Favor de comunicarse con el cliente.'
        ].join('\n')
    };
};

const sendFollowUpReminderEmail = async ({ tarea, elapsedDays, stepDays }) => {
    const smtpUser = String(process.env.SMTP_USER || '').trim();
    const smtpPass = String(process.env.SMTP_PASS || '').trim();
    const emailEmpresa = String(process.env.EMAIL_EMPRESA || '').trim();

    if (!smtpUser || !smtpPass || !emailEmpresa) {
        throw new Error('SMTP_USER, SMTP_PASS o EMAIL_EMPRESA no estan configurados');
    }

    const transporter = createMailTransport();
    const mail = buildReminderMail({ tarea, elapsedDays, stepDays });

    await transporter.sendMail({
        from: smtpUser,
        to: emailEmpresa,
        subject: mail.subject,
        html: mail.html,
        text: mail.text
    });
};

/**
 * Daily cron job to auto-inactivate tasks in 'contrato' stage
 * after 10 days of no activity (followUpEnteredAt threshold)
 * 
 * Runs daily at 00:00 (midnight)
 */
export const startFollowUpCron = () => {
    try {
        // Schedule to run daily at 00:00
        const job = cron.schedule('0 0 * * *', async () => {
            console.log('🕐 [CRON] Running daily follow-up reminders and auto-inactivate job...');
            await runFollowUpAutomation();
        });

        console.log('✅ [CRON] Follow-up automation cron job scheduled (daily at 00:00)');
        return job;
    } catch (error) {
        console.error('❌ [CRON] Failed to start follow-up cron job:', error.message);
        throw error;
    }
};

/**
 * Send follow-up reminder emails at 3, 8 and 13 days, then auto-inactivate.
 */
export const runFollowUpAutomation = async () => {
    try {
        const now = Date.now();

        const tasksInFollowUp = await Tarea.find({
            etapa: 'contrato',
            followUpStatus: 'pendiente',
            followUpEnteredAt: { $ne: null }
        });

        if (tasksInFollowUp.length === 0) {
            console.log('ℹ️  [CRON] No pending follow-up tasks to process today');
            return { success: true, reviewed: 0, reminded: 0, inactivated: 0 };
        }

        console.log(`⏳ [CRON] Processing ${tasksInFollowUp.length} follow-up tasks`);

        let reminded = 0;
        let inactivated = 0;

        for (const tarea of tasksInFollowUp) {
            tarea.historialCambios = Array.isArray(tarea.historialCambios) ? tarea.historialCambios : [];

            const enteredAt = Number(tarea.followUpEnteredAt);
            if (!Number.isFinite(enteredAt) || enteredAt <= 0) {
                continue;
            }

            const elapsedDays = Math.floor((now - enteredAt) / DAY_MS);
            const sentSteps = Array.isArray(tarea.followUpReminderStepsSent)
                ? tarea.followUpReminderStepsSent.filter((n) => Number.isFinite(Number(n))).map(Number)
                : [];

            const nextStep = FOLLOWUP_REMINDER_STEPS.find((step) => elapsedDays >= step && !sentSteps.includes(step));
            if (!nextStep) {
                continue;
            }

            try {
                await sendFollowUpReminderEmail({ tarea, elapsedDays, stepDays: nextStep });

                tarea.followUpReminderStepsSent = [...new Set([...sentSteps, nextStep])].sort((a, b) => a - b);
                tarea.followUpLastReminderAt = new Date();
                tarea.historialCambios.push({
                    by: 'SYSTEM_FOLLOWUP_CRON',
                    action: 'followup-reminder-email-sent',
                    changes: {
                        stepDays: nextStep,
                        elapsedDays,
                        sentTo: process.env.EMAIL_EMPRESA
                    },
                    at: new Date()
                });

                reminded += 1;

                if (nextStep === 13 && tarea.followUpStatus === 'pendiente') {
                    tarea.followUpStatus = 'inactivo';
                    tarea.estado = 'completada';
                    tarea.historialCambios.push({
                        by: 'SYSTEM_FOLLOWUP_CRON',
                        action: 'auto-inactivated-after-followup-sequence',
                        changes: {
                            followUpStatus: 'inactivo',
                            elapsedDays,
                            sequence: FOLLOWUP_REMINDER_STEPS
                        },
                        at: new Date()
                    });
                    inactivated += 1;
                }

                await tarea.save();
            } catch (mailError) {
                console.error(`❌ [CRON] Could not send follow-up reminder for task ${tarea._id}:`, mailError.message);
                tarea.historialCambios.push({
                    by: 'SYSTEM_FOLLOWUP_CRON',
                    action: 'followup-reminder-email-failed',
                    changes: {
                        stepDays: nextStep,
                        elapsedDays,
                        error: mailError.message
                    },
                    at: new Date()
                });
                await tarea.save();
            }
        }

        console.log(`✅ [CRON] Follow-up automation completed. reminded=${reminded}, inactivated=${inactivated}`);
        return {
            success: true,
            reviewed: tasksInFollowUp.length,
            reminded,
            inactivated
        };

    } catch (error) {
        console.error('❌ [CRON] Error during follow-up automation process:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Manual trigger to run follow-up automation immediately.
 * Useful for testing or manual runs
 */
export const triggerFollowUpCheck = async () => {
    console.log('🚀 [MANUAL TRIGGER] Running follow-up automation check...');
    return runFollowUpAutomation();
};

// Backward-compatible export name used by older code paths.
export const runFollowUpAutoInactivate = runFollowUpAutomation;
