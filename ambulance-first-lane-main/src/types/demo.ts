// Demo scenario configuration types
export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  duration: number; // total duration in seconds
  events: DemoEvent[];
  trafficDensity: number; // 0.1 - 1.0
  surgeMode: boolean;
  recordingNotes: string;
}

export interface DemoEvent {
  time: number; // seconds into demo
  type: 'ambulance-spawn' | 'ambulance-checkpoint' | 'surge-activate' | 'vehicle-clear' | 'text-overlay';
  data: Record<string, any>;
}

export interface RecordingSettings {
  fps: number;
  resolution: 'HD' | '4K' | '720p';
  showMetrics: boolean;
  showArrows: boolean;
  showCountdown: boolean;
  addSirenSound: boolean;
  overlayOpacity: number; // 0-1
}

export interface DemoMetrics {
  vehiclesCleared: number;
  timeElapsed: number;
  timeSaved: number;
  junctionsPrepared: number;
  surgeDetectedAt: number;
}
