import Citas from '../models/citas.model.js';
import Disenos from '../models/disenos.model.js';
import Cotizacion from '../models/cotizacion.model.js';
import Proyecto from '../models/proyecto.model.js';

// Helper to map to frontend task shape
const mapToTaskShape = (item, opts = {}) => {
    return {
        _id: item._id,
        titulo: opts.title || (item.nombreCliente ? `Cita: ${item.nombreCliente}` : item.nombre || item.titulo || ''),
        etapa: opts.etapa || '',
        estado: opts.estado || 'pendiente',
        // Normalize asignadoA/asignadoANombre to arrays for frontend compatibility
        asignadoA: Array.isArray(item.asignadoA) ? item.asignadoA : (item.ingenieroAsignado ? [item.ingenieroAsignado._id] : (item.asignadoA ? [item.asignadoA] : [])),
        asignadoANombre: Array.isArray(item.asignadoANombre) ? item.asignadoANombre : (item.ingenieroAsignado ? [item.ingenieroAsignado.nombre] : (item.asignadoANombre ? [item.asignadoANombre] : [])),
        proyecto: item.proyecto || null,
        nombreProyecto: item.nombreProyecto || item.nombreProyecto || '',
        notas: item.informacionAdicional || item.notas || '',
        archivos: item.archivos || [],
        raw: item
    };
};

export const getCitasColumn = async (req, res) => {
    try {
        const { estado } = req.query;
        let filtros = {};
        if (estado) filtros.estado = estado;
        const citas = await Citas.find(filtros).sort({ fechaAgendada: -1 }).populate('ingenieroAsignado', 'nombre correo');
        const data = citas.map(c => mapToTaskShape(c, { etapa: 'citas', estado: c.estado, title: `Cita: ${c.nombreCliente} - ${c.fechaAgendada?.toISOString?.() || ''}` }));
        return res.json({ success: true, data, message: 'Citas listadas' });
    } catch (err) {
        console.error('getCitasColumn error', err);
        return res.status(500).json({ success: false, message: 'Error listando citas', error: err.message });
    }
};

export const getDisenosColumn = async (req, res) => {
    try {
        const { estado } = req.query;
        let filtros = {};
        if (estado) filtros.estado = estado;
        const items = await Disenos.find(filtros).sort({ createdAt: -1 }).populate('cliente', 'nombre');
        const data = items.map(i => mapToTaskShape(i, { etapa: 'disenos', title: i.nombre || i.titulo || `Diseño ${i._id}`, estado: i.estado || 'pendiente' }));
        return res.json({ success: true, data, message: 'Diseños listados' });
    } catch (err) {
        console.error('getDisenosColumn error', err);
        return res.status(500).json({ success: false, message: 'Error listando diseños', error: err.message });
    }
};

export const getCotizacionColumn = async (req, res) => {
    try {
        const { estado } = req.query;
        let filtros = {};
        if (estado) filtros.estado = estado;
        const items = await Cotizacion.find(filtros).sort({ createdAt: -1 }).populate('cliente', 'nombre');
        const data = items.map(i => mapToTaskShape(i, { etapa: 'cotizacion', title: i.nombre || i.titulo || `Cotizacion ${i._id}`, estado: i.estado || 'pendiente' }));
        return res.json({ success: true, data, message: 'Cotizaciones listadas' });
    } catch (err) {
        console.error('getCotizacionColumn error', err);
        return res.status(500).json({ success: false, message: 'Error listando cotizaciones', error: err.message });
    }
};

export const getContratoColumn = async (req, res) => {
    try {
        const { estado } = req.query;
        let filtros = {};
        if (estado) filtros.estado = estado;
        // Use Proyecto as seguimiento/contrato representation
        const items = await Proyecto.find(filtros).sort({ updatedAt: -1 }).populate('cliente', 'nombre').populate('empleadoAsignado', 'nombre');
        const data = items.map(i => mapToTaskShape(i, { etapa: 'contrato', title: i.nombre || `Proyecto ${i._id}`, estado: i.estado || 'pendiente' }));
        return res.json({ success: true, data, message: 'Proyectos (contrato) listados' });
    } catch (err) {
        console.error('getContratoColumn error', err);
        return res.status(500).json({ success: false, message: 'Error listando contrato/seguimiento', error: err.message });
    }
};
