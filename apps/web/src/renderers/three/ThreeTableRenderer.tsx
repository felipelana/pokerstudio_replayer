import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import type { TableRendererProps } from '../TableRenderer';
import { Amount } from '../Amount';
import { cardWidthFor } from '../cardSize';
import { avoidZones, chipBreakdown, type FeltBox } from '../layout';
import { shapePoints } from '../tableShape';
import { haloShadow, readableInk } from '@/ui/contrast';
import { SeatPlate, seatLabels, type SeatLabels } from '../seats/SeatPlate';
import { SvgTableRenderer } from '../svg/SvgTableRenderer';
import { cardCanvas } from '@/ui/cards/cardTexture';
import type { DeckSkin, FeltSkin, Skin, TableSkin } from '@/skins/types';
import { CARD_H, CARD_W } from '@/ui/cards/primitives';
import { useAssetImage } from '@/ui/hooks/useAssetImage';

/* Table dimensions in world units (x = long axis, z = towards the viewer). */
const RX = 5.2;
const CARD_WIDTH = 0.95;
const CARD_HEIGHT = (CARD_WIDTH * CARD_H) / CARD_W;
/** Board cards lean towards the camera (radians from flat) so ranks stay legible. */
/**
 * Reference distance for on-felt amounts. Chosen so the type keeps the size it
 * had at the replayer's camera, while shrinking with the table in a preview.
 */
const LABEL_DISTANCE = 9;

/** Where the pot block sits: clear of the board, which leans towards the camera. */
const POT_Z = 1.5;

const CARD_TILT = 0.72;

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */

const textureCache = new Map<string, THREE.CanvasTexture>();

function cardTexture(card: string | 'back', deck: DeckSkin, art?: HTMLImageElement): THREE.CanvasTexture {
  const key = `${card}|${art?.src ?? ''}|${JSON.stringify(deck)}`;
  let tex = textureCache.get(key);
  if (!tex) {
    tex = new THREE.CanvasTexture(cardCanvas(card, deck, 6, art));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    textureCache.set(key, tex);
  }
  return tex;
}

function feltTexture(felt: FeltSkin, logo?: HTMLImageElement): THREE.CanvasTexture {
  const key = `felt|${JSON.stringify(felt)}|${logo?.src ?? ''}`;
  let tex = textureCache.get(key);
  if (!tex) {
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = felt.color;
    ctx.fillRect(0, 0, size, size);
    // Fine noise texture
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    const amp = felt.textureIntensity * 22;
    let seed = 1234567;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = ((seed >>> 8) / 16777216 - 0.5) * amp;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    // Soft pool of light in the middle, fading into the vignette.
    const g = ctx.createRadialGradient(size / 2, size * 0.46, size * 0.08, size / 2, size / 2, size * 0.6);
    g.addColorStop(0, `rgba(255,255,255,${0.06 + felt.textureIntensity * 0.05})`);
    g.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.addColorStop(1, hexToRgba(felt.vignetteColor, felt.vignetteStrength));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // Inner shadow cast by the rail onto the felt (outermost ~8% of the radius).
    const inner = ctx.createRadialGradient(size / 2, size / 2, size * 0.44, size / 2, size / 2, size * 0.5);
    inner.addColorStop(0, 'rgba(0,0,0,0)');
    inner.addColorStop(0.6, hexToRgba(felt.vignetteColor, 0.28));
    inner.addColorStop(1, hexToRgba(felt.vignetteColor, 0.8));
    ctx.fillStyle = inner;
    ctx.fillRect(0, 0, size, size);
    // Uploaded watermark, centred and scaled to ~44% of the felt width.
    if (logo && logo.naturalWidth > 0) {
      const scale = Math.min((size * 0.56) / logo.naturalWidth, (size * 0.44) / logo.naturalHeight);
      const w = logo.naturalWidth * scale;
      const h = logo.naturalHeight * scale;
      ctx.save();
      ctx.globalAlpha = felt.logoOpacity;
      ctx.drawImage(logo, (size - w) / 2, (size - h) / 2, w, h);
      ctx.restore();
    }
    if (felt.logoText) {
      ctx.font = `700 ${size * 0.09}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${felt.logoOpacity})`;
      ctx.fillText(felt.logoText, size / 2, size * 0.66);
    }
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(key, tex);
  }
  return tex;
}

