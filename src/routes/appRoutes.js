const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('../controller/appUpdateController');
const { autenticar } = require('../middleware/authMiddleware');
const { verificarRol } = require('../middleware/roleMiddleware');

const bundlesDir = path.join(__dirname, '../../uploads/app-bundles');
if (!fs.existsSync(bundlesDir)) fs.mkdirSync(bundlesDir, { recursive: true });

// Multer propio para los bundles (.zip, hasta 60MB). Independiente del de ETL (.csv/.xlsx).
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, bundlesDir),
    filename: (req, file, cb) => {
        // Se nombra con la versión (los campos de texto van antes del archivo en el form).
        const v = (req.body.version || Date.now()).toString().replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${v}.zip`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 60 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.zip') return cb(null, true);
        // "no permitido" -> errorHandler responde 400 en vez de 500
        cb(new Error(`Tipo de archivo no permitido: ${ext || 'desconocido'}. Solo se acepta .zip`), false);
    }
});

// Pública: la app la consulta al abrir para saber si hay versión web más nueva.
router.get('/latest', controller.obtenerUltima);

// Solo Super Administrador: publica un nuevo bundle web (lo usa el script publicar-bundle).
router.post('/publicar', autenticar, verificarRol([0]), upload.single('bundle'), controller.publicar);

module.exports = router;
