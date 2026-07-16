const dashboardService = require('../services/dashboardService');

const obtenerKPIs = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({ 
                error: 'fechaInicio y fechaFin son obligatorios' 
            });
        }

        const kpis = await dashboardService.obtenerKPIsGenerales(fechaInicio, fechaFin);
        res.json(kpis);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerOcupacionPorHotel = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        const datos = await dashboardService.obtenerOcupacionPorHotel(fechaInicio, fechaFin);
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerTendencia = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        const datos = await dashboardService.obtenerTendenciaOcupacion(fechaInicio, fechaFin);
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerPredicciones = async (req, res) => {
    try {
        const predicciones = await dashboardService.obtenerPrediccionesRecientes();
        res.json(predicciones);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerEstadisticas = async (req, res) => {
    try {
        const estadisticas = await dashboardService.obtenerEstadisticasDashboard();
        res.json(estadisticas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerMetricasModelo = async (req, res) => {
    try {
        const metricas = await dashboardService.obtenerMetricasModelo();
        res.json(metricas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerOcupacionPorTemporada = async (req, res) => {
    try {
        const datos = await dashboardService.obtenerOcupacionPorTemporada();
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerOcupacionPorParroquia = async (req, res) => {
    try {
        const datos = await dashboardService.obtenerOcupacionPorParroquia();
        res.json(datos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { 
    obtenerKPIs, 
    obtenerOcupacionPorHotel, 
    obtenerTendencia, 
    obtenerPredicciones,
    obtenerEstadisticas,
    obtenerMetricasModelo,
    obtenerOcupacionPorTemporada,
    obtenerOcupacionPorParroquia
};