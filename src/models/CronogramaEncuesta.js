// models/CronogramaEncuesta.js - Meta de encuestas de un encuestador para un día de una jornada
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const CronogramaEncuesta = sequelize.define('cronograma_encuesta', {
    id_cronograma: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_jornada: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Encuestador'
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    meta_turista: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    meta_hotel: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'cronograma_encuestas',
    timestamps: false,
    indexes: [
        { unique: true, fields: ['id_jornada', 'id_usuario', 'fecha'] },
        { fields: ['id_usuario', 'fecha'] }
    ]
});

module.exports = CronogramaEncuesta;
