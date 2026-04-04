import React from 'react';
import { AlertTriangle, ShieldCheck, TrendingDown, Zap, Timer, ArrowUp, Gauge, LinkIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { SpilloverEvent, SpilloverRisk } from '@/types/simulation';

interface Props {
  spilloverEvents: SpilloverEvent[];
  totalDetected: number;
  totalPrevented: number;
}

const riskColor: Record<SpilloverRisk, string> = {
  none: 'text-green-400',
  low: 'text-blue-400',
  moderate: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

const riskBg: Record<SpilloverRisk, string> = {
  none: 'bg-green-500/10 border-green-500/30',
  low: 'bg-blue-500/10 border-blue-500/30',
  moderate: 'bg-yellow-500/10 border-yellow-500/30',
  high: 'bg-orange-500/10 border-orange-500/30',
  critical: 'bg-red-500/10 border-red-500/30',
};

const riskLabel: Record<SpilloverRisk, string> = {
  none: 'CLEAR',
  low: 'LOW',
  moderate: 'MODERATE',
  high: 'HIGH',
  critical: 'CRITICAL',
};

const actionLabel: Record<string, string> = {
  none: '—',
  extending_green: '🟢 Extended green',
  stopping_cross: '🔴 Stopped cross traffic',
  clearing_junction: '⚠ Clearing junction',
};

export const SpilloverPanel: React.FC<Props> = ({
  spilloverEvents,
  totalDetected,
  totalPrevented,
}) => {
  const activeEvents = spilloverEvents.filter(e => !e.resolvedAt);
  const recentEvents = [...spilloverEvents].reverse().slice(0, 6);

  // Current worst risk
  const worstRisk: SpilloverRisk = activeEvents.length > 0
    ? activeEvents.reduce((worst, e) => {
        const ranks: SpilloverRisk[] = ['none', 'low', 'moderate', 'high', 'critical'];
        return ranks.indexOf(e.risk) > ranks.indexOf(worst) ? e.risk : worst;
      }, 'none' as SpilloverRisk)
    : 'none';

  return (
    <Card className="p-3 bg-card/50 backdrop-blur border-border/50">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h3 className="font-bold text-sm">Spillover Detection</h3>
      </div>

      {/* Current Status Banner */}
      <div className={`rounded-lg border p-2.5 mb-3 ${riskBg[worstRisk]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {worstRisk === 'none' ? (
              <ShieldCheck className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className={`h-4 w-4 ${riskColor[worstRisk]} ${worstRisk === 'critical' ? 'animate-pulse' : ''}`} />
            )}
            <div>
              <div className="text-[10px] text-muted-foreground">Spillover Risk</div>
              <div className={`text-sm font-bold ${riskColor[worstRisk]}`}>
                {riskLabel[worstRisk]}
              </div>
            </div>
          </div>
          {activeEvents.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Active</div>
              <div className="text-sm font-bold text-foreground">{activeEvents.length}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <div className="text-center p-1.5 rounded bg-muted/30 border border-border/50">
          <div className="text-[10px] text-muted-foreground">Detected</div>
          <div className="text-sm font-bold text-foreground">{totalDetected}</div>
        </div>
        <div className="text-center p-1.5 rounded bg-green-500/10 border border-green-500/20">
          <div className="text-[10px] text-muted-foreground">Prevented</div>
          <div className="text-sm font-bold text-green-600">{totalPrevented}</div>
        </div>
        <div className="text-center p-1.5 rounded bg-muted/30 border border-border/50">
          <div className="text-[10px] text-muted-foreground">Active</div>
          <div className="text-sm font-bold text-foreground">{activeEvents.length}</div>
        </div>
      </div>

      {/* Active Actions — Enhanced with speed/density/cascade */}
      {activeEvents.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Actions</div>
          {activeEvents.map(evt => (
            <div key={evt.id} className={`rounded-lg border p-2 ${riskBg[evt.risk]}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-bold ${riskColor[evt.risk]}`}>
                  J{evt.junctionIndex + 1} — {evt.lane.toUpperCase()} LANE
                </span>
                <div className="flex items-center gap-1">
                  {evt.cascadeRisk && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <LinkIcon className="h-2 w-2 inline mr-0.5" />CASCADE
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${riskBg[evt.risk]} ${riskColor[evt.risk]}`}>
                    {riskLabel[evt.risk]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <ArrowUp className="h-2.5 w-2.5" />
                Queue: {evt.queueLength} vehicles ({Math.round(evt.queueReachPct)}% reach)
              </div>
              {/* Speed & density indicators */}
              <div className="flex items-center gap-3 text-[9px] mb-1">
                <span className={`flex items-center gap-0.5 ${evt.avgSpeed < 8 ? 'text-red-400' : evt.avgSpeed < 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                  <Gauge className="h-2.5 w-2.5" />
                  {evt.avgSpeed < 999 ? `${Math.round(evt.avgSpeed)} px/s` : '—'}
                </span>
                <span className={`flex items-center gap-0.5 ${evt.queueDensity > 2.5 ? 'text-red-400' : evt.queueDensity > 1.5 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                  Density: {evt.queueDensity.toFixed(1)}/100px
                </span>
                {evt.growthRate > 0.2 && (
                  <span className="text-orange-400 flex items-center gap-0.5">
                    <TrendingDown className="h-2.5 w-2.5 rotate-180" />
                    +{evt.growthRate.toFixed(1)}/s
                  </span>
                )}
              </div>
              {evt.vehiclesInJunction > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {evt.vehiclesInJunction} in junction{evt.stoppedInJunction ? ' (BLOCKED!)' : ''}
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] mt-1">
                <div className="flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5 text-cyan-500" />
                  <span className="text-cyan-600 font-semibold">{actionLabel[evt.action]}</span>
                  {evt.greenExtension > 0 && (
                    <span className="text-green-600 font-bold ml-1">+{evt.greenExtension}s</span>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {evt.dwellFrames > 0 && `${evt.dwellFrames}f`}
                  {evt.peakRisk !== evt.risk && evt.peakRisk !== 'none' && ` peak:${riskLabel[evt.peakRisk]}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Events Log */}
      {recentEvents.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Event Log</div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {recentEvents.map(evt => (
              <div key={evt.id} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-muted/20 border border-border/30">
                {evt.resolvedAt ? (
                  <ShieldCheck className="h-3 w-3 text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle className={`h-3 w-3 shrink-0 ${riskColor[evt.risk]}`} />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">J{evt.junctionIndex + 1}</span>
                  <span className="text-muted-foreground"> {evt.lane} </span>
                  <span className={riskColor[evt.risk]}>{riskLabel[evt.risk]}</span>
                </div>
                <div className="text-muted-foreground shrink-0">
                  {evt.resolvedAt ? (
                    <span className="text-green-500">✓ Prevented</span>
                  ) : (
                    <span className={riskColor[evt.risk]}>Active</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {spilloverEvents.length === 0 && (
        <div className="text-center py-3 text-[10px] text-muted-foreground">
          <ShieldCheck className="h-5 w-5 mx-auto mb-1 text-green-500 opacity-50" />
          Monitoring junction queues...
          <br />
          Spillover events will appear here
        </div>
      )}

      {/* Feature explanation */}
      <div className="mt-3 pt-2 border-t border-border/50">
        <div className="text-[9px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground/70">Enhanced detection:</strong> Speed-weighted scoring, queue density analysis, temporal smoothing with hysteresis, cascade junction awareness, and condition-based resolution.
        </div>
      </div>
    </Card>
  );
};
