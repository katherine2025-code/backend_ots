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

// Obtener métricas del modelo
const obtenerMetricas = async (req, res) => {
    try {
        // Métricas simuladas
        const metricas = {
            predicciones_hoy: 8,
            precision_promedio: 87.5,
            modelos: [
                {
                    modelo_nombre: 'Random Forest',
                    mae: 2.5,
                    rmse: 3.2,
                    r2: 0.89
                },
                {
                    modelo_nombre: 'XGBoost',
                    mae: 2.3,
                    rmse: 3.0,
                    r2: 0.91
                }
            ]
        };

        res.json(metricas);
    } catch (error) {
        console.error('Error en métricas:', error);
        res.status(500).json({ error: error.message });
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