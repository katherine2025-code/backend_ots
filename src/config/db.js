require('dotenv').config();
const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');

// 1. Definir variables de entorno con valores por defecto seguros
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_NAME = process.env.DB_NAME || 'ots';

// La contraseña nunca va en el código. En producción es obligatoria: sin ella el servidor no
// arranca (mejor un error claro que intentar conectar sin contraseña). En desarrollo se permite
// vacía, para un MySQL/MariaDB local con root sin contraseña.
if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
    throw new Error(
        'Falta la variable de entorno DB_PASSWORD (obligatoria con NODE_ENV=production). ' +
        'Configúrala en el entorno del servidor (p. ej. Environment de la app en Dokploy).'
    );
}
const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Sin usuario ni host en los logs: solo la base a la que se conecta
console.log(`[BD] Base de datos: ${DB_NAME}`);

// 2. Configuración de Sequelize (para los Modelos)
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: parseInt(DB_PORT),
    dialect: 'mysql',
    logging: false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// 3. Configuración de Pool (para consultas directas como ETL)
const pool = mysql.createPool({
    host: DB_HOST,
    port: parseInt(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 4. Función de conexión para server.js
async function connectDB() {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ alter: false });

        const connection = await pool.getConnection();
        connection.release();

        console.log('[BD] Conectada');
        return true;

    } catch (error) {
        console.error('Error de conexión a la base de datos:', error.message);
        console.error('Tip: Verifica que tu contraseña de MySQL en el archivo .env sea la correcta.');
        throw error;
    }
}

// 5. Exportar todo
module.exports = {
    sequelize,
    pool,
    connectDB
};