const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { JornadaRecoleccion, CronogramaEncuesta, Usuario } = require('../models');

const ROL_ENCUESTADOR = 3;
const MAX_DIAS = 5;          // un feriado dura de 1 a 5 días
const MAX_META = 1000;
const OFFSET_ECUADOR_H = 5;  // Ecuador continental: UTC-5, sin horario de verano

class ErrorCronograma extends Error {
    constructor(mensaje, status = 400) {
        super(mensaje);
        this.status = status;
    }
}

// ---------- Fechas (siempre como 'YYYY-MM-DD') ----------
const hoyEcuador = () => new Date(Date.now() - OFFSET_ECUADOR_H * 3600 * 1000).toISOString().slice(0, 10);

const sumarDias = (fecha, n) => {
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};

const listaDeDias = (inicio, fin) => {
    const dias = [];
    for (let f = inicio; f <= fin; f = sumarDias(f, 1)) dias.push(f);
    return dias;
};

const fechaValida = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || '') && !isNaN(new Date(`${f}T00:00:00Z`).getTime());

const entero = (valor, campo) => {
    const n = Number(valor === '' || valor === undefined || valor === null ? 0 : valor);
    if (!Number.isInteger(n) || n < 0 || n > MAX_META) {
        throw new ErrorCronograma(`${campo} debe ser un número entero entre 0 y ${MAX_META}`);
    }
    return n;
};

// ---------- Avance real: encuestas guardadas por encuestador, día (hora Ecuador) y tipo ----------
// Se cuenta directamente de respuestas_encuestas, así el avance es en vivo (sin tabla intermedia).
const contarAvance = async (fechaInicio, fechaFin) => {
    const filas = await sequelize.query(
        `SELECT r.id_usuario,
                DATE_FORMAT(DATE_SUB(r.fecha_encuesta, INTERVAL ${OFFSET_ECUADOR_H} HOUR), '%Y-%m-%d') AS dia,
                e.tipo, COUNT(*) AS total
         FROM respuestas_encuestas r
         JOIN encuestas e ON e.id_encuesta = r.id_encuesta
         WHERE r.id_usuario IS NOT NULL
           AND r.fecha_encuesta >= :ini AND r.fecha_encuesta < :fin
         GROUP BY r.id_usuario, dia, e.tipo`,
        {
            // 00:00 en Ecuador = 05:00 UTC (las fechas se guardan en UTC)
            replacements: {
                ini: `${fechaInicio} 05:00:00`,
                fin: `${sumarDias(fechaFin, 1)} 05:00:00`
            },
            type: QueryTypes.SELECT
        }
    );
    // { id_usuario: { 'YYYY-MM-DD': { turista, hotel } } }
    const avance = {};
    for (const f of filas) {
        const porDia = (avance[f.id_usuario] ||= {});
        const celda = (porDia[f.dia] ||= { turista: 0, hotel: 0 });
        celda[f.tipo] = Number(f.total);
    }
    return avance;
};

const nombreDe = (u) => (u ? `${u.nombres} ${u.apellidos}` : 'Encuestador');

