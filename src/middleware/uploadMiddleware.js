const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear carpeta de uploads si no existe
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'etl-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro de archivos: se valida por EXTENSIÓN, no por mimetype.
// El mimetype que reporta el navegador para .csv/.xlsx es inconsistente
// entre navegadores/SO (a veces llega 'application/octet-stream' o vacío),
// lo que rechazaba archivos válidos con un error 500 sin explicación.
const EXTENSIONES_PERMITIDAS = ['.csv', '.xlsx'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (EXTENSIONES_PERMITIDAS.includes(ext)) {
    cb(null, true);
  } else {
    // El mensaje debe incluir "no permitido" para que errorHandler.js
    // lo responda como 400 (error del cliente) en vez de 500.
    cb(new Error(`Tipo de archivo no permitido: ${ext || 'desconocido'}. Solo se aceptan .csv y .xlsx`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

module.exports = upload;