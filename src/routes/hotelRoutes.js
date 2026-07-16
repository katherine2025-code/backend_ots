const express = require('express');
const router = express.Router();
const hotelController = require('../controller/hotelController');
const { autenticar } = require('../middleware/authMiddleware');

router.get('/', autenticar, hotelController.obtenerTodos);
router.get('/:id', autenticar, hotelController.obtenerPorId);
router.post('/', autenticar, hotelController.crear);
router.put('/:id', autenticar, hotelController.actualizar);
router.delete('/:id', autenticar, hotelController.eliminar);

module.exports = router;