# Documentación de Endpoints API REST — EcoCommunity

- **Base URL (Backend Python / Flask):** `http://localhost:5000`
- **Proxy Frontend (Vite):** `http://localhost:3000/api/*` → `http://localhost:5000/api/*`
- **Base de Datos:** MySQL / MariaDB en XAMPP (`ecocommunity_db`)
- **Documentación Interactiva (Swagger UI):** `http://localhost:5000/api/docs`
- **Especificación OpenAPI 3.0 (JSON):** `http://localhost:5000/api/openapi.json`

---

## 1. Autenticación y Autorización (`/api/auth/*`)

Los endpoints protegidos requieren el encabezado HTTP:
```http
Authorization: Bearer <TOKEN_JWT>
```

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Público | Registra un usuario en MySQL (`password_hash` PBKDF2), crea registro de auditoría y devuelve JWT. |
| `POST` | `/api/auth/login` | Público | Autentica por `email` y `password` y retorna token JWT (`HS256`) + perfil y rol. |
| `GET` | `/api/auth/me` | Autenticado (`Bearer`) | Devuelve los datos del usuario autenticado desde MySQL. |

### Ejemplo de Registro y Login
```json
// POST /api/auth/register
{
  "nombre": "Ana Recicladora",
  "email": "ana@ecocommunity.org",
  "password": "MiPasswordSeguro123",
  "entidad": "Comunidad Norte",
  "rol": "ciudadano"
}

// POST /api/auth/login (Usuario semilla demo: contraseña EcoCommunity2026*)
{
  "email": "admin@ecocommunity.org",
  "password": "EcoCommunity2026*"
}
```
**Códigos de respuesta:** `200 OK` / `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict` (email duplicado).

---

## 2. CRUD de Usuarios (`/api/usuarios`)

| Método | Ruta | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/usuarios` | `admin` | Lista todos los usuarios con su rol y estado. |
| `GET` | `/api/usuarios/<id>` | Propio usuario o `admin` | Consulta el detalle de un usuario específico. |
| `PUT` | `/api/usuarios/<id>` | Propio usuario o `admin` | Actualiza `nombre`, `entidad` (y `estado`/`rol` si es `admin`). |
| `DELETE` | `/api/usuarios/<id>` | `admin` | Elimina el usuario o lo desactiva (`soft_delete`) si posee entregas históricas. |

---

## 3. CRUD de Materiales (`/api/materiales`)

| Método | Ruta | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/materiales` | Público | Lista el catálogo completo de materiales reciclables en MySQL. |
| `GET` | `/api/materiales/<id>` | Público | Obtiene el detalle de un material por ID. |
| `POST` | `/api/materiales` | `admin` | Crea un nuevo material reciclable (`nombre`, `categoria`, `puntos_por_kg`, `co2_factor`, `instrucciones_reciclaje`). |
| `PUT` | `/api/materiales/<id>` | `admin` | Actualiza los parámetros de un material existente. |
| `DELETE` | `/api/materiales/<id>` | `admin` | Elimina un material del catálogo. |

**Categorías válidas:** `Plástico PET`, `Cartón y Papel`, `Vidrio`, `Aluminio / Latas`, `Tetra Pak`, `No reciclable`.

---

## 4. CRUD de Puntos de Recolección (`/api/puntos`)

| Método | Ruta | Roles Permitidos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/puntos?userLat=&userLng=` | Público | Lista puntos limpios activos. Si recibe coordenadas, calcula distancia **Haversine** en metros y marca `dentro_de_geofence` ($\le 20$ m). |
| `GET` | `/api/puntos/<id>` | Público | Obtiene información detallada de un punto limpio. |
| `POST` | `/api/puntos` | `admin` | Crea un nuevo punto de recolección con coordenadas y hash QR. |
| `PUT` | `/api/puntos/<id>` | `admin`, `punto_acopio` | Actualiza nombre, dirección, horario, capacidad o estado activo. |
| `DELETE` | `/api/puntos/<id>` | `admin` | Elimina el punto o lo desactiva (`activo = 0`) si tiene entregas asociadas. |

---

## 5. Clasificación con IA y CRUD de Entregas (`/api/ai/*`, `/api/entregas/*`)

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/classify` | Público | Clasifica por `barcode` en MySQL o por imagen (`imageBase64`) usando **Google Gemini AI** con fallback heurístico local. |
| `POST` | `/api/entregas/validate-and-deposit` | Público / App | Valida código QR, geofencing ($\le 20$ m) y regla antifraude de 24h; inserta entrega, transacción y auditoría en MySQL. |
| `GET` | `/api/entregas/history?search=&categoria=&custodia=` | Público | Consulta filtrada para el modal **Histórico BD** conectado en vivo a MySQL. |
| `GET` | `/api/entregas/<id>` | Público | Consulta el detalle completo de una entrega por ID. |
| `PUT` | `/api/entregas/<id>/custodia` | Público / Operador | Actualiza `cadena_custodia_paso` (`depositado` → `recolectado` → `en_acopio` → `transformado`) y registra auditoría. |
| `DELETE` | `/api/entregas/<id>` | `admin` | Elimina una entrega anulada o de prueba y registra auditoría. |

---

## 6. Billetera, Recompensas, Reportes ESG y Diagnóstico

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/user/wallet?usuario_id=1` | Público / Usuario | Devuelve saldo de Ecocoins, rango ecológico, estadísticas e historial de transacciones. |
| `POST` | `/api/rewards/redeem` | Público / Usuario | Canjea una recompensa (`rewardId`, `usuario_id`), descuenta stock en MySQL y genera código voucher único. |
| `GET` | `/api/esg/report` | Público | Consolida métricas ESG (kg reciclados, $CO_2$ mitigado, litros de agua, árboles equivalentes y desglose por categoría). |
| `GET` | `/api/db/status` | Público | Diagnóstico en tiempo real de conexión a MySQL XAMPP, tablas activas y conteo de filas. |
| `GET` | `/api/openapi.json` | Público | Esquema OpenAPI 3.0 en JSON. |
| `GET` | `/api/docs` | Público | Interfaz web interactiva **Swagger UI**. |