const cronogramaService = {
    ErrorCronograma,
    hoyEcuador,

    async listarEncuestadores() {
        const usuarios = await Usuario.findAll({
            where: { id_rol: ROL_ENCUESTADOR, estado: 1 },
            attributes: ['id_usuario', 'nombres', 'apellidos'],
            order: [['nombres', 'ASC']]
        });
        return usuarios.map(u => ({ id: u.id_usuario, nombre: nombreDe(u) }));
    },

    async listarJornadas() {
        const jornadas = await JornadaRecoleccion.findAll({
            include: { model: CronogramaEncuesta, as: 'asignaciones', attributes: ['id_usuario'] },
            order: [['fecha_inicio', 'DESC']]
        });
        const hoy = hoyEcuador();
        return jornadas.map(j => ({
            id: j.id_jornada,
            feriado: j.feriado,
            fechaInicio: j.fecha_inicio,
            fechaFin: j.fecha_fin,
            encuestadores: new Set(j.asignaciones.map(a => a.id_usuario)).size,
            estado: hoy < j.fecha_inicio ? 'programada' : hoy > j.fecha_fin ? 'finalizada' : 'en_curso'
        }));
    },

    // Crea la jornada y una meta diaria por cada encuestador seleccionado
    async crearJornada(idCreador, { feriado, fecha_inicio, dias, encuestadores, meta_turista, meta_hotel }) {
        const nombre = (feriado || '').toString().trim();
        if (!nombre) throw new ErrorCronograma('Indica el feriado');
        if (!fechaValida(fecha_inicio)) throw new ErrorCronograma('La fecha de inicio no es válida');
        const totalDias = Number(dias);
        if (!Number.isInteger(totalDias) || totalDias < 1 || totalDias > MAX_DIAS) {
            throw new ErrorCronograma(`La jornada debe durar entre 1 y ${MAX_DIAS} días`);
        }
        if (!Array.isArray(encuestadores) || encuestadores.length === 0) {
            throw new ErrorCronograma('Selecciona al menos un encuestador');
        }
        const metaT = entero(meta_turista, 'La meta de encuestas turísticas');
        const metaH = entero(meta_hotel, 'La meta de encuestas de hoteles');

        const ids = [...new Set(encuestadores.map(Number))];
        const validos = await Usuario.count({ where: { id_usuario: ids, id_rol: ROL_ENCUESTADOR, estado: 1 } });
        if (validos !== ids.length) throw new ErrorCronograma('Alguno de los usuarios seleccionados no es un encuestador activo');

        const fechaFin = sumarDias(fecha_inicio, totalDias - 1);
        const jornada = await sequelize.transaction(async (transaction) => {
            const j = await JornadaRecoleccion.create(
                { feriado: nombre, fecha_inicio, fecha_fin: fechaFin, creado_por: idCreador }, { transaction });
            const filas = [];
            for (const id_usuario of ids) {
                for (const fecha of listaDeDias(fecha_inicio, fechaFin)) {
                    filas.push({ id_jornada: j.id_jornada, id_usuario, fecha, meta_turista: metaT, meta_hotel: metaH });
                }
            }
            await CronogramaEncuesta.bulkCreate(filas, { transaction });
            return j;
        });
        return { id: jornada.id_jornada };
    },

    // Cambia la meta de un encuestador en un día (0 y 0 = ese día no trabaja)
    async actualizarMeta(idJornada, { id_usuario, fecha, meta_turista, meta_hotel }) {
        const jornada = await JornadaRecoleccion.findByPk(idJornada);
        if (!jornada) throw new ErrorCronograma('Jornada no encontrada', 404);
        if (!fechaValida(fecha) || fecha < jornada.fecha_inicio || fecha > jornada.fecha_fin) {
            throw new ErrorCronograma('El día está fuera de la jornada');
        }
        const metaT = entero(meta_turista, 'La meta de encuestas turísticas');
        const metaH = entero(meta_hotel, 'La meta de encuestas de hoteles');

        const existente = await CronogramaEncuesta.findOne({ where: { id_jornada: idJornada, id_usuario, fecha } });
        if (existente) {
            await existente.update({ meta_turista: metaT, meta_hotel: metaH });
        } else {
            const valido = await Usuario.count({ where: { id_usuario, id_rol: ROL_ENCUESTADOR, estado: 1 } });
            if (!valido) throw new ErrorCronograma('El usuario no es un encuestador activo');
            await CronogramaEncuesta.create({ id_jornada: idJornada, id_usuario, fecha, meta_turista: metaT, meta_hotel: metaH });
        }
        return { ok: true };
    },

    // Agrega un encuestador a una jornada existente (mismas metas para todos los días)
    async agregarEncuestador(idJornada, { id_usuario, meta_turista, meta_hotel }) {
        const jornada = await JornadaRecoleccion.findByPk(idJornada);
        if (!jornada) throw new ErrorCronograma('Jornada no encontrada', 404);
        const valido = await Usuario.count({ where: { id_usuario, id_rol: ROL_ENCUESTADOR, estado: 1 } });
        if (!valido) throw new ErrorCronograma('El usuario no es un encuestador activo');
        const yaEsta = await CronogramaEncuesta.count({ where: { id_jornada: idJornada, id_usuario } });
        if (yaEsta) throw new ErrorCronograma('Ese encuestador ya está en la jornada');

        const metaT = entero(meta_turista, 'La meta de encuestas turísticas');
        const metaH = entero(meta_hotel, 'La meta de encuestas de hoteles');
        await CronogramaEncuesta.bulkCreate(
            listaDeDias(jornada.fecha_inicio, jornada.fecha_fin).map(fecha => (
                { id_jornada: idJornada, id_usuario, fecha, meta_turista: metaT, meta_hotel: metaH }))
        );
        return { ok: true };
    },

    async eliminarJornada(idJornada) {
        const borradas = await JornadaRecoleccion.destroy({ where: { id_jornada: idJornada } });
        if (!borradas) throw new ErrorCronograma('Jornada no encontrada', 404);
        return { ok: true };
    },

    // Matriz en vivo para admin/super_admin: encuestadores x días, con meta y avance real
    async avanceDeJornada(idJornada) {
        const jornada = await JornadaRecoleccion.findByPk(idJornada, {
            include: { model: CronogramaEncuesta, as: 'asignaciones',
                       include: { model: Usuario, as: 'encuestador', attributes: ['id_usuario', 'nombres', 'apellidos'] } }
        });
        if (!jornada) throw new ErrorCronograma('Jornada no encontrada', 404);

        const dias = listaDeDias(jornada.fecha_inicio, jornada.fecha_fin);
        const avance = await contarAvance(jornada.fecha_inicio, jornada.fecha_fin);
        const hoy = hoyEcuador();

        const porUsuario = new Map();
        for (const a of jornada.asignaciones) {
            if (!porUsuario.has(a.id_usuario)) porUsuario.set(a.id_usuario, { nombre: nombreDe(a.encuestador), metas: {} });
            porUsuario.get(a.id_usuario).metas[a.fecha] = a;
        }
        // Quien encuestó dentro de la jornada sin estar asignado también aparece (trabajo no planificado)
        const sinAsignar = Object.keys(avance).map(Number).filter(id => !porUsuario.has(id));
        if (sinAsignar.length) {
            const extras = await Usuario.findAll({ where: { id_usuario: sinAsignar }, attributes: ['id_usuario', 'nombres', 'apellidos'] });
            for (const u of extras) porUsuario.set(u.id_usuario, { nombre: nombreDe(u), metas: {}, sinAsignar: true });
        }

        const filas = [...porUsuario.entries()].map(([id, info]) => {
            let metaTotal = 0, hechoTotal = 0, hechoHoy = 0, metaHoy = 0;
            const porDia = {};
            for (const fecha of dias) {
                const meta = info.metas[fecha];
                const hecho = avance[id]?.[fecha] || { turista: 0, hotel: 0 };
                const celda = {
                    metaTurista: meta?.meta_turista || 0, metaHotel: meta?.meta_hotel || 0,
                    hechoTurista: hecho.turista, hechoHotel: hecho.hotel
                };
                porDia[fecha] = celda;
                metaTotal += celda.metaTurista + celda.metaHotel;
                hechoTotal += celda.hechoTurista + celda.hechoHotel;
                if (fecha === hoy) {
                    hechoHoy = celda.hechoTurista + celda.hechoHotel;
                    metaHoy = celda.metaTurista + celda.metaHotel;
                }
            }
            return { id, nombre: info.nombre, sinAsignar: !!info.sinAsignar, dias: porDia, metaTotal, hechoTotal, metaHoy, hechoHoy };
        }).sort((a, b) => b.hechoTotal - a.hechoTotal || a.nombre.localeCompare(b.nombre));

        const totales = filas.reduce((t, f) => ({
            meta: t.meta + f.metaTotal, hecho: t.hecho + f.hechoTotal, metaHoy: t.metaHoy + f.metaHoy, hechoHoy: t.hechoHoy + f.hechoHoy
        }), { meta: 0, hecho: 0, metaHoy: 0, hechoHoy: 0 });

        return {
            actualizado: new Date().toISOString(),
            hoy,
            jornada: { id: jornada.id_jornada, feriado: jornada.feriado, fechaInicio: jornada.fecha_inicio, fechaFin: jornada.fecha_fin },
            dias,
            encuestadores: filas,
            totales
        };
    },

    // Resumen para el dashboard: la jornada en curso; si no hay, la próxima; si no, la más reciente
    async resumen() {
        const jornadas = await this.listarJornadas();
        const elegida =
            jornadas.find(j => j.estado === 'en_curso') ||
            jornadas.filter(j => j.estado === 'programada').sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))[0] ||
            jornadas[0];
        if (!elegida) return { jornada: null };
        return { ...(await this.avanceDeJornada(elegida.id)), estado: elegida.estado };
    },

    // Cronograma propio del encuestador (solo lectura): la jornada de hoy, la próxima o la última
    async miCronograma(idUsuario) {
        const hoy = hoyEcuador();
        const asignaciones = await CronogramaEncuesta.findAll({
            where: { id_usuario: idUsuario },
            include: { model: JornadaRecoleccion, as: 'jornada' },
            order: [['fecha', 'ASC']]
        });
        if (asignaciones.length === 0) return { hoy, jornada: null };

        const jornadas = new Map();
        for (const a of asignaciones) jornadas.set(a.id_jornada, a.jornada);
        const lista = [...jornadas.values()];
        const elegida =
            lista.find(j => j.fecha_inicio <= hoy && hoy <= j.fecha_fin) ||
            lista.filter(j => j.fecha_inicio > hoy).sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))[0] ||
            lista.sort((a, b) => b.fecha_fin.localeCompare(a.fecha_fin))[0];

        const avance = (await contarAvance(elegida.fecha_inicio, elegida.fecha_fin))[idUsuario] || {};
        const metas = Object.fromEntries(asignaciones.filter(a => a.id_jornada === elegida.id_jornada).map(a => [a.fecha, a]));

        let metaTotal = 0, hechoTotal = 0;
        const dias = listaDeDias(elegida.fecha_inicio, elegida.fecha_fin).map(fecha => {
            const m = metas[fecha];
            const h = avance[fecha] || { turista: 0, hotel: 0 };
            const metaTurista = m?.meta_turista || 0, metaHotel = m?.meta_hotel || 0;
            const meta = metaTurista + metaHotel, hecho = h.turista + h.hotel;
            metaTotal += meta; hechoTotal += hecho;

            let estado;
            if (meta === 0) estado = 'libre';
            else if (hecho >= meta) estado = 'cumplida';
            else if (fecha > hoy) estado = 'pendiente';
            else if (fecha === hoy) estado = 'hoy';
            else estado = 'incompleta';

            return { fecha, esHoy: fecha === hoy, estado, metaTurista, metaHotel, hechoTurista: h.turista, hechoHotel: h.hotel };
        });

        return {
            hoy,
            jornada: { id: elegida.id_jornada, feriado: elegida.feriado, fechaInicio: elegida.fecha_inicio, fechaFin: elegida.fecha_fin },
            dias,
            hoyDia: dias.find(d => d.esHoy) || null,
            totales: { meta: metaTotal, hecho: hechoTotal }
        };
    }
};

module.exports = cronogramaService;
