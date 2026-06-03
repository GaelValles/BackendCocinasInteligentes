import Materiales from '../models/materiales.model.js';

const ALLOWED_UNITS = ['m2', 'm3', 'm', 'unidad', 'caja', 'paquete', 'placas', 'hoja', 'pies'];
const ALLOWED_SECTIONS = [
    'cubierta',
    'estructura',
    'vistas',
    'espesor',
    'herrajes',
    'cajones_puertas',
    'accesorios_modulo',
    'extraibles_puertas_abatibles',
    'insumos_produccion',
    'otros',
    'gastos_fijos'
];

const isAdmin = (req) => req.admin?.rol === 'admin';

const isHerrajeRoute = (req) => {
    const value = `${req.baseUrl || ''} ${req.originalUrl || ''}`.toLowerCase();
    return value.includes('herraje');
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const toNumberOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : Number.NaN;
};

const normalizeString = (value) => {
    if (value === undefined || value === null) return undefined;
    return String(value).trim();
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseBoolean = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'si'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
    return fallback;
};

const normalizeSection = (value) => {
    if (value === undefined || value === null) return undefined;
    return String(value)
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '_');
};

const normalizeTier = (gamaValue, tierValue) => {
    const raw = normalizeString(gamaValue || tierValue);
    if (!raw) return 'Tendencia';

    const check = raw.toLowerCase();
    if (check.includes('premium')) return 'Premium';
    if (check.includes('estandar') || check.includes('standard') || check.includes('basic')) return 'Estandar';
    return 'Tendencia';
};

const mapMaterialResponse = (material) => {
    const tier = normalizeTier(material.gama, material.tier);
    return {
        _id: material._id,
        id: material.idCotizador || String(material._id),
        idCotizador: material.idCotizador || null,
        nombre: material.nombre,
        descripcion: material.descripcion || '',
        unidadMedida: material.unidadMedida,
        precioUnitario: material.precioUnitario ?? null,
        precioPorMetro: material.precioPorMetro ?? null,
        precioMetroLineal: material.precioPorMetro ?? null,
        seccion: material.seccion || null,
        proveedor: material.proveedor || '',
        image: material.image || '',
        gama: tier,
        tier,
        disponible: Boolean(material.disponible),
        createdAt: material.createdAt,
        updatedAt: material.updatedAt
    };
};

const buildValidationResult = (payload = {}, { create = false, herraje = false } = {}) => {
    const errors = [];

    const nombre = normalizeString(payload.nombre);
    const descripcion = hasOwn(payload, 'descripcion') ? normalizeString(payload.descripcion) : undefined;
    const proveedor = hasOwn(payload, 'proveedor') ? normalizeString(payload.proveedor) : undefined;
    const image = hasOwn(payload, 'image') ? normalizeString(payload.image) : undefined;
    const idCotizador = hasOwn(payload, 'idCotizador') ? normalizeString(payload.idCotizador) : undefined;
    const tierNormalized = hasOwn(payload, 'gama') || hasOwn(payload, 'tier')
        ? normalizeTier(payload.gama, payload.tier)
        : undefined;

    const rawSection = hasOwn(payload, 'seccion') ? normalizeSection(payload.seccion) : undefined;
    const rawUnidad = hasOwn(payload, 'unidadMedida') ? normalizeString(payload.unidadMedida) : undefined;
    let unidadMedida = rawUnidad ?? (create && herraje ? 'unidad' : undefined);
    let seccion = rawSection;

    if (!seccion && create && herraje) {
        seccion = 'herrajes';
    }

    const precioUnitario = hasOwn(payload, 'precioUnitario') ? toNumberOrNull(payload.precioUnitario) : undefined;
    const precioPorMetroInput = hasOwn(payload, 'precioPorMetro')
        ? payload.precioPorMetro
        : (hasOwn(payload, 'precioMetroLineal') ? payload.precioMetroLineal : undefined);
    const precioPorMetro = precioPorMetroInput !== undefined ? toNumberOrNull(precioPorMetroInput) : undefined;

    if (create && !nombre) {
        errors.push({ field: 'nombre', message: 'Nombre es requerido' });
    }

    if (create && !unidadMedida) {
        errors.push({ field: 'unidadMedida', message: `Unidad requerida. Valores permitidos: ${ALLOWED_UNITS.join(', ')}` });
    }

    if (unidadMedida !== undefined && !ALLOWED_UNITS.includes(unidadMedida)) {
        errors.push({ field: 'unidadMedida', message: `Unidad inválida. Valores permitidos: ${ALLOWED_UNITS.join(', ')}` });
    }

    if (rawSection !== undefined && rawSection !== '' && !ALLOWED_SECTIONS.includes(rawSection)) {
        errors.push({ field: 'seccion', message: `Seccion inválida. Valores permitidos: ${ALLOWED_SECTIONS.join(', ')}` });
    }

    if (seccion !== undefined && seccion !== '' && !ALLOWED_SECTIONS.includes(seccion)) {
        errors.push({ field: 'seccion', message: `Seccion inválida. Valores permitidos: ${ALLOWED_SECTIONS.join(', ')}` });
    }

    const hasPriceUnit = precioUnitario !== undefined && precioUnitario !== null;
    const hasPriceMetro = precioPorMetro !== undefined && precioPorMetro !== null;

    if (create && !hasPriceUnit && !hasPriceMetro) {
        errors.push({ field: 'precio', message: 'Debe enviar precioUnitario o precioPorMetro' });
    }

    if (precioUnitario !== undefined && (Number.isNaN(precioUnitario) || precioUnitario < 0)) {
        errors.push({ field: 'precioUnitario', message: 'precioUnitario debe ser numérico y mayor o igual a 0' });
    }

    if (precioPorMetro !== undefined && (Number.isNaN(precioPorMetro) || precioPorMetro < 0)) {
        errors.push({ field: 'precioPorMetro', message: 'precioPorMetro debe ser numérico y mayor o igual a 0' });
    }

    return {
        errors,
        data: {
            nombre,
            descripcion,
            unidadMedida,
            precioUnitario,
            precioPorMetro,
            seccion,
            proveedor,
            image,
            gama: tierNormalized,
            tier: tierNormalized,
            idCotizador,
            disponible: hasOwn(payload, 'disponible') ? parseBoolean(payload.disponible, undefined) : undefined
        }
    };
};

