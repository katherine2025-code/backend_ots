const express = require('express');
const router = express.Router();
const reporteController = require('../controller/reporteController');
const { autenticar } = require('../middleware/authMiddleware');

router.get('/', autenticar, reporteController.obtenerTodos);
// Antes de '/:id': si no, Express interpretaría 'estadisticas' como un id.
router.get('/estadisticas', autenticar, reporteController.obtenerEstadisticas);
router.get('/tabulacion', autenticar, reporteController.obtenerTabulacion);
router.get('/:id', autenticar, reporteController.obtenerPorId);
router.post('/', autenticar, reporteController.crear);
router.delete('/:id', autenticar, reporteController.eliminar);

module.exports = router;