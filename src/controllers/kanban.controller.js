import Tarea from '../models/tarea.model.js';
import Citas from '../models/citas.model.js';

const ETAPAS_VALIDAS = ['citas', 'disenos', 'cotizacion', 'contrato'];
const ROLES_OPERATIVOS = ['ingeniero', 'empleado', 'empleado_general', 'staff'];

const normalizeFileUrl = (url = '', baseUrl = '') => {
    const value = String(url || '').trim();
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    if (value.startsWith('/') && baseUrl) return `${baseUrl}${value}`;
    return value;
};

const mapTask = (item, baseUrl = '', citaContextById = new Map()) => {
    const sourceType = item.sourceType
        || (item.sourceCitaId ? 'cita' : null)
        || (item.sourceDisenoId ? 'diseno' : null);
    const sourceId = item.sourceId || item.sourceCitaId || item.sourceDisenoId || null;

    const citaContext = sourceType === 'cita' && sourceId
        ? citaContextById.get(String(sourceId))
        : null;

    const clienteIdResolved = String(
        item.clienteId
        || citaContext?.clienteId
        || ''
    ).trim().toUpperCase();

    const clienteRefResolved = item.clienteRef
        || citaContext?.clienteRef
        || null;

    const clienteNombre = item.cliente?.nombre
        || item.cita?.nombreCliente
        || citaContext?.nombreCliente
        || '';
    const clienteCorreo = item.cliente?.correo
        || item.cita?.correoCliente
        || citaContext?.correoCliente
        || '';
    const clienteTelefono = item.cliente?.telefono
        || item.cita?.telefonoCliente
        || citaContext?.telefonoCliente
        || '';

    return {
    id: String(item._id),
    _id: item._id,
    etapa: item.etapa,
    estado: item.estado,
    asignadoA: item.asignadoA || [],
    asignadoANombre: item.asignadoANombre || [],
    assignedToIds: item.asignadoA || [],
    assignedTo: item.asignadoANombre || [],
    nombreProyecto: item.nombreProyecto || '',
    proyectoId: item.proyectoId || null,
    fechaLimite: item.fechaLimite || null,
    scheduledAt: item.scheduledAt || null,
    visitScheduledAt: item.visitScheduledAt || null,
    ubicacion: item.ubicacion || '',
    mapsUrl: item.mapsUrl || '',
    notas: item.notas || '',
    prioridad: item.prioridad || 'media',
    followUpEnteredAt: item.followUpEnteredAt ?? null,
    followUpStatus: item.followUpStatus || 'pendiente',
    citaStarted: Boolean(item.citaStarted),
    citaFinished: Boolean(item.citaFinished),
    designApprovedByAdmin: Boolean(item.designApprovedByAdmin),
    designApprovedByClient: Boolean(item.designApprovedByClient),
    wallSpecs: Array.isArray(item.wallSpecs) ? item.wallSpecs : [],
    wallCostEstimate: item.wallCostEstimate ?? null,
    visita: {
        fechaProgramada: item.visita?.fechaProgramada ?? item.visitScheduledAt ?? null,
        aprobadaPorAdmin: Boolean(item.visita?.aprobadaPorAdmin ?? item.designApprovedByAdmin),
        aprobadaPorCliente: Boolean(item.visita?.aprobadaPorCliente ?? item.designApprovedByClient),
        actualizadaEn: item.visita?.actualizadaEn || null
    },
    sourceType,
    sourceId,
    clienteId: clienteIdResolved,
    clientId: clienteIdResolved,
    codigoCliente: clienteIdResolved,
    codigo: clienteIdResolved,
    clienteRef: clienteRefResolved,
    cliente: {
        _id: clienteRefResolved || null,
        id: clienteRefResolved || null,
        clienteId: clienteIdResolved,
        codigo: clienteIdResolved,
        nombre: clienteNombre,
        correo: clienteCorreo,
        telefono: clienteTelefono
    },
    archivos: Array.isArray(item.archivos)
        ? item.archivos.map((archivo) => ({
            id: archivo?.id || null,
            nombre: archivo?.nombre || '',
            tipo: archivo?.tipo || 'otro',
            url: normalizeFileUrl(archivo?.url || '', baseUrl)
        }))
        : [],
    cita: sourceType === 'cita'
        ? {
            fechaAgendada: item.cita?.fechaAgendada || null,
            nombreCliente: item.cita?.nombreCliente || '',
            correoCliente: item.cita?.correoCliente || '',
            telefonoCliente: item.cita?.telefonoCliente || '',
            ubicacion: item.cita?.ubicacion || '',
            informacionAdicional: item.cita?.informacionAdicional || ''
        }
        : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
    };
};

