import Pago from '../models/pago.model.js';
import OrdenTrabajo from '../models/ordenTrabajo.model.js';

// Registrar un pago (solo admin)
export const registrarPago = async (req, res) => {
    try {
        if (!req.admin || req.admin?.rol !== 'admin') {
            return res.status(403).json({ success: false, message: 'Solo el administrador puede registrar pagos' });
        }

        const { ordenTrabajoId, monto, concepto } = req.body;

        if (!ordenTrabajoId || monto == null || monto < 0) {
            return res.status(400).json({ success: false, message: 'ordenTrabajoId y monto (>= 0) son requeridos' });
        }

        const orden = await OrdenTrabajo.findById(ordenTrabajoId);
        if (!orden) {
            return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada' });
        }

        const pago = new Pago({
            ordenTrabajo: ordenTrabajoId,
            monto: Number(monto),
            concepto: concepto?.trim() || '',
            registradoPor: req.admin.id
        });
        await pago.save();

        const pagoConOrden = await Pago.findById(pago._id).populate('ordenTrabajo', 'numeroSeguimiento estado');

        res.status(201).json({ success: true, message: 'Pago registrado correctamente', data: pagoConOrden });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al registrar pago', error: error.message });
    }
};

// Listar pagos de una orden (admin o ingeniero asignado)
export const listarPagosPorOrden = async (req, res) => {
    try {
        const { ordenId } = req.params;

        const orden = await OrdenTrabajo.findById(ordenId);
        if (!orden) {
            return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada' });
        }

        const esAdmin = req.admin?.rol === 'admin';
        const esIngenieroAsignado = orden.ingenieroAsignado?.toString() === req.admin?.id;
        if (!esAdmin && !esIngenieroAsignado) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para ver los pagos de esta orden' });
        }

        const pagos = await Pago.find({ ordenTrabajo: ordenId })
            .populate('registradoPor', 'nombre')
            .sort({ fecha: -1 })
            .lean();

        const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);

        res.status(200).json({ success: true, data: { pagos, totalPagado } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al listar pagos', error: error.message });
    }
};
