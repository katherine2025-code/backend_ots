const validarCargaArchivo = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Debe subir un archivo CSV' });
  }
  if (!req.body.tipo) {
    return res.status(400).json({ error: 'El tipo de datos es obligatorio' });
  }
  next();
};

const validarProgramacion = (req, res, next) => {
  if (!req.body.tipo || !req.body.fecha_ejecucion) {
    return res.status(400).json({ 
      error: 'Tipo y fecha de ejecución son obligatorios' 
    });
  }
  next();
};

const validarHistorial = (req, res, next) => {
  next();
};

module.exports = { 
  validarCargaArchivo, 
  validarProgramacion, 
  validarHistorial 
};