const ETLProceso = require('../models/ETLProceso');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
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

        const ext = path.extname(req.file.originalname).toLowerCase();
        const contentType = ext === '.xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv';

        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType
        });
        formData.append('tipo', tipo);

        const response = await axios.post(
            `${ML_SERVICE_URL}/etl/procesar`,
            formData,
            {
                headers: { ...formData.getHeaders() },
                timeout: 600000
            }
        );

        console.log(' Respuesta del microservicio:', response.data);

        // Actualizar proceso
        const observaciones = [
            ...(response.data.advertencias || []),
            ...(response.data.detalles || [])
        ].join('; ') || null;

        await ETLProceso.finalizar(
            procesoId,
            'COMPLETADO',
            response.data.registros_insertados || 0,
            response.data.registros_error || 0,
            observaciones,
            response.data.total_registros || 0
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
            advertencias: response.data.advertencias || [],
            detalles: response.data.detalles || []
        });

    } catch (error) {
        console.error(' ERROR en cargarArchivo:', error.message);
        console.error(' Detalles:', error.response?.data || error);

        // Se propaga el status real que devolvió el microservicio Python
        // (400 = archivo/columnas inválidas, 500 = fallo interno/BD) en vez
        // de responder siempre 500, para que el frontend pueda distinguir
        // un error del usuario de una falla del servidor.
        const statusUpstream = error.response?.status;
        const mensajeUpstream = error.response?.data?.detail || error.message;

        if (procesoId) {
            await ETLProceso.finalizar(procesoId, 'ERROR', 0, 0, mensajeUpstream);
        }

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(statusUpstream || 500).json({
            error: mensajeUpstream,
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
            { tipo: 'ocupacion', nombre: 'Ocupación Hotelera', descripcion: 'Datos de ocupación de hoteles', campos_requeridos: ['fecha', 'id_hotel', 'habitaciones_ocupadas', 'ocupacion_porcentaje'] },
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

        // 1. Obtener información del proceso
        const [procesos] = await pool.query(
            `SELECT * FROM etl_procesos WHERE id_etl = ?`,
            [id]
        );

        if (procesos.length === 0) {
            return res.status(404).json({ error: 'Proceso no encontrado' });
        }

        const proceso = procesos[0];

        // 2. Calcular estadísticas según el tipo de datos
        let estadisticas = {};
        let datos_grafico = [];

        // El tipo se guarda desde ETLProceso.iniciar(); para procesos viejos
        // (previos a esta columna) se usa el nombre de archivo como respaldo.
        const nombreArchivo = proceso.nombre_archivo.toLowerCase();
        const esEncuesta = proceso.tipo_datos
            ? proceso.tipo_datos === 'encuestas'
            : (nombreArchivo.includes('encuesta') || nombreArchivo.includes('turismo') || nombreArchivo.includes('feriado'));

        if (esEncuesta) {
            // ==========================================
            // ESTADÍSTICAS COMPLETAS DE ENCUESTAS
            // ==========================================
            const [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_registros,
                    COUNT(DISTINCT pais_residencia) as paises_diferentes,
                    AVG(nivel_satisfaccion) as satisfaccion_promedio,
                    AVG(gasto_total) as gasto_promedio,
                    AVG(edad) as edad_promedio,
                    COUNT(CASE WHEN genero = 'Femenino' THEN 1 END) as total_femenino,
                    COUNT(CASE WHEN genero = 'Masculino' THEN 1 END) as total_masculino,
                    SUM(CASE WHEN nivel_satisfaccion >= 4 THEN 1 ELSE 0 END) as satisfechos,
                    SUM(CASE WHEN nivel_satisfaccion < 3 THEN 1 ELSE 0 END) as insatisfechos
                FROM encuestas_turisticas
            `);

            estadisticas = {
                total_registros: stats[0].total_registros || 0,
                registros_exitosos: stats[0].total_registros || 0,
                registros_error: 0,
                tasa_exito: 100,
                paises_diferentes: stats[0].paises_diferentes || 0,
                satisfaccion_promedio: parseFloat(stats[0].satisfaccion_promedio || 0).toFixed(1),
                gasto_promedio: parseFloat(stats[0].gasto_promedio || 0).toFixed(2),
                edad_promedio: parseFloat(stats[0].edad_promedio || 0).toFixed(1),
                genero_femenino: stats[0].total_femenino || 0,
                genero_masculino: stats[0].total_masculino || 0,
                satisfechos: stats[0].satisfechos || 0,
                insatisfechos: stats[0].insatisfechos || 0
            };

            // Gráfico 1: Distribución por País
            const [paises] = await pool.query(`
                SELECT 
                    COALESCE(pais_residencia, 'No especificado') as pais,
                    COUNT(*) as cantidad,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM encuestas_turisticas), 2) as porcentaje
                FROM encuestas_turisticas
                GROUP BY pais_residencia
                ORDER BY cantidad DESC
                LIMIT 10
            `);
            datos_grafico.push({ tipo: 'paises', datos: paises });

            // Gráfico 2: Nivel de Satisfacción
            const [satisfaccion] = await pool.query(`
                SELECT 
                    nivel_satisfaccion,
                    COUNT(*) as cantidad,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM encuestas_turisticas), 2) as porcentaje
                FROM encuestas_turisticas
                WHERE nivel_satisfaccion IS NOT NULL
                GROUP BY nivel_satisfaccion
                ORDER BY nivel_satisfaccion
            `);
            datos_grafico.push({ tipo: 'satisfaccion', datos: satisfaccion });

            // Gráfico 3: Distribución por Género
            const [genero] = await pool.query(`
                SELECT 
                    COALESCE(genero, 'No especificado') as genero,
                    COUNT(*) as cantidad,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM encuestas_turisticas), 2) as porcentaje
                FROM encuestas_turisticas
                GROUP BY genero
            `);
            datos_grafico.push({ tipo: 'genero', datos: genero });

            // Gráfico 4: Gasto Promedio por País (Top 5)
            const [gasto] = await pool.query(`
                SELECT 
                    pais_residencia as pais,
                    COUNT(*) as total_encuestas,
                    ROUND(AVG(gasto_total), 2) as gasto_promedio,
                    ROUND(MIN(gasto_total), 2) as gasto_minimo,
                    ROUND(MAX(gasto_total), 2) as gasto_maximo
                FROM encuestas_turisticas
                WHERE gasto_total > 0
                GROUP BY pais_residencia
                ORDER BY gasto_promedio DESC
                LIMIT 5
            `);
            datos_grafico.push({ tipo: 'gasto_pais', datos: gasto });

        } else {
            // ==========================================
            // ESTADÍSTICAS COMPLETAS DE OCUPACIÓN
            // ==========================================
            const [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_registros,
                    AVG(ocupacion_porcentaje) as ocupacion_promedio,
                    AVG(tarifa_cobrada) as tarifa_promedio,
                    SUM(checkin_nacionales + checkin_extranjeros) as total_huespedes,
                    AVG(habitaciones_ocupadas) as habitaciones_promedio,
                    MIN(ocupacion_porcentaje) as ocupacion_minima,
                    MAX(ocupacion_porcentaje) as ocupacion_maxima
                FROM ocupacion_hotelera
            `);

            estadisticas = {
                total_registros: stats[0].total_registros || 0,
                registros_exitosos: stats[0].total_registros || 0,
                registros_error: 0,
                tasa_exito: 100,
                ocupacion_promedio: parseFloat(stats[0].ocupacion_promedio || 0).toFixed(1),
                tarifa_promedio: parseFloat(stats[0].tarifa_promedio || 0).toFixed(2),
                total_huespedes: stats[0].total_huespedes || 0,
                habitaciones_promedio: parseFloat(stats[0].habitaciones_promedio || 0).toFixed(0),
                ocupacion_minima: parseFloat(stats[0].ocupacion_minima || 0).toFixed(1),
                ocupacion_maxima: parseFloat(stats[0].ocupacion_maxima || 0).toFixed(1)
            };

            // Gráfico 1: Ocupación por Fecha (últimos 30 días)
            const [ocupacion] = await pool.query(`
                SELECT 
                    DATE(fecha) as fecha,
                    ROUND(AVG(ocupacion_porcentaje), 2) as ocupacion_promedio,
                    SUM(checkin_nacionales) as checkin_nacionales,
                    SUM(checkin_extranjeros) as checkin_extranjeros
                FROM ocupacion_hotelera
                GROUP BY DATE(fecha)
                ORDER BY fecha DESC
                LIMIT 30
            `);
            datos_grafico.push({ tipo: 'ocupacion_tiempo', datos: ocupacion });

            // Gráfico 2: Ocupación por Hotel
            const [por_hotel] = await pool.query(`
                SELECT 
                    id_hotel,
                    COUNT(*) as total_registros,
                    ROUND(AVG(ocupacion_porcentaje), 2) as ocupacion_promedio,
                    ROUND(AVG(tarifa_cobrada), 2) as tarifa_promedio
                FROM ocupacion_hotelera
                GROUP BY id_hotel
                ORDER BY ocupacion_promedio DESC
            `);
            datos_grafico.push({ tipo: 'ocupacion_hotel', datos: por_hotel });
        }

        res.json({
            proceso: proceso,
            estadisticas: estadisticas,
            datos_grafico: datos_grafico,
            tipo_datos: esEncuesta ? 'encuestas' : 'ocupacion'
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
            SELECT id_etl, nombre_archivo, estado, registros_error, observacion, fecha_fin 
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
    obtenerLogsErrores,
    obtenerEjecucionesProgramadas
};