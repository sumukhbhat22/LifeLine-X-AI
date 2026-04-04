import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, RotateCcw, Eye, Tag, Route,
  Layers, Activity, Car, Truck, Bus, Siren, AlertTriangle, CheckCircle2,
  BarChart3, Timer, Leaf, Gauge, Cpu, Zap, ChevronDown, ChevronUp,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { YoloOverlay } from '@/components/YoloOverlay';
import { TrafficSimCanvas } from '@/components/TrafficSimCanvas';
import { useYoloDetection } from '@/hooks/useYoloDetection';

import type { DetectionEvent, VehicleClass } from '@/hooks/useYoloDetection';

// ─── Scenario presets (replaces video library) ────────────
interface Scenario {
  id: string;
  title: string;
  location: string;
  density: 'low' | 'medium' | 'high' | 'extreme';
  ambulance: boolean;
  duration: number; // seconds
  description: string;
}

const SCENARIOS: Scenario[] = [
  { id: 'silk-board', title: '🚨 Silk Board Junction', location: 'Silk Board, Bengaluru', density: 'extreme', ambulance: true, duration: 60, description: 'Extreme congestion with ambulance corridor demo' },
  { id: 'kr-puram', title: '🚗 KR Puram Signal', location: 'KR Puram, Bengaluru', density: 'high', ambulance: true, duration: 55, description: 'Heavy evening rush with emergency response' },
  { id: 'marathahalli', title: '🏙️ Marathahalli Bridge', location: 'Marathahalli, Bengaluru', density: 'high', ambulance: false, duration: 50, description: 'Dense traffic flow without emergency' },
  { id: 'hebbal', title: '🛣️ Hebbal Flyover', location: 'Hebbal, Bengaluru', density: 'medium', ambulance: true, duration: 55, description: 'Moderate traffic with ambulance priority' },
  { id: 'koramangala', title: '🔴 Koramangala Inner Ring', location: 'Koramangala, Bengaluru', density: 'extreme', ambulance: true, duration: 65, description: 'Peak-hour worst-case analysis' },
  { id: 'mg-road', title: '🟢 MG Road Corridor', location: 'MG Road, Bengaluru', density: 'medium', ambulance: false, duration: 45, description: 'Medium density baseline scenario' },
  { id: 'outer-ring', title: '🚛 Outer Ring Road', location: 'Outer Ring, Bengaluru', density: 'high', ambulance: true, duration: 55, description: 'Mixed vehicle types with heavy freight' },
  { id: 'whitefield', title: '🌅 Whitefield Junction', location: 'Whitefield, Bengaluru', density: 'low', ambulance: false, duration: 40, description: 'Light traffic baseline' },
];

// ─── Helpers ──────────────────────────────────────────────
const densityBadge = (d: string) =>
  d === 'low' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
  d === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
  d === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
  'bg-red-500/10 text-red-400 border-red-500/30';

const sevIcon = (s: string) =>
  s === 'critical' ? <Siren className="h-3 w-3 text-red-400" /> :
  s === 'warning' ? <AlertTriangle className="h-3 w-3 text-yellow-400" /> :
  s === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-400" /> :
  <Activity className="h-3 w-3 text-cyan-400" />;

const classIcon = (c: VehicleClass) =>
  c === 'car' ? '🚗' : c === 'bus' ? '🚌' : c === 'truck' ? '🚛' : c === 'motorcycle' ? '🏍' : c === 'auto-rickshaw' ? '🛺' : '🚑';

