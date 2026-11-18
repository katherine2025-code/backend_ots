// Normaliza el campo de "lugar de residencia" (texto libre) a un país canónico.
// La gente escribe de todo: "Ecuador", "ECUADOR", "ecuador", o ciudades/provincias
// del Ecuador ("Cuenca", "Guayaquil", "Manabí", "Salinas"). Aquí se unifica para que
// en la tabulación aparezca un solo valor por país, sin importar mayúsculas, tildes o
// que hayan puesto una ciudad en lugar del país. Esto es depuración de datos, NO inventar:
// solo se agrupa lo que semánticamente es el mismo origen.

// Quita tildes/diacríticos y pasa a minúsculas, colapsando espacios → clave de comparación.
function clave(txt) {
    return String(txt || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
        .toLowerCase()
        .replace(/[.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Title Case respetando la clave (para valores desconocidos: al menos unifica may/min).
function titulo(clv) {
    return clv.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Lugares del Ecuador (provincias, cantones y ciudades frecuentes) → todos cuentan como "Ecuador".
const LUGARES_ECUADOR = new Set([
    'ecuador', 'republica del ecuador', 'el ecuador', 'ecuatoriana', 'ecuatoriano',
    // Provincias
    'azuay', 'bolivar', 'canar', 'carchi', 'chimborazo', 'cotopaxi', 'el oro', 'esmeraldas',
    'galapagos', 'guayas', 'imbabura', 'loja', 'los rios', 'manabi', 'morona santiago', 'napo',
    'orellana', 'pastaza', 'pichincha', 'santa elena', 'santo domingo de los tsachilas',
    'sucumbios', 'tungurahua', 'zamora chinchipe',
    // Cantones / ciudades frecuentes
    'cuenca', 'guayaquil', 'quito', 'salinas', 'la libertad', 'libertad', 'ballenita', 'santa elena',
    'montanita', 'ambato', 'machala', 'portoviejo', 'manta', 'riobamba', 'ibarra', 'milagro',
    'duran', 'guaranda', 'babahoyo', 'quevedo', 'latacunga', 'tulcan', 'azogues', 'tena', 'puyo',
    'macas', 'zamora', 'santo domingo', 'playas', 'general villamil playas', 'daule', 'samborondon',
    'milagros', 'esmeralda',
    'jipijapa', 'chone', 'bahia de caraquez', 'ventanas', 'vinces', 'nueva loja', 'lago agrio',
    'esmeraldas', 'otavalo', 'cayambe', 'sangolqui', 'santa rosa', 'pasaje', 'huaquillas',
    'ancon', 'anconcito', 'chanduy', 'colonche', 'manglaralto', 'olon', 'ayangue', 'san pablo',
    'san vicente', 'engabao', 'posorja', 'progreso', 'el morro',
]);

// Variantes de países extranjeros → nombre canónico (con tildes correctas para mostrar).
const PAISES = new Map([
    ['colombia', 'Colombia'],
    ['venezuela', 'Venezuela'],
    ['peru', 'Perú'],
    ['argentina', 'Argentina'],
    ['chile', 'Chile'],
    ['bolivia', 'Bolivia'],
    ['uruguay', 'Uruguay'],
    ['paraguay', 'Paraguay'],
    ['brasil', 'Brasil'], ['brazil', 'Brasil'],
    ['mexico', 'México'],
    ['panama', 'Panamá'],
    ['costa rica', 'Costa Rica'],
    ['cuba', 'Cuba'],
    ['republica dominicana', 'República Dominicana'],
    ['guatemala', 'Guatemala'],
    ['honduras', 'Honduras'],
    ['nicaragua', 'Nicaragua'],
    ['el salvador', 'El Salvador'],
    ['estados unidos', 'Estados Unidos'], ['estados unidos de america', 'Estados Unidos'],
    ['ee uu', 'Estados Unidos'], ['eeuu', 'Estados Unidos'], ['usa', 'Estados Unidos'],
    ['united states', 'Estados Unidos'], ['u s a', 'Estados Unidos'],
    ['canada', 'Canadá'],
    ['espana', 'España'],
    ['francia', 'Francia'], ['france', 'Francia'],
    ['italia', 'Italia'], ['italy', 'Italia'],
    ['alemania', 'Alemania'], ['germany', 'Alemania'],
    ['reino unido', 'Reino Unido'], ['inglaterra', 'Reino Unido'], ['uk', 'Reino Unido'],
    ['england', 'Reino Unido'], ['gran bretana', 'Reino Unido'],
    ['portugal', 'Portugal'],
    ['holanda', 'Países Bajos'], ['paises bajos', 'Países Bajos'], ['netherlands', 'Países Bajos'],
    ['suiza', 'Suiza'], ['belgica', 'Bélgica'], ['suecia', 'Suecia'], ['noruega', 'Noruega'],
    ['china', 'China'], ['japon', 'Japón'], ['corea', 'Corea del Sur'], ['corea del sur', 'Corea del Sur'],
    ['australia', 'Australia'], ['india', 'India'], ['rusia', 'Rusia'],
]);

/**
 * Devuelve el país canónico para un valor de residencia escrito libremente.
 * - Ciudades/provincias del Ecuador y variantes de "Ecuador" → "Ecuador".
 * - Variantes de países extranjeros (may/min, tildes, abreviaturas) → nombre canónico.
 * - Valor desconocido → se devuelve en Title Case (al menos unifica mayúsculas/minúsculas).
 * - Vacío → null (no se cuenta).
 */
// Distancia de edición (Levenshtein) para tolerar errores de tipeo.
function distancia(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
}

function normalizarResidencia(valor) {
    const clv = clave(valor);
    if (!clv) return null;
    if (LUGARES_ECUADOR.has(clv)) return 'Ecuador';
    if (PAISES.has(clv)) return PAISES.get(clv);
    // Tolera errores de tipeo frecuentes de "Ecuador" (Ecaudor, Ecuadro, Equador, Ecuadorr...).
    if (Math.abs(clv.length - 7) <= 2 && distancia(clv, 'ecuador') <= 2) return 'Ecuador';
    return titulo(clv);
}

// Legible solo si, tras limpiarlo (sin tildes), queda compuesto únicamente por letras latinas
// y espacios/guiones y tiene al menos dos letras. Descarta emojis, mojibake ("Ø<Ÿê") y símbolos.
function residenciaLegible(valor) {
    const c = clave(valor);
    return /^[a-z][a-z' -]*$/.test(c) && c.replace(/[^a-z]/g, '').length >= 2;
}

module.exports = { normalizarResidencia, residenciaLegible };
