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
// Proxy al microservicio ML (solo lectura): métricas del modelo entrenado y validación histórica.
// Las usan las páginas Predicciones (Super Admin, Admin, Investigador) y ETL (Super Admin), así que
// quedan para todos los roles menos Encuestador. Van antes de '/:id' para que no las capture.
router.get('/ml/metricas', verificarRol([0, 1, 2]), prediccionController.obtenerMetricasML);
router.get('/ml/historicas', verificarRol([0, 1, 2]), prediccionController.obtenerPrediccionesHistoricas);
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