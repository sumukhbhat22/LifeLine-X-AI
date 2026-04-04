import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type SimulationState,
  type Phase,
  type Vehicle,
  type Junction,
  type RoadSegment,
  type Ambulance,
  type Language,
  type DriverNotification,
  type VehicleBreakdown,
  type SpilloverZone,
  type SpilloverEvent,
  type SpilloverRisk,
  type SpilloverAction,
  JUNCTION_XS,
  ROAD_Y,
  LANE_H,
  CANVAS_W,
  VERT_ROAD_W,
  TECH_PARK_SURGE_TIMES,
  SURGE_DETECTION_WINDOW,
  SURGE_ACTIVE_WINDOW,
  GREEN_TIME_MULTIPLIER,
} from '@/types/simulation';

const VEHICLE_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#6366f1',
  '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#a855f7',
];

// CO2 emission constants
const CO2_PER_MINUTE_IDLING = 0.25; // kg CO2 per minute for traffic idle
const BASELINE_TIME_SECONDS = 60; // baseline time without optimization

// Hospital beds mockup (Bengaluru tech parks)
const HOSPITALS = [
  { name: 'St. John\'s Medical', beds: 2, distance: 5 },
  { name: 'Apollo Hospital', beds: 0, distance: 8 },
  { name: 'Fortis Hospital', beds: 1, distance: 6 },
];

// ===== Spillover Detection Constants =====
const APPROACH_ZONE_LENGTH = 120; // px before critical zone
const CRITICAL_ZONE_LENGTH = 60;  // px warning area
const JUNCTION_BOX_HALF = 30;     // px into junction
const SPILLOVER_GREEN_EXTENSION = 15; // seconds extra green (max)
const SPILLOVER_MIN_DWELL_FRAMES = 3; // min frames risk must persist before triggering event
const SPILLOVER_CLEAR_FRAMES = 6;     // frames of no-risk before de-escalating / resolving
const STOPPED_SPEED_THRESHOLD = 8;    // px/s — vehicles below this are "stopped"
const SLOW_SPEED_THRESHOLD = 15;      // px/s — vehicles below this are "slow"
const DENSITY_HIGH_THRESHOLD = 2.5;   // vehicles per 100px = dense queue
const GROWTH_RATE_ALERT = 0.5;        // vehicles/s growth rate triggers earlier warning

function createSpilloverZones(): SpilloverZone[] {
  const zones: SpilloverZone[] = [];
  for (let ji = 0; ji < JUNCTION_XS.length; ji++) {
    const jx = JUNCTION_XS[ji];
    // Top lane approaches from left
    zones.push({
      junctionIndex: ji,
      lane: 'top',
      approachStart: jx - JUNCTION_BOX_HALF - CRITICAL_ZONE_LENGTH - APPROACH_ZONE_LENGTH,
      approachEnd: jx - JUNCTION_BOX_HALF - CRITICAL_ZONE_LENGTH,
      criticalStart: jx - JUNCTION_BOX_HALF - CRITICAL_ZONE_LENGTH,
      criticalEnd: jx - JUNCTION_BOX_HALF,
      junctionBoxStart: jx - JUNCTION_BOX_HALF,
      junctionBoxEnd: jx + JUNCTION_BOX_HALF,
      prevVehicleCount: 0,
      riskAccumulator: 0,
      framesAtRisk: 0,
      framesAtClear: 0,
    });
    // Bottom lane approaches from right
    zones.push({
      junctionIndex: ji,
      lane: 'bottom',
      approachStart: jx + JUNCTION_BOX_HALF + CRITICAL_ZONE_LENGTH,
      approachEnd: jx + JUNCTION_BOX_HALF + CRITICAL_ZONE_LENGTH + APPROACH_ZONE_LENGTH,
      criticalStart: jx + JUNCTION_BOX_HALF,
      criticalEnd: jx + JUNCTION_BOX_HALF + CRITICAL_ZONE_LENGTH,
      junctionBoxStart: jx - JUNCTION_BOX_HALF,
      junctionBoxEnd: jx + JUNCTION_BOX_HALF,
      prevVehicleCount: 0,
      riskAccumulator: 0,
      framesAtRisk: 0,
      framesAtClear: 0,
    });
  }
  return zones;
}

/** Compute a weighted risk score from zone conditions (0-100 scale) */
function computeRiskScore(
  inApproach: Vehicle[],
  inCritical: Vehicle[],
  inJunctionBox: Vehicle[],
  zone: SpilloverZone,
  growthRate: number,
  cascadeRisk: boolean,
): number {
  let score = 0;

  // -- Stopped vehicles in junction box are the worst (35 pts max) --
  const stoppedInBox = inJunctionBox.filter(v => v.speed < STOPPED_SPEED_THRESHOLD);
  score += stoppedInBox.length * 20;
  // Even moving vehicles in the junction box are concerning
  score += (inJunctionBox.length - stoppedInBox.length) * 8;

  // -- Critical zone: speed-weighted (30 pts max) --
  for (const v of inCritical) {
    if (v.speed < STOPPED_SPEED_THRESHOLD) score += 12;        // stopped
    else if (v.speed < SLOW_SPEED_THRESHOLD) score += 8;       // crawling
    else score += 3;                                            // passing through
  }

  // -- Approach zone: moderate weight (15 pts max) --
  const slowInApproach = inApproach.filter(v => v.speed < SLOW_SPEED_THRESHOLD);
  score += slowInApproach.length * 4;
  score += (inApproach.length - slowInApproach.length) * 1.5;

  // -- Queue density bonus (vehicles per 100px in critical+approach) --
  const zoneLength = APPROACH_ZONE_LENGTH + CRITICAL_ZONE_LENGTH;
  const density = ((inApproach.length + inCritical.length) / zoneLength) * 100;
  if (density > DENSITY_HIGH_THRESHOLD) score += 10;
  else if (density > 1.5) score += 5;

  // -- Queue growth rate bonus (early warning) --
  if (growthRate > GROWTH_RATE_ALERT) score += 8;
  else if (growthRate > 0.2) score += 3;

  // -- Cascade bonus: downstream junction also at risk --
  if (cascadeRisk) score += 12;

  return Math.min(100, score);
}

