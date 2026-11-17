-- =============================================================================
--  ANÁLISIS DE COMPLETITUD DE DATOS  —  Observatorio Turístico Sostenible (OTS)
--  UPSE · Encuesta ajustada 11-09-2026 (versión definitiva aplicada en campo)
-- -----------------------------------------------------------------------------
--  Propósito (evidencia para la tesis):
--    Demostrar que los datos recolectados por la app y depurados por el ETL son
--    confiables y viables. Para cada pregunta se mide cuántas respuestas llegaron
--    completas (respuestas válidas) y qué porcentaje de completitud alcanzó.
--
--  Lectura de resultados:
--    - Preguntas OBLIGATORIAS  -> deben mostrar 100.00 % de completitud.
--    - Preguntas OPCIONALES     -> ~99 %; la "no-respuesta" es mínima y válida
--      (p. ej. escalas de satisfacción 1-5 con opción "No aplica").
--    - En TODA pregunta se cumple: respondidas + sin_responder = total_encuestas.
--      El sistema NO imputa ni rellena datos: solo presenta lo recolectado/depurado.
--
--  Fuente de datos:
--    respuestas_encuestas (JSON { codigo_pregunta: valor | [valores] }) = respuestas
--    reales de la encuesta final. El cruce con encuesta_preguntas usa el "codigo"
--    exacto de cada pregunta de la encuesta ajustada 11-09-2026.
--
--  Motor: MariaDB / MySQL.  Ejecutar en HeidiSQL sobre la BD `ots`.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) COMPLETITUD POR PREGUNTA  (encuesta TURÍSTICA)
--    Una fila por pregunta, en el orden del cuestionario.
-- -----------------------------------------------------------------------------
SELECT
  ep.orden                                         AS n,
  ep.seccion                                       AS seccion,
  ep.texto                                         AS pregunta,
  CASE WHEN ep.obligatoria THEN 'Obligatoria' ELSE 'Opcional' END AS tipo,
  COUNT(re.id_respuesta)                           AS total_encuestas,
  SUM(
       JSON_UNQUOTE(JSON_EXTRACT(re.respuestas, CONCAT('$.', ep.codigo))) IS NOT NULL
   AND JSON_UNQUOTE(JSON_EXTRACT(re.respuestas, CONCAT('$.', ep.codigo))) NOT IN ('', '[]')
  )                                                AS respondidas,
  COUNT(re.id_respuesta) - SUM(
       JSON_UNQUOTE(JSON_EXTRACT(re.respuestas, CONCAT('$.', ep.codigo))) IS NOT NULL
   AND JSON_UNQUOTE(JSON_EXTRACT(re.respuestas, CONCAT('$.', ep.codigo))) NOT IN ('', '[]')
  )                                                AS sin_responder,
  ROUND(100 * SUM(
       JSON_UNQUOTE(JSON_EXTRACT(re.respuestas, CONCAT('$.', ep.codigo))) IS NOT NULL
   AND JSON_UNQUOTE(JSON_EXTRACT(re.respuestas, CONCAT('$.', ep.codigo))) NOT IN ('', '[]')
  ) / COUNT(re.id_respuesta), 2)                   AS pct_completitud
FROM encuesta_preguntas ep
JOIN encuestas e             ON e.id_encuesta = ep.id_encuesta AND e.tipo = 'turista'
JOIN respuestas_encuestas re ON re.id_encuesta = e.id_encuesta
GROUP BY ep.id_pregunta, ep.orden, ep.seccion, ep.texto, ep.obligatoria
ORDER BY ep.orden;


-- -----------------------------------------------------------------------------
-- 2) RESUMEN GLOBAL  (una sola cifra para el texto de la tesis)
--    "El sistema alcanzó una completitud global del XX.XX % sobre N celdas."
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*)                                   AS celdas_totales,     -- preguntas x encuestas
  SUM(respondida)                            AS celdas_con_dato,
  ROUND(100 * SUM(respondida) / COUNT(*), 2) AS completitud_global  -- %
FROM (
  SELECT
    (JSON_UNQUOTE(JSON_EXTRACT(re.respuestas, CONCAT('$.', ep.codigo))) IS NOT NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(re.respuestas, CONCAT('$.', ep.codigo))) NOT IN ('', '[]')) AS respondida
  FROM encuesta_preguntas ep
  JOIN encuestas e             ON e.id_encuesta = ep.id_encuesta AND e.tipo = 'turista'
  JOIN respuestas_encuestas re ON re.id_encuesta = e.id_encuesta
) t;


-- =============================================================================
--  VARIANTES
-- =============================================================================

-- 3) Misma consulta pero para la encuesta de HOTELES:
--    en las consultas 1 y 2 cambia:   e.tipo = 'turista'   ->   e.tipo = 'hotel'

-- 4) Limitar a un FERIADO concreto (p. ej. noviembre / Difuntos):
--    agrega esta condición en el JOIN de respuestas, antes del GROUP BY:
--
--      JOIN respuestas_encuestas re
--        ON re.id_encuesta = e.id_encuesta
--       AND re.fecha_encuesta BETWEEN '2026-10-30 00:00:00' AND '2026-11-05 23:59:59'
--
--    (ajusta las fechas al rango real del feriado que estés reportando.)


-- 5) VERIFICAR que el cuestionario cargado en la BD = encuesta ajustada 11-09-2026.
--    Lista todas las preguntas turísticas tal como están guardadas. Debe mostrar
--    'edad' con opciones que empiezan en "18 a 24 años" (NUNCA "Menor de 18 años").
SELECT
  ep.orden,
  ep.seccion,
  ep.codigo,
  ep.texto,
  ep.tipo,
  CASE WHEN ep.obligatoria THEN 'Obligatoria' ELSE 'Opcional' END AS tipo_resp,
  ep.opciones
FROM encuesta_preguntas ep
JOIN encuestas e ON e.id_encuesta = ep.id_encuesta AND e.tipo = 'turista'
ORDER BY ep.orden;
-- =============================================================================
