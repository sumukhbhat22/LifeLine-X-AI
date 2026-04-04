import React from 'react';
import { Ambulance, Activity, Timer, Shield, AlertTriangle, Leaf } from 'lucide-react';
import type { Phase, Ambulance as AmbulanceType } from '@/types/simulation';

interface Props {
  phase: Phase;
  ambulances: AmbulanceType[];
  vehiclesCleared: number;
  junctionsPrepared: number;
  co2Saved: number;
  timeSavedSeconds: number;
  techParkSurgeActive?: boolean;
}

export const HeaderBar: React.FC<Props> = ({ phase, ambulances, vehiclesCleared, junctionsPrepared, co2Saved, timeSavedSeconds, techParkSurgeActive = false }) => {
  const isActive = phase !== 'idle' && phase !== 'done';
  const isAmbulanceDetected = phase === 'detection' || phase === 'clearing' || phase === 'passage';
  const activeAmbulances = ambulances.filter(a => a.active);
  const primaryEta = activeAmbulances[0]?.eta ?? 0;

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-destructive/15">
          <Ambulance className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Signal Sense <span className="text-primary">AI</span>
          </h1>
          <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
            AI SELF-CLEARING SMART CORRIDOR
          </p>
        </div>
      </div>

      {/* Live Stats */}
      <div className="flex items-center gap-5">
        {/* Multi-Ambulance ETA */}
        <div className="flex items-center gap-3">
          {activeAmbulances.map((amb, idx) => (
            <div key={amb.id} className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <div className="text-right">
                <div className={`text-lg font-mono font-bold tabular-nums ${
                  isActive && amb.eta < 10 ? 'text-destructive' : amb.eta < 20 ? 'text-heatmap-yellow' : 'text-primary'
                }`}>
                  {isActive ? `${Math.ceil(amb.eta)}s` : '--'}
                </div>
                <div className="text-[9px] text-muted-foreground font-mono">
                  {amb.priority === 'critical' ? '🚑 CRITICAL' : '🚔 AMB'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CO2 Saved (NEW) */}
        {co2Saved > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded border border-green-200 bg-green-50/50">
            <Leaf className="h-4 w-4 text-green-600" />
            <div className="text-right">
              <div className="text-sm font-bold text-green-600">{co2Saved.toFixed(2)} kg CO2</div>
              <div className="text-[9px] text-green-500 font-mono">SAVED</div>
            </div>
          </div>
        )}

        {/* Surge Warning */}
        {isAmbulanceDetected && techParkSurgeActive && (
          <div className="flex items-center gap-2 px-3 py-1 rounded border border-red-200 bg-red-50/50">
            <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
            <div className="text-right">
              <div className="text-sm font-bold text-red-600">WORST-CASE SCENARIO</div>
              <div className="text-[9px] text-red-500 font-mono">Surge + Ambulance</div>
            </div>
          </div>
        )}

        {/* Vehicles Cleared */}
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-heatmap-green tabular-nums">
              {vehiclesCleared}
            </div>
            <div className="text-[9px] text-muted-foreground font-mono">CLEARED</div>
          </div>
        </div>

        {/* Junctions */}
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-primary tabular-nums">
              {junctionsPrepared}/3
            </div>
            <div className="text-[9px] text-muted-foreground font-mono">JUNCTIONS</div>
          </div>
        </div>
      </div>

      {/* Tagline */}
      <p className="text-xs text-muted-foreground italic hidden lg:block">
        "In emergencies, every second matters."
      </p>
    </header>
  );
};
