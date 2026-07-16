const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);

    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: 'Error de validación', detalles: err.message });
    }

    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Registro duplicado' });
    }

    if (err.message.includes('no permitido')) {
        return res.status(400).json({ error: err.message });
    }

    res.status(err.status || 500).json({ 
        error: err.message || 'Error interno del servidor' 
    });
};

module.exports = { errorHandler };