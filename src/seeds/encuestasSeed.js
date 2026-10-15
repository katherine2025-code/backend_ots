// Cuestionarios iniciales (mismos que llenaba el encuestador antes de existir
// la edición desde el sistema). Solo se cargan si la tabla `encuestas` está vacía.
const ESCALA_1_5 = ['1', '2', '3', '4', '5', 'N/A'];
const SIN_GASTO = '0 (Sin gasto en este concepto)';
const NO_RESPONDER = 'Prefiero no responder';
// Cuestionario ajustado (11-09-2026): los 6 rubros de gasto usan el mismo rango de montos.
const GASTO_RANGO = [SIN_GASTO, 'Menos de $20', 'De $21 a $50', 'De $51 a $100', 'Más de $100', NO_RESPONDER];

const cedula = {
    codigo: 'cedula_encuestador', texto: 'Cédula del Encuestador (10 dígitos)', tipo: 'text',
    seccion: 'Datos del Encuestador', obligatoria: true, max_length: 10
};

// [codigo, texto, tipo, seccion, obligatoria, opciones]
const q = (codigo, texto, tipo, seccion, obligatoria, opciones) => ({ codigo, texto, tipo, seccion, obligatoria, opciones });

const PERFIL = 'Perfil Sociodemográfico';
const PLANEACION = 'Planeación del Viaje';
const CONSUMO = 'Estructura de Consumo';
const SATISF = 'Satisfacción';

// Cuestionario ajustado 11-09-2026 (definitivo para la recolección de noviembre en adelante).
// 26 preguntas en 4 secciones. Los `codigo` coinciden con las columnas de encuestas_turisticas
// (o con el campo que mapea el ETL propio, ver ots_app_encuestas.py), para que cada respuesta
// caiga en su columna sin adivinar. Las actividades (P10) y el motivo (P7) son preguntas
// distintas; el gasto (P19) tiene 6 rubros; P20 y P26 son nuevas.
const IMPACTO = 'Impacto Experiencial';

