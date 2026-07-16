const Reporte = require('../models/Reporte');

// Obtener todos los reportes
const obtenerTodos = async (req, res) => {
    try {
        const reportes = await Reporte.findAll({
            order: [['fecha_generacion', 'DESC']]
        });
        res.json(reportes);
    } catch (error) {
        console.error('Error al obtener reportes:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener reporte por ID
const obtenerPorId = async (req, res) => {
    try {
        const reporte = await Reporte.findByPk(req.params.id);
        if (!reporte) {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }
        res.json(reporte);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear reporte
const crear = async (req, res) => {
    try {
        const reporte = await Reporte.create(req.body);
        res.status(201).json(reporte);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Eliminar reporte
const eliminar = async (req, res) => {
    try {
        const deleted = await Reporte.destroy({
            where: { id_reporte: req.params.id }
        });
        if (deleted === 0) {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }
        res.json({ mensaje: 'Reporte eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    obtenerTodos,
    obtenerPorId,
    crear,
    eliminar
};