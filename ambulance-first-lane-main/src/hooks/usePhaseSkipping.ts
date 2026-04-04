/**
 * usePhaseSkipping — Phase Skipping Intelligence (PSI) Engine v2
 *
 * Detects empty/low-traffic lanes at junctions and automatically skips
 * their signal phases, reducing idle wait times and emissions.
 *
 * Concepts:
 *  - A junction has 4 lanes (N, E, S, W), each with a signal phase
 *  - Normal cycle: phases rotate N → E → S → W, each gets a green window
 *  - PSI detects when a lane has zero (or very few) vehicles
 *  - Those phases are skipped entirely, giving green time back to active lanes
 *  - Metrics: time saved, phases skipped, emission reduction
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/* ═══════════════════════════════════
   Types
   ═══════════════════════════════════ */

export interface Point { x: number; y: number }

export interface Vehicle {
  id: number;
  lane: 'N' | 'E' | 'S' | 'W';
  pos: number;          // 0..1 along the lane path (approaching → crossing → exited)
  speed: number;
  exited: boolean;
  waiting: boolean;     // stopped at red
}

export interface PSILane {
  dir: 'N' | 'E' | 'S' | 'W';
  signal: 'red' | 'yellow' | 'green';
  vehicles: Vehicle[];
  phaseRemaining: number;  // seconds left in this signal
  skipped: boolean;        // was this phase skipped by PSI?
}

export interface SkipEvent {
  id: number;
  time: number;       // sim time
  lane: string;
  reason: string;
  saved: number;      // seconds saved
}

export interface JunctionState {
  lanes: PSILane[];
  activePhaseIdx: number;     // which lane currently has green
  cycleTime: number;          // total elapsed
  phaseTimer: number;         // time in current phase
  psiEnabled: boolean;
  skipEvents: SkipEvent[];
  stats: {
    totalTimeSaved: number;
    totalPhasesSkipped: number;
    totalCycles: number;
    emissionReduction: number; // kg CO₂
    avgWaitTime: number;
    throughput: number;         // vehicles/min
    wastedTime: number;         // cumulative time wasted on empty lanes without PSI
    efficiencyGain: number;     // % improvement vs no-PSI baseline
    // ─── Comparison: "Current System" (no PSI) vs "Our System" (PSI) ───
    currentSystemCycleTime: number;  // total cycle time a normal system would take
    ourSystemCycleTime: number;       // total cycle time with PSI skipping
    currentSystemAvgWait: number;
    ourSystemAvgWait: number;
  };
}

/* ═══════════════════════════════════
   Constants
   ═══════════════════════════════════ */

export const CANVAS_W = 800;
export const CANVAS_H = 600;
export const CX = CANVAS_W / 2;
export const CY = CANVAS_H / 2;
export const ROAD_W = 60;

const DIRS: ('N' | 'E' | 'S' | 'W')[] = ['N', 'E', 'S', 'W'];
const DIR_LABELS: Record<string, string> = { N: 'North', E: 'East', S: 'South', W: 'West' };
const PHASE_DURATION = 12; // seconds per phase (slower for demo clarity)
const YELLOW_DURATION = 2;
const SKIP_THRESHOLD = 0;  // skip if vehicles ≤ this count
const VEHICLE_SPEED = 0.006; // slow vehicles — easy to follow visually
const MAX_VEHICLES_PER_LANE = 10;

// Variable spawn rates — N & E are busy, S & W are VERY sparse (almost always skipped)
const SPAWN_RATES: Record<string, number> = {
  N: 0.07,   // busy — always has traffic
  E: 0.06,   // busy — always has traffic
  S: 0.003,  // very sparse — almost always empty → skipped
  W: 0.002,  // extremely sparse — nearly always empty → skipped
};

/* ═══════════════════════════════════
   Lane geometry helpers (for rendering)
   ═══════════════════════════════════ */

/** Get approach line (where vehicles queue) for a direction */
export function laneApproachPts(dir: 'N' | 'E' | 'S' | 'W'): { start: Point; end: Point } {
  const offset = ROAD_W / 4;
  switch (dir) {
    case 'N': return { start: { x: CX - offset, y: 0 }, end: { x: CX - offset, y: CY - ROAD_W / 2 } };
    case 'S': return { start: { x: CX + offset, y: CANVAS_H }, end: { x: CX + offset, y: CY + ROAD_W / 2 } };
    case 'E': return { start: { x: CANVAS_W, y: CY - offset }, end: { x: CX + ROAD_W / 2, y: CY - offset } };
    case 'W': return { start: { x: 0, y: CY + offset }, end: { x: CX - ROAD_W / 2, y: CY + offset } };
  }
}

