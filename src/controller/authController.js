const authService = require('../services/authService');

const login = async (req, res) => {
    try {
        const { correo, password } = req.body;
        const resultado = await authService.login(correo, password);
        
        await authService.registrarBitacora(
            resultado.usuario.id, 
            'LOGIN', 
            'auth', 
            req.ip
        );

        res.json({
            mensaje: 'Login exitoso',
            ...resultado
        });

    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

const registro = async (req, res) => {
        console.log(' [REGISTRO] Inicio del proceso de registro');

        try {
            const { nombres, apellidos, correo, password, id_rol } = req.body;
            
            console.log(' [REGISTRO] Datos extraídos:', { nombres, apellidos, correo, id_rol, passwordLength: password?.length });

            // Validación de campos obligatorios
            if (!nombres || !apellidos || !correo || !password) {
                console.log('[REGISTRO] ERROR: Campos obligatorios faltantes');
                return res.status(400).json({ 
                    error: 'Todos los campos son obligatorios' 
                });
            }

            // Validación de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(correo)) {
                console.log('[REGISTRO] ERROR: Email no válido:', correo);
                return res.status(400).json({ 
                    error: 'El correo no es válido' 
                });
            }
            console.log('[REGISTRO] Email válido');

            // Validación de contraseña
            if (password.length < 6) {
                console.log('[REGISTRO] ERROR: Contraseña muy corta');
                return res.status(400).json({ 
                    error: 'La contraseña debe tener al menos 6 caracteres' 
                });
            }
            console.log('[REGISTRO] Contraseña válida');

            console.log('[REGISTRO] Llamando a authService.registrar...');
            console.log('[REGISTRO] authService disponible:', typeof authService.registrar);
            
            const resultado = await authService.registrar({
                nombres,
                apellidos,
                correo,
                password,
                id_rol: id_rol || 2
            });

            console.log(' [REGISTRO] Usuario creado en BD:', resultado);

            console.log('[REGISTRO] Llamando a registrarBitacora...');
            console.log('[REGISTRO] registrarBitacora disponible:', typeof authService.registrarBitacora);
            console.log(' [REGISTRO] ID usuario:', resultado.usuario.id);
            console.log(' [REGISTRO] IP:', req.ip);

            await authService.registrarBitacora(
                resultado.usuario.id,
                'REGISTRO',
                'auth',
                req.ip
            );

            console.log('[REGISTRO] Bitácora registrada');

            res.status(201).json({
                mensaje: 'Usuario registrado exitosamente',
                usuario: resultado.usuario
            });

            console.log('[REGISTRO] Respuesta enviada al cliente');

        } catch (error) {
            console.log(' [REGISTRO] ERROR CAPTURADO:', error.message);
            console.log(' [REGISTRO] Stack trace:', error.stack);
            
            if (error.message.includes('ya existe')) {
                console.log('[REGISTRO] El correo ya está registrado');
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: error.message });
        }
    };
const perfil = async (req, res) => {
    res.json({
        usuario: req.usuario
    });
};

const cambiarPassword = async (req, res) => {
    try {
        const { password_actual, password_nueva } = req.body;
        const userId = req.usuario.id_usuario;

        if (!password_actual || !password_nueva) {
            return res.status(400).json({ 
                error: 'Ambas contraseñas son requeridas' 
            });
        }

        if (password_nueva.length < 6) {
            return res.status(400).json({ 
                error: 'La nueva contraseña debe tener al menos 6 caracteres' 
            });
        }

        const resultado = await authService.cambiarPassword(
            userId, 
            password_actual, 
            password_nueva
        );

        await authService.registrarBitacora(
            userId,
            'CAMBIO_PASSWORD',
            'auth',
            req.ip
        );

        res.json({
            mensaje: 'Contraseña actualizada exitosamente',
            ...resultado
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// ==========================================
// OLVIDÉ MI CONTRASEÑA (solicita el enlace)
// ==========================================
const olvidePassword = async (req, res) => {
    try {
        const { correo } = req.body;
        if (!correo) {
            return res.status(400).json({ error: 'El correo es requerido' });
        }

        const { estado, usuarioId } = await authService.solicitarReset(correo);

        if (estado === 'no_existe') {
            return res.status(404).json({ error: 'No existe una cuenta registrada con ese correo.' });
        }
        if (estado === 'inactivo') {
            return res.status(403).json({ error: 'La cuenta está desactivada. Contacta al administrador.' });
        }

        // estado === 'enviado': se mandó el correo. Queda registrado en bitácora.
        await authService.registrarBitacora(usuarioId, 'SOLICITUD_RESET', 'auth', req.ip);

        res.json({
            mensaje: 'Te enviamos un enlace a tu correo para restablecer tu contraseña. Es válido por 1 hora.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// RESETEAR CONTRASEÑA (con el token del correo)
// ==========================================
const resetearPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const { usuarioId } = await authService.resetearPassword(token, password);

        await authService.registrarBitacora(usuarioId, 'RESET_PASSWORD', 'auth', req.ip);

        res.json({ mensaje: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = { login, registro, perfil, cambiarPassword, olvidePassword, resetearPassword };