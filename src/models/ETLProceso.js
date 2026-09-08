const { pool } = require('../config/db');

const ETLProceso = {
    async iniciar(nombre_archivo) {
        try {
            console.log('[ETLProceso] Iniciando proceso:', nombre_archivo);

            const [result] = await pool.query(
                `INSERT INTO etl_procesos 
                (nombre_archivo, estado, fecha_inicio)
                VALUES (?, 'EN_PROCESO', NOW())`,
                [nombre_archivo]
            );

            console.log('[ETLProceso] Proceso creado con ID:', result.insertId);
            return result.insertId;
        } catch (error) {
            console.error('[ETLProceso] Error en iniciar:', error);
            throw error;
        }
    },

    async finalizar(id, estado, exitosos, errores, observacion = null) {
        try {
            console.log('[ETLProceso] Finalizando proceso:', id, estado);

            await pool.query(
                `UPDATE etl_procesos 
                 SET estado = ?, 
                     registros_exitosos = ?, 
                     registros_error = ?,
                     observacion = ?,
                     fecha_fin = NOW()
                 WHERE id_etl = ?`,
                [estado, exitosos, errores, observacion, id]
            );

            console.log('[ETLProceso] Proceso finalizado');
        } catch (error) {
            console.error('[ETLProceso] Error en finalizar:', error);
            throw error;
        }
    },

    async obtenerHistorial({ pagina = 1, limite = 20, tipo, estado }) {
        try {
            let sql = 'SELECT * FROM etl_procesos WHERE 1=1';
            const params = [];

            if (tipo) {
                sql += ' AND tipo_datos = ?';
                params.push(tipo);
            }
            if (estado) {
                sql += ' AND estado = ?';
                params.push(estado);
            }

            sql += ' ORDER BY fecha_inicio DESC LIMIT ?, ?';
            params.push((pagina - 1) * limite, limite);

            console.log('[ETLProceso] Consultando historial');

            const [rows] = await pool.query(sql, params);
            return rows;
        } catch (error) {
            console.error('[ETLProceso] Error en obtenerHistorial:', error);
            throw error;
        }
    },

    async obtenerEstadoProcesos() {
        try {
            const [activos] = await pool.query(
                "SELECT COUNT(*) as total FROM etl_procesos WHERE estado = 'EN_PROCESO'"
            );
            const [completados] = await pool.query(
                "SELECT COUNT(*) as total FROM etl_procesos WHERE estado = 'COMPLETADO'"
            );
            const [fallidos] = await pool.query(
                "SELECT COUNT(*) as total FROM etl_procesos WHERE estado = 'ERROR'"
            );

            return {
                procesos_activos: activos[0].total,
                procesos_completados: completados[0].total,
                procesos_fallidos: fallidos[0].total
            };
        } catch (error) {
            console.error('[ETLProceso] Error en obtenerEstadoProcesos:', error);
            throw error;
        }
    },

    async obtenerEstadisticasDatos() {
        try {
            const [total] = await pool.query(
                "SELECT COALESCE(SUM(registros_exitosos), 0) as total FROM etl_procesos WHERE estado = 'COMPLETADO'"
            );

            return {
                total_registros: total[0].total || 0
            };
        } catch (error) {
            console.error('[ETLProceso] Error en obtenerEstadisticasDatos:', error);
            throw error;
        }
    }
};

module.exports = ETLProceso;