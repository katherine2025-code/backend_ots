const encuestaService = require('../services/encuestaService');

const manejarError = (res, error, mensaje) => {
    if (error instanceof encuestaService.ErrorValidacion) {
        return res.status(400).json({ error: error.message });
    }
    console.error(`${mensaje}:`, error);
    return res.status(500).json({ error: error.message });
};

// Listado de encuestas (sin preguntas)
const obtenerTodas = async (req, res) => {
    try {
        res.json(await encuestaService.listar());
    } catch (error) {
        manejarError(res, error, 'Error al obtener encuestas');
    }
};

// Encuesta con todas sus preguntas y respuestas
const obtenerPorId = async (req, res) => {
    try {
        const encuesta = await encuestaService.obtener(req.params.id);
        if (!encuesta) return res.status(404).json({ error: 'Encuesta no encontrada' });
        res.json(encuesta);
    } catch (error) {
        manejarError(res, error, 'Error al obtener la encuesta');
    }
};

// Cuestionario vigente por tipo (lo usa el encuestador para responder)
const obtenerPorTipo = async (req, res) => {
    try {
        const { tipo } = req.params;
        if (!['turista', 'hotel'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo de encuesta no válido' });
        }
        const encuesta = await encuestaService.obtenerPorTipo(tipo);
        if (!encuesta) return res.status(404).json({ error: 'Encuesta no encontrada' });

        // El encuestador (3) solo puede llenar encuestas activas
        if (!encuesta.activa && req.usuario.id_rol === 3) {
            return res.status(403).json({ error: 'Esta encuesta está inactiva' });
        }
        res.json(encuesta);
    } catch (error) {
        manejarError(res, error, 'Error al obtener la encuesta por tipo');
    }
};

// Editar nombre, descripción, preguntas y respuestas
const actualizar = async (req, res) => {
    try {
        const encuesta = await encuestaService.actualizar(req.params.id, req.body);
        if (!encuesta) return res.status(404).json({ error: 'Encuesta no encontrada' });
        res.json(encuesta);
    } catch (error) {
        manejarError(res, error, 'Error al actualizar la encuesta');
    }
};

// Activar / desactivar
const cambiarEstado = async (req, res) => {
    try {
        if (typeof req.body.activa !== 'boolean') {
            return res.status(400).json({ error: 'El campo "activa" debe ser booleano' });
        }
        const encuesta = await encuestaService.cambiarEstado(req.params.id, req.body.activa);
        if (!encuesta) return res.status(404).json({ error: 'Encuesta no encontrada' });
        res.json(encuesta);
    } catch (error) {
        manejarError(res, error, 'Error al cambiar el estado de la encuesta');
    }
};

module.exports = { obtenerTodas, obtenerPorId, obtenerPorTipo, actualizar, cambiarEstado };
