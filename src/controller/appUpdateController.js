const fs = require('fs');
const path = require('path');

// Carpeta donde se guardan los paquetes web (bundles) del Live Update y el version.json.
// Nota de despliegue: en Dokploy conviene que /uploads sea un VOLUMEN persistente, si no los
// bundles se pierden al redesplegar y habría que volver a publicar.
const bundlesDir = path.join(__dirname, '../../uploads/app-bundles');
const versionFile = path.join(bundlesDir, 'version.json');

const asegurarDir = () => {
    if (!fs.existsSync(bundlesDir)) fs.mkdirSync(bundlesDir, { recursive: true });
};

// GET /api/app/latest  -> { version, url } (público; la app lo consulta al abrir)
const obtenerUltima = (req, res) => {
    try {
        if (!fs.existsSync(versionFile)) return res.json({ version: null, url: null });
        const info = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
        if (!info.version || !info.file) return res.json({ version: null, url: null });
        const base = `${req.protocol}://${req.get('host')}`;
        return res.json({
            version: info.version,
            url: `${base}/app-bundles/${info.file}`,
            fecha: info.fecha || null,
            notas: info.notas || null
        });
    } catch (e) {
        return res.status(500).json({ error: 'No se pudo leer la versión', detalle: e.message });
    }
};

// POST /api/app/publicar (solo Super Administrador) -> recibe el .zip del bundle web y fija la versión
const publicar = (req, res) => {
    try {
        const version = (req.body.version || '').toString().trim();
        if (!version) return res.status(400).json({ error: 'Falta la versión (campo "version")' });
        if (!req.file) return res.status(400).json({ error: 'Falta el archivo .zip (campo "bundle")' });
        asegurarDir();
        const info = {
            version,
            file: req.file.filename,
            fecha: new Date().toISOString(),
            notas: (req.body.notas || '').toString().trim() || null
        };
        fs.writeFileSync(versionFile, JSON.stringify(info, null, 2));
        return res.status(201).json({ ok: true, ...info });
    } catch (e) {
        return res.status(500).json({ error: 'No se pudo publicar', detalle: e.message });
    }
};

module.exports = { obtenerUltima, publicar };
