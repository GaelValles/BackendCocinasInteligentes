
import mongoose from 'mongoose';
import Tarea from '../models/tarea.model.js';
import Citas from '../models/citas.model.js';
import Proyecto from '../models/proyecto.model.js';
import Admin from '../models/admin.model.js';
import { isOwnerOrStaff, canModifyResource } from '../middlewares/roleValidator.js';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

// Multer setup for task file uploads
const uploadsDir = path.join(process.cwd(), 'uploads', 'tasks');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
export const upload = multer({ storage });

/**
 * 1. Obtener todas las tareas (con filtros opcionales)
 * GET /api/tareas
 * Query params: etapa, estado, asignadoA, proyecto
 */
export const obtenerTareas = async (req, res) => {
    try {
        const { etapa: etapaQuery, estado, asignadoA, proyecto, stage } = req.query;
        const etapa = etapaQuery || stage;
        const userRole = req.admin?.rol || null;
        const userId = req.admin?._id || null;

        // Construir filtros
        let filtros = {};

        if (etapa) filtros.etapa = etapa;
        if (estado) filtros.estado = estado;
        if (proyecto) filtros.proyecto = proyecto;

        // Si hay filtro de asignadoA, aplicarlo
        if (asignadoA) {
            filtros.asignadoA = asignadoA;
        } else {
            // Si no hay filtro, aplicar lógica de permisos
            // Ingenieros solo ven sus propias tareas
            if (userRole === 'ingeniero') {
                filtros.asignadoA = userId;
            }
            // Admin y arquitecto ven todas las tareas
        }

        // Si piden la columna "citas", leer desde la colección Citas y mapear al formato de tareas
        if (etapa === 'citas') {
            // Construir filtros para Citas
            let filtrosCitas = {};
            if (estado) {
                // Accept frontend states pendient|completada and domain states
                // Map frontend 'pendiente'/'completada' to domain where possible
                if (estado === 'pendiente') {
                    // programada or en_proceso considered pendiente
                    filtrosCitas.estado = { $in: ['programada', 'en_proceso'] };
                } else if (estado === 'completada') {
                    filtrosCitas.estado = 'completada';
                } else {
                    filtrosCitas.estado = estado;
                }
            }

            // Permisos por rol
            if (userRole === 'cliente') {
                // Clientes solo ven sus propias citas (por correo)
                filtrosCitas.correoCliente = req.admin?.correo || null;
            } else if (userRole === 'ingeniero') {
                // Ingenieros solo ven citas asignadas a ellos
                filtrosCitas.ingenieroAsignado = userId;
            }

            const citas = await Citas.find(filtrosCitas)
                .populate('ingenieroAsignado', 'nombre correo')
                .sort({ fechaAgendada: -1 });

            const citasFormateadas = citas.map(cita => {
                // Normalize estado to frontend values
                let estadoNormalizado = 'pendiente';
                if (cita.estado === 'completada') estadoNormalizado = 'completada';
                // cancelada keep as pendiente for UI but expose original
                return {
                    _id: cita._id,
                    titulo: `Cita: ${cita.nombreCliente} - ${cita.fechaAgendada.toISOString()}`,
                    etapa: 'citas',
                    estado: estadoNormalizado,
                    estadoOriginal: cita.estado,
                    asignadoA: cita.ingenieroAsignado ? cita.ingenieroAsignado._id : null,
                    asignadoANombre: cita.ingenieroAsignado ? cita.ingenieroAsignado.nombre : null,
                    proyecto: null,
                    nombreProyecto: '',
                    notas: cita.informacionAdicional || cita.especificacionesInicio?.especificaciones || '',
                    archivos: [],
                    fechaAgendada: cita.fechaAgendada,
                    fechaInicio: cita.fechaInicio,
                    fechaTermino: cita.fechaTermino,
                    nombreCliente: cita.nombreCliente,
                    correoCliente: cita.correoCliente,
                    telefonoCliente: cita.telefonoCliente,
                    createdAt: cita.createdAt,
                    updatedAt: cita.updatedAt
                };
            });

            return res.json({ success: true, message: 'Citas obtenidas exitosamente', data: citasFormateadas });
        }

    } catch (error) {
        console.error('Error al obtener tareas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tareas',
            error: error.message
        });
    }
};

