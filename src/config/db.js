require('dotenv').config();
const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');

// 1. Definir variables de entorno con valores por defecto seguros
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'vidamiaIsa2910.';
const DB_NAME = process.env.DB_NAME || 'ots';

console.log('Configuración de BD detectada (MySQL Local 8.0):');
console.log(`   Host: ${DB_HOST}`);
console.log(`   Puerto: ${DB_PORT}`);
console.log(`   Usuario: ${DB_USER}`);
console.log(`   Base de datos: ${DB_NAME}`);
console.log('-----------------------------------');

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
        console.log('Conexión Sequelize exitosa');

        await sequelize.sync({ alter: false });
        console.log('Modelos sincronizados con la base de datos');

        const connection = await pool.getConnection();
        console.log('Conexión Pool MySQL exitosa');
        connection.release();

        console.log('Base de datos conectada correctamente\n');
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