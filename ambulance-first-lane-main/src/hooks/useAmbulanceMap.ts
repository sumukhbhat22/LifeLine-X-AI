/**
 * useAmbulanceMap — Map-based Ambulance Priority Simulation
 *
 * Real-time Leaflet map integration:
 *  - OSRM API for road-following ambulance route
 *  - 3 traffic junctions with signal management
 *  - Vehicle corridor clearing animation
 *  - Hospital bed availability markers
 *  - Multilingual driver notifications (EN · HI · KN · TA)
 *  - CO₂ & time-saved impact tracking
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/* ══════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════ */

export interface LatLng { lat: number; lng: number }

export interface MapJunction {
  id: string;
  position: LatLng;
  name: string;
  signal: 'red' | 'green' | 'yellow';
  prepared: boolean;
  warned: boolean;
  routeProgress: number;        // 0-1 position on route
}

export interface MapVehicle {
  id: string;
  position: LatLng;
  originalPosition: LatLng;
  cleared: boolean;
  notified: boolean;            // received move-aside notification
  moving: boolean;              // actively sliding left/right
  clearDirection: 'left' | 'right';
  clearProgress: number;        // 0→1 lateral slide animation
  routeProgress: number;
}

export interface MapHospital {
  id: string;
  name: string;
  position: LatLng;
  beds: number;
  distance: number;             // km
  isDestination: boolean;
}

export interface DriverNotif {
  id: string;
  message: string;
  time: number;
  type: 'alert' | 'clear' | 'instruction';
}

export type AmbPhase = 'idle' | 'detection' | 'clearing' | 'passage' | 'done';
export type AmbLang = 'en' | 'hi' | 'kn' | 'ta';

export interface AmbMapState {
  phase: AmbPhase;
  routeCoords: LatLng[];
  routeDistance: number;        // km
  routeDuration: number;        // minutes
  apiStatus: 'idle' | 'loading' | 'success' | 'fallback';
  apiTime: number;              // ms

  ambulancePos: LatLng | null;
  ambulanceProgress: number;    // 0-1
  sirenActive: boolean;

  junctions: MapJunction[];
  junctionsPrepared: number;

  vehicles: MapVehicle[];
  vehiclesCleared: number;

  hospitals: MapHospital[];

  timeSavedSeconds: number;
  co2Saved: number;             // kg
  clearedProgress: number;      // 0-1

  notifications: DriverNotif[];

  simulating: boolean;
  speed: number;                // multiplier 0.5–3
  language: AmbLang;
}

/* ══════════════════════════════════════════════
   Constants — Bengaluru coordinates
   ══════════════════════════════════════════════ */

/** HSR Layout — Emergency pickup */
export const AMB_SOURCE: LatLng = { lat: 12.9116, lng: 77.6389 };
/** Fortis Hospital, Cunningham Road */
export const AMB_DEST: LatLng = { lat: 12.9850, lng: 77.5940 };
export const AMB_CENTER: LatLng = {
  lat: (AMB_SOURCE.lat + AMB_DEST.lat) / 2,
  lng: (AMB_SOURCE.lng + AMB_DEST.lng) / 2,
};

export const HOSPITALS: MapHospital[] = [
  { id: 'h1', name: 'Fortis Hospital',    position: { lat: 12.9850, lng: 77.5940 }, beds: 3, distance: 8.2, isDestination: true  },
  { id: 'h2', name: "St. John's Medical", position: { lat: 12.9340, lng: 77.6030 }, beds: 1, distance: 4.5, isDestination: false },
  { id: 'h3', name: 'Apollo Hospital',    position: { lat: 12.9560, lng: 77.6350 }, beds: 0, distance: 5.8, isDestination: false },
];

const JUNCTION_NAMES = ['Adugodi Junction', 'Lalbagh West Gate', 'Minerva Circle'];

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

function interpolateRoute(coords: LatLng[], progress: number): LatLng {
  const maxI = coords.length - 1;
  const raw = Math.max(0, Math.min(1, progress)) * maxI;
  const i = Math.min(Math.floor(raw), maxI);
  const j = Math.min(i + 1, maxI);
  const f = raw - i;
  return {
    lat: coords[i].lat + (coords[j].lat - coords[i].lat) * f,
    lng: coords[i].lng + (coords[j].lng - coords[i].lng) * f,
  };
}

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

