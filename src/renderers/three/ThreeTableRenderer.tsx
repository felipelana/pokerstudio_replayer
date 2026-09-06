import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import type { TableRendererProps } from '../TableRenderer';
import { chipBreakdown } from '../layout';
import { SeatPlate, seatLabels, type SeatLabels } from '../seats/SeatPlate';
import { SvgTableRenderer } from '../svg/SvgTableRenderer';
import { cardCanvas } from '@/ui/cards/cardTexture';
import type { DeckSkin, FeltSkin, Skin } from '@/skins/types';
import { CARD_H, CARD_W } from '@/ui/cards/primitives';

/* Table dimensions in world units (x = long axis, z = towards the viewer). */
const RX = 5.2;
const CARD_WIDTH = 0.95;
const CARD_HEIGHT = (CARD_WIDTH * CARD_H) / CARD_W;
/** Board cards lean towards the camera (radians from flat) so ranks stay legible. */
const CARD_TILT = 0.72;

/* ------------------------------------------------------------------ */
/* Textures                                                            */
/* ------------------------------------------------------------------ */

const textureCache = new Map<string, THREE.CanvasTexture>();

function cardTexture(card: string | 'back', deck: DeckSkin): THREE.CanvasTexture {
  const key = `${card}|${JSON.stringify(deck)}`;
  let tex = textureCache.get(key);
  if (!tex) {
    tex = new THREE.CanvasTexture(cardCanvas(card, deck, 6));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    textureCache.set(key, tex);
  }
  return tex;
}

function feltTexture(felt: FeltSkin): THREE.CanvasTexture {
  const key = `felt|${JSON.stringify(felt)}`;
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
    // Vignette
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, hexToRgba(felt.vignetteColor, felt.vignetteStrength));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
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

function Table({ skin }: { skin: Skin }) {
  const rz = RX * skin.table.aspect;
  const railW = skin.table.railWidth * RX * 2;
  const felt = useMemo(() => feltTexture(skin.felt), [skin.felt]);

  const feltGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, RX, rz, 0, Math.PI * 2, false, 0);
    const geo = new THREE.ShapeGeometry(shape, 96);
    // Map UVs to 0..1 across the ellipse bounding box.
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / (2 * RX) + 0.5, pos.getY(i) / (2 * rz) + 0.5);
    }
    uv.needsUpdate = true;
    return geo;
  }, [rz]);

  const railGeo = useMemo(() => {
    const outer = new THREE.Shape();
    outer.absellipse(0, 0, RX + railW, rz + railW, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, RX, rz, 0, Math.PI * 2, true, 0);
    outer.holes.push(hole);
    return new THREE.ExtrudeGeometry(outer, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 3,
      curveSegments: 96,
    });
  }, [rz, railW]);

  return (
    <group>
      <mesh geometry={railGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.16, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={skin.table.railColor} roughness={0.45 - skin.table.railShine * 0.3} metalness={0.1 + skin.table.railShine * 0.3} />
      </mesh>
      <mesh geometry={feltGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial map={felt} roughness={0.95} metalness={0} />
      </mesh>
      {/* Inner line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[0.98, 1, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
        <primitive object={new THREE.Object3D()} attach="userData" />
      </mesh>
      <group scale={[RX - 0.35, rz - 0.3, 1]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <mesh>
          <ringGeometry args={[0.985, 1, 160]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
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

function CardMesh({ card, deck, position, rotationY = 0 }: { card: string; deck: DeckSkin; position: [number, number, number]; rotationY?: number }) {
  const tex = useMemo(() => cardTexture(card, deck), [card, deck]);
  const back = useMemo(() => cardTexture('back', deck), [deck]);
  // Lift the card so its bottom edge rests on the felt once tilted.
  const lift = (CARD_HEIGHT / 2) * Math.sin(CARD_TILT) + 0.01;
  return (
    <group position={[position[0], position[1] + lift, position[2]]} rotation={[-Math.PI / 2 + CARD_TILT, 0, rotationY]}>
      <mesh castShadow>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        {/* Low roughness + a little metalness gives the printed face a glossy sheen. */}
        <meshStandardMaterial map={tex} roughness={0.28} metalness={0.06} />
      </mesh>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, 0, -0.004]}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshStandardMaterial map={back} roughness={0.32} metalness={0.06} />
      </mesh>
    </group>
  );
}

