import Notificaciones from '../models/notificaciones.model.js';

// Obtener todas las notificaciones del usuario autenticado
export const obtenerNotificaciones = async (req, res) => {
    try {
        const notificaciones = await Notificaciones.find({ destinatario: req.user?.id })
            .sort({ createdAt: -1 })
            .limit(50); // Limitar a las últimas 50

        res.json({ success: true, data: notificaciones });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener notificaciones', error: error.message });
    }
};

// Obtener solo notificaciones no leídas
export const obtenerNotificacionesNoLeidas = async (req, res) => {
    try {
        const notificaciones = await Notificaciones.obtenerNoLeidas(req.user?.id);

        res.json({ success: true, data: notificaciones });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener notificaciones no leídas', error: error.message });
    }
};

// Obtener contador de notificaciones no leídas
export const obtenerContadorNoLeidas = async (req, res) => {
    try {
        const contador = await Notificaciones.countDocuments({
            destinatario: req.user?.id,
            leida: false
        });

        res.json({ success: true, data: { contador } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener contador', error: error.message });
    }
};

// Marcar una notificación como leída
export const marcarComoLeida = async (req, res) => {
    try {
        const { id } = req.params;

        const notificacion = await Notificaciones.findById(id);
        
        if (!notificacion) {
            return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
        }

        // Verificar que la notificación pertenece al usuario
        if (notificacion.destinatario.toString() !== req.user?.id) {
            return res.status(403).json({ success: false, message: 'No tienes permisos para modificar esta notificación' });
        }

        await notificacion.marcarComoLeida();

        res.json({ success: true, message: 'Notificación marcada como leída', data: notificacion });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al marcar notificación", error: error.message });
    }
};

// Marcar todas las notificaciones como leídas
export const marcarTodasComoLeidas = async (req, res) => {
    try {
        const resultado = await Notificaciones.updateMany(
            { destinatario: req.user.id, leida: false },
            { $set: { leida: true, fechaLectura: new Date() } }
        );

        res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas', data: { modificadas: resultado.modifiedCount } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al marcar notificaciones", error: error.message });
    }
};
