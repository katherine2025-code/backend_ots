const Usuario = require('../models/Usuario');
const Bitacora = require('../models/Bitacora');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');

// ==========================================
// MÉTODO LOGIN
// ==========================================
const login = async (correo, password) => {
    console.log('\n========================================');
    console.log('[SERVICE] Iniciando login para:', correo);
    console.log('[SERVICE] Contraseña recibida:', password);

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

    const usuario = await Usuario.create({
        nombres,
        apellidos,
        correo,
        password_hash: passwordHash,
        id_rol: id_rol || 2,
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
    cambiarPassword
};