/**
 * 2. Obtener tarea por ID
 * GET /api/tareas/:id
 */
export const obtenerTarea = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tarea inválido'
            });
        }

        const tarea = await Tarea.findById(id)
            .populate('asignadoA', 'nombre correo')
            .populate('proyecto', 'nombre');

        if (!tarea) {
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        // Verificar permisos: Ingenieros solo ven sus propias tareas
        if (!isOwnerOrStaff(tarea.asignadoA._id, req)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para ver esta tarea'
            });
        }

        // Formatear respuesta
        const tareaFormateada = {
            _id: tarea._id,
            titulo: tarea.titulo,
            etapa: tarea.etapa,
            estado: tarea.estado,
            asignadoA: tarea.asignadoA._id,
            asignadoANombre: tarea.asignadoA.nombre,
            proyecto: tarea.proyecto._id,
            nombreProyecto: tarea.proyecto.nombre,
            notas: tarea.notas,
            archivos: tarea.archivos,
            createdAt: tarea.createdAt,
            updatedAt: tarea.updatedAt
        };

        res.json({
            success: true,
            message: 'Tarea obtenida exitosamente',
            data: tareaFormateada
        });

    } catch (error) {
        console.error('Error al obtener tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tarea',
            error: error.message
        });
    }
};

/**
 * 3. Crear nueva tarea
 * POST /api/tareas
 */
export const crearTarea = async (req, res) => {
    try {
        const { titulo, etapa, estado, asignadoA, proyecto, notas } = req.body;

        // Normalizar asignadoA: aceptar array o string
        let asignadoId = null;
        if (Array.isArray(asignadoA)) {
            const first = asignadoA.length ? asignadoA[0] : null;
            asignadoId = (first && typeof first === 'object') ? (first._id || null) : first;
        } else if (asignadoA && typeof asignadoA === 'object') {
            asignadoId = asignadoA._id || null;
        } else asignadoId = asignadoA || null;

        // Validar que el usuario asignado existe (si se proporcionó)
        let usuarioAsignado = null;
        if (asignadoId) {
            if (!mongoose.Types.ObjectId.isValid(asignadoId)) {
                return res.status(400).json({ success: false, message: 'ID de usuario asignado inválido' });
            }
            usuarioAsignado = await Admin.findById(asignadoId);
            if (!usuarioAsignado) {
                console.warn('[crearTarea] usuario asignado no encontrado:', asignadoId);
                return res.status(404).json({
                    success: false,
                    message: 'Usuario asignado no encontrado'
                });
            }
        }

        // Validar que el proyecto existe (si se proporcionó)
        let proyectoExiste = null;
        if (proyecto) {
            if (!mongoose.Types.ObjectId.isValid(proyecto)) {
                return res.status(400).json({ success: false, message: 'ID de proyecto inválido' });
            }
            proyectoExiste = await Proyecto.findById(proyecto);
            if (!proyectoExiste) {
                return res.status(404).json({
                    success: false,
                    message: 'Proyecto no encontrado'
                });
            }
        }

        // Crear la tarea
        const nuevaTarea = new Tarea({
            titulo,
            etapa,
            estado: estado || 'pendiente',
            asignadoA: asignadoId,
            proyectoId: proyecto || null,
            nombreProyecto: proyectoExiste ? proyectoExiste.nombre : '',
            notas: notas || '',
            creadoPor: req.admin?._id || null
        });

        await nuevaTarea.save();

        // Formatear respuesta usando los objetos ya consultados (si existen)
        const tareaFormateada = {
            _id: nuevaTarea._id,
            titulo: nuevaTarea.titulo,
            etapa: nuevaTarea.etapa,
            estado: nuevaTarea.estado,
            asignadoA: usuarioAsignado ? usuarioAsignado._id : (nuevaTarea.asignadoA || null),
            asignadoANombre: usuarioAsignado ? usuarioAsignado.nombre : (nuevaTarea.asignadoANombre || ''),
            proyecto: proyectoExiste ? proyectoExiste._id : (nuevaTarea.proyectoId || null),
            nombreProyecto: proyectoExiste ? proyectoExiste.nombre : nuevaTarea.nombreProyecto,
            notas: nuevaTarea.notas,
            archivos: nuevaTarea.archivos,
            createdAt: nuevaTarea.createdAt,
            updatedAt: nuevaTarea.updatedAt
        };

        res.status(201).json({
            success: true,
            message: 'Tarea creada exitosamente',
            data: tareaFormateada
        });

    } catch (error) {
        console.error('Error al crear tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear tarea',
            error: error.message
        });
    }
};

