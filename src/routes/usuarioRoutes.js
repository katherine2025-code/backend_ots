const express = require('express');
const router = express.Router();
const usuarioController = require('../controller/usuarioController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');
const { validarCrearUsuario, validarActualizarUsuario } = require('../validators/usuarioValidator');

// Lectura y cambio de la propia contraseña: cualquier usuario autenticado
router.get('/', autenticar, usuarioController.obtenerTodos);
router.get('/perfil/mi-perfil', autenticar, usuarioController.obtenerPerfil);
router.get('/:id', autenticar, usuarioController.obtenerPorId);
router.get('/:id/bitacora', autenticar, usuarioController.obtenerBitacora);
router.put('/:id/cambiar-password', autenticar, usuarioController.cambiarPassword);

// Gestión de cuentas (crear, editar, eliminar): solo administrador
router.post('/', autenticar, verificarRol([1]), validarCrearUsuario, usuarioController.crear);
router.put('/:id', autenticar, verificarRol([1]), validarActualizarUsuario, usuarioController.actualizar);
router.delete('/:id', autenticar, verificarRol([1]), usuarioController.eliminar);

module.exports = router;