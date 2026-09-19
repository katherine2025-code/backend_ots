// models/RespuestaEncuesta.js - Cada encuesta llenada por un encuestador en campo
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const RespuestaEncuesta = sequelize.define('respuesta_encuesta', {
    id_respuesta: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_encuesta: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Encuestador que la registró'
    },
    uuid_cliente: {
        type: DataTypes.STRING(36),
        allowNull: true,
        unique: true,
        comment: 'Identificador generado en el dispositivo; evita duplicados al reintentar el envío'
    },
    fecha_encuesta: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Momento en que se llenó la encuesta en campo'
    },
    respuestas: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: '{ codigo_pregunta: valor | [valores] }'
    },
    fecha_etl: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Cuándo el módulo ETL cargó esta respuesta a las tablas de análisis; evita cargarla dos veces'
    }
}, {
    tableName: 'respuestas_encuestas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['id_encuesta', 'fecha_encuesta'] },
        { fields: ['id_usuario'] }
    ]
});

module.exports = RespuestaEncuesta;
