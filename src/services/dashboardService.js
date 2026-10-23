const OcupacionHotelera = require('../models/OcupacionHotelera');
const EncuestaTuristica = require('../models/EncuestaTuristica');
const Hotel = require('../models/Hotel');
const { sequelize, pool } = require('../config/db');
const axios = require('axios');
const { ML_SERVICE_URL, mlHeaders } = require('../config/mlService');

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

// Ocupación predicha vs. real por mes. Ya NO lee la tabla `predicciones` (en desuso: nada escribe
// en ella): usa la validación histórica del microservicio, que predice cada registro real de
// ocupación con el modelo en uso y lo compara con el valor observado. Aquí se agrega por mes con el
// formato que espera el gráfico ({ mes, predicho, real }).
// Si el microservicio no tiene modelo entrenado, responde datos vacíos con un mensaje (no un error).
const obtenerPredichoVsReal = async () => {
    try {
        const { data } = await axios.get(`${ML_SERVICE_URL}/predicciones-historicas`, {
            headers: mlHeaders(),
            timeout: 300000
        });
        const porMes = new Map();
        for (const p of data.predicciones || []) {
            const mes = String(p.fecha).slice(0, 7); // 'YYYY-MM'
            const acc = porMes.get(mes) || { predicho: 0, real: 0, registros: 0 };
            acc.predicho += Number(p.valor_predicho) || 0;
            acc.real += Number(p.valor_real) || 0;
            acc.registros += 1;
            porMes.set(mes, acc);
        }
        const datos = [...porMes.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mes, a]) => ({
                mes,
                predicho: Math.round((a.predicho / a.registros) * 100) / 100,
                real: Math.round((a.real / a.registros) * 100) / 100,
                registros: a.registros
            }));
        return {
            datos,
            mensaje: datos.length ? null : 'Todavía no hay registros de ocupación para comparar con el modelo.'
        };
    } catch (error) {
        // El microservicio responde 400 cuando no hay ningún modelo entrenado: no es un fallo.
        if (error.response?.status === 400) {
            return {
                datos: [],
                mensaje: 'El modelo de predicción todavía no está entrenado: entrénalo en Predicciones para ver esta comparación.'
            };
        }
        throw error;
    }
};

module.exports = { 
    obtenerKPIsGenerales, 
    obtenerOcupacionPorHotel, 
    obtenerTendenciaOcupacion,
    obtenerOcupacionPorTemporada,
    obtenerOcupacionPorParroquia,
    obtenerPredichoVsReal
};