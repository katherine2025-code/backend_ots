const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Clima = sequelize.define('clima', {
    id_clima: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
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
    velocidad_viento: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    descripcion: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    fecha_registro: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'clima',
    timestamps: false
});

module.exports = Clima;