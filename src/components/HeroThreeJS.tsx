/**
 * HeroThreeJS.tsx — EcoCommunity Hero Section con animación 3D (Three.js)
 *
 * PALETA DE MARCA:
 *   Fondo:         #0d1f0f  (negro bosque profundo)
 *   Planeta agua:  #1a6b8a  (azul océano)
 *   Planeta tierra:#2d8c3a  (verde canopy — marca principal)
 *   Atmósfera:     #d7eb80  (lime canopy — acento marca)
 *   Manos:         #c8936b  (cobre orgánico neutro)
 *   Estrellas:     #ffffff  (blanco)
 *   Nubes:         #e8f4e9  (blanco verdoso)
 *
 * CÓMO AJUSTAR:
 *   - Velocidades: busca ANIMATION_CONFIG al inicio del useEffect
 *   - Colores:     busca BRAND_COLORS
 *   - Manos:       la función buildHand() es 100% procedural y reemplazable
 *                  por loader.load('modelo.glb') del GLTFLoader de Three.js
 *
 * DEPENDENCIAS: npm install three @types/three
 */

import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Leaf, ArrowRight, Recycle } from 'lucide-react';

// ─── CONFIGURACIÓN FÁCIL DE AJUSTAR ────────────────────────────────────────

const BRAND_COLORS = {
  bg:          0x0d1f0f,  // fondo escena
  planetWater: 0x1a6b8a,  // océanos del planeta
  planetLand:  0x2d8c3a,  // tierra / vegetación
  planetSnow:  0xe8f4e9,  // nubes y casquetes polares
  atmosphere:  0xd7eb80,  // halo atmosférico (lime canopy)
  hands:       0xc8936b,  // manos (cobre orgánico)
  handsShadow: 0x9b6040,  // sombra manos
  starColor:   0xffffff,  // estrellas
  rimLight:    0xd7eb80,  // rim light (lime)
  fillLight:   0x3aa8e0,  // fill light (azul cielo)
};

const ANIMATION_CONFIG = {
  planetRotSpeed:   0.0012, // velocidad de rotación del planeta (rad/frame)
  floatAmplitude:   0.08,   // amplitud flotación vertical de las manos
  floatSpeed:       0.6,    // velocidad de la animación de respiración (Hz)
  breatheScale:     0.012,  // escala de "respiración" de las manos
  cameraZ:          3.8,    // distancia de la cámara
  pixelRatioMax:    1.5,    // límite de devicePixelRatio (rendimiento)
};

// ─── DETECCIÓN WebGL ────────────────────────────────────────────────────────

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// ─── BUILDER PROCEDURAL DE MANO ─────────────────────────────────────────────
/**
 * Crea una mano procedural usando BoxGeometry y CylinderGeometry.
 * Para reemplazar con un modelo GLB, elimina esta función y usa:
 *
 *   import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
 *   const loader = new GLTFLoader();
 *   loader.load('/models/hand.glb', (gltf) => {
 *     const hand = gltf.scene;
 *     scene.add(hand);
 *   });
 *
 * @param side  'left' | 'right' — espeja la geometría
 * @param mat   Material de la mano
 */
function buildHand(side: 'left' | 'right', mat: THREE.MeshStandardMaterial): THREE.Group {
  const group = new THREE.Group();
  const mirror = side === 'left' ? -1 : 1;

  // Palma
  const palmGeo = new THREE.BoxGeometry(0.42, 0.14, 0.52);
  const palm = new THREE.Mesh(palmGeo, mat);
  palm.position.set(0, 0, 0);
  palm.rotation.x = -0.3;  // ligera inclinación hacia arriba (sosteniendo)
  group.add(palm);

  // Configuración de dedos [offsetX, longitud, rotX]
  const fingers: [number, number, number][] = [
    [-0.14, 0.26, -0.1],  // índice
    [-0.047, 0.30, -0.05], // medio
    [ 0.047, 0.28, -0.05], // anular
    [ 0.14, 0.22, -0.1],  // meñique
  ];

  fingers.forEach(([ox, len, rx]) => {
    const geo = new THREE.CylinderGeometry(0.028, 0.034, len, 6);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ox, 0.04, -0.26 - len / 2);
    mesh.rotation.x = rx - 0.3;
    group.add(mesh);

    // Punta redondeada del dedo
    const tipGeo = new THREE.SphereGeometry(0.028, 6, 6);
    const tip = new THREE.Mesh(tipGeo, mat);
    tip.position.set(ox, 0.04 + Math.sin(rx - 0.3) * len / 2, -0.26 - len);
    group.add(tip);
  });

  // Pulgar (separado y angled)
  const thumbLen = 0.20;
  const thumbGeo = new THREE.CylinderGeometry(0.030, 0.038, thumbLen, 6);
  const thumb = new THREE.Mesh(thumbGeo, mat);
  thumb.position.set(mirror * 0.22, 0.02, -0.08);
  thumb.rotation.set(-0.2, 0, mirror * -0.6);
  group.add(thumb);

  const thumbTipGeo = new THREE.SphereGeometry(0.030, 6, 6);
  const thumbTip = new THREE.Mesh(thumbTipGeo, mat);
  thumbTip.position.set(mirror * 0.28, 0.06, -0.18);
  group.add(thumbTip);

  // Muñeca
  const wristGeo = new THREE.CylinderGeometry(0.09, 0.10, 0.18, 8);
  const wrist = new THREE.Mesh(wristGeo, mat);
  wrist.position.set(0, -0.02, 0.22);
  wrist.rotation.x = Math.PI / 2;
  group.add(wrist);

  return group;
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

