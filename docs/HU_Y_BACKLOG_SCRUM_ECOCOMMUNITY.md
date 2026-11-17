<div align="center">

# SERVICIO NACIONAL DE APRENDIZAJE – SENA
### CENTRO DE LA INDUSTRIA, LA EMPRESA Y LOS SERVICIOS
#### TECNÓLOGO EN ANÁLISIS Y DESARROLLO DE SOFTWARE (ADSO)

---

## HISTORIAS DE USUARIO (HU) Y PRODUCT BACKLOG SCRUM (4 SEMANAS)
### PROYECTO #18: PLATAFORMA DE RECICLAJE COMUNITARIO
# **ECOCOMMUNITY**

**Módulos:** Usuarios · Materiales · Puntos de Recolección · Entregas  
**IA:** Clasificación orientativa de materiales mediante imágenes (Google Gemini AI)  
**Tecnología:** Python / Flask / MySQL

---

**Presentado por (Aprendiz):**  
**PAULA VALENTINA VARGAS ANDRADE**

**Presentado a (Instructor Técnico):**  
**JAVIER UMBERTO PINTO**

**Centro de Formación:**  
SENA – Centro de la Industria, la Empresa y los Servicios

**Fecha:** Noviembre de 2026

</div>

---

## 1. Historias de Usuario por Módulo del Proyecto #18

### 1.1. Módulo de Usuarios y Roles (`usuarios` / `roles`)
| HISTORIA DE USUARIO | ID: HU-01 | Prioridad: Alta | Estimación: 3 pts | Sprint: 2 |
| :--- | :--- | :--- | :--- | :--- |
| **Rol:** | Como **usuario de la plataforma** (ciudadano, recolector, operador de acopio o administrador) |
| **Quiero:** | Iniciar sesión o seleccionar mi rol operativo activo |
| **Para:** | Acceder a las herramientas y vistas autorizadas de mi perfil en EcoCommunity. |
| **Criterios de Aceptación:** | 1. El sistema permite autenticar credenciales o seleccionar el rol activo.<br>2. La sesión persiste de forma segura en el cliente.<br>3. La barra de navegación muestra las opciones propias del rol.<br>4. El usuario puede cerrar sesión en cualquier momento. |

### 1.2. Módulo de Materiales e IA (`materiales` / Clasificación Orientativa por Imagen)
| HISTORIA DE USUARIO | ID: HU-02 | Prioridad: Alta | Estimación: 8 pts | Sprint: 3 |
| :--- | :--- | :--- | :--- | :--- |
| **Rol:** | Como **ciudadano reciclador** |
| **Quiero:** | Capturar una fotografía de mi residuo o ingresar su código de barras |
| **Para:** | Recibir una clasificación orientativa por Inteligencia Artificial que me indique el tipo de material, cómo limpiarlo y cuántos Ecocoins ganaré. |
| **Criterios de Aceptación:** | 1. Si se ingresa código de barras, el backend Python/Flask consulta la tabla `materiales` en MySQL en $\le 1.5$ s.<br>2. Si se envía fotografía, el endpoint `/api/ai/classify` invoca a Google Gemini Vision AI y devuelve JSON con categoría, confianza, peso estimado, puntos e instrucciones de preparación.<br>3. Si el material es "No reciclable", el sistema lo advierte e impide el registro con incentivo. |

### 1.3. Módulo de Puntos de Recolección (`puntos_limpios` / Geofencing)
| HISTORIA DE USUARIO | ID: HU-03 | Prioridad: Alta | Estimación: 5 pts | Sprint: 2 |
| :--- | :--- | :--- | :--- | :--- |
| **Rol:** | Como **ciudadano reciclador** |
| **Quiero:** | Consultar en un mapa los puntos de recolección cercanos a mi ubicación GPS |
| **Para:** | Saber a qué contenedor dirigirme, qué materiales acepta y confirmar si estoy dentro del radio de 20 metros para depositar. |
| **Criterios de Aceptación:** | 1. El endpoint `/api/puntos` consulta MySQL y calcula la distancia exacta mediante la fórmula de Haversine.<br>2. Los puntos se ordenan de menor a mayor distancia.<br>3. Se muestra un indicador verde cuando la distancia es $\le 20$ metros.<br>4. Se visualiza horario, dirección, capacidad actual en kg y materiales aceptados. |

