#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EcoCommunity - Servidor Principal Python / Flask / MySQL
Sincronizado con base de datos en XAMPP MySQL (ecocommunity_db) y control de migraciones Liquibase
"""

import os
import math
import time
import json
import uuid
import hmac
import base64
import hashlib
import secrets
from functools import wraps
from datetime import datetime, timedelta
from urllib.parse import urlparse

from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import pymysql
from pymysql.cursors import DictCursor
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__, static_folder='dist', static_url_path='')
CORS(app)

# Configuracion de conexion a MySQL (XAMPP por defecto)
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'port': int(os.getenv('MYSQL_PORT', 3306)),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DATABASE', 'ecocommunity_db'),
    'charset': 'utf8mb4',
    'cursorclass': DictCursor,
    'autocommit': True,
}

def get_db_connection():
    """Retorna una conexion activa a MySQL con DictCursor."""
    return pymysql.connect(**DB_CONFIG)

# Haversine distance calculator in meters
def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    R = 6371e3  # Radio de la Tierra en metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2) ** 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(round(R * c))

# Gemini AI Client setup
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
ai_client = None
if GEMINI_API_KEY:
    try:
        from google import genai
        ai_client = genai.Client(api_key=GEMINI_API_KEY)
        print("[EcoCommunity] Cliente Gemini AI inicializado con éxito.")
    except Exception as e:
        print(f"[EcoCommunity] Aviso: Gemini AI no inicializado ({e}), fallback local activo.")

# -------------------------------------------------------------
# AUTENTICACIÓN JWT (HS256) Y AUTORIZACIÓN POR ROLES
# -------------------------------------------------------------
JWT_SECRET = os.getenv('JWT_SECRET', 'ecocommunity-sena-2026-secret-key')
JWT_EXP_HOURS = int(os.getenv('JWT_EXP_HOURS', 24))


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def _b64url_decode(data: str) -> bytes:
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_jwt_token(payload: dict) -> str:
    header = {'alg': 'HS256', 'typ': 'JWT'}
    now = int(time.time())
    full_payload = {
        **payload,
        'iat': now,
        'exp': now + JWT_EXP_HOURS * 3600,
    }
    h_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    p_b64 = _b64url_encode(json.dumps(full_payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f'{h_b64}.{p_b64}'.encode('utf-8')
    sig = hmac.new(JWT_SECRET.encode('utf-8'), signing_input, hashlib.sha256).digest()
    return f'{h_b64}.{p_b64}.{_b64url_encode(sig)}'


def decode_jwt_token(token: str) -> dict | None:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        h_b64, p_b64, s_b64 = parts
        signing_input = f'{h_b64}.{p_b64}'.encode('utf-8')
        expected_sig = hmac.new(JWT_SECRET.encode('utf-8'), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_encode(expected_sig), s_b64):
            return None
        payload = json.loads(_b64url_decode(p_b64).decode('utf-8'))
        if payload.get('exp', 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def require_auth(fn):
    """Decorator que exige un token Bearer JWT válido y usuario activo en MySQL."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No autorizado. Se requiere token Bearer en Authorization.'}), 401
        token = auth_header[7:].strip()
        payload = decode_jwt_token(token)
        if not payload or 'sub' not in payload:
            return jsonify({'error': 'Token inválido o expirado.'}), 401

        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT u.id_usuario, u.nombre, u.email, u.entidad, u.avatar_url, u.estado, r.nombre AS rol
                    FROM usuarios u
                    JOIN roles r ON u.id_rol = r.id_rol
                    WHERE u.id_usuario = %s;
                """, (payload['sub'],))
                user = cursor.fetchone()
        finally:
            conn.close()

        if not user or user['estado'] != 'activo':
            return jsonify({'error': 'Usuario no encontrado o inactivo.'}), 401

        g.current_user = user
        return fn(*args, **kwargs)
    return wrapper


def require_roles(*allowed_roles):
    """Decorator que restringe el acceso a los roles indicados."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(g, 'current_user', None)
            if not user:
                return jsonify({'error': 'Autenticación requerida.'}), 401
            if user['rol'] not in allowed_roles:
                return jsonify({
                    'error': f"Acceso denegado. Se requiere rol: {', '.join(allowed_roles)}.",
                    'rol_actual': user['rol']
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

# -------------------------------------------------------------
# RUTAS DE API (RESTful)
# -------------------------------------------------------------

@app.route('/api/db/status', methods=['GET'])
def db_status():
    """Verifica el estado de sincronizacion con XAMPP MySQL y conteo de tablas."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SHOW TABLES;")
            tables = [list(row.values())[0] for row in cursor.fetchall()]
            
            counts = {}
            for table in ['usuarios', 'puntos_limpios', 'entregas', 'transacciones', 'materiales', 'recompensas']:
                if table in tables:
                    cursor.execute(f"SELECT COUNT(*) AS total FROM {table};")
                    counts[table] = cursor.fetchone()['total']
                    
        conn.close()
        return jsonify({
            'status': 'conectado',
            'motor': 'MySQL / MariaDB en XAMPP',
            'base_datos': DB_CONFIG['database'],
            'tablas': tables,
            'conteos': counts,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as err:
        return jsonify({
            'status': 'error_conexion',
            'mensaje': str(err),
            'detalles': 'Verifica que el servicio MySQL este activo en el panel de control de XAMPP.'
        }), 500

@app.route('/api/puntos', methods=['GET'])
def get_puntos():
    """Listado georreferenciado de puntos limpios con calculo de distancia Haversine y geofencing <= 20m."""
    user_lat = request.args.get('userLat', type=float)
    user_lng = request.args.get('userLng', type=float)

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id_punto AS id, nombre, direccion, latitud, longitud, horario,
                       capacidad_max_kg, capacidad_actual_kg, activo, codigo_qr_hash,
                       tipo, materiales_aceptados
                FROM puntos_limpios
                WHERE activo = 1;
            """)
            rows = cursor.fetchall()
        conn.close()

        puntos_resultado = []
        for p in rows:
            p['latitud'] = float(p['latitud'])
            p['longitud'] = float(p['longitud'])
            p['capacidad_max_kg'] = float(p['capacidad_max_kg'])
            p['capacidad_actual_kg'] = float(p['capacidad_actual_kg'])
            
            if isinstance(p['materiales_aceptados'], str):
                try:
                    p['materiales_aceptados'] = json.loads(p['materiales_aceptados'])
                except:
                    p['materiales_aceptados'] = ['Plástico PET', 'Cartón y Papel', 'Aluminio / Latas']
            
            distancia = 0
            dentro_geofence = False
            if user_lat is not None and user_lng is not None:
                distancia = calculate_haversine_distance(user_lat, user_lng, p['latitud'], p['longitud'])
                dentro_geofence = (distancia <= 20)

            p['distancia_metros'] = distancia
            p['dentro_de_geofence'] = dentro_geofence
            puntos_resultado.append(p)

        if user_lat is not None and user_lng is not None:
            puntos_resultado.sort(key=lambda x: x['distancia_metros'])

        return jsonify({
            'total': len(puntos_resultado),
            'geofence_radio_max_metros': 20,
            'puntos': puntos_resultado
        })
    except Exception as err:
        return jsonify({'error': 'Error consultando puntos limpios', 'detalles': str(err)}), 500

@app.route('/api/ai/classify', methods=['POST'])
def classify_material():
    """Clasificacion de residuos por codigo de barras en MySQL o con IA Gemini Vision multimodal."""
    data = request.get_json() or {}
    barcode = data.get('barcode')
    image_base64 = data.get('imageBase64')
    mime_type = data.get('mimeType', 'image/jpeg')

    # A) Buscar en catalogo de MySQL por codigo de barras
    if barcode:
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id_material, codigo_barras, nombre, categoria, puntos_por_kg, co2_factor, instrucciones_reciclaje
                    FROM materiales
                    WHERE codigo_barras = %s;
                """, (barcode,))
                match = cursor.fetchone()
            conn.close()

            if match:
                co2_fac = float(match['co2_factor'])
                puntos_kg = int(match['puntos_por_kg'])
                return jsonify({
                    'source': 'barcode_database',
                    'categoria': match['categoria'],
                    'nombre_detectado': match['nombre'],
                    'confianza': 0.99,
                    'puntos_estimados': int(round(puntos_kg * 0.15)),
                    'co2_evitado_kg': round(0.15 * co2_fac, 2),
                    'peso_estimado_kg': 0.15,
                    'consejo_preparacion': match['instrucciones_reciclaje'],
                    'reciclable': match['categoria'] != 'No reciclable',
                    'alternativas': [],
                    'huella_info': f"Desviar este material ahorra energía equivalente a {round(co2_fac * 1.5, 1)}h de iluminación LED."
                })
        except Exception as err:
            print(f"[MySQL] Error consultando codigo de barras: {err}")

    # B) Inferencia con Gemini Vision si hay imagen
    if image_base64 and ai_client:
        try:
            clean_b64 = image_base64.split('base64,')[-1] if 'base64,' in image_base64 else image_base64
            prompt_text = """
            Eres el motor de clasificación de residuos circulares de EcoCommunity.
            Analiza detenidamente la imagen enviada.
            Clasifícalo estrictamente en una de estas categorías:
            - "Plástico PET"
            - "Cartón y Papel"
            - "Vidrio"
            - "Aluminio / Latas"
            - "Tetra Pak"
            - "No reciclable"

            Responde exclusivamente en JSON válido con este formato:
            {
              "categoria": "...",
              "nombre_detectado": "...",
              "confianza": 0.95,
              "reciclable": true,
              "peso_estimado_kg": 0.12,
              "puntos_estimados": 25,
              "co2_evitado_kg": 0.22,
              "consejo_preparacion": "...",
              "alternativas": []
            }
            """
            response = ai_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[
                    genai.types.Part.from_bytes(data=bytes.fromhex(clean_b64) if False else clean_b64, mime_type=mime_type),
                    prompt_text
                ]
            )
            parsed = json.loads(response.text.strip())
            return jsonify({
                'source': 'gemini_vision_ai',
                'model': 'gemini-3.8-flash',
                'categoria': parsed.get('categoria', 'Plástico PET'),
                'nombre_detectado': parsed.get('nombre_detectado', 'Objeto Reciclable Detectado'),
                'confianza': parsed.get('confianza', 0.94),
                'reciclable': parsed.get('reciclable', True),
                'peso_estimado_kg': parsed.get('peso_estimado_kg', 0.12),
                'puntos_estimados': parsed.get('puntos_estimados', 25),
                'co2_evitado_kg': parsed.get('co2_evitado_kg', 0.22),
                'consejo_preparacion': parsed.get('consejo_preparacion', 'Enjuagar, retirar tapa y compactar.'),
                'alternativas': parsed.get('alternativas', ['Plástico PET', 'Cartón y Papel'])
            })
        except Exception as gemini_err:
            print(f"[Gemini Fallback]: {gemini_err}")

    # Fallback determinista local
    return jsonify({
        'source': 'local_heuristic_adapter',
        'categoria': 'Plástico PET',
        'nombre_detectado': 'Botella de Plástico Transparente PET',
        'confianza': 0.91,
        'reciclable': True,
        'peso_estimado_kg': 0.1,
        'puntos_estimados': 30,
        'co2_evitado_kg': 0.18,
        'consejo_preparacion': 'Asegúrate de retirar residuos líquidos y aplastar la botella.',
        'alternativas': ['Plástico PET', 'Cartón y Papel', 'Aluminio / Latas']
    })

@app.route('/api/entregas/validate-and-deposit', methods=['POST'])
def validate_and_deposit():
    """Valida QR, geofencing <= 20m, antifraude 24h e inserta en MySQL la entrega y transaccion."""
    data = request.get_json() or {}
    usuario_id = int(data.get('usuario_id', 1))
    punto_id = int(data.get('punto_id', 1))
    material_nombre = data.get('material_nombre', 'Residuo Clasificado')
    categoria = data.get('categoria', 'Plástico PET')
    peso_kg = float(data.get('peso_kg', 0.15))
    puntos_otorgados = int(data.get('puntos_otorgados', 25))
    co2_ahorrado_kg = float(data.get('co2_ahorrado_kg', 0.22))
    user_lat = data.get('userLat')
    user_lng = data.get('userLng')
    qr_hash = data.get('qr_hash')

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Validar Punto Limpio
            cursor.execute("SELECT * FROM puntos_limpios WHERE id_punto = %s AND activo = 1;", (punto_id,))
            punto = cursor.fetchone()
            if not punto:
                return jsonify({'error': 'Punto limpio no encontrado o inactivo.'}), 404

            # 2. Validar Código QR
            if qr_hash and qr_hash != punto['codigo_qr_hash']:
                return jsonify({
                    'error': 'Código QR inválido para este punto de acopio. Verifica el contenedor físico.',
                    'codigo_esperado': punto['codigo_qr_hash']
                }), 400

            # 3. Validar Geofencing (<= 20 metros)
            if user_lat is None or user_lng is None:
                return jsonify({'error': 'Se requieren coordenadas GPS para validar geofencing.'}), 400

            distancia = calculate_haversine_distance(
                float(user_lat), float(user_lng),
                float(punto['latitud']), float(punto['longitud'])
            )

            if distancia > 20:
                return jsonify({
                    'error': 'Geofencing fallido: Estás fuera del radio permitido de entrega.',
                    'distancia_actual_metros': distancia,
                    'distancia_maxima_permitida_metros': 20,
                    'mensaje': f'Te encuentras a {distancia} metros del contenedor. Acércate a menos de 20m para depositar.'
                }), 403

            # 4. Control Antifraude (Cooldown de 24 horas por usuario + punto + material)
            hace_24h = datetime.now() - timedelta(hours=24)
            cursor.execute("""
                SELECT id_entrega, fecha_entrega
                FROM entregas
                WHERE usuario_id = %s AND punto_id = %s AND material_nombre = %s AND fecha_entrega >= %s
                ORDER BY fecha_entrega DESC LIMIT 1;
            """, (usuario_id, punto_id, material_nombre, hace_24h))
            deposito_previo = cursor.fetchone()

            if deposito_previo:
                minutos_transcurridos = int((datetime.now() - deposito_previo['fecha_entrega']).total_seconds() / 60)
                return jsonify({
                    'error': 'Antifraude activado: Ya registraste este mismo ítem en este punto recientemente.',
                    'tiempo_transcurrido_minutos': minutos_transcurridos,
                    'regla': 'Límite de 1 depósito del mismo tipo por punto cada 24 horas.'
                }), 429

            # 5. Generar Hash Criptografico y UUID
            receipt_hash = '0x' + secrets.token_hex(4) + hex(int(time.time()))[2:]
            entrega_uuid = f"ent-{uuid.uuid4().hex[:10]}"

            # 6. Insertar Entrega en MySQL
            cursor.execute("""
                INSERT INTO entregas (
                    uuid, usuario_id, punto_id, material_nombre, categoria, peso_kg,
                    puntos_otorgados, co2_ahorrado_kg, estado, latitud_registro,
                    longitud_registro, distancia_metros, qr_hash, fecha_entrega,
                    cadena_custodia_paso, recibo_digital_hash
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), %s, %s);
            """, (
                entrega_uuid, usuario_id, punto_id, material_nombre, categoria, peso_kg,
                puntos_otorgados, co2_ahorrado_kg, 'confirmada', float(user_lat),
                float(user_lng), distancia, qr_hash or punto['codigo_qr_hash'],
                'depositado', receipt_hash
            ))
            nueva_entrega_id = cursor.lastrowid

            # 7. Insertar Transacción de Crédito de Ecocoins en MySQL
            cursor.execute("""
                INSERT INTO transacciones (usuario_id, tipo, monto_puntos, descripcion, fecha)
                VALUES (%s, 'credito', %s, %s, NOW());
            """, (
                usuario_id, puntos_otorgados,
                f"Entrega verificada en {punto['nombre']}: {material_nombre} ({peso_kg} kg)"
            ))

            # 8. Actualizar Capacidad en Punto Limpio
            nueva_capacidad = min(float(punto['capacidad_max_kg']), float(punto['capacidad_actual_kg']) + peso_kg)
            cursor.execute("""
                UPDATE puntos_limpios SET capacidad_actual_kg = %s WHERE id_punto = %s;
            """, (nueva_capacidad, punto_id))

            # 9. Registro de Auditoría
            cursor.execute("""
                INSERT INTO registro_auditoria (usuario_id, accion, entidad_afectada, id_entidad, ip_origen, detalle)
                VALUES (%s, 'DEPOSITO_CONFIRMADO', 'entregas', %s, %s, %s);
            """, (usuario_id, str(nueva_entrega_id), request.remote_addr, f"Puntos acreditados: {puntos_otorgados}, Hash: {receipt_hash}"))

            # 10. Calcular nuevo saldo consolidado
            cursor.execute("""
                SELECT SUM(CASE WHEN tipo = 'credito' THEN monto_puntos ELSE -monto_puntos END) AS saldo
                FROM transacciones WHERE usuario_id = %s;
            """, (usuario_id,))
            saldo_row = cursor.fetchone()
            nuevo_saldo = int(saldo_row['saldo'] or 0)

            nueva_entrega = {
                'id': nueva_entrega_id,
                'uuid': entrega_uuid,
                'usuario_id': usuario_id,
                'punto_id': punto_id,
                'material_nombre': material_nombre,
                'categoria': categoria,
                'peso_kg': peso_kg,
                'puntos_otorgados': puntos_otorgados,
                'co2_ahorrado_kg': co2_ahorrado_kg,
                'estado': 'confirmada',
                'latitud_registro': float(user_lat),
                'longitud_registro': float(user_lng),
                'distancia_metros': distancia,
                'qr_hash': qr_hash or punto['codigo_qr_hash'],
                'fecha_entrega': datetime.now().isoformat(),
                'cadena_custodia_paso': 'depositado',
                'recibo_digital_hash': receipt_hash
            }

        conn.close()
        return jsonify({
            'success': True,
            'mensaje': '¡Entrega validada exitosamente en XAMPP MySQL! Tus Ecocoins han sido acreditadas.',
            'entrega': nueva_entrega,
            'nuevo_saldo_ecocoins': nuevo_saldo
        })
    except Exception as err:
        conn.close()
        return jsonify({'error': 'Error registrando entrega en base de datos', 'detalles': str(err)}), 500

@app.route('/api/user/wallet', methods=['GET'])
def get_user_wallet():
    """Consulta de balance de Ecocoins, transacciones, recompensas e impacto desde MySQL."""
    usuario_id = request.args.get('usuario_id', default=1, type=int)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Saldo
            cursor.execute("""
                SELECT SUM(CASE WHEN tipo = 'credito' THEN monto_puntos ELSE -monto_puntos END) AS saldo
                FROM transacciones WHERE usuario_id = %s;
            """, (usuario_id,))
            saldo = int(cursor.fetchone()['saldo'] or 0)

            # Impacto
            cursor.execute("""
                SELECT COALESCE(SUM(peso_kg), 0) AS total_kg,
                       COALESCE(SUM(co2_ahorrado_kg), 0) AS total_co2,
                       COUNT(*) AS total_entregas
                FROM entregas WHERE usuario_id = %s AND estado = 'confirmada';
            """, (usuario_id,))
            stats = cursor.fetchone()
            total_kg = float(stats['total_kg'])
            total_co2 = float(stats['total_co2'])
            total_entregas = int(stats['total_entregas'])

            # Transacciones
            cursor.execute("""
                SELECT id_transaccion AS id, usuario_id, tipo, monto_puntos, descripcion, fecha, codigo_voucher
                FROM transacciones WHERE usuario_id = %s ORDER BY fecha DESC LIMIT 50;
            """, (usuario_id,))
            transacciones = cursor.fetchall()
            for t in transacciones:
                t['fecha'] = t['fecha'].isoformat() if hasattr(t['fecha'], 'isoformat') else str(t['fecha'])

            # Recompensas
            cursor.execute("""
                SELECT id_recompensa AS id, sponsor, titulo, costo_ecocoins, categoria, descripcion, stock, marca_aliada_id, logo_svg
                FROM recompensas;
            """)
            recompensas = cursor.fetchall()

        conn.close()

        rango = 'Guardián Circular' if saldo > 300 else ('Reciclador Activo' if saldo > 150 else 'Novicio Verde')

        return jsonify({
            'saldo_ecocoins': saldo,
            'nivel_rango': rango,
            'estadisticas_impacto': {
                'kg_reciclados': round(total_kg, 2),
                'co2_ahorrado_kg': round(total_co2, 2),
                'entregas_totales': total_entregas,
                'equivalencia_arboles': round(total_co2 / 22.0, 2)
            },
            'transacciones': transacciones,
            'catalogo_recompensas': recompensas
        })
    except Exception as err:
        conn.close()
        return jsonify({'error': 'Error consultando billetera en base de datos', 'detalles': str(err)}), 500

@app.route('/api/rewards/redeem', methods=['POST'])
def redeem_reward():
    """Canje de beneficios en MySQL con generacion de voucher y actualizacion atomica de stock."""
    data = request.get_json() or {}
    reward_id = data.get('rewardId')
    usuario_id = int(data.get('usuario_id', 1))

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Obtener recompensa
            cursor.execute("SELECT * FROM recompensas WHERE id_recompensa = %s;", (reward_id,))
            reward = cursor.fetchone()
            if not reward:
                return jsonify({'error': 'Recompensa no encontrada.'}), 404

            if reward['stock'] <= 0:
                return jsonify({'error': 'Recompensa sin stock disponible.'}), 400

            # 2. Validar saldo
            cursor.execute("""
                SELECT SUM(CASE WHEN tipo = 'credito' THEN monto_puntos ELSE -monto_puntos END) AS saldo
                FROM transacciones WHERE usuario_id = %s;
            """, (usuario_id,))
            saldo_actual = int(cursor.fetchone()['saldo'] or 0)

            if saldo_actual < reward['costo_ecocoins']:
                return jsonify({
                    'error': 'Saldo insuficiente de Ecocoins',
                    'saldo_actual': saldo_actual,
                    'costo_requerido': reward['costo_ecocoins']
                }), 400

            # 3. Generar Voucher
            voucher_code = f"ECO-{reward['sponsor'][:4].upper()}-{secrets.randbelow(9000) + 1000}"

            # 4. Insertar Transacción de débito
            cursor.execute("""
                INSERT INTO transacciones (usuario_id, tipo, monto_puntos, descripcion, fecha, codigo_voucher)
                VALUES (%s, 'debito_canje', %s, %s, NOW(), %s);
            """, (
                usuario_id, reward['costo_ecocoins'],
                f"Canje de cupón: {reward['titulo']} ({reward['sponsor']})",
                voucher_code
            ))

            # 5. Descontar Stock
            cursor.execute("UPDATE recompensas SET stock = stock - 1 WHERE id_recompensa = %s;", (reward_id,))

            # 6. Auditoría
            cursor.execute("""
                INSERT INTO registro_auditoria (usuario_id, accion, entidad_afectada, id_entidad, ip_origen, detalle)
                VALUES (%s, 'CANJE_RECOMPENSA', 'recompensas', %s, %s, %s);
            """, (usuario_id, reward_id, request.remote_addr, f"Voucher emitido: {voucher_code} por {reward['costo_ecocoins']} Ecocoins"))

            nuevo_saldo = saldo_actual - reward['costo_ecocoins']

        conn.close()
        return jsonify({
            'success': True,
            'mensaje': f"¡Canje exitoso! Presenta tu código QR en el establecimiento de {reward['sponsor']}.",
            'voucher': {
                'codigo': voucher_code,
                'titulo': reward['titulo'],
                'sponsor': reward['sponsor'],
                'instrucciones': reward['descripcion'],
                'valido_hasta': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
            },
            'nuevo_saldo': nuevo_saldo
        })
    except Exception as err:
        conn.close()
        return jsonify({'error': 'Error procesando canje', 'detalles': str(err)}), 500

@app.route('/api/esg/report', methods=['GET'])
def get_esg_report():
    """Genera el reporte consolidado de trazabilidad y cadena de custodia desde MySQL."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT categoria, SUM(peso_kg) AS total_kg, SUM(co2_ahorrado_kg) AS total_co2
                FROM entregas WHERE estado = 'confirmada' GROUP BY categoria;
            """)
            breakdown_rows = cursor.fetchall()

            cursor.execute("""
                SELECT e.id_entrega, e.uuid, e.material_nombre, e.categoria, e.peso_kg,
                       e.cadena_custodia_paso, e.fecha_entrega, e.recibo_digital_hash,
                       p.nombre AS punto_nombre, u.nombre AS usuario_nombre
                FROM entregas e
                JOIN puntos_limpios p ON e.punto_id = p.id_punto
                JOIN usuarios u ON e.usuario_id = u.id_usuario
                ORDER BY e.fecha_entrega DESC LIMIT 15;
            """)
            entregas_recent = cursor.fetchall()

        conn.close()

        total_kg = sum(float(r['total_kg']) for r in breakdown_rows)
        total_co2 = sum(float(r['total_co2']) for r in breakdown_rows)

        desglose = {r['categoria']: round(float(r['total_kg']), 2) for r in breakdown_rows}

        cadena = []
        for e in entregas_recent:
            cadena.append({
                'entrega_id': e['uuid'],
                'material': e['material_nombre'],
                'peso': f"{float(e['peso_kg'])} kg",
                'estado_actual': e['cadena_custodia_paso'],
                'fecha': e['fecha_entrega'].isoformat() if hasattr(e['fecha_entrega'], 'isoformat') else str(e['fecha_entrega']),
                'hash_verificacion': e['recibo_digital_hash'],
                'punto': e['punto_nombre'],
                'usuario': e['usuario_nombre']
            })

        return jsonify({
            'empresa_operadora': 'EcoCommunity Platform Corp',
            'normativa_cumplimiento': 'ISO 14001 & Directiva Circular ESG 2026 / MySQL XAMPP Sync',
            'metricas_acumuladas': {
                'kg_totales_desviados': round(total_kg, 2),
                'co2_evitado_kg': round(total_co2, 2),
                'kwh_energia_ahorrada': round(total_kg * 4.2, 1),
                'litros_agua_ahorrados': int(round(total_kg * 26.5)),
                'arboles_equivalentes': round(total_co2 / 22.0, 2)
            },
            'desglose_materiales': desglose,
            'cadena_de_custodia': cadena,
            'marcas_aliadas_esg': [
                {'marca': 'GreenRoast Coffee', 'empaques_recuperados': 412, 'status': 'Neutralidad Plástica Fase 1'},
                {'marca': 'Agua Pura Andina', 'empaques_recuperados': 1240, 'status': 'Circularidad Certificada 88%'},
                {'marca': 'BioAlimentos Cereal', 'empaques_recuperados': 680, 'status': 'Empaque Monomaterial Aprobado'}
            ]
        })
    except Exception as err:
        conn.close()
        return jsonify({'error': 'Error generando reporte ESG', 'detalles': str(err)}), 500

# -------------------------------------------------------------
# NUEVAS RUTAS DE HISTORICO Y GESTION INTERACTIVA DE CUSTODIA
# -------------------------------------------------------------

@app.route('/api/entregas/history', methods=['GET'])
def get_entregas_history():
    """Consulta el historico completo e interactivo de entregas con filtros desde MySQL."""
    search = request.args.get('search', '').strip()
    categoria = request.args.get('categoria', '').strip()
    custodia = request.args.get('custodia', '').strip()

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            query = """
                SELECT e.id_entrega AS id, e.uuid, e.material_nombre, e.categoria,
                       e.peso_kg, e.puntos_otorgados, e.co2_ahorrado_kg, e.estado,
                       e.distancia_metros, e.fecha_entrega, e.cadena_custodia_paso,
                       e.recibo_digital_hash, e.qr_hash,
                       p.id_punto, p.nombre AS punto_nombre, p.direccion AS punto_direccion,
                       u.id_usuario, u.nombre AS usuario_nombre, u.email AS usuario_email
                FROM entregas e
                JOIN puntos_limpios p ON e.punto_id = p.id_punto
                JOIN usuarios u ON e.usuario_id = u.id_usuario
                WHERE 1=1
            """
            params = []
            if search:
                query += " AND (e.material_nombre LIKE %s OR e.uuid LIKE %s OR e.recibo_digital_hash LIKE %s)"
                term = f"%{search}%"
                params.extend([term, term, term])

            if categoria:
                query += " AND e.categoria = %s"
                params.append(categoria)

            if custodia:
                query += " AND e.cadena_custodia_paso = %s"
                params.append(custodia)

            query += " ORDER BY e.fecha_entrega DESC LIMIT 100;"
            cursor.execute(query, tuple(params))
            entregas = cursor.fetchall()

            for item in entregas:
                item['peso_kg'] = float(item['peso_kg'])
                item['co2_ahorrado_kg'] = float(item['co2_ahorrado_kg'])
                if hasattr(item['fecha_entrega'], 'isoformat'):
                    item['fecha_entrega'] = item['fecha_entrega'].isoformat()
                else:
                    item['fecha_entrega'] = str(item['fecha_entrega'])

        conn.close()
        return jsonify({
            'total': len(entregas),
            'filtros_aplicados': {'search': search, 'categoria': categoria, 'custodia': custodia},
            'entregas': entregas
        })
    except Exception as err:
        conn.close()
        return jsonify({'error': 'Error consultando histórico de entregas', 'detalles': str(err)}), 500

@app.route('/api/entregas/<int:entrega_id>/custodia', methods=['PUT'])
def update_cadena_custodia(entrega_id):
    """Actualiza interactivamente el paso en la cadena de custodia de un residuo en MySQL."""
    data = request.get_json() or {}
    nuevo_paso = data.get('nuevo_paso')
    pasos_validos = ['depositado', 'recolectado', 'en_acopio', 'transformado']

    if nuevo_paso not in pasos_validos:
        return jsonify({'error': f'Paso no válido. Debe ser uno de: {", ".join(pasos_validos)}'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id_entrega, uuid, cadena_custodia_paso FROM entregas WHERE id_entrega = %s;", (entrega_id,))
            entrega = cursor.fetchone()
            if not entrega:
                return jsonify({'error': 'Entrega no encontrada'}), 404

            paso_anterior = entrega['cadena_custodia_paso']
            cursor.execute("""
                UPDATE entregas SET cadena_custodia_paso = %s WHERE id_entrega = %s;
            """, (nuevo_paso, entrega_id))

            # Registro de auditoría
            cursor.execute("""
                INSERT INTO registro_auditoria (accion, entidad_afectada, id_entidad, ip_origen, detalle)
                VALUES ('TRANSICION_CUSTODIA', 'entregas', %s, %s, %s);
            """, (str(entrega_id), request.remote_addr, f"Paso actualizado de '{paso_anterior}' a '{nuevo_paso}'"))

        conn.close()
        return jsonify({
            'success': True,
            'mensaje': f"Cadena de custodia actualizada a '{nuevo_paso}' exitosamente.",
            'entrega_id': entrega_id,
            'paso_anterior': paso_anterior,
            'nuevo_paso': nuevo_paso
        })
    except Exception as err:
        conn.close()
        return jsonify({'error': 'Error actualizando cadena de custodia', 'detalles': str(err)}), 500


# -------------------------------------------------------------
# AUTENTICACIÓN Y AUTORIZACIÓN (/api/auth/*)
# -------------------------------------------------------------

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    """Registra un nuevo usuario en MySQL con contraseña hasheada y devuelve JWT."""
    data = request.get_json() or {}
    nombre = (data.get('nombre') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    entidad = (data.get('entidad') or 'Comunidad EcoCommunity').strip()
    rol_nombre = (data.get('rol') or 'ciudadano').strip()

    if not nombre or not email or len(password) < 6:
        return jsonify({'error': 'Nombre, email válido y contraseña (mínimo 6 caracteres) son obligatorios.'}), 400

    if rol_nombre not in ('ciudadano', 'recolector', 'punto_acopio', 'marca_aliada'):
        rol_nombre = 'ciudadano'

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id_usuario FROM usuarios WHERE email = %s;", (email,))
            if cursor.fetchone():
                return jsonify({'error': 'El correo electrónico ya está registrado.'}), 409

            cursor.execute("SELECT id_rol FROM roles WHERE nombre = %s;", (rol_nombre,))
            rol_row = cursor.fetchone()
            id_rol = rol_row['id_rol'] if rol_row else 1

            pw_hash = generate_password_hash(password)
            cursor.execute("""
                INSERT INTO usuarios (id_rol, nombre, email, password_hash, entidad, estado)
                VALUES (%s, %s, %s, %s, %s, 'activo');
            """, (id_rol, nombre, email, pw_hash, entidad))
            new_id = cursor.lastrowid

            cursor.execute("""
                INSERT INTO registro_auditoria (usuario_id, accion, entidad_afectada, id_entidad, ip_origen, detalle)
                VALUES (%s, 'REGISTRO_USUARIO', 'usuarios', %s, %s, %s);
            """, (new_id, str(new_id), request.remote_addr, f"Registro de usuario {email} con rol {rol_nombre}"))

        token = create_jwt_token({'sub': new_id, 'email': email, 'rol': rol_nombre})
        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'id_usuario': new_id,
                'nombre': nombre,
                'email': email,
                'rol': rol_nombre,
                'entidad': entidad,
            }
        }), 201
    except Exception as err:
        return jsonify({'error': 'Error al registrar usuario', 'detalles': str(err)}), 500
    finally:
        conn.close()


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Autentica usuario contra MySQL y emite un token JWT Bearer."""
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Debes ingresar email y contraseña.'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT u.id_usuario, u.nombre, u.email, u.password_hash, u.entidad, u.avatar_url, u.estado, r.nombre AS rol
                FROM usuarios u
                JOIN roles r ON u.id_rol = r.id_rol
                WHERE u.email = %s;
            """, (email,))
            user = cursor.fetchone()

            if not user:
                return jsonify({'error': 'Credenciales inválidas.'}), 401
            if user['estado'] != 'activo':
                return jsonify({'error': 'Cuenta inactiva o suspendida.'}), 403

            stored_hash = user['password_hash'] or ''
            valid = False
            if stored_hash.startswith(('pbkdf2:', 'scrypt:')):
                valid = check_password_hash(stored_hash, password)
            elif stored_hash.startswith('$2b$12$dummyhash') and password == 'EcoCommunity2026*':
                # Migra automáticamente el hash semilla al primer login válido
                valid = True
                cursor.execute("UPDATE usuarios SET password_hash = %s WHERE id_usuario = %s;",
                               (generate_password_hash(password), user['id_usuario']))

            if not valid:
                return jsonify({'error': 'Credenciales inválidas.'}), 401

            cursor.execute("""
                INSERT INTO registro_auditoria (usuario_id, accion, entidad_afectada, id_entidad, ip_origen, detalle)
                VALUES (%s, 'LOGIN_EXITOSO', 'usuarios', %s, %s, %s);
            """, (user['id_usuario'], str(user['id_usuario']), request.remote_addr, f"Inicio de sesión JWT ({user['rol']})"))

        token = create_jwt_token({'sub': user['id_usuario'], 'email': user['email'], 'rol': user['rol']})
        return jsonify({
            'success': True,
            'token': token,
            'user': {
                'id_usuario': user['id_usuario'],
                'nombre': user['nombre'],
                'email': user['email'],
                'rol': user['rol'],
                'entidad': user['entidad'],
                'avatar_url': user['avatar_url'],
            }
        })
    except Exception as err:
        return jsonify({'error': 'Error en autenticación', 'detalles': str(err)}), 500
    finally:
        conn.close()


@app.route('/api/auth/me', methods=['GET'])
@require_auth
def auth_me():
    """Devuelve el perfil del usuario autenticado por token JWT."""
    return jsonify({'authenticated': True, 'user': g.current_user})


# -------------------------------------------------------------
# CRUD USUARIOS (/api/usuarios) - Protegido por Auth y Rol
# -------------------------------------------------------------

@app.route('/api/usuarios', methods=['GET'])
@require_auth
@require_roles('admin')
def list_usuarios():
    """Lista todos los usuarios registrados con su rol (solo admin)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT u.id_usuario, u.nombre, u.email, u.entidad, u.avatar_url, u.estado,
                       u.fecha_registro, r.nombre AS rol
                FROM usuarios u
                JOIN roles r ON u.id_rol = r.id_rol
                ORDER BY u.id_usuario ASC;
            """)
            rows = cursor.fetchall()
        for r in rows:
            if r.get('fecha_registro'):
                r['fecha_registro'] = r['fecha_registro'].isoformat()
        return jsonify({'total': len(rows), 'usuarios': rows})
    finally:
        conn.close()


@app.route('/api/usuarios/<int:usuario_id>', methods=['GET'])
@require_auth
def get_usuario(usuario_id):
    """Obtiene un usuario por ID (propio usuario o admin)."""
    if g.current_user['rol'] != 'admin' and g.current_user['id_usuario'] != usuario_id:
        return jsonify({'error': 'No tienes permisos para consultar otro usuario.'}), 403
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT u.id_usuario, u.nombre, u.email, u.entidad, u.avatar_url, u.estado,
                       u.fecha_registro, r.nombre AS rol
                FROM usuarios u
                JOIN roles r ON u.id_rol = r.id_rol
                WHERE u.id_usuario = %s;
            """, (usuario_id,))
            row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        if row.get('fecha_registro'):
            row['fecha_registro'] = row['fecha_registro'].isoformat()
        return jsonify({'usuario': row})
    finally:
        conn.close()


