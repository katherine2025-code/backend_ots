// models/ValidacionPrediccion.js - CORREGIDO
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const ValidacionPrediccion = sequelize.define('validacion_prediccion', {
    id_validacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    hotel_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    prediccion_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    fecha: {
        type: DataTypes.DATEONLY,  // ✅ Asegurar que sea DATEONLY
        allowNull: false
    },
    ocupacion_real: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    ocupacion_predicha: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    error_absoluto: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    error_porcentual: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    es_aceptable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    modelo_utilizado: {
        type: DataTypes.ENUM('RandomForest', 'XGBoost'),
        allowNull: false
    }
}, {
    tableName: 'validaciones_predicciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ValidacionPrediccion;