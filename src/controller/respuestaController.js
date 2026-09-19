const respuestaService = require('../services/respuestaService');

const manejarError = (res, error, mensaje) => {
    if (error instanceof respuestaService.ErrorRespuesta) {
        return res.status(error.status).json({ error: error.message });
    }
    console.error(`${mensaje}:`, error);
    return res.status(500).json({ error: error.message });
};

// El encuestador envía una encuesta llenada
const registrar = async (req, res) => {
    try {
        const resultado = await respuestaService.registrar(req.usuario.id_usuario, req.body);
        res.status(resultado.duplicada ? 200 : 201).json(resultado);
    } catch (error) {
        manejarError(res, error, 'Error al registrar la encuesta');
    }
};

const listar = async (req, res) => {
    try {
        res.json(await respuestaService.listar(req.query));
    } catch (error) {
        manejarError(res, error, 'Error al listar respuestas');
    }
};

// Descarga CSV listo para el módulo ETL
const exportar = async (req, res) => {
    try {
        const csv = await respuestaService.exportarCSV(req.query);
        const nombre = `respuestas_${req.query.tipo}_${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
        res.send(csv);
    } catch (error) {
        manejarError(res, error, 'Error al exportar respuestas');
    }
};

module.exports = { registrar, listar, exportar };
