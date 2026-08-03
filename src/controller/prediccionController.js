const Prediccion = require('../models/Prediccion');
const { sequelize } = require('../config/db');

// Obtener todas las predicciones
const obtenerTodas = async (req, res) => {
    try {
        const { limite = 10 } = req.query;
        const predicciones = await Prediccion.findAll({
            limit: parseInt(limite),
            order: [['fecha_generacion', 'DESC']]
        });
        res.json(predicciones);
    } catch (error) {
        console.error('Error al obtener predicciones:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener métricas del modelo (conectado al microservicio Python ML)
const obtenerMetricas = async (req, res) => {
    try {
        const response = await fetch('http://localhost:5000/entrenar', { method: 'POST' });
        if (!response.ok) {
            // Si el modelo aún no se ha entrenado en Python, intentar obtener estado o responder 400
            return res.status(400).json({ error: 'El modelo ML aún no ha sido entrenado en el microservicio' });
        }
        const data = await response.json();
        res.json(data.metricas || data);
    } catch (error) {
        console.error('Error al conectar con el microservicio ML:', error.message);
        res.status(503).json({ error: 'Microservicio de Machine Learning en Python no disponible' });
    }
};

// Obtener predicción por ID
const obtenerPorId = async (req, res) => {
    try {
        const prediccion = await Prediccion.findByPk(req.params.id);
        if (!prediccion) {
            return res.status(404).json({ error: 'Predicción no encontrada' });
        }
        res.json(prediccion);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear predicción
const crear = async (req, res) => {
    try {
        const prediccion = await Prediccion.create(req.body);
        res.status(201).json(prediccion);
    } catch (error) {
        res.status(400).json({ error: error.message });
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
        res.json({ mensaje: 'Predicción validada' });
    } catch (error) {
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
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    obtenerTodas,
    obtenerMetricas,
    obtenerPorId,
    crear,
    validar,
    descartar
};