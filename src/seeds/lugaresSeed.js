// Coordenadas de los lugares que aparecen como opciones en la pregunta "lugares_visitados"
// de la encuesta turística, para dibujarlos en el mapa del dashboard.
//
// Fuentes: los 8 primeros (Montañita, Olón, ..., La Chocolatera) son coordenadas de referencia
// general de cada localidad. Los últimos 6 se geocodificaron el 2026-09-22 vía Nominatim
// (OpenStreetMap, nominatim.openstreetmap.org) buscando el lugar exacto - varios ya existen como
// puntos nombrados en OSM (p. ej. el mirador "Cerro El Morro" y el punto "San Lorenzo" como
// playa), lo que da más precisión que una referencia genérica de localidad.
//
// "Canoa" quedó SIN coordenadas a propósito: el Canoa conocido en Ecuador está en Manabí
// (~150 km al norte, fuera del área de estudio), no en Santa Elena - revisar con Katherine si es
// un error en las opciones de la encuesta (¿debía decir otro lugar?) antes de ubicarlo.
//
// Los lugares con lat/lng en null todavía NO se dibujan en el mapa (siguen apareciendo en el
// ranking): complétalos aquí con el punto exacto (clic derecho en Google Maps -> copiar
// coordenadas). Si el administrador agrega un lugar nuevo a la pregunta, también se agrega aquí.
//
// El nombre debe coincidir con la opción de la encuesta (se ignoran mayúsculas y acentos).
module.exports = [
    { nombre: 'Montañita',        canton: 'Santa Elena', lat: -1.8283, lng: -80.7530 },
    { nombre: 'Olón',             canton: 'Santa Elena', lat: -1.8040, lng: -80.7590 },
    { nombre: 'Manglaralto',      canton: 'Santa Elena', lat: -1.8497, lng: -80.7331 },
    { nombre: 'Ayampe',           canton: 'Santa Elena', lat: -1.6833, lng: -80.8056 },
    { nombre: 'Ayangue',          canton: 'Santa Elena', lat: -1.9920, lng: -80.7540 },
    { nombre: 'Salinas',          canton: 'Salinas',     lat: -2.2167, lng: -80.9500 },
    { nombre: 'Chipipe',          canton: 'Salinas',     lat: -2.2125, lng: -80.9580 },
    { nombre: 'La Chocolatera',   canton: 'Salinas',     lat: -2.2028, lng: -81.0119 },
    // Geocodificados vía Nominatim/OSM (ver nota arriba):
    { nombre: 'La Lobería',       canton: 'Salinas',     lat: -2.2024, lng: -80.9950 },
    { nombre: 'Cerro El Morro',   canton: 'Salinas',     lat: -2.1874, lng: -80.9974 },
    { nombre: 'San Lorenzo',      canton: 'Salinas',     lat: -2.2036, lng: -80.9747 },
    { nombre: 'Playa Ballenita',  canton: 'Santa Elena', lat: -2.2077, lng: -80.8682 },
    { nombre: 'San Pablo',        canton: 'Santa Elena', lat: -1.9397, lng: -80.6996 },
    { nombre: 'San Pedro',        canton: 'Santa Elena', lat: -1.9617, lng: -80.7309 },
    // Pendiente de revisar con Katherine (ver nota arriba) - no ubicar hasta confirmar:
    { nombre: 'Canoa',            canton: null, lat: null, lng: null }
];
