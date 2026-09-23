const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const catalogo = require('../seeds/lugaresSeed');
const { NOMBRES_FERIADOS, MARGEN_ANALISIS_DIAS } = require('../utils/feriados');

const clave = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const coordenadas = new Map(catalogo.map(l => [clave(l.nombre), l]));

// El feriado de una respuesta es el feriado oficial en cuyo rango ± MARGEN_ANALISIS_DIAS cae su
// fecha (misma regla, mismo margen, que usa Ocupación - ver ocupacionController.js). La encuesta
// turística no pregunta el feriado directamente, así que aquí SIEMPRE se clasifica por fecha.
const FERIADO_EFECTIVO_SQL = (columnaFecha) => `(
    SELECT f.nombre FROM feriados f
    WHERE ${columnaFecha} BETWEEN DATE_SUB(f.fecha_inicio, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY)
                              AND DATE_ADD(f.fecha_fin, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY)
    ORDER BY f.fecha_inicio LIMIT 1
)`;

// Todas las respuestas turísticas con al menos un lugar visitado, de las DOS fuentes reales:
// - respuestas_encuestas: lo que responden los encuestadores desde la app (celular).
// - encuestas_turisticas: las cargas masivas del formulario de Kobo (histórico).
// Cada una consigo su propia fecha (en hora de Ecuador) y su feriado efectivo.
const FUENTES_UNION = `
    SELECT DATE(DATE_SUB(r.fecha_encuesta, INTERVAL 5 HOUR)) AS fecha, lugar.nombre AS lugar
    FROM respuestas_encuestas r
    JOIN encuestas e ON e.id_encuesta = r.id_encuesta AND e.tipo = 'turista'
    CROSS JOIN JSON_TABLE(r.respuestas, '$.lugares_visitados[*]' COLUMNS (nombre VARCHAR(120) PATH '$')) AS lugar

    UNION ALL

    SELECT DATE(t.fecha_encuesta) AS fecha, lugar.nombre AS lugar
    FROM encuestas_turisticas t
    CROSS JOIN JSON_TABLE(t.lugares_visitados, '$[*]' COLUMNS (nombre VARCHAR(120) PATH '$')) AS lugar
    WHERE t.lugares_visitados IS NOT NULL`;

const armarLugares = (filas, totalEncuestas) =>
    filas
        .map(f => {
            const ref = coordenadas.get(clave(f.lugar));
            const visitas = Number(f.visitas);
            return {
                nombre: f.lugar,
                visitas,
                porcentaje: totalEncuestas > 0 ? Math.round((visitas / totalEncuestas) * 1000) / 10 : 0,
                lat: ref?.lat ?? null,
                lng: ref?.lng ?? null,
                canton: ref?.canton ?? null
            };
        })
        .sort((a, b) => b.visitas - a.visitas || a.nombre.localeCompare(b.nombre));

const lugaresService = {
    // Lugares que los turistas dicen haber visitado, agrupados por feriado oficial. Se muestran
    // siempre los 7 feriados del calendario (aunque alguno todavía no tenga datos), igual que en
    // Ocupación, para que se vea la estructura completa del análisis sin inventar números.
    async mapa() {
        // feriado se calcula en una subconsulta (t) y se agrupa sobre esa columna ya resuelta:
        // agrupar directamente por la expresión con subconsulta correlacionada choca con
        // ONLY_FULL_GROUP_BY (ver mismo comentario en ocupacionController.js).
        const visitas = await sequelize.query(
            `SELECT feriado, lugar, COUNT(*) AS visitas FROM (
                SELECT ${FERIADO_EFECTIVO_SQL('u.fecha')} AS feriado, u.lugar AS lugar
                FROM (${FUENTES_UNION}) u
             ) t
             GROUP BY feriado, lugar`,
            { type: QueryTypes.SELECT }
        );

        // Total de encuestas turísticas (con o sin lugares) por feriado, para el "% de turistas
        // encuestados" de cada lugar - de ambas fuentes, sin exigir que hayan marcado lugares.
        const encuestas = await sequelize.query(
            `SELECT feriado, COUNT(*) AS total FROM (
                SELECT ${FERIADO_EFECTIVO_SQL('DATE(DATE_SUB(r.fecha_encuesta, INTERVAL 5 HOUR))')} AS feriado
                FROM respuestas_encuestas r
                JOIN encuestas e ON e.id_encuesta = r.id_encuesta AND e.tipo = 'turista'
                UNION ALL
                SELECT ${FERIADO_EFECTIVO_SQL('DATE(t.fecha_encuesta)')} AS feriado
                FROM encuestas_turisticas t
             ) t2
             GROUP BY feriado`,
            { type: QueryTypes.SELECT }
        );

        const totalPorFeriado = new Map(encuestas.filter(e => e.feriado).map(e => [e.feriado, Number(e.total)]));
        const totalSinFeriado = Number(encuestas.find(e => !e.feriado)?.total || 0);

        const porFeriado = new Map();
        let sinFeriado = [];
        for (const v of visitas) {
            if (!v.feriado) { sinFeriado.push(v); continue; }
            if (!porFeriado.has(v.feriado)) porFeriado.set(v.feriado, []);
            porFeriado.get(v.feriado).push(v);
        }

        // "Todos": suma de todo lo recolectado, esté o no dentro del margen de un feriado
        const acumulado = new Map();
        for (const v of visitas) acumulado.set(v.lugar, (acumulado.get(v.lugar) || 0) + Number(v.visitas));
        const totalTodos = [...totalPorFeriado.values()].reduce((a, b) => a + b, 0) + totalSinFeriado;

        const grupo = (filas, total) => ({ encuestas: total, lugares: armarLugares(filas, total) });

        return {
            feriados: NOMBRES_FERIADOS.map(nombre => ({
                feriado: nombre,
                ...grupo(porFeriado.get(nombre) || [], totalPorFeriado.get(nombre) || 0)
            })),
            sinFeriado: grupo(sinFeriado, totalSinFeriado),
            todos: grupo([...acumulado].map(([lugar, v]) => ({ lugar, visitas: v })), totalTodos),
            lugaresSinCoordenadas: catalogo.filter(l => l.lat === null).map(l => l.nombre)
        };
    }
};

module.exports = lugaresService;
