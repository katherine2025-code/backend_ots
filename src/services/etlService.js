const fs = require('fs');
const csv = require('csv-parser');
const ETLProceso = require('../models/ETLProceso');
const Clima = require('../models/Clima');
const Festivo = require('../models/Festivo');
const OcupacionHotelera = require('../models/OcupacionHotelera');
const EncuestaTuristica = require('../models/EncuestaTuristica');

const procesarCSV = async (rutaArchivo, tipo, id_usuario) => {
    const procesoId = await ETLProceso.iniciar(rutaArchivo);
    
    let registrosProcesados = 0;
    let registrosExitosos = 0;
    let registrosError = 0;
    const errores = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(rutaArchivo)
            .pipe(csv())
            .on('data', async (row) => {
                registrosProcesados++;
                try {
                    await procesarRegistro(row, tipo);
                    registrosExitosos++;
                } catch (error) {
                    registrosError++;
                    errores.push(`Fila ${registrosProcesados}: ${error.message}`);
                }
            })
            .on('end', async () => {
                await ETLProceso.finalizar(
                    procesoId, 
                    'COMPLETADO', 
                    registrosExitosos, 
                    registrosError,
                    errores.length > 0 ? errores.slice(0, 10).join('; ') : null
                );
                
                resolve({
                    procesoId,
                    total: registrosProcesados,
                    exitosos: registrosExitosos,
                    errores: registrosError,
                    mensaje: errores.length > 0 ? 'Proceso completado con errores' : 'Proceso completado exitosamente'
                });
            })
            .on('error', async (error) => {
                await ETLProceso.finalizar(procesoId, 'ERROR', 0, 0, error.message);
                reject(error);
            });
    });
};

const procesarRegistro = async (row, tipo) => {
    switch(tipo) {
        case 'clima':
            await Clima.create({
                fecha: row.fecha,
                temperatura: parseFloat(row.temperatura),
                humedad: parseFloat(row.humedad),
                precipitacion: parseFloat(row.precipitacion),
                velocidad_viento: parseFloat(row.velocidad_viento),
                descripcion: row.descripcion
            });
            break;
            
        case 'feriados':
            await Festivo.create({
                nombre: row.nombre,
                fecha_inicio: row.fecha_inicio,
                fecha_fin: row.fecha_fin,
                total_dias: parseInt(row.total_dias),
                temporada: row.temporada,
                descripcion: row.descripcion
            });
            break;
            
        case 'ocupacion':
            await OcupacionHotelera.create({
                id_hotel: parseInt(row.id_hotel),
                id_feriado: row.id_feriado ? parseInt(row.id_feriado) : null,
                id_clima: row.id_clima ? parseInt(row.id_clima) : null,
                fecha: row.fecha,
                checkin_nacionales: parseInt(row.checkin_nacionales) || 0,
                checkin_extranjeros: parseInt(row.checkin_extranjeros) || 0,
                pernoctaciones: parseInt(row.pernoctaciones) || 0,
                habitaciones_ocupadas: parseInt(row.habitaciones_ocupadas) || 0,
                tarifa_cobrada: parseFloat(row.tarifa_cobrada) || 0,
                ocupacion_porcentaje: parseFloat(row.ocupacion_porcentaje) || 0
            });
            break;
            
        case 'encuestas':
            await EncuestaTuristica.create({
                fecha_encuesta: row.fecha_encuesta,
                genero: row.genero,
                edad: parseInt(row.edad),
                pais_residencia: row.pais_residencia,
                ciudad_residencia: row.ciudad_residencia,
                motivo_visita: row.motivo_visita,
                noches_estadia: parseInt(row.noches_estadia),
                gasto_total: parseFloat(row.gasto_total),
                nivel_satisfaccion: parseInt(row.nivel_satisfaccion),
                probabilidad_retorno: parseInt(row.probabilidad_retorno)
            });
            break;
            
        default:
            throw new Error(`Tipo de archivo no reconocido: ${tipo}`);
    }
};

const obtenerHistorial = async () => {
    return await ETLProceso.getUltimos(20);
};

const obtenerEstadoProcesos = async () => {
    const procesosActivos = await ETLProceso.findAll({
        where: { estado: 'ejecutando' },
        order: [['fecha_inicio', 'DESC']]
    });

    const procesosCompletados = await ETLProceso.count({
        where: { estado: 'completado' }
    });

    const procesosFallidos = await ETLProceso.count({
        where: { estado: 'fallido' }
    });

    return {
        procesos_activos: procesosActivos.length,
        procesos_completados: procesosCompletados,
        procesos_fallidos: procesosFallidos,
        detalles: procesosActivos
    };
};

const obtenerEstadisticasDatos = async () => {
    const totalRegistros = await ETLProceso.sum('registros_procesados', {
        where: { estado: 'completado' }
    });

    const porTipo = await ETLProceso.findAll({
        attributes: [
            'tipo_datos',
            [sequelize.fn('COUNT', sequelize.col('id_etl')), 'total_procesos'],
            [sequelize.fn('SUM', sequelize.col('registros_procesados')), 'total_registros']
        ],
        where: { estado: 'completado' },
        group: ['tipo_datos'],
        raw: true
    });

    const ultimoProceso = await ETLProceso.findOne({
        order: [['fecha_fin', 'DESC']],
        where: { estado: 'completado' }
    });

    return {
        total_registros: totalRegistros || 0,
        por_tipo: porTipo,
        ultimo_proceso: ultimoProceso
    };
};

