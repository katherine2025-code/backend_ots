// Conexión con el microservicio Python (ETL + Machine Learning).
// El microservicio exige el header X-Service-Token con el mismo valor que su variable
// SERVICE_TOKEN; aquí se lee de la variable SERVICE_TOKEN del backend (deben coincidir).
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

const mlHeaders = (extra = {}) => ({
    ...extra,
    'X-Service-Token': process.env.SERVICE_TOKEN || ''
});

// Status HTTP a devolver al frontend cuando falla una llamada al microservicio. Un 401/503 del
// microservicio es un problema de configuración entre servidores (SERVICE_TOKEN distinto o
// ausente), no de la sesión del usuario: reenviarlo como 401 haría que el frontend mostrara
// "Credenciales incorrectas". Se responde 502 (falla del servicio dependiente) en su lugar.
const estadoErrorML = (error) => {
    const status = error.response?.status;
    if (!status) return 500;
    if (status === 401 || status === 503) return 502;
    return status;
};

if (!process.env.SERVICE_TOKEN) {
    console.warn('SERVICE_TOKEN no está configurado: el microservicio Python rechazará las peticiones del backend.');
}

module.exports = { ML_SERVICE_URL, mlHeaders, estadoErrorML };
