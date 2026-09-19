// Ajustes de esquema que sequelize.sync({ alter: false }) no aplica sobre tablas que ya existen.
// Todo es idempotente: se ejecuta en cada arranque y solo actúa si falta algo.
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { PARROQUIAS_POR_CANTON } = require('../utils/cantones');

const existeColumna = async (tabla, columna) => {
    const [r] = await sequelize.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla AND COLUMN_NAME = :columna`,
        { replacements: { tabla, columna }, type: QueryTypes.SELECT }
    );
    return Number(r.n) > 0;
};

const agregarColumna = async (tabla, columna, definicion) => {
    if (await existeColumna(tabla, columna)) return false;
    await sequelize.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    console.log(`Columna ${tabla}.${columna} agregada`);
    return true;
};

const esquemaService = {
    async asegurarEsquema() {
        // Clasificación de hoteles por cantón (Santa Elena / Salinas)
        await agregarColumna('hoteles', 'canton', 'VARCHAR(30) NULL');

        // Feriado al que corresponde cada registro de ocupación (Carnaval, Semana Santa, ...)
        await agregarColumna('ocupacion_hotelera', 'feriado', 'VARCHAR(80) NULL');

        // Nuevo tipo de pregunta "date" (fecha) en los cuestionarios
        const [col] = await sequelize.query(
            `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'encuesta_preguntas' AND COLUMN_NAME = 'tipo'`,
            { type: QueryTypes.SELECT }
        );
        if (col && !col.t.includes("'date'")) {
            await sequelize.query(
                `ALTER TABLE encuesta_preguntas
                 MODIFY tipo ENUM('text','email','number','date','select','multiselect','escala') NOT NULL DEFAULT 'text'`
            );
            console.log("encuesta_preguntas.tipo ahora admite 'date'");
        }

        await this.clasificarHotelesPorCanton();
    },

    // Completa el cantón de los hoteles que aún no lo tienen a partir de su parroquia
    async clasificarHotelesPorCanton() {
        let total = 0;
        for (const [canton, parroquias] of Object.entries(PARROQUIAS_POR_CANTON)) {
            const [, meta] = await sequelize.query(
                `UPDATE hoteles SET canton = :canton
                 WHERE canton IS NULL AND LOWER(TRIM(parroquia)) IN (:parroquias)`,
                { replacements: { canton, parroquias: parroquias.map(p => p.toLowerCase()) } }
            );
            total += meta?.affectedRows ?? meta ?? 0;
        }
        if (total > 0) console.log(`${total} hotel(es) clasificados por cantón según su parroquia`);
    }
};

module.exports = esquemaService;
