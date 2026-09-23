const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
require('./models');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

// CORS
const corsOptions = {
    origin: [
        'http://localhost:8100',
        'http://localhost:8101',
        'http://localhost:3000',
        'http://127.0.0.1:8100',
        'http://127.0.0.1:8101',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true,
    maxAge: 86400,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging simple
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Rutas públicas
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Backend OTS',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/test-cors', (req, res) => {
    res.json({
        success: true,
        message: 'CORS funciona correctamente!',
        timestamp: new Date().toISOString()
    });
});

// API
app.use('/api', routes);

// Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});

// Manejo de errores
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada',
        path: req.originalUrl
    });
});

app.use(errorHandler);

// Iniciar servidor
const startServer = async () => {
    try {
        await connectDB();
        console.log('✅ Base de datos conectada correctamente');

        await require('./services/esquemaService').asegurarEsquema();
        await require('./services/respuestaService').asegurarEsquema();
        await require('./services/encuestaService').sembrarSiVacio();
        await require('./services/encuestaService').actualizarCuestionarioHotel();
        await require('./services/encuestaService').actualizarOpcionesFeriado();

        app.listen(PORT, () => {
            console.log('\n=================================');
            console.log('🚀 Servidor iniciado exitosamente');
            console.log('=================================');
            console.log(`📡 Puerto: ${PORT}`);
            console.log(`🌐 URL: http://localhost:${PORT}`);
            console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log('=================================\n');
        });
    } catch (error) {
        console.error('❌ Error al iniciar servidor:', error.message);
        process.exit(1);
    }
};

startServer();

module.exports = app;