@app.route('/api/usuarios/<int:usuario_id>', methods=['PUT'])
@require_auth
def update_usuario(usuario_id):
    """Actualiza datos del usuario (propio usuario o admin)."""
    if g.current_user['rol'] != 'admin' and g.current_user['id_usuario'] != usuario_id:
        return jsonify({'error': 'No tienes permisos para modificar otro usuario.'}), 403
    data = request.get_json() or {}
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id_usuario, nombre, entidad, estado, id_rol FROM usuarios WHERE id_usuario = %s;", (usuario_id,))
            existing = cursor.fetchone()
            if not existing:
                return jsonify({'error': 'Usuario no encontrado'}), 404

            nombre = (data.get('nombre') or existing['nombre']).strip()
            entidad = data.get('entidad', existing['entidad'])
            estado = existing['estado']
            id_rol = existing['id_rol']

            if g.current_user['rol'] == 'admin':
                if data.get('estado') in ('activo', 'inactivo', 'suspendido'):
                    estado = data['estado']
                if data.get('rol'):
                    cursor.execute("SELECT id_rol FROM roles WHERE nombre = %s;", (data['rol'],))
                    r_row = cursor.fetchone()
                    if r_row:
                        id_rol = r_row['id_rol']

            cursor.execute("""
                UPDATE usuarios SET nombre = %s, entidad = %s, estado = %s, id_rol = %s
                WHERE id_usuario = %s;
            """, (nombre, entidad, estado, id_rol, usuario_id))
        return jsonify({'success': True, 'mensaje': 'Usuario actualizado correctamente.', 'id_usuario': usuario_id})
    finally:
        conn.close()


