/**
 * HeroThreeJS.tsx — Interfaz Corporativa y Futurista de Economía Circular (16:9)
 *
 * Combina:
 * - Izquierda: Jerarquía tipográfica editorial, CTAs de alto contraste, tarjetas
 *   Glassmorphism de métricas en tiempo real y barra técnica de MÓDULOS.
 * - Derecha: Composición hiperrealista del planeta Tierra acunado por dos manos humanas
 *   integrada con un motor WebGL Three.js en tiempo real que anima:
 *     1. Rotación continua de la capa de nubes volumétricas, nodos de geolocalización
 *        y brillo atmosférico Fresnel sobre la esfera del planeta.
 *     2. Múltiples anillos y órbitas holográficas 3D en verde vibrante con pulsos de
 *        datos digitales fluyendo en tiempo real.
 *     3. Red de constelaciones/nodos laterales y partículas de luz verde y ámbar/dorado
 *        con profundidad de campo y respuesta interactiva al cursor (parallax 3D).
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Sparkles,
  ArrowRight,
  MapPin,
  Coins,
  TreePine,
  Leaf,
} from 'lucide-react';

interface HeroThreeJSProps {
  onNavigate?: (tab: string) => void;
  onScanClick?: () => void;
  walletStats?: {
    kgTotal: number;
    saldo: number;
    co2Total: number;
  };
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// Generador de textura procedural de nubes y destellos continentales para la esfera 3D superpuesta
function createDynamicCloudAndNodeTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  // Bandas suaves de sistemas nubosos translúcidos
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * width;
    const y = 60 + Math.random() * (height - 120);
    const rx = 25 + Math.random() * 95;
    const ry = 8 + Math.random() * 28;

    const grad = ctx.createRadialGradient(x, y, 1, x, y, rx);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(0.5, 'rgba(220, 252, 231, 0.09)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // Pequeños nodos luminosos de actividad ecológica sobre los continentes
  for (let i = 0; i < 95; i++) {
    const x = Math.random() * width;
    const y = 75 + Math.random() * (height - 150);
    const r = 1.5 + Math.random() * 3.5;

    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
    g.addColorStop(0, 'rgba(215, 235, 128, 0.95)');
    g.addColorStop(0.4, 'rgba(74, 222, 128, 0.45)');
    g.addColorStop(1, 'rgba(74, 222, 128, 0)');

    ctx.beginPath();
    ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export const HeroThreeJS: React.FC<HeroThreeJSProps> = ({
  onNavigate,
  onScanClick,
  walletStats,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const visualWrapRef = useRef<HTMLDivElement>(null);
  const [webglSupported] = useState(() => isWebGLAvailable());
  const [activeModule, setActiveModule] = useState<string>('Puntos Limpios');
  const [pulseBoost, setPulseBoost] = useState(false);

  const kgTotal = walletStats?.kgTotal ?? 1.43;
  const saldo = walletStats?.saldo ?? 128;
  const co2Total = walletStats?.co2Total ?? 2.08;

  useEffect(() => {
    if (!mountRef.current || !webglSupported) return;
    const container = mountRef.current;

    // 1. ESCENA Y CÁMARA
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.08, 4.8);
    camera.lookAt(0, 0.05, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 2. GRUPO RAÍZ ALINEADO CON EL PLANETA DE LA COMPOSICIÓN HIPERREALISTA
    const rootGroup = new THREE.Group();
    // El centro del globo en la composición está ligeramente por encima del centro vertical
    rootGroup.position.set(0, 0.23, 0);
    scene.add(rootGroup);

    const globeRadius = 1.04;

    // 3. ESFERA DE NUBES VOLUMÉTRICAS Y NODOS EN ROTACIÓN CONTINUA SOBRE EL PLANETA
    const cloudTex = createDynamicCloudAndNodeTexture();
    const cloudGeo = new THREE.SphereGeometry(globeRadius, 64, 64);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cloudSphere = new THREE.Mesh(cloudGeo, cloudMat);
    cloudSphere.rotation.z = THREE.MathUtils.degToRad(-14);
    rootGroup.add(cloudSphere);

    // 4. HALO ATMOSFÉRICO FRESNEL EN TIEMPO REAL
    const fresnelGeo = new THREE.SphereGeometry(globeRadius * 1.055, 64, 64);
    const fresnelMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColorInner: { value: new THREE.Color(0x38bdf8) },
        uColorOuter: { value: new THREE.Color(0x4ade80) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorInner;
        uniform vec3 uColorOuter;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 3.2);
          float pulse = 0.88 + 0.12 * sin(uTime * 2.0);
          vec3 col = mix(uColorInner, uColorOuter, fresnel);
          gl_FragColor = vec4(col, fresnel * 0.58 * pulse);
        }
      `,
    });
    const fresnelMesh = new THREE.Mesh(fresnelGeo, fresnelMat);
    rootGroup.add(fresnelMesh);

    // 5. SISTEMA DE MÚLTIPLES ÓRBITAS Y ANILLOS HOLOGRÁFICOS DE DATOS EN VERDE VIBRANTE
    const orbitsGroup = new THREE.Group();
    rootGroup.add(orbitsGroup);

    const orbitConfigs = [
      { radius: 1.48, tube: 0.0035, rotX: 1.18, rotY: -0.32, speed: 0.35, color: 0x4ade80, opacity: 0.28 },
      { radius: 1.62, tube: 0.0025, rotX: 1.24, rotY: -0.28, speed: -0.28, color: 0xd7eb80, opacity: 0.22 },
      { radius: 1.34, tube: 0.0028, rotX: 0.85, rotY: 0.42, speed: 0.45, color: 0x22c55e, opacity: 0.18 },
      { radius: 1.74, tube: 0.0020, rotX: 1.12, rotY: -0.36, speed: 0.22, color: 0x86efac, opacity: 0.14 },
    ];

    const orbitRings: Array<{ mesh: THREE.Mesh; speed: number }> = [];

    orbitConfigs.forEach((cfg) => {
      const torusGeo = new THREE.TorusGeometry(cfg.radius, cfg.tube, 16, 180);
      const torusMat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(torusGeo, torusMat);
      ring.rotation.x = cfg.rotX;
      ring.rotation.y = cfg.rotY;
      orbitsGroup.add(ring);
      orbitRings.push({ mesh: ring, speed: cfg.speed });
    });

    // Pulsos de datos digitales viajando sobre las órbitas principales
    const dataPulsesGroup = new THREE.Group();
    orbitsGroup.add(dataPulsesGroup);

    const pulseNodes: Array<{
      mesh: THREE.Mesh;
      radius: number;
      angle: number;
      speed: number;
      rotX: number;
      rotY: number;
    }> = [];

    const pulseGeo = new THREE.SphereGeometry(0.022, 12, 12);
    for (let i = 0; i < 18; i++) {
      const isGold = i % 4 === 0;
      const pulseMat = new THREE.MeshBasicMaterial({
        color: isGold ? 0xfacc15 : 0x86efac,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(pulseGeo, pulseMat);
      const cfg = orbitConfigs[i % orbitConfigs.length];
      pulseNodes.push({
        mesh,
        radius: cfg.radius,
        angle: (i / 18) * Math.PI * 2,
        speed: (0.45 + (i % 3) * 0.2) * (i % 2 === 0 ? 1 : -1),
        rotX: cfg.rotX,
        rotY: cfg.rotY,
      });
      dataPulsesGroup.add(mesh);
    }

    // 6. RED DE CONSTELACIÓN HOLOGRÁFICA (NODOS CONECTADOS EN EL ANILLO EXTERIOR)
    const networkPoints: THREE.Vector3[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = 1.45 + (Math.random() - 0.5) * 0.35;
      const v = new THREE.Vector3(
        Math.cos(a) * r,
        (Math.random() - 0.5) * 0.28,
        Math.sin(a) * r
      );
      v.applyEuler(new THREE.Euler(1.16, -0.3, 0));
      networkPoints.push(v);
    }

    const linePositions: number[] = [];
    for (let i = 0; i < networkPoints.length; i++) {
      const p1 = networkPoints[i];
      const p2 = networkPoints[(i + 1) % networkPoints.length];
      const p3 = networkPoints[(i + 3) % networkPoints.length];
      linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      if (i % 2 === 0) {
        linePositions.push(p1.x, p1.y, p1.z, p3.x, p3.y, p3.z);
      }
    }
    const netGeo = new THREE.BufferGeometry();
    netGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const netMat = new THREE.LineBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    const networkLines = new THREE.LineSegments(netGeo, netMat);
    orbitsGroup.add(networkLines);

    // 7. PARTÍCULAS BRILLANTES (VERDE ESMERALDA + DESTELLOS ÁMBAR/DORADOS)
    const particleCount = 160;
    const pPositions = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);

    const colorGreen = new THREE.Color(0x4ade80);
    const colorLime = new THREE.Color(0xd7eb80);
    const colorGold = new THREE.Color(0xfbbf24);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 1.15 + Math.random() * 1.05;
      const ySpread = (Math.random() - 0.5) * 1.65;

      pPositions[i * 3] = Math.cos(theta) * r;
      pPositions[i * 3 + 1] = ySpread;
      pPositions[i * 3 + 2] = Math.sin(theta) * r * 0.65;

      const c = i % 5 === 0 ? colorGold : i % 2 === 0 ? colorLime : colorGreen;
      pColors[i * 3] = c.r;
      pColors[i * 3 + 1] = c.g;
      pColors[i * 3 + 2] = c.b;
    }

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    particlesGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

    const particlesMat = new THREE.PointsMaterial({
      size: 0.036,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    rootGroup.add(particleSystem);

    // 8. INTERACCIÓN CON EL CURSOR (PARALLAX 3D DE LA IMAGEN Y EL HOLOGRAMA)
    let targetX = 0;
    let targetY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetX = nx;
      targetY = ny;
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerleave', handlePointerLeave);

    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 9. BUCLE DE ANIMACIÓN EN TIEMPO REAL
    const clock = new THREE.Clock();
    let rafId = 0;
    let smoothX = 0;
    let smoothY = 0;

    const eulerHelper = new THREE.Euler();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const t = clock.getElapsedTime();
      fresnelMat.uniforms.uTime.value = t;

      // Suavizado de parallax
      smoothX += (targetX - smoothX) * 0.06;
      smoothY += (targetY - smoothY) * 0.06;

      // Rotación continua de las nubes y nodos sobre el globo
      cloudSphere.rotation.y = t * 0.14 + smoothX * 0.35;

      // Flotación / respiración orgánica sincronizada con el contenedor visual
      const breathe = Math.sin(t * 1.5) * 0.035;
      rootGroup.position.y = 0.23 + breathe;
      rootGroup.rotation.y = smoothX * 0.26;
      rootGroup.rotation.x = smoothY * 0.16;

      if (visualWrapRef.current) {
        const tx = smoothX * 10;
        const ty = smoothY * 8 + Math.sin(t * 1.5) * 5;
        const rx = -smoothY * 4.5;
        const ry = smoothX * 6.5;
        visualWrapRef.current.style.transform = `perspective(1100px) translate3d(${tx}px, ${ty}px, 0) rotateX(${rx}deg) rotateY(${ry}deg)`;
      }

      // Rotación de los anillos orbitales y flujo de pulsos de datos
      orbitRings.forEach((item, idx) => {
        item.mesh.rotation.z = t * item.speed + idx * 0.8;
      });

      pulseNodes.forEach((p) => {
        const a = p.angle + t * p.speed;
        p.mesh.position.set(Math.cos(a) * p.radius, Math.sin(a) * p.radius, 0);
        eulerHelper.set(p.rotX, p.rotY, 0);
        p.mesh.position.applyEuler(eulerHelper);
      });

      networkLines.rotation.z = -t * 0.08;
      particleSystem.rotation.y = t * 0.07;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerleave', handlePointerLeave);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      cloudTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [webglSupported]);

  const modulesList: Array<{ label: string; tab: string }> = [
    { label: 'Puntos Limpios', tab: 'mapa' },
    { label: 'Escáner IA Gemini', tab: 'escanear' },
    { label: 'Billetera Ecocoins', tab: 'billetera' },
    { label: 'Auditoría ESG', tab: 'impacto' },
  ];

  return (
    <section
      className="relative rounded-[24px] overflow-hidden border border-emerald-500/20 shadow-[0_25px_80px_rgba(0,0,0,0.85)]"
      style={{
        backgroundColor: '#050b07',
        backgroundImage: `
          radial-gradient(rgba(74, 222, 128, 0.16) 1px, transparent 1px),
          linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          radial-gradient(circle at 73% 48%, rgba(16, 185, 129, 0.22) 0%, rgba(5, 11, 7, 0.96) 64%)
        `,
        backgroundSize: '28px 28px, 56px 56px, 56px 56px, 100% 100%',
        minHeight: '640px',
      }}
    >
      {/* Marco superior sutil tipo ventana de plataforma corporativa futurista */}
      <div className="relative z-20 flex items-center justify-between px-6 py-3 border-b border-white/[0.07] bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/25" />
          <span className="ml-2 text-[11px] font-mono text-white/45 tracking-wider">
            ecocommunity://earth-telemetry-v4.2
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>TELEMETRÍA SATELITAL ACTIVA</span>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL 16:9 DE DOS COLUMNAS */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-center min-h-[590px] px-6 sm:px-12 lg:px-14 py-10 gap-8">
        {/* ═══════════════════════════════════════════════════════════════════
            SECCIÓN IZQUIERDA: JERARQUÍA EDITORIAL, CONTROLES, MÉTRICAS Y MÓDULOS
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 space-y-6 text-left relative z-20">
          {/* Categoría técnica superior */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0b2214]/90 border border-emerald-400/30 text-[11px] font-mono font-semibold text-[#86efac] tracking-[0.14em] uppercase shadow-[0_0_25px_rgba(34,197,94,0.18)]">
            <span className="text-emerald-400">●</span>
            <span>ECONOMÍA CIRCULAR GEOLOCALIZADA</span>
          </div>

          {/* Título Principal Editorial */}
          <h1 className="text-4xl sm:text-5xl xl:text-[56px] font-extrabold tracking-[-0.03em] leading-[1.06]">
            <span className="text-white block drop-shadow-[0_2px_18px_rgba(255,255,255,0.12)]">
              Recicla. Impacta.
            </span>
            <span className="text-[#9ca3af] block mt-1">
              Transforma tu{' '}
              <span
                className="font-extrabold"
                style={{
                  background: 'linear-gradient(90deg, #d7eb80 0%, #D4AF37 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Entorno.
              </span>
            </span>
          </h1>

          {/* Descripción */}
          <p className="text-sm sm:text-[15px] text-white/75 max-w-xl leading-relaxed font-normal">
            Una plataforma ciudadana para mapear reciclaje, validar entregas con IA Gemini y
            auditar impacto ambiental:{' '}
            <strong className="text-white font-semibold">
              cada empaque reciclado es un pin en el mapa
            </strong>
            , y cada pin alimenta recompensas Ecocoins y métricas ESG en tiempo real.
          </p>

          {/* BOTONES DE ACCIÓN (Centro-Izquierda) */}
          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            {/* Botón Principal Blanco Sólido */}
            <button
              type="button"
              onClick={onScanClick}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-[#070d09] text-xs sm:text-sm font-semibold tracking-wider uppercase shadow-[0_10px_30px_rgba(255,255,255,0.22)] hover:bg-[#d7eb80] hover:scale-[1.02] active:scale-[0.99] transition-all cursor-pointer"
            >
              <span>INICIAR SESIÓN Y USAR LA APP</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Botón Secundario Oscuro con Borde Verde Translúcido */}
            <button
              type="button"
              onClick={() => onNavigate?.('mapa')}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-[#0b1911]/90 text-white border border-emerald-400/35 hover:border-emerald-400/80 hover:bg-[#11281b] text-xs sm:text-sm font-semibold tracking-wider uppercase shadow-[0_0_25px_rgba(16,185,129,0.15)] transition-all cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>☉ EXPLORAR PUNTOS LIMPIOS</span>
            </button>
          </div>

          {/* TARJETAS DE DATOS GLASSMORPHISM (Métricas en Tiempo Real) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 max-w-xl">
            {/* Tarjeta 1: Desviado */}
            <div className="p-3.5 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/10 hover:border-emerald-400/35 transition-colors">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-300/90">
                <TreePine className="w-3.5 h-3.5 text-[#d7eb80]" />
                <span>⏃ Desviado</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white tabular-nums mt-1">
                {kgTotal} kg
              </div>
              <span className="text-[11px] text-white/55 block mt-0.5 leading-snug">
                Material desviado de vertedero
              </span>
            </div>

            {/* Tarjeta 2: Billetera */}
            <div className="p-3.5 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/10 hover:border-emerald-400/35 transition-colors">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-300/90">
                <Coins className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>☉ Billetera</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#d7eb80] tabular-nums mt-1">
                {saldo} EC
              </div>
              <span className="text-[11px] text-white/55 block mt-0.5 leading-snug">
                Ecocoins en tu billetera
              </span>
            </div>

            {/* Tarjeta 3: CO2 Ahorrado */}
            <div className="p-3.5 rounded-2xl bg-white/[0.045] backdrop-blur-md border border-white/10 hover:border-emerald-400/35 transition-colors">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-300/90">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                <span>∅ CO₂ Ahorrado</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white tabular-nums mt-1">
                {co2Total} kg
              </div>
              <span className="text-[11px] text-white/55 block mt-0.5 leading-snug">
                Huella de CO₂ compensada
              </span>
            </div>
          </div>

          {/* PIE DE PÁGINA (MÓDULOS INDUSTRIAL-TECNOLÓGICOS) */}
          <div className="pt-4 border-t border-white/10 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-white/50 mr-1">
                MÓDULOS:
              </span>
              {modulesList.map((mod) => {
                const isSelected = activeModule === mod.label;
                return (
                  <button
                    key={mod.label}
                    type="button"
                    onClick={() => {
                      setActiveModule(mod.label);
                      onNavigate?.(mod.tab);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-500/20 text-[#d7eb80] border-emerald-400/60 shadow-[0_0_15px_rgba(74,222,128,0.2)]'
                        : 'bg-white/[0.03] text-white/70 border-white/15 hover:text-white hover:border-emerald-400/40'
                    }`}
                  >
                    [ {mod.label} ]
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SECCIÓN VISUAL 3D (Derecha): TIERRA HIPERREALISTA + MANOS + HOLOGRAMA THREE.JS
           ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 relative flex items-center justify-center min-h-[450px] sm:min-h-[540px] select-none">
          {/* Resplandor ambiental Bloom controlado detrás del planeta */}
          <div
            className="pointer-events-none absolute w-[380px] h-[380px] sm:w-[490px] sm:h-[490px] rounded-full blur-3xl transition-opacity duration-500"
            style={{
              background:
                'radial-gradient(circle, rgba(34, 197, 94, 0.28) 0%, rgba(16, 185, 129, 0.10) 48%, rgba(5, 11, 7, 0) 75%)',
              opacity: pulseBoost ? 1 : 0.8,
            }}
            aria-hidden="true"
          />

          {/* Contenedor con inclinación 3D sincronizada entre el render hiperrealista y Three.js */}
          <div
            ref={visualWrapRef}
            className="relative w-full max-w-[640px] h-[440px] sm:h-[520px] flex items-center justify-center transition-transform duration-75 ease-out"
          >
            {/* Capa Base Hiperrealista: Planeta Tierra con continentes, nubes y manos humanas detalladas (PNG transparente) */}
            <img
              src="/images/earth_hands_hero.png"
              alt="Planeta Tierra hiperrealista sostenido con delicadeza por dos manos humanas rodeado de órbitas holográficas"
              className="pointer-events-none w-full h-full object-contain scale-[1.12] sm:scale-[1.18]"
              style={{
                filter: pulseBoost
                  ? 'saturate(1.22) contrast(1.08) drop-shadow(0 0 35px rgba(74, 222, 128, 0.35))'
                  : 'saturate(1.1) contrast(1.05) drop-shadow(0 12px 32px rgba(0, 0, 0, 0.55))',
              }}
            />

            {/* Capa WebGL Three.js en Tiempo Real: Órbitas holográficas 3D, nubes dinámicas y partículas */}
            {webglSupported && (
              <div
                ref={mountRef}
                className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-10"
                title="Interactúa con el holograma 3D del planeta Tierra"
              />
            )}
          </div>

          {/* ETIQUETA DE INTERACCIÓN (Esquina inferior derecha) */}
          <button
            type="button"
            onClick={() => setPulseBoost((prev) => !prev)}
            className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#07120b]/90 border border-emerald-400/35 hover:border-[#d7eb80] backdrop-blur-md text-xs font-mono text-white shadow-[0_0_24px_rgba(34,197,94,0.25)] transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#d7eb80]" />
            <span>✨ Tierra 3D • Interactivo</span>
          </button>
        </div>
      </div>
    </section>
  );
};