function riskFromScore(score: number): SpilloverRisk {
  if (score >= 55) return 'critical';
  if (score >= 35) return 'high';
  if (score >= 20) return 'moderate';
  if (score >= 10) return 'low';
  return 'none';
}

function actionFromRisk(risk: SpilloverRisk): SpilloverAction {
  switch (risk) {
    case 'critical': return 'clearing_junction';
    case 'high': return 'extending_green';
    case 'moderate': return 'extending_green';
    default: return 'none';
  }
}

function greenExtensionFromScore(score: number): number {
  // Dynamic: scale extension proportionally to severity (0-15s)
  if (score >= 55) return SPILLOVER_GREEN_EXTENSION;
  if (score >= 35) return Math.round(SPILLOVER_GREEN_EXTENSION * 0.75);
  if (score >= 20) return Math.round(SPILLOVER_GREEN_EXTENSION * 0.45);
  return 0;
}

function detectSpillover(
  zone: SpilloverZone,
  vehicles: Vehicle[],
  simTime: number,
  dt: number,
  existingEvents: SpilloverEvent[],
  allZones: SpilloverZone[],
): { event: SpilloverEvent | null; updatedZone: SpilloverZone } {
  // Get vehicles in this lane on the main road
  const laneVehicles = vehicles.filter(v => v.road === 'main' && v.lane === zone.lane);

  // --- Accurate zone boundary filtering ---
  const inApproach = laneVehicles.filter(v => {
    const minX = Math.min(zone.approachStart, zone.approachEnd);
    const maxX = Math.max(zone.approachStart, zone.approachEnd);
    return v.x >= minX && v.x <= maxX;
  });

  const inCritical = laneVehicles.filter(v => {
    const minX = Math.min(zone.criticalStart, zone.criticalEnd);
    const maxX = Math.max(zone.criticalStart, zone.criticalEnd);
    return v.x >= minX && v.x <= maxX;
  });

  const inJunctionBox = laneVehicles.filter(v =>
    v.x >= zone.junctionBoxStart && v.x <= zone.junctionBoxEnd
  );

  // --- Queue growth rate (vehicles per second entering the zone) ---
  const currentCount = inApproach.length + inCritical.length + inJunctionBox.length;
  const growthRate = dt > 0 ? (currentCount - zone.prevVehicleCount) / dt : 0;
  // Smoothed growth rate: weighted moving average
  const smoothedGrowth = growthRate * 0.4 + (zone.prevVehicleCount > 0 ? 0 : 0);

  // --- Cascade detection: check if downstream junction is also at risk ---
  let cascadeRisk = false;
  const downstreamJi = zone.lane === 'top' ? zone.junctionIndex + 1 : zone.junctionIndex - 1;
  if (downstreamJi >= 0 && downstreamJi < JUNCTION_XS.length) {
    const downstreamZone = allZones.find(z => z.junctionIndex === downstreamJi && z.lane === zone.lane);
    if (downstreamZone && downstreamZone.framesAtRisk >= 2) {
      cascadeRisk = true;
    }
  }

  // --- Compute weighted risk score ---
  const score = computeRiskScore(inApproach, inCritical, inJunctionBox, zone, smoothedGrowth, cascadeRisk);
  const rawRisk = riskFromScore(score);

  // --- Temporal smoothing with hysteresis ---
  const updatedZone = { ...zone, prevVehicleCount: currentCount };

  if (rawRisk !== 'none') {
    updatedZone.framesAtRisk = zone.framesAtRisk + 1;
    updatedZone.framesAtClear = 0;
    updatedZone.riskAccumulator = Math.min(100, zone.riskAccumulator + score * 0.3);
  } else {
    updatedZone.framesAtClear = zone.framesAtClear + 1;
    updatedZone.framesAtRisk = 0;
    // Slow decay for hysteresis — risk accumulator drains slowly
    updatedZone.riskAccumulator = Math.max(0, zone.riskAccumulator - 2);
  }

  // Must persist for SPILLOVER_MIN_DWELL_FRAMES before we fire a new event
  if (updatedZone.framesAtRisk < SPILLOVER_MIN_DWELL_FRAMES && rawRisk !== 'critical') {
    // Not yet confirmed — don't fire event, but update zone tracking
    return { event: null, updatedZone };
  }

  // If risk is none and accumulator is drained, nothing to report
  if (rawRisk === 'none' && updatedZone.riskAccumulator <= 5) {
    return { event: null, updatedZone };
  }

  // Use the higher of raw risk or accumulator-based risk (hysteresis keeps risk elevated)
  const accumulatorRisk = riskFromScore(updatedZone.riskAccumulator);
  const ranks: SpilloverRisk[] = ['none', 'low', 'moderate', 'high', 'critical'];
  const effectiveRisk = ranks.indexOf(rawRisk) >= ranks.indexOf(accumulatorRisk) ? rawRisk : accumulatorRisk;

  if (effectiveRisk === 'none') {
    return { event: null, updatedZone };
  }

  // Check if there's already an active event for this zone
  const activeExisting = existingEvents.find(
    e => e.junctionIndex === zone.junctionIndex && e.lane === zone.lane && !e.resolvedAt
  );
  if (activeExisting) {
    // Update existing event's risk/stats (will be handled in the main loop)
    return { event: null, updatedZone };
  }

  // --- Compute ancillary metrics ---
  const allZoneVehicles = [...inApproach, ...inCritical, ...inJunctionBox];
  const avgSpeed = allZoneVehicles.length > 0
    ? allZoneVehicles.reduce((sum, v) => sum + v.speed, 0) / allZoneVehicles.length
    : 999;
  const stoppedInJunction = inJunctionBox.some(v => v.speed < STOPPED_SPEED_THRESHOLD);
  const totalQueued = inApproach.length + inCritical.length;

  // Spatial queue reach: how far back does the queue physically extend
  let queueReachPct = 0;
  if (allZoneVehicles.length > 0) {
    const zoneMinX = Math.min(zone.approachStart, zone.approachEnd, zone.criticalStart, zone.junctionBoxStart);
    const zoneMaxX = Math.max(zone.approachEnd, zone.approachStart, zone.criticalEnd, zone.junctionBoxEnd);
    const totalLength = zoneMaxX - zoneMinX;
    // Find the farthest-back slow/stopped vehicle
    const slowVehicles = allZoneVehicles.filter(v => v.speed < SLOW_SPEED_THRESHOLD);
    if (slowVehicles.length > 0 && totalLength > 0) {
      const farthest = zone.lane === 'top'
        ? Math.min(...slowVehicles.map(v => v.x))
        : Math.max(...slowVehicles.map(v => v.x));
      const junctionEdge = zone.lane === 'top' ? zone.junctionBoxStart : zone.junctionBoxEnd;
      const queueLength = Math.abs(farthest - junctionEdge);
      queueReachPct = Math.min(100, (queueLength / totalLength) * 100);
    }
  }

  const densityZoneLen = APPROACH_ZONE_LENGTH + CRITICAL_ZONE_LENGTH;
  const queueDensity = densityZoneLen > 0 ? (totalQueued / densityZoneLen) * 100 : 0;

  return {
    event: {
      id: randomId(),
      junctionIndex: zone.junctionIndex,
      lane: zone.lane,
      risk: effectiveRisk,
      queueLength: totalQueued,
      queueReachPct,
      vehiclesInJunction: inJunctionBox.length,
      stoppedInJunction,
      action: actionFromRisk(effectiveRisk),
      greenExtension: greenExtensionFromScore(score),
      detectedAt: simTime,
      resolvedAt: null,
      prevented: false,
      avgSpeed,
      queueDensity,
      growthRate: smoothedGrowth,
      cascadeRisk,
      dwellFrames: updatedZone.framesAtRisk,
      peakRisk: effectiveRisk,
    },
    updatedZone,
  };
}

