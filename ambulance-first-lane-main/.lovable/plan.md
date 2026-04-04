
# 🚑 LifeLine-X+ — AI Self-Clearing Smart Corridor

## Interactive Simulation for Hackathon Demo

### Page 1: Main Simulation View
A top-down animated road network showing 3 connected junctions with:
- **Animated vehicles** (colored rectangles) moving along roads
- **Ambulance** (red, flashing) approaching from one end
- **ETA countdown timer** prominently displayed
- **Congestion heatmap overlay** — roads colored green/yellow/red based on vehicle density

### Core Simulation Flow
1. **Detection Phase** — Ambulance appears on the map edge, ETA countdown starts (e.g. 90s)
2. **Pre-Clearing Phase** (ETA < 60s) — Corridor mode activates:
   - Blocking vehicles get labeled arrows ("← Move Left", "→ Move Right", "⏸ Hold")
   - Vehicles animate to their new positions, clearing the ambulance lane
   - Traffic signals change to green on the ambulance route
3. **Passage Phase** — Ambulance moves through the cleared corridor smoothly
4. **Recovery Phase** — Traffic returns to normal flow

### Self-Clearing Corridor
- Vehicles in the ambulance's path are highlighted red as "blockers"
- Each gets a directional instruction badge that animates with the vehicle
- Non-cooperative vehicles (randomly simulated) get flagged with a warning icon after a delay

### Multi-Junction Cascade
- 3 junctions shown on a connected road map
- Each junction lights up sequentially as the ambulance approaches
- Green wave propagates ahead of the ambulance

### Congestion Heatmap
- Semi-transparent color overlay on road segments
- Updates in real-time as vehicles move and corridor clears
- Legend showing Green/Yellow/Red meanings

### Controls Panel (sidebar or bottom bar)
- **Play / Pause / Reset** simulation controls
- **Speed slider** (1x, 2x, 4x)
- **Language selector** — English, Hindi, Kannada, Tamil
  - All vehicle instruction labels switch language in real-time
- **Toggle overlays** — heatmap on/off, instructions on/off

### Header Bar
- "LifeLine-X+" branding with ambulance icon
- Live stats: ETA, vehicles cleared, junctions prepared
- Tagline: "In emergencies, every second matters."

### Design
- Dark theme with neon accents (emergency/tech feel)
- Pulsing red glow on ambulance
- Smooth CSS/JS animations for vehicle movement
- Color palette: dark navy background, bright red (ambulance), green/yellow/red (heatmap), cyan (UI accents)
