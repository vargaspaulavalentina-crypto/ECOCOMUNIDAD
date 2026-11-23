# Procedimiento de Inicialización de Base de Datos en XAMPP MySQL / Liquibase

Cuando no se cuenta con el binario CLI de **Liquibase** instalado en Windows, la base de datos `ecocommunity_db` se inicializa directamente en **MySQL / MariaDB de XAMPP** utilizando los mismos scripts versionados de la carpeta `liquibase/`.

## 1. Requisitos previos
1. Abrir **XAMPP Control Panel** e iniciar el servicio **MySQL** (puerto `3306`, usuario `root`, sin contraseña por defecto).
2. Verificar la configuración de conexión en `liquibase/liquibase.properties` y `.env`:
   - `MYSQL_HOST=localhost`
   - `MYSQL_PORT=3306`
   - `MYSQL_USER=root`
   - `MYSQL_PASSWORD=`
   - `MYSQL_DATABASE=ecocommunity_db`

## 2. Creación de la base de datos e importación del Changelog SQL (UTF-8)
```powershell
# 1. Crear la base de datos con soporte completo UTF-8 (utf8mb4)
& "C:\xampp\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS ecocommunity_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Ejecutar el script inicial de Liquibase (tablas + datos semilla) forzando utf8mb4
Get-Content "liquibase\changelog\01-initial-schema-and-seed.sql" -Encoding UTF8 | & "C:\xampp\mysql\bin\mysql.exe" --default-character-set=utf8mb4 -u root ecocommunity_db
```
> **Nota importante sobre codificación en Windows:** Si se omite `--default-character-set=utf8mb4` en PowerShell/Windows, los acentos (`Plástico PET`, `Cartón y Papel`) pueden corromperse. Se recomienda usar `--default-character-set=utf8mb4` o aplicar los inserts desde Python (`pymysql` con `charset='utf8mb4'`).

## 3. Verificación de tablas y registros
```powershell
& "C:\xampp\mysql\bin\mysql.exe" -u root ecocommunity_db -e "SHOW TABLES; SELECT id_rol, nombre FROM roles; SELECT id_material, categoria FROM materiales;"
```
Deben aparecer las **8 tablas**: `roles`, `usuarios`, `materiales`, `puntos_limpios`, `entregas`, `transacciones`, `recompensas` y `registro_auditoria`.

## 4. Ejecución equivalente con Liquibase CLI (opcional)
Si posteriormente instalas **Liquibase CLI** y el driver **MySQL Connector/J**, puedes ejecutar:
```powershell
liquibase --defaults-file=liquibase/liquibase.properties update
```
Los archivos versionados listos en esta carpeta son:
- `liquibase/db.changelog-master.xml`
- `liquibase/changelog/01-initial-schema-and-seed.sql`
- `liquibase/changelog/01-initial-schema-and-seed.xml`
