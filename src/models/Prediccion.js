const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Prediccion = sequelize.define('predicciones', {
    id_prediccion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    fecha_objetivo: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    fecha_generacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    checkin_nacionales: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    checkin_extranjeros: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    tarifa_cobrada: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    temperatura: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    humedad: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    precipitacion: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true
    },
    total_dias_feriado: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    temporada: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    mes: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    dia_semana: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    es_fin_semana: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 0
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
    precision_modelo: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    modelo_utilizado: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    version_modelo: {
        type: DataTypes.STRING(50),
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
        type: DataTypes.ENUM('pendiente', 'validada', 'descartada'),
        allowNull: true,
        defaultValue: 'pendiente'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    id_hotel: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'predicciones',
    timestamps: false
});

module.exports = Prediccion;