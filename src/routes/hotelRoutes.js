const express = require('express');
const router = express.Router();
const hotelController = require('../controller/hotelController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

// Lectura: cualquier usuario autenticado (admin, investigador, encuestador)
router.get('/', autenticar, hotelController.obtenerTodos);
router.get('/:id', autenticar, hotelController.obtenerPorId);

// Escritura: solo administrador
router.post('/', autenticar, verificarRol([1]), hotelController.crear);
router.put('/:id', autenticar, verificarRol([1]), hotelController.actualizar);
router.delete('/:id', autenticar, verificarRol([1]), hotelController.eliminar);

module.exports = router;