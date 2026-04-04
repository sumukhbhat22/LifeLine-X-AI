/**
 * useSafetyRouting — Safety-Aware Routing Engine
 *
 * Real-time map integration using:
 * - OpenStreetMap tiles via Leaflet (map rendering)
 * - OSRM API (Open Source Routing Machine) for road-following routes
 * - Custom safety scoring algorithm
 *
 * Routes are fetched from the public OSRM demo server, which returns
 * actual road geometry for Bengaluru streets. Fallback routes are
 * provided if the API is unreachable.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */

export interface LatLng { lat: number; lng: number }

export interface UnsafeZone {
  id: string;
  center: LatLng;
  radius: number;          // metres
  type: 'low_lighting' | 'low_traffic' | 'incident_prone';
  severity: number;        // 1–10
  label: string;
  description: string;
}

export interface RouteInfo {
  id: string;
  name: string;
  label: string;
  coordinates: LatLng[];
  distance: number;        // km
  duration: number;        // minutes
  safetyScore: number;     // 0–100 (100 = safest)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  unsafeZonesCrossed: number;
  trafficDensity: number;  // 0–100
  lightingScore: number;   // 0–100
  color: string;
  isRecommended: boolean;
}

export interface SafetyState {
  routes: RouteInfo[];
  selectedRouteId: string;
  unsafeZones: UnsafeZone[];
  showUnsafeZones: boolean;
  useSafestRoute: boolean;
  vehiclePos: LatLng | null;
  vehicleProgress: number; // 0–1
  simulating: boolean;
  arrived: boolean;
  warnings: string[];
  currentWarning: string | null;
  apiStatus: 'idle' | 'loading' | 'success' | 'fallback';
  apiTime: number;         // ms
}

/* ══════════════════════════════════════════════
   Constants — Bengaluru coordinates
   ══════════════════════════════════════════════ */

/** Koramangala, Bengaluru */
export const SOURCE: LatLng = { lat: 12.9340, lng: 77.6260 };
/** Yeshwantpur, Bengaluru */
export const DESTINATION: LatLng = { lat: 13.0280, lng: 77.5440 };
export const MAP_CENTER: LatLng = {
  lat: (SOURCE.lat + DESTINATION.lat) / 2,
  lng: (SOURCE.lng + DESTINATION.lng) / 2,
};

export const UNSAFE_ZONES: UnsafeZone[] = [
  {
    id: 'uz1', center: { lat: 12.9460, lng: 77.5860 }, radius: 290,
    type: 'low_lighting', severity: 8,
    label: 'Low Lighting Zone',
    description: 'Poorly lit residential backroad near Lalbagh South Gate. Minimal street lights after 9 PM.',
  },
  {
    id: 'uz2', center: { lat: 12.9620, lng: 77.5780 }, radius: 230,
    type: 'incident_prone', severity: 9,
    label: 'Incident-Prone Area',
    description: 'KR Market area — frequent theft and harassment reports logged by Bengaluru Police.',
  },
  {
    id: 'uz3', center: { lat: 12.9770, lng: 77.5720 }, radius: 330,
    type: 'low_traffic', severity: 7,
    label: 'Low Traffic (Night)',
    description: 'Majestic side-roads — near-zero vehicular traffic between 11 PM – 5 AM.',
  },
  {
    id: 'uz4', center: { lat: 12.9920, lng: 77.5540 }, radius: 210,
    type: 'low_lighting', severity: 6,
    label: 'Dark Underpass Zone',
    description: 'Underpass near Yeshwantpur with broken lights. Isolated at night.',
  },
];

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

/** Haversine distance in metres */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function countCrossed(coords: LatLng[], zones: UnsafeZone[]): number {
  const hit = new Set<string>();
  for (let i = 0; i < coords.length; i += Math.max(1, Math.floor(coords.length / 120))) {
    for (const z of zones) {
      if (haversine(coords[i], z.center) < z.radius + 80) hit.add(z.id);
    }
  }
  return hit.size;
}

function scoreSafety(coords: LatLng[], zones: UnsafeZone[]) {
  const zonesCrossed = countCrossed(coords, zones);
  const trafficDensity = Math.min(95, Math.max(22, 92 - zonesCrossed * 17));
  const lightingScore = Math.min(100, Math.max(18, 95 - zonesCrossed * 20));
  const score = Math.max(0, Math.min(100, Math.round(
    100
    - zonesCrossed * 18
    - (100 - trafficDensity) * 0.25
    - (100 - lightingScore) * 0.2
  )));
  return { score, zonesCrossed, trafficDensity, lightingScore };
}

