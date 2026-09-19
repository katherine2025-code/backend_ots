const { Op, fn, col, QueryTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { Encuesta, EncuestaPregunta, RespuestaEncuesta, Usuario } = require('../models');

class ErrorRespuesta extends Error {
    constructor(mensaje, status = 400) {
        super(mensaje);
        this.status = status;
    }
}

const estaVacia = (valor) =>
    valor === undefined || valor === null ||
    (typeof valor === 'string' && valor.trim() === '') ||
    (Array.isArray(valor) && valor.length === 0);

const normalizar = (valor) => {
    if (Array.isArray(valor)) return valor.map(v => String(v).trim()).filter(Boolean);
    return typeof valor === 'string' ? valor.trim() : valor;
};

// Fecha de captura enviada por el dispositivo (puede haberse llenado sin conexión).
// Si no es válida o es futura, se usa el momento actual del servidor.
const resolverFecha = (fecha) => {
    const f = fecha ? new Date(fecha) : null;
    const ahora = new Date();
    if (!f || isNaN(f.getTime()) || f.getTime() > ahora.getTime() + 24 * 3600 * 1000) return ahora;
    return f;
};

const escaparCSV = (valor) => {
    let texto = Array.isArray(valor) ? valor.join(' | ') : (valor ?? '');
    texto = String(texto);
    return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

// Ecuador continental no tiene horario de verano: UTC-5 fijo.
const aHoraEcuador = (fecha) =>
    new Date(new Date(fecha).getTime() - 5 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

const filtroFechas = (desde, hasta) => {
    if (!desde && !hasta) return {};
    const rango = {};
    if (desde) rango[Op.gte] = new Date(`${desde}T00:00:00`);
    if (hasta) rango[Op.lte] = new Date(`${hasta}T23:59:59.999`);
    return { fecha_encuesta: rango };
};

const respuestaService = {
    ErrorRespuesta,

    // Guarda una encuesta llenada por un encuestador. Valida contra el cuestionario vigente.
    async registrar(idUsuario, { tipo, respuestas, fecha, uuid }) {
        if (!['turista', 'hotel'].includes(tipo)) throw new ErrorRespuesta('Tipo de encuesta no válido');
        if (!respuestas || typeof respuestas !== 'object' || Array.isArray(respuestas)) {
            throw new ErrorRespuesta('Las respuestas son obligatorias');
        }

        // Reintento de un envío que ya se había guardado: no se duplica
        if (uuid) {
            const existente = await RespuestaEncuesta.findOne({ where: { uuid_cliente: uuid } });
            if (existente) return { id: existente.id_respuesta, duplicada: true };
        }

        const encuesta = await Encuesta.findOne({
            where: { tipo },
            include: { model: EncuestaPregunta, as: 'preguntas' }
        });
        if (!encuesta) throw new ErrorRespuesta('Encuesta no encontrada', 404);
        if (!encuesta.activa) throw new ErrorRespuesta('Esta encuesta está inactiva', 403);

        // Solo se guardan respuestas a preguntas que existen en el cuestionario
        const limpias = {};
        const faltantes = [];
        for (const pregunta of encuesta.preguntas) {
            const valor = respuestas[pregunta.codigo];
            if (estaVacia(valor)) {
                if (pregunta.obligatoria) faltantes.push(pregunta.texto);
                continue;
            }
            const limpio = normalizar(valor);

            if (pregunta.tipo === 'number' && !Number.isFinite(Number(limpio))) {
                throw new ErrorRespuesta(`"${pregunta.texto}": debe ser un número`);
            }
            if (pregunta.tipo === 'date') {
                const valida = /^\d{4}-\d{2}-\d{2}$/.test(limpio) && !isNaN(new Date(`${limpio}T00:00:00`).getTime());
                if (!valida) throw new ErrorRespuesta(`"${pregunta.texto}": fecha no válida (use AAAA-MM-DD)`);
            }

            limpias[pregunta.codigo] = limpio;
        }
        if (faltantes.length > 0) {
            throw new ErrorRespuesta(`Faltan ${faltantes.length} preguntas obligatorias por responder`);
        }

        const registro = await RespuestaEncuesta.create({
            id_encuesta: encuesta.id_encuesta,
            id_usuario: idUsuario,
            uuid_cliente: uuid || null,
            fecha_encuesta: resolverFecha(fecha),
            respuestas: limpias
        });
        return { id: registro.id_respuesta, duplicada: false };
    },

    // Listado para administradores/investigadores (más recientes primero)
    async listar({ tipo, desde, hasta, limite = 200 }) {
        const encuestaWhere = tipo ? { tipo } : undefined;
        const filas = await RespuestaEncuesta.findAll({
            where: filtroFechas(desde, hasta),
            include: [
                { model: Encuesta, as: 'encuesta', attributes: ['tipo', 'nombre'], where: encuestaWhere, required: true },
                { model: Usuario, attributes: ['nombres', 'apellidos'], required: false }
            ],
            order: [['fecha_encuesta', 'DESC']],
            limit: Math.min(parseInt(limite) || 200, 1000)
        });
        return filas.map(f => ({
            id: f.id_respuesta,
            tipo: f.encuesta.tipo,
            encuesta: f.encuesta.nombre,
            encuestador: f.usuario ? `${f.usuario.nombres} ${f.usuario.apellidos}` : null,
            fecha: f.fecha_encuesta,
            respuestas: f.respuestas
        }));
    },

    // CSV con el mismo formato que exporta el encuestador (listo para el módulo ETL)
    async exportarCSV({ tipo, desde, hasta }) {
        if (!['turista', 'hotel'].includes(tipo)) throw new ErrorRespuesta('Indica el tipo de encuesta (turista u hotel)');

        const encuesta = await Encuesta.findOne({
            where: { tipo },
            include: { model: EncuestaPregunta, as: 'preguntas' }
        });
        if (!encuesta) throw new ErrorRespuesta('Encuesta no encontrada', 404);

        const preguntas = encuesta.preguntas.slice().sort((a, b) => a.orden - b.orden);
        const filas = await RespuestaEncuesta.findAll({
            where: { id_encuesta: encuesta.id_encuesta, ...filtroFechas(desde, hasta) },
            order: [['fecha_encuesta', 'ASC']]
        });

        // id_respuesta permite que el ETL no cargue dos veces la misma encuesta;
        // la fecha va en hora de Ecuador (UTC-5) para que un día no se corra por la zona horaria.
        const encabezado = ['id_respuesta', 'fecha_encuesta', 'tipo_encuesta', ...preguntas.map(p => p.codigo)];
        const lineas = filas.map(f => [
            f.id_respuesta,
            aHoraEcuador(f.fecha_encuesta),
            tipo,
            ...preguntas.map(p => f.respuestas[p.codigo] ?? '')
        ].map(escaparCSV).join(';'));

        // BOM para que Excel respete los acentos
        return '﻿' + [encabezado.join(';'), ...lineas].join('\r\n');
    },

    // sync() no modifica tablas que ya existen: si la tabla se creó antes de que existiera
    // la columna fecha_etl, se agrega aquí (idempotente) para no depender de un script manual.
    async asegurarEsquema() {
        const [existe] = await sequelize.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'respuestas_encuestas' AND COLUMN_NAME = 'fecha_etl'`,
            { type: QueryTypes.SELECT }
        );
        if (Number(existe.n) === 0) {
            await sequelize.query('ALTER TABLE respuestas_encuestas ADD COLUMN fecha_etl DATETIME NULL');
            console.log('Columna respuestas_encuestas.fecha_etl agregada');
        }
    },

    // { id_encuesta: total } para mostrar cuántas respuestas lleva cada encuesta
    async contarPorEncuesta() {
        const filas = await RespuestaEncuesta.findAll({
            attributes: ['id_encuesta', [fn('COUNT', col('id_respuesta')), 'total']],
            group: ['id_encuesta'],
            raw: true
        });
        return Object.fromEntries(filas.map(f => [f.id_encuesta, parseInt(f.total)]));
    }
};

module.exports = respuestaService;
