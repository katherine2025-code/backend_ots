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
        if (!tipo) {
            return res.status(400).json({ error: 'El tipo de datos es obligatorio' });
        }

        console.log('\n[ETL]  Recibiendo archivo:', req.file.originalname);
        console.log('[ETL] Tipo:', tipo);
        console.log('[ETL] Usuario:', req.usuario?.id_usuario);

        // 1. Registrar inicio del proceso en BD
        procesoId = await ETLProceso.iniciar(req.file.originalname);
        console.log(' [ETL] Proceso registrado con ID:', procesoId);

        // 2. Reenviar el archivo al microservicio Python
        console.log('[ETL] Enviando archivo al microservicio Python...');
        
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
                headers: {
                    ...formData.getHeaders()
                },
                timeout: 120000 // 120 segundos timeout para archivos grandes
            }
        );

        console.log('[ETL] Respuesta del microservicio:', response.data);

        // 3. Actualizar el proceso con los resultados
        await ETLProceso.finalizar(
            procesoId,
            'COMPLETADO',
            response.data.registros_insertados || 0,
            response.data.registros_error || 0,
            response.data.detalles?.join('; ') || null
        );

        // 4. Eliminar archivo temporal
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        // 5. Devolver respuesta al frontend
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
        console.error('[ETL]  Error:', error.message);
        
        // Registrar error en BD si hay procesoId
        if (procesoId) {
            try {
                await ETLProceso.finalizar(
                    procesoId,
                    'ERROR',
                    0,
                    0,
                    error.message
                );
            } catch (e) {
                console.error('Error registrando fallo:', e);
            }
        }

        // Eliminar archivo temporal si existe
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        // Respuesta específica según el tipo de error
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ 
                error: 'El microservicio Python no está disponible. Verifica que esté corriendo en el puerto 5000.' 
            });
        }

        if (error.response) {
            return res.status(error.response.status).json({ 
                error: error.response.data?.detail || 'Error en el microservicio Python' 
            });
        }

        res.status(500).json({ error: error.message });
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
        
        // Estadísticas de encuestas
        const [encuestas] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT pais_residencia) as paises,
                AVG(noches_estadia) as noches_promedio,
                AVG(gasto_total) as gasto_promedio,
                AVG(nivel_satisfaccion) as satisfaccion_promedio
            FROM encuestas_turisticas
        `);

        // Estadísticas de ocupación
        const [ocupacion] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                AVG(ocupacion_porcentaje) as ocupacion_promedio,
                AVG(tarifa_cobrada) as tarifa_promedio,
                SUM(checkin_nacionales + checkin_extranjeros) as total_huespedes
            FROM ocupacion_hotelera
        `);

        res.json({
            encuestas: encuestas[0],
            ocupacion: ocupacion[0],
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: error.message });
    }
};