function riskOf(s: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (s >= 70) return 'LOW';
  if (s >= 40) return 'MEDIUM';
  return 'HIGH';
}

/* ══════════════════════════════════════════════
   Fallback route data (approximate road waypoints)
   ══════════════════════════════════════════════ */

const FALLBACK_A: LatLng[] = [
  SOURCE,
  { lat: 12.9360, lng: 77.6150 }, { lat: 12.9400, lng: 77.6020 },
  { lat: 12.9440, lng: 77.5910 }, { lat: 12.9465, lng: 77.5855 },
  { lat: 12.9520, lng: 77.5820 }, { lat: 12.9580, lng: 77.5790 },
  { lat: 12.9625, lng: 77.5775 }, { lat: 12.9720, lng: 77.5730 },
  { lat: 12.9775, lng: 77.5715 }, { lat: 12.9860, lng: 77.5640 },
  { lat: 12.9925, lng: 77.5545 }, { lat: 13.0010, lng: 77.5510 },
  { lat: 13.0100, lng: 77.5470 }, { lat: 13.0200, lng: 77.5450 },
  DESTINATION,
];

const FALLBACK_B: LatLng[] = [
  SOURCE,
  { lat: 12.9380, lng: 77.6380 }, { lat: 12.9430, lng: 77.6580 },
  { lat: 12.9500, lng: 77.6790 }, { lat: 12.9570, lng: 77.6980 },
  { lat: 12.9680, lng: 77.7020 }, { lat: 12.9850, lng: 77.6920 },
  { lat: 13.0010, lng: 77.6700 }, { lat: 13.0120, lng: 77.6400 },
  { lat: 13.0200, lng: 77.6100 }, { lat: 13.0260, lng: 77.5800 },
  { lat: 13.0280, lng: 77.5600 },
  DESTINATION,
];

/* ══════════════════════════════════════════════
   OSRM API — real-time routing
   ══════════════════════════════════════════════ */