const getColumn = (etapa) => async (req, res) => {
    try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        if (!ETAPAS_VALIDAS.includes(etapa)) {
            return res.status(400).json({ success: false, message: 'Etapa inválida' });
        }

        const filtros = { etapa };
        const { estado } = req.query;
        if (estado) filtros.estado = estado;

        if (ROLES_OPERATIVOS.includes(req.admin?.rol)) {
            filtros.asignadoA = String(req.admin._id);
        }

        const data = await Tarea.find(filtros).sort({ updatedAt: -1 });

        const citaSourceIdsNeedingFallback = data
            .filter((item) => {
                const itemSourceType = item.sourceType
                    || (item.sourceCitaId ? 'cita' : null)
                    || (item.sourceDisenoId ? 'diseno' : null);
                const itemSourceId = item.sourceId || item.sourceCitaId || null;
                return itemSourceType === 'cita' && itemSourceId && !item.clienteId && !item.clienteRef;
            })
            .map((item) => String(item.sourceId || item.sourceCitaId))
            .filter(Boolean);

        const uniqueCitaSourceIds = [...new Set(citaSourceIdsNeedingFallback)];
        const citaContextById = new Map();

        if (uniqueCitaSourceIds.length > 0) {
            const citas = await Citas.find(
                { _id: { $in: uniqueCitaSourceIds } },
                { _id: 1, clienteId: 1, clienteRef: 1, nombreCliente: 1, correoCliente: 1, telefonoCliente: 1 }
            ).lean();

            for (const cita of citas) {
                citaContextById.set(String(cita._id), {
                    clienteId: String(cita?.clienteId || '').trim().toUpperCase(),
                    clienteRef: cita?.clienteRef || null,
                    nombreCliente: cita?.nombreCliente || '',
                    correoCliente: cita?.correoCliente || '',
                    telefonoCliente: cita?.telefonoCliente || ''
                });
            }
        }

        return res.json({ success: true, data: data.map((item) => mapTask(item, baseUrl, citaContextById)) });
    } catch (err) {
        console.error(`Error listando kanban/${etapa}:`, err);
        return res.status(500).json({ success: false, message: `Error listando etapa ${etapa}`, error: err.message });
    }
};

export const getCitasColumn = getColumn('citas');
export const getDisenosColumn = getColumn('disenos');
export const getCotizacionColumn = getColumn('cotizacion');
export const getContratoColumn = getColumn('contrato');

export const getSeguimientoAlertas = async (req, res) => {
    try {
        const dias = Number(req.query.dias || 3);
        if (!Number.isFinite(dias) || dias <= 0) {
            return res.status(400).json({ success: false, message: 'Parámetro dias inválido' });
        }

        const threshold = Date.now() - dias * 24 * 60 * 60 * 1000;

        const tareas = await Tarea.find({
            etapa: 'contrato',
            followUpStatus: 'pendiente'
        }).select('_id followUpEnteredAt updatedAt');

        const ids = tareas
            .filter((item) => {
                const lastActivity = Number.isFinite(item.followUpEnteredAt)
                    ? item.followUpEnteredAt
                    : new Date(item.updatedAt).getTime();
                return lastActivity <= threshold;
            })
            .map((item) => String(item._id));

        return res.json({
            success: true,
            data: {
                count: ids.length,
                ids
            }
        });
    } catch (error) {
        console.error('Error al obtener alertas de seguimiento:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener alertas de seguimiento', error: error.message });
    }
};
