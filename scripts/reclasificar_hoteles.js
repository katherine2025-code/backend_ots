/**
 * reclasificar_hoteles.js
 * -----------------------------------------------------------------------------
 * Corrige el cantón (y, si hace falta, la parroquia) de los hoteles que se ven
 * en la columna equivocada en la pantalla de Hoteles.
 *
 * Es una migración FOCALIZADA: no fusiona duplicados, no borra fichas, no toca
 * precios ni habitaciones. A diferencia de corregir_hoteles.js (pensado para la
 * limpieza local), este script es seguro para ejecutarse en producción.
 *
 * Reglas, en este orden:
 *   1. Mapeo explícito de los 32 hoteles indicados: son la garantía. Si en
 *      producción la parroquia también estuviera mal, el mapeo manda.
 *   2. Para el resto, se recalcula el cantón desde la parroquia con la misma
 *      regla que usa el ETL (src/utils/cantones.js).
 *   3. Si la parroquia actual no pertenece al cantón esperado, se corrige la
 *      parroquia a una válida de ese cantón. Esto evita que el ETL, que
 *      recalcula cantón desde parroquia, vuelva a mover el hotel en la próxima
 *      carga.
 *
 * Uso:
 *   node scripts/reclasificar_hoteles.js              -> DRY-RUN (solo reporte)
 *   node scripts/reclasificar_hoteles.js --aplicar    -> aplica los cambios
 *
 * Antes de aplicar guarda un respaldo JSON completo de `hoteles` en
 * scripts/backups/. Para omitirlo (no recomendado) usar --sin-respaldo.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { cantonDeParroquia } = require('../src/utils/cantones');
require('dotenv').config({ quiet: true });

const APLICAR = process.argv.includes('--aplicar');
const SIN_RESPALDO = process.argv.includes('--sin-respaldo');

// Mapeo explícito solicitado. La parroquia es la que ya está validada en local
// y solo se usa si la parroquia guardada no pertenece al cantón esperado.
const UBICACION_ESPERADA = {
    // Deben estar en Salinas
    'Chescos': { canton: 'Salinas', parroquia: 'Salinas' },
    'Hostal tu ventura': { canton: 'Salinas', parroquia: 'Salinas' },
    'Hotel Caridi': { canton: 'Salinas', parroquia: 'Salinas' },
    'Hotel dorado inn': { canton: 'Salinas', parroquia: 'Salinas' },
    'Hotel eusakal beach': { canton: 'Salinas', parroquia: 'Salinas' },
    'Hotel isabella': { canton: 'Salinas', parroquia: 'Salinas' },
    'Hotel marvento ii': { canton: 'Salinas', parroquia: 'Salinas' },
    'Hotel Miami': { canton: 'Salinas', parroquia: 'Salinas' },
    'Hotel salinas': { canton: 'Salinas', parroquia: 'Salinas' },
    'Posada París': { canton: 'Salinas', parroquia: 'Salinas' },

    // Deben estar en Santa Elena
    'Rocío Boutique Hotel Restaurante': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'montañita cabañas': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'La Joya Hotel': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'iguana beach montañita': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'Hotel Tabuba': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'Hotel Pop House': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'Hotel Makai': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'hotel kundalini': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'Hotel Golden Beach': { canton: 'Santa Elena', parroquia: 'Colonche' },
    'hotel dharma beach': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'Hostería Montañita Estates': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'hostería armonía lodge': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'Hostal Tabuba Malecón': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'hostal sumpa': { canton: 'Santa Elena', parroquia: 'Colonche' },
    'Hostal Sol y Mar': { canton: 'Santa Elena', parroquia: 'Colonche' },
    'casa del merman': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'hostal angeles beach': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'hostal el tamarindo': { canton: 'Santa Elena', parroquia: 'Colonche' },
    'hostal gaspar': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'hostal lazy frog': { canton: 'Santa Elena', parroquia: 'Manglaralto' },
    'hostal ruta del sol': { canton: 'Santa Elena', parroquia: 'Santa Elena' },
    'Hostal Olas del Mar': { canton: 'Santa Elena', parroquia: 'Manglaralto' }
};

const normalizar = (texto) => String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const UBICACION_POR_NOMBRE = new Map(
    Object.entries(UBICACION_ESPERADA).map(([nombre, destino]) => [normalizar(nombre), { nombre, ...destino }])
);

const log = (...args) => console.log(...args);

/** Decide qué cambiar en una fila. Devuelve {} si ya está correcta. */
function calcularCambios(hotel) {
    const esperado = UBICACION_POR_NOMBRE.get(normalizar(hotel.nombre));
    const cantonDesdeParroquia = cantonDeParroquia(hotel.parroquia);
    const cantonEsperado = esperado ? esperado.canton : cantonDesdeParroquia;
    const cambios = {};

    if (!cantonEsperado) return cambios;

    if (hotel.canton !== cantonEsperado) cambios.canton = cantonEsperado;

    // La parroquia debe pertenecer al cantón esperado. Si no, el próximo ETL
    // volvería a recalcular el cantón desde ella y desharía la corrección.
    if (cantonDeParroquia(hotel.parroquia) !== cantonEsperado) {
        const parroquiaDestino = esperado?.parroquia
            || (cantonEsperado === 'Salinas' ? 'Salinas' : 'Santa Elena');
        if (hotel.parroquia !== parroquiaDestino) cambios.parroquia = parroquiaDestino;
    }

    return cambios;
}

