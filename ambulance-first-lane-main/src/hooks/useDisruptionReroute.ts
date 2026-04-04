/**
 * useDisruptionReroute — Disruption Detection & Smart Rerouting Engine v3
 *
 * PATH-BASED movement with PROPER collision avoidance:
 * - Vehicles follow precomputed dense point arrays
 * - Quantised lane buckets prevent side-by-side overlap
 * - Large follow distances (> vehicle length) prevent front-back overlap
 * - Disruption zone brings vehicles to a FULL STOP with proper queuing
 * - Vehicle cap prevents runaway spawning
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/* ══════════════════════════════════════════════
   Geometry & path helpers
   ══════════════════════════════════════════════ */

export interface Point { x: number; y: number }

export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const CX = CANVAS_W / 2;       // 400
export const CY = CANVAS_H / 2;       // 300
export const ROAD_W = 56;             // main road width (slightly narrower for cleaner look)
export const BYPASS_W = 44;           // bypass road width
export const VERT_ROAD_W = 50;

// Vehicle visual size — used for follow-distance calculations
export const V_LEN = 22;
export const V_HEI = 10;

/* ── Catmull-Rom spline ── */

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function buildSmooth(wps: Point[], spacing = 1.5): Point[] {
  if (wps.length < 2) return [...wps];
  const ext = [
    { x: 2 * wps[0].x - wps[1].x, y: 2 * wps[0].y - wps[1].y },
    ...wps,
    { x: 2 * wps[wps.length - 1].x - wps[wps.length - 2].x, y: 2 * wps[wps.length - 1].y - wps[wps.length - 2].y },
  ];
  const out: Point[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const seg = Math.sqrt((ext[i + 1].x - ext[i].x) ** 2 + (ext[i + 1].y - ext[i].y) ** 2);
    const steps = Math.max(2, Math.ceil(seg / spacing));
    for (let s = 0; s < steps; s++) out.push(catmullRom(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], s / steps));
  }
  out.push(wps[wps.length - 1]);
  return out;
}

function buildLinear(wps: Point[], spacing = 1): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i], b = wps[i + 1];
    const d = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    const n = Math.max(1, Math.round(d / spacing));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  out.push(wps[wps.length - 1]);
  return out;
}

/* ══════════════════════════════════════════════
   Path definitions — exported for the renderer
   ══════════════════════════════════════════════ */

/** Route A: straight east across the centre */
export const PATH_A = buildLinear([
  { x: -30, y: CY },
  { x: CANVAS_W + 30, y: CY },
]);

/** Route B: forks south-east from Route A, curves below disruption, continues east.
 *  Starts at the SAME origin as Route A so the shared segment is identical,
 *  then diverges cleanly. */
export const PATH_B = buildSmooth([
  { x: -30, y: CY },
  { x: 120, y: CY },
  // fork — moves DOWN and RIGHT to separate from Route A
  { x: 200, y: CY + 28 },
  { x: 270, y: CY + 80 },
  { x: 350, y: CY + 120 },
  { x: 440, y: CY + 140 },
  { x: 540, y: CY + 118 },
  { x: 625, y: CY + 72 },
  { x: 710, y: CY + 48 },
  { x: CANVAS_W + 30, y: CY + 48 },
]);

/** Vertical north-bound */
export const PATH_VN = buildLinear([
  { x: CX, y: CANVAS_H + 30 },
  { x: CX, y: -30 },
]);

/** Vertical south-bound */
export const PATH_VS = buildLinear([
  { x: CX, y: -30 },
  { x: CX, y: CANVAS_H + 30 },
]);

/** Index in PATH_B where the bypass diverges (y > CY + 8) */
export const FORK_IDX = Math.max(0, PATH_B.findIndex(p => p.y > CY + 8));

export type PathId = 'A' | 'B' | 'VN' | 'VS';
export const pathOf = (id: PathId) => id === 'A' ? PATH_A : id === 'B' ? PATH_B : id === 'VN' ? PATH_VN : PATH_VS;

/* ── Transform: get (x, y, angle) for a path position + lane offset ── */

export function pathTransform(path: Point[], pos: number, laneOff: number) {
  const i = Math.max(0, Math.min(Math.floor(pos), path.length - 2));
  const f = Math.max(0, Math.min(pos - i, 1));
  const p = path[i], q = path[i + 1];
  const dx = q.x - p.x, dy = q.y - p.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return {
    x: p.x + dx * f + nx * laneOff,
    y: p.y + dy * f + ny * laneOff,
    angle: Math.atan2(dy, dx),
  };
}

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */

