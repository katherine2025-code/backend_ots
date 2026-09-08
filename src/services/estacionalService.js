const { VariableEstacional, Temporada, Festivo } = require('../models');

class EstacionalService {

    // Generar variables estacionales para un rango de fechas
    async generarVariablesEstacionales(fechaInicio, fechaFin) {
        const fechas = this.obtenerRangoFechas(fechaInicio, fechaFin);
        const variables = [];

        for (const fecha of fechas) {
            const variable = await this.calcularVariables(fecha);
            variables.push(variable);
        }

        return await VariableEstacional.bulkCreate(variables);
    }

    async calcularVariables(fecha) {
        const dateObj = new Date(fecha);
        const mes = dateObj.getMonth() + 1;
        const diaSemana = dateObj.getDay();
        const semanaAno = this.getSemanaAno(dateObj);

        // Verificar si es festivo
        const esFestivo = await this.esFestivo(fecha);

        // Verificar temporada
        const temporada = await this.getTemporada(fecha);
        const esTemporadaAlta = temporada?.nombre === 'Alta';
        const factorEstacional = temporada?.factor_ocupacion || 1.0;

        return {
            fecha,
            mes,
            dia_semana: diaSemana,
            es_festivo: esFestivo,
            es_temporada_alta: esTemporadaAlta,
            semana_ano: semanaAno,
            factor_estacional: factorEstacional
        };
    }

    async esFestivo(fecha) {
        const festivo = await Festivo.findOne({
            where: { fecha }
        });
        return !!festivo;
    }

    async getTemporada(fecha) {
        const temporada = await Temporada.findOne({
            where: {
                fecha_inicio: { [Op.lte]: fecha },
                fecha_fin: { [Op.gte]: fecha }
            }
        });
        return temporada;
    }

    getSemanaAno(date) {
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const diff = (date - startOfYear + (startOfYear.getTimezoneOffset() - date.getTimezoneOffset()) * 60000) / 86400000;
        return Math.ceil((diff + startOfYear.getDay() + 1) / 7);
    }

    obtenerRangoFechas(fechaInicio, fechaFin) {
        const fechas = [];
        let current = new Date(fechaInicio);
        const end = new Date(fechaFin);

        while (current <= end) {
            fechas.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }

        return fechas;
    }

    // Obtener variables para entrenamiento de ML
    async getVariablesParaML(hotelId, fechaInicio, fechaFin) {
        const ocupaciones = await OcupacionHotelera.findAll({
            where: {
                hotel_id: hotelId,
                fecha: { [Op.between]: [fechaInicio, fechaFin] }
            },
            order: [['fecha', 'ASC']]
        });

        const variables = await VariableEstacional.findAll({
            where: {
                fecha: { [Op.between]: [fechaInicio, fechaFin] }
            },
            order: [['fecha', 'ASC']]
        });

        // Combinar datos
        return ocupaciones.map((ocupacion, index) => ({
            fecha: ocupacion.fecha,
            ocupacion: ocupacion.tasa_ocupacion,
            mes: variables[index]?.mes || 0,
            dia_semana: variables[index]?.dia_semana || 0,
            es_festivo: variables[index]?.es_festivo || false,
            es_temporada_alta: variables[index]?.es_temporada_alta || false,
            factor_estacional: variables[index]?.factor_estacional || 1.0
        }));
    }
}

module.exports = new EstacionalService();