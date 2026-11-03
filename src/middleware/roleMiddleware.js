const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                error: 'Usuario no autenticado'
            });
        }

        // Comparación flexible: acepta números o strings
        const userRol = req.usuario.id_rol;
        
        const tienePermiso = rolesPermitidos.some(rol => {
            // Si el rol permitido es número, comparar directamente
            if (typeof rol === 'number') {
                return userRol === rol;
            }
            // Si es string, mapear a números
            const mapeo = {
                'superadmin': 0,
                'admin': 1,
                'administrador': 1,
                'investigador': 2,
                'encuestador': 3
            };
            return userRol === mapeo[rol.toLowerCase()];
        });

        if (tienePermiso) {
            return next();
        }

        // Solo se registran los rechazos (son los que interesan para seguridad), con el ID
        // del usuario en vez de su correo.
        console.warn(`[Acceso denegado] usuario=${req.usuario.id_usuario} rol=${userRol} ${req.method} ${req.originalUrl.split('?')[0]}`);
        return res.status(403).json({
            error: 'No tiene permisos para esta acción'
        });
    };
};

module.exports = { verificarRol };