export interface Vehicle {
  id: number;
  pathId: PathId;
  pathPos: number;
  laneIdx: number;        // quantised lane index (0,1 for two-lane roads)
  laneOff: number;        // actual perpendicular offset (derived from laneIdx)
  speed: number;
  baseSpeed: number;
  route: 'A' | 'B';
  rerouted: boolean;
  stuck: boolean;
  waitTime: number;
  color: string;
  origColor: string;
  x: number;
  y: number;
  angle: number;
}

export interface DisruptionZone {
  xStart: number;
  xEnd: number;
  active: boolean;
  label: string;
}

export interface SimStats {
  totalVehicles: number;
  vehiclesAffected: number;
  vehiclesRerouted: number;
  congestionScore: number;
  congestionThreshold: number;
  reroutingActive: boolean;
  disruptionActive: boolean;
  avgWaitTime: number;
  trafficDensity: number;
}

export interface RerouteState {
  vehicles: Vehicle[];
  disruption: DisruptionZone;
  stats: SimStats;
  running: boolean;
  tick: number;
}

/* ══════════════════════════════════════════════
   Constants — tuned to prevent overlap
   ══════════════════════════════════════════════ */

const CONGESTION_THRESHOLD = 25;

// Follow distances in path-index units (~1px each).
// Must be > V_LEN to prevent visual overlap.
const FOLLOW_DIST = 52;        // start braking
const FOLLOW_HARD = 28;        // hard stop (gives 6px bumper beyond 22px car)
const MAX_VEHICLES = 80;       // cap to prevent runaway density

/* ══════════════════════════════════════════════
   Quantised lane offsets — prevents side overlap
   Two lanes per direction, fixed offsets.
   ══════════════════════════════════════════════ */

const LANE_OFFSETS: Record<PathId, number[]> = {
  A:  [-16, -6, 6, 16],       // 4 lanes, 10px spacing (fits in 56px road)
  B:  [-12, -4, 4, 12],       // 4 lanes, fits in 44px road
  VN: [-14, -5, 5, 14],       // 4 lanes, fits in 50px road
  VS: [-14, -5, 5, 14],
};

/* ══════════════════════════════════════════════
   Vehicle factory
   ══════════════════════════════════════════════ */

let _vid = 0;
function nextId() { return ++_vid; }
function rand(a: number, b: number) { return a + Math.random() * (b - a); }

function spawn(pid: PathId, rerouted: boolean): Vehicle {
  const speed = rand(1.4, 2.6);
  const offsets = LANE_OFFSETS[pid];
  const laneIdx = Math.floor(Math.random() * offsets.length);
  const laneOff = offsets[laneIdx];

  const colors: Record<PathId, string> = { A: '#3b82f6', B: '#8b5cf6', VN: '#a78bfa', VS: '#a78bfa' };
  const color = rerouted ? '#22c55e' : colors[pid];
  const route = (pid === 'A') ? 'A' as const : 'B' as const;
  const path = pathOf(pid);
  const t = pathTransform(path, 0, laneOff);

  return {
    id: nextId(), pathId: pid, pathPos: 0,
    laneIdx, laneOff,
    speed, baseSpeed: speed, route, rerouted,
    stuck: false, waitTime: 0,
    color, origColor: color,
    x: t.x, y: t.y, angle: t.angle,
  };
}

/* ══════════════════════════════════════════════
   Hook
   ══════════════════════════════════════════════ */

