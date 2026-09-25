const Reporte = require('../models/Reporte');
const { sequelize } = require('../config/db');
const { NOMBRES_FERIADOS, MARGEN_ANALISIS_DIAS } = require('../utils/feriados');

// Arma el WHERE compartido por las 4 consultas de estadísticas a partir de los filtros
// opcionales de la pantalla de Reportes (feriado, rango de fechas, año). `columnaFecha` es
// distinta según la tabla (encuestas_turisticas.fecha_encuesta vs ocupacion_hotelera.fecha).
// El feriado usa el mismo calendario + margen que ya usan Ocupación y el mapa del dashboard
// (ver utils/feriados.js), para que "Carnaval" signifique lo mismo en toda la aplicación.
const construirFiltroFecha = (columnaFecha, { feriado, fechaInicio, fechaFin, anio }) => {
    const condiciones = [];
    const replacements = {};

    if (feriado) {
        condiciones.push(`${columnaFecha} BETWEEN
            (SELECT DATE_SUB(f.fecha_inicio, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY) FROM feriados f WHERE f.nombre = :feriado)
            AND (SELECT DATE_ADD(f.fecha_fin, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY) FROM feriados f WHERE f.nombre = :feriado)`);
        replacements.feriado = feriado;
    }
    if (fechaInicio) {
        condiciones.push(`${columnaFecha} >= :fechaInicio`);
        replacements.fechaInicio = fechaInicio;
    }
    if (fechaFin) {
        condiciones.push(`${columnaFecha} <= :fechaFin`);
        replacements.fechaFin = fechaFin;
    }
    if (anio) {
        condiciones.push(`YEAR(${columnaFecha}) = :anio`);
        replacements.anio = anio;
    }

    return {
        sql: condiciones.length ? 'AND ' + condiciones.join(' AND ') : '',
        replacements
    };
};