// ESTA ERA LA FUNCIÓN QUE FALTABA Y CAUSABA EL ERROR
const obtenerTiposDatos = async (req, res) => {
    try {
        const tipos = [
            {
                tipo: 'ocupacion',
                nombre: 'Ocupación Hotelera',
                descripcion: 'Datos de ocupación de hoteles (Metodología MINTUR)',
                campos_requeridos: ['fecha', 'id_hotel', 'habitaciones_ocupadas', 'ocupacion_porcentaje']
            },
            {
                tipo: 'clima',
                nombre: 'Datos Climáticos',
                descripcion: 'Temperatura, humedad, precipitación',
                campos_requeridos: ['fecha', 'temperatura', 'humedad', 'precipitacion']
            },
            {
                tipo: 'feriados',
                nombre: 'Días Feriados',
                descripcion: 'Calendario de feriados',
                campos_requeridos: ['nombre', 'fecha_inicio', 'fecha_fin']
            },
            {
                tipo: 'encuestas',
                nombre: 'Encuestas Turísticas',
                descripcion: 'Datos de encuestas a turistas y establecimientos',
                campos_requeridos: ['fecha_encuesta', 'genero', 'edad', 'pais_residencia']
            }
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
        
        const [resultados] = await pool.query(`SELECT * FROM etl_procesos WHERE id_etl = ?`, [id]);

        if (resultados.length === 0) {
            return res.status(404).json({ error: 'Proceso no encontrado' });
        }

        const proceso = resultados[0];
        let estadisticas = {};
        let datosGrafico = [];
        let tipoDatos = 'encuestas'; // Por defecto

        // Detectar tipo por nombre del archivo
        const nombreArchivo = (proceso.nombre_archivo || '').toLowerCase();
        const esHotel = nombreArchivo.includes('alojamiento') || 
                        nombreArchivo.includes('hotel') || 
                        nombreArchivo.includes('ocupacion');
        
        tipoDatos = esHotel ? 'ocupacion' : 'encuestas';

        if (tipoDatos === 'encuestas') {
            // ESTADÍSTICAS DE ENCUESTAS
            const [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_registros,
                    COUNT(CASE WHEN genero IS NOT NULL AND genero != '' THEN 1 END) as registros_exitosos,
                    COUNT(CASE WHEN genero IS NULL OR genero = '' THEN 1 END) as registros_error,
                    ROUND(COUNT(CASE WHEN genero IS NOT NULL AND genero != '' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as tasa_exito,
                    COUNT(DISTINCT pais_residencia) as paises_diferentes,
                    AVG(noches_estadia) as noches_promedio,
                    AVG(gasto_total) as gasto_promedio,
                    AVG(nivel_satisfaccion) as satisfaccion_promedio,
                    AVG(probabilidad_retorno) as probabilidad_retorno_promedio
                FROM encuestas_turisticas
            `);
            estadisticas = stats[0];

            // GRÁFICO: Encuestas por fecha
            [datosGrafico] = await pool.query(`
                SELECT 
                    DATE(fecha_encuesta) as fecha,
                    COUNT(*) as total_encuestas,
                    AVG(nivel_satisfaccion) as satisfaccion_promedio,
                    AVG(probabilidad_retorno) as probabilidad_retorno
                FROM encuestas_turisticas
                WHERE fecha_encuesta IS NOT NULL
                GROUP BY DATE(fecha_encuesta)
                ORDER BY fecha
                LIMIT 30
            `);

        } else {
            // ESTADÍSTICAS DE OCUPACIÓN HOTELERA
            const [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_registros,
                    COUNT(CASE WHEN habitaciones_ocupadas > 0 THEN 1 END) as registros_exitosos,
                    COUNT(CASE WHEN habitaciones_ocupadas = 0 THEN 1 END) as registros_error,
                    ROUND(COUNT(CASE WHEN habitaciones_ocupadas > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as tasa_exito,
                    AVG(ocupacion_porcentaje) as ocupacion_promedio,
                    AVG(tarifa_cobrada) as tarifa_promedio,
                    SUM(checkin_nacionales + checkin_extranjeros) as total_huespedes
                FROM ocupacion_hotelera
            `);
            estadisticas = stats[0];

            // GRÁFICO: Ocupación por fecha
            [datosGrafico] = await pool.query(`
                SELECT 
                    DATE(fecha) as fecha,
                    AVG(ocupacion_porcentaje) as ocupacion_promedio,
                    SUM(checkin_nacionales) as nacionales,
                    SUM(checkin_extranjeros) as extranjeros
                FROM ocupacion_hotelera
                WHERE fecha IS NOT NULL
                GROUP BY DATE(fecha)
                ORDER BY fecha
                LIMIT 30
            `);
        }

        res.json({
            proceso: proceso,
            estadisticas: estadisticas,
            datos_grafico: datosGrafico,
            tipo_datos: tipoDatos
        });

    } catch (error) {
        console.error('Error obteniendo detalles:', error);
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
    obtenerTiposDatos,       // Ahora sí está definida y se exporta correctamente
    obtenerDetallesProceso
};