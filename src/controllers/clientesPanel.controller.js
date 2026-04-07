import mongoose from 'mongoose';
import ClienteIdentidad from '../models/clienteIdentidad.model.js';
import Proyecto from '../models/proyecto.model.js';
import Tarea from '../models/tarea.model.js';
import Citas from '../models/citas.model.js';

const normalizeCodigo = (value = '') => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const normalizePhone = (value = '') => String(value || '').replace(/\D/g, '');

const normalizeLimit = (value, defaultLimit = 20, maxLimit = 200) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
    return Math.min(Math.floor(parsed), maxLimit);
};

const buildCitasFilters = (cliente) => {
    const filters = [];

    if (cliente?._id && mongoose.Types.ObjectId.isValid(String(cliente._id))) {
        filters.push({ clienteRef: cliente._id });
    }

    if (cliente?.codigo) {
        filters.push({ clienteId: cliente.codigo });
    }

    if (cliente?.correoNormalizado) {
        filters.push({ correoNormalizado: cliente.correoNormalizado });
        filters.push({ correoCliente: cliente.correoNormalizado });
    }

    if (cliente?.telefonoNormalizado) {
        filters.push({ telefonoNormalizado: cliente.telefonoNormalizado });
        filters.push({ telefonoCliente: cliente.telefono || cliente.telefonoNormalizado });
    }

    return filters.length ? { $or: filters } : null;
};

const mapCliente = (cliente) => ({
    _id: cliente._id,
    codigo: cliente.codigo,
    nombre: cliente.nombre || '',
    correo: cliente.correo || '',
    telefono: cliente.telefono || '',
    archivos: Array.isArray(cliente.archivos) ? cliente.archivos : [],
    createdAt: cliente.createdAt,
    updatedAt: cliente.updatedAt
});

const mapProyecto = (proyecto) => ({
    _id: proyecto._id,
    nombre: proyecto.nombre,
    cliente: proyecto.cliente,
    clienteRef: proyecto.clienteRef || null,
    clienteId: proyecto.clienteId || '',
    nombreCliente: proyecto.nombreCliente || proyecto.cliente?.nombre || '',
    tipo: proyecto.tipo,
    estado: proyecto.estado,
    timelineActual: proyecto.timelineActual,
    presupuestoTotal: proyecto.presupuestoTotal || 0,
    anticipo: proyecto.anticipo || 0,
    segundoPago: proyecto.segundoPago || 0,
    liquidacion: proyecto.liquidacion || 0,
    empleadoAsignado: proyecto.empleadoAsignado?._id || proyecto.empleadoAsignado || null,
    nombreEmpleadoAsignado: proyecto.empleadoAsignado?.nombre || '',
    createdAt: proyecto.createdAt,
    updatedAt: proyecto.updatedAt
});

const mapTarea = (tarea) => ({
    _id: tarea._id,
    etapa: tarea.etapa,
    estado: tarea.estado,
    proyectoId: tarea.proyectoId || null,
    nombreProyecto: tarea.nombreProyecto || '',
    prioridad: tarea.prioridad || 'media',
    followUpStatus: tarea.followUpStatus || 'pendiente',
    cliente: tarea.cliente || {
        nombre: tarea.cita?.nombreCliente || '',
        correo: tarea.cita?.correoCliente || '',
        telefono: tarea.cita?.telefonoCliente || ''
    },
    clienteRef: tarea.clienteRef || null,
    clienteId: tarea.clienteId || '',
    cita: tarea.cita || null,
    asignadoA: Array.isArray(tarea.asignadoA) ? tarea.asignadoA : [],
    asignadoANombre: Array.isArray(tarea.asignadoANombre) ? tarea.asignadoANombre : [],
    createdAt: tarea.createdAt,
    updatedAt: tarea.updatedAt
});

const mapCita = (cita) => ({
    _id: cita._id,
    fechaAgendada: cita.fechaAgendada,
    nombreCliente: cita.nombreCliente || '',
    correoCliente: cita.correoCliente || '',
    telefonoCliente: cita.telefonoCliente || '',
    clienteRef: cita.clienteRef || null,
    clienteId: cita.clienteId || '',
    estado: cita.estado,
    ubicacion: cita.ubicacion || '',
    informacionAdicional: cita.informacionAdicional || '',
    ingenieroAsignado: cita.ingenieroAsignado?._id || cita.ingenieroAsignado || null,
    nombreIngenieroAsignado: cita.ingenieroAsignado?.nombre || '',
    createdAt: cita.createdAt,
    updatedAt: cita.updatedAt
});

const mapArchivoCliente = (archivo, clienteCodigo = '') => ({
    id: archivo?.id || '',
    tipo: archivo?.tipo || 'otro',
    nombre: archivo?.nombre || '',
    url: archivo?.url || '',
    key: archivo?.key || '',
    provider: archivo?.provider || '',
    mimeType: archivo?.mimeType || '',
    relacionadoA: archivo?.relacionadoA || '',
    relacionadoId: archivo?.relacionadoId || '',
    taskId: archivo?.taskId || '',
    proyectoId: archivo?.proyectoId || '',
    clienteId: archivo?.clienteId || clienteCodigo,
    createdAt: archivo?.createdAt || null
});