const obtenerTiposDatos = async () => {
    return [
        {
            tipo: 'ocupacion',
            nombre: 'Ocupación Hotelera',
            descripcion: 'Datos de ocupación de hoteles',
            campos_requeridos: ['fecha', 'id_hotel', 'habitaciones_ocupadas', 'habitaciones_disponibles']
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
            descripcion: 'Datos de encuestas a turistas',
            campos_requeridos: ['fecha_encuesta', 'genero', 'edad', 'pais_residencia']
        }
    ];
};

const programarEjecucion = async (datos) => {
    const { tipo, fecha_ejecucion, repeticion, id_usuario } = datos;

    const ejecucion = await ETLProceso.create({
        tipo_datos: tipo,
        estado: 'programado',
        fecha_programada: fecha_ejecucion,
        repeticion: repeticion,
        id_usuario: id_usuario,
        fecha_creacion: new Date()
    });

    // Aquí puedes agregar lógica para agregar al scheduler
    // scheduler.agregarTarea(ejecucion);

    return {
        mensaje: 'Ejecución programada exitosamente',
        ejecucion: ejecucion
    };
};

const obtenerEjecucionesProgramadas = async () => {
    const ejecuciones = await ETLProceso.findAll({
        where: { estado: 'programado' },
        order: [['fecha_programada', 'ASC']],
        include: [{
            model: Usuario,
            attributes: ['nombres', 'apellidos']
        }]
    });

    return ejecuciones;
};

const cancelarEjecucionProgramada = async (id) => {
    const ejecucion = await ETLProceso.findByPk(id);

    if (!ejecucion) {
        throw new Error('Ejecución programada no encontrada');
    }

    if (ejecucion.estado !== 'programado') {
        throw new Error('Solo se pueden cancelar ejecuciones programadas');
    }

    await ejecucion.update({
        estado: 'cancelado',
        fecha_cancelacion: new Date()
    });

    return {
        mensaje: 'Ejecución cancelada exitosamente',
        ejecucion: ejecucion
    };
};

const obtenerLogsErrores = async (limite = 50) => {
    const logs = await ETLProceso.findAll({
        where: { estado: 'fallido' },
        order: [['fecha_fin', 'DESC']],
        limit: limite,
        include: [{
            model: Usuario,
            attributes: ['nombres', 'apellidos']
        }]
    });

    return logs;
};

const eliminarRegistroHistorial = async (id) => {
    const registro = await ETLProceso.findByPk(id);

    if (!registro) {
        throw new Error('Registro no encontrado');
    }

    // Eliminar archivo si existe
    if (registro.ruta_archivo && fs.existsSync(registro.ruta_archivo)) {
        fs.unlinkSync(registro.ruta_archivo);
    }

    await registro.destroy();

    return {
        mensaje: 'Registro eliminado exitosamente'
    };
};

const reintentarProceso = async (id, id_usuario) => {
    const registro = await ETLProceso.findByPk(id);

    if (!registro) {
        throw new Error('Registro no encontrado');
    }

    if (registro.estado !== 'fallido') {
        throw new Error('Solo se pueden reintentar procesos fallidos');
    }

    // Actualizar estado a pendiente
    await registro.update({
        estado: 'pendiente',
        id_usuario: id_usuario,
        fecha_reintento: new Date()
    });

    // Aquí puedes agregar lógica para reejecutar el proceso
    // await procesarCSV(registro.ruta_archivo, registro.tipo_datos, id_usuario);

    return {
        mensaje: 'Proceso reintentado exitosamente',
        registro: registro
    };
};

const obtenerProgresoCarga = async (id) => {
    const proceso = await ETLProceso.findByPk(id);

    if (!proceso) {
        throw new Error('Proceso no encontrado');
    }

    const progreso = proceso.registros_procesados > 0 && proceso.total_registros > 0
        ? Math.round((proceso.registros_procesados / proceso.total_registros) * 100)
        : 0;

    return {
        id: proceso.id_etl,
        estado: proceso.estado,
        registros_procesados: proceso.registros_procesados,
        total_registros: proceso.total_registros,
        progreso: progreso,
        tiempo_transcurrido: proceso.fecha_inicio 
            ? Math.floor((new Date() - new Date(proceso.fecha_inicio)) / 1000)
            : 0
    };
};


module.exports = { procesarCSV, obtenerHistorial,  obtenerEstadoProcesos,
    obtenerEstadisticasDatos,
    obtenerTiposDatos,
    programarEjecucion,
    obtenerEjecucionesProgramadas,
    cancelarEjecucionProgramada,
    obtenerLogsErrores,
    eliminarRegistroHistorial,
    reintentarProceso,
    obtenerProgresoCarga};