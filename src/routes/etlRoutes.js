const express = require('express');
const router = express.Router();
const etlController = require('../controller/etlController'); // Asegúrate que la ruta sea correcta
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// ==========================================
// 1. RUTA DE CARGA (El frontend pide '/procesar')
// ==========================================
router.post('/procesar', 
    autenticar, 
    verificarRol([0, 1]),  // Admin o Super Administrador
    upload.single('archivo'), // Debe coincidir con el 'name' del input en el frontend
    etlController.cargarArchivo
);

// ==========================================
// 2. RUTAS DE CONSULTA (Nombres alineados con el frontend)
// ==========================================

// El frontend pide '/estado-procesos'
router.get('/estado-procesos', autenticar, etlController.obtenerEstadoProcesos);
router.get('/proceso/:id/detalles', autenticar, etlController.obtenerDetallesProceso);

// El frontend pide '/logs-errores'
router.get('/logs-errores', autenticar, etlController.obtenerLogsErrores);

// El frontend pide '/ejecuciones-programadas'
router.get('/ejecuciones-programadas', autenticar, etlController.obtenerEjecucionesProgramadas);

// Estas ya funcionaban, las mantenemos
router.get('/historial', autenticar, etlController.obtenerHistorial);
router.get('/estadisticas', autenticar, etlController.obtenerEstadisticasDatos);
router.get('/tipos-datos', autenticar, etlController.obtenerTiposDatos);
router.get('/detalles/:id', autenticar, etlController.obtenerDetallesProceso);

module.exports = router;