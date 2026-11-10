const ETLProceso = require('../models/ETLProceso');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { ML_SERVICE_URL, mlHeaders, estadoErrorML } = require('../config/mlService');
const bitacoraService = require('../services/bitacoraService');
const { MARGEN_ANALISIS_DIAS } = require('../utils/feriados');

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

        if (!tipo) {
            return res.status(400).json({ error: 'El tipo de datos es obligatorio' });
        }

        // Registrar inicio del proceso
        procesoId = await ETLProceso.iniciar(req.file.originalname, tipo, req.usuario?.id_usuario);
        console.log(`[ETL] Proceso ${procesoId} iniciado: tipo=${tipo} usuario=${req.usuario?.id_usuario}`);

        // Reenviar al microservicio Python

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
                headers: mlHeaders(formData.getHeaders()),
                timeout: 600000
            }
        );

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

        console.log(`[ETL] Proceso ${procesoId} completado: ${response.data.registros_insertados || 0} insertados, ${response.data.registros_error || 0} con error`);

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
        // Solo el mensaje y el status: la respuesta completa del microservicio puede traer filas del archivo
        console.error(`[ETL] Proceso ${procesoId ?? '-'} falló: ${error.message}` +
            (error.response ? ` (microservicio respondió ${error.response.status})` : ''));

        // Se propaga el status real que devolvió el microservicio Python
        // (400 = archivo/columnas inválidas, 500 = fallo interno/BD) en vez
        // de responder siempre 500, para que el frontend pueda distinguir
        // un error del usuario de una falla del servidor.
        const statusUpstream = estadoErrorML(error);
        const mensajeUpstream = error.response?.data?.detail || error.message;

        if (procesoId) {
            await ETLProceso.finalizar(procesoId, 'ERROR', 0, 0, mensajeUpstream);
        }

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(statusUpstream).json({
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
        console.error('Error obteniendo estado de procesos:', error.message);
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
                    -- Solo países "reales": que empiezan con letra (excluye números/basura de columnas
                    -- mal alineadas) y no el relleno 'Prefiero no responder'. Evita conteos inflados.
                    COUNT(DISTINCT CASE WHEN pais_residencia REGEXP '^[A-Za-zÁÉÍÓÚÑáéíóúñ]'
                         AND pais_residencia <> 'Prefiero no responder' THEN pais_residencia END) as paises_diferentes,
                    -- Excluye el 0 (sin dato) para no sesgar el promedio hacia abajo.
                    AVG(NULLIF(nivel_satisfaccion, 0)) as satisfaccion_promedio,
                    AVG(gasto_total) as gasto_promedio,
                    -- Solo edades plausibles (1-120): un año (2026) u otro valor mal parseado no
                    -- debe disparar el promedio (antes mostraba "493 años").
                    AVG(CASE WHEN edad BETWEEN 1 AND 120 THEN edad END) as edad_promedio,
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
        console.error('Error obteniendo detalles:', error.message);
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

// Quita del historial una carga FALLIDA (estado ERROR). Una fila de etl_procesos es solo el
// registro de la carga: los datos cargados no guardan id_etl, así que borrarla nunca deshace nada.
// Por eso solo se permite con ERROR (el ETL hace rollback y no deja datos): borrar una carga
// COMPLETADO haría creer que se deshizo y perdería el rastro de quién cargó esos datos.
const eliminarRegistro = async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID de proceso inválido' });
        }

        const [procesos] = await db.pool.query(
            'SELECT id_etl, nombre_archivo, estado FROM etl_procesos WHERE id_etl = ?', [id]
        );
        if (procesos.length === 0) {
            return res.status(404).json({ error: 'Proceso no encontrado' });
        }

        const proceso = procesos[0];
        if (proceso.estado !== 'ERROR') {
            return res.status(409).json({
                error: 'Solo se pueden eliminar del historial las cargas con ERROR. Las demás son el ' +
                    'registro de qué datos se cargaron y quién; borrarlas no deshace la carga.'
            });
        }

        await db.pool.query("DELETE FROM etl_procesos WHERE id_etl = ? AND estado = 'ERROR'", [id]);
        await bitacoraService.registrar({
            id_usuario: req.usuario?.id_usuario,
            accion: 'ELIMINAR_PROCESO_ETL',
            modulo: 'ETL',
            descripcion: `Eliminó del historial la carga fallida #${id} (${proceso.nombre_archivo})`
        });

        res.json({ success: true, mensaje: 'Registro eliminado del historial' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// EXPORTAR DATOS LIMPIOS (CSV) PARA AUDITORÍA
// ==========================================
// Convierte las filas (objetos planos) a texto CSV con separador ';' (el que abre bien el
// Excel en español). Escapa comillas/;/saltos de línea y deja vacío los nulos. Encabezado =
// nombres de columna de la tabla.
function filasACsv(filas) {
    if (!filas.length) return '';
    const columnas = Object.keys(filas[0]);
    const escapar = (v) => {
        if (v === null || v === undefined) return '';
        let s = (v instanceof Date) ? v.toISOString().slice(0, 19).replace('T', ' ') : String(v);
        if (/[";\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    };
    const lineas = [columnas.join(';')];
    for (const f of filas) lineas.push(columnas.map((c) => escapar(f[c])).join(';'));
    return lineas.join('\r\n');
}

// GET /api/etl/exportar-limpio?tipo=turista|hotel&feriado=<nombre>
// Descarga, como CSV, los datos YA LIMPIOS que el ETL insertó en la base (sin vacíos: los no
// respondidos quedaron como 'Prefiero no responder' o 0). Sirve para auditar la calidad de los
// datos de cada feriado. 'feriado' es opcional; sin él exporta todo el tipo elegido.
const exportarDatosLimpios = async (req, res) => {
    try {
        const tipo = req.query.tipo === 'hotel' ? 'hotel' : 'turista';
        const feriado = req.query.feriado || null;
        const tabla = tipo === 'hotel' ? 'ocupacion_hotelera' : 'encuestas_turisticas';
        const colFecha = tipo === 'hotel' ? 'fecha' : 'fecha_encuesta';

        let sql = `SELECT * FROM ${tabla}`;
        const replacements = {};
        if (feriado) {
            // Mismo calendario + margen que usan Ocupación y Reportes (ver utils/feriados.js).
            sql += ` WHERE ${colFecha} BETWEEN
                (SELECT DATE_SUB(fecha_inicio, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY) FROM feriados WHERE nombre = :feriado)
                AND (SELECT DATE_ADD(fecha_fin, INTERVAL ${MARGEN_ANALISIS_DIAS} DAY) FROM feriados WHERE nombre = :feriado)`;
            replacements.feriado = feriado;
        }
        sql += ` ORDER BY ${colFecha} ASC`;

        const [filas] = await db.sequelize.query(sql, { replacements });

        const etiqueta = (feriado || 'todos')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar acentos
            .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
        const nombreArchivo = `datos_limpios_${tipo}_${etiqueta}.csv`;

        const cuerpo = filas.length
            ? filasACsv(filas)
            : `Sin datos para el filtro seleccionado (tipo=${tipo}${feriado ? `, feriado=${feriado}` : ''}).`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        res.send('﻿' + cuerpo);  // BOM: para que Excel muestre bien los acentos
    } catch (error) {
        console.error('[ETL] Error al exportar datos limpios:', error.message);
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
    eliminarRegistro,
    exportarDatosLimpios
};