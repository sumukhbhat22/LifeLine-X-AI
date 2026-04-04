import { DemoScenario } from '@/types/demo';

/**
 * Pre-designed demo scenarios for perfect video capture
 * Each scenario is optimized for visual impact and storytelling
 */

export const DEMO_SCENARIOS: Record<string, DemoScenario> = {
  'perfect-clearance': {
    id: 'perfect-clearance',
    name: 'Perfect Ambulance Clearance (No Surge)',
    description: 'Optimal scenario - ambulance navigates through normal traffic smoothly',
    duration: 45,
    trafficDensity: 0.6,
    surgeMode: false,
    recordingNotes: 'Perfect for: Showing core functionality, smooth navigation, low ETA',
    events: [
      {
        time: 0,
        type: 'text-overlay',
        data: { text: 'NORMAL TRAFFIC CONDITIONS', position: 'top-center', duration: 3 },
      },
      {
        time: 3,
        type: 'ambulance-spawn',
        data: { speed: 1.5, message: 'Ambulance dispatched' },
      },
      {
        time: 5,
        type: 'text-overlay',
        data: { text: 'ETA: 28 seconds to destination', position: 'bottom-right', duration: 25 },
      },
      {
        time: 10,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 18, vehiclesAhead: 8 },
      },
      {
        time: 20,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 8, vehiclesAhead: 3 },
      },
      {
        time: 33,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 0, message: 'DESTINATION REACHED' },
      },
      {
        time: 35,
        type: 'text-overlay',
        data: { text: '✓ All vehicles cleared', position: 'bottom-center', duration: 5 },
      },
      {
        time: 40,
        type: 'text-overlay',
        data: { text: 'Total clearance time: 33 seconds', position: 'top-center', duration: 5 },
      },
    ],
  },

  'surge-prediction': {
    id: 'surge-prediction',
    name: 'Surge Predictor in Action (Pre-Surge Mode)',
    description: 'Tech Park Surge detected - system pre-optimizes signals 10 min before',
    duration: 60,
    trafficDensity: 0.8,
    surgeMode: true,
    recordingNotes: 'Perfect for: Showcase predictive AI, signal optimization, surge awareness',
    events: [
      {
        time: 0,
        type: 'text-overlay',
        data: { text: 'BENGALURU IT SHIFT - 8:30 AM SURGE INCOMING', position: 'top-center', duration: 4 },
      },
      {
        time: 2,
        type: 'text-overlay',
        data: { text: 'Pre-Surge Mode: 10 minutes to surge (ACTIVATED)', position: 'top-right', duration: 3 },
      },
      {
        time: 4,
        type: 'text-overlay',
        data: { text: 'Signal green times extended 40% on outbound roads', position: 'bottom-center', duration: 3 },
      },
      {
        time: 8,
        type: 'ambulance-spawn',
        data: { speed: 1.5, message: 'Ambulance call received during pre-surge' },
      },
      {
        time: 10,
        type: 'text-overlay',
        data: { text: 'System already optimized for surge - best case scenario', position: 'bottom-right', duration: 20 },
      },
      {
        time: 15,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 40, warning: 'Surge within 5 minutes' },
      },
      {
        time: 25,
        type: 'text-overlay',
        data: { text: '⚠️ SURGE ACTIVE - Peak congestion detected', position: 'top-center', duration: 2 },
      },
      {
        time: 28,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 27, hazardLevel: 'high' },
      },
      {
        time: 40,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 15, vehiclesCleared: 16 },
      },
      {
        time: 50,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 5, surge: 'peak' },
      },
      {
        time: 55,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 0, message: 'DESTINATION REACHED' },
      },
      {
        time: 58,
        type: 'text-overlay',
        data: { text: 'Ambulance passage during surge: 55 seconds\nWithout predictor: ~95 seconds\nTime saved: 40 seconds', position: 'top-center', duration: 4 },
      },
    ],
  },

  'worst-case': {
    id: 'worst-case',
    name: 'Worst-Case Scenario (Surge + Heavy Traffic)',
    description: 'Ambulance arrives during peak IT shift surge with heavy congestion',
    duration: 70,
    trafficDensity: 0.95,
    surgeMode: true,
    recordingNotes: 'Perfect for: Impact demo, showing system handles extreme conditions',
    events: [
      {
        time: 0,
        type: 'text-overlay',
        data: { text: 'WORST-CASE SCENARIO: Tech Park Surge + Ambulance', position: 'top-center', duration: 3 },
      },
      {
        time: 2,
        type: 'text-overlay',
        data: { text: '⚠️ Peak congestion at 6:30 PM', position: 'top-right', duration: 2 },
      },
      {
        time: 5,
        type: 'ambulance-spawn',
        data: { speed: 1.5, message: 'EMERGENCY: Ambulance dispatched' },
      },
      {
        time: 7,
        type: 'text-overlay',
        data: { text: 'ETA: 68 seconds (with system optimization)', position: 'bottom-center', duration: 30 },
      },
      {
        time: 10,
        type: 'text-overlay',
        data: { text: '🏗️ Dynamic signal optimization: Active', position: 'bottom-right', duration: 5 },
      },
      {
        time: 20,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 48, severity: 'critical' },
      },
      {
        time: 35,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 33, hazardLevel: 'extreme' },
      },
      {
        time: 50,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 18, clearanceRate: '92%' },
      },
      {
        time: 65,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 3, finalApproach: true },
      },
      {
        time: 68,
        type: 'ambulance-checkpoint',
        data: { etaRemaining: 0, message: 'DESTINATION REACHED SAFELY' },
      },
      {
        time: 70,
        type: 'text-overlay',
        data: { text: '✓ System handled worst-case scenario effectively\n19 vehicles cleared | 3 junctions optimized', position: 'top-center', duration: 5 },
      },
    ],
  },

  'cascade-demo': {
    id: 'cascade-demo',
    name: 'Cascade Optimization Demo',
    description: 'Show cascading junction optimization - each junction prepares for ambulance arrival',
    duration: 50,
    trafficDensity: 0.7,
    surgeMode: false,
    recordingNotes: 'Perfect for: Technical judges, showing algorithmic sophistication',
    events: [
      {
        time: 0,
        type: 'text-overlay',
        data: { text: 'CASCADE JUNCTION OPTIMIZATION', position: 'top-center', duration: 3 },
      },
      {
        time: 3,
        type: 'ambulance-spawn',
        data: { speed: 1.5 },
      },
      {
        time: 5,
        type: 'text-overlay',
        data: { text: 'Junction 1: Preparing (200m ahead)', position: 'bottom-left', duration: 8 },
      },
      {
        time: 8,
        type: 'text-overlay',
        data: { text: 'Junction 2: Pre-optimized (520m ahead)', position: 'bottom-center', duration: 10 },
      },
      {
        time: 12,
        type: 'text-overlay',
        data: { text: 'Junction 3: Activated (820m ahead)', position: 'bottom-right', duration: 10 },
      },
      {
        time: 20,
        type: 'ambulance-checkpoint',
        data: { junctionsPrepared: 1 },
      },
      {
        time: 30,
        type: 'ambulance-checkpoint',
        data: { junctionsPrepared: 2 },
      },
      {
        time: 40,
        type: 'ambulance-checkpoint',
        data: { junctionsPrepared: 3, etaRemaining: 10 },
      },
      {
        time: 50,
        type: 'text-overlay',
        data: { text: '✓ All 3 junctions prepared | Perfect coordination', position: 'top-center', duration: 5 },
      },
    ],
  },
};

export function getDemoScenario(id: string): DemoScenario | null {
  return DEMO_SCENARIOS[id] || null;
}

export function getAllDemoScenarios(): DemoScenario[] {
  return Object.values(DEMO_SCENARIOS);
}
