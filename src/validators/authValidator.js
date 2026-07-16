const validarLogin = (req, res, next) => {
    const { correo, password } = req.body;
    const errores = [];

    if (!correo) {
        errores.push('El correo es obligatorio');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        errores.push('El correo no es válido');
    }

    if (!password) {
        errores.push('La contraseña es obligatoria');
    }

    if (errores.length > 0) {
        return res.status(400).json({ 
            error: 'Errores de validación',
            detalles: errores 
        });
    }

    next();
};

const validarRegistro = (req, res, next) => {
    const { nombres, apellidos, correo, password, id_rol } = req.body;
    const errores = [];

    if (!nombres || nombres.trim().length < 2) {
        errores.push('Los nombres son obligatorios y deben tener al menos 2 caracteres');
    }

    if (!apellidos || apellidos.trim().length < 2) {
        errores.push('Los apellidos son obligatorios y deben tener al menos 2 caracteres');
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

const validarCambioPassword = (req, res, next) => {
    const { password_actual, password_nueva } = req.body;
    const errores = [];

    if (!password_actual) {
        errores.push('La contraseña actual es obligatoria');
    }

    if (!password_nueva) {
        errores.push('La nueva contraseña es obligatoria');
    } else if (password_nueva.length < 6) {
        errores.push('La nueva contraseña debe tener al menos 6 caracteres');
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
    validarLogin, 
    validarRegistro,
    validarCambioPassword
};