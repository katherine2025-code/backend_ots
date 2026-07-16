const usuarioService = require('../services/usuarioService');

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
        const resultado = await usuarioService.crear(req.body);
        res.status(201).json(resultado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const actualizar = async (req, res) => {
    try {
        const resultado = await usuarioService.actualizar(req.params.id, req.body);
        res.json(resultado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const eliminar = async (req, res) => {
    try {
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
    obtenerPerfil
};