const preguntasTurista = [
    cedula,
    // ===== SECCIÓN A. PERFIL SOCIODEMOGRÁFICO =====
    q('edad', '¿Qué edad tiene usted?', 'select', PERFIL, true, ['18 a 24 años', '25 a 34 años', '35 a 44 años', '45 a 54 años', '55 a 64 años', '65 años o más', NO_RESPONDER]),
    q('genero', '¿Con qué género se identifica usted?', 'select', PERFIL, true, ['Hombre', 'Mujer', 'Persona no binaria', NO_RESPONDER]),
    q('pais_residencia', '¿Cuál es su país de residencia habitual?', 'text', PERFIL, true),
    q('educacion', '¿Cuál es el nivel más alto de estudios que ha completado?', 'select', PERFIL, true, ['Ninguno', 'Educación Primaria', 'Educación Secundaria', 'Formación técnica o tecnológica', 'Educación universitaria', 'Posgrado (especialización, maestría, doctorado)', NO_RESPONDER]),
    q('ocupacion', '¿Cuál es su situación laboral actual?', 'select', PERFIL, true, ['Empleado/a en el sector público', 'Empleado/a en el sector privado', 'Emprendedor/a o dueño/a de negocio', 'Estudiante', 'Desempleado/a en búsqueda de empleo', 'Desempleado/a no busca empleo', 'Jubilado/a o pensionista', 'Ama/o de casa o tareas del hogar', NO_RESPONDER]),
    q('personas_grupo', '¿Cuántas personas, incluyéndose usted, viajaron en este grupo?', 'select', PERFIL, true, ['Solo yo (viajé solo/a)', '2 personas', '3 personas', '4 personas', '5 personas o más', NO_RESPONDER]),
    // ===== SECCIÓN B. PLANEACIÓN DEL VIAJE =====
    q('motivo_visita', '¿Cuál es el principal motivo de su visita?', 'select', PLANEACION, true, ['Descanso / Vacaciones', 'Visita a familiares o amigos', 'Negocios, trabajo o eventos corporativos', 'Salud o tratamiento médico', 'Estudios o formación', 'Asistencia a eventos (culturales, deportivos, religiosos, etc.)', 'Trámite personal o gestiones', NO_RESPONDER]),
    q('veces_visitado', '¿Cuántas veces ha visitado Santa Elena en los últimos 2 años (sin contar esta visita)?', 'select', PLANEACION, true, ['1 vez', '2-3 veces', '4-5 veces', 'Más de 5 veces']),
    q('con_quien_viaja', '¿Con quién viaja en esta ocasión a Santa Elena?', 'select', PLANEACION, true, ['Solo/a', 'En pareja', 'Con familia (incluye niños/as)', 'Con amigos/as', 'En grupo organizado (por agencia, institución, etc.)', NO_RESPONDER]),
    q('actividades', '¿Qué tipo de actividades espera realizar durante su visita?', 'multiselect', PLANEACION, true, ['Ciudad (parques, malecones, city tours, etc.)', 'Cultura y Patrimonio (arquitectura, arte, museos, iglesias, etc.)', 'Naturaleza y Aventura (aviturismo, senderismo, flora y fauna, etc.)', 'Turismo rural (agroturismo, turismo comunitario, recorridos fluviales, etc.)', 'Sol y playa', 'Gastronomía', 'Entretenimiento y vida nocturna', 'Participación en ferias y convenciones', 'Turismo deportivo', NO_RESPONDER]),
    q('lugares_visitados', '¿Qué lugares piensa visitar o visitó durante su viaje a Santa Elena?', 'multiselect', PLANEACION, true, ['Montañita', 'Olón', 'Manglaralto', 'Salinas', 'Ayampe', 'Canoa', 'San Pablo', 'Playa Ballenita', 'Chipipe', 'La Chocolatera', 'La Lobería', 'Cerro El Morro', 'San Lorenzo', 'Ayangue', 'San Pedro', 'Otro']),
    q('noches_hospedado', '¿Cuántas noches tiene pensado quedarse en Santa Elena?', 'select', PLANEACION, true, ['0 noches (visita por el día)', '1 noche', '2 noches', '3 noches', '4 noches o más']),
    q('busco_informacion', '¿A través de qué medios buscó información sobre el destino Santa Elena previo a su viaje?', 'multiselect', PLANEACION, true, ['Buscadores de Internet: Google Search, YouTube, Bing, Yahoo', 'Agencias en línea: Booking, Expedia, Hotels.com, Airbnb', 'Agentes de viaje tradicionales y operadoras de turismo', 'Recomendaciones personales de amigos o familiares', 'Recomendaciones y opiniones online de otros turistas (TripAdvisor, Yelp)', 'Sitio web del destino Santa Elena', 'Redes sociales (Facebook, Instagram, Twitter, Tik Tok)']),
    q('facilidad_informacion', '¿Qué tan fácil o difícil le resultó buscar información sobre el destino Santa Elena antes de su viaje?', 'select', PLANEACION, true, ['Muy difícil', 'Difícil', 'Ni fácil ni difícil', 'Fácil', 'Muy fácil', 'No busqué información']),
    q('como_organizo', '¿De qué forma organizó su viaje principalmente?', 'select', PLANEACION, true, ['Por cuenta propia (contactando directamente con alojamientos, transporte, etc.)', 'A través de una agencia de viajes tradicional', 'A través de una agencia de viajes en línea (OTA)', 'Con ayuda de familiares o amigos en el destino', 'Por medio de un paquete turístico', 'A través de redes sociales o grupos de viaje', NO_RESPONDER]),
    q('anticipacion', '¿Con cuánta anticipación organizó su viaje a Santa Elena?', 'select', PLANEACION, true, ['El mismo día del viaje', '1 a 3 días antes', '4 a 7 días antes', '1 a 2 semanas antes', '3 a 4 semanas antes', '1 a 2 meses antes', 'Más de 2 meses antes', NO_RESPONDER]),
    q('transporte_llegada', '¿Por qué medio de transporte arribó a Santa Elena en este viaje?', 'select', PLANEACION, true, ['Vehículo propio', 'Vehículo de alquiler sin conductor', 'Vehículo de un familiar o amigo', 'Autobús interprovincial', 'Transporte turístico contratado (tour, agencia)', 'Taxi', 'Servicio de transporte por app (Uber, InDrive, etc.)', 'Avión (hasta ciudad cercana + traslado terrestre)']),
    // ===== SECCIÓN C. ESTRUCTURA DE CONSUMO =====
    q('transporte_destino', '¿Cuáles han sido sus principales medios de traslado durante su visita?', 'multiselect', CONSUMO, true, ['Transporte público (bus)', 'Taxi amarillo', 'Vehículo motorizado alquilado', 'Vehículo motorizado familiar o amigo', 'Uber u otras aplicaciones de transporte privado', 'Bicicleta', NO_RESPONDER]),
    q('gasto_alojamiento', '19.A En promedio por día por persona, ¿cuánto gasta en alojamiento (hotel, hostal, alquiler vacacional)?', 'select', CONSUMO, true, GASTO_RANGO),
    q('gasto_alimentacion', '19.B En promedio por día por persona, ¿cuánto gasta en alimentación (desayuno, almuerzo y cena)?', 'select', CONSUMO, true, GASTO_RANGO),
    q('gasto_transporte', '19.C En promedio por día, ¿cuánto gasta en transporte interno (taxis, bus, estacionamiento, gasolina, alquiler de auto, etc.)?', 'select', CONSUMO, true, GASTO_RANGO),
    q('gasto_entretenimiento', '19.D En promedio por día, ¿cuánto gasta en entretenimiento, ocio y cultura (festivales, cine, atracciones, etc.)?', 'select', CONSUMO, true, GASTO_RANGO),
    q('gasto_compras', '19.E En promedio por día, ¿cuánto gasta en compras de ropa, calzado y artículos personales?', 'select', CONSUMO, true, GASTO_RANGO),
    q('gasto_recuerdos', '19.F En promedio por día, ¿cuánto gasta en recuerdos, souvenirs y artesanías?', 'select', CONSUMO, true, GASTO_RANGO),
    q('rubro_mayor_gasto', '¿En qué rubro está dispuesto(a) a gastar más dinero durante sus viajes?', 'select', CONSUMO, true, ['Alojamiento (Hoteles de lujo, airbnb premium, etc.)', 'Transporte y vuelos (Clase ejecutiva, viajes directos, alquiler de autos de alta gama)', 'Experiencias y actividades (Tours exclusivos, entradas VIP, deportes de aventura)', 'Gastronomía (Restaurantes de alta cocina, experiencias culinarias)', 'Actividades recreativas, culturales o de entretenimiento', 'Compras personales (ropa, calzado, tecnología, etc.)', 'Recuerdos, artesanías y souvenirs', NO_RESPONDER]),
    q('tipo_viajero', 'Considerando su situación económica, ¿en cuál de las siguientes categorías se clasificaría como viajero?', 'select', CONSUMO, true, ['Viajero de Gama Alta: Busco calidad, me permito gastos significativos pero soy consciente de mi presupuesto.', 'Viajero de Gama Media: Priorizo el equilibrio entre costo y calidad; no escatimo en lo necesario, pero busco ofertas.', 'Viajero de Bajo Presupuesto/Mochilero: Mi prioridad es el costo más bajo posible, maximizando el ahorro.', NO_RESPONDER]),
    // ===== SECCIÓN D. IMPACTO EXPERIENCIAL =====
    q('expectativas', '¿Cuál es la relación de sus expectativas y la realidad del destino?', 'select', IMPACTO, true, ['Muy por debajo de lo esperado', 'Algo por debajo de lo esperado', 'Igual a lo esperado', 'Algo por encima de lo esperado', 'Muy por encima de lo esperado', NO_RESPONDER]),
    q('satisfaccion_informacion', 'Satisfacción (1-5): Información turística disponible (oficinas, mapas, señalización, apps)', 'escala', IMPACTO, false, ESCALA_1_5),
    q('satisfaccion_atencion', 'Satisfacción (1-5): Atención y amabilidad de la población local', 'escala', IMPACTO, false, ESCALA_1_5),
    q('satisfaccion_seguridad', 'Satisfacción (1-5): Seguridad percibida durante su estancia', 'escala', IMPACTO, false, ESCALA_1_5),
    q('satisfaccion_limpieza', 'Satisfacción (1-5): Limpieza y mantenimiento del entorno', 'escala', IMPACTO, false, ESCALA_1_5),
    q('satisfaccion_calidad_precio', 'Satisfacción (1-5): Relación calidad-precio de los servicios recibidos', 'escala', IMPACTO, false, ESCALA_1_5),
    q('satisfaccion_atractivos', 'En una escala del 1 al 5, ¿cuál es su nivel de satisfacción con respecto a su experiencia en los atractivos turísticos de Santa Elena que ha visitado?', 'escala', IMPACTO, true, ['1 - Muy insatisfecho', '2 - Insatisfecho', '3 - Ni satisfecho ni insatisfecho', '4 - Satisfecho', '5 - Muy satisfecho', 'N/A']),
    q('probabilidad_recomendar', 'En una escala del 1 al 5, ¿qué tan probable es que vuelva a visitar Santa Elena?', 'escala', IMPACTO, true, ['1 - Muy improbable', '2 - Improbable', '3 - Ni probable ni improbable', '4 - Probable', '5 - Muy probable', NO_RESPONDER]),
    q('motivos_recomendacion', '¿Cuáles son los principales motivos por los que nos recomendaría visitar la provincia de Santa Elena?', 'multiselect', IMPACTO, true, ['Los servicios turísticos utilizados cumplieron con mis necesidades', 'Fue fácil encontrar servicios turísticos que necesitaba', 'Actividades y atractivos turísticos bastante diversificados', 'Se sintió seguridad durante su estadía', 'Encontré varias facilidades y equipamientos al servicio del visitante', NO_RESPONDER])
];