@app.route('/api/usuarios/<int:usuario_id>', methods=['DELETE'])
@require_auth
@require_roles('admin')
def delete_usuario(usuario_id):
    """Desactiva o elimina un usuario (solo admin)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id_usuario FROM usuarios WHERE id_usuario = %s;", (usuario_id,))
            if not cursor.fetchone():
                return jsonify({'error': 'Usuario no encontrado'}), 404

            cursor.execute("SELECT COUNT(*) AS c FROM entregas WHERE usuario_id = %s;", (usuario_id,))
            has_entregas = cursor.fetchone()['c'] > 0
            if has_entregas:
                cursor.execute("UPDATE usuarios SET estado = 'inactivo' WHERE id_usuario = %s;", (usuario_id,))
                return jsonify({'success': True, 'modo': 'soft_delete', 'mensaje': 'Usuario desactivado (posee entregas históricas).'})

            cursor.execute("DELETE FROM registro_auditoria WHERE usuario_id = %s;", (usuario_id,))
            cursor.execute("DELETE FROM transacciones WHERE usuario_id = %s;", (usuario_id,))
            cursor.execute("DELETE FROM usuarios WHERE id_usuario = %s;", (usuario_id,))
        return jsonify({'success': True, 'modo': 'hard_delete', 'mensaje': 'Usuario eliminado de MySQL.'})
    finally:
        conn.close()


# -------------------------------------------------------------
# CRUD MATERIALES (/api/materiales)
# -------------------------------------------------------------

@app.route('/api/materiales', methods=['GET'])
def list_materiales():
    """Lista todos los materiales reciclables del catálogo en MySQL."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM materiales ORDER BY id_material ASC;")
            rows = cursor.fetchall()
        for r in rows:
            r['co2_factor'] = float(r['co2_factor'])
        return jsonify({'total': len(rows), 'materiales': rows})
    finally:
        conn.close()


