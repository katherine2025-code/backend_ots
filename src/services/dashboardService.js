const OcupacionHotelera = require('../models/OcupacionHotelera');
const EncuestaTuristica = require('../models/EncuestaTuristica');
const Hotel = require('../models/Hotel');
const Prediccion = require('../models/Prediccion');
const { sequelize, pool } = require('../config/db');

const obtenerKPIsGenerales = async (fechaInicio, fechaFin) => {
    const [ocupacionRows] = await pool.query(`
        SELECT 
            AVG(ocupacion_porcentaje) as ocupacion_promedio,
            SUM(checkin_nacionales) as total_nacionales,
            SUM(checkin_extranjeros) as total_extranjeros,
            AVG(tarifa_cobrada) as tarifa_promedio,
            SUM(habitaciones_ocupadas) as total_habitaciones_ocupadas
        FROM ocupacion_hotelera
        WHERE fecha BETWEEN ? AND ?
    `, [fechaInicio, fechaFin]);
    const ocupacionKPIs = ocupacionRows[0] || {};
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
    return await Prediccion.findAll({
        limit: 20,
        order: [['fecha_generacion', 'DESC']]
    });
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
    try {
        const metricas = await Prediccion.findAll({
            attributes: [
                'modelo_utilizado',
                [sequelize.fn('AVG', sequelize.col('precision_modelo')), 'precision_promedio'],
                [sequelize.fn('AVG', sequelize.col('error_absoluto')), 'error_promedio'],
                [sequelize.fn('COUNT', sequelize.col('id_prediccion')), 'total_predicciones']
            ],
            group: ['modelo_utilizado'],
            raw: true
        });

        return {
            modelos: metricas
        };
    } catch (error) {
        console.error('Error al obtener métricas del modelo:', error.message);
        return { modelos: [] };
    }
};

// La ocupación no tiene una columna "temporada" propia (solo un id_temporada que no se usa en
// ninguna carga real). La temporada real viene del feriado al que corresponde cada registro
// (Alta/Media, según el calendario oficial - ver utils/feriados.js), con el mismo margen de
// días que usa el filtro "por feriado" de Ocupación, para que ambas pantallas cuenten igual.
const obtenerOcupacionPorTemporada = async () => {
    const { MARGEN_ANALISIS_DIAS } = require('../utils/feriados');
    const datos = await sequelize.query(
        `SELECT temporada, AVG(pct) AS promedio, COUNT(*) AS registros FROM (
            SELECT o.ocupacion_porcentaje AS pct, (
                SELECT f.temporada FROM feriados f
                WHERE o.fecha BETWEEN DATE_SUB(f.fecha_inicio, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY)
                                   AND DATE_ADD(f.fecha_fin, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY)
                ORDER BY f.fecha_inicio LIMIT 1
            ) AS temporada
            FROM ocupacion_hotelera o
            WHERE o.habitaciones_totales > 0
         ) t
         WHERE temporada IS NOT NULL
         GROUP BY temporada
         ORDER BY promedio DESC`,
        { type: require('sequelize').QueryTypes.SELECT }
    );
    return datos;
};

// Ocupación predicha vs. real por mes, SOLO para predicciones ya validadas (con ocupacion_real
// cargada) - una predicción sin validar no tiene con qué compararse todavía. Si no hay ninguna
// validada, el arreglo queda vacío: el frontend lo muestra como "aún no hay predicciones
// validadas" en vez de dibujar un dato inventado.
const obtenerPredichoVsReal = async () => {
    const datos = await sequelize.query(
        // `real` es palabra reservada en MySQL (sinónimo histórico de DOUBLE) - va entre backticks.
        `SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes,
                AVG(ocupacion_predicha) AS predicho, AVG(ocupacion_real) AS \`real\`
         FROM predicciones
         WHERE ocupacion_real IS NOT NULL
         GROUP BY mes ORDER BY mes`,
        { type: require('sequelize').QueryTypes.SELECT }
    );
    return datos.map(d => ({ mes: d.mes, predicho: parseFloat(d.predicho), real: parseFloat(d.real) }));
};

const obtenerOcupacionPorParroquia = async () => {
    const datos = await OcupacionHotelera.findAll({
        include: [{
            model: Hotel,
            as: 'hotel',
            attributes: ['parroquia']
        }],
        attributes: [
            [sequelize.col('hotel.parroquia'), 'parroquia'],
            [sequelize.fn('AVG', sequelize.col('ocupacion_porcentaje')), 'promedio'],
            [sequelize.fn('COUNT', sequelize.col('id_ocupacion')), 'registros']
        ],
        group: ['hotel.parroquia'],
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
    obtenerOcupacionPorTemporada,
    obtenerOcupacionPorParroquia,
    obtenerPredichoVsReal
};