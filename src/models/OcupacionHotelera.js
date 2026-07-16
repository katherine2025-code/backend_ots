const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const OcupacionHotelera = sequelize.define('ocupacion_hotelera', {
    id_ocupacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_hotel: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    id_feriado: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    id_clima: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    checkin_nacionales: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    checkin_extranjeros: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    pernoctaciones: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    habitaciones_ocupadas: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    tarifa_cobrada: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    ocupacion_porcentaje: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    fecha_registro: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'ocupacion_hotelera',
    timestamps: false
});

module.exports = OcupacionHotelera;