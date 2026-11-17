import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import {
  createBrushedMetalTexture,
  createGoldAuraTexture,
  createSoftParticleTexture,
  detectSoftwareWebGL,
} from '../utils/proceduralTextures';

export type FinishKey = 'titanium' | 'obsidian' | 'champagne';

export interface ScrollChoreographyState {
  modelX: number;
  modelY: number;
  modelZ: number;
  modelScale: number;
  modelRotY: number;
  modelTiltX: number;
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  explosion: number;
}

interface DragState {
  isDragging: boolean;
  lastX: number;
  lastY: number;
  velX: number;
  velY: number;
  rotY: number;
  rotX: number;
}

interface FinishPalette {
  caseColor: string;
  caseMetalness: number;
  caseRoughness: number;
  plateColor: string;
  bridgeColor: string;
}

const FINISH_PALETTES: Record<FinishKey, FinishPalette> = {
  titanium: {
    caseColor: '#a4a9b0',
    caseMetalness: 0.93,
    caseRoughness: 0.22,
    plateColor: '#25272d',
    bridgeColor: '#cfd2d8',
  },
  obsidian: {
    caseColor: '#1b1c21',
    caseMetalness: 0.88,
    caseRoughness: 0.2,
    plateColor: '#101014',
    bridgeColor: '#3b3e47',
  },
  champagne: {
    caseColor: '#d4a86a',
    caseMetalness: 0.96,
    caseRoughness: 0.17,
    plateColor: '#28231e',
    bridgeColor: '#e4c18c',
  },
};

// Pre-allocated zero-GC math helpers
const _dummy = new THREE.Object3D();
const _matStageInv = new THREE.Matrix4();
const _matMarker = new THREE.Matrix4();
const _matRel = new THREE.Matrix4();
const _targetWristPos = new THREE.Vector3();
const _targetWristQuat = new THREE.Quaternion();
const _targetWristScale = new THREE.Vector3();
const _floatPos = new THREE.Vector3();
const _floatQuat = new THREE.Quaternion();
const _floatEuler = new THREE.Euler();

// Distinct scatter vectors for the 7 axial strata during Acquire break-apart
const SCATTER_VECTORS: ReadonlyArray<{
  pos: [number, number, number];
  rot: [number, number, number];
}> = [
  { pos: [-1.85, -1.1, -2.1], rot: [-1.4, 1.8, 0.9] }, // Caseback
  { pos: [-1.45, 0.95, -1.25], rot: [1.1, -1.3, 1.4] }, // Mainplate
  { pos: [1.35, -1.2, -0.4], rot: [-1.7, 1.5, -1.1] }, // Gear Train
  { pos: [-0.9, -1.55, 1.35], rot: [1.9, 1.1, -1.6] }, // Flying Tourbillon
  { pos: [1.75, 1.15, 1.5], rot: [-1.2, -1.6, 1.7] }, // Cathedral Hands
  { pos: [-0.35, 1.7, 2.05], rot: [1.5, -1.1, -1.3] }, // Brushed Bezel
  { pos: [0.95, 1.35, 2.95], rot: [-1.3, 1.4, 1.8] }, // Sapphire Crystal
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function createGearGeometry(
  teeth: number,
  innerR: number,
  outerR: number,
  depth: number,
  holeR = 0.08
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.18;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.56;
    const a4 = a0 + step * 0.72;

    const p0x = Math.cos(a0) * innerR;
    const p0y = Math.sin(a0) * innerR;
    const p1x = Math.cos(a1) * innerR;
    const p1y = Math.sin(a1) * innerR;
    const p2x = Math.cos(a2) * outerR;
    const p2y = Math.sin(a2) * outerR;
    const p3x = Math.cos(a3) * outerR;
    const p3y = Math.sin(a3) * outerR;
    const p4x = Math.cos(a4) * innerR;
    const p4y = Math.sin(a4) * innerR;

    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(p1x, p1y);
    shape.lineTo(p2x, p2y);
    shape.lineTo(p3x, p3y);
    shape.lineTo(p4x, p4y);
  }
  shape.closePath();

  if (holeR > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.009,
  });
  geo.center();
  geo.computeTangents();
  return geo;
}

function createHairspringGeometry(turns = 5.5, maxRadius = 0.26): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  const total = 140;
  for (let i = 0; i <= total; i++) {
    const t = i / total;
    const angle = t * Math.PI * 2 * turns;
    const r = 0.04 + t * maxRadius;
    pts.push(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 120, 0.0055, 6, false);
}

