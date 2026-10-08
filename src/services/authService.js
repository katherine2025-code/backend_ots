const crypto = require('crypto');
const { Op } = require('sequelize');
const Usuario = require('../models/Usuario');
const Bitacora = require('../models/Bitacora');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');
const mailService = require('./mailService');

// Primer origen de FRONTEND_URL (puede traer varios separados por coma). Se usa para armar el
// enlace del correo de recuperación. En desarrollo cae a localhost si no está configurado.
const urlDelFront = () => {
    const primero = String(process.env.FRONTEND_URL || '').split(',')[0].trim();
    return (primero || 'http://localhost:8100').replace(/\/+$/, '');
};

// El token viaja en claro al correo del usuario, pero en la BD se guarda solo su hash sha256.
// Así, aunque se filtrara la tabla, nadie puede reconstruir el enlace válido.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// ==========================================
// MÉTODO LOGIN
// ==========================================
const login = async (correo, password) => {
    console.log('\n========================================');
    console.log('[SERVICE] Iniciando login para:', correo);

    try {
        // Buscar usuario
        const usuario = await Usuario.findOne({ 
            where: { correo: correo }
        });

        if (!usuario) {
            console.log('[SERVICE] Usuario NO encontrado con correo:', correo);
            throw new Error('Credenciales incorrectas');
        }

        console.log('[SERVICE] Usuario encontrado:');
        console.log('   - ID:', usuario.id_usuario);
        console.log('   - Nombres:', usuario.nombres);
        console.log('   - Correo:', usuario.correo);
        console.log('   - Estado:', usuario.estado);
        console.log('   - ID Rol:', usuario.id_rol);

        // Verificar estado
        if (usuario.estado !== 1) {
            console.log('[SERVICE] Usuario inactivo');
            throw new Error('Usuario inactivo. Contacta al administrador.');
        }

        // Verificar contraseña
        console.log('[SERVICE] Verificando contraseña...');
        const esValida = await bcrypt.compare(password, usuario.password_hash);
        console.log('[SERVICE] Contraseña válida:', esValida);
        
        if (!esValida) {
            console.log('[SERVICE] Contraseña INCORRECTA');
            throw new Error('Credenciales incorrectas');
        }

        console.log('[SERVICE] Login exitoso, generando token...');

        const token = generateToken({
            id_usuario: usuario.id_usuario,
            correo: usuario.correo,
            id_rol: usuario.id_rol,
            nombres: usuario.nombres,
            apellidos: usuario.apellidos
        });

        console.log('[SERVICE] Token generado');
        console.log('========================================\n');

        return {
            token,
            usuario: {
                id: usuario.id_usuario,
                nombres: usuario.nombres,
                apellidos: usuario.apellidos,
                correo: usuario.correo,
                id_rol: usuario.id_rol
            }
        };

    } catch (error) {
        console.error('[SERVICE] Error en login:', error.message);
        console.log('========================================\n');
        throw error;
    }
};

// ==========================================
// MÉTODO REGISTRAR
// ==========================================
const registrar = async (datos) => {
    console.log('[SERVICE] Iniciando registro en BD...');

    const { nombres, apellidos, correo, password, id_rol } = datos;

    const usuarioExistente = await Usuario.findOne({ 
        where: { correo } 
    });
    
    if (usuarioExistente) {
        throw new Error('El correo ya está registrado');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // El auto-registro público solo puede crear Investigador (2) o Encuestador (3).
    // El rol Administrador (1) nunca se asigna por este endpoint - solo otro
    // administrador puede crearlo, desde /api/usuarios.
    const ROLES_AUTOREGISTRO = [2, 3];
    const idRolFinal = ROLES_AUTOREGISTRO.includes(id_rol) ? id_rol : 2;

    const usuario = await Usuario.create({
        nombres,
        apellidos,
        correo,
        password_hash: passwordHash,
        id_rol: idRolFinal,
        estado: 1
    });

    console.log('[SERVICE] Usuario creado con ID:', usuario.id_usuario);

    return {
        usuario: {
            id: usuario.id_usuario,
            nombres: usuario.nombres,
            apellidos: usuario.apellidos,
            correo: usuario.correo,
            id_rol: usuario.id_rol
        }
    };
};

// ==========================================
// MÉTODO REGISTRAR BITÁCORA
// ==========================================
const registrarBitacora = async (idUsuario, accion, modulo, ip) => {
    try {
        await Bitacora.create({
            id_usuario: idUsuario,
            accion,
            modulo,
            descripcion: `Acción: ${accion} desde IP: ${ip}`,
            fecha: new Date()
        });
    } catch (error) {
        console.log('[SERVICE] No se pudo registrar la bitácora:', error.message);
    }
};

// ==========================================
// MÉTODO SOLICITAR RESET (¿olvidaste tu contraseña?)
// ==========================================
// Devuelve un 'estado' explícito para que el usuario reciba feedback real:
//   'no_existe' -> ese correo no está registrado
//   'inactivo'  -> la cuenta existe pero está desactivada
//   'enviado'   -> se generó el token y se envió el correo con el enlace
const solicitarReset = async (correo) => {
    const usuario = await Usuario.findOne({ where: { correo } });

    if (!usuario) {
        return { estado: 'no_existe', usuarioId: null };
    }
    if (usuario.estado !== 1) {
        return { estado: 'inactivo', usuarioId: usuario.id_usuario };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await usuario.update({
        reset_token: hashToken(token),
        reset_expira: expira
    });

    const enlace = `${urlDelFront()}/reset-password?token=${token}`;
    await mailService.enviarCorreoReset(usuario.correo, usuario.nombres, enlace);

    return { estado: 'enviado', usuarioId: usuario.id_usuario };
};

// ==========================================
// MÉTODO RESETEAR PASSWORD (con el token del correo)
// ==========================================
const resetearPassword = async (token, passwordNueva) => {
    if (!token || !passwordNueva) {
        throw new Error('Token y nueva contraseña son requeridos');
    }
    if (passwordNueva.length < 6) {
        throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
    }

    const usuario = await Usuario.findOne({
        where: {
            reset_token: hashToken(token),
            reset_expira: { [Op.gt]: new Date() } // aún no expirado
        }
    });

    if (!usuario) {
        throw new Error('El enlace no es válido o ha expirado. Solicítalo de nuevo.');
    }

    const passwordHash = await bcrypt.hash(passwordNueva, 10);
    // Un solo uso: se limpia el token para que el mismo enlace no sirva dos veces.
    await usuario.update({
        password_hash: passwordHash,
        reset_token: null,
        reset_expira: null
    });

    return { usuarioId: usuario.id_usuario };
};

// ==========================================
// MÉTODO CAMBIAR PASSWORD
// ==========================================
const cambiarPassword = async (userId, passwordActual, passwordNueva) => {
    const usuario = await Usuario.findByPk(userId);
    
    if (!usuario) {
        throw new Error('Usuario no encontrado');
    }

    const esValida = await bcrypt.compare(passwordActual, usuario.password_hash);
    if (!esValida) {
        throw new Error('La contraseña actual es incorrecta');
    }

    const passwordHash = await bcrypt.hash(passwordNueva, 10);
    await usuario.update({ password_hash: passwordHash });

    return { mensaje: 'Contraseña actualizada' };
};

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
    login,
    registrar,
    registrarBitacora,
    cambiarPassword,
    solicitarReset,
    resetearPassword
};