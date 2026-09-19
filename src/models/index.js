// models/index.js - VERSIÓN FINAL CORREGIDA
const { sequelize } = require('../config/db');

// Importar modelos - TODOS DEBEN ESTAR IMPORTADOS
const Usuario = require('./Usuario');
const Rol = require('./Rol');
const Hotel = require('./Hotel');
const OcupacionHotelera = require('./OcupacionHotelera');
const Prediccion = require('./Prediccion');
const Reporte = require('./Reporte');
const EncuestaTuristica = require('./EncuestaTuristica');
const ETLProceso = require('./ETLProceso');
const Bitacora = require('./Bitacora');
const Festivo = require('./Festivo');
const Temporada = require('./Temporada');
const VariableEstacional = require('./VariableEstacional');
const Encuesta = require('./Encuesta');
const EncuestaPregunta = require('./EncuestaPregunta');
const RespuestaEncuesta = require('./RespuestaEncuesta');
const JornadaRecoleccion = require('./JornadaRecoleccion');
const CronogramaEncuesta = require('./CronogramaEncuesta');

// RELACIONES - USAR LOS MODELOS IMPORTADOS

// Usuario - Rol
Rol.hasMany(Usuario, { foreignKey: 'id_rol' });
Usuario.belongsTo(Rol, { foreignKey: 'id_rol' });

// Usuario - Bitacora
Usuario.hasMany(Bitacora, { foreignKey: 'id_usuario' });
Bitacora.belongsTo(Usuario, { foreignKey: 'id_usuario' });

// Hotel - OcupacionHotelera
Hotel.hasMany(OcupacionHotelera, { foreignKey: 'id_hotel' });
OcupacionHotelera.belongsTo(Hotel, { foreignKey: 'id_hotel' });

// Hotel - Prediccion
Hotel.hasMany(Prediccion, { foreignKey: 'id_hotel' });
Prediccion.belongsTo(Hotel, { foreignKey: 'id_hotel' });

// Temporada - OcupacionHotelera
Temporada.hasMany(OcupacionHotelera, { foreignKey: 'id_temporada' });
OcupacionHotelera.belongsTo(Temporada, { foreignKey: 'id_temporada' });

// Festivo - OcupacionHotelera
Festivo.hasMany(OcupacionHotelera, { foreignKey: 'id_festivo' });
OcupacionHotelera.belongsTo(Festivo, { foreignKey: 'id_festivo' });

// Encuesta - EncuestaPregunta
Encuesta.hasMany(EncuestaPregunta, { foreignKey: 'id_encuesta', as: 'preguntas', onDelete: 'CASCADE' });
EncuestaPregunta.belongsTo(Encuesta, { foreignKey: 'id_encuesta' });

// Encuesta - RespuestaEncuesta
Encuesta.hasMany(RespuestaEncuesta, { foreignKey: 'id_encuesta', as: 'respuestas' });
RespuestaEncuesta.belongsTo(Encuesta, { foreignKey: 'id_encuesta', as: 'encuesta' });

// Usuario (encuestador) - RespuestaEncuesta
Usuario.hasMany(RespuestaEncuesta, { foreignKey: 'id_usuario', onDelete: 'SET NULL' });
RespuestaEncuesta.belongsTo(Usuario, { foreignKey: 'id_usuario' });

// JornadaRecoleccion - CronogramaEncuesta - Usuario (encuestador)
JornadaRecoleccion.hasMany(CronogramaEncuesta, { foreignKey: 'id_jornada', as: 'asignaciones', onDelete: 'CASCADE' });
CronogramaEncuesta.belongsTo(JornadaRecoleccion, { foreignKey: 'id_jornada', as: 'jornada' });
Usuario.hasMany(CronogramaEncuesta, { foreignKey: 'id_usuario', onDelete: 'CASCADE' });
CronogramaEncuesta.belongsTo(Usuario, { foreignKey: 'id_usuario', as: 'encuestador' });

// Exportar
module.exports = {
    sequelize,
    Usuario,
    Rol,
    Hotel,
    OcupacionHotelera,
    Prediccion,
    Reporte,
    EncuestaTuristica,
    ETLProceso,
    Bitacora,
    Festivo,
    Temporada,
    VariableEstacional,
    Encuesta,
    EncuestaPregunta,
    RespuestaEncuesta,
    JornadaRecoleccion,
    CronogramaEncuesta
};