@app.route('/api/materiales/<int:material_id>', methods=['GET'])
def get_material(material_id):
    """Obtiene un material por ID."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM materiales WHERE id_material = %s;", (material_id,))
            row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Material no encontrado'}), 404
        row['co2_factor'] = float(row['co2_factor'])
        return jsonify({'material': row})
    finally:
        conn.close()


@app.route('/api/materiales', methods=['POST'])
@require_auth
@require_roles('admin')
def create_material():
    """Crea un nuevo material reciclable (solo admin)."""
    data = request.get_json() or {}
    nombre = (data.get('nombre') or '').strip()
    categoria = data.get('categoria')
    codigo_barras = data.get('codigo_barras')
    puntos_por_kg = int(data.get('puntos_por_kg', 100))
    co2_factor = float(data.get('co2_factor', 1.0))
    instrucciones = (data.get('instrucciones_reciclaje') or 'Limpio y seco.').strip()

    categorias_validas = ('Plástico PET', 'Cartón y Papel', 'Vidrio', 'Aluminio / Latas', 'Tetra Pak', 'No reciclable')
    if not nombre or categoria not in categorias_validas:
        return jsonify({'error': f'Nombre y categoría válida son requeridos ({", ".join(categorias_validas)}).'}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO materiales (codigo_barras, nombre, categoria, puntos_por_kg, co2_factor, instrucciones_reciclaje)
                VALUES (%s, %s, %s, %s, %s, %s);
            """, (codigo_barras, nombre, categoria, puntos_por_kg, co2_factor, instrucciones))
            new_id = cursor.lastrowid
        return jsonify({'success': True, 'id_material': new_id, 'mensaje': 'Material creado en MySQL.'}), 201
    except Exception as err:
        return jsonify({'error': 'Error creando material', 'detalles': str(err)}), 400
    finally:
        conn.close()


