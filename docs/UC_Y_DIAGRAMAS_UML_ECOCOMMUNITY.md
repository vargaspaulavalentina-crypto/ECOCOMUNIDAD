<div align="center">

# SERVICIO NACIONAL DE APRENDIZAJE – SENA
### CENTRO DE LA INDUSTRIA, LA EMPRESA Y LOS SERVICIOS
#### TECNÓLOGO EN ANÁLISIS Y DESARROLLO DE SOFTWARE (ADSO)

---

## CASOS DE USO (UC), DIAGRAMAS UML Y MODELO ENTIDAD-RELACIÓN (MER)
### PROYECTO #18: PLATAFORMA DE RECICLAJE COMUNITARIO
# **ECOCOMMUNITY**

**Módulos:** Usuarios · Materiales · Puntos de Recolección · Entregas  
**IA:** Clasificación orientativa de materiales mediante imágenes (Google Gemini AI)  
**Tecnología:** Python / Flask / MySQL (XAMPP + Liquibase)

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

## 1. Diagrama UML de Casos de Uso

```mermaid
flowchart LR
    Ciudadano((Ciudadano))
    Recolector((Recolector Urbano))
    Acopio((Operador de Acopio))
    Marca((Marca Aliada))
    Admin((Administrador))

    subgraph Plataforma de Reciclaje Comunitario ECOCOMMUNITY
        CU01[CU-01 Iniciar Sesión y Gestionar Usuario]
        CU02[CU-02 Clasificar Material por Imagen IA o Código]
        CU03[CU-03 Consultar Puntos de Recolección Cercanos]
        CU04[CU-04 Registrar Entrega con QR y Geofencing]
        CU05[CU-05 Consultar Billetera de Ecocoins]
        CU06[CU-06 Canjear Recompensa y Emitir Voucher]
        CU07[CU-07 Consultar Histórico BD y Actualizar Custodia]
        CU08[CU-08 Consultar Reportes de Impacto ESG]
        CU09[CU-09 Administrar Puntos, Materiales y Auditoría]
    end

    Ciudadano --> CU01
    Ciudadano --> CU02
    Ciudadano --> CU03
    Ciudadano --> CU04
    Ciudadano --> CU05
    Ciudadano --> CU06
    Ciudadano --> CU07

    Recolector --> CU01
    Recolector --> CU07

    Acopio --> CU01
    Acopio --> CU07

    Marca --> CU01
    Marca --> CU08

    Admin --> CU01
    Admin --> CU07
    Admin --> CU08
    Admin --> CU09
```

---

## 2. Catálogo Resumido de Casos de Uso (`CU-01` a `CU-09`)

| Código | Nombre del Caso de Uso | Actor Principal | Módulo Proyecto #18 | Endpoint Python / Flask Asociado |
| :--- | :--- | :--- | :--- | :--- |
| **CU-01** | Iniciar Sesión ySeleccionar Rol | Todos los actores | Módulo Usuarios | `AuthModal` / Tabla `usuarios` |
| **CU-02** | Clasificar Material Reciclable por Imagen con IA o Código de Barras | Ciudadano | Módulo Materiales + IA | `POST /api/ai/classify` |
| **CU-03** | Consultar Puntos de Recolección y Cercanía GPS (Haversine) | Ciudadano | Módulo Puntos | `GET /api/puntos` |
| **CU-04** | Registrar Entrega Física con Validación QR y Geofencing $\le 20$ m | Ciudadano | Módulo Entregas | `POST /api/entregas/validate-and-deposit` |
| **CU-05** | Consultar Billetera de Ecocoins y Estadísticas de Impacto | Ciudadano | Módulo Usuarios / Billetera | `GET /api/user/wallet` |
| **CU-06** | Canjear Recompensa y Generar Voucher Digital | Ciudadano | Módulo Billetera | `POST /api/rewards/redeem` |
| **CU-07** | Consultar Histórico Interactivo en MySQL y Actualizar Cadena de Custodia | Operador / Ciudadano | Módulo Entregas / BD | `GET /api/entregas/history` y `PUT /api/entregas/<id>/custodia` |
| **CU-08** | Consultar Métricas Consolidadas de Sostenibilidad ESG | Marca / Admin / Ciudadano | Módulo Entregas / ESG | `GET /api/esg/report` |
| **CU-09** | Monitorear Estado de Base de Datos, Capacidad de Puntos y Auditoría | Administrador | Módulo Administración | `GET /api/db/status` |

