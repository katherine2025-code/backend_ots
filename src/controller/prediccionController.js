// controller/prediccionController.js
const axios = require('axios');
const { ML_SERVICE_URL: ML_URL, mlHeaders, estadoErrorML } = require('../config/mlService');

// Realizar predicción conectando con microservicio ML
const predecir = async (req, res) => {
    try {
        const response = await axios.post(`${ML_URL}/predecir`, req.body, { headers: mlHeaders() });
        res.json(response.data);
    } catch (error) {
        console.error('Error al generar predicción:', error.message);
        const status = estadoErrorML(error);
        const detalles = error.response?.data || error.message;
        res.status(status).json({
            error: 'Error al conectar con el servicio de predicción ML',
            detalles
        });
    }
};

// Proyección por rango de fechas conectando con microservicio ML
const predecirRango = async (req, res) => {
    try {
        const response = await axios.post(`${ML_URL}/predecir-rango`, req.body, { headers: mlHeaders() });
        res.json(response.data);
    } catch (error) {
        console.error('Error al generar proyección por rango:', error.message);
        const status = estadoErrorML(error);
        const detalles = error.response?.data || error.message;
        res.status(status).json({
            error: 'Error al conectar con el servicio de predicción ML',
            detalles
        });
    }
};

// Entrenar modelo conectando con microservicio ML
const entrenarModelo = async (req, res) => {
    try {
        const response = await axios.post(`${ML_URL}/entrenar`, req.body || {}, { headers: mlHeaders() });
        res.json(response.data);
    } catch (error) {
        console.error('Error al entrenar modelo:', error.message);
        const status = estadoErrorML(error);
        const detalles = error.response?.data || error.message;
        res.status(status).json({
            error: 'Error al entrenar modelo en el servicio ML',
            detalles
        });
    }
};

// Métricas del modelo entrenado (precisión, modelo ganador, fecha de entrenamiento) que reporta
// el microservicio. Proxy: el navegador no puede llamar al microservicio directo (no es público
// y exige el token de servicio).
const obtenerMetricasML = async (req, res) => {
    try {
        const response = await axios.get(`${ML_URL}/metricas`, { headers: mlHeaders(), timeout: 15000 });
        res.json(response.data);
    } catch (error) {
        console.error('Error al obtener métricas del modelo:', error.message);
        res.status(estadoErrorML(error)).json({
            error: 'Error al obtener las métricas del servicio ML',
            detalles: error.response?.data || error.message
        });
    }
};

// Entero positivo o undefined (para no reenviar al microservicio valores arbitrarios del query).
const enteroPositivo = (valor) => {
    const n = Number.parseInt(valor, 10);
    return Number.isInteger(n) && n > 0 ? n : undefined;
};

// Validación histórica: el microservicio predice cada registro real de ocupación y lo compara con
// el valor observado. Puede tardar (recorre todo el histórico), de ahí el timeout amplio.
// Query opcional: limite (máx. de registros) y dias (solo los últimos N días).
const obtenerPrediccionesHistoricas = async (req, res) => {
    try {
        const params = {
            limite: enteroPositivo(req.query.limite),
            dias: enteroPositivo(req.query.dias)
        };
        const response = await axios.get(`${ML_URL}/predicciones-historicas`, {
            params,
            headers: mlHeaders(),
            timeout: 300000
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error en la validación histórica:', error.message);
        res.status(estadoErrorML(error)).json({
            error: 'Error al obtener la validación histórica del servicio ML',
            detalles: error.response?.data || error.message
        });
    }
};

module.exports = {
    predecirRango,
    predecir,
    entrenarModelo,
    obtenerMetricasML,
    obtenerPrediccionesHistoricas,
};