// models/EncuestaPregunta.js - Preguntas y respuestas (opciones) de cada encuesta
const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');

const EncuestaPregunta = sequelize.define('encuesta_pregunta', {
    id_pregunta: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    id_encuesta: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    codigo: {
        type: DataTypes.STRING(80),
        allowNull: false,
        comment: 'Clave con la que se guarda/exporta la respuesta (columna del CSV/ETL)'
    },
    texto: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    tipo: {
        type: DataTypes.ENUM('text', 'email', 'number', 'date', 'select', 'multiselect', 'escala'),
        allowNull: false,
        defaultValue: 'text'
    },
    seccion: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    obligatoria: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    orden: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    opciones: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Respuestas posibles (select, multiselect, escala)'
    },
    max_length: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    valor_default: {
        type: DataTypes.STRING(150),
        allowNull: true
    }
}, {
    tableName: 'encuesta_preguntas',
    timestamps: false,
    indexes: [
        { unique: true, fields: ['id_encuesta', 'codigo'] },
        { fields: ['id_encuesta', 'orden'] }
    ]
});

module.exports = EncuestaPregunta;
