/**
 * EcoCommunity QA Automated Test Suite
 * Validates all core functional requirements and API contracts defined in SRS
 */

async function runQATests() {
  const baseUrl = 'http://localhost:3000';
  console.log('====================================================');
  console.log('  ECOCOMMUNITY QA TEST SUITE - EJECUCIÓN DE PRUEBAS  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${details || ''}`);
      failed++;
    }
  }

  try {
    // 1. Test Puntos Limpios & Geofencing Calculation (RF-005)
    console.log('--- Test Suite 1: Puntos Limpios y Georreferenciación (RF-005) ---');
    const resPuntos = await fetch(`${baseUrl}/api/puntos?userLat=40.415363&userLng=-3.707398`);
    const dataPuntos = await resPuntos.json();
    assert(resPuntos.status === 200, 'HTTP Status 200 en /api/puntos');
    assert(Array.isArray(dataPuntos.puntos) && dataPuntos.puntos.length > 0, 'Listado de puntos limpios devuelto');
    const puntoMasCercano = dataPuntos.puntos[0];
    assert(puntoMasCercano.distancia_metros <= 20, 'Cálculo de Haversine correcto: distancia <= 20m para coordenadas exactas');
    assert(puntoMasCercano.dentro_de_geofence === true, 'Bandera dentro_de_geofence activa para proximidad inmediata');

    // 2. Test Clasificación por Código de Barras (RF-003)
    console.log('\n--- Test Suite 2: Clasificación por Código de Barras (RF-003) ---');
    const resBarcode = await fetch(`${baseUrl}/api/ai/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: '7791234567890' }),
    });
    const dataBarcode = await resBarcode.json();
    assert(resBarcode.status === 200, 'HTTP Status 200 en /api/ai/classify');
    assert(dataBarcode.source === 'barcode_database', 'Origen catalogado como barcode_database');
    assert(dataBarcode.categoria === 'Plástico PET', 'Categoría detectada Plástico PET');
    assert(dataBarcode.reciclable === true, 'Material marcado como reciclable');

    // 3. Test Depósito Fuera de Geofence (> 20m) debe ser Rechazado con HTTP 403 (RF-006)
    console.log('\n--- Test Suite 3: Validación Geofencing > 20m (RF-006) ---');
    const resFarDeposit = await fetch(`${baseUrl}/api/entregas/validate-and-deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: 99,
        punto_id: 1,
        material_nombre: 'Botella PET Test',
        categoria: 'Plástico PET',
        peso_kg: 0.1,
        userLat: 40.500000, // Coordenadas lejanas (> 5 km)
        userLng: -3.800000,
        qr_hash: 'ECO-BIN-PLAZA-CENTRAL-01',
      }),
    });
    const dataFarDeposit = await resFarDeposit.json();
    assert(resFarDeposit.status === 403, 'HTTP 403 Rechazo de Geofencing por distancia excesiva');
    assert(dataFarDeposit.distancia_actual_metros > 20, 'Distancia reportada supera los 20 metros permitidos');

    // 4. Test Depósito Válido dentro de Geofence (<= 20m) con QR Válido (RF-007, RF-009, RF-010)
    console.log('\n--- Test Suite 4: Depósito Válido y Emisión de Recibo Criptográfico (RF-007, RF-009, RF-010) ---');
    const resValidDeposit = await fetch(`${baseUrl}/api/entregas/validate-and-deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: 88,
        punto_id: 1,
        material_nombre: 'Lata Aluminio QA Test',
        categoria: 'Aluminio / Latas',
        peso_kg: 0.05,
        puntos_otorgados: 35,
        co2_ahorrado_kg: 0.45,
        userLat: 40.415364, // Exactamente en la Plaza Central
        userLng: -3.707397,
        qr_hash: 'ECO-BIN-PLAZA-CENTRAL-01',
      }),
    });
    const dataValidDeposit = await resValidDeposit.json();
    assert(resValidDeposit.status === 200, 'HTTP 200 Aprobación de entrega en geofence');
    assert(dataValidDeposit.success === true, 'Transacción confirmada con éxito');
    assert(typeof dataValidDeposit.entrega.recibo_digital_hash === 'string', 'Generación de recibo_digital_hash hexadecimal');
    assert(dataValidDeposit.entrega.cadena_custodia_paso === 'depositado', 'Paso de cadena de custodia inicial "depositado"');

    // 5. Test Antifraude: Segundo Depósito Inmediato del Mismo Material debe Rechazarse con HTTP 429 (RF-008)
    console.log('\n--- Test Suite 5: Regla Antifraude Cooldown 24h (RF-008) ---');
    const resFraudDeposit = await fetch(`${baseUrl}/api/entregas/validate-and-deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: 88,
        punto_id: 1,
        material_nombre: 'Lata Aluminio QA Test',
        categoria: 'Aluminio / Latas',
        peso_kg: 0.05,
        userLat: 40.415364,
        userLng: -3.707397,
        qr_hash: 'ECO-BIN-PLAZA-CENTRAL-01',
      }),
    });
    const dataFraudDeposit = await resFraudDeposit.json();
    assert(resFraudDeposit.status === 429, 'HTTP 429 Antifraude Rate Limit activado por depósito duplicado');

    // 6. Test Billetera y Métricas de Impacto (RF-011)
    console.log('\n--- Test Suite 6: Billetera de Ecocoins y Métricas ESG (RF-011) ---');
    const resWallet = await fetch(`${baseUrl}/api/user/wallet`);
    const dataWallet = await resWallet.json();
    assert(resWallet.status === 200, 'HTTP 200 en consulta de Billetera');
    assert(typeof dataWallet.saldo_ecocoins === 'number', 'Saldo numérico de Ecocoins verificado');
    assert(typeof dataWallet.estadisticas_impacto.kg_reciclados === 'number', 'Métrica de kg_reciclados verificada');
    assert(typeof dataWallet.estadisticas_impacto.co2_ahorrado_kg === 'number', 'Métrica de co2_ahorrado_kg verificada');

    // 7. Test Reporte de Cadena de Custodia ESG (RF-014)
    console.log('\n--- Test Suite 7: Reportes de Trazabilidad ESG (RF-014) ---');
    const resESG = await fetch(`${baseUrl}/api/esg/report`);
    const dataESG = await resESG.json();
    assert(resESG.status === 200, 'HTTP 200 en reporte ESG');
    assert(Array.isArray(dataESG.cadena_de_custodia), 'Listado auditable de cadena de custodia disponible');
    assert(Array.isArray(dataESG.marcas_aliadas_esg), 'Desglose de marcas aliadas ESG presente');

  } catch (error: any) {
    console.error('Error general durante la ejecución de pruebas:', error);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`  RESULTADOS FINALES QA: ${passed} APROBADAS | ${failed} FALLIDAS`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runQATests();

