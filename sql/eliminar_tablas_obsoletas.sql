-- Elimina tablas que ningún módulo del sistema utiliza.
--   modelo_metricas / modelo_entrenamiento : el microservicio Python guarda el modelo en .pkl
--                                            y las métricas en memoria; nada escribe en ellas.
--   validaciones_predicciones              : su código (modelo, servicio, controller y ruta) era
--                                            código muerto; la validación real es GET /predicciones-historicas
--                                            del microservicio Python y no se persiste.
-- Se CONSERVA variables_estacionales: Python la usa para entrenar y predecir.
--
-- Uso:  mysql -u root -p ots < backend_ots/sql/eliminar_tablas_obsoletas.sql

USE ots;

-- 1) Verificación previa: las tres deben estar en 0 filas antes de continuar.
SELECT 'modelo_entrenamiento' AS tabla, COUNT(*) AS filas FROM modelo_entrenamiento
UNION ALL SELECT 'modelo_metricas', COUNT(*) FROM modelo_metricas
UNION ALL SELECT 'validaciones_predicciones', COUNT(*) FROM validaciones_predicciones;

-- 2) Eliminación (modelo_metricas primero: tiene FK hacia modelo_entrenamiento).
DROP TABLE IF EXISTS modelo_metricas;
DROP TABLE IF EXISTS modelo_entrenamiento;
DROP TABLE IF EXISTS validaciones_predicciones;