/**
 * 4. Actualizar tarea completa
 * PUT /api/tareas/:id
 */
export const actualizarTarea = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, etapa, estado, asignadoA, notas } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tarea inválido'
            });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) {
            // Si no existe en la colección Tarea, verificar si el id pertenece a una Cita
            const cita = await Citas.findById(id).populate('ingenieroAsignado', 'nombre correo telefono rol');
            if (cita) {
                // Permitimos actualizaciones parciales desde el endpoint de tareas hacia una Cita
                const previoEstado = cita.estado;

                let changed = false;

                // actualizar asignación si llega asignadoA (array o string)
                if (asignadoA) {
                    const nuevo = Array.isArray(asignadoA) ? asignadoA[0] : asignadoA;
                    if (nuevo && mongoose.Types.ObjectId.isValid(nuevo)) {
                        const usuarioAsignado = await Admin.findById(nuevo);
                        if (usuarioAsignado) {
                            // remover de ingeniero anterior si existe
                            if (cita.ingenieroAsignado && cita.ingenieroAsignado._id.toString() !== nuevo) {
                                await Admin.findByIdAndUpdate(cita.ingenieroAsignado._id, { $pull: { citas: cita._id } });
                            }
                            cita.ingenieroAsignado = nuevo;
                            if (!usuarioAsignado.citas || !usuarioAsignado.citas.includes(cita._id)) {
                                usuarioAsignado.citas = usuarioAsignado.citas || [];
                                usuarioAsignado.citas.push(cita._id);
                                await usuarioAsignado.save();
                            }
                            changed = true;
                        }
                    }
                }

                if (notas !== undefined) {
                    cita.informacionAdicional = notas;
                    changed = true;
                }

                if (estado) {
                    if (estado === 'completada') {
                        cita.estado = 'completada';
                        cita.fechaTermino = new Date();
                        changed = true;
                    } else if (estado === 'pendiente') {
                        if (cita.estado !== 'completada') {
                            cita.estado = 'programada';
                            changed = true;
                        }
                    }
                }

                if (changed) {
                    cita.historialEstados = cita.historialEstados || [];
                    cita.historialEstados.push({ from: previoEstado, to: cita.estado, by: req.admin?._id || null, at: new Date(), nota: 'Actualizado desde endpoint /api/tareas' });
                    await cita.save();
                }

                // Formatear como tarea para respuesta al frontend
                const tareaFormateada = {
                    _id: cita._id,
                    titulo: `Cita: ${cita.nombreCliente} - ${cita.fechaAgendada?.toISOString?.() || ''}`,
                    etapa: 'citas',
                    estado: cita.estado === 'completada' ? 'completada' : 'pendiente',
                    asignadoA: cita.ingenieroAsignado ? [cita.ingenieroAsignado._id] : [],
                    asignadoANombre: cita.ingenieroAsignado ? [cita.ingenieroAsignado.nombre] : [],
                    proyecto: null,
                    nombreProyecto: '',
                    notas: cita.informacionAdicional || cita.especificacionesInicio?.especificaciones || '',
                    archivos: [],
                    createdAt: cita.createdAt,
                    updatedAt: cita.updatedAt
                };

                return res.json({ success: true, message: 'Cita actualizada (vía endpoint tareas)', data: tareaFormateada });
            }

            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        // Verificar permisos: Ingenieros solo pueden actualizar sus propias tareas
        if (!canModifyResource(tarea.asignadoA, req)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para actualizar esta tarea'
            });
        }

        // Validar nuevo usuario asignado si se proporciona
        if (asignadoA && asignadoA !== tarea.asignadoA.toString()) {
            const usuarioAsignado = await Admin.findById(asignadoA);
            if (!usuarioAsignado) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario asignado no encontrado'
                });
            }
        }

        // Actualizar campos
        if (titulo) tarea.titulo = titulo;
        if (etapa) tarea.etapa = etapa;
        if (estado) tarea.estado = estado;
        if (asignadoA) tarea.asignadoA = asignadoA;
        if (notas !== undefined) tarea.notas = notas;

        await tarea.save();

        // Poblar referencias para la respuesta
        await tarea.populate('asignadoA', 'nombre correo');
        await tarea.populate('proyecto', 'nombre');

        // Formatear respuesta
        const tareaFormateada = {
            _id: tarea._id,
            titulo: tarea.titulo,
            etapa: tarea.etapa,
            estado: tarea.estado,
            asignadoA: tarea.asignadoA._id,
            asignadoANombre: tarea.asignadoA.nombre,
            proyecto: tarea.proyecto._id,
            nombreProyecto: tarea.proyecto.nombre,
            notas: tarea.notas,
            archivos: tarea.archivos,
            createdAt: tarea.createdAt,
            updatedAt: tarea.updatedAt
        };

        res.json({
            success: true,
            message: 'Tarea actualizada exitosamente',
            data: tareaFormateada
        });

    } catch (error) {
        console.error('Error al actualizar tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar tarea',
            error: error.message
        });
    }
};

