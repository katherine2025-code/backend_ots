const OcupacionHotelera = require('../models/OcupacionHotelera');
const Hotel = require('../models/Hotel');
const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');
const { NOMBRES_FERIADOS, MARGEN_ANALISIS_DIAS } = require('../utils/feriados');

const LIMITE_REGISTROS = 500; // evita cargar miles de filas de golpe en la tabla del frontend

// Marca especial que el frontend usa para pedir los registros SIN feriado asignado
// (los cargados desde Kobo, cuyo formulario original no preguntaba esto, y que tampoco caen
// dentro del margen de ningún feriado del calendario oficial).
const SIN_FERIADO = '__sin_feriado__';

// El feriado de un registro es: el que reportó el propio encuestador (columna `feriado`) si lo
// tiene; si no, el feriado oficial en cuyo rango ± MARGEN_ANALISIS_DIAS cae su fecha (agrupa,
// nunca modifica la fila real - ver utils/feriados.js). Mismo margen para los 7 feriados, sin
// ajustes caso por caso.
const FERIADO_EFECTIVO_SQL = `
    COALESCE(o.feriado, (
        SELECT f.nombre FROM feriados f
        WHERE o.fecha BETWEEN DATE_SUB(f.fecha_inicio, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY)
                           AND DATE_ADD(f.fecha_fin, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY)
        ORDER BY f.fecha_inicio LIMIT 1
    ))`;

// Obtener todas las ocupaciones, con el nombre del hotel y el feriado efectivo. Admite filtrar
// por feriado (nombre exacto, o SIN_FERIADO para lo que no cae en ninguno).
const obtenerTodas = async (req, res) => {
    try {
        const { feriado } = req.query;
        let condicionFeriado = '';
        const replacements = { limite: LIMITE_REGISTROS };
        if (feriado === SIN_FERIADO) {
            condicionFeriado = `HAVING feriado_efectivo IS NULL`;
        } else if (feriado) {
            condicionFeriado = `HAVING feriado_efectivo = :feriado`;
            replacements.feriado = feriado;
        }

        const filas = await sequelize.query(
            `SELECT o.*, h.nombre AS hotel_nombre, h.parroquia AS hotel_parroquia, h.canton AS hotel_canton,
                    ${FERIADO_EFECTIVO_SQL} AS feriado_efectivo
             FROM ocupacion_hotelera o
             JOIN hoteles h ON h.id_hotel = o.id_hotel
             ${condicionFeriado}
             ORDER BY o.fecha DESC
             LIMIT :limite`,
            { replacements, type: QueryTypes.SELECT }
        );

        res.json(filas.map(f => ({
            id_ocupacion: f.id_ocupacion,
            id_hotel: f.id_hotel,
            fecha: f.fecha,
            checkin_nacionales: f.checkin_nacionales,
            checkin_extranjeros: f.checkin_extranjeros,
            total_turistas: f.total_turistas,
            pernoctaciones: f.pernoctaciones,
            habitaciones_ocupadas: f.habitaciones_ocupadas,
            habitaciones_disponibles: f.habitaciones_disponibles,
            habitaciones_totales: f.habitaciones_totales,
            ocupacion_porcentaje: f.ocupacion_porcentaje,
            tarifa_cobrada: f.tarifa_cobrada,
            fuente_dato: f.fuente_dato,
            feriado: f.feriado_efectivo,
            feriadoReportado: !!f.feriado, // true si lo indicó el propio encuestador (no agrupado por fecha)
            hotel: { nombre: f.hotel_nombre, parroquia: f.hotel_parroquia, canton: f.hotel_canton }
        })));
    } catch (error) {
        console.error('Error al obtener ocupaciones:', error);
        res.status(500).json({ error: error.message });
    }
};

// Los 7 feriados del calendario oficial en orden cronológico, cada uno con el total REAL de
// registros de ocupación que le corresponden (propios o agrupados por fecha - ver arriba). Se
// muestran siempre los 7, aunque un feriado todavía no tenga ningún registro: así se ve la
// estructura completa del análisis, sin inventar números donde no hay datos.
const obtenerFeriados = async (req, res) => {
    try {
        // El feriado se calcula en una subconsulta (t) y se agrupa sobre esa columna ya resuelta:
        // agrupar directamente por la expresión con la subconsulta correlacionada choca con
        // ONLY_FULL_GROUP_BY (MySQL no permite mezclar una columna sin agregar de la tabla base,
        // o.fecha aquí, con GROUP BY sobre una expresión derivada de ella).
        const conteos = await sequelize.query(
            `SELECT feriado, COUNT(*) AS total FROM (
                SELECT ${FERIADO_EFECTIVO_SQL} AS feriado FROM ocupacion_hotelera o
             ) t
             GROUP BY feriado`,
            { type: QueryTypes.SELECT }
        );
        const totalPorNombre = new Map(conteos.filter(c => c.feriado).map(c => [c.feriado, Number(c.total)]));
        const sinFeriado = Number(conteos.find(c => !c.feriado)?.total || 0);

        res.json({
            feriados: NOMBRES_FERIADOS.map(nombre => ({ feriado: nombre, total: totalPorNombre.get(nombre) || 0 })),
            sinFeriado
        });
    } catch (error) {
        console.error('Error al obtener feriados de ocupación:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener estadísticas de ocupación
const obtenerEstadisticas = async (req, res) => {
    try {
        const totalRegistros = await OcupacionHotelera.count();

        const resultado = await sequelize.query(
            'SELECT AVG(ocupacion_porcentaje) as promedio FROM ocupacion_hotelera WHERE habitaciones_totales > 0',
            { type: QueryTypes.SELECT }
        );
        const ocupacionPromedio = resultado[0]?.promedio || 0;

        // Promedio diario REAL de los últimos 30 días con datos (antes esto eran números
        // aleatorios de relleno que nunca llegaron a mostrarse en ninguna pantalla; se deja el
        // dato real, aunque haya días sin registros, en vez de inventar un valor para rellenar).
        const porDia = await sequelize.query(
            `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, AVG(ocupacion_porcentaje) AS ocupacion
             FROM ocupacion_hotelera
             WHERE habitaciones_totales > 0 AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY fecha ORDER BY fecha ASC`,
            { type: QueryTypes.SELECT }
        );

        res.json({
            total_registros: totalRegistros,
            ocupacion_promedio: parseFloat(ocupacionPromedio).toFixed(2),
            ultimos_30_dias: porDia.map(d => ({ fecha: d.fecha, ocupacion: parseFloat(d.ocupacion) }))
        });
    } catch (error) {
        console.error('Error en estadísticas:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener ocupación por hotel
const obtenerPorHotel = async (req, res) => {
    try {
        const ocupaciones = await OcupacionHotelera.findAll({
            where: { id_hotel: req.params.id },
            include: { model: Hotel, as: 'hotel', attributes: ['nombre', 'parroquia', 'canton'] },
            order: [['fecha', 'DESC']]
        });
        res.json(ocupaciones);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    obtenerTodas,
    obtenerFeriados,
    obtenerEstadisticas,
    obtenerPorHotel
};
