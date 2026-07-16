const OcupacionHotelera = require('../models/OcupacionHotelera');
const { sequelize } = require('../config/db');
const { QueryTypes } = require('sequelize');

// Obtener todas las ocupaciones
const obtenerTodas = async (req, res) => {
    try {
        const ocupaciones = await OcupacionHotelera.findAll({
            order: [['fecha', 'DESC']]
        });
        res.json(ocupaciones);
    } catch (error) {
        console.error('Error al obtener ocupaciones:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener estadísticas de ocupación
const obtenerEstadisticas = async (req, res) => {
    try {
        // Total de registros
        const totalRegistros = await OcupacionHotelera.count();
        
        // Ocupación promedio - usando QueryTypes correctamente
        const resultado = await sequelize.query(
            'SELECT AVG(ocupacion_porcentaje) as promedio FROM ocupacion_hotelera',
            { type: QueryTypes.SELECT }
        );

        const ocupacionPromedio = resultado[0]?.promedio || 0;

        // Últimos 30 días (datos de ejemplo)
        const ultimos30Dias = [];
        const hoy = new Date();
        for (let i = 29; i >= 0; i--) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() - i);
            ultimos30Dias.push({
                fecha: fecha.toISOString().split('T')[0],
                ocupacion: Math.floor(Math.random() * 30) + 60
            });
        }

        res.json({
            total_registros: totalRegistros,
            ocupacion_promedio: parseFloat(ocupacionPromedio).toFixed(2),
            ultimos_30_dias: ultimos30Dias
        });
    } catch (error) {
        console.error('Error en estadísticas:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener ocupación por hotel
const obtenerPorHotel = async (req, res) => {
    try {
        const ocupaciones = await OcupacionHotelera.findAll({
            where: { id_hotel: req.params.id },
            order: [['fecha', 'DESC']]
        });
        res.json(ocupaciones);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    obtenerTodas,
    obtenerEstadisticas,
    obtenerPorHotel
};