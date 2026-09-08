// models/VariableEstacional.js - CORREGIDO
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const VariableEstacional = sequelize.define('variable_estacional', {
    id_variable: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true
    },
    mes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '1-12'
    },
    dia_semana: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '0-6 (Domingo=0)'
    },
    es_festivo: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    es_temporada_alta: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    semana_ano: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '1-52'
    },
    factor_estacional: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.0,
        comment: 'Factor compuesto para ML'
    }
}, {
    tableName: 'variables_estacionales',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['fecha'] },
        { fields: ['mes', 'dia_semana'] }
    ]
});

module.exports = VariableEstacional;