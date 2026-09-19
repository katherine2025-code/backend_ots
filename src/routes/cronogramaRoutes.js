const express = require('express');
const router = express.Router();
const controller = require('../controller/cronogramaController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Encuestador: su propio cronograma, solo lectura
router.get('/mi', autenticar, verificarRol([3]), controller.miCronograma);

// Visualización (solo lectura): Super Administrador, Administrador e Investigador
router.get('/resumen', autenticar, verificarRol([0, 1, 2]), controller.resumen);
router.get('/jornadas', autenticar, verificarRol([0, 1, 2]), controller.jornadas);
router.get('/jornadas/:id/avance', autenticar, verificarRol([0, 1, 2]), controller.avance);

// Control (crear, editar metas, eliminar): solo Super Administrador y Administrador
router.get('/encuestadores', autenticar, verificarRol([0, 1]), controller.encuestadores);
router.post('/jornadas', autenticar, verificarRol([0, 1]), controller.crearJornada);
router.put('/jornadas/:id/meta', autenticar, verificarRol([0, 1]), controller.actualizarMeta);
router.post('/jornadas/:id/encuestadores', autenticar, verificarRol([0, 1]), controller.agregarEncuestador);
router.delete('/jornadas/:id', autenticar, verificarRol([0, 1]), controller.eliminarJornada);

module.exports = router;
