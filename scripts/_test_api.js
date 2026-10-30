/**
 * _test_api.js — prueba de humo de Predicciones y Hoteles (no forma parte de la app).
 * Genera tokens por rol, llama a los endpoints reales y verifica permisos,
 * persistencia y que regenerar una proyección no duplique resultados.
 */
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });

const BASE = 'http://127.0.0.1:3000/api';
let pasadas = 0;
let fallidas = 0;

const token = (id_usuario, id_rol, correo) => jwt.sign(
    { id_usuario, id_rol, correo }, process.env.JWT_SECRET, { expiresIn: '1h' }
);

const T = {
    0: token(4, 0, 'katherinemujicatomala4739@upse.edu.ec'),
    1: token(5, 1, 'myriam.sarabia@upse.edu.ec'),
    2: token(12, 2, 'emilio.delgado@upse.edu.ec'),
    3: token(11, 3, 'juaniperez@upse.edu.ec')
};

const api = async (ruta, { rol = 1, metodo = 'GET', body } = {}) => {
    const res = await fetch(`${BASE}${ruta}`, {
        method: metodo,
        headers: {
            Authorization: `Bearer ${T[rol]}`,
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    let datos = null;
    try { datos = await res.json(); } catch { /* respuesta vacía */ }
    return { status: res.status, datos };
};

const check = (nombre, condicion, detalle = '') => {
    if (condicion) { pasadas++; console.log(`  OK   ${nombre}`); }
    else { fallidas++; console.log(`  FALLA ${nombre} ${detalle}`); }
};

(async () => {
    console.log('\n=== PERMISOS DE LECTURA ===');
    for (const rol of [0, 1, 2]) {
        const r = await api('/predicciones?limite=5', { rol });
        check(`GET /predicciones rol ${rol} -> 200`, r.status === 200, `status=${r.status}`);
    }
    let r = await api('/predicciones?limite=5', { rol: 3 });
    check('GET /predicciones rol 3 (encuestador) -> 403', r.status === 403, `status=${r.status}`);

    console.log('\n=== VALIDACIÓN HISTÓRICA (30% DE PRUEBA) ===');
    r = await api('/predicciones/ml/historicas', { rol: 2 });
    check('GET /ml/historicas rol 2 -> 200', r.status === 200, `status=${r.status}`);
    if (r.status === 200) {
        console.log(`       registros=${r.datos.total_registros} conjunto=${r.datos.conjunto_evaluado}` +
            ` precision_modelo=${r.datos.precision_modelo} rmse=${r.datos.rmse}` +
            ` mae=${r.datos.mae} r2=${r.datos.r2}`);
        check('Evalúa solo el 30% de prueba', r.datos.conjunto_evaluado === 'prueba', r.datos.conjunto_evaluado);
        check('Precisión coincide con el modelo (61.44)', Number(r.datos.precision_modelo) === 61.44, r.datos.precision_modelo);
        check('Devuelve registros para los histogramas', (r.datos.predicciones || []).length > 0);
        check('Cada registro trae real/predicho/error/precisión', (r.datos.predicciones || []).every(p =>
            p.valor_real !== undefined && p.valor_predicho !== undefined &&
            p.error !== undefined && p.precision !== undefined));
    }
    r = await api('/predicciones/ml/historicas', { rol: 3 });
    check('GET /ml/historicas rol 3 -> 403', r.status === 403, `status=${r.status}`);

    console.log('\n=== PERMISOS DE GENERACIÓN Y VALIDACIÓN ===');
    const rango = { fecha_inicio: '2026-11-01', fecha_fin: '2026-11-03' };
    r = await api('/predicciones/predecir-rango', { rol: 1, metodo: 'POST', body: rango });
    check('POST /predecir-rango rol 1 (admin) -> 403', r.status === 403, `status=${r.status}`);

    r = await api('/predicciones/predecir-rango', { rol: 2, metodo: 'POST', body: rango });
    check('POST /predecir-rango rol 2 (investigador) -> 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.datos)?.slice(0, 120)}`);
    if (r.status === 200) {
        console.log(`       días=${r.datos.total_dias} promedio=${r.datos.ocupacion_promedio}% persistida=${r.datos.persistida}`);
        check('Persistió la proyección', r.datos.persistida === true);
    }

    r = await api('/predicciones?limite=30', { rol: 1 });
    let generadas = (r.datos || []).filter(p => String(p.fecha).startsWith('2026-11-0'));
    check('Admin ve las proyecciones generadas', generadas.length === 3, `encontradas=${generadas.length}`);
    check('Proyección general guardada con id_hotel NULL', generadas.every(p => p.id_hotel === null));
    const primera = generadas[0];
    if (primera) {
        console.log(`       muestra: fecha=${primera.fecha} predicha=${primera.ocupacion_predicha}%` +
            ` precision=${primera.precision_modelo} modelo=${primera.modelo_utilizado} estado=${primera.estado}` +
            ` rango=[${primera.intervalo_confianza_min}, ${primera.intervalo_confianza_max}]`);
        check('Precisión guardada = 61.44', Number(primera.precision_modelo) === 61.44, primera.precision_modelo);
    }

    r = await api(`/predicciones/${primera.id_prediccion}/validar`, { rol: 1, metodo: 'PUT', body: {} });
    check('Validar con rol 1 -> 403', r.status === 403, `status=${r.status}`);
    r = await api(`/predicciones/${primera.id_prediccion}/validar`, { rol: 0, metodo: 'PUT', body: {} });
    check('Validar con rol 0 -> 200', r.status === 200, `status=${r.status}`);

    // Regenerar el mismo rango: reemplaza pendientes pero conserva la validada.
    r = await api('/predicciones/predecir-rango', { rol: 2, metodo: 'POST', body: rango });
    check('Regenerar la misma proyección -> 200', r.status === 200, `status=${r.status}`);
    r = await api('/predicciones?limite=30', { rol: 1 });
    const despues = (r.datos || []).filter(p => String(p.fecha).startsWith('2026-11-0'));
    const validadas = despues.filter(p => p.estado === 'validada');
    const pendientes = despues.filter(p => p.estado === 'pendiente');
    console.log(`       tras regenerar: ${despues.length} filas (${validadas.length} validadas, ${pendientes.length} pendientes)`);
    check('Conserva 1 validada y deja 3 pendientes (sin duplicar)', validadas.length === 1 && pendientes.length === 3,
        `validadas=${validadas.length} pendientes=${pendientes.length}`);

    console.log('\n=== HOTELES (CLASIFICACIÓN Y PRECIOS) ===');
    r = await api('/hoteles', { rol: 1 });
    check('GET /hoteles -> 200', r.status === 200, `status=${r.status}`);
    if (r.status === 200) {
        const hoteles = r.datos || [];
        check('98 hoteles tras la limpieza', hoteles.length === 98, `total=${hoteles.length}`);
        check('Ninguno sin precio', hoteles.every(h => Number(h.precio_promedio) > 0));
        check('Ninguno sin habitaciones', hoteles.every(h => Number(h.habitaciones_totales) > 0));
        check('Cantones solo Santa Elena/Salinas', hoteles.every(h => h.canton === 'Santa Elena' || h.canton === 'Salinas'));
        const salinas = hoteles.filter(h => h.canton === 'Salinas');
        check('Ningún hotel de parroquia Salinas quedó en Santa Elena',
            salinas.every(h => !['Salinas', 'Anconcito', 'José Luis Tamayo'].includes(h.parroquia) || h.canton === 'Salinas'));
        check('Ordenados por cantón y nombre', hoteles.every((h, i) => {
            if (i === 0) return true;
            const prev = hoteles[i - 1];
            const c = String(prev.canton).localeCompare(String(h.canton));
            return c < 0 || (c === 0 && String(prev.nombre).localeCompare(String(h.nombre), 'es', { sensitivity: 'base' }) <= 0);
        }));
        console.log(`       Salinas=${salinas.length} Santa Elena=${hoteles.length - salinas.length}`);
        const precios = [...new Set(hoteles.map(h => Number(h.precio_promedio)))];
        console.log(`       precios distintos=${precios.length} (antes casi todos 35.00)`);
    }

    // Limpieza: dejar la tabla como estaba (vacía) para no mezclar datos de prueba.
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, database: process.env.DB_NAME
    });
    const [del] = await conn.query(
        "DELETE FROM predicciones WHERE fecha BETWEEN '2026-11-01' AND '2026-11-03'"
    );
    await conn.end();
    console.log(`\nLimpieza: ${del.affectedRows} predicciones de prueba eliminadas.`);

    console.log(`\n=== RESULTADO: ${pasadas} OK, ${fallidas} FALLAS ===`);
    process.exit(fallidas === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR GENERAL:', e); process.exit(1); });