/** Clean sculpted virtual forearm, wrist, and articulated hand (zero shoulder/torso overlap) */
function VirtualArm({
  armRef,
  wristMountMarkerRef,
  strapGroupRef,
  caseMaterial,
}: {
  armRef: MutableRefObject<THREE.Group | null>;
  wristMountMarkerRef: MutableRefObject<THREE.Group | null>;
  strapGroupRef: MutableRefObject<THREE.Group | null>;
  caseMaterial: THREE.MeshPhysicalMaterial;
}) {
  const geometries = useMemo(() => {
    // Sculpted Forearm Lathe along +Y (rotated -90deg Z -> spans x = -1.65 to +0.36)
    const forearmPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.36, 0.05),
      new THREE.Vector2(0.41, 0.35),
      new THREE.Vector2(0.42, 0.72),
      new THREE.Vector2(0.36, 1.24),
      new THREE.Vector2(0.3, 1.68),
      new THREE.Vector2(0.275, 1.96),
      new THREE.Vector2(0.26, 2.02),
      new THREE.Vector2(0.0, 2.04),
    ];
    const forearmGeo = new THREE.LatheGeometry(forearmPts, 40);

    // Tapered sculptural palm profile (extruded with smooth bevel)
    const palmShape = new THREE.Shape();
    palmShape.moveTo(0.0, -0.24);
    palmShape.quadraticCurveTo(0.28, -0.3, 0.54, -0.23);
    palmShape.quadraticCurveTo(0.6, 0.0, 0.54, 0.25);
    palmShape.quadraticCurveTo(0.28, 0.31, 0.0, 0.24);
    palmShape.quadraticCurveTo(-0.06, 0.0, 0.0, -0.24);
    const palmGeo = new THREE.ExtrudeGeometry(palmShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.045,
      bevelThickness: 0.055,
    });
    palmGeo.rotateX(Math.PI / 2);
    palmGeo.translate(0, 0.08, 0);

    // Articulated curved finger segments
    const makeFinger = (len: number, radius: number, curl: number) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(len * 0.42, -curl * 0.18, 0),
        new THREE.Vector3(len * 0.78, -curl * 0.62, 0),
        new THREE.Vector3(len, -curl * 1.15, 0),
      ]);
      return new THREE.TubeGeometry(curve, 18, radius, 12, false);
    };

    const indexGeo = makeFinger(0.56, 0.048, 0.14);
    const middleGeo = makeFinger(0.62, 0.05, 0.17);
    const ringGeo = makeFinger(0.55, 0.046, 0.2);
    const pinkyGeo = makeFinger(0.44, 0.04, 0.23);
    const thumbGeo = makeFinger(0.45, 0.054, 0.09);

    return {
      forearmGeo,
      palmGeo,
      indexGeo,
      middleGeo,
      ringGeo,
      pinkyGeo,
      thumbGeo,
    };
  }, []);

  const materials = useMemo(() => {
    return {
      sculptMat: new THREE.MeshPhysicalMaterial({
        color: '#1f2026',
        metalness: 0.2,
        roughness: 0.48,
        clearcoat: 0.3,
        clearcoatRoughness: 0.45,
      }),
      brassJointMat: new THREE.MeshPhysicalMaterial({
        color: '#d4a86a',
        metalness: 0.94,
        roughness: 0.22,
        anisotropy: 0.6,
      }),
      strapLeatherMat: new THREE.MeshStandardMaterial({
        color: '#141317',
        metalness: 0.14,
        roughness: 0.66,
      }),
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [geometries, materials]);

  return (
    <group ref={armRef} visible={false} position={[0, -3.5, 0]}>
      {/* Clean Diagonal Presentation Angle for Forearm + Wrist + Hand */}
      <group position={[0.1, -0.05, 0.1]} rotation={[0.18, -0.38, 0.1]}>
        {/* Atelier Forearm Base Cap & Brass Trim at x = -1.65 */}
        <group position={[-1.65, 0, 0]}>
          <mesh scale={[0.7, 0.82, 1.12]} material={materials.sculptMat} castShadow>
            <sphereGeometry args={[0.35, 28, 20]} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]} scale={[1.12, 0.82, 1]} material={materials.brassJointMat}>
            <torusGeometry args={[0.365, 0.022, 14, 44]} />
          </mesh>
        </group>

        {/* Sculpted Forearm (spans x = -1.65 to x = +0.39) */}
        <group position={[-1.65, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.8, 1, 1.15]}>
          <mesh
            geometry={geometries.forearmGeo}
            material={materials.sculptMat}
            castShadow
            receiveShadow
          />
        </group>

        {/* EXACT WRIST MOUNT TARGET (x = 0.24, y = 0.335 flush on top of wrist) */}
        <group
          ref={wristMountMarkerRef}
          position={[0.24, 0.335, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />

        {/* Integrated Sculpted Watch Strap / Cuff hugging the Wrist */}
        <group ref={strapGroupRef} position={[0.24, 0, 0]} scale={0.001}>
          <mesh
            rotation={[0, Math.PI / 2, 0]}
            scale={[1.16, 0.84, 1]}
            material={materials.strapLeatherMat}
            castShadow
          >
            <torusGeometry args={[0.29, 0.058, 18, 48]} />
          </mesh>
          <mesh
            position={[-0.12, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[1.16, 0.84, 1]}
            material={caseMaterial}
          >
            <torusGeometry args={[0.296, 0.016, 12, 48]} />
          </mesh>
          <mesh
            position={[0.12, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[1.16, 0.84, 1]}
            material={caseMaterial}
          >
            <torusGeometry args={[0.296, 0.016, 12, 48]} />
          </mesh>
          <mesh position={[0, -0.27, 0]} material={materials.brassJointMat}>
            <boxGeometry args={[0.28, 0.04, 0.22]} />
          </mesh>
        </group>

        {/* Articulated Wrist Seam & Sculpted Hand extending forward (+X) */}
        <group position={[0.42, 0, 0]}>
          <mesh
            rotation={[0, Math.PI / 2, 0]}
            scale={[1.12, 0.82, 1]}
            material={materials.brassJointMat}
          >
            <torusGeometry args={[0.255, 0.014, 12, 36]} />
          </mesh>

          {/* Sculpted Palm */}
          <mesh
            position={[0.04, -0.02, 0]}
            geometry={geometries.palmGeo}
            material={materials.sculptMat}
            castShadow
            receiveShadow
          />

          {/* Knuckle Brass Pins & 4 Articulated Fingers */}
          <group position={[0.62, 0.02, 0.2]} rotation={[0, 0.1, -0.05]}>
            <mesh material={materials.sculptMat}>
              <sphereGeometry args={[0.052, 14, 12]} />
            </mesh>
            <mesh geometry={geometries.indexGeo} material={materials.sculptMat} castShadow />
          </group>

          <group position={[0.66, 0.03, 0.065]} rotation={[0, 0.03, -0.07]}>
            <mesh material={materials.sculptMat}>
              <sphereGeometry args={[0.054, 14, 12]} />
            </mesh>
            <mesh geometry={geometries.middleGeo} material={materials.sculptMat} castShadow />
          </group>

          <group position={[0.64, 0.015, -0.07]} rotation={[0, -0.04, -0.09]}>
            <mesh material={materials.sculptMat}>
              <sphereGeometry args={[0.05, 14, 12]} />
            </mesh>
            <mesh geometry={geometries.ringGeo} material={materials.sculptMat} castShadow />
          </group>

          <group position={[0.57, -0.01, -0.2]} rotation={[0, -0.14, -0.12]}>
            <mesh material={materials.sculptMat}>
              <sphereGeometry args={[0.044, 14, 12]} />
            </mesh>
            <mesh geometry={geometries.pinkyGeo} material={materials.sculptMat} castShadow />
          </group>

          {/* Articulated Thumb */}
          <group position={[0.22, -0.03, 0.25]} rotation={[0.28, -0.52, -0.12]}>
            <mesh material={materials.sculptMat}>
              <sphereGeometry args={[0.058, 14, 12]} />
            </mesh>
            <mesh geometry={geometries.thumbGeo} material={materials.sculptMat} castShadow />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Pulsing golden radial ambience in the background */
function GoldPulseAmbience({
  pointerRef,
  acquireMode,
}: {
  pointerRef: MutableRefObject<{ x: number; y: number }>;
  acquireMode: boolean;
}) {
  const outerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const innerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const outerMeshRef = useRef<THREE.Mesh>(null);
  const innerMeshRef = useRef<THREE.Mesh>(null);
  const pulseLightRef = useRef<THREE.PointLight>(null);

  const auraTexture = useMemo(() => createGoldAuraTexture(), []);

  useEffect(() => {
    return () => {
      auraTexture.dispose();
    };
  }, [auraTexture]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;

    // Harmonic double-pulse breathing wave
    const waveA = 0.5 + 0.5 * Math.sin(t * 1.15);
    const waveB = 0.5 + 0.5 * Math.sin(t * 2.3 - 0.8);
    const pulse = waveA * 0.72 + waveB * 0.28;
    const acquireBoost = acquireMode ? 0.14 : 0;

    if (outerMatRef.current) {
      outerMatRef.current.opacity = THREE.MathUtils.damp(
        outerMatRef.current.opacity,
        0.24 + pulse * 0.34 + acquireBoost,
        4.5,
        dt
      );
    }

    if (innerMatRef.current) {
      innerMatRef.current.opacity = THREE.MathUtils.damp(
        innerMatRef.current.opacity,
        0.16 + waveB * 0.28 + acquireBoost,
        5,
        dt
      );
    }

    if (outerMeshRef.current) {
      const targetScale = 14.5 + pulse * 2.6;
      const nextS = THREE.MathUtils.damp(outerMeshRef.current.scale.x, targetScale, 4, dt);
      outerMeshRef.current.scale.set(nextS, nextS, 1);
      outerMeshRef.current.position.x = THREE.MathUtils.damp(
        outerMeshRef.current.position.x,
        pointerRef.current.x * 1.1,
        3.5,
        dt
      );
      outerMeshRef.current.position.y = THREE.MathUtils.damp(
        outerMeshRef.current.position.y,
        pointerRef.current.y * 0.8,
        3.5,
        dt
      );
    }

    if (innerMeshRef.current) {
      const innerScale = 9.2 + waveA * 2.1;
      const nextIS = THREE.MathUtils.damp(innerMeshRef.current.scale.x, innerScale, 4.5, dt);
      innerMeshRef.current.scale.set(nextIS, nextIS, 1);
      innerMeshRef.current.position.x = THREE.MathUtils.damp(
        innerMeshRef.current.position.x,
        pointerRef.current.x * 1.6,
        4.5,
        dt
      );
      innerMeshRef.current.position.y = THREE.MathUtils.damp(
        innerMeshRef.current.position.y,
        pointerRef.current.y * 1.2,
        4.5,
        dt
      );
    }

    if (pulseLightRef.current) {
      pulseLightRef.current.intensity = THREE.MathUtils.damp(
        pulseLightRef.current.intensity,
        1.1 + pulse * 2.1,
        5,
        dt
      );
    }
  });

  return (
    <>
      <mesh ref={outerMeshRef} position={[0, 0, -7.2]} renderOrder={-2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={outerMatRef}
          map={auraTexture}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color="#d4a86a"
        />
      </mesh>

      <mesh ref={innerMeshRef} position={[0, 0, -5.4]} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={innerMatRef}
          map={auraTexture}
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color="#f0c784"
        />
      </mesh>

      <pointLight
        ref={pulseLightRef}
        position={[0, -0.5, -2.5]}
        intensity={1.8}
        distance={16}
        color="#e4b36c"
      />
    </>
  );
}

interface GoldenParticlesProps {
  totalCount: number;
  pointerRef: MutableRefObject<{ x: number; y: number }>;
}

/** Rich dual-layer golden particles: ambient drifting motes + cursor-following swirl wake */
function GoldenParticles({ totalCount, pointerRef }: GoldenParticlesProps) {
  const ambientRef = useRef<THREE.Points>(null);
  const cursorStreamRef = useRef<THREE.Points>(null);
  const sprite = useMemo(() => createSoftParticleTexture(), []);

  const ambientCount = Math.floor(totalCount * 0.58);
  const followerCount = totalCount - ambientCount;

  useEffect(() => {
    return () => {
      sprite.dispose();
    };
  }, [sprite]);

  const ambientData = useMemo(() => {
    const pos = new Float32Array(ambientCount * 3);
    const seeds = new Float32Array(ambientCount);
    for (let i = 0; i < ambientCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 9 - 1.2;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    return { pos, seeds };
  }, [ambientCount]);

  const followerData = useMemo(() => {
    const pos = new Float32Array(followerCount * 3);
    const vel = new Float32Array(followerCount * 3);
    const phase = new Float32Array(followerCount);
    const radius = new Float32Array(followerCount);
    for (let i = 0; i < followerCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2.5 - 0.4;
      phase[i] = Math.random() * Math.PI * 2;
      radius[i] = 0.25 + Math.random() * 1.45;
    }
    return { pos, vel, phase, radius };
  }, [followerCount]);

  const ambientMatRef = useRef<THREE.PointsMaterial>(null);

  useFrame(({ clock, viewport }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);

    // Ambient floating golden motes
    if (ambientRef.current) {
      ambientRef.current.rotation.y = THREE.MathUtils.damp(
        ambientRef.current.rotation.y,
        t * 0.015 + pointerRef.current.x * 0.14,
        3.5,
        dt
      );
      ambientRef.current.rotation.x = THREE.MathUtils.damp(
        ambientRef.current.rotation.x,
        -pointerRef.current.y * 0.1,
        3.5,
        dt
      );

      const attr = ambientRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < ambientCount; i++) {
        const y = attr.getY(i) + Math.sin(t * 0.45 + ambientData.seeds[i]) * 0.0014;
        attr.setY(i, y);
      }
      attr.needsUpdate = true;
    }

    if (ambientMatRef.current) {
      ambientMatRef.current.opacity = 0.45 + pulse * 0.25;
    }

    // Cursor-following golden swirl particles
    if (cursorStreamRef.current) {
      const targetX = pointerRef.current.x * (viewport.width * 0.48);
      const targetY = pointerRef.current.y * (viewport.height * 0.48);
      const attr = cursorStreamRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const vel = followerData.vel;

      for (let i = 0; i < followerCount; i++) {
        const idx = i * 3;
        const angle = t * (0.7 + (i % 5) * 0.12) + followerData.phase[i];
        const r = followerData.radius[i] * (0.75 + 0.35 * Math.sin(t * 0.9 + i));
        const destX = targetX + Math.cos(angle) * r;
        const destY = targetY + Math.sin(angle) * r * 0.72;
        const destZ = -0.5 + Math.sin(angle * 0.7) * 0.8;

        const spring = 2.6 + (i % 7) * 0.45;
        vel[idx] = (vel[idx] + (destX - attr.getX(i)) * spring * dt) * Math.pow(0.86, dt * 60);
        vel[idx + 1] =
          (vel[idx + 1] + (destY - attr.getY(i)) * spring * dt) * Math.pow(0.86, dt * 60);
        vel[idx + 2] =
          (vel[idx + 2] + (destZ - attr.getZ(i)) * spring * dt) * Math.pow(0.86, dt * 60);

        attr.setXYZ(
          i,
          attr.getX(i) + vel[idx] * dt * 16,
          attr.getY(i) + vel[idx + 1] * dt * 16,
          attr.getZ(i) + vel[idx + 2] * dt * 16
        );
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <>
      <points ref={ambientRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ambientData.pos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={ambientMatRef}
          map={sprite}
          size={0.095}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color="#e8bd7a"
        />
      </points>

      <points ref={cursorStreamRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[followerData.pos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={sprite}
          size={0.125}
          transparent
          opacity={0.82}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color="#ffdca0"
        />
      </points>
    </>
  );
}

interface CalibreM01Props {
  scrollState: MutableRefObject<ScrollChoreographyState>;
  dragState: MutableRefObject<DragState>;
  pointerRef: MutableRefObject<{ x: number; y: number }>;
  frequencyHz: number;
  finishKey: FinishKey;
  useLite: boolean;
  acquireMode: boolean;
  acquireTriggerId: number;
  onTelemetry?: (az: number, el: number) => void;
  onAcquireSettled?: () => void;
}

function CalibreM01({
  scrollState,
  dragState,
  pointerRef,
  frequencyHz,
  finishKey,
  useLite,
  acquireMode,
  acquireTriggerId,
  onTelemetry,
  onAcquireSettled,
}: CalibreM01Props) {
  const stageAssemblyRef = useRef<THREE.Group>(null);
  const watchWrapperRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const wristMountMarkerRef = useRef<THREE.Group>(null);
  const strapGroupRef = useRef<THREE.Group>(null);

  const layerBackRef = useRef<THREE.Group>(null);
  const layerPlateRef = useRef<THREE.Group>(null);
  const layerGearsRef = useRef<THREE.Group>(null);
  const layerTourbillonRef = useRef<THREE.Group>(null);
  const layerHandsRef = useRef<THREE.Group>(null);
  const layerBezelRef = useRef<THREE.Group>(null);
  const layerCrystalRef = useRef<THREE.Group>(null);

  const gearMainRef = useRef<THREE.Mesh>(null);
  const gearPinionRef = useRef<THREE.Mesh>(null);
  const gearPlanetary1Ref = useRef<THREE.Mesh>(null);
  const gearPlanetary2Ref = useRef<THREE.Mesh>(null);
  const balanceWheelRef = useRef<THREE.Group>(null);
  const tourbillonCageRef = useRef<THREE.Group>(null);
  const secondHandRef = useRef<THREE.Group>(null);
  const minuteHandRef = useRef<THREE.Group>(null);
  const hourHandRef = useRef<THREE.Group>(null);

  const screwInstancesRef = useRef<THREE.InstancedMesh>(null);
  const minuteTicksRef = useRef<THREE.InstancedMesh>(null);

  const { camera, size } = useThree();
  const isMobile = size.width < 900;

  const acquireProgressRef = useRef(0);
  const acquireSettledFiredRef = useRef(false);

  // Reset acquire progress whenever Replay or Acquire is newly triggered
  useEffect(() => {
    if (acquireMode) {
      acquireProgressRef.current = 0;
      acquireSettledFiredRef.current = false;
    }
  }, [acquireMode, acquireTriggerId]);

  const brushedRadial = useMemo(() => createBrushedMetalTexture(true), []);
  const brushedLinear = useMemo(() => createBrushedMetalTexture(false), []);

  const geometries = useMemo(() => {
    return {
      mainGear: createGearGeometry(48, 0.62, 0.7, 0.065, 0.16),
      pinionGear: createGearGeometry(28, 0.34, 0.4, 0.055, 0.09),
      planetGear: createGearGeometry(20, 0.24, 0.29, 0.05, 0.07),
      escapeWheel: createGearGeometry(15, 0.17, 0.22, 0.03, 0.05),
      hairspring: createHairspringGeometry(5.5, 0.26),
      screwGeo: new THREE.CylinderGeometry(0.042, 0.042, 0.04, 12),
      tickGeo: new THREE.BoxGeometry(0.016, 0.075, 0.018),
    };
  }, []);

  const palette = FINISH_PALETTES[finishKey];

  const materials = useMemo(() => {
    const initial = FINISH_PALETTES.titanium;
    return {
      caseMat: new THREE.MeshPhysicalMaterial({
        color: initial.caseColor,
        metalness: initial.caseMetalness,
        roughness: initial.caseRoughness,
        anisotropy: 0.72,
        roughnessMap: brushedRadial,
        bumpMap: brushedRadial,
        bumpScale: 0.005,
      }),
      plateMat: new THREE.MeshStandardMaterial({
        color: initial.plateColor,
        metalness: 0.85,
        roughness: 0.4,
        roughnessMap: brushedLinear,
        bumpMap: brushedLinear,
        bumpScale: 0.007,
      }),
      bridgeMat: new THREE.MeshPhysicalMaterial({
        color: initial.bridgeColor,
        metalness: 0.92,
        roughness: 0.22,
        anisotropy: 0.5,
        roughnessMap: brushedLinear,
      }),
      brassMat: new THREE.MeshPhysicalMaterial({
        color: '#d4a86a',
        metalness: 0.95,
        roughness: 0.18,
        anisotropy: 0.65,
        roughnessMap: brushedRadial,
      }),
      gunmetalMat: new THREE.MeshStandardMaterial({
        color: '#464952',
        metalness: 0.9,
        roughness: 0.28,
      }),
      rubyMat: new THREE.MeshPhysicalMaterial({
        color: '#a80f20',
        emissive: '#380208',
        emissiveIntensity: 0.35,
        metalness: 0.05,
        roughness: 0.08,
        transmission: useLite ? 0 : 0.7,
        ior: 1.77,
        thickness: 0.15,
      }),
      lumeMat: new THREE.MeshStandardMaterial({
        color: '#f2ede4',
        emissive: '#f2ede4',
        emissiveIntensity: 0.35,
        roughness: 0.32,
      }),
      sapphireMat: useLite
        ? new THREE.MeshPhysicalMaterial({
            color: '#e8eef5',
            transparent: true,
            opacity: 0.18,
            roughness: 0.06,
            metalness: 0.1,
            clearcoat: 1,
            depthWrite: false,
          })
        : new THREE.MeshPhysicalMaterial({
            color: '#ffffff',
            transmission: 0.94,
            opacity: 1,
            transparent: true,
            roughness: 0.035,
            ior: 1.76,
            thickness: 0.26,
            reflectivity: 0.9,
            clearcoat: 1,
            clearcoatRoughness: 0.04,
            depthWrite: false,
          }),
    };
  }, [brushedRadial, brushedLinear, useLite]);

  useEffect(() => {
    materials.caseMat.color.set(palette.caseColor);
    materials.caseMat.metalness = palette.caseMetalness;
    materials.caseMat.roughness = palette.caseRoughness;
    materials.plateMat.color.set(palette.plateColor);
    materials.bridgeMat.color.set(palette.bridgeColor);
  }, [palette, materials]);

  useLayoutEffect(() => {
    if (screwInstancesRef.current) {
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        _dummy.position.set(Math.cos(ang) * 1.44, Math.sin(ang) * 1.44, 0.05);
        _dummy.rotation.set(Math.PI / 2, 0, 0);
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        screwInstancesRef.current.setMatrixAt(i, _dummy.matrix);
      }
      screwInstancesRef.current.instanceMatrix.needsUpdate = true;
      screwInstancesRef.current.computeBoundingSphere();
    }

    if (minuteTicksRef.current) {
      for (let i = 0; i < 60; i++) {
        const angle = (i * Math.PI * 2) / 60;
        const isFive = i % 5 === 0;
        _dummy.position.set(Math.sin(angle) * 1.47, Math.cos(angle) * 1.47, 0.04);
        _dummy.rotation.set(0, 0, -angle);
        _dummy.scale.set(isFive ? 1.4 : 0.85, isFive ? 1.35 : 0.85, 1);
        _dummy.updateMatrix();
        minuteTicksRef.current.setMatrixAt(i, _dummy.matrix);
      }
      minuteTicksRef.current.instanceMatrix.needsUpdate = true;
      minuteTicksRef.current.computeBoundingSphere();
    }
  }, []);

  useEffect(() => {
    return () => {
      brushedRadial.dispose();
      brushedLinear.dispose();
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [brushedRadial, brushedLinear, geometries, materials]);

  const frameCounter = useRef(0);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const s = scrollState.current;

    // Advance or rewind Acquire sequence (0 -> 1 over ~3.6s)
    if (acquireMode) {
      acquireProgressRef.current = Math.min(1, acquireProgressRef.current + dt / 3.6);
      if (acquireProgressRef.current >= 0.9 && !acquireSettledFiredRef.current) {
        acquireSettledFiredRef.current = true;
        onAcquireSettled?.();
      }
    } else {
      acquireProgressRef.current = Math.max(0, acquireProgressRef.current - dt / 1.1);
    }

    const ap = acquireProgressRef.current;
    const inAcquireBlend = smoothstep(0.02, 0.35, ap);
    const scatterBurst = smoothstep(0.0, 0.34, ap);
    const wristDockBlend = smoothstep(0.32, 0.72, ap);
    const armRise = smoothstep(0.08, 0.52, ap);

    // 1. 360° Drag Inertia + Idle Auto-Rotation
    if (!dragState.current.isDragging) {
      dragState.current.velX *= Math.pow(0.92, dt * 60);
      dragState.current.velY *= Math.pow(0.92, dt * 60);
      dragState.current.rotY += (acquireMode ? dt * 0.06 : dt * 0.2) + dragState.current.velX;
      dragState.current.rotX += dragState.current.velY;
      dragState.current.rotX = THREE.MathUtils.damp(
        dragState.current.rotX,
        acquireMode ? 0.12 : s.modelTiltX,
        1.8,
        dt
      );
    } else {
      dragState.current.rotY += dragState.current.velX;
      dragState.current.rotX += dragState.current.velY;
      dragState.current.velX *= 0.65;
      dragState.current.velY *= 0.65;
    }

    // 2. Stage Assembly Orbit (when Acquire mode is active, orbit the entire Virtual Arm + Watch stage)
    if (stageAssemblyRef.current) {
      const stageTargetX = isMobile ? 0 : THREE.MathUtils.lerp(0, 0.72, inAcquireBlend);
      const stageTargetY = isMobile ? THREE.MathUtils.lerp(0, 0.42, inAcquireBlend) : 0;
      const stageTargetScale = isMobile ? THREE.MathUtils.lerp(1, 0.74, inAcquireBlend) : 1;

      stageAssemblyRef.current.position.x = THREE.MathUtils.damp(
        stageAssemblyRef.current.position.x,
        stageTargetX,
        4.5,
        dt
      );
      stageAssemblyRef.current.position.y = THREE.MathUtils.damp(
        stageAssemblyRef.current.position.y,
        stageTargetY,
        4.5,
        dt
      );
      stageAssemblyRef.current.scale.setScalar(
        THREE.MathUtils.damp(stageAssemblyRef.current.scale.x, stageTargetScale, 4.5, dt)
      );

      stageAssemblyRef.current.rotation.y = THREE.MathUtils.damp(
        stageAssemblyRef.current.rotation.y,
        acquireMode
          ? (dragState.current.rotY + 0.25) * 0.7 + pointerRef.current.x * 0.1
          : 0,
        6,
        dt
      );
      stageAssemblyRef.current.rotation.x = THREE.MathUtils.damp(
        stageAssemblyRef.current.rotation.x,
        acquireMode ? (dragState.current.rotX - 0.12) * 0.55 - pointerRef.current.y * 0.08 : 0,
        6,
        dt
      );
    }

    // 3. Virtual Arm Entrance & Strap Cuff Unfurl
    if (armRef.current) {
      armRef.current.visible = ap > 0.01;
      const easedRise = 1 - Math.pow(1 - armRise, 3);
      armRef.current.position.y = THREE.MathUtils.lerp(-3.4, 0.0, easedRise);
      armRef.current.updateMatrixWorld(true);
    }

    if (strapGroupRef.current) {
      const strapOpen = smoothstep(0.62, 0.92, ap);
      strapGroupRef.current.scale.setScalar(Math.max(0.001, strapOpen));
    }

    // 4. Watch Wrapper Transform: flies from standalone floating pose onto the Virtual Arm Wrist
    if (watchWrapperRef.current && stageAssemblyRef.current) {
      const targetPosX = isMobile ? 0 : s.modelX;
      const targetPosY = isMobile ? 0.62 + s.modelY * 0.35 : s.modelY;

      _floatPos.set(
        targetPosX + pointerRef.current.x * 0.14,
        targetPosY + pointerRef.current.y * 0.1 + Math.sin(t * 1.1) * 0.035,
        s.modelZ
      );

      _floatEuler.set(
        dragState.current.rotX - pointerRef.current.y * 0.1,
        dragState.current.rotY + s.modelRotY + pointerRef.current.x * 0.12,
        0
      );
      _floatQuat.setFromEuler(_floatEuler);

      const floatScale = isMobile ? s.modelScale * 0.68 : s.modelScale;

      if (wristDockBlend > 0.001 && wristMountMarkerRef.current) {
        stageAssemblyRef.current.updateMatrixWorld(true);
        _matStageInv.copy(stageAssemblyRef.current.matrixWorld).invert();
        _matMarker.copy(wristMountMarkerRef.current.matrixWorld);
        _matRel.multiplyMatrices(_matStageInv, _matMarker);
        _matRel.decompose(_targetWristPos, _targetWristQuat, _targetWristScale);

        watchWrapperRef.current.position.lerpVectors(_floatPos, _targetWristPos, wristDockBlend);
        watchWrapperRef.current.quaternion.slerpQuaternions(
          _floatQuat,
          _targetWristQuat,
          wristDockBlend
        );
        const mountedScale = THREE.MathUtils.lerp(floatScale, 0.285, wristDockBlend);
        watchWrapperRef.current.scale.setScalar(mountedScale);
      } else {
        watchWrapperRef.current.position.x = THREE.MathUtils.damp(
          watchWrapperRef.current.position.x,
          _floatPos.x,
          6,
          dt
        );
        watchWrapperRef.current.position.y = THREE.MathUtils.damp(
          watchWrapperRef.current.position.y,
          _floatPos.y,
          6,
          dt
        );
        watchWrapperRef.current.position.z = THREE.MathUtils.damp(
          watchWrapperRef.current.position.z,
          _floatPos.z,
          6,
          dt
        );
        watchWrapperRef.current.quaternion.slerp(_floatQuat, 1 - Math.exp(-7.5 * dt));
        const nextScale = THREE.MathUtils.damp(watchWrapperRef.current.scale.x, floatScale, 5.5, dt);
        watchWrapperRef.current.scale.setScalar(nextScale);
      }
    }

    // 5. Camera Choreography (Scroll vs Acquire Virtual Arm Wrist Frame)
    const targetCamX =
      THREE.MathUtils.lerp(
        isMobile ? s.camX * 0.45 : s.camX,
        isMobile ? 0 : -0.15,
        inAcquireBlend
      ) +
      pointerRef.current.x * 0.22;
    const targetCamY =
      THREE.MathUtils.lerp(s.camY, isMobile ? 0.95 : 0.88, inAcquireBlend) +
      pointerRef.current.y * 0.15;
    const targetCamZ = THREE.MathUtils.lerp(
      isMobile ? s.camZ + 1.55 : s.camZ,
      isMobile ? 5.2 : 4.25,
      inAcquireBlend
    );

    const targetLookX = THREE.MathUtils.lerp(isMobile ? 0 : s.lookX, isMobile ? 0 : 0.18, inAcquireBlend);
    const targetLookY = THREE.MathUtils.lerp(isMobile ? 0.32 : s.lookY, 0.02, inAcquireBlend);

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 4.2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 4.2, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 4.2, dt);
    camera.lookAt(targetLookX, targetLookY, 0);

    // 6. Axial Explosion + Ordered Scatter / Layer-by-Layer Assembly onto Virtual Arm Wrist
    const exp = s.explosion * (1 - inAcquireBlend);
    const layerRefs = [
      layerBackRef,
      layerPlateRef,
      layerGearsRef,
      layerTourbillonRef,
      layerHandsRef,
      layerBezelRef,
      layerCrystalRef,
    ];
    const baseZ = [-0.28, -0.1, 0.02, 0.11, 0.2, 0.16, 0.34];
    const baseY = [0, 0, 0, -0.58, 0, 0, 0];
    const expOffsets = [-1.25, -0.65, 0.05, 0.68, 1.18, 1.65, 2.3];

    for (let i = 0; i < layerRefs.length; i++) {
      const grp = layerRefs[i].current;
      if (!grp) continue;
      const sv = SCATTER_VECTORS[i];
      // Staggered convergence: Caseback (0) lands first -> Sapphire Crystal (6) locks last
      const landStart = 0.42 + i * 0.045;
      const landEnd = 0.68 + i * 0.045;
      const returnBlend = 1 - smoothstep(landStart, landEnd, ap);
      const sc = scatterBurst * returnBlend * (1.05 + i * 0.05);

      const tx = sv.pos[0] * sc;
      const ty = baseY[i] + sv.pos[1] * sc;
      const tz = baseZ[i] + exp * expOffsets[i] + sv.pos[2] * sc;

      grp.position.x = THREE.MathUtils.damp(grp.position.x, tx, 8.5, dt);
      grp.position.y = THREE.MathUtils.damp(grp.position.y, ty, 8.5, dt);
      grp.position.z = THREE.MathUtils.damp(grp.position.z, tz, 8.5, dt);

      grp.rotation.x = THREE.MathUtils.damp(grp.rotation.x, sv.rot[0] * sc, 8.5, dt);
      grp.rotation.y = THREE.MathUtils.damp(grp.rotation.y, sv.rot[1] * sc, 8.5, dt);
      grp.rotation.z = THREE.MathUtils.damp(grp.rotation.z, sv.rot[2] * sc, 8.5, dt);
    }

    // 7. Live Mechanical Horology Kinematics
    const speedFactor = frequencyHz === 0 ? 0 : frequencyHz / 4;
    if (speedFactor > 0) {
      if (gearMainRef.current) gearMainRef.current.rotation.z -= dt * 0.25 * speedFactor;
      if (gearPinionRef.current) gearPinionRef.current.rotation.z += dt * 0.43 * speedFactor;
      if (gearPlanetary1Ref.current)
        gearPlanetary1Ref.current.rotation.z += dt * 0.6 * speedFactor;
      if (gearPlanetary2Ref.current)
        gearPlanetary2Ref.current.rotation.z -= dt * 0.6 * speedFactor;

      if (tourbillonCageRef.current)
        tourbillonCageRef.current.rotation.z -= dt * ((Math.PI * 2) / 60) * 4 * speedFactor;

      if (balanceWheelRef.current) {
        const oscFreq = frequencyHz * Math.PI * 2;
        balanceWheelRef.current.rotation.z = Math.sin(t * oscFreq) * 1.35;
      }

      if (secondHandRef.current) {
        const ticks = Math.floor(t * frequencyHz * 2) / (frequencyHz * 2);
        secondHandRef.current.rotation.z = -ticks * ((Math.PI * 2) / 60);
      }
      if (minuteHandRef.current) {
        minuteHandRef.current.rotation.z = -t * 0.012 * speedFactor - 0.7;
      }
      if (hourHandRef.current) {
        hourHandRef.current.rotation.z = -t * 0.001 * speedFactor + 0.85;
      }
    }

    frameCounter.current += 1;
    if (frameCounter.current % 6 === 0 && onTelemetry) {
      const degY = (((dragState.current.rotY * 180) / Math.PI) % 360 + 360) % 360;
      const degX = Math.round((dragState.current.rotX * 180) / Math.PI);
      onTelemetry(Math.round(degY), degX);
    }
  });

  const hourIndices = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  return (
    <group ref={stageAssemblyRef}>
      {/* Clean Sculpted Virtual Forearm, Wrist & Hand */}
      <VirtualArm
        armRef={armRef}
        wristMountMarkerRef={wristMountMarkerRef}
        strapGroupRef={strapGroupRef}
        caseMaterial={materials.caseMat}
      />

      {/* Calibre M-01 Timepiece */}
      <group ref={watchWrapperRef}>
        {/* LAYER 1: Exhibition Caseback Ring */}
        <group ref={layerBackRef}>
          <mesh material={materials.caseMat} castShadow receiveShadow>
            <torusGeometry args={[1.65, 0.14, 24, 72]} />
          </mesh>
          <mesh
            material={materials.plateMat}
            position={[0, 0, -0.04]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[1.64, 1.56, 0.1, 64, 1, true]} />
          </mesh>
        </group>

        {/* LAYER 2: Skeletonized Mainplate, Bridges & Instanced Perimeter Screws */}
        <group ref={layerPlateRef}>
          <mesh material={materials.plateMat} receiveShadow>
            <ringGeometry args={[0.92, 1.58, 64]} />
          </mesh>
          <mesh material={materials.plateMat} rotation={[0, 0, Math.PI / 4]} castShadow>
            <boxGeometry args={[2.9, 0.24, 0.07]} />
          </mesh>
          <mesh material={materials.plateMat} rotation={[0, 0, -Math.PI / 4]} castShadow>
            <boxGeometry args={[2.9, 0.24, 0.07]} />
          </mesh>
          <instancedMesh
            ref={screwInstancesRef}
            args={[geometries.screwGeo, materials.brassMat, 8]}
          />
        </group>

        {/* LAYER 3: Precision Gear Train & Synthetic Ruby Bearings */}
        <group ref={layerGearsRef}>
          <mesh
            ref={gearMainRef}
            geometry={geometries.mainGear}
            material={materials.brassMat}
            position={[-0.36, 0.44, 0]}
            castShadow
          />
          <mesh
            material={materials.rubyMat}
            position={[-0.36, 0.44, 0.05]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.08, 0.08, 0.04, 20]} />
          </mesh>

          <mesh
            ref={gearPinionRef}
            geometry={geometries.pinionGear}
            material={materials.gunmetalMat}
            position={[0, 0, 0.03]}
            castShadow
          />
          <mesh
            material={materials.rubyMat}
            position={[0, 0, 0.07]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.07, 0.07, 0.04, 20]} />
          </mesh>

          <mesh
            ref={gearPlanetary1Ref}
            geometry={geometries.planetGear}
            material={materials.brassMat}
            position={[0.62, 0.25, -0.02]}
            castShadow
          />
          <mesh
            material={materials.rubyMat}
            position={[0.62, 0.25, 0.025]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.055, 0.055, 0.035, 16]} />
          </mesh>

          <mesh
            ref={gearPlanetary2Ref}
            geometry={geometries.planetGear}
            material={materials.bridgeMat}
            position={[-0.65, -0.28, -0.02]}
            castShadow
          />
        </group>

        {/* LAYER 4: Flying Tourbillon Cage, Balance Wheel & Spiral Hairspring */}
        <group ref={layerTourbillonRef} position={[0, -0.58, 0]}>
          <mesh material={materials.bridgeMat} position={[0, 0, 0.14]} castShadow>
            <boxGeometry args={[1.05, 0.12, 0.045]} />
          </mesh>
          <mesh
            material={materials.rubyMat}
            position={[0, 0, 0.175]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.06, 0.06, 0.03, 20]} />
          </mesh>

          <group ref={tourbillonCageRef}>
            <mesh material={materials.bridgeMat}>
              <torusGeometry args={[0.42, 0.022, 12, 48]} />
            </mesh>
            <mesh material={materials.bridgeMat} rotation={[0, 0, Math.PI / 3]}>
              <boxGeometry args={[0.84, 0.035, 0.02]} />
            </mesh>
            <mesh material={materials.bridgeMat} rotation={[0, 0, -Math.PI / 3]}>
              <boxGeometry args={[0.84, 0.035, 0.02]} />
            </mesh>

            <mesh
              geometry={geometries.escapeWheel}
              material={materials.brassMat}
              position={[0.21, 0, -0.04]}
            />

            <group ref={balanceWheelRef} position={[0, 0, 0.03]}>
              <mesh material={materials.brassMat}>
                <torusGeometry args={[0.31, 0.026, 14, 48]} />
              </mesh>
              <mesh material={materials.brassMat}>
                <boxGeometry args={[0.6, 0.028, 0.018]} />
              </mesh>
              <mesh
                geometry={geometries.hairspring}
                material={materials.brassMat}
                position={[0, 0, 0.025]}
              />
            </group>
          </group>
        </group>

        {/* LAYER 5: Cathedral Hands & Central Arbour */}
        <group ref={layerHandsRef}>
          <group ref={hourHandRef}>
            <mesh material={materials.bridgeMat} position={[0, 0.36, 0]} castShadow>
              <boxGeometry args={[0.09, 0.78, 0.025]} />
            </mesh>
            <mesh material={materials.lumeMat} position={[0, 0.5, 0.015]}>
              <boxGeometry args={[0.035, 0.36, 0.01]} />
            </mesh>
          </group>

          <group ref={minuteHandRef} position={[0, 0, 0.04]}>
            <mesh material={materials.bridgeMat} position={[0, 0.56, 0]} castShadow>
              <boxGeometry args={[0.06, 1.18, 0.022]} />
            </mesh>
            <mesh material={materials.lumeMat} position={[0, 0.78, 0.014]}>
              <boxGeometry args={[0.022, 0.54, 0.01]} />
            </mesh>
          </group>

          <group ref={secondHandRef} position={[0, 0, 0.08]}>
            <mesh material={materials.brassMat} position={[0, 0.45, 0]}>
              <boxGeometry args={[0.022, 1.48, 0.014]} />
            </mesh>
            <mesh material={materials.brassMat} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.075, 0.075, 0.04, 24]} />
            </mesh>
          </group>
        </group>

        {/* LAYER 6: Brushed Bezel, Rehaut Indices, Minute Ticks & Crown */}
        <group ref={layerBezelRef}>
          <mesh material={materials.caseMat} castShadow receiveShadow>
            <torusGeometry args={[1.68, 0.16, 28, 84]} />
          </mesh>
          <mesh material={materials.brassMat} position={[0, 0, 0.05]}>
            <torusGeometry args={[1.53, 0.022, 16, 72]} />
          </mesh>

          <instancedMesh
            ref={minuteTicksRef}
            args={[geometries.tickGeo, materials.brassMat, 60]}
          />

          {hourIndices.map((idx) => {
            const angle = (idx * Math.PI * 2) / 12;
            const isCardinal = idx % 3 === 0;
            return (
              <mesh
                key={idx}
                material={isCardinal ? materials.lumeMat : materials.brassMat}
                position={[Math.sin(angle) * 1.35, Math.cos(angle) * 1.35, 0.03]}
                rotation={[0, 0, -angle]}
              >
                <boxGeometry
                  args={[isCardinal ? 0.065 : 0.03, isCardinal ? 0.22 : 0.13, 0.04]}
                />
              </mesh>
            );
          })}

          <group position={[1.92, 0, -0.08]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh material={materials.caseMat} castShadow>
              <cylinderGeometry args={[0.16, 0.16, 0.18, 24]} />
            </mesh>
            <mesh material={materials.brassMat} position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.03, 24]} />
            </mesh>
          </group>

          {(
            [
              [-1.08, 1.55],
              [1.08, 1.55],
              [-1.08, -1.55],
              [1.08, -1.55],
            ] as const
          ).map(([lx, ly], i) => (
            <mesh
              key={i}
              material={materials.caseMat}
              position={[lx, ly, -0.1]}
              rotation={[0, 0, lx > 0 ? -0.18 : 0.18]}
              castShadow
            >
              <boxGeometry args={[0.32, 0.56, 0.24]} />
            </mesh>
          ))}
        </group>

        {/* LAYER 7: Domed Sapphire Crystal */}
        <group ref={layerCrystalRef}>
          <mesh
            material={materials.sapphireMat}
            scale={[1, 1, 0.26]}
            rotation={[Math.PI / 2, 0, 0]}
            renderOrder={10}
          >
            <sphereGeometry args={[1.64, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

interface ChronometerSceneProps {
  scrollState: MutableRefObject<ScrollChoreographyState>;
  frequencyHz: number;
  finishKey: FinishKey;
  isLite: boolean;
  acquireMode: boolean;
  acquireTriggerId: number;
  onReady?: () => void;
  onDragChange?: (dragging: boolean) => void;
  onTelemetry?: (az: number, el: number) => void;
  onAcquireSettled?: () => void;
}

export default function ChronometerScene({
  scrollState,
  frequencyHz,
  finishKey,
  isLite,
  acquireMode,
  acquireTriggerId,
  onReady,
  onDragChange,
  onTelemetry,
  onAcquireSettled,
}: ChronometerSceneProps) {
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const useLite = isLite || isSoftwareGl;
  const [contextLost, setContextLost] = useState(false);

  const dragState = useRef<DragState>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    velX: 0,
    velY: 0,
    rotY: -0.25,
    rotX: 0.14,
  });

  const pointerRef = useRef({ x: 0, y: 0 });
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);

      if (dragState.current.isDragging) {
        const dx = e.clientX - dragState.current.lastX;
        const dy = e.clientY - dragState.current.lastY;
        dragState.current.velX = dx * 0.0085;
        dragState.current.velY = dy * 0.0065;
        dragState.current.lastX = e.clientX;
        dragState.current.lastY = e.clientY;
      }
    };

    const onPointerUp = () => {
      if (dragState.current.isDragging) {
        dragState.current.isDragging = false;
        onDragChange?.(false);
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onDragChange]);

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => {
      setContextLost(false);
    };

    el.addEventListener('webglcontextlost', handleLost);
    el.addEventListener('webglcontextrestored', handleRestored);
    return () => {
      el.removeEventListener('webglcontextlost', handleLost);
      el.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [contextLost]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current.isDragging = true;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    onDragChange?.(true);
  };

  if (contextLost) {
    return (
      <div className="fixed inset-0 z-[1] flex items-center justify-center bg-[#09090b]">
        <div className="border border-[#d4a86a]/30 bg-[#121216] p-8 text-center">
          <p className="font-display text-2xl text-[#f2ede4]">Calibre M-01 Blueprint</p>
          <p className="mt-2 text-sm text-[#9a948a]">
            Hardware graphics context suspended. Restoring viewport.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="canvas-stage fixed inset-0 z-[1]"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={handlePointerDown}
    >
      <Canvas
        shadows={!useLite}
        dpr={useLite ? 1 : [1, 2]}
        camera={{ position: [0, 0, 6.2], fov: 38, near: 0.1, far: 40 }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.14,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          canvasElRef.current = gl.domElement;
          onReady?.();
        }}
      >
        <color attach="background" args={['#09090b']} />
        <fog attach="fog" args={['#09090b', 9.5, 24]} />

        <Environment resolution={useLite ? 128 : 256}>
          <Lightformer
            form="rect"
            intensity={2.6}
            color="#fff3de"
            scale={[10, 4, 1]}
            position={[0, 5, 3]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={3.1}
            color="#9ab2cf"
            scale={[3, 9, 1]}
            position={[-6, 1, -1]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <Lightformer
            form="circle"
            intensity={2.6}
            color="#e2b472"
            scale={5}
            position={[6, -1, 3]}
            rotation={[0, -Math.PI / 2, 0]}
          />
          <Lightformer
            form="ring"
            intensity={1.1}
            color="#5c4a32"
            scale={7}
            position={[0, -5, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        </Environment>

        <hemisphereLight args={['#a9c2e2', '#2d2217', 0.48]} />
        <directionalLight
          position={[4.5, 5.5, 6]}
          intensity={2.35}
          color="#fff3e0"
          castShadow={!useLite}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-4.5}
          shadow-camera-right={4.5}
          shadow-camera-top={4.5}
          shadow-camera-bottom={-4.5}
          shadow-camera-near={0.5}
          shadow-camera-far={22}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <spotLight
          position={[-5, 2, -4]}
          angle={0.5}
          penumbra={1}
          intensity={2.8}
          color="#8faad1"
        />
        <pointLight position={[2.5, -2.5, 3]} intensity={1.25} color="#d4a86a" />

        {/* Pulsing Golden Background Ambience */}
        <GoldPulseAmbience pointerRef={pointerRef} acquireMode={acquireMode} />

        {/* Calibre M-01 + Mannequin Fitting Assembly */}
        <CalibreM01
          scrollState={scrollState}
          dragState={dragState}
          pointerRef={pointerRef}
          frequencyHz={frequencyHz}
          finishKey={finishKey}
          useLite={useLite}
          acquireMode={acquireMode}
          acquireTriggerId={acquireTriggerId}
          onTelemetry={onTelemetry}
          onAcquireSettled={onAcquireSettled}
        />

        {/* Cursor-Following & Ambient Golden Particles */}
        <GoldenParticles totalCount={useLite ? 140 : 420} pointerRef={pointerRef} />

        {!useLite && (
          <ContactShadows
            position={[0, -2.75, 0]}
            opacity={0.42}
            scale={11}
            blur={2.8}
            far={4.5}
            color="#000000"
          />
        )}
      </Canvas>
    </div>
  );
}