### 1.4. Módulo de Entregas y Control Antifraude (`entregas`)
| HISTORIA DE USUARIO | ID: HU-04 | Prioridad: Alta | Estimación: 8 pts | Sprint: 3 |
| :--- | :--- | :--- | :--- | :--- |
| **Rol:** | Como **ciudadano reciclador** |
| **Quiero:** | Registrar mi entrega escaneando el código QR del punto de recolección |
| **Para:** | Obtener un recibo digital criptográfico y recibir mis Ecocoins de inmediato. |
| **Criterios de Aceptación:** | 1. El servidor Python/Flask verifica en MySQL que el hash QR coincida con el contenedor.<br>2. Si la distancia GPS supera los 20 metros, rechaza el depósito con HTTP 403.<br>3. Si el usuario ya entregó el mismo material en las últimas 24 horas en ese punto, rechaza con HTTP 429.<br>4. Al aprobarse, inserta la fila en `entregas`, acredita puntos en `transacciones` y emite el recibo con hash `0x...`. |

### 1.5. Módulo de Histórico Interactivo en MySQL y Cadena de Custodia (`entregas` / `registro_auditoria`)
| HISTORIA DE USUARIO | ID: HU-05 | Prioridad: Alta | Estimación: 5 pts | Sprint: 3 |
| :--- | :--- | :--- | :--- | :--- |
| **Rol:** | Como **operador o ciudadano** |
| **Quiero:** | Abrir el Histórico de Base de Datos en la página web, filtrar entregas y actualizar su estado de custodia |
| **Para:** | Auditar en vivo los registros almacenados en MySQL XAMPP y dar seguimiento al ciclo (`depositado`, `recolectado`, `en_acopio`, `transformado`). |
| **Criterios de Aceptación:** | 1. El botón "Histórico BD" abre el modal conectado a `GET /api/entregas/history` y `GET /api/db/status`.<br>2. Permite buscar por texto libre, categoría de material o estado de custodia.<br>3. Permite cambiar el estado de custodia mediante `PUT /api/entregas/<id>/custodia`, persistiendo el cambio en MySQL. |

### 1.6. Módulo de Billetera, Recompensas y Reportes ESG (`transacciones` / `recompensas`)
| HISTORIA DE USUARIO | ID: HU-06 | Prioridad: Media | Estimación: 5 pts | Sprint: 4 |
| :--- | :--- | :--- | :--- | :--- |
| **Rol:** | Como **ciudadano y supervisor ambiental** |
| **Quiero:** | Consultar mi billetera de Ecocoins, canjear cupones y visualizar el reporte consolidado de impacto ESG |
| **Para:** | Redimir beneficios reales y auditar los kilogramos totales reciclados y el $CO_2$ ahorrado por la comunidad. |
| **Criterios de Aceptación:** | 1. `/api/user/wallet` calcula el saldo e impacto desde MySQL.<br>2. `/api/rewards/redeem` valida saldo y stock, descuenta puntos y emite un código voucher único.<br>3. `/api/esg/report` consolida métricas totales y desglose por categoría de material. |

---

## 2. Plan de Trabajo Scrum Simplificado (4 Semanas) y Product Backlog

| Semana / Sprint | Objetivo del Sprint | Entregables Cumplidos |
| :--- | :--- | :--- |
| **Semana 1 — Sprint 1 (Análisis y Diseño)** | Identificar el problema y los usuarios; definir RF y RNF; crear HU; diseñar el Modelo Entidad-Relación (MER); crear prototipos de interfaces con IA. | Documento SRS v2.0, Product Backlog, Diagramas UML/MER y Prototipos IA. |
| **Semana 2 — Sprint 2 (BD MySQL + Liquibase + Backend Base)** | Configurar MySQL en XAMPP (`ecocommunity_db`), changelogs Liquibase y endpoints de `usuarios`, `materiales` y `puntos_limpios` en Python/Flask. | Base de datos de 8 tablas operativa y geolocalización Haversine. |
| **Semana 3 — Sprint 3 (IA Gemini + Entregas + Histórico BD)** | Implementar clasificación orientativa por imágenes con IA, validación de entregas QR/Geofencing y modal interactivo de Histórico BD. | Escáner IA, motor antifraude y trazabilidad de cadena de custodia en MySQL. |
| **Semana 4 — Sprint 4 (Billetera, ESG, Hero 3D y QA)** | Integrar Billetera Ecocoins, reportes ESG, escena 3D en Three.js y suite de pruebas unitarias Python/MySQL (`8/8 OK`). | Sistema completo desplegado y sincronizado en GitHub (`dev`, `qa`, `main`). |
