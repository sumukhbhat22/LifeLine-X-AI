import React from 'react';
import {
  type SimulationState,
  TRANSLATIONS,
  CANVAS_W,
  CANVAS_H,
  ROAD_Y,
  ROAD_H,
  LANE_H,
  JUNCTION_XS,
  VERT_ROAD_W,
  AMBULANCE_W,
  AMBULANCE_H,
} from '@/types/simulation';

interface Props {
  state: SimulationState;
}

const congestionColor = (c: number) => {
  if (c < 0.3) return 'hsla(142, 70%, 45%, 0.25)';
  if (c < 0.6) return 'hsla(45, 100%, 55%, 0.3)';
  return 'hsla(0, 85%, 55%, 0.3)';
};

const SimulationCanvasComponent: React.FC<Props> = ({ state }) => {
  const { vehicles, junctions, roadSegments, ambulances, phase, showHeatmap, showInstructions, language, spilloverZones, spilloverEvents } = state;
  const t = TRANSLATIONS[language];

  const getInstructionText = (instruction: string) => {
    return t[instruction] || '';
  };

  // Active (unresolved) spillover events for zone highlighting
  const activeSpillovers = spilloverEvents.filter(e => !e.resolvedAt);
  const getZoneRisk = (ji: number, lane: 'top' | 'bottom') => {
    return activeSpillovers.find(e => e.junctionIndex === ji && e.lane === lane);
  };

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      className="w-full h-full"
      style={{ background: 'hsl(222, 47%, 6%)' }}
    >
      <defs>
        <filter id="ambulance-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="neon-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="cascade-glow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main horizontal road */}
      <rect
        x={0} y={ROAD_Y - LANE_H}
        width={CANVAS_W} height={ROAD_H}
        fill="hsl(222, 20%, 15%)"
        stroke="hsl(222, 30%, 22%)"
        strokeWidth={1}
      />
      {/* Lane divider */}
      <line
        x1={0} y1={ROAD_Y}
        x2={CANVAS_W} y2={ROAD_Y}
        stroke="hsl(45, 100%, 55%)"
        strokeWidth={1.5}
        strokeDasharray="12 8"
        opacity={0.6}
      />
      {/* Road edge lines */}
      <line x1={0} y1={ROAD_Y - LANE_H} x2={CANVAS_W} y2={ROAD_Y - LANE_H} stroke="hsl(0, 0%, 40%)" strokeWidth={1} />
      <line x1={0} y1={ROAD_Y + LANE_H} x2={CANVAS_W} y2={ROAD_Y + LANE_H} stroke="hsl(0, 0%, 40%)" strokeWidth={1} />

      {/* Vertical roads at junctions */}
      {JUNCTION_XS.map((jx, i) => (
        <React.Fragment key={`vr-${i}`}>
          <rect
            x={jx - VERT_ROAD_W / 2} y={0}
            width={VERT_ROAD_W} height={CANVAS_H}
            fill="hsl(222, 20%, 13%)"
            stroke="hsl(222, 30%, 20%)"
            strokeWidth={0.5}
          />
          {/* Vertical lane divider */}
          <line
            x1={jx} y1={0} x2={jx} y2={ROAD_Y - LANE_H}
            stroke="hsl(45, 100%, 55%)" strokeWidth={1} strokeDasharray="8 6" opacity={0.4}
          />
          <line
            x1={jx} y1={ROAD_Y + LANE_H} x2={jx} y2={CANVAS_H}
            stroke="hsl(45, 100%, 55%)" strokeWidth={1} strokeDasharray="8 6" opacity={0.4}
          />
        </React.Fragment>
      ))}

      {/* Heatmap overlay */}
      {showHeatmap && roadSegments.map((seg, i) => (
        <rect
          key={`hm-${i}`}
          x={seg.x1} y={seg.y1}
          width={seg.x2 - seg.x1} height={seg.y2 - seg.y1}
          fill={congestionColor(seg.congestion)}
          style={{ transition: 'fill 0.5s ease' }}
        />
      ))}

      {/* Spillover Detection Zones — Enhanced Accuracy */}
      {spilloverZones.map((zone, zi) => {
        const activeEvt = getZoneRisk(zone.junctionIndex, zone.lane);
        const laneY = zone.lane === 'top' ? ROAD_Y - LANE_H : ROAD_Y;
        const isRisky = !!activeEvt;
        const isCritical = activeEvt?.risk === 'critical' || activeEvt?.risk === 'high';
        const isCascade = activeEvt?.cascadeRisk;
        const avgSpd = activeEvt?.avgSpeed ?? 999;
        const isSlowQueue = avgSpd < 15;

        return (
          <React.Fragment key={`sz-${zi}`}>
            {/* Approach Zone — green/teal, yellow when building queue */}
            <rect
              x={Math.min(zone.approachStart, zone.approachEnd)}
              y={laneY}
              width={Math.abs(zone.approachEnd - zone.approachStart)}
              height={LANE_H}
              fill={isRisky && isSlowQueue ? 'hsla(30, 100%, 55%, 0.10)' : isRisky ? 'hsla(45, 100%, 55%, 0.08)' : 'hsla(170, 70%, 50%, 0.04)'}
              stroke={isRisky && isSlowQueue ? 'hsla(30, 100%, 55%, 0.35)' : isRisky ? 'hsla(45, 100%, 55%, 0.3)' : 'hsla(170, 70%, 50%, 0.12)'}
              strokeWidth={isRisky && isSlowQueue ? 1 : 0.5}
              strokeDasharray={isRisky ? '6 3' : '4 3'}
              rx={2}
            >
              {isRisky && isSlowQueue && (
                <animate attributeName="opacity" values="0.7;1;0.7" dur="1.5s" repeatCount="indefinite" />
              )}
            </rect>
            {/* Critical Zone — yellow/orange, red when slow/stopped */}
            <rect
              x={zone.criticalStart}
              y={laneY}
              width={zone.criticalEnd - zone.criticalStart}
              height={LANE_H}
              fill={isCritical ? 'hsla(0, 85%, 55%, 0.18)' : isRisky ? 'hsla(45, 100%, 55%, 0.12)' : 'hsla(45, 100%, 55%, 0.04)'}
              stroke={isCritical ? 'hsla(0, 85%, 55%, 0.55)' : isRisky ? 'hsla(45, 100%, 55%, 0.4)' : 'hsla(45, 100%, 55%, 0.12)'}
              strokeWidth={isCritical ? 1.5 : 0.5}
              strokeDasharray={isCritical ? '0' : '4 3'}
              rx={2}
            >
              {isCritical && (
                <animate attributeName="opacity" values="0.6;1;0.6" dur="0.8s" repeatCount="indefinite" />
              )}
            </rect>
            {/* Junction Box No-Block Zone — red/neutral */}
            <rect
              x={zone.junctionBoxStart}
              y={laneY}
              width={zone.junctionBoxEnd - zone.junctionBoxStart}
              height={LANE_H}
              fill={activeEvt?.stoppedInJunction ? 'hsla(0, 85%, 55%, 0.22)' : 'hsla(0, 85%, 55%, 0.03)'}
              stroke={activeEvt?.stoppedInJunction ? 'hsla(0, 85%, 55%, 0.65)' : 'hsla(0, 85%, 55%, 0.1)'}
              strokeWidth={activeEvt?.stoppedInJunction ? 1.5 : 0.5}
              rx={2}
            >
              {activeEvt?.stoppedInJunction && (
                <animate attributeName="fill" values="hsla(0,85%,55%,0.12);hsla(0,85%,55%,0.28);hsla(0,85%,55%,0.12)" dur="0.6s" repeatCount="indefinite" />
              )}
            </rect>
            {/* Spillover warning label with enhanced info */}
            {isRisky && (
              <text
                x={(zone.criticalStart + zone.criticalEnd) / 2}
                y={laneY - 4}
                textAnchor="middle"
                fill={isCritical ? 'hsl(0, 85%, 65%)' : 'hsl(45, 100%, 65%)'}
                fontSize={7}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {isCritical ? '⚠ SPILLOVER' : '⚡ RISK'}
                {activeEvt?.action === 'extending_green' && (
                  <tspan dx={4} fill="hsl(142, 70%, 55%)" fontSize={6}>+{activeEvt.greenExtension}s</tspan>
                )}
                {isCascade && (
                  <tspan dx={4} fill="hsl(280, 80%, 65%)" fontSize={6}>CASCADE</tspan>
                )}
              </text>
            )}
            {/* Speed indicator on critical zones */}
            {isRisky && activeEvt && (
              <text
                x={(zone.criticalStart + zone.criticalEnd) / 2}
                y={laneY + LANE_H + 9}
                textAnchor="middle"
                fill={avgSpd < 8 ? 'hsl(0, 85%, 60%)' : avgSpd < 15 ? 'hsl(45, 100%, 60%)' : 'hsl(142, 70%, 55%)'}
                fontSize={6}
                fontFamily="monospace"
              >
                {avgSpd < 999 ? `${Math.round(avgSpd)} px/s` : ''} Q:{activeEvt.queueLength}
              </text>
            )}
          </React.Fragment>
        );
      })}

      {/* Junction indicators */}
      {junctions.map((j, i) => (
        <React.Fragment key={`j-${i}`}>
          {/* Junction box */}
          <rect
            x={j.x - 30} y={ROAD_Y - LANE_H - 5}
            width={60} height={ROAD_H + 10}
            fill="none"
            stroke={j.prepared ? 'hsl(142, 70%, 45%)' : j.cascadeActive ? 'hsl(45, 100%, 55%)' : 'hsl(222, 30%, 25%)'}
            strokeWidth={j.prepared || j.cascadeActive ? 2 : 1}
            rx={4}
            filter={j.cascadeActive ? 'url(#cascade-glow)' : undefined}
            style={{ transition: 'stroke 0.3s ease' }}
          />
          {/* Traffic signal */}
          <circle
            cx={j.x + 25} cy={ROAD_Y - LANE_H - 18}
            r={6}
            fill={j.signalState === 'green' ? 'hsl(142, 70%, 45%)' :
                  j.signalState === 'yellow' ? 'hsl(45, 100%, 55%)' : 'hsl(0, 85%, 55%)'}
            filter="url(#neon-glow)"
          />
          {/* Junction label */}
          <text
            x={j.x} y={ROAD_Y + LANE_H + 25}
            textAnchor="middle" fill="hsl(200, 100%, 80%)" fontSize={11} fontFamily="monospace"
          >
            J{i + 1} {j.prepared ? '✓' : ''}
          </text>
        </React.Fragment>
      ))}

      {/* Vehicles */}
      {vehicles.map(v => {
        const isReacting = v.isBlocker && !v.cleared && !v.isNonCooperative;
        const isStuck = v.isBlocker && v.isNonCooperative;
        return (
          <React.Fragment key={v.id}>
            {/* Brake light glow for reacting vehicles */}
            {isReacting && (
              <circle
                cx={v.x - v.width / 2 - 2}
                cy={v.y}
                r={3}
                fill="hsl(0, 90%, 55%)"
                opacity={0.8}
              >
                <animate attributeName="opacity" values="0.5;1;0.5" dur="0.8s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Stuck warning pulse */}
            {isStuck && (
              <circle
                cx={v.x}
                cy={v.y}
                r={v.width / 2 + 4}
                fill="none"
                stroke="hsl(0, 85%, 55%)"
                strokeWidth={1}
                opacity={0.5}
              >
                <animate attributeName="r" values={`${v.width / 2 + 2};${v.width / 2 + 8};${v.width / 2 + 2}`} dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.2s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Vehicle body */}
            <rect
              x={v.x - v.width / 2} y={v.y - v.height / 2}
              width={v.width} height={v.height}
              rx={3}
              fill={isStuck ? 'hsl(0, 85%, 45%)' : v.cleared ? 'hsl(142, 60%, 40%)' : v.isBlocker ? 'hsl(45, 90%, 50%)' : v.color}
              stroke={v.isBlocker ? 'hsl(0, 0%, 80%)' : 'none'}
              strokeWidth={v.isBlocker ? 0.8 : 0}
              opacity={v.cleared ? 0.5 : 0.9}
              style={{ transition: 'fill 0.4s ease, opacity 0.4s ease' }}
            />
            {/* Direction arrow for clearing vehicles */}
            {isReacting && v.instruction && v.instruction !== 'hold' && (
              <text
                x={v.x + (v.instruction === 'moveLeft' ? -v.width / 2 - 6 : v.width / 2 + 6)}
                y={v.y + 3}
                textAnchor="middle"
                fill="hsl(187, 100%, 70%)"
                fontSize={10}
                fontFamily="monospace"
                fontWeight="bold"
                opacity={0.9}
              >
                {v.instruction === 'moveLeft' ? '↑' : '↓'}
              </text>
            )}
            {/* Instruction label */}
            {showInstructions && v.isBlocker && v.instruction && (
              <text
                x={v.x} y={v.y - v.height / 2 - 6}
                textAnchor="middle"
                fill={v.isNonCooperative ? 'hsl(0, 85%, 65%)' : 'hsl(187, 100%, 70%)'}
                fontSize={7}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {v.isNonCooperative ? t.nonCoop : getInstructionText(v.instruction)}
              </text>
            )}
          </React.Fragment>
        );
      })}

      {/* Ambulances - Multi ambulance support with siren waves */}
      {ambulances.map((amb) => (
        amb.active && phase !== 'idle' && phase !== 'normal' && (
          <g key={amb.id}>
            {/* Siren sound waves — expanding rings */}
            <circle cx={amb.x} cy={amb.y} r={30} fill="none"
              stroke={amb.priority === 'critical' ? 'hsl(0, 85%, 55%)' : 'hsl(45, 100%, 50%)'}
              strokeWidth={0.8} opacity={0.2}>
              <animate attributeName="r" values="25;55;25" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0;0.3" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <circle cx={amb.x} cy={amb.y} r={20} fill="none"
              stroke={amb.priority === 'critical' ? 'hsl(0, 85%, 55%)' : 'hsl(45, 100%, 50%)'}
              strokeWidth={0.6} opacity={0.15}>
              <animate attributeName="r" values="20;45;20" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
              <animate attributeName="opacity" values="0.25;0;0.25" dur="1.2s" repeatCount="indefinite" begin="0.3s" />
            </circle>

            {/* Forward headlight beam */}
            <polygon
              points={`${amb.x + AMBULANCE_W / 2},${amb.y - 3} ${amb.x + AMBULANCE_W / 2 + 40},${amb.y - 10} ${amb.x + AMBULANCE_W / 2 + 40},${amb.y + 10} ${amb.x + AMBULANCE_W / 2},${amb.y + 3}`}
              fill="hsl(45, 100%, 80%)"
              opacity={0.06}
            />

            {/* Ambulance body shadow */}
            <rect
              x={amb.x - AMBULANCE_W / 2 + 2}
              y={amb.y - AMBULANCE_H / 2 + 2}
              width={AMBULANCE_W}
              height={AMBULANCE_H}
              rx={5}
              fill="black"
              opacity={0.3}
            />
            {/* Main body */}
            <rect
              x={amb.x - AMBULANCE_W / 2}
              y={amb.y - AMBULANCE_H / 2}
              width={AMBULANCE_W}
              height={AMBULANCE_H}
              rx={5}
              fill="white"
              stroke={amb.priority === 'critical' ? 'hsl(0, 85%, 50%)' : 'hsl(45, 100%, 50%)'}
              strokeWidth={2}
            />
            {/* Red stripe */}
            <rect
              x={amb.x - AMBULANCE_W / 2}
              y={amb.y + AMBULANCE_H / 2 - 5}
              width={AMBULANCE_W}
              height={5}
              rx={2}
              fill={amb.priority === 'critical' ? 'hsl(0, 85%, 50%)' : 'hsl(45, 100%, 50%)'}
            />
            {/* Cross symbol */}
            <rect x={amb.x - 4} y={amb.y - 6} width={8} height={10} rx={1}
              fill={amb.priority === 'critical' ? 'hsl(0, 85%, 50%)' : 'hsl(45, 100%, 50%)'} />
            <rect x={amb.x - 5} y={amb.y - 4} width={10} height={6} rx={1}
              fill={amb.priority === 'critical' ? 'hsl(0, 85%, 50%)' : 'hsl(45, 100%, 50%)'} />
            {/* White cross inner */}
            <rect x={amb.x - 2} y={amb.y - 4} width={4} height={6} rx={0.5} fill="white" />
            <rect x={amb.x - 3} y={amb.y - 3} width={6} height={4} rx={0.5} fill="white" />

            {/* Siren light on top */}
            <rect x={amb.x - 6} y={amb.y - AMBULANCE_H / 2 - 4} width={12} height={5} rx={2.5}
              fill={amb.priority === 'critical' ? 'hsl(0, 85%, 55%)' : 'hsl(45, 100%, 50%)'}>
              <animate attributeName="fill"
                values={amb.priority === 'critical'
                  ? 'hsl(0,85%,55%);hsl(220,100%,60%);hsl(0,85%,55%)'
                  : 'hsl(45,100%,50%);hsl(200,80%,55%);hsl(45,100%,50%)'}
                dur="0.35s" repeatCount="indefinite" />
            </rect>
            {/* Siren glow */}
            <rect x={amb.x - 8} y={amb.y - AMBULANCE_H / 2 - 6} width={16} height={9} rx={4}
              fill={amb.priority === 'critical' ? 'hsl(0, 85%, 55%)' : 'hsl(45, 100%, 50%)'}
              opacity={0.2}
              filter="url(#ambulance-glow)">
              <animate attributeName="opacity" values="0.15;0.35;0.15" dur="0.35s" repeatCount="indefinite" />
            </rect>

            {/* Headlights */}
            <circle cx={amb.x + AMBULANCE_W / 2 - 2} cy={amb.y - 3} r={2} fill="hsl(45, 100%, 85%)" />
            <circle cx={amb.x + AMBULANCE_W / 2 - 2} cy={amb.y + 3} r={2} fill="hsl(45, 100%, 85%)" />

            {/* Label with priority */}
            <text x={amb.x} y={amb.y - AMBULANCE_H / 2 - 12} textAnchor="middle"
              fill={amb.priority === 'critical' ? 'hsl(0, 85%, 70%)' : 'hsl(45, 100%, 60%)'}
              fontSize={9} fontWeight="bold" fontFamily="monospace">
              {amb.priority === 'critical' ? '🚑 CRITICAL' : '🚔 AMB-2'}
            </text>
            {/* ETA below ambulance */}
            <text x={amb.x} y={amb.y + AMBULANCE_H / 2 + 14} textAnchor="middle"
              fill="hsl(187, 100%, 70%)" fontSize={8} fontFamily="monospace" fontWeight="bold">
              ETA: {amb.eta.toFixed(1)}s
            </text>
          </g>
        )
      ))}

      {/* Corridor highlight */}
      {(phase === 'clearing' || phase === 'passage') && ambulances.length > 0 && (
        <rect
          x={ambulances[0]?.x || 0}
          y={ROAD_Y - LANE_H}
          width={Math.max(0, CANVAS_W - (ambulances[0]?.x || 0))}
          height={LANE_H}
          fill="hsl(0, 85%, 55%)"
          opacity={0.08}
          style={{ transition: 'width 0.3s ease' }}
        />
      )}

      {/* Heatmap legend */}
      {showHeatmap && (
        <g transform={`translate(${CANVAS_W - 140}, ${CANVAS_H - 50})`}>
          <rect x={0} y={0} width={130} height={40} rx={6} fill="hsl(222, 47%, 9%)" opacity={0.9} stroke="hsl(222, 30%, 22%)" />
          <rect x={10} y={10} width={16} height={10} rx={2} fill="hsl(142, 70%, 45%)" />
          <text x={30} y={19} fill="hsl(200, 100%, 80%)" fontSize={8} fontFamily="monospace">Free</text>
          <rect x={50} y={10} width={16} height={10} rx={2} fill="hsl(45, 100%, 55%)" />
          <text x={70} y={19} fill="hsl(200, 100%, 80%)" fontSize={8} fontFamily="monospace">Med</text>
          <rect x={90} y={10} width={16} height={10} rx={2} fill="hsl(0, 85%, 55%)" />
          <text x={110} y={19} fill="hsl(200, 100%, 80%)" fontSize={8} fontFamily="monospace">High</text>
          <text x={65} y={35} textAnchor="middle" fill="hsl(215, 20%, 55%)" fontSize={7} fontFamily="monospace">CONGESTION</text>
        </g>
      )}

      {/* Phase indicator */}
      <g transform="translate(10, 20)">
        <text fill="hsl(187, 100%, 50%)" fontSize={10} fontFamily="monospace" fontWeight="bold">
          {phase === 'idle' ? 'READY' :
           phase === 'normal' ? '● MONITORING' :
           phase === 'detection' ? '🔍 AMBULANCE DETECTED' :
           phase === 'clearing' ? '🚨 CORRIDOR CLEARING' :
           phase === 'passage' ? '🚑 AMBULANCE PASSING' :
           phase === 'recovery' ? '✓ RECOVERING' : '✓ COMPLETE'}
        </text>
      </g>
    </svg>
  );
};

export const SimulationCanvas = SimulationCanvasComponent;
