const validarCrearUsuario = (req, res, next) => {
    const { nombres, apellidos, correo, password, id_rol } = req.body;
    const errores = [];

    if (!nombres || nombres.trim().length < 2) {
        errores.push('Los nombres son obligatorios');
    }

    if (!apellidos || apellidos.trim().length < 2) {
        errores.push('Los apellidos son obligatorios');
    }

    if (!correo) {
        errores.push('El correo es obligatorio');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        errores.push('El correo no es válido');
    }

    if (!password) {
        errores.push('La contraseña es obligatoria');
    } else if (password.length < 6) {
        errores.push('La contraseña debe tener al menos 6 caracteres');
    }

    if (id_rol !== undefined && (!Number.isInteger(id_rol) || id_rol < 1)) {
        errores.push('El rol debe ser un número válido');
    }

    if (errores.length > 0) {
        return res.status(400).json({ 
            error: 'Errores de validación',
            detalles: errores 
        });
    }

    next();
};

const validarActualizarUsuario = (req, res, next) => {
    const { nombres, apellidos, correo, id_rol, estado } = req.body;
    const errores = [];

    if (nombres && nombres.trim().length < 2) {
        errores.push('Los nombres deben tener al menos 2 caracteres');
    }

    if (apellidos && apellidos.trim().length < 2) {
        errores.push('Los apellidos deben tener al menos 2 caracteres');
    }

    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        errores.push('El correo no es válido');
    }

    if (id_rol !== undefined && (!Number.isInteger(id_rol) || id_rol < 1)) {
        errores.push('El rol debe ser un número válido');
    }

    if (estado !== undefined && ![0, 1].includes(estado)) {
        errores.push('El estado debe ser 0 o 1');
    }

    if (errores.length > 0) {
        return res.status(400).json({ 
            error: 'Errores de validación',
            detalles: errores 
        });
    }

    next();
};

module.exports = { 
    validarCrearUsuario,
    validarActualizarUsuario
};