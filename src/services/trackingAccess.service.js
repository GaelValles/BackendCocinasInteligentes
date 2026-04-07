import mongoose from 'mongoose';
import Proyecto from '../models/proyecto.model.js';
import Tarea from '../models/tarea.model.js';
import TrackingAccess from '../models/trackingAccess.model.js';

const ALNUM_REGEX = /[^a-zA-Z0-9]/g;

export const normalizeCodigoInput = (rawCodigo = '') => {
    return String(rawCodigo || '').replace(ALNUM_REGEX, '').toUpperCase();
};

const first6 = (value = '') => normalizeCodigoInput(value).slice(0, 6);

const hasLength6 = (value = '') => String(value || '').length === 6;

const getSourceFromProject = (proyecto) => {
    if (!proyecto) return null;

    if (proyecto.clienteId) {
        return proyecto.clienteId;
    }

    const clienteId = proyecto.cliente && typeof proyecto.cliente === 'object'
        ? (proyecto.cliente._id || proyecto.cliente.id || null)
        : proyecto.cliente;

    return clienteId || proyecto._id || null;
};

const getSourceFromTask = (tarea) => {
    if (!tarea) return null;

    return tarea.clientId
        || tarea.clienteId
        || tarea.sourceCitaId
        || tarea.sourceId
        || tarea._id
        || null;
};

export const getCodigo6FromProyecto = (proyecto) => first6(getSourceFromProject(proyecto));

export const getCodigo6FromTarea = (tarea) => first6(getSourceFromTask(tarea));

export const upsertTrackingAccess = async ({ codigo6, clientId = null, taskId = null, projectId = null, enabled = true }) => {
    if (!hasLength6(codigo6)) return null;

    const payload = {
        codigo6,
        enabled,
        clientId: clientId || null,
        taskId: taskId || null,
        projectId: projectId || null
    };

    if (projectId) {
        return TrackingAccess.findOneAndUpdate(
            {
                $or: [
                    { codigo6, enabled: true },
                    { projectId, codigo6 }
                ]
            },
            { $set: payload },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    }

    if (taskId) {
        return TrackingAccess.findOneAndUpdate(
            {
                $or: [
                    { codigo6, enabled: true },
                    { taskId }
                ]
            },
            { $set: payload },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    }

    return TrackingAccess.findOneAndUpdate(
        { codigo6, enabled: true },
        { $set: payload },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
};

export const upsertTrackingAccessFromProyecto = async (proyectoLike) => {
    if (!proyectoLike) return null;

    const proyecto = proyectoLike._id
        ? proyectoLike
        : await Proyecto.findById(proyectoLike).lean();

    if (!proyecto) return null;

    const codigo6 = getCodigo6FromProyecto(proyecto);
    if (!hasLength6(codigo6)) return null;

    const clientId = proyecto.cliente && typeof proyecto.cliente === 'object'
        ? (proyecto.cliente._id || null)
        : (proyecto.cliente || null);

    return upsertTrackingAccess({
        codigo6,
        clientId,
        projectId: proyecto._id,
        enabled: true
    });
};

export const upsertTrackingAccessFromTarea = async (tareaLike) => {
    if (!tareaLike) return null;

    const tarea = tareaLike._id
        ? tareaLike
        : await Tarea.findById(tareaLike).lean();

    if (!tarea) return null;

    const codigo6 = getCodigo6FromTarea(tarea);
    if (!hasLength6(codigo6)) return null;

    const projectId = mongoose.Types.ObjectId.isValid(tarea.proyectoId)
        ? new mongoose.Types.ObjectId(tarea.proyectoId)
        : null;

    return upsertTrackingAccess({
        codigo6,
        clientId: tarea.clienteRef || tarea.clienteId || null,
        taskId: tarea._id,
        projectId,
        enabled: true
    });
};

export const findEnabledAccessByCodigo6 = async (codigo6) => {
    const normalized = first6(codigo6);
    if (!hasLength6(normalized)) return null;
    return TrackingAccess.findOne({ codigo6: normalized, enabled: true }).lean();
};

export const disableTrackingAccessByProjectId = async (projectId) => {
    if (!projectId) return null;
    return TrackingAccess.updateMany({ projectId }, { $set: { enabled: false } });
};

export const bootstrapTrackingAccessByCodigo6 = async (codigo6) => {
    const normalized = first6(codigo6);
    if (!hasLength6(normalized)) return null;

    try {
        const [matching] = await Proyecto.aggregate([
            {
                $addFields: {
                    _projectIdStr: { $toString: '$_id' },
                    _clientIdStr: { $toString: '$cliente' },
                    _clienteCodigo6: { $toUpper: { $substr: [{ $ifNull: ['$clienteId', ''] }, 0, 6] } }
                }
            },
            {
                $addFields: {
                    _projectCode6: {
                        $toUpper: { $substr: ['$_projectIdStr', 0, 6] }
                    },
                    _clientCode6: {
                        $toUpper: { $substr: ['$_clientIdStr', 0, 6] }
                    }
                }
            },
            {
                $match: {
                    $or: [
                        { _clienteCodigo6: normalized },
                        { _projectCode6: normalized },
                        { _clientCode6: normalized }
                    ]
                }
            },
            {
                $project: {
                    _clienteCodigo6: 0,
                    _projectCode6: 0,
                    _clientCode6: 0,
                    _projectIdStr: 0,
                    _clientIdStr: 0
                }
            },
            { $limit: 1 }
        ]);

        if (matching) {
            const projectId = matching._id;
            const clientId = matching.cliente || null;

            await upsertTrackingAccess({
                codigo6: normalized,
                projectId,
                clientId,
                enabled: true
            });

            return findEnabledAccessByCodigo6(normalized);
        }

        const taskByClienteId = await Tarea.findOne({ clienteId: normalized })
            .sort({ updatedAt: -1 })
            .lean();

        if (taskByClienteId?._id) {
            const projectId = mongoose.Types.ObjectId.isValid(taskByClienteId.proyectoId)
                ? new mongoose.Types.ObjectId(taskByClienteId.proyectoId)
                : null;

            await upsertTrackingAccess({
                codigo6: normalized,
                taskId: taskByClienteId._id,
                projectId,
                enabled: true
            });

            return findEnabledAccessByCodigo6(normalized);
        }

        return null;
    } catch (error) {
        console.error(`Error en bootstrapTrackingAccessByCodigo6 para código ${codigo6}:`, error.message);
        return null;
    }
};
