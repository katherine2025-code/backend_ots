const express = require('express');
const router = express.Router();
const dashboardController = require('../controller/dashboardController');
const { autenticar } = require('../middleware/authMiddleware');

router.get('/kpis', autenticar, dashboardController.obtenerKPIs);
router.get('/ocupacion-hotel', autenticar, dashboardController.obtenerOcupacionPorHotel);
router.get('/tendencia', autenticar, dashboardController.obtenerTendencia);
router.get('/ocupacion-temporada', autenticar, dashboardController.obtenerOcupacionPorTemporada);
router.get('/ocupacion-parroquia', autenticar, dashboardController.obtenerOcupacionPorParroquia);
router.get('/predicho-vs-real', autenticar, dashboardController.obtenerPredichoVsReal);

module.exports = router;