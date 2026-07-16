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

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/hoteles', hotelRoutes);
router.use('/ocupacion', ocupacionRoutes);
router.use('/predicciones', prediccionRoutes);
router.use('/reportes', reporteRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/etl', etlRoutes);

module.exports = router;