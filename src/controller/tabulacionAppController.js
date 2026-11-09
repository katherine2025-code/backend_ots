// Tabulación pregunta por pregunta leída DIRECTAMENTE de los datos de la app propia
// (tabla respuestas_encuestas), NO del ETL/Kobo. Como la app guarda cada respuesta con el
// código exacto de su pregunta ({ codigo: valor | [valores] }), aquí se tabulan TODAS las
// preguntas del cuestionario, sin la ambigüedad del formato de exportación de Kobo.
const { Op } = require('sequelize');
const Encuesta = require('../models/Encuesta');
const EncuestaPregunta = require('../models/EncuestaPregunta');
const RespuestaEncuesta = require('../models/RespuestaEncuesta');

const redondear1 = (n) => Math.round(n * 10) / 10;
const CATEGORICAS = new Set(['select', 'multiselect', 'escala']);

// Las opciones de una pregunta pueden venir como ["a","b"] o [{valor|etiqueta|texto}];
// se normalizan a una lista de strings para respetar su orden en la tabulación.
function normalizarOpciones(opciones) {
    if (!Array.isArray(opciones)) return [];
    return opciones
        .map((o) => {
            if (o == null) return null;
            if (typeof o === 'string') return o.trim();
            return String(o.valor ?? o.etiqueta ?? o.texto ?? o.label ?? '').trim();
        })
        .filter(Boolean);
}

const obtenerTabulacionApp = async (req, res) => {
    try {
        const tipo = req.query.tipo === 'hotel' ? 'hotel' : 'turista';
        const { fechaInicio, fechaFin } = req.query;

        // Cuestionario vigente de ese tipo (hay uno por tipo: Encuesta.tipo es unique).
        const encuesta = await Encuesta.findOne({ where: { tipo } });
        if (!encuesta) return res.json({ tipo, encuesta: null, total: 0, secciones: [] });

        const preguntas = await EncuestaPregunta.findAll({
            where: { id_encuesta: encuesta.id_encuesta },
            order: [['orden', 'ASC']]
        });

        const where = { id_encuesta: encuesta.id_encuesta };
        if (fechaInicio || fechaFin) {
            where.fecha_encuesta = {};
            if (fechaInicio) where.fecha_encuesta[Op.gte] = `${fechaInicio} 00:00:00`;
            if (fechaFin) where.fecha_encuesta[Op.lte] = `${fechaFin} 23:59:59`;
        }
        const respuestas = await RespuestaEncuesta.findAll({ where, attributes: ['respuestas'] });
        const total = respuestas.length;

        const porSeccion = new Map();

        for (const p of preguntas) {
            const conteos = {};
            let respondidas = 0;
            const numeros = [];

            for (const r of respuestas) {
                const data = r.respuestas || {};
                const v = data[p.codigo];
                if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
                respondidas++;

                if (Array.isArray(v)) {
                    // multiselect: se cuenta cada opción marcada
                    for (const it of v) {
                        const k = String(it).trim();
                        if (k) conteos[k] = (conteos[k] || 0) + 1;
                    }
                } else {
                    const k = String(v).trim();
                    conteos[k] = (conteos[k] || 0) + 1;
                    if (p.tipo === 'number') {
                        const n = Number(v);
                        if (!Number.isNaN(n)) numeros.push(n);
                    }
                }
            }

            const item = {
                codigo: p.codigo,
                titulo: p.texto,
                tipo: p.tipo,
                respondidas,
                sinDato: total - respondidas,
                opciones: [],
                promedio: null
            };

            if (CATEGORICAS.has(p.tipo)) {
                // % sobre los ENCUESTADOS que respondieron (en multiselect la suma puede pasar de 100)
                let opciones = Object.entries(conteos).map(([etiqueta, totalc]) => ({
                    etiqueta,
                    total: totalc,
                    porcentaje: respondidas ? redondear1((totalc / respondidas) * 100) : 0
                }));

                const definidas = normalizarOpciones(p.opciones);
                if (definidas.length) {
                    const porEtiqueta = new Map(opciones.map((o) => [o.etiqueta, o]));
                    const enOrden = definidas.map((e) => porEtiqueta.get(e) || { etiqueta: e, total: 0, porcentaje: 0 });
                    // respuestas que no están entre las opciones definidas (otros/texto libre)
                    const extra = opciones.filter((o) => !definidas.includes(o.etiqueta)).sort((a, b) => b.total - a.total);
                    opciones = [...enOrden, ...extra];
                } else {
                    opciones.sort((a, b) => b.total - a.total);
                }
                item.opciones = opciones;
            } else if (p.tipo === 'number' && numeros.length) {
                item.promedio = Math.round((numeros.reduce((a, b) => a + b, 0) / numeros.length) * 100) / 100;
            }

            if (!porSeccion.has(p.seccion)) porSeccion.set(p.seccion, []);
            porSeccion.get(p.seccion).push(item);
        }

        const secciones = [...porSeccion.entries()].map(([seccion, preguntas]) => ({ seccion, preguntas }));
        res.json({ tipo, encuesta: encuesta.nombre, total, secciones });
    } catch (error) {
        console.error('Error en tabulación de la app:', error.message);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { obtenerTabulacionApp };