async function fetchOSRM(
  waypoints: LatLng[],
): Promise<{ coords: LatLng[]; distance: number; duration: number } | null> {
  try {
    const pairs = waypoints.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${pairs}?overview=full&geometries=geojson`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    const r = data.routes[0];
    return {
      coords: r.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] })),
      distance: +(r.distance / 1000).toFixed(1),
      duration: Math.round(r.duration / 60),
    };
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════
   Hook
   ══════════════════════════════════════════════ */

export function useSafetyRouting() {
  const [state, setState] = useState<SafetyState>(() => ({
    routes: [],
    selectedRouteId: '',
    unsafeZones: UNSAFE_ZONES,
    showUnsafeZones: true,
    useSafestRoute: true,
    vehiclePos: null,
    vehicleProgress: 0,
    simulating: false,
    arrived: false,
    warnings: [],
    currentWarning: null,
    apiStatus: 'idle',
    apiTime: 0,
  }));

  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── fetch routes from OSRM ── */
  const fetchRoutes = useCallback(async () => {
    setState(p => ({ ...p, apiStatus: 'loading', routes: [], arrived: false, warnings: [], currentWarning: null }));

    const t0 = performance.now();

    // Route A: via Lalbagh inner-city roads (shorter, passes through unsafe zones)
    const wpA: LatLng[] = [SOURCE, { lat: 12.9507, lng: 77.5843 }, DESTINATION];
    // Route B: via Outer Ring Road / Marathahalli (longer, avoids unsafe zones)
    const wpB: LatLng[] = [SOURCE, { lat: 12.9565, lng: 77.7010 }, DESTINATION];

    const [rA, rB] = await Promise.all([fetchOSRM(wpA), fetchOSRM(wpB)]);
    const elapsed = Math.round(performance.now() - t0);
    const usingApi = !!(rA || rB);

    const coordsA = rA?.coords ?? FALLBACK_A;
    const coordsB = rB?.coords ?? FALLBACK_B;

    const sA = scoreSafety(coordsA, UNSAFE_ZONES);
    const sB = scoreSafety(coordsB, UNSAFE_ZONES);

    const routeA: RouteInfo = {
      id: 'A', name: 'Route A', label: 'Inner City Route (Shortest)',
      coordinates: coordsA,
      distance: rA?.distance ?? 12.8,
      duration: rA?.duration ?? 38,
      safetyScore: sA.score,
      riskLevel: riskOf(sA.score),
      unsafeZonesCrossed: sA.zonesCrossed,
      trafficDensity: sA.trafficDensity,
      lightingScore: sA.lightingScore,
      color: '#ef4444',
      isRecommended: false,
    };

    const routeB: RouteInfo = {
      id: 'B', name: 'Route B', label: 'Outer Ring Road (Safer)',
      coordinates: coordsB,
      distance: rB?.distance ?? 19.4,
      duration: rB?.duration ?? 34,
      safetyScore: sB.score,
      riskLevel: riskOf(sB.score),
      unsafeZonesCrossed: sB.zonesCrossed,
      trafficDensity: sB.trafficDensity,
      lightingScore: sB.lightingScore,
      color: '#22c55e',
      isRecommended: false,
    };

    // Mark safest
    if (routeA.safetyScore >= routeB.safetyScore) routeA.isRecommended = true;
    else routeB.isRecommended = true;

    const recId = routeA.isRecommended ? 'A' : 'B';

    setState(p => ({
      ...p,
      routes: [routeA, routeB],
      selectedRouteId: recId,
      apiStatus: usingApi ? 'success' : 'fallback',
      apiTime: elapsed,
    }));
  }, []);

  /* ── simulation ── */
  const startSim = useCallback(() => {
    if (simRef.current) clearInterval(simRef.current);
    setState(p => ({
      ...p,
      simulating: true, arrived: false,
      vehicleProgress: 0, vehiclePos: SOURCE,
      warnings: [], currentWarning: null,
    }));

    simRef.current = setInterval(() => {
      setState(prev => {
        if (!prev.simulating || !prev.routes.length) return prev;
        const route = prev.routes.find(r => r.id === prev.selectedRouteId);
        if (!route) return prev;

        const speed = 0.0025;
        const np = Math.min(1, prev.vehicleProgress + speed);
        const coords = route.coordinates;
        const maxI = coords.length - 1;
        const raw = np * maxI;
        const i = Math.min(Math.floor(raw), maxI);
        const j = Math.min(i + 1, maxI);
        const f = raw - i;

        const pos: LatLng = {
          lat: coords[i].lat + (coords[j].lat - coords[i].lat) * f,
          lng: coords[i].lng + (coords[j].lng - coords[i].lng) * f,
        };

        // Proximity warning
        let cw: string | null = null;
        const nw = [...prev.warnings];
        if (prev.showUnsafeZones) {
          for (const z of prev.unsafeZones) {
            if (haversine(pos, z.center) < z.radius + 100) {
              cw = `⚠️ Unsafe Area: ${z.label}`;
              const key = `Entered ${z.label}`;
              if (!nw.includes(key)) nw.push(key);
            }
          }
        }

        if (np >= 1) {
          if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
          const msg = route.isRecommended
            ? '✅ Arrived safely via recommended route!'
            : `⚠️ Arrived — passed through ${route.unsafeZonesCrossed} unsafe zone(s).`;
          return { ...prev, simulating: false, arrived: true, vehicleProgress: 1, vehiclePos: DESTINATION, warnings: nw, currentWarning: msg };
        }

        return { ...prev, vehicleProgress: np, vehiclePos: pos, warnings: nw, currentWarning: cw };
      });
    }, 40);
  }, []);

  const stopSim = useCallback(() => {
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
    setState(p => ({ ...p, simulating: false }));
  }, []);

  const resetSim = useCallback(() => {
    stopSim();
    setState(p => ({ ...p, vehiclePos: null, vehicleProgress: 0, arrived: false, warnings: [], currentWarning: null }));
  }, [stopSim]);

  const toggleUnsafeZones = useCallback(() => {
    setState(p => ({ ...p, showUnsafeZones: !p.showUnsafeZones }));
  }, []);

  const selectRoute = useCallback((id: string) => {
    setState(p => ({ ...p, selectedRouteId: id }));
  }, []);

  const toggleRoutingMode = useCallback(() => {
    setState(p => {
      const useSafest = !p.useSafestRoute;
      if (!p.routes.length) return { ...p, useSafestRoute: useSafest };
      const target = useSafest
        ? (p.routes.find(r => r.isRecommended)?.id ?? p.selectedRouteId)
        : p.routes.reduce((a, b) => a.distance < b.distance ? a : b).id;
      return { ...p, useSafestRoute: useSafest, selectedRouteId: target };
    });
  }, []);

  useEffect(() => () => { if (simRef.current) clearInterval(simRef.current); }, []);

  return { state, fetchRoutes, startSim, stopSim, resetSim, toggleUnsafeZones, selectRoute, toggleRoutingMode };
}
