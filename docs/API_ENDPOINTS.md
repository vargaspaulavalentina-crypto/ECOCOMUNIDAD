# Documentación de Endpoints API REST — EcoCommunity

- **Base URL (Backend Python / Flask):** `http://localhost:5000`
- **Proxy Frontend (Vite):** `http://localhost:3000/api/*` → `http://localhost:5000/api/*`
- **Base de Datos:** MySQL / MariaDB en XAMPP (`ecocommunity_db`) — ver procedimiento en [liquibase/README_MIGRACIONES_XAMPP.md](file:///C:/Users/Aprendiz/ECOCOMUNIDAD/liquibase/README_MIGRACIONES_XAMPP.md)
- **Documentación Interactiva (Swagger UI):** `http://localhost:5000/api/docs`
- **Especificación OpenAPI 3.0 (JSON):** `http://localhost:5000/api/openapi.json`

---

## 1. Autenticación y Autorización (`/api/auth/*`)

Los endpoints protegidos requieren token JWT en el encabezado HTTP:
```http
Authorization: Bearer <TOKEN_JWT>
```
**Roles unificados del sistema:** `ciudadano`, `recolector`, `punto_acopio`, `marca_aliada`, `admin`.

| Método | Ruta | Acceso / Roles | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Público | Registra un usuario en MySQL (`password_hash` PBKDF2), registra auditoría y devuelve JWT. |
| `POST` | `/api/auth/login` | Público | Autentica por `email` y `password` y retorna token JWT (`HS256`) + perfil y rol. |
| `GET` | `/api/auth/me` | `BearerAuth` (cualquier rol activo) | Devuelve los datos del usuario autenticado desde MySQL. |

### Ejemplo de Login y Respuesta (`200 OK`)
```json
// POST /api/auth/login
{
  "email": "admin@ecocommunity.org",
  "password": "EcoCommunity2026*"
}

// Respuesta 200 OK
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id_usuario": 5,
    "nombre": "SuperAdmin Eco",
    "email": "admin@ecocommunity.org",
    "rol": "admin",
    "entidad": "Plataforma Matriz"
  }
}
```
**Errores:** `400 Bad Request` (faltan campos), `401 Unauthorized` (credenciales inválidas o token ausente/expirado), `403 Forbidden` (cuenta inactiva/suspendida), `409 Conflict` (email duplicado en registro).

---

## 2. CRUD de Usuarios (`/api/usuarios`)

| Método | Ruta | Bearer | Roles Permitidos | Códigos HTTP |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/usuarios` | Sí | `admin` | `200`, `401`, `403` |
| `GET` | `/api/usuarios/<id>` | Sí | Propio usuario o `admin` | `200`, `401`, `403`, `404` |
| `PUT` | `/api/usuarios/<id>` | Sí | Propio usuario o `admin` | `200`, `401`, `403`, `404` |
| `DELETE` | `/api/usuarios/<id>` | Sí | `admin` | `200`, `401`, `403`, `404` |

---

## 3. CRUD de Materiales (`/api/materiales`)

| Método | Ruta | Bearer | Roles Permitidos | Códigos HTTP |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/materiales` | No | Público | `200` |
| `GET` | `/api/materiales/<id>` | No | Público | `200`, `404` |
| `POST` | `/api/materiales` | Sí | `admin` | `201`, `400`, `401`, `403` |
| `PUT` | `/api/materiales/<id>` | Sí | `admin` | `200`, `401`, `403`, `404` |
| `DELETE` | `/api/materiales/<id>` | Sí | `admin` | `200`, `401`, `403`, `404` |

**Categorías válidas:** `Plástico PET`, `Cartón y Papel`, `Vidrio`, `Aluminio / Latas`, `Tetra Pak`, `No reciclable`.

---

## 4. CRUD de Puntos de Recolección (`/api/puntos`)

| Método | Ruta | Bearer | Roles Permitidos | Códigos HTTP |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/puntos?userLat=&userLng=` | No | Público | `200` |
| `GET` | `/api/puntos/<id>` | No | Público | `200`, `404` |
| `POST` | `/api/puntos` | Sí | `admin` | `201`, `400`, `401`, `403` |
| `PUT` | `/api/puntos/<id>` | Sí | `admin`, `punto_acopio` | `200`, `401`, `403`, `404` |
| `DELETE` | `/api/puntos/<id>` | Sí | `admin` | `200`, `401`, `403`, `404` |

---

## 5. Clasificación IA y CRUD de Entregas (`/api/ai/*`, `/api/entregas/*`)

| Método | Ruta | Bearer | Roles / Propiedad | Códigos HTTP |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/classify` | No | Público | `200` |
| `POST` | `/api/entregas/validate-and-deposit` | **Sí** | Propio usuario o `admin` | `200`, `400`, `401`, `403`, `404`, `429` |
| `GET` | `/api/entregas/history` | No | Público (lectura filtrable) | `200` |
| `GET` | `/api/entregas/<id>` | No | Público | `200`, `404` |
| `PUT` | `/api/entregas/<id>/custodia` | **Sí** | `recolector`, `punto_acopio`, `admin` | `200`, `400`, `401`, `403`, `404` |
| `DELETE` | `/api/entregas/<id>` | **Sí** | `admin` | `200`, `401`, `403`, `404` |

### Regla de transición secuencial en `PUT /api/entregas/<id>/custodia`
Solo se permiten transiciones estrictamente consecutivas:
`depositado` $\rightarrow$ `recolectado` $\rightarrow$ `en_acopio` $\rightarrow$ `transformado`.
```json
// Respuesta 400 Bad Request ante salto inválido (ej. depositado -> transformado)
{
  "error": "Transición secuencial inválida de 'depositado' a 'transformado'.",
  "paso_actual": "depositado",
  "siguiente_paso_permitido": "recolectado",
  "orden_secuencial": "depositado -> recolectado -> en_acopio -> transformado"
}
```

---

## 6. Billetera, Recompensas, Reportes ESG y Diagnóstico

| Método | Ruta | Bearer | Roles / Propiedad | Códigos HTTP |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/user/wallet` | **Sí** | Propio usuario o `admin` | `200`, `401`, `403` |
| `POST` | `/api/rewards/redeem` | **Sí** | Propio usuario o `admin` | `200`, `400`, `401`, `403`, `404` |
| `GET` | `/api/esg/report` | No | Público | `200` |
| `GET` | `/api/db/status` | No | Público | `200`, `500` |
| `GET` | `/api/openapi.json` | No | Público | `200` |
| `GET` | `/api/docs` | No | Público | `200` |

### Ejemplo de Respuesta `POST /api/rewards/redeem` (`200 OK`)
```json
{
  "success": true,
  "mensaje": "Canje exitoso: Café Orgánico o Bebida Mediana",
  "nuevo_saldo": 78,
  "voucher": {
    "codigo": "ECO-GREE-4821",
    "titulo": "Café Orgánico o Bebida Mediana",
    "sponsor": "GreenRoast Coffee",
    "fecha_emision": "2026-11-23T13:30:00",
    "vigencia": "30 días calendario"
  }
}
```