const IDENT = 'Identificación del Establecimiento';
const DEMANDA = 'Demanda Turística';

// Cantones donde se levanta la encuesta (un grupo de encuestadores por cantón, mismo formulario)
const CANTONES = ['Santa Elena', 'Salinas'];
const PARROQUIAS = ['Santa Elena', 'Atahualpa', 'Colonche', 'Chanduy', 'Manglaralto', 'Simón Bolívar', 'Ancón', 'Salinas', 'Anconcito', 'José Luis Tamayo'];

// Feriados en los que se recolecta ocupación: lista única/canónica, ver utils/feriados.js
const { NOMBRES_FERIADOS: FERIADOS } = require('../utils/feriados');

// Un bloque por cada día del feriado (hasta 5). Solo la Fecha 1 es obligatoria: un feriado
// puede durar de 1 a 5 días, y el encuestador deja en blanco los bloques que no usa.
const bloquesFecha = () => {
    const bloques = [];
    for (let n = 1; n <= 5; n++) {
        const seccion = `Demanda por Fecha (Fecha ${n})`;
        const obligatoria = n === 1;
        bloques.push(
            q(`fecha${n}_fecha`, `Fecha ${n} - Día del feriado`, 'date', seccion, obligatoria),
            q(`fecha${n}_nacionales`, `Fecha ${n} - Check-in Nacionales`, 'number', seccion, obligatoria),
            q(`fecha${n}_extranjeros`, `Fecha ${n} - Check-in Extranjeros`, 'number', seccion, obligatoria),
            q(`fecha${n}_pernoctaciones`, `Fecha ${n} - Pernoctaciones`, 'number', seccion, obligatoria),
            q(`fecha${n}_habitaciones`, `Fecha ${n} - Habitaciones ocupadas`, 'number', seccion, obligatoria),
            q(`fecha${n}_tarifa`, `Fecha ${n} - Tarifa cobrada`, 'number', seccion, obligatoria)
        );
    }
    return bloques;
};

