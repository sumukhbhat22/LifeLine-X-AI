import { useEffect, useState } from 'react';
import { AlertTriangle, Wrench, Fuel, Zap, Car, Construction, MapPin, Users, Clock, CheckCircle2, Radio } from 'lucide-react';
import type { VehicleBreakdown } from '@/types/simulation';

interface BreakdownAlertsProps {
  breakdowns: VehicleBreakdown[];
  totalDetected: number;
}

const TYPE_CONFIG: Record<VehicleBreakdown['type'], { icon: typeof Car; label: string; color: string }> = {
  engine: { icon: Wrench, label: 'Engine Failure', color: 'text-orange-400' },
  tire: { icon: Car, label: 'Flat Tire', color: 'text-yellow-400' },
  accident: { icon: AlertTriangle, label: 'Collision', color: 'text-red-400' },
  fuel: { icon: Fuel, label: 'Out of Fuel', color: 'text-amber-400' },
  electrical: { icon: Zap, label: 'Electrical', color: 'text-blue-400' },
};

const SEVERITY_BADGE: Record<VehicleBreakdown['severity'], { bg: string; text: string; label: string }> = {
  minor: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Minor' },
  major: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Major' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Critical' },
};

const STATUS_BADGE: Record<VehicleBreakdown['status'], { bg: string; text: string; label: string; icon: typeof Clock }> = {
  detected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Detected', icon: Radio },
  confirmed: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Confirmed', icon: AlertTriangle },
  responding: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Responding', icon: Construction },
  cleared: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Cleared', icon: CheckCircle2 },
};

export function BreakdownAlerts({ breakdowns, totalDetected }: BreakdownAlertsProps) {
  const [flash, setFlash] = useState(false);

  // Flash on new breakdown
  useEffect(() => {
    if (breakdowns.length > 0) {
      const latest = breakdowns[breakdowns.length - 1];
      if (latest.status === 'detected') {
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 800);
        return () => clearTimeout(t);
      }
    }
  }, [breakdowns.length]);

  if (breakdowns.length === 0 && totalDetected === 0) return null;

  const activeBreakdowns = breakdowns.filter(b => b.status !== 'cleared');
  const clearedCount = breakdowns.filter(b => b.status === 'cleared').length;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Header */}
      <div className={`rounded-xl border transition-all duration-300 overflow-hidden ${
        flash ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-border/50'
      } bg-card/50 backdrop-blur p-3`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-orange-500/15">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Breakdown Detection</h3>
          {activeBreakdowns.length > 0 && (
            <span className="ml-auto flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[10px] text-red-400 font-medium">{activeBreakdowns.length} ACTIVE</span>
            </span>
          )}
        </div>

        {/* Stats mini row */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="rounded-md bg-red-500/10 border border-red-500/20 p-1.5 text-center">
            <p className="text-sm font-bold text-red-400">{totalDetected}</p>
            <p className="text-[8px] text-muted-foreground">Detected</p>
          </div>
          <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-1.5 text-center">
            <p className="text-sm font-bold text-blue-400">{activeBreakdowns.length}</p>
            <p className="text-[8px] text-muted-foreground">Active</p>
          </div>
          <div className="rounded-md bg-green-500/10 border border-green-500/20 p-1.5 text-center">
            <p className="text-sm font-bold text-green-400">{clearedCount}</p>
            <p className="text-[8px] text-muted-foreground">Cleared</p>
          </div>
        </div>

        {/* Breakdown cards */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {breakdowns.map((b) => {
            const typeCfg = TYPE_CONFIG[b.type];
            const sevCfg = SEVERITY_BADGE[b.severity];
            const statCfg = STATUS_BADGE[b.status];
            const TypeIcon = typeCfg.icon;
            const StatusIcon = statCfg.icon;

            return (
              <div key={b.id} className={`rounded-lg border p-2.5 transition-all ${
                b.status === 'cleared'
                  ? 'border-green-500/20 bg-green-500/5 opacity-60'
                  : b.severity === 'critical'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-border/40 bg-muted/30'
              }`}>
                {/* Top row: type + severity */}
                <div className="flex items-center gap-2 mb-1.5">
                  <TypeIcon className={`h-3.5 w-3.5 ${typeCfg.color} shrink-0`} />
                  <span className={`text-xs font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>
                  <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sevCfg.bg} ${sevCfg.text}`}>
                    {sevCfg.label.toUpperCase()}
                  </span>
                </div>

                {/* Description */}
                <p className="text-[10px] text-muted-foreground mb-1.5">{b.description}</p>

                {/* Status + Location + Tow ETA */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${statCfg.bg} ${statCfg.text}`}>
                    <StatusIcon className="h-2.5 w-2.5" />
                    {statCfg.label}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" />
                    {b.lane === 'top' ? 'Outbound' : 'Inbound'} Lane
                  </span>
                  {b.status !== 'cleared' && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      Tow: {Math.ceil(b.towTruckEta / 60)}m
                    </span>
                  )}
                </div>

                {/* Drivers notified */}
                {b.nearbyDriversNotified > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border/20">
                    <Users className="h-2.5 w-2.5 text-cyan-400" />
                    <span className="text-[9px] text-cyan-400 font-medium">
                      {b.nearbyDriversNotified} nearby drivers alerted
                    </span>
                  </div>
                )}

                {/* Lane blockage bar */}
                <div className="mt-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[8px] text-muted-foreground">Lane Blockage</span>
                    <span className="text-[8px] text-muted-foreground">{Math.round(b.laneBlockage * 100)}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        b.laneBlockage > 0.6 ? 'bg-red-500' : b.laneBlockage > 0.3 ? 'bg-orange-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${b.laneBlockage * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nearby driver alert mockup */}
        {activeBreakdowns.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-950/50 border border-amber-500/30 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Radio className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-400">DRIVER ALERT BROADCAST</span>
            </div>
            <p className="text-[10px] text-amber-200/80">
              ⚠️ Vehicle breakdown ahead — {activeBreakdowns[0].lane === 'top' ? 'Outbound' : 'Inbound'} lane partially blocked.
              Reduce speed & use alternate lane.
            </p>
          </div>
        )}

        <p className="text-[8px] text-muted-foreground/50 italic text-center pt-2 mt-2 border-t border-border/20">
          AI-detection via YOLO + CCTV feed analysis
        </p>
      </div>
    </div>
  );
}
