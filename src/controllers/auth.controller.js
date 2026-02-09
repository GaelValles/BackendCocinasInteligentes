import Admin from "../models/admin.model.js";
import { TOKEN_SECRET } from "../config.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {createAccessToken} from "../libs/jwt.js";

export const register = async (req, res) => {
    const {nombre, correo, telefono, rol, password} = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const newAdmin = new Admin({
            nombre,
            correo,
            telefono,
            rol,
            password: passwordHash,
            carros: [] // Inicializamos el array de carros vacío
        });

        const AdminSaved = await newAdmin.save();
        const token = await createAccessToken({id: AdminSaved._id})
        
        res.cookie('token', token, {
            samesite: 'none',
            secure: true,
        })
        res.json({
            message: 'Usuario creado correctamente',
        })

    } catch (error) {
        res.status(500).json({ message: error.message})
    }
};
export const subirUser = async (req, res) => {
    const {nombre, correo, telefono, rol, password} = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const newAdmin = new Admin({
            nombre,
            correo,
            telefono,
            rol,
            password: passwordHash,
            carros: []
        });

        const AdminSaved = await newAdmin.save();
        res.json(AdminSaved);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const login = async (req, res) => {
    const {correo, password}= req.body;
    try {
    const AdminFound = await Admin.findOne({correo});

    if (!AdminFound) return res.status(400).json({message: 'Usuario no encontrado'});
    const isMatch = await bcrypt.compare(password, AdminFound.password);
    
    if (!isMatch) return res.status(400).json({message: 'Contraseña incorrecta'});

    const token = await createAccessToken({id: AdminFound._id,})
    
    res.cookie('token',token)
    res.json({
        message: 'Usuario encontrado correctamente',
    })


    } catch (error) {
        res.status(500).json({ message: error.message})
    }
};

export const getUsers = async (req, res) => {
    try {
        const users = await Admin.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params; // Asegúrate de recibir el id por params
        const user = await Admin.findByIdAndUpdate(id, { status: false }, { new: true });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json({ message: 'Usuario desactivado correctamente', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await Admin.findById(id).select('-password'); // Excluye el campo de la contraseña

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


export const logout = (req, res) => {
    res.cookie("token", "",{
        expires: new Date(0)
    });
    return res.sendStatus(200).json({message: "Sesión cerrada correctamente"});
}

export const verifyToken = async (req, res) => {
    const { token } = req.cookies;

    if (!token) return res.status(401).json({message: 'No token provided'});

    jwt.verify(token, TOKEN_SECRET, async (err, admin) => {
        if (err) return res.status(401).json({message: 'Token no válido'});
        
        const adminFound = await Admin.findById(admin.id)
            .populate('citas')
            .populate('carros');

        if (!adminFound) return res.status(404).json({message: 'Usuario no encontrado'});
        
        return res.json({
            id: adminFound._id,
            nombre: adminFound.nombre,
            correo: adminFound.correo,
            telefono: adminFound.telefono,
            rol: adminFound.rol,
            carros: adminFound.carros,
            citas: adminFound.citas,
            penaltyUntil: adminFound.penaltyUntil || null
        });
    });
}

export const perfil = async(req, res) => {
    const adminFound = await Admin.findById(req.admin.id)

    if (!adminFound) return res.status(404).json({message: 'Usuario no encontrado'});

    return res.json(adminFound);
}

export const updatePerfil = async (req, res) => {
    const {nombre, correo, telefono} = req.body;
    const adminUpdated = await Admin.findByIdAndUpdate(req.admin.id, {
        nombre,
        correo,
        telefono
    }, {new: true});
    if (!adminUpdated) return res.status(404).json({message: 'Usuario no encontrado'});
    return res.json(adminUpdated);
};