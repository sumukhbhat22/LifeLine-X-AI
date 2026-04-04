import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Animated side-by-side traffic visualisation for the Surge Predictor.
 *
 * LEFT  panel = "Without LifeLine-X+" → no pre-clearing, gridlock during surge
 * RIGHT panel = "With LifeLine-X+"    → signals pre-optimised, corridor clear
 *
 * Everything is driven by two props:
 *   zone:  'normal' | 'pre-surge' | 'surge'
 *   ambulanceActive: boolean
 */

// ─── constants ───
const W = 520;      // half-width (each panel)
const H = 340;
const ROAD_Y = H / 2;
const LANE = 18;
const JX = [120, 260, 400]; // junction x positions
const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6'];

interface Car {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  speed: number;
  dir: number;       // 1 = right, -1 = left
  lane: 'top' | 'bottom';
  cleared: boolean;   // only used on "with" side
  targetY: number;
}

interface Props {
  zone: 'normal' | 'pre-surge' | 'surge';
  ambulanceActive: boolean;
}

// ─── helpers ───
let _id = 0;
function makeCar(forSurge: boolean): Car {
  const lane: 'top' | 'bottom' = Math.random() > 0.5 ? 'top' : 'bottom';
  const y = lane === 'top'
    ? ROAD_Y - LANE / 2 + (Math.random() - 0.5) * 4
    : ROAD_Y + LANE / 2 + (Math.random() - 0.5) * 4;
  const w = 18 + Math.random() * 10;
  return {
    id: ++_id,
    x: Math.random() * W,
    y,
    w,
    h: 10,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    speed: forSurge ? 8 + Math.random() * 20 : 20 + Math.random() * 40,
    dir: lane === 'top' ? 1 : -1,
    lane,
    cleared: false,
    targetY: y,
  };
}

function makeVertCar(): Car {
  const ji = Math.floor(Math.random() * 3);
  const side = Math.random() > 0.5 ? -1 : 1;
  const y = ROAD_Y + side * (LANE + 15 + Math.random() * 40);
  return {
    id: ++_id,
    x: JX[ji] + (Math.random() - 0.5) * 8,
    y,
    w: 10,
    h: 18,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    speed: 10 + Math.random() * 15,
    dir: side,
    lane: 'top',
    cleared: false,
    targetY: y,
  };
}

