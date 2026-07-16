const { verifyToken } = require('../config/jwt');

const autenticar = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Token de autenticación requerido'
        });
    }

    try {
        const decoded = verifyToken(token);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            error: 'Token inválido o expirado'
        });
    }
};

const verificarRol = (roles) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                error: 'Usuario no autenticado'
            });
        }

        // Aquí puedes ajustar según cómo tengas los roles
        // Si id_rol es un número, compara con números
        // Si es un string, compara con strings
        if (!roles.includes(req.usuario.id_rol)) {
            return res.status(403).json({
                error: 'No tiene permisos para realizar esta acción'
            });
        }

        next();
    };
};

module.exports = { autenticar, verificarRol };