const validacionService = require('./services/validacionService');

class ValidacionController {

    // Validar predicción específica
    async validarPrediccion(req, res) {
        try {
            const { prediccionId, hotelId, fecha } = req.body;
            const resultado = await validacionService.validarPrediccion(prediccionId, hotelId, fecha);
            res.status(200).json({
                success: true,
                data: resultado
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Obtener métricas del modelo
    async getMetricas(req, res) {
        try {
            const { modelo, fechaInicio, fechaFin } = req.query;
            const metricas = await validacionService.calcularMetricas(modelo, fechaInicio, fechaFin);
            res.status(200).json({
                success: true,
                data: metricas
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Generar reporte de validación
    async generarReporte(req, res) {
        try {
            const { hotelId, fechaInicio, fechaFin } = req.query;
            const reporte = await validacionService.generarReporteValidacion(hotelId, fechaInicio, fechaFin);
            res.status(200).json({
                success: true,
                data: reporte
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new ValidacionController();