// Estadísticas reales para la pantalla de Reportes (Investigador y Super Administrador),
// con filtro opcional por feriado, rango de fechas y/o año. Antes esta pantalla llamaba por
// error a /etl/estadisticas (que devuelve el estado de los PROCESOS del ETL, no datos de
// encuestas/ocupación), por eso siempre salía vacía.
const obtenerEstadisticas = async (req, res) => {
    try {
        const filtros = {
            feriado: req.query.feriado || null,
            fechaInicio: req.query.fechaInicio || null,
            fechaFin: req.query.fechaFin || null,
            anio: req.query.anio || null
        };

        const encuestasFiltro = construirFiltroFecha('fecha_encuesta', filtros);
        const ocupacionFiltro = construirFiltroFecha('fecha', filtros);

        const [[encuestas]] = await sequelize.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(DISTINCT NULLIF(TRIM(pais_residencia), '')) AS paises,
                -- nivel_satisfaccion es 1-5; 0 no es una respuesta real, es el valor por
                -- defecto cuando el ETL no encontró esa pregunta en el archivo de origen
                -- (advertencia ya conocida) - promediarlo como si fuera un "muy insatisfecho"
                -- sesgaría el resultado hacia abajo, así que se excluye del promedio.
                AVG(NULLIF(nivel_satisfaccion, 0)) AS satisfaccion_promedio,
                AVG(gasto_total) AS gasto_promedio,
                AVG(noches_estadia) AS noches_promedio
            FROM encuestas_turisticas
            WHERE 1=1 ${encuestasFiltro.sql}
        `, { replacements: encuestasFiltro.replacements });

        // habitaciones_disponibles > 0: igual que en Ocupación, un registro con capacidad 0 no es
        // "0% de ocupación real" sino un dato que no se conoce - no debe promediarse como si lo fuera.
        const [[ocupacion]] = await sequelize.query(`
            SELECT
                COUNT(*) AS total,
                AVG(ocupacion_porcentaje) AS ocupacion_promedio,
                SUM(checkin_nacionales + checkin_extranjeros) AS total_huespedes,
                AVG(tarifa_cobrada) AS tarifa_promedio
            FROM ocupacion_hotelera
            WHERE habitaciones_disponibles > 0 ${ocupacionFiltro.sql}
        `, { replacements: ocupacionFiltro.replacements });

        const [paisesRows] = await sequelize.query(`
            SELECT TRIM(pais_residencia) AS pais, COUNT(*) AS total
            FROM encuestas_turisticas
            WHERE pais_residencia IS NOT NULL AND TRIM(pais_residencia) <> '' ${encuestasFiltro.sql}
            GROUP BY TRIM(pais_residencia)
            ORDER BY total DESC
            LIMIT 8
        `, { replacements: encuestasFiltro.replacements });

        // Gasto promedio por feriado: se ignora el filtro de feriado (si lo hay) porque el
        // propósito de este gráfico es comparar entre feriados, no mostrar solo uno.
        const filtroSinFeriado = construirFiltroFecha('fecha_encuesta', { ...filtros, feriado: null });
        const gastoPorFeriado = [];
        for (const nombre of NOMBRES_FERIADOS) {
            const [[fila]] = await sequelize.query(`
                SELECT AVG(gasto_total) AS gasto_promedio, COUNT(*) AS total
                FROM encuestas_turisticas
                WHERE fecha_encuesta BETWEEN
                    (SELECT DATE_SUB(fecha_inicio, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY) FROM feriados WHERE nombre = :nombre)
                    AND (SELECT DATE_ADD(fecha_fin, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY) FROM feriados WHERE nombre = :nombre)
                    ${filtroSinFeriado.sql}
            `, { replacements: { ...filtroSinFeriado.replacements, nombre } });
            gastoPorFeriado.push({ feriado: nombre, gasto_promedio: fila.gasto_promedio, total: fila.total });
        }

        res.json({
            filtros,
            encuestas: {
                total: Number(encuestas.total) || 0,
                paises: Number(encuestas.paises) || 0,
                satisfaccion_promedio: encuestas.satisfaccion_promedio !== null ? Number(encuestas.satisfaccion_promedio) : null,
                gasto_promedio: encuestas.gasto_promedio !== null ? Number(encuestas.gasto_promedio) : null,
                noches_promedio: encuestas.noches_promedio !== null ? Number(encuestas.noches_promedio) : null
            },
            ocupacion: {
                total: Number(ocupacion.total) || 0,
                ocupacion_promedio: ocupacion.ocupacion_promedio !== null ? Number(ocupacion.ocupacion_promedio) : null,
                total_huespedes: Number(ocupacion.total_huespedes) || 0,
                tarifa_promedio: ocupacion.tarifa_promedio !== null ? Number(ocupacion.tarifa_promedio) : null
            },
            paises: paisesRows.map(r => ({ pais: r.pais, total: Number(r.total) })),
            gastoPorFeriado
        });
    } catch (error) {
        console.error('Error al obtener estadísticas de reportes:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener todos los reportes
const obtenerTodos = async (req, res) => {
    try {
        const reportes = await Reporte.findAll({
            order: [['fecha_generacion', 'DESC']]
        });
        res.json(reportes);
    } catch (error) {
        console.error('Error al obtener reportes:', error);
        res.status(500).json({ error: error.message });
    }
};

// Preguntas tabulables de la Encuesta Turística que SÍ tienen columna propia en
// encuestas_turisticas (13 de las 37 del cuestionario - las otras 24 aún no las extrae el ETL,
// ver kobo_encuestas_turismo.py). Cada una define:
//  - columna: la columna real en encuestas_turisticas.
//  - esDefault(valor): identifica cuándo ese valor es el "relleno" que usa el ETL cuando NO pudo
//    leer la pregunta en el archivo original (0 para numéricas, 'Prefiero no responder' para
//    texto - la MISMA cadena que una respuesta real, ver kobo_encuestas_turismo.py líneas
//    321-328). Sin esto, esas filas se contarían como si el turista hubiera respondido eso.
//  - bucket(valor): agrupa el valor crudo en la categoría que se muestra (por ejemplo, edad
//    puntual -> rango etario). Si no se define, se usa el valor tal cual.
// Valores de texto "sucios" encontrados en más de un campo (pais_residencia, motivo_visita):
// números sueltos (probabilidades/decimales de otra columna que se cruzó de lugar en el archivo
// origen) y hasta la palabra "Porcentaje" (un encabezado que quedó como si fuera un dato). Son un
// puñado de filas en cada campo, no vale la pena adivinar a qué pregunta pertenecían realmente.
const esTextoSucio = v => v === null || v === undefined || v === ''
    || v === 'Prefiero no responder' || v === 'Porcentaje'
    // Solo descarta el valor si es UN NÚMERO COMPLETO (ej. "0.0173...") - "2-3 veces" o "1 vez"
    // también empiezan con un dígito pero son categorías reales, no deben caer aquí.
    || /^-?\d+(\.\d+)?$/.test(String(v).trim());

const PREGUNTAS_TABULABLES = [
    {
        seccion: 'Perfil Sociodemográfico', columna: 'edad', titulo: 'Edad de los encuestados',
        esDefault: v => !v || v === 0,
        bucket: v => v < 18 ? 'Menor de 18 años' : v <= 24 ? '18 a 24 años' : v <= 34 ? '25 a 34 años'
            : v <= 44 ? '35 a 44 años' : v <= 54 ? '45 a 54 años' : v <= 64 ? '55 a 64 años' : '65 años o más',
        orden: ['Menor de 18 años', '18 a 24 años', '25 a 34 años', '35 a 44 años', '45 a 54 años', '55 a 64 años', '65 años o más']
    },
    {
        seccion: 'Perfil Sociodemográfico', columna: 'genero', titulo: 'Género de los encuestados',
        esDefault: esTextoSucio
    },
    {
        seccion: 'Perfil Sociodemográfico', columna: 'pais_residencia', titulo: 'País de residencia habitual',
        esDefault: esTextoSucio, limite: 8
    },
    {
        seccion: 'Perfil Sociodemográfico', columna: 'nivel_educativo', titulo: 'Nivel más alto de estudios completado',
        esDefault: esTextoSucio
    },
    {
        seccion: 'Perfil Sociodemográfico', columna: 'ocupacion', titulo: 'Ocupación actual',
        esDefault: esTextoSucio
    },
    {
        seccion: 'Perfil Sociodemográfico', columna: 'tamano_grupo', titulo: 'Personas en el grupo de viaje',
        esDefault: v => !v || v === 0
    },
    {
        seccion: 'Planeación del Viaje', columna: 'motivo_visita', titulo: 'Motivo principal de la visita',
        esDefault: esTextoSucio
    },
    {
        seccion: 'Planeación del Viaje', columna: 'frecuencia_visitas', titulo: '¿Cuántas veces ha visitado este destino?',
        esDefault: esTextoSucio
    },
    {
        seccion: 'Planeación del Viaje', columna: 'noches_estadia', titulo: 'Noches de hospedaje',
        esDefault: v => v === null || v === undefined || v === 0
    },
    {
        seccion: 'Satisfacción', columna: 'nivel_satisfaccion', titulo: 'Satisfacción general (escala 1-5)',
        esDefault: v => !v || v === 0
    },
    {
        seccion: 'Satisfacción', columna: 'probabilidad_retorno', titulo: 'Probabilidad de recomendar/volver (escala 1-5)',
        esDefault: v => !v || v === 0
    }
];

// Tabulación pregunta por pregunta de la Encuesta Turística (como se hace en un análisis de
// tabulaciones clásico): por cada pregunta, cuántas veces se dio cada respuesta y su porcentaje.
// El porcentaje se calcula SOLO sobre las respuestas donde el ETL sí pudo leer la pregunta - las
// que quedaron con el valor de relleno se cuentan aparte, en 'sinDato', y no maquillan el % de
// ninguna opción real (ver PREGUNTAS_TABULABLES arriba).
const obtenerTabulacion = async (req, res) => {
    try {
        const filtros = {
            feriado: req.query.feriado || null,
            fechaInicio: req.query.fechaInicio || null,
            fechaFin: req.query.fechaFin || null,
            anio: req.query.anio || null
        };
        const filtro = construirFiltroFecha('fecha_encuesta', filtros);

        const [[{ totalEncuestas }]] = await sequelize.query(
            `SELECT COUNT(*) AS totalEncuestas FROM encuestas_turisticas WHERE 1=1 ${filtro.sql}`,
            { replacements: filtro.replacements }
        );

        const preguntas = [];
        for (const p of PREGUNTAS_TABULABLES) {
            const [filas] = await sequelize.query(
                `SELECT ${p.columna} AS valor, COUNT(*) AS total FROM encuestas_turisticas
                 WHERE 1=1 ${filtro.sql} GROUP BY ${p.columna}`,
                { replacements: filtro.replacements }
            );

            let sinDato = 0;
            const conteos = {};
            for (const fila of filas) {
                if (p.esDefault(fila.valor)) { sinDato += Number(fila.total); continue; }
                const etiqueta = p.bucket ? p.bucket(fila.valor) : String(fila.valor);
                conteos[etiqueta] = (conteos[etiqueta] || 0) + Number(fila.total);
            }

            const totalReal = Object.values(conteos).reduce((a, b) => a + b, 0);
            let opciones = Object.entries(conteos).map(([etiqueta, total]) => ({
                etiqueta, total,
                porcentaje: totalReal ? Math.round((total / totalReal) * 1000) / 10 : 0
            }));

            opciones = p.orden
                ? p.orden.map(e => opciones.find(o => o.etiqueta === e) || { etiqueta: e, total: 0, porcentaje: 0 })
                : opciones.sort((a, b) => b.total - a.total);
            if (p.limite) opciones = opciones.slice(0, p.limite);

            preguntas.push({
                seccion: p.seccion, titulo: p.titulo, totalReal, sinDato, opciones
            });
        }

        res.json({ filtros, totalEncuestas, preguntas });
    } catch (error) {
        console.error('Error al obtener tabulación de reportes:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener reporte por ID
const obtenerPorId = async (req, res) => {
    try {
        const reporte = await Reporte.findByPk(req.params.id);
        if (!reporte) {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }
        res.json(reporte);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear reporte
const crear = async (req, res) => {
    try {
        const reporte = await Reporte.create(req.body);
        res.status(201).json(reporte);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Eliminar reporte
const eliminar = async (req, res) => {
    try {
        const deleted = await Reporte.destroy({
            where: { id_reporte: req.params.id }
        });
        if (deleted === 0) {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }
        res.json({ mensaje: 'Reporte eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    obtenerTodos,
    obtenerPorId,
    obtenerEstadisticas,
    obtenerTabulacion,
    crear,
    eliminar
};