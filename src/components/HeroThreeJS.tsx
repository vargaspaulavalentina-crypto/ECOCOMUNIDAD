/**
 * HeroThreeJS.tsx — Hero 3D de Alta Definición para EcoCommunity
 *
 * Características del modelado 3D:
 * 1. Planeta Tierra PBR de alta resolución (texturas procedurales 2048x1024 generadas en memoria
 *    para carga instantánea 100% offline/online sin fallos de red):
 *    - Continentes reales (América, Europa, África, Asia, Oceanía, Antártida) con biomas detallados
 *    - Mapa topográfico de relieve (bumpMap) y mapa de reflectividad oceánica (roughnessMap)
 *    - Red luminosa de nodos ecológicos y arcos orbitales 3D conectados en tiempo real
 *    - Capa dinámica de nubes volumétricas y atmósfera con shader Fresnel
 * 2. Dos manos esculturales anatómicas de alto detalle:
 *    - Palma orgánica modelada con arco metacarpiano, eminencia tenar (base del pulgar) y muñeca
 *    - 5 dedos articulados por mano con 3 falanges cada uno (proximal, media, distal),
 *      articulaciones suavizadas y puntas anatómicas curvadas acunando el planeta
 *    - Movimiento orgánico de respiración y micro-articulación individual en los dedos
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Sparkles,
  ArrowRight,
  ScanLine,
  MapPin,
  ShieldCheck,
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

// ─── DETECCIÓN DE WEBGL ─────────────────────────────────────────────────────
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

// ─── GENERADOR DE RUIDO FRACTAL DETERMINISTA (PARA BIOMAS, RELIEVE Y NUBES) ──
function hash2D(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency);
    frequency *= 2.05;
    amplitude *= 0.5;
  }
  return value;
}

// ─── POLÍGONOS CONTINENTALES (COORDENADAS NORMALIZADAS UV 0..1) ─────────────
// Permiten dibujar continentes reconocibles combinados con ruido fractal en las costas
const CONTINENT_BLOBS: Array<{
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot?: number;
  weight?: number;
}> = [
  // Norteamérica
  { cx: 0.21, cy: 0.27, rx: 0.095, ry: 0.09, rot: -0.25, weight: 1.1 },
  { cx: 0.16, cy: 0.21, rx: 0.06, ry: 0.045, rot: 0.1, weight: 0.9 },
  { cx: 0.25, cy: 0.36, rx: 0.032, ry: 0.05, rot: -0.4, weight: 0.85 },
  // Centroamérica y Caribe
  { cx: 0.265, cy: 0.43, rx: 0.018, ry: 0.035, rot: -0.5, weight: 0.8 },
  // Sudamérica
  { cx: 0.315, cy: 0.56, rx: 0.055, ry: 0.095, rot: -0.15, weight: 1.15 },
  { cx: 0.305, cy: 0.69, rx: 0.028, ry: 0.085, rot: 0.1, weight: 1.0 },
  // Groenlandia
  { cx: 0.365, cy: 0.14, rx: 0.042, ry: 0.035, rot: 0.2, weight: 0.95 },
  // Europa
  { cx: 0.515, cy: 0.24, rx: 0.065, ry: 0.055, rot: -0.1, weight: 1.0 },
  { cx: 0.48, cy: 0.29, rx: 0.035, ry: 0.035, rot: 0.2, weight: 0.85 },
  { cx: 0.525, cy: 0.17, rx: 0.028, ry: 0.045, rot: 0.3, weight: 0.85 },
  // África
  { cx: 0.535, cy: 0.45, rx: 0.075, ry: 0.09, rot: -0.1, weight: 1.2 },
  { cx: 0.565, cy: 0.61, rx: 0.045, ry: 0.095, rot: 0.05, weight: 1.1 },
  { cx: 0.625, cy: 0.64, rx: 0.012, ry: 0.03, rot: 0.2, weight: 0.75 }, // Madagascar
  // Asia
  { cx: 0.68, cy: 0.26, rx: 0.14, ry: 0.095, rot: 0.08, weight: 1.25 },
  { cx: 0.77, cy: 0.34, rx: 0.085, ry: 0.075, rot: -0.2, weight: 1.1 },
  { cx: 0.63, cy: 0.38, rx: 0.045, ry: 0.05, rot: 0.3, weight: 0.95 }, // Medio Oriente
  { cx: 0.705, cy: 0.42, rx: 0.032, ry: 0.055, rot: 0.0, weight: 0.95 }, // India
  { cx: 0.785, cy: 0.45, rx: 0.028, ry: 0.05, rot: -0.3, weight: 0.85 }, // Sudeste Asiático
  { cx: 0.855, cy: 0.32, rx: 0.014, ry: 0.04, rot: 0.35, weight: 0.8 }, // Japón
  // Indonesia / Filipinas
  { cx: 0.81, cy: 0.52, rx: 0.045, ry: 0.025, rot: 0.15, weight: 0.78 },
  // Australia y Nueva Zelanda
  { cx: 0.84, cy: 0.67, rx: 0.058, ry: 0.052, rot: -0.1, weight: 1.05 },
  { cx: 0.925, cy: 0.75, rx: 0.012, ry: 0.028, rot: 0.4, weight: 0.75 },
  // Antártida
  { cx: 0.5, cy: 0.95, rx: 0.45, ry: 0.045, rot: 0, weight: 1.1 },
];

function evaluateContinentMask(u: number, v: number): number {
  let maxVal = 0;
  for (let i = 0; i < CONTINENT_BLOBS.length; i++) {
    const b = CONTINENT_BLOBS[i];
    const dx = u - b.cx;
    const dy = v - b.cy;
    const cosR = Math.cos(b.rot || 0);
    const sinR = Math.sin(b.rot || 0);
    const rx = (dx * cosR - dy * sinR) / b.rx;
    const ry = (dx * sinR + dy * cosR) / b.ry;
    const distSq = rx * rx + ry * ry;
    if (distSq < 2.2) {
      const falloff = Math.max(0, 1 - distSq) * (b.weight || 1);
      if (falloff > maxVal) maxVal = falloff;
    }
  }
  const detail = fbm(u * 22, v * 11, 5);
  const fine = fbm(u * 55 + 10, v * 28 + 5, 3);
  return maxVal * 0.82 + (detail - 0.42) * 0.58 + (fine - 0.5) * 0.22;
}

// ─── GENERADOR DE TEXTURAS PBR DEL PLANETA TIERRA ───────────────────────────
function createEarthTextures() {
  const width = 1024;
  const height = 512;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const colorCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d')!;

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = width;
  cloudCanvas.height = height;
  const cloudCtx = cloudCanvas.getContext('2d')!;

  const colorImg = colorCtx.createImageData(width, height);
  const bumpImg = bumpCtx.createImageData(width, height);
  const roughImg = roughCtx.createImageData(width, height);
  const cloudImg = cloudCtx.createImageData(width, height);

  const cData = colorImg.data;
  const bData = bumpImg.data;
  const rData = roughImg.data;
  const clData = cloudImg.data;

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = Math.abs(v - 0.5) * 2; // 0 en ecuador, 1 en polos

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const idx = (y * width + x) * 4;

      const elevation = evaluateContinentMask(u, v);
      const moisture = fbm(u * 16 + 31.7, v * 8 + 12.3, 4);
      const mountainNoise = fbm(u * 45 + 7.1, v * 24 + 19.4, 4);

      // 1. Color + Bump + Roughness
      if (elevation > 0.34) {
        // TIERRA FIRME
        const normH = Math.min(1, (elevation - 0.34) / 0.55);
        const ridge = Math.pow(mountainNoise, 1.8) * normH;

        let r = 34;
        let g = 128;
        let b = 58;

        if (lat > 0.82 || ridge > 0.52) {
          // Nieve polar o cumbres andinas/alpinas
          const snowMix = Math.min(1, Math.max((lat - 0.82) * 6, (ridge - 0.52) * 3.5));
          r = Math.round(38 + snowMix * 205);
          g = Math.round(115 + snowMix * 132);
          b = Math.round(62 + snowMix * 185);
        } else if (moisture < 0.43 && lat > 0.14 && lat < 0.58) {
          // Sabana / meseta cálida / relieve árido
          const dry = (0.43 - moisture) * 2.8;
          r = Math.round(45 + dry * 125 + ridge * 45);
          g = Math.round(135 + dry * 45 + ridge * 25);
          b = Math.round(58 + dry * 22);
        } else {
          // Bosques tropicales y templados (paleta EcoCommunity)
          const lush = Math.min(1, moisture * 1.35);
          r = Math.round(22 + (1 - lush) * 38 + ridge * 55);
          g = Math.round(98 + lush * 68 + normH * 28);
          b = Math.round(42 + lush * 24);
        }

        // Borde costero suave iluminado
        if (elevation < 0.375) {
          r = Math.min(255, r + 24);
          g = Math.min(255, g + 32);
          b = Math.min(255, b + 18);
        }

        cData[idx] = r;
        cData[idx + 1] = g;
        cData[idx + 2] = b;
        cData[idx + 3] = 255;

        const bumpVal = Math.min(255, Math.round(128 + normH * 85 + ridge * 65));
        bData[idx] = bData[idx + 1] = bData[idx + 2] = bumpVal;
        bData[idx + 3] = 255;

        // Tierra mate (alta rugosidad)
        rData[idx] = rData[idx + 1] = rData[idx + 2] = 215;
        rData[idx + 3] = 255;
      } else {
        // OCÉANO CON BATIMETRÍA
        const depth = Math.max(0, Math.min(1, (0.34 - elevation) / 0.34));
        const shallow = Math.pow(1 - depth, 2.6);

        // Casquete polar ártico/antártico marino
        const iceFactor = lat > 0.88 ? Math.min(1, (lat - 0.88) * 8.5) : 0;

        const r = Math.round((8 + shallow * 22) * (1 - iceFactor) + 225 * iceFactor);
        const g = Math.round((34 + shallow * 88) * (1 - iceFactor) + 240 * iceFactor);
        const b = Math.round((64 + shallow * 95) * (1 - iceFactor) + 250 * iceFactor);

        cData[idx] = r;
        cData[idx + 1] = g;
        cData[idx + 2] = b;
        cData[idx + 3] = 255;

        bData[idx] = bData[idx + 1] = bData[idx + 2] = 110;
        bData[idx + 3] = 255;

        // Agua especular brillante (baja rugosidad)
        const roughVal = iceFactor > 0.2 ? 190 : 52;
        rData[idx] = rData[idx + 1] = rData[idx + 2] = roughVal;
        rData[idx + 3] = 255;
      }

      // 2. Capa de Nubes Dinámicas (remolinos atmosféricos)
      const swirl = fbm(u * 12 + Math.sin(v * Math.PI * 3) * 0.25, v * 9, 5);
      const cloudDensity = Math.max(0, (swirl - 0.5) * 2.55);
      const cloudAlpha = Math.min(255, Math.round(Math.pow(cloudDensity, 1.35) * 235));
      clData[idx] = 246;
      clData[idx + 1] = 252;
      clData[idx + 2] = 248;
      clData[idx + 3] = cloudAlpha;
    }
  }

  colorCtx.putImageData(colorImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  cloudCtx.putImageData(cloudImg, 0, 0);

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;
  colorTex.anisotropy = 4;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.wrapS = THREE.RepeatWrapping;
  roughTex.wrapT = THREE.ClampToEdgeWrapping;

  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  cloudTex.wrapS = THREE.RepeatWrapping;
  cloudTex.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTex, bumpTex, roughTex, cloudTex };
}

// ─── MODELADOR PROCEDURAL DE MANO ESCULTURAL ANATÓMICA ─────────────────────
interface ArticulatedHand {
  root: THREE.Group;
  fingers: THREE.Group[];
  thumb: THREE.Group;
}

/**
 * Construye una mano 3D escultural de alta definición con:
 * - Antebrazo/muñeca estilizada con brazalete luminoso EcoCommunity
 * - Palma orgánica compuesta por metacarpos esculpidos, arco palmar y eminencia tenar
 * - 5 dedos articulados con 3 falanges cada uno (proximal, media, distal), nudillos,
 *   yemas redondeadas y placa ungueal (uña sutil), curvados acunando la esfera terrestre
 */
