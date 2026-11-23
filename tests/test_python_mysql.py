#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Suite de Pruebas Automatizadas Python / Flask / MySQL (XAMPP)
Verifica la sincronización, persistencia en base de datos y endpoints del SRS
"""

import sys
import unittest
import json
import time
from app import app, get_db_connection

class EcoCommunityPythonMySQLTestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        app.config['TESTING'] = True

    def test_01_db_status_connection(self):
        """Verifica que el endpoint /api/db/status confirme la conexión activa a MySQL en XAMPP."""
        response = self.client.get('/api/db/status')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['status'], 'conectado')
        self.assertIn('entregas', data['tablas'])
        self.assertIn('usuarios', data['tablas'])
        self.assertIn('puntos_limpios', data['tablas'])
        print("\n  [PASS] Test 1: Conexión con XAMPP MySQL (ecocommunity_db) verificada.")

    def test_02_puntos_limpios_geofencing(self):
        """Verifica que /api/puntos consulte MySQL y calcule Haversine correctamente."""
        response = self.client.get('/api/puntos?userLat=40.415363&userLng=-3.707398')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertGreater(data['total'], 0)
        punto = data['puntos'][0]
        self.assertLessEqual(punto['distancia_metros'], 20)
        self.assertTrue(punto['dentro_de_geofence'])
        print("  [PASS] Test 2: Consulta de puntos limpios y cálculo Haversine <= 20m validado.")

    def test_03_classify_barcode_mysql(self):
        """Verifica que /api/ai/classify consulte el código de barras en la tabla materiales de MySQL."""
        response = self.client.post('/api/ai/classify', json={'barcode': '7791234567890'})
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['source'], 'barcode_database')
        self.assertEqual(data['categoria'], 'Plástico PET')
        self.assertTrue(data['reciclable'])
        print("  [PASS] Test 3: Catálogo de materiales por código de barras en MySQL verificado.")

    def test_04_validate_and_deposit_geofence_reject(self):
        """Verifica rechazo con HTTP 403 cuando el usuario está a más de 20 metros."""
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
        response = self.client.post('/api/entregas/validate-and-deposit', json=payload)
        self.assertEqual(response.status_code, 403)
        data = response.get_json()
        self.assertIn('Geofencing fallido', data['error'])
        print("  [PASS] Test 4: Rechazo estricto de geofencing (> 20m) con HTTP 403 verificado.")

    def test_05_validate_and_deposit_success_mysql(self):
        """Verifica inserción exitosa de entrega y transacción en MySQL dentro de geofence."""
        self.test_material_name = f'Lata Aluminio QA {time.time()}'
        payload = {
            'usuario_id': 2,
            'punto_id': 1,
            'material_nombre': self.test_material_name,
            'categoria': 'Aluminio / Latas',
            'peso_kg': 0.05,
            'puntos_otorgados': 35,
            'co2_ahorrado_kg': 0.45,
            'userLat': 40.415364,
            'userLng': -3.707397,
            'qr_hash': 'ECO-BIN-PLAZA-CENTRAL-01'
        }
        response = self.client.post('/api/entregas/validate-and-deposit', json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data['success'])
        self.assertTrue(data['entrega']['recibo_digital_hash'].startswith('0x'))
        self.assertEqual(data['entrega']['cadena_custodia_paso'], 'depositado')
        print("  [PASS] Test 5: Depósito exitoso con hash criptográfico e inserción en MySQL.")

    def test_06_antifraud_rate_limit(self):
        """Verifica que un segundo depósito inmediato del mismo material devuelva HTTP 429."""
        mat_name = f'Botella Antifraude {time.time()}'
        payload = {
            'usuario_id': 3,
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
        # Primer intento: debe ser 200
        res1 = self.client.post('/api/entregas/validate-and-deposit', json=payload)
        self.assertEqual(res1.status_code, 200)

        # Segundo intento inmediato: debe ser 429
        res2 = self.client.post('/api/entregas/validate-and-deposit', json=payload)
        self.assertEqual(res2.status_code, 429)
        data = res2.get_json()
        self.assertIn('Antifraude activado', data['error'])
        print("  [PASS] Test 6: Regla antifraude de 24 horas (HTTP 429) verificada en MySQL.")

    def test_07_entregas_history_and_custodia_update(self):
        """Verifica el nuevo endpoint interactivo de Histórico y actualización de Cadena de Custodia."""
        # 1. Consultar histórico
        response = self.client.get('/api/entregas/history')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertGreater(data['total'], 0)
        primera_entrega = data['entregas'][0]
        entrega_id = primera_entrega['id']

        # 2. Actualizar custodia a 'recolectado'
        res_update = self.client.put(f'/api/entregas/{entrega_id}/custodia', json={'nuevo_paso': 'recolectado'})
        self.assertEqual(res_update.status_code, 200)
        data_update = res_update.get_json()
        self.assertEqual(data_update['nuevo_paso'], 'recolectado')

        # 3. Actualizar custodia a 'transformado'
        res_update2 = self.client.put(f'/api/entregas/{entrega_id}/custodia', json={'nuevo_paso': 'transformado'})
        self.assertEqual(res_update2.status_code, 200)
        self.assertEqual(res_update2.get_json()['nuevo_paso'], 'transformado')
        print("  [PASS] Test 7: Endpoint interactivo de Histórico y actualización de Custodia en MySQL verificado.")

    def test_08_esg_report(self):
        """Verifica la agregación de métricas de sostenibilidad ESG desde MySQL."""
        response = self.client.get('/api/esg/report')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('metricas_acumuladas', data)
        self.assertIn('cadena_de_custodia', data)
        print("  [PASS] Test 8: Reporte consolidado ESG y desglose por categorías validado.")

    def test_09_auth_register_login_and_me(self):
        """Verifica registro de usuario, hash de contraseña, login JWT y /api/auth/me."""
        unique_email = f'qa.{int(time.time() * 1000)}@ecocommunity.org'
        reg_res = self.client.post('/api/auth/register', json={
            'nombre': 'Usuario QA',
            'email': unique_email,
            'password': 'PasswordQA123',
            'rol': 'ciudadano'
        })
        self.assertEqual(reg_res.status_code, 201)
        reg_data = reg_res.get_json()
        self.assertIn('token', reg_data)
        created_uid = reg_data['user']['id_usuario']

        # Login con credenciales válidas
        login_res = self.client.post('/api/auth/login', json={
            'email': unique_email,
            'password': 'PasswordQA123'
        })
        self.assertEqual(login_res.status_code, 200)
        token = login_res.get_json()['token']

        # Consultar /api/auth/me con token Bearer
        me_res = self.client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.get_json()['user']['email'], unique_email)

        # Limpiar usuario creado usando token admin
        admin_login = self.client.post('/api/auth/login', json={
            'email': 'admin@ecocommunity.org',
            'password': 'EcoCommunity2026*'
        })
        self.assertEqual(admin_login.status_code, 200)
        admin_token = admin_login.get_json()['token']
        del_res = self.client.delete(f'/api/usuarios/{created_uid}',
                                     headers={'Authorization': f'Bearer {admin_token}'})
        self.assertEqual(del_res.status_code, 200)
        print("  [PASS] Test 9: Registro, Login JWT y /api/auth/me verificados en MySQL.")

    def test_10_authorization_roles_401_403(self):
        """Verifica rechazo 401 sin token y 403 cuando un ciudadano intenta rutas de admin."""
        # Sin token -> 401
        res_401 = self.client.get('/api/usuarios')
        self.assertEqual(res_401.status_code, 401)

        # Login como ciudadano -> 403 en /api/usuarios y POST /api/materiales
        cit_login = self.client.post('/api/auth/login', json={
            'email': 'carlos.mendoza@ecocommunity.org',
            'password': 'EcoCommunity2026*'
        })
        self.assertEqual(cit_login.status_code, 200)
        cit_token = cit_login.get_json()['token']

        res_403 = self.client.get('/api/usuarios', headers={'Authorization': f'Bearer {cit_token}'})
        self.assertEqual(res_403.status_code, 403)
        print("  [PASS] Test 10: Autorización por roles (HTTP 401 sin token y 403 rol ciudadano) validada.")

    def test_11_crud_materiales_mysql(self):
        """Verifica CRUD completo (Create, Read, Update, Delete) sobre /api/materiales."""
        admin_token = self.client.post('/api/auth/login', json={
            'email': 'admin@ecocommunity.org',
            'password': 'EcoCommunity2026*'
        }).get_json()['token']
        headers = {'Authorization': f'Bearer {admin_token}'}

        # Create
        res_post = self.client.post('/api/materiales', headers=headers, json={
            'nombre': 'Botella QA Test',
            'categoria': 'Plástico PET',
            'puntos_por_kg': 220,
            'co2_factor': 1.9,
            'instrucciones_reciclaje': 'Enjuagar y comprimir.'
        })
        self.assertEqual(res_post.status_code, 201)
        mat_id = res_post.get_json()['id_material']

        # Read
        res_get = self.client.get(f'/api/materiales/{mat_id}')
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(res_get.get_json()['material']['nombre'], 'Botella QA Test')

        # Update
        res_put = self.client.put(f'/api/materiales/{mat_id}', headers=headers, json={
            'nombre': 'Botella QA Actualizada',
            'puntos_por_kg': 250
        })
        self.assertEqual(res_put.status_code, 200)

        # Delete
        res_del = self.client.delete(f'/api/materiales/{mat_id}', headers=headers)
        self.assertEqual(res_del.status_code, 200)
        print("  [PASS] Test 11: CRUD completo de Materiales en MySQL verificado.")

    def test_12_crud_puntos_limpios_mysql(self):
        """Verifica CRUD completo (Create, Read, Update, Delete) sobre /api/puntos."""
        admin_token = self.client.post('/api/auth/login', json={
            'email': 'admin@ecocommunity.org',
            'password': 'EcoCommunity2026*'
        }).get_json()['token']
        headers = {'Authorization': f'Bearer {admin_token}'}

        # Create
        res_post = self.client.post('/api/puntos', headers=headers, json={
            'nombre': 'Punto QA Temporal',
            'direccion': 'Calle Pruebas 123',
            'latitud': 40.4200,
            'longitud': -3.7000
        })
        self.assertEqual(res_post.status_code, 201)
        punto_id = res_post.get_json()['id_punto']

        # Read
        res_get = self.client.get(f'/api/puntos/{punto_id}')
        self.assertEqual(res_get.status_code, 200)

        # Update
        res_put = self.client.put(f'/api/puntos/{punto_id}', headers=headers, json={
            'nombre': 'Punto QA Actualizado',
            'capacidad_actual_kg': 120.5
        })
        self.assertEqual(res_put.status_code, 200)

        # Delete
        res_del = self.client.delete(f'/api/puntos/{punto_id}', headers=headers)
        self.assertEqual(res_del.status_code, 200)
        print("  [PASS] Test 12: CRUD completo de Puntos Limpios en MySQL verificado.")

    def test_13_openapi_and_swagger_docs(self):
        """Verifica que la documentación OpenAPI 3.0 y Swagger UI estén disponibles."""
        res_spec = self.client.get('/api/openapi.json')
        self.assertEqual(res_spec.status_code, 200)
        spec = res_spec.get_json()
        self.assertIn('/api/auth/login', spec['paths'])
        self.assertIn('/api/materiales', spec['paths'])

        res_ui = self.client.get('/api/docs')
        self.assertEqual(res_ui.status_code, 200)
        self.assertIn(b'swagger-ui', res_ui.data)
        print("  [PASS] Test 13: Documentación OpenAPI 3.0 (/api/openapi.json) y Swagger UI (/api/docs) verificadas.\n")

if __name__ == '__main__':
    unittest.main()
