const express = require('express');
const router = express.Router();
const etlController = require('../controller/etlController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Cargar archivo CSV
router.post('/cargar', 
    autenticar, 
    verificarRol([1]),  //  Solo admin (id_rol = 1)
    upload.single('archivo'), 
    etlController.cargarArchivo
);

// Historial
router.get('/historial', autenticar, etlController.obtenerHistorial);

// Estado
router.get('/estado', autenticar, etlController.obtenerEstadoProcesos);

// Estadísticas
router.get('/estadisticas', autenticar, etlController.obtenerEstadisticasDatos);

// Tipos de datos
router.get('/tipos-datos', autenticar, etlController.obtenerTiposDatos);

// NUEVAS: Logs y programadas (evitan 404)
router.get('/logs', autenticar, (req, res) => res.json([]));
router.get('/programadas', autenticar, (req, res) => res.json([]));

// Al final del archivo, antes de module.exports
router.get('/detalles/:id', autenticar, etlController.obtenerDetallesProceso);

module.exports = router;