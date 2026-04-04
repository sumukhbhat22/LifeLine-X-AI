export type Phase = 'idle' | 'normal' | 'detection' | 'clearing' | 'passage' | 'recovery' | 'done';

export type Instruction = 'moveLeft' | 'moveRight' | 'hold' | null;

export type Language = 'en' | 'hi' | 'kn' | 'ta';

export type AmbulancePriority = 'critical' | 'non-critical';

export type BreakdownSeverity = 'minor' | 'major' | 'critical';
export type BreakdownStatus = 'detected' | 'confirmed' | 'responding' | 'cleared';

// ===== Spillover Detection =====
export type SpilloverRisk = 'none' | 'low' | 'moderate' | 'high' | 'critical';
export type SpilloverAction = 'none' | 'extending_green' | 'stopping_cross' | 'clearing_junction';

export interface SpilloverZone {
  junctionIndex: number;
  lane: 'top' | 'bottom';
  approachStart: number;   // x position
  approachEnd: number;
  criticalStart: number;
  criticalEnd: number;
  junctionBoxStart: number;
  junctionBoxEnd: number;
  // Tracking state for temporal smoothing
  prevVehicleCount: number;   // vehicle count from last frame (for growth rate)
  riskAccumulator: number;    // accumulates risk score over frames for hysteresis
  framesAtRisk: number;       // consecutive frames with risk > none
  framesAtClear: number;      // consecutive frames with risk = none (for de-escalation)
}

export interface SpilloverEvent {
  id: string;
  junctionIndex: number;
  lane: 'top' | 'bottom';
  risk: SpilloverRisk;
  queueLength: number;        // number of vehicles in queue
  queueReachPct: number;      // 0-100, how far queue extends (spatial)
  vehiclesInJunction: number;
  stoppedInJunction: boolean;
  action: SpilloverAction;
  greenExtension: number;     // extra seconds added
  detectedAt: number;         // simTime
  resolvedAt: number | null;
  prevented: boolean;
  // Enhanced accuracy fields
  avgSpeed: number;           // average speed of vehicles in zone (px/s)
  queueDensity: number;       // vehicles per 100px of zone
  growthRate: number;         // queue growth rate (vehicles/s), positive = growing
  cascadeRisk: boolean;       // downstream junction also at risk
  dwellFrames: number;        // how many update frames this condition persisted
  peakRisk: SpilloverRisk;    // highest risk level reached during this event
}

export interface VehicleBreakdown {
  id: string;
  vehicleId: string;
  x: number;
  y: number;
  lane: 'top' | 'bottom';
  road: 'main' | 'vertical';
  junctionIndex: number;
  severity: BreakdownSeverity;
  status: BreakdownStatus;
  type: 'engine' | 'tire' | 'accident' | 'fuel' | 'electrical';
  detectedAt: number; // simTime
  reportedToAdmin: boolean;
  towTruckEta: number; // seconds
  nearbyDriversNotified: number;
  laneBlockage: number; // 0-1, how much of lane is blocked
  description: string;
}

export interface DriverNotification {
  id: string;
  vehicleId: string;
  message: string;
  instruction: 'moveLeft' | 'moveRight' | 'hold' | 'slow';
  distance: number; // meters from ambulance
  acknowledged: boolean;
  timestamp: number; // simTime when sent
  eta: number; // ambulance ETA in seconds
}

export interface Ambulance {
  id: string;
  x: number;
  y: number;
  priority: AmbulancePriority;
  destination: string; // hospital name
  eta: number; // seconds
  active: boolean;
}

export interface Vehicle {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  width: number;
  height: number;
  color: string;
  lane: 'top' | 'bottom';
  road: 'main' | 'vertical';
  junctionIndex: number; // nearest junction (0,1,2)
  instruction: Instruction;
  isBlocker: boolean;
  isNonCooperative: boolean;
  cleared: boolean;
  speed: number; // px per second
  direction: number; // 1 or -1
}

export interface Junction {
  x: number;
  y: number;
  signalState: 'red' | 'green' | 'yellow';
  prepared: boolean;
  cascadeActive: boolean;
  greenDuration: number; // Current green light duration in seconds
}

export interface RoadSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  congestion: number; // 0-1
}

export interface SimulationState {
  phase: Phase;
  simTime: number;
  ambulances: Ambulance[]; // Multiple ambulances
  vehicles: Vehicle[];
  junctions: Junction[];
  roadSegments: RoadSegment[];
  vehiclesCleared: number;
  junctionsPrepared: number;
  speed: number;
  showHeatmap: boolean;
  showInstructions: boolean;
  language: Language;
  // Carbon emissions tracking
  co2Saved: number; // kg CO2 saved
  timeSavedSeconds: number; // baseline time - optimized time
  // Hospital bed availability
  hospitalBeds: { name: string; beds: number; distance: number }[];
  // Surge Predictor fields
  surgeMode: boolean; // Active pre-surge optimization mode
  minutesUntilSurge: number; // Time until next surge (in minutes)
  techParkSurgeActive: boolean; // Whether surge is happening now
  lastSurgeTime: number; // Simulation time of last surge detection
  // Mock clock for demo (minutes since midnight, null = use real clock)
  mockTimeMinutes: number | null;
  // Driver Notification System
  driverNotifications: DriverNotification[];
  totalAlertsSent: number;
  totalAcknowledged: number;
  notificationPhase: 'inactive' | 'sending' | 'active' | 'complete';
  // Vehicle Breakdown Detection
  breakdowns: VehicleBreakdown[];
  totalBreakdownsDetected: number;
  // Spillover Detection
  spilloverEvents: SpilloverEvent[];
  spilloverZones: SpilloverZone[];
  totalSpilloversDetected: number;
  totalSpilloversPrevented: number;
}

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: { moveLeft: '← Move Left', moveRight: 'Move Right →', hold: '⏸ Hold', nonCoop: '⚠ Non-Cooperative' },
  hi: { moveLeft: '← बाएं जाएं', moveRight: 'दाएं जाएं →', hold: '⏸ रुकें', nonCoop: '⚠ असहयोगी' },
  kn: { moveLeft: '← ಎಡಕ್ಕೆ ಹೋಗಿ', moveRight: 'ಬಲಕ್ಕೆ ಹೋಗಿ →', hold: '⏸ ನಿಲ್ಲಿ', nonCoop: '⚠ ಅಸಹಕಾರ' },
  ta: { moveLeft: '← இடது நகர்', moveRight: 'வலது நகர் →', hold: '⏸ நில்', nonCoop: '⚠ ஒத்துழையாத' },
};

// Tech Park Surge Predictor
// Bengaluru IT shift timings: 8:30am, 1pm, 6:30pm
export const TECH_PARK_SURGE_TIMES = [
  { hour: 8, minute: 30, name: 'Morning Shift' },
  { hour: 13, minute: 0, name: 'Afternoon Shift' },
  { hour: 18, minute: 30, name: 'Evening Shift' },
];

export const SURGE_DETECTION_WINDOW = 10; // minutes before surge to activate pre-mode
export const SURGE_ACTIVE_WINDOW = 15; // minutes during which surge is active
export const GREEN_TIME_MULTIPLIER = 1.4; // 40% extension on outbound roads

// Layout constants
export const CANVAS_W = 1100;
export const CANVAS_H = 500;
export const ROAD_Y = 220; // center of main road
export const ROAD_H = 60; // total height (2 lanes of 30)
export const LANE_H = 30;
export const JUNCTION_XS = [220, 520, 820];
export const VERT_ROAD_W = 50;
export const AMBULANCE_W = 45;
export const AMBULANCE_H = 20;
