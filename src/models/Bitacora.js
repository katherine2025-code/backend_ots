
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Bitacora = sequelize.define('bitacora', {
    id_bitacora: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    accion: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    modulo: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'bitacora',
    timestamps: false
});

module.exports = Bitacora;