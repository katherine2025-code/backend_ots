const OcupacionHotelera = require('../models/OcupacionHotelera');
const EncuestaTuristica = require('../models/EncuestaTuristica');
const Hotel = require('../models/Hotel');
const Prediccion = require('../models/Prediccion');

const obtenerKPIsGenerales = async (fechaInicio, fechaFin) => {
    const ocupacionKPIs = await OcupacionHotelera.getKPIs(fechaInicio, fechaFin);
    const encuestaKPIs = await EncuestaTuristica.getKPIs(fechaInicio, fechaFin);
    const totalHoteles = (await Hotel.findAll()).length;

    return {
        ocupacion: ocupacionKPIs,
        encuestas: encuestaKPIs,
        totalHoteles,
        periodo: { fechaInicio, fechaFin }
    };
};

const obtenerOcupacionPorHotel = async (fechaInicio, fechaFin) => {
    const { pool } = require('../config/db');
    const [rows] = await pool.query(`
        SELECT 
            h.nombre as hotel,
            AVG(oh.ocupacion_porcentaje) as ocupacion_promedio,
            SUM(oh.checkin_nacionales) as nacionales,
            SUM(oh.checkin_extranjeros) as extranjeros
        FROM ocupacion_hotelera oh
        INNER JOIN hoteles h ON oh.id_hotel = h.id_hotel
        WHERE oh.fecha BETWEEN ? AND ?
        GROUP BY h.id_hotel, h.nombre
        ORDER BY ocupacion_promedio DESC
    `, [fechaInicio, fechaFin]);
    
    return rows;
};

const obtenerTendenciaOcupacion = async (fechaInicio, fechaFin) => {
    const { pool } = require('../config/db');
    const [rows] = await pool.query(`
        SELECT 
            DATE_FORMAT(fecha, '%Y-%m') as mes,
            AVG(ocupacion_porcentaje) as ocupacion_promedio
        FROM ocupacion_hotelera
        WHERE fecha BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(fecha, '%Y-%m')
        ORDER BY mes ASC
    `, [fechaInicio, fechaFin]);
    
    return rows;
};

const obtenerPrediccionesRecientes = async () => {
    return await Prediccion.findAll();
};

const obtenerEstadisticasDashboard = async () => {
    const { Op } = require('sequelize');
    
    // Total de registros de ocupación
    const totalRegistros = await OcupacionHotelera.count();
    
    // Ocupación promedio últimos 30 días
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 30);
    
    const ocupacionPromedio = await OcupacionHotelera.findOne({
        attributes: [
            [sequelize.fn('AVG', sequelize.col('ocupacion_porcentaje')), 'promedio']
        ],
        where: {
            fecha: { [Op.gte]: fechaLimite }
        },
        raw: true
    });

    // Predicciones hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const prediccionesHoy = await Prediccion.count({
        where: {
            fecha_generacion: { [Op.gte]: hoy }
        }
    });

    // Precisión promedio del modelo
    const precisionPromedio = await Prediccion.findOne({
        attributes: [
            [sequelize.fn('AVG', sequelize.col('precision_modelo')), 'promedio']
        ],
        where: {
            estado: 'validada'
        },
        raw: true
    });

    return {
        total_registros: totalRegistros,
        ocupacion_promedio: parseFloat(ocupacionPromedio?.promedio || 0).toFixed(2),
        predicciones_hoy: prediccionesHoy,
        precision_modelo: parseFloat(precisionPromedio?.promedio || 0).toFixed(2)
    };
};

const obtenerMetricasModelo = async () => {
    const metricas = await ModeloMetrica.findAll({
        attributes: [
            'modelo_nombre',
            'tipo_evaluacion',
            [sequelize.fn('AVG', sequelize.col('mae')), 'mae_promedio'],
            [sequelize.fn('AVG', sequelize.col('rmse')), 'rmse_promedio'],
            [sequelize.fn('AVG', sequelize.col('r2')), 'r2_promedio']
        ],
        group: ['modelo_nombre', 'tipo_evaluacion'],
        raw: true
    });

    return {
        modelos: metricas
    };
};

const obtenerOcupacionPorTemporada = async () => {
    const datos = await OcupacionHotelera.findAll({
        attributes: [
            'temporada',
            [sequelize.fn('AVG', sequelize.col('ocupacion_porcentaje')), 'promedio'],
            [sequelize.fn('COUNT', sequelize.col('id_ocupacion')), 'registros']
        ],
        group: ['temporada'],
        order: [[sequelize.fn('AVG', sequelize.col('ocupacion_porcentaje')), 'DESC']],
        raw: true
    });

    return datos;
};

const obtenerOcupacionPorParroquia = async () => {
    const datos = await OcupacionHotelera.findAll({
        include: [{
            model: Hotel,
            attributes: ['parroquia']
        }],
        attributes: [
            [sequelize.col('Hotel.parroquia'), 'parroquia'],
            [sequelize.fn('AVG', sequelize.col('ocupacion_porcentaje')), 'promedio'],
            [sequelize.fn('COUNT', sequelize.col('id_ocupacion')), 'registros']
        ],
        group: ['Hotel.parroquia'],
        order: [[sequelize.fn('AVG', sequelize.col('ocupacion_porcentaje')), 'DESC']],
        raw: true
    });

    return datos;
};


module.exports = { 
    obtenerKPIsGenerales, 
    obtenerOcupacionPorHotel, 
    obtenerTendenciaOcupacion,
    obtenerPrediccionesRecientes,
    obtenerEstadisticasDashboard,
    obtenerMetricasModelo,
    obtenerOcupacionPorHotel,
    obtenerOcupacionPorParroquia
};