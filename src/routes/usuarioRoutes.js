const express = require('express');
const router = express.Router();
const usuarioController = require('../controller/usuarioController');
const { autenticar } = require('../middleware/authMiddleware');
const { validarCrearUsuario, validarActualizarUsuario } = require('../validators/usuarioValidator');

router.get('/', autenticar, usuarioController.obtenerTodos);
router.get('/perfil/mi-perfil', autenticar, usuarioController.obtenerPerfil);
router.get('/:id', autenticar, usuarioController.obtenerPorId);
router.get('/:id/bitacora', autenticar, usuarioController.obtenerBitacora);
router.post('/', autenticar, validarCrearUsuario, usuarioController.crear);
router.put('/:id', autenticar, validarActualizarUsuario, usuarioController.actualizar);
router.put('/:id/cambiar-password', autenticar, usuarioController.cambiarPassword);
router.delete('/:id', autenticar, usuarioController.eliminar);

module.exports = router;