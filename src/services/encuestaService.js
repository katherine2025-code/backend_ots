const { sequelize } = require('../config/db');
const { Encuesta, EncuestaPregunta } = require('../models');
const seed = require('../seeds/encuestasSeed');

const TIPOS_PREGUNTA = ['text', 'email', 'number', 'date', 'select', 'multiselect', 'escala'];
const TIPOS_CON_OPCIONES = ['select', 'multiselect', 'escala'];

class ErrorValidacion extends Error { }

const formatearPregunta = (p) => ({
    id: p.id_pregunta,
    codigo: p.codigo,
    texto: p.texto,
    tipo: p.tipo,
    seccion: p.seccion,
    obligatoria: p.obligatoria,
    orden: p.orden,
    opciones: p.opciones || undefined,
    maxLength: p.max_length || undefined,
    valorDefault: p.valor_default || undefined
});

const formatearEncuesta = (e, conPreguntas = true) => {
    const preguntas = (e.preguntas || []).slice().sort((a, b) => a.orden - b.orden);
    const salida = {
        id: e.id_encuesta,
        nombre: e.nombre,
        descripcion: e.descripcion,
        tipo: e.tipo,
        activa: e.activa,
        fechaCreacion: e.created_at,
        totalPreguntas: preguntas.length
    };
    if (conPreguntas) salida.preguntas = preguntas.map(formatearPregunta);
    return salida;
};

const includePreguntas = { model: EncuestaPregunta, as: 'preguntas' };

// Normaliza y valida las preguntas recibidas del editor. Devuelve filas listas para insertar.
const prepararPreguntas = (preguntas, idEncuesta) => {
    if (!Array.isArray(preguntas) || preguntas.length === 0) {
        throw new ErrorValidacion('La encuesta debe tener al menos una pregunta');
    }

    const usados = new Set(preguntas.map(p => (p.codigo || '').toString().trim()).filter(Boolean));
    let contador = 0;
    const nuevoCodigo = () => {
        let codigo;
        do { codigo = `pregunta_${++contador}`; } while (usados.has(codigo));
        usados.add(codigo);
        return codigo;
    };

    const vistos = new Set();
    return preguntas.map((p, i) => {
        const texto = (p.texto || '').toString().trim();
        const seccion = (p.seccion || '').toString().trim();
        const tipo = p.tipo;
        const posicion = `Pregunta ${i + 1}`;

        if (!texto) throw new ErrorValidacion(`${posicion}: el texto es obligatorio`);
        if (!seccion) throw new ErrorValidacion(`${posicion}: la sección es obligatoria`);
        if (!TIPOS_PREGUNTA.includes(tipo)) throw new ErrorValidacion(`${posicion}: tipo de respuesta no válido`);

        const codigo = (p.codigo || '').toString().trim() || nuevoCodigo();
        if (vistos.has(codigo)) throw new ErrorValidacion(`${posicion}: el código "${codigo}" está repetido`);
        vistos.add(codigo);

        let opciones = null;
        if (TIPOS_CON_OPCIONES.includes(tipo)) {
            opciones = (Array.isArray(p.opciones) ? p.opciones : [])
                .map(o => (o ?? '').toString().trim())
                .filter(Boolean);
            if (opciones.length === 0) {
                throw new ErrorValidacion(`${posicion}: debe tener al menos una respuesta`);
            }
        }

        return {
            id_encuesta: idEncuesta,
            codigo,
            texto,
            tipo,
            seccion,
            obligatoria: !!p.obligatoria,
            orden: i,
            opciones,
            max_length: p.maxLength || p.max_length || null,
            valor_default: p.valorDefault || p.valor_default || null
        };
    });
};

