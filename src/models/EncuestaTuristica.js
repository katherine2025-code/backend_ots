const { pool } = require('../config/db');

const EncuestaTuristica = {
    async findAll() {
        const [rows] = await pool.query(
            'SELECT * FROM encuestas_turisticas ORDER BY fecha_encuesta DESC'
        );
        return rows;
    },

    async findById(id) {
        const [rows] = await pool.query(
            'SELECT * FROM encuestas_turisticas WHERE id_encuesta = ?', [id]
        );
        return rows[0];
    },

    async create(data) {
        const [result] = await pool.query(
            `INSERT INTO encuestas_turisticas 
            (fecha_encuesta, genero, edad, pais_residencia, ciudad_residencia, 
             motivo_visita, noches_estadia, gasto_total, nivel_satisfaccion, 
             probabilidad_retorno, nombre_encuestador)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [data.fecha_encuesta, data.genero, data.edad, 
             data.pais_residencia, data.ciudad_residencia,
             data.motivo_visita, data.noches_estadia, data.gasto_total,
             data.nivel_satisfaccion, data.probabilidad_retorno, 
             data.nombre_encuestador || 'No especificado']
        );
        return result.insertId;
    },

    async createBulk(encuestas) {
        const values = encuestas.map(e => [
            e.fecha_encuesta, e.genero, e.edad, 
            e.pais_residencia, e.ciudad_residencia,
            e.motivo_visita, e.noches_estadia, e.gasto_total,
            e.nivel_satisfaccion, e.probabilidad_retorno,
            e.nombre_encuestador || 'No especificado'
        ]);
        
        const [result] = await pool.query(
            `INSERT INTO encuestas_turisticas 
            (fecha_encuesta, genero, edad, pais_residencia, ciudad_residencia, 
             motivo_visita, noches_estadia, gasto_total, nivel_satisfaccion, 
             probabilidad_retorno, nombre_encuestador)
            VALUES ?`,
            [values]
        );
        return result.affectedRows;
    },

    async getKPIs(fechaInicio, fechaFin) {
        const [rows] = await pool.query(`
            SELECT 
                COUNT(*) as total_encuestas,
                AVG(gasto_total) as gasto_promedio,
                AVG(noches_estadia) as estadia_promedio,
                AVG(nivel_satisfaccion) as satisfaccion_promedio,
                COUNT(CASE WHEN probabilidad_retorno >= 4 THEN 1 END) as retornarian
            FROM encuestas_turisticas
            WHERE fecha_encuesta BETWEEN ? AND ?
        `, [fechaInicio, fechaFin]);
        return rows[0];
    }
};

module.exports = EncuestaTuristica;