import React from 'react';
import type { SimulationState } from '@/types/simulation';
import { JUNCTION_XS, CANVAS_W } from '@/types/simulation';

interface Props {
  state: SimulationState;
}

const MAP_W = 220;
const MAP_H = 120;
const PADDING = 16;
const ROUTE_Y = 65;

// City block positions for visual context
const BLOCKS = [
  { x: 20, y: 15, w: 35, h: 25 },
  { x: 65, y: 12, w: 28, h: 30 },
  { x: 130, y: 10, w: 40, h: 28 },
  { x: 180, y: 18, w: 25, h: 22 },
  { x: 20, y: 80, w: 30, h: 28 },
  { x: 60, y: 85, w: 38, h: 22 },
  { x: 115, y: 78, w: 32, h: 30 },
  { x: 160, y: 82, w: 42, h: 25 },
];

export const MiniMap: React.FC<Props> = ({ state }) => {
  const { ambulances, phase, junctions } = state;
  const isActive = phase !== 'idle' && phase !== 'done';

  // Get primary ambulance for minimap display
  const primaryAmbulance = ambulances.find(a => a.active) || ambulances[0];

  // Map ambulance x from simulation canvas to minimap
  const ambMapX = PADDING + ((primaryAmbulance.x + 60) / (CANVAS_W + 120)) * (MAP_W - PADDING * 2);
  const jMapXs = JUNCTION_XS.map(jx => PADDING + ((jx + 60) / (CANVAS_W + 120)) * (MAP_W - PADDING * 2));

  return (
    <div className="absolute top-3 right-3 z-10">
      <svg width={MAP_W} height={MAP_H} className="rounded-lg overflow-hidden" style={{ filter: 'drop-shadow(0 2px 8px hsla(0,0%,0%,0.5))' }}>
        {/* Background */}
        <rect width={MAP_W} height={MAP_H} rx={8} fill="hsl(222, 47%, 8%)" stroke="hsl(222, 30%, 20%)" strokeWidth={1} />

        {/* City blocks */}
        {BLOCKS.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill="hsl(222, 25%, 12%)" stroke="hsl(222, 30%, 18%)" strokeWidth={0.5} />
        ))}

        {/* Side streets */}
        {jMapXs.map((jx, i) => (
          <React.Fragment key={`st-${i}`}>
            <line x1={jx} y1={10} x2={jx} y2={ROUTE_Y - 6} stroke="hsl(222, 20%, 18%)" strokeWidth={3} />
            <line x1={jx} y1={ROUTE_Y + 6} x2={jx} y2={MAP_H - 10} stroke="hsl(222, 20%, 18%)" strokeWidth={3} />
          </React.Fragment>
        ))}

        {/* Main route line (background) */}
        <line x1={PADDING} y1={ROUTE_Y} x2={MAP_W - PADDING} y2={ROUTE_Y} stroke="hsl(222, 20%, 18%)" strokeWidth={6} strokeLinecap="round" />

        {/* Route progress (cleared portion) */}
        {isActive && (
          <line
            x1={PADDING}
            y1={ROUTE_Y}
            x2={Math.max(PADDING, Math.min(ambMapX, MAP_W - PADDING))}
            y2={ROUTE_Y}
            stroke="hsl(142, 70%, 45%)"
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.7}
          />
        )}

        {/* Upcoming route (to clear) */}
        {isActive && (phase === 'clearing' || phase === 'passage') && (
          <line
            x1={Math.max(PADDING, ambMapX)}
            y1={ROUTE_Y}
            x2={MAP_W - PADDING}
            y2={ROUTE_Y}
            stroke="hsl(0, 85%, 55%)"
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.3}
          >
            <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1.5s" repeatCount="indefinite" />
          </line>
        )}

        {/* Junction dots */}
        {jMapXs.map((jx, i) => (
          <React.Fragment key={`jd-${i}`}>
            {/* Glow ring for prepared junctions */}
            {junctions[i].prepared && (
              <circle cx={jx} cy={ROUTE_Y} r={8} fill="none" stroke="hsl(142, 70%, 45%)" strokeWidth={1.5} opacity={0.5}>
                <animate attributeName="r" values="8;11;8" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0.15;0.5" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={jx} cy={ROUTE_Y} r={5}
              fill={junctions[i].prepared ? 'hsl(142, 70%, 45%)' : junctions[i].cascadeActive ? 'hsl(45, 100%, 55%)' : 'hsl(222, 30%, 30%)'}
              stroke="hsl(222, 47%, 6%)" strokeWidth={1.5}
            />
            <text x={jx} y={ROUTE_Y + 15} textAnchor="middle" fill="hsl(215, 20%, 50%)" fontSize={7} fontFamily="monospace">
              J{i + 1}
            </text>
          </React.Fragment>
        ))}

        {/* Ambulance indicator */}
        {isActive && (
          <g>
            <circle cx={ambMapX} cy={ROUTE_Y} r={4} fill="hsl(0, 85%, 55%)">
              <animate attributeName="r" values="3;5;3" dur="0.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={ambMapX} cy={ROUTE_Y} r={9} fill="none" stroke="hsl(0, 85%, 55%)" strokeWidth={1} opacity={0.4}>
              <animate attributeName="r" values="6;12;6" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5" dur="1s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* Labels */}
        <text x={PADDING} y={MAP_H - 4} fill="hsl(187, 100%, 50%)" fontSize={7} fontFamily="monospace" fontWeight="bold" opacity={0.7}>
          ROUTE MAP
        </text>
        <text x={PADDING} y={ROUTE_Y - 12} fill="hsl(215, 20%, 45%)" fontSize={6} fontFamily="monospace">START</text>
        <text x={MAP_W - PADDING} y={ROUTE_Y - 12} textAnchor="end" fill="hsl(215, 20%, 45%)" fontSize={6} fontFamily="monospace">END</text>
      </svg>
    </div>
  );
};
