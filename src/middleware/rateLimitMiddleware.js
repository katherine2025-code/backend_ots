const { rateLimit } = require('express-rate-limit');

// Límite de intentos de login por IP, contra ataques de fuerza bruta a contraseñas.
// Solo cuentan los intentos FALLIDOS (skipSuccessfulRequests): un usuario que entra bien no
// gasta su cupo. Al superar el límite responde 429 con el mismo formato { error } que usa el
// resto de la API, para que el frontend muestre el mensaje.
const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000, // ventana de 15 minutos
    limit: 10,                // 10 intentos fallidos por IP en esa ventana
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        error: 'Demasiados intentos de inicio de sesión fallidos. Espera 15 minutos e inténtalo de nuevo.'
    }
});

module.exports = { limitarLogin };
