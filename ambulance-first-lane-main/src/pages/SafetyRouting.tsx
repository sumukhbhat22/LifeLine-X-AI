import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MapContainer, TileLayer, Polyline, Circle, Marker, Tooltip, Popup, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  ArrowLeft, Play, Pause, RotateCcw, Eye, EyeOff,
  ShieldCheck, ShieldAlert, Navigation, BarChart3,
  Car, Timer, Route, Info, Zap, MapPin, AlertTriangle,
  Crosshair, Globe, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';

import { useSafetyRouting, SOURCE, DESTINATION, MAP_CENTER } from '@/hooks/useSafetyRouting';
import type { SafetyState, RouteInfo, UnsafeZone } from '@/hooks/useSafetyRouting';

/* ═══════════════════════════════════════════════════════
   Leaflet Dark-Theme CSS overrides (injected once)
   ═══════════════════════════════════════════════════════ */

const LEAFLET_CSS_ID = 'safety-routing-leaflet-overrides';
function useLeafletDarkCSS() {
  useEffect(() => {
    if (document.getElementById(LEAFLET_CSS_ID)) return;
    const s = document.createElement('style');
    s.id = LEAFLET_CSS_ID;
    s.textContent = `
      .leaflet-container { background: #0e1117 !important; font-family: ui-monospace, "SF Mono", monospace !important; }
      .leaflet-tile-pane { filter: brightness(0.92) contrast(1.05); }
      .leaflet-tooltip {
        background: rgba(12,15,22,0.94) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        color: #e2e8f0 !important;
        font-size: 11px !important;
        padding: 5px 10px !important;
        border-radius: 6px !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
      }
      .leaflet-tooltip-top::before { border-top-color: rgba(12,15,22,0.94) !important; }
      .leaflet-tooltip-bottom::before { border-bottom-color: rgba(12,15,22,0.94) !important; }
      .leaflet-tooltip-left::before { border-left-color: rgba(12,15,22,0.94) !important; }
      .leaflet-tooltip-right::before { border-right-color: rgba(12,15,22,0.94) !important; }
      .leaflet-popup-content-wrapper {
        background: rgba(12,15,22,0.96) !important;
        color: #e2e8f0 !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 10px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
      }
      .leaflet-popup-tip { background: rgba(12,15,22,0.96) !important; }
      .leaflet-popup-close-button { color: rgba(255,255,255,0.4) !important; }
      .leaflet-control-attribution {
        background: rgba(12,15,22,0.7) !important;
        color: rgba(255,255,255,0.25) !important;
        font-size: 9px !important;
      }
      .leaflet-control-attribution a { color: rgba(255,255,255,0.35) !important; }
      .leaflet-control-zoom a {
        background: rgba(15,18,25,0.9) !important;
        color: rgba(255,255,255,0.6) !important;
        border-color: rgba(255,255,255,0.08) !important;
      }
      @keyframes pulse-ring { 0% { transform: scale(0.9); opacity: 0.7; } 50% { transform: scale(1.15); opacity: 0.3; } 100% { transform: scale(0.9); opacity: 0.7; } }
      .vehicle-marker { animation: pulse-ring 1.5s ease-in-out infinite; }
    `;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);
}

/* ═══════════════════════════════════════════════════════
   Leaflet DivIcon factories
   ═══════════════════════════════════════════════════════ */

const SRC_ICON = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:white;">S</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const DST_ICON = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(245,158,11,0.5);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:white;">D</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const VEH_ICON = L.divIcon({
  className: 'vehicle-marker',
  html: `<div style="width:22px;height:22px;background:linear-gradient(135deg,#06b6d4,#0891b2);border-radius:50%;border:3px solid white;box-shadow:0 0 14px rgba(6,182,212,0.6);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/* ═══════════════════════════════════════════════════════
   FitBounds — auto-zoom map to show all routes
   ═══════════════════════════════════════════════════════ */

function FitBounds({ routes }: { routes: RouteInfo[] }) {
  const map = useMap();
  useEffect(() => {
    if (!routes.length) return;
    const pts = routes.flatMap(r => r.coordinates.map(c => [c.lat, c.lng] as [number, number]));
    pts.push([SOURCE.lat, SOURCE.lng], [DESTINATION.lat, DESTINATION.lng]);
    if (pts.length > 2) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  }, [routes, map]);
  return null;
}

/* ═══════════════════════════════════════════════════════
   Zone type metadata
   ═══════════════════════════════════════════════════════ */

const ZONE_META: Record<string, { icon: string; color: string }> = {
  low_lighting:   { icon: '🌑', color: '#fbbf24' },
  low_traffic:    { icon: '🚫', color: '#a78bfa' },
  incident_prone: { icon: '⚠️', color: '#ef4444' },
};

/* ═══════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════ */

const SafetyRoutingPage = () => {
  useLeafletDarkCSS();
  const { state, fetchRoutes, startSim, stopSim, resetSim, toggleUnsafeZones, selectRoute, toggleRoutingMode } = useSafetyRouting();

  // Auto-fetch routes on mount
  const hasFetched = useRef(false);
  useEffect(() => {
    if (!hasFetched.current) { hasFetched.current = true; fetchRoutes(); }
  }, [fetchRoutes]);

  const selectedRoute = state.routes.find(r => r.id === state.selectedRouteId);
  const pct = Math.round(state.vehicleProgress * 100);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white">
      {/* ═══ Header ═══ */}
      <header className="border-b border-white/[0.06] bg-[#0f1219]/95 backdrop-blur-md sticky top-0 z-[1000]">
        <div className="max-w-[1440px] mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
              <ArrowLeft className="h-4 w-4 text-white/50" />
            </Link>
            <div className="h-7 w-px bg-white/[0.06]" />
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-[13px] font-semibold tracking-tight">Safety-Aware Routing</h1>
                <p className="text-[10px] text-white/30 font-mono tracking-wider">REAL-TIME MAP SIMULATION</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* API Status badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono ${
              state.apiStatus === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
              state.apiStatus === 'fallback' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
              state.apiStatus === 'loading' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
              'bg-white/5 border-white/10 text-white/30'
            }`}>
              {state.apiStatus === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
              {state.apiStatus === 'success' && <Globe className="h-3 w-3" />}
              {state.apiStatus === 'fallback' && <AlertTriangle className="h-3 w-3" />}
              {state.apiStatus === 'success' ? `OSRM API ${state.apiTime}ms` :
               state.apiStatus === 'fallback' ? 'Cached Routes' :
               state.apiStatus === 'loading' ? 'Fetching...' : 'Idle'}
            </div>
            {state.simulating && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[10px] font-mono text-cyan-400">LIVE</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ═══ Warning overlay ═══ */}
      {state.currentWarning && (
        <div className={`border-b ${
          state.currentWarning.startsWith('✅') ? 'bg-green-500/10 border-green-500/20' :
          'bg-red-500/10 border-red-500/20'
        }`}>
          <div className="max-w-[1440px] mx-auto px-5 py-2.5 flex items-center gap-2">
            {state.currentWarning.startsWith('✅')
              ? <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
              : <ShieldAlert className="h-4 w-4 text-red-400 flex-shrink-0 animate-pulse" />
            }
            <span className={`text-xs font-semibold ${state.currentWarning.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
              {state.currentWarning}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-5 py-5 flex flex-col lg:flex-row gap-5">
        {/* ══════ LEFT — Map + Controls ══════ */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Map */}
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-[#0e1117] shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/[0.03]">
            <div className="h-[420px] sm:h-[480px] lg:h-[540px]">
              <MapContainer
                center={[MAP_CENTER.lat, MAP_CENTER.lng]}
                zoom={12}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                {/* CartoDB Dark Matter tiles */}
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                <FitBounds routes={state.routes} />

                {/* Unsafe Zones */}
                {state.showUnsafeZones && state.unsafeZones.map(z => {
                  const meta = ZONE_META[z.type];
                  return (
                    <Circle
                      key={z.id}
                      center={[z.center.lat, z.center.lng]}
                      radius={z.radius}
                      pathOptions={{
                        color: '#ef4444',
                        fillColor: '#ef4444',
                        fillOpacity: 0.12,
                        weight: 2,
                        dashArray: '8,5',
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -10]} permanent>
                        <span style={{ color: meta.color, fontWeight: 600 }}>
                          {meta.icon} {z.label}
                        </span>
                      </Tooltip>
                      <Popup>
                        <div style={{ maxWidth: 220 }}>
                          <p style={{ fontWeight: 700, marginBottom: 4, color: '#ef4444' }}>{meta.icon} {z.label}</p>
                          <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>{z.description}</p>
                          <p style={{ fontSize: 10, marginTop: 6, opacity: 0.5 }}>Severity: {z.severity}/10 • Type: {z.type.replace(/_/g, ' ')}</p>
                        </div>
                      </Popup>
                    </Circle>
                  );
                })}

                {/* Route Polylines */}
                {state.routes.map(r => (
                  <Polyline
                    key={r.id}
                    positions={r.coordinates.map(c => [c.lat, c.lng] as [number, number])}
                    pathOptions={{
                      color: r.color,
                      weight: r.id === state.selectedRouteId ? 5 : 3,
                      opacity: r.id === state.selectedRouteId ? 0.85 : 0.3,
                      dashArray: r.id === state.selectedRouteId ? undefined : '8,6',
                    }}
                  >
                    <Tooltip sticky>
                      <span style={{ fontWeight: 600 }}>{r.name}: {r.label}</span>
                      <br />
                      <span style={{ fontSize: 10, opacity: 0.7 }}>
                        {r.distance} km • {r.duration} min • Safety: {r.safetyScore}/100
                      </span>
                    </Tooltip>
                  </Polyline>
                ))}

                {/* Source */}
                <Marker position={[SOURCE.lat, SOURCE.lng]} icon={SRC_ICON}>
                  <Tooltip direction="bottom" offset={[0, 10]}>
                    <span style={{ fontWeight: 600 }}>📍 Source: Koramangala</span>
                  </Tooltip>
                </Marker>

                {/* Destination */}
                <Marker position={[DESTINATION.lat, DESTINATION.lng]} icon={DST_ICON}>
                  <Tooltip direction="bottom" offset={[0, 10]}>
                    <span style={{ fontWeight: 600 }}>🏁 Destination: Yeshwantpur</span>
                  </Tooltip>
                </Marker>

                {/* Vehicle */}
                {state.vehiclePos && (
                  <Marker position={[state.vehiclePos.lat, state.vehiclePos.lng]} icon={VEH_ICON}>
                    <Tooltip direction="top" offset={[0, -14]} permanent>
                      <span style={{ fontWeight: 600, color: '#06b6d4' }}>🚗 {pct}%</span>
                    </Tooltip>
                  </Marker>
                )}
              </MapContainer>
            </div>
          </div>

          {/* Progress bar */}
          {state.vehiclePos && (
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-150 ease-linear"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
                }}
              />
            </div>
          )}

          {/* Controls */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Play / Pause */}
              {!state.simulating ? (
                <button onClick={startSim} disabled={!state.routes.length}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-sm font-semibold shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-30">
                  <Play className="h-4 w-4" /> {state.arrived ? 'Replay' : 'Start Simulation'}
                </button>
              ) : (
                <button onClick={stopSim}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-sm font-semibold shadow-lg shadow-amber-500/20 transition-all active:scale-95">
                  <Pause className="h-4 w-4" /> Pause
                </button>
              )}

              <button onClick={resetSim}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm transition active:scale-95">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>

              <div className="w-px h-7 bg-white/[0.06]" />

              {/* Unsafe zones toggle */}
              <button onClick={toggleUnsafeZones}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all active:scale-95 ${
                  state.showUnsafeZones
                    ? 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20'
                    : 'bg-white/[0.04] border-white/[0.06] text-white/50 hover:bg-white/[0.08]'
                }`}>
                {state.showUnsafeZones ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                Unsafe Zones {state.showUnsafeZones ? 'ON' : 'OFF'}
              </button>

              <div className="w-px h-7 bg-white/[0.06]" />

              {/* Routing mode toggle */}
              <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.05]">
                <button onClick={() => { if (state.useSafestRoute) toggleRoutingMode(); }}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    !state.useSafestRoute ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-white/30 hover:text-white/50'
                  }`}>
                  Shortest Path
                </button>
                <button onClick={() => { if (!state.useSafestRoute) toggleRoutingMode(); }}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    state.useSafestRoute ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-white/30 hover:text-white/50'
                  }`}>
                  Safest Path ✓
                </button>
              </div>

              <div className="w-px h-7 bg-white/[0.06]" />

              {/* Refresh routes */}
              <button onClick={fetchRoutes} disabled={state.apiStatus === 'loading'}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-mono text-white/40 transition active:scale-95 disabled:opacity-30">
                <Globe className="h-3.5 w-3.5" /> Re-fetch API
              </button>
            </div>
          </div>

          {/* Route Selection */}
          {state.routes.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {state.routes.map(r => (
                <RouteCard
                  key={r.id}
                  route={r}
                  selected={r.id === state.selectedRouteId}
                  onSelect={() => selectRoute(r.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ══════ RIGHT — Sidebar ══════ */}
        <div className="w-full lg:w-[290px] flex-shrink-0 space-y-3">

          {/* Recommendation Banner */}
          {selectedRoute && (
            <div className={`rounded-xl border p-4 ${
              selectedRoute.isRecommended
                ? 'bg-green-500/[0.07] border-green-500/20'
                : 'bg-red-500/[0.07] border-red-500/20'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {selectedRoute.isRecommended
                  ? <CheckCircle2 className="h-5 w-5 text-green-400" />
                  : <XCircle className="h-5 w-5 text-red-400" />
                }
                <span className={`text-sm font-bold ${selectedRoute.isRecommended ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedRoute.isRecommended ? 'Recommended Route' : 'Higher Risk Route'}
                </span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                {selectedRoute.isRecommended
                  ? `${selectedRoute.name} is the safest choice. Avoids all ${selectedRoute.unsafeZonesCrossed === 0 ? '' : selectedRoute.unsafeZonesCrossed} unsafe zones with a safety score of ${selectedRoute.safetyScore}/100.`
                  : `${selectedRoute.name} passes through ${selectedRoute.unsafeZonesCrossed} unsafe zone(s). Safety score: ${selectedRoute.safetyScore}/100. Consider switching to the safer route.`
                }
              </p>
            </div>
          )}

          {/* Safety Comparison */}
          {state.routes.length === 2 && (
            <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
              <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3">ROUTE COMPARISON</h3>
              <div className="space-y-3">
                <CompareRow label="Distance" vA={`${state.routes[0].distance} km`} vB={`${state.routes[1].distance} km`} betterB={state.routes[1].distance <= state.routes[0].distance} />
                <CompareRow label="Duration" vA={`${state.routes[0].duration} min`} vB={`${state.routes[1].duration} min`} betterB={state.routes[1].duration <= state.routes[0].duration} />
                <CompareRow label="Safety Score" vA={`${state.routes[0].safetyScore}`} vB={`${state.routes[1].safetyScore}`} betterB={state.routes[1].safetyScore >= state.routes[0].safetyScore} />
                <CompareRow label="Unsafe Zones" vA={`${state.routes[0].unsafeZonesCrossed}`} vB={`${state.routes[1].unsafeZonesCrossed}`} betterB={state.routes[1].unsafeZonesCrossed <= state.routes[0].unsafeZonesCrossed} />
                <CompareRow label="Traffic Density" vA={`${state.routes[0].trafficDensity}%`} vB={`${state.routes[1].trafficDensity}%`} betterB={state.routes[1].trafficDensity >= state.routes[0].trafficDensity} />
                <CompareRow label="Lighting" vA={`${state.routes[0].lightingScore}%`} vB={`${state.routes[1].lightingScore}%`} betterB={state.routes[1].lightingScore >= state.routes[0].lightingScore} />
              </div>
            </div>
          )}

          {/* Safety Analysis */}
          {selectedRoute && (
            <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4 space-y-2.5">
              <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest">SAFETY ANALYSIS</h3>
              <SafetyBar label="Safety Score" value={selectedRoute.safetyScore} max={100} color={selectedRoute.safetyScore >= 70 ? '#22c55e' : selectedRoute.safetyScore >= 40 ? '#f59e0b' : '#ef4444'} />
              <SafetyBar label="Traffic Density" value={selectedRoute.trafficDensity} max={100} color="#3b82f6" />
              <SafetyBar label="Lighting Score" value={selectedRoute.lightingScore} max={100} color="#fbbf24" />
              <div className="pt-2 border-t border-white/[0.04]">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-white/30">Risk Level</span>
                  <span className={`font-bold ${
                    selectedRoute.riskLevel === 'LOW' ? 'text-green-400' :
                    selectedRoute.riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-red-400'
                  }`}>{selectedRoute.riskLevel}</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono mt-1">
                  <span className="text-white/30">Zones Crossed</span>
                  <span className="text-white/60">{selectedRoute.unsafeZonesCrossed} / {state.unsafeZones.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Warning Log */}
          {state.warnings.length > 0 && (
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-4">
              <h3 className="text-[10px] font-bold font-mono text-red-400/70 tracking-widest mb-2">WARNING LOG</h3>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {state.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-red-400/80">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unsafe Zone Legend */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3">UNSAFE ZONES ({state.unsafeZones.length})</h3>
            <div className="space-y-2">
              {state.unsafeZones.map(z => {
                const meta = ZONE_META[z.type];
                return (
                  <div key={z.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-sm flex-shrink-0 mt-0.5">{meta.icon}</span>
                    <div>
                      <p className="text-[11px] font-semibold text-white/70">{z.label}</p>
                      <p className="text-[9px] text-white/30 mt-0.5">Severity: {z.severity}/10 • {z.type.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Demo Flow */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3">DEMO FLOW</h3>
            <div className="space-y-2">
              <FlowStep n={1} done={state.routes.length > 0} active={state.routes.length > 0 && !state.simulating && !state.arrived} label="Map loaded, routes fetched" />
              <FlowStep n={2} done={state.showUnsafeZones} active={state.showUnsafeZones && !state.simulating} label="Unsafe zones highlighted" />
              <FlowStep n={3} done={state.useSafestRoute} active={state.useSafestRoute && !state.simulating} label="Safest route selected" />
              <FlowStep n={4} done={state.simulating || state.arrived} active={state.simulating} label="Simulation running" />
              <FlowStep n={5} done={state.arrived} active={state.arrived} label="Arrival & outcome shown" />
            </div>
          </div>

          {/* Tech Stack Badge */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-3 text-center">
            <p className="text-[9px] font-mono text-white/20 leading-relaxed">
              Powered by<br />
              <span className="text-white/40">OpenStreetMap • OSRM Routing API • Leaflet</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════ */

function RouteCard({ route, selected, onSelect }: { route: RouteInfo; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect}
      className={`text-left rounded-xl border p-4 transition-all ${
        selected
          ? route.isRecommended
            ? 'bg-green-500/[0.06] border-green-500/25 ring-1 ring-green-500/20'
            : 'bg-red-500/[0.06] border-red-500/25 ring-1 ring-red-500/20'
          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
      }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold" style={{ color: route.color }}>{route.name}</span>
        <div className="flex gap-1">
          {route.isRecommended && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold">SAFER</span>
          )}
          {!route.isRecommended && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">RISKY</span>
          )}
          {selected && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-semibold">SELECTED</span>
          )}
        </div>
      </div>
      <p className="text-[10px] text-white/40 mb-3">{route.label}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[9px] text-white/30">Distance</p>
          <p className="text-xs font-bold font-mono text-white/70">{route.distance}km</p>
        </div>
        <div>
          <p className="text-[9px] text-white/30">Duration</p>
          <p className="text-xs font-bold font-mono text-white/70">{route.duration}min</p>
        </div>
        <div>
          <p className="text-[9px] text-white/30">Safety</p>
          <p className={`text-xs font-bold font-mono ${
            route.safetyScore >= 70 ? 'text-green-400' :
            route.safetyScore >= 40 ? 'text-amber-400' : 'text-red-400'
          }`}>{route.safetyScore}/100</p>
        </div>
      </div>
    </button>
  );
}

function CompareRow({ label, vA, vB, betterB }: { label: string; vA: string; vB: string; betterB: boolean }) {
  return (
    <div className="flex items-center text-[10px] font-mono">
      <span className="w-24 text-white/30">{label}</span>
      <span className={`flex-1 text-center ${!betterB ? 'text-green-400 font-bold' : 'text-white/50'}`}>{vA}</span>
      <span className={`flex-1 text-center ${betterB ? 'text-green-400 font-bold' : 'text-white/50'}`}>{vB}</span>
    </div>
  );
}

function SafetyBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] text-white/40">{label}</span>
        <span className="text-[10px] font-bold font-mono" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function FlowStep({ n, done, active, label }: { n: number; done: boolean; active: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2.5 transition-all ${active ? 'opacity-100' : done ? 'opacity-60' : 'opacity-25'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
        active ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
        done ? 'bg-white/[0.06] border-white/10 text-white/50' :
        'bg-transparent border-white/10 text-white/20'
      }`}>
        {done && !active ? '✓' : n}
      </div>
      <span className={`text-[10px] font-mono ${active ? 'text-emerald-400 font-semibold' : 'text-white/40'}`}>{label}</span>
    </div>
  );
}

export default SafetyRoutingPage;