// Surge Predictor Helper Functions
function getCurrentTimeInMinutes(mockTimeMinutes?: number | null): number {
  if (mockTimeMinutes != null) return mockTimeMinutes;
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getMinutesUntilSurge(mockTimeMinutes?: number | null): number {
  const currentTimeInMinutes = getCurrentTimeInMinutes(mockTimeMinutes);

  let minUntilSurge = Infinity;

  for (const surge of TECH_PARK_SURGE_TIMES) {
    const surgeTimeInMinutes = surge.hour * 60 + surge.minute;
    let diff = surgeTimeInMinutes - currentTimeInMinutes;

    // If surge already passed today, check tomorrow
    if (diff < 0) {
      diff += 24 * 60;
    }

    minUntilSurge = Math.min(minUntilSurge, diff);
  }

  return minUntilSurge;
}

function getActiveSurgeTime(mockTimeMinutes?: number | null): { hour: number; minute: number; name: string } | null {
  const currentTimeInMinutes = getCurrentTimeInMinutes(mockTimeMinutes);

  for (const surge of TECH_PARK_SURGE_TIMES) {
    const surgeTimeInMinutes = surge.hour * 60 + surge.minute;
    const diff = Math.abs(currentTimeInMinutes - surgeTimeInMinutes);

    // If within active surge window, return the surge time
    if (diff <= SURGE_ACTIVE_WINDOW) {
      return surge;
    }
  }

  return null;
}

function isSurgeDetectionWindow(mockTimeMinutes?: number | null): boolean {
  const minutesUntil = getMinutesUntilSurge(mockTimeMinutes);
  return minutesUntil <= SURGE_DETECTION_WINDOW && minutesUntil > 0;
}

function getClosestSurgeName(mockTimeMinutes?: number | null): string {
  const currentTimeInMinutes = getCurrentTimeInMinutes(mockTimeMinutes);
  let closest = TECH_PARK_SURGE_TIMES[0];
  let minDiff = Infinity;
  for (const surge of TECH_PARK_SURGE_TIMES) {
    const surgeTimeInMinutes = surge.hour * 60 + surge.minute;
    let diff = surgeTimeInMinutes - currentTimeInMinutes;
    if (diff < 0) diff += 24 * 60;
    if (diff < minDiff) {
      minDiff = diff;
      closest = surge;
    }
  }
  return closest.name;
}

function randomId() {
  return Math.random().toString(36).slice(2, 8);
}

function createInitialVehicles(): Vehicle[] {
  const vehicles: Vehicle[] = [];
  // Vehicles on main road, both lanes, distributed across segments
  for (let i = 0; i < 18; i++) {
    const lane: 'top' | 'bottom' = i % 2 === 0 ? 'top' : 'bottom';
    const x = 60 + Math.random() * (CANVAS_W - 120);
    const y = lane === 'top'
      ? ROAD_Y - LANE_H / 2 + (Math.random() - 0.5) * 6
      : ROAD_Y + LANE_H / 2 + (Math.random() - 0.5) * 6;
    const jIdx = JUNCTION_XS.reduce((best, jx, idx) =>
      Math.abs(x - jx) < Math.abs(x - JUNCTION_XS[best]) ? idx : best, 0);

    vehicles.push({
      id: randomId(),
      x, y, targetX: x, targetY: y,
      width: 28 + Math.random() * 8,
      height: 14,
      color: VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)],
      lane,
      road: 'main',
      junctionIndex: jIdx,
      instruction: null,
      isBlocker: false,
      isNonCooperative: false,
      cleared: false,
      speed: 20 + Math.random() * 30,
      direction: lane === 'top' ? 1 : -1,
    });
  }
  // A few on vertical roads
  for (let ji = 0; ji < 3; ji++) {
    for (let v = 0; v < 2; v++) {
      const jx = JUNCTION_XS[ji];
      const side = v === 0 ? -1 : 1;
      const y = ROAD_Y + side * (LANE_H + 20 + Math.random() * 60);
      vehicles.push({
        id: randomId(),
        x: jx + (Math.random() - 0.5) * 10,
        y, targetX: jx, targetY: y,
        width: 14, height: 26,
        color: VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)],
        lane: 'top', road: 'vertical', junctionIndex: ji,
        instruction: null, isBlocker: false, isNonCooperative: false, cleared: false,
        speed: 15 + Math.random() * 15, direction: side,
      });
    }
  }
  return vehicles;
}