interface HeroThreeJSProps {
  onNavigate?: (tab: string) => void;
  onScanClick?: () => void;
}

export const HeroThreeJS: React.FC<HeroThreeJSProps> = ({ onNavigate, onScanClick }) => {
  const mountRef    = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef      = useRef<number>(0);
  const clockRef    = useRef(new THREE.Clock());
  const webglOk     = useRef(isWebGLAvailable());

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current.domElement.remove();
      rendererRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!mountRef.current || !webglOk.current) return;

    const mount = mountRef.current;

    // ── Escena, cámara, renderer ───────────────────────────────────────────
    const scene  = new THREE.Scene();
    scene.background = new THREE.Color(BRAND_COLORS.bg);

    // Niebla para profundidad
    scene.fog = new THREE.FogExp2(BRAND_COLORS.bg, 0.18);

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.3, ANIMATION_CONFIG.cameraZ);
    camera.lookAt(0, 0.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, ANIMATION_CONFIG.pixelRatioMax));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Iluminación ────────────────────────────────────────────────────────
    // Luz ambiental suave
    const ambient = new THREE.AmbientLight(0x224422, 0.6);
    scene.add(ambient);

    // Luz principal (sol) desde arriba-izquierda
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(-3, 4, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    scene.add(sun);

    // Rim light (lime canopy) desde atrás — firma de marca
    const rimLight = new THREE.DirectionalLight(BRAND_COLORS.rimLight, 1.2);
    rimLight.position.set(2, -1, -4);
    scene.add(rimLight);

    // Fill light (azul) desde abajo
    const fillLight = new THREE.PointLight(BRAND_COLORS.fillLight, 0.6, 8);
    fillLight.position.set(0, -2, 1);
    scene.add(fillLight);

    // ── ESTRELLAS (campo de partículas) ───────────────────────────────────
    const starCount = 800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 40;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: BRAND_COLORS.starColor,
      size:  0.04,
      transparent: true,
      opacity: 0.7,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── PLANETA ────────────────────────────────────────────────────────────
    const planetGroup = new THREE.Group();
    scene.add(planetGroup);

    // Esfera base (océanos)
    const planetGeo  = new THREE.SphereGeometry(0.72, 48, 48);
    const oceanMat   = new THREE.MeshStandardMaterial({
      color:     BRAND_COLORS.planetWater,
      roughness: 0.4,
      metalness: 0.1,
    });
    const planetMesh = new THREE.Mesh(planetGeo, oceanMat);
    planetMesh.castShadow    = true;
    planetMesh.receiveShadow = true;
    planetGroup.add(planetMesh);

    // Manchas de tierra procedurales (usando icosaedros de baja poli)
    const landMat = new THREE.MeshStandardMaterial({
      color:     BRAND_COLORS.planetLand,
      roughness: 0.85,
      metalness: 0.0,
    });

    // Distribución de masas de tierra (posición polar + acimut, tamaño)
    const landPatches: [number, number, number][] = [
      [ 0.5,  1.1,  0.30],  // continente norte
      [-0.6,  0.4,  0.25],  // continente sur
      [ 0.2, -0.8,  0.22],  // Asia-Pacífico
      [ 0.9,  2.8,  0.18],  // América
      [-0.3,  2.0,  0.14],  // Africa
      [ 0.1, -1.5,  0.10],  // Australia
      [-0.8,  1.4,  0.09],  // Antártida
    ];

    landPatches.forEach(([phi, theta, size]) => {
      const landGeo  = new THREE.IcosahedronGeometry(size, 1);
      const land     = new THREE.Mesh(landGeo, landMat);
      // Proyectar sobre la superficie del planeta
      const r = 0.72 + size * 0.3;
      land.position.setFromSphericalCoords(r, Math.PI / 2 + phi, theta);
      land.lookAt(0, 0, 0);  // rotar para que se aplane sobre la esfera
      land.castShadow = true;
      planetGroup.add(land);
    });

    // Nubes (esfera ligeramente mayor, semitransparente)
    const cloudGeo = new THREE.SphereGeometry(0.75, 32, 32);
    const cloudMat = new THREE.MeshStandardMaterial({
      color:       BRAND_COLORS.planetSnow,
      transparent: true,
      opacity:     0.18,
      roughness:   1.0,
      metalness:   0.0,
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    planetGroup.add(clouds);

    // Capa de atmósfera (halo lime canopy)
    const atmoGeo = new THREE.SphereGeometry(0.84, 32, 32);
    const atmoMat = new THREE.MeshStandardMaterial({
      color:       BRAND_COLORS.atmosphere,
      transparent: true,
      opacity:     0.08,
      side:        THREE.FrontSide,
      roughness:   1.0,
      metalness:   0.0,
    });
    const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    planetGroup.add(atmosphere);

    // Halo de borde (rim glow — esfera más grande, BackSide)
    const glowGeo = new THREE.SphereGeometry(0.92, 24, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color:       BRAND_COLORS.atmosphere,
      transparent: true,
      opacity:     0.06,
      side:        THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    planetGroup.add(glow);

    // Posición del planeta (centro-alto)
    planetGroup.position.set(0, 0.55, 0);

    // ── MANOS PROCEDURALES ─────────────────────────────────────────────────
    const handMat = new THREE.MeshStandardMaterial({
      color:     BRAND_COLORS.hands,
      roughness: 0.75,
      metalness: 0.05,
    });

    const handsGroup = new THREE.Group();
    scene.add(handsGroup);
    handsGroup.position.set(0, -0.55, 0.3);

    // Mano izquierda
    const leftHand = buildHand('left', handMat);
    leftHand.position.set(-0.38, 0, 0);
    leftHand.rotation.set(0.1, 0.15, -0.08);
    leftHand.castShadow = true;
    handsGroup.add(leftHand);

    // Mano derecha (espejada)
    const rightHand = buildHand('right', handMat);
    rightHand.position.set( 0.38, 0, 0);
    rightHand.rotation.set(0.1, -0.15, 0.08);
    rightHand.castShadow = true;
    handsGroup.add(rightHand);

    // ── PARTÍCULAS DE BRILLO (polvo sostenible alrededor del planeta) ──────
    const dustCount = 120;
    const dustPos   = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 0.9 + Math.random() * 0.4;
      dustPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      dustPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 0.55;
      dustPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color:       BRAND_COLORS.atmosphere,
      size:        0.025,
      transparent: true,
      opacity:     0.5,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // ── IntersectionObserver: pausa cuando el hero sale del viewport ───────
    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    observer.observe(mount);

    // ── Resize handler ─────────────────────────────────────────────────────
    const handleResize = () => {
      if (!mount || !rendererRef.current) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ── Mouse parallax suave ───────────────────────────────────────────────
    let mouseX = 0, mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
      mouseY = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
    };
    mount.addEventListener('mousemove', handleMouseMove);

    // ── Loop de animación ──────────────────────────────────────────────────
    let frameCount = 0;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsed = clockRef.current.getElapsedTime();
      frameCount++;

      // Rotación del planeta
      planetGroup.rotation.y += ANIMATION_CONFIG.planetRotSpeed;
      // Las nubes giran ligeramente más rápido (efecto capas)
      clouds.rotation.y += ANIMATION_CONFIG.planetRotSpeed * 0.4;

      // Flotación "respiración" de las manos
      const breathe = Math.sin(elapsed * ANIMATION_CONFIG.floatSpeed * Math.PI * 2);
      handsGroup.position.y =
        -0.55 + breathe * ANIMATION_CONFIG.floatAmplitude;
      handsGroup.scale.setScalar(
        1.0 + breathe * ANIMATION_CONFIG.breatheScale
      );

      // Ligera oscilación del planeta (acompañando las manos)
      planetGroup.position.y = 0.55 + breathe * ANIMATION_CONFIG.floatAmplitude * 0.6;

      // Rotación de las estrellas (muy lenta, sensación espacial)
      stars.rotation.y = elapsed * 0.008;
      stars.rotation.x = elapsed * 0.004;

      // Pulso del halo atmosférico
      const pulse = 0.06 + Math.sin(elapsed * 1.2) * 0.02;
      glowMat.opacity = pulse;

      // Polvo orbital
      dust.rotation.y = elapsed * 0.1;

      // Parallax de cámara (solo en desktop)
      if (window.matchMedia('(pointer: fine)').matches) {
        camera.position.x += (mouseX * 0.25 - camera.position.x) * 0.03;
        camera.position.y += (-mouseY * 0.15 + 0.3 - camera.position.y) * 0.03;
        camera.lookAt(0, 0.3, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      mount.removeEventListener('mousemove', handleMouseMove);

      // Liberar geometrías y materiales
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
    };
  }, [cleanup]);

  // ── FALLBACK estático si no hay WebGL ────────────────────────────────────
  if (!webglOk.current) {
    return (
      <div
        className="relative rounded-[20px] overflow-hidden min-h-[560px] flex flex-col items-center justify-center text-center px-6"
        style={{ background: 'linear-gradient(135deg, #0d1f0f 0%, #1a3d1a 50%, #0d2818 100%)' }}
      >
        <div className="text-6xl mb-4">🌍</div>
        <HeroContent onNavigate={onNavigate} onScanClick={onScanClick} />
      </div>
    );
  }

  return (
    <div className="relative rounded-[20px] overflow-hidden" style={{ minHeight: '580px' }}>
      {/* Canvas Three.js */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
        style={{ touchAction: 'pan-y' }}
      />

      {/* Gradiente inferior para legibilidad del texto */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(13,31,15,0.82) 0%, rgba(13,31,15,0.45) 55%, rgba(13,31,15,0.08) 100%)',
        }}
      />

      {/* Contenido textual sobre el canvas */}
      <div className="relative z-10 h-full flex flex-col justify-center px-8 sm:px-14 py-16 max-w-xl">
        <HeroContent onNavigate={onNavigate} onScanClick={onScanClick} />
      </div>

      {/* Badge inferior derecho */}
      <div
        className="absolute bottom-6 right-6 z-10 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(215,235,128,0.15)', backdropFilter: 'blur(8px)', color: '#d7eb80', border: '1px solid rgba(215,235,128,0.3)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#d7eb80] animate-pulse" />
        Escena 3D en tiempo real
      </div>
    </div>
  );
};

// ─── Subcomponente: texto hero (reutilizable en fallback) ────────────────────

interface HeroContentProps {
  onNavigate?: (tab: string) => void;
  onScanClick?: () => void;
}

const HeroContent: React.FC<HeroContentProps> = ({ onNavigate, onScanClick }) => (
  <div className="space-y-5">
    {/* Badge */}
    <span
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase"
      style={{ background: 'rgba(215,235,128,0.15)', backdropFilter: 'blur(8px)', color: '#d7eb80', border: '1px solid rgba(215,235,128,0.25)' }}
    >
      <Leaf className="w-3.5 h-3.5" />
      Economía Circular Comunitaria
    </span>

    {/* Headline */}
    <h1
      className="text-4xl sm:text-5xl font-bold leading-[1.08] tracking-tight text-white"
      style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
    >
      Recicla.{' '}
      <span style={{ color: '#d7eb80' }}>Impacta.</span>
      <br />
      Transforma tu Entorno.
    </h1>

    {/* Subtítulo */}
    <p className="text-base text-white/75 max-w-sm leading-relaxed">
      La plataforma ciudadana que recompensa cada empaque reciclado con
      visión artificial Gemini y puntos limpios con geofence.
    </p>

    {/* CTAs */}
    <div className="flex flex-wrap gap-3 pt-2">
      <button
        onClick={onScanClick}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95"
        style={{ background: '#d7eb80', color: '#1a1a1a' }}
      >
        <Recycle className="w-4 h-4" />
        Escanear Ahora
      </button>

      <button
        onClick={() => onNavigate?.('impacto')}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all hover:bg-white/15"
        style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
      >
        Ver Impacto ESG
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>

    {/* Micro-stats */}
    <div className="flex gap-6 pt-3">
      {[
        { label: 'Usuarios activos',  value: '2.4k' },
        { label: 'Kg desviados',      value: '18.7t' },
        { label: 'CO₂ compensado',    value: '34t'  },
      ].map(({ label, value }) => (
        <div key={label}>
          <div className="text-xl font-bold text-white tabular-nums" style={{ color: '#d7eb80' }}>
            {value}
          </div>
          <div className="text-[11px] text-white/50 font-medium leading-tight">{label}</div>
        </div>
      ))}
    </div>
  </div>
);
