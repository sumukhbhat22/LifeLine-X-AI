import React from 'react';
import { Play, Pause, RotateCcw, Eye, EyeOff, Languages, MapPin, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { Language, Phase } from '@/types/simulation';

interface Props {
  phase: Phase;
  speed: number;
  language: Language;
  showHeatmap: boolean;
  showInstructions: boolean;
  surgeMode: boolean;
  minutesUntilSurge: number;
  techParkSurgeActive: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onLanguageChange: (lang: Language) => void;
  onToggleHeatmap: () => void;
  onToggleInstructions: () => void;
}

const LANGS: { value: Language; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'hi', label: 'हिं' },
  { value: 'kn', label: 'ಕನ್' },
  { value: 'ta', label: 'தமி' },
];

export const ControlsPanel: React.FC<Props> = ({
  phase, speed, language, showHeatmap, showInstructions,
  surgeMode, minutesUntilSurge, techParkSurgeActive,
  onStart, onPause, onResume, onReset, onSpeedChange,
  onLanguageChange, onToggleHeatmap, onToggleInstructions,
}) => {
  const isRunning = phase !== 'idle' && phase !== 'done';
  const [paused, setPaused] = React.useState(false);

  const handlePlayPause = () => {
    if (phase === 'idle' || phase === 'done') {
      onStart();
      setPaused(false);
    } else if (paused) {
      onResume();
      setPaused(false);
    } else {
      onPause();
      setPaused(true);
    }
  };

  const handleReset = () => {
    setPaused(false);
    onReset();
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      {/* Play / Pause */}
      <Button
        onClick={handlePlayPause}
        size="sm"
        variant={isRunning && !paused ? 'secondary' : 'default'}
        className="gap-1.5"
      >
        {isRunning && !paused ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {isRunning && !paused ? 'Pause' : phase === 'idle' || phase === 'done' ? 'Start' : 'Resume'}
      </Button>

      <Button onClick={handleReset} size="sm" variant="outline" className="gap-1.5">
        <RotateCcw className="h-3.5 w-3.5" /> Reset
      </Button>

      {/* Speed */}
      <div className="flex items-center gap-2 ml-2">
        <span className="text-xs text-muted-foreground font-mono">Speed</span>
        <Slider
          value={[speed]}
          onValueChange={([v]) => onSpeedChange(v)}
          min={0.5} max={4} step={0.5}
          className="w-24"
        />
        <span className="text-xs font-mono text-primary w-8">{speed}x</span>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Language */}
      <div className="flex items-center gap-1">
        <Languages className="h-3.5 w-3.5 text-muted-foreground" />
        {LANGS.map(l => (
          <button
            key={l.value}
            onClick={() => onLanguageChange(l.value)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              language === l.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Toggles */}
      <Button
        onClick={onToggleHeatmap}
        size="sm"
        variant={showHeatmap ? 'secondary' : 'ghost'}
        className="gap-1 text-xs"
      >
        <MapPin className="h-3 w-3" /> Heatmap
      </Button>
      <Button
        onClick={onToggleInstructions}
        size="sm"
        variant={showInstructions ? 'secondary' : 'ghost'}
        className="gap-1 text-xs"
      >
        {showInstructions ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} Labels
      </Button>

      {/* Surge Predictor */}
      <div className="w-px h-6 bg-border mx-1" />
      <div className="flex items-center gap-2 px-2 py-1 rounded border border-border/50 bg-muted/30">
        {techParkSurgeActive ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-600">Tech Park Surge Active</span>
          </>
        ) : surgeMode ? (
          <>
            <Clock className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
            <span className="text-xs font-semibold text-amber-600">
              Pre-Surge Mode: {Math.ceil(minutesUntilSurge)} min
            </span>
          </>
        ) : (
          <>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Next surge in {Math.ceil(minutesUntilSurge)} min
            </span>
          </>
        )}
      </div>
    </div>
  );
};