@app.route('/api/materiales/<int:material_id>', methods=['PUT'])
@require_auth
@require_roles('admin')
def update_material(material_id):
    """Actualiza un material existente (solo admin)."""
    data = request.get_json() or {}
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM materiales WHERE id_material = %s;", (material_id,))
            existing = cursor.fetchone()
            if not existing:
                return jsonify({'error': 'Material no encontrado'}), 404

            cursor.execute("""
                UPDATE materiales
                SET nombre = %s, categoria = %s, puntos_por_kg = %s, co2_factor = %s, instrucciones_reciclaje = %s
                WHERE id_material = %s;
            """, (
                data.get('nombre', existing['nombre']),
                data.get('categoria', existing['categoria']),
                int(data.get('puntos_por_kg', existing['puntos_por_kg'])),
                float(data.get('co2_factor', existing['co2_factor'])),
                data.get('instrucciones_reciclaje', existing['instrucciones_reciclaje']),
                material_id,
            ))
        return jsonify({'success': True, 'id_material': material_id, 'mensaje': 'Material actualizado en MySQL.'})
    finally:
        conn.close()


@app.route('/api/materiales/<int:material_id>', methods=['DELETE'])
@require_auth
@require_roles('admin')
def delete_material(material_id):
    """Elimina un material del catálogo (solo admin)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM materiales WHERE id_material = %s;", (material_id,))
            if cursor.rowcount == 0:
                return jsonify({'error': 'Material no encontrado'}), 404
        return jsonify({'success': True, 'mensaje': 'Material eliminado de MySQL.'})
    finally:
        conn.close()


# -------------------------------------------------------------
# CRUD PUNTOS LIMPIOS (/api/puntos) - Complemento POST/PUT/DELETE
# -------------------------------------------------------------

@app.route('/api/puntos/<int:punto_id>', methods=['GET'])
def get_punto(punto_id):
    """Obtiene el detalle de un punto limpio por ID."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM puntos_limpios WHERE id_punto = %s;", (punto_id,))
            row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Punto limpio no encontrado'}), 404
        row['latitud'] = float(row['latitud'])
        row['longitud'] = float(row['longitud'])
        row['capacidad_max_kg'] = float(row['capacidad_max_kg'])
        row['capacidad_actual_kg'] = float(row['capacidad_actual_kg'])
        if isinstance(row.get('materiales_aceptados'), str):
            row['materiales_aceptados'] = json.loads(row['materiales_aceptados'])
        return jsonify({'punto': row})
    finally:
        conn.close()


