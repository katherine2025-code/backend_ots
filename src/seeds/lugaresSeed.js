// Coordenadas de los lugares que aparecen como opciones en la pregunta "lugares_visitados"
// de la encuesta turística, para dibujarlos en el mapa del dashboard.
//
// IMPORTANTE: las coordenadas son APROXIMADAS (referencia general de cada localidad/atractivo).
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
    // Pendientes de ubicar con precisión:
    { nombre: 'Canoa',            canton: null, lat: null, lng: null },
    { nombre: 'San Pablo',        canton: null, lat: null, lng: null },
    { nombre: 'Playa Ballenita',  canton: null, lat: null, lng: null },
    { nombre: 'La Lobería',       canton: null, lat: null, lng: null },
    { nombre: 'Cerro El Morro',   canton: null, lat: null, lng: null },
    { nombre: 'San Lorenzo',      canton: null, lat: null, lng: null },
    { nombre: 'San Pedro',        canton: null, lat: null, lng: null }
];
