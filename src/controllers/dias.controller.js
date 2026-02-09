import DiasInhabiles from "../models/dias.model.js";

export const obtenerDiasInhabiles = async (req, res) => {
    try {
        const diasInhabiles = await DiasInhabiles.find()
            .populate('registradoPor', 'nombre correo')
            .sort({ fecha: 1 })
            .lean();

        res.json(diasInhabiles);
    } catch (error) {
        res.status(500).json({ 
            message: "Error al obtener días inhábiles",
            error: error.message 
        });
    }
};

export const registrarDiaInhabil = async (req, res) => {
    try {
        const { fecha } = req.body;

        const nuevoDiaInhabil = new DiasInhabiles({
            fecha: new Date(fecha),
            registradoPor: req.admin.id
        });

        const diaGuardado = await nuevoDiaInhabil.save();

        const diaCompleto = await DiasInhabiles.findById(diaGuardado._id)
            .populate('registradoPor', 'nombre correo')
            .lean();

        res.json(diaCompleto);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                message: "Esta fecha ya está registrada como día inhábil"
            });
        }
        res.status(500).json({ 
            message: "Error al registrar día inhábil",
            error: error.message 
        });
    }
};

export const eliminarDiaInhabil = async (req, res) => {
    try {
        const { id } = req.params;

        const diaEliminado = await DiasInhabiles.findByIdAndDelete(id);
        
        if (!diaEliminado) {
            return res.status(404).json({
                message: "Día inhábil no encontrado"
            });
        }

        res.json({
            message: "Día inhábil eliminado correctamente"
        });
    } catch (error) {
        res.status(500).json({ 
            message: "Error al eliminar día inhábil",
            error: error.message 
        });
    }
};