// models/OcupacionHotelera.js - CORREGIDO
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
    id_temporada: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    id_festivo: {
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
    total_turistas: {
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
    habitaciones_disponibles: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    habitaciones_totales: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    ocupacion_porcentaje: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    // Nombre del feriado al que corresponde el registro (Carnaval, Semana Santa, ...). Lo llena
    // el ETL de la app cuando el encuestador reporta una jornada del cronograma; los registros
    // cargados desde Kobo (el formulario original no preguntaba esto) quedan en null.
    feriado: {
        type: DataTypes.STRING(80),
        allowNull: true
    },
    tarifa_cobrada: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    ingreso_total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0
    },
    fuente_dato: {
        type: DataTypes.ENUM('Encuesta', 'Sistema', 'Manual', 'ETL'),
        allowNull: false,
        defaultValue: 'Encuesta'
    },
    validado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    creado_por: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    actualizado_por: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'ocupacion_hotelera',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['id_hotel', 'fecha'] },
        { fields: ['id_temporada'] },
        { fields: ['fecha'] }
    ]
});

// HOOKS: Calcular campos automáticamente
OcupacionHotelera.beforeCreate((ocupacion) => {
    if (ocupacion.checkin_nacionales !== null && ocupacion.checkin_extranjeros !== null) {
        ocupacion.total_turistas = ocupacion.checkin_nacionales + ocupacion.checkin_extranjeros;
    }
    if (ocupacion.habitaciones_ocupadas && ocupacion.tarifa_cobrada) {
        ocupacion.ingreso_total = ocupacion.habitaciones_ocupadas * ocupacion.tarifa_cobrada;
    }
    if (!ocupacion.ocupacion_porcentaje && ocupacion.habitaciones_ocupadas && ocupacion.habitaciones_totales) {
        ocupacion.ocupacion_porcentaje = (ocupacion.habitaciones_ocupadas / ocupacion.habitaciones_totales) * 100;
    }
});

OcupacionHotelera.beforeUpdate((ocupacion) => {
    if (ocupacion.checkin_nacionales !== null && ocupacion.checkin_extranjeros !== null) {
        ocupacion.total_turistas = ocupacion.checkin_nacionales + ocupacion.checkin_extranjeros;
    }
    if (ocupacion.habitaciones_ocupadas && ocupacion.tarifa_cobrada) {
        ocupacion.ingreso_total = ocupacion.habitaciones_ocupadas * ocupacion.tarifa_cobrada;
    }
    if (!ocupacion.ocupacion_porcentaje && ocupacion.habitaciones_ocupadas && ocupacion.habitaciones_totales) {
        ocupacion.ocupacion_porcentaje = (ocupacion.habitaciones_ocupadas / ocupacion.habitaciones_totales) * 100;
    }
});

module.exports = OcupacionHotelera;