function createJunctions(): Junction[] {
  return JUNCTION_XS.map(x => ({
    x, y: ROAD_Y,
    signalState: 'green' as const,
    prepared: false,
    cascadeActive: false,
    greenDuration: 5, // Default green duration in seconds
  }));
}

function createRoadSegments(): RoadSegment[] {
  const segs: RoadSegment[] = [];
  // Main road segments between junctions and edges
  const xs = [0, ...JUNCTION_XS, CANVAS_W];
  for (let i = 0; i < xs.length - 1; i++) {
    segs.push({
      x1: xs[i], y1: ROAD_Y - LANE_H,
      x2: xs[i + 1], y2: ROAD_Y + LANE_H,
      congestion: 0.2 + Math.random() * 0.3,
    });
  }
  return segs;
}

function calcCongestion(seg: RoadSegment, vehicles: Vehicle[]): number {
  const count = vehicles.filter(v =>
    v.road === 'main' && v.x >= seg.x1 && v.x <= seg.x2
  ).length;
  const width = seg.x2 - seg.x1;
  return Math.min(1, count / (width / 60));
}

const AMBULANCE_START_X = -60;
const AMBULANCE_END_X = CANVAS_W + 60;
const AMBULANCE_SPEED_BASE = 120; // px/s

function createInitialAmbulances(): Ambulance[] {
  return [
    {
      id: '1',
      x: AMBULANCE_START_X,
      y: ROAD_Y - LANE_H / 2,
      priority: 'critical',
      destination: 'St. John\'s Medical',
      eta: 0,
      active: false,
    },
  ];
}

