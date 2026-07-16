const Hotel = require('../models/Hotel');

// Obtener todos los hoteles
const obtenerTodos = async (req, res) => {
    try {
        const hoteles = await Hotel.findAll();
        res.json(hoteles);
    } catch (error) {
        console.error('Error al obtener hoteles:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener hotel por ID
const obtenerPorId = async (req, res) => {
    try {
        const hotel = await Hotel.findByPk(req.params.id);
        if (!hotel) {
            return res.status(404).json({ error: 'Hotel no encontrado' });
        }
        res.json(hotel);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear hotel
const crear = async (req, res) => {
    try {
        const hotel = await Hotel.create(req.body);
        res.status(201).json(hotel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Actualizar hotel
const actualizar = async (req, res) => {
    try {
        const [updated] = await Hotel.update(req.body, {
            where: { id_hotel: req.params.id }
        });
        if (updated === 0) {
            return res.status(404).json({ error: 'Hotel no encontrado' });
        }
        const hotel = await Hotel.findByPk(req.params.id);
        res.json(hotel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Eliminar hotel
const eliminar = async (req, res) => {
    try {
        const deleted = await Hotel.destroy({
            where: { id_hotel: req.params.id }
        });
        if (deleted === 0) {
            return res.status(404).json({ error: 'Hotel no encontrado' });
        }
        res.json({ mensaje: 'Hotel eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    obtenerTodos,
    obtenerPorId,
    crear,
    actualizar,
    eliminar
};