const FALLBACK_ROUTE: LatLng[] = [
  AMB_SOURCE,
  { lat: 12.9180, lng: 77.6300 }, { lat: 12.9250, lng: 77.6200 },
  { lat: 12.9330, lng: 77.6100 }, { lat: 12.9420, lng: 77.6050 },
  { lat: 12.9500, lng: 77.6000 }, { lat: 12.9580, lng: 77.5980 },
  { lat: 12.9650, lng: 77.5960 }, { lat: 12.9720, lng: 77.5950 },
  { lat: 12.9790, lng: 77.5945 },
  AMB_DEST,
];

/**
 * Compute a perpendicular (lateral) offset from the route at a given progress.
 * direction  = 'left'  → offset to the left of travel
 * direction  = 'right' → offset to the right of travel
 * magnitude  = offset in degrees (~0.001 ≈ 110 m)
 */
const CLEAR_OFFSET = 0.0018; // ~200 m — clearly visible on map

function lateralOffset(
  coords: LatLng[],
  progress: number,
  direction: 'left' | 'right',
  magnitude: number,
): LatLng {
  const base = interpolateRoute(coords, progress);
  const maxI = coords.length - 1;
  const raw  = Math.max(0, Math.min(1, progress)) * maxI;
  const i    = Math.min(Math.floor(raw), maxI);
  const j    = Math.min(i + 1, maxI);

  // Tangent along the route
  const dLat = coords[j].lat - coords[i].lat;
  const dLng = coords[j].lng - coords[i].lng;
  const len  = Math.sqrt(dLat * dLat + dLng * dLng) || 1e-9;

  // Perpendicular: rotate tangent 90° (left = CCW, right = CW)
  const sign = direction === 'left' ? 1 : -1;
  const nLat = -dLng / len * sign;
  const nLng =  dLat / len * sign;

  return {
    lat: base.lat + nLat * magnitude,
    lng: base.lng + nLng * magnitude,
  };
}

function generateVehicles(coords: LatLng[], count: number): MapVehicle[] {
  const out: MapVehicle[] = [];
  for (let i = 0; i < count; i++) {
    const progress = 0.05 + (i / count) * 0.88;
    const pos = interpolateRoute(coords, progress);
    // slight lateral scatter so they sit on the road naturally
    const scatter = (Math.random() - 0.5) * 0.0006;
    const original: LatLng = { lat: pos.lat + scatter, lng: pos.lng + scatter };
    out.push({
      id: `v${i}`,
      position: { ...original },
      originalPosition: { ...original },
      cleared: false,
      notified: false,
      moving: false,
      clearDirection: i % 2 === 0 ? 'left' : 'right', // alternate L/R
      clearProgress: 0,
      routeProgress: progress,
    });
  }
  return out;
}

function generateJunctions(coords: LatLng[]): MapJunction[] {
  return [0.25, 0.50, 0.75].map((p, i) => ({
    id: `j${i}`,
    position: interpolateRoute(coords, p),
    name: JUNCTION_NAMES[i],
    signal: 'red' as const,
    prepared: false,
    warned: false,
    routeProgress: p,
  }));
}

/* ══════════════════════════════════════════════
   Multilingual notification templates
   ══════════════════════════════════════════════ */

