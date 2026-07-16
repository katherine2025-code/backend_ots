const express = require('express');
const router = express.Router();
const prediccionController = require('../controller/prediccionController');
const { autenticar } = require('../middleware/authMiddleware');

router.get('/', autenticar, prediccionController.obtenerTodas);
router.get('/metricas', autenticar, prediccionController.obtenerMetricas);
router.get('/:id', autenticar, prediccionController.obtenerPorId);
router.post('/', autenticar, prediccionController.crear);
router.put('/:id/validar', autenticar, prediccionController.validar);
router.put('/:id/descartar', autenticar, prediccionController.descartar);

module.exports = router;