export const obtenerPanelClientePorCodigo = async (req, res) => {
    try {
        const codigo = normalizeCodigo(req.params?.codigo || req.query?.codigo || '');
        if (codigo.length !== 6) {
            return res.status(400).json({ success: false, message: 'El codigo de cliente debe tener 6 caracteres' });
        }

        const cliente = await ClienteIdentidad.findOne({ codigo }).lean();
        if (!cliente) {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado para el codigo proporcionado' });
        }

        const [proyectos, tareas] = await Promise.all([
            Proyecto.find({
                $or: [
                    { clienteRef: cliente._id },
                    { clienteId: cliente.codigo }
                ]
            })
                .populate('cliente', 'nombre correo telefono')
                .populate('empleadoAsignado', 'nombre correo')
                .sort({ updatedAt: -1 })
                .lean(),
            Tarea.find({
                $or: [
                    { clienteRef: cliente._id },
                    { clienteId: cliente.codigo }
                ]
            })
                .sort({ updatedAt: -1 })
                .lean()
        ]);

        const citasFilter = buildCitasFilters(cliente);
        const citas = citasFilter
            ? await Citas.find(citasFilter)
                .populate('ingenieroAsignado', 'nombre correo telefono rol')
                .sort({ fechaAgendada: -1 })
                .lean()
            : [];

        return res.status(200).json({
            success: true,
            data: {
                cliente: mapCliente(cliente),
                resumen: {
                    totalProyectos: proyectos.length,
                    totalTareas: tareas.length,
                    totalCitas: citas.length
                },
                proyectos: proyectos.map(mapProyecto),
                tareas: tareas.map(mapTarea),
                citas: citas.map(mapCita)
            }
        });
    } catch (error) {
        console.error('Error al obtener panel de cliente por codigo:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener panel de cliente', error: error.message });
    }
};

export const buscarCodigoCliente = async (req, res) => {
    try {
        const correo = String(req.query?.correo || '').trim().toLowerCase();
        const telefonoInput = String(req.query?.telefono || '').trim();
        const telefono = normalizePhone(telefonoInput);

        if (!correo && !telefono) {
            return res.status(400).json({ success: false, message: 'Debes enviar correo o telefono para buscar el codigo del cliente' });
        }

        const filters = [];
        if (correo) filters.push({ correoNormalizado: correo });
        if (telefono) filters.push({ telefonoNormalizado: telefono });

        const cliente = await ClienteIdentidad.findOne({ $or: filters }).lean();

        if (!cliente) {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado con los datos proporcionados' });
        }

        return res.status(200).json({ success: true, data: mapCliente(cliente) });
    } catch (error) {
        console.error('Error al buscar codigo de cliente:', error);
        return res.status(500).json({ success: false, message: 'Error al buscar codigo de cliente', error: error.message });
    }
};

export const obtenerArchivosClientePorCodigo = async (req, res) => {
    try {
        const codigo = normalizeCodigo(req.params?.codigo || req.query?.codigo || '');
        if (codigo.length !== 6) {
            return res.status(400).json({ success: false, message: 'El codigo de cliente debe tener 6 caracteres' });
        }

        const tipoFiltro = String(req.query?.tipo || '').trim().toLowerCase();
        const providerFiltro = String(req.query?.provider || '').trim().toLowerCase();
        const limit = normalizeLimit(req.query?.limit, 20, 200);

        const cliente = await ClienteIdentidad.findOne({ codigo }, { _id: 1, codigo: 1, archivos: 1 }).lean();
        if (!cliente) {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado para el codigo proporcionado' });
        }

        const archivos = Array.isArray(cliente.archivos) ? [...cliente.archivos] : [];

        const filtrados = archivos.filter((archivo) => {
            const tipoMatch = !tipoFiltro || String(archivo?.tipo || '').trim().toLowerCase() === tipoFiltro;
            const providerMatch = !providerFiltro || String(archivo?.provider || '').trim().toLowerCase() === providerFiltro;
            return tipoMatch && providerMatch;
        });

        filtrados.sort((a, b) => {
            const aTs = new Date(a?.createdAt || 0).getTime();
            const bTs = new Date(b?.createdAt || 0).getTime();
            return bTs - aTs;
        });

        const data = filtrados.slice(0, limit).map((archivo) => mapArchivoCliente(archivo, cliente.codigo));

        return res.status(200).json({
            success: true,
            data: {
                cliente: {
                    _id: cliente._id,
                    codigo: cliente.codigo
                },
                totalArchivos: archivos.length,
                totalFiltrados: filtrados.length,
                limite: limit,
                filtros: {
                    tipo: tipoFiltro || null,
                    provider: providerFiltro || null
                },
                archivos: data
            }
        });
    } catch (error) {
        console.error('Error al obtener archivos de cliente por codigo:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener archivos del cliente', error: error.message });
    }
};
