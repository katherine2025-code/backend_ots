const dashboardService = require('../services/dashboardService');
const { estadoErrorML } = require('../config/mlService');

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

const obtenerPredichoVsReal = async (req, res) => {
    try {
        res.json(await dashboardService.obtenerPredichoVsReal());
    } catch (error) {
        console.error('Error en predicho vs real:', error.message);
        res.status(estadoErrorML(error)).json({
            error: 'Error al obtener la comparación predicho vs real del servicio ML',
            detalles: error.response?.data || error.message
        });
    }
};

module.exports = {
    obtenerKPIs,
    obtenerOcupacionPorHotel,
    obtenerTendencia,
    obtenerOcupacionPorTemporada,
    obtenerOcupacionPorParroquia,
    obtenerPredichoVsReal
};