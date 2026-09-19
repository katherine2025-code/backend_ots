const cronogramaService = require('../services/cronogramaService');

const manejarError = (res, error, mensaje) => {
    if (error instanceof cronogramaService.ErrorCronograma) {
        return res.status(error.status).json({ error: error.message });
    }
    console.error(`${mensaje}:`, error);
    return res.status(500).json({ error: error.message });
};

const ejecutar = (mensaje, fn, status = 200) => async (req, res) => {
    try {
        res.status(status).json(await fn(req));
    } catch (error) {
        manejarError(res, error, mensaje);
    }
};

module.exports = {
    encuestadores: ejecutar('Error al listar encuestadores', () => cronogramaService.listarEncuestadores()),
    jornadas: ejecutar('Error al listar jornadas', () => cronogramaService.listarJornadas()),
    crearJornada: ejecutar('Error al crear la jornada',
        (req) => cronogramaService.crearJornada(req.usuario.id_usuario, req.body), 201),
    resumen: ejecutar('Error al obtener el resumen', () => cronogramaService.resumen()),
    avance: ejecutar('Error al obtener el avance', (req) => cronogramaService.avanceDeJornada(req.params.id)),
    actualizarMeta: ejecutar('Error al actualizar la meta', (req) => cronogramaService.actualizarMeta(req.params.id, req.body)),
    agregarEncuestador: ejecutar('Error al agregar el encuestador',
        (req) => cronogramaService.agregarEncuestador(req.params.id, req.body), 201),
    eliminarJornada: ejecutar('Error al eliminar la jornada', (req) => cronogramaService.eliminarJornada(req.params.id)),
    miCronograma: ejecutar('Error al obtener mi cronograma', (req) => cronogramaService.miCronograma(req.usuario.id_usuario))
};
