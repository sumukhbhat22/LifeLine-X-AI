import { useRef, useEffect, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, RotateCcw, Ambulance as AmbulanceIcon,
  ChevronUp, ChevronDown, Info, Zap, ShieldAlert,
  BarChart3, Car, Timer, Navigation, Leaf, MapPin,
  Smartphone, Hospital, AlertTriangle, Eye, EyeOff, Languages,
  Bell, CheckCircle2, ArrowLeftIcon, ArrowRightIcon, Hand, Gauge, Wifi,
  Radio, Send, Users, ShieldCheck, Volume2,
} from 'lucide-react';
import type { DriverNotification } from '@/types/simulation';
import { useSimulation } from '@/hooks/useSimulation';
import {
  type SimulationState,
  CANVAS_W, CANVAS_H, ROAD_Y, ROAD_H, LANE_H,
  JUNCTION_XS, VERT_ROAD_W, AMBULANCE_W, AMBULANCE_H,
  TRANSLATIONS,
  type Language,
} from '@/types/simulation';

/* ═══════════════════════════════════════════════════════
   Drawing helpers
   ═══════════════════════════════════════════════════════ */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

/* ═══════════════════════════════════════════════════════
   drawScene — Canvas 2D rendering of ambulance corridor
   ═══════════════════════════════════════════════════════ */

