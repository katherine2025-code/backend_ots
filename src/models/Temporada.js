// models/Temporada.js - CORREGIDO
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Temporada = sequelize.define('temporada', {
    id_temporada: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.ENUM('Alta', 'Media', 'Baja'),
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
    factor_ocupacion: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        comment: 'Factor multiplicador: Alta=1.3, Media=1.0, Baja=0.7'
    },
    descripcion: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'temporadas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Temporada;