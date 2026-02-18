import Materiales from '../models/materiales.model.js';

// Crear material
export const crearMaterial = async (req, res) => {
    try {
        const { nombre, descripcion, unidadMedida, precioUnitario, categoria, proveedor } = req.body;

        // Verificar que sea admin
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "Solo admin puede crear materiales" });
        }

        // Verificar si ya existe un material con ese nombre
        const materialExistente = await Materiales.findOne({ 
            nombre: nombre.trim().toLowerCase() 
        });

        if (materialExistente) {
            return res.status(400).json({ 
                message: "Ya existe un material con ese nombre",
                materialExistente 
            });
        }

        const material = new Materiales({
            nombre: nombre.trim(),
            descripcion: descripcion || '',
            unidadMedida,
            precioUnitario,
            categoria,
            proveedor: proveedor || '',
            historialPrecios: [{
                precio: precioUnitario,
                fecha: new Date(),
                modificadoPor: req.admin.id
            }]
        });

        await material.save();

        res.status(201).json({
            message: "Material creado exitosamente",
            material
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al crear material", error: error.message });
    }
};

// Obtener todos los materiales
export const obtenerMateriales = async (req, res) => {
    try {
        const { categoria, disponible } = req.query;

        const filtro = {};
        if (categoria) filtro.categoria = categoria;
        if (disponible !== undefined) filtro.disponible = disponible === 'true';

        const materiales = await Materiales.find(filtro)
            .select('-historialPrecios') // Ocultar historial en listado general
            .sort({ nombre: 1 });

        res.json(materiales);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener materiales", error: error.message });
    }
};

// Obtener un material específico
export const obtenerMaterial = async (req, res) => {
    try {
        const { id } = req.params;

        const material = await Materiales.findById(id)
            .populate('historialPrecios.modificadoPor', 'nombre');

        if (!material) {
            return res.status(404).json({ message: "Material no encontrado" });
        }

        res.json(material);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener material", error: error.message });
    }
};

// Buscar material por nombre (para evitar duplicados)
export const buscarMaterialPorNombre = async (req, res) => {
    try {
        const { nombre } = req.query;

        if (!nombre) {
            return res.status(400).json({ message: "Nombre es requerido" });
        }

        // Búsqueda case-insensitive
        const material = await Materiales.findOne({ 
            nombre: { $regex: new RegExp(`^${nombre.trim()}$`, 'i') }
        });

        if (!material) {
            return res.status(404).json({ 
                message: "Material no encontrado",
                existe: false 
            });
        }

        res.json({
            existe: true,
            material
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al buscar material", error: error.message });
    }
};

// Actualizar material
export const actualizarMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const actualizaciones = req.body;

        // Verificar que sea admin
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "Solo admin puede actualizar materiales" });
        }

        const material = await Materiales.findById(id);
        if (!material) {
            return res.status(404).json({ message: "Material no encontrado" });
        }

        // Si se actualiza el precio, usar el método especial
        if (actualizaciones.precioUnitario && actualizaciones.precioUnitario !== material.precioUnitario) {
            await material.actualizarPrecio(actualizaciones.precioUnitario, req.admin.id);
            delete actualizaciones.precioUnitario; // Ya lo actualizamos
        }

        // Actualizar otros campos
        Object.assign(material, actualizaciones);
        await material.save();

        res.json({
            message: "Material actualizado exitosamente",
            material
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar material", error: error.message });
    }
};

// Actualizar solo el precio del material
export const actualizarPrecioMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevoPrecio } = req.body;

        // Verificar que sea admin
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "Solo admin puede actualizar precios" });
        }

        if (!nuevoPrecio || nuevoPrecio < 0) {
            return res.status(400).json({ message: "Precio inválido" });
        }

        const material = await Materiales.findById(id);
        if (!material) {
            return res.status(404).json({ message: "Material no encontrado" });
        }

        await material.actualizarPrecio(nuevoPrecio, req.admin.id);

        res.json({
            message: "Precio actualizado exitosamente",
            material
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al actualizar precio", error: error.message });
    }
};

// Eliminar material
export const eliminarMaterial = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que sea admin
        if (req.admin.rol !== 'admin') {
            return res.status(403).json({ message: "Solo admin puede eliminar materiales" });
        }

        const material = await Materiales.findByIdAndDelete(id);
        if (!material) {
            return res.status(404).json({ message: "Material no encontrado" });
        }

        res.json({ message: "Material eliminado exitosamente" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al eliminar material", error: error.message });
    }
};
