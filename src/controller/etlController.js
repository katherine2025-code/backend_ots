const ETLProceso = require('../models/ETLProceso');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const db = require('../config/db');

// ==========================================
// CONFIGURACIÓN DEL MICROSERVICIO PYTHON
// ==========================================
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

/**
 * Cargar archivo CSV y reenviarlo al microservicio Python
 */
const cargarArchivo = async (req, res) => {
    let procesoId = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Debe subir un archivo CSV' });
        }

        const tipo = req.body.tipo;
        console.log('\n Tipo de carga recibido:', tipo);
        console.log(' Archivo:', req.file.originalname);
        console.log(' Usuario:', req.usuario);

        if (!tipo) {
            return res.status(400).json({ error: 'El tipo de datos es obligatorio' });
        }

        // Registrar inicio del proceso
        procesoId = await ETLProceso.iniciar(req.file.originalname, tipo, req.usuario?.id_usuario);
        console.log(' Proceso registrado con ID:', procesoId);

        // Reenviar al microservicio Python
        console.log(' Enviando archivo al microservicio Python...');
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: 'text/csv'
        });
        formData.append('tipo', tipo);

        const response = await axios.post(
            `${ML_SERVICE_URL}/etl/procesar`,
            formData,
            {
                headers: { ...formData.getHeaders() },
                timeout: 120000
            }
        );

        console.log(' Respuesta del microservicio:', response.data);

        // Actualizar proceso
        await ETLProceso.finalizar(
            procesoId,
            'COMPLETADO',
            response.data.registros_insertados || 0,
            response.data.registros_error || 0,
            response.data.detalles?.join('; ') || null
        );

                console.log(`[ETL] Proceso ${procesoId} finalizado. Estado: COMPLETADO`);


        // Eliminar archivo temporal
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.json({
            success: true,
            mensaje: response.data.mensaje || 'Archivo procesado exitosamente',
            procesoId: procesoId,
            total: response.data.total_registros,
            exitosos: response.data.registros_insertados,
            errores: response.data.registros_error,
            detalles: response.data.detalles || []
        });

    } catch (error) {
        console.error(' ERROR en cargarArchivo:', error.message);
        console.error(' Detalles:', error.response?.data || error);
        
        if (procesoId) {
            await ETLProceso.finalizar(procesoId, 'ERROR', 0, 0, error.message);
        }
        
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ 
            error: error.message,
            detalles: error.response?.data 
        });
    }
};

// ==========================================
// MÉTODOS DE CONSULTA
// ==========================================

const obtenerHistorial = async (req, res) => {
    try {
        const { pagina = 1, limite = 20, tipo, estado } = req.query;
        const historial = await ETLProceso.obtenerHistorial({
            pagina: parseInt(pagina),
            limite: parseInt(limite),
            tipo,
            estado
        });
        res.json(historial);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerEstadoProcesos = async (req, res) => {
    try {
        const estado = await ETLProceso.obtenerEstadoProcesos();
        res.json(estado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerEstadisticasDatos = async (req, res) => {
    try {
        const pool = db.pool;
        
        // Consultar procesos activos (EN_PROCESO o PENDIENTE)
        const [activos] = await pool.query(`
            SELECT COUNT(*) as count FROM etl_procesos 
            WHERE estado IN ('EN_PROCESO', 'PENDIENTE', 'ejecutando')
        `);

        // Consultar procesos completados
        const [completados] = await pool.query(`
            SELECT COUNT(*) as count FROM etl_procesos 
            WHERE estado IN ('COMPLETADO', 'completado')
        `);

        // Consultar procesos fallidos
        const [fallidos] = await pool.query(`
            SELECT COUNT(*) as count FROM etl_procesos 
            WHERE estado IN ('ERROR', 'FALLIDO', 'error', 'fallido')
        `);

        const estado = {
            procesos_activos: activos[0].count || 0,
            procesos_completados: completados[0].count || 0,
            procesos_fallidos: fallidos[0].count || 0
        };

        res.json(estado);
    } catch (error) {
        console.error('Error obteniendo estado de procesos:', error);
        res.status(500).json({ error: error.message });
    }
};

const obtenerTiposDatos = async (req, res) => {
    try {
        const tipos = [
            { tipo: 'ocupacion', nombre: 'Ocupación Hotelera', descripcion: 'Datos de ocupación de hoteles (Metodología MINTUR)', campos_requeridos: ['fecha', 'id_hotel', 'habitaciones_ocupadas', 'ocupacion_porcentaje'] },
            { tipo: 'clima', nombre: 'Datos Climáticos', descripcion: 'Temperatura, humedad, precipitación', campos_requeridos: ['fecha', 'temperatura', 'humedad', 'precipitacion'] },
            { tipo: 'feriados', nombre: 'Días Feriados', descripcion: 'Calendario de feriados', campos_requeridos: ['nombre', 'fecha_inicio', 'fecha_fin'] },
            { tipo: 'encuestas', nombre: 'Encuestas Turísticas', descripcion: 'Datos de encuestas a turistas y establecimientos', campos_requeridos: ['fecha_encuesta', 'genero', 'edad', 'pais_residencia'] }
        ];
        res.json(tipos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerDetallesProceso = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = db.pool;
        
        const [resultados] = await pool.query(
            `SELECT * FROM etl_procesos WHERE id_etl = ?`, 
            [id]
        );
        
        if (resultados.length === 0) {
            return res.status(404).json({ error: 'Proceso no encontrado' });
        }
        
        const proceso = resultados[0];
        
        // Obtener estadísticas de la tabla según el tipo
        let estadisticas = {};
        if (proceso.tipo_datos === 'encuestas') {
            const [stats] = await pool.query(
                `SELECT COUNT(*) as total FROM encuestas_turisticas WHERE fecha_encuesta >= ?`,
                [proceso.fecha_inicio]
            );
            estadisticas = stats[0];
        } else if (proceso.tipo_datos === 'ocupacion') {
            const [stats] = await pool.query(
                `SELECT COUNT(*) as total FROM ocupacion_hotelera WHERE fecha >= ?`,
                [proceso.fecha_inicio]
            );
            estadisticas = stats[0];
        }
        
        res.json({
            proceso: proceso,
            estadisticas: estadisticas
        });
    } catch (error) {
        console.error('Error obteniendo detalles:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// FUNCIONES NUEVAS PARA EVITAR 404
// ==========================================

const obtenerLogsErrores = async (req, res) => {
    try {
        const limite = parseInt(req.query.limit) || 10;
        const pool = db.pool;
        const [logs] = await pool.query(`
            SELECT id_etl, nombre_archivo, estado, registros_error, mensaje_error, fecha_fin 
            FROM etl_procesos 
            WHERE estado IN ('ERROR', 'FALLIDO')
            ORDER BY fecha_fin DESC 
            LIMIT ?
        `, [limite]);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const obtenerEjecucionesProgramadas = async (req, res) => {
    try {
        const pool = db.pool;
        const [programadas] = await pool.query(`
            SELECT id_etl, nombre_archivo, estado 
            FROM etl_procesos 
            WHERE estado = 'PROGRAMADO'
            ORDER BY fecha_inicio ASC
        `);
        res.json(programadas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// EXPORTAR TODAS LAS FUNCIONES
// ==========================================
module.exports = { 
    cargarArchivo, 
    obtenerHistorial,
    obtenerEstadoProcesos,
    obtenerEstadisticasDatos,
    obtenerTiposDatos,
    obtenerDetallesProceso,
    obtenerLogsErrores,               // ✅ NUEVO
    obtenerEjecucionesProgramadas     // ✅ NUEVO
};