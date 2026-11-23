# Enlaces Verificados de GitHub — Entregable Backend y Base de Datos (ECOCOMMUNITY)

- **Presentado por:** Paula Valentina Vargas Andrade
- **Instructor:** Javier Umberto Pinto
- **Centro de Formación:** SENA – Centro de la Industria, la Empresa y los Servicios (ADSO)
- **Repositorio Principal:** https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD

---

## 1. Crear Base de Datos (MySQL XAMPP + Liquibase)
- **Script SQL de creación de 8 tablas y datos iniciales:**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/liquibase/changelog/01-initial-schema-and-seed.sql
- **Changelog Liquibase XML:**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/liquibase/changelog/01-initial-schema-and-seed.xml
- **Master Changelog Liquibase:**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/liquibase/db.changelog-master.xml
- **Guía de inicialización en MySQL XAMPP:**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/liquibase/README_MIGRACIONES_XAMPP.md

## 2. Implementar API REST (Python 3.12 / Flask)
- **Servidor Backend Principal (`app.py`):**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/app.py
- **Dependencias Python (`requirements.txt`):**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/requirements.txt

## 3. Desarrollar Autenticación y Autorización (JWT + Roles)
- **Lógica JWT (`create_jwt_token`, `@require_auth`, `@require_roles`, `/api/auth/register`, `/api/auth/login`, `/api/auth/me`) en `app.py`:**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/app.py
- **Conexión del Frontend al Login/Registro (`AuthModal.tsx`):**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/src/components/AuthModal.tsx

## 4. Implementar Operaciones CRUD (Usuarios, Materiales, Puntos Limpios y Entregas)
- **Rutas CRUD (`GET`, `POST`, `PUT`, `DELETE`) conectadas a MySQL en `app.py`:**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/app.py

## 5. Documentar Endpoints
- **Documentación completa en Markdown (`API_ENDPOINTS.md`):**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/docs/API_ENDPOINTS.md
- **Documento Word del Entregable (`BACKEND_API_BD_ECOCOMMUNITY_Paula_Vargas.docx`):**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/docs/BACKEND_API_BD_ECOCOMMUNITY_Paula_Vargas.docx
- **Guía General del Proyecto (`README.md`):**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/README.md
- **Swagger UI / OpenAPI 3.0 en ejecución local:** `http://localhost:5000/api/docs` y `http://localhost:5000/api/openapi.json`

## 6. Nota: Backend Funcional y Base de Datos (Pruebas QA 13/13)
- **Suite de Pruebas Automatizadas Python / Flask / MySQL (`test_python_mysql.py`):**  
  https://github.com/vargaspaulavalentina-crypto/ECOCOMUNIDAD/blob/main/tests/test_python_mysql.py