const encuestaService = {
    ErrorValidacion,

    async listar() {
        const encuestas = await Encuesta.findAll({ include: includePreguntas, order: [['id_encuesta', 'ASC']] });
        const totales = await require('./respuestaService').contarPorEncuesta();
        return encuestas.map(e => ({ ...formatearEncuesta(e, false), totalRespuestas: totales[e.id_encuesta] || 0 }));
    },

    async obtener(id) {
        const encuesta = await Encuesta.findByPk(id, { include: includePreguntas });
        return encuesta ? formatearEncuesta(encuesta) : null;
    },

    async obtenerPorTipo(tipo) {
        const encuesta = await Encuesta.findOne({ where: { tipo }, include: includePreguntas });
        return encuesta ? formatearEncuesta(encuesta) : null;
    },

    // Actualiza datos generales y reemplaza el listado de preguntas/respuestas.
    // El tipo (turista/hotel) no se modifica: identifica al cuestionario.
    async actualizar(id, datos) {
        const nombre = (datos.nombre || '').toString().trim();
        if (!nombre) throw new ErrorValidacion('El nombre de la encuesta es obligatorio');

        return sequelize.transaction(async (transaction) => {
            const encuesta = await Encuesta.findByPk(id, { transaction });
            if (!encuesta) return null;

            await encuesta.update({
                nombre,
                descripcion: (datos.descripcion || '').toString().trim() || null,
                activa: datos.activa === undefined ? encuesta.activa : !!datos.activa
            }, { transaction });

            if (datos.preguntas !== undefined) {
                const filas = prepararPreguntas(datos.preguntas, encuesta.id_encuesta);
                await EncuestaPregunta.destroy({ where: { id_encuesta: encuesta.id_encuesta }, transaction });
                await EncuestaPregunta.bulkCreate(filas, { transaction });
            }

            const actualizada = await Encuesta.findByPk(id, { include: includePreguntas, transaction });
            return formatearEncuesta(actualizada);
        });
    },

    async cambiarEstado(id, activa) {
        const encuesta = await Encuesta.findByPk(id, { include: includePreguntas });
        if (!encuesta) return null;
        await encuesta.update({ activa: !!activa });
        return formatearEncuesta(encuesta, false);
    },

    // El cuestionario de hoteles original solo tenía "Fecha 1" y no preguntaba cantón ni feriado.
    // Si la base todavía tiene esa versión (no tiene ninguna de las tres preguntas nuevas), se
    // reemplaza por la versión actual del seed. Si el administrador ya lo editó y conserva alguna
    // de ellas, no se toca.
    async actualizarCuestionarioHotel() {
        const encuesta = await Encuesta.findOne({ where: { tipo: 'hotel' } });
        if (!encuesta) return false;

        const nuevas = await EncuestaPregunta.count({
            where: { id_encuesta: encuesta.id_encuesta, codigo: ['canton', 'feriado', 'fecha1_fecha'] }
        });
        if (nuevas > 0) return false;

        const definicion = seed.find(e => e.tipo === 'hotel');
        await sequelize.transaction(async (transaction) => {
            await EncuestaPregunta.destroy({ where: { id_encuesta: encuesta.id_encuesta }, transaction });
            await EncuestaPregunta.bulkCreate(prepararPreguntas(definicion.preguntas, encuesta.id_encuesta), { transaction });
            await encuesta.update({ descripcion: definicion.descripcion }, { transaction });
        });
        console.log('Cuestionario de hoteles actualizado: cantón, feriado y 5 fechas');
        return true;
    },

    // La pregunta "feriado" del cuestionario de hoteles debe ofrecer exactamente los 7 feriados
    // del calendario oficial (utils/feriados.js) - mismos nombres que usa el filtro de Ocupación
    // y la tabla `feriados`, para que un feriado elegido en el campo se pueda cruzar con el resto
    // del sistema. Solo actualiza esa pregunta puntual (no toca las demás si el admin las editó).
    async actualizarOpcionesFeriado() {
        const { NOMBRES_FERIADOS } = require('../utils/feriados');
        const pregunta = await EncuestaPregunta.findOne({
            include: { model: Encuesta, attributes: [], where: { tipo: 'hotel' } },
            where: { codigo: 'feriado' }
        });
        if (!pregunta) return false;

        const actuales = JSON.stringify(pregunta.opciones || []);
        const canonicas = JSON.stringify(NOMBRES_FERIADOS);
        if (actuales === canonicas) return false;

        await pregunta.update({ opciones: NOMBRES_FERIADOS });
        console.log('Opciones de la pregunta "feriado" actualizadas al calendario oficial 2026');
        return true;
    },

    // Carga los cuestionarios iniciales si todavía no existen encuestas.
    async sembrarSiVacio() {
        if (await Encuesta.count() > 0) return false;

        await sequelize.transaction(async (transaction) => {
            for (const def of seed) {
                const encuesta = await Encuesta.create({
                    nombre: def.nombre,
                    descripcion: def.descripcion,
                    tipo: def.tipo,
                    activa: def.activa
                }, { transaction });
                await EncuestaPregunta.bulkCreate(prepararPreguntas(def.preguntas, encuesta.id_encuesta), { transaction });
            }
        });
        console.log('Encuestas iniciales cargadas en la base de datos');
        return true;
    }
};

module.exports = encuestaService;
