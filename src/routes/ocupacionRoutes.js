const express = require('express');
const router = express.Router();
const ocupacionController = require('../controller/ocupacionController');
const { autenticar } = require('../middleware/authMiddleware');

router.get('/', autenticar, ocupacionController.obtenerTodas);
router.get('/feriados', autenticar, ocupacionController.obtenerFeriados);
router.get('/estadisticas', autenticar, ocupacionController.obtenerEstadisticas);
router.get('/hotel/:id', autenticar, ocupacionController.obtenerPorHotel);

module.exports = router;