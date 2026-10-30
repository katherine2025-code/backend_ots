/**
 * corregir_hoteles.js
 * -----------------------------------------------------------------------------
 * Corrige los datos de la tabla `hoteles` que se ven mal en la interfaz:
 *
 *  1. Fusiona fichas duplicadas (el mismo hotel cargado dos veces por el ETL).
 *     Se conserva la ficha del bloque ETL (1028-1089), que tiene la capacidad
 *     real, y se le mueve la ocupación de la ficha repetida antes de borrarla.
 *     También se copia el nombre con formato "bonito" (mayúsculas/minúsculas).
 *  2. Recalcula `canton` a partir de `parroquia` (la parroquia es el dato
 *     confiable: un hotel de Salinas nunca debe aparecer en Santa Elena).
 *  3. Rellena `precio_promedio` con el promedio real de `tarifa_cobrada`
 *     (antes 104 hoteles estaban en 0.00 y 20 repetían 35.00).
 *  4. Rellena `habitaciones_totales` en 0 usando la capacidad real registrada
 *     en la ocupación.
 *  5. Elimina la ficha basura id 1111 (nombre "1", sin ocupación).
 *
 * Uso:
 *   node scripts/corregir_hoteles.js            -> solo reporta (dry-run)
 *   node scripts/corregir_hoteles.js --apply    -> aplica los cambios
 *
 * Antes de aplicar guarda un respaldo JSON completo de hoteles y ocupación.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { cantonDeParroquia } = require('../src/utils/cantones');
require('dotenv').config({ quiet: true });

const APLICAR = process.argv.includes('--apply');

// Ficha repetida -> ficha que se conserva. La clave es la que se BORRA.
// Las fichas conservadas son las del bloque 1028-1089 (capacidad real del ETL).
const DUPLICADOS = {
    1019: { conservar: 1087, nombre: 'La Joya Hotel' },
    1021: { conservar: 1077, nombre: 'Hotel Vikara Retreat' },
    1022: { conservar: 1072, nombre: 'Hostal Olas del Mar' },
    1023: { conservar: 1071, nombre: 'Hotel La Jungla' },
    1024: { conservar: 1076, nombre: 'Hotel Altamar' },
    1026: { conservar: 1075, nombre: 'Hostal Pachos House' },

    1112: { conservar: 1067, nombre: 'Casa de Huésped Barlovento' },
    1114: { conservar: 1040, nombre: 'Rocío Boutique Hotel Restaurante' },
    1115: { conservar: 1041, nombre: 'Hotel Galeón' },
    1116: { conservar: 1030, nombre: 'Hotel Tabuba' },
    1117: { conservar: 1036, nombre: 'Hotel Friend\'s' },
    1118: { conservar: 1064, nombre: 'Hostería Montañita Estates' },
    1119: { conservar: 1039, nombre: 'Hostal Tabuba Malecón' },
    1120: { conservar: 1043, nombre: 'Hotel Makai' },
    1121: { conservar: 1046, nombre: 'Casa de Huéspedes Sapa Inka' },
    1122: { conservar: 1045, nombre: 'Hostal Mamá Cucha' },
    1123: { conservar: 1056, nombre: 'Casa Surf Brothers He\'e Nalu' },
    1124: { conservar: 1058, nombre: 'Hotel Pop House' },
    1125: { conservar: 1049, nombre: 'Hostal Sole Mare' },
    1126: { conservar: 1054, nombre: 'Hotel Hanga Roa' },
    1127: { conservar: 1051, nombre: 'Tres Palmas Boutique Hotel & Surf Retreats' },
    1128: { conservar: 1065, nombre: 'Hostería La Casa del Sombrero' },
    1130: { conservar: 1078, nombre: 'Hostal Sol y Mar' },
    1131: { conservar: 1084, nombre: 'Hotel Seahorse' },
    1132: { conservar: 1081, nombre: 'Hotel Golden Beach' }
};

// Fichas que no son hoteles reales.
const BASURA = [1111];

const log = (...a) => console.log(...a);

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: false
    });

    log(`Modo: ${APLICAR ? 'APLICAR (escribe en la BD)' : 'DRY-RUN (solo reporte)'}\n`);

    // ---------------------------------------------------------------------
    // Respaldo completo antes de tocar nada
    // ---------------------------------------------------------------------
    const [hotelesAntes] = await conn.query('SELECT * FROM hoteles ORDER BY id_hotel');
    const [ocupacionAntes] = await conn.query('SELECT * FROM ocupacion_hotelera ORDER BY id_ocupacion');
    const dirBackups = path.join(__dirname, 'backups');
    if (!fs.existsSync(dirBackups)) fs.mkdirSync(dirBackups, { recursive: true });
    const sello = new Date().toISOString().replace(/[:.]/g, '-');
    const archivoBackup = path.join(dirBackups, `hoteles-backup-${sello}.json`);
    fs.writeFileSync(archivoBackup, JSON.stringify({ hoteles: hotelesAntes, ocupacion: ocupacionAntes }, null, 2), 'utf8');
    log(`Respaldo guardado en: ${archivoBackup}\n`);

    const porId = new Map(hotelesAntes.map(h => [h.id_hotel, h]));
    const resumen = {
        fusionados: [],
        renombrados: [],
        cantonCorregido: [],
        preciosActualizados: [],
        habitacionesActualizadas: [],
        eliminados: [],
        conflictos: []
    };

    const [ocupacionPorHotel] = await conn.query(`
        SELECT id_hotel,
               COUNT(*) AS registros,
               ROUND(AVG(tarifa_cobrada), 2) AS tarifa_promedio,
               MAX(habitaciones_disponibles) AS capacidad
        FROM ocupacion_hotelera
        GROUP BY id_hotel`);
    const stats = new Map(ocupacionPorHotel.map(r => [r.id_hotel, r]));

    if (APLICAR) await conn.beginTransaction();

    try {
        // -----------------------------------------------------------------
        // 1. Fusionar duplicados
        // -----------------------------------------------------------------
        log('=== 1. DUPLICADOS ===');
        for (const [idBorrarStr, cfg] of Object.entries(DUPLICADOS)) {
            const idBorrar = Number(idBorrarStr);
            const borrar = porId.get(idBorrar);
            const conservar = porId.get(cfg.conservar);

            if (!borrar || !conservar) {
                resumen.conflictos.push(`Par ${idBorrar} -> ${cfg.conservar}: falta una de las fichas`);
                log(`  ⚠ Par ${idBorrar} -> ${cfg.conservar}: falta una de las fichas, se omite`);
                continue;
            }

            // Mover ocupación que no choque con una fecha ya existente en el destino
            const [filas] = await conn.query(
                'SELECT id_ocupacion, fecha FROM ocupacion_hotelera WHERE id_hotel = ?', [idBorrar]);
            const [fechasDestino] = await conn.query(
                'SELECT fecha FROM ocupacion_hotelera WHERE id_hotel = ?', [cfg.conservar]);
            const ocupadas = new Set(fechasDestino.map(f => String(f.fecha).slice(0, 10)));

            const mover = [];
            const duplicadas = [];
            for (const f of filas) {
                if (ocupadas.has(String(f.fecha).slice(0, 10))) duplicadas.push(f.id_ocupacion);
                else mover.push(f.id_ocupacion);
            }

            if (APLICAR) {
                if (mover.length) {
                    await conn.query(
                        `UPDATE ocupacion_hotelera SET id_hotel = ? WHERE id_ocupacion IN (${mover.map(() => '?').join(',')})`,
                        [cfg.conservar, ...mover]);
                }
                if (duplicadas.length) {
                    // La fecha ya existe en la ficha que se conserva: se descarta la fila repetida.
                    await conn.query(
                        `DELETE FROM ocupacion_hotelera WHERE id_ocupacion IN (${duplicadas.map(() => '?').join(',')})`,
                        duplicadas);
                }
                await conn.query('UPDATE predicciones SET id_hotel = ? WHERE id_hotel = ?', [cfg.conservar, idBorrar]);
                await conn.query('UPDATE encuestas_turisticas SET id_hotel = ? WHERE id_hotel = ?', [cfg.conservar, idBorrar]);
                await conn.query('DELETE FROM hoteles WHERE id_hotel = ?', [idBorrar]);
            }

            resumen.fusionados.push({ borrado: idBorrar, conservado: cfg.conservar, ocupacionMovida: mover.length, ocupacionDescartada: duplicadas.length });
            log(`  ${idBorrar} "${borrar.nombre}" -> ${cfg.conservar} "${conservar.nombre}"` +
                ` (${mover.length} ocupación movida${duplicadas.length ? `, ${duplicadas.length} repetida descartada` : ''})`);

            // Nombre con formato presentable en la ficha que se conserva
            if (cfg.nombre && cfg.nombre !== conservar.nombre) {
                if (APLICAR) await conn.query('UPDATE hoteles SET nombre = ? WHERE id_hotel = ?', [cfg.nombre, cfg.conservar]);
                resumen.renombrados.push({ id: cfg.conservar, antes: conservar.nombre, despues: cfg.nombre });
                log(`     nombre: "${conservar.nombre}" -> "${cfg.nombre}"`);
            }
            porId.delete(idBorrar);
        }

        // -----------------------------------------------------------------
        // 2. Eliminar fichas basura
        // -----------------------------------------------------------------
        log('\n=== 2. FICHAS BASURA ===');
        for (const id of BASURA) {
            const h = porId.get(id);
            if (!h) { log(`  ${id}: ya no existe`); continue; }
            if (APLICAR) {
                await conn.query('DELETE FROM ocupacion_hotelera WHERE id_hotel = ?', [id]);
                await conn.query('UPDATE predicciones SET id_hotel = NULL WHERE id_hotel = ?', [id]);
                await conn.query('DELETE FROM hoteles WHERE id_hotel = ?', [id]);
            }
            resumen.eliminados.push({ id, nombre: h.nombre });
            log(`  Eliminado ${id} "${h.nombre}"`);
            porId.delete(id);
        }

        // -----------------------------------------------------------------
        // 3. Recalcular cantón desde la parroquia
        // -----------------------------------------------------------------
        log('\n=== 3. CLASIFICACIÓN POR CANTÓN ===');
        for (const h of porId.values()) {
            const cantonCorrecto = cantonDeParroquia(h.parroquia);
            if (cantonCorrecto && h.canton !== cantonCorrecto) {
                if (APLICAR) await conn.query('UPDATE hoteles SET canton = ? WHERE id_hotel = ?', [cantonCorrecto, h.id_hotel]);
                resumen.cantonCorregido.push({ id: h.id_hotel, antes: h.canton, despues: cantonCorrecto });
                log(`  ${h.id_hotel} "${h.nombre}" (${h.parroquia}): ${h.canton} -> ${cantonCorrecto}`);
            }
        }
        if (resumen.cantonCorregido.length === 0) log('  Todos los cantones ya coinciden con su parroquia.');

        // -----------------------------------------------------------------
        // 4. Precio promedio real
        // -----------------------------------------------------------------
        log('\n=== 4. PRECIOS ===');
        // Mediana por cantón+categoría como respaldo si un hotel no tiene tarifas.
        const [medianas] = await conn.query(`
            SELECT h.canton, h.categoria,
                   AVG(o.tarifa_cobrada) AS tarifa_promedio
            FROM hoteles h
            JOIN ocupacion_hotelera o ON o.id_hotel = h.id_hotel
            WHERE o.tarifa_cobrada > 0
            GROUP BY h.canton, h.categoria`);
        const respaldo = new Map(medianas.map(r => [`${r.canton}|${r.categoria}`, Number(r.tarifa_promedio)]));

        for (const h of porId.values()) {
            const st = stats.get(h.id_hotel);
            const promedio = st && st.tarifa_promedio ? Number(st.tarifa_promedio) : null;
            const precio = promedio || respaldo.get(`${h.canton}|${h.categoria}`) || null;
            if (precio === null) {
                log(`  ⚠ ${h.id_hotel} "${h.nombre}": sin tarifas, se deja el precio actual (${h.precio_promedio})`);
                resumen.conflictos.push(`Hotel ${h.id_hotel} sin tarifas para calcular precio`);
                continue;
            }
            const redondeado = Math.round(precio * 100) / 100;
            if (Number(h.precio_promedio) !== redondeado) {
                if (APLICAR) await conn.query('UPDATE hoteles SET precio_promedio = ? WHERE id_hotel = ?', [redondeado, h.id_hotel]);
                resumen.preciosActualizados.push({ id: h.id_hotel, antes: Number(h.precio_promedio), despues: redondeado });
            }
        }
        log(`  Precios corregidos: ${resumen.preciosActualizados.length}`);

        // -----------------------------------------------------------------
        // 5. Habitaciones totales cuando están en 0
        // -----------------------------------------------------------------
        log('\n=== 5. HABITACIONES ===');
        for (const h of porId.values()) {
            const st = stats.get(h.id_hotel);
            if (Number(h.habitaciones_totales) > 0) continue;
            const capacidad = st && st.capacidad ? Number(st.capacidad) : 0;
            if (capacidad > 0) {
                if (APLICAR) await conn.query('UPDATE hoteles SET habitaciones_totales = ? WHERE id_hotel = ?', [capacidad, h.id_hotel]);
                resumen.habitacionesActualizadas.push({ id: h.id_hotel, despues: capacidad });
                log(`  ${h.id_hotel} "${h.nombre}": 0 -> ${capacidad} habitaciones`);
            } else {
                log(`  ⚠ ${h.id_hotel} "${h.nombre}": sin capacidad registrada`);
                resumen.conflictos.push(`Hotel ${h.id_hotel} sin capacidad para calcular habitaciones`);
            }
        }
        if (resumen.habitacionesActualizadas.length === 0) log('  Ningún hotel quedó con 0 habitaciones.');

        if (APLICAR) {
            await conn.commit();
            log('\n✅ Cambios aplicados y confirmados.');
        } else {
            await conn.rollback();
            log('\nℹ️  Dry-run: no se escribió nada. Ejecuta con --apply para aplicar.');
        }

        // -----------------------------------------------------------------
        // Resumen y verificación
        // -----------------------------------------------------------------
        log('\n=== RESUMEN ===');
        log(`  Duplicados fusionados : ${resumen.fusionados.length}`);
        log(`  Fichas eliminadas    : ${resumen.eliminados.length}`);
        log(`  Nombres corregidos   : ${resumen.renombrados.length}`);
        log(`  Cantones corregidos  : ${resumen.cantonCorregido.length}`);
        log(`  Precios corregidos   : ${resumen.preciosActualizados.length}`);
        log(`  Habitaciones llenadas: ${resumen.habitacionesActualizadas.length}`);
        log(`  Conflictos           : ${resumen.conflictos.length}`);
        for (const c of resumen.conflictos) log(`    - ${c}`);

        if (APLICAR) {
            const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM hoteles');
            const [porCanton] = await conn.query(`
                SELECT canton, COUNT(*) AS n, ROUND(AVG(precio_promedio), 2) AS precio
                FROM hoteles GROUP BY canton ORDER BY canton`);
            log(`\n  Hoteles finales: ${total}`);
            console.table(porCanton);
            const [sinPrecio] = await conn.query('SELECT COUNT(*) AS n FROM hoteles WHERE precio_promedio IS NULL OR precio_promedio = 0');
            const [sinHab] = await conn.query('SELECT COUNT(*) AS n FROM hoteles WHERE habitaciones_totales = 0');
            log(`  Hoteles sin precio: ${sinPrecio[0].n}`);
            log(`  Hoteles sin habitaciones: ${sinHab[0].n}`);

            // Reporte para revisión
            const archivoReporte = path.join(dirBackups, `hoteles-reporte-${sello}.json`);
            fs.writeFileSync(archivoReporte, JSON.stringify(resumen, null, 2), 'utf8');
            log(`  Reporte: ${archivoReporte}`);
        }

        await conn.end();
    } catch (err) {
        if (APLICAR) await conn.rollback();
        console.error('\n❌ Error, cambios revertidos:', err.message);
        await conn.end();
        process.exit(1);
    }
})().catch(err => { console.error(err); process.exit(1); });
