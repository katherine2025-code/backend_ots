-- =====================================================================================
-- OTS - Esquema inicial completo de la base de datos `ots`
-- =====================================================================================
-- Crea TODAS las tablas que usan el backend (Node) y el microservicio ETL/ML (Python), en una
-- base vacía. Ver sql/README.md para el paso a paso.
--
-- De dónde sale cada tabla:
--   * Tablas con modelo Sequelize: DDL generado por el propio Sequelize (sync) a partir de
--     src/models, más lo que src/services/esquemaService.js agrega al arrancar (columnas, FKs,
--     ENUMs). Con este script, esquemaService ya no tiene nada que agregar.
--   * Tablas SIN modelo (solo SQL directo): encuestas_turisticas, etl_procesos, reportes,
--     feriados. Columnas tomadas de los INSERT/UPDATE/SELECT del backend y del ETL.
--   * Columnas que el ETL escribe y ningún modelo declara (hoteles.correo, hoteles.plazas_disponibles,
--     ocupacion_hotelera.plazas_disponibles, ...): incluidas para que esas cargas no fallen.
--
-- Diferencias deliberadas con lo que generaría Sequelize:
--   * created_at / updated_at / fecha_registro tienen DEFAULT CURRENT_TIMESTAMP: el ETL inserta
--     con SQL directo sin pasar por Sequelize y a veces no envía updated_at (p. ej. en
--     ocupacion_hotelera); con el modo estricto de MariaDB eso fallaría sin un DEFAULT.
--   * Charset utf8mb4 + utf8mb4_unicode_ci y tipo JSON: funciona igual en MariaDB 10.6+ y MySQL 8.
--
-- Es idempotente (CREATE TABLE IF NOT EXISTS): ejecutarlo sobre una base ya creada no cambia nada.
-- NO altera tablas existentes: para una base de producción existente no hace falta correrlo.
-- =====================================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------------------------------
-- Usuarios, roles y auditoría
-- -------------------------------------------------------------------------------------