function guardarRespaldo(hoteles) {
    const carpeta = path.join(__dirname, 'backups');
    fs.mkdirSync(carpeta, { recursive: true });
    const marca = new Date().toISOString().replace(/[:.]/g, '-');
    const archivo = path.join(carpeta, `hoteles-pre-reclasificacion-${marca}.json`);
    fs.writeFileSync(archivo, JSON.stringify(hoteles, null, 2), 'utf8');
    return archivo;
}

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: false
    });

    log(`Base de datos: ${process.env.DB_NAME} @ ${process.env.DB_HOST}`);
    log(`Modo: ${APLICAR ? 'APLICAR (escribe en la BD)' : 'DRY-RUN (solo reporte)'}\n`);

    try {
        const [hoteles] = await conn.query(
            'SELECT id_hotel, nombre, parroquia, canton FROM hoteles ORDER BY id_hotel'
        );

        const cambios = [];
        const sinCambios = [];
        for (const hotel of hoteles) {
            const diff = calcularCambios(hotel);
            if (Object.keys(diff).length > 0) cambios.push({ hotel, diff });
            else sinCambios.push(hotel);
        }

        // ------------------------------------------------------------------
        // Reporte de los 32 hoteles indicados
        // ------------------------------------------------------------------
        const porNombre = new Map();
        for (const hotel of hoteles) {
            const clave = normalizar(hotel.nombre);
            if (!porNombre.has(clave)) porNombre.set(clave, []);
            porNombre.get(clave).push(hotel);
        }

        const faltantes = [];
        let correctos = 0;
        let aCorregir = 0;

        log('=== Hoteles indicados (32) ===');
        for (const destino of UBICACION_POR_NOMBRE.values()) {
            const encontrados = porNombre.get(normalizar(destino.nombre)) || [];
            if (encontrados.length === 0) {
                faltantes.push(destino.nombre);
                log(`  FALTA        ${destino.nombre}`);
                continue;
            }
            for (const hotel of encontrados) {
                const diff = calcularCambios(hotel);
                if (Object.keys(diff).length === 0) {
                    correctos += 1;
                    log(`  OK           ${hotel.nombre} -> ${hotel.canton} (${hotel.parroquia})`);
                } else {
                    aCorregir += 1;
                    const detalle = [
                        diff.canton ? `cantón ${hotel.canton} -> ${diff.canton}` : null,
                        diff.parroquia ? `parroquia ${hotel.parroquia} -> ${diff.parroquia}` : null
                    ].filter(Boolean).join(' · ');
                    log(`  CORREGIR     ${hotel.nombre} (id ${hotel.id_hotel}): ${detalle}`);
                }
            }
        }
        log('');

        // ------------------------------------------------------------------
        // Resto de hoteles: solo la regla parroquia -> cantón
        // ------------------------------------------------------------------
        const otros = cambios.filter(({ hotel }) => !UBICACION_POR_NOMBRE.has(normalizar(hotel.nombre)));
        if (otros.length > 0) {
            log('=== Otros hoteles con cantón incoherente ===');
            for (const { hotel, diff } of otros) {
                const detalle = [
                    diff.canton ? `cantón ${hotel.canton} -> ${diff.canton}` : null,
                    diff.parroquia ? `parroquia ${hotel.parroquia} -> ${diff.parroquia}` : null
                ].filter(Boolean).join(' · ');
                log(`  ${hotel.id_hotel} "${hotel.nombre}": ${detalle}`);
            }
            log('');
        }

        log('=== Resumen ===');
        log(`  Hoteles en la BD: ${hoteles.length}`);
        log(`  Ya correctos: ${sinCambios.length}`);
        log(`  A corregir: ${cambios.length}`);
        log(`  De los 32 indicados: ${correctos} correctos, ${aCorregir} a corregir, ${faltantes.length} no encontrados`);
        log('');

        if (cambios.length === 0) {
            log('No hay cambios pendientes.');
        } else if (!APLICAR) {
            log('DRY-RUN: no se escribió nada. Ejecuta con --aplicar para guardar los cambios.');
        } else {
            if (!SIN_RESPALDO) {
                const archivo = guardarRespaldo(hoteles);
                log(`Respaldo guardado en: ${archivo}`);
            } else {
                log('ADVERTENCIA: se aplicó sin respaldo (--sin-respaldo).');
            }

            await conn.beginTransaction();
            try {
                for (const { hotel, diff } of cambios) {
                    const campos = [];
                    const valores = [];
                    if (diff.canton) { campos.push('canton = ?'); valores.push(diff.canton); }
                    if (diff.parroquia) { campos.push('parroquia = ?'); valores.push(diff.parroquia); }
                    valores.push(hotel.id_hotel);
                    await conn.query(`UPDATE hoteles SET ${campos.join(', ')} WHERE id_hotel = ?`, valores);
                }
                await conn.commit();
                log(`\nSe actualizaron ${cambios.length} hoteles.`);
            } catch (error) {
                await conn.rollback();
                throw error;
            }

            // Verificación posterior
            const [despues] = await conn.query('SELECT id_hotel, nombre, parroquia, canton FROM hoteles');
            const verificados = new Map();
            for (const hotel of despues) {
                const clave = normalizar(hotel.nombre);
                if (!verificados.has(clave)) verificados.set(clave, []);
                verificados.get(clave).push(hotel);
            }
            let ok = 0;
            let mal = 0;
            for (const destino of UBICACION_POR_NOMBRE.values()) {
                const encontrados = verificados.get(normalizar(destino.nombre)) || [];
                if (encontrados.length === 0) continue;
                if (encontrados.every(h => h.canton === destino.canton && cantonDeParroquia(h.parroquia) === destino.canton)) ok += 1;
                else { mal += 1; log(`  VERIFICACIÓN FALLIDA: ${destino.nombre}`); }
            }
            log(`Verificación final: ${ok}/${UBICACION_POR_NOMBRE.size} correctos, ${mal} con problemas.`);

            const [conteo] = await conn.query(
                'SELECT canton, COUNT(*) AS total FROM hoteles GROUP BY canton ORDER BY canton'
            );
            log('Distribución final por cantón:');
            conteo.forEach(fila => log(`  ${fila.canton || '(sin cantón)'}: ${fila.total}`));
        }

        if (faltantes.length > 0) {
            log(`\nATENCIÓN: ${faltantes.length} de los 32 nombres no existen en esta base.`);
            log('Revisa que producción use exactamente los mismos nombres antes de aplicar.');
            process.exitCode = 1;
        }
    } finally {
        await conn.end();
    }
})().catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
});
