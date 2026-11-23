# EcoCommunity — Plataforma de Reciclaje Comunitario, IA & Trazabilidad ESG

- **Autora:** Paula Valentina Vargas Andrade (*Tecnólogo en Análisis y Desarrollo de Software - ADSO*)
- **Instructor Técnico:** Javier Umberto Pinto
- **Centro de Formación:** SENA – Centro de la Industria, la Empresa y los Servicios

---

## Arquitectura Tecnológica

| Capa | Tecnología | Ubicación |
| :--- | :--- | :--- |
| **Backend Principal (API REST)** | Python 3.12 · Flask · Flask-CORS · PyMySQL · JWT (`HS256`) | [`app.py`](app.py) |
| **Base de Datos & Migraciones** | MySQL / MariaDB (XAMPP `ecocommunity_db`) · Liquibase (SQL/XML) | [`liquibase/`](liquibase/) |
| **Frontend Web & Escena 3D** | React 19 · TypeScript · Tailwind CSS · Three.js (WebGL) | [`src/`](src/) |
| **IA Clasificación Orientativa** | Google Gemini Vision (`google-genai`) + Catálogo de Códigos de Barras | [`app.py`](app.py) |
| **Documentación & Pruebas** | OpenAPI 3.0 / Swagger UI (`/api/docs`) · `unittest` (`13/13 OK`) | [`docs/`](docs/) · [`tests/`](tests/) |

---

## Inicio Rápido

### 1. Base de Datos MySQL (XAMPP)
1. Inicia **MySQL** en **XAMPP Control Panel** (puerto `3306`, usuario `root`, sin contraseña).
2. Inicializa `ecocommunity_db` siguiendo [`liquibase/README_MIGRACIONES_XAMPP.md`](liquibase/README_MIGRACIONES_XAMPP.md).

### 2. Instalar dependencias y compilar frontend
```powershell
pip install -r requirements.txt
npm install --legacy-peer-deps
npm run build
```

### 3. Ejecutar el servidor principal (Python / Flask)
```powershell
python app.py
```
- **Aplicación Web:** http://localhost:5000
- **Documentación Interactiva Swagger UI:** http://localhost:5000/api/docs
- **Estado de MySQL en vivo:** http://localhost:5000/api/db/status

---

## Credenciales Demo (Base de Datos `ecocommunity_db`)
Contraseña común para los usuarios semilla: `EcoCommunity2026*`

| Rol | Correo |
| :--- | :--- |
| `ciudadano` | `carlos.mendoza@ecocommunity.org` |
| `recolector` | `hernan.recolector@rutalimpia.co` |
| `punto_acopio` | `beatriz.acopio@centroverde.org` |
| `marca_aliada` | `laura.aliados@greenroast.com` |
| `admin` | `admin@ecocommunity.org` |

---

## Ejecutar Pruebas Automatizadas (QA)
```powershell
python -m unittest tests/test_python_mysql.py -v
```
Cubre **13 pruebas de integración** contra MySQL XAMPP: estado de BD, geofencing ($\le 20$ m), antifraude 24h, custodia secuencial, autenticación JWT, autorización por roles (`401`/`403`), CRUD completo de Usuarios, Materiales, Puntos Limpios y Entregas, billetera, canjes y OpenAPI/Swagger.