/**
 * 5. Cambiar etapa de tarea (para drag & drop en Kanban)
 * PATCH /api/tareas/:id/etapa
 */
export const cambiarEtapa = async (req, res) => {
    try {
        const { id } = req.params;
        const { etapa } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tarea inválido'
            });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) {
            // Fallback: si no existe Tarea, ver si es una Cita
            const cita = await Citas.findById(id).populate('ingenieroAsignado', 'nombre correo telefono rol');
            if (cita) {
                // Permisos: ingeniero solo puede cambiar sus citas
                if (req.admin && (req.admin.rol === 'ingeniero' || req.admin.rol === 'arquitecto')) {
                    if (!cita.ingenieroAsignado || cita.ingenieroAsignado._id.toString() !== req.admin._id.toString()) {
                        return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar esta cita' });
                    }
                }

                const previo = cita.estado;
                if (estado === 'completada') {
                    cita.estado = 'completada';
                    cita.fechaTermino = new Date();
                } else if (estado === 'pendiente') {
                    // map pendiente -> programada (no sobreescribir completada)
                    if (cita.estado !== 'completada') cita.estado = 'programada';
                } else {
                    // intentar mapear estados directos
                    cita.estado = estado;
                }

                // Push historial
                try {
                    cita.historialEstados = cita.historialEstados || [];
                    cita.historialEstados.push({ from: previo, to: cita.estado, by: req.admin?._id || null, at: new Date(), nota: 'Cambio desde /api/tareas/:id/estado' });
                } catch (e) {
                    console.error('Error push historial en cambiarEstado (cita):', e);
                }

                await cita.save();

                const tareaFormateada = {
                    _id: cita._id,
                    titulo: `Cita: ${cita.nombreCliente} - ${cita.fechaAgendada?.toISOString?.() || ''}`,
                    etapa: 'citas',
                    estado: cita.estado === 'completada' ? 'completada' : 'pendiente',
                    asignadoA: cita.ingenieroAsignado ? [cita.ingenieroAsignado._id] : [],
                    asignadoANombre: cita.ingenieroAsignado ? [cita.ingenieroAsignado.nombre] : [],
                    proyecto: null,
                    nombreProyecto: '',
                    notas: cita.informacionAdicional || cita.especificacionesInicio?.especificaciones || '',
                    archivos: [],
                    createdAt: cita.createdAt,
                    updatedAt: cita.updatedAt
                };

                return res.json({ success: true, message: 'Cita actualizada (vía cambiarEstado)', data: tareaFormateada });
            }

            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        // Verificar permisos
        if (!canModifyResource(tarea.asignadoA, req)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para actualizar esta tarea'
            });
        }

        tarea.etapa = etapa;
        await tarea.save();

        // Poblar referencias
        await tarea.populate('asignadoA', 'nombre correo');
        await tarea.populate('proyecto', 'nombre');

        // Formatear respuesta
        const tareaFormateada = {
            _id: tarea._id,
            titulo: tarea.titulo,
            etapa: tarea.etapa,
            estado: tarea.estado,
            asignadoA: tarea.asignadoA._id,
            asignadoANombre: tarea.asignadoA.nombre,
            proyecto: tarea.proyecto._id,
            nombreProyecto: tarea.proyecto.nombre,
            notas: tarea.notas,
            archivos: tarea.archivos,
            createdAt: tarea.createdAt,
            updatedAt: tarea.updatedAt
        };

        res.json({
            success: true,
            message: 'Etapa actualizada exitosamente',
            data: tareaFormateada
        });

    } catch (error) {
        console.error('Error al cambiar etapa:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar etapa',
            error: error.message
        });
    }
};

