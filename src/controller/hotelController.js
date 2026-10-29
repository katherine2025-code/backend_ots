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
        const { nombre, direccion, telefono, parroquia, canton, categoria,
                habitaciones_totales, ubicacion_lat, ubicacion_lng,
                precio_promedio, playa_cercana, distancia_playa, servicios, estado } = req.body;
        const hotel = await Hotel.create({
            nombre, direccion, telefono, parroquia, canton, categoria,
            habitaciones_totales, ubicacion_lat, ubicacion_lng,
            precio_promedio, playa_cercana, distancia_playa, servicios, estado
        });
        res.status(201).json(hotel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Actualizar hotel
const actualizar = async (req, res) => {
    try {
        const { nombre, direccion, telefono, parroquia, canton, categoria,
                habitaciones_totales, ubicacion_lat, ubicacion_lng,
                precio_promedio, playa_cercana, distancia_playa, servicios, estado } = req.body;
        const [updated] = await Hotel.update(
            { nombre, direccion, telefono, parroquia, canton, categoria,
              habitaciones_totales, ubicacion_lat, ubicacion_lng,
              precio_promedio, playa_cercana, distancia_playa, servicios, estado },
            { where: { id_hotel: req.params.id } }
        );
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