const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:8100', 'http://localhost:8101', 'http://127.0.0.1:8100', 'http://127.0.0.1:8101'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Crear carpeta de uploads si no existe
const fs = require('fs');
const path = require('path');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Rutas
app.use('/api', require('./routes/index'));

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'API OTS - Observatorio Turístico Sostenible',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: '/api/auth',
            registro: 'POST /api/auth/registro',
            login: 'POST /api/auth/login'
        }
    });
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada',
        path: req.path,
        method: req.method,
        availableRoutes: {
            'GET /': 'Información de la API',
            'POST /api/auth/registro': 'Registrar usuario',
            'POST /api/auth/login': 'Login'
        }
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = app;