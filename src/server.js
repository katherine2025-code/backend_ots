const app = require('./app');
const db = require('./config/db');
const { connectDB } = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Probar conexión a la base de datos
async function startServer() {
    try {
        // Conectar a la base de datos
        await connectDB();
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en puerto ${PORT}`);
            console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log(`URL: http://localhost:${PORT}`);
        });
        
    } catch (error) {
        console.error('Error al iniciar servidor:', error.message);
        process.exit(1);
    }
}

startServer();