---

## 3. Diagrama Modelo Entidad-Relación (MER — MySQL `ecocommunity_db`)

```mermaid
erDiagram
    ROLES ||--o{ USUARIOS : "asigna (1:N)"
    USUARIOS ||--o{ ENTREGAS : "registra (1:N)"
    PUNTOS_LIMPIOS ||--o{ ENTREGAS : "recibe (1:N)"
    USUARIOS ||--o{ TRANSACCIONES : "posee (1:N)"
    RECOMPENSAS ||--o{ TRANSACCIONES : "redime (1:N)"
    USUARIOS ||--o{ REGISTRO_AUDITORIA : "genera (1:N)"

    ROLES {
        int id_rol PK
        varchar nombre UK
        varchar descripcion
    }
    USUARIOS {
        int id_usuario PK
        int id_rol FK
        varchar nombre
        varchar email UK
        varchar password_hash
        varchar entidad
        enum estado
        datetime fecha_registro
    }
    MATERIALES {
        int id_material PK
        varchar codigo_barras UK
        varchar nombre
        varchar categoria
        int puntos_por_kg
        decimal co2_factor
        text instrucciones_reciclaje
    }
    PUNTOS_LIMPIOS {
        int id_punto PK
        varchar nombre
        varchar direccion
        decimal latitud
        decimal longitud
        varchar horario
        decimal capacidad_max_kg
        decimal capacidad_actual_kg
        boolean activo
        varchar codigo_qr_hash UK
        varchar tipo
        text materiales_aceptados
    }
    ENTREGAS {
        int id_entrega PK
        varchar uuid UK
        int id_usuario FK
        int id_punto FK
        varchar material_nombre
        varchar categoria
        decimal peso_kg
        int puntos_otorgados
        decimal co2_ahorrado_kg
        varchar estado
        decimal latitud_registro
        decimal longitud_registro
        int distancia_metros
        varchar qr_hash
        datetime fecha_entrega
        enum cadena_custodia_paso
        varchar recibo_digital_hash UK
    }
    TRANSACCIONES {
        int id_transaccion PK
        int id_usuario FK
        enum tipo
        int monto_puntos
        varchar descripcion
        datetime fecha
        varchar codigo_voucher
    }
    RECOMPENSAS {
        varchar id_recompensa PK
        varchar sponsor
        varchar titulo
        int costo_ecocoins
        varchar categoria
        text descripcion
        int stock
        int marca_aliada_id
        text logo_svg
    }
    REGISTRO_AUDITORIA {
        int id_registro PK
        int id_usuario FK
        varchar accion
        varchar entidad_afectada
        varchar id_entidad
        datetime fecha_hora
        varchar ip_origen
        text detalle
    }
```

---

## 4. Diagrama UML de Clases

```mermaid
classDiagram
    class Usuario {
        +int id_usuario
        +int id_rol
        +string nombre
        +string email
        +string estado
        +consultarBilletera()
    }
    class Material {
        +int id_material
        +string codigo_barras
        +string nombre
        +string categoria
        +int puntos_por_kg
        +float co2_factor
        +clasificarConIA()
    }
    class PuntoLimpio {
        +int id_punto
        +string nombre
        +float latitud
        +float longitud
        +float capacidad_max_kg
        +float capacidad_actual_kg
        +string codigo_qr_hash
        +calcularHaversine()
    }
    class Entrega {
        +int id_entrega
        +string uuid
        +int id_usuario
        +int id_punto
        +string material_nombre
        +float peso_kg
        +int puntos_otorgados
        +string cadena_custodia_paso
        +string recibo_digital_hash
        +actualizarCustodia()
    }
    Usuario "1" --> "0..*" Entrega : realiza
    PuntoLimpio "1" --> "0..*" Entrega : acopia
    Material "1" ..> "0..*" Entrega : tipifica
```

