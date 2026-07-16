const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Festivo = sequelize.define('festivo', {
    id_feriado: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
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
    total_dias: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    temporada: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fecha_registro: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'feriados',
    timestamps: false
});

module.exports = Festivo;