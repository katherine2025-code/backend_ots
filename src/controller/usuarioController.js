const usuarioService = require('../services/usuarioService');
const bitacoraService = require('../services/bitacoraService');

// id_rol 0 = Super Administrador, 1 = Administrador. Crear/editar/eliminar
// cuentas con uno de estos dos roles requiere ser Super Administrador -
// evita que un admin se clone o desplace a otros admins.
const ROLES_PROTEGIDOS = [0, 1];
const esSuperAdmin = (req) => req.usuario?.id_rol === 0;
const esAdministrativo = (req) => [0, 1].includes(req.usuario?.id_rol);

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
        // Un usuario no administrativo solo puede consultar su propio perfil;
        // super_admin/admin pueden consultar cualquier cuenta.
        const id = parseInt(req.params.id, 10);
        if (!esAdministrativo(req) && req.usuario.id_usuario !== id) {
            return res.status(403).json({
                error: 'Solo puede consultar su propio perfil.'
            });
        }
        const usuario = await usuarioService.obtenerPorId(id);
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

        await bitacoraService.registrar({
            id_usuario: req.usuario.id_usuario,
            accion: 'CREAR_USUARIO',
            modulo: 'usuarios',
            descripcion: `Creó la cuenta ${req.body.correo} con rol ${req.body.id_rol} (nuevo id ${resultado.id})`
        });

        res.status(201).json(resultado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const actualizar = async (req, res) => {
    try {
        const actual = await usuarioService.obtenerPorId(req.params.id);

        if (!esSuperAdmin(req)) {
            const cambiaARolProtegido = req.body.id_rol !== undefined && ROLES_PROTEGIDOS.includes(req.body.id_rol);
            if (ROLES_PROTEGIDOS.includes(actual.id_rol) || cambiaARolProtegido) {
                return res.status(403).json({
                    error: 'Solo un Super Administrador puede editar cuentas de Administrador o Super Administrador.'
                });
            }
        }
        // Protección del último Super Administrador: no permitir degradarlo (cambiar
        // su rol) ni desactivarlo si es el único con control total que queda activo.
        if (actual.id_rol === 0 && actual.estado === 1) {
            const quitaSuperAdmin =
                (req.body.id_rol !== undefined && Number(req.body.id_rol) !== 0) ||
                (req.body.estado !== undefined && Number(req.body.estado) !== 1);
            if (quitaSuperAdmin && (await usuarioService.contarSuperAdminsActivos()) <= 1) {
                return res.status(409).json({
                    error: 'No se puede degradar ni desactivar al único Super Administrador activo del sistema.'
                });
            }
        }

        const resultado = await usuarioService.actualizar(req.params.id, req.body);

        let detalle = `Editó la cuenta id ${req.params.id} (${actual.correo})`;
        if (req.body.id_rol !== undefined && req.body.id_rol !== actual.id_rol) {
            detalle += `. Cambió rol ${actual.id_rol} → ${req.body.id_rol}`;
        }
        if (req.body.password) {
            detalle += '. Restableció la contraseña';
        }
        await bitacoraService.registrar({
            id_usuario: req.usuario.id_usuario,
            accion: 'ACTUALIZAR_USUARIO',
            modulo: 'usuarios',
            descripcion: detalle
        });

        res.json(resultado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const eliminar = async (req, res) => {
    try {
        const actual = await usuarioService.obtenerPorId(req.params.id);

        // Nadie elimina su propia cuenta desde la gestión de usuarios.
        if (req.usuario.id_usuario === parseInt(req.params.id, 10)) {
            return res.status(409).json({
                error: 'No puede eliminar su propia cuenta.'
            });
        }

        if (!esSuperAdmin(req) && ROLES_PROTEGIDOS.includes(actual.id_rol)) {
            return res.status(403).json({
                error: 'Solo un Super Administrador puede eliminar cuentas de Administrador o Super Administrador.'
            });
        }

        // Protección del último Super Administrador: no dejar el sistema sin control total.
        if (actual.id_rol === 0 && actual.estado === 1 &&
            (await usuarioService.contarSuperAdminsActivos()) <= 1) {
            return res.status(409).json({
                error: 'No se puede eliminar al único Super Administrador activo del sistema.'
            });
        }

        const resultado = await usuarioService.eliminar(req.params.id);

        await bitacoraService.registrar({
            id_usuario: req.usuario.id_usuario,
            accion: 'ELIMINAR_USUARIO',
            modulo: 'usuarios',
            descripcion: `Eliminó la cuenta id ${req.params.id} (${actual.correo}, rol ${actual.id_rol})`
        });

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