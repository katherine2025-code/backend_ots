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

const validarValidacionPrediccion = (req, res, next) => {
    const { observaciones, ocupacion_real } = req.body;
    const errores = [];

    if (ocupacion_real !== undefined) {
        if (typeof ocupacion_real !== 'number' || ocupacion_real < 0 || ocupacion_real > 100) {
            errores.push('La ocupación real debe ser un número entre 0 y 100');
        }
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
    validarPrediccion,
    validarValidacionPrediccion
};