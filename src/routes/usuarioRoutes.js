const express = require('express');
const router = express.Router();
const usuarioController = require('../controller/usuarioController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');
const { validarCrearUsuario, validarActualizarUsuario } = require('../validators/usuarioValidator');

// Listado completo de usuarios: solo Super Administrador o Administrador.
// Un investigador/encuestador no debe poder enumerar las cuentas del sistema.
router.get('/', autenticar, verificarRol([0, 1]), usuarioController.obtenerTodos);
router.get('/perfil/mi-perfil', autenticar, usuarioController.obtenerPerfil);
// Bitácora completa (todos los usuarios): exclusiva de Super Administrador.
// Debe ir ANTES de '/:id/bitacora' para no ser interceptada por esa ruta.
router.get('/bitacora/todas', autenticar, verificarRol([0]), usuarioController.obtenerBitacoraCompleta);
router.get('/:id', autenticar, usuarioController.obtenerPorId);
router.get('/:id/bitacora', autenticar, verificarRol([0, 1]), usuarioController.obtenerBitacora);
router.put('/:id/cambiar-password', autenticar, usuarioController.cambiarPassword);

// Gestión de cuentas (crear, editar, eliminar): Administrador o Super
// Administrador; el controller además exige Super Administrador cuando la
// cuenta afectada es de Administrador/Super Administrador.
router.post('/', autenticar, verificarRol([0, 1]), validarCrearUsuario, usuarioController.crear);
router.put('/:id', autenticar, verificarRol([0, 1]), validarActualizarUsuario, usuarioController.actualizar);
router.delete('/:id', autenticar, verificarRol([0, 1]), usuarioController.eliminar);

module.exports = router;