const MSGS: Record<AmbLang, {
  detect: string;
  approach: (km: string) => string;
  junction: (n: string) => string;
  clearDir: string;
  vehicles: (n: number) => string;
  passage: string;
  arrived: string;
}> = {
  en: {
    detect:    '🚨 Emergency detected — Ambulance en route',
    approach:  (km) => `🔊 Ambulance ${km} km away — clear lane now`,
    junction:  (n)  => `✅ ${n} → Signal turned GREEN`,
    clearDir:  '← All vehicles: move left to create corridor',
    vehicles:  (n)  => `🚗 ${n} vehicles cleared from corridor`,
    passage:   '🏥 Approaching hospital — corridor fully clear',
    arrived:   '✅ Ambulance reached hospital safely!',
  },
  hi: {
    detect:    '🚨 आपातकाल — एम्बुलेंस रास्ते में',
    approach:  (km) => `🔊 एम्बुलेंस ${km} किमी दूर — लेन खाली करें`,
    junction:  (n)  => `✅ ${n} → सिग्नल हरा हुआ`,
    clearDir:  '← सभी वाहन: कॉरिडोर बनाने के लिए बाएं हटें',
    vehicles:  (n)  => `🚗 ${n} वाहन कॉरिडोर से हटाए गए`,
    passage:   '🏥 अस्पताल नज़दीक — कॉरिडोर साफ़',
    arrived:   '✅ एम्बुलेंस सुरक्षित अस्पताल पहुँच गई!',
  },
  kn: {
    detect:    '🚨 ತುರ್ತು — ಆಂಬುಲೆನ್ಸ್ ಹೊರಟಿದೆ',
    approach:  (km) => `🔊 ಆಂಬುಲೆನ್ಸ್ ${km} ಕಿಮೀ ದೂರ — ಲೇನ್ ಖಾಲಿ ಮಾಡಿ`,
    junction:  (n)  => `✅ ${n} → ಸಿಗ್ನಲ್ ಹಸಿರಾಯಿತು`,
    clearDir:  '← ಎಲ್ಲಾ ವಾಹನಗಳು: ಕಾರಿಡಾರ್ ಮಾಡಲು ಎಡಕ್ಕೆ ಸರಿಯಿರಿ',
    vehicles:  (n)  => `🚗 ${n} ವಾಹನಗಳು ಕಾರಿಡಾರ್‌ನಿಂದ ತೆರವು`,
    passage:   '🏥 ಆಸ್ಪತ್ರೆ ಸಮೀಪಿಸುತ್ತಿದೆ — ಕಾರಿಡಾರ್ ಸ್ಪಷ್ಟ',
    arrived:   '✅ ಆಂಬುಲೆನ್ಸ್ ಸುರಕ್ಷಿತವಾಗಿ ಆಸ್ಪತ್ರೆ ತಲುಪಿತು!',
  },
  ta: {
    detect:    '🚨 அவசரம் — ஆம்புலன்ஸ் வழியில்',
    approach:  (km) => `🔊 ஆம்புலன்ஸ் ${km} கிமீ தூரம் — லேன் காலி செய்யுங்கள்`,
    junction:  (n)  => `✅ ${n} → சிக்னல் பச்சை ஆனது`,
    clearDir:  '← அனைத்து வாகனங்கள்: காரிடார் அமைக்க இடது சென்றிடுங்கள்',
    vehicles:  (n)  => `🚗 ${n} வாகனங்கள் காரிடாரிலிருந்து அகற்றப்பட்டன`,
    passage:   '🏥 மருத்துவமனை நெருங்குகிறது — காரிடார் தெளிவாக',
    arrived:   '✅ ஆம்புலன்ஸ் பாதுகாப்பாக மருத்துவமனை அடைந்தது!',
  },
};

/* ══════════════════════════════════════════════
   Hook
   ══════════════════════════════════════════════ */

