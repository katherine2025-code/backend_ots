const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Hotel = sequelize.define('hoteles', {
    id_hotel: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    direccion: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    correo: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    telefono: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    categoria: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    parroquia: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    habitaciones_disponibles: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    plazas_disponibles: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    estado: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 1
    },
    fecha_registro: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'hoteles',
    timestamps: false
});

module.exports = Hotel;