function ChipStack3D({ chips, skin, position }: { chips: number[]; skin: Skin; position: [number, number, number] }) {
  return (
    <group position={position}>
      {chips.map((d, i) => (
        <mesh key={i} position={[0, 0.03 + i * 0.06, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.06, 28]} />
          <meshStandardMaterial color={skin.chips.colors[String(d)] ?? '#888'} roughness={0.5} />
        </mesh>
      ))}
      {chips.length > 0 && (
        <mesh position={[0, 0.03 + chips.length * 0.06 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.1, 0.14, 24]} />
          <meshBasicMaterial color={skin.chips.edge} transparent opacity={0.8} />
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

function Scene(props: TableRendererProps & { labels: SceneLabels }) {
  const { hand, frame, skin, slots, heroName, positions, showKnownHands, equity, fmt, exact, onSeatClick, interactive = true, animations, labels } = props;
  const rz = RX * skin.table.aspect;
  const railW = skin.table.railWidth * RX * 2;
  const isCash = hand.currency !== 'chips';
  const bySeat = new Map(frame.players.map((p) => [p.seat, p]));
  const winners = new Set(frame.kind === 'end' ? frame.players.filter((p) => p.collected > 0).map((p) => p.name) : []);

  const boardGap = 0.11;
  const boardX0 = -((5 * CARD_WIDTH + 4 * boardGap) / 2) + CARD_WIDTH / 2;

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[3, 12, 5]}
        intensity={1.4}
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

      <Table skin={skin} />

      {/* Board */}
      {frame.board.map((c, i) => (
        <Appear key={c} enabled={animations} delay={i * 40}>
          <CardMesh card={c} deck={skin.deck} position={[boardX0 + i * (CARD_WIDTH + boardGap), 0.01, 0.5]} />
        </Appear>
      ))}

      {/* Pot chips */}
      {frame.pot > 0 && (
        <Appear enabled={animations}>
          <ChipStack3D chips={chipBreakdown(frame.pot, isCash, 10)} skin={skin} position={[-2.4, 0, -0.9]} />
        </Appear>
      )}

      {/* Pot label */}
      <Html position={[0, 0.05, -1.55]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div
          className="whitespace-nowrap rounded-full border px-3 py-1 text-[15px] font-semibold text-white"
          style={{ background: 'rgba(0,0,0,0.62)', borderColor: skin.plates.activeBorder }}
        >
          {labels.pot}: {fmt(frame.totalPot)}
          {frame.pots.length > 1 && (
            <div className="text-center text-[11px] font-normal opacity-85">
              {frame.pots.map((p) => `${p.kind === 'main' ? labels.mainPot : labels.sidePot(p.index)} ${fmt(p.amount)}`).join(' · ')}
            </div>
          )}
        </div>
      </Html>

      {/* Bets, dealer button and seats */}
      {slots.map((slot) => {
        const p = bySeat.get(slot.seat);
        const bx = slot.betX * RX;
        const bz = slot.betY * rz;
        const px = slot.x * (RX + railW + 0.55);
        const pz = slot.y * (rz + railW + 0.75);
        return (
          <group key={slot.seat}>
            {p && p.streetBet > 0 && (
              <Appear enabled={animations}>
                <ChipStack3D chips={chipBreakdown(p.streetBet, isCash)} skin={skin} position={[bx, 0, bz]} />
                {/* Label sits in front of (below on screen) the stack so it never covers the chips. */}
                <Html position={[bx, 0, bz + 0.62]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                  <div className="whitespace-nowrap text-[13px] font-semibold text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    {fmt(p.streetBet)}
                  </div>
                </Html>
              </Appear>
            )}
            {hand.buttonSeat === slot.seat && <DealerButton skin={skin} position={[slot.buttonX * RX, 0.03, slot.buttonY * rz]} label={labels.dealer} />}
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
                  equity={equity?.values[p.name]}
                  equityPending={equity?.pending}
                  fmt={fmt}
                  exact={exact}
                  onClick={interactive && onSeatClick ? () => onSeatClick(p.name) : undefined}
                  cardWidth={p.name === heroName ? 64 : 50}
                  scale={slots.length > 8 ? 0.9 : 1}
                />
              ) : (
                <div className="rounded-md border px-2 py-1 text-[10px] uppercase tracking-wide" style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.35)' }}>
                  {labels.seat(slot.seat)}
                </div>
              )}
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

  // Some embedded browsers only flush R3F's initial size measurement on a
  // resize event; kick one right after mount so the first frame is never blank.
  useEffect(() => {
    const ids = [60, 400].map((ms) => window.setTimeout(() => window.dispatchEvent(new Event('resize')), ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  const camera = useMemo(
    () => ({ position: [0, 9.6, rz + 6.8] as [number, number, number], fov: 40, near: 0.1, far: 100 }),
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
          <Scene {...props} labels={labels} />
        </Canvas>
      </div>
    </RendererBoundary>
  );
}
