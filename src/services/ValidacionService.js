const { ValidacionPrediccion, Hotel, OcupacionHotelera } = require('../models');
const { Op } = require('sequelize');

class ValidacionService {

    // Validar predicción contra datos reales
    async validarPrediccion(prediccionId, hotelId, fecha) {
        // Obtener ocupación real
        const ocupacionReal = await OcupacionHotelera.findOne({
            where: { hotel_id: hotelId, fecha }
        });

        if (!ocupacionReal) {
            throw new Error('No hay datos reales para validar');
        }

        // Obtener predicción
        const prediccion = await Prediccion.findByPk(prediccionId);
        if (!prediccion) {
            throw new Error('Predicción no encontrada');
        }

        // Calcular errores
        const errorAbsoluto = Math.abs(ocupacionReal.tasa_ocupacion - prediccion.valor_predicho);
        const errorPorcentual = ocupacionReal.tasa_ocupacion > 0
            ? (errorAbsoluto / ocupacionReal.tasa_ocupacion) * 100
            : 0;

        const esAceptable = errorPorcentual <= 15;

        // Crear validación
        const validacion = await ValidacionPrediccion.create({
            hotel_id: hotelId,
            fecha,
            ocupacion_real: ocupacionReal.tasa_ocupacion,
            ocupacion_predicha: prediccion.valor_predicho,
            error_absoluto: errorAbsoluto,
            error_porcentual: errorPorcentual,
            es_aceptable: esAceptable,
            modelo_utilizado: prediccion.modelo_utilizado
        });

        return validacion;
    }

    // Calcular métricas del modelo
    async calcularMetricas(modelo, fechaInicio, fechaFin) {
        const validaciones = await ValidacionPrediccion.findAll({
            where: {
                modelo_utilizado: modelo,
                fecha: { [Op.between]: [fechaInicio, fechaFin] }
            }
        });

        if (validaciones.length === 0) {
            return null;
        }

        const total = validaciones.length;
        const aceptables = validaciones.filter(v => v.es_aceptable).length;

        // Calcular métricas
        const rmse = this.calcularRMSE(validaciones);
        const mae = this.calcularMAE(validaciones);
        const mape = this.calcularMAPE(validaciones);
        const precision = (aceptables / total) * 100;

        return {
            modelo,
            total_predicciones: total,
            predicciones_aceptables: aceptables,
            precision: precision.toFixed(2),
            rmse: rmse.toFixed(2),
            mae: mae.toFixed(2),
            mape: mape.toFixed(2),
            cumple_objetivo: mape <= 15 && precision >= 85
        };
    }

    calcularRMSE(validaciones) {
        const sum = validaciones.reduce((acc, v) => {
            const error = v.ocupacion_real - v.ocupacion_predicha;
            return acc + (error * error);
        }, 0);
        return Math.sqrt(sum / validaciones.length);
    }

    calcularMAE(validaciones) {
        const sum = validaciones.reduce((acc, v) => {
            return acc + Math.abs(v.ocupacion_real - v.ocupacion_predicha);
        }, 0);
        return sum / validaciones.length;
    }

    calcularMAPE(validaciones) {
        const sum = validaciones.reduce((acc, v) => {
            return acc + Math.abs(v.error_porcentual);
        }, 0);
        return sum / validaciones.length;
    }

    // Reporte de validación
    async generarReporteValidacion(hotelId, fechaInicio, fechaFin) {
        const validaciones = await ValidacionPrediccion.findAll({
            where: {
                hotel_id: hotelId,
                fecha: { [Op.between]: [fechaInicio, fechaFin] }
            },
            order: [['fecha', 'ASC']]
        });

        const metricasRF = await this.calcularMetricas('RandomForest', fechaInicio, fechaFin);
        const metricasXGB = await this.calcularMetricas('XGBoost', fechaInicio, fechaFin);

        return {
            hotel_id: hotelId,
            periodo: { fechaInicio, fechaFin },
            total_validaciones: validaciones.length,
            metricas: {
                random_forest: metricasRF,
                xgboost: metricasXGB
            },
            mejor_modelo: this.compararModelos(metricasRF, metricasXGB)
        };
    }

    compararModelos(metricasRF, metricasXGB) {
        if (!metricasRF || !metricasXGB) return 'Sin datos suficientes';

        const rfScore = metricasRF.precision;
        const xgbScore = metricasXGB.precision;

        if (rfScore > xgbScore) return 'RandomForest';
        if (xgbScore > rfScore) return 'XGBoost';
        return 'Empate';
    }
}

module.exports = new ValidacionService();