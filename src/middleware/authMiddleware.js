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

module.exports = { autenticar };