# 🚑 LifeLine-X+ AI — AI Ambulance Corridor System

**AI-powered ambulance corridor clearing system for Bengaluru** — real-time traffic simulation, surge prediction, smart rerouting, and driver notifications to save lives.

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-purple?logo=vite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-blue?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📖 Overview

LifeLine-X+ AI is an intelligent traffic management platform designed to create emergency corridors for ambulances in Bengaluru's congested road network. It combines real-time simulation, AI-driven signal control, surge prediction, and safety-aware routing to minimize ambulance response times and save lives.

### Key Stats (Simulated)
| Metric | Value |
|---|---|
| Avg Time Saved | **38 seconds** |
| CO₂ Reduction | **0.15 kg per trip** |
| Corridor Clearance Rate | **94%** |
| Lives Impacted | **1000+** |

---

## 🚀 Features

### 1. Ambulance Priority Simulation
Real-time Canvas 2D simulation of ambulance corridor clearing through multi-junction traffic. Renders vehicles, junctions, road segments, ambulances, heatmaps, and spillover events with play/pause/reset and speed controls. Supports multiple languages.

### 2. Tech Park Surge Predictor
Predicts IT-park shift-change traffic surges across Bengaluru locations (Electronic City, Silk Board, Marathahalli). Uses a time-of-day slider to detect pre-surge/surge/normal zones and pre-optimizes signal timings based on predicted congestion.

### 3. Traffic Admin Panel
Real-time vehicle breakdown detection and response management. Simulates a breakdown feed with tow dispatch, police notification, and driver alerts. Tracks severity levels (minor/major/critical) and status workflows across 8 Bengaluru locations.

### 4. Disruption & Smart Rerouting
Detects road disruptions (construction, processions) and visualizes dynamic rerouting of vehicles around blocked zones. Shows primary and bypass paths with fork logic on an interactive Canvas 2D simulation.

### 5. Safety-Aware Routing
Interactive Leaflet map that detects unsafe zones and dynamically suggests safer routes using safety scoring. Integrates with the OSRM API for route geometry, with route comparison (safe vs. fast) and real-time vehicle tracking.

### 6. Phase Skipping Intelligence
Detects empty lanes at junctions and skips unnecessary signal phases to reduce idle wait time and emissions. Visualizes a 4-way junction with per-lane vehicle detection, signal indicators, and a skip event log.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript 5, Vite 5 |
| **Styling** | Tailwind CSS 3, shadcn/ui, Radix UI |
| **Maps** | Leaflet, React-Leaflet, OSRM API |
| **Charts** | Recharts |
| **State** | TanStack React Query, React Hook Form, Zod |
| **Routing** | React Router DOM v6 |
| **Testing** | Vitest, Playwright, Testing Library |

---

## 📦 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9+)

### Installation

```bash
# Clone the repository
git clone https://github.com/sumukhbhat22/LifeLine-X-AI.git
cd LifeLine-X-AI/ambulance-first-lane-main

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at **http://localhost:8080/**.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── simulation/       # Canvas simulation components
│   │   ├── SimulationCanvas.tsx
│   │   ├── ControlsPanel.tsx
│   │   ├── HeaderBar.tsx
│   │   ├── DriverNotifications.tsx
│   │   ├── SurgeTrafficViz.tsx
│   │   ├── AlternativeRoutes.tsx
│   │   ├── BreakdownAlerts.tsx
│   │   ├── HospitalBeds.tsx
│   │   ├── MiniMap.tsx
│   │   └── SpilloverPanel.tsx
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
│   ├── useSimulation.ts
│   ├── useDisruptionReroute.ts
│   ├── usePhaseSkipping.ts
│   ├── useSafetyRouting.ts
│   └── useAmbulanceMap.ts
├── pages/                # Route pages
│   ├── Dashboard.tsx
│   ├── Simulation.tsx
│   ├── SurgePredictorPage.tsx
│   ├── TrafficAdmin.tsx
│   ├── DisruptionReroute.tsx
│   ├── SafetyRouting.tsx
│   └── PhaseSkipping.tsx
├── configs/              # Demo configuration
├── types/                # TypeScript type definitions
└── lib/                  # Utility functions
```

---

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Lint
npm run lint
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

Team members:
Sumukh Bhat 
Varadendra R Kalakeri(https://github.com/Varadendra97)
Roshan C
Sumukh S

## 👤 Author

**Sumukh Bhat** — [GitHub](https://github.com/sumukhbhat22)
