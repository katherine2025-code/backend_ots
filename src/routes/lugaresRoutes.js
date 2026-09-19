const express = require('express');
const router = express.Router();
const lugaresService = require('../services/lugaresService');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Dashboard: Super Administrador, Administrador e Investigador
router.get('/mapa', autenticar, verificarRol([0, 1, 2]), async (req, res) => {
    try {
        res.json(await lugaresService.mapa());
    } catch (error) {
        console.error('Error al obtener el mapa de lugares:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