-- id_rol empieza en 0 (Super Administrador): ver 002_datos_iniciales.sql
CREATE TABLE IF NOT EXISTS `roles` (
  `id_rol` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(50) NOT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id_usuario` INT NOT NULL AUTO_INCREMENT,
  `nombres` VARCHAR(100) NOT NULL,
  `apellidos` VARCHAR(100) NOT NULL,
  `correo` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `id_rol` INT NOT NULL,
  `estado` TINYINT NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Recuperación de contraseña: hash del token y expiración (esquemaService)
  `reset_token` VARCHAR(255) DEFAULT NULL,
  `reset_expira` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `correo` (`correo`),
  KEY `id_rol` (`id_rol`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bitacora` (
  `id_bitacora` INT NOT NULL AUTO_INCREMENT,
  `id_usuario` INT NOT NULL,
  `accion` VARCHAR(200) NOT NULL,
  `modulo` VARCHAR(100) NOT NULL,
  `descripcion` TEXT DEFAULT NULL,
  `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_bitacora`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `bitacora_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Hoteles y ocupación
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `hoteles` (
  `id_hotel` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `direccion` VARCHAR(200) DEFAULT NULL,
  `correo` VARCHAR(150) DEFAULT NULL,                 -- lo escribe el ETL (CSV de la app)
  `telefono` VARCHAR(50) DEFAULT NULL,
  `parroquia` VARCHAR(100) DEFAULT NULL,
  `canton` VARCHAR(30) DEFAULT NULL COMMENT 'Santa Elena | Salinas (clasificación de hoteles por cantón)',
  `categoria` ENUM('1','2','3','4','5') NOT NULL DEFAULT '3',
  `habitaciones_totales` INT NOT NULL DEFAULT 0,
  `habitaciones_disponibles` INT DEFAULT NULL,        -- lo escribe el ETL (CSV de la app)
  `plazas_disponibles` INT DEFAULT NULL,              -- lo escribe el ETL (app y Kobo establecimientos)
  `ubicacion_lat` DECIMAL(10,8) DEFAULT NULL,
  `ubicacion_lng` DECIMAL(11,8) DEFAULT NULL,
  `precio_promedio` DECIMAL(10,2) DEFAULT 0.00,
  `playa_cercana` TINYINT(1) DEFAULT 1,
  `distancia_playa` INT DEFAULT NULL COMMENT 'Distancia en metros',
  `servicios` JSON DEFAULT NULL,
  `estado` ENUM('Activo','Inactivo') DEFAULT 'Activo',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_hotel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `temporadas` (
  `id_temporada` INT NOT NULL AUTO_INCREMENT,
  `nombre` ENUM('Alta','Media','Baja') NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NOT NULL,
  `factor_ocupacion` DECIMAL(3,2) NOT NULL COMMENT 'Factor multiplicador: Alta=1.3, Media=1.0, Baja=0.7',
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `activo` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_temporada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `festivos` (
  `id_festivo` INT NOT NULL AUTO_INCREMENT,
  `fecha` DATE NOT NULL,
  `nombre` VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `es_nacional` TINYINT(1) DEFAULT 1,
  `activo` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_festivo`),
  UNIQUE KEY `fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Calendario de feriados (sin modelo Sequelize). Lo llena esquemaService con el calendario
-- oficial 2026 si está vacía, o el ETL (tipo 'feriados'). Lo leen el backend (feriado efectivo
-- de cada registro de ocupación) y el ETL/ML (variables estacionales).
CREATE TABLE IF NOT EXISTS `feriados` (
  `id_feriado` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(100) NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NOT NULL,
  `total_dias` INT NOT NULL DEFAULT 1,
  `temporada` VARCHAR(20) DEFAULT NULL COMMENT 'Alta | Media | Baja',
  `descripcion` VARCHAR(500) DEFAULT NULL,
  `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_feriado`),
  KEY `feriados_nombre` (`nombre`),
  KEY `feriados_rango` (`fecha_inicio`, `fecha_fin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ocupacion_hotelera` (
  `id_ocupacion` INT NOT NULL AUTO_INCREMENT,
  `id_hotel` INT NOT NULL,
  `id_temporada` INT DEFAULT NULL,
  `id_festivo` INT DEFAULT NULL,
  `fecha` DATE NOT NULL,
  `checkin_nacionales` INT DEFAULT 0,
  `checkin_extranjeros` INT DEFAULT 0,
  `total_turistas` INT DEFAULT 0,
  `pernoctaciones` INT DEFAULT 0,
  `habitaciones_ocupadas` INT DEFAULT 0,
  `habitaciones_disponibles` INT DEFAULT 0,
  `habitaciones_totales` INT DEFAULT 0,
  `ocupacion_porcentaje` DECIMAL(5,2) DEFAULT NULL,
  -- Ocupación por plazas (camas): el ETL de la app la escribe solo si existen estas columnas
  `plazas_disponibles` INT DEFAULT NULL,
  `ocupacion_plazas_porcentaje` DECIMAL(5,2) DEFAULT NULL,
  `feriado` VARCHAR(80) DEFAULT NULL,
  `tarifa_cobrada` DECIMAL(10,2) DEFAULT NULL,
  `ingreso_total` DECIMAL(12,2) DEFAULT 0.00,
  `fuente_dato` ENUM('Encuesta','Sistema','Manual','ETL') NOT NULL DEFAULT 'Encuesta',
  `validado` TINYINT(1) NOT NULL DEFAULT 0,
  `creado_por` INT DEFAULT NULL,
  `actualizado_por` INT DEFAULT NULL,
  -- Identificador del envío en KoboToolbox (_uuid): evita cargar dos veces el mismo envío
  `uuid_kobo` VARCHAR(64) DEFAULT NULL,
  -- Días del feriado reportados en el envío (el % se calcula sobre capacidad x días)
  `dias_reportados` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_ocupacion`),
  UNIQUE KEY `uuid_kobo` (`uuid_kobo`),
  KEY `id_festivo` (`id_festivo`),
  KEY `ocupacion_hotelera_id_hotel_fecha` (`id_hotel`, `fecha`),
  KEY `ocupacion_hotelera_id_temporada` (`id_temporada`),
  KEY `ocupacion_hotelera_fecha` (`fecha`),
  CONSTRAINT `ocupacion_hotelera_ibfk_1` FOREIGN KEY (`id_hotel`) REFERENCES `hoteles` (`id_hotel`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ocupacion_hotelera_ibfk_2` FOREIGN KEY (`id_temporada`) REFERENCES `temporadas` (`id_temporada`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ocupacion_hotelera_ibfk_3` FOREIGN KEY (`id_festivo`) REFERENCES `festivos` (`id_festivo`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `clima` (
  `id_clima` INT NOT NULL AUTO_INCREMENT,
  `fecha` DATE NOT NULL,
  `temperatura` DECIMAL(5,2) DEFAULT NULL,
  `humedad` DECIMAL(5,2) DEFAULT NULL,
  `precipitacion` DECIMAL(8,2) DEFAULT NULL,
  `velocidad_viento` DECIMAL(5,2) DEFAULT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_clima`),
  KEY `clima_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Machine Learning
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `variables_estacionales` (
  `id_variable` INT NOT NULL AUTO_INCREMENT,
  `fecha` DATE NOT NULL,
  `mes` INT NOT NULL COMMENT '1-12',
  `dia_semana` INT NOT NULL COMMENT '0-6 (Domingo=0)',
  `es_festivo` TINYINT(1) DEFAULT 0,
  `es_temporada_alta` TINYINT(1) DEFAULT 0,
  `semana_ano` INT NOT NULL COMMENT '1-52',
  `factor_estacional` DECIMAL(3,2) NOT NULL DEFAULT 1.00 COMMENT 'Factor compuesto para ML',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_variable`),
  UNIQUE KEY `fecha` (`fecha`),
  KEY `variables_estacionales_mes_dia_semana` (`mes`, `dia_semana`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `predicciones` (
  `id_prediccion` INT NOT NULL AUTO_INCREMENT,
  `id_hotel` INT NOT NULL,
  `id_usuario` INT DEFAULT NULL,
  `fecha` DATE NOT NULL,
  `fecha_generacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ocupacion_predicha` DECIMAL(5,2) NOT NULL,
  `ocupacion_real` DECIMAL(5,2) DEFAULT NULL,
  `error_absoluto` DECIMAL(5,2) DEFAULT NULL,
  `error_porcentual` DECIMAL(5,2) DEFAULT NULL,
  `es_aceptable` TINYINT(1) DEFAULT 1,
  `modelo_utilizado` ENUM('RandomForest','XGBoost','Prophet') NOT NULL,
  `version_modelo` VARCHAR(50) DEFAULT NULL,
  `precision_modelo` DECIMAL(5,2) DEFAULT NULL,
  `variables_utilizadas` JSON DEFAULT NULL,
  `importancia_variables` JSON DEFAULT NULL,
  `intervalo_confianza_min` DECIMAL(5,2) DEFAULT NULL,
  `intervalo_confianza_max` DECIMAL(5,2) DEFAULT NULL,
  `tiempo_prediccion_ms` INT DEFAULT NULL,
  `estado` ENUM('pendiente','validada','descartada','en_proceso') NOT NULL DEFAULT 'pendiente',
  `observaciones` TEXT DEFAULT NULL,
  `validada_por` INT DEFAULT NULL,
  `fecha_validacion` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_prediccion`),
  KEY `predicciones_id_hotel_fecha` (`id_hotel`, `fecha`),
  KEY `predicciones_fecha` (`fecha`),
  KEY `predicciones_modelo_utilizado` (`modelo_utilizado`),
  KEY `predicciones_estado` (`estado`),
  CONSTRAINT `predicciones_ibfk_1` FOREIGN KEY (`id_hotel`) REFERENCES `hoteles` (`id_hotel`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Encuestas: cuestionarios de la app, respuestas en campo y cronograma
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `encuestas` (
  `id_encuesta` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` TEXT DEFAULT NULL,
  `tipo` ENUM('turista','hotel') NOT NULL COMMENT 'Una definición vigente por tipo de encuesta',
  `activa` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_encuesta`),
  UNIQUE KEY `tipo` (`tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `encuesta_preguntas` (
  `id_pregunta` INT NOT NULL AUTO_INCREMENT,
  `id_encuesta` INT NOT NULL,
  `codigo` VARCHAR(80) NOT NULL COMMENT 'Clave con la que se guarda/exporta la respuesta (columna del CSV/ETL)',
  `texto` TEXT NOT NULL,
  `tipo` ENUM('text','email','number','date','select','multiselect','escala') NOT NULL DEFAULT 'text',
  `seccion` VARCHAR(150) NOT NULL,
  `obligatoria` TINYINT(1) NOT NULL DEFAULT 0,
  `orden` INT NOT NULL DEFAULT 0,
  `opciones` JSON DEFAULT NULL COMMENT 'Respuestas posibles (select, multiselect, escala)',
  `max_length` INT DEFAULT NULL,
  `valor_default` VARCHAR(150) DEFAULT NULL,
  PRIMARY KEY (`id_pregunta`),
  UNIQUE KEY `encuesta_preguntas_id_encuesta_codigo` (`id_encuesta`, `codigo`),
  KEY `encuesta_preguntas_id_encuesta_orden` (`id_encuesta`, `orden`),
  CONSTRAINT `encuesta_preguntas_ibfk_1` FOREIGN KEY (`id_encuesta`) REFERENCES `encuestas` (`id_encuesta`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `respuestas_encuestas` (
  `id_respuesta` INT NOT NULL AUTO_INCREMENT,
  `id_encuesta` INT NOT NULL,
  `id_usuario` INT DEFAULT NULL COMMENT 'Encuestador que la registró',
  `uuid_cliente` VARCHAR(36) DEFAULT NULL COMMENT 'Identificador generado en el dispositivo; evita duplicados al reintentar el envío',
  `fecha_encuesta` DATETIME NOT NULL COMMENT 'Momento en que se llenó la encuesta en campo',
  `respuestas` JSON NOT NULL COMMENT '{ codigo_pregunta: valor | [valores] }',
  `fecha_etl` DATETIME DEFAULT NULL COMMENT 'Cuándo el ETL cargó esta respuesta a las tablas de análisis; evita cargarla dos veces',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_respuesta`),
  UNIQUE KEY `uuid_cliente` (`uuid_cliente`),
  KEY `respuestas_encuestas_id_encuesta_fecha_encuesta` (`id_encuesta`, `fecha_encuesta`),
  KEY `respuestas_encuestas_id_usuario` (`id_usuario`),
  -- Nombres que espera esquemaService.asegurarLlavesRespuestas
  CONSTRAINT `fk_respuestas_encuesta` FOREIGN KEY (`id_encuesta`) REFERENCES `encuestas` (`id_encuesta`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_respuestas_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jornadas_recoleccion` (
  `id_jornada` INT NOT NULL AUTO_INCREMENT,
  `feriado` VARCHAR(80) NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NOT NULL,
  `creado_por` INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_jornada`),
  KEY `jornadas_recoleccion_fecha_inicio` (`fecha_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cronograma_encuestas` (
  `id_cronograma` INT NOT NULL AUTO_INCREMENT,
  `id_jornada` INT NOT NULL,
  `id_usuario` INT NOT NULL COMMENT 'Encuestador',
  `fecha` DATE NOT NULL,
  `meta_turista` INT NOT NULL DEFAULT 0,
  `meta_hotel` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id_cronograma`),
  UNIQUE KEY `cronograma_encuestas_id_jornada_id_usuario_fecha` (`id_jornada`, `id_usuario`, `fecha`),
  KEY `cronograma_encuestas_id_usuario_fecha` (`id_usuario`, `fecha`),
  CONSTRAINT `cronograma_encuestas_ibfk_1` FOREIGN KEY (`id_jornada`) REFERENCES `jornadas_recoleccion` (`id_jornada`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `cronograma_encuestas_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Encuestas a turistas ya normalizadas para análisis (sin modelo Sequelize). La llenan los
-- parsers del ETL (Kobo turismo, formato v2 y CSV de la app). Los parsers solo insertan las
-- columnas que EXISTEN en la tabla, así que faltar una no da error: se pierde ese dato en silencio.
CREATE TABLE IF NOT EXISTS `encuestas_turisticas` (
  `id_encuesta` INT NOT NULL AUTO_INCREMENT,
  `fecha_encuesta` DATE NOT NULL,
  -- Perfil del turista (13 preguntas originales)
  `genero` VARCHAR(40) DEFAULT NULL,
  `edad` INT DEFAULT NULL,
  `pais_residencia` VARCHAR(100) DEFAULT NULL,
  `ciudad_residencia` VARCHAR(100) DEFAULT NULL,
  `nivel_educativo` VARCHAR(100) DEFAULT NULL,
  `ocupacion` VARCHAR(100) DEFAULT NULL,
  `tamano_grupo` INT DEFAULT NULL,
  `frecuencia_visitas` VARCHAR(40) DEFAULT NULL,
  `motivo_visita` VARCHAR(150) DEFAULT NULL,
  `noches_estadia` INT DEFAULT NULL,
  `gasto_total` DECIMAL(10,2) DEFAULT NULL,
  `nivel_satisfaccion` INT DEFAULT NULL,
  `probabilidad_retorno` INT DEFAULT NULL,
  `nombre_encuestador` VARCHAR(150) DEFAULT NULL,
  -- Cuestionario ajustado (11-09-2026): mismas definiciones que esquemaService
  `con_quien_viaja` VARCHAR(100) DEFAULT NULL,
  `actividades_esperadas` VARCHAR(255) DEFAULT NULL,
  `busco_informacion` VARCHAR(300) DEFAULT NULL,
  `facilidad_informacion` VARCHAR(60) DEFAULT NULL,
  `como_organizo` VARCHAR(120) DEFAULT NULL,
  `anticipacion` VARCHAR(40) DEFAULT NULL,
  `transporte_llegada` VARCHAR(80) DEFAULT NULL,
  `transporte_destino` VARCHAR(255) DEFAULT NULL,
  `gasto_alojamiento` DECIMAL(7,2) DEFAULT NULL,
  `gasto_alimentacion` DECIMAL(7,2) DEFAULT NULL,
  `gasto_transporte` DECIMAL(7,2) DEFAULT NULL,
  `gasto_entretenimiento` DECIMAL(7,2) DEFAULT NULL,
  `gasto_compras` DECIMAL(7,2) DEFAULT NULL,
  `gasto_recuerdos` DECIMAL(7,2) DEFAULT NULL,
  `rubro_mayor_gasto` VARCHAR(60) DEFAULT NULL,
  `tipo_viajero` VARCHAR(40) DEFAULT NULL,
  `expectativas` VARCHAR(60) DEFAULT NULL,
  `satisfaccion_informacion` TINYINT DEFAULT NULL,
  `satisfaccion_atencion` TINYINT DEFAULT NULL,
  `satisfaccion_seguridad` TINYINT DEFAULT NULL,
  `satisfaccion_limpieza` TINYINT DEFAULT NULL,
  `satisfaccion_calidad_precio` TINYINT DEFAULT NULL,
  `motivos_recomendacion` VARCHAR(500) DEFAULT NULL,
  -- Lugares visitados (JSON, lo lee lugaresService con JSON_TABLE) y GPS del envío
  `lugares_visitados` JSON DEFAULT NULL,
  `gps_lat` DECIMAL(10,7) DEFAULT NULL,
  `gps_lon` DECIMAL(10,7) DEFAULT NULL,
  -- Identificador del envío en KoboToolbox (_uuid): evita cargar dos veces el mismo envío
  `uuid_kobo` VARCHAR(64) DEFAULT NULL,
  `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_encuesta`),
  UNIQUE KEY `uuid_kobo` (`uuid_kobo`),
  KEY `encuestas_turisticas_fecha` (`fecha_encuesta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- ETL y reportes (sin modelo Sequelize)
-- -------------------------------------------------------------------------------------

-- Una fila por carga de archivo (models/ETLProceso.js). Los datos cargados NO guardan id_etl.
CREATE TABLE IF NOT EXISTS `etl_procesos` (
  `id_etl` INT NOT NULL AUTO_INCREMENT,
  `nombre_archivo` VARCHAR(255) NOT NULL,
  `tipo_datos` VARCHAR(30) DEFAULT NULL COMMENT 'ocupacion | encuestas | clima | feriados',
  `id_usuario` INT DEFAULT NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'EN_PROCESO' COMMENT 'EN_PROCESO | COMPLETADO | ERROR',
  `fecha_inicio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_fin` DATETIME DEFAULT NULL,
  `registros_procesados` INT NOT NULL DEFAULT 0,
  `registros_exitosos` INT NOT NULL DEFAULT 0,
  `registros_error` INT NOT NULL DEFAULT 0,
  `observacion` TEXT DEFAULT NULL,
  PRIMARY KEY (`id_etl`),
  KEY `etl_procesos_estado` (`estado`),
  KEY `etl_procesos_fecha_inicio` (`fecha_inicio`),
  KEY `etl_procesos_id_usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reportes generados (models/Reporte.js)
CREATE TABLE IF NOT EXISTS `reportes` (
  `id_reporte` INT NOT NULL AUTO_INCREMENT,
  `id_usuario` INT DEFAULT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `tipo` VARCHAR(50) DEFAULT NULL,
  `ruta_archivo` VARCHAR(500) DEFAULT NULL,
  `fecha_generacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_reporte`),
  KEY `reportes_tipo` (`tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
