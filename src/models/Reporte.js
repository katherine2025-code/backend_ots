const { pool } = require('../config/db');

const Reporte = {
    async findAll() {
        const [rows] = await pool.query(
            'SELECT * FROM reportes ORDER BY fecha_generacion DESC'
        );
        return rows;
    },

    async findById(id) {
        const [rows] = await pool.query(
            'SELECT * FROM reportes WHERE id_reporte = ?', [id]
        );
        return rows[0];
    },

    async create(data) {
        const [result] = await pool.query(
            `INSERT INTO reportes 
            (id_usuario, nombre, tipo, ruta_archivo)
            VALUES (?,?,?,?)`,
            [data.id_usuario, data.nombre, data.tipo, data.ruta_archivo]
        );
        return result.insertId;
    },

    async findByTipo(tipo) {
        const [rows] = await pool.query(
            'SELECT * FROM reportes WHERE tipo = ? ORDER BY fecha_generacion DESC',
            [tipo]
        );
        return rows;
    },

    // Alias de findById - el controller lo llama con este nombre (estilo Sequelize)
    async findByPk(id) {
        return this.findById(id);
    },

    async destroy({ where }) {
        const [result] = await pool.query(
            'DELETE FROM reportes WHERE id_reporte = ?', [where.id_reporte]
        );
        return result.affectedRows;
    }
};

module.exports = Reporte;