const handleDupKeyError = (error, res) => {
    if (error?.code !== 11000) return false;

    const duplicatedField = Object.keys(error.keyPattern || {})[0] || 'campo';
    return res.status(409).json({
        success: false,
        message: `Ya existe un registro con el mismo ${duplicatedField}`,
        error: 'DUPLICATE_KEY'
    });
};

// Crear material
export const crearMaterial = async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ success: false, message: 'Solo admin puede crear materiales' });
        }

        const { errors, data } = buildValidationResult(req.body, {
            create: true,
            herraje: isHerrajeRoute(req)
        });

        if (errors.length) {
            return res.status(400).json({ success: false, message: 'Payload inválido', errors });
        }

        const nombreNorm = data.nombre;

        const materialExistente = await Materiales.findOne({ nombre: { $regex: new RegExp(`^${nombreNorm}$`, 'i') } });
        if (materialExistente) {
            return res.status(409).json({ success: false, message: 'Ya existe un material con ese nombre', data: materialExistente });
        }

        const material = new Materiales({
            nombre: nombreNorm,
            descripcion: data.descripcion || '',
            unidadMedida: data.unidadMedida,
            precioUnitario: data.precioUnitario ?? null,
            precioPorMetro: data.precioPorMetro ?? null,
            seccion: data.seccion || undefined,
            proveedor: data.proveedor || '',
            image: data.image || '',
            gama: data.gama || 'Tendencia',
            tier: data.tier || null,
            idCotizador: data.idCotizador || undefined,
            disponible: data.disponible ?? true,
            historialPrecios: data.precioUnitario !== null
                ? [{ precio: data.precioUnitario, fecha: new Date(), modificadoPor: req.admin.id }]
                : []
        });

        await material.save();

        return res.status(201).json({ success: true, message: 'Material creado exitosamente', data: mapMaterialResponse(material) });

    } catch (error) {
        console.error(error);
        if (handleDupKeyError(error, res)) return;
        return res.status(500).json({ success: false, message: 'Error al crear material', error: error.message });
    }
};

// Obtener todos los materiales
export const obtenerMateriales = async (req, res) => {
    try {
        const { disponible, seccion, secciones, proveedor, q } = req.query;

        const filtro = {};

        const sectionCandidates = [];
        if (seccion) sectionCandidates.push(seccion);
        if (secciones) sectionCandidates.push(...String(secciones).split(','));
        const parsedSections = [...new Set(sectionCandidates.map(normalizeSection).filter(Boolean))];
        if (parsedSections.length === 1) filtro.seccion = parsedSections[0];
        if (parsedSections.length > 1) filtro.seccion = { $in: parsedSections };

        if (proveedor) {
            filtro.proveedor = new RegExp(escapeRegex(String(proveedor).trim()), 'i');
        }

        if (disponible !== undefined) {
            filtro.disponible = parseBoolean(disponible, true);
        }

        if (q) {
            const qRegex = new RegExp(escapeRegex(String(q).trim()), 'i');
            filtro.$or = [
                { nombre: qRegex },
                { descripcion: qRegex },
                { idCotizador: qRegex },
                { proveedor: qRegex }
            ];
        }

        const materiales = await Materiales.find(filtro)
            .select('idCotizador nombre descripcion unidadMedida precioUnitario precioPorMetro seccion proveedor image gama tier disponible createdAt updatedAt')
            .sort({ nombre: 1 })
            .lean();

        return res.status(200).json({ success: true, data: materiales.map(mapMaterialResponse) });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Error al obtener materiales', error: error.message });
    }
};

// Obtener un material específico
export const obtenerMaterial = async (req, res) => {
    try {
        const { id } = req.params;

        const material = await Materiales.findById(id)
            .populate('historialPrecios.modificadoPor', 'nombre');

        if (!material) {
            return res.status(404).json({ success: false, message: 'Material no encontrado' });
        }

        return res.status(200).json({ success: true, data: material });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Error al obtener material', error: error.message });
    }
};

