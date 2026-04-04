import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, AlertTriangle, MapPin, Clock, Users, Wrench, Fuel, Zap, Car,
  Construction, CheckCircle2, Radio, Bell, RefreshCw, Eye, Truck, PhoneCall,
  Activity, TrendingUp, BarChart3, ChevronRight, Siren,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VehicleBreakdown, BreakdownSeverity, BreakdownStatus } from '@/types/simulation';

// Simulated real-time breakdown feed (standalone — doesn't need useSimulation)
const BREAKDOWN_TYPES: VehicleBreakdown['type'][] = ['engine', 'tire', 'accident', 'fuel', 'electrical'];
const LOCATIONS = [
  { name: 'Electronic City Flyover — Outbound', lat: 12.845, lng: 77.660, junction: 0 },
  { name: 'Silk Board Junction — Eastbound', lat: 12.917, lng: 77.622, junction: 1 },
  { name: 'Marathahalli Bridge — ORR', lat: 12.956, lng: 77.700, junction: 2 },
  { name: 'Hosur Road — Near Infosys Gate', lat: 12.853, lng: 77.656, junction: 0 },
  { name: 'Bommanahalli Signal — Southbound', lat: 12.901, lng: 77.618, junction: 1 },
  { name: 'Bellandur — Near KIAL Flyover', lat: 12.926, lng: 77.678, junction: 2 },
  { name: 'Sarjapur Road — Wipro Jn', lat: 12.910, lng: 77.685, junction: 1 },
  { name: 'KR Puram — Railway Overpass', lat: 12.997, lng: 77.695, junction: 2 },
];

const TYPE_META: Record<VehicleBreakdown['type'], { icon: typeof Car; label: string; color: string }> = {
  engine: { icon: Wrench, label: 'Engine Failure', color: 'text-orange-400' },
  tire: { icon: Car, label: 'Flat Tire', color: 'text-yellow-400' },
  accident: { icon: AlertTriangle, label: 'Collision', color: 'text-red-400' },
  fuel: { icon: Fuel, label: 'Out of Fuel', color: 'text-amber-400' },
  electrical: { icon: Zap, label: 'Electrical', color: 'text-blue-400' },
};

const SEVERITY_META: Record<BreakdownSeverity, { bg: string; text: string; border: string }> = {
  minor: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  major: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  critical: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
};

const STATUS_META: Record<BreakdownStatus, { bg: string; text: string; icon: typeof Clock }> = {
  detected: { bg: 'bg-red-500/20', text: 'text-red-400', icon: Radio },
  confirmed: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Eye },
  responding: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Truck },
  cleared: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle2 },
};

function randomId() { return Math.random().toString(36).slice(2, 8); }

interface AdminBreakdown extends VehicleBreakdown {
  locationName: string;
  vehiclePlate: string;
  driverContact: string;
  towAssigned: string;
  policeNotified: boolean;
}

function generateBreakdown(simTime: number): AdminBreakdown {
  const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const bType = BREAKDOWN_TYPES[Math.floor(Math.random() * BREAKDOWN_TYPES.length)];
  const severity: BreakdownSeverity = bType === 'accident' ? 'critical' : bType === 'engine' ? 'major' : 'minor';
  const plates = ['KA-01-AB-1234', 'KA-05-MH-9087', 'KA-03-CD-5612', 'KA-02-EF-3344', 'KA-04-GH-7890', 'KA-01-JK-2211'];
  const towCompanies = ['QuickTow Bengaluru', 'RoadAssist Karnataka', 'TowNow Express', 'Bengaluru Tow Services'];

  return {
    id: randomId(),
    vehicleId: randomId(),
    x: loc.lng * 10,
    y: loc.lat * 10,
    lane: Math.random() > 0.5 ? 'top' : 'bottom',
    road: 'main',
    junctionIndex: loc.junction,
    severity,
    status: 'detected',
    type: bType,
    detectedAt: simTime,
    reportedToAdmin: true,
    towTruckEta: 180 + Math.floor(Math.random() * 300),
    nearbyDriversNotified: 0,
    laneBlockage: severity === 'critical' ? 0.8 : severity === 'major' ? 0.5 : 0.3,
    description: `${TYPE_META[bType].label} detected at ${loc.name}`,
    locationName: loc.name,
    vehiclePlate: plates[Math.floor(Math.random() * plates.length)],
    driverContact: `+91 ${Math.floor(7000000000 + Math.random() * 3000000000)}`,
    towAssigned: towCompanies[Math.floor(Math.random() * towCompanies.length)],
    policeNotified: severity === 'critical',
  };
}