// ─── Main Component ──────────────────────────────────────
const RealWorldAnalyzer = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState(SCENARIOS[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);

  // Overlay toggles
  const [showBboxes, setShowBboxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showTrails, setShowTrails] = useState(false);
  const [showLanes, setShowLanes] = useState(true);

  const startTimeRef = useRef<number | null>(null);
  const pauseElapsedRef = useRef(0);
  const rafRef = useRef<number>(0);

  const scenario = SCENARIOS.find(s => s.id === selectedScenarioId) || SCENARIOS[0];
  const duration = scenario.duration;
  const progress = duration > 0 ? elapsedTime / duration : 0;

  const { currentFrame, events, analytics, initialize, processFrame, reset } = useYoloDetection();

  // Initialize detection when scenario changes
  useEffect(() => {
    initialize(scenario.id, scenario.density, scenario.ambulance);
    reset();
    setElapsedTime(0);
    setIsPlaying(false);
    startTimeRef.current = null;
    pauseElapsedRef.current = 0;
  }, [selectedScenarioId]);

  // Animation loop — drives the simulation timer
  const tick = useCallback(() => {
    if (isPlaying && startTimeRef.current !== null) {
      const now = performance.now();
      const elapsed = pauseElapsedRef.current + (now - startTimeRef.current) / 1000;

      if (elapsed >= duration) {
        setElapsedTime(duration);
        setIsPlaying(false);
        processFrame(duration, duration, true);
        startTimeRef.current = null;
        return;
      }
      setElapsedTime(elapsed);
      processFrame(elapsed, duration, true);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [isPlaying, processFrame, duration]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseElapsedRef.current = elapsedTime;
      startTimeRef.current = null;
      setIsPlaying(false);
    } else {
      if (elapsedTime >= duration) {
        // Reset and replay
        reset();
        setElapsedTime(0);
        pauseElapsedRef.current = 0;
        initialize(scenario.id, scenario.density, scenario.ambulance);
      }
      startTimeRef.current = performance.now();
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    startTimeRef.current = null;
    pauseElapsedRef.current = 0;
    setElapsedTime(0);
    setIsPlaying(false);
    reset();
  };

  const handleSeek = (pct: number) => {
    const t = pct * duration;
    pauseElapsedRef.current = t;
    setElapsedTime(t);
    if (isPlaying) {
      startTimeRef.current = performance.now();
    }
    processFrame(t, duration, true);
  };

  const handleScenarioChange = (id: string) => {
    setSelectedScenarioId(id);
  };

  // ─── Derived stats ───
  const classCounts: Record<string, number> = {};
  if (currentFrame) {
    for (const v of currentFrame.vehicles) {
      classCounts[v.classLabel] = (classCounts[v.classLabel] || 0) + 1;
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col">
      {/* ═══════ Header ═══════ */}
      <div className="border-b border-cyan-500/10 bg-[#0d1224]/90 backdrop-blur sticky top-0 z-50 py-3 px-4">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2 text-slate-300 hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
            <div className="h-5 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span className="font-bold text-sm tracking-wide">LifeLine-X+ AI Traffic Analyzer</span>
            </div>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">
              YOLOv8n
            </Badge>
            <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px]">
              LIVE SIM
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* Overlay Toggles */}
            <div className="hidden md:flex items-center gap-4 mr-4 text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Switch checked={showBboxes} onCheckedChange={setShowBboxes} className="h-4 w-7 data-[state=checked]:bg-cyan-500" />
                <Eye className="h-3 w-3" /> Boxes
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Switch checked={showLabels} onCheckedChange={setShowLabels} className="h-4 w-7 data-[state=checked]:bg-cyan-500" />
                <Tag className="h-3 w-3" /> Labels
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Switch checked={showTrails} onCheckedChange={setShowTrails} className="h-4 w-7 data-[state=checked]:bg-cyan-500" />
                <Route className="h-3 w-3" /> Trails
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Switch checked={showLanes} onCheckedChange={setShowLanes} className="h-4 w-7 data-[state=checked]:bg-cyan-500" />
                <Layers className="h-3 w-3" /> Lanes
              </label>
            </div>

            <Button
              variant="ghost" size="sm"
              className="text-slate-400 hover:text-white lg:hidden"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════ Body ═══════ */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1920px] mx-auto w-full">
        {/* ──── Left: Simulation Canvas + Controls ──── */}
        <div className="flex-1 min-w-0 p-3 space-y-3">
          {/* Traffic Sim Canvas + YOLO Overlay */}
          <div className="relative rounded-xl overflow-hidden border border-cyan-500/20 bg-black aspect-video shadow-[0_0_30px_rgba(6,182,212,0.08)]">
            {/* Animated traffic scene (replaces video) */}
            <TrafficSimCanvas
              frame={currentFrame}
              isPlaying={isPlaying}
              progress={progress}
            />

            {/* YOLO Detection Overlay (bounding boxes, labels, etc.) */}
            <YoloOverlay
              frame={currentFrame}
              isPlaying={isPlaying}
              showBboxes={showBboxes}
              showLabels={showLabels}
              showTrails={showTrails}
              showLanes={showLanes}
            />

            {/* Big center play button when not started or paused at 0 */}
            {!isPlaying && elapsedTime < 0.1 && (
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 flex items-center justify-center z-10 bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
              >
                <div className="w-20 h-20 rounded-full bg-cyan-500/90 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:scale-110 transition-transform">
                  <Play className="h-10 w-10 text-white ml-1" />
                </div>
                <span className="absolute bottom-1/2 mt-16 translate-y-14 text-white/80 text-sm font-medium">Click to start AI Detection</span>
              </button>
            )}

            {/* Simulation complete overlay */}
            {!isPlaying && elapsedTime >= duration && duration > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/40">
                <CheckCircle2 className="h-12 w-12 text-green-400 mb-3" />
                <p className="text-white font-semibold mb-1">Analysis Complete</p>
                <p className="text-slate-300 text-sm mb-4">
                  {analytics.timeSaved}s saved &bull; {analytics.corridorEfficiency}% corridor efficiency
                </p>
                <Button size="sm" onClick={handleReset} className="bg-cyan-600 hover:bg-cyan-500 gap-2">
                  <RotateCcw className="h-4 w-4" /> Run Again
                </Button>
              </div>
            )}

            {/* Always‑visible controls bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12 z-20">
              <div className="flex items-center gap-3 mb-2">
                <Button size="sm" variant="ghost" onClick={handlePlayPause} className="text-white hover:bg-white/10">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleReset} className="text-white hover:bg-white/10">
                  <RotateCcw className="h-4 w-4" />
                </Button>

                {/* Mini live stats in controls bar */}
                <div className="flex items-center gap-3 ml-auto text-[10px] font-mono text-slate-300">
                  {currentFrame && (
                    <>
                      <span className="text-cyan-400">{currentFrame.totalCount} vehicles</span>
                      <span>|</span>
                      <span className={currentFrame.congestionLevel > 60 ? 'text-red-400' : currentFrame.congestionLevel > 30 ? 'text-yellow-400' : 'text-green-400'}>
                        {currentFrame.congestionLevel}% congestion
                      </span>
                      <span>|</span>
                      <span>{currentFrame.fps} FPS</span>
                    </>
                  )}
                  <span className="text-slate-500">{Math.floor(elapsedTime)}s / {duration}s</span>
                </div>
              </div>

              {/* Seek bar */}
              <div
                className="h-1.5 bg-white/20 rounded-full cursor-pointer hover:h-2.5 transition-all relative group/bar"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  handleSeek(pct);
                }}
              >
                <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
                {/* Event markers */}
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${
                      ev.severity === 'critical' ? 'bg-red-500' : ev.severity === 'success' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ left: `${(ev.time / (duration || 1)) * 100}%` }}
                    title={ev.message}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ──── Bottom Tabs: Detection Details ──── */}
          <Tabs defaultValue="events" className="border border-cyan-500/10 rounded-xl bg-[#0d1224]">
            <TabsList className="bg-[#111832] border-b border-cyan-500/10 w-full justify-start rounded-b-none h-9">
              <TabsTrigger value="events" className="text-[11px] data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Activity className="h-3 w-3 mr-1" /> Events ({events.length})
              </TabsTrigger>
              <TabsTrigger value="lanes" className="text-[11px] data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Layers className="h-3 w-3 mr-1" /> Lane Analysis
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="text-[11px] data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Car className="h-3 w-3 mr-1" /> Vehicles ({currentFrame?.totalCount || 0})
              </TabsTrigger>
            </TabsList>

            {/* Events Timeline */}
            <TabsContent value="events" className="p-3 m-0">
              <ScrollArea className="h-[180px]">
                {events.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-8">Start simulation to begin detection...</p>
                ) : (
                  <div className="space-y-2">
                    {[...events].reverse().map((ev: DetectionEvent) => (
                      <div key={ev.id} className={`flex gap-2 items-start text-xs p-2 rounded-lg border ${
                        ev.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                        ev.severity === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5' :
                        ev.severity === 'success' ? 'border-green-500/20 bg-green-500/5' :
                        'border-cyan-500/10 bg-cyan-500/5'
                      }`}>
                        {sevIcon(ev.severity)}
                        <div className="flex-1">
                          <span className="text-slate-200">{ev.message}</span>
                          <span className="text-slate-500 ml-2">{ev.time.toFixed(1)}s</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] h-4">
                          {ev.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Lane Analysis */}
            <TabsContent value="lanes" className="p-3 m-0">
              {!currentFrame ? (
                <p className="text-slate-500 text-xs text-center py-8">Waiting for detection data...</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {currentFrame.lanes.map((lane) => (
                    <div key={lane.id} className="rounded-lg border border-cyan-500/10 bg-[#111832] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Lane {lane.id + 1}</span>
                        <Badge variant="outline" className={`text-[9px] h-4 ${
                          lane.dominant === 'blocked' ? 'border-red-500/50 text-red-400' :
                          lane.dominant === 'slow' ? 'border-yellow-500/50 text-yellow-400' :
                          lane.dominant === 'cooperative' ? 'border-cyan-500/50 text-cyan-400' :
                          'border-green-500/50 text-green-400'
                        }`}>{lane.dominant}</Badge>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                          <span>Density</span><span>{Math.round(lane.density * 100)}%</span>
                        </div>
                        <Progress value={lane.density * 100} className="h-1.5" />
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Vehicles</span>
                        <span className="font-mono">{lane.vehicleCount}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Avg Speed</span>
                        <span className="font-mono">{Math.round(lane.avgSpeed)} km/h</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Vehicle List */}
            <TabsContent value="vehicles" className="p-3 m-0">
              <ScrollArea className="h-[180px]">
                {!currentFrame || currentFrame.vehicles.length === 0 ? (
                  <p className="text-slate-500 text-xs text-center py-8">No vehicles detected yet...</p>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {currentFrame.vehicles.map((v) => (
                      <div key={v.id} className={`flex items-center gap-2 p-1.5 rounded text-[10px] font-mono border ${
                        v.isAmbulance ? 'border-yellow-500/40 bg-yellow-500/5' :
                        v.state === 'blocked' ? 'border-red-500/20 bg-red-500/5' :
                        v.state === 'slow' ? 'border-yellow-500/10 bg-yellow-500/5' :
                        'border-slate-700/30 bg-slate-800/30'
                      }`}>
                        <span>{classIcon(v.classLabel)}</span>
                        <span className="text-slate-300 flex-1">#{v.trackId} {v.classLabel}</span>
                        <span className={v.speed < 5 ? 'text-red-400' : v.speed < 20 ? 'text-yellow-400' : 'text-green-400'}>
                          {Math.round(v.speed)}km/h
                        </span>
                        <span className="text-slate-500">{(v.confidence * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* ──── Right Sidebar ──── */}
        <div className={`w-full lg:w-[340px] shrink-0 border-l border-cyan-500/10 bg-[#0d1224]/80 overflow-auto ${
          showSidebar ? '' : 'hidden lg:block'
        }`}>
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">

              {/* ─── Live Stats Grid ─── */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={<Car className="h-3.5 w-3.5" />} label="Detected" value={currentFrame?.totalCount || 0} color="cyan" />
                <StatCard icon={<Gauge className="h-3.5 w-3.5" />} label="Congestion" value={`${currentFrame?.congestionLevel || 0}%`}
                  color={currentFrame && currentFrame.congestionLevel > 60 ? 'red' : currentFrame && currentFrame.congestionLevel > 30 ? 'yellow' : 'green'} />
                <StatCard icon={<Zap className="h-3.5 w-3.5" />} label="FPS" value={currentFrame?.fps || 0} color="cyan" />
                <StatCard icon={<Cpu className="h-3.5 w-3.5" />} label="Inference" value={`${currentFrame ? currentFrame.inferenceMs.toFixed(0) : 0}ms`} color="cyan" />
              </div>

              {/* ─── Corridor Efficiency ─── */}
              <Card className="p-3 bg-[#111832] border-cyan-500/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-300">Corridor Efficiency</span>
                  <span className={`font-mono text-lg font-bold ${
                    analytics.corridorEfficiency > 80 ? 'text-green-400' :
                    analytics.corridorEfficiency > 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{analytics.corridorEfficiency}%</span>
                </div>
                <Progress value={analytics.corridorEfficiency} className="h-2" />
              </Card>

              {/* ─── Vehicle Class Breakdown ─── */}
              <Card className="p-3 bg-[#111832] border-cyan-500/10">
                <h4 className="text-[11px] font-semibold text-slate-300 mb-2">Vehicle Classification</h4>
                {Object.keys(classCounts).length === 0 ? (
                  <p className="text-slate-600 text-[10px] text-center py-3">Awaiting detections...</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(classCounts).sort(([,a],[,b]) => b - a).map(([cls, count]) => (
                      <div key={cls} className="flex items-center gap-2 text-[10px]">
                        <span className="w-5 text-center">{classIcon(cls as VehicleClass)}</span>
                        <span className="flex-1 text-slate-300 capitalize">{cls}</span>
                        <span className="font-mono text-slate-400">{count}</span>
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cls === 'ambulance' ? 'bg-yellow-500' : 'bg-cyan-500/60'}`}
                            style={{ width: `${(count / (currentFrame?.totalCount || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* ─── AI Analytics ─── */}
              <Card className="p-3 bg-[#111832] border-cyan-500/10">
                <h4 className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3 text-cyan-400" /> AI Analytics
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                  <Metric label="Total Detections" value={analytics.totalDetections.toLocaleString()} />
                  <Metric label="Unique Vehicles" value={analytics.uniqueVehicles} />
                  <Metric label="Peak Congestion" value={`${analytics.peakCongestion}%`} />
                  <Metric label="Vehicles Cleared" value={analytics.vehiclesCleared} />
                  <Metric label="Detection Accuracy" value={`${analytics.detectionAccuracy.toFixed(1)}%`} />
                  <Metric label="Ambulances" value={analytics.ambulancesDetected} />
                </div>
                <div className="mt-3 pt-2 border-t border-slate-700/50 grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded bg-green-500/5 border border-green-500/20">
                    <Timer className="h-3.5 w-3.5 text-green-400 mx-auto mb-1" />
                    <div className="text-green-400 font-bold text-sm">{analytics.timeSaved}s</div>
                    <div className="text-[9px] text-slate-500">Time Saved</div>
                  </div>
                  <div className="text-center p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                    <Leaf className="h-3.5 w-3.5 text-emerald-400 mx-auto mb-1" />
                    <div className="text-emerald-400 font-bold text-sm">{analytics.co2Saved}kg</div>
                    <div className="text-[9px] text-slate-500">CO₂ Saved</div>
                  </div>
                </div>
              </Card>

              {/* ─── Model Info ─── */}
              <Card className="p-3 bg-[#111832] border-cyan-500/10">
                <h4 className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-cyan-400" /> Model Details
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  <Metric label="Model" value={analytics.modelInfo.name} />
                  <Metric label="Size" value={analytics.modelInfo.size} />
                  <Metric label="COCO Classes" value={analytics.modelInfo.classes} />
                  <Metric label="Runtime FPS" value={analytics.modelInfo.fps} />
                </div>
                <div className="mt-2 p-2 rounded bg-cyan-500/5 border border-cyan-500/20 text-[9px] text-slate-400 font-mono">
                  ultralytics YOLOv8n | PyTorch → ONNX<br />
                  Input: 640×640 | NMS conf=0.25 iou=0.45
                </div>
              </Card>

              {/* ─── Scenario Selector ─── */}
              <Card className="p-3 bg-[#111832] border-cyan-500/10">
                <h4 className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-cyan-400" /> Scenario
                </h4>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleScenarioChange(s.id)}
                      className={`w-full text-left p-2 rounded-lg border transition-all text-[10px] ${
                        selectedScenarioId === s.id
                          ? 'border-cyan-500/40 bg-cyan-500/10'
                          : 'border-slate-700/30 bg-slate-800/20 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="font-semibold text-slate-200 text-[11px] mb-0.5">{s.title}</div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>{s.duration}s</span>
                        <span>&bull;</span>
                        <span>{s.location}</span>
                        {s.ambulance && <span className="ml-1">🚑</span>}
                        <span className="ml-auto">
                          <Badge variant="outline" className={`text-[8px] h-3.5 ${densityBadge(s.density)}`}>
                            {s.density}
                          </Badge>
                        </span>
                      </div>
                      <div className="text-slate-600 text-[9px] mt-0.5">{s.description}</div>
                    </button>
                  ))}
                </div>
              </Card>

              {/* ─── Legend ─── */}
              <Card className="p-3 bg-[#111832] border-cyan-500/10">
                <h4 className="text-[11px] font-semibold text-slate-300 mb-2">Detection Legend</h4>
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-red-500" /><span className="text-slate-400">Blocked</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /><span className="text-slate-400">Slow / Congested</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-green-500" /><span className="text-slate-400">Flowing</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-cyan-500" /><span className="text-slate-400">Cooperative (Yielding)</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-yellow-300" /><span className="text-slate-400">Ambulance (Priority)</span></div>
                </div>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

// ─── Sub‑components ────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const c = color === 'red' ? 'border-red-500/20 text-red-400' :
    color === 'yellow' ? 'border-yellow-500/20 text-yellow-400' :
    color === 'green' ? 'border-green-500/20 text-green-400' :
    'border-cyan-500/20 text-cyan-400';
  return (
    <div className={`rounded-lg border bg-[#111832] p-2.5 ${c}`}>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
        {icon} {label}
      </div>
      <div className="font-mono font-bold text-lg">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-200 text-right">{value}</span>
    </>
  );
}

export default RealWorldAnalyzer;
