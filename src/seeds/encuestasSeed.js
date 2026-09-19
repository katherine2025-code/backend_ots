// Cuestionarios iniciales (mismos que llenaba el encuestador antes de existir
// la edición desde el sistema). Solo se cargan si la tabla `encuestas` está vacía.
const ESCALA_1_5 = ['1', '2', '3', '4', '5', 'N/A'];
const SIN_GASTO = '0 (Sin gasto en este concepto)';
const NO_RESPONDER = 'Prefiero no responder';
const GASTO_CORTO = [SIN_GASTO, 'Menos de $20', 'De $21 a $50', 'De $51 a $100', 'Más de $100', NO_RESPONDER];
const GASTO_LARGO = [SIN_GASTO, 'Menos de $20', 'De $21 a $50', 'De $51 a $100', 'Más de $100', 'Más de $200', NO_RESPONDER];

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

const preguntasTurista = [
    cedula,
    q('edad', '¿Qué edad tiene usted?', 'select', PERFIL, true, ['18 a 24 años', '25 a 34 años', '35 a 44 años', '45 a 54 años', '55 a 64 años', '65 años o más']),
    q('genero', '¿Con qué género se identifica usted?', 'select', PERFIL, true, ['Mujer', 'Hombre', 'Otro']),
    q('pais_residencia', 'Por favor especifique el país de residencia', 'text', PERFIL, true),
    q('educacion', '¿Cuál es su nivel de educación?', 'select', PERFIL, true, ['Educación Primaria', 'Educación Secundaria', 'Formación técnica o tecnológica', 'Educación universitaria', 'Posgrado (especialización, maestría, doctorado)', NO_RESPONDER]),
    q('ocupacion', '¿Cuál es su ocupación actual?', 'select', PERFIL, true, ['Empleado/a en el sector público', 'Empleado/a en el sector privado', 'Emprendedor/a o dueño/a de negocio', 'Trabajador/a independiente o por cuenta propia', 'Estudiante', 'Ama/o de casa o tareas del hogar', 'Jubilado/a o pensionista', 'Desempleado/a en búsqueda de empleo', NO_RESPONDER]),
    q('personas_grupo', '¿Cuántas personas, incluyéndose usted, viajaron en este grupo?', 'select', PERFIL, true, ['Solo yo (viajé solo/a)', '2 personas', '3 personas', '4 personas', '5 personas', '6 personas', '7 personas o más']),
    q('motivo_visita', '¿Cuál es el motivo principal de su visita?', 'multiselect', PLANEACION, true, ['Ocio / Vacaciones', 'Visita a familiares o amigos', 'Sol y playa', 'Gastronomía', 'Naturaleza y Aventura (aviturismo, senderismo, flora y fauna, etc.)', 'Cultura y Patrimonio (arquitectura, arte, museos, iglesias, etc.)', 'Ciudad (parques, malecones, city tours, etc.)', 'Turismo rural (agroturismo, turismo comunitario, recorridos fluviales, etc.)', 'Turismo deportivo', 'Entretenimiento y vida nocturna', 'Compras', 'Salud o tratamiento médico', 'Estudios o formación', 'Negocios, trabajo o eventos corporativos', 'Asistencia a eventos (culturales, deportivos, religiosos, etc.)', 'Participación en ferias y convenciones', 'Otro']),
    q('veces_visitado', '¿Cuántas veces ha visitado este destino?', 'select', PLANEACION, true, ['Nunca', '1 vez', '2-3 veces', '4-5 veces', 'Más de 5 veces']),
    q('con_quien_viaja', '¿Con quién viaja?', 'select', PLANEACION, true, ['Solo/a', 'En pareja', 'Con familia (incluye niños/as)', 'Con amigos/as', 'Tour organizado', 'Otro']),
    q('lugares_visitados', '¿Qué lugares piensa visitar o visitó durante su viaje en la provincia de Santa Elena?', 'multiselect', PLANEACION, true, ['Montañita', 'Olón', 'Manglaralto', 'Salinas', 'Ayampe', 'Canoa', 'San Pablo', 'Playa Ballenita', 'Chipipe', 'La Chocolatera', 'La Lobería', 'Cerro El Morro', 'San Lorenzo', 'Ayangue', 'San Pedro', 'Otro']),
    q('noches_hospedado', '¿Cuántas noches se hospedó?', 'select', PLANEACION, true, ['0 noches (visita por el día)', '1 noche', '2 noches', '3 noches', '4 a 6 noches', '7 noches o más']),
    q('busco_informacion', '¿Cómo buscó información antes del viaje?', 'multiselect', PLANEACION, true, ['Buscadores de Internet: Google Search, YouTube, Bing, Yahoo', 'Redes sociales (Facebook, Instagram, Twitter, Tik Tok, Otro)', 'Agencias en línea: Booking, Expedia, Hotels.com, Airbnb, Otro', 'Recomendaciones personales de amigos o familiares', 'Sitio web del destino', 'Agentes de viaje tradicionales y operadoras de turismo', 'No busqué información', 'Otro medio']),
    q('facilidad_informacion', '¿Qué tan fácil fue encontrar información?', 'select', PLANEACION, true, ['Muy fácil', 'Fácil', 'Ni fácil ni difícil', 'Difícil', 'Muy difícil', 'No busqué información']),
    q('como_organizo', '¿Cómo organizó su viaje?', 'select', PLANEACION, true, ['Por cuenta propia (contactando directamente con alojamientos, transporte, etc.)', 'Por medio de un paquete turístico', 'A través de redes sociales o grupos de viaje', 'Con ayuda de familiares o amigos en el destino', 'A través de una agencia de viajes en línea (OTA)', 'A través de una agencia de viajes presencial', 'Otro']),
    q('anticipacion', '¿Con cuánta anticipación organizó su viaje a Salinas?', 'select', PLANEACION, true, ['El mismo día del viaje', '1 a 3 días antes', '4 a 7 días antes', '1 a 2 semanas antes', '3 a 4 semanas antes', '1 a 2 meses antes', 'Más de 2 meses antes']),
    q('transporte_llegada', '¿Qué medio de transporte utilizó para llegar?', 'select', CONSUMO, true, ['Vehículo propio', 'Autobús interprovincial', 'Vehículo de alquiler sin conductor', 'Vehículo de un familiar o amigo', 'Transporte turístico contratado (tour, agencia)', 'Servicio de transporte por app (Uber, InDrive, etc.)', 'Avión (vuelo directo hasta ciudad cercana + traslado terrestre)', 'Otro']),
    q('transporte_destino', '¿Qué medio de transporte utilizó en el destino?', 'multiselect', CONSUMO, true, ['Vehículo propio', 'Transporte público (bus)', 'Uber u otras aplicaciones de transporte privado', 'Taxi amarillo', 'Vehículo motorizado alquilado', 'Caminando', 'Bicicleta', 'Otro']),
    q('gasto_transporte', '¿Cuánto gastó en transporte?', 'select', CONSUMO, true, GASTO_CORTO),
    q('gasto_alojamiento', '¿Cuánto gastó en alojamiento?', 'select', CONSUMO, true, GASTO_LARGO),
    q('gasto_alimentacion', '¿Cuánto gastó en alimentación?', 'select', CONSUMO, true, GASTO_LARGO),
    q('gasto_actividades', '¿Cuánto gastó en actividades recreativas?', 'select', CONSUMO, true, GASTO_CORTO),
    q('gasto_compras', '¿Cuánto gastó en compras personales?', 'select', CONSUMO, true, GASTO_LARGO),
    q('tipo_viajero', '¿Qué tipo de viajero se considera?', 'select', CONSUMO, true, ['Viajero de Bajo Presupuesto/Mochilero: Mi prioridad es el costo más bajo posible, maximizando el ahorro.', 'Viajero de Gama Media: Priorizo el equilibrio entre costo y calidad; no escatimo en lo necesario, pero busco ofertas.', 'Viajero de Gama Alta: Busco calidad, me permito gastos significativos, pero soy consciente de mi presupuesto.', 'Viajero de Lujo: Mi presupuesto es ilimitado y priorizo el confort y la exclusividad.', NO_RESPONDER]),
    q('satisfaccion_atractivos', 'En una escala del 1 al 5, ¿cuál es su nivel de satisfacción con respecto a su experiencia en los atractivos turísticos de Salinas que ha visitado?', 'escala', SATISF, true, ['1 - Muy insatisfecho', '2 - Insatisfecho', '3 - Ni satisfecho ni insatisfecho', '4 - Satisfecho', '5 - Muy satisfecho', 'N/A']),
    q('expectativas', '¿Cómo calificaría sus expectativas vs. la realidad experimentada?', 'select', SATISF, true, ['Muy por debajo de lo esperado', 'Algo por debajo de lo esperado', 'Igual a lo esperado', 'Algo por encima de lo esperado', 'Muy por encima de lo esperado']),
    q('satisfaccion_informacion', 'Información turística disponible (oficinas, mapas, señalización, apps)', 'escala', SATISF, false, ESCALA_1_5),
    q('satisfaccion_atencion', 'Atención y amabilidad de la población local', 'escala', SATISF, false, ESCALA_1_5),
    q('satisfaccion_seguridad', 'Seguridad percibida durante su estancia', 'escala', SATISF, false, ESCALA_1_5),
    q('satisfaccion_limpieza', 'Limpieza y mantenimiento del entorno', 'escala', SATISF, false, ESCALA_1_5),
    q('satisfaccion_calidad_precio', 'Relación calidad-precio de los servicios recibidos', 'escala', SATISF, false, ESCALA_1_5),
    q('satisfaccion_servicios', 'Los servicios turísticos utilizados cumplieron con mis necesidades', 'escala', SATISF, false, ESCALA_1_5),
    q('satisfaccion_facilidad', 'Fue fácil encontrar servicios turísticos que necesitaba', 'escala', SATISF, false, ESCALA_1_5),
    q('satisfaccion_diversidad', 'Actividades y atractivos turísticos bastante diversificados', 'escala', SATISF, false, ESCALA_1_5),
    q('satisfaccion_seguridad_estadia', 'Se sintió seguridad durante su estadía', 'escala', SATISF, false, ESCALA_1_5),
    q('satisfaccion_equipamientos', 'Encontré varias facilidades y equipamientos al servicio del visitante', 'escala', SATISF, false, ESCALA_1_5),
    q('probabilidad_recomendar', '¿Qué probabilidad hay de que recomiende este destino a amigos o familiares?', 'escala', SATISF, true, ['1 - Nada probable', '2 - Improbable', '3 - Ni probable ni improbable', '4 - Probable', '5 - Muy probable'])
];

const IDENT = 'Identificación del Establecimiento';
const DEMANDA = 'Demanda Turística';

// Cantones donde se levanta la encuesta (un grupo de encuestadores por cantón, mismo formulario)
const CANTONES = ['Santa Elena', 'Salinas'];
const PARROQUIAS = ['Santa Elena', 'Atahualpa', 'Colonche', 'Chanduy', 'Manglaralto', 'Simón Bolívar', 'Ancón', 'Salinas', 'Anconcito', 'José Luis Tamayo'];

// Feriados en los que se recolecta ocupación (el administrador puede agregar más desde la edición)
const FERIADOS = ['Año Nuevo', 'Carnaval', 'Semana Santa', 'Día del Trabajo', 'Primer Grito de la Independencia', 'Día de los Difuntos', 'Navidad y Fin de Año'];

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
