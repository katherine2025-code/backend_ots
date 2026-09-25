const express = require('express');
const router = express.Router();
const prediccionController = require('../controller/prediccionController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Todas las rutas requieren autenticación
router.use(autenticar);

// Rutas principales
router.get('/', prediccionController.obtenerTodas);
router.get('/metricas', prediccionController.obtenerMetricas);
router.get('/:id', prediccionController.obtenerPorId);
router.post('/', prediccionController.crear);
// Generar una predicción (simulador / proyección por rango): Super Administrador e
// Investigador. El Administrador solo ve y valida/descarta resultados ya generados.
router.post('/predict', verificarRol([0, 2]), prediccionController.predecir);
router.post('/predecir-rango', verificarRol([0, 2]), prediccionController.predecirRango);
// Entrenar el modelo es una operación pesada y de administración: solo Super Administrador
router.post('/entrenar', verificarRol([0]), prediccionController.entrenarModelo);
router.put('/:id/validar', prediccionController.validar);
router.put('/:id/descartar', prediccionController.descartar);

module.exports = router;