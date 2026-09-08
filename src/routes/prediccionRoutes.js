const express = require('express');
const router = express.Router();
const prediccionController = require('../controller/prediccionController');
const { autenticar } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(autenticar);

// Rutas principales
router.get('/', prediccionController.obtenerTodas);
router.get('/metricas', prediccionController.obtenerMetricas);
router.get('/:id', prediccionController.obtenerPorId);
router.post('/', prediccionController.crear);
router.post('/predict', prediccionController.predecir);
router.post('/entrenar', prediccionController.entrenarModelo);
router.put('/:id/validar', prediccionController.validar);
router.put('/:id/descartar', prediccionController.descartar);

module.exports = router;