/** Get departure line (where vehicles exit after crossing) */
export function laneDeparturePts(dir: 'N' | 'E' | 'S' | 'W'): { start: Point; end: Point } {
  const offset = ROAD_W / 4;
  switch (dir) {
    case 'N': return { start: { x: CX + offset, y: CY - ROAD_W / 2 }, end: { x: CX + offset, y: 0 } };
    case 'S': return { start: { x: CX - offset, y: CY + ROAD_W / 2 }, end: { x: CX - offset, y: CANVAS_H } };
    case 'E': return { start: { x: CX + ROAD_W / 2, y: CY + offset }, end: { x: CANVAS_W, y: CY + offset } };
    case 'W': return { start: { x: CX - ROAD_W / 2, y: CY - offset }, end: { x: 0, y: CY - offset } };
  }
}

/** Get vehicle world position from normalised 0..1 pos along the lane */
export function vehicleWorldPos(dir: 'N' | 'E' | 'S' | 'W', pos: number): Point {
  const approach = laneApproachPts(dir);
  const depart = laneDeparturePts(dir);
  if (pos <= 0.5) {
    // approaching (0 = start of approach, 0.5 = stop line)
    const t = pos / 0.5;
    return {
      x: approach.start.x + (approach.end.x - approach.start.x) * t,
      y: approach.start.y + (approach.end.y - approach.start.y) * t,
    };
  } else {
    // crossing + departing (0.5 = start departing, 1 = exited)
    const t = (pos - 0.5) / 0.5;
    return {
      x: depart.start.x + (depart.end.x - depart.start.x) * t,
      y: depart.start.y + (depart.end.y - depart.start.y) * t,
    };
  }
}

/* ═══════════════════════════════════
   Hook
   ═══════════════════════════════════ */

