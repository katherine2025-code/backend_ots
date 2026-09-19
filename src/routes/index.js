const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const hotelRoutes = require('./hotelRoutes');
const ocupacionRoutes = require('./ocupacionRoutes');
const prediccionRoutes = require('./prediccionRoutes');
const reporteRoutes = require('./reporteRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const etlRoutes = require('./etlRoutes');
const encuestaRoutes = require('./encuestaRoutes');
const respuestaRoutes = require('./respuestaRoutes');
const cronogramaRoutes = require('./cronogramaRoutes');
const lugaresRoutes = require('./lugaresRoutes');

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/hoteles', hotelRoutes);
router.use('/ocupacion', ocupacionRoutes);
router.use('/predicciones', prediccionRoutes);
router.use('/reportes', reporteRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/etl', etlRoutes);
router.use('/encuestas', encuestaRoutes);
router.use('/respuestas', respuestaRoutes);
router.use('/cronograma', cronogramaRoutes);
router.use('/lugares', lugaresRoutes);

module.exports = router;