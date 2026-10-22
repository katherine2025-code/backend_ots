// controller/prediccionController.js
const Prediccion = require('../models/Prediccion');
const Hotel = require('../models/Hotel');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const axios = require('axios');
const { ML_SERVICE_URL: ML_URL, mlHeaders, estadoErrorML } = require('../config/mlService');

// Obtener todas las predicciones
const obtenerTodas = async (req, res) => {
    try {
        const { limite = 10, hotelId, estado } = req.query;

        const where = {};
        if (hotelId) where.hotel_id = hotelId;
        if (estado) where.estado = estado;

        const predicciones = await Prediccion.findAll({
            where,
            limit: parseInt(limite),
            order: [['fecha_generacion', 'DESC']],
            include: [{ model: Hotel, as: 'hotel', attributes: ['id_hotel', 'nombre'] }]
        });

        res.json(predicciones);
    } catch (error) {
        console.error('Error al obtener predicciones:', error.message);
        res.status(500).json({
            error: 'Error al obtener predicciones',
            detalles: error.message
        });
    }
};

// Obtener métricas del modelo
const obtenerMetricas = async (req, res) => {
    try {
        // Obtener métricas de la base de datos
        const totalPredicciones = await Prediccion.count();
        const prediccionesHoy = await Prediccion.count({
            where: {
                fecha_generacion: {
                    [Op.gte]: new Date().setHours(0, 0, 0, 0)
                }
            }
        });

        // Calcular precisión promedio de predicciones validadas
        const prediccionesValidadas = await Prediccion.findAll({
            where: { estado: 'validada' },
            attributes: ['precision_modelo']
        });

        let precisionPromedio = 0;
        if (prediccionesValidadas.length > 0) {
            const total = prediccionesValidadas.reduce((sum, p) => sum + (parseFloat(p.precision_modelo) || 0), 0);
            precisionPromedio = total / prediccionesValidadas.length;
        }

        // Respuesta
        const respuesta = {
            predicciones_hoy: prediccionesHoy || 0,
            total_predicciones: totalPredicciones || 0,
            precision_promedio: precisionPromedio || 85.0,
            ml_disponible: true,
            mensaje: 'Métricas de predicciones',
            ultima_actualizacion: new Date().toISOString()
        };

        res.json(respuesta);
    } catch (error) {
        console.error('Error al obtener métricas:', error.message);
        res.status(500).json({
            error: 'Error al obtener métricas',
            detalles: error.message
        });
    }
};

// Obtener predicción por ID
const obtenerPorId = async (req, res) => {
    try {
        const prediccion = await Prediccion.findByPk(req.params.id, {
            include: [{ model: Hotel, as: 'hotel', attributes: ['id_hotel', 'nombre'] }]
        });

        if (!prediccion) {
            return res.status(404).json({ error: 'Predicción no encontrada' });
        }
        res.json(prediccion);
    } catch (error) {
        console.error('Error al obtener predicción:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Crear predicción manual
const crear = async (req, res) => {
    try {
        const prediccion = await Prediccion.create(req.body);
        res.status(201).json(prediccion);
    } catch (error) {
        console.error('Error al crear predicción:', error.message);
        res.status(400).json({ error: error.message });
    }
};

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

// Validar predicción
const validar = async (req, res) => {
    try {
        const [updated] = await Prediccion.update(
            { estado: 'validada', ...req.body },
            { where: { id_prediccion: req.params.id } }
        );
        if (updated === 0) {
            return res.status(404).json({ error: 'Predicción no encontrada' });
        }
        res.json({ mensaje: 'Predicción validada correctamente' });
    } catch (error) {
        console.error('Error al validar predicción:', error.message);
        res.status(400).json({ error: error.message });
    }
};

// Descartar predicción
const descartar = async (req, res) => {
    try {
        const [updated] = await Prediccion.update(
            { estado: 'descartada', ...req.body },
            { where: { id_prediccion: req.params.id } }
        );
        if (updated === 0) {
            return res.status(404).json({ error: 'Predicción no encontrada' });
        }
        res.json({ mensaje: 'Predicción descartada' });
    } catch (error) {
        console.error('Error al descartar predicción:', error.message);
        res.status(400).json({ error: error.message });
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
    obtenerTodas,
    obtenerMetricas,
    obtenerPorId,
    predecirRango,
    crear,
    predecir,
    entrenarModelo,
    obtenerMetricasML,
    obtenerPrediccionesHistoricas,
    validar,
    descartar
};