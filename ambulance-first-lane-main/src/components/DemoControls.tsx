import React from 'react';
import { Play, Pause, RotateCcw, Eye, EyeOff, Mic, MicOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllDemoScenarios } from '@/configs/demo-scenarios';
import type { DemoScenario, RecordingSettings } from '@/types/demo';

interface DemoControlsProps {
  selectedScenario: DemoScenario | null;
  isRunning: boolean;
  isPaused: boolean;
  recordingSettings: RecordingSettings;
  onScenarioSelect: (scenario: DemoScenario) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onToggleMetrics: () => void;
  onToggleArrows: () => void;
  onToggleSirenSound: () => void;
}

export const DemoControls: React.FC<DemoControlsProps> = ({
  selectedScenario,
  isRunning,
  isPaused,
  recordingSettings,
  onScenarioSelect,
  onStart,
  onPause,
  onResume,
  onReset,
  onToggleMetrics,
  onToggleArrows,
  onToggleSirenSound,
}) => {
  const scenarios = getAllDemoScenarios();

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border bg-card">
      {/* Scenario Selection */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Select Demo Scenario</label>
        <div className="grid grid-cols-1 gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => onScenarioSelect(scenario)}
              className={`p-3 rounded-lg text-left border-2 transition-all ${
                selectedScenario?.id === scenario.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 bg-muted/30'
              }`}
            >
              <div className="font-semibold text-sm">{scenario.name}</div>
              <div className="text-xs text-muted-foreground">{scenario.description}</div>
              <div className="text-xs text-primary mt-1 font-mono">
                Duration: {scenario.duration}s | Density: {(scenario.trafficDensity * 100).toFixed(0)}%
                {scenario.surgeMode && ' | Surge Mode'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Transport Controls */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Transport Controls</label>
        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={onStart} className="flex-1 gap-2" disabled={!selectedScenario}>
              <Play className="h-4 w-4" />
              Start Demo
            </Button>
          ) : isPaused ? (
            <Button onClick={onResume} className="flex-1 gap-2" variant="secondary">
              <Play className="h-4 w-4" />
              Resume
            </Button>
          ) : (
            <Button onClick={onPause} className="flex-1 gap-2" variant="secondary">
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
          <Button onClick={onReset} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Recording Overlays */}
      <div className="space-y-2">
        <label className="text-sm font-semibold">Recording Overlays</label>
        <div className="space-y-2">
          <Button
            onClick={onToggleMetrics}
            variant={recordingSettings.showMetrics ? 'secondary' : 'outline'}
            className="w-full justify-start gap-2"
          >
            {recordingSettings.showMetrics ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Show Metrics (ETA, Clearance Rate)
          </Button>
          <Button
            onClick={onToggleArrows}
            variant={recordingSettings.showArrows ? 'secondary' : 'outline'}
            className="w-full justify-start gap-2"
          >
            {recordingSettings.showArrows ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Show Vehicle Arrows & Instructions
          </Button>
          <Button
            onClick={onToggleSirenSound}
            variant={recordingSettings.addSirenSound ? 'secondary' : 'outline'}
            className="w-full justify-start gap-2"
          >
            {recordingSettings.addSirenSound ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            Add Siren Sound
          </Button>
        </div>
      </div>

      {/* Recording Tips */}
      <div className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Video className="h-4 w-4" />
          Recording Tips
        </div>
        <ul className="space-y-1 text-muted-foreground text-xs">
          <li>✓ Use OBS, ScreenFlow, or built-in screen recorder</li>
          <li>✓ Record at 1080p 60fps for best quality</li>
          <li>✓ Keep demo under 60 seconds for impact</li>
          <li>✓ Metrics overlay adds visual storytelling</li>
          <li>✓ Siren sound creates emotional impact</li>
        </ul>
      </div>

      {/* Current Scenario Info */}
      {selectedScenario && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-1 text-xs">
          <div className="font-semibold text-primary">Scenario Notes</div>
          <div className="text-muted-foreground">{selectedScenario.recordingNotes}</div>
        </div>
      )}
    </div>
  );
};
