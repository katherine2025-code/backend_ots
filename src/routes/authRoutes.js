const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const { autenticar } = require('../middleware/authMiddleware');
const { validarLogin, validarRegistro, validarCambioPassword } = require('../validators/authValidator');
const { limitarLogin } = require('../middleware/rateLimitMiddleware');

router.post('/login', limitarLogin, validarLogin, authController.login);
router.post('/registro', validarRegistro, authController.registro);
// Recuperación de contraseña (públicas, sin token): solicitar enlace y luego fijar la nueva clave.
router.post('/olvide-password', authController.olvidePassword);
router.post('/reset-password', authController.resetearPassword);
router.get('/perfil', autenticar, authController.perfil);
router.put('/cambiar-password', autenticar, validarCambioPassword, authController.cambiarPassword);

router.get('/', (req, res) => {
    res.json({
        message: 'Auth Routes',
        routes: {
            registro: 'POST /api/auth/registro',
            login: 'POST /api/auth/login',
            perfil: 'GET /api/auth/perfil (requiere token)',
            cambiarPassword: 'PUT /api/auth/cambiar-password (requiere token)'
        }
    });
});

module.exports = router;