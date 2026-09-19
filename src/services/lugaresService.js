const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const catalogo = require('../seeds/lugaresSeed');

const OFFSET_ECUADOR_H = 5;

const clave = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const coordenadas = new Map(catalogo.map(l => [clave(l.nombre), l]));

// Día local (Ecuador) de una respuesta -> jornada de recolección que lo contiene (feriado)
const JORNADA_DE_LA_RESPUESTA = `(
    SELECT j.id_jornada FROM jornadas_recoleccion j
    WHERE DATE(DATE_SUB(r.fecha_encuesta, INTERVAL ${OFFSET_ECUADOR_H} HOUR)) BETWEEN j.fecha_inicio AND j.fecha_fin
    ORDER BY j.fecha_inicio LIMIT 1
)`;

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
    // Lugares que los turistas dicen haber visitado, agrupados por feriado (jornada de recolección).
    // Se cuenta desde las encuestas turísticas guardadas por los encuestadores.
    async mapa() {
        const visitas = await sequelize.query(
            `SELECT t.id_jornada, t.lugar, COUNT(*) AS visitas
             FROM (
                SELECT ${JORNADA_DE_LA_RESPUESTA} AS id_jornada, lugar.nombre AS lugar
                FROM respuestas_encuestas r
                JOIN encuestas e ON e.id_encuesta = r.id_encuesta AND e.tipo = 'turista'
                CROSS JOIN JSON_TABLE(r.respuestas, '$.lugares_visitados[*]'
                           COLUMNS (nombre VARCHAR(120) PATH '$')) AS lugar
             ) t
             GROUP BY t.id_jornada, t.lugar`,
            { type: QueryTypes.SELECT }
        );

        const encuestas = await sequelize.query(
            `SELECT ${JORNADA_DE_LA_RESPUESTA} AS id_jornada, COUNT(*) AS total
             FROM respuestas_encuestas r
             JOIN encuestas e ON e.id_encuesta = r.id_encuesta AND e.tipo = 'turista'
             WHERE JSON_LENGTH(JSON_EXTRACT(r.respuestas, '$.lugares_visitados')) > 0
             GROUP BY id_jornada`,
            { type: QueryTypes.SELECT }
        );

        const jornadas = await sequelize.query(
            `SELECT id_jornada, feriado, fecha_inicio, fecha_fin FROM jornadas_recoleccion ORDER BY fecha_inicio DESC`,
            { type: QueryTypes.SELECT }
        );

        const totalPorJornada = new Map(encuestas.map(e => [e.id_jornada, Number(e.total)]));
        const clavesJornada = (id) => (id === null ? 'fuera' : String(id));

        const porJornada = new Map();
        for (const v of visitas) {
            const k = clavesJornada(v.id_jornada);
            if (!porJornada.has(k)) porJornada.set(k, []);
            porJornada.get(k).push(v);
        }

        // "Todos": suma de todos los feriados y de lo recolectado fuera de una jornada
        const acumulado = new Map();
        for (const v of visitas) acumulado.set(v.lugar, (acumulado.get(v.lugar) || 0) + Number(v.visitas));
        const totalTodos = [...totalPorJornada.values()].reduce((a, b) => a + b, 0);

        const grupo = (filas, total) => ({ encuestas: total, lugares: armarLugares(filas, total) });

        return {
            jornadas: jornadas.map(j => {
                const total = totalPorJornada.get(j.id_jornada) || 0;
                return {
                    id: j.id_jornada,
                    feriado: j.feriado,
                    anio: String(j.fecha_inicio).slice(0, 4),
                    fechaInicio: j.fecha_inicio,
                    fechaFin: j.fecha_fin,
                    ...grupo(porJornada.get(String(j.id_jornada)) || [], total)
                };
            }),
            fueraDeJornada: grupo(porJornada.get('fuera') || [], totalPorJornada.get(null) || 0),
            todos: grupo([...acumulado].map(([lugar, v]) => ({ lugar, visitas: v })), totalTodos),
            lugaresSinCoordenadas: catalogo.filter(l => l.lat === null).map(l => l.nombre)
        };
    }
};

module.exports = lugaresService;
