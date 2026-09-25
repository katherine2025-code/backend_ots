// models/Prediccion.js - VERSIÓN FINAL CORREGIDA
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Prediccion = sequelize.define('prediccion', {
    id_prediccion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_hotel: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    fecha_generacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    ocupacion_predicha: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    ocupacion_real: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    error_absoluto: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    error_porcentual: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    es_aceptable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    modelo_utilizado: {
        type: DataTypes.ENUM('RandomForest', 'XGBoost', 'Prophet'),
        allowNull: false
    },
    version_modelo: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    precision_modelo: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    variables_utilizadas: {
        type: DataTypes.JSON,
        allowNull: true
    },
    importancia_variables: {
        type: DataTypes.JSON,
        allowNull: true
    },
    intervalo_confianza_min: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    intervalo_confianza_max: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    tiempo_prediccion_ms: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'validada', 'descartada', 'en_proceso'),
        allowNull: false,
        defaultValue: 'pendiente'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    validada_por: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    fecha_validacion: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'predicciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['id_hotel'] },
        { fields: ['fecha'] },
        { fields: ['modelo_utilizado'] },
        { fields: ['id_hotel', 'fecha'] },
        { fields: ['estado'] }
    ]
});

// HOOKS: Calcular errores automáticamente
Prediccion.beforeUpdate((prediccion) => {
    if (prediccion.ocupacion_real !== null && prediccion.ocupacion_predicha !== null) {
        const real = parseFloat(prediccion.ocupacion_real);
        const predicho = parseFloat(prediccion.ocupacion_predicha);

        prediccion.error_absoluto = Math.abs(real - predicho);

        if (real > 0) {
            prediccion.error_porcentual = (prediccion.error_absoluto / real) * 100;
        } else {
            prediccion.error_porcentual = 0;
        }

        prediccion.es_aceptable = prediccion.error_porcentual <= 15;

        if (prediccion.estado === 'pendiente') {
            prediccion.estado = 'validada';
        }
    }
});

module.exports = Prediccion;