// Tabulación pregunta por pregunta leída DIRECTAMENTE de los datos de la app propia
// (tabla respuestas_encuestas), NO del ETL/Kobo. Como la app guarda cada respuesta con el
// código exacto de su pregunta ({ codigo: valor | [valores] }), aquí se tabulan TODAS las
// preguntas del cuestionario, sin la ambigüedad del formato de exportación de Kobo.
const { Op } = require('sequelize');
const Encuesta = require('../models/Encuesta');
const EncuestaPregunta = require('../models/EncuestaPregunta');
const RespuestaEncuesta = require('../models/RespuestaEncuesta');
const { MARGEN_ANALISIS_DIAS } = require('../utils/feriados');
const { normalizarResidencia, residenciaLegible } = require('../utils/normalizarResidencia');

// Convierte un feriado (por nombre) a su rango de fechas [inicio, fin] usando la tabla
// `feriados` + el mismo margen de análisis que usan Ocupación y el resto de Reportes, para
// que "Carnaval" signifique lo mismo en toda la app. Devuelve null si el feriado no existe.
async function rangoDeFeriado(nombre) {
    const [filas] = await Encuesta.sequelize.query(
        `SELECT DATE_FORMAT(DATE_SUB(fecha_inicio, INTERVAL :m DAY), '%Y-%m-%d') AS ini,
                DATE_FORMAT(DATE_ADD(fecha_fin,   INTERVAL :m DAY), '%Y-%m-%d') AS fin
         FROM feriados WHERE nombre = :nombre LIMIT 1`,
        { replacements: { m: MARGEN_ANALISIS_DIAS, nombre } }
    );
    return filas.length ? filas[0] : null;
}

const redondear1 = (n) => Math.round(n * 10) / 10;
const CATEGORICAS = new Set(['select', 'multiselect', 'escala']);