function drawScene(ctx: CanvasRenderingContext2D, state: SimulationState) {
  const { vehicles, junctions, roadSegments, ambulances, phase, showHeatmap, showInstructions, language, spilloverEvents } = state;
  const t = TRANSLATIONS[language];
  const w = CANVAS_W, h = CANVAS_H;

  ctx.clearRect(0, 0, w, h);

  /* ── 1. Background ── */
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0e1117');
  bg.addColorStop(0.5, '#121620');
  bg.addColorStop(1, '#0e1117');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let gx = 20; gx < w; gx += 30) {
    for (let gy = 20; gy < h; gy += 30) {
      ctx.beginPath();
      ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // City block patches
  ctx.fillStyle = 'rgba(34,197,94,0.025)';
  rr(ctx, 30, 30, 150, 120, 12); ctx.fill();
  rr(ctx, 320, 30, 160, 100, 12); ctx.fill();
  rr(ctx, 630, 30, 150, 110, 12); ctx.fill();
  rr(ctx, 900, 30, 150, 120, 12); ctx.fill();
  rr(ctx, 30, h - 160, 150, 130, 12); ctx.fill();
  rr(ctx, 320, h - 150, 160, 120, 12); ctx.fill();
  rr(ctx, 630, h - 160, 150, 130, 12); ctx.fill();
  rr(ctx, 900, h - 150, 150, 120, 12); ctx.fill();

  /* ── 2. Vertical roads at junctions ── */
  for (let i = 0; i < JUNCTION_XS.length; i++) {
    const jx = JUNCTION_XS[i];
    ctx.fillStyle = 'hsl(222, 20%, 13%)';
    ctx.fillRect(jx - VERT_ROAD_W / 2, 0, VERT_ROAD_W, h);
    ctx.strokeStyle = 'hsl(222, 30%, 20%)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(jx - VERT_ROAD_W / 2, 0, VERT_ROAD_W, h);

    // Vertical lane dividers
    ctx.strokeStyle = 'hsl(45, 100%, 55%)';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(jx, 0); ctx.lineTo(jx, ROAD_Y - LANE_H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(jx, ROAD_Y + LANE_H); ctx.lineTo(jx, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /* ── 3. Main horizontal road ── */
  ctx.fillStyle = 'hsl(222, 20%, 15%)';
  ctx.fillRect(0, ROAD_Y - LANE_H, w, ROAD_H);
  ctx.strokeStyle = 'hsl(222, 30%, 22%)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, ROAD_Y - LANE_H, w, ROAD_H);

  // Lane divider (yellow dashed)
  ctx.strokeStyle = 'hsl(45, 100%, 55%)';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.moveTo(0, ROAD_Y); ctx.lineTo(w, ROAD_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Road edge lines
  ctx.strokeStyle = 'hsl(0, 0%, 40%)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ROAD_Y - LANE_H); ctx.lineTo(w, ROAD_Y - LANE_H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, ROAD_Y + LANE_H); ctx.lineTo(w, ROAD_Y + LANE_H); ctx.stroke();

  /* ── 4. Heatmap overlay ── */
  if (showHeatmap) {
    for (const seg of roadSegments) {
      const c = seg.congestion;
      ctx.fillStyle = c < 0.3 ? 'hsla(142, 70%, 45%, 0.25)' : c < 0.6 ? 'hsla(45, 100%, 55%, 0.3)' : 'hsla(0, 85%, 55%, 0.3)';
      ctx.fillRect(seg.x1, seg.y1, seg.x2 - seg.x1, seg.y2 - seg.y1);
    }
  }

  /* ── 5. Spillover zone highlights ── */
  const activeSpillovers = spilloverEvents.filter(e => !e.resolvedAt);
  for (const zone of state.spilloverZones) {
    const evt = activeSpillovers.find(e => e.junctionIndex === zone.junctionIndex && e.lane === zone.lane);
    if (!evt) continue;
    const laneY = zone.lane === 'top' ? ROAD_Y - LANE_H : ROAD_Y;
    const isCritical = evt.risk === 'critical' || evt.risk === 'high';

    // Critical zone highlight
    ctx.fillStyle = isCritical ? 'hsla(0, 85%, 55%, 0.18)' : 'hsla(45, 100%, 55%, 0.12)';
    ctx.fillRect(zone.criticalStart, laneY, zone.criticalEnd - zone.criticalStart, LANE_H);
    ctx.strokeStyle = isCritical ? 'hsla(0, 85%, 55%, 0.55)' : 'hsla(45, 100%, 55%, 0.4)';
    ctx.lineWidth = isCritical ? 1.5 : 0.5;
    ctx.strokeRect(zone.criticalStart, laneY, zone.criticalEnd - zone.criticalStart, LANE_H);

    // Spillover label
    ctx.fillStyle = isCritical ? 'hsl(0, 85%, 65%)' : 'hsl(45, 100%, 65%)';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      isCritical ? '⚠ SPILLOVER' : '⚡ RISK',
      (zone.criticalStart + zone.criticalEnd) / 2,
      laneY - 4,
    );
  }

  /* ── 6. Junction indicators ── */
  for (let i = 0; i < junctions.length; i++) {
    const j = junctions[i];
    // Junction box
    ctx.strokeStyle = j.prepared ? 'hsl(142, 70%, 45%)' : j.cascadeActive ? 'hsl(45, 100%, 55%)' : 'hsl(222, 30%, 25%)';
    ctx.lineWidth = j.prepared || j.cascadeActive ? 2 : 1;
    rr(ctx, j.x - 30, ROAD_Y - LANE_H - 5, 60, ROAD_H + 10, 4); ctx.stroke();

    // Traffic signal
    ctx.fillStyle = j.signalState === 'green' ? 'hsl(142, 70%, 45%)' : j.signalState === 'yellow' ? 'hsl(45, 100%, 55%)' : 'hsl(0, 85%, 55%)';
    ctx.beginPath();
    ctx.arc(j.x + 25, ROAD_Y - LANE_H - 18, 6, 0, Math.PI * 2);
    ctx.fill();
    // Signal glow
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Junction label
    ctx.fillStyle = 'hsl(200, 100%, 80%)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`J${i + 1} ${j.prepared ? '✓' : ''}`, j.x, ROAD_Y + LANE_H + 25);
  }

  /* ── 7. Corridor highlight ── */
  if ((phase === 'clearing' || phase === 'passage') && ambulances.length > 0) {
    const ax = ambulances[0]?.x || 0;
    ctx.fillStyle = 'hsla(0, 85%, 55%, 0.08)';
    ctx.fillRect(ax, ROAD_Y - LANE_H, Math.max(0, w - ax), LANE_H);
  }

  /* ── 8. Vehicles ── */
  const now = performance.now();
  for (const v of vehicles) {
    const isReacting = v.isBlocker && !v.cleared && !v.isNonCooperative;
    const isStuck = v.isBlocker && v.isNonCooperative;

    // Brake glow for reacting
    if (isReacting) {
      ctx.fillStyle = 'hsla(0, 90%, 55%, 0.6)';
      ctx.beginPath();
      ctx.arc(v.x - v.width / 2 - 2, v.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vehicle body
    ctx.fillStyle = isStuck ? 'hsl(0, 85%, 45%)' : v.cleared ? 'hsl(142, 60%, 40%)' : v.isBlocker ? 'hsl(45, 90%, 50%)' : v.color;
    ctx.globalAlpha = v.cleared ? 0.5 : 0.9;
    rr(ctx, v.x - v.width / 2, v.y - v.height / 2, v.width, v.height, 3);
    ctx.fill();
    if (v.isBlocker) {
      ctx.strokeStyle = 'hsl(0, 0%, 80%)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Direction arrow
    if (isReacting && v.instruction && v.instruction !== 'hold') {
      ctx.fillStyle = 'hsl(187, 100%, 70%)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      const dx = v.instruction === 'moveLeft' ? -v.width / 2 - 6 : v.width / 2 + 6;
      ctx.fillText(v.instruction === 'moveLeft' ? '↑' : '↓', v.x + dx, v.y + 3);
    }

    // Instruction label
    if (showInstructions && v.isBlocker && v.instruction) {
      ctx.fillStyle = v.isNonCooperative ? 'hsl(0, 85%, 65%)' : 'hsl(187, 100%, 70%)';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        v.isNonCooperative ? (t.nonCoop || '⚠ Non-Cooperative') : (t[v.instruction] || v.instruction),
        v.x,
        v.y - v.height / 2 - 6,
      );
    }

    // ── Notification bubble above notified vehicles ──
    const notif = state.driverNotifications.find(n => n.vehicleId === v.id && !n.acknowledged);
    if (notif) {
      const bx = v.x, by = v.y - v.height / 2 - 22;
      // Bubble background
      ctx.fillStyle = 'rgba(59, 130, 246, 0.85)';
      rr(ctx, bx - 22, by - 10, 44, 18, 6); ctx.fill();
      // Bubble pointer
      ctx.beginPath();
      ctx.moveTo(bx - 4, by + 8); ctx.lineTo(bx, by + 14); ctx.lineTo(bx + 4, by + 8);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.85)'; ctx.fill();
      // Phone icon (small rect)
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(bx - 19, by - 6, 7, 10);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.85)';
      ctx.fillRect(bx - 18, by - 5, 5, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(bx - 15.5, by + 2.5, 1, 0, Math.PI * 2); ctx.fill();
      // Instruction text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      const instrText = notif.instruction === 'moveLeft' ? '← LEFT'
        : notif.instruction === 'moveRight' ? 'RIGHT →'
        : notif.instruction === 'hold' ? '⏸ HOLD'
        : '▼ SLOW';
      ctx.fillText(instrText, bx + 4, by + 2);
      // Pulse ring around bubble
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(now / 400));
      ctx.strokeStyle = `rgba(59, 130, 246, ${pulse * 0.5})`;
      ctx.lineWidth = 1;
      rr(ctx, bx - 24, by - 12, 48, 22, 8); ctx.stroke();
    }
  }

  /* ── 9. Ambulances ── */
  for (const amb of ambulances) {
    if (!amb.active || phase === 'idle' || phase === 'normal') continue;
    const ax = amb.x, ay = amb.y;
    const isCrit = amb.priority === 'critical';

    // Siren pulse rings
    const pulseR1 = 25 + 30 * (0.5 + 0.5 * Math.sin(now / 600));
    const pulseA1 = 0.3 * (1 - (pulseR1 - 25) / 30);
    ctx.strokeStyle = isCrit ? 'hsl(0, 85%, 55%)' : 'hsl(45, 100%, 50%)';
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = pulseA1;
    ctx.beginPath(); ctx.arc(ax, ay, pulseR1, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;

    // Headlight beam
    ctx.fillStyle = 'hsla(45, 100%, 80%, 0.06)';
    ctx.beginPath();
    ctx.moveTo(ax + AMBULANCE_W / 2, ay - 3);
    ctx.lineTo(ax + AMBULANCE_W / 2 + 40, ay - 10);
    ctx.lineTo(ax + AMBULANCE_W / 2 + 40, ay + 10);
    ctx.lineTo(ax + AMBULANCE_W / 2, ay + 3);
    ctx.closePath();
    ctx.fill();

    // Body shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, ax - AMBULANCE_W / 2 + 2, ay - AMBULANCE_H / 2 + 2, AMBULANCE_W, AMBULANCE_H, 5); ctx.fill();
    // Main body
    ctx.fillStyle = 'white';
    rr(ctx, ax - AMBULANCE_W / 2, ay - AMBULANCE_H / 2, AMBULANCE_W, AMBULANCE_H, 5); ctx.fill();
    ctx.strokeStyle = isCrit ? 'hsl(0, 85%, 50%)' : 'hsl(45, 100%, 50%)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Red stripe
    const stripeC = isCrit ? 'hsl(0, 85%, 50%)' : 'hsl(45, 100%, 50%)';
    ctx.fillStyle = stripeC;
    rr(ctx, ax - AMBULANCE_W / 2, ay + AMBULANCE_H / 2 - 5, AMBULANCE_W, 5, 2); ctx.fill();

    // Cross symbol
    ctx.fillStyle = stripeC;
    ctx.fillRect(ax - 4, ay - 6, 8, 10);
    ctx.fillRect(ax - 5, ay - 4, 10, 6);
    ctx.fillStyle = 'white';
    ctx.fillRect(ax - 2, ay - 4, 4, 6);
    ctx.fillRect(ax - 3, ay - 3, 6, 4);

    // Siren light (alternating)
    const sirenPhase = Math.sin(now / 175) > 0;
    ctx.fillStyle = sirenPhase ? (isCrit ? 'hsl(0, 85%, 55%)' : 'hsl(45, 100%, 50%)') : 'hsl(220, 100%, 60%)';
    rr(ctx, ax - 6, ay - AMBULANCE_H / 2 - 4, 12, 5, 2.5); ctx.fill();
    // Siren glow
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Headlights
    ctx.fillStyle = 'hsl(45, 100%, 85%)';
    ctx.beginPath(); ctx.arc(ax + AMBULANCE_W / 2 - 2, ay - 3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ax + AMBULANCE_W / 2 - 2, ay + 3, 2, 0, Math.PI * 2); ctx.fill();

    // Priority label
    ctx.fillStyle = isCrit ? 'hsl(0, 85%, 70%)' : 'hsl(45, 100%, 60%)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(isCrit ? '🚑 CRITICAL' : '🚔 AMB-2', ax, ay - AMBULANCE_H / 2 - 12);
    // ETA
    ctx.fillStyle = 'hsl(187, 100%, 70%)';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(`ETA: ${amb.eta.toFixed(1)}s`, ax, ay + AMBULANCE_H / 2 + 14);
  }

  /* ── 10. Heatmap legend ── */
  if (showHeatmap) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'hsl(222, 47%, 9%)';
    rr(ctx, w - 140, h - 50, 130, 40, 6); ctx.fill();
    ctx.strokeStyle = 'hsl(222, 30%, 22%)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'hsl(142, 70%, 45%)'; ctx.fillRect(w - 130, h - 40, 16, 10);
    ctx.fillStyle = 'hsl(200, 100%, 80%)'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
    ctx.fillText('Free', w - 110, h - 31);

    ctx.fillStyle = 'hsl(45, 100%, 55%)'; ctx.fillRect(w - 90, h - 40, 16, 10);
    ctx.fillStyle = 'hsl(200, 100%, 80%)'; ctx.fillText('Med', w - 70, h - 31);

    ctx.fillStyle = 'hsl(0, 85%, 55%)'; ctx.fillRect(w - 50, h - 40, 16, 10);
    ctx.fillStyle = 'hsl(200, 100%, 80%)'; ctx.fillText('High', w - 30, h - 31);

    ctx.fillStyle = 'hsl(215, 20%, 55%)'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
    ctx.fillText('CONGESTION', w - 75, h - 15);
  }

  /* ── 11. Phase indicator ── */
  ctx.fillStyle = 'hsl(187, 100%, 50%)';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  const phaseTxt = phase === 'idle' ? 'READY'
    : phase === 'normal' ? '● MONITORING'
    : phase === 'detection' ? '🔍 AMBULANCE DETECTED'
    : phase === 'clearing' ? '🚨 CORRIDOR CLEARING'
    : phase === 'passage' ? '🚑 AMBULANCE PASSING'
    : phase === 'recovery' ? '✓ RECOVERING' : '✓ COMPLETE';
  ctx.fillText(phaseTxt, 10, 20);
}

/* ═══════════════════════════════════════════════════════
   Page Component — matching DisruptionReroute style
   ═══════════════════════════════════════════════════════ */

const LANGS: { value: Language; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'hi', label: 'हिं' },
  { value: 'kn', label: 'ಕನ್' },
  { value: 'ta', label: 'தமி' },
];

const Simulation = () => {
  const { state, start, pause, resume, reset, setSpeed, setLanguage, toggleHeatmap, toggleInstructions } = useSimulation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [showInfo, setShowInfo] = useState(false);
  const [paused, setPaused] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScene(ctx, state);
    animRef.current = requestAnimationFrame(draw);
  }, [state]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  const isRunning = state.phase !== 'idle' && state.phase !== 'done';
  const activeAmbs = state.ambulances.filter(a => a.active);
  const primaryEta = activeAmbs[0]?.eta ?? 0;
  const safeHospitals = state.hospitalBeds?.length ? state.hospitalBeds : [{ name: 'No data', beds: 0, distance: 0 }];
  const bestHospital = safeHospitals.reduce((b, h) => h.beds > b.beds ? h : b);
  const activeSpillovers = state.spilloverEvents.filter(e => !e.resolvedAt);
  const respondedCount = state.driverNotifications.filter(n => n.acknowledged).length;
  const responseRate = state.driverNotifications.length > 0 ? Math.round((respondedCount / state.driverNotifications.length) * 100) : 0;

  const handlePlayPause = () => {
    if (state.phase === 'idle' || state.phase === 'done') {
      start();
      setPaused(false);
    } else if (paused) {
      resume();
      setPaused(false);
    } else {
      pause();
      setPaused(true);
    }
  };

  const handleReset = () => {
    setPaused(false);
    reset();
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white">
      {/* ── Header ── */}
      <header className="border-b border-white/[0.06] bg-[#0f1219]/95 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
              <ArrowLeft className="h-4.5 w-4.5 text-white/50" />
            </Link>
            <div className="h-8 w-px bg-white/[0.06]" />
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/10 border border-red-500/20">
                <AmbulanceIcon className="h-4.5 w-4.5 text-red-400" />
              </div>
              <div>
                <h1 className="text-[13px] font-semibold tracking-tight">Ambulance Priority System</h1>
                <p className="text-[10px] text-white/30 font-mono tracking-wider">AI SELF-CLEARING SMART CORRIDOR</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && !paused && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-mono text-green-400">LIVE</span>
              </span>
            )}
            {isRunning && primaryEta > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                <Timer className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-mono text-red-400">{Math.ceil(primaryEta)}s ETA</span>
              </span>
            )}
            <button onClick={() => setShowInfo(!showInfo)} className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
              <Info className="h-4 w-4 text-white/40" />
            </button>
          </div>
        </div>
      </header>

      {/* ── How-it-works panel ── */}
      {showInfo && (
        <div className="border-b border-white/[0.06] bg-gradient-to-b from-red-500/[0.03] to-transparent">
          <div className="max-w-[1400px] mx-auto px-5 py-4">
            <h3 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> How It Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { step: '1', title: 'Monitor', desc: 'Press Play — vehicles flow on a multi-junction corridor. Junctions manage signals normally.' },
                { step: '2', title: 'Detect', desc: 'Ambulance detected — the AI identifies the incoming emergency vehicle and its priority level.' },
                { step: '3', title: 'Clear', desc: 'Corridor clearing begins — vehicles receive move-left/right instructions, signals go green, junctions cascade-prepare.' },
                { step: '4', title: 'Pass', desc: 'Ambulance passes through cleared corridor. Driver notifications, spillover detection, and hospital routing all active.' },
              ].map(s => (
                <div key={s.step} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center">{s.step}</span>
                  <div>
                    <p className="text-[11px] font-semibold text-white/80">{s.title}</p>
                    <p className="text-[10px] text-white/40 leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-5 py-5 flex flex-col lg:flex-row gap-5">
        {/* ══════ LEFT — Canvas + Controls ══════ */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Canvas */}
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-[#0e1117] shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/[0.03]">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full block"
              style={{ imageRendering: 'auto', maxHeight: '68vh' }}
            />
          </div>

          {/* Controls bar */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Play / Pause */}
              <button onClick={handlePlayPause}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold shadow-lg transition-all active:scale-95 ${
                  !isRunning || paused
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-green-500/20'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/20'
                }`}>
                {!isRunning || paused ? <><Play className="h-4 w-4" /> Play</> : <><Pause className="h-4 w-4" /> Pause</>}
              </button>

              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm transition-colors active:scale-95">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>

              <div className="w-px h-7 bg-white/[0.06] mx-0.5" />

              {/* Speed control */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <span className="text-[9px] text-white/30 font-mono tracking-wider">SPEED</span>
                <button onClick={() => setSpeed(Math.max(0.5, state.speed - 0.5))} disabled={state.speed <= 0.5}
                  className="p-1 rounded hover:bg-white/[0.1] disabled:opacity-20 transition">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-mono font-bold w-8 text-center text-white/80">{state.speed}×</span>
                <button onClick={() => setSpeed(Math.min(3, state.speed + 0.5))} disabled={state.speed >= 3}
                  className="p-1 rounded hover:bg-white/[0.1] disabled:opacity-20 transition">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="w-px h-7 bg-white/[0.06] mx-0.5" />

              {/* Language selector */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <Languages className="h-3.5 w-3.5 text-white/30" />
                {LANGS.map(l => (
                  <button key={l.value} onClick={() => setLanguage(l.value)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                      state.language === l.value
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'text-white/40 hover:text-white/60'
                    }`}>
                    {l.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-7 bg-white/[0.06] mx-0.5" />

              {/* Heatmap toggle */}
              <button onClick={toggleHeatmap}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono transition-all border ${
                  state.showHeatmap
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                    : 'bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/60'
                }`}>
                {state.showHeatmap ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                Heatmap
              </button>

              {/* Instructions toggle */}
              <button onClick={toggleInstructions}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono transition-all border ${
                  state.showInstructions
                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                    : 'bg-white/[0.03] border-white/[0.05] text-white/40 hover:text-white/60'
                }`}>
                Labels
              </button>
            </div>
          </div>
        </div>

        {/* ══════ RIGHT — Dashboard Sidebar ══════ */}
        <div className="w-full lg:w-[280px] flex-shrink-0 space-y-3">

          {/* System Status */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3">SYSTEM STATUS</h3>
            <StatusPill
              active={state.phase === 'detection' || state.phase === 'clearing' || state.phase === 'passage'}
              activeColor="red"
              icon={<AmbulanceIcon className="h-3.5 w-3.5" />}
              label={state.phase === 'detection' ? 'AMBULANCE DETECTED' : state.phase === 'clearing' ? 'CORRIDOR CLEARING' : state.phase === 'passage' ? 'AMBULANCE PASSING' : state.phase === 'recovery' ? 'RECOVERING' : state.phase === 'done' ? 'COMPLETE' : 'Monitoring'}
            />
            <StatusPill
              active={activeSpillovers.length > 0}
              activeColor="orange"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label={activeSpillovers.length > 0 ? `SPILLOVER — ${activeSpillovers.length} zone(s)` : 'No Spillover'}
            />
            <StatusPill
              active={state.notificationPhase === 'sending' || state.notificationPhase === 'active'}
              activeColor="blue"
              icon={<Smartphone className="h-3.5 w-3.5" />}
              label={state.notificationPhase === 'sending' ? 'SENDING ALERTS' : state.notificationPhase === 'active' ? `ALERTS ACTIVE (${responseRate}% ACK)` : 'Driver Alerts Standby'}
            />
          </div>

          {/* Live Metrics */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4 space-y-2.5">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3" /> LIVE METRICS
            </h3>
            <MetricRow icon={Car} label="Vehicles Cleared" value={state.vehiclesCleared} color="text-blue-400" />
            <MetricRow icon={MapPin} label="Junctions Prepared" value={state.junctionsPrepared} color="text-orange-400" />
            <MetricRow icon={Timer} label="Time Saved" value={`${state.timeSavedSeconds.toFixed(0)}s`} color="text-cyan-400" />
            <MetricRow icon={Leaf} label="CO₂ Saved" value={`${state.co2Saved.toFixed(2)}kg`} color="text-green-400" />
            <MetricRow icon={Smartphone} label="Alerts Sent" value={state.totalAlertsSent} color="text-purple-400" />
            <MetricRow icon={AlertTriangle} label="Breakdowns" value={state.totalBreakdownsDetected} color="text-amber-400" />

            <div className="pt-2.5 mt-1 border-t border-white/[0.04] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-white/30">Speed</span>
                <span className="text-white/60">{state.speed}×</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-white/30">Phase</span>
                <span className="text-white/60 capitalize">{state.phase}</span>
              </div>
            </div>
          </div>

          {/* Hospital Routing */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3 flex items-center gap-1.5">
              <Hospital className="h-3 w-3" /> HOSPITAL ROUTING
            </h3>
            <div className="space-y-2">
              {safeHospitals.map(hosp => (
                <div key={hosp.name}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                    hosp.name === bestHospital.name && hosp.beds > 0
                      ? 'bg-green-500/10 border-green-500/25'
                      : hosp.beds === 0
                        ? 'bg-red-500/5 border-red-500/15'
                        : 'bg-white/[0.02] border-white/[0.04]'
                  }`}>
                  <div>
                    <p className="text-[10px] font-semibold text-white/70">{hosp.name}</p>
                    <p className="text-[9px] text-white/30">{hosp.distance}km away</p>
                  </div>
                  <div className={`text-[11px] font-bold font-mono ${hosp.beds > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {hosp.beds} beds
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spillover Detection */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3 flex items-center gap-1.5">
              <Navigation className="h-3 w-3" /> SPILLOVER DETECTION
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2 text-center">
                <div className="text-[13px] font-bold font-mono text-amber-400">{state.totalSpilloversDetected}</div>
                <div className="text-[8px] text-white/30 font-mono">DETECTED</div>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-2 text-center">
                <div className="text-[13px] font-bold font-mono text-green-400">{state.totalSpilloversPrevented}</div>
                <div className="text-[8px] text-white/30 font-mono">PREVENTED</div>
              </div>
            </div>
            {activeSpillovers.length > 0 ? (
              <div className="space-y-1.5">
                {activeSpillovers.slice(0, 3).map(evt => (
                  <div key={evt.id} className={`flex items-center justify-between p-1.5 rounded border text-[9px] font-mono ${
                    evt.risk === 'critical' || evt.risk === 'high'
                      ? 'bg-red-500/10 border-red-500/25 text-red-400'
                      : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400'
                  }`}>
                    <span>J{evt.junctionIndex + 1} {evt.lane}</span>
                    <span className="uppercase font-bold">{evt.risk}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-white/25 font-mono text-center">No active spillovers</p>
            )}
          </div>

          {/* ══════ DRIVER'S DASHBOARD ══════ */}
          <DriverDashboard
            notifications={state.driverNotifications}
            totalSent={state.totalAlertsSent}
            totalAcknowledged={state.totalAcknowledged}
            notificationPhase={state.notificationPhase}
            ambulanceEta={primaryEta}
            responseRate={responseRate}
            phase={state.phase}
          />

          {/* Demo Flow Guide */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3">DEMO FLOW</h3>
            <div className="space-y-2">
              <FlowStep n={1} done={isRunning || state.phase === 'done'} active={state.phase === 'normal'} label="Traffic flow starts" />
              <FlowStep n={2} done={['detection', 'clearing', 'passage', 'recovery', 'done'].includes(state.phase)} active={state.phase === 'detection'} label="Ambulance detected" />
              <FlowStep n={3} done={['clearing', 'passage', 'recovery', 'done'].includes(state.phase)} active={state.phase === 'clearing'} label="Corridor clearing" />
              <FlowStep n={4} done={['passage', 'recovery', 'done'].includes(state.phase)} active={state.phase === 'passage'} label="Ambulance passage" />
              <FlowStep n={5} done={state.phase === 'done'} active={state.phase === 'recovery'} label="Recovery & stats" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Completion banner ── */}
      {state.phase === 'done' && (
        <div className="max-w-[1400px] mx-auto px-5 pb-5">
          <div className="rounded-xl border border-green-500/20 bg-gradient-to-r from-green-500/[0.06] to-emerald-500/[0.03] p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-500/20 border border-green-500/30">
                  <ShieldAlert className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-green-400">Simulation Complete</h2>
                  <p className="text-[10px] text-white/40 font-mono">All ambulances have passed through the corridor.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ResultStat icon={Timer} label="Time Saved" value={`${state.timeSavedSeconds.toFixed(0)}s`} color="text-cyan-400" />
                <ResultStat icon={Leaf} label="CO₂ Saved" value={`${state.co2Saved.toFixed(2)}kg`} color="text-green-400" />
                <ResultStat icon={Car} label="Cleared" value={`${state.vehiclesCleared}`} color="text-blue-400" />
                <ResultStat icon={MapPin} label="Junctions" value={`${state.junctionsPrepared}`} color="text-orange-400" />
              </div>
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm transition-colors active:scale-95">
                <RotateCcw className="h-3.5 w-3.5" /> Run Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════ */

function StatusPill({ active, activeColor, icon, label }: { active: boolean; activeColor: string; icon: React.ReactNode; label: string }) {
  const colors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    red:    { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400', dot: 'bg-red-500' },
    green:  { bg: 'bg-green-500/10', border: 'border-green-500/25', text: 'text-green-400', dot: 'bg-green-500' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/25', text: 'text-orange-400', dot: 'bg-orange-500' },
    blue:   { bg: 'bg-blue-500/10', border: 'border-blue-500/25', text: 'text-blue-400', dot: 'bg-blue-500' },
  };
  const c = active ? colors[activeColor] : { bg: 'bg-white/[0.02]', border: 'border-white/[0.06]', text: 'text-white/35', dot: 'bg-white/20' };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-2 ${c.bg} border ${c.border} transition-all`}>
      <div className={`w-2 h-2 rounded-full ${c.dot} ${active ? 'animate-pulse' : ''}`} />
      <span className={`${c.text}`}>{icon}</span>
      <span className={`text-[10px] font-mono font-medium ${c.text} truncate`}>{label}</span>
    </div>
  );
}

function MetricRow({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${color} opacity-60`} />
        <span className="text-[10px] text-white/40">{label}</span>
      </div>
      <span className={`text-[13px] font-bold font-mono ${color}`}>{value}</span>
    </div>
  );
}

function FlowStep({ n, done, active, label }: { n: number; done: boolean; active: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2.5 transition-all ${active ? 'opacity-100' : done ? 'opacity-60' : 'opacity-30'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
        active ? 'bg-green-500/20 border-green-500/40 text-green-400' :
        done ? 'bg-white/[0.06] border-white/10 text-white/50' :
        'bg-transparent border-white/10 text-white/25'
      }`}>
        {done && !active ? '✓' : n}
      </div>
      <span className={`text-[10px] font-mono ${active ? 'text-green-400 font-semibold' : 'text-white/40'}`}>{label}</span>
    </div>
  );
}

function ResultStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <Icon className={`h-4 w-4 mx-auto mb-0.5 ${color}`} />
      <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[8px] text-white/30 font-mono">{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Driver's Dashboard — full notification panel
   ═══════════════════════════════════════════════════════ */

const INSTR_CONFIG: Record<DriverNotification['instruction'], {
  icon: typeof ArrowLeftIcon; label: string; color: string; bg: string; border: string; arrow: string;
}> = {
  moveLeft:  { icon: ArrowLeftIcon,  label: 'Move Left',     color: 'text-blue-400',    bg: 'bg-blue-500/20',    border: 'border-blue-500/30', arrow: '←' },
  moveRight: { icon: ArrowRightIcon, label: 'Move Right',    color: 'text-orange-400',  bg: 'bg-orange-500/20',  border: 'border-orange-500/30', arrow: '→' },
  hold:      { icon: Hand,           label: 'Hold Position', color: 'text-yellow-400',  bg: 'bg-yellow-500/20',  border: 'border-yellow-500/30', arrow: '⏸' },
  slow:      { icon: Gauge,          label: 'Slow Down',     color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', arrow: '▼' },
};

function DriverDashboard({
  notifications, totalSent, totalAcknowledged, notificationPhase, ambulanceEta, responseRate, phase,
}: {
  notifications: DriverNotification[];
  totalSent: number;
  totalAcknowledged: number;
  notificationPhase: 'inactive' | 'sending' | 'active' | 'complete';
  ambulanceEta: number;
  responseRate: number;
  phase: string;
}) {
  const activeNotifs = notifications.filter(n => !n.acknowledged);
  const latestNotif = notifications.length > 0 ? notifications[notifications.length - 1] : null;
  const isAlertActive = notificationPhase === 'sending' || notificationPhase === 'active';
  const [phoneFlash, setPhoneFlash] = useState(false);

  // Flash phone on new notification
  useEffect(() => {
    if (latestNotif && !latestNotif.acknowledged) {
      setPhoneFlash(true);
      const t = setTimeout(() => setPhoneFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [latestNotif?.id]);

  // Count by instruction type
  const instrCounts = notifications.reduce((acc, n) => {
    acc[n.instruction] = (acc[n.instruction] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm overflow-hidden">
      {/* Panel header */}
      <div className={`px-4 py-3 border-b transition-all ${
        isAlertActive
          ? 'border-blue-500/25 bg-gradient-to-r from-blue-500/[0.08] to-cyan-500/[0.04]'
          : 'border-white/[0.06] bg-white/[0.01]'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest flex items-center gap-1.5">
            <Smartphone className={`h-3 w-3 ${isAlertActive ? 'text-blue-400' : ''}`} />
            DRIVER'S DASHBOARD
          </h3>
          {isAlertActive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25">
              <Bell className="h-2.5 w-2.5 text-blue-400 animate-pulse" />
              <span className="text-[8px] font-mono text-blue-400 font-bold">LIVE</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Phone Mockup ── */}
      <div className="px-4 pt-4 pb-3 flex justify-center">
        <div className={`w-[160px] rounded-2xl border-2 transition-all duration-300 ${
          phoneFlash ? 'border-blue-400 shadow-lg shadow-blue-500/30' : isAlertActive ? 'border-white/15' : 'border-white/[0.08]'
        } bg-[#0a0d14] p-1.5 relative`}>
          {/* Phone notch */}
          <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mb-1.5" />

          {/* Screen content */}
          <div className="rounded-lg bg-[#0e1218] overflow-hidden">
            {/* Status bar */}
            <div className="flex items-center justify-between px-2 py-1 bg-white/[0.02]">
              <span className="text-[7px] font-mono text-white/30">TrafficAI</span>
              <div className="flex items-center gap-1">
                <Wifi className="h-2 w-2 text-green-400/60" />
                <span className="text-[7px] font-mono text-white/30">●●●</span>
              </div>
            </div>

            {isAlertActive && latestNotif ? (
              <div className="p-2 space-y-1.5">
                {/* Emergency banner */}
                <div className="rounded-lg bg-red-500/15 border border-red-500/25 p-2 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Volume2 className="h-3 w-3 text-red-400 animate-pulse" />
                    <span className="text-[8px] font-bold text-red-400">EMERGENCY</span>
                  </div>
                  <p className="text-[7px] text-white/50">🚑 Ambulance approaching</p>
                  <p className="text-[9px] font-bold font-mono text-red-400 mt-0.5">ETA: {Math.ceil(ambulanceEta)}s</p>
                </div>

                {/* Instruction card */}
                {(() => {
                  const cfg = INSTR_CONFIG[latestNotif.instruction];
                  return (
                    <div className={`rounded-lg ${cfg.bg} border ${cfg.border} p-2`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        <span className={`text-[9px] font-bold ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <div className="flex items-center justify-center py-1.5">
                        <span className={`text-2xl font-bold ${cfg.color}`}>{cfg.arrow}</span>
                      </div>
                      <p className="text-[7px] text-white/40 text-center">{latestNotif.message}</p>
                    </div>
                  );
                })()}

                {/* Distance & acknowledge */}
                <div className="flex items-center justify-between text-[7px] font-mono text-white/30">
                  <span>~{latestNotif.distance}m away</span>
                  <span className={latestNotif.acknowledged ? 'text-green-400' : 'text-blue-400 animate-pulse'}>
                    {latestNotif.acknowledged ? '✓ Acknowledged' : '● Pending...'}
                  </span>
                </div>
              </div>
            ) : notificationPhase === 'complete' ? (
              <div className="p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-green-400 mx-auto mb-1" />
                <p className="text-[8px] font-bold text-green-400">ALL CLEAR</p>
                <p className="text-[7px] text-white/30 mt-0.5">Ambulance has passed</p>
                <p className="text-[7px] text-white/30">Resume normal driving</p>
              </div>
            ) : (
              <div className="p-3 text-center">
                <Radio className="h-5 w-5 text-white/20 mx-auto mb-1" />
                <p className="text-[8px] text-white/30">Monitoring traffic...</p>
                <p className="text-[7px] text-white/20 mt-0.5">No active alerts</p>
              </div>
            )}
          </div>

          {/* Home button */}
          <div className="w-8 h-1 rounded-full bg-white/10 mx-auto mt-1.5" />
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-1.5 text-center">
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <Send className="h-2.5 w-2.5 text-blue-400" />
            </div>
            <div className="text-[12px] font-bold font-mono text-blue-400">{totalSent}</div>
            <div className="text-[7px] text-white/25 font-mono">SENT</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-1.5 text-center">
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <CheckCircle2 className="h-2.5 w-2.5 text-green-400" />
            </div>
            <div className="text-[12px] font-bold font-mono text-green-400">{totalAcknowledged}</div>
            <div className="text-[7px] text-white/25 font-mono">ACK</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-1.5 text-center">
            <div className="flex items-center justify-center gap-0.5 mb-0.5">
              <Users className="h-2.5 w-2.5 text-purple-400" />
            </div>
            <div className="text-[12px] font-bold font-mono text-purple-400">{responseRate}%</div>
            <div className="text-[7px] text-white/25 font-mono">RATE</div>
          </div>
        </div>
      </div>

      {/* ── Response Rate Bar ── */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] text-white/30 font-mono">Driver compliance</span>
          <span className={`text-[9px] font-bold font-mono ${
            responseRate >= 80 ? 'text-green-400' : responseRate >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>{responseRate}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{
            width: `${responseRate}%`,
            background: responseRate >= 80
              ? 'linear-gradient(90deg, #22c55e, #4ade80)'
              : responseRate >= 50
                ? 'linear-gradient(90deg, #eab308, #facc15)'
                : 'linear-gradient(90deg, #ef4444, #f87171)',
          }} />
        </div>
      </div>

      {/* ── Instruction Breakdown ── */}
      {notifications.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[8px] text-white/30 font-mono mb-1.5">Instructions issued</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(['moveLeft', 'moveRight', 'hold', 'slow'] as const).map(instr => {
              const cfg = INSTR_CONFIG[instr];
              const count = instrCounts[instr] || 0;
              if (count === 0) return null;
              return (
                <div key={instr} className={`flex items-center gap-1.5 p-1.5 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                  <cfg.icon className={`h-3 w-3 ${cfg.color}`} />
                  <div>
                    <div className={`text-[9px] font-bold font-mono ${cfg.color}`}>{count}</div>
                    <div className="text-[7px] text-white/25">{cfg.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Live Notification Feed ── */}
      <div className="px-4 pb-3">
        <div className="text-[8px] text-white/30 font-mono mb-1.5 flex items-center gap-1">
          <Bell className="h-2.5 w-2.5" /> Live feed
          {activeNotifs.length > 0 && (
            <span className="ml-auto px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[7px] font-bold">
              {activeNotifs.length} active
            </span>
          )}
        </div>
        <div className="space-y-1 max-h-[140px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin' }}>
          {notifications.length > 0 ? (
            notifications.slice(-8).reverse().map(n => {
              const cfg = INSTR_CONFIG[n.instruction];
              return (
                <div key={n.id} className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all text-[8px] font-mono ${
                  n.acknowledged
                    ? 'bg-white/[0.01] border-white/[0.04] opacity-50'
                    : `${cfg.bg} ${cfg.border}`
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    n.acknowledged ? 'bg-green-500/20' : cfg.bg
                  }`}>
                    {n.acknowledged
                      ? <CheckCircle2 className="h-3 w-3 text-green-400" />
                      : <cfg.icon className={`h-3 w-3 ${cfg.color}`} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`font-bold ${n.acknowledged ? 'text-white/30' : cfg.color}`}>
                        {cfg.arrow} {cfg.label}
                      </span>
                    </div>
                    <div className="text-[7px] text-white/25 truncate">
                      {n.message} • ~{n.distance}m
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {n.acknowledged
                      ? <span className="text-green-400/60 text-[7px]">✓</span>
                      : <span className="text-blue-400 animate-pulse text-[7px]">●</span>
                    }
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-3">
              <Smartphone className="h-4 w-4 text-white/10 mx-auto mb-1" />
              <p className="text-[8px] text-white/20">Waiting for ambulance detection...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Simulation;
