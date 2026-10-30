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
        if (hotelId) where.id_hotel = hotelId;
        if (estado) where.estado = estado;

        const predicciones = await Prediccion.findAll({
            where,
            limit: parseInt(limite, 10) || 10,
            order: [['fecha_generacion', 'DESC'], ['fecha', 'DESC']],
            include: [{ model: Hotel, as: 'hotel', attributes: ['id_hotel', 'nombre', 'canton'], required: false }]
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
            precision_promedio: precisionPromedio || 0,
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

// El modelo del microservicio usa nombres con espacio ("Random Forest"), pero la
// columna `modelo_utilizado` es un ENUM que solo admite RandomForest/XGBoost/Prophet.
const MODELO_DB = {
    'RandomForest': 'RandomForest',
    'Random Forest': 'RandomForest',
    'random forest': 'RandomForest',
    'XGBoost': 'XGBoost',
    'Prophet': 'Prophet'
};
const modeloParaBD = (nombre) => MODELO_DB[nombre] || 'RandomForest';

// Convierte el rango de confianza del microservicio en columnas decimales válidas.
const recortar = (valor) => {
    const n = Number(valor);
    if (!Number.isFinite(n)) return null;
    return Math.round(Math.max(0, Math.min(100, n)) * 100) / 100;
};

/**
 * Guarda en `predicciones` lo que acaba de calcular el microservicio, para que el
 * Administrador y el Investigador puedan consultarlo en solo lectura.
 *
 * Se reemplazan las predicciones PENDIENTES de las mismas fechas (y del mismo hotel,
 * o de la proyección general si idHotel es null) para que volver a generar no llene
 * la tabla de filas repetidas. Las ya validadas/descartadas se conservan como historial.
 */
const persistirPredicciones = async ({ idUsuario, idHotel, filas, modelo, precision, rmse }) => {
    if (!filas.length) return { guardadas: 0 };

    const fechas = filas.map(f => f.fecha);
    const where = { fecha: { [Op.in]: fechas }, estado: 'pendiente' };
    if (idHotel) where.id_hotel = idHotel;
    else where.id_hotel = null;
    await Prediccion.destroy({ where });

    const modeloBD = modeloParaBD(modelo);
    const registros = filas.map(f => ({
        id_usuario: idUsuario || null,
        id_hotel: idHotel || null,
        fecha: f.fecha,
        ocupacion_predicha: f.ocupacion_predicha,
        precision_modelo: recortar(precision),
        modelo_utilizado: modeloBD,
        intervalo_confianza_min: f.min ?? recortar(Number(f.ocupacion_predicha) - Number(rmse || 0)),
        intervalo_confianza_max: f.max ?? recortar(Number(f.ocupacion_predicha) + Number(rmse || 0)),
        estado: 'pendiente',
        observaciones: 'Generada desde el módulo de Predicciones'
    }));

    await Prediccion.bulkCreate(registros);
    return { guardadas: registros.length };
};

// Realizar predicción conectando con microservicio ML
const predecir = async (req, res) => {
    try {
        const response = await axios.post(`${ML_URL}/predecir`, req.body, { headers: mlHeaders() });
        const datos = response.data;

        // Persistencia best-effort: si falla el guardado, la predicción igual se devuelve.
        let persistencia = { guardadas: 0 };
        try {
            persistencia = await persistirPredicciones({
                idUsuario: req.usuario?.id_usuario,
                idHotel: req.body?.id_hotel ? Number(req.body.id_hotel) : null,
                filas: [{
                    fecha: datos.fecha_objetivo,
                    ocupacion_predicha: datos.ocupacion_predicha,
                    min: datos.rango_prediccion?.minimo,
                    max: datos.rango_prediccion?.maximo
                }],
                modelo: datos.modelo,
                precision: datos.precision,
                rmse: datos.error_estimado
            });
        } catch (dbError) {
            console.error('No se pudo guardar la predicción en la BD:', dbError.message);
        }

        res.json({ ...datos, persistida: persistencia.guardadas > 0 });
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
        const datos = response.data;

        let persistencia = { guardadas: 0 };
        try {
            const diarias = (datos.predicciones_diarias || []).map(d => ({
                fecha: d.fecha,
                ocupacion_predicha: d.ocupacion_predicha
            }));
            persistencia = await persistirPredicciones({
                idUsuario: req.usuario?.id_usuario,
                idHotel: req.body?.id_hotel ? Number(req.body.id_hotel) : null,
                filas: diarias,
                modelo: datos.modelo_usado,
                precision: datos.precision_modelo,
                rmse: datos.rmse
            });
        } catch (dbError) {
            console.error('No se pudo guardar la proyección en la BD:', dbError.message);
        }

        res.json({ ...datos, persistida: persistencia.guardadas > 0 });
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
            {
                estado: 'validada',
                observaciones: req.body?.observaciones ?? null,
                validada_por: req.usuario?.id_usuario ?? null,
                fecha_validacion: new Date()
            },
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
            {
                estado: 'descartada',
                observaciones: req.body?.observaciones ?? null,
                validada_por: req.usuario?.id_usuario ?? null,
                fecha_validacion: new Date()
            },
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