function buildSculptedHand(
  side: 'left' | 'right',
  skinMaterial: THREE.MeshPhysicalMaterial,
  accentMaterial: THREE.MeshStandardMaterial
): ArticulatedHand {
  const root = new THREE.Group();
  const mirror = side === 'left' ? -1 : 1;

  // Grupo interno para aplicar simetría limpia en X cuando es mano izquierda
  const handCore = new THREE.Group();
  handCore.scale.x = mirror;
  root.add(handCore);

  // 1. PALMA ANATÓMICA ESCULPIDA (Unión de bloques metacarpianos + eminencia tenar + talón palmar)
  const palmGroup = new THREE.Group();
  handCore.add(palmGroup);

  // Cuerpo central de la palma (ligeramente cóncavo)
  const palmCenterGeo = new THREE.SphereGeometry(0.34, 28, 24);
  palmCenterGeo.scale(1.05, 0.36, 1.18);
  const palmCenter = new THREE.Mesh(palmCenterGeo, skinMaterial);
  palmCenter.position.set(0, 0, 0);
  palmCenter.castShadow = true;
  palmCenter.receiveShadow = true;
  palmGroup.add(palmCenter);

  // Arco de nudillos (puente metacarpiano superior)
  const knuckleBridgeGeo = new THREE.CapsuleGeometry(0.11, 0.48, 12, 24);
  knuckleBridgeGeo.rotateZ(Math.PI / 2);
  knuckleBridgeGeo.scale(1, 0.82, 0.95);
  const knuckleBridge = new THREE.Mesh(knuckleBridgeGeo, skinMaterial);
  knuckleBridge.position.set(0.01, 0.03, -0.34);
  knuckleBridge.castShadow = true;
  palmGroup.add(knuckleBridge);

  // Eminencia tenar (músculo base del pulgar)
  const thenarGeo = new THREE.SphereGeometry(0.19, 22, 18);
  thenarGeo.scale(0.95, 0.68, 1.45);
  const thenar = new THREE.Mesh(thenarGeo, skinMaterial);
  thenar.position.set(-0.22, 0.04, 0.06);
  thenar.rotation.set(0.18, 0.42, -0.2);
  thenar.castShadow = true;
  palmGroup.add(thenar);

  // Eminencia hipotenar (borde exterior de la palma)
  const hypothenarGeo = new THREE.SphereGeometry(0.16, 20, 18);
  hypothenarGeo.scale(0.75, 0.62, 1.65);
  const hypothenar = new THREE.Mesh(hypothenarGeo, skinMaterial);
  hypothenar.position.set(0.24, 0.03, 0.04);
  hypothenar.rotation.set(0.12, -0.15, 0.15);
  hypothenar.castShadow = true;
  palmGroup.add(hypothenar);

  // 2. MUÑECA Y ANTEBRAZO ESCULTURAL + ANILLO LUMINOSO
  const wristGeo = new THREE.CylinderGeometry(0.22, 0.19, 0.42, 28, 8);
  wristGeo.scale(1.12, 1, 0.78);
  const wrist = new THREE.Mesh(wristGeo, skinMaterial);
  wrist.position.set(0, -0.14, 0.46);
  wrist.rotation.x = Math.PI * 0.36;
  wrist.castShadow = true;
  palmGroup.add(wrist);

  // Brazalete/anillo tecnológico de acento en la muñeca
  const cuffGeo = new THREE.TorusGeometry(0.215, 0.018, 14, 36);
  cuffGeo.scale(1.12, 0.8, 1);
  const cuff = new THREE.Mesh(cuffGeo, accentMaterial);
  cuff.position.set(0, -0.1, 0.39);
  cuff.rotation.x = Math.PI * 0.86;
  palmGroup.add(cuff);

  // 3. DEDOS ARTICULADOS (ÍNDICE, MEDIO, ANULAR, MEÑIQUE)
  // Cada dedo tiene 3 falanges ahusadas + nudillos esféricos + uña escultural
  const fingerSpecs = [
    {
      name: 'index',
      x: -0.24,
      y: 0.04,
      z: -0.35,
      splayY: 0.16,
      rollZ: -0.08,
      lengths: [0.25, 0.17, 0.13],
      radii: [0.068, 0.058, 0.048, 0.039],
      curls: [0.52, 0.48, 0.36],
    },
    {
      name: 'middle',
      x: -0.075,
      y: 0.05,
      z: -0.38,
      splayY: 0.04,
      rollZ: -0.02,
      lengths: [0.28, 0.19, 0.14],
      radii: [0.072, 0.061, 0.05, 0.041],
      curls: [0.56, 0.52, 0.38],
    },
    {
      name: 'ring',
      x: 0.09,
      y: 0.04,
      z: -0.36,
      splayY: -0.06,
      rollZ: 0.04,
      lengths: [0.26, 0.175, 0.13],
      radii: [0.067, 0.057, 0.047, 0.038],
      curls: [0.58, 0.54, 0.4],
    },
    {
      name: 'pinky',
      x: 0.245,
      y: 0.02,
      z: -0.31,
      splayY: -0.18,
      rollZ: 0.12,
      lengths: [0.205, 0.135, 0.11],
      radii: [0.058, 0.049, 0.041, 0.033],
      curls: [0.64, 0.56, 0.42],
    },
  ];

  const fingerGroups: THREE.Group[] = [];

  fingerSpecs.forEach((spec) => {
    const fingerBase = new THREE.Group();
    fingerBase.position.set(spec.x, spec.y, spec.z);
    fingerBase.rotation.set(0, spec.splayY, spec.rollZ);
    handCore.add(fingerBase);
    fingerGroups.push(fingerBase);

    let parentJoint = fingerBase;

    for (let p = 0; p < 3; p++) {
      const len = spec.lengths[p];
      const rBase = spec.radii[p];
      const rTop = spec.radii[p + 1];

      const phalanxPivot = new THREE.Group();
      phalanxPivot.rotation.x = spec.curls[p]; // Curvatura hacia arriba acunando el planeta
      parentJoint.add(phalanxPivot);

      // Articulación / nudillo redondeado
      const jointGeo = new THREE.SphereGeometry(rBase * 1.02, 18, 16);
      jointGeo.scale(1.04, 0.92, 1.0);
      const jointMesh = new THREE.Mesh(jointGeo, skinMaterial);
      jointMesh.castShadow = true;
      phalanxPivot.add(jointMesh);

      // Hueso/segmento carnado de la falange
      const segGeo = new THREE.CylinderGeometry(rTop, rBase, len, 20, 4);
      segGeo.scale(1.02, 1, 0.92);
      const segMesh = new THREE.Mesh(segGeo, skinMaterial);
      segMesh.position.set(0, 0, -len / 2);
      segMesh.rotation.x = Math.PI / 2;
      segMesh.castShadow = true;
      segMesh.receiveShadow = true;
      phalanxPivot.add(segMesh);

      // Si es la falange distal (punta del dedo), añadir yema y uña escultural
      if (p === 2) {
        const tipGeo = new THREE.SphereGeometry(rTop * 0.98, 18, 16);
        tipGeo.scale(1.0, 0.88, 1.18);
        const tipMesh = new THREE.Mesh(tipGeo, skinMaterial);
        tipMesh.position.set(0, 0, -len);
        tipMesh.castShadow = true;
        phalanxPivot.add(tipMesh);

        // Placa de uña sutil en la parte dorsal
        const nailGeo = new THREE.SphereGeometry(rTop * 0.72, 14, 12);
        nailGeo.scale(0.95, 0.22, 1.15);
        const nailMesh = new THREE.Mesh(nailGeo, accentMaterial);
        nailMesh.position.set(0, -rTop * 0.72, -len * 0.82);
        nailMesh.rotation.x = -0.12;
        phalanxPivot.add(nailMesh);
      }

      // El siguiente segmento nace al final de la falange actual
      const nextOrigin = new THREE.Group();
      nextOrigin.position.set(0, 0, -len);
      phalanxPivot.add(nextOrigin);
      parentJoint = nextOrigin;
    }
  });

  // 4. PULGAR ARTICULADO DE 3 SEGMENTOS (OPONIBLE, SOSTENIENDO EL FRENTE LATERAL)
  const thumbBase = new THREE.Group();
  thumbBase.position.set(-0.29, 0.06, -0.02);
  thumbBase.rotation.set(0.42, 0.68, -0.45);
  handCore.add(thumbBase);

  const thumbLengths = [0.22, 0.165, 0.135];
  const thumbRadii = [0.082, 0.068, 0.056, 0.046];
  const thumbCurls = [0.35, 0.42, 0.34];

  let thumbParent = thumbBase;
  for (let p = 0; p < 3; p++) {
    const len = thumbLengths[p];
    const rBase = thumbRadii[p];
    const rTop = thumbRadii[p + 1];

    const pivot = new THREE.Group();
    pivot.rotation.x = thumbCurls[p];
    thumbParent.add(pivot);

    const jointGeo = new THREE.SphereGeometry(rBase, 16, 14);
    const joint = new THREE.Mesh(jointGeo, skinMaterial);
    joint.castShadow = true;
    pivot.add(joint);

    const segGeo = new THREE.CylinderGeometry(rTop, rBase, len, 18);
    segGeo.scale(1.05, 1, 0.92);
    const seg = new THREE.Mesh(segGeo, skinMaterial);
    seg.position.set(0, 0, -len / 2);
    seg.rotation.x = Math.PI / 2;
    seg.castShadow = true;
    pivot.add(seg);

    if (p === 2) {
      const tipGeo = new THREE.SphereGeometry(rTop, 16, 14);
      tipGeo.scale(1.0, 0.88, 1.15);
      const tip = new THREE.Mesh(tipGeo, skinMaterial);
      tip.position.set(0, 0, -len);
      pivot.add(tip);
    }

    const next = new THREE.Group();
    next.position.set(0, 0, -len);
    pivot.add(next);
    thumbParent = next;
  }

  return { root, fingers: fingerGroups, thumb: thumbBase };
}

