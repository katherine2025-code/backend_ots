const express = require('express');
const router = express.Router();
const encuestaController = require('../controller/encuestaController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Lectura: cualquier usuario autenticado (el encuestador necesita el cuestionario para responder)
router.get('/', autenticar, encuestaController.obtenerTodas);
// Debe ir ANTES de '/:id' para no ser interceptada por esa ruta
router.get('/tipo/:tipo', autenticar, encuestaController.obtenerPorTipo);
router.get('/:id', autenticar, encuestaController.obtenerPorId);

// Escritura (preguntas, respuestas, estado): solo Super Administrador y Administrador
router.put('/:id', autenticar, verificarRol([0, 1]), encuestaController.actualizar);
router.patch('/:id/estado', autenticar, verificarRol([0, 1]), encuestaController.cambiarEstado);

module.exports = router;
