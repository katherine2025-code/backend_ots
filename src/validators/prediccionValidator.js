const validarPrediccion = (req, res, next) => {
    const { fecha_objetivo } = req.body;
    const errores = [];

    if (!fecha_objetivo) {
        errores.push('La fecha objetivo es obligatoria');
    } else if (isNaN(Date.parse(fecha_objetivo))) {
        errores.push('Formato de fecha no válido');
    }

    if (errores.length > 0) {
        return res.status(400).json({ 
            error: 'Errores de validación',
            detalles: errores 
        });
    }

    next();
};

module.exports = {
    validarPrediccion
};