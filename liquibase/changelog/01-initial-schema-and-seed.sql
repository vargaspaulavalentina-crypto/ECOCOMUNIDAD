-- liquibase formatted sql

-- changeset ecocommunity:01-create-tables
CREATE TABLE IF NOT EXISTS roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    entidad VARCHAR(150),
    estado ENUM('activo', 'inactivo', 'suspendido') DEFAULT 'activo',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_roles FOREIGN KEY (id_rol) REFERENCES roles (id_rol) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materiales (
    id_material INT AUTO_INCREMENT PRIMARY KEY,
    codigo_barras VARCHAR(50) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    categoria ENUM('Plástico PET', 'Cartón y Papel', 'Vidrio', 'Aluminio / Latas', 'Tetra Pak', 'No reciclable') NOT NULL,
    puntos_por_kg INT NOT NULL DEFAULT 100,
    co2_factor DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    instrucciones_reciclaje TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS puntos_limpios (
    id_punto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    latitud DECIMAL(10, 8) NOT NULL,
    longitud DECIMAL(11, 8) NOT NULL,
    horario VARCHAR(100) NOT NULL,
    capacidad_max_kg DECIMAL(10, 2) NOT NULL DEFAULT 1000.0,
    capacidad_actual_kg DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
    activo BOOLEAN DEFAULT TRUE,
    codigo_qr_hash VARCHAR(100) NOT NULL UNIQUE,
    tipo ENUM('Contenedor Inteligente', 'Punto Limpio Municipal', 'Centro de Acopio Asociado') NOT NULL DEFAULT 'Contenedor Inteligente',
    materiales_aceptados JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entregas (
    id_entrega INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(64) NOT NULL UNIQUE,
    usuario_id INT NOT NULL,
    punto_id INT NOT NULL,
    material_nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    peso_kg DECIMAL(8, 3) NOT NULL,
    puntos_otorgados INT NOT NULL,
    co2_ahorrado_kg DECIMAL(8, 3) NOT NULL,
    estado ENUM('confirmada', 'pendiente_validacion', 'rechazada') DEFAULT 'confirmada',
    latitud_registro DECIMAL(10, 8) NOT NULL,
    longitud_registro DECIMAL(11, 8) NOT NULL,
    distancia_metros INT NOT NULL,
    qr_hash VARCHAR(100) NOT NULL,
    fecha_entrega DATETIME DEFAULT CURRENT_TIMESTAMP,
    cadena_custodia_paso ENUM('depositado', 'recolectado', 'en_acopio', 'transformado') DEFAULT 'depositado',
    recibo_digital_hash VARCHAR(64) NOT NULL UNIQUE,
    CONSTRAINT fk_entregas_usuarios FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario),
    CONSTRAINT fk_entregas_puntos FOREIGN KEY (punto_id) REFERENCES puntos_limpios (id_punto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transacciones (
    id_transaccion INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo ENUM('credito', 'debito_canje') NOT NULL,
    monto_puntos INT NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    codigo_voucher VARCHAR(100),
    CONSTRAINT fk_transacciones_usuarios FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recompensas (
    id_recompensa VARCHAR(50) PRIMARY KEY,
    sponsor VARCHAR(100) NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    costo_ecocoins INT NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    stock INT NOT NULL DEFAULT 50,
    marca_aliada_id VARCHAR(50) NOT NULL,
    logo_svg VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registro_auditoria (
    id_registro INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    accion VARCHAR(100) NOT NULL,
    entidad_afectada VARCHAR(100) NOT NULL,
    id_entidad VARCHAR(100),
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_origen VARCHAR(45),
    detalle TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- changeset ecocommunity:02-insert-seed-data
INSERT INTO roles (id_rol, nombre, descripcion) VALUES
(1, 'ciudadano', 'Ciudadano reciclador que entrega residuos y gana Ecocoins'),
(2, 'recolector', 'Recolector urbano u operario de ruta que retira residuos'),
(3, 'punto_acopio', 'Operador del centro de pesaje masivo y almacenamiento'),
(4, 'marca_aliada', 'Empresa patrocinadora de recompensas y promotora ESG'),
(5, 'admin', 'Administrador técnico y supervisor de la plataforma')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

INSERT INTO usuarios (id_usuario, id_rol, nombre, email, password_hash, avatar_url, entidad) VALUES
(1, 1, 'Carlos Mendoza', 'carlos.mendoza@ecocommunity.org', '$2b$12$dummyhashforpass123', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150', 'Comunidad Centro'),
(2, 2, 'Hernán Recolector', 'hernan.recolector@rutalimpia.co', '$2b$12$dummyhashforpass123', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150', 'Cooperativa EcoRutas'),
(3, 3, 'Beatriz Acopio', 'beatriz.acopio@centroverde.org', '$2b$12$dummyhashforpass123', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150', 'Centro Verde Municipal'),
(4, 4, 'Laura Marca ESG', 'laura.aliados@greenroast.com', '$2b$12$dummyhashforpass123', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150', 'GreenRoast Coffee'),
(5, 5, 'SuperAdmin Eco', 'admin@ecocommunity.org', '$2b$12$dummyhashforpass123', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150', 'Plataforma Matriz')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

INSERT INTO materiales (id_material, codigo_barras, nombre, categoria, puntos_por_kg, co2_factor, instrucciones_reciclaje) VALUES
(1, '7791234567890', 'Botella Agua Mineral PET 500ml', 'Plástico PET', 200, 1.80, 'Vaciar líquidos, enjuagar con poca agua, separar tapa (HDPE) y aplastar para reducir volumen.'),
(2, '7790040404040', 'Lata Bebida Aluminio 355ml', 'Aluminio / Latas', 350, 9.10, 'Vaciar completamente, no requiere aplastado forzoso, depositar seca en contenedor amarillo.'),
(3, '7798888999911', 'Caja Cartón Corrugado Embalaje', 'Cartón y Papel', 100, 0.90, 'Retirar cintas plásticas y grapas metálicas, desarmar y aplanar para optimizar espacio.'),
(4, '7797777666655', 'Botella de Vidrio Bebida 330ml', 'Vidrio', 120, 0.35, 'Retirar chapa/tapa corona, enjuagar restos orgánicos y depositar sin romper.'),
(5, '7795555444433', 'Envase Tetra Brik Leche 1L', 'Tetra Pak', 180, 1.10, 'Desplegar las cuatro pestañas, enjuagar el interior, aplanar e introducir la bombilla o tapón.'),
(6, '7791111222233', 'Bolsa de Snacks Metalizada (Multicapa)', 'No reciclable', 0, 0.00, 'Este material compuesto no es reciclable mecánicamente. Depositar en basura común o ecoladrillo.')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

INSERT INTO puntos_limpios (id_punto, nombre, direccion, latitud, longitud, horario, capacidad_max_kg, capacidad_actual_kg, activo, codigo_qr_hash, tipo, materiales_aceptados) VALUES
(1, 'Estación Inteligente EcoCommunity - Plaza Central', 'Plaza Mayor s/n, Distrito Centro', 40.41536300, -3.70739800, '24/7 (Acceso Automatizado)', 850.00, 320.00, 1, 'ECO-BIN-PLAZA-CENTRAL-01', 'Contenedor Inteligente', '["Plástico PET", "Aluminio / Latas", "Tetra Pak"]'),
(2, 'Punto Limpio Municipal Parque Verde', 'Av. de los Álamos 142', 40.41725000, -3.70251000, 'Lunes a Sábado: 08:00 - 20:00', 3000.00, 1450.00, 1, 'ECO-HUB-PARQUE-VERDE-02', 'Punto Limpio Municipal', '["Plástico PET", "Cartón y Papel", "Vidrio", "Aluminio / Latas", "Tetra Pak"]'),
(3, 'Centro de Acopio & Recicladores Urbanos San Telmo', 'Calle Artesanos 88', 40.41912000, -3.70995000, 'Lunes a Viernes: 07:00 - 18:00', 5000.00, 2800.00, 1, 'ECO-RECO-SAN-TELMO-03', 'Centro de Acopio Asociado', '["Plástico PET", "Cartón y Papel", "Aluminio / Latas", "Vidrio"]'),
(4, 'Contenedor Inteligente Campus Universitario', 'Bulevar de las Ciencias 12', 40.41320000, -3.70110000, '24/7 (Acceso Automatizado)', 600.00, 195.00, 1, 'ECO-BIN-CAMPUS-04', 'Contenedor Inteligente', '["Plástico PET", "Aluminio / Latas", "Cartón y Papel"]')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

INSERT INTO entregas (id_entrega, uuid, usuario_id, punto_id, material_nombre, categoria, peso_kg, puntos_otorgados, co2_ahorrado_kg, estado, latitud_registro, longitud_registro, distancia_metros, qr_hash, fecha_entrega, cadena_custodia_paso, recibo_digital_hash) VALUES
(101, 'ent-a7b2c9d1-801', 1, 1, '3x Botellas Plástico PET', 'Plástico PET', 0.150, 30, 0.270, 'confirmada', 40.41536500, -3.70739500, 3, 'ECO-BIN-PLAZA-CENTRAL-01', '2026-11-10 14:32:00', 'transformado', '0x8f2c3d4e1122aaff'),
(102, 'ent-b8c3d0e2-802', 1, 2, 'Caja Cartón Plegada 1.2kg', 'Cartón y Papel', 1.200, 120, 1.080, 'confirmada', 40.41724000, -3.70252000, 6, 'ECO-HUB-PARQUE-VERDE-02', '2026-11-08 11:15:00', 'en_acopio', '0x9911bb22cc44eeaa'),
(103, 'ent-c9d4e1f3-803', 1, 1, '4x Latas de Aluminio', 'Aluminio / Latas', 0.080, 28, 0.730, 'confirmada', 40.41536000, -3.70740000, 4, 'ECO-BIN-PLAZA-CENTRAL-01', '2026-11-06 18:40:00', 'transformado', '0x44ddaa8877663322')
ON DUPLICATE KEY UPDATE uuid=VALUES(uuid);

INSERT INTO transacciones (id_transaccion, usuario_id, tipo, monto_puntos, descripcion, fecha, codigo_voucher) VALUES
(1, 1, 'credito', 30, 'Entrega verificada: 3x Botellas Plástico PET (0.15 kg)', '2026-11-10 14:32:00', NULL),
(2, 1, 'credito', 120, 'Entrega verificada: Cartón Plegado (1.2 kg)', '2026-11-08 11:15:00', NULL),
(3, 1, 'credito', 28, 'Entrega verificada: 4x Latas de Aluminio (0.08 kg)', '2026-11-06 18:40:00', NULL),
(4, 1, 'debito_canje', 50, 'Canje de Cupón: Café Orgánico en GreenRoast', '2026-11-05 09:20:00', 'ECO-CAFE-9284-GR')
ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion);

INSERT INTO recompensas (id_recompensa, sponsor, titulo, costo_ecocoins, categoria, descripcion, stock, marca_aliada_id, logo_svg) VALUES
('rew-1', 'GreenRoast Coffee', 'Café Orgánico o Bebida Mediana', 50, 'Gastronomía Sostenible', 'Válido por 1 café de especialidad servido en tu propio vaso reutilizable.', 45, 'brand_greenroast', 'coffee'),
('rew-2', 'Metro & Bici Ciudad', 'Pase 2 Viajes Transporte Público', 80, 'Movilidad Cero Emisiones', 'Cupón recargable para transporte subterráneo o bicicleta compartida.', 120, 'brand_metrobici', 'bike'),
('rew-3', 'EcoMarket Natural', 'Bono 15% Descuento Granel', 110, 'Alimentación Zero Waste', 'Aplica en compras de legumbres, frutos secos y cereales a granel.', 30, 'brand_ecomarket', 'shopping-bag'),
('rew-4', 'Fundación Bosque Nativo', 'Adopta y Siembra 1 Árbol Nativo', 150, 'Reforestación Comunitaria', 'Certificado digital con coordenadas geográficas del ejemplar plantado.', 500, 'brand_bosquenativo', 'tree')
ON DUPLICATE KEY UPDATE titulo=VALUES(titulo);

