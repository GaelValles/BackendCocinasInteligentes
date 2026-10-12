import mongoose from 'mongoose';
import ClienteIdentidad from '../models/clienteIdentidad.model.js';
import Proyecto from '../models/proyecto.model.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const normalizeEmail = (value) => {
    const email = String(value || '').trim().toLowerCase();
    return email || null;
};

const normalizePhone = (value) => {
    const phone = String(value || '').replace(/\D/g, '').trim();
    return phone || null;
};

const normalizeName = (value) => String(value || '').trim();

const buildClienteIdentidadCreatePayload = ({
    codigo,
    nombre,
    correo,
    telefono,
    correoNormalizado,
    telefonoNormalizado
}) => {
    const payload = {
        codigo,
        nombre: normalizeName(nombre) || ''
    };

    if (correoNormalizado) {
        payload.correoNormalizado = correoNormalizado;
        payload.correo = correo || correoNormalizado;
    }

    if (telefonoNormalizado) {
        payload.telefonoNormalizado = telefonoNormalizado;
        payload.telefono = telefono || telefonoNormalizado;
    }

    return payload;
};

export const randomCode6 = () => {
    let output = '';
    for (let i = 0; i < 6; i += 1) {
        const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
        output += CODE_ALPHABET[idx];
    }
    return output;
};

export const normalizeClienteCodigoValue = (value = '') => String(value || '').trim().toUpperCase().replace(/^K-/, '');

const CLIENTE_CODIGO_REGEX = /^[A-Z2-9]{6}$/;

export const isValidClienteCodigo = (value) => CLIENTE_CODIGO_REGEX.test(normalizeClienteCodigoValue(value));

export const generateUniqueClienteCodigo = async () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
        const codigo = randomCode6();
        const exists = await ClienteIdentidad.findOne({ codigo }).select('_id').lean();
        if (!exists) return codigo;
    }

    throw new Error('No fue posible generar un codigo unico para el cliente');
};

const resolveOrCreateClienteIdentidadByCodigo = async ({ codigo, nombre }) => {
    const normalized = normalizeClienteCodigoValue(codigo);
    if (!isValidClienteCodigo(normalized)) return null;

    const existing = await ClienteIdentidad.findOne({ codigo: normalized });
    if (existing) return existing;

    try {
        return await ClienteIdentidad.create(buildClienteIdentidadCreatePayload({
            codigo: normalized,
            nombre
        }));
    } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        return ClienteIdentidad.findOne({ codigo: normalized });
    }
};

export const ensureClienteIdentidadForTarea = async ({
    nombre,
    correo,
    telefono,
    codigoPreferido
} = {}) => {
    const fromContact = await resolveOrCreateClienteIdentidad({
        nombre,
        correo,
        telefono
    });
    if (fromContact) return fromContact;

    if (codigoPreferido && isValidClienteCodigo(codigoPreferido)) {
        const fromCode = await resolveOrCreateClienteIdentidadByCodigo({
            codigo: codigoPreferido,
            nombre
        });
        if (fromCode) return fromCode;
    }

    const codigo = await generateUniqueClienteCodigo();
    return ClienteIdentidad.create(buildClienteIdentidadCreatePayload({
        codigo,
        nombre
    }));
};

const isDuplicateKeyError = (error) => Number(error?.code) === 11000;

const findByUniqueSignal = async ({ correoNormalizado, telefonoNormalizado }) => {
    if (correoNormalizado) {
        const byEmail = await ClienteIdentidad.findOne({ correoNormalizado });
        if (byEmail) return byEmail;
    }

    if (telefonoNormalizado) {
        const byPhone = await ClienteIdentidad.findOne({ telefonoNormalizado });
        if (byPhone) return byPhone;
    }

    return null;
};

const applyLatestClientData = (doc, { nombre, correo, telefono, correoNormalizado, telefonoNormalizado }) => {
    let changed = false;

    if (nombre && nombre !== doc.nombre) {
        doc.nombre = nombre;
        changed = true;
    }

    if (correoNormalizado && correoNormalizado !== doc.correoNormalizado) {
        doc.correo = correo || correoNormalizado;
        doc.correoNormalizado = correoNormalizado;
        changed = true;
    }

    if (telefonoNormalizado && telefonoNormalizado !== doc.telefonoNormalizado) {
        doc.telefono = telefono || telefonoNormalizado;
        doc.telefonoNormalizado = telefonoNormalizado;
        changed = true;
    }

    return changed;
};

export const resolveOrCreateClienteIdentidad = async (payload = {}) => {
    const nombre = normalizeName(payload.nombre);
    const correoNormalizado = normalizeEmail(payload.correo);
    const telefonoNormalizado = normalizePhone(payload.telefono);
    const correo = correoNormalizado ? String(payload.correo || '').trim().toLowerCase() : '';
    const telefono = telefonoNormalizado ? String(payload.telefono || '').trim() : '';

    if (!correoNormalizado && !telefonoNormalizado) {
        return null;
    }

    const normalized = {
        nombre,
        correo,
        telefono,
        correoNormalizado,
        telefonoNormalizado
    };

    const existing = await findByUniqueSignal(normalized);
    if (existing) {
        const changed = applyLatestClientData(existing, normalized);
        if (changed) {
            try {
                await existing.save();
            } catch (error) {
                if (!isDuplicateKeyError(error)) throw error;
                const conflicted = await findByUniqueSignal(normalized);
                if (conflicted) return conflicted;
                throw error;
            }
        }
        return existing;
    }

    for (let attempt = 0; attempt < 25; attempt += 1) {
        const codigo = randomCode6();
        try {
            const created = await ClienteIdentidad.create(buildClienteIdentidadCreatePayload({
                codigo,
                nombre,
                correo,
                telefono,
                correoNormalizado,
                telefonoNormalizado
            }));
            return created;
        } catch (error) {
            if (!isDuplicateKeyError(error)) throw error;

            const conflicted = await findByUniqueSignal(normalized);
            if (conflicted) return conflicted;
        }
    }

    throw new Error('No fue posible generar un codigo unico para el cliente');
};

export const repairClienteIdentidadSparseIndexes = async () => {
    try {
        await ClienteIdentidad.updateMany({ correoNormalizado: null }, { $unset: { correoNormalizado: '' } });
        await ClienteIdentidad.updateMany({ telefonoNormalizado: null }, { $unset: { telefonoNormalizado: '' } });
        await ClienteIdentidad.syncIndexes();
    } catch (error) {
        console.warn('repairClienteIdentidadSparseIndexes:', error?.message || error);
    }
};

export const syncProyectoClienteIdentidad = async ({ proyectoId, clienteIdentidad }) => {
    if (!proyectoId || !clienteIdentidad?._id) return;
    if (!mongoose.Types.ObjectId.isValid(String(proyectoId))) return;

    const project = await Proyecto.findById(proyectoId).select('_id cliente');
    if (!project) return;

    const update = {
        clienteRef: clienteIdentidad._id,
        clienteId: clienteIdentidad.codigo
    };

    await Proyecto.updateOne({ _id: project._id }, { $set: update });

    if (project.cliente) {
        await Proyecto.updateMany({ cliente: project.cliente }, { $set: update });
    }
};