export function useDisruptionReroute() {
  const [state, setState] = useState<RerouteState>(() => init());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnAcc = useRef(0);

  function init(): RerouteState {
    _vid = 0;
    return {
      vehicles: [],
      disruption: { xStart: 340, xEnd: 490, active: false, label: 'CONSTRUCTION ZONE' },
      stats: {
        totalVehicles: 0, vehiclesAffected: 0, vehiclesRerouted: 0,
        congestionScore: 0, congestionThreshold: CONGESTION_THRESHOLD,
        reroutingActive: false, disruptionActive: false,
        avgWaitTime: 0, trafficDensity: 1,
      },
      running: false, tick: 0,
    };
  }

  const step = useCallback(() => {
    setState(prev => {
      const s = { ...prev, tick: prev.tick + 1 };
      const dz = s.disruption;
      let vehicles = s.vehicles.map(v => ({ ...v }));

      /* ── spawn (respect cap) ── */
      if (vehicles.length < MAX_VEHICLES) {
        spawnAcc.current++;
        const rate = s.stats.trafficDensity === 1 ? 18 : s.stats.trafficDensity === 2 ? 10 : 5;
        if (spawnAcc.current >= rate) {
          spawnAcc.current = 0;
          const useB = s.stats.reroutingActive && Math.random() < 0.82;
          vehicles.push(spawn(useB ? 'B' : 'A', useB));
          if (!useB && Math.random() < 0.2 && vehicles.length < MAX_VEHICLES)
            vehicles.push(spawn('B', false));
          if (Math.random() < 0.15 && vehicles.length < MAX_VEHICLES)
            vehicles.push(spawn(Math.random() < 0.5 ? 'VN' : 'VS', false));
        }
      }

      /* ── lane grouping for following ──
         Key = pathId + laneIdx → vehicles in the EXACT same lane */
      const lanes = new Map<string, Vehicle[]>();
      for (const v of vehicles) {
        const key = `${v.pathId}_${v.laneIdx}`;
        if (!lanes.has(key)) lanes.set(key, []);
        lanes.get(key)!.push(v);
      }
      for (const arr of lanes.values()) arr.sort((a, b) => a.pathPos - b.pathPos);

      /* ── move each vehicle ── */
      for (const v of vehicles) {
        const path = pathOf(v.pathId);

        // Disruption slowdown (Route A only)
        const approachDZ = dz.active && v.pathId === 'A' && v.x > dz.xStart - 60 && v.x < dz.xEnd + 8;
        const deepInDZ = dz.active && v.pathId === 'A' && v.x > dz.xStart && v.x < dz.xEnd;
        if (deepInDZ) {
          v.stuck = true;
          v.speed = Math.max(0, v.speed * 0.85);    // decay to ZERO
          if (v.speed < 0.05) v.speed = 0;           // full stop
          v.waitTime++;
          v.color = '#ef4444';
        } else if (approachDZ) {
          // Approaching — slow down gradually
          v.stuck = true;
          v.speed = Math.max(0.2, v.speed * 0.93);
          v.waitTime++;
          v.color = '#f59e0b';   // amber while approaching
        } else {
          if (v.stuck) { v.stuck = false; v.color = v.origColor; }
          v.speed = Math.min(v.baseSpeed, v.speed + 0.04);
        }

        // Following: slow down / stop if vehicle ahead in SAME LANE is too close
        const key = `${v.pathId}_${v.laneIdx}`;
        const lane = lanes.get(key);
        if (lane) {
          const mi = lane.indexOf(v);
          if (mi >= 0 && mi < lane.length - 1) {
            const ahead = lane[mi + 1];
            const gap = ahead.pathPos - v.pathPos;
            if (gap < FOLLOW_DIST) {
              // Proportional braking: closer → slower
              const brakeFactor = Math.max(0, (gap - FOLLOW_HARD) / (FOLLOW_DIST - FOLLOW_HARD));
              const targetSpeed = ahead.speed * brakeFactor;
              v.speed = Math.min(v.speed, targetSpeed);
            }
            if (gap < FOLLOW_HARD) {
              v.speed = 0;            // FULL STOP — no creeping through
            }
          }
        }

        // Advance
        v.pathPos += v.speed;

        // Update screen position
        if (v.pathPos < path.length - 1) {
          const t = pathTransform(path, v.pathPos, v.laneOff);
          v.x = t.x; v.y = t.y; v.angle = t.angle;
        }
      }

      // Remove vehicles that finished their path
      vehicles = vehicles.filter(v => v.pathPos < pathOf(v.pathId).length - 2);

      /* ── stats ── */
      const stuck = vehicles.filter(v => v.stuck);
      const rerouted = vehicles.filter(v => v.rerouted);
      const avgW = stuck.length ? stuck.reduce((a, v) => a + v.waitTime, 0) / stuck.length : 0;
      const score = Math.round(stuck.length * (avgW / 8));
      const reActive = dz.active && score >= CONGESTION_THRESHOLD;

      s.vehicles = vehicles;
      s.stats = {
        ...s.stats,
        totalVehicles: vehicles.length,
        vehiclesAffected: stuck.length,
        vehiclesRerouted: rerouted.length,
        congestionScore: score,
        reroutingActive: reActive,
        disruptionActive: dz.active,
        avgWaitTime: Math.round(avgW),
      };
      return s;
    });
  }, []);

  /* ──── controls ──── */
  const start = useCallback(() => {
    if (timerRef.current) return;
    setState(p => ({ ...p, running: true }));
    timerRef.current = setInterval(step, 33);
  }, [step]);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setState(p => ({ ...p, running: false }));
  }, []);

  const reset = useCallback(() => { stop(); setState(init()); }, [stop]);

  const toggleDisruption = useCallback(() => {
    setState(p => ({ ...p, disruption: { ...p.disruption, active: !p.disruption.active } }));
  }, []);

  const setDisruptionLabel = useCallback((label: string) => {
    setState(p => ({ ...p, disruption: { ...p.disruption, label } }));
  }, []);

  const setDensity = useCallback((d: number) => {
    setState(p => ({ ...p, stats: { ...p.stats, trafficDensity: Math.max(1, Math.min(3, d)) } }));
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return { state, start, stop, reset, toggleDisruption, setDensity, setDisruptionLabel };
}