/** Procedural wood grain for the rail, built from the skin's two rail colours. */
function woodTexture(table: TableSkin): THREE.CanvasTexture {
  const key = `wood|${JSON.stringify(table)}`;
  let tex = textureCache.get(key);
  if (!tex) {
    const w = 1024;
    const h = 256;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = table.railColor;
    ctx.fillRect(0, 0, w, h);
    // Grain: long, slightly wavy strokes alternating between the two tones.
    let seed = 987654321;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) >>> 8) / 16777216;
    for (let i = 0; i < 260; i++) {
      const y = rand() * h;
      const amp = 2 + rand() * 6;
      const alpha = 0.04 + rand() * 0.16;
      ctx.strokeStyle = rand() > 0.45 ? hexToRgba(table.railHighlight, alpha) : `rgba(0,0,0,${alpha * 0.8})`;
      ctx.lineWidth = 0.6 + rand() * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin((x / w) * Math.PI * (1 + rand()) + i) * amp);
      ctx.stroke();
    }
    // Top-lit sheen across the rail width.
    const sheen = ctx.createLinearGradient(0, 0, 0, h);
    sheen.addColorStop(0, `rgba(255,255,255,${0.05 + table.railShine * 0.16})`);
    sheen.addColorStop(0.5, 'rgba(0,0,0,0.05)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.09, 0.09);
    tex.anisotropy = 8;
    textureCache.set(key, tex);
  }
  return tex;
}

