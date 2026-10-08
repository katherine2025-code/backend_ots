const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const Bitacora = require('../models/Bitacora');

const obtenerTodos = async () => {
    return await Usuario.findAll({
        attributes: { exclude: ['password_hash', 'reset_token', 'reset_expira'] }
    });
};

// Cuenta los Super Administradores (id_rol 0) que están activos (estado 1).
// Sirve para impedir que el sistema quede sin ningún super_admin con control total.
const contarSuperAdminsActivos = async () => {
    return await Usuario.count({ where: { id_rol: 0, estado: 1 } });
};

const obtenerPorId = async (id) => {
    const usuario = await Usuario.findByPk(id, {
        attributes: { exclude: ['password_hash', 'reset_token', 'reset_expira'] }
    });
    if (!usuario) {
        throw new Error('Usuario no encontrado');
    }
    return usuario;
};

const crear = async (data) => {
    const existe = await Usuario.findOne({ where: { correo: data.correo } });
    if (existe) {
        throw new Error('El correo ya está registrado');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(data.password, salt);

    const usuario = await Usuario.create({
        ...data,
        password_hash
    });

    return { 
        id: usuario.id_usuario, 
        mensaje: 'Usuario creado exitosamente' 
    };
};

const actualizar = async (id, data) => {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
        throw new Error('Usuario no encontrado');
    }

    if (data.password) {
        const salt = await bcrypt.genSalt(10);
        data.password_hash = await bcrypt.hash(data.password, salt);
        delete data.password;
    }

    await usuario.update(data);
    return { mensaje: 'Usuario actualizado exitosamente' };
};

const eliminar = async (id) => {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
        throw new Error('Usuario no encontrado');
    }

    await usuario.destroy();
    return { mensaje: 'Usuario eliminado exitosamente' };
};

const cambiarPassword = async (id, passwordActual, passwordNueva) => {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
        throw new Error('Usuario no encontrado');
    }

    const esValida = await bcrypt.compare(passwordActual, usuario.password_hash);
    if (!esValida) {
        throw new Error('La contraseña actual es incorrecta');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(passwordNueva, salt);
    await usuario.update({ password_hash });

    return { mensaje: 'Contraseña actualizada exitosamente' };
};

const obtenerBitacora = async (idUsuario) => {
    return await Bitacora.findAll({
        where: { id_usuario: idUsuario },
        order: [['fecha', 'DESC']]
    });
};

// Vista de sistema completo, exclusiva de Super Administrador: acciones de
// TODOS los usuarios, no solo las de uno (ver obtenerBitacora).
const obtenerBitacoraCompleta = async (limite = 200) => {
    return await Bitacora.findAll({
        include: [{
            model: Usuario,
            attributes: ['id_usuario', 'nombres', 'apellidos', 'correo', 'id_rol']
        }],
        order: [['fecha', 'DESC']],
        limit: limite
    });
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
    contarSuperAdminsActivos
};