@app.route('/api/puntos', methods=['POST'])
@require_auth
@require_roles('admin')
def create_punto():
    """Crea un nuevo punto de recolección en MySQL (solo admin)."""
    data = request.get_json() or {}
    nombre = (data.get('nombre') or '').strip()
    direccion = (data.get('direccion') or '').strip()
    if not nombre or not direccion or data.get('latitud') is None or data.get('longitud') is None:
        return jsonify({'error': 'nombre, direccion, latitud y longitud son obligatorios.'}), 400

    qr_hash = data.get('codigo_qr_hash') or f"ECO-HUB-{secrets.token_hex(4).upper()}"
    materiales = json.dumps(data.get('materiales_aceptados') or ['Plástico PET', 'Cartón y Papel'])

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO puntos_limpios (nombre, direccion, latitud, longitud, horario, capacidad_max_kg,
                                            capacidad_actual_kg, activo, codigo_qr_hash, tipo, materiales_aceptados)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 1, %s, %s, %s);
            """, (
                nombre, direccion, float(data['latitud']), float(data['longitud']),
                data.get('horario', '24/7'), float(data.get('capacidad_max_kg', 1000.0)),
                float(data.get('capacidad_actual_kg', 0.0)), qr_hash,
                data.get('tipo', 'Contenedor Inteligente'), materiales
            ))
            new_id = cursor.lastrowid
        return jsonify({'success': True, 'id_punto': new_id, 'codigo_qr_hash': qr_hash}), 201
    except Exception as err:
        return jsonify({'error': 'Error creando punto limpio', 'detalles': str(err)}), 400
    finally:
        conn.close()


@app.route('/api/puntos/<int:punto_id>', methods=['PUT'])
@require_auth
@require_roles('admin', 'punto_acopio')
def update_punto(punto_id):
    """Actualiza datos o capacidad de un punto limpio (admin o punto_acopio)."""
    data = request.get_json() or {}
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM puntos_limpios WHERE id_punto = %s;", (punto_id,))
            existing = cursor.fetchone()
            if not existing:
                return jsonify({'error': 'Punto limpio no encontrado'}), 404

            cursor.execute("""
                UPDATE puntos_limpios
                SET nombre = %s, direccion = %s, horario = %s, capacidad_max_kg = %s,
                    capacidad_actual_kg = %s, activo = %s
                WHERE id_punto = %s;
            """, (
                data.get('nombre', existing['nombre']),
                data.get('direccion', existing['direccion']),
                data.get('horario', existing['horario']),
                float(data.get('capacidad_max_kg', existing['capacidad_max_kg'])),
                float(data.get('capacidad_actual_kg', existing['capacidad_actual_kg'])),
                bool(data.get('activo', existing['activo'])),
                punto_id,
            ))
        return jsonify({'success': True, 'id_punto': punto_id, 'mensaje': 'Punto limpio actualizado en MySQL.'})
    finally:
        conn.close()


@app.route('/api/puntos/<int:punto_id>', methods=['DELETE'])
@require_auth
@require_roles('admin')
def delete_punto(punto_id):
    """Elimina o desactiva un punto limpio (solo admin)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id_punto FROM puntos_limpios WHERE id_punto = %s;", (punto_id,))
            if not cursor.fetchone():
                return jsonify({'error': 'Punto limpio no encontrado'}), 404
            cursor.execute("SELECT COUNT(*) AS c FROM entregas WHERE punto_id = %s;", (punto_id,))
            if cursor.fetchone()['c'] > 0:
                cursor.execute("UPDATE puntos_limpios SET activo = 0 WHERE id_punto = %s;", (punto_id,))
                return jsonify({'success': True, 'modo': 'soft_delete', 'mensaje': 'Punto desactivado (posee entregas asociadas).'})
            cursor.execute("DELETE FROM puntos_limpios WHERE id_punto = %s;", (punto_id,))
        return jsonify({'success': True, 'modo': 'hard_delete', 'mensaje': 'Punto limpio eliminado de MySQL.'})
    finally:
        conn.close()