/** Top-face texture for a chip, with its denomination printed (R22). */
function chipTopTexture(color: string, denom: number): THREE.CanvasTexture {
  const key = `chip|${color}|${denom}`;
  let tex = textureCache.get(key);
  if (!tex) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const label = denom >= 1e6 ? `${denom / 1e6}M` : denom >= 1000 ? `${denom / 1000}K` : String(denom);
    ctx.font = `700 ${size * 0.3}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(label, size / 2, size / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, size / 2, size / 2);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    textureCache.set(key, tex);
  }
  return tex;
}

/** Radial fade used as the table's drop shadow on the page background. */
function shadowTexture(): THREE.CanvasTexture {
  const key = 'table-shadow';
  let tex = textureCache.get(key);
  if (!tex) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.16, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex = new THREE.CanvasTexture(c);
    textureCache.set(key, tex);
  }
  return tex;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Meshes                                                              */
/* ------------------------------------------------------------------ */

/** Soft radial band used for the neon halo around the felt. */
function glowTexture(): THREE.CanvasTexture {
  const key = 'neon-glow';
  let tex = textureCache.get(key);
  if (!tex) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    // The band lives INSIDE the felt: it fades to zero before the rail, so the
    // glow washes inwards over the cloth instead of spilling onto the wood.
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.58, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.34)');
    g.addColorStop(0.9, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.965, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex = new THREE.CanvasTexture(c);
    textureCache.set(key, tex);
  }
  return tex;
}

/** Table outline as a THREE.Shape, following the skin's shape (R20). */
function outlineShape(shape: ReturnType<typeof shapeOf>, rx: number, rz: number): THREE.Shape {
  const s = new THREE.Shape();
  const pts = shapePoints(shape, rx, rz, 160);
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

function outlinePath(shape: ReturnType<typeof shapeOf>, rx: number, rz: number): THREE.Path {
  const p = new THREE.Path();
  const pts = shapePoints(shape, rx, rz, 160).reverse();
  pts.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  p.closePath();
  return p;
}

const shapeOf = (skin: Skin) => skin.table.shape ?? 'ellipse';

function Table({ skin, neon, feltLogo }: { skin: Skin; neon: boolean; feltLogo?: HTMLImageElement }) {
  const rz = RX * skin.table.aspect;
  const railW = skin.table.railWidth * RX * 2;
  const felt = useMemo(() => feltTexture(skin.felt, feltLogo), [skin.felt, feltLogo]);
  const wood = useMemo(() => woodTexture(skin.table), [skin.table]);
  const shadow = useMemo(() => shadowTexture(), []);
  const glow = useMemo(() => glowTexture(), []);
  const bevelGeo = useMemo(() => {
    const b = skin.table.bevel;
    if (!b) return undefined;
    const inset = rz * b.inset;
    const width = Math.max(0.01, rz * b.width);
    const outer = outlineShape(shapeOf(skin), RX - inset, rz - inset);
    outer.holes.push(outlinePath(shapeOf(skin), RX - inset - width, rz - inset - width));
    return new THREE.ShapeGeometry(outer, 96);
  }, [skin, rz]);
  const neonStrength = neon ? (skin.table.neonIntensity ?? 0) : 0;
  const neonColor = skin.table.neonColor ?? skin.plates.activeBorder;

  const shape = shapeOf(skin);
  const feltGeo = useMemo(() => {
    const geo = new THREE.ShapeGeometry(outlineShape(shape, RX, rz), 96);
    // Map UVs to 0..1 across the ellipse bounding box.
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / (2 * RX) + 0.5, pos.getY(i) / (2 * rz) + 0.5);
    }
    uv.needsUpdate = true;
    return geo;
  }, [rz, shape]);

  /** Rail body: rounded outer edge, thin inner lip, extruded downwards. */
  const railGeo = useMemo(() => {
    const outer = outlineShape(shape, RX + railW, rz + railW);
    outer.holes.push(outlinePath(shape, RX, rz));
    return new THREE.ExtrudeGeometry(outer, {
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.16,
      bevelSize: 0.14,
      bevelSegments: 6,
      curveSegments: 128,
    });
  }, [rz, railW, shape]);

  /** Dark lip between rail and felt — reads as the sunken felt edge. */
  const lipGeo = useMemo(() => {
    const outer = outlineShape(shape, RX + 0.06, rz + 0.06);
    outer.holes.push(outlinePath(shape, RX - 0.16, rz - 0.16));
    return new THREE.ExtrudeGeometry(outer, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
      curveSegments: 128,
    });
  }, [rz, shape]);

  return (
    <group>
      {/* Drop shadow on the page background, so the table reads as a solid object. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0.35]} renderOrder={-1}>
        <planeGeometry args={[(RX + railW) * 2.5, (rz + railW) * 2.8]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} opacity={0.55} />
      </mesh>

      <mesh geometry={railGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={wood}
          color={skin.table.railColor}
          roughness={0.62 - skin.table.railShine * 0.28}
          metalness={0.04}
          clearcoat={0.35 + skin.table.railShine * 0.5}
          clearcoatRoughness={0.35}
        />
      </mesh>

      <mesh geometry={lipGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <meshStandardMaterial color={skin.felt.vignetteColor} roughness={0.85} metalness={0} />
      </mesh>

      <mesh geometry={feltGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial map={felt} roughness={0.96} metalness={0} />
      </mesh>

      {/* Neon: a bright edge on the felt plus a halo bleeding over the rail. */}
      {neonStrength > 0 && (
        <group>
          {/* Halo mapped exactly onto the felt ellipse — nothing reaches the rail. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={-1}>
            <planeGeometry args={[RX * 2, rz * 2]} />
            <meshBasicMaterial
              map={glow}
              color={neonColor}
              transparent
              opacity={0.62 * neonStrength}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <group scale={[RX * 0.9, rz * 0.9, 1]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
            {/* Below every card: the felt glow must never wash over the board. */}
            <mesh renderOrder={-1}>
              <ringGeometry args={[0.982, 1, 192]} />
              <meshBasicMaterial
                color={neonColor}
                transparent
                opacity={0.55 + 0.45 * neonStrength}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
          {/* Coloured bounce light so the rail and chips pick up the neon. */}
          <pointLight position={[0, 0.8, 0]} intensity={16 * neonStrength} distance={12} decay={2} color={neonColor} />
        </group>
      )}

      {/* Inner groove following the contour — the finishing detail (R20). */}
      {skin.table.bevel && bevelGeo && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} geometry={bevelGeo}>
          <meshBasicMaterial color={skin.table.bevel.color} transparent opacity={skin.table.bevel.opacity} depthWrite={false} />
        </mesh>
      )}

      {/* Betting line */}
      <group scale={[RX - 0.55, rz - 0.45, 1]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <mesh>
          <ringGeometry args={[0.99, 1, 192]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.1} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Scale-in animation for newly mounted objects (chips, cards). */
function Appear({ children, enabled, delay = 0 }: { children: ReactNode; enabled: boolean; delay?: number }) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef(performance.now() + delay);
  useFrame(() => {
    if (!ref.current) return;
    if (!enabled) {
      ref.current.scale.setScalar(1);
      return;
    }
    const t = Math.min(1, Math.max(0, (performance.now() - start.current) / 200));
    const s = 0.6 + 0.4 * (1 - (1 - t) * (1 - t));
    ref.current.scale.setScalar(s);
  });
  return <group ref={ref}>{children}</group>;
}

function CardMesh({
  card,
  deck,
  position,
  rotationY = 0,
  scale = 1,
  art,
}: {
  card: string;
  deck: DeckSkin;
  position: [number, number, number];
  rotationY?: number;
  /** Card zoom (R21). */
  scale?: number;
  /** Artwork for this card's rank, when the skin sets one. */
  art?: HTMLImageElement;
}) {
  const tex = useMemo(() => cardTexture(card, deck, art), [card, deck, art]);
  const back = useMemo(() => cardTexture('back', deck), [deck]);
  // Lift the card so its bottom edge rests on the felt once tilted.
  const lift = (CARD_HEIGHT / 2) * Math.sin(CARD_TILT) + 0.01;
  return (
    <group position={[position[0], position[1] + lift, position[2]]} rotation={[-Math.PI / 2 + CARD_TILT, 0, rotationY]} scale={scale}>
      <mesh castShadow renderOrder={5}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        {/* Low roughness + a little metalness gives the printed face a glossy sheen.
            `transparent` + `alphaTest` keep the rounded corners see-through instead
            of painting the cleared texels black. */}
        <meshStandardMaterial map={tex} roughness={0.28} metalness={0.06} transparent alphaTest={0.05} />
      </mesh>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, 0, -0.004]}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshStandardMaterial map={back} roughness={0.32} metalness={0.06} />
      </mesh>
    </group>
  );
}

function ChipStack3D({
  chips,
  skin,
  position,
  zoom = 1,
  denominations = true,
}: {
  chips: number[];
  skin: Skin;
  position: [number, number, number];
  zoom?: number;
  denominations?: boolean;
}) {
  const top = chips.length ? chips[chips.length - 1] : undefined;
  return (
    <group position={position} scale={zoom}>
      {chips.map((d, i) => (
        <mesh key={i} position={[0, 0.03 + i * 0.06, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.06, 28]} />
          <meshStandardMaterial color={skin.chips.colors[String(d)] ?? '#888'} roughness={0.5} />
        </mesh>
      ))}
      {chips.length > 0 && top !== undefined && (
        <mesh position={[0, 0.03 + chips.length * 0.06 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          {denominations ? (
            <>
              <circleGeometry args={[0.19, 28]} />
              <meshBasicMaterial map={chipTopTexture(skin.chips.colors[String(top)] ?? '#888', top)} />
            </>
          ) : (
            <>
              <ringGeometry args={[0.1, 0.14, 24]} />
              <meshBasicMaterial color={skin.chips.edge} transparent opacity={0.8} />
            </>
          )}
        </mesh>
      )}
    </group>
  );
}

function DealerButton({ skin, position, label }: { skin: Skin; position: [number, number, number]; label: string }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = skin.chips.dealerButton;
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.chips.dealerButtonInk;
    ctx.font = '800 72px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [skin.chips.dealerButton, skin.chips.dealerButtonInk, label]);
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.06, 32]} />
        <meshStandardMaterial color={skin.chips.dealerButton} />
      </mesh>
      <mesh position={[0, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 32]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

/** Translated strings used inside the canvas root (no hooks/context available there). */
interface SceneLabels {
  pot: string;
  dealer: string;
  mainPot: string;
  sidePot: (index: number) => string;
  seat: (seat: number) => string;
  seats: SeatLabels;
}

function Scene(props: TableRendererProps & { labels: SceneLabels; feltLogo?: HTMLImageElement }) {
  const { hand, frame, skin, slots, heroName, positions, showKnownHands, hideHeroCards, lookupUrlFor, holeLayout, zoomCards = 1, zoomChips = 1, boardGapRatio, deckArt, hideBoard, chipDenominations = true, fmt, exact, onSeatClick, interactive = true, animations, labels, feltLogo } = props;
  const rz = RX * skin.table.aspect;
  const railW = skin.table.railWidth * RX * 2;
  const isCash = hand.currency !== 'chips';
  const bySeat = new Map(frame.players.map((p) => [p.seat, p]));
  const winners = new Set(frame.kind === 'end' ? frame.players.filter((p) => p.collected > 0).map((p) => p.name) : []);

  // The skin sets the spacing; the quick controls can override it for the
  // session in front of you.
  const boardGap = CARD_WIDTH * (boardGapRatio ?? skin.deck.boardGap ?? 0.36);
  // Centre on the cards actually dealt, so the flop and turn are never
  // left-aligned inside an empty five-card row.
  const boardCount = Math.max(1, frame.board.length);
  const boardX0 = -((boardCount * CARD_WIDTH + (boardCount - 1) * boardGap) / 2) + CARD_WIDTH / 2;

  // Ink follows the felt so on-table text always passes AA (R16).
  const ink = readableInk(skin.felt.color);
  // Reserved bands: board in the middle, pot right below it (R4). The board
  // cards lean back towards the camera, so their footprint on screen is taller
  // than the flat rectangle — the band has to cover the whole leaning card, or
  // a bet label lands on it.
  const boardZone: FeltBox = {
    x: 0,
    y: 0,
    hw: (boardCount * CARD_WIDTH + (boardCount - 1) * boardGap) / 2 / RX + 0.04,
    hh: (CARD_HEIGHT * 0.8) / rz + 0.04,
  };
  // The pot block is as wide as its widest line: the total, or the row of side
  // pots underneath it.
  const potHalfWidth = Math.max(1.5, frame.pots.length * 0.75);
  const potZone: FeltBox = { x: 0, y: POT_Z / rz, hw: potHalfWidth / RX + 0.03, hh: 0.85 / rz };
  // And the pot's own chip stack, so a bet label never lands on the chips.
  const potChipsZone: FeltBox = { x: -2.9 / RX, y: POT_Z / rz, hw: 1.1 / RX, hh: 0.8 / rz };
  const zones = frame.pot > 0 ? [boardZone, potZone, potChipsZone] : [boardZone, potZone];

  return (
    <>
      <ambientLight intensity={0.6} />
      {/* Pool of light over the felt, like a lamp above the table. */}
      <spotLight position={[0, 11, 1.5]} angle={0.8} penumbra={0.9} intensity={180} distance={30} decay={2} color="#fff6e6" />
      <directionalLight
        position={[3, 12, 5]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0005}
      />
      <pointLight position={[-6, 6, -4]} intensity={0.4} />

      <Table skin={skin} neon={props.neon !== false} feltLogo={feltLogo} />

      {/* Board */}
      {(hideBoard ? [] : frame.board).map((c, i) => (
        <Appear key={c} enabled={animations} delay={i * 40}>
          <CardMesh card={c} deck={skin.deck} position={[boardX0 + i * (CARD_WIDTH + boardGap), 0.05, 0]} scale={zoomCards} art={deckArt?.[c[0]]} />
        </Appear>
      ))}

      {/* Pot chips */}
      {frame.pot > 0 && (
        <Appear enabled={animations}>
          <ChipStack3D chips={chipBreakdown(frame.pot, isCash, 10)} skin={skin} position={[-2.9, 0, POT_Z]} zoom={zoomChips} denominations={chipDenominations} />
        </Appear>
      )}

      {/* Pot label */}
      {/* Board dead centre; the pot block (total + side pots) sits right under
          it, clear of the bet ring, so nothing can overlap. */}
      <Html position={[0, 0.05, POT_Z]} center distanceFactor={LABEL_DISTANCE} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        {/* No box, no border: just type on the felt, kept legible by a soft halo. */}
        <div
          className="flex flex-col items-center whitespace-nowrap"
          style={{ color: ink, textShadow: haloShadow(skin.felt.color) }}
        >
          <span className="text-[9.5px] font-semibold uppercase leading-none tracking-[0.2em] opacity-70">
            {labels.pot}
          </span>
          <Amount value={fmt(frame.totalPot)} size={26} className="mt-1 leading-none" />
          {frame.pots.length > 1 && (
            // Side pots as bare amounts — the wording lives in the tooltip only.
            <div className="mt-1.5 flex items-center justify-center gap-1">
              {frame.pots.map((p, i) => (
                <span
                  key={i}
                  className="px-1 text-[11px] font-medium leading-[15px] tabular-nums opacity-80"
                  title={p.kind === 'main' ? labels.mainPot : labels.sidePot(p.index)}
                >
                  {fmt(p.amount)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Html>

      {/* Bets, dealer button and seats */}
      {slots.map((slot) => {
        const p = bySeat.get(slot.seat);
        // Chips + label as one group, kept inside the felt (R2) and out of the
        // board / pot bands (R4).
        const stackTop = -((p?.streetBet ? chipBreakdown(p.streetBet, isCash).length : 0) * 0.06 + 0.12);
        const labelBottom = 0.95;
        const offsetZ = (stackTop + labelBottom) / 2;
        const bet = avoidZones(
          {
            x: slot.betX,
            y: slot.betY + offsetZ / rz,
            hw: Math.max(0.5, (fmt(p?.streetBet ?? 0).length * 0.13) / 2) / RX,
            hh: (labelBottom - stackTop) / 2 / rz,
          },
          zones,
        );
        const bx = bet.x * RX;
        const bz = (bet.y - offsetZ / rz) * rz;
        const button = avoidZones({ x: slot.buttonX, y: slot.buttonY, hw: 0.28 / RX, hh: 0.28 / rz }, [boardZone]);
        const px = slot.x * (RX + railW + 0.28);
        const pz = slot.y * (rz + railW + 1.15);
        return (
          <group key={slot.seat}>
            {p && p.streetBet > 0 && (
              <Appear enabled={animations}>
                <ChipStack3D chips={chipBreakdown(p.streetBet, isCash)} skin={skin} position={[bx, 0, bz]} zoom={zoomChips} denominations={chipDenominations} />
                {/* Label sits in front of (below on screen) the stack, so it never
                    covers the chips. The pot label lives under the board, out of
                    this ring, so the two can't meet. */}
                <Html position={[bx, 0, bz + 0.62]} center distanceFactor={LABEL_DISTANCE} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                  <Amount
                    value={fmt(p.streetBet)}
                    size={13}
                    className="whitespace-nowrap"
                    style={{ color: ink, textShadow: haloShadow(skin.felt.color) }}
                  />
                </Html>
              </Appear>
            )}
            {hand.buttonSeat === slot.seat && <DealerButton skin={skin} position={[button.x * RX, 0.03, button.y * rz]} label={labels.dealer} />}
            <Html position={[px, 0.2, pz]} center zIndexRange={[10, 0]} style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
              {p ? (
                <SeatPlate
                  player={p}
                  skin={skin}
                  labels={labels.seats}
                  isHero={p.name === heroName}
                  isActing={frame.actingPlayer === p.name}
                  isWinner={winners.has(p.name)}
                  position={positions[p.name]}
                  showCards={showKnownHands}
                  fmt={fmt}
                  exact={exact}
                  onClick={interactive && onSeatClick ? () => onSeatClick(p.name) : undefined}
                  lookupUrl={lookupUrlFor?.(p.name)}
                  forceFaceDown={hideHeroCards && p.name === heroName}
                  layout={holeLayout}
                  deckArt={deckArt}
                  cardWidth={cardWidthFor(slots.length, p.name === heroName)}
                  scale={slots.length > 8 ? 0.88 : 1}
                />
              ) : null}
            </Html>
          </group>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Error boundary → SVG fallback                                       */
/* ------------------------------------------------------------------ */

class RendererBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ThreeTableRenderer(props: TableRendererProps) {
  const { t } = useTranslation();
  const labels = useMemo<SceneLabels>(
    () => ({
      pot: t('table.pot'),
      dealer: t('table.dealer'),
      mainPot: t('table.mainPot'),
      sidePot: (index: number) => t('table.sidePot', { index }),
      seat: (seat: number) => t('game.seat', { seat }),
      seats: seatLabels(t),
    }),
    [t],
  );
  const rz = RX * props.skin.table.aspect;
  const feltLogo = useAssetImage(props.skin.felt.logoAssetId, props.skin.felt.logoBlend === 'screen');

  // Some embedded browsers only flush R3F's initial size measurement on a
  // resize event; kick one right after mount so the first frame is never blank.
  useEffect(() => {
    const ids = [60, 400].map((ms) => window.setTimeout(() => window.dispatchEvent(new Event('resize')), ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  const camera = useMemo(
    () => ({ position: [0, 9.9, rz + 7.1] as [number, number, number], fov: 43, near: 0.1, far: 100 }),
    [rz],
  );
  return (
    <RendererBoundary fallback={<SvgTableRenderer {...props} />}>
      <div className="h-full w-full">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={camera}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
          onCreated={({ camera: cam }) => cam.lookAt(0, 0, 1.1)}
          style={{ background: 'transparent' }}
        >
          <Scene {...props} labels={labels} feltLogo={feltLogo} />
        </Canvas>
      </div>
    </RendererBoundary>
  );
}