const preguntasHotel = [
    cedula,
    { ...q('provincia', 'Provincia', 'text', IDENT, true), valor_default: 'Santa Elena' },
    q('canton', 'Cantón donde se levanta la encuesta', 'select', IDENT, true, CANTONES),
    q('nombre_establecimiento', 'Nombre del establecimiento', 'text', IDENT, true),
    q('direccion', 'Dirección exacta', 'text', IDENT, true),
    q('email', 'Correo electrónico de contacto', 'email', IDENT, true),
    q('categoria', 'Categoría del establecimiento', 'select', IDENT, true, ['1 estrella', '2 estrellas', '3 estrellas', '4 estrellas', '5 estrellas', 'casa de huéspedes', 'hostal', 'hotel', 'otro']),
    q('telefono', 'Teléfono de contacto', 'text', IDENT, true),
    q('parroquia', 'Parroquia donde se ubica', 'select', IDENT, true, PARROQUIAS),
    q('num_habitaciones', 'Número de habitaciones disponibles', 'number', IDENT, true),
    q('num_plazas', 'Número de plazas (camas) disponibles', 'number', IDENT, true),
    q('feriado', 'Feriado sobre el que se reporta', 'select', DEMANDA, true, FERIADOS),
    q('personas_antes_feriado', 'Número de personas alojadas antes de comenzar el feriado', 'number', DEMANDA, true),
    q('tipo_tarifa', 'Tipo de tarifa cobrada', 'select', DEMANDA, true, ['Por persona', 'Por habitacion']),
    ...bloquesFecha()
];

module.exports = [
    {
        nombre: 'Encuesta Turística - Feriados Nacionales',
        descripcion: 'Encuesta para obtener información de turistas durante feriados (Perfil sociodemográfico, motivaciones, gasto y satisfacción)',
        tipo: 'turista',
        activa: true,
        preguntas: preguntasTurista
    },
    {
        nombre: 'Encuesta Establecimientos de Alojamiento - MINTUR',
        descripcion: 'Levantamiento de información en hoteles de los cantones Santa Elena y Salinas según Metodología MINTUR (Identificación, capacidad y demanda turística por feriado, hasta 5 fechas)',
        tipo: 'hotel',
        activa: true,
        preguntas: preguntasHotel
    }
];