/**
 * 6. Cambiar estado de tarea (pendiente/completada)
 * PATCH /api/tareas/:id/estado
 */
export const cambiarEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        console.log('[cambiarEstado] request received for id=', id, 'estado=', estado);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tarea inválido'
            });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) {
            // Fallback: si no existe Tarea, ver si es una Cita
            const cita = await Citas.findById(id).populate('ingenieroAsignado', 'nombre correo telefono rol');
            if (cita) {
                // Permisos: ingeniero solo puede cambiar sus citas
                if (req.admin && (req.admin.rol === 'ingeniero' || req.admin.rol === 'arquitecto')) {
                    if (!cita.ingenieroAsignado || cita.ingenieroAsignado._id.toString() !== req.admin._id.toString()) {
                        return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar esta cita' });
                    }
                }

                const previo = cita.estado;
                if (estado === 'completada') {
                    cita.estado = 'completada';
                    cita.fechaTermino = new Date();
                } else if (estado === 'pendiente') {
                    if (cita.estado !== 'completada') cita.estado = 'programada';
                } else {
                    cita.estado = estado;
                }

                // Push historial
                try {
                    cita.historialEstados = cita.historialEstados || [];
                    cita.historialEstados.push({ from: previo, to: cita.estado, by: req.admin?._id || null, at: new Date(), nota: 'Cambio desde /api/tareas/:id/estado' });
                } catch (e) {
                    console.error('Error push historial en cambiarEstado (cita):', e);
                }

                await cita.save();

                const tareaFormateada = {
                    _id: cita._id,
                    titulo: `Cita: ${cita.nombreCliente} - ${cita.fechaAgendada?.toISOString?.() || ''}`,
                    etapa: 'citas',
                    estado: cita.estado === 'completada' ? 'completada' : 'pendiente',
                    asignadoA: cita.ingenieroAsignado ? [cita.ingenieroAsignado._id] : [],
                    asignadoANombre: cita.ingenieroAsignado ? [cita.ingenieroAsignado.nombre] : [],
                    proyecto: null,
                    nombreProyecto: '',
                    notas: cita.informacionAdicional || cita.especificacionesInicio?.especificaciones || '',
                    archivos: [],
                    createdAt: cita.createdAt,
                    updatedAt: cita.updatedAt
                };

                return res.json({ success: true, message: 'Cita actualizada (vía cambiarEstado)', data: tareaFormateada });
            }

            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        // Verificar permisos
        if (!canModifyResource(tarea.asignadoA, req)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para actualizar esta tarea'
            });
        }

        tarea.estado = estado;
        await tarea.save();

        // Poblar referencias
        await tarea.populate('asignadoA', 'nombre correo');
        await tarea.populate('proyecto', 'nombre');

        // Formatear respuesta
        const tareaFormateada = {
            _id: tarea._id,
            titulo: tarea.titulo,
            etapa: tarea.etapa,
            estado: tarea.estado,
            asignadoA: tarea.asignadoA._id,
            asignadoANombre: tarea.asignadoA.nombre,
            proyecto: tarea.proyecto._id,
            nombreProyecto: tarea.proyecto.nombre,
            notas: tarea.notas,
            archivos: tarea.archivos,
            createdAt: tarea.createdAt,
            updatedAt: tarea.updatedAt
        };

        res.json({
            success: true,
            message: 'Estado actualizado exitosamente',
            data: tareaFormateada
        });

    } catch (error) {
        console.error('Error al cambiar estado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado',
            error: error.message
        });
    }
};

/**
 * 7. Agregar archivos a una tarea
 * POST /api/tareas/:id/archivos
 */
export const agregarArchivos = async (req, res) => {
    try {
        const { id } = req.params;
        let { archivos } = req.body || {};

        // Si vienen archivos por multipart/form-data, multer habrá poblado req.files
        if (req.files && req.files.length > 0) {
            archivos = req.files.map(f => ({ nombre: f.originalname, tipo: 'otro', url: `/uploads/tasks/${f.filename}` }));
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tarea inválido'
            });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) {
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        // Verificar permisos
        if (!canModifyResource(tarea.asignadoA, req)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para agregar archivos a esta tarea'
            });
        }

        // Agregar los archivos (soporta array desde JSON o desde multipart)
        if (Array.isArray(archivos) && archivos.length > 0) {
            archivos.forEach(archivo => {
                tarea.archivos.push({
                    id: archivo.id || String(Date.now()),
                    nombre: archivo.nombre,
                    tipo: archivo.tipo || 'otro',
                    url: archivo.url || archivo.path || '',
                });
            });
        }

        await tarea.save();

        // Poblar referencias
        await tarea.populate('asignadoA', 'nombre correo');
        await tarea.populate('proyecto', 'nombre');

        // Formatear respuesta
        const tareaFormateada = {
            _id: tarea._id,
            titulo: tarea.titulo,
            etapa: tarea.etapa,
            estado: tarea.estado,
            asignadoA: tarea.asignadoA._id,
            asignadoANombre: tarea.asignadoA.nombre,
            proyecto: tarea.proyecto._id,
            nombreProyecto: tarea.proyecto.nombre,
            notas: tarea.notas,
            archivos: tarea.archivos,
            createdAt: tarea.createdAt,
            updatedAt: tarea.updatedAt
        };

        res.json({
            success: true,
            message: 'Archivos agregados exitosamente',
            data: tareaFormateada
        });

    } catch (error) {
        console.error('Error al agregar archivos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar archivos',
            error: error.message
        });
    }
};

/**
 * 8. Eliminar tarea
 * DELETE /api/tareas/:id
 */
export const eliminarTarea = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tarea inválido'
            });
        }

        const tarea = await Tarea.findById(id);
        if (!tarea) {
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        // Solo admin y arquitecto pueden eliminar tareas
        const userRole = req.admin?.rol || null;
        if (userRole !== 'admin' && userRole !== 'arquitecto') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para eliminar tareas'
            });
        }

        await Tarea.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Tarea eliminada exitosamente',
            data: null
        });

    } catch (error) {
        console.error('Error al eliminar tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar tarea',
            error: error.message
        });
    }
};

// Actualizar solo notas (ruta conveniente)
export const actualizarNotas = async (req, res) => {
    try {
        const { id } = req.params;
        const { notas } = req.body;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'ID de tarea inválido' });
        }
        const tarea = await Tarea.findById(id);
        if (!tarea) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
        if (!canModifyResource(tarea.asignadoA, req)) return res.status(403).json({ success: false, message: 'No tienes permiso' });
        tarea.notas = notas || '';
        await tarea.save();
        res.json({ success: true, data: tarea });
    } catch (error) {
        console.error('Error actualizarNotas:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
