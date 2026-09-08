// controller/prediccionController.js
const Prediccion = require('../models/Prediccion');
const Hotel = require('../models/Hotel');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const axios = require('axios');
const env = require('../config/environment');

const ML_URL = process.env.ML_SERVICE_URL || env.ML_SERVICE_URL || 'http://localhost:5000';

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
        const response = await axios.post(`${ML_URL}/predecir`, req.body);
        res.json(response.data);
    } catch (error) {
        console.error('Error al generar predicción:', error.message);
        const status = error.response ? error.response.status : 500;
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
        const response = await axios.post(`${ML_URL}/entrenar`, req.body || {});
        res.json(response.data);
    } catch (error) {
        console.error('Error al entrenar modelo:', error.message);
        const status = error.response ? error.response.status : 500;
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

module.exports = {
    obtenerTodas,
    obtenerMetricas,
    obtenerPorId,
    crear,
    predecir,
    entrenarModelo,
    validar,
    descartar
};