export function useSimulation() {
  const [state, setState] = useState<SimulationState>({
    phase: 'idle',
    simTime: 0,
    ambulances: createInitialAmbulances(),
    vehicles: createInitialVehicles(),
    junctions: createJunctions(),
    roadSegments: createRoadSegments(),
    vehiclesCleared: 0,
    junctionsPrepared: 0,
    speed: 1,
    showHeatmap: true,
    showInstructions: true,
    language: 'en',
    co2Saved: 0,
    timeSavedSeconds: 0,
    hospitalBeds: HOSPITALS,
    // Surge Predictor initial state
    surgeMode: false,
    minutesUntilSurge: getMinutesUntilSurge(),
    techParkSurgeActive: getActiveSurgeTime() !== null,
    lastSurgeTime: 0,
    mockTimeMinutes: null,
    driverNotifications: [],
    totalAlertsSent: 0,
    totalAcknowledged: 0,
    notificationPhase: 'inactive',
    breakdowns: [],
    totalBreakdownsDetected: 0,
    spilloverEvents: [],
    spilloverZones: createSpilloverZones(),
    totalSpilloversDetected: 0,
    totalSpilloversPrevented: 0,
  });

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = useCallback((timestamp: number) => {
    const s = stateRef.current;
    if (s.phase === 'idle' || s.phase === 'done') return;

    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const rawDt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;
    const dt = rawDt * s.speed;

    setState(prev => {
      const next = { ...prev };
      next.simTime += dt;

      // ===== Surge Predictor Logic =====
      next.minutesUntilSurge = getMinutesUntilSurge(prev.mockTimeMinutes);
      const activeSurge = getActiveSurgeTime(prev.mockTimeMinutes);
      next.techParkSurgeActive = activeSurge !== null;

      // Detect if we're in pre-surge mode window (10 minutes before)
      if (isSurgeDetectionWindow(prev.mockTimeMinutes)) {
        next.surgeMode = true;
      } else {
        next.surgeMode = false;
      }

      // Apply surge mode effects to junctions
      if (next.surgeMode || next.techParkSurgeActive) {
        // Extend green duration on outbound roads during pre-surge
        next.junctions = prev.junctions.map((j, i) => {
          const nj = { ...j };
          nj.greenDuration = 5 * GREEN_TIME_MULTIPLIER; // 40% extension
          return nj;
        });
      }

      // Move vehicles normally (slight drift)
      next.vehicles = prev.vehicles.map(v => {
        const nv = { ...v };
        const leadAmb = next.ambulances.find(a => a.active) || next.ambulances[0];
        const ambAhead = leadAmb && leadAmb.active;

        if (v.road === 'main') {
          // Normal flow — all phases before clearing
          if (prev.phase === 'normal') {
            nv.x += v.direction * v.speed * dt * 0.3;
            if (nv.x > CANVAS_W + 20) nv.x = -20;
            if (nv.x < -20) nv.x = CANVAS_W + 20;
          }

          // Detection phase — vehicles ahead of ambulance start slowing / stopping
          if (prev.phase === 'detection' && ambAhead) {
            const distToAmb = nv.x - leadAmb.x;
            if (v.lane === 'top' && distToAmb > 0 && distToAmb < 350) {
              // Vehicles in top lane ahead slow down proportionally
              const slowFactor = Math.max(0.02, distToAmb / 350);
              nv.x += v.direction * v.speed * dt * 0.3 * slowFactor;
            } else if (v.lane === 'top' && distToAmb <= 0) {
              // Behind ambulance — normal drift
              nv.x += v.direction * v.speed * dt * 0.3;
            } else {
              // Bottom lane — slight slow
              nv.x += v.direction * v.speed * dt * 0.25;
            }
            if (nv.x > CANVAS_W + 20) nv.x = -20;
            if (nv.x < -20) nv.x = CANVAS_W + 20;
          }

          // Clearing / passage — blockers move to targets, others freeze or drift
          if (prev.phase === 'clearing' || prev.phase === 'passage') {
            if (v.isBlocker && !v.isNonCooperative && !v.cleared) {
              // Smooth eased movement toward target position
              const dx = v.targetX - nv.x;
              const dy = v.targetY - nv.y;
              const ease = Math.min(1, dt * 1.2); // smoother than dt*2
              nv.x += dx * ease;
              nv.y += dy * ease;
              if (Math.abs(dy) < 3 && Math.abs(dx) < 3) {
                nv.cleared = true;
              }
            } else if (v.isBlocker && v.isNonCooperative) {
              // Non-cooperative: stays put, slight vibration
              nv.x += (Math.random() - 0.5) * 0.5;
            } else if (!v.isBlocker && v.lane === 'top' && ambAhead) {
              // Non-blocker top lane behind ambulance — stop
              const distBehind = leadAmb.x - nv.x;
              if (distBehind > 0 && distBehind < 150) {
                // Freeze — just behind ambulance
              } else {
                nv.x += v.direction * v.speed * dt * 0.05;
              }
            } else if (v.lane === 'bottom') {
              // Bottom lane — slow crawl, slight pull to edge
              nv.x += v.direction * v.speed * dt * 0.08;
              const edgeTarget = ROAD_Y + LANE_H * 0.75;
              nv.y += (edgeTarget - nv.y) * dt * 0.3;
            }
          }
        }

        // Vertical road vehicles — slow/stop during active phases
        if (v.road === 'vertical') {
          if (prev.phase === 'normal' || prev.phase === 'detection') {
            nv.y += v.direction * v.speed * dt * 0.15;
          } else if (prev.phase === 'clearing' || prev.phase === 'passage') {
            // Freeze vertical traffic near junctions (signals holding)
            nv.y += v.direction * v.speed * dt * 0.02;
          }
        }

        return nv;
      });

      // Update multi-ambulance — speed depends on corridor clearance
      next.ambulances = prev.ambulances.map(amb => {
        const nAmb = { ...amb };
        if (nAmb.active) {
          // Check how many blockers are ahead and uncleared
          const blockersAhead = next.vehicles.filter(
            v => v.isBlocker && !v.cleared && !v.isNonCooperative && v.x > nAmb.x && v.x < nAmb.x + 200
          ).length;
          // Ambulance slows proportionally to blockers ahead (realistic)
          const clearance = Math.max(0.15, 1 - blockersAhead * 0.25);
          const baseSpeed = AMBULANCE_SPEED_BASE * clearance;
          const phaseMultiplier = prev.phase === 'passage' ? 1.6 : prev.phase === 'clearing' ? 0.7 : 0.4;

          nAmb.x += baseSpeed * dt * 0.3 * phaseMultiplier;
          const dist = JUNCTION_XS[2] + 100 - nAmb.x;
          nAmb.eta = Math.max(0, dist / (baseSpeed * phaseMultiplier));
        }
        return nAmb;
      });

      // ===== Driver Notification System =====
      if (prev.phase === 'detection' || prev.phase === 'clearing' || prev.phase === 'passage') {
        const leadAmb2 = next.ambulances.find(a => a.active) || next.ambulances[0];
        if (leadAmb2 && leadAmb2.active) {
          next.notificationPhase = prev.phase === 'detection' ? 'sending' : 'active';
          // Send notifications to vehicles in corridor (within 400px ahead)
          const corridorVehicles = next.vehicles.filter(
            v => v.road === 'main' && v.x > leadAmb2.x && v.x < leadAmb2.x + 400
          );
          const existingIds = new Set(prev.driverNotifications.map(n => n.vehicleId));
          const newNotifications: DriverNotification[] = [];
          for (const v of corridorVehicles) {
            if (!existingIds.has(v.id)) {
              const dist = Math.round((v.x - leadAmb2.x) * 1.5); // scale to ~meters
              let instr: DriverNotification['instruction'] = 'slow';
              if (v.lane === 'top' && v.isBlocker) {
                instr = v.instruction === 'moveLeft' ? 'moveLeft' : v.instruction === 'moveRight' ? 'moveRight' : 'hold';
              } else if (v.lane === 'bottom') {
                instr = 'slow';
              }
              newNotifications.push({
                id: randomId(),
                vehicleId: v.id,
                message: dist < 150 ? '⚠️ Clear lane immediately!' : '🚑 Ambulance approaching',
                instruction: instr,
                distance: dist,
                acknowledged: false,
                timestamp: next.simTime,
                eta: leadAmb2.eta,
              });
            }
          }
          // Auto-acknowledge older notifications (simulate drivers responding)
          next.driverNotifications = [
            ...prev.driverNotifications.map(n => {
              if (!n.acknowledged && next.simTime - n.timestamp > 1.5 + Math.random() * 2) {
                return { ...n, acknowledged: true };
              }
              return n;
            }),
            ...newNotifications,
          ];
          // Keep only last 30 notifications to avoid memory bloat
          if (next.driverNotifications.length > 30) {
            next.driverNotifications = next.driverNotifications.slice(-30);
          }
          next.totalAlertsSent = prev.totalAlertsSent + newNotifications.length;
          next.totalAcknowledged = next.driverNotifications.filter(n => n.acknowledged).length;
        }
      } else if (prev.phase === 'recovery' || prev.phase === 'done') {
        next.notificationPhase = 'complete';
      }

      // ===== Vehicle Breakdown Detection =====
      const BREAKDOWN_TYPES: VehicleBreakdown['type'][] = ['engine', 'tire', 'accident', 'fuel', 'electrical'];
      const BREAKDOWN_DESCS: Record<VehicleBreakdown['type'], string> = {
        engine: 'Engine overheating detected',
        tire: 'Flat tire — vehicle immobilized',
        accident: 'Minor collision reported',
        fuel: 'Vehicle ran out of fuel',
        electrical: 'Electrical system failure',
      };
      // Spawn a breakdown at ~8s and ~18s of sim
      if (prev.phase !== 'idle' && prev.phase !== 'done') {
        const shouldSpawn =
          (prev.simTime < 8 && next.simTime >= 8 && prev.breakdowns.length === 0) ||
          (prev.simTime < 18 && next.simTime >= 18 && prev.breakdowns.length <= 1);
        if (shouldSpawn) {
          // Pick a random main-road vehicle that isn't already broken down
          const brokenIds = new Set(prev.breakdowns.map(b => b.vehicleId));
          const candidates = next.vehicles.filter(v => v.road === 'main' && !v.isBlocker && !brokenIds.has(v.id));
          if (candidates.length > 0) {
            const victim = candidates[Math.floor(Math.random() * candidates.length)];
            const bType = BREAKDOWN_TYPES[Math.floor(Math.random() * BREAKDOWN_TYPES.length)];
            const severity: VehicleBreakdown['severity'] = bType === 'accident' ? 'critical' : bType === 'engine' ? 'major' : 'minor';
            const newBreakdown: VehicleBreakdown = {
              id: randomId(),
              vehicleId: victim.id,
              x: victim.x,
              y: victim.y,
              lane: victim.lane,
              road: victim.road,
              junctionIndex: victim.junctionIndex,
              severity,
              status: 'detected',
              type: bType,
              detectedAt: next.simTime,
              reportedToAdmin: false,
              towTruckEta: 180 + Math.floor(Math.random() * 120),
              nearbyDriversNotified: 0,
              laneBlockage: severity === 'critical' ? 0.8 : severity === 'major' ? 0.5 : 0.3,
              description: BREAKDOWN_DESCS[bType],
            };
            next.breakdowns = [...prev.breakdowns, newBreakdown];
            next.totalBreakdownsDetected = prev.totalBreakdownsDetected + 1;
            // Freeze the vehicle
            next.vehicles = next.vehicles.map(v =>
              v.id === victim.id ? { ...v, speed: 0, targetX: v.x, targetY: v.y } : v
            );
          }
        }
        // Progress breakdown statuses over time
        next.breakdowns = next.breakdowns.map(b => {
          const age = next.simTime - b.detectedAt;
          const nb = { ...b };
          if (age > 1 && !nb.reportedToAdmin) {
            nb.reportedToAdmin = true;
            nb.status = 'confirmed';
          }
          if (age > 4 && nb.status === 'confirmed') {
            nb.status = 'responding';
            nb.nearbyDriversNotified = Math.min(12, Math.floor(age * 1.5));
          }
          if (age > 12) {
            nb.status = 'cleared';
            nb.nearbyDriversNotified = 12;
          }
          nb.towTruckEta = Math.max(0, b.towTruckEta - dt);
          return nb;
        });
      }

      // ===== Spillover Detection System (Enhanced Accuracy) =====
      if (prev.phase !== 'idle' && prev.phase !== 'done') {
        const zones = [...prev.spilloverZones];
        const newSpilloverEvents: SpilloverEvent[] = [];
        const updatedZones: SpilloverZone[] = [];

        for (let zi = 0; zi < zones.length; zi++) {
          const { event, updatedZone } = detectSpillover(
            zones[zi], next.vehicles, next.simTime, dt,
            next.spilloverEvents, zones,
          );
          updatedZones.push(updatedZone);
          if (event) {
            newSpilloverEvents.push(event);
          }
        }

        // Persist zone tracking state
        next.spilloverZones = updatedZones;

        if (newSpilloverEvents.length > 0) {
          next.spilloverEvents = [...prev.spilloverEvents, ...newSpilloverEvents];
          next.totalSpilloversDetected = prev.totalSpilloversDetected + newSpilloverEvents.length;

          // Apply actions: extend green, stop cross traffic
          for (const evt of newSpilloverEvents) {
            if (evt.action === 'extending_green' || evt.action === 'clearing_junction') {
              next.junctions = next.junctions.map((j, i) => {
                if (i === evt.junctionIndex) {
                  return {
                    ...j,
                    greenDuration: j.greenDuration + evt.greenExtension,
                    signalState: 'green' as const,
                  };
                }
                return j;
              });
            }
            if (evt.action === 'stopping_cross' || evt.action === 'clearing_junction') {
              // Stop cross-traffic by holding vertical vehicles
              next.vehicles = next.vehicles.map(v => {
                if (v.road === 'vertical' && v.junctionIndex === evt.junctionIndex) {
                  return { ...v, speed: Math.max(0, v.speed * 0.1) };
                }
                return v;
              });
            }
          }
        }

        // --- Upgrade existing active events based on current conditions ---
        next.spilloverEvents = next.spilloverEvents.map(evt => {
          if (evt.resolvedAt) return evt;

          // Re-evaluate current zone conditions for this event
          const zoneIdx = updatedZones.findIndex(
            z => z.junctionIndex === evt.junctionIndex && z.lane === evt.lane
          );
          if (zoneIdx < 0) return evt;
          const z = updatedZones[zoneIdx];

          const laneVehicles = next.vehicles.filter(v => v.road === 'main' && v.lane === evt.lane);
          const inCritical = laneVehicles.filter(v => {
            const minX = Math.min(z.criticalStart, z.criticalEnd);
            const maxX = Math.max(z.criticalStart, z.criticalEnd);
            return v.x >= minX && v.x <= maxX;
          });
          const inJunctionBox = laneVehicles.filter(v =>
            v.x >= z.junctionBoxStart && v.x <= z.junctionBoxEnd
          );
          const inApproach = laneVehicles.filter(v => {
            const minX = Math.min(z.approachStart, z.approachEnd);
            const maxX = Math.max(z.approachStart, z.approachEnd);
            return v.x >= minX && v.x <= maxX;
          });

          const currentScore = computeRiskScore(inApproach, inCritical, inJunctionBox, z, 0, evt.cascadeRisk);
          const currentRisk = riskFromScore(currentScore);
          const ranks: SpilloverRisk[] = ['none', 'low', 'moderate', 'high', 'critical'];

          // Update the event: escalate if worse, track peak
          const updatedEvt = { ...evt, dwellFrames: evt.dwellFrames + 1 };
          if (ranks.indexOf(currentRisk) > ranks.indexOf(evt.risk)) {
            updatedEvt.risk = currentRisk;
            updatedEvt.action = actionFromRisk(currentRisk);
            updatedEvt.greenExtension = greenExtensionFromScore(currentScore);
          }
          if (ranks.indexOf(currentRisk) > ranks.indexOf(evt.peakRisk)) {
            updatedEvt.peakRisk = currentRisk;
          }

          // Update live stats
          const allZoneVs = [...inApproach, ...inCritical, ...inJunctionBox];
          updatedEvt.queueLength = inApproach.length + inCritical.length;
          updatedEvt.vehiclesInJunction = inJunctionBox.length;
          updatedEvt.stoppedInJunction = inJunctionBox.some(v => v.speed < STOPPED_SPEED_THRESHOLD);
          updatedEvt.avgSpeed = allZoneVs.length > 0
            ? allZoneVs.reduce((sum, v) => sum + v.speed, 0) / allZoneVs.length
            : 999;

          // --- Condition-based resolution (NOT timer-based) ---
          // Resolve only when: zone is clear for enough frames AND score has dropped
          if (currentRisk === 'none' && z.framesAtClear >= SPILLOVER_CLEAR_FRAMES) {
            return { ...updatedEvt, resolvedAt: next.simTime, prevented: true };
          }
          // Fallback max lifetime: 12s (safety net)
          if (next.simTime - evt.detectedAt > 12) {
            return { ...updatedEvt, resolvedAt: next.simTime, prevented: currentScore < 20 };
          }

          return updatedEvt;
        });

        next.totalSpilloversPrevented = next.spilloverEvents.filter(e => e.prevented).length;

        // Keep only last 25 events
        if (next.spilloverEvents.length > 25) {
          next.spilloverEvents = next.spilloverEvents.slice(-25);
        }
      }

      // Phase transitions
      if (prev.phase === 'normal' && next.simTime > 3) {
        next.phase = 'detection';
        next.ambulances[0].active = true;
        next.ambulances[0].x = AMBULANCE_START_X;
        // Add second ambulance at 15s
        if (next.ambulances.length === 1) {
          next.ambulances.push({
            id: '2',
            x: AMBULANCE_START_X,
            y: ROAD_Y + LANE_H / 2,
            priority: 'non-critical',
            destination: 'Fortis Hospital',
            eta: 0,
            active: false,
          });
        }
      }

      if (prev.phase === 'detection') {
        // Spawn second ambulance mid-detection
        if (next.simTime > 15 && !next.ambulances[1].active) {
          next.ambulances[1].active = true;
        }

        if (next.ambulances[0].eta < 12) {
          next.phase = 'clearing';
          // Mark blockers progressively — only those within 400px ahead of ambulance
          const ambX = next.ambulances[0].x;
          next.vehicles = next.vehicles.map(v => {
            if (v.road === 'main' && v.lane === 'top' && v.x > ambX && v.x < ambX + 400 && !v.isBlocker) {
              const nv = { ...v, isBlocker: true, instruction: null as Vehicle['instruction'] };
              // Decide instruction based on position
              if (v.width > 30) {
                nv.instruction = 'hold';
              } else {
                // Vehicles above road center go left, others go right
                nv.instruction = v.y < ROAD_Y ? 'moveLeft' : 'moveRight';
              }
              // Set target — spread them out more to not cluster
              const spread = (Math.random() - 0.5) * 30;
              if (nv.instruction === 'moveLeft') {
                nv.targetY = ROAD_Y - LANE_H - 20 - Math.random() * 20;
                nv.targetX = v.x + spread + 15;
              } else if (nv.instruction === 'moveRight') {
                nv.targetY = ROAD_Y + LANE_H + 5 + Math.random() * 15;
                nv.targetX = v.x + spread - 10;
              } else {
                nv.targetX = v.x;
                nv.targetY = v.y;
              }
              // 12% chance non-cooperative
              if (Math.random() < 0.12) {
                nv.isNonCooperative = true;
              }
              return nv;
            }
            return v;
          });
        }
      }

      // During clearing, progressively mark more blockers as ambulance advances
      if (prev.phase === 'clearing' || prev.phase === 'passage') {
        const ambX = next.ambulances[0]?.x || 0;
        next.vehicles = next.vehicles.map(v => {
          if (v.road === 'main' && v.lane === 'top' && !v.isBlocker && v.x > ambX && v.x < ambX + 300) {
            const nv = { ...v, isBlocker: true };
            nv.instruction = v.y < ROAD_Y ? 'moveLeft' : 'moveRight';
            const spread = (Math.random() - 0.5) * 20;
            if (nv.instruction === 'moveLeft') {
              nv.targetY = ROAD_Y - LANE_H - 20 - Math.random() * 20;
              nv.targetX = v.x + spread + 10;
            } else {
              nv.targetY = ROAD_Y + LANE_H + 5 + Math.random() * 15;
              nv.targetX = v.x + spread - 5;
            }
            if (Math.random() < 0.1) nv.isNonCooperative = true;
            return nv;
          }
          return v;
        });

        // Prepare junctions as ambulances approach
        next.junctions = prev.junctions.map((j, i) => {
          const nj = { ...j };
          const leadAmbulance = next.ambulances.find(a => a.active) || next.ambulances[0];
          if (leadAmbulance.x > j.x - 200 && !j.prepared) {
            nj.prepared = true;
            nj.signalState = 'green';
            nj.cascadeActive = true;
          }
          if (leadAmbulance.x > j.x - 300 && !j.cascadeActive) {
            nj.cascadeActive = true;
            nj.signalState = 'yellow';
          }
          return nj;
        });

        next.junctionsPrepared = next.junctions.filter(j => j.prepared).length;
        next.vehiclesCleared = next.vehicles.filter(v => v.cleared || (v.isBlocker && !v.isNonCooperative)).length;

        // Calculate CO2 saved (baseline 60s - actual time)
        next.timeSavedSeconds = Math.max(0, BASELINE_TIME_SECONDS - next.simTime);
        next.co2Saved = Math.max(0, (BASELINE_TIME_SECONDS - next.simTime) * (CO2_PER_MINUTE_IDLING / 60));

        // Transition to passage when most blockers cleared
        if (prev.phase === 'clearing') {
          const blockers = next.vehicles.filter(v => v.isBlocker && !v.isNonCooperative);
          const clearedCount = blockers.filter(v => v.cleared || Math.abs(v.y - v.targetY) < 5).length;
          if (clearedCount >= blockers.length * 0.7 || next.simTime > 20) {
            next.phase = 'passage';
          }
        }

        const leadAmb = next.ambulances.find(a => a.active) || next.ambulances[0];
        if (leadAmb.x > AMBULANCE_END_X - 50) {
          next.phase = 'recovery';
        }
      }

      if (prev.phase === 'recovery') {
        if (next.simTime > prev.simTime + 3) {
          next.phase = 'done';
        }
        // Reset junctions
        next.junctions = prev.junctions.map(j => ({ ...j, cascadeActive: false, signalState: 'green' as const }));
      }

      // Update congestion
      next.roadSegments = prev.roadSegments.map(seg => ({
        ...seg,
        congestion: calcCongestion(seg, next.vehicles),
      }));

      return next;
    });

    rafRef.current = requestAnimationFrame(update);
  }, []);

  const start = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'normal',
      simTime: 0,
      ambulances: createInitialAmbulances(),
      vehicles: createInitialVehicles(),
      junctions: createJunctions(),
      roadSegments: createRoadSegments(),
      vehiclesCleared: 0,
      junctionsPrepared: 0,
      co2Saved: 0,
      timeSavedSeconds: 0,
      surgeMode: false,
      minutesUntilSurge: getMinutesUntilSurge(prev.mockTimeMinutes),
      techParkSurgeActive: getActiveSurgeTime(prev.mockTimeMinutes) !== null,
      lastSurgeTime: 0,
      driverNotifications: [],
      totalAlertsSent: 0,
      totalAcknowledged: 0,
      notificationPhase: 'inactive',
      breakdowns: [],
      totalBreakdownsDetected: 0,
      spilloverEvents: [],
      spilloverZones: createSpilloverZones(),
      totalSpilloversDetected: 0,
      totalSpilloversPrevented: 0,
    }));
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(update);
  }, [update]);

  const pause = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  const resume = useCallback(() => {
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(update);
  }, [update]);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setState(prev => ({
      ...prev,
      phase: 'idle',
      simTime: 0,
      ambulances: createInitialAmbulances(),
      vehicles: createInitialVehicles(),
      junctions: createJunctions(),
      roadSegments: createRoadSegments(),
      vehiclesCleared: 0,
      junctionsPrepared: 0,
      co2Saved: 0,
      timeSavedSeconds: 0,
      surgeMode: false,
      minutesUntilSurge: getMinutesUntilSurge(prev.mockTimeMinutes),
      techParkSurgeActive: getActiveSurgeTime(prev.mockTimeMinutes) !== null,
      lastSurgeTime: 0,
      driverNotifications: [],
      totalAlertsSent: 0,
      totalAcknowledged: 0,
      notificationPhase: 'inactive',
      breakdowns: [],
      totalBreakdownsDetected: 0,
      spilloverEvents: [],
      spilloverZones: createSpilloverZones(),
      totalSpilloversDetected: 0,
      totalSpilloversPrevented: 0,
    }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, speed }));
  }, []);

  const setLanguage = useCallback((language: Language) => {
    setState(prev => ({ ...prev, language }));
  }, []);

  const toggleHeatmap = useCallback(() => {
    setState(prev => ({ ...prev, showHeatmap: !prev.showHeatmap }));
  }, []);

  const toggleInstructions = useCallback(() => {
    setState(prev => ({ ...prev, showInstructions: !prev.showInstructions }));
  }, []);

  const setMockTime = useCallback((minutes: number | null) => {
    setState(prev => {
      const mt = minutes;
      return {
        ...prev,
        mockTimeMinutes: mt,
        minutesUntilSurge: getMinutesUntilSurge(mt),
        techParkSurgeActive: getActiveSurgeTime(mt) !== null,
        surgeMode: isSurgeDetectionWindow(mt),
      };
    });
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    state,
    start,
    pause,
    resume,
    reset,
    setSpeed,
    setLanguage,
    toggleHeatmap,
    toggleInstructions,
    setMockTime,
    getClosestSurgeName: (mt?: number | null) => getClosestSurgeName(mt),
  };
}
