const express = require('express');
const router = express.Router();
const prediccionController = require('../controller/prediccionController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Todas las rutas requieren autenticación
router.use(autenticar);

// Rutas principales. El listado y el detalle los consultan los tres roles que
// analizan resultados (Super Admin, Administrador e Investigador) en modo lectura.
router.get('/', verificarRol([0, 1, 2]), prediccionController.obtenerTodas);
router.get('/metricas', verificarRol([0, 1, 2]), prediccionController.obtenerMetricas);
// Proxy al microservicio ML (solo lectura): métricas del modelo entrenado y validación histórica.
// Las usan las páginas Predicciones (Super Admin, Admin, Investigador) y ETL (Super Admin), así que
// quedan para todos los roles menos Encuestador. Van antes de '/:id' para que no las capture.
router.get('/ml/metricas', verificarRol([0, 1, 2]), prediccionController.obtenerMetricasML);
router.get('/ml/historicas', verificarRol([0, 1, 2]), prediccionController.obtenerPrediccionesHistoricas);
router.get('/:id', verificarRol([0, 1, 2]), prediccionController.obtenerPorId);
router.post('/', verificarRol([0]), prediccionController.crear);
// Generar una predicción (simulador / proyección por rango): Super Administrador e
// Investigador. El Administrador solo ve los resultados ya generados.
router.post('/predict', verificarRol([0, 2]), prediccionController.predecir);
router.post('/predecir-rango', verificarRol([0, 2]), prediccionController.predecirRango);
// Entrenar el modelo es una operación pesada y de administración: solo Super Administrador
router.post('/entrenar', verificarRol([0]), prediccionController.entrenarModelo);
// Validar/descartar un resultado reservado al Super Administrador; los demás roles solo leen.
router.put('/:id/validar', verificarRol([0]), prediccionController.validar);
router.put('/:id/descartar', verificarRol([0]), prediccionController.descartar);

module.exports = router;