const TrafficAdminPage = () => {
  const [breakdowns, setBreakdowns] = useState<AdminBreakdown[]>([]);
  const [simTime, setSimTime] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | BreakdownStatus>('all');

  // Simulate real-time breakdown feed
  useEffect(() => {
    // Seed with 3 initial breakdowns
    const initial = [generateBreakdown(0), generateBreakdown(0), generateBreakdown(0)];
    initial[0].status = 'responding';
    initial[0].nearbyDriversNotified = 8;
    initial[0].detectedAt = -120;
    initial[1].status = 'confirmed';
    initial[1].nearbyDriversNotified = 4;
    initial[1].detectedAt = -60;
    setBreakdowns(initial);
  }, []);

  // Auto-progress breakdowns and add new ones periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSimTime(t => t + 1);
      setBreakdowns(prev => {
        let updated = prev.map(b => {
          const nb = { ...b };
          nb.towTruckEta = Math.max(0, nb.towTruckEta - 5);
          if (nb.status === 'detected') {
            nb.status = 'confirmed';
            nb.nearbyDriversNotified = 3;
          } else if (nb.status === 'confirmed' && nb.towTruckEta < 240) {
            nb.status = 'responding';
            nb.nearbyDriversNotified = Math.min(15, nb.nearbyDriversNotified + 2);
          } else if (nb.status === 'responding' && nb.towTruckEta <= 0) {
            nb.status = 'cleared';
            nb.nearbyDriversNotified = 15;
            nb.laneBlockage = 0;
          }
          return nb;
        });
        // Add new breakdown every ~15 seconds (if < 8 total active)
        if (updated.filter(b => b.status !== 'cleared').length < 5 && Math.random() < 0.15) {
          updated = [...updated, generateBreakdown(Date.now())];
        }
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearManual = useCallback((id: string) => {
    setBreakdowns(prev => prev.map(b =>
      b.id === id ? { ...b, status: 'cleared' as const, laneBlockage: 0, towTruckEta: 0 } : b
    ));
  }, []);

  const handleDispatchTow = useCallback((id: string) => {
    setBreakdowns(prev => prev.map(b =>
      b.id === id ? { ...b, status: 'responding' as const, towTruckEta: 120 } : b
    ));
  }, []);

  const filtered = filter === 'all' ? breakdowns : breakdowns.filter(b => b.status === filter);
  const activeCount = breakdowns.filter(b => b.status !== 'cleared').length;
  const criticalCount = breakdowns.filter(b => b.severity === 'critical' && b.status !== 'cleared').length;
  const avgResponse = breakdowns.length > 0
    ? Math.round(breakdowns.reduce((s, b) => s + (b.towTruckEta > 0 ? b.towTruckEta : 180), 0) / breakdowns.length / 60)
    : 0;
  const totalNotified = breakdowns.reduce((s, b) => s + b.nearbyDriversNotified, 0);
  const selected = selectedId ? breakdowns.find(b => b.id === selectedId) : null;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-950 via-slate-950 to-gray-950 text-white overflow-hidden">
      {/* Admin Top Bar */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur py-3 px-5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2 text-white/70 hover:text-white hover:bg-white/10">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-600/20 border border-red-600/30">
                <Shield className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <h1 className="font-bold text-sm">Traffic Control Center</h1>
                <p className="text-[10px] text-white/40 font-mono">BENGALURU TRAFFIC DEPT — ADMIN PANEL</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-[10px] text-green-400 font-mono">LIVE MONITORING</span>
            </span>
            <div className="text-[10px] text-white/40 font-mono">
              {new Date().toLocaleTimeString()} IST
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Stats + Breakdown List */}
        <div className="w-[420px] border-r border-white/10 flex flex-col overflow-hidden">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 p-3 border-b border-white/10">
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-center">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-red-400">{activeCount}</p>
              <p className="text-[8px] text-white/40">Active</p>
            </div>
            <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2 text-center">
              <Siren className="h-3.5 w-3.5 text-orange-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-orange-400">{criticalCount}</p>
              <p className="text-[8px] text-white/40">Critical</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 text-center">
              <Clock className="h-3.5 w-3.5 text-blue-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-blue-400">{avgResponse}m</p>
              <p className="text-[8px] text-white/40">Avg ETA</p>
            </div>
            <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2 text-center">
              <Users className="h-3.5 w-3.5 text-cyan-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-cyan-400">{totalNotified}</p>
              <p className="text-[8px] text-white/40">Alerted</p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 p-2 border-b border-white/10">
            {(['all', 'detected', 'confirmed', 'responding', 'cleared'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] px-2 py-1 rounded-md font-medium transition-all ${
                  filter === f
                    ? 'bg-white/15 text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                {f === 'all' ? `All (${breakdowns.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${breakdowns.filter(b => b.status === f).length})`}
              </button>
            ))}
          </div>

          {/* Breakdown list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filtered.map((b) => {
              const typeCfg = TYPE_META[b.type];
              const sevCfg = SEVERITY_META[b.severity];
              const statCfg = STATUS_META[b.status];
              const TypeIcon = typeCfg.icon;
              const StatusIcon = statCfg.icon;
              const isSelected = selectedId === b.id;

              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-all ${
                    isSelected
                      ? `${sevCfg.border} ${sevCfg.bg} ring-1 ring-white/20`
                      : b.status === 'cleared'
                        ? 'border-white/5 bg-white/[0.02] opacity-50'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <TypeIcon className={`h-4 w-4 ${typeCfg.color} shrink-0`} />
                    <span className={`text-xs font-bold ${typeCfg.color}`}>{typeCfg.label}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${sevCfg.bg} ${sevCfg.text}`}>
                      {b.severity.toUpperCase()}
                    </span>
                    <span className={`ml-auto inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${statCfg.bg} ${statCfg.text}`}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3 text-white/30 shrink-0" />
                    <span className="text-[10px] text-white/50 truncate">{b.locationName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] text-white/30">
                    <span>Plate: {b.vehiclePlate}</span>
                    <span>Block: {Math.round(b.laneBlockage * 100)}%</span>
                    {b.towTruckEta > 0 && <span>Tow ETA: {Math.ceil(b.towTruckEta / 60)}m</span>}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-white/20 text-sm">
                No breakdowns with status "{filter}"
              </div>
            )}
          </div>
        </div>

        {/* Center: Map-like view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map placeholder with breakdown markers */}
          <div className="flex-1 relative bg-slate-900/50 overflow-hidden">
            {/* Grid background */}
            <svg className="absolute inset-0 w-full h-full opacity-10">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Simulated road network */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
              {/* Main road */}
              <rect x="50" y="220" width="700" height="60" rx="4" fill="rgba(100,116,139,0.3)" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
              <line x1="50" y1="250" x2="750" y2="250" stroke="rgba(234,179,8,0.3)" strokeWidth="1" strokeDasharray="8 6" />

              {/* Vertical roads */}
              {[200, 400, 600].map((jx, i) => (
                <g key={i}>
                  <rect x={jx - 20} y="100" width="40" height="300" rx="3" fill="rgba(100,116,139,0.2)" />
                  <circle cx={jx} cy="250" r="12" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
                  <text x={jx} y="254" textAnchor="middle" fill="rgba(34,197,94,0.6)" fontSize="8" fontWeight="bold">J{i + 1}</text>
                </g>
              ))}

              {/* Location labels */}
              <text x="120" y="210" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">Electronic City</text>
              <text x="350" y="210" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">Silk Board</text>
              <text x="560" y="210" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">Marathahalli</text>

              {/* Breakdown markers */}
              {breakdowns.filter(b => b.status !== 'cleared').map((b, i) => {
                const x = 100 + (b.junctionIndex * 250) + (i * 40) % 150;
                const y = b.lane === 'top' ? 235 : 265;
                const isActive = selectedId === b.id;
                const color = b.severity === 'critical' ? '#ef4444' : b.severity === 'major' ? '#f97316' : '#eab308';
                return (
                  <g key={b.id} onClick={() => setSelectedId(b.id)} style={{ cursor: 'pointer' }}>
                    {isActive && (
                      <circle cx={x} cy={y} r="20" fill="none" stroke={color} strokeWidth="1" opacity="0.4">
                        <animate attributeName="r" values="15;25;15" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle cx={x} cy={y} r="8" fill={color} opacity="0.8">
                      <animate attributeName="opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={x} cy={y} r="4" fill="white" opacity="0.9" />
                    <text x={x} y={y - 14} textAnchor="middle" fill={color} fontSize="7" fontWeight="bold" fontFamily="monospace">
                      {b.severity === 'critical' ? '⚠ CRITICAL' : b.type.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Map title overlay */}
            <div className="absolute top-3 left-3 rounded-lg bg-black/60 backdrop-blur border border-white/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-white/80">Bengaluru Corridor — Live Map</span>
              </div>
              <p className="text-[9px] text-white/30 mt-0.5">Electronic City ↔ Marathahalli (12.5 km)</p>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 backdrop-blur border border-white/10 px-3 py-2 flex gap-3">
              {(['minor', 'major', 'critical'] as const).map(s => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${s === 'critical' ? 'bg-red-500' : s === 'major' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                  <span className="text-[9px] text-white/40 capitalize">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Activity log */}
          <div className="h-36 border-t border-white/10 bg-black/30 overflow-y-auto p-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-3.5 w-3.5 text-white/40" />
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Activity Log</span>
            </div>
            <div className="space-y-1">
              {breakdowns.slice().reverse().slice(0, 10).map((b) => {
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <div key={b.id + b.status} className="flex items-center gap-2 text-[10px]">
                    <span className="text-white/20 font-mono w-16 shrink-0">{time}</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      b.status === 'cleared' ? 'bg-green-500' : b.status === 'responding' ? 'bg-blue-500' : b.status === 'confirmed' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <span className="text-white/50">
                      {b.status === 'detected' && `🔴 New breakdown: ${TYPE_META[b.type].label} at ${b.locationName}`}
                      {b.status === 'confirmed' && `🟡 Confirmed: ${b.vehiclePlate} — ${b.description}`}
                      {b.status === 'responding' && `🔵 Tow dispatched: ${b.towAssigned} → ${b.locationName}`}
                      {b.status === 'cleared' && `🟢 Cleared: ${b.locationName} — lane restored`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="w-[320px] border-l border-white/10 flex flex-col overflow-hidden">
          {selected ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = TYPE_META[selected.type].icon;
                  return <Icon className={`h-5 w-5 ${TYPE_META[selected.type].color}`} />;
                })()}
                <div>
                  <h3 className="text-sm font-bold text-white">{TYPE_META[selected.type].label}</h3>
                  <p className="text-[10px] text-white/40">Incident #{selected.id.toUpperCase()}</p>
                </div>
                <span className={`ml-auto text-[10px] font-bold px-2 py-1 rounded-full ${SEVERITY_META[selected.severity].bg} ${SEVERITY_META[selected.severity].text}`}>
                  {selected.severity.toUpperCase()}
                </span>
              </div>

              {/* Status timeline */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Status Progress</p>
                {(['detected', 'confirmed', 'responding', 'cleared'] as const).map((s, i) => {
                  const isReached = ['detected', 'confirmed', 'responding', 'cleared'].indexOf(selected.status) >= i;
                  const isCurrent = selected.status === s;
                  const cfg = STATUS_META[s];
                  const Icon = cfg.icon;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isReached ? cfg.bg : 'bg-white/5'
                      } ${isCurrent ? 'ring-2 ring-white/20' : ''}`}>
                        <Icon className={`h-3 w-3 ${isReached ? cfg.text : 'text-white/20'}`} />
                      </div>
                      <span className={`text-xs ${isReached ? 'text-white/80' : 'text-white/20'}`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </span>
                      {isCurrent && (
                        <span className="ml-auto flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-white opacity-50" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Details */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Incident Details</p>
                <div className="grid gap-2">
                  {[
                    { label: 'Location', value: selected.locationName, icon: MapPin },
                    { label: 'Vehicle', value: selected.vehiclePlate, icon: Car },
                    { label: 'Driver Contact', value: selected.driverContact, icon: PhoneCall },
                    { label: 'Tow Service', value: selected.towAssigned, icon: Truck },
                    { label: 'Tow ETA', value: selected.towTruckEta > 0 ? `${Math.ceil(selected.towTruckEta / 60)} min` : 'Arrived', icon: Clock },
                    { label: 'Lane Blockage', value: `${Math.round(selected.laneBlockage * 100)}%`, icon: Construction },
                    { label: 'Drivers Notified', value: `${selected.nearbyDriversNotified}`, icon: Users },
                    { label: 'Police Notified', value: selected.policeNotified ? 'Yes ✓' : 'No', icon: Shield },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-2 rounded-md bg-white/[0.03] p-2">
                      <Icon className="h-3 w-3 text-white/30 shrink-0" />
                      <span className="text-[10px] text-white/40 w-20 shrink-0">{label}</span>
                      <span className="text-[10px] text-white/80 font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lane blockage bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/40">Lane Blockage</span>
                  <span className="text-[10px] text-white/40">{Math.round(selected.laneBlockage * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selected.laneBlockage > 0.6 ? 'bg-red-500' : selected.laneBlockage > 0.3 ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${selected.laneBlockage * 100}%` }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              {selected.status !== 'cleared' && (
                <div className="space-y-2 pt-2">
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Actions</p>
                  {selected.status !== 'responding' && (
                    <Button
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs gap-2"
                      onClick={() => handleDispatchTow(selected.id)}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      Dispatch Tow Truck
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs gap-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                    onClick={() => handleClearManual(selected.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark as Cleared
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => {}}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Re-Broadcast Alert
                  </Button>
                </div>
              )}

              {/* Nearby driver notification mockup */}
              <div className="rounded-lg bg-amber-950/40 border border-amber-500/20 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Radio className="h-3 w-3 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400">BROADCAST TO NEARBY DRIVERS</span>
                </div>
                <div className="rounded-md bg-black/40 border border-white/10 p-2.5 mt-1">
                  <p className="text-[10px] text-white/70">
                    ⚠️ <strong>Vehicle breakdown ahead</strong> — {selected.locationName}.
                    {selected.lane === 'top' ? ' Outbound' : ' Inbound'} lane {Math.round(selected.laneBlockage * 100)}% blocked.
                    Use alternate lane. Tow arriving in {Math.ceil(selected.towTruckEta / 60)} min.
                  </p>
                </div>
                <p className="text-[8px] text-white/30 mt-1.5">
                  Sent to {selected.nearbyDriversNotified} drivers via Google Maps + VANET
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20 p-6">
              <Eye className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">Select an incident</p>
              <p className="text-[10px] mt-1">Click a breakdown from the list to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrafficAdminPage;
