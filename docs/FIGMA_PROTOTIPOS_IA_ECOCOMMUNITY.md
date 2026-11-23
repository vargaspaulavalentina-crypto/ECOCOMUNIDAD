<div align="center">

# SERVICIO NACIONAL DE APRENDIZAJE – SENA
### CENTRO DE LA INDUSTRIA, LA EMPRESA Y LOS SERVICIOS
#### TECNÓLOGO EN ANÁLISIS Y DESARROLLO DE SOFTWARE (ADSO)

---

## PROTOTIPOS DE INTERFACES CON IA Y SISTEMA DE DISEÑO UI/UX (FIGMA)
### PROYECTO #18: PLATAFORMA DE RECICLAJE COMUNITARIO
# **ECOCOMMUNITY**

**Módulos Prototipados:** Usuarios · Materiales (IA) · Puntos de Recolección · Entregas (Histórico MySQL)  
**Tecnología:** Python / Flask / MySQL + React / Tailwind CSS / Three.js WebGL

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

## 1.Tokens de Diseño y Paleta Cromática (Design System)

| Token Visual | Código Hex | Uso en la Interfaz de EcoCommunity |
| :--- | :--- | :--- |
| **Deep Eco Obsidian** | `#050b07` | Fondo principal del Hero 3D y marco de telemetría satelital. |
| **Lime Canopy (Marca)** | `#d7eb80` | Acentos principales, indicadores de éxito e insignias interactivas. |
| **Emerald Hologram** | `#22c55e` / `#4ade80` | Anillos orbitales 3D, pines geolocalizados y estado activo de conexión MySQL. |
| **Circular Gold** | `#D4AF37` | Gradiente de énfasis tipográfico ("Entorno.") e iconos de Ecocoins. |
| **Paper White / Warm Mist** | `#ffffff` / `#f8f8f6` | Tarjetas de contenido de los módulos operativos para lectura descansada. |

---

## 2. Vistas y Prototipos Creados con IA (Sprint 1)

### 2.1. Vista 1 — Portada Hero 3D con Planeta Tierra en Manos Humanas (`HeroThreeJS.tsx`)
- **Objetivo:** Transmitir de inmediato el propósito de economía circular geolocalizada.
- **Composición:**
  - **Izquierda:** Etiqueta `● ECONOMÍA CIRCULAR GEOLOCALIZADA`, título `"Recicla. Impacta. Transforma tu Entorno."`, CTAs `ESCANEAR RESIDUO →` y `☉ EXPLORAR PUNTOS LIMPIOS`, tres tarjetas *Glassmorphism* (`Desviado`, `Billetera`, `CO₂ Ahorrado`) y selector de `MÓDULOS`.
  - **Derecha:** Render hiperrealista del planeta Tierra sostenido por dos manos humanas (`public/images/earth_hands_hero.jpg`) fusionado con un lienzo **Three.js WebGL** en tiempo real que anima órbitas holográficas verdes, pulsos de datos y nubes dinámicas.

### 2.2. Vista 2 — Módulo de Materiales y Clasificación Orientativa con IA (`ScannerView.tsx`)
- **Objetivo:** Permitir al ciudadano identificar cualquier residuo mediante fotografía o código de barras.
- **Elementos UI:** Selector de cámara/galería, previsualización con recuadro de escaneo, ficha de resultado generada por **Google Gemini Vision AI** (`/api/ai/classify`) con porcentaje de confianza, instrucciones de limpieza y botón para registrar entrega.

### 2.3. Vista 3 — Módulo de Puntos de Recolección y Geofencing (`MapView.tsx`)
- **Objetivo:** Ubicar contenedores cercanos y validar el perímetro de $\le 20$ metros.
- **Elementos UI:** Tarjetas de puntos limpios ordenadas por cercanía (Haversine), indicador de distancia en metros, barra de llenado (`capacidad_actual_kg / capacidad_max_kg`) y lista de materiales aceptados.

### 2.4. Vista 4 — Módulo de Entregas e Histórico Interactivo en MySQL (`HistoricoModal.tsx`)
- **Objetivo:** Visualizar e interactuar en vivo con los registros almacenados en la base de datos `ecocommunity_db` (XAMPP).
- **Elementos UI:** Cabecera con estado de conexión `MySQL / MariaDB en XAMPP`, contadores de las 8 tablas, barra de búsqueda y filtros por categoría/custodia, lista maestra de entregas y panel de detalle con botones para avanzar la **Cadena de Custodia** (`depositado` $\rightarrow$ `recolectado` $\rightarrow$ `en_acopio` $\rightarrow$ `transformado`) y abrir el **Recibo Digital Criptográfico**.