export function usePhaseSkipping() {
  const [state, setState] = useState<JunctionState>(initState);
  const [running, setRunning] = useState(false);
  const [psiEnabled, setPsiEnabled] = useState(true);
  const stateRef = useRef(state);
  const runRef = useRef(running);
  const psiRef = useRef(psiEnabled);
  const nextVid = useRef(1);
  const frameRef = useRef(0);
  const totalExited = useRef(0);

  stateRef.current = state;
  runRef.current = running;
  psiRef.current = psiEnabled;

  function initState(): JunctionState {
    return {
      lanes: DIRS.map(dir => ({
        dir,
        signal: dir === 'N' ? 'green' : 'red',
        vehicles: [],
        phaseRemaining: PHASE_DURATION,
        skipped: false,
      })),
      activePhaseIdx: 0,
      cycleTime: 0,
      phaseTimer: 0,
      psiEnabled: true,
      skipEvents: [],
      stats: {
        totalTimeSaved: 0,
        totalPhasesSkipped: 0,
        totalCycles: 0,
        emissionReduction: 0,
        avgWaitTime: 0,
        throughput: 0,
        wastedTime: 0,
        efficiencyGain: 0,
        currentSystemCycleTime: 0,
        ourSystemCycleTime: 0,
        currentSystemAvgWait: 0,
        ourSystemAvgWait: 0,
      },
    };
  }

  const reset = useCallback(() => {
    nextVid.current = 1;
    totalExited.current = 0;
    setState(initState());
    setRunning(false);
  }, []);

  const togglePlay = useCallback(() => setRunning(r => !r), []);
  const togglePSI = useCallback(() => setPsiEnabled(p => !p), []);

  /* ─── Main tick loop ─── */
  useEffect(() => {
    let raf = 0;
    let lastTime = 0;
    const DT = 1 / 60; // half-speed sim — 1 real second ≈ 0.5 sim seconds (demoable pace)

    function tick(ts: number) {
      raf = requestAnimationFrame(tick);
      if (!runRef.current) { lastTime = ts; return; }

      const elapsed = (ts - lastTime) / 1000;
      lastTime = ts;
      if (elapsed <= 0 || elapsed > 0.5) return;

      setState(prev => {
        const s = structuredClone(prev);
        s.cycleTime += DT;
        s.phaseTimer += DT;
        s.psiEnabled = psiRef.current;

        // ── Spawn vehicles randomly (variable rates per lane) ──
        for (const lane of s.lanes) {
          const activeCount = lane.vehicles.filter(v => !v.exited).length;
          const rate = SPAWN_RATES[lane.dir] ?? 0.03;
          if (activeCount < MAX_VEHICLES_PER_LANE && Math.random() < rate) {
            lane.vehicles.push({
              id: nextVid.current++,
              lane: lane.dir,
              pos: 0,
              speed: VEHICLE_SPEED * (0.8 + Math.random() * 0.4),
              exited: false,
              waiting: false,
            });
          }
        }

        // ── Phase switching ──
        const activePhase = s.lanes[s.activePhaseIdx];
        activePhase.phaseRemaining -= DT;

        if (activePhase.phaseRemaining <= YELLOW_DURATION && activePhase.signal === 'green') {
          activePhase.signal = 'yellow';
        }

        if (activePhase.phaseRemaining <= 0) {
          // Move to next phase
          activePhase.signal = 'red';
          activePhase.skipped = false;

          let nextIdx = (s.activePhaseIdx + 1) % 4;
          let skippedCount = 0;

          // PSI: skip phases with no vehicles
          if (s.psiEnabled) {
            let attempts = 0;
            while (attempts < 4) {
              const nextLane = s.lanes[nextIdx];
              const waitingCount = nextLane.vehicles.filter(v => !v.exited && v.pos < 0.5).length;
              if (waitingCount <= SKIP_THRESHOLD) {
                // Skip this phase
                nextLane.skipped = true;
                const savedTime = PHASE_DURATION;
                skippedCount++;
                s.stats.totalPhasesSkipped++;
                s.stats.totalTimeSaved += savedTime;
                s.stats.emissionReduction += savedTime * 0.002; // ~2g CO₂ per second of idle

                s.skipEvents.unshift({
                  id: Date.now() + Math.random(),
                  time: s.cycleTime,
                  lane: DIR_LABELS[nextLane.dir],
                  reason: `${waitingCount} vehicles (≤ ${SKIP_THRESHOLD})`,
                  saved: savedTime,
                });
                if (s.skipEvents.length > 50) s.skipEvents.pop();

                nextIdx = (nextIdx + 1) % 4;
              } else {
                break;
              }
              attempts++;
            }
          }

          // ── Always track counterfactual: how long would a normal system take? ──
          // A normal (non-PSI) system gives every lane a full phase regardless
          // So each cycle = 4 × PHASE_DURATION. Count how many empty lanes could be skipped.
          {
            let emptyInThisCycle = 0;
            for (const lane of s.lanes) {
              const wc = lane.vehicles.filter(v => !v.exited && v.pos < 0.5).length;
              if (wc <= SKIP_THRESHOLD) emptyInThisCycle++;
            }
            s.stats.wastedTime += emptyInThisCycle * PHASE_DURATION;
            // "Current system" always runs all 4 phases
            s.stats.currentSystemCycleTime += 4 * PHASE_DURATION;
            // "Our system" skips empty phases
            s.stats.ourSystemCycleTime += (4 - (s.psiEnabled ? skippedCount : 0)) * PHASE_DURATION;
            // Average wait comparison
            s.stats.currentSystemAvgWait = +(((4 * PHASE_DURATION) / 2) * 0.6).toFixed(1);
            const effectivePhases = Math.max(1, 4 - (s.psiEnabled ? skippedCount : 0));
            s.stats.ourSystemAvgWait = +((effectivePhases * PHASE_DURATION / 2) * 0.6).toFixed(1);
          }

          // Efficiency gain calculation
          s.stats.efficiencyGain = s.stats.currentSystemCycleTime > 0
            ? Math.min(99, Math.round(((s.stats.currentSystemCycleTime - s.stats.ourSystemCycleTime) / s.stats.currentSystemCycleTime) * 100))
            : 0;

          s.activePhaseIdx = nextIdx;
          s.lanes[nextIdx].signal = 'green';
          s.lanes[nextIdx].phaseRemaining = PHASE_DURATION;
          s.phaseTimer = 0;

          if (nextIdx === 0) s.stats.totalCycles++;
        }

        // ── Move vehicles ──
        for (const lane of s.lanes) {
          const sorted = lane.vehicles
            .filter(v => !v.exited)
            .sort((a, b) => b.pos - a.pos); // furthest along first

          for (let i = 0; i < sorted.length; i++) {
            const v = sorted[i];

            // Stop at red/yellow before crossing (pos < 0.48)
            if (v.pos < 0.48 && lane.signal !== 'green') {
              v.waiting = true;
              // Queue behind the stop line
              const linePos = 0.48 - i * 0.04;
              if (v.pos >= linePos) continue;
              v.pos = Math.min(v.pos + v.speed, linePos);
              continue;
            }

            v.waiting = false;

            // Follow distance from vehicle ahead
            if (i > 0) {
              const ahead = sorted[i - 1];
              if (ahead.pos - v.pos < 0.04) continue;
            }

            v.pos += v.speed;

            if (v.pos >= 1) {
              v.exited = true;
              totalExited.current++;
            }
          }
        }

        // ── Clean up exited vehicles (keep last 5 for fade effect) ──
        for (const lane of s.lanes) {
          const exitedCount = lane.vehicles.filter(v => v.exited).length;
          if (exitedCount > 5) {
            lane.vehicles = lane.vehicles.filter(v => !v.exited).concat(
              lane.vehicles.filter(v => v.exited).slice(-5)
            );
          }
        }

        // ── Update throughput ──
        if (s.cycleTime > 0) {
          s.stats.throughput = Math.round((totalExited.current / s.cycleTime) * 60);
          const totalWaiting = s.lanes.reduce(
            (sum, l) => sum + l.vehicles.filter(v => !v.exited && v.waiting).length, 0
          );
          s.stats.avgWaitTime = totalWaiting > 0
            ? +(PHASE_DURATION * 0.4).toFixed(1)
            : 0;
        }

        return s;
      });
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { state, running, psiEnabled, togglePlay, togglePSI, reset };
}
