import Materiales from '../models/materiales.model.js';

const ALLOWED_UNITS = ['m²', 'm³', 'm', 'unidad', 'caja', 'paquete'];
const ALLOWED_CATEGORIES = ['Madera', 'Metal', 'Piedra', 'Granito', 'Mármol', 'Acero Inoxidable', 'Pintura', 'Herrajes', 'Iluminación', 'Adhesivos', 'Otro'];
const ALLOWED_SECTIONS = [
    'cubierta',
    'estructura',
    'vistas',
    'espesor',
    'cajones_puertas',
    'accesorios_modulo',
    'extraibles_puertas_abatibles',
    'insumos_produccion',
    'extras',
    'gastos_fijos'
];

// Mapeo de secciones del frontend (como llegan desde el cotizador) a secciones internas
const FRONTEND_SECTION_MAPPING = {
    'CUBIERTA': 'cubierta',
    'ESTRUCTURA': 'estructura',
    'VISTAS': 'vistas',
    'ESPESOR': 'espesor',
    'CAJONES Y PUERTAS': 'cajones_puertas',
    'CAJONES_PUERTAS': 'cajones_puertas',
    'ACCESORIOS DE MÓDULO': 'accesorios_modulo',
    'ACCESORIOS_MODULO': 'accesorios_modulo',
    'EXTRAÍBLES Y PUERTAS ABATIBLES': 'extraibles_puertas_abatibles',
    'EXTRAIBLES_PUERTAS_ABATIBLES': 'extraibles_puertas_abatibles',
    'INSUMOS DE PRODUCCIÓN': 'insumos_produccion',
    'INSUMOS_PRODUCCION': 'insumos_produccion',
    'EXTRAS': 'extras',
    'GASTOS FIJOS': 'gastos_fijos',
    'GASTOS_FIJOS': 'gastos_fijos',
    'Herrajes': 'accesorios_modulo'
};

const isAdmin = (req) => req.admin?.rol === 'admin';

const isHerrajeRoute = (req) => {
    const value = `${req.baseUrl || ''} ${req.originalUrl || ''}`.toLowerCase();
    return value.includes('herraje');
};

const normalizeCategoriaToSectionIfNeeded = (categoriaInput) => {
    if (!categoriaInput) return { categoria: undefined, seccion: undefined };

    const normalized = String(categoriaInput).trim();
    const upperKey = normalized.toUpperCase();

    // Detectar si es una sección del cotizador o sección normalizada
    if (FRONTEND_SECTION_MAPPING[normalized] !== undefined) {
        return {
            categoria: 'Otro',
            seccion: FRONTEND_SECTION_MAPPING[normalized]
        };
    }

    if (FRONTEND_SECTION_MAPPING[upperKey] !== undefined) {
        return {
            categoria: 'Otro',
            seccion: FRONTEND_SECTION_MAPPING[upperKey]
        };
    }

    // Si ya es una sección lowercase conocida
    if (ALLOWED_SECTIONS.includes(normalized.toLowerCase())) {
        return {
            categoria: 'Otro',
            seccion: normalized.toLowerCase()
        };
    }

    // Si es una categoría válida, devolverla como está
    if (ALLOWED_CATEGORIES.includes(normalized)) {
        return {
            categoria: normalized,
            seccion: undefined
        };
    }

    // Fallback: devolver como llega (será rechazado en validación si no es válido)
    return {
        categoria: normalized,
        seccion: undefined
    };
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

const mapMaterialResponse = (material) => ({
    _id: material._id,
    id: material.idCotizador || String(material._id),
    idCotizador: material.idCotizador || null,
    nombre: material.nombre,
    descripcion: material.descripcion || '',
    unidadMedida: material.unidadMedida,
    precioUnitario: material.precioUnitario ?? null,
    precioPorMetro: material.precioPorMetro ?? null,
    precioMetroLineal: material.precioPorMetro ?? null,
    categoria: material.categoria,
    seccion: material.seccion || null,
    proveedor: material.proveedor || '',
    disponible: Boolean(material.disponible),
    createdAt: material.createdAt,
    updatedAt: material.updatedAt
});

const buildValidationResult = (payload = {}, { create = false, herraje = false } = {}) => {
    const errors = [];

    const nombre = normalizeString(payload.nombre);
    const descripcion = hasOwn(payload, 'descripcion') ? normalizeString(payload.descripcion) : undefined;
    const proveedor = hasOwn(payload, 'proveedor') ? normalizeString(payload.proveedor) : undefined;
    const idCotizador = hasOwn(payload, 'idCotizador') ? normalizeString(payload.idCotizador) : undefined;

    const rawSection = hasOwn(payload, 'seccion') ? normalizeString(payload.seccion)?.toLowerCase() : undefined;
    const rawUnidad = hasOwn(payload, 'unidadMedida') ? normalizeString(payload.unidadMedida) : undefined;
    const rawCategoria = hasOwn(payload, 'categoria') ? normalizeString(payload.categoria) : undefined;

    // Detectar si lo que llega como categoría es realmente una sección del cotizador
    const mappedResult = normalizeCategoriaToSectionIfNeeded(rawCategoria);
    let unidadMedida = rawUnidad ?? (create && herraje ? 'unidad' : undefined);
    let categoria = mappedResult.categoria;
    let seccion = rawSection ?? mappedResult.seccion;

    // Si se envió seccion explícitamente, usa ese valor (tiene prioridad)
    if (rawSection !== undefined) {
        seccion = rawSection;
    }

    // Si no se determinó categoría y estamos en create/herraje, asigna default
    if (!categoria && create && herraje) {
        categoria = 'Herrajes';
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

    if (create && !categoria) {
        errors.push({ field: 'categoria', message: `Categoria requerida. Valores permitidos: ${ALLOWED_CATEGORIES.join(', ')}` });
    }

    if (categoria !== undefined && !ALLOWED_CATEGORIES.includes(categoria)) {
        errors.push({ field: 'categoria', message: `Categoria inválida. Valores permitidos: ${ALLOWED_CATEGORIES.join(', ')}` });
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
            categoria,
            seccion,
            proveedor,
            idCotizador,
            disponible: hasOwn(payload, 'disponible') ? Boolean(payload.disponible) : undefined
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
            categoria: data.categoria,
            seccion: data.seccion || undefined,
            proveedor: data.proveedor || '',
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
        const { categoria, disponible, seccion } = req.query;

        const filtro = {};
        if (categoria) filtro.categoria = categoria;
        if (seccion) filtro.seccion = String(seccion).toLowerCase();
        if (disponible !== undefined) filtro.disponible = disponible === 'true';

        const materiales = await Materiales.find(filtro)
            .select('idCotizador nombre descripcion unidadMedida precioUnitario precioPorMetro categoria seccion proveedor disponible createdAt updatedAt')
            .sort({ nombre: 1 });

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

        if (data.nombre !== undefined) material.nombre = data.nombre;
        if (data.descripcion !== undefined) material.descripcion = data.descripcion || '';
        if (data.unidadMedida !== undefined) material.unidadMedida = data.unidadMedida;
        if (data.categoria !== undefined) material.categoria = data.categoria;
        if (data.seccion !== undefined) material.seccion = data.seccion || undefined;
        if (data.proveedor !== undefined) material.proveedor = data.proveedor || '';
        if (data.idCotizador !== undefined) material.idCotizador = data.idCotizador || undefined;
        if (data.disponible !== undefined) material.disponible = data.disponible;

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
