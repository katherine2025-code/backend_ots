const express = require('express');
const router = express.Router();
const prediccionController = require('../controller/prediccionController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Todas las rutas requieren autenticación
router.use(autenticar);

// Todas son proxy al microservicio ML. Las predicciones NO se guardan en la tabla `predicciones`
// (función retirada: el modelo predice la ocupación del destino, no la de un hotel); el CRUD de
// esa tabla (listar, detalle, crear, validar, descartar, métricas) se quitó por no tener uso real.

// Proxy al microservicio ML (solo lectura): métricas del modelo entrenado y validación histórica.
// Las usan las páginas Predicciones (Super Admin, Admin, Investigador) y ETL (Super Admin), así que
// quedan para todos los roles menos Encuestador.
router.get('/ml/metricas', verificarRol([0, 1, 2]), prediccionController.obtenerMetricasML);
router.get('/ml/historicas', verificarRol([0, 1, 2]), prediccionController.obtenerPrediccionesHistoricas);
// Generar una predicción (simulador / proyección por rango): Super Administrador e Investigador.
router.post('/predict', verificarRol([0, 2]), prediccionController.predecir);
router.post('/predecir-rango', verificarRol([0, 2]), prediccionController.predecirRango);
// Entrenar el modelo es una operación pesada y de administración: solo Super Administrador
router.post('/entrenar', verificarRol([0]), prediccionController.entrenarModelo);

module.exports = router;
