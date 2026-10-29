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
    try {
        const { nombres, apellidos, correo, password, id_rol } = req.body;

        const resultado = await authService.registrar({
            nombres,
            apellidos,
            correo,
            password,
            id_rol: id_rol || 2
        });

        await authService.registrarBitacora(
            resultado.usuario.id,
            'REGISTRO',
            'auth',
            req.ip
        );

        res.status(201).json({
            mensaje: 'Usuario registrado exitosamente',
            usuario: resultado.usuario
        });

    } catch (error) {
        if (error.message.includes('ya existe')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error interno al registrar el usuario' });
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

        // Siempre 200 para no revelar si el correo existe o la cuenta está activa
        if (estado === 'enviado') {
            await authService.registrarBitacora(usuarioId, 'SOLICITUD_RESET', 'auth', req.ip);
        }

        res.json({
            mensaje: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
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