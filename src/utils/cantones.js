// Cantón al que pertenece cada parroquia (provincia de Santa Elena).
// Se usa para clasificar hoteles cuando la encuesta no trae el cantón explícito.
// Mantener sincronizado con Microserv_ETLpython/cantones.py.
const CANTON_SANTA_ELENA = 'Santa Elena';
const CANTON_SALINAS = 'Salinas';

const PARROQUIAS_POR_CANTON = {
    [CANTON_SANTA_ELENA]: ['Santa Elena', 'Atahualpa', 'Colonche', 'Chanduy', 'Manglaralto', 'Simón Bolívar', 'Ancón', 'San José de Ancón'],
    [CANTON_SALINAS]: ['Salinas', 'Anconcito', 'José Luis Tamayo']
};

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const clave = (t) => sinAcentos(String(t || '').trim().toLowerCase());

const CANTON_POR_PARROQUIA = {};
for (const [canton, parroquias] of Object.entries(PARROQUIAS_POR_CANTON)) {
    parroquias.forEach(p => { CANTON_POR_PARROQUIA[clave(p)] = canton; });
}

const cantonDeParroquia = (parroquia) => CANTON_POR_PARROQUIA[clave(parroquia)] || null;

module.exports = { CANTON_SANTA_ELENA, CANTON_SALINAS, PARROQUIAS_POR_CANTON, cantonDeParroquia };
