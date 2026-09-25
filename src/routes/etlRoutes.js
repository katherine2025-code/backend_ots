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
    verificarRol([0]),  // Solo Super Administrador: el ETL dejó de ser función del Administrador
    upload.single('archivo'), // Debe coincidir con el 'name' del input en el frontend
    etlController.cargarArchivo
);

// ==========================================
// 2. RUTAS DE CONSULTA (Nombres alineados con el frontend)
// ==========================================
// Todo el módulo ETL es exclusivo de Super Administrador (ver ruta de arriba).

// El frontend pide '/estado-procesos'
router.get('/estado-procesos', autenticar, verificarRol([0]), etlController.obtenerEstadoProcesos);
router.get('/proceso/:id/detalles', autenticar, verificarRol([0]), etlController.obtenerDetallesProceso);

// El frontend pide '/logs-errores'
router.get('/logs-errores', autenticar, verificarRol([0]), etlController.obtenerLogsErrores);

// El frontend pide '/ejecuciones-programadas'
router.get('/ejecuciones-programadas', autenticar, verificarRol([0]), etlController.obtenerEjecucionesProgramadas);

// Estas ya funcionaban, las mantenemos
router.get('/historial', autenticar, verificarRol([0]), etlController.obtenerHistorial);
router.get('/estadisticas', autenticar, verificarRol([0]), etlController.obtenerEstadisticasDatos);
router.get('/tipos-datos', autenticar, verificarRol([0]), etlController.obtenerTiposDatos);
router.get('/detalles/:id', autenticar, verificarRol([0]), etlController.obtenerDetallesProceso);

module.exports = router;