// ─── component ───
export function SurgeTrafficViz({ zone, ambulanceActive }: Props) {
  // Separate car arrays for each side
  const [leftCars, setLeftCars] = useState<Car[]>([]);
  const [rightCars, setRightCars] = useState<Car[]>([]);
  const [leftVertCars, setLeftVertCars] = useState<Car[]>([]);
  const [rightVertCars, setRightVertCars] = useState<Car[]>([]);
  const [ambX, setAmbX] = useState(-50);
  const [ambXRight, setAmbXRight] = useState(-50);

  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const zoneRef = useRef(zone);
  const ambActiveRef = useRef(ambulanceActive);
  zoneRef.current = zone;
  ambActiveRef.current = ambulanceActive;

  // Initialise cars
  useEffect(() => {
    const base = 14;
    const surge = zone === 'surge' ? 10 : zone === 'pre-surge' ? 5 : 0;
    const n = base + surge;
    const l: Car[] = [], r: Car[] = [];
    for (let i = 0; i < n; i++) {
      l.push(makeCar(zone !== 'normal'));
      r.push(makeCar(zone !== 'normal'));
    }
    const lv: Car[] = [], rv: Car[] = [];
    for (let i = 0; i < 6; i++) { lv.push(makeVertCar()); rv.push(makeVertCar()); }
    setLeftCars(l);
    setRightCars(r);
    setLeftVertCars(lv);
    setRightVertCars(rv);
    setAmbX(-50);
    setAmbXRight(-50);
  }, [zone]);

  // Reset ambulance when triggered
  useEffect(() => {
    if (ambulanceActive) {
      setAmbX(-50);
      setAmbXRight(-50);
    }
  }, [ambulanceActive]);

  // Animation loop
  const animate = useCallback((ts: number) => {
    if (!lastRef.current) lastRef.current = ts;
    const dt = Math.min((ts - lastRef.current) / 1000, 0.05);
    lastRef.current = ts;

    const z = zoneRef.current;
    const amb = ambActiveRef.current;
    const isSurge = z === 'surge';
    const isPreSurge = z === 'pre-surge';

    // LEFT side — no optimisation
    setLeftCars(prev => prev.map(c => {
      const nc = { ...c };
      // During surge left side is super slow (gridlock)
      const speedMul = isSurge ? 0.15 : isPreSurge ? 0.5 : 1;
      // If ambulance active, vehicles barely move on left side (stuck)
      const ambStuck = amb && c.lane === 'top' && c.x > ambX - 30 ? 0.05 : 1;
      nc.x += c.dir * c.speed * dt * speedMul * ambStuck;
      if (nc.x > W + 20) nc.x = -20;
      if (nc.x < -20) nc.x = W + 20;
      return nc;
    }));

    // RIGHT side — with optimisation
    setRightCars(prev => prev.map(c => {
      const nc = { ...c };
      if (amb && !nc.cleared && nc.lane === 'top') {
        // Move blockers out of top lane
        nc.targetY = ROAD_Y + LANE + 15;
        const dy = nc.targetY - nc.y;
        nc.y += dy * Math.min(1, dt * 3);
        if (Math.abs(dy) < 2) nc.cleared = true;
        nc.x += c.dir * c.speed * dt * 0.3;
      } else {
        // Normal flow — right side always smoother
        const speedMul = isSurge ? 0.6 : 1;
        nc.x += c.dir * c.speed * dt * speedMul;
      }
      if (nc.x > W + 20) nc.x = -20;
      if (nc.x < -20) nc.x = W + 20;
      return nc;
    }));

    // Vertical cars (just gentle drift)
    setLeftVertCars(prev => prev.map(c => {
      const nc = { ...c };
      nc.y += c.dir * c.speed * dt * (isSurge ? 0.1 : 0.3);
      return nc;
    }));
    setRightVertCars(prev => prev.map(c => {
      const nc = { ...c };
      nc.y += c.dir * c.speed * dt * 0.3;
      return nc;
    }));

    // Ambulance movement
    if (amb) {
      setAmbX(prev => {
        // LEFT: ambulance barely moves (stuck in gridlock during surge)
        const spd = isSurge ? 25 : isPreSurge ? 40 : 70;
        return Math.min(prev + spd * dt, W + 60);
      });
      setAmbXRight(prev => {
        // RIGHT: ambulance flies through cleared corridor
        const spd = isSurge ? 120 : isPreSurge ? 110 : 100;
        return Math.min(prev + spd * dt, W + 60);
      });
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  // ─── Signal colours per zone ───
  const leftSignals = JX.map(() =>
    zone === 'surge' ? '#ef4444' : zone === 'pre-surge' ? '#f59e0b' : '#22c55e'
  );
  const rightSignals = JX.map(() =>
    zone === 'surge' ? '#22c55e' : '#22c55e' // right side always green (pre-optimised)
  );

  // ─── renderer for one panel ───
  function renderPanel(
    cars: Car[], vertCars: Car[], signals: string[], ambulanceX: number,
    label: string, labelColor: string, withSystem: boolean
  ) {
    const showAmb = ambulanceActive && ambulanceX > -50 && ambulanceX < W + 60;
    // Time indicator for ambulance
    const ambTime = ambulanceActive ? Math.max(0, ((W - ambulanceX) / (withSystem ? 120 : 30))).toFixed(0) : null;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ background: '#0f172a' }}>
        {/* Road surface */}
        <rect x={0} y={ROAD_Y - LANE - 2} width={W} height={LANE * 2 + 4} fill="#1e293b" rx={3} />
        {/* Lane divider */}
        {Array.from({ length: 20 }).map((_, i) => (
          <rect key={i} x={i * 28 + 4} y={ROAD_Y - 1} width={14} height={2}
            fill="#475569" rx={1} />
        ))}

        {/* Vertical roads at junctions */}
        {JX.map((jx, i) => (
          <g key={i}>
            <rect x={jx - 12} y={0} width={24} height={H} fill="#1e293b" opacity={0.6} />
            {/* Signal light */}
            <circle cx={jx + 18} cy={ROAD_Y - LANE - 12} r={5} fill={signals[i]}
              opacity={0.9} />
            {/* Signal glow */}
            <circle cx={jx + 18} cy={ROAD_Y - LANE - 12} r={10}
              fill={signals[i]} opacity={0.15} />
          </g>
        ))}

        {/* Corridor highlight when ambulance active + system */}
        {withSystem && showAmb && (
          <rect x={0} y={ROAD_Y - LANE - 2} width={W} height={LANE + 2}
            fill="#22c55e" opacity={0.08}>
            <animate attributeName="opacity" values="0.05;0.12;0.05" dur="1.5s"
              repeatCount="indefinite" />
          </rect>
        )}

        {/* Gridlock overlay on left during surge */}
        {!withSystem && zone === 'surge' && (
          <rect x={0} y={ROAD_Y - LANE - 2} width={W} height={LANE * 2 + 4}
            fill="#ef4444" opacity={0.06} />
        )}

        {/* Vertical cars */}
        {vertCars.map(c => (
          <rect key={c.id} x={c.x - c.w / 2} y={c.y - c.h / 2}
            width={c.w} height={c.h} rx={2} fill={c.color} opacity={0.6} />
        ))}

        {/* Cars */}
        {cars.map(c => (
          <rect key={c.id} x={c.x - c.w / 2} y={c.y - c.h / 2}
            width={c.w} height={c.h} rx={2}
            fill={c.cleared ? '#22c55e' : c.color}
            opacity={c.cleared ? 0.5 : 0.85} />
        ))}

        {/* Ambulance */}
        {showAmb && (
          <g>
            {/* Siren glow */}
            <ellipse cx={ambulanceX} cy={ROAD_Y - LANE / 2} rx={25} ry={14}
              fill="#ef4444" opacity={0.15}>
              <animate attributeName="opacity" values="0.1;0.25;0.1" dur="0.6s"
                repeatCount="indefinite" />
            </ellipse>
            {/* Body */}
            <rect x={ambulanceX - 20} y={ROAD_Y - LANE / 2 - 7} width={40} height={14}
              rx={3} fill="#ffffff" stroke="#ef4444" strokeWidth={1.5} />
            {/* Cross */}
            <rect x={ambulanceX - 3} y={ROAD_Y - LANE / 2 - 5} width={6} height={10}
              fill="#ef4444" rx={1} />
            <rect x={ambulanceX - 5} y={ROAD_Y - LANE / 2 - 3} width={10} height={6}
              fill="#ef4444" rx={1} />
            {/* Siren light */}
            <circle cx={ambulanceX + 16} cy={ROAD_Y - LANE / 2 - 7} r={3}
              fill="#ef4444">
              <animate attributeName="fill" values="#ef4444;#3b82f6;#ef4444"
                dur="0.4s" repeatCount="indefinite" />
            </circle>
            {/* ETA label */}
            {ambTime && Number(ambTime) > 0 && (
              <text x={ambulanceX} y={ROAD_Y - LANE / 2 - 14}
                textAnchor="middle" fill="white" fontSize={9} fontFamily="monospace"
                fontWeight="bold">
                ETA {ambTime}s
              </text>
            )}
          </g>
        )}

        {/* Label */}
        <rect x={8} y={8} width={withSystem ? 130 : 150} height={22} rx={4}
          fill={withSystem ? '#16a34a' : '#dc2626'} opacity={0.9} />
        <text x={14} y={23} fill="white" fontSize={10} fontFamily="monospace" fontWeight="bold">
          {label}
        </text>

        {/* Zone badge */}
        <rect x={W - 80} y={8} width={72} height={20} rx={4}
          fill={zone === 'surge' ? '#dc2626' : zone === 'pre-surge' ? '#d97706' : '#22c55e'}
          opacity={0.85} />
        <text x={W - 44} y={22} textAnchor="middle" fill="white" fontSize={8}
          fontFamily="monospace" fontWeight="bold">
          {zone === 'surge' ? 'SURGE' : zone === 'pre-surge' ? 'PRE-SURGE' : 'NORMAL'}
        </text>

        {/* Stuck indicator on left side */}
        {!withSystem && ambulanceActive && zone === 'surge' && ambulanceX < W * 0.4 && ambulanceX > 0 && (
          <g>
            <rect x={ambulanceX - 30} y={ROAD_Y - LANE / 2 + 12} width={60} height={16}
              rx={3} fill="#ef4444" opacity={0.9} />
            <text x={ambulanceX} y={ROAD_Y - LANE / 2 + 23} textAnchor="middle"
              fill="white" fontSize={8} fontFamily="monospace" fontWeight="bold">
              ⚠ STUCK
            </text>
          </g>
        )}

        {/* Cleared indicator on right side */}
        {withSystem && ambulanceActive && ambulanceX > 50 && ambulanceX < W - 50 && (
          <g>
            <rect x={ambulanceX + 25} y={ROAD_Y - LANE / 2 + 12} width={70} height={16}
              rx={3} fill="#16a34a" opacity={0.9} />
            <text x={ambulanceX + 60} y={ROAD_Y - LANE / 2 + 23} textAnchor="middle"
              fill="white" fontSize={8} fontFamily="monospace" fontWeight="bold">
              ✓ CLEARED
            </text>
          </g>
        )}

        {/* Passed indicator */}
        {withSystem && ambulanceActive && ambulanceX >= W && (
          <g>
            <rect x={W / 2 - 55} y={H / 2 - 14} width={110} height={28} rx={6}
              fill="#16a34a" opacity={0.9} />
            <text x={W / 2} y={H / 2 + 4} textAnchor="middle"
              fill="white" fontSize={11} fontFamily="monospace" fontWeight="bold">
              ✓ PASSED SAFELY
            </text>
          </g>
        )}
        {!withSystem && ambulanceActive && ambulanceX >= W && (
          <g>
            <rect x={W / 2 - 55} y={H / 2 - 14} width={110} height={28} rx={6}
              fill="#d97706" opacity={0.9} />
            <text x={W / 2} y={H / 2 + 4} textAnchor="middle"
              fill="white" fontSize={11} fontFamily="monospace" fontWeight="bold">
              ⏱ DELAYED +35s
            </text>
          </g>
        )}
      </svg>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="grid grid-cols-2 gap-[2px] bg-border">
        <div className="aspect-[520/340]">
          {renderPanel(leftCars, leftVertCars, leftSignals, ambX,
            '✗ Without System', '#dc2626', false)}
        </div>
        <div className="aspect-[520/340]">
          {renderPanel(rightCars, rightVertCars, rightSignals, ambXRight,
            '✓ With LifeLine-X+ AI', '#16a34a', true)}
        </div>
      </div>
      {/* Bottom comparison bar */}
      {ambulanceActive && (
        <div className="grid grid-cols-2 gap-[2px] bg-border">
          <div className="bg-red-950/30 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-mono text-red-400">Ambulance ETA</span>
            <span className="text-sm font-mono font-bold text-red-400">
              ~{zone === 'surge' ? '95' : zone === 'pre-surge' ? '75' : '60'}s (delayed)
            </span>
          </div>
          <div className="bg-green-950/30 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] font-mono text-green-400">Ambulance ETA</span>
            <span className="text-sm font-mono font-bold text-green-400">
              ~{zone === 'surge' ? '42' : zone === 'pre-surge' ? '38' : '35'}s (optimised)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
