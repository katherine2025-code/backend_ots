const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');
const Bitacora = require('../models/Bitacora');

const obtenerTodos = async () => {
    return await Usuario.findAll();
};

const obtenerPorId = async (id) => {
    const usuario = await Usuario.findById(id);
    if (!usuario) {
        throw new Error('Usuario no encontrado');
    }
    return usuario;
};

const crear = async (data) => {
    const existe = await Usuario.findByEmail(data.correo);
    if (existe) {
        throw new Error('El correo ya está registrado');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(data.password, salt);

    const id = await Usuario.create({
        ...data,
        password_hash
    });

    return { id, mensaje: 'Usuario creado exitosamente' };
};

const actualizar = async (id, data) => {
    const usuario = await Usuario.findById(id);
    if (!usuario) {
        throw new Error('Usuario no encontrado');
    }

    await Usuario.update(id, data);
    return { mensaje: 'Usuario actualizado exitosamente' };
};

const eliminar = async (id) => {
    const usuario = await Usuario.findById(id);
    if (!usuario) {
        throw new Error('Usuario no encontrado');
    }

    await Usuario.delete(id);
    return { mensaje: 'Usuario eliminado exitosamente' };
};

module.exports = { obtenerTodos, obtenerPorId, crear, actualizar, eliminar };