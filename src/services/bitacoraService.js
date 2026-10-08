// Servicio de bitácora de uso general. A diferencia de authService.registrarBitacora
// (que arma la descripción a partir de la IP), aquí la descripción la decide quien
// llama, para poder registrar el detalle de acciones sensibles: qué cuenta se afectó,
// qué rol cambió, etc. id_usuario SIEMPRE es el actor (quién ejecutó la acción).
const Bitacora = require('../models/Bitacora');

const registrar = async ({ id_usuario, accion, modulo, descripcion }) => {
    try {
        await Bitacora.create({
            id_usuario,
            accion,
            modulo,
            descripcion: descripcion || null,
            fecha: new Date()
        });
    } catch (error) {
        // Nunca romper la operación principal por un fallo de auditoría.
        console.log('[Bitacora] No se pudo registrar la acción:', error.message);
    }
};

module.exports = { registrar };
