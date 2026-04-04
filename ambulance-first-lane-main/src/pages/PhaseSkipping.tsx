import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, RotateCcw, SkipForward, Gauge,
  Activity, Clock, Leaf, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  usePhaseSkipping,
  CANVAS_W, CANVAS_H, CX, CY, ROAD_W,
  vehicleWorldPos, laneApproachPts, laneDeparturePts,
} from '@/hooks/usePhaseSkipping';
import type { JunctionState, PSILane, SkipEvent, Point } from '@/hooks/usePhaseSkipping';

/* ─── Tiny signal dot ─────────────────────────── */
function Dot({ on, color }: { on: boolean; color: string }) {
  const map: Record<string, string> = { red: '#ef4444', yellow: '#eab308', green: '#22c55e' };
  return (
    <div
      className="w-3 h-3 rounded-full border border-white/10"
      style={{
        backgroundColor: on ? map[color] : `${map[color]}22`,
        boxShadow: on ? `0 0 8px ${map[color]}` : 'none',
      }}
    />
  );
}

/* ─── Lane mini-canvas ────────────────────────── */
function LaneStrip({ lane }: { lane: PSILane }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);

    // Road background
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, w, h);

    // Centre line dashes
    ctx.strokeStyle = '#ffffff20';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Vehicles as small rectangles
    const active = lane.vehicles.filter(v => !v.exited);
    for (const v of active) {
      const vx = v.pos * w;
      const vy = h / 2 - 3;
      ctx.fillStyle = v.waiting ? '#ef4444' : '#22c55e';
      ctx.fillRect(vx - 6, vy, 12, 6);
    }

    // Stop line
    const stopX = 0.48 * w;
    ctx.strokeStyle = lane.signal === 'green' ? '#22c55e80' : '#ef444480';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(stopX, 0);
    ctx.lineTo(stopX, h);
    ctx.stroke();
  }, [lane]);

  return <canvas ref={ref} width={160} height={24} className="rounded border border-white/5" />;
}

/* ═══════════════════════════════════════════════
   Main canvas draw
   ═══════════════════════════════════════════════ */

function drawScene(ctx: CanvasRenderingContext2D, state: JunctionState) {
  const W = CANVAS_W, H = CANVAS_H;
  ctx.clearRect(0, 0, W, H);

  // Background
  const bg = ctx.createRadialGradient(CX, CY, 50, CX, CY, 500);
  bg.addColorStop(0, '#0f1520');
  bg.addColorStop(1, '#080b10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#ffffff06';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Roads
  ctx.fillStyle = '#141a28';
  // Vertical road
  ctx.fillRect(CX - ROAD_W / 2, 0, ROAD_W, H);
  // Horizontal road
  ctx.fillRect(0, CY - ROAD_W / 2, W, ROAD_W);
  // Junction box
  ctx.fillStyle = '#1a2030';
  ctx.fillRect(CX - ROAD_W / 2, CY - ROAD_W / 2, ROAD_W, ROAD_W);

  // Road centre lines
  ctx.strokeStyle = '#ffffff10';
  ctx.setLineDash([6, 10]);
  ctx.lineWidth = 1;
  // Vertical
  ctx.beginPath(); ctx.moveTo(CX, 0); ctx.lineTo(CX, CY - ROAD_W / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX, CY + ROAD_W / 2); ctx.lineTo(CX, H); ctx.stroke();
  // Horizontal
  ctx.beginPath(); ctx.moveTo(0, CY); ctx.lineTo(CX - ROAD_W / 2, CY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX + ROAD_W / 2, CY); ctx.lineTo(W, CY); ctx.stroke();
  ctx.setLineDash([]);

  // Lane labels
  ctx.font = '11px monospace';
  ctx.fillStyle = '#ffffff30';
  ctx.textAlign = 'center';
  ctx.fillText('N', CX, 16);
  ctx.fillText('S', CX, H - 8);
  ctx.fillText('E', W - 12, CY);
  ctx.fillText('W', 12, CY);

  // ── Signal lights at intersection edges ──
  const signalPositions: Record<string, Point> = {
    N: { x: CX - ROAD_W / 2 - 14, y: CY - ROAD_W / 2 - 14 },
    S: { x: CX + ROAD_W / 2 + 14, y: CY + ROAD_W / 2 + 14 },
    E: { x: CX + ROAD_W / 2 + 14, y: CY - ROAD_W / 2 - 14 },
    W: { x: CX - ROAD_W / 2 - 14, y: CY + ROAD_W / 2 + 14 },
  };

  for (const lane of state.lanes) {
    const sp = signalPositions[lane.dir];
    const colors = { red: '#ef4444', yellow: '#eab308', green: '#22c55e' };
    const c = colors[lane.signal];

    // Outer ring
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = `${c}30`;
    ctx.fill();
    ctx.strokeStyle = `${c}60`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();

    // Glow
    ctx.shadowColor = c;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Skipped indicator
    if (lane.skipped) {
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#a78bfa';
      ctx.textAlign = 'center';
      ctx.fillText('SKIP', sp.x, sp.y - 14);
    }
  }

  // ── Vehicles ──
  for (const lane of state.lanes) {
    for (const v of lane.vehicles) {
      if (v.exited) continue;
      const p = vehicleWorldPos(v.lane, v.pos);
      const isVertical = v.lane === 'N' || v.lane === 'S';
      const vw = isVertical ? 8 : 14;
      const vh = isVertical ? 14 : 8;

      // Vehicle body
      ctx.fillStyle = v.waiting ? '#ef444490' : '#22c55e90';
      ctx.strokeStyle = v.waiting ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 0.5;
      const rx = p.x - vw / 2;
      const ry = p.y - vh / 2;
      ctx.beginPath();
      ctx.roundRect(rx, ry, vw, vh, 2);
      ctx.fill();
      ctx.stroke();

      // Headlight glow
      ctx.shadowColor = v.waiting ? '#ef4444' : '#22c55e';
      ctx.shadowBlur = 4;
      ctx.fillRect(rx, ry, vw, vh);
      ctx.shadowBlur = 0;
    }
  }

  // ── PSI status overlay ──
  if (state.psiEnabled) {
    ctx.fillStyle = '#a78bfa18';
    ctx.fillRect(CX - ROAD_W / 2 - 2, CY - ROAD_W / 2 - 2, ROAD_W + 4, ROAD_W + 4);
    ctx.strokeStyle = '#a78bfa40';
    ctx.lineWidth = 1;
    ctx.strokeRect(CX - ROAD_W / 2 - 2, CY - ROAD_W / 2 - 2, ROAD_W + 4, ROAD_W + 4);

    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#a78bfa';
    ctx.textAlign = 'center';
    ctx.fillText('PSI ACTIVE', CX, CY - 2);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#a78bfa80';
    ctx.fillText(`${state.stats.totalPhasesSkipped} skipped`, CX, CY + 8);
  }

  // ── Phase timer arc around junction ──
  const activePhase = state.lanes[state.activePhaseIdx];
  const phaseFrac = activePhase.phaseRemaining / 12;
  ctx.beginPath();
  ctx.arc(CX, CY, ROAD_W / 2 + 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * phaseFrac);
  ctx.strokeStyle = '#a78bfa50';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── Countdown text near junction ──
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#a78bfa90';
  ctx.textAlign = 'center';
  ctx.fillText(`${activePhase.phaseRemaining.toFixed(1)}s`, CX, CY + ROAD_W / 2 + 38);
}

/* ═══════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════ */

const PhaseSkippingPage = () => {
  const { state, running, psiEnabled, togglePlay, togglePSI, reset } = usePhaseSkipping();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Render loop ──
  useEffect(() => {
    let raf = 0;
    function render() {
      raf = requestAnimationFrame(render);
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      drawScene(ctx, state);
    }
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const dirLabels: Record<string, string> = { N: 'North', E: 'East', S: 'South', W: 'West' };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white">
      {/* Top bar */}
      <div className="border-b border-white/5 bg-[#0d1117]/80 backdrop-blur px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
            </Button>
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <SkipForward className="w-5 h-5 text-violet-400" />
          <span className="font-bold text-sm tracking-wide">Phase Skipping Intelligence</span>
          <Badge variant="outline" className="border-violet-500/40 text-violet-400 text-[10px]">
            PSI v2
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
          <Activity className="w-3 h-3" />
          {state.cycleTime.toFixed(1)}s
        </div>
      </div>

      {/* Main content */}
      <div className="flex h-[calc(100vh-41px)]">
        {/* Canvas area */}
        <div className="flex-1 flex flex-col">
          {/* Controls bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-[#0d1117]/60">
            <Button
              size="sm"
              onClick={togglePlay}
              className={running
                ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-600/30'
                : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-600/30'
              }
            >
              {running ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
              {running ? 'Pause' : 'Play'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={reset}
              className="text-white/50 hover:text-white"
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
            <div className="h-5 w-px bg-white/10 mx-1" />
            <Button
              size="sm"
              onClick={togglePSI}
              className={psiEnabled
                ? 'bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 border border-violet-500/30'
                : 'bg-white/5 text-white/40 hover:bg-white/10 border border-white/10'
              }
            >
              {psiEnabled
                ? <ToggleRight className="w-3 h-3 mr-1" />
                : <ToggleLeft className="w-3 h-3 mr-1" />
              }
              PSI {psiEnabled ? 'ON' : 'OFF'}
            </Button>
            <div className="flex-1" />
            <span className="text-[10px] text-white/30 font-mono">
              Cycle {state.stats.totalCycles} • Phase {state.lanes[state.activePhaseIdx].dir}
            </span>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center p-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="rounded-lg border border-white/5 shadow-2xl"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>

          {/* Junction lane strips */}
          <div className="grid grid-cols-4 gap-2 px-4 pb-3">
            {state.lanes.map((lane, i) => {
              const count = lane.vehicles.filter(v => !v.exited).length;
              const waiting = lane.vehicles.filter(v => !v.exited && v.waiting).length;
              return (
                <Card key={lane.dir} className="bg-[#0d1117] border-white/5 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-white/60">{dirLabels[lane.dir]}</span>
                      {lane.skipped && (
                        <Badge className="bg-violet-600/20 text-violet-400 border-violet-500/30 text-[8px] px-1 py-0">
                          SKIPPED
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-0.5">
                      <Dot on={lane.signal === 'red'} color="red" />
                      <Dot on={lane.signal === 'yellow'} color="yellow" />
                      <Dot on={lane.signal === 'green'} color="green" />
                    </div>
                  </div>
                  <LaneStrip lane={lane} />
                  <div className="flex justify-between mt-1 text-[9px] text-white/30 font-mono">
                    <span>{count} veh</span>
                    <span>{waiting} wait</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-80 border-l border-white/5 bg-[#0d1117]/80 flex flex-col overflow-y-auto">

          {/* ═══ COMPARISON PANEL: Current System vs Our System ═══ */}
          <div className="p-3 border-b border-white/5">
            <h3 className="text-[10px] font-bold text-white/40 tracking-widest uppercase mb-3">
              Live Comparison
            </h3>

            {/* Side-by-side boxes */}
            <div className="grid grid-cols-2 gap-2">
              {/* Current System (bad) */}
              <div className="rounded-lg border border-red-500/20 bg-red-600/5 p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Current System</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-[8px] text-white/30 block">Cycle Time</span>
                    <span className="text-lg font-bold text-red-400 font-mono">
                      {state.stats.totalCycles > 0
                        ? `${(state.stats.currentSystemCycleTime / state.stats.totalCycles).toFixed(0)}s`
                        : `${4 * 12}s`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 block">Avg Wait</span>
                    <span className="text-sm font-bold text-red-300 font-mono">{state.stats.currentSystemAvgWait || 14.4}s</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 block">Wasted Green</span>
                    <span className="text-sm font-bold text-red-300 font-mono">{state.stats.wastedTime.toFixed(0)}s</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 block">Empty Phase Skipped?</span>
                    <span className="text-xs font-bold text-red-400">❌ NO</span>
                  </div>
                </div>
              </div>

              {/* Our System (good) */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-600/5 p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Our System (PSI)</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-[8px] text-white/30 block">Cycle Time</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {state.stats.totalCycles > 0
                        ? `${(state.stats.ourSystemCycleTime / state.stats.totalCycles).toFixed(0)}s`
                        : `${2 * 12}s`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 block">Avg Wait</span>
                    <span className="text-sm font-bold text-emerald-300 font-mono">{state.stats.ourSystemAvgWait || 7.2}s</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 block">Time Saved</span>
                    <span className="text-sm font-bold text-emerald-300 font-mono">{state.stats.totalTimeSaved.toFixed(0)}s</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-white/30 block">Empty Phase Skipped?</span>
                    <span className="text-xs font-bold text-emerald-400">✅ YES</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Efficiency gain bar */}
            <div className="mt-3 p-2 rounded bg-violet-600/10 border border-violet-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-violet-300">Efficiency Gain</span>
                <span className="text-sm font-bold text-violet-400 font-mono">{state.stats.efficiencyGain}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, state.stats.efficiencyGain)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[8px] text-white/25">
                <span>0%</span>
                <span className="text-violet-400/60">
                  {state.stats.totalPhasesSkipped} phases skipped • {state.stats.emissionReduction.toFixed(2)} kg CO₂ saved
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* PSI Metrics */}
          <div className="p-3 space-y-2 border-b border-white/5">
            <h3 className="text-[10px] font-bold text-white/40 tracking-widest uppercase mb-2">
              PSI Metrics
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                icon={<Clock className="w-3.5 h-3.5 text-blue-400" />}
                label="Time Saved"
                value={`${state.stats.totalTimeSaved.toFixed(0)}s`}
                color="blue"
              />
              <MetricCard
                icon={<SkipForward className="w-3.5 h-3.5 text-violet-400" />}
                label="Phases Skipped"
                value={`${state.stats.totalPhasesSkipped}`}
                color="violet"
              />
              <MetricCard
                icon={<Leaf className="w-3.5 h-3.5 text-green-400" />}
                label="CO₂ Saved"
                value={`${state.stats.emissionReduction.toFixed(2)} kg`}
                color="green"
              />
              <MetricCard
                icon={<Gauge className="w-3.5 h-3.5 text-amber-400" />}
                label="Throughput"
                value={`${state.stats.throughput}/min`}
                color="amber"
              />
            </div>
          </div>

          {/* Current phase info */}
          <div className="p-3 border-b border-white/5">
            <h3 className="text-[10px] font-bold text-white/40 tracking-widest uppercase mb-2">
              Current Phase
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {state.lanes.map(l => (
                  <div
                    key={l.dir}
                    className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold border ${
                      l.signal === 'green'
                        ? 'bg-green-600/20 border-green-500/40 text-green-400'
                        : l.signal === 'yellow'
                          ? 'bg-yellow-600/20 border-yellow-500/40 text-yellow-400'
                          : l.skipped
                            ? 'bg-violet-600/10 border-violet-500/30 text-violet-400'
                            : 'bg-white/5 border-white/10 text-white/30'
                    }`}
                  >
                    {l.dir}
                  </div>
                ))}
              </div>
              <div className="text-xs">
                <div className="text-white/60">
                  <span className="text-green-400 font-bold">{state.lanes[state.activePhaseIdx].dir}</span> active
                </div>
                <div className="text-white/30 text-[10px] font-mono">
                  {state.lanes[state.activePhaseIdx].phaseRemaining.toFixed(1)}s remaining
                </div>
              </div>
            </div>
          </div>

          {/* Skip event log */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3 pb-1 flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-white/40 tracking-widest uppercase">
                Skip Events
              </h3>
              <Badge variant="outline" className="border-violet-500/30 text-violet-400 text-[9px]">
                {state.skipEvents.length}
              </Badge>
            </div>
            <ScrollArea className="flex-1 px-3 pb-3">
              {state.skipEvents.length === 0 ? (
                <div className="text-center text-white/20 text-xs py-8">
                  {psiEnabled ? 'No phases skipped yet…' : 'PSI is disabled'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {state.skipEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="p-2 rounded bg-violet-600/5 border border-violet-500/10"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-violet-300">
                          {ev.lane} skipped
                        </span>
                        <span className="text-[9px] text-white/30 font-mono">
                          {ev.time.toFixed(1)}s
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-white/40">{ev.reason}</span>
                        <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-[8px] px-1 py-0">
                          -{ev.saved}s
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Small metric card ─── */
const metricStyles: Record<string, string> = {
  blue: 'bg-blue-600/5 border-blue-500/10',
  violet: 'bg-violet-600/5 border-violet-500/10',
  green: 'bg-green-600/5 border-green-500/10',
  amber: 'bg-amber-600/5 border-amber-500/10',
  red: 'bg-red-600/5 border-red-500/10',
};

function MetricCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <div className={`p-2 rounded ${metricStyles[color] ?? metricStyles.blue}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-[9px] text-white/40">{label}</span>
      </div>
      <span className="text-sm font-bold text-white/80">{value}</span>
    </div>
  );
}

export default PhaseSkippingPage;
