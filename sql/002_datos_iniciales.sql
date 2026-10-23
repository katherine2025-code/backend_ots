-- =====================================================================================
-- OTS - Datos iniciales para una base NUEVA de DESARROLLO
-- =====================================================================================
-- Ejecutar después de 001_esquema_inicial.sql. Crea:
--   * Los 4 roles con los IDs que espera el código (0..3, ver usuarioController y el front).
--   * Un Super Administrador de DESARROLLO para poder entrar la primera vez.
--
-- ⚠ NO EJECUTAR EN PRODUCCIÓN. La contraseña del administrador es pública (está en este
--   archivo y en sql/README.md). Si alguna vez se usa fuera de tu máquina, cámbiala primero.
--
-- Usuario de desarrollo:
--   correo:     admin@ots.local
--   contraseña: OtsDev-Cambiar2026
--
-- Para poner otra contraseña SIN editar este archivo, genera el hash bcrypt desde backend_ots:
--   node -e "require('bcryptjs').hash(process.argv[1], 10).then(console.log)" "TuNuevaClave"
-- y actualízalo (también sirve para cambiarla después de cargar este script):
--   UPDATE usuarios SET password_hash = '<hash>' WHERE correo = 'admin@ots.local';
--
-- Es idempotente: si los roles o el usuario ya existen, no los duplica ni los modifica.
-- No hace falta cargar encuestas ni feriados: el backend los siembra solo al arrancar
-- (encuestaService.sembrarSiVacio y esquemaService.cargarFeriadosOficiales2026).
-- =====================================================================================

SET NAMES utf8mb4;

-- El Super Administrador tiene id_rol = 0. Sin esto, MariaDB/MySQL interpretan el 0 en una
-- columna AUTO_INCREMENT como "genera el siguiente" y el rol quedaría con otro id.
SET @sql_mode_anterior = @@SESSION.sql_mode;
SET SESSION sql_mode = CONCAT(@@SESSION.sql_mode, ',NO_AUTO_VALUE_ON_ZERO');

INSERT IGNORE INTO `roles` (`id_rol`, `nombre`, `descripcion`) VALUES
  (0, 'Super Administrador', 'Control total: cuentas de administración, ETL, entrenamiento del modelo y bitácora completa'),
  (1, 'Administrador',       'Gestiona hoteles, usuarios, encuestas y el cronograma de recolección'),
  (2, 'Investigador',        'Consulta dashboard, reportes y predicciones; usa el simulador'),
  (3, 'Encuestador',         'Registra encuestas en campo desde la app');

SET SESSION sql_mode = @sql_mode_anterior;

-- Super Administrador de desarrollo (contraseña: OtsDev-Cambiar2026, hash bcrypt de costo 10)
INSERT IGNORE INTO `usuarios` (`nombres`, `apellidos`, `correo`, `password_hash`, `id_rol`, `estado`) VALUES
  ('Admin', 'Desarrollo', 'admin@ots.local',
   '$2b$10$TjbQqjeSbTN18Pv.q6PBwe5Wtxx8cYttIwvlk/ndIZEE9tD3PCiky', 0, 1);
