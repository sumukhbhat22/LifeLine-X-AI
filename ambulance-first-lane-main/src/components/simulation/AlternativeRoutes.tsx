import React from 'react';
import { Navigation2, MapPin, Timer } from 'lucide-react';

interface Route {
  name: string;
  distance: number;
  eta: number;
  congestion: 'low' | 'medium' | 'high';
}

interface Props {
  primaryRoute: Route;
  alternativeRoutes: Route[];
  isAmbulanceActive: boolean;
}

const CongestionBadge = ({ level }: { level: 'low' | 'medium' | 'high' }) => {
  const styles = {
    low: 'bg-green-100 text-green-700 border-green-300',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    high: 'bg-red-100 text-red-700 border-red-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${styles[level]}`}>
      {level.toUpperCase()}
    </span>
  );
};

export const AlternativeRoutes: React.FC<Props> = ({ primaryRoute, alternativeRoutes, isAmbulanceActive }) => {
  const bestRoute = [primaryRoute, ...alternativeRoutes].reduce((best, current) =>
    current.eta < best.eta ? current : best
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Navigation2 className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Route Options</h3>
      </div>

      <div className="space-y-2">
        {/* Primary Route */}
        <div
          className={`flex items-start justify-between p-2.5 rounded border transition-colors ${
            primaryRoute.name === bestRoute.name && isAmbulanceActive
              ? 'border-primary bg-primary/5'
              : 'border-border bg-secondary/30'
          }`}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-foreground">{primaryRoute.name}</div>
              {primaryRoute.name === bestRoute.name && isAmbulanceActive && (
                <span className="text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-mono font-bold">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {primaryRoute.distance} km
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Timer className="h-3 w-3" />
                {primaryRoute.eta}s ETA
              </div>
            </div>
          </div>
          <CongestionBadge level={primaryRoute.congestion} />
        </div>

        {/* Alternative Routes */}
        {alternativeRoutes.map(route => (
          <div
            key={route.name}
            className={`flex items-start justify-between p-2.5 rounded border transition-colors ${
              route.name === bestRoute.name && route.eta < primaryRoute.eta
                ? 'border-green-500 bg-green-50/30'
                : 'border-border bg-secondary/20'
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-foreground">{route.name}</div>
                {route.eta < primaryRoute.eta && (
                  <span className="text-[8px] bg-green-600 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                    FASTER
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {route.distance} km
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  {route.eta}s ETA
                </div>
                <div className="text-[9px] text-green-600 font-mono font-bold">
                  -{(primaryRoute.eta - route.eta).toFixed(1)}s
                </div>
              </div>
            </div>
            <CongestionBadge level={route.congestion} />
          </div>
        ))}
      </div>

      <div className="mt-3 text-[9px] text-muted-foreground font-mono">
        💡 Tip: System auto-selects route with lowest congestion and ETA
      </div>
    </div>
  );
};
