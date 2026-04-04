import { useRef, useEffect, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, RotateCcw, Construction,
  ChevronUp, ChevronDown, AlertTriangle, Navigation,
  BarChart3, Car, Timer, Route, Info, Zap, ShieldAlert,
} from 'lucide-react';
import { useDisruptionReroute } from '@/hooks/useDisruptionReroute';
import {
  CANVAS_W, CANVAS_H, CX, CY,
  ROAD_W, BYPASS_W, VERT_ROAD_W, V_LEN, V_HEI,
  PATH_A, PATH_B, PATH_VN, FORK_IDX, pathTransform, pathOf,
} from '@/hooks/useDisruptionReroute';
import type { RerouteState, Point, Vehicle } from '@/hooks/useDisruptionReroute';

/* ═══════════════════════════════════════════════════════
   Drawing helpers
   ═══════════════════════════════════════════════════════ */

function strokePath(ctx: CanvasRenderingContext2D, pts: Point[], startIdx = 0, step = 3) {
  ctx.beginPath();
  ctx.moveTo(pts[startIdx].x, pts[startIdx].y);
  for (let i = startIdx + step; i < pts.length; i += step) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
}

function edgeLine(ctx: CanvasRenderingContext2D, pts: Point[], offset: number, startIdx = 0, step = 5) {
  ctx.beginPath();
  for (let i = startIdx; i < pts.length; i += step) {
    const t = pathTransform(pts, i, offset);
    if (i === startIdx) ctx.moveTo(t.x, t.y); else ctx.lineTo(t.x, t.y);
  }
  const last = pathTransform(pts, pts.length - 1, offset);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function dashLine(ctx: CanvasRenderingContext2D, pts: Point[], startIdx = 0, step = 3, color: string, alpha: number, width = 1.5, dash = [12, 10]) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(pts[startIdx].x, pts[startIdx].y);
  for (let i = startIdx + step; i < pts.length; i += step) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

/* ═══════════════════════════════════════════════════════
   drawScene — clean, non-overlapping road layout
   ═══════════════════════════════════════════════════════ */

function drawScene(ctx: CanvasRenderingContext2D, state: RerouteState) {
  const { vehicles, disruption: dz, stats } = state;
  const w = CANVAS_W, h = CANVAS_H;

  ctx.clearRect(0, 0, w, h);

  /* ── 1. Background ── */
  // Dark gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0e1117');
  bg.addColorStop(0.5, '#121620');
  bg.addColorStop(1, '#0e1117');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle dot grid (not lines — feels more modern)
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let gx = 20; gx < w; gx += 30) {
    for (let gy = 20; gy < h; gy += 30) {
      ctx.beginPath();
      ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Green/teal terrain patches (city blocks)
  ctx.fillStyle = 'rgba(34,197,94,0.025)';
  rr(ctx, 30, 30, 140, 110, 12); ctx.fill();
  rr(ctx, 600, 30, 170, 110, 12); ctx.fill();
  rr(ctx, 30, h - 160, 140, 120, 12); ctx.fill();
  rr(ctx, 600, h - 160, 170, 120, 12); ctx.fill();

  /* ── 2. VERTICAL road (draw first, under horizontal) ── */
  const vx = CX - VERT_ROAD_W / 2;
  const roadTop = CY - ROAD_W / 2;

  // Vertical road surface
  ctx.fillStyle = '#1e2330';
  ctx.fillRect(vx, 0, VERT_ROAD_W, h);
  // Edge lines
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, roadTop); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx + VERT_ROAD_W, 0); ctx.lineTo(vx + VERT_ROAD_W, roadTop); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx, roadTop + ROAD_W); ctx.lineTo(vx, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx + VERT_ROAD_W, roadTop + ROAD_W); ctx.lineTo(vx + VERT_ROAD_W, h); ctx.stroke();
  // Centre dash
  dashLine(ctx, PATH_VN.filter(p => p.y < roadTop - 2 || p.y > roadTop + ROAD_W + 2), 0, 3, 'rgba(255,255,255,0.06)', 1, 1, [8, 10]);

  /* ── 3. Route A horizontal road ── */
  // Glow
  ctx.fillStyle = 'rgba(59,130,246,0.03)';
  ctx.fillRect(0, roadTop - 6, w, ROAD_W + 12);
  // Surface
  ctx.fillStyle = '#1f2536';
  ctx.fillRect(0, roadTop, w, ROAD_W);
  // White edge lines
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, roadTop); ctx.lineTo(w, roadTop); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, roadTop + ROAD_W); ctx.lineTo(w, roadTop + ROAD_W); ctx.stroke();
  // Yellow centre dash
  ctx.save();
  ctx.setLineDash([18, 14]);
  ctx.strokeStyle = 'rgba(251,191,36,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, CY); ctx.lineTo(w, CY); ctx.stroke();
  ctx.restore();

  // Intersection box — draw on top of both roads
  ctx.fillStyle = '#222840';
  ctx.fillRect(vx, roadTop, VERT_ROAD_W, ROAD_W);
  // Cross-hatch pattern inside intersection
  ctx.save();
  ctx.beginPath(); ctx.rect(vx, roadTop, VERT_ROAD_W, ROAD_W); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let d = -ROAD_W; d < VERT_ROAD_W + ROAD_W; d += 10) {
    ctx.beginPath(); ctx.moveTo(vx + d, roadTop); ctx.lineTo(vx + d + ROAD_W, roadTop + ROAD_W); ctx.stroke();
  }
  ctx.restore();

  // Route A label
  ctx.fillStyle = 'rgba(59,130,246,0.5)';
  ctx.font = 'bold 10px "SF Mono", "Fira Code", monospace';
  ctx.fillText('ROUTE A  →', 14, roadTop - 10);

  /* ── 4. Route B bypass road (drawn from fork point ONLY) ── */
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer glow
  ctx.strokeStyle = 'rgba(139,92,246,0.05)';
  ctx.lineWidth = BYPASS_W + 10;
  strokePath(ctx, PATH_B, FORK_IDX);

  // Road surface
  ctx.strokeStyle = '#1c2233';
  ctx.lineWidth = BYPASS_W;
  strokePath(ctx, PATH_B, FORK_IDX);

  // Edge lines
  ctx.strokeStyle = 'rgba(139,92,246,0.14)';
  ctx.lineWidth = 1.2;
  edgeLine(ctx, PATH_B, BYPASS_W / 2, FORK_IDX);
  edgeLine(ctx, PATH_B, -BYPASS_W / 2, FORK_IDX);

  // Centre dash
  dashLine(ctx, PATH_B, FORK_IDX, 4, '#a78bfa', 0.2, 1.5, [10, 10]);

  // Fork junction connector — smooth blend between Route A and B with a filled wedge
  const fPt = PATH_B[FORK_IDX];
  const f2 = PATH_B[Math.min(FORK_IDX + 40, PATH_B.length - 1)];
  ctx.fillStyle = '#1f2536';
  ctx.beginPath();
  ctx.moveTo(fPt.x, CY - ROAD_W / 2);
  ctx.lineTo(fPt.x, CY + ROAD_W / 2);
  ctx.quadraticCurveTo(fPt.x + 30, CY + ROAD_W / 2 + 15, f2.x, f2.y + BYPASS_W / 2);
  ctx.lineTo(f2.x, f2.y - BYPASS_W / 2);
  ctx.quadraticCurveTo(fPt.x + 20, CY - 4, fPt.x, CY - ROAD_W / 2);
  ctx.closePath();
  ctx.fill();

  // Fork arrow indicator
  ctx.fillStyle = 'rgba(139,92,246,0.3)';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('↘', fPt.x + 10, CY + ROAD_W / 2 + 16);
  ctx.textAlign = 'left';

  // Route B label
  ctx.fillStyle = 'rgba(139,92,246,0.45)';
  ctx.font = 'bold 10px "SF Mono", "Fira Code", monospace';
  ctx.fillText('ROUTE B (BYPASS)  ↘', 14, CY + ROAD_W / 2 + 30);

  /* ── 5. Disruption zone ── */
  if (dz.active) {
    const pulse = 0.5 + 0.3 * Math.sin(state.tick * 0.1);
    const dzX = dz.xStart;
    const dzW = dz.xEnd - dz.xStart;
    const dzY = roadTop;
    const dzH = ROAD_W;

    // Dark red overlay
    ctx.fillStyle = `rgba(220,38,38,${0.18 + pulse * 0.1})`;
    ctx.fillRect(dzX, dzY, dzW, dzH);

    // Animated diagonal hazard stripes
    ctx.save();
    ctx.beginPath(); ctx.rect(dzX, dzY, dzW, dzH); ctx.clip();
    const stripeOff = (state.tick * 0.8) % 24;
    ctx.strokeStyle = `rgba(251,191,36,${0.18 + pulse * 0.08})`;
    ctx.lineWidth = 5;
    for (let sx = dzX - dzH - 24 + stripeOff; sx < dzX + dzW + dzH; sx += 24) {
      ctx.beginPath(); ctx.moveTo(sx, dzY); ctx.lineTo(sx + dzH, dzY + dzH); ctx.stroke();
    }
    ctx.restore();

    // Border
    ctx.strokeStyle = `rgba(239,68,68,${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(dzX, dzY, dzW, dzH);
    ctx.setLineDash([]);

    // Barrier line at entry — shows where vehicles stop
    ctx.strokeStyle = `rgba(239,68,68,${0.7 + pulse * 0.25})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dzX, dzY); ctx.lineTo(dzX, dzY + dzH);
    ctx.stroke();

    // Icons / label
    ctx.font = 'bold 12px "SF Mono", "Fira Code", monospace';
    ctx.fillStyle = `rgba(251,191,36,${0.75 + pulse * 0.2})`;
    ctx.textAlign = 'center';
    ctx.fillText('⚠ ' + dz.label + ' ⚠', dzX + dzW / 2, dzY - 8);
    ctx.textAlign = 'left';
  }

  /* ── 6. Vehicles — sorted by Y for depth illusion ── */
  const sorted = [...vehicles].sort((a, b) => a.y - b.y);
  for (const v of sorted) {
    drawVehicle(ctx, v);
  }

  /* ── 7. Rerouting guide arrows ── */
  if (stats.reroutingActive) {
    const ap = 0.5 + 0.5 * Math.sin(state.tick * 0.08);
    // Animated dots flowing along the fork
    ctx.fillStyle = `rgba(34,197,94,${0.4 + ap * 0.4})`;
    const dotStart = FORK_IDX;
    const dotEnd = Math.min(FORK_IDX + 120, PATH_B.length - 1);
    for (let di = dotStart; di < dotEnd; di += 18) {
      const offset = (state.tick * 1.5 + di) % (dotEnd - dotStart);
      const idx = dotStart + offset;
      if (idx < PATH_B.length) {
        const p = PATH_B[Math.floor(idx)];
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  /* ── 8. HUD banners ── */
  if (dz.active) {
    const ba = 0.6 + 0.15 * Math.sin(state.tick * 0.06);
    ctx.fillStyle = `rgba(220,38,38,${ba * 0.9})`;
    rr(ctx, w / 2 - 130, 12, 260, 30, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(239,68,68,0.4)';
    ctx.lineWidth = 1;
    rr(ctx, w / 2 - 130, 12, 260, 30, 6); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "SF Mono", "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠  DISRUPTION DETECTED', w / 2, 32);
    ctx.textAlign = 'left';
  }
  if (stats.reroutingActive) {
    const ba = 0.6 + 0.15 * Math.sin(state.tick * 0.07);
    ctx.fillStyle = `rgba(22,163,74,${ba * 0.9})`;
    rr(ctx, w / 2 - 118, dz.active ? 48 : 12, 236, 26, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(34,197,94,0.3)';
    ctx.lineWidth = 1;
    rr(ctx, w / 2 - 118, dz.active ? 48 : 12, 236, 26, 6); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "SF Mono", "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('↻  REROUTING ACTIVE', w / 2, (dz.active ? 48 : 12) + 18);
    ctx.textAlign = 'left';
  }

  /* ── 9. Legend (bottom-left, compact) ── */
  const lx = 10, ly = h - 82;
  ctx.fillStyle = 'rgba(10,12,20,0.7)';
  rr(ctx, lx, ly, 175, 74, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  rr(ctx, lx, ly, 175, 74, 8); ctx.stroke();
  ctx.font = '9px "SF Mono", "Fira Code", monospace';
  const legend = [
    { color: '#3b82f6', label: 'Route A (Normal)' },
    { color: '#8b5cf6', label: 'Route B (Bypass)' },
    { color: '#22c55e', label: 'Rerouted Vehicle' },
    { color: '#ef4444', label: 'Stuck / Stopped' },
  ];
  legend.forEach((li, i) => {
    ctx.fillStyle = li.color;
    rr(ctx, lx + 10, ly + 10 + i * 16, 10, 6, 2); ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(li.label, lx + 26, ly + 16 + i * 16);
  });
}

/* ── draw one vehicle ── */
function drawVehicle(ctx: CanvasRenderingContext2D, v: Vehicle) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);

  const hw = V_LEN / 2, hh = V_HEI / 2, r = 3;

  // Shadow underneath
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -hw + 1, -hh + 2, V_LEN, V_HEI, r); ctx.fill();

  // Body glow
  ctx.shadowColor = v.color;
  ctx.shadowBlur = v.stuck ? 10 : 4;

  // Main body
  ctx.fillStyle = v.color;
  rr(ctx, -hw, -hh, V_LEN, V_HEI, r); ctx.fill();

  ctx.shadowBlur = 0;

  // Roof / cabin (darker shade)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  rr(ctx, -hw + 4, -hh + 2, V_LEN - 10, V_HEI - 4, 2); ctx.fill();

  // Windshield
  ctx.fillStyle = 'rgba(180,220,255,0.25)';
  ctx.fillRect(hw - 5, -hh + 2, 4, V_HEI - 4);

  // Headlights
  ctx.fillStyle = 'rgba(255,255,200,0.9)';
  ctx.beginPath(); ctx.arc(hw - 1, -hh + 2.5, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hw - 1, hh - 2.5, 1.4, 0, Math.PI * 2); ctx.fill();

  // Tail-lights
  ctx.fillStyle = 'rgba(255,40,40,0.8)';
  ctx.beginPath(); ctx.arc(-hw + 1, -hh + 2.5, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-hw + 1, hh - 2.5, 1.2, 0, Math.PI * 2); ctx.fill();

  // Speed indicator — brake lights brighter when stopped
  if (v.speed < 0.3) {
    ctx.fillStyle = 'rgba(255,40,40,0.6)';
    ctx.fillRect(-hw, -hh + 1, 2, V_HEI - 2);
  }

  ctx.restore();
}

/* ═══════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════ */

const DISRUPTION_OPTIONS = [
  'CONSTRUCTION ZONE',
  'PROCESSION / RALLY',
  'ROAD BLOCKED',
  'ACCIDENT SITE',
  'WATERLOGGING',
];

const DisruptionReroutePage = () => {
  const { state, start, stop, reset, toggleDisruption, setDensity, setDisruptionLabel } = useDisruptionReroute();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [showInfo, setShowInfo] = useState(false);

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

  const { stats, disruption } = state;
  const congestionPct = Math.min(100, Math.round((stats.congestionScore / stats.congestionThreshold) * 100));

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
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/20">
                <Construction className="h-4.5 w-4.5 text-orange-400" />
              </div>
              <div>
                <h1 className="text-[13px] font-semibold tracking-tight">Disruption Detection &amp; Smart Rerouting</h1>
                <p className="text-[10px] text-white/30 font-mono tracking-wider">VISUAL TRAFFIC SIMULATION</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state.running && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-mono text-green-400">LIVE</span>
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
        <div className="border-b border-white/[0.06] bg-gradient-to-b from-orange-500/[0.03] to-transparent">
          <div className="max-w-[1400px] mx-auto px-5 py-4">
            <h3 className="text-xs font-bold text-orange-400 mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> How It Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { step: '1', title: 'Observe', desc: 'Press Play — vehicles flow eastward on Route A. Cross-traffic runs on the vertical road.' },
                { step: '2', title: 'Disrupt', desc: 'Toggle Disruption — a blocked zone appears. Vehicles slow, stop, and queue up (turn red/amber).' },
                { step: '3', title: 'Reroute', desc: 'Once congestion exceeds the threshold, new vehicles are automatically diverted to Route B bypass (green).' },
              ].map(s => (
                <div key={s.step} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">{s.step}</span>
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
              {!state.running ? (
                <button onClick={start}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-sm font-semibold shadow-lg shadow-green-500/20 transition-all active:scale-95">
                  <Play className="h-4 w-4" /> Play
                </button>
              ) : (
                <button onClick={stop}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-sm font-semibold shadow-lg shadow-amber-500/20 transition-all active:scale-95">
                  <Pause className="h-4 w-4" /> Pause
                </button>
              )}

              <button onClick={reset}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm transition-colors active:scale-95">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>

              <div className="w-px h-7 bg-white/[0.06] mx-0.5" />

              {/* Disruption toggle */}
              <button onClick={toggleDisruption}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border active:scale-95 ${
                  disruption.active
                    ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25 shadow-lg shadow-red-500/10'
                    : 'bg-white/[0.06] border-white/[0.06] text-white/70 hover:bg-white/[0.1]'
                }`}>
                <AlertTriangle className="h-3.5 w-3.5" />
                {disruption.active ? 'Disruption ON' : 'Toggle Disruption'}
              </button>

              <div className="w-px h-7 bg-white/[0.06] mx-0.5" />

              {/* Density controls */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <span className="text-[9px] text-white/30 font-mono tracking-wider">DENSITY</span>
                <button onClick={() => setDensity(stats.trafficDensity - 1)} disabled={stats.trafficDensity <= 1}
                  className="p-1 rounded hover:bg-white/[0.1] disabled:opacity-20 transition">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-mono font-bold w-4 text-center text-white/80">{stats.trafficDensity}</span>
                <button onClick={() => setDensity(stats.trafficDensity + 1)} disabled={stats.trafficDensity >= 3}
                  className="p-1 rounded hover:bg-white/[0.1] disabled:opacity-20 transition">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Disruption type selector */}
          <div className="flex flex-wrap gap-1.5">
            {DISRUPTION_OPTIONS.map(opt => (
              <button key={opt} onClick={() => setDisruptionLabel(opt)}
                className={`text-[10px] font-mono px-3 py-1.5 rounded-lg border transition-all ${
                  disruption.label === opt
                    ? 'bg-orange-500/15 border-orange-500/30 text-orange-300 shadow-sm shadow-orange-500/10'
                    : 'bg-white/[0.02] border-white/[0.05] text-white/35 hover:bg-white/[0.06] hover:text-white/50'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* ══════ RIGHT — Dashboard Sidebar ══════ */}
        <div className="w-full lg:w-[280px] flex-shrink-0 space-y-3">

          {/* System Status */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3">SYSTEM STATUS</h3>

            <StatusPill
              active={stats.disruptionActive}
              activeColor="red"
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
              label={stats.disruptionActive ? `DISRUPTION — ${disruption.label}` : 'No Disruption'}
            />
            <StatusPill
              active={stats.reroutingActive}
              activeColor="green"
              icon={<Navigation className="h-3.5 w-3.5" />}
              label={stats.reroutingActive ? 'REROUTING ACTIVE' : 'Rerouting Standby'}
            />
          </div>

          {/* Congestion Meter */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3 flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3" /> CONGESTION
            </h3>
            <div className="relative w-full h-4 rounded-full bg-white/[0.04] overflow-hidden mb-2 border border-white/[0.04]">
              <div className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${congestionPct}%`,
                  background: congestionPct < 45 ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                    : congestionPct < 75 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #ef4444, #f87171)',
                }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-bold font-mono text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {stats.congestionScore} / {stats.congestionThreshold}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-white/25 font-mono">
              {congestionPct >= 100 ? '🔴 Exceeded — rerouting!' : congestionPct >= 60 ? '🟡 Building...' : '🟢 Normal'}
            </p>
          </div>

          {/* Live Metrics */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4 space-y-2.5">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3" /> LIVE METRICS
            </h3>
            <MetricRow icon={Car} label="Total Vehicles" value={stats.totalVehicles} color="text-blue-400" />
            <MetricRow icon={AlertTriangle} label="Stuck / Affected" value={stats.vehiclesAffected} color="text-red-400" />
            <MetricRow icon={Route} label="Vehicles Rerouted" value={stats.vehiclesRerouted} color="text-green-400" />
            <MetricRow icon={Timer} label="Avg Wait" value={`${stats.avgWaitTime}t`} color="text-amber-400" />

            <div className="pt-2.5 mt-1 border-t border-white/[0.04] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-white/30">Density</span>
                <span className="text-white/60">{'●'.repeat(stats.trafficDensity)}{'○'.repeat(3 - stats.trafficDensity)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-white/30">Tick</span>
                <span className="text-white/60">{state.tick}</span>
              </div>
            </div>
          </div>

          {/* Demo Flow Guide */}
          <div className="rounded-xl border border-white/[0.06] bg-[#111522]/80 backdrop-blur-sm p-4">
            <h3 className="text-[10px] font-bold font-mono text-white/40 tracking-widest mb-3">DEMO FLOW</h3>
            <div className="space-y-2">
              <FlowStep n={1} done={state.running} active={state.running && !stats.disruptionActive} label="Start traffic flow" />
              <FlowStep n={2} done={stats.disruptionActive} active={stats.disruptionActive && !stats.reroutingActive} label="Activate disruption" />
              <FlowStep n={3} done={stats.congestionScore > 5} active={stats.disruptionActive && stats.congestionScore > 5 && !stats.reroutingActive} label="Congestion builds" />
              <FlowStep n={4} done={stats.reroutingActive} active={stats.reroutingActive} label="Rerouting activates" />
              <FlowStep n={5} done={stats.vehiclesRerouted > 3} active={stats.reroutingActive && stats.vehiclesRerouted > 3} label="Bypass in use" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════ */

function StatusPill({ active, activeColor, icon, label }: { active: boolean; activeColor: string; icon: React.ReactNode; label: string }) {
  const colors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    red:   { bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400', dot: 'bg-red-500' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/25', text: 'text-green-400', dot: 'bg-green-500' },
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

export default DisruptionReroutePage;
