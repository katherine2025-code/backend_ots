const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const Rol = sequelize.define('roles', {
    id_rol: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    descripcion: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, {
    tableName: 'roles',
    timestamps: false
});

module.exports = Rol;