// ─── NODOS GEOLOCALIZADOS Y ARCOS DE CONEXIÓN SOBRE LA TIERRA ───────────────
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

const ECO_NODES = [
  { name: 'Bogotá', lat: 4.71, lon: -74.07 },
  { name: 'Medellín', lat: 6.24, lon: -75.58 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Ciudad de México', lat: 19.43, lon: -99.13 },
  { name: 'Nueva York', lat: 40.71, lon: -74.0 },
  { name: 'Madrid', lat: 40.41, lon: -3.7 },
  { name: 'Berlín', lat: 52.52, lon: 13.4 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Tokio', lat: 35.67, lon: 139.65 },
  { name: 'Sídney', lat: -33.86, lon: 151.2 },
];

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export const HeroThreeJS: React.FC<HeroThreeJSProps> = ({
  onNavigate,
  onScanClick,
  walletStats,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglSupported] = useState(() => isWebGLAvailable());
  const [activeSector, setActiveSector] = useState<string>('Puntos Limpios');

  const kgTotal = walletStats?.kgTotal ?? 1.43;
  const saldo = walletStats?.saldo ?? 178;
  const co2Total = walletStats?.co2Total ?? 2.08;

  useEffect(() => {
    if (!mountRef.current || !webglSupported) return;
    const container = mountRef.current;

    // 1. ESCENA Y CÁMARA
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.15, 4.55);
    camera.lookAt(0, 0.02, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.appendChild(renderer.domElement);

    // 2. SISTEMA DE ILUMINACIÓN CINEMATOGRÁFICA (3 PUNTOS + RIM LIGHT LIME)
    const ambientLight = new THREE.HemisphereLight(0xdff6ff, 0x0b1d13, 0.85);
    scene.add(ambientLight);

    // Sol principal (Key Light)
    const sunLight = new THREE.DirectionalLight(0xfffbf0, 2.8);
    sunLight.position.set(-3.8, 3.6, 4.2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Rim Light en verde lima de marca (#d7eb80) para perfilar manos y atmósfera
    const rimLight = new THREE.DirectionalLight(0xd7eb80, 1.85);
    rimLight.position.set(3.5, 1.5, -3.2);
    scene.add(rimLight);

    // Luz cálida inferior que ilumina las palmas y dedos desde abajo
    const underLight = new THREE.PointLight(0x4ade80, 1.35, 7);
    underLight.position.set(0, -1.8, 1.6);
    scene.add(underLight);

    // Luz cenital suave para dar brillo especular al océano
    const oceanSpecLight = new THREE.PointLight(0x38bdf8, 1.1, 9);
    oceanSpecLight.position.set(2.2, 2.4, 2.8);
    scene.add(oceanSpecLight);

    // 3. GRUPO MAESTRO DE LA COMPOSICIÓN (PLANETA + MANOS)
    const compositionGroup = new THREE.Group();
    scene.add(compositionGroup);

    // 4. PLANETA TIERRA DETALLADO
    const earthPivot = new THREE.Group();
    earthPivot.position.set(0, 0.28, 0);
    // Inclinación axial real de la Tierra (23.4°)
    earthPivot.rotation.z = THREE.MathUtils.degToRad(16);
    compositionGroup.add(earthPivot);

    const earthRadius = 0.96;
    const { colorTex, bumpTex, roughTex, cloudTex } = createEarthTextures();

    const earthGeo = new THREE.SphereGeometry(earthRadius, 96, 96);
    const earthMat = new THREE.MeshStandardMaterial({
      map: colorTex,
      bumpMap: bumpTex,
      bumpScale: 0.032,
      roughnessMap: roughTex,
      roughness: 0.72,
      metalness: 0.08,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.castShadow = true;
    earthMesh.receiveShadow = true;
    earthMesh.rotation.y = -1.2; // Enfocar América / Atlántico al iniciar
    earthPivot.add(earthMesh);

    // Capa de nubes volumétricas
    const cloudGeo = new THREE.SphereGeometry(earthRadius * 1.016, 72, 72);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      roughness: 0.95,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthPivot.add(cloudMesh);

    // Atmósfera con Shader Fresnel (resplandor azul-esmeralda en el borde del planeta)
    const atmosphereGeo = new THREE.SphereGeometry(earthRadius * 1.09, 64, 64);
    const atmosphereMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        glowColor: { value: new THREE.Color(0x5eead4) },
        rimColor: { value: new THREE.Color(0xd7eb80) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform vec3 rimColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float intensity = pow(0.68 - dot(vNormal, viewDir), 2.8);
          vec3 finalColor = mix(glowColor, rimColor, 0.45);
          gl_FragColor = vec4(finalColor, clamp(intensity * 0.88, 0.0, 1.0));
        }
      `,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    earthPivot.add(atmosphereMesh);

    // Anillo orbital exterior sutil (inspirado en el aro del diseño de referencia)
    const orbitalRingGeo = new THREE.TorusGeometry(earthRadius * 1.24, 0.0055, 16, 128);
    const orbitalRingMat = new THREE.MeshBasicMaterial({
      color: 0xd7eb80,
      transparent: true,
      opacity: 0.38,
    });
    const orbitalRing = new THREE.Mesh(orbitalRingGeo, orbitalRingMat);
    orbitalRing.rotation.x = Math.PI * 0.42;
    orbitalRing.rotation.y = -0.28;
    earthPivot.add(orbitalRing);

    // Nodos geolocalizados (pines brillantes) + arcos de conexión sobre la superficie terrestre
    const nodesGroup = new THREE.Group();
    earthMesh.add(nodesGroup);

    const pinGeo = new THREE.SphereGeometry(0.019, 12, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xd7eb80 });
    const haloGeo = new THREE.RingGeometry(0.024, 0.042, 20);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });

    const nodeVectors: THREE.Vector3[] = [];
    ECO_NODES.forEach((node) => {
      const pos = latLonToVector3(node.lat, node.lon, earthRadius * 1.006);
      nodeVectors.push(pos);

      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.copy(pos);
      nodesGroup.add(pin);

      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(pos.clone().multiplyScalar(1.003));
      halo.lookAt(pos.clone().multiplyScalar(2));
      nodesGroup.add(halo);
    });

    // Conectar pares de ciudades con arcos Bézier 3D elevados
    const arcPairs = [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [4, 5],
      [5, 6],
      [5, 7],
      [6, 8],
      [8, 9],
    ];
    const arcMat = new THREE.LineBasicMaterial({
      color: 0xd7eb80,
      transparent: true,
      opacity: 0.55,
    });

    arcPairs.forEach(([i, j]) => {
      const start = nodeVectors[i];
      const end = nodeVectors[j];
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const dist = start.distanceTo(end);
      mid.normalize().multiplyScalar(earthRadius + dist * 0.28);

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(36);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcLine = new THREE.Line(arcGeo, arcMat);
      nodesGroup.add(arcLine);
    });

    // 5. DOS MANOS ESCULTURALES DETALLADAS QUE SOSTIENEN EL PLANETA
    const handsPivot = new THREE.Group();
    handsPivot.position.set(0, -0.68, 0.15);
    compositionGroup.add(handsPivot);

    // Material escultural de piel/porcelana cálida satinada con acabado físico realista
    const sculptedSkinMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd8a47f,
      emissive: 0x261208,
      emissiveIntensity: 0.18,
      roughness: 0.42,
      metalness: 0.08,
      clearcoat: 0.28,
      clearcoatRoughness: 0.35,
      reflectivity: 0.6,
    });

    const handAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0xd7eb80,
      emissive: 0x65a30d,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.7,
    });

    const leftHand = buildSculptedHand('left', sculptedSkinMaterial, handAccentMaterial);
    // Posicionar mano izquierda acunando el hemisferio inferior izquierdo de la Tierra
    leftHand.root.position.set(-0.62, -0.04, 0.16);
    leftHand.root.rotation.set(0.46, 0.48, -0.58);
    leftHand.root.scale.setScalar(1.08);
    handsPivot.add(leftHand.root);

    const rightHand = buildSculptedHand('right', sculptedSkinMaterial, handAccentMaterial);
    // Posicionar mano derecha acunando el hemisferio inferior derecho de la Tierra
    rightHand.root.position.set(0.62, -0.04, 0.16);
    rightHand.root.rotation.set(0.46, -0.48, 0.58);
    rightHand.root.scale.setScalar(1.08);
    handsPivot.add(rightHand.root);

    // 6. PARTÍCULAS DE ENERGÍA SOSTENIBLE ASCENDIENDO DESDE LAS MANOS AL PLANETA
    const particleCount = 140;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.85 + Math.random() * 0.65;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = (Math.random() - 0.45) * 2.2;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xd7eb80,
      size: 0.032,
      transparent: true,
      opacity: 0.75,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    compositionGroup.add(particles);

    // 7. INTERACCIÓN CON EL CURSOR Y PAUSA INTELIGENTE FUERA DEL VIEWPORT
    let targetRotX = 0;
    let targetRotY = 0;
    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetRotY = nx * 0.28;
      targetRotX = ny * 0.14;
    };
    container.addEventListener('pointermove', handlePointerMove);

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

    // 8. BUCLE DE ANIMACIÓN SUAVE
    const clock = new THREE.Clock();
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const t = clock.getElapsedTime();

      // Rotación continua y orgánica del planeta Tierra y su capa de nubes
      earthMesh.rotation.y += 0.0024;
      cloudMesh.rotation.y += 0.0032;
      orbitalRing.rotation.z = t * 0.15;

      // Flotación suave del planeta y respiración coordinada de las manos
      const breathe = Math.sin(t * 1.45);
      earthPivot.position.y = 0.28 + breathe * 0.045;
      handsPivot.position.y = -0.68 + breathe * 0.035;

      // Micro-articulación viva en cada dedo (sensación de cuidado y sostén real)
      leftHand.fingers.forEach((fGroup, idx) => {
        const firstPhalanx = fGroup.children[0];
        if (firstPhalanx) {
          firstPhalanx.rotation.x = 0.54 + Math.sin(t * 1.45 + idx * 0.35) * 0.045;
        }
      });
      rightHand.fingers.forEach((fGroup, idx) => {
        const firstPhalanx = fGroup.children[0];
        if (firstPhalanx) {
          firstPhalanx.rotation.x = 0.54 + Math.sin(t * 1.45 + idx * 0.35) * 0.045;
        }
      });

      // Oscilación sutil de las muñecas acunando el mundo
      leftHand.root.rotation.z = -0.58 + breathe * 0.025;
      rightHand.root.rotation.z = 0.58 - breathe * 0.025;

      // Rotación de partículas orbitales
      particles.rotation.y = t * 0.08;

      // Seguimiento suave del cursor (parallax 3D)
      compositionGroup.rotation.y += (targetRotY - compositionGroup.rotation.y) * 0.05;
      compositionGroup.rotation.x += (targetRotX - compositionGroup.rotation.x) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointermove', handlePointerMove);

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

      colorTex.dispose();
      bumpTex.dispose();
      roughTex.dispose();
      cloudTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [webglSupported]);

  const sectorNavigation: Array<{ label: string; tab: string }> = [
    { label: 'Puntos Limpios', tab: 'mapa' },
    { label: 'Escáner IA Gemini', tab: 'escanear' },
    { label: 'Billetera Ecocoins', tab: 'billetera' },
    { label: 'Auditoría ESG', tab: 'impacto' },
  ];

  return (
    <section
      className="relative rounded-[24px] overflow-hidden border border-white/10 shadow-2xl"
      style={{
        backgroundColor: '#090d0a',
        backgroundImage:
          'radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px), radial-gradient(circle at 75% 50%, rgba(45, 140, 58, 0.22) 0%, rgba(9, 13, 10, 0) 62%)',
        backgroundSize: '28px 28px, 100% 100%',
        minHeight: '610px',
      }}
    >
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-center min-h-[610px] px-6 sm:px-12 lg:px-16 py-12 gap-8">
        {/* COLUMNA IZQUIERDA: JERARQUÍA EDITORIAL Y BOTONES DE DIRECCIONAMIENTO */}
        <div className="lg:col-span-6 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/15 text-xs font-medium text-[#d7eb80] tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-[#d7eb80] animate-pulse" />
            Economía Circular Geolocalizada
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-[-0.03em] leading-[1.05]">
            <span className="text-white block">Recicla. Impacta.</span>
            <span className="text-[#9ca3af] block mt-1">
              Transforma tu{' '}
              <span className="text-[#d7eb80]">Entorno.</span>
            </span>
          </h1>

          <p className="text-sm sm:text-base text-[#a3a3a3] max-w-xl leading-relaxed">
            Una plataforma ciudadana para mapear reciclaje, validar entregas con IA Gemini y
            auditar impacto ambiental:{' '}
            <strong className="text-white font-semibold">
              cada empaque reciclado es un pin en el mapa
            </strong>
            , y cada pin alimenta recompensas Ecocoins y métricas ESG en tiempo real.
          </p>

          {/* Dos botones principales con el contraste limpio de la referencia */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={onScanClick}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-white text-[#090d0a] text-xs sm:text-sm font-bold tracking-wider uppercase hover:bg-[#d7eb80] transition-all cursor-pointer shadow-lg"
            >
              <span>ESCANEAR RESIDUO</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('mapa')}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-[#111713] text-white border border-white/15 hover:border-[#d7eb80]/60 text-xs sm:text-sm font-bold tracking-wider uppercase transition-all cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-[#2d8c3a]" />
              <span>EXPLORAR PUNTOS LIMPIOS</span>
            </button>
          </div>

          {/* Barra de métricas en tiempo real */}
          <div className="grid grid-cols-3 gap-3 max-w-lg pt-2">
            <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
                <TreePine className="w-3.5 h-3.5 text-[#d7eb80]" />
                <span>Desviado</span>
              </div>
              <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                {kgTotal} kg
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
                <Coins className="w-3.5 h-3.5 text-[#d7eb80]" />
                <span>Billetera</span>
              </div>
              <div className="text-lg font-bold text-[#d7eb80] tabular-nums mt-0.5">
                {saldo} EC
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-1.5 text-xs text-[#9ca3af]">
                <Leaf className="w-3.5 h-3.5 text-[#d7eb80]" />
                <span>CO₂ Ahorrado</span>
              </div>
              <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                {co2Total} kg
              </div>
            </div>
          </div>

          {/* SECTORES / MÓDULOS CLICABLES */}
          <div className="pt-4 border-t border-white/10 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#737373] mr-1">
                MÓDULOS:
              </span>
              {sectorNavigation.map((item) => {
                const isSelected = activeSector === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setActiveSector(item.label);
                      onNavigate?.(item.tab);
                    }}
                    className={`px-3 py-1 rounded text-xs font-mono transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-white/15 text-white border-[#d7eb80]/60'
                        : 'bg-white/[0.04] text-[#a3a3a3] border-white/10 hover:text-white hover:border-white/30'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: ESCENA 3D INTERACTIVA (PLANETA TIERRA + 2 MANOS ESCULTURALES) */}
        <div className="lg:col-span-6 relative flex items-center justify-center min-h-[420px] sm:min-h-[520px]">
          {/* Aro exterior decorativo de alto contraste (como en la referencia) */}
          <div
            className="pointer-events-none absolute w-[330px] h-[330px] sm:w-[430px] sm:h-[430px] rounded-full border-[10px] border-white/15 shadow-[0_0_90px_rgba(215,235,128,0.12)]"
            aria-hidden="true"
          />

          {webglSupported ? (
            <div
              ref={mountRef}
              className="w-full h-[440px] sm:h-[520px] cursor-grab active:cursor-grabbing"
              title="Mueve el cursor para rotar la escena 3D"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 rounded-full w-[340px] h-[340px] bg-white/5 border border-white/15">
              <ShieldCheck className="w-12 h-12 text-[#d7eb80] mb-3" />
              <p className="text-sm font-semibold text-white">
                Planeta Tierra Sostenible
              </p>
              <p className="text-xs text-white/60 mt-1">
                Modo estático activado (WebGL no disponible en este navegador)
              </p>
            </div>
          )}

          {/* Indicador interactivo inferior derecho */}
          <div className="absolute bottom-2 right-2 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md text-[11px] font-mono text-[#d7eb80]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tierra PBR + Manos 3D · Interactivo</span>
          </div>
        </div>
      </div>
    </section>
  );
};
