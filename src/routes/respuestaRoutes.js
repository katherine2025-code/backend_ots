const express = require('express');
const router = express.Router();
const respuestaController = require('../controller/respuestaController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Registrar una encuesta llenada en campo: solo Encuestador
router.post('/', autenticar, verificarRol([3]), respuestaController.registrar);

// Consulta y exportación de lo recolectado: solo Super Administrador y Administrador
router.get('/', autenticar, verificarRol([0, 1]), respuestaController.listar);
router.get('/exportar', autenticar, verificarRol([0, 1]), respuestaController.exportar);

module.exports = router;