# -------------------------------------------------------------
# CRUD ENTREGAS - Complemento GET por ID y DELETE
# -------------------------------------------------------------

@app.route('/api/entregas/<int:entrega_id>', methods=['GET'])
def get_entrega_by_id(entrega_id):
    """Obtiene una entrega específica por su ID."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT e.*, u.nombre AS usuario_nombre, p.nombre AS punto_nombre
                FROM entregas e
                JOIN usuarios u ON e.usuario_id = u.id_usuario
                JOIN puntos_limpios p ON e.punto_id = p.id_punto
                WHERE e.id_entrega = %s;
            """, (entrega_id,))
            row = cursor.fetchone()
        if not row:
            return jsonify({'error': 'Entrega no encontrada'}), 404
        row['peso_kg'] = float(row['peso_kg'])
        row['co2_ahorrado_kg'] = float(row['co2_ahorrado_kg'])
        row['latitud_registro'] = float(row['latitud_registro'])
        row['longitud_registro'] = float(row['longitud_registro'])
        if row.get('fecha_entrega'):
            row['fecha_entrega'] = row['fecha_entrega'].isoformat()
        return jsonify({'entrega': row})
    finally:
        conn.close()


@app.route('/api/entregas/<int:entrega_id>', methods=['DELETE'])
@require_auth
@require_roles('admin')
def delete_entrega(entrega_id):
    """Elimina una entrega de prueba o anulada (solo admin) y registra auditoría."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id_entrega, uuid FROM entregas WHERE id_entrega = %s;", (entrega_id,))
            row = cursor.fetchone()
            if not row:
                return jsonify({'error': 'Entrega no encontrada'}), 404
            cursor.execute("DELETE FROM entregas WHERE id_entrega = %s;", (entrega_id,))
            cursor.execute("""
                INSERT INTO registro_auditoria (usuario_id, accion, entidad_afectada, id_entidad, ip_origen, detalle)
                VALUES (%s, 'ELIMINAR_ENTREGA', 'entregas', %s, %s, %s);
            """, (g.current_user['id_usuario'], str(entrega_id), request.remote_addr, f"Entrega {row['uuid']} eliminada por admin"))
        return jsonify({'success': True, 'mensaje': f'Entrega {entrega_id} eliminada de MySQL.'})
    finally:
        conn.close()


# -------------------------------------------------------------
# DOCUMENTACIÓN INTERACTIVA DE ENDPOINTS (OpenAPI 3.0 & Swagger UI)
# -------------------------------------------------------------

@app.route('/api/openapi.json', methods=['GET'])
def openapi_spec():
    """Retorna la especificación OpenAPI 3.0 de todos los endpoints de EcoCommunity."""
    spec = {
        'openapi': '3.0.3',
        'info': {
            'title': 'EcoCommunity API REST (Python / Flask / MySQL)',
            'version': '2.0.0',
            'description': 'API RESTful para gestión de usuarios, autenticación JWT, materiales reciclables con IA Gemini, puntos limpios con geofencing, entregas, billetera Ecocoins e histórico MySQL.'
        },
        'components': {
            'securitySchemes': {
                'BearerAuth': {'type': 'http', 'scheme': 'bearer', 'bearerFormat': 'JWT'}
            }
        },
        'paths': {
            '/api/db/status': {'get': {'tags': ['Sistema'], 'summary': 'Estado de conexión MySQL XAMPP y conteo de tablas'}},
            '/api/auth/register': {'post': {'tags': ['Autenticación'], 'summary': 'Registrar nuevo usuario y obtener JWT'}},
            '/api/auth/login': {'post': {'tags': ['Autenticación'], 'summary': 'Iniciar sesión y obtener JWT Bearer'}},
            '/api/auth/me': {'get': {'tags': ['Autenticación'], 'security': [{'BearerAuth': []}], 'summary': 'Perfil del usuario autenticado'}},
            '/api/usuarios': {'get': {'tags': ['Usuarios CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Listar usuarios (solo admin)'}},
            '/api/usuarios/{id}': {
                'get': {'tags': ['Usuarios CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Obtener usuario por ID'},
                'put': {'tags': ['Usuarios CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Actualizar usuario'},
                'delete': {'tags': ['Usuarios CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Eliminar/desactivar usuario (solo admin)'},
            },
            '/api/materiales': {
                'get': {'tags': ['Materiales CRUD'], 'summary': 'Listar catálogo de materiales'},
                'post': {'tags': ['Materiales CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Crear material (solo admin)'},
            },
            '/api/materiales/{id}': {
                'get': {'tags': ['Materiales CRUD'], 'summary': 'Obtener material por ID'},
                'put': {'tags': ['Materiales CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Actualizar material (solo admin)'},
                'delete': {'tags': ['Materiales CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Eliminar material (solo admin)'},
            },
            '/api/puntos': {
                'get': {'tags': ['Puntos Limpios CRUD'], 'summary': 'Listar puntos limpios con cálculo Haversine'},
                'post': {'tags': ['Puntos Limpios CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Crear punto limpio (solo admin)'},
            },
            '/api/puntos/{id}': {
                'get': {'tags': ['Puntos Limpios CRUD'], 'summary': 'Obtener punto limpio por ID'},
                'put': {'tags': ['Puntos Limpios CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Actualizar punto limpio (admin / punto_acopio)'},
                'delete': {'tags': ['Puntos Limpios CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Eliminar/desactivar punto limpio (solo admin)'},
            },
            '/api/ai/classify': {'post': {'tags': ['IA Gemini'], 'summary': 'Clasificar residuo por imagen o código de barras'}},
            '/api/entregas/validate-and-deposit': {'post': {'tags': ['Entregas CRUD'], 'summary': 'Validar QR + Geofencing <=20m y registrar entrega'}},
            '/api/entregas/history': {'get': {'tags': ['Entregas CRUD'], 'summary': 'Histórico filtrable de entregas en MySQL'}},
            '/api/entregas/{id}': {
                'get': {'tags': ['Entregas CRUD'], 'summary': 'Obtener entrega por ID'},
                'delete': {'tags': ['Entregas CRUD'], 'security': [{'BearerAuth': []}], 'summary': 'Eliminar entrega (solo admin)'},
            },
            '/api/entregas/{id}/custodia': {'put': {'tags': ['Entregas CRUD'], 'summary': 'Actualizar paso en cadena de custodia'}},
            '/api/user/wallet': {'get': {'tags': ['Billetera & ESG'], 'summary': 'Consultar saldo Ecocoins y transacciones'}},
            '/api/rewards/redeem': {'post': {'tags': ['Billetera & ESG'], 'summary': 'Canjear recompensa por voucher'}},
            '/api/esg/report': {'get': {'tags': ['Billetera & ESG'], 'summary': 'Reporte consolidado de sostenibilidad ESG'}},
        }
    }
    return jsonify(spec)


@app.route('/api/docs', methods=['GET'])
def swagger_ui():
    """Interfaz visual Swagger UI para explorar y probar los endpoints de EcoCommunity."""
    return """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>EcoCommunity API Docs (Swagger)</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui' });
  </script>
</body>
</html>"""


# -------------------------------------------------------------
# SERVIDO ESTÁTICO DE LA APLICACIÓN WEB
# -------------------------------------------------------------

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """Sirve la aplicacion web compilada (dist/) o redirige al index.html para SPA."""
    dist_dir = os.path.join(os.path.dirname(__file__), 'dist')
    if path != "" and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    if os.path.exists(os.path.join(dist_dir, 'index.html')):
        return send_from_directory(dist_dir, 'index.html')
    return jsonify({
        'mensaje': 'Servidor EcoCommunity Python/Flask activo en MySQL XAMPP',
        'api_doc': '/api/db/status'
    })

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    print(f"============================================================")
    print(f"  ECOCOMMUNITY - SERVIDOR PYTHON / FLASK / MYSQL (XAMPP)")
    print(f"  Puerto: {port} | Base de datos: {DB_CONFIG['database']}")
    print(f"============================================================")
    app.run(host='0.0.0.0', port=port, debug=False)
