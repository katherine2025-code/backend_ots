// models/Encuesta.js - Definición (cuestionario) de las encuestas configurables
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Encuesta = sequelize.define('encuesta', {
    id_encuesta: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    tipo: {
        type: DataTypes.ENUM('turista', 'hotel'),
        allowNull: false,
        unique: true,
        comment: 'Una definición vigente por tipo de encuesta'
    },
    activa: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'encuestas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Encuesta;
