import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';
import type { SimulationState } from '@/types/simulation';
import type { DemoEvent } from '@/types/demo';

interface RecordingOverlayProps {
  state: SimulationState;
  showMetrics: boolean;
  showArrows: boolean;
  showCountdown: boolean;
  currentEvents: DemoEvent[];
  timeSaved: number;
}

export const RecordingOverlay: React.FC<RecordingOverlayProps> = ({
  state,
  showMetrics,
  showArrows,
  showCountdown,
  currentEvents,
  timeSaved,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none font-sans">
      {/* Top Center: Main Call-to-Action Text */}
      {currentEvents
        .filter((e) => e.type === 'text-overlay' && e.data.position?.includes('top-center'))
        .map((event) => (
          <div
            key={event.time}
            className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center"
            style={{ animation: 'fadeInOut 3s ease-in-out forwards' }}
          >
            <div className="bg-black/70 text-white px-6 py-3 rounded-lg shadow-2xl backdrop-blur-sm border border-white/20">
              <div className="text-lg font-bold whitespace-pre-line text-center">
                {event.data.text}
              </div>
            </div>
          </div>
        ))}

      {/* Top Right: Surge Status */}
      {showCountdown && state.surgeMode && (
        <div className="absolute top-8 right-8">
          <div className={`px-4 py-2 rounded-lg font-mono font-bold text-sm flex items-center gap-2 backdrop-blur-sm border ${
            state.techParkSurgeActive
              ? 'bg-red-500/80 text-white border-red-400'
              : 'bg-amber-500/80 text-white border-amber-400'
          }`}>
            {state.techParkSurgeActive ? (
              <>
                <AlertTriangle className="h-4 w-4 animate-pulse" />
                Surge Active
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 animate-pulse" />
                {Math.ceil(state.minutesUntilSurge)} min to surge
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom Right: Real-Time Metrics */}
      {showMetrics && (
        <div className="absolute bottom-8 right-8 space-y-2">
          <div className="bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 font-mono text-xs">
            <div className="font-bold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              Clear Rate
            </div>
            <div className="text-lg font-bold text-green-400">
              {state.vehiclesCleared}/
              <span className="text-white/70">
                {state.vehicles.filter((v) => v.road === 'main').length}
              </span>
            </div>
          </div>

          <div className="bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20 font-mono text-xs">
            <div className="font-bold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              ETA
            </div>
            <div className="text-lg font-bold text-yellow-400">{Math.ceil(state.ambulances[0]?.eta ?? 0)}s</div>
          </div>

          {timeSaved > 0 && (
            <div className="bg-green-500/20 text-green-400 px-4 py-2 rounded-lg backdrop-blur-sm border border-green-500/50 font-mono text-xs">
              <div className="font-bold mb-1">Time Saved</div>
              <div className="text-lg font-bold">{timeSaved}s</div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Center: Status Messages */}
      {currentEvents
        .filter((e) => e.type === 'text-overlay' && e.data.position?.includes('bottom-center'))
        .map((event) => (
          <div
            key={event.time}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
            style={{ animation: 'fadeInOut 3s ease-in-out forwards' }}
          >
            <div className="bg-blue-500/80 text-white px-6 py-3 rounded-lg backdrop-blur-sm border border-blue-400/50 font-semibold text-center">
              {event.data.text}
            </div>
          </div>
        ))}

      {/* Bottom Left/Right: Junction Status */}
      {currentEvents
        .filter((e) => e.type === 'text-overlay' && e.data.position?.includes('bottom'))
        .map((event) => (
          <div
            key={event.time}
            className={`absolute bottom-8 ${event.data.position?.includes('left') ? 'left-8' : 'right-8'}`}
            style={{ animation: 'fadeInOut 10s ease-in-out forwards' }}
          >
            <div className="bg-purple-500/80 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-purple-400/50 text-sm font-semibold">
              {event.data.text}
            </div>
          </div>
        ))}

      {/* Center: Large Impact Messages */}
      {state.phase === 'done' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-6 rounded-2xl shadow-2xl backdrop-blur-sm border-2 border-white/30 text-center">
            <div className="text-3xl font-bold mb-2">✓ SUCCESS</div>
            <div className="text-lg">All vehicles cleared</div>
            <div className="text-sm text-white/80 mt-2">Ambulance safely reached destination</div>
          </div>
        </div>
      )}

      {/* Animated Corner Badge */}
      <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full font-bold text-xs animate-pulse">
        🎬 RECORDING
      </div>

      {/* FPS Counter (development only) */}
      <div className="absolute top-4 left-4 ml-20 bg-black/70 text-white px-2 py-1 rounded font-mono text-xs border border-white/20">
        {state.simTime.toFixed(1)}s
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeInOut {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          10% {
            opacity: 1;
            transform: translateY(0);
          }
          90% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};
