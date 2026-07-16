const axios = require('axios');
const Prediccion = require('../models/Prediccion');
const OcupacionHotelera = require('../models/OcupacionHotelera');
const env = require('../config/environment');

const predecirOcupacion = async (fecha_objetivo, id_usuario) => {
    try {
        const response = await axios.post(`${env.python.url}/predecir`, {
            fecha_objetivo
        });

        const prediccion = response.data;

        const id = await Prediccion.create({
            id_usuario,
            fecha_prediccion: new Date(),
            ocupacion_predicha: prediccion.ocupacion_predicha,
            precision_modelo: prediccion.precision,
            modelo_utilizado: prediccion.modelo,
            error_absoluto: prediccion.error_absoluto
        });

        return {
            id,
            fecha_objetivo,
            ocupacion_predicha: prediccion.ocupacion_predicha,
            precision: prediccion.precision,
            modelo: prediccion.modelo,
            mensaje: 'Predicción generada exitosamente'
        };

    } catch (error) {
        throw new Error(`Error al conectar con microservicio Python: ${error.message}`);
    }
};

const obtenerHistorialPredicciones = async () => {
    return await Prediccion.findAll();
};

const obtenerEvaluacionModelos = async () => {
    return await Prediccion.getHistorialEvaluacion();
};

const prepararDataset = async () => {
    return await OcupacionHotelera.datasetML();
};

module.exports = { 
    predecirOcupacion, 
    obtenerHistorialPredicciones, 
    obtenerEvaluacionModelos,
    prepararDataset
};