const usuarioService = require('../services/usuarioService');

// id_rol 0 = Super Administrador, 1 = Administrador. Crear/editar/eliminar
// cuentas con uno de estos dos roles requiere ser Super Administrador -
// evita que un admin se clone o desplace a otros admins.
const ROLES_PROTEGIDOS = [0, 1];
const esSuperAdmin = (req) => req.usuario?.id_rol === 0;

const obtenerTodos = async (req, res) => {
    try {
        const usuarios = await usuarioService.obtenerTodos();
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerPorId = async (req, res) => {
    try {
        const usuario = await usuarioService.obtenerPorId(req.params.id);
        res.json(usuario);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

const crear = async (req, res) => {
    try {
        if (ROLES_PROTEGIDOS.includes(req.body.id_rol) && !esSuperAdmin(req)) {
            return res.status(403).json({
                error: 'Solo un Super Administrador puede crear cuentas de Administrador o Super Administrador.'
            });
        }
        const resultado = await usuarioService.crear(req.body);
        res.status(201).json(resultado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const actualizar = async (req, res) => {
    try {
        if (!esSuperAdmin(req)) {
            const actual = await usuarioService.obtenerPorId(req.params.id);
            const cambiaARolProtegido = req.body.id_rol !== undefined && ROLES_PROTEGIDOS.includes(req.body.id_rol);
            if (ROLES_PROTEGIDOS.includes(actual.id_rol) || cambiaARolProtegido) {
                return res.status(403).json({
                    error: 'Solo un Super Administrador puede editar cuentas de Administrador o Super Administrador.'
                });
            }
        }
        const resultado = await usuarioService.actualizar(req.params.id, req.body);
        res.json(resultado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const eliminar = async (req, res) => {
    try {
        if (!esSuperAdmin(req)) {
            const actual = await usuarioService.obtenerPorId(req.params.id);
            if (ROLES_PROTEGIDOS.includes(actual.id_rol)) {
                return res.status(403).json({
                    error: 'Solo un Super Administrador puede eliminar cuentas de Administrador o Super Administrador.'
                });
            }
        }
        const resultado = await usuarioService.eliminar(req.params.id);
        res.json(resultado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const cambiarPassword = async (req, res) => {
    try {
        const { password_actual, password_nueva } = req.body;
        const userId = req.params.id;

        if (!password_actual || !password_nueva) {
            return res.status(400).json({ 
                error: 'Ambas contraseñas son requeridas' 
            });
        }

        const resultado = await usuarioService.cambiarPassword(
            userId,
            password_actual,
            password_nueva
        );

        res.json(resultado);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const obtenerBitacora = async (req, res) => {
    try {
        const bitacora = await usuarioService.obtenerBitacora(req.params.id);
        res.json(bitacora);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Exclusivo de Super Administrador: bitácora de TODOS los usuarios, no solo uno.
const obtenerBitacoraCompleta = async (req, res) => {
    try {
        const limite = parseInt(req.query.limit) || 200;
        const bitacora = await usuarioService.obtenerBitacoraCompleta(limite);
        res.json(bitacora);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerPerfil = async (req, res) => {
    try {
        const usuario = await usuarioService.obtenerPorId(req.usuario.id_usuario);
        res.json(usuario);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

module.exports = {
    obtenerTodos,
    obtenerPorId,
    crear,
    actualizar,
    eliminar,
    cambiarPassword,
    obtenerBitacora,
    obtenerBitacoraCompleta,
    obtenerPerfil
};