export function useAmbulanceMap() {
  const [state, setState] = useState<AmbMapState>(() => ({
    phase: 'idle',
    routeCoords: [],
    routeDistance: 0,
    routeDuration: 0,
    apiStatus: 'idle',
    apiTime: 0,
    ambulancePos: null,
    ambulanceProgress: 0,
    sirenActive: false,
    junctions: [],
    junctionsPrepared: 0,
    vehicles: [],
    vehiclesCleared: 0,
    hospitals: HOSPITALS,
    timeSavedSeconds: 0,
    co2Saved: 0,
    clearedProgress: 0,
    notifications: [],
    simulating: false,
    speed: 1,
    language: 'en',
  }));

  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch route ── */
  const fetchRoute = useCallback(async () => {
    setState(p => ({ ...p, apiStatus: 'loading' }));
    const t0 = performance.now();
    const wp: LatLng[] = [AMB_SOURCE, { lat: 12.9420, lng: 77.6050 }, AMB_DEST];
    const result = await fetchOSRM(wp);
    const elapsed = Math.round(performance.now() - t0);
    const coords = result?.coords ?? FALLBACK_ROUTE;

    setState(p => ({
      ...p,
      routeCoords: coords,
      routeDistance: result?.distance ?? 8.2,
      routeDuration: result?.duration ?? 22,
      junctions: generateJunctions(coords),
      vehicles: generateVehicles(coords, 20),
      apiStatus: result ? 'success' : 'fallback',
      apiTime: elapsed,
    }));
  }, []);

  /* ── Start simulation ── */
  const startSim = useCallback(() => {
    if (simRef.current) clearInterval(simRef.current);

    setState(p => ({
      ...p,
      phase: 'detection',
      simulating: true,
      ambulancePos: AMB_SOURCE,
      ambulanceProgress: 0,
      sirenActive: true,
      junctions: p.junctions.map(j => ({ ...j, signal: 'red' as const, prepared: false, warned: false })),
      vehicles: p.routeCoords.length ? generateVehicles(p.routeCoords, 20) : p.vehicles,
      vehiclesCleared: 0,
      junctionsPrepared: 0,
      timeSavedSeconds: 0,
      co2Saved: 0,
      clearedProgress: 0,
      notifications: [],
    }));

    let simTime = 0;

    simRef.current = setInterval(() => {
      simTime += 0.04;

      setState(prev => {
        if (!prev.simulating || !prev.routeCoords.length) return prev;

        const speed = 0.002 * prev.speed;
        const np = Math.min(1, prev.ambulanceProgress + speed);
        const pos = interpolateRoute(prev.routeCoords, np);
        const m = MSGS[prev.language];
        const notifs = [...prev.notifications];

        /* ── Phase detection notification (once) ── */
        if (prev.phase === 'detection' && !notifs.some(n => n.id === 'n-detect')) {
          notifs.unshift({ id: 'n-detect', message: m.detect, time: simTime, type: 'alert' });
        }

        /* ── Junction management ── */
        const newJunctions = prev.junctions.map(j => {
          if (j.prepared) return j;
          const ahead = j.routeProgress - np;

          // Warn when ambulance 0.12–0.22 ahead
          if (!j.warned && ahead > 0 && ahead < 0.22) {
            return { ...j, warned: true, signal: 'yellow' as const };
          }
          // Green when ambulance within 0.12
          if (ahead <= 0.12 && ahead >= -0.05) {
            return { ...j, signal: 'green' as const, prepared: true };
          }
          return j;
        });

        /* ── Junction transition notifications ── */
        newJunctions.forEach((j, i) => {
          if (j.warned && !prev.junctions[i].warned) {
            const km = ((j.routeProgress - np) * prev.routeDistance).toFixed(1);
            notifs.unshift({ id: `n-warn-${i}`, message: m.approach(km), time: simTime, type: 'alert' });
            notifs.unshift({ id: `n-dir-${i}`, message: m.clearDir, time: simTime, type: 'instruction' });
          }
          if (j.prepared && !prev.junctions[i].prepared) {
            notifs.unshift({ id: `n-green-${i}`, message: m.junction(j.name), time: simTime, type: 'clear' });
          }
        });

        const junctionsPrepared = newJunctions.filter(j => j.prepared).length;

        /* ── Vehicle clearing — 3 phases: notify → slide → cleared ── */
        const NOTIFY_RANGE = 0.14;  // notify when ambulance is this far ahead
        const MOVE_RANGE   = 0.10;  // start sliding when ambulance is this close
        const CLEAR_DONE   = 0.04;  // mark fully cleared when ambulance passes

        let newCleared = 0;
        const vehicles = prev.vehicles.map(v => {
          if (v.cleared) return v;

          const ahead = v.routeProgress - np; // positive = vehicle is ahead of ambulance

          // Phase 1: Notify — ambulance approaching, vehicle gets alert
          if (!v.notified && ahead > 0 && ahead < NOTIFY_RANGE) {
            return { ...v, notified: true };
          }

          // Phase 2: Start sliding sideways
          if (v.notified && !v.moving && ahead > 0 && ahead < MOVE_RANGE) {
            return { ...v, moving: true };
          }

          // Phase 3: Animate the slide (increment clearProgress each tick)
          if (v.moving && !v.cleared) {
            const slideSpeed = 0.06 * prev.speed; // faster at higher speed
            const newProg = Math.min(1, v.clearProgress + slideSpeed);
            const eased = newProg < 0.5
              ? 2 * newProg * newProg                   // ease-in
              : 1 - Math.pow(-2 * newProg + 2, 2) / 2; // ease-out

            const newPos = lateralOffset(
              prev.routeCoords,
              v.routeProgress,
              v.clearDirection,
              CLEAR_OFFSET * eased,
            );
            // Blend from original to offset
            const blended: LatLng = {
              lat: v.originalPosition.lat + (newPos.lat - interpolateRoute(prev.routeCoords, v.routeProgress).lat),
              lng: v.originalPosition.lng + (newPos.lng - interpolateRoute(prev.routeCoords, v.routeProgress).lng),
            };

            // Fully cleared once slide done and ambulance passes
            if (newProg >= 1 && ahead < CLEAR_DONE) {
              newCleared++;
              return { ...v, position: blended, clearProgress: 1, cleared: true };
            }

            return { ...v, position: blended, clearProgress: newProg };
          }

          return v;
        });
        const vehiclesCleared = prev.vehiclesCleared + newCleared;

        // Milestone notifications: 5, 10, 15, 20
        for (const th of [5, 10, 15, 20]) {
          if (vehiclesCleared >= th && prev.vehiclesCleared < th) {
            notifs.unshift({ id: `n-v-${th}`, message: m.vehicles(th), time: simTime, type: 'instruction' });
          }
        }

        /* ── Phase transition ── */
        let phase: AmbPhase = prev.phase;
        if (np < 0.08) phase = 'detection';
        else if (np < 0.88) phase = 'clearing';
        else if (np < 1) phase = 'passage';

        if (phase === 'passage' && prev.phase !== 'passage') {
          notifs.unshift({ id: 'n-passage', message: m.passage, time: simTime, type: 'alert' });
        }

        /* ── Stats ── */
        const timeSaved = +(np * 38).toFixed(1);       // up to 38s saved
        const co2 = +(np * 0.168).toFixed(3);           // CO₂ proportional

        /* ── Completion ── */
        if (np >= 1) {
          if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
          notifs.unshift({ id: 'n-arrived', message: m.arrived, time: simTime, type: 'clear' });
          return {
            ...prev, phase: 'done' as AmbPhase,
            simulating: false, ambulancePos: AMB_DEST, ambulanceProgress: 1,
            sirenActive: false, junctions: newJunctions, junctionsPrepared,
            vehicles, vehiclesCleared,
            timeSavedSeconds: 38, co2Saved: 0.168,
            clearedProgress: 1,
            notifications: notifs.slice(0, 20),
          };
        }

        return {
          ...prev, phase,
          ambulancePos: pos, ambulanceProgress: np,
          junctions: newJunctions, junctionsPrepared,
          vehicles, vehiclesCleared,
          timeSavedSeconds: timeSaved, co2Saved: co2,
          clearedProgress: np,
          notifications: notifs.slice(0, 20),
        };
      });
    }, 40);
  }, []);

  /* ── Pause ── */
  const pauseSim = useCallback(() => {
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
    setState(p => ({ ...p, simulating: false }));
  }, []);

  /* ── Reset ── */
  const resetSim = useCallback(() => {
    pauseSim();
    setState(p => ({
      ...p,
      phase: 'idle' as AmbPhase,
      ambulancePos: null, ambulanceProgress: 0,
      sirenActive: false, vehiclesCleared: 0, junctionsPrepared: 0,
      timeSavedSeconds: 0, co2Saved: 0, clearedProgress: 0,
      notifications: [],
      junctions: p.junctions.map(j => ({ ...j, signal: 'red' as const, prepared: false, warned: false })),
      vehicles: p.routeCoords.length ? generateVehicles(p.routeCoords, 20) : p.vehicles,
    }));
  }, [pauseSim]);

  /* ── Controls ── */
  const setSpeed = useCallback((s: number) => setState(p => ({ ...p, speed: s })), []);
  const setLanguage = useCallback((l: AmbLang) => setState(p => ({ ...p, language: l })), []);

  /* ── Cleanup ── */
  useEffect(() => () => { if (simRef.current) clearInterval(simRef.current); }, []);

  return { state, fetchRoute, startSim, pauseSim, resetSim, setSpeed, setLanguage };
}
