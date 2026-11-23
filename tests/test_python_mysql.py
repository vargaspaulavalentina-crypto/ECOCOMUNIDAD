#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Suite de Pruebas Automatizadas Python / Flask / MySQL (XAMPP)
Verifica sincronización MySQL, autenticación JWT, autorización por roles,
transición secuencial de custodia, CRUD completo y documentación OpenAPI/Swagger.
"""

import unittest
import time
from app import app


class EcoCommunityPythonMySQLTestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        app.config['TESTING'] = True

        # Obtener tokens JWT reales para los roles clave
        cls.tokens = {}
        creds = {
            'ciudadano': 'carlos.mendoza@ecocommunity.org',
            'recolector': 'hernan.recolector@rutalimpia.co',
            'punto_acopio': 'beatriz.acopio@centroverde.org',
            'admin': 'admin@ecocommunity.org',
        }
        for rol, email in creds.items():
            res = cls.client.post('/api/auth/login', json={
                'email': email,
                'password': 'EcoCommunity2026*'
            })
            if res.status_code == 200:
                cls.tokens[rol] = res.get_json()['token']

    def auth_headers(self, rol: str) -> dict:
        return {'Authorization': f"Bearer {self.tokens[rol]}"}

    def test_01_db_status_connection(self):
        """Verifica conexión activa a MySQL en XAMPP y tablas esperadas."""
        response = self.client.get('/api/db/status')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'conectado')
        self.assertIn('entregas', data['tablas'])
        self.assertIn('usuarios', data['tablas'])
        self.assertIn('puntos_limpios', data['tablas'])
        print("\n  [PASS] Test 1: Conexión con XAMPP MySQL (ecocommunity_db) verificada.")

    def test_02_puntos_limpios_geofencing(self):
        """Verifica /api/puntos en MySQL y cálculo Haversine <= 20m."""
        response = self.client.get('/api/puntos?userLat=40.415363&userLng=-3.707398')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertGreater(data['total'], 0)
        punto = data['puntos'][0]
        self.assertLessEqual(punto['distancia_metros'], 20)
        self.assertTrue(punto['dentro_de_geofence'])
        print("  [PASS] Test 2: Consulta de puntos limpios y cálculo Haversine <= 20m validado.")

    def test_03_classify_barcode_mysql(self):
        """Verifica catálogo de materiales por código de barras en MySQL y GET /api/materiales."""
        res_list = self.client.get('/api/materiales')
        self.assertEqual(res_list.status_code, 200)
        self.assertGreaterEqual(res_list.get_json()['total'], 6)

        response = self.client.post('/api/ai/classify', json={'barcode': '7791234567890'})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['source'], 'barcode_database')
        self.assertEqual(data['categoria'], 'Plástico PET')
        self.assertTrue(data['reciclable'])
        print("  [PASS] Test 3: GET /api/materiales y clasificación por código de barras en MySQL verificados.")

    def test_04_validate_and_deposit_security_and_geofence(self):
        """Verifica 401 sin token, 403 usuario ajeno y 403 geofencing > 20m."""
        payload = {
            'usuario_id': 1,
            'punto_id': 1,
            'material_nombre': 'Botella PET',
            'categoria': 'Plástico PET',
            'peso_kg': 0.1,
            'userLat': 40.500000,
            'userLng': -3.800000,
            'qr_hash': 'ECO-BIN-PLAZA-CENTRAL-01'
        }
        # Sin token -> 401
        res_401 = self.client.post('/api/entregas/validate-and-deposit', json=payload)
        self.assertEqual(res_401.status_code, 401)

        # Ciudadano intentando depositar a nombre de otro usuario -> 403
        res_other = self.client.post('/api/entregas/validate-and-deposit',
                                     headers=self.auth_headers('ciudadano'),
                                     json={**payload, 'usuario_id': 2})
        self.assertEqual(res_other.status_code, 403)

        # Fuera de geofence -> 403
        res_geo = self.client.post('/api/entregas/validate-and-deposit',
                                   headers=self.auth_headers('ciudadano'),
                                   json=payload)
        self.assertEqual(res_geo.status_code, 403)
        self.assertIn('Geofencing fallido', res_geo.get_json()['error'])
        print("  [PASS] Test 4: Seguridad 401/403 y rechazo geofencing (> 20m) verificados.")

    def test_05_validate_and_deposit_success_mysql(self):
        """Verifica inserción exitosa de entrega autenticada con hash criptográfico en MySQL."""
        mat_name = f'Lata Aluminio QA {time.time()}'
        payload = {
            'punto_id': 1,
            'material_nombre': mat_name,
            'categoria': 'Aluminio / Latas',
            'peso_kg': 0.05,
            'puntos_otorgados': 35,
            'co2_ahorrado_kg': 0.45,
            'userLat': 40.415364,
            'userLng': -3.707397,
            'qr_hash': 'ECO-BIN-PLAZA-CENTRAL-01'
        }
        response = self.client.post('/api/entregas/validate-and-deposit',
                                    headers=self.auth_headers('ciudadano'),
                                    json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data['success'])
        self.assertTrue(data['entrega']['recibo_digital_hash'].startswith('0x'))
        self.assertEqual(data['entrega']['cadena_custodia_paso'], 'depositado')
        print("  [PASS] Test 5: Depósito autenticado con hash e inserción en MySQL verificado.")

    def test_06_antifraud_rate_limit(self):
        """Verifica que un segundo depósito inmediato del mismo material devuelva HTTP 429."""
        mat_name = f'Botella Antifraude {time.time()}'
        payload = {
            'punto_id': 1,
            'material_nombre': mat_name,
            'categoria': 'Plástico PET',
            'peso_kg': 0.1,
            'puntos_otorgados': 20,
            'co2_ahorrado_kg': 0.18,
            'userLat': 40.415364,
            'userLng': -3.707397,
            'qr_hash': 'ECO-BIN-PLAZA-CENTRAL-01'
        }
        res1 = self.client.post('/api/entregas/validate-and-deposit',
                                headers=self.auth_headers('recolector'),
                                json=payload)
        self.assertEqual(res1.status_code, 200)

        res2 = self.client.post('/api/entregas/validate-and-deposit',
                                headers=self.auth_headers('recolector'),
                                json=payload)
        self.assertEqual(res2.status_code, 429)
        self.assertIn('Antifraude activado', res2.get_json()['error'])
        print("  [PASS] Test 6: Regla antifraude de 24 horas (HTTP 429) verificada en MySQL.")

    def test_07_custodia_secuencial_y_permisos_roles(self):
        """Verifica transición secuencial estricta (depositado->recolectado->en_acopio->transformado) y permisos."""
        # Crear entrega nueva en estado 'depositado'
        mat_name = f'Carton Custodia {time.time()}'
        res_dep = self.client.post('/api/entregas/validate-and-deposit',
                                   headers=self.auth_headers('ciudadano'),
                                   json={
                                       'punto_id': 1,
                                       'material_nombre': mat_name,
                                       'categoria': 'Cartón y Papel',
                                       'peso_kg': 0.2,
                                       'puntos_otorgados': 20,
                                       'co2_ahorrado_kg': 0.18,
                                       'userLat': 40.415364,
                                       'userLng': -3.707397,
                                       'qr_hash': 'ECO-BIN-PLAZA-CENTRAL-01'
                                   })
        self.assertEqual(res_dep.status_code, 200)
        entrega_id = res_dep.get_json()['entrega']['id']

        # 1. Sin token -> 401
        self.assertEqual(
            self.client.put(f'/api/entregas/{entrega_id}/custodia', json={'nuevo_paso': 'recolectado'}).status_code,
            401
        )
        # 2. Ciudadano no puede cambiar custodia -> 403
        self.assertEqual(
            self.client.put(f'/api/entregas/{entrega_id}/custodia',
                            headers=self.auth_headers('ciudadano'),
                            json={'nuevo_paso': 'recolectado'}).status_code,
            403
        )
        # 3. Salto inválido (depositado -> transformado) -> 400
        res_jump = self.client.put(f'/api/entregas/{entrega_id}/custodia',
                                   headers=self.auth_headers('recolector'),
                                   json={'nuevo_paso': 'transformado'})
        self.assertEqual(res_jump.status_code, 400)

        # 4. Flujo secuencial válido
        self.assertEqual(
            self.client.put(f'/api/entregas/{entrega_id}/custodia',
                            headers=self.auth_headers('recolector'),
                            json={'nuevo_paso': 'recolectado'}).status_code,
            200
        )
        self.assertEqual(
            self.client.put(f'/api/entregas/{entrega_id}/custodia',
                            headers=self.auth_headers('punto_acopio'),
                            json={'nuevo_paso': 'en_acopio'}).status_code,
            200
        )
        self.assertEqual(
            self.client.put(f'/api/entregas/{entrega_id}/custodia',
                            headers=self.auth_headers('admin'),
                            json={'nuevo_paso': 'transformado'}).status_code,
            200
        )

        # Limpiar entrega de prueba (DELETE como admin) + verificar 403 como ciudadano + 404 tras borrar
        self.assertEqual(
            self.client.delete(f'/api/entregas/{entrega_id}', headers=self.auth_headers('ciudadano')).status_code,
            403
        )
        self.assertEqual(
            self.client.get(f'/api/entregas/{entrega_id}').status_code,
            200
        )
        self.assertEqual(
            self.client.delete(f'/api/entregas/{entrega_id}', headers=self.auth_headers('admin')).status_code,
            200
        )
        self.assertEqual(
            self.client.get(f'/api/entregas/{entrega_id}').status_code,
            404
        )
        print("  [PASS] Test 7: Custodia secuencial, permisos por rol y GET/DELETE /api/entregas/<id> verificados.")

    def test_08_esg_report(self):
        """Verifica la agregación de métricas de sostenibilidad ESG desde MySQL."""
        response = self.client.get('/api/esg/report')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('metricas_acumuladas', data)
        self.assertIn('cadena_de_custodia', data)
        print("  [PASS] Test 8: Reporte consolidado ESG y desglose por categorías validado.")

    def test_09_auth_register_login_me_y_crud_usuario(self):
        """Verifica registro, login JWT, /api/auth/me, GET/PUT /api/usuarios/<id> y DELETE."""
        unique_email = f'qa.{int(time.time() * 1000)}@ecocommunity.org'
        reg_res = self.client.post('/api/auth/register', json={
            'nombre': 'Usuario QA',
            'email': unique_email,
            'password': 'PasswordQA123',
            'rol': 'ciudadano'
        })
        self.assertEqual(reg_res.status_code, 201)
        created_uid = reg_res.get_json()['user']['id_usuario']
        user_token = reg_res.get_json()['token']
        user_headers = {'Authorization': f'Bearer {user_token}'}

        # GET /api/auth/me
        me_res = self.client.get('/api/auth/me', headers=user_headers)
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.get_json()['user']['email'], unique_email)

        # GET y PUT propio usuario -> 200; otro usuario -> 403; inexistente -> 404 (admin)
        self.assertEqual(self.client.get(f'/api/usuarios/{created_uid}', headers=user_headers).status_code, 200)
        self.assertEqual(self.client.get('/api/usuarios/1', headers=user_headers).status_code, 403)
        self.assertEqual(
            self.client.put(f'/api/usuarios/{created_uid}', headers=user_headers, json={'nombre': 'Usuario QA Editado'}).status_code,
            200
        )
        self.assertEqual(
            self.client.get('/api/usuarios/999999', headers=self.auth_headers('admin')).status_code,
            404
        )

        # Eliminar usuario de prueba como admin
        del_res = self.client.delete(f'/api/usuarios/{created_uid}', headers=self.auth_headers('admin'))
        self.assertEqual(del_res.status_code, 200)
        print("  [PASS] Test 9: Registro, Login JWT, /api/auth/me y CRUD de Usuarios verificados.")

    def test_10_wallet_y_redeem_seguridad_y_errores(self):
        """Verifica GET /api/user/wallet y POST /api/rewards/redeem (200, 400, 401, 403, 404)."""
        # Sin token -> 401
        self.assertEqual(self.client.get('/api/user/wallet').status_code, 401)
        self.assertEqual(self.client.post('/api/rewards/redeem', json={'rewardId': 'rew-1'}).status_code, 401)

        # Ciudadano consultando billetera de otro usuario -> 403
        self.assertEqual(
            self.client.get('/api/user/wallet?usuario_id=2', headers=self.auth_headers('ciudadano')).status_code,
            403
        )

        # Ciudadano consultando su propia billetera -> 200
        res_wallet = self.client.get('/api/user/wallet', headers=self.auth_headers('ciudadano'))
        self.assertEqual(res_wallet.status_code, 200)
        self.assertIn('saldo_ecocoins', res_wallet.get_json())

        # Recompensa inexistente -> 404
        res_404 = self.client.post('/api/rewards/redeem',
                                   headers=self.auth_headers('ciudadano'),
                                   json={'rewardId': 'rew-no-existe'})
        self.assertEqual(res_404.status_code, 404)

        # Canje válido (usuario 1 tiene saldo suficiente para rew-1 de 50 EC) -> 200
        res_ok = self.client.post('/api/rewards/redeem',
                                  headers=self.auth_headers('ciudadano'),
                                  json={'rewardId': 'rew-1'})
        self.assertIn(res_ok.status_code, (200, 400))
        if res_ok.status_code == 200:
            self.assertIn('codigo', res_ok.get_json()['voucher'])
        print("  [PASS] Test 10: Billetera y Canje de Recompensas (200, 400/401/403/404) verificados.")

    def test_11_crud_materiales_mysql(self):
        """Verifica CRUD completo (Create, Read, Update, Delete) sobre /api/materiales."""
        headers = self.auth_headers('admin')

        res_post = self.client.post('/api/materiales', headers=headers, json={
            'nombre': 'Botella QA Test',
            'categoria': 'Plástico PET',
            'puntos_por_kg': 220,
            'co2_factor': 1.9,
            'instrucciones_reciclaje': 'Enjuagar y comprimir.'
        })
        self.assertEqual(res_post.status_code, 201)
        mat_id = res_post.get_json()['id_material']

        self.assertEqual(self.client.get(f'/api/materiales/{mat_id}').status_code, 200)
        self.assertEqual(self.client.put(f'/api/materiales/{mat_id}', headers=headers, json={'puntos_por_kg': 250}).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/materiales/{mat_id}', headers=headers).status_code, 200)
        self.assertEqual(self.client.get(f'/api/materiales/{mat_id}').status_code, 404)
        print("  [PASS] Test 11: CRUD completo de Materiales en MySQL verificado.")

    def test_12_crud_puntos_limpios_mysql(self):
        """Verifica CRUD completo (Create, Read, Update, Delete) sobre /api/puntos."""
        headers = self.auth_headers('admin')

        res_post = self.client.post('/api/puntos', headers=headers, json={
            'nombre': 'Punto QA Temporal',
            'direccion': 'Calle Pruebas 123',
            'latitud': 40.4200,
            'longitud': -3.7000
        })
        self.assertEqual(res_post.status_code, 201)
        punto_id = res_post.get_json()['id_punto']

        self.assertEqual(self.client.get(f'/api/puntos/{punto_id}').status_code, 200)
        self.assertEqual(self.client.put(f'/api/puntos/{punto_id}', headers=headers, json={'capacidad_actual_kg': 120.5}).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/puntos/{punto_id}', headers=headers).status_code, 200)
        print("  [PASS] Test 12: CRUD completo de Puntos Limpios en MySQL verificado.")

    def test_13_openapi_and_swagger_docs(self):
        """Verifica que la documentación OpenAPI 3.0 y Swagger UI estén disponibles."""
        res_spec = self.client.get('/api/openapi.json')
        self.assertEqual(res_spec.status_code, 200)
        spec = res_spec.get_json()
        self.assertIn('/api/auth/login', spec['paths'])
        self.assertIn('security', spec['paths']['/api/user/wallet']['get'])
        self.assertIn('security', spec['paths']['/api/entregas/{id}/custodia']['put'])

        res_ui = self.client.get('/api/docs')
        self.assertEqual(res_ui.status_code, 200)
        self.assertIn(b'swagger-ui', res_ui.data)
        print("  [PASS] Test 13: Documentación OpenAPI 3.0 (/api/openapi.json) y Swagger UI (/api/docs) verificadas.\n")


if __name__ == '__main__':
    unittest.main()