// Secciones cuyo texto libre NO se tabula (son identificadores, no respuestas de análisis:
// cédula del encuestador, nombre/dirección/correo/teléfono del establecimiento, etc.).
const SECCIONES_SIN_TEXTO = new Set(['Datos del Encuestador', 'Identificación del Establecimiento']);
// Un campo de texto libre SÍ se tabula (como frecuencia de lo que escribió la gente) cuando es
// una respuesta de análisis, p. ej. "país/lugar de residencia". Se limita a los más frecuentes.
const esTextoTabulable = (p) => p.tipo === 'text' && !SECCIONES_SIN_TEXTO.has(p.seccion);
const LIMITE_TEXTO_LIBRE = 12;

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
        const { fechaInicio, fechaFin, feriado } = req.query;

        // Cuestionario vigente de ese tipo (hay uno por tipo: Encuesta.tipo es unique).
        const encuesta = await Encuesta.findOne({ where: { tipo } });
        if (!encuesta) return res.json({ tipo, encuesta: null, total: 0, secciones: [] });

        const preguntas = await EncuestaPregunta.findAll({
            where: { id_encuesta: encuesta.id_encuesta },
            order: [['orden', 'ASC']]
        });

        // El filtro por feriado funciona distinto según el tipo de encuesta:
        // - HOTEL: el establecimiento ELIGE sobre qué feriado reporta (pregunta "feriado"),
        //   así que se filtra por ese campo de la respuesta, NO por la fecha en que se llenó
        //   (si no, se perdían hoteles que registraron el feriado unos días antes/después).
        // - TURISTA: no hay campo de feriado, así que se usa el rango de fechas del feriado.
        const esHotel = tipo === 'hotel';

        const limitesInf = [];
        const limitesSup = [];
        if (feriado && !esHotel) {
            const rango = await rangoDeFeriado(feriado);
            if (!rango) {
                return res.json({ tipo, encuesta: encuesta.nombre, feriado, total: 0, secciones: [] });
            }
            limitesInf.push(`${rango.ini} 00:00:00`);
            limitesSup.push(`${rango.fin} 23:59:59`);
        }
        if (fechaInicio) limitesInf.push(`${fechaInicio} 00:00:00`);
        if (fechaFin) limitesSup.push(`${fechaFin} 23:59:59`);

        const where = { id_encuesta: encuesta.id_encuesta };
        if (limitesInf.length || limitesSup.length) {
            where.fecha_encuesta = {};
            if (limitesInf.length) where.fecha_encuesta[Op.gte] = limitesInf.sort().pop();   // cota inferior más alta
            if (limitesSup.length) where.fecha_encuesta[Op.lte] = limitesSup.sort()[0];       // cota superior más baja
        }
        let respuestas = await RespuestaEncuesta.findAll({ where, attributes: ['respuestas'] });

        // HOTEL + feriado: quedarse con las respuestas cuyo feriado reportado coincide.
        if (feriado && esHotel) {
            const objetivo = String(feriado).trim().toLowerCase();
            respuestas = respuestas.filter(r => String(r.respuestas?.feriado || '').trim().toLowerCase() === objetivo);
        }
        const total = respuestas.length;

        const porSeccion = new Map();

        for (const p of preguntas) {
            const conteos = {};
            let respondidas = 0;
            const numeros = [];

            // La residencia es texto libre: se unifica a país canónico (Ecuador/ECUADOR/ecuador →
            // "Ecuador"; ciudades como Cuenca/Guayaquil/Salinas → "Ecuador") para no fragmentar el %.
            const esResidencia = p.codigo === 'pais_residencia' || /residencia/i.test(p.codigo);

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
                    if (esResidencia && !residenciaLegible(v)) continue; // descarta basura/mojibake
                    const k = esResidencia ? (normalizarResidencia(v) || String(v).trim()) : String(v).trim();
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

            if (CATEGORICAS.has(p.tipo) || esTextoTabulable(p)) {
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
                    // Texto libre (p. ej. residencia): se muestran los valores más frecuentes.
                    opciones.sort((a, b) => b.total - a.total);
                    if (esTextoTabulable(p)) opciones = opciones.slice(0, LIMITE_TEXTO_LIBRE);
                }
                item.opciones = opciones;
            } else if (p.tipo === 'number' && numeros.length) {
                item.promedio = Math.round((numeros.reduce((a, b) => a + b, 0) / numeros.length) * 100) / 100;
            }

            if (!porSeccion.has(p.seccion)) porSeccion.set(p.seccion, []);
            porSeccion.get(p.seccion).push(item);
        }

        const secciones = [...porSeccion.entries()].map(([seccion, preguntas]) => ({ seccion, preguntas }));

        // DEMANDA TURÍSTICA (solo hoteles): la tabla del formato MINTUR son números por fecha
        // (Fecha 1..5), que la tabulación por opciones no muestra. Aquí se agregan los totales
        // sumando todas las fechas de todos los establecimientos, tal como en el Anexo 1.
        let demanda = null;
        if (esHotel) {
            let estab = 0, habDisp = 0, plazas = 0, nac = 0, ext = 0, per = 0, hab = 0;
            // La tarifa NO se promedia junta: "por persona" y "por habitación" son unidades
            // distintas (un promedio mezclado no se comprende). Se separa por el tipo que reporta
            // cada establecimiento (campo tipo_tarifa).
            const tarPersona = [], tarHabitacion = [];
            const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
            const esPorPersona = (t) => String(t || '').toLowerCase().includes('persona');
            for (const r of respuestas) {
                const d = r.respuestas || {};
                estab++;
                habDisp += num(d.num_habitaciones);
                plazas += num(d.num_plazas);
                const destino = esPorPersona(d.tipo_tarifa) ? tarPersona : tarHabitacion;
                for (let n = 1; n <= 5; n++) {
                    nac += num(d[`fecha${n}_nacionales`]);
                    ext += num(d[`fecha${n}_extranjeros`]);
                    per += num(d[`fecha${n}_pernoctaciones`]);
                    hab += num(d[`fecha${n}_habitaciones`]);
                    const t = Number(d[`fecha${n}_tarifa`]);
                    if (Number.isFinite(t) && t > 0) destino.push(t);
                }
            }
            const prom = (arr) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;
            demanda = {
                establecimientos: estab,
                habitaciones_disponibles: habDisp,
                plazas_disponibles: plazas,
                checkin_nacionales: nac,
                checkin_extranjeros: ext,
                llegadas_total: nac + ext,
                pernoctaciones: per,
                habitaciones_ocupadas: hab,
                tarifa_promedio_persona: prom(tarPersona),
                tarifa_promedio_habitacion: prom(tarHabitacion)
            };
        }

        res.json({ tipo, encuesta: encuesta.nombre, feriado: feriado || null, total, secciones, demanda });
    } catch (error) {
        console.error('Error en tabulación de la app:', error.message);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { obtenerTabulacionApp };
