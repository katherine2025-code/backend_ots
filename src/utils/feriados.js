// Calendario de los 7 feriados que analiza el Observatorio, en el orden en que ocurren durante
// el año. Es la lista ÚNICA/canónica: la usan el cuestionario de hoteles (pregunta "feriado"),
// el Cronograma (para nombrar las jornadas) y la pantalla de Ocupación (para el filtro).
//
// Fechas oficiales 2026 según el calendario publicado por el Ministerio de Turismo/decretos del
// Ejecutivo, recogido por prensa nacional (Primicias, El Comercio, El Universo, oct/dic 2025):
//   https://www.primicias.ec/sociedad/calendario-feriados-ecuador-del2026al2030-viceministerio-turismo-104184/
//   https://www.elcomercio.com/actualidad/negocios/ecuador-define-el-calendario-oficial-de-feriados-nacionales-para-2026/
// Son los días NO LABORABLES decretados (sin días adicionales de "puente"); no se inventó ni
// ajustó ninguna fecha para que coincidiera con datos ya recolectados. "Fin de Año" (31 dic -
// 1 ene) no tenía decreto de puente publicado a la fecha de esta carga; se usó la fecha fija
// (Año Nuevo siempre es feriado, tenga o no puente adicional decretado).
//
// fechaInicio/fechaFin: el rango EXACTO decretado (se guarda tal cual en la tabla `feriados`,
// que además alimenta al modelo de Machine Learning). Para agrupar registros de ocupación que
// no traen un feriado explícito (encuestas del formulario antiguo de Kobo), la pantalla de
// Ocupación amplía este rango ±MARGEN_ANALISIS_DIAS para capturar el fin de semana largo típico
// alrededor del feriado - ver ocupacionController.js. Esa ampliación es la MISMA para los 7
// feriados (no se ajustó caso por caso), y nunca modifica el dato original: solo agrupa para
// mostrarlo, dejando "feriado" tal cual estaba guardado.
const FERIADOS_2026 = [
    { nombre: 'Carnaval', fechaInicio: '2026-02-16', fechaFin: '2026-02-17', temporada: 'Alta' },
    { nombre: 'Semana Santa', fechaInicio: '2026-04-03', fechaFin: '2026-04-03', temporada: 'Alta' },
    { nombre: 'Día del Trabajador', fechaInicio: '2026-05-01', fechaFin: '2026-05-01', temporada: 'Media' },
    { nombre: 'Primer Grito de la Independencia', fechaInicio: '2026-08-10', fechaFin: '2026-08-10', temporada: 'Media' },
    { nombre: 'Día de los Difuntos', fechaInicio: '2026-11-02', fechaFin: '2026-11-03', temporada: 'Media' },
    { nombre: 'Navidad', fechaInicio: '2026-12-25', fechaFin: '2026-12-25', temporada: 'Alta' },
    { nombre: 'Fin de Año', fechaInicio: '2026-12-31', fechaFin: '2027-01-01', temporada: 'Alta' }
];

// Nombres en orden, para poblar el <select> del cuestionario y el filtro de Ocupación.
const NOMBRES_FERIADOS = FERIADOS_2026.map(f => f.nombre);

// Días de margen a cada lado del rango oficial para AGRUPAR (nunca modificar) registros sin
// feriado explícito, cubriendo el "puente" habitual de viaje alrededor del feriado.
// Decisión metodológica de la investigadora (Katherine): máximo 4 días.
const MARGEN_ANALISIS_DIAS = 4;

module.exports = { FERIADOS_2026, NOMBRES_FERIADOS, MARGEN_ANALISIS_DIAS };
