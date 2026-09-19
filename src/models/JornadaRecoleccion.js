// models/JornadaRecoleccion.js - Operativo de recolección durante un feriado (1 a 5 días)
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const JornadaRecoleccion = sequelize.define('jornada_recoleccion', {
    id_jornada: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    feriado: {
        type: DataTypes.STRING(80),
        allowNull: false
    },
    fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    fecha_fin: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    creado_por: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'jornadas_recoleccion',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['fecha_inicio'] }]
});

module.exports = JornadaRecoleccion;
