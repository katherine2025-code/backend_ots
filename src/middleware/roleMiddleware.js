const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                error: 'Usuario no autenticado'
            });
        }

        console.log('[RoleMiddleware] Usuario:', req.usuario.correo);
        console.log('[RoleMiddleware] id_rol:', req.usuario.id_rol);
        console.log('[RoleMiddleware] Roles permitidos:', rolesPermitidos);

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
                'analista': 3
            };
            return userRol === mapeo[rol.toLowerCase()];
        });

        if (tienePermiso) {
            console.log('[RoleMiddleware]  Acceso permitido');
            return next();
        }

        console.log('[RoleMiddleware]  Acceso denegado');
        return res.status(403).json({
            error: 'No tiene permisos para esta acción'
        });
    };
};

module.exports = { verificarRol };