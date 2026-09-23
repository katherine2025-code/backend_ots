// Capacidad (habitaciones disponibles) recuperada para los 31 registros de ocupacion_hotelera
// que quedaron en 0 por un bug del parser de Kobo (ver kobo_establecimientos.py:
// _validar_columna_habitaciones). El bug ya está corregido para cargas futuras; esto es
// SOLO para reparar los registros de esa carga puntual, ya insertados con el dato equivocado.
//
// Origen: Microserv_ETLpython/../.. "AGOSTSL_ESTABLECIMIENTOS_DE_ALOJAMIENTO_SALINAS_-_all_versions_
// -_labels_-_2026-08-14-14-35-10.xlsx" (31 filas, cantón Salinas, feriado del 9-10 y 13 de agosto/2026).
// Cada valor se cruzó y confirmó 1 a 1 contra la base (mismo hotel + misma fecha + mismos
// habitaciones_ocupadas, un valor ya calculado de forma independiente) antes de aplicarse.
//
// Se identifica por id_ocupacion porque ya se insertó en la base con ese id; no se recalcula por
// nombre/fecha para no arriesgar un cruce distinto si en el futuro se sube el mismo archivo de nuevo.
module.exports = [
    { id_ocupacion: 483, habitaciones_disponibles: 20 },
    { id_ocupacion: 484, habitaciones_disponibles: 50 },
    { id_ocupacion: 485, habitaciones_disponibles: 17 },
    { id_ocupacion: 486, habitaciones_disponibles: 20 },
    { id_ocupacion: 487, habitaciones_disponibles: 46 },
    { id_ocupacion: 488, habitaciones_disponibles: 54 },
    { id_ocupacion: 489, habitaciones_disponibles: 30 },
    { id_ocupacion: 490, habitaciones_disponibles: 42 },
    { id_ocupacion: 491, habitaciones_disponibles: 27 },
    { id_ocupacion: 492, habitaciones_disponibles: 24 },
    { id_ocupacion: 493, habitaciones_disponibles: 50 },
    { id_ocupacion: 494, habitaciones_disponibles: 15 },
    { id_ocupacion: 495, habitaciones_disponibles: 30 },
    { id_ocupacion: 496, habitaciones_disponibles: 23 },
    { id_ocupacion: 497, habitaciones_disponibles: 18 },
    { id_ocupacion: 498, habitaciones_disponibles: 43 },
    { id_ocupacion: 499, habitaciones_disponibles: 38 },
    { id_ocupacion: 500, habitaciones_disponibles: 25 },
    { id_ocupacion: 501, habitaciones_disponibles: 19 },
    { id_ocupacion: 502, habitaciones_disponibles: 7 },
    { id_ocupacion: 503, habitaciones_disponibles: 18 },
    { id_ocupacion: 504, habitaciones_disponibles: 18 },
    { id_ocupacion: 505, habitaciones_disponibles: 9 },
    { id_ocupacion: 506, habitaciones_disponibles: 16 },
    { id_ocupacion: 507, habitaciones_disponibles: 41 },
    { id_ocupacion: 508, habitaciones_disponibles: 16 },
    { id_ocupacion: 509, habitaciones_disponibles: 49 },
    { id_ocupacion: 510, habitaciones_disponibles: 65 },
    { id_ocupacion: 511, habitaciones_disponibles: 20 },
    { id_ocupacion: 512, habitaciones_disponibles: 18 },
    { id_ocupacion: 513, habitaciones_disponibles: 23 }
];
