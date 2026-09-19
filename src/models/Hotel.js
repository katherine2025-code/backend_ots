// models/Hotel.js - CORREGIDO
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Hotel = sequelize.define('hotel', {
    id_hotel: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    direccion: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    telefono: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    parroquia: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    canton: {
        type: DataTypes.STRING(30),
        allowNull: true,
        comment: 'Santa Elena | Salinas (clasificación de hoteles por cantón)'
    },
    categoria: {
        type: DataTypes.ENUM('1', '2', '3', '4', '5'),
        allowNull: false,
        defaultValue: '3'
    },
    habitaciones_totales: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    ubicacion_lat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
    },
    ubicacion_lng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
    },
    precio_promedio: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    playa_cercana: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    distancia_playa: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Distancia en metros'
    },
    servicios: {
        type: DataTypes.JSON,
        allowNull: true
    },
    estado: {
        type: DataTypes.ENUM('Activo', 'Inactivo'),
        defaultValue: 'Activo'
    }
}, {
    tableName: 'hoteles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Hotel;