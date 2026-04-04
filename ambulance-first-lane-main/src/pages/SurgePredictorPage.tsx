import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Zap, Clock, AlertTriangle, TrendingUp, Ambulance,
  TrafficCone, Timer, Gauge, ShieldCheck, Leaf,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimulation } from '@/hooks/useSimulation';
import { TECH_PARK_SURGE_TIMES, SURGE_DETECTION_WINDOW, SURGE_ACTIVE_WINDOW } from '@/types/simulation';
import { SurgeTrafficViz } from '@/components/simulation/SurgeTrafficViz';

/* ───── helpers ───── */
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = Math.floor(m % 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/* Which zone does a given minute-of-day fall in? */
function getZone(m: number): 'normal' | 'pre-surge' | 'surge' {
  for (const s of TECH_PARK_SURGE_TIMES) {
    const sMin = s.hour * 60 + s.minute;
    if (m >= sMin - SURGE_DETECTION_WINDOW && m < sMin) return 'pre-surge';
    if (m >= sMin && m <= sMin + SURGE_ACTIVE_WINDOW) return 'surge';
  }
  return 'normal';
}

/* ───── component ───── */
const SurgePredictorPage = () => {
  const {
    state, start, pause, resume, reset,
    setSpeed, setLanguage, toggleHeatmap, toggleInstructions,
    setMockTime, getClosestSurgeName,
  } = useSimulation();

  const [sliderValue, setSliderValue] = useState(6 * 60 + 15); // default 6:15 PM
  const [ambulanceTriggered, setAmbulanceTriggered] = useState(false);

  /* derived values */
  const zone = useMemo(() => getZone(sliderValue), [sliderValue]);
  const closestSurge = getClosestSurgeName(sliderValue);
  const etaTrigger = zone === 'surge' ? 90 : zone === 'pre-surge' ? 75 : 60;
  const greenExtension = zone === 'normal' ? 0 : 40;
  const congestionIndex = zone === 'surge' ? 87 : zone === 'pre-surge' ? 52 : 28;

  /* handlers */
  const handleSlider = (val: number) => {
    setSliderValue(val);
    setMockTime(val);
    setAmbulanceTriggered(false);
  };

  const triggerAmbulance = () => {
    setAmbulanceTriggered(true);
    // also start the canvas simulation for visual impact
    if (state.phase === 'idle' || state.phase === 'done') {
      start();
    }
  };

  /* ───── 24-hour heatmap ───── */
  const heatmapBars = useMemo(() => {
    const bars: { minute: number; zone: 'normal' | 'pre-surge' | 'surge' }[] = [];
    for (let m = 0; m < 1440; m += 6) bars.push({ minute: m, zone: getZone(m) });
    return bars;
  }, []);

  /* ───── junction gauges ───── */
  const junctions = [
    { name: 'Electronic City Junction', defaultGreen: 45, surgeGreen: 63 },
    { name: 'Silk Board Junction', defaultGreen: 40, surgeGreen: 56 },
    { name: 'Marathahalli Junction', defaultGreen: 38, surgeGreen: 53 },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Navigation */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <h1 className="font-semibold">Tech Park Surge Predictor</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground font-mono">
              Feature: Predictive Traffic Optimization
            </div>
          </div>
        </div>
      </div>

      {/* ──── Main Dashboard ──── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

          {/* ── Section 1: Mock Clock + Status Banner ── */}
          <div className={`rounded-2xl border-2 p-6 transition-all duration-700 ${
            zone === 'surge' ? 'border-red-500/60 bg-gradient-to-r from-red-600/10 via-card to-red-600/5' :
            zone === 'pre-surge' ? 'border-amber-500/60 bg-gradient-to-r from-amber-600/10 via-card to-amber-600/5' :
            'border-border bg-card'
          }`}>
            {/* Banner */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  zone === 'surge' ? 'bg-red-600/15' :
                  zone === 'pre-surge' ? 'bg-amber-600/15' : 'bg-muted'
                }`}>
                  {zone === 'surge' ? <AlertTriangle className="h-6 w-6 text-red-600 animate-pulse" /> :
                   zone === 'pre-surge' ? <Clock className="h-6 w-6 text-amber-600" /> :
                   <Clock className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    zone === 'surge' ? 'text-red-600' :
                    zone === 'pre-surge' ? 'text-amber-600' : 'text-foreground'
                  }`}>
                    {zone === 'surge' ? '⚠ SURGE ACTIVE — ' + closestSurge :
                     zone === 'pre-surge' ? '🟡 PRE-SURGE MODE — ' + closestSurge + ' approaching' :
                     '✅ Normal Operations'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {zone === 'surge' ? 'System operating under worst-case scenario. All outbound signals extended.' :
                     zone === 'pre-surge' ? 'Signal timings pre-optimized. Green extended 40% on outbound roads.' :
                     'Standby mode — monitoring for next surge window.'}
                  </p>
                </div>
              </div>
              {/* Large clock display */}
              <div className="text-right">
                <div className={`text-4xl font-mono font-black tabular-nums tracking-tight ${
                  zone === 'surge' ? 'text-red-600' :
                  zone === 'pre-surge' ? 'text-amber-600' : 'text-foreground'
                }`}>
                  {minutesToTime(sliderValue)}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono tracking-widest mt-0.5">
                  SIMULATED TIME
                </div>
              </div>
            </div>

            {/* Time Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>12:00 AM</span>
                <span>6:00 AM</span>
                <span>12:00 PM</span>
                <span>6:00 PM</span>
                <span>11:59 PM</span>
              </div>
              <input
                type="range"
                min={0}
                max={1439}
                value={sliderValue}
                onChange={e => handleSlider(Number(e.target.value))}
                className={`w-full h-3 rounded-full appearance-none cursor-pointer transition-all ${
                  zone === 'surge' ? 'accent-red-600' :
                  zone === 'pre-surge' ? 'accent-amber-500' : 'accent-blue-500'
                }`}
                style={{
                  background: `linear-gradient(to right, ${
                    heatmapBars.map((b, i) => {
                      const pct = (i / heatmapBars.length) * 100;
                      const col = b.zone === 'surge' ? '#dc2626' : b.zone === 'pre-surge' ? '#d97706' : '#1e293b20';
                      return `${col} ${pct}%`;
                    }).join(', ')
                  })`,
                }}
              />
              {/* Surge time markers */}
              <div className="relative h-5">
                {TECH_PARK_SURGE_TIMES.map(s => {
                  const pct = ((s.hour * 60 + s.minute) / 1439) * 100;
                  return (
                    <button
                      key={s.name}
                      className="absolute -translate-x-1/2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted border border-border hover:bg-primary/10 transition-colors cursor-pointer"
                      style={{ left: `${pct}%` }}
                      onClick={() => handleSlider(s.hour * 60 + s.minute - 10)}
                      title={`Jump to 10 min before ${s.name}`}
                    >
                      {s.hour > 12 ? s.hour - 12 : s.hour}:{s.minute.toString().padStart(2, '0')}{s.hour >= 12 ? 'p' : 'a'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Section 2: Live Metrics Row ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Minutes until surge */}
            <div className={`p-4 rounded-xl border transition-all duration-500 ${
              state.minutesUntilSurge <= 5 ? 'border-red-500/50 bg-red-50/30' :
              state.minutesUntilSurge <= 10 ? 'border-amber-500/50 bg-amber-50/30' :
              'border-border bg-card'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Timer className={`h-4 w-4 ${
                  state.minutesUntilSurge <= 5 ? 'text-red-600' :
                  state.minutesUntilSurge <= 10 ? 'text-amber-600' : 'text-muted-foreground'
                }`} />
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider">NEXT SURGE</span>
              </div>
              <div className={`text-3xl font-mono font-black tabular-nums ${
                state.minutesUntilSurge <= 5 ? 'text-red-600' :
                state.minutesUntilSurge <= 10 ? 'text-amber-600' : 'text-foreground'
              }`}>
                {Math.ceil(state.minutesUntilSurge)}<span className="text-sm font-normal ml-1">min</span>
              </div>
            </div>

            {/* ETA Trigger */}
            <div className={`p-4 rounded-xl border transition-all duration-500 ${
              ambulanceTriggered && zone !== 'normal' ? 'border-blue-500/50 bg-blue-50/30 ring-2 ring-blue-400/30' : 'border-border bg-card'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="h-4 w-4 text-blue-600" />
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider">ETA TRIGGER</span>
              </div>
              <div className="text-3xl font-mono font-black tabular-nums text-blue-600">
                {etaTrigger}<span className="text-sm font-normal ml-1">sec</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {zone === 'surge' ? '+30s extra prep' : zone === 'pre-surge' ? '+15s extra prep' : 'Standard trigger'}
              </div>
            </div>

            {/* Green Extension */}
            <div className={`p-4 rounded-xl border transition-all duration-500 ${
              greenExtension > 0 ? 'border-green-500/50 bg-green-50/30' : 'border-border bg-card'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <TrafficCone className="h-4 w-4 text-green-600" />
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider">GREEN EXT.</span>
              </div>
              <div className={`text-3xl font-mono font-black tabular-nums ${
                greenExtension > 0 ? 'text-green-600' : 'text-muted-foreground'
              }`}>
                +{greenExtension}<span className="text-sm font-normal ml-1">%</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {greenExtension > 0 ? 'Outbound roads extended' : 'No extension active'}
              </div>
            </div>

            {/* Congestion Index */}
            <div className={`p-4 rounded-xl border transition-all duration-500 ${
              congestionIndex > 70 ? 'border-red-500/50 bg-red-50/30' :
              congestionIndex > 40 ? 'border-amber-500/50 bg-amber-50/30' : 'border-border bg-card'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className={`h-4 w-4 ${
                  congestionIndex > 70 ? 'text-red-600' :
                  congestionIndex > 40 ? 'text-amber-600' : 'text-green-600'
                }`} />
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider">CONGESTION</span>
              </div>
              <div className={`text-3xl font-mono font-black tabular-nums ${
                congestionIndex > 70 ? 'text-red-600' :
                congestionIndex > 40 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {congestionIndex}<span className="text-sm font-normal ml-1">%</span>
              </div>
              <div className="w-full h-2 mt-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    congestionIndex > 70 ? 'bg-red-500' :
                    congestionIndex > 40 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${congestionIndex}%` }}
                />
              </div>
            </div>

            {/* Ambulance Trigger Button */}
            <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <Ambulance className="h-4 w-4 text-red-600" />
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider">AMBULANCE</span>
              </div>
              <Button
                onClick={triggerAmbulance}
                disabled={ambulanceTriggered}
                className={`w-full text-xs font-mono gap-2 transition-all ${
                  ambulanceTriggered
                    ? 'bg-red-600 text-white hover:bg-red-600'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
                size="sm"
              >
                <Ambulance className="h-3.5 w-3.5" />
                {ambulanceTriggered ? 'ACTIVE — Clearing' : 'Simulate Detection'}
              </Button>
              {ambulanceTriggered && (
                <p className="text-[10px] text-red-600 font-mono mt-1.5 animate-pulse">
                  Corridor clearing at T-{etaTrigger}s
                </p>
              )}
            </div>
          </div>

          {/* ── Section 3: Real-Time Traffic Comparison ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <TrafficCone className="h-4 w-4 text-blue-600" />
                Real-Time Traffic Simulation
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground">
                {ambulanceTriggered ? '🚑 Ambulance active — watch the difference' : 'Click "Simulate Detection" above to trigger ambulance'}
              </span>
            </div>
            <SurgeTrafficViz zone={zone} ambulanceActive={ambulanceTriggered} />
          </div>

          {/* ── Section 4: Junction Signal Gauges ── */}
          <div className="grid md:grid-cols-3 gap-4">
            {junctions.map((j) => {
              const currentGreen = zone === 'normal' ? j.defaultGreen : j.surgeGreen;
              const pct = (currentGreen / 80) * 100;
              return (
                <div key={j.name} className={`p-5 rounded-xl border transition-all duration-500 ${
                  zone !== 'normal' ? 'border-green-500/30 bg-gradient-to-b from-green-50/30 to-card' : 'border-border bg-card'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">{j.name}</h3>
                    <div className={`w-3 h-3 rounded-full ${
                      zone === 'surge' ? 'bg-red-500 animate-pulse' :
                      zone === 'pre-surge' ? 'bg-amber-500 animate-pulse' : 'bg-green-500'
                    }`} />
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-mono font-black tabular-nums text-green-600">
                      {currentGreen}s
                    </span>
                    <span className="text-xs text-muted-foreground mb-1">
                      green phase {zone !== 'normal' ? `(was ${j.defaultGreen}s)` : ''}
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {zone !== 'normal' && (
                    <div className="flex items-center gap-1 mt-2">
                      <Zap className="h-3 w-3 text-amber-600" />
                      <span className="text-[10px] text-amber-600 font-mono">
                        +{j.surgeGreen - j.defaultGreen}s outbound extension active
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Section 5: 24-Hour Timeline Heatmap ── */}
          <div className="p-5 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                24-Hour Surge Timeline
              </h3>
              <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/30" /> Normal</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Pre-Surge</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Surge Active</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Current</span>
              </div>
            </div>
            <div className="flex gap-[1px] h-10 rounded-lg overflow-hidden">
              {heatmapBars.map((bar, i) => {
                const isCurrent = Math.abs(bar.minute - sliderValue) < 6;
                return (
                  <button
                    key={i}
                    className={`flex-1 min-w-0 transition-all duration-300 cursor-pointer hover:opacity-80 ${
                      isCurrent ? 'bg-blue-500 scale-y-110' :
                      bar.zone === 'surge' ? 'bg-red-500' :
                      bar.zone === 'pre-surge' ? 'bg-amber-500' : 'bg-green-500/20'
                    }`}
                    onClick={() => handleSlider(bar.minute)}
                    title={minutesToTime(bar.minute)}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground font-mono mt-1">
              <span>12am</span>
              <span>3am</span>
              <span>6am</span>
              <span>9am</span>
              <span>12pm</span>
              <span>3pm</span>
              <span>6pm</span>
              <span>9pm</span>
              <span>12am</span>
            </div>
          </div>

          {/* ── Section 6: How It Works + Demo Script ── */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* How it works */}
            <div className="p-5 rounded-xl border border-border bg-card">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                How Surge Prediction Works
              </h3>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'System monitors clock against known IT shift schedules', color: 'text-blue-600' },
                  { step: '2', text: 'T-10 min: Pre-Surge Mode activates — outbound green extended 40%', color: 'text-amber-600' },
                  { step: '3', text: 'T-0: Surge Window — ETA trigger extends to 90s for ambulances', color: 'text-red-600' },
                  { step: '4', text: 'T+15: Recovery — signals return to normal cycle', color: 'text-green-600' },
                ].map(s => (
                  <div key={s.step} className="flex gap-3 items-start">
                    <div className={`w-6 h-6 rounded-full ${s.color} bg-current/10 flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                      <span className={s.color}>{s.step}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">{s.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Why not ML?</strong> Shift timings are 100% predictable — they don&#39;t drift.
                  A rule engine that&#39;s right 100% of the time beats an ML model that&#39;s 94% accurate. Zero compute cost, zero training data needed.
                </p>
              </div>
            </div>

            {/* Bengaluru context */}
            <div className="p-5 rounded-xl border border-border bg-card">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Leaf className="h-4 w-4 text-green-600" />
                Bengaluru IT Park Intelligence
              </h3>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="font-mono text-xs font-semibold mb-1">Electronic City</div>
                  <div className="text-xs text-muted-foreground">~80,000 employees → Hosur Road surge at 6:30 PM</div>
                  <div className="w-full h-1.5 mt-2 rounded bg-muted overflow-hidden">
                    <div className="h-full rounded bg-red-500" style={{ width: '92%' }} />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="font-mono text-xs font-semibold mb-1">Whitefield / ITPL</div>
                  <div className="text-xs text-muted-foreground">~60,000 employees → Varthur Road surge at 6:30 PM</div>
                  <div className="w-full h-1.5 mt-2 rounded bg-muted overflow-hidden">
                    <div className="h-full rounded bg-amber-500" style={{ width: '78%' }} />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="font-mono text-xs font-semibold mb-1">Manyata Tech Park</div>
                  <div className="text-xs text-muted-foreground">~50,000 employees → Hebbal flyover surge at 6:30 PM</div>
                  <div className="w-full h-1.5 mt-2 rounded bg-muted overflow-hidden">
                    <div className="h-full rounded bg-amber-500" style={{ width: '65%' }} />
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50/30">
                <div className="text-xs text-muted-foreground">
                  <strong className="text-green-600">Impact:</strong> Pre-optimizing signals for just these 3 parks
                  covers <strong>~190,000 commuters</strong> and the arterial roads where <strong>67%</strong> of Bengaluru&#39;s ambulance delays occur.
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 7: Demo Script Quick Reference ── */}
          <div className="p-5 rounded-xl border border-border/50 bg-muted/10">
            <h3 className="font-semibold text-sm mb-3">🎤 Demo Quick Script</h3>
            <div className="grid md:grid-cols-4 gap-3 text-xs text-muted-foreground">
              <div className="p-3 rounded-lg bg-card border border-border/30">
                <div className="font-mono font-bold text-foreground mb-1">Step 1</div>
                Drag slider to 6:15 PM. Say: <em>&quot;Nothing looks wrong yet. But in 10 min, 40,000 engineers finish shift.&quot;</em>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/30">
                <div className="font-mono font-bold text-amber-600 mb-1">Step 2</div>
                Slowly drag to 6:20. Watch banner go amber. Say: <em>&quot;Green just extended 40%. No camera, no sensor — just a timetable.&quot;</em>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/30">
                <div className="font-mono font-bold text-red-600 mb-1">Step 3</div>
                Click Ambulance button. Say: <em>&quot;ETA trigger jumped to 90s. 30 extra seconds of corridor prep, automatically.&quot;</em>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/30">
                <div className="font-mono font-bold text-blue-600 mb-1">Step 4</div>
                Drag across full day. Say: <em>&quot;3 shifts, 7 surge windows, every IT park. Zero ML, zero cloud.&quot;</em>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SurgePredictorPage;