// Buscar material por nombre (para evitar duplicados)
export const buscarMaterialPorNombre = async (req, res) => {
    try {
        const { nombre } = req.query;

        if (!nombre) {
            return res.status(400).json({ success: false, message: "Nombre es requerido" });
        }

        // Búsqueda case-insensitive
        const material = await Materiales.findOne({ 
            nombre: { $regex: new RegExp(`^${nombre.trim()}$`, 'i') }
        });

        if (!material) {
            return res.status(404).json({ success: false, message: "Material no encontrado", data: { existe: false } });
        }

        res.status(200).json({ success: true, data: { existe: true, material } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al buscar material', error: error.message });
    }
};

// Actualizar material
export const actualizarMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const actualizaciones = req.body || {};
        const tienePrecioAlias = hasOwn(actualizaciones, 'precio');
        const precioAlias = tienePrecioAlias ? toNumberOrNull(actualizaciones.precio) : undefined;

        if (!isAdmin(req)) {
            return res.status(403).json({ success: false, message: 'Solo admin puede actualizar materiales' });
        }

        const material = await Materiales.findById(id);
        if (!material) {
            return res.status(404).json({ success: false, message: 'Material no encontrado' });
        }

        const { errors, data } = buildValidationResult(actualizaciones, {
            create: false,
            herraje: isHerrajeRoute(req)
        });

        if (errors.length) {
            return res.status(400).json({ success: false, message: 'Payload inválido', errors });
        }

        if (tienePrecioAlias && (precioAlias === null || Number.isNaN(precioAlias) || precioAlias < 0)) {
            return res.status(400).json({
                success: false,
                message: 'Payload inválido',
                errors: [{ field: 'precio', message: 'precio debe ser numérico y mayor o igual a 0' }]
            });
        }

        if (data.nombre !== undefined) material.nombre = data.nombre;
        if (data.descripcion !== undefined) material.descripcion = data.descripcion || '';
        if (data.unidadMedida !== undefined) material.unidadMedida = data.unidadMedida;
        if (data.seccion !== undefined) material.seccion = data.seccion || undefined;
        if (data.proveedor !== undefined) material.proveedor = data.proveedor || '';
        if (data.image !== undefined) material.image = data.image || '';
        if (data.gama !== undefined) material.gama = data.gama;
        if (data.tier !== undefined) material.tier = data.tier;
        if (data.idCotizador !== undefined) material.idCotizador = data.idCotizador || undefined;
        if (data.disponible !== undefined) material.disponible = data.disponible;

        if (tienePrecioAlias && precioAlias !== undefined) {
            if (material.precioPorMetro !== null) {
                material.precioPorMetro = precioAlias;
            } else {
                if (material.precioUnitario !== null) {
                    material.historialPrecios.push({
                        precio: material.precioUnitario,
                        fecha: new Date(),
                        modificadoPor: req.admin.id
                    });
                }
                material.precioUnitario = precioAlias;
            }
        }

        if (data.precioUnitario !== undefined) {
            if (material.precioUnitario !== null) {
                material.historialPrecios.push({
                    precio: material.precioUnitario,
                    fecha: new Date(),
                    modificadoPor: req.admin.id
                });
            }
            material.precioUnitario = data.precioUnitario;
        }

        if (data.precioPorMetro !== undefined) {
            material.precioPorMetro = data.precioPorMetro;
        }

        await material.save();

        return res.status(200).json({ success: true, message: 'Material actualizado exitosamente', data: mapMaterialResponse(material) });

    } catch (error) {
        console.error(error);
        if (handleDupKeyError(error, res)) return;
        return res.status(500).json({ success: false, message: 'Error al actualizar material', error: error.message });
    }
};

// Actualizar solo el precio del material
export const actualizarPrecioMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevoPrecio } = req.body;

        if (!isAdmin(req)) {
            return res.status(403).json({ success: false, message: 'Solo admin puede actualizar precios' });
        }

        const normalized = toNumberOrNull(nuevoPrecio);
        if (normalized === null || Number.isNaN(normalized) || normalized < 0) {
            return res.status(400).json({ success: false, message: 'Precio inválido' });
        }

        const material = await Materiales.findById(id);
        if (!material) {
            return res.status(404).json({ success: false, message: 'Material no encontrado' });
        }

        await material.actualizarPrecio(normalized, req.admin.id);

        return res.status(200).json({ success: true, message: 'Precio actualizado exitosamente', data: mapMaterialResponse(material) });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Error al actualizar precio', error: error.message });
    }
};

// Eliminar material
export const eliminarMaterial = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isAdmin(req)) {
            return res.status(403).json({ success: false, message: 'Solo admin puede eliminar materiales' });
        }

        const material = await Materiales.findByIdAndDelete(id);
        if (!material) {
            return res.status(404).json({ success: false, message: 'Material no encontrado' });
        }

        return res.status(200).json({ success: true, message: 'Material eliminado exitosamente', data: null });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Error al eliminar material', error: error.message });
    }
};
