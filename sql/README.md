# Base de datos local desde cero

Scripts para crear la base `ots` vacía, sin copiar producción.

| Archivo | Qué hace |
|---|---|
| `001_esquema_inicial.sql` | Crea las 19 tablas que usan el backend y el ETL. Es idempotente (`CREATE TABLE IF NOT EXISTS`). |
| `002_datos_iniciales.sql` | Crea los 4 roles (IDs 0–3) y un Super Administrador **de desarrollo**. **No ejecutar en producción.** |
| `eliminar_tablas_obsoletas.sql` | Script manual antiguo para limpiar tablas en desuso de una base existente. No forma parte del arranque desde cero. |

Las encuestas base y el calendario de feriados 2026 **no** van en estos scripts: el backend los carga solo la primera vez que arranca.

## Paso a paso (Windows, PowerShell, con Docker Desktop abierto)

**1. Levantar MariaDB 11.8** (la misma versión que producción), con la base `ots` y un usuario propio:

```powershell
docker run -d --name ots-mariadb -p 3306:3306 `
  -e MARIADB_ROOT_PASSWORD=root_local_123 `
  -e MARIADB_DATABASE=ots `
  -e MARIADB_USER=ots_user `
  -e MARIADB_PASSWORD=ots_local_123 `
  -v ots-mariadb-data:/var/lib/mysql `
  mariadb:11.8
```

**2. Ejecutar los scripts** desde la carpeta `backend_ots`. Se copian al contenedor y se ejecutan dentro: redirigir con `<` no funciona en PowerShell, y canalizar con `Get-Content` corrompe las tildes.

```powershell
docker cp sql/001_esquema_inicial.sql ots-mariadb:/tmp/
docker cp sql/002_datos_iniciales.sql ots-mariadb:/tmp/
docker exec ots-mariadb sh -c "mariadb -uots_user -pots_local_123 ots < /tmp/001_esquema_inicial.sql"
docker exec ots-mariadb sh -c "mariadb -uots_user -pots_local_123 ots < /tmp/002_datos_iniciales.sql"
```

Para comprobar que quedó bien (deben salir 19 tablas y 4 roles):
```powershell
docker exec ots-mariadb mariadb -uots_user -pots_local_123 ots -e "SHOW TABLES; SELECT * FROM roles;"
```

**3. Configurar los `.env`** a partir de `.env.example`, en `backend_ots` y en `Microserv_ETLpython`: `DB_USER=ots_user`, `DB_PASSWORD=ots_local_123` y el mismo `SERVICE_TOKEN` en los dos.

**4. Arrancar** el backend (`npm run dev`) y el ETL (`uvicorn app:app --port 5000`). En el primer arranque, el backend carga los feriados de 2026 y las encuestas base. No debería mostrar ningún mensaje de "Columna ... agregada": el script ya crea todo lo que el backend espera.

**5. Entrar** al front con el usuario de desarrollo:

| Correo | Contraseña |
|---|---|
| `admin@ots.local` | `OtsDev-Cambiar2026` |

### Cambiar la contraseña del administrador de desarrollo

Desde `backend_ots`, genera el hash y actualízalo:

```powershell
node -e "require('bcryptjs').hash(process.argv[1], 10).then(console.log)" "TuNuevaClave"
docker exec ots-mariadb mariadb -uots_user -pots_local_123 ots -e "UPDATE usuarios SET password_hash='<hash>' WHERE correo='admin@ots.local';"
```

## Notas

- **Empezar de cero:** `docker rm -f ots-mariadb` y luego `docker volume rm ots-mariadb-data`. Después repite los pasos 1 y 2.
- **Producción no necesita estos scripts:** su base ya existe. `001` no altera tablas existentes, y `002` crearía un administrador con una contraseña pública.
- **Cuando cambie un modelo o `esquemaService.js`, actualiza también `001_esquema_inicial.sql`.** Para comprobar que coinciden, arranca el backend contra una base recién creada con estos scripts: no debe imprimir "Columna ... agregada", "FK agregada" ni "ahora admite".
