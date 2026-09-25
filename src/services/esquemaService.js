// Ajustes de esquema que sequelize.sync({ alter: false }) no aplica sobre tablas que ya existen.
// Todo es idempotente: se ejecuta en cada arranque y solo actúa si falta algo.
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { PARROQUIAS_POR_CANTON } = require('../utils/cantones');
const { FERIADOS_2026 } = require('../utils/feriados');

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

        // Lugares que el turista dijo haber visitado (para el mapa del dashboard). Lo llena el
        // ETL al extraerlo del formulario de Kobo (columna "¿Qué lugares piensa visitar...?").
        await agregarColumna('encuestas_turisticas', 'lugares_visitados', 'JSON NULL');

        // Identificador único del envío en KoboToolbox (columna "_uuid" del archivo exportado).
        // Antes, subir dos veces el mismo archivo (o dos exportaciones que se superponen, como
        // pasó con Salinas en agosto) duplicaba filas sin avisar - con esto el ETL puede detectar
        // "esta fila ya está" y omitirla, igual que ya hace con las respuestas desde el celular.
        await agregarColumna('ocupacion_hotelera', 'uuid_kobo', 'VARCHAR(64) NULL UNIQUE');
        await agregarColumna('encuestas_turisticas', 'uuid_kobo', 'VARCHAR(64) NULL UNIQUE');
        await this.recuperarUuidHistorico();

        // Cuántos de los días del formulario (Fecha 1..5) reportó el hotel en ese envío. Con él, el
        // % de ocupación se calcula como habitaciones ocupadas / (capacidad x días reportados), que es
        // la fórmula MINTUR aplicada al período. NULL = registro anterior a esta columna, sin recalcular.
        await agregarColumna('ocupacion_hotelera', 'dias_reportados', 'INT NULL');

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
        await this.corregirOcupacionHistorica();
        await this.recuperarCapacidadSalinasAgosto2026();
        await this.cargarFeriadosOficiales2026();
        await this.agregarProphetAModeloEnum();
    },

    // El tercer modelo de Machine Learning (Prophet) se suma a Random Forest y XGBoost.
    async agregarProphetAModeloEnum() {
        const [col] = await sequelize.query(
            `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'predicciones' AND COLUMN_NAME = 'modelo_utilizado'`,
            { type: QueryTypes.SELECT }
        );
        if (col && !col.t.includes("'Prophet'")) {
            await sequelize.query(
                `ALTER TABLE predicciones MODIFY modelo_utilizado ENUM('RandomForest','XGBoost','Prophet') NOT NULL`
            );
            console.log("predicciones.modelo_utilizado ahora admite 'Prophet'");
        }
    },

    // Calendario oficial 2026 (ver utils/feriados.js, con la fuente citada). Solo se carga si la
    // tabla está vacía: si el administrador ya subió su propio calendario por el ETL, no se pisa.
    // Esto alimenta el filtro "por feriado" de Ocupación Y las variables estacionales del modelo
    // de Machine Learning (variables_estacionales.py las lee de esta misma tabla `feriados`).
    async cargarFeriadosOficiales2026() {
        const [[{ n }]] = await sequelize.query('SELECT COUNT(*) AS n FROM feriados');
        if (Number(n) > 0) return;

        for (const f of FERIADOS_2026) {
            const dias = Math.round(
                (new Date(f.fechaFin).getTime() - new Date(f.fechaInicio).getTime()) / 86400000
            ) + 1;
            await sequelize.query(
                `INSERT INTO feriados (nombre, fecha_inicio, fecha_fin, total_dias, temporada, descripcion)
                 VALUES (:nombre, :inicio, :fin, :dias, :temporada, :descripcion)`,
                {
                    replacements: {
                        nombre: f.nombre, inicio: f.fechaInicio, fin: f.fechaFin, dias, temporada: f.temporada,
                        descripcion: 'Calendario oficial 2026 (Ministerio de Turismo / decretos del Ejecutivo, recogido por prensa nacional).'
                    }
                }
            );
        }
        console.log(`Calendario oficial de feriados 2026 cargado (${FERIADOS_2026.length} feriados)`);
    },

    // Las cargas ETL (Kobo y CSV de la app) insertan con SQL directo, sin pasar por los hooks de
    // Sequelize (beforeCreate/beforeUpdate) que calculan total_turistas y ocupacion_porcentaje.
    // Por eso 94 registros históricos quedaron con total_turistas=0 y habitaciones_totales=0,
    // aunque los campos de origen (checkin_nacionales/extranjeros, habitaciones_disponibles) sí
    // los traían. Se corrige aquí con datos que ya están en la misma fila (no se inventa nada).
    // ocupacion_porcentaje NO se toca: cuando habitaciones_disponibles también es 0 no hay forma
    // de saber la capacidad real de ese hotel ese día, y el frontend ya distingue "sin datos" de "0%".
    async corregirOcupacionHistorica() {
        const [, metaTuristas] = await sequelize.query(
            `UPDATE ocupacion_hotelera
             SET total_turistas = checkin_nacionales + checkin_extranjeros
             WHERE total_turistas = 0 AND (checkin_nacionales > 0 OR checkin_extranjeros > 0)`
        );
        const [, metaHabitaciones] = await sequelize.query(
            `UPDATE ocupacion_hotelera
             SET habitaciones_totales = habitaciones_disponibles
             WHERE habitaciones_totales = 0 AND habitaciones_disponibles > 0`
        );
        const corregidos = (metaTuristas?.affectedRows ?? metaTuristas ?? 0) + (metaHabitaciones?.affectedRows ?? metaHabitaciones ?? 0);
        if (corregidos > 0) {
            console.log(`Ocupación histórica corregida: total_turistas/habitaciones_totales completados en ${corregidos} campo(s)`);
        }
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
    },

    // Los 31 registros de la carga de Salinas (agosto/2026) quedaron con habitaciones_disponibles=0
    // por un bug de detección de columna en kobo_establecimientos.py (ya corregido para cargas
    // futuras). Se recuperó el valor real releyendo el archivo original y cruzándolo 1 a 1 contra
    // estos registros (mismo hotel + misma fecha + mismas habitaciones_ocupadas, ya calculado de
    // forma independiente) - ver seeds/recuperacionOcupacionSalinas.js. Solo toca cada fila si
    // sigue en 0, para no pisar un dato que ya se haya corregido de otra forma.
    async recuperarCapacidadSalinasAgosto2026() {
        const datos = require('../seeds/recuperacionOcupacionSalinas');
        let aplicados = 0;
        for (const { id_ocupacion, habitaciones_disponibles } of datos) {
            const [, meta] = await sequelize.query(
                `UPDATE ocupacion_hotelera
                 SET habitaciones_disponibles = :hd,
                     habitaciones_totales = :hd,
                     ocupacion_porcentaje = LEAST(100, habitaciones_ocupadas / :hd * 100)
                 WHERE id_ocupacion = :id AND habitaciones_disponibles = 0`,
                { replacements: { id: id_ocupacion, hd: habitaciones_disponibles } }
            );
            aplicados += meta?.affectedRows ?? meta ?? 0;
        }
        if (aplicados > 0) {
            console.log(`Capacidad recuperada para ${aplicados} registro(s) de ocupación (Salinas, agosto 2026)`);
        }
    },

    // Los registros de ocupación/encuestas ya cargados (antes de existir uuid_kobo) no traían el
    // identificador único de su envío en Kobo, así que no quedaban protegidos si alguien volvía a
    // subir ese mismo archivo (o una versión que se superpone, como pasó con Salinas). Se recupera
    // aquí el _uuid real de cada uno, releyendo los archivos originales:
    //  - Hoteles (seeds/recuperacionUuidHoteles.json, 77 de 94 filas): cruce por hotel + fecha +
    //    habitaciones ocupadas (ya calculado de forma independiente), 1 a 1, sin ambigüedad. Las
    //    17 filas restantes tienen caracteres ilegibles en el nombre del hotel en el archivo
    //    original (corrupción de origen, no reparable) y quedan sin esta protección retroactiva.
    //  - Encuestas turísticas (seeds/recuperacionUuidTurismo.json, las 4916 filas): el archivo se
    //    cargó de una sola vez y en el mismo orden en que aparece en el Excel/CSV (se verificó que
    //    la cantidad de filas del archivo y las de la base coinciden EXACTO, sin ninguna fila de
    //    por medio con error), así que se empareja por posición. Es una garantía más débil que el
    //    cruce por contenido de hoteles, pero el único riesgo si algo no calzara sería no detectar
    //    un duplicado en un caso puntual - nunca altera una respuesta real de una encuesta.
    // Solo toca filas que sigan sin uuid_kobo, para no pisar nada que ya se haya resuelto.
    async recuperarUuidHistorico() {
        const aplicar = async (tabla, columnaId, datos) => {
            let aplicados = 0;
            for (const { uuid, ...resto } of datos) {
                const id = resto.id_ocupacion ?? resto.id_encuesta;
                const [, meta] = await sequelize.query(
                    `UPDATE ${tabla} SET uuid_kobo = :uuid WHERE ${columnaId} = :id AND uuid_kobo IS NULL`,
                    { replacements: { uuid, id } }
                );
                aplicados += meta?.affectedRows ?? meta ?? 0;
            }
            return aplicados;
        };

        const hoteles = await aplicar('ocupacion_hotelera', 'id_ocupacion', require('../seeds/recuperacionUuidHoteles.json'));
        const turismo = await aplicar('encuestas_turisticas', 'id_encuesta', require('../seeds/recuperacionUuidTurismo.json'));
        if (hoteles || turismo) {
            console.log(`uuid_kobo recuperado: ${hoteles} registro(s) de ocupación, ${turismo} de encuestas turísticas`);